import ArticleManagementPage from '../pages/ArticleManagementPage'
import CategoryManagementPage from '../pages/CategoryManagementPage'
import AuthorManagementPage from '../pages/AuthorManagementPage'
import JournalCategoryManagementPage from '../pages/JournalCategoryManagementPage'
import JournalIssueManagementPage from '../pages/JournalIssueManagementPage'
import PublicPageManagementPage from '../pages/PublicPageManagementPage'
import TenantPaymentProfileCreatePage from '../pages/TenantPaymentProfileCreatePage'
import TenantPaymentProfileDetailPage from '../pages/TenantPaymentProfileDetailPage'
import TenantConfigManagementPage from '../pages/TenantConfigManagementPage'
import TenantPaymentProfilesPage from '../pages/TenantPaymentProfilesPage'
import TenantSettingsPage from '../pages/TenantSettingsPage'
import TenantWebsiteSettingsPage from '../pages/TenantWebsiteSettingsPage'

const contentManagementRoutes = [
  {
    path: '/articles',
    title: 'Bài viết',
    featureKey: 'article.manage',
    component: ArticleManagementPage,
  },
  {
    path: '/categories',
    title: 'Danh mục bài viết',
    featureKey: 'category.manage',
    component: CategoryManagementPage,
  },
  {
    path: '/authors',
    title: 'Tác giả',
    featureKey: 'author.manage',
    component: AuthorManagementPage,
  },
  {
    path: '/tenant-configs',
    title: 'Tenant config',
    featureKey: 'tenant-config.manage',
    component: TenantConfigManagementPage,
  },
  {
    path: '/tenant/settings',
    title: 'Cấu hình tenant',
    featureKey: 'tenant-setting.manage',
    component: TenantSettingsPage,
  },
  {
    path: '/tenant/settings/website',
    title: 'Cấu hình tenant / Website',
    featureKey: 'tenant-setting.manage',
    component: TenantWebsiteSettingsPage,
  },
  {
    path: '/tenant/settings/payment-profiles',
    title: 'Cấu hình tenant / Hồ sơ thanh toán',
    featureKey: 'tenant-setting.manage',
    component: TenantPaymentProfilesPage,
  },
  {
    path: '/tenant/settings/payment-profiles/new',
    title: 'Cấu hình tenant / Hồ sơ thanh toán / Thêm mới',
    featureKey: 'tenant-setting.manage',
    component: TenantPaymentProfileCreatePage,
  },
  {
    path: '/tenant/settings/payment-profiles/:id',
    title: 'Cấu hình tenant / Hồ sơ thanh toán / Chi tiết',
    featureKey: 'tenant-setting.manage',
    component: TenantPaymentProfileDetailPage,
  },
  {
    path: '/journal-categories',
    title: 'Chuyên mục tạp chí',
    featureKey: 'journal-category.manage',
    component: JournalCategoryManagementPage,
  },
  {
    path: '/journal-issues',
    title: 'Số tạp chí',
    featureKey: 'journal-issue.manage',
    component: JournalIssueManagementPage,
  },
  {
    path: '/public-pages',
    title: 'PublicPage',
    featureKey: 'public-page.manage',
    component: PublicPageManagementPage,
  },
]

export default contentManagementRoutes