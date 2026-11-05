'use strict'

const fs = require('fs')
const path = require('path')
const jwt = require('jsonwebtoken')
const { Client } = require('pg')

function loadEnvFile(filePath) {
  const env = {}
  const text = fs.readFileSync(filePath, 'utf8')
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eqIndex = trimmed.indexOf('=')
    if (eqIndex <= 0) continue
    env[trimmed.slice(0, eqIndex).trim()] = trimmed.slice(eqIndex + 1)
  }
  return env
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message)
  }
}

async function main() {
  const rootDir = path.resolve(__dirname, '..')
  const env = loadEnvFile(path.join(rootDir, '.env'))
  const tenantCode = process.env.GAME_TEST_TENANT_CODE || 'vkl'
  const apiBaseRaw = process.env.GAME_TEST_API_BASE || env.BACKEND_URL || `http://127.0.0.1:${env.PORT || '1339'}`
  const apiBase = apiBaseRaw.replace('http://localhost:', 'http://127.0.0.1:').replace('https://localhost:', 'https://127.0.0.1:')
  const db = new Client({
    host: process.env.DATABASE_HOST || env.DATABASE_HOST || '127.0.0.1',
    port: Number(process.env.DATABASE_PORT || env.DATABASE_PORT || 5432),
    database: process.env.DATABASE_NAME || env.DATABASE_NAME || 'strapi',
    user: process.env.DATABASE_USERNAME || env.DATABASE_USERNAME || 'strapi',
    password: process.env.DATABASE_PASSWORD || env.DATABASE_PASSWORD || '',
  })

  await db.connect()

  const tenantRes = await db.query('select id from tenants where code = $1 limit 1', [tenantCode])
  const tenantId = Number(tenantRes.rows[0]?.id || 0)
  assert(tenantId > 0, `Tenant ${tenantCode} not found`)

  const adminRes = await db.query(`
    select distinct utu.user_id
    from user_tenants_tenant_lnk utt
    join user_tenants ut on ut.id = utt.user_tenant_id and ut.user_tenant_status = 'active'
    join user_tenants_user_lnk utu on utu.user_tenant_id = ut.id
    join user_tenant_roles_user_tenant_lnk utrut on utrut.user_tenant_id = ut.id
    join user_tenant_roles utr on utr.id = utrut.user_tenant_role_id and utr.user_tenant_role_status = 'active'
    join user_tenant_roles_role_lnk utrr on utrr.user_tenant_role_id = utr.id
    join up_roles r on r.id = utrr.role_id
    where utt.tenant_id = $1 and (lower(coalesce(r.type, '')) = 'tenant_admin' or lower(coalesce(r.name, '')) = 'tenant admin')
    limit 1
  `, [tenantId])
  const adminUserId = Number(adminRes.rows[0]?.user_id || 0)
  assert(adminUserId > 0, 'No tenant admin found for test tenant')

  const outsiderRes = await db.query(`
    select distinct utu.user_id
    from user_tenants_tenant_lnk utt
    join user_tenants ut on ut.id = utt.user_tenant_id and ut.user_tenant_status = 'active'
    join user_tenants_user_lnk utu on utu.user_tenant_id = ut.id
    where utt.tenant_id <> $1
      and not exists (
        select 1
        from user_tenants_tenant_lnk utt2
        join user_tenants_user_lnk utu2 on utu2.user_tenant_id = utt2.user_tenant_id
        where utt2.tenant_id = $1 and utu2.user_id = utu.user_id
      )
    limit 1
  `, [tenantId])
  const outsiderUserId = Number(outsiderRes.rows[0]?.user_id || 0)
  assert(outsiderUserId > 0, 'No outsider user found for tenant isolation test')

  const token = jwt.sign({ id: adminUserId }, process.env.JWT_SECRET || env.JWT_SECRET)

  async function api(pathname, options = {}) {
    const response = await fetch(`${apiBase.replace(/\/+$/, '')}/api${pathname}`, {
      ...options,
      headers: {
        Authorization: `Bearer ${token}`,
        'x-tenant-code': tenantCode,
        'Content-Type': 'application/json',
        ...(options.headers || {}),
      },
    })
    const text = await response.text()
    let body = null
    try {
      body = JSON.parse(text)
    } catch {
      body = text
    }
    return { status: response.status, body }
  }

  async function createGame(code, payload) {
    const response = await api('/game-management/games', {
      method: 'POST',
      body: JSON.stringify({
        data: {
          code,
          name: code,
          description: code,
          gameTypeCode: 'xp_challenge',
          timezone: 'Asia/Ho_Chi_Minh',
          lateRegistrationEnabled: true,
          ...payload,
        },
      }),
    })
    assert(response.status === 200, `Failed to create game ${code}: ${JSON.stringify(response.body)}`)
    return response.body.data.game.id
  }

  async function publishGame(gameId) {
    const response = await api(`/game-management/games/${gameId}/publish`, { method: 'POST' })
    assert(response.status === 200, `Failed to publish game ${gameId}: ${JSON.stringify(response.body)}`)
  }

  async function setRule(gameId, activityCode, values) {
    const detail = await api(`/game-management/games/${gameId}`)
    assert(detail.status === 200, `Failed to load detail for ${gameId}`)
    const nextRules = (detail.body.data.rules || []).map((rule) => (
      rule.activityCode === activityCode ? { ...rule, ...values } : rule
    ))
    const response = await api(`/game-management/games/${gameId}/rules`, {
      method: 'PUT',
      body: JSON.stringify({ data: { rules: nextRules } }),
    })
    assert(response.status === 200, `Failed to update rules for ${gameId}: ${JSON.stringify(response.body)}`)
  }

  async function insertParticipant(gameId, userId, runVersion = 1) {
    await db.query(`
      insert into game_participants
        (tenant_id, game_id, user_id, run_version, status, registered_at, total_xp, trial_xp, official_xp, rank_score, created_at, updated_at)
      values
          ($1, $2, $3, $4, 'active', now() - interval '10 day', 0, 0, 0, 0, now(), now())
    `, [tenantId, gameId, userId, runVersion])
  }

  async function latestCurrentRun(gameId) {
    const res = await db.query('select current_run_version from games where id = $1', [gameId])
    return Number(res.rows[0]?.current_run_version || 1)
  }

  async function processActivity(gameId, payload) {
    return api(`/game-management/games/${gameId}/dev/process-activity`, {
      method: 'POST',
      body: JSON.stringify({ data: payload }),
    })
  }

  async function createResetChallenge(gameId) {
    return api(`/game-management/games/${gameId}/reset-challenge`, { method: 'POST' })
  }

  async function resetGame(gameId, payload) {
    return api(`/game-management/games/${gameId}/reset`, {
      method: 'POST',
      body: JSON.stringify({ data: payload }),
    })
  }

  async function cleanupGame(gameId) {
    const sqls = [
      'delete from game_reset_challenges where game_id = $1',
      'delete from game_admin_audits where game_id = $1',
      'delete from game_ledgers where game_id = $1',
      'delete from game_events where game_id = $1',
      'delete from game_participants where game_id = $1',
      'delete from game_activity_rules where game_id = $1',
      'delete from games_game_type_lnk where game_id = $1',
      'delete from games_tenant_lnk where game_id = $1',
      'delete from games where id = $1',
    ]
    for (const sql of sqls) {
      try {
        await db.query(sql, [gameId])
      } catch {}
    }
  }

  const createdGames = []
  try {
    const now = new Date()
    const oneDayMs = 24 * 60 * 60 * 1000
    const officialStart = new Date(now.getTime() - oneDayMs)
    const officialEnd = new Date(now.getTime() + oneDayMs)
    const registrationOpen = new Date(now.getTime() - 2 * oneDayMs)
    const registrationClose = new Date(now.getTime() + oneDayMs)

    const officialGameId = await createGame(`xp3a-official-${Date.now()}`, {
      hasTrial: false,
      registrationOpenAt: registrationOpen.toISOString(),
      registrationCloseAt: registrationClose.toISOString(),
      startsAt: officialStart.toISOString(),
      endsAt: officialEnd.toISOString(),
    })
    createdGames.push(officialGameId)
    await publishGame(officialGameId)
    await insertParticipant(officialGameId, adminUserId, 1)

    const trialGameId = await createGame(`xp3a-trial-${Date.now()}`, {
      hasTrial: true,
      registrationOpenAt: registrationOpen.toISOString(),
      registrationCloseAt: registrationClose.toISOString(),
      trialStartAt: new Date(now.getTime() - 2 * 60 * 60 * 1000).toISOString(),
      trialEndAt: new Date(now.getTime() + 2 * 60 * 60 * 1000).toISOString(),
      startsAt: new Date(now.getTime() + 6 * 60 * 60 * 1000).toISOString(),
      endsAt: new Date(now.getTime() + oneDayMs).toISOString(),
    })
    createdGames.push(trialGameId)
    await publishGame(trialGameId)
    await insertParticipant(trialGameId, adminUserId, 1)

    const limitGameId = await createGame(`xp3a-limit-${Date.now()}`, {
      hasTrial: false,
      registrationOpenAt: registrationOpen.toISOString(),
      registrationCloseAt: registrationClose.toISOString(),
      startsAt: officialStart.toISOString(),
      endsAt: officialEnd.toISOString(),
    })
    createdGames.push(limitGameId)
    await publishGame(limitGameId)
    await insertParticipant(limitGameId, adminUserId, 1)

    const draftGameId = await createGame(`xp3a-draft-${Date.now()}`, {
      hasTrial: false,
      registrationOpenAt: registrationOpen.toISOString(),
      registrationCloseAt: registrationClose.toISOString(),
      startsAt: officialStart.toISOString(),
      endsAt: officialEnd.toISOString(),
    })
    createdGames.push(draftGameId)
    await insertParticipant(draftGameId, adminUserId, 1)

    const endedGameId = await createGame(`xp3a-ended-${Date.now()}`, {
      hasTrial: false,
      registrationOpenAt: new Date(now.getTime() - 5 * oneDayMs).toISOString(),
      registrationCloseAt: new Date(now.getTime() - 4 * oneDayMs).toISOString(),
      startsAt: new Date(now.getTime() - 4 * oneDayMs).toISOString(),
      endsAt: new Date(now.getTime() - 2 * oneDayMs).toISOString(),
    })
    createdGames.push(endedGameId)
    await publishGame(endedGameId)
    await insertParticipant(endedGameId, adminUserId, 1)

    // 1. Valid event awarded
    let res = await processActivity(officialGameId, {
      userId: adminUserId,
      activityCode: 'community_post',
      sourceType: 'community_post',
      sourceId: 'post-valid-1',
      occurredAt: new Date().toISOString(),
      metadata: { isEligible: true, occurredAtTrusted: true },
    })
    assert(res.status === 200 && res.body.data.awarded === true && res.body.data.xpAwarded === 10, 'Valid event should award XP')

    // 2. Duplicate event no second award
    res = await processActivity(officialGameId, {
      userId: adminUserId,
      activityCode: 'community_post',
      sourceType: 'community_post',
      sourceId: 'post-valid-1',
      occurredAt: new Date().toISOString(),
      metadata: { isEligible: true, occurredAtTrusted: true },
    })
    assert(res.status === 200 && res.body.data.reasonCode === 'duplicate', 'Duplicate event should be reported')

    // 3. Concurrent duplicate requests no double award
    const concurrent = await Promise.all([
      processActivity(officialGameId, {
        userId: adminUserId,
        activityCode: 'community_comment',
        sourceType: 'community_comment',
        sourceId: 'comment-concurrent-1',
        occurredAt: new Date().toISOString(),
        metadata: { isEligible: true, occurredAtTrusted: true },
      }),
      processActivity(officialGameId, {
        userId: adminUserId,
        activityCode: 'community_comment',
        sourceType: 'community_comment',
        sourceId: 'comment-concurrent-1',
        occurredAt: new Date().toISOString(),
        metadata: { isEligible: true, occurredAtTrusted: true },
      }),
    ])
    const concurrentAwardCount = concurrent.filter((item) => item.body?.data?.awarded === true).length
    const concurrentDuplicateCount = concurrent.filter((item) => item.body?.data?.reasonCode === 'duplicate').length
    assert(concurrentAwardCount === 1 && concurrentDuplicateCount === 1, 'Concurrent duplicate requests should award once')

    // 4. Exceed daily limit with distinct community post events
    await db.query(`update game_activity_rules set max_count = 1 where game_id = $1 and activity_code = 'community_post'`, [limitGameId])
    res = await processActivity(limitGameId, {
      userId: adminUserId,
      activityCode: 'community_post',
      sourceType: 'community_post',
      sourceId: 'post-limit-1',
      occurredAt: new Date().toISOString(),
      metadata: { isEligible: true, occurredAtTrusted: true },
    })
    assert(res.status === 200 && res.body.data.awarded === true, 'First post within limit should award')
    res = await processActivity(limitGameId, {
      userId: adminUserId,
      activityCode: 'community_post',
      sourceType: 'community_post',
      sourceId: 'post-limit-2',
      occurredAt: new Date().toISOString(),
      metadata: { isEligible: true, occurredAtTrusted: true },
    })
    assert(res.status === 200 && res.body.data.reasonCode === 'limit_reached', 'Second post on same day should hit limit')
    await db.query(`update game_activity_rules set max_count = 5 where game_id = $1 and activity_code = 'community_post'`, [limitGameId])

    // 5 & 6. New day + timezone reset
    const tzOffsetMs = 7 * 60 * 60 * 1000
    const localNow = new Date(now.getTime() + tzOffsetMs)
    const localMidnightUtcMs = Date.UTC(
      localNow.getUTCFullYear(),
      localNow.getUTCMonth(),
      localNow.getUTCDate(),
      0,
      0,
      0,
    ) - tzOffsetMs
    const beforeMidnightUtc = new Date(localMidnightUtcMs - 30 * 60 * 1000)
    const afterMidnightUtc = new Date(localMidnightUtcMs + 30 * 60 * 1000)
    res = await processActivity(limitGameId, {
      userId: adminUserId,
      activityCode: 'daily_active',
      occurredAt: beforeMidnightUtc.toISOString(),
      metadata: { occurredAtTrusted: true },
    })
    assert(res.status === 200 && res.body.data.awarded === true, 'Daily award before midnight should be processable')
    res = await processActivity(limitGameId, {
      userId: adminUserId,
      activityCode: 'daily_active',
      occurredAt: afterMidnightUtc.toISOString(),
      metadata: { occurredAtTrusted: true },
    })
    assert(res.status === 200 && res.body.data.awarded === true, 'New local day should allow a new daily award')

    // 7. Rule disabled
    await db.query(`update game_activity_rules set is_enabled = false where game_id = $1 and activity_code = 'community_comment'`, [officialGameId])
    res = await processActivity(officialGameId, {
      userId: adminUserId,
      activityCode: 'community_comment',
      sourceType: 'community_comment',
      sourceId: 'comment-disabled-rule',
      occurredAt: new Date().toISOString(),
      metadata: { isEligible: true, occurredAtTrusted: true },
    })
    assert(res.status === 200 && res.body.data.reasonCode === 'rule_disabled', 'Disabled rule should not award')
    await db.query(`update game_activity_rules set is_enabled = true where game_id = $1 and activity_code = 'community_comment'`, [officialGameId])

    // 8. Unregistered user blocked
    res = await processActivity(officialGameId, {
      userId: outsiderUserId,
      activityCode: 'community_post',
      sourceType: 'community_post',
      sourceId: 'outsider-post',
      occurredAt: new Date().toISOString(),
      metadata: { isEligible: true, occurredAtTrusted: true },
    })
    assert(res.status === 403 || res.body?.error?.message || res.body?.data?.reasonCode === 'participant_not_registered', 'Unregistered or outsider user should be blocked')

    // 9. Draft game blocked
    res = await processActivity(draftGameId, {
      userId: adminUserId,
      activityCode: 'community_post',
      sourceType: 'community_post',
      sourceId: 'draft-post',
      occurredAt: new Date().toISOString(),
      metadata: { isEligible: true, occurredAtTrusted: true },
    })
    assert(res.status === 200 && res.body.data.reasonCode === 'game_draft', 'Draft game should reject XP')

    // 10. Ended game blocked
    res = await processActivity(endedGameId, {
      userId: adminUserId,
      activityCode: 'community_post',
      sourceType: 'community_post',
      sourceId: 'ended-post',
      occurredAt: new Date().toISOString(),
      metadata: { isEligible: true, occurredAtTrusted: true },
    })
    assert(res.status === 200 && res.body.data.reasonCode === 'game_ended', 'Ended game should reject XP')

    // 11. Trial XP separate from official XP
    res = await processActivity(trialGameId, {
      userId: adminUserId,
      activityCode: 'community_post',
      sourceType: 'community_post',
      sourceId: 'trial-post-1',
      occurredAt: new Date().toISOString(),
      metadata: { isEligible: true, occurredAtTrusted: true },
    })
    assert(res.status === 200 && res.body.data.phase === 'trial' && res.body.data.trialXp === 10 && res.body.data.officialXp === 0, 'Trial XP should not affect official XP')

    // 12. Trial and official limits independent
    const trialOccurredAt = new Date(now.getTime() - 60 * 60 * 1000)
    const officialOccurredAt = new Date(now.getTime() + 7 * 60 * 60 * 1000)
    res = await processActivity(trialGameId, {
      userId: adminUserId,
      activityCode: 'daily_active',
      occurredAt: trialOccurredAt.toISOString(),
      metadata: { occurredAtTrusted: true },
    })
    assert(res.status === 200 && res.body.data.awarded === true && res.body.data.phase === 'trial', 'Trial daily award should succeed')
    res = await processActivity(trialGameId, {
      userId: adminUserId,
      activityCode: 'daily_active',
      occurredAt: officialOccurredAt.toISOString(),
      metadata: { occurredAtTrusted: true },
    })
    assert(res.status === 200 && res.body.data.awarded === true && res.body.data.phase === 'official', 'Official daily award should use independent phase limit')

    // 13. Admin controls around trial/official boundaries
    const resetChallenge = await createResetChallenge(officialGameId)
    assert(resetChallenge.status === 409, 'Reset should be unavailable while game is published')
    const unpublish = await api(`/game-management/games/${officialGameId}/unpublish`, { method: 'POST' })
    assert(unpublish.status === 409, 'Unpublish should be blocked after official has started')

    const trialUnpublish = await api(`/game-management/games/${trialGameId}/unpublish`, { method: 'POST' })
    assert(trialUnpublish.status === 200, `Trial game should allow unpublish before official starts: ${JSON.stringify(trialUnpublish.body)}`)
    assert(
      String(trialUnpublish.body?.data?.game?.adminStatus || '').toLowerCase() === 'draft',
      'Trial game should move back to draft after unpublish',
    )
    const trialResetChallenge = await createResetChallenge(trialGameId)
    assert(trialResetChallenge.status === 200, 'Reset challenge should be available after trial unpublish')
    const wrongReset = await resetGame(trialGameId, {
      challengeId: trialResetChallenge.body.data.challenge.id,
      reason: 'Wrong answer check',
      answer: 1,
      acknowledged: true,
    })
    assert(wrongReset.status === 409, 'Reset should fail with wrong multiplication answer')
    const trialResetAnswer = trialResetChallenge.body.data.challenge.leftOperand * trialResetChallenge.body.data.challenge.rightOperand
    const trialReset = await resetGame(trialGameId, {
      challengeId: trialResetChallenge.body.data.challenge.id,
      reason: 'Trial reset before rule edits',
      answer: trialResetAnswer,
      acknowledged: true,
    })
    assert(trialReset.status === 200 && trialReset.body.data.newRunVersion === 2, 'Trial reset should move to the next run version')
    await setRule(trialGameId, 'community_post', { xpAmount: 11, maxCount: 4 })
    const trialDetailAfterRule = await api(`/game-management/games/${trialGameId}`)
    const updatedRule = (trialDetailAfterRule.body?.data?.rules || []).find((item) => item.activityCode === 'community_post')
    assert(Number(updatedRule?.xpAmount || 0) === 11, 'XP rule should be editable after reset')

    // 14. Reset runVersion isolates old points
    const resetOnlyGameId = await createGame(`xp3a-reset-${Date.now()}`, {
      hasTrial: false,
      registrationOpenAt: registrationOpen.toISOString(),
      registrationCloseAt: registrationClose.toISOString(),
      startsAt: officialStart.toISOString(),
      endsAt: officialEnd.toISOString(),
    })
    createdGames.push(resetOnlyGameId)
    await insertParticipant(resetOnlyGameId, adminUserId, 1)
    const challenge = await createResetChallenge(resetOnlyGameId)
    assert(challenge.status === 200, 'Reset challenge should be issued for draft game with participant progress')
    const answer = challenge.body.data.challenge.leftOperand * challenge.body.data.challenge.rightOperand
    res = await resetGame(resetOnlyGameId, {
      challengeId: challenge.body.data.challenge.id,
      reason: 'Reset test',
      answer,
      acknowledged: true,
    })
    assert(res.status === 200 && res.body.data.newRunVersion === 2, 'Reset should move to runVersion 2')
    await insertParticipant(resetOnlyGameId, adminUserId, 2)
    res = await processActivity(resetOnlyGameId, {
      userId: adminUserId,
      activityCode: 'community_post',
      sourceType: 'community_post',
      sourceId: 'reset-run-post',
      occurredAt: new Date().toISOString(),
      metadata: { isEligible: true, occurredAtTrusted: true },
    })
    assert(res.status === 200 && res.body.data.awarded === false && res.body.data.reasonCode === 'game_draft', 'Draft after reset should still not award until published')

    // 15. Tenant mismatch rejection via membership check
    res = await processActivity(officialGameId, {
      userId: outsiderUserId,
      activityCode: 'community_post',
      sourceType: 'community_post',
      sourceId: 'tenant-mismatch',
      occurredAt: new Date().toISOString(),
      metadata: { isEligible: true, occurredAtTrusted: true },
    })
    assert([403, 200].includes(res.status), 'Tenant mismatch should not succeed')
    if (res.status === 200) {
      assert(res.body.data.reasonCode === 'participant_not_registered', 'Tenant mismatch should not award XP')
    }

    // 16. Ledger and participant totals consistent
    const totalCheck = await db.query(`
      select
        gp.total_xp,
        gp.trial_xp,
        gp.official_xp,
        coalesce(sum(case when gl.phase = 'trial' and gl.entry_type = 'credit' then gl.xp_amount else 0 end), 0) as trial_sum,
        coalesce(sum(case when gl.phase = 'official' and gl.entry_type = 'credit' then gl.xp_amount else 0 end), 0) as official_sum,
        coalesce(sum(case when gl.entry_type = 'credit' then gl.xp_amount else 0 end), 0) as total_sum
      from game_participants gp
      left join game_ledgers gl on gl.participant_id = gp.id
      where gp.game_id = $1 and gp.user_id = $2 and gp.run_version = 1
      group by gp.total_xp, gp.trial_xp, gp.official_xp
    `, [officialGameId, adminUserId])
    const totals = totalCheck.rows[0]
    assert(Number(totals.total_xp) === Number(totals.total_sum), 'Participant totalXp must match ledger total')
    assert(Number(totals.trial_xp) === Number(totals.trial_sum), 'Participant trialXp must match ledger trial total')
    assert(Number(totals.official_xp) === Number(totals.official_sum), 'Participant officialXp must match ledger official total')

    // 17. Technical error distinguished from business rejection
    res = await processActivity(officialGameId, {
      userId: adminUserId,
      activityCode: 'community_post',
      sourceType: 'community_post',
      sourceId: 'x'.repeat(400),
      occurredAt: new Date().toISOString(),
      metadata: { isEligible: true, occurredAtTrusted: true },
    })
    assert(res.status === 500, 'Oversized sourceId should trigger technical failure')

    // 18. Retry after technical failure can succeed safely
    res = await processActivity(officialGameId, {
      userId: adminUserId,
      activityCode: 'community_post',
      sourceType: 'community_post',
      sourceId: 'retry-after-failure',
      occurredAt: new Date().toISOString(),
      metadata: { isEligible: true, occurredAtTrusted: true },
    })
    assert(res.status === 200 && [true, false].includes(res.body.data.awarded), 'Retry after failure should be safe to process')

    console.log('XP engine core test script completed successfully.')
  } finally {
    for (const gameId of createdGames) {
      await cleanupGame(gameId)
    }
    await db.end()
  }
}

main().catch((error) => {
  console.error('[game-xp-engine-core.test] Failed:', error)
  process.exitCode = 1
})
