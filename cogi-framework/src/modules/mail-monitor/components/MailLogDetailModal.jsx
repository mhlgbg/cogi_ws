import { useEffect, useState } from 'react'
import {
  CBadge,
  CCol,
  CFormTextarea,
  CModal,
  CModalBody,
  CModalFooter,
  CModalHeader,
  CModalTitle,
  CNav,
  CNavItem,
  CNavLink,
  CRow,
  CSpinner,
} from '@coreui/react'

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

export default function MailLogDetailModal({ visible, log, loading, onClose }) {
  const [activeTab, setActiveTab] = useState('html')

  useEffect(() => {
    setActiveTab('html')
  }, [log?.id, visible])

  return (
    <CModal size='xl' visible={visible} onClose={onClose}>
      <CModalHeader>
        <CModalTitle>Chi tiết mail log {log?.id ? `#${log.id}` : ''}</CModalTitle>
      </CModalHeader>
      <CModalBody>
        {loading ? (
          <div className='d-flex align-items-center gap-2'>
            <CSpinner size='sm' />
            <span>Đang tải chi tiết...</span>
          </div>
        ) : log ? (
          <>
            <CRow className='g-3 mb-3'>
              <CCol md={8}>
                <div className='small text-body-secondary'>Subject</div>
                <div className='fw-semibold'>{log.subject || '-'}</div>
              </CCol>
              <CCol md={4}>
                <div className='small text-body-secondary'>Trạng thái</div>
                <CBadge color={getStatusColor(log.sendStatus)}>{log.sendStatus || '-'}</CBadge>
              </CCol>
              <CCol md={6}>
                <div className='small text-body-secondary'>To</div>
                <div>{log.toEmail || '-'}</div>
              </CCol>
              <CCol md={3}>
                <div className='small text-body-secondary'>CC</div>
                <div>{Array.isArray(log.cc) ? log.cc.join(', ') || '-' : log.cc || '-'}</div>
              </CCol>
              <CCol md={3}>
                <div className='small text-body-secondary'>BCC</div>
                <div>{Array.isArray(log.bcc) ? log.bcc.join(', ') || '-' : log.bcc || '-'}</div>
              </CCol>
              <CCol md={3}>
                <div className='small text-body-secondary'>Queued at</div>
                <div>{formatDateTime(log.queuedAt)}</div>
              </CCol>
              <CCol md={3}>
                <div className='small text-body-secondary'>Sent at</div>
                <div>{formatDateTime(log.sentAt)}</div>
              </CCol>
              <CCol md={3}>
                <div className='small text-body-secondary'>Failed at</div>
                <div>{formatDateTime(log.failedAt)}</div>
              </CCol>
              <CCol md={3}>
                <div className='small text-body-secondary'>Attempts</div>
                <div>{Number(log.attempts || 0)}</div>
              </CCol>
              <CCol md={6}>
                <div className='small text-body-secondary'>Provider</div>
                <div>{log.provider || '-'}</div>
              </CCol>
              <CCol md={6}>
                <div className='small text-body-secondary'>Provider message id</div>
                <div>{log.providerMessageId || '-'}</div>
              </CCol>
              <CCol xs={12}>
                <div className='small text-body-secondary'>Last error</div>
                <div className='text-danger'>{log.lastError || '-'}</div>
              </CCol>
              <CCol xs={12}>
                <div className='small text-body-secondary mb-1'>Metadata JSON</div>
                <pre className='bg-light border rounded p-3 mb-0 small' style={{ maxHeight: 240, overflow: 'auto' }}>
                  {JSON.stringify(log.metadata || {}, null, 2)}
                </pre>
              </CCol>
            </CRow>

            <CNav variant='tabs' className='mb-3'>
              <CNavItem>
                <CNavLink href='#' active={activeTab === 'html'} onClick={(event) => { event.preventDefault(); setActiveTab('html') }}>
                  HTML preview
                </CNavLink>
              </CNavItem>
              <CNavItem>
                <CNavLink href='#' active={activeTab === 'text'} onClick={(event) => { event.preventDefault(); setActiveTab('text') }}>
                  Text
                </CNavLink>
              </CNavItem>
            </CNav>

            {activeTab === 'html' ? (
              <div className='border rounded p-3 bg-light' style={{ minHeight: 200, maxHeight: 360, overflow: 'auto' }}>
                {log.html ? <div dangerouslySetInnerHTML={{ __html: log.html }} /> : <div className='text-body-secondary'>Không có HTML</div>}
              </div>
            ) : (
              <CFormTextarea rows={12} readOnly value={String(log.text || '')} />
            )}
          </>
        ) : (
          <div className='text-body-secondary'>Không có dữ liệu mail log.</div>
        )}
      </CModalBody>
      <CModalFooter>
        <button type='button' className='btn btn-secondary' onClick={onClose}>Đóng</button>
      </CModalFooter>
    </CModal>
  )
}