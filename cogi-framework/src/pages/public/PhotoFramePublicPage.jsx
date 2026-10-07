import { useEffect, useMemo, useRef, useState } from 'react'
import {
  CAlert,
  CButton,
  CCard,
  CCardBody,
  CCol,
  CContainer,
  CFormCheck,
  CFormInput,
  CFormLabel,
  CRow,
  CSpinner,
} from '@coreui/react'
import { useParams } from 'react-router-dom'
import { useTenant } from '../../contexts/TenantContext'
import useTenantPageTitle from '../../utils/useTenantPageTitle'
import { getApiMessage, getPublicPhotoFrameCampaign } from '../../features/photo-frame/services/photoFramePublicService'
import { savePublicGeneratedPhoto } from '../../modules/content-management/services/generatedPhotoService'
import {
  DEFAULT_FRAME_CONFIG,
  clampNumber as sharedClampNumber,
  clampTransform as sharedClampTransform,
  createDefaultTransform as sharedCreateDefaultTransform,
  getEffectiveMinZoom,
  normalizeRotation as sharedNormalizeRotation,
  renderFrameCanvas as sharedRenderFrameCanvas,
  resolveCampaignConfig as sharedResolveCampaignConfig,
} from '../../features/photo-frame/photoFrameGeometry'

const SUPPORTED_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp'])
const DEFAULTS = DEFAULT_FRAME_CONFIG
const ZOOM_STEP = 0.1
const MAX_INPUT_EDGE = 4096

function formatDateTime(value) {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return new Intl.DateTimeFormat('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
}

function clampNumber(value, minValue, maxValue) {
  return sharedClampNumber(value, minValue, maxValue)
}

function normalizeRotation(value) {
  return sharedNormalizeRotation(value)
}

function getRoundedRectRadius(area) {
  return clampNumber(Math.min(area.width, area.height) * 0.12, 0, Math.min(area.width, area.height) / 2)
}

function resolveCampaignConfig(campaign) {
  return sharedResolveCampaignConfig(campaign)
}

function buildPhotoAreaPath(context, area, shape) {
  const x = area.x
  const y = area.y
  const width = area.width
  const height = area.height

  if (shape === 'circle') {
    context.arc(x + width / 2, y + height / 2, Math.min(width, height) / 2, 0, Math.PI * 2)
    return
  }

  if (shape === 'ellipse') {
    context.ellipse(x + width / 2, y + height / 2, width / 2, height / 2, 0, 0, Math.PI * 2)
    return
  }

  if (shape === 'rounded_rect') {
    context.roundRect(x, y, width, height, getRoundedRectRadius(area))
    return
  }

  context.rect(x, y, width, height)
}

function drawCheckerboard(context, width, height) {
  const size = 40
  context.save()
  context.fillStyle = '#f8fafc'
  context.fillRect(0, 0, width, height)
  for (let top = 0; top < height; top += size) {
    for (let left = 0; left < width; left += size) {
      if (((left / size) + (top / size)) % 2 === 0) {
        context.fillStyle = 'rgba(148, 163, 184, 0.18)'
        context.fillRect(left, top, size, size)
      }
    }
  }
  context.restore()
}

function renderOutsideOverlay(context, campaign) {
  context.save()
  context.beginPath()
  context.rect(0, 0, campaign.width, campaign.height)
  buildPhotoAreaPath(context, campaign.photoArea, campaign.photoShape)
  context.fillStyle = `rgba(15, 23, 42, ${campaign.outsideOverlayOpacity})`
  context.fill('evenodd')
  context.restore()
}

function renderPhotoAreaGuide(context, campaign) {
  context.save()
  context.beginPath()
  buildPhotoAreaPath(context, campaign.photoArea, campaign.photoShape)
  context.strokeStyle = 'rgba(14, 165, 233, 0.85)'
  context.lineWidth = Math.max(3, Math.min(campaign.width, campaign.height) * 0.004)
  context.setLineDash([24, 18])
  context.stroke()
  context.restore()
}

function getRotatedBounds(width, height, rotation) {
  const radians = (normalizeRotation(rotation) * Math.PI) / 180
  const sin = Math.abs(Math.sin(radians))
  const cos = Math.abs(Math.cos(radians))
  return {
    width: (width * cos) + (height * sin),
    height: (width * sin) + (height * cos),
  }
}

function getBaseScale(imageAsset, campaign, rotation) {
  if (!imageAsset?.width || !imageAsset?.height) return 1
  const rotatedIntrinsic = getRotatedBounds(imageAsset.width, imageAsset.height, rotation)
  if (campaign.photoFitMode === 'contain') {
    return Math.min(campaign.photoArea.width / rotatedIntrinsic.width, campaign.photoArea.height / rotatedIntrinsic.height)
  }
  return Math.max(campaign.photoArea.width / rotatedIntrinsic.width, campaign.photoArea.height / rotatedIntrinsic.height)
}

function getDisplayMetrics(imageAsset, campaign, transform) {
  if (!imageAsset?.width || !imageAsset?.height) {
    return {
      width: campaign?.photoArea?.width || campaign?.width || 1080,
      height: campaign?.photoArea?.height || campaign?.height || 1080,
      rotatedWidth: campaign?.photoArea?.width || campaign?.width || 1080,
      rotatedHeight: campaign?.photoArea?.height || campaign?.height || 1080,
      baseScale: 1,
    }
  }
  const baseScale = getBaseScale(imageAsset, campaign, transform.rotation)
  const width = imageAsset.width * baseScale * transform.zoom
  const height = imageAsset.height * baseScale * transform.zoom
  const rotatedBounds = getRotatedBounds(width, height, transform.rotation)
  return {
    width,
    height,
    rotatedWidth: rotatedBounds.width,
    rotatedHeight: rotatedBounds.height,
    baseScale,
  }
}

function clampTransform(transform, imageAsset, campaign) {
  return sharedClampTransform(transform, imageAsset, campaign)
}

function createDefaultTransform(imageAsset, campaign) {
  return sharedCreateDefaultTransform(imageAsset, campaign)
}

function revokeObjectUrl(asset) {
  const url = String(asset?.objectUrl || '').trim()
  if (url.startsWith('blob:')) {
    URL.revokeObjectURL(url)
  }
}

function blobToObjectUrl(blob) {
  return URL.createObjectURL(blob)
}

function loadImageElement(url) {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error('IMAGE_LOAD_FAILED'))
    image.src = url
  })
}

