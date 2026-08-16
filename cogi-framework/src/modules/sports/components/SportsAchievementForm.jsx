import { useEffect, useState } from 'react'
import { CAlert, CButton, CCol, CForm, CFormInput, CFormLabel, CFormSelect, CFormTextarea, CRow, CSpinner } from '@coreui/react'
import { listSportsClubs } from '../services/sportsClubService'
import { listSportsProfiles } from '../services/sportsProfileService'
import { getSportsAchievementApiMessage, uploadSportsAchievementEvidence } from '../services/sportsAchievementService'
import {
  ACHIEVEMENT_SOURCE_OPTIONS,
  ACHIEVEMENT_STATUS_OPTIONS,
  ACHIEVEMENT_TYPE_OPTIONS,
  formatSportsDateTime,
  fromDateTimeInputValue,
  getSportTypeLabel,
  getSportsClubOptionLabel,
  getSportsProfileOptionLabel,
  SPORT_TYPE_OPTIONS,
  toDateTimeInputValue,
} from '../utils/sportsAchievementUi'

function buildInitialForm(initialValues = null) {
  return {
    sportsProfile: initialValues?.sportsProfile || null,
    club: initialValues?.club || null,
    achievementType: String(initialValues?.achievementType || 'other').trim() || 'other',
    sportType: String(initialValues?.sportType || '').trim(),
    title: String(initialValues?.title || '').trim(),
    description: String(initialValues?.description || '').trim(),
    achievedAt: toDateTimeInputValue(initialValues?.achievedAt),
    resultValue: initialValues?.resultValue ?? '',
    resultUnit: String(initialValues?.resultUnit || '').trim(),
    resultText: String(initialValues?.resultText || '').trim(),
    source: String(initialValues?.source || 'manual').trim() || 'manual',
    sourceReference: String(initialValues?.sourceReference || '').trim(),
    note: String(initialValues?.note || '').trim(),
    status: String(initialValues?.status || 'active').trim() || 'active',
    verifiedAt: toDateTimeInputValue(initialValues?.verifiedAt),
    evidence: Array.isArray(initialValues?.evidence) ? initialValues.evidence : [],
  }
}

function buildPayload(form) {
  return {
    sportsProfile: form.sportsProfile?.id || null,
    club: form.club?.id || null,
    achievementType: form.achievementType || 'other',
    sportType: form.sportType || null,
    title: form.title || null,
    description: form.description || null,
    achievedAt: fromDateTimeInputValue(form.achievedAt),
    resultValue: form.resultValue === '' ? null : Number(form.resultValue),
    resultUnit: form.resultUnit || null,
    resultText: form.resultText || null,
    source: form.source || 'manual',
    sourceReference: form.sourceReference || null,
    note: form.note || null,
    status: form.status || 'active',
    verifiedAt: fromDateTimeInputValue(form.verifiedAt),
    evidence: Array.isArray(form.evidence) ? form.evidence.map((item) => item.id).filter(Boolean) : [],
  }
}

function validateForm(form) {
  const errors = {}
  if (!form.sportsProfile?.id) errors.sportsProfile = 'Sports Profile là bắt buộc'
  if (!form.title) errors.title = 'Tiêu đề là bắt buộc'
  return errors
}

