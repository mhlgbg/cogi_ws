import React from "react"
import { BrowserRouter, Navigate, Routes, Route } from "react-router-dom"
import { AuthProvider } from "./contexts/AuthContext"
import { IamProvider } from "./contexts/IamContext"
import ProtectedRoute from "./components/ProtectedRoute"
import RequirePermission from "./components/RequirePermission"
import RequireLeadership from "./components/RequireLeadership"
import AdminLayout from "./layouts/AdminLayout.jsx"
import Login from "./pages/Login"
import ForgotPassword from "./pages/ForgotPassword"
import ResetPassword from "./pages/ResetPassword"
import Activate from "./pages/Activate"
import SetPassword from "./pages/SetPassword"
import DashboardPage from "./pages/dashboard/DashboardPage"
import Profile from "./pages/Profile"
import ChangePassword from "./pages/ChangePassword"
import InviteUser from "./pages/InviteUser"
import Forbidden403 from "./pages/Forbidden403"
import RequestListPage from "./pages/requests/RequestListPage.jsx"
import RequestFormPage from "./pages/requests/RequestFormPage.jsx"
import RequestDetailPage from "./pages/requests/RequestDetailPage.jsx"
import RequestMonitorPage from "./pages/requests/RequestMonitorPage"
import RequestMonitorDetailPage from "./pages/requests/RequestMonitorDetailPage"

import RequestCategories from "./pages/RequestCategories"
import Users from "./pages/Users"
import PositionManager from "./pages/hr/PositionManager"
import EmployeeManager from "./pages/hr/EmployeeManager"
import EmployeeDetail from "./pages/hr/EmployeeDetail"
import ServiceOrderListPage from "./pages/service-orders/ServiceOrderListPage"
import ServiceOrderFormPage from "./pages/service-orders/ServiceOrderFormPage"
import ServiceOrderDetailPage from "./pages/service-orders/ServiceOrderDetailPage"
import SalesCounterPage from "./pages/sales-counter/SalesCounterPage"

export default function App() {
  return (
    <AuthProvider>
      <IamProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route path="/activate" element={<Activate />} />
            <Route path="/set-password" element={<SetPassword />} />

            <Route
              path="/*"
              element={
                <ProtectedRoute>
                  <AdminLayout>
                    <Routes>
                      <Route path="/" element={<Navigate to="/dashboard" replace />} />
                      <Route path="/dashboard" element={<DashboardPage />} />
                      <Route path="/profile" element={<Profile />} />
                      <Route path="/change-password" element={<ChangePassword />} />
                      <Route path="/403" element={<Forbidden403 />} />
                      <Route
                        path="/requests"
                        element={
                          <RequirePermission permissionRole="Admin">
                            <RequestListPage />
                          </RequirePermission>
                        }
                      />
                      <Route
                        path="/requests/new"
                        element={
                          <RequirePermission permissionRole="Admin">
                            <RequestFormPage />
                          </RequirePermission>
                        }
                      />
                      <Route
                        path="/requests/monitor"
                        element={
                          <RequirePermission permissionRole="Admin">
                            <RequestMonitorPage />
                          </RequirePermission>
                        }
                      />
                      <Route
                        path="/requests/monitor/:id"
                        element={
                          <RequirePermission permissionRole="Admin">
                            <RequestMonitorDetailPage />
                          </RequirePermission>
                        }
                      />
                      <Route
                        path="/requests/:id"
                        element={
                          <RequirePermission permissionRole="Admin">
                            <RequestDetailPage />
                          </RequirePermission>
                        }
                      />
                      <Route
                        path="/requests/:id/edit"
                        element={
                          <RequirePermission permissionRole="Admin">
                            <RequestFormPage />
                          </RequirePermission>
                        }
                      />
                      <Route
                        path="/request-categories"
                        element={
                          <RequirePermission permissionRole="Admin">
                            <RequestCategories />
                          </RequirePermission>
                        }
                      />
                      <Route
                        path="/positions"
                        element={
                          <RequirePermission permissionAnyRole={["Admin", "Sales Manager"]}>
                            <PositionManager />
                          </RequirePermission>
                        }
                      />
                      <Route
                        path="/employees"
                        element={
                          <RequirePermission permissionAnyRole={["Admin", "Sales Manager"]}>
                            <EmployeeManager />
                          </RequirePermission>
                        }
                      />
                      <Route
                        path="/employees/:id"
                        element={
                          <RequirePermission permissionAnyRole={["Admin", "Sales Manager"]}>
                            <EmployeeDetail />
                          </RequirePermission>
                        }
                      />
                      <Route
                        path="/sales-counter"
                        element={
                          <RequirePermission permissionAnyRole={["Sales Counter", "Sales Manager"
                          ]}>
                            <SalesCounterPage />
                          </RequirePermission>
                        }
                      />
                      <Route
                        path="/service-orders"
                        element={
                          <RequirePermission permissionAnyRole={["Admin", "Sales Manager"]}>
                            <ServiceOrderListPage />
                          </RequirePermission>
                        }
                      />
                      <Route
                        path="/service-orders/create"
                        element={
                          <RequirePermission permissionAnyRole={["Admin", "Sales Manager"]}>
                            <ServiceOrderFormPage />
                          </RequirePermission>
                        }
                      />
                      <Route
                        path="/service-orders/:id"
                        element={
                          <RequirePermission permissionAnyRole={["Admin", "Sales Manager"]}>
                            <ServiceOrderDetailPage />
                          </RequirePermission>
                        }
                      />
                      <Route
                        path="/service-orders/:id/edit"
                        element={
                          <RequirePermission permissionAnyRole={["Admin", "Sales Manager"]}>
                            <ServiceOrderFormPage />
                          </RequirePermission>
                        }
                      />
                      <Route
                        path="/users"
                        element={
                          <RequirePermission permissionAnyRole={["Admin"]}>
                            <Users />
                          </RequirePermission>
                        }
                      />
                      <Route
                        path="/invite-user"
                        element={
                          <RequirePermission permissionAnyRole={["Admin", "Sales Manager"]}>
                            <InviteUser />
                          </RequirePermission>
                        }
                      />
                    </Routes>
                  </AdminLayout>
                </ProtectedRoute>
              }
            />
          </Routes>
        </BrowserRouter>
      </IamProvider>
    </AuthProvider>
  )
}
