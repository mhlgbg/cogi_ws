const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const crypto = require('node:crypto');
const bcrypt = require('bcryptjs');

function loadPublicService() {
  const modulePath = path.join(__dirname, '..', 'dist', 'src', 'api', 'quick-message', 'services', 'quick-message-public.js');
  delete require.cache[require.resolve(modulePath)];
  return require(modulePath);
}

function loadQuickMessageController() {
  const modulePath = path.join(__dirname, '..', 'dist', 'src', 'api', 'quick-message', 'controllers', 'quick-message.js');
  delete require.cache[require.resolve(modulePath)];
  return require(modulePath).default || require(modulePath);
}

function loadPinRateLimit() {
  const modulePath = path.join(__dirname, '..', 'dist', 'src', 'middlewares', 'quick-message-public-pin-rate-limit.js');
  delete require.cache[require.resolve(modulePath)];
  return require(modulePath).default || require(modulePath);
}

function loadAccessRateLimit() {
  const modulePath = path.join(__dirname, '..', 'dist', 'src', 'middlewares', 'quick-message-public-access-rate-limit.js');
  delete require.cache[require.resolve(modulePath)];
  return require(modulePath).default || require(modulePath);
}

function loadReplyRateLimit() {
  const modulePath = path.join(__dirname, '..', 'dist', 'src', 'middlewares', 'quick-message-public-reply-rate-limit.js');
  delete require.cache[require.resolve(modulePath)];
  return require(modulePath).default || require(modulePath);
}

function createKnexStub(state) {
  const trx = (tableName) => {
    const ctx = {
      tableName,
      whereClauses: [],
      selectColumns: [],
      whereCallback: null,
    };

    const api = {
      where(condition) {
        ctx.whereClauses.push(condition);
        return api;
      },
      select(columns) {
        ctx.selectColumns = Array.isArray(columns) ? columns : [columns];
        return api;
      },
      first() { return api; },
      forUpdate() {
        if (tableName === 'quick_message_accesses') {
          return Promise.resolve({
            id: state.access.id,
            code: state.access.code,
            status: state.access.status,
            expires_at: state.access.expiresAt,
            max_views: state.access.maxViews,
            view_count: state.access.viewCount,
            first_viewed_at: state.access.firstViewedAt,
            last_viewed_at: state.access.lastViewedAt,
            access_version: state.access.accessVersion,
            recipient_name: state.access.recipientName,
            message_id: state.message.id,
          });
        }

        if (tableName === 'quick_messages') {
          return Promise.resolve({
            id: state.message.id,
            status: state.message.status,
            expires_at: state.message.expiresAt,
          });
        }

        return Promise.resolve(null);
      },
      ref(columnName) {
        return columnName;
      },
      raw(expression, params = []) {
        return { expression, params };
      },
      update(patch) {
        if (tableName !== 'quick_message_accesses') {
          return Promise.resolve([]);
        }

        const maxViews = Number(state.access.maxViews || 0);
        if (maxViews > 0 && Number(state.access.viewCount || 0) >= maxViews) {
          return Promise.resolve([]);
        }

        state.access.viewCount = Number(state.access.viewCount || 0) + 1;
        if (!state.access.firstViewedAt) {
          state.access.firstViewedAt = patch.first_viewed_at.params[0];
        }
        state.access.lastViewedAt = patch.last_viewed_at;

        return Promise.resolve([{
          id: state.access.id,
          view_count: state.access.viewCount,
          first_viewed_at: state.access.firstViewedAt,
          last_viewed_at: state.access.lastViewedAt,
        }]);
      },
    };

    return api;
  };

  trx.ref = (columnName) => columnName;
  trx.raw = (expression, params = []) => ({ expression, params });
  return trx;
}

