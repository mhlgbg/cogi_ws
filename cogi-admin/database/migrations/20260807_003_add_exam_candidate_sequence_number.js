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
    if (!(await hasTable(knex, 'exam_candidates'))) return

    if (!(await hasColumn(knex, 'exam_candidates', 'sequence_number'))) {
      await knex.schema.alterTable('exam_candidates', (table) => {
        table.integer('sequence_number').nullable()
      })
    }
  },

  async down(knex) {
    if (!(await hasTable(knex, 'exam_candidates'))) return

    if (await hasColumn(knex, 'exam_candidates', 'sequence_number')) {
      await knex.schema.alterTable('exam_candidates', (table) => {
        table.dropColumn('sequence_number')
      })
    }
  },
}
