import crypto from 'node:crypto';
import {
  validateTenantRole,
  validateTenantDepartment,
  checkUserTenantExists,
  inviteNewUser,
  inviteExistingUserToTenant,
  ensureDepartmentMembership,
} from '../services/invite-user';
import {
  getTenantEnabledRoles,
  listTenantUsers,
  updateTenantUserRoles,
} from '../services/manage-tenant-users';

function isValidationError(error: unknown) {
  if (!error || typeof error !== 'object') return false;
  const errorName = (error as { name?: string }).name || '';
  return errorName.includes('ValidationError') || errorName.includes('YupError');
}

function generateStrongPassword(length = 18) {
  const lower = 'abcdefghijklmnopqrstuvwxyz';
  const upper = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const digits = '0123456789';
  const symbols = '!@#$%^&*()-_=+[]{}~?';
  const all = lower + upper + digits + symbols;

  const requiredChars = [
    lower[crypto.randomInt(0, lower.length)],
    upper[crypto.randomInt(0, upper.length)],
    digits[crypto.randomInt(0, digits.length)],
    symbols[crypto.randomInt(0, symbols.length)],
  ];

  const passwordChars = [...requiredChars];

  while (passwordChars.length < length) {
    passwordChars.push(all[crypto.randomInt(0, all.length)]);
  }

  for (let i = passwordChars.length - 1; i > 0; i -= 1) {
    const j = crypto.randomInt(0, i + 1);
    const temp = passwordChars[i];
    passwordChars[i] = passwordChars[j];
    passwordChars[j] = temp;
  }

  return passwordChars.join('');
}

function generateActivationToken() {
  return crypto.randomBytes(48).toString('base64url');
}

