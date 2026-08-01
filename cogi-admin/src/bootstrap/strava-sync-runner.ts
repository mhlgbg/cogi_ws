import os from 'node:os'

const STRAVA_SYNC_JOB_UID = 'api::strava-sync-job.strava-sync-job'
const STRAVA_SYNC_JOB_TABLE = 'strava_sync_jobs'
const STRAVA_SYNC_JOB_TENANT_LNK = 'strava_sync_jobs_tenant_lnk'
const STRAVA_SYNC_JOB_USER_LNK = 'strava_sync_jobs_user_lnk'
const STRAVA_SYNC_JOB_CONNECTION_LNK = 'strava_sync_jobs_connection_lnk'
const DEFAULT_INTERVAL_SECONDS = 5
const DEFAULT_STALE_MINUTES = 10
const DEFAULT_MAX_CONCURRENCY = 1
const DEFAULT_MAX_RETRIES = 5

type ClassifiedSyncError = {
  code: string
  message: string
  retryable: boolean
  retryAfter: string | null
  httpStatus: number | null
  category: string
}

type RunnerConfig = {
  enabled: boolean
  intervalMs: number
  staleMs: number
  maxConcurrency: number
  maxRetries: number
  runnerId: string
}

type ClaimedJob = {
  id: number
  status: string
  phase: string
  currentPage: number
  claimedBy: string
  retryCount: number
  connectionId: number | null
  userId: number | null
  tenantId: number | null
  wasStale: boolean
}

type RunnerState = {
  timer: NodeJS.Timeout | null
  enabled: boolean
  shuttingDown: boolean
  tickInProgress: boolean
  activeJobs: Map<number, Promise<void>>
  runnerId: string
}

const runnerState: RunnerState = {
  timer: null,
  enabled: false,
  shuttingDown: false,
  tickInProgress: false,
  activeJobs: new Map(),
  runnerId: '',
}

function toText(value: unknown): string {
  if (value === null || value === undefined) return ''
  return String(value).trim()
}

function toPositiveInt(value: unknown, fallback: number): number {
  const parsed = Number(value)
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback
}

function toBoolean(value: unknown, fallback: boolean) {
  const text = toText(value).toLowerCase()
  if (!text) return fallback
  if (['1', 'true', 'yes', 'on'].includes(text)) return true
  if (['0', 'false', 'no', 'off'].includes(text)) return false
  return fallback
}

function resolveRunnerConfig(): RunnerConfig {
  const isProduction = toText(process.env.NODE_ENV).toLowerCase() === 'production'
  const enabled = toBoolean(process.env.STRAVA_SYNC_RUNNER_ENABLED, !isProduction)
  const intervalSeconds = toPositiveInt(process.env.STRAVA_SYNC_RUNNER_INTERVAL_SECONDS, DEFAULT_INTERVAL_SECONDS)
  const staleMinutes = toPositiveInt(process.env.STRAVA_SYNC_JOB_STALE_MINUTES, DEFAULT_STALE_MINUTES)
  const maxConcurrency = Math.max(1, toPositiveInt(process.env.STRAVA_SYNC_MAX_CONCURRENCY, DEFAULT_MAX_CONCURRENCY))
  const maxRetries = Math.max(1, toPositiveInt(process.env.STRAVA_SYNC_MAX_RETRIES, DEFAULT_MAX_RETRIES))
  const configuredRunnerId = toText(process.env.STRAVA_SYNC_RUNNER_ID)
  const runnerId = configuredRunnerId || `${os.hostname()}:${process.pid}`

  return {
    enabled,
    intervalMs: intervalSeconds * 1000,
    staleMs: staleMinutes * 60 * 1000,
    maxConcurrency,
    maxRetries,
    runnerId,
  }
}

async function getJobById(strapi: any, jobId: number) {
  return strapi.db.query(STRAVA_SYNC_JOB_UID).findOne({
    where: { id: jobId },
    select: ['id', 'status', 'phase', 'currentPage', 'retryCount', 'claimedAt', 'claimedBy', 'heartbeatAt', 'startedAt', 'requestedAt', 'nextRetryAt', 'lastErrorCode', 'lastErrorMessage'],
    populate: {
      tenant: { select: ['id'] },
      user: { select: ['id'] },
      connection: { select: ['id'] },
    },
  })
}

async function releaseStravaSyncJobClaim(strapi: any, jobId: number, runnerId: string, keepClaim = false) {
  if (keepClaim) return

  await strapi.db.query(STRAVA_SYNC_JOB_UID).update({
    where: {
      id: jobId,
      claimedBy: runnerId,
    },
    data: {
      claimedAt: null,
      claimedBy: null,
    },
  })
}

