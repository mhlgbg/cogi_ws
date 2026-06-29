import React from 'react'
import { createRoot } from 'react-dom/client'
import EmbedChatWidget from './EmbedChatWidget.jsx'
import api from '../api/axios'

function ensureContainer(containerId) {
  let el = document.getElementById(containerId)
  if (!el) {
    el = document.createElement('div')
    el.id = containerId
    el.className = 'cogi-chat-root'
    document.body.appendChild(el)
  }
  else {
    // ensure root class present
    if (!el.className || !String(el.className).includes('cogi-chat-root')) {
      el.className = `${String(el.className || '')} cogi-chat-root`.trim()
    }
  }
  return el
}

function injectStyles() {
  if (document.getElementById('cogi-chat-widget-style')) return
  const css = `
  /* Scoped reset */
  .cogi-chat-root, .cogi-chat-root * { box-sizing: border-box; }
  .cogi-chat-root { font-family: Inter, Roboto, Arial, Helvetica, sans-serif; }

  /* Toggle button */
  .cogi-chat-root .cogi-chat-toggle { background: linear-gradient(180deg,#6f5af8,#5a45e6); border: none; color: white; width:64px; height:64px; border-radius:32px; box-shadow:0 8px 20px rgba(15,23,42,0.2); cursor:pointer; display:flex; align-items:center; justify-content:center }
  .cogi-chat-root .cogi-chat-toggle:focus { outline: none; box-shadow: 0 8px 24px rgba(101,78,255,0.28); }
  .cogi-chat-root .cogi-chat-toggle-icon { font-size:24px }

  /* Popup */
  .cogi-chat-root .cogi-chat-popup { width: min(420px, calc(100vw - 32px)); max-height: 70vh; border-radius:12px; box-shadow: 0 18px 40px rgba(15,23,42,0.22); background:#fff; overflow:hidden; display:flex; flex-direction:column }
  .cogi-chat-root .cogi-chat-header { display:flex; align-items:center; justify-content:space-between; padding:12px 14px; border-bottom:1px solid rgba(0,0,0,0.06); }
  .cogi-chat-root .cogi-chat-title { font-weight:700; font-size:14px }
  .cogi-chat-root .cogi-chat-close { background:transparent; border:none; font-size:20px; cursor:pointer }

  /* Messages */
  .cogi-chat-root .cogi-chat-messages { padding:12px; overflow:auto; flex:1; display:flex; flex-direction:column; gap:10px }
  .cogi-chat-root .cogi-chat-row { display:flex }
  .cogi-chat-root .cogi-chat-row.is-user { justify-content:flex-end }
  .cogi-chat-root .cogi-chat-bubble { max-width:80%; padding:10px 12px; border-radius:12px; box-shadow:0 4px 10px rgba(2,6,23,0.04); }
  .cogi-chat-root .cogi-chat-bubble.user { background: linear-gradient(180deg,#8b5cf6,#6f5af8); color:white; border-bottom-right-radius:4px }
  .cogi-chat-root .cogi-chat-bubble.assistant { background:#f5f6f8; color:#0b1220; border-bottom-left-radius:4px }
  .cogi-chat-root .cogi-chat-meta { font-size:10px; color:rgba(0,0,0,0.45); margin-top:6px }

  /* Footer */
  .cogi-chat-root .cogi-chat-footer { padding:10px; display:flex; gap:8px; border-top:1px solid rgba(0,0,0,0.06); }
  .cogi-chat-root .cogi-chat-input { flex:1; min-height:42px; max-height:120px; padding:8px 10px; border-radius:8px; border:1px solid #e6e9ee; resize:vertical; font-size:14px }
  .cogi-chat-root .cogi-chat-send { background:#2b6cb0; color:white; border:none; padding:8px 12px; border-radius:8px; cursor:pointer }
  .cogi-chat-root .cogi-chat-send:disabled { opacity:0.6; cursor:not-allowed }

  .cogi-chat-root .cogi-chat-empty, .cogi-chat-root .cogi-chat-loading { color:rgba(0,0,0,0.5); font-size:13px; text-align:center; padding:8px }

  /* Accessibility & small tweaks */
  .cogi-chat-root .cogi-chat-popup:focus { outline: none }

  @media (max-width:420px) { .cogi-chat-root .cogi-chat-popup { width: calc(100vw - 16px); right:8px; left:8px } }
  `
  const style = document.createElement('style')
  style.id = 'cogi-chat-widget-style'
  style.appendChild(document.createTextNode(css))
  document.head.appendChild(style)
}

function buildApiBaseUrl(config, scriptBaseUrl) {
  if (config && config.apiBaseUrl) return config.apiBaseUrl
  if (scriptBaseUrl) return `${scriptBaseUrl.replace(/\/$/, '')}/api`
  return `${location.origin.replace(/\/$/, '')}/api`
}

export function mountWidget(config = {}) {
  injectStyles()

  const containerId = config.containerId || 'cogi-chat-root'
  const tenantCode = String(config.tenantCode || config.tenant || '').trim()
  const tenantSlug = String(config.tenantSlug || '').trim()
  const title = String(config.title || '').trim()
  const scriptBaseUrl = String(config.baseUrl || '').trim()

  // set api base on axios instance so component uses it
  try {
    api.defaults.baseURL = buildApiBaseUrl(config, scriptBaseUrl)
  } catch (e) {
    // ignore
  }

  // persist tenant code for axios headers and session storage
  try {
    if (tenantCode) localStorage.setItem('tenantCode', tenantCode)
    if (tenantSlug) localStorage.setItem('tenantSlug', tenantSlug)
  } catch (e) {}

  const container = ensureContainer(containerId)
  const root = createRoot(container)
  root.render(React.createElement(React.StrictMode, null, React.createElement(EmbedChatWidget, {
    tenantCode,
    tenantSlug,
    title,
  })))

  return {
    destroy() {
      try { root.unmount() } catch (e) {}
      try { if (container.parentNode) container.parentNode.removeChild(container) } catch (e) {}
    }
  }
}

// expose global API
if (typeof window !== 'undefined') {
  window.COGIChat = window.COGIChat || {}
  window.COGIChat._mounted = window.COGIChat._mounted || null

  window.COGIChat.init = window.COGIChat.init || function init(options = {}) {
    try { console.log('[COGIChat] init', options) } catch (e) {}
    try {
      const script = document.currentScript
      const scriptSrc = script && script.src ? String(script.src) : ''
      const base = options.baseUrl || (scriptSrc ? new URL(scriptSrc).origin : '')
      options.baseUrl = options.baseUrl || base
    } catch (e) {}

    if (window.COGIChat._mounted && typeof window.COGIChat._mounted.destroy === 'function') {
      try { window.COGIChat._mounted.destroy() } catch (e) {}
      window.COGIChat._mounted = null
    }

    const mounted = mountWidget(options)
    window.COGIChat._mounted = mounted
    try { console.log('[COGIChat] mounted') } catch (e) {}
    return mounted
  }

  window.COGIChat.destroy = window.COGIChat.destroy || function destroy() {
    if (window.COGIChat._mounted && typeof window.COGIChat._mounted.destroy === 'function') {
      try { window.COGIChat._mounted.destroy() } catch (e) {}
      window.COGIChat._mounted = null
    }
  }
}

export default mountWidget
