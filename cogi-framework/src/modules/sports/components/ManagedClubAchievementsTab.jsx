import { useEffect, useMemo, useState } from 'react'
import {
  CAlert,
  CBadge,
  CButton,
  CButtonGroup,
  CCard,
  CCardBody,
  CCol,
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
  createManagedClubAchievementCorrectionSubmission,
  createManagedClubAchievementSubmission,
  getManagedClubAchievement,
  getManagedClubAchievementSubmission,
  getSportsClubManagementApiMessage,
  listManagedClubAchievementProfileOptions,
  listManagedClubAchievements,
  listManagedClubAchievementSubmissions,
  listManagedClubProfileOptions,
  revokeManagedClubAchievement,
  rejectManagedClubAchievementSubmission,
  submitManagedClubAchievementSubmission,
  updateManagedClubAchievementSubmission,
  verifyManagedClubAchievementSubmission,
} from '../services/sportsClubManagementService'
import { uploadSportsAchievementSubmissionEvidence } from '../services/sportsAchievementSubmissionService'
import {
  ACHIEVEMENT_STATUS_FILTER_OPTIONS,
  ACHIEVEMENT_TYPE_OPTIONS,
  formatSportsDateTime,
  getAchievementStatusMeta,
  getAchievementTypeLabel,
  getSportTypeLabel,
  getSportsClubOptionLabel,
  getSportsProfileOptionLabel,
  getSubmissionSourceLabel,
  getSubmissionStatusMeta,
  getUserLabel,
  SPORT_TYPE_OPTIONS,
  SUBMISSION_STATUS_OPTIONS,
  toDateTimeInputValue,
  fromDateTimeInputValue,
} from '../utils/sportsAchievementUi'
import { getClubMembershipStatusMeta } from '../utils/clubMembershipUi'

const EMPTY_PROFILES = []

function buildPages(currentPage, pageCount) {
  const pages = []
  if (pageCount <= 7) {
    for (let index = 1; index <= pageCount; index += 1) pages.push(index)
    return pages
  }
  const left = Math.max(2, currentPage - 2)
  const right = Math.min(pageCount - 1, currentPage + 2)
  pages.push(1)
  if (left > 2) pages.push('...')
  for (let index = left; index <= right; index += 1) pages.push(index)
  if (right < pageCount - 1) pages.push('...')
  pages.push(pageCount)
  return pages
}

function buildSubmissionFormState(initialSubmission = null) {
  return {
    sportsProfile: initialSubmission?.sportsProfile || null,
    achievementType: String(initialSubmission?.achievementType || 'other').trim() || 'other',
    sportType: String(initialSubmission?.sportType || '').trim(),
    title: String(initialSubmission?.title || '').trim(),
    description: String(initialSubmission?.description || '').trim(),
    achievedAt: toDateTimeInputValue(initialSubmission?.achievedAt),
    resultValue: initialSubmission?.resultValue ?? '',
    resultUnit: String(initialSubmission?.resultUnit || '').trim(),
    resultText: String(initialSubmission?.resultText || '').trim(),
    sourceReference: String(initialSubmission?.sourceReference || '').trim(),
    note: String(initialSubmission?.note || '').trim(),
    reviewNote: String(initialSubmission?.reviewNote || '').trim(),
    evidence: Array.isArray(initialSubmission?.evidence) ? initialSubmission.evidence : [],
  }
}

function buildSubmissionPayload(form, saveMode) {
  return {
    sportsProfile: form.sportsProfile?.id || null,
    achievementType: form.achievementType || 'other',
    sportType: form.sportType || null,
    title: form.title || null,
    description: form.description || null,
    achievedAt: fromDateTimeInputValue(form.achievedAt),
    resultValue: form.resultValue === '' ? null : Number(form.resultValue),
    resultUnit: form.resultUnit || null,
    resultText: form.resultText || null,
    sourceReference: form.sourceReference || null,
    note: form.note || null,
    evidence: Array.isArray(form.evidence) ? form.evidence.map((item) => item.id).filter(Boolean) : [],
    verifyNow: saveMode === 'verify_now',
  }
}

function validateSubmissionForm(form) {
  const errors = {}
  if (!form.sportsProfile?.id) errors.sportsProfile = 'Sports Profile là bắt buộc'
  if (!form.title) errors.title = 'Tiêu đề là bắt buộc'
  return errors
}

function renderMembershipBadge(membership) {
  if (!membership?.status) return null
  const statusMeta = getClubMembershipStatusMeta(membership.status)
  return <CBadge color={statusMeta.color}>{membership.memberCode ? `${membership.memberCode} · ${statusMeta.label}` : statusMeta.label}</CBadge>
}

function renderEvidenceList(evidence = []) {
  if (!Array.isArray(evidence) || evidence.length === 0) return <div className='text-body-secondary'>Chưa có evidence.</div>
  return (
    <div className='d-flex flex-column gap-2'>
      {evidence.map((item) => {
        const isImage = String(item?.mime || '').toLowerCase().startsWith('image/')
        return (
          <div key={item.id} className='border rounded p-2'>
            {isImage && item?.url ? <img src={item.url} alt={item.name || `Evidence ${item.id}`} style={{ width: '100%', maxHeight: 180, objectFit: 'cover', borderRadius: 8 }} className='mb-2' /> : null}
            <a href={item?.url || '#'} target='_blank' rel='noreferrer'>{item?.name || item?.url || `Media #${item?.id}`}</a>
          </div>
        )
      })}
    </div>
  )
}

