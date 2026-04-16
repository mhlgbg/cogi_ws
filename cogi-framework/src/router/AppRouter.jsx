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
import AdmissionLanding from '../pages/admission/AdmissionLanding.jsx'
import TenantEntryRedirect from '../components/TenantEntryRedirect'
import PublicLayout from '../layouts/PublicLayout'
import JournalHomePage from '../pages/journal/JournalHomePage'
import ArticleDetailPage from '../pages/journal/ArticleDetailPage'
import CategoryPage from '../pages/journal/CategoryPage'
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

function renderAppShellRoutes(keyPrefix = 'root', options = {}) {
  const includeIndex = options.includeIndex !== false

  return (
    <>
      {includeIndex ? (
        <Route
          index
          element={<Navigate to="dashboard" replace />}
        />
      ) : null}
      <Route
        path="dashboard"
        element={(
          <FeatureRoute featureKey="dashboard.view">
            <Dashboard />
          </FeatureRoute>
        )}
      />

      {allModuleRoutes.map((route) => renderModuleRoute({ ...route, key: `${keyPrefix}:${route.path}` }))}

      <Route path="change-password" element={<ChangePassword />} />
      <Route path="forbidden" element={<Forbidden />} />
      <Route path="*" element={<NotFound />} />
    </>
  )
}

export default function AppRouter() {
  return (
    <Routes>
      <Route path="/" element={<TenantEntryRedirect />} />
      <Route path="/login" element={<TenantRoute requireAuth={false}><Login /></TenantRoute>} />
      <Route path="/:tenantCode/login" element={<TenantRoute requireAuth={false}><Login /></TenantRoute>} />
      <Route path="/t/:tenantCode/login" element={<TenantRoute requireAuth={false}><Login /></TenantRoute>} />
      <Route path="/forgot-password" element={<TenantRoute requireAuth={false}><ForgotPassword /></TenantRoute>} />
      <Route path="/t/:tenantCode/forgot-password" element={<TenantRoute requireAuth={false}><ForgotPassword /></TenantRoute>} />
      <Route path="/reset-password" element={<TenantRoute requireAuth={false}><ResetPassword /></TenantRoute>} />
      <Route path="/t/:tenantCode/reset-password" element={<TenantRoute requireAuth={false}><ResetPassword /></TenantRoute>} />
      <Route path="/activate" element={<TenantRoute requireAuth={false}><Activate /></TenantRoute>} />
      <Route path="/t/:tenantCode/activate" element={<TenantRoute requireAuth={false}><Activate /></TenantRoute>} />
      <Route path="/set-password" element={<TenantRoute requireAuth={false}><SetPassword /></TenantRoute>} />
      <Route path="/t/:tenantCode/set-password" element={<TenantRoute requireAuth={false}><SetPassword /></TenantRoute>} />
      <Route path="/dang-ky-tuyen-sinh" element={<TenantRoute requireAuth={false}><AdmissionLanding /></TenantRoute>} />
      <Route path="/dang-ky-tuyen-sinh/:campaignCode" element={<TenantRoute requireAuth={false}><AdmissionLanding /></TenantRoute>} />
      <Route path="/t/:tenantCode/:campaignCode" element={<TenantRoute requireAuth={false}><AdmissionLanding /></TenantRoute>} />
      <Route path="/t/:tenantCode/dang-ky-tuyen-sinh" element={<TenantRoute requireAuth={false}><AdmissionLanding /></TenantRoute>} />
      <Route path="/t/:tenantCode/dang-ky-tuyen-sinh/:campaignCode" element={<TenantRoute requireAuth={false}><AdmissionLanding /></TenantRoute>} />

      <Route
        path="/t/:tenantCode"
        element={(
          <TenantRoute requireAuth={false}>
            <PublicLayout />
          </TenantRoute>
        )}
      >
        <Route index element={<JournalHomePage />} />
        <Route path="journal" element={<JournalHomePage />} />
        <Route path="article/:slug" element={<ArticleDetailPage />} />
        <Route path="category/:slug" element={<CategoryPage />} />
      </Route>

      <Route
        path="/choose-tenant"
        element={(
          <ProtectedRoute requireTenant={false}>
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
        {renderAppShellRoutes('root')}
      </Route>

      <Route
        path="/t/:tenantCode"
        element={(
          <TenantRoute>
            <MainLayout />
          </TenantRoute>
        )}
      >
        {renderAppShellRoutes('tenant-path', { includeIndex: false })}
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}