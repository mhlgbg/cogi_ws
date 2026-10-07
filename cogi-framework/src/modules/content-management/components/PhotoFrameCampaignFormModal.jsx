import { useEffect, useMemo, useRef, useState } from 'react'
import {
  CAlert,
  CButton,
  CCol,
  CFormCheck,
  CFormInput,
  CFormLabel,
  CFormSelect,
  CFormTextarea,
  CModal,
  CModalBody,
  CModalFooter,
  CModalHeader,
  CModalTitle,
  CRow,
} from '@coreui/react'
import PhotoAreaVisualEditor from './PhotoAreaVisualEditor'

const DEFAULTS = {
  photoShape: 'rect',
  photoFitMode: 'cover',
  minZoom: 0.5,
  maxZoom: 4,
  defaultZoom: 1,
  defaultOffsetX: 0,
  defaultOffsetY: 0,
  allowRotate: true,
  showOutsidePhotoAreaInPreview: 'dim',
  outsideOverlayOpacity: 0.45,
  outputFormat: 'png',
  outputQuality: 0.92,
}

function formatDateTimeInput(value) {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  const hours = String(date.getHours()).padStart(2, '0')
  const minutes = String(date.getMinutes()).padStart(2, '0')
  return `${year}-${month}-${day}T${hours}:${minutes}`
}

function slugifyVietnamese(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[đĐ]/g, (char) => (char === 'Đ' ? 'D' : 'd'))
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-')
    .slice(0, 160)
    .replace(/-+$/g, '')
}

function sanitizeSlugInput(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[đĐ]/g, (char) => (char === 'Đ' ? 'D' : 'd'))
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]+/g, '')
    .replace(/-{2,}/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 160)
}

function toNumberString(value, fallbackValue) {
  const parsed = Number(value)
  return String(Number.isFinite(parsed) ? parsed : fallbackValue)
}

function clampNumber(value, minValue, maxValue) {
  return Math.min(maxValue, Math.max(minValue, value))
}

function normalizePhotoArea(form) {
  const width = Math.max(1, Number(form.width || 1080) || 1080)
  const height = Math.max(1, Number(form.height || 1080) || 1080)
  const x = Number(form.photoAreaX || 0) || 0
  const y = Number(form.photoAreaY || 0) || 0
  const areaWidth = Math.max(1, Number(form.photoAreaWidth || width) || width)
  const areaHeight = Math.max(1, Number(form.photoAreaHeight || height) || height)
  return { width, height, x, y, areaWidth, areaHeight }
}

function buildSvgShapePath(shape, area) {
  const x = area.x
  const y = area.y
  const width = area.areaWidth
  const height = area.areaHeight

  if (shape === 'circle') {
    const radius = Math.min(width, height) / 2
    const centerX = x + width / 2
    const centerY = y + height / 2
    return `M ${centerX} ${centerY - radius} A ${radius} ${radius} 0 1 1 ${centerX} ${centerY + radius} A ${radius} ${radius} 0 1 1 ${centerX} ${centerY - radius} Z`
  }

  if (shape === 'ellipse') {
    const centerX = x + width / 2
    const centerY = y + height / 2
    const radiusX = width / 2
    const radiusY = height / 2
    return `M ${centerX} ${centerY - radiusY} A ${radiusX} ${radiusY} 0 1 1 ${centerX} ${centerY + radiusY} A ${radiusX} ${radiusY} 0 1 1 ${centerX} ${centerY - radiusY} Z`
  }

  if (shape === 'rounded_rect') {
    const radius = clampNumber(Math.min(width, height) * 0.12, 0, Math.min(width, height) / 2)
    return [
      `M ${x + radius} ${y}`,
      `H ${x + width - radius}`,
      `Q ${x + width} ${y} ${x + width} ${y + radius}`,
      `V ${y + height - radius}`,
      `Q ${x + width} ${y + height} ${x + width - radius} ${y + height}`,
      `H ${x + radius}`,
      `Q ${x} ${y + height} ${x} ${y + height - radius}`,
      `V ${y + radius}`,
      `Q ${x} ${y} ${x + radius} ${y}`,
      'Z',
    ].join(' ')
  }

  return `M ${x} ${y} H ${x + width} V ${y + height} H ${x} Z`
}

