import {
  buildMailQueueJobId,
  enqueueMail,
  MAIL_LOG_UID,
  queueExistingMailLog,
  removeMailLogJob,
  resolveMailQueueConfig,
  sendMailDirectFromMailLog,
  updateMailLog,
} from '../../../services/mail-queue';
import { mergeTenantWhere, normalizeSortInput, parseOptionalPositiveInt, toPositiveInt, toText, whereByParam } from '../../../utils/tenant-scope';

const USER_TENANT_UID = 'api::user-tenant.user-tenant';
const USER_TENANT_ROLE_UID = 'api::user-tenant-role.user-tenant-role';
const ROLE_FEATURE_UID = 'api::role-feature.role-feature';
const MAIL_MONITOR_KEY = 'system.mailMonitor';

type MailMonitorScope = {
  user: any;
  isPlatformAdmin: boolean;
  tenantId: number | null;
  filterTenantId: number | null;
};

function normalizeMetadata(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {};
  }

  return { ...(value as Record<string, unknown>) };
}

function normalizeStatusFilter(value: unknown): string | null {
  const text = toText(value).toUpperCase();
  return text || null;
}

function normalizeDateBoundary(value: unknown, boundary: 'start' | 'end'): string | null {
  const text = toText(value);
  if (!text) return null;

  const rawValue = /^\d{4}-\d{2}-\d{2}$/.test(text)
    ? `${text}${boundary === 'start' ? 'T00:00:00.000Z' : 'T23:59:59.999Z'}`
    : text;

  const date = new Date(rawValue);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function resolveSortOrder(query: Record<string, unknown>) {
  const normalizedSort = normalizeSortInput(query?.sort);
  if (normalizedSort.length > 0) return normalizedSort;

  const sortBy = toText(query?.sortBy);
  if (!sortBy) {
    return [{ queuedAt: 'desc' }, { id: 'desc' }];
  }

  return [{ [sortBy]: toText(query?.sortOrder).toLowerCase() === 'asc' ? 'asc' : 'desc' } as Record<string, 'asc' | 'desc'>, { id: 'desc' }];
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
    const userId = parseOptionalPositiveInt(decoded?.id);
    if (!userId) return null;

    return strapi.db.query('plugin::users-permissions.user').findOne({
      where: { id: userId },
      select: ['id', 'email', 'blocked', 'isPlatformAdmin'],
    });
  } catch {
    return null;
  }
}

async function resolveAuthenticatedUser(ctx: any) {
  const authUser = ctx.state?.user?.id ? ctx.state.user : await resolveUserFromJwt(ctx);
  if (!authUser?.id) {
    ctx.unauthorized('Unauthorized');
    return null;
  }

  if (authUser.blocked) {
    ctx.unauthorized('Account is blocked');
    return null;
  }

  ctx.state.user = authUser;
  return authUser;
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

  const userTenantId = parseOptionalPositiveInt(userTenant?.id);
  if (!userTenantId) {
    return new Set();
  }

  const userTenantRoles = await strapi.db.query(USER_TENANT_ROLE_UID).findMany({
    where: {
      userTenant: userTenantId,
      userTenantRoleStatus: 'active',
    },
    populate: ['role'],
  });

  const roleIds = (userTenantRoles || [])
    .map((item: any) => parseOptionalPositiveInt(item?.role?.id ?? item?.role))
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

  return new Set(
    (mappings || [])
      .map((item: any) => toText(item?.feature?.key))
      .filter(Boolean)
  );
}

