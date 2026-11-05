const TABLE_NAME = 'tenants';
const INDEX_NAME = 'tenants_code_ci_unique';
const EXPECTED_EXPRESSION_PATTERNS = [
  'lower(btrim((code)::text))',
  'lower(btrim(code))',
];

async function hasTable(knex, tableName) {
  try {
    return await knex.schema.hasTable(tableName);
  } catch {
    return false;
  }
}

function isPostgres(knex) {
  const client = String(knex?.client?.config?.client || '').toLowerCase();
  return client.includes('pg') || client.includes('postgres');
}

function normalizeSql(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

function isExpectedIndexDefinition(indexDef) {
  const normalized = normalizeSql(indexDef);
  if (!normalized.includes(`index ${INDEX_NAME}`)) return false;
  if (!normalized.includes(`on public.${TABLE_NAME}`) && !normalized.includes(`on ${TABLE_NAME}`)) return false;
  return EXPECTED_EXPRESSION_PATTERNS.some((pattern) => normalized.includes(pattern));
}

async function getIndexMeta(knex) {
  const result = await knex.raw(
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
        AND tbl.relname = ?
        AND idx.relname = ?
      LIMIT 1
    `,
    [TABLE_NAME, INDEX_NAME],
  );

  const rows = Array.isArray(result?.rows) ? result.rows : [];
  return rows[0] || null;
}

function validateExistingIndexOrThrow(meta) {
  if (!meta) return;

  if (!meta.indisunique) {
    throw new Error(`[tenant-code-unique] Existing index "${INDEX_NAME}" is not unique`);
  }

  if (!meta.indisvalid || !meta.indisready) {
    throw new Error(
      `[tenant-code-unique] Existing index "${INDEX_NAME}" is not ready/valid (indisready=${Boolean(meta.indisready)}, indisvalid=${Boolean(meta.indisvalid)})`,
    );
  }

  if (!isExpectedIndexDefinition(meta.indexdef)) {
    throw new Error(
      `[tenant-code-unique] Existing index "${INDEX_NAME}" has unexpected definition: ${String(meta.indexdef || '')}`,
    );
  }
}

async function runPrecheckOrThrow(knex) {
  const duplicateResult = await knex.raw(
    `
      SELECT lower(btrim(code)) AS normalized_code, count(*)::int AS total
      FROM public.tenants
      WHERE code IS NOT NULL
      GROUP BY lower(btrim(code))
      HAVING count(*) > 1
      ORDER BY total DESC, normalized_code
      LIMIT 10
    `,
  );
  const duplicateRows = Array.isArray(duplicateResult?.rows) ? duplicateResult.rows : [];
  if (duplicateRows.length > 0) {
    throw new Error(
      `[tenant-code-unique] Pre-check failed: duplicate normalized tenant codes found (${duplicateRows.length} group(s))`,
    );
  }

  const dataQualityResult = await knex.raw(
    `
      SELECT
        SUM(CASE WHEN code IS NULL THEN 1 ELSE 0 END)::int AS null_code_count,
        SUM(CASE WHEN code IS NOT NULL AND btrim(code) = '' THEN 1 ELSE 0 END)::int AS empty_code_count,
        SUM(CASE WHEN code IS NOT NULL AND code <> btrim(code) THEN 1 ELSE 0 END)::int AS trim_mismatch_count
      FROM public.tenants
    `,
  );
  const quality = (Array.isArray(dataQualityResult?.rows) ? dataQualityResult.rows[0] : null) || {};
  const nullCount = Number(quality.null_code_count || 0);
  const emptyCount = Number(quality.empty_code_count || 0);
  const trimMismatchCount = Number(quality.trim_mismatch_count || 0);

  if (nullCount > 0 || emptyCount > 0 || trimMismatchCount > 0) {
    throw new Error(
      `[tenant-code-unique] Pre-check failed: null=${nullCount}, empty=${emptyCount}, trimMismatch=${trimMismatchCount}`,
    );
  }
}

module.exports = {
  async up(knex) {
    if (!isPostgres(knex)) return;
    if (!(await hasTable(knex, TABLE_NAME))) return;

    await runPrecheckOrThrow(knex);

    const existing = await getIndexMeta(knex);
    if (existing) {
      validateExistingIndexOrThrow(existing);
      return;
    }

    await knex.raw(
      `CREATE UNIQUE INDEX ${INDEX_NAME} ON public.${TABLE_NAME} (lower(btrim(code))) WHERE code IS NOT NULL`,
    );

    const created = await getIndexMeta(knex);
    if (!created) {
      throw new Error(`[tenant-code-unique] Expected index "${INDEX_NAME}" to exist after creation`);
    }
    validateExistingIndexOrThrow(created);
  },

  async down(knex) {
    if (!isPostgres(knex)) return;
    if (!(await hasTable(knex, TABLE_NAME))) return;

    await knex.raw(`DROP INDEX IF EXISTS public.${INDEX_NAME}`);
  },
};
