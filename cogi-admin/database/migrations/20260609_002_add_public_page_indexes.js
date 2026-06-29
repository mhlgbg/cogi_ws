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

module.exports = {
  async up(knex) {
    await createIndexIfColumnsExist(knex, 'public_pages', 'public_pages_tenant_slug_unique', ['tenant_id', 'slug'], true)
    await createIndexIfColumnsExist(knex, 'public_pages', 'public_pages_tenant_status_idx', ['tenant_id', 'public_page_status'])
    await createIndexIfColumnsExist(knex, 'public_pages', 'public_pages_tenant_page_type_idx', ['tenant_id', 'page_type'])
    await createIndexIfColumnsExist(knex, 'public_pages', 'public_pages_tenant_is_deleted_idx', ['tenant_id', 'is_deleted'])
  },

  async down(knex) {
    await dropIndexIfExists(knex, 'public_pages', 'public_pages_tenant_is_deleted_idx')
    await dropIndexIfExists(knex, 'public_pages', 'public_pages_tenant_page_type_idx')
    await dropIndexIfExists(knex, 'public_pages', 'public_pages_tenant_status_idx')
    await dropIndexIfExists(knex, 'public_pages', 'public_pages_tenant_slug_unique', true)
  },
}
