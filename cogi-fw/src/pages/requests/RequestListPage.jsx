import { useEffect, useMemo, useState } from "react"
import { Link, useLocation, useNavigate } from "react-router-dom"
import {
  CBadge,
  CButton,
  CCard,
  CCardBody,
  CCardHeader,
  CCol,
  CFormInput,
  CFormLabel,
  CFormSelect,
  CLink,
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
import { useIam } from "../../contexts/IamContext"

const STATUS_OPTIONS = [
  { value: "", label: "Tất cả" },
  { value: "OPEN", label: "Mới" },
  { value: "IN_PROGRESS", label: "Đang xử lý" },
  { value: "WAITING", label: "Đang chờ" },
  { value: "DONE", label: "Hoàn tất xử lý" },
  { value: "CLOSED", label: "Đã đóng" },
  { value: "CANCELLED", label: "Đã hủy" },
]

const SCOPE_OPTIONS = [
  { value: "RELEVANT", label: "Liên quan tôi" },
  { value: "MINE", label: "Của tôi" },
  { value: "ASSIGNED", label: "Tôi được giao" },
  { value: "WATCHING", label: "Tôi theo dõi" },
]

function normalizeScopeFromQuery(rawScope) {
  const scope = String(rawScope || "").trim().toLowerCase()
  if (!scope) return "RELEVANT"
  if (scope === "related" || scope === "relevant") return "RELEVANT"
  if (scope === "created" || scope === "mine") return "MINE"
  if (scope === "assigned") return "ASSIGNED"
  if (scope === "watching") return "WATCHING"
  return "RELEVANT"
}

function normalizeStatusFromQuery(rawStatus) {
  const status = String(rawStatus || "").trim()
  if (!status) return ""

  const upper = status.toUpperCase()
  if (upper === "PENDING") return "WAITING"

  const validStatuses = new Set(STATUS_OPTIONS.map((item) => item.value).filter(Boolean))
  if (validStatuses.has(upper)) return upper

  return ""
}

function parsePositiveInt(rawValue, fallbackValue) {
  const value = Number(rawValue)
  if (!Number.isInteger(value) || value <= 0) return fallbackValue
  return value
}

function formatDate(value) {
  if (!value) return ""
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ""
  return date.toLocaleString()
}

function getStatusLabel(status) {
  const found = STATUS_OPTIONS.find((item) => item.value === status)
  return found?.label || status || "-"
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

function getStatusClass(status) {
  if (status === "OPEN") return "ai-status-open"
  if (status === "IN_PROGRESS") return "ai-status-in-progress"
  if (status === "WAITING") return "ai-status-waiting"
  if (status === "DONE") return "ai-status-done"
  if (status === "CLOSED") return "ai-status-closed"
  if (status === "CANCELLED") return "ai-status-cancelled"
  return ""
}

function getDecisionClass(decision) {
  if (decision === "APPROVED") return "ai-status-approved"
  if (decision === "REJECTED") return "ai-status-rejected"
  return ""
}

function getDecisionBadge(decision) {
  if (decision === "APPROVED") return { color: "success", label: "Đã duyệt" }
  if (decision === "REJECTED") return { color: "danger", label: "Từ chối" }
  return null
}

export default function RequestListPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const { can } = useIam()

  const [requests, setRequests] = useState([])
  const [loading, setLoading] = useState(false)
  const [pagination, setPagination] = useState({
    page: 1,
    pageSize: 10,
    total: 0,
  })

  const [fromDate, setFromDate] = useState("")
  const [toDate, setToDate] = useState("")
  const [keyword, setKeyword] = useState("")
  const [requester, setRequester] = useState("")
  const [requestStatus, setRequestStatus] = useState("")
  const [scope, setScope] = useState("RELEVANT")

  const [appliedFilters, setAppliedFilters] = useState({
    fromDate: "",
    toDate: "",
    keyword: "",
    requester: "",
    requestStatus: "",
    scope: "RELEVANT",
  })

  const pageCount = useMemo(() => {
    if (!pagination.total || !pagination.pageSize) return 1
    return Math.max(1, Math.ceil(pagination.total / pagination.pageSize))
  }, [pagination.total, pagination.pageSize])

  async function loadData({ page = pagination.page, pageSize = pagination.pageSize, filters = appliedFilters } = {}) {
    setLoading(true)
    try {
      const requesterId = Number(filters.requester)

      const params = {
        sort: "createdAt:desc",
        populate: ["requester", "request_category", "request_assignees.user", "watchers"],
        "pagination[page]": page,
        "pagination[pageSize]": pageSize,
        "filters[from]": filters.fromDate || undefined,
        "filters[to]": filters.toDate || undefined,
        "filters[keyword]": filters.keyword || undefined,
        "filters[requester]": filters.requester || undefined,
        "filters[request_status]": filters.requestStatus || undefined,
        page,
        pageSize,
        fromDate: filters.fromDate || undefined,
        toDate: filters.toDate || undefined,
        keyword: filters.keyword || undefined,
        requesterId: Number.isInteger(requesterId) && requesterId > 0 ? requesterId : undefined,
        request_status: filters.requestStatus || undefined,
        status: filters.requestStatus || undefined,
        scope: filters.scope || undefined,
      }

      const res = await axios.get("/requests", { params })
      const rows = Array.isArray(res?.data?.data) ? res.data.data : []
      const p = res?.data?.meta?.pagination || {}

      setRequests(rows)
      setPagination({
        page: p.page ?? page,
        pageSize: p.pageSize ?? pageSize,
        total: p.total ?? 0,
      })
    } catch (error) {
      console.log(error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    const searchParams = new URLSearchParams(location.search)

    const initialScope = normalizeScopeFromQuery(searchParams.get("scope"))
    const initialStatus = normalizeStatusFromQuery(searchParams.get("status"))
    const initialKeyword = (searchParams.get("q") || "").trim()
    const initialPage = parsePositiveInt(searchParams.get("page"), 1)
    const initialPageSize = parsePositiveInt(searchParams.get("pageSize"), 10)

    const initialFilters = {
      fromDate: "",
      toDate: "",
      keyword: initialKeyword,
      requester: "",
      requestStatus: initialStatus,
      scope: initialScope,
    }

    setFromDate("")
    setToDate("")
    setKeyword(initialKeyword)
    setRequester("")
    setRequestStatus(initialStatus)
    setScope(initialScope)
    setAppliedFilters(initialFilters)
    setPagination((prev) => ({ ...prev, page: initialPage, pageSize: initialPageSize }))

    loadData({ page: initialPage, pageSize: initialPageSize, filters: initialFilters })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.search])

  const onSearch = () => {
    const nextFilters = {
      fromDate,
      toDate,
      keyword: keyword.trim(),
      requester: requester.trim(),
      requestStatus,
      scope,
    }

    setAppliedFilters(nextFilters)
    setPagination((prev) => ({ ...prev, page: 1 }))
    loadData({ page: 1, pageSize: pagination.pageSize, filters: nextFilters })
  }

  const onReset = () => {
    const empty = { fromDate: "", toDate: "", keyword: "", requester: "", requestStatus: "", scope: "RELEVANT" }
    setFromDate("")
    setToDate("")
    setKeyword("")
    setRequester("")
    setRequestStatus("")
    setScope("RELEVANT")
    setAppliedFilters(empty)
    setPagination((prev) => ({ ...prev, page: 1 }))
    loadData({ page: 1, pageSize: pagination.pageSize, filters: empty })
  }

  const onChangePage = (nextPage) => {
    if (nextPage < 1 || nextPage > pageCount || nextPage === pagination.page) return
    loadData({ page: nextPage, pageSize: pagination.pageSize, filters: appliedFilters })
  }

  const onChangePageSize = (event) => {
    const nextSize = Number(event.target.value)
    if (!Number.isInteger(nextSize) || nextSize <= 0) return

    loadData({ page: 1, pageSize: nextSize, filters: appliedFilters })
  }

  const pageItems = useMemo(() => {
    const pages = []
    for (let index = 1; index <= pageCount; index += 1) {
      pages.push(index)
    }
    return pages
  }, [pageCount])

  const goToDetail = (requestId) => {
    const parsedId = Number(requestId)
    if (!Number.isInteger(parsedId) || parsedId <= 0) return
    navigate(`/requests/${parsedId}`)
  }

  return (
    <CRow className="justify-content-center">
      <CCol xs={12} style={{ maxWidth: 1200 }}>
        <CCard className="mb-4 ai-card">
          <CCardHeader>
            <strong>Bộ lọc</strong>
          </CCardHeader>
          <CCardBody>
            <CRow className="g-3 ai-form">
              <CCol md={2}>
                <CFormInput type="date" label="From date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
              </CCol>
              <CCol md={2}>
                <CFormInput type="date" label="To date" value={toDate} onChange={(e) => setToDate(e.target.value)} />
              </CCol>
              <CCol md={2}>
                <CFormInput label="Keyword" placeholder="Search title..." value={keyword} onChange={(e) => setKeyword(e.target.value)} />
              </CCol>
              <CCol md={2}>
                <CFormInput label="Requester" placeholder="Requester ID" value={requester} onChange={(e) => setRequester(e.target.value)} />
              </CCol>
              <CCol md={2}>
                <CFormLabel>Trạng thái</CFormLabel>
                <CFormSelect value={requestStatus} onChange={(e) => setRequestStatus(e.target.value)}>
                  {STATUS_OPTIONS.map((item) => (
                    <option key={item.value || "all"} value={item.value}>
                      {item.label}
                    </option>
                  ))}
                </CFormSelect>
              </CCol>
              <CCol md={2}>
                <CFormLabel>Phạm vi</CFormLabel>
                <CFormSelect value={scope} onChange={(e) => setScope(e.target.value)}>
                  {SCOPE_OPTIONS.map((item) => (
                    <option key={item.value} value={item.value}>
                      {item.label}
                    </option>
                  ))}
                </CFormSelect>
              </CCol>

              <CCol xs={12} className="d-flex justify-content-end gap-2">
                <CButton color="primary" onClick={onSearch} disabled={loading}>Search</CButton>
                <CButton color="secondary" variant="outline" onClick={onReset} disabled={loading}>Reset</CButton>
              </CCol>
            </CRow>
          </CCardBody>
        </CCard>

        <CCard className="mb-4 ai-card">
          <CCardHeader className="d-flex justify-content-between align-items-center gap-2 flex-wrap">
            <div className="d-flex align-items-center gap-2">
              <strong>Request List</strong>
              <CBadge color="secondary">{pagination.total || 0}</CBadge>
            </div>
            <div className="d-flex align-items-center gap-2">
              {can("requests/new") ? (
                <CButton as={Link} to="/requests/new" color="primary" size="sm">
                  Create
                </CButton>
              ) : null}
            </div>
          </CCardHeader>
          <CCardBody>
            {loading ? (
              <div className="d-flex align-items-center gap-2">
                <CSpinner size="sm" />
                <span>Loading...</span>
              </div>
            ) : (
              <>
                <CTable hover responsive className="mb-3 ai-table">
                  <CTableHead>
                    <CTableRow>
                      <CTableHeaderCell>Title</CTableHeaderCell>
                      <CTableHeaderCell style={{ width: 150 }}>Status</CTableHeaderCell>
                      <CTableHeaderCell style={{ width: 200 }}>Requester</CTableHeaderCell>
                      <CTableHeaderCell style={{ width: 220 }}>Category</CTableHeaderCell>
                      <CTableHeaderCell style={{ width: 140 }}>Kết quả</CTableHeaderCell>
                      <CTableHeaderCell style={{ width: 220 }}>UpdatedAt</CTableHeaderCell>
                    </CTableRow>
                  </CTableHead>
                  <CTableBody>
                    {requests.length === 0 ? (
                      <CTableRow>
                        <CTableDataCell colSpan={6} className="text-center text-body-secondary">
                          No data
                        </CTableDataCell>
                      </CTableRow>
                    ) : (
                      requests.map((item) => {
                        const decisionBadge = getDecisionBadge(item?.closedDecision)

                        return (
                        <CTableRow
                          key={item.id}
                          style={{ cursor: "pointer" }}
                          onClick={() => goToDetail(item.id)}
                        >
                          <CTableDataCell>
                            {item?.id ? (
                              <CLink
                                as={Link}
                                to={`/requests/${item.id}`}
                                onClick={(event) => event.stopPropagation()}
                              >
                                {item?.title || "-"}
                              </CLink>
                            ) : (
                              item?.title || "-"
                            )}
                          </CTableDataCell>
                          <CTableDataCell>
                            <CBadge color={getStatusColor(item?.request_status)} className={`ai-status-badge ${getStatusClass(item?.request_status)}`}>
                              {getStatusLabel(item?.request_status)}
                            </CBadge>
                          </CTableDataCell>
                          <CTableDataCell>{item?.requester?.username || "-"}</CTableDataCell>
                          <CTableDataCell>{item?.category?.name || "-"}</CTableDataCell>
                          <CTableDataCell>
                            {item?.request_status === "CLOSED" && decisionBadge ? (
                              <CBadge color={decisionBadge.color} className={`ai-status-badge ${getDecisionClass(item?.closedDecision)}`}>
                                {decisionBadge.label}
                              </CBadge>
                            ) : (
                              ""
                            )}
                          </CTableDataCell>
                          <CTableDataCell>{formatDate(item?.updatedAt)}</CTableDataCell>
                        </CTableRow>
                        )
                      })
                    )}
                  </CTableBody>
                </CTable>

                <div className="d-flex flex-wrap justify-content-between align-items-center gap-2">
                  <div className="d-flex align-items-center gap-2">
                    <span>Page size</span>
                    <CFormSelect
                      className="ai-form"
                      value={pagination.pageSize}
                      onChange={onChangePageSize}
                      style={{ width: 100 }}
                    >
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
                    {pageItems.map((p) => (
                      <CPaginationItem
                        key={p}
                        active={p === pagination.page}
                        disabled={loading}
                        onClick={() => onChangePage(p)}
                      >
                        {p}
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
