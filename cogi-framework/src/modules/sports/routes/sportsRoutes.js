import SportsProfileCreatePage from '../pages/SportsProfileCreatePage'
import SportsProfileDetailPage from '../pages/SportsProfileDetailPage'
import SportsMePage from '../pages/SportsMePage'
import SportsProfilesPage from '../pages/SportsProfilesPage'
import SportsClubCreatePage from '../pages/SportsClubCreatePage'
import SportsClubDetailPage from '../pages/SportsClubDetailPage'
import SportsClubsPage from '../pages/SportsClubsPage'
import ClubMembershipCreatePage from '../pages/ClubMembershipCreatePage'
import ClubMembershipDetailPage from '../pages/ClubMembershipDetailPage'
import ClubMembershipsPage from '../pages/ClubMembershipsPage'
import SportsAchievementCreatePage from '../pages/SportsAchievementCreatePage'
import SportsAchievementDetailPage from '../pages/SportsAchievementDetailPage'
import SportsAchievementsPage from '../pages/SportsAchievementsPage'
import SportsAchievementSubmissionCreatePage from '../pages/SportsAchievementSubmissionCreatePage'
import SportsAchievementSubmissionDetailPage from '../pages/SportsAchievementSubmissionDetailPage'
import SportsAchievementSubmissionsPage from '../pages/SportsAchievementSubmissionsPage'
import SportsClubUserAssignmentsPage from '../pages/SportsClubUserAssignmentsPage'
import MyManagedClubsPage from '../pages/MyManagedClubsPage'
import ManagedClubWorkspacePage from '../pages/ManagedClubWorkspacePage'
import ManagedClubMemberDetailPage from '../pages/ManagedClubMemberDetailPage'

function withFeatureKey(featureKey, routes) {
  return routes.map((route) => ({
    ...route,
    featureKey,
  }))
}

const sportsSelfRoutes = [
  {
    path: '/sports/me',
    title: 'Hồ sơ thể thao của tôi',
    component: SportsMePage,
  },
  {
    path: '/sports/me/:meTabKey',
    title: 'Hồ sơ thể thao của tôi / Tab',
    component: SportsMePage,
  },
]

const sportsProfileRoutes = withFeatureKey('sports-profile.manage', [
  {
    path: '/sports/profiles',
    title: 'Hồ sơ thể thao',
    component: SportsProfilesPage,
  },
  {
    path: '/sports/profiles/new',
    title: 'Hồ sơ thể thao / Thêm mới',
    component: SportsProfileCreatePage,
  },
  {
    path: '/sports/profiles/:id',
    title: 'Hồ sơ thể thao / Chi tiết',
    component: SportsProfileDetailPage,
  },
])

const sportsClubRoutes = withFeatureKey('sports-club.manage', [
  {
    path: '/sports/clubs',
    title: 'Câu lạc bộ thể thao',
    component: SportsClubsPage,
  },
  {
    path: '/sports/clubs/new',
    title: 'Câu lạc bộ thể thao / Thêm mới',
    component: SportsClubCreatePage,
  },
  {
    path: '/sports/clubs/:id',
    title: 'Câu lạc bộ thể thao / Chi tiết',
    component: SportsClubDetailPage,
  },
])

const clubMembershipRoutes = withFeatureKey('club-membership.manage', [
  {
    path: '/sports/memberships',
    title: 'Club Memberships',
    component: ClubMembershipsPage,
  },
  {
    path: '/sports/memberships/new',
    title: 'Club Memberships / Thêm mới',
    component: ClubMembershipCreatePage,
  },
  {
    path: '/sports/memberships/:id',
    title: 'Club Memberships / Chi tiết',
    component: ClubMembershipDetailPage,
  },
])

const ACHIEVEMENT_FEATURE_KEY = 'sports-achievement.manage'
const ACHIEVEMENT_SUBMISSION_FEATURE_KEY = 'sports-achievement-submission.manage'
const MANAGED_CLUB_FEATURE_KEY = 'sports-club.management'

const achievementRoutes = withFeatureKey(ACHIEVEMENT_FEATURE_KEY, [
  {
    path: '/sports/achievements',
    title: 'Sports Achievements',
    component: SportsAchievementsPage,
  },
  {
    path: '/sports/achievements/new',
    title: 'Sports Achievements / Thêm mới',
    component: SportsAchievementCreatePage,
  },
  {
    path: '/sports/achievements/:id',
    title: 'Sports Achievements / Chi tiết',
    component: SportsAchievementDetailPage,
  },
])

const achievementSubmissionRoutes = withFeatureKey(ACHIEVEMENT_SUBMISSION_FEATURE_KEY, [
  {
    path: '/sports/achievement-submissions',
    title: 'Achievement Submissions',
    component: SportsAchievementSubmissionsPage,
  },
  {
    path: '/sports/achievement-submissions/new',
    title: 'Achievement Submissions / Thêm mới',
    component: SportsAchievementSubmissionCreatePage,
  },
  {
    path: '/sports/achievement-submissions/:id',
    title: 'Achievement Submissions / Chi tiết',
    component: SportsAchievementSubmissionDetailPage,
  },
])

const sportsClubUserAssignmentRoutes = withFeatureKey('sports-club-user-assignment.manage', [
  {
    path: '/sports/club-user-assignments',
    title: 'Phân công quản lý CLB',
    component: SportsClubUserAssignmentsPage,
  },
])

const managedClubRoutes = withFeatureKey(MANAGED_CLUB_FEATURE_KEY, [
  {
    path: '/sports/my-clubs',
    title: 'CLB tôi quản lý',
    component: MyManagedClubsPage,
  },
  {
    path: '/sports/my-clubs/:clubId',
    title: 'Club Management Workspace',
    component: ManagedClubWorkspacePage,
  },
  {
    path: '/sports/my-clubs/:clubId/members/:membershipId',
    title: 'Chi tiết thành viên CLB',
    component: ManagedClubMemberDetailPage,
  },
  {
    path: '/sports/my-clubs/:clubId/members/:membershipId/:memberTabKey',
    title: 'Chi tiết thành viên CLB / Tab',
    component: ManagedClubMemberDetailPage,
  },
  {
    path: '/sports/my-clubs/:clubId/:tabKey',
    title: 'Club Management Workspace / Tab',
    component: ManagedClubWorkspacePage,
  },
])

const sportsRoutes = [
  ...sportsSelfRoutes,
  ...sportsProfileRoutes,
  ...sportsClubRoutes,
  ...clubMembershipRoutes,
  ...achievementRoutes,
  ...achievementSubmissionRoutes,
  ...sportsClubUserAssignmentRoutes,
  ...managedClubRoutes,
]

export default sportsRoutes