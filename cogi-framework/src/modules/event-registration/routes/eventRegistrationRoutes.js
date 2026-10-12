import EventRegistrationManagementPage from '../pages/EventRegistrationManagementPage'

const eventRegistrationRoutes = [
  {
    path: '/events/manage',
    title: 'Quản lý sự kiện',
    featureKey: 'event.manage',
    component: EventRegistrationManagementPage,
  },
  {
    path: '/events/:id',
    title: 'Chi tiết sự kiện',
    featureKey: 'event.manage',
    component: EventRegistrationManagementPage,
  },
]

export default eventRegistrationRoutes
