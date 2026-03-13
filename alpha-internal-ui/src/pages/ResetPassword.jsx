import React, { useState } from "react"
import { Link, useSearchParams } from "react-router-dom"
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

export default function ResetPassword() {
  const [searchParams] = useSearchParams()
  const code = searchParams.get("code") || ""

  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState("")
  const [success, setSuccess] = useState(false)

  async function onSubmit(e) {
    e.preventDefault()
    setErr("")

    if (!newPassword || !confirmPassword) {
      setErr("Vui lòng nhập đầy đủ thông tin")
      return
    }

    if (newPassword !== confirmPassword) {
      setErr("Mật khẩu xác nhận không khớp")
      return
    }

    if (!code) {
      setErr("Liên kết đặt lại mật khẩu không hợp lệ hoặc đã hết hạn")
      return
    }

    setBusy(true)
    try {
      await api.post("/auth/reset-password", {
        code,
        password: newPassword,
        passwordConfirmation: confirmPassword,
      })
      setSuccess(true)
    } catch (e2) {
      setErr(e2?.response?.data?.error?.message || e2?.message || "Không thể đặt lại mật khẩu")
    } finally {
      setBusy(false)
    }
  }

  return (
    <CContainer className="py-5 ai-card ai-form">
      <CRow className="justify-content-center">
        <CCol md={6} style={{ maxWidth: 500, width: "100%" }}>
          <CCard className="ai-card">
            <CCardHeader><b>Alpha Internal</b> — Đặt lại mật khẩu</CCardHeader>
            <CCardBody>
              {success ? (
                <div className="d-flex flex-column align-items-start">
                  <div className="text-success mb-3">Đặt lại mật khẩu thành công. Vui lòng đăng nhập lại.</div>
                  <Link to="/login" className="btn btn-primary">Về trang đăng nhập</Link>
                </div>
              ) : (
                <CForm onSubmit={onSubmit} className="ai-form">
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
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      required
                    />
                  </div>

                  {err ? <div className="text-danger mb-3">{err}</div> : null}

                  <CButton type="submit" color="primary" disabled={busy}>
                    {busy ? "Đang xử lý..." : "Đặt lại mật khẩu"}
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
