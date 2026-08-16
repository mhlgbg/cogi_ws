import { useEffect, useState } from 'react'
import { CAlert, CBadge, CButton, CCard, CCardBody, CSpinner, CTable, CTableBody, CTableDataCell, CTableHead, CTableHeaderCell, CTableRow } from '@coreui/react'
import {
  activateSportsClubUserAssignment,
  deactivateSportsClubUserAssignment,
  getSportsClubUserAssignmentApiMessage,
  listSportsClubUserAssignments,
} from '../services/sportsClubUserAssignmentService'
import { formatAssignmentDateTime, getAssignmentStatusMeta, getAssignmentUserLabel } from '../utils/sportsClubUserAssignmentUi'
import SportsClubManagerAssignModal from './SportsClubManagerAssignModal'

export default function SportsClubManagersSection({ club }) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [rows, setRows] = useState([])
  const [showAssignModal, setShowAssignModal] = useState(false)
  const clubId = Number(club?.id || 0)

  async function load() {
    if (!clubId) return
    setLoading(true)
    setError('')
    try {
      const result = await listSportsClubUserAssignments({ page: 1, pageSize: 100, club: clubId, sort: 'assignedAt:desc' })
      setRows(Array.isArray(result?.rows) ? result.rows : [])
    } catch (requestError) {
      setRows([])
      setError(getSportsClubUserAssignmentApiMessage(requestError, 'Không tải được danh sách người quản lý Club.'))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [clubId])

  async function handleToggleStatus(item, nextActive) {
    const confirmed = window.confirm(nextActive ? 'Phân công lại user này cho Club?' : 'Ngừng phân công user này khỏi Club?')
    if (!confirmed) return
    try {
      if (nextActive) {
        await activateSportsClubUserAssignment(item.id)
      } else {
        await deactivateSportsClubUserAssignment(item.id)
      }
      await load()
    } catch (requestError) {
      setError(getSportsClubUserAssignmentApiMessage(requestError, nextActive ? 'Không thể phân công lại user này.' : 'Không thể ngừng phân công user này.'))
    }
  }

  return (
    <CCard className='mb-4 mt-4'>
      <CCardBody>
        <div className='d-flex justify-content-between align-items-start gap-3 flex-wrap mb-3'>
          <div>
            <div className='fw-semibold'>Người quản lý</div>
            <div className='small text-body-secondary'>Danh sách User được phân công quản lý Club này. Permission nghiệp vụ vẫn do hệ thống Role/Permission hiện tại quyết định.</div>
          </div>
          <CButton color='primary' onClick={() => setShowAssignModal(true)}>Thêm người quản lý</CButton>
        </div>
        {error ? <CAlert color='danger'>{error}</CAlert> : null}
        {loading ? (
          <div className='d-flex align-items-center gap-2'><CSpinner size='sm' />Đang tải assignment...</div>
        ) : rows.length === 0 ? (
          <CAlert color='secondary' className='mb-0'>Chưa có user nào được phân công quản lý Club này.</CAlert>
        ) : (
          <CTable responsive hover align='middle'>
            <CTableHead>
              <CTableRow>
                <CTableHeaderCell>User</CTableHeaderCell>
                <CTableHeaderCell>Email</CTableHeaderCell>
                <CTableHeaderCell>Trạng thái</CTableHeaderCell>
                <CTableHeaderCell>Ngày phân công</CTableHeaderCell>
                <CTableHeaderCell>Người phân công</CTableHeaderCell>
                <CTableHeaderCell>Ghi chú</CTableHeaderCell>
                <CTableHeaderCell>Thao tác</CTableHeaderCell>
              </CTableRow>
            </CTableHead>
            <CTableBody>
              {rows.map((item) => {
                const statusMeta = getAssignmentStatusMeta(item.status)
                return (
                  <CTableRow key={item.id}>
                    <CTableDataCell>{getAssignmentUserLabel(item.user)}</CTableDataCell>
                    <CTableDataCell>{item.user?.email || '-'}</CTableDataCell>
                    <CTableDataCell><CBadge color={statusMeta.color}>{statusMeta.label}</CBadge></CTableDataCell>
                    <CTableDataCell>{formatAssignmentDateTime(item.assignedAt)}</CTableDataCell>
                    <CTableDataCell>{getAssignmentUserLabel(item.assignedBy)}</CTableDataCell>
                    <CTableDataCell>{item.note || '-'}</CTableDataCell>
                    <CTableDataCell>
                      {item.status === 'active'
                        ? <CButton size='sm' color='warning' variant='outline' onClick={() => handleToggleStatus(item, false)}>Ngừng phân công</CButton>
                        : <CButton size='sm' color='success' variant='outline' onClick={() => handleToggleStatus(item, true)}>Phân công lại</CButton>}
                    </CTableDataCell>
                  </CTableRow>
                )
              })}
            </CTableBody>
          </CTable>
        )}

        <SportsClubManagerAssignModal visible={showAssignModal} fixedClub={club} onClose={() => setShowAssignModal(false)} onSaved={() => { setShowAssignModal(false); load() }} />
      </CCardBody>
    </CCard>
  )
}