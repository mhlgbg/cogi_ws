import React, { useEffect, useState } from "react"
import AppSidebar from "../components/AppSidebar.jsx"
import AppHeader from "../components/AppHeader.jsx"
import "./AdminLayout.css"

export default function AdminLayout({ children }) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false)

  useEffect(() => {
    const media = window.matchMedia("(max-width: 991.98px)")
    const applyMode = () => {
      if (media.matches) {
        setSidebarCollapsed(false)
      } else {
        setMobileSidebarOpen(false)
      }
    }

    applyMode()
    media.addEventListener("change", applyMode)
    return () => media.removeEventListener("change", applyMode)
  }, [])

  function onToggleSidebar() {
    if (window.matchMedia("(max-width: 991.98px)").matches) {
      setMobileSidebarOpen((prev) => !prev)
      return
    }

    setSidebarCollapsed((prev) => !prev)
  }

  return (
    <div className="admin-layout">
      <AppSidebar
        collapsed={sidebarCollapsed}
        mobileOpen={mobileSidebarOpen}
        onCloseMobile={() => setMobileSidebarOpen(false)}
      />

      <div className={["admin-main", sidebarCollapsed ? "is-sidebar-collapsed" : ""].filter(Boolean).join(" ")}>
        <AppHeader onToggleSidebar={onToggleSidebar} />

        <main className="admin-content ai-card ai-form ai-table">
          {children}
        </main>
      </div>

      {mobileSidebarOpen ? <button className="admin-sidebar-backdrop" onClick={() => setMobileSidebarOpen(false)} /> : null}
    </div>
  )
}
