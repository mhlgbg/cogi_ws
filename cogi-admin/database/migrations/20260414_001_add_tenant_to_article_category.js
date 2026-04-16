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

async function resolveArticleCategoryStorage(knex) {
  if (await hasColumn(knex, 'articles', 'category_id')) {
    return {
      mode: 'direct-column',
      articleTable: 'articles',
      articleColumn: 'category_id',
    }
  }

  const linkTable = await findExistingTable(knex, [
    'articles_category_lnk',
    'article_category_lnk',
    'categories_article_lnk',
    'category_articles_lnk',
  ])

  if (!linkTable) {
    return null
  }

  const columns = await getTableColumns(knex, linkTable)
  const articleColumnCandidates = ['article_id', 'articles_id', 'entity_id', 'source_id']
  const categoryColumnCandidates = ['category_id', 'categories_id', 'inv_category_id', 'target_id']

  const articleLinkColumn = articleColumnCandidates.find((column) => columns.has(column)) || null
  const categoryLinkColumn = categoryColumnCandidates.find((column) => columns.has(column)) || null

  if (!articleLinkColumn || !categoryLinkColumn) {
    return null
  }

  return {
    mode: 'link-table',
    linkTable,
    articleLinkColumn,
    categoryLinkColumn,
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

async function backfillCategoryTenants(knex, fallbackTenantId) {
  if (!fallbackTenantId) return
  await knex('categories').whereNull('tenant_id').update({ tenant_id: fallbackTenantId })
}

async function backfillArticleTenants(knex, fallbackTenantId) {
  const client = String(knex?.client?.config?.client || '').toLowerCase()
  const storage = await resolveArticleCategoryStorage(knex)

  if (storage?.mode === 'direct-column' && client.includes('pg')) {
    await knex.raw(`
      update articles as a
      set tenant_id = c.tenant_id
      from categories as c
      where a.${storage.articleColumn} = c.id
        and a.tenant_id is null
        and c.tenant_id is not null
    `)
  } else if (storage?.mode === 'direct-column') {
    await knex('articles')
      .whereNull('tenant_id')
      .whereIn(storage.articleColumn, knex('categories').select('id').whereNotNull('tenant_id'))
      .update({
        tenant_id: knex('categories')
          .select('tenant_id')
          .whereRaw(`categories.id = articles.${storage.articleColumn}`)
          .limit(1),
      })
  } else if (storage?.mode === 'link-table' && client.includes('pg')) {
    await knex.raw(`
      update articles as a
      set tenant_id = c.tenant_id
      from ${storage.linkTable} as acl
      inner join categories as c on c.id = acl.${storage.categoryLinkColumn}
      where a.id = acl.${storage.articleLinkColumn}
        and a.tenant_id is null
        and c.tenant_id is not null
    `)
  } else if (storage?.mode === 'link-table') {
    await knex('articles')
      .whereNull('tenant_id')
      .whereIn('id', knex(storage.linkTable).select(storage.articleLinkColumn))
      .update({
        tenant_id: knex(storage.linkTable)
          .join('categories', `categories.id`, `${storage.linkTable}.${storage.categoryLinkColumn}`)
          .select('categories.tenant_id')
          .whereRaw(`${storage.linkTable}.${storage.articleLinkColumn} = articles.id`)
          .whereNotNull('categories.tenant_id')
          .limit(1),
      })
  }

  if (fallbackTenantId) {
    await knex('articles').whereNull('tenant_id').update({ tenant_id: fallbackTenantId })
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
    // leave nullable when the underlying database cannot alter safely
  }
}

async function dropArticleSlugGlobalUnique(knex) {
  const client = String(knex?.client?.config?.client || '').toLowerCase()

  if (client.includes('pg')) {
    const constraints = await knex.raw(`
      select conname
      from pg_constraint
      where contype = 'u'
        and conrelid = 'articles'::regclass
        and pg_get_constraintdef(oid) like 'UNIQUE (slug)%'
    `)

    for (const row of constraints?.rows || []) {
      if (!row?.conname) continue
      await knex.raw(`alter table articles drop constraint if exists "${row.conname}"`)
    }

    const indexes = await knex.raw(`
      select indexname
      from pg_indexes
      where schemaname = current_schema()
        and tablename = 'articles'
        and indexdef ilike 'create unique index % (slug)%'
    `)

    for (const row of indexes?.rows || []) {
      if (!row?.indexname || row.indexname === 'articles_tenant_slug_unique') continue
      await knex.raw(`drop index if exists "${row.indexname}"`)
    }

    return
  }

  try {
    await knex.schema.alterTable('articles', (table) => {
      table.dropUnique(['slug'])
    })
  } catch {
    // ignore when the unique key is absent or named differently
  }
}

async function ensureArticleTenantSlugUnique(knex) {
  const client = String(knex?.client?.config?.client || '').toLowerCase()

  if (client.includes('pg')) {
    await knex.raw(`
      create unique index if not exists articles_tenant_slug_unique
      on articles (tenant_id, slug)
      where tenant_id is not null and slug is not null
    `)
    return
  }

  try {
    await knex.schema.alterTable('articles', (table) => {
      table.unique(['tenant_id', 'slug'], 'articles_tenant_slug_unique')
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
      // ignore if the index is already absent
    }
  }
}

module.exports = {
  async up(knex) {
    await ensureTenantColumn(knex, 'categories')
    await ensureTenantColumn(knex, 'articles')

    const fallbackTenantId = await getFallbackTenantId(knex)
    await backfillCategoryTenants(knex, fallbackTenantId)
    await backfillArticleTenants(knex, fallbackTenantId)

    await ensureIndex(knex, 'categories', ['tenant_id'], 'categories_tenant_id_index')
    await ensureIndex(knex, 'articles', ['tenant_id'], 'articles_tenant_id_index')

    await dropArticleSlugGlobalUnique(knex)
    await ensureArticleTenantSlugUnique(knex)
  },

  async down(knex) {
    await dropIndexIfExists(knex, 'articles', 'articles_tenant_slug_unique')
    await dropIndexIfExists(knex, 'articles', 'articles_tenant_id_index')
    await dropIndexIfExists(knex, 'categories', 'categories_tenant_id_index')

    if (await hasColumn(knex, 'articles', 'tenant_id')) {
      await knex.schema.alterTable('articles', (table) => {
        table.dropColumn('tenant_id')
      })
    }

    if (await hasColumn(knex, 'categories', 'tenant_id')) {
      await knex.schema.alterTable('categories', (table) => {
        table.dropColumn('tenant_id')
      })
    }
  },
}