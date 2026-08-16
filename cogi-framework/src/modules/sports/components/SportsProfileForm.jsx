import { useEffect, useState } from 'react'
import {
  CAlert,
  CButton,
  CCol,
  CForm,
  CFormInput,
  CFormLabel,
  CFormSelect,
  CFormTextarea,
  CRow,
  CSpinner,
} from '@coreui/react'
import { uploadSportsProfileAvatar } from '../services/sportsProfileService'
import {
  buildSportsProfileFormValues,
  buildSportsProfilePayload,
  GENDER_OPTIONS,
  getLinkedUserLabel,
  SOURCE_OPTIONS,
  STATUS_OPTIONS,
  validateSportsProfileForm,
} from '../utils/sportsProfileUi'

export default function SportsProfileForm({ initialValues, submitting = false, submitError = '', onCancel, onSubmit }) {
  const [form, setForm] = useState(() => buildSportsProfileFormValues(initialValues))
  const [fieldErrors, setFieldErrors] = useState({})
  const [uploadingAvatar, setUploadingAvatar] = useState(false)
  const [uploadError, setUploadError] = useState('')

  useEffect(() => {
    setForm(buildSportsProfileFormValues(initialValues))
    setFieldErrors({})
    setUploadError('')
    setUploadingAvatar(false)
  }, [initialValues])

  useEffect(() => {
    if (!form.dateOfBirth) return
    const derivedYear = String(form.dateOfBirth).slice(0, 4)
    if (derivedYear && form.birthYear !== derivedYear) {
      setForm((current) => ({ ...current, birthYear: derivedYear }))
    }
  }, [form.dateOfBirth, form.birthYear])

  function updateField(key, value) {
    setForm((current) => ({ ...current, [key]: value }))
    setFieldErrors((current) => {
      if (!current[key]) return current
      const next = { ...current }
      delete next[key]
      return next
    })
  }

  async function handleAvatarChange(file) {
    if (!file) return
    setUploadingAvatar(true)
    setUploadError('')
    try {
      const uploaded = await uploadSportsProfileAvatar(file)
      if (!uploaded?.id) throw new Error('Không nhận được dữ liệu media sau khi upload')
      setForm((current) => ({ ...current, avatar: uploaded }))
    } catch (error) {
      setUploadError(error?.response?.data?.error?.message || error?.message || 'Không thể upload avatar.')
    } finally {
      setUploadingAvatar(false)
    }
  }

  function handleSubmit(event) {
    event.preventDefault()
    const nextErrors = validateSportsProfileForm(form)
    setFieldErrors(nextErrors)
    if (Object.keys(nextErrors).length > 0) return
    onSubmit?.(buildSportsProfilePayload(form))
  }

  return (
    <CForm onSubmit={handleSubmit}>
      {submitError ? <CAlert color='danger'>{submitError}</CAlert> : null}
      {uploadError ? <CAlert color='danger'>{uploadError}</CAlert> : null}

      <div className='fw-semibold mb-3'>Thông tin hồ sơ</div>
      <CRow className='g-3 mb-4'>
        <CCol md={4}><CFormLabel>Mã hồ sơ</CFormLabel><CFormInput value={form.code} onChange={(event) => updateField('code', event.target.value.toUpperCase())} disabled={submitting} invalid={Boolean(fieldErrors.code)} />{fieldErrors.code ? <div className='text-danger small mt-1'>{fieldErrors.code}</div> : null}</CCol>
        <CCol md={4}><CFormLabel>Họ và tên</CFormLabel><CFormInput value={form.fullName} onChange={(event) => updateField('fullName', event.target.value)} disabled={submitting} invalid={Boolean(fieldErrors.fullName)} />{fieldErrors.fullName ? <div className='text-danger small mt-1'>{fieldErrors.fullName}</div> : null}</CCol>
        <CCol md={4}><CFormLabel>Tên hiển thị</CFormLabel><CFormInput value={form.displayName} onChange={(event) => updateField('displayName', event.target.value)} disabled={submitting} /></CCol>
        <CCol md={3}><CFormLabel>Giới tính</CFormLabel><CFormSelect value={form.gender} onChange={(event) => updateField('gender', event.target.value)} disabled={submitting}>{GENDER_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</CFormSelect></CCol>
        <CCol md={3}><CFormLabel>Ngày sinh</CFormLabel><CFormInput type='date' value={form.dateOfBirth} onChange={(event) => updateField('dateOfBirth', event.target.value)} disabled={submitting} /></CCol>
        <CCol md={3}><CFormLabel>Năm sinh</CFormLabel><CFormInput type='number' min='1900' max='2100' value={form.birthYear} onChange={(event) => updateField('birthYear', event.target.value)} disabled={submitting || Boolean(form.dateOfBirth)} invalid={Boolean(fieldErrors.birthYear)} />{fieldErrors.birthYear ? <div className='text-danger small mt-1'>{fieldErrors.birthYear}</div> : null}</CCol>
        <CCol md={3}><CFormLabel>Trạng thái</CFormLabel><CFormSelect value={form.status} onChange={(event) => updateField('status', event.target.value)} disabled={submitting}>{STATUS_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</CFormSelect></CCol>
        <CCol md={3}><CFormLabel>Nguồn tạo</CFormLabel><CFormSelect value={form.source} onChange={(event) => updateField('source', event.target.value)} disabled={submitting}>{SOURCE_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</CFormSelect></CCol>
        <CCol md={6}><CFormLabel>Quê quán</CFormLabel><CFormInput value={form.hometown} onChange={(event) => updateField('hometown', event.target.value)} disabled={submitting} /></CCol>
        <CCol md={6}><CFormLabel>Tham chiếu nguồn</CFormLabel><CFormInput value={form.sourceReference} onChange={(event) => updateField('sourceReference', event.target.value)} disabled={submitting} /></CCol>
        <CCol xs={12}><CFormLabel>Giới thiệu</CFormLabel><CFormTextarea rows={4} value={form.bio} onChange={(event) => updateField('bio', event.target.value)} disabled={submitting} /></CCol>
      </CRow>

      <div className='fw-semibold mb-3'>Liên hệ</div>
      <CRow className='g-3 mb-4'>
        <CCol md={6}><CFormLabel>Số điện thoại</CFormLabel><CFormInput value={form.contactPhone} onChange={(event) => updateField('contactPhone', event.target.value)} disabled={submitting} /></CCol>
        <CCol md={6}><CFormLabel>Email liên hệ</CFormLabel><CFormInput value={form.contactEmail} onChange={(event) => updateField('contactEmail', event.target.value)} disabled={submitting} invalid={Boolean(fieldErrors.contactEmail)} />{fieldErrors.contactEmail ? <div className='text-danger small mt-1'>{fieldErrors.contactEmail}</div> : null}</CCol>
      </CRow>

      <div className='fw-semibold mb-3'>Avatar và User</div>
      <CRow className='g-3 mb-4'>
        <CCol lg={5}>
          <div className='border rounded p-3 h-100'>
            <CFormLabel htmlFor='sports-profile-avatar'>Avatar</CFormLabel>
            <CFormInput id='sports-profile-avatar' type='file' accept='image/*' disabled={submitting || uploadingAvatar} onChange={(event) => { const file = event.target.files?.[0] || null; handleAvatarChange(file); event.target.value = '' }} />
            <div className='small text-body-secondary mt-2'>Avatar được upload vào media library hiện có của tenant.</div>
            {uploadingAvatar ? <div className='d-flex align-items-center gap-2 mt-2'><CSpinner size='sm' /><span>Đang tải avatar...</span></div> : null}
            {form.avatar?.url ? <div className='mt-3'><CButton type='button' size='sm' color='secondary' variant='outline' onClick={() => updateField('avatar', null)} disabled={submitting || uploadingAvatar}>Gỡ avatar</CButton></div> : null}
          </div>
        </CCol>
        <CCol lg={4}>
          <div className='border rounded p-3 h-100 d-flex align-items-center justify-content-center bg-body-tertiary'>
            {form.avatar?.url ? <img src={form.avatar.url} alt='Avatar preview' style={{ maxWidth: '100%', maxHeight: 220, objectFit: 'cover', borderRadius: 12 }} /> : <div className='text-body-secondary'>Chưa có avatar</div>}
          </div>
        </CCol>
        <CCol lg={3}>
          <div className='border rounded p-3 h-100'>
            <div className='small text-body-secondary mb-2'>User liên kết</div>
            <div className='fw-semibold'>{getLinkedUserLabel(form.linkedUser)}</div>
            <div className='small text-body-secondary mt-2'>Task này chưa triển khai luồng claim/link user mới. Form chỉ giữ relation hiện có nếu profile đã được liên kết từ trước.</div>
          </div>
        </CCol>
      </CRow>

      <div className='d-flex justify-content-end gap-2 flex-wrap'>
        <CButton type='button' color='secondary' variant='outline' onClick={onCancel} disabled={submitting || uploadingAvatar}>Hủy</CButton>
        <CButton type='submit' color='primary' disabled={submitting || uploadingAvatar}>{submitting ? 'Đang lưu...' : 'Lưu hồ sơ'}</CButton>
      </div>
    </CForm>
  )
}