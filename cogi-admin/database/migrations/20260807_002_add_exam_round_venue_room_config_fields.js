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
    if (await hasTable(knex, 'exam_venues')) {
      if (!(await hasColumn(knex, 'exam_venues', 'short_name'))) {
        await knex.schema.alterTable('exam_venues', (table) => {
          table.string('short_name', 100).nullable()
        })
      }
      if (!(await hasColumn(knex, 'exam_venues', 'contact_name'))) {
        await knex.schema.alterTable('exam_venues', (table) => {
          table.string('contact_name', 200).nullable()
        })
      }
      if (!(await hasColumn(knex, 'exam_venues', 'contact_phone'))) {
        await knex.schema.alterTable('exam_venues', (table) => {
          table.string('contact_phone', 30).nullable()
        })
      }
      if (!(await hasColumn(knex, 'exam_venues', 'sort_order'))) {
        await knex.schema.alterTable('exam_venues', (table) => {
          table.integer('sort_order').notNullable().defaultTo(0)
        })
      }
    }

    if (await hasTable(knex, 'exam_rooms')) {
      if (!(await hasColumn(knex, 'exam_rooms', 'floor'))) {
        await knex.schema.alterTable('exam_rooms', (table) => {
          table.string('floor', 50).nullable()
        })
      }
      if (!(await hasColumn(knex, 'exam_rooms', 'sort_order'))) {
        await knex.schema.alterTable('exam_rooms', (table) => {
          table.integer('sort_order').notNullable().defaultTo(0)
        })
      }
    }
  },

  async down(knex) {
    if (await hasTable(knex, 'exam_rooms')) {
      for (const columnName of ['sort_order', 'floor']) {
        if (await hasColumn(knex, 'exam_rooms', columnName)) {
          await knex.schema.alterTable('exam_rooms', (table) => {
            table.dropColumn(columnName)
          })
        }
      }
    }

    if (await hasTable(knex, 'exam_venues')) {
      for (const columnName of ['sort_order', 'contact_phone', 'contact_name', 'short_name']) {
        if (await hasColumn(knex, 'exam_venues', columnName)) {
          await knex.schema.alterTable('exam_venues', (table) => {
            table.dropColumn(columnName)
          })
        }
      }
    }
  },
}
