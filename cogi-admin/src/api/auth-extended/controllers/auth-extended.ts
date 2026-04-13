import crypto from 'node:crypto';
import { ensureUserHasAuthenticatedRole } from '../services/ensure-authenticated-role';
import {
  buildActivationLink,
  buildResetPasswordLink,
  checkUserTenantExists,
  getRoleDisplayName,
  inviteExistingUserToTenant,
  inviteNewUser,
  sendInviteNotification,
  updateUserPhoneIfEmpty,
  validateTenantRole,
} from '../../admin/services/invite-user';

const USER_TENANT_UID = 'api::user-tenant.user-tenant';
const USER_TENANT_ROLE_UID = 'api::user-tenant-role.user-tenant-role';
const TENANT_UID = 'api::tenant.tenant';
const TENANT_ROLE_UID = 'api::tenant-role.tenant-role';
const CAMPAIGN_UID = 'api::campaign.campaign';

function normalizeText(value: unknown): string {
  if (value === null || value === undefined) return '';
  return String(value).trim();
}

function extractMediaUrl(media: any): string | null {
  if (!media) return null;
  if (typeof media.url === 'string' && media.url.trim()) return media.url.trim();
  if (media?.data?.attributes?.url && typeof media.data.attributes.url === 'string') {
    return media.data.attributes.url.trim();
  }
  if (media?.attributes?.url && typeof media.attributes.url === 'string') {
    return media.attributes.url.trim();
  }
  return null;
}

async function findActiveTenantByCode(tenantCode: string) {
  return strapi.db.query(TENANT_UID).findOne({
    where: {
      code: {
        $eqi: tenantCode,
      },
      tenantStatus: 'active',
    },
    select: ['id', 'name', 'code', 'shortName'],
    populate: {
      logo: {
        select: ['url'],
      },
    },
  });
}

async function findAplicantRoleIdForTenant(tenantId: number) {
  const tenantRole = await strapi.db.query(TENANT_ROLE_UID).findOne({
    where: {
      tenant: tenantId,
      isActive: true,
      role: {
        $or: [
          { type: { $eqi: 'aplicant' } },
          { name: { $eqi: 'aplicant' } },
        ],
      },
    },
    populate: {
      role: {
        select: ['id', 'name', 'type'],
      },
    },
  });

  return Number(tenantRole?.role?.id || 0) || null;
}

async function findActiveCampaignByCode(campaignCode: string) {
  return strapi.db.query(CAMPAIGN_UID).findOne({
    where: {
      code: {
        $eqi: campaignCode,
      },
      isActive: true,
      campaignStatus: 'open',
    },
    select: ['id', 'name', 'code', 'description', 'campaignStatus', 'isActive'],
    populate: {
      tenant: {
        select: ['id', 'code', 'name'],
      },
    },
  });
}

async function activateUserTenantIfNeeded(userTenantId: number) {
  const membership = await strapi.db.query(USER_TENANT_UID).findOne({
    where: { id: userTenantId },
    select: ['id', 'userTenantStatus'],
  });

  if (!membership?.id || membership.userTenantStatus === 'active') {
    return;
  }

  await strapi.db.query(USER_TENANT_UID).update({
    where: { id: userTenantId },
    data: {
      userTenantStatus: 'active',
      leftAt: null,
    },
  });
}

async function ensureAplicantRoleForMembership(userTenantId: number, roleId: number) {
  const existingRole = await strapi.db.query(USER_TENANT_ROLE_UID).findOne({
    where: {
      userTenant: userTenantId,
      role: roleId,
    },
    select: ['id', 'userTenantRoleStatus'],
  });

  if (existingRole?.id) {
    if (existingRole.userTenantRoleStatus !== 'active') {
      await strapi.db.query(USER_TENANT_ROLE_UID).update({
        where: { id: existingRole.id },
        data: {
          userTenantRoleStatus: 'active',
          revokedAt: null,
        },
      });
    }

    return { assigned: false };
  }

  const roleCount = await strapi.db.query(USER_TENANT_ROLE_UID).count({
    where: {
      userTenant: userTenantId,
    },
  });

  await strapi.db.query(USER_TENANT_ROLE_UID).create({
    data: {
      userTenant: userTenantId,
      role: roleId,
      userTenantRoleStatus: 'active',
      assignedAt: new Date(),
      isPrimary: roleCount === 0,
    },
  });

  return { assigned: true };
}

