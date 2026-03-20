export default {
  routes: [
    {
      method: 'POST',
      path: '/auth/activate',
      handler: 'auth-extended.activate',
      config: {
        auth: false,
      },
    },
    {
      method: 'POST',
      path: '/auth/set-password',
      handler: 'auth-extended.setPassword',
      config: {
        auth: false,
      },
    },
    {
      method: 'POST',
      path: '/auth/forgot-password-safe',
      handler: 'auth-extended.forgotPasswordSafe',
      config: {
        auth: false,
      },
    },
  ],
};
