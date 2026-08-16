const fs = require("fs");
const path = require("path");
const { Client } = require("pg");
function readEnv(filePath) {
  const env = {};
  for (const rawLine of fs.readFileSync(filePath, "utf8").split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const idx = line.indexOf("=");
    if (idx === -1) continue;
    env[line.slice(0, idx).trim()] = line.slice(idx + 1).trim();
  }
  return env;
}
async function main() {
  const env = readEnv(path.join(process.cwd(), '.env'));
  const client = new Client({
    host: env.DATABASE_HOST,
    port: Number(env.DATABASE_PORT || 5432),
    database: env.DATABASE_NAME,
    user: env.DATABASE_USERNAME,
    password: env.DATABASE_PASSWORD,
    ssl: String(env.DATABASE_SSL || '').toLowerCase() === 'true' ? { rejectUnauthorized: false } : false,
  });
  await client.connect();
  const memberships = await client.query(`
    select ut.id as user_tenant_id, ut.user_tenant_status, ut.label, t.id as tenant_id, t.code as tenant_code, t.name as tenant_name
    from user_tenants ut
    join user_tenants_user_lnk utul on utul.user_tenant_id = ut.id
    join up_users u on u.id = utul.user_id
    join user_tenants_tenant_lnk uttl on uttl.user_tenant_id = ut.id
    join tenants t on t.id = uttl.tenant_id
    where lower(u.username)=lower($1)
    order by ut.id asc
  `, ['nddan']);
  const roles = await client.query(`
    select utr.id as user_tenant_role_id, utr.user_tenant_role_status, ut.id as user_tenant_id, tr.id as tenant_role_id, tr.code, tr.label, t.code as tenant_code
    from user_tenant_roles utr
    join user_tenant_roles_user_tenant_lnk utrutl on utrutl.user_tenant_role_id = utr.id
    join user_tenants ut on ut.id = utrutl.user_tenant_id
    join user_tenants_tenant_lnk uttl on uttl.user_tenant_id = ut.id
    join tenants t on t.id = uttl.tenant_id
    join user_tenant_roles_role_lnk utrrl on utrrl.user_tenant_role_id = utr.id
    join tenant_roles tr on tr.id = utrrl.role_id
    join user_tenants_user_lnk utul on utul.user_tenant_id = ut.id
    join up_users u on u.id = utul.user_id
    where lower(u.username)=lower($1)
    order by ut.id asc, utr.id asc
  `, ['nddan']);
  console.log(JSON.stringify({ memberships: memberships.rows, roles: roles.rows }, null, 2));
  await client.end();
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
