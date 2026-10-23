import { useEffect, useState } from 'react'
import { CAlert, CButton, CCol, CForm, CFormInput, CFormLabel, CFormSelect, CFormTextarea, CRow, CSpinner } from '@coreui/react'
import RunningAchievementFields, { buildRunningAchievementPayload, buildRunningAchievementState, validateRunningAchievementForm } from './RunningAchievementFields'
import { getMySportsProfile, listMySportsClubs } from '../services/sportsMeService'
import { getSportsAchievementSubmissionApiMessage, uploadSportsAchievementSubmissionEvidence } from '../services/sportsAchievementSubmissionService'
import FileAssetPreview from '../../../components/FileAssetPreview'
import {
  ACHIEVEMENT_TYPE_OPTIONS,
  RACE_TYPE_OPTIONS,
  RUNNING_ACHIEVEMENT_TYPE_OPTIONS,
  buildRaceResultTitleSuggestion,
  fromDateTimeInputValue,
  getSportsClubOptionLabel,
  getSportsProfileOptionLabel,
  SPORT_TYPE_OPTIONS,
  SUBMISSION_SOURCE_OPTIONS,
  SUBMISSION_STATUS_OPTIONS,
  isRunningV1AchievementType,
  toDateTimeInputValue,
} from '../utils/sportsAchievementUi'

function buildInitialForm(initialValues = null) {
  return {
    sportsProfile: initialValues?.sportsProfile || null,
    club: initialValues?.club || null,
    achievementType: String(initialValues?.achievementType || 'other').trim() || 'other',
    sportType: String(initialValues?.sportType || '').trim(),
    title: String(initialValues?.title || '').trim(),
    eventCode: String(initialValues?.eventCode || '').trim(),
    bib: String(initialValues?.bib || '').trim(),
    raceType: String(initialValues?.raceType || '').trim(),
    description: String(initialValues?.description || '').trim(),
    achievedAt: toDateTimeInputValue(initialValues?.achievedAt),
    resultValue: initialValues?.resultValue ?? '',
    resultUnit: String(initialValues?.resultUnit || '').trim(),
    resultText: String(initialValues?.resultText || '').trim(),
    source: String(initialValues?.source || 'club_manager').trim() || 'club_manager',
    sourceReference: String(initialValues?.sourceReference || '').trim(),
    note: String(initialValues?.note || '').trim(),
    status: String(initialValues?.status || 'draft').trim() || 'draft',
    evidence: Array.isArray(initialValues?.evidence) ? initialValues.evidence : [],
    distanceKm: initialValues?.distanceKm ?? null,
    durationSeconds: initialValues?.durationSeconds ?? null,
    distancePending: Boolean(initialValues?.distancePending),
    ...buildRunningAchievementState(initialValues),
  }
}

function buildPayload(form) {
  const runningPayload = isRunningV1AchievementType(form.achievementType) && form.sportType === 'running'
    ? buildRunningAchievementPayload(form)
    : {}
  return {
    sportsProfile: form.sportsProfile?.id || null,
    club: form.club?.id || null,
    achievementType: form.achievementType || 'other',
    sportType: form.sportType || null,
    title: form.title || null,
    eventCode: form.eventCode || null,
    bib: form.bib || null,
    raceType: form.raceType || null,
    distancePending: runningPayload.distancePending ?? Boolean(form.distancePending),
    description: form.description || null,
    achievedAt: fromDateTimeInputValue(form.achievedAt),
    resultValue: runningPayload.resultValue ?? (form.resultValue === '' ? null : Number(form.resultValue)),
    distanceKm: runningPayload.distanceKm ?? form.distanceKm ?? null,
    durationSeconds: runningPayload.durationSeconds ?? form.durationSeconds ?? null,
    resultUnit: runningPayload.resultUnit ?? (form.resultUnit || null),
    resultText: runningPayload.resultText ?? (form.resultText || null),
    source: form.source || 'other',
    sourceReference: form.sourceReference || null,
    note: form.note || null,
    status: form.status || 'draft',
    evidence: Array.isArray(form.evidence) ? form.evidence.map((item) => item.id).filter(Boolean) : [],
  }
}

