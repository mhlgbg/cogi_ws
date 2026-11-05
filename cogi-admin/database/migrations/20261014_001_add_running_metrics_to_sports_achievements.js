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

module.exports = {
  async up(knex) {
    await addColumnIfMissing(knex, 'sports_achievements', 'distance_km', (table) => table.decimal('distance_km', 8, 3).nullable())
    await addColumnIfMissing(knex, 'sports_achievements', 'duration_seconds', (table) => table.integer('duration_seconds').nullable())

    await addColumnIfMissing(knex, 'sports_achievement_submissions', 'distance_km', (table) => table.decimal('distance_km', 8, 3).nullable())
    await addColumnIfMissing(knex, 'sports_achievement_submissions', 'duration_seconds', (table) => table.integer('duration_seconds').nullable())
  },

  async down(knex) {
    // Intentionally non-destructive: keep newly added columns to avoid data loss on rollback.
    void knex
  },
}
