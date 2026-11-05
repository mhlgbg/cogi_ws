const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const POLICY_PATH = path.join(__dirname, '..', 'dist', 'src', 'policies', 'tenant-storage-upload-access.js');
const STORAGE_ROUTES_PATH = path.join(__dirname, '..', 'dist', 'src', 'api', 'storage', 'routes', 'storage.js');
const STORAGE_CONTROLLER_PATH = path.join(__dirname, '..', 'dist', 'src', 'api', 'storage', 'controllers', 'storage.js');
const TENANT_SCOPE_PATH = path.join(__dirname, '..', 'dist', 'src', 'utils', 'tenant-scope.js');
const FILE_ASSET_DELIVERY_PATH = path.join(__dirname, '..', 'dist', 'src', 'utils', 'file-asset-delivery.js');
const ASSESSMENT_RUNTIME_PATH = path.join(__dirname, '..', 'dist', 'src', 'api', 'assessment-runtime', 'services', 'assessment-runtime.js');

function clearRequire(modulePath) {
  delete require.cache[require.resolve(modulePath)];
}

function createPolicyCtx({ userId = 101, tenantId = 201, moduleKey = 'question-bank', featureKey = 'learning.question.manage' } = {}) {
  const ctx = {
    request: {
      body: {
        moduleKey,
        featureKey,
      },
      headers: {},
      header: {},
      query: {},
    },
    state: {
      user: userId ? { id: userId, blocked: false } : null,
      tenantId,
    },
    status: 200,
    body: null,
    forbidden(message) {
      this.status = 403;
      this.body = { error: { message } };
      return this.body;
    },
    unauthorized(message) {
      this.status = 401;
      this.body = { error: { message } };
      return this.body;
    },
    throw(status, message) {
      this.status = status;
      this.body = { error: { message } };
      return this.body;
    },
  };
  return ctx;
}

function buildStrapiPolicyMock({
  hasMembership = true,
  roleFeatureKeys = [],
  enabledTenantFeatureKeys = [],
  sportsProfile = { id: 501 },
  activeClubMembership = { id: 701 },
  submissionRecord = { id: 801 },
} = {}) {
  return {
    log: {
      warn() {},
      error() {},
    },
    plugin() {
      return null;
    },
    db: {
      query(uid) {
        if (uid === 'api::user-tenant.user-tenant') {
          return {
            async findOne() {
              return hasMembership ? { id: 7001 } : null;
            },
          };
        }

        if (uid === 'api::user-tenant-role.user-tenant-role') {
          return {
            async findMany() {
              return hasMembership ? [{ role: { id: 901 } }] : [];
            },
          };
        }

        if (uid === 'api::role-feature.role-feature') {
          return {
            async findMany() {
              return roleFeatureKeys.map((key) => ({ feature: { key } }));
            },
          };
        }

        if (uid === 'api::tenant-feature.tenant-feature') {
          return {
            async findMany() {
              return enabledTenantFeatureKeys.map((key) => ({ feature: { key } }));
            },
          };
        }

        if (uid === 'api::sports-profile.sports-profile') {
          return {
            async findOne() {
              return sportsProfile || null;
            },
          };
        }

        if (uid === 'api::club-membership.club-membership') {
          return {
            async findOne() {
              return activeClubMembership || null;
            },
          };
        }

        if (uid === 'api::sports-achievement-submission.sports-achievement-submission') {
          return {
            async findOne() {
              return submissionRecord || null;
            },
          };
        }

        throw new Error(`Unexpected query uid in policy test: ${uid}`);
      },
    },
  };
}

