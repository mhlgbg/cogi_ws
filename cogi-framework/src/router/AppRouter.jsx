import { Navigate, Route, Routes } from 'react-router-dom'
import FeatureRoute from '../components/FeatureRoute'
import ProtectedRoute from '../components/ProtectedRoute'
import TenantRoute from '../components/TenantRoute'
import MainLayout from '../layouts/MainLayout'
import ChooseTenant from '../pages/ChooseTenant'
import Forbidden from '../pages/Forbidden'
import Login from '../pages/Login'
import NotFound from '../pages/NotFound'
import Activate from '../pages/Activate'
import SetPassword from '../pages/SetPassword'
import ForgotPassword from '../pages/ForgotPassword'
import ResetPassword from '../pages/ResetPassword'
import AdmissionLanding from '../pages/admission/AdmissionLanding.jsx'
import AdmissionV1EntryPage from '../modules/admission-v1/pages/AdmissionV1EntryPage'
import AdmissionV1DeclarantPage from '../modules/admission-v1/pages/AdmissionV1DeclarantPage'
import AdmissionV1EmailVerifyPage from '../modules/admission-v1/pages/AdmissionV1EmailVerifyPage'
import AdmissionV1TrackingPage from '../modules/admission-v1/pages/AdmissionV1TrackingPage'
import AdmissionV1FormPage from '../modules/admission-v1/pages/AdmissionV1FormPage'
import AdmissionResultLookupPage from '../modules/admission-v1/pages/AdmissionResultLookupPage'
import CandidateExamScoreLookupPage from '../modules/admission-v1/pages/CandidateExamScoreLookupPage'
import AdmissionPublicExamCardPage from '../modules/admission-v1/pages/AdmissionPublicExamCardPage'
import CandidateExamCardPage from '../modules/admission-management/pages/CandidateExamCardPage'
import PublicPageDetailPage from '../pages/public/PublicPageDetailPage'
import TenantEntryRedirect from '../components/TenantEntryRedirect'
import PublicLayout from '../layouts/PublicLayout'
import JournalHomePage from '../pages/journal/JournalHomePage'
import ArticleDetailPage from '../pages/journal/ArticleDetailPage'
import CategoryPage from '../pages/journal/CategoryPage'
import CategoryArchiveTreePage from '../pages/journal/CategoryArchiveTreePage'
import JournalIssueCategoryPage from '../pages/journal/JournalIssueCategoryPage'
import JournalIssueArchiveTreePage from '../pages/journal/JournalIssueArchiveTreePage'
import JournalIssueDetailPage from '../pages/journal/JournalIssueDetailPage'
import platformRoutes, { PlatformAccessGuard } from '../platform/routes/platformRoutes'
import { allModuleRoutes } from '../modules'
import PublicAnalyticsBoundary from './PublicAnalyticsBoundary'
import { tenantStaticRoutes } from './tenantStaticRoutes'

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
function renderModuleRoute({ path, featureKey, featureKeys, component: Component }) {
  if (!path || !Component) return null

  const nestedPath = toNestedPath(path)
  if (!nestedPath) return null // "/" is reserved for Dashboard index

  const element = featureKey || (Array.isArray(featureKeys) && featureKeys.length > 0)
    ? <FeatureRoute featureKey={featureKey} featureKeys={featureKeys}><Component /></FeatureRoute>
    : <Component />

  return <Route key={nestedPath} path={nestedPath} element={element} />
}

function renderStaticTenantRoute({ path, featureKey, component: Component }) {
  if (!path || !Component) return null

  const nestedPath = toNestedPath(path)
  if (!nestedPath) return null

  const element = featureKey
    ? <FeatureRoute featureKey={featureKey}><Component /></FeatureRoute>
    : <Component />

  return <Route key={`static:${nestedPath}`} path={nestedPath} element={element} />
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
      {tenantStaticRoutes.map((route) => renderStaticTenantRoute(route))}

      {allModuleRoutes.map((route) => renderModuleRoute({ ...route, key: `${keyPrefix}:${route.path}` }))}
      <Route path="*" element={<NotFound />} />
    </>
  )
}

function renderPlatformRoutes() {
  return platformRoutes.map((route, index) => {
    if (route.index) {
      return <Route key={`platform-index-${index}`} index element={route.element} />
    }

    return <Route key={`platform-${route.path || index}`} path={route.path} element={route.element} />
  })
}

