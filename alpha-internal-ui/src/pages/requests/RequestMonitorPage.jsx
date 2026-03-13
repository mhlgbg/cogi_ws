import { useCallback, useEffect, useMemo, useState } from "react"
import { useNavigate } from "react-router-dom"
import {
  CAlert,
  CBadge,
  CButton,
  CCard,
  CCardBody,
  CCardHeader,
  CCol,
  CFormInput,
  CFormLabel,
  CFormSelect,
  CRow,
  CSpinner,
  CTable,
  CTableBody,
  CTableDataCell,
  CTableHead,
  CTableHeaderCell,
  CTableRow,
  CPagination,
  CPaginationItem,
} from "@coreui/react"
import axios from "../../api/api"

const STATUS_OPTIONS = [
  { value: "", label: "Tất cả" },
  { value: "OPEN", label: "Mới" },
  { value: "IN_PROGRESS", label: "Đang xử lý" },
  { value: "WAITING", label: "Đang chờ" },
  { value: "DONE", label: "Hoàn tất" },
  { value: "CLOSED", label: "Đã đóng" },
  { value: "CANCELLED", label: "Đã hủy" },
]

function formatDate(value) {
  if (!value) return "-"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "-"
  return date.toLocaleString()
}

function getStatus(raw) {
  return raw?.request_status || raw?.status || "-"
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

function getCreatedByName(item) {
  const user = item?.requester || item?.createdBy || item?.created_by
  return user?.fullname || user?.fullName || user?.username || user?.email || "-"
}

function getAssignees(item) {
  const fromRequestAssignees = Array.isArray(item?.request_assignees)
    ? item.request_assignees.map((entry) => entry?.user).filter(Boolean)
    : []

  const fromAssignees = Array.isArray(item?.assignees) ? item.assignees : []

  const users = [...fromRequestAssignees, ...fromAssignees]
  if (users.length === 0) return "-"

  const labels = users
    .map((user) => user?.fullname || user?.fullName || user?.username || user?.email)
    .filter(Boolean)

  if (labels.length === 0) return "-"
  return labels.join(", ")
}

function getLastMessageAt(item) {
  const rows = Array.isArray(item?.request_messages)
    ? item.request_messages
    : Array.isArray(item?.messages)
      ? item.messages
      : []

  if (rows.length === 0) return "-"

  const latest = rows
    .map((message) => message?.createdAt || message?.updatedAt)
    .filter(Boolean)
    .sort((a, b) => new Date(b).getTime() - new Date(a).getTime())[0]

  return formatDate(latest)
}

function mapRows(payload) {
  if (Array.isArray(payload?.data)) return payload.data
  if (Array.isArray(payload)) return payload
  return []
}

function getTotal(payload, rowsLength) {
  const total = payload?.meta?.pagination?.total
  if (typeof total === "number") return total
  return rowsLength
}

function normalizePageSize(value) {
  const size = Number(value)
  if (!Number.isInteger(size) || size <= 0) return 20
  return size
}

export default function RequestMonitorPage() {
  const navigate = useNavigate()

  const [q, setQ] = useState("")
  const [status, setStatus] = useState("")

  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  const [pagination, setPagination] = useState({
    page: 1,
    pageSize: 20,
    total: 0,
  })

  const pageCount = useMemo(() => {
    const total = pagination.total || 0
    const pageSize = pagination.pageSize || 20
    return Math.max(1, Math.ceil(total / pageSize))
  }, [pagination.total, pagination.pageSize])

  const loadData = useCallback(async ({ page = 1, pageSize = 20, keyword = "", requestStatus = "" } = {}) => {
    setLoading(true)
    setError("")

    try {
      const params = {
        "pagination[page]": page,
        "pagination[pageSize]": pageSize,
        "sort[0]": "createdAt:desc",
        "populate[requester]": "*",
        "populate[createdBy]": "*",
        "populate[category]": "*",
        "populate[request_category]": "*",
        "populate[request_assignees][populate][user]": "*",
        "populate[assignees]": "*",
        "populate[request_messages]": "*",
        "populate[messages]": "*",
        "populate[attachments]": "*",
      }

      const trimmedKeyword = String(keyword || "").trim()
      if (trimmedKeyword) {
        params.q = trimmedKeyword
        params["filters[$or][0][title][$containsi]"] = trimmedKeyword
        params["filters[$or][1][code][$containsi]"] = trimmedKeyword
        params["filters[$or][2][requester][fullname][$containsi]"] = trimmedKeyword
        params["filters[$or][3][requester][username][$containsi]"] = trimmedKeyword
        params["filters[$or][4][request_assignees][user][fullname][$containsi]"] = trimmedKeyword
        params["filters[$or][5][request_assignees][user][username][$containsi]"] = trimmedKeyword
      }

      if (requestStatus) {
        params["filters[request_status][$eq]"] = requestStatus
      }

      let response
      try {
        response = await axios.get("/requests", { params })
      } catch (firstError) {
        if (!requestStatus) throw firstError

        const fallbackParams = { ...params }
        delete fallbackParams["filters[request_status][$eq]"]
        fallbackParams["filters[status][$eq]"] = requestStatus
        response = await axios.get("/requests", { params: fallbackParams })
      }

      const payload = response?.data
      const mappedRows = mapRows(payload)
      const total = getTotal(payload, mappedRows.length)
      const apiPagination = payload?.meta?.pagination || {}

      setRows(mappedRows)
      setPagination({
        page: apiPagination.page || page,
        pageSize: apiPagination.pageSize || pageSize,
        total,
      })
    } catch (loadError) {
      setError(loadError?.response?.data?.error?.message || loadError?.message || "Không tải được danh sách request")
      setRows([])
      setPagination((prev) => ({ ...prev, total: 0 }))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadData({ page: 1, pageSize: pagination.pageSize, keyword: q, requestStatus: status })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const onSearch = () => {
    loadData({ page: 1, pageSize: pagination.pageSize, keyword: q, requestStatus: status })
  }

  const onClear = () => {
    setQ("")
    setStatus("")
    loadData({ page: 1, pageSize: pagination.pageSize, keyword: "", requestStatus: "" })
  }

  const onChangePage = (nextPage) => {
    if (nextPage < 1 || nextPage > pageCount || nextPage === pagination.page) return
    loadData({ page: nextPage, pageSize: pagination.pageSize, keyword: q, requestStatus: status })
  }

  const onChangePageSize = (event) => {
    const nextPageSize = normalizePageSize(event.target.value)
    loadData({ page: 1, pageSize: nextPageSize, keyword: q, requestStatus: status })
  }

  const pageItems = useMemo(() => {
    const items = []
    for (let page = 1; page <= pageCount; page += 1) items.push(page)
    return items
  }, [pageCount])

  return (
    <CRow className="justify-content-center">
      <CCol xs={12} style={{ maxWidth: 1500 }}>
        <CCard className="mb-4 ai-card">
          <CCardHeader>
            <strong>Theo dõi Requests</strong>
          </CCardHeader>
          <CCardBody>
            <CRow className="g-3 ai-form align-items-end">
              <CCol md={7}>
                <CFormLabel>Tìm kiếm</CFormLabel>
                <CFormInput
                  placeholder="Tiêu đề, mã, người tạo, assignee..."
                  value={q}
                  onChange={(event) => setQ(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") onSearch()
                  }}
                />
              </CCol>
              <CCol md={3}>
                <CFormLabel>Trạng thái</CFormLabel>
                <CFormSelect value={status} onChange={(event) => setStatus(event.target.value)}>
                  {STATUS_OPTIONS.map((option) => (
                    <option key={option.value || "all"} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </CFormSelect>
              </CCol>
              <CCol md={2} className="d-flex gap-2">
                <CButton color="primary" onClick={onSearch} disabled={loading} className="w-100">
                  Search
                </CButton>
                <CButton color="secondary" variant="outline" onClick={onClear} disabled={loading} className="w-100">
                  Clear
                </CButton>
              </CCol>
            </CRow>
          </CCardBody>
        </CCard>

        <CCard className="ai-card">
          <CCardHeader className="d-flex justify-content-between align-items-center flex-wrap gap-2">
            <div className="d-flex align-items-center gap-2">
              <strong>Danh sách Request</strong>
              <CBadge color="secondary">{pagination.total}</CBadge>
            </div>
          </CCardHeader>
          <CCardBody>
            {error ? <CAlert color="danger">{error}</CAlert> : null}

            {loading ? (
              <div className="d-flex align-items-center gap-2 py-2">
                <CSpinner size="sm" />
                <span>Đang tải dữ liệu...</span>
              </div>
            ) : (
              <>
                <CTable responsive hover className="mb-3 ai-table">
                  <CTableHead>
                    <CTableRow>
                      <CTableHeaderCell style={{ minWidth: 170 }}>CreatedAt</CTableHeaderCell>
                      <CTableHeaderCell style={{ minWidth: 260 }}>Title / Code</CTableHeaderCell>
                      <CTableHeaderCell style={{ minWidth: 180 }}>Category</CTableHeaderCell>
                      <CTableHeaderCell style={{ minWidth: 120 }}>Status</CTableHeaderCell>
                      <CTableHeaderCell style={{ minWidth: 170 }}>CreatedBy</CTableHeaderCell>
                      <CTableHeaderCell style={{ minWidth: 220 }}>Assignees</CTableHeaderCell>
                      <CTableHeaderCell style={{ minWidth: 170 }}>LastMessageAt</CTableHeaderCell>
                      <CTableHeaderCell style={{ minWidth: 170 }}>UpdatedAt</CTableHeaderCell>
                      <CTableHeaderCell style={{ minWidth: 120 }}>Thao tác</CTableHeaderCell>
                    </CTableRow>
                  </CTableHead>
                  <CTableBody>
                    {rows.length === 0 ? (
                      <CTableRow>
                        <CTableDataCell colSpan={9} className="text-center text-body-secondary py-4">
                          Không có dữ liệu request
                        </CTableDataCell>
                      </CTableRow>
                    ) : (
                      rows.map((item) => {
                        const requestId = item?.id
                        const title = item?.title || "-"
                        const code = item?.code ? `#${item.code}` : ""
                        const categoryName = item?.category?.name || item?.request_category?.name || "-"
                        const requestStatus = getStatus(item)

                        return (
                          <CTableRow
                            key={requestId}
                            style={{ cursor: "pointer" }}
                            onClick={() => navigate(`/requests/monitor/${requestId}`)}
                          >
                            <CTableDataCell>{formatDate(item?.createdAt)}</CTableDataCell>
                            <CTableDataCell>
                              <div className="fw-semibold">{title}</div>
                              <div className="text-body-secondary small">{code || "-"}</div>
                            </CTableDataCell>
                            <CTableDataCell>{categoryName}</CTableDataCell>
                            <CTableDataCell>
                              <CBadge color={getStatusColor(requestStatus)}>{requestStatus}</CBadge>
                            </CTableDataCell>
                            <CTableDataCell>{getCreatedByName(item)}</CTableDataCell>
                            <CTableDataCell>{getAssignees(item)}</CTableDataCell>
                            <CTableDataCell>{getLastMessageAt(item)}</CTableDataCell>
                            <CTableDataCell>{formatDate(item?.updatedAt)}</CTableDataCell>
                            <CTableDataCell>
                              <CButton
                                color="secondary"
                                variant="outline"
                                size="sm"
                                onClick={(event) => {
                                  event.stopPropagation()
                                  navigate(`/requests/monitor/${requestId}`)
                                }}
                              >
                                Xem chi tiết
                              </CButton>
                            </CTableDataCell>
                          </CTableRow>
                        )
                      })
                    )}
                  </CTableBody>
                </CTable>

                <div className="d-flex flex-wrap justify-content-between align-items-center gap-2">
                  <div className="d-flex align-items-center gap-2 ai-form">
                    <span>Page size</span>
                    <CFormSelect value={pagination.pageSize} onChange={onChangePageSize} style={{ width: 110 }}>
                      <option value={10}>10</option>
                      <option value={20}>20</option>
                      <option value={50}>50</option>
                    </CFormSelect>
                  </div>

                  <CPagination align="end" className="mb-0">
                    <CPaginationItem
                      disabled={pagination.page <= 1 || loading}
                      onClick={() => onChangePage(pagination.page - 1)}
                    >
                      Prev
                    </CPaginationItem>

                    {pageItems.map((page) => (
                      <CPaginationItem
                        key={page}
                        active={page === pagination.page}
                        disabled={loading}
                        onClick={() => onChangePage(page)}
                      >
                        {page}
                      </CPaginationItem>
                    ))}

                    <CPaginationItem
                      disabled={pagination.page >= pageCount || loading}
                      onClick={() => onChangePage(pagination.page + 1)}
                    >
                      Next
                    </CPaginationItem>
                  </CPagination>
                </div>
              </>
            )}
          </CCardBody>
        </CCard>
      </CCol>
    </CRow>
  )
}
