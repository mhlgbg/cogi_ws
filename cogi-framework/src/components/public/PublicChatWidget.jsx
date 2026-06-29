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
import { useTenant } from '../../contexts/TenantContext'
// NOTE: PublicChatWidget now uses backend widget-status endpoint as single source of truth

// Leave default title empty so fallback uses tenant-specific displayTenantCode
const DEFAULT_TITLE = ''
const PUBLIC_CHAT_SESSION_STORAGE_VERSION = 'v2'
const FLOATING_WIDGET_STYLE = {
  position: 'fixed',
  right: '16px',
  bottom: '16px',
  zIndex: 1055,
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'flex-end',
  gap: '12px',
}

const COLLAPSED_TOGGLE_STYLE = {
  width: '92px',
  minWidth: '92px',
  maxWidth: '92px',
  height: '82px',
  minHeight: '82px',
  maxHeight: '82px',
  padding: '8px 6px 7px',
  borderRadius: '20px',
  display: 'inline-flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  gap: '6px',
  overflow: 'hidden',
  boxShadow: '0 10px 24px rgba(15, 23, 42, 0.18)',
}

const COLLAPSED_AVATAR_STYLE = {
  width: '40px',
  height: '40px',
  minWidth: '40px',
  minHeight: '40px',
  maxWidth: '40px',
  maxHeight: '40px',
  borderRadius: '8px',
  objectFit: 'contain',
  objectPosition: 'center top',
  background: 'rgba(255, 255, 255, 0.94)',
  display: 'block',
}

const COLLAPSED_LABEL_STYLE = {
  display: 'block',
  maxWidth: '100%',
  fontSize: '10px',
  lineHeight: 1.2,
  fontWeight: 700,
  whiteSpace: 'normal',
  textAlign: 'center',
}

const POPUP_STYLE = {
  position: 'fixed',
  right: '16px',
  bottom: '78px',
  width: 'min(360px, calc(100vw - 24px))',
  maxHeight: '70vh',
  borderRadius: '18px',
  overflow: 'hidden',
  background: '#ffffff',
  boxShadow: '0 18px 40px rgba(15, 23, 42, 0.22)',
  zIndex: 1056,
}

const POPUP_AVATAR_STYLE = {
  width: '36px',
  height: '36px',
  minWidth: '36px',
  minHeight: '36px',
  maxWidth: '36px',
  maxHeight: '36px',
  borderRadius: '8px',
  objectFit: 'cover',
  display: 'block',
  flexShrink: 0,
  marginTop: '1rem',
}

const POPUP_MESSAGES_STYLE = {
  flex: 1,
  minHeight: 0,
  overflowY: 'auto',
  display: 'flex',
  flexDirection: 'column',
  gap: '12px',
  paddingRight: '4px',
}

function normalizeText(value) {
  return String(value || '').trim()
}

