export default {
  routes: [
    {
      method: 'POST',
      path: '/candidate-exam-public/score-lookup',
      handler: 'candidate-exam-public.scoreLookup',
      config: {
        auth: false,
      },
    },
    {
      method: 'POST',
      path: '/candidate-exam-public/send-score-report',
      handler: 'candidate-exam-public.sendScoreReport',
      config: {
        auth: false,
      },
    },
  ],
};