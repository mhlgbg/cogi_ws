/**
 * Multi-tenant user invite service
 * Handles validation, user creation, and tenant assignment
 */

const USER_UID = 'plugin::users-permissions.user';
const TENANT_UID = 'api::tenant.tenant';
const TENANT_ROLE_UID = 'api::tenant-role.tenant-role';
const USER_TENANT_UID = 'api::user-tenant.user-tenant';
const USER_TENANT_ROLE_UID = 'api::user-tenant-role.user-tenant-role';
const DEPARTMENT_UID = 'api::department.department';
const DEPARTMENT_MEMBERSHIP_UID = 'api::department-membership.department-membership';

interface ValidationError {
  message: string;
  code: string;
}

/**
 * Validate that a role is enabled for a specific tenant
 */
export async function validateTenantRole(
  tenantId: number,
  roleId: number
): Promise<{ valid: boolean; error?: string }> {
  if (!Number.isInteger(tenantId) || tenantId <= 0) {
    return { valid: false, error: 'Invalid tenant ID' };
  }

  if (!Number.isInteger(roleId) || roleId <= 0) {
    return { valid: false, error: 'Invalid role ID' };
  }

  const tenantRole = await strapi.db.query(TENANT_ROLE_UID).findOne({
    where: {
      tenant: tenantId,
      role: roleId,
      isActive: true,
    },
  });

  if (!tenantRole) {
    return { valid: false, error: 'Role is not enabled for this tenant' };
  }

  return { valid: true };
}

/**
 * Validate that a department belongs to a specific tenant
 */
export async function validateTenantDepartment(
  tenantId: number,
  departmentId: number
): Promise<{ valid: boolean; error?: string }> {
  if (!Number.isInteger(tenantId) || tenantId <= 0) {
    return { valid: false, error: 'Invalid tenant ID' };
  }

  if (!Number.isInteger(departmentId) || departmentId <= 0) {
    return { valid: false, error: 'Invalid department ID' };
  }

  const department = await strapi.db.query(DEPARTMENT_UID).findOne({
    where: {
      id: departmentId,
      tenant: tenantId,
    },
  });

  if (!department) {
    return { valid: false, error: 'Department does not belong to this tenant' };
  }

  return { valid: true };
}

/**
 * Check if user already has a tenant membership
 */
export async function checkUserTenantExists(
  userId: number,
  tenantId: number
): Promise<{ exists: boolean; userTenant?: { id: number } }> {
  const userTenant = await strapi.db.query(USER_TENANT_UID).findOne({
    where: {
      user: userId,
      tenant: tenantId,
    },
  });

  if (!userTenant) {
    return { exists: false };
  }

  return { exists: true, userTenant: { id: userTenant.id } };
}

/**
 * Create a new userTenant record
 */
export async function createUserTenant(
  userId: number,
  tenantId: number,
  status: 'active' | 'pending' = 'active'
): Promise<{ id: number }> {
  const userTenant = await strapi.db.query(USER_TENANT_UID).create({
    data: {
      user: userId,
      tenant: tenantId,
      userTenantStatus: status,
      joinedAt: new Date(),
    },
  });

  return { id: userTenant.id };
}

/**
 * Create a new userTenantRole record
 */
export async function createUserTenantRole(
  userTenantId: number,
  roleId: number
): Promise<{ id: number }> {
  const userTenantRole = await strapi.db.query(USER_TENANT_ROLE_UID).create({
    data: {
      userTenant: userTenantId,
      role: roleId,
      userTenantRoleStatus: 'active',
      assignedAt: new Date(),
      isPrimary: true, // First role is primary
    },
  });

  return { id: userTenantRole.id };
}

/**
 * Create or ensure department membership
 */
export async function ensureDepartmentMembership(
  userId: number,
  departmentId: number
): Promise<{ id?: number; warning?: string }> {
  try {
    const membershipUid = DEPARTMENT_MEMBERSHIP_UID;
    const membershipModel = strapi.getModel(membershipUid);

    if (!membershipModel) {
      return { warning: 'DepartmentMembership model not found' };
    }

    const membershipData: Record<string, unknown> = {
      user: userId,
      department: departmentId,
    };

    const membershipAttributes = membershipModel.attributes as Record<string, unknown>;

    if ('isActive' in membershipAttributes) {
      membershipData.isActive = true;
    } else if ('status_record' in membershipAttributes) {
      membershipData.status_record = 'ACTIVE';
    }

    const membership = await strapi.db.query(membershipUid).create({
      data: membershipData,
    });

    return { id: membership.id };
  } catch (error) {
    console.error('[inviteUser] Failed to create DepartmentMembership:', error);
    return { warning: 'Could not create department membership' };
  }
}

/**
 * Invite a new user (does not exist in system)
 */
export async function inviteNewUser(options: {
  email: string;
  fullName?: string | null;
  tenantId: number;
  roleId: number;
  departmentId?: number | null;
  password: string;
  activationToken: string;
  expiresAt: Date;
}): Promise<{
  userId: number;
  email: string;
  userTenantId: number;
  expiresAt: string;
  status: 'created';
}> {
  const { email, fullName, tenantId, roleId, departmentId, password, activationToken, expiresAt } =
    options;

  // Create user
  const usersPermissionsUserService = strapi.plugin('users-permissions').service('user');
  const createdUser = await usersPermissionsUserService.add({
    email,
    username: email,
    provider: 'local',
    fullName: fullName || undefined,
    confirmed: false,
    blocked: false,
    password,
  });

  // Create userTenant
  const userTenantData = await createUserTenant(createdUser.id, tenantId, 'pending');

  // Create userTenantRole
  await createUserTenantRole(userTenantData.id, roleId);

  // Create activation token
  await strapi.db.query('api::activation-token.activation-token').create({
    data: {
      token: activationToken,
      expiresAt,
      usedAt: null,
      user: createdUser.id,
    },
  });

  // Create department membership if provided
  if (departmentId) {
    await ensureDepartmentMembership(createdUser.id, departmentId);
  }

  return {
    userId: createdUser.id,
    email: createdUser.email,
    userTenantId: userTenantData.id,
    expiresAt: expiresAt.toISOString(),
    status: 'created',
  };
}

/**
 * Invite an existing user to a new tenant
 */
export async function inviteExistingUserToTenant(options: {
  userId: number;
  email: string;
  tenantId: number;
  roleId: number;
  departmentId?: number | null;
}): Promise<{
  userId: number;
  email: string;
  userTenantId: number;
  status: 'added_to_tenant';
}> {
  const { userId, email, tenantId, roleId, departmentId } = options;

  // Create userTenant (status='active' for existing users)
  const userTenantData = await createUserTenant(userId, tenantId, 'active');

  // Create userTenantRole
  await createUserTenantRole(userTenantData.id, roleId);

  // Create department membership if provided
  if (departmentId) {
    await ensureDepartmentMembership(userId, departmentId);
  }

  return {
    userId,
    email,
    userTenantId: userTenantData.id,
    status: 'added_to_tenant',
  };
}
