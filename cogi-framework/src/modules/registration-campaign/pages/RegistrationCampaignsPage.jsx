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
  CFormInput,
  CFormSelect,
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
import RegistrationCampaignCreateModal from '../components/RegistrationCampaignCreateModal'
import {
  cancelRegistrationCampaign,
  closeRegistrationCampaign,
  createRegistrationCampaign,
  getRegistrationCampaignFormOptions,
  getRegistrationCampaigns,
  openRegistrationCampaign,
  pauseRegistrationCampaign,
} from '../services/registrationCampaignApi'
import {
  buildRegistrationCampaignTabPath,
  copyToClipboard,
  formatDateTime,
  getApiMessage,
  getCampaignStatusMeta,
} from '../utils/registrationCampaignUi'

function buildPages(currentPage, pageCount) {
  const pages = []
  const maxButtons = 7
  if (pageCount <= maxButtons) {
    for (let index = 1; index <= pageCount; index += 1) pages.push(index)
    return pages
  }
  const left = Math.max(2, currentPage - 2)
  const right = Math.min(pageCount - 1, currentPage + 2)
  pages.push(1)
  if (left > 2) pages.push('...')
  for (let index = left; index <= right; index += 1) pages.push(index)
  if (right < pageCount - 1) pages.push('...')
  pages.push(pageCount)
  return pages
}

