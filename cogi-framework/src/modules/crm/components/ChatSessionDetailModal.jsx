import { useEffect, useMemo, useState } from 'react'
import {
  CAlert,
  CButton,
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
} from '@coreui/react'
import {
  getChatSessionDetail,
  sendChatSessionAdminReply,
  updateChatSession,
} from '../services/chatSessionService'

const STATUS_OPTIONS = ['OPEN', 'CLOSED']
const LEAD_STATUS_OPTIONS = ['NEW', 'CONTACTED', 'CONVERTED', 'IGNORED']

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

function normalizeFieldValue(value) {
  return String(value || '').trim()
}

function bubbleAlign(role) {
  return String(role || '').trim().toLowerCase() === 'user' ? 'justify-content-end' : 'justify-content-start'
}

function bubbleColor(role) {
  const normalized = String(role || '').trim().toLowerCase()
  if (normalized === 'user') return '#dbeafe'
  if (normalized === 'admin') return '#dcfce7'
  return '#f3f4f6'
}

function normalizeSessionPayload(payload) {
  return payload?.session || null
}

function normalizeMessagesPayload(payload) {
  return Array.isArray(payload?.messages) ? payload.messages : []
}

export default function ChatSessionDetailModal({
  visible,
  sessionId,
  onClose,
  onChanged,
}) {
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [replying, setReplying] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [session, setSession] = useState(null)
  const [messages, setMessages] = useState([])
  const [replyContent, setReplyContent] = useState('')
  const [form, setForm] = useState({
    visitorName: '',
    visitorPhone: '',
    visitorEmail: '',
    status: 'OPEN',
    leadStatus: 'NEW',
  })

  const messageCountText = useMemo(() => `${messages.length} tin nhắn`, [messages.length])

  useEffect(() => {
    if (!visible || !sessionId) return
    let cancelled = false

    async function loadDetail() {
      setLoading(true)
      setError('')
      setSuccess('')

      try {
        const payload = await getChatSessionDetail(sessionId)
        if (cancelled) return

        const nextSession = normalizeSessionPayload(payload)
        const nextMessages = normalizeMessagesPayload(payload)
        setSession(nextSession)
        setMessages(nextMessages)
        setForm({
          visitorName: normalizeFieldValue(nextSession?.visitorName),
          visitorPhone: normalizeFieldValue(nextSession?.visitorPhone),
          visitorEmail: normalizeFieldValue(nextSession?.visitorEmail),
          status: normalizeFieldValue(nextSession?.status || nextSession?.chatSessionStatus) || 'OPEN',
          leadStatus: normalizeFieldValue(nextSession?.leadStatus || nextSession?.chatLeadStatus) || 'NEW',
        })
      } catch (requestError) {
        if (cancelled) return
        setSession(null)
        setMessages([])
        setError(getApiMessage(requestError, 'Không tải được chi tiết hội thoại'))
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    loadDetail()

    return () => {
      cancelled = true
    }
  }, [visible, sessionId])

  async function handleSaveInfo() {
    if (!sessionId) return
    setSaving(true)
    setError('')
    setSuccess('')

    try {
      const nextSession = await updateChatSession(sessionId, {
        visitorName: normalizeFieldValue(form.visitorName),
        visitorPhone: normalizeFieldValue(form.visitorPhone),
        visitorEmail: normalizeFieldValue(form.visitorEmail),
        status: normalizeFieldValue(form.status),
        leadStatus: normalizeFieldValue(form.leadStatus),
      })

      setSession(nextSession || session)
      setSuccess('Lưu thông tin khách thành công')
      onChanged?.()
    } catch (requestError) {
      setError(getApiMessage(requestError, 'Không thể lưu thông tin khách'))
    } finally {
      setSaving(false)
    }
  }

  async function handleAdminReply() {
    if (!sessionId) return
    const content = normalizeFieldValue(replyContent)
    if (!content) {
      setError('Vui lòng nhập nội dung phản hồi')
      return
    }

    setReplying(true)
    setError('')
    setSuccess('')

    try {
      const payload = await sendChatSessionAdminReply(sessionId, { content })
      setSession(payload?.session || session)
      setMessages(normalizeMessagesPayload(payload))
      setReplyContent('')
      setSuccess('Đã gửi phản hồi admin')
      onChanged?.()
    } catch (requestError) {
      setError(getApiMessage(requestError, 'Không thể gửi phản hồi admin'))
    } finally {
      setReplying(false)
    }
  }

  return (
    <CModal visible={visible} onClose={() => !loading && !saving && !replying && onClose?.()} size='xl' backdrop='static'>
      <CModalHeader>
        <CModalTitle>Chi tiết hội thoại khách hàng</CModalTitle>
      </CModalHeader>
      <CModalBody style={{ maxHeight: '75vh', overflowY: 'auto' }}>
        {loading ? (
          <div className='d-flex align-items-center gap-2'>
            <CSpinner size='sm' />
            <span>Đang tải chi tiết hội thoại...</span>
          </div>
        ) : (
          <CRow className='g-4'>
            <CCol lg={4}>
              {error ? <CAlert color='danger'>{error}</CAlert> : null}
              {success ? <CAlert color='success'>{success}</CAlert> : null}
              <div className='border rounded p-3 h-100'>
                <div className='fw-semibold mb-3'>Thông tin khách</div>
                <div className='mb-3'>
                  <CFormLabel>Họ tên khách</CFormLabel>
                  <CFormInput value={form.visitorName} onChange={(event) => setForm((prev) => ({ ...prev, visitorName: event.target.value }))} disabled={saving || replying} />
                </div>
                <div className='mb-3'>
                  <CFormLabel>Điện thoại</CFormLabel>
                  <CFormInput value={form.visitorPhone} onChange={(event) => setForm((prev) => ({ ...prev, visitorPhone: event.target.value }))} disabled={saving || replying} />
                </div>
                <div className='mb-3'>
                  <CFormLabel>Email</CFormLabel>
                  <CFormInput value={form.visitorEmail} onChange={(event) => setForm((prev) => ({ ...prev, visitorEmail: event.target.value }))} disabled={saving || replying} />
                </div>
                <div className='mb-3'>
                  <CFormLabel>Trạng thái hội thoại</CFormLabel>
                  <CFormSelect value={form.status} onChange={(event) => setForm((prev) => ({ ...prev, status: event.target.value }))} disabled={saving || replying}>
                    {STATUS_OPTIONS.map((item) => <option key={item} value={item}>{item}</option>)}
                  </CFormSelect>
                </div>
                <div className='mb-3'>
                  <CFormLabel>Lead status</CFormLabel>
                  <CFormSelect value={form.leadStatus} onChange={(event) => setForm((prev) => ({ ...prev, leadStatus: event.target.value }))} disabled={saving || replying}>
                    {LEAD_STATUS_OPTIONS.map((item) => <option key={item} value={item}>{item}</option>)}
                  </CFormSelect>
                </div>
                <div className='mb-3'>
                  <CFormLabel>Trang nguồn</CFormLabel>
                  <CFormInput value={session?.sourcePage || '-'} readOnly />
                </div>
                <CButton color='primary' onClick={handleSaveInfo} disabled={saving || replying || loading}>
                  {saving ? 'Đang lưu...' : 'Lưu thông tin'}
                </CButton>
              </div>
            </CCol>
            <CCol lg={8}>
              <div className='border rounded p-3 h-100 d-flex flex-column'>
                <div className='d-flex justify-content-between align-items-center mb-3'>
                  <div className='fw-semibold'>Hội thoại</div>
                  <div className='small text-body-secondary'>{messageCountText}</div>
                </div>
                <div style={{ flex: 1, minHeight: 320, maxHeight: 420, overflowY: 'auto' }} className='d-flex flex-column gap-3 mb-3'>
                  {messages.length === 0 ? (
                    <div className='text-body-secondary'>Chưa có tin nhắn nào.</div>
                  ) : messages.map((item) => {
                    const role = normalizeFieldValue(item?.role).toLowerCase()
                    const isUser = role === 'user'
                    return (
                      <div key={item.id} className={`d-flex ${bubbleAlign(role)}`}>
                        <div style={{ maxWidth: '80%' }}>
                          <div className='small text-body-secondary mb-1'>{role || '-'}</div>
                          <div style={{ background: bubbleColor(role), borderRadius: 16, padding: '10px 14px', whiteSpace: 'pre-wrap' }}>
                            {item.content || ''}
                          </div>
                          <div className='small text-body-secondary mt-1'>{formatDateTime(item.createdAt)}</div>
                        </div>
                      </div>
                    )
                  })}
                </div>
                <div>
                  <CFormLabel>Phản hồi admin</CFormLabel>
                  <CFormTextarea rows={4} value={replyContent} onChange={(event) => setReplyContent(event.target.value)} disabled={replying || saving} />
                  <div className='mt-3 d-flex justify-content-end'>
                    <CButton color='success' onClick={handleAdminReply} disabled={replying || saving || loading}>
                      {replying ? 'Đang gửi...' : 'Gửi phản hồi'}
                    </CButton>
                  </div>
                </div>
              </div>
            </CCol>
          </CRow>
        )}
      </CModalBody>
      <CModalFooter>
        <CButton color='secondary' variant='outline' onClick={onClose} disabled={loading || saving || replying}>Đóng</CButton>
      </CModalFooter>
    </CModal>
  )
}
