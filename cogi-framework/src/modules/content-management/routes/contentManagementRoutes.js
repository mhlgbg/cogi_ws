import ArticleManagementPage from '../pages/ArticleManagementPage'
import CategoryManagementPage from '../pages/CategoryManagementPage'
import AuthorManagementPage from '../pages/AuthorManagementPage'
import JournalCategoryManagementPage from '../pages/JournalCategoryManagementPage'
import JournalIssueManagementPage from '../pages/JournalIssueManagementPage'
import TenantConfigManagementPage from '../pages/TenantConfigManagementPage'

const contentManagementRoutes = [
  {
    path: '/articles',
    featureKey: 'article.manage',
    component: ArticleManagementPage,
  },
  {
    path: '/categories',
    featureKey: 'category.manage',
    component: CategoryManagementPage,
  },
  {
    path: '/authors',
    featureKey: 'author.manage',
    component: AuthorManagementPage,
  },
  {
    path: '/tenant-configs',
    featureKey: 'tenant-config.manage',
    component: TenantConfigManagementPage,
  },
  {
    path: '/journal-categories',
    featureKey: 'journal-category.manage',
    component: JournalCategoryManagementPage,
  },
  {
    path: '/journal-issues',
    featureKey: 'journal-issue.manage',
    component: JournalIssueManagementPage,
  },
]

export default contentManagementRoutes