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
    {
      name: 'Survey Campaign Assignment Management',
      key: 'survey.campaign.assignment.manage',
      order: 3,
      description: 'Assign tenant users to manage specific survey campaigns',
      path: '/survey/campaigns',
      showInMenu: false,
    },
    {
      name: 'My Managed Survey Campaigns',
      key: 'survey.campaign.management',
      order: 4,
      description: 'Workspace for users assigned to manage survey campaigns',
      path: '/survey/my-campaigns',
      showInMenu: true,
    },
  ],
}

export default surveyCampaignFeatures