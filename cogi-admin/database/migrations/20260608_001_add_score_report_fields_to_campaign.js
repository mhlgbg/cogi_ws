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

    if (!(await hasColumn(knex, 'campaigns', 'score_report_template_html'))) {
      await knex.schema.alterTable('campaigns', (table) => {
        table.text('score_report_template_html').nullable()
      })
    }

    if (!(await hasColumn(knex, 'campaigns', 'score_published_at'))) {
      await knex.schema.alterTable('campaigns', (table) => {
        table.datetime('score_published_at', { useTz: true }).nullable()
      })
    }
  },

  async down(knex) {
    if (!(await hasTable(knex, 'campaigns'))) return

    if (await hasColumn(knex, 'campaigns', 'score_published_at')) {
      await knex.schema.alterTable('campaigns', (table) => {
        table.dropColumn('score_published_at')
      })
    }

    if (await hasColumn(knex, 'campaigns', 'score_report_template_html')) {
      await knex.schema.alterTable('campaigns', (table) => {
        table.dropColumn('score_report_template_html')
      })
    }
  },
}