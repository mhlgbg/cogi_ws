const eventRegistrationFeatures = {
  group: {
    name: 'Sự kiện & đăng ký',
    code: 'event-registration',
    order: 90,
    icon: 'cilCalendar',
  },
  features: [
    {
      name: 'Quản lý sự kiện',
      key: 'event.manage',
      order: 1,
      description: 'Quản lý sự kiện, thời gian mở đăng ký, đối tượng tham gia và thống kê cơ bản.',
      path: '/events/manage',
      showInMenu: true,
    },
  ],
}

export default eventRegistrationFeatures
