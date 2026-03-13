import { useCallback, useEffect, useMemo, useState } from "react"
import {
  CAlert,
  CBadge,
  CButton,
  CCard,
  CCardBody,
  CCardHeader,
  CCol,
  CFormCheck,
  CFormInput,
  CFormLabel,
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
  CFormSelect,
} from "@coreui/react"
import axios from "../../api/api"

const EMPTY_FORM = {
  name: "",
  code: "",
  slug: "",
  level: "1",
  isLeadership: false,
  isActive: true,
  description: "",
}

function formatDateTime(value) {
  if (!value) return "-"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "-"
  return date.toLocaleString()
}

function toSafeSlug(text) {
  return String(text || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
}

function buildSlug(name, code) {
  const namePart = toSafeSlug(name)
  const codePart = toSafeSlug(code)

  if (namePart && codePart) return `${namePart}-${codePart}`
  if (namePart) return namePart
  if (codePart) return codePart
  return ""
}

function getEntryIdentifier(row) {
  return row?.documentId || row?.id || null
}

function toRow(item) {
  const source = item?.attributes
    ? { id: item.id, documentId: item?.documentId, ...item.attributes }
    : item

  return {
    id: source?.id,
    documentId: source?.documentId || item?.documentId || null,
    name: source?.name || "",
    code: source?.code || "",
    slug: source?.slug || "",
    level: Number.isInteger(source?.level) ? source.level : Number(source?.level || 1),
    isLeadership: Boolean(source?.isLeadership),
    isActive: source?.isActive ?? true,
    description: source?.description || "",
    updatedAt: source?.updatedAt || null,
  }
}

function normalizeListResponse(payload) {
  const rows = Array.isArray(payload?.data)
    ? payload.data.map(toRow)
    : Array.isArray(payload)
      ? payload.map(toRow)
      : []

  const pagination = payload?.meta?.pagination
  return {
    rows,
    page: pagination?.page || 1,
    pageSize: pagination?.pageSize || rows.length || 10,
    total: pagination?.total || rows.length,
    pageCount: pagination?.pageCount || 1,
  }
}

export default function PositionManager() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  const [rows, setRows] = useState([])
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [total, setTotal] = useState(0)
  const [pageCount, setPageCount] = useState(1)

  const [searchDraft, setSearchDraft] = useState("")
  const [search, setSearch] = useState("")

  const [showModal, setShowModal] = useState(false)
  const [editingRow, setEditingRow] = useState(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [formErrors, setFormErrors] = useState({})
  const [saving, setSaving] = useState(false)
  const [togglingId, setTogglingId] = useState(null)

  const fromToText = useMemo(() => {
    if (!total) return "0"
    const from = (page - 1) * pageSize + 1
    const to = Math.min(page * pageSize, total)
    return `${from}–${to}/${total}`
  }, [page, pageSize, total])

  const pages = useMemo(() => {
    const items = []
    for (let i = 1; i <= pageCount; i += 1) {
      items.push(i)
    }
    return items
  }, [pageCount])

  const loadData = useCallback(async () => {
    setLoading(true)
    setError("")

    try {
      const params = {
        "pagination[page]": page,
        "pagination[pageSize]": pageSize,
        "sort[0]": "updatedAt:desc",
      }

      const keyword = search.trim()
      if (keyword) {
        params["filters[$or][0][name][$containsi]"] = keyword
        params["filters[$or][1][code][$containsi]"] = keyword
      }

      const res = await axios.get("/positions", { params })
      const normalized = normalizeListResponse(res?.data)

      setRows(normalized.rows)
      setPage(normalized.page)
      setPageSize(normalized.pageSize)
      setTotal(normalized.total)
      setPageCount(Math.max(1, normalized.pageCount))
    } catch (loadError) {
      setError(loadError?.response?.data?.error?.message || loadError?.message || "Không tải được danh sách positions")
      setRows([])
      setTotal(0)
      setPageCount(1)
    } finally {
      setLoading(false)
    }
  }, [page, pageSize, search])

  useEffect(() => {
    loadData()
  }, [loadData])

  function openCreateModal() {
    setEditingRow(null)
    setForm(EMPTY_FORM)
    setFormErrors({})
    setShowModal(true)
  }

  function openEditModal(row) {
    setEditingRow(row)
    setForm({
      name: row.name || "",
      code: row.code || "",
      slug: row.slug || "",
      level: String(Number.isInteger(row.level) ? row.level : 1),
      isLeadership: Boolean(row.isLeadership),
      isActive: row.isActive ?? true,
      description: row.description || "",
    })
    setFormErrors({})
    setShowModal(true)
  }

  function validateForm() {
    const errors = {}

    if (!String(form.name || "").trim()) {
      errors.name = "Tên là bắt buộc"
    }

    if (!String(form.code || "").trim()) {
      errors.code = "Mã là bắt buộc"
    }

    const parsedLevel = Number(form.level)
    if (!Number.isInteger(parsedLevel)) {
      errors.level = "Level phải là số nguyên"
    }

    setFormErrors(errors)
    return Object.keys(errors).length === 0
  }

  async function onSave() {
    if (!validateForm()) return

    setSaving(true)
    setError("")

    try {
      const name = String(form.name).trim()
      const code = String(form.code).trim()
      const typedSlug = String(form.slug || "").trim()
      const nextSlug = typedSlug || buildSlug(name, code)

      const payload = {
        name,
        code,
        slug: nextSlug || undefined,
        level: Number(form.level),
        isLeadership: Boolean(form.isLeadership),
        isActive: Boolean(form.isActive),
        description: String(form.description || "").trim() || null,
      }

      const identifier = getEntryIdentifier(editingRow)

      if (identifier) {
        await axios.put(`/positions/${encodeURIComponent(identifier)}`, { data: payload })
      } else {
        await axios.post("/positions", { data: payload })
      }

      setShowModal(false)
      await loadData()
    } catch (saveError) {
      setError(saveError?.response?.data?.error?.message || saveError?.message || "Lưu position thất bại")
    } finally {
      setSaving(false)
    }
  }

  async function onToggleActive(row) {
    const identifier = getEntryIdentifier(row)
    if (!identifier) return

    setTogglingId(row.id || identifier)
    setError("")
    try {
      await axios.put(`/positions/${encodeURIComponent(identifier)}`, {
        data: {
          isActive: !row.isActive,
        },
      })
      await loadData()
    } catch (toggleError) {
      setError(toggleError?.response?.data?.error?.message || toggleError?.message || "Cập nhật trạng thái thất bại")
    } finally {
      setTogglingId(null)
    }
  }

  return (
    <CRow className="justify-content-center">
      <CCol xs={12} style={{ maxWidth: 1300 }}>
        <CCard className="mb-4 ai-card">
          <CCardHeader>
            <strong>Bộ lọc</strong>
          </CCardHeader>
          <CCardBody>
            <CRow className="g-3 ai-form align-items-end">
              <CCol md={8}>
                <CFormLabel>Tìm kiếm</CFormLabel>
                <CFormInput
                  placeholder="Tìm theo name hoặc code"
                  value={searchDraft}
                  onChange={(event) => setSearchDraft(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      setPage(1)
                      setSearch(searchDraft.trim())
                    }
                  }}
                />
              </CCol>
              <CCol md={4} className="d-flex gap-2">
                <CButton
                  color="primary"
                  onClick={() => {
                    setPage(1)
                    setSearch(searchDraft.trim())
                  }}
                  disabled={loading}
                >
                  Tìm kiếm
                </CButton>
                <CButton
                  color="secondary"
                  variant="outline"
                  onClick={() => {
                    setSearchDraft("")
                    setSearch("")
                    setPage(1)
                  }}
                  disabled={loading}
                >
                  Làm mới
                </CButton>
              </CCol>
            </CRow>
          </CCardBody>
        </CCard>

        <CCard className="ai-card">
          <CCardHeader className="d-flex align-items-center justify-content-between gap-2 flex-wrap">
            <div className="d-flex align-items-center gap-2">
              <strong>Positions</strong>
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
                <CTable hover responsive className="mb-3 ai-table">
                  <CTableHead>
                    <CTableRow>
                      <CTableHeaderCell style={{ width: 70 }}>STT</CTableHeaderCell>
                      <CTableHeaderCell>Name</CTableHeaderCell>
                      <CTableHeaderCell style={{ width: 140 }}>Code</CTableHeaderCell>
                      <CTableHeaderCell style={{ width: 180 }}>Slug</CTableHeaderCell>
                      <CTableHeaderCell style={{ width: 100 }}>Level</CTableHeaderCell>
                      <CTableHeaderCell style={{ width: 140 }}>Leadership</CTableHeaderCell>
                      <CTableHeaderCell style={{ width: 120 }}>Active</CTableHeaderCell>
                      <CTableHeaderCell style={{ width: 180 }}>Updated At</CTableHeaderCell>
                      <CTableHeaderCell style={{ width: 220 }}>Actions</CTableHeaderCell>
                    </CTableRow>
                  </CTableHead>

                  <CTableBody>
                    {rows.length === 0 ? (
                      <CTableRow>
                        <CTableDataCell colSpan={9} className="text-center text-body-secondary">
                          Không có dữ liệu
                        </CTableDataCell>
                      </CTableRow>
                    ) : (
                      rows.map((row, index) => (
                        <CTableRow key={row.documentId || row.id}>
                          <CTableDataCell>{(page - 1) * pageSize + index + 1}</CTableDataCell>
                          <CTableDataCell>{row.name || "-"}</CTableDataCell>
                          <CTableDataCell>{row.code || "-"}</CTableDataCell>
                          <CTableDataCell>{row.slug || "-"}</CTableDataCell>
                          <CTableDataCell>{Number.isInteger(row.level) ? row.level : "-"}</CTableDataCell>
                          <CTableDataCell>
                            <CBadge color={row.isLeadership ? "warning" : "secondary"}>
                              {row.isLeadership ? "Leadership" : "Standard"}
                            </CBadge>
                          </CTableDataCell>
                          <CTableDataCell>
                            <CBadge color={row.isActive ? "success" : "dark"}>
                              {row.isActive ? "Active" : "Inactive"}
                            </CBadge>
                          </CTableDataCell>
                          <CTableDataCell>{formatDateTime(row.updatedAt)}</CTableDataCell>
                          <CTableDataCell>
                            <div className="d-flex gap-2">
                              <CButton color="primary" variant="outline" size="sm" onClick={() => openEditModal(row)}>
                                Sửa
                              </CButton>
                              <CButton
                                color={row.isActive ? "dark" : "success"}
                                variant="outline"
                                size="sm"
                                disabled={togglingId === (row.id || row.documentId)}
                                onClick={() => onToggleActive(row)}
                              >
                                {togglingId === (row.id || row.documentId) ? "Đang cập nhật..." : row.isActive ? "Tắt" : "Bật"}
                              </CButton>
                            </div>
                          </CTableDataCell>
                        </CTableRow>
                      ))
                    )}
                  </CTableBody>
                </CTable>

                <div className="d-flex flex-wrap justify-content-between align-items-center gap-2">
                  <div className="d-flex align-items-center gap-2 ai-form">
                    <span>Page size</span>
                    <CFormSelect
                      value={pageSize}
                      onChange={(event) => {
                        const nextSize = Number(event.target.value)
                        if (!Number.isInteger(nextSize) || nextSize <= 0) return
                        setPage(1)
                        setPageSize(nextSize)
                      }}
                      style={{ width: 100 }}
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
                      Trước
                    </CPaginationItem>

                    {pages.map((pageItem) => (
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
                      Sau
                    </CPaginationItem>
                  </CPagination>
                </div>
              </>
            )}
          </CCardBody>
        </CCard>
      </CCol>

      <CModal visible={showModal} onClose={() => !saving && setShowModal(false)} backdrop="static">
        <CModalHeader>
          <CModalTitle>{editingRow ? "Chỉnh sửa Position" : "Thêm mới Position"}</CModalTitle>
        </CModalHeader>
        <CModalBody>
          <CRow className="g-3 ai-form">
            <CCol md={6}>
              <CFormLabel>Name</CFormLabel>
              <CFormInput
                value={form.name}
                onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
                invalid={Boolean(formErrors.name)}
              />
              {formErrors.name ? <div className="text-danger small mt-1">{formErrors.name}</div> : null}
            </CCol>

            <CCol md={6}>
              <CFormLabel>Code</CFormLabel>
              <CFormInput
                value={form.code}
                onChange={(event) => setForm((prev) => ({ ...prev, code: event.target.value }))}
                invalid={Boolean(formErrors.code)}
              />
              {formErrors.code ? <div className="text-danger small mt-1">{formErrors.code}</div> : null}
            </CCol>

            <CCol md={6}>
              <CFormLabel>Slug</CFormLabel>
              <CFormInput
                placeholder="Nhập slug hoặc để trống để tự sinh"
                value={form.slug}
                onChange={(event) => setForm((prev) => ({ ...prev, slug: event.target.value }))}
              />
            </CCol>

            <CCol md={6}>
              <CFormLabel>Level</CFormLabel>
              <CFormInput
                type="number"
                step="1"
                value={form.level}
                onChange={(event) => setForm((prev) => ({ ...prev, level: event.target.value }))}
                invalid={Boolean(formErrors.level)}
              />
              {formErrors.level ? <div className="text-danger small mt-1">{formErrors.level}</div> : null}
            </CCol>

            <CCol md={6}>
              <CFormCheck
                id="position-is-leadership"
                label="Is Leadership"
                checked={Boolean(form.isLeadership)}
                onChange={(event) => setForm((prev) => ({ ...prev, isLeadership: event.target.checked }))}
              />
            </CCol>

            <CCol md={6}>
              <CFormCheck
                id="position-is-active"
                label="Is Active"
                checked={Boolean(form.isActive)}
                onChange={(event) => setForm((prev) => ({ ...prev, isActive: event.target.checked }))}
              />
            </CCol>

            <CCol xs={12}>
              <CFormLabel>Description</CFormLabel>
              <CFormTextarea
                rows={3}
                value={form.description}
                onChange={(event) => setForm((prev) => ({ ...prev, description: event.target.value }))}
              />
            </CCol>
          </CRow>
        </CModalBody>
        <CModalFooter>
          <CButton color="secondary" variant="outline" onClick={() => setShowModal(false)} disabled={saving}>
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
