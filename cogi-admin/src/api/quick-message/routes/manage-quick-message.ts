const QUICK_MESSAGE_MANAGE_POLICY = {
  name: 'global::has-tenant-permission',
  config: {
    key: 'crms.quick-message.manage',
  },
};

export default {
  routes: [
    {
      method: 'GET',
      path: '/quick-messages/manage',
      handler: 'quick-message.listManage',
      config: {
        auth: false,
        policies: [QUICK_MESSAGE_MANAGE_POLICY],
      },
    },
    {
      method: 'GET',
      path: '/quick-messages/manage/:id',
      handler: 'quick-message.detailManage',
      config: {
        auth: false,
        policies: [QUICK_MESSAGE_MANAGE_POLICY],
      },
    },
    {
      method: 'POST',
      path: '/quick-messages/manage',
      handler: 'quick-message.createManage',
      config: {
        auth: false,
        policies: [QUICK_MESSAGE_MANAGE_POLICY],
      },
    },
    {
      method: 'PUT',
      path: '/quick-messages/manage/:id',
      handler: 'quick-message.updateManage',
      config: {
        auth: false,
        policies: [QUICK_MESSAGE_MANAGE_POLICY],
      },
    },
    {
      method: 'POST',
      path: '/quick-messages/manage/:id/lock',
      handler: 'quick-message.lockManage',
      config: {
        auth: false,
        policies: [QUICK_MESSAGE_MANAGE_POLICY],
      },
    },
    {
      method: 'POST',
      path: '/quick-messages/manage/:id/unlock',
      handler: 'quick-message.unlockManage',
      config: {
        auth: false,
        policies: [QUICK_MESSAGE_MANAGE_POLICY],
      },
    },
    {
      method: 'POST',
      path: '/quick-messages/manage/:id/cancel',
      handler: 'quick-message.cancelManage',
      config: {
        auth: false,
        policies: [QUICK_MESSAGE_MANAGE_POLICY],
      },
    },
    {
      method: 'POST',
      path: '/quick-messages/manage/:messageId/accesses',
      handler: 'quick-message.createAccessManage',
      config: {
        auth: false,
        policies: [QUICK_MESSAGE_MANAGE_POLICY],
      },
    },
    {
      method: 'POST',
      path: '/quick-message-accesses/manage/:id/clone-batch',
      handler: 'quick-message.cloneAccessBatchManage',
      config: {
        auth: false,
        policies: [QUICK_MESSAGE_MANAGE_POLICY],
      },
    },
    {
      method: 'GET',
      path: '/quick-messages/manage/:messageId/replies',
      handler: 'quick-message.listRepliesManage',
      config: {
        auth: false,
        policies: [QUICK_MESSAGE_MANAGE_POLICY],
      },
    },
    {
      method: 'GET',
      path: '/quick-messages/manage/:messageId/activity/accesses',
      handler: 'quick-message.listActivityAccessesManage',
      config: {
        auth: false,
        policies: [QUICK_MESSAGE_MANAGE_POLICY],
      },
    },
    {
      method: 'GET',
      path: '/quick-messages/manage/:messageId/activity/accesses/:accessId',
      handler: 'quick-message.activityAccessDetailManage',
      config: {
        auth: false,
        policies: [QUICK_MESSAGE_MANAGE_POLICY],
      },
    },
    {
      method: 'GET',
      path: '/quick-messages/manage/:messageId/activity/accesses/:accessId/messages',
      handler: 'quick-message.listActivityMessagesManage',
      config: {
        auth: false,
        policies: [QUICK_MESSAGE_MANAGE_POLICY],
      },
    },
    {
      method: 'POST',
      path: '/quick-messages/manage/:messageId/activity/accesses/:accessId/messages',
      handler: 'quick-message.createActivityMessageManage',
      config: {
        auth: false,
        policies: [QUICK_MESSAGE_MANAGE_POLICY],
      },
    },
    {
      method: 'POST',
      path: '/quick-messages/manage/:messageId/activity/accesses/:accessId/read',
      handler: 'quick-message.markActivityReadManage',
      config: {
        auth: false,
        policies: [QUICK_MESSAGE_MANAGE_POLICY],
      },
    },
    {
      method: 'GET',
      path: '/quick-messages/manage/:messageId/activity/accesses/:accessId/logs',
      handler: 'quick-message.listActivityLogsManage',
      config: {
        auth: false,
        policies: [QUICK_MESSAGE_MANAGE_POLICY],
      },
    },
    {
      method: 'POST',
      path: '/quick-messages/manage/:messageId/replies/read-all',
      handler: 'quick-message.readAllRepliesManage',
      config: {
        auth: false,
        policies: [QUICK_MESSAGE_MANAGE_POLICY],
      },
    },
  ],
};