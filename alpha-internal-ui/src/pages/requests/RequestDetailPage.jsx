import { useCallback, useEffect, useMemo, useRef, useState } from "react"
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
  CForm,
  CFormInput,
  CFormLabel,
  CFormSelect,
  CFormTextarea,
  CModal,
  CModalBody,
  CModalFooter,
  CModalHeader,
  CModalTitle,
  CRow,
  CSpinner,
  CToast,
  CToastBody,
  CToaster,
} from "@coreui/react"
import axios from "../../api/api"
import { useAuth } from "../../contexts/AuthContext"
import {
  addAssignee,
  changeRequestStatus,
  closeRequest,
  createRequestMessage,
  getMessages,
  getRequestById,
  removeAssignee,
  uploadFiles,
} from "../../api/requestApi"
import "./RequestDetail.css"

const STATUS_OPTIONS = ["OPEN", "IN_PROGRESS", "WAITING", "DONE", "CLOSED", "CANCELLED"]
const ASSIGNEE_ROLE_OPTIONS = ["ASSIGNEE", "OBSERVER"]

function formatDateTime(value) {
  if (!value) return "-"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "-"
  return date.toLocaleString()
}

function getStatusColor(status) {
  if (status === "OPEN") return "info"
  if (status === "IN_PROGRESS") return "warning"
  if (status === "WAITING") return "secondary"
  if (status === "DONE") return "success"
  if (status === "CLOSED") return "success"
  if (status === "CANCELLED") return "dark"
  return "secondary"
}

function getApiMessage(error, fallback) {
  return (
    error?.response?.data?.error?.message ||
    error?.response?.data?.message ||
    error?.message ||
    fallback
  )
}

