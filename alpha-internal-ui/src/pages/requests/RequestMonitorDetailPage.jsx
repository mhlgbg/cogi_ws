import { useCallback, useEffect, useMemo, useState } from "react"
import { Link, useNavigate, useParams } from "react-router-dom"
import {
  CAlert,
  CBadge,
  CButton,
  CCard,
  CCardBody,
  CCardHeader,
  CCol,
  CContainer,
  CFormInput,
  CFormLabel,
  CFormTextarea,
  CRow,
  CSpinner,
} from "@coreui/react"
import axios from "../../api/api"
import "./RequestDetail.css"

function formatDateTime(value) {
  if (!value) return "-"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "-"
  return date.toLocaleString()
}

function getStatus(item) {
  return item?.request_status || item?.status || "-"
}

function getStatusColor(status) {
  if (status === "OPEN") return "info"
  if (status === "IN_PROGRESS") return "warning"
  if (status === "WAITING") return "secondary"
  if (status === "DONE") return "success"
  if (status === "CLOSED") return "dark"
  if (status === "CANCELLED") return "dark"
  return "secondary"
}

function toFileUrl(url) {
  if (!url) return ""
  if (String(url).startsWith("http")) return url

  const apiBaseUrl = (import.meta.env.VITE_API_BASE_URL || "").replace(/\/+$/, "")
  if (!apiBaseUrl) return url

  const normalizedPath = String(url).startsWith("/") ? String(url) : `/${String(url)}`
  const hostBase = apiBaseUrl.endsWith("/api") ? apiBaseUrl.slice(0, -4) : apiBaseUrl
  return `${hostBase}${normalizedPath}`
}

function normalizeAttachments(value) {
  if (!value) return []
  if (Array.isArray(value)) return value
  if (Array.isArray(value?.data)) return value.data
  return []
}

function getUserLabel(user) {
  return user?.fullname || user?.fullName || user?.username || user?.email || "-"
}

function getAssignees(item) {
  const requestAssignees = Array.isArray(item?.request_assignees) ? item.request_assignees : []

  if (requestAssignees.length > 0) {
    return requestAssignees.map((entry) => ({
      id: entry?.id,
      user: entry?.user,
      roleType: entry?.roleType || entry?.role || "-",
      assignedAt: entry?.assignedAt,
      dueAt: entry?.dueAt,
      assignedBy: entry?.assignedBy,
    }))
  }

  const directAssignees = Array.isArray(item?.assignees) ? item.assignees : []
  return directAssignees.map((entry, index) => ({
    id: entry?.id || `assignee-${index}`,
    user: entry,
    roleType: "-",
  }))
}

function getMessages(item) {
  if (Array.isArray(item?.request_messages)) return item.request_messages
  if (Array.isArray(item?.messages)) return item.messages
  return []
}

