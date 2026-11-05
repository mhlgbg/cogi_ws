async function hasTable(knex, tableName) {
  try {
    return await knex.schema.hasTable(tableName)
  } catch {
    return false
  }
}

async function hasColumn(knex, tableName, columnName) {
  try {
    return await knex.schema.hasColumn(tableName, columnName)
  } catch {
    return false
  }
}

async function getTableColumns(knex, tableName) {
  if (!(await hasTable(knex, tableName))) return new Set()

  try {
    const client = String(knex?.client?.config?.client || '').toLowerCase()
    if (client.includes('sqlite')) {
      const rows = await knex.raw(`PRAGMA table_info(${tableName})`)
      const values = Array.isArray(rows) ? rows : rows?.[0]
      return new Set((values || []).map((row) => String(row.name || '').trim()).filter(Boolean))
    }

    const rows = await knex('information_schema.columns')
      .select('column_name')
      .where({
        table_schema: 'public',
        table_name: tableName,
      })
    return new Set((rows || []).map((row) => String(row.column_name || '').trim()).filter(Boolean))
  } catch {
    return new Set()
  }
}

async function findExistingTable(knex, candidates) {
  for (const tableName of candidates) {
    if (await hasTable(knex, tableName)) return tableName
  }
  return null
}

async function resolveLinkStorage(knex, tableName, relationName) {
  const singularBase = tableName.endsWith('s') ? tableName.slice(0, -1) : tableName
  const linkTable = await findExistingTable(knex, [
    `${tableName}_${relationName}_lnk`,
    `${tableName}_${relationName}_links`,
    `${singularBase}_${relationName}_lnk`,
    `${singularBase}_${relationName}_links`,
  ])

  if (!linkTable) return null

  const columns = await getTableColumns(knex, linkTable)
  const sourceCandidates = [`${singularBase}_id`, `${tableName}_id`, 'entity_id', 'source_id']
  const targetCandidates = [`${relationName}_id`, `${relationName}s_id`, `inv_${relationName}_id`, 'target_id']
  const sourceColumn = sourceCandidates.find((column) => columns.has(column)) || null
  const targetColumn = targetCandidates.find((column) => columns.has(column)) || null

  if (!sourceColumn || !targetColumn) return null
  return { linkTable, sourceColumn, targetColumn }
}

async function ensureShadowColumn(knex, tableName, columnName) {
  if (!(await hasTable(knex, tableName))) return
  if (await hasColumn(knex, tableName, columnName)) return

  await knex.schema.alterTable(tableName, (table) => {
    table.integer(columnName).unsigned().nullable()
  })
}

async function backfillShadowColumn(knex, tableName, shadowColumn, relationName) {
  if (!(await hasTable(knex, tableName))) return
  if (!(await hasColumn(knex, tableName, shadowColumn))) return

  const storage = await resolveLinkStorage(knex, tableName, relationName)
  const client = String(knex?.client?.config?.client || '').toLowerCase()
  if (!storage || !client.includes('pg')) return

  await knex.raw(`
    update ${tableName} as base
    set ${shadowColumn} = link.${storage.targetColumn}
    from ${storage.linkTable} as link
    where base.id = link.${storage.sourceColumn}
      and base.${shadowColumn} is distinct from link.${storage.targetColumn}
      and link.${storage.targetColumn} is not null
  `)
}

async function prepareBaseTable(knex, tableName, mappings) {
  if (!(await hasTable(knex, tableName))) return

  for (const mapping of mappings) {
    await ensureShadowColumn(knex, tableName, mapping.column)
    await backfillShadowColumn(knex, tableName, mapping.column, mapping.relation)
  }
}

async function backfillColumnValueIfExists(knex, tableName, columnName, value) {
  if (!(await hasTable(knex, tableName))) return
  if (!(await hasColumn(knex, tableName, columnName))) return
  await knex(tableName).whereNull(columnName).update({ [columnName]: value })
}

async function createIndexIfColumnsExist(knex, tableName, indexName, columns, unique = false) {
  if (!(await hasTable(knex, tableName))) return

  const existingColumns = await getTableColumns(knex, tableName)
  if (!columns.every((column) => existingColumns.has(column))) return

  const client = String(knex?.client?.config?.client || '').toLowerCase()
  const quotedColumns = columns.map((column) => `"${column}"`).join(', ')

  if (client.includes('pg')) {
    const prefix = unique ? 'create unique index if not exists' : 'create index if not exists'
    await knex.raw(`${prefix} ${indexName} on ${tableName} (${quotedColumns})`)
    return
  }

  try {
    await knex.schema.alterTable(tableName, (table) => {
      if (unique) {
        table.unique(columns, indexName)
      } else {
        table.index(columns, indexName)
      }
    })
  } catch {
    // ignore duplicate create attempts
  }
}

