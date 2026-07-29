const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

function loadService() {
  const modulePath = path.join(__dirname, '..', 'dist', 'src', 'api', 'quick-message', 'services', 'quick-message-admin.js');
  delete require.cache[require.resolve(modulePath)];
  return require(modulePath);
}

test('quick message admin: create message creates initial access with tenant scope and one-time plain pin', async () => {
  const creates = [];
  global.strapi = {
    db: {
      transaction: async (callback) => callback({ trx: { id: 'trx-1' } }),
      query(uid) {
        if (uid === 'api::quick-message.quick-message') {
          return {
            async create(params) {
              creates.push({ uid, params });
              return {
                id: 101,
                documentId: 'msg-doc-101',
                title: params.data.title,
                status: params.data.status,
                expiresAt: params.data.expiresAt,
                allowReply: params.data.allowReply,
                replyMode: params.data.replyMode,
              };
            },
          };
        }

        if (uid === 'api::quick-message-access.quick-message-access') {
          return {
            async findOne() {
              return null;
            },
            async create(params) {
              creates.push({ uid, params });
              return {
                id: 202,
                documentId: 'acc-doc-202',
                ...params.data,
              };
            },
          };
        }

        throw new Error(`Unexpected uid ${uid}`);
      },
    },
  };

  const service = loadService();
  const data = await service.createQuickMessage({
    title: '  Tai lieu hop  ',
    content: '  Noi dung  ',
    tenant: 999,
    sender: 888,
    senderDisplayName: 'fake',
    links: [{ label: '  ', url: 'https://example.com/doc' }],
    initialAccess: {
      label: '  Ma dau tien  ',
      recipientName: '  Co Lan  ',
      code: 'SHOULD_NOT_BE_USED',
      pinHash: 'SHOULD_NOT_BE_USED',
      requirePin: true,
      pin: '4826',
      maxViews: 3,
    },
  }, 7, {
    id: 11,
    username: 'dan',
    email: 'dan@example.com',
    fullName: 'Nguyen Duc Dan',
  });

  assert.equal(data.message.id, 101);
  assert.equal(data.message.title, 'Tai lieu hop');
  assert.equal(data.access.id, 202);
  assert.equal(data.access.code.length, 6);
  assert.match(data.access.code, /^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{6}$/);
  assert.equal(data.access.requirePin, true);
  assert.equal(data.access.hasPin, true);
  assert.equal(data.access.viewCount, 0);
  assert.equal(data.plainPin, '4826');
  assert.equal(Object.prototype.hasOwnProperty.call(data.access, 'pinHash'), false);

  const messageCreate = creates.find((entry) => entry.uid === 'api::quick-message.quick-message');
  assert.equal(messageCreate.params.data.tenant, 7);
  assert.equal(messageCreate.params.data.sender, 11);
  assert.equal(messageCreate.params.data.senderDisplayName, 'Nguyen Duc Dan');
  assert.equal(Array.isArray(messageCreate.params.data.links), true);
  assert.equal(messageCreate.params.data.links[0].label, 'example.com');

  const accessCreate = creates.find((entry) => entry.uid === 'api::quick-message-access.quick-message-access');
  assert.equal(accessCreate.params.data.tenant, 7);
  assert.equal(accessCreate.params.data.message, 101);
  assert.equal(accessCreate.params.data.code, data.access.code);
  assert.equal(accessCreate.params.data.accessVersion, 1);
  assert.equal(accessCreate.params.data.viewCount, 0);
  assert.equal(accessCreate.params.data.pinHash === '4826', false);
  assert.equal(typeof accessCreate.params.data.pinHash, 'string');
});

