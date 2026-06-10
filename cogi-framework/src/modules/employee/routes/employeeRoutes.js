import EmployeePage from "../pages/EmployeePage";

const employeeRoutes = [
  {
    path: "/employees",
    title: 'Nhân viên',
    featureKey: "employees.manage",
    component: EmployeePage,
  },
];

export default employeeRoutes;
