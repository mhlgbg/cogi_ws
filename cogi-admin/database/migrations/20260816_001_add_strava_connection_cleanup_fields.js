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

async function addColumnIfMissing(knex, tableName, columnName, callback) {
  if (!(await hasTable(knex, tableName))) return
  if (await hasColumn(knex, tableName, columnName)) return
  await knex.schema.alterTable(tableName, (table) => {
    callback(table)
  })
}

async function dropColumnIfExists(knex, tableName, columnName) {
  if (!(await hasTable(knex, tableName))) return
  if (!(await hasColumn(knex, tableName, columnName))) return
  await knex.schema.alterTable(tableName, (table) => {
    table.dropColumn(columnName)
  })
}

module.exports = {
  async up(knex) {
    if (await hasTable(knex, 'strava_connections')) {
      await addColumnIfMissing(knex, 'strava_connections', 'cleanup_status', (table) => {
        table.string('cleanup_status', 32).notNullable().defaultTo('NOT_REQUIRED')
      })
      await addColumnIfMissing(knex, 'strava_connections', 'cleanup_requested_at', (table) => {
        table.datetime('cleanup_requested_at').nullable()
      })
      await addColumnIfMissing(knex, 'strava_connections', 'cleanup_completed_at', (table) => {
        table.datetime('cleanup_completed_at').nullable()
      })
      await addColumnIfMissing(knex, 'strava_connections', 'cleanup_error', (table) => {
        table.text('cleanup_error').nullable()
      })
      await addColumnIfMissing(knex, 'strava_connections', 'termination_reason', (table) => {
        table.string('termination_reason', 120).nullable()
      })

      if (await hasColumn(knex, 'strava_connections', 'cleanup_status')) {
        await knex('strava_connections')
          .whereNull('cleanup_status')
          .update({ cleanup_status: 'NOT_REQUIRED' })
      }

      if (await hasColumn(knex, 'strava_connections', 'strava_athlete_id')) {
        await knex.raw('alter table strava_connections alter column strava_athlete_id drop not null')
      }
    }

    if (await hasTable(knex, 'strava_webhook_events') && await hasColumn(knex, 'strava_webhook_events', 'raw_payload')) {
      await knex.raw('alter table strava_webhook_events alter column raw_payload drop not null')
    }
  },

  async down(knex) {
    await dropColumnIfExists(knex, 'strava_connections', 'termination_reason')
    await dropColumnIfExists(knex, 'strava_connections', 'cleanup_error')
    await dropColumnIfExists(knex, 'strava_connections', 'cleanup_completed_at')
    await dropColumnIfExists(knex, 'strava_connections', 'cleanup_requested_at')
    await dropColumnIfExists(knex, 'strava_connections', 'cleanup_status')
  },
}