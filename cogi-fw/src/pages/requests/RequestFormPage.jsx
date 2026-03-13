import { useCallback, useEffect, useMemo, useState } from "react"
import { useNavigate, useParams } from "react-router-dom"
import {
  CAlert,
  CButton,
  CCard,
  CCardBody,
  CCardHeader,
  CCol,
  CContainer,
  CForm,
  CFormFeedback,
  CFormInput,
  CFormLabel,
  CFormSelect,
  CFormTextarea,
  CRow,
  CSpinner,
} from "@coreui/react"
import axios from "../../api/api"
import { getRequestById, getRequestCategories } from "../../api/requestApi"
import { useAuth } from "../../contexts/AuthContext"

function mapCategories(payload) {
  const rows = Array.isArray(payload?.data) ? payload.data : []

  return rows
    .map((item) => {
      const id = item?.id
      const name = item?.name || item?.attributes?.name || `Category #${id}`
      if (!id) return null
      return { id, name }
    })
    .filter(Boolean)
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

function getAttachmentId(file) {
  return file?.id || file?.attributes?.id || null
}

function getAttachmentName(file, index) {
  return file?.name || file?.attributes?.name || `Tệp ${index + 1}`
}

function getAttachmentUrl(file) {
  const rawUrl = file?.url || file?.attributes?.url
  if (!rawUrl) return ""
  if (String(rawUrl).startsWith("http")) return rawUrl

  try {
    const apiBaseUrl = (import.meta.env.VITE_API_BASE_URL || "").replace(/\/+$/, "")
    const hostBase = apiBaseUrl.endsWith("/api") ? apiBaseUrl.slice(0, -4) : apiBaseUrl
    const normalizedPath = String(rawUrl).startsWith("/") ? String(rawUrl) : `/${String(rawUrl)}`
    return `${hostBase}${normalizedPath}`
  } catch {
    return rawUrl
  }
}

export default function RequestFormPage() {
  const navigate = useNavigate()
  const { id } = useParams()
  const { me } = useAuth()

  const isEditMode = useMemo(() => Boolean(id), [id])

  const [title, setTitle] = useState("")
  const [categoryId, setCategoryId] = useState("")
  const [description, setDescription] = useState("")
  const [requestStatus, setRequestStatus] = useState("")
  const [requesterId, setRequesterId] = useState(null)
  const [existingAttachments, setExistingAttachments] = useState([])
  const [selectedFiles, setSelectedFiles] = useState([])
  const [removedAttachmentIds, setRemovedAttachmentIds] = useState([])

  const [categories, setCategories] = useState([])
  const [loadingInitial, setLoadingInitial] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [validated, setValidated] = useState(false)
  const [errorMessage, setErrorMessage] = useState("")

  const isTerminalStatus = requestStatus === "CLOSED" || requestStatus === "CANCELLED"
  const currentUserId = Number(me?.id)
  const isRequester = Number.isInteger(currentUserId) && Number(requesterId) === currentUserId
  const canRemoveAttachments = isEditMode && isRequester && !isTerminalStatus

  const loadInitialData = useCallback(async () => {
    setLoadingInitial(true)
    setErrorMessage("")

    try {
      const categoryPromise = getRequestCategories()
      const requestPromise = isEditMode ? getRequestById(id) : Promise.resolve(null)

      const [categoryRes, requestRes] = await Promise.all([categoryPromise, requestPromise])

      setCategories(mapCategories(categoryRes))

      if (isEditMode) {
        const requestData = requestRes?.data || {}
        const selectedCategoryId =
          requestData?.category?.id || requestData?.request_category?.id || requestData?.request_category || ""

        setTitle(requestData?.title || "")
        setDescription(requestData?.description || "")
        setCategoryId(selectedCategoryId ? String(selectedCategoryId) : "")
        setRequestStatus(requestData?.request_status || "")
        setRequesterId(requestData?.requester?.id || requestData?.requester || null)
        setExistingAttachments(normalizeAttachments(requestData?.attachments))
        setRemovedAttachmentIds([])
      } else {
        setRequestStatus("")
        setRequesterId(null)
        setExistingAttachments([])
        setRemovedAttachmentIds([])
      }
    } catch (error) {
      setErrorMessage(getApiMessage(error, "Không tải được dữ liệu biểu mẫu"))
    } finally {
      setLoadingInitial(false)
    }
  }, [id, isEditMode])

  useEffect(() => {
    loadInitialData()
  }, [loadInitialData])

  function onSelectFiles(event) {
    const files = Array.from(event.target.files || [])
    setSelectedFiles(files)
  }

  function onRemoveExistingAttachment(fileId) {
    if (!canRemoveAttachments) return

    const numericId = Number(fileId)
    if (!Number.isInteger(numericId) || numericId <= 0) return

    setRemovedAttachmentIds((prev) => (prev.includes(numericId) ? prev : [...prev, numericId]))
    setExistingAttachments((prev) => prev.filter((file) => Number(getAttachmentId(file)) !== numericId))
  }

  async function onSubmit(event) {
    event.preventDefault()
    setValidated(true)
    setErrorMessage("")

    if (!title.trim() || !categoryId) {
      return
    }

    const payload = {
      title: title.trim(),
      categoryId: Number(categoryId),
      description: description.trim() || "",
      tagIds: [],
    }

    setSubmitting(true)
    try {
      const existingIds = existingAttachments
        .map((file) => Number(getAttachmentId(file)))
        .filter((value) => Number.isInteger(value) && value > 0)
        .filter((value) => !removedAttachmentIds.includes(value))

      let uploadedIds = []
      const hasNewFiles = selectedFiles.length > 0

      if (hasNewFiles) {
        const formData = new FormData()
        selectedFiles.forEach((file) => formData.append("files", file))

        const uploadRes = await axios.post("/upload", formData)
        const uploadedRows = Array.isArray(uploadRes?.data) ? uploadRes.data : []

        uploadedIds = uploadedRows
          .map((file) => Number(file?.id))
          .filter((value) => Number.isInteger(value) && value > 0)
      }

      const attachmentIds = Array.from(new Set([...existingIds, ...uploadedIds]))

      const submitData = {
        ...payload,
        attachments: attachmentIds,
      }

      if (isEditMode) {
        await axios.put(`/requests/${id}`, submitData)

        if (hasNewFiles) {
          setSelectedFiles([])
          await loadInitialData()
        }

        navigate(`/requests/${id}`)
      } else {
        const created = await axios.post("/requests", submitData)
        const newId = created?.data?.id

        if (hasNewFiles) {
          setSelectedFiles([])
        }

        if (newId) {
          navigate(`/requests/${newId}`)
        } else {
          navigate("/requests")
        }
      }
    } catch (error) {
      const status = error?.response?.status
      if (isEditMode && status === 403) {
        setErrorMessage("Bạn không có quyền cập nhật yêu cầu này")
      } else {
        setErrorMessage(getApiMessage(error, "Không thể lưu yêu cầu"))
      }
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <CContainer className="py-4">
      <CRow className="justify-content-center">
        <CCol md={10} style={{ maxWidth: 920 }}>
          <CCard>
            <CCardHeader>
              <strong>{isEditMode ? "Cập nhật yêu cầu" : "Tạo yêu cầu"}</strong>
            </CCardHeader>
            <CCardBody>
              {loadingInitial ? (
                <div className="d-flex align-items-center gap-2">
                  <CSpinner size="sm" />
                  <span>Đang tải dữ liệu...</span>
                </div>
              ) : (
                <>
                  {errorMessage ? <CAlert color="danger">{errorMessage}</CAlert> : null}

                  <CForm noValidate validated={validated} onSubmit={onSubmit}>
                    <div className="mb-3">
                      <CFormLabel>Tiêu đề</CFormLabel>
                      <CFormInput
                        required
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        placeholder="Nhập tiêu đề yêu cầu"
                      />
                      <CFormFeedback invalid>Vui lòng nhập tiêu đề</CFormFeedback>
                    </div>

                    <div className="mb-3">
                      <CFormLabel>Loại yêu cầu</CFormLabel>
                      <CFormSelect required value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
                        <option value="">-- Chọn loại yêu cầu --</option>
                        {categories.map((item) => (
                          <option key={item.id} value={item.id}>
                            {item.name}
                          </option>
                        ))}
                      </CFormSelect>
                      <CFormFeedback invalid>Vui lòng chọn loại yêu cầu</CFormFeedback>
                    </div>

                    <div className="mb-3">
                      <CFormLabel>Mô tả</CFormLabel>
                      <CFormTextarea
                        rows={6}
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        placeholder="Nhập mô tả (không bắt buộc)"
                      />
                    </div>

                    <div className="mb-3">
                      <CFormLabel>Tệp đính kèm</CFormLabel>
                      <CFormInput
                        type="file"
                        multiple
                        onChange={onSelectFiles}
                        disabled={submitting || isTerminalStatus}
                      />

                      {selectedFiles.length > 0 ? (
                        <div className="mt-2">
                          {selectedFiles.map((file, index) => (
                            <div key={`${file.name}-${index}`}>{file.name}</div>
                          ))}
                        </div>
                      ) : null}

                      {isEditMode && existingAttachments.length > 0 ? (
                        <div className="mt-2">
                          <div className="text-body-secondary mb-1">Tệp đã upload:</div>
                          {existingAttachments.map((file, index) => {
                            const link = getAttachmentUrl(file)
                            const name = getAttachmentName(file, index)
                            const fileId = getAttachmentId(file)
                            const key = fileId || `${name}-${index}`

                            if (!link) {
                              return (
                                <div key={key} className="d-flex align-items-center gap-2">
                                  <span>{name}</span>
                                  {canRemoveAttachments && fileId ? (
                                    <CButton
                                      type="button"
                                      size="sm"
                                      color="danger"
                                      variant="outline"
                                      onClick={() => onRemoveExistingAttachment(fileId)}
                                      disabled={submitting}
                                    >
                                      Gỡ
                                    </CButton>
                                  ) : null}
                                </div>
                              )
                            }

                            return (
                              <div key={key} className="d-flex align-items-center gap-2">
                                <a href={link} target="_blank" rel="noreferrer">
                                  {name}
                                </a>
                                {canRemoveAttachments && fileId ? (
                                  <CButton
                                    type="button"
                                    size="sm"
                                    color="danger"
                                    variant="outline"
                                    onClick={() => onRemoveExistingAttachment(fileId)}
                                    disabled={submitting}
                                  >
                                    Gỡ
                                  </CButton>
                                ) : null}
                              </div>
                            )
                          })}
                        </div>
                      ) : null}
                    </div>

                    <div className="mb-4">
                      <CFormLabel>Tags</CFormLabel>
                      <CFormInput value="Sẽ bổ sung sau" disabled readOnly />
                    </div>

                    <div className="d-flex gap-2">
                      <CButton type="submit" color="primary" disabled={submitting}>
                        {submitting ? "Đang lưu..." : "Lưu"}
                      </CButton>
                      <CButton type="button" color="secondary" variant="outline" onClick={() => navigate("/requests")}>
                        Hủy
                      </CButton>
                    </div>
                  </CForm>
                </>
              )}
            </CCardBody>
          </CCard>
        </CCol>
      </CRow>
    </CContainer>
  )
}
