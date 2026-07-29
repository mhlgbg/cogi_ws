import { useEffect, useMemo, useRef, useState } from 'react'
import { CAlert, CButton, CCard, CCardBody, CCardHeader } from '@coreui/react'
import {
  getApiErrorCode,
  getApiMessage,
  getQuickMessagePublicMessages,
  markQuickMessagePublicMessagesRead,
  sendQuickMessagePublicReply,
} from '../../modules/crm/services/quickMessagePublicService'
import QuickMessagePublicMessageList from './QuickMessagePublicMessageList'
import QuickMessagePublicReplyForm from './QuickMessagePublicReplyForm'

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

function isTokenExpiredCode(errorCode) {
  return errorCode === 'INVALID_PUBLIC_ACCESS_TOKEN' || errorCode === 'PUBLIC_ACCESS_REVOKED'
}

function isReplyClosedCode(errorCode) {
  return ['REPLY_DISABLED', 'ACCESS_LOCKED', 'ACCESS_CANCELLED', 'QUICK_MESSAGE_EXPIRED', 'MESSAGE_LOCKED', 'QUICK_MESSAGE_NOT_AVAILABLE'].includes(errorCode)
}

export default function QuickMessagePublicConversation({
  code,
  accessToken,
  initialReplyEnabled = false,
  draft = '',
  onDraftChange,
  onReauthenticate,
}) {
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [sending, setSending] = useState(false)
  const [messages, setMessages] = useState([])
  const [replyEnabled, setReplyEnabled] = useState(initialReplyEnabled === true)
  const [error, setError] = useState('')
  const [formError, setFormError] = useState('')
  const [tokenExpired, setTokenExpired] = useState(false)
  const [replyClosedMessage, setReplyClosedMessage] = useState('')
  const [pagination, setPagination] = useState(null)
  const lastMarkedRef = useRef('')

  const decoratedMessages = useMemo(
    () => (Array.isArray(messages) ? messages : []).map((message) => ({
      ...message,
      createdAtLabel: formatDateTime(message?.createdAt),
    })),
    [messages],
  )

  async function markReadIfNeeded(nextMessages, token) {
    const unreadAdminIds = (nextMessages || [])
      .filter((message) => message?.direction === 'incoming' && !message?.readAt)
      .map((message) => String(message.id || ''))
      .filter(Boolean)

    if (!unreadAdminIds.length) return
    const key = `${token}:${unreadAdminIds.join(',')}`
    if (lastMarkedRef.current === key) return
    lastMarkedRef.current = key

    try {
      const result = await markQuickMessagePublicMessagesRead(code, token)
      if (result?.readAt) {
        setMessages((current) => current.map((message) => (
          message?.direction === 'incoming' && !message?.readAt
            ? { ...message, readAt: result.readAt }
            : message
        )))
      }
    } catch (requestError) {
      const errorCode = getApiErrorCode(requestError)
      if (isTokenExpiredCode(errorCode)) {
        setTokenExpired(true)
        setError('Phiên truy cập đã hết hạn. Vui lòng xác thực lại để tiếp tục.')
      }
    }
  }

  async function loadMessages(options = {}) {
    if (!accessToken || initialReplyEnabled !== true) return
    const silent = options.silent === true
    if (silent) {
      setRefreshing(true)
    } else {
      setLoading(true)
    }
    setError('')

    try {
      const payload = await getQuickMessagePublicMessages(code, accessToken, { page: 1, pageSize: 100 })
      const nextMessages = Array.isArray(payload?.data) ? payload.data : []
      setMessages(nextMessages)
      setReplyEnabled(payload?.replyEnabled === true)
      setPagination(payload?.pagination || null)
      setReplyClosedMessage(payload?.replyEnabled === true ? '' : 'Thông điệp này hiện không còn nhận phản hồi.')
      setTokenExpired(false)
      await markReadIfNeeded(nextMessages, accessToken)
    } catch (requestError) {
      const errorCode = getApiErrorCode(requestError)
      if (isTokenExpiredCode(errorCode)) {
        setTokenExpired(true)
        setError('Phiên truy cập đã hết hạn. Vui lòng xác thực lại để tiếp tục.')
        return
      }
      if (isReplyClosedCode(errorCode)) {
        setReplyEnabled(false)
        setReplyClosedMessage(getApiMessage(requestError, 'Thông điệp này hiện không còn nhận phản hồi.'))
        return
      }
      setError(getApiMessage(requestError, 'Không thể tải trao đổi vào lúc này.'))
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => {
    if (!accessToken || initialReplyEnabled !== true) return
    void loadMessages({ silent: false })
  }, [accessToken, code, initialReplyEnabled])

  useEffect(() => {
    if (!accessToken || replyEnabled !== true || tokenExpired) return undefined
    const interval = window.setInterval(() => {
      if (document.visibilityState !== 'visible') return
      void loadMessages({ silent: true })
    }, 20000)

    return () => window.clearInterval(interval)
  }, [accessToken, code, replyEnabled, tokenExpired])

  async function handleSend() {
    const content = String(draft || '').trim()
    if (!content || sending || tokenExpired || !replyEnabled) return
    setSending(true)
    setFormError('')

    try {
      const result = await sendQuickMessagePublicReply(code, accessToken, { content })
      const createdMessage = result?.message || null
      if (createdMessage?.id) {
        setMessages((current) => {
          const exists = current.some((message) => String(message?.id) === String(createdMessage.id) && message?.source === createdMessage?.source)
          if (exists) return current
          return [
            ...current,
            {
              ...createdMessage,
              createdAtLabel: formatDateTime(createdMessage?.createdAt),
            },
          ]
        })
      }
      onDraftChange('')
    } catch (requestError) {
      const errorCode = getApiErrorCode(requestError)
      if (isTokenExpiredCode(errorCode)) {
        setTokenExpired(true)
        setFormError('Phiên truy cập đã hết hạn. Vui lòng xác thực lại để tiếp tục.')
        return
      }
      if (isReplyClosedCode(errorCode)) {
        setReplyEnabled(false)
        setReplyClosedMessage(getApiMessage(requestError, 'Thông điệp này hiện không còn nhận phản hồi.'))
        return
      }
      setFormError(getApiMessage(requestError, 'Không thể gửi phản hồi vào lúc này.'))
    } finally {
      setSending(false)
    }
  }

  if (initialReplyEnabled !== true) {
    return null
  }

  return (
    <CCard className='border-0 shadow-sm'>
      <CCardHeader className='d-flex justify-content-between align-items-center gap-2 flex-wrap'>
        <strong>Trao đổi</strong>
        <div className='d-flex align-items-center gap-2'>
          {pagination?.total ? <span className='small text-body-secondary'>{pagination.total} tin nhắn</span> : null}
          <CButton color='secondary' variant='outline' size='sm' onClick={() => void loadMessages({ silent: true })} disabled={loading || refreshing || tokenExpired}>
            {refreshing ? 'Đang làm mới...' : 'Làm mới'}
          </CButton>
        </div>
      </CCardHeader>
      <CCardBody className='d-flex flex-column gap-3'>
        {error ? <CAlert color='danger' className='mb-0'>{error}</CAlert> : null}
        {tokenExpired ? (
          <CAlert color='warning' className='mb-0'>
            <div className='mb-2'>Phiên truy cập đã hết hạn. Vui lòng xác thực lại để tiếp tục.</div>
            <CButton color='primary' size='sm' onClick={onReauthenticate}>Xác thực lại</CButton>
          </CAlert>
        ) : null}
        {replyClosedMessage ? <CAlert color='warning' className='mb-0'>{replyClosedMessage}</CAlert> : null}
        <div className='border rounded-4 p-3 bg-white' style={{ minHeight: 160 }}>
          <QuickMessagePublicMessageList loading={loading} messages={decoratedMessages} />
        </div>
        {replyEnabled && !tokenExpired ? (
          <QuickMessagePublicReplyForm
            value={draft}
            onChange={onDraftChange}
            onSubmit={() => void handleSend()}
            sending={sending}
            disabled={replyEnabled !== true || tokenExpired}
            error={formError}
          />
        ) : null}
      </CCardBody>
    </CCard>
  )
}