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
    if (!(await hasTable(knex, 'candidate_exams'))) return

    if (!(await hasColumn(knex, 'candidate_exams', 'incentive_score'))) {
      await knex.schema.alterTable('candidate_exams', (table) => {
        table.decimal('incentive_score', 10, 2).notNullable().defaultTo(0)
      })
    }

    await knex('candidate_exams').whereNull('incentive_score').update({ incentive_score: 0 })
  },

  async down(knex) {
    if (!(await hasTable(knex, 'candidate_exams'))) return
    if (!(await hasColumn(knex, 'candidate_exams', 'incentive_score'))) return

    await knex.schema.alterTable('candidate_exams', (table) => {
      table.dropColumn('incentive_score')
    })
  },
}