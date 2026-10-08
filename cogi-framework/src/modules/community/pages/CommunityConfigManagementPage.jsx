import { useCallback, useEffect, useMemo, useState } from 'react'
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
} from '@coreui/react'
import { useTenant } from '../../../contexts/TenantContext'
import { buildTenantUrl } from '../../../utils/tenantRouting'
import {
  activateCommunityConfig,
  archiveCommunityConfig,
  cloneCommunityConfig,
  createCommunityConfig,
  getCommunityConfigDetail,
  getCommunityConfigFormOptions,
  getCommunityConfigs,
  updateCommunityConfig,
} from '../services/communityConfigService'

function getApiMessage(error, fallback) {
  return error?.response?.data?.error?.message || error?.response?.data?.message || error?.message || fallback
}

function toJsonEditorText(value, fallback) {
  try {
    return JSON.stringify(value, null, 2)
  } catch {
    return JSON.stringify(fallback, null, 2)
  }
}

function formatDateTime(value) {
  if (!value) return '—'
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return '—'
  return parsed.toLocaleString()
}

function statusColor(status) {
  if (status === 'active') return 'success'
  if (status === 'archived') return 'secondary'
  return 'warning'
}

const DEFAULT_FORM_OPTIONS = {
  statuses: ['draft', 'active', 'archived'],
}

const DEFAULT_HEADER_CONFIG = {
  communityName: '',
  slogan: '',
  showSearch: true,
  showNotification: true,
  showUserMenu: true,
}

const DEFAULT_SIDEBAR_CONFIG = {
  items: [
    { id: 'home', label: 'Home', type: 'home', order: 0, enabled: true, visibility: 'public' },
    { id: 'community-feed', label: 'Community Feed', type: 'community-feed', order: 1, enabled: true, visibility: 'public' },
    { id: 'my-posts', label: 'Bài viết của tôi', type: 'my-posts', order: 2, enabled: true, visibility: 'authenticated' },
    { id: 'admin', label: 'Quản trị Community', type: 'admin', order: 99, enabled: true, visibility: 'admin' },
  ],
}

const DEFAULT_FEED_CONFIG = {
  defaultFeed: 'mixed',
  showFeatured: true,
  showPinned: true,
  infiniteScroll: true,
  pageSize: 20,
}

const DEFAULT_POLICY_CONFIG = {
  allowMemberPost: true,
  memberPostRequiresApproval: true,
  allowReaction: true,
  defaultAllowComment: true,
}

function createInitialFormState() {
  return {
    name: '',
    description: '',
    status: 'draft',
    effectiveFrom: '',
    effectiveTo: '',
    headerConfigText: toJsonEditorText(DEFAULT_HEADER_CONFIG, DEFAULT_HEADER_CONFIG),
    sidebarConfigText: toJsonEditorText(DEFAULT_SIDEBAR_CONFIG, DEFAULT_SIDEBAR_CONFIG),
    feedConfigText: toJsonEditorText(DEFAULT_FEED_CONFIG, DEFAULT_FEED_CONFIG),
    policyConfigText: toJsonEditorText(DEFAULT_POLICY_CONFIG, DEFAULT_POLICY_CONFIG),
  }
}

function toIsoOrNull(value) {
  const text = String(value || '').trim()
  if (!text) return null
  const date = new Date(text)
  if (Number.isNaN(date.getTime())) return null
  return date.toISOString()
}

