import { useEffect, useMemo, useState } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import AppHeader from '../components/AppHeader'
import AppFooter from '../components/AppFooter'
import AppSidebar from '../components/AppSidebar'
import { useAuth } from '../contexts/AuthContext'
import { useFeature } from '../contexts/FeatureContext'
import { buildNav } from '../navigation/buildNav'
import { platformNavGroups } from '../platform/routes/platformRoutes'
import './main-layout.css'

export default function MainLayout() {
  const auth = useAuth()
  const feature = useFeature()
  const location = useLocation()
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false)

  const isRequestWorkspaceRoute = useMemo(() => {
    const pathname = String(location?.pathname || '')
    return pathname === '/requests' || pathname === '/requests/monitor'
  }, [location?.pathname])

  const navItems = useMemo(
    () => {
      const tenantNavItems = buildNav(feature?.featureGroups || [])
      if (auth?.user?.isPlatformAdmin !== true) {
        return tenantNavItems
      }

      return [...tenantNavItems, ...platformNavGroups]
    },
    [auth?.user?.isPlatformAdmin, feature?.featureGroups],
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