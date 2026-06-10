import { useEffect, useMemo, useState } from 'react'
import {
  CAlert,
  CButton,
  CCard,
  CCardBody,
  CCardHeader,
  CCol,
  CForm,
  CFormInput,
  CFormLabel,
  CFormTextarea,
  CRow,
  CSpinner,
} from '@coreui/react'
import {
  getApiMessage,
  getTenantWebsiteSettings,
  updateTenantWebsiteSettings,
  uploadTenantWebsiteMedia,
} from '../services/tenantWebsiteSettingsService'

const FIELD_LIMITS = {
  siteTitle: 120,
  defaultPageTitle: 120,
  titleSuffix: 120,
  siteShortTitle: 60,
  siteDescription: 300,
  siteKeywords: 500,
}

function normalizeMedia(value) {
  if (!value || typeof value !== 'object') return null

  return {
    id: Number.isInteger(Number(value.id)) && Number(value.id) > 0 ? Number(value.id) : null,
    name: String(value.name || '').trim() || null,
    url: String(value.url || '').trim(),
  }
}

function createFormState(payload = {}) {
  return {
    siteTitle: String(payload?.siteTitle || '').trim(),
    defaultPageTitle: String(payload?.defaultPageTitle || '').trim(),
    titleSuffix: String(payload?.titleSuffix || '').trim(),
    siteShortTitle: String(payload?.siteShortTitle || '').trim(),
    siteDescription: String(payload?.siteDescription || '').trim(),
    siteKeywords: String(payload?.siteKeywords || '').trim(),
    siteLogo: normalizeMedia(payload?.siteLogo),
    defaultMetaImage: normalizeMedia(payload?.defaultMetaImage),
    favicon: normalizeMedia(payload?.favicon),
    chatAvatar: normalizeMedia(payload?.chatAvatar),
  }
}

function validateForm(form) {
  const nextErrors = {}

  if (String(form.siteTitle || '').trim().length > FIELD_LIMITS.siteTitle) {
    nextErrors.siteTitle = `Tiêu đề website tối đa ${FIELD_LIMITS.siteTitle} ký tự`
  }

  if (String(form.defaultPageTitle || '').trim().length > FIELD_LIMITS.defaultPageTitle) {
    nextErrors.defaultPageTitle = `Tiêu đề trang mặc định tối đa ${FIELD_LIMITS.defaultPageTitle} ký tự`
  }

  if (String(form.titleSuffix || '').trim().length > FIELD_LIMITS.titleSuffix) {
    nextErrors.titleSuffix = `Hậu tố title tối đa ${FIELD_LIMITS.titleSuffix} ký tự`
  }

  if (String(form.siteShortTitle || '').trim().length > FIELD_LIMITS.siteShortTitle) {
    nextErrors.siteShortTitle = `Tên ngắn tối đa ${FIELD_LIMITS.siteShortTitle} ký tự`
  }

  if (String(form.siteDescription || '').trim().length > FIELD_LIMITS.siteDescription) {
    nextErrors.siteDescription = `Mô tả SEO tối đa ${FIELD_LIMITS.siteDescription} ký tự`
  }

  if (String(form.siteKeywords || '').trim().length > FIELD_LIMITS.siteKeywords) {
    nextErrors.siteKeywords = `Từ khóa SEO tối đa ${FIELD_LIMITS.siteKeywords} ký tự`
  }

  return nextErrors
}
function MediaField({
  fieldKey,
  label,
  value,
  uploadingField,
  onFileChange,
  onClear,
}) {
  const isUploading = uploadingField === fieldKey

  return (
    <div className='border rounded-3 p-3 h-100'>
      <CFormLabel htmlFor={`tenant-website-${fieldKey}`}>{label}</CFormLabel>
      <CFormInput
        id={`tenant-website-${fieldKey}`}
        type='file'
        accept='image/*'
        disabled={isUploading}
        onChange={(event) => {
          const file = event.target.files?.[0] || null
          onFileChange(fieldKey, file)
          event.target.value = ''
        }}
      />

      <div className='d-flex align-items-center gap-2 mt-2 small text-body-secondary'>
        {isUploading ? (
          <>
            <CSpinner size='sm' />
            <span>Đang tải ảnh...</span>
          </>
        ) : value?.name ? <span>{value.name}</span> : <span>Chưa có ảnh</span>}
      </div>

      {value?.url ? (
        <div className='mt-3 d-flex flex-column gap-2'>
          <img
            src={value.url}
            alt={label}
            style={{ maxWidth: '100%', maxHeight: 120, objectFit: 'contain', borderRadius: 12, backgroundColor: '#f8f9fa' }}
          />
          <div>
            <CButton type='button' color='secondary' variant='outline' size='sm' onClick={() => onClear(fieldKey)}>
              Xóa ảnh
            </CButton>
          </div>
        </div>
      ) : null}
    </div>
  )
}

