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

    if (!(await hasColumn(knex, 'campaigns', 'exam_card_template_html'))) {
      await knex.schema.alterTable('campaigns', (table) => {
        table.text('exam_card_template_html').nullable()
      })
    }
  },

  async down(knex) {
    if (!(await hasTable(knex, 'campaigns'))) return
    if (!(await hasColumn(knex, 'campaigns', 'exam_card_template_html'))) return

    await knex.schema.alterTable('campaigns', (table) => {
      table.dropColumn('exam_card_template_html')
    })
  },
}
