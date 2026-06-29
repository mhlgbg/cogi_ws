import React from 'react'
import { createRoot } from 'react-dom/client'
import PublicChatWidget from '../components/public/PublicChatWidget.jsx'

function ensureContainer(containerId) {
  let el = document.getElementById(containerId)
  if (!el) {
    el = document.createElement('div')
    el.id = containerId
    document.body.appendChild(el)
  }
  return el
}

function mountWidget(options = {}) {
  const tenantCode = String(options.tenantCode || '').trim()
  const tenantSlug = String(options.tenantSlug || '').trim()
  const title = String(options.title || '').trim()
  const containerId = String(options.containerId || 'cogi-chat-widget-root')

  if (typeof document === 'undefined') return null

  const container = ensureContainer(containerId)
  if (!container) return null

  // Avoid double-mounting
  if (container.__cogi_chat_mounted) return {
    destroy: () => {},
  }

  const root = createRoot(container)
  root.render(
    React.createElement(React.StrictMode, null,
      React.createElement(PublicChatWidget, { tenantCode, tenantSlug, title })
    )
  )

  container.__cogi_chat_mounted = true

  return {
    destroy: () => {
      try {
        root.unmount()
      } catch {}
      if (container.parentNode) container.parentNode.removeChild(container)
    },
  }
}

// Expose simple global API
if (typeof window !== 'undefined') {
  window.COGIChat = window.COGIChat || {}
  window.COGIChat.init = window.COGIChat.init || function init(options) {
    try {
      return mountWidget(options || {})
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('COGIChat.init error', err)
      return null
    }
  }
}

export default mountWidget
