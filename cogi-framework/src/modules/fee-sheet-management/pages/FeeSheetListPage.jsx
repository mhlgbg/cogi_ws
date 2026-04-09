import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  CAlert,
  CBadge,
  CButton,
  CCard,
  CCardBody,
  CCardHeader,
  CCol,
  CForm,
  CFormCheck,
  CFormInput,
  CFormLabel,
  CFormSelect,
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
  createFeeSheet,
  generateFeeSheet,
  getFeeSheetFormOptions,
  getFeeSheetPage,
  updateFeeSheet,
} from '../services/feeSheetService'

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

function emptyCreateForm() {
  return {
    name: '',
    fromDate: '',
    toDate: '',
  }
}

function emptyGenerateForm() {
  return {
    classIds: [],
    regenerate: false,
    unitPrice: '',
  }
}

function formatDate(value) {
  return value || '-'
}

function formatStatus(status) {
  const normalized = String(status || '').toLowerCase()
  if (normalized === 'open') return { color: 'info', label: 'Open' }
  if (normalized === 'closed') return { color: 'secondary', label: 'Closed' }
  if (normalized === 'approved') return { color: 'success', label: 'Approved' }
  return { color: 'warning', label: 'Draft' }
}

export default function FeeSheetListPage() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(false)
  const [rows, setRows] = useState([])
  const [pagination, setPagination] = useState(null)
  const [classes, setClasses] = useState([])
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [q, setQ] = useState('')
  const [qDraft, setQDraft] = useState('')
  const [success, setSuccess] = useState('')
  const [error, setError] = useState('')
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showGenerateModal, setShowGenerateModal] = useState(false)
  const [formLoading, setFormLoading] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [selectedFeeSheet, setSelectedFeeSheet] = useState(null)
  const [createForm, setCreateForm] = useState(emptyCreateForm())
  const [generateForm, setGenerateForm] = useState(emptyGenerateForm())

  const total = pagination?.total ?? 0
  const pageCount = pagination?.pageCount ?? 1
  const pages = useMemo(() => buildPages(page, pageCount), [page, pageCount])

  const fromToText = useMemo(() => {
    if (!pagination || total === 0) return '0'
    const from = (pagination.page - 1) * pagination.pageSize + 1
    const to = Math.min(pagination.page * pagination.pageSize, total)
    return `${from}–${to}/${total}`
  }, [pagination, total])

  async function loadOptions() {
    try {
      const result = await getFeeSheetFormOptions()
      setClasses(Array.isArray(result?.classes) ? result.classes : [])
    } catch {
      setClasses([])
    }
  }

  async function load() {
    setLoading(true)
    setError('')
    try {
      const result = await getFeeSheetPage({ page, pageSize, q })
      setRows(Array.isArray(result?.rows) ? result.rows : [])
      setPagination(result?.pagination ?? null)
    } catch (loadError) {
      setRows([])
      setPagination(null)
      setError(getApiMessage(loadError, 'Không tải được danh sách fee sheet'))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadOptions()
  }, [])

  useEffect(() => {
    load()
  }, [page, pageSize, q])

  function applySearch() {
    setPage(1)
    setQ(qDraft.trim())
  }

  function onReset() {
    setPage(1)
    setQ('')
    setQDraft('')
  }

  function closeCreateModal() {
    setShowCreateModal(false)
    setCreateForm(emptyCreateForm())
  }

  function openGenerateModal(item) {
    setSelectedFeeSheet(item)
    setGenerateForm(emptyGenerateForm())
    setShowGenerateModal(true)
  }

  function closeGenerateModal() {
    setSelectedFeeSheet(null)
    setGenerateForm(emptyGenerateForm())
    setShowGenerateModal(false)
  }

  async function handleCreate() {
    if (!String(createForm.name).trim()) {
      setError('Tên fee sheet không được trống')
      return
    }
    if (!String(createForm.fromDate).trim()) {
      setError('Bạn cần chọn from date')
      return
    }
    if (!String(createForm.toDate).trim()) {
      setError('Bạn cần chọn to date')
      return
    }

    setFormLoading(true)
    setError('')
    try {
      await createFeeSheet({
        name: String(createForm.name).trim(),
        fromDate: createForm.fromDate,
        toDate: createForm.toDate,
      })
      setSuccess('Tạo fee sheet thành công')
      closeCreateModal()
      await load()
    } catch (submitError) {
      setError(getApiMessage(submitError, 'Không thể tạo fee sheet'))
    } finally {
      setFormLoading(false)
    }
  }

  async function handleApprove(item) {
    if (!window.confirm('Bạn chắc chắn muốn approve fee sheet này?')) return

    setError('')
    try {
      await updateFeeSheet(item.id, { status: 'approved' })
      setSuccess('Approve fee sheet thành công')
      await load()
    } catch (requestError) {
      setError(getApiMessage(requestError, 'Không thể approve fee sheet'))
    }
  }

  async function handleGenerate() {
    if (!selectedFeeSheet?.id) return
    if (!Array.isArray(generateForm.classIds) || generateForm.classIds.length === 0) {
      setError('Bạn cần chọn ít nhất một lớp')
      return
    }
    if (String(generateForm.unitPrice).trim() === '') {
      setError('Bạn cần nhập đơn giá mặc định')
      return
    }

    const unitPrice = Number(generateForm.unitPrice)
    if (!Number.isFinite(unitPrice) || unitPrice < 0) {
      setError('Đơn giá mặc định phải là số không âm')
      return
    }

    setGenerating(true)
    setError('')
    try {
      await generateFeeSheet(selectedFeeSheet.id, {
        classIds: generateForm.classIds.map((item) => Number(item)),
        regenerate: Boolean(generateForm.regenerate),
        unitPrice,
      })
      setSuccess('Generate fee sheet thành công')
      closeGenerateModal()
      await load()
    } catch (requestError) {
      setError(getApiMessage(requestError, 'Không thể generate fee sheet'))
    } finally {
      setGenerating(false)
    }
  }

  return (
    <CRow className='g-0'>
      <CCol xs={12}>
        <CCard className='mb-4'>
          <CCardHeader>
            <strong>Bộ lọc</strong>
          </CCardHeader>
          <CCardBody>
            <CRow className='g-3 align-items-end'>
              <CCol md={10}>
                <CFormInput
                  label='Từ khóa'
                  placeholder='Tìm theo tên fee sheet...'
                  value={qDraft}
                  onChange={(event) => setQDraft(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') applySearch()
                  }}
                />
              </CCol>
              <CCol md={2} className='d-flex justify-content-end gap-2'>
                <CButton color='primary' onClick={applySearch} disabled={loading}>Search</CButton>
                <CButton color='secondary' variant='outline' onClick={onReset} disabled={loading}>Reset</CButton>
              </CCol>
            </CRow>
          </CCardBody>
        </CCard>

        {success ? <CAlert color='success' className='mb-4'>{success}</CAlert> : null}
        {error ? <CAlert color='danger' className='mb-4'>{error}</CAlert> : null}

        <CCard>
          <CCardHeader className='d-flex align-items-center justify-content-between gap-2 flex-wrap'>
            <div>
              <strong>Fee Sheets</strong>
              <CBadge color='secondary' className='ms-2'>{total}</CBadge>
            </div>
            <div className='d-flex align-items-center gap-3'>
              <div className='text-body-secondary small'>{fromToText}</div>
              <CButton color='success' onClick={() => setShowCreateModal(true)} disabled={loading}>Create FeeSheet</CButton>
            </div>
          </CCardHeader>
          <CCardBody>
            {loading ? (
              <div className='d-flex align-items-center gap-2'>
                <CSpinner size='sm' />
                <span>Đang tải dữ liệu...</span>
              </div>
            ) : (
              <>
                <CTable hover responsive className='mb-3'>
                  <CTableHead>
                    <CTableRow>
                      <CTableHeaderCell style={{ width: 70 }}>#</CTableHeaderCell>
                      <CTableHeaderCell style={{ minWidth: 220 }}>Name</CTableHeaderCell>
                      <CTableHeaderCell style={{ width: 140 }}>From Date</CTableHeaderCell>
                      <CTableHeaderCell style={{ width: 140 }}>To Date</CTableHeaderCell>
                      <CTableHeaderCell style={{ width: 140 }}>Status</CTableHeaderCell>
                      <CTableHeaderCell style={{ width: 280 }}>Actions</CTableHeaderCell>
                    </CTableRow>
                  </CTableHead>
                  <CTableBody>
                    {rows.length === 0 ? (
                      <CTableRow>
                        <CTableDataCell colSpan={6} className='text-center text-body-secondary'>Không có dữ liệu</CTableDataCell>
                      </CTableRow>
                    ) : rows.map((item, index) => {
                      const status = formatStatus(item.status)
                      const hasFeeSheetClasses = Array.isArray(item.feeSheetClasses) && item.feeSheetClasses.length > 0

                      return (
                        <CTableRow key={item.id}>
                          <CTableDataCell>{(page - 1) * pageSize + index + 1}</CTableDataCell>
                          <CTableDataCell>{item.name || '-'}</CTableDataCell>
                          <CTableDataCell>{formatDate(item.fromDate)}</CTableDataCell>
                          <CTableDataCell>{formatDate(item.toDate)}</CTableDataCell>
                          <CTableDataCell>
                            <CBadge color={status.color}>{status.label}</CBadge>
                          </CTableDataCell>
                          <CTableDataCell>
                            <div className='d-flex gap-2 flex-wrap'>
                              <CButton size='sm' color='primary' variant='outline' onClick={() => navigate(`/fee-sheets/${item.id}`)}>View</CButton>
                              <CButton size='sm' color='info' variant='outline' disabled={item.status === 'approved'} onClick={() => openGenerateModal(item)}>Generate</CButton>
                              <CButton size='sm' color='success' variant='outline' disabled={!hasFeeSheetClasses || item.status === 'approved'} onClick={() => handleApprove(item)}>Approve</CButton>
                            </div>
                          </CTableDataCell>
                        </CTableRow>
                      )
                    })}
                  </CTableBody>
                </CTable>

                <div className='d-flex flex-wrap justify-content-between align-items-center gap-2'>
                  <div className='d-flex align-items-center gap-2'>
                    <span>Page size</span>
                    <CFormSelect value={pageSize} onChange={(event) => { setPage(1); setPageSize(Number(event.target.value) || 10) }} style={{ width: 100 }}>
                      <option value={10}>10</option>
                      <option value={20}>20</option>
                      <option value={50}>50</option>
                    </CFormSelect>
                  </div>

                  <CPagination align='end' className='mb-0'>
                    <CPaginationItem disabled={page <= 1 || loading} onClick={() => setPage((prev) => Math.max(1, prev - 1))}>Trước</CPaginationItem>
                    {pages.map((item, index) => item === '...'
                      ? <CPaginationItem key={`dots-${index}`} disabled>…</CPaginationItem>
                      : <CPaginationItem key={item} active={item === page} disabled={loading} onClick={() => setPage(item)}>{item}</CPaginationItem>)}
                    <CPaginationItem disabled={page >= pageCount || loading} onClick={() => setPage((prev) => Math.min(pageCount, prev + 1))}>Sau</CPaginationItem>
                  </CPagination>
                </div>
              </>
            )}
          </CCardBody>
        </CCard>

        <CModal backdrop='static' visible={showCreateModal} onClose={closeCreateModal}>
          <CModalHeader>
            <CModalTitle>Create FeeSheet</CModalTitle>
          </CModalHeader>
          <CModalBody>
            <CForm>
              <CRow className='g-3'>
                <CCol md={12}>
                  <CFormLabel>Name</CFormLabel>
                  <CFormInput value={createForm.name} onChange={(event) => setCreateForm((prev) => ({ ...prev, name: event.target.value }))} disabled={formLoading} />
                </CCol>
                <CCol md={6}>
                  <CFormLabel>From Date</CFormLabel>
                  <CFormInput type='date' value={createForm.fromDate} onChange={(event) => setCreateForm((prev) => ({ ...prev, fromDate: event.target.value }))} disabled={formLoading} />
                </CCol>
                <CCol md={6}>
                  <CFormLabel>To Date</CFormLabel>
                  <CFormInput type='date' value={createForm.toDate} onChange={(event) => setCreateForm((prev) => ({ ...prev, toDate: event.target.value }))} disabled={formLoading} />
                </CCol>
              </CRow>
            </CForm>
          </CModalBody>
          <CModalFooter>
            <CButton color='secondary' variant='outline' onClick={closeCreateModal}>Hủy</CButton>
            <CButton color='primary' onClick={handleCreate} disabled={formLoading}>{formLoading ? 'Đang lưu...' : 'Lưu'}</CButton>
          </CModalFooter>
        </CModal>

        <CModal backdrop='static' visible={showGenerateModal} onClose={closeGenerateModal}>
          <CModalHeader>
            <CModalTitle>Generate / Regenerate FeeSheet</CModalTitle>
          </CModalHeader>
          <CModalBody>
            <CForm>
              <CRow className='g-3'>
                <CCol md={12}>
                  <CFormLabel>Classes</CFormLabel>
                  <CFormSelect
                    multiple
                    value={generateForm.classIds}
                    onChange={(event) => {
                      const values = Array.from(event.target.selectedOptions).map((option) => option.value)
                      setGenerateForm((prev) => ({ ...prev, classIds: values }))
                    }}
                  >
                    {classes.map((item) => (
                      <option key={item.id} value={item.id}>{item.label}</option>
                    ))}
                  </CFormSelect>
                </CCol>
                <CCol md={12}>
                  <CFormLabel>Đơn giá mặc định</CFormLabel>
                  <CFormInput
                    type='number'
                    min={0}
                    step='any'
                    placeholder='Nhập đơn giá áp cho toàn bộ fee item được sinh'
                    value={generateForm.unitPrice}
                    onChange={(event) => setGenerateForm((prev) => ({ ...prev, unitPrice: event.target.value }))}
                  />
                </CCol>
                <CCol md={12}>
                  <CFormCheck
                    id='fee-sheet-regenerate'
                    label='Regenerate các item đã có và áp lại đơn giá này'
                    checked={generateForm.regenerate}
                    onChange={(event) => setGenerateForm((prev) => ({ ...prev, regenerate: event.target.checked }))}
                  />
                </CCol>
              </CRow>
            </CForm>
          </CModalBody>
          <CModalFooter>
            <CButton color='secondary' variant='outline' onClick={closeGenerateModal} disabled={generating}>Hủy</CButton>
            <CButton color='primary' onClick={handleGenerate} disabled={generating}>{generating ? 'Đang generate...' : 'Generate'}</CButton>
          </CModalFooter>
        </CModal>
      </CCol>
    </CRow>
  )
}