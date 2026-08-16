import { useEffect, useMemo, useState } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import AppHeader from '../components/AppHeader'
import AppFooter from '../components/AppFooter'
import AppSidebar from '../components/AppSidebar'
import { useAuth } from '../contexts/AuthContext'
import { useFeature } from '../contexts/FeatureContext'
import { useTenant } from '../contexts/TenantContext'
import { buildNav } from '../navigation/buildNav'
import { platformNavGroups } from '../platform/routes/platformRoutes'
import { resolveTenantRouteTitle, setTenantPageTitle } from '../utils/tenantPageTitle'
import './main-layout.css'

function injectExamConfigurationNav(navGroups = [], hasFeature) {
  if (typeof hasFeature !== 'function') return navGroups
  if (!hasFeature('exam-round.manage') && !hasFeature('exam-round.approve')) return navGroups

  const groups = Array.isArray(navGroups) ? navGroups.map((group) => ({ ...group, items: Array.isArray(group?.items) ? [...group.items] : [] })) : []
  const targetGroupIndex = groups.findIndex((group) => String(group?.code || '').trim().toLowerCase() === 'exam' || String(group?.name || '').trim().toLowerCase() === 'exam')
  const item = {
    type: 'item',
    name: 'Cấu hình thi',
    key: 'exam-round.manage:config-shell',
    path: '/exam-configurations',
    order: 0,
    description: 'Khung cấu hình thi chuẩn đầu ra',
  }

  if (targetGroupIndex >= 0) {
    const existingItems = groups[targetGroupIndex].items || []
    const exists = existingItems.some((entry) => entry?.path === item.path)
    if (!exists) {
      groups[targetGroupIndex].items = [item, ...existingItems]
    }
    return groups
  }

  return [
    ...groups,
    {
      type: 'group',
      name: 'Quản lý thi chuẩn đầu ra',
      code: 'exam-configurations',
      icon: 'cilEducation',
      order: 21,
      items: [item],
    },
  ]
}

function injectSportsSelfNav(navGroups = [], options = {}) {
  const groups = Array.isArray(navGroups) ? navGroups.map((group) => ({ ...group, items: Array.isArray(group?.items) ? [...group.items] : [] })) : []
  const item = {
    type: 'item',
    name: 'Hồ sơ thể thao của tôi',
    key: 'sports:me-self-service',
    path: '/sports/me',
    order: -1,
    description: 'Khu vực self-service để xem hồ sơ thể thao, CLB và thành tích của chính bạn.',
  }

  if (!options?.isAuthenticated || !options?.tenantCode) return groups

  const targetGroupIndex = groups.findIndex((group) => String(group?.code || '').trim().toLowerCase() === 'sports')
  if (targetGroupIndex >= 0) {
    const items = groups[targetGroupIndex].items || []
    if (!items.some((entry) => entry?.path === item.path)) {
      groups[targetGroupIndex].items = [item, ...items]
    }
    return groups
  }

  return [
    ...groups,
    {
      type: 'group',
      name: 'COGI Sports',
      code: 'sports',
      icon: 'cilChartLine',
      order: 22,
      items: [item],
    },
  ]
}

export default function MainLayout() {
  const auth = useAuth()
  const feature = useFeature()
  const tenant = useTenant()
  const location = useLocation()
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false)

  const isRequestWorkspaceRoute = useMemo(() => {
    const pathname = String(location?.pathname || '')
    return pathname === '/requests' || pathname === '/requests/monitor'
  }, [location?.pathname])

  const isPlatformWorkspaceRoute = useMemo(() => {
    const pathname = String(location?.pathname || '')
    return pathname === '/platform' || pathname.startsWith('/platform/')
  }, [location?.pathname])

  const navItems = useMemo(
    () => {
      const tenantNavItems = injectSportsSelfNav(
        injectExamConfigurationNav(buildNav(feature?.featureGroups || []), feature?.hasFeature),
        { isAuthenticated: auth?.isAuthenticated, tenantCode: tenant?.currentTenant?.tenantCode },
      )
      if (auth?.user?.isPlatformAdmin !== true) {
        return tenantNavItems
      }

      return isPlatformWorkspaceRoute
        ? [...platformNavGroups, ...tenantNavItems]
        : [...tenantNavItems, ...platformNavGroups]
    },
    [auth?.isAuthenticated, auth?.user?.isPlatformAdmin, feature?.featureGroups, isPlatformWorkspaceRoute, tenant?.currentTenant?.tenantCode],
  )

  useEffect(() => {
    const media = window.matchMedia('(max-width: 991.98px)')
    const applyMode = () => {
      if (media.matches) {
        setSidebarCollapsed(false)
      } else {
        setMobileSidebarOpen(false)
      }
    }

    applyMode()
    media.addEventListener('change', applyMode)
    return () => media.removeEventListener('change', applyMode)
  }, [])

  useEffect(() => {
    if (isPlatformWorkspaceRoute) {
      document.title = 'COGI'
      return
    }

    const routeTitle = resolveTenantRouteTitle(location.pathname)
    setTenantPageTitle(routeTitle, tenant)
  }, [isPlatformWorkspaceRoute, location.pathname, tenant])

  function onToggleSidebar() {
    if (window.matchMedia('(max-width: 991.98px)').matches) {
      setMobileSidebarOpen((prev) => !prev)
      return
    }

    setSidebarCollapsed((prev) => !prev)
  }

  return (
    <div className="tenant-layout">
      <AppSidebar
        navItems={navItems}
        isPlatformWorkspace={isPlatformWorkspaceRoute}
        collapsed={sidebarCollapsed}
        mobileOpen={mobileSidebarOpen}
        onCloseMobile={() => setMobileSidebarOpen(false)}
      />

      <div className={[`tenant-main`, sidebarCollapsed ? 'is-sidebar-collapsed' : ''].filter(Boolean).join(' ')}>
        <AppHeader onToggleSidebar={onToggleSidebar} />

        <main className={["tenant-content", isRequestWorkspaceRoute ? 'tenant-content-full-bleed' : ''].filter(Boolean).join(' ')}>
          <Outlet />
        </main>

        <AppFooter />
      </div>

      {mobileSidebarOpen ? <button className="tenant-sidebar-backdrop" onClick={() => setMobileSidebarOpen(false)} /> : null}
    </div>
  )
}