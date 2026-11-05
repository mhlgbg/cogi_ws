const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

function loadTsModule(filePath, stubs = {}) {
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
  return module.exports;
}

function parsePositiveInt(value) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

function extractTenantId(where) {
  if (!where || typeof where !== 'object') return null;
  if (Object.prototype.hasOwnProperty.call(where, 'tenant')) {
    const tenant = where.tenant;
    if (typeof tenant === 'number') return tenant;
    if (tenant && typeof tenant === 'object' && Object.prototype.hasOwnProperty.call(tenant, 'id')) {
      return Number(tenant.id) || null;
    }
  }

  if (Array.isArray(where.$and)) {
    for (const item of where.$and) {
      const tenantId = extractTenantId(item);
      if (tenantId) return tenantId;
    }
  }
  return null;
}

function extractPostId(where) {
  if (!where || typeof where !== 'object') return null;
  const post = where.post;
  if (typeof post === 'number') return post;
  if (post && typeof post === 'object') {
    if (typeof post.id === 'number') return post.id;
    if (post.id && typeof post.id === 'object') {
      if (typeof post.id.$eq === 'number') return post.id.$eq;
      if (Array.isArray(post.id.$in) && post.id.$in.length > 0) return Number(post.id.$in[0]) || null;
    }
  }

  if (Array.isArray(where.$and)) {
    for (const item of where.$and) {
      const postId = extractPostId(item);
      if (postId) return postId;
    }
  }
  return null;
}

function extractEqId(where) {
  if (!where || typeof where !== 'object') return null;
  if (typeof where.id === 'number') return where.id;
  if (where.id && typeof where.id === 'object' && typeof where.id.$eq === 'number') return where.id.$eq;
  if (Array.isArray(where.$and)) {
    for (const item of where.$and) {
      const id = extractEqId(item);
      if (id) return id;
    }
  }
  return null;
}

function buildServiceStubs() {
  return {
    '../../../utils/tenant-scope': {
      mergeTenantWhere(where, tenantId) {
        return {
          ...(where && typeof where === 'object' ? where : {}),
          tenant: Number(tenantId),
        };
      },
      parseOptionalPositiveInt(value) {
        return parsePositiveInt(value);
      },
      toText(value) {
        if (value === null || value === undefined) return '';
        return String(value).trim();
      },
      whereByParam(value) {
        const id = parsePositiveInt(value);
        if (!id) return { id: { $eq: 0 } };
        return { id: { $eq: id } };
      },
    },
    '../../community-config/services/community-config-management': {
      getActiveCommunityConfig: async () => null,
    },
    '../../game/services/xp-engine': {
      dispatchTrustedGameActivity: async () => null,
    },
  };
}

function installReactionListStrapiMock({
  post,
  reactions,
  authUserId = null,
  hasMembership = false,
  permissionKeys = [],
}) {
  global.strapi = {
    db: {
      query(uid) {
        if (uid === 'api::community-post.community-post') {
          return {
            async findOne(params) {
              const where = params?.where || {};
              const tenantId = extractTenantId(where);
              const postId = extractEqId(where);
              if (tenantId !== Number(post.tenant)) return null;
              if (postId !== Number(post.id)) return null;
              return {
                id: post.id,
                tenant: { id: post.tenant },
                scope: post.scope,
                status: post.status,
                group: post.group || null,
                author: { id: 1 },
                media: [],
              };
            },
          };
        }

        if (uid === 'api::user-tenant.user-tenant') {
          return {
            async findOne() {
              return hasMembership ? { id: 9001 } : null;
            },
          };
        }

        if (uid === 'api::user-tenant-role.user-tenant-role') {
          return {
            async findMany() {
              return hasMembership ? [{ role: { id: 1001 } }] : [];
            },
          };
        }

        if (uid === 'api::role-feature.role-feature') {
          return {
            async findMany(params) {
              if (params?.where?.isActive !== true) {
                throw new Error('Expected role-feature query to enforce isActive=true');
              }
              return permissionKeys.map((key) => ({ feature: { key } }));
            },
          };
        }

        if (uid === 'api::community-group-member.community-group-member') {
          return {
            async findOne() {
              return null;
            },
          };
        }

        if (uid === 'api::community-reaction.community-reaction') {
          return {
            async findMany(params) {
              const where = params?.where || {};
              const tenantId = extractTenantId(where);
              const postId = extractPostId(where);
              const filterType = where.type ? String(where.type) : null;

              const rows = reactions
                .filter((row) => Number(row.tenant) === Number(tenantId) && Number(row.post) === Number(postId))
                .filter((row) => (filterType ? row.type === filterType : true))
                .sort((a, b) => {
                  const createdDiff = new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
                  if (createdDiff !== 0) return createdDiff;
                  return Number(b.id) - Number(a.id);
                });

              const offset = Number(params?.offset || 0) || 0;
              const limit = Number(params?.limit || rows.length) || rows.length;
              return rows.slice(offset, offset + limit).map((row) => ({
                id: row.id,
                type: row.type,
                createdAt: row.createdAt,
                user: {
                  id: row.user.id,
                  username: row.user.username,
                  fullName: row.user.fullName,
                  email: row.user.email,
                },
              }));
            },
            async count(params) {
              const where = params?.where || {};
              const tenantId = extractTenantId(where);
              const postId = extractPostId(where);
              const filterType = where.type ? String(where.type) : null;
              return reactions
                .filter((row) => Number(row.tenant) === Number(tenantId) && Number(row.post) === Number(postId))
                .filter((row) => (filterType ? row.type === filterType : true))
                .length;
            },
            async findOne(params) {
              const where = params?.where || {};
              const tenantId = extractTenantId(where);
              const postId = extractPostId(where);
              const userId = Number(where.user || 0) || Number(authUserId || 0);
              const found = reactions.find((row) => Number(row.tenant) === Number(tenantId) && Number(row.post) === Number(postId) && Number(row.user.id) === userId);
              return found ? { id: found.id, type: found.type } : null;
            },
          };
        }

        throw new Error(`Unexpected uid: ${uid}`);
      },
    },
  };
}