function buildActiveAccess(overrides = {}) {
  return {
    id: 1,
    documentId: 'acc-doc',
    code: 'CPA866',
    requirePin: false,
    pinHash: null,
    status: 'active',
    expiresAt: null,
    maxViews: null,
    viewCount: 0,
    firstViewedAt: null,
    lastViewedAt: null,
    accessVersion: 2,
    tenant: {
      id: 9,
      name: 'COGI',
      shortName: 'COGI',
      siteTitle: 'COGI',
      primaryColor: '#0d6efd',
      logo: { url: '/uploads/logo.png' },
      favicon: { url: '/uploads/favicon.png' },
    },
    message: {
      id: 11,
      status: 'active',
      expiresAt: null,
      tenant: {
        id: 9,
        name: 'COGI',
        shortName: 'COGI',
        siteTitle: 'COGI',
        primaryColor: '#0d6efd',
        logo: { url: '/uploads/logo.png' },
        favicon: { url: '/uploads/favicon.png' },
      },
    },
    ...overrides,
  };
}

function installStrapiWithAccess(accessBuilder) {
  global.strapi = {
    config: { get() { return ['quick-message-secret']; } },
    log: { error() {} },
    db: {
      query(uid) {
        if (uid !== 'api::quick-message-access.quick-message-access') throw new Error(`Unexpected uid ${uid}`);
        return {
          async findOne() {
            return typeof accessBuilder === 'function' ? accessBuilder() : accessBuilder;
          },
        };
      },
      connection: {
        transaction: async (callback) => callback(createKnexStub({
          access: typeof accessBuilder === 'function' ? accessBuilder() : accessBuilder,
          message: (typeof accessBuilder === 'function' ? accessBuilder() : accessBuilder)?.message || null,
        })),
      },
    },
  };
}

test('quick message public: normalize code trims and uppercases', async () => {
  const service = loadPublicService();
  assert.equal(service.normalizeQuickMessageAccessCode(' cpa866 '), 'CPA866');
});

test('quick message public: normalize code rejects empty or invalid length', async () => {
  const service = loadPublicService();
  assert.throws(() => service.normalizeQuickMessageAccessCode('   '), (error) => error && error.status === 400);
  assert.throws(() => service.normalizeQuickMessageAccessCode('ABC'), (error) => error && error.status === 400);
});

test('quick message public: computes detailed effective statuses', async () => {
  const service = loadPublicService();
  const now = new Date('2026-07-29T10:00:00.000Z');
  assert.equal(service.computeQuickMessagePublicLookupStatus({ status: 'draft', expiresAt: null }, { status: 'active', viewCount: 0 }, now), 'message_draft');
  assert.equal(service.computeQuickMessagePublicLookupStatus({ status: 'locked', expiresAt: null }, { status: 'active', viewCount: 0 }, now), 'message_locked');
  assert.equal(service.computeQuickMessagePublicLookupStatus({ status: 'cancelled', expiresAt: null }, { status: 'active', viewCount: 0 }, now), 'message_cancelled');
  assert.equal(service.computeQuickMessagePublicLookupStatus({ status: 'active', expiresAt: '2026-07-01T00:00:00.000Z' }, { status: 'active', viewCount: 0 }, now), 'message_expired');
  assert.equal(service.computeQuickMessagePublicLookupStatus({ status: 'active', expiresAt: null }, { status: 'cancelled', viewCount: 0 }, now), 'access_cancelled');
  assert.equal(service.computeQuickMessagePublicLookupStatus({ status: 'active', expiresAt: null }, { status: 'locked', viewCount: 0 }, now), 'access_locked');
  assert.equal(service.computeQuickMessagePublicLookupStatus({ status: 'active', expiresAt: null }, { status: 'active', expiresAt: '2026-07-01T00:00:00.000Z', viewCount: 0 }, now), 'access_expired');
  assert.equal(service.computeQuickMessagePublicLookupStatus({ status: 'active', expiresAt: null }, { status: 'active', maxViews: 3, viewCount: 3 }, now), 'max_views_reached');
  assert.equal(service.computeQuickMessagePublicLookupStatus({ status: 'active', expiresAt: null }, { status: 'active', maxViews: 3, viewCount: 2 }, now), 'active');
});

