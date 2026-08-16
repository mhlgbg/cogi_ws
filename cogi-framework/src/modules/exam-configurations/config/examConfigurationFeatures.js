const examConfigurationFeatures = {
  group: {
    name: 'Quản lý thi chuẩn đầu ra',
    code: 'exam-configurations',
    order: 21,
    icon: 'cilEducation',
  },
  features: [
    {
      name: 'Cấu hình thi chuẩn đầu ra',
      key: 'exam-round.manage',
      order: 1,
      description: 'Khung cấu hình thi chuẩn đầu ra',
      path: '/exam-configurations',
      showInMenu: true,
    },
  ],
}

export default examConfigurationFeatures