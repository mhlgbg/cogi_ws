import React from "react"
import { NavLink } from "react-router-dom"
import { CButton } from "@coreui/react"
import navigation from "../_nav"
import { useIam } from "../contexts/IamContext"
import { brandName, logoUrl } from "../theme/brand"

function getAccessKey(item) {
  return item?.permissionKey ?? item?.featureKey ?? null
}

function getAccessAny(item) {
  return Array.isArray(item?.permissionAny) ? item.permissionAny : []
}

function getAccessRole(item) {
  return item?.permissionRole ?? null
}

function getAccessAnyRole(item) {
  return Array.isArray(item?.permissionAnyRole) ? item.permissionAnyRole : []
}

function canAccessItem(item, can, canAny, canRole, canAnyRole) {
  const role = getAccessRole(item)
  const anyRoles = getAccessAnyRole(item)
  const key = getAccessKey(item)
  const anyKeys = getAccessAny(item)

  if (role) {
    return canRole(role)
  }

  if (anyRoles.length > 0) {
    return canAnyRole(anyRoles)
  }

  if (key) {
    return can(key)
  }

  if (anyKeys.length > 0) {
    return canAny(anyKeys)
  }

  return true
}

function filterNavigationByPermission(items, can, canAny, canRole, canAnyRole) {
  const source = Array.isArray(items) ? items : []
  const filtered = []

  for (const item of source) {
    if (!item) continue

    if (item.type === "title") {
      filtered.push(item)
      continue
    }

    if (Array.isArray(item.children) && item.children.length > 0) {
      const children = filterNavigationByPermission(item.children, can, canAny, canRole, canAnyRole).filter((child) => child.type !== "title")
      const allowParent = canAccessItem(item, can, canAny, canRole, canAnyRole)
      if (allowParent || children.length > 0) {
        filtered.push({ ...item, children })
      }
      continue
    }

    if (canAccessItem(item, can, canAny, canRole, canAnyRole)) {
      filtered.push(item)
    }
  }

  return filtered.filter((item, index, list) => {
    if (item.type !== "title") return true

    for (let pointer = index + 1; pointer < list.length; pointer += 1) {
      if (list[pointer]?.type === "title") break
      return true
    }

    return false
  })
}

export default function AppSidebar({ collapsed, mobileOpen, onCloseMobile }) {
  const { permissionKeys, role, loading } = useIam()

  const permissionsSet = new Set(Array.isArray(permissionKeys) ? permissionKeys : [])
  const roleText = String(role || "").trim().toLowerCase()

  const can = (key) => !key || permissionsSet.has(key)
  const canAny = (keys) => Array.isArray(keys) && keys.some((key) => permissionsSet.has(key))
  const canRole = (targetRole) => {
    if (!targetRole) return true
    return roleText === String(targetRole).trim().toLowerCase()
  }
  const canAnyRole = (targetRoles) => Array.isArray(targetRoles) && targetRoles.some((value) => canRole(value))

  const visibleNavItems = filterNavigationByPermission(
    navigation,
    loading ? (key) => !key : can,
    loading ? () => false : canAny,
    loading ? () => false : canRole,
    loading ? () => false : canAnyRole
  )

  const sidebarClassName = [
    "admin-sidebar",
    collapsed ? "is-collapsed" : "",
    mobileOpen ? "is-mobile-open" : "",
  ]
    .filter(Boolean)
    .join(" ")

  return (
    <aside className={sidebarClassName}>
      <div className="admin-sidebar-header">
        <img src={logoUrl} alt={brandName} className="admin-sidebar-logo" />
        <div className="admin-sidebar-brand-text">
          <div className="admin-sidebar-brand-name">{brandName}</div>
          <div className="admin-sidebar-brand-sub">Enterprise Console</div>
        </div>

        <CButton
          color="light"
          variant="ghost"
          size="sm"
          className="admin-sidebar-mobile-close d-lg-none"
          onClick={onCloseMobile}
        >
          ✕
        </CButton>
      </div>

      <nav className="admin-sidebar-nav">
        {visibleNavItems.map((item, index) => {
          const key = `${item.type}-${item.name}-${index}`

          if (item.type === "title") {
            return (
              <div key={key} className="admin-sidebar-group-title">
                {item.name}
              </div>
            )
          }

          if (Array.isArray(item.children) && item.children.length > 0) {
            return (
              <div key={key}>
                <div className="admin-sidebar-group-title">{item.name}</div>
                {item.children.map((child, childIndex) => {
                  const childKey = `${key}-child-${child.name || childIndex}`
                  return (
                    <NavLink
                      key={childKey}
                      to={child.to}
                      className={({ isActive }) =>
                        ["admin-sidebar-link", isActive ? "active" : ""].filter(Boolean).join(" ")
                      }
                      onClick={onCloseMobile}
                    >
                      <span className="admin-sidebar-link-dot" aria-hidden>
                        •
                      </span>
                      <span className="admin-sidebar-link-label">{child.name}</span>
                    </NavLink>
                  )
                })}
              </div>
            )
          }

          return (
            <NavLink
              key={key}
              to={item.to}
              className={({ isActive }) =>
                ["admin-sidebar-link", isActive ? "active" : ""].filter(Boolean).join(" ")
              }
              onClick={onCloseMobile}
            >
              <span className="admin-sidebar-link-dot" aria-hidden>
                •
              </span>
              <span className="admin-sidebar-link-label">{item.name}</span>
            </NavLink>
          )
        })}
      </nav>
    </aside>
  )
}
