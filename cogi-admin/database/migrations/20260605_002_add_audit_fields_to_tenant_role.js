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

async function addColumnIfMissing(knex, tableName, columnName, applyColumn) {
  if (await hasColumn(knex, tableName, columnName)) return

  await knex.schema.alterTable(tableName, (table) => {
    applyColumn(table)
  })
}

module.exports = {
  async up(knex) {
    if (!(await hasTable(knex, 'tenant_roles'))) return

    await addColumnIfMissing(knex, 'tenant_roles', 'activated_at', (table) => {
      table.datetime('activated_at').nullable()
    })

    await addColumnIfMissing(knex, 'tenant_roles', 'activated_by_id', (table) => {
      table.integer('activated_by_id').unsigned().nullable()
    })

    await addColumnIfMissing(knex, 'tenant_roles', 'deactivated_at', (table) => {
      table.datetime('deactivated_at').nullable()
    })

    await addColumnIfMissing(knex, 'tenant_roles', 'deactivated_by_id', (table) => {
      table.integer('deactivated_by_id').unsigned().nullable()
    })

    await addColumnIfMissing(knex, 'tenant_roles', 'inactive_reason', (table) => {
      table.string('inactive_reason').nullable()
    })
  },

  async down(knex) {
    if (!(await hasTable(knex, 'tenant_roles'))) return

    if (await hasColumn(knex, 'tenant_roles', 'inactive_reason')) {
      await knex.schema.alterTable('tenant_roles', (table) => {
        table.dropColumn('inactive_reason')
      })
    }

    if (await hasColumn(knex, 'tenant_roles', 'deactivated_by_id')) {
      await knex.schema.alterTable('tenant_roles', (table) => {
        table.dropColumn('deactivated_by_id')
      })
    }

    if (await hasColumn(knex, 'tenant_roles', 'deactivated_at')) {
      await knex.schema.alterTable('tenant_roles', (table) => {
        table.dropColumn('deactivated_at')
      })
    }

    if (await hasColumn(knex, 'tenant_roles', 'activated_by_id')) {
      await knex.schema.alterTable('tenant_roles', (table) => {
        table.dropColumn('activated_by_id')
      })
    }

    if (await hasColumn(knex, 'tenant_roles', 'activated_at')) {
      await knex.schema.alterTable('tenant_roles', (table) => {
        table.dropColumn('activated_at')
      })
    }
  },
}