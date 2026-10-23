import GameDashboardPage from '../pages/GameDashboardPage'
import GameCenterPage from '../pages/GameCenterPage'
import GameDetailPage from '../pages/GameDetailPage'
import GameCenterDetailPage from '../pages/GameCenterDetailPage'
import GhostRacePage from '../pages/GhostRacePage'

const gameRoutes = [
  {
    path: '/games',
    title: 'Quản lý Game',
    featureKey: 'game.manage',
    component: GameDashboardPage,
  },
  {
    path: '/games/:id',
    title: 'Chi tiết Game',
    featureKey: 'game.manage',
    component: GameDetailPage,
  },
  {
    path: '/game-center',
    title: 'Game Center',
    featureKey: 'game.center.view',
    component: GameCenterPage,
  },
  {
    path: '/game-center/ghost-race',
    title: 'Đua bất đồng bộ',
    featureKey: 'game.center.view',
    component: GhostRacePage,
  },
  {
    path: '/game-center/:id',
    title: 'Chi tiết Game Center',
    featureKey: 'game.center.view',
    component: GameCenterDetailPage,
  },
]

export default gameRoutes
