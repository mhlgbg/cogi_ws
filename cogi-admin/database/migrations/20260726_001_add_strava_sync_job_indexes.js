async function hasTable(knex, tableName) {
  try {
    return await knex.schema.hasTable(tableName)
  } catch {
    return false
  }
}

async function getTableColumns(knex, tableName) {
  if (!(await hasTable(knex, tableName))) return new Set()

  try {
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

module.exports = {
  async up(knex) {
    await createIndexIfColumnsExist(knex, 'strava_sync_jobs', 'strava_sync_jobs_status_idx', ['status'])
    await createIndexIfColumnsExist(knex, 'strava_sync_jobs', 'strava_sync_jobs_phase_idx', ['phase'])
    await createIndexIfColumnsExist(knex, 'strava_sync_jobs', 'strava_sync_jobs_sync_mode_idx', ['sync_mode'])
    await createIndexIfColumnsExist(knex, 'strava_sync_jobs', 'strava_sync_jobs_heartbeat_at_idx', ['heartbeat_at'])
    await createIndexIfColumnsExist(knex, 'strava_sync_jobs', 'strava_sync_jobs_next_retry_at_idx', ['next_retry_at'])
    await createIndexIfColumnsExist(knex, 'strava_sync_jobs', 'strava_sync_jobs_claimed_at_idx', ['claimed_at'])
    await createIndexIfColumnsExist(knex, 'strava_sync_jobs', 'strava_sync_jobs_requested_at_idx', ['requested_at'])
    await createIndexIfColumnsExist(knex, 'strava_sync_jobs', 'strava_sync_jobs_completed_at_idx', ['completed_at'])
    await createIndexIfColumnsExist(knex, 'strava_sync_jobs', 'strava_sync_jobs_failed_at_idx', ['failed_at'])
    await createIndexIfColumnsExist(knex, 'strava_sync_jobs', 'strava_sync_jobs_status_phase_idx', ['status', 'phase'])
    await createIndexIfColumnsExist(knex, 'strava_sync_jobs', 'strava_sync_jobs_status_sync_mode_idx', ['status', 'sync_mode'])

    await createIndexIfColumnsExist(knex, 'strava_sync_jobs_tenant_lnk', 'strava_sync_jobs_tenant_lnk_tenant_id_idx', ['tenant_id'])
    await createIndexIfColumnsExist(knex, 'strava_sync_jobs_tenant_lnk', 'strava_sync_jobs_tenant_lnk_job_tenant_unique', ['strava_sync_job_id', 'tenant_id'], true)

    await createIndexIfColumnsExist(knex, 'strava_sync_jobs_user_lnk', 'strava_sync_jobs_user_lnk_user_id_idx', ['user_id'])
    await createIndexIfColumnsExist(knex, 'strava_sync_jobs_user_lnk', 'strava_sync_jobs_user_lnk_job_user_unique', ['strava_sync_job_id', 'user_id'], true)

    await createIndexIfColumnsExist(knex, 'strava_sync_jobs_connection_lnk', 'strava_sync_jobs_connection_lnk_connection_id_idx', ['strava_connection_id'])
    await createIndexIfColumnsExist(knex, 'strava_sync_jobs_connection_lnk', 'strava_sync_jobs_connection_lnk_job_connection_unique', ['strava_sync_job_id', 'strava_connection_id'], true)
  },

  async down(knex) {
    await dropIndexIfExists(knex, 'strava_sync_jobs_connection_lnk', 'strava_sync_jobs_connection_lnk_job_connection_unique', true)
    await dropIndexIfExists(knex, 'strava_sync_jobs_connection_lnk', 'strava_sync_jobs_connection_lnk_connection_id_idx')

    await dropIndexIfExists(knex, 'strava_sync_jobs_user_lnk', 'strava_sync_jobs_user_lnk_job_user_unique', true)
    await dropIndexIfExists(knex, 'strava_sync_jobs_user_lnk', 'strava_sync_jobs_user_lnk_user_id_idx')

    await dropIndexIfExists(knex, 'strava_sync_jobs_tenant_lnk', 'strava_sync_jobs_tenant_lnk_job_tenant_unique', true)
    await dropIndexIfExists(knex, 'strava_sync_jobs_tenant_lnk', 'strava_sync_jobs_tenant_lnk_tenant_id_idx')

    await dropIndexIfExists(knex, 'strava_sync_jobs', 'strava_sync_jobs_status_sync_mode_idx')
    await dropIndexIfExists(knex, 'strava_sync_jobs', 'strava_sync_jobs_status_phase_idx')
    await dropIndexIfExists(knex, 'strava_sync_jobs', 'strava_sync_jobs_failed_at_idx')
    await dropIndexIfExists(knex, 'strava_sync_jobs', 'strava_sync_jobs_completed_at_idx')
    await dropIndexIfExists(knex, 'strava_sync_jobs', 'strava_sync_jobs_requested_at_idx')
    await dropIndexIfExists(knex, 'strava_sync_jobs', 'strava_sync_jobs_claimed_at_idx')
    await dropIndexIfExists(knex, 'strava_sync_jobs', 'strava_sync_jobs_next_retry_at_idx')
    await dropIndexIfExists(knex, 'strava_sync_jobs', 'strava_sync_jobs_heartbeat_at_idx')
    await dropIndexIfExists(knex, 'strava_sync_jobs', 'strava_sync_jobs_sync_mode_idx')
    await dropIndexIfExists(knex, 'strava_sync_jobs', 'strava_sync_jobs_phase_idx')
    await dropIndexIfExists(knex, 'strava_sync_jobs', 'strava_sync_jobs_status_idx')
  },
}