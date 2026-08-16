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

  const tables = [
    'up_users',
    'up_roles',
    'user_tenants',
    'user_tenants_user_lnk',
    'user_tenants_tenant_lnk',
    'user_tenant_roles',
    'user_tenant_roles_user_tenant_lnk',
    'user_tenant_roles_role_lnk',
    'role_features',
    'role_features_feature_lnk',
    'features',
  ]

  const result = {}
  for (const table of tables) {
    result[table] = (await client.query(`
      select column_name, data_type, is_nullable, column_default
      from information_schema.columns
      where table_schema='public' and table_name=$1
      order by ordinal_position asc
    `, [table])).rows
  }

  console.log(JSON.stringify(result, null, 2))
  await client.end()
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})