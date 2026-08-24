import stravaService from '../services/strava';

function redirectTo(url: string, ctx: any) {
  ctx.status = 302;
  ctx.redirect(url);
}

type QueryStringReadResult = {
  kind: 'missing' | 'string' | 'invalid';
  value: string | null;
};

function readSingleQueryString(ctx: any, key: string): QueryStringReadResult {
  const value = ctx?.query?.[key] ?? ctx?.request?.query?.[key];

  if (typeof value === 'undefined') {
    return { kind: 'missing', value: null };
  }

  if (typeof value === 'string') {
    return { kind: 'string', value };
  }

  return { kind: 'invalid', value: null };
}

export default {
  async connectUrl(ctx: any) {
    try {
      const authUser = await stravaService.requireAuthenticatedUser(ctx);
      if (!authUser?.id) return;

      const tenantId = await stravaService.resolveTenantIdForStravaOAuthStart(ctx);
      const frontendOrigin = await stravaService.resolveTrustedFrontendOriginForOAuthStart(ctx, tenantId);
      const state = await stravaService.createSignedOAuthState(tenantId, authUser.id, { frontendOrigin });
      const authorizeUrl = stravaService.buildStravaAuthorizeUrl(state);

      ctx.body = {
        url: authorizeUrl,
      };
      return;
    } catch (error: any) {
      if (error?.status === 400) return ctx.badRequest(error.message);
      if (error?.status === 401) return ctx.unauthorized(error.message);
      if (error?.status === 403) return ctx.forbidden(error.message);

      strapi.log.error('[strava.connect-url] unexpected error', error);
      return ctx.internalServerError('Failed to start Strava connection');
    }
  },

  async connect(ctx: any) {
    try {
      const authUser = await stravaService.requireAuthenticatedUser(ctx);
      if (!authUser?.id) return;

      const tenantId = await stravaService.resolveTenantIdForStravaOAuthStart(ctx);
      const frontendOrigin = await stravaService.resolveTrustedFrontendOriginForOAuthStart(ctx, tenantId);
      const state = await stravaService.createSignedOAuthState(tenantId, authUser.id, { frontendOrigin });
      const authorizeUrl = stravaService.buildStravaAuthorizeUrl(state);

      return redirectTo(authorizeUrl, ctx);
    } catch (error: any) {
      strapi.log.error('[strava.connect] unexpected error', error);
      return ctx.internalServerError('Failed to start Strava connection');
    }
  },

  async callback(ctx: any) {
    const query = ctx.request?.query || {};
    const callbackError = stravaService.toText(query.error);
    const state = stravaService.toText(query.state);

    if (callbackError) {
      return redirectTo(await stravaService.buildFrontendErrorRedirect({ state, reason: 'strava_callback_failed' }), ctx);
    }

    try {
      const code = stravaService.toText(query.code);
      const scope = stravaService.toText(query.scope);

      if (!state || !code) {
        return redirectTo(await stravaService.buildFrontendErrorRedirect({ state, reason: 'strava_callback_failed' }), ctx);
      }

      const verified = await stravaService.verifySignedOAuthState(state);
      const autoSyncContext = await stravaService.getOAuthCallbackAutoSyncContext(verified.tenantId, verified.userId);
      const tokenResponse = await stravaService.exchangeCodeForToken(code);
      await stravaService.upsertStravaConnection(verified.tenantId, verified.userId, tokenResponse, scope, {
        resetActivityDeleteMarkers: autoSyncContext.shouldResetActivityDeleteMarkers,
      });
      await stravaService.consumeOAuthState(verified.recordId);

      if (autoSyncContext.shouldAutoStartSync) {
        try {
          const syncResult = await stravaService.startCurrentUserStravaSync(verified.tenantId, verified.userId);
          strapi.log.info('[strava.callback] auto sync queued', {
            tenantId: String(verified.tenantId),
            userId: verified.userId,
            reason: autoSyncContext.reason,
            created: syncResult.created === true,
            alreadyRunning: syncResult.alreadyRunning === true,
            jobId: Number(syncResult.job?.id || 0) || null,
          });
        } catch (error: any) {
          const classified = stravaService.classifyStravaSyncError(error);
          strapi.log.warn('[strava.callback] auto sync start failed', {
            tenantId: String(verified.tenantId),
            userId: verified.userId,
            reason: autoSyncContext.reason,
            code: classified.code,
            message: classified.message,
            status: classified.httpStatus,
          });
        }
      }

      return redirectTo(await stravaService.buildFrontendSuccessRedirect({
        tenantId: verified.tenantId,
        frontendOrigin: verified.frontendOrigin || null,
      }), ctx);
    } catch (error: any) {
      strapi.log.error('[strava.callback] unexpected error', {
        message: error?.message || 'unknown error',
        status: error?.status || 500,
      });
      return redirectTo(await stravaService.buildFrontendErrorRedirect({ state, reason: 'strava_callback_failed' }), ctx);
    }
  },

  async webhookVerify(ctx: any) {
    const mode = readSingleQueryString(ctx, 'hub.mode');
    if (mode.kind !== 'string' || mode.value !== 'subscribe') {
      strapi.log.info('[strava.webhookVerify] verification rejected: invalid mode');
      ctx.status = 400;
      ctx.body = { error: 'Invalid webhook verification mode' };
      return;
    }

    const challenge = readSingleQueryString(ctx, 'hub.challenge');
    if (challenge.kind !== 'string' || !challenge.value || !challenge.value.trim()) {
      strapi.log.info('[strava.webhookVerify] verification rejected: missing challenge');
      ctx.status = 400;
      ctx.body = { error: 'Missing webhook challenge' };
      return;
    }

    const verifyToken = readSingleQueryString(ctx, 'hub.verify_token');
    if (verifyToken.kind === 'invalid') {
      strapi.log.info('[strava.webhookVerify] verification rejected: invalid verify token query');
      ctx.status = 400;
      ctx.body = { error: 'Invalid webhook verify token' };
      return;
    }

    if (verifyToken.kind !== 'string' || !verifyToken.value) {
      strapi.log.info('[strava.webhookVerify] verification rejected: missing verify token');
      ctx.status = 403;
      ctx.body = { error: 'Invalid webhook verify token' };
      return;
    }

    strapi.log.info('[strava.webhookVerify] verification request received');

    try {
      const verified = stravaService.verifyStravaWebhookSubscription({
        mode: mode.value,
        verifyToken: verifyToken.value,
        challenge: challenge.value,
      });

      strapi.log.info('[strava.webhookVerify] verification succeeded');
      ctx.status = 200;
      ctx.body = {
        'hub.challenge': verified.challenge,
      };
    } catch (error: any) {
      if (error?.status === 503) {
        strapi.log.warn('[strava.webhookVerify] verification requested but verify token is not configured');
        ctx.status = 503;
        ctx.body = { error: 'Strava webhook verification is not configured' };
        return;
      }

      if (error?.status === 403) {
        strapi.log.info('[strava.webhookVerify] verification rejected: invalid token');
        ctx.status = 403;
        ctx.body = { error: 'Invalid webhook verify token' };
        return;
      }

      strapi.log.error('[strava.webhookVerify] unexpected error', error);
      ctx.internalServerError('Failed to verify Strava webhook');
    }
  },

  async webhookReceive(ctx: any) {
    const payload = ctx.request?.body;

    if (typeof payload === 'undefined') {
      strapi.log.info('[strava.webhookReceive] invalid json');
      ctx.status = 400;
      ctx.body = { error: 'Invalid JSON body' };
      return;
    }

    strapi.log.info('[strava.webhookReceive] event received');

    try {
      const result = await stravaService.receiveStravaWebhookEvent(payload);
      ctx.status = 200;
      ctx.body = result.duplicate
        ? { received: true, duplicate: true }
        : { received: true };
      return;
    } catch (error: any) {
      if (error?.status === 400) {
        strapi.log.info('[strava.webhookReceive] invalid json');
        ctx.status = 400;
        ctx.body = { error: 'Invalid JSON body' };
        return;
      }

      strapi.log.error('[strava.webhookReceive] unexpected error', error);
      ctx.internalServerError('Failed to receive Strava webhook');
    }
  },

  async subscriptionOverview(ctx: any) {
    try {
      const [health, subscriptions] = await Promise.all([
        stravaService.checkWebhookHealth(),
        stravaService.listWebhookSubscriptions(),
      ]);

      ctx.body = {
        health,
        subscriptions,
      };
    } catch (error: any) {
      const code = stravaService.toText(error?.code) || 'STRAVA_SUBSCRIPTION_LIST_FAILED';
      const message = stravaService.toText(error?.message) || 'Không thể tải Strava webhook subscription.';
      ctx.status = Number(error?.status || 500) || 500;
      ctx.body = { error: { code, message } };
    }
  },

  async createSubscription(ctx: any) {
    try {
      const result = await stravaService.createWebhookSubscription();
      const health = await stravaService.checkWebhookHealth();
      ctx.status = result.existed ? 200 : 201;
      ctx.body = {
        health,
        subscription: result.subscription,
        existed: result.existed,
      };
    } catch (error: any) {
      const code = stravaService.toText(error?.code) || 'STRAVA_SUBSCRIPTION_CREATE_FAILED';
      const message = stravaService.toText(error?.message) || 'Không thể tạo Strava webhook subscription.';
      ctx.status = Number(error?.status || 500) || 500;
      ctx.body = { error: { code, message } };
    }
  },

  async deleteSubscription(ctx: any) {
    try {
      const result = await stravaService.deleteWebhookSubscription(ctx.params?.id);
      ctx.body = {
        deleted: result.deleted,
      };
    } catch (error: any) {
      const code = stravaService.toText(error?.code) || 'STRAVA_SUBSCRIPTION_DELETE_FAILED';
      const message = stravaService.toText(error?.message) || 'Không thể xóa Strava webhook subscription.';
      ctx.status = Number(error?.status || 500) || 500;
      ctx.body = { error: { code, message } };
    }
  },

  async deleteAllSubscriptions(ctx: any) {
    try {
      const result = await stravaService.deleteAllWebhookSubscriptions();
      ctx.body = result;
    } catch (error: any) {
      const code = stravaService.toText(error?.code) || 'STRAVA_SUBSCRIPTION_DELETE_FAILED';
      const message = stravaService.toText(error?.message) || 'Không thể xóa Strava webhook subscriptions.';
      ctx.status = Number(error?.status || 500) || 500;
      ctx.body = { error: { code, message } };
    }
  },

  async status(ctx: any) {
    try {
      const authUser = await stravaService.requireAuthenticatedUser(ctx);
      if (!authUser?.id) return;

      const tenantId = stravaService.getCurrentTenantId(ctx);
      const data = await stravaService.getCurrentUserStravaStatus(tenantId, authUser.id);
      ctx.body = data;
    } catch (error: any) {
      if (error?.status === 400) return ctx.badRequest(error.message);
      if (error?.status === 401) return ctx.unauthorized(error.message);
      if (error?.status === 403) return ctx.forbidden(error.message);

      strapi.log.error('[strava.status] unexpected error', error);
      return ctx.internalServerError('Failed to load Strava status');
    }
  },

  async sync(ctx: any) {
    try {
      const authUser = await stravaService.requireAuthenticatedUser(ctx);
      if (!authUser?.id) return;

      const tenantId = stravaService.getCurrentTenantId(ctx);
      const result = await stravaService.startCurrentUserStravaSync(tenantId, authUser.id);
      ctx.status = result.created ? 202 : 200;
      ctx.body = {
        data: {
          ...stravaService.serializeStravaSyncJob(result.job),
          alreadyRunning: result.alreadyRunning === true,
          message: result.alreadyRunning === true
            ? 'Đồng bộ Strava đang được xử lý.'
            : 'Đã đưa yêu cầu đồng bộ vào hàng đợi.',
          async: true,
        },
      };
    } catch (error: any) {
      const code = stravaService.toText(error?.code);
      const message = stravaService.toText(error?.message) || 'Không thể khởi tạo đồng bộ Strava.';
      if (error?.status === 400) { ctx.status = 400; ctx.body = { error: { code: code || 'STRAVA_NOT_CONNECTED', message } }; return; }
      if (error?.status === 401) { ctx.status = 401; ctx.body = { error: { code: code || 'UNAUTHORIZED', message } }; return; }
      if (error?.status === 403) { ctx.status = 403; ctx.body = { error: { code: code || 'FORBIDDEN', message } }; return; }
      if (error?.status === 409) { ctx.status = 409; ctx.body = { error: { code: code || 'STRAVA_SYNC_ALREADY_RUNNING', message } }; return; }
      if (error?.status === 429) { ctx.status = 429; ctx.body = { error: { code: code || 'STRAVA_SYNC_START_FAILED', message } }; return; }

      strapi.log.error('[strava.sync] unexpected error', { message: error?.message || 'unknown error', status: error?.status || 500 });
      ctx.status = 500;
      ctx.body = { error: { code: code || 'STRAVA_SYNC_START_FAILED', message: 'Không thể khởi tạo đồng bộ Strava.' } };
      return;
    }
  },

  async syncCurrent(ctx: any) {
    try {
      const authUser = await stravaService.requireAuthenticatedUser(ctx);
      if (!authUser?.id) return;

      const tenantId = stravaService.getCurrentTenantId(ctx);
      const job = await stravaService.getCurrentUserStravaSyncJob(tenantId, authUser.id);
      ctx.body = {
        data: job ? stravaService.serializeStravaSyncJob(job) : null,
      };
    } catch (error: any) {
      const code = stravaService.toText(error?.code);
      const message = stravaService.toText(error?.message) || 'Không thể tải trạng thái đồng bộ Strava.';
      if (error?.status === 400) { ctx.status = 400; ctx.body = { error: { code: code || 'STRAVA_SYNC_JOB_NOT_FOUND', message } }; return; }
      if (error?.status === 401) { ctx.status = 401; ctx.body = { error: { code: code || 'UNAUTHORIZED', message } }; return; }
      if (error?.status === 403) { ctx.status = 403; ctx.body = { error: { code: code || 'FORBIDDEN', message } }; return; }
      strapi.log.error('[strava.syncCurrent] unexpected error', { message: error?.message || 'unknown error', status: error?.status || 500 });
      ctx.status = 500;
      ctx.body = { error: { code: code || 'STRAVA_SYNC_JOB_NOT_FOUND', message: 'Không thể tải trạng thái đồng bộ Strava.' } };
    }
  },

  async syncJobDetail(ctx: any) {
    try {
      const authUser = await stravaService.requireAuthenticatedUser(ctx);
      if (!authUser?.id) return;

      const tenantId = stravaService.getCurrentTenantId(ctx);
      const jobId = Number(ctx.params?.id || 0);
      const job = await stravaService.getCurrentUserStravaSyncJobDetail(tenantId, authUser.id, jobId);
      ctx.body = {
        data: stravaService.serializeStravaSyncJob(job),
      };
    } catch (error: any) {
      const code = stravaService.toText(error?.code);
      const message = stravaService.toText(error?.message) || 'Không thể tải job đồng bộ Strava.';
      if (error?.status === 400) { ctx.status = 400; ctx.body = { error: { code: code || 'STRAVA_SYNC_JOB_NOT_FOUND', message } }; return; }
      if (error?.status === 401) { ctx.status = 401; ctx.body = { error: { code: code || 'UNAUTHORIZED', message } }; return; }
      if (error?.status === 403) { ctx.status = 403; ctx.body = { error: { code: code || 'STRAVA_SYNC_JOB_FORBIDDEN', message } }; return; }
      if (error?.status === 404) { ctx.status = 404; ctx.body = { error: { code: code || 'STRAVA_SYNC_JOB_NOT_FOUND', message } }; return; }
      strapi.log.error('[strava.syncJobDetail] unexpected error', { message: error?.message || 'unknown error', status: error?.status || 500 });
      ctx.status = 500;
      ctx.body = { error: { code: code || 'STRAVA_SYNC_JOB_NOT_FOUND', message: 'Không thể tải job đồng bộ Strava.' } };
    }
  },

  async retrySyncJob(ctx: any) {
    try {
      const authUser = await stravaService.requireAuthenticatedUser(ctx);
      if (!authUser?.id) return;

      const tenantId = stravaService.getCurrentTenantId(ctx);
      const jobId = Number(ctx.params?.id || 0);
      const result = await stravaService.retryCurrentUserStravaSyncJob(tenantId, authUser.id, jobId);
      ctx.status = result.created ? 202 : 200;
      ctx.body = {
        data: {
          ...stravaService.serializeStravaSyncJob(result.job),
          alreadyRunning: result.alreadyRunning === true,
          message: result.alreadyRunning === true
            ? 'Đồng bộ Strava đang được xử lý.'
            : 'Đã đưa yêu cầu retry đồng bộ vào hàng đợi.',
          async: true,
        },
      };
    } catch (error: any) {
      const code = stravaService.toText(error?.code);
      const message = stravaService.toText(error?.message) || 'Không thể retry job đồng bộ Strava.';
      if (error?.status === 400) { ctx.status = 400; ctx.body = { error: { code: code || 'STRAVA_SYNC_RETRY_FAILED', message } }; return; }
      if (error?.status === 401) { ctx.status = 401; ctx.body = { error: { code: code || 'UNAUTHORIZED', message } }; return; }
      if (error?.status === 403) { ctx.status = 403; ctx.body = { error: { code: code || 'FORBIDDEN', message } }; return; }
      if (error?.status === 404) { ctx.status = 404; ctx.body = { error: { code: code || 'STRAVA_SYNC_JOB_NOT_FOUND', message } }; return; }
      if (error?.status === 409) { ctx.status = 409; ctx.body = { error: { code: code || 'STRAVA_SYNC_JOB_NOT_RETRYABLE', message } }; return; }
      strapi.log.error('[strava.retrySyncJob] unexpected error', { message: error?.message || 'unknown error', status: error?.status || 500 });
      ctx.status = 500;
      ctx.body = { error: { code: code || 'STRAVA_SYNC_RETRY_FAILED', message: 'Không thể retry job đồng bộ Strava.' } };
    }
  },

  async cancelSyncJob(ctx: any) {
    try {
      const authUser = await stravaService.requireAuthenticatedUser(ctx);
      if (!authUser?.id) return;

      const tenantId = stravaService.getCurrentTenantId(ctx);
      const jobId = Number(ctx.params?.id || 0);
      const job = await stravaService.cancelCurrentUserStravaSyncJob(tenantId, authUser.id, jobId);
      ctx.body = {
        data: {
          ...stravaService.serializeStravaSyncJob(job),
          message: 'Đã hủy đồng bộ.',
        },
      };
    } catch (error: any) {
      const code = stravaService.toText(error?.code);
      const message = stravaService.toText(error?.message) || 'Không thể hủy job đồng bộ Strava.';
      if (error?.status === 400) { ctx.status = 400; ctx.body = { error: { code: code || 'STRAVA_SYNC_CANCEL_FAILED', message } }; return; }
      if (error?.status === 401) { ctx.status = 401; ctx.body = { error: { code: code || 'UNAUTHORIZED', message } }; return; }
      if (error?.status === 403) { ctx.status = 403; ctx.body = { error: { code: code || 'FORBIDDEN', message } }; return; }
      if (error?.status === 404) { ctx.status = 404; ctx.body = { error: { code: code || 'STRAVA_SYNC_JOB_NOT_FOUND', message } }; return; }
      if (error?.status === 409) { ctx.status = 409; ctx.body = { error: { code: code || 'STRAVA_SYNC_JOB_NOT_CANCELLABLE', message } }; return; }
      strapi.log.error('[strava.cancelSyncJob] unexpected error', { message: error?.message || 'unknown error', status: error?.status || 500 });
      ctx.status = 500;
      ctx.body = { error: { code: code || 'STRAVA_SYNC_CANCEL_FAILED', message: 'Không thể hủy job đồng bộ Strava.' } };
    }
  },

  async activities(ctx: any) {
    try {
      const authUser = await stravaService.requireAuthenticatedUser(ctx);
      if (!authUser?.id) return;

      const tenantId = stravaService.getCurrentTenantId(ctx);
      const data = await stravaService.listCurrentUserActivities(tenantId, authUser.id, ctx.request?.query || {});
      ctx.body = data;
    } catch (error: any) {
      if (error?.status === 400) return ctx.badRequest(error.message);
      if (error?.status === 401) return ctx.unauthorized(error.message);
      if (error?.status === 403) return ctx.forbidden(error.message);

      strapi.log.error('[strava.activities] unexpected error', error);
      return ctx.internalServerError('Failed to load Strava activities');
    }
  },

  async summary(ctx: any) {
    try {
      const authUser = await stravaService.requireAuthenticatedUser(ctx);
      if (!authUser?.id) return;

      const tenantId = stravaService.getCurrentTenantId(ctx);
      const data = await stravaService.getCurrentUserActivitySummary(tenantId, authUser.id);
      ctx.body = data;
    } catch (error: any) {
      if (error?.status === 400) return ctx.badRequest(error.message);
      if (error?.status === 401) return ctx.unauthorized(error.message);
      if (error?.status === 403) return ctx.forbidden(error.message);

      strapi.log.error('[strava.summary] unexpected error', error);
      return ctx.internalServerError('Failed to load Strava summary');
    }
  },

  async analyticsOverview(ctx: any) {
    try {
      const authUser = await stravaService.requireAuthenticatedUser(ctx);
      if (!authUser?.id) return;

      const tenantId = stravaService.getCurrentTenantId(ctx);
      const data = await stravaService.getCurrentUserAnalyticsOverview(tenantId, authUser.id);
      ctx.body = data;
    } catch (error: any) {
      if (error?.status === 400) return ctx.badRequest(error.message);
      if (error?.status === 401) return ctx.unauthorized(error.message);
      if (error?.status === 403) return ctx.forbidden(error.message);

      strapi.log.error('[strava.analyticsOverview] unexpected error', error);
      return ctx.internalServerError('Failed to load Strava analytics overview');
    }
  },

  async analyticsTrends(ctx: any) {
    try {
      const authUser = await stravaService.requireAuthenticatedUser(ctx);
      if (!authUser?.id) return;

      const tenantId = stravaService.getCurrentTenantId(ctx);
      const data = await stravaService.getCurrentUserAnalyticsTrends(tenantId, authUser.id, ctx.request?.query || {});
      ctx.body = data;
    } catch (error: any) {
      if (error?.status === 400) return ctx.badRequest(error.message);
      if (error?.status === 401) return ctx.unauthorized(error.message);
      if (error?.status === 403) return ctx.forbidden(error.message);

      strapi.log.error('[strava.analyticsTrends] unexpected error', error);
      return ctx.internalServerError('Failed to load Strava analytics trends');
    }
  },

  async analyticsYearly(ctx: any) {
    try {
      const authUser = await stravaService.requireAuthenticatedUser(ctx);
      if (!authUser?.id) return;

      const tenantId = stravaService.getCurrentTenantId(ctx);
      const data = await stravaService.getCurrentUserAnalyticsYearly(tenantId, authUser.id);
      ctx.body = data;
    } catch (error: any) {
      if (error?.status === 400) return ctx.badRequest(error.message);
      if (error?.status === 401) return ctx.unauthorized(error.message);
      if (error?.status === 403) return ctx.forbidden(error.message);

      strapi.log.error('[strava.analyticsYearly] unexpected error', error);
      return ctx.internalServerError('Failed to load Strava analytics yearly');
    }
  },

  async analyticsInsights(ctx: any) {
    try {
      const authUser = await stravaService.requireAuthenticatedUser(ctx);
      if (!authUser?.id) return;

      const tenantId = stravaService.getCurrentTenantId(ctx);
      const data = await stravaService.getCurrentUserAnalyticsInsights(tenantId, authUser.id, ctx.request?.query || {});
      ctx.body = data;
    } catch (error: any) {
      if (error?.status === 400) return ctx.badRequest(error.message);
      if (error?.status === 401) return ctx.unauthorized(error.message);
      if (error?.status === 403) return ctx.forbidden(error.message);

      strapi.log.error('[strava.analyticsInsights] unexpected error', error);
      return ctx.internalServerError('Failed to load Strava analytics insights');
    }
  },

  async analyticsRecords(ctx: any) {
    try {
      const authUser = await stravaService.requireAuthenticatedUser(ctx);
      if (!authUser?.id) return;

      const tenantId = stravaService.getCurrentTenantId(ctx);
      const data = await stravaService.getCurrentUserAnalyticsRecords(tenantId, authUser.id, ctx.request?.query || {});
      ctx.body = data;
    } catch (error: any) {
      if (error?.status === 400) return ctx.badRequest(error.message);
      if (error?.status === 401) return ctx.unauthorized(error.message);
      if (error?.status === 403) return ctx.forbidden(error.message);

      strapi.log.error('[strava.analyticsRecords] unexpected error', error);
      return ctx.internalServerError('Failed to load Strava analytics records');
    }
  },

  async analyticsTopActivities(ctx: any) {
    try {
      const authUser = await stravaService.requireAuthenticatedUser(ctx);
      if (!authUser?.id) return;

      const tenantId = stravaService.getCurrentTenantId(ctx);
      const data = await stravaService.getCurrentUserTopActivities(tenantId, authUser.id, ctx.request?.query || {});
      ctx.body = data;
    } catch (error: any) {
      if (error?.status === 400) return ctx.badRequest(error.message);
      if (error?.status === 401) return ctx.unauthorized(error.message);
      if (error?.status === 403) return ctx.forbidden(error.message);

      strapi.log.error('[strava.analyticsTopActivities] unexpected error', error);
      return ctx.internalServerError('Failed to load Strava top activities');
    }
  },

  async analyticsYearlyRecords(ctx: any) {
    try {
      const authUser = await stravaService.requireAuthenticatedUser(ctx);
      if (!authUser?.id) return;

      const tenantId = stravaService.getCurrentTenantId(ctx);
      const data = await stravaService.getCurrentUserYearlyRecords(tenantId, authUser.id);
      ctx.body = data;
    } catch (error: any) {
      if (error?.status === 400) return ctx.badRequest(error.message);
      if (error?.status === 401) return ctx.unauthorized(error.message);
      if (error?.status === 403) return ctx.forbidden(error.message);

      strapi.log.error('[strava.analyticsYearlyRecords] unexpected error', error);
      return ctx.internalServerError('Failed to load Strava yearly records');
    }
  },

  async analyticsMilestones(ctx: any) {
    try {
      const authUser = await stravaService.requireAuthenticatedUser(ctx);
      if (!authUser?.id) return;

      const tenantId = stravaService.getCurrentTenantId(ctx);
      const data = await stravaService.getCurrentUserMilestones(tenantId, authUser.id);
      ctx.body = data;
    } catch (error: any) {
      if (error?.status === 400) return ctx.badRequest(error.message);
      if (error?.status === 401) return ctx.unauthorized(error.message);
      if (error?.status === 403) return ctx.forbidden(error.message);

      strapi.log.error('[strava.analyticsMilestones] unexpected error', error);
      return ctx.internalServerError('Failed to load Strava milestones');
    }
  },

  async disconnect(ctx: any) {
    try {
      const authUser = await stravaService.requireAuthenticatedUser(ctx);
      if (!authUser?.id) return;

      const tenantId = stravaService.getCurrentTenantId(ctx);
      const data = await stravaService.disconnectCurrentUser(tenantId, authUser.id);
      ctx.body = data;
    } catch (error: any) {
      if (error?.status === 400) return ctx.badRequest(error.message);
      if (error?.status === 401) return ctx.unauthorized(error.message);
      if (error?.status === 403) return ctx.forbidden(error.message);

      strapi.log.error('[strava.disconnect] unexpected error', error);
      return ctx.internalServerError('Failed to disconnect Strava');
    }
  },
};