export default function RequestMonitorDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [request, setRequest] = useState(null)

  const assignees = useMemo(() => getAssignees(request), [request])
  const messages = useMemo(() => getMessages(request), [request])
  const attachments = useMemo(() => normalizeAttachments(request?.attachments), [request])

  const loadDetail = useCallback(async () => {
    setLoading(true)
    setError("")

    try {
      const res = await axios.get(`/requests/${id}`, {
        params: {
          "populate[attachments]": "*",
          "populate[requester]": "*",
          "populate[createdBy]": "*",
          "populate[category]": "*",
          "populate[request_category]": "*",
          "populate[request_assignees][populate][user]": "*",
          "populate[request_assignees][populate][assignedBy]": "*",
          "populate[assignees]": "*",
          "populate[request_messages][populate][author]": "*",
          "populate[request_messages][populate][attachments]": "*",
          "populate[messages][populate][author]": "*",
          "populate[messages][populate][attachments]": "*",
        },
      })

      setRequest(res?.data?.data || res?.data || null)
    } catch (loadError) {
      const statusCode = loadError?.response?.status
      if (statusCode === 404) {
        setError("Không tìm thấy request")
      } else if (statusCode === 403) {
        setError("Bạn không có quyền xem request này")
      } else {
        setError(loadError?.response?.data?.error?.message || loadError?.message || "Không tải được chi tiết request")
      }
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => {
    loadDetail()
  }, [loadDetail])

  const requester = request?.requester || request?.createdBy || request?.created_by
  const category = request?.category || request?.request_category
  const requestStatus = getStatus(request)

  return (
    <CContainer className="py-4">
      <CRow className="g-4 justify-content-center">
        <CCol xxl={10}>
          <CCard className="mb-4 ai-card">
            <CCardHeader className="d-flex justify-content-between align-items-center gap-2 flex-wrap">
              <strong>Chi tiết Request (Read-only)</strong>
              <div className="d-flex gap-2">
                <CButton color="secondary" variant="outline" onClick={() => navigate("/requests/monitor")}>
                  Quay lại danh sách monitor
                </CButton>
                <Link to="/requests/monitor" className="btn btn-light btn-sm border">
                  Theo dõi Requests
                </Link>
              </div>
            </CCardHeader>
            <CCardBody>
              {loading ? (
                <div className="d-flex align-items-center gap-2">
                  <CSpinner size="sm" />
                  <span>Đang tải chi tiết...</span>
                </div>
              ) : error ? (
                <CAlert color="danger" className="mb-0">{error}</CAlert>
              ) : (
                <CRow className="g-3 ai-form">
                  <CCol md={8}>
                    <CFormLabel>Tiêu đề</CFormLabel>
                    <CFormInput value={request?.title || "-"} readOnly />
                  </CCol>
                  <CCol md={4}>
                    <CFormLabel>Mã</CFormLabel>
                    <CFormInput value={request?.code || "-"} readOnly />
                  </CCol>
                  <CCol md={4}>
                    <CFormLabel>Trạng thái</CFormLabel>
                    <div className="pt-1">
                      <CBadge color={getStatusColor(requestStatus)}>{requestStatus}</CBadge>
                    </div>
                  </CCol>
                  <CCol md={4}>
                    <CFormLabel>Người tạo</CFormLabel>
                    <CFormInput value={getUserLabel(requester)} readOnly />
                  </CCol>
                  <CCol md={4}>
                    <CFormLabel>Danh mục</CFormLabel>
                    <CFormInput value={category?.name || "-"} readOnly />
                  </CCol>
                  <CCol md={4}>
                    <CFormLabel>CreatedAt</CFormLabel>
                    <CFormInput value={formatDateTime(request?.createdAt)} readOnly />
                  </CCol>
                  <CCol md={4}>
                    <CFormLabel>UpdatedAt</CFormLabel>
                    <CFormInput value={formatDateTime(request?.updatedAt)} readOnly />
                  </CCol>
                  <CCol md={4}>
                    <CFormLabel>Giá đề xuất</CFormLabel>
                    <CFormInput value={request?.amountProposed ?? "-"} readOnly />
                  </CCol>
                  <CCol md={4}>
                    <CFormLabel>Giá phê duyệt</CFormLabel>
                    <CFormInput value={request?.amountApproved ?? "-"} readOnly />
                  </CCol>
                  <CCol md={12}>
                    <CFormLabel>Mô tả</CFormLabel>
                    <CFormTextarea rows={4} value={request?.description || ""} readOnly />
                  </CCol>
                </CRow>
              )}
            </CCardBody>
          </CCard>

          {!loading && !error ? (
            <CRow className="g-4">
              <CCol lg={4}>
                <CCard className="mb-4 ai-card">
                  <CCardHeader>
                    <strong>Assignees</strong>
                  </CCardHeader>
                  <CCardBody>
                    {assignees.length === 0 ? (
                      <div className="text-body-secondary">Không có assignee</div>
                    ) : (
                      <div className="rd-assignee-list">
                        {assignees.map((item) => (
                          <div key={item.id} className="rd-assignee-item">
                            <div className="rd-assignee-main">
                              <div className="rd-assignee-name">{getUserLabel(item.user)}</div>
                              <CBadge color="secondary">{item.roleType || "-"}</CBadge>
                            </div>
                            <div className="rd-assignee-meta">
                              <span>Gán bởi: {getUserLabel(item.assignedBy)}</span>
                              <span>Gán lúc: {formatDateTime(item.assignedAt)}</span>
                              <span>Hạn: {formatDateTime(item.dueAt)}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </CCardBody>
                </CCard>

                <CCard className="ai-card">
                  <CCardHeader>
                    <strong>Tệp đính kèm</strong>
                  </CCardHeader>
                  <CCardBody>
                    {attachments.length === 0 ? (
                      <div className="text-body-secondary">Không có tệp đính kèm</div>
                    ) : (
                      <div className="rd-attachment-list">
                        {attachments.map((file, index) => {
                          const fileName = file?.name || file?.attributes?.name || `Tệp ${index + 1}`
                          const fileUrl = toFileUrl(file?.url || file?.attributes?.url)

                          if (!fileUrl) {
                            return <div key={file?.id || `${fileName}-${index}`}>{fileName}</div>
                          }

                          return (
                            <a key={file?.id || `${fileName}-${index}`} href={fileUrl} target="_blank" rel="noreferrer">
                              {fileName}
                            </a>
                          )
                        })}
                      </div>
                    )}
                  </CCardBody>
                </CCard>
              </CCol>

              <CCol lg={8}>
                <CCard className="ai-card">
                  <CCardHeader>
                    <strong>Timeline trao đổi</strong>
                  </CCardHeader>
                  <CCardBody>
                    {messages.length === 0 ? (
                      <div className="text-body-secondary">Chưa có trao đổi</div>
                    ) : (
                      <div className="rd-message-timeline">
                        {messages.map((message) => {
                          const messageAttachments = normalizeAttachments(message?.attachments)

                          return (
                            <div key={message?.id} className="rd-message-row">
                              <div className="rd-message-avatar">{(getUserLabel(message?.author) || "U").charAt(0).toUpperCase()}</div>
                              <div className="rd-message-bubble">
                                <div className="rd-message-meta">
                                  <strong>{getUserLabel(message?.author)}</strong>
                                  <span>{formatDateTime(message?.createdAt)}</span>
                                </div>
                                <div className="rd-message-content">{message?.content || "-"}</div>
                                {messageAttachments.length > 0 ? (
                                  <div className="rd-message-attachments">
                                    {messageAttachments.map((file, index) => {
                                      const fileName = file?.name || file?.attributes?.name || `Tệp ${index + 1}`
                                      const fileUrl = toFileUrl(file?.url || file?.attributes?.url)
                                      if (!fileUrl) return null
                                      return (
                                        <a key={file?.id || `${fileName}-${index}`} href={fileUrl} target="_blank" rel="noreferrer">
                                          {fileName}
                                        </a>
                                      )
                                    })}
                                  </div>
                                ) : null}
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </CCardBody>
                </CCard>
              </CCol>
            </CRow>
          ) : null}
        </CCol>
      </CRow>
    </CContainer>
  )
}
