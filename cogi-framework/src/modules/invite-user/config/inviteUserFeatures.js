const inviteUserFeatures = {
  group: {
    name: 'User Management',
    code: 'user',
    order: 10,
    icon: 'cilPerson',
  },
  features: [
    {
      name: 'Invite User',
      key: 'user.invite',
      order: 1,
      description: 'Invite users to tenant',
      path: '/invite-user',
      showInMenu: true,
    },
  ],
}

export default inviteUserFeatures
