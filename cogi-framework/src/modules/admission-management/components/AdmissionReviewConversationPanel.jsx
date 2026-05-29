import { useEffect, useMemo, useRef, useState } from 'react'
import {
  CAlert,
  CButton,
  CCard,
  CCardBody,
  CCardHeader,
  CFormInput,
  CFormTextarea,
  CLink,
  CSpinner,
} from '@coreui/react'
import { sanitizeHtml } from '../../../pages/journal/journalPublicUtils'
import { resolveMediaUrl } from '../../../utils/mediaUrl'
import { sendAdmissionReviewMessage, getAdmissionReviewMessages } from '../services/admissionManagementService'

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

function hasHtmlMarkup(value) {
  return /<[^>]+>/.test(String(value || ''))
}

function formatMessageHtml(value) {
  const raw = String(value || '').trim()
  if (!raw) return ''
  const safe = sanitizeHtml(raw)
  if (hasHtmlMarkup(raw)) {
    return safe
  }
  return safe.replace(/\n/g, '<br/>')
}

function getSenderName(message) {
  const user = message?.senderUser
  if (user?.fullName) return user.fullName
  if (user?.username) return user.username
  const senderType = String(message?.senderType || '').trim().toUpperCase()
  if (senderType === 'PARENT') return 'Phụ huynh'
  if (senderType === 'SYSTEM') return 'Hệ thống'
  return 'Nhà trường'
}

function getMessageVariant(message) {
  const senderType = String(message?.senderType || '').trim().toUpperCase()
  const messageType = String(message?.messageType || '').trim().toUpperCase()
  if (senderType === 'SYSTEM' || messageType === 'SYSTEM' || messageType === 'STATUS_NOTICE') {
    return 'system'
  }
  if (messageType === 'REQUEST_UPDATE') {
    return 'request-update'
  }
  if (senderType === 'PARENT') {
    return 'parent'
  }
  return 'school'
}

function isEmailMessage(message) {
  return String(message?.metadata?.channel || '').trim().toUpperCase() === 'EMAIL'
}

function getSelectedFileSummary(file) {
  if (!file) return ''
  const sizeInMb = Number(file.size || 0) / (1024 * 1024)
  return `${file.name} (${sizeInMb.toFixed(sizeInMb >= 10 ? 0 : 1)} MB)`
}

