const navigation = [
  { type: "item", name: "Dashboard", to: "/dashboard", permissionRole: null },


  { type: "title", name: "Request" },
  {
    type: "item",
    name: "Tạo yêu cầu mới",
    to: "/requests/new",
    permissionRole: "Admin",              // ✅ đổi
  },
  {
    type: "item",
    name: "Danh sách yêu cầu",
    to: "/requests",
    permissionRole: "Admin",              // ✅ đổi
  },
  {
    type: "item",
    name: "Theo dõi Requests",
    to: "/requests/monitor",
    permissionRole: "Admin"

  },
  {
    type: "item",
    name: "Loại công việc",
    to: "/request-categories",
    permissionRole: "Admin",    // ✅ đổi
  },
  {
    type: "item",
    name: "Positions",
    to: "/positions",
    permissionAnyRole: [
      "Admin",
      "Sales Manager",
    ],
  },

  { type: "title", name: "Service Sales" },
  {
    type: "item",
    name: "Quầy bán hàng",
    to: "/sales-counter",
    permissionAnyRole: ["Sales Counter", "Sales Manager"],
  },
  {
    type: "item",
    name: "Danh sách đơn hàng",
    to: "/service-orders",
    //permissionRole: "Admin",          // ✅ đổi
    permissionAnyRole: [
      "Admin",
      "Sales Manager",
    ],
  },

  { type: "title", name: "Human Resources" },
  {
    type: "item",
    name: "Employees",
    to: "/employees",
    permissionAnyRole: [
      "Admin",
      "Sales Manager",
    ],
  },

  { type: "title", name: "Hệ thống" },
  {
    type: "item",
    name: "Người dùng",
    to: "/users",
    permissionRole: "Admin",                 // ✅ đổi
  },
  {
    type: "item",
    name: "Mời user",
    to: "/invite-user",
    permissionAnyRole: [
      "Admin",
      "Sales Manager",
    ],        // ✅ đổi
  },
  {
    type: "item",
    name: "Profile",
    to: "/profile",
    permissionRole: null,
  },
]

export default navigation