import SliderManagementPage from '../pages/SliderManagementPage'
import SliderItemManagementPage from '../pages/SliderItemManagementPage'

const sliderRoutes = [
  {
    path: '/sliders',
    featureKey: 'slider.manage',
    component: SliderManagementPage,
  },
  {
    path: '/slider-items',
    featureKey: 'slider-item.manage',
    component: SliderItemManagementPage,
  },
]

export default sliderRoutes