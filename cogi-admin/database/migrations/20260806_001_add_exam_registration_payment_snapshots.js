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

async function getTableColumns(knex, tableName) {
  if (!(await hasTable(knex, tableName))) return new Set()

  try {
    const rows = await knex('information_schema.columns')
      .select('column_name')
      .where({ table_schema: 'public', table_name: tableName })

    return new Set((rows || []).map((row) => String(row.column_name || '').trim()).filter(Boolean))
  } catch {
    return new Set()
  }
}

async function createIndexIfColumnsExist(knex, tableName, indexName, columns, unique = false) {
  const existingColumns = await getTableColumns(knex, tableName)
  const normalizedColumns = columns.filter((column) => existingColumns.has(column))
  if (normalizedColumns.length !== columns.length) return

  const client = String(knex?.client?.config?.client || '').toLowerCase()
  const quotedColumns = normalizedColumns.map((column) => `"${column}"`).join(', ')

  if (client.includes('pg')) {
    const prefix = unique ? 'create unique index if not exists' : 'create index if not exists'
    await knex.raw(`${prefix} ${indexName} on ${tableName} (${quotedColumns})`)
    return
  }

  try {
    await knex.schema.alterTable(tableName, (table) => {
      if (unique) table.unique(normalizedColumns, indexName)
      else table.index(normalizedColumns, indexName)
    })
  } catch {
    // ignore duplicate create attempts
  }
}

async function dropIndexIfExists(knex, tableName, indexName) {
  try {
    await knex.schema.alterTable(tableName, (table) => {
      table.dropIndex([], indexName)
    })
  } catch {
    try {
      await knex.raw(`drop index if exists ${indexName}`)
    } catch {
      // ignore missing index
    }
  }
}

