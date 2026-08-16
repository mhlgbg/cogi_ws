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

    if (!(await hasColumn(knex, 'exam_registrations', 'payment_confirmation_note'))) {
      await knex.schema.alterTable('exam_registrations', (table) => {
        table.text('payment_confirmation_note').nullable()
      })
    }

    if (!(await hasColumn(knex, 'exam_registrations', 'payment_rejected_at'))) {
      await knex.schema.alterTable('exam_registrations', (table) => {
        table.datetime('payment_rejected_at').nullable()
      })
    }

    if (!(await hasColumn(knex, 'exam_registrations', 'payment_rejection_reason'))) {
      await knex.schema.alterTable('exam_registrations', (table) => {
        table.text('payment_rejection_reason').nullable()
      })
    }
  },

  async down(knex) {
    if (!(await hasTable(knex, 'exam_registrations'))) return

    for (const columnName of ['payment_rejection_reason', 'payment_rejected_at', 'payment_confirmation_note']) {
      if (await hasColumn(knex, 'exam_registrations', columnName)) {
        await knex.schema.alterTable('exam_registrations', (table) => {
          table.dropColumn(columnName)
        })
      }
    }
  },
}