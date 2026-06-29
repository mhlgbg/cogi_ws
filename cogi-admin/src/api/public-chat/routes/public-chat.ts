export default {
  routes: [
    {
      method: 'POST',
      path: '/public-chat/session',
      handler: 'public-chat.createSession',
      config: {
        auth: false,
      },
    },
    {
      method: 'POST',
      path: '/public-chat/message',
      handler: 'public-chat.createMessage',
      config: {
        auth: false,
      },
    },
    {
      method: 'GET',
      path: '/public-chat/session/:id/messages',
      handler: 'public-chat.sessionMessages',
      config: {
        auth: false,
      },
    },
    {
      method: 'GET',
      path: '/public-chat/widget-status',
      handler: 'public-chat.widgetStatus',
      config: {
        auth: false,
      },
    },
  ],
};