async function scheduleRetryableJob(
  strapi: any,
  stravaService: any,
  jobId: number,
  currentRetryCount: number,
  phase: string,
  status: string,
  classification: ClassifiedSyncError,
  maxRetries: number,
) {
  const nextRetryCount = Math.max(0, Number(currentRetryCount || 0)) + 1
  const nowIso = new Date().toISOString()

  if (nextRetryCount > maxRetries) {
    await strapi.db.query(STRAVA_SYNC_JOB_UID).update({
      where: { id: jobId },
      data: {
        status: 'failed',
        failedAt: nowIso,
        heartbeatAt: nowIso,
        claimedAt: null,
        claimedBy: null,
        nextRetryAt: null,
        lastErrorCode: classification.code,
        lastErrorMessage: classification.message,
        retryCount: nextRetryCount,
      },
    })
    return { failed: true, nextRetryAt: null }
  }

  const retrySchedule = stravaService.calculateStravaRetryDelay({
    retryCount: nextRetryCount,
    category: classification.category,
    retryAfter: classification.retryAfter,
  })
  const nextRetryAt = retrySchedule?.nextRetryAt || nowIso
  const nextStatus = stravaService.getRetryJobStatus(phase, status)

  await strapi.db.query(STRAVA_SYNC_JOB_UID).update({
    where: { id: jobId },
    data: {
      status: nextStatus,
      nextRetryAt,
      retryCount: nextRetryCount,
      heartbeatAt: nowIso,
      failedAt: null,
      lastErrorCode: classification.code,
      lastErrorMessage: classification.message,
      claimedAt: null,
      claimedBy: null,
    },
  })

  return { failed: false, nextRetryAt }
}

