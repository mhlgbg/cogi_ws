const test = require('node:test');
const assert = require('node:assert/strict');
const {
  ensureUserHasAuthenticatedRole,
} = require('../src/api/auth-extended/services/ensure-authenticated-role');

test('activate quick test: assign Authenticated role when user has no role', async () => {
  const updates = [];

  const strapiMock = {
    db: {
      query(uid) {
        if (uid === 'plugin::users-permissions.user') {
          return {
            async findOne() {
              return { id: 10, role: null };
            },
          };
        }

        if (uid === 'plugin::users-permissions.role') {
          return {
            async findOne(params) {
              if (params?.where?.name === 'Authenticated') {
                return { id: 2, name: 'Authenticated', type: 'authenticated' };
              }

              return null;
            },
          };
        }

        throw new Error(`Unexpected query uid: ${uid}`);
      },
    },
    entityService: {
      async update(uid, id, payload) {
        updates.push({ uid, id, payload });
      },
    },
  };

  const result = await ensureUserHasAuthenticatedRole(strapiMock, 10);

  assert.equal(result.hasRoleBefore, false);
  assert.equal(result.roleAssigned, true);
  assert.equal(result.assignedRoleId, 2);
  assert.equal(updates.length, 1);
  assert.equal(updates[0].uid, 'plugin::users-permissions.user');
  assert.equal(updates[0].id, 10);
  assert.equal(updates[0].payload.data.role, 2);
});

test('activate quick test: keep current role when user already has role', async () => {
  const updates = [];

  const strapiMock = {
    db: {
      query(uid) {
        if (uid === 'plugin::users-permissions.user') {
          return {
            async findOne() {
              return { id: 11, role: { id: 7, name: 'Some Role' } };
            },
          };
        }

        if (uid === 'plugin::users-permissions.role') {
          return {
            async findOne() {
              throw new Error('Role lookup should not run when user already has role');
            },
          };
        }

        throw new Error(`Unexpected query uid: ${uid}`);
      },
    },
    entityService: {
      async update(uid, id, payload) {
        updates.push({ uid, id, payload });
      },
    },
  };

  const result = await ensureUserHasAuthenticatedRole(strapiMock, 11);

  assert.equal(result.hasRoleBefore, true);
  assert.equal(result.roleAssigned, false);
  assert.equal(result.assignedRoleId, 7);
  assert.equal(updates.length, 0);
});
