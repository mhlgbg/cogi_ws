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

function joinParts(values) {
  return values
    .map((value) => String(value || '').trim())
    .filter(Boolean)
    .join(' ') || null
}

module.exports = {
  async up(knex) {
    if (!(await hasTable(knex, 'candidate_exams'))) return
    if (!(await hasColumn(knex, 'candidate_exams', 'last_name'))) return
    if (!(await hasColumn(knex, 'candidate_exams', 'middle_name'))) return

    const rows = await knex('candidate_exams').select(['id', 'last_name', 'middle_name'])
    for (const row of rows) {
      const mergedLastName = joinParts([row.last_name, row.middle_name])
      await knex('candidate_exams')
        .where({ id: row.id })
        .update({
          last_name: mergedLastName,
          middle_name: null,
        })
    }
  },

  async down(knex) {
    if (!(await hasTable(knex, 'candidate_exams'))) return
    if (!(await hasColumn(knex, 'candidate_exams', 'last_name'))) return
    if (!(await hasColumn(knex, 'candidate_exams', 'middle_name'))) return

    const rows = await knex('candidate_exams').select(['id', 'last_name', 'middle_name', 'first_name'])
    for (const row of rows) {
      const normalizedLastName = String(row.last_name || '').trim()
      if (!normalizedLastName) continue

      const parts = normalizedLastName.split(/\s+/)
      await knex('candidate_exams')
        .where({ id: row.id })
        .update({
          last_name: parts[0] || null,
          middle_name: parts.length > 1 ? parts.slice(1).join(' ') : null,
        })
    }
  },
}
