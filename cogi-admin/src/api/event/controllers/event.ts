import {
  cancelRegistration,
  cancelRegistrationById,
  createEvent,
  getEventDetail,
  getEventStats,
  getMyRegistration,
  listEvents,
  listRegistrations,
  registerForEvent,
  updateEvent,
  updateRegistrationSettings,
} from '../services/event';
import { resolveCurrentTenantId, toText } from '../../../utils/tenant-scope';

async function resolveAuthenticatedUser(ctx: any) {
  const stateUser = ctx.state?.user;
  if (stateUser?.id) {
    return stateUser;
  }

  const authHeader = ctx.request?.headers?.authorization || ctx.request?.header?.authorization || '';
  const token = typeof authHeader === 'string' && authHeader.startsWith('Bearer ')
    ? authHeader.slice(7).trim()
    : '';

  if (!token) {
    return null;
  }

  try {
    const jwtService = strapi.plugin('users-permissions')?.service('jwt');
    if (!jwtService) {
      return null;
    }

    const decoded = await jwtService.verify(token);
    const userId = Number(decoded?.id || 0);
    if (!userId) {
      return null;
    }

    const user = await strapi.db.query('plugin::users-permissions.user').findOne({
      where: { id: userId },
      select: ['id', 'email', 'username', 'firstName', 'lastName', 'blocked'],
    });

    if (!user || user.blocked) {
      return null;
    }

    ctx.state.user = user;
    return user;
  } catch {
    return null;
  }
}

function extractPayload(ctx: any) {
  const body = ctx.request?.body;
  if (body && typeof body === 'object' && !Array.isArray(body)) {
    if (body.data && typeof body.data === 'object' && !Array.isArray(body.data)) {
      return body.data as Record<string, unknown>;
    }
    return body as Record<string, unknown>;
  }
  return {} as Record<string, unknown>;
}

export default {
  async listEvents(ctx: any) {
    try {
      const tenantId = resolveCurrentTenantId(ctx);
      const result = await listEvents(tenantId, {
        page: ctx.query?.page,
        pageSize: ctx.query?.pageSize,
        status: ctx.query?.status,
        search: ctx.query?.search,
        sort: ctx.query?.sort,
      });
      ctx.body = result;
    } catch (error: any) {
      ctx.status = error?.status || 500;
      ctx.body = { ok: false, message: error?.message || 'Unknown error' };
    }
  },

  async getEvent(ctx: any) {
    try {
      const tenantId = resolveCurrentTenantId(ctx);
      const result = await getEventDetail(tenantId, ctx.params?.id);
      ctx.body = result;
    } catch (error: any) {
      ctx.status = error?.status || 500;
      ctx.body = { ok: false, message: error?.message || 'Unknown error' };
    }
  },

  async createEvent(ctx: any) {
    try {
      const tenantId = resolveCurrentTenantId(ctx);
      const result = await createEvent(tenantId, extractPayload(ctx));
      ctx.body = result;
    } catch (error: any) {
      ctx.status = error?.status || 500;
      ctx.body = { ok: false, message: error?.message || 'Unknown error' };
    }
  },

  async updateEvent(ctx: any) {
    try {
      const tenantId = resolveCurrentTenantId(ctx);
      const result = await updateEvent(tenantId, ctx.params?.id, extractPayload(ctx));
      ctx.body = result;
    } catch (error: any) {
      ctx.status = error?.status || 500;
      ctx.body = { ok: false, message: error?.message || 'Unknown error' };
    }
  },

  async updateRegistrationSettings(ctx: any) {
    try {
      const tenantId = resolveCurrentTenantId(ctx);
      const result = await updateRegistrationSettings(tenantId, ctx.params?.id, extractPayload(ctx));
      ctx.body = result;
    } catch (error: any) {
      ctx.status = error?.status || 500;
      ctx.body = { ok: false, message: error?.message || 'Unknown error' };
    }
  },

  async listRegistrations(ctx: any) {
    try {
      const tenantId = resolveCurrentTenantId(ctx);
      const result = await listRegistrations(tenantId, ctx.params?.id, {
        status: ctx.query?.status,
        search: ctx.query?.search,
      });
      ctx.body = result;
    } catch (error: any) {
      ctx.status = error?.status || 500;
      ctx.body = { ok: false, message: error?.message || 'Unknown error' };
    }
  },

  async getStats(ctx: any) {
    try {
      const tenantId = resolveCurrentTenantId(ctx);
      const result = await getEventStats(tenantId, ctx.params?.id);
      ctx.body = result;
    } catch (error: any) {
      ctx.status = error?.status || 500;
      ctx.body = { ok: false, message: error?.message || 'Unknown error' };
    }
  },

  async registerForEvent(ctx: any) {
    try {
      const tenantId = resolveCurrentTenantId(ctx);
      const user = await resolveAuthenticatedUser(ctx);
      const result = await registerForEvent(tenantId, ctx.params?.id, user, extractPayload(ctx));
      ctx.body = result;
    } catch (error: any) {
      ctx.status = error?.status || 500;
      ctx.body = { ok: false, message: error?.message || 'Unknown error' };
    }
  },

  async getMyRegistration(ctx: any) {
    try {
      const tenantId = resolveCurrentTenantId(ctx);
      const user = await resolveAuthenticatedUser(ctx);
      const result = await getMyRegistration(tenantId, ctx.params?.id, user);
      ctx.body = result;
    } catch (error: any) {
      ctx.status = error?.status || 500;
      ctx.body = { ok: false, message: error?.message || 'Unknown error' };
    }
  },

  async cancelRegistration(ctx: any) {
    try {
      const tenantId = resolveCurrentTenantId(ctx);
      const user = await resolveAuthenticatedUser(ctx);
      const result = await cancelRegistration(tenantId, ctx.params?.id, user, extractPayload(ctx));
      ctx.body = result;
    } catch (error: any) {
      ctx.status = error?.status || 500;
      ctx.body = { ok: false, message: error?.message || 'Unknown error' };
    }
  },

  async cancelRegistrationById(ctx: any) {
    try {
      const tenantId = resolveCurrentTenantId(ctx);
      const user = await resolveAuthenticatedUser(ctx);
      const result = await cancelRegistrationById(tenantId, ctx.params?.id, user);
      ctx.body = result;
    } catch (error: any) {
      ctx.status = error?.status || 500;
      ctx.body = { ok: false, message: error?.message || 'Unknown error' };
    }
  },
};
