'use strict';

module.exports = {
  group: {
    name: 'Admission',
    code: 'admission',
    order: 16,
    icon: 'cilEducation',
  },
  features: [
    {
      name: 'Admission Dashboard',
      key: 'admission.dashboard.view',
      order: 0,
      description: 'View and manage my admission applications in the current tenant',
      path: '/admission/dashboard',
      icon: 'cilEducation',
      showInMenu: true,
    },
    {
      name: 'Admission Campaign Management',
      key: 'admission.campaign.manage',
      order: 1,
      description: 'Manage tenant admission campaigns',
      path: '/admission/campaigns',
      icon: 'cilClipboard',
      showInMenu: true,
    },
    {
      name: 'Form Template Management',
      key: 'admission.form-template.manage',
      order: 2,
      description: 'Manage tenant admission form templates and versions',
      path: '/admission/form-templates',
      icon: 'cilDescription',
      showInMenu: true,
    },
    {
      name: 'Notification Template Management',
      key: 'admission.notification-template.manage',
      order: 3,
      description: 'Manage tenant notification templates for admissions and OTP',
      path: '/admission/notification-templates',
      icon: 'cilEnvelopeOpen',
      showInMenu: true,
    },
    {
      name: 'Admission Review',
      key: 'admission.review.manage',
      order: 4,
      description: 'Review submitted admission applications',
      path: '/admission/reviews',
      icon: 'cilTask',
      showInMenu: true,
    },
  ],
};