async function canvasToBlob(canvas, mimeType = 'image/png', quality) {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error('CANVAS_EXPORT_FAILED'))
        return
      }
      resolve(blob)
    }, mimeType, quality)
  })
}

async function downscaleImageIfNeeded(file) {
  const originalUrl = blobToObjectUrl(file)
  try {
    const originalImage = await loadImageElement(originalUrl)
    const longestEdge = Math.max(originalImage.naturalWidth || 0, originalImage.naturalHeight || 0)
    if (longestEdge <= MAX_INPUT_EDGE) {
      return {
        blob: file,
        objectUrl: originalUrl,
        image: originalImage,
        width: originalImage.naturalWidth,
        height: originalImage.naturalHeight,
        mimeType: file.type || 'image/jpeg',
        fileName: file.name || 'image',
        wasResized: false,
      }
    }

    const scale = MAX_INPUT_EDGE / longestEdge
    const width = Math.max(1, Math.round(originalImage.naturalWidth * scale))
    const height = Math.max(1, Math.round(originalImage.naturalHeight * scale))
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const context = canvas.getContext('2d')
    if (!context) throw new Error('CANVAS_CONTEXT_UNAVAILABLE')
    context.drawImage(originalImage, 0, 0, width, height)
    const targetMimeType = SUPPORTED_MIME_TYPES.has(file.type) ? file.type : 'image/jpeg'
    const scaledBlob = await canvasToBlob(canvas, targetMimeType, targetMimeType === 'image/png' ? undefined : 0.92)
    URL.revokeObjectURL(originalUrl)

    const scaledUrl = blobToObjectUrl(scaledBlob)
    const scaledImage = await loadImageElement(scaledUrl)
    return {
      blob: scaledBlob,
      objectUrl: scaledUrl,
      image: scaledImage,
      width: scaledImage.naturalWidth,
      height: scaledImage.naturalHeight,
      mimeType: scaledBlob.type || targetMimeType,
      fileName: file.name || 'image',
      wasResized: true,
    }
  } catch (error) {
    URL.revokeObjectURL(originalUrl)
    throw error
  }
}