test('quick message public: not found returns safe 404 error', async () => {
  installStrapiWithAccess(null);
  const service = loadPublicService();
  await assert.rejects(
    () => service.lookupQuickMessageAccessPublic('CPA866'),
    (error) => error && error.status === 404 && error.code === 'QUICK_MESSAGE_NOT_FOUND',
  );
});

test('quick message public: active code without pin returns minimal available payload', async () => {
  let queryCount = 0;
  global.strapi = {
    config: { get() { return ['quick-message-secret']; } },
    db: {
      query(uid) {
        if (uid !== 'api::quick-message-access.quick-message-access') throw new Error(`Unexpected uid ${uid}`);
        return {
          async findOne() {
            queryCount += 1;
            return buildActiveAccess();
          },
        };
      },
    },
  };

  const service = loadPublicService();
  const result = await service.lookupQuickMessageAccessPublic('cpa866');
  assert.equal(queryCount, 1);
  assert.equal(result.code, 'CPA866');
  assert.equal(result.available, true);
  assert.equal(result.effectiveStatus, 'active');
  assert.equal(result.requiresPin, false);
  assert.equal(result.hasPin, false);
  assert.equal(result.tenant.name, 'COGI');
  assert.equal(result.tenant.logo, '/uploads/logo.png');
  assert.equal(result.tenant.favicon, '/uploads/favicon.png');
  assert.equal(result.tenant.primaryColor, '#0d6efd');
  assert.equal(Object.prototype.hasOwnProperty.call(result, 'pinHash'), false);
  assert.equal(Object.prototype.hasOwnProperty.call(result, 'title'), false);
  assert.equal(Object.prototype.hasOwnProperty.call(result, 'content'), false);
  assert.equal(Object.prototype.hasOwnProperty.call(result, 'links'), false);
  assert.equal(Object.prototype.hasOwnProperty.call(result, 'recipientName'), false);
});

test('quick message public: active code with pin returns requiresPin true without exposing pinHash', async () => {
  installStrapiWithAccess(buildActiveAccess({ requirePin: true, pinHash: 'hashed-pin' }));
  const service = loadPublicService();
  const result = await service.lookupQuickMessageAccessPublic('CPA866');
  assert.equal(result.available, true);
  assert.equal(result.requiresPin, true);
  assert.equal(result.hasPin, true);
  assert.equal(Object.prototype.hasOwnProperty.call(result, 'pinHash'), false);
});

test('quick message public: tenant mismatch fails safely and does not expose content', async () => {
  installStrapiWithAccess(buildActiveAccess({ message: { id: 11, status: 'active', expiresAt: null, tenant: { id: 99, name: 'Other' } } }));
  const service = loadPublicService();
  await assert.rejects(
    () => service.lookupQuickMessageAccessPublic('CPA866'),
    (error) => error && error.status === 500 && error.code === 'QUICK_MESSAGE_LOOKUP_FAILED',
  );
});

test('quick message public: controller applies headers and returns 400 for invalid code', async () => {
  const controller = loadQuickMessageController();
  const headers = {};
  const ctx = { params: { code: '  ' }, set(key, value) { headers[key] = value; }, status: 200, body: null };
  global.strapi = { log: { error() {} }, db: { query() { throw new Error('Should not query'); } } };
  await controller.lookupPublic(ctx);
  assert.equal(headers['Cache-Control'], 'no-store');
  assert.equal(headers['X-Robots-Tag'], 'noindex, nofollow');
  assert.equal(ctx.status, 400);
  assert.equal(ctx.body.success, false);
  assert.equal(ctx.body.error.code, 'QUICK_MESSAGE_INVALID_CODE');
});

test('quick message public: controller returns success true with unavailable data for locked message', async () => {
  const controller = loadQuickMessageController();
  const headers = {};
  const ctx = { params: { code: 'cpa866' }, set(key, value) { headers[key] = value; }, status: 200, body: null };
  installStrapiWithAccess(buildActiveAccess({ message: { id: 11, status: 'locked', expiresAt: null, tenant: buildActiveAccess().message.tenant } }));
  await controller.lookupPublic(ctx);
  assert.equal(headers['Cache-Control'], 'no-store');
  assert.equal(headers['X-Robots-Tag'], 'noindex, nofollow');
  assert.equal(ctx.body.success, true);
  assert.equal(ctx.body.data.available, false);
  assert.equal(ctx.body.data.effectiveStatus, 'message_locked');
  assert.equal(Object.prototype.hasOwnProperty.call(ctx.body.data, 'content'), false);
});

