const fs = require('fs')
const path = require('path')
const knexFactory = require('knex')

const env = {}
for (const rawLine of fs.readFileSync('.env', 'utf8').split(/\r?\n/)) {
  const line = rawLine.trim()
  if (!line || line.startsWith('#')) continue
  const idx = line.indexOf('=')
  if (idx === -1) continue
  env[line.slice(0, idx).trim()] = line.slice(idx + 1).trim()
}

const migrationNames = [
  '20260806_001_add_exam_registration_payment_snapshots.js',
  '20260806_002_add_exam_registration_uniqueness_shadows.js',
]

async function main() {
  const knex = knexFactory({
    client: 'pg',
    connection: {
      host: env.DATABASE_HOST,
      port: Number(env.DATABASE_PORT || 5432),
      database: env.DATABASE_NAME,
      user: env.DATABASE_USERNAME,
      password: env.DATABASE_PASSWORD,
      ssl: String(env.DATABASE_SSL || '').toLowerCase() === 'true' ? { rejectUnauthorized: false } : false,
    },
  })

  const result = []

  try {
    for (const migrationName of migrationNames) {
      const migrationPath = path.join(process.cwd(), 'database', 'migrations', migrationName)
      const migration = require(migrationPath)
      await migration.up(knex)
      result.push({ migrationName, status: 'applied' })
    }

    const payload = { ok: true, migrations: result }
    fs.writeFileSync(path.join(process.cwd(), '.tmp-run-exam-registration-migrations.result.json'), JSON.stringify(payload, null, 2))
    console.log(JSON.stringify(payload, null, 2))
    await knex.destroy()
    process.exit(0)
  } catch (error) {
    const payload = {
      ok: false,
      migrations: result,
      message: String(error?.message || error),
      stack: String(error?.stack || ''),
      code: error?.code || null,
    }
    fs.writeFileSync(path.join(process.cwd(), '.tmp-run-exam-registration-migrations.result.json'), JSON.stringify(payload, null, 2))
    console.error(payload)
    await knex.destroy()
    process.exit(1)
  }
}

main()