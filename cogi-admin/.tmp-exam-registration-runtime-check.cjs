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
  const env = readEnv(path.join(process.cwd(), ".env"));
  const client = new Client({
    host: env.DATABASE_HOST,
    port: Number(env.DATABASE_PORT || 5432),
    database: env.DATABASE_NAME,
    user: env.DATABASE_USERNAME,
    password: env.DATABASE_PASSWORD,
    ssl: String(env.DATABASE_SSL || "").toLowerCase() === "true" ? { rejectUnauthorized: false } : false,
  });
  await client.connect();
  const feature = await client.query("select id, key from features where key in ('exam-round.manage', 'exam-registration.self') order by key asc");
  const roles = await client.query(`
    select distinct tr.id, tr.code, tr.name
    from tenant_roles tr
    join role_features rf on rf.role_id = tr.id
    join features f on f.id = rf.feature_id
    where f.key = 'exam-round.manage'
    order by tr.id asc
  `);
  const user = await client.query("select id, username, email from up_users where lower(username)=lower($1)", ['nddan']);
  const learners = await client.query(`
    select l.id, l.code, l.full_name, l.learner_status, t.id as tenant_id, t.code as tenant_code, t.name as tenant_name
    from learners l
    join tenants t on t.id = l.tenant_id
    join up_users u on u.id = l.user_id
    where lower(u.username)=lower($1)
    order by l.id asc
  `, ['nddan']);
  const rounds = await client.query(`
    select er.id, er.code, er.name, er.status, er.registration_mode, er.registration_start_at, er.registration_end_at, t.code as tenant_code
    from exam_rounds er
    join tenants t on t.id = er.tenant_id
    where t.code = 'cogi'
    order by er.id desc
    limit 10
  `);
  console.log(JSON.stringify({ feature: feature.rows, roles: roles.rows, user: user.rows, learners: learners.rows, rounds: rounds.rows }, null, 2));
  await client.end();
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
