import crypto from 'node:crypto';

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
  async inviteUser(ctx) {
    try {
      const body = ctx.request.body || {};

      const rawEmail = typeof body.email === 'string' ? body.email : '';
      const email = rawEmail.trim().toLowerCase();

      if (!email) {
        return ctx.badRequest('email is required');
      }

      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        return ctx.badRequest('email is invalid');
      }

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

      let departmentId: number | null = null;
      if (body.departmentId !== undefined && body.departmentId !== null) {
        const parsedDepartmentId = Number(body.departmentId);
        if (!Number.isInteger(parsedDepartmentId) || parsedDepartmentId <= 0) {
          return ctx.badRequest('departmentId must be a positive integer');
        }
        departmentId = parsedDepartmentId;
      }

      const existingUser = await strapi.db.query('plugin::users-permissions.user').findOne({
        where: {
          email: {
            $eqi: email,
          },
        },
      });

      if (existingUser) {
        return ctx.conflict('Email already exists');
      }

      const password = generateStrongPassword(18);
      const usersPermissionsUserService = strapi.plugin('users-permissions').service('user');

      let createdUser;
      try {
        createdUser = await usersPermissionsUserService.add({
          email,
          username: email,
          provider: 'local',
          fullName,
          confirmed: false,
          blocked: false,
          password,
        });
      } catch (createUserError) {
        if (isValidationError(createUserError)) {
          return ctx.badRequest('Invalid user data');
        }
        throw createUserError;
      }

      const activationToken = generateActivationToken();
      const expiresAtDate = new Date(Date.now() + 48 * 60 * 60 * 1000);

      await strapi.db.query('api::activation-token.activation-token').create({
        data: {
          token: activationToken,
          expiresAt: expiresAtDate,
          usedAt: null,
          user: createdUser.id,
        },
      });

      const frontendUrl = process.env.FRONTEND_URL?.trim() || 'http://localhost:5173';
      const activationLink = `${frontendUrl}/activate?token=${encodeURIComponent(activationToken)}`;
      const recipientName = fullName || email;

      let emailSent = true;
      let emailError: string | undefined;

      try {
        await strapi.plugin('email').service('email').send({
          to: email,
          subject: 'Bạn được mời tham gia hệ thống Alpha',
          text: `Xin chào ${recipientName},\n\nBạn được mời tham gia hệ thống Alpha. Vui lòng kích hoạt tài khoản qua link sau:\n${activationLink}\n\nLưu ý: link này sẽ hết hạn sau 48 giờ.`,
          html: `
            <p>Xin chào <strong>${recipientName}</strong>,</p>
            <p>Bạn được mời tham gia hệ thống Alpha.</p>
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

      let warning: string | undefined;

      if (departmentId !== null) {
        const membershipUid = 'api::department-membership.department-membership';
        const membershipModel = strapi.getModel(membershipUid);

        if (!membershipModel) {
          warning = 'DepartmentMembership model not found. Please map manually.';
        } else {
          const membershipData: Record<string, unknown> = {
            user: createdUser.id,
            department: departmentId,
          };
          const membershipAttributes = membershipModel.attributes as Record<string, unknown>;

          if ('isActive' in membershipAttributes) {
            membershipData.isActive = true;
          } else if ('status_record' in membershipAttributes) {
            membershipData.status_record = 'ACTIVE';
          }

          try {
            await strapi.db.query(membershipUid).create({ data: membershipData });
          } catch {
            warning = 'Could not create DepartmentMembership. Please map manually.';
          }
        }
      }

      ctx.body = {
        ok: true,
        userId: createdUser.id,
        email: createdUser.email,
        fullName: createdUser.fullName ?? null,
        expiresAt: expiresAtDate.toISOString(),
        emailSent,
        ...(emailError ? { emailError } : {}),
      };
    } catch {
      return ctx.internalServerError('Failed to invite user');
    }
  },
};