function PhotoAreaConfigPreview({ imageUrl, form }) {
  const area = normalizePhotoArea(form)
  const shape = String(form.photoShape || DEFAULTS.photoShape)
  const previewMode = String(form.showOutsidePhotoAreaInPreview || DEFAULTS.showOutsidePhotoAreaInPreview)
  const overlayOpacity = clampNumber(Number(form.outsideOverlayOpacity || DEFAULTS.outsideOverlayOpacity) || DEFAULTS.outsideOverlayOpacity, 0, 1)
  const shapePath = buildSvgShapePath(shape, area)
  const overlayPath = `M 0 0 H ${area.width} V ${area.height} H 0 Z ${shapePath}`

  return (
    <div className='border rounded p-3 bg-body-tertiary'>
      <div className='fw-semibold mb-2'>Preview cấu hình vùng ảnh</div>
      <div className='small text-body-secondary mb-3'>Preview này giúp kiểm tra vị trí và hình dạng vùng ảnh. Frame PNG vẫn là lớp phủ ở trên ảnh người dùng trong public editor.</div>
      <div
        style={{
          width: '100%',
          maxWidth: 420,
          aspectRatio: `${area.width} / ${area.height}`,
          margin: '0 auto',
          position: 'relative',
          overflow: 'hidden',
          borderRadius: 12,
          border: '1px solid #cbd5e1',
          backgroundColor: '#f8fafc',
          backgroundImage: 'linear-gradient(45deg, #dbe4f0 25%, transparent 25%), linear-gradient(-45deg, #dbe4f0 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #dbe4f0 75%), linear-gradient(-45deg, transparent 75%, #dbe4f0 75%)',
          backgroundSize: '24px 24px',
          backgroundPosition: '0 0, 0 12px, 12px -12px, -12px 0px',
        }}
      >
        {imageUrl ? (
          <img
            src={imageUrl}
            alt='Frame preview'
            style={{
              position: 'absolute',
              inset: 0,
              width: '100%',
              height: '100%',
              objectFit: 'contain',
              zIndex: 3,
            }}
          />
        ) : null}

        <svg viewBox={`0 0 ${area.width} ${area.height}`} preserveAspectRatio='none' style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', zIndex: 2, pointerEvents: 'none' }}>
          {previewMode !== 'show' ? (
            <path d={overlayPath} fill={previewMode === 'hide' ? 'rgba(15, 23, 42, 0.92)' : `rgba(15, 23, 42, ${overlayOpacity})`} fillRule='evenodd' />
          ) : null}
          <path d={shapePath} fill='none' stroke='rgba(14, 165, 233, 0.95)' strokeWidth={Math.max(3, Math.min(area.width, area.height) * 0.01)} strokeDasharray='18 12' />
        </svg>
      </div>
      <div className='small text-body-secondary mt-3 text-center'>{`Vùng ảnh: ${shape} • (${Math.round(area.x)}, ${Math.round(area.y)}) • ${Math.round(area.areaWidth)} x ${Math.round(area.areaHeight)}`}</div>
    </div>
  )
}

function buildInitialState(initialValues, formOptions) {
  const defaults = formOptions?.defaults && typeof formOptions.defaults === 'object' ? formOptions.defaults : DEFAULTS
  const width = Number(initialValues?.width || 1080) || 1080
  const height = Number(initialValues?.height || 1080) || 1080
  return {
    name: initialValues?.name || '',
    slug: initialValues?.slug || '',
    description: initialValues?.description || '',
    width: toNumberString(initialValues?.width, 1080),
    height: toNumberString(initialValues?.height, 1080),
    photoShape: initialValues?.photoShape || defaults.photoShape || DEFAULTS.photoShape,
    photoAreaX: toNumberString(initialValues?.photoAreaX, defaults.photoAreaX ?? 0),
    photoAreaY: toNumberString(initialValues?.photoAreaY, defaults.photoAreaY ?? 0),
    photoAreaWidth: toNumberString(initialValues?.photoAreaWidth, defaults.photoAreaWidth ?? width),
    photoAreaHeight: toNumberString(initialValues?.photoAreaHeight, defaults.photoAreaHeight ?? height),
    photoFitMode: initialValues?.photoFitMode || defaults.photoFitMode || DEFAULTS.photoFitMode,
    minZoom: toNumberString(initialValues?.minZoom, defaults.minZoom ?? DEFAULTS.minZoom),
    maxZoom: toNumberString(initialValues?.maxZoom, defaults.maxZoom ?? DEFAULTS.maxZoom),
    defaultZoom: toNumberString(initialValues?.defaultZoom, defaults.defaultZoom ?? DEFAULTS.defaultZoom),
    defaultOffsetX: toNumberString(initialValues?.defaultOffsetX, defaults.defaultOffsetX ?? DEFAULTS.defaultOffsetX),
    defaultOffsetY: toNumberString(initialValues?.defaultOffsetY, defaults.defaultOffsetY ?? DEFAULTS.defaultOffsetY),
    allowRotate: initialValues?.allowRotate ?? defaults.allowRotate ?? DEFAULTS.allowRotate,
    showOutsidePhotoAreaInPreview: initialValues?.showOutsidePhotoAreaInPreview || defaults.showOutsidePhotoAreaInPreview || DEFAULTS.showOutsidePhotoAreaInPreview,
    outsideOverlayOpacity: toNumberString(initialValues?.outsideOverlayOpacity, defaults.outsideOverlayOpacity ?? DEFAULTS.outsideOverlayOpacity),
    outputFormat: initialValues?.outputFormat || defaults.outputFormat || DEFAULTS.outputFormat,
    outputQuality: toNumberString(initialValues?.outputQuality, defaults.outputQuality ?? DEFAULTS.outputQuality),
    startAt: formatDateTimeInput(initialValues?.startAt),
    endAt: formatDateTimeInput(initialValues?.endAt),
    generatedImageStorageMode: initialValues?.generatedImageStorageMode || 'none',
    status: initialValues?.status || 'draft',
  }
}