test('quick message admin: create message defaults expiresAt about 24 hours ahead', async () => {
  let createdExpiresAt = null;
  global.strapi = {
    db: {
      transaction: async (callback) => callback({ trx: { id: 'trx-2' } }),
      query(uid) {
        if (uid === 'api::quick-message.quick-message') {
          return {
            async create(params) {
              createdExpiresAt = params.data.expiresAt;
              return {
                id: 301,
                documentId: 'msg-doc-301',
                ...params.data,
              };
            },
          };
        }

        if (uid === 'api::quick-message-access.quick-message-access') {
          return {
            async findOne() {
              return null;
            },
            async create(params) {
              return {
                id: 302,
                documentId: 'acc-doc-302',
                ...params.data,
              };
            },
          };
        }

        throw new Error(`Unexpected uid ${uid}`);
      },
    },
  };

  const service = loadService();
  const before = Date.now();
  const data = await service.createQuickMessage({
    title: 'Message',
    initialAccess: {
      label: 'A',
      requirePin: false,
    },
  }, 5, { id: 9, username: 'u9' });
  const after = Date.now();
  const expiresAtMs = new Date(createdExpiresAt || Date.now()).getTime();

  assert.equal(data.plainPin, null);
  assert.ok(expiresAtMs >= before + 23 * 60 * 60 * 1000);
  assert.ok(expiresAtMs <= after + 25 * 60 * 60 * 1000);
});

test('quick message admin: create message rejects missing or invalid PIN when required', async () => {
  const service = loadService();
  global.strapi = {
    db: {
      transaction: async (callback) => callback({ trx: { id: 'trx-3' } }),
      query(uid) {
        if (uid === 'api::quick-message.quick-message') {
          return {
            async create(params) {
              return { id: 401, documentId: 'm-401', ...params.data };
            },
          };
        }
        if (uid === 'api::quick-message-access.quick-message-access') {
          return {
            async findOne() {
              return null;
            },
            async create() {
              throw new Error('Should not create access when pin is invalid');
            },
          };
        }
        throw new Error(`Unexpected uid ${uid}`);
      },
    },
  };

  await assert.rejects(
    () => service.createQuickMessage({
      title: 'Message',
      initialAccess: { requirePin: true },
    }, 7, { id: 1, username: 'u1' }),
    (error) => error && error.status === 400 && /pin must contain 4 to 6 digits/i.test(error.message),
  );

  await assert.rejects(
    () => service.createQuickMessage({
      title: 'Message',
      initialAccess: { requirePin: true, pin: '12ab' },
    }, 7, { id: 1, username: 'u1' }),
    (error) => error && error.status === 400 && /pin must contain 4 to 6 digits/i.test(error.message),
  );

  await assert.rejects(
    () => service.createQuickMessage({
      title: 'Message',
      status: 'cancelled',
      initialAccess: { requirePin: false },
    }, 7, { id: 1, username: 'u1' }),
    (error) => error && error.status === 400 && /status must be one of/i.test(error.message),
  );
});

test('quick message admin: validateLinks rejects javascript URLs', async () => {
  const service = loadService();
  assert.throws(
    () => service.validateLinks([{ label: 'Bad', url: 'javascript:alert(1)' }]),
    (error) => error && error.status === 400 && /protocol is not allowed/i.test(error.message),
  );
});

test('quick message admin: generateUniqueAccessCode retries collisions', async () => {
  const originalRandom = Math.random;
  const seenCodes = [];
  let callCount = 0;
  global.strapi = {
    db: {
      query(uid) {
        if (uid !== 'api::quick-message-access.quick-message-access') {
          throw new Error(`Unexpected uid ${uid}`);
        }
        return {
          async findOne(params) {
            seenCodes.push(params.where.code);
            callCount += 1;
            return callCount === 1 ? { id: 999 } : null;
          },
        };
      },
    },
  };

  const service = loadService();
  const sequence = [0, 0, 0, 0, 0, 0, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7];
  let index = 0;
  Math.random = () => sequence[index++ % sequence.length];

  const code = await service.generateUniqueAccessCode();
  Math.random = originalRandom;

  assert.equal(seenCodes.length, 2);
  assert.notEqual(seenCodes[0], seenCodes[1]);
  assert.equal(code, seenCodes[1]);
});

