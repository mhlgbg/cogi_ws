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
    if (!(await hasTable(knex, 'strava_oauth_states'))) return
    if (await hasColumn(knex, 'strava_oauth_states', 'frontend_origin')) return

    await knex.schema.alterTable('strava_oauth_states', (table) => {
      table.string('frontend_origin')
    })
  },

  async down(knex) {
    if (!(await hasTable(knex, 'strava_oauth_states'))) return
    if (!(await hasColumn(knex, 'strava_oauth_states', 'frontend_origin'))) return

    await knex.schema.alterTable('strava_oauth_states', (table) => {
      table.dropColumn('frontend_origin')
    })
  },
}