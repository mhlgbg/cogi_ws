'use strict';

module.exports = {
  group: {
    name: 'Survey',
    code: 'survey',
    order: 12,
    icon: 'cilDescription',
  },
  features: [
    {
      name: 'Survey List',
      key: 'survey.list',
      order: 1,
      description: 'End-user survey assignments and submission flow',
      path: '/survey',
      icon: 'cilDescription',
      showInMenu: true,
    },
    {
      name: 'Survey Question Management',
      key: 'survey.question.manage',
      order: 2,
      description: 'Manage survey templates, sections, and questions in tenant scope',
      path: '/survey/question-bank',
      icon: 'cilNotes',
      showInMenu: true,
    },
    {
      name: 'Survey Campaign Management',
      key: 'survey.campaign.manage',
      order: 3,
      description: 'Manage survey campaigns in tenant scope',
      path: '/survey/campaigns',
      icon: 'cilClipboard',
      showInMenu: true,
    },
  ],
};