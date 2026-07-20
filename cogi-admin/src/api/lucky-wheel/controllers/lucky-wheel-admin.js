import { toText } from '../../../utils/tenant-scope';

async function resolveUserFromJwt(ctx) {
  try {
    const authHeader = ctx.request?.headers?.authorization || ctx.request?.header?.authorization || '';
    const token = typeof authHeader === 'string' && authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
    if (!token) return null;
    const jwtService = strapi.plugin('users-permissions')?.service('jwt');
    if (!jwtService) return null;
    const decoded = await jwtService.verify(token);
    const userId = Number(decoded?.id);
    if (!Number.isInteger(userId) || userId <= 0) return null;
    return strapi.db.query('plugin::users-permissions.user').findOne({ where: { id: userId }, select: ['id', 'username', 'email', 'blocked'] });
  } catch {
    return null;
  }
}

async function requireAuthenticatedUser(ctx) {
  let authUser = ctx.state?.user;
  if (!authUser?.id) {
    authUser = await resolveUserFromJwt(ctx) || undefined;
    if (authUser?.id) ctx.state.user = authUser;
  }
  if (!authUser?.id) { ctx.unauthorized('Unauthorized'); return null; }
  if (authUser?.blocked) { ctx.unauthorized('Account is blocked'); return null; }
  return authUser;
}

function handleError(ctx, error) {
  const status = Number(error?.status || 500);
  const message = typeof error?.message === 'string' && error.message.trim() ? error.message.trim() : 'Unexpected lucky wheel error';
  if (status === 400) return ctx.badRequest(message);
  if (status === 401) return ctx.unauthorized(message);
  if (status === 403) return ctx.forbidden(message);
  if (status === 404) return ctx.notFound(message);
  if (status === 409) return ctx.conflict(message);
  strapi.log.error('[lucky-wheel] unexpected admin error', error);
  return ctx.internalServerError(message);
}