export default function AdmissionReviewConversationPanel({ applicationId, refreshKey = 0 }) {
  const [loading, setLoading] = useState(true)
  const [messages, setMessages] = useState([])
  const [loadError, setLoadError] = useState('')
  const [draft, setDraft] = useState('')
  const [files, setFiles] = useState([])
  const [sending, setSending] = useState(false)
  const [sendError, setSendError] = useState('')
  const [fileInputKey, setFileInputKey] = useState(0)
  const threadRef = useRef(null)

  async function loadMessages() {
    if (!applicationId) {
      setMessages([])
      setLoading(false)
      return
    }

    setLoading(true)
    setLoadError('')

    try {
      const data = await getAdmissionReviewMessages(applicationId)
      setMessages(Array.isArray(data) ? data : [])
    } catch (error) {
      setLoadError(getApiMessage(error, 'Không tải được hội thoại hồ sơ'))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    let active = true

    async function loadMessagesForEffect() {
      if (!applicationId) {
        setMessages([])
        setLoading(false)
        return
      }

      setLoading(true)
      setLoadError('')

      try {
        const data = await getAdmissionReviewMessages(applicationId)
        if (!active) return
        setMessages(Array.isArray(data) ? data : [])
      } catch (error) {
        if (!active) return
        setLoadError(getApiMessage(error, 'Không tải được hội thoại hồ sơ'))
      } finally {
        if (active) {
          setLoading(false)
        }
      }
    }

    loadMessagesForEffect()

    return () => {
      active = false
    }
  }, [applicationId, refreshKey])

  const canSend = useMemo(() => String(draft || '').trim() !== '' || files.length > 0, [draft, files.length])

  async function handleSend() {
    if (!applicationId || sending || !canSend) return

    setSending(true)
    setSendError('')

    try {
      await sendAdmissionReviewMessage(applicationId, {
        content: draft,
        attachments: files,
      })
      await loadMessages()
      setDraft('')
      setFiles([])
      setFileInputKey((current) => current + 1)
      if (threadRef.current) {
        threadRef.current.scrollTop = threadRef.current.scrollHeight
      }
    } catch (error) {
      setSendError(getApiMessage(error, 'Không gửi được tin nhắn'))
    } finally {
      setSending(false)
    }
  }

  return (
    <CCard className='border-0 shadow-sm'>
      <CCardHeader className='bg-white border-0 fw-semibold'>Trao đổi với phụ huynh</CCardHeader>
      <CCardBody>
        {loadError ? <CAlert color='danger'>{loadError}</CAlert> : null}

        <div ref={threadRef} className='admission-review-conversation-thread'>
          {loading ? (
            <div className='text-center py-4'>
              <CSpinner size='sm' />
            </div>
          ) : messages.length === 0 ? (
            <div className='text-body-secondary small'>Chưa có trao đổi nào cho hồ sơ này.</div>
          ) : (
            messages.map((message) => {
              const variant = getMessageVariant(message)
              const html = formatMessageHtml(message?.content)

              return (
                <div
                  key={message.id || `${message.createdAt}-${Math.random()}`}
                  className={`admission-review-message admission-review-message--${variant}`}
                >
                  <div className='admission-review-message__meta'>
                    <span className='fw-semibold'>{getSenderName(message)}</span>
                    <span>{formatDateTime(message?.createdAt)}</span>
                  </div>

                  {isEmailMessage(message) ? (
                    <div className='admission-review-message__channel'>
                      <span className='admission-review-message__channel-icon'>✉</span>
                      <span>Đã gửi email tới phụ huynh</span>
                      {message?.metadata?.subject ? <span className='text-body-secondary'>· {message.metadata.subject}</span> : null}
                    </div>
                  ) : null}

                  {html ? (
                    <div
                      className='admission-review-message__content'
                      dangerouslySetInnerHTML={{ __html: html }}
                    />
                  ) : null}

                  {Array.isArray(message?.attachments) && message.attachments.length > 0 ? (
                    <div className='admission-review-message__attachments'>
                      {message.attachments.map((attachment, index) => {
                        const attachmentUrl = resolveMediaUrl(attachment?.url)
                        const attachmentName = attachment?.name || `Tệp đính kèm ${index + 1}`

                        return attachmentUrl ? (
                          <CLink
                            key={`${attachment?.url || attachment?.name || 'attachment'}-${index}`}
                            href={attachmentUrl}
                            target='_blank'
                            rel='noreferrer'
                          >
                            {attachmentName}
                          </CLink>
                        ) : (
                          <span key={`${attachment?.name || 'attachment'}-${index}`}>{attachmentName}</span>
                        )
                      })}
                    </div>
                  ) : null}
                </div>
              )
            })
          )}
        </div>

        {sendError ? <CAlert color='danger' className='mt-3 mb-0'>{sendError}</CAlert> : null}

        <div className='admission-review-conversation-compose'>
          <CFormTextarea
            rows={4}
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            placeholder='Nhập nội dung trao đổi với phụ huynh'
            disabled={sending}
          />

          <CFormInput
            key={fileInputKey}
            type='file'
            accept='image/*,.pdf,application/pdf'
            multiple
            disabled={sending}
            onChange={(event) => {
              const nextFiles = Array.from(event.target.files || [])
              setFiles(nextFiles)
            }}
          />

          {files.length > 0 ? (
            <div className='admission-review-selected-files'>
              {files.map((file) => (
                <div key={`${file.name}-${file.lastModified}`}>{getSelectedFileSummary(file)}</div>
              ))}
            </div>
          ) : null}

          <div className='d-flex justify-content-end'>
            <CButton color='primary' onClick={handleSend} disabled={sending || !canSend}>
              {sending ? 'Đang gửi...' : 'Gửi tin nhắn'}
            </CButton>
          </div>
        </div>
      </CCardBody>
    </CCard>
  )
}