test('quick message admin: tenant scope is merged when loading detail', async () => {
  let capturedWhere = null;
  global.strapi = {
    db: {
      query(uid) {
        if (uid === 'api::quick-message.quick-message') {
          return {
            async findOne(params) {
              capturedWhere = params.where;
              return {
                id: 501,
                documentId: 'msg-501',
                title: 'Scoped message',
                status: 'active',
                allowReply: true,
                replyMode: 'quick_and_text',
              };
            },
          };
        }
        if (uid === 'api::quick-message-access.quick-message-access' || uid === 'api::quick-message-reply.quick-message-reply') {
          return {
            async findMany() {
              return [];
            },
          };
        }
        throw new Error(`Unexpected uid ${uid}`);
      },
    },
  };

  const service = loadService();
  await service.getQuickMessageDetail('doc-tenant-check', 77);

  assert.ok(capturedWhere.$and);
  assert.equal(capturedWhere.$and[1].tenant.id.$eq, 77);
  assert.equal(capturedWhere.$and[0].documentId, 'doc-tenant-check');
});

test('quick message admin: pin actions increment accessVersion and clear pinHash on disable', async () => {
  const updates = [];
  global.strapi = {
    db: {
      query(uid) {
        if (uid === 'api::quick-message-access.quick-message-access') {
          return {
            async findOne() {
              return {
                id: 601,
                documentId: 'acc-601',
                code: 'K7M4PD',
                requirePin: true,
                pinHash: 'old-hash',
                accessVersion: 2,
                status: 'active',
                viewCount: 0,
                message: { id: 1, status: 'active' },
              };
            },
            async update(params) {
              updates.push(params.data);
              return {
                id: 601,
                documentId: 'acc-601',
                code: 'K7M4PD',
                requirePin: params.data.requirePin,
                pinHash: params.data.pinHash,
                accessVersion: params.data.accessVersion,
                status: params.data.status || 'active',
                viewCount: 0,
                message: { id: 1, status: 'active' },
              };
            },
          };
        }
        throw new Error(`Unexpected uid ${uid}`);
      },
    },
  };

  const service = loadService();
  const enabled = await service.changeQuickMessageAccessPin(601, { pin: '2468' }, 8);
  const disabled = await service.disableQuickMessageAccessPin(601, 8);

  assert.equal(enabled.plainPin, '2468');
  assert.equal(enabled.access.accessVersion, 3);
  assert.equal(enabled.access.requirePin, true);
  assert.equal(disabled.plainPin, null);
  assert.equal(disabled.access.accessVersion, 3);
  assert.equal(disabled.access.requirePin, false);
  assert.equal(updates[1].pinHash, null);
});

test('quick message admin: disable-pin is a no-op when access does not use PIN', async () => {
  let updateCalled = false;
  global.strapi = {
    db: {
      query(uid) {
        if (uid !== 'api::quick-message-access.quick-message-access') {
          throw new Error(`Unexpected uid ${uid}`);
        }
        return {
          async findOne() {
            return {
              id: 701,
              documentId: 'acc-701',
              code: 'K7M4PD',
              requirePin: false,
              pinHash: null,
              accessVersion: 4,
              status: 'active',
              viewCount: 0,
              message: { id: 1, status: 'active' },
            };
          },
          async update() {
            updateCalled = true;
            throw new Error('Should not update when access already has no PIN');
          },
        };
      },
    },
  };

  const service = loadService();
  const result = await service.disableQuickMessageAccessPin(701, 8);

  assert.equal(updateCalled, false);
  assert.equal(result.plainPin, null);
  assert.equal(result.access.requirePin, false);
  assert.equal(result.access.accessVersion, 4);
});