module.exports = {
  async up(knex) {
    if (await hasTable(knex, 'exam_registrations')) {
      if (!(await hasColumn(knex, 'exam_registrations', 'payment_calculation_method_snapshot'))) {
        await knex.schema.alterTable('exam_registrations', (table) => {
          table.string('payment_calculation_method_snapshot', 40).nullable()
        })
      }
      if (!(await hasColumn(knex, 'exam_registrations', 'fixed_fee_snapshot'))) {
        await knex.schema.alterTable('exam_registrations', (table) => {
          table.decimal('fixed_fee_snapshot', 18, 2).nullable()
        })
      }
      if (!(await hasColumn(knex, 'exam_registrations', 'subject_fee_total_snapshot'))) {
        await knex.schema.alterTable('exam_registrations', (table) => {
          table.decimal('subject_fee_total_snapshot', 18, 2).notNullable().defaultTo(0)
        })
      }
      if (!(await hasColumn(knex, 'exam_registrations', 'component_fee_total_snapshot'))) {
        await knex.schema.alterTable('exam_registrations', (table) => {
          table.decimal('component_fee_total_snapshot', 18, 2).notNullable().defaultTo(0)
        })
      }
      if (!(await hasColumn(knex, 'exam_registrations', 'amount_due'))) {
        await knex.schema.alterTable('exam_registrations', (table) => {
          table.decimal('amount_due', 18, 2).notNullable().defaultTo(0)
        })
      }
      if (!(await hasColumn(knex, 'exam_registrations', 'currency'))) {
        await knex.schema.alterTable('exam_registrations', (table) => {
          table.string('currency', 10).nullable().defaultTo('VND')
        })
      }
      if (!(await hasColumn(knex, 'exam_registrations', 'payment_due_at'))) {
        await knex.schema.alterTable('exam_registrations', (table) => {
          table.datetime('payment_due_at').nullable()
        })
      }
      if (!(await hasColumn(knex, 'exam_registrations', 'payment_method_snapshot'))) {
        await knex.schema.alterTable('exam_registrations', (table) => {
          table.string('payment_method_snapshot', 40).nullable()
        })
      }
      if (!(await hasColumn(knex, 'exam_registrations', 'payment_profile_name_snapshot'))) {
        await knex.schema.alterTable('exam_registrations', (table) => {
          table.string('payment_profile_name_snapshot', 150).nullable()
        })
      }
      if (!(await hasColumn(knex, 'exam_registrations', 'payment_profile_code_snapshot'))) {
        await knex.schema.alterTable('exam_registrations', (table) => {
          table.string('payment_profile_code_snapshot', 100).nullable()
        })
      }
      if (!(await hasColumn(knex, 'exam_registrations', 'payment_bank_code_snapshot'))) {
        await knex.schema.alterTable('exam_registrations', (table) => {
          table.string('payment_bank_code_snapshot', 20).nullable()
        })
      }
      if (!(await hasColumn(knex, 'exam_registrations', 'payment_bank_name_snapshot'))) {
        await knex.schema.alterTable('exam_registrations', (table) => {
          table.string('payment_bank_name_snapshot', 150).nullable()
        })
      }
      if (!(await hasColumn(knex, 'exam_registrations', 'payment_account_number_snapshot'))) {
        await knex.schema.alterTable('exam_registrations', (table) => {
          table.string('payment_account_number_snapshot', 100).nullable()
        })
      }
      if (!(await hasColumn(knex, 'exam_registrations', 'payment_account_holder_snapshot'))) {
        await knex.schema.alterTable('exam_registrations', (table) => {
          table.string('payment_account_holder_snapshot', 150).nullable()
        })
      }
      if (!(await hasColumn(knex, 'exam_registrations', 'payment_bank_branch_snapshot'))) {
        await knex.schema.alterTable('exam_registrations', (table) => {
          table.string('payment_bank_branch_snapshot', 150).nullable()
        })
      }
      if (!(await hasColumn(knex, 'exam_registrations', 'payment_transfer_content_template_snapshot'))) {
        await knex.schema.alterTable('exam_registrations', (table) => {
          table.string('payment_transfer_content_template_snapshot', 255).nullable()
        })
      }
      if (!(await hasColumn(knex, 'exam_registrations', 'payment_transfer_content'))) {
        await knex.schema.alterTable('exam_registrations', (table) => {
          table.string('payment_transfer_content', 255).nullable()
        })
      }
      if (!(await hasColumn(knex, 'exam_registrations', 'payment_instruction_snapshot'))) {
        await knex.schema.alterTable('exam_registrations', (table) => {
          table.text('payment_instruction_snapshot').nullable()
        })
      }
      if (!(await hasColumn(knex, 'exam_registrations', 'payment_support_phone_snapshot'))) {
        await knex.schema.alterTable('exam_registrations', (table) => {
          table.string('payment_support_phone_snapshot', 30).nullable()
        })
      }
      if (!(await hasColumn(knex, 'exam_registrations', 'payment_support_email_snapshot'))) {
        await knex.schema.alterTable('exam_registrations', (table) => {
          table.string('payment_support_email_snapshot', 255).nullable()
        })
      }
      if (!(await hasColumn(knex, 'exam_registrations', 'payment_reported_at'))) {
        await knex.schema.alterTable('exam_registrations', (table) => {
          table.datetime('payment_reported_at').nullable()
        })
      }
      if (!(await hasColumn(knex, 'exam_registrations', 'payment_confirmed_at'))) {
        await knex.schema.alterTable('exam_registrations', (table) => {
          table.datetime('payment_confirmed_at').nullable()
        })
      }
      if (!(await hasColumn(knex, 'exam_registrations', 'payment_confirmed_by_id'))) {
        await knex.schema.alterTable('exam_registrations', (table) => {
          table.integer('payment_confirmed_by_id').unsigned().nullable()
        })
      }

      await createIndexIfColumnsExist(knex, 'exam_registrations', 'exam_registrations_tenant_round_learner_uniq', ['tenant_id', 'exam_round_id', 'learner_id'], true)
      await createIndexIfColumnsExist(knex, 'exam_registrations', 'exam_registrations_tenant_registration_code_uniq', ['tenant_id', 'registration_code'], true)
    }

    if (await hasTable(knex, 'exam_registration_subjects')) {
      if (!(await hasColumn(knex, 'exam_registration_subjects', 'subject_code_snapshot'))) {
        await knex.schema.alterTable('exam_registration_subjects', (table) => {
          table.string('subject_code_snapshot', 100).nullable()
        })
      }
      if (!(await hasColumn(knex, 'exam_registration_subjects', 'name_snapshot'))) {
        await knex.schema.alterTable('exam_registration_subjects', (table) => {
          table.string('name_snapshot', 200).nullable()
        })
      }
      if (!(await hasColumn(knex, 'exam_registration_subjects', 'is_required_snapshot'))) {
        await knex.schema.alterTable('exam_registration_subjects', (table) => {
          table.boolean('is_required_snapshot').notNullable().defaultTo(true)
        })
      }
      if (!(await hasColumn(knex, 'exam_registration_subjects', 'allow_separate_registration_snapshot'))) {
        await knex.schema.alterTable('exam_registration_subjects', (table) => {
          table.boolean('allow_separate_registration_snapshot').notNullable().defaultTo(false)
        })
      }
      if (!(await hasColumn(knex, 'exam_registration_subjects', 'calculation_method_snapshot'))) {
        await knex.schema.alterTable('exam_registration_subjects', (table) => {
          table.string('calculation_method_snapshot', 40).nullable()
        })
      }
      if (!(await hasColumn(knex, 'exam_registration_subjects', 'required_aggregate_score_snapshot'))) {
        await knex.schema.alterTable('exam_registration_subjects', (table) => {
          table.decimal('required_aggregate_score_snapshot', 18, 2).nullable()
        })
      }
      if (!(await hasColumn(knex, 'exam_registration_subjects', 'require_all_components_snapshot'))) {
        await knex.schema.alterTable('exam_registration_subjects', (table) => {
          table.boolean('require_all_components_snapshot').notNullable().defaultTo(true)
        })
      }
      if (!(await hasColumn(knex, 'exam_registration_subjects', 'rule_description_snapshot'))) {
        await knex.schema.alterTable('exam_registration_subjects', (table) => {
          table.text('rule_description_snapshot').nullable()
        })
      }
    }

    if (await hasTable(knex, 'exam_registration_components')) {
      if (!(await hasColumn(knex, 'exam_registration_components', 'component_code_snapshot'))) {
        await knex.schema.alterTable('exam_registration_components', (table) => {
          table.string('component_code_snapshot', 100).nullable()
        })
      }
      if (!(await hasColumn(knex, 'exam_registration_components', 'name_snapshot'))) {
        await knex.schema.alterTable('exam_registration_components', (table) => {
          table.string('name_snapshot', 200).nullable()
        })
      }
      if (!(await hasColumn(knex, 'exam_registration_components', 'is_required_snapshot'))) {
        await knex.schema.alterTable('exam_registration_components', (table) => {
          table.boolean('is_required_snapshot').notNullable().defaultTo(true)
        })
      }
      if (!(await hasColumn(knex, 'exam_registration_components', 'allow_separate_registration_snapshot'))) {
        await knex.schema.alterTable('exam_registration_components', (table) => {
          table.boolean('allow_separate_registration_snapshot').notNullable().defaultTo(false)
        })
      }
      if (!(await hasColumn(knex, 'exam_registration_components', 'duration_minutes_snapshot'))) {
        await knex.schema.alterTable('exam_registration_components', (table) => {
          table.integer('duration_minutes_snapshot').nullable()
        })
      }
      if (!(await hasColumn(knex, 'exam_registration_components', 'exam_method_snapshot'))) {
        await knex.schema.alterTable('exam_registration_components', (table) => {
          table.string('exam_method_snapshot', 40).nullable()
        })
      }
    }
  },

  async down(knex) {
    await dropIndexIfExists(knex, 'exam_registrations', 'exam_registrations_tenant_round_learner_uniq')
    await dropIndexIfExists(knex, 'exam_registrations', 'exam_registrations_tenant_registration_code_uniq')
  },
}