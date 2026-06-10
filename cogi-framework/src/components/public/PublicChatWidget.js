import { useEffect, useMemo, useRef, useState } from 'react'
import {
  CAlert,
  CButton,
  CCard,
  CCardBody,
  CCardHeader,
  CFormInput,
  CSpinner,
} from '@coreui/react'
import axios from '../../api/axios'

const DEFAULT_TITLE = 'Chat cùng COGI'

function normalizeText(value) {
  return String(value || '').trim()
}

function getApiMessage(error, fallback) {
  return error?.response?.data?.error?.message || error?.response?.data?.message || error?.message || fallback
}

function formatDateTime(value) {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return new Intl.DateTimeFormat('vi-VN', {
    hour: '2-digit',
    minute: '2-digit',
    day: '2-digit',
    month: '2-digit',
  }).format(date)
}

function getStorageKey(tenantCode, tenantSlug) {
  return `publicChatSessionId_${normalizeText(tenantCode || tenantSlug || 'default')}`
}

export default function PublicChatWidget({
  tenantCode = '',
  tenantSlug = '',
  title = DEFAULT_TITLE,
}) {
  const [isOpen, setIsOpen] = useState(false)
  const [initializing, setInitializing] = useState(false)
  const [sending, setSending] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const [sessionId, setSessionId] = useState('')
  const [messages, setMessages] = useState([])
  const [inputValue, setInputValue] = useState('')
  const messagesRef = useRef(null)

  const normalizedTenantCode = normalizeText(tenantCode)
  const normalizedTenantSlug = normalizeText(tenantSlug)
  const storageKey = useMemo(
    () => getStorageKey(normalizedTenantCode, normalizedTenantSlug),
    [normalizedTenantCode, normalizedTenantSlug],
  )

  useEffect(() => {
    if (!messagesRef.current) return
    messagesRef.current.scrollTop = messagesRef.current.scrollHeight
  }, [messages, isOpen])

  async function loadMessagesBySession(existingSessionId) {
    const response = await axios.get(`/public-chat/session/${encodeURIComponent(existingSessionId)}/messages`)
    const payload = response?.data?.data || response?.data || []
    return Array.isArray(payload) ? payload : []
  }

  async function createSession() {
    const response = await axios.post('/public-chat/session', {
      tenantCode: normalizedTenantCode || undefined,
      tenantSlug: normalizedTenantSlug || undefined,
      sourcePage: typeof window !== 'undefined' ? window.location.pathname : '',
    })
    const payload = response?.data?.data || response?.data || {}
    return {
      session: payload?.session || null,
      messages: Array.isArray(payload?.messages) ? payload.messages : [],
    }
  }

  async function ensureSession() {
    if (!normalizedTenantCode && !normalizedTenantSlug) {
      setErrorMessage('Không xác định được tenant để khởi tạo hội thoại.')
      return
    }

    setInitializing(true)
    setErrorMessage('')

    try {
      const storedSessionId = typeof window !== 'undefined' ? localStorage.getItem(storageKey) : ''
      if (storedSessionId) {
        try {
          const nextMessages = await loadMessagesBySession(storedSessionId)
          setSessionId(storedSessionId)
          setMessages(nextMessages)
          return
        } catch {
          if (typeof window !== 'undefined') {
            localStorage.removeItem(storageKey)
          }
          setSessionId('')
          setMessages([])
        }
      }

      const created = await createSession()
      const nextSessionId = String(created?.session?.id || '').trim()
      if (!nextSessionId) {
        throw new Error('Không thể khởi tạo hội thoại')
      }

      setSessionId(nextSessionId)
      setMessages(Array.isArray(created?.messages) ? created.messages : [])
      if (typeof window !== 'undefined') {
        localStorage.setItem(storageKey, nextSessionId)
      }
    } catch (error) {
      setErrorMessage(getApiMessage(error, 'Không thể khởi tạo hội thoại'))
    } finally {
      setInitializing(false)
    }
  }

  useEffect(() => {
    if (!isOpen) return
    if (sessionId) return
    ensureSession()
  }, [isOpen])

  async function handleSendMessage() {
    const content = normalizeText(inputValue)
    if (!content || !sessionId) return

    setSending(true)
    setErrorMessage('')

    try {
      const response = await axios.post('/public-chat/message', {
        sessionId,
        content,
      })
      const payload = response?.data?.data || response?.data || []
      setMessages(Array.isArray(payload) ? payload : [])
      setInputValue('')
    } catch (error) {
      setErrorMessage(getApiMessage(error, 'Không thể gửi tin nhắn'))
    } finally {
      setSending(false)
    }
  }

  function handleKeyDown(event) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault()
      handleSendMessage()
    }
  }

  if (!normalizedTenantCode && !normalizedTenantSlug) return null

  return (
    <div className='public-chat-widget'>
      {!isOpen ? (
        <CButton color='primary' className='public-chat-widget-toggle' onClick={() => setIsOpen(true)}>
          {title || DEFAULT_TITLE}
        </CButton>
      ) : (
        <CCard className='public-chat-widget-popup'>
          <CCardHeader className='d-flex justify-content-between align-items-center gap-2'>
            <strong>{title || DEFAULT_TITLE}</strong>
            <button type='button' className='public-chat-widget-close' onClick={() => setIsOpen(false)} aria-label='Đóng chat'>×</button>
          </CCardHeader>
          <CCardBody className='d-flex flex-column gap-3'>
            {errorMessage ? <CAlert color='danger' className='mb-0'>{errorMessage}</CAlert> : null}

            <div ref={messagesRef} className='public-chat-widget-messages'>
              {initializing ? (
                <div className='d-flex align-items-center gap-2'>
                  <CSpinner size='sm' />
                  <span>Đang khởi tạo hội thoại...</span>
                </div>
              ) : messages.length === 0 ? (
                <div className='text-body-secondary small'>Chưa có tin nhắn nào.</div>
              ) : messages.map((item, index) => {
                const role = normalizeText(item?.role).toLowerCase()
                const isUser = role === 'user'
                return (
                  <div key={item?.id || `${role}-${index}`} className={`d-flex ${isUser ? 'justify-content-end' : 'justify-content-start'}`}>
                    <div className={`public-chat-widget-bubble-wrap${isUser ? ' is-user' : ''}`}>
                      <div className='public-chat-widget-role'>{role || 'assistant'}</div>
                      <div className={`public-chat-widget-bubble${isUser ? ' is-user' : ''}`}>{item?.content || ''}</div>
                      <div className='public-chat-widget-time'>{formatDateTime(item?.createdAt)}</div>
                    </div>
                  </div>
                )
              })}
            </div>

            <div className='public-chat-widget-footer'>
              <CFormInput
                value={inputValue}
                onChange={(event) => setInputValue(event.target.value)}
                onKeyDown={handleKeyDown}
                placeholder='Nhập nội dung cần hỗ trợ...'
                disabled={initializing || sending || !sessionId}
              />
              <div className='d-flex justify-content-end'>
                <CButton color='primary' onClick={handleSendMessage} disabled={initializing || sending || !sessionId || !normalizeText(inputValue)}>
                  {sending ? 'Đang gửi...' : 'Gửi'}
                </CButton>
              </div>
            </div>
          </CCardBody>
        </CCard>
      )}
    </div>
  )
}