test('quick message admin: enable-pin rejects access that already has PIN', async () => {
  global.strapi = {
    db: {
      query(uid) {
        if (uid !== 'api::quick-message-access.quick-message-access') {
          throw new Error(`Unexpected uid ${uid}`);
        }
        return {
          async findOne() {
            return {
              id: 702,
              documentId: 'acc-702',
              code: 'K7M4PD',
              requirePin: true,
              pinHash: 'existing-hash',
              accessVersion: 4,
              status: 'active',
              viewCount: 0,
              message: { id: 1, status: 'active' },
            };
          },
        };
      },
    },
  };

  const service = loadService();
  await assert.rejects(
    () => service.enableQuickMessageAccessPin(702, { pin: '1357' }, 8),
    (error) => error && error.status === 409 && /use change-pin instead/i.test(error.message),
  );
});

test('quick message admin: effective access status follows message lock and cancel precedence', async () => {
  const service = loadService();

  assert.equal(
    service.computeAccessEffectiveStatus({ status: 'locked', expiresAt: null }, { status: 'active', viewCount: 0, maxViews: null }),
    'locked',
  );
  assert.equal(
    service.computeAccessEffectiveStatus({ status: 'cancelled', expiresAt: null }, { status: 'active', viewCount: 0, maxViews: null }),
    'cancelled',
  );
  assert.equal(
    service.computeAccessEffectiveStatus({ status: 'active', expiresAt: new Date(Date.now() - 1000).toISOString() }, { status: 'active', viewCount: 0, maxViews: null }),
    'expired',
  );
});

test('quick message admin: create message bubbles transaction failure when initial access create fails', async () => {
  let transactionCalled = false;
  let messageCreateCalled = false;
  global.strapi = {
    db: {
      transaction: async (callback) => {
        transactionCalled = true;
        return callback({ trx: { id: 'trx-rollback' } });
      },
      query(uid) {
        if (uid === 'api::quick-message.quick-message') {
          return {
            async create(params) {
              messageCreateCalled = true;
              return { id: 801, documentId: 'msg-801', ...params.data };
            },
          };
        }
        if (uid === 'api::quick-message-access.quick-message-access') {
          return {
            async findOne() {
              return null;
            },
            async create() {
              throw new Error('create access failed');
            },
          };
        }
        throw new Error(`Unexpected uid ${uid}`);
      },
    },
  };

  const service = loadService();
  await assert.rejects(
    () => service.createQuickMessage({
      title: 'Message',
      initialAccess: { requirePin: false },
    }, 3, { id: 1, username: 'u1' }),
    /create access failed/i,
  );

  assert.equal(transactionCalled, true);
  assert.equal(messageCreateCalled, true);
});

test('quick message admin: read-all scopes updates to unread replies of the selected tenant message', async () => {
  const updateWheres = [];
  global.strapi = {
    db: {
      query(uid) {
        if (uid === 'api::quick-message.quick-message') {
          return {
            async findOne() {
              return { id: 901, documentId: 'msg-901', title: 'M1', status: 'active' };
            },
          };
        }
        if (uid === 'api::quick-message-reply.quick-message-reply') {
          return {
            async findMany() {
              return [{ id: 1 }, { id: 2 }];
            },
            async update(params) {
              updateWheres.push(params.where);
              return { id: params.where.$and[0].id };
            },
          };
        }
        throw new Error(`Unexpected uid ${uid}`);
      },
    },
  };

  const service = loadService();
  const result = await service.markQuickMessageRepliesReadAll(901, 55);

  assert.equal(result.updatedCount, 2);
  assert.equal(updateWheres.length, 2);
  assert.equal(updateWheres[0].$and[1].tenant.id.$eq, 55);
  assert.equal(updateWheres[1].$and[1].tenant.id.$eq, 55);
});

