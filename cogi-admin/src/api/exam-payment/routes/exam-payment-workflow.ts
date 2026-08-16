const EXAM_PAYMENT_SELF_POLICY = {
  name: 'global::has-tenant-permission',
  config: {
    key: 'exam-payment.self',
  },
};

const EXAM_PAYMENT_MANAGE_POLICY = {
  name: 'global::has-tenant-permission',
  config: {
    key: 'exam-payment.manage',
  },
};

export default {
  routes: [
    {
      method: 'POST',
      path: '/exam-registrations/:id/payments/report',
      handler: 'exam-payment-workflow.reportSelf',
      config: {
        auth: false,
        policies: [EXAM_PAYMENT_SELF_POLICY],
      },
    },
    {
      method: 'GET',
      path: '/exam-registrations/:id/payments/my',
      handler: 'exam-payment-workflow.listMy',
      config: {
        auth: false,
        policies: [EXAM_PAYMENT_SELF_POLICY],
      },
    },
    {
      method: 'GET',
      path: '/exam-registrations/:id/payments/:paymentId/my',
      handler: 'exam-payment-workflow.detailMy',
      config: {
        auth: false,
        policies: [EXAM_PAYMENT_SELF_POLICY],
      },
    },
    {
      method: 'GET',
      path: '/exam-payments/review',
      handler: 'exam-payment-workflow.reviewList',
      config: {
        auth: false,
        policies: [EXAM_PAYMENT_MANAGE_POLICY],
      },
    },
    {
      method: 'GET',
      path: '/exam-payments/:id/review',
      handler: 'exam-payment-workflow.reviewDetail',
      config: {
        auth: false,
        policies: [EXAM_PAYMENT_MANAGE_POLICY],
      },
    },
    {
      method: 'POST',
      path: '/exam-payments/:id/start-review',
      handler: 'exam-payment-workflow.startReview',
      config: {
        auth: false,
        policies: [EXAM_PAYMENT_MANAGE_POLICY],
      },
    },
    {
      method: 'POST',
      path: '/exam-payments/:id/confirm',
      handler: 'exam-payment-workflow.confirm',
      config: {
        auth: false,
        policies: [EXAM_PAYMENT_MANAGE_POLICY],
      },
    },
    {
      method: 'POST',
      path: '/exam-payments/:id/reject',
      handler: 'exam-payment-workflow.reject',
      config: {
        auth: false,
        policies: [EXAM_PAYMENT_MANAGE_POLICY],
      },
    },
  ],
};