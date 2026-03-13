import React, { useMemo } from "react"
import { Link, useLocation } from "react-router-dom"
import {
  CButton,
  CDropdown,
  CDropdownItem,
  CDropdownMenu,
  CDropdownToggle,
} from "@coreui/react"
import navigation from "../_nav"
import { useAuth } from "../contexts/AuthContext"

function toTitleFromPath(pathname) {
  const segments = String(pathname || "")
    .split("/")
    .filter(Boolean)

  if (segments.length === 0) return "Dashboard"

  return segments
    .map((segment) => segment.replace(/[-_]/g, " "))
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(" / ")
}

function getRouteTitle(pathname) {
  const items = navigation.filter((item) => item?.type === "item" && typeof item?.to === "string")

  const exact = items.find((item) => item.to === pathname)
  if (exact) return exact.name

  const prefixMatched = items
    .filter((item) => item.to !== "/" && pathname.startsWith(`${item.to}/`))
    .sort((left, right) => right.to.length - left.to.length)

  if (prefixMatched.length > 0) return prefixMatched[0].name

  return toTitleFromPath(pathname)
}

export default function AppHeader({ onToggleSidebar }) {
  const { me, logout } = useAuth()
  const location = useLocation()

  const pageTitle = useMemo(() => getRouteTitle(location.pathname), [location.pathname])

  return (
    <header className="admin-header">
      <div className="admin-header-left">
        <CButton
          color="light"
          variant="outline"
          className="admin-header-sidebar-toggle"
          onClick={onToggleSidebar}
        >
          ☰
        </CButton>

        <div>
          <div className="admin-header-breadcrumb">
            <Link to="/dashboard">Dashboard</Link>
            <span>/</span>
            <span>{pageTitle}</span>
          </div>
          <h1 className="admin-header-title">{pageTitle}</h1>
        </div>
      </div>

      <div className="admin-header-right">
        <CDropdown alignment="end">
          <CDropdownToggle color="light" className="admin-user-dropdown">
            {me?.username || me?.email || "User"}
          </CDropdownToggle>
          <CDropdownMenu>
            <CDropdownItem as={Link} to="/profile">
              Hồ sơ
            </CDropdownItem>
            <CDropdownItem onClick={logout}>Đăng xuất</CDropdownItem>
          </CDropdownMenu>
        </CDropdown>

        <CButton color="danger" variant="outline" onClick={logout}>
          Logout
        </CButton>
      </div>
    </header>
  )
}