async function loadRemoteImageAsset(url) {
  const response = await fetch(url, { credentials: 'include' })
  if (!response.ok) throw new Error('FRAME_FETCH_FAILED')
  const blob = await response.blob()
  const objectUrl = blobToObjectUrl(blob)
  try {
    const image = await loadImageElement(objectUrl)
    return {
      blob,
      objectUrl,
      image,
      width: image.naturalWidth,
      height: image.naturalHeight,
      mimeType: blob.type || 'image/png',
      fileName: 'frame.png',
      wasResized: false,
    }
  } catch (error) {
    URL.revokeObjectURL(objectUrl)
    throw error
  }
}

function isSupportedImageFile(file) {
  if (!file) return false
  const mimeType = String(file.type || '').toLowerCase()
  if (SUPPORTED_MIME_TYPES.has(mimeType)) return true
  const name = String(file.name || '').toLowerCase()
  return name.endsWith('.jpg') || name.endsWith('.jpeg') || name.endsWith('.png') || name.endsWith('.webp')
}

function getStorageNotice(mode) {
  if (mode === 'private') return 'Ảnh kết quả có thể được lưu trong chiến dịch và chỉ người quản lý chiến dịch được xem.'
  if (mode === 'public_gallery') return 'Nếu chiến dịch bật lưu ảnh trong bước sau, ảnh này có thể được lưu và hiển thị trong thư viện khi bạn đồng ý.'
  return 'Ảnh của bạn được xử lý trực tiếp trên thiết bị và không được lưu trên hệ thống.'
}

function isSafariLikeMobile() {
  const userAgent = String(window.navigator.userAgent || '').toLowerCase()
  const isIOS = /iphone|ipad|ipod/.test(userAgent)
  const isSafari = /safari/.test(userAgent) && !/crios|fxios|chrome|android/.test(userAgent)
  return isIOS || isSafari
}

function renderUserImage(context, campaign, userAsset, transform) {
  if (!userAsset?.image) return
  const metrics = getDisplayMetrics(userAsset, campaign, transform)
  context.save()
  context.translate(transform.centerX, transform.centerY)
  context.rotate((transform.rotation * Math.PI) / 180)
  context.drawImage(userAsset.image, -metrics.width / 2, -metrics.height / 2, metrics.width, metrics.height)
  context.restore()
}

function renderFrameCanvas(context, campaign, frameAsset, userAsset, transform, mode) {
  return sharedRenderFrameCanvas(context, campaign, frameAsset, userAsset, transform, mode)
}

function PhotoFrameViewport({ campaign, frameAsset, userAsset, transform, onPointerDown, onPointerMove, onPointerUp, onPointerCancel }) {
  const canvasRef = useRef(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || !campaign) return
    const context = canvas.getContext('2d')
    if (!context) return
    renderFrameCanvas(context, campaign, frameAsset, userAsset, transform, 'preview')
  }, [campaign, frameAsset, userAsset, transform])

  return (
    <div
      style={{
        width: '100%',
        maxWidth: 540,
        margin: '0 auto',
        position: 'relative',
        borderRadius: 24,
        overflow: 'hidden',
        border: '1px solid rgba(148, 163, 184, 0.35)',
        boxShadow: '0 20px 50px rgba(15, 23, 42, 0.12)',
      }}
      onPointerDown={userAsset ? onPointerDown : undefined}
      onPointerMove={userAsset ? onPointerMove : undefined}
      onPointerUp={userAsset ? onPointerUp : undefined}
      onPointerCancel={userAsset ? onPointerCancel : undefined}
    >
      <canvas
        ref={canvasRef}
        width={campaign.width}
        height={campaign.height}
        style={{
          display: 'block',
          width: '100%',
          height: 'auto',
          aspectRatio: `${campaign.width} / ${campaign.height}`,
          touchAction: userAsset ? 'none' : 'auto',
        }}
      />
      {!userAsset ? (
        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, textAlign: 'center', color: '#475569', pointerEvents: 'none' }}>
          Chọn ảnh của bạn để bắt đầu căn chỉnh vào vùng ảnh.
        </div>
      ) : null}
    </div>
  )
}