function normalizeAttachments(value) {
  if (!value) return []
  if (Array.isArray(value)) return value
  if (Array.isArray(value?.data)) return value.data
  return []
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

function getAvatarLabel(item) {
  if (item?.isSystem) return "HT"
  const name = String(item?.author?.username || item?.author?.email || "U").trim()
  if (!name) return "U"
  return name.charAt(0).toUpperCase()
}

function getRoleBadgeColor(roleType) {
  if (roleType === "ASSIGNEE") return "info"
  if (roleType === "OBSERVER") return "secondary"
  return "secondary"
}

export default function RequestDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { me } = useAuth()

  const messagesBottomRef = useRef(null)

  const [detailLoading, setDetailLoading] = useState(true)
  const [detailError, setDetailError] = useState("")
  const [request, setRequest] = useState(null)

  const [statusUpdating, setStatusUpdating] = useState(false)

  const [messages, setMessages] = useState([])
  const [messagesLoading, setMessagesLoading] = useState(true)
  const [messagesError, setMessagesError] = useState("")
  const [messageInput, setMessageInput] = useState("")
  const [selectedMessageFiles, setSelectedMessageFiles] = useState([])
  const [sendingMessage, setSendingMessage] = useState(false)

  const [showAddAssigneeModal, setShowAddAssigneeModal] = useState(false)
  const [usersLoading, setUsersLoading] = useState(false)
  const [usersError, setUsersError] = useState("")
  const [users, setUsers] = useState([])
  const [selectedUserId, setSelectedUserId] = useState("")
  const [selectedRole, setSelectedRole] = useState("ASSIGNEE")
  const [selectedDueDate, setSelectedDueDate] = useState("")
  const [addingAssignee, setAddingAssignee] = useState(false)
  const [removingAssigneeId, setRemovingAssigneeId] = useState(null)

  const [showCloseModal, setShowCloseModal] = useState(false)
  const [closeDecision, setCloseDecision] = useState("APPROVED")
  const [closeAmountApproved, setCloseAmountApproved] = useState("")
  const [closeNote, setCloseNote] = useState("")
  const [closeSubmitting, setCloseSubmitting] = useState(false)
  const [closeError, setCloseError] = useState("")
  const [showCloseToast, setShowCloseToast] = useState(false)

  const assignees = useMemo(() => {
    const rows = Array.isArray(request?.request_assignees) ? request.request_assignees : []
    return rows.filter((item) => item?.isActive !== false)
  }, [request])

  const requesterId = Number(request?.requester?.id)
  const fallbackMe = (() => {
    try {
      const raw = localStorage.getItem("me")
      return raw ? JSON.parse(raw) : null
    } catch {
      return null
    }
  })()
  const currentUserId = Number(me?.id || fallbackMe?.id)

  const isRequester = Boolean(requesterId && currentUserId && requesterId === currentUserId)
  const isCurrentUserAssignee = assignees.some((item) => Number(item?.user?.id) === currentUserId)
  const isTerminalStatus = request?.request_status === "CLOSED" || request?.request_status === "CANCELLED"

  const canEditRequest = isRequester && !isTerminalStatus
  const canManageAssignees = isRequester && !isTerminalStatus
  const canChangeStatus = isRequester && !isTerminalStatus
  const canSendMessage = !isTerminalStatus && (isRequester || isCurrentUserAssignee)
  const canCloseRequest = isCurrentUserAssignee && !isTerminalStatus

  const assigneeUserIds = useMemo(
    () => assignees.map((item) => Number(item?.user?.id)).filter((value) => Number.isInteger(value) && value > 0),
    [assignees]
  )

  const selectableUsers = useMemo(() => {
    return users.filter((user) => !assigneeUserIds.includes(Number(user.id)))
  }, [users, assigneeUserIds])

  const loadDetail = useCallback(async () => {
    setDetailLoading(true)
    setDetailError("")
    try {
      const res = await getRequestById(id)
      const data = res?.data || null
      setRequest(data)

      if (Array.isArray(data?.request_messages) && data.request_messages.length > 0) {
        setMessages(data.request_messages)
      }
    } catch (error) {
      const status = error?.response?.status
      if (status === 403) {
        setDetailError("Bạn không có quyền xem yêu cầu này")
      } else if (status === 404) {
        setDetailError("Không tìm thấy yêu cầu")
      } else {
        setDetailError(getApiMessage(error, "Không tải được chi tiết yêu cầu"))
      }
    } finally {
      setDetailLoading(false)
    }
  }, [id])

  const loadMessages = useCallback(async () => {
    setMessagesLoading(true)
    setMessagesError("")
    try {
      const res = await getMessages(id)
      const rows = Array.isArray(res?.data) ? res.data : []
      setMessages(rows)
    } catch (error) {
      const status = error?.response?.status
      if (status === 403) {
        setMessagesError("Bạn không có quyền xem trao đổi của yêu cầu này")
      } else {
        setMessagesError(getApiMessage(error, "Không tải được danh sách trao đổi"))
      }
    } finally {
      setMessagesLoading(false)
    }
  }, [id])

  useEffect(() => {
    loadDetail()
    loadMessages()
  }, [loadDetail, loadMessages])

  useEffect(() => {
    if (!messagesBottomRef.current) return
    messagesBottomRef.current.scrollIntoView({ behavior: "smooth", block: "end" })
  }, [messages])

  async function onChangeStatus(event) {
    const nextStatus = event.target.value
    if (!nextStatus || nextStatus === request?.request_status || !canChangeStatus) return

    if (nextStatus === "CLOSED") {
      setDetailError("Trong V1 không đóng request bằng dropdown trạng thái")
      return
    }

    setStatusUpdating(true)
    setDetailError("")
    try {
      const res = await changeRequestStatus(id, nextStatus)
      const updatedStatus = res?.data?.request_status || nextStatus
      setRequest((prev) => {
        if (!prev) return prev
        return { ...prev, request_status: updatedStatus }
      })
    } catch (error) {
      const status = error?.response?.status
      if (status === 403) {
        setDetailError("Bạn không có quyền cập nhật trạng thái yêu cầu này")
      } else {
        setDetailError(getApiMessage(error, "Cập nhật trạng thái thất bại"))
      }
    } finally {
      setStatusUpdating(false)
    }
  }

  async function openAddAssigneeModal() {
    setShowAddAssigneeModal(true)
    setUsersLoading(true)
    setUsersError("")
    setSelectedUserId("")
    setSelectedRole("ASSIGNEE")
    setSelectedDueDate("")

    try {
      const res = await axios.get("/users", {
        params: {
          pageSize: 200,
          "pagination[pageSize]": 200,
          sort: "username:asc",
        },
      })

      const payload = res?.data
      const rows = Array.isArray(payload?.data) ? payload.data : Array.isArray(payload) ? payload : []

      const mapped = rows
        .map((item) => {
          const userId = item?.id
          if (!userId) return null
          return {
            id: userId,
            username: item?.username || "",
            email: item?.email || "",
          }
        })
        .filter(Boolean)

      setUsers(mapped)
    } catch (error) {
      const status = error?.response?.status
      if (status === 403) {
        setUsersError("Bạn không có quyền xem danh sách người dùng")
      } else {
        setUsersError(getApiMessage(error, "Không tải được danh sách người dùng"))
      }
    } finally {
      setUsersLoading(false)
    }
  }

  async function onSubmitAddAssignee(event) {
    event.preventDefault()
    if (!selectedUserId) return

    setAddingAssignee(true)
    setDetailError("")
    try {
      await addAssignee(id, {
        userId: Number(selectedUserId),
        role: selectedRole,
        dueAt: selectedDueDate ? `${selectedDueDate}T23:59:59.999Z` : undefined,
      })
      setShowAddAssigneeModal(false)
      await loadDetail()
    } catch (error) {
      const status = error?.response?.status
      if (status === 403) {
        setDetailError("Bạn không có quyền cập nhật yêu cầu này")
      } else {
        setDetailError(getApiMessage(error, "Thêm assignee thất bại"))
      }
    } finally {
      setAddingAssignee(false)
    }
  }

  async function onRemoveAssignee(assigneeId) {
    if (!assigneeId) return

    setRemovingAssigneeId(assigneeId)
    setDetailError("")
    try {
      await removeAssignee(id, assigneeId)
      await loadDetail()
    } catch (error) {
      const status = error?.response?.status
      if (status === 403) {
        setDetailError("Bạn không có quyền cập nhật yêu cầu này")
      } else {
        setDetailError(getApiMessage(error, "Xóa assignee thất bại"))
      }
    } finally {
      setRemovingAssigneeId(null)
    }
  }

  async function onSendMessage() {
    const content = messageInput.trim()
    if (!content || !canSendMessage) return

    setSendingMessage(true)
    setMessagesError("")
    try {
      let uploadedAttachmentIds = []

      if (selectedMessageFiles.length > 0) {
        try {
          const uploadResult = await uploadFiles(selectedMessageFiles)
          uploadedAttachmentIds = Array.isArray(uploadResult?.fileIds) ? uploadResult.fileIds : []
        } catch {
          setMessagesError("Upload file thất bại")
          return
        }
      }

      await createRequestMessage(id, {
        content,
        attachments: uploadedAttachmentIds,
      })

      setMessageInput("")
      setSelectedMessageFiles([])
      await loadMessages()
    } catch (error) {
      const status = error?.response?.status
      if (status === 403 || status === 409) {
        setMessagesError("Yêu cầu đã khóa")
        await loadDetail()
      } else {
        setMessagesError(getApiMessage(error, "Gửi trao đổi thất bại"))
      }
    } finally {
      setSendingMessage(false)
    }
  }

  function onSelectMessageFiles(event) {
    const files = Array.from(event.target.files || [])
    setSelectedMessageFiles(files)
  }

  function onRemoveMessageFile(indexToRemove) {
    setSelectedMessageFiles((prev) => prev.filter((_, index) => index !== indexToRemove))
  }

  function openCloseModal() {
    setCloseDecision("APPROVED")
    const defaultAmount = request?.amountProposed
    setCloseAmountApproved(defaultAmount !== null && defaultAmount !== undefined ? String(defaultAmount) : "")
    setCloseNote("")
    setCloseError("")
    setShowCloseModal(true)
  }

  async function onSubmitCloseRequest(event) {
    event.preventDefault()
    if (!canCloseRequest) return

    if (closeDecision === "APPROVED" && String(closeAmountApproved).trim() === "") {
      setCloseError("Vui lòng nhập số tiền duyệt")
      return
    }

    setCloseSubmitting(true)
    setCloseError("")
    try {
      const payload = {
        closedDecision: closeDecision,
        amountApproved: closeDecision === "APPROVED" ? Number(closeAmountApproved) : null,
        closeNote: closeNote.trim() || undefined,
      }

      await closeRequest(id, payload)
      setShowCloseModal(false)
      setShowCloseToast(true)
      await loadDetail()
      await loadMessages()
    } catch (error) {
      const status = error?.response?.status
      if (status === 409) {
        setCloseError("Yêu cầu đã được đóng bởi người khác")
        setDetailError("Yêu cầu đã được đóng bởi người khác")
        await loadDetail()
        await loadMessages()
      } else if (status === 403) {
        setCloseError("Bạn không có quyền đóng yêu cầu này")
      } else {
        setCloseError(getApiMessage(error, "Không thể đóng yêu cầu"))
      }
    } finally {
      setCloseSubmitting(false)
    }
  }

  return (
    <CContainer className="py-4 rd-detail-page">
      <CRow className="g-4 justify-content-center">
        <CCol xxl={10}>
          <CRow className="g-4">
            <CCol lg={8}>
              <CCard className="mb-4 ai-card">
                <CCardHeader className="d-flex justify-content-between align-items-center gap-2 flex-wrap">
                  <strong>Thông tin yêu cầu</strong>
                  <div className="d-flex gap-2">
                    {id && canEditRequest ? (
                      <Link to={`/requests/${id}/edit`} className="btn btn-outline-primary btn-sm">
                        Chỉnh sửa
                      </Link>
                    ) : null}
                    <CButton color="secondary" variant="outline" size="sm" onClick={() => navigate("/requests")}>
                      Quay lại
                    </CButton>
                  </div>
                </CCardHeader>
                <CCardBody>
                  {detailLoading ? (
                    <div className="d-flex align-items-center gap-2">
                      <CSpinner size="sm" />
                      <span>Đang tải dữ liệu...</span>
                    </div>
                  ) : detailError ? (
                    <CAlert color="danger" className="mb-0">{detailError}</CAlert>
                  ) : (
                    <CRow className="g-3 ai-form">
                      <CCol md={8}>
                        <CFormLabel>Tiêu đề</CFormLabel>
                        <CFormInput value={request?.title || "-"} readOnly />
                      </CCol>
                      <CCol md={4}>
                        <CFormLabel>Trạng thái</CFormLabel>
                        <div className="pt-1">
                          <CBadge color={getStatusColor(request?.request_status)} className="ai-status-badge">
                            {request?.request_status || "-"}
                          </CBadge>
                        </div>
                      </CCol>
                      <CCol md={4}>
                        <CFormLabel>Người tạo</CFormLabel>
                        <CFormInput value={request?.requester?.username || "-"} readOnly />
                      </CCol>
                      <CCol md={4}>
                        <CFormLabel>Loại yêu cầu</CFormLabel>
                        <CFormInput value={request?.category?.name || "-"} readOnly />
                      </CCol>
                      <CCol md={4}>
                        <CFormLabel>Cập nhật lúc</CFormLabel>
                        <CFormInput value={formatDateTime(request?.updatedAt)} readOnly />
                      </CCol>
                      <CCol md={12}>
                        <CFormLabel>Mô tả</CFormLabel>
                        <CFormTextarea value={request?.description || ""} rows={5} readOnly />
                      </CCol>
                    </CRow>
                  )}
                </CCardBody>
              </CCard>

              <CCard className="ai-card">
                <CCardHeader>
                  <strong>Messages</strong>
                </CCardHeader>
                <CCardBody className="rd-messages-body">
                  {messagesLoading ? (
                    <div className="d-flex align-items-center gap-2 mb-3">
                      <CSpinner size="sm" />
                      <span>Đang tải trao đổi...</span>
                    </div>
                  ) : null}

                  {messagesError ? <CAlert color="danger">{messagesError}</CAlert> : null}

                  {isTerminalStatus ? (
                    <CAlert color="secondary" className="mb-3">
                      Yêu cầu đã khóa, không thể trao đổi thêm.
                    </CAlert>
                  ) : null}

                  <div className="rd-message-timeline">
                    {!messagesLoading && messages.length === 0 ? (
                      <div className="text-center text-body-secondary py-3">Chưa có trao đổi</div>
                    ) : (
                      messages.map((item) => {
                        const attachments = normalizeAttachments(item?.attachments)
                        const mine = Number(item?.author?.id) === currentUserId

                        return (
                          <div key={item.id} className={["rd-message-row", mine ? "is-mine" : "", item?.isSystem ? "is-system" : ""].filter(Boolean).join(" ")}>
                            <div className="rd-message-avatar">{getAvatarLabel(item)}</div>
                            <div className="rd-message-bubble">
                              <div className="rd-message-meta">
                                <strong>{item?.isSystem ? "Hệ thống" : item?.author?.username || "-"}</strong>
                                <span>{formatDateTime(item?.createdAt)}</span>
                              </div>
                              <div className="rd-message-content">{item?.content || "-"}</div>

                              {attachments.length > 0 ? (
                                <div className="rd-message-attachments">
                                  {attachments.map((file, index) => {
                                    const link = toFileUrl(file?.url || file?.attributes?.url)
                                    const label = file?.name || file?.attributes?.name || `Tệp ${index + 1}`
                                    if (!link) return null
                                    return (
                                      <a key={file?.id || `${label}-${index}`} href={link} target="_blank" rel="noreferrer">
                                        {label}
                                      </a>
                                    )
                                  })}
                                </div>
                              ) : null}
                            </div>
                          </div>
                        )
                      })
                    )}
                    <div ref={messagesBottomRef} />
                  </div>

                  <CForm
                    className="rd-message-composer ai-form"
                    onSubmit={(event) => {
                      event.preventDefault()
                      onSendMessage()
                    }}
                  >
                    <div className="mb-2">
                      <CFormTextarea
                        rows={3}
                        placeholder="Nhập nội dung trao đổi..."
                        value={messageInput}
                        onChange={(event) => setMessageInput(event.target.value)}
                        disabled={sendingMessage || !canSendMessage}
                      />
                    </div>

                    <div className="mb-3">
                      <CFormLabel>Tệp đính kèm</CFormLabel>
                      <CFormInput
                        type="file"
                        multiple
                        onChange={onSelectMessageFiles}
                        disabled={sendingMessage || !canSendMessage}
                      />

                      {selectedMessageFiles.length > 0 ? (
                        <div className="mt-2 rd-selected-files">
                          {selectedMessageFiles.map((file, index) => (
                            <div key={`${file.name}-${index}`} className="rd-selected-file-item">
                              <span>{file.name}</span>
                              <CButton
                                type="button"
                                color="danger"
                                variant="outline"
                                size="sm"
                                onClick={() => onRemoveMessageFile(index)}
                                disabled={sendingMessage || !canSendMessage}
                              >
                                X
                              </CButton>
                            </div>
                          ))}
                        </div>
                      ) : null}
                    </div>

                    <div className="d-flex justify-content-end">
                      <CButton type="submit" color="primary" disabled={sendingMessage || !messageInput.trim() || !canSendMessage}>
                        {sendingMessage ? "Đang gửi..." : "Gửi"}
                      </CButton>
                    </div>
                  </CForm>
                </CCardBody>
              </CCard>
            </CCol>

            <CCol lg={4}>
              <CCard className="mb-4 ai-card">
                <CCardHeader><strong>Trạng thái & Hành động</strong></CCardHeader>
                <CCardBody className="ai-form">
                  <div className="mb-3">
                    <CFormLabel>Trạng thái hiện tại</CFormLabel>
                    <div className="pt-1">
                      <CBadge color={getStatusColor(request?.request_status)} className="ai-status-badge">
                        {request?.request_status || "-"}
                      </CBadge>
                    </div>
                  </div>

                  <div className="mb-3">
                    <CFormLabel>Đổi trạng thái</CFormLabel>
                    <CFormSelect
                      value={request?.request_status || ""}
                      onChange={onChangeStatus}
                      disabled={!canChangeStatus || statusUpdating || detailLoading || isTerminalStatus}
                    >
                      {STATUS_OPTIONS.filter((status) => status !== "CLOSED").map((status) => (
                        <option key={status} value={status}>{status}</option>
                      ))}
                    </CFormSelect>
                    {!canChangeStatus ? (
                      <small className="text-body-secondary">Chỉ requester mới được đổi trạng thái</small>
                    ) : null}
                  </div>

                  <div className="d-grid gap-2">
                    {canCloseRequest ? (
                      <CButton color="danger" onClick={openCloseModal}>
                        Đóng yêu cầu
                      </CButton>
                    ) : null}
                    <CButton color="secondary" variant="outline" onClick={() => navigate("/requests")}>
                      Quay lại danh sách
                    </CButton>
                  </div>

                  {request?.request_status === "CLOSED" ? (
                    <div className="mt-4 rd-closed-summary">
                      <div><strong>Quyết định:</strong> {request?.closedDecision || "-"}</div>
                      <div><strong>Người đóng:</strong> {request?.closedBy?.username || "-"}</div>
                      <div><strong>Thời điểm:</strong> {formatDateTime(request?.closedAt)}</div>
                      <div>
                        <strong>Số tiền duyệt:</strong> {request?.closedDecision === "APPROVED" ? (request?.amountApproved ?? "-") : "-"}
                      </div>
                      {request?.closeNote ? <div><strong>Ghi chú:</strong> {request.closeNote}</div> : null}
                    </div>
                  ) : null}
                </CCardBody>
              </CCard>

              <CCard className="mb-4 ai-card">
                <CCardHeader className="d-flex align-items-center justify-content-between">
                  <strong>Assignees</strong>
                  {isRequester ? (
                    <CButton color="primary" size="sm" onClick={openAddAssigneeModal} disabled={detailLoading || !canManageAssignees}>
                      Thêm
                    </CButton>
                  ) : null}
                </CCardHeader>
                <CCardBody>
                  {detailLoading ? (
                    <div className="d-flex align-items-center gap-2">
                      <CSpinner size="sm" />
                      <span>Đang tải dữ liệu...</span>
                    </div>
                  ) : (
                    <div className="rd-assignee-list">
                      {assignees.length === 0 ? (
                        <div className="text-body-secondary">Chưa có người phụ trách</div>
                      ) : (
                        assignees.map((item) => (
                          <div key={item.id} className="rd-assignee-item">
                            <div className="rd-assignee-main">
                              <div className="rd-assignee-name">{item?.user?.username || "-"}</div>
                              <CBadge color={getRoleBadgeColor(item?.roleType)}>{item?.roleType || "-"}</CBadge>
                            </div>
                            <div className="rd-assignee-meta">
                              <span>Gán bởi: {item?.assignedBy?.username || "-"}</span>
                              <span>Gán lúc: {formatDateTime(item?.assignedAt)}</span>
                              <span>Hạn: {formatDateTime(item?.dueAt)}</span>
                            </div>
                            {isRequester ? (
                              <div className="mt-2">
                                <CButton
                                  color="danger"
                                  variant="outline"
                                  size="sm"
                                  disabled={removingAssigneeId === item.id || !canManageAssignees}
                                  onClick={() => onRemoveAssignee(item.id)}
                                >
                                  Xóa
                                </CButton>
                              </div>
                            ) : null}
                          </div>
                        ))
                      )}
                    </div>
                  )}
                </CCardBody>
              </CCard>

              <CCard className="ai-card">
                <CCardHeader><strong>Attachments</strong></CCardHeader>
                <CCardBody>
                  {Array.isArray(request?.attachments) && request.attachments.length > 0 ? (
                    <div className="rd-attachment-list">
                      {request.attachments.map((file, index) => {
                        const link = toFileUrl(file?.url)
                        const name = file?.name || `Tệp ${index + 1}`
                        if (!link) return <div key={file?.id || `${name}-${index}`}>{name}</div>
                        return (
                          <a key={file?.id || `${name}-${index}`} href={link} target="_blank" rel="noreferrer">
                            {name}
                          </a>
                        )
                      })}
                    </div>
                  ) : (
                    <div className="text-body-secondary">Không có tệp đính kèm</div>
                  )}
                </CCardBody>
              </CCard>
            </CCol>
          </CRow>

          <CModal visible={showAddAssigneeModal} onClose={() => setShowAddAssigneeModal(false)}>
            <CForm onSubmit={onSubmitAddAssignee}>
              <CModalHeader>
                <CModalTitle>Thêm assignee</CModalTitle>
              </CModalHeader>
              <CModalBody>
                {usersError ? <CAlert color="danger">{usersError}</CAlert> : null}
                {usersLoading ? (
                  <div className="d-flex align-items-center gap-2">
                    <CSpinner size="sm" />
                    <span>Đang tải người dùng...</span>
                  </div>
                ) : (
                  <>
                    <CFormLabel>Chọn người dùng</CFormLabel>
                    <CFormSelect
                      value={selectedUserId}
                      onChange={(event) => setSelectedUserId(event.target.value)}
                      required
                    >
                      <option value="">-- Chọn user --</option>
                      {selectableUsers.map((user) => (
                        <option key={user.id} value={user.id}>
                          {user.username || user.email || `User #${user.id}`}
                        </option>
                      ))}
                    </CFormSelect>

                    <CFormLabel className="mt-3">Vai trò</CFormLabel>
                    <CFormSelect value={selectedRole} onChange={(event) => setSelectedRole(event.target.value)}>
                      {ASSIGNEE_ROLE_OPTIONS.map((role) => (
                        <option key={role} value={role}>
                          {role}
                        </option>
                      ))}
                    </CFormSelect>

                    <CFormLabel className="mt-3">Hạn hoàn thành trả lời</CFormLabel>
                    <CFormInput
                      type="date"
                      value={selectedDueDate}
                      onChange={(event) => setSelectedDueDate(event.target.value)}
                    />
                  </>
                )}
              </CModalBody>
              <CModalFooter>
                <CButton
                  color="secondary"
                  variant="outline"
                  onClick={() => setShowAddAssigneeModal(false)}
                  disabled={addingAssignee}
                >
                  Hủy
                </CButton>
                <CButton type="submit" color="primary" disabled={addingAssignee || usersLoading || !selectedUserId}>
                  {addingAssignee ? "Đang thêm..." : "Thêm"}
                </CButton>
              </CModalFooter>
            </CForm>
          </CModal>

          <CModal
            visible={showCloseModal}
            onClose={() => {
              if (!closeSubmitting) setShowCloseModal(false)
            }}
            backdrop="static"
          >
            <CForm onSubmit={onSubmitCloseRequest}>
              <CModalHeader>
                <CModalTitle>Đóng yêu cầu</CModalTitle>
              </CModalHeader>
              <CModalBody>
                {closeError ? <CAlert color="danger">{closeError}</CAlert> : null}

                <CFormLabel>Quyết định</CFormLabel>
                <CFormSelect
                  value={closeDecision}
                  onChange={(event) => setCloseDecision(event.target.value)}
                  disabled={closeSubmitting}
                >
                  <option value="APPROVED">APPROVED</option>
                  <option value="REJECTED">REJECTED</option>
                </CFormSelect>

                {closeDecision === "APPROVED" ? (
                  <>
                    <CFormLabel className="mt-3">Số tiền duyệt</CFormLabel>
                    <CFormInput
                      type="number"
                      min={0}
                      step="any"
                      value={closeAmountApproved}
                      onChange={(event) => setCloseAmountApproved(event.target.value)}
                      disabled={closeSubmitting}
                      required
                    />
                  </>
                ) : null}

                <CFormLabel className="mt-3">Ghi chú đóng</CFormLabel>
                <CFormTextarea
                  rows={3}
                  value={closeNote}
                  onChange={(event) => setCloseNote(event.target.value)}
                  disabled={closeSubmitting}
                  placeholder="Ghi chú (không bắt buộc)"
                />
              </CModalBody>
              <CModalFooter>
                <CButton
                  color="secondary"
                  variant="outline"
                  onClick={() => setShowCloseModal(false)}
                  disabled={closeSubmitting}
                >
                  Hủy
                </CButton>
                <CButton type="submit" color="danger" disabled={closeSubmitting}>
                  {closeSubmitting ? "Đang đóng..." : "Xác nhận đóng"}
                </CButton>
              </CModalFooter>
            </CForm>
          </CModal>

          <CToaster placement="top-end">
            <CToast visible={showCloseToast} autohide delay={2500} onClose={() => setShowCloseToast(false)} color="success">
              <CToastBody>Đã đóng yêu cầu</CToastBody>
            </CToast>
          </CToaster>
        </CCol>
      </CRow>
    </CContainer>
  )
}
