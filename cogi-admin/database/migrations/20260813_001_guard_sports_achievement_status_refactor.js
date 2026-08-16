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

async function countStatuses(knex, tableName, statuses) {
  if (!(await hasTable(knex, tableName))) return []
  if (!(await hasColumn(knex, tableName, 'status'))) return []
  const rows = await knex(tableName).select('status').count('* as count').whereIn('status', statuses).groupBy('status')
  return (rows || []).map((row) => ({ status: String(row.status || '').trim(), count: Number(row.count || 0) }))
}

async function addColumnIfMissing(knex, tableName, columnName, callback) {
  if (!(await hasTable(knex, tableName))) return
  if (await hasColumn(knex, tableName, columnName)) return
  await knex.schema.alterTable(tableName, (table) => {
    callback(table)
  })
}

module.exports = {
  async up(knex) {
    if (!(await hasTable(knex, 'sports_achievements'))) return
    if (!(await hasColumn(knex, 'sports_achievements', 'status'))) return

    await addColumnIfMissing(knex, 'sports_achievements', 'revoked_at', (table) => table.datetime('revoked_at').nullable())
    await addColumnIfMissing(knex, 'sports_achievements', 'revoke_reason', (table) => table.text('revoke_reason').nullable())

    await knex('sports_achievements').where({ status: 'verified' }).update({ status: 'active' })

    const invalidRows = await countStatuses(knex, 'sports_achievements', ['pending', 'rejected'])
    if (invalidRows.length > 0) {
      const summary = invalidRows.map((row) => `${row.status}:${row.count}`).join(', ')
      throw new Error(`[sports-achievement migration] Found legacy statuses that require explicit backfill before completing refactor: ${summary}`)
    }
  },

  async down(knex) {
    if (!(await hasTable(knex, 'sports_achievements'))) return
    if (!(await hasColumn(knex, 'sports_achievements', 'status'))) return
    await knex('sports_achievements').where({ status: 'active' }).update({ status: 'verified' })
  },
}
