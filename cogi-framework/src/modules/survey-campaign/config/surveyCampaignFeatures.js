const surveyCampaignFeatures = {
  group: {
    name: 'Survey',
    code: 'survey',
    order: 12,
    icon: 'cilDescription',
  },
  features: [
    {
      name: 'Survey Campaign Management',
      key: 'survey.campaign.manage',
      order: 2,
      description: 'Manage survey campaigns in tenant scope',
      path: '/survey/campaigns',
      showInMenu: true,
    },
  ],
}

export default surveyCampaignFeatures