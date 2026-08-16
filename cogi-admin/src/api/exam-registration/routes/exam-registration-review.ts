const EXAM_REGISTRATION_MANAGE_POLICY = {
  name: 'global::has-tenant-permission',
  config: {
    key: 'exam-registration.manage',
  },
};

const EXAM_REGISTRATION_READ_POLICY = {
  name: 'global::has-tenant-permission',
  config: {
    keys: ['exam-registration.manage', 'exam-round.manage', 'exam-round.approve'],
  },
};

export default {
  routes: [
    {
      method: 'GET',
      path: '/exam-registrations/review',
      handler: 'exam-registration-review.listReview',
      config: {
        auth: false,
        policies: [EXAM_REGISTRATION_READ_POLICY],
      },
    },
    {
      method: 'GET',
      path: '/exam-registrations/:id/review',
      handler: 'exam-registration-review.detailReview',
      config: {
        auth: false,
        policies: [EXAM_REGISTRATION_READ_POLICY],
      },
    },
    {
      method: 'POST',
      path: '/exam-registrations/:id/start-review',
      handler: 'exam-registration-review.startReview',
      config: {
        auth: false,
        policies: [EXAM_REGISTRATION_MANAGE_POLICY],
      },
    },
    {
      method: 'POST',
      path: '/exam-registrations/:id/mark-eligible',
      handler: 'exam-registration-review.markEligible',
      config: {
        auth: false,
        policies: [EXAM_REGISTRATION_MANAGE_POLICY],
      },
    },
    {
      method: 'POST',
      path: '/exam-registrations/:id/mark-temporarily-ineligible',
      handler: 'exam-registration-review.markTemporarilyIneligible',
      config: {
        auth: false,
        policies: [EXAM_REGISTRATION_MANAGE_POLICY],
      },
    },
    {
      method: 'POST',
      path: '/exam-registrations/:id/mark-ineligible',
      handler: 'exam-registration-review.markIneligible',
      config: {
        auth: false,
        policies: [EXAM_REGISTRATION_MANAGE_POLICY],
      },
    },
    {
      method: 'POST',
      path: '/exam-registrations/:id/accept',
      handler: 'exam-registration-review.accept',
      config: {
        auth: false,
        policies: [EXAM_REGISTRATION_MANAGE_POLICY],
      },
    },
    {
      method: 'POST',
      path: '/exam-registrations/:id/reject',
      handler: 'exam-registration-review.reject',
      config: {
        auth: false,
        policies: [EXAM_REGISTRATION_MANAGE_POLICY],
      },
    },
  ],
};