function createDownloadCtx({ id = 1, query = {} } = {}) {
  return {
    params: { id: String(id) },
    request: { query },
    status: 200,
    body: null,
    badRequest(message) {
      this.status = 400;
      this.body = { error: { message } };
      return this.body;
    },
    forbidden(message) {
      this.status = 403;
      this.body = { error: { message } };
      return this.body;
    },
    unauthorized(message) {
      this.status = 401;
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
    set() {},
  };
}

function loadStorageControllerWithMocks({ fileAsset, sendStoredFileResponse, verifyAssessmentRuntimeFileAssetToken }) {
  clearRequire(STORAGE_CONTROLLER_PATH);
  clearRequire(TENANT_SCOPE_PATH);
  clearRequire(FILE_ASSET_DELIVERY_PATH);
  clearRequire(ASSESSMENT_RUNTIME_PATH);

  require.cache[require.resolve(TENANT_SCOPE_PATH)] = {
    exports: {
      findEntityByRef: async () => fileAsset,
      resolveCurrentTenantId: () => Number(fileAsset?.tenant?.id || 0) || 0,
    },
  };

  require.cache[require.resolve(FILE_ASSET_DELIVERY_PATH)] = {
    exports: {
      sendStoredFileResponse,
    },
  };

  require.cache[require.resolve(ASSESSMENT_RUNTIME_PATH)] = {
    exports: {
      verifyAssessmentRuntimeFileAssetToken: verifyAssessmentRuntimeFileAssetToken || (() => {
        throw new Error('runtime token not configured for this test');
      }),
    },
  };

  return require(STORAGE_CONTROLLER_PATH).default;
}

test('upload policy allows module uploader without storage.manage', async () => {
  clearRequire(POLICY_PATH);
  global.strapi = buildStrapiPolicyMock({
    hasMembership: true,
    roleFeatureKeys: ['learning.question.manage'],
    enabledTenantFeatureKeys: ['learning.question.manage'],
  });
  const policy = require(POLICY_PATH).default;

  const ctx = createPolicyCtx({
    moduleKey: 'question-bank',
    featureKey: 'learning.question.manage',
  });

  const allowed = await policy({ ctx, state: ctx.state });
  assert.equal(allowed, true);
  assert.equal(ctx.status, 200);
});

test('upload policy allows sports achievement submission module without storage.manage', async () => {
  clearRequire(POLICY_PATH);
  global.strapi = buildStrapiPolicyMock({
    hasMembership: true,
    roleFeatureKeys: ['sports-achievement-submission.manage'],
    enabledTenantFeatureKeys: ['sports-achievement-submission.manage'],
  });
  const policy = require(POLICY_PATH).default;

  const ctx = createPolicyCtx({
    moduleKey: 'sports-achievement-submission',
    featureKey: 'sports-achievement-submission.manage',
  });

  const allowed = await policy({ ctx, state: ctx.state });
  assert.equal(allowed, true);
  assert.equal(ctx.status, 200);
});

test('upload policy allows self-service sports achievement submission without role feature when user owns a valid sports profile and active club membership', async () => {
  clearRequire(POLICY_PATH);
  global.strapi = buildStrapiPolicyMock({
    hasMembership: true,
    roleFeatureKeys: [],
    enabledTenantFeatureKeys: ['sports-achievement-submission.manage'],
    sportsProfile: { id: 501 },
    activeClubMembership: { id: 701 },
  });
  const policy = require(POLICY_PATH).default;

  const ctx = createPolicyCtx({
    moduleKey: 'sports-achievement-submission',
    featureKey: 'sports-achievement-submission.manage',
  });

  const allowed = await policy({ ctx, state: ctx.state });
  assert.equal(allowed, true);
  assert.equal(ctx.status, 200);
});

test('upload policy rejects self-service sports achievement submission without a valid sports profile or active membership', async () => {
  clearRequire(POLICY_PATH);
  global.strapi = buildStrapiPolicyMock({
    hasMembership: true,
    roleFeatureKeys: [],
    enabledTenantFeatureKeys: ['sports-achievement-submission.manage'],
    sportsProfile: null,
    activeClubMembership: null,
  });
  const policy = require(POLICY_PATH).default;

  const ctx = createPolicyCtx({
    moduleKey: 'sports-achievement-submission',
    featureKey: 'sports-achievement-submission.manage',
  });

  await policy({ ctx, state: ctx.state });
  assert.equal(ctx.status, 403);
  assert.match(ctx.body.error.message, /Forbidden/);
});

test('upload policy rejects mismatched featureKey/moduleKey mapping', async () => {
  clearRequire(POLICY_PATH);
  global.strapi = buildStrapiPolicyMock({
    hasMembership: true,
    roleFeatureKeys: ['sports-club.manage'],
    enabledTenantFeatureKeys: ['sports-club.manage'],
  });
  const policy = require(POLICY_PATH).default;

  const ctx = createPolicyCtx({
    moduleKey: 'community',
    featureKey: 'sports-club.manage',
  });

  const result = await policy({ ctx, state: ctx.state });
  assert.deepEqual(result, { error: { message: 'Forbidden: featureKey does not match moduleKey authorization rules' } });
  assert.equal(ctx.status, 403);
});

test('upload policy bypasses module mapping when user has storage.manage', async () => {
  clearRequire(POLICY_PATH);
  global.strapi = buildStrapiPolicyMock({
    hasMembership: true,
    roleFeatureKeys: ['storage.manage'],
    enabledTenantFeatureKeys: [],
  });
  const policy = require(POLICY_PATH).default;

  const ctx = createPolicyCtx({
    moduleKey: 'unmapped-module',
    featureKey: 'any.feature',
  });

  const allowed = await policy({ ctx, state: ctx.state });
  assert.equal(allowed, true);
  assert.equal(ctx.status, 200);
});

test('storage routes guard management APIs with storage.manage and upload with dedicated policy', async () => {
  clearRequire(STORAGE_ROUTES_PATH);
  const routes = require(STORAGE_ROUTES_PATH).default.routes;
  const byPath = new Map(routes.map((route) => [route.path, route]));

  const managementPaths = [
    '/tenant/storage/summary',
    '/tenant/storage/files',
    '/tenant/storage/files/:id',
    '/tenant/storage/files/:id/restore',
  ];

  for (const routePath of managementPaths) {
    const route = byPath.get(routePath);
    assert.ok(route, `Expected route ${routePath}`);
    const hasStorageManagePolicy = Array.isArray(route.config?.policies)
      && route.config.policies.some((entry) => entry?.name === 'global::has-tenant-permission' && entry?.config?.key === 'storage.manage');
    assert.equal(hasStorageManagePolicy, true, `Expected storage.manage guard for ${routePath}`);
  }

  const uploadRoute = byPath.get('/tenant/storage/upload');
  assert.ok(uploadRoute, 'Expected upload route');
  const uploadUsesDedicatedPolicy = Array.isArray(uploadRoute.config?.policies)
    && uploadRoute.config.policies.includes('global::tenant-storage-upload-access');
  assert.equal(uploadUsesDedicatedPolicy, true);
});

test('download API denies private file without download context token', async () => {
  let sendCount = 0;
  global.strapi = {
    log: {
      error() {},
    },
    plugin() {
      return null;
    },
    db: {
      query() {
        return {
          async findOne() {
            return null;
          },
        };
      },
    },
  };

  const controller = loadStorageControllerWithMocks({
    fileAsset: {
      id: 1,
      status: 'ACTIVE',
      isPublic: false,
      tenant: { id: 201, code: 't201' },
    },
    sendStoredFileResponse: async () => {
      sendCount += 1;
    },
  });

  const ctx = createDownloadCtx({ id: 1 });
  await controller.downloadFileAsset(ctx);

  assert.equal(ctx.status, 403);
  assert.deepEqual(ctx.body, { error: { message: 'Private file requires authenticated download' } });
  assert.equal(sendCount, 0);
});

test('download API serves private file when tenant membership is valid via jwt', async () => {
  let sendCount = 0;
  global.strapi = {
    log: {
      error() {},
    },
    plugin(name) {
      if (name !== 'users-permissions') return null;
      return {
        service(serviceName) {
          if (serviceName !== 'jwt') return null;
          return {
            async verify() {
              return { id: 88 };
            },
          };
        },
      };
    },
    db: {
      query(uid) {
        if (uid === 'plugin::users-permissions.user') {
          return {
            async findOne() {
              return { id: 88, blocked: false };
            },
          };
        }

        if (uid === 'api::user-tenant.user-tenant') {
          return {
            async findOne() {
              return { id: 9901 };
            },
          };
        }

        throw new Error(`Unexpected uid in download test: ${uid}`);
      },
    },
  };

  const controller = loadStorageControllerWithMocks({
    fileAsset: {
      id: 2,
      status: 'ACTIVE',
      isPublic: false,
      tenant: { id: 201, code: 't201' },
    },
    sendStoredFileResponse: async (ctx) => {
      sendCount += 1;
      ctx.body = { ok: true };
    },
  });

  const ctx = createDownloadCtx({ id: 2, query: { jwt: 'token-abc' } });
  await controller.downloadFileAsset(ctx);

  assert.equal(sendCount, 1);
  assert.deepEqual(ctx.body, { ok: true });
});