function validateForm(form, options = {}) {
  const errors = {}
  if (!form.sportsProfile?.id) errors.sportsProfile = 'Sports Profile là bắt buộc'
  if (!form.club?.id) errors.club = 'CLB là bắt buộc trong flow hiện tại'
  const effectiveSportType = options.lockedSportType || form.sportType || ''
  if (effectiveSportType === 'running' && isRunningV1AchievementType(form.achievementType)) {
    Object.assign(errors, validateRunningAchievementForm(form))
  } else if (!form.title) {
    errors.title = 'Tiêu đề là bắt buộc'
  }
  return errors
}

export default function SportsAchievementSubmissionForm({
  initialValues = null,
  submitting = false,
  submitError = '',
  onCancel,
  onSubmit,
  lockedSportsProfile = null,
  clubOptions = null,
  clubOptionLabel,
  hideStatusField = false,
  hideSourceField = false,
  omitSportsProfileInPayload = false,
  omitStatusInPayload = false,
  omitSourceInPayload = false,
  allowedAchievementTypes = null,
  lockedSportType = '',
  noteLabel = 'Ghi chú nội bộ',
  submitLabel = 'Lưu submission',
}) {
  const [form, setForm] = useState(() => buildInitialForm(initialValues))
  const [fieldErrors, setFieldErrors] = useState({})
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState('')
  const [profiles, setProfiles] = useState([])
  const [clubs, setClubs] = useState([])
  const isProfileLocked = Boolean(lockedSportsProfile?.id)
  const effectiveClubOptions = Array.isArray(clubOptions) ? clubOptions : clubs
  const achievementTypeOptions = Array.isArray(allowedAchievementTypes) && allowedAchievementTypes.length > 0
    ? RUNNING_ACHIEVEMENT_TYPE_OPTIONS.filter((option) => allowedAchievementTypes.includes(option.value))
    : ACHIEVEMENT_TYPE_OPTIONS
  const effectiveSportType = lockedSportType || form.sportType || ''
  const isRunningMode = effectiveSportType === 'running' && isRunningV1AchievementType(form.achievementType)
  const showRaceResultFields = form.achievementType === 'race_result' || isRunningMode

  useEffect(() => {
    setForm(buildInitialForm(initialValues))
    setFieldErrors({})
    setUploadError('')
    setUploading(false)
  }, [initialValues])

  useEffect(() => {
    if (!lockedSportsProfile?.id) return
    setForm((current) => ({ ...current, sportsProfile: lockedSportsProfile }))
  }, [lockedSportsProfile])

  useEffect(() => {
    if (!lockedSportType) return
    setForm((current) => ({ ...current, sportType: lockedSportType }))
  }, [lockedSportType])

  useEffect(() => {
    if (achievementTypeOptions.length === 0) return
    if (achievementTypeOptions.some((option) => option.value === form.achievementType)) return
    setForm((current) => ({ ...current, achievementType: achievementTypeOptions[0].value }))
  }, [achievementTypeOptions, form.achievementType])

  useEffect(() => {
    let mounted = true
    async function loadOptions() {
      try {
        const [profileResult, clubResult] = await Promise.all([
          getMySportsProfile(),
          listMySportsClubs({ page: 1, pageSize: 500 }),
        ])
        if (!mounted) return

        const myProfile = profileResult?.profile || null
        const nextProfiles = myProfile ? [myProfile] : []
        const nextClubs = Array.isArray(clubResult)
          ? clubResult
            .map((membership) => membership?.club)
            .filter(Boolean)
          : []

        setProfiles(nextProfiles)
        setClubs(nextClubs)

        if (myProfile) {
          setForm((current) => ({
            ...current,
            sportsProfile: current.sportsProfile?.id ? current.sportsProfile : myProfile,
          }))
        }
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
    setForm((current) => {
      const next = { ...current, [key]: value }
      if ((key === 'eventCode' || key === 'bib') && !String(current.title || '').trim()) {
        const suggestion = buildRaceResultTitleSuggestion({ title: current.title, eventCode: key === 'eventCode' ? value : current.eventCode, bib: key === 'bib' ? value : current.bib })
        if (suggestion) next.title = suggestion
      }
      return next
    })
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
        const media = await uploadSportsAchievementSubmissionEvidence(file)
        if (media?.id) uploaded.push(media)
      }
      setForm((current) => ({ ...current, evidence: [...current.evidence, ...uploaded] }))
    } catch (error) {
      setUploadError(getSportsAchievementSubmissionApiMessage(error, 'Không thể upload evidence.'))
    } finally {
      setUploading(false)
    }
  }

  function removeEvidence(id) {
    setForm((current) => ({ ...current, evidence: current.evidence.filter((item) => item.id !== id) }))
  }

  function handleSubmit(event) {
    event.preventDefault()
    const nextErrors = validateForm(form, { lockedSportType })
    setFieldErrors(nextErrors)
    if (Object.keys(nextErrors).length > 0) return
    const payload = buildPayload(form)
    if (omitSportsProfileInPayload) delete payload.sportsProfile
    if (omitStatusInPayload) delete payload.status
    if (omitSourceInPayload) delete payload.source
    onSubmit?.(payload)
  }

  const statusOptions = SUBMISSION_STATUS_OPTIONS.filter((option) => option.value === 'draft' || option.value === 'submitted')

  return (
    <CForm onSubmit={handleSubmit}>
      {submitError ? <CAlert color='danger'>{submitError}</CAlert> : null}
      {uploadError ? <CAlert color='danger'>{uploadError}</CAlert> : null}

      <div className='fw-semibold mb-3'>Thông tin đề nghị thành tích</div>
      <CRow className='g-3 mb-4'>
        <CCol md={6}>
          <CFormLabel>Sports Profile *</CFormLabel>
          {isProfileLocked ? (
            <CFormInput value={getSportsProfileOptionLabel(lockedSportsProfile)} disabled readOnly />
          ) : (
            <CFormSelect value={form.sportsProfile?.id ? String(form.sportsProfile.id) : ''} onChange={(event) => updateField('sportsProfile', profiles.find((item) => String(item.id) === event.target.value) || null)} disabled={submitting || uploading} invalid={Boolean(fieldErrors.sportsProfile)}>
              <option value=''>Chọn Sports Profile</option>
              {profiles.map((option) => <option key={option.id} value={option.id}>{getSportsProfileOptionLabel(option)}</option>)}
            </CFormSelect>
          )}
          {fieldErrors.sportsProfile ? <div className='text-danger small mt-1'>{fieldErrors.sportsProfile}</div> : null}
        </CCol>
        <CCol md={6}>
          <CFormLabel>CLB *</CFormLabel>
          <CFormSelect value={form.club?.id ? String(form.club.id) : ''} onChange={(event) => updateField('club', effectiveClubOptions.find((item) => String(item.id) === event.target.value) || null)} disabled={submitting || uploading} invalid={Boolean(fieldErrors.club)}>
            <option value=''>Chọn CLB</option>
            {effectiveClubOptions.map((option) => <option key={option.id} value={option.id}>{clubOptionLabel ? clubOptionLabel(option) : getSportsClubOptionLabel(option)}</option>)}
          </CFormSelect>
          {fieldErrors.club ? <div className='text-danger small mt-1'>{fieldErrors.club}</div> : null}
        </CCol>
        <CCol md={4}><CFormLabel>Loại thành tích</CFormLabel><CFormSelect value={form.achievementType} onChange={(event) => updateField('achievementType', event.target.value)} disabled={submitting || uploading || achievementTypeOptions.length === 1}>{achievementTypeOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</CFormSelect></CCol>
        <CCol md={4}>
          <CFormLabel>Môn</CFormLabel>
          {lockedSportType
            ? <CFormInput value={SPORT_TYPE_OPTIONS.find((option) => option.value === lockedSportType)?.label || lockedSportType} disabled readOnly />
            : <CFormSelect value={form.sportType} onChange={(event) => updateField('sportType', event.target.value)} disabled={submitting || uploading}>{SPORT_TYPE_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</CFormSelect>}
        </CCol>
        {!hideStatusField ? <CCol md={4}><CFormLabel>Trạng thái ban đầu</CFormLabel><CFormSelect value={form.status} onChange={(event) => updateField('status', event.target.value)} disabled={submitting || uploading}>{statusOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</CFormSelect></CCol> : null}
        {isRunningMode ? (
          <RunningAchievementFields form={form} errors={fieldErrors} disabled={submitting || uploading} onChange={updateField} />
        ) : (
          <>
            {showRaceResultFields ? (
              <>
                <CCol md={4}><CFormLabel>Mã giải (eventCode)</CFormLabel><CFormInput value={form.eventCode} onChange={(event) => updateField('eventCode', event.target.value)} disabled={submitting || uploading} /></CCol>
                <CCol md={4}><CFormLabel>BIB</CFormLabel><CFormInput value={form.bib} onChange={(event) => updateField('bib', event.target.value)} disabled={submitting || uploading} /></CCol>
                <CCol md={4}><CFormLabel>Loại đường chạy</CFormLabel><CFormSelect value={form.raceType} onChange={(event) => updateField('raceType', event.target.value)} disabled={submitting || uploading}><option value=''>Chưa xác định</option>{RACE_TYPE_OPTIONS.filter((option) => option.value).map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</CFormSelect></CCol>
              </>
            ) : null}
            <CCol md={8}><CFormLabel>Tiêu đề *</CFormLabel><CFormInput value={form.title} onChange={(event) => updateField('title', event.target.value)} disabled={submitting || uploading} invalid={Boolean(fieldErrors.title)} />{fieldErrors.title ? <div className='text-danger small mt-1'>{fieldErrors.title}</div> : null}</CCol>
            <CCol md={4}><CFormLabel>Achieved At</CFormLabel><CFormInput type='datetime-local' value={form.achievedAt} onChange={(event) => updateField('achievedAt', event.target.value)} disabled={submitting || uploading} /></CCol>
            <CCol md={4}><CFormLabel>Result Value</CFormLabel><CFormInput type='number' step='any' value={form.resultValue} onChange={(event) => updateField('resultValue', event.target.value)} disabled={submitting || uploading} /></CCol>
            <CCol md={4}><CFormLabel>Result Unit</CFormLabel><CFormInput value={form.resultUnit} onChange={(event) => updateField('resultUnit', event.target.value)} disabled={submitting || uploading} /></CCol>
            <CCol md={8}><CFormLabel>Result Text</CFormLabel><CFormInput value={form.resultText} onChange={(event) => updateField('resultText', event.target.value)} disabled={submitting || uploading} /></CCol>
            <CCol md={12}><CFormLabel>Source Reference</CFormLabel><CFormInput value={form.sourceReference} onChange={(event) => updateField('sourceReference', event.target.value)} disabled={submitting || uploading} /></CCol>
          </>
        )}
        {!hideSourceField ? <CCol md={4}><CFormLabel>Nguồn đề nghị</CFormLabel><CFormSelect value={form.source} onChange={(event) => updateField('source', event.target.value)} disabled={submitting || uploading}>{SUBMISSION_SOURCE_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</CFormSelect></CCol> : null}
        <CCol xs={12}><CFormLabel>Mô tả</CFormLabel><CFormTextarea rows={3} value={form.description} onChange={(event) => updateField('description', event.target.value)} disabled={submitting || uploading} /></CCol>
        <CCol xs={12}><CFormLabel>{noteLabel}</CFormLabel><CFormTextarea rows={3} value={form.note} onChange={(event) => updateField('note', event.target.value)} disabled={submitting || uploading} /></CCol>
      </CRow>

      <div className='fw-semibold mb-3'>Evidence</div>
      <CRow className='g-3 mb-4'>
        <CCol lg={5}>
          <div className='border rounded p-3 h-100'>
            <CFormLabel htmlFor='sports-achievement-submission-evidence'>Upload evidence</CFormLabel>
            <CFormInput id='sports-achievement-submission-evidence' type='file' multiple disabled={submitting || uploading} onChange={(event) => { handleEvidenceChange(event.target.files); event.target.value = '' }} />
            <div className='small text-body-secondary mt-2'>Evidence giữ ở Submission và sẽ được gắn lại vào Achievement khi verify.</div>
            {uploading ? <div className='d-flex align-items-center gap-2 mt-2'><CSpinner size='sm' /><span>Đang upload evidence...</span></div> : null}
          </div>
        </CCol>
        <CCol lg={7}>
          <div className='border rounded p-3 h-100'>
            <div className='small text-body-secondary mb-2'>Danh sách file</div>
            <FileAssetPreview
              files={form.evidence}
              mode='editable'
              onRemove={(fileId) => removeEvidence(fileId)}
              emptyText='Chưa có evidence.'
              compact={false}
            />
          </div>
        </CCol>
      </CRow>

      <div className='d-flex justify-content-end gap-2 flex-wrap'>
        <CButton type='button' color='secondary' variant='outline' onClick={onCancel} disabled={submitting || uploading}>Hủy</CButton>
        <CButton type='submit' color='primary' disabled={submitting || uploading}>{submitting ? 'Đang lưu...' : submitLabel}</CButton>
      </div>
    </CForm>
  )
}
