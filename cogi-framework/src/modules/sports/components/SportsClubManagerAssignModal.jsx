import { useEffect, useState } from 'react'
import {
  CAlert,
  CButton,
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
  CRow,
  CSpinner,
} from '@coreui/react'
import { listSportsClubs } from '../services/sportsClubService'
import {
  createSportsClubUserAssignment,
  getSportsClubUserAssignmentApiMessage,
  listAssignableClubManagers,
} from '../services/sportsClubUserAssignmentService'
import { getAssignmentClubLabel, getAssignmentUserLabel } from '../utils/sportsClubUserAssignmentUi'

export default function SportsClubManagerAssignModal({ visible = false, fixedClub = null, onClose, onSaved }) {
  const [submitting, setSubmitting] = useState(false)
  const [loadingOptions, setLoadingOptions] = useState(false)
  const [error, setError] = useState('')
  const [clubOptions, setClubOptions] = useState([])
  const [userOptions, setUserOptions] = useState([])
  const [userSearch, setUserSearch] = useState('')
  const [form, setForm] = useState({ clubId: '', userId: '', note: '' })

  useEffect(() => {
    if (!visible) return
    setForm({ clubId: fixedClub?.id ? String(fixedClub.id) : '', userId: '', note: '' })
    setError('')
  }, [visible, fixedClub])

  useEffect(() => {
    if (!visible) return
    let mounted = true
    async function loadInitial() {
      setLoadingOptions(true)
      try {
        const [usersResult, clubsResult] = await Promise.all([
          listAssignableClubManagers({ page: 1, pageSize: 20, search: userSearch }),
          fixedClub ? Promise.resolve({ rows: [fixedClub] }) : listSportsClubs({ page: 1, pageSize: 500, sort: 'name:asc' }),
        ])
        if (!mounted) return
        setUserOptions(Array.isArray(usersResult?.rows) ? usersResult.rows : [])
        setClubOptions(Array.isArray(clubsResult?.rows) ? clubsResult.rows : [])
      } catch (requestError) {
        if (!mounted) return
        setError(getSportsClubUserAssignmentApiMessage(requestError, 'Không tải được danh sách user/club để phân công.'))
      } finally {
        if (mounted) setLoadingOptions(false)
      }
    }
    loadInitial()
    return () => { mounted = false }
  }, [visible, fixedClub, userSearch])

  async function handleSubmit() {
    if (!form.clubId) {
      setError('Club là bắt buộc')
      return
    }
    if (!form.userId) {
      setError('User là bắt buộc')
      return
    }

    setSubmitting(true)
    setError('')
    try {
      const created = await createSportsClubUserAssignment({
        club: Number(form.clubId),
        user: Number(form.userId),
        note: String(form.note || '').trim() || null,
      })
      onSaved?.(created)
    } catch (requestError) {
      setError(getSportsClubUserAssignmentApiMessage(requestError, 'Không thể phân công người quản lý Club.'))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <CModal visible={visible} onClose={() => !submitting && onClose?.()} size='lg'>
      <CModalHeader>
        <CModalTitle>Thêm người quản lý</CModalTitle>
      </CModalHeader>
      <CModalBody>
        {error ? <CAlert color='danger'>{error}</CAlert> : null}
        <CRow className='g-3'>
          <CCol md={6}>
            <CFormLabel>Club</CFormLabel>
            <CFormSelect value={form.clubId} disabled={Boolean(fixedClub) || loadingOptions || submitting} onChange={(event) => setForm((current) => ({ ...current, clubId: event.target.value }))}>
              <option value=''>Chọn Club</option>
              {clubOptions.map((option) => <option key={option.id} value={option.id}>{getAssignmentClubLabel(option)}</option>)}
            </CFormSelect>
          </CCol>
          <CCol md={6}>
            <CFormLabel>Tìm User</CFormLabel>
            <CFormInput value={userSearch} placeholder='Tìm theo họ tên, username, email, phone' onChange={(event) => setUserSearch(event.target.value)} disabled={loadingOptions || submitting} />
          </CCol>
          <CCol xs={12}>
            <CFormLabel>User</CFormLabel>
            <CFormSelect value={form.userId} disabled={loadingOptions || submitting} onChange={(event) => setForm((current) => ({ ...current, userId: event.target.value }))}>
              <option value=''>Chọn User</option>
              {userOptions.map((item) => <option key={item.user?.id || item.userTenantId} value={item.user?.id || ''}>{getAssignmentUserLabel(item.user)}</option>)}
            </CFormSelect>
            <div className='small text-body-secondary mt-1'>{loadingOptions ? <span className='d-inline-flex align-items-center gap-2'><CSpinner size='sm' />Đang tải user tenant-scoped...</span> : 'Chỉ hiển thị user active trong tenant hiện tại.'}</div>
          </CCol>
          <CCol xs={12}>
            <CFormLabel>Ghi chú</CFormLabel>
            <CFormTextarea rows={3} value={form.note} onChange={(event) => setForm((current) => ({ ...current, note: event.target.value }))} disabled={submitting} />
          </CCol>
        </CRow>
      </CModalBody>
      <CModalFooter>
        <CButton color='secondary' variant='outline' onClick={() => onClose?.()} disabled={submitting}>Hủy</CButton>
        <CButton color='primary' onClick={handleSubmit} disabled={submitting}>{submitting ? 'Đang lưu...' : 'Phân công'}</CButton>
      </CModalFooter>
    </CModal>
  )
}