async function dropIndexIfExists(knex, indexName) {
  const client = String(knex?.client?.config?.client || '').toLowerCase()
  if (!client.includes('pg')) return

  try {
    await knex.raw(`drop index if exists public.${indexName}`)
  } catch {
    // ignore if already absent or not droppable in current state
  }
}

module.exports = {
  async up(knex) {
    await dropIndexIfExists(knex, 'survey_answers_documents_idx')
  },

  async down() {
    // no-op: Strapi schema sync will recreate the expected index when needed
  },
}
