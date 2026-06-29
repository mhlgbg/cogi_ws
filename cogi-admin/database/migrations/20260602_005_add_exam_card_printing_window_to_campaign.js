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
    if (!(await hasTable(knex, 'campaigns'))) return

    await knex.schema.alterTable('campaigns', (table) => {
      if (!table) return
    })

    if (!(await hasColumn(knex, 'campaigns', 'allow_exam_card_printing'))) {
      await knex.schema.alterTable('campaigns', (table) => {
        table.boolean('allow_exam_card_printing').notNullable().defaultTo(false)
      })
    }

    if (!(await hasColumn(knex, 'campaigns', 'exam_card_print_start_at'))) {
      await knex.schema.alterTable('campaigns', (table) => {
        table.datetime('exam_card_print_start_at', { useTz: true }).nullable()
      })
    }

    if (!(await hasColumn(knex, 'campaigns', 'exam_card_print_end_at'))) {
      await knex.schema.alterTable('campaigns', (table) => {
        table.datetime('exam_card_print_end_at', { useTz: true }).nullable()
      })
    }
  },

  async down(knex) {
    if (!(await hasTable(knex, 'campaigns'))) return

    if (await hasColumn(knex, 'campaigns', 'exam_card_print_end_at')) {
      await knex.schema.alterTable('campaigns', (table) => {
        table.dropColumn('exam_card_print_end_at')
      })
    }

    if (await hasColumn(knex, 'campaigns', 'exam_card_print_start_at')) {
      await knex.schema.alterTable('campaigns', (table) => {
        table.dropColumn('exam_card_print_start_at')
      })
    }

    if (await hasColumn(knex, 'campaigns', 'allow_exam_card_printing')) {
      await knex.schema.alterTable('campaigns', (table) => {
        table.dropColumn('allow_exam_card_printing')
      })
    }
  },
}