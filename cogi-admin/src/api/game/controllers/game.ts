import { factories } from '@strapi/strapi';
import { toText } from '../../../utils/tenant-scope';
import {
  createAdminGame,
  getGhostRaceSession,
  getAdminGameDetail,
  getGameCenterGameDetail,
  getGameManagementDashboard,
  getGameManagementErrorStatus,
  listAdminGameParticipants,
  listAdminGames,
  listGameCenterGames,
  listPlatformGameTypes,
  listPlatformTenantGameTypes,
  listTenantGameTypes,
  createGameResetChallenge,
  publishAdminGame,
  resetAdminGame,
  registerCurrentUserForGame,
  startGhostRaceAttempt,
  submitGhostRaceAttempt,
  listMyGhostRaceAttempts,
  getMyGhostRacePersonalBest,
  requireAuthenticatedUser,
  unpublishAdminGame,
  updateAdminGame,
  updateAdminGameRules,
  updatePlatformTenantGameTypeLicense,
  updateTenantGameTypeEnablement,
} from '../services/game-management';
import { dispatchTrustedGameActivity, processGameActivity, XpEngineError } from '../services/xp-engine';

const GAME_UID = 'api::game.game' as never;

function resolveTenantId(ctx: any) {
  return ctx.state?.tenantId ?? ctx.state?.tenant?.id ?? null;
}

function errorBody(status: number, message: string) {
  const name = status === 401
    ? 'UnauthorizedError'
    : status === 403
      ? 'ForbiddenError'
      : status === 404
        ? 'NotFoundError'
        : status === 409
          ? 'ConflictError'
          : 'ApplicationError';

  return {
    data: null,
    error: {
      status,
      name,
      message,
    },
  };
}

