export default {
  routes: [
    {
      method: 'GET',
      path: '/quick-messages/public/:code',
      handler: 'quick-message.lookupPublic',
      config: {
        auth: false,
        middlewares: ['global::quick-message-public-rate-limit'],
      },
    },
    {
      method: 'POST',
      path: '/quick-messages/public/:code/verify-pin',
      handler: 'quick-message.verifyPinPublic',
      config: {
        auth: false,
        middlewares: ['global::quick-message-public-pin-rate-limit'],
      },
    },
    {
      method: 'POST',
      path: '/quick-messages/public/:code/access',
      handler: 'quick-message.accessPublic',
      config: {
        auth: false,
        middlewares: ['global::quick-message-public-access-rate-limit'],
      },
    },
    {
      method: 'POST',
      path: '/quick-messages/public/:code/open',
      handler: 'quick-message.openPublic',
      config: {
        auth: false,
        middlewares: ['global::quick-message-public-access-rate-limit'],
      },
    },
    {
      method: 'GET',
      path: '/quick-messages/public/:code/messages',
      handler: 'quick-message.listMessagesPublic',
      config: {
        auth: false,
        middlewares: ['global::quick-message-public-access-rate-limit'],
      },
    },
    {
      method: 'POST',
      path: '/quick-messages/public/:code/messages',
      handler: 'quick-message.createMessagePublic',
      config: {
        auth: false,
        middlewares: ['global::quick-message-public-reply-rate-limit'],
      },
    },
    {
      method: 'POST',
      path: '/quick-messages/public/:code/messages/read',
      handler: 'quick-message.markMessagesReadPublic',
      config: {
        auth: false,
        middlewares: ['global::quick-message-public-access-rate-limit'],
      },
    },
  ],
};