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

async function ensureTenantShadowColumn(knex) {
  if (!(await hasTable(knex, 'file_assets'))) return
  if (await hasColumn(knex, 'file_assets', 'tenant_id')) return

  await knex.schema.alterTable('file_assets', (table) => {
    table.integer('tenant_id').unsigned().nullable()
  })
}

async function resolveTenantLinkStorage(knex) {
  const linkTable = await findExistingTable(knex, [
    'file_assets_tenant_lnk',
    'file_assets_tenant_links',
    'file_asset_tenant_lnk',
    'tenants_file_assets_lnk',
  ])

  if (!linkTable) return null

  const columns = await getTableColumns(knex, linkTable)
  const fileAssetColumn = ['file_asset_id', 'file_assets_id', 'entity_id', 'source_id'].find((column) => columns.has(column)) || null
  const tenantColumn = ['tenant_id', 'tenants_id', 'inv_tenant_id', 'target_id'].find((column) => columns.has(column)) || null

  if (!fileAssetColumn || !tenantColumn) return null

  return {
    linkTable,
    fileAssetColumn,
    tenantColumn,
  }
}

async function backfillTenantShadow(knex) {
  if (!(await hasTable(knex, 'file_assets'))) return
  if (!(await hasColumn(knex, 'file_assets', 'tenant_id'))) return

  const client = String(knex?.client?.config?.client || '').toLowerCase()
  const linkStorage = await resolveTenantLinkStorage(knex)
  if (!linkStorage || !client.includes('pg')) return

  await knex.raw(`
    update file_assets as fa
    set tenant_id = link.${linkStorage.tenantColumn}
    from ${linkStorage.linkTable} as link
    where fa.id = link.${linkStorage.fileAssetColumn}
      and fa.tenant_id is null
      and link.${linkStorage.tenantColumn} is not null
  `)
}

async function createIndexIfColumnsExist(knex, indexName, columns, unique = false) {
  const existingColumns = await getTableColumns(knex, 'file_assets')
  const normalizedColumns = columns.filter((column) => existingColumns.has(column))
  if (normalizedColumns.length !== columns.length) return

  const client = String(knex?.client?.config?.client || '').toLowerCase()
  const quotedColumns = normalizedColumns.map((column) => `"${column}"`).join(', ')

  if (client.includes('pg')) {
    const prefix = unique ? 'create unique index if not exists' : 'create index if not exists'
    await knex.raw(`${prefix} ${indexName} on file_assets (${quotedColumns})`)
    return
  }

  try {
    await knex.schema.alterTable('file_assets', (table) => {
      if (unique) {
        table.unique(normalizedColumns, indexName)
      } else {
        table.index(normalizedColumns, indexName)
      }
    })
  } catch {
    // ignore duplicate create attempts
  }
}

module.exports = {
  async up(knex) {
    if (!(await hasTable(knex, 'file_assets'))) return

    await ensureTenantShadowColumn(knex)
    await backfillTenantShadow(knex)

    await createIndexIfColumnsExist(knex, 'file_assets_tenant_id_idx', ['tenant_id'])
    await createIndexIfColumnsExist(knex, 'file_assets_tenant_module_key_idx', ['tenant_id', 'module_key'])
    await createIndexIfColumnsExist(knex, 'file_assets_tenant_status_idx', ['tenant_id', 'status'])
    await createIndexIfColumnsExist(knex, 'file_assets_entity_type_entity_id_idx', ['entity_type', 'entity_id'])
    await createIndexIfColumnsExist(knex, 'file_assets_checksum_idx', ['checksum'])
    await createIndexIfColumnsExist(knex, 'file_assets_relative_path_idx', ['relative_path'])
    await createIndexIfColumnsExist(knex, 'file_assets_code_idx', ['code'])
  },

  async down(knex) {
    if (!(await hasTable(knex, 'file_assets'))) return

    const indexNames = [
      'file_assets_tenant_id_idx',
      'file_assets_tenant_module_key_idx',
      'file_assets_tenant_status_idx',
      'file_assets_entity_type_entity_id_idx',
      'file_assets_checksum_idx',
      'file_assets_relative_path_idx',
      'file_assets_code_idx',
    ]

    for (const indexName of indexNames) {
      try {
        await knex.schema.alterTable('file_assets', (table) => {
          table.dropIndex([], indexName)
        })
      } catch {
        try {
          await knex.raw(`drop index if exists ${indexName}`)
        } catch {
          // ignore if already absent
        }
      }
    }
  },
}