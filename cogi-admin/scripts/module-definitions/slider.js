module.exports = {
  group: {
    name: 'Slider',
    code: 'slider',
    order: 13,
    icon: 'cilImagePlus',
  },
  features: [
    {
      name: 'Sliders',
      key: 'slider.manage',
      order: 1,
      description: 'Manage sliders in current tenant',
      path: '/sliders',
      icon: 'cilImagePlus',
      showInMenu: true,
    },
    {
      name: 'Slider Item Manage',
      key: 'slider-item.manage',
      order: 2,
      description: 'Manage slider items in current tenant',
      path: '/slider-items',
      icon: 'cilImage',
      showInMenu: false,
    },
  ],
}