const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

process.env.STRAVA_SYNC_RUNNER_ENABLED = 'false';
process.env.STRAVA_WEBHOOK_RUNNER_ENABLED = 'false';

const TENANT_UID = 'api::tenant.tenant';
const TENANT_DOMAIN_UID = 'api::tenant-domain.tenant-domain';

let app;
let tenantResolverFactory;

function uniqueKey(prefix) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

async function destroyEntity(uid, id) {
  if (!id) return;
  try {
    await app.db.query(uid).delete({ where: { id } });
  } catch {
    // ignore cleanup failure in shared dev DB
  }
}

async function findAnyActiveTenant() {
  return app.db.query(TENANT_UID).findOne({
    where: {
      tenantStatus: 'active',
    },
    select: ['id', 'code'],
    orderBy: { id: 'desc' },
  });
}

function buildCtx(params = {}) {
  const headers = {};
  if (params.tenantCodeHeader !== undefined) {
    headers['x-tenant-code'] = params.tenantCodeHeader;
  }
  if (params.origin !== undefined) {
    headers.origin = params.origin;
  }
  if (params.forwardedHost !== undefined) {
    headers['x-forwarded-host'] = params.forwardedHost;
  }

  const requestPath = params.path || '/api/tenant-config/public/test-key';
  const requestHost = params.host || '127.0.0.1';

  const ctx = {
    state: {},
    request: {
      path: requestPath,
      host: requestHost,
      headers,
      header: { ...headers },
    },
    path: requestPath,
    host: requestHost,
    get(name) {
      return this.request.headers[String(name || '').toLowerCase()] || '';
    },
    throw(status, message) {
      const error = new Error(message || 'error');
      error.status = status;
      throw error;
    },
  };

  return ctx;
}

async function runResolver(middleware, ctx) {
  let nextCalled = false;
  await middleware(ctx, async () => {
    nextCalled = true;
  });
  return { nextCalled };
}

before(async () => {
  const { createStrapi, compileStrapi } = require('@strapi/strapi');
  const appContext = await compileStrapi();
  app = await createStrapi(appContext).load();
  tenantResolverFactory = require(path.join(__dirname, '..', 'dist', 'src', 'middlewares', 'tenant-resolver.js')).default;
});

after(async () => {
  if (app) await app.destroy();
});

test('Tenant resolver uses case-insensitive lookup for x-tenant-code (lower/upper/mixed)', async () => {
  const tenant = await findAnyActiveTenant();
  assert.ok(tenant?.id, 'Expected at least one active tenant in DB');
  const code = String(tenant.code || '').trim();
  assert.ok(code, 'Expected active tenant to have code');

  const middleware = tenantResolverFactory({}, { strapi: app });

  const lowerCtx = buildCtx({ tenantCodeHeader: code.toLowerCase() });
  const lowerResult = await runResolver(middleware, lowerCtx);
  assert.equal(lowerResult.nextCalled, true);
  assert.equal(lowerCtx.state.tenantId, tenant.id);
  assert.equal(String(lowerCtx.state.tenantCode).toLowerCase(), code.toLowerCase());

  const upperCtx = buildCtx({ tenantCodeHeader: code.toUpperCase() });
  const upperResult = await runResolver(middleware, upperCtx);
  assert.equal(upperResult.nextCalled, true);
  assert.equal(upperCtx.state.tenantId, tenant.id);
  assert.equal(String(upperCtx.state.tenantCode).toLowerCase(), code.toLowerCase());

  const mixed = code
    .split('')
    .map((char, index) => (index % 2 === 0 ? char.toUpperCase() : char.toLowerCase()))
    .join('');
  const mixedCtx = buildCtx({ tenantCodeHeader: mixed });
  const mixedResult = await runResolver(middleware, mixedCtx);
  assert.equal(mixedResult.nextCalled, true);
  assert.equal(mixedCtx.state.tenantId, tenant.id);
  assert.equal(String(mixedCtx.state.tenantCode).toLowerCase(), code.toLowerCase());
});