export default {
  async list(ctx) {
    const user = await requireAuthenticatedUser(ctx);
    if (!user) return;
    try {
      const svc = strapi.service('api::lucky-wheel.lucky-wheel');
      const tenantId = await svc.getTenantContext(ctx);
      const result = await svc.listLuckyWheels(ctx.request?.query || {}, tenantId);
      const rows = (result.rows || []).map((r) => ({ id: r.id, attributes: { ...r } }));
      ctx.body = { data: rows, meta: { pagination: result.pagination || {} } };
    } catch (e) { return handleError(ctx, e); }
  },

  async create(ctx) {
    const user = await requireAuthenticatedUser(ctx);
    if (!user) return;
    try {
      const svc = strapi.service('api::lucky-wheel.lucky-wheel');
      const tenantId = await svc.getTenantContext(ctx);
      const created = await svc.createLuckyWheel(ctx.request?.body || {}, tenantId, ctx.state.user);
      ctx.body = { data: { id: created.id, attributes: created } };
    } catch (e) { return handleError(ctx, e); }
  },

  async detail(ctx) {
    const user = await requireAuthenticatedUser(ctx);
    if (!user) return;
    try {
      const svc = strapi.service('api::lucky-wheel.lucky-wheel');
      const tenantId = await svc.getTenantContext(ctx);
      const data = await svc.getLuckyWheelDetail(ctx.params?.id, tenantId);
      ctx.body = { data: { id: data.id, attributes: data } };
    } catch (e) { return handleError(ctx, e); }
  },

  async update(ctx) {
    const user = await requireAuthenticatedUser(ctx);
    if (!user) return;
    try {
      const svc = strapi.service('api::lucky-wheel.lucky-wheel');
      const tenantId = await svc.getTenantContext(ctx);
      const updated = await svc.updateLuckyWheel(ctx.params?.id, ctx.request?.body || {}, tenantId, ctx.state.user);
      ctx.body = { data: { id: updated.id, attributes: updated } };
    } catch (e) { return handleError(ctx, e); }
  },

  async openWheel(ctx) {
    const user = await requireAuthenticatedUser(ctx);
    if (!user) return;
    try {
      const svc = strapi.service('api::lucky-wheel.lucky-wheel');
      const tenantId = await svc.getTenantContext(ctx);
      const updated = await svc.openLuckyWheel(ctx.params?.id, tenantId, ctx.state.user);
      ctx.body = { data: { id: updated.id, attributes: updated } };
    } catch (e) { return handleError(ctx, e); }
  },

  async remove(ctx) {
    const user = await requireAuthenticatedUser(ctx);
    if (!user) return;
    try {
      const svc = strapi.service('api::lucky-wheel.lucky-wheel');
      const tenantId = await svc.getTenantContext(ctx);
      const data = await svc.softDeleteLuckyWheel(ctx.params?.id, tenantId, ctx.state.user);
      ctx.body = { data: { id: data.id, attributes: data } };
    } catch (e) { return handleError(ctx, e); }
  },

  async restore(ctx) {
    const user = await requireAuthenticatedUser(ctx);
    if (!user) return;
    try {
      const svc = strapi.service('api::lucky-wheel.lucky-wheel');
      const tenantId = await svc.getTenantContext(ctx);
      const data = await svc.restoreLuckyWheel(ctx.params?.id, tenantId, ctx.state.user);
      ctx.body = { data: { id: data.id, attributes: data } };
    } catch (e) { return handleError(ctx, e); }
  },

  async summary(ctx) {
    const user = await requireAuthenticatedUser(ctx);
    if (!user) return;
    try {
      const svc = strapi.service('api::lucky-wheel.lucky-wheel');
      const tenantId = await svc.getTenantContext(ctx);
      const data = await svc.getLuckyWheelSummary(ctx.params?.id, tenantId);
      ctx.body = { data: { id: ctx.params?.id, attributes: data } };
    } catch (e) { return handleError(ctx, e); }
  },

  async prizesList(ctx) {
    const user = await requireAuthenticatedUser(ctx);
    if (!user) return;
    try {
      const svc = strapi.service('api::lucky-wheel.lucky-wheel');
      const tenantId = await svc.getTenantContext(ctx);
      const rows = await svc.listPrizes(ctx.params?.id, tenantId);
      const data = (rows || []).map((r) => ({ id: r.id, attributes: r }));
      ctx.body = { data };
    } catch (e) { return handleError(ctx, e); }
  },

  async createPrize(ctx) {
    const user = await requireAuthenticatedUser(ctx);
    if (!user) return;
    try {
      const svc = strapi.service('api::lucky-wheel.lucky-wheel');
      const tenantId = await svc.getTenantContext(ctx);
      const created = await svc.createPrize(ctx.params?.id, ctx.request?.body || {}, tenantId, ctx.state.user);
      ctx.body = { data: { id: created.id, attributes: created } };
    } catch (e) { return handleError(ctx, e); }
  },

  async updatePrize(ctx) {
    const user = await requireAuthenticatedUser(ctx);
    if (!user) return;
    try {
      const svc = strapi.service('api::lucky-wheel.lucky-wheel');
      const tenantId = await svc.getTenantContext(ctx);
      const updated = await svc.updatePrize(ctx.params?.id, ctx.params?.prizeId, ctx.request?.body || {}, tenantId, ctx.state.user);
      ctx.body = { data: { id: updated.id, attributes: updated } };
    } catch (e) { return handleError(ctx, e); }
  },

  async removePrize(ctx) {
    const user = await requireAuthenticatedUser(ctx);
    if (!user) return;
    try {
      const svc = strapi.service('api::lucky-wheel.lucky-wheel');
      const tenantId = await svc.getTenantContext(ctx);
      const deleted = await svc.softDeletePrize(ctx.params?.id, ctx.params?.prizeId, tenantId, ctx.state.user);
      ctx.body = { data: { id: deleted.id, attributes: deleted } };
    } catch (e) { return handleError(ctx, e); }
  },
  async participantsList(ctx) {
    const user = await requireAuthenticatedUser(ctx);
    if (!user) return;
    try {
      const svc = strapi.service('api::lucky-wheel.lucky-wheel');
      const tenantId = await svc.getTenantContext(ctx);
      const result = await svc.listParticipants(ctx.params?.id, ctx.request?.query || {}, tenantId);
      const rows = (result.rows || []).map((r) => ({ id: r.id, attributes: { ...r } }));
      ctx.body = { data: rows, meta: { pagination: result.pagination || {} } };
    } catch (e) { return handleError(ctx, e); }
  },

  async createParticipant(ctx) {
    const user = await requireAuthenticatedUser(ctx);
    if (!user) return;
    try {
      const svc = strapi.service('api::lucky-wheel.lucky-wheel');
      const tenantId = await svc.getTenantContext(ctx);
      const created = await svc.createParticipant(ctx.params?.id, ctx.request?.body || {}, tenantId, ctx.state.user);
      ctx.body = { data: { id: created.id, attributes: created } };
    } catch (e) { return handleError(ctx, e); }
  },

  async updateParticipant(ctx) {
    const user = await requireAuthenticatedUser(ctx);
    if (!user) return;
    try {
      const svc = strapi.service('api::lucky-wheel.lucky-wheel');
      const tenantId = await svc.getTenantContext(ctx);
      const updated = await svc.updateParticipant(ctx.params?.id, ctx.params?.participantId, ctx.request?.body || {}, tenantId, ctx.state.user);
      ctx.body = { data: { id: updated.id, attributes: updated } };
    } catch (e) { return handleError(ctx, e); }
  },

  async blockParticipant(ctx) {
    const user = await requireAuthenticatedUser(ctx);
    if (!user) return;
    try {
      const svc = strapi.service('api::lucky-wheel.lucky-wheel');
      const tenantId = await svc.getTenantContext(ctx);
      const updated = await svc.blockParticipant(ctx.params?.id, ctx.params?.participantId, tenantId, ctx.state.user);
      ctx.body = { data: { id: updated.id, attributes: updated } };
    } catch (e) { return handleError(ctx, e); }
  },

  async unblockParticipant(ctx) {
    const user = await requireAuthenticatedUser(ctx);
    if (!user) return;
    try {
      const svc = strapi.service('api::lucky-wheel.lucky-wheel');
      const tenantId = await svc.getTenantContext(ctx);
      const updated = await svc.unblockParticipant(ctx.params?.id, ctx.params?.participantId, tenantId, ctx.state.user);
      ctx.body = { data: { id: updated.id, attributes: updated } };
    } catch (e) { return handleError(ctx, e); }
  },
  async exportParticipants(ctx) {
    const user = await requireAuthenticatedUser(ctx);
    if (!user) return;
    try {
      const svc = strapi.service('api::lucky-wheel.lucky-wheel');
      const tenantId = await svc.getTenantContext(ctx);
      const result = await svc.exportParticipants(ctx.params?.id, tenantId, ctx.request?.query || {});
      if (!result || !result.buffer) return ctx.notFound('No participants');
      ctx.set('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      ctx.set('Content-Disposition', `attachment; filename="${result.filename}"`);
      ctx.body = result.buffer;
    } catch (e) { return handleError(ctx, e); }
  },
  async resultsList(ctx) {
    const user = await requireAuthenticatedUser(ctx);
    if (!user) return;
    try {
      const svc = strapi.service('api::lucky-wheel.lucky-wheel');
      const tenantId = await svc.getTenantContext(ctx);
      const result = await svc.listResults(ctx.params?.id, ctx.request?.query || {}, tenantId);
      const rows = (result.rows || []).map((r) => ({ id: r.id, attributes: { ...r } }));
      ctx.body = { data: rows, meta: { pagination: result.pagination || {} } };
    } catch (e) { return handleError(ctx, e); }
  },
  async exportResults(ctx) {
    const user = await requireAuthenticatedUser(ctx);
    if (!user) return;
    try {
      const svc = strapi.service('api::lucky-wheel.lucky-wheel');
      const tenantId = await svc.getTenantContext(ctx);
      const result = await svc.exportResults(ctx.params?.id, tenantId, ctx.request?.query || {});
      if (!result || !result.buffer) return ctx.notFound('No results');
      ctx.set('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      ctx.set('Content-Disposition', `attachment; filename="${result.filename}"`);
      ctx.body = result.buffer;
    } catch (e) { return handleError(ctx, e); }
  },
  async getParticipantFormConfig(ctx) {
    const user = await requireAuthenticatedUser(ctx);
    if (!user) return;
    try {
      const svc = strapi.service('api::lucky-wheel.lucky-wheel');
      const tenantId = await svc.getTenantContext(ctx);
      const data = await svc.getLuckyWheelDetail(ctx.params?.id, tenantId);
      const config = data?.participantFormConfig || null;
      ctx.body = { data: config };
    } catch (e) { return handleError(ctx, e); }
  },

  async updateParticipantFormConfig(ctx) {
    const user = await requireAuthenticatedUser(ctx);
    if (!user) return;
    try {
      const svc = strapi.service('api::lucky-wheel.lucky-wheel');
      const tenantId = await svc.getTenantContext(ctx);
      const payload = ctx.request?.body || {};
      const updated = await svc.updateLuckyWheel(ctx.params?.id, { participantFormConfig: payload.participantFormConfig }, tenantId, ctx.state.user);
      ctx.body = { data: { id: updated.id, attributes: updated } };
    } catch (e) { return handleError(ctx, e); }
  },
  async generateParticipantCodes(ctx) {
    const user = await requireAuthenticatedUser(ctx);
    if (!user) return;
    try {
      const svc = strapi.service('api::lucky-wheel.lucky-wheel');
      const tenantId = await svc.getTenantContext(ctx);
      const payload = ctx.request?.body || {};
      const created = await svc.generateParticipantCodes(ctx.params?.id, payload, tenantId, ctx.state.user);
      const data = (created || []).map((r) => ({ id: r.id, attributes: r }));
      ctx.body = { data };
    } catch (e) { return handleError(ctx, e); }
  },
  async previewImportParticipants(ctx) {
    const user = await requireAuthenticatedUser(ctx);
    if (!user) return;
    try {
      const svc = strapi.service('api::lucky-wheel.lucky-wheel');
      const tenantId = await svc.getTenantContext(ctx);
      const rows = ctx.request?.body?.rows || [];
      const preview = await svc.previewImportParticipants(ctx.params?.id, rows, tenantId);
      ctx.body = { data: preview };
    } catch (e) { return handleError(ctx, e); }
  },

  async importParticipants(ctx) {
    const user = await requireAuthenticatedUser(ctx);
    if (!user) return;
    try {
      const svc = strapi.service('api::lucky-wheel.lucky-wheel');
      const tenantId = await svc.getTenantContext(ctx);
      const rows = ctx.request?.body?.rows || [];
      const created = await svc.importParticipants(ctx.params?.id, rows, tenantId, ctx.state.user);
      const data = (created || []).map((r) => ({ id: r.id, attributes: r }));
      ctx.body = { data };
    } catch (e) { return handleError(ctx, e); }
  },
};
