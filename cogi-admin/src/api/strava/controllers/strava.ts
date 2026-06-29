import stravaService from '../services/strava';

function redirectTo(url: string, ctx: any) {
  ctx.status = 302;
  ctx.redirect(url);
}

export default {
  async connect(ctx: any) {
    try {
      const authUser = await stravaService.requireAuthenticatedUser(ctx);
      if (!authUser?.id) return;

      const tenantId = stravaService.getCurrentTenantId(ctx);
      const state = await stravaService.createSignedOAuthState(tenantId, authUser.id);
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

    if (callbackError) {
      return redirectTo(stravaService.buildFrontendErrorRedirect('strava_callback_failed'), ctx);
    }

    try {
      const state = stravaService.toText(query.state);
      const code = stravaService.toText(query.code);
      const scope = stravaService.toText(query.scope);

      if (!state || !code) {
        return redirectTo(stravaService.buildFrontendErrorRedirect('strava_callback_failed'), ctx);
      }

      const verified = await stravaService.verifySignedOAuthState(state);
      await stravaService.consumeOAuthState(verified.recordId);
      const tokenResponse = await stravaService.exchangeCodeForToken(code);
      await stravaService.upsertStravaConnection(verified.tenantId, verified.userId, tokenResponse, scope);

      return redirectTo(stravaService.buildFrontendSuccessRedirect(), ctx);
    } catch (error: any) {
      strapi.log.error('[strava.callback] unexpected error', {
        message: error?.message || 'unknown error',
        status: error?.status || 500,
      });
      return redirectTo(stravaService.buildFrontendErrorRedirect('strava_callback_failed'), ctx);
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