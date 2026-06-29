export default {
  routes: [
    {
      method: 'GET',
      path: '/chat-sessions',
      handler: 'chat-session.list',
      config: {
        auth: false,
      },
    },
    {
      method: 'GET',
      path: '/chat-sessions/:id',
      handler: 'chat-session.detail',
      config: {
        auth: false,
      },
    },
    {
      method: 'PATCH',
      path: '/chat-sessions/:id',
      handler: 'chat-session.update',
      config: {
        auth: false,
      },
    },
    {
      method: 'POST',
      path: '/chat-sessions/:id/admin-reply',
      handler: 'chat-session.adminReply',
      config: {
        auth: false,
      },
    },
  ],
};
