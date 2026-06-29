export default {
  routes: [
    {
      method: 'GET',
      path: '/public-pages',
      handler: 'public-page.find',
      config: {
        auth: false,
      },
    },
    {
      method: 'GET',
      path: '/public-pages/:id',
      handler: 'public-page.findOne',
      config: {
        auth: false,
      },
    },
  ],
};
