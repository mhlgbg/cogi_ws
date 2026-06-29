import { useEffect, useMemo, useRef, useState } from 'react'
import {
  CAlert,
  CBadge,
  CButton,
  CCard,
  CCardBody,
  CCardHeader,
  CCollapse,
  CFormInput,
  CFormTextarea,
  CLink,
  CSpinner,
} from '@coreui/react'
import { sanitizeHtml } from '../../../pages/journal/journalPublicUtils'
import { buildProtectedFileUrl, resolveMediaUrl } from '../../../utils/mediaUrl'
import {
  buildAdmissionV1FileTooLargeMessage,
  formatAdmissionV1FileSize,
  getAdmissionV1ConversationMessages,
  getAdmissionV1ErrorMessage,
  readAdmissionV1MaxFileSizeBytes,
  sendAdmissionV1ConversationMessage,
} from '../services/admissionV1Service'

const ADMISSION_V1_MAX_FILE_SIZE_BYTES = readAdmissionV1MaxFileSizeBytes()

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
  if (hasHtmlMarkup(raw)) return safe
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
  if (senderType === 'SYSTEM' || messageType === 'SYSTEM' || messageType === 'STATUS_NOTICE') return 'system'
  if (messageType === 'REQUEST_UPDATE' || messageType === 'SUPPLEMENT_FILE') return 'request-update'
  if (senderType === 'PARENT') return 'parent'
  return 'school'
}

function getSenderTypeLabel(message) {
  const senderType = String(message?.senderType || '').trim().toUpperCase()
  if (senderType === 'PARENT') return 'Phụ huynh'
  if (senderType === 'SYSTEM') return 'Hệ thống'
  return 'Nhà trường'
}

function getSelectedFileSummary(file) {
  if (!file) return ''
  const sizeInMb = Number(file.size || 0) / (1024 * 1024)
  return `${file.name} (${sizeInMb.toFixed(sizeInMb >= 10 ? 0 : 1)} MB)`
}

