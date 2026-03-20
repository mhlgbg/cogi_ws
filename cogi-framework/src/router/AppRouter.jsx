import { Navigate, Route, Routes } from 'react-router-dom'
import FeatureRoute from '../components/FeatureRoute'
import ProtectedRoute from '../components/ProtectedRoute'
import TenantRoute from '../components/TenantRoute'
import MainLayout from '../layouts/MainLayout'
import ChooseTenant from '../pages/ChooseTenant'
import Dashboard from '../pages/Dashboard'
import Forbidden from '../pages/Forbidden'
import Login from '../pages/Login'
import NotFound from '../pages/NotFound'
import Activate from '../pages/Activate'
import SetPassword from '../pages/SetPassword'
import ForgotPassword from '../pages/ForgotPassword'
import ResetPassword from '../pages/ResetPassword'
import ChangePassword from '../pages/ChangePassword'
import { allModuleRoutes } from '../modules'

/**
 * Normalize a registry path for use inside a nested <Route>.
 * Strips leading slash so React Router doesn't treat it as absolute.
 * Returns null for the root "/" path (reserved for the index route).
 */
function toNestedPath(registryPath) {
  const stripped = registryPath.replace(/^\/+/, '')
  return stripped || null
}

/**
 * Build a <Route> element for one module route entry.
 * Returns null if the entry is invalid (missing path or component).
 */
function renderModuleRoute({ path, featureKey, component: Component }) {
  if (!path || !Component) return null

  const nestedPath = toNestedPath(path)
  if (!nestedPath) return null // "/" is reserved for Dashboard index

  const element = featureKey
    ? <FeatureRoute featureKey={featureKey}><Component /></FeatureRoute>
    : <Component />

  return <Route key={nestedPath} path={nestedPath} element={element} />
}

export default function AppRouter() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/reset-password" element={<ResetPassword />} />
      <Route path="/activate" element={<Activate />} />
      <Route path="/set-password" element={<SetPassword />} />

      <Route
        path="/choose-tenant"
        element={(
          <ProtectedRoute>
            <ChooseTenant />
          </ProtectedRoute>
        )}
      />

      <Route
        path="/"
        element={(
          <TenantRoute>
            <MainLayout />
          </TenantRoute>
        )}
      >
        {/* Dashboard — always present as index route */}
        <Route
          index
          element={(
            <FeatureRoute featureKey="dashboard.view">
              <Dashboard />
            </FeatureRoute>
          )}
        />

        {/* Module routes — driven by registry */}
        {allModuleRoutes.map(renderModuleRoute)}

        <Route path="change-password" element={<ChangePassword />} />
        <Route path="forbidden" element={<Forbidden />} />
        <Route path="*" element={<NotFound />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}