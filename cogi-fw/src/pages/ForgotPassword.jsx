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
import { forgotPasswordApi } from "../api/authApi"

export default function ForgotPassword() {
  const [email, setEmail] = useState("")
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState("")
  const [success, setSuccess] = useState("")

  async function onSubmit(e) {
    e.preventDefault()
    setErr("")
    setSuccess("")
    setBusy(true)

    try {
      await forgotPasswordApi(email)
      setSuccess("Nếu email tồn tại trong hệ thống, hướng dẫn đặt lại mật khẩu đã được gửi.")
    } catch (e2) {
      setErr(e2?.response?.data?.error?.message || e2?.message || "Không thể gửi yêu cầu đặt lại mật khẩu")
    } finally {
      setBusy(false)
    }
  }

  return (
    <CContainer className="py-5 ai-card ai-form">
      <CRow className="justify-content-center">
        <CCol md={5}>
          <CCard className="ai-card">
            <CCardHeader><b>Alpha Internal</b> — Quên mật khẩu</CCardHeader>
            <CCardBody>
              <CForm onSubmit={onSubmit} className="ai-form">
                <div className="mb-3">
                  <CFormLabel>Email</CFormLabel>
                  <CFormInput
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    required
                  />
                </div>
                {err ? <div className="text-danger mb-3">{err}</div> : null}
                {success ? <div className="text-success mb-3">{success}</div> : null}
                <div className="d-flex flex-column align-items-start">
                  <CButton type="submit" color="primary" disabled={busy}>
                    {busy ? "Đang gửi..." : "Gửi yêu cầu đặt lại mật khẩu"}
                  </CButton>
                  <Link to="/login" className="btn btn-link p-0 mt-2">Quay lại đăng nhập</Link>
                </div>
              </CForm>
            </CCardBody>
          </CCard>
        </CCol>
      </CRow>
    </CContainer>
  )
}
