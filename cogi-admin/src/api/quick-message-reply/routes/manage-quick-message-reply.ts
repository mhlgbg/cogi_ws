const QUICK_MESSAGE_MANAGE_POLICY = {
  name: 'global::has-tenant-permission',
  config: {
    key: 'crms.quick-message.manage',
  },
};

export default {
  routes: [
    {
      method: 'POST',
      path: '/quick-message-replies/manage/:id/read',
      handler: 'quick-message-reply.readManage',
      config: {
        auth: false,
        policies: [QUICK_MESSAGE_MANAGE_POLICY],
      },
    },
  ],
};