async function dropIndexIfExists(knex, tableName, indexName, unique = false) {
  if (!(await hasTable(knex, tableName))) return

  try {
    await knex.schema.alterTable(tableName, (table) => {
      if (unique) {
        table.dropUnique([], indexName)
      } else {
        table.dropIndex([], indexName)
      }
    })
  } catch {
    try {
      await knex.raw(`drop index if exists ${indexName}`)
    } catch {
      // ignore if already absent
    }
  }
}

async function removeDuplicateRows(knex, tableName, columns) {
  if (!(await hasTable(knex, tableName))) return
  if (!columns.length) return

  const existingColumns = await getTableColumns(knex, tableName)
  if (!existingColumns.has('id')) return
  if (!columns.every((column) => existingColumns.has(column))) return

  const duplicates = await knex(tableName)
    .select([...columns, knex.raw('MIN(id) as keep_id')])
    .whereNotNull(columns[0])
    .groupBy(columns)
    .havingRaw('COUNT(*) > 1')

  for (const row of duplicates || []) {
    const keepId = Number(row.keep_id || 0)
    if (!keepId) continue

    let query = knex(tableName).whereNot('id', keepId)
    for (const column of columns) {
      const value = row[column]
      if (value === null || value === undefined) {
        query = query.whereNull(column)
      } else {
        query = query.where(column, value)
      }
    }
    await query.del()
  }
}

