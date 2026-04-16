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

async function ensureTenantShadowColumn(knex) {
  if (!(await hasTable(knex, 'tenant_configs'))) return
  if (await hasColumn(knex, 'tenant_configs', 'tenant_id')) return

  await knex.schema.alterTable('tenant_configs', (table) => {
    table.integer('tenant_id').unsigned().nullable()
  })
}

async function resolveTenantLinkStorage(knex) {
  const linkTable = await findExistingTable(knex, [
    'tenant_configs_tenant_lnk',
    'tenant_configs_tenant_links',
    'tenant_config_tenant_lnk',
    'tenants_tenant_configs_lnk',
  ])

  if (linkTable) {
    const columns = await getTableColumns(knex, linkTable)
    const configColumnCandidates = ['tenant_config_id', 'tenant_configs_id', 'entity_id', 'source_id']
    const tenantColumnCandidates = ['tenant_id', 'tenants_id', 'inv_tenant_id', 'target_id']

    const configLinkColumn = configColumnCandidates.find((column) => columns.has(column)) || null
    const tenantLinkColumn = tenantColumnCandidates.find((column) => columns.has(column)) || null

    if (configLinkColumn && tenantLinkColumn) {
      return {
        mode: 'link-table',
        linkTable,
        configLinkColumn,
        tenantLinkColumn,
      }
    }
  }

  if (await hasColumn(knex, 'tenant_configs', 'tenant_id')) {
    return { mode: 'direct-column', tenantColumn: 'tenant_id' }
  }

  return null
}

async function backfillTenantShadow(knex) {
  if (!(await hasTable(knex, 'tenant_configs'))) return
  if (!(await hasColumn(knex, 'tenant_configs', 'tenant_id'))) return

  const client = String(knex?.client?.config?.client || '').toLowerCase()
  const storage = await resolveTenantLinkStorage(knex)

  if (storage?.mode === 'link-table' && client.includes('pg')) {
    await knex.raw(`
      update tenant_configs as tc
      set tenant_id = link.${storage.tenantLinkColumn}
      from ${storage.linkTable} as link
      where tc.id = link.${storage.configLinkColumn}
        and tc.tenant_id is null
        and link.${storage.tenantLinkColumn} is not null
    `)
  }
}

async function ensureIndexes(knex) {
  if (!(await hasTable(knex, 'tenant_configs'))) return
  if (!(await hasColumn(knex, 'tenant_configs', 'tenant_id'))) return

  try {
    await knex.schema.alterTable('tenant_configs', (table) => {
      table.index(['tenant_id'], 'tenant_configs_tenant_id_idx')
    })
  } catch {
    // ignore duplicate index attempts
  }

  const client = String(knex?.client?.config?.client || '').toLowerCase()
  if (client.includes('pg')) {
    await knex.raw(`
      create unique index if not exists tenant_configs_tenant_key_unique
      on tenant_configs (tenant_id, "key")
      where tenant_id is not null and "key" is not null
    `)
    return
  }

  try {
    await knex.schema.alterTable('tenant_configs', (table) => {
      table.unique(['tenant_id', 'key'], 'tenant_configs_tenant_key_unique')
    })
  } catch {
    // ignore duplicate create attempts
  }
}

module.exports = {
  async up(knex) {
    await ensureTenantShadowColumn(knex)
    await backfillTenantShadow(knex)
    await ensureIndexes(knex)
  },

  async down(knex) {
    try {
      await knex.schema.alterTable('tenant_configs', (table) => {
        table.dropUnique([], 'tenant_configs_tenant_key_unique')
      })
    } catch {
      try {
        await knex.raw('drop index if exists tenant_configs_tenant_key_unique')
      } catch {
        // ignore if the index is already absent
      }
    }

    try {
      await knex.schema.alterTable('tenant_configs', (table) => {
        table.dropIndex([], 'tenant_configs_tenant_id_idx')
      })
    } catch {
      try {
        await knex.raw('drop index if exists tenant_configs_tenant_id_idx')
      } catch {
        // ignore if the index is already absent
      }
    }
  },
}