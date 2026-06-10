import ArticleManagementPage from '../pages/ArticleManagementPage'
import CategoryManagementPage from '../pages/CategoryManagementPage'
import AuthorManagementPage from '../pages/AuthorManagementPage'
import JournalCategoryManagementPage from '../pages/JournalCategoryManagementPage'
import JournalIssueManagementPage from '../pages/JournalIssueManagementPage'
import PublicPageManagementPage from '../pages/PublicPageManagementPage'
import TenantConfigManagementPage from '../pages/TenantConfigManagementPage'
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
    path: '/tenant/settings/website',
    title: 'Tenant settings',
    featureKey: 'tenant-setting.manage',
    component: TenantWebsiteSettingsPage,
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