export default function SportsAchievementForm({ initialValues = null, submitting = false, submitError = '', onCancel, onSubmit }) {
  const [form, setForm] = useState(() => buildInitialForm(initialValues))
  const [fieldErrors, setFieldErrors] = useState({})
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState('')
  const [profiles, setProfiles] = useState([])
  const [clubs, setClubs] = useState([])

  useEffect(() => {
    setForm(buildInitialForm(initialValues))
    setFieldErrors({})
    setUploadError('')
    setUploading(false)
  }, [initialValues])

  useEffect(() => {
    let mounted = true
    async function loadOptions() {
      try {
        const [profileResult, clubResult] = await Promise.all([
          listSportsProfiles({ page: 1, pageSize: 500, sort: 'fullName:asc' }),
          listSportsClubs({ page: 1, pageSize: 500, sort: 'name:asc' }),
        ])
        if (!mounted) return
        setProfiles(Array.isArray(profileResult?.rows) ? profileResult.rows : [])
        setClubs(Array.isArray(clubResult?.rows) ? clubResult.rows : [])
      } catch {
        if (!mounted) return
        setProfiles([])
        setClubs([])
      }
    }
    loadOptions()
    return () => { mounted = false }
  }, [])

  function updateField(key, value) {
    setForm((current) => ({ ...current, [key]: value }))
    setFieldErrors((current) => {
      if (!current[key]) return current
      const next = { ...current }
      delete next[key]
      return next
    })
  }

  async function handleEvidenceChange(files) {
    const nextFiles = Array.from(files || [])
    if (nextFiles.length === 0) return
    setUploading(true)
    setUploadError('')
    try {
      const uploaded = []
      for (const file of nextFiles) {
        // Sequential upload keeps tenant media endpoint behavior predictable.
        const media = await uploadSportsAchievementEvidence(file)
        if (media?.id) uploaded.push(media)
      }
      setForm((current) => ({ ...current, evidence: [...current.evidence, ...uploaded] }))
    } catch (error) {
      setUploadError(getSportsAchievementApiMessage(error, 'Không thể upload evidence.'))
    } finally {
      setUploading(false)
    }
  }

  function removeEvidence(id) {
    setForm((current) => ({ ...current, evidence: current.evidence.filter((item) => item.id !== id) }))
  }

  function handleSubmit(event) {
    event.preventDefault()
    const nextErrors = validateForm(form)
    setFieldErrors(nextErrors)
    if (Object.keys(nextErrors).length > 0) return
    onSubmit?.(buildPayload(form))
  }

  return (
    <CForm onSubmit={handleSubmit}>
      {submitError ? <CAlert color='danger'>{submitError}</CAlert> : null}
      {uploadError ? <CAlert color='danger'>{uploadError}</CAlert> : null}

      <div className='fw-semibold mb-3'>Thông tin thành tích</div>
      <CRow className='g-3 mb-4'>
        <CCol md={6}><CFormLabel>Sports Profile *</CFormLabel><CFormSelect value={form.sportsProfile?.id ? String(form.sportsProfile.id) : ''} onChange={(event) => updateField('sportsProfile', profiles.find((item) => String(item.id) === event.target.value) || null)} disabled={submitting || uploading} invalid={Boolean(fieldErrors.sportsProfile)}><option value=''>Chọn Sports Profile</option>{profiles.map((option) => <option key={option.id} value={option.id}>{getSportsProfileOptionLabel(option)}</option>)}</CFormSelect>{fieldErrors.sportsProfile ? <div className='text-danger small mt-1'>{fieldErrors.sportsProfile}</div> : null}</CCol>
        <CCol md={6}><CFormLabel>CLB</CFormLabel><CFormSelect value={form.club?.id ? String(form.club.id) : ''} onChange={(event) => updateField('club', clubs.find((item) => String(item.id) === event.target.value) || null)} disabled={submitting || uploading}><option value=''>Không gắn CLB</option>{clubs.map((option) => <option key={option.id} value={option.id}>{getSportsClubOptionLabel(option)}</option>)}</CFormSelect></CCol>
        <CCol md={4}><CFormLabel>Loại thành tích</CFormLabel><CFormSelect value={form.achievementType} onChange={(event) => updateField('achievementType', event.target.value)} disabled={submitting || uploading}>{ACHIEVEMENT_TYPE_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</CFormSelect></CCol>
        <CCol md={4}><CFormLabel>Môn</CFormLabel><CFormSelect value={form.sportType} onChange={(event) => updateField('sportType', event.target.value)} disabled={submitting || uploading}>{SPORT_TYPE_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</CFormSelect></CCol>
        <CCol md={4}><CFormLabel>Trạng thái</CFormLabel><CFormSelect value={form.status} onChange={(event) => updateField('status', event.target.value)} disabled={submitting || uploading}>{ACHIEVEMENT_STATUS_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</CFormSelect></CCol>
        <CCol md={8}><CFormLabel>Tiêu đề *</CFormLabel><CFormInput value={form.title} onChange={(event) => updateField('title', event.target.value)} disabled={submitting || uploading} invalid={Boolean(fieldErrors.title)} />{fieldErrors.title ? <div className='text-danger small mt-1'>{fieldErrors.title}</div> : null}</CCol>
        <CCol md={4}><CFormLabel>Achieved At</CFormLabel><CFormInput type='datetime-local' value={form.achievedAt} onChange={(event) => updateField('achievedAt', event.target.value)} disabled={submitting || uploading} /></CCol>
        <CCol md={4}><CFormLabel>Result Value</CFormLabel><CFormInput type='number' step='any' value={form.resultValue} onChange={(event) => updateField('resultValue', event.target.value)} disabled={submitting || uploading} /></CCol>
        <CCol md={4}><CFormLabel>Result Unit</CFormLabel><CFormInput value={form.resultUnit} onChange={(event) => updateField('resultUnit', event.target.value)} disabled={submitting || uploading} /></CCol>
        <CCol md={4}><CFormLabel>Nguồn</CFormLabel><CFormSelect value={form.source} onChange={(event) => updateField('source', event.target.value)} disabled={submitting || uploading}>{ACHIEVEMENT_SOURCE_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</CFormSelect></CCol>
        <CCol md={8}><CFormLabel>Result Text</CFormLabel><CFormInput value={form.resultText} onChange={(event) => updateField('resultText', event.target.value)} disabled={submitting || uploading} /></CCol>
        <CCol md={6}><CFormLabel>Source Reference</CFormLabel><CFormInput value={form.sourceReference} onChange={(event) => updateField('sourceReference', event.target.value)} disabled={submitting || uploading} /></CCol>
        <CCol md={6}><CFormLabel>Verified At</CFormLabel><CFormInput type='datetime-local' value={form.verifiedAt} onChange={(event) => updateField('verifiedAt', event.target.value)} disabled={submitting || uploading} /></CCol>
        <CCol xs={12}><CFormLabel>Mô tả</CFormLabel><CFormTextarea rows={3} value={form.description} onChange={(event) => updateField('description', event.target.value)} disabled={submitting || uploading} /></CCol>
        <CCol xs={12}><CFormLabel>Ghi chú</CFormLabel><CFormTextarea rows={3} value={form.note} onChange={(event) => updateField('note', event.target.value)} disabled={submitting || uploading} /></CCol>
      </CRow>

      <div className='fw-semibold mb-3'>Evidence</div>
      <CRow className='g-3 mb-4'>
        <CCol lg={5}>
          <div className='border rounded p-3 h-100'>
            <CFormLabel htmlFor='sports-achievement-evidence'>Upload evidence</CFormLabel>
            <CFormInput id='sports-achievement-evidence' type='file' multiple disabled={submitting || uploading} onChange={(event) => { handleEvidenceChange(event.target.files); event.target.value = '' }} />
            <div className='small text-body-secondary mt-2'>Evidence được upload vào media library tenant hiện tại và relation được tái sử dụng khi verify submission.</div>
            {uploading ? <div className='d-flex align-items-center gap-2 mt-2'><CSpinner size='sm' /><span>Đang upload evidence...</span></div> : null}
          </div>
        </CCol>
        <CCol lg={7}>
          <div className='border rounded p-3 h-100'>
            <div className='small text-body-secondary mb-2'>Danh sách file</div>
            {form.evidence.length === 0 ? <div className='text-body-secondary'>Chưa có evidence.</div> : (
              <div className='d-flex flex-column gap-2'>
                {form.evidence.map((item) => (
                  <div key={item.id} className='d-flex justify-content-between align-items-center gap-3 flex-wrap'>
                    <div>
                      <div className='fw-semibold'>{item.name || `Media #${item.id}`}</div>
                      <div className='small text-body-secondary'>{item.url || item.mime || '-'}</div>
                    </div>
                    <CButton type='button' size='sm' color='secondary' variant='outline' onClick={() => removeEvidence(item.id)} disabled={submitting || uploading}>Gỡ</CButton>
                  </div>
                ))}
              </div>
            )}
          </div>
        </CCol>
      </CRow>

      {initialValues?.verifiedBy ? <div className='small text-body-secondary mb-3'>Người xác minh hiện tại: {initialValues.verifiedBy.fullName || initialValues.verifiedBy.username || initialValues.verifiedBy.email || '-'}. Cập nhật tiếp theo sẽ giữ người xác minh hiện có nếu backend không nhận giá trị mới.</div> : null}
      {initialValues?.sportType ? <div className='small text-body-secondary mb-3'>Môn hiện tại: {getSportTypeLabel(initialValues.sportType)}. Có thể đổi tại form nếu cần correction/import.</div> : null}
      {initialValues?.verifiedAt ? <div className='small text-body-secondary mb-3'>Verified At hiện tại: {formatSportsDateTime(initialValues.verifiedAt)}</div> : null}

      <div className='d-flex justify-content-end gap-2 flex-wrap'>
        <CButton type='button' color='secondary' variant='outline' onClick={onCancel} disabled={submitting || uploading}>Hủy</CButton>
        <CButton type='submit' color='primary' disabled={submitting || uploading}>{submitting ? 'Đang lưu...' : 'Lưu achievement'}</CButton>
      </div>
    </CForm>
  )
}
