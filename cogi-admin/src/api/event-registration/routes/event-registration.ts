export default {
  routes: [
    {
      method: 'POST',
      path: '/event-registrations/:id/cancel',
      handler: 'event-registration.cancelRegistrationById',
      config: {
        auth: false,
      },
    },
  ],
};
