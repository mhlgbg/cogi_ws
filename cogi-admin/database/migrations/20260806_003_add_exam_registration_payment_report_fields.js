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
    if (!(await hasTable(knex, 'exam_registrations'))) return

    if (!(await hasColumn(knex, 'exam_registrations', 'payment_report_note'))) {
      await knex.schema.alterTable('exam_registrations', (table) => {
        table.text('payment_report_note').nullable()
      })
    }

    if (!(await hasColumn(knex, 'exam_registrations', 'payment_transfer_at'))) {
      await knex.schema.alterTable('exam_registrations', (table) => {
        table.datetime('payment_transfer_at').nullable()
      })
    }

    if (!(await hasColumn(knex, 'exam_registrations', 'payment_sender_name'))) {
      await knex.schema.alterTable('exam_registrations', (table) => {
        table.string('payment_sender_name', 200).nullable()
      })
    }

    if (!(await hasColumn(knex, 'exam_registrations', 'payment_sender_account'))) {
      await knex.schema.alterTable('exam_registrations', (table) => {
        table.string('payment_sender_account', 100).nullable()
      })
    }

    if (!(await hasColumn(knex, 'exam_registrations', 'payment_sender_bank'))) {
      await knex.schema.alterTable('exam_registrations', (table) => {
        table.string('payment_sender_bank', 150).nullable()
      })
    }

    if (!(await hasColumn(knex, 'exam_registrations', 'payment_transaction_reference'))) {
      await knex.schema.alterTable('exam_registrations', (table) => {
        table.string('payment_transaction_reference', 100).nullable()
      })
    }

    if (!(await hasColumn(knex, 'exam_registrations', 'payment_report_updated_at'))) {
      await knex.schema.alterTable('exam_registrations', (table) => {
        table.datetime('payment_report_updated_at').nullable()
      })
    }
  },

  async down(knex) {
    if (!(await hasTable(knex, 'exam_registrations'))) return

    for (const columnName of [
      'payment_report_updated_at',
      'payment_transaction_reference',
      'payment_sender_bank',
      'payment_sender_account',
      'payment_sender_name',
      'payment_transfer_at',
      'payment_report_note',
    ]) {
      if (await hasColumn(knex, 'exam_registrations', columnName)) {
        await knex.schema.alterTable('exam_registrations', (table) => {
          table.dropColumn(columnName)
        })
      }
    }
  },
}