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
    if (!(await hasTable(knex, 'mail_logs'))) return

    if (!(await hasColumn(knex, 'mail_logs', 'provider'))) {
      await knex.schema.alterTable('mail_logs', (table) => {
        table.string('provider').nullable()
      })
    }

    if (!(await hasColumn(knex, 'mail_logs', 'fallback_provider'))) {
      await knex.schema.alterTable('mail_logs', (table) => {
        table.string('fallback_provider').nullable()
      })
    }

    if (!(await hasColumn(knex, 'mail_logs', 'provider_message_id'))) {
      await knex.schema.alterTable('mail_logs', (table) => {
        table.string('provider_message_id').nullable()
      })
    }

    if (!(await hasColumn(knex, 'mail_logs', 'last_provider_error'))) {
      await knex.schema.alterTable('mail_logs', (table) => {
        table.text('last_provider_error').nullable()
      })
    }

    if (!(await hasColumn(knex, 'mail_logs', 'fallback_error'))) {
      await knex.schema.alterTable('mail_logs', (table) => {
        table.text('fallback_error').nullable()
      })
    }
  },

  async down(knex) {
    if (!(await hasTable(knex, 'mail_logs'))) return

    if (await hasColumn(knex, 'mail_logs', 'fallback_error')) {
      await knex.schema.alterTable('mail_logs', (table) => {
        table.dropColumn('fallback_error')
      })
    }

    if (await hasColumn(knex, 'mail_logs', 'last_provider_error')) {
      await knex.schema.alterTable('mail_logs', (table) => {
        table.dropColumn('last_provider_error')
      })
    }

    if (await hasColumn(knex, 'mail_logs', 'provider_message_id')) {
      await knex.schema.alterTable('mail_logs', (table) => {
        table.dropColumn('provider_message_id')
      })
    }

    if (await hasColumn(knex, 'mail_logs', 'fallback_provider')) {
      await knex.schema.alterTable('mail_logs', (table) => {
        table.dropColumn('fallback_provider')
      })
    }
  },
}