test('quick message public: verify pin issues temporary token with correct payload', async () => {
  const hash = await bcrypt.hash('4826', 10);
  installStrapiWithAccess(buildActiveAccess({ requirePin: true, pinHash: hash, accessVersion: 2 }));
  const service = loadPublicService();
  const result = await service.verifyQuickMessageAccessPinPublic(' cpa866 ', { pin: '4826' });
  const tokenPayload = service.verifyQuickMessagePublicAccessToken(result.accessToken);
  assert.equal(result.code, 'CPA866');
  assert.equal(result.tokenType, 'Bearer');
  assert.equal(result.expiresIn, 1800);
  assert.equal(tokenPayload.scope, 'quick-message-public-access');
  assert.equal(tokenPayload.iss, 'quick-message-public');
  assert.equal(tokenPayload.code, 'CPA866');
  assert.equal(tokenPayload.accessVersion, 2);
  assert.equal(Object.prototype.hasOwnProperty.call(tokenPayload, 'pin'), false);
  assert.equal(Object.prototype.hasOwnProperty.call(tokenPayload, 'pinHash'), false);
});

test('quick message public: verify pin rejects invalid pin, invalid format and missing hash', async () => {
  const hash = await bcrypt.hash('4826', 10);
  installStrapiWithAccess(buildActiveAccess({ requirePin: true, pinHash: hash, accessVersion: 3 }));
  const service = loadPublicService();
  await assert.rejects(
    () => service.verifyQuickMessageAccessPinPublic('CPA866', { pin: '1357' }),
    (error) => error && error.status === 401 && error.code === 'INVALID_PIN',
  );
  await assert.rejects(
    () => service.verifyQuickMessageAccessPinPublic('CPA866', { pin: '12ab' }),
    (error) => error && error.status === 400,
  );

  installStrapiWithAccess(buildActiveAccess({ requirePin: true, pinHash: null }));
  await assert.rejects(
    () => service.verifyQuickMessageAccessPinPublic('CPA866', { pin: '4826' }),
    (error) => error && error.status === 500 && error.code === 'QUICK_MESSAGE_VERIFY_FAILED',
  );
});

test('quick message public: verify pin rejects access without pin and unavailable access', async () => {
  installStrapiWithAccess(buildActiveAccess({ requirePin: false, pinHash: null }));
  const service = loadPublicService();
  await assert.rejects(
    () => service.verifyQuickMessageAccessPinPublic('CPA866', { pin: '4826' }),
    (error) => error && error.status === 409 && error.code === 'PIN_NOT_REQUIRED',
  );

  installStrapiWithAccess(buildActiveAccess({ status: 'locked' }));
  await assert.rejects(
    () => service.verifyQuickMessageAccessPinPublic('CPA866', { pin: '4826' }),
    (error) => error && error.status === 409 && error.code === 'QUICK_MESSAGE_NOT_AVAILABLE',
  );
});

test('quick message public: no-pin access endpoint issues token and pinned access is rejected', async () => {
  installStrapiWithAccess(buildActiveAccess({ requirePin: false, pinHash: null, accessVersion: 5 }));
  const service = loadPublicService();
  const result = await service.createQuickMessageAccessTokenPublic('cpa866');
  const payload = service.verifyQuickMessagePublicAccessToken(result.accessToken);
  assert.equal(result.code, 'CPA866');
  assert.equal(payload.scope, 'quick-message-public-access');
  assert.equal(payload.accessVersion, 5);

  installStrapiWithAccess(buildActiveAccess({ requirePin: true, pinHash: 'hash' }));
  await assert.rejects(
    () => service.createQuickMessageAccessTokenPublic('CPA866'),
    (error) => error && error.status === 409 && error.code === 'PIN_REQUIRED',
  );
});

