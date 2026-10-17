import { useEffect, useMemo, useRef, useState } from 'react'
import {
  CAlert,
  CBadge,
  CButton,
  CCard,
  CCardBody,
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
  CPagination,
  CPaginationItem,
  CRow,
  CSpinner,
  CTable,
  CTableBody,
  CTableDataCell,
  CTableHead,
  CTableHeaderCell,
  CTableRow,
} from '@coreui/react'
import {
  createManagedClubAchievementTemplate,
  getSportsClubManagementApiMessage,
  listManagedClubAchievementTemplates,
  updateManagedClubAchievementTemplate,
  uploadManagedClubAchievementTemplateAsset,
} from '../services/sportsClubManagementService'
import { resolveTemplateLayout } from '../utils/achievementPosterRenderer'

const DEFAULT_LAYOUT_OPTIONS = [
  { value: 'default', label: 'Default' },
  { value: 'race_result', label: 'Race Result' },
  { value: 'personal_best', label: 'Personal Best' },
]

const TEMPLATE_STATUS_OPTIONS = [
  { value: 'draft', label: 'Draft' },
  { value: 'active', label: 'Active' },
  { value: 'archived', label: 'Archived' },
]

const SPORT_TYPE_OPTIONS = [
  { value: 'running', label: 'Running' },
  { value: 'cycling', label: 'Cycling' },
  { value: 'badminton', label: 'Badminton' },
  { value: 'football', label: 'Football' },
  { value: 'swimming', label: 'Swimming' },
  { value: 'multisport', label: 'Multisport' },
  { value: 'other', label: 'Khác' },
]

const ACHIEVEMENT_TYPE_OPTIONS = [
  { value: 'personal_best', label: 'Personal Best' },
  { value: 'race_result', label: 'Race Result' },
  { value: 'champion', label: 'Champion' },
  { value: 'podium', label: 'Podium' },
  { value: 'finisher', label: 'Finisher' },
  { value: 'distance_milestone', label: 'Distance Milestone' },
  { value: 'streak', label: 'Streak' },
  { value: 'club_award', label: 'Club Award' },
  { value: 'system_award', label: 'System Award' },
  { value: 'other', label: 'Other' },
]

const TEMPLATE_LAYOUT_FIELD_OPTIONS = [
  { key: 'athleteName', label: 'athleteName' },
  { key: 'profileCode', label: 'profileCode' },
  { key: 'runnerCode', label: 'runnerCode' },
  { key: 'clubName', label: 'clubName' },
  { key: 'achievementTitle', label: 'achievementTitle' },
  { key: 'eventName', label: 'eventName' },
  { key: 'sport', label: 'sport' },
  { key: 'achievementType', label: 'achievementType' },
  { key: 'distance', label: 'distance' },
  { key: 'result', label: 'result' },
  { key: 'achievedAt', label: 'achievedAt' },
  { key: 'clubLogo', label: 'clubLogo' },
]

const TEXT_LAYER_PRESETS = [
  'CHÚC MỪNG THÀNH TÍCH',
  'PERSONAL BEST',
  'FINISHER',
]

function buildLayoutConfig(layoutKey, layoutConfig) {
  const resolved = resolveTemplateLayout({
    layoutKey,
    layoutConfig: layoutConfig && typeof layoutConfig === 'object' ? layoutConfig : {},
  })
  return {
    version: Number(resolved.version || 1),
    layers: Array.isArray(resolved.layers) ? resolved.layers.map((item) => ({ ...item })) : [],
  }
}

function buildTemplateForm(initialTemplate = null) {
  const layoutConfig = buildLayoutConfig(initialTemplate?.layoutKey || 'default', initialTemplate?.layoutConfig || {})
  return {
    name: initialTemplate?.name || '',
    code: initialTemplate?.code || '',
    sportType: initialTemplate?.sportType || 'running',
    achievementTypes: Array.isArray(initialTemplate?.achievementTypes) ? initialTemplate.achievementTypes : [],
    distanceLabels: Array.isArray(initialTemplate?.distanceLabels) ? initialTemplate.distanceLabels : [],
    priority: initialTemplate?.priority ?? 100,
    status: initialTemplate?.status || 'draft',
    layoutKey: initialTemplate?.layoutKey || 'default',
    layoutConfig,
    backgroundAsset: initialTemplate?.backgroundAsset || null,
    previewAsset: initialTemplate?.previewAsset || null,
  }
}

function normalizeStringList(value) {
  if (!Array.isArray(value)) return []
  return value.map((item) => String(item || '').trim()).filter(Boolean)
}

function buildTemplatePayload(form) {
  return {
    name: form.name || null,
    code: form.code || null,
    sportType: form.sportType || null,
    achievementTypes: Array.isArray(form.achievementTypes) ? form.achievementTypes : [],
    distanceLabels: Array.isArray(form.distanceLabels) ? form.distanceLabels : [],
    priority: Number.isInteger(Number(form.priority)) ? Number(form.priority) : 100,
    status: form.status || 'draft',
    layoutKey: form.layoutKey || 'default',
    layoutConfig: form.layoutConfig || { version: 1, layers: [] },
    backgroundAsset: form.backgroundAsset?.id || null,
    previewAsset: form.previewAsset?.id || null,
  }
}