function getApiMessage(error, fallback) {
  // Prefer server-provided message (new shape: { code, message })
  const serverMessage = error?.response?.data?.message || error?.response?.data?.error?.message;
  return serverMessage || fallback;
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

function normalizeSessionPayload(payload) {
  if (!payload || typeof payload !== 'object') return null
  return payload?.session || null
}

function normalizeMessagesPayload(payload) {
  if (!payload || typeof payload !== 'object') return []
  return Array.isArray(payload?.messages) ? payload.messages : []
}

function getStorageKey(tenantCode, tenantSlug) {
  return `publicChatSessionId_${PUBLIC_CHAT_SESSION_STORAGE_VERSION}_${normalizeText(tenantCode || tenantSlug || 'default')}`
}

function toInitials(input) {
  const text = normalizeText(input)
  if (!text) return 'C'
  const parts = text.split(/\s+/).slice(0, 2)
  return parts.map((part) => part.charAt(0).toUpperCase()).join('') || 'C'
}

function renderAvatar(chatAvatarUrl, tenantName, className = 'public-chat-widget-avatar', style) {
  if (chatAvatarUrl) {
    return <img src={chatAvatarUrl} alt={tenantName || 'COGI'} className={className} style={style} />
  }

  return <div className={`${className} public-chat-widget-avatar-fallback`} style={style}>{toInitials(tenantName)}</div>
}

export default function PublicChatWidget({
  tenantCode = '',
  tenantSlug = '',
  title = DEFAULT_TITLE,
}) {
  const tenant = useTenant()
  const [isOpen, setIsOpen] = useState(false)
  const [widgetVisible, setWidgetVisible] = useState(true)
  const [widgetOffline, setWidgetOffline] = useState(false)
  const [widgetConfig, setWidgetConfig] = useState(null)
  const [initializing, setInitializing] = useState(false)
  const [sending, setSending] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const [sessionId, setSessionId] = useState('')
  const [messages, setMessages] = useState([])
  const [inputValue, setInputValue] = useState('')
  const messagesRef = useRef(null)

  const normalizedTenantCode = normalizeText(tenantCode)
  const normalizedTenantSlug = normalizeText(tenantSlug)
  const displayTenantCode = normalizeText(tenant?.currentTenant?.tenantCode || tenant?.resolvedTenant?.tenantCode || normalizedTenantCode || normalizedTenantSlug || 'COGI').toUpperCase()
  const tenantName = normalizeText(tenant?.currentTenant?.tenantName || tenant?.resolvedTenant?.tenantName || tenant?.currentTenant?.tenantCode || tenant?.resolvedTenant?.tenantCode || 'COGI')
  const chatAvatarUrl = normalizeText(tenant?.currentTenant?.tenantChatAvatarUrl || tenant?.resolvedTenant?.tenantChatAvatarUrl)
  // Prefer explicit title prop (embed config) over tenant widgetTitle from backend
  const chatWindowTitle = title || widgetConfig?.widgetTitle || `Chat cùng ${displayTenantCode || 'COGI'}`
  const collapsedLabel = `Chat voi ${displayTenantCode}`
  const storageKey = useMemo(
    () => getStorageKey(normalizedTenantCode, normalizedTenantSlug),
    [normalizedTenantCode, normalizedTenantSlug],
  )

  // Load tenant chatWidgetConfig as single source of truth for widget behavior
  useEffect(() => {
    let cancelled = false

    async function loadConfig() {
      try {
        const effectiveTenantCode = normalizedTenantCode || normalizeText(tenant?.currentTenant?.tenantCode || tenant?.resolvedTenant?.tenantCode || '')
        // Call backend status endpoint which is the single source of truth for widget runtime behavior
        const params = {}
        if (normalizedTenantCode) params.tenantCode = normalizedTenantCode
        if (normalizedTenantSlug) params.tenantSlug = normalizedTenantSlug
        const response = await axios.get('/public-chat/widget-status', { params })
        if (cancelled) return
        const payload = response?.data?.data || response?.data || {}
        const finalConfig = payload || null
        setWidgetConfig(finalConfig)
        try {
          console.info('[PublicChatWidget] loaded chatWidgetConfig (from widget-status)', { effectiveTenantCode, configJson: JSON.stringify(finalConfig) })
        } catch (e) {
          console.info('[PublicChatWidget] loaded chatWidgetConfig (raw)', { effectiveTenantCode, finalConfig })
        }

        // Determine enabled/available from backend payload
        const enabled = finalConfig == null ? true : (finalConfig.enabled === true || String(finalConfig.enabled).toLowerCase() === 'true')
        const available = finalConfig == null ? true : (finalConfig.available === true || String(finalConfig.available).toLowerCase() === 'true')

        setWidgetVisible(enabled)
        setWidgetOffline(!available)
      } catch (err) {
        // keep previous defaults on failure; log for debugging
        console.error('[PublicChatWidget][loadConfig] error', err)
      }
    }

    loadConfig()

    return () => { cancelled = true }
  }, [normalizedTenantCode, normalizedTenantSlug, tenant?.currentTenant?.tenantCode, tenant?.resolvedTenant?.tenantCode])

  // Diagnostic render-time info
  useEffect(() => {
    console.info('[PublicChatWidget] render state', {
      normalizedTenantCode,
      normalizedTenantSlug,
      widgetVisible,
      widgetOffline,
      widgetConfig,
    })
  })

  useEffect(() => {
    if (!messagesRef.current) return
    messagesRef.current.scrollTop = messagesRef.current.scrollHeight
  }, [messages, isOpen])

  // If widget becomes disabled server-side, clear any stored session and close widget
  useEffect(() => {
    try {
      if (!widgetVisible) {
        setIsOpen(false)
        setSessionId('')
        if (typeof window !== 'undefined') {
          localStorage.removeItem(storageKey)
        }
      }
    } catch (e) {
      // ignore
    }
  }, [widgetVisible])



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
      session: normalizeSessionPayload(payload),
      messages: normalizeMessagesPayload(payload),
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
      // Respect server-side widgetStatus or client config
      if ((created && String(created.widgetStatus || '').toUpperCase() === 'OFFLINE') || (widgetConfig && String(widgetConfig.available).toLowerCase() !== 'true' && widgetConfig.available !== true)) {
        setWidgetOffline(true)
      } else {
        setWidgetOffline(false)
      }
      if (typeof window !== 'undefined') {
        localStorage.setItem(storageKey, nextSessionId)
      }
    } catch (error) {
      // log full error for debugging (status, response, stack)
      console.error('[PublicChatWidget][ensureSession] error', error)
      setErrorMessage(getApiMessage(error, 'Hiện chưa thể kết nối tới hệ thống tư vấn. Anh/Chị vui lòng thử lại sau.'))
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
      const payload = response?.data?.data || response?.data || {}
      const nextSession = normalizeSessionPayload(payload)
      const nextMessages = normalizeMessagesPayload(payload)

      if (nextSession?.id) {
        const nextSessionId = String(nextSession.id).trim()
        setSessionId(nextSessionId)
        if (typeof window !== 'undefined') {
          localStorage.setItem(storageKey, nextSessionId)
        }
      }

      setMessages(nextMessages)
      setInputValue('')
      // Respect server-side widgetStatus or client config
      if ((payload && String(payload.widgetStatus || '').toUpperCase() === 'OFFLINE') || (widgetConfig && String(widgetConfig.available).toLowerCase() !== 'true' && widgetConfig.available !== true)) {
        setWidgetOffline(true)
      } else {
        setWidgetOffline(false)
      }
    } catch (error) {
      console.error('[PublicChatWidget][handleSendMessage] error', error)
      setErrorMessage(getApiMessage(error, 'Hiện chưa thể kết nối tới hệ thống tư vấn. Anh/Chị vui lòng thử lại sau.'))
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
  if (!widgetVisible) return null

  return (
    <div className='public-chat-widget' style={FLOATING_WIDGET_STYLE}>
      {!isOpen ? (
        <CButton color='primary' className='public-chat-widget-toggle' style={COLLAPSED_TOGGLE_STYLE} onClick={() => setIsOpen(true)}>
          <span className='public-chat-widget-toggle-avatar-wrap'>
            {renderAvatar(chatAvatarUrl, tenantName, 'public-chat-widget-toggle-avatar', COLLAPSED_AVATAR_STYLE)}
          </span>
          <span className='public-chat-widget-toggle-label' style={COLLAPSED_LABEL_STYLE}>{collapsedLabel}</span>
        </CButton>
      ) : (
        <CCard className='public-chat-widget-popup' style={POPUP_STYLE}>
          <CCardHeader className='d-flex justify-content-between align-items-center gap-2'>
            <strong>{chatWindowTitle}</strong>
            {widgetOffline ? <span className='text-muted small'>Tạm thời không trực tuyến</span> : null}
            <button type='button' className='public-chat-widget-close' onClick={() => setIsOpen(false)} aria-label='Đóng chat'>×</button>
          </CCardHeader>
          <CCardBody className='d-flex flex-column gap-3' style={{ maxHeight: 'calc(70vh - 56px)', overflow: 'hidden' }}>
            {errorMessage ? <CAlert color='danger' className='mb-0'>{errorMessage}</CAlert> : null}

            <div ref={messagesRef} className='public-chat-widget-messages' style={POPUP_MESSAGES_STYLE}>
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
                const showAvatar = !isUser
                return (
                  <div key={item?.id || `${role}-${index}`} className={`d-flex ${isUser ? 'justify-content-end' : 'justify-content-start'}`}>
                    <div className={`public-chat-widget-message-row${isUser ? ' is-user' : ''}`}>
                      {showAvatar ? (
                        renderAvatar(chatAvatarUrl, tenantName, 'public-chat-widget-avatar', POPUP_AVATAR_STYLE)
                      ) : null}
                      <div className={`public-chat-widget-bubble-wrap${isUser ? ' is-user' : ''}`}>
                        <div className='public-chat-widget-role'>{role || 'assistant'}</div>
                        <div className={`public-chat-widget-bubble${isUser ? ' is-user' : ''}`}>{item?.content || ''}</div>
                        <div className='public-chat-widget-time'>{formatDateTime(item?.createdAt)}</div>
                      </div>
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