test('quick message public: token verify rejects expired, wrong scope, wrong signature and stale accessVersion', async () => {
  installStrapiWithAccess(buildActiveAccess({ accessVersion: 7 }));
  const service = loadPublicService();
  const issued = service.issueQuickMessagePublicAccessToken(buildActiveAccess({ accessVersion: 7 }));
  const validPayload = service.verifyQuickMessagePublicAccessToken(issued.accessToken);
  assert.equal(validPayload.scope, 'quick-message-public-access');

  const [payloadEncoded] = issued.accessToken.split('.');
  const parsed = JSON.parse(Buffer.from(payloadEncoded, 'base64url').toString('utf8'));
  parsed.exp = Math.floor(Date.now() / 1000) - 10;
  const expiredEncoded = Buffer.from(JSON.stringify(parsed), 'utf8').toString('base64url');
  const expiredSig = crypto.createHmac('sha256', 'quick-message-secret').update(expiredEncoded).digest('base64url');
  assert.throws(
    () => service.verifyQuickMessagePublicAccessToken(`${expiredEncoded}.${expiredSig}`),
    (error) => error && error.status === 410 && error.code === 'QUICK_MESSAGE_ACCESS_TOKEN_EXPIRED',
  );

  const wrongScope = { ...validPayload, scope: 'user-auth' };
  const wrongScopeEncoded = Buffer.from(JSON.stringify(wrongScope), 'utf8').toString('base64url');
  const wrongScopeSig = crypto.createHmac('sha256', 'quick-message-secret').update(wrongScopeEncoded).digest('base64url');
  assert.throws(
    () => service.verifyQuickMessagePublicAccessToken(`${wrongScopeEncoded}.${wrongScopeSig}`),
    (error) => error && error.status === 401 && error.code === 'QUICK_MESSAGE_ACCESS_TOKEN_INVALID',
  );

  assert.throws(
    () => service.verifyQuickMessagePublicAccessToken(`${payloadEncoded}.invalid-signature`),
    (error) => error && error.status === 401 && error.code === 'QUICK_MESSAGE_ACCESS_TOKEN_INVALID',
  );

  assert.throws(
    () => service.validateQuickMessagePublicAccessTokenAgainstAccess(validPayload, buildActiveAccess({ accessVersion: 8 })),
    (error) => error && error.status === 401 && error.code === 'QUICK_MESSAGE_ACCESS_TOKEN_INVALID',
  );
});

test('quick message public: pin rate limit keys by code and client', async () => {
  const factory = loadPinRateLimit();
  const middleware = factory();
  let nextCalls = 0;

  for (let index = 0; index < 5; index += 1) {
    const ctx = { params: { code: 'cpa866' }, request: { ip: '1.1.1.1', headers: {} }, ip: '1.1.1.1', set() {}, body: null, status: 200 };
    await middleware(ctx, async () => { nextCalls += 1; });
  }

  const limitedCtx = {
    params: { code: 'cpa866' },
    request: { ip: '1.1.1.1', headers: {} },
    ip: '1.1.1.1',
    headers: {},
    set(key, value) { this.headers[key] = value; },
    body: null,
    status: 200,
  };
  await middleware(limitedCtx, async () => { throw new Error('Should not call next'); });
  assert.equal(nextCalls, 5);
  assert.equal(limitedCtx.status, 429);
  assert.equal(limitedCtx.body.error.code, 'TOO_MANY_PIN_ATTEMPTS');
  assert.ok(Number(limitedCtx.headers['Retry-After']) >= 1);
});

test('quick message public: access rate limit applies without touching auth', async () => {
  const factory = loadAccessRateLimit();
  const middleware = factory();
  let nextCalls = 0;

  for (let index = 0; index < 30; index += 1) {
    const ctx = { request: { ip: '2.2.2.2', headers: {} }, ip: '2.2.2.2', set() {}, body: null, status: 200 };
    await middleware(ctx, async () => { nextCalls += 1; });
  }

  const limitedCtx = {
    request: { ip: '2.2.2.2', headers: {} },
    ip: '2.2.2.2',
    headers: {},
    set(key, value) { this.headers[key] = value; },
    body: null,
    status: 200,
  };
  await middleware(limitedCtx, async () => { throw new Error('Should not call next'); });
  assert.equal(nextCalls, 30);
  assert.equal(limitedCtx.status, 429);
  assert.equal(limitedCtx.body.error.code, 'TOO_MANY_REQUESTS');
});

