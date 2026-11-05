import { getActiveCommunityConfig } from '../api/community-config/services/community-config-management';

type PermissionLookup = {
  userId: number;
  tenantId: number;
};

const USER_TENANT_UID = 'api::user-tenant.user-tenant';
const USER_TENANT_ROLE_UID = 'api::user-tenant-role.user-tenant-role';
const ROLE_FEATURE_UID = 'api::role-feature.role-feature';
const TENANT_FEATURE_UID = 'api::tenant-feature.tenant-feature';
const COMMUNITY_POST_UID = 'api::community-post.community-post';
const SPORTS_PROFILE_UID = 'api::sports-profile.sports-profile';
const CLUB_MEMBERSHIP_UID = 'api::club-membership.club-membership';
const SPORTS_ACHIEVEMENT_SUBMISSION_UID = 'api::sports-achievement-submission.sports-achievement-submission';

function toText(value: unknown): string {
  if (value === null || value === undefined) return '';
  return String(value).trim();
}

function toPositiveInt(value: unknown): number | null {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

function normalizeModuleKey(value: unknown): string {
  return toText(value).toLowerCase();
}

function toBoolean(value: unknown, fallback = false): boolean {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value !== 0;
  const normalized = toText(value).toLowerCase();
  if (!normalized) return fallback;
  return normalized === 'true' || normalized === '1' || normalized === 'yes' || normalized === 'on';
}

function isCommunityModule(moduleKey: string): boolean {
  const normalized = normalizeModuleKey(moduleKey);
  return normalized === 'community' || normalized.startsWith('community/');
}

import * as path from 'node:path';

type ModuleFeatureRule = {
  test: (moduleKey: string) => boolean;
  featureKeys: string[];
};

type UploadCapabilityConfig = {
  enabled?: boolean;
  moduleKey?: string;
  entityType?: string;
  featureKey?: string;
};

const MODULE_FEATURE_RULES: ModuleFeatureRule[] = [
  {
    test: (moduleKey) => moduleKey === 'community' || moduleKey.startsWith('community/'),
    featureKeys: ['community-post.manage', 'community-group.manage', 'community-config.manage'],
  },
  {
    test: (moduleKey) => moduleKey === 'sports-club' || moduleKey.startsWith('sports-club/'),
    featureKeys: ['sports-club.manage'],
  },
  {
    test: (moduleKey) => moduleKey === 'sports-profile' || moduleKey.startsWith('sports-profile/'),
    featureKeys: ['sports-profile.manage'],
  },
  {
    test: (moduleKey) => moduleKey === 'sports-achievement' || moduleKey.startsWith('sports-achievement/'),
    featureKeys: ['sports-achievement.manage'],
  },
  {
    test: (moduleKey) => moduleKey === 'sports-achievement-submission' || moduleKey.startsWith('sports-achievement-submission/'),
    featureKeys: ['sports-achievement-submission.manage'],
  },
  {
    test: (moduleKey) => moduleKey === 'question-bank' || moduleKey.startsWith('question-bank/'),
    featureKeys: ['learning.question.manage', 'learning.learning-object.manage'],
  },
  {
    test: (moduleKey) => moduleKey === 'lucky-wheel' || moduleKey.startsWith('lucky-wheel/'),
    featureKeys: ['lucky-wheel.manage'],
  },
];

function loadModuleUploadCapabilities(): Map<string, UploadCapabilityConfig[]> {
  const registry = new Map<string, UploadCapabilityConfig[]>();

  try {
    const moduleDefinitionsPath = path.resolve(__dirname, '../../scripts/module-definitions');
    const moduleDefinitions = require(moduleDefinitionsPath);
    if (!Array.isArray(moduleDefinitions)) return registry;

    for (const moduleDef of moduleDefinitions) {
      const features = Array.isArray(moduleDef?.features) ? moduleDef.features : [];

      for (const feature of features) {
        const upload = feature?.upload;
        if (!upload || typeof upload !== 'object') continue;

        const enabled = toBoolean(upload.enabled, true);
        if (!enabled) continue;

        const resolvedModuleKey = toText(upload.moduleKey || feature?.key || '').toLowerCase();
        const resolvedFeatureKey = toText(upload.featureKey || feature?.key || '').toLowerCase();
        const entityType = toText(upload.entityType || '').toLowerCase();

        if (!resolvedModuleKey || !resolvedFeatureKey) continue;

        const existing = registry.get(resolvedModuleKey) || [];
        existing.push({
          enabled,
          moduleKey: resolvedModuleKey,
          featureKey: resolvedFeatureKey,
          entityType,
        });
        registry.set(resolvedModuleKey, existing);
      }
    }
  } catch {
    // Fallback to static compatibility rules below.
  }

  return registry;
}

function resolveAllowedFeatureKeysForModule(moduleKey: string): string[] {
  const normalizedModuleKey = normalizeModuleKey(moduleKey);
  if (!normalizedModuleKey) return [];

  const registry = loadModuleUploadCapabilities();
  const declared = registry.get(normalizedModuleKey) || [];
  if (declared.length > 0) {
    return Array.from(new Set(declared
      .map((item) => toText(item.featureKey).toLowerCase())
      .filter(Boolean)));
  }

  const matchedRule = MODULE_FEATURE_RULES.find((rule) => rule.test(normalizedModuleKey));
  if (!matchedRule) return [];
  return Array.from(new Set(matchedRule.featureKeys.map((item) => toText(item).toLowerCase()).filter(Boolean)));
}

function resolveAllowedEntityTypesForModule(moduleKey: string): string[] {
  const normalizedModuleKey = normalizeModuleKey(moduleKey);
  if (!normalizedModuleKey) return [];

  const registry = loadModuleUploadCapabilities();
  const declared = registry.get(normalizedModuleKey) || [];
  const entityTypes = declared
    .map((item) => toText(item.entityType).toLowerCase())
    .filter(Boolean);

  if (entityTypes.length > 0) return Array.from(new Set(entityTypes));

  return [normalizedModuleKey];
}

function getClientRequestedFeatureKeys(ctx: any): string[] {
  const requestFeatureKeys = Array.isArray(ctx.request?.body?.featureKeys)
    ? ctx.request.body.featureKeys
    : Array.isArray(ctx.request?.body?.['featureKeys[]'])
      ? ctx.request.body['featureKeys[]']
      : [];

  return [
    toText(ctx.request?.body?.featureKey).toLowerCase(),
    ...requestFeatureKeys.map((item: unknown) => toText(item).toLowerCase()),
  ].filter(Boolean);
}

function writeDeniedAuditLog(params: {
  reason: 'invalid_tenant_context' | 'module_key_missing' | 'tenant_membership_missing' | 'module_feature_mapping_invalid' | 'tenant_feature_missing' | 'module_permission_missing' | 'community_member_post_forbidden';
  userId: number | null;
  tenantId: number | null;
  moduleKey: string;
  featureKeys?: string[];
  requiredFeatureKeys?: string[];
}) {
  strapi.log.warn('[tenant-storage-upload-access] denied upload', {
    reason: params.reason,
    userId: params.userId,
    tenantId: params.tenantId,
    moduleKey: params.moduleKey,
    requestedFeatureKeys: params.featureKeys || [],
    requiredFeatureKeys: params.requiredFeatureKeys || [],
  });
}

async function resolveUserFromJwt(ctx: any): Promise<any | null> {
  try {
    const authHeader = ctx.request?.headers?.authorization || ctx.request?.header?.authorization || '';
    const token = typeof authHeader === 'string' && authHeader.startsWith('Bearer ')
      ? authHeader.slice(7).trim()
      : '';
    if (!token) return null;

    const jwtService = strapi.plugin('users-permissions')?.service('jwt');
    if (!jwtService) return null;

    const decoded = await jwtService.verify(token);
    const userId = toPositiveInt(decoded?.id);
    if (!userId) return null;

    return strapi.db.query('plugin::users-permissions.user').findOne({
      where: { id: userId },
      select: ['id', 'blocked'],
    });
  } catch {
    return null;
  }
}

async function getTenantScopedPermissionSnapshot(params: PermissionLookup): Promise<{
  hasActiveMembership: boolean;
  permissionKeys: Set<string>;
}> {
  const membership = await strapi.db.query(USER_TENANT_UID).findOne({
    where: {
      user: params.userId,
      tenant: params.tenantId,
      userTenantStatus: 'active',
    },
    select: ['id'],
  });

  const membershipId = toPositiveInt(membership?.id);
  if (!membershipId) {
    return {
      hasActiveMembership: false,
      permissionKeys: new Set(),
    };
  }

  const userTenantRoles = await strapi.db.query(USER_TENANT_ROLE_UID).findMany({
    where: {
      userTenant: membershipId,
      userTenantRoleStatus: 'active',
    },
    populate: {
      role: {
        select: ['id'],
      },
    },
  });

  const roleIds = Array.from(new Set((userTenantRoles || [])
    .map((item: any) => toPositiveInt(item?.role?.id || item?.role))
    .filter((value: number | null): value is number => Boolean(value))));
  if (roleIds.length === 0) {
    return {
      hasActiveMembership: true,
      permissionKeys: new Set(),
    };
  }

  const mappings = await strapi.db.query(ROLE_FEATURE_UID).findMany({
    where: {
      role: {
        id: {
          $in: roleIds,
        },
      },
      isActive: true,
    },
    populate: {
      feature: {
        select: ['key'],
      },
    },
  });

  return {
    hasActiveMembership: true,
    permissionKeys: new Set((mappings || [])
      .map((item: any) => toText(item?.feature?.key).toLowerCase())
      .filter(Boolean)),
  };
}

async function getEnabledTenantFeatureKeys(tenantId: number): Promise<Set<string>> {
  const rows = await strapi.db.query(TENANT_FEATURE_UID).findMany({
    where: {
      tenant: tenantId,
      isEnabled: true,
    },
    populate: {
      feature: {
        select: ['key'],
      },
    },
  });

  return new Set((rows || [])
    .map((item: any) => toText(item?.feature?.key).toLowerCase())
    .filter(Boolean));
}

async function canMemberUploadCommunityPostAttachment(params: {
  tenantId: number;
  userId: number;
  entityType: unknown;
  entityId: unknown;
  enabledFeatureKeys: Set<string>;
}) {
  if (!params.enabledFeatureKeys.has('community')) {
    return false;
  }

  const activeConfig = await getActiveCommunityConfig(params.tenantId);
  if (!activeConfig?.id) {
    return false;
  }

  const policyConfig = activeConfig.policyConfig && typeof activeConfig.policyConfig === 'object'
    ? activeConfig.policyConfig
    : {};
  const allowMemberPost = toBoolean((policyConfig as any)?.allowMemberPost, true);
  if (!allowMemberPost) {
    return false;
  }

  const normalizedEntityType = toText(params.entityType).toLowerCase();
  const hasEntityId = toText(params.entityId).length > 0;
  if (normalizedEntityType && normalizedEntityType !== 'community-post') {
    return false;
  }
  if (!hasEntityId) {
    return true;
  }

  const postId = toPositiveInt(params.entityId);
  if (!postId) {
    return false;
  }

  const post = await strapi.db.query(COMMUNITY_POST_UID).findOne({
    where: {
      id: postId,
      tenant: {
        id: {
          $eq: params.tenantId,
        },
      },
      isDeleted: {
        $ne: true,
      },
    },
    select: ['id', 'status', 'scope'],
    populate: {
      author: { select: ['id'] },
      group: { select: ['id', 'status', 'allowMemberPost'] },
    },
  });

  if (!post?.id) {
    return false;
  }

  const ownerId = toPositiveInt(post?.author?.id || post?.author);
  if (!ownerId || ownerId !== params.userId) {
    return false;
  }

  const status = toText(post.status).toLowerCase();
  if (status !== 'draft' && status !== 'rejected') {
    return false;
  }

  if (post.group?.id) {
    if (toText(post.group.status).toLowerCase() !== 'active') {
      return false;
    }
    if (post.group.allowMemberPost === false) {
      return false;
    }
  }

  return true;
}

async function canSelfServiceUploadForModule(params: {
  tenantId: number;
  userId: number;
  moduleKey: string;
  entityType: unknown;
  entityId: unknown;
}) {
  const normalizedModuleKey = normalizeModuleKey(params.moduleKey);
  if (!normalizedModuleKey) {
    return false;
  }

  if (normalizedModuleKey === 'sports-profile' || normalizedModuleKey.startsWith('sports-profile/')) {
    const profile = await strapi.db.query(SPORTS_PROFILE_UID).findOne({
      where: {
        user: { id: { $eq: params.userId } },
        tenant: { id: { $eq: params.tenantId } },
        status: { $ne: 'merged' },
      },
      select: ['id'],
    });
    return Boolean(profile?.id);
  }

  if (normalizedModuleKey === 'sports-achievement-submission' || normalizedModuleKey.startsWith('sports-achievement-submission/')) {
    const profile = await strapi.db.query(SPORTS_PROFILE_UID).findOne({
      where: {
        user: { id: { $eq: params.userId } },
        tenant: { id: { $eq: params.tenantId } },
        status: { $ne: 'merged' },
      },
      select: ['id'],
    });
    if (!profile?.id) {
      return false;
    }

    const entityId = toPositiveInt(params.entityId);
    if (entityId) {
      const submission = await strapi.db.query(SPORTS_ACHIEVEMENT_SUBMISSION_UID).findOne({
        where: {
          id: entityId,
          tenant: { id: { $eq: params.tenantId } },
          sportsProfile: { id: { $eq: Number(profile.id) } },
        },
        select: ['id'],
      });
      return Boolean(submission?.id);
    }

    const activeMembership = await strapi.db.query(CLUB_MEMBERSHIP_UID).findOne({
      where: {
        sportsProfile: { id: { $eq: Number(profile.id) } },
        tenant: { id: { $eq: params.tenantId } },
        status: { $eq: 'active' },
      },
      select: ['id'],
    });
    return Boolean(activeMembership?.id);
  }

  return false;
}

export default async (policyContext: any) => {
  const ctx = policyContext?.ctx ?? policyContext;
  const state = policyContext?.state ?? ctx?.state;

  const unauthorized = (message = 'Unauthorized') => {
    if (typeof ctx?.unauthorized === 'function') return ctx.unauthorized(message);
    if (typeof ctx?.throw === 'function') return ctx.throw(401, message);
    const error = new Error(message) as Error & { status?: number };
    error.status = 401;
    throw error;
  };

  const forbidden = (message = 'Forbidden') => {
    if (typeof ctx?.forbidden === 'function') return ctx.forbidden(message);
    if (typeof ctx?.throw === 'function') return ctx.throw(403, message);
    const error = new Error(message) as Error & { status?: number };
    error.status = 403;
    throw error;
  };

  let authUser = state?.user;
  if (!authUser?.id) {
    authUser = await resolveUserFromJwt(ctx);
  }

  if (!authUser?.id) {
    return unauthorized('Unauthorized');
  }
  if (authUser.blocked) {
    return unauthorized('Account is blocked');
  }

  const userId = toPositiveInt(authUser.id);
  const tenantId = toPositiveInt(state?.tenantId ?? state?.tenant?.id);
  if (!userId || !tenantId) {
    writeDeniedAuditLog({
      reason: 'invalid_tenant_context',
      userId,
      tenantId,
      moduleKey: normalizeModuleKey(ctx.request?.body?.moduleKey),
      featureKeys: getClientRequestedFeatureKeys(ctx),
    });
    return forbidden('Tenant context is required (x-tenant-code header)');
  }

  const moduleKey = toText(ctx.request?.body?.moduleKey);
  if (!moduleKey) {
    writeDeniedAuditLog({
      reason: 'module_key_missing',
      userId,
      tenantId,
      moduleKey: '',
      featureKeys: getClientRequestedFeatureKeys(ctx),
    });
    return forbidden('moduleKey is required');
  }

  const permissionSnapshot = await getTenantScopedPermissionSnapshot({ userId, tenantId });
  if (!permissionSnapshot.hasActiveMembership) {
    writeDeniedAuditLog({
      reason: 'tenant_membership_missing',
      userId,
      tenantId,
      moduleKey: normalizeModuleKey(moduleKey),
      featureKeys: getClientRequestedFeatureKeys(ctx),
    });
    return forbidden('Forbidden: user is not an active member of this tenant');
  }

  const permissionKeys = permissionSnapshot.permissionKeys;
  if (permissionKeys.has('storage.manage')) {
    return true;
  }

  const enabledFeatureKeys = await getEnabledTenantFeatureKeys(tenantId);
  const requestedFeatureKeys = getClientRequestedFeatureKeys(ctx);
  const allowedFeatureKeys = resolveAllowedFeatureKeysForModule(moduleKey);
  const allowedEntityTypes = resolveAllowedEntityTypesForModule(moduleKey);
  const entityType = toText(ctx.request?.body?.entityType).toLowerCase();

  if (entityType && allowedEntityTypes.length > 0 && !allowedEntityTypes.includes(entityType)) {
    writeDeniedAuditLog({
      reason: 'module_feature_mapping_invalid',
      userId,
      tenantId,
      moduleKey: normalizeModuleKey(moduleKey),
      featureKeys: requestedFeatureKeys,
      requiredFeatureKeys: allowedFeatureKeys,
    });
    return forbidden('Forbidden: entityType is not allowed for this moduleKey');
  }
  if (allowedFeatureKeys.length === 0) {
    writeDeniedAuditLog({
      reason: 'module_feature_mapping_invalid',
      userId,
      tenantId,
      moduleKey: normalizeModuleKey(moduleKey),
      featureKeys: requestedFeatureKeys,
    });
    return forbidden(`Forbidden: moduleKey "${moduleKey}" is not allowed for tenant-scoped upload`);
  }

  if (requestedFeatureKeys.length > 0 && requestedFeatureKeys.some((item) => !allowedFeatureKeys.includes(item))) {
    writeDeniedAuditLog({
      reason: 'module_feature_mapping_invalid',
      userId,
      tenantId,
      moduleKey: normalizeModuleKey(moduleKey),
      featureKeys: requestedFeatureKeys,
      requiredFeatureKeys: allowedFeatureKeys,
    });
    return forbidden('Forbidden: featureKey does not match moduleKey authorization rules');
  }

  const enabledAllowedFeatureKeys = allowedFeatureKeys.filter((item) => enabledFeatureKeys.has(item));
  if (enabledAllowedFeatureKeys.length === 0) {
    writeDeniedAuditLog({
      reason: 'tenant_feature_missing',
      userId,
      tenantId,
      moduleKey: normalizeModuleKey(moduleKey),
      featureKeys: requestedFeatureKeys,
      requiredFeatureKeys: allowedFeatureKeys,
    });
    return forbidden(`Forbidden: no enabled tenant feature for moduleKey "${moduleKey}"`);
  }

  const hasAnyPermission = enabledAllowedFeatureKeys.some((item) => permissionKeys.has(item));
  if (!hasAnyPermission) {
    const canUploadAsSelfServiceUser = await canSelfServiceUploadForModule({
      tenantId,
      userId,
      moduleKey,
      entityType: ctx.request?.body?.entityType,
      entityId: ctx.request?.body?.entityId,
    });
    if (canUploadAsSelfServiceUser) {
      return true;
    }

    if (isCommunityModule(moduleKey)) {
      const canUploadAsMember = await canMemberUploadCommunityPostAttachment({
        tenantId,
        userId,
        entityType: ctx.request?.body?.entityType,
        entityId: ctx.request?.body?.entityId,
        enabledFeatureKeys,
      });
      if (canUploadAsMember) {
        return true;
      }

      writeDeniedAuditLog({
        reason: 'community_member_post_forbidden',
        userId,
        tenantId,
        moduleKey: normalizeModuleKey(moduleKey),
        featureKeys: requestedFeatureKeys,
        requiredFeatureKeys: enabledAllowedFeatureKeys,
      });
      return forbidden('Forbidden: missing required module permission in tenant scope');
    }

    writeDeniedAuditLog({
      reason: 'module_permission_missing',
      userId,
      tenantId,
      moduleKey: normalizeModuleKey(moduleKey),
      featureKeys: requestedFeatureKeys,
      requiredFeatureKeys: enabledAllowedFeatureKeys,
    });
    return forbidden('Forbidden: missing required module permission in tenant scope');
  }

  return true;
};
