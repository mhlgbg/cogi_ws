import React, { useState } from "react"
import { Link } from "react-router-dom"
import {
  CButton,
  CCard,
  CCardBody,
  CCardHeader,
  CCol,
  CContainer,
  CForm,
  CFormInput,
  CFormLabel,
  CRow,
} from "@coreui/react"
import api from "../api/api"

export default function ChangePassword() {
  const [currentPassword, setCurrentPassword] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [confirmNewPassword, setConfirmNewPassword] = useState("")
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState("")
  const [success, setSuccess] = useState(false)

  async function onSubmit(e) {
    e.preventDefault()
    setErr("")

    if (newPassword !== confirmNewPassword) {
      setErr("Mật khẩu xác nhận không khớp")
      return
    }

    setBusy(true)
    try {
      await api.post("/auth/change-password", {
        currentPassword,
        password: newPassword,
        passwordConfirmation: confirmNewPassword,
      })
      setSuccess(true)
      setCurrentPassword("")
      setNewPassword("")
      setConfirmNewPassword("")
    } catch (e2) {
      const status = e2?.response?.status
      console.log("change-password response status:", status)

      if (status === 404) {
        setErr("Endpoint not available. Please confirm Strapi change-password API.")
      } else {
        setErr(e2?.response?.data?.error?.message || e2?.message || "Không thể đổi mật khẩu")
      }
    } finally {
      setBusy(false)
    }
  }

  return (
    <CContainer className="py-5 ai-card ai-form">
      <CRow className="justify-content-center">
        <CCol md={6} style={{ maxWidth: 500, width: "100%" }}>
          <CCard className="ai-card">
            <CCardHeader><b>Alpha Internal</b> — Đổi mật khẩu</CCardHeader>
            <CCardBody>
              {success ? (
                <div className="d-flex flex-column align-items-start">
                  <div className="text-success mb-3">Đổi mật khẩu thành công.</div>
                  <Link to="/profile" className="btn btn-primary">Về hồ sơ</Link>
                </div>
              ) : (
                <CForm onSubmit={onSubmit} className="ai-form">
                  <div className="mb-3">
                    <CFormLabel>Mật khẩu hiện tại</CFormLabel>
                    <CFormInput
                      type="password"
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      required
                    />
                  </div>

                  <div className="mb-3">
                    <CFormLabel>Mật khẩu mới</CFormLabel>
                    <CFormInput
                      type="password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      required
                    />
                  </div>

                  <div className="mb-3">
                    <CFormLabel>Xác nhận mật khẩu mới</CFormLabel>
                    <CFormInput
                      type="password"
                      value={confirmNewPassword}
                      onChange={(e) => setConfirmNewPassword(e.target.value)}
                      required
                    />
                  </div>

                  {err ? <div className="text-danger mb-3">{err}</div> : null}

                  <CButton type="submit" color="primary" disabled={busy}>
                    {busy ? "Đang xử lý..." : "Đổi mật khẩu"}
                  </CButton>
                </CForm>
              )}
            </CCardBody>
          </CCard>
        </CCol>
      </CRow>
    </CContainer>
  )
}
