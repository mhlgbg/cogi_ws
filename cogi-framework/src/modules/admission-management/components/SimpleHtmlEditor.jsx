import { useEffect, useMemo, useRef, useState } from 'react'
import {
  CButton,
  CButtonGroup,
  CFormInput,
  CFormLabel,
  CFormTextarea,
} from '@coreui/react'

const TENANT_LOGO_TOKEN = '{{tenantLogo}}'
const TENANT_NAME_TOKEN = '{{tenantName}}'
const CAMPAIGN_NAME_TOKEN = '{{campaignName}}'

const TENANT_LOGO_PREVIEW = `data:image/svg+xml;utf8,${encodeURIComponent(`
  <svg xmlns="http://www.w3.org/2000/svg" width="320" height="120" viewBox="0 0 320 120">
    <rect width="320" height="120" rx="16" fill="#f3f4f6"/>
    <rect x="20" y="20" width="80" height="80" rx="14" fill="#dbe4ff"/>
    <text x="60" y="68" text-anchor="middle" font-family="Arial, sans-serif" font-size="18" fill="#1d4ed8">LOGO</text>
    <text x="128" y="52" font-family="Arial, sans-serif" font-size="18" font-weight="700" fill="#111827">Logo tenant</text>
    <text x="128" y="78" font-family="Arial, sans-serif" font-size="14" fill="#6b7280">Preview trong trình soạn thảo</text>
  </svg>
`)}`

const TOOLBAR_ACTIONS = [
  { label: 'P', command: 'formatBlock', value: 'p' },
  { label: 'H2', command: 'formatBlock', value: 'h2' },
  { label: 'H3', command: 'formatBlock', value: 'h3' },
  { label: 'B', command: 'bold' },
  { label: 'I', command: 'italic' },
  { label: 'U', command: 'underline' },
  { label: 'UL', command: 'insertUnorderedList' },
  { label: 'OL', command: 'insertOrderedList' },
  { label: 'L', command: 'justifyLeft' },
  { label: 'C', command: 'justifyCenter' },
  { label: 'R', command: 'justifyRight' },
  { label: 'Logo', type: 'insertHtml', html: `<p><img src="${TENANT_LOGO_TOKEN}" alt="Logo" style="max-width:160px;max-height:96px;object-fit:contain;" /></p>` },
  {
    label: 'Mẫu',
    type: 'insertHtml',
    html:
      `<div style="text-align:left;">` +
      `<p><img src="${TENANT_LOGO_TOKEN}" alt="Logo" style="max-width:160px;max-height:96px;object-fit:contain;" /></p>` +
      `<h2 style="margin:0 0 8px;">${CAMPAIGN_NAME_TOKEN}</h2>` +
      `<p style="margin:0 0 12px;">Chào mừng đến với chương trình tuyển sinh của <strong>${TENANT_NAME_TOKEN}</strong>.</p>` +
      `<ul><li>Điểm nổi bật 1</li><li>Điểm nổi bật 2</li></ul>` +
      `</div>`,
  },
]

function normalizeHtml(value) {
  const html = String(value || '').trim()
  return html || '<p></p>'
}

function toEditorHtml(html) {
  return String(html || '').split(TENANT_LOGO_TOKEN).join(TENANT_LOGO_PREVIEW)
}

function fromEditorHtml(html) {
  return String(html || '').split(TENANT_LOGO_PREVIEW).join(TENANT_LOGO_TOKEN)
}