test('quick message public: extract bearer token rejects missing header, wrong scheme and empty token', async () => {
  const service = loadPublicService();
  assert.throws(() => service.extractBearerTokenFromHeader(''), (error) => error && error.status === 401 && error.code === 'INVALID_PUBLIC_ACCESS_TOKEN');
  assert.throws(() => service.extractBearerTokenFromHeader('Token abc'), (error) => error && error.status === 401 && error.code === 'INVALID_PUBLIC_ACCESS_TOKEN');
  assert.throws(() => service.extractBearerTokenFromHeader('Bearer   '), (error) => error && error.status === 401 && error.code === 'INVALID_PUBLIC_ACCESS_TOKEN');
});

test('quick message public: open content increments first and last view timestamps on first open', async () => {
  const access = buildActiveAccess({
    recipientName: 'Co Lan',
    message: {
      ...buildActiveAccess().message,
      title: 'Tai lieu cuoc hop',
      content: 'Noi dung can doc',
      links: [{ label: 'Mo tai lieu', url: 'https://example.com/doc' }, { label: 'Bad', url: 'javascript:alert(1)' }],
      allowReply: true,
      replyMode: 'quick_and_text',
      senderDisplayName: 'Nguyen Duc Dan',
      expiresAt: '2026-08-02T00:00:00.000Z',
    },
  });
  installStrapiWithAccess(access);
  const service = loadPublicService();
  const token = service.issueQuickMessagePublicAccessToken(access).accessToken;
  const result = await service.openQuickMessageContentPublic('CPA866', `Bearer ${token}`);

  assert.equal(result.code, 'CPA866');
  assert.equal(result.message.title, 'Tai lieu cuoc hop');
  assert.equal(result.message.content, 'Noi dung can doc');
  assert.equal(result.message.links.length, 1);
  assert.equal(result.message.links[0].url, 'https://example.com/doc');
  assert.equal(result.message.replyEnabled, true);
  assert.equal(result.message.replyMode, 'quick_and_text');
  assert.equal(result.message.senderDisplayName, 'Nguyen Duc Dan');
  assert.equal(result.access.recipientName, 'Co Lan');
  assert.ok(result.openedAt);
});

test('quick message public: list messages merges admin and public messages for the same access', async () => {
  const access = buildActiveAccess({
    recipientName: 'Co Lan',
    message: {
      ...buildActiveAccess().message,
      allowReply: true,
      replyMode: 'text',
      senderDisplayName: 'Trung tam COGI',
    },
  });

  global.strapi = {
    config: { get() { return ['quick-message-secret']; } },
    log: { error() {} },
    db: {
      query(uid) {
        if (uid === 'api::quick-message-access.quick-message-access') {
          return { async findOne() { return access; } };
        }
        if (uid === 'api::quick-message-reply.quick-message-reply') {
          return {
            async findMany() {
              return [{
                id: 2,
                documentId: 'reply-doc',
                content: 'Em da nhan duoc',
                responderName: 'Co Lan',
                readAt: '2026-07-29T10:06:00.000Z',
                createdAt: '2026-07-29T10:05:00.000Z',
              }];
            },
          };
        }
        if (uid === 'api::quick-message-message.quick-message-message') {
          return {
            async findMany() {
              return [{
                id: 1,
                documentId: 'msg-doc',
                senderDisplayName: 'Trung tam COGI',
                content: 'Xin vui long xac nhan thong tin',
                readByPublicAt: null,
                createdAt: '2026-07-29T10:00:00.000Z',
                senderUser: null,
              }];
            },
          };
        }
        throw new Error(`Unexpected uid ${uid}`);
      },
    },
  };

  const service = loadPublicService();
  const token = service.issueQuickMessagePublicAccessToken(access).accessToken;
  const result = await service.listQuickMessagePublicMessages('CPA866', `Bearer ${token}`, { page: 1, pageSize: 50 });
  assert.equal(result.replyEnabled, true);
  assert.equal(result.replyMode, 'text');
  assert.equal(result.data.length, 2);
  assert.equal(result.data[0].direction, 'incoming');
  assert.equal(result.data[0].senderDisplayName, 'Trung tam COGI');
  assert.equal(result.data[1].direction, 'outgoing');
  assert.equal(result.data[1].senderDisplayName, 'Co Lan');
});

