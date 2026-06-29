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
    await createIndexIfColumnsExist(knex, 'strava_oauth_states', 'strava_oauth_states_tenant_id_idx', ['tenant_id'])
    await createIndexIfColumnsExist(knex, 'strava_oauth_states', 'strava_oauth_states_user_id_idx', ['user_id'])
    await createIndexIfColumnsExist(knex, 'strava_oauth_states', 'strava_oauth_states_expires_at_idx', ['expires_at'])
    await createIndexIfColumnsExist(knex, 'strava_oauth_states', 'strava_oauth_states_used_at_idx', ['used_at'])
    await createIndexIfColumnsExist(knex, 'strava_oauth_states', 'strava_oauth_states_tenant_user_nonce_idx', ['tenant_id', 'user_id', 'nonce'])
  },

  async down(knex) {
    await dropIndexIfExists(knex, 'strava_oauth_states', 'strava_oauth_states_tenant_user_nonce_idx')
    await dropIndexIfExists(knex, 'strava_oauth_states', 'strava_oauth_states_used_at_idx')
    await dropIndexIfExists(knex, 'strava_oauth_states', 'strava_oauth_states_expires_at_idx')
    await dropIndexIfExists(knex, 'strava_oauth_states', 'strava_oauth_states_user_id_idx')
    await dropIndexIfExists(knex, 'strava_oauth_states', 'strava_oauth_states_tenant_id_idx')
  },
}