export default function AdmissionV1ConversationPanel({
  application,
  token,
  tenantCode,
  onApplicationChange,
  onMessagesChange,
  expanded: controlledExpanded,
  onToggle,
}) {
  const applicationId = Number(application?.id || 0)
  const unreadCount = Math.max(0, Number(application?.parentUnreadMessageCount || 0))
  const conversationStatus = String(application?.conversationStatus || '').trim().toLowerCase()
  const canAttachFiles = conversationStatus === 'need_update'
  const shouldAutoExpand = canAttachFiles || unreadCount > 0

  const [expanded, setExpanded] = useState(shouldAutoExpand)
  const [loading, setLoading] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const [messages, setMessages] = useState([])
  const [errorMessage, setErrorMessage] = useState('')
  const [draft, setDraft] = useState('')
  const [files, setFiles] = useState([])
  const [sending, setSending] = useState(false)
  const [sendError, setSendError] = useState('')
  const [fileInputKey, setFileInputKey] = useState(0)
  const interactedRef = useRef(false)
  const threadRef = useRef(null)
  const isControlled = typeof controlledExpanded === 'boolean'
  const isExpanded = isControlled ? controlledExpanded : expanded

  async function loadMessages() {
    if (!applicationId || !token) return

    setLoading(true)
    setErrorMessage('')

    try {
      const payload = await getAdmissionV1ConversationMessages(applicationId, token, tenantCode)
      const nextMessages = Array.isArray(payload?.messages) ? payload.messages : []
      setMessages(nextMessages)
      if (onMessagesChange) {
        onMessagesChange(nextMessages.length > 0)
      }
      if (payload?.application && onApplicationChange) {
        onApplicationChange(payload.application)
      }
      setLoaded(true)
    } catch (error) {
      setErrorMessage(getAdmissionV1ErrorMessage(error, 'Không tải được trao đổi với nhà trường'))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (isControlled) return
    if (interactedRef.current) return
    if (shouldAutoExpand) {
      setExpanded(true)
    }
  }, [isControlled, shouldAutoExpand])

  useEffect(() => {
    if (!isExpanded || !applicationId || !token) return

    let active = true

    async function loadMessagesWhenExpanded() {
      setLoading(true)
      setErrorMessage('')

      try {
        const payload = await getAdmissionV1ConversationMessages(applicationId, token, tenantCode)
        if (!active) return
        const nextMessages = Array.isArray(payload?.messages) ? payload.messages : []
        setMessages(nextMessages)
        if (onMessagesChange) {
          onMessagesChange(nextMessages.length > 0)
        }
        if (payload?.application && onApplicationChange) {
          onApplicationChange(payload.application)
        }
        setLoaded(true)
      } catch (error) {
        if (!active) return
        setErrorMessage(getAdmissionV1ErrorMessage(error, 'Không tải được trao đổi với nhà trường'))
      } finally {
        if (active) {
          setLoading(false)
        }
      }
    }

    loadMessagesWhenExpanded()

    return () => {
      active = false
    }
  }, [applicationId, isExpanded, onApplicationChange, onMessagesChange, tenantCode, token])

  const headerLabel = useMemo(() => {
    if (unreadCount > 0) {
      return `Trao đổi với nhà trường (${unreadCount} phản hồi mới)`
    }
    return 'Trao đổi với nhà trường'
  }, [unreadCount])

  const canSend = String(draft || '').trim() !== '' || files.length > 0

  function handleFileChange(event) {
    const nextFiles = Array.from(event.target.files || []).filter((file) => file instanceof File)
    const oversizedFile = nextFiles.find((file) => file.size > ADMISSION_V1_MAX_FILE_SIZE_BYTES)

    if (oversizedFile) {
      setFiles([])
      setSendError(buildAdmissionV1FileTooLargeMessage(oversizedFile.name, ADMISSION_V1_MAX_FILE_SIZE_BYTES))
      setFileInputKey((current) => current + 1)
      event.target.value = ''
      return
    }

    setFiles(nextFiles)
    if (sendError) {
      setSendError('')
    }
  }

  async function handleSend() {
    if (!applicationId || !token || sending || !canSend) return

    setSending(true)
    setSendError('')

    try {
      const payload = await sendAdmissionV1ConversationMessage(applicationId, token, {
        content: draft,
        attachments: files,
      }, tenantCode)

      if (payload?.application && onApplicationChange) {
        onApplicationChange(payload.application)
      }
      await loadMessages()
      setDraft('')
      setFiles([])
      setFileInputKey((current) => current + 1)
      if (threadRef.current) {
        threadRef.current.scrollTop = threadRef.current.scrollHeight
      }
    } catch (error) {
      setSendError(getAdmissionV1ErrorMessage(error, 'Không gửi được tin nhắn'))
    } finally {
      setSending(false)
    }
  }

  function handleToggle() {
    if (onToggle) {
      onToggle()
      return
    }

    interactedRef.current = true
    setExpanded((current) => !current)
  }

  return (
    <CCard className={`admission-v1-card ${unreadCount > 0 ? 'admission-v1-conversation--unread' : ''}`}>
      <CCardHeader className='bg-white border-0 p-4'>
        <div className='d-flex justify-content-between align-items-center gap-3 flex-wrap'>
          <div>
            <div className='fw-semibold fs-5'>💬 {headerLabel}</div>
            <div className={`small admission-v1-conversation-hint ${canAttachFiles ? 'admission-v1-conversation-hint--highlight' : 'text-body-secondary'}`}>
              {canAttachFiles
                ? 'Bạn có thể gửi tin nhắn và bổ sung minh chứng trong phần này.'
                : 'Bạn có thể gửi tin nhắn cho nhà trường. Minh chứng chỉ được gửi khi hồ sơ cần bổ sung.'}
            </div>
          </div>
          <div className='d-flex align-items-center gap-2 flex-wrap'>
            {unreadCount > 0 ? <CBadge color='warning'>{unreadCount} mới</CBadge> : null}
            <CButton
              color='dark'
              variant='outline'
              className='admission-v1-conversation-toggle'
              onClick={handleToggle}
            >
              {isExpanded ? 'Thu gọn ▲' : 'Mở trao đổi ▼'}
            </CButton>
          </div>
        </div>
      </CCardHeader>
      <CCollapse visible={isExpanded}>
        <CCardBody className='pt-0 p-4'>
          {errorMessage ? <CAlert color='danger'>{errorMessage}</CAlert> : null}

          <div ref={threadRef} className='admission-v1-conversation-thread'>
            {loading && !loaded ? (
              <div className='text-center py-4'>
                <CSpinner size='sm' />
              </div>
            ) : messages.length === 0 ? (
              <div className='text-body-secondary small'>Chưa có trao đổi nào với nhà trường.</div>
            ) : (
              messages.map((message) => {
                const variant = getMessageVariant(message)
                const html = formatMessageHtml(message?.content)

                return (
                  <div key={message.id || `${message.createdAt}-${message.senderType}`} className={`admission-v1-message admission-v1-message--${variant}`}>
                    <div className='admission-v1-message__meta'>
                      <span><span className='fw-semibold'>{getSenderName(message)}</span> · {getSenderTypeLabel(message)}</span>
                      <span>{formatDateTime(message?.createdAt)}</span>
                    </div>

                    {html ? <div className='admission-v1-message__content' dangerouslySetInnerHTML={{ __html: html }} /> : null}

                    {Array.isArray(message?.attachments) && message.attachments.length > 0 ? (
                      <div className='admission-v1-message__attachments'>
                        {message.attachments.map((attachment, index) => {
                          const attachmentUrl = buildProtectedFileUrl(attachment) || resolveMediaUrl(attachment?.url)
                          const attachmentName = attachment?.name || `Tệp đính kèm ${index + 1}`
                          const mime = String(attachment?.mime || '').trim().toLowerCase()
                          const isImage = mime.startsWith('image/')

                          return (
                            <div key={`${attachmentUrl}-${index}`} className='admission-v1-message__attachment'>
                              {isImage && attachmentUrl ? <img src={attachmentUrl} alt={attachmentName} className='admission-v1-message__attachment-preview' /> : null}
                              {attachmentUrl ? (
                                <CLink href={attachmentUrl} target='_blank' rel='noreferrer'>
                                  {attachmentName}
                                </CLink>
                              ) : (
                                <span>{attachmentName}</span>
                              )}
                            </div>
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

          <div className='admission-v1-conversation-compose'>
            <CFormTextarea
              rows={4}
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              placeholder='Nhập nội dung trao đổi với nhà trường hoặc tên minh chứng nếu là bổ sung minh chứng, sau đó tải minh chứng ở phía dưới.'
              disabled={sending}
            />

            {canAttachFiles ? (
              <>
                <CFormInput
                  key={fileInputKey}
                  type='file'
                  accept='image/*,.pdf,application/pdf'
                  multiple
                  disabled={sending}
                  onChange={handleFileChange}
                />
                <div className='text-body-secondary small'>Bạn có thể gửi minh chứng bổ sung hoặc thay thế tại đây. Mỗi tệp tối đa {formatAdmissionV1FileSize(ADMISSION_V1_MAX_FILE_SIZE_BYTES)}.</div>
              </>
            ) : (
              <div className='text-body-secondary small'>Phụ huynh chỉ có thể gửi bổ sung minh chứng khi hồ sơ ở trạng thái cần bổ sung.</div>
            )}

            {files.length > 0 ? (
              <div className='admission-v1-selected-files'>
                {files.map((file) => (
                  <div key={`${file.name}-${file.lastModified}`}>{getSelectedFileSummary(file)}</div>
                ))}
              </div>
            ) : null}

            <div className='d-flex justify-content-end'>
              <CButton color='success' onClick={handleSend} disabled={sending || !canSend}>
                {sending ? 'Đang gửi...' : 'Gửi trao đổi'}
              </CButton>
            </div>
          </div>
        </CCardBody>
      </CCollapse>
    </CCard>
  )
}