function loadImageDimensions(url) {
  return new Promise((resolve) => {
    const target = String(url || '').trim()
    if (!target) {
      resolve(null)
      return
    }
    const image = new Image()
    image.onload = () => {
      const width = Number(image.naturalWidth || 0)
      const height = Number(image.naturalHeight || 0)
      resolve({
        width,
        height,
        ratio: height > 0 ? width / height : 0,
      })
    }
    image.onerror = () => resolve(null)
    image.src = target
  })
}

function formatImageMeta(meta) {
  if (!meta || !meta.width || !meta.height) return 'Không đọc được kích thước ảnh.'
  const ratio = meta.height > 0 ? meta.width / meta.height : 0
  return `${meta.width} × ${meta.height} (${ratio.toFixed(3)})`
}

function isPreferredPosterRatio(meta) {
  if (!meta || !meta.width || !meta.height) return true
  const targetRatio = 4 / 5
  return Math.abs((meta.width / meta.height) - targetRatio) <= 0.02
}

function TemplateEditorModal({ visible = false, club = null, initialTemplate = null, onClose, onSaved }) {
  const [form, setForm] = useState(() => buildTemplateForm(initialTemplate))
  const [saving, setSaving] = useState(false)
  const [uploadingBackground, setUploadingBackground] = useState(false)
  const [uploadingPreview, setUploadingPreview] = useState(false)
  const [error, setError] = useState('')
  const [backgroundMeta, setBackgroundMeta] = useState(null)
  const [previewMeta, setPreviewMeta] = useState(null)
  const [selectedFieldKey, setSelectedFieldKey] = useState('title')
  const [draggingFieldKey, setDraggingFieldKey] = useState('')
  const dragLayerRef = useRef(null)

  const isEdit = Boolean(initialTemplate?.id)

  useEffect(() => {
    if (!visible) return
    const nextForm = buildTemplateForm(initialTemplate)
    setForm(nextForm)
    setError('')
    setSaving(false)
    setUploadingBackground(false)
    setUploadingPreview(false)
    const firstFieldKey = nextForm?.layoutConfig?.layers?.[0]?.id || 'title'
    setSelectedFieldKey(String(firstFieldKey))
    setDraggingFieldKey('')
  }, [visible, initialTemplate])

  useEffect(() => {
    let mounted = true
    async function run() {
      const result = await loadImageDimensions(form?.backgroundAsset?.url)
      if (mounted) setBackgroundMeta(result)
    }
    run()
    return () => { mounted = false }
  }, [form?.backgroundAsset?.url])

  useEffect(() => {
    let mounted = true
    async function run() {
      const result = await loadImageDimensions(form?.previewAsset?.url)
      if (mounted) setPreviewMeta(result)
    }
    run()
    return () => { mounted = false }
  }, [form?.previewAsset?.url])

  useEffect(() => {
    if (!draggingFieldKey) return undefined
    const stopDrag = () => setDraggingFieldKey('')
    window.addEventListener('mouseup', stopDrag)
    return () => window.removeEventListener('mouseup', stopDrag)
  }, [draggingFieldKey])

  function updateField(field, value) {
    setForm((current) => ({ ...current, [field]: value }))
  }

  function toggleEnumList(field, value) {
    setForm((current) => {
      const existing = Array.isArray(current[field]) ? current[field] : []
      const next = existing.includes(value) ? existing.filter((item) => item !== value) : [...existing, value]
      return { ...current, [field]: next }
    })
  }

  function replaceLayoutFields(nextFields) {
    updateField('layoutConfig', {
      ...(form.layoutConfig || {}),
      version: Number(form.layoutConfig?.version || 1),
      layers: Array.isArray(nextFields) ? nextFields : [],
    })
  }

  function updateLayoutField(fieldKey, patch) {
    const currentFields = Array.isArray(form.layoutConfig?.layers) ? form.layoutConfig.layers : []
    replaceLayoutFields(currentFields.map((item) => (String(item.id) === String(fieldKey) ? { ...item, ...patch } : item)))
  }

  function resetLayoutByKey(nextLayoutKey) {
    const nextLayoutConfig = buildLayoutConfig(nextLayoutKey, {})
    updateField('layoutConfig', nextLayoutConfig)
    setSelectedFieldKey(nextLayoutConfig?.layers?.[0]?.id || 'title')
  }

  async function handleUploadAsset(field, usage, file) {
    if (!file || !club?.id) return
    const toggleUploading = field === 'backgroundAsset' ? setUploadingBackground : setUploadingPreview
    try {
      toggleUploading(true)
      setError('')
      const uploaded = await uploadManagedClubAchievementTemplateAsset(club.id, { file, usage })
      updateField(field, {
        id: uploaded?.id || null,
        name: uploaded?.originalName || uploaded?.fileName || file.name,
        url: uploaded?.url || '',
        mime: uploaded?.mimeType || file.type || '',
        provider: uploaded?.provider || '',
        fileAssetId: uploaded?.id || null,
      })
    } catch (requestError) {
      setError(getSportsClubManagementApiMessage(requestError, 'Upload ảnh thất bại.'))
    } finally {
      toggleUploading(false)
    }
  }

  async function handleSave() {
    try {
      setSaving(true)
      setError('')
      const payload = buildTemplatePayload(form)
      const result = isEdit
        ? await updateManagedClubAchievementTemplate(club.id, initialTemplate.id, payload)
        : await createManagedClubAchievementTemplate(club.id, payload)
      onSaved?.(result)
    } catch (requestError) {
      setError(getSportsClubManagementApiMessage(requestError, isEdit ? 'Không thể cập nhật mẫu ảnh.' : 'Không thể tạo mẫu ảnh.'))
    } finally {
      setSaving(false)
    }
  }

  const isUploading = uploadingBackground || uploadingPreview
  const layoutFields = Array.isArray(form.layoutConfig?.layers) ? form.layoutConfig.layers : []
  const selectedField = layoutFields.find((item) => String(item.id) === String(selectedFieldKey)) || null

  function handleDragStart(fieldKey) {
    setDraggingFieldKey(String(fieldKey))
  }

  function handleDragMove(event) {
    if (!draggingFieldKey) return
    const layer = dragLayerRef.current
    if (!layer) return
    const rect = layer.getBoundingClientRect()
    if (!rect.width || !rect.height) return
    const ratioX = Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width))
    const ratioY = Math.min(1, Math.max(0, (event.clientY - rect.top) / rect.height))
    updateLayoutField(draggingFieldKey, { x: Number(ratioX.toFixed(4)), y: Number(ratioY.toFixed(4)) })
  }

  function handleDragEnd() {
    if (!draggingFieldKey) return
    setDraggingFieldKey('')
  }

  return (
    <CModal visible={visible} onClose={() => !saving && !isUploading && onClose?.()} size='xl' scrollable>
      <CModalHeader>
        <CModalTitle>{isEdit ? 'Chỉnh sửa mẫu ảnh thành tích' : 'Tạo mới mẫu ảnh thành tích'}</CModalTitle>
      </CModalHeader>
      <CModalBody>
        {error ? <CAlert color='danger'>{error}</CAlert> : null}

        <div className='mb-4'>
          <h6 className='mb-3'>A. Thông tin mẫu</h6>
          <CRow className='g-3'>
            <CCol md={8}>
              <CFormLabel>Tên mẫu</CFormLabel>
              <CFormInput value={form.name} onChange={(event) => updateField('name', event.target.value)} />
            </CCol>
            <CCol md={4}>
              <CFormLabel>Mã mẫu</CFormLabel>
              <CFormInput value={form.code} onChange={(event) => updateField('code', event.target.value)} />
            </CCol>
            <CCol md={4}>
              <CFormLabel>Môn thể thao</CFormLabel>
              <CFormSelect value={form.sportType} onChange={(event) => updateField('sportType', event.target.value)}>
                {SPORT_TYPE_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
              </CFormSelect>
            </CCol>
            <CCol md={4}>
              <CFormLabel>Trạng thái</CFormLabel>
              <CFormSelect value={form.status} onChange={(event) => updateField('status', event.target.value)}>
                {TEMPLATE_STATUS_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
              </CFormSelect>
            </CCol>
            <CCol md={4}>
              <CFormLabel>Độ ưu tiên</CFormLabel>
              <CFormInput type='number' value={form.priority} onChange={(event) => updateField('priority', event.target.value)} />
            </CCol>
            <CCol md={12}>
              <CFormLabel>Loại thành tích áp dụng</CFormLabel>
              <div className='d-flex flex-wrap gap-2'>
                {ACHIEVEMENT_TYPE_OPTIONS.map((option) => (
                  <CFormCheck
                    key={option.value}
                    id={`achievement-${option.value}`}
                    label={option.label}
                    checked={form.achievementTypes.includes(option.value)}
                    onChange={() => toggleEnumList('achievementTypes', option.value)}
                  />
                ))}
              </div>
            </CCol>
            <CCol md={12}>
              <CFormLabel>Cự ly áp dụng</CFormLabel>
              <CFormTextarea
                rows={2}
                value={normalizeStringList(form.distanceLabels).join(', ')}
                onChange={(event) => updateField('distanceLabels', event.target.value.split(',').map((item) => item.trim()).filter(Boolean))}
                placeholder='Ví dụ: FM, HM, 10k (để trống = tất cả)'
              />
            </CCol>
          </CRow>
        </div>

        <div className='mb-4'>
          <h6 className='mb-3'>B. Thiết kế</h6>
          <CRow className='g-3'>
            <CCol md={4}>
              <CFormLabel>Layout</CFormLabel>
              <CFormSelect value={form.layoutKey} onChange={(event) => {
                updateField('layoutKey', event.target.value)
                resetLayoutByKey(event.target.value)
              }}>
                {DEFAULT_LAYOUT_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
              </CFormSelect>
            </CCol>
            <CCol md={8}>
              <CFormLabel>Upload ảnh nền (PNG/JPG/WebP)</CFormLabel>
              <div>
                <CFormInput
                  type='file'
                  accept='image/png,image/jpeg,image/webp'
                  disabled={uploadingBackground}
                  onChange={(event) => handleUploadAsset('backgroundAsset', 'background', event.target.files?.[0] || null)}
                />
                {uploadingBackground ? <div className='small text-body-secondary mt-1'>Đang upload ảnh nền...</div> : null}
              </div>
            </CCol>
            <CCol md={8}>
              <CFormLabel>Upload ảnh preview (PNG/JPG/WebP)</CFormLabel>
              <div>
                <CFormInput
                  type='file'
                  accept='image/png,image/jpeg,image/webp'
                  disabled={uploadingPreview}
                  onChange={(event) => handleUploadAsset('previewAsset', 'preview', event.target.files?.[0] || null)}
                />
                {uploadingPreview ? <div className='small text-body-secondary mt-1'>Đang upload ảnh preview...</div> : null}
              </div>
            </CCol>
          </CRow>
        </div>

        <div>
          <h6 className='mb-3'>C. Xem trước</h6>
          <CRow className='g-3'>
            <CCol md={6}>
              <div className='border rounded p-2'>
                <div className='fw-semibold mb-2'>Ảnh nền</div>
                {form.backgroundAsset?.url ? (
                  <>
                    <div
                      ref={dragLayerRef}
                      onMouseMove={handleDragMove}
                      onMouseLeave={handleDragEnd}
                      style={{ position: 'relative', width: '100%', maxHeight: 260, overflow: 'hidden', borderRadius: 8, cursor: draggingFieldKey ? 'grabbing' : 'default' }}
                    >
                      <img src={form.backgroundAsset.url} alt='Background preview' style={{ width: '100%', maxHeight: 260, objectFit: 'cover', borderRadius: 8 }} />
                      {layoutFields.filter((item) => item?.visible !== false).map((item) => (
                        <div
                          key={`layout-field-${item.id}`}
                          onMouseDown={() => handleDragStart(item.id)}
                          onMouseUp={handleDragEnd}
                          onClick={() => setSelectedFieldKey(String(item.id))}
                          style={{
                            position: 'absolute',
                            left: `${Math.max(0, Math.min(1, Number(item?.x || 0))) * 100}%`,
                            top: `${Math.max(0, Math.min(1, Number(item?.y || 0))) * 100}%`,
                            width: item?.type === 'image' ? undefined : `${Math.max(0.05, Math.min(1, Number(item?.width || 0.3))) * 100}%`,
                            transform: item?.textAlign === 'center' ? 'translateX(-50%)' : item?.textAlign === 'right' ? 'translateX(-100%)' : 'none',
                            fontSize: 11,
                            padding: '2px 6px',
                            borderRadius: 4,
                            color: '#fff',
                            background: String(selectedFieldKey) === String(item.id) ? 'rgba(13,110,253,0.9)' : 'rgba(0,0,0,0.65)',
                            border: String(selectedFieldKey) === String(item.id) ? '1px solid #fff' : '1px solid rgba(255,255,255,0.5)',
                            userSelect: 'none',
                            cursor: 'grab',
                            whiteSpace: item?.type === 'image' ? 'nowrap' : 'normal',
                            textAlign: item?.textAlign || 'left',
                          }}
                        >
                          {item.type === 'text' ? (item.content || item.id) : (item.field || item.id)}
                        </div>
                      ))}
                    </div>
                    <div className='small text-body-secondary mt-2'>{formatImageMeta(backgroundMeta)}</div>
                    {!isPreferredPosterRatio(backgroundMeta) ? <CAlert color='warning' className='mt-2 mb-0 py-2'>Khuyến nghị tỷ lệ 4:5 (1080×1350).</CAlert> : null}
                    <div className='d-flex gap-2 mt-2'>
                      <CButton size='sm' color='secondary' variant='outline' onClick={() => window.open(form.backgroundAsset.url, '_blank')}>Xem lớn</CButton>
                      <CButton size='sm' color='danger' variant='outline' onClick={() => updateField('backgroundAsset', null)}>Gỡ ảnh</CButton>
                    </div>
                  </>
                ) : (
                  <div className='text-body-secondary small'>Chưa có ảnh nền.</div>
                )}
              </div>
            </CCol>
            <CCol md={6}>
              <div className='border rounded p-2'>
                <div className='fw-semibold mb-2'>Ảnh preview</div>
                {form.previewAsset?.url ? (
                  <>
                    <img src={form.previewAsset.url} alt='Template preview' style={{ width: '100%', maxHeight: 260, objectFit: 'cover', borderRadius: 8 }} />
                    <div className='small text-body-secondary mt-2'>{formatImageMeta(previewMeta)}</div>
                    {!isPreferredPosterRatio(previewMeta) ? <CAlert color='warning' className='mt-2 mb-0 py-2'>Khuyến nghị tỷ lệ 4:5 (1080×1350).</CAlert> : null}
                    <div className='d-flex gap-2 mt-2'>
                      <CButton size='sm' color='secondary' variant='outline' onClick={() => window.open(form.previewAsset.url, '_blank')}>Xem lớn</CButton>
                      <CButton size='sm' color='danger' variant='outline' onClick={() => updateField('previewAsset', null)}>Gỡ ảnh</CButton>
                    </div>
                  </>
                ) : (
                  <div className='text-body-secondary small'>Chưa có ảnh preview.</div>
                )}
              </div>
            </CCol>
            <CCol md={12}>
              <div className='border rounded p-3'>
                <div className='fw-semibold mb-2'>Bố cục Layer (kéo/thả trên ảnh nền)</div>
                <CRow className='g-2'>
                  <CCol md={4}>
                    <CFormLabel>Layer</CFormLabel>
                    <CFormSelect value={selectedFieldKey} onChange={(event) => setSelectedFieldKey(event.target.value)}>
                      {layoutFields.map((item) => <option key={`field-select-${item.id}`} value={item.id}>{item.id}</option>)}
                    </CFormSelect>
                  </CCol>
                  <CCol md={4}>
                    <CFormLabel>Loại layer</CFormLabel>
                    <CFormSelect
                      value={selectedField?.type || 'data'}
                      onChange={(event) => selectedField ? updateLayoutField(selectedField.id, { type: event.target.value }) : null}
                    >
                      <option value='data'>Data Layer</option>
                      <option value='text'>Text Layer</option>
                      <option value='image'>Image Layer</option>
                    </CFormSelect>
                  </CCol>
                  <CCol md={2}>
                    <CFormLabel>Hiển thị</CFormLabel>
                    <CFormCheck
                      className='mt-2'
                      checked={selectedField?.visible !== false}
                      onChange={(event) => selectedField ? updateLayoutField(selectedField.id, { visible: event.target.checked }) : null}
                    />
                  </CCol>
                  <CCol md={2}>
                    <CFormLabel>Ẩn khi rỗng</CFormLabel>
                    <CFormCheck
                      className='mt-2'
                      checked={selectedField?.hideWhenEmpty !== false}
                      onChange={(event) => selectedField ? updateLayoutField(selectedField.id, { hideWhenEmpty: event.target.checked }) : null}
                    />
                  </CCol>
                  {selectedField?.type === 'data' ? (
                    <CCol md={4}>
                      <CFormLabel>Field dữ liệu</CFormLabel>
                      <CFormSelect
                        value={selectedField?.field || ''}
                        onChange={(event) => selectedField ? updateLayoutField(selectedField.id, { field: event.target.value }) : null}
                      >
                        {TEMPLATE_LAYOUT_FIELD_OPTIONS.map((item) => <option key={`field-${item.key}`} value={item.key}>{item.label}</option>)}
                      </CFormSelect>
                    </CCol>
                  ) : null}
                  {selectedField?.type === 'data' ? (
                    <CCol md={4}>
                      <CFormLabel>Kết hợp nhiều field</CFormLabel>
                      <CFormInput
                        value={Array.isArray(selectedField?.fields) ? selectedField.fields.join(', ') : ''}
                        onChange={(event) => {
                          if (!selectedField) return
                          const fields = event.target.value.split(',').map((item) => String(item || '').trim()).filter(Boolean)
                          updateLayoutField(selectedField.id, { fields })
                        }}
                        placeholder='Ví dụ: result, distance'
                      />
                    </CCol>
                  ) : null}
                  {selectedField?.type === 'data' ? (
                    <CCol md={4}>
                      <CFormLabel>Format</CFormLabel>
                      <CFormSelect
                        value={selectedField?.format?.type || ''}
                        onChange={(event) => selectedField ? updateLayoutField(selectedField.id, { format: { ...(selectedField?.format || {}), type: event.target.value } }) : null}
                      >
                        <option value=''>Mặc định</option>
                        <option value='duration_distance'>Result + Distance</option>
                        <option value='km'>Distance km</option>
                        <option value='full'>Distance full</option>
                        <option value='vi_long_upper'>Ngày VI long</option>
                        <option value='runner_prefix'>Runner #code</option>
                      </CFormSelect>
                    </CCol>
                  ) : null}
                  {selectedField?.type === 'text' ? (
                    <CCol md={8}>
                      <CFormLabel>Nội dung text</CFormLabel>
                      <CFormInput
                        value={selectedField?.content || ''}
                        onChange={(event) => selectedField ? updateLayoutField(selectedField.id, { content: event.target.value }) : null}
                        placeholder='Ví dụ: CHÚC MỪNG THÀNH TÍCH'
                      />
                    </CCol>
                  ) : null}
                  {selectedField?.type === 'text' ? (
                    <CCol md={4}>
                      <CFormLabel>Text preset</CFormLabel>
                      <CFormSelect
                        value=''
                        onChange={(event) => {
                          if (!selectedField) return
                          const preset = String(event.target.value || '')
                          if (!preset) return
                          updateLayoutField(selectedField.id, { content: preset })
                        }}
                      >
                        <option value=''>Chọn preset</option>
                        {TEXT_LAYER_PRESETS.map((item) => <option key={item} value={item}>{item}</option>)}
                      </CFormSelect>
                    </CCol>
                  ) : null}
                  {selectedField?.type === 'image' ? (
                    <CCol md={6}>
                      <CFormLabel>Image field</CFormLabel>
                      <CFormSelect
                        value={selectedField?.field || 'clubLogo'}
                        onChange={(event) => selectedField ? updateLayoutField(selectedField.id, { field: event.target.value }) : null}
                      >
                        <option value='clubLogo'>clubLogo</option>
                      </CFormSelect>
                    </CCol>
                  ) : null}
                  {selectedField?.type === 'image' ? (
                    <CCol md={6}>
                      <CFormLabel>Opacity (%)</CFormLabel>
                      <CFormInput
                        type='number'
                        min={0}
                        max={100}
                        value={Math.round(Number(selectedField?.opacity ?? 1) * 100)}
                        onChange={(event) => selectedField ? updateLayoutField(selectedField.id, { opacity: Math.max(0, Math.min(1, Number(event.target.value || 100) / 100)) }) : null}
                      />
                    </CCol>
                  ) : null}
                  <CCol md={2}>
                    <CFormLabel>X (%)</CFormLabel>
                    <CFormInput
                      type='number'
                      min={0}
                      max={100}
                      value={selectedField ? Math.round(Number(selectedField.x || 0) * 100) : 0}
                      onChange={(event) => selectedField ? updateLayoutField(selectedField.id, { x: Math.max(0, Math.min(1, Number(event.target.value || 0) / 100)) }) : null}
                    />
                  </CCol>
                  <CCol md={2}>
                    <CFormLabel>Y (%)</CFormLabel>
                    <CFormInput
                      type='number'
                      min={0}
                      max={100}
                      value={selectedField ? Math.round(Number(selectedField.y || 0) * 100) : 0}
                      onChange={(event) => selectedField ? updateLayoutField(selectedField.id, { y: Math.max(0, Math.min(1, Number(event.target.value || 0) / 100)) }) : null}
                    />
                  </CCol>
                  <CCol md={2}>
                    <CFormLabel>Font (%)</CFormLabel>
                    <CFormInput
                      type='number'
                      step='0.1'
                      min={1}
                      max={20}
                      value={selectedField ? Number(selectedField.fontSize || 0.035) * 100 : 3.5}
                      onChange={(event) => selectedField ? updateLayoutField(selectedField.id, { fontSize: Math.max(0.01, Number(event.target.value || 3.5) / 100) }) : null}
                    />
                  </CCol>
                  <CCol md={2}>
                    <CFormLabel>Rộng (%)</CFormLabel>
                    <CFormInput
                      type='number'
                      min={1}
                      max={100}
                      value={selectedField ? Math.round(Number(selectedField.width || 0.4) * 100) : 40}
                      onChange={(event) => selectedField ? updateLayoutField(selectedField.id, { width: Math.max(0.01, Math.min(1, Number(event.target.value || 40) / 100)) }) : null}
                    />
                  </CCol>
                  <CCol md={2}>
                    <CFormLabel>Cao (%)</CFormLabel>
                    <CFormInput
                      type='number'
                      min={1}
                      max={100}
                      value={selectedField ? Math.round(Number(selectedField.height || 0.1) * 100) : 10}
                      onChange={(event) => selectedField ? updateLayoutField(selectedField.id, { height: Math.max(0.01, Math.min(1, Number(event.target.value || 10) / 100)) }) : null}
                    />
                  </CCol>
                  <CCol md={3}>
                    <CFormLabel>Màu chữ</CFormLabel>
                    <CFormInput
                      type='color'
                      value={selectedField?.color || '#ffffff'}
                      onChange={(event) => selectedField ? updateLayoutField(selectedField.id, { color: event.target.value }) : null}
                    />
                  </CCol>
                  <CCol md={3}>
                    <CFormLabel>Độ đậm</CFormLabel>
                    <CFormSelect
                      value={selectedField?.fontWeight || '400'}
                      onChange={(event) => selectedField ? updateLayoutField(selectedField.id, { fontWeight: event.target.value }) : null}
                    >
                      <option value='400'>400</option>
                      <option value='500'>500</option>
                      <option value='600'>600</option>
                      <option value='700'>700</option>
                      <option value='800'>800</option>
                    </CFormSelect>
                  </CCol>
                  <CCol md={3}>
                    <CFormLabel>Căn lề</CFormLabel>
                    <CFormSelect
                      value={selectedField?.textAlign || 'left'}
                      onChange={(event) => selectedField ? updateLayoutField(selectedField.id, { textAlign: event.target.value }) : null}
                    >
                      <option value='left'>Left</option>
                      <option value='center'>Center</option>
                      <option value='right'>Right</option>
                    </CFormSelect>
                  </CCol>
                  <CCol md={3}>
                    <CFormLabel>Thêm Data Layer</CFormLabel>
                    <CFormSelect
                      value=''
                      onChange={(event) => {
                        const fieldKey = String(event.target.value || '')
                        if (!fieldKey) return
                        const exists = layoutFields.some((item) => item.type === 'data' && String(item.field) === fieldKey)
                        if (exists) {
                          const matched = layoutFields.find((item) => item.type === 'data' && String(item.field) === fieldKey)
                          if (matched?.id) setSelectedFieldKey(String(matched.id))
                          return
                        }
                        const fallback = TEMPLATE_LAYOUT_FIELD_OPTIONS.find((item) => item.key === fieldKey)
                        const layerId = `data-${fieldKey}-${Date.now()}`
                        replaceLayoutFields([
                          ...layoutFields,
                          { id: layerId, type: fieldKey === 'clubLogo' ? 'image' : 'data', field: fallback?.key || fieldKey, x: 0.1, y: 0.1, width: 0.4, height: 0.1, fontSize: 0.035, color: '#ffffff', fontWeight: '600', textAlign: 'left', visible: true, hideWhenEmpty: true, zIndex: layoutFields.length + 1 },
                        ])
                        setSelectedFieldKey(layerId)
                      }}
                    >
                      <option value=''>Thêm trường</option>
                      {TEMPLATE_LAYOUT_FIELD_OPTIONS.map((item) => <option key={`preset-field-${item.key}`} value={item.key}>{item.label}</option>)}
                    </CFormSelect>
                  </CCol>
                  <CCol md={3}>
                    <CFormLabel>Thêm Text Layer</CFormLabel>
                    <CButton
                      color='secondary'
                      variant='outline'
                      className='w-100'
                      onClick={() => {
                        const layerId = `text-${Date.now()}`
                        replaceLayoutFields([
                          ...layoutFields,
                          { id: layerId, type: 'text', content: 'CHÚC MỪNG THÀNH TÍCH', x: 0.1, y: 0.1, width: 0.5, height: 0.08, fontSize: 0.04, color: '#ffffff', fontWeight: '700', textAlign: 'left', visible: true, hideWhenEmpty: false, zIndex: layoutFields.length + 1 },
                        ])
                        setSelectedFieldKey(layerId)
                      }}
                    >
                      + Text
                    </CButton>
                  </CCol>
                  <CCol md={3}>
                    <CFormLabel>Z-Index</CFormLabel>
                    <CFormInput
                      type='number'
                      value={selectedField ? Number(selectedField.zIndex || 0) : 0}
                      onChange={(event) => selectedField ? updateLayoutField(selectedField.id, { zIndex: Number(event.target.value || 0) }) : null}
                    />
                  </CCol>
                  <CCol md={3}>
                    <CFormLabel>Xóa layer</CFormLabel>
                    <CButton
                      color='danger'
                      variant='outline'
                      className='w-100'
                      disabled={!selectedField}
                      onClick={() => {
                        if (!selectedField) return
                        const next = layoutFields.filter((item) => String(item.id) !== String(selectedField.id))
                        replaceLayoutFields(next)
                        setSelectedFieldKey(next?.[0]?.id ? String(next[0].id) : '')
                      }}
                    >
                      Xóa layer đang chọn
                    </CButton>
                  </CCol>
                </CRow>
              </div>
            </CCol>
          </CRow>
        </div>
      </CModalBody>
      <CModalFooter>
        <CButton color='secondary' variant='outline' onClick={() => onClose?.()} disabled={saving || isUploading}>Hủy</CButton>
        <CButton color='primary' onClick={handleSave} disabled={saving || isUploading}>{saving ? 'Đang lưu...' : 'Lưu mẫu'}</CButton>
      </CModalFooter>
    </CModal>
  )
}

export default function ManagedClubAchievementTemplatesTab({ club }) {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [modalVisible, setModalVisible] = useState(false)
  const [editingTemplate, setEditingTemplate] = useState(null)
  const [page, setPage] = useState(1)
  const [pagination, setPagination] = useState({ page: 1, pageSize: 10, pageCount: 1, total: 0 })

  async function loadTemplates() {
    try {
      setLoading(true)
      setError('')
      const result = await listManagedClubAchievementTemplates(club.id, { page, pageSize: 10 })
      setRows(Array.isArray(result?.rows) ? result.rows : [])
      setPagination(result?.pagination || { page: 1, pageSize: 10, pageCount: 1, total: 0 })
    } catch (requestError) {
      setError(getSportsClubManagementApiMessage(requestError, 'Không tải được mẫu ảnh thành tích.'))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!club?.id) return
    loadTemplates()
  }, [club?.id, page])

  const pageList = useMemo(() => {
    const count = Math.max(1, Number(pagination.pageCount || 1))
    const pages = []
    for (let index = 1; index <= count; index += 1) pages.push(index)
    return pages
  }, [pagination.pageCount])

  function onTemplateSaved() {
    setModalVisible(false)
    setEditingTemplate(null)
    setPage(1)
    loadTemplates()
  }

  return (
    <CCard>
      <CCardBody>
        <div className='d-flex justify-content-between align-items-center mb-3 flex-wrap gap-2'>
          <h5 className='mb-0'>Mẫu ảnh thành tích</h5>
          <CButton color='primary' onClick={() => { setEditingTemplate(null); setModalVisible(true) }}>Tạo mới</CButton>
        </div>

        {error ? <CAlert color='danger'>{error}</CAlert> : null}

        {loading ? (
          <div className='d-flex align-items-center gap-2'><CSpinner size='sm' />Đang tải mẫu ảnh...</div>
        ) : (
          <>
            <CTable responsive hover>
              <CTableHead>
                <CTableRow>
                  <CTableHeaderCell>Preview</CTableHeaderCell>
                  <CTableHeaderCell>Tên mẫu</CTableHeaderCell>
                  <CTableHeaderCell>Môn</CTableHeaderCell>
                  <CTableHeaderCell>Loại</CTableHeaderCell>
                  <CTableHeaderCell>Cự ly</CTableHeaderCell>
                  <CTableHeaderCell>Ưu tiên</CTableHeaderCell>
                  <CTableHeaderCell>Trạng thái</CTableHeaderCell>
                  <CTableHeaderCell>Hành động</CTableHeaderCell>
                </CTableRow>
              </CTableHead>
              <CTableBody>
                {rows.length === 0 ? (
                  <CTableRow>
                    <CTableDataCell colSpan={8} className='text-body-secondary'>Chưa có mẫu ảnh nào.</CTableDataCell>
                  </CTableRow>
                ) : (
                  rows.map((template) => (
                    <CTableRow key={template.id}>
                      <CTableDataCell>
                        {(template.previewAsset?.url || template.backgroundAsset?.url)
                          ? <img src={template.previewAsset?.url || template.backgroundAsset?.url} alt={template.name || 'Template preview'} style={{ width: 72, height: 72, objectFit: 'cover', borderRadius: 8 }} />
                          : <div className='border rounded d-flex align-items-center justify-content-center text-body-secondary' style={{ width: 72, height: 72 }}>No preview</div>}
                      </CTableDataCell>
                      <CTableDataCell>
                        <div className='fw-semibold'>{template.name}</div>
                        <div className='small text-body-secondary'>{template.code}</div>
                      </CTableDataCell>
                      <CTableDataCell>{template.sportType || '-'}</CTableDataCell>
                      <CTableDataCell>{template.achievementTypes?.length ? template.achievementTypes.join(', ') : '-'}</CTableDataCell>
                      <CTableDataCell>{template.distanceLabels?.length ? template.distanceLabels.join(', ') : 'Tất cả'}</CTableDataCell>
                      <CTableDataCell>{template.priority ?? 100}</CTableDataCell>
                      <CTableDataCell>
                        <CBadge color={template.status === 'active' ? 'success' : template.status === 'draft' ? 'warning' : 'secondary'}>{template.status}</CBadge>
                      </CTableDataCell>
                      <CTableDataCell>
                        <CButton size='sm' color='secondary' variant='outline' onClick={() => { setEditingTemplate(template); setModalVisible(true) }}>Chỉnh sửa</CButton>
                      </CTableDataCell>
                    </CTableRow>
                  ))
                )}
              </CTableBody>
            </CTable>

            {pagination.pageCount > 1 ? (
              <CPagination className='mt-3' aria-label='Pagination'>
                <CPaginationItem aria-label='Previous' disabled={page <= 1} onClick={() => setPage((current) => Math.max(1, current - 1))}>Prev</CPaginationItem>
                {pageList.map((pageNumber) => (
                  <CPaginationItem key={pageNumber} active={pageNumber === page} onClick={() => setPage(pageNumber)}>{pageNumber}</CPaginationItem>
                ))}
                <CPaginationItem aria-label='Next' disabled={page >= pagination.pageCount} onClick={() => setPage((current) => Math.min(pagination.pageCount, current + 1))}>Next</CPaginationItem>
              </CPagination>
            ) : null}
          </>
        )}
      </CCardBody>
      <TemplateEditorModal visible={modalVisible} club={club} initialTemplate={editingTemplate} onClose={() => { setModalVisible(false); setEditingTemplate(null) }} onSaved={onTemplateSaved} />
    </CCard>
  )
}
