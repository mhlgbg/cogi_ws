import { useEffect, useMemo, useState } from "react"
import {
  CButton,
  CCard,
  CCardBody,
  CCardHeader,
  CCol,
  CFormSelect,
  CFormInput,
  CRow,
  CSpinner,
  CTable,
  CTableBody,
  CTableHead,
  CTableHeaderCell,
  CTableRow,
  CTableDataCell,
  CPagination,
  CPaginationItem,
  CBadge,
  CModal,
  CModalHeader,
  CModalTitle,
  CModalBody,
  CModalFooter,
  CForm,
  CFormLabel,
  CFormCheck,
  CAlert,
} from "@coreui/react"

import {
  getRequestCategories,
  createRequestCategory,
  updateRequestCategory,
  deleteRequestCategory,
} from "../services/requestCategoryService"

export default function RequestCategories() {
  const [loading, setLoading] = useState(false)
  const [rows, setRows] = useState([])
  const [meta, setMeta] = useState(null)

  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)

  const [q, setQ] = useState("")
  const [qDraft, setQDraft] = useState("")

  // Alert state
  const [success, setSuccess] = useState("")
  const [error, setError] = useState("")

  // Modal state
  const [showModal, setShowModal] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [formLoading, setFormLoading] = useState(false)
  const [parentOptions, setParentOptions] = useState([])
  const [formData, setFormData] = useState({
    name: "",
    slug: "",
    description: "",
    isActive: true,
    parent: null,
  })

  const total = meta?.pagination?.total ?? 0
  const pageCount = meta?.pagination?.pageCount ?? 1

  const fromToText = useMemo(() => {
    const p = meta?.pagination
    if (!p || total === 0) return "0"
    const from = (p.page - 1) * p.pageSize + 1
    const to = Math.min(p.page * p.pageSize, total)
    return `${from}–${to}/${total}`
  }, [meta, total])

  async function load() {
    setLoading(true)
    setSuccess("")
    try {
      const res = await getRequestCategories({ page, pageSize, q })
      setRows(res?.data ?? [])
      //console.log("first row:", res?.data?.[0])

      setMeta(res?.meta ?? null)
    } finally {
      setLoading(false)
    }
  }

  // load khi đổi page hoặc q
  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, q])

  // search: gõ xong bấm Enter hoặc click icon
  const applySearch = () => {
    setPage(1)
    setQ(qDraft.trim())
  }

  const onReset = () => {
    setPage(1)
    setQ("")
    setQDraft("")
  }

  const onChangePageSize = (event) => {
    const nextSize = Number(event.target.value)
    if (!Number.isInteger(nextSize) || nextSize <= 0) return
    setPage(1)
    setPageSize(nextSize)
  }

  const onKeyDownSearch = (e) => {
    if (e.key === "Enter") applySearch()
  }

  const openCreateModal = () => {
    setEditingId(null)
    setFormData({
      name: "",
      slug: "",
      description: "",
      isActive: true,
      parent: null,
    })
    setParentOptions(rows)
    setShowModal(true)
  }

  const openEditModal = (item) => {
    const a = item || {}
    setEditingId(item.id)
    setFormData({
      name: a.name ?? "",
      slug: a.slug ?? "",
      description: a.description ?? "",
      isActive: a.isActive ?? true,
      parent: a.parent?.id ?? null,
    })
    setParentOptions(rows.filter((row) => row.id !== item.id))
    setShowModal(true)
  }

  const closeModal = () => {
    setShowModal(false)
    setEditingId(null)
    setFormData({
      name: "",
      slug: "",
      description: "",
      isActive: true,
      parent: null,
    })
  }

  const handleSubmit = async () => {
    if (!formData.name.trim()) {
      setError("Tên loại công việc không được trống")
      setTimeout(() => setError(""), 3000)
      return
    }

    setFormLoading(true)
    try {
      if (editingId) {
        await updateRequestCategory(editingId, formData)
        setSuccess("Cập nhật loại công việc thành công")
      } else {
        await createRequestCategory(formData)
        setSuccess("Thêm mới loại công việc thành công")
      }
      setTimeout(() => setSuccess(""), 3000)
      closeModal()
      load()
    } catch (err) {
      console.error("Error:", err)
      const msg = err?.response?.data?.message || "Có lỗi xảy ra"
      setError(msg)
      setTimeout(() => setError(""), 3000)
    } finally {
      setFormLoading(false)
    }
  }

  const handleDelete = async (id) => {
    if (!window.confirm("Bạn chắc chắn muốn xóa loại công việc này?")) {
      return
    }

    try {
      await deleteRequestCategory(id)
      setSuccess("Xóa loại công việc thành công")
      setTimeout(() => setSuccess(""), 3000)
      load()
    } catch (err) {
      console.error("Error:", err)
      const msg = err?.response?.data?.message || "Có lỗi xảy ra"
      setError(msg)
      setTimeout(() => setError(""), 3000)
    }
  }

  // pagination helper: hiển thị gọn
  const pages = useMemo(() => {
    const maxButtons = 7
    const pagesArr = []
    const current = page
    const totalPages = pageCount

    if (totalPages <= maxButtons) {
      for (let i = 1; i <= totalPages; i++) pagesArr.push(i)
      return pagesArr
    }

    const left = Math.max(1, current - 2)
    const right = Math.min(totalPages, current + 2)

    pagesArr.push(1)
    if (left > 2) pagesArr.push("...")

    for (let i = left; i <= right; i++) {
      if (i !== 1 && i !== totalPages) pagesArr.push(i)
    }

    if (right < totalPages - 1) pagesArr.push("...")
    pagesArr.push(totalPages)

    return pagesArr
  }, [page, pageCount])

  return (
    <CRow className="justify-content-center">
      <CCol xs={12} style={{ maxWidth: 1200 }}>
        <CCard className="mb-4 ai-card">
          <CCardHeader>
            <strong>Bộ lọc</strong>
          </CCardHeader>
          <CCardBody>
            <CRow className="g-3 ai-form align-items-end">
              <CCol md={8} lg={6}>
                <CFormInput
                  label="Từ khóa"
                  placeholder="Tìm theo từ khóa (tên, mã...)"
                  value={qDraft}
                  onChange={(e) => setQDraft(e.target.value)}
                  onKeyDown={onKeyDownSearch}
                />
              </CCol>
              <CCol xs={12} className="d-flex justify-content-end gap-2">
                <CButton color="primary" onClick={applySearch} disabled={loading}>Search</CButton>
                <CButton color="secondary" variant="outline" onClick={onReset} disabled={loading}>Reset</CButton>
              </CCol>
            </CRow>
          </CCardBody>
        </CCard>

        {success ? <CAlert color="success" className="mb-4">{success}</CAlert> : null}
        {error ? <CAlert color="danger" className="mb-4">{error}</CAlert> : null}

        <CCard className="mb-4 ai-card">
          <CCardHeader className="d-flex align-items-center justify-content-between">
            <div>
              <strong>Loại công việc</strong>{" "}
              <CBadge color="secondary" className="ms-2">
                {total}
              </CBadge>
            </div>

            <div className="d-flex align-items-center gap-3">
              <div className="text-body-secondary small">{fromToText}</div>
              <CButton color="success" onClick={openCreateModal} disabled={loading}>
                + Thêm mới
              </CButton>
            </div>
          </CCardHeader>

          <CCardBody>
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
                      <CTableHeaderCell style={{ width: 70 }}>#</CTableHeaderCell>
                      <CTableHeaderCell>Tên loại</CTableHeaderCell>
                      <CTableHeaderCell style={{ width: 160 }}>Slug</CTableHeaderCell>
                      <CTableHeaderCell style={{ width: 160 }}>Nhóm cha</CTableHeaderCell>
                      <CTableHeaderCell style={{ width: 160 }}>Mô tả</CTableHeaderCell>
                      <CTableHeaderCell style={{ width: 140 }}>Trạng thái</CTableHeaderCell>
                      <CTableHeaderCell style={{ width: 220 }}>Cập nhật</CTableHeaderCell>
                      <CTableHeaderCell style={{ width: 180 }}>Hành động</CTableHeaderCell>
                    </CTableRow>
                  </CTableHead>

                  <CTableBody>
                    {rows.length === 0 ? (
                      <CTableRow>
                        <CTableDataCell colSpan={5} className="text-center text-body-secondary">
                          Không có dữ liệu
                        </CTableDataCell>
                      </CTableRow>
                    ) : (
                      rows.map((item, idx) => {
                        // Strapi response: item = { id, attributes: {...} }
                        //const a = item.attributes || {}
                        const a = item || {}

                        const name = a.name ?? "(Chưa có tên)"
                        const slug = a.slug ?? ""
                        const isActive = a.isActive ?? true
                        const description = a.description ?? ""
                        const parentName =
                          a.parent?.name ??
                          a.parent?.data?.attributes?.name ??
                          a.parent?.data?.name ??
                          "Phân loại gốc"
                        const updatedAt = a.updatedAt ? new Date(a.updatedAt).toLocaleString() : ""


                        return (
                          <CTableRow key={item.id}>
                            <CTableDataCell>{(page - 1) * pageSize + idx + 1}</CTableDataCell>
                            <CTableDataCell>{name}</CTableDataCell>
                            <CTableDataCell>{slug}</CTableDataCell>
                            <CTableDataCell>{parentName}</CTableDataCell>
                            <CTableDataCell>{description}</CTableDataCell>
                            <CTableDataCell>
                              <CBadge color={isActive ? "success" : "secondary"} className={`ai-status-badge ${isActive ? "ai-status-done" : "ai-status-cancelled"}`}>
                                {isActive ? "Đang dùng" : "Tạm ngưng"}
                              </CBadge>
                            </CTableDataCell>
                            <CTableDataCell>{updatedAt}</CTableDataCell>
                            <CTableDataCell>
                              <div className="d-flex gap-2">
                                <CButton
                                  size="sm"
                                  color="info"
                                  variant="outline"
                                  onClick={() => openEditModal(item)}
                                  disabled={loading}
                                >
                                  Sửa
                                </CButton>
                                <CButton
                                  size="sm"
                                  color="danger"
                                  variant="outline"
                                  onClick={() => handleDelete(item.id)}
                                  disabled={loading}
                                >
                                  Xóa
                                </CButton>
                              </div>
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
                    <CFormSelect value={pageSize} onChange={onChangePageSize} style={{ width: 100 }}>
                      <option value={10}>10</option>
                      <option value={20}>20</option>
                      <option value={50}>50</option>
                    </CFormSelect>
                  </div>

                  <CPagination align="end" className="mb-0">
                    <CPaginationItem
                      disabled={page <= 1 || loading}
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                    >
                      Trước
                    </CPaginationItem>

                    {pages.map((p, i) =>
                      p === "..." ? (
                        <CPaginationItem key={`dots-${i}`} disabled>
                          …
                        </CPaginationItem>
                      ) : (
                        <CPaginationItem
                          key={p}
                          active={p === page}
                          disabled={loading}
                          onClick={() => setPage(p)}
                        >
                          {p}
                        </CPaginationItem>
                      )
                    )}

                    <CPaginationItem
                      disabled={page >= pageCount || loading}
                      onClick={() => setPage((p) => Math.min(pageCount, p + 1))}
                    >
                      Sau
                    </CPaginationItem>
                  </CPagination>
                </div>
              </>
            )}
          </CCardBody>
        </CCard>

        {/* Modal Thêm/Sửa */}
        <CModal backdrop="static" visible={showModal} onClose={closeModal} size="lg">
          <CModalHeader>
            <CModalTitle>
              {editingId ? "Sửa loại công việc" : "Thêm mới loại công việc"}
            </CModalTitle>
          </CModalHeader>
          <CModalBody>
            <CForm>
              <div className="mb-3">
                <CFormLabel htmlFor="name">Tên loại <span className="text-danger">*</span></CFormLabel>
                <CFormInput
                  id="name"
                  placeholder="Nhập tên loại công việc"
                  value={formData.name}
                  onChange={(e) =>
                    setFormData({ ...formData, name: e.target.value })
                  }
                  disabled={formLoading}
                />
              </div>

              <div className="mb-3">
                <CFormLabel htmlFor="slug">Slug</CFormLabel>
                <CFormInput
                  id="slug"
                  placeholder="Nhập slug (tùy chọn)"
                  value={formData.slug}
                  onChange={(e) =>
                    setFormData({ ...formData, slug: e.target.value })
                  }
                  disabled={formLoading}
                />
              </div>

              <div className="mb-3">
                <CFormLabel htmlFor="description">Mô tả</CFormLabel>
                <CFormInput
                  id="description"
                  placeholder="Nhập mô tả (tùy chọn)"
                  value={formData.description}
                  onChange={(e) =>
                    setFormData({ ...formData, description: e.target.value })
                  }
                  disabled={formLoading}
                />
              </div>

              <div className="mb-3">
                <CFormLabel htmlFor="parent">Phân loại cha</CFormLabel>
                <CFormSelect
                  id="parent"
                  value={formData.parent ?? ""}
                  onChange={(e) => {
                    const value = e.target.value
                    setFormData({
                      ...formData,
                      parent: value ? Number(value) : null,
                    })
                  }}
                  disabled={formLoading}
                >
                  <option value="">Phân loại gốc</option>
                  {parentOptions.map((option) => (
                    <option key={option.id} value={option.id}>
                      {option.name || `#${option.id}`}
                    </option>
                  ))}
                </CFormSelect>
              </div>

              <div className="mb-3">
                <CFormCheck
                  id="isActive"
                  label="Đang dùng"
                  checked={formData.isActive}
                  onChange={(e) =>
                    setFormData({ ...formData, isActive: e.target.checked })
                  }
                  disabled={formLoading}
                />
              </div>
            </CForm>
          </CModalBody>
          <CModalFooter>
            <CButton color="secondary" onClick={closeModal} disabled={formLoading}>
              Hủy
            </CButton>
            <CButton
              color="primary"
              onClick={handleSubmit}
              disabled={formLoading}
            >
              {formLoading ? (
                <>
                  <CSpinner size="sm" className="me-2" />
                  Đang xử lý...
                </>
              ) : (
                editingId ? "Cập nhật" : "Thêm mới"
              )}
            </CButton>
          </CModalFooter>
        </CModal>
      </CCol>
    </CRow>
  )
}

