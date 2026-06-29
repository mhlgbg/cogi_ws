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
  const exists = await hasTable(knex, tableName)
  if (!exists) return new Set()

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

async function findExistingTable(knex, candidates) {
  for (const tableName of candidates) {
    if (await hasTable(knex, tableName)) return tableName
  }

  return null
}

async function ensureShadowColumns(knex, tableName, columns) {
  if (!(await hasTable(knex, tableName))) return

  for (const columnName of columns) {
    if (await hasColumn(knex, tableName, columnName)) continue
    await knex.schema.alterTable(tableName, (table) => {
      table.integer(columnName).unsigned().nullable()
    })
  }
}

async function resolveLinkStorage(knex, tableName, relationName) {
  const linkTable = await findExistingTable(knex, [
    `${tableName}_${relationName}_lnk`,
    `${tableName}_${relationName}_links`,
    `${tableName.slice(0, -1)}_${relationName}_lnk`,
    `${tableName.slice(0, -1)}_${relationName}_links`,
  ])

  if (!linkTable) return null

  const columns = await getTableColumns(knex, linkTable)
  const sourceCandidates = [`${tableName.slice(0, -1)}_id`, `${tableName}_id`, 'entity_id', 'source_id']
  const targetCandidates = [`${relationName}_id`, `${relationName}s_id`, `inv_${relationName}_id`, 'target_id']

  const sourceColumn = sourceCandidates.find((column) => columns.has(column)) || null
  const targetColumn = targetCandidates.find((column) => columns.has(column)) || null
  if (!sourceColumn || !targetColumn) return null

  return { linkTable, sourceColumn, targetColumn }
}

async function backfillShadowColumn(knex, tableName, shadowColumn, relationName) {
  if (!(await hasTable(knex, tableName))) return
  if (!(await hasColumn(knex, tableName, shadowColumn))) return

  const storage = await resolveLinkStorage(knex, tableName, relationName)
  const client = String(knex?.client?.config?.client || '').toLowerCase()
  if (!storage || !client.includes('pg')) return

  await knex.raw(`
    update ${tableName} as base
    set ${shadowColumn} = link.${storage.targetColumn}
    from ${storage.linkTable} as link
    where base.id = link.${storage.sourceColumn}
      and base.${shadowColumn} is null
      and link.${storage.targetColumn} is not null
  `)
}

async function ensureIndexes(knex) {
  if (await hasTable(knex, 'candidate_exams')) {
    try {
      await knex.schema.alterTable('candidate_exams', (table) => {
        table.index(['tenant_id'], 'candidate_exams_tenant_id_idx')
        table.index(['admission_season_id'], 'candidate_exams_admission_season_id_idx')
        table.index(['admission_application_id'], 'candidate_exams_admission_application_id_idx')
      })
    } catch {
      // ignore duplicate index attempts
    }

    await knex.raw(`
      create unique index if not exists candidate_exams_tenant_season_application_code_unique
      on candidate_exams (tenant_id, admission_season_id, application_code)
      where tenant_id is not null and admission_season_id is not null and application_code is not null and (is_deleted = false or is_deleted is null)
    `)

    await knex.raw(`
      create unique index if not exists candidate_exams_tenant_season_student_code_unique
      on candidate_exams (tenant_id, admission_season_id, student_code)
      where tenant_id is not null and admission_season_id is not null and student_code is not null and student_code <> '' and (is_deleted = false or is_deleted is null)
    `)

    await knex.raw(`
      create unique index if not exists candidate_exams_tenant_season_candidate_number_unique
      on candidate_exams (tenant_id, admission_season_id, candidate_number)
      where tenant_id is not null and admission_season_id is not null and candidate_number is not null and candidate_number <> '' and (is_deleted = false or is_deleted is null)
    `)
  }

  if (await hasTable(knex, 'candidate_exam_logs')) {
    try {
      await knex.schema.alterTable('candidate_exam_logs', (table) => {
        table.index(['tenant_id'], 'candidate_exam_logs_tenant_id_idx')
        table.index(['admission_season_id'], 'candidate_exam_logs_admission_season_id_idx')
        table.index(['candidate_exam_id'], 'candidate_exam_logs_candidate_exam_id_idx')
        table.index(['action_at'], 'candidate_exam_logs_action_at_idx')
      })
    } catch {
      // ignore duplicate index attempts
    }
  }
}

module.exports = {
  async up(knex) {
    await ensureShadowColumns(knex, 'candidate_exams', ['tenant_id', 'admission_season_id', 'admission_application_id'])
    await ensureShadowColumns(knex, 'candidate_exam_logs', ['tenant_id', 'admission_season_id', 'candidate_exam_id', 'admission_application_id'])

    await backfillShadowColumn(knex, 'candidate_exams', 'tenant_id', 'tenant')
    await backfillShadowColumn(knex, 'candidate_exams', 'admission_season_id', 'admission_season')
    await backfillShadowColumn(knex, 'candidate_exams', 'admission_application_id', 'admission_application')

    await backfillShadowColumn(knex, 'candidate_exam_logs', 'tenant_id', 'tenant')
    await backfillShadowColumn(knex, 'candidate_exam_logs', 'admission_season_id', 'admission_season')
    await backfillShadowColumn(knex, 'candidate_exam_logs', 'candidate_exam_id', 'candidate_exam')
    await backfillShadowColumn(knex, 'candidate_exam_logs', 'admission_application_id', 'admission_application')

    await ensureIndexes(knex)
  },

  async down(knex) {
    const indexNames = [
      'candidate_exams_tenant_id_idx',
      'candidate_exams_admission_season_id_idx',
      'candidate_exams_admission_application_id_idx',
      'candidate_exams_tenant_season_application_code_unique',
      'candidate_exams_tenant_season_student_code_unique',
      'candidate_exams_tenant_season_candidate_number_unique',
      'candidate_exam_logs_tenant_id_idx',
      'candidate_exam_logs_admission_season_id_idx',
      'candidate_exam_logs_candidate_exam_id_idx',
      'candidate_exam_logs_action_at_idx',
    ]

    for (const indexName of indexNames) {
      try {
        await knex.raw(`drop index if exists ${indexName}`)
      } catch {
        // ignore if already absent
      }
    }
  },
}