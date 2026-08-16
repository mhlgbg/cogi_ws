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

  try {
    const [batch, migrations] = await knex.migrate.latest({
      directory: path.join(process.cwd(), 'database', 'migrations'),
      tableName: 'knex_migrations',
    })
    const payload = { ok: true, batch, migrations }
    fs.writeFileSync('.tmp-run-knex-migrations-direct.result.json', JSON.stringify(payload, null, 2))
    console.log(JSON.stringify(payload, null, 2))
    await knex.destroy()
    process.exit(0)
  } catch (error) {
    const payload = { ok: false, message: String(error?.message || error), stack: String(error?.stack || ''), code: error?.code || null }
    fs.writeFileSync('.tmp-run-knex-migrations-direct.result.json', JSON.stringify(payload, null, 2))
    console.error(payload)
    await knex.destroy()
    process.exit(1)
  }
}

main()