export default function TenantWebsiteSettingsPage() {
  const [loading, setLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [uploadingField, setUploadingField] = useState('')
  const [success, setSuccess] = useState('')
  const [error, setError] = useState('')
  const [fieldErrors, setFieldErrors] = useState({})
  const [form, setForm] = useState(() => createFormState())

  useEffect(() => {
    let cancelled = false

    async function loadSettings() {
      setLoading(true)
      setError('')
      setSuccess('')

      try {
        const payload = await getTenantWebsiteSettings()
        if (cancelled) return
        setForm(createFormState(payload))
      } catch (requestError) {
        if (cancelled) return
        setError(getApiMessage(requestError, 'Không tải được cấu hình website của tenant'))
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    loadSettings()

    return () => {
      cancelled = true
    }
  }, [])

  const keywordCount = useMemo(() => String(form.siteKeywords || '').trim().length, [form.siteKeywords])
  const descriptionCount = useMemo(() => String(form.siteDescription || '').trim().length, [form.siteDescription])

  function updateField(key, value) {
    setForm((previous) => ({ ...previous, [key]: value }))
    setFieldErrors((previous) => {
      if (!previous[key]) return previous
      return {
        ...previous,
        [key]: '',
      }
    })
  }

  async function handleFileChange(fieldKey, file) {
    if (!file) return

    setUploadingField(fieldKey)
    setError('')
    setSuccess('')

    try {
      const uploaded = await uploadTenantWebsiteMedia(file)
      if (!uploaded?.id) {
        throw new Error('Không nhận được dữ liệu media sau khi upload')
      }

      setForm((previous) => ({
        ...previous,
        [fieldKey]: uploaded,
      }))
    } catch (requestError) {
      setError(getApiMessage(requestError, 'Không thể upload ảnh'))
    } finally {
      setUploadingField('')
    }
  }

  function handleClearMedia(fieldKey) {
    setForm((previous) => ({
      ...previous,
      [fieldKey]: null,
    }))
  }

  async function handleSubmit(event) {
    event.preventDefault()

    const nextFieldErrors = validateForm(form)
    setFieldErrors(nextFieldErrors)
    setError('')
    setSuccess('')

    if (Object.keys(nextFieldErrors).length > 0) {
      setError('Vui lòng kiểm tra lại dữ liệu website settings')
      return
    }

    setSubmitting(true)

    try {
      const payload = {
        siteTitle: String(form.siteTitle || '').trim() || null,
        defaultPageTitle: String(form.defaultPageTitle || '').trim() || null,
        titleSuffix: String(form.titleSuffix || '').trim() || null,
        siteShortTitle: String(form.siteShortTitle || '').trim() || null,
        siteDescription: String(form.siteDescription || '').trim() || null,
        siteKeywords: String(form.siteKeywords || '').trim() || null,
        siteLogo: form.siteLogo?.id || null,
        defaultMetaImage: form.defaultMetaImage?.id || null,
        favicon: form.favicon?.id || null,
        chatAvatar: form.chatAvatar?.id || null,
      }

      const updated = await updateTenantWebsiteSettings(payload)
      setForm(createFormState(updated))
      setSuccess('Lưu cấu hình website thành công')
    } catch (requestError) {
      setError(getApiMessage(requestError, 'Không thể lưu cấu hình website'))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <CCard>
      <CCardHeader>
        <strong>Tenant Website Settings</strong>
      </CCardHeader>
      <CCardBody>
        {loading ? (
          <div className='d-flex align-items-center gap-2'>
            <CSpinner size='sm' />
            <span>Đang tải cấu hình website...</span>
          </div>
        ) : null}

        {error ? <CAlert color='danger'>{error}</CAlert> : null}
        {success ? <CAlert color='success'>{success}</CAlert> : null}

        {!loading ? (
          <>
            <CForm onSubmit={handleSubmit}>
              <CRow className='g-4'>
                <CCol md={8}>
                  <CFormLabel htmlFor='tenant-website-site-title'>Tiêu đề website</CFormLabel>
                  <CFormInput
                    id='tenant-website-site-title'
                    value={form.siteTitle}
                    maxLength={FIELD_LIMITS.siteTitle}
                    invalid={Boolean(fieldErrors.siteTitle)}
                    onChange={(event) => updateField('siteTitle', event.target.value)}
                  />
                  {fieldErrors.siteTitle ? <div className='text-danger small mt-1'>{fieldErrors.siteTitle}</div> : null}
                </CCol>

                <CCol md={6}>
                  <CFormLabel htmlFor='tenant-website-default-page-title'>Tiêu đề trang mặc định</CFormLabel>
                  <CFormInput
                    id='tenant-website-default-page-title'
                    value={form.defaultPageTitle}
                    maxLength={FIELD_LIMITS.defaultPageTitle}
                    invalid={Boolean(fieldErrors.defaultPageTitle)}
                    onChange={(event) => updateField('defaultPageTitle', event.target.value)}
                  />
                  {fieldErrors.defaultPageTitle ? <div className='text-danger small mt-1'>{fieldErrors.defaultPageTitle}</div> : null}
                </CCol>

                <CCol md={6}>
                  <CFormLabel htmlFor='tenant-website-title-suffix'>Title suffix</CFormLabel>
                  <CFormInput
                    id='tenant-website-title-suffix'
                    value={form.titleSuffix}
                    maxLength={FIELD_LIMITS.titleSuffix}
                    invalid={Boolean(fieldErrors.titleSuffix)}
                    onChange={(event) => updateField('titleSuffix', event.target.value)}
                  />
                  {fieldErrors.titleSuffix ? <div className='text-danger small mt-1'>{fieldErrors.titleSuffix}</div> : null}
                </CCol>

                <CCol md={4}>
                  <CFormLabel htmlFor='tenant-website-site-short-title'>Tên ngắn</CFormLabel>
                  <CFormInput
                    id='tenant-website-site-short-title'
                    value={form.siteShortTitle}
                    maxLength={FIELD_LIMITS.siteShortTitle}
                    invalid={Boolean(fieldErrors.siteShortTitle)}
                    onChange={(event) => updateField('siteShortTitle', event.target.value)}
                  />
                  {fieldErrors.siteShortTitle ? <div className='text-danger small mt-1'>{fieldErrors.siteShortTitle}</div> : null}
                </CCol>

                <CCol md={12}>
                  <CFormLabel htmlFor='tenant-website-site-description'>Mô tả SEO</CFormLabel>
                  <CFormTextarea
                    id='tenant-website-site-description'
                    rows={4}
                    value={form.siteDescription}
                    maxLength={FIELD_LIMITS.siteDescription}
                    invalid={Boolean(fieldErrors.siteDescription)}
                    onChange={(event) => updateField('siteDescription', event.target.value)}
                  />
                  <div className='small text-body-secondary mt-1'>{descriptionCount}/{FIELD_LIMITS.siteDescription}</div>
                  {fieldErrors.siteDescription ? <div className='text-danger small mt-1'>{fieldErrors.siteDescription}</div> : null}
                </CCol>

                <CCol md={12}>
                  <CFormLabel htmlFor='tenant-website-site-keywords'>Từ khóa SEO</CFormLabel>
                  <CFormTextarea
                    id='tenant-website-site-keywords'
                    rows={4}
                    value={form.siteKeywords}
                    maxLength={FIELD_LIMITS.siteKeywords}
                    invalid={Boolean(fieldErrors.siteKeywords)}
                    onChange={(event) => updateField('siteKeywords', event.target.value)}
                  />
                  <div className='small text-body-secondary mt-1'>{keywordCount}/{FIELD_LIMITS.siteKeywords}</div>
                  {fieldErrors.siteKeywords ? <div className='text-danger small mt-1'>{fieldErrors.siteKeywords}</div> : null}
                </CCol>

                <CCol md={4}>
                  <MediaField
                    fieldKey='siteLogo'
                    label='Logo website'
                    value={form.siteLogo}
                    uploadingField={uploadingField}
                    onFileChange={handleFileChange}
                    onClear={handleClearMedia}
                  />
                </CCol>

                <CCol md={4}>
                  <MediaField
                    fieldKey='defaultMetaImage'
                    label='Ảnh mặc định khi chia sẻ'
                    value={form.defaultMetaImage}
                    uploadingField={uploadingField}
                    onFileChange={handleFileChange}
                    onClear={handleClearMedia}
                  />
                </CCol>

                <CCol md={4}>
                  <MediaField
                    fieldKey='favicon'
                    label='Favicon'
                    value={form.favicon}
                    uploadingField={uploadingField}
                    onFileChange={handleFileChange}
                    onClear={handleClearMedia}
                  />
                </CCol>

                <CCol md={4}>
                  <MediaField
                    fieldKey='chatAvatar'
                    label='Ảnh đại diện chat'
                    value={form.chatAvatar}
                    uploadingField={uploadingField}
                    onFileChange={handleFileChange}
                    onClear={handleClearMedia}
                  />
                </CCol>

                <CCol xs={12}>
                  <div className='d-flex justify-content-end'>
                    <CButton type='submit' color='primary' disabled={submitting || Boolean(uploadingField)}>
                      {submitting ? 'Đang lưu...' : 'Lưu'}
                    </CButton>
                  </div>
                </CCol>
              </CRow>
            </CForm>
          </>
        ) : null}
      </CCardBody>
    </CCard>
  )
}