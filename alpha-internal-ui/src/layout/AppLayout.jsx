import React, { useEffect, useState } from "react"
import {
  CContainer,
  CHeader,
  CHeaderBrand,
  CHeaderNav,
  CNavItem,
  CNavLink,
  CHeaderToggler,
} from "@coreui/react"
import CIcon from "@coreui/icons-react"
import { cilMenu } from "@coreui/icons"

import { useAuth } from "../contexts/AuthContext"
import AppSidebar from "./AppSidebar"
import "./layout.css"

export default function AppLayout({ children }) {
  const { me, logout } = useAuth()

  const [sidebarVisible, setSidebarVisible] = useState(true)

  // Tự set theo màn hình: mobile = ẩn, desktop = hiện
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 768px)")
    const apply = () => setSidebarVisible(!mq.matches)
    apply()
    mq.addEventListener("change", apply)
    return () => mq.removeEventListener("change", apply)
  }, [])

  return (
    <div className="wrapper d-flex flex-column min-vh-100">
      <AppSidebar visible={sidebarVisible} onVisibleChange={setSidebarVisible} />

      <div className="body flex-grow-1">
        <CHeader className="mb-3 px-3">
          {/* Nút mở sidebar trên mobile */}
          <CHeaderToggler
            className="ps-1 d-md-none"
            onClick={() => setSidebarVisible((v) => !v)}
          >
            <CIcon icon={cilMenu} size="lg" />
          </CHeaderToggler>

          <CHeaderBrand className="ms-2">Alpha Internal</CHeaderBrand>

          <CHeaderNav className="ms-auto">
            <CNavItem className="me-3">
              <CNavLink href="#" onClick={(e) => e.preventDefault()}>
                {me?.username || me?.email}
              </CNavLink>
            </CNavItem>
            <CNavItem>
              <CNavLink
                href="#"
                onClick={(e) => {
                  e.preventDefault()
                  logout()
                }}
              >
                Đăng xuất
              </CNavLink>
            </CNavItem>
          </CHeaderNav>
        </CHeader>

        <CContainer fluid className="px-3">
          {children}
        </CContainer>
      </div>
    </div>
  )
}
