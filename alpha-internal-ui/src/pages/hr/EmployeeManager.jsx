import { useCallback, useEffect, useMemo, useState } from "react"
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
  CFormTextarea,
  CModal,
  CModalBody,
  CModalFooter,
  CModalHeader,
  CModalTitle,
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
import { useNavigate } from "react-router-dom"
import axios from "../../api/api"
import { formatDateDDMMYYYY, getStatusMeta, STATUS_OPTIONS } from "./hrFormatters"

const GENDER_OPTIONS = [
  { value: "", label: "-- Chọn --" },
  { value: "male", label: "Male" },
  { value: "female", label: "Female" },
  { value: "other", label: "Other" },
]

const EMPTY_FORM = {
  employeeCode: "",
  fullName: "",
  gender: "",
  dateOfBirth: "",
  phone: "",
  workEmail: "",
  personalEmail: "",
  address: "",
  joinDate: "",
  officialDate: "",
  status: "active",
  currentDepartment: "",
  currentPosition: "",
  currentManager: "",
  user: "",
  note: "",
  avatarId: null,
  avatarName: "",
  avatarUrl: "",
  avatarFile: null,
  avatarCleared: false,
}

function normalizeApiRows(payload) {
  if (Array.isArray(payload?.data)) return payload.data
  if (Array.isArray(payload)) return payload
  return []
}

function parsePositiveInteger(value) {
  const parsed = Number(value)
  if (!Number.isInteger(parsed) || parsed <= 0) return null
  return parsed
}

function flattenEntity(entity) {
  if (!entity) return null

  if (entity?.data) {
    const row = entity.data
    if (!row) return null
    if (row?.attributes) {
      return { id: row.id, documentId: row.documentId, ...row.attributes }
    }
    return row
  }

  if (entity?.attributes) {
    return { id: entity.id, documentId: entity.documentId, ...entity.attributes }
  }

  return entity
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

function toEmployeeRow(item) {
  const source = item?.attributes ? { id: item.id, documentId: item.documentId, ...item.attributes } : item

  const department = flattenEntity(source?.currentDepartment)
  const position = flattenEntity(source?.currentPosition)
  const manager = flattenEntity(source?.currentManager)
  const user = flattenEntity(source?.user)
  const avatar = flattenEntity(source?.avatar)

  return {
    id: source?.id,
    documentId: source?.documentId || null,
    employeeCode: source?.employeeCode || "",
    fullName: source?.fullName || "",
    gender: source?.gender || "",
    dateOfBirth: source?.dateOfBirth || "",
    phone: source?.phone || "",
    workEmail: source?.workEmail || "",
    personalEmail: source?.personalEmail || "",
    address: source?.address || "",
    joinDate: source?.joinDate || "",
    officialDate: source?.officialDate || "",
    status: source?.status || "",
    note: source?.note || "",
    department,
    position,
    manager,
    user,
    avatar,
    updatedAt: source?.updatedAt || null,
  }
}

function getIdentifier(row) {
  return row?.documentId || row?.id || null
}

function getRelationId(entity) {
  return entity?.id ? String(entity.id) : ""
}

function normalizeOptionRows(payload) {
  return normalizeApiRows(payload).map((row) => {
    const item = row?.attributes ? { id: row.id, documentId: row.documentId, ...row.attributes } : row
    return item
  })
}

function isValidEmail(email) {
  if (!email) return true
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email).trim())
}

