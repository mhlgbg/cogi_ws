const departmentFeatures = {
  group: {
    name: "Department",
    code: "department",
    order: 3,
    icon: "cilBuilding",
  },
  features: [
    {
      name: "Department Management",
      key: "departments.manage",
      order: 1,
      description: "Department management page",
      path: "/departments",
      showInMenu: true,
    },
  ],
};

export default departmentFeatures;