export default factories.createCoreController(GAME_UID, () => ({
  async processActivityDev(ctx) {
    if (process.env.NODE_ENV === 'production') {
      return ctx.notFound('Not found');
    }

    const authUser = await requireAuthenticatedUser(ctx);
    if (!authUser) return ctx.unauthorized('Unauthorized');

    try {
      ctx.body = {
        data: await processGameActivity({
          tenantId: resolveTenantId(ctx),
          gameId: ctx.params?.id,
          userId: ctx.request?.body?.data?.userId ?? ctx.request?.body?.userId,
          activityCode: ctx.request?.body?.data?.activityCode ?? ctx.request?.body?.activityCode,
          sourceType: ctx.request?.body?.data?.sourceType ?? ctx.request?.body?.sourceType,
          sourceId: ctx.request?.body?.data?.sourceId ?? ctx.request?.body?.sourceId,
          occurredAt: ctx.request?.body?.data?.occurredAt ?? ctx.request?.body?.occurredAt,
          metadata: ctx.request?.body?.data?.metadata ?? ctx.request?.body?.metadata ?? {},
        }),
      };
    } catch (error: any) {
      const status = error instanceof XpEngineError
        ? error.status
        : getGameManagementErrorStatus(error, 500);
      ctx.status = status;
      ctx.body = errorBody(status, error?.message || 'Failed to process activity');
    }
  },
  async listPlatformGameTypes(ctx) {
    try {
      ctx.body = { data: await listPlatformGameTypes() };
    } catch (error: any) {
      const status = getGameManagementErrorStatus(error, 500);
      ctx.status = status;
      ctx.body = errorBody(status, error?.message || 'Failed to load platform game types');
    }
  },

  async listPlatformTenantGameTypes(ctx) {
    try {
      ctx.body = { data: await listPlatformTenantGameTypes(ctx.params?.tenantId ?? ctx.params?.id) };
    } catch (error: any) {
      const status = getGameManagementErrorStatus(error, 500);
      ctx.status = status;
      ctx.body = errorBody(status, error?.message || 'Failed to load tenant game types');
    }
  },

  async updatePlatformTenantGameTypeLicense(ctx) {
    try {
      ctx.body = {
        data: await updatePlatformTenantGameTypeLicense(
          ctx.params?.tenantId ?? ctx.params?.id,
          ctx.params?.gameTypeId,
          ctx.request?.body?.isLicensed === true,
        ),
      };
    } catch (error: any) {
      const status = getGameManagementErrorStatus(error, 500);
      ctx.status = status;
      ctx.body = errorBody(status, error?.message || 'Failed to update tenant game type license');
    }
  },

  async listTenantGameTypes(ctx) {
    try {
      ctx.body = { data: await listTenantGameTypes(resolveTenantId(ctx)) };
    } catch (error: any) {
      const status = getGameManagementErrorStatus(error, 500);
      ctx.status = status;
      ctx.body = errorBody(status, error?.message || 'Failed to load tenant game types');
    }
  },

  async updateTenantGameTypeEnablement(ctx) {
    try {
      ctx.body = {
        data: await updateTenantGameTypeEnablement(
          resolveTenantId(ctx),
          ctx.params?.gameTypeId,
          ctx.request?.body?.isEnabled === true,
        ),
      };
    } catch (error: any) {
      const status = getGameManagementErrorStatus(error, 500);
      ctx.status = status;
      ctx.body = errorBody(status, error?.message || 'Failed to update tenant game type enablement');
    }
  },

  async dashboard(ctx) {
    try {
      ctx.body = { data: await getGameManagementDashboard(resolveTenantId(ctx)) };
    } catch (error: any) {
      const status = getGameManagementErrorStatus(error, 500);
      ctx.status = status;
      ctx.body = errorBody(status, error?.message || 'Failed to load game dashboard');
    }
  },

  async listAdminGames(ctx) {
    try {
      ctx.body = { data: await listAdminGames(resolveTenantId(ctx)) };
    } catch (error: any) {
      const status = getGameManagementErrorStatus(error, 500);
      ctx.status = status;
      ctx.body = errorBody(status, error?.message || 'Failed to load games');
    }
  },

  async createAdminGame(ctx) {
    const authUser = await requireAuthenticatedUser(ctx);
    if (!authUser) return ctx.unauthorized('Unauthorized');

    try {
      ctx.body = {
        data: await createAdminGame(resolveTenantId(ctx), ctx.request?.body?.data || ctx.request?.body || {}, authUser),
      };
    } catch (error: any) {
      const status = getGameManagementErrorStatus(error, 500);
      ctx.status = status;
      ctx.body = errorBody(status, error?.message || 'Failed to create game');
    }
  },

  async updateAdminGame(ctx) {
    try {
      ctx.body = {
        data: await updateAdminGame(ctx.params?.id, resolveTenantId(ctx), ctx.request?.body?.data || ctx.request?.body || {}),
      };
    } catch (error: any) {
      const status = getGameManagementErrorStatus(error, 500);
      ctx.status = status;
      ctx.body = errorBody(status, error?.message || 'Failed to update game');
    }
  },

  async publishAdminGame(ctx) {
    try {
      ctx.body = { data: await publishAdminGame(ctx.params?.id, resolveTenantId(ctx)) };
    } catch (error: any) {
      const status = getGameManagementErrorStatus(error, 500);
      ctx.status = status;
      ctx.body = errorBody(status, error?.message || 'Failed to publish game');
    }
  },

  async getAdminGameDetail(ctx) {
    try {
      ctx.body = { data: await getAdminGameDetail(ctx.params?.id, resolveTenantId(ctx)) };
    } catch (error: any) {
      const status = getGameManagementErrorStatus(error, 500);
      ctx.status = status;
      ctx.body = errorBody(status, error?.message || 'Failed to load game detail');
    }
  },

  async listAdminGameParticipants(ctx) {
    try {
      ctx.body = { data: await listAdminGameParticipants(ctx.params?.id, resolveTenantId(ctx)) };
    } catch (error: any) {
      const status = getGameManagementErrorStatus(error, 500);
      ctx.status = status;
      ctx.body = errorBody(status, error?.message || 'Failed to load game participants');
    }
  },

  async updateAdminGameRules(ctx) {
    try {
      ctx.body = {
        data: await updateAdminGameRules(ctx.params?.id, resolveTenantId(ctx), ctx.request?.body?.data || ctx.request?.body || {}),
      };
    } catch (error: any) {
      const status = getGameManagementErrorStatus(error, 500);
      ctx.status = status;
      ctx.body = errorBody(status, error?.message || 'Failed to update game rules');
    }
  },

  async unpublishAdminGame(ctx) {
    const authUser = await requireAuthenticatedUser(ctx);
    if (!authUser) return ctx.unauthorized('Unauthorized');

    try {
      ctx.body = {
        data: await unpublishAdminGame(ctx.params?.id, resolveTenantId(ctx), authUser),
      };
    } catch (error: any) {
      const status = getGameManagementErrorStatus(error, 500);
      ctx.status = status;
      ctx.body = errorBody(status, error?.message || 'Failed to unpublish game');
    }
  },

  async createResetChallenge(ctx) {
    const authUser = await requireAuthenticatedUser(ctx);
    if (!authUser) return ctx.unauthorized('Unauthorized');

    try {
      ctx.body = {
        data: await createGameResetChallenge(ctx.params?.id, resolveTenantId(ctx), authUser),
      };
    } catch (error: any) {
      const status = getGameManagementErrorStatus(error, 500);
      ctx.status = status;
      ctx.body = errorBody(status, error?.message || 'Failed to create reset challenge');
    }
  },

  async resetAdminGame(ctx) {
    const authUser = await requireAuthenticatedUser(ctx);
    if (!authUser) return ctx.unauthorized('Unauthorized');

    try {
      ctx.body = {
        data: await resetAdminGame(ctx.params?.id, resolveTenantId(ctx), authUser, ctx.request?.body?.data || ctx.request?.body || {}),
      };
    } catch (error: any) {
      const status = getGameManagementErrorStatus(error, 500);
      ctx.status = status;
      ctx.body = errorBody(status, error?.message || 'Failed to reset game');
    }
  },

  async listGameCenterGames(ctx) {
    const authUser = await requireAuthenticatedUser(ctx);
    if (!authUser) return ctx.unauthorized('Unauthorized');

    try {
      ctx.body = { data: await listGameCenterGames(resolveTenantId(ctx), authUser) };
    } catch (error: any) {
      const status = getGameManagementErrorStatus(error, 500);
      ctx.status = status;
      ctx.body = errorBody(status, error?.message || 'Failed to load Game Center');
    }
  },

  async getGameCenterGameDetail(ctx) {
    const authUser = await requireAuthenticatedUser(ctx);
    if (!authUser) return ctx.unauthorized('Unauthorized');

    try {
      ctx.body = { data: await getGameCenterGameDetail(ctx.params?.id, resolveTenantId(ctx), authUser) };
    } catch (error: any) {
      const status = getGameManagementErrorStatus(error, 500);
      ctx.status = status;
      ctx.body = errorBody(status, error?.message || 'Failed to load Game Center detail');
    }
  },

  async registerCurrentUser(ctx) {
    const authUser = await requireAuthenticatedUser(ctx);
    if (!authUser) return ctx.unauthorized('Unauthorized');

    try {
      ctx.body = { data: await registerCurrentUserForGame(ctx.params?.id, resolveTenantId(ctx), authUser) };
    } catch (error: any) {
      const status = getGameManagementErrorStatus(error, 500);
      ctx.status = status;
      ctx.body = errorBody(status, error?.message || 'Failed to register for game');
    }
  },

  async getGhostRaceSession(ctx) {
    const authUser = await requireAuthenticatedUser(ctx);
    if (!authUser) return ctx.unauthorized('Unauthorized');

    try {
      ctx.body = { data: await getGhostRaceSession(ctx.params?.id, resolveTenantId(ctx), authUser) };
    } catch (error: any) {
      const status = getGameManagementErrorStatus(error, 500);
      ctx.status = status;
      ctx.body = errorBody(status, error?.message || 'Failed to load ghost race session');
    }
  },

  async startGhostRaceAttempt(ctx) {
    const authUser = await requireAuthenticatedUser(ctx);
    if (!authUser) return ctx.unauthorized('Unauthorized');

    try {
      ctx.body = {
        data: await startGhostRaceAttempt(
          ctx.params?.id,
          resolveTenantId(ctx),
          authUser,
          ctx.request?.body?.data || ctx.request?.body || {},
        ),
      };
    } catch (error: any) {
      const status = getGameManagementErrorStatus(error, 500);
      ctx.status = status;
      ctx.body = errorBody(status, error?.message || 'Failed to start ghost race attempt');
    }
  },

  async submitGhostRaceAttempt(ctx) {
    const authUser = await requireAuthenticatedUser(ctx);
    if (!authUser) return ctx.unauthorized('Unauthorized');

    try {
      ctx.body = {
        data: await submitGhostRaceAttempt(
          ctx.params?.id,
          resolveTenantId(ctx),
          authUser,
          ctx.request?.body?.data || ctx.request?.body || {},
        ),
      };
    } catch (error: any) {
      const status = getGameManagementErrorStatus(error, 500);
      ctx.status = status;
      ctx.body = errorBody(status, error?.message || 'Failed to submit ghost race attempt');
    }
  },

  async listMyGhostRaceAttempts(ctx) {
    const authUser = await requireAuthenticatedUser(ctx);
    if (!authUser) return ctx.unauthorized('Unauthorized');

    try {
      ctx.body = { data: await listMyGhostRaceAttempts(ctx.params?.id, resolveTenantId(ctx), authUser) };
    } catch (error: any) {
      const status = getGameManagementErrorStatus(error, 500);
      ctx.status = status;
      ctx.body = errorBody(status, error?.message || 'Failed to load ghost race attempts');
    }
  },

  async getMyGhostRacePersonalBest(ctx) {
    const authUser = await requireAuthenticatedUser(ctx);
    if (!authUser) return ctx.unauthorized('Unauthorized');

    try {
      ctx.body = { data: await getMyGhostRacePersonalBest(ctx.params?.id, resolveTenantId(ctx), authUser) };
    } catch (error: any) {
      const status = getGameManagementErrorStatus(error, 500);
      ctx.status = status;
      ctx.body = errorBody(status, error?.message || 'Failed to load ghost race personal best');
    }
  },

  async signalDailyActive(ctx) {
    const authUser = await requireAuthenticatedUser(ctx);
    if (!authUser) return ctx.unauthorized('Unauthorized');

    try {
      ctx.body = {
        data: await dispatchTrustedGameActivity({
          tenantId: resolveTenantId(ctx),
          userId: authUser.id,
          activityCode: 'daily_active',
          occurredAt: new Date(),
          metadata: {
            signalSource: toText(ctx.request?.body?.signalSource) || 'app',
            occurredAtTrusted: true,
            internalTrusted: true,
          },
        }),
      };
    } catch (error: any) {
      const status = error instanceof XpEngineError
        ? error.status
        : getGameManagementErrorStatus(error, 500);
      ctx.status = status;
      ctx.body = errorBody(status, error?.message || 'Failed to record daily activity');
    }
  },
}));
