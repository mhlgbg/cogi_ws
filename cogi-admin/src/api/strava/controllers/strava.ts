import stravaService from '../services/strava';

function redirectTo(url: string, ctx: any) {
  ctx.status = 302;
  ctx.redirect(url);
}

export default {
  async connectUrl(ctx: any) {
    try {
      const authUser = await stravaService.requireAuthenticatedUser(ctx);
      if (!authUser?.id) return;

      const tenantId = stravaService.getCurrentTenantId(ctx);
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

      const tenantId = stravaService.getCurrentTenantId(ctx);
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
      const tokenResponse = await stravaService.exchangeCodeForToken(code);
      await stravaService.upsertStravaConnection(verified.tenantId, verified.userId, tokenResponse, scope);
      await stravaService.consumeOAuthState(verified.recordId);

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