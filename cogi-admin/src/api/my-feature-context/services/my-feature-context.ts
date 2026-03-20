const TENANT_UID = 'api::tenant.tenant';
const USER_TENANT_UID = 'api::user-tenant.user-tenant';
const USER_TENANT_ROLE_UID = 'api::user-tenant-role.user-tenant-role';
const ROLE_FEATURE_UID = 'api::role-feature.role-feature';
const TENANT_FEATURE_UID = 'api::tenant-feature.tenant-feature';
const FEATURE_UID = 'api::feature.feature';

class HttpError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

function normalizeText(value: unknown): string {
  if (value === null || value === undefined) return '';
  return String(value).trim();
}

function toPositiveNumber(value: unknown): number | null {
  if (typeof value === 'number') {
    return Number.isFinite(value) && value > 0 ? value : null;
  }

  if (typeof value === 'string') {
    const parsed = Number(value);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
  }

  if (typeof value !== 'object' || value === null) return null;

  const relation = value as { id?: unknown };
  return toPositiveNumber(relation.id);
}

function uniqueNumbers(values: Array<number | null | undefined>): number[] {
  return Array.from(new Set(values.filter((value): value is number => Boolean(value && value > 0))));
}

function pickRoleCode(role: Record<string, unknown>): string | null {
  const fromCode = normalizeText(role.code);
  if (fromCode) return fromCode;

  const fromType = normalizeText(role.type);
  if (fromType) return fromType;

  return null;
}

function pickRoleLabel(role: Record<string, unknown>): string {
  const values = [role.label, role.name, role.code, role.type, role.id, role.documentId];

  for (const value of values) {
    const text = normalizeText(value);
    if (text) return text;
  }

  return 'Unknown Role';
}

function sortByOrderThenName<T extends Record<string, unknown>>(items: T[]): T[] {
  return [...items].sort((a, b) => {
    const orderA = Number(a.order ?? 0);
    const orderB = Number(b.order ?? 0);

    if (orderA !== orderB) return orderA - orderB;

    const nameA = normalizeText(a.name).toLowerCase();
    const nameB = normalizeText(b.name).toLowerCase();
    return nameA.localeCompare(nameB);
  });
}

async function findTenantByCode(tenantCode: string) {
  return strapi.db.query(TENANT_UID).findOne({
    where: {
      code: tenantCode,
      tenantStatus: 'active',
    },
    select: ['id', 'name', 'code'],
  });
}

async function findUserTenant(userId: number, tenantId: number) {
  return strapi.db.query(USER_TENANT_UID).findOne({
    where: {
      user: userId,
      tenant: tenantId,
      userTenantStatus: 'active',
    },
    select: ['id', 'label'],
  });
}

