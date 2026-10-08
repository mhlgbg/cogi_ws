import CommunityConfigManagementPage from '../pages/CommunityConfigManagementPage'
import CommunityGroupManagementPage from '../pages/CommunityGroupManagementPage'
import CommunityPostModerationPage from '../pages/CommunityPostModerationPage'

const communityRoutes = [
  {
    path: '/community/configs',
    title: 'Cấu hình Community',
    featureKey: 'community-config.manage',
    component: CommunityConfigManagementPage,
  },
  {
    path: '/community/groups/manage',
    title: 'Quản lý nhóm',
    featureKey: 'community-group.manage',
    component: CommunityGroupManagementPage,
  },
  {
    path: '/community/posts/manage',
    title: 'Quản lý bài viết',
    featureKey: 'community-post.manage',
    component: CommunityPostModerationPage,
  },
]

export default communityRoutes
