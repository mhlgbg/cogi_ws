"use strict";

module.exports = {
  routes: [
    {
      method: 'GET',
      path: '/public/lucky-wheels/:code',
      handler: 'lucky-wheel.getPublic',
      config: { auth: false },
    },
    {
      method: 'GET',
      path: '/public/lucky-wheels/ping',
      handler: 'lucky-wheel.ping',
      config: { auth: false },
    },
    {
      method: 'POST',
      path: '/public/lucky-wheels/:code/participants/lookup',
      handler: 'lucky-wheel.lookupParticipant',
      config: { auth: false },
    },
    {
      method: 'POST',
      path: '/public/lucky-wheels/:code/participants/prepare',
      handler: 'lucky-wheel.prepareParticipant',
      config: { auth: false },
    },
    {
      method: 'POST',
      path: '/public/lucky-wheels/:code/spin',
      handler: 'lucky-wheel.spin',
      config: { auth: false },
    },
    {
      method: 'POST',
      path: '/public/lucky-wheels/verify',
      handler: 'lucky-wheel.verify',
      config: { auth: false },
    },
  ],
};
