'use strict';

const MODULE_DEFINITIONS = require('./module-definitions/index');

const FEATURE_GROUP_UID = 'api::feature-group.feature-group';
const FEATURE_UID = 'api::feature.feature';
const ROLE_FEATURE_UID = 'api::role-feature.role-feature';
const TENANT_UID = 'api::tenant.tenant';
const TENANT_FEATURE_UID = 'api::tenant-feature.tenant-feature';
const ROLE_UID = 'plugin::users-permissions.role';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function toText(value) {
  if (value === null || value === undefined) return '';
  return String(value).trim();
}

async function ensureFeatureGroup(group) {
  const existing = await strapi.db.query(FEATURE_GROUP_UID).findOne({
    where: { code: group.code },
    select: ['id', 'name', 'code'],
  });

  if (existing) {
    await strapi.db.query(FEATURE_GROUP_UID).update({
      where: { id: existing.id },
      data: {
        name: group.name,
        order: group.order,
        icon: group.icon,
      },
    });
    console.log(`  Updated FeatureGroup: ${group.code}`);
    return existing;
  }

  const created = await strapi.db.query(FEATURE_GROUP_UID).create({
    data: {
      name: group.name,
      code: group.code,
      order: group.order,
      icon: group.icon,
    },
    select: ['id', 'name', 'code'],
  });

  console.log(`  Created FeatureGroup: ${created.code}`);
  return created;
}

async function ensureFeature(feature, groupId) {
  const existing = await strapi.db.query(FEATURE_UID).findOne({
    where: { key: feature.key },
    select: ['id', 'name', 'key'],
  });

  if (existing) {
    await strapi.db.query(FEATURE_UID).update({
      where: { id: existing.id },
      data: {
        name: feature.name,
        order: feature.order,
        description: feature.description,
        path: feature.path || null,
      },
    });
    console.log(`  Updated Feature: ${feature.key}`);
    return existing;
  }

  const created = await strapi.db.query(FEATURE_UID).create({
    data: {
      name: feature.name,
      key: feature.key,
      group: groupId,
      order: feature.order,
      description: feature.description,
      path: feature.path || null,
    },
    select: ['id', 'name', 'key'],
  });

  console.log(`  Created Feature: ${created.key}`);
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
    where: { role: role.id, feature: feature.id },
    select: ['id'],
  });

  const roleLabel = toText(role.name) || toText(role.type) || `Role#${role.id}`;

  if (existing) {
    console.log(`  Skip existing RoleFeature: ${roleLabel} -> ${feature.key}`);
    return existing;
  }

  const created = await strapi.db.query(ROLE_FEATURE_UID).create({
    data: { role: role.id, feature: feature.id },
    select: ['id'],
  });

  console.log(`  Created RoleFeature: ${roleLabel} -> ${feature.key}`);
  return created;
}

async function ensureTenantFeature(tenant, feature) {
  const existing = await strapi.db.query(TENANT_FEATURE_UID).findOne({
    where: { tenant: tenant.id, feature: feature.id },
    select: ['id'],
  });

  const tenantLabel = toText(tenant.name) || toText(tenant.code) || `Tenant#${tenant.id}`;

  if (existing) {
    console.log(`  Skip existing TenantFeature: ${tenantLabel} -> ${feature.key}`);
    return existing;
  }

  const created = await strapi.db.query(TENANT_FEATURE_UID).create({
    data: { tenant: tenant.id, feature: feature.id, isEnabled: true },
    select: ['id'],
  });

  console.log(`  Created TenantFeature: ${tenantLabel} -> ${feature.key}`);
  return created;
}

// ---------------------------------------------------------------------------
// Seed logic
// ---------------------------------------------------------------------------

async function seedModule(moduleDef, role, tenants) {
  const { group, features } = moduleDef;

  if (!group?.code) {
    console.warn(`  [SKIP] Module definition missing group.code — skipped.`);
    return;
  }

  if (!Array.isArray(features) || features.length === 0) {
    console.warn(`  [SKIP] Module ${group.code} has no features — skipped.`);
    return;
  }

  // 1. Ensure group
  const groupRecord = await ensureFeatureGroup(group);

  // 2. Ensure each feature
  for (const feature of features) {
    if (!feature?.key) {
      console.warn(`  [SKIP] Feature missing key in module ${group.code} — skipped.`);
      continue;
    }

    const featureRecord = await ensureFeature(feature, groupRecord.id);

    // 3. RoleFeature
    await ensureRoleFeature(role, featureRecord);

    // 4. TenantFeature for every tenant
    for (const tenant of tenants) {
      await ensureTenantFeature(tenant, featureRecord);
    }
  }
}

async function runSeed() {
  if (!Array.isArray(MODULE_DEFINITIONS) || MODULE_DEFINITIONS.length === 0) {
    console.log('No module definitions found. Nothing to seed.');
    return;
  }

  const role = await findAuthenticatedRole();
  console.log(`Using role: ${role.name || role.type} (id=${role.id})`);

  const tenants = await strapi.db.query(TENANT_UID).findMany({
    select: ['id', 'name', 'code'],
  });

  if (tenants.length === 0) {
    console.log('No tenants found. TenantFeature rows will be skipped.');
  } else {
    console.log(`Found ${tenants.length} tenant(s).`);
  }

  for (const moduleDef of MODULE_DEFINITIONS) {
    const label = moduleDef?.group?.code || '(unknown)';
    console.log(`\nSeeding module: ${label}`);
    await seedModule(moduleDef, role, tenants);
  }

  console.log('\nSeed modules completed successfully.');
}

// ---------------------------------------------------------------------------
// Bootstrap Strapi and run
// ---------------------------------------------------------------------------

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
    console.error('[seed-modules] Failed:', error?.message || error);
    await app.destroy();
    process.exit(1);
  }
}

main();
