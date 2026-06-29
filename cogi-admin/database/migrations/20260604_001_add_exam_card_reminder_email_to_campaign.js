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

    const hasSubject = await hasColumn(knex, 'campaigns', 'exam_card_reminder_email_subject')
    const hasHtml = await hasColumn(knex, 'campaigns', 'exam_card_reminder_email_html')
    if (hasSubject && hasHtml) return

    await knex.schema.alterTable('campaigns', (table) => {
      if (!hasSubject) {
        table.string('exam_card_reminder_email_subject').nullable()
      }
      if (!hasHtml) {
        table.text('exam_card_reminder_email_html').nullable()
      }
    })
  },

  async down(knex) {
    if (!(await hasTable(knex, 'campaigns'))) return

    const hasSubject = await hasColumn(knex, 'campaigns', 'exam_card_reminder_email_subject')
    const hasHtml = await hasColumn(knex, 'campaigns', 'exam_card_reminder_email_html')
    if (!hasSubject && !hasHtml) return

    await knex.schema.alterTable('campaigns', (table) => {
      if (hasSubject) {
        table.dropColumn('exam_card_reminder_email_subject')
      }
      if (hasHtml) {
        table.dropColumn('exam_card_reminder_email_html')
      }
    })
  },
}