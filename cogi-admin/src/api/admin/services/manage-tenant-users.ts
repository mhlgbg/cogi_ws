const USER_TENANT_UID = 'api::user-tenant.user-tenant';
const USER_TENANT_ROLE_UID = 'api::user-tenant-role.user-tenant-role';
const TENANT_ROLE_UID = 'api::tenant-role.tenant-role';

function toPositiveInt(value: unknown, fallback = 0): number {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) return fallback;
  return parsed;
}

function uniquePositiveInts(values: unknown[]): number[] {
  return Array.from(new Set(values.map((value) => toPositiveInt(value)).filter((value) => value > 0)));
}

export async function getTenantEnabledRoles(tenantId: number) {
  const tenantRoles = await strapi.db.query(TENANT_ROLE_UID).findMany({
    where: {
      tenant: tenantId,
      isActive: true,
    },
    populate: {
      role: {
        select: ['id', 'name', 'description', 'type'],
      },
    },
  });

  return (tenantRoles || [])
    .map((row: any) => {
      const role = row?.role;
      const roleId = toPositiveInt(role?.id);
      if (!roleId) return null;

      return {
        id: roleId,
        name: String(role?.name || role?.type || `Role #${roleId}`),
        description: role?.description || null,
        type: role?.type || null,
      };
    })
    .filter(Boolean) as Array<{ id: number; name: string; description: string | null; type: string | null }>;
}

export async function listTenantUsers(options: {
  tenantId: number;
  page?: number;
  pageSize?: number;
  search?: string;
}) {
  const tenantId = toPositiveInt(options.tenantId);
  if (!tenantId) {
    throw new Error('Invalid tenantId');
  }

  const page = Math.max(1, toPositiveInt(options.page || 1, 1));
  const pageSize = Math.min(100, Math.max(1, toPositiveInt(options.pageSize || 10, 10)));
  const search = String(options.search || '').trim();

  const where: Record<string, unknown> = {
    tenant: tenantId,
  };

  if (search) {
    where.user = {
      $or: [
        { email: { $containsi: search } },
        { username: { $containsi: search } },
        { fullName: { $containsi: search } },
      ],
    };
  }

  const total = await strapi.db.query(USER_TENANT_UID).count({ where });

  const rows = await strapi.db.query(USER_TENANT_UID).findMany({
    where,
    offset: (page - 1) * pageSize,
    limit: pageSize,
    orderBy: [{ id: 'desc' }],
    select: ['id', 'label', 'userTenantStatus', 'joinedAt'],
    populate: {
      user: {
        select: ['id', 'username', 'email', 'fullName', 'confirmed', 'blocked'],
      },
      userTenantRoles: {
        populate: {
          role: {
            select: ['id', 'name', 'description', 'type'],
          },
        },
      },
    },
  });

  const data = (rows || []).map((row: any) => {
    const userTenantRoles = Array.isArray(row?.userTenantRoles) ? row.userTenantRoles : [];

    const roles = userTenantRoles
      .map((item: any) => {
        const role = item?.role;
        const roleId = toPositiveInt(role?.id);
        if (!roleId) return null;

        return {
          id: roleId,
          name: String(role?.name || role?.type || `Role #${roleId}`),
          description: role?.description || null,
          type: role?.type || null,
          userTenantRoleStatus: item?.userTenantRoleStatus || 'inactive',
          isPrimary: Boolean(item?.isPrimary),
        };
      })
      .filter(Boolean);

    const activeRoleIds = roles
      .filter((role: any) => role.userTenantRoleStatus === 'active')
      .map((role: any) => role.id);

    return {
      userTenantId: toPositiveInt(row?.id),
      label: row?.label || null,
      userTenantStatus: row?.userTenantStatus || null,
      joinedAt: row?.joinedAt || null,
      user: {
        id: toPositiveInt(row?.user?.id),
        username: row?.user?.username || '',
        email: row?.user?.email || '',
        fullName: row?.user?.fullName || null,
        confirmed: Boolean(row?.user?.confirmed),
        blocked: Boolean(row?.user?.blocked),
      },
      roles,
      activeRoleIds,
    };
  });

  return {
    data,
    meta: {
      page,
      pageSize,
      total,
      pageCount: Math.max(1, Math.ceil(total / pageSize)),
    },
  };
}

