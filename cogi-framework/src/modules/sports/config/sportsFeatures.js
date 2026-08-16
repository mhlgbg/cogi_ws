const sportsFeatures = {
  group: {
    name: 'COGI Sports',
    code: 'sports',
    order: 22,
    icon: 'cilChartLine',
  },
  features: [
    {
      name: 'Sports Profiles',
      key: 'sports-profile.manage',
      order: 1,
      description: 'Quản lý hồ sơ thể thao theo tenant, độc lập với Strava',
      path: '/sports/profiles',
      showInMenu: true,
    },
    {
      name: 'Sports Clubs',
      key: 'sports-club.manage',
      order: 2,
      description: 'Quản lý câu lạc bộ thể thao theo tenant, độc lập với Strava',
      path: '/sports/clubs',
      showInMenu: true,
    },
    {
      name: 'Club Memberships',
      key: 'club-membership.manage',
      order: 3,
      description: 'Quản lý quan hệ thành viên hiện tại giữa Sports Profile và Sports Club',
      path: '/sports/memberships',
      showInMenu: true,
    },
    {
      name: 'Sports Achievements',
      key: 'sports-achievement.manage',
      order: 4,
      description: 'Quản lý các thành tích thể thao đã được ghi nhận trong tenant',
      path: '/sports/achievements',
      showInMenu: true,
    },
    {
      name: 'Achievement Submissions',
      key: 'sports-achievement-submission.manage',
      order: 5,
      description: 'Quản lý quy trình đề nghị và xét duyệt thành tích thể thao',
      path: '/sports/achievement-submissions',
      showInMenu: true,
    },
    {
      name: 'Phân công quản lý CLB',
      key: 'sports-club-user-assignment.manage',
      order: 6,
      description: 'Quản lý User nào được phân công quản lý Club nào trong tenant',
      path: '/sports/club-user-assignments',
      showInMenu: true,
    },
    {
      name: 'CLB tôi quản lý',
      key: 'sports-club.management',
      order: 7,
      description: 'Workspace vận hành cho User được phân công quản lý Club',
      path: '/sports/my-clubs',
      showInMenu: true,
    },
  ],
}

export default sportsFeatures