async function resolveAccessScope(ctx: any, requiredKeys: string[] = []) {
  const user = await resolveAuthenticatedUser(ctx);
  if (!user) return null;

  const filterTenantId = parseOptionalPositiveInt(ctx.query?.tenantId ?? ctx.request?.body?.tenantId);

  if (user.isPlatformAdmin === true) {
    return {
      user,
      isPlatformAdmin: true,
      tenantId: null,
      filterTenantId,
    };
  }

  const tenantId = parseOptionalPositiveInt(ctx.state?.tenantId ?? ctx.state?.tenant?.id);
  if (!tenantId) {
    ctx.forbidden('Tenant context is required (x-tenant-code header)');
    return null;
  }

  const permissionKeys = await getTenantScopedPermissionKeys(Number(user.id), tenantId);
  if (requiredKeys.length > 0 && !requiredKeys.some((key) => permissionKeys.has(key))) {
    ctx.forbidden('Forbidden');
    return null;
  }

  return {
    user,
    isPlatformAdmin: false,
    tenantId,
    filterTenantId: tenantId,
  };
}

function buildListWhere(scope: MailMonitorScope, query: Record<string, unknown>) {
  const filter: Record<string, unknown> = {};
  const sendStatus = normalizeStatusFilter(query.sendStatus);
  const mailType = toText(query.mailType);
  const toEmail = toText(query.toEmail);
  const fromDate = normalizeDateBoundary(query.fromDate, 'start');
  const toDate = normalizeDateBoundary(query.toDate, 'end');
  const requestedTenantId = parseOptionalPositiveInt(query.tenantId);

  if (sendStatus) {
    filter.sendStatus = sendStatus;
  }

  if (mailType) {
    filter.mailType = {
      $containsi: mailType,
    };
  }

  if (toEmail) {
    filter.toEmail = {
      $containsi: toEmail,
    };
  }

  if (fromDate || toDate) {
    filter.queuedAt = {
      ...(fromDate ? { $gte: fromDate } : {}),
      ...(toDate ? { $lte: toDate } : {}),
    };
  }

  if (scope.isPlatformAdmin) {
    const tenantId = requestedTenantId || scope.filterTenantId;
    if (tenantId) {
      return mergeTenantWhere(filter, tenantId);
    }

    return filter;
  }

  return mergeTenantWhere(filter, Number(scope.tenantId));
}

async function findMailLogById(idParam: unknown) {
  const where = whereByParam(idParam);
  if (!where) {
    return { error: 'Invalid mail log id', mailLog: null };
  }

  const mailLog = await strapi.db.query(MAIL_LOG_UID).findOne({
    where,
    populate: {
      tenant: {
        select: ['id', 'name', 'code'],
      },
    },
  });

  return {
    error: null,
    mailLog,
  };
}

function assertMailLogScope(mailLog: any, scope: MailMonitorScope, ctx: any) {
  if (!mailLog?.id) {
    ctx.notFound('Mail log not found');
    return false;
  }

  if (scope.isPlatformAdmin) {
    return true;
  }

  const mailLogTenantId = parseOptionalPositiveInt(mailLog?.tenant?.id ?? mailLog?.tenant);
  if (!mailLogTenantId || mailLogTenantId !== Number(scope.tenantId)) {
    ctx.forbidden('Forbidden');
    return false;
  }

  return true;
}

function toMailMonitorListItem(mailLog: any) {
  return {
    id: mailLog?.id,
    tenant: mailLog?.tenant || null,
    mailType: mailLog?.mailType || '',
    toEmail: mailLog?.toEmail || '',
    subject: mailLog?.subject || '',
    provider: mailLog?.provider || '',
    fallbackProvider: mailLog?.fallbackProvider || null,
    providerMessageId: mailLog?.providerMessageId || null,
    sendStatus: mailLog?.sendStatus || 'QUEUED',
    attempts: Number(mailLog?.attempts || 0),
    lastError: mailLog?.lastError || null,
    lastProviderError: mailLog?.lastProviderError || null,
    fallbackError: mailLog?.fallbackError || null,
    queuedAt: mailLog?.queuedAt || null,
    sentAt: mailLog?.sentAt || null,
    failedAt: mailLog?.failedAt || null,
    createdAt: mailLog?.createdAt || null,
    updatedAt: mailLog?.updatedAt || null,
  };
}