const communityServicePath = path.join(__dirname, '..', 'src', 'api', 'community', 'services', 'community.ts');

test('lists reactions with pagination, filter, and public-safe user payload', async () => {
  const stubs = buildServiceStubs();
  const service = loadTsModule(communityServicePath, stubs);

  installReactionListStrapiMock({
    post: { id: 101, tenant: 9, scope: 'public', status: 'published' },
    reactions: [
      { id: 1, tenant: 9, post: 101, type: 'like', createdAt: '2026-01-01T00:00:01.000Z', user: { id: 11, username: 'u11', fullName: 'User 11', email: 'u11@example.com' } },
      { id: 2, tenant: 9, post: 101, type: 'love', createdAt: '2026-01-01T00:00:02.000Z', user: { id: 12, username: 'u12', fullName: 'User 12', email: 'u12@example.com' } },
      { id: 3, tenant: 9, post: 101, type: 'love', createdAt: '2026-01-01T00:00:03.000Z', user: { id: 13, username: 'u13', fullName: 'User 13', email: 'u13@example.com' } },
      { id: 4, tenant: 9, post: 101, type: 'support', createdAt: '2026-01-01T00:00:04.000Z', user: { id: 14, username: 'u14', fullName: 'User 14', email: 'u14@example.com' } },
      { id: 999, tenant: 10, post: 101, type: 'love', createdAt: '2026-01-01T00:01:00.000Z', user: { id: 99, username: 'x', fullName: 'Other Tenant', email: 'other@example.com' } },
    ],
    authUserId: 11,
    hasMembership: true,
  });

  const result = await service.listCommunityReactions({
    postId: 101,
    tenantId: 9,
    authUserId: 11,
    permissionKeys: new Set(),
    query: { type: 'love', page: 1, pageSize: 1 },
  });

  assert.equal(result.pagination.total, 2);
  assert.equal(result.pagination.page, 1);
  assert.equal(result.pagination.pageCount, 2);
  assert.equal(result.rows.length, 1);
  assert.equal(result.rows[0].type, 'love');
  assert.equal(result.summary.like, 1);
  assert.equal(result.summary.love, 2);
  assert.equal(result.summary.support, 1);
  assert.equal(result.myReaction, 'like');
  assert.equal(Object.prototype.hasOwnProperty.call(result.rows[0].user, 'email'), false);
});

test('enforces visibility policy for community scope posts', async () => {
  const stubs = buildServiceStubs();
  const service = loadTsModule(communityServicePath, stubs);

  installReactionListStrapiMock({
    post: { id: 102, tenant: 9, scope: 'community', status: 'published' },
    reactions: [],
    authUserId: null,
    hasMembership: false,
  });

  await assert.rejects(
    () => service.listCommunityReactions({
      postId: 102,
      tenantId: 9,
      authUserId: null,
      permissionKeys: new Set(),
      query: { page: 1, pageSize: 20 },
    }),
    (error) => Number(error?.status) === 403,
  );
});

test('rejects invalid reaction type filter', async () => {
  const stubs = buildServiceStubs();
  const service = loadTsModule(communityServicePath, stubs);

  installReactionListStrapiMock({
    post: { id: 103, tenant: 9, scope: 'public', status: 'published' },
    reactions: [],
    authUserId: null,
    hasMembership: false,
  });

  await assert.rejects(
    () => service.listCommunityReactions({
      postId: 103,
      tenantId: 9,
      authUserId: null,
      permissionKeys: new Set(),
      query: { type: 'angry' },
    }),
    (error) => Number(error?.status) === 400,
  );
});
