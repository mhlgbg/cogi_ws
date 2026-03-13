import React, { useEffect, useState } from "react"
import { useNavigate, useSearchParams } from "react-router-dom"
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

export default function SetPassword() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const token = (searchParams.get("token") || "").trim()

  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState(false)

  useEffect(() => {
    if (!success) return

    const timer = setTimeout(() => {
      navigate("/login")
    }, 2000)

    return () => clearTimeout(timer)
  }, [success, navigate])

  async function onSubmit(e) {
    e.preventDefault()
    setError("")

    if (!token) {
      setError("Liên kết đặt mật khẩu không hợp lệ hoặc đã hết hạn")
      return
    }

    if (password.length < 8) {
      setError("Mật khẩu phải có ít nhất 8 ký tự")
      return
    }

    if (password !== confirmPassword) {
      setError("Mật khẩu xác nhận không khớp")
      return
    }

    setBusy(true)
    try {
      await api.post("/auth/reset-password", {
        code: token,
        password,
        passwordConfirmation: password,
      })

      setSuccess(true)
    } catch (err) {
      setError(
        err?.response?.data?.error?.message ||
          err?.response?.data?.message ||
          err?.message ||
          "Không thể đặt mật khẩu"
      )
    } finally {
      setBusy(false)
    }
  }

  return (
    <CContainer className="py-5">
      <CRow className="justify-content-center">
        <CCol md={6} style={{ maxWidth: 500, width: "100%" }}>
          <CCard>
            <CCardHeader><b>Alpha Internal</b> — Đặt mật khẩu</CCardHeader>
            <CCardBody>
              {success ? (
                <div className="text-success">Đặt mật khẩu thành công</div>
              ) : (
                <CForm onSubmit={onSubmit}>
                  <div className="mb-3">
                    <CFormLabel>Mật khẩu mới</CFormLabel>
                    <CFormInput
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
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

                  {error ? <div className="text-danger mb-3">{error}</div> : null}

                  <CButton type="submit" color="primary" disabled={busy}>
                    {busy ? "Đang xử lý..." : "Đặt mật khẩu"}
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
