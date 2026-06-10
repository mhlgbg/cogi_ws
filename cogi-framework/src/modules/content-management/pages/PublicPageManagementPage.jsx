import { useEffect, useMemo, useState } from 'react'
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
  CFormSelect,
  CRow,
  CSpinner,
  CTable,
  CTableBody,
  CTableDataCell,
  CTableHead,
  CTableHeaderCell,
  CTableRow,
} from '@coreui/react'
import { useTenant } from '../../../contexts/TenantContext'
import { buildTenantUrl } from '../../../utils/tenantRouting'
import PublicPageFormModal from '../components/PublicPageFormModal'
import {
  createPublicPage,
  getMediaUrl,
  getPublicPageDetail,
  getPublicPageFormOptions,
  getPublicPages,
  restorePublicPage,
  softDeletePublicPage,
  updatePublicPage,
  uploadPublicPageMedia,
} from '../services/publicPageService'

function getApiMessage(error, fallback) {
  return error?.response?.data?.error?.message || error?.response?.data?.message || error?.message || fallback
}

function statusColor(status) {
  if (status === 'published') return 'success'
  if (status === 'archived') return 'secondary'
  return 'warning'
}

function stripHtml(value) {
  return String(value || '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()
}

export default function PublicPageManagementPage() {
  const tenant = useTenant()
  const [loading, setLoading] = useState(false)
  const [rows, setRows] = useState([])
  const [filters, setFilters] = useState({ q: '', status: '', pageType: '', includeDeleted: false })
  const [success, setSuccess] = useState('')
  const [error, setError] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [formLoading, setFormLoading] = useState(false)
  const [formInitialValues, setFormInitialValues] = useState(null)
  const [formOptions, setFormOptions] = useState({ statuses: [], pageTypes: [], leadFormPositions: [], leadCampaigns: [] })
  const [seoImageState, setSeoImageState] = useState({ current: null, pendingFile: null, changed: false })
  const [actionId, setActionId] = useState('')

  const tenantCode = String(tenant?.currentTenant?.tenantCode || tenant?.resolvedTenant?.tenantCode || '').trim()
  const isMainDomain = Boolean(tenant?.isMainDomain)

  const seoImagePreviewUrl = useMemo(() => {
    if (seoImageState.pendingFile) return ''
    return getMediaUrl(seoImageState.current)
  }, [seoImageState])

  const pendingSeoImageName = useMemo(() => seoImageState.pendingFile?.name || '', [seoImageState.pendingFile])

  async function loadData() {
    setLoading(true)
    setError('')
    try {
      const [pagesPayload, optionsPayload] = await Promise.all([
        getPublicPages({
          q: String(filters.q || '').trim() || undefined,
          status: String(filters.status || '').trim() || undefined,
          pageType: String(filters.pageType || '').trim() || undefined,
          includeDeleted: filters.includeDeleted === true,
        }),
        getPublicPageFormOptions(),
      ])
      setRows(Array.isArray(pagesPayload?.data) ? pagesPayload.data : [])
      setFormOptions(optionsPayload || { statuses: [], pageTypes: [], leadFormPositions: [], leadCampaigns: [] })
    } catch (requestError) {
      setRows([])
      setFormOptions({ statuses: [], pageTypes: [], leadFormPositions: [], leadCampaigns: [] })
      setError(getApiMessage(requestError, 'Không tải được PublicPage'))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  useEffect(() => {
    if (!success) return undefined
    const timer = window.setTimeout(() => setSuccess(''), 2500)
    return () => window.clearTimeout(timer)
  }, [success])

  function openCreateModal() {
    setEditingId(null)
    setFormInitialValues(null)
    setSeoImageState({ current: null, pendingFile: null, changed: false })
    setShowModal(true)
  }

  async function openEditModal(id) {
    setEditingId(id)
    setDetailLoading(true)
    setError('')
    try {
      const detail = await getPublicPageDetail(id)
      setFormInitialValues(detail || null)
      setSeoImageState({ current: detail?.seoImage || null, pendingFile: null, changed: false })
      setShowModal(true)
    } catch (requestError) {
      setError(getApiMessage(requestError, 'Không tải được chi tiết PublicPage'))
    } finally {
      setDetailLoading(false)
    }
  }

  async function handleSubmit(payload) {
    setFormLoading(true)
    setError('')
    setSuccess('')

    try {
      const nextPayload = { ...payload }
      if (seoImageState.pendingFile) {
        const uploaded = await uploadPublicPageMedia([seoImageState.pendingFile])
        nextPayload.seoImage = uploaded[0]?.id || null
      } else if (seoImageState.changed && !seoImageState.current) {
        nextPayload.seoImage = null
      }

      if (editingId) {
        await updatePublicPage(editingId, nextPayload)
        setSuccess('Cập nhật PublicPage thành công')
      } else {
        await createPublicPage(nextPayload)
        setSuccess('Tạo PublicPage thành công')
      }

      setShowModal(false)
      setEditingId(null)
      setFormInitialValues(null)
      setSeoImageState({ current: null, pendingFile: null, changed: false })
      await loadData()
    } catch (requestError) {
      setError(getApiMessage(requestError, 'Không thể lưu PublicPage'))
    } finally {
      setFormLoading(false)
    }
  }

  async function handleSoftDelete(item) {
    if (!item?.id) return
    if (!window.confirm(`Xóa mềm PublicPage ${item.title || item.slug || item.id}?`)) return
    const key = `delete:${item.id}`
    setActionId(key)
    setError('')
    setSuccess('')
    try {
      await softDeletePublicPage(item.id)
      setSuccess('Đã xóa mềm PublicPage')
      await loadData()
    } catch (requestError) {
      setError(getApiMessage(requestError, 'Không thể xóa mềm PublicPage'))
    } finally {
      setActionId('')
    }
  }

  async function handleRestore(item) {
    if (!item?.id) return
    const key = `restore:${item.id}`
    setActionId(key)
    setError('')
    setSuccess('')
    try {
      await restorePublicPage(item.id)
      setSuccess('Đã khôi phục PublicPage')
      await loadData()
    } catch (requestError) {
      setError(getApiMessage(requestError, 'Không thể khôi phục PublicPage'))
    } finally {
      setActionId('')
    }
  }

  function buildPublicPath(slug) {
    return `/page/${encodeURIComponent(String(slug || '').trim())}`
  }

  function buildTenantPublicPath(slug) {
    return buildTenantUrl(`/page/${encodeURIComponent(String(slug || '').trim())}`, { tenantCode, isMainDomain }) || buildPublicPath(slug)
  }

  return (
    <CRow className='g-4'>
      <CCol xs={12}>
        <CCard>
          <CCardHeader className='d-flex justify-content-between align-items-center flex-wrap gap-3'>
            <strong>Public Page Management</strong>
            <div className='d-flex gap-2'>
              <CButton color='secondary' variant='outline' onClick={loadData} disabled={loading}>Tải lại</CButton>
              <CButton color='primary' onClick={openCreateModal}>Thêm PublicPage</CButton>
            </div>
          </CCardHeader>
          <CCardBody>
            <CRow className='g-3 mb-3'>
              <CCol md={5}>
                <CFormInput placeholder='Tìm theo title hoặc slug' value={filters.q} onChange={(event) => setFilters((prev) => ({ ...prev, q: event.target.value }))} />
              </CCol>
              <CCol md={2}>
                <CFormSelect value={filters.status} onChange={(event) => setFilters((prev) => ({ ...prev, status: event.target.value }))}>
                  <option value=''>Tất cả trạng thái</option>
                  {(Array.isArray(formOptions.statuses) ? formOptions.statuses : []).map((item) => <option key={item} value={item}>{item}</option>)}
                </CFormSelect>
              </CCol>
              <CCol md={2}>
                <CFormSelect value={filters.pageType} onChange={(event) => setFilters((prev) => ({ ...prev, pageType: event.target.value }))}>
                  <option value=''>Tất cả page type</option>
                  {(Array.isArray(formOptions.pageTypes) ? formOptions.pageTypes : []).map((item) => <option key={item} value={item}>{item}</option>)}
                </CFormSelect>
              </CCol>
              <CCol md={1} className='d-flex align-items-center'>
                <CFormCheck label='Đã xóa' checked={filters.includeDeleted} onChange={(event) => setFilters((prev) => ({ ...prev, includeDeleted: event.target.checked }))} />
              </CCol>
              <CCol md={2}>
                <CButton color='primary' className='w-100' onClick={loadData} disabled={loading}>Lọc</CButton>
              </CCol>
            </CRow>

            {error ? <CAlert color='danger'>{error}</CAlert> : null}
            {success ? <CAlert color='success'>{success}</CAlert> : null}

            {loading ? (
              <div className='d-flex align-items-center gap-2'>
                <CSpinner size='sm' />
                <span>Đang tải dữ liệu...</span>
              </div>
            ) : (
              <CTable hover responsive align='middle'>
                <CTableHead>
                  <CTableRow>
                    <CTableHeaderCell>Title</CTableHeaderCell>
                    <CTableHeaderCell>Slug</CTableHeaderCell>
                    <CTableHeaderCell>Page type</CTableHeaderCell>
                    <CTableHeaderCell>Status</CTableHeaderCell>
                    <CTableHeaderCell>LeadCampaign</CTableHeaderCell>
                    <CTableHeaderCell>Public URL</CTableHeaderCell>
                    <CTableHeaderCell>Hành động</CTableHeaderCell>
                  </CTableRow>
                </CTableHead>
                <CTableBody>
                  {rows.length > 0 ? rows.map((item) => {
                    const deleteKey = `delete:${item.id}`
                    const restoreKey = `restore:${item.id}`
                    const publicPath = buildPublicPath(item.slug)
                    const tenantPath = buildTenantPublicPath(item.slug)
                    return (
                      <CTableRow key={item.id} style={item?.isDeleted ? { opacity: 0.6 } : undefined}>
                        <CTableDataCell>
                          <div className='fw-semibold'>{item.title || '-'}</div>
                          <div className='small text-body-secondary'>{stripHtml(item.summary) || '-'}</div>
                        </CTableDataCell>
                        <CTableDataCell>{item.slug || '-'}</CTableDataCell>
                        <CTableDataCell>{item.pageType || '-'}</CTableDataCell>
                        <CTableDataCell>
                          <CBadge color={statusColor(item.publicPageStatus)}>{item.publicPageStatus || 'draft'}</CBadge>
                          {item?.isDeleted ? <CBadge color='dark' className='ms-2'>Đã xóa</CBadge> : null}
                        </CTableDataCell>
                        <CTableDataCell>{item.leadCampaign?.name || '-'}</CTableDataCell>
                        <CTableDataCell>
                          <div className='small'><a href={publicPath} target='_blank' rel='noreferrer'>{publicPath}</a></div>
                          <div className='small'><a href={tenantPath} target='_blank' rel='noreferrer'>{tenantPath}</a></div>
                        </CTableDataCell>
                        <CTableDataCell>
                          <div className='d-inline-flex gap-2 flex-wrap'>
                            <CButton size='sm' color='info' variant='outline' onClick={() => openEditModal(item.id)} disabled={detailLoading || formLoading}>Sửa</CButton>
                            {!item?.isDeleted ? (
                              <CButton size='sm' color='danger' variant='outline' onClick={() => handleSoftDelete(item)} disabled={actionId === deleteKey}>{actionId === deleteKey ? 'Đang xử lý...' : 'Xóa mềm'}</CButton>
                            ) : (
                              <CButton size='sm' color='success' variant='outline' onClick={() => handleRestore(item)} disabled={actionId === restoreKey}>{actionId === restoreKey ? 'Đang xử lý...' : 'Khôi phục'}</CButton>
                            )}
                          </div>
                        </CTableDataCell>
                      </CTableRow>
                    )
                  }) : (
                    <CTableRow>
                      <CTableDataCell colSpan={7} className='text-center text-body-secondary'>Chưa có PublicPage nào</CTableDataCell>
                    </CTableRow>
                  )}
                </CTableBody>
              </CTable>
            )}
          </CCardBody>
        </CCard>
      </CCol>

      <PublicPageFormModal
        visible={showModal}
        initialValues={formInitialValues}
        formOptions={formOptions}
        submitting={formLoading}
        seoImagePreviewUrl={seoImagePreviewUrl}
        pendingSeoImageName={pendingSeoImageName}
        onSeoImageChange={(file) => setSeoImageState((prev) => ({ ...prev, pendingFile: file, changed: true }))}
        onSeoImageRemove={() => setSeoImageState({ current: null, pendingFile: null, changed: true })}
        onClose={() => {
          if (formLoading) return
          setShowModal(false)
          setEditingId(null)
          setFormInitialValues(null)
          setSeoImageState({ current: null, pendingFile: null, changed: false })
        }}
        onSubmit={handleSubmit}
      />
    </CRow>
  )
}
