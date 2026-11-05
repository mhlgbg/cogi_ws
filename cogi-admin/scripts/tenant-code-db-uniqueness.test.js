const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

process.env.STRAVA_SYNC_RUNNER_ENABLED = 'false';
process.env.STRAVA_WEBHOOK_RUNNER_ENABLED = 'false';

const TENANT_UID = 'api::tenant.tenant';
const TENANT_CODE_CI_UNIQUE_INDEX = 'tenants_code_ci_unique';

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
    // ignore cleanup errors in shared dev DB
  }
}

function buildPlatformCtx({ body = {}, params = {} } = {}) {
  return {
    request: { body, query: {} },
    params,
    state: { user: { id: 1 } },
    status: 200,
    body: null,
    badRequest(message) {
      this.status = 400;
      this.body = { error: { message } };
      return this.body;
    },
    conflict(message) {
      this.status = 409;
      this.body = { error: { message } };
      return this.body;
    },
    notFound(message) {
      this.status = 404;
      this.body = { error: { message } };
      return this.body;
    },
    internalServerError(message) {
      this.status = 500;
      this.body = { error: { message } };
      return this.body;
    },
  };
}

async function createTenantDirect(label, code) {
  const now = new Date();
  const rows = await app.db.connection('tenants')
    .insert({
      name: `Tenant ${label}`,
      code,
      tenant_status: 'active',
      created_at: now,
      updated_at: now,
    })
    .returning(['id', 'code', 'name']);
  const row = Array.isArray(rows) ? rows[0] : rows;
  return {
    id: Number(row?.id || 0),
    code: String(row?.code || ''),
    name: String(row?.name || ''),
  };
}

async function findAnyActiveTenant() {
  return app.db.query(TENANT_UID).findOne({
    where: { tenantStatus: 'active' },
    select: ['id', 'code'],
    orderBy: { id: 'desc' },
  });
}

function buildResolverCtx(code) {
  const headers = { 'x-tenant-code': code };
  return {
    state: {},
    request: {
      path: '/api/tenant-config/public/sample',
      host: '127.0.0.1',
      headers,
      header: { ...headers },
    },
    path: '/api/tenant-config/public/sample',
    host: '127.0.0.1',
    get(name) {
      return this.request.headers[String(name || '').toLowerCase()] || '';
    },
    throw(status, message) {
      const error = new Error(message || 'error');
      error.status = status;
      throw error;
    },
  };
}

async function runResolver(middleware, ctx) {
  let called = false;
  await middleware(ctx, async () => {
    called = true;
  });
  return called;
}

