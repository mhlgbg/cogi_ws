import React, { useEffect } from "react"
import { Link } from "react-router-dom"
import {
  CCard,
  CCardBody,
  CCardHeader,
  CCol,
  CContainer,
  CFormInput,
  CFormLabel,
  CRow,
} from "@coreui/react"
import { useAuth } from "../contexts/AuthContext"

function getRoleText(me) {
  if (!me) return "-"
  if (me.roleText) return me.roleText
  if (me?.role?.name) return me.role.name
  if (me?.role?.type) return me.role.type
  return "-"
}

export default function Profile() {
  const { me, loading, reloadMe } = useAuth()

  useEffect(() => {
    if (!me && !loading) {
      reloadMe()
    }
  }, [me, loading, reloadMe])

  if (!me || loading) {
    return (
      <CContainer className="py-5 ai-card ai-form">
        <CRow className="justify-content-center">
          <CCol md={6} style={{ maxWidth: 800, width: "100%" }}>
            <CCard className="ai-card">
              <CCardBody>
                <small>Đang tải…</small>
              </CCardBody>
            </CCard>
          </CCol>
        </CRow>
      </CContainer>
    )
  }

  return (
    <CContainer className="py-5 ai-card ai-form">
      <CRow className="justify-content-center">
        <CCol md={8} style={{ maxWidth: 800, width: "100%" }}>
          <CCard className="ai-card">
            <CCardHeader><b>Thông tin tài khoản</b></CCardHeader>
            <CCardBody>
              <div className="mb-3">
                <CFormLabel>Username</CFormLabel>
                <CFormInput value={me?.username || ""} readOnly />
              </div>
              <div className="mb-3">
                <CFormLabel>Email</CFormLabel>
                <CFormInput value={me?.email || ""} readOnly />
              </div>
              <div className="mb-4">
                <CFormLabel>Role(s)</CFormLabel>
                <CFormInput value={getRoleText(me)} readOnly />
              </div>

              <div className="d-flex gap-2">
                <Link to="/change-password" className="btn btn-primary">
                  Đổi mật khẩu
                </Link>
                <Link to="/" className="btn btn-outline-secondary">
                  Về Dashboard
                </Link>
              </div>
            </CCardBody>
          </CCard>
        </CCol>
      </CRow>
    </CContainer>
  )
}
