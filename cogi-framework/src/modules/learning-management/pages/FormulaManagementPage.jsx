import { useEffect, useMemo, useState } from 'react'
import katex from 'katex'
import 'katex/dist/katex.min.css'
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
  CPagination,
  CPaginationItem,
  CRow,
  CSpinner,
  CTable,
  CTableBody,
  CTableDataCell,
  CTableHead,
  CTableHeaderCell,
  CTableRow,
} from '@coreui/react'
import {
  createFormula,
  deleteFormula,
  getFormulas,
  getLearningManagementBootstrap,
  updateFormula,
} from '../services/learningObjectApi'

function getApiMessage(error, fallback) {
  return error?.response?.data?.error?.message || error?.response?.data?.message || error?.message || fallback
}

function buildPages(currentPage, pageCount) {
  const maxButtons = 7
  const pages = []

  if (pageCount <= maxButtons) {
    for (let index = 1; index <= pageCount; index += 1) pages.push(index)
    return pages
  }

  const left = Math.max(1, currentPage - 2)
  const right = Math.min(pageCount, currentPage + 2)

  pages.push(1)
  if (left > 2) pages.push('...')
  for (let index = left; index <= right; index += 1) {
    if (index !== 1 && index !== pageCount) pages.push(index)
  }
  if (right < pageCount - 1) pages.push('...')
  pages.push(pageCount)

  return pages
}

function getEntityId(entity) {
  if (!entity) return ''
  return entity.documentId || entity.id || ''
}

function emptyFormulaForm() {
  return {
    code: '',
    title: '',
    description: '',
    latex: '',
    plainText: '',
    examples: '',
    formulaStatus: 'active',
    subject: '',
    grade: '',
    knowledgeNode: '',
  }
}

function normalizeFormulaForm(formula) {
  return {
    code: formula?.code || '',
    title: formula?.title || '',
    description: formula?.description || '',
    latex: formula?.latex || '',
    plainText: formula?.plainText || '',
    examples: formula?.examples ? JSON.stringify(formula.examples, null, 2) : '',
    formulaStatus: formula?.formulaStatus || formula?.status || 'active',
    subject: getEntityId(formula?.subject),
    grade: getEntityId(formula?.grade),
    knowledgeNode: getEntityId(formula?.knowledgeNode),
  }
}

function parseOptionalJson(rawValue, label) {
  const text = String(rawValue || '').trim()
  if (!text) return null
  try {
    return JSON.parse(text)
  } catch {
    throw new Error(`${label} phải là JSON hợp lệ`)
  }
}

function formatDateTime(value) {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '-'
  return date.toLocaleString()
}

function FormulaPreview({ latex, plainText }) {
  const formulaMarkup = useMemo(() => {
    const source = String(latex || '').trim()
    if (!source) return null

    try {
      return katex.renderToString(source, {
        throwOnError: false,
        displayMode: true,
        strict: 'ignore',
      })
    } catch {
      return null
    }
  }, [latex])

  if (formulaMarkup) {
    return <div className='small overflow-auto' dangerouslySetInnerHTML={{ __html: formulaMarkup }} />
  }

  return <div className='small text-body-secondary'>{plainText || latex || '-'}</div>
}

