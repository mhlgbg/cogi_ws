const USER_UID = 'plugin::users-permissions.user';
const TENANT_UID = 'api::tenant.tenant';
const USER_TENANT_UID = 'api::user-tenant.user-tenant';
const USER_TENANT_ROLE_UID = 'api::user-tenant-role.user-tenant-role';

async function resolveUserFromJwt(ctx: any) {
  try {
    const authHeader = ctx.request?.headers?.authorization || ctx.request?.header?.authorization || '';
    const token = typeof authHeader === 'string' && authHeader.startsWith('Bearer ')
      ? authHeader.slice(7).trim()
      : '';

    if (!token) return null;

    const jwtService = strapi.plugin('users-permissions')?.service('jwt');
    if (!jwtService) return null;

    const decoded = await jwtService.verify(token);
    const userId = getRelationId(decoded?.id);
    if (!userId) return null;

    return strapi.db.query(USER_UID).findOne({
      where: { id: userId },
      select: ['id', 'username', 'email', 'blocked'],
    });
  } catch {
    return null;
  }
}

function normalizeText(value: unknown): string {
  if (value === null || value === undefined) return '';
  return String(value).trim();
}

function getRelationId(value: unknown): number | null {
  if (value === null || value === undefined) return null;

  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null;
  }

  if (typeof value === 'string') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  if (typeof value !== 'object') return null;

  return getRelationId((value as { id?: unknown }).id);
}

function getModelAttributeNames(uid: string): Set<string> {
  const model = (strapi as any).getModel(uid);
  const attributes = model?.attributes || {};
  return new Set(Object.keys(attributes));
}

function getActiveWhere(uid: string): Record<string, unknown> {
  const attrs = getModelAttributeNames(uid);

  if (attrs.has('userTenantStatus')) return { userTenantStatus: 'active' };
  if (attrs.has('userTenantRoleStatus')) return { userTenantRoleStatus: 'active' };
  if (attrs.has('tenantStatus')) return { tenantStatus: 'active' };
  if (attrs.has('status')) return { status: 'active' };
  if (attrs.has('isActive')) return { isActive: true };
  if (attrs.has('active')) return { active: true };

  return {};
}

function pickRoleLabel(role: Record<string, unknown> | null): string {
  if (!role) return 'Unknown Role';

  const candidates = [role.label, role.name, role.code, role.type, role.id, role.documentId];
  for (const value of candidates) {
    const text = normalizeText(value);
    if (text) return text;
  }

  return 'Unknown Role';
}

function extractMediaUrl(media: any): string {
  if (!media || typeof media !== 'object') return '';

  const direct = normalizeText(media?.url);
  if (direct) return direct;

  const attrs = normalizeText(media?.attributes?.url);
  if (attrs) return attrs;

  const dataDirect = normalizeText(media?.data?.url);
  if (dataDirect) return dataDirect;

  const dataAttrs = normalizeText(media?.data?.attributes?.url);
  if (dataAttrs) return dataAttrs;

  if (Array.isArray(media) && media.length > 0) {
    const first = normalizeText(media[0]?.url || media[0]?.attributes?.url);
    if (first) return first;
  }

  return '';
}

async function loadRolesByUserTenantId(userTenantId: number) {
  const where = {
    userTenant: userTenantId,
    ...getActiveWhere(USER_TENANT_ROLE_UID),
  };

  return strapi.db.query(USER_TENANT_ROLE_UID).findMany({
    where,
    populate: {
      role: {
        select: ['id', 'name', 'description', 'type'],
      },
    },
  });
}

export default {
  async index(ctx: any) {
    try {
      let authUser = ctx.state?.user;
      if (!authUser?.id) {
        authUser = await resolveUserFromJwt(ctx);
      }

      if (!authUser?.id) {
        return ctx.unauthorized('Unauthorized');
      }

      if (authUser?.blocked) {
        return ctx.unauthorized('Account is blocked');
      }

      const user = await strapi.db.query(USER_UID).findOne({
        where: { id: authUser.id },
        select: ['id', 'username', 'email'],
      });

      if (!user) {
        return ctx.unauthorized('Unauthorized');
      }

      const userTenants = await strapi.db.query(USER_TENANT_UID).findMany({
        where: {
          user: authUser.id,
          ...getActiveWhere(USER_TENANT_UID),
        },
        select: ['id', 'label'],
        populate: {
          tenant: {
            select: ['id', 'name', 'code', 'shortName', 'tenantStatus', 'defaultFeatureCode', 'defaultPublicRoute', 'defaultProtectedRoute'],
            populate: {
              logo: true,
            },
          },
          userTenantRoles: {
            where: getActiveWhere(USER_TENANT_ROLE_UID),
            populate: {
              role: {
                select: ['id', 'name', 'description', 'type'],
              },
            },
          },
        },
      });

      const tenants = await Promise.all(
        (userTenants || []).map(async (entry: any) => {
          const tenant = entry?.tenant;
          if (!tenant) return null;

          const activeTenantWhere = getActiveWhere(TENANT_UID);
          const statusField = Object.keys(activeTenantWhere)[0];
          if (statusField) {
            const expected = activeTenantWhere[statusField];
            if (tenant[statusField] !== expected) return null;
          }

          let userTenantRoles = Array.isArray(entry?.userTenantRoles) ? entry.userTenantRoles : [];

          const userTenantId = getRelationId(entry?.id);
          if (userTenantRoles.length === 0 && userTenantId) {
            userTenantRoles = await loadRolesByUserTenantId(userTenantId);
          }

          const roles = userTenantRoles
            .map((item: any) => {
              const role = item?.role as Record<string, unknown> | null;
              if (!role) return null;

              const roleId = getRelationId(role.id);
              if (!roleId) return null;

              return {
                id: roleId,
                name: normalizeText(role.name) || pickRoleLabel(role),
                code: normalizeText((role as any).code || role.type) || null,
                label: pickRoleLabel(role),
              };
            })
            .filter(Boolean);

          const uniqueRoles = Array.from(new Map(roles.map((role: any) => [role.id, role])).values());

          const tenantId = getRelationId(tenant.id);
          if (!tenantId) return null;

          const tenantName = normalizeText(tenant.name);
          const tenantCode = normalizeText(tenant.code);
          const tenantShortName = normalizeText(tenant.shortName);
          const tenantLogoUrl = extractMediaUrl(tenant.logo);

          return {
            userTenantId,
            label: normalizeText(entry?.label) || [user.username, tenantName || tenantCode].filter(Boolean).join(' - '),
            tenant: {
              id: tenantId,
              name: tenantName || tenantCode,
              code: tenantCode || null,
              shortName: tenantShortName || null,
              defaultFeatureCode: normalizeText((tenant as any).defaultFeatureCode) || null,
              defaultPublicRoute: normalizeText((tenant as any).defaultPublicRoute) || null,
              defaultProtectedRoute: normalizeText((tenant as any).defaultProtectedRoute) || null,
              logo: tenant.logo || null,
              logoUrl: tenantLogoUrl || null,
              label: tenantName || tenantCode || `Tenant #${tenantId}`,
            },
            roles: uniqueRoles,
          };
        }),
      );

      ctx.body = {
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
        },
        tenants: tenants.filter(Boolean),
      };


    } catch (error) {
      strapi.log.error('[api.my-tenant-context] failed', error);
      return ctx.internalServerError('Failed to load tenant context');
    }
  },
};
