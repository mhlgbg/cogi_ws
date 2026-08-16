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
  const rows = await client.query(`
    select *
    from files_related_mph
    where field = 'paymentQrImageSnapshot'
      and related_type in ('api::exam-round.exam-round', 'api::exam-registration.exam-registration')
    order by id asc
  `)
  console.log(JSON.stringify(rows.rows, null, 2))
  await client.end()
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})