export default function EmployeeManager() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  const [rows, setRows] = useState([])
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [total, setTotal] = useState(0)
  const [pageCount, setPageCount] = useState(1)

  const [filters, setFilters] = useState({
    keywordDraft: "",
    keyword: "",
    department: "",
    position: "",
    status: "",
  })

  const [departments, setDepartments] = useState([])
  const [positions, setPositions] = useState([])
  const [managers, setManagers] = useState([])
  const [users, setUsers] = useState([])

  const [showFormModal, setShowFormModal] = useState(false)
  const [editingRow, setEditingRow] = useState(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [formErrors, setFormErrors] = useState({})
  const [saving, setSaving] = useState(false)

  const fromToText = useMemo(() => {
    if (!total) return "0"
    const from = (page - 1) * pageSize + 1
    const to = Math.min(page * pageSize, total)
    return `${from}–${to}/${total}`
  }, [page, pageSize, total])

  const pageItems = useMemo(() => {
    const items = []
    for (let index = 1; index <= pageCount; index += 1) {
      items.push(index)
    }
    return items
  }, [pageCount])

  async function uploadAvatar(file) {
    if (!file) return null

    const formData = new FormData()
    formData.append("files", file)

    const response = await axios.post("/upload", formData)

    const rows = Array.isArray(response?.data) ? response.data : []
    const first = rows[0]
    return first?.id ? Number(first.id) : null
  }

  const loadOptions = useCallback(async () => {
    try {
      const [departmentRes, positionRes, managerRes, userRes] = await Promise.all([
        axios.get("/departments", {
          params: {
            "pagination[page]": 1,
            "pagination[pageSize]": 200,
            "sort[0]": "name:asc",
          },
        }),
        axios.get("/positions", {
          params: {
            "pagination[page]": 1,
            "pagination[pageSize]": 200,
            "sort[0]": "name:asc",
          },
        }),
        axios.get("/employees", {
          params: {
            "pagination[page]": 1,
            "pagination[pageSize]": 500,
            "sort[0]": "fullName:asc",
          },
        }),
        axios.get("/users", {
          params: {
            "pagination[page]": 1,
            "pagination[pageSize]": 500,
            sort: "username:asc",
          },
        }),
      ])

      setDepartments(normalizeOptionRows(departmentRes?.data))
      setPositions(normalizeOptionRows(positionRes?.data))
      setManagers(normalizeOptionRows(managerRes?.data))

      const userRowsRaw = normalizeApiRows(userRes?.data)
      setUsers(
        userRowsRaw.map((item) =>
          item?.attributes ? { id: item.id, documentId: item.documentId, ...item.attributes } : item
        )
      )
    } catch {
      setDepartments([])
      setPositions([])
      setManagers([])
      setUsers([])
    }
  }, [])

  const loadData = useCallback(async () => {
    setLoading(true)
    setError("")

    try {
      const params = {
        "pagination[page]": page,
        "pagination[pageSize]": pageSize,
        "sort[0]": "updatedAt:desc",
        "populate[currentDepartment][fields][0]": "name",
        "populate[currentPosition][fields][0]": "name",
        "populate[currentManager][fields][0]": "employeeCode",
        "populate[currentManager][fields][1]": "fullName",
        "populate[user][fields][0]": "username",
        "populate[user][fields][1]": "email",
        "populate[avatar][fields][0]": "name",
        "populate[avatar][fields][1]": "url",
      }

      const keyword = String(filters.keyword || "").trim()
      if (keyword) {
        params["filters[$or][0][fullName][$containsi]"] = keyword
        params["filters[$or][1][employeeCode][$containsi]"] = keyword
        params["filters[$or][2][phone][$containsi]"] = keyword
        params["filters[$or][3][workEmail][$containsi]"] = keyword
        params["filters[$or][4][personalEmail][$containsi]"] = keyword
      }

      if (filters.department) {
        params["filters[currentDepartment][id][$eq]"] = Number(filters.department)
      }

      if (filters.position) {
        params["filters[currentPosition][id][$eq]"] = Number(filters.position)
      }

      if (filters.status) {
        params["filters[status][$eq]"] = filters.status
      }

      const response = await axios.get("/employees", { params })
      const payload = response?.data
      const dataRows = normalizeApiRows(payload).map(toEmployeeRow)
      const pagination = payload?.meta?.pagination || {}

      setRows(dataRows)
      setTotal(pagination?.total || dataRows.length)
      setPage(pagination?.page || page)
      setPageSize(pagination?.pageSize || pageSize)
      setPageCount(Math.max(1, pagination?.pageCount || 1))
    } catch (loadError) {
      setError(loadError?.response?.data?.error?.message || loadError?.message || "Không tải được danh sách nhân sự")
      setRows([])
      setTotal(0)
      setPageCount(1)
    } finally {
      setLoading(false)
    }
  }, [filters.department, filters.keyword, filters.position, filters.status, page, pageSize])

  useEffect(() => {
    loadOptions()
  }, [loadOptions])

  useEffect(() => {
    loadData()
  }, [loadData])

  function openCreateModal() {
    setEditingRow(null)
    setForm(EMPTY_FORM)
    setFormErrors({})
    setShowFormModal(true)
  }

  function openEditModal(row) {
    setEditingRow(row)
    setForm({
      employeeCode: row.employeeCode || "",
      fullName: row.fullName || "",
      gender: row.gender || "",
      dateOfBirth: row.dateOfBirth || "",
      phone: row.phone || "",
      workEmail: row.workEmail || "",
      personalEmail: row.personalEmail || "",
      address: row.address || "",
      joinDate: row.joinDate || "",
      officialDate: row.officialDate || "",
      status: row.status || "active",
      currentDepartment: getRelationId(row.department),
      currentPosition: getRelationId(row.position),
      currentManager: getRelationId(row.manager),
      user: getRelationId(row.user),
      note: row.note || "",
      avatarId: row.avatar?.id || null,
      avatarName: row.avatar?.name || "",
      avatarUrl: toFileUrl(row.avatar?.url),
      avatarFile: null,
      avatarCleared: false,
    })
    setFormErrors({})
    setShowFormModal(true)
  }

  function validateForm() {
    const errors = {}

    if (!String(form.employeeCode || "").trim()) {
      errors.employeeCode = "Employee Code là bắt buộc"
    }

    if (!String(form.fullName || "").trim()) {
      errors.fullName = "Full Name là bắt buộc"
    }

    if (!String(form.status || "").trim()) {
      errors.status = "Status là bắt buộc"
    }

    if (!isValidEmail(form.workEmail)) {
      errors.workEmail = "Work Email không hợp lệ"
    }

    if (!isValidEmail(form.personalEmail)) {
      errors.personalEmail = "Personal Email không hợp lệ"
    }

    setFormErrors(errors)
    return Object.keys(errors).length === 0
  }

  async function onSave() {
    if (!validateForm()) return

    setSaving(true)
    setError("")

    try {
      let avatarId = form.avatarId
      if (form.avatarFile) {
        avatarId = await uploadAvatar(form.avatarFile)
      }

      const payload = {
        employeeCode: String(form.employeeCode || "").trim(),
        fullName: String(form.fullName || "").trim(),
        gender: form.gender || null,
        dateOfBirth: form.dateOfBirth || null,
        phone: String(form.phone || "").trim() || null,
        workEmail: String(form.workEmail || "").trim() || null,
        personalEmail: String(form.personalEmail || "").trim() || null,
        address: String(form.address || "").trim() || null,
        joinDate: form.joinDate || null,
        officialDate: form.officialDate || null,
        status: form.status || "active",
        currentDepartment: parsePositiveInteger(form.currentDepartment),
        currentPosition: parsePositiveInteger(form.currentPosition),
        currentManager: parsePositiveInteger(form.currentManager),
        user: parsePositiveInteger(form.user),
        note: String(form.note || "").trim() || null,
      }

      if (form.avatarCleared) {
        payload.avatar = null
      } else if (avatarId) {
        payload.avatar = avatarId
      }

      const identifier = getIdentifier(editingRow)
      if (identifier) {
        await axios.put(`/employees/${encodeURIComponent(identifier)}`, { data: payload })
      } else {
        await axios.post("/employees", { data: payload })
      }

      setShowFormModal(false)
      await loadData()
      await loadOptions()
    } catch (saveError) {
      setError(saveError?.response?.data?.error?.message || saveError?.message || "Lưu nhân sự thất bại")
    } finally {
      setSaving(false)
    }
  }

  const managerOptions = useMemo(() => {
    const currentEditingId = editingRow?.id || null
    return managers.filter((item) => item.id !== currentEditingId)
  }, [editingRow?.id, managers])

  return (
    <CRow className="justify-content-center">
      <CCol xs={12} style={{ maxWidth: 1500 }}>
        <CCard className="mb-4 ai-card">
          <CCardHeader>
            <strong>Bộ lọc</strong>
          </CCardHeader>
          <CCardBody>
            <CRow className="g-3 ai-form align-items-end">
              <CCol md={4}>
                <CFormLabel>Từ khóa</CFormLabel>
                <CFormInput
                  placeholder="fullName, employeeCode, phone, email"
                  value={filters.keywordDraft}
                  onChange={(event) => {
                    const value = event.target.value
                    setFilters((prev) => ({ ...prev, keywordDraft: value }))
                  }}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      setPage(1)
                      setFilters((prev) => ({ ...prev, keyword: prev.keywordDraft.trim() }))
                    }
                  }}
                />
              </CCol>

              <CCol md={2}>
                <CFormLabel>Department</CFormLabel>
                <CFormSelect
                  value={filters.department}
                  onChange={(event) => setFilters((prev) => ({ ...prev, department: event.target.value }))}
                >
                  <option value="">Tất cả</option>
                  {departments.map((department) => (
                    <option key={department.id} value={department.id}>
                      {department.name || `Department #${department.id}`}
                    </option>
                  ))}
                </CFormSelect>
              </CCol>

              <CCol md={2}>
                <CFormLabel>Position</CFormLabel>
                <CFormSelect
                  value={filters.position}
                  onChange={(event) => setFilters((prev) => ({ ...prev, position: event.target.value }))}
                >
                  <option value="">Tất cả</option>
                  {positions.map((position) => (
                    <option key={position.id} value={position.id}>
                      {position.name || `Position #${position.id}`}
                    </option>
                  ))}
                </CFormSelect>
              </CCol>

              <CCol md={2}>
                <CFormLabel>Status</CFormLabel>
                <CFormSelect
                  value={filters.status}
                  onChange={(event) => setFilters((prev) => ({ ...prev, status: event.target.value }))}
                >
                  <option value="">Tất cả</option>
                  {STATUS_OPTIONS.map((item) => (
                    <option key={item.value} value={item.value}>
                      {item.label}
                    </option>
                  ))}
                </CFormSelect>
              </CCol>

              <CCol md={2} className="d-flex gap-2">
                <CButton
                  color="primary"
                  onClick={() => {
                    setPage(1)
                    setFilters((prev) => ({ ...prev, keyword: prev.keywordDraft.trim() }))
                  }}
                  disabled={loading}
                >
                  Search
                </CButton>
                <CButton
                  color="secondary"
                  variant="outline"
                  onClick={() => {
                    setPage(1)
                    setFilters({
                      keywordDraft: "",
                      keyword: "",
                      department: "",
                      position: "",
                      status: "",
                    })
                  }}
                  disabled={loading}
                >
                  Reset
                </CButton>
              </CCol>
            </CRow>
          </CCardBody>
        </CCard>

        <CCard className="ai-card">
          <CCardHeader className="d-flex justify-content-between align-items-center gap-2 flex-wrap">
            <div className="d-flex align-items-center gap-2">
              <strong>Employees</strong>
              <CBadge color="secondary">{total}</CBadge>
            </div>

            <div className="d-flex align-items-center gap-2">
              <span className="text-body-secondary small">{fromToText}</span>
              <CButton color="primary" size="sm" onClick={openCreateModal}>
                Thêm mới
              </CButton>
            </div>
          </CCardHeader>

          <CCardBody>
            {error ? <CAlert color="danger">{error}</CAlert> : null}

            {loading ? (
              <div className="d-flex align-items-center gap-2">
                <CSpinner size="sm" />
                <span>Đang tải dữ liệu...</span>
              </div>
            ) : (
              <>
                {rows.length === 0 ? (
                  <CCard className="border-0 bg-light mb-3">
                    <CCardBody className="text-center text-body-secondary py-4">No employees found</CCardBody>
                  </CCard>
                ) : (
                  <CTable hover responsive className="mb-3 ai-table">
                    <CTableHead>
                      <CTableRow>
                        <CTableHeaderCell style={{ width: 70 }}>STT</CTableHeaderCell>
                        <CTableHeaderCell style={{ minWidth: 130 }}>Employee Code</CTableHeaderCell>
                        <CTableHeaderCell style={{ minWidth: 220 }}>Full Name</CTableHeaderCell>
                        <CTableHeaderCell style={{ minWidth: 170 }}>Department</CTableHeaderCell>
                        <CTableHeaderCell style={{ minWidth: 170 }}>Position</CTableHeaderCell>
                        <CTableHeaderCell style={{ minWidth: 190 }}>Manager</CTableHeaderCell>
                        <CTableHeaderCell style={{ minWidth: 140 }}>Phone</CTableHeaderCell>
                        <CTableHeaderCell style={{ minWidth: 140 }}>Status</CTableHeaderCell>
                        <CTableHeaderCell style={{ minWidth: 140 }}>Updated At</CTableHeaderCell>
                        <CTableHeaderCell style={{ minWidth: 170 }}>Actions</CTableHeaderCell>
                      </CTableRow>
                    </CTableHead>

                    <CTableBody>
                      {rows.map((row, index) => {
                        const statusMeta = getStatusMeta(row.status)
                        const identifier = getIdentifier(row)
                        const avatarUrl = toFileUrl(row.avatar?.url)

                        return (
                          <CTableRow key={row.documentId || row.id}>
                            <CTableDataCell>{(page - 1) * pageSize + index + 1}</CTableDataCell>
                            <CTableDataCell>{row.employeeCode || "-"}</CTableDataCell>
                            <CTableDataCell>
                              <div className="d-flex align-items-center gap-2">
                                {avatarUrl ? (
                                  <img
                                    src={avatarUrl}
                                    alt={row.fullName || "Employee avatar"}
                                    style={{ width: 32, height: 32, borderRadius: "50%", objectFit: "cover" }}
                                  />
                                ) : (
                                  <div
                                    className="d-flex align-items-center justify-content-center text-body-secondary"
                                    style={{ width: 32, height: 32, borderRadius: "50%", border: "1px solid #dee2e6", fontSize: 14 }}
                                  >
                                    👤
                                  </div>
                                )}
                                {identifier ? (
                                  <button
                                    type="button"
                                    className="btn btn-link p-0 text-decoration-none"
                                    onClick={() => navigate(`/employees/${encodeURIComponent(identifier)}`)}
                                  >
                                    {row.fullName || "-"}
                                  </button>
                                ) : (
                                  <span>{row.fullName || "-"}</span>
                                )}
                              </div>
                            </CTableDataCell>
                            <CTableDataCell>{row.department?.name || "-"}</CTableDataCell>
                            <CTableDataCell>{row.position?.name || "-"}</CTableDataCell>
                            <CTableDataCell>{row.manager?.fullName || "-"}</CTableDataCell>
                            <CTableDataCell>{row.phone || "-"}</CTableDataCell>
                            <CTableDataCell>
                              <CBadge color={statusMeta.color}>{statusMeta.label}</CBadge>
                            </CTableDataCell>
                            <CTableDataCell>{formatDateDDMMYYYY(row.updatedAt)}</CTableDataCell>
                            <CTableDataCell>
                              <div className="d-flex gap-2">
                                <CButton
                                  color="info"
                                  variant="outline"
                                  size="sm"
                                  onClick={() => {
                                    if (!identifier) return
                                    navigate(`/employees/${encodeURIComponent(identifier)}`)
                                  }}
                                >
                                  View
                                </CButton>
                                <CButton color="primary" variant="outline" size="sm" onClick={() => openEditModal(row)}>
                                  Sửa
                                </CButton>
                              </div>
                            </CTableDataCell>
                          </CTableRow>
                        )
                      })}
                    </CTableBody>
                  </CTable>
                )}

                <div className="d-flex flex-wrap justify-content-between align-items-center gap-2">
                  <div className="d-flex align-items-center gap-2 ai-form">
                    <span>Page size</span>
                    <CFormSelect
                      style={{ width: 100 }}
                      value={pageSize}
                      onChange={(event) => {
                        const value = Number(event.target.value)
                        if (!Number.isInteger(value) || value <= 0) return
                        setPage(1)
                        setPageSize(value)
                      }}
                    >
                      <option value={10}>10</option>
                      <option value={20}>20</option>
                      <option value={50}>50</option>
                    </CFormSelect>
                  </div>

                  <CPagination align="end" className="mb-0">
                    <CPaginationItem
                      disabled={page <= 1 || loading}
                      onClick={() => setPage((prev) => Math.max(1, prev - 1))}
                    >
                      Prev
                    </CPaginationItem>

                    {pageItems.map((pageItem) => (
                      <CPaginationItem
                        key={pageItem}
                        active={pageItem === page}
                        disabled={loading}
                        onClick={() => setPage(pageItem)}
                      >
                        {pageItem}
                      </CPaginationItem>
                    ))}

                    <CPaginationItem
                      disabled={page >= pageCount || loading}
                      onClick={() => setPage((prev) => Math.min(pageCount, prev + 1))}
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

      <CModal visible={showFormModal} backdrop="static" onClose={() => !saving && setShowFormModal(false)}>
        <CModalHeader>
          <CModalTitle>{editingRow ? "Chỉnh sửa Employee" : "Thêm mới Employee"}</CModalTitle>
        </CModalHeader>
        <CModalBody>
          <CRow className="g-3 ai-form">
            <CCol xs={12}>
              <strong>Employee Info</strong>
            </CCol>
            <CCol md={6}>
              <CFormLabel>Employee Code</CFormLabel>
              <CFormInput
                value={form.employeeCode}
                onChange={(event) => setForm((prev) => ({ ...prev, employeeCode: event.target.value }))}
                invalid={Boolean(formErrors.employeeCode)}
              />
              {formErrors.employeeCode ? <div className="text-danger small mt-1">{formErrors.employeeCode}</div> : null}
            </CCol>
            <CCol md={6}>
              <CFormLabel>Full Name</CFormLabel>
              <CFormInput
                value={form.fullName}
                onChange={(event) => setForm((prev) => ({ ...prev, fullName: event.target.value }))}
                invalid={Boolean(formErrors.fullName)}
              />
              {formErrors.fullName ? <div className="text-danger small mt-1">{formErrors.fullName}</div> : null}
            </CCol>
            <CCol md={4}>
              <CFormLabel>Gender</CFormLabel>
              <CFormSelect
                value={form.gender}
                onChange={(event) => setForm((prev) => ({ ...prev, gender: event.target.value }))}
              >
                {GENDER_OPTIONS.map((option) => (
                  <option key={option.value || "empty"} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </CFormSelect>
            </CCol>
            <CCol md={4}>
              <CFormLabel>Date of Birth</CFormLabel>
              <CFormInput
                type="date"
                value={form.dateOfBirth}
                onChange={(event) => setForm((prev) => ({ ...prev, dateOfBirth: event.target.value }))}
              />
            </CCol>
            <CCol md={4}>
              <CFormLabel>Phone</CFormLabel>
              <CFormInput
                value={form.phone}
                onChange={(event) => setForm((prev) => ({ ...prev, phone: event.target.value }))}
              />
            </CCol>

            <CCol xs={12}>
              <strong>Contact</strong>
            </CCol>
            <CCol md={6}>
              <CFormLabel>Work Email</CFormLabel>
              <CFormInput
                type="email"
                value={form.workEmail}
                onChange={(event) => setForm((prev) => ({ ...prev, workEmail: event.target.value }))}
                invalid={Boolean(formErrors.workEmail)}
              />
              {formErrors.workEmail ? <div className="text-danger small mt-1">{formErrors.workEmail}</div> : null}
            </CCol>
            <CCol md={6}>
              <CFormLabel>Personal Email</CFormLabel>
              <CFormInput
                type="email"
                value={form.personalEmail}
                onChange={(event) => setForm((prev) => ({ ...prev, personalEmail: event.target.value }))}
                invalid={Boolean(formErrors.personalEmail)}
              />
              {formErrors.personalEmail ? <div className="text-danger small mt-1">{formErrors.personalEmail}</div> : null}
            </CCol>
            <CCol xs={12}>
              <CFormLabel>Address</CFormLabel>
              <CFormTextarea
                rows={2}
                value={form.address}
                onChange={(event) => setForm((prev) => ({ ...prev, address: event.target.value }))}
              />
            </CCol>

            <CCol xs={12}>
              <strong>Work Info</strong>
            </CCol>
            <CCol md={4}>
              <CFormLabel>Join Date</CFormLabel>
              <CFormInput
                type="date"
                value={form.joinDate}
                onChange={(event) => setForm((prev) => ({ ...prev, joinDate: event.target.value }))}
              />
            </CCol>
            <CCol md={4}>
              <CFormLabel>Official Date</CFormLabel>
              <CFormInput
                type="date"
                value={form.officialDate}
                onChange={(event) => setForm((prev) => ({ ...prev, officialDate: event.target.value }))}
              />
            </CCol>
            <CCol md={4}>
              <CFormLabel>Status</CFormLabel>
              <CFormSelect
                value={form.status}
                onChange={(event) => setForm((prev) => ({ ...prev, status: event.target.value }))}
                invalid={Boolean(formErrors.status)}
              >
                {STATUS_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </CFormSelect>
              {formErrors.status ? <div className="text-danger small mt-1">{formErrors.status}</div> : null}
            </CCol>

            <CCol xs={12}>
              <strong>Relations</strong>
            </CCol>
            <CCol md={6}>
              <CFormLabel>Current Department</CFormLabel>
              <CFormSelect
                value={form.currentDepartment}
                onChange={(event) => setForm((prev) => ({ ...prev, currentDepartment: event.target.value }))}
              >
                <option value="">-- Chọn --</option>
                {departments.map((department) => (
                  <option key={department.id} value={department.id}>
                    {department.name || `Department #${department.id}`}
                  </option>
                ))}
              </CFormSelect>
            </CCol>
            <CCol md={6}>
              <CFormLabel>Current Position</CFormLabel>
              <CFormSelect
                value={form.currentPosition}
                onChange={(event) => setForm((prev) => ({ ...prev, currentPosition: event.target.value }))}
              >
                <option value="">-- Chọn --</option>
                {positions.map((position) => (
                  <option key={position.id} value={position.id}>
                    {position.name || `Position #${position.id}`}
                  </option>
                ))}
              </CFormSelect>
            </CCol>
            <CCol md={6}>
              <CFormLabel>Current Manager</CFormLabel>
              <CFormSelect
                value={form.currentManager}
                onChange={(event) => setForm((prev) => ({ ...prev, currentManager: event.target.value }))}
              >
                <option value="">-- Chọn --</option>
                {managerOptions.map((manager) => (
                  <option key={manager.id} value={manager.id}>
                    {`${manager.employeeCode || "-"} - ${manager.fullName || `Employee #${manager.id}`}`}
                  </option>
                ))}
              </CFormSelect>
            </CCol>
            <CCol md={6}>
              <CFormLabel>User (optional)</CFormLabel>
              <CFormSelect
                value={form.user}
                onChange={(event) => setForm((prev) => ({ ...prev, user: event.target.value }))}
              >
                <option value="">-- Chọn --</option>
                {users.map((user) => (
                  <option key={user.id} value={user.id}>
                    {user.username || user.email || `User #${user.id}`}
                  </option>
                ))}
              </CFormSelect>
            </CCol>

            <CCol xs={12}>
              <strong>Other</strong>
            </CCol>
            <CCol md={12}>
              <CFormLabel>Avatar upload</CFormLabel>
              <CFormInput
                type="file"
                accept="image/*"
                onChange={(event) => {
                  const file = event.target.files?.[0] || null
                  setForm((prev) => ({
                    ...prev,
                    avatarFile: file,
                    avatarName: file?.name || prev.avatarName,
                    avatarCleared: false,
                  }))
                }}
              />
              <div className="small text-body-secondary mt-1">
                {form.avatarFile
                  ? `File mới: ${form.avatarFile.name}`
                  : form.avatarName
                    ? `Hiện tại: ${form.avatarName}`
                    : "Chưa có avatar"}
              </div>
              {form.avatarUrl ? (
                <div className="mt-2 d-flex align-items-center gap-2">
                  <img
                    src={form.avatarUrl}
                    alt="Avatar"
                    style={{ width: 72, height: 72, objectFit: "cover", borderRadius: 8, border: "1px solid #dee2e6" }}
                  />
                  <a href={form.avatarUrl} target="_blank" rel="noreferrer">
                    Xem avatar hiện tại
                  </a>
                  <CButton
                    type="button"
                    size="sm"
                    color="danger"
                    variant="outline"
                    onClick={() => {
                      setForm((prev) => ({
                        ...prev,
                        avatarId: null,
                        avatarName: "",
                        avatarUrl: "",
                        avatarFile: null,
                        avatarCleared: true,
                      }))
                    }}
                  >
                    Xóa avatar
                  </CButton>
                </div>
              ) : null}
            </CCol>
            <CCol xs={12}>
              <CFormLabel>Note</CFormLabel>
              <CFormTextarea
                rows={3}
                value={form.note}
                onChange={(event) => setForm((prev) => ({ ...prev, note: event.target.value }))}
              />
            </CCol>
          </CRow>
        </CModalBody>
        <CModalFooter>
          <CButton color="secondary" variant="outline" onClick={() => setShowFormModal(false)} disabled={saving}>
            Hủy
          </CButton>
          <CButton color="primary" onClick={onSave} disabled={saving}>
            {saving ? "Đang lưu..." : "Lưu"}
          </CButton>
        </CModalFooter>
      </CModal>
    </CRow>
  )
}