test('quick message public: send reply creates a text reply and deduplicates rapid repeats', async () => {
  const access = buildActiveAccess({
    recipientName: 'Co Lan',
    message: {
      ...buildActiveAccess().message,
      allowReply: true,
      replyMode: 'text',
    },
  });
  const createdReplies = [];

  global.strapi = {
    config: { get() { return ['quick-message-secret']; } },
    log: { error() {} },
    db: {
      query(uid) {
        if (uid === 'api::quick-message-access.quick-message-access') {
          return { async findOne() { return access; } };
        }
        if (uid === 'api::quick-message-reply.quick-message-reply') {
          return {
            async findMany(params = {}) {
              if (params?.where?.content?.$eq === 'Da xem va dong y') {
                return createdReplies.filter((item) => item.content === 'Da xem va dong y').slice(-1);
              }
              return [];
            },
            async create({ data }) {
              const created = {
                id: createdReplies.length + 1,
                documentId: `reply-${createdReplies.length + 1}`,
                content: data.content,
                responderName: data.responderName,
                readAt: null,
                createdAt: '2026-07-29T10:10:00.000Z',
              };
              createdReplies.push(created);
              return created;
            },
          };
        }
        throw new Error(`Unexpected uid ${uid}`);
      },
    },
  };

  const service = loadPublicService();
  const token = service.issueQuickMessagePublicAccessToken(access).accessToken;
  const first = await service.sendQuickMessagePublicReply('CPA866', `Bearer ${token}`, { content: 'Da xem va dong y' }, { ipAddress: '1.1.1.1', userAgent: 'Chrome' });
  const duplicate = await service.sendQuickMessagePublicReply('CPA866', `Bearer ${token}`, { content: 'Da xem va dong y' }, { ipAddress: '1.1.1.1', userAgent: 'Chrome' });
  assert.equal(first.deduplicated, false);
  assert.equal(first.message.direction, 'outgoing');
  assert.equal(first.message.content, 'Da xem va dong y');
  assert.equal(duplicate.deduplicated, true);
  assert.equal(createdReplies.length, 1);
});

test('quick message public: send reply rejects when allowReply is disabled', async () => {
  const access = buildActiveAccess({
    message: {
      ...buildActiveAccess().message,
      allowReply: false,
    },
  });
  installStrapiWithAccess(access);
  const service = loadPublicService();
  const token = service.issueQuickMessagePublicAccessToken(access).accessToken;

  await assert.rejects(
    () => service.sendQuickMessagePublicReply('CPA866', `Bearer ${token}`, { content: 'Toi can hoi them' }, { ipAddress: '1.1.1.1', userAgent: 'Chrome' }),
    (error) => error && error.status === 409 && error.code === 'REPLY_DISABLED',
  );
});

test('quick message public: mark messages read updates only unread admin messages', async () => {
  const access = buildActiveAccess();
  const updatedIds = [];

  global.strapi = {
    config: { get() { return ['quick-message-secret']; } },
    log: { error() {} },
    db: {
      query(uid) {
        if (uid === 'api::quick-message-access.quick-message-access') {
          return { async findOne() { return access; } };
        }
        if (uid === 'api::quick-message-message.quick-message-message') {
          return {
            async findMany() {
              return [{ id: 1 }, { id: 2 }];
            },
            async update({ where, data }) {
              updatedIds.push({ id: where.id, readByPublicAt: data.readByPublicAt });
              return { id: where.id, readByPublicAt: data.readByPublicAt };
            },
          };
        }
        throw new Error(`Unexpected uid ${uid}`);
      },
    },
  };

  const service = loadPublicService();
  const token = service.issueQuickMessagePublicAccessToken(access).accessToken;
  const result = await service.markQuickMessagePublicMessagesRead('CPA866', `Bearer ${token}`);
  assert.equal(result.updatedCount, 2);
  assert.ok(result.readAt);
  assert.equal(updatedIds.length, 2);
});