function normalizePotentialToken(input: unknown): string {
  const raw = typeof input === 'string' ? input.trim() : '';
  if (!raw) return '';

  const cleaned = raw.replace(/^['\"]+|['\"]+$/g, '');
  const tokenMatch = cleaned.match(/[A-Za-z0-9_-]{24,}/);
  return tokenMatch ? tokenMatch[0] : cleaned;
}

export default {
  async admissionCampaignByCode(ctx) {
    try {
      const campaignCode = normalizeText(ctx.params?.campaignCode).toLowerCase();
      if (!campaignCode) {
        return ctx.badRequest('campaignCode is required');
      }

      const campaign = await findActiveCampaignByCode(campaignCode);
      if (!campaign?.id) {
        return ctx.notFound('Admission campaign not found');
      }

      ctx.body = {
        id: campaign.id,
        code: normalizeText(campaign.code),
        name: normalizeText(campaign.name),
        description: normalizeText(campaign.description),
        tenant: campaign.tenant
          ? {
              id: campaign.tenant.id,
              code: normalizeText(campaign.tenant.code),
              name: normalizeText(campaign.tenant.name),
            }
          : null,
      };
    } catch (error) {
      strapi.log.error('[auth.admissionCampaignByCode] unexpected error', error);
      return ctx.internalServerError('Failed to load admission campaign');
    }
  },

  async tenantByCode(ctx) {
    try {
      const tenantCode = normalizeText(ctx.params?.tenantCode).toLowerCase();
      if (!tenantCode) {
        return ctx.badRequest('tenantCode is required');
      }

      const tenant = await findActiveTenantByCode(tenantCode);
      if (!tenant) {
        return ctx.notFound('Tenant not found');
      }

      ctx.body = {
        id: tenant.id,
        code: normalizeText(tenant.code),
        name: normalizeText(tenant.name) || normalizeText(tenant.shortName) || normalizeText(tenant.code),
        logo: tenant.logo || null,
        logoUrl: extractMediaUrl(tenant.logo),
      };
    } catch (error) {
      strapi.log.error('[auth.tenantByCode] unexpected error', error);
      return ctx.internalServerError('Failed to load tenant');
    }
  },

  async invite(ctx) {
    try {
      const body = ctx.request.body || {};
      const tenantCode = normalizeText(body.tenantCode).toLowerCase();
      const campaignCode = normalizeText(body.campaignCode).toLowerCase();
      const fullName = normalizeText(body.fullName);
      const email = normalizeText(body.email).toLowerCase();
      const phone = normalizeText(body.phone);
      const templateCode = normalizeText(body.templateCode) || 'admission_invite';

      if (!tenantCode) {
        return ctx.badRequest('tenantCode is required');
      }

      if (!campaignCode) {
        return ctx.badRequest('campaignCode is required');
      }

      if (!fullName) {
        return ctx.badRequest('fullName is required');
      }

      if (!email) {
        return ctx.badRequest('email is required');
      }

      if (!phone) {
        return ctx.badRequest('phone is required');
      }

      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        return ctx.badRequest('email is invalid');
      }

      const tenant = await findActiveTenantByCode(tenantCode);
      if (!tenant?.id) {
        return ctx.notFound('Tenant not found');
      }

      const campaign = await findActiveCampaignByCode(campaignCode);
      if (!campaign?.id) {
        return ctx.notFound('Admission campaign not found');
      }

      if (Number(campaign?.tenant?.id || 0) !== Number(tenant.id)) {
        return ctx.badRequest('Campaign does not belong to tenant');
      }

      const roleId = await findAplicantRoleIdForTenant(Number(tenant.id));
      if (!roleId) {
        return ctx.badRequest('Aplicant role is not configured for this tenant');
      }

      const roleValidation = await validateTenantRole(Number(tenant.id), roleId);
      if (!roleValidation.valid) {
        return ctx.badRequest(roleValidation.error || 'Invalid role');
      }

      const existingUser = await strapi.db.query('plugin::users-permissions.user').findOne({
        where: {
          email: {
            $eqi: email,
          },
        },
        select: ['id', 'email'],
      });

      if (!existingUser) {
        const password = crypto.randomBytes(24).toString('base64url');
        const activationToken = crypto.randomBytes(48).toString('base64url');
        const expiresAtDate = new Date(Date.now() + 48 * 60 * 60 * 1000);

        const result = await inviteNewUser({
          email,
          fullName,
          phone,
          tenantId: Number(tenant.id),
          roleId,
          password,
          activationToken,
          expiresAt: expiresAtDate,
        });

        const roleName = await getRoleDisplayName(roleId);
        const notificationResult = await sendInviteNotification({
          email,
          fullName,
          tenantId: Number(tenant.id),
          tenantName: normalizeText(tenant.name),
          tenantCode: normalizeText(tenant.code),
          roleName,
          link: await buildActivationLink(ctx, activationToken, { tenantId: Number(tenant.id) }),
          invitePurpose: 'admission',
          templateCode,
        });

        ctx.body = {
          ok: true,
          caseType: 'NEW_USER',
          userId: result.userId,
          email: result.email,
          userTenantId: result.userTenantId,
          emailSent: notificationResult.emailSent,
          ...(notificationResult.emailError ? { emailError: notificationResult.emailError } : {}),
          notificationTemplateCode: notificationResult.templateCode,
          notificationUsedFallback: notificationResult.usedFallback,
          campaignCode,
          message: 'Vui long kiem tra email de kich hoat tai khoan va tiep tuc dang ky tuyen sinh',
        };
        return;
      }

      await updateUserPhoneIfEmpty(Number(existingUser.id), phone);
      await ensureUserHasAuthenticatedRole(strapi, Number(existingUser.id));

      const existingMembership = await checkUserTenantExists(Number(existingUser.id), Number(tenant.id));
      if (!existingMembership.exists) {
        const result = await inviteExistingUserToTenant({
          userId: Number(existingUser.id),
          email: existingUser.email,
          tenantId: Number(tenant.id),
          roleId,
        });

        ctx.body = {
          ok: true,
          status: 'EXISTING_USER',
          caseType: 'EXISTING_USER',
          userId: existingUser.id,
          email: existingUser.email,
          userTenantId: result.userTenantId,
          emailSent: false,
          campaignCode,
          requireLogin: true,
          message: 'Email already exists. Your account has been linked to this admission. Please login to continue.',
        };
        return;
      }

      await activateUserTenantIfNeeded(Number(existingMembership.userTenant?.id || 0));
      await ensureAplicantRoleForMembership(Number(existingMembership.userTenant?.id || 0), roleId);

      ctx.body = {
        ok: true,
        status: 'EXISTING_USER',
        caseType: 'EXISTING_USER',
        userId: existingUser.id,
        email: existingUser.email,
        userTenantId: existingMembership.userTenant?.id,
        emailSent: false,
        campaignCode,
        requireLogin: true,
        message: 'You already have an account. Please login to continue.',
      };
    } catch (error) {
      strapi.log.error('[auth.invite] unexpected error', error);
      return ctx.internalServerError('Failed to process admission invite');
    }
  },

  async forgotPasswordSafe(ctx) {
    try {
      const rawEmail = ctx.request.body?.email;
      const email = typeof rawEmail === 'string' ? rawEmail.trim().toLowerCase() : '';

      if (!email) {
        return ctx.badRequest('email is required');
      }

      const user = await strapi.db.query('plugin::users-permissions.user').findOne({
        where: {
          email: {
            $eqi: email,
          },
        },
        select: ['id', 'email', 'blocked'],
      });

      // Always return generic success message to avoid email enumeration.
      if (!user?.id || user.blocked) {
        ctx.body = {
          ok: true,
          message: 'If email exists, reset instructions have been sent.',
        };
        return;
      }

      const resetPasswordToken = crypto.randomBytes(48).toString('base64url');
      const resetPasswordTokenExpiration = new Date(Date.now() + 2 * 60 * 60 * 1000);
      const userModel = strapi.getModel('plugin::users-permissions.user');
      const userAttributes = userModel?.attributes as Record<string, unknown> | undefined;

      const updateData: Record<string, unknown> = {
        resetPasswordToken,
      };

      if (userAttributes && 'resetPasswordTokenExpiration' in userAttributes) {
        updateData.resetPasswordTokenExpiration = resetPasswordTokenExpiration;
      }

      await strapi.entityService.update('plugin::users-permissions.user', user.id, {
        data: updateData,
      });

      const resetLink = await buildResetPasswordLink(ctx, resetPasswordToken);

      try {
        const emailService = strapi.plugin('email')?.service('email');
        if (emailService?.send) {
          await emailService.send({
            to: user.email,
            subject: 'Password reset instructions',
            text: `Use this link to reset your password: ${resetLink}`,
            html: `<p>Use this link to reset your password:</p><p><a href="${resetLink}">${resetLink}</a></p>`,
          });
        } else {
          strapi.log.warn('[auth.forgotPasswordSafe] email service is not available');
        }
      } catch (mailError) {
        strapi.log.error('[auth.forgotPasswordSafe] failed to send reset email', mailError);
      }

      ctx.body = {
        ok: true,
        message: 'If email exists, reset instructions have been sent.',
        ...(process.env.NODE_ENV !== 'production' ? { resetLink } : {}),
      };
    } catch (error) {
      strapi.log.error('[auth.forgotPasswordSafe] unexpected error', error);
      return ctx.internalServerError('Failed to process forgot password request');
    }
  },

  async activate(ctx) {
    try {
      const rawToken = ctx.request.body?.token;
      const token = typeof rawToken === 'string' ? rawToken.trim() : '';

      if (!token) {
        return ctx.badRequest('token is required');
      }

      const activationToken = await strapi.db
        .query('api::activation-token.activation-token')
        .findOne({
          where: { token },
          populate: ['user'],
        });

      if (!activationToken) {
        return ctx.badRequest('Invalid token');
      }

      if (activationToken.usedAt) {
        return ctx.badRequest('Token already used');
      }

      const expiresAtMs = new Date(activationToken.expiresAt).getTime();
      if (Number.isNaN(expiresAtMs) || expiresAtMs < Date.now()) {
        return ctx.badRequest('Token expired');
      }

      const userId = activationToken.user?.id ?? activationToken.user;
      if (!userId) {
        return ctx.badRequest('Invalid token');
      }

      const numericUserId = Number(userId);
      if (!Number.isInteger(numericUserId) || numericUserId <= 0) {
        return ctx.badRequest('Invalid token');
      }

      const roleAssignmentResult = await ensureUserHasAuthenticatedRole(strapi, numericUserId);

      await strapi.db.query('api::activation-token.activation-token').update({
        where: { id: activationToken.id },
        data: { usedAt: new Date() },
      });

      // ============ MULTI-TENANT: Activate pending userTenants ============
      // When user activates account, activate any pending userTenant records
      const pendingUserTenants = await strapi.db.query(USER_TENANT_UID).findMany({
        where: {
          user: numericUserId,
          userTenantStatus: 'pending',
        },
      });

      for (const userTenant of pendingUserTenants) {
        await strapi.db.query(USER_TENANT_UID).update({
          where: { id: userTenant.id },
          data: {
            userTenantStatus: 'active',
            joinedAt: new Date(),
          },
        });
      }

      const resetPasswordToken = crypto.randomBytes(48).toString('base64url');
      const resetPasswordTokenExpiration = new Date(Date.now() + 2 * 60 * 60 * 1000);
      const userModel = strapi.getModel('plugin::users-permissions.user');
      const userAttributes = userModel?.attributes as Record<string, unknown> | undefined;

      const userUpdateData: Record<string, unknown> = {
        resetPasswordToken,
      };

      const userProvider =
        (activationToken.user && typeof activationToken.user === 'object'
          ? (activationToken.user as { provider?: string | null }).provider
          : null) || null;

      if (!userProvider) {
        userUpdateData.provider = 'local';
      }

      if (userAttributes && 'resetPasswordTokenExpiration' in userAttributes) {
        userUpdateData.resetPasswordTokenExpiration = resetPasswordTokenExpiration;
      }

      await strapi.entityService.update('plugin::users-permissions.user', numericUserId, {
        data: {
          confirmed: true,
          ...userUpdateData,
        },
      });

      strapi.log.info(
        `[auth.activate] userId=${numericUserId} hasRoleBefore=${roleAssignmentResult.hasRoleBefore} roleAssigned=${roleAssignmentResult.roleAssigned} pendingUserTenantsActivated=${pendingUserTenants.length}`
      );

      ctx.body = {
        ok: true,
        message: 'Account activated successfully',
        resetPasswordToken,
      };
    } catch {
      return ctx.internalServerError('Failed to activate account');
    }
  },

  async setPassword(ctx) {
    try {
      const body = ctx.request.body || {};
      const primaryRawCode = body.code ?? body.token ?? body?.data?.code ?? body?.data?.token;
      let code = normalizePotentialToken(primaryRawCode);

      let password = typeof body.password === 'string' ? body.password : '';
      if (!password && typeof body?.data?.password === 'string') {
        password = body.data.password;
      }

      const passwordConfirmation =
        typeof body.passwordConfirmation === 'string' ? body.passwordConfirmation : '';

      // Defensive fallback for malformed payloads where token accidentally becomes a field key.
      if (!code) {
        const candidateKeys = Object.keys(body || {}).filter(
          (key) => !['password', 'passwordConfirmation', 'code', 'token', 'data'].includes(key)
        );
        const fallbackCode = candidateKeys.find((key) => key && key.length >= 20);
        if (fallbackCode) {
          code = normalizePotentialToken(fallbackCode);
          if (!password && typeof body[fallbackCode] === 'string') {
            password = body[fallbackCode];
          }
        }
      }

      const confirm =
        passwordConfirmation ||
        (typeof body?.data?.passwordConfirmation === 'string' ? body.data.passwordConfirmation : '');

      if (!code) {
        return ctx.badRequest('code is required');
      }

      if (!password) {
        return ctx.badRequest('password is required');
      }

      if (password.length < 8) {
        return ctx.badRequest('password must be at least 8 characters');
      }

      if (password !== confirm) {
        return ctx.badRequest('password confirmation does not match');
      }

      const decodedCode = (() => {
        try {
          return normalizePotentialToken(decodeURIComponent(code));
        } catch {
          return code;
        }
      })();

      let user = await strapi.db.query('plugin::users-permissions.user').findOne({
        where: { resetPasswordToken: code },
        select: ['id', 'blocked', 'resetPasswordToken'],
      });

      if (!user?.id && decodedCode !== code) {
        user = await strapi.db.query('plugin::users-permissions.user').findOne({
          where: { resetPasswordToken: decodedCode },
          select: ['id', 'blocked', 'resetPasswordToken'],
        });
      }

      // Fallback: accept activation token in case client still carries original token.
      if (!user?.id) {
        let activationToken = await strapi.db
          .query('api::activation-token.activation-token')
          .findOne({
            where: { token: code },
            populate: ['user'],
          });

        if (!activationToken && decodedCode !== code) {
          activationToken = await strapi.db
            .query('api::activation-token.activation-token')
            .findOne({
              where: { token: decodedCode },
              populate: ['user'],
            });
        }

        if (!activationToken) {
          const codePrefix = (decodedCode || code).slice(0, 16);
          if (codePrefix.length >= 12) {
            activationToken = await strapi.db
              .query('api::activation-token.activation-token')
              .findOne({
                where: {
                  token: {
                    $startsWith: codePrefix,
                  },
                },
                orderBy: { id: 'desc' },
                populate: ['user'],
              });
          }
        }

        if (activationToken) {
          const expiresAtMs = new Date(activationToken.expiresAt).getTime();
          const isExpired = Number.isNaN(expiresAtMs) || expiresAtMs < Date.now();

          if (isExpired) {
            return ctx.badRequest('Invalid or expired code');
          }

          const fallbackUserId = activationToken.user?.id ?? activationToken.user;
          if (fallbackUserId) {
            user = await strapi.db.query('plugin::users-permissions.user').findOne({
              where: { id: fallbackUserId },
              select: ['id', 'blocked'],
            });
          }
        }
      }

      if (!user?.id) {
        strapi.log.warn(`[auth.setPassword] token lookup failed for code prefix=${code.slice(0, 8)}`);
        return ctx.badRequest('Invalid or expired code');
      }

      if (user.blocked) {
        return ctx.badRequest('User is blocked');
      }

      const usersPermissionsUserService = strapi.plugin('users-permissions').service('user');

      await usersPermissionsUserService.edit(user.id, {
        password,
        confirmed: true,
        resetPasswordToken: null,
      });

      ctx.body = {
        ok: true,
        message: 'Password set successfully',
      };
    } catch {
      return ctx.internalServerError('Failed to set password');
    }
  },
};
