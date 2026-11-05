const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

function loadTsDefaultExport(filePath, stubs = {}) {
  const source = fs.readFileSync(filePath, 'utf8');
  const transpiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
      esModuleInterop: true,
    },
    fileName: filePath,
  }).outputText;

  const module = { exports: {} };
  const localRequire = (request) => {
    if (Object.prototype.hasOwnProperty.call(stubs, request)) {
      return stubs[request];
    }
    return require(request);
  };
  const wrapper = new Function('require', 'module', 'exports', '__filename', '__dirname', transpiled);
  wrapper(localRequire, module, module.exports, filePath, path.dirname(filePath));
  return module.exports.default || module.exports;
}

function createPolicyCtx({
  userId = 101,
  blocked = false,
  tenantId = 201,
  moduleKey = 'community',
  featureKey = 'community-post.manage',
  entityType = '',
  entityId = '',
} = {}) {
  return {
    request: {
      body: {
        moduleKey,
        featureKey,
        entityType,
        entityId,
      },
      headers: {},
      header: {},
    },
    state: {
      user: userId ? { id: userId, blocked } : null,
      tenantId,
    },
    status: 200,
    body: null,
    unauthorized(message) {
      this.status = 401;
      this.body = { error: { message } };
      return this.body;
    },
    forbidden(message) {
      this.status = 403;
      this.body = { error: { message } };
      return this.body;
    },
    throw(status, message) {
      this.status = status;
      this.body = { error: { message } };
      return this.body;
    },
  };
}

function installStorageUploadPolicyStrapiMock({
  hasMembership = true,
  permissionKeys = [],
  enabledTenantFeatureKeys = [],
  allowMemberPost = true,
  postRow = null,
} = {}) {
  global.strapi = {
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
              return permissionKeys.map((key) => ({ feature: { key } }));
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

        if (uid === 'api::community-post.community-post') {
          return {
            async findOne() {
              return postRow;
            },
          };
        }

        throw new Error(`Unexpected uid for storage upload policy mock: ${uid}`);
      },
    },
  };
}

function buildCommunityConfigStub(allowMemberPost) {
  return {
    getActiveCommunityConfig: async () => ({
      id: 1,
      policyConfig: {
        allowMemberPost,
      },
    }),
  };
}

function installHasTenantPermissionStrapiMock({ hasMembership = true, featureRows = [] } = {}) {
  global.strapi = {
    plugin() {
      return null;
    },
    db: {
      query(uid) {
        if (uid === 'api::user-tenant.user-tenant') {
          return {
            async findOne() {
              return hasMembership ? { id: 5001 } : null;
            },
          };
        }
        if (uid === 'api::user-tenant-role.user-tenant-role') {
          return {
            async findMany() {
              return hasMembership ? [{ role: { id: 22 } }] : [];
            },
          };
        }
        if (uid === 'api::role-feature.role-feature') {
          return {
            async findMany(params) {
              if (params?.where?.isActive !== true) {
                throw new Error('Expected isActive=true filter in role feature lookup');
              }
              return featureRows;
            },
          };
        }

        throw new Error(`Unexpected uid for has-tenant-permission mock: ${uid}`);
      },
    },
  };
}

const storageUploadPolicyPath = path.join(__dirname, '..', 'src', 'policies', 'tenant-storage-upload-access.ts');
const hasTenantPermissionPath = path.join(__dirname, '..', 'src', 'policies', 'has-tenant-permission.ts');
const hasPermissionPath = path.join(__dirname, '..', 'src', 'policies', 'has-permission.ts');

function installHasPermissionStrapiMock({ hasMembership = true, featureRows = [] } = {}) {
  global.strapi = {
    db: {
      query(uid) {
        if (uid === 'api::user-tenant.user-tenant') {
          return {
            async findOne() {
              return hasMembership ? { id: 5001 } : null;
            },
          };
        }
        if (uid === 'api::user-tenant-role.user-tenant-role') {
          return {
            async findMany() {
              return hasMembership ? [{ role: { id: 22 } }] : [];
            },
          };
        }
        if (uid === 'api::role-feature.role-feature') {
          return {
            async findMany(params) {
              if (params?.where?.isActive !== true) {
                throw new Error('Expected isActive=true filter in role feature lookup');
              }
              return featureRows;
            },
          };
        }
        if (uid === 'plugin::users-permissions.user') {
          return {
            async findOne() {
              return { id: 101, role: { id: 1 } };
            },
          };
        }

        throw new Error(`Unexpected uid for has-permission mock: ${uid}`);
      },
    },
  };
}