export default function AppRouter() {
  return (
    <Routes>
      <Route element={<PublicAnalyticsBoundary />}>
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
        <Route path="/dang-ky-tuyen-sinh-v1/:campaignCode" element={<TenantRoute requireAuth={false}><AdmissionV1EntryPage /></TenantRoute>} />
        <Route path="/dang-ky-tuyen-sinh-v1/:campaignCode/nguoi-khai" element={<TenantRoute requireAuth={false}><AdmissionV1DeclarantPage /></TenantRoute>} />
        <Route path="/dang-ky-tuyen-sinh-v1/:campaignCode/ma-ho-so" element={<TenantRoute requireAuth={false}><AdmissionV1EmailVerifyPage /></TenantRoute>} />
        <Route path="/dang-ky-tuyen-sinh-v1/:campaignCode/xac-minh-email" element={<TenantRoute requireAuth={false}><AdmissionV1EmailVerifyPage /></TenantRoute>} />
        <Route path="/dang-ky-tuyen-sinh-v1/:campaignCode/theo-doi" element={<TenantRoute requireAuth={false}><AdmissionV1TrackingPage /></TenantRoute>} />
        <Route path="/dang-ky-tuyen-sinh-v1/:campaignCode/ho-so" element={<TenantRoute requireAuth={false}><AdmissionV1FormPage /></TenantRoute>} />
        <Route path="/tra-cuu-tuyen-sinh/:campaignCode" element={<TenantRoute requireAuth={false}><AdmissionResultLookupPage /></TenantRoute>} />
        <Route path="/tra-cuu-diem/:campaignCode" element={<TenantRoute requireAuth={false}><CandidateExamScoreLookupPage /></TenantRoute>} />
        <Route path="/tra-cuu-tuyen-sinh/:campaignCode/the-du-kiem-tra" element={<TenantRoute requireAuth={false}><AdmissionPublicExamCardPage /></TenantRoute>} />
        <Route path="/t/:tenantCode/dang-ky-tuyen-sinh-v1/:campaignCode" element={<TenantRoute requireAuth={false}><AdmissionV1EntryPage /></TenantRoute>} />
        <Route path="/t/:tenantCode/dang-ky-tuyen-sinh-v1/:campaignCode/nguoi-khai" element={<TenantRoute requireAuth={false}><AdmissionV1DeclarantPage /></TenantRoute>} />
        <Route path="/t/:tenantCode/dang-ky-tuyen-sinh-v1/:campaignCode/ma-ho-so" element={<TenantRoute requireAuth={false}><AdmissionV1EmailVerifyPage /></TenantRoute>} />
        <Route path="/t/:tenantCode/dang-ky-tuyen-sinh-v1/:campaignCode/xac-minh-email" element={<TenantRoute requireAuth={false}><AdmissionV1EmailVerifyPage /></TenantRoute>} />
        <Route path="/t/:tenantCode/dang-ky-tuyen-sinh-v1/:campaignCode/theo-doi" element={<TenantRoute requireAuth={false}><AdmissionV1TrackingPage /></TenantRoute>} />
        <Route path="/t/:tenantCode/dang-ky-tuyen-sinh-v1/:campaignCode/ho-so" element={<TenantRoute requireAuth={false}><AdmissionV1FormPage /></TenantRoute>} />
        <Route path="/t/:tenantCode/tra-cuu-tuyen-sinh/:campaignCode" element={<TenantRoute requireAuth={false}><AdmissionResultLookupPage /></TenantRoute>} />
        <Route path="/t/:tenantCode/tra-cuu-diem/:campaignCode" element={<TenantRoute requireAuth={false}><CandidateExamScoreLookupPage /></TenantRoute>} />
        <Route path="/t/:tenantCode/tra-cuu-tuyen-sinh/:campaignCode/the-du-kiem-tra" element={<TenantRoute requireAuth={false}><AdmissionPublicExamCardPage /></TenantRoute>} />

        <Route
          path="/"
          element={(
            <TenantRoute requireAuth={false}>
              <PublicLayout />
            </TenantRoute>
          )}
        >
          <Route path="journal" element={<JournalHomePage />} />
          <Route path="page/:slug" element={<PublicPageDetailPage />} />
          <Route path="article/:slug" element={<ArticleDetailPage />} />
          <Route path="category/:slug" element={<CategoryPage />} />
          <Route path="journal-category/:slug" element={<JournalIssueCategoryPage />} />
          <Route path="journal-archive/:slug" element={<JournalIssueArchiveTreePage />} />
          <Route path="journal-issue/:slug" element={<JournalIssueDetailPage />} />
          <Route path="archive/:slug" element={<CategoryArchiveTreePage />} />
        </Route>

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
          <Route path="page/:slug" element={<PublicPageDetailPage />} />
          <Route path="article/:slug" element={<ArticleDetailPage />} />
          <Route path="category/:slug" element={<CategoryPage />} />
          <Route path="journal-category/:slug" element={<JournalIssueCategoryPage />} />
          <Route path="journal-archive/:slug" element={<JournalIssueArchiveTreePage />} />
          <Route path="journal-issue/:slug" element={<JournalIssueDetailPage />} />
          <Route path="archive/:slug" element={<CategoryArchiveTreePage />} />
        </Route>
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
        path="/admission/candidate-exams/:id/exam-card"
        element={(
          <TenantRoute>
            <FeatureRoute featureKey="admission.candidate-exam.manage">
              <CandidateExamCardPage />
            </FeatureRoute>
          </TenantRoute>
        )}
      />

      <Route
        path="/t/:tenantCode/admission/candidate-exams/:id/exam-card"
        element={(
          <TenantRoute>
            <FeatureRoute featureKey="admission.candidate-exam.manage">
              <CandidateExamCardPage />
            </FeatureRoute>
          </TenantRoute>
        )}
      />

      <Route
        path="/platform"
        element={(
          <ProtectedRoute requireTenant={false}>
            <PlatformAccessGuard>
              <MainLayout />
            </PlatformAccessGuard>
          </ProtectedRoute>
        )}
      >
        {renderPlatformRoutes()}
        <Route path="forbidden" element={<Forbidden />} />
        <Route path="*" element={<NotFound />} />
      </Route>

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