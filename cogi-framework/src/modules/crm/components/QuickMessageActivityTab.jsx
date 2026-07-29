import { useEffect, useMemo, useRef, useState } from 'react'
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
  CNav,
  CNavItem,
  CNavLink,
  CPagination,
  CPaginationItem,
  CRow,
  CSpinner,
} from '@coreui/react'
import {
  createQuickMessageActivityMessage,
  getApiMessage,
  getQuickMessageActivityAccessDetail,
  listQuickMessageActivityAccesses,
  listQuickMessageActivityLogs,
  listQuickMessageActivityMessages,
  markQuickMessageActivityRead,
} from '../services/quickMessageService'

function SummaryCard({ label, value }) {
  return (
    <CCard className='border-0 bg-light h-100'>
      <CCardBody>
        <div className='small text-body-secondary'>{label}</div>
        <div className='fs-4 fw-semibold'>{value}</div>
      </CCardBody>
    </CCard>
  )
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
  }).format(date)
}

function buildPages(currentPage, pageCount) {
  const maxButtons = 7
  if (pageCount <= maxButtons) {
    return Array.from({ length: pageCount }, (_, index) => index + 1)
  }

  const pages = [1]
  const left = Math.max(2, currentPage - 1)
  const right = Math.min(pageCount - 1, currentPage + 1)
  if (left > 2) pages.push('ellipsis-left')
  for (let index = left; index <= right; index += 1) pages.push(index)
  if (right < pageCount - 1) pages.push('ellipsis-right')
  pages.push(pageCount)
  return pages
}

function getAccessBadgeMeta(access) {
  const effectiveStatus = String(access?.effectiveStatus || '').trim().toLowerCase()
  const unreadCount = Number(access?.unreadCount || 0)
  if (effectiveStatus === 'cancelled') return { color: 'danger', label: 'Đã hủy' }
  if (effectiveStatus === 'locked') return { color: 'warning', label: 'Đã khóa' }
  if (effectiveStatus === 'expired') return { color: 'dark', label: access?.maxViews && Number(access?.viewCount || 0) >= Number(access?.maxViews || 0) ? 'Đạt giới hạn lượt xem' : 'Đã hết hạn' }
  if (unreadCount > 0) return { color: 'info', label: 'Có tin mới' }
  if (access?.latestReplyAt || access?.latestAdminMessageAt) return { color: 'primary', label: 'Đang trao đổi' }
  if (access?.hasBeenAccessed) return { color: 'success', label: 'Đã truy cập' }
  return { color: 'secondary', label: 'Chưa truy cập' }
}

function renderMessageBubble(item) {
  const isAdmin = String(item?.senderType || '').toUpperCase() === 'ADMIN'
  return (
    <div key={`${item?.source || 'message'}-${item?.id}`} className={`d-flex mb-3 ${isAdmin ? 'justify-content-end' : 'justify-content-start'}`}>
      <div className={`rounded-4 px-3 py-2 ${isAdmin ? 'bg-primary text-white' : 'bg-light text-body'}`} style={{ maxWidth: '80%' }}>
        <div className='small fw-semibold mb-1'>{item?.senderDisplayName || (isAdmin ? 'Quản trị viên' : 'Người nhận')}</div>
        <div style={{ whiteSpace: 'pre-wrap' }}>{item?.content || '-'}</div>
        <div className={`small mt-2 ${isAdmin ? 'text-white-50' : 'text-body-secondary'}`}>{formatDateTime(item?.createdAt)}</div>
      </div>
    </div>
  )
}

