const learningManagementFeatures = {
  group: {
    name: 'Learning',
    code: 'learning',
    order: 13,
    icon: 'cilLibrary',
  },
  features: [
    {
      name: 'Learning Objects',
      key: 'learning.learning-object.manage',
      order: 1,
      description: 'Manage tenant learning objects and related study knowledge data',
      path: '/learning/learning-objects',
      showInMenu: true,
    },
    {
      name: 'Subjects',
      key: 'learning.subject.manage',
      order: 2,
      description: 'Manage tenant subjects for learning content',
      path: '/learning/subjects',
      showInMenu: true,
    },
    {
      name: 'Grades',
      key: 'learning.grade.manage',
      order: 3,
      description: 'Manage tenant grades for learning content',
      path: '/learning/grades',
      showInMenu: true,
    },
    {
      name: 'Questions',
      key: 'learning.question.manage',
      order: 4,
      description: 'Manage tenant questions and question options',
      path: '/learning/questions',
      showInMenu: true,
    },
    {
      name: 'Formulas',
      key: 'learning.formula.manage',
      order: 5,
      description: 'Manage tenant formulas and examples',
      path: '/learning/formulas',
      showInMenu: true,
    },
    {
      name: 'Nhập gói học liệu',
      key: 'learning.package-import.manage',
      order: 6,
      description: 'Validate, preview, and import learning content packages in tenant scope',
      path: '/learning/import-packages',
      showInMenu: true,
    },
  ],
}

export default learningManagementFeatures