test('community member without manage permissions can upload attachment when community allows member posts', async () => {
  installStorageUploadPolicyStrapiMock({
    hasMembership: true,
    permissionKeys: [],
    enabledTenantFeatureKeys: ['community', 'community-post.manage'],
    allowMemberPost: true,
  });
  const policy = loadTsDefaultExport(storageUploadPolicyPath, {
    '../api/community-config/services/community-config-management': buildCommunityConfigStub(true),
  });
  const ctx = createPolicyCtx({
    moduleKey: 'community',
    featureKey: 'community-post.manage',
  });

  const allowed = await policy({ ctx, state: ctx.state });
  assert.equal(allowed, true);
});

test('community member upload is denied when allowMemberPost=false', async () => {
  installStorageUploadPolicyStrapiMock({
    hasMembership: true,
    permissionKeys: [],
    enabledTenantFeatureKeys: ['community', 'community-post.manage'],
    allowMemberPost: false,
  });
  const policy = loadTsDefaultExport(storageUploadPolicyPath, {
    '../api/community-config/services/community-config-management': buildCommunityConfigStub(false),
  });
  const ctx = createPolicyCtx({
    moduleKey: 'community',
    featureKey: 'community-post.manage',
  });

  const result = await policy({ ctx, state: ctx.state });
  assert.deepEqual(result, { error: { message: 'Forbidden: missing required module permission in tenant scope' } });
  assert.equal(ctx.status, 403);
});

test('community upload is denied when user is not tenant member', async () => {
  installStorageUploadPolicyStrapiMock({
    hasMembership: false,
    permissionKeys: [],
    enabledTenantFeatureKeys: ['community', 'community-post.manage'],
  });
  const policy = loadTsDefaultExport(storageUploadPolicyPath, {
    '../api/community-config/services/community-config-management': buildCommunityConfigStub(true),
  });
  const ctx = createPolicyCtx({
    moduleKey: 'community',
    featureKey: 'community-post.manage',
  });

  const result = await policy({ ctx, state: ctx.state });
  assert.deepEqual(result, { error: { message: 'Forbidden: user is not an active member of this tenant' } });
  assert.equal(ctx.status, 403);
});

test('community upload accepts the valid post entityType for the community module', async () => {
  installStorageUploadPolicyStrapiMock({
    hasMembership: true,
    permissionKeys: [],
    enabledTenantFeatureKeys: ['community', 'community-post.manage'],
    allowMemberPost: true,
  });
  const policy = loadTsDefaultExport(storageUploadPolicyPath, {
    '../api/community-config/services/community-config-management': buildCommunityConfigStub(true),
  });
  const ctx = createPolicyCtx({
    moduleKey: 'community',
    featureKey: 'community-post.manage',
    entityType: 'community-post',
    entityId: '',
  });

  const allowed = await policy({ ctx, state: ctx.state });
  assert.equal(allowed, true);
  assert.equal(ctx.status, 200);
});

test('community upload is denied for spoofed entityType/entityId', async () => {
  installStorageUploadPolicyStrapiMock({
    hasMembership: true,
    permissionKeys: [],
    enabledTenantFeatureKeys: ['community', 'community-post.manage'],
    allowMemberPost: true,
  });
  const policy = loadTsDefaultExport(storageUploadPolicyPath, {
    '../api/community-config/services/community-config-management': buildCommunityConfigStub(true),
  });
  const ctx = createPolicyCtx({
    moduleKey: 'community',
    featureKey: 'community-post.manage',
    entityType: 'sports-club',
    entityId: '123',
  });

  const result = await policy({ ctx, state: ctx.state });
  assert.deepEqual(result, { error: { message: 'Forbidden: entityType is not allowed for this moduleKey' } });
  assert.equal(ctx.status, 403);
});

test('community upload with entityId requires ownership of editable post', async () => {
  installStorageUploadPolicyStrapiMock({
    hasMembership: true,
    permissionKeys: [],
    enabledTenantFeatureKeys: ['community', 'community-post.manage'],
    allowMemberPost: true,
    postRow: {
      id: 77,
      status: 'draft',
      author: { id: 101 },
      group: null,
    },
  });
  const policy = loadTsDefaultExport(storageUploadPolicyPath, {
    '../api/community-config/services/community-config-management': buildCommunityConfigStub(true),
  });
  const ctx = createPolicyCtx({
    moduleKey: 'community',
    featureKey: 'community-post.manage',
    entityType: 'community-post',
    entityId: '77',
  });

  const allowed = await policy({ ctx, state: ctx.state });
  assert.equal(allowed, true);
});

