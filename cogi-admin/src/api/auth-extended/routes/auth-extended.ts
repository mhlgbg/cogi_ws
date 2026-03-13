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
  ],
};
