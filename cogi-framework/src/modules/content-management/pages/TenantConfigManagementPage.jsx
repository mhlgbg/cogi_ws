import { useEffect, useMemo, useState } from 'react'
import {
  CAlert,
  CButton,
  CCard,
  CCardBody,
  CCardHeader,
  CCol,
  CForm,
  CFormInput,
  CFormLabel,
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
  createTenantConfig,
  deleteTenantConfig,
  getTenantConfigs,
  updateTenantConfig,
} from '../services/tenantConfigService'

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

function formatJsonEditor(value) {
  if (value === undefined || value === null || value === '') return '{\n  \n}'

  try {
    return JSON.stringify(value, null, 2)
  } catch {
    return String(value)
  }
}

function formatJsonPreview(value) {
  const formatted = formatJsonEditor(value).replace(/\s+/g, ' ').trim()
  if (formatted.length <= 120) return formatted
  return `${formatted.slice(0, 117)}...`
}

export default function TenantConfigManagementPage() {
  const [loading, setLoading] = useState(false)
  const [rows, setRows] = useState([])
  const [meta, setMeta] = useState(null)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [q, setQ] = useState('')
  const [qDraft, setQDraft] = useState('')
  const [success, setSuccess] = useState('')
  const [error, setError] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [formLoading, setFormLoading] = useState(false)
  const [formData, setFormData] = useState({
    key: '',
    description: '',
    jsonContentText: '{\n  \n}',
  })

  const total = meta?.pagination?.total ?? 0
  const pageCount = meta?.pagination?.pageCount ?? 1
  const pages = useMemo(() => buildPages(page, pageCount), [page, pageCount])

  const fromToText = useMemo(() => {
    const pagination = meta?.pagination
    if (!pagination || total === 0) return '0'
    const from = (pagination.page - 1) * pagination.pageSize + 1
    const to = Math.min(pagination.page * pagination.pageSize, total)
    return `${from}–${to}/${total}`
  }, [meta, total])

  async function load() {
    setLoading(true)
    setSuccess('')
    setError('')

    try {
      const res = await getTenantConfigs({ page, pageSize, q })
      setRows(res?.data || [])
      setMeta(res?.meta || null)
    } catch (loadError) {
      setRows([])
      setMeta(null)
      setError(getApiMessage(loadError, 'Không tải được danh sách tenant config'))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [page, pageSize, q])

  function resetForm() {
    setFormData({
      key: '',
      description: '',
      jsonContentText: '{\n  \n}',
    })
  }

  function openCreateModal() {
    setEditingId(null)
    resetForm()
    setShowModal(true)
  }

  function openEditModal(item) {
    setEditingId(item.id)
    setFormData({
      key: item.key || '',
      description: item.description || '',
      jsonContentText: formatJsonEditor(item.jsonContent),
    })
    setShowModal(true)
  }

  function closeModal() {
    setShowModal(false)
    setEditingId(null)
    resetForm()
  }

  function applySearch() {
    setPage(1)
    setQ(qDraft.trim())
  }

  function onReset() {
    setPage(1)
    setQ('')
    setQDraft('')
  }

  async function handleSubmit() {
    const nextKey = String(formData.key || '').trim()
    const nextDescription = String(formData.description || '').trim()
    const rawJson = String(formData.jsonContentText || '').trim()

    if (!nextKey) {
      setError('Key không được trống')
      return
    }

    if (!rawJson) {
      setError('JSON content không được trống')
      return
    }

    let parsedJson
    try {
      parsedJson = JSON.parse(rawJson)
    } catch {
      setError('JSON content không hợp lệ')
      return
    }

    setFormLoading(true)
    setError('')

    try {
      const payload = {
        key: nextKey,
        description: nextDescription || null,
        jsonContent: parsedJson,
      }

      if (editingId) {
        await updateTenantConfig(editingId, payload)
        setSuccess('Cập nhật tenant config thành công')
      } else {
        await createTenantConfig(payload)
        setSuccess('Thêm mới tenant config thành công')
      }

      closeModal()
      await load()
    } catch (submitError) {
      setError(getApiMessage(submitError, 'Không thể lưu tenant config'))
    } finally {
      setFormLoading(false)
    }
  }

  async function handleDelete(id) {
    if (!window.confirm('Bạn chắc chắn muốn xóa tenant config này?')) return

    setSuccess('')
    setError('')

    try {
      await deleteTenantConfig(id)
      setSuccess('Xóa tenant config thành công')
      await load()
    } catch (deleteError) {
      setError(getApiMessage(deleteError, 'Không thể xóa tenant config'))
    }
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
              <CCol md={8} lg={6}>
                <CFormInput
                  label='Từ khóa'
                  placeholder='Tìm theo key hoặc mô tả...'
                  value={qDraft}
                  onChange={(event) => setQDraft(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') applySearch()
                  }}
                />
              </CCol>
              <CCol xs={12} className='d-flex justify-content-end gap-2'>
                <CButton color='primary' onClick={applySearch} disabled={loading}>Search</CButton>
                <CButton color='secondary' variant='outline' onClick={onReset} disabled={loading}>Reset</CButton>
              </CCol>
            </CRow>
          </CCardBody>
        </CCard>

        {success ? <CAlert color='success' className='mb-4'>{success}</CAlert> : null}
        {error ? <CAlert color='danger' className='mb-4'>{error}</CAlert> : null}

        <CCard className='ai-card'>
          <CCardHeader className='d-flex align-items-center justify-content-between gap-2 flex-wrap'>
            <div>
              <strong>Tenant Configs</strong>
            </div>
            <div className='d-flex align-items-center gap-3'>
              <div className='text-body-secondary small'>{fromToText}</div>
              <CButton color='success' onClick={openCreateModal} disabled={loading}>+ Thêm mới</CButton>
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
                <CTable hover responsive className='mb-3 ai-table'>
                  <CTableHead>
                    <CTableRow>
                      <CTableHeaderCell style={{ width: 70 }}>#</CTableHeaderCell>
                      <CTableHeaderCell style={{ width: 240 }}>Key</CTableHeaderCell>
                      <CTableHeaderCell>JSON content</CTableHeaderCell>
                      <CTableHeaderCell>Mô tả</CTableHeaderCell>
                      <CTableHeaderCell style={{ width: 220 }}>Cập nhật</CTableHeaderCell>
                      <CTableHeaderCell style={{ width: 180 }}>Hành động</CTableHeaderCell>
                    </CTableRow>
                  </CTableHead>
                  <CTableBody>
                    {rows.length === 0 ? (
                      <CTableRow>
                        <CTableDataCell colSpan={6} className='text-center text-body-secondary'>Không có dữ liệu</CTableDataCell>
                      </CTableRow>
                    ) : rows.map((item, index) => (
                      <CTableRow key={item.id}>
                        <CTableDataCell>{(page - 1) * pageSize + index + 1}</CTableDataCell>
                        <CTableDataCell>{item.key || '-'}</CTableDataCell>
                        <CTableDataCell className='text-body-secondary'>{formatJsonPreview(item.jsonContent)}</CTableDataCell>
                        <CTableDataCell>{item.description || '-'}</CTableDataCell>
                        <CTableDataCell>{item.updatedAt ? new Date(item.updatedAt).toLocaleString() : '-'}</CTableDataCell>
                        <CTableDataCell>
                          <div className='d-flex gap-2'>
                            <CButton size='sm' color='info' variant='outline' onClick={() => openEditModal(item)}>Sửa</CButton>
                            <CButton size='sm' color='danger' variant='outline' onClick={() => handleDelete(item.id)}>Xóa</CButton>
                          </div>
                        </CTableDataCell>
                      </CTableRow>
                    ))}
                  </CTableBody>
                </CTable>

                <div className='d-flex flex-wrap justify-content-between align-items-center gap-2'>
                  <div className='d-flex align-items-center gap-2 ai-form'>
                    <span>Page size</span>
                    <CFormInput
                      type='number'
                      min='1'
                      step='1'
                      value={pageSize}
                      onChange={(event) => {
                        const nextValue = Number(event.target.value)
                        setPage(1)
                        setPageSize(Number.isInteger(nextValue) && nextValue > 0 ? nextValue : 10)
                      }}
                      style={{ width: 100 }}
                    />
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

        <CModal backdrop='static' visible={showModal} onClose={closeModal} size='xl'>
          <CModalHeader>
            <CModalTitle>{editingId ? 'Sửa tenant config' : 'Thêm mới tenant config'}</CModalTitle>
          </CModalHeader>
          <CModalBody>
            <CForm>
              <CRow className='g-3'>
                <CCol md={6}>
                  <CFormLabel htmlFor='tenant-config-key'>Key <span className='text-danger'>*</span></CFormLabel>
                  <CFormInput
                    id='tenant-config-key'
                    value={formData.key}
                    onChange={(event) => setFormData((prev) => ({ ...prev, key: event.target.value }))}
                    placeholder='Ví dụ: homepage.hero'
                    disabled={formLoading}
                  />
                </CCol>
                <CCol md={6}>
                  <CFormLabel htmlFor='tenant-config-description'>Mô tả</CFormLabel>
                  <CFormInput
                    id='tenant-config-description'
                    value={formData.description}
                    onChange={(event) => setFormData((prev) => ({ ...prev, description: event.target.value }))}
                    placeholder='Mô tả ngắn về config này'
                    disabled={formLoading}
                  />
                </CCol>
                <CCol xs={12}>
                  <CFormLabel htmlFor='tenant-config-json'>JSON content <span className='text-danger'>*</span></CFormLabel>
                  <CFormTextarea
                    id='tenant-config-json'
                    rows={18}
                    value={formData.jsonContentText}
                    onChange={(event) => setFormData((prev) => ({ ...prev, jsonContentText: event.target.value }))}
                    placeholder='Nhập JSON hợp lệ'
                    disabled={formLoading}
                    spellCheck={false}
                    style={{ fontFamily: 'monospace' }}
                  />
                </CCol>
              </CRow>
            </CForm>
          </CModalBody>
          <CModalFooter>
            <CButton color='secondary' onClick={closeModal} disabled={formLoading}>Hủy</CButton>
            <CButton color='primary' onClick={handleSubmit} disabled={formLoading}>
              {formLoading ? <><CSpinner size='sm' className='me-2' />Đang xử lý...</> : (editingId ? 'Cập nhật' : 'Thêm mới')}
            </CButton>
          </CModalFooter>
        </CModal>
      </CCol>
    </CRow>
  )
}