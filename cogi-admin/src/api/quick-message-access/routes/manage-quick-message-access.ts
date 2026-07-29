const QUICK_MESSAGE_MANAGE_POLICY = {
  name: 'global::has-tenant-permission',
  config: {
    key: 'crms.quick-message.manage',
  },
};

export default {
  routes: [
    {
      method: 'PUT',
      path: '/quick-message-accesses/manage/:id',
      handler: 'quick-message-access.updateManage',
      config: {
        auth: false,
        policies: [QUICK_MESSAGE_MANAGE_POLICY],
      },
    },
    {
      method: 'POST',
      path: '/quick-message-accesses/manage/:id/enable-pin',
      handler: 'quick-message-access.enablePinManage',
      config: {
        auth: false,
        policies: [QUICK_MESSAGE_MANAGE_POLICY],
      },
    },
    {
      method: 'POST',
      path: '/quick-message-accesses/manage/:id/change-pin',
      handler: 'quick-message-access.changePinManage',
      config: {
        auth: false,
        policies: [QUICK_MESSAGE_MANAGE_POLICY],
      },
    },
    {
      method: 'POST',
      path: '/quick-message-accesses/manage/:id/disable-pin',
      handler: 'quick-message-access.disablePinManage',
      config: {
        auth: false,
        policies: [QUICK_MESSAGE_MANAGE_POLICY],
      },
    },
    {
      method: 'POST',
      path: '/quick-message-accesses/manage/:id/lock',
      handler: 'quick-message-access.lockManage',
      config: {
        auth: false,
        policies: [QUICK_MESSAGE_MANAGE_POLICY],
      },
    },
    {
      method: 'POST',
      path: '/quick-message-accesses/manage/:id/unlock',
      handler: 'quick-message-access.unlockManage',
      config: {
        auth: false,
        policies: [QUICK_MESSAGE_MANAGE_POLICY],
      },
    },
    {
      method: 'POST',
      path: '/quick-message-accesses/manage/:id/cancel',
      handler: 'quick-message-access.cancelManage',
      config: {
        auth: false,
        policies: [QUICK_MESSAGE_MANAGE_POLICY],
      },
    },
  ],
};