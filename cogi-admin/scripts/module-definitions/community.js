module.exports = {
  group: {
    name: 'Community',
    code: 'community',
    order: 23,
    icon: 'cilPeople',
  },
  features: [
    {
      name: 'Community Config Manage',
      key: 'community-config.manage',
      order: 1,
      description: 'Manage tenant Community configuration versions and activation workflow',
      path: '/community/configs',
      icon: 'cilPeople',
      showInMenu: true,
    },
    {
      name: 'Community Post Manage',
      key: 'community-post.manage',
      order: 2,
      description: 'Moderate and operate community posts in current tenant',
      path: '/community/posts/manage',
      icon: 'cilPeople',
      showInMenu: true,
      upload: {
        enabled: true,
        moduleKey: 'community',
        featureKey: 'community-post.manage',
        entityType: 'community-post',
      },
    },
    {
      name: 'Community Group Manage',
      key: 'community-group.manage',
      order: 3,
      description: 'Manage community groups and memberships in current tenant',
      path: '/community/groups/manage',
      icon: 'cilPeople',
      showInMenu: true,
    },
  ],
}
