const registrationCampaignFeatures = {
  group: {
    name: 'Chiến dịch đăng ký',
    code: 'registration-campaign',
    order: 92,
    icon: 'cilUserPlus',
  },
  features: [
    {
      name: 'Quản lý chiến dịch đăng ký',
      key: 'registration-campaign.manage',
      order: 1,
      description: 'Quản lý chiến dịch đăng ký người dùng vào tenant',
      path: '/registration-campaigns',
      showInMenu: true,
    },
  ],
}

export default registrationCampaignFeatures