function toInputDateTimeValue(value) {
  if (!value) return ''
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return ''
  const yyyy = parsed.getFullYear()
  const mm = String(parsed.getMonth() + 1).padStart(2, '0')
  const dd = String(parsed.getDate()).padStart(2, '0')
  const hh = String(parsed.getHours()).padStart(2, '0')
  const min = String(parsed.getMinutes()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}T${hh}:${min}`
}

function buildFormStateFromDetail(detail) {
  return {
    name: detail?.name || '',
    description: detail?.description || '',
    status: detail?.status || 'draft',
    effectiveFrom: toInputDateTimeValue(detail?.effectiveFrom),
    effectiveTo: toInputDateTimeValue(detail?.effectiveTo),
    headerConfigText: toJsonEditorText(detail?.headerConfig || DEFAULT_HEADER_CONFIG, DEFAULT_HEADER_CONFIG),
    sidebarConfigText: toJsonEditorText(detail?.sidebarConfig || DEFAULT_SIDEBAR_CONFIG, DEFAULT_SIDEBAR_CONFIG),
    feedConfigText: toJsonEditorText(detail?.feedConfig || DEFAULT_FEED_CONFIG, DEFAULT_FEED_CONFIG),
    policyConfigText: toJsonEditorText(detail?.policyConfig || DEFAULT_POLICY_CONFIG, DEFAULT_POLICY_CONFIG),
  }
}

export default function CommunityConfigManagementPage() {
  const tenant = useTenant()
  const tenantCode = String(tenant?.currentTenant?.tenantCode || tenant?.resolvedTenant?.tenantCode || '').trim()
  const isMainDomain = Boolean(tenant?.isMainDomain)

  const [loading, setLoading] = useState(false)
  const [rows, setRows] = useState([])
  const [query, setQuery] = useState({ q: '', status: '' })
  const [queryDraft, setQueryDraft] = useState({ q: '', status: '' })
  const [formOptions, setFormOptions] = useState(DEFAULT_FORM_OPTIONS)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [actionId, setActionId] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [formLoading, setFormLoading] = useState(false)
  const [formData, setFormData] = useState(createInitialFormState())

  const statusOptions = useMemo(() => {
    const raw = Array.isArray(formOptions?.statuses) ? formOptions.statuses : DEFAULT_FORM_OPTIONS.statuses
    return raw.filter((item) => item === 'draft' || item === 'archived' || item === 'active')
  }, [formOptions])

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const [listPayload, options] = await Promise.all([
        getCommunityConfigs({
          q: String(query.q || '').trim() || undefined,
          status: String(query.status || '').trim() || undefined,
        }),
        getCommunityConfigFormOptions(),
      ])
      setRows(Array.isArray(listPayload?.data) ? listPayload.data : [])
      setFormOptions(options || DEFAULT_FORM_OPTIONS)
    } catch (requestError) {
      setRows([])
      setError(getApiMessage(requestError, 'Không tải được CommunityConfig'))
    } finally {
      setLoading(false)
    }
  }, [query.q, query.status])

  useEffect(() => {
    load()
  }, [load])

  useEffect(() => {
    if (!success) return undefined
    const timer = window.setTimeout(() => setSuccess(''), 3000)
    return () => window.clearTimeout(timer)
  }, [success])

  function resetForm() {
    setFormData(createInitialFormState())
    setEditingId(null)
  }

  function openCreateModal() {
    resetForm()
    setShowModal(true)
  }

  async function openEditModal(item) {
    if (!item?.id) return
    setFormLoading(true)
    setError('')
    try {
      const detail = await getCommunityConfigDetail(item.id)
      setEditingId(item.id)
      setFormData(buildFormStateFromDetail(detail))
      setShowModal(true)
    } catch (requestError) {
      setError(getApiMessage(requestError, 'Không tải được chi tiết CommunityConfig'))
    } finally {
      setFormLoading(false)
    }
  }

  function closeModal() {
    setShowModal(false)
    resetForm()
  }

  function applyQuery() {
    setQuery({
      q: String(queryDraft.q || '').trim(),
      status: String(queryDraft.status || '').trim(),
    })
  }

  function resetQuery() {
    const next = { q: '', status: '' }
    setQueryDraft(next)
    setQuery(next)
  }

  async function handleSubmit() {
    setFormLoading(true)
    setError('')
    setSuccess('')
    try {
      const parsedHeaderConfig = JSON.parse(String(formData.headerConfigText || '{}'))
      const parsedSidebarConfig = JSON.parse(String(formData.sidebarConfigText || '{}'))
      const parsedFeedConfig = JSON.parse(String(formData.feedConfigText || '{}'))
      const parsedPolicyConfig = JSON.parse(String(formData.policyConfigText || '{}'))

      const payload = {
        name: String(formData.name || '').trim(),
        description: String(formData.description || '').trim() || null,
        status: formData.status || 'draft',
        headerConfig: parsedHeaderConfig,
        sidebarConfig: parsedSidebarConfig,
        feedConfig: parsedFeedConfig,
        policyConfig: parsedPolicyConfig,
        effectiveFrom: toIsoOrNull(formData.effectiveFrom),
        effectiveTo: toIsoOrNull(formData.effectiveTo),
      }

      if (!payload.name) {
        throw new Error('Tên CommunityConfig không được để trống')
      }

      if (editingId) {
        await updateCommunityConfig(editingId, payload)
        setSuccess('Cập nhật CommunityConfig thành công')
      } else {
        await createCommunityConfig(payload)
        setSuccess('Tạo CommunityConfig thành công')
      }

      closeModal()
      await load()
    } catch (requestError) {
      setError(getApiMessage(requestError, 'Không thể lưu CommunityConfig'))
    } finally {
      setFormLoading(false)
    }
  }

  async function runAction(id, actionKey, action) {
    if (!id) return
    setActionId(`${actionKey}:${id}`)
    setError('')
    setSuccess('')
    try {
      await action()
      await load()
    } catch (requestError) {
      setError(getApiMessage(requestError, 'Không thể thực hiện hành động'))
    } finally {
      setActionId('')
    }
  }

  function openPreview(item) {
    if (!item?.id) return
    const previewPath = buildTenantUrl(`/community?previewConfig=${encodeURIComponent(String(item.id))}`, { tenantCode, isMainDomain }) || `/community?previewConfig=${encodeURIComponent(String(item.id))}`
    window.open(previewPath, '_blank', 'noopener,noreferrer')
  }

  return (
    <CRow className='g-4'>
      <CCol xs={12}>
        <CCard>
          <CCardHeader className='d-flex justify-content-between align-items-center flex-wrap gap-2'>
            <strong>Community Config Management</strong>
            <div className='d-flex gap-2'>
              <CButton color='secondary' variant='outline' onClick={load} disabled={loading}>Tải lại</CButton>
              <CButton color='primary' onClick={openCreateModal}>Thêm CommunityConfig</CButton>
            </div>
          </CCardHeader>
          <CCardBody>
            <CRow className='g-3 mb-3'>
              <CCol md={5}>
                <CFormInput
                  value={queryDraft.q}
                  onChange={(event) => setQueryDraft((prev) => ({ ...prev, q: event.target.value }))}
                  placeholder='Tìm theo tên hoặc mô tả'
                />
              </CCol>
              <CCol md={3}>
                <CFormSelect value={queryDraft.status} onChange={(event) => setQueryDraft((prev) => ({ ...prev, status: event.target.value }))}>
                  <option value=''>Tất cả trạng thái</option>
                  {statusOptions.map((status) => (
                    <option key={status} value={status}>{status}</option>
                  ))}
                </CFormSelect>
              </CCol>
              <CCol md={4} className='d-flex gap-2'>
                <CButton color='primary' variant='outline' onClick={applyQuery}>Lọc</CButton>
                <CButton color='light' onClick={resetQuery}>Bỏ lọc</CButton>
              </CCol>
            </CRow>

            {success ? <CAlert color='success'>{success}</CAlert> : null}
            {error ? <CAlert color='danger'>{error}</CAlert> : null}

            {loading ? (
              <div className='d-flex align-items-center gap-2'><CSpinner size='sm' /><span>Đang tải...</span></div>
            ) : (
              <CTable hover responsive align='middle'>
                <CTableHead>
                  <CTableRow>
                    <CTableHeaderCell>Tên</CTableHeaderCell>
                    <CTableHeaderCell>Status</CTableHeaderCell>
                    <CTableHeaderCell>Effective time</CTableHeaderCell>
                    <CTableHeaderCell>Updated at</CTableHeaderCell>
                    <CTableHeaderCell className='text-end'>Actions</CTableHeaderCell>
                  </CTableRow>
                </CTableHead>
                <CTableBody>
                  {rows.length === 0 ? (
                    <CTableRow>
                      <CTableDataCell colSpan={5} className='text-center text-body-secondary py-4'>
                        Chưa có CommunityConfig nào.
                      </CTableDataCell>
                    </CTableRow>
                  ) : rows.map((item) => {
                    const status = String(item.status || 'draft').toLowerCase()
                    const isRunningAction = (prefix) => actionId === `${prefix}:${item.id}`
                    return (
                      <CTableRow key={item.id}>
                        <CTableDataCell>
                          <div className='fw-semibold'>{item.name || `Config #${item.id}`}</div>
                          {item.description ? <div className='small text-body-secondary'>{item.description}</div> : null}
                        </CTableDataCell>
                        <CTableDataCell>
                          <CBadge color={statusColor(status)}>{status === 'active' ? 'Active' : status}</CBadge>
                        </CTableDataCell>
                        <CTableDataCell>
                          <div>Từ: {formatDateTime(item.effectiveFrom)}</div>
                          <div>Đến: {formatDateTime(item.effectiveTo)}</div>
                        </CTableDataCell>
                        <CTableDataCell>{formatDateTime(item.updatedAt)}</CTableDataCell>
                        <CTableDataCell className='text-end'>
                          <div className='d-flex justify-content-end flex-wrap gap-2'>
                            <CButton size='sm' color='light' onClick={() => openEditModal(item)}>Edit</CButton>
                            <CButton
                              size='sm'
                              color='secondary'
                              variant='outline'
                              disabled={isRunningAction('clone')}
                              onClick={() => runAction(item.id, 'clone', async () => {
                                await cloneCommunityConfig(item.id)
                                setSuccess('Đã clone CommunityConfig thành công')
                              })}
                            >
                              {isRunningAction('clone') ? 'Đang clone...' : 'Clone'}
                            </CButton>
                            <CButton
                              size='sm'
                              color='success'
                              disabled={status === 'active' || isRunningAction('activate')}
                              onClick={() => {
                                if (!window.confirm('Kích hoạt config này? Config active hiện tại sẽ chuyển sang archived.')) return
                                runAction(item.id, 'activate', async () => {
                                  await activateCommunityConfig(item.id)
                                  setSuccess('Đã activate CommunityConfig')
                                })
                              }}
                            >
                              {isRunningAction('activate') ? 'Đang activate...' : 'Activate'}
                            </CButton>
                            <CButton
                              size='sm'
                              color='warning'
                              variant='outline'
                              disabled={status === 'archived' || isRunningAction('archive')}
                              onClick={() => runAction(item.id, 'archive', async () => {
                                await archiveCommunityConfig(item.id)
                                setSuccess('Đã archive CommunityConfig')
                              })}
                            >
                              {isRunningAction('archive') ? 'Đang archive...' : 'Archive'}
                            </CButton>
                            <CButton size='sm' color='info' variant='outline' onClick={() => openPreview(item)}>Preview</CButton>
                          </div>
                        </CTableDataCell>
                      </CTableRow>
                    )
                  })}
                </CTableBody>
              </CTable>
            )}
          </CCardBody>
        </CCard>
      </CCol>

      <CModal visible={showModal} onClose={closeModal} size='xl' alignment='center'>
        <CModalHeader>
          <CModalTitle>{editingId ? 'Cập nhật CommunityConfig' : 'Thêm CommunityConfig mới'}</CModalTitle>
        </CModalHeader>
        <CModalBody>
          <CRow className='g-3'>
            <CCol md={8}>
              <CFormLabel>Tên</CFormLabel>
              <CFormInput value={formData.name} onChange={(event) => setFormData((prev) => ({ ...prev, name: event.target.value }))} />
            </CCol>
            <CCol md={4}>
              <CFormLabel>Status</CFormLabel>
              <CFormSelect
                value={formData.status}
                onChange={(event) => setFormData((prev) => ({ ...prev, status: event.target.value }))}
                disabled={formData.status === 'active'}
              >
                {statusOptions
                  .filter((status) => status !== 'active' || formData.status === 'active')
                  .map((status) => <option key={status} value={status}>{status}</option>)}
              </CFormSelect>
              {formData.status === 'active' ? <div className='small text-body-secondary mt-1'>Config active được đổi trạng thái qua action Activate/Archive.</div> : null}
            </CCol>
            <CCol xs={12}>
              <CFormLabel>Mô tả</CFormLabel>
              <CFormTextarea rows={2} value={formData.description} onChange={(event) => setFormData((prev) => ({ ...prev, description: event.target.value }))} />
            </CCol>
            <CCol md={6}>
              <CFormLabel>Effective from</CFormLabel>
              <CFormInput type='datetime-local' value={formData.effectiveFrom} onChange={(event) => setFormData((prev) => ({ ...prev, effectiveFrom: event.target.value }))} />
            </CCol>
            <CCol md={6}>
              <CFormLabel>Effective to</CFormLabel>
              <CFormInput type='datetime-local' value={formData.effectiveTo} onChange={(event) => setFormData((prev) => ({ ...prev, effectiveTo: event.target.value }))} />
            </CCol>
            <CCol xs={12}>
              <CFormLabel>headerConfig (JSON)</CFormLabel>
              <CFormTextarea rows={6} value={formData.headerConfigText} onChange={(event) => setFormData((prev) => ({ ...prev, headerConfigText: event.target.value }))} />
            </CCol>
            <CCol xs={12}>
              <CFormLabel>sidebarConfig (JSON)</CFormLabel>
              <CFormTextarea rows={8} value={formData.sidebarConfigText} onChange={(event) => setFormData((prev) => ({ ...prev, sidebarConfigText: event.target.value }))} />
            </CCol>
            <CCol xs={12}>
              <CFormLabel>feedConfig (JSON)</CFormLabel>
              <CFormTextarea rows={5} value={formData.feedConfigText} onChange={(event) => setFormData((prev) => ({ ...prev, feedConfigText: event.target.value }))} />
            </CCol>
            <CCol xs={12}>
              <CFormLabel>policyConfig (JSON)</CFormLabel>
              <CFormTextarea rows={5} value={formData.policyConfigText} onChange={(event) => setFormData((prev) => ({ ...prev, policyConfigText: event.target.value }))} />
            </CCol>
          </CRow>
        </CModalBody>
        <CModalFooter>
          <CButton color='light' onClick={closeModal}>Hủy</CButton>
          <CButton color='primary' onClick={handleSubmit} disabled={formLoading}>
            {formLoading ? 'Đang lưu...' : 'Lưu'}
          </CButton>
        </CModalFooter>
      </CModal>
    </CRow>
  )
}
