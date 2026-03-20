import crypto from 'node:crypto';
import { ensureUserHasAuthenticatedRole } from '../services/ensure-authenticated-role';

const USER_TENANT_UID = 'api::user-tenant.user-tenant';

function normalizePotentialToken(input: unknown): string {
  const raw = typeof input === 'string' ? input.trim() : '';
  if (!raw) return '';

  const cleaned = raw.replace(/^['\"]+|['\"]+$/g, '');
  const tokenMatch = cleaned.match(/[A-Za-z0-9_-]{24,}/);
  return tokenMatch ? tokenMatch[0] : cleaned;
}

export default {
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

      const frontendUrl = (process.env.FRONTEND_URL?.trim() || 'http://localhost:5173').replace(/\/+$/, '');
      const resetLink = `${frontendUrl}/reset-password?code=${encodeURIComponent(resetPasswordToken)}`;

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
