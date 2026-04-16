async function hasColumn(knex, tableName, columnName) {
  try {
    return await knex.schema.hasColumn(tableName, columnName)
  } catch {
    return false
  }
}

async function relaxTenantColumn(knex, tableName) {
  if (!(await hasColumn(knex, tableName, 'tenant_id'))) return

  try {
    await knex.schema.alterTable(tableName, (table) => {
      table.integer('tenant_id').unsigned().nullable().alter()
    })
  } catch {
    // Leave the column as-is if the database cannot safely alter it.
  }
}

module.exports = {
  async up(knex) {
    await relaxTenantColumn(knex, 'authors')
    await relaxTenantColumn(knex, 'categories')
    await relaxTenantColumn(knex, 'articles')
  },

  async down() {
    // Intentionally empty. Re-introducing NOT NULL on shadow tenant columns can
    // break Strapi relation inserts when tenant storage uses *_tenant_lnk tables.
  },
}