import { useEffect, useMemo, useState } from 'react'
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
  approveCampaignRegistration,
  cancelCampaignRegistration,
  changeCampaignRegistrationEmail,
  getCampaignRegistrationDetail,
  getCampaignRegistrations,
  rejectCampaignRegistration,
  resendCampaignRegistrationCompletionEmail,
  resendCampaignRegistrationRejectionEmail,
  resendCampaignRegistrationVerification,
  retryCompleteCampaignRegistration,
} from '../services/registrationCampaignApi'
import {
  buildTargetFeaturePath,
  formatDateTime,
  getApiMessage,
  getMailStatusColor,
  getRegistrationStatusMeta,
} from '../utils/registrationCampaignUi'
import CampaignRegistrationDetailModal from './CampaignRegistrationDetailModal'

function buildPages(currentPage, pageCount) {
  const pages = []
  const maxButtons = 5
  if (pageCount <= maxButtons) {
    for (let index = 1; index <= pageCount; index += 1) pages.push(index)
    return pages
  }
  const left = Math.max(2, currentPage - 1)
  const right = Math.min(pageCount - 1, currentPage + 1)
  pages.push(1)
  if (left > 2) pages.push('...')
  for (let index = left; index <= right; index += 1) pages.push(index)
  if (right < pageCount - 1) pages.push('...')
  pages.push(pageCount)
  return pages
}