function buildUniqueViolationError(constraintName) {
  const error = new Error(`duplicate key value violates unique constraint "${constraintName}"`);
  error.code = '23505';
  error.constraint = constraintName;
  return error;
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

test('tenant.code DB index is unique, valid, ready and uses lower(btrim(code)) expression', async () => {
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
      AND idx.relname = '${TENANT_CODE_CI_UNIQUE_INDEX}'
    LIMIT 1
  `);

  const rows = Array.isArray(result?.rows) ? result.rows : [];
  assert.equal(rows.length, 1, 'Expected tenants_code_ci_unique index to exist');

  const row = rows[0];
  const definition = String(row?.indexdef || '').toLowerCase().replace(/\s+/g, ' ').trim();

  assert.equal(Boolean(row?.indisunique), true);
  assert.equal(Boolean(row?.indisvalid), true);
  assert.equal(Boolean(row?.indisready), true);
  assert.equal(
    definition.includes('where code is not null') || definition.includes('where (code is not null)'),
    true,
    `Unexpected index filter: ${definition}`,
  );
  assert.equal(
    definition.includes('lower(btrim((code)::text))') || definition.includes('lower(btrim(code))'),
    true,
    `Unexpected index expression: ${definition}`,
  );
});

test('DB-level uniqueness blocks concurrent tenant creates by normalized code', async () => {
  const key = uniqueKey('tenant-ci-create');
  const sharedCode = `${key}-shared`;
  const cleanup = [];

  try {
    const [first, second] = await Promise.allSettled([
      createTenantDirect(`${key}-a`, ` ${sharedCode.toUpperCase()} `),
      createTenantDirect(`${key}-b`, sharedCode.toLowerCase()),
    ]);

    const fulfilled = [first, second].filter((item) => item.status === 'fulfilled');
    const rejected = [first, second].filter((item) => item.status === 'rejected');

    assert.equal(fulfilled.length, 1, 'Exactly one create should succeed');
    assert.equal(rejected.length, 1, 'Exactly one create should fail');

    if (fulfilled[0].status === 'fulfilled') {
      cleanup.push(() => destroyEntity(TENANT_UID, fulfilled[0].value.id));
    }

    const error = rejected[0].reason;
    assert.equal(String(error?.code || ''), '23505');
    assert.equal(String(error?.constraint || ''), TENANT_CODE_CI_UNIQUE_INDEX);
  } finally {
    for (const job of cleanup.reverse()) await job();
  }
});

test('DB-level uniqueness blocks concurrent tenant updates by normalized code', async () => {
  const key = uniqueKey('tenant-ci-update');
  const cleanup = [];
  const left = await createTenantDirect(`${key}-left`, `${key}-left`);
  const right = await createTenantDirect(`${key}-right`, `${key}-right`);
  cleanup.push(() => destroyEntity(TENANT_UID, right.id));
  cleanup.push(() => destroyEntity(TENANT_UID, left.id));

  try {
    const targetCode = `${key}-target`;
    const [first, second] = await Promise.allSettled([
      app.db.query(TENANT_UID).update({ where: { id: left.id }, data: { code: targetCode.toLowerCase() } }),
      app.db.query(TENANT_UID).update({ where: { id: right.id }, data: { code: targetCode.toUpperCase() } }),
    ]);

    const rejected = [first, second].filter((item) => item.status === 'rejected');
    assert.equal(rejected.length, 1, 'Exactly one update should fail by unique violation');
    const error = rejected[0].reason;
    assert.equal(String(error?.code || ''), '23505');
    assert.equal(String(error?.constraint || ''), TENANT_CODE_CI_UNIQUE_INDEX);
  } finally {
    for (const job of cleanup.reverse()) await job();
  }
});

test('platform.createTenant maps tenants_code_ci_unique (23505) to HTTP 409', async () => {
  const controller = app.controller('api::platform.platform');
  const originalQuery = app.db.query.bind(app.db);
  app.db.query = (uid) => {
    const repository = originalQuery(uid);
    if (uid !== TENANT_UID) return repository;
    return {
      findOne: (...args) => repository.findOne(...args),
      create: async () => {
        throw buildUniqueViolationError(TENANT_CODE_CI_UNIQUE_INDEX);
      },
    };
  };

  try {
    const key = uniqueKey('platform-map-create');
    const ctx = buildPlatformCtx({
      body: {
        name: `Tenant ${key}`,
        code: key,
        tenantStatus: 'active',
      },
    });

    await controller.createTenant(ctx);
    assert.equal(ctx.status, 409);
    assert.match(String(ctx.body?.error?.message || ''), /Tenant code da ton tai/i);
  } finally {
    app.db.query = originalQuery;
  }
});

test('platform.updateTenant maps tenants_code_ci_unique (23505) to HTTP 409', async () => {
  const controller = app.controller('api::platform.platform');
  const key = uniqueKey('platform-map-update');
  const tenant = await createTenantDirect(key, key);
  const cleanup = [() => destroyEntity(TENANT_UID, tenant.id)];

  const originalQuery = app.db.query.bind(app.db);
  app.db.query = (uid) => {
    const repository = originalQuery(uid);
    if (uid !== TENANT_UID) return repository;
    return {
      findOne: (...args) => repository.findOne(...args),
      update: async () => {
        throw buildUniqueViolationError(TENANT_CODE_CI_UNIQUE_INDEX);
      },
    };
  };

  try {
    const ctx = buildPlatformCtx({
      params: { id: tenant.id },
      body: {
        name: `Tenant ${key} Updated`,
        code: `${key}-updated`,
        tenantStatus: 'active',
      },
    });

    await controller.updateTenant(ctx);
    assert.equal(ctx.status, 409);
    assert.match(String(ctx.body?.error?.message || ''), /Tenant code da ton tai/i);
  } finally {
    app.db.query = originalQuery;
    for (const job of cleanup.reverse()) await job();
  }
});

test('platform 23505 from other constraints is not remapped to tenant conflict', async () => {
  const controller = app.controller('api::platform.platform');
  const originalQuery = app.db.query.bind(app.db);
  app.db.query = (uid) => {
    const repository = originalQuery(uid);
    if (uid !== TENANT_UID) return repository;
    return {
      findOne: (...args) => repository.findOne(...args),
      create: async () => {
        throw buildUniqueViolationError('tenants_other_unique_idx');
      },
    };
  };

  try {
    const key = uniqueKey('platform-map-other');
    const ctx = buildPlatformCtx({
      body: {
        name: `Tenant ${key}`,
        code: key,
        tenantStatus: 'active',
      },
    });

    await controller.createTenant(ctx);
    assert.equal(ctx.status, 500);
  } finally {
    app.db.query = originalQuery;
  }
});

test('tenant resolver still resolves mixed-case code after DB uniqueness changes', async () => {
  const tenant = await findAnyActiveTenant();
  assert.ok(tenant?.id, 'Expected an active tenant');
  const mixedCode = String(tenant.code || '')
    .split('')
    .map((char, index) => (index % 2 === 0 ? char.toUpperCase() : char.toLowerCase()))
    .join('');

  const middleware = tenantResolverFactory({}, { strapi: app });
  const ctx = buildResolverCtx(mixedCode);

  const nextCalled = await runResolver(middleware, ctx);
  assert.equal(nextCalled, true);
  assert.equal(ctx.state.tenantId, tenant.id);
});
