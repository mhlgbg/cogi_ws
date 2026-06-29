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

    // Check which columns already exist
    const hasMath = await hasColumn(knex, 'candidate_exams', 'recheck_math')
    const hasVn = await hasColumn(knex, 'candidate_exams', 'recheck_vietnamese')
    const hasEn = await hasColumn(knex, 'candidate_exams', 'recheck_english')
    const hasMathScore = await hasColumn(knex, 'candidate_exams', 'recheck_math_score')
    const hasVnScore = await hasColumn(knex, 'candidate_exams', 'recheck_vietnamese_score')
    const hasEnScore = await hasColumn(knex, 'candidate_exams', 'recheck_english_score')

    // Add columns that don't exist
    await knex.schema.alterTable('candidate_exams', (table) => {
      if (!hasMath) table.boolean('recheck_math').notNullable().defaultTo(false)
      if (!hasVn) table.boolean('recheck_vietnamese').notNullable().defaultTo(false)
      if (!hasEn) table.boolean('recheck_english').notNullable().defaultTo(false)
      if (!hasMathScore) table.decimal('recheck_math_score', 8, 2).nullable()
      if (!hasVnScore) table.decimal('recheck_vietnamese_score', 8, 2).nullable()
      if (!hasEnScore) table.decimal('recheck_english_score', 8, 2).nullable()
    })
  },

  async down(knex) {
    if (!(await hasTable(knex, 'candidate_exams'))) return

    const hasMath = await hasColumn(knex, 'candidate_exams', 'recheck_math')
    const hasVn = await hasColumn(knex, 'candidate_exams', 'recheck_vietnamese')
    const hasEn = await hasColumn(knex, 'candidate_exams', 'recheck_english')
    const hasMathScore = await hasColumn(knex, 'candidate_exams', 'recheck_math_score')
    const hasVnScore = await hasColumn(knex, 'candidate_exams', 'recheck_vietnamese_score')
    const hasEnScore = await hasColumn(knex, 'candidate_exams', 'recheck_english_score')

    if (!hasMath && !hasVn && !hasEn && !hasMathScore && !hasVnScore && !hasEnScore) return

    await knex.schema.alterTable('candidate_exams', (table) => {
      if (hasMath) table.dropColumn('recheck_math')
      if (hasVn) table.dropColumn('recheck_vietnamese')
      if (hasEn) table.dropColumn('recheck_english')
      if (hasMathScore) table.dropColumn('recheck_math_score')
      if (hasVnScore) table.dropColumn('recheck_vietnamese_score')
      if (hasEnScore) table.dropColumn('recheck_english_score')
    })
  },
}
