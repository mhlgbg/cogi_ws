const sliderFeatures = {
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
      description: 'Tenant quan ly slider cua minh',
      path: '/sliders',
      showInMenu: true,
    },
    {
      name: 'Quan ly slider item',
      key: 'slider-item.manage',
      order: 2,
      description: 'Tenant quan ly cac item cua slider',
      path: '/slider-items',
      showInMenu: false,
    },
  ],
}

export default sliderFeatures