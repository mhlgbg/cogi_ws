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

    if (!(await hasColumn(knex, 'exam_registrations', 'returned_at'))) {
      await knex.schema.alterTable('exam_registrations', (table) => {
        table.datetime('returned_at').nullable()
      })
    }

    if (!(await hasColumn(knex, 'exam_registrations', 'returned_by_id'))) {
      await knex.schema.alterTable('exam_registrations', (table) => {
        table.bigInteger('returned_by_id').nullable()
      })
    }

    if (!(await hasColumn(knex, 'exam_registrations', 'return_reason'))) {
      await knex.schema.alterTable('exam_registrations', (table) => {
        table.text('return_reason').nullable()
      })
    }

    if (!(await hasColumn(knex, 'exam_registrations', 'review_history'))) {
      await knex.schema.alterTable('exam_registrations', (table) => {
        table.jsonb('review_history').nullable()
      })
    }
  },

  async down(knex) {
    if (!(await hasTable(knex, 'exam_registrations'))) return

    for (const columnName of ['review_history', 'return_reason', 'returned_by_id', 'returned_at']) {
      if (await hasColumn(knex, 'exam_registrations', columnName)) {
        await knex.schema.alterTable('exam_registrations', (table) => {
          table.dropColumn(columnName)
        })
      }
    }
  },
}
