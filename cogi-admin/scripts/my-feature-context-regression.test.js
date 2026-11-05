const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

function loadTsDefaultExport(filePath) {
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
  const wrapper = new Function('require', 'module', 'exports', '__filename', '__dirname', transpiled);
  wrapper(require, module, module.exports, filePath, path.dirname(filePath));
  return module.exports.default || module.exports;
}

function installMyFeatureContextStrapiMock({
  roleFeatures = [],
  tenantFeatures = [],
  featureRows = [],
} = {}) {
  global.strapi = {
    db: {
      query(uid) {
        if (uid === 'api::tenant.tenant') {
          return {
            async findOne() {
              return { id: 9, code: 'vkl', name: 'VKL Runners', tenantStatus: 'active' };
            },
          };
        }
        if (uid === 'api::user-tenant.user-tenant') {
          return {
            async findOne() {
              return { id: 33, label: 'Fitness Member' };
            },
          };
        }
        if (uid === 'api::user-tenant-role.user-tenant-role') {
          return {
            async findMany() {
              return [{ role: { id: 12, name: 'Fitness', type: 'tenant_fitness' } }];
            },
          };
        }
        if (uid === 'api::role-feature.role-feature') {
          return {
            async findMany(params) {
              assert.equal(params?.where?.isActive, true);
              return roleFeatures;
            },
          };
        }
        if (uid === 'api::tenant-feature.tenant-feature') {
          return {
            async findMany() {
              return tenantFeatures;
            },
          };
        }
        if (uid === 'api::feature.feature') {
          return {
            async findMany() {
              return featureRows;
            },
          };
        }
        throw new Error(`Unexpected uid: ${uid}`);
      },
    },
  };
}

const servicePath = path.join(__dirname, '..', 'src', 'api', 'my-feature-context', 'services', 'my-feature-context.ts');

test('buildContext excludes inactive role features from granted feature list', async () => {
  installMyFeatureContextStrapiMock({
    roleFeatures: [],
    tenantFeatures: [{ feature: { id: 1001 } }],
    featureRows: [
      {
        id: 1001,
        name: 'Tenant Storage Manager',
        key: 'storage.manage',
        order: 1,
        group: { id: 1, name: 'Storage', code: 'storage', icon: 'cilStorage', order: 1 },
      },
    ],
  });

  const service = loadTsDefaultExport(servicePath);
  const context = await service.buildContext({ userId: 101, tenantCode: 'vkl' });
  assert.deepEqual(context.features, []);
  assert.deepEqual(context.featureGroups, []);
});

test('buildContext includes storage.manage when role feature is active and tenant feature enabled', async () => {
  installMyFeatureContextStrapiMock({
    roleFeatures: [{ feature: { id: 1001 } }],
    tenantFeatures: [{ feature: { id: 1001 } }],
    featureRows: [
      {
        id: 1001,
        name: 'Tenant Storage Manager',
        key: 'storage.manage',
        description: 'Manage tenant files',
        order: 1,
        path: '/storage',
        group: { id: 1, name: 'Storage', code: 'storage', icon: 'cilStorage', order: 1 },
      },
    ],
  });

  const service = loadTsDefaultExport(servicePath);
  const context = await service.buildContext({ userId: 101, tenantCode: 'vkl' });
  assert.equal(context.features.length, 1);
  assert.equal(context.features[0].key, 'storage.manage');
  assert.equal(context.featureGroups.length, 1);
});

test('buildContext denies storage feature when tenant feature is disabled even if role has active permission', async () => {
  installMyFeatureContextStrapiMock({
    roleFeatures: [{ feature: { id: 1001 } }],
    tenantFeatures: [],
    featureRows: [
      {
        id: 1001,
        name: 'Tenant Storage Manager',
        key: 'storage.manage',
        order: 1,
        group: { id: 1, name: 'Storage', code: 'storage', icon: 'cilStorage', order: 1 },
      },
    ],
  });

  const service = loadTsDefaultExport(servicePath);
  const context = await service.buildContext({ userId: 101, tenantCode: 'vkl' });
  assert.deepEqual(context.features, []);
  assert.deepEqual(context.featureGroups, []);
});
