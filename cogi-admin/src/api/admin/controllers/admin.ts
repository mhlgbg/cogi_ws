import crypto from 'node:crypto';
import {
  validateTenantRole,
  validateTenantDepartment,
  checkUserTenantExists,
  inviteNewUser,
  inviteExistingUserToTenant,
  ensureDepartmentMembership,
  buildActivationLink,
  getRoleDisplayName,
  sendInviteNotification,
} from '../services/invite-user';
import {
  getTenantEnabledRoles,
  listTenantUsers,
  updateTenantUserRoles,
} from '../services/manage-tenant-users';
import { readTenantUsersImportFile } from '../services/import-tenant-users';
import {
  cancelImportTenantUsersJob,
  createImportTenantUsersJob,
  getImportTenantUsersJob,
} from '../services/import-tenant-user-jobs';
import { importUpdateTenantUserRole } from '../services/import-update-user-role';

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

      const rawInvitePurpose = typeof body.invitePurpose === 'string' ? body.invitePurpose.trim().toLowerCase() : '';
      const invitePurpose = rawInvitePurpose === 'admission' ? 'admission' : 'tenant';
      const templateCode = typeof body.templateCode === 'string' ? body.templateCode.trim() : '';

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

        const activationLink = await buildActivationLink(ctx, activationToken, { tenantId });
        const roleName = await getRoleDisplayName(roleId);
        const notificationResult = await sendInviteNotification({
          email,
          fullName,
          tenantId,
          tenantName: ctx.state?.tenant?.name || null,
          tenantCode: ctx.state?.tenant?.code || ctx.state?.tenantCode || null,
          roleName,
          link: activationLink,
          invitePurpose,
          templateCode: templateCode || null,
        });

        return (ctx.body = {
          ok: true,
          caseType: 'NEW_USER',
          userId: result.userId,
          email: result.email,
          userTenantId: result.userTenantId,
          expiresAt: result.expiresAt,
          emailSent: notificationResult.emailSent,
          ...(notificationResult.emailError ? { emailError: notificationResult.emailError } : {}),
          notificationTemplateCode: notificationResult.templateCode,
          notificationUsedFallback: notificationResult.usedFallback,
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

  async importUsers(ctx) {
    try {
      const tenantId = ctx.state?.tenantId ?? ctx.state?.tenant?.id;
      if (!tenantId) {
        return ctx.badRequest('Tenant context is required');
      }

      const roleId = Number(ctx.request?.body?.roleId);
      if (!Number.isInteger(roleId) || roleId <= 0) {
        return ctx.badRequest('roleId is required and must be a positive integer');
      }

      const files = ctx.request?.files || {};
      const uploadFile = Array.isArray(files.file) ? files.file[0] : files.file;
      if (!uploadFile) {
        return ctx.badRequest('file is required');
      }

      const buffer = await readTenantUsersImportFile(uploadFile);
      const job = createImportTenantUsersJob({
        tenantId: Number(tenantId),
        roleId,
        fileName: uploadFile?.name || null,
        buffer,
      });

      ctx.body = {
        ok: true,
        data: job,
      };
    } catch (error: any) {
      console.error('[importUsers] Unexpected error:', error);

      const message = typeof error?.message === 'string' ? error.message : 'Failed to import users';
      return ctx.badRequest(message);
    }
  },

  async getImportUsersJob(ctx) {
    try {
      const tenantId = ctx.state?.tenantId ?? ctx.state?.tenant?.id;
      if (!tenantId) {
        return ctx.badRequest('Tenant context is required');
      }

      const jobId = String(ctx.params?.jobId || '').trim();
      if (!jobId) {
        return ctx.badRequest('jobId is required');
      }

      const job = getImportTenantUsersJob(jobId, Number(tenantId));
      if (!job) {
        return ctx.notFound('Import job not found');
      }

      ctx.body = {
        ok: true,
        data: job,
      };
    } catch (error: any) {
      console.error('[getImportUsersJob] Unexpected error:', error);
      return ctx.internalServerError('Failed to load import job');
    }
  },

  async cancelImportUsersJob(ctx) {
    try {
      const tenantId = ctx.state?.tenantId ?? ctx.state?.tenant?.id;
      if (!tenantId) {
        return ctx.badRequest('Tenant context is required');
      }

      const jobId = String(ctx.params?.jobId || '').trim();
      if (!jobId) {
        return ctx.badRequest('jobId is required');
      }

      const job = cancelImportTenantUsersJob(jobId, Number(tenantId));
      if (!job) {
        return ctx.notFound('Import job not found');
      }

      ctx.body = {
        ok: true,
        data: job,
      };
    } catch (error: any) {
      console.error('[cancelImportUsersJob] Unexpected error:', error);
      return ctx.internalServerError('Failed to cancel import job');
    }
  },

  async importUpdateRole(ctx) {
    try {
      const tenantId = ctx.state?.tenantId ?? ctx.state?.tenant?.id;
      if (!tenantId) {
        return ctx.badRequest('Tenant context is required');
      }

      const oldRoleId = Number(ctx.request?.body?.oldRoleId);
      const newRoleId = Number(ctx.request?.body?.newRoleId);
      if (!Number.isInteger(oldRoleId) || oldRoleId <= 0) {
        return ctx.badRequest('oldRoleId is required and must be a positive integer');
      }
      if (!Number.isInteger(newRoleId) || newRoleId <= 0) {
        return ctx.badRequest('newRoleId is required and must be a positive integer');
      }

      const files = ctx.request?.files || {};
      const uploadFile = Array.isArray(files.file) ? files.file[0] : files.file;
      if (!uploadFile) {
        return ctx.badRequest('file is required');
      }

      const result = await importUpdateTenantUserRole({
        tenantId: Number(tenantId),
        oldRoleId,
        newRoleId,
        file: uploadFile,
      });

      ctx.body = {
        ok: true,
        data: result,
      };
    } catch (error: any) {
      console.error('[importUpdateRole] Unexpected error:', error);

      const message = typeof error?.message === 'string' ? error.message : 'Failed to import update role';
      return ctx.badRequest(message);
    }
  },
};
