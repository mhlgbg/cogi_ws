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
    await createIndexIfColumnsExist(knex, 'strava_connections', 'strava_connections_tenant_id_idx', ['tenant_id'])
    await createIndexIfColumnsExist(knex, 'strava_connections', 'strava_connections_user_id_idx', ['user_id'])
    await createIndexIfColumnsExist(knex, 'strava_connections', 'strava_connections_tenant_user_unique', ['tenant_id', 'user_id'], true)
    await createIndexIfColumnsExist(knex, 'strava_connections', 'strava_connections_tenant_athlete_unique', ['tenant_id', 'strava_athlete_id'], true)

    await createIndexIfColumnsExist(knex, 'strava_activities', 'strava_activities_tenant_id_idx', ['tenant_id'])
    await createIndexIfColumnsExist(knex, 'strava_activities', 'strava_activities_user_id_idx', ['user_id'])
    await createIndexIfColumnsExist(knex, 'strava_activities', 'strava_activities_connection_id_idx', ['connection_id'])
    await createIndexIfColumnsExist(knex, 'strava_activities', 'strava_activities_tenant_activity_unique', ['tenant_id', 'strava_activity_id'], true)
    await createIndexIfColumnsExist(knex, 'strava_activities', 'strava_activities_tenant_user_start_local_idx', ['tenant_id', 'user_id', 'start_date_local'])
    await createIndexIfColumnsExist(knex, 'strava_activities', 'strava_activities_tenant_sport_start_local_idx', ['tenant_id', 'sport_type', 'start_date_local'])

    await createIndexIfColumnsExist(knex, 'fitness_challenges', 'fitness_challenges_tenant_id_idx', ['tenant_id'])
    await createIndexIfColumnsExist(knex, 'fitness_challenges', 'fitness_challenges_created_by_id_idx', ['created_by_id'])
    await createIndexIfColumnsExist(knex, 'fitness_challenges', 'fitness_challenges_tenant_code_unique', ['tenant_id', 'code'], true)
    await createIndexIfColumnsExist(knex, 'fitness_challenges', 'fitness_challenges_tenant_status_start_at_idx', ['tenant_id', 'status', 'start_at'])
    await createIndexIfColumnsExist(knex, 'fitness_challenges', 'fitness_challenges_tenant_status_end_at_idx', ['tenant_id', 'status', 'end_at'])
    await createIndexIfColumnsExist(knex, 'fitness_challenges', 'fitness_challenges_tenant_slug_idx', ['tenant_id', 'slug'])

    await createIndexIfColumnsExist(knex, 'challenge_participants', 'challenge_participants_tenant_id_idx', ['tenant_id'])
    await createIndexIfColumnsExist(knex, 'challenge_participants', 'challenge_participants_challenge_id_idx', ['challenge_id'])
    await createIndexIfColumnsExist(knex, 'challenge_participants', 'challenge_participants_user_id_idx', ['user_id'])
    await createIndexIfColumnsExist(knex, 'challenge_participants', 'challenge_participants_tenant_challenge_user_unique', ['tenant_id', 'challenge_id', 'user_id'], true)
    await createIndexIfColumnsExist(knex, 'challenge_participants', 'challenge_participants_tenant_challenge_status_idx', ['tenant_id', 'challenge_id', 'status'])
    await createIndexIfColumnsExist(knex, 'challenge_participants', 'challenge_participants_tenant_challenge_rank_idx', ['tenant_id', 'challenge_id', 'rank'])

    await createIndexIfColumnsExist(knex, 'challenge_activities', 'challenge_activities_tenant_id_idx', ['tenant_id'])
    await createIndexIfColumnsExist(knex, 'challenge_activities', 'challenge_activities_challenge_id_idx', ['challenge_id'])
    await createIndexIfColumnsExist(knex, 'challenge_activities', 'challenge_activities_participant_id_idx', ['participant_id'])
    await createIndexIfColumnsExist(knex, 'challenge_activities', 'challenge_activities_user_id_idx', ['user_id'])
    await createIndexIfColumnsExist(knex, 'challenge_activities', 'challenge_activities_activity_id_idx', ['activity_id'])
    await createIndexIfColumnsExist(knex, 'challenge_activities', 'challenge_activities_tenant_challenge_activity_unique', ['tenant_id', 'challenge_id', 'activity_id'], true)
    await createIndexIfColumnsExist(knex, 'challenge_activities', 'challenge_activities_tenant_challenge_status_idx', ['tenant_id', 'challenge_id', 'status'])
    await createIndexIfColumnsExist(knex, 'challenge_activities', 'challenge_activities_tenant_user_status_idx', ['tenant_id', 'user_id', 'status'])
  },

  async down(knex) {
    await dropIndexIfExists(knex, 'challenge_activities', 'challenge_activities_tenant_user_status_idx')
    await dropIndexIfExists(knex, 'challenge_activities', 'challenge_activities_tenant_challenge_status_idx')
    await dropIndexIfExists(knex, 'challenge_activities', 'challenge_activities_tenant_challenge_activity_unique', true)
    await dropIndexIfExists(knex, 'challenge_activities', 'challenge_activities_activity_id_idx')
    await dropIndexIfExists(knex, 'challenge_activities', 'challenge_activities_user_id_idx')
    await dropIndexIfExists(knex, 'challenge_activities', 'challenge_activities_participant_id_idx')
    await dropIndexIfExists(knex, 'challenge_activities', 'challenge_activities_challenge_id_idx')
    await dropIndexIfExists(knex, 'challenge_activities', 'challenge_activities_tenant_id_idx')

    await dropIndexIfExists(knex, 'challenge_participants', 'challenge_participants_tenant_challenge_rank_idx')
    await dropIndexIfExists(knex, 'challenge_participants', 'challenge_participants_tenant_challenge_status_idx')
    await dropIndexIfExists(knex, 'challenge_participants', 'challenge_participants_tenant_challenge_user_unique', true)
    await dropIndexIfExists(knex, 'challenge_participants', 'challenge_participants_user_id_idx')
    await dropIndexIfExists(knex, 'challenge_participants', 'challenge_participants_challenge_id_idx')
    await dropIndexIfExists(knex, 'challenge_participants', 'challenge_participants_tenant_id_idx')

    await dropIndexIfExists(knex, 'fitness_challenges', 'fitness_challenges_tenant_slug_idx')
    await dropIndexIfExists(knex, 'fitness_challenges', 'fitness_challenges_tenant_status_end_at_idx')
    await dropIndexIfExists(knex, 'fitness_challenges', 'fitness_challenges_tenant_status_start_at_idx')
    await dropIndexIfExists(knex, 'fitness_challenges', 'fitness_challenges_tenant_code_unique', true)
    await dropIndexIfExists(knex, 'fitness_challenges', 'fitness_challenges_created_by_id_idx')
    await dropIndexIfExists(knex, 'fitness_challenges', 'fitness_challenges_tenant_id_idx')

    await dropIndexIfExists(knex, 'strava_activities', 'strava_activities_tenant_sport_start_local_idx')
    await dropIndexIfExists(knex, 'strava_activities', 'strava_activities_tenant_user_start_local_idx')
    await dropIndexIfExists(knex, 'strava_activities', 'strava_activities_tenant_activity_unique', true)
    await dropIndexIfExists(knex, 'strava_activities', 'strava_activities_connection_id_idx')
    await dropIndexIfExists(knex, 'strava_activities', 'strava_activities_user_id_idx')
    await dropIndexIfExists(knex, 'strava_activities', 'strava_activities_tenant_id_idx')

    await dropIndexIfExists(knex, 'strava_connections', 'strava_connections_tenant_athlete_unique', true)
    await dropIndexIfExists(knex, 'strava_connections', 'strava_connections_tenant_user_unique', true)
    await dropIndexIfExists(knex, 'strava_connections', 'strava_connections_user_id_idx')
    await dropIndexIfExists(knex, 'strava_connections', 'strava_connections_tenant_id_idx')
  },
}