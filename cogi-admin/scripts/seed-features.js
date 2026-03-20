'use strict';

const FEATURE_GROUP_UID = 'api::feature-group.feature-group';
const FEATURE_UID = 'api::feature.feature';
const ROLE_FEATURE_UID = 'api::role-feature.role-feature';
const TENANT_UID = 'api::tenant.tenant';
const TENANT_FEATURE_UID = 'api::tenant-feature.tenant-feature';
const ROLE_UID = 'plugin::users-permissions.role';

const FEATURE_GROUP_SEEDS = [
  { name: 'General', code: 'general', order: 1, icon: 'cilSpeedometer' },
  { name: 'IAM', code: 'iam', order: 2, icon: 'cilUser' },
  { name: 'HRM', code: 'hrm', order: 3, icon: 'cilPeople' },
  { name: 'Workflow', code: 'workflow', order: 4, icon: 'cilTask' },
];

const FEATURE_SEEDS = [
  {
    name: 'Dashboard',
    key: 'dashboard.view',
    groupCode: 'general',
    order: 1,
    description: 'Dashboard page',
  },
  {
    name: 'Users',
    key: 'user.list',
    groupCode: 'iam',
    order: 1,
    description: 'User management',
  },
  {
    name: 'Employees',
    key: 'employee.list',
    groupCode: 'hrm',
    order: 1,
    description: 'Employee management',
  },
  {
    name: 'Requests',
    key: 'request.list',
    groupCode: 'workflow',
    order: 1,
    description: 'Request management',
  },
];

function toText(value) {
  if (value === null || value === undefined) return '';
  return String(value).trim();
}

async function ensureFeatureGroup(seed) {
  const existing = await strapi.db.query(FEATURE_GROUP_UID).findOne({
    where: { code: seed.code },
    select: ['id', 'name', 'code'],
  });

  if (existing) {
    console.log(`Skip existing FeatureGroup: ${seed.code}`);
    return existing;
  }

  const created = await strapi.db.query(FEATURE_GROUP_UID).create({
    data: {
      name: seed.name,
      code: seed.code,
      order: seed.order,
      icon: seed.icon,
    },
    select: ['id', 'name', 'code'],
  });

  console.log(`Created FeatureGroup: ${created.name}`);
  return created;
}

async function ensureFeature(seed, groupId) {
  const existing = await strapi.db.query(FEATURE_UID).findOne({
    where: { key: seed.key },
    select: ['id', 'name', 'key'],
  });

  if (existing) {
    console.log(`Skip existing Feature: ${seed.key}`);
    return existing;
  }

  const created = await strapi.db.query(FEATURE_UID).create({
    data: {
      name: seed.name,
      key: seed.key,
      group: groupId,
      order: seed.order,
      description: seed.description,
      path: seed.path || null,
    },
    select: ['id', 'name', 'key'],
  });

  console.log(`Created Feature: ${created.key}`);
  return created;
}

async function findAuthenticatedRole() {
  let role = await strapi.db.query(ROLE_UID).findOne({
    where: { type: 'authenticated' },
    select: ['id', 'name', 'type'],
  });

  if (!role) {
    role = await strapi.db.query(ROLE_UID).findOne({
      where: { name: 'Authenticated' },
      select: ['id', 'name', 'type'],
    });
  }

  if (!role) {
    throw new Error('Authenticated role not found in users-permissions');
  }

  return role;
}

async function ensureRoleFeature(role, feature) {
  const existing = await strapi.db.query(ROLE_FEATURE_UID).findOne({
    where: {
      role: role.id,
      feature: feature.id,
    },
    select: ['id'],
  });

  const roleLabel = role.name || role.type || `Role#${role.id}`;

  if (existing) {
    console.log(`Skip existing RoleFeature: ${roleLabel} → ${feature.key}`);
    return existing;
  }

  const created = await strapi.db.query(ROLE_FEATURE_UID).create({
    data: {
      role: role.id,
      feature: feature.id,
    },
    select: ['id'],
  });

  console.log(`Created RoleFeature: ${roleLabel} → ${feature.key}`);
  return created;
}

async function ensureTenantFeature(tenant, feature) {
  const existing = await strapi.db.query(TENANT_FEATURE_UID).findOne({
    where: {
      tenant: tenant.id,
      feature: feature.id,
    },
    select: ['id'],
  });

  const tenantLabel = toText(tenant.name) || toText(tenant.code) || `Tenant#${tenant.id}`;

  if (existing) {
    console.log(`Skip existing TenantFeature: ${tenantLabel} → ${feature.key}`);
    return existing;
  }

  const created = await strapi.db.query(TENANT_FEATURE_UID).create({
    data: {
      tenant: tenant.id,
      feature: feature.id,
      isEnabled: true,
    },
    select: ['id'],
  });

  console.log(`Created TenantFeature: ${tenantLabel} → ${feature.key}`);
  return created;
}

async function seedFeatureGroups() {
  const groupsByCode = new Map();

  for (const seed of FEATURE_GROUP_SEEDS) {
    const group = await ensureFeatureGroup(seed);
    groupsByCode.set(seed.code, group);
  }

  return groupsByCode;
}

async function seedFeatures(groupsByCode) {
  const featuresByKey = new Map();

  for (const seed of FEATURE_SEEDS) {
    const group = groupsByCode.get(seed.groupCode);
    if (!group?.id) {
      throw new Error(`FeatureGroup not found for code=${seed.groupCode}`);
    }

    const feature = await ensureFeature(seed, group.id);
    featuresByKey.set(seed.key, feature);
  }

  return featuresByKey;
}

async function seedRoleFeatures(featuresByKey) {
  const role = await findAuthenticatedRole();

  for (const seed of FEATURE_SEEDS) {
    const feature = featuresByKey.get(seed.key);
    if (!feature?.id) {
      throw new Error(`Feature not found for key=${seed.key}`);
    }

    await ensureRoleFeature(role, feature);
  }
}

async function seedTenantFeatures(featuresByKey) {
  const tenants = await strapi.db.query(TENANT_UID).findMany({
    select: ['id', 'name', 'code'],
  });

  if (!Array.isArray(tenants) || tenants.length === 0) {
    console.log('No tenant found. Skip TenantFeature seeding.');
    return;
  }

  for (const tenant of tenants) {
    for (const seed of FEATURE_SEEDS) {
      const feature = featuresByKey.get(seed.key);
      if (!feature?.id) {
        throw new Error(`Feature not found for key=${seed.key}`);
      }

      await ensureTenantFeature(tenant, feature);
    }
  }
}

async function runSeed() {
  const groupsByCode = await seedFeatureGroups();
  const featuresByKey = await seedFeatures(groupsByCode);
  await seedRoleFeatures(featuresByKey);
  await seedTenantFeatures(featuresByKey);

  console.log('Seed features completed successfully.');
}

async function main() {
  const { createStrapi, compileStrapi } = require('@strapi/strapi');

  const appContext = await compileStrapi();
  const app = await createStrapi(appContext).load();

  app.log.level = 'error';

  try {
    await runSeed();
    await app.destroy();
    process.exit(0);
  } catch (error) {
    console.error('[seed-features] Failed:', error?.message || error);
    await app.destroy();
    process.exit(1);
  }
}

main();
