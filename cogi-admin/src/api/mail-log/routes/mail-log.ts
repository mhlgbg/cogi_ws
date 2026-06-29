export default {
  routes: [
    {
      method: 'GET',
      path: '/mail-monitor/logs',
      handler: 'mail-log.list',
      config: {
        auth: false,
      },
    },
    {
      method: 'GET',
      path: '/mail-monitor/logs/:id',
      handler: 'mail-log.detail',
      config: {
        auth: false,
      },
    },
    {
      method: 'POST',
      path: '/mail-monitor/logs/:id/requeue',
      handler: 'mail-log.requeue',
      config: {
        auth: false,
      },
    },
    {
      method: 'POST',
      path: '/mail-monitor/logs/:id/resend',
      handler: 'mail-log.resend',
      config: {
        auth: false,
      },
    },
    {
      method: 'POST',
      path: '/mail-monitor/logs/:id/send-now',
      handler: 'mail-log.sendNow',
      config: {
        auth: false,
      },
    },
    {
      method: 'POST',
      path: '/mail-monitor/logs/:id/cancel',
      handler: 'mail-log.cancel',
      config: {
        auth: false,
      },
    },
    {
      method: 'GET',
      path: '/mail-monitor/stats',
      handler: 'mail-log.stats',
      config: {
        auth: false,
      },
    },
    {
      method: 'POST',
      path: '/mail-monitor/test-send',
      handler: 'mail-log.testSend',
      config: {
        auth: false,
      },
    },
    {
      method: 'GET',
      path: '/admin/mail-logs',
      handler: 'mail-log.list',
      config: {
        auth: false,
      },
    },
    {
      method: 'GET',
      path: '/admin/mail-logs/stats',
      handler: 'mail-log.stats',
      config: {
        auth: false,
      },
    },
    {
      method: 'GET',
      path: '/admin/mail-logs/:id',
      handler: 'mail-log.detail',
      config: {
        auth: false,
      },
    },
    {
      method: 'POST',
      path: '/admin/mail-logs/:id/resend',
      handler: 'mail-log.resend',
      config: {
        auth: false,
      },
    },
    {
      method: 'POST',
      path: '/admin/mail-logs/:id/send-now',
      handler: 'mail-log.sendNow',
      config: {
        auth: false,
      },
    },
    {
      method: 'POST',
      path: '/admin/mail-logs/test-send',
      handler: 'mail-log.testSend',
      config: {
        auth: false,
      },
    },
    {
      method: 'POST',
      path: '/admin/mail-logs/:id/requeue',
      handler: 'mail-log.requeue',
      config: {
        auth: false,
      },
    },
    {
      method: 'POST',
      path: '/admin/mail-logs/:id/cancel',
      handler: 'mail-log.cancel',
      config: {
        auth: false,
      },
    },
  ],
};