function isEditorVisuallyEmpty(html) {
  const source = String(html || '')
  const hasImage = /<img\b/i.test(source)
  const text = source.replace(/<[^>]*>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim()
  return !hasImage && !text
}

export default function SimpleHtmlEditor({
  label,
  value,
  onChange,
  disabled = false,
  rows = 10,
  placeholder = '',
}) {
  const editorRef = useRef(null)
  const [mode, setMode] = useState('visual')
  const [htmlValue, setHtmlValue] = useState(normalizeHtml(value))
  const [linkInput, setLinkInput] = useState('')
  const [imageInput, setImageInput] = useState('')
  const [isFocused, setIsFocused] = useState(false)
  const [textColor, setTextColor] = useState('#111827')
  const [backgroundColor, setBackgroundColor] = useState('#fff59d')

  const normalizedValue = useMemo(() => normalizeHtml(value), [value])
  const visualHtml = useMemo(() => toEditorHtml(htmlValue), [htmlValue])
  const showPlaceholder = mode === 'visual' && !isFocused && isEditorVisuallyEmpty(visualHtml)

  useEffect(() => {
    setHtmlValue(normalizedValue)
  }, [normalizedValue])

  useEffect(() => {
    if (mode !== 'visual') return
    if (!editorRef.current) return
    if (editorRef.current.innerHTML === visualHtml) return
    editorRef.current.innerHTML = visualHtml
  }, [visualHtml, mode])

  function emitChange(nextValue) {
    setHtmlValue(nextValue)
    onChange?.(nextValue)
  }

  function focusEditor() {
    if (editorRef.current) {
      editorRef.current.focus()
    }
  }

  function handleToolbarClick(action) {
    if (disabled || mode !== 'visual') return

    focusEditor()

    if (action.type === 'insertHtml') {
      document.execCommand('insertHTML', false, toEditorHtml(action.html))
    } else if (action.command === 'formatBlock') {
      document.execCommand(action.command, false, action.value)
    } else {
      document.execCommand(action.command, false)
    }

    emitChange(fromEditorHtml(editorRef.current?.innerHTML || '<p></p>'))
  }

  function handleCreateLink() {
    if (disabled || mode !== 'visual') return
    const href = String(linkInput || '').trim()
    if (!href) return

    focusEditor()
    document.execCommand('createLink', false, href)
    emitChange(fromEditorHtml(editorRef.current?.innerHTML || '<p></p>'))
    setLinkInput('')
  }

  function handleCreateImage() {
    if (disabled || mode !== 'visual') return
    const src = String(imageInput || '').trim()
    if (!src) return

    focusEditor()
    document.execCommand(
      'insertHTML',
      false,
      `<p><img src="${src}" alt="Hình minh họa" style="max-width:100%;height:auto;border-radius:8px;" /></p>`
    )
    emitChange(fromEditorHtml(editorRef.current?.innerHTML || '<p></p>'))
    setImageInput('')
  }

  function handleApplyTextColor() {
    if (disabled || mode !== 'visual') return
    focusEditor()
    document.execCommand('foreColor', false, textColor)
    emitChange(fromEditorHtml(editorRef.current?.innerHTML || '<p></p>'))
  }

  function handleApplyBackgroundColor() {
    if (disabled || mode !== 'visual') return
    focusEditor()
    document.execCommand('hiliteColor', false, backgroundColor)
    emitChange(fromEditorHtml(editorRef.current?.innerHTML || '<p></p>'))
  }

  function handleVisualInput() {
    emitChange(fromEditorHtml(editorRef.current?.innerHTML || '<p></p>'))
  }

  return (
    <div>
      {label ? <CFormLabel>{label}</CFormLabel> : null}

      <div className='d-flex justify-content-between align-items-center gap-2 flex-wrap mb-2'>
        <CButtonGroup size='sm' role='group'>
          {TOOLBAR_ACTIONS.map((action) => (
            <CButton
              key={`${action.label}-${action.command}`}
              type='button'
              color='secondary'
              variant='outline'
              onClick={() => handleToolbarClick(action)}
              disabled={disabled || mode !== 'visual'}
            >
              {action.label}
            </CButton>
          ))}
        </CButtonGroup>

        <div className='d-flex align-items-center gap-2 flex-wrap'>
          <CFormInput
            size='sm'
            value={linkInput}
            onChange={(event) => setLinkInput(event.target.value)}
            placeholder='https://...'
            disabled={disabled || mode !== 'visual'}
            style={{ width: 180 }}
          />
          <CButton type='button' size='sm' color='secondary' variant='outline' onClick={handleCreateLink} disabled={disabled || mode !== 'visual'}>
            Link
          </CButton>
          <CFormInput
            size='sm'
            value={imageInput}
            onChange={(event) => setImageInput(event.target.value)}
            placeholder='https://.../image.png'
            disabled={disabled || mode !== 'visual'}
            style={{ width: 220 }}
          />
          <CButton type='button' size='sm' color='secondary' variant='outline' onClick={handleCreateImage} disabled={disabled || mode !== 'visual'}>
            Ảnh
          </CButton>
          <input
            type='color'
            value={textColor}
            onChange={(event) => setTextColor(event.target.value)}
            disabled={disabled || mode !== 'visual'}
            title='Màu chữ'
            style={{ width: 36, height: 32, padding: 2, border: '1px solid #d8dbe0', borderRadius: 6 }}
          />
          <CButton type='button' size='sm' color='secondary' variant='outline' onClick={handleApplyTextColor} disabled={disabled || mode !== 'visual'}>
            Màu chữ
          </CButton>
          <input
            type='color'
            value={backgroundColor}
            onChange={(event) => setBackgroundColor(event.target.value)}
            disabled={disabled || mode !== 'visual'}
            title='Màu nền'
            style={{ width: 36, height: 32, padding: 2, border: '1px solid #d8dbe0', borderRadius: 6 }}
          />
          <CButton type='button' size='sm' color='secondary' variant='outline' onClick={handleApplyBackgroundColor} disabled={disabled || mode !== 'visual'}>
            Tô nền
          </CButton>
        </div>

        <CButtonGroup size='sm' role='group'>
          <CButton
            type='button'
            color={mode === 'visual' ? 'primary' : 'secondary'}
            variant={mode === 'visual' ? undefined : 'outline'}
            onClick={() => setMode('visual')}
          >
            Soạn thảo
          </CButton>
          <CButton
            type='button'
            color={mode === 'html' ? 'primary' : 'secondary'}
            variant={mode === 'html' ? undefined : 'outline'}
            onClick={() => setMode('html')}
          >
            HTML
          </CButton>
        </CButtonGroup>
      </div>

      {mode === 'visual' ? (
        <div style={{ position: 'relative' }}>
          {showPlaceholder ? (
            <div
              className='text-body-secondary'
              style={{
                position: 'absolute',
                top: 12,
                left: 12,
                right: 12,
                pointerEvents: 'none',
                fontSize: '0.95rem',
                opacity: 0.75,
              }}
            >
              {placeholder || 'Nhập nội dung...'}
            </div>
          ) : null}

          <div
            ref={editorRef}
            className='form-control'
            contentEditable={!disabled}
            suppressContentEditableWarning
            onInput={handleVisualInput}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
            style={{ minHeight: `${Math.max(rows * 20, 220)}px`, overflowY: 'auto' }}
          />
        </div>
      ) : (
        <CFormTextarea
          rows={rows}
          value={htmlValue}
          onChange={(event) => emitChange(event.target.value)}
          disabled={disabled}
          placeholder={placeholder}
        />
      )}

      <div className='small text-body-secondary mt-1'>Editor trực quan với placeholder thật, chèn link, ảnh, logo tenant, block mẫu và tô màu chữ/nền. Có thể chuyển sang chế độ HTML để chỉnh mã khi cần.</div>
    </div>
  )
}