type PolicyConfig = {
  key?: string;
};

const USER_UID = 'plugin::users-permissions.user';
const USER_TENANT_UID = 'api::user-tenant.user-tenant';
const USER_TENANT_ROLE_UID = 'api::user-tenant-role.user-tenant-role';
const ROLE_FEATURE_UID = 'api::role-feature.role-feature';

function toPositiveInt(value: unknown): number | null {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

async function getPermissionKeysByRoleIds(roleIds: number[]): Promise<Set<string>> {
  const uniqueRoleIds = Array.from(new Set(roleIds.filter((id) => Number.isInteger(id) && id > 0)));
  if (uniqueRoleIds.length === 0) return new Set();

  const mappings = await strapi.db.query(ROLE_FEATURE_UID).findMany({
    where: {
      role: {
        id: {
          $in: uniqueRoleIds,
        },
      },
    },
    populate: ['feature'],
  });

  return new Set(
    (mappings || [])
      .map((item: any) => item?.feature?.key)
      .filter((key: string | null | undefined): key is string => typeof key === 'string' && key.length > 0)
  );
}

async function getTenantScopedPermissionKeys(userId: number, tenantId: number): Promise<Set<string>> {
  const userTenant = await strapi.db.query(USER_TENANT_UID).findOne({
    where: {
      user: userId,
      tenant: tenantId,
      userTenantStatus: 'active',
    },
    select: ['id'],
  });

  const userTenantId = toPositiveInt(userTenant?.id);
  if (!userTenantId) return new Set();

  const userTenantRoles = await strapi.db.query(USER_TENANT_ROLE_UID).findMany({
    where: {
      userTenant: userTenantId,
      userTenantRoleStatus: 'active',
    },
    populate: {
      role: true,
    },
  });

  const roleIds = (userTenantRoles || [])
    .map((item: any) => toPositiveInt(item?.role?.id ?? item?.role))
    .filter((value: number | null): value is number => Boolean(value));

  return getPermissionKeysByRoleIds(roleIds);
}

export default async (policyContext, config: PolicyConfig = {}) => {
  const ctx = policyContext?.ctx ?? policyContext;
  const state = policyContext?.state ?? ctx?.state;

  const unauthorized = (message = 'Unauthorized') => {
    if (typeof ctx?.unauthorized === 'function') {
      return ctx.unauthorized(message);
    }
    if (typeof ctx?.throw === 'function') {
      return ctx.throw(401, message);
    }
    const error = new Error(message) as Error & { status?: number };
    error.status = 401;
    throw error;
  };

  const forbidden = (message = 'Forbidden') => {
    if (typeof ctx?.forbidden === 'function') {
      return ctx.forbidden(message);
    }
    if (typeof ctx?.throw === 'function') {
      return ctx.throw(403, message);
    }
    const error = new Error(message) as Error & { status?: number };
    error.status = 403;
    throw error;
  };

  const requiredKey = config?.key;

  if (!requiredKey) {
    return forbidden('Permission key is required');
  }

  const authUser = state?.user;
  if (!authUser?.id) {
    return unauthorized('Unauthorized');
  }

  const userId = toPositiveInt(authUser.id);
  if (!userId) {
    return unauthorized('Unauthorized');
  }

  const tenantId = toPositiveInt(state?.tenantId ?? state?.tenant?.id);
  let permissionKeys: Set<string> = new Set();

  if (tenantId) {
    permissionKeys = await getTenantScopedPermissionKeys(userId, tenantId);
  } else {
    // Conservative fallback for non-tenant endpoints that still rely on global role.
    const user = await strapi.db.query(USER_UID).findOne({
      where: { id: userId },
      populate: ['role'],
    });

    const roleId = toPositiveInt(user?.role?.id);
    permissionKeys = await getPermissionKeysByRoleIds(roleId ? [roleId] : []);
  }

  if (!permissionKeys.has(requiredKey)) {
    return forbidden(`Forbidden: missing permission '${requiredKey}'`);
  }

  return true;
};
