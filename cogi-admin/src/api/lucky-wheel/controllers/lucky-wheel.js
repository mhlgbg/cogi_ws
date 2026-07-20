"use strict";

module.exports = {
  async getPublic(ctx) {
    const { code } = ctx.params || {};
    const svc = strapi.service('api::lucky-wheel.lucky-wheel');
    const tenantId = await svc.getTenantContext(ctx);
    const data = await svc.getPublicWheelForTenant(code, tenantId);
    if (!data) {
      ctx.status = 404;
      ctx.body = { error: 'WHEEL_NOT_FOUND' };
      return;
    }

    try {
      svc.assertPublicWheelStatus(data);
    } catch (e) {
      ctx.status = e.status || 400;
      ctx.body = { error: e.message || 'ERROR' };
      return;
    }

    ctx.body = { data };
  },

  async ping(ctx) {
    ctx.body = { ok: true, now: new Date().toISOString() };
  },

  async lookupParticipant(ctx) {
    const { code } = ctx.params || {};
    const payload = ctx.request && ctx.request.body ? ctx.request.body : {};
    const svc = strapi.service('api::lucky-wheel.lucky-wheel');
    try {
      const tenantId = await svc.getTenantContext(ctx);
      const wheel = await svc.getPublicWheelForTenant(code, tenantId);
      if (!wheel) { ctx.status = 404; ctx.body = { error: 'WHEEL_NOT_FOUND' }; return; }

      svc.assertPublicWheelStatus(wheel);

      const { participant, participantFormConfig } = await svc.checkParticipantForWheel(wheel, payload, tenantId);
      if (!participant) { ctx.status = 404; ctx.body = { error: 'PARTICIPANT_NOT_FOUND' }; return; }
      const st = String((participant.status || '').toLowerCase());
      if (st === 'blocked') { ctx.status = 403; ctx.body = { error: 'PARTICIPANT_BLOCKED' }; return; }
      if (st === 'cancelled') { ctx.status = 400; ctx.body = { error: 'PARTICIPANT_CANCELLED' }; return; }
      if (st === 'used') { ctx.status = 400; ctx.body = { error: 'PARTICIPANT_ALREADY_USED' }; return; }

      ctx.body = { data: { participant: {
        id: participant.id,
        documentId: participant.documentId || participant.document_id || null,
        participantCode: participant.participantCode || null,
        fullName: participant.fullName || participant.fullname || null,
        phone: participant.phone || null,
        email: participant.email || null,
        className: participant.className || participant.classname || null,
        status: participant.status || null,
      }, requiredFields: participantFormConfig?.fields || [] } };
    } catch (e) {
      ctx.throw(e.status || 500, e.message || 'ERROR');
    }
  },

  async prepareParticipant(ctx) {
    const { code } = ctx.params || {};
    const payload = ctx.request && ctx.request.body ? ctx.request.body : {};
    const svc = strapi.service('api::lucky-wheel.lucky-wheel');
    try {
      const tenantId = await svc.getTenantContext(ctx);
      const wheel = await svc.getPublicWheelForTenant(code, tenantId);
      if (!wheel) { ctx.status = 404; ctx.body = { error: 'WHEEL_NOT_FOUND' }; return; }

      svc.assertPublicWheelStatus(wheel);

      const result = await svc.prepareExistingParticipant(wheel, payload, tenantId, ctx.state.user || null);
      ctx.body = { data: result };
    } catch (e) {
      ctx.status = e.status || 500;
      ctx.body = { error: e.message || 'ERROR', field: e.field || null };
    }
  },

  async spin(ctx) {
    const { code } = ctx.params || {};
    const payload = ctx.request && ctx.request.body ? ctx.request.body : {};
    const svc = strapi.service('api::lucky-wheel.lucky-wheel');
    try {
      const out = await svc.spinForPublic({ code, payload, ctx });
      ctx.body = { data: out };
    } catch (e) {
      ctx.status = e.status || 500;
      ctx.body = { error: e.message || 'ERROR' };
    }
  },

  async verify(ctx) {
    const { verificationCode } = ctx.request && ctx.request.body ? ctx.request.body : {};
    const svc = strapi.service('api::lucky-wheel.lucky-wheel');
    try {
      const out = await svc.verifyByCode(verificationCode);
      ctx.body = { data: out };
    } catch (e) {
      ctx.throw(e.status || 500, e.message || 'ERROR');
    }
  },
};