test('quick message admin: clone access batch creates active clones with new codes and resets access history', async () => {
  const createdRows = [];
  let codeCall = 0;
  global.strapi = {
    db: {
      transaction: async (callback) => callback({ trx: { id: 'trx-clone' } }),
      query(uid) {
        if (uid === 'api::quick-message-access.quick-message-access') {
          return {
            async findOne(params) {
              const where = params?.where || {};
              if (where?.$and) {
                return {
                  id: 910,
                  documentId: 'acc-910',
                  code: 'CPA866',
                  label: 'Gửi học viên',
                  recipientName: 'Nguyen Van A',
                  requirePin: true,
                  pinHash: 'hashed-pin',
                  accessVersion: 4,
                  status: 'locked',
                  expiresAt: '2026-08-01T00:00:00.000Z',
                  maxViews: 3,
                  viewCount: 7,
                  firstViewedAt: '2026-07-01T00:00:00.000Z',
                  lastViewedAt: '2026-07-02T00:00:00.000Z',
                  lockedAt: '2026-07-03T00:00:00.000Z',
                  tenant: { id: 12 },
                  message: {
                    id: 88,
                    status: 'active',
                    expiresAt: '2026-08-15T00:00:00.000Z',
                    tenant: { id: 12 },
                  },
                };
              }

              codeCall += 1;
              return null;
            },
            async create(params) {
              createdRows.push(params.data);
              return {
                id: 920 + createdRows.length,
                documentId: `clone-${createdRows.length}`,
                ...params.data,
              };
            },
          };
        }
        throw new Error(`Unexpected uid ${uid}`);
      },
    },
  };

  const originalRandom = Math.random;
  const sequence = [0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.21, 0.31, 0.41, 0.51, 0.61, 0.71];
  let randomIndex = 0;
  Math.random = () => sequence[randomIndex++ % sequence.length];

  const service = loadService();
  const result = await service.cloneQuickMessageAccessBatch(910, {
    quantity: 2,
    startIndex: 3,
    appendIndexToLabel: true,
    appendIndexToRecipientName: false,
    separator: ' #',
  }, 12);

  Math.random = originalRandom;

  assert.equal(result.quantity, 2);
  assert.equal(result.accesses.length, 2);
  assert.equal(createdRows.length, 2);
  assert.equal(createdRows[0].code === createdRows[1].code, false);
  assert.equal(createdRows[0].label, 'Gửi học viên#03');
  assert.equal(createdRows[1].label, 'Gửi học viên#04');
  assert.equal(createdRows[0].recipientName, 'Nguyen Van A');
  assert.equal(createdRows[0].requirePin, true);
  assert.equal(createdRows[0].pinHash, 'hashed-pin');
  assert.equal(createdRows[0].status, 'active');
  assert.equal(createdRows[0].accessVersion, 1);
  assert.equal(createdRows[0].viewCount, 0);
  assert.equal(createdRows[0].firstViewedAt, null);
  assert.equal(createdRows[0].lastViewedAt, null);
  assert.equal(createdRows[0].lockedAt, null);
  assert.equal(result.accesses[0].status, 'active');
  assert.equal(Object.prototype.hasOwnProperty.call(result.accesses[0], 'pinHash'), false);
});

test('quick message admin: clone access batch rejects cancelled source access', async () => {
  global.strapi = {
    db: {
      query(uid) {
        if (uid !== 'api::quick-message-access.quick-message-access') {
          throw new Error(`Unexpected uid ${uid}`);
        }
        return {
          async findOne() {
            return {
              id: 930,
              status: 'cancelled',
              requirePin: false,
              pinHash: null,
              tenant: { id: 5 },
              message: { id: 91, status: 'active', expiresAt: null, tenant: { id: 5 } },
            };
          },
        };
      },
    },
  };

  const service = loadService();
  await assert.rejects(
    () => service.cloneQuickMessageAccessBatch(930, { quantity: 2 }, 5),
    (error) => error && error.status === 409 && /cancelled quick message access/i.test(error.message),
  );
});