export default function PhotoFramePublicPage() {
  const tenant = useTenant()
  const params = useParams()
  const fileInputRef = useRef(null)
  const dragRef = useRef({ pointerId: null, startX: 0, startY: 0, startCenterX: 0, startCenterY: 0 })
  const assetRefs = useRef({ frameAsset: null, userAsset: null, resultAsset: null })
  const [loading, setLoading] = useState(false)
  const [frameLoading, setFrameLoading] = useState(false)
  const [creating, setCreating] = useState(false)
  const [campaign, setCampaign] = useState(null)
  const [availability, setAvailability] = useState({ code: '', message: '' })
  const [frameAsset, setFrameAsset] = useState(null)
  const [userAsset, setUserAsset] = useState(null)
  const [transform, setTransform] = useState({ centerX: 540, centerY: 540, zoom: 1, rotation: 0 })
  const [resultAsset, setResultAsset] = useState(null)
  const [errorMessage, setErrorMessage] = useState('')
  const [frameErrorMessage, setFrameErrorMessage] = useState('')
  const [editorNotice, setEditorNotice] = useState('')
  const [consentPublicGallery, setConsentPublicGallery] = useState(false)
  const [savingGeneratedPhoto, setSavingGeneratedPhoto] = useState(false)

  const slug = String(params?.slug || '').trim()
  const tenantCode = String(params?.tenantCode || tenant?.currentTenant?.tenantCode || tenant?.resolvedTenant?.tenantCode || '').trim()

  useTenantPageTitle(campaign?.name || 'Khung hình')

  useEffect(() => {
    assetRefs.current = { frameAsset, userAsset, resultAsset }
  }, [frameAsset, userAsset, resultAsset])

  useEffect(() => {
    return () => {
      revokeObjectUrl(assetRefs.current.frameAsset)
      revokeObjectUrl(assetRefs.current.userAsset)
      revokeObjectUrl(assetRefs.current.resultAsset)
    }
  }, [])

  useEffect(() => {
    let cancelled = false

    async function loadCampaign() {
      if (!slug) {
        setCampaign(null)
        setAvailability({ code: 'missing', message: 'Không tìm thấy chiến dịch khung hình.' })
        return
      }

      setLoading(true)
      setErrorMessage('')
      setFrameErrorMessage('')
      revokeObjectUrl(userAsset)
      revokeObjectUrl(resultAsset)
      setUserAsset(null)
      setResultAsset(null)
      setEditorNotice('')
      setConsentPublicGallery(false)

      try {
        const payload = await getPublicPhotoFrameCampaign(slug, tenantCode)
        if (cancelled) return
        setCampaign(resolveCampaignConfig(payload?.campaign || null))
        setAvailability(payload?.availability || { code: 'inactive', message: 'Chiến dịch hiện chưa hoạt động.' })
      } catch (error) {
        if (cancelled) return
        setCampaign(null)
        setAvailability({ code: 'missing', message: 'Không tìm thấy chiến dịch khung hình.' })
        setErrorMessage(getApiMessage(error, 'Không tải được chiến dịch khung hình.'))
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    loadCampaign()

    return () => {
      cancelled = true
    }
  }, [slug, tenantCode])

  useEffect(() => {
    let cancelled = false

    async function loadFrame() {
      if (!campaign?.frameImage?.url) {
        setFrameAsset(null)
        return
      }

      setFrameLoading(true)
      setFrameErrorMessage('')
      revokeObjectUrl(frameAsset)

      try {
        const asset = await loadRemoteImageAsset(campaign.frameImage.url)
        if (cancelled) {
          revokeObjectUrl(asset)
          return
        }
        setFrameAsset(asset)
      } catch {
        if (cancelled) return
        setFrameAsset(null)
        setFrameErrorMessage('Không tải được khung PNG của chiến dịch.')
      } finally {
        if (!cancelled) setFrameLoading(false)
      }
    }

    loadFrame()

    return () => {
      cancelled = true
    }
  }, [campaign?.frameImage?.url])

  const storageNotice = useMemo(() => getStorageNotice(campaign?.generatedImageStorageMode), [campaign?.generatedImageStorageMode])
  const effectiveMinZoom = useMemo(() => getEffectiveMinZoom(campaign), [campaign])

  function updateTransform(nextValue) {
    setTransform((current) => {
      const resolved = typeof nextValue === 'function' ? nextValue(current) : nextValue
      return clampTransform(resolved, userAsset, campaign)
    })
  }

  function openFilePicker() {
    fileInputRef.current?.click?.()
  }

  async function handleChooseImage(event) {
    const file = event.target.files?.[0] || null
    event.target.value = ''
    if (!file) return
    if (!isSupportedImageFile(file)) {
      setEditorNotice('Chỉ hỗ trợ ảnh JPEG, PNG hoặc WEBP.')
      return
    }

    setEditorNotice('')
    setErrorMessage('')
    try {
      const nextAsset = await downscaleImageIfNeeded(file)
      revokeObjectUrl(userAsset)
      revokeObjectUrl(resultAsset)
      setResultAsset(null)
      setUserAsset(nextAsset)
      setTransform(createDefaultTransform(nextAsset, campaign))
      if (nextAsset.wasResized) {
        setEditorNotice('Ảnh nguồn khá lớn nên đã được giảm kích thước trên thiết bị để tránh quá tải trình duyệt di động.')
      }
    } catch {
      setEditorNotice('Không đọc được ảnh đã chọn. Vui lòng thử ảnh khác.')
    }
  }

  function handlePointerDown(event) {
    if (!userAsset || !campaign) return
    dragRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      startCenterX: transform.centerX,
      startCenterY: transform.centerY,
    }
    event.currentTarget.setPointerCapture?.(event.pointerId)
  }

  function handlePointerMove(event) {
    if (dragRef.current.pointerId !== event.pointerId || !campaign || !userAsset) return
    event.preventDefault()
    const rect = event.currentTarget.getBoundingClientRect()
    const deltaX = (event.clientX - dragRef.current.startX) * (campaign.width / rect.width)
    const deltaY = (event.clientY - dragRef.current.startY) * (campaign.height / rect.height)
    updateTransform({
      ...transform,
      centerX: dragRef.current.startCenterX + deltaX,
      centerY: dragRef.current.startCenterY + deltaY,
    })
  }

  function handlePointerUp(event) {
    if (dragRef.current.pointerId !== event.pointerId) return
    dragRef.current.pointerId = null
    event.currentTarget.releasePointerCapture?.(event.pointerId)
  }

  function handlePointerCancel(event) {
    if (dragRef.current.pointerId !== event.pointerId) return
    dragRef.current.pointerId = null
    event.currentTarget.releasePointerCapture?.(event.pointerId)
  }

  function handleResetTransform() {
    if (!userAsset || !campaign) return
    setTransform(createDefaultTransform(userAsset, campaign))
    revokeObjectUrl(resultAsset)
    setResultAsset(null)
    setEditorNotice('')
  }

  function handleRotate(delta) {
    if (!userAsset || !campaign?.allowRotate) return
    revokeObjectUrl(resultAsset)
    setResultAsset(null)
    updateTransform((current) => ({
      ...current,
      rotation: normalizeRotation(current.rotation + delta),
    }))
  }

  function handleZoom(nextZoom) {
    if (!userAsset || !campaign) return
    revokeObjectUrl(resultAsset)
    setResultAsset(null)
    updateTransform((current) => ({
      ...current,
      zoom: clampNumber(nextZoom, campaign.minZoom, campaign.maxZoom),
    }))
  }

  async function handleCreateResult() {
    if (!campaign || !userAsset || !frameAsset) return
    if (campaign?.endAt && new Date(campaign.endAt).getTime() < Date.now()) {
      setErrorMessage('Chiến dịch đã kết thúc.')
      return
    }

    setCreating(true)
    setErrorMessage('')
    setEditorNotice('')

    try {
      const canvas = document.createElement('canvas')
      canvas.width = campaign.width
      canvas.height = campaign.height
      const context = canvas.getContext('2d')
      if (!context) throw new Error('CANVAS_CONTEXT_UNAVAILABLE')
      renderFrameCanvas(context, campaign, frameAsset, userAsset, transform, 'export')

      const mimeType = campaign.outputFormat === 'jpeg' ? 'image/jpeg' : 'image/png'
      const blob = await canvasToBlob(canvas, mimeType, campaign.outputFormat === 'jpeg' ? campaign.outputQuality : undefined)
      revokeObjectUrl(resultAsset)
      const objectUrl = blobToObjectUrl(blob)
      setResultAsset({
        blob,
        objectUrl,
        fileName: `${campaign.slug || 'photo-frame'}-frame.${campaign.outputFormat === 'jpeg' ? 'jpg' : 'png'}`,
      })

      if (campaign.generatedImageStorageMode === 'none') {
        setEditorNotice('Ảnh đã được tạo trên thiết bị và không được lưu trên hệ thống.')
      } else {
        setSavingGeneratedPhoto(true)
        try {
          const generatedFile = new File(
            [blob],
            `${campaign.slug || 'photo-frame'}-${Date.now()}.${campaign.outputFormat === 'jpeg' ? 'jpg' : 'png'}`,
            { type: blob.type || mimeType },
          )

          await savePublicGeneratedPhoto(campaign.slug, {
            file: generatedFile,
            consentPublicGallery,
            outputFormat: campaign.outputFormat,
            sessionId: `${campaign.slug || 'frame'}:${Date.now()}`,
          }, tenantCode)

          if (campaign.generatedImageStorageMode === 'private') {
            setEditorNotice('Ảnh đã được tạo và lưu riêng tư trong chiến dịch.')
          } else if (consentPublicGallery) {
            setEditorNotice('Ảnh đã được tạo và lưu trong chiến dịch. Bạn đã đồng ý cho phép hiển thị trong thư viện công khai.')
          } else {
            setEditorNotice('Ảnh đã được tạo và lưu trong chiến dịch. Ảnh này chưa được phép hiển thị công khai.')
          }
        } catch (saveError) {
          setEditorNotice('Ảnh đã được tạo. Hệ thống chưa lưu được bản sao, nhưng bạn vẫn có thể tải ảnh ngay.')
          console.error('[PhotoFramePublicPage] save generated photo failed', saveError)
        } finally {
          setSavingGeneratedPhoto(false)
        }
      }
    } catch {
      setErrorMessage('Không thể tạo ảnh kết quả. Vui lòng thử lại.')
    } finally {
      setCreating(false)
    }
  }

  function handleDownloadResult() {
    if (!resultAsset?.objectUrl) return
    if (isSafariLikeMobile()) {
      const popup = window.open(resultAsset.objectUrl, '_blank', 'noopener,noreferrer')
      if (popup) popup.opener = null
      return
    }
    const link = document.createElement('a')
    link.href = resultAsset.objectUrl
    link.download = resultAsset.fileName || 'photo-frame-result.png'
    link.rel = 'noopener'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  function handleEditAgain() {
    revokeObjectUrl(resultAsset)
    setResultAsset(null)
  }

  function handleMakeAnother() {
    revokeObjectUrl(userAsset)
    revokeObjectUrl(resultAsset)
    setUserAsset(null)
    setResultAsset(null)
    setEditorNotice('')
    setConsentPublicGallery(false)
  }

  if (loading) {
    return (
      <CContainer className='py-4'>
        <CAlert color='info' className='mb-0'>Đang tải chiến dịch khung hình...</CAlert>
      </CContainer>
    )
  }

  if (!campaign) {
    return (
      <CContainer className='py-4'>
        <CCard>
          <CCardBody className='text-center'>{errorMessage || 'Không tìm thấy chiến dịch khung hình.'}</CCardBody>
        </CCard>
      </CContainer>
    )
  }

  return (
    <CContainer className='py-3 py-md-4'>
      <CRow className='justify-content-center'>
        <CCol xs={12} xl={11}>
          <CCard className='border-0 shadow-sm' style={{ borderRadius: 28, overflow: 'hidden' }}>
            <CCardBody className='p-3 p-md-4 p-xl-5'>
              <div className='mb-4' style={{ maxWidth: 780 }}>
                <div className='small text-uppercase text-body-secondary mb-2'>Photo Frame Campaign</div>
                <h1 className='h3 h2-md mb-2'>{campaign.name || 'Khung hình'}</h1>
                {campaign.description ? <div className='text-body-secondary' style={{ whiteSpace: 'pre-wrap' }}>{campaign.description}</div> : null}
              </div>

              {errorMessage ? <CAlert color='danger'>{errorMessage}</CAlert> : null}
              {frameErrorMessage ? <CAlert color='danger'>{frameErrorMessage}</CAlert> : null}
              {editorNotice ? <CAlert color='warning'>{editorNotice}</CAlert> : null}

              <CRow className='g-4 align-items-start'>
                <CCol lg={7}>
                  {frameLoading ? <div className='d-flex align-items-center gap-2 py-4'><CSpinner size='sm' /> Đang tải khung PNG...</div> : null}
                  {frameAsset ? (
                    <PhotoFrameViewport
                      campaign={campaign}
                      frameAsset={frameAsset}
                      userAsset={userAsset}
                      transform={transform}
                      onPointerDown={handlePointerDown}
                      onPointerMove={handlePointerMove}
                      onPointerUp={handlePointerUp}
                      onPointerCancel={handlePointerCancel}
                    />
                  ) : null}
                </CCol>

                <CCol lg={5}>
                  <div className='border rounded-4 p-3 p-md-4' style={{ background: '#ffffff' }}>
                    <div className='fw-semibold mb-2'>Thông tin chiến dịch</div>
                    <div className='small text-body-secondary mb-1'>Canvas gốc: {campaign.width} x {campaign.height}</div>
                    <div className='small text-body-secondary mb-1'>Vùng ảnh: {campaign.photoShape} • ({Math.round(campaign.photoArea.x)}, {Math.round(campaign.photoArea.y)}) • {Math.round(campaign.photoArea.width)} x {Math.round(campaign.photoArea.height)}</div>
                    <div className='small text-body-secondary mb-3'>Hiển thị ngoài vùng ảnh: {campaign.showOutsidePhotoAreaInPreview}</div>
                    <div className='small text-body-secondary mb-2'>{storageNotice}</div>

                    {campaign.generatedImageStorageMode === 'public_gallery' ? (
                      <CFormCheck className='mt-3' label='Tôi đồng ý cho ảnh này được lưu và có thể hiển thị trong thư viện của chiến dịch.' checked={consentPublicGallery} onChange={(event) => setConsentPublicGallery(event.target.checked)} />
                    ) : null}

                    {availability.code !== 'active' ? (
                      <div className='mt-4'>
                        <CAlert color='warning' className='mb-0'>
                          <div>{availability.message || 'Chiến dịch hiện chưa hoạt động.'}</div>
                          {availability.code === 'scheduled' && availability.startAt ? <div className='small mt-2'>Bắt đầu lúc: {formatDateTime(availability.startAt)}</div> : null}
                          {availability.code === 'ended' && campaign.endAt ? <div className='small mt-2'>Kết thúc lúc: {formatDateTime(campaign.endAt)}</div> : null}
                        </CAlert>
                      </div>
                    ) : (
                      <div className='d-grid gap-3 mt-4'>
                        <div>
                          <CFormLabel>Chọn ảnh của bạn</CFormLabel>
                          <CFormInput ref={fileInputRef} type='file' accept='image/jpeg,image/png,image/webp' hidden onChange={handleChooseImage} />
                          <div className='d-flex flex-wrap gap-2'>
                            <CButton color='primary' onClick={openFilePicker}>Chọn ảnh của bạn</CButton>
                            {userAsset ? <CButton color='secondary' variant='outline' onClick={openFilePicker}>Đổi ảnh</CButton> : null}
                          </div>
                          {userAsset?.fileName ? <div className='small text-body-secondary mt-2'>{userAsset.fileName}</div> : null}
                        </div>

                        {userAsset ? (
                          <>
                            <div>
                              <div className='d-flex justify-content-between align-items-center mb-2'>
                                <CFormLabel className='mb-0'>Thu phóng</CFormLabel>
                                <div className='small text-body-secondary'>{transform.zoom.toFixed(2)}x</div>
                              </div>
                              <div className='d-flex align-items-center gap-2'>
                                <CButton color='secondary' variant='outline' onClick={() => handleZoom(transform.zoom - ZOOM_STEP)}>Thu nhỏ</CButton>
                                  <CFormInput type='range' min={effectiveMinZoom} max={campaign.maxZoom} step={0.01} value={transform.zoom} onChange={(event) => handleZoom(Number(event.target.value || campaign.defaultZoom))} />
                                <CButton color='secondary' variant='outline' onClick={() => handleZoom(transform.zoom + ZOOM_STEP)}>Phóng to</CButton>
                              </div>
                            </div>

                            <div className='d-flex flex-wrap gap-2'>
                              {campaign.allowRotate ? <CButton color='secondary' variant='outline' onClick={() => handleRotate(-90)}>Xoay trái</CButton> : null}
                              {campaign.allowRotate ? <CButton color='secondary' variant='outline' onClick={() => handleRotate(90)}>Xoay phải</CButton> : null}
                              <CButton color='secondary' variant='outline' onClick={handleResetTransform}>Đặt lại</CButton>
                              <CButton color='primary' onClick={handleCreateResult} disabled={creating || savingGeneratedPhoto || !frameAsset}>{creating || savingGeneratedPhoto ? 'Đang tạo ảnh...' : 'Tạo ảnh'}</CButton>
                            </div>

                            <div className='small text-body-secondary'>Kéo trực tiếp lên ảnh để căn chỉnh vị trí trong photo area. Preview và export dùng cùng pipeline canvas để tránh lệch.</div>
                          </>
                        ) : null}
                      </div>
                    )}
                  </div>
                </CCol>
              </CRow>

              {resultAsset ? (
                <div className='mt-4 pt-2'>
                  <CCard className='border-0' style={{ background: '#f8fafc', borderRadius: 24 }}>
                    <CCardBody className='p-3 p-md-4'>
                      <div className='d-flex justify-content-between align-items-start gap-3 flex-wrap mb-3'>
                        <div>
                          <div className='fw-semibold'>Ảnh kết quả</div>
                          <div className='small text-body-secondary'>Ảnh xuất đúng kích thước {campaign.width} x {campaign.height} theo clip {campaign.photoShape}.</div>
                        </div>
                        <div className='d-flex gap-2 flex-wrap'>
                          <CButton color='primary' onClick={handleDownloadResult}>Tải ảnh</CButton>
                          <CButton color='secondary' variant='outline' onClick={handleEditAgain}>Chỉnh sửa lại</CButton>
                          <CButton color='secondary' variant='outline' onClick={handleMakeAnother}>Làm ảnh khác</CButton>
                        </div>
                      </div>

                      <div style={{ display: 'flex', justifyContent: 'center' }}>
                        <img src={resultAsset.objectUrl} alt='Kết quả khung hình' style={{ width: '100%', maxWidth: 540, borderRadius: 20, border: '1px solid rgba(148, 163, 184, 0.35)' }} />
                      </div>

                      {isSafariLikeMobile() ? <div className='small text-body-secondary mt-3'>Trên một số trình duyệt di động như Safari, nút tải có thể mở ảnh ở tab mới để bạn lưu ảnh thủ công.</div> : null}
                    </CCardBody>
                  </CCard>
                </div>
              ) : null}
            </CCardBody>
          </CCard>
        </CCol>
      </CRow>
    </CContainer>
  )
}