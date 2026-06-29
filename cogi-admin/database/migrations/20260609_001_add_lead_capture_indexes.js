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
    await createIndexIfColumnsExist(knex, 'lead_campaigns', 'lead_campaigns_tenant_code_unique', ['tenant_id', 'code'], true)
    await createIndexIfColumnsExist(knex, 'lead_campaigns', 'lead_campaigns_tenant_status_idx', ['tenant_id', 'lead_campaign_status'])
    await createIndexIfColumnsExist(knex, 'lead_campaigns', 'lead_campaigns_tenant_code_idx', ['tenant_id', 'code'])

    await createIndexIfColumnsExist(knex, 'lead_captures', 'lead_captures_tenant_campaign_status_idx', ['tenant_id', 'campaign_id', 'lead_status'])
    await createIndexIfColumnsExist(knex, 'lead_captures', 'lead_captures_tenant_phone_idx', ['tenant_id', 'phone'])
    await createIndexIfColumnsExist(knex, 'lead_captures', 'lead_captures_tenant_email_idx', ['tenant_id', 'email'])
    await createIndexIfColumnsExist(knex, 'lead_captures', 'lead_captures_tenant_created_at_idx', ['tenant_id', 'created_at'])

    await createIndexIfColumnsExist(knex, 'lead_activities', 'lead_activities_tenant_lead_activity_at_idx', ['tenant_id', 'lead_id', 'activity_at'])
  },

  async down(knex) {
    await dropIndexIfExists(knex, 'lead_activities', 'lead_activities_tenant_lead_activity_at_idx')

    await dropIndexIfExists(knex, 'lead_captures', 'lead_captures_tenant_created_at_idx')
    await dropIndexIfExists(knex, 'lead_captures', 'lead_captures_tenant_email_idx')
    await dropIndexIfExists(knex, 'lead_captures', 'lead_captures_tenant_phone_idx')
    await dropIndexIfExists(knex, 'lead_captures', 'lead_captures_tenant_campaign_status_idx')

    await dropIndexIfExists(knex, 'lead_campaigns', 'lead_campaigns_tenant_code_idx')
    await dropIndexIfExists(knex, 'lead_campaigns', 'lead_campaigns_tenant_status_idx')
    await dropIndexIfExists(knex, 'lead_campaigns', 'lead_campaigns_tenant_code_unique', true)
  },
}