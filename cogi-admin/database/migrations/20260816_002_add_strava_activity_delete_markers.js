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

module.exports = {
  async up(knex) {
    if (!(await hasTable(knex, 'strava_connections'))) return
    if (!(await hasColumn(knex, 'strava_connections', 'activity_delete_markers'))) {
      await knex.schema.alterTable('strava_connections', (table) => {
        table.jsonb('activity_delete_markers').nullable()
      })
    }
  },

  async down(knex) {
    if (!(await hasTable(knex, 'strava_connections'))) return
    if (!(await hasColumn(knex, 'strava_connections', 'activity_delete_markers'))) return
    await knex.schema.alterTable('strava_connections', (table) => {
      table.dropColumn('activity_delete_markers')
    })
  },
}