export async function updateTenantUserRoles(options: {
  tenantId: number;
  userTenantId: number;
  roleIds: number[];
}) {
  const tenantId = toPositiveInt(options.tenantId);
  const userTenantId = toPositiveInt(options.userTenantId);
  const nextRoleIds = uniquePositiveInts(options.roleIds || []);

  if (!tenantId || !userTenantId) {
    return { ok: false, error: 'Invalid tenant or userTenant id' };
  }

  if (nextRoleIds.length === 0) {
    return { ok: false, error: 'At least one role is required' };
  }

  const userTenant = await strapi.db.query(USER_TENANT_UID).findOne({
    where: {
      id: userTenantId,
      tenant: tenantId,
    },
    select: ['id'],
  });

  if (!userTenant?.id) {
    return { ok: false, error: 'User tenant not found in current tenant' };
  }

  const enabledRoles = await getTenantEnabledRoles(tenantId);
  const enabledRoleIds = new Set(enabledRoles.map((role) => role.id));

  const invalidRoleIds = nextRoleIds.filter((roleId) => !enabledRoleIds.has(roleId));
  if (invalidRoleIds.length > 0) {
    return { ok: false, error: 'One or more roles are not enabled for this tenant' };
  }

  const existing = await strapi.db.query(USER_TENANT_ROLE_UID).findMany({
    where: {
      userTenant: userTenantId,
    },
    populate: {
      role: {
        select: ['id'],
      },
    },
  });

  const existingByRoleId = new Map<number, any>();
  for (const item of existing || []) {
    const roleId = toPositiveInt(item?.role?.id ?? item?.role);
    if (!roleId || existingByRoleId.has(roleId)) continue;
    existingByRoleId.set(roleId, item);
  }

  const now = new Date();
  const keepRoleIds = new Set(nextRoleIds);

  for (const item of existing || []) {
    const roleId = toPositiveInt(item?.role?.id ?? item?.role);
    if (!roleId) continue;

    const shouldKeep = keepRoleIds.has(roleId);
    if (!shouldKeep && item.userTenantRoleStatus === 'active') {
      await strapi.db.query(USER_TENANT_ROLE_UID).update({
        where: { id: item.id },
        data: {
          userTenantRoleStatus: 'inactive',
          isPrimary: false,
          revokedAt: now,
        },
      });
    }
  }

  for (const roleId of nextRoleIds) {
    const existingItem = existingByRoleId.get(roleId);

    if (existingItem) {
      await strapi.db.query(USER_TENANT_ROLE_UID).update({
        where: { id: existingItem.id },
        data: {
          userTenantRoleStatus: 'active',
          revokedAt: null,
          assignedAt: existingItem.assignedAt || now,
        },
      });
    } else {
      await strapi.db.query(USER_TENANT_ROLE_UID).create({
        data: {
          userTenant: userTenantId,
          role: roleId,
          userTenantRoleStatus: 'active',
          assignedAt: now,
          isPrimary: false,
        },
      });
    }
  }

  const primaryRoleId = nextRoleIds[0];
  const refreshed = await strapi.db.query(USER_TENANT_ROLE_UID).findMany({
    where: {
      userTenant: userTenantId,
      userTenantRoleStatus: 'active',
    },
    populate: {
      role: {
        select: ['id'],
      },
    },
  });

  for (const item of refreshed || []) {
    const roleId = toPositiveInt(item?.role?.id ?? item?.role);
    await strapi.db.query(USER_TENANT_ROLE_UID).update({
      where: { id: item.id },
      data: {
        isPrimary: roleId === primaryRoleId,
      },
    });
  }

  return { ok: true };
}
