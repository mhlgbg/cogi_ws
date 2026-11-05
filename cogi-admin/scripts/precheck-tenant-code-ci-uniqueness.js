const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

const INDEX_NAME = 'tenants_code_ci_unique';
const TABLE_NAME = 'tenants';
const EXPECTED_EXPRESSION_PATTERNS = [
  'lower(btrim((code)::text))',
  'lower(btrim(code))',
];

function parseDotEnv(filePath) {
  const output = {};
  const content = fs.readFileSync(filePath, 'utf8');
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const separator = line.indexOf('=');
    if (separator < 0) continue;
    const key = line.slice(0, separator).trim();
    const value = line.slice(separator + 1).trim();
    output[key] = value;
  }
  return output;
}

function normalizeSql(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

function isExpectedDefinition(indexdef) {
  const normalized = normalizeSql(indexdef);
  if (!normalized.includes(`index ${INDEX_NAME}`)) return false;
  if (!normalized.includes(' on public.tenants ') && !normalized.includes(' on tenants ')) return false;
  return EXPECTED_EXPRESSION_PATTERNS.some((pattern) => normalized.includes(pattern));
}

async function main() {
  const rootDir = path.resolve(__dirname, '..');
  const envPath = path.join(rootDir, '.env');
  const env = parseDotEnv(envPath);
  const clientName = String(env.DATABASE_CLIENT || '').toLowerCase();

  if (!clientName.includes('pg') && !clientName.includes('postgres')) {
    console.log(
      JSON.stringify(
        {
          ok: false,
          reason: 'unsupported_database',
          databaseClient: env.DATABASE_CLIENT || null,
          message: 'This pre-check supports PostgreSQL only',
        },
        null,
        2,
      ),
    );
    process.exitCode = 2;
    return;
  }

  const client = new Client({
    connectionString: env.DATABASE_URL || undefined,
    host: env.DATABASE_HOST || '127.0.0.1',
    port: Number(env.DATABASE_PORT || 5432),
    database: env.DATABASE_NAME,
    user: env.DATABASE_USERNAME,
    password: env.DATABASE_PASSWORD,
    ssl: String(env.DATABASE_SSL || '').toLowerCase() === 'true' ? { rejectUnauthorized: false } : false,
  });

  await client.connect();

  try {
    const schemaResult = await client.query('SELECT current_schema() AS schema_name');
    const schemaName = schemaResult.rows?.[0]?.schema_name || 'public';

    const duplicateResult = await client.query(`
      SELECT lower(btrim(code)) AS normalized_code, count(*)::int AS total, array_agg(id ORDER BY id) AS tenant_ids
      FROM public.tenants
      WHERE code IS NOT NULL
      GROUP BY lower(btrim(code))
      HAVING count(*) > 1
      ORDER BY total DESC, normalized_code
      LIMIT 20
    `);

    const qualityResult = await client.query(`
      SELECT
        count(*)::int AS total_rows,
        sum(CASE WHEN code IS NULL THEN 1 ELSE 0 END)::int AS null_code_count,
        sum(CASE WHEN code IS NOT NULL AND btrim(code) = '' THEN 1 ELSE 0 END)::int AS empty_trimmed_code_count,
        sum(CASE WHEN code IS NOT NULL AND code <> btrim(code) THEN 1 ELSE 0 END)::int AS trim_mismatch_count
      FROM public.tenants
    `);

    const quality = qualityResult.rows?.[0] || {};

    const trimSamples = await client.query(`
      SELECT id, code
      FROM public.tenants
      WHERE code IS NOT NULL AND code <> btrim(code)
      ORDER BY id
      LIMIT 20
    `);

    const indexResult = await client.query(
      `
        SELECT
          idx.relname AS index_name,
          ix.indisunique,
          ix.indisvalid,
          ix.indisready,
          pg_get_indexdef(idx.oid) AS indexdef
        FROM pg_class tbl
        JOIN pg_namespace ns ON ns.oid = tbl.relnamespace
        JOIN pg_index ix ON ix.indrelid = tbl.oid
        JOIN pg_class idx ON idx.oid = ix.indexrelid
        WHERE ns.nspname = current_schema()
          AND tbl.relname = $1
          AND idx.relname = $2
        LIMIT 1
      `,
      [TABLE_NAME, INDEX_NAME],
    );

    const indexMeta = indexResult.rows?.[0] || null;
    const indexDefinitionMatches = indexMeta ? isExpectedDefinition(indexMeta.indexdef) : false;

    const failReasons = [];
    if ((duplicateResult.rows || []).length > 0) failReasons.push('duplicate_normalized_code');
    if (Number(quality.null_code_count || 0) > 0) failReasons.push('null_code');
    if (Number(quality.empty_trimmed_code_count || 0) > 0) failReasons.push('empty_trimmed_code');
    if (Number(quality.trim_mismatch_count || 0) > 0) failReasons.push('trim_mismatch');

    if (indexMeta) {
      if (!indexMeta.indisunique) failReasons.push('index_not_unique');
      if (!indexMeta.indisvalid) failReasons.push('index_not_valid');
      if (!indexMeta.indisready) failReasons.push('index_not_ready');
      if (!indexDefinitionMatches) failReasons.push('index_definition_mismatch');
    }

    const output = {
      ok: failReasons.length === 0,
      database: {
        client: env.DATABASE_CLIENT || null,
        host: env.DATABASE_HOST || null,
        port: Number(env.DATABASE_PORT || 5432),
        name: env.DATABASE_NAME || null,
        schema: schemaName,
      },
      checks: {
        duplicateNormalizedCode: duplicateResult.rows || [],
        dataQuality: {
          totalRows: Number(quality.total_rows || 0),
          nullCodeCount: Number(quality.null_code_count || 0),
          emptyTrimmedCodeCount: Number(quality.empty_trimmed_code_count || 0),
          trimMismatchCount: Number(quality.trim_mismatch_count || 0),
          trimMismatchSamples: trimSamples.rows || [],
        },
        indexStatus: {
          expectedIndexName: INDEX_NAME,
          exists: Boolean(indexMeta),
          isUnique: Boolean(indexMeta?.indisunique),
          isValid: Boolean(indexMeta?.indisvalid),
          isReady: Boolean(indexMeta?.indisready),
          definitionMatches: indexDefinitionMatches,
          indexDefinition: indexMeta?.indexdef || null,
        },
      },
      failReasons,
    };

    console.log(JSON.stringify(output, null, 2));
    process.exitCode = failReasons.length === 0 ? 0 : 1;
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(
    JSON.stringify(
      {
        ok: false,
        reason: 'execution_error',
        message: error?.message || String(error),
      },
      null,
      2,
    ),
  );
  process.exitCode = 1;
});