function SubmissionEditorModal({ visible = false, club = null, initialSubmission = null, defaultProfiles = EMPTY_PROFILES, lockedProfile = null, lockedMembership = null, onClose, onSaved }) {
  const [form, setForm] = useState(() => buildSubmissionFormState(initialSubmission))
  const [fieldErrors, setFieldErrors] = useState({})
  const [uploading, setUploading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [profileSearch, setProfileSearch] = useState('')
  const [memberProfileOptions, setMemberProfileOptions] = useState(defaultProfiles)
  const [tenantProfileOptions, setTenantProfileOptions] = useState([])

  const isEdit = Boolean(initialSubmission?.id)
  const isProfileLocked = Boolean(lockedProfile?.id)

  useEffect(() => {
    if (!visible) return
    const nextForm = buildSubmissionFormState(initialSubmission)
    if (lockedProfile?.id) nextForm.sportsProfile = lockedProfile
    setForm(nextForm)
    setFieldErrors({})
    setError('')
    setUploading(false)
    setSubmitting(false)
    setProfileSearch('')
    setMemberProfileOptions(defaultProfiles)
    setTenantProfileOptions([])
  }, [visible, initialSubmission, defaultProfiles, lockedProfile])

  useEffect(() => {
    if (!visible || !club?.id) return
    let mounted = true
    async function loadMemberProfiles() {
      try {
        const rows = await listManagedClubAchievementProfileOptions(club.id, { pageSize: 100 })
        if (!mounted) return
        setMemberProfileOptions(Array.isArray(rows) ? rows : [])
      } catch {
        if (!mounted) return
        setMemberProfileOptions(defaultProfiles)
      }
    }
    loadMemberProfiles()
    return () => { mounted = false }
  }, [visible, club?.id])

  useEffect(() => {
    if (!visible || !club?.id) return
    const keyword = String(profileSearch || '').trim()
    if (!keyword) {
      setTenantProfileOptions([])
      return
    }
    let mounted = true
    async function searchProfiles() {
      try {
        const result = await listManagedClubProfileOptions(club.id, { page: 1, pageSize: 20, search: keyword })
        if (!mounted) return
        setTenantProfileOptions(Array.isArray(result?.rows) ? result.rows : [])
      } catch (requestError) {
        if (!mounted) return
        setTenantProfileOptions([])
        setError(getSportsClubManagementApiMessage(requestError, 'Không tìm được Sports Profile trong tenant.'))
      }
    }
    searchProfiles()
    return () => { mounted = false }
  }, [visible, club?.id, profileSearch])

  const profileOptions = useMemo(() => {
    const map = new Map()
    ;(memberProfileOptions || []).forEach((membership) => {
      const profile = membership?.sportsProfile
      if (profile?.id && !map.has(profile.id)) {
        map.set(profile.id, {
          profile,
          membership,
        })
      }
    })
    ;(tenantProfileOptions || []).forEach((profile) => {
      if (profile?.id && !map.has(profile.id)) {
        map.set(profile.id, {
          profile,
          membership: null,
        })
      }
    })
    return Array.from(map.values())
  }, [memberProfileOptions, tenantProfileOptions])

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
    setError('')
    try {
      const uploaded = []
      for (const file of nextFiles) {
        const media = await uploadSportsAchievementSubmissionEvidence(file)
        if (media?.id) uploaded.push(media)
      }
      setForm((current) => ({ ...current, evidence: [...current.evidence, ...uploaded] }))
    } catch (requestError) {
      setError(getSportsClubManagementApiMessage(requestError, 'Không thể upload evidence.'))
    } finally {
      setUploading(false)
    }
  }

  function removeEvidence(id) {
    setForm((current) => ({ ...current, evidence: current.evidence.filter((item) => item.id !== id) }))
  }

  async function handleSave(saveMode) {
    const nextErrors = validateSubmissionForm(form)
    setFieldErrors(nextErrors)
    if (Object.keys(nextErrors).length > 0) return
    setSubmitting(true)
    setError('')
    try {
      const payload = buildSubmissionPayload(form, saveMode)
      const result = isEdit
        ? await updateManagedClubAchievementSubmission(club.id, initialSubmission.id, payload)
        : await createManagedClubAchievementSubmission(club.id, payload)
      onSaved?.(result, saveMode)
    } catch (requestError) {
      setError(getSportsClubManagementApiMessage(requestError, isEdit ? 'Không thể cập nhật submission.' : 'Không thể tạo submission.'))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <CModal visible={visible} onClose={() => !submitting && !uploading && onClose?.()} size='xl' scrollable>
      <CModalHeader>
        <CModalTitle>{isEdit ? 'Cập nhật đề nghị thành tích' : 'Ghi nhận thành tích'}</CModalTitle>
      </CModalHeader>
      <CModalBody>
        {error ? <CAlert color='danger'>{error}</CAlert> : null}
        <CRow className='g-3'>
          <CCol md={12}>
            <CFormLabel>Sports Profile *</CFormLabel>
            {isProfileLocked ? (
              <>
                <CFormInput value={getSportsProfileOptionLabel(lockedProfile)} disabled readOnly className='mb-2' />
                {lockedMembership?.memberCode || lockedMembership?.status ? <div className='small text-body-secondary'>Membership hiện tại: {lockedMembership?.memberCode || '-'} · {lockedMembership?.status || '-'}</div> : null}
              </>
            ) : (
              <>
                <CFormInput value={profileSearch} placeholder='Tìm thêm hồ sơ ngoài danh sách member hiện tại nếu cần' onChange={(event) => setProfileSearch(event.target.value)} disabled={submitting || uploading} className='mb-2' />
                <CFormSelect value={form.sportsProfile?.id ? String(form.sportsProfile.id) : ''} onChange={(event) => {
                  const selected = profileOptions.find((item) => String(item.profile?.id) === event.target.value) || null
                  updateField('sportsProfile', selected?.profile || null)
                }} disabled={submitting || uploading} invalid={Boolean(fieldErrors.sportsProfile)}>
                  <option value=''>Chọn Sports Profile</option>
                  {profileOptions.map((option) => (
                    <option key={option.profile.id} value={option.profile.id}>
                      {option.membership?.memberCode
                        ? `${option.membership.memberCode} - ${getSportsProfileOptionLabel(option.profile)}`
                        : getSportsProfileOptionLabel(option.profile)}
                    </option>
                  ))}
                </CFormSelect>
              </>
            )}
            {fieldErrors.sportsProfile ? <div className='text-danger small mt-1'>{fieldErrors.sportsProfile}</div> : null}
          </CCol>
          <CCol md={4}><CFormLabel>Loại thành tích</CFormLabel><CFormSelect value={form.achievementType} onChange={(event) => updateField('achievementType', event.target.value)} disabled={submitting || uploading}>{ACHIEVEMENT_TYPE_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</CFormSelect></CCol>
          <CCol md={4}><CFormLabel>Môn</CFormLabel><CFormSelect value={form.sportType} onChange={(event) => updateField('sportType', event.target.value)} disabled={submitting || uploading}>{SPORT_TYPE_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</CFormSelect></CCol>
          <CCol md={4}><CFormLabel>CLB</CFormLabel><CFormInput value={getSportsClubOptionLabel(club)} disabled readOnly /></CCol>
          <CCol md={8}><CFormLabel>Tiêu đề *</CFormLabel><CFormInput value={form.title} onChange={(event) => updateField('title', event.target.value)} disabled={submitting || uploading} invalid={Boolean(fieldErrors.title)} />{fieldErrors.title ? <div className='text-danger small mt-1'>{fieldErrors.title}</div> : null}</CCol>
          <CCol md={4}><CFormLabel>Achieved At</CFormLabel><CFormInput type='datetime-local' value={form.achievedAt} onChange={(event) => updateField('achievedAt', event.target.value)} disabled={submitting || uploading} /></CCol>
          <CCol md={4}><CFormLabel>Result Value</CFormLabel><CFormInput type='number' step='any' value={form.resultValue} onChange={(event) => updateField('resultValue', event.target.value)} disabled={submitting || uploading} /></CCol>
          <CCol md={4}><CFormLabel>Result Unit</CFormLabel><CFormInput value={form.resultUnit} onChange={(event) => updateField('resultUnit', event.target.value)} disabled={submitting || uploading} /></CCol>
          <CCol md={4}><CFormLabel>Result Text</CFormLabel><CFormInput value={form.resultText} onChange={(event) => updateField('resultText', event.target.value)} disabled={submitting || uploading} /></CCol>
          <CCol md={8}><CFormLabel>Source Reference</CFormLabel><CFormInput value={form.sourceReference} onChange={(event) => updateField('sourceReference', event.target.value)} disabled={submitting || uploading} /></CCol>
          <CCol xs={12}><CFormLabel>Mô tả</CFormLabel><CFormTextarea rows={3} value={form.description} onChange={(event) => updateField('description', event.target.value)} disabled={submitting || uploading} /></CCol>
          <CCol xs={12}><CFormLabel>Ghi chú</CFormLabel><CFormTextarea rows={3} value={form.note} onChange={(event) => updateField('note', event.target.value)} disabled={submitting || uploading} /></CCol>
          <CCol xs={12}>
            <CFormLabel>Evidence</CFormLabel>
            <CFormInput type='file' multiple disabled={submitting || uploading} onChange={(event) => { handleEvidenceChange(event.target.files); event.target.value = '' }} className='mb-2' />
            {uploading ? <div className='d-flex align-items-center gap-2 mb-2'><CSpinner size='sm' />Đang upload evidence...</div> : null}
            {form.evidence.length === 0 ? <div className='text-body-secondary'>Chưa có evidence.</div> : (
              <div className='d-flex flex-column gap-2'>
                {form.evidence.map((item) => (
                  <div key={item.id} className='d-flex justify-content-between align-items-center gap-3 flex-wrap border rounded p-2'>
                    <div>{item.name || item.url || `Media #${item.id}`}</div>
                    <CButton type='button' size='sm' color='secondary' variant='outline' onClick={() => removeEvidence(item.id)} disabled={submitting || uploading}>Gỡ</CButton>
                  </div>
                ))}
              </div>
            )}
          </CCol>
        </CRow>
      </CModalBody>
      <CModalFooter>
        <CButton color='secondary' variant='outline' onClick={() => onClose?.()} disabled={submitting || uploading}>Hủy</CButton>
        <CButton color='primary' variant='outline' onClick={() => handleSave('submitted')} disabled={submitting || uploading}>{submitting ? 'Đang lưu...' : 'Lưu đề nghị'}</CButton>
        {!isEdit ? <CButton color='success' onClick={() => handleSave('verify_now')} disabled={submitting || uploading}>{submitting ? 'Đang xử lý...' : 'Ghi nhận ngay'}</CButton> : null}
      </CModalFooter>
    </CModal>
  )
}

function SubmissionDetailModal({ visible = false, club = null, submissionId = null, lockedProfile = null, lockedMembership = null, onClose, onChanged }) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [submission, setSubmission] = useState(null)
  const [editing, setEditing] = useState(false)
  const [reviewModal, setReviewModal] = useState({ visible: false, action: '', note: '' })
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (!visible || !club?.id || !submissionId) return
    let mounted = true
    async function load() {
      setLoading(true)
      setError('')
      try {
        const result = await getManagedClubAchievementSubmission(club.id, submissionId)
        if (!mounted) return
        setSubmission(result || null)
      } catch (requestError) {
        if (!mounted) return
        setSubmission(null)
        setError(getSportsClubManagementApiMessage(requestError, 'Không tải được chi tiết đề nghị thành tích.'))
      } finally {
        if (mounted) setLoading(false)
      }
    }
    load()
    return () => { mounted = false }
  }, [visible, club?.id, submissionId])

  async function handleReview() {
    if (!submission?.id) return
    setSubmitting(true)
    setError('')
    try {
      const result = reviewModal.action === 'verify'
        ? await verifyManagedClubAchievementSubmission(club.id, submission.id, { reviewNote: reviewModal.note || null })
        : await rejectManagedClubAchievementSubmission(club.id, submission.id, { reviewNote: reviewModal.note || null })
      setSubmission(result)
      setReviewModal({ visible: false, action: '', note: '' })
      onChanged?.(result, reviewModal.action)
    } catch (requestError) {
      setError(getSportsClubManagementApiMessage(requestError, reviewModal.action === 'verify' ? 'Không thể xác minh submission.' : 'Không thể từ chối submission.'))
    } finally {
      setSubmitting(false)
    }
  }

  async function handleSubmitDraft() {
    if (!submission?.id) return
    setSubmitting(true)
    setError('')
    try {
      const result = await submitManagedClubAchievementSubmission(club.id, submission.id)
      setSubmission(result)
      onChanged?.(result, 'submitted')
    } catch (requestError) {
      setError(getSportsClubManagementApiMessage(requestError, 'Không thể gửi submission.'))
    } finally {
      setSubmitting(false)
    }
  }

  if (editing && submission) {
    return <SubmissionEditorModal visible={visible} club={club} initialSubmission={submission} lockedProfile={lockedProfile} lockedMembership={lockedMembership} onClose={() => setEditing(false)} onSaved={(result) => { setSubmission(result); setEditing(false); onChanged?.(result, 'updated') }} />
  }

  return (
    <CModal visible={visible} onClose={() => !submitting && onClose?.()} size='xl' scrollable>
      <CModalHeader>
        <CModalTitle>Chi tiết đề nghị thành tích</CModalTitle>
      </CModalHeader>
      <CModalBody>
        {error ? <CAlert color='danger'>{error}</CAlert> : null}
        {loading ? <div className='d-flex align-items-center gap-2'><CSpinner size='sm' />Đang tải dữ liệu...</div> : null}
        {!loading && submission ? (
          <>
            <div className='d-flex justify-content-between align-items-start gap-3 flex-wrap mb-3'>
              <div>
                <div className='fs-5 fw-semibold'>{submission.title || '-'}</div>
                <div className='text-body-secondary'>{submission.sportsProfile?.fullName || '-'} · {submission.club?.name || '-'}</div>
                <div className='d-flex gap-2 mt-2 flex-wrap'>
                  <CBadge color={getSubmissionStatusMeta(submission.status).color}>{getSubmissionStatusMeta(submission.status).label}</CBadge>
                  {renderMembershipBadge(submission.clubMembership)}
                </div>
              </div>
              <div className='d-flex gap-2 flex-wrap'>
                {(submission.status === 'draft' || submission.status === 'submitted') ? <CButton color='warning' variant='outline' onClick={() => setEditing(true)} disabled={submitting}>Sửa</CButton> : null}
                {submission.status === 'draft' ? <CButton color='primary' variant='outline' onClick={handleSubmitDraft} disabled={submitting}>Gửi đề nghị</CButton> : null}
                {submission.status === 'submitted' ? <CButton color='success' onClick={() => setReviewModal({ visible: true, action: 'verify', note: submission.reviewNote || '' })} disabled={submitting}>Xác minh</CButton> : null}
                {submission.status === 'submitted' ? <CButton color='danger' variant='outline' onClick={() => setReviewModal({ visible: true, action: 'reject', note: submission.reviewNote || '' })} disabled={submitting}>Từ chối</CButton> : null}
              </div>
            </div>
            <CRow className='g-3 mb-4'>
              <CCol md={4}><CCard className='h-100'><CCardBody><div className='small text-body-secondary'>Sports Profile</div><div className='fw-semibold'>{getSportsProfileOptionLabel(submission.sportsProfile)}</div></CCardBody></CCard></CCol>
              <CCol md={4}><CCard className='h-100'><CCardBody><div className='small text-body-secondary'>Member Code / Membership</div><div className='fw-semibold'>{submission.clubMembership?.memberCode || '-'}</div><div className='small text-body-secondary mt-1'>{submission.clubMembership?.status || 'Chưa có membership hiện tại'}</div></CCardBody></CCard></CCol>
              <CCol md={4}><CCard className='h-100'><CCardBody><div className='small text-body-secondary'>Loại thành tích</div><div className='fw-semibold'>{getAchievementTypeLabel(submission.achievementType)}</div><div className='small text-body-secondary mt-1'>{getSportTypeLabel(submission.sportType)}</div></CCardBody></CCard></CCol>
              <CCol md={4}><CCard className='h-100'><CCardBody><div className='small text-body-secondary'>Achieved At</div><div className='fw-semibold'>{formatSportsDateTime(submission.achievedAt)}</div></CCardBody></CCard></CCol>
              <CCol md={4}><CCard className='h-100'><CCardBody><div className='small text-body-secondary'>Kết quả</div><div className='fw-semibold'>{submission.resultText || '-'}</div><div className='small text-body-secondary mt-1'>{submission.resultValue ?? '-'} {submission.resultUnit || ''}</div></CCardBody></CCard></CCol>
              <CCol md={4}><CCard className='h-100'><CCardBody><div className='small text-body-secondary'>Nguồn</div><div className='fw-semibold'>{getSubmissionSourceLabel(submission.source)}</div><div className='small text-body-secondary mt-1'>{submission.sourceReference || '-'}</div></CCardBody></CCard></CCol>
              <CCol md={6}><CCard className='h-100'><CCardBody><div className='small text-body-secondary'>Submitted By</div><div className='fw-semibold'>{getUserLabel(submission.submittedBy)}</div><div className='small text-body-secondary mt-1'>{formatSportsDateTime(submission.submittedAt)}</div></CCardBody></CCard></CCol>
              <CCol md={6}><CCard className='h-100'><CCardBody><div className='small text-body-secondary'>Review</div><div className='fw-semibold'>{getUserLabel(submission.reviewedBy)}</div><div className='small text-body-secondary mt-1'>{formatSportsDateTime(submission.reviewedAt)}</div></CCardBody></CCard></CCol>
            </CRow>
            <CCard className='mb-4'><CCardBody><div className='small text-body-secondary mb-2'>Mô tả</div><div style={{ whiteSpace: 'pre-wrap' }}>{submission.description || 'Không có.'}</div><div className='small text-body-secondary mt-3 mb-2'>Review Note</div><div style={{ whiteSpace: 'pre-wrap' }}>{submission.reviewNote || 'Không có.'}</div><div className='small text-body-secondary mt-3 mb-2'>Ghi chú</div><div style={{ whiteSpace: 'pre-wrap' }}>{submission.note || 'Không có.'}</div></CCardBody></CCard>
            <CCard><CCardBody><div className='small text-body-secondary mb-2'>Evidence</div>{renderEvidenceList(submission.evidence)}</CCardBody></CCard>
          </>
        ) : null}
      </CModalBody>
      <CModalFooter>
        <CButton color='secondary' variant='outline' onClick={() => onClose?.()} disabled={submitting}>Đóng</CButton>
      </CModalFooter>
      <CModal visible={reviewModal.visible} onClose={() => !submitting && setReviewModal({ visible: false, action: '', note: '' })}>
        <CModalHeader>
          <CModalTitle>{reviewModal.action === 'verify' ? 'Xác minh submission' : 'Từ chối submission'}</CModalTitle>
        </CModalHeader>
        <CModalBody>
          <CFormLabel>Review Note</CFormLabel>
          <CFormTextarea rows={4} value={reviewModal.note} onChange={(event) => setReviewModal((current) => ({ ...current, note: event.target.value }))} disabled={submitting} />
        </CModalBody>
        <CModalFooter>
          <CButton color='secondary' variant='outline' onClick={() => setReviewModal({ visible: false, action: '', note: '' })} disabled={submitting}>Hủy</CButton>
          <CButton color={reviewModal.action === 'verify' ? 'success' : 'danger'} onClick={handleReview} disabled={submitting}>{submitting ? 'Đang xử lý...' : (reviewModal.action === 'verify' ? 'Xác minh' : 'Từ chối')}</CButton>
        </CModalFooter>
      </CModal>
    </CModal>
  )
}