export default function RegistrationCampaignsPage() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [rows, setRows] = useState([])
  const [pagination, setPagination] = useState({ page: 1, pageSize: 10, total: 0, pageCount: 1 })
  const [filters, setFilters] = useState({ name: '', code: '', status: '', targetFeature: '', sort: 'createdAt:desc' })
  const [query, setQuery] = useState(filters)
  const [formOptions, setFormOptions] = useState(null)
  const [optionsLoading, setOptionsLoading] = useState(false)
  const [showCreate, setShowCreate] = useState(false)

  const pages = useMemo(() => buildPages(pagination.page, pagination.pageCount), [pagination.page, pagination.pageCount])

  async function loadOptions() {
    setOptionsLoading(true)
    try {
      const data = await getRegistrationCampaignFormOptions()
      setFormOptions(data || null)
      return data || null
    } catch {
      setFormOptions({ targetFeatures: [], availableRoles: [] })
      return null
    } finally {
      setOptionsLoading(false)
    }
  }

  useEffect(() => {
    loadOptions()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    let mounted = true
    async function load() {
      setLoading(true)
      setError('')
      try {
        const result = await getRegistrationCampaigns({
          page: pagination.page,
          pageSize: pagination.pageSize,
          ...query,
        })
        if (!mounted) return
        setRows(Array.isArray(result?.rows) ? result.rows : [])
        setPagination(result?.pagination || { page: 1, pageSize: 10, total: 0, pageCount: 1 })
      } catch (requestError) {
        if (!mounted) return
        setRows([])
        setError(getApiMessage(requestError, 'Không tải được danh sách chiến dịch đăng ký'))
      } finally {
        if (mounted) setLoading(false)
      }
    }
    load()
    return () => { mounted = false }
  }, [pagination.page, pagination.pageSize, query])

  useEffect(() => {
    if (!success) return undefined
    const timer = window.setTimeout(() => setSuccess(''), 2500)
    return () => window.clearTimeout(timer)
  }, [success])

  function applyFilters() {
    setPagination((prev) => ({ ...prev, page: 1 }))
    setQuery(filters)
  }

  function resetFilters() {
    const next = { name: '', code: '', status: '', targetFeature: '', sort: 'createdAt:desc' }
    setFilters(next)
    setQuery(next)
    setPagination((prev) => ({ ...prev, page: 1 }))
  }

  async function handleCreate(payload) {
    setCreating(true)
    setError('')
    try {
      const result = await createRegistrationCampaign(payload)
      setShowCreate(false)
      navigate(buildRegistrationCampaignTabPath(result?.id, 'overview'))
    } catch (requestError) {
      setError(getApiMessage(requestError, 'Không thể tạo chiến dịch đăng ký'))
    } finally {
      setCreating(false)
    }
  }

  async function openCreateModal() {
    await loadOptions()
    setShowCreate(true)
  }

  async function runStatusAction(row, actionKey) {
    try {
      if (actionKey === 'open') await openRegistrationCampaign(row.id)
      if (actionKey === 'pause') await pauseRegistrationCampaign(row.id)
      if (actionKey === 'close') await closeRegistrationCampaign(row.id)
      if (actionKey === 'cancel') {
        const reason = window.prompt('Lý do hủy chiến dịch') || ''
        await cancelRegistrationCampaign(row.id, { reason })
      }
      setSuccess('Cập nhật trạng thái chiến dịch thành công')
      setPagination((prev) => ({ ...prev }))
    } catch (requestError) {
      setError(getApiMessage(requestError, 'Không thể cập nhật trạng thái chiến dịch'))
    }
  }

  async function handleCopyLink(row) {
    const copied = await copyToClipboard(row?.publicJoinPath || row?.publicJoinUrl)
    if (copied) setSuccess('Đã sao chép link đăng ký')
    else setError('Không thể sao chép link đăng ký')
  }

  function renderActions(row) {
    const status = row?.status
    return (
      <div className='d-flex flex-wrap gap-2'>
        <CButton size='sm' color='secondary' variant='outline' onClick={() => navigate(buildRegistrationCampaignTabPath(row.id, 'overview'))}>Xem chi tiết</CButton>
        <CButton size='sm' color='warning' variant='outline' onClick={() => navigate(buildRegistrationCampaignTabPath(row.id, 'overview'))}>Sửa</CButton>
        {row?.publicJoinPath ? <CButton size='sm' color='info' variant='outline' onClick={() => handleCopyLink(row)}>Sao chép link</CButton> : null}
        {status === 'draft' || status === 'paused' ? <CButton size='sm' color='success' variant='outline' onClick={() => runStatusAction(row, 'open')}>{status === 'paused' ? 'Mở lại' : 'Mở'}</CButton> : null}
        {status === 'open' ? <CButton size='sm' color='warning' variant='outline' onClick={() => runStatusAction(row, 'pause')}>Tạm dừng</CButton> : null}
        {(status === 'open' || status === 'paused') ? <CButton size='sm' color='secondary' variant='outline' onClick={() => runStatusAction(row, 'close')}>Đóng</CButton> : null}
        {(status === 'draft' || status === 'open') ? <CButton size='sm' color='danger' variant='outline' onClick={() => runStatusAction(row, 'cancel')}>Hủy</CButton> : null}
      </div>
    )
  }

  return (
    <CRow className='g-4'>
      <CCol xs={12}>
        <CCard>
          <CCardHeader className='d-flex justify-content-between align-items-center flex-wrap gap-3'>
            <strong>Chiến dịch đăng ký</strong>
            <div className='d-flex gap-2'>
              <CButton color='secondary' variant='outline' onClick={() => setPagination((prev) => ({ ...prev }))} disabled={loading}>Tải lại</CButton>
              <CButton color='primary' onClick={openCreateModal}>Tạo chiến dịch</CButton>
            </div>
          </CCardHeader>
          <CCardBody>
            <CRow className='g-3 mb-3'>
              <CCol md={3}><CFormInput placeholder='Tìm theo tên' value={filters.name} onChange={(event) => setFilters((prev) => ({ ...prev, name: event.target.value }))} /></CCol>
              <CCol md={2}><CFormInput placeholder='Tìm theo mã' value={filters.code} onChange={(event) => setFilters((prev) => ({ ...prev, code: event.target.value }))} /></CCol>
              <CCol md={2}>
                <CFormSelect value={filters.status} onChange={(event) => setFilters((prev) => ({ ...prev, status: event.target.value }))}>
                  <option value=''>Tất cả trạng thái</option>
                  <option value='draft'>Bản nháp</option>
                  <option value='open'>Đang mở</option>
                  <option value='paused'>Tạm dừng</option>
                  <option value='closed'>Đã đóng</option>
                  <option value='cancelled'>Đã hủy</option>
                </CFormSelect>
              </CCol>
              <CCol md={2}>
                <CFormSelect value={filters.targetFeature} onChange={(event) => setFilters((prev) => ({ ...prev, targetFeature: event.target.value }))}>
                  <option value=''>Tất cả feature</option>
                  {(formOptions?.targetFeatures || []).map((item) => <option key={item.key} value={item.key}>{item.name || item.key}</option>)}
                </CFormSelect>
              </CCol>
              <CCol md={2}>
                <CFormSelect value={filters.sort} onChange={(event) => setFilters((prev) => ({ ...prev, sort: event.target.value }))}>
                  <option value='createdAt:desc'>Mới tạo gần nhất</option>
                  <option value='createdAt:asc'>Mới tạo cũ nhất</option>
                  <option value='startAt:asc'>Bắt đầu sớm nhất</option>
                  <option value='startAt:desc'>Bắt đầu muộn nhất</option>
                </CFormSelect>
              </CCol>
              <CCol md={1} className='d-flex gap-2'>
                <CButton color='primary' onClick={applyFilters}>Lọc</CButton>
              </CCol>
            </CRow>

            {error ? <CAlert color='danger'>{error}</CAlert> : null}
            {success ? <CAlert color='success'>{success}</CAlert> : null}

            {loading ? (
              <div className='d-flex align-items-center gap-2'>
                <CSpinner size='sm' />
                <span>Đang tải danh sách chiến dịch...</span>
              </div>
            ) : (
              <>
                <CTable responsive hover align='middle'>
                  <CTableHead>
                    <CTableRow>
                      <CTableHeaderCell>Tên chiến dịch</CTableHeaderCell>
                      <CTableHeaderCell>Mã chiến dịch</CTableHeaderCell>
                      <CTableHeaderCell>Chức năng được cấp</CTableHeaderCell>
                      <CTableHeaderCell>Trạng thái</CTableHeaderCell>
                      <CTableHeaderCell>Thời gian bắt đầu</CTableHeaderCell>
                      <CTableHeaderCell>Thời gian kết thúc</CTableHeaderCell>
                      <CTableHeaderCell>Số người đăng ký</CTableHeaderCell>
                      <CTableHeaderCell>Ngày tạo</CTableHeaderCell>
                      <CTableHeaderCell>Thao tác</CTableHeaderCell>
                    </CTableRow>
                  </CTableHead>
                  <CTableBody>
                    {rows.length > 0 ? rows.map((row) => {
                      const statusMeta = getCampaignStatusMeta(row.status)
                      return (
                        <CTableRow key={row.id}>
                          <CTableDataCell>
                            <div className='fw-semibold'>{row.name || '-'}</div>
                            <div className='small text-body-secondary'>{row.shortDescription || '-'}</div>
                          </CTableDataCell>
                          <CTableDataCell>{row.code || '-'}</CTableDataCell>
                          <CTableDataCell>
                            <div>{row.targetFeature || '-'}</div>
                            <div className='small text-body-secondary'>Vai trò: {row.defaultTenantRole?.name || 'Chưa cấu hình'}</div>
                          </CTableDataCell>
                          <CTableDataCell><CBadge color={statusMeta.color}>{statusMeta.label}</CBadge></CTableDataCell>
                          <CTableDataCell>{formatDateTime(row.startAt)}</CTableDataCell>
                          <CTableDataCell>{formatDateTime(row.endAt)}</CTableDataCell>
                          <CTableDataCell>{row.registrationCount || 0}</CTableDataCell>
                          <CTableDataCell>{formatDateTime(row.createdAt)}</CTableDataCell>
                          <CTableDataCell>{renderActions(row)}</CTableDataCell>
                        </CTableRow>
                      )
                    }) : (
                      <CTableRow>
                        <CTableDataCell colSpan={9} className='text-center text-body-secondary'>Chưa có chiến dịch đăng ký nào. Hãy tạo chiến dịch đầu tiên để bắt đầu tiếp nhận người dùng.</CTableDataCell>
                      </CTableRow>
                    )}
                  </CTableBody>
                </CTable>

                {pagination.pageCount > 1 ? (
                  <div className='d-flex justify-content-end'>
                    <CPagination>
                      <CPaginationItem disabled={pagination.page <= 1} onClick={() => setPagination((prev) => ({ ...prev, page: Math.max(1, prev.page - 1) }))}>Trước</CPaginationItem>
                      {pages.map((item, index) => item === '...'
                        ? <CPaginationItem key={`ellipsis:${index}`} disabled>...</CPaginationItem>
                        : <CPaginationItem key={item} active={pagination.page === item} onClick={() => setPagination((prev) => ({ ...prev, page: item }))}>{item}</CPaginationItem>)}
                      <CPaginationItem disabled={pagination.page >= pagination.pageCount} onClick={() => setPagination((prev) => ({ ...prev, page: Math.min(prev.pageCount, prev.page + 1) }))}>Sau</CPaginationItem>
                    </CPagination>
                  </div>
                ) : null}
              </>
            )}
          </CCardBody>
        </CCard>
      </CCol>

      <RegistrationCampaignCreateModal
        visible={showCreate}
        targetFeatureOptions={formOptions?.targetFeatures || []}
        roleOptions={formOptions?.availableRoles || []}
        rolesLoading={optionsLoading}
        submitting={creating}
        onClose={() => !creating && setShowCreate(false)}
        onSubmit={handleCreate}
      />
    </CRow>
  )
}