test('sports and learning upload authorization remains unchanged for module-scoped permission', async () => {
  installStorageUploadPolicyStrapiMock({
    hasMembership: true,
    permissionKeys: ['sports-club.manage', 'learning.question.manage'],
    enabledTenantFeatureKeys: ['sports-club.manage', 'learning.question.manage', 'community'],
    allowMemberPost: true,
  });
  const policy = loadTsDefaultExport(storageUploadPolicyPath, {
    '../api/community-config/services/community-config-management': buildCommunityConfigStub(true),
  });

  const sportsCtx = createPolicyCtx({
    moduleKey: 'sports-club',
    featureKey: 'sports-club.manage',
  });
  const sportsAllowed = await policy({ ctx: sportsCtx, state: sportsCtx.state });
  assert.equal(sportsAllowed, true);

  const learningCtx = createPolicyCtx({
    moduleKey: 'question-bank',
    featureKey: 'learning.question.manage',
  });
  const learningAllowed = await policy({ ctx: learningCtx, state: learningCtx.state });
  assert.equal(learningAllowed, true);
});

test('sports and learning uploads are denied without corresponding module permissions', async () => {
  installStorageUploadPolicyStrapiMock({
    hasMembership: true,
    permissionKeys: [],
    enabledTenantFeatureKeys: ['sports-club.manage', 'learning.question.manage'],
    allowMemberPost: true,
  });
  const policy = loadTsDefaultExport(storageUploadPolicyPath, {
    '../api/community-config/services/community-config-management': buildCommunityConfigStub(true),
  });

  const sportsCtx = createPolicyCtx({
    moduleKey: 'sports-club',
    featureKey: 'sports-club.manage',
  });
  const sportsDenied = await policy({ ctx: sportsCtx, state: sportsCtx.state });
  assert.equal(sportsCtx.status, 403);
  assert.deepEqual(sportsDenied, { error: { message: 'Forbidden: missing required module permission in tenant scope' } });

  const learningCtx = createPolicyCtx({
    moduleKey: 'question-bank',
    featureKey: 'learning.question.manage',
  });
  const learningDenied = await policy({ ctx: learningCtx, state: learningCtx.state });
  assert.equal(learningCtx.status, 403);
  assert.deepEqual(learningDenied, { error: { message: 'Forbidden: missing required module permission in tenant scope' } });
});

test('has-tenant-permission ignores inactive role features and denies unauthorized access', async () => {
  installHasTenantPermissionStrapiMock({
    hasMembership: true,
    featureRows: [],
  });
  const policy = loadTsDefaultExport(hasTenantPermissionPath);
  const ctx = createPolicyCtx({
    moduleKey: 'irrelevant',
  });

  const result = await policy({ ctx, state: ctx.state }, { key: 'storage.manage' });
  assert.deepEqual(result, { error: { message: 'Forbidden: missing required permission in tenant scope (storage.manage)' } });
  assert.equal(ctx.status, 403);
});

test('has-tenant-permission allows active tenant admin permission', async () => {
  installHasTenantPermissionStrapiMock({
    hasMembership: true,
    featureRows: [{ feature: { key: 'storage.manage' } }],
  });
  const policy = loadTsDefaultExport(hasTenantPermissionPath);
  const ctx = createPolicyCtx({
    moduleKey: 'irrelevant',
  });

  const allowed = await policy({ ctx, state: ctx.state }, { key: 'storage.manage' });
  assert.equal(allowed, true);
});

test('has-permission ignores inactive role features in tenant scope', async () => {
  installHasPermissionStrapiMock({
    hasMembership: true,
    featureRows: [],
  });
  const policy = loadTsDefaultExport(hasPermissionPath);
  const ctx = createPolicyCtx({
    moduleKey: 'irrelevant',
  });

  const result = await policy({ ctx, state: ctx.state }, { key: 'storage.manage' });
  assert.deepEqual(result, { error: { message: "Forbidden: missing permission 'storage.manage'" } });
  assert.equal(ctx.status, 403);
});

test('has-permission allows active role features in tenant scope', async () => {
  installHasPermissionStrapiMock({
    hasMembership: true,
    featureRows: [{ feature: { key: 'storage.manage' } }],
  });
  const policy = loadTsDefaultExport(hasPermissionPath);
  const ctx = createPolicyCtx({
    moduleKey: 'irrelevant',
  });

  const allowed = await policy({ ctx, state: ctx.state }, { key: 'storage.manage' });
  assert.equal(allowed, true);
});