module.exports = {
  async up(knex) {
    if (!(await hasTable(knex, 'ghost_race_attempts'))) {
      await knex.schema.createTable('ghost_race_attempts', (table) => {
        table.increments('id').primary()
        table.datetime('created_at')
        table.datetime('updated_at')
        table.datetime('published_at')
        table.integer('tenant_id').unsigned().nullable()
        table.integer('game_id').unsigned().nullable()
        table.integer('participant_id').unsigned().nullable()
        table.integer('user_id').unsigned().nullable()
        table.string('attempt_token', 255).nullable()
        table.string('phase', 32).nullable()
        table.integer('run_version').unsigned().nullable()
        table.integer('lane_number_snapshot').unsigned().nullable()
        table.string('engine_version', 120).nullable()
        table.string('physics_version', 120).nullable()
        table.string('track_version', 120).nullable()
        table.string('rules_version', 120).nullable()
        table.datetime('authorized_start_at').nullable()
        table.integer('go_tick').nullable()
        table.datetime('go_at').nullable()
        table.datetime('submitted_at').nullable()
        table.decimal('elapsed_seconds', 10, 3).nullable()
        table.decimal('cutoff_seconds_snapshot', 10, 3).nullable()
        table.decimal('distance_meters', 10, 3).nullable()
        table.decimal('finish_time_seconds', 10, 3).nullable()
        table.decimal('average_speed', 10, 3).nullable()
        table.decimal('average_cadence', 10, 3).nullable()
        table.integer('valid_steps').unsigned().nullable()
        table.integer('invalid_repeated_presses').unsigned().nullable()
        table.string('status', 32).nullable()
        table.string('verification_status', 32).nullable()
        table.text('verification_reason').nullable()
        table.json('replay_meta').nullable()
        table.json('replay_payload').nullable()
      })
    }

    await prepareBaseTable(knex, 'games', [
      { column: 'tenant_id', relation: 'tenant' },
      { column: 'game_type_id', relation: 'game_type' },
    ])
    await prepareBaseTable(knex, 'tenant_game_types', [
      { column: 'tenant_id', relation: 'tenant' },
      { column: 'game_type_id', relation: 'game_type' },
    ])
    await prepareBaseTable(knex, 'game_participants', [
      { column: 'tenant_id', relation: 'tenant' },
      { column: 'game_id', relation: 'game' },
      { column: 'user_id', relation: 'user' },
    ])
    await prepareBaseTable(knex, 'game_activity_rules', [
      { column: 'game_id', relation: 'game' },
    ])
    await prepareBaseTable(knex, 'game_events', [
      { column: 'tenant_id', relation: 'tenant' },
      { column: 'game_id', relation: 'game' },
      { column: 'user_id', relation: 'user' },
    ])
    await prepareBaseTable(knex, 'game_ledgers', [
      { column: 'tenant_id', relation: 'tenant' },
      { column: 'game_id', relation: 'game' },
      { column: 'participant_id', relation: 'participant' },
      { column: 'user_id', relation: 'user' },
      { column: 'reference_event_id', relation: 'reference_event' },
    ])
    await prepareBaseTable(knex, 'game_admin_audits', [
      { column: 'tenant_id', relation: 'tenant' },
      { column: 'game_id', relation: 'game' },
      { column: 'actor_id', relation: 'actor' },
    ])
    await prepareBaseTable(knex, 'game_reset_challenges', [
      { column: 'tenant_id', relation: 'tenant' },
      { column: 'game_id', relation: 'game' },
      { column: 'actor_id', relation: 'actor' },
    ])
    await prepareBaseTable(knex, 'ghost_race_attempts', [
      { column: 'tenant_id', relation: 'tenant' },
      { column: 'game_id', relation: 'game' },
      { column: 'participant_id', relation: 'participant' },
      { column: 'user_id', relation: 'user' },
    ])

    await backfillColumnValueIfExists(knex, 'games', 'current_run_version', 1)
    await backfillColumnValueIfExists(knex, 'game_participants', 'run_version', 1)
    await backfillColumnValueIfExists(knex, 'game_participants', 'trial_xp', 0)
    await backfillColumnValueIfExists(knex, 'game_participants', 'official_xp', 0)
    await backfillColumnValueIfExists(knex, 'game_events', 'run_version', 1)
    await backfillColumnValueIfExists(knex, 'game_events', 'attempt_count', 0)
    await backfillColumnValueIfExists(knex, 'game_ledgers', 'run_version', 1)
    await backfillColumnValueIfExists(knex, 'game_events', 'phase', 'official')
    await backfillColumnValueIfExists(knex, 'game_ledgers', 'phase', 'official')
    await backfillColumnValueIfExists(knex, 'ghost_race_attempts', 'run_version', 1)
    await backfillColumnValueIfExists(knex, 'ghost_race_attempts', 'phase', 'official')
    await backfillColumnValueIfExists(knex, 'ghost_race_attempts', 'status', 'created')
    await backfillColumnValueIfExists(knex, 'ghost_race_attempts', 'verification_status', 'pending_verification')

    await removeDuplicateRows(knex, 'tenant_game_types', ['tenant_id', 'game_type_id'])
    await removeDuplicateRows(knex, 'games', ['tenant_id', 'code'])
    await removeDuplicateRows(knex, 'game_participants', ['game_id', 'user_id', 'run_version'])
    await removeDuplicateRows(knex, 'game_activity_rules', ['game_id', 'activity_code'])

    await createIndexIfColumnsExist(knex, 'game_types', 'game_types_code_uq', ['code'], true)
    await createIndexIfColumnsExist(knex, 'tenant_game_types', 'tenant_game_types_uq', ['tenant_id', 'game_type_id'], true)
    await createIndexIfColumnsExist(knex, 'games', 'games_tenant_code_uq', ['tenant_id', 'code'], true)
    await createIndexIfColumnsExist(knex, 'game_activity_rules', 'game_activity_rule_uq', ['game_id', 'activity_code'], true)

    await dropIndexIfExists(knex, 'game_participants', 'game_participants_uq', true)
    await dropIndexIfExists(knex, 'game_events', 'game_events_idempotency_uq', true)
    await dropIndexIfExists(knex, 'game_events', 'game_events_user_activity_idx')
    await dropIndexIfExists(knex, 'game_ledgers', 'game_ledger_event_uq', true)
    await dropIndexIfExists(knex, 'game_ledgers', 'game_ledger_participant_idx')
    await dropIndexIfExists(knex, 'game_participants', 'game_participants_game_status_idx')

    await createIndexIfColumnsExist(knex, 'games', 'games_tenant_status_starts_idx', ['tenant_id', 'admin_status', 'starts_at'])
    await createIndexIfColumnsExist(knex, 'games', 'games_tenant_type_idx', ['tenant_id', 'game_type_id'])
    await createIndexIfColumnsExist(knex, 'tenant_game_types', 'tenant_game_types_tenant_enabled_idx', ['tenant_id', 'is_enabled'])
    await createIndexIfColumnsExist(knex, 'game_participants', 'game_participants_run_uq', ['game_id', 'user_id', 'run_version'], true)
    await createIndexIfColumnsExist(knex, 'game_participants', 'game_participants_game_run_status_idx', ['game_id', 'run_version', 'status'])
    await createIndexIfColumnsExist(knex, 'game_events', 'game_events_run_phase_idempotency_uq', ['game_id', 'run_version', 'phase', 'event_hash'], true)
    await createIndexIfColumnsExist(knex, 'game_events', 'game_events_user_activity_run_idx', ['tenant_id', 'game_id', 'run_version', 'user_id', 'phase', 'activity_code', 'local_date_key'])
    await createIndexIfColumnsExist(knex, 'game_events', 'game_events_retry_idx', ['status', 'next_attempt_at', 'updated_at'])
    await createIndexIfColumnsExist(knex, 'game_ledgers', 'game_ledger_run_phase_event_uq', ['game_id', 'run_version', 'phase', 'activity_code', 'source_type', 'source_id'], true)
    await createIndexIfColumnsExist(knex, 'game_ledgers', 'game_ledger_run_participant_idx', ['tenant_id', 'game_id', 'run_version', 'user_id', 'recorded_at'])
    await createIndexIfColumnsExist(knex, 'game_ledgers', 'game_ledger_limit_scope_idx', ['game_id', 'run_version', 'phase', 'user_id', 'activity_code', 'local_date_key'])
    await createIndexIfColumnsExist(knex, 'game_admin_audits', 'game_admin_audits_game_action_idx', ['tenant_id', 'game_id', 'action_type', 'created_at'])
    await createIndexIfColumnsExist(knex, 'game_reset_challenges', 'game_reset_challenges_nonce_uq', ['nonce'], true)
    await createIndexIfColumnsExist(knex, 'game_reset_challenges', 'game_reset_challenges_scope_idx', ['tenant_id', 'game_id', 'actor_id', 'status', 'expires_at'])
    await createIndexIfColumnsExist(knex, 'ghost_race_attempts', 'ghost_race_attempts_token_uq', ['attempt_token'], true)
    await createIndexIfColumnsExist(knex, 'ghost_race_attempts', 'ghost_race_attempts_scope_idx', ['tenant_id', 'game_id', 'run_version', 'phase', 'user_id', 'status'])
    await createIndexIfColumnsExist(knex, 'ghost_race_attempts', 'ghost_race_attempts_pb_idx', ['tenant_id', 'game_id', 'run_version', 'user_id', 'verification_status', 'finish_time_seconds'])
  },

  async down(knex) {
    await dropIndexIfExists(knex, 'ghost_race_attempts', 'ghost_race_attempts_pb_idx')
    await dropIndexIfExists(knex, 'ghost_race_attempts', 'ghost_race_attempts_scope_idx')
    await dropIndexIfExists(knex, 'ghost_race_attempts', 'ghost_race_attempts_token_uq', true)
    await dropIndexIfExists(knex, 'game_reset_challenges', 'game_reset_challenges_scope_idx')
    await dropIndexIfExists(knex, 'game_reset_challenges', 'game_reset_challenges_nonce_uq', true)
    await dropIndexIfExists(knex, 'game_admin_audits', 'game_admin_audits_game_action_idx')
    await dropIndexIfExists(knex, 'game_ledgers', 'game_ledger_limit_scope_idx')
    await dropIndexIfExists(knex, 'game_events', 'game_events_retry_idx')
    await dropIndexIfExists(knex, 'game_ledgers', 'game_ledger_run_participant_idx')
    await dropIndexIfExists(knex, 'game_ledgers', 'game_ledger_run_phase_event_uq', true)
    await dropIndexIfExists(knex, 'game_events', 'game_events_user_activity_run_idx')
    await dropIndexIfExists(knex, 'game_events', 'game_events_run_phase_idempotency_uq', true)
    await dropIndexIfExists(knex, 'game_participants', 'game_participants_game_run_status_idx')
    await dropIndexIfExists(knex, 'game_participants', 'game_participants_run_uq', true)
    await dropIndexIfExists(knex, 'tenant_game_types', 'tenant_game_types_tenant_enabled_idx')
    await dropIndexIfExists(knex, 'games', 'games_tenant_type_idx')
    await dropIndexIfExists(knex, 'games', 'games_tenant_status_starts_idx')

    await dropIndexIfExists(knex, 'game_activity_rules', 'game_activity_rule_uq', true)
    await dropIndexIfExists(knex, 'games', 'games_tenant_code_uq', true)
    await dropIndexIfExists(knex, 'tenant_game_types', 'tenant_game_types_uq', true)
    await dropIndexIfExists(knex, 'game_types', 'game_types_code_uq', true)
  },
}