export default function FormulaManagementPage() {
  const [bootstrapping, setBootstrapping] = useState(true)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [bootstrap, setBootstrap] = useState(null)
  const [rows, setRows] = useState([])
  const [meta, setMeta] = useState(null)
  const [qDraft, setQDraft] = useState('')
  const [q, setQ] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [success, setSuccess] = useState('')
  const [error, setError] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [editingFormula, setEditingFormula] = useState(null)
  const [formulaForm, setFormulaForm] = useState(emptyFormulaForm())

  const subjects = bootstrap?.subjects || []
  const grades = bootstrap?.grades || []
  const knowledgeNodes = bootstrap?.knowledgeNodes || []
  const formulaStatuses = bootstrap?.formulaStatuses || []
  const pageCount = meta?.pagination?.pageCount || 1
  const total = meta?.pagination?.total || 0
  const pages = useMemo(() => buildPages(page, pageCount), [page, pageCount])

  useEffect(() => {
    async function loadBootstrap() {
      setBootstrapping(true)
      try {
        const payload = await getLearningManagementBootstrap()
        setBootstrap(payload)
      } catch (loadError) {
        setError(getApiMessage(loadError, 'Không tải được dữ liệu khởi tạo formulas'))
      } finally {
        setBootstrapping(false)
      }
    }

    loadBootstrap()
  }, [])

  useEffect(() => {
    loadFormulas()
  }, [page, pageSize, q, statusFilter])

  async function loadFormulas() {
    setLoading(true)
    setError('')

    try {
      const payload = await getFormulas({
        page,
        pageSize,
        q,
        formulaStatus: statusFilter || undefined,
      })
      setRows(Array.isArray(payload?.data) ? payload.data : [])
      setMeta(payload?.meta || null)
    } catch (loadError) {
      setRows([])
      setMeta(null)
      setError(getApiMessage(loadError, 'Không tải được danh sách formulas'))
    } finally {
      setLoading(false)
    }
  }

  function resetForm() {
    setFormulaForm(emptyFormulaForm())
    setEditingFormula(null)
  }

  function closeModal() {
    if (saving) return
    setShowModal(false)
    resetForm()
  }

  function openCreateModal() {
    resetForm()
    setShowModal(true)
  }

  function openEditModal(formula) {
    setEditingFormula(formula)
    setFormulaForm(normalizeFormulaForm(formula))
    setShowModal(true)
  }

  function applySearch() {
    setPage(1)
    setQ(String(qDraft || '').trim())
  }

  function resetFilters() {
    setQDraft('')
    setQ('')
    setStatusFilter('')
    setPage(1)
  }

  async function handleSubmit() {
    if (!String(formulaForm.code || '').trim()) {
      setError('Code là bắt buộc')
      return
    }

    if (!String(formulaForm.title || '').trim()) {
      setError('Title là bắt buộc')
      return
    }

    let examples = null
    try {
      examples = parseOptionalJson(formulaForm.examples, 'Examples')
    } catch (parseError) {
      setError(parseError.message)
      return
    }

    const payload = {
      code: formulaForm.code,
      title: formulaForm.title,
      description: formulaForm.description,
      latex: formulaForm.latex,
      plainText: formulaForm.plainText,
      examples,
      formulaStatus: formulaForm.formulaStatus,
      subject: formulaForm.subject || null,
      grade: formulaForm.grade || null,
      knowledgeNode: formulaForm.knowledgeNode || null,
    }

    setSaving(true)
    setError('')
    setSuccess('')

    try {
      if (editingFormula) {
        await updateFormula(getEntityId(editingFormula), payload)
        setSuccess('Cập nhật formula thành công')
      } else {
        await createFormula(payload)
        setSuccess('Tạo formula thành công')
      }
      closeModal()
      await loadFormulas()
    } catch (submitError) {
      setError(getApiMessage(submitError, 'Không thể lưu formula'))
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(formula) {
    if (!window.confirm(`Bạn chắc chắn muốn xóa formula ${formula?.code || ''}?`)) return
    setSaving(true)
    setError('')
    setSuccess('')
    try {
      await deleteFormula(getEntityId(formula))
      setSuccess('Xóa formula thành công')
      await loadFormulas()
    } catch (deleteError) {
      setError(getApiMessage(deleteError, 'Không thể xóa formula'))
    } finally {
      setSaving(false)
    }
  }

  if (bootstrapping) {
    return (
      <div className='py-4 d-flex align-items-center gap-2'>
        <CSpinner size='sm' />
        <span>Đang tải dữ liệu formulas...</span>
      </div>
    )
  }

  return (
    <CRow className='g-0'>
      <CCol xs={12}>
        <CCard className='mb-4 ai-card'>
          <CCardHeader>
            <strong>Bộ lọc</strong>
          </CCardHeader>
          <CCardBody>
            <CRow className='g-3 ai-form align-items-end'>
              <CCol md={8}>
                <CFormInput
                  label='Từ khóa'
                  placeholder='Tìm theo code, title, mô tả...'
                  value={qDraft}
                  onChange={(event) => setQDraft(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') applySearch()
                  }}
                />
              </CCol>
              <CCol md={2}>
                <CFormLabel>Trạng thái</CFormLabel>
                <CFormSelect value={statusFilter} onChange={(event) => { setStatusFilter(event.target.value); setPage(1) }}>
                  <option value=''>Tất cả</option>
                  {formulaStatuses.map((item) => <option key={item} value={item}>{item}</option>)}
                </CFormSelect>
              </CCol>
              <CCol md={2} className='d-flex justify-content-end gap-2'>
                <CButton color='primary' onClick={applySearch} disabled={loading}>Search</CButton>
                <CButton color='secondary' variant='outline' onClick={resetFilters} disabled={loading}>Reset</CButton>
              </CCol>
            </CRow>
          </CCardBody>
        </CCard>

        {success ? <CAlert color='success' className='mb-4'>{success}</CAlert> : null}
        {error ? <CAlert color='danger' className='mb-4'>{error}</CAlert> : null}

        <CCard className='ai-card'>
          <CCardHeader className='d-flex align-items-center justify-content-between gap-2 flex-wrap'>
            <div>
              <strong>Formulas</strong>
              <CBadge color='secondary' className='ms-2'>{total}</CBadge>
            </div>
            <CButton color='success' onClick={openCreateModal} disabled={loading}>+ Thêm mới</CButton>
          </CCardHeader>
          <CCardBody>
            {loading ? (
              <div className='d-flex align-items-center gap-2'>
                <CSpinner size='sm' />
                <span>Đang tải dữ liệu...</span>
              </div>
            ) : (
              <>
                <CTable hover responsive className='mb-3 ai-table'>
                  <CTableHead>
                    <CTableRow>
                      <CTableHeaderCell style={{ width: 70 }}>#</CTableHeaderCell>
                      <CTableHeaderCell style={{ width: 160 }}>Code</CTableHeaderCell>
                      <CTableHeaderCell style={{ minWidth: 260 }}>Title</CTableHeaderCell>
                      <CTableHeaderCell style={{ minWidth: 220 }}>Biểu thức</CTableHeaderCell>
                      <CTableHeaderCell style={{ width: 160 }}>Subject</CTableHeaderCell>
                      <CTableHeaderCell style={{ width: 160 }}>Grade</CTableHeaderCell>
                      <CTableHeaderCell style={{ width: 180 }}>Cập nhật</CTableHeaderCell>
                      <CTableHeaderCell style={{ width: 180 }}>Hành động</CTableHeaderCell>
                    </CTableRow>
                  </CTableHead>
                  <CTableBody>
                    {rows.length === 0 ? (
                      <CTableRow>
                        <CTableDataCell colSpan={8} className='text-center text-body-secondary'>Không có dữ liệu</CTableDataCell>
                      </CTableRow>
                    ) : rows.map((item, index) => (
                      <CTableRow key={getEntityId(item) || `${item?.code || 'formula'}-${index}`}>
                        <CTableDataCell>{(page - 1) * pageSize + index + 1}</CTableDataCell>
                        <CTableDataCell>{item?.code || '-'}</CTableDataCell>
                        <CTableDataCell>
                          <div className='fw-semibold'>{item?.title || '-'}</div>
                          <div className='small text-body-secondary'>{item?.description || '-'}</div>
                        </CTableDataCell>
                        <CTableDataCell>
                          <FormulaPreview latex={item?.latex} plainText={item?.plainText} />
                        </CTableDataCell>
                        <CTableDataCell>{item?.subject?.title || '-'}</CTableDataCell>
                        <CTableDataCell>{item?.grade?.title || '-'}</CTableDataCell>
                        <CTableDataCell>{formatDateTime(item?.updatedAt)}</CTableDataCell>
                        <CTableDataCell>
                          <div className='d-flex gap-2'>
                            <CButton size='sm' color='info' variant='outline' onClick={() => openEditModal(item)}>Sửa</CButton>
                            <CButton size='sm' color='danger' variant='outline' onClick={() => handleDelete(item)}>Xóa</CButton>
                          </div>
                        </CTableDataCell>
                      </CTableRow>
                    ))}
                  </CTableBody>
                </CTable>

                <div className='d-flex flex-wrap justify-content-between align-items-center gap-2'>
                  <div className='small text-body-secondary'>
                    {total > 0 ? `${(page - 1) * pageSize + 1}–${Math.min(page * pageSize, total)}/${total}` : '0'}
                  </div>
                  <div className='d-flex align-items-center gap-2'>
                    <CFormSelect value={pageSize} onChange={(event) => { setPageSize(Number(event.target.value || 10)); setPage(1) }} style={{ width: 100 }}>
                      {[10, 20, 50].map((size) => <option key={size} value={size}>{size}/trang</option>)}
                    </CFormSelect>
                    <CPagination align='end' className='mb-0'>
                      <CPaginationItem disabled={page <= 1 || loading} onClick={() => setPage((prev) => Math.max(1, prev - 1))}>Trước</CPaginationItem>
                      {pages.map((item, index) => item === '...'
                        ? <CPaginationItem key={`ellipsis-${index}`} disabled>…</CPaginationItem>
                        : <CPaginationItem key={item} active={item === page} disabled={loading} onClick={() => setPage(item)}>{item}</CPaginationItem>)}
                      <CPaginationItem disabled={page >= pageCount || loading} onClick={() => setPage((prev) => Math.min(pageCount, prev + 1))}>Sau</CPaginationItem>
                    </CPagination>
                  </div>
                </div>
              </>
            )}
          </CCardBody>
        </CCard>

        <CModal visible={showModal} backdrop='static' size='xl' onClose={closeModal}>
          <CModalHeader>
            <CModalTitle>{editingFormula ? 'Sửa formula' : 'Thêm formula'}</CModalTitle>
          </CModalHeader>
          <CModalBody>
            <CRow className='g-3'>
              <CCol md={4}><CFormLabel>Code</CFormLabel><CFormInput value={formulaForm.code} onChange={(event) => setFormulaForm((prev) => ({ ...prev, code: event.target.value }))} disabled={saving} /></CCol>
              <CCol md={8}><CFormLabel>Title</CFormLabel><CFormInput value={formulaForm.title} onChange={(event) => setFormulaForm((prev) => ({ ...prev, title: event.target.value }))} disabled={saving} /></CCol>
              <CCol xs={12}><CFormLabel>Description</CFormLabel><CFormTextarea rows={3} value={formulaForm.description} onChange={(event) => setFormulaForm((prev) => ({ ...prev, description: event.target.value }))} disabled={saving} /></CCol>
              <CCol md={6}><CFormLabel>Latex</CFormLabel><CFormTextarea rows={3} value={formulaForm.latex} onChange={(event) => setFormulaForm((prev) => ({ ...prev, latex: event.target.value }))} disabled={saving} /></CCol>
              <CCol md={6}><CFormLabel>Plain Text</CFormLabel><CFormTextarea rows={3} value={formulaForm.plainText} onChange={(event) => setFormulaForm((prev) => ({ ...prev, plainText: event.target.value }))} disabled={saving} /></CCol>
              <CCol xs={12}><CFormLabel>Examples (JSON)</CFormLabel><CFormTextarea rows={4} value={formulaForm.examples} onChange={(event) => setFormulaForm((prev) => ({ ...prev, examples: event.target.value }))} disabled={saving} /></CCol>
              <CCol md={4}><CFormLabel>Subject</CFormLabel><CFormSelect value={formulaForm.subject} onChange={(event) => setFormulaForm((prev) => ({ ...prev, subject: event.target.value }))} disabled={saving}><option value=''>Chọn</option>{subjects.map((item) => <option key={getEntityId(item)} value={getEntityId(item)}>{item.title || item.code}</option>)}</CFormSelect></CCol>
              <CCol md={4}><CFormLabel>Grade</CFormLabel><CFormSelect value={formulaForm.grade} onChange={(event) => setFormulaForm((prev) => ({ ...prev, grade: event.target.value }))} disabled={saving}><option value=''>Chọn</option>{grades.map((item) => <option key={getEntityId(item)} value={getEntityId(item)}>{item.title || item.code}</option>)}</CFormSelect></CCol>
              <CCol md={4}><CFormLabel>Knowledge Node</CFormLabel><CFormSelect value={formulaForm.knowledgeNode} onChange={(event) => setFormulaForm((prev) => ({ ...prev, knowledgeNode: event.target.value }))} disabled={saving}><option value=''>Chọn</option>{knowledgeNodes.map((item) => <option key={getEntityId(item)} value={getEntityId(item)}>{item.title || item.code}</option>)}</CFormSelect></CCol>
              <CCol md={4}><CFormLabel>Formula Status</CFormLabel><CFormSelect value={formulaForm.formulaStatus} onChange={(event) => setFormulaForm((prev) => ({ ...prev, formulaStatus: event.target.value }))} disabled={saving}>{formulaStatuses.map((item) => <option key={item} value={item}>{item}</option>)}</CFormSelect></CCol>
            </CRow>
          </CModalBody>
          <CModalFooter>
            <CButton color='secondary' variant='outline' onClick={closeModal} disabled={saving}>Hủy</CButton>
            <CButton color='primary' onClick={handleSubmit} disabled={saving}>{saving ? 'Đang lưu...' : 'Lưu'}</CButton>
          </CModalFooter>
        </CModal>
      </CCol>
    </CRow>
  )
}