async function findUserTenantRoles(userTenantId: number) {
  return strapi.db.query(USER_TENANT_ROLE_UID).findMany({
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
}

async function findRoleFeatures(roleIds: number[]) {
  if (roleIds.length === 0) return [];

  return strapi.db.query(ROLE_FEATURE_UID).findMany({
    where: {
      role: {
        id: {
          $in: roleIds,
        },
      },
    },
    populate: {
      feature: {
        select: ['id', 'name', 'key', 'description', 'order', 'path'],
        populate: {
          group: {
            select: ['id', 'name', 'code', 'icon', 'order'],
          },
        },
      },
    },
  });
}

async function findEnabledTenantFeatureIds(tenantId: number, featureIds: number[]) {
  if (featureIds.length === 0) return [];

  const rows = await strapi.db.query(TENANT_FEATURE_UID).findMany({
    where: {
      tenant: tenantId,
      isEnabled: true,
      feature: {
        id: {
          $in: featureIds,
        },
      },
    },
    populate: {
      feature: {
        select: ['id'],
      },
    },
  });

  return uniqueNumbers((rows || []).map((item: any) => toPositiveNumber(item?.feature)));
}

async function findFeaturesByIds(featureIds: number[]) {
  if (featureIds.length === 0) return [];

  return strapi.db.query(FEATURE_UID).findMany({
    where: {
      id: {
        $in: featureIds,
      },
    },
    select: ['id', 'name', 'key', 'description', 'order', 'path'],
    populate: {
      group: {
        select: ['id', 'name', 'code', 'icon', 'order'],
      },
    },
  });
}

function buildFeatureGroups(features: any[]) {
  const grouped = new Map<number, {
    id: number;
    name: string;
    code: string | null;
    icon: string | null;
    order: number;
    features: Array<{
      id: number;
      name: string;
      key: string;
      description: string | null;
      order: number;
      path: string | null;
    }>;
  }>();

  for (const feature of features) {
    const group = feature?.group;
    const groupId = toPositiveNumber(group?.id);
    if (!groupId) continue;

    if (!grouped.has(groupId)) {
      grouped.set(groupId, {
        id: groupId,
        name: normalizeText(group?.name) || `Group ${groupId}`,
        code: normalizeText(group?.code) || null,
        icon: normalizeText(group?.icon) || null,
        order: Number(group?.order ?? 0),
        features: [],
      });
    }

    const current = grouped.get(groupId)!;
    const featureId = toPositiveNumber(feature?.id);
    if (!featureId) continue;

    current.features.push({
      id: featureId,
      name: normalizeText(feature?.name) || `Feature ${featureId}`,
      key: normalizeText(feature?.key),
      description: normalizeText(feature?.description) || null,
      order: Number(feature?.order ?? 0),
      path: normalizeText(feature?.path) || null,
    });
  }

  const groups = Array.from(grouped.values())
    .map((group) => ({
      ...group,
      features: sortByOrderThenName(group.features),
    }));

  return sortByOrderThenName(groups);
}

function buildFlatFeatures(features: any[]) {
  const flat = features.map((feature) => {
    const id = toPositiveNumber(feature?.id) || 0;

    return {
      id,
      name: normalizeText(feature?.name) || `Feature ${id}`,
      key: normalizeText(feature?.key),
      groupCode: normalizeText(feature?.group?.code) || null,
      path: normalizeText(feature?.path) || null,
    };
  });

  const unique = Array.from(new Map(flat.map((item) => [item.id, item])).values());
  return sortByOrderThenName(unique as any[]);
}

export default {
  async buildContext(params: { userId: number; tenantCode: string }) {
    const userId = Number(params.userId);
    if (!Number.isFinite(userId) || userId <= 0) {
      throw new HttpError(400, 'Invalid user id');
    }

    const tenantCode = normalizeText(params.tenantCode).toLowerCase();
    if (!tenantCode) {
      throw new HttpError(400, 'x-tenant-code header is required');
    }

    const tenant = await findTenantByCode(tenantCode);
    if (!tenant) {
      throw new HttpError(404, 'Tenant not found');
    }

    const tenantId = toPositiveNumber(tenant.id);
    if (!tenantId) {
      throw new HttpError(404, 'Tenant not found');
    }

    const userTenant = await findUserTenant(userId, tenantId);
    if (!userTenant) {
      throw new HttpError(403, 'User does not belong to this tenant');
    }

    const userTenantId = toPositiveNumber(userTenant.id);
    if (!userTenantId) {
      throw new HttpError(403, 'User does not belong to this tenant');
    }

    const userTenantRoles = await findUserTenantRoles(userTenantId);

    const roles = (userTenantRoles || [])
      .map((item: any) => {
        const role = item?.role as Record<string, unknown> | null;
        if (!role) return null;

        const roleId = toPositiveNumber(role.id);
        if (!roleId) return null;

        const name = normalizeText(role.name);

        return {
          id: roleId,
          name: name || pickRoleLabel(role),
          code: pickRoleCode(role),
          label: pickRoleLabel(role),
        };
      })
      .filter((item): item is { id: number; name: string; code: string | null; label: string } => Boolean(item));

    const uniqueRoles = Array.from(new Map(roles.map((role) => [role.id, role])).values());

    if (uniqueRoles.length === 0) {
      return {
        tenant: {
          id: tenantId,
          name: normalizeText(tenant.name),
          code: normalizeText(tenant.code),
        },
        userTenant: {
          id: userTenantId,
          label: normalizeText(userTenant.label),
        },
        roles: [],
        featureGroups: [],
        features: [],
      };
    }

    const roleIds = uniqueRoles.map((role) => role.id);
    const roleFeatures = await findRoleFeatures(roleIds);
    const roleFeatureIds = uniqueNumbers((roleFeatures || []).map((item: any) => toPositiveNumber(item?.feature)));

    if (roleFeatureIds.length === 0) {
      return {
        tenant: {
          id: tenantId,
          name: normalizeText(tenant.name),
          code: normalizeText(tenant.code),
        },
        userTenant: {
          id: userTenantId,
          label: normalizeText(userTenant.label),
        },
        roles: uniqueRoles,
        featureGroups: [],
        features: [],
      };
    }

    const enabledFeatureIds = await findEnabledTenantFeatureIds(tenantId, roleFeatureIds);
    if (enabledFeatureIds.length === 0) {
      return {
        tenant: {
          id: tenantId,
          name: normalizeText(tenant.name),
          code: normalizeText(tenant.code),
        },
        userTenant: {
          id: userTenantId,
          label: normalizeText(userTenant.label),
        },
        roles: uniqueRoles,
        featureGroups: [],
        features: [],
      };
    }

    const features = await findFeaturesByIds(enabledFeatureIds);
    const orderedFeatures = sortByOrderThenName(features as any[]);

    return {
      tenant: {
        id: tenantId,
        name: normalizeText(tenant.name),
        code: normalizeText(tenant.code),
      },
      userTenant: {
        id: userTenantId,
        label: normalizeText(userTenant.label),
      },
      roles: uniqueRoles,
      featureGroups: buildFeatureGroups(orderedFeatures),
      features: buildFlatFeatures(orderedFeatures),
    };
  },
};
