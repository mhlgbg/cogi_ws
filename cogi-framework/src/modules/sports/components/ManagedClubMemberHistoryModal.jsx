import { CButton, CModal, CModalBody, CModalFooter, CModalHeader, CModalTitle } from '@coreui/react'
import ManagedClubMemberHistoryManager from './ManagedClubMemberHistoryManager'

export default function ManagedClubMemberHistoryModal({ visible = false, club = null, membership = null, onClose, onSaved }) {
  return (
    <CModal visible={visible} onClose={onClose} size='xl' scrollable>
      <CModalHeader>
        <CModalTitle>Lịch sử tham gia CLB</CModalTitle>
      </CModalHeader>
      <CModalBody>
        <ManagedClubMemberHistoryManager club={club} membership={membership} onMembershipChange={onSaved} showMembershipSummary title='Timeline' />
      </CModalBody>
      <CModalFooter>
        <CButton color='secondary' variant='outline' onClick={onClose}>Đóng</CButton>
      </CModalFooter>
    </CModal>
  )
}