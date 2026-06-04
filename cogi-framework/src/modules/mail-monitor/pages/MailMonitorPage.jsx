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
import { useFeature } from '../../../contexts/FeatureContext'
import MailLogDetailModal from '../components/MailLogDetailModal'
import {
  cancelMailMonitorLog,
  getMailMonitorLogDetail,
  getMailMonitorLogs,
  getMailMonitorStats,
  requeueMailMonitorLog,
  resendMailMonitorLog,
  sendNowMailMonitorLog,
  sendMailMonitorTestMail,
} from '../services/mailMonitorService'

function getApiMessage(error, fallback) {
  return error?.response?.data?.error?.message || error?.response?.data?.message || error?.message || fallback
}

function formatDateTime(value) {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '-'
  return new Intl.DateTimeFormat('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).format(date)
}

function getStatusColor(status) {
  const normalized = String(status || '').trim().toUpperCase()
  if (normalized === 'QUEUED') return 'secondary'
  if (normalized === 'SENDING') return 'info'
  if (normalized === 'SENT') return 'success'
  if (normalized === 'FAILED') return 'danger'
  if (normalized === 'RETRYING') return 'warning'
  if (normalized === 'CANCELLED') return 'dark'
  return 'secondary'
}

function truncateText(value, maxLength = 80) {
  const text = String(value || '').trim()
  if (!text) return '-'
  return text.length > maxLength ? `${text.slice(0, maxLength - 1)}...` : text
}

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

function canRequeueStatus(status) {
  return ['FAILED', 'CANCELLED', 'QUEUED', 'RETRYING'].includes(String(status || '').trim().toUpperCase())
}

function canSendNowStatus(status) {
  return ['FAILED', 'CANCELLED', 'QUEUED', 'RETRYING'].includes(String(status || '').trim().toUpperCase())
}

function canCancelStatus(status) {
  return ['QUEUED', 'RETRYING'].includes(String(status || '').trim().toUpperCase())
}

export default function MailMonitorPage() {
  const feature = useFeature()
  const [loading, setLoading] = useState(true)
  const [statsLoading, setStatsLoading] = useState(true)
  const [error, setError] = useState('')
  const [successMessage, setSuccessMessage] = useState('')
  const [rows, setRows] = useState([])
  const [stats, setStats] = useState({})
  const [mailType, setMailType] = useState('')
  const [sendStatus, setSendStatus] = useState('')
  const [toEmailDraft, setToEmailDraft] = useState('')
  const [toEmail, setToEmail] = useState('')
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)
  const [pageCount, setPageCount] = useState(1)
  const [total, setTotal] = useState(0)
  const [detailVisible, setDetailVisible] = useState(false)
  const [detailLoading, setDetailLoading] = useState(false)
  const [selectedLog, setSelectedLog] = useState(null)
  const [confirmState, setConfirmState] = useState(null)
  const [actionSubmitting, setActionSubmitting] = useState(false)
  const [testModalVisible, setTestModalVisible] = useState(false)
  const [testSubmitting, setTestSubmitting] = useState(false)
  const [testEmail, setTestEmail] = useState('')
  const [testSubject, setTestSubject] = useState('COGI Mail Monitor Test')

  const canManage = Boolean(feature?.hasFeature?.('system.mailMonitor'))

  const pages = useMemo(() => buildPages(page, pageCount), [page, pageCount])
  const fromToText = useMemo(() => {
    if (total === 0) return '0'
    const from = (page - 1) * pageSize + 1
    const to = Math.min(page * pageSize, total)
    return `${from}-${to}/${total}`
  }, [page, pageSize, total])

  const queryParams = useMemo(() => ({
    page,
    pageSize,
    ...(mailType ? { mailType } : {}),
    ...(sendStatus ? { sendStatus } : {}),
    ...(toEmail ? { toEmail } : {}),
    ...(fromDate ? { fromDate } : {}),
    ...(toDate ? { toDate } : {}),
  }), [page, pageSize, mailType, sendStatus, toEmail, fromDate, toDate])

  const loadLogs = useCallback(async () => {
    setLoading(true)
    setError('')

    try {
      const result = await getMailMonitorLogs(queryParams)
      setRows(Array.isArray(result?.data) ? result.data : [])
      setPage(Number(result?.meta?.pagination?.page || page))
      setPageSize(Number(result?.meta?.pagination?.pageSize || pageSize))
      setPageCount(Math.max(1, Number(result?.meta?.pagination?.pageCount || 1)))
      setTotal(Number(result?.meta?.pagination?.total || 0))
    } catch (requestError) {
      setRows([])
      setTotal(0)
      setPageCount(1)
      setError(getApiMessage(requestError, 'Không tải được mail logs'))
    } finally {
      setLoading(false)
    }
  }, [page, pageSize, queryParams])

  const loadStats = useCallback(async () => {
    setStatsLoading(true)
    try {
      const result = await getMailMonitorStats({
        ...(mailType ? { mailType } : {}),
        ...(sendStatus ? { sendStatus } : {}),
        ...(toEmail ? { toEmail } : {}),
        ...(fromDate ? { fromDate } : {}),
        ...(toDate ? { toDate } : {}),
      })
      setStats(result || {})
    } catch {
      setStats({})
    } finally {
      setStatsLoading(false)
    }
  }, [mailType, sendStatus, toEmail, fromDate, toDate])

  useEffect(() => {
    loadLogs()
  }, [loadLogs])

  useEffect(() => {
    loadStats()
  }, [loadStats])

  function applySearch() {
    setPage(1)
    setSuccessMessage('')
    setToEmail(String(toEmailDraft || '').trim())
  }

  function resetFilters() {
    setMailType('')
    setSendStatus('')
    setToEmailDraft('')
    setToEmail('')
    setFromDate('')
    setToDate('')
    setPage(1)
    setPageSize(20)
    setSuccessMessage('')
    setError('')
  }

  async function handleSendTestMail() {
    if (testSubmitting) return

    setTestSubmitting(true)
    setError('')
    setSuccessMessage('')

    try {
      const result = await sendMailMonitorTestMail({
        toEmail: String(testEmail || '').trim(),
        subject: String(testSubject || '').trim() || 'COGI Mail Monitor Test',
      })

      const sendResult = result?.data || {}
      const providerLabel = sendResult?.provider ? ` qua ${sendResult.provider}` : ''
      setSuccessMessage(
        sendResult?.sendStatus
          ? `Test mail #${sendResult.mailLogId || ''} ${sendResult.sendStatus}${providerLabel}`.trim()
          : `Đã tạo test mail${sendResult?.mailLogId ? ` (#${sendResult.mailLogId})` : ''}`,
      )
      setTestModalVisible(false)
      setTestEmail('')
      setTestSubject('COGI Mail Monitor Test')
      await Promise.all([loadLogs(), loadStats()])
    } catch (requestError) {
      setError(getApiMessage(requestError, 'Không gửi được test mail'))
    } finally {
      setTestSubmitting(false)
    }
  }

  async function handleViewDetail(row) {
    if (!row?.id) return

    setDetailVisible(true)
    setDetailLoading(true)
    setSelectedLog(null)

    try {
      const detail = await getMailMonitorLogDetail(row.id)
      setSelectedLog(detail)
    } catch (requestError) {
      setError(getApiMessage(requestError, 'Không tải được chi tiết mail log'))
      setDetailVisible(false)
    } finally {
      setDetailLoading(false)
    }
  }

  function openConfirm(type, row) {
    const actionMap = {
      requeue: {
        title: 'Xác nhận requeue',
        message: `Đưa lại mail log #${row?.id} vào hàng đợi?`,
      },
      resend: {
        title: 'Xác nhận resend',
        message: `Tạo mail log mới và gửi lại mail #${row?.id}?`,
      },
      sendNow: {
        title: 'Xác nhận gửi ngay',
        message: `Gửi trực tiếp mail log #${row?.id} ngay bây giờ?`,
      },
      cancel: {
        title: 'Xác nhận cancel',
        message: `Hủy mail log #${row?.id} nếu job còn đang chờ?`,
      },
    }

    setConfirmState({
      type,
      row,
      ...actionMap[type],
    })
  }

  async function handleConfirmAction() {
    if (!confirmState?.row?.id || actionSubmitting) return

    setActionSubmitting(true)
    setError('')
    setSuccessMessage('')

    try {
      if (confirmState.type === 'requeue') {
        await requeueMailMonitorLog(confirmState.row.id)
        setSuccessMessage(`Đã requeue mail log #${confirmState.row.id}`)
      } else if (confirmState.type === 'sendNow') {
        const result = await sendNowMailMonitorLog(confirmState.row.id)
        const payload = result?.data || {}
        const providerLabel = payload?.provider ? ` qua ${payload.provider}` : ''
        setSuccessMessage(`Đã gửi mail log #${confirmState.row.id} với trạng thái ${payload?.sendStatus || '-'}${providerLabel}`)
      } else if (confirmState.type === 'resend') {
        await resendMailMonitorLog(confirmState.row.id)
        setSuccessMessage(`Đã tạo mail log mới để resend từ #${confirmState.row.id}`)
      } else if (confirmState.type === 'cancel') {
        await cancelMailMonitorLog(confirmState.row.id)
        setSuccessMessage(`Đã cancel mail log #${confirmState.row.id}`)
      }

      setConfirmState(null)
      await Promise.all([loadLogs(), loadStats()])
    } catch (requestError) {
      setError(getApiMessage(requestError, 'Không thực hiện được thao tác mail log'))
    } finally {
      setActionSubmitting(false)
    }
  }

  const statusStats = stats?.byStatus || {}
  const summaryCards = [
    { label: 'Queued', value: statusStats.QUEUED || 0 },
    { label: 'Sending', value: statusStats.SENDING || 0 },
    { label: 'Sent', value: statusStats.SENT || 0 },
    { label: 'Failed', value: statusStats.FAILED || 0 },
  ]

  return (
    <CRow className='g-4'>
      {summaryCards.map((item) => (
        <CCol key={item.label} sm={6} xl={3}>
          <CCard>
            <CCardBody>
              <div className='text-body-secondary small'>{item.label}</div>
              <div className='fs-4 fw-semibold'>{statsLoading ? '...' : item.value}</div>
            </CCardBody>
          </CCard>
        </CCol>
      ))}

      <CCol xs={12}>
        <CCard>
          <CCardHeader className='d-flex justify-content-between align-items-center gap-3 flex-wrap'>
            <strong>Mail Monitor</strong>
            <div className='d-flex align-items-center gap-2 flex-wrap'>
              {canManage ? (
                <CButton color='primary' variant='outline' onClick={() => setTestModalVisible(true)}>
                  Send Test Mail
                </CButton>
              ) : null}
              <div className='small text-body-secondary'>{fromToText}</div>
            </div>
          </CCardHeader>
          <CCardBody>
            <CRow className='g-3 mb-3'>
              <CCol md={3}>
                <CFormInput
                  placeholder='Email người nhận'
                  value={toEmailDraft}
                  onChange={(event) => setToEmailDraft(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') applySearch()
                  }}
                />
              </CCol>
              <CCol md={2}>
                <CFormInput placeholder='Mail type' value={mailType} onChange={(event) => { setMailType(event.target.value); setPage(1) }} />
              </CCol>
              <CCol md={2}>
                <CFormSelect value={sendStatus} onChange={(event) => { setSendStatus(event.target.value); setPage(1) }}>
                  <option value=''>Tất cả trạng thái</option>
                  <option value='QUEUED'>QUEUED</option>
                  <option value='SENDING'>SENDING</option>
                  <option value='SENT'>SENT</option>
                  <option value='FAILED'>FAILED</option>
                  <option value='RETRYING'>RETRYING</option>
                  <option value='CANCELLED'>CANCELLED</option>
                </CFormSelect>
              </CCol>
              <CCol md={2}>
                <CFormInput type='date' value={fromDate} onChange={(event) => { setFromDate(event.target.value); setPage(1) }} />
              </CCol>
              <CCol md={2}>
                <CFormInput type='date' value={toDate} onChange={(event) => { setToDate(event.target.value); setPage(1) }} />
              </CCol>
              <CCol md={1}>
                <CFormSelect value={pageSize} onChange={(event) => { setPage(1); setPageSize(Number(event.target.value) || 20) }}>
                  <option value={20}>20</option>
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                </CFormSelect>
              </CCol>
              <CCol md={3} className='d-flex gap-2'>
                <CButton color='primary' onClick={applySearch} disabled={loading}>Lọc</CButton>
                <CButton color='secondary' variant='outline' onClick={resetFilters} disabled={loading}>Reset</CButton>
              </CCol>
            </CRow>

            {error ? <CAlert color='danger'>{error}</CAlert> : null}
            {successMessage ? <CAlert color='success'>{successMessage}</CAlert> : null}

            {loading ? (
              <div className='d-flex align-items-center gap-2'>
                <CSpinner size='sm' />
                <span>Đang tải mail logs...</span>
              </div>
            ) : (
              <>
                <CTable hover responsive align='middle'>
                  <CTableHead>
                    <CTableRow>
                      <CTableHeaderCell>ID</CTableHeaderCell>
                      <CTableHeaderCell>Mail type</CTableHeaderCell>
                      <CTableHeaderCell>To email</CTableHeaderCell>
                      <CTableHeaderCell>Send status</CTableHeaderCell>
                      <CTableHeaderCell>Attempts</CTableHeaderCell>
                      <CTableHeaderCell>Queued at</CTableHeaderCell>
                      <CTableHeaderCell>Sent at</CTableHeaderCell>
                      <CTableHeaderCell>Failed at</CTableHeaderCell>
                      <CTableHeaderCell>Last error</CTableHeaderCell>
                      <CTableHeaderCell className='text-end'>Actions</CTableHeaderCell>
                    </CTableRow>
                  </CTableHead>
                  <CTableBody>
                    {rows.length > 0 ? rows.map((item) => (
                      <CTableRow key={item.id}>
                        <CTableDataCell>{item.id}</CTableDataCell>
                        <CTableDataCell>
                          <div className='fw-semibold'>{item.mailType || '-'}</div>
                          {item?.tenant?.name ? <div className='small text-body-secondary'>{item.tenant.name}</div> : null}
                        </CTableDataCell>
                        <CTableDataCell>{item.toEmail || '-'}</CTableDataCell>
                        <CTableDataCell><CBadge color={getStatusColor(item.sendStatus)}>{item.sendStatus || '-'}</CBadge></CTableDataCell>
                        <CTableDataCell>{Number(item.attempts || 0)}</CTableDataCell>
                        <CTableDataCell>{formatDateTime(item.queuedAt)}</CTableDataCell>
                        <CTableDataCell>{formatDateTime(item.sentAt)}</CTableDataCell>
                        <CTableDataCell>{formatDateTime(item.failedAt)}</CTableDataCell>
                        <CTableDataCell title={item.lastError || ''}>{truncateText(item.lastError)}</CTableDataCell>
                        <CTableDataCell className='text-end'>
                          <div className='d-inline-flex gap-2 flex-wrap justify-content-end'>
                            <CButton size='sm' color='primary' variant='outline' onClick={() => handleViewDetail(item)}>
                              View detail
                            </CButton>
                            {canManage ? (
                              <CButton
                                size='sm'
                                color='info'
                                variant='outline'
                                disabled={!canSendNowStatus(item.sendStatus)}
                                onClick={() => openConfirm('sendNow', item)}
                              >
                                Send now
                              </CButton>
                            ) : null}
                            {canManage ? (
                              <CButton
                                size='sm'
                                color='warning'
                                variant='outline'
                                disabled={!canRequeueStatus(item.sendStatus)}
                                onClick={() => openConfirm('requeue', item)}
                              >
                                Requeue
                              </CButton>
                            ) : null}
                            {canManage ? (
                              <CButton size='sm' color='success' variant='outline' onClick={() => openConfirm('resend', item)}>
                                Resend
                              </CButton>
                            ) : null}
                            {canManage && canCancelStatus(item.sendStatus) ? (
                              <CButton size='sm' color='danger' variant='outline' onClick={() => openConfirm('cancel', item)}>
                                Cancel
                              </CButton>
                            ) : null}
                          </div>
                        </CTableDataCell>
                      </CTableRow>
                    )) : (
                      <CTableRow>
                        <CTableDataCell colSpan={10} className='text-center text-body-secondary'>Không có mail log phù hợp</CTableDataCell>
                      </CTableRow>
                    )}
                  </CTableBody>
                </CTable>

                <CPagination align='end' className='mb-0'>
                  <CPaginationItem disabled={page <= 1} onClick={() => setPage((currentPage) => Math.max(1, currentPage - 1))}>Trước</CPaginationItem>
                  {pages.map((item, index) => item === '...'
                    ? <CPaginationItem key={`ellipsis-${index}`} disabled>...</CPaginationItem>
                    : <CPaginationItem key={item} active={item === page} onClick={() => setPage(Number(item))}>{item}</CPaginationItem>)}
                  <CPaginationItem disabled={page >= pageCount} onClick={() => setPage((currentPage) => Math.min(pageCount, currentPage + 1))}>Sau</CPaginationItem>
                </CPagination>
              </>
            )}
          </CCardBody>
        </CCard>
      </CCol>

      <MailLogDetailModal visible={detailVisible} log={selectedLog} loading={detailLoading} onClose={() => setDetailVisible(false)} />

      <CModal visible={Boolean(confirmState)} onClose={() => !actionSubmitting && setConfirmState(null)}>
        <CModalHeader>
          <CModalTitle>{confirmState?.title || 'Xác nhận thao tác'}</CModalTitle>
        </CModalHeader>
        <CModalBody>{confirmState?.message || ''}</CModalBody>
        <CModalFooter>
          <CButton color='secondary' variant='outline' onClick={() => setConfirmState(null)} disabled={actionSubmitting}>Đóng</CButton>
          <CButton color='primary' onClick={handleConfirmAction} disabled={actionSubmitting}>
            {actionSubmitting ? 'Đang xử lý...' : 'Xác nhận'}
          </CButton>
        </CModalFooter>
      </CModal>

      <CModal visible={testModalVisible} onClose={() => !testSubmitting && setTestModalVisible(false)}>
        <CModalHeader>
          <CModalTitle>Send Test Mail</CModalTitle>
        </CModalHeader>
        <CModalBody>
          <CRow className='g-3'>
            <CCol xs={12}>
              <CFormInput
                type='email'
                label='Email người nhận'
                placeholder='name@example.com'
                value={testEmail}
                onChange={(event) => setTestEmail(event.target.value)}
              />
            </CCol>
            <CCol xs={12}>
              <CFormInput
                label='Subject'
                value={testSubject}
                onChange={(event) => setTestSubject(event.target.value)}
              />
            </CCol>
          </CRow>
        </CModalBody>
        <CModalFooter>
          <CButton color='secondary' variant='outline' onClick={() => setTestModalVisible(false)} disabled={testSubmitting}>Đóng</CButton>
          <CButton color='primary' onClick={handleSendTestMail} disabled={testSubmitting || !String(testEmail || '').trim()}>
            {testSubmitting ? 'Đang gửi...' : 'Đưa vào queue'}
          </CButton>
        </CModalFooter>
      </CModal>
    </CRow>
  )
}