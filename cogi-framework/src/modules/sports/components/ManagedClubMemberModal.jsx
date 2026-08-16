import { useEffect, useState } from 'react'
import { CAlert, CButton, CCol, CFormInput, CFormLabel, CFormSelect, CFormTextarea, CModal, CModalBody, CModalFooter, CModalHeader, CModalTitle, CRow, CSpinner } from '@coreui/react'
import { createManagedClubMember, createManagedClubProfile, getSportsClubManagementApiMessage, listManagedClubProfileOptions, updateManagedClubMember } from '../services/sportsClubManagementService'
import { CLUB_MEMBERSHIP_ROLE_OPTIONS, CLUB_MEMBERSHIP_SOURCE_OPTIONS, CLUB_MEMBERSHIP_STATUS_OPTIONS, getApprovedByLabel, getSportsProfileOptionLabel } from '../utils/clubMembershipUi'
import { GENDER_OPTIONS } from '../utils/sportsProfileUi'

function buildInitialForm(initialMembership = null) {
  return {
    sportsProfile: initialMembership?.sportsProfile || null,
    memberCode: String(initialMembership?.memberCode || '').trim(),
    oldMemberCode: String(initialMembership?.oldMemberCode || '').trim(),
    status: String(initialMembership?.status || 'active').trim() || 'active',
    role: String(initialMembership?.role || 'member').trim() || 'member',
    positionTitle: String(initialMembership?.positionTitle || '').trim(),
    joinedAt: initialMembership?.joinedAt || '',
    leftAt: initialMembership?.leftAt || '',
    source: String(initialMembership?.source || 'admin_created').trim() || 'admin_created',
    sourceReference: String(initialMembership?.sourceReference || '').trim(),
    joinMessage: String(initialMembership?.joinMessage || '').trim(),
    note: String(initialMembership?.note || '').trim(),
  }
}

function buildInitialQuickProfileForm() {
  return {
    code: '',
    fullName: '',
    displayName: '',
    gender: 'unspecified',
    dateOfBirth: '',
    birthYear: '',
    contactPhone: '',
    contactEmail: '',
    hometown: '',
  }
}

