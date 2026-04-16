async function hasColumn(knex, tableName, columnName) {
  try {
    return await knex.schema.hasColumn(tableName, columnName)
  } catch {
    return false
  }
}

async function hasTable(knex, tableName) {
  try {
    return await knex.schema.hasTable(tableName)
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

async function resolveArticleAuthorStorage(knex) {
  if (await hasColumn(knex, 'articles', 'author_id')) {
    return {
      mode: 'direct-column',
      articleTable: 'articles',
      articleColumn: 'author_id',
    }
  }

  const linkTable = await findExistingTable(knex, [
    'articles_author_lnk',
    'article_author_lnk',
    'authors_article_lnk',
    'author_articles_lnk',
  ])

  if (!linkTable) {
    return null
  }

  const columns = await getTableColumns(knex, linkTable)
  const articleColumnCandidates = ['article_id', 'articles_id', 'entity_id', 'source_id']
  const authorColumnCandidates = ['author_id', 'authors_id', 'inv_author_id', 'target_id']

  const articleLinkColumn = articleColumnCandidates.find((column) => columns.has(column)) || null
  const authorLinkColumn = authorColumnCandidates.find((column) => columns.has(column)) || null

  if (!articleLinkColumn || !authorLinkColumn) {
    return null
  }

  return {
    mode: 'link-table',
    linkTable,
    articleLinkColumn,
    authorLinkColumn,
  }
}

async function ensureTenantColumn(knex, tableName) {
  const exists = await hasColumn(knex, tableName, 'tenant_id')
  if (exists) return

  await knex.schema.alterTable(tableName, (table) => {
    table.integer('tenant_id').unsigned().nullable()
  })
}

async function ensureIndex(knex, tableName, columns, indexName) {
  try {
    await knex.schema.alterTable(tableName, (table) => {
      table.index(columns, indexName)
    })
  } catch {
    // ignore duplicate index attempts
  }
}

async function getFallbackTenantId(knex) {
  const activeTenant = await knex('tenants')
    .select('id')
    .where({ tenant_status: 'active' })
    .orderBy('id', 'asc')
    .first()

  if (activeTenant?.id) return activeTenant.id

  const firstTenant = await knex('tenants')
    .select('id')
    .orderBy('id', 'asc')
    .first()

  return firstTenant?.id || null
}

async function backfillAuthorTenants(knex, fallbackTenantId) {
  const client = String(knex?.client?.config?.client || '').toLowerCase()
  const storage = await resolveArticleAuthorStorage(knex)

  if (storage?.mode === 'direct-column' && client.includes('pg')) {
    await knex.raw(`
      update authors as a
      set tenant_id = ar.tenant_id
      from articles as ar
      where ar.${storage.articleColumn} = a.id
        and a.tenant_id is null
        and ar.tenant_id is not null
    `)
  } else if (storage?.mode === 'direct-column') {
    await knex('authors')
      .whereNull('tenant_id')
      .whereIn('id', knex('articles').select(storage.articleColumn).whereNotNull('tenant_id').whereNotNull(storage.articleColumn))
      .update({
        tenant_id: knex('articles')
          .select('tenant_id')
          .whereRaw(`articles.${storage.articleColumn} = authors.id`)
          .whereNotNull('tenant_id')
          .limit(1),
      })
  } else if (storage?.mode === 'link-table' && client.includes('pg')) {
    await knex.raw(`
      update authors as a
      set tenant_id = ar.tenant_id
      from ${storage.linkTable} as aal
      inner join articles as ar on ar.id = aal.${storage.articleLinkColumn}
      where a.id = aal.${storage.authorLinkColumn}
        and a.tenant_id is null
        and ar.tenant_id is not null
    `)
  } else if (storage?.mode === 'link-table') {
    await knex('authors')
      .whereNull('tenant_id')
      .whereIn('id', knex(storage.linkTable).select(storage.authorLinkColumn))
      .update({
        tenant_id: knex(storage.linkTable)
          .join('articles', `articles.id`, `${storage.linkTable}.${storage.articleLinkColumn}`)
          .select('articles.tenant_id')
          .whereRaw(`${storage.linkTable}.${storage.authorLinkColumn} = authors.id`)
          .whereNotNull('articles.tenant_id')
          .limit(1),
      })
  }

  if (fallbackTenantId) {
    await knex('authors').whereNull('tenant_id').update({ tenant_id: fallbackTenantId })
  }
}

async function getNullCount(knex, tableName, columnName) {
  const row = await knex(tableName).whereNull(columnName).count({ count: '*' }).first()
  return Number(row?.count || 0)
}

async function applyNotNullIfSafe(knex, tableName, columnName) {
  const remainingNulls = await getNullCount(knex, tableName, columnName)
  if (remainingNulls > 0) return

  try {
    await knex.schema.alterTable(tableName, (table) => {
      table.integer(columnName).unsigned().notNullable().alter()
    })
  } catch {
    // leave nullable if alter is not supported safely
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
      // ignore if already absent
    }
  }
}

module.exports = {
  async up(knex) {
    await ensureTenantColumn(knex, 'authors')
    const fallbackTenantId = await getFallbackTenantId(knex)
    await backfillAuthorTenants(knex, fallbackTenantId)
    await ensureIndex(knex, 'authors', ['tenant_id'], 'authors_tenant_id_index')
  },

  async down(knex) {
    await dropIndexIfExists(knex, 'authors', 'authors_tenant_id_index')

    if (await hasColumn(knex, 'authors', 'tenant_id')) {
      await knex.schema.alterTable('authors', (table) => {
        table.dropColumn('tenant_id')
      })
    }
  },
}