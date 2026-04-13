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
const NOTIFICATION_SERVICE_UID = 'api::notification.notification';

export { buildActivationLink, buildResetPasswordLink, buildVerifyEmailLink, getBaseUrl } from '../../../utils/tenant-base-url';

export type InvitePurpose = 'tenant' | 'admission';

interface ValidationError {
  message: string;
  code: string;
}

function normalizeText(value: unknown): string {
  if (value === null || value === undefined) return '';
  return String(value).trim();
}

function escapeHtml(value: unknown): string {
  return normalizeText(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function resolveInviteTemplateCode(invitePurpose?: InvitePurpose, templateCode?: string | null): string {
  const explicitCode = normalizeText(templateCode);
  if (explicitCode) return explicitCode;
  return invitePurpose === 'admission' ? 'admission_invite' : 'tenant_invite';
}

function isTemplateNotFoundError(error: unknown): boolean {
  const message =
    (error as { message?: string; details?: { code?: string } })?.message || '';
  const code = (error as { details?: { code?: string } })?.details?.code || '';

  return code === 'NOTIFICATION_TEMPLATE_NOT_FOUND' || message.includes('Active notification template not found');
}

async function getTenantSummary(tenantId: number): Promise<{ name: string; code: string }> {
  const tenant = await strapi.db.query(TENANT_UID).findOne({
    where: { id: tenantId },
    select: ['id', 'name', 'code'],
  });

  return {
    name: normalizeText(tenant?.name) || 'the system',
    code: normalizeText(tenant?.code),
  };
}

export async function getRoleDisplayName(roleId: number): Promise<string> {
  const role = await strapi.db.query('plugin::users-permissions.role').findOne({
    where: { id: roleId },
    select: ['id', 'name', 'type'],
  });

  return normalizeText(role?.name) || normalizeText(role?.type) || `Role #${roleId}`;
}

function buildTenantInviteFallbackEmail(data: {
  fullName: string;
  tenantName: string;
  roleName: string;
  link: string;
}) {
  const subject = `Bạn được mời tham gia ${data.tenantName}`;
  const roleLine = data.roleName ? ` với vai trò ${data.roleName}` : '';

  return {
    subject,
    text:
      `Xin chào ${data.fullName},\n\n` +
      `Bạn được mời tham gia ${data.tenantName}${roleLine}. ` +
      `Vui lòng kích hoạt tài khoản qua link sau:\n${data.link}\n\n` +
      'Lưu ý: link này sẽ hết hạn sau 48 giờ.',
    html:
      `<p>Xin chào <strong>${escapeHtml(data.fullName)}</strong>,</p>` +
      `<p>Bạn được mời tham gia <strong>${escapeHtml(data.tenantName)}</strong>${roleLine ? ` với vai trò <strong>${escapeHtml(data.roleName)}</strong>` : ''}.</p>` +
      `<p><a href="${escapeHtml(data.link)}" style="display:inline-block;padding:10px 16px;background:#2563eb;color:#fff;text-decoration:none;border-radius:6px;">Kích hoạt tài khoản</a></p>` +
      '<p>Nếu nút không hoạt động, dùng link sau:</p>' +
      `<p><a href="${escapeHtml(data.link)}">${escapeHtml(data.link)}</a></p>` +
      '<p>Link kích hoạt sẽ hết hạn sau <strong>48 giờ</strong>.</p>',
  };
}

function buildAdmissionInviteFallbackEmail(data: {
  fullName: string;
  tenantName: string;
  roleName: string;
  link: string;
}) {
  const subject = `Thư mời tham gia tuyển sinh tại ${data.tenantName}`;
  const roleLine = data.roleName ? ` với vai trò ${data.roleName}` : '';

  return {
    subject,
    text:
      `Xin chào ${data.fullName},\n\n` +
      `Nhà trường ${data.tenantName} mời bạn tham gia quy trình tuyển sinh${roleLine}. ` +
      `Vui lòng kích hoạt tài khoản để tiếp tục hồ sơ tại link sau:\n${data.link}\n\n` +
      'Sau khi kích hoạt, hệ thống sẽ chuyển bạn sang bước đặt mật khẩu như luồng hiện tại.',
    html:
      `<p>Xin chào <strong>${escapeHtml(data.fullName)}</strong>,</p>` +
      `<p>Nhà trường <strong>${escapeHtml(data.tenantName)}</strong> mời bạn tham gia quy trình tuyển sinh${roleLine ? ` với vai trò <strong>${escapeHtml(data.roleName)}</strong>` : ''}.</p>` +
      `<p><a href="${escapeHtml(data.link)}" style="display:inline-block;padding:10px 16px;background:#0f766e;color:#fff;text-decoration:none;border-radius:6px;">Kích hoạt tài khoản</a></p>` +
      '<p>Nếu nút không hoạt động, dùng link sau:</p>' +
      `<p><a href="${escapeHtml(data.link)}">${escapeHtml(data.link)}</a></p>` +
      '<p>Sau khi kích hoạt, hệ thống sẽ chuyển bạn sang bước đặt mật khẩu.</p>',
  };
}

export async function sendInviteNotification(options: {
  email: string;
  fullName?: string | null;
  tenantId: number;
  tenantName?: string | null;
  tenantCode?: string | null;
  roleName?: string | null;
  link: string;
  invitePurpose?: InvitePurpose;
  templateCode?: string | null;
}): Promise<{ emailSent: boolean; emailError?: string; usedFallback: boolean; templateCode: string }> {
  const recipientEmail = normalizeText(options.email).toLowerCase();
  const templateCode = resolveInviteTemplateCode(options.invitePurpose, options.templateCode);
  const tenantSummary = await getTenantSummary(options.tenantId);
  const tenant = {
    ...tenantSummary,
    name: normalizeText(options.tenantName) || tenantSummary.name,
    code: normalizeText(options.tenantCode) || tenantSummary.code,
  };
  const recipientName = normalizeText(options.fullName) || recipientEmail;
  const roleName = normalizeText(options.roleName) || (options.invitePurpose === 'admission' ? 'Aplicant' : '');
  const payload = {
    email: recipientEmail,
    fullName: recipientName,
    tenantName: tenant.name,
    tenantCode: tenant.code,
    roleName,
    link: options.link,
  };

  try {
    await (strapi.service(NOTIFICATION_SERVICE_UID) as any).sendNotification(templateCode, options.tenantId, payload);

    return {
      emailSent: true,
      usedFallback: false,
      templateCode,
    };
  } catch (error) {
    if (!isTemplateNotFoundError(error)) {
      const rawMessage =
        (error as { message?: string; response?: { body?: { message?: string } } })?.response?.body?.message ||
        (error as { message?: string })?.message;

      return {
        emailSent: false,
        emailError: rawMessage ? String(rawMessage).slice(0, 160) : 'Email sending failed',
        usedFallback: false,
        templateCode,
      };
    }

    const fallback = options.invitePurpose === 'admission'
      ? buildAdmissionInviteFallbackEmail({
          fullName: recipientName,
          tenantName: tenant.name,
          roleName,
          link: options.link,
        })
      : buildTenantInviteFallbackEmail({
          fullName: recipientName,
          tenantName: tenant.name,
          roleName,
          link: options.link,
        });

    try {
      await strapi.plugin('email').service('email').send({
        to: recipientEmail,
        subject: fallback.subject,
        text: fallback.text,
        html: fallback.html,
      });

      return {
        emailSent: true,
        usedFallback: true,
        templateCode,
      };
    } catch (fallbackError) {
      const rawMessage =
        (fallbackError as { message?: string; response?: { body?: { message?: string } } })?.response?.body?.message ||
        (fallbackError as { message?: string })?.message;

      return {
        emailSent: false,
        emailError: rawMessage ? String(rawMessage).slice(0, 160) : 'Email sending failed',
        usedFallback: true,
        templateCode,
      };
    }
  }
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
  const existingUserTenant = await strapi.db.query(USER_TENANT_UID).findOne({
    where: {
      user: userId,
      tenant: tenantId,
    },
    select: ['id'],
  });

  if (existingUserTenant?.id) {
    return { id: existingUserTenant.id };
  }

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
  phone?: string | null;
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
  const { email, fullName, phone, tenantId, roleId, departmentId, password, activationToken, expiresAt } =
    options;

  // Create user
  const usersPermissionsUserService = strapi.plugin('users-permissions').service('user');
  const createdUser = await usersPermissionsUserService.add({
    email,
    username: email,
    provider: 'local',
    fullName: fullName || undefined,
    phone: normalizeText(phone) || undefined,
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

export async function updateUserPhoneIfEmpty(userId: number, phone?: string | null): Promise<void> {
  const normalizedPhone = normalizeText(phone);
  if (!normalizedPhone) return;

  const user = await strapi.db.query(USER_UID).findOne({
    where: { id: userId },
    select: ['id', 'phone'],
  });

  if (!user?.id || normalizeText(user.phone)) {
    return;
  }

  await strapi.entityService.update(USER_UID, userId, {
    data: {
      phone: normalizedPhone,
    },
  });
}
