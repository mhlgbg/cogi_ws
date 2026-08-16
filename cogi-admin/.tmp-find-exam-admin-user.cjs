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

  const rows = await client.query(`
    select distinct
      u.id,
      u.username,
      u.email,
      t.id as tenant_id,
      t.code as tenant_code,
      ur.id as user_tenant_role_id,
      tr.type as role_type,
      f.key as feature_key
    from up_users u
    join user_tenants_user_lnk utul on utul.user_id = u.id
    join user_tenants ut on ut.id = utul.user_tenant_id and ut.user_tenant_status = 'active'
    join user_tenants_tenant_lnk uttl on uttl.user_tenant_id = ut.id
    join tenants t on t.id = uttl.tenant_id
    join user_tenant_roles_user_tenant_lnk utrul on utrul.user_tenant_id = ut.id
    join user_tenant_roles ur on ur.id = utrul.user_tenant_role_id and ur.user_tenant_role_status = 'active'
    join user_tenant_roles_role_lnk urrl on urrl.user_tenant_role_id = ur.id
    join up_roles tr on tr.id = urrl.role_id
    join role_features_role_lnk rfrl on rfrl.role_id = tr.id
    join role_features rf on rf.id = rfrl.role_feature_id
    join role_features_feature_lnk rff on rff.role_feature_id = rf.id
    join features f on f.id = rff.feature_id
    where t.code = 'cogi'
      and f.key in ('exam-round.manage', 'exam-round.approve')
    order by u.id asc
    limit 10
  `)

  console.log(JSON.stringify(rows.rows, null, 2))
  await client.end()
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
