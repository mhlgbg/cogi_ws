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

async function queryTableColumns(client, tableName) {
  const result = await client.query(
    `
      select column_name, data_type, udt_name, is_nullable, column_default
      from information_schema.columns
      where table_schema = 'public' and table_name = $1
      order by ordinal_position asc
    `,
    [tableName],
  );
  return result.rows;
}

async function queryIndexes(client, tableName) {
  const result = await client.query(
    `
      select indexname, indexdef
      from pg_indexes
      where schemaname = 'public' and tablename = $1
      order by indexname asc
    `,
    [tableName],
  );
  return result.rows;
}

async function queryForeignKeys(client, tableName) {
  const result = await client.query(
    `
      select
        tc.constraint_name,
        kcu.column_name,
        ccu.table_name as foreign_table_name,
        ccu.column_name as foreign_column_name
      from information_schema.table_constraints tc
      join information_schema.key_column_usage kcu
        on tc.constraint_name = kcu.constraint_name
       and tc.table_schema = kcu.table_schema
      join information_schema.constraint_column_usage ccu
        on ccu.constraint_name = tc.constraint_name
       and ccu.table_schema = tc.table_schema
      where tc.constraint_type = 'FOREIGN KEY'
        and tc.table_schema = 'public'
        and tc.table_name = $1
      order by tc.constraint_name asc, kcu.ordinal_position asc
    `,
    [tableName],
  );
  return result.rows;
}

async function queryTablesLike(client, patterns) {
  const clauses = patterns.map((_, index) => `table_name ilike $${index + 1}`);
  const result = await client.query(
    `
      select table_name
      from information_schema.tables
      where table_schema = 'public'
        and (${clauses.join(' or ')})
      order by table_name asc
    `,
    patterns,
  );
  return result.rows.map((row) => row.table_name);
}

async function queryRecentMorphRows(client) {
  const candidates = await queryTablesLike(client, ['%files_related%', '%upload_file%']);
  const output = {};
  for (const tableName of candidates) {
    try {
      const columns = await queryTableColumns(client, tableName);
      const columnNames = new Set(columns.map((column) => column.column_name));
      if (!columnNames.has('field')) continue;
      const result = await client.query(`select * from ${tableName} where field in ('paymentQrImageSnapshot', 'qrImage') order by 1 desc limit 20`);
      output[tableName] = result.rows;
    } catch (error) {
      output[tableName] = { error: String(error.message || error) };
    }
  }
  return output;
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

  const tables = ['exam_registrations', 'exam_registration_subjects', 'exam_registration_components', 'exam_rounds'];
  const summary = {};
  for (const tableName of tables) {
    summary[tableName] = {
      columns: await queryTableColumns(client, tableName),
      indexes: await queryIndexes(client, tableName),
      foreignKeys: await queryForeignKeys(client, tableName),
    };
  }

  const migrationTables = await queryTablesLike(client, ['%migration%']);
  const uploadRelationRows = await queryRecentMorphRows(client);

  console.log(JSON.stringify({
    tables: summary,
    migrationTables,
    uploadRelationRows,
  }, null, 2));

  await client.end();
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});