async function claimNextStravaSyncJob(options: { strapi: any, runnerId: string, staleMs: number }) {
  const { strapi, runnerId, staleMs } = options
  const knex = strapi.db.connection
  const now = new Date()
  const staleBefore = new Date(now.getTime() - staleMs)

  return knex.transaction(async (trx: any) => {
    const candidate = await trx({ j: STRAVA_SYNC_JOB_TABLE })
      .select([
        'j.id',
        'j.status',
        'j.phase',
        'j.claimed_at as claimedAt',
        'j.current_page as currentPage',
        'j.claimed_by as claimedBy',
        'j.retry_count as retryCount',
        trx.raw(`coalesce(j.heartbeat_at, j.claimed_at, j.started_at, j.requested_at) as "lastTouchedAt"`),
        trx.raw(`(
          select jc.strava_connection_id
          from ${STRAVA_SYNC_JOB_CONNECTION_LNK} jc
          where jc.strava_sync_job_id = j.id
          limit 1
        ) as "connectionId"`),
        trx.raw(`(
          select ju.user_id
          from ${STRAVA_SYNC_JOB_USER_LNK} ju
          where ju.strava_sync_job_id = j.id
          limit 1
        ) as "userId"`),
        trx.raw(`(
          select jt.tenant_id
          from ${STRAVA_SYNC_JOB_TENANT_LNK} jt
          where jt.strava_sync_job_id = j.id
          limit 1
        ) as "tenantId"`),
      ])
      .where((builder: any) => {
        builder
          .where((q: any) => {
            q.where('j.status', 'partial_ready')
              .whereIn('j.phase', ['syncing_history', 'rebuilding_snapshot', 'finalizing'])
          })
          .orWhere((q: any) => {
            q.where('j.status', 'running')
          })
          .orWhere((q: any) => {
            q.where('j.status', 'queued')
          })
      })
      .andWhere((builder: any) => {
        builder.whereNull('j.next_retry_at').orWhere('j.next_retry_at', '<=', now)
      })
      .andWhere((builder: any) => {
        builder.whereNull('j.claimed_at').orWhereRaw('coalesce(j.heartbeat_at, j.claimed_at, j.started_at, j.requested_at) < ?', [staleBefore])
      })
      .whereNotExists(function notExistsActiveSibling(this: any) {
        this.select(trx.raw('1'))
          .from({ aj: STRAVA_SYNC_JOB_TABLE })
          .whereRaw('aj.id <> j.id')
          .whereIn('aj.status', ['running', 'partial_ready'])
          .whereRaw('coalesce(aj.heartbeat_at, aj.claimed_at, aj.started_at, aj.requested_at) >= ?', [staleBefore])
          .andWhere((q: any) => {
            q.whereExists(function sameConnection(this: any) {
              this.select(trx.raw('1'))
                .from({ ajc: STRAVA_SYNC_JOB_CONNECTION_LNK })
                .whereRaw('ajc.strava_sync_job_id = aj.id')
                .whereRaw(`ajc.strava_connection_id = (
                  select jc.strava_connection_id
                  from ${STRAVA_SYNC_JOB_CONNECTION_LNK} jc
                  where jc.strava_sync_job_id = j.id
                  limit 1
                )`)
            })
            .orWhere((sub: any) => {
              sub.where(function sameUserAndTenant(this: any) {
                this.whereExists(function sameUser(this: any) {
                  this.select(trx.raw('1'))
                    .from({ aju: STRAVA_SYNC_JOB_USER_LNK })
                    .whereRaw('aju.strava_sync_job_id = aj.id')
                    .whereRaw(`aju.user_id = (
                      select ju.user_id
                      from ${STRAVA_SYNC_JOB_USER_LNK} ju
                      where ju.strava_sync_job_id = j.id
                      limit 1
                    )`)
                })
                .whereExists(function sameTenant(this: any) {
                  this.select(trx.raw('1'))
                    .from({ ajt: STRAVA_SYNC_JOB_TENANT_LNK })
                    .whereRaw('ajt.strava_sync_job_id = aj.id')
                    .whereRaw(`ajt.tenant_id = (
                      select jt.tenant_id
                      from ${STRAVA_SYNC_JOB_TENANT_LNK} jt
                      where jt.strava_sync_job_id = j.id
                      limit 1
                    )`)
                })
              })
            })
          })
      })
      .orderByRaw("case when j.status = 'partial_ready' then 0 when j.status = 'running' then 1 when j.status = 'queued' then 2 else 3 end asc")
      .orderBy('j.requested_at', 'asc')
      .orderBy('j.id', 'asc')
      .forUpdate()
      .skipLocked()
      .first()

    if (!candidate?.id) return null

    const lastTouchedAtMs = Date.parse(String((candidate as any).lastTouchedAt || ''))
    const wasStale = String(candidate.status || '') === 'running'
      && Number.isFinite(lastTouchedAtMs)
      && lastTouchedAtMs < (now.getTime() - staleMs)
    const nextStatus = String(candidate.status || '') === 'queued' ? 'running' : String(candidate.status || '')

    const updatedCount = await trx(STRAVA_SYNC_JOB_TABLE)
      .where({ id: candidate.id })
      .andWhere((builder: any) => {
        builder.whereNull('claimed_at').orWhereRaw('coalesce(heartbeat_at, claimed_at, started_at, requested_at) < ?', [staleBefore])
      })
      .update({
        status: nextStatus,
        claimed_at: now,
        claimed_by: runnerId,
        heartbeat_at: now,
        started_at: trx.raw('coalesce(started_at, ?)', [now]),
      })

    if (!updatedCount) return null

    return {
      id: Number(candidate.id),
      status: nextStatus,
      phase: String(candidate.phase || ''),
      claimedBy: toText(candidate.claimedBy),
      currentPage: Number(candidate.currentPage || 1),
      retryCount: Number(candidate.retryCount || 0),
      connectionId: Number(candidate.connectionId || 0) || null,
      userId: Number(candidate.userId || 0) || null,
      tenantId: Number(candidate.tenantId || 0) || null,
      wasStale,
    } as ClaimedJob
  })
}

