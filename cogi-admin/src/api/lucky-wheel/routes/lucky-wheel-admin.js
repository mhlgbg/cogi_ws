"use strict";

module.exports = {
  routes: [
    {
      method: 'GET',
      path: '/lucky-wheels',
      handler: 'lucky-wheel-admin.list',
      config: {
        auth: false,
        policies: [
          { name: 'global::has-tenant-permission', config: { key: 'lucky-wheel.manage' } },
        ],
      },
    },
    {
      method: 'POST',
      path: '/lucky-wheels/:id/participants/import-preview',
      handler: 'lucky-wheel-admin.previewImportParticipants',
      config: {
        auth: false,
        policies: [
          { name: 'global::has-tenant-permission', config: { key: 'lucky-wheel.manage' } },
        ],
      },
    },
    {
      method: 'POST',
      path: '/lucky-wheels/:id/participants/import',
      handler: 'lucky-wheel-admin.importParticipants',
      config: {
        auth: false,
        policies: [
          { name: 'global::has-tenant-permission', config: { key: 'lucky-wheel.manage' } },
        ],
      },
    },
    {
      method: 'POST',
      path: '/lucky-wheels/:id/participants/generate-codes',
      handler: 'lucky-wheel-admin.generateParticipantCodes',
      config: {
        auth: false,
        policies: [
          { name: 'global::has-tenant-permission', config: { key: 'lucky-wheel.manage' } },
        ],
      },
    },
    {
      method: 'POST',
      path: '/lucky-wheels',
      handler: 'lucky-wheel-admin.create',
      config: {
        auth: false,
        policies: [
          { name: 'global::has-tenant-permission', config: { key: 'lucky-wheel.manage' } },
        ],
      },
    },
    {
      method: 'GET',
      path: '/lucky-wheels/:id',
      handler: 'lucky-wheel-admin.detail',
      config: {
        auth: false,
        policies: [
          { name: 'global::has-tenant-permission', config: { key: 'lucky-wheel.manage' } },
        ],
      },
    },
    {
      method: 'PUT',
      path: '/lucky-wheels/:id',
      handler: 'lucky-wheel-admin.update',
      config: {
        auth: false,
        policies: [
          { name: 'global::has-tenant-permission', config: { key: 'lucky-wheel.manage' } },
        ],
      },
    },
    {
      method: 'PATCH',
      path: '/lucky-wheels/:id',
      handler: 'lucky-wheel-admin.update',
      config: {
        auth: false,
        policies: [
          { name: 'global::has-tenant-permission', config: { key: 'lucky-wheel.manage' } },
        ],
      },
    },
    {
      method: 'DELETE',
      path: '/lucky-wheels/:id',
      handler: 'lucky-wheel-admin.remove',
      config: {
        auth: false,
        policies: [
          { name: 'global::has-tenant-permission', config: { key: 'lucky-wheel.manage' } },
        ],
      },
    },
    {
      method: 'POST',
      path: '/lucky-wheels/:id/restore',
      handler: 'lucky-wheel-admin.restore',
      config: {
        auth: false,
        policies: [
          { name: 'global::has-tenant-permission', config: { key: 'lucky-wheel.manage' } },
        ],
      },
    },
    {
      method: 'POST',
      path: '/lucky-wheels/:id/open',
      handler: 'lucky-wheel-admin.openWheel',
      config: {
        auth: false,
        policies: [
          { name: 'global::has-tenant-permission', config: { key: 'lucky-wheel.manage' } },
        ],
      },
    },
    {
      method: 'GET',
      path: '/lucky-wheels/:id/summary',
      handler: 'lucky-wheel-admin.summary',
      config: {
        auth: false,
        policies: [
          { name: 'global::has-tenant-permission', config: { key: 'lucky-wheel.manage' } },
        ],
      },
    },
    {
      method: 'GET',
      path: '/lucky-wheels/:id/prizes',
      handler: 'lucky-wheel-admin.prizesList',
      config: {
        auth: false,
        policies: [
          { name: 'global::has-tenant-permission', config: { key: 'lucky-wheel.manage' } },
        ],
      },
    },
    {
      method: 'GET',
      path: '/lucky-wheels/:id/participants',
      handler: 'lucky-wheel-admin.participantsList',
      config: {
        auth: false,
        policies: [
          { name: 'global::has-tenant-permission', config: { key: 'lucky-wheel.manage' } },
        ],
      },
    },
    {
      method: 'GET',
      path: '/lucky-wheels/:id/participants/export',
      handler: 'lucky-wheel-admin.exportParticipants',
      config: {
        auth: false,
        policies: [
          { name: 'global::has-tenant-permission', config: { key: 'lucky-wheel.manage' } },
        ],
      },
    },
    {
      method: 'GET',
      path: '/lucky-wheels/:id/results',
      handler: 'lucky-wheel-admin.resultsList',
      config: {
        auth: false,
        policies: [
          { name: 'global::has-tenant-permission', config: { key: 'lucky-wheel.manage' } },
        ],
      },
    },
    {
      method: 'GET',
      path: '/lucky-wheels/:id/results/export',
      handler: 'lucky-wheel-admin.exportResults',
      config: {
        auth: false,
        policies: [
          { name: 'global::has-tenant-permission', config: { key: 'lucky-wheel.manage' } },
        ],
      },
    },
    {
      method: 'GET',
      path: '/lucky-wheels/:id/results/verify/:verificationCode',
      handler: 'lucky-wheel-admin.verifyResult',
      config: {
        auth: false,
        policies: [
          { name: 'global::has-tenant-permission', config: { key: 'lucky-wheel.manage' } },
        ],
      },
    },
    {
      method: 'POST',
      path: '/lucky-wheels/:id/results/:spinId/claim',
      handler: 'lucky-wheel-admin.claimResult',
      config: {
        auth: false,
        policies: [
          { name: 'global::has-tenant-permission', config: { key: 'lucky-wheel.manage' } },
        ],
      },
    },
    {
      method: 'GET',
      path: '/lucky-wheels/:id/presentation',
      handler: 'lucky-wheel-admin.presentation',
      config: {
        auth: false,
        policies: [
          { name: 'global::has-tenant-permission', config: { key: 'lucky-wheel.manage' } },
        ],
      },
    },
    {
      method: 'GET',
      path: '/lucky-wheels/:id/presentation/status',
      handler: 'lucky-wheel-admin.presentationStatus',
      config: {
        auth: false,
        policies: [
          { name: 'global::has-tenant-permission', config: { key: 'lucky-wheel.manage' } },
        ],
      },
    },
    {
      method: 'GET',
      path: '/lucky-wheels/:id/presentation/eligible-participants',
      handler: 'lucky-wheel-admin.presentationEligibleParticipants',
      config: {
        auth: false,
        policies: [
          { name: 'global::has-tenant-permission', config: { key: 'lucky-wheel.manage' } },
        ],
      },
    },
    {
      method: 'POST',
      path: '/lucky-wheels/:id/presentation/spin-for-participant',
      handler: 'lucky-wheel-admin.presentationSpinForParticipant',
      config: {
        auth: false,
        policies: [
          { name: 'global::has-tenant-permission', config: { key: 'lucky-wheel.manage' } },
        ],
      },
    },
    {
      method: 'GET',
      path: '/lucky-wheels/:id/participant-form-config',
      handler: 'lucky-wheel-admin.getParticipantFormConfig',
      config: {
        auth: false,
        policies: [
          { name: 'global::has-tenant-permission', config: { key: 'lucky-wheel.manage' } },
        ],
      },
    },
    {
      method: 'PUT',
      path: '/lucky-wheels/:id/participant-form-config',
      handler: 'lucky-wheel-admin.updateParticipantFormConfig',
      config: {
        auth: false,
        policies: [
          { name: 'global::has-tenant-permission', config: { key: 'lucky-wheel.manage' } },
        ],
      },
    },
    {
      method: 'POST',
      path: '/lucky-wheels/:id/participants',
      handler: 'lucky-wheel-admin.createParticipant',
      config: {
        auth: false,
        policies: [
          { name: 'global::has-tenant-permission', config: { key: 'lucky-wheel.manage' } },
        ],
      },
    },
    {
      method: 'PUT',
      path: '/lucky-wheels/:id/participants/:participantId',
      handler: 'lucky-wheel-admin.updateParticipant',
      config: {
        auth: false,
        policies: [
          { name: 'global::has-tenant-permission', config: { key: 'lucky-wheel.manage' } },
        ],
      },
    },
    {
      method: 'POST',
      path: '/lucky-wheels/:id/participants/:participantId/block',
      handler: 'lucky-wheel-admin.blockParticipant',
      config: {
        auth: false,
        policies: [
          { name: 'global::has-tenant-permission', config: { key: 'lucky-wheel.manage' } },
        ],
      },
    },
    {
      method: 'POST',
      path: '/lucky-wheels/:id/participants/:participantId/unblock',
      handler: 'lucky-wheel-admin.unblockParticipant',
      config: {
        auth: false,
        policies: [
          { name: 'global::has-tenant-permission', config: { key: 'lucky-wheel.manage' } },
        ],
      },
    },
    {
      method: 'POST',
      path: '/lucky-wheels/:id/prizes',
      handler: 'lucky-wheel-admin.createPrize',
      config: {
        auth: false,
        policies: [
          { name: 'global::has-tenant-permission', config: { key: 'lucky-wheel.manage' } },
        ],
      },
    },
    {
      method: 'PUT',
      path: '/lucky-wheels/:id/prizes/:prizeId',
      handler: 'lucky-wheel-admin.updatePrize',
      config: {
        auth: false,
        policies: [
          { name: 'global::has-tenant-permission', config: { key: 'lucky-wheel.manage' } },
        ],
      },
    },
    {
      method: 'DELETE',
      path: '/lucky-wheels/:id/prizes/:prizeId',
      handler: 'lucky-wheel-admin.removePrize',
      config: {
        auth: false,
        policies: [
          { name: 'global::has-tenant-permission', config: { key: 'lucky-wheel.manage' } },
        ],
      },
    },
  ],
};