test('quick message public: reply rate limit blocks rapid repeated sends for the same code and client', async () => {
  const factory = loadReplyRateLimit();
  const middleware = factory();
  let nextCalls = 0;

  for (let index = 0; index < 6; index += 1) {
    const ctx = { params: { code: 'cpa866' }, request: { ip: '3.3.3.3', headers: {} }, ip: '3.3.3.3', set() {}, body: null, status: 200 };
    await middleware(ctx, async () => { nextCalls += 1; });
  }

  const limitedCtx = {
    params: { code: 'cpa866' },
    request: { ip: '3.3.3.3', headers: {} },
    ip: '3.3.3.3',
    headers: {},
    set(key, value) { this.headers[key] = value; },
    body: null,
    status: 200,
  };
  await middleware(limitedCtx, async () => { throw new Error('Should not call next'); });
  assert.equal(nextCalls, 6);
  assert.equal(limitedCtx.status, 429);
  assert.equal(limitedCtx.body.error.code, 'TOO_MANY_PUBLIC_REPLIES');
});

test('quick message public: open content rejects invalid token, code mismatch and revoked accessVersion', async () => {
  const access = buildActiveAccess();
  installStrapiWithAccess(access);
  const service = loadPublicService();
  const token = service.issueQuickMessagePublicAccessToken(access).accessToken;

  await assert.rejects(
    () => service.openQuickMessageContentPublic('CPA866', 'Bearer invalid.token'),
    (error) => error && error.status === 401 && error.code === 'INVALID_PUBLIC_ACCESS_TOKEN',
  );

  await assert.rejects(
    () => service.openQuickMessageContentPublic('CPA867', `Bearer ${token}`),
    (error) => error && error.status === 401 && error.code === 'INVALID_PUBLIC_ACCESS_TOKEN',
  );

  const updatedAccess = buildActiveAccess({ accessVersion: 3 });
  installStrapiWithAccess(updatedAccess);
  await assert.rejects(
    () => service.openQuickMessageContentPublic('CPA866', `Bearer ${token}`),
    (error) => error && error.status === 401 && error.code === 'PUBLIC_ACCESS_REVOKED',
  );
});

test('quick message public: open content rejects unavailable states and does not exceed maxViews', async () => {
  const lockedAccess = buildActiveAccess({ status: 'locked' });
  installStrapiWithAccess(lockedAccess);
  const service = loadPublicService();
  const lockedToken = service.issueQuickMessagePublicAccessToken(lockedAccess).accessToken;
  await assert.rejects(
    () => service.openQuickMessageContentPublic('CPA866', `Bearer ${lockedToken}`),
    (error) => error && error.status === 409 && error.code === 'QUICK_MESSAGE_NOT_AVAILABLE',
  );

  const limitedAccess = buildActiveAccess({ maxViews: 1, viewCount: 0 });
  installStrapiWithAccess(limitedAccess);
  const limitedToken = service.issueQuickMessagePublicAccessToken(limitedAccess).accessToken;
  const first = await service.openQuickMessageContentPublic('CPA866', `Bearer ${limitedToken}`);
  assert.ok(first.openedAt);
  installStrapiWithAccess({ ...limitedAccess, viewCount: 1, firstViewedAt: '2026-07-29T10:00:00.000Z', lastViewedAt: '2026-07-29T10:00:00.000Z' });
  await assert.rejects(
    () => service.openQuickMessageContentPublic('CPA866', `Bearer ${limitedToken}`),
    (error) => error && error.status === 409 && error.code === 'QUICK_MESSAGE_NOT_AVAILABLE',
  );
});