export default function PhotoFrameCampaignFormModal({
  visible,
  mode = 'create',
  initialValues,
  formOptions,
  submitting = false,
  framePreviewUrl = '',
  frameFileName = '',
  fileWarning = '',
  onFrameChange,
  onClose,
  onSubmit,
}) {
  const [form, setForm] = useState(buildInitialState(initialValues, formOptions))
  const [isSlugManuallyEdited, setIsSlugManuallyEdited] = useState(false)
  const fileInputRef = useRef(null)

  const isReadOnly = mode === 'view'
  const title = mode === 'create' ? 'Tạo Frame Campaign' : mode === 'edit' ? 'Chỉnh sửa Frame Campaign' : 'Chi tiết Frame Campaign'

  useEffect(() => {
    if (!visible) return
    setForm(buildInitialState(initialValues, formOptions))
    setIsSlugManuallyEdited(Boolean(initialValues?.id))
  }, [initialValues, formOptions, visible])

  const publicUrl = useMemo(() => {
    const template = String(formOptions?.publicUrlTemplate || '').trim()
    const slug = String(form.slug || '').trim()
    if (template && slug) return template.replace(':slug', encodeURIComponent(slug))
    return String(initialValues?.publicUrl || '').trim()
  }, [form.slug, formOptions?.publicUrlTemplate, initialValues?.publicUrl])

  function updateField(key, value) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  function handleNameChange(value) {
    updateField('name', value)
    if (!isSlugManuallyEdited) {
      updateField('slug', slugifyVietnamese(value))
    }
  }

  function handleSlugChange(value) {
    setIsSlugManuallyEdited(true)
    updateField('slug', sanitizeSlugInput(value))
  }

  async function handleCopyPublicUrl() {
    if (!publicUrl) return
    try {
      await navigator.clipboard.writeText(publicUrl)
    } catch {
      window.alert('Không thể sao chép link public')
    }
  }

  function handleOpenPublicUrl() {
    if (!publicUrl) return
    const popup = window.open(publicUrl, '_blank', 'noopener,noreferrer')
    if (popup) popup.opener = null
  }

  function handleOpenFilePicker() {
    if (submitting || isReadOnly) return
    fileInputRef.current?.click?.()
  }

  function handleFileInputChange(event) {
    const file = event.target.files?.[0] || null
    onFrameChange?.(file)
    event.target.value = ''
  }

  function handleUseWholeCanvasPhotoArea() {
    updateField('photoAreaX', '0')
    updateField('photoAreaY', '0')
    updateField('photoAreaWidth', String(Math.max(1, Number(form.width || 1080) || 1080)))
    updateField('photoAreaHeight', String(Math.max(1, Number(form.height || 1080) || 1080)))
  }

  function handleSubmit(event) {
    event.preventDefault()
    if (isReadOnly) return
    onSubmit?.({
      name: String(form.name || '').trim(),
      slug: String(form.slug || '').trim(),
      description: String(form.description || '').trim(),
      width: Number(form.width || 1080) || 1080,
      height: Number(form.height || 1080) || 1080,
      photoShape: String(form.photoShape || DEFAULTS.photoShape).trim(),
      photoAreaX: Number(form.photoAreaX || 0) || 0,
      photoAreaY: Number(form.photoAreaY || 0) || 0,
      photoAreaWidth: Number(form.photoAreaWidth || form.width || 1080) || Number(form.width || 1080) || 1080,
      photoAreaHeight: Number(form.photoAreaHeight || form.height || 1080) || Number(form.height || 1080) || 1080,
      photoFitMode: String(form.photoFitMode || DEFAULTS.photoFitMode).trim(),
      minZoom: Number(form.minZoom || DEFAULTS.minZoom) || DEFAULTS.minZoom,
      maxZoom: Number(form.maxZoom || DEFAULTS.maxZoom) || DEFAULTS.maxZoom,
      defaultZoom: Number(form.defaultZoom || DEFAULTS.defaultZoom) || DEFAULTS.defaultZoom,
      defaultOffsetX: Number(form.defaultOffsetX || 0) || 0,
      defaultOffsetY: Number(form.defaultOffsetY || 0) || 0,
      allowRotate: form.allowRotate === true,
      showOutsidePhotoAreaInPreview: String(form.showOutsidePhotoAreaInPreview || DEFAULTS.showOutsidePhotoAreaInPreview).trim(),
      outsideOverlayOpacity: Number(form.outsideOverlayOpacity || DEFAULTS.outsideOverlayOpacity) || DEFAULTS.outsideOverlayOpacity,
      outputFormat: String(form.outputFormat || DEFAULTS.outputFormat).trim(),
      outputQuality: Number(form.outputQuality || DEFAULTS.outputQuality) || DEFAULTS.outputQuality,
      startAt: String(form.startAt || '').trim() || null,
      endAt: String(form.endAt || '').trim() || null,
      generatedImageStorageMode: String(form.generatedImageStorageMode || 'none').trim(),
      status: String(form.status || 'draft').trim(),
    })
  }

  return (
    <CModal visible={visible} onClose={() => !submitting && onClose?.()} size='xl' scrollable backdrop='static'>
      <CModalHeader>
        <CModalTitle>{title}</CModalTitle>
      </CModalHeader>
      <form onSubmit={handleSubmit}>
        <CModalBody style={{ maxHeight: '75vh', overflowY: 'auto' }}>
          <CRow className='g-4'>
            <CCol lg={7}>
              <div className='border rounded p-3 mb-4'>
                <div className='fw-semibold mb-3'>Thông tin chung</div>
                <CRow className='g-3'>
                  <CCol md={8}>
                    <CFormLabel>Tên chiến dịch</CFormLabel>
                    <CFormInput value={form.name} onChange={(event) => handleNameChange(event.target.value)} required disabled={submitting || isReadOnly} />
                  </CCol>
                  <CCol md={4}>
                    <CFormLabel>Slug</CFormLabel>
                    <CFormInput value={form.slug} onChange={(event) => handleSlugChange(event.target.value)} required disabled={submitting || isReadOnly} />
                  </CCol>
                  <CCol xs={12}>
                    <CFormLabel>Mô tả</CFormLabel>
                    <CFormTextarea rows={5} value={form.description} onChange={(event) => updateField('description', event.target.value)} disabled={submitting || isReadOnly} />
                  </CCol>
                </CRow>
              </div>

              <div className='border rounded p-3 mb-4'>
                <div className='fw-semibold mb-3'>Khung hình</div>
                <div className='small text-body-secondary mb-3'>{formOptions?.recommendedFrameNotice || 'Khuyến nghị sử dụng PNG nền trong suốt. Khung sẽ được đặt phía trên ảnh của người dùng.'}</div>
                {fileWarning ? <CAlert color='warning' className='mb-3'>{fileWarning}</CAlert> : null}
                <CRow className='g-3'>
                  <CCol xs={12}>
                    <CFormLabel>Upload PNG</CFormLabel>
                    <CFormInput ref={fileInputRef} type='file' accept='image/png' hidden onChange={handleFileInputChange} />
                    <div className='d-flex flex-wrap gap-2 align-items-center'>
                      <CButton color='secondary' variant='outline' onClick={handleOpenFilePicker} disabled={submitting || isReadOnly}>
                        {framePreviewUrl ? 'Chọn PNG khác' : 'Chọn PNG'}
                      </CButton>
                      {frameFileName ? <div className='small text-body-secondary'>{frameFileName}</div> : null}
                    </div>
                  </CCol>
                  <CCol md={6}>
                    <CFormLabel>Width</CFormLabel>
                    <CFormInput type='number' min={1} step={1} value={form.width} onChange={(event) => updateField('width', event.target.value)} required disabled={submitting || isReadOnly} />
                  </CCol>
                  <CCol md={6}>
                    <CFormLabel>Height</CFormLabel>
                    <CFormInput type='number' min={1} step={1} value={form.height} onChange={(event) => updateField('height', event.target.value)} required disabled={submitting || isReadOnly} />
                  </CCol>
                </CRow>
              </div>

              <div className='border rounded p-3 mb-4'>
                <div className='fw-semibold mb-3'>Vùng hiển thị ảnh</div>
                <div className='small text-body-secondary mb-3'>Admin có thể kéo, resize và xem trực tiếp cách ảnh người dùng nằm dưới frame PNG. Tọa độ luôn được quy đổi theo canvas gốc của campaign, không phụ thuộc kích thước preview trên màn hình.</div>
                <PhotoAreaVisualEditor
                  form={form}
                  framePreviewUrl={framePreviewUrl}
                  formOptions={formOptions}
                  disabled={submitting || isReadOnly}
                  initialFormValues={buildInitialState(initialValues, formOptions)}
                  onUpdateField={updateField}
                />
              </div>

              <div className='border rounded p-3 mb-4'>
                <div className='fw-semibold mb-3'>Hiển thị ảnh</div>
                <CRow className='g-3'>
                  <CCol md={6}>
                    <CFormLabel>photoFitMode</CFormLabel>
                    <CFormSelect value={form.photoFitMode} onChange={(event) => updateField('photoFitMode', event.target.value)} disabled={submitting || isReadOnly}>
                      {(Array.isArray(formOptions?.photoFitModes) ? formOptions.photoFitModes : []).map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
                    </CFormSelect>
                    <div className='small text-body-secondary mt-1'>{(Array.isArray(formOptions?.photoFitModes) ? formOptions.photoFitModes : []).find((item) => item.value === form.photoFitMode)?.description || ''}</div>
                  </CCol>
                  <CCol md={6} className='d-flex align-items-end'>
                    <CFormCheck label='allowRotate' checked={form.allowRotate === true} onChange={(event) => updateField('allowRotate', event.target.checked)} disabled={submitting || isReadOnly} />
                  </CCol>
                  <CCol md={4}>
                    <CFormLabel>minZoom</CFormLabel>
                    <CFormInput type='number' step='0.01' min='0.05' value={form.minZoom} onChange={(event) => updateField('minZoom', event.target.value)} disabled={submitting || isReadOnly} />
                  </CCol>
                  <CCol md={4}>
                    <CFormLabel>maxZoom</CFormLabel>
                    <CFormInput type='number' step='0.01' min='0.05' value={form.maxZoom} onChange={(event) => updateField('maxZoom', event.target.value)} disabled={submitting || isReadOnly} />
                  </CCol>
                  <CCol md={4}>
                    <CFormLabel>defaultZoom</CFormLabel>
                    <CFormInput type='number' step='0.01' min='0.05' value={form.defaultZoom} onChange={(event) => updateField('defaultZoom', event.target.value)} disabled={submitting || isReadOnly} />
                  </CCol>
                  <CCol md={6}>
                    <CFormLabel>defaultOffsetX</CFormLabel>
                    <CFormInput type='number' step='1' value={form.defaultOffsetX} onChange={(event) => updateField('defaultOffsetX', event.target.value)} disabled={submitting || isReadOnly} />
                  </CCol>
                  <CCol md={6}>
                    <CFormLabel>defaultOffsetY</CFormLabel>
                    <CFormInput type='number' step='1' value={form.defaultOffsetY} onChange={(event) => updateField('defaultOffsetY', event.target.value)} disabled={submitting || isReadOnly} />
                  </CCol>
                  <CCol md={6}>
                    <CFormLabel>showOutsidePhotoAreaInPreview</CFormLabel>
                    <CFormSelect value={form.showOutsidePhotoAreaInPreview} onChange={(event) => updateField('showOutsidePhotoAreaInPreview', event.target.value)} disabled={submitting || isReadOnly}>
                      {(Array.isArray(formOptions?.previewModes) ? formOptions.previewModes : []).map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
                    </CFormSelect>
                  </CCol>
                  <CCol md={6}>
                    <CFormLabel>outsideOverlayOpacity</CFormLabel>
                    <CFormInput type='number' min='0' max='1' step='0.01' value={form.outsideOverlayOpacity} onChange={(event) => updateField('outsideOverlayOpacity', event.target.value)} disabled={submitting || isReadOnly} />
                  </CCol>
                </CRow>
              </div>

              <div className='border rounded p-3 mb-4'>
                <div className='fw-semibold mb-3'>Xuất ảnh</div>
                <CRow className='g-3'>
                  <CCol md={6}>
                    <CFormLabel>outputFormat</CFormLabel>
                    <CFormSelect value={form.outputFormat} onChange={(event) => updateField('outputFormat', event.target.value)} disabled={submitting || isReadOnly}>
                      {(Array.isArray(formOptions?.outputFormats) ? formOptions.outputFormats : []).map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
                    </CFormSelect>
                  </CCol>
                  <CCol md={6}>
                    <CFormLabel>outputQuality</CFormLabel>
                    <CFormInput type='number' min='0.1' max='1' step='0.01' value={form.outputQuality} onChange={(event) => updateField('outputQuality', event.target.value)} disabled={submitting || isReadOnly} />
                  </CCol>
                </CRow>
              </div>

              <div className='border rounded p-3 mb-4'>
                <div className='fw-semibold mb-3'>Thời gian</div>
                <CRow className='g-3'>
                  <CCol md={6}>
                    <CFormLabel>startAt</CFormLabel>
                    <CFormInput type='datetime-local' value={form.startAt} onChange={(event) => updateField('startAt', event.target.value)} disabled={submitting || isReadOnly} />
                  </CCol>
                  <CCol md={6}>
                    <CFormLabel>endAt</CFormLabel>
                    <CFormInput type='datetime-local' value={form.endAt} onChange={(event) => updateField('endAt', event.target.value)} disabled={submitting || isReadOnly} />
                  </CCol>
                </CRow>
              </div>

              <div className='border rounded p-3 mb-4'>
                <div className='fw-semibold mb-3'>Quyền riêng tư / lưu ảnh</div>
                <CFormLabel>Chế độ lưu ảnh</CFormLabel>
                <CFormSelect value={form.generatedImageStorageMode} onChange={(event) => updateField('generatedImageStorageMode', event.target.value)} disabled={submitting || isReadOnly}>
                  {(Array.isArray(formOptions?.storageModes) ? formOptions.storageModes : []).map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
                </CFormSelect>
                <div className='small text-body-secondary mt-2'>{(Array.isArray(formOptions?.storageModes) ? formOptions.storageModes : []).find((item) => item.value === form.generatedImageStorageMode)?.description || ''}</div>
              </div>

              <div className='border rounded p-3'>
                <div className='fw-semibold mb-3'>Trạng thái</div>
                <CFormSelect value={form.status} onChange={(event) => updateField('status', event.target.value)} disabled={submitting || isReadOnly}>
                  {(Array.isArray(formOptions?.statuses) ? formOptions.statuses : []).map((item) => <option key={item} value={item}>{item}</option>)}
                </CFormSelect>
              </div>
            </CCol>

            <CCol lg={5}>
              <div className='border rounded p-3 mb-4'>
                <div className='fw-semibold mb-2'>Public URL</div>
                <CFormInput value={publicUrl} readOnly />
                <div className='d-flex flex-wrap gap-2 mt-3'>
                  <CButton color='secondary' variant='outline' onClick={handleCopyPublicUrl} disabled={!publicUrl}>Sao chép link</CButton>
                  <CButton color='primary' variant='outline' onClick={handleOpenPublicUrl} disabled={!publicUrl}>Mở thử</CButton>
                </div>
                {!initialValues?.id ? <div className='small text-body-secondary mt-2'>Link dự kiến sẽ dùng sau khi campaign được lưu.</div> : null}
              </div>

              <PhotoAreaConfigPreview imageUrl={framePreviewUrl} form={form} />
            </CCol>
          </CRow>
        </CModalBody>
        <CModalFooter>
          <CButton color='secondary' variant='outline' onClick={onClose} disabled={submitting}>Đóng</CButton>
          {!isReadOnly ? <CButton color='primary' type='submit' disabled={submitting}>{submitting ? 'Đang lưu...' : 'Lưu campaign'}</CButton> : null}
        </CModalFooter>
      </form>
    </CModal>
  )
}