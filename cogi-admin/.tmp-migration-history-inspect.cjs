const fs = require('fs')
const { Client } = require('pg')

const env = {}
for (const rawLine of fs.readFileSync('.env', 'utf8').split(/\r?\n/)) {
  const line = rawLine.trim()
  if (!line || line.startsWith('#')) continue
  const idx = line.indexOf('=')
  if (idx === -1) continue
  env[line.slice(0, idx).trim()] = line.slice(idx + 1).trim()
}

async function main() {
  const client = new Client({
    host: env.DATABASE_HOST,
    port: Number(env.DATABASE_PORT || 5432),
    database: env.DATABASE_NAME,
    user: env.DATABASE_USERNAME,
    password: env.DATABASE_PASSWORD,
    ssl: String(env.DATABASE_SSL || '').toLowerCase() === 'true' ? { rejectUnauthorized: false } : false,
  })

  await client.connect()

  const tables = await client.query(`
    select table_name
    from information_schema.tables
    where table_schema='public'
      and (
        table_name ilike '%migration%'
        or table_name ilike 'strapi_%schema%'
      )
    order by table_name asc
  `)

  const result = {}
  for (const row of tables.rows) {
    const tableName = row.table_name
    const sample = await client.query(`select * from ${tableName} order by 1 desc limit 20`)
    result[tableName] = sample.rows
  }

  console.log(JSON.stringify(result, null, 2))
  await client.end()
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})