function buildStatsPayload(mailLogs: any[]) {
  const byStatus: Record<string, number> = {};
  const byMailType: Record<string, number> = {};
  const byDay: Record<string, number> = {};

  for (const item of mailLogs) {
    const statusKey = toText(item?.sendStatus).toUpperCase() || 'UNKNOWN';
    const mailTypeKey = toText(item?.mailType) || 'unknown';
    const queuedAt = toText(item?.queuedAt || item?.createdAt);
    const dayKey = queuedAt ? queuedAt.slice(0, 10) : 'unknown';

    byStatus[statusKey] = (byStatus[statusKey] || 0) + 1;
    byMailType[mailTypeKey] = (byMailType[mailTypeKey] || 0) + 1;
    byDay[dayKey] = (byDay[dayKey] || 0) + 1;
  }

  return {
    total: mailLogs.length,
    byStatus,
    byMailType,
    byDay,
  };
}

function getRequeueCount(metadata: Record<string, unknown>) {
  return toPositiveInt(metadata.requeueCount, 0);
}

function isValidEmail(value: unknown) {
  const text = toText(value).toLowerCase();
  if (!text) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(text);
}

function handleMailMonitorError(ctx: any, error: any, fallbackMessage: string) {
  const status = Number(error?.status || 500);
  const message = toText(error?.message) || fallbackMessage;

  if (status === 400) return ctx.badRequest(message);
  if (status === 401) return ctx.unauthorized(message);
  if (status === 403) return ctx.forbidden(message);
  if (status === 404) return ctx.notFound(message);
  if (status === 409) return ctx.conflict(message);

  strapi.log.error('[mail-monitor] unexpected error', error);
  return ctx.internalServerError(message || fallbackMessage);
}