function AchievementDetailModal({ visible = false, club = null, achievementId = null, onClose }) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [achievement, setAchievement] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const [revokeModal, setRevokeModal] = useState({ visible: false, reason: '' })

  useEffect(() => {
    if (!visible || !club?.id || !achievementId) return
    let mounted = true
    async function load() {
      setLoading(true)
      setError('')
      try {
        const result = await getManagedClubAchievement(club.id, achievementId)
        if (!mounted) return
        setAchievement(result || null)
      } catch (requestError) {
        if (!mounted) return
        setAchievement(null)
        setError(getSportsClubManagementApiMessage(requestError, 'Không tải được achievement của CLB.'))
      } finally {
        if (mounted) setLoading(false)
      }
    }
    load()
    return () => { mounted = false }
  }, [visible, club?.id, achievementId])

  async function handleRevoke() {
    if (!achievement?.id) return
    if (!String(revokeModal.reason || '').trim()) {
      setError('Lý do rút ghi nhận là bắt buộc')
      return
    }
    setSubmitting(true)
    setError('')
    try {
      const result = await revokeManagedClubAchievement(club.id, achievement.id, { reason: revokeModal.reason })
      setAchievement(result)
      setRevokeModal({ visible: false, reason: '' })
    } catch (requestError) {
      setError(getSportsClubManagementApiMessage(requestError, 'Không thể rút ghi nhận thành tích.'))
    } finally {
      setSubmitting(false)
    }
  }

  async function handleCreateCorrectionSubmission() {
    if (!achievement?.id) return
    setSubmitting(true)
    setError('')
    try {
      const result = await createManagedClubAchievementCorrectionSubmission(club.id, achievement.id)
      onClose?.()
      window.dispatchEvent(new CustomEvent('managed-club-achievement-correction-created', { detail: { submission: result } }))
    } catch (requestError) {
      setError(getSportsClubManagementApiMessage(requestError, 'Không thể tạo đề nghị sửa từ thành tích này.'))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <CModal visible={visible} onClose={onClose} size='xl' scrollable>
      <CModalHeader>
        <CModalTitle>Chi tiết thành tích đã ghi nhận</CModalTitle>
      </CModalHeader>
      <CModalBody>
        {error ? <CAlert color='danger'>{error}</CAlert> : null}
        {loading ? <div className='d-flex align-items-center gap-2'><CSpinner size='sm' />Đang tải dữ liệu...</div> : null}
        {!loading && achievement ? (
          <>
            <div className='d-flex justify-content-between align-items-start gap-3 flex-wrap mb-3'>
              <div className='d-flex gap-2 flex-wrap'>
                <CBadge color={getAchievementStatusMeta(achievement.status).color}>{getAchievementStatusMeta(achievement.status).label}</CBadge>
                {renderMembershipBadge(achievement.clubMembership)}
              </div>
              <div className='d-flex gap-2 flex-wrap'>
                {achievement.status === 'active' ? <CButton color='danger' variant='outline' onClick={() => setRevokeModal({ visible: true, reason: '' })} disabled={submitting}>Rút ghi nhận</CButton> : null}
                {achievement.status === 'revoked' ? <CButton color='primary' variant='outline' onClick={handleCreateCorrectionSubmission} disabled={submitting}>Tạo đề nghị sửa</CButton> : null}
              </div>
            </div>
            <CRow className='g-3 mb-4'>
              <CCol md={4}><CCard className='h-100'><CCardBody><div className='small text-body-secondary'>Sports Profile</div><div className='fw-semibold'>{getSportsProfileOptionLabel(achievement.sportsProfile)}</div></CCardBody></CCard></CCol>
              <CCol md={4}><CCard className='h-100'><CCardBody><div className='small text-body-secondary'>CLB</div><div className='fw-semibold'>{getSportsClubOptionLabel(achievement.club)}</div></CCardBody></CCard></CCol>
              <CCol md={4}><CCard className='h-100'><CCardBody><div className='small text-body-secondary'>Submission nguồn</div><div className='fw-semibold'>{achievement.submission?.title || '-'}</div><div className='small text-body-secondary mt-1'>{achievement.submission?.status || '-'}</div></CCardBody></CCard></CCol>
              <CCol md={4}><CCard className='h-100'><CCardBody><div className='small text-body-secondary'>Loại thành tích</div><div className='fw-semibold'>{getAchievementTypeLabel(achievement.achievementType)}</div><div className='small text-body-secondary mt-1'>{getSportTypeLabel(achievement.sportType)}</div></CCardBody></CCard></CCol>
              <CCol md={4}><CCard className='h-100'><CCardBody><div className='small text-body-secondary'>Kết quả</div><div className='fw-semibold'>{achievement.resultText || '-'}</div><div className='small text-body-secondary mt-1'>{achievement.resultValue ?? '-'} {achievement.resultUnit || ''}</div></CCardBody></CCard></CCol>
              <CCol md={4}><CCard className='h-100'><CCardBody><div className='small text-body-secondary'>Verified</div><div className='fw-semibold'>{formatSportsDateTime(achievement.verifiedAt)}</div><div className='small text-body-secondary mt-1'>{getUserLabel(achievement.verifiedBy)}</div></CCardBody></CCard></CCol>
              {achievement.status === 'revoked' ? <CCol md={4}><CCard className='h-100'><CCardBody><div className='small text-body-secondary'>Rút lúc</div><div className='fw-semibold'>{formatSportsDateTime(achievement.revokedAt)}</div><div className='small text-body-secondary mt-1'>{getUserLabel(achievement.revokedBy)}</div></CCardBody></CCard></CCol> : null}
              {achievement.status === 'revoked' ? <CCol md={8}><CCard className='h-100'><CCardBody><div className='small text-body-secondary'>Lý do rút ghi nhận</div><div className='fw-semibold' style={{ whiteSpace: 'pre-wrap' }}>{achievement.revokeReason || '-'}</div></CCardBody></CCard></CCol> : null}
            </CRow>
            <CCard className='mb-4'><CCardBody><div className='small text-body-secondary mb-2'>Mô tả</div><div style={{ whiteSpace: 'pre-wrap' }}>{achievement.description || 'Không có.'}</div><div className='small text-body-secondary mt-3 mb-2'>Nguồn / Source Reference</div><div>{achievement.source || '-'} · {achievement.sourceReference || '-'}</div><div className='small text-body-secondary mt-3 mb-2'>Ghi chú</div><div style={{ whiteSpace: 'pre-wrap' }}>{achievement.note || 'Không có.'}</div></CCardBody></CCard>
            <CCard><CCardBody><div className='small text-body-secondary mb-2'>Evidence</div>{renderEvidenceList(achievement.evidence)}</CCardBody></CCard>
          </>
        ) : null}
      </CModalBody>
      <CModalFooter>
        <CButton color='secondary' variant='outline' onClick={onClose}>Đóng</CButton>
      </CModalFooter>
      <CModal visible={revokeModal.visible} onClose={() => !submitting && setRevokeModal({ visible: false, reason: '' })}>
        <CModalHeader>
          <CModalTitle>Rút ghi nhận thành tích</CModalTitle>
        </CModalHeader>
        <CModalBody>
          <div className='mb-3'>Thành tích này sẽ không còn được coi là thành tích đang có hiệu lực. Dữ liệu cũ vẫn được giữ lại để tra cứu lịch sử.</div>
          <CFormLabel>Lý do rút ghi nhận *</CFormLabel>
          <CFormTextarea rows={4} value={revokeModal.reason} onChange={(event) => setRevokeModal((current) => ({ ...current, reason: event.target.value }))} disabled={submitting} />
        </CModalBody>
        <CModalFooter>
          <CButton color='secondary' variant='outline' onClick={() => setRevokeModal({ visible: false, reason: '' })} disabled={submitting}>Hủy</CButton>
          <CButton color='danger' onClick={handleRevoke} disabled={submitting}>{submitting ? 'Đang xử lý...' : 'Xác nhận rút ghi nhận'}</CButton>
        </CModalFooter>
      </CModal>
    </CModal>
  )
}

