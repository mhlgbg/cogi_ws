import React, { useEffect, useState } from "react"
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
  CFormSelect,
  CRow,
} from "@coreui/react"
import api from "../api/api"

function getApiErrorMessage(error, fallback) {
  return (
    error?.response?.data?.error?.message ||
    error?.response?.data?.message ||
    error?.message ||
    fallback
  )
}

function mapDepartments(payload) {
  const rows = Array.isArray(payload?.data) ? payload.data : []

  return rows
    .map((item) => {
      const id = item?.id
      const name = item?.name || item?.attributes?.name || `Department #${id}`

      if (!id) return null
      return { id, name }
    })
    .filter(Boolean)
}

export default function InviteUser() {
  const [email, setEmail] = useState("")
  const [fullName, setFullName] = useState("")
  const [departmentId, setDepartmentId] = useState("")

  const [departments, setDepartments] = useState([])
  const [loadingDepartments, setLoadingDepartments] = useState(true)

  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState("")
  const [successData, setSuccessData] = useState(null)
  const [copyState, setCopyState] = useState("")

  useEffect(() => {
    let isCancelled = false

    async function loadDepartments() {
      setLoadingDepartments(true)
      try {
        const res = await api.get("/departments", {
          params: { pagination: { pageSize: 200 } },
        })

        if (!isCancelled) {
          setDepartments(mapDepartments(res.data))
        }
      } catch (err) {
        if (!isCancelled) {
          setError(getApiErrorMessage(err, "Không tải được danh sách phòng ban"))
        }
      } finally {
        if (!isCancelled) {
          setLoadingDepartments(false)
        }
      }
    }

    loadDepartments()

    return () => {
      isCancelled = true
    }
  }, [])

  async function onSubmit(e) {
    e.preventDefault()
    setError("")
    setSuccessData(null)
    setCopyState("")
    setSubmitting(true)

    try {
      const payload = {
        email,
        fullName: fullName.trim() || null,
      }

      if (departmentId) {
        payload.departmentId = Number(departmentId)
      }

      const res = await api.post("/admin/invite-user", payload)
      setSuccessData(res.data)
    } catch (err) {
      setError(getApiErrorMessage(err, "Không thể mời người dùng"))
    } finally {
      setSubmitting(false)
    }
  }

  async function onCopyActivationLink() {
    const activationLink = successData?.activationLink
    if (!activationLink) return

    try {
      await navigator.clipboard.writeText(activationLink)
      setCopyState("Đã copy link")
    } catch {
      setCopyState("Copy thất bại")
    }
  }

  return (
    <CContainer className="py-4">
      <CRow className="justify-content-center">
        <CCol md={8} style={{ maxWidth: 760 }}>
          <CCard>
            <CCardHeader>
              <b>Mời người dùng</b>
            </CCardHeader>
            <CCardBody>
              {loadingDepartments ? <div className="mb-3">Loading...</div> : null}

              <CForm onSubmit={onSubmit}>
                <div className="mb-3">
                  <CFormLabel>Email</CFormLabel>
                  <CFormInput
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="name@company.com"
                  />
                </div>

                <div className="mb-3">
                  <CFormLabel>Họ và tên</CFormLabel>
                  <CFormInput
                    type="text"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Nguyễn Văn A"
                  />
                </div>

                <div className="mb-3">
                  <CFormLabel>Phòng ban</CFormLabel>
                  <CFormSelect
                    value={departmentId}
                    onChange={(e) => setDepartmentId(e.target.value)}
                    disabled={loadingDepartments || submitting}
                  >
                    <option value="">-- Chọn phòng ban (optional) --</option>
                    {departments.map((dept) => (
                      <option key={dept.id} value={dept.id}>
                        {dept.name}
                      </option>
                    ))}
                  </CFormSelect>
                </div>

                <CButton type="submit" color="primary" disabled={submitting}>
                  {submitting ? "Đang gửi..." : "Mời user"}
                </CButton>
              </CForm>

              {error ? <div className="text-danger mt-3">{error}</div> : null}

              {successData?.ok ? (
                <div className="mt-3">
                  <div className="text-success mb-2">Mời user thành công</div>
                  {successData?.activationLink ? (
                    <>
                      <div className="mb-2" style={{ wordBreak: "break-all" }}>
                        {successData.activationLink}
                      </div>
                      <CButton type="button" color="secondary" onClick={onCopyActivationLink}>
                        Copy to Clipboard
                      </CButton>
                      {copyState ? <div className="mt-2">{copyState}</div> : null}
                    </>
                  ) : null}
                </div>
              ) : null}
            </CCardBody>
          </CCard>
        </CCol>
      </CRow>
    </CContainer>
  )
}
