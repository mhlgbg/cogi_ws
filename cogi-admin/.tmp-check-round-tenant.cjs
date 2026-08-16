const fs = require('fs')
const path = require('path')
const { Client } = require('pg')

function readEnv(filePath) {
  const env = {}
  for (const rawLine of fs.readFileSync(filePath, 'utf8').split(/\r?\n/)) {
    const line = rawLine.trim()
    if (!line || line.startsWith('#')) continue
    const idx = line.indexOf('=')
    if (idx === -1) continue
    env[line.slice(0, idx).trim()] = line.slice(idx + 1).trim()
  }
  return env
}

async function main() {
  const env = readEnv(path.join(process.cwd(), '.env'))
  const client = new Client({
    host: env.DATABASE_HOST,
    port: Number(env.DATABASE_PORT || 5432),
    database: env.DATABASE_NAME,
    user: env.DATABASE_USERNAME,
    password: env.DATABASE_PASSWORD,
    ssl: String(env.DATABASE_SSL || '').toLowerCase() === 'true' ? { rejectUnauthorized: false } : false,
  })
  await client.connect()
  const round = await client.query(`
    select er.id, er.code, er.name, er.status, t.id as tenant_id, t.code as tenant_code, t.name as tenant_name
    from exam_rounds er
    left join exam_rounds_tenant_lnk rtl on rtl.exam_round_id = er.id
    left join tenants t on t.id = rtl.tenant_id
    where er.id = 1
  `)
  console.log(JSON.stringify(round.rows, null, 2))
  await client.end()
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