export default function ManagedClubMemberModal({ visible = false, club = null, initialMembership = null, onClose, onSaved }) {
  const [submitting, setSubmitting] = useState(false)
  const [creatingProfile, setCreatingProfile] = useState(false)
  const [loadingProfiles, setLoadingProfiles] = useState(false)
  const [error, setError] = useState('')
  const [profileSearch, setProfileSearch] = useState('')
  const [profileOptions, setProfileOptions] = useState([])
  const [form, setForm] = useState(buildInitialForm(initialMembership))
  const [mode, setMode] = useState('existing')
  const [quickProfileForm, setQuickProfileForm] = useState(buildInitialQuickProfileForm())
  const isEdit = Boolean(initialMembership?.id)
  const profileLookupSearch = mode === 'create'
    ? (String(quickProfileForm.contactPhone || '').trim()
      || String(quickProfileForm.contactEmail || '').trim()
      || String(quickProfileForm.fullName || '').trim())
    : profileSearch

  useEffect(() => {
    if (!visible) return
    setForm(buildInitialForm(initialMembership))
    setProfileSearch('')
    setError('')
    setMode('existing')
    setQuickProfileForm(buildInitialQuickProfileForm())
  }, [visible, initialMembership])

  useEffect(() => {
    if (!quickProfileForm.dateOfBirth) return
    const derivedYear = String(quickProfileForm.dateOfBirth).slice(0, 4)
    if (derivedYear && quickProfileForm.birthYear !== derivedYear) {
      setQuickProfileForm((current) => ({ ...current, birthYear: derivedYear }))
    }
  }, [quickProfileForm.dateOfBirth, quickProfileForm.birthYear])

  useEffect(() => {
    if (!visible || !club?.id || isEdit) return
    let mounted = true
    async function loadProfiles() {
      setLoadingProfiles(true)
      try {
        const result = await listManagedClubProfileOptions(club.id, { page: 1, pageSize: 20, search: profileLookupSearch })
        if (!mounted) return
        setProfileOptions(Array.isArray(result?.rows) ? result.rows : [])
      } catch (requestError) {
        if (!mounted) return
        setProfileOptions([])
        setError(getSportsClubManagementApiMessage(requestError, 'Không tải được danh sách Sports Profile.'))
      } finally {
        if (mounted) setLoadingProfiles(false)
      }
    }
    loadProfiles()
    return () => { mounted = false }
  }, [visible, club?.id, isEdit, profileLookupSearch])

  async function handleSubmit() {
    if (!form.sportsProfile?.id) {
      setError('Sports Profile là bắt buộc')
      return
    }
    setSubmitting(true)
    setError('')
    try {
      const payload = {
        sportsProfile: form.sportsProfile.id,
        memberCode: form.memberCode || null,
        oldMemberCode: form.oldMemberCode || null,
        status: form.status || 'active',
        role: form.role || 'member',
        positionTitle: form.positionTitle || null,
        joinedAt: form.joinedAt || null,
        leftAt: form.leftAt || null,
        source: form.source || null,
        sourceReference: form.sourceReference || null,
        joinMessage: form.joinMessage || null,
        note: form.note || null,
      }
      const result = isEdit
        ? await updateManagedClubMember(club.id, initialMembership.id, payload)
        : await createManagedClubMember(club.id, payload)
      onSaved?.(result)
    } catch (requestError) {
      setError(getSportsClubManagementApiMessage(requestError, isEdit ? 'Không thể cập nhật thành viên CLB.' : 'Không thể thêm thành viên CLB.'))
    } finally {
      setSubmitting(false)
    }
  }

  async function handleCreateProfile() {
    if (!String(quickProfileForm.code || '').trim()) {
      setError('Mã hồ sơ thể thao là bắt buộc khi tạo nhanh hồ sơ mới')
      return
    }
    if (!String(quickProfileForm.fullName || '').trim()) {
      setError('Họ tên là bắt buộc')
      return
    }
    if (quickProfileForm.birthYear) {
      const parsed = Number(quickProfileForm.birthYear)
      if (!Number.isInteger(parsed) || parsed < 1900 || parsed > 2100) {
        setError('Năm sinh phải là số nguyên từ 1900 đến 2100')
        return
      }
    }

    setCreatingProfile(true)
    setError('')
    try {
      const createdProfile = await createManagedClubProfile(club.id, {
        code: String(quickProfileForm.code || '').trim().toUpperCase(),
        fullName: String(quickProfileForm.fullName || '').trim(),
        displayName: String(quickProfileForm.displayName || '').trim() || null,
        gender: quickProfileForm.gender || 'unspecified',
        dateOfBirth: quickProfileForm.dateOfBirth || null,
        birthYear: quickProfileForm.birthYear ? Number(quickProfileForm.birthYear) : null,
        contactPhone: String(quickProfileForm.contactPhone || '').trim() || null,
        contactEmail: String(quickProfileForm.contactEmail || '').trim().toLowerCase() || null,
        hometown: String(quickProfileForm.hometown || '').trim() || null,
      })
      setForm((current) => ({ ...current, sportsProfile: createdProfile }))
      setMode('existing')
      setProfileSearch(createdProfile ? getSportsProfileOptionLabel(createdProfile) : '')
      setError('')
    } catch (requestError) {
      setError(getSportsClubManagementApiMessage(requestError, 'Không thể tạo nhanh Sports Profile.'))
    } finally {
      setCreatingProfile(false)
    }
  }

  const duplicateCandidates = !isEdit
    ? profileOptions.filter((item) => {
        const fullName = String(quickProfileForm.fullName || '').trim().toLowerCase()
        const phone = String(quickProfileForm.contactPhone || '').trim().toLowerCase()
        const email = String(quickProfileForm.contactEmail || '').trim().toLowerCase()
        if (!fullName && !phone && !email) return false
        return (fullName && String(item.fullName || '').trim().toLowerCase().includes(fullName))
          || (phone && String(item.contactPhone || '').trim().toLowerCase().includes(phone))
          || (email && String(item.contactEmail || '').trim().toLowerCase().includes(email))
      }).slice(0, 5)
    : []

  return (
    <CModal visible={visible} onClose={() => !submitting && onClose?.()} size='xl' scrollable>
      <CModalHeader>
        <CModalTitle>{isEdit ? 'Cập nhật thành viên' : 'Thêm thành viên'}</CModalTitle>
      </CModalHeader>
      <CModalBody>
        {error ? <CAlert color='danger'>{error}</CAlert> : null}
        <CRow className='g-3'>
          <CCol xs={12}>
            {isEdit ? (
              <>
                <CFormLabel>Sports Profile</CFormLabel>
                <CFormInput value={getSportsProfileOptionLabel(form.sportsProfile)} disabled readOnly />
              </>
            ) : (
              <>
                <div className='d-flex gap-2 flex-wrap mb-3'>
                  <CButton color={mode === 'existing' ? 'primary' : 'secondary'} variant={mode === 'existing' ? undefined : 'outline'} onClick={() => setMode('existing')} disabled={submitting || creatingProfile}>Chọn hồ sơ đã có</CButton>
                  <CButton color={mode === 'create' ? 'primary' : 'secondary'} variant={mode === 'create' ? undefined : 'outline'} onClick={() => setMode('create')} disabled={submitting || creatingProfile}>Tạo hồ sơ mới</CButton>
                </div>
                {mode === 'existing' ? (
                  <>
                    <CFormLabel>Sports Profile</CFormLabel>
                    <CFormInput value={profileSearch} placeholder='Tìm theo code, tên, phone, email' onChange={(event) => setProfileSearch(event.target.value)} disabled={loadingProfiles || submitting || creatingProfile} className='mb-2' />
                    <CFormSelect value={form.sportsProfile?.id ? String(form.sportsProfile.id) : ''} onChange={(event) => { const selected = profileOptions.find((item) => String(item.id) === event.target.value) || null; setForm((current) => ({ ...current, sportsProfile: selected })) }} disabled={loadingProfiles || submitting || creatingProfile}>
                      <option value=''>Chọn Sports Profile</option>
                      {profileOptions.map((option) => <option key={option.id} value={option.id}>{getSportsProfileOptionLabel(option)}</option>)}
                    </CFormSelect>
                    <div className='small text-body-secondary mt-1'>{loadingProfiles ? <span className='d-inline-flex align-items-center gap-2'><CSpinner size='sm' />Đang tải profile trong tenant...</span> : 'Danh sách profile được scope theo tenant và theo Club workspace hiện tại.'}</div>
                    <div className='mt-2'>
                      <CButton color='secondary' size='sm' variant='outline' onClick={() => setMode('create')} disabled={submitting || creatingProfile}>Tạo hồ sơ thể thao mới</CButton>
                    </div>
                  </>
                ) : (
                  <>
                    <div className='fw-semibold mb-2'>Tạo nhanh Sports Profile</div>
                    <CRow className='g-3'>
                      <CCol md={4}><CFormLabel>Mã hồ sơ</CFormLabel><CFormInput value={quickProfileForm.code} onChange={(event) => setQuickProfileForm((current) => ({ ...current, code: event.target.value.toUpperCase() }))} disabled={creatingProfile || submitting} /></CCol>
                      <CCol md={4}><CFormLabel>Họ và tên</CFormLabel><CFormInput value={quickProfileForm.fullName} onChange={(event) => setQuickProfileForm((current) => ({ ...current, fullName: event.target.value }))} disabled={creatingProfile || submitting} /></CCol>
                      <CCol md={4}><CFormLabel>Tên hiển thị</CFormLabel><CFormInput value={quickProfileForm.displayName} onChange={(event) => setQuickProfileForm((current) => ({ ...current, displayName: event.target.value }))} disabled={creatingProfile || submitting} /></CCol>
                      <CCol md={3}><CFormLabel>Giới tính</CFormLabel><CFormSelect value={quickProfileForm.gender} onChange={(event) => setQuickProfileForm((current) => ({ ...current, gender: event.target.value }))} disabled={creatingProfile || submitting}>{GENDER_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</CFormSelect></CCol>
                      <CCol md={3}><CFormLabel>Ngày sinh</CFormLabel><CFormInput type='date' value={quickProfileForm.dateOfBirth} onChange={(event) => setQuickProfileForm((current) => ({ ...current, dateOfBirth: event.target.value }))} disabled={creatingProfile || submitting} /></CCol>
                      <CCol md={3}><CFormLabel>Năm sinh</CFormLabel><CFormInput type='number' min='1900' max='2100' value={quickProfileForm.birthYear} onChange={(event) => setQuickProfileForm((current) => ({ ...current, birthYear: event.target.value }))} disabled={Boolean(quickProfileForm.dateOfBirth) || creatingProfile || submitting} /></CCol>
                      <CCol md={3}><CFormLabel>Số điện thoại</CFormLabel><CFormInput value={quickProfileForm.contactPhone} onChange={(event) => setQuickProfileForm((current) => ({ ...current, contactPhone: event.target.value }))} disabled={creatingProfile || submitting} /></CCol>
                      <CCol md={6}><CFormLabel>Email liên hệ</CFormLabel><CFormInput value={quickProfileForm.contactEmail} onChange={(event) => setQuickProfileForm((current) => ({ ...current, contactEmail: event.target.value }))} disabled={creatingProfile || submitting} /></CCol>
                      <CCol md={6}><CFormLabel>Quê quán</CFormLabel><CFormInput value={quickProfileForm.hometown} onChange={(event) => setQuickProfileForm((current) => ({ ...current, hometown: event.target.value }))} disabled={creatingProfile || submitting} /></CCol>
                    </CRow>
                    {duplicateCandidates.length > 0 ? (
                      <div className='mt-3 border rounded p-3 bg-body-tertiary'>
                        <div className='fw-semibold mb-2'>Có thể đã tồn tại hồ sơ tương tự</div>
                        <div className='d-flex flex-column gap-2'>
                          {duplicateCandidates.map((item) => (
                            <div key={item.id} className='d-flex justify-content-between align-items-center gap-3 flex-wrap'>
                              <div>{getSportsProfileOptionLabel(item)}</div>
                              <CButton size='sm' color='secondary' variant='outline' onClick={() => { setForm((current) => ({ ...current, sportsProfile: item })); setMode('existing') }} disabled={creatingProfile || submitting}>Dùng hồ sơ này</CButton>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : null}
                    <div className='mt-3 d-flex gap-2'>
                      <CButton color='primary' variant='outline' onClick={handleCreateProfile} disabled={creatingProfile || submitting}>{creatingProfile ? 'Đang tạo hồ sơ...' : 'Tạo hồ sơ thể thao mới'}</CButton>
                    </div>
                  </>
                )}
              </>
            )}
          </CCol>
          <CCol md={3}><CFormLabel>Member Code</CFormLabel><CFormInput value={form.memberCode} onChange={(event) => setForm((current) => ({ ...current, memberCode: event.target.value.toUpperCase() }))} disabled={submitting} /></CCol>
          <CCol md={3}><CFormLabel>Old Member Code</CFormLabel><CFormInput value={form.oldMemberCode} onChange={(event) => setForm((current) => ({ ...current, oldMemberCode: event.target.value.toUpperCase() }))} disabled={submitting} /></CCol>
          <CCol md={3}><CFormLabel>Trạng thái</CFormLabel><CFormInput value={isEdit ? (initialMembership?.status || '-') : 'active'} disabled readOnly /></CCol>
          <CCol md={3}><CFormLabel>Vai trò</CFormLabel><CFormSelect value={form.role} onChange={(event) => setForm((current) => ({ ...current, role: event.target.value }))} disabled={submitting}>{CLUB_MEMBERSHIP_ROLE_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</CFormSelect></CCol>
          <CCol md={6}><CFormLabel>Chức danh</CFormLabel><CFormInput value={form.positionTitle} onChange={(event) => setForm((current) => ({ ...current, positionTitle: event.target.value }))} disabled={submitting} /></CCol>
          <CCol md={4}><CFormLabel>Ngày gia nhập</CFormLabel><CFormInput type='date' value={form.joinedAt} onChange={(event) => setForm((current) => ({ ...current, joinedAt: event.target.value }))} disabled={submitting || isEdit} readOnly={isEdit} /></CCol>
          <CCol md={4}><CFormLabel>Nguồn</CFormLabel><CFormSelect value={form.source} onChange={(event) => setForm((current) => ({ ...current, source: event.target.value }))} disabled={submitting}>{CLUB_MEMBERSHIP_SOURCE_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</CFormSelect></CCol>
          <CCol md={4}><CFormLabel>Source Reference</CFormLabel><CFormInput value={form.sourceReference} onChange={(event) => setForm((current) => ({ ...current, sourceReference: event.target.value }))} disabled={submitting} /></CCol>
          <CCol xs={12}><CFormLabel>Ghi chú</CFormLabel><CFormTextarea rows={3} value={form.note} onChange={(event) => setForm((current) => ({ ...current, note: event.target.value }))} disabled={submitting} /></CCol>
          {isEdit ? (
            <>
              <CCol md={6}><CFormLabel>Ngày rời CLB</CFormLabel><CFormInput value={initialMembership?.leftAt || ''} readOnly disabled /></CCol>
              <CCol md={6}><CFormLabel>Approved At</CFormLabel><CFormInput value={initialMembership?.approvedAt || ''} readOnly disabled /></CCol>
              <CCol md={6}><CFormLabel>Approved By</CFormLabel><CFormInput value={getApprovedByLabel(initialMembership?.approvedBy)} readOnly disabled /></CCol>
            </>
          ) : null}
        </CRow>
      </CModalBody>
      <CModalFooter>
        <CButton color='secondary' variant='outline' onClick={() => onClose?.()} disabled={submitting}>Hủy</CButton>
        <CButton color='primary' onClick={handleSubmit} disabled={submitting}>{submitting ? 'Đang lưu...' : (isEdit ? 'Lưu thay đổi' : 'Thêm thành viên')}</CButton>
      </CModalFooter>
    </CModal>
  )
}