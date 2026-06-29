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

    const hasQueuedAt = await hasColumn(knex, 'candidate_exams', 'card_reminder_queued_at')
    const hasSentAt = await hasColumn(knex, 'candidate_exams', 'card_reminder_sent_at')
    const hasCount = await hasColumn(knex, 'candidate_exams', 'card_reminder_count')
    const hasStatus = await hasColumn(knex, 'candidate_exams', 'card_reminder_status')

    if (!hasQueuedAt || !hasSentAt || !hasCount || !hasStatus) {
      await knex.schema.alterTable('candidate_exams', (table) => {
        if (!hasQueuedAt) table.datetime('card_reminder_queued_at').nullable()
        if (!hasSentAt) table.datetime('card_reminder_sent_at').nullable()
        if (!hasCount) table.integer('card_reminder_count').notNullable().defaultTo(0)
        if (!hasStatus) table.string('card_reminder_status').notNullable().defaultTo('pending')
      })
    }

    await knex('candidate_exams').update({
      card_reminder_queued_at: null,
      card_reminder_sent_at: null,
      card_reminder_count: knex.raw('coalesce(card_reminder_count, 0)'),
      card_reminder_status: knex.raw("coalesce(nullif(card_reminder_status, ''), 'pending')"),
    })
  },

  async down(knex) {
    if (!(await hasTable(knex, 'candidate_exams'))) return

    const hasQueuedAt = await hasColumn(knex, 'candidate_exams', 'card_reminder_queued_at')
    const hasSentAt = await hasColumn(knex, 'candidate_exams', 'card_reminder_sent_at')
    const hasCount = await hasColumn(knex, 'candidate_exams', 'card_reminder_count')
    const hasStatus = await hasColumn(knex, 'candidate_exams', 'card_reminder_status')
    if (!hasQueuedAt && !hasSentAt && !hasCount && !hasStatus) return

    await knex.schema.alterTable('candidate_exams', (table) => {
      if (hasQueuedAt) table.dropColumn('card_reminder_queued_at')
      if (hasSentAt) table.dropColumn('card_reminder_sent_at')
      if (hasCount) table.dropColumn('card_reminder_count')
      if (hasStatus) table.dropColumn('card_reminder_status')
    })
  },
}