import SliderManagementPage from '../pages/SliderManagementPage'
import SliderItemManagementPage from '../pages/SliderItemManagementPage'

const sliderRoutes = [
  {
    path: '/sliders',
    title: 'Slider',
    featureKey: 'slider.manage',
    component: SliderManagementPage,
  },
  {
    path: '/slider-items',
    title: 'Slider item',
    featureKey: 'slider-item.manage',
    component: SliderItemManagementPage,
  },
]

export default sliderRoutes