export default function QuickMessageActivityTab({ message = null, summary = {} }) {
  const [listLoading, setListLoading] = useState(true)
  const [detailLoading, setDetailLoading] = useState(false)
  const [threadLoading, setThreadLoading] = useState(false)
  const [logsLoading, setLogsLoading] = useState(false)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')
  const [rows, setRows] = useState([])
  const [pagination, setPagination] = useState({ page: 1, pageSize: 10, total: 0, pageCount: 1 })
  const [filters, setFilters] = useState({ search: '', status: '' })
  const [searchDraft, setSearchDraft] = useState('')
  const [selectedAccessId, setSelectedAccessId] = useState(null)
  const [selectedAccessDetail, setSelectedAccessDetail] = useState(null)
  const [messages, setMessages] = useState([])
  const [messagesPagination, setMessagesPagination] = useState({ page: 1, pageSize: 100, total: 0, pageCount: 1 })
  const [logs, setLogs] = useState([])
  const [logsPagination, setLogsPagination] = useState({ page: 1, pageSize: 20, total: 0, pageCount: 1 })
  const [composeValue, setComposeValue] = useState('')
  const [activeSubtab, setActiveSubtab] = useState('conversation')
  const [mobileShowDetail, setMobileShowDetail] = useState(false)
  const lastReadRef = useRef('')
  const threadRef = useRef(null)

  async function loadAccesses(nextPage = pagination.page, nextPageSize = pagination.pageSize, nextFilters = filters) {
    setListLoading(true)
    setError('')
    try {
      const payload = await listQuickMessageActivityAccesses(message?.id || message?.documentId, {
        page: nextPage,
        pageSize: nextPageSize,
        search: nextFilters.search || undefined,
        status: nextFilters.status || undefined,
      })
      const nextRows = Array.isArray(payload?.data) ? payload.data : []
      const nextPagination = payload?.pagination || {}
      setRows(nextRows)
      setPagination({
        page: Number(nextPagination.page || nextPage) || 1,
        pageSize: Number(nextPagination.pageSize || nextPageSize) || 10,
        total: Number(nextPagination.total || 0),
        pageCount: Number(nextPagination.pageCount || 1) || 1,
      })
      if (nextRows.length > 0) {
        setSelectedAccessId((current) => current && nextRows.some((item) => String(item.id) === String(current)) ? current : nextRows[0].id)
      } else {
        setSelectedAccessId(null)
        setSelectedAccessDetail(null)
      }
    } catch (requestError) {
      setRows([])
      setSelectedAccessId(null)
      setSelectedAccessDetail(null)
      setError(getApiMessage(requestError, 'Không tải được danh sách mã truy cập.'))
    } finally {
      setListLoading(false)
    }
  }

  async function loadSelectedAccess(accessId) {
    if (!accessId) return
    setDetailLoading(true)
    try {
      const payload = await getQuickMessageActivityAccessDetail(message?.id || message?.documentId, accessId)
      setSelectedAccessDetail(payload?.access || null)
    } catch (requestError) {
      setSelectedAccessDetail(null)
      setError(getApiMessage(requestError, 'Không tải được chi tiết mã truy cập.'))
    } finally {
      setDetailLoading(false)
    }
  }

  async function loadMessages(accessId) {
    if (!accessId) return
    setThreadLoading(true)
    try {
      const payload = await listQuickMessageActivityMessages(message?.id || message?.documentId, accessId, { page: 1, pageSize: 100 })
      setMessages(Array.isArray(payload?.data) ? payload.data : [])
      setMessagesPagination(payload?.pagination || { page: 1, pageSize: 100, total: 0, pageCount: 1 })
    } catch (requestError) {
      setMessages([])
      setError(getApiMessage(requestError, 'Không tải được trao đổi.'))
    } finally {
      setThreadLoading(false)
    }
  }

  async function loadLogs(accessId) {
    if (!accessId) return
    setLogsLoading(true)
    try {
      const payload = await listQuickMessageActivityLogs(message?.id || message?.documentId, accessId, { page: 1, pageSize: 20 })
      setLogs(Array.isArray(payload?.data) ? payload.data : [])
      setLogsPagination(payload?.pagination || { page: 1, pageSize: 20, total: 0, pageCount: 1 })
    } catch (requestError) {
      setLogs([])
      setError(getApiMessage(requestError, 'Không tải được lịch sử truy cập.'))
    } finally {
      setLogsLoading(false)
    }
  }

  async function markSelectedRead(accessId, unreadCount) {
    if (!accessId || Number(unreadCount || 0) <= 0) return
    const readKey = `${accessId}:${unreadCount}`
    if (lastReadRef.current === readKey) return
    lastReadRef.current = readKey
    try {
      await markQuickMessageActivityRead(message?.id || message?.documentId, accessId)
      await Promise.all([loadAccesses(pagination.page, pagination.pageSize, filters), loadSelectedAccess(accessId), loadMessages(accessId)])
    } catch {
      // best effort; keep UI responsive and avoid infinite retries
    }
  }

  useEffect(() => {
    if (!message?.id && !message?.documentId) return
    loadAccesses(1, pagination.pageSize, filters)
  }, [message?.id, message?.documentId])

  useEffect(() => {
    if (!selectedAccessId) return
    void loadSelectedAccess(selectedAccessId)
    void loadMessages(selectedAccessId)
    void loadLogs(selectedAccessId)
    setMobileShowDetail(true)
  }, [selectedAccessId])

  useEffect(() => {
    if (!selectedAccessId || !selectedAccessDetail?.unreadCount) return
    void markSelectedRead(selectedAccessId, selectedAccessDetail.unreadCount)
  }, [selectedAccessId, selectedAccessDetail?.unreadCount])

  useEffect(() => {
    if (!selectedAccessId) return undefined
    const interval = window.setInterval(() => {
      if (document.visibilityState !== 'visible') return
      void loadAccesses(pagination.page, pagination.pageSize, filters)
      void loadSelectedAccess(selectedAccessId)
      if (activeSubtab === 'conversation') {
        void loadMessages(selectedAccessId)
      }
      if (activeSubtab === 'logs') {
        void loadLogs(selectedAccessId)
      }
    }, 20000)
    return () => window.clearInterval(interval)
  }, [selectedAccessId, pagination.page, pagination.pageSize, filters, activeSubtab])

  useEffect(() => {
    if (!threadRef.current) return
    threadRef.current.scrollTop = threadRef.current.scrollHeight
  }, [messages.length])

  async function handleSendMessage() {
    const content = String(composeValue || '').trim()
    if (!content || sending || !selectedAccessId) return
    setSending(true)
    try {
      await createQuickMessageActivityMessage(message?.id || message?.documentId, selectedAccessId, { content })
      setComposeValue('')
      await Promise.all([loadMessages(selectedAccessId), loadAccesses(pagination.page, pagination.pageSize, filters), loadSelectedAccess(selectedAccessId)])
    } catch (requestError) {
      setError(getApiMessage(requestError, 'Không gửi được tin nhắn.'))
    } finally {
      setSending(false)
    }
  }

  const selectedRow = useMemo(() => rows.find((item) => String(item.id) === String(selectedAccessId)) || null, [rows, selectedAccessId])
  const accessBadgeMeta = getAccessBadgeMeta(selectedAccessDetail || selectedRow || null)
  const accessPages = useMemo(() => buildPages(pagination.page, pagination.pageCount), [pagination.page, pagination.pageCount])

  return (
    <>
      <CRow className='g-3 mb-4'>
        <CCol md={4}><SummaryCard label='Tổng lượt xem' value={summary.totalViewCount || 0} /></CCol>
        <CCol md={4}><SummaryCard label='Tổng phản hồi' value={summary.replyCount || 0} /></CCol>
        <CCol md={4}><SummaryCard label='Phản hồi chưa đọc' value={summary.unreadReplyCount || 0} /></CCol>
      </CRow>

      {error ? <CAlert color='danger'>{error}</CAlert> : null}

      <CRow className='g-4'>
        <CCol lg={4} className={mobileShowDetail ? 'd-none d-lg-block' : ''}>
          <CCard className='border-0 shadow-sm h-100'>
            <CCardHeader><strong>Danh sách mã truy cập</strong></CCardHeader>
            <CCardBody>
              <CRow className='g-3 mb-3'>
                <CCol xs={12}>
                  <CFormInput placeholder='Tìm theo mã hoặc người nhận' value={searchDraft} onChange={(event) => setSearchDraft(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') { const next = { ...filters, search: searchDraft.trim() }; setFilters(next); loadAccesses(1, pagination.pageSize, next); } }} />
                </CCol>
                <CCol xs={12}>
                  <CFormSelect value={filters.status} onChange={(event) => { const next = { ...filters, status: event.target.value }; setFilters(next); loadAccesses(1, pagination.pageSize, next); }}>
                    <option value=''>Tất cả</option>
                    <option value='not_accessed'>Chưa truy cập</option>
                    <option value='accessed'>Đã truy cập</option>
                    <option value='unread'>Có tin chưa đọc</option>
                    <option value='locked'>Đã khóa</option>
                    <option value='expired'>Hết hạn</option>
                  </CFormSelect>
                </CCol>
              </CRow>

              {listLoading ? (
                <div className='d-flex align-items-center gap-2'><CSpinner size='sm' />Đang tải danh sách...</div>
              ) : rows.length === 0 ? (
                <CAlert color='light' className='mb-0'>Không tìm thấy mã truy cập phù hợp.</CAlert>
              ) : (
                <div className='d-flex flex-column gap-2'>
                  {rows.map((item) => {
                    const meta = getAccessBadgeMeta(item)
                    const isActive = String(item.id) === String(selectedAccessId)
                    return (
                      <button
                        key={item.id}
                        type='button'
                        className={`text-start border rounded-4 p-3 bg-white ${isActive ? 'border-primary' : ''}`}
                        onClick={() => setSelectedAccessId(item.id)}
                      >
                        <div className='d-flex justify-content-between gap-2 align-items-start'>
                          <div>
                            <div className='fw-semibold'>{item.recipientName || item.code || 'Mã truy cập'}</div>
                            <div className='small text-body-secondary'>{item.code}</div>
                          </div>
                          <div className='d-flex align-items-center gap-2'>
                            {item.unreadCount > 0 ? <CBadge color='danger'>{item.unreadCount}</CBadge> : null}
                            <CBadge color={meta.color}>{meta.label}</CBadge>
                          </div>
                        </div>
                        <div className='small text-body-secondary mt-2'>Lượt mở: {item.viewCount || 0}</div>
                        <div className='small text-body-secondary'>Truy cập gần nhất: {formatDateTime(item.lastViewedAt)}</div>
                        <div className='small text-body-secondary'>Hoạt động gần nhất: {formatDateTime(item.lastInteractionAt)}</div>
                      </button>
                    )
                  })}
                </div>
              )}

              {pagination.pageCount > 1 ? (
                <CPagination className='mt-3 mb-0'>
                  {accessPages.map((item) => typeof item === 'string'
                    ? <CPaginationItem key={item} disabled>…</CPaginationItem>
                    : <CPaginationItem key={item} active={item === pagination.page} onClick={() => loadAccesses(item, pagination.pageSize, filters)}>{item}</CPaginationItem>)}
                </CPagination>
              ) : null}
            </CCardBody>
          </CCard>
        </CCol>

        <CCol lg={8} className={!mobileShowDetail ? 'd-none d-lg-block' : ''}>
          {!selectedAccessId ? (
            <CCard className='border-0 shadow-sm'>
              <CCardBody>
                <CAlert color='light' className='mb-0'>Quick Message chưa có mã truy cập hoặc chưa chọn mã nào.</CAlert>
              </CCardBody>
            </CCard>
          ) : (
            <CCard className='border-0 shadow-sm'>
              <CCardHeader className='d-flex justify-content-between align-items-center flex-wrap gap-2'>
                <div>
                  <strong>{selectedAccessDetail?.recipientName || selectedRow?.recipientName || 'Không xác định'}</strong>
                  <div className='small text-body-secondary'>{selectedAccessDetail?.code || selectedRow?.code || '-'}</div>
                </div>
                <div className='d-flex align-items-center gap-2'>
                  {mobileShowDetail ? <CButton color='secondary' variant='outline' className='d-lg-none' onClick={() => setMobileShowDetail(false)}>Quay lại danh sách</CButton> : null}
                  <CBadge color={accessBadgeMeta.color}>{accessBadgeMeta.label}</CBadge>
                </div>
              </CCardHeader>
              <CCardBody>
                {detailLoading ? (
                  <div className='d-flex align-items-center gap-2 mb-3'><CSpinner size='sm' />Đang tải chi tiết mã...</div>
                ) : selectedAccessDetail ? (
                  <CRow className='g-3 small mb-4'>
                    <CCol md={6}><strong>Mã truy cập:</strong> {selectedAccessDetail.code || '-'}</CCol>
                    <CCol md={6}><strong>Trạng thái:</strong> {accessBadgeMeta.label}</CCol>
                    <CCol md={6}><strong>Ngày tạo:</strong> {formatDateTime(selectedAccessDetail.createdAt)}</CCol>
                    <CCol md={6}><strong>Hết hạn:</strong> {formatDateTime(selectedAccessDetail.expiresAt)}</CCol>
                    <CCol md={6}><strong>Lần mở đầu:</strong> {formatDateTime(selectedAccessDetail.firstViewedAt)}</CCol>
                    <CCol md={6}><strong>Lần mở gần nhất:</strong> {formatDateTime(selectedAccessDetail.lastViewedAt)}</CCol>
                    <CCol md={6}><strong>Tổng lượt mở:</strong> {selectedAccessDetail.viewCount || 0}</CCol>
                    <CCol md={6}><strong>Hoạt động gần nhất:</strong> {formatDateTime(selectedAccessDetail.lastInteractionAt)}</CCol>
                    <CCol md={6}><strong>IP gần nhất:</strong> {selectedAccessDetail.lastIpAddress || '-'}</CCol>
                    <CCol md={6}><strong>Thiết bị/trình duyệt:</strong> {selectedAccessDetail.lastUserAgent || '-'}</CCol>
                  </CRow>
                ) : null}

                <CNav variant='tabs' className='mb-3'>
                  <CNavItem><CNavLink active={activeSubtab === 'conversation'} role='button' onClick={() => setActiveSubtab('conversation')}>Trao đổi {selectedAccessDetail?.unreadCount > 0 ? <CBadge color='danger' className='ms-2'>{selectedAccessDetail.unreadCount}</CBadge> : null}</CNavLink></CNavItem>
                  <CNavItem><CNavLink active={activeSubtab === 'logs'} role='button' onClick={() => setActiveSubtab('logs')}>Lịch sử truy cập</CNavLink></CNavItem>
                </CNav>

                {activeSubtab === 'conversation' ? (
                  <>
                    <div ref={threadRef} className='border rounded-4 p-3 mb-3 bg-light' style={{ minHeight: 280, maxHeight: 480, overflowY: 'auto' }}>
                      {threadLoading ? (
                        <div className='d-flex align-items-center gap-2'><CSpinner size='sm' />Đang tải trao đổi...</div>
                      ) : messages.length === 0 ? (
                        <CAlert color='light' className='mb-0'>Chưa có tin nhắn.</CAlert>
                      ) : messages.map(renderMessageBubble)}
                    </div>

                    <div className='border rounded-4 p-3'>
                      <CFormLabel htmlFor='quick-message-activity-compose'>Nội dung trao đổi</CFormLabel>
                      <CFormTextarea
                        id='quick-message-activity-compose'
                        rows={4}
                        value={composeValue}
                        onChange={(event) => setComposeValue(event.target.value)}
                        placeholder='Nhập nội dung cần gửi...'
                        onKeyDown={(event) => {
                          if (event.key === 'Enter' && !event.shiftKey) {
                            event.preventDefault()
                            void handleSendMessage()
                          }
                        }}
                        disabled={sending}
                      />
                      <div className='d-flex justify-content-between align-items-center mt-2 flex-wrap gap-2'>
                        <div className='small text-body-secondary'>Chưa triển khai tệp đính kèm.</div>
                        <CButton color='primary' onClick={() => void handleSendMessage()} disabled={sending || !String(composeValue || '').trim()}>
                          {sending ? 'Đang gửi...' : 'Gửi tin nhắn'}
                        </CButton>
                      </div>
                    </div>
                  </>
                ) : null}

                {activeSubtab === 'logs' ? (
                  <div className='border rounded-4 p-3 bg-light'>
                    {logsLoading ? (
                      <div className='d-flex align-items-center gap-2'><CSpinner size='sm' />Đang tải lịch sử truy cập...</div>
                    ) : logs.length === 0 ? (
                      <CAlert color='light' className='mb-0'>Chưa có lịch sử truy cập.</CAlert>
                    ) : (
                      <div className='d-flex flex-column gap-3'>
                        {logs.map((item) => (
                          <div key={item.id} className='border rounded-4 bg-white p-3'>
                            <div className='d-flex justify-content-between align-items-start gap-2 flex-wrap'>
                              <div>
                                <div className='fw-semibold'>{item.eventLabel || item.eventType}</div>
                                <div className='small text-body-secondary'>{formatDateTime(item.createdAt)}</div>
                              </div>
                              <CBadge color={item.success ? 'success' : 'danger'}>{item.success ? 'Thành công' : 'Thất bại'}</CBadge>
                            </div>
                            <div className='small text-body-secondary mt-2'>IP: {item.ipAddress || '-'}</div>
                            <div className='small text-body-secondary'>Thiết bị: {item.userAgent || '-'}</div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ) : null}
              </CCardBody>
            </CCard>
          )}
        </CCol>
      </CRow>
    </>
  )
}