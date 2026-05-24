import { createElement } from 'react'
import { Navigate } from 'react-router-dom'
import Forbidden from '../../pages/Forbidden'
import { useAuth } from '../../contexts/AuthContext'
import TenantManager from '../pages/TenantManager.jsx'
import PermissionDebugger from '../pages/PermissionDebugger.jsx'

export const platformNavGroups = [
  {
    type: 'group',
    name: 'Platform',
    code: 'platform',
    order: 999,
    items: [
      {
        type: 'item',
        name: 'Tenant Manager',
        key: 'platform.tenants',
        path: '/platform/tenants',
        order: 1,
      },
      {
        type: 'item',
        name: 'Permission Debugger',
        key: 'platform.permission-debug',
        path: '/platform/permission-debug',
        order: 2,
      },
    ],
  },
]

export function PlatformAccessGuard({ children }) {
  const auth = useAuth()

  if (auth?.user?.isPlatformAdmin !== true) {
    return createElement(Forbidden)
  }

  return children
}

const platformRoutes = [
  {
    index: true,
    element: createElement(Navigate, { to: 'tenants', replace: true }),
  },
  {
    path: 'tenants',
    element: createElement(TenantManager),
  },
  {
    path: 'permission-debug',
    element: createElement(PermissionDebugger),
  },
]

export default platformRoutes