async function runClaimedStravaSyncJob(options: { strapi: any, job: ClaimedJob, config: RunnerConfig }) {
  const { strapi, job, config } = options
  const stravaService = strapi.service('api::strava.strava') as any
  const currentJob = await getJobById(strapi, job.id)

  if (!currentJob?.id) {
    return
  }

  const currentStatus = toText(currentJob.status).toLowerCase()
  if (currentStatus === 'cancelled' || currentStatus === 'completed' || currentStatus === 'failed') {
    await releaseStravaSyncJobClaim(strapi, job.id, config.runnerId, false)
    return
  }

  try {
    const result = await stravaService.processStravaSyncBatch(job.id)

    if (result?.completed) {
      strapi.log.info(`[strava-runner] completed job=${String(job.id)}`)
      await releaseStravaSyncJobClaim(strapi, job.id, config.runnerId, true)
      return
    }

    if (result?.waitForRetry) {
      strapi.log.info(`[strava-runner] rate-limited job=${String(job.id)}`)
      await releaseStravaSyncJobClaim(strapi, job.id, config.runnerId, false)
      return
    }

    await releaseStravaSyncJobClaim(strapi, job.id, config.runnerId, false)
  } catch (error: any) {
    const classified = stravaService.classifyStravaSyncError(error, { phase: toText(currentJob.phase) }) as ClassifiedSyncError

    if (classified.code === 'STRAVA_CONNECTION_REVOKED') {
      await stravaService.cancelStravaSyncJobForRevokedConnection(job.id)
      strapi.log.warn(`[strava-runner] cancelled job=${String(job.id)} code=${classified.code} phase=${toText(currentJob.phase)} page=${String(currentJob.currentPage || job.currentPage || 1)} reason=connection_revoked`)
      return
    }

    if (classified.retryable) {
      const retry = await scheduleRetryableJob(
        strapi,
        stravaService,
        job.id,
        Number(currentJob.retryCount || 0),
        toText(currentJob.phase),
        toText(currentJob.status),
        classified,
        config.maxRetries,
      )
      if (retry.failed) {
        strapi.log.warn(`[strava-runner] failed job=${String(job.id)} after max retries code=${classified.code} category=${classified.category} phase=${toText(currentJob.phase)} page=${String(currentJob.currentPage || job.currentPage || 1)} retryCount=${String(Number(currentJob.retryCount || 0) + 1)}`)
      } else {
        strapi.log.info(`[strava-runner] scheduled retry job=${String(job.id)} code=${classified.code} category=${classified.category} phase=${toText(currentJob.phase)} page=${String(currentJob.currentPage || job.currentPage || 1)} retryCount=${String(Number(currentJob.retryCount || 0) + 1)} nextRetryAt=${String(retry.nextRetryAt || '')}`)
      }
      return
    }

    strapi.log.warn(`[strava-runner] failed job=${String(job.id)} code=${classified.code} category=${classified.category} phase=${toText(currentJob.phase)} page=${String(currentJob.currentPage || job.currentPage || 1)} retryCount=${String(currentJob.retryCount || 0)}`)
    await releaseStravaSyncJobClaim(strapi, job.id, config.runnerId, true)
  }
}

export async function runStravaSyncRunnerTick(strapi: any) {
  const config = resolveRunnerConfig()
  if (!config.enabled || runnerState.shuttingDown) return
  if (runnerState.tickInProgress) return

  runnerState.tickInProgress = true

  try {
    const slots = Math.max(0, config.maxConcurrency - runnerState.activeJobs.size)
    if (slots <= 0) return

    const claimedJobs: ClaimedJob[] = []
    for (let index = 0; index < slots; index += 1) {
      const claimed = await claimNextStravaSyncJob({
        strapi,
        runnerId: config.runnerId,
        staleMs: config.staleMs,
      })
      if (!claimed?.id) break
      claimedJobs.push(claimed)
      strapi.log.info(`[strava-runner] claimed job=${String(claimed.id)} status=${claimed.status} phase=${claimed.phase} page=${String(claimed.currentPage || 1)} retryCount=${String(claimed.retryCount || 0)}${claimed.wasStale ? ` stale-recovered previousClaimedBy=${claimed.claimedBy || '-'}` : ''}`)
    }

    await Promise.allSettled(claimedJobs.map((job) => {
      const promise = runClaimedStravaSyncJob({ strapi, job, config })
        .finally(() => {
          runnerState.activeJobs.delete(job.id)
        })
      runnerState.activeJobs.set(job.id, promise)
      return promise
    }))
  } finally {
    runnerState.tickInProgress = false
  }
}

export async function startStravaSyncRunner(strapi: any) {
  const config = resolveRunnerConfig()
  runnerState.runnerId = config.runnerId
  runnerState.shuttingDown = false

  if (!config.enabled) {
    runnerState.enabled = false
    strapi.log.info('[strava-runner] disabled')
    return
  }

  if (runnerState.timer) {
    strapi.log.info('[strava-runner] already started')
    return
  }

  runnerState.enabled = true
  runnerState.timer = setInterval(() => {
    void runStravaSyncRunnerTick(strapi)
  }, config.intervalMs)

  strapi.log.info(`[strava-runner] started interval=${String(config.intervalMs)}ms concurrency=${String(config.maxConcurrency)} runnerId=${config.runnerId}`)
  void runStravaSyncRunnerTick(strapi)
}

export async function stopStravaSyncRunner(strapi: any) {
  runnerState.shuttingDown = true

  if (runnerState.timer) {
    clearInterval(runnerState.timer)
    runnerState.timer = null
  }

  const activeJobs = Array.from(runnerState.activeJobs.values())
  if (activeJobs.length > 0) {
    await Promise.allSettled(activeJobs)
  }

  runnerState.activeJobs.clear()
  runnerState.enabled = false
  strapi.log.info('[strava-runner] stopped')
}