import React, { useEffect, useRef, useState } from 'react'
import api from '../api/axios'

const FLOATING_STYLE = { position: 'fixed', right: '16px', bottom: '16px', zIndex: 99999 }

function formatDateTime(value) {
  if (!value) return ''
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleString()
}

export default function EmbedChatWidget({ tenantCode = '', tenantSlug = '', title = 'Chat cùng' }) {
  const [isOpen, setIsOpen] = useState(false)
  const [sessionId, setSessionId] = useState('')
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [widgetVisible, setWidgetVisible] = useState(true)
  const [widgetOffline, setWidgetOffline] = useState(false)
  const messagesRef = useRef(null)


  useEffect(() => {
    if (!isOpen) return
    if (!sessionId) ensureSession()
  }, [isOpen])

  useEffect(() => {
    if (!messagesRef.current) return
    messagesRef.current.scrollTop = messagesRef.current.scrollHeight
  }, [messages, isOpen])

  async function ensureSession() {
    setLoading(true)
    try {
      const stored = localStorage.getItem(`publicChatSession_${tenantCode || tenantSlug || 'default'}`)
      if (stored) {
        setSessionId(stored)
        const resp = await api.get(`/public-chat/session/${encodeURIComponent(stored)}/messages`)
        const payload = resp?.data?.data || resp?.data || []
        if (payload && typeof payload === 'object' && !Array.isArray(payload)) {
          const msgs = Array.isArray(payload.messages) ? payload.messages : []
          setMessages(msgs)
          // keep sessionId cached for offline mode as well
        } else {
          setMessages(Array.isArray(payload) ? payload : [])
        }
        setLoading(false)
        return
      }

      const create = await api.post('/public-chat/session', {
        tenantCode: tenantCode || undefined,
        tenantSlug: tenantSlug || undefined,
        sourcePage: window.location.href,
      })
      const session = create?.data?.data?.session || create?.data || {}
      // handle OFFLINE widgetStatus
      const createPayload = create?.data?.data || create?.data || {}
      if (createPayload && typeof createPayload === 'object' && createPayload.widgetStatus === 'OFFLINE') {
        const sid = String(session?.id || '')
        if (sid) {
          setSessionId(sid)
          localStorage.setItem(`publicChatSession_${tenantCode || tenantSlug || 'default'}`, sid)
        }
        const msgs = Array.isArray(createPayload.messages) ? createPayload.messages : []
        setMessages(msgs)
        setLoading(false)
        return
      }
      const sid = String(session?.id || '')
      if (sid) {
        setSessionId(sid)
        localStorage.setItem(`publicChatSession_${tenantCode || tenantSlug || 'default'}`, sid)
        const msgs = create?.data?.data?.messages || []
        setMessages(Array.isArray(msgs) ? msgs : [])
      }
    } catch (e) {
      console.error('[COGIChat] ensureSession error', e)
      // if denied by server, show friendly message and clear cached session
      const status = e?.response?.status
      const msg = e?.response?.data?.message || e?.response?.data?.error || null
      if (status === 403) {
        const display = msg || 'Website này chưa được cấp quyền sử dụng chatbot.'
        const storageKey = `publicChatSession_${tenantCode || tenantSlug || 'default'}`
        localStorage.removeItem(storageKey)
        setSessionId('')
        setMessages([{ id: 'denied', role: 'assistant', content: display }])
      }
    } finally {
      setLoading(false)
    }
  }

  async function sendMessage() {
    const text = String(input || '').trim()
    if (!text || !sessionId) return
    try {
      setLoading(true)
      const resp = await api.post('/public-chat/message', { sessionId, content: text })
      const payload = resp?.data?.data || resp?.data || {}
      if (payload && typeof payload === 'object' && payload.widgetStatus === 'OFFLINE') {
        const msgs = Array.isArray(payload.messages) ? payload.messages : []
        setMessages(msgs)
      } else {
        const nextMessages = Array.isArray(payload?.messages) ? payload.messages : []
        setMessages(nextMessages)
      }
      setInput('')
    } catch (e) {
      console.error('[COGIChat] sendMessage error', e)
      const status = e?.response?.status
      const msg = e?.response?.data?.message || e?.response?.data?.error || null
      if (status === 403) {
        const display = msg || 'Website này chưa được cấp quyền sử dụng chatbot.'
        const storageKey = `publicChatSession_${tenantCode || tenantSlug || 'default'}`
        localStorage.removeItem(storageKey)
        setSessionId('')
        setMessages([{ id: 'denied', role: 'assistant', content: display }])
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div id="cogi-chat-root" className="cogi-chat-root">
      <div className="cogi-chat-widget" style={FLOATING_STYLE} aria-live="polite">
      {!widgetVisible ? null : (!isOpen ? (
        <button className="cogi-chat-toggle" onClick={() => setIsOpen(true)} aria-label="Open chat">
          <span className="cogi-chat-toggle-icon">💬</span>
        </button>
      ) : (
        <div className="cogi-chat-popup" role="dialog" aria-label={title}>
          <div className="cogi-chat-header">
            <div className="cogi-chat-title">{title || 'Chat'}</div>
            {widgetOffline ? <div className="cogi-chat-offline-badge">Tạm thời không trực tuyến</div> : null}
            <button className="cogi-chat-close" onClick={() => setIsOpen(false)} aria-label="Close">×</button>
          </div>

          <div className="cogi-chat-messages" ref={messagesRef}>
            {loading && messages.length === 0 ? <div className="cogi-chat-loading">Đang khởi tạo...</div> : null}
            {messages.length === 0 && !loading ? <div className="cogi-chat-empty">Chưa có tin nhắn.</div> : null}
            {messages.map((m) => {
              const role = String(m?.role || '').toLowerCase()
              const isUser = role === 'user'
              return (
                <div key={m?.id || Math.random()} className={`cogi-chat-row ${isUser ? 'is-user' : 'is-assistant'}`}>
                  <div className={`cogi-chat-bubble ${isUser ? 'user' : 'assistant'}`}>
                    <div className="cogi-chat-content">{m?.content}</div>
                    <div className="cogi-chat-meta">{formatDateTime(m?.createdAt)}</div>
                  </div>
                </div>
              )
            })}
          </div>

          <div className="cogi-chat-footer">
            <textarea className="cogi-chat-input" value={input} onChange={(e) => setInput(e.target.value)} placeholder="Nhập nội dung..." />
            <button className="cogi-chat-send" onClick={sendMessage} disabled={loading || !String(input).trim()}>Gửi</button>
          </div>
        </div>
      ))}
      </div>
    </div>
  )
}
