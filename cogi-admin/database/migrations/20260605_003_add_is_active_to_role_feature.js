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
    if (!(await hasTable(knex, 'role_features'))) return

    if (!(await hasColumn(knex, 'role_features', 'is_active'))) {
      await knex.schema.alterTable('role_features', (table) => {
        table.boolean('is_active').notNullable().defaultTo(true)
      })
    }
  },

  async down(knex) {
    if (!(await hasTable(knex, 'role_features'))) return

    if (await hasColumn(knex, 'role_features', 'is_active')) {
      await knex.schema.alterTable('role_features', (table) => {
        table.dropColumn('is_active')
      })
    }
  },
}