export default {
  async list(ctx) {
    const scope = await resolveAccessScope(ctx, [MAIL_MONITOR_KEY]);
    if (!scope) return;

    const page = toPositiveInt(ctx.query?.page, 1);
    const pageSize = Math.min(toPositiveInt(ctx.query?.pageSize, 20), 100);
    const start = (page - 1) * pageSize;
    const where = buildListWhere(scope, ctx.query || {});
    const sort = resolveSortOrder(ctx.query || {});

    const [items, total] = await Promise.all([
      strapi.db.query(MAIL_LOG_UID).findMany({
        where,
        offset: start,
        limit: pageSize,
        orderBy: sort,
        select: ['id', 'mailType', 'toEmail', 'subject', 'provider', 'fallbackProvider', 'providerMessageId', 'sendStatus', 'attempts', 'lastError', 'lastProviderError', 'fallbackError', 'queuedAt', 'sentAt', 'failedAt', 'createdAt', 'updatedAt'],
        populate: {
          tenant: {
            select: ['id', 'name', 'code'],
          },
        },
      }),
      strapi.db.query(MAIL_LOG_UID).count({ where }),
    ]);

    ctx.body = {
      data: items.map(toMailMonitorListItem),
      meta: {
        pagination: {
          page,
          pageSize,
          pageCount: Math.ceil(total / pageSize) || 1,
          total,
        },
      },
    };
  },

  async detail(ctx) {
    const scope = await resolveAccessScope(ctx, [MAIL_MONITOR_KEY]);
    if (!scope) return;

    const { error, mailLog } = await findMailLogById(ctx.params?.id);
    if (error) return ctx.badRequest(error);
    if (!assertMailLogScope(mailLog, scope, ctx)) return;

    ctx.body = {
      data: mailLog,
    };
  },

  async stats(ctx) {
    const scope = await resolveAccessScope(ctx, [MAIL_MONITOR_KEY]);
    if (!scope) return;

    const where = buildListWhere(scope, ctx.query || {});
    const items = await strapi.db.query(MAIL_LOG_UID).findMany({
      where,
      select: ['id', 'mailType', 'sendStatus', 'queuedAt', 'createdAt'],
    });

    ctx.body = {
      data: buildStatsPayload(items || []),
    };
  },

  async requeue(ctx) {
    const scope = await resolveAccessScope(ctx, [MAIL_MONITOR_KEY]);
    if (!scope) return;

    const { error, mailLog } = await findMailLogById(ctx.params?.id);
    if (error) return ctx.badRequest(error);
    if (!assertMailLogScope(mailLog, scope, ctx)) return;

    const allowedStatuses = new Set(['FAILED', 'CANCELLED', 'QUEUED', 'RETRYING']);
    const currentStatus = normalizeStatusFilter(mailLog?.sendStatus);
    if (!currentStatus || !allowedStatuses.has(currentStatus)) {
      return ctx.badRequest('Only FAILED, CANCELLED, QUEUED, or RETRYING mail logs can be requeued');
    }

    const metadata = normalizeMetadata(mailLog?.metadata);
    const queueConfig = resolveMailQueueConfig();
    if (queueConfig.useRedisQueue) {
      await removeMailLogJob({ mailLog });
    }

    const nextMetadata = {
      ...metadata,
      requeueCount: getRequeueCount(metadata) + 1,
      requeuedByUserId: scope.user.id,
      requeuedAt: new Date().toISOString(),
      queueJobId: buildMailQueueJobId(mailLog.id, String(Date.now())),
    };

    const updated = await updateMailLog(strapi, Number(mailLog.id), {
      sendStatus: 'QUEUED',
      lastError: null,
      lastProviderError: null,
      fallbackError: null,
      failedAt: null,
      attempts: 0,
      queuedAt: new Date(),
      metadata: nextMetadata,
    });

    const queued = queueConfig.useRedisQueue
      ? await queueExistingMailLog({
        strapi,
        mailLog: {
          ...mailLog,
          ...updated,
          metadata: nextMetadata,
        },
        jobId: String(nextMetadata.queueJobId),
      })
      : {
        queued: false,
        direct: false,
        manual: true,
        mailLogId: Number(mailLog.id),
        sendStatus: 'QUEUED',
      };

    ctx.body = {
      ok: true,
      data: {
        id: mailLog.id,
        sendStatus: 'QUEUED',
        queued,
      },
    };
  },

  async resend(ctx) {
    try {
      const scope = await resolveAccessScope(ctx, [MAIL_MONITOR_KEY]);
      if (!scope) return;

      const { error, mailLog } = await findMailLogById(ctx.params?.id);
      if (error) return ctx.badRequest(error);
      if (!assertMailLogScope(mailLog, scope, ctx)) return;

      const queued = await enqueueMail({
        tenantId: mailLog?.tenant?.id ?? mailLog?.tenant ?? null,
        mailType: toText(mailLog.mailType) || 'system-resend',
        to: mailLog.toEmail,
        cc: mailLog.cc,
        bcc: mailLog.bcc,
        subject: mailLog.subject,
        html: mailLog.html,
        text: mailLog.text,
        replyTo: mailLog.replyTo,
        metadata: {
          ...normalizeMetadata(mailLog.metadata),
          originalMailLogId: mailLog.id,
          resentByUserId: scope.user.id,
        },
        jobIdSuffix: String(Date.now()),
      });

      ctx.body = {
        ok: queued?.ok !== false,
        sourceMailLogId: mailLog.id,
        resentMailLogId: queued.mailLogId,
        queued,
      };
    } catch (error: any) {
      return handleMailMonitorError(ctx, error, 'Không thể gửi lại email');
    }
  },

  async cancel(ctx) {
    const scope = await resolveAccessScope(ctx, [MAIL_MONITOR_KEY]);
    if (!scope) return;

    const { error, mailLog } = await findMailLogById(ctx.params?.id);
    if (error) return ctx.badRequest(error);
    if (!assertMailLogScope(mailLog, scope, ctx)) return;

    const currentStatus = normalizeStatusFilter(mailLog?.sendStatus);
    if (!['QUEUED', 'RETRYING'].includes(currentStatus || '')) {
      return ctx.badRequest('Only QUEUED or RETRYING mail logs can be cancelled');
    }

    const queueConfig = resolveMailQueueConfig();
    const removal = queueConfig.useRedisQueue
      ? await removeMailLogJob({ mailLog })
      : { removed: false, jobId: null };
    const metadata = {
      ...normalizeMetadata(mailLog?.metadata),
      cancelledByUserId: scope.user.id,
      cancelledAt: new Date().toISOString(),
      ...(removal.jobId ? { queueJobId: removal.jobId } : {}),
    };

    await updateMailLog(strapi, Number(mailLog.id), {
      sendStatus: 'CANCELLED',
      failedAt: null,
      lastError: null,
      lastProviderError: null,
      fallbackError: null,
      metadata,
    });

    ctx.body = {
      ok: true,
      data: {
        id: mailLog.id,
        sendStatus: 'CANCELLED',
        removedJob: removal,
      },
    };
  },

  async sendNow(ctx) {
    const scope = await resolveAccessScope(ctx, [MAIL_MONITOR_KEY]);
    if (!scope) return;

    const { error, mailLog } = await findMailLogById(ctx.params?.id);
    if (error) return ctx.badRequest(error);
    if (!assertMailLogScope(mailLog, scope, ctx)) return;

    const allowedStatuses = new Set(['FAILED', 'CANCELLED', 'QUEUED', 'RETRYING']);
    const currentStatus = normalizeStatusFilter(mailLog?.sendStatus);
    if (!currentStatus || !allowedStatuses.has(currentStatus)) {
      return ctx.badRequest('Only FAILED, CANCELLED, QUEUED, or RETRYING mail logs can be sent now');
    }

    const result = await sendMailDirectFromMailLog(Number(mailLog.id), { strapi });

    ctx.body = {
      ok: result.ok,
      data: result,
    };
  },

  async testSend(ctx) {
    const scope = await resolveAccessScope(ctx, [MAIL_MONITOR_KEY]);
    if (!scope) return;

    const payload = ctx.request?.body || {};
    const toEmail = toText(payload.toEmail).toLowerCase();
    const subject = toText(payload.subject) || 'COGI Mail Monitor Test';

    if (!isValidEmail(toEmail)) {
      return ctx.badRequest('A valid toEmail is required');
    }

    const tenantId = scope.isPlatformAdmin
      ? (parseOptionalPositiveInt(payload.tenantId) || scope.filterTenantId || null)
      : Number(scope.tenantId);

    const text = [
      'This is a test email sent from COGI Mail Monitor.',
      `Recipient: ${toEmail}`,
      `Triggered by user: ${scope.user?.id || ''}`,
      `Triggered at: ${new Date().toISOString()}`,
    ].join('\n');

    const html = [
      '<p>This is a <strong>test email</strong> sent from COGI Mail Monitor.</p>',
      `<p>Recipient: <strong>${toEmail}</strong></p>`,
      `<p>Triggered by user: <strong>${scope.user?.id || ''}</strong></p>`,
      `<p>Triggered at: <strong>${new Date().toISOString()}</strong></p>`,
    ].join('');

    const queued = await enqueueMail({
      tenantId,
      mailType: 'mail_monitor_test',
      to: toEmail,
      subject,
      text,
      html,
      metadata: {
        source: 'mail-monitor.test-send',
        isTestMail: true,
        triggeredByUserId: scope.user?.id || null,
        tenantId: tenantId || null,
      },
      jobIdSuffix: String(Date.now()),
    });

    ctx.body = {
      ok: queued?.ok !== false,
      data: queued,
    };
  },
};