test('Tenant resolver does not fallback to host tenant when x-tenant-code is explicit but not found', async () => {
  const cleanup = [];
  const domainTenant = await findAnyActiveTenant();
  assert.ok(domainTenant?.id, 'Expected at least one active tenant in DB');
  const domainHost = `${uniqueKey('resolver-host').toLowerCase()}.example.test`;

  const tenantDomain = await app.db.query(TENANT_DOMAIN_UID).create({
    data: {
      domain: domainHost,
      tenantDomainStatus: 'active',
      isPrimary: true,
      tenant: domainTenant.id,
    },
    select: ['id'],
  });
  cleanup.push(() => destroyEntity(TENANT_DOMAIN_UID, tenantDomain.id));

  try {
    const middleware = tenantResolverFactory({}, { strapi: app });
    const ctx = buildCtx({
      host: domainHost,
      tenantCodeHeader: `missing-${uniqueKey('tenant')}`,
    });

    const result = await runResolver(middleware, ctx);
    assert.equal(result.nextCalled, true);
    assert.equal(ctx.state.tenantId, null);
    assert.equal(ctx.state.tenant, null);
    assert.equal(ctx.state.tenantSource, null);
  } finally {
    for (const job of cleanup.reverse()) await job();
  }
});

test('Tenant resolver rejects ambiguous case-insensitive matches and writes audit log', async () => {
  const conflictCode = uniqueKey('tenant-conflict').toLowerCase();
  const middleware = tenantResolverFactory({}, {
    strapi: {
      ...app,
      db: {
        ...app.db,
        query(uid) {
          if (uid === TENANT_UID) {
            return {
              findMany: async (params) => {
                const requestedCode = String(params?.where?.code?.$eqi || '').toLowerCase();
                if (requestedCode === conflictCode) {
                  return [
                    { id: 900001, code: conflictCode, tenantStatus: 'active' },
                    { id: 900002, code: conflictCode.toUpperCase(), tenantStatus: 'active' },
                  ];
                }
                return [];
              },
            };
          }
          return app.db.query(uid);
        },
      },
      log: app.log,
    },
  });

  const originalWarn = app.log.warn?.bind(app.log);
  const auditLogs = [];
  app.log.warn = (...args) => {
    if (args[0] === '[tenant-resolver] tenant code conflict') {
      auditLogs.push(args[1]);
    }
    if (originalWarn) return originalWarn(...args);
    return undefined;
  };

  try {
    const ctx = buildCtx({ tenantCodeHeader: conflictCode.toUpperCase() });
    await assert.rejects(
      () => middleware(ctx, async () => {}),
      (error) => error?.status === 409 && String(error?.message || '').includes('Tenant code conflict'),
    );

    assert.equal(ctx.state.tenantConflict, true);
    assert.equal(auditLogs.length, 1);
    assert.equal(auditLogs[0]?.reason, 'tenant_code_case_insensitive_conflict');
    assert.equal(auditLogs[0]?.tenantCode, conflictCode);
    assert.deepEqual(auditLogs[0]?.matchedTenantIds, [900001, 900002]);
  } finally {
    app.log.warn = originalWarn;
  }
});

test('Tenant schema/index metadata exposes valid functional unique index for case-insensitive code', async () => {
  const result = await app.db.connection.raw(`
    SELECT
      idx.relname AS indexname,
      ix.indisunique,
      ix.indisvalid,
      ix.indisready,
      pg_get_indexdef(idx.oid) AS indexdef
    FROM pg_class tbl
    JOIN pg_namespace ns ON ns.oid = tbl.relnamespace
    JOIN pg_index ix ON ix.indrelid = tbl.oid
    JOIN pg_class idx ON idx.oid = ix.indexrelid
    WHERE ns.nspname = current_schema()
      AND tbl.relname = 'tenants'
      AND idx.relname = 'tenants_code_ci_unique'
    LIMIT 1
  `);

  const rows = Array.isArray(result?.rows) ? result.rows : [];
  assert.equal(rows.length, 1, 'Expected tenants_code_ci_unique index to exist');

  const index = rows[0] || {};
  const definition = String(index?.indexdef || '').toLowerCase().replace(/\s+/g, ' ').trim();

  assert.equal(Boolean(index?.indisunique), true, 'Expected tenants_code_ci_unique to be unique');
  assert.equal(Boolean(index?.indisvalid), true, 'Expected tenants_code_ci_unique to be valid');
  assert.equal(Boolean(index?.indisready), true, 'Expected tenants_code_ci_unique to be ready');
  assert.equal(
    definition.includes('lower(btrim((code)::text))') || definition.includes('lower(btrim(code))'),
    true,
    `Expected tenants_code_ci_unique definition to use lower(btrim(code)); got: ${definition}`,
  );
});