export default {
  /**
   * Multi-tenant invite user action
   *
   * CASE A: User already exists
   * - Adds user to the current tenant (creates userTenant + userTenantRole)
   * - Does NOT send activation email
   * - Prevents duplicate membership
   *
   * CASE B: User does not exist
   * - Creates user in invited state (confirmed=false)
   * - Creates userTenant + userTenantRole
   * - Generates activation token
   * - Sends activation email
   *
   * Required request body:
   * - email: string
   * - roleId: number (must be enabled for this tenant)
   * - fullName?: string (optional)
   * - departmentId?: number (must belong to this tenant)
   *
   * Tenant is automatically resolved from context (x-tenant-code header)
   */
  async inviteUser(ctx) {
    try {
      const body = ctx.request.body || {};

      // ============ VALIDATION ============

      // Get tenant context (required)
      const tenantId = ctx.state?.tenantId ?? ctx.state?.tenant?.id;
      if (!tenantId) {
        return ctx.badRequest('Tenant context is required');
      }

      // Validate email
      const rawEmail = typeof body.email === 'string' ? body.email : '';
      const email = rawEmail.trim().toLowerCase();

      if (!email) {
        return ctx.badRequest('email is required');
      }

      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        return ctx.badRequest('email is invalid');
      }

      // Validate roleId (required for multi-tenant)
      const roleId = typeof body.roleId === 'number' ? body.roleId : Number(body.roleId);
      if (!Number.isInteger(roleId) || roleId <= 0) {
        return ctx.badRequest('roleId is required and must be a positive integer');
      }

      // Validate that role is enabled for this tenant
      const roleValidation = await validateTenantRole(tenantId, roleId);
      if (!roleValidation.valid) {
        return ctx.badRequest(roleValidation.error || 'Invalid role');
      }

      // Validate fullName (optional)
      let fullName: string | null = null;
      if (body.fullName !== undefined && body.fullName !== null) {
        if (typeof body.fullName !== 'string') {
          return ctx.badRequest('fullName must be a string');
        }

        const normalizedFullName = body.fullName.trim();
        if (normalizedFullName.length > 150) {
          return ctx.badRequest('fullName max length is 150');
        }

        fullName = normalizedFullName || null;
      }

      // Validate departmentId (optional but if provided must be in this tenant)
      let departmentId: number | null = null;
      if (body.departmentId !== undefined && body.departmentId !== null) {
        const parsedDepartmentId = Number(body.departmentId);
        if (!Number.isInteger(parsedDepartmentId) || parsedDepartmentId <= 0) {
          return ctx.badRequest('departmentId must be a positive integer');
        }

        // Validate department belongs to this tenant
        const deptValidation = await validateTenantDepartment(tenantId, parsedDepartmentId);
        if (!deptValidation.valid) {
          return ctx.badRequest(deptValidation.error || 'Invalid department');
        }

        departmentId = parsedDepartmentId;
      }

      // ============ CHECK EXISTING USER ============

      const existingUser = await strapi.db.query('plugin::users-permissions.user').findOne({
        where: {
          email: {
            $eqi: email,
          },
        },
      });

      // ============ CASE B: NEW USER ============

      if (!existingUser) {
        const password = generateStrongPassword(18);
        const activationToken = generateActivationToken();
        const expiresAtDate = new Date(Date.now() + 48 * 60 * 60 * 1000);

        const result = await inviteNewUser({
          email,
          fullName,
          tenantId,
          roleId,
          departmentId,
          password,
          activationToken,
          expiresAt: expiresAtDate,
        });

        // Send invitation email
        const frontendUrl = process.env.FRONTEND_URL?.trim() || 'http://localhost:5173';
        const activationLink = `${frontendUrl}/activate?token=${encodeURIComponent(activationToken)}`;
        const recipientName = fullName || email;
        const tenantName =
          ctx.state?.tenant?.name || ctx.state?.tenantCode || 'the system';

        let emailSent = true;
        let emailError: string | undefined;

        try {
          await strapi.plugin('email').service('email').send({
            to: email,
            subject: `Bạn được mời tham gia ${tenantName}`,
            text: `Xin chào ${recipientName},\n\nBạn được mời tham gia ${tenantName}. Vui lòng kích hoạt tài khoản qua link sau:\n${activationLink}\n\nLưu ý: link này sẽ hết hạn sau 48 giờ.`,
            html: `
              <p>Xin chào <strong>${recipientName}</strong>,</p>
              <p>Bạn được mời tham gia <strong>${tenantName}</strong>.</p>
              <p>
                <a href="${activationLink}" style="display:inline-block;padding:10px 16px;background:#2563eb;color:#fff;text-decoration:none;border-radius:6px;">
                  Kích hoạt tài khoản
                </a>
              </p>
              <p>Nếu nút không hoạt động, dùng link sau:</p>
              <p><a href="${activationLink}">${activationLink}</a></p>
              <p>Link kích hoạt sẽ hết hạn sau <strong>48 giờ</strong>.</p>
            `,
          });
        } catch (error) {
          emailSent = false;
          const rawMessage =
            (error as { message?: string; response?: { body?: { message?: string } } })?.response?.body
              ?.message || (error as { message?: string })?.message;
          emailError = rawMessage ? String(rawMessage).slice(0, 120) : 'Email sending failed';
          console.error('[inviteUser] Failed to send invite email:', emailError);
        }

        return (ctx.body = {
          ok: true,
          caseType: 'NEW_USER',
          userId: result.userId,
          email: result.email,
          userTenantId: result.userTenantId,
          expiresAt: result.expiresAt,
          emailSent,
          ...(emailError ? { emailError } : {}),
        });
      }

      // ============ CASE A: EXISTING USER ============

      // Check if user already has membership in this tenant
      const existingMembership = await checkUserTenantExists(existingUser.id, tenantId);
      if (existingMembership.exists) {
        return ctx.conflict('User already invited to this tenant');
      }

      // Add existing user to tenant
      const result = await inviteExistingUserToTenant({
        userId: existingUser.id,
        email: existingUser.email,
        tenantId,
        roleId,
        departmentId,
      });

      return (ctx.body = {
        ok: true,
        caseType: 'EXISTING_USER',
        userId: result.userId,
        email: result.email,
        userTenantId: result.userTenantId,
        emailSent: false, // No email for existing users added to new tenant
      });
    } catch (error) {
      console.error('[inviteUser] Unexpected error:', error);
      return ctx.internalServerError('Failed to invite user');
    }
  },

  /**
   * Get available roles and departments for inviting users to current tenant
   * Returns tenant-enabled roles and tenant-scoped departments
   */
  async getInviteOptions(ctx) {
    try {
      const tenantId = ctx.state?.tenantId ?? ctx.state?.tenant?.id;
      if (!tenantId) {
        return ctx.badRequest('Tenant context is required');
      }

      // Get all active tenant roles
      const tenantRoles = await strapi.db
        .query('api::tenant-role.tenant-role')
        .findMany({
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

      const roles = tenantRoles
        .map((tr: any) => {
          const role = tr?.role;
          if (!role || !role.id) return null;

          return {
            id: role.id,
            name: role.name || role.type || `Role #${role.id}`,
            description: role.description || null,
            type: role.type || null,
          };
        })
        .filter(Boolean);

      // Get all departments in this tenant
      const departments = await strapi.db
        .query('api::department.department')
        .findMany({
          where: {
            tenant: tenantId,
            publishedAt: { $notNull: true }, // Only published departments
          },
          select: ['id', 'name', 'code'],
          orderBy: { sortOrder: 'asc', name: 'asc' },
        });

      return (ctx.body = {
        ok: true,
        roles: roles || [],
        departments: departments || [],
      });
    } catch (error) {
      console.error('[getInviteOptions] Unexpected error:', error);
      return ctx.internalServerError('Failed to load invite options');
    }
  },

  async listTenantUsers(ctx) {
    try {
      const tenantId = ctx.state?.tenantId ?? ctx.state?.tenant?.id;
      if (!tenantId) {
        return ctx.badRequest('Tenant context is required');
      }

      const query = ctx.request?.query || {};
      const page = Number(query.page || 1);
      const pageSize = Number(query.pageSize || 10);
      const search = typeof query.search === 'string' ? query.search : '';

      const [result, availableRoles] = await Promise.all([
        listTenantUsers({ tenantId, page, pageSize, search }),
        getTenantEnabledRoles(tenantId),
      ]);

      ctx.body = {
        ok: true,
        data: result.data,
        meta: result.meta,
        availableRoles,
      };
    } catch (error) {
      console.error('[listTenantUsers] Unexpected error:', error);
      return ctx.internalServerError('Failed to load tenant users');
    }
  },

  async updateTenantUserRoles(ctx) {
    try {
      const tenantId = ctx.state?.tenantId ?? ctx.state?.tenant?.id;
      if (!tenantId) {
        return ctx.badRequest('Tenant context is required');
      }

      const userTenantId = Number(ctx.params?.userTenantId);
      if (!Number.isInteger(userTenantId) || userTenantId <= 0) {
        return ctx.badRequest('Invalid userTenantId');
      }

      const roleIdsRaw = ctx.request?.body?.roleIds;
      if (!Array.isArray(roleIdsRaw)) {
        return ctx.badRequest('roleIds must be an array of positive integers');
      }

      const roleIds = roleIdsRaw.map((value: unknown) => Number(value));

      const result = await updateTenantUserRoles({ tenantId, userTenantId, roleIds });
      if (!result.ok) {
        return ctx.badRequest(result.error || 'Failed to update roles');
      }

      ctx.body = {
        ok: true,
        message: 'Roles updated successfully',
      };
    } catch (error) {
      console.error('[updateTenantUserRoles] Unexpected error:', error);
      return ctx.internalServerError('Failed to update user roles');
    }
  },
};
