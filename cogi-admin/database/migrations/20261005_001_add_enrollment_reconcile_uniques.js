async function hasTable(knex, tableName) {
  try {
    return await knex.schema.hasTable(tableName)
  } catch {
    return false
  }
}

async function getTableColumns(knex, tableName) {
  if (!(await hasTable(knex, tableName))) return new Set()

  try {
    const rows = await knex('information_schema.columns')
      .select('column_name')
      .where({
        table_schema: 'public',
        table_name: tableName,
      })
    return new Set((rows || []).map((row) => String(row.column_name || '').trim()).filter(Boolean))
  } catch {
    return new Set()
  }
}

async function createIndexIfColumnsExist(knex, tableName, indexName, columns, unique = false) {
  if (!(await hasTable(knex, tableName))) return

  const existingColumns = await getTableColumns(knex, tableName)
  if (!columns.every((column) => existingColumns.has(column))) return

  const client = String(knex?.client?.config?.client || '').toLowerCase()
  const quotedColumns = columns.map((column) => `"${column}"`).join(', ')

  if (client.includes('pg')) {
    const prefix = unique ? 'create unique index if not exists' : 'create index if not exists'
    await knex.raw(`${prefix} ${indexName} on ${tableName} (${quotedColumns})`)
    return
  }

  try {
    await knex.schema.alterTable(tableName, (table) => {
      if (unique) {
        table.unique(columns, indexName)
      } else {
        table.index(columns, indexName)
      }
    })
  } catch {
    // ignore duplicate create attempts
  }
}

async function dropIndexIfExists(knex, tableName, indexName, unique = false) {
  if (!(await hasTable(knex, tableName))) return

  try {
    await knex.schema.alterTable(tableName, (table) => {
      if (unique) {
        table.dropUnique([], indexName)
      } else {
        table.dropIndex([], indexName)
      }
    })
  } catch {
    try {
      await knex.raw(`drop index if exists ${indexName}`)
    } catch {
      // ignore if already absent
    }
  }
}

async function removeDuplicateRows(knex, tableName, columns) {
  if (!(await hasTable(knex, tableName))) return
  if (!columns.length) return

  const existingColumns = await getTableColumns(knex, tableName)
  if (!existingColumns.has('id')) return
  if (!columns.every((column) => existingColumns.has(column))) return

  const duplicates = await knex(tableName)
    .select([...columns, knex.raw('MIN(id) as keep_id')])
    .groupBy(columns)
    .havingRaw('COUNT(*) > 1')

  for (const row of duplicates || []) {
    const keepId = Number(row.keep_id || 0)
    if (!keepId) continue

    let query = knex(tableName).whereNot('id', keepId)
    for (const column of columns) {
      const value = row[column]
      if (value === null || value === undefined) {
        query = query.whereNull(column)
      } else {
        query = query.where(column, value)
      }
    }
    await query.del()
  }
}

module.exports = {
  async up(knex) {
    await removeDuplicateRows(knex, 'class_session_attendances', ['tenant_id', 'class_session_id', 'learner_id'])
    await removeDuplicateRows(knex, 'assignment_task_learner_progresses', ['tenant_id', 'assignment_task_id', 'learner_id'])

    await createIndexIfColumnsExist(
      knex,
      'class_session_attendances',
      'class_session_attendances_tenant_session_learner_unique',
      ['tenant_id', 'class_session_id', 'learner_id'],
      true,
    )

    await createIndexIfColumnsExist(
      knex,
      'assignment_task_learner_progresses',
      'assignment_task_learner_progress_tenant_task_learner_unique',
      ['tenant_id', 'assignment_task_id', 'learner_id'],
      true,
    )
  },

  async down(knex) {
    await dropIndexIfExists(knex, 'assignment_task_learner_progresses', 'assignment_task_learner_progress_tenant_task_learner_unique', true)
    await dropIndexIfExists(knex, 'class_session_attendances', 'class_session_attendances_tenant_session_learner_unique', true)
  },
}