export default function ManagedClubAchievementsTab({ club, membership = null }) {
  const lockedSportsProfileId = membership?.sportsProfile?.id ? String(membership.sportsProfile.id) : ''
  const isMemberScoped = Boolean(lockedSportsProfileId)
  const defaultSubmissionStatus = isMemberScoped ? '' : 'submitted'
  const defaultAchievementStatus = isMemberScoped ? '' : 'active'
  const [viewKey, setViewKey] = useState('submissions')
  const [submissionLoading, setSubmissionLoading] = useState(false)
  const [submissionError, setSubmissionError] = useState('')
  const [submissionRows, setSubmissionRows] = useState([])
  const [submissionFilters, setSubmissionFilters] = useState({ search: '', status: defaultSubmissionStatus, achievementType: '', sportType: '', sportsProfile: lockedSportsProfileId, achievedFrom: '', achievedTo: '' })
  const [appliedSubmissionFilters, setAppliedSubmissionFilters] = useState({ search: '', status: defaultSubmissionStatus, achievementType: '', sportType: '', sportsProfile: lockedSportsProfileId, achievedFrom: '', achievedTo: '' })
  const [submissionPagination, setSubmissionPagination] = useState({ page: 1, pageSize: 10, total: 0, pageCount: 1 })
  const [achievementLoading, setAchievementLoading] = useState(false)
  const [achievementError, setAchievementError] = useState('')
  const [achievementRows, setAchievementRows] = useState([])
  const [achievementFilters, setAchievementFilters] = useState({ search: '', status: defaultAchievementStatus, achievementType: '', sportType: '', sportsProfile: lockedSportsProfileId, achievedFrom: '', achievedTo: '' })
  const [appliedAchievementFilters, setAppliedAchievementFilters] = useState({ search: '', status: defaultAchievementStatus, achievementType: '', sportType: '', sportsProfile: lockedSportsProfileId, achievedFrom: '', achievedTo: '' })
  const [achievementPagination, setAchievementPagination] = useState({ page: 1, pageSize: 10, total: 0, pageCount: 1 })
  const [profileFilterOptions, setProfileFilterOptions] = useState([])
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [selectedSubmissionId, setSelectedSubmissionId] = useState(null)
  const [selectedAchievementId, setSelectedAchievementId] = useState(null)
  const [correctionDraftSubmission, setCorrectionDraftSubmission] = useState(null)

  const submissionPages = useMemo(() => buildPages(submissionPagination.page, submissionPagination.pageCount), [submissionPagination.page, submissionPagination.pageCount])
  const achievementPages = useMemo(() => buildPages(achievementPagination.page, achievementPagination.pageCount), [achievementPagination.page, achievementPagination.pageCount])

  useEffect(() => {
    if (!lockedSportsProfileId) return
    setSubmissionFilters((current) => ({ ...current, status: defaultSubmissionStatus, sportsProfile: lockedSportsProfileId }))
    setAppliedSubmissionFilters((current) => ({ ...current, status: defaultSubmissionStatus, sportsProfile: lockedSportsProfileId }))
    setAchievementFilters((current) => ({ ...current, status: defaultAchievementStatus, sportsProfile: lockedSportsProfileId }))
    setAppliedAchievementFilters((current) => ({ ...current, status: defaultAchievementStatus, sportsProfile: lockedSportsProfileId }))
  }, [lockedSportsProfileId, defaultSubmissionStatus, defaultAchievementStatus])

  useEffect(() => {
    function handleCorrectionCreated(event) {
      const submission = event?.detail?.submission || null
      if (!submission?.id) return
      setSelectedAchievementId(null)
      setCorrectionDraftSubmission(submission)
      refreshAll()
    }
    window.addEventListener('managed-club-achievement-correction-created', handleCorrectionCreated)
    return () => window.removeEventListener('managed-club-achievement-correction-created', handleCorrectionCreated)
  }, [])

  useEffect(() => {
    if (!club?.id) return
    let mounted = true
    async function loadProfileOptions() {
      try {
        const rows = await listManagedClubAchievementProfileOptions(club.id, { pageSize: 100 })
        if (!mounted) return
        setProfileFilterOptions(Array.isArray(rows) ? rows : [])
      } catch {
        if (!mounted) return
        setProfileFilterOptions([])
      }
    }
    loadProfileOptions()
    return () => { mounted = false }
  }, [club?.id])

  async function loadSubmissions() {
    if (!club?.id) return
    setSubmissionLoading(true)
    setSubmissionError('')
    try {
      const result = await listManagedClubAchievementSubmissions(club.id, { page: submissionPagination.page, pageSize: submissionPagination.pageSize, sort: 'updatedAt:desc', ...appliedSubmissionFilters })
      setSubmissionRows(Array.isArray(result?.rows) ? result.rows : [])
      setSubmissionPagination(result?.pagination || { page: 1, pageSize: 10, total: 0, pageCount: 1 })
    } catch (requestError) {
      setSubmissionRows([])
      setSubmissionError(getSportsClubManagementApiMessage(requestError, 'Không tải được đề nghị ghi nhận thành tích.'))
    } finally {
      setSubmissionLoading(false)
    }
  }

  async function loadAchievements() {
    if (!club?.id) return
    setAchievementLoading(true)
    setAchievementError('')
    try {
      const result = await listManagedClubAchievements(club.id, { page: achievementPagination.page, pageSize: achievementPagination.pageSize, sort: 'verifiedAt:desc', ...appliedAchievementFilters })
      setAchievementRows(Array.isArray(result?.rows) ? result.rows : [])
      setAchievementPagination(result?.pagination || { page: 1, pageSize: 10, total: 0, pageCount: 1 })
    } catch (requestError) {
      setAchievementRows([])
      setAchievementError(getSportsClubManagementApiMessage(requestError, 'Không tải được thành tích đã ghi nhận.'))
    } finally {
      setAchievementLoading(false)
    }
  }

  useEffect(() => {
    loadSubmissions()
  }, [club?.id, appliedSubmissionFilters, submissionPagination.page, submissionPagination.pageSize])

  useEffect(() => {
    loadAchievements()
  }, [club?.id, appliedAchievementFilters, achievementPagination.page, achievementPagination.pageSize])

  function refreshAll() {
    loadSubmissions()
    loadAchievements()
  }

  return (
    <div>
      <div className='d-flex justify-content-between align-items-start gap-3 flex-wrap mb-4'>
        <div>
          <div className='fs-5 fw-semibold'>Thành tích</div>
          <div className='text-body-secondary'>Manager chỉ thao tác trên submission và achievement thuộc CLB đang được assignment. Workflow luôn đi qua Submission trước khi thành tích được ghi nhận.</div>
        </div>
        <CButton color='primary' onClick={() => setShowCreateModal(true)}>Ghi nhận thành tích</CButton>
      </div>
      {isMemberScoped ? <div className='small text-body-secondary mb-3'>Đang hiển thị thành tích trong context của member hiện tại: {membership?.memberCode || '-'} · {membership?.sportsProfile?.fullName || membership?.sportsProfile?.code || '-'}.</div> : null}

      <div className='d-flex justify-content-between align-items-center gap-3 flex-wrap mb-3'>
        <CButtonGroup>
          <CButton color={viewKey === 'submissions' ? 'primary' : 'secondary'} variant={viewKey === 'submissions' ? undefined : 'outline'} onClick={() => setViewKey('submissions')}>Đề nghị ghi nhận</CButton>
          <CButton color={viewKey === 'achievements' ? 'primary' : 'secondary'} variant={viewKey === 'achievements' ? undefined : 'outline'} onClick={() => setViewKey('achievements')}>Đã ghi nhận</CButton>
        </CButtonGroup>
      </div>

      {viewKey === 'submissions' ? (
        <>
          <CRow className='g-3 mb-3'>
            <CCol lg={4} md={6}><CFormInput placeholder='Tìm theo profile, title, result, source reference' value={submissionFilters.search} onChange={(event) => setSubmissionFilters((current) => ({ ...current, search: event.target.value }))} /></CCol>
            <CCol lg={2} md={6}><CFormSelect value={submissionFilters.status} onChange={(event) => setSubmissionFilters((current) => ({ ...current, status: event.target.value }))}><option value=''>Tất cả trạng thái</option>{SUBMISSION_STATUS_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</CFormSelect></CCol>
            <CCol lg={2} md={6}><CFormSelect value={submissionFilters.achievementType} onChange={(event) => setSubmissionFilters((current) => ({ ...current, achievementType: event.target.value }))}><option value=''>Tất cả loại</option>{ACHIEVEMENT_TYPE_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</CFormSelect></CCol>
            <CCol lg={2} md={6}><CFormSelect value={submissionFilters.sportType} onChange={(event) => setSubmissionFilters((current) => ({ ...current, sportType: event.target.value }))}><option value=''>Tất cả môn</option>{SPORT_TYPE_OPTIONS.filter((option) => option.value).map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</CFormSelect></CCol>
            {isMemberScoped ? null : <CCol lg={2} md={6}><CFormSelect value={submissionFilters.sportsProfile} onChange={(event) => setSubmissionFilters((current) => ({ ...current, sportsProfile: event.target.value }))}><option value=''>Tất cả profile</option>{profileFilterOptions.map((option) => <option key={option.id} value={option.sportsProfile?.id || ''}>{option.memberCode ? `${option.memberCode} - ${getSportsProfileOptionLabel(option.sportsProfile)}` : getSportsProfileOptionLabel(option.sportsProfile)}</option>)}</CFormSelect></CCol>}
            <CCol lg={3} md={6}><CFormLabel className='small text-body-secondary'>Từ ngày đạt</CFormLabel><CFormInput type='datetime-local' value={submissionFilters.achievedFrom} onChange={(event) => setSubmissionFilters((current) => ({ ...current, achievedFrom: event.target.value }))} /></CCol>
            <CCol lg={3} md={6}><CFormLabel className='small text-body-secondary'>Đến ngày đạt</CFormLabel><CFormInput type='datetime-local' value={submissionFilters.achievedTo} onChange={(event) => setSubmissionFilters((current) => ({ ...current, achievedTo: event.target.value }))} /></CCol>
          </CRow>
          <div className='d-flex gap-2 mb-3'>
            <CButton color='primary' onClick={() => { setSubmissionPagination((current) => ({ ...current, page: 1 })); setAppliedSubmissionFilters({ ...submissionFilters, achievedFrom: fromDateTimeInputValue(submissionFilters.achievedFrom) || '', achievedTo: fromDateTimeInputValue(submissionFilters.achievedTo) || '' }) }}>Lọc</CButton>
            <CButton color='secondary' variant='outline' onClick={() => {
              const next = { search: '', status: defaultSubmissionStatus, achievementType: '', sportType: '', sportsProfile: lockedSportsProfileId, achievedFrom: '', achievedTo: '' }
              setSubmissionFilters(next)
              setAppliedSubmissionFilters(next)
              setSubmissionPagination((current) => ({ ...current, page: 1 }))
            }}>Xóa lọc</CButton>
          </div>

          <div className='small text-body-secondary mb-3'>Tổng cộng {submissionPagination.total} đề nghị</div>
          {submissionError ? <CAlert color='danger'>{submissionError}</CAlert> : null}
          {submissionLoading ? (
            <div className='d-flex align-items-center gap-2'><CSpinner size='sm' />Đang tải đề nghị ghi nhận...</div>
          ) : submissionRows.length === 0 ? (
            <CAlert color='secondary' className='mb-0'>Chưa có đề nghị ghi nhận thành tích.</CAlert>
          ) : (
            <>
              <CTable responsive hover align='middle'>
                <CTableHead>
                  <CTableRow>
                    <CTableHeaderCell>Sports Profile</CTableHeaderCell>
                    <CTableHeaderCell>Tiêu đề</CTableHeaderCell>
                    <CTableHeaderCell>Loại</CTableHeaderCell>
                    <CTableHeaderCell>Kết quả</CTableHeaderCell>
                    <CTableHeaderCell>Achieved At</CTableHeaderCell>
                    <CTableHeaderCell>Nguồn</CTableHeaderCell>
                    <CTableHeaderCell>Submitted At</CTableHeaderCell>
                    <CTableHeaderCell>Trạng thái</CTableHeaderCell>
                    <CTableHeaderCell>Thao tác</CTableHeaderCell>
                  </CTableRow>
                </CTableHead>
                <CTableBody>
                  {submissionRows.map((row) => (
                    <CTableRow key={row.id}>
                      <CTableDataCell><div>{row.sportsProfile?.fullName || '-'}</div><div className='small text-body-secondary'>{row.sportsProfile?.code || '-'}</div><div className='small text-body-secondary'>{row.clubMembership?.memberCode || '-'}</div></CTableDataCell>
                      <CTableDataCell><div className='fw-semibold'>{row.title || '-'}</div><div className='small text-body-secondary'>{getSportTypeLabel(row.sportType)}</div></CTableDataCell>
                      <CTableDataCell>{getAchievementTypeLabel(row.achievementType)}</CTableDataCell>
                      <CTableDataCell><div>{row.resultText || '-'}</div><div className='small text-body-secondary'>{row.resultValue ?? '-'} {row.resultUnit || ''}</div></CTableDataCell>
                      <CTableDataCell>{formatSportsDateTime(row.achievedAt)}</CTableDataCell>
                      <CTableDataCell>{getSubmissionSourceLabel(row.source)}</CTableDataCell>
                      <CTableDataCell>{formatSportsDateTime(row.submittedAt)}</CTableDataCell>
                      <CTableDataCell><div className='d-flex gap-2 flex-wrap'><CBadge color={getSubmissionStatusMeta(row.status).color}>{getSubmissionStatusMeta(row.status).label}</CBadge>{renderMembershipBadge(row.clubMembership)}</div></CTableDataCell>
                      <CTableDataCell><div className='d-flex gap-2 flex-wrap'><CButton size='sm' color='secondary' variant='outline' onClick={() => setSelectedSubmissionId(row.id)}>Chi tiết</CButton>{row.status === 'submitted' ? <CButton size='sm' color='success' onClick={() => setSelectedSubmissionId(row.id)}>Xử lý</CButton> : null}</div></CTableDataCell>
                    </CTableRow>
                  ))}
                </CTableBody>
              </CTable>
              {submissionPagination.pageCount > 1 ? (
                <div className='d-flex justify-content-end'>
                  <CPagination>
                    <CPaginationItem disabled={submissionPagination.page <= 1} onClick={() => setSubmissionPagination((current) => ({ ...current, page: Math.max(1, current.page - 1) }))}>Trước</CPaginationItem>
                    {submissionPages.map((entry, index) => entry === '...'
                      ? <CPaginationItem key={`managed-achievement-submission-ellipsis-${index}`} disabled>...</CPaginationItem>
                      : <CPaginationItem key={`managed-achievement-submission-page-${entry}`} active={submissionPagination.page === entry} onClick={() => setSubmissionPagination((current) => ({ ...current, page: entry }))}>{entry}</CPaginationItem>)}
                    <CPaginationItem disabled={submissionPagination.page >= submissionPagination.pageCount} onClick={() => setSubmissionPagination((current) => ({ ...current, page: Math.min(current.pageCount, current.page + 1) }))}>Sau</CPaginationItem>
                  </CPagination>
                </div>
              ) : null}
            </>
          )}
        </>
      ) : (
        <>
          <CRow className='g-3 mb-3'>
            <CCol lg={4} md={6}><CFormInput placeholder='Tìm theo profile, title, result, source reference' value={achievementFilters.search} onChange={(event) => setAchievementFilters((current) => ({ ...current, search: event.target.value }))} /></CCol>
            <CCol lg={2} md={6}><CFormSelect value={achievementFilters.status} onChange={(event) => setAchievementFilters((current) => ({ ...current, status: event.target.value }))}><option value=''>Tất cả trạng thái</option>{ACHIEVEMENT_STATUS_FILTER_OPTIONS.map((option) => <option key={option.value || 'all'} value={option.value}>{option.label}</option>)}</CFormSelect></CCol>
            <CCol lg={2} md={6}><CFormSelect value={achievementFilters.achievementType} onChange={(event) => setAchievementFilters((current) => ({ ...current, achievementType: event.target.value }))}><option value=''>Tất cả loại</option>{ACHIEVEMENT_TYPE_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</CFormSelect></CCol>
            <CCol lg={2} md={6}><CFormSelect value={achievementFilters.sportType} onChange={(event) => setAchievementFilters((current) => ({ ...current, sportType: event.target.value }))}><option value=''>Tất cả môn</option>{SPORT_TYPE_OPTIONS.filter((option) => option.value).map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</CFormSelect></CCol>
            {isMemberScoped ? null : <CCol lg={2} md={6}><CFormSelect value={achievementFilters.sportsProfile} onChange={(event) => setAchievementFilters((current) => ({ ...current, sportsProfile: event.target.value }))}><option value=''>Tất cả profile</option>{profileFilterOptions.map((option) => <option key={option.id} value={option.sportsProfile?.id || ''}>{option.memberCode ? `${option.memberCode} - ${getSportsProfileOptionLabel(option.sportsProfile)}` : getSportsProfileOptionLabel(option.sportsProfile)}</option>)}</CFormSelect></CCol>}
            <CCol lg={3} md={6}><CFormLabel className='small text-body-secondary'>Từ ngày đạt</CFormLabel><CFormInput type='datetime-local' value={achievementFilters.achievedFrom} onChange={(event) => setAchievementFilters((current) => ({ ...current, achievedFrom: event.target.value }))} /></CCol>
            <CCol lg={3} md={6}><CFormLabel className='small text-body-secondary'>Đến ngày đạt</CFormLabel><CFormInput type='datetime-local' value={achievementFilters.achievedTo} onChange={(event) => setAchievementFilters((current) => ({ ...current, achievedTo: event.target.value }))} /></CCol>
          </CRow>
          <div className='d-flex gap-2 mb-3'>
            <CButton color='primary' onClick={() => { setAchievementPagination((current) => ({ ...current, page: 1 })); setAppliedAchievementFilters({ ...achievementFilters, achievedFrom: fromDateTimeInputValue(achievementFilters.achievedFrom) || '', achievedTo: fromDateTimeInputValue(achievementFilters.achievedTo) || '' }) }}>Lọc</CButton>
            <CButton color='secondary' variant='outline' onClick={() => {
              const next = { search: '', status: defaultAchievementStatus, achievementType: '', sportType: '', sportsProfile: lockedSportsProfileId, achievedFrom: '', achievedTo: '' }
              setAchievementFilters(next)
              setAppliedAchievementFilters(next)
              setAchievementPagination((current) => ({ ...current, page: 1 }))
            }}>Xóa lọc</CButton>
          </div>

          <div className='small text-body-secondary mb-3'>Tổng cộng {achievementPagination.total} thành tích đã ghi nhận</div>
          {achievementError ? <CAlert color='danger'>{achievementError}</CAlert> : null}
          {achievementLoading ? (
            <div className='d-flex align-items-center gap-2'><CSpinner size='sm' />Đang tải thành tích đã ghi nhận...</div>
          ) : achievementRows.length === 0 ? (
            <CAlert color='secondary' className='mb-0'>CLB chưa có thành tích nào được ghi nhận.</CAlert>
          ) : (
            <>
              <CTable responsive hover align='middle'>
                <CTableHead>
                  <CTableRow>
                    <CTableHeaderCell>Sports Profile</CTableHeaderCell>
                    <CTableHeaderCell>Tiêu đề</CTableHeaderCell>
                    <CTableHeaderCell>Loại</CTableHeaderCell>
                    <CTableHeaderCell>Kết quả</CTableHeaderCell>
                    <CTableHeaderCell>Achieved At</CTableHeaderCell>
                    <CTableHeaderCell>Nguồn</CTableHeaderCell>
                    <CTableHeaderCell>Verified</CTableHeaderCell>
                    <CTableHeaderCell>Thao tác</CTableHeaderCell>
                  </CTableRow>
                </CTableHead>
                <CTableBody>
                  {achievementRows.map((row) => (
                    <CTableRow key={row.id}>
                      <CTableDataCell><div>{row.sportsProfile?.fullName || '-'}</div><div className='small text-body-secondary'>{row.sportsProfile?.code || '-'}</div><div className='small text-body-secondary'>{row.clubMembership?.memberCode || '-'}</div></CTableDataCell>
                      <CTableDataCell><div className='fw-semibold'>{row.title || '-'}</div><div className='small text-body-secondary'>{getSportTypeLabel(row.sportType)}</div></CTableDataCell>
                      <CTableDataCell>{getAchievementTypeLabel(row.achievementType)}</CTableDataCell>
                      <CTableDataCell><div>{row.resultText || '-'}</div><div className='small text-body-secondary'>{row.resultValue ?? '-'} {row.resultUnit || ''}</div></CTableDataCell>
                      <CTableDataCell>{formatSportsDateTime(row.achievedAt)}</CTableDataCell>
                      <CTableDataCell>{row.source || '-'}</CTableDataCell>
                      <CTableDataCell><div className='d-flex gap-2 flex-wrap'><CBadge color={getAchievementStatusMeta(row.status).color}>{getAchievementStatusMeta(row.status).label}</CBadge>{renderMembershipBadge(row.clubMembership)}</div><div className='small text-body-secondary mt-1'>{formatSportsDateTime(row.verifiedAt)}</div><div className='small text-body-secondary'>{getUserLabel(row.verifiedBy)}</div></CTableDataCell>
                      <CTableDataCell><CButton size='sm' color='secondary' variant='outline' onClick={() => setSelectedAchievementId(row.id)}>Chi tiết</CButton></CTableDataCell>
                    </CTableRow>
                  ))}
                </CTableBody>
              </CTable>
              {achievementPagination.pageCount > 1 ? (
                <div className='d-flex justify-content-end'>
                  <CPagination>
                    <CPaginationItem disabled={achievementPagination.page <= 1} onClick={() => setAchievementPagination((current) => ({ ...current, page: Math.max(1, current.page - 1) }))}>Trước</CPaginationItem>
                    {achievementPages.map((entry, index) => entry === '...'
                      ? <CPaginationItem key={`managed-achievement-ellipsis-${index}`} disabled>...</CPaginationItem>
                      : <CPaginationItem key={`managed-achievement-page-${entry}`} active={achievementPagination.page === entry} onClick={() => setAchievementPagination((current) => ({ ...current, page: entry }))}>{entry}</CPaginationItem>)}
                    <CPaginationItem disabled={achievementPagination.page >= achievementPagination.pageCount} onClick={() => setAchievementPagination((current) => ({ ...current, page: Math.min(current.pageCount, current.page + 1) }))}>Sau</CPaginationItem>
                  </CPagination>
                </div>
              ) : null}
            </>
          )}
        </>
      )}

      <SubmissionEditorModal visible={showCreateModal} club={club} initialSubmission={membership?.sportsProfile?.id ? { sportsProfile: membership.sportsProfile } : null} defaultProfiles={profileFilterOptions} lockedProfile={membership?.sportsProfile || null} lockedMembership={membership} onClose={() => setShowCreateModal(false)} onSaved={() => { setShowCreateModal(false); refreshAll() }} />
      <SubmissionEditorModal visible={Boolean(correctionDraftSubmission?.id)} club={club} initialSubmission={correctionDraftSubmission} defaultProfiles={profileFilterOptions} lockedProfile={membership?.sportsProfile || null} lockedMembership={membership} onClose={() => setCorrectionDraftSubmission(null)} onSaved={() => { setCorrectionDraftSubmission(null); refreshAll() }} />
      <SubmissionDetailModal visible={Boolean(selectedSubmissionId)} club={club} submissionId={selectedSubmissionId} lockedProfile={membership?.sportsProfile || null} lockedMembership={membership} onClose={() => setSelectedSubmissionId(null)} onChanged={() => { refreshAll() }} />
      <AchievementDetailModal visible={Boolean(selectedAchievementId)} club={club} achievementId={selectedAchievementId} onClose={() => setSelectedAchievementId(null)} />
    </div>
  )
}
