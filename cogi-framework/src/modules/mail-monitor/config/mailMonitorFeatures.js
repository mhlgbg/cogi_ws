const mailMonitorFeatures = {
  group: {
    name: 'System',
    code: 'system',
    order: 90,
    icon: 'cilSettings',
  },
  features: [
    {
      name: 'Mail Monitor',
      key: 'system.mailMonitor',
      order: 1,
      description: 'View and manage tenant mail queue logs and delivery status',
      path: '/system/mail-monitor',
      showInMenu: true,
    },
  ],
}

export default mailMonitorFeatures