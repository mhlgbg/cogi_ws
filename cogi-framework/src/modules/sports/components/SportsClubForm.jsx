import { useEffect, useMemo, useState } from 'react'
import {
  CAlert,
  CButton,
  CCol,
  CForm,
  CFormCheck,
  CFormInput,
  CFormLabel,
  CFormSelect,
  CFormTextarea,
  CRow,
  CSpinner,
} from '@coreui/react'
import { listSportsClubs, uploadSportsClubMedia } from '../services/sportsClubService'
import {
  buildSportsClubFormValues,
  buildSportsClubPayload,
  CLUB_TYPE_OPTIONS,
  getParentClubLabel,
  JOIN_POLICY_OPTIONS,
  slugifyClient,
  SPORT_TYPE_OPTIONS,
  STATUS_OPTIONS,
  validateSportsClubForm,
} from '../utils/sportsClubUi'

export default function SportsClubForm({ initialValues, submitting = false, submitError = '', onCancel, onSubmit }) {
  const [form, setForm] = useState(() => buildSportsClubFormValues(initialValues))
  const [fieldErrors, setFieldErrors] = useState({})
  const [uploadingField, setUploadingField] = useState('')
  const [uploadError, setUploadError] = useState('')
  const [parentOptions, setParentOptions] = useState([])
  const [optionsLoading, setOptionsLoading] = useState(false)
  const [slugTouched, setSlugTouched] = useState(Boolean(initialValues?.id))

  useEffect(() => {
    setForm(buildSportsClubFormValues(initialValues))
    setFieldErrors({})
    setUploadError('')
    setUploadingField('')
    setSlugTouched(Boolean(initialValues?.id))
  }, [initialValues])

  useEffect(() => {
    let mounted = true
    async function loadParents() {
      setOptionsLoading(true)
      try {
        const result = await listSportsClubs({ page: 1, pageSize: 500, sort: 'name:asc' })
        if (!mounted) return
        const currentId = Number(initialValues?.id || 0)
        setParentOptions((Array.isArray(result?.rows) ? result.rows : []).filter((item) => Number(item?.id || 0) !== currentId))
      } catch {
        if (!mounted) return
        setParentOptions([])
      } finally {
        if (mounted) setOptionsLoading(false)
      }
    }
    loadParents()
    return () => { mounted = false }
  }, [initialValues?.id])

  const parentClubValue = useMemo(() => {
    const currentId = Number(form.parentClub?.id || 0)
    return currentId > 0 ? String(currentId) : ''
  }, [form.parentClub])

  function updateField(key, value) {
    setForm((current) => ({ ...current, [key]: value }))
    setFieldErrors((current) => {
      if (!current[key]) return current
      const next = { ...current }
      delete next[key]
      return next
    })
  }

  function handleNameChange(value) {
    setForm((current) => {
      const next = { ...current, name: value }
      if (!initialValues?.id && !slugTouched) {
        next.slug = slugifyClient(value)
      }
      return next
    })
    setFieldErrors((current) => {
      const next = { ...current }
      delete next.name
      return next
    })
  }

  async function handleMediaChange(field, file) {
    if (!file) return
    setUploadingField(field)
    setUploadError('')
    try {
      const uploaded = await uploadSportsClubMedia(file)
      if (!uploaded?.id) throw new Error('Không nhận được dữ liệu media sau khi upload')
      setForm((current) => ({ ...current, [field]: uploaded }))
    } catch (error) {
      setUploadError(error?.response?.data?.error?.message || error?.message || 'Không thể upload media.')
    } finally {
      setUploadingField('')
    }
  }

  function handleSubmit(event) {
    event.preventDefault()
    const nextErrors = validateSportsClubForm(form)
    setFieldErrors(nextErrors)
    if (Object.keys(nextErrors).length > 0) return
    onSubmit?.(buildSportsClubPayload(form))
  }

  return (
    <CForm onSubmit={handleSubmit}>
      {submitError ? <CAlert color='danger'>{submitError}</CAlert> : null}
      {uploadError ? <CAlert color='danger'>{uploadError}</CAlert> : null}

      <div className='fw-semibold mb-3'>Thông tin CLB</div>
      <CRow className='g-3 mb-4'>
        <CCol md={3}><CFormLabel>Mã CLB</CFormLabel><CFormInput value={form.code} onChange={(event) => updateField('code', event.target.value.toUpperCase())} disabled={submitting} invalid={Boolean(fieldErrors.code)} />{fieldErrors.code ? <div className='text-danger small mt-1'>{fieldErrors.code}</div> : null}</CCol>
        <CCol md={5}><CFormLabel>Tên CLB</CFormLabel><CFormInput value={form.name} onChange={(event) => handleNameChange(event.target.value)} disabled={submitting} invalid={Boolean(fieldErrors.name)} />{fieldErrors.name ? <div className='text-danger small mt-1'>{fieldErrors.name}</div> : null}</CCol>
        <CCol md={4}><CFormLabel>Tên ngắn</CFormLabel><CFormInput value={form.shortName} onChange={(event) => updateField('shortName', event.target.value)} disabled={submitting} /></CCol>
        <CCol md={4}><CFormLabel>Slug</CFormLabel><CFormInput value={form.slug} onChange={(event) => { setSlugTouched(true); updateField('slug', slugifyClient(event.target.value)) }} disabled={submitting} invalid={Boolean(fieldErrors.slug)} />{fieldErrors.slug ? <div className='text-danger small mt-1'>{fieldErrors.slug}</div> : null}</CCol>
        <CCol md={4}><CFormLabel>Loại CLB</CFormLabel><CFormSelect value={form.clubType} onChange={(event) => updateField('clubType', event.target.value)} disabled={submitting}>{CLUB_TYPE_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</CFormSelect></CCol>
        <CCol md={4}><CFormLabel>Môn thể thao</CFormLabel><CFormSelect value={form.sportType} onChange={(event) => updateField('sportType', event.target.value)} disabled={submitting}>{SPORT_TYPE_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</CFormSelect></CCol>
        <CCol md={6}><CFormLabel>Parent Club</CFormLabel><CFormSelect value={parentClubValue} onChange={(event) => { const selected = parentOptions.find((item) => String(item.id) === event.target.value) || null; updateField('parentClub', selected) }} disabled={submitting || optionsLoading}><option value=''>Không có parent (root club)</option>{parentOptions.map((option) => <option key={option.id} value={option.id}>{getParentClubLabel(option)}</option>)}</CFormSelect><div className='small text-body-secondary mt-1'>{optionsLoading ? 'Đang tải danh sách club...' : 'Chỉ hiển thị club trong tenant hiện tại. Backend vẫn là lớp bảo vệ chính cho cycle và tenant isolation.'}</div></CCol>
        <CCol md={3}><CFormLabel>Trạng thái</CFormLabel><CFormSelect value={form.status} onChange={(event) => updateField('status', event.target.value)} disabled={submitting}>{STATUS_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</CFormSelect></CCol>
        <CCol md={3}><CFormLabel>Chính sách tham gia</CFormLabel><CFormSelect value={form.joinPolicy} onChange={(event) => updateField('joinPolicy', event.target.value)} disabled={submitting}>{JOIN_POLICY_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</CFormSelect></CCol>
        <CCol md={3}><CFormLabel>Ngày thành lập</CFormLabel><CFormInput type='date' value={form.foundedAt} onChange={(event) => updateField('foundedAt', event.target.value)} disabled={submitting} /></CCol>
        <CCol xs={12}><CFormLabel>Mô tả</CFormLabel><CFormTextarea rows={4} value={form.description} onChange={(event) => updateField('description', event.target.value)} disabled={submitting} /></CCol>
      </CRow>

      <div className='fw-semibold mb-3'>Liên hệ</div>
      <CRow className='g-3 mb-4'>
        <CCol md={4}><CFormLabel>Số điện thoại</CFormLabel><CFormInput value={form.contactPhone} onChange={(event) => updateField('contactPhone', event.target.value)} disabled={submitting} /></CCol>
        <CCol md={4}><CFormLabel>Email liên hệ</CFormLabel><CFormInput value={form.contactEmail} onChange={(event) => updateField('contactEmail', event.target.value)} disabled={submitting} invalid={Boolean(fieldErrors.contactEmail)} />{fieldErrors.contactEmail ? <div className='text-danger small mt-1'>{fieldErrors.contactEmail}</div> : null}</CCol>
        <CCol md={4}><CFormLabel>Website</CFormLabel><CFormInput value={form.website} onChange={(event) => updateField('website', event.target.value)} disabled={submitting} /></CCol>
        <CCol xs={12}><CFormLabel>Địa chỉ</CFormLabel><CFormTextarea rows={3} value={form.address} onChange={(event) => updateField('address', event.target.value)} disabled={submitting} /></CCol>
      </CRow>

      <div className='fw-semibold mb-3'>Hình ảnh</div>
      <CRow className='g-3 mb-4'>
        <CCol lg={6}>
          <div className='border rounded p-3 h-100'>
            <CFormLabel htmlFor='sports-club-logo'>Logo</CFormLabel>
            <CFormInput id='sports-club-logo' type='file' accept='image/*' disabled={submitting || uploadingField === 'logo'} onChange={(event) => { const file = event.target.files?.[0] || null; handleMediaChange('logo', file); event.target.value = '' }} />
            {uploadingField === 'logo' ? <div className='d-flex align-items-center gap-2 mt-2'><CSpinner size='sm' /><span>Đang tải logo...</span></div> : null}
            {form.logo?.url ? <div className='mt-3 d-flex gap-2 align-items-center flex-wrap'><img src={form.logo.url} alt='Logo preview' style={{ width: 72, height: 72, objectFit: 'cover', borderRadius: 12 }} /><CButton type='button' size='sm' color='secondary' variant='outline' onClick={() => updateField('logo', null)} disabled={submitting || uploadingField === 'logo'}>Gỡ logo</CButton></div> : <div className='small text-body-secondary mt-2'>Chưa có logo.</div>}
          </div>
        </CCol>
        <CCol lg={6}>
          <div className='border rounded p-3 h-100'>
            <CFormLabel htmlFor='sports-club-cover'>Ảnh bìa</CFormLabel>
            <CFormInput id='sports-club-cover' type='file' accept='image/*' disabled={submitting || uploadingField === 'coverImage'} onChange={(event) => { const file = event.target.files?.[0] || null; handleMediaChange('coverImage', file); event.target.value = '' }} />
            {uploadingField === 'coverImage' ? <div className='d-flex align-items-center gap-2 mt-2'><CSpinner size='sm' /><span>Đang tải ảnh bìa...</span></div> : null}
            {form.coverImage?.url ? <div className='mt-3 d-flex gap-2 align-items-center flex-wrap'><img src={form.coverImage.url} alt='Cover preview' style={{ width: 128, height: 72, objectFit: 'cover', borderRadius: 12 }} /><CButton type='button' size='sm' color='secondary' variant='outline' onClick={() => updateField('coverImage', null)} disabled={submitting || uploadingField === 'coverImage'}>Gỡ ảnh bìa</CButton></div> : <div className='small text-body-secondary mt-2'>Chưa có ảnh bìa.</div>}
          </div>
        </CCol>
      </CRow>

      <div className='d-flex justify-content-end gap-2 flex-wrap'>
        <CButton type='button' color='secondary' variant='outline' onClick={onCancel} disabled={submitting || Boolean(uploadingField)}>Hủy</CButton>
        <CButton type='submit' color='primary' disabled={submitting || Boolean(uploadingField)}>{submitting ? 'Đang lưu...' : 'Lưu CLB'}</CButton>
      </div>
    </CForm>
  )
}