export default function CampaignRegistrationsTab({ campaign, onChanged }) {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [rows, setRows] = useState([])
  const [pagination, setPagination] = useState({ page: 1, pageSize: 10, total: 0, pageCount: 1 })
  const [filters, setFilters] = useState({ q: '', status: '', hasUser: '', hasMembership: '', hasTargetFeature: '', dateFrom: '', dateTo: '' })
  const [query, setQuery] = useState(filters)
  const [detailVisible, setDetailVisible] = useState(false)
  const [detailLoading, setDetailLoading] = useState(false)
  const [selectedRegistration, setSelectedRegistration] = useState(null)
  const [emailDialog, setEmailDialog] = useState({ visible: false, registration: null, email: '', submitting: false, error: '' })

  const pages = useMemo(() => buildPages(pagination.page, pagination.pageCount), [pagination.page, pagination.pageCount])

  useEffect(() => {
    let mounted = true
    async function load() {
      setLoading(true)
      setError('')
      try {
        const result = await getCampaignRegistrations(campaign.id, {
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
        setError(getApiMessage(requestError, 'Không tải được danh sách người đăng ký'))
      } finally {
        if (mounted) setLoading(false)
      }
    }

    if (campaign?.id) {
      load()
    }
    return () => { mounted = false }
  }, [campaign?.id, pagination.page, pagination.pageSize, query])

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
    const next = { q: '', status: '', hasUser: '', hasMembership: '', hasTargetFeature: '', dateFrom: '', dateTo: '' }
    setFilters(next)
    setQuery(next)
    setPagination((prev) => ({ ...prev, page: 1 }))
  }

  async function reload() {
    setPagination((prev) => ({ ...prev }))
    onChanged?.()
  }

  async function openDetail(row) {
    setSelectedRegistration(null)
    setDetailVisible(true)
    setDetailLoading(true)
    try {
      const detail = await getCampaignRegistrationDetail(campaign.id, row.id)
      setSelectedRegistration(detail)
    } catch (requestError) {
      setError(getApiMessage(requestError, 'Không tải được chi tiết đăng ký'))
      setDetailVisible(false)
    } finally {
      setDetailLoading(false)
    }
  }

  async function handleResend(row) {
    try {
      const result = await resendCampaignRegistrationVerification(campaign.id, row.id)
      setSuccess(result?.message || 'Đã gửi lại email xác minh')
      await reload()
    } catch (requestError) {
      setError(getApiMessage(requestError, 'Không thể gửi lại email xác minh'))
    }
  }

  async function handleApprove(row) {
    if (!window.confirm('Duyệt đăng ký này?')) return
    try {
      const result = await approveCampaignRegistration(row.id)
      setSuccess(result?.message || 'Đã duyệt đăng ký')
      await reload()
    } catch (requestError) {
      setError(getApiMessage(requestError, 'Không thể duyệt đăng ký'))
    }
  }

  async function handleReject(row) {
    const reason = window.prompt('Lý do từ chối') || ''
    if (!window.confirm('Từ chối đăng ký này?')) return
    try {
      const result = await rejectCampaignRegistration(row.id, { reason })
      setSuccess(result?.message || 'Đã từ chối đăng ký')
      await reload()
    } catch (requestError) {
      setError(getApiMessage(requestError, 'Không thể từ chối đăng ký'))
    }
  }

  async function handleCancel(row) {
    const reason = window.prompt('Lý do hủy đăng ký') || ''
    if (!window.confirm('Hủy đăng ký này?')) return
    try {
      const result = await cancelCampaignRegistration(row.id, { reason })
      setSuccess(result?.message || 'Đã hủy đăng ký')
      await reload()
    } catch (requestError) {
      setError(getApiMessage(requestError, 'Không thể hủy đăng ký'))
    }
  }

  async function handleRetryComplete(row) {
    try {
      const result = await retryCompleteCampaignRegistration(row.id)
      setSuccess(result?.message || 'Đã thử hoàn tất lại đăng ký')
      await reload()
    } catch (requestError) {
      setError(getApiMessage(requestError, 'Không thể hoàn tất lại đăng ký'))
    }
  }

  async function handleResendCompletionEmail(row) {
    try {
      const result = await resendCampaignRegistrationCompletionEmail(campaign.id, row.id)
      setSuccess(result?.message || 'Đã gửi lại email hoàn tất đăng ký')
      await reload()
    } catch (requestError) {
      setError(getApiMessage(requestError, 'Không thể gửi lại email hoàn tất đăng ký'))
    }
  }

  async function handleResendRejectionEmail(row) {
    try {
      const result = await resendCampaignRegistrationRejectionEmail(campaign.id, row.id)
      setSuccess(result?.message || 'Đã gửi lại email từ chối đăng ký')
      await reload()
    } catch (requestError) {
      setError(getApiMessage(requestError, 'Không thể gửi lại email từ chối đăng ký'))
    }
  }

  function openEmailChange(row) {
    setEmailDialog({ visible: true, registration: row, email: row.email || '', submitting: false, error: '' })
  }

  async function submitEmailChange() {
    if (!emailDialog.registration?.id) return
    setEmailDialog((prev) => ({ ...prev, submitting: true, error: '' }))
    try {
      const result = await changeCampaignRegistrationEmail(campaign.id, emailDialog.registration.id, { email: emailDialog.email })
      setSuccess(result?.message || 'Đã đổi email và gửi lại xác minh')
      setEmailDialog({ visible: false, registration: null, email: '', submitting: false, error: '' })
      await reload()
    } catch (requestError) {
      setEmailDialog((prev) => ({ ...prev, submitting: false, error: getApiMessage(requestError, 'Không thể đổi email') }))
    }
  }

  function renderActions(row) {
    const status = row?.status
    if (status === 'pending_verification') {
      return (
        <div className='d-flex flex-wrap gap-2'>
          <CButton size='sm' color='secondary' variant='outline' onClick={() => openDetail(row)}>Xem</CButton>
          <CButton size='sm' color='info' variant='outline' onClick={() => handleResend(row)}>Gửi lại email</CButton>
          <CButton size='sm' color='warning' variant='outline' onClick={() => openEmailChange(row)}>Sửa email</CButton>
          <CButton size='sm' color='danger' variant='outline' onClick={() => handleCancel(row)}>Hủy</CButton>
        </div>
      )
    }
    if (status === 'verified') {
      return (
        <div className='d-flex flex-wrap gap-2'>
          <CButton size='sm' color='secondary' variant='outline' onClick={() => openDetail(row)}>Xem</CButton>
          <CButton size='sm' color='success' variant='outline' onClick={() => handleApprove(row)}>Duyệt</CButton>
          <CButton size='sm' color='danger' variant='outline' onClick={() => handleReject(row)}>Từ chối</CButton>
          {row.completionStatus === 'failed' ? <CButton size='sm' color='primary' variant='outline' onClick={() => handleRetryComplete(row)}>Thử hoàn tất lại</CButton> : null}
        </div>
      )
    }
    if (status === 'approved') {
      const featurePath = buildTargetFeaturePath(campaign?.targetFeature)
      return (
        <div className='d-flex flex-wrap gap-2'>
          <CButton size='sm' color='secondary' variant='outline' onClick={() => openDetail(row)}>Xem</CButton>
          <CButton size='sm' color='primary' variant='outline' onClick={() => window.location.assign('/users')}>Mở user</CButton>
          <CButton size='sm' color='info' variant='outline' onClick={() => window.location.assign('/users')}>Mở membership</CButton>
          {row.completionEmail?.sendStatus === 'FAILED' ? <CButton size='sm' color='warning' variant='outline' onClick={() => handleResendCompletionEmail(row)}>Gửi lại mail hoàn tất</CButton> : null}
          {featurePath ? <CButton size='sm' color='success' variant='outline' onClick={() => window.location.assign(featurePath)}>Mở feature</CButton> : null}
        </div>
      )
    }
    if (status === 'rejected') {
      return (
        <div className='d-flex flex-wrap gap-2'>
          <CButton size='sm' color='secondary' variant='outline' onClick={() => openDetail(row)}>Xem</CButton>
          {row.rejectionEmail?.sendStatus === 'FAILED' ? <CButton size='sm' color='warning' variant='outline' onClick={() => handleResendRejectionEmail(row)}>Gửi lại mail từ chối</CButton> : null}
        </div>
      )
    }
    if (status === 'expired') {
      return (
        <div className='d-flex flex-wrap gap-2'>
          <CButton size='sm' color='secondary' variant='outline' onClick={() => openDetail(row)}>Xem</CButton>
          <CButton size='sm' color='info' variant='outline' onClick={() => handleResend(row)}>Gửi lại email</CButton>
        </div>
      )
    }
    return <CButton size='sm' color='secondary' variant='outline' onClick={() => openDetail(row)}>Xem</CButton>
  }

  return (
    <CCard>
      <CCardHeader className='d-flex justify-content-between align-items-center flex-wrap gap-2'>
        <strong>Người đăng ký</strong>
        <div className='small text-body-secondary'>Chiến dịch chưa có người đăng ký? Hãy chia sẻ link hoặc mã chiến dịch.</div>
      </CCardHeader>
      <CCardBody>
        <CRow className='g-3 mb-3'>
          <CCol md={4}>
            <CFormInput placeholder='Tìm theo tên, email, điện thoại' value={filters.q} onChange={(event) => setFilters((prev) => ({ ...prev, q: event.target.value }))} />
          </CCol>
          <CCol md={2}>
            <CFormSelect value={filters.status} onChange={(event) => setFilters((prev) => ({ ...prev, status: event.target.value }))}>
              <option value=''>Tất cả trạng thái</option>
              <option value='pending_verification'>Chờ xác minh</option>
              <option value='verified'>Đã xác minh</option>
              <option value='approved'>Đã hoàn tất</option>
              <option value='rejected'>Bị từ chối</option>
              <option value='cancelled'>Đã hủy</option>
              <option value='expired'>Đã hết hạn</option>
            </CFormSelect>
          </CCol>
          <CCol md={2}>
            <CFormSelect value={filters.hasUser} onChange={(event) => setFilters((prev) => ({ ...prev, hasUser: event.target.value }))}>
              <option value=''>User: tất cả</option>
              <option value='true'>Đã liên kết user</option>
              <option value='false'>Chưa liên kết user</option>
            </CFormSelect>
          </CCol>
          <CCol md={2}>
            <CFormSelect value={filters.hasMembership} onChange={(event) => setFilters((prev) => ({ ...prev, hasMembership: event.target.value }))}>
              <option value=''>Membership: tất cả</option>
              <option value='true'>Đã thuộc tenant</option>
              <option value='false'>Chưa thuộc tenant</option>
            </CFormSelect>
          </CCol>
          <CCol md={2}>
            <CFormSelect value={filters.hasTargetFeature} onChange={(event) => setFilters((prev) => ({ ...prev, hasTargetFeature: event.target.value }))}>
              <option value=''>Feature: tất cả</option>
              <option value='true'>Đã có quyền</option>
              <option value='false'>Chưa có quyền</option>
            </CFormSelect>
          </CCol>
          <CCol md={3}>
            <CFormInput type='date' value={filters.dateFrom} onChange={(event) => setFilters((prev) => ({ ...prev, dateFrom: event.target.value }))} />
          </CCol>
          <CCol md={3}>
            <CFormInput type='date' value={filters.dateTo} onChange={(event) => setFilters((prev) => ({ ...prev, dateTo: event.target.value }))} />
          </CCol>
          <CCol md={3} className='d-flex gap-2'>
            <CButton color='primary' onClick={applyFilters}>Lọc</CButton>
            <CButton color='secondary' variant='outline' onClick={resetFilters}>Đặt lại</CButton>
          </CCol>
        </CRow>

        {error ? <CAlert color='danger'>{error}</CAlert> : null}
        {success ? <CAlert color='success'>{success}</CAlert> : null}

        {loading ? (
          <div className='d-flex align-items-center gap-2'>
            <CSpinner size='sm' />
            <span>Đang tải danh sách người đăng ký...</span>
          </div>
        ) : (
          <>
            <CTable hover responsive align='middle'>
              <CTableHead>
                <CTableRow>
                  <CTableHeaderCell>Họ và tên</CTableHeaderCell>
                  <CTableHeaderCell>Email</CTableHeaderCell>
                  <CTableHeaderCell>Điện thoại</CTableHeaderCell>
                  <CTableHeaderCell>Trạng thái</CTableHeaderCell>
                  <CTableHeaderCell>Ngày đăng ký</CTableHeaderCell>
                  <CTableHeaderCell>Ngày xác minh</CTableHeaderCell>
                  <CTableHeaderCell>User</CTableHeaderCell>
                  <CTableHeaderCell>Membership</CTableHeaderCell>
                  <CTableHeaderCell>Quyền feature</CTableHeaderCell>
                  <CTableHeaderCell>Hoàn tất</CTableHeaderCell>
                  <CTableHeaderCell>Email gần nhất</CTableHeaderCell>
                  <CTableHeaderCell>Thao tác</CTableHeaderCell>
                </CTableRow>
              </CTableHead>
              <CTableBody>
                {rows.length > 0 ? rows.map((row) => {
                  const statusMeta = getRegistrationStatusMeta(row.status)
                  return (
                    <CTableRow key={row.id}>
                      <CTableDataCell>{row.fullName || '-'}</CTableDataCell>
                      <CTableDataCell>{row.email || '-'}</CTableDataCell>
                      <CTableDataCell>{row.phone || '-'}</CTableDataCell>
                      <CTableDataCell><CBadge color={statusMeta.color}>{statusMeta.label}</CBadge></CTableDataCell>
                      <CTableDataCell>{formatDateTime(row.registeredAt)}</CTableDataCell>
                      <CTableDataCell>{formatDateTime(row.verifiedAt)}</CTableDataCell>
                      <CTableDataCell>{row.user?.email || '-'}</CTableDataCell>
                      <CTableDataCell>{row.membership?.id ? `#${row.membership.id}` : '-'}</CTableDataCell>
                      <CTableDataCell>{row.targetFeatureGranted ? 'Đã có' : 'Chưa có'}</CTableDataCell>
                      <CTableDataCell>
                        <div>{row.completionStatus || '-'}</div>
                        {row.completionError ? <div className='small text-danger'>{row.completionError}</div> : null}
                      </CTableDataCell>
                      <CTableDataCell>
                        <div className='d-flex flex-column gap-1'>
                          <div className='small'>Xác minh: {row.verificationEmail?.sendStatus ? <CBadge color={getMailStatusColor(row.verificationEmail.sendStatus)}>{row.verificationEmail.sendStatus}</CBadge> : '-'}</div>
                          <div className='small'>Hoàn tất: {row.completionEmail?.sendStatus ? <CBadge color={getMailStatusColor(row.completionEmail.sendStatus)}>{row.completionEmail.sendStatus}</CBadge> : '-'}</div>
                          <div className='small'>Từ chối: {row.rejectionEmail?.sendStatus ? <CBadge color={getMailStatusColor(row.rejectionEmail.sendStatus)}>{row.rejectionEmail.sendStatus}</CBadge> : '-'}</div>
                        </div>
                      </CTableDataCell>
                      <CTableDataCell>{renderActions(row)}</CTableDataCell>
                    </CTableRow>
                  )
                }) : (
                  <CTableRow>
                    <CTableDataCell colSpan={12} className='text-center text-body-secondary'>Chiến dịch chưa có người đăng ký. Hãy chia sẻ link hoặc mã chiến dịch.</CTableDataCell>
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

        <CampaignRegistrationDetailModal
          visible={detailVisible}
          loading={detailLoading}
          registration={selectedRegistration}
          onClose={() => setDetailVisible(false)}
        />

        <CModal visible={emailDialog.visible} onClose={() => setEmailDialog({ visible: false, registration: null, email: '', submitting: false, error: '' })}>
          <CModalHeader>
            <CModalTitle>Sửa email người đăng ký</CModalTitle>
          </CModalHeader>
          <CModalBody>
            {emailDialog.error ? <CAlert color='danger'>{emailDialog.error}</CAlert> : null}
            <CFormInput type='email' value={emailDialog.email} onChange={(event) => setEmailDialog((prev) => ({ ...prev, email: event.target.value }))} />
          </CModalBody>
          <CModalFooter>
            <CButton color='secondary' variant='outline' onClick={() => setEmailDialog({ visible: false, registration: null, email: '', submitting: false, error: '' })}>Hủy</CButton>
            <CButton color='primary' disabled={emailDialog.submitting} onClick={submitEmailChange}>{emailDialog.submitting ? 'Đang lưu...' : 'Lưu và gửi lại'}</CButton>
          </CModalFooter>
        </CModal>
      </CCardBody>
    </CCard>
  )
}