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
    if (!(await hasTable(knex, 'tenants'))) return

    if (!(await hasColumn(knex, 'tenants', 'storage_default_config_id'))) {
      await knex.schema.alterTable('tenants', (table) => {
        table.integer('storage_default_config_id').unsigned().nullable()
      })
    }

    try {
      await knex.schema.alterTable('tenants', (table) => {
        table.index(['storage_default_config_id'], 'tenants_storage_default_config_id_idx')
      })
    } catch {
      // ignore duplicate index attempts
    }
  },

  async down(knex) {
    if (!(await hasTable(knex, 'tenants'))) return

    try {
      await knex.schema.alterTable('tenants', (table) => {
        table.dropIndex([], 'tenants_storage_default_config_id_idx')
      })
    } catch {
      try {
        await knex.raw('drop index if exists tenants_storage_default_config_id_idx')
      } catch {
        // ignore if the index is already absent
      }
    }

    if (await hasColumn(knex, 'tenants', 'storage_default_config_id')) {
      await knex.schema.alterTable('tenants', (table) => {
        table.dropColumn('storage_default_config_id')
      })
    }
  },
}