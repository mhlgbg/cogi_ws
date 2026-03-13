import React from "react"
import {
  CSidebar,
  CSidebarBrand,
  CSidebarNav,
  CNavItem,
  CNavTitle,
} from "@coreui/react"
import { NavLink } from "react-router-dom"
import navigation from "../_nav"
import { useIam } from "../contexts/IamContext"

export default function AppSidebar({ visible, onVisibleChange }) {
  const { permissionKeys, loading } = useIam()

  const can = (key) => permissionKeys.includes(key)

  const closeOnMobile = () => {
    if (window.matchMedia("(max-width: 768px)").matches) {
      onVisibleChange(false)
    }
  }

  const visibleNavItems = (loading ? [] : navigation).filter((item, index) => {
    if (item.type === "title") {
      for (let i = index + 1; i < navigation.length; i += 1) {
        const next = navigation[i]
        if (next.type === "title") break
        if (!next.permissionKey || can(next.permissionKey)) return true
      }
      return false
    }

    if (!item?.permissionKey) return true
    return can(item.permissionKey)
  })

  return (
    <CSidebar
      position="fixed"
      visible={visible}
      onVisibleChange={onVisibleChange}
    >
      <CSidebarBrand className="d-none d-md-flex">
        Alpha Internal
      </CSidebarBrand>

      <CSidebarNav>
        {visibleNavItems.map((item, index) => {
          const key = `${item.type}-${item.name}-${index}`

          if (item.type === "title") {
            return <CNavTitle key={key}>{item.name}</CNavTitle>
          }

          return (
            <CNavItem key={key}>
              <NavLink className="nav-link" to={item.to} onClick={closeOnMobile}>
                {item.name}
              </NavLink>
            </CNavItem>
          )
        })}
      </CSidebarNav>
    </CSidebar>
  )
}
