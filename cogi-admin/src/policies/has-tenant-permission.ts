/**
 * Policy: has-tenant-permission
 *
 * Checks if user has required permission in TENANT scope only.
 * Does NOT fallback to global role.
 * Requires tenantId from context (x-tenant-code header).
 *
 * Config:
 * {
 *   key: 'user.invite'  // Feature permission key
 * }
 */

type PolicyConfig = {
  key?: string;
};

const USER_TENANT_UID = 'api::user-tenant.user-tenant';
const USER_TENANT_ROLE_UID = 'api::user-tenant-role.user-tenant-role';
const ROLE_FEATURE_UID = 'api::role-feature.role-feature';

function toPositiveInt(value: unknown): number | null {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
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
  if (!userTenantId) {
    return new Set();
  }

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

  if (roleIds.length === 0) {
    return new Set();
  }

  const mappings = await strapi.db.query(ROLE_FEATURE_UID).findMany({
    where: {
      role: {
        id: {
          $in: roleIds,
        },
      },
    },
    populate: ['feature'],
  });

  const permissionKeys = new Set(
    (mappings || [])
      .map((item: any) => item?.feature?.key)
      .filter((key: string | null | undefined): key is string => typeof key === 'string' && key.length > 0)
  );
  return permissionKeys;
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
      select: ['id', 'email', 'confirmed', 'blocked'],
    });
  } catch {
    return null;
  }
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

  // Support both auth:false (manual JWT decode) and auth:{scope:[]} (Strapi populates state.user)
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
  if (!userId) {
    return unauthorized('Unauthorized');
  }

  // TENANT SCOPE MANDATORY - No fallback to global role
  const tenantId = toPositiveInt(state?.tenantId ?? state?.tenant?.id);
  if (!tenantId) {
    return forbidden('Tenant context is required (x-tenant-code header)');
  }

  const permissionKeys = await getTenantScopedPermissionKeys(userId, tenantId);

  if (!permissionKeys.has(requiredKey)) {
    return forbidden(`Forbidden: missing permission '${requiredKey}' in tenant scope`);
  }
  return true;
};
