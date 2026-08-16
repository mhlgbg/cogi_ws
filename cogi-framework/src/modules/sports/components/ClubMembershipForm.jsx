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
import { listSportsProfiles } from '../services/sportsProfileService'
import { listSportsClubs } from '../services/sportsClubService'
import {
  buildClubMembershipFormValues,
  buildClubMembershipPayload,
  CLUB_MEMBERSHIP_ROLE_OPTIONS,
  CLUB_MEMBERSHIP_SOURCE_OPTIONS,
  CLUB_MEMBERSHIP_STATUS_OPTIONS,
  getApprovedByLabel,
  getClubOptionLabel,
  getSportsProfileOptionLabel,
  validateClubMembershipForm,
} from '../utils/clubMembershipUi'

export default function ClubMembershipForm({ initialValues, submitting = false, submitError = '', onCancel, onSubmit }) {
  const [form, setForm] = useState(() => buildClubMembershipFormValues(initialValues))
  const [fieldErrors, setFieldErrors] = useState({})
  const [profileOptions, setProfileOptions] = useState([])
  const [clubOptions, setClubOptions] = useState([])
  const [optionsLoading, setOptionsLoading] = useState(false)

  useEffect(() => {
    setForm(buildClubMembershipFormValues(initialValues))
    setFieldErrors({})
  }, [initialValues])

  useEffect(() => {
    let mounted = true
    async function loadOptions() {
      setOptionsLoading(true)
      try {
        const [profiles, clubs] = await Promise.all([
          listSportsProfiles({ page: 1, pageSize: 500, sort: 'fullName:asc' }),
          listSportsClubs({ page: 1, pageSize: 500, sort: 'name:asc' }),
        ])
        if (!mounted) return
        setProfileOptions(Array.isArray(profiles?.rows) ? profiles.rows : [])
        setClubOptions(Array.isArray(clubs?.rows) ? clubs.rows : [])
      } catch {
        if (!mounted) return
        setProfileOptions([])
        setClubOptions([])
      } finally {
        if (mounted) setOptionsLoading(false)
      }
    }
    loadOptions()
    return () => { mounted = false }
  }, [])

  const profileValue = useMemo(() => {
    const currentId = Number(form.sportsProfile?.id || 0)
    return currentId > 0 ? String(currentId) : ''
  }, [form.sportsProfile])

  const clubValue = useMemo(() => {
    const currentId = Number(form.club?.id || 0)
    return currentId > 0 ? String(currentId) : ''
  }, [form.club])

  function updateField(key, value) {
    setForm((current) => ({ ...current, [key]: value }))
    setFieldErrors((current) => {
      if (!current[key]) return current
      const next = { ...current }
      delete next[key]
      return next
    })
  }

  function handleSubmit(event) {
    event.preventDefault()
    const nextErrors = validateClubMembershipForm(form)
    setFieldErrors(nextErrors)
    if (Object.keys(nextErrors).length > 0) return
    onSubmit?.(buildClubMembershipPayload(form))
  }

  return (
    <CForm onSubmit={handleSubmit}>
      {submitError ? <CAlert color='danger'>{submitError}</CAlert> : null}

      <div className='fw-semibold mb-3'>A. Thành viên</div>
      <CRow className='g-3 mb-4'>
        <CCol md={6}><CFormLabel>Sports Profile</CFormLabel><CFormSelect value={profileValue} onChange={(event) => { const selected = profileOptions.find((item) => String(item.id) === event.target.value) || null; updateField('sportsProfile', selected) }} disabled={submitting || optionsLoading} invalid={Boolean(fieldErrors.sportsProfile)}><option value=''>Chọn Sports Profile</option>{profileOptions.map((option) => <option key={option.id} value={option.id}>{getSportsProfileOptionLabel(option)}</option>)}</CFormSelect>{fieldErrors.sportsProfile ? <div className='text-danger small mt-1'>{fieldErrors.sportsProfile}</div> : null}</CCol>
        <CCol md={6}><CFormLabel>Sports Club</CFormLabel><CFormSelect value={clubValue} onChange={(event) => { const selected = clubOptions.find((item) => String(item.id) === event.target.value) || null; updateField('club', selected) }} disabled={submitting || optionsLoading} invalid={Boolean(fieldErrors.club)}><option value=''>Chọn Sports Club</option>{clubOptions.map((option) => <option key={option.id} value={option.id}>{getClubOptionLabel(option)}</option>)}</CFormSelect>{fieldErrors.club ? <div className='text-danger small mt-1'>{fieldErrors.club}</div> : null}</CCol>
        <CCol md={6}><CFormLabel>Member Code</CFormLabel><CFormInput value={form.memberCode} onChange={(event) => updateField('memberCode', event.target.value.toUpperCase())} disabled={submitting} /></CCol>
        <CCol md={6}><CFormLabel>Old Member Code</CFormLabel><CFormInput value={form.oldMemberCode} onChange={(event) => updateField('oldMemberCode', event.target.value.toUpperCase())} disabled={submitting} /></CCol>
      </CRow>

      <div className='fw-semibold mb-3'>B. Quan hệ với Club</div>
      <CRow className='g-3 mb-4'>
        <CCol md={3}><CFormLabel>Trạng thái</CFormLabel><CFormSelect value={form.status} onChange={(event) => updateField('status', event.target.value)} disabled={submitting}>{CLUB_MEMBERSHIP_STATUS_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</CFormSelect></CCol>
        <CCol md={3}><CFormLabel>Vai trò</CFormLabel><CFormSelect value={form.role} onChange={(event) => updateField('role', event.target.value)} disabled={submitting}>{CLUB_MEMBERSHIP_ROLE_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</CFormSelect></CCol>
        <CCol md={6}><CFormLabel>Chức danh hiển thị</CFormLabel><CFormInput value={form.positionTitle} onChange={(event) => updateField('positionTitle', event.target.value)} disabled={submitting} /></CCol>
        <CCol md={6}><CFormLabel>Ngày gia nhập</CFormLabel><CFormInput type='date' value={form.joinedAt} onChange={(event) => updateField('joinedAt', event.target.value)} disabled={submitting} /></CCol>
        <CCol md={6}><CFormLabel>Ngày rời club</CFormLabel><CFormInput type='date' value={form.leftAt} onChange={(event) => updateField('leftAt', event.target.value)} disabled={submitting} /></CCol>
      </CRow>

      <div className='fw-semibold mb-3'>C. Nguồn / quản trị</div>
      <CRow className='g-3 mb-4'>
        <CCol md={4}><CFormLabel>Nguồn</CFormLabel><CFormSelect value={form.source} onChange={(event) => updateField('source', event.target.value)} disabled={submitting}>{CLUB_MEMBERSHIP_SOURCE_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</CFormSelect></CCol>
        <CCol md={8}><CFormLabel>Tham chiếu nguồn</CFormLabel><CFormInput value={form.sourceReference} onChange={(event) => updateField('sourceReference', event.target.value)} disabled={submitting} /></CCol>
        <CCol xs={12}><CFormLabel>Join message</CFormLabel><CFormTextarea rows={3} value={form.joinMessage} onChange={(event) => updateField('joinMessage', event.target.value)} disabled={submitting} /></CCol>
        <CCol xs={12}><CFormLabel>Ghi chú nội bộ</CFormLabel><CFormTextarea rows={3} value={form.note} onChange={(event) => updateField('note', event.target.value)} disabled={submitting} /></CCol>
        <CCol md={6}><CFormLabel>Approved At</CFormLabel><CFormInput value={form.approvedAt || ''} disabled readOnly /></CCol>
        <CCol md={6}><CFormLabel>Approved By</CFormLabel><CFormInput value={getApprovedByLabel(form.approvedBy)} disabled readOnly /></CCol>
      </CRow>

      <div className='small text-body-secondary mb-3'>{optionsLoading ? <span className='d-inline-flex align-items-center gap-2'><CSpinner size='sm' />Đang tải profile và club trong tenant hiện tại...</span> : 'Selector hiện lấy Sports Profile và Sports Club trong tenant hiện tại.'}</div>

      <div className='d-flex justify-content-end gap-2 flex-wrap'>
        <CButton type='button' color='secondary' variant='outline' onClick={onCancel} disabled={submitting}>Hủy</CButton>
        <CButton type='submit' color='primary' disabled={submitting}>{submitting ? 'Đang lưu...' : 'Lưu membership'}</CButton>
      </div>
    </CForm>
  )
}