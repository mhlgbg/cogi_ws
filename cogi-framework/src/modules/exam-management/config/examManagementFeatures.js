const examManagementFeatures = {
  group: {
    name: 'Quản lý thi chuẩn đầu ra',
    code: 'exam',
    order: 21,
    icon: 'cilEducation',
  },
  features: [
    {
      name: 'Đợt thi chuẩn đầu ra',
      key: 'exam-round.manage',
      order: 1,
      description: 'Quản lý đợt thi chuẩn đầu ra',
      path: '/exam-rounds',
      showInMenu: true,
    },
    {
      name: 'Đăng ký dự thi',
      key: 'exam-registration.self',
      order: 2,
      description: 'Learner xem các đợt thi và chuẩn bị đăng ký dự thi',
      path: '/learner/exams',
      showInMenu: true,
    },
  ],
}

export default examManagementFeatures