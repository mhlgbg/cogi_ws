import { useEffect, useMemo, useRef, useState } from 'react'
import {
  CButton,
  CCol,
  CFormInput,
  CFormLabel,
  CFormSelect,
  CRow,
} from '@coreui/react'
import {
  DEFAULT_FRAME_CONFIG,
  canvasRectToDisplayRect,
  clampNumber,
  createDefaultTransform,
  displayRectToCanvasRect,
  renderFrameCanvas,
  resolveCampaignConfig,
} from '../../../features/photo-frame/photoFrameGeometry'

function buildPlaceholderDataUrl() {
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1080" viewBox="0 0 1080 1080">
      <defs>
        <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="#fde68a"/>
          <stop offset="100%" stop-color="#fca5a5"/>
        </linearGradient>
      </defs>
      <rect width="1080" height="1080" fill="url(#bg)"/>
      <circle cx="540" cy="390" r="170" fill="#fff" fill-opacity="0.95"/>
      <path d="M290 890c55-155 190-250 250-250s195 95 250 250" fill="#fff" fill-opacity="0.95"/>
    </svg>
  `
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
}

function loadImageElement(url) {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error('IMAGE_LOAD_FAILED'))
    image.src = url
  })
}

function revokeObjectUrl(asset) {
  const url = String(asset?.objectUrl || '').trim()
  if (url.startsWith('blob:')) {
    URL.revokeObjectURL(url)
  }
}

function toAsset(url, image, fileName = '') {
  return {
    objectUrl: url,
    image,
    width: image.naturalWidth,
    height: image.naturalHeight,
    fileName,
  }
}

function getAreaRectFromConfig(campaign) {
  return {
    x: campaign.photoArea.x,
    y: campaign.photoArea.y,
    width: campaign.photoArea.width,
    height: campaign.photoArea.height,
  }
}

function clampCanvasRect(rect, campaign, shape) {
  const maxWidth = campaign.width
  const maxHeight = campaign.height
  let next = {
    x: Number(rect.x || 0),
    y: Number(rect.y || 0),
    width: Math.max(1, Number(rect.width || 1)),
    height: Math.max(1, Number(rect.height || 1)),
  }

  if (shape === 'circle') {
    const size = Math.max(1, Math.min(next.width, next.height))
    next.width = size
    next.height = size
  }

  if (next.width > maxWidth) next.width = maxWidth
  if (next.height > maxHeight) next.height = maxHeight
  next.x = clampNumber(next.x, 0, maxWidth - next.width)
  next.y = clampNumber(next.y, 0, maxHeight - next.height)
  return next
}

function normalizeRectForShape(rect, shape, handle) {
  if (shape !== 'circle') return rect
  const width = Math.max(1, rect.width)
  const height = Math.max(1, rect.height)
  const size = Math.min(width, height)

  if (handle === 'nw') {
    return { x: rect.x + (width - size), y: rect.y + (height - size), width: size, height: size }
  }
  if (handle === 'ne') {
    return { x: rect.x, y: rect.y + (height - size), width: size, height: size }
  }
  if (handle === 'sw') {
    return { x: rect.x + (width - size), y: rect.y, width: size, height: size }
  }
  return { x: rect.x, y: rect.y, width: size, height: size }
}

function resizeRectFromHandle(startRect, handle, deltaX, deltaY, shape) {
  let nextRect = { ...startRect }
  if (handle === 'nw') {
    nextRect = { x: startRect.x + deltaX, y: startRect.y + deltaY, width: startRect.width - deltaX, height: startRect.height - deltaY }
  } else if (handle === 'ne') {
    nextRect = { x: startRect.x, y: startRect.y + deltaY, width: startRect.width + deltaX, height: startRect.height - deltaY }
  } else if (handle === 'sw') {
    nextRect = { x: startRect.x + deltaX, y: startRect.y, width: startRect.width - deltaX, height: startRect.height + deltaY }
  } else {
    nextRect = { x: startRect.x, y: startRect.y, width: startRect.width + deltaX, height: startRect.height + deltaY }
  }

  if (shape === 'circle') {
    nextRect = normalizeRectForShape(nextRect, shape, handle)
  }
  return nextRect
}

function createInteractionCursor(type) {
  if (type === 'nw' || type === 'se') return 'nwse-resize'
  if (type === 'ne' || type === 'sw') return 'nesw-resize'
  return 'move'
}

export default function PhotoAreaVisualEditor({
  form,
  framePreviewUrl,
  formOptions,
  disabled = false,
  initialFormValues,
  onUpdateField,
}) {
  const sampleInputRef = useRef(null)
  const previewHostRef = useRef(null)
  const canvasRef = useRef(null)
  const interactionRef = useRef(null)
  const sampleAssetRef = useRef(null)
  const frameAssetRef = useRef(null)
  const [sampleAsset, setSampleAsset] = useState(null)
  const [frameAsset, setFrameAsset] = useState(null)
  const [previewSize, setPreviewSize] = useState({ width: 0, height: 0 })
  const [previewMode, setPreviewMode] = useState('edit')

  const campaign = useMemo(() => resolveCampaignConfig({
    width: Number(form.width || 1080) || 1080,
    height: Number(form.height || 1080) || 1080,
    photoShape: form.photoShape,
    photoAreaX: Number(form.photoAreaX || 0) || 0,
    photoAreaY: Number(form.photoAreaY || 0) || 0,
    photoAreaWidth: Number(form.photoAreaWidth || form.width || 1080) || Number(form.width || 1080) || 1080,
    photoAreaHeight: Number(form.photoAreaHeight || form.height || 1080) || Number(form.height || 1080) || 1080,
    photoFitMode: form.photoFitMode,
    minZoom: Number(form.minZoom || DEFAULT_FRAME_CONFIG.minZoom) || DEFAULT_FRAME_CONFIG.minZoom,
    maxZoom: Number(form.maxZoom || DEFAULT_FRAME_CONFIG.maxZoom) || DEFAULT_FRAME_CONFIG.maxZoom,
    defaultZoom: Number(form.defaultZoom || DEFAULT_FRAME_CONFIG.defaultZoom) || DEFAULT_FRAME_CONFIG.defaultZoom,
    defaultOffsetX: Number(form.defaultOffsetX || 0) || 0,
    defaultOffsetY: Number(form.defaultOffsetY || 0) || 0,
    allowRotate: form.allowRotate !== false,
    showOutsidePhotoAreaInPreview: form.showOutsidePhotoAreaInPreview,
    outsideOverlayOpacity: Number(form.outsideOverlayOpacity || DEFAULT_FRAME_CONFIG.outsideOverlayOpacity) || DEFAULT_FRAME_CONFIG.outsideOverlayOpacity,
    outputFormat: form.outputFormat,
    outputQuality: Number(form.outputQuality || DEFAULT_FRAME_CONFIG.outputQuality) || DEFAULT_FRAME_CONFIG.outputQuality,
  }), [form])

  const areaDisplayRect = useMemo(() => canvasRectToDisplayRect(campaign.photoArea, campaign, previewSize), [campaign, previewSize])

  const previewTransform = useMemo(() => createDefaultTransform(sampleAsset, campaign), [sampleAsset, campaign])

  useEffect(() => {
    let cancelled = false
    const placeholderUrl = buildPlaceholderDataUrl()
    loadImageElement(placeholderUrl)
      .then((image) => {
        if (cancelled) return
        const asset = toAsset(placeholderUrl, image, 'placeholder-preview.svg')
        sampleAssetRef.current = asset
        setSampleAsset(asset)
      })
      .catch(() => {
        if (!cancelled) setSampleAsset(null)
      })

    return () => {
      cancelled = true
      if (sampleAssetRef.current?.objectUrl?.startsWith('blob:')) {
        URL.revokeObjectURL(sampleAssetRef.current.objectUrl)
      }
      if (frameAssetRef.current?.objectUrl?.startsWith('blob:')) {
        URL.revokeObjectURL(frameAssetRef.current.objectUrl)
      }
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    if (!framePreviewUrl) {
      setFrameAsset(null)
      return undefined
    }

    loadImageElement(framePreviewUrl)
      .then((image) => {
        if (cancelled) return
        const asset = toAsset(framePreviewUrl, image, 'frame-preview.png')
        frameAssetRef.current = asset
        setFrameAsset(asset)
      })
      .catch(() => {
        if (!cancelled) setFrameAsset(null)
      })

    return () => {
      cancelled = true
    }
  }, [framePreviewUrl])

  useEffect(() => {
    const host = previewHostRef.current
    if (!host) return undefined
    const observer = new ResizeObserver((entries) => {
      const rect = entries[0]?.contentRect
      if (!rect) return
      setPreviewSize({ width: rect.width, height: rect.height })
    })
    observer.observe(host)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || !campaign) return
    const context = canvas.getContext('2d')
    if (!context) return
    renderFrameCanvas(context, campaign, frameAsset, sampleAsset, previewTransform, previewMode === 'result' ? 'export' : 'preview', { showGuide: false })
  }, [campaign, frameAsset, previewMode, previewTransform, sampleAsset])

  useEffect(() => {
    function handlePointerMove(event) {
      const state = interactionRef.current
      if (!state || disabled) return
      event.preventDefault()
      const scaleX = campaign.width / state.previewSize.width
      const scaleY = campaign.height / state.previewSize.height
      const deltaX = (event.clientX - state.startClientX) * scaleX
      const deltaY = (event.clientY - state.startClientY) * scaleY

      let nextRect
      if (state.type === 'move') {
        nextRect = {
          x: state.startRect.x + deltaX,
          y: state.startRect.y + deltaY,
          width: state.startRect.width,
          height: state.startRect.height,
        }
      } else {
        nextRect = resizeRectFromHandle(state.startRect, state.type, deltaX, deltaY, campaign.photoShape)
      }

      nextRect = clampCanvasRect(nextRect, campaign, campaign.photoShape)
      onUpdateField('photoAreaX', String(Math.round(nextRect.x)))
      onUpdateField('photoAreaY', String(Math.round(nextRect.y)))
      onUpdateField('photoAreaWidth', String(Math.round(nextRect.width)))
      onUpdateField('photoAreaHeight', String(Math.round(nextRect.height)))
    }

    function handlePointerUp() {
      interactionRef.current = null
    }

    window.addEventListener('pointermove', handlePointerMove)
    window.addEventListener('pointerup', handlePointerUp)
    window.addEventListener('pointercancel', handlePointerUp)
    return () => {
      window.removeEventListener('pointermove', handlePointerMove)
      window.removeEventListener('pointerup', handlePointerUp)
      window.removeEventListener('pointercancel', handlePointerUp)
    }
  }, [campaign, disabled, onUpdateField])

  function handleStartInteraction(type, event) {
    if (disabled || previewSize.width <= 0 || previewSize.height <= 0) return
    event.preventDefault()
    event.stopPropagation()
    interactionRef.current = {
      type,
      startClientX: event.clientX,
      startClientY: event.clientY,
      startRect: getAreaRectFromConfig(campaign),
      previewSize,
    }
  }

  function handleCenterArea() {
    const rect = getAreaRectFromConfig(campaign)
    const nextRect = clampCanvasRect({
      ...rect,
      x: (campaign.width - rect.width) / 2,
      y: (campaign.height - rect.height) / 2,
    }, campaign, campaign.photoShape)
    onUpdateField('photoAreaX', String(Math.round(nextRect.x)))
    onUpdateField('photoAreaY', String(Math.round(nextRect.y)))
    onUpdateField('photoAreaWidth', String(Math.round(nextRect.width)))
    onUpdateField('photoAreaHeight', String(Math.round(nextRect.height)))
  }

  function handleCoverCanvas() {
    if (campaign.photoShape === 'circle') {
      const size = Math.min(campaign.width, campaign.height)
      onUpdateField('photoAreaWidth', String(size))
      onUpdateField('photoAreaHeight', String(size))
      onUpdateField('photoAreaX', String(Math.round((campaign.width - size) / 2)))
      onUpdateField('photoAreaY', String(Math.round((campaign.height - size) / 2)))
      return
    }
    onUpdateField('photoAreaX', '0')
    onUpdateField('photoAreaY', '0')
    onUpdateField('photoAreaWidth', String(campaign.width))
    onUpdateField('photoAreaHeight', String(campaign.height))
  }

  function handleResetArea() {
    const baseline = resolveCampaignConfig({
      width: Number(initialFormValues?.width || campaign.width) || campaign.width,
      height: Number(initialFormValues?.height || campaign.height) || campaign.height,
      photoShape: initialFormValues?.photoShape || DEFAULT_FRAME_CONFIG.photoShape,
      photoAreaX: Number(initialFormValues?.photoAreaX || 0) || 0,
      photoAreaY: Number(initialFormValues?.photoAreaY || 0) || 0,
      photoAreaWidth: Number(initialFormValues?.photoAreaWidth || initialFormValues?.width || campaign.width) || campaign.width,
      photoAreaHeight: Number(initialFormValues?.photoAreaHeight || initialFormValues?.height || campaign.height) || campaign.height,
      photoFitMode: initialFormValues?.photoFitMode || DEFAULT_FRAME_CONFIG.photoFitMode,
      minZoom: Number(initialFormValues?.minZoom || DEFAULT_FRAME_CONFIG.minZoom) || DEFAULT_FRAME_CONFIG.minZoom,
      maxZoom: Number(initialFormValues?.maxZoom || DEFAULT_FRAME_CONFIG.maxZoom) || DEFAULT_FRAME_CONFIG.maxZoom,
      defaultZoom: Number(initialFormValues?.defaultZoom || DEFAULT_FRAME_CONFIG.defaultZoom) || DEFAULT_FRAME_CONFIG.defaultZoom,
      defaultOffsetX: Number(initialFormValues?.defaultOffsetX || 0) || 0,
      defaultOffsetY: Number(initialFormValues?.defaultOffsetY || 0) || 0,
      allowRotate: initialFormValues?.allowRotate !== false,
      showOutsidePhotoAreaInPreview: initialFormValues?.showOutsidePhotoAreaInPreview || DEFAULT_FRAME_CONFIG.showOutsidePhotoAreaInPreview,
      outsideOverlayOpacity: Number(initialFormValues?.outsideOverlayOpacity || DEFAULT_FRAME_CONFIG.outsideOverlayOpacity) || DEFAULT_FRAME_CONFIG.outsideOverlayOpacity,
      outputFormat: initialFormValues?.outputFormat || DEFAULT_FRAME_CONFIG.outputFormat,
      outputQuality: Number(initialFormValues?.outputQuality || DEFAULT_FRAME_CONFIG.outputQuality) || DEFAULT_FRAME_CONFIG.outputQuality,
    })
    const rect = getAreaRectFromConfig(baseline)
    onUpdateField('photoShape', baseline.photoShape)
    onUpdateField('photoAreaX', String(Math.round(rect.x)))
    onUpdateField('photoAreaY', String(Math.round(rect.y)))
    onUpdateField('photoAreaWidth', String(Math.round(rect.width)))
    onUpdateField('photoAreaHeight', String(Math.round(rect.height)))
  }

  function handleShapeChange(nextShape) {
    const currentRect = getAreaRectFromConfig(campaign)
    let nextRect = currentRect
    if (nextShape === 'circle') {
      const size = Math.min(currentRect.width, currentRect.height)
      nextRect = {
        x: currentRect.x + ((currentRect.width - size) / 2),
        y: currentRect.y + ((currentRect.height - size) / 2),
        width: size,
        height: size,
      }
    }
    nextRect = clampCanvasRect(nextRect, campaign, nextShape)
    onUpdateField('photoShape', nextShape)
    onUpdateField('photoAreaX', String(Math.round(nextRect.x)))
    onUpdateField('photoAreaY', String(Math.round(nextRect.y)))
    onUpdateField('photoAreaWidth', String(Math.round(nextRect.width)))
    onUpdateField('photoAreaHeight', String(Math.round(nextRect.height)))
  }

  async function handleChooseSampleImage(event) {
    const file = event.target.files?.[0] || null
    event.target.value = ''
    if (!file) return
    const objectUrl = URL.createObjectURL(file)
    try {
      const image = await loadImageElement(objectUrl)
      revokeObjectUrl(sampleAssetRef.current)
      const asset = toAsset(objectUrl, image, file.name || 'sample-preview')
      sampleAssetRef.current = asset
      setSampleAsset(asset)
    } catch {
      URL.revokeObjectURL(objectUrl)
    }
  }

  const handles = [
    { key: 'nw', style: { left: -10, top: -10 } },
    { key: 'ne', style: { right: -10, top: -10 } },
    { key: 'sw', style: { left: -10, bottom: -10 } },
    { key: 'se', style: { right: -10, bottom: -10 } },
  ]

  return (
    <CRow className='g-4 align-items-start'>
      <CCol lg={8}>
        <div ref={previewHostRef} style={{ width: '100%' }}>
          <div
            style={{
              position: 'relative',
              width: '100%',
              maxWidth: 560,
              aspectRatio: `${campaign.width} / ${campaign.height}`,
              margin: '0 auto',
              borderRadius: 18,
              overflow: 'hidden',
              border: '1px solid rgba(148,163,184,0.35)',
              background: '#fff',
            }}
          >
            <canvas ref={canvasRef} width={campaign.width} height={campaign.height} style={{ display: 'block', width: '100%', height: '100%' }} />

            {previewMode === 'edit' ? (
              <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
                <div
                  role='presentation'
                  onPointerDown={(event) => handleStartInteraction('move', event)}
                  style={{
                    position: 'absolute',
                    left: areaDisplayRect.x,
                    top: areaDisplayRect.y,
                    width: areaDisplayRect.width,
                    height: areaDisplayRect.height,
                    border: '2px dashed rgba(14, 165, 233, 0.95)',
                    borderRadius: campaign.photoShape === 'circle' ? '9999px' : campaign.photoShape === 'ellipse' ? '50%' : campaign.photoShape === 'rounded_rect' ? 24 : 0,
                    boxShadow: '0 0 0 9999px rgba(0,0,0,0)',
                    cursor: createInteractionCursor('move'),
                    pointerEvents: disabled ? 'none' : 'auto',
                    userSelect: 'none',
                    touchAction: 'none',
                  }}
                >
                  <div style={{ position: 'absolute', top: 10, left: 10, padding: '4px 8px', borderRadius: 999, background: 'rgba(15,23,42,0.72)', color: '#fff', fontSize: 12, fontWeight: 600 }}>Vùng ảnh</div>
                  {handles.map((handle) => (
                    <div
                      key={handle.key}
                      role='presentation'
                      onPointerDown={(event) => handleStartInteraction(handle.key, event)}
                      style={{
                        position: 'absolute',
                        width: 20,
                        height: 20,
                        borderRadius: '50%',
                        background: '#fff',
                        border: '2px solid #0ea5e9',
                        boxShadow: '0 4px 16px rgba(15,23,42,0.18)',
                        cursor: createInteractionCursor(handle.key),
                        pointerEvents: disabled ? 'none' : 'auto',
                        touchAction: 'none',
                        ...handle.style,
                      }}
                    />
                  ))}
                </div>
              </div>
            ) : null}
          </div>

          <div className='small text-body-secondary mt-3 d-flex flex-wrap gap-3 justify-content-center'>
            <span>{`Canvas: ${campaign.width} × ${campaign.height}`}</span>
            <span>{`Photo area: ${Math.round(campaign.photoArea.width)} × ${Math.round(campaign.photoArea.height)}`}</span>
            <span>{`X: ${Math.round(campaign.photoArea.x)} • Y: ${Math.round(campaign.photoArea.y)}`}</span>
          </div>
        </div>
      </CCol>

      <CCol lg={4}>
        <div className='d-grid gap-3'>
          <div>
            <CFormLabel>Hình vùng ảnh</CFormLabel>
            <CFormSelect value={form.photoShape} onChange={(event) => handleShapeChange(event.target.value)} disabled={disabled}>
              {(Array.isArray(formOptions?.photoShapes) ? formOptions.photoShapes : []).map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
            </CFormSelect>
          </div>

          <div>
            <CFormInput type='file' accept='image/jpeg,image/png,image/webp' hidden ref={sampleInputRef} onChange={handleChooseSampleImage} />
            <CFormLabel>Ảnh xem thử</CFormLabel>
            <div className='d-flex flex-wrap gap-2'>
              <CButton color='secondary' variant='outline' onClick={() => sampleInputRef.current?.click?.()} disabled={disabled}>Chọn ảnh xem thử</CButton>
              <CButton color='secondary' variant='outline' onClick={() => setPreviewMode((current) => current === 'edit' ? 'result' : 'edit')}>{previewMode === 'edit' ? 'Xem kết quả' : 'Chỉnh vùng ảnh'}</CButton>
            </div>
            <div className='small text-body-secondary mt-2'>{sampleAsset?.fileName || 'Đang dùng ảnh mẫu mặc định của hệ thống.'}</div>
          </div>

          <CRow className='g-3'>
            <CCol md={6} lg={12} xl={6}>
              <CFormLabel>X</CFormLabel>
              <CFormInput type='number' value={form.photoAreaX} onChange={(event) => onUpdateField('photoAreaX', event.target.value)} disabled={disabled} />
            </CCol>
            <CCol md={6} lg={12} xl={6}>
              <CFormLabel>Y</CFormLabel>
              <CFormInput type='number' value={form.photoAreaY} onChange={(event) => onUpdateField('photoAreaY', event.target.value)} disabled={disabled} />
            </CCol>
            <CCol md={6} lg={12} xl={6}>
              <CFormLabel>Width</CFormLabel>
              <CFormInput type='number' min={1} value={form.photoAreaWidth} onChange={(event) => onUpdateField('photoAreaWidth', event.target.value)} disabled={disabled} />
            </CCol>
            <CCol md={6} lg={12} xl={6}>
              <CFormLabel>Height</CFormLabel>
              <CFormInput type='number' min={1} value={form.photoAreaHeight} onChange={(event) => onUpdateField('photoAreaHeight', event.target.value)} disabled={disabled || form.photoShape === 'circle'} />
            </CCol>
          </CRow>

          <div className='d-flex flex-wrap gap-2'>
            <CButton color='secondary' variant='outline' onClick={handleCenterArea} disabled={disabled}>Căn giữa</CButton>
            <CButton color='secondary' variant='outline' onClick={handleCoverCanvas} disabled={disabled}>Phủ toàn canvas</CButton>
            <CButton color='secondary' variant='outline' onClick={handleResetArea} disabled={disabled}>Đặt lại</CButton>
          </div>
        </div>
      </CCol>
    </CRow>
  )
}