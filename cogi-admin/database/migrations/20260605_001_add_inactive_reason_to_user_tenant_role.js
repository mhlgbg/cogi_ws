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
    if (!(await hasTable(knex, 'user_tenant_roles'))) return

    if (!(await hasColumn(knex, 'user_tenant_roles', 'inactive_reason'))) {
      await knex.schema.alterTable('user_tenant_roles', (table) => {
        table.string('inactive_reason').nullable()
      })
    }
  },

  async down(knex) {
    if (!(await hasTable(knex, 'user_tenant_roles'))) return

    if (await hasColumn(knex, 'user_tenant_roles', 'inactive_reason')) {
      await knex.schema.alterTable('user_tenant_roles', (table) => {
        table.dropColumn('inactive_reason')
      })
    }
  },
}