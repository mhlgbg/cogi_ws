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

async function createIndex(knex, sql) {
  try {
    await knex.raw(sql)
  } catch {
    // ignore repeated attempts
  }
}

module.exports = {
  async up(knex) {
    if (!(await hasTable(knex, 'exam_registrations'))) return

    if (!(await hasColumn(knex, 'exam_registrations', 'tenant_scope_id'))) {
      await knex.schema.alterTable('exam_registrations', (table) => {
        table.integer('tenant_scope_id').unsigned().nullable()
      })
    }

    if (!(await hasColumn(knex, 'exam_registrations', 'exam_round_scope_id'))) {
      await knex.schema.alterTable('exam_registrations', (table) => {
        table.integer('exam_round_scope_id').unsigned().nullable()
      })
    }

    if (!(await hasColumn(knex, 'exam_registrations', 'learner_scope_id'))) {
      await knex.schema.alterTable('exam_registrations', (table) => {
        table.integer('learner_scope_id').unsigned().nullable()
      })
    }

    await knex.raw(`
      update exam_registrations er
      set
        tenant_scope_id = snapshot.tenant_id,
        exam_round_scope_id = snapshot.exam_round_id,
        learner_scope_id = snapshot.learner_id
      from (
        select
          tl.exam_registration_id,
          max(tl.tenant_id) as tenant_id,
          max(rl.exam_round_id) as exam_round_id,
          max(ll.learner_id) as learner_id
        from exam_registrations_tenant_lnk tl
        left join exam_registrations_exam_round_lnk rl on rl.exam_registration_id = tl.exam_registration_id
        left join exam_registrations_learner_lnk ll on ll.exam_registration_id = tl.exam_registration_id
        group by tl.exam_registration_id
      ) as snapshot
      where snapshot.exam_registration_id = er.id
        and (
          er.tenant_scope_id is distinct from snapshot.tenant_id
          or er.exam_round_scope_id is distinct from snapshot.exam_round_id
          or er.learner_scope_id is distinct from snapshot.learner_id
        )
    `)

    await createIndex(knex, `create index if not exists exam_registrations_tenant_scope_idx on exam_registrations (tenant_scope_id)`)
    await createIndex(knex, `create index if not exists exam_registrations_exam_round_scope_idx on exam_registrations (exam_round_scope_id)`)
    await createIndex(knex, `create index if not exists exam_registrations_learner_scope_idx on exam_registrations (learner_scope_id)`)
    await createIndex(knex, `create unique index if not exists exam_registrations_tenant_round_learner_uniq on exam_registrations (tenant_scope_id, exam_round_scope_id, learner_scope_id) where tenant_scope_id is not null and exam_round_scope_id is not null and learner_scope_id is not null`)
    await createIndex(knex, `create unique index if not exists exam_registrations_tenant_registration_code_uniq on exam_registrations (tenant_scope_id, registration_code) where tenant_scope_id is not null and registration_code is not null`)
  },

  async down(knex) {
    if (!(await hasTable(knex, 'exam_registrations'))) return

    for (const indexName of [
      'exam_registrations_tenant_scope_idx',
      'exam_registrations_exam_round_scope_idx',
      'exam_registrations_learner_scope_idx',
      'exam_registrations_tenant_round_learner_uniq',
      'exam_registrations_tenant_registration_code_uniq',
    ]) {
      try {
        await knex.raw(`drop index if exists ${indexName}`)
      } catch {
        // ignore
      }
    }
  },
}