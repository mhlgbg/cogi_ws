import React, { useState } from "react"
import {
  CAlert,
  CButton,
  CCard,
  CCardBody,
  CCardHeader,
  CCol,
  CContainer,
  CForm,
  CFormInput,
  CFormLabel,
  CInputGroup,
  CInputGroupText,
  CRow,
} from "@coreui/react"
import { Link } from "react-router-dom"
import { loginApi } from "../api/authApi"
import { useAuth } from "../contexts/AuthContext"
import { brandName, logoUrl } from "../theme/brand"
import "./Login.css"

export default function Login() {
  const { reloadMe } = useAuth()
  const [identifier, setIdentifier] = useState("")
  const [password, setPassword] = useState("")
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState("")

  async function onSubmit(e) {
    e.preventDefault()
    setErr("")
    setBusy(true)
    try {
      const data = await loginApi(identifier, password)
      const token = data?.jwt || data?.token
      if (!token) throw new Error("Missing token in response")
      localStorage.setItem("token", token)
      await reloadMe()
      window.location.href = "/dashboard"
    } catch (e2) {
      setErr(e2?.response?.data?.error?.message || e2?.message || "Đăng nhập thất bại")
    } finally {
      setBusy(false)
    }
  }

  return (
    <CContainer fluid className="login-page px-0">
      <CRow className="g-0 min-vh-100">
        <CCol lg={6} className="login-brand-panel d-none d-lg-flex">
          <div className="login-brand-inner">
            <img src={logoUrl} alt={brandName} className="login-brand-logo" />
            <h2 className="login-brand-name">{brandName}</h2>
            <p className="login-brand-slogan">Nền tảng vận hành nội bộ tập trung, an toàn và hiệu quả.</p>
          </div>
        </CCol>

        <CCol lg={6} className="login-form-panel d-flex align-items-center justify-content-center">
          <div className="login-form-wrap w-100">
            <div className="login-brand-mobile d-lg-none">
              <img src={logoUrl} alt={brandName} className="login-brand-logo" />
              <div className="login-brand-mobile-name">{brandName}</div>
            </div>

            <CCard className="login-card border-0 ai-card">
              <CCardHeader className="login-card-header border-0">
                <b>{brandName}</b> — Đăng nhập
              </CCardHeader>
              <CCardBody className="login-card-body">
                <CForm onSubmit={onSubmit} className="ai-form">
                  <div className="mb-3">
                    <CFormLabel htmlFor="identifier">Tài khoản</CFormLabel>
                    <CInputGroup>
                      <CInputGroupText>@</CInputGroupText>
                      <CFormInput
                        id="identifier"
                        value={identifier}
                        onChange={(e) => setIdentifier(e.target.value)}
                        placeholder="email / username"
                        autoComplete="username"
                      />
                    </CInputGroup>
                  </div>

                  <div className="mb-2">
                    <CFormLabel htmlFor="password">Mật khẩu</CFormLabel>
                    <CInputGroup>
                      <CInputGroupText>•••</CInputGroupText>
                      <CFormInput
                        id="password"
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        autoComplete="current-password"
                      />
                    </CInputGroup>
                  </div>

                  <div className="d-flex justify-content-end mb-3">
                    <Link to="/forgot-password" className="login-forgot-link">
                      Quên mật khẩu
                    </Link>
                  </div>

                  {err ? (
                    <CAlert color="danger" className="py-2 px-3 mb-3" dismissible={false}>
                      {err}
                    </CAlert>
                  ) : null}

                  <CButton type="submit" color="primary" className="w-100" disabled={busy}>
                    {busy ? "Đang đăng nhập..." : "Đăng nhập"}
                  </CButton>
                </CForm>
              </CCardBody>
            </CCard>
          </div>
        </CCol>
      </CRow>
    </CContainer>
  )
}
