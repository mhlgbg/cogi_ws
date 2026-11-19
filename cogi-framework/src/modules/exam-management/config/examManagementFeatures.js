const examManagementFeatures = {
  group: {
    name: 'Quản lý đợt thi',
    code: 'exam',
    order: 21,
    icon: 'cilEducation',
  },
  features: [
    {
      name: 'Quản lý đợt thi',
      key: 'exam-campaign.manage',
      order: 1,
      description: 'Quản lý đợt thi theo mô hình campaign → slot → session',
      path: '/exam-campaigns',
      showInMenu: true,
    },
    {
      name: 'Ca thi',
      key: 'exam-slot.manage',
      order: 2,
      description: 'Quản lý ca thi trong mỗi đợt thi',
      path: '/exam-slots',
      showInMenu: false,
    },
    {
      name: 'Phiên thi',
      key: 'assessment-session.manage',
      order: 3,
      description: 'Quản lý phiên thi, link subject-assessment-version và snapshot đề',
      path: '/assessment-sessions',
      showInMenu: false,
    },
  ],
}

export default examManagementFeatures