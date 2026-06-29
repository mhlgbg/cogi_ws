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

module.exports = {
  async up(knex) {
    if (!(await hasTable(knex, 'admission_applications'))) return

    if (!(await hasColumn(knex, 'admission_applications', 'student_code'))) {
      await knex.schema.alterTable('admission_applications', (table) => {
        table.string('student_code').nullable()
      })
    }

    try {
      await knex.schema.alterTable('admission_applications', (table) => {
        table.index(['student_code'], 'admission_applications_student_code_idx')
      })
    } catch {
      // ignore duplicate index attempts
    }

    try {
      await knex.schema.alterTable('admission_applications', (table) => {
        table.index(['tenant_id', 'student_code'], 'admission_applications_tenant_student_code_idx')
      })
    } catch {
      // ignore duplicate index attempts
    }
  },

  async down(knex) {
    if (!(await hasTable(knex, 'admission_applications'))) return

    try {
      await knex.schema.alterTable('admission_applications', (table) => {
        table.dropIndex([], 'admission_applications_tenant_student_code_idx')
      })
    } catch {
      try {
        await knex.raw('drop index if exists admission_applications_tenant_student_code_idx')
      } catch {
        // ignore if the index is already absent
      }
    }

    try {
      await knex.schema.alterTable('admission_applications', (table) => {
        table.dropIndex([], 'admission_applications_student_code_idx')
      })
    } catch {
      try {
        await knex.raw('drop index if exists admission_applications_student_code_idx')
      } catch {
        // ignore if the index is already absent
      }
    }

    if (await hasColumn(knex, 'admission_applications', 'student_code')) {
      await knex.schema.alterTable('admission_applications', (table) => {
        table.dropColumn('student_code')
      })
    }
  },
}