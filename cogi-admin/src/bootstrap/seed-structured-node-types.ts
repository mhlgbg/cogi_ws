const STRUCTURED_NODE_TYPE_UID = 'api::structured-node-type.structured-node-type'

const DEFAULT_NODE_TYPES = [
  { typeCode: 'section', title: 'Section', description: 'Section container node for grouping related content.' },
  { typeCode: 'grade', title: 'Grade', description: 'Grade-level node for an educational progression.' },
  { typeCode: 'domain', title: 'Domain', description: 'Domain grouping beneath a grade or section.' },
  { typeCode: 'strand', title: 'Strand', description: 'Strand or learning track within a domain.' },
  { typeCode: 'topic', title: 'Topic', description: 'Topic node used for curriculum content grouping.' },
  { typeCode: 'content', title: 'Content', description: 'Core content node with instructional materials.' },
  { typeCode: 'requirement', title: 'Requirement', description: 'Requirement definition or rule attached to a node.' },
  { typeCode: 'criterion', title: 'Criterion', description: 'Criteria used for evaluating or scoring a requirement.' },
  { typeCode: 'paragraph', title: 'Paragraph', description: 'Narrative or explanatory paragraph content.' },
  { typeCode: 'group', title: 'Group', description: 'Logical grouping node for organizing multiple children.' },
]

async function ensureUniqueTypeCodeIndex(strapi: any) {
  const knex = strapi.db.connection

  if (!knex || typeof knex.schema?.hasTable !== 'function') {
    return
  }

  const hasTable = await knex.schema.hasTable('structured_node_types')
  if (!hasTable) {
    return
  }

  const hasColumn = await knex.schema.hasColumn('structured_node_types', 'type_code')
  if (!hasColumn) {
    return
  }

  const client = String(knex?.client?.config?.client || '').toLowerCase()

  if (client.includes('pg')) {
    await knex.raw('create unique index if not exists structured_node_types_type_code_unique on structured_node_types ("type_code")')
    return
  }

  try {
    await knex.schema.alterTable('structured_node_types', (table: any) => {
      table.unique(['type_code'], 'structured_node_types_type_code_unique')
    })
  } catch {
    // Ignore duplicate index creation during restarts.
  }
}

export async function seedStructuredNodeTypes(strapi: any) {
  await ensureUniqueTypeCodeIndex(strapi)

  for (const definition of DEFAULT_NODE_TYPES) {
    const existing = await strapi.db.query(STRUCTURED_NODE_TYPE_UID).findOne({
      where: { typeCode: definition.typeCode },
      select: ['id', 'typeCode'],
    })

    if (existing?.id) {
      strapi.log?.info?.(`[structured-node-type] default type ${definition.typeCode} already present`)
      continue
    }

    await strapi.db.query(STRUCTURED_NODE_TYPE_UID).create({
      data: {
        typeCode: definition.typeCode,
        title: definition.title,
        description: definition.description,
        status: 'active',
        allowedParentTypes: [],
        metadata: {
          isDefault: true,
          seededAt: new Date().toISOString(),
        },
      },
    })

    strapi.log?.info?.(`[structured-node-type] seeded default type ${definition.typeCode}`)
  }
}
