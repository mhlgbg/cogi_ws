module.exports = {
  group: {
    name: "HRM",
    code: "hrm",
    order: 1,
    icon: "cilPeople",
  },
  features: [
    {
      name: 'Employee Management',
      key: 'employees.manage',
      order: 1,
      description: 'Employee management module',
      path: '/employees',
      icon: 'cilPeople',
      showInMenu: true,
    },
  ],
}
