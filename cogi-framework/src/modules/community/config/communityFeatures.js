const communityFeatures = {
  group: {
    name: 'Community',
    code: 'community',
    order: 23,
    icon: 'cilPeople',
  },
  features: [
    {
      name: 'Quản lý CommunityConfig',
      key: 'community-config.manage',
      order: 1,
      description: 'Quản lý cấu hình Community theo từng giai đoạn của tenant.',
      path: '/community/configs',
      showInMenu: true,
    },
    {
      name: 'Quản lý bài viết',
      key: 'community-post.manage',
      order: 2,
      description: 'Vận hành CommunityPost: duyệt, publish, hide, pin, feature, chỉnh sửa và xóa mềm.',
      path: '/community/posts/manage',
      showInMenu: true,
    },
    {
      name: 'Quản lý Community Groups',
      key: 'community-group.manage',
      order: 3,
      description: 'Quản lý CommunityGroup và thành viên theo tenant.',
      path: '/community/groups/manage',
      showInMenu: true,
    },
  ],
}

export default communityFeatures
