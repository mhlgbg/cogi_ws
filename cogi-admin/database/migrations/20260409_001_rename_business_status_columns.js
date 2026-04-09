const COLUMN_RENAMES = [
  ['admission_applications', 'status', 'admission_status'],
  ['campaigns', 'status', 'campaign_status'],
  ['form_templates', 'status', 'form_template_status'],
  ['service_orders', 'status', 'service_order_status'],
  ['classes', 'status', 'class_status'],
  ['enrollments', 'status', 'enrollment_status'],
  ['learners', 'status', 'learner_status'],
  ['employees', 'status', 'employee_status'],
  ['fee_sheets', 'status', 'fee_sheet_status'],
  ['fee_sheet_classes', 'status', 'fee_sheet_class_status'],
  ['fee_items', 'status', 'fee_item_payment_status'],
]

async function hasColumn(knex, tableName, columnName) {
  try {
    return await knex.schema.hasColumn(tableName, columnName)
  } catch {
    return false
  }
}

async function renameOrCopyColumn(knex, tableName, fromColumn, toColumn) {
  const hasFrom = await hasColumn(knex, tableName, fromColumn)
  const hasTo = await hasColumn(knex, tableName, toColumn)

  if (!hasFrom || hasTo) return

  try {
    await knex.schema.alterTable(tableName, (table) => {
      table.renameColumn(fromColumn, toColumn)
    })
    return
  } catch {
    const columnType = 'text'
    await knex.schema.alterTable(tableName, (table) => {
      table.specificType(toColumn, columnType)
    })
    await knex(tableName).update({ [toColumn]: knex.ref(fromColumn) })
  }
}

async function renameBack(knex, tableName, fromColumn, toColumn) {
  const hasFrom = await hasColumn(knex, tableName, fromColumn)
  const hasTo = await hasColumn(knex, tableName, toColumn)

  if (!hasFrom || hasTo) return

  try {
    await knex.schema.alterTable(tableName, (table) => {
      table.renameColumn(fromColumn, toColumn)
    })
  } catch {
    const columnType = 'text'
    await knex.schema.alterTable(tableName, (table) => {
      table.specificType(toColumn, columnType)
    })
    await knex(tableName).update({ [toColumn]: knex.ref(fromColumn) })
  }
}

module.exports = {
  async up(knex) {
    for (const [tableName, fromColumn, toColumn] of COLUMN_RENAMES) {
      await renameOrCopyColumn(knex, tableName, fromColumn, toColumn)
    }
  },

  async down(knex) {
    for (const [tableName, fromColumn, toColumn] of COLUMN_RENAMES) {
      await renameBack(knex, tableName, toColumn, fromColumn)
    }
  },
}