import { useEffect, useMemo, useState } from 'react'
import { CAlert, CButton, CCol, CFormInput, CFormLabel, CModal, CModalBody, CModalFooter, CModalHeader, CModalTitle, CRow } from '@coreui/react'
import {
  deactivateManagedClubMember,
  getSportsClubManagementApiMessage,
  leaveManagedClubMember,
  reactivateManagedClubMember,
  rejoinManagedClubMember,
} from '../services/sportsClubManagementService'

function getActionTitle(actionType) {
  if (actionType === 'deactivate') return 'Dừng hoạt động'
  if (actionType === 'leave') return 'Rời CLB'
  if (actionType === 'reactivate') return 'Hoạt động lại'
  if (actionType === 'rejoin') return 'Gia nhập lại'
  return 'Cập nhật trạng thái'
}

function getActionSuccessMessage(actionType) {
  if (actionType === 'deactivate') return 'Đã chuyển thành viên sang trạng thái dừng hoạt động.'
  if (actionType === 'leave') return 'Đã ghi nhận thao tác rời CLB.'
  if (actionType === 'reactivate') return 'Đã ghi nhận thao tác hoạt động lại.'
  if (actionType === 'rejoin') return 'Đã ghi nhận thao tác gia nhập lại.'
  return 'Đã cập nhật trạng thái thành viên.'
}

export default function ManagedClubMemberStatusActionModal({ visible = false, clubId = null, membership = null, actionType = '', onClose, onSaved }) {
  const [eventAt, setEventAt] = useState('')
  const [note, setNote] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!visible) return
    setEventAt(new Date().toISOString().slice(0, 10))
    setNote('')
    setError('')
  }, [visible, actionType, membership?.id])

  const title = useMemo(() => getActionTitle(actionType), [actionType])

  async function handleSubmit() {
    if (!clubId || !membership?.id) return
    if (!eventAt) {
      setError('Ngày hiệu lực là bắt buộc')
      return
    }

    setSubmitting(true)
    setError('')
    try {
      let result = null
      const payload = { eventAt, note: note || null }
      if (actionType === 'deactivate') result = await deactivateManagedClubMember(clubId, membership.id, payload)
      if (actionType === 'leave') result = await leaveManagedClubMember(clubId, membership.id, payload)
      if (actionType === 'reactivate') result = await reactivateManagedClubMember(clubId, membership.id, payload)
      if (actionType === 'rejoin') result = await rejoinManagedClubMember(clubId, membership.id, payload)
      onSaved?.(result, getActionSuccessMessage(actionType))
    } catch (requestError) {
      setError(getSportsClubManagementApiMessage(requestError, 'Không thể cập nhật trạng thái thành viên.'))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <CModal visible={visible} onClose={() => !submitting && onClose?.()}>
      <CModalHeader>
        <CModalTitle>{title}</CModalTitle>
      </CModalHeader>
      <CModalBody>
        {error ? <CAlert color='danger'>{error}</CAlert> : null}
        <CRow className='g-3'>
          <CCol xs={12}><CFormLabel>Ngày hiệu lực *</CFormLabel><CFormInput type='date' value={eventAt} onChange={(event) => setEventAt(event.target.value)} disabled={submitting} /></CCol>
          <CCol xs={12}><CFormLabel>Ghi chú</CFormLabel><CFormInput value={note} onChange={(event) => setNote(event.target.value)} disabled={submitting} /></CCol>
        </CRow>
      </CModalBody>
      <CModalFooter>
        <CButton color='secondary' variant='outline' onClick={() => onClose?.()} disabled={submitting}>Hủy</CButton>
        <CButton color='primary' onClick={handleSubmit} disabled={submitting}>{submitting ? 'Đang lưu...' : 'Xác nhận'}</CButton>
      </CModalFooter>
    </CModal>
  )
}