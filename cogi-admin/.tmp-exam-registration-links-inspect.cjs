const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

function readEnv(filePath) {
  const env = {};
  for (const rawLine of fs.readFileSync(filePath, 'utf8').split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const idx = line.indexOf('=');
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

  const tableRows = await client.query(`
    select table_name
    from information_schema.tables
    where table_schema = 'public'
      and (
        table_name like 'exam_registrations_%_lnk'
        or table_name like 'exam_registration_subjects_%_lnk'
        or table_name like 'exam_registration_components_%_lnk'
        or table_name like 'exam_rounds_%_lnk'
        or table_name like 'files_related_morphs%'
        or table_name like 'upload_file%'
      )
    order by table_name asc
  `)

  const result = {}
  for (const row of tableRows.rows) {
    const tableName = row.table_name
    const columns = await client.query(`
      select column_name, data_type
      from information_schema.columns
      where table_schema = 'public' and table_name = $1
      order by ordinal_position asc
    `, [tableName])

    let sample = []
    try {
      const query = tableName.startsWith('files_related_morphs')
        ? `select * from ${tableName} where field in ('paymentQrImageSnapshot', 'qrImage') order by 1 desc limit 20`
        : `select * from ${tableName} order by 1 desc limit 10`
      sample = (await client.query(query)).rows
    } catch (error) {
      sample = [{ error: String(error.message || error) }]
    }

    result[tableName] = {
      columns: columns.rows,
      sample,
    }
  }

  console.log(JSON.stringify(result, null, 2))
  await client.end()
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})