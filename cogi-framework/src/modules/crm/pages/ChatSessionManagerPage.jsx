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
  CFormLabel,
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
import ChatSessionDetailModal from '../components/ChatSessionDetailModal'
import { getChatSessions } from '../services/chatSessionService'

const STATUS_OPTIONS = [
  { value: '', label: 'ALL' },
  { value: 'OPEN', label: 'OPEN' },
  { value: 'CLOSED', label: 'CLOSED' },
]

const LEAD_STATUS_OPTIONS = [
  { value: '', label: 'ALL' },
  { value: 'NEW', label: 'NEW' },
  { value: 'CONTACTED', label: 'CONTACTED' },
  { value: 'CONVERTED', label: 'CONVERTED' },
  { value: 'IGNORED', label: 'IGNORED' },
]

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
  }).format(date)
}

function getStatusColor(status) {
  if (status === 'OPEN') return 'success'
  if (status === 'CLOSED') return 'secondary'
  return 'secondary'
}

function getLeadStatusColor(status) {
  if (status === 'NEW') return 'info'
  if (status === 'CONTACTED') return 'warning'
  if (status === 'CONVERTED') return 'success'
  if (status === 'IGNORED') return 'dark'
  return 'secondary'
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

export default function ChatSessionManagerPage() {
  const [loading, setLoading] = useState(false)
  const [rows, setRows] = useState([])
  const [pagination, setPagination] = useState({
    page: 1,
    pageSize: 20,
    total: 0,
    pageCount: 1,
  })
  const [keywordDraft, setKeywordDraft] = useState('')
  const [keyword, setKeyword] = useState('')
  const [statusDraft, setStatusDraft] = useState('')
  const [status, setStatus] = useState('')
  const [leadStatusDraft, setLeadStatusDraft] = useState('')
  const [leadStatus, setLeadStatus] = useState('')
  const [error, setError] = useState('')
  const [showDetailModal, setShowDetailModal] = useState(false)
  const [selectedSessionId, setSelectedSessionId] = useState(null)
  const [reloadToken, setReloadToken] = useState(0)

  const pages = useMemo(() => buildPages(pagination.page, pagination.pageCount), [pagination.page, pagination.pageCount])

  async function loadData({ page = pagination.page, pageSize = pagination.pageSize } = {}) {
    setLoading(true)
    setError('')

    try {
      const payload = await getChatSessions({
        keyword: keyword || undefined,
        status: status || undefined,
        leadStatus: leadStatus || undefined,
        page,
        pageSize,
      })

      setRows(Array.isArray(payload?.data) ? payload.data : [])
      setPagination({
        page: Number(payload?.pagination?.page || page),
        pageSize: Number(payload?.pagination?.pageSize || pageSize),
        total: Number(payload?.pagination?.total || 0),
        pageCount: Number(payload?.pagination?.pageCount || 1),
      })
    } catch (requestError) {
      setRows([])
      setPagination({ page: 1, pageSize: 20, total: 0, pageCount: 1 })
      setError(getApiMessage(requestError, 'Không tải được danh sách hội thoại'))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData({ page: 1, pageSize: pagination.pageSize })
  }, [keyword, status, leadStatus, reloadToken])

  function applyFilters() {
    setKeyword(String(keywordDraft || '').trim())
    setStatus(String(statusDraft || '').trim())
    setLeadStatus(String(leadStatusDraft || '').trim())
  }

  function resetFilters() {
    setKeywordDraft('')
    setKeyword('')
    setStatusDraft('')
    setStatus('')
    setLeadStatusDraft('')
    setLeadStatus('')
  }

  function handleOpenDetail(row) {
    if (!row?.id) return
    setSelectedSessionId(row.id)
    setShowDetailModal(true)
  }

  const fromToText = useMemo(() => {
    if (pagination.total === 0) return '0'
    const from = (pagination.page - 1) * pagination.pageSize + 1
    const to = Math.min(pagination.page * pagination.pageSize, pagination.total)
    return `${from}-${to}/${pagination.total}`
  }, [pagination.page, pagination.pageSize, pagination.total])

  return (
    <CRow className='g-4'>
      <CCol xs={12}>
        <CCard>
          <CCardHeader className='d-flex justify-content-between align-items-center flex-wrap gap-3'>
            <strong>Hội thoại khách hàng</strong>
            <div className='d-flex gap-2'>
              <CButton color='secondary' variant='outline' onClick={() => setReloadToken((prev) => prev + 1)} disabled={loading}>Làm mới</CButton>
            </div>
          </CCardHeader>
          <CCardBody>
            <CRow className='g-3 mb-3'>
              <CCol md={5}>
                <CFormLabel>Từ khóa</CFormLabel>
                <CFormInput
                  placeholder='Tên, điện thoại, email, trang nguồn'
                  value={keywordDraft}
                  onChange={(event) => setKeywordDraft(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') applyFilters()
                  }}
                />
              </CCol>
              <CCol md={2}>
                <CFormLabel>Trạng thái</CFormLabel>
                <CFormSelect value={statusDraft} onChange={(event) => setStatusDraft(event.target.value)}>
                  {STATUS_OPTIONS.map((item) => <option key={item.value || 'ALL'} value={item.value}>{item.label}</option>)}
                </CFormSelect>
              </CCol>
              <CCol md={3}>
                <CFormLabel>Lead status</CFormLabel>
                <CFormSelect value={leadStatusDraft} onChange={(event) => setLeadStatusDraft(event.target.value)}>
                  {LEAD_STATUS_OPTIONS.map((item) => <option key={item.value || 'ALL'} value={item.value}>{item.label}</option>)}
                </CFormSelect>
              </CCol>
              <CCol md={2} className='d-flex align-items-end gap-2'>
                <CButton color='primary' className='w-100' onClick={applyFilters} disabled={loading}>Lọc</CButton>
                <CButton color='secondary' variant='outline' onClick={resetFilters} disabled={loading}>Xóa</CButton>
              </CCol>
            </CRow>

            {error ? <CAlert color='danger'>{error}</CAlert> : null}

            {loading ? (
              <div className='d-flex align-items-center gap-2'>
                <CSpinner size='sm' />
                <span>Đang tải hội thoại...</span>
              </div>
            ) : (
              <>
                <CTable hover responsive align='middle'>
                  <CTableHead>
                    <CTableRow>
                      <CTableHeaderCell>Khách</CTableHeaderCell>
                      <CTableHeaderCell>Điện thoại</CTableHeaderCell>
                      <CTableHeaderCell>Email</CTableHeaderCell>
                      <CTableHeaderCell>Trang nguồn</CTableHeaderCell>
                      <CTableHeaderCell>Trạng thái</CTableHeaderCell>
                      <CTableHeaderCell>Lead status</CTableHeaderCell>
                      <CTableHeaderCell>Tin nhắn mới nhất</CTableHeaderCell>
                      <CTableHeaderCell>Cập nhật lúc</CTableHeaderCell>
                      <CTableHeaderCell>Thao tác</CTableHeaderCell>
                    </CTableRow>
                  </CTableHead>
                  <CTableBody>
                    {rows.length > 0 ? rows.map((item) => (
                      <CTableRow key={item.id}>
                        <CTableDataCell>{item.visitorName || '-'}</CTableDataCell>
                        <CTableDataCell>{item.visitorPhone || '-'}</CTableDataCell>
                        <CTableDataCell>{item.visitorEmail || '-'}</CTableDataCell>
                        <CTableDataCell className='small'>{item.sourcePage || '-'}</CTableDataCell>
                        <CTableDataCell><CBadge color={getStatusColor(item.status)}>{item.status || '-'}</CBadge></CTableDataCell>
                        <CTableDataCell><CBadge color={getLeadStatusColor(item.leadStatus)}>{item.leadStatus || '-'}</CBadge></CTableDataCell>
                        <CTableDataCell className='small'>{item.latestMessage?.content || '-'}</CTableDataCell>
                        <CTableDataCell>{formatDateTime(item.updatedAt)}</CTableDataCell>
                        <CTableDataCell>
                          <CButton size='sm' color='info' variant='outline' onClick={() => handleOpenDetail(item)}>Xem</CButton>
                        </CTableDataCell>
                      </CTableRow>
                    )) : (
                      <CTableRow>
                        <CTableDataCell colSpan={9} className='text-center text-body-secondary'>Chưa có hội thoại nào</CTableDataCell>
                      </CTableRow>
                    )}
                  </CTableBody>
                </CTable>

                <div className='d-flex justify-content-between align-items-center flex-wrap gap-3 mt-3'>
                  <div className='text-body-secondary small'>Hiển thị {fromToText}</div>
                  <div className='d-flex align-items-center gap-2'>
                    <CFormSelect value={pagination.pageSize} onChange={(event) => loadData({ page: 1, pageSize: Number(event.target.value) || 20 })} style={{ width: 120 }}>
                      <option value={10}>10 / trang</option>
                      <option value={20}>20 / trang</option>
                      <option value={50}>50 / trang</option>
                    </CFormSelect>
                    <CPagination className='mb-0'>
                      <CPaginationItem disabled={pagination.page <= 1} onClick={() => loadData({ page: Math.max(1, pagination.page - 1), pageSize: pagination.pageSize })}>Trước</CPaginationItem>
                      {pages.map((item, index) => typeof item === 'string'
                        ? <CPaginationItem key={`dots-${index}`} disabled>…</CPaginationItem>
                        : <CPaginationItem key={item} active={item === pagination.page} onClick={() => loadData({ page: item, pageSize: pagination.pageSize })}>{item}</CPaginationItem>)}
                      <CPaginationItem disabled={pagination.page >= pagination.pageCount} onClick={() => loadData({ page: Math.min(pagination.pageCount, pagination.page + 1), pageSize: pagination.pageSize })}>Sau</CPaginationItem>
                    </CPagination>
                  </div>
                </div>
              </>
            )}
          </CCardBody>
        </CCard>
      </CCol>

      <ChatSessionDetailModal
        visible={showDetailModal}
        sessionId={selectedSessionId}
        onClose={() => {
          setShowDetailModal(false)
          setSelectedSessionId(null)
        }}
        onChanged={() => setReloadToken((prev) => prev + 1)}
      />
    </CRow>
  )
}
