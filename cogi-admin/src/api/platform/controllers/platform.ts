const TENANT_UID = 'api::tenant.tenant';
const TENANT_STORAGE_UID = 'api::tenant-storage.tenant-storage';
const USER_TENANT_UID = 'api::user-tenant.user-tenant';
const USER_TENANT_ROLE_UID = 'api::user-tenant-role.user-tenant-role';
const TENANT_ROLE_UID = 'api::tenant-role.tenant-role';
const ROLE_FEATURE_UID = 'api::role-feature.role-feature';
const TENANT_FEATURE_UID = 'api::tenant-feature.tenant-feature';
const FEATURE_UID = 'api::feature.feature';
const FEATURE_GROUP_UID = 'api::feature-group.feature-group';
const ROLE_UID = 'plugin::users-permissions.role';
const USER_UID = 'plugin::users-permissions.user';
const ROLE_DISABLED_FOR_TENANT_REASON = 'ROLE_DISABLED_FOR_TENANT';
const MANUAL_PLATFORM_ADMIN_ACTION_REASON = 'MANUAL_PLATFORM_ADMIN_ACTION';
const STORAGE_PROVIDER_VALUES = ['local', 's3', 'minio', 'wasabi', 'azure', 'gcs'] as const;

import {
  findPlatformSettingByKey,
  getTenantAdminRoleCode,
  listPlatformSettings,
  upsertPlatformSettingByKey,
} from '../../../services/platform-settings';

import { createUserTenant } from '../../admin/services/invite-user';

const PLATFORM_STATUS_TO_TENANT_STATUS: Record<string, 'active' | 'suspended' | 'inactive'> = {
  ACTIVE: 'active',
  SUSPENDED: 'suspended',
  DELETED: 'inactive',
};

function toPositiveInt(value: unknown): number | null {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

function toText(value: unknown): string {
  if (value === null || value === undefined) return '';
  return String(value).trim();
}

function extractMediaUrl(media: any): string | null {
  const url = toText(media?.url);
  if (url) return url;
  const formats = media?.formats && typeof media.formats === 'object' ? media.formats : null;
  if (!formats) return null;

  for (const key of ['thumbnail', 'small', 'medium', 'large']) {
    const candidate = toText(formats?.[key]?.url);
    if (candidate) return candidate;
  }

  return null;
}

function uniqueNumbers(values: Array<number | null | undefined>): number[] {
  return Array.from(new Set(values.filter((value): value is number => Boolean(value && value > 0))));
}

function pickRoleCode(role: Record<string, unknown>): string | null {
  const code = toText(role.code);
  if (code) return code;

  const type = toText(role.type);
  return type || null;
}

function pickRoleLabel(role: Record<string, unknown>): string {
  const candidates = [role.label, role.name, role.code, role.type, role.id];

  for (const candidate of candidates) {
    const text = toText(candidate);
    if (text) return text;
  }

  return 'Unknown Role';
}

function compareFeatureEntries(left: { featureKey: string }, right: { featureKey: string }) {
  return left.featureKey.localeCompare(right.featureKey);
}

function normalizePlatformStatus(value: unknown): string {
  return String(value || '').trim().toUpperCase();
}

function toPlatformStatus(tenantStatus: unknown): 'ACTIVE' | 'SUSPENDED' | 'DELETED' | null {
  const normalized = String(tenantStatus || '').trim().toLowerCase();
  if (normalized === 'active') return 'ACTIVE';
  if (normalized === 'suspended') return 'SUSPENDED';
  if (normalized === 'inactive') return 'DELETED';
  return null;
}

async function findTenantOrThrow(tenantId: number) {
  const tenant = await strapi.db.query(TENANT_UID).findOne({
    where: { id: tenantId },
    select: ['id', 'name', 'code', 'tenantStatus'],
  });

  if (!tenant?.id) {
    throw new Error('Tenant not found');
  }

  return tenant;
}

function compareFeatureRows(left: any, right: any) {
  const leftGroupOrder = Number(left?.group?.order ?? 0);
  const rightGroupOrder = Number(right?.group?.order ?? 0);
  if (leftGroupOrder !== rightGroupOrder) return leftGroupOrder - rightGroupOrder;

  const leftGroupName = toText(left?.group?.name).toLowerCase();
  const rightGroupName = toText(right?.group?.name).toLowerCase();
  if (leftGroupName !== rightGroupName) return leftGroupName.localeCompare(rightGroupName);

  const leftOrder = Number(left?.order ?? 0);
  const rightOrder = Number(right?.order ?? 0);
  if (leftOrder !== rightOrder) return leftOrder - rightOrder;

  return toText(left?.name).toLowerCase().localeCompare(toText(right?.name).toLowerCase());
}

function compareRoleRows(left: any, right: any) {
  const leftName = toText(left?.name || left?.type).toLowerCase();
  const rightName = toText(right?.name || right?.type).toLowerCase();
  if (leftName !== rightName) return leftName.localeCompare(rightName);

  return toText(left?.type).toLowerCase().localeCompare(toText(right?.type).toLowerCase());
}

function readPlatformActorId(ctx: any): number | null {
  return toPositiveInt(ctx.state?.user?.id);
}

function groupPlatformSettings(items: Array<{ group: string | null } & Record<string, unknown>>) {
  const groups = new Map<string, Array<Record<string, unknown>>>();

  for (const item of items) {
    const groupKey = toText(item.group) || 'ungrouped';
    if (!groups.has(groupKey)) {
      groups.set(groupKey, []);
    }
    groups.get(groupKey)?.push(item);
  }

  return Array.from(groups.entries()).map(([group, settings]) => ({
    group,
    settings,
  }));
}

function buildPlatformTenantRow(item: any) {
  return {
    id: item?.id,
    name: toText(item?.name),
    code: toText(item?.code),
    shortName: toText(item?.shortName) || null,
    description: toText(item?.description) || null,
    slogan: toText(item?.slogan) || null,
    defaultLocale: toText(item?.defaultLocale) || null,
    timezone: toText(item?.timezone) || null,
    defaultPublicRoute: toText(item?.defaultPublicRoute) || null,
    defaultProtectedRoute: toText(item?.defaultProtectedRoute) || null,
    googleAnalyticsId: toText(item?.googleAnalyticsId) || null,
    googleTagManagerId: toText(item?.googleTagManagerId) || null,
    googleSearchConsoleVerification: toText(item?.googleSearchConsoleVerification) || null,
    facebookPixelId: toText(item?.facebookPixelId) || null,
    storageDefaultConfigId: toPositiveInt(item?.storageDefaultConfigId),
    logo: item?.logo
      ? {
        id: toPositiveInt(item.logo.id) || 0,
        name: toText(item.logo.name) || null,
        url: extractMediaUrl(item.logo),
      }
      : null,
    logoUrl: extractMediaUrl(item?.logo),
    status: item?.tenantStatus || null,
    createdAt: item?.createdAt || null,
  };
}

const GOOGLE_ANALYTICS_ID_PATTERN = /^G-[A-Z0-9]+$/i;
const GOOGLE_TAG_MANAGER_ID_PATTERN = /^GTM-[A-Z0-9]+$/i;

function readTrackingText(value: unknown): string | null {
  return toText(value) || null;
}

function validateTrackingIds(payload: {
  googleAnalyticsId: string | null;
  googleTagManagerId: string | null;
}) {
  if (payload.googleAnalyticsId && !GOOGLE_ANALYTICS_ID_PATTERN.test(payload.googleAnalyticsId)) {
    throw new Error('googleAnalyticsId must match format G-XXXXXXXXXX');
  }

  if (payload.googleTagManagerId && !GOOGLE_TAG_MANAGER_ID_PATTERN.test(payload.googleTagManagerId)) {
    throw new Error('googleTagManagerId must match format GTM-XXXXXXX');
  }
}

function readTenantPayload(body: any) {
  const name = toText(body?.name);
  const code = toText(body?.code).toLowerCase();
  const tenantStatus = toText(body?.tenantStatus || body?.status).toLowerCase();
  const shortName = toText(body?.shortName) || null;
  const description = toText(body?.description) || null;
  const slogan = toText(body?.slogan) || null;
  const defaultLocale = toText(body?.defaultLocale) || null;
  const timezone = toText(body?.timezone) || null;
  const defaultPublicRoute = toText(body?.defaultPublicRoute) || null;
  const defaultProtectedRoute = toText(body?.defaultProtectedRoute) || null;
  const googleAnalyticsId = readTrackingText(body?.googleAnalyticsId);
  const googleTagManagerId = readTrackingText(body?.googleTagManagerId);
  const googleSearchConsoleVerification = readTrackingText(body?.googleSearchConsoleVerification);
  const facebookPixelId = readTrackingText(body?.facebookPixelId);
  const logoId = body?.logo === null || body?.logo === '' ? null : toPositiveInt(body?.logo);

  if (!name) {
    throw new Error('Tenant name is required');
  }

  if (!code) {
    throw new Error('Tenant code is required');
  }

  if (!/^[a-z0-9-]+$/.test(code)) {
    throw new Error('Tenant code chi duoc gom chu thuong, so va dau gach ngang');
  }

  if (!['draft', 'active', 'inactive', 'suspended'].includes(tenantStatus)) {
    throw new Error('tenantStatus must be one of: draft, active, inactive, suspended');
  }

  validateTrackingIds({
    googleAnalyticsId,
    googleTagManagerId,
  });

  return {
    name,
    code,
    tenantStatus,
    shortName,
    description,
    slogan,
    defaultLocale,
    timezone,
    defaultPublicRoute,
    defaultProtectedRoute,
    googleAnalyticsId,
    googleTagManagerId,
    googleSearchConsoleVerification,
    facebookPixelId,
    logo: logoId,
  };
}

function toNonNegativeInt(value: unknown): number | null {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : null;
}

function toBoolean(value: unknown): boolean | null {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (normalized === 'true') return true;
    if (normalized === 'false') return false;
  }

  return null;
}

function parseStorageSettingsValue(value: unknown) {
  if (value === undefined) return undefined;
  if (value === null || value === '') return null;

  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return null;

    try {
      return JSON.parse(trimmed);
    } catch {
      throw new Error('settings must be valid JSON');
    }
  }

  if (typeof value === 'object') return value;
  throw new Error('settings must be valid JSON');
}

function readTenantStoragePayload(body: any, options?: { partial?: boolean }) {
  const partial = options?.partial === true;
  const payload: Record<string, unknown> = {};

  if (Object.prototype.hasOwnProperty.call(body || {}, 'name')) {
    const name = toText(body?.name);
    if (!name) throw new Error('name is required');
    payload.name = name;
  } else if (!partial) {
    throw new Error('name is required');
  }

  if (Object.prototype.hasOwnProperty.call(body || {}, 'provider')) {
    const provider = toText(body?.provider).toLowerCase();
    if (!provider || !STORAGE_PROVIDER_VALUES.includes(provider as any)) {
      throw new Error(`provider must be one of: ${STORAGE_PROVIDER_VALUES.join(', ')}`);
    }
    payload.provider = provider;
  } else if (!partial) {
    payload.provider = 'local';
  }

  if (Object.prototype.hasOwnProperty.call(body || {}, 'basePath')) {
    const basePath = toText(body?.basePath);
    if (!basePath) throw new Error('basePath is required');
    payload.basePath = basePath;
  } else if (!partial) {
    throw new Error('basePath is required');
  }

  if (Object.prototype.hasOwnProperty.call(body || {}, 'publicBaseUrl')) {
    payload.publicBaseUrl = toText(body?.publicBaseUrl) || null;
  }

  if (Object.prototype.hasOwnProperty.call(body || {}, 'quotaGB')) {
    const rawValue = toText(body?.quotaGB);
    if (!rawValue) {
      payload.quotaGB = null;
    } else {
      const parsed = Number(rawValue);
      if (!Number.isFinite(parsed) || parsed < 0) {
        throw new Error('quotaGB must be a non-negative number');
      }
      payload.quotaGB = String(parsed);
    }
  } else if (!partial) {
    payload.quotaGB = '5';
  }

  if (Object.prototype.hasOwnProperty.call(body || {}, 'usedBytes')) {
    const rawValue = body?.usedBytes;
    if (rawValue === null || rawValue === undefined || rawValue === '') {
      payload.usedBytes = '0';
    } else {
      const parsed = toNonNegativeInt(rawValue);
      if (parsed === null) {
        throw new Error('usedBytes must be a non-negative integer');
      }
      payload.usedBytes = String(parsed);
    }
  } else if (!partial) {
    payload.usedBytes = '0';
  }

  if (Object.prototype.hasOwnProperty.call(body || {}, 'isActive')) {
    const parsed = toBoolean(body?.isActive);
    if (parsed === null) throw new Error('isActive must be a boolean');
    payload.isActive = parsed;
  } else if (!partial) {
    payload.isActive = true;
  }

  if (Object.prototype.hasOwnProperty.call(body || {}, 'notes')) {
    payload.notes = toText(body?.notes) || null;
  }

  if (Object.prototype.hasOwnProperty.call(body || {}, 'settings')) {
    payload.settings = parseStorageSettingsValue(body?.settings);
  }

  return payload;
}

function buildTenantStorageRow(item: any, defaultStorageConfigId: number | null) {
  const id = toPositiveInt(item?.id);

  return {
    id,
    name: toText(item?.name) || null,
    provider: toText(item?.provider) || 'local',
    basePath: toText(item?.basePath) || null,
    publicBaseUrl: toText(item?.publicBaseUrl) || null,
    quotaGB: toText(item?.quotaGB) || '5',
    usedBytes: toText(item?.usedBytes) || '0',
    isActive: item?.isActive !== false,
    isDefault: Boolean(id && defaultStorageConfigId && id === defaultStorageConfigId),
    settings: item?.settings ?? null,
    notes: toText(item?.notes) || null,
    createdAt: item?.createdAt || null,
    updatedAt: item?.updatedAt || null,
  };
}

async function findTenantStorageConfigOrThrow(tenantId: number, storageConfigId: number) {
  const storageConfig = await strapi.db.query(TENANT_STORAGE_UID).findOne({
    where: {
      id: storageConfigId,
      tenant: {
        id: {
          $eq: tenantId,
        },
      },
    },
  });

  if (!storageConfig?.id) {
    throw new Error('Storage config not found');
  }

  return storageConfig;
}

async function listTenantStorageRows(tenantId: number) {
  const tenant = await strapi.db.query(TENANT_UID).findOne({
    where: { id: tenantId },
    select: ['id', 'name', 'code', 'tenantStatus', 'storageDefaultConfigId'],
  });

  if (!tenant?.id) {
    throw new Error('Tenant not found');
  }

  const defaultStorageConfigId = toPositiveInt(tenant?.storageDefaultConfigId);
  const rows = await strapi.db.query(TENANT_STORAGE_UID).findMany({
    where: {
      tenant: {
        id: {
          $eq: tenantId,
        },
      },
    },
  });

  const storageConfigs = (rows || [])
    .map((item: any) => buildTenantStorageRow(item, defaultStorageConfigId))
    .sort((left, right) => {
      if (left.isDefault !== right.isDefault) return left.isDefault ? -1 : 1;
      return String(left.name || '').localeCompare(String(right.name || '')) || ((left.id || 0) - (right.id || 0));
    });

  return {
    tenant: {
      id: tenant.id,
      name: toText(tenant.name),
      code: toText(tenant.code),
      status: toText(tenant.tenantStatus) || null,
      storageDefaultConfigId: defaultStorageConfigId,
    },
    storageConfigs,
  };
}

async function syncTenantStorageDefaultFlags(tenantId: number, defaultStorageConfigId: number | null) {
  const rows = await strapi.db.query(TENANT_STORAGE_UID).findMany({
    where: {
      tenant: {
        id: {
          $eq: tenantId,
        },
      },
    },
    select: ['id', 'isDefault'],
  });

  for (const row of rows || []) {
    const rowId = toPositiveInt((row as any)?.id);
    if (!rowId) continue;

    const nextIsDefault = Boolean(defaultStorageConfigId && rowId === defaultStorageConfigId);
    if (Boolean((row as any)?.isDefault) === nextIsDefault) continue;

    await strapi.db.query(TENANT_STORAGE_UID).update({
      where: { id: rowId },
      data: { isDefault: nextIsDefault },
    });
  }
}

async function updateTenantDefaultStorageConfig(tenantId: number, storageConfigId: number | null) {
  if (storageConfigId !== null) {
    await findTenantStorageConfigOrThrow(tenantId, storageConfigId);
  }

  await strapi.db.query(TENANT_UID).update({
    where: { id: tenantId },
    data: {
      storageDefaultConfigId: storageConfigId,
    },
  });

  await syncTenantStorageDefaultFlags(tenantId, storageConfigId);
}

function buildRoleRow(role: any, tenantRole: any, stats?: { activeUserRoleCount: number; restorableUserRoleCount: number }, assignmentState?: 'active' | 'inactive' | 'unassigned') {
  const roleId = toPositiveInt(role?.id) || 0;

  return {
    id: roleId,
    name: toText(role?.name) || toText(role?.type) || `Role #${roleId}`,
    type: toText(role?.type) || null,
    description: toText(role?.description) || null,
    tenantRoleId: toPositiveInt(tenantRole?.id),
    assignmentState: assignmentState || (tenantRole?.isActive === true ? 'active' : tenantRole?.id ? 'inactive' : 'unassigned'),
    inactiveReason: toText(tenantRole?.inactiveReason) || null,
    activeUserRoleCount: Number(stats?.activeUserRoleCount || 0),
    restorableUserRoleCount: Number(stats?.restorableUserRoleCount || 0),
  };
}

function toTenantAdminStatus(assignment: any, userTenant: any, user: any): string {
  if (assignment?.userTenantRoleStatus !== 'active') return 'inactive';
  if (toText(userTenant?.userTenantStatus).toLowerCase() !== 'active') return 'inactive';
  if (user?.blocked === true) return 'inactive';
  return 'active';
}

function formatTenantAdminRow(assignment: any) {
  const userTenant = (assignment as any)?.userTenant || null;
  const user = (userTenant as any)?.user || null;

  return {
    id: toPositiveInt((assignment as any)?.id) || 0,
    userId: toPositiveInt(user?.id) || 0,
    username: toText(user?.username) || null,
    email: toText(user?.email) || null,
    fullName: toText(user?.fullName) || null,
    phone: toText(user?.phone) || null,
    status: toTenantAdminStatus(assignment, userTenant, user),
    assignedAt: (assignment as any)?.assignedAt || null,
    inactiveReason: toText((assignment as any)?.inactiveReason) || null,
  };
}

async function loadTenantFeatureRows(tenantId: number) {
  const [features, tenantFeatures] = await Promise.all([
    strapi.db.query(FEATURE_UID).findMany({
      select: ['id', 'name', 'key', 'description', 'order', 'path'],
      populate: {
        group: {
          select: ['id', 'name', 'code', 'order'],
        },
      },
    }),
    strapi.db.query(TENANT_FEATURE_UID).findMany({
      where: { tenant: tenantId },
      select: ['id', 'isEnabled'],
      populate: {
        feature: {
          select: ['id'],
        },
      },
    }),
  ]);

  const tenantFeatureMap = new Map<number, { id: number; isEnabled: boolean }>();
  for (const tenantFeature of tenantFeatures || []) {
    const featureId = toPositiveInt((tenantFeature as any)?.feature?.id ?? (tenantFeature as any)?.feature);
    if (!featureId) continue;
    tenantFeatureMap.set(featureId, {
      id: Number((tenantFeature as any)?.id || 0),
      isEnabled: (tenantFeature as any)?.isEnabled === true,
    });
  }

  return (features || [])
    .slice()
    .sort(compareFeatureRows)
    .map((feature: any) => {
      const featureId = toPositiveInt(feature?.id) || 0;
      const tenantFeature = tenantFeatureMap.get(featureId);
      return {
        id: featureId,
        name: toText(feature?.name),
        key: toText(feature?.key),
        description: toText(feature?.description) || null,
        path: toText(feature?.path) || null,
        group: feature?.group
          ? {
            id: toPositiveInt(feature.group.id) || 0,
            name: toText(feature.group.name),
            code: toText(feature.group.code) || null,
            order: Number(feature.group.order ?? 0),
          }
          : null,
        tenantFeatureId: tenantFeature?.id || null,
        isEnabled: tenantFeature?.isEnabled === true,
      };
    });
}

async function loadPlatformFeatureGroups() {
  const rows = await strapi.db.query(FEATURE_GROUP_UID).findMany({
    select: ['id', 'name', 'code', 'order', 'icon'],
    orderBy: [{ order: 'asc' }, { name: 'asc' }, { id: 'asc' }],
  });

  return (rows || []).map((item: any) => ({
    id: toPositiveInt(item?.id) || 0,
    name: toText(item?.name),
    code: toText(item?.code) || null,
    icon: toText(item?.icon) || null,
    order: Number(item?.order ?? 0),
  }));
}

async function loadPlatformFeatures(options?: { groupId?: number | null; groupCode?: string | null }) {
  const filters: Record<string, unknown> = {};

  if (options?.groupId) {
    filters.group = options.groupId;
  } else if (toText(options?.groupCode)) {
    filters.group = {
      code: toText(options?.groupCode),
    };
  }

  const rows = await strapi.db.query(FEATURE_UID).findMany({
    where: Object.keys(filters).length > 0 ? filters : undefined,
    select: ['id', 'name', 'key', 'description', 'order', 'path'],
    populate: {
      group: {
        select: ['id', 'name', 'code', 'order', 'icon'],
      },
    },
  });

  return (rows || [])
    .slice()
    .sort(compareFeatureRows)
    .map(buildPlatformFeatureRow);
}

function buildPlatformFeatureRow(feature: any) {
  return {
    id: toPositiveInt(feature?.id) || 0,
    name: toText(feature?.name),
    key: toText(feature?.key),
    description: toText(feature?.description) || null,
    path: toText(feature?.path) || null,
    order: Number(feature?.order ?? 0),
    group: feature?.group
      ? {
        id: toPositiveInt(feature.group.id) || 0,
        name: toText(feature.group.name),
        code: toText(feature.group.code) || null,
        icon: toText(feature.group.icon) || null,
        order: Number(feature.group.order ?? 0),
      }
      : null,
  };
}

function readPlatformFeaturePayload(body: any) {
  const name = toText(body?.name);
  const key = toText(body?.key);
  const description = toText(body?.description) || null;
  const path = toText(body?.path) || null;
  const groupId = toPositiveInt(body?.groupId ?? body?.group);
  const rawOrder = body?.order;
  const order = rawOrder === null || rawOrder === undefined || rawOrder === '' ? 0 : Number(rawOrder);

  if (!name) {
    throw new Error('Feature name is required');
  }

  if (!key) {
    throw new Error('Feature key is required');
  }

  if (!groupId) {
    throw new Error('Feature group is required');
  }

  if (!Number.isFinite(order) || !Number.isInteger(order)) {
    throw new Error('Feature order must be an integer');
  }

  return {
    name,
    key,
    description,
    path,
    order,
    group: groupId,
  };
}

function buildFeatureRoleRow(role: any, roleFeature: any, assignmentState?: 'active' | 'inactive' | 'unassigned') {
  const roleId = toPositiveInt(role?.id) || 0;
  return {
    id: roleId,
    name: toText(role?.name) || toText(role?.type) || `Role #${roleId}`,
    type: toText(role?.type) || null,
    description: toText(role?.description) || null,
    roleFeatureId: toPositiveInt(roleFeature?.id),
    assignmentState: assignmentState || (roleFeature?.isActive === true ? 'active' : roleFeature?.id ? 'inactive' : 'unassigned'),
  };
}

async function findFeatureOrThrow(featureId: number) {
  const feature = await strapi.db.query(FEATURE_UID).findOne({
    where: { id: featureId },
    select: ['id', 'name', 'key', 'description', 'path', 'order'],
    populate: {
      group: {
        select: ['id', 'name', 'code', 'order'],
      },
    },
  });

  if (!feature?.id) {
    throw new Error('Feature not found');
  }

  return feature;
}

async function findFeatureGroupOrThrow(groupId: number) {
  const group = await strapi.db.query(FEATURE_GROUP_UID).findOne({
    where: { id: groupId },
    select: ['id', 'name', 'code', 'order', 'icon'],
  });

  if (!group?.id) {
    throw new Error('Feature group not found');
  }

  return group;
}

async function findRoleFeatureAssignment(featureId: number, roleId: number) {
  return strapi.db.query(ROLE_FEATURE_UID).findOne({
    where: {
      feature: featureId,
      role: roleId,
    },
    select: ['id', 'isActive'],
  });
}

async function loadFeatureRoleBuckets(featureId: number) {
  const [roles, roleFeatures] = await Promise.all([
    strapi.db.query(ROLE_UID).findMany({
      select: ['id', 'name', 'type', 'description'],
    }),
    strapi.db.query(ROLE_FEATURE_UID).findMany({
      where: { feature: featureId },
      select: ['id', 'isActive'],
      populate: {
        role: {
          select: ['id'],
        },
      },
    }),
  ]);

  const roleFeatureMap = new Map<number, any>();
  for (const roleFeature of roleFeatures || []) {
    const roleId = toPositiveInt((roleFeature as any)?.role?.id ?? (roleFeature as any)?.role);
    if (!roleId) continue;
    roleFeatureMap.set(roleId, roleFeature);
  }

  const activeRoles: any[] = [];
  const inactiveRoles: any[] = [];
  const unassignedRoles: any[] = [];

  for (const role of (roles || []).slice().sort(compareRoleRows)) {
    const roleId = toPositiveInt((role as any)?.id) || 0;
    const roleFeature = roleFeatureMap.get(roleId) || null;

    if (roleFeature?.id) {
      if (roleFeature.isActive === true) {
        activeRoles.push(buildFeatureRoleRow(role, roleFeature, 'active'));
      } else {
        inactiveRoles.push(buildFeatureRoleRow(role, roleFeature, 'inactive'));
      }
    } else {
      unassignedRoles.push(buildFeatureRoleRow(role, null, 'unassigned'));
    }
  }

  return {
    activeRoles,
    inactiveRoles,
    unassignedRoles,
  };
}

async function loadTenantRoleBuckets(tenantId: number) {
  const [roles, tenantRoles, userTenantRoles] = await Promise.all([
    strapi.db.query(ROLE_UID).findMany({
      select: ['id', 'name', 'type', 'description'],
    }),
    strapi.db.query(TENANT_ROLE_UID).findMany({
      where: { tenant: tenantId },
      select: ['id', 'isActive', 'inactiveReason', 'activatedAt', 'deactivatedAt'],
      populate: {
        role: {
          select: ['id'],
        },
        activatedBy: {
          select: ['id'],
        },
        deactivatedBy: {
          select: ['id'],
        },
      },
    }),
    strapi.db.query(USER_TENANT_ROLE_UID).findMany({
      where: {
        userTenant: {
          tenant: tenantId,
        },
      },
      select: ['id', 'userTenantRoleStatus', 'inactiveReason', 'assignedAt', 'revokedAt'],
      populate: {
        role: {
          select: ['id'],
        },
      },
    }),
  ]);

  const tenantRoleMap = new Map<number, any>();
  for (const tenantRole of tenantRoles || []) {
    const roleId = toPositiveInt((tenantRole as any)?.role?.id ?? (tenantRole as any)?.role);
    if (!roleId) continue;
    tenantRoleMap.set(roleId, tenantRole);
  }

  const userRoleStatsByRoleId = new Map<number, { activeUserRoleCount: number; restorableUserRoleCount: number }>();
  for (const userTenantRole of userTenantRoles || []) {
    const roleId = toPositiveInt((userTenantRole as any)?.role?.id ?? (userTenantRole as any)?.role);
    if (!roleId) continue;

    const current = userRoleStatsByRoleId.get(roleId) || { activeUserRoleCount: 0, restorableUserRoleCount: 0 };
    if ((userTenantRole as any)?.userTenantRoleStatus === 'active') {
      current.activeUserRoleCount += 1;
    }
    if (
      (userTenantRole as any)?.userTenantRoleStatus === 'inactive'
      && toText((userTenantRole as any)?.inactiveReason) === ROLE_DISABLED_FOR_TENANT_REASON
    ) {
      current.restorableUserRoleCount += 1;
    }

    userRoleStatsByRoleId.set(roleId, current);
  }

  const sortedRoles = (roles || []).slice().sort(compareRoleRows);
  const activeRoles: any[] = [];
  const inactiveRoles: any[] = [];
  const unassignedRoles: any[] = [];

  for (const role of sortedRoles) {
    const roleId = toPositiveInt(role?.id) || 0;
    const tenantRole = tenantRoleMap.get(roleId) || null;
    const stats = userRoleStatsByRoleId.get(roleId);

    if (tenantRole?.id) {
      if (tenantRole.isActive === true) {
        activeRoles.push(buildRoleRow(role, tenantRole, stats, 'active'));
      } else {
        inactiveRoles.push(buildRoleRow(role, tenantRole, stats, 'inactive'));
      }
    } else {
      unassignedRoles.push(buildRoleRow(role, null, stats, 'unassigned'));
    }
  }

  return {
    activeRoles,
    inactiveRoles,
    unassignedRoles,
  };
}

async function findRoleOrThrow(roleId: number) {
  const role = await strapi.db.query(ROLE_UID).findOne({
    where: { id: roleId },
    select: ['id', 'name', 'type', 'description'],
  });

  if (!role?.id) {
    throw new Error('Role not found');
  }

  return role;
}

async function findRoleByCode(roleCode: string) {
  const normalizedRoleCode = toText(roleCode);
  if (!normalizedRoleCode) return null;

  const roles = await strapi.db.query(ROLE_UID).findMany({
    select: ['id', 'name', 'type', 'description'],
  });

  return (
    (roles || []).find((role: any) => {
      const candidates = [pickRoleCode(role), role?.name, role?.type];
      return candidates.some((candidate) => toText(candidate).toLowerCase() === normalizedRoleCode.toLowerCase());
    }) || null
  );
}

async function findTenantRoleAssignment(tenantId: number, roleId: number) {
  return strapi.db.query(TENANT_ROLE_UID).findOne({
    where: {
      tenant: tenantId,
      role: roleId,
    },
    select: ['id', 'isActive', 'inactiveReason', 'activatedAt', 'deactivatedAt'],
  });
}

async function resolveTenantAdminContext(tenantId: number) {
  const configuredTenantAdminRoleValue = await getTenantAdminRoleCode();
  const tenantAdminRole = await findRoleByCode(configuredTenantAdminRoleValue);

  if (!tenantAdminRole?.id) {
    const error = new Error(`Khong tim thay role cau hinh Tenant Admin: ${configuredTenantAdminRoleValue}`) as Error & { status?: number };
    error.status = 400;
    throw error;
  }

  const tenantAdminRoleCode = pickRoleCode(tenantAdminRole as any) || configuredTenantAdminRoleValue;

  const tenantRole = await strapi.db.query(TENANT_ROLE_UID).findOne({
    where: {
      tenant: tenantId,
      role: tenantAdminRole.id,
    },
    select: ['id', 'isActive', 'inactiveReason', 'activatedAt', 'deactivatedAt'],
  });

  if (!tenantRole?.id || tenantRole.isActive !== true) {
    const error = new Error('Tenant chua duoc bat role Tenant Admin. Vui long bat role nay truoc.') as Error & { status?: number };
    error.status = 400;
    throw error;
  }

  return {
    tenantAdminRoleCode,
    tenantAdminRole,
    tenantRole,
  };
}

async function findUserByIdentifier(identifier: string) {
  const normalized = toText(identifier);
  if (!normalized) return null;

  return strapi.db.query(USER_UID).findOne({
    where: {
      $or: [
        {
          username: {
            $eqi: normalized,
          },
        },
        {
          email: {
            $eqi: normalized,
          },
        },
      ],
    },
    select: ['id', 'username', 'email', 'fullName', 'phone', 'blocked'],
  });
}

async function ensureActiveUserTenant(userId: number, tenantId: number) {
  const existing = await strapi.db.query(USER_TENANT_UID).findOne({
    where: {
      user: userId,
      tenant: tenantId,
    },
    select: ['id', 'userTenantStatus', 'joinedAt'],
  });

  if (!existing?.id) {
    return createUserTenant(userId, tenantId, 'active');
  }

  if (existing.userTenantStatus !== 'active') {
    await strapi.db.query(USER_TENANT_UID).update({
      where: { id: existing.id },
      data: {
        userTenantStatus: 'active',
        joinedAt: existing.joinedAt || new Date(),
        leftAt: null,
      },
    });
  }

  return { id: existing.id };
}

async function loadTenantAdminAssignments(tenantId: number, tenantAdminRoleId: number) {
  const rows = await strapi.db.query(USER_TENANT_ROLE_UID).findMany({
    where: {
      role: tenantAdminRoleId,
      userTenant: {
        tenant: tenantId,
      },
    },
    select: ['id', 'userTenantRoleStatus', 'inactiveReason', 'assignedAt', 'revokedAt'],
    populate: {
      userTenant: {
        select: ['id', 'userTenantStatus'],
        populate: {
          user: {
            select: ['id', 'username', 'email', 'fullName', 'phone', 'blocked'],
          },
        },
      },
    },
    orderBy: [{ assignedAt: 'desc' }, { id: 'desc' }],
  });

  return (rows || []).map(formatTenantAdminRow);
}

async function findTenantAdminAssignmentOrThrow(tenantId: number, assignmentId: number, tenantAdminRoleId: number) {
  const assignment = await strapi.db.query(USER_TENANT_ROLE_UID).findOne({
    where: {
      id: assignmentId,
      role: tenantAdminRoleId,
      userTenant: {
        tenant: tenantId,
      },
    },
    select: ['id', 'userTenantRoleStatus', 'inactiveReason', 'assignedAt', 'revokedAt'],
    populate: {
      userTenant: {
        select: ['id', 'userTenantStatus', 'joinedAt'],
      },
    },
  });

  if (!assignment?.id) {
    throw new Error('Tenant admin assignment not found');
  }

  return assignment;
}

async function findTenantUserRoleAssignments(options: {
  tenantId: number;
  roleId: number;
  status?: 'active' | 'inactive';
  inactiveReason?: string | null;
}) {
  const where: Record<string, any> = {
    userTenant: {
      tenant: options.tenantId,
    },
    role: options.roleId,
  };

  if (options.status) {
    where.userTenantRoleStatus = options.status;
  }

  if (options.inactiveReason !== undefined) {
    where.inactiveReason = options.inactiveReason;
  }

  return strapi.db.query(USER_TENANT_ROLE_UID).findMany({
    where,
    select: ['id', 'assignedAt', 'revokedAt', 'userTenantRoleStatus', 'inactiveReason', 'isPrimary'],
  });
}

export default {
  async listSettings(ctx: any) {
    try {
      const settings = await listPlatformSettings();

      ctx.body = {
        ok: true,
        data: {
          settings,
          groups: groupPlatformSettings(settings),
        },
      };
    } catch (error) {
      strapi.log.error('[platform.listSettings] unexpected error', error);
      return ctx.internalServerError('Failed to load platform settings');
    }
  },

  async getSettingByKey(ctx: any) {
    const key = toText(ctx.params?.key);
    if (!key) {
      return ctx.badRequest('Invalid setting key');
    }

    try {
      const setting = await findPlatformSettingByKey(key);
      if (!setting) {
        return ctx.notFound('Setting not found');
      }

      ctx.body = {
        ok: true,
        data: setting,
      };
    } catch (error) {
      strapi.log.error('[platform.getSettingByKey] unexpected error', error);
      return ctx.internalServerError('Failed to load platform setting');
    }
  },

  async upsertSettingByKey(ctx: any) {
    const key = toText(ctx.params?.key);
    if (!key) {
      return ctx.badRequest('Invalid setting key');
    }

    try {
      const setting = await upsertPlatformSettingByKey(key, {
        value: ctx.request?.body?.value,
        description: ctx.request?.body?.description,
        group: ctx.request?.body?.group,
        dataType: ctx.request?.body?.dataType,
        status: ctx.request?.body?.status,
      });

      ctx.body = {
        ok: true,
        data: setting,
      };
    } catch (error: any) {
      if (error?.message === 'Setting key is required') {
        return ctx.badRequest('Setting key is required');
      }

      strapi.log.error('[platform.upsertSettingByKey] unexpected error', error);
      return ctx.internalServerError('Failed to save platform setting');
    }
  },

  async listFeatures(ctx: any) {
    const groupId = toPositiveInt(ctx.request?.query?.groupId);
    const rawGroupCode = toText(ctx.request?.query?.groupCode);
    const groupCode = rawGroupCode && rawGroupCode.toLowerCase() !== 'all' ? rawGroupCode : '';

    try {
      const [featureGroups, features] = await Promise.all([
        loadPlatformFeatureGroups(),
        loadPlatformFeatures({
          groupId,
          groupCode: groupCode || null,
        }),
      ]);

      ctx.body = {
        ok: true,
        data: {
          featureGroups,
          features,
          filters: {
            groupId: groupId || null,
            groupCode: groupCode || null,
          },
        },
      };
    } catch (error) {
      strapi.log.error('[platform.listFeatures] unexpected error', error);
      return ctx.internalServerError('Failed to load platform features');
    }
  },

  async createFeature(ctx: any) {
    try {
      const payload = readPlatformFeaturePayload(ctx.request?.body);
      await findFeatureGroupOrThrow(payload.group as number);

      const created = await strapi.db.query(FEATURE_UID).create({
        data: payload,
      });

      const populated = await strapi.db.query(FEATURE_UID).findOne({
        where: { id: created.id },
        select: ['id', 'name', 'key', 'description', 'order', 'path'],
        populate: {
          group: {
            select: ['id', 'name', 'code', 'order', 'icon'],
          },
        },
      });

      ctx.body = {
        ok: true,
        data: buildPlatformFeatureRow(populated || created),
      };
    } catch (error: any) {
      if (error?.message === 'Feature name is required' || error?.message === 'Feature key is required' || error?.message === 'Feature group is required' || error?.message === 'Feature order must be an integer') {
        return ctx.badRequest(error.message);
      }

      if (error?.message === 'Feature group not found') {
        return ctx.notFound('Feature group not found');
      }

      if (String(error?.message || '').toLowerCase().includes('unique')) {
        return ctx.badRequest('Feature key already exists');
      }

      strapi.log.error('[platform.createFeature] unexpected error', error);
      return ctx.internalServerError('Failed to create platform feature');
    }
  },

  async updateFeature(ctx: any) {
    const featureId = toPositiveInt(ctx.params?.featureId);
    if (!featureId) {
      return ctx.badRequest('Invalid feature id');
    }

    try {
      await findFeatureOrThrow(featureId);
      const payload = readPlatformFeaturePayload(ctx.request?.body);
      await findFeatureGroupOrThrow(payload.group as number);

      await strapi.db.query(FEATURE_UID).update({
        where: { id: featureId },
        data: payload,
      });

      const updated = await strapi.db.query(FEATURE_UID).findOne({
        where: { id: featureId },
        select: ['id', 'name', 'key', 'description', 'order', 'path'],
        populate: {
          group: {
            select: ['id', 'name', 'code', 'order', 'icon'],
          },
        },
      });

      ctx.body = {
        ok: true,
        data: buildPlatformFeatureRow(updated),
      };
    } catch (error: any) {
      if (error?.message === 'Feature not found') {
        return ctx.notFound('Feature not found');
      }

      if (error?.message === 'Feature name is required' || error?.message === 'Feature key is required' || error?.message === 'Feature group is required' || error?.message === 'Feature order must be an integer') {
        return ctx.badRequest(error.message);
      }

      if (error?.message === 'Feature group not found') {
        return ctx.notFound('Feature group not found');
      }

      if (String(error?.message || '').toLowerCase().includes('unique')) {
        return ctx.badRequest('Feature key already exists');
      }

      strapi.log.error('[platform.updateFeature] unexpected error', error);
      return ctx.internalServerError('Failed to update platform feature');
    }
  },

  async listFeatureRoles(ctx: any) {
    const featureId = toPositiveInt(ctx.params?.featureId);
    if (!featureId) {
      return ctx.badRequest('Invalid feature id');
    }

    try {
      const [feature, roleBuckets] = await Promise.all([
        findFeatureOrThrow(featureId),
        loadFeatureRoleBuckets(featureId),
      ]);

      ctx.body = {
        ok: true,
        data: {
          feature: {
            id: feature.id,
            name: toText(feature.name),
            key: toText((feature as any).key),
            description: toText((feature as any).description) || null,
            path: toText((feature as any).path) || null,
            group: (feature as any).group
              ? {
                id: toPositiveInt((feature as any).group.id) || 0,
                name: toText((feature as any).group.name),
                code: toText((feature as any).group.code) || null,
              }
              : null,
          },
          activeRoles: roleBuckets.activeRoles,
          inactiveRoles: roleBuckets.inactiveRoles,
          unassignedRoles: roleBuckets.unassignedRoles,
        },
      };
    } catch (error: any) {
      if (error?.message === 'Feature not found') {
        return ctx.notFound('Feature not found');
      }

      strapi.log.error('[platform.listFeatureRoles] unexpected error', error);
      return ctx.internalServerError('Failed to load feature roles');
    }
  },

  async activateFeatureRole(ctx: any) {
    const featureId = toPositiveInt(ctx.params?.featureId);
    const roleId = toPositiveInt(ctx.params?.roleId);
    if (!featureId) {
      return ctx.badRequest('Invalid feature id');
    }
    if (!roleId) {
      return ctx.badRequest('Invalid role id');
    }

    try {
      await Promise.all([findFeatureOrThrow(featureId), findRoleOrThrow(roleId)]);

      const existing = await findRoleFeatureAssignment(featureId, roleId);
      const updated = existing?.id
        ? await strapi.db.query(ROLE_FEATURE_UID).update({
          where: { id: existing.id },
          data: { isActive: true },
        })
        : await strapi.db.query(ROLE_FEATURE_UID).create({
          data: {
            feature: featureId,
            role: roleId,
            isActive: true,
          },
        });

      ctx.body = {
        ok: true,
        data: {
          featureId,
          roleId,
          roleFeatureId: updated?.id || existing?.id || null,
          isActive: true,
        },
      };
    } catch (error: any) {
      if (error?.message === 'Feature not found') {
        return ctx.notFound('Feature not found');
      }
      if (error?.message === 'Role not found') {
        return ctx.notFound('Role not found');
      }

      strapi.log.error('[platform.activateFeatureRole] unexpected error', error);
      return ctx.internalServerError('Failed to activate feature role');
    }
  },

  async deactivateFeatureRole(ctx: any) {
    const featureId = toPositiveInt(ctx.params?.featureId);
    const roleId = toPositiveInt(ctx.params?.roleId);
    if (!featureId) {
      return ctx.badRequest('Invalid feature id');
    }
    if (!roleId) {
      return ctx.badRequest('Invalid role id');
    }

    try {
      await Promise.all([findFeatureOrThrow(featureId), findRoleOrThrow(roleId)]);

      const existing = await findRoleFeatureAssignment(featureId, roleId);
      if (!existing?.id) {
        return ctx.badRequest('Role-feature assignment is not assigned');
      }

      await strapi.db.query(ROLE_FEATURE_UID).update({
        where: { id: existing.id },
        data: { isActive: false },
      });

      ctx.body = {
        ok: true,
        data: {
          featureId,
          roleId,
          roleFeatureId: existing.id,
          isActive: false,
        },
      };
    } catch (error: any) {
      if (error?.message === 'Feature not found') {
        return ctx.notFound('Feature not found');
      }
      if (error?.message === 'Role not found') {
        return ctx.notFound('Role not found');
      }

      strapi.log.error('[platform.deactivateFeatureRole] unexpected error', error);
      return ctx.internalServerError('Failed to deactivate feature role');
    }
  },

  async listTenants(ctx: any) {
    try {
      const rows = await strapi.db.query(TENANT_UID).findMany({
        select: ['id', 'name', 'code', 'shortName', 'description', 'slogan', 'defaultLocale', 'timezone', 'defaultPublicRoute', 'defaultProtectedRoute', 'googleAnalyticsId', 'googleTagManagerId', 'googleSearchConsoleVerification', 'facebookPixelId', 'tenantStatus', 'createdAt'],
        populate: {
          logo: {
            select: ['id', 'name', 'url', 'formats'],
          },
        },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      });

      ctx.body = {
        ok: true,
        data: (rows || []).map(buildPlatformTenantRow),
      };
    } catch (error) {
      strapi.log.error('[platform.listTenants] unexpected error', error);
      return ctx.internalServerError('Failed to load tenants');
    }
  },

  async createTenant(ctx: any) {
    try {
      const payload = readTenantPayload(ctx.request?.body);
      const existing = await strapi.db.query(TENANT_UID).findOne({
        where: {
          code: {
            $eqi: payload.code,
          },
        },
        select: ['id'],
      });

      if (existing?.id) {
        return ctx.badRequest('Tenant code da ton tai');
      }

      const created = await strapi.db.query(TENANT_UID).create({
        data: payload,
        populate: {
          logo: {
            select: ['id', 'name', 'url', 'formats'],
          },
        },
      });

      ctx.body = {
        ok: true,
        data: buildPlatformTenantRow(created),
      };
    } catch (error: any) {
      if (error?.message === 'Tenant name is required' || error?.message === 'Tenant code is required' || error?.message === 'Tenant code chi duoc gom chu thuong, so va dau gach ngang' || error?.message === 'tenantStatus must be one of: draft, active, inactive, suspended' || String(error?.message || '').includes('must match format')) {
        return ctx.badRequest(error.message);
      }

      strapi.log.error('[platform.createTenant] unexpected error', error);
      return ctx.internalServerError('Failed to create tenant');
    }
  },

  async updateTenant(ctx: any) {
    const tenantId = toPositiveInt(ctx.params?.id);
    if (!tenantId) {
      return ctx.badRequest('Invalid tenant id');
    }

    try {
      const existing = await strapi.db.query(TENANT_UID).findOne({
        where: { id: tenantId },
        select: ['id'],
      });

      if (!existing?.id) {
        return ctx.notFound('Tenant not found');
      }

      const payload = readTenantPayload(ctx.request?.body);
      const duplicate = await strapi.db.query(TENANT_UID).findOne({
        where: {
          code: {
            $eqi: payload.code,
          },
          id: {
            $ne: tenantId,
          },
        },
        select: ['id'],
      });

      if (duplicate?.id) {
        return ctx.badRequest('Tenant code da ton tai');
      }

      const updated = await strapi.db.query(TENANT_UID).update({
        where: { id: tenantId },
        data: payload,
        populate: {
          logo: {
            select: ['id', 'name', 'url', 'formats'],
          },
        },
      });

      ctx.body = {
        ok: true,
        data: buildPlatformTenantRow(updated),
      };
    } catch (error: any) {
      if (error?.message === 'Tenant name is required' || error?.message === 'Tenant code is required' || error?.message === 'Tenant code chi duoc gom chu thuong, so va dau gach ngang' || error?.message === 'tenantStatus must be one of: draft, active, inactive, suspended' || String(error?.message || '').includes('must match format')) {
        return ctx.badRequest(error.message);
      }

      strapi.log.error('[platform.updateTenant] unexpected error', error);
      return ctx.internalServerError('Failed to update tenant');
    }
  },

  async updateTenantStatus(ctx: any) {
    const tenantId = toPositiveInt(ctx.params?.id);
    if (!tenantId) {
      return ctx.badRequest('Invalid tenant id');
    }

    const requestedStatus = normalizePlatformStatus(ctx.request?.body?.status);
    const nextTenantStatus = PLATFORM_STATUS_TO_TENANT_STATUS[requestedStatus];

    if (!nextTenantStatus) {
      return ctx.badRequest('status must be one of: ACTIVE, SUSPENDED, DELETED');
    }

    try {
      const existing = await strapi.db.query(TENANT_UID).findOne({
        where: { id: tenantId },
        select: ['id', 'name', 'code', 'tenantStatus', 'createdAt'],
      });

      if (!existing?.id) {
        return ctx.notFound('Tenant not found');
      }

      const updated = await strapi.db.query(TENANT_UID).update({
        where: { id: tenantId },
        data: {
          tenantStatus: nextTenantStatus,
        },
      });

      ctx.body = {
        ok: true,
        data: {
          id: updated?.id,
          name: updated?.name || existing?.name || '',
          code: updated?.code || existing?.code || '',
          status: toPlatformStatus(updated?.tenantStatus ?? nextTenantStatus),
          createdAt: updated?.createdAt || existing?.createdAt || null,
        },
      };
    } catch (error) {
      strapi.log.error('[platform.updateTenantStatus] unexpected error', error);
      return ctx.internalServerError('Failed to update tenant status');
    }
  },

  async listTenantFeatures(ctx: any) {
    const tenantId = toPositiveInt(ctx.params?.id);
    if (!tenantId) {
      return ctx.badRequest('Invalid tenant id');
    }

    try {
      const tenant = await findTenantOrThrow(tenantId);
      const features = await loadTenantFeatureRows(tenantId);

      ctx.body = {
        ok: true,
        data: {
          tenant: {
            id: tenant.id,
            name: toText(tenant.name),
            code: toText(tenant.code),
            status: toText(tenant.tenantStatus) || null,
          },
          assigned: features.filter((item) => item.isEnabled === true),
          available: features.filter((item) => item.isEnabled !== true),
        },
      };
    } catch (error: any) {
      if (error?.message === 'Tenant not found') {
        return ctx.notFound('Tenant not found');
      }

      strapi.log.error('[platform.listTenantFeatures] unexpected error', error);
      return ctx.internalServerError('Failed to load tenant features');
    }
  },

  async listTenantRoles(ctx: any) {
    const tenantId = toPositiveInt(ctx.params?.tenantId ?? ctx.params?.id);
    if (!tenantId) {
      return ctx.badRequest('Invalid tenant id');
    }

    try {
      const tenant = await findTenantOrThrow(tenantId);
      const roleBuckets = await loadTenantRoleBuckets(tenantId);

      ctx.body = {
        ok: true,
        data: {
          tenant: {
            id: tenant.id,
            name: toText(tenant.name),
            code: toText(tenant.code),
            status: toText(tenant.tenantStatus) || null,
          },
          activeRoles: roleBuckets.activeRoles,
          inactiveRoles: roleBuckets.inactiveRoles,
          unassignedRoles: roleBuckets.unassignedRoles,
        },
      };
    } catch (error: any) {
      if (error?.message === 'Tenant not found') {
        return ctx.notFound('Tenant not found');
      }

      strapi.log.error('[platform.listTenantRoles] unexpected error', error);
      return ctx.internalServerError('Failed to load tenant roles');
    }
  },

  async listTenantAdmins(ctx: any) {
    const tenantId = toPositiveInt(ctx.params?.tenantId ?? ctx.params?.id);
    if (!tenantId) {
      return ctx.badRequest('Invalid tenant id');
    }

    try {
      const tenant = await findTenantOrThrow(tenantId);
      const tenantAdminContext = await resolveTenantAdminContext(tenantId);
      const admins = await loadTenantAdminAssignments(tenantId, Number(tenantAdminContext.tenantAdminRole.id));

      ctx.body = {
        ok: true,
        data: {
          tenant: {
            id: tenant.id,
            name: toText(tenant.name),
            code: toText(tenant.code),
            status: toText(tenant.tenantStatus) || null,
          },
          tenantAdminRoleCode: tenantAdminContext.tenantAdminRoleCode,
          tenantAdminRole: {
            id: tenantAdminContext.tenantAdminRole.id,
            code: toText((tenantAdminContext.tenantAdminRole as any).code) || tenantAdminContext.tenantAdminRoleCode,
            name: pickRoleLabel(tenantAdminContext.tenantAdminRole as any),
            type: toText((tenantAdminContext.tenantAdminRole as any).type) || null,
          },
          admins,
        },
      };
    } catch (error: any) {
      if (error?.message === 'Tenant not found') {
        return ctx.notFound('Tenant not found');
      }
      if (error?.status === 400) {
        return ctx.badRequest(error.message);
      }

      strapi.log.error('[platform.listTenantAdmins] unexpected error', error);
      return ctx.internalServerError('Failed to load tenant admins');
    }
  },

  async inviteTenantAdmin(ctx: any) {
    const tenantId = toPositiveInt(ctx.params?.tenantId ?? ctx.params?.id);
    if (!tenantId) {
      return ctx.badRequest('Invalid tenant id');
    }

    const identifier = toText(ctx.request?.body?.identifier);
    if (!identifier) {
      return ctx.badRequest('identifier is required');
    }

    try {
      await findTenantOrThrow(tenantId);
      const tenantAdminContext = await resolveTenantAdminContext(tenantId);
      const user = await findUserByIdentifier(identifier);
      if (!user?.id) {
        return ctx.badRequest('Khong tim thay user voi username/email da nhap.');
      }

      const now = new Date();
      const userTenant = await ensureActiveUserTenant(Number(user.id), tenantId);
      const existingAssignment = await strapi.db.query(USER_TENANT_ROLE_UID).findOne({
        where: {
          userTenant: userTenant.id,
          role: tenantAdminContext.tenantAdminRole.id,
        },
        select: ['id', 'userTenantRoleStatus', 'assignedAt', 'revokedAt', 'inactiveReason'],
      });

      const assignment = existingAssignment?.id
        ? await strapi.db.query(USER_TENANT_ROLE_UID).update({
          where: { id: existingAssignment.id },
          data: {
            userTenantRoleStatus: 'active',
            revokedAt: null,
            inactiveReason: null,
            assignedAt: existingAssignment.assignedAt || now,
          },
        })
        : await strapi.db.query(USER_TENANT_ROLE_UID).create({
          data: {
            userTenant: userTenant.id,
            role: tenantAdminContext.tenantAdminRole.id,
            userTenantRoleStatus: 'active',
            assignedAt: now,
            revokedAt: null,
            inactiveReason: null,
            isPrimary: false,
          },
        });

      ctx.body = {
        ok: true,
        message: 'Da moi/gan user lam Tenant Admin thanh cong.',
        data: {
          tenantId,
          tenantAdminRoleCode: tenantAdminContext.tenantAdminRoleCode,
          tenantAdminRole: {
            id: tenantAdminContext.tenantAdminRole.id,
            code: toText((tenantAdminContext.tenantAdminRole as any).code) || tenantAdminContext.tenantAdminRoleCode,
            name: pickRoleLabel(tenantAdminContext.tenantAdminRole as any),
          },
          admin: formatTenantAdminRow({
            ...assignment,
            userTenant: {
              id: userTenant.id,
              userTenantStatus: 'active',
              user,
            },
          }),
        },
      };
    } catch (error: any) {
      if (error?.message === 'Tenant not found') {
        return ctx.notFound('Tenant not found');
      }
      if (error?.status === 400) {
        return ctx.badRequest(error.message);
      }

      strapi.log.error('[platform.inviteTenantAdmin] unexpected error', error);
      return ctx.internalServerError('Failed to invite tenant admin');
    }
  },

  async inactiveTenantAdmin(ctx: any) {
    const tenantId = toPositiveInt(ctx.params?.tenantId ?? ctx.params?.id);
    const assignmentId = toPositiveInt(ctx.params?.assignmentId);
    if (!tenantId) {
      return ctx.badRequest('Invalid tenant id');
    }
    if (!assignmentId) {
      return ctx.badRequest('Invalid assignment id');
    }

    try {
      await findTenantOrThrow(tenantId);
      const tenantAdminContext = await resolveTenantAdminContext(tenantId);
      const assignment = await findTenantAdminAssignmentOrThrow(tenantId, assignmentId, Number(tenantAdminContext.tenantAdminRole.id));

      await strapi.db.query(USER_TENANT_ROLE_UID).update({
        where: { id: assignment.id },
        data: {
          userTenantRoleStatus: 'inactive',
          inactiveReason: MANUAL_PLATFORM_ADMIN_ACTION_REASON,
          revokedAt: new Date(),
          isPrimary: false,
        },
      });

      ctx.body = {
        ok: true,
        message: 'Da inactive Tenant Admin thanh cong.',
        data: {
          id: assignment.id,
          tenantId,
          tenantAdminRoleCode: tenantAdminContext.tenantAdminRoleCode,
          inactiveReason: MANUAL_PLATFORM_ADMIN_ACTION_REASON,
        },
      };
    } catch (error: any) {
      if (error?.message === 'Tenant not found') {
        return ctx.notFound('Tenant not found');
      }
      if (error?.message === 'Tenant admin assignment not found') {
        return ctx.notFound('Tenant admin assignment not found');
      }
      if (error?.status === 400) {
        return ctx.badRequest(error.message);
      }

      strapi.log.error('[platform.inactiveTenantAdmin] unexpected error', error);
      return ctx.internalServerError('Failed to inactive tenant admin');
    }
  },

  async activateTenantAdmin(ctx: any) {
    const tenantId = toPositiveInt(ctx.params?.tenantId ?? ctx.params?.id);
    const assignmentId = toPositiveInt(ctx.params?.assignmentId);
    if (!tenantId) {
      return ctx.badRequest('Invalid tenant id');
    }
    if (!assignmentId) {
      return ctx.badRequest('Invalid assignment id');
    }

    try {
      await findTenantOrThrow(tenantId);
      const tenantAdminContext = await resolveTenantAdminContext(tenantId);
      const assignment = await findTenantAdminAssignmentOrThrow(tenantId, assignmentId, Number(tenantAdminContext.tenantAdminRole.id));
      const now = new Date();
      const userTenantId = toPositiveInt((assignment as any)?.userTenant?.id);

      if (userTenantId && toText((assignment as any)?.userTenant?.userTenantStatus).toLowerCase() !== 'active') {
        await strapi.db.query(USER_TENANT_UID).update({
          where: { id: userTenantId },
          data: {
            userTenantStatus: 'active',
            joinedAt: (assignment as any)?.userTenant?.joinedAt || now,
            leftAt: null,
          },
        });
      }

      await strapi.db.query(USER_TENANT_ROLE_UID).update({
        where: { id: assignment.id },
        data: {
          userTenantRoleStatus: 'active',
          inactiveReason: null,
          revokedAt: null,
          assignedAt: assignment.assignedAt || now,
        },
      });

      ctx.body = {
        ok: true,
        message: 'Da kich hoat lai Tenant Admin thanh cong.',
        data: {
          id: assignment.id,
          tenantId,
          tenantAdminRoleCode: tenantAdminContext.tenantAdminRoleCode,
          status: 'active',
        },
      };
    } catch (error: any) {
      if (error?.message === 'Tenant not found') {
        return ctx.notFound('Tenant not found');
      }
      if (error?.message === 'Tenant admin assignment not found') {
        return ctx.notFound('Tenant admin assignment not found');
      }
      if (error?.status === 400) {
        return ctx.badRequest(error.message);
      }

      strapi.log.error('[platform.activateTenantAdmin] unexpected error', error);
      return ctx.internalServerError('Failed to activate tenant admin');
    }
  },

  async updateTenantFeature(ctx: any) {
    const tenantId = toPositiveInt(ctx.params?.id);
    const featureId = toPositiveInt(ctx.params?.featureId);
    if (!tenantId) {
      return ctx.badRequest('Invalid tenant id');
    }
    if (!featureId) {
      return ctx.badRequest('Invalid feature id');
    }

    const isEnabled = ctx.request?.body?.isEnabled === true;

    try {
      await findTenantOrThrow(tenantId);

      const feature = await strapi.db.query(FEATURE_UID).findOne({
        where: { id: featureId },
        select: ['id', 'name', 'key'],
      });
      if (!feature?.id) {
        return ctx.notFound('Feature not found');
      }

      const existing = await strapi.db.query(TENANT_FEATURE_UID).findOne({
        where: {
          tenant: tenantId,
          feature: featureId,
        },
        select: ['id', 'isEnabled'],
      });

      const updated = existing?.id
        ? await strapi.db.query(TENANT_FEATURE_UID).update({
          where: { id: existing.id },
          data: { isEnabled },
        })
        : await strapi.db.query(TENANT_FEATURE_UID).create({
          data: {
            tenant: tenantId,
            feature: featureId,
            isEnabled,
          },
        });

      ctx.body = {
        ok: true,
        data: {
          tenantId,
          featureId,
          tenantFeatureId: updated?.id || existing?.id || null,
          isEnabled,
          featureKey: toText((feature as any).key),
        },
      };
    } catch (error: any) {
      if (error?.message === 'Tenant not found') {
        return ctx.notFound('Tenant not found');
      }

      strapi.log.error('[platform.updateTenantFeature] unexpected error', error);
      return ctx.internalServerError('Failed to update tenant feature');
    }
  },

  async activateTenantRole(ctx: any) {
    const tenantId = toPositiveInt(ctx.params?.tenantId ?? ctx.params?.id);
    const roleId = toPositiveInt(ctx.params?.roleId);
    if (!tenantId) {
      return ctx.badRequest('Invalid tenant id');
    }
    if (!roleId) {
      return ctx.badRequest('Invalid role id');
    }

    try {
      await findTenantOrThrow(tenantId);

      const actorId = readPlatformActorId(ctx);
      const now = new Date();
      const role = await findRoleOrThrow(roleId);
      const existing = await findTenantRoleAssignment(tenantId, roleId);
      const restoredAssignments = await findTenantUserRoleAssignments({
        tenantId,
        roleId,
        status: 'inactive',
        inactiveReason: ROLE_DISABLED_FOR_TENANT_REASON,
      });

      const updated = existing?.id
        ? await strapi.db.query(TENANT_ROLE_UID).update({
          where: { id: existing.id },
          data: {
            isActive: true,
            inactiveReason: null,
            activatedAt: now,
            activatedBy: actorId,
            deactivatedAt: null,
            deactivatedBy: null,
          },
        })
        : await strapi.db.query(TENANT_ROLE_UID).create({
          data: {
            tenant: tenantId,
            role: roleId,
            isActive: true,
            inactiveReason: null,
            activatedAt: now,
            activatedBy: actorId,
            deactivatedAt: null,
            deactivatedBy: null,
          },
        });

      for (const assignment of restoredAssignments || []) {
        await strapi.db.query(USER_TENANT_ROLE_UID).update({
          where: { id: assignment.id },
          data: {
            userTenantRoleStatus: 'active',
            revokedAt: null,
            inactiveReason: null,
            assignedAt: assignment.assignedAt || now,
          },
        });
      }

      ctx.body = {
        ok: true,
        data: {
          tenantId,
          roleId,
          tenantRoleId: updated?.id || existing?.id || null,
          isActive: true,
          roleCode: pickRoleCode(role as any),
          roleName: pickRoleLabel(role as any),
          restoredUserRoleCount: (restoredAssignments || []).length,
        },
      };
    } catch (error: any) {
      if (error?.message === 'Tenant not found') {
        return ctx.notFound('Tenant not found');
      }
      if (error?.message === 'Role not found') {
        return ctx.notFound('Role not found');
      }

      strapi.log.error('[platform.activateTenantRole] unexpected error', error);
      return ctx.internalServerError('Failed to activate tenant role');
    }
  },

  async deactivateTenantRole(ctx: any) {
    const tenantId = toPositiveInt(ctx.params?.tenantId ?? ctx.params?.id);
    const roleId = toPositiveInt(ctx.params?.roleId);
    if (!tenantId) {
      return ctx.badRequest('Invalid tenant id');
    }
    if (!roleId) {
      return ctx.badRequest('Invalid role id');
    }

    try {
      await findTenantOrThrow(tenantId);

      const actorId = readPlatformActorId(ctx);
      const now = new Date();
      const role = await findRoleOrThrow(roleId);
      const existing = await findTenantRoleAssignment(tenantId, roleId);
      if (!existing?.id || existing.isActive !== true) {
        return ctx.badRequest('Tenant role assignment is not active');
      }

      const affectedAssignments = await findTenantUserRoleAssignments({
        tenantId,
        roleId,
        status: 'active',
      });

      const updated = await strapi.db.query(TENANT_ROLE_UID).update({
        where: { id: existing.id },
        data: {
          isActive: false,
          inactiveReason: ROLE_DISABLED_FOR_TENANT_REASON,
          deactivatedAt: now,
          deactivatedBy: actorId,
        },
      });

      for (const assignment of affectedAssignments || []) {
        await strapi.db.query(USER_TENANT_ROLE_UID).update({
          where: { id: assignment.id },
          data: {
            userTenantRoleStatus: 'inactive',
            isPrimary: false,
            revokedAt: now,
            inactiveReason: ROLE_DISABLED_FOR_TENANT_REASON,
          },
        });
      }

      ctx.body = {
        ok: true,
        data: {
          tenantId,
          roleId,
          tenantRoleId: updated?.id || existing.id,
          isActive: false,
          roleCode: pickRoleCode(role as any),
          roleName: pickRoleLabel(role as any),
          affectedUserRoleCount: (affectedAssignments || []).length,
        },
      };
    } catch (error: any) {
      if (error?.message === 'Tenant not found') {
        return ctx.notFound('Tenant not found');
      }
      if (error?.message === 'Role not found') {
        return ctx.notFound('Role not found');
      }

      strapi.log.error('[platform.deactivateTenantRole] unexpected error', error);
      return ctx.internalServerError('Failed to deactivate tenant role');
    }
  },

  async listTenantStorageConfigs(ctx: any) {
    const tenantId = toPositiveInt(ctx.params?.tenantId ?? ctx.params?.id);
    if (!tenantId) {
      return ctx.badRequest('Invalid tenant id');
    }

    try {
      ctx.body = {
        ok: true,
        data: await listTenantStorageRows(tenantId),
      };
    } catch (error: any) {
      if (error?.message === 'Tenant not found') {
        return ctx.notFound('Tenant not found');
      }

      strapi.log.error('[platform.listTenantStorageConfigs] unexpected error', error);
      return ctx.internalServerError('Failed to load tenant storage configs');
    }
  },

  async createTenantStorageConfig(ctx: any) {
    const tenantId = toPositiveInt(ctx.params?.tenantId ?? ctx.params?.id);
    if (!tenantId) {
      return ctx.badRequest('Invalid tenant id');
    }

    try {
      await findTenantOrThrow(tenantId);
      const payload = readTenantStoragePayload(ctx.request?.body);

      await strapi.db.query(TENANT_STORAGE_UID).create({
        data: {
          ...payload,
          tenant: tenantId,
          isDefault: false,
        },
      });

      ctx.body = {
        ok: true,
        data: await listTenantStorageRows(tenantId),
      };
    } catch (error: any) {
      if (error?.message === 'Tenant not found') {
        return ctx.notFound('Tenant not found');
      }

      if (
        error?.message === 'name is required'
        || error?.message === 'basePath is required'
        || String(error?.message || '').includes('provider must be one of:')
        || error?.message === 'quotaGB must be a non-negative number'
        || error?.message === 'usedBytes must be a non-negative integer'
        || error?.message === 'settings must be valid JSON'
        || error?.message === 'isActive must be a boolean'
      ) {
        return ctx.badRequest(error.message);
      }

      strapi.log.error('[platform.createTenantStorageConfig] unexpected error', error);
      return ctx.internalServerError('Failed to create tenant storage config');
    }
  },

  async updateTenantStorageConfig(ctx: any) {
    const tenantId = toPositiveInt(ctx.params?.tenantId ?? ctx.params?.id);
    const storageConfigId = toPositiveInt(ctx.params?.storageConfigId);
    if (!tenantId) {
      return ctx.badRequest('Invalid tenant id');
    }
    if (!storageConfigId) {
      return ctx.badRequest('Invalid storage config id');
    }

    try {
      await findTenantOrThrow(tenantId);
      await findTenantStorageConfigOrThrow(tenantId, storageConfigId);
      const payload = readTenantStoragePayload(ctx.request?.body, { partial: true });

      await strapi.db.query(TENANT_STORAGE_UID).update({
        where: { id: storageConfigId },
        data: payload,
      });

      ctx.body = {
        ok: true,
        data: await listTenantStorageRows(tenantId),
      };
    } catch (error: any) {
      if (error?.message === 'Tenant not found') {
        return ctx.notFound('Tenant not found');
      }
      if (error?.message === 'Storage config not found') {
        return ctx.notFound('Storage config not found');
      }

      if (
        error?.message === 'name is required'
        || error?.message === 'basePath is required'
        || String(error?.message || '').includes('provider must be one of:')
        || error?.message === 'quotaGB must be a non-negative number'
        || error?.message === 'usedBytes must be a non-negative integer'
        || error?.message === 'settings must be valid JSON'
        || error?.message === 'isActive must be a boolean'
      ) {
        return ctx.badRequest(error.message);
      }

      strapi.log.error('[platform.updateTenantStorageConfig] unexpected error', error);
      return ctx.internalServerError('Failed to update tenant storage config');
    }
  },

  async updateTenantDefaultStorageConfig(ctx: any) {
    const tenantId = toPositiveInt(ctx.params?.tenantId ?? ctx.params?.id);
    if (!tenantId) {
      return ctx.badRequest('Invalid tenant id');
    }

    const storageConfigIdRaw = ctx.request?.body?.storageDefaultConfigId;
    const storageConfigId = storageConfigIdRaw === null || storageConfigIdRaw === undefined || storageConfigIdRaw === ''
      ? null
      : toPositiveInt(storageConfigIdRaw);

    if (storageConfigIdRaw !== null && storageConfigIdRaw !== undefined && storageConfigIdRaw !== '' && !storageConfigId) {
      return ctx.badRequest('storageDefaultConfigId must be a positive integer or null');
    }

    try {
      await findTenantOrThrow(tenantId);
      await updateTenantDefaultStorageConfig(tenantId, storageConfigId);

      ctx.body = {
        ok: true,
        data: await listTenantStorageRows(tenantId),
      };
    } catch (error: any) {
      if (error?.message === 'Tenant not found') {
        return ctx.notFound('Tenant not found');
      }
      if (error?.message === 'Storage config not found') {
        return ctx.notFound('Storage config not found');
      }

      strapi.log.error('[platform.updateTenantDefaultStorageConfig] unexpected error', error);
      return ctx.internalServerError('Failed to update tenant default storage config');
    }
  },

  async permissionDebug(ctx: any) {
    const userId = toPositiveInt(ctx.request?.query?.userId);
    if (!userId) {
      return ctx.badRequest('userId must be a positive integer');
    }

    const tenantCode = toText(ctx.request?.query?.tenantCode).toLowerCase();
    if (!tenantCode) {
      return ctx.badRequest('tenantCode is required');
    }

    try {
      const tenant = await strapi.db.query(TENANT_UID).findOne({
        where: { code: tenantCode },
        select: ['id', 'name', 'code', 'tenantStatus'],
      });

      const tenantId = toPositiveInt(tenant?.id);
      if (!tenantId) {
        return ctx.notFound('Tenant not found');
      }

      const userTenant = await strapi.db.query(USER_TENANT_UID).findOne({
        where: {
          user: userId,
          tenant: tenantId,
          userTenantStatus: 'active',
        },
        select: ['id', 'label'],
      });

      const userTenantId = toPositiveInt(userTenant?.id);
      if (!userTenantId) {
        return ctx.body = {
          roles: [],
          features: [],
        };
      }

      const userTenantRoles = await strapi.db.query(USER_TENANT_ROLE_UID).findMany({
        where: {
          userTenant: userTenantId,
          userTenantRoleStatus: 'active',
        },
        populate: {
          role: {
            select: ['id', 'name', 'type', 'description'],
          },
        },
      });

      const roles = (userTenantRoles || [])
        .map((item: any) => {
          const role = item?.role as Record<string, unknown> | null;
          if (!role) return null;

          const roleId = toPositiveInt((role as any).id);
          if (!roleId) return null;

          return {
            id: roleId,
            name: toText(role.name) || pickRoleLabel(role),
            code: pickRoleCode(role),
            label: pickRoleLabel(role),
          };
        })
        .filter((item): item is { id: number; name: string; code: string | null; label: string } => Boolean(item));

      const uniqueRoles = Array.from(new Map(roles.map((role) => [role.id, role])).values());
      const roleIds = uniqueRoles.map((role) => role.id);

      const roleFeatureRows = roleIds.length > 0
        ? await strapi.db.query(ROLE_FEATURE_UID).findMany({
          where: {
            role: {
              id: {
                $in: roleIds,
              },
            },
          },
          populate: {
            feature: {
              select: ['id', 'key'],
            },
          },
        })
        : [];

      const roleFeatureMap = new Map<string, { featureId: number | null; featureKey: string }>();
      for (const row of roleFeatureRows || []) {
        const feature = row?.feature;
        const featureId = toPositiveInt(feature?.id);
        const featureKey = toText(feature?.key);
        if (!featureKey) continue;

        roleFeatureMap.set(featureKey, {
          featureId,
          featureKey,
        });
      }

      const tenantFeatureRows = await strapi.db.query(TENANT_FEATURE_UID).findMany({
        where: {
          tenant: tenantId,
        },
        populate: {
          feature: {
            select: ['id', 'key'],
          },
        },
      });

      const tenantFeatureMap = new Map<string, { featureId: number | null; featureKey: string; isEnabled: boolean }>();
      for (const row of tenantFeatureRows || []) {
        const feature = row?.feature;
        const featureId = toPositiveInt(feature?.id);
        const featureKey = toText(feature?.key);
        if (!featureKey) continue;

        tenantFeatureMap.set(featureKey, {
          featureId,
          featureKey,
          isEnabled: row?.isEnabled === true,
        });
      }

      const allFeatureKeys = Array.from(new Set([
        ...roleFeatureMap.keys(),
        ...tenantFeatureMap.keys(),
      ]));

      const features = allFeatureKeys
        .map((featureKey) => {
          const roleFeature = roleFeatureMap.get(featureKey);
          const tenantFeature = tenantFeatureMap.get(featureKey);
          const hasRoleFeature = Boolean(roleFeature);
          const hasTenantFeature = tenantFeature?.isEnabled === true;

          return {
            featureKey,
            hasRoleFeature,
            hasTenantFeature,
            allowed: hasRoleFeature && hasTenantFeature,
          };
        })
        .sort(compareFeatureEntries);

      ctx.body = {
        roles: uniqueRoles,
        features,
      };
    } catch (error) {
      strapi.log.error('[platform.permissionDebug] unexpected error', error);
      return ctx.internalServerError('Failed to load permission debug data');
    }
  },
};