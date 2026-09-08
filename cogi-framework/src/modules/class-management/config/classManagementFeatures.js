const classManagementFeatures = {
  group: {
    name: 'Class',
    code: 'class',
    order: 13,
    icon: 'cilLibrary',
  },
  features: [
    {
      name: 'Class Management',
      key: 'class.manage',
      order: 1,
      description: 'Manage tenant classes',
      path: '/classes',
      showInMenu: true,
    },
    {
      name: 'Lớp tôi phụ trách',
      key: 'class.teacher-workspace',
      order: 2,
      description: 'Teacher workspace for assigned classes',
      path: '/teacher/classes',
      showInMenu: true,
    },
    {
      name: 'Buổi học của tôi',
      key: 'class.teacher-sessions',
      order: 3,
      description: 'Teacher workspace for assigned class sessions',
      path: '/teacher/sessions',
      showInMenu: true,
    },
    {
      name: 'Tổng quan học tập',
      key: 'class.student-workspace',
      order: 4,
      description: 'Student portal overview for current learner context',
      path: '/student',
      showInMenu: true,
    },
    {
      name: 'Lớp của tôi',
      key: 'class.student-classes',
      order: 5,
      description: 'Student portal classes for current learner context',
      path: '/student/classes',
      showInMenu: true,
    },
    {
      name: 'Buổi học của tôi',
      key: 'class.student-sessions',
      order: 6,
      description: 'Student portal sessions for current learner context',
      path: '/student/sessions',
      showInMenu: true,
    },
  ],
}

export default classManagementFeatures