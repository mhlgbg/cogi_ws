async function hasTable(knex: any, tableName: string) {
  try {
    return await knex.schema.hasTable(tableName)
  } catch {
    return false
  }
}

async function hasColumn(knex: any, tableName: string, columnName: string) {
  try {
    return await knex.schema.hasColumn(tableName, columnName)
  } catch {
    return false
  }
}

async function ensureUniqueCompositeIndex(knex: any, tableName: string, indexName: string, columns: string[]) {
  if (!(await hasTable(knex, tableName))) return

  const client = String(knex?.client?.config?.client || '').toLowerCase()
  const hasAllColumns = await Promise.all(columns.map(async (column) => hasColumn(knex, tableName, column)))

  if (!hasAllColumns.every(Boolean)) return

  if (client.includes('pg')) {
    await knex.raw(`create unique index if not exists ${indexName} on ${tableName} (${columns.map((column) => `"${column}"`).join(', ')})`)
    return
  }

  try {
    await knex.schema.alterTable(tableName, (table: any) => {
      table.unique(columns, indexName)
    })
  } catch {
    // Ignore duplicate index attempts.
  }
}

export async function ensureStructuredTreeDatabaseIndexes(strapi: any) {
  const knex = strapi.db.connection

  await ensureUniqueCompositeIndex(knex, 'structured_nodes', 'structured_nodes_tree_keycode_unique', ['tree_id', 'key_code'])
  strapi.log?.info?.('[structured-tree] ensured unique index on structured_nodes(tree_id, key_code)')
}
