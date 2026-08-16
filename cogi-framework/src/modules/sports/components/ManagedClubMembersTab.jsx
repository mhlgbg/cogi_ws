import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { CAlert, CBadge, CButton, CCol, CFormInput, CFormSelect, CPagination, CPaginationItem, CRow, CSpinner, CTable, CTableBody, CTableDataCell, CTableHead, CTableHeaderCell, CTableRow } from '@coreui/react'
import { getSportsClubManagementApiMessage, listManagedClubMembers } from '../services/sportsClubManagementService'
import ManagedClubMemberModal from './ManagedClubMemberModal'
import ManagedClubMemberHistoryModal from './ManagedClubMemberHistoryModal'
import ManagedClubMemberStatusActionModal from './ManagedClubMemberStatusActionModal'
import { CLUB_MEMBERSHIP_STATUS_OPTIONS, formatSportsDate, getClubMembershipRoleLabel, getClubMembershipSourceLabel, getClubMembershipStatusMeta } from '../utils/clubMembershipUi'
import { formatSportsBirthDateOrYear } from '../utils/sportsProfileUi'

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

export default function ManagedClubMembersTab({ club }) {
  const navigate = useNavigate()
  const { tenantCode } = useParams()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [rows, setRows] = useState([])
  const [filters, setFilters] = useState({ search: '', status: '' })
  const [appliedFilters, setAppliedFilters] = useState({ search: '', status: '' })
  const [pagination, setPagination] = useState({ page: 1, pageSize: 10, total: 0, pageCount: 1 })
  const [showModal, setShowModal] = useState(false)
  const [editingRow, setEditingRow] = useState(null)
  const [showHistoryModal, setShowHistoryModal] = useState(false)
  const [selectedHistoryRow, setSelectedHistoryRow] = useState(null)
  const [statusAction, setStatusAction] = useState({ visible: false, type: '', row: null })
  const pages = useMemo(() => buildPages(pagination.page, pagination.pageCount), [pagination.page, pagination.pageCount])
  const basePath = tenantCode ? `/t/${encodeURIComponent(tenantCode)}/sports/my-clubs/${club?.id}/members` : `/sports/my-clubs/${club?.id}/members`

  async function load() {
    if (!club?.id) return
    setLoading(true)
    setError('')
    try {
      const result = await listManagedClubMembers(club.id, { page: pagination.page, pageSize: pagination.pageSize, sort: 'updatedAt:desc', ...appliedFilters })
      setRows(Array.isArray(result?.rows) ? result.rows : [])
      setPagination(result?.pagination || { page: 1, pageSize: 10, total: 0, pageCount: 1 })
    } catch (requestError) {
      setRows([])
      setError(getSportsClubManagementApiMessage(requestError, 'Không tải được danh sách thành viên Club.'))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [club?.id, appliedFilters, pagination.page, pagination.pageSize])

  function buildDetailPath(row) {
    return `${basePath}/${row.id}/overview`
  }

  function openActionModal(type, row) {
    setStatusAction({ visible: true, type, row })
  }

  return (
    <div>
      <div className='d-flex justify-content-between align-items-start gap-3 flex-wrap mb-4'>
        <div>
          <div className='fs-5 fw-semibold'>Thành viên</div>
          <div className='text-body-secondary'>Quản lý Club Membership của CLB này. Dữ liệu lõi Sports Profile chỉ hiển thị read-only trong workspace.</div>
        </div>
        <CButton color='primary' onClick={() => { setEditingRow(null); setShowModal(true) }}>Thêm thành viên</CButton>
      </div>

      <CRow className='g-3 mb-3'>
        <CCol lg={8} md={6}><CFormInput placeholder='Tìm theo memberCode, profile code, tên, phone, email' value={filters.search} onChange={(event) => setFilters((current) => ({ ...current, search: event.target.value }))} /></CCol>
        <CCol lg={4} md={6}><CFormSelect value={filters.status} onChange={(event) => setFilters((current) => ({ ...current, status: event.target.value }))}><option value=''>Tất cả trạng thái</option>{CLUB_MEMBERSHIP_STATUS_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</CFormSelect></CCol>
      </CRow>
      <div className='d-flex gap-2 mb-3'>
        <CButton color='primary' onClick={() => { setPagination((current) => ({ ...current, page: 1 })); setAppliedFilters(filters) }}>Lọc</CButton>
        <CButton color='secondary' variant='outline' onClick={() => { const next = { search: '', status: '' }; setFilters(next); setAppliedFilters(next); setPagination((current) => ({ ...current, page: 1 })) }}>Xóa lọc</CButton>
      </div>

      {error ? <CAlert color='danger'>{error}</CAlert> : null}
      {loading ? (
        <div className='d-flex align-items-center gap-2'><CSpinner size='sm' />Đang tải thành viên...</div>
      ) : rows.length === 0 ? (
        <CAlert color='secondary' className='mb-0'>Chưa có thành viên phù hợp trong CLB này.</CAlert>
      ) : (
        <>
          <CTable responsive hover align='middle'>
            <CTableHead>
              <CTableRow>
                <CTableHeaderCell>Avatar</CTableHeaderCell>
                <CTableHeaderCell>Member Code</CTableHeaderCell>
                <CTableHeaderCell>Profile</CTableHeaderCell>
                <CTableHeaderCell>Giới tính</CTableHeaderCell>
                <CTableHeaderCell>Ngày/Năm sinh</CTableHeaderCell>
                <CTableHeaderCell>Liên hệ</CTableHeaderCell>
                <CTableHeaderCell>Vai trò</CTableHeaderCell>
                <CTableHeaderCell>Chức danh</CTableHeaderCell>
                <CTableHeaderCell>Joined At</CTableHeaderCell>
                <CTableHeaderCell>Trạng thái</CTableHeaderCell>
                <CTableHeaderCell>Nguồn</CTableHeaderCell>
                <CTableHeaderCell>Thao tác</CTableHeaderCell>
              </CTableRow>
            </CTableHead>
            <CTableBody>
              {rows.map((row) => {
                const statusMeta = getClubMembershipStatusMeta(row.status)
                return (
                  <CTableRow key={row.id}>
                    <CTableDataCell>{row.sportsProfile?.avatar?.url ? <img src={row.sportsProfile.avatar.url} alt={row.sportsProfile.fullName || row.sportsProfile.code} style={{ width: 36, height: 36, objectFit: 'cover', borderRadius: 10 }} /> : <div className='d-inline-flex align-items-center justify-content-center rounded bg-body-tertiary text-body-secondary' style={{ width: 36, height: 36 }}>N/A</div>}</CTableDataCell>
                    <CTableDataCell><button type='button' className='btn btn-link p-0 fw-semibold text-decoration-none text-start' onClick={() => navigate(buildDetailPath(row))}>{row.memberCode || '-'}</button><div className='small text-body-secondary'>{row.oldMemberCode || '-'}</div></CTableDataCell>
                    <CTableDataCell><button type='button' className='btn btn-link p-0 text-decoration-none text-start' onClick={() => navigate(buildDetailPath(row))}>{row.sportsProfile?.fullName || '-'}</button><div className='small text-body-secondary'>{row.sportsProfile?.code || '-'}</div><div className='small text-body-secondary'>{row.sportsProfile?.displayName || '-'}</div></CTableDataCell>
                    <CTableDataCell>{row.sportsProfile?.gender || '-'}</CTableDataCell>
                    <CTableDataCell>{formatSportsBirthDateOrYear(row.sportsProfile?.dateOfBirth, row.sportsProfile?.birthYear)}</CTableDataCell>
                    <CTableDataCell><div>{row.sportsProfile?.contactPhone || '-'}</div><div className='small text-body-secondary'>{row.sportsProfile?.contactEmail || '-'}</div></CTableDataCell>
                    <CTableDataCell>{getClubMembershipRoleLabel(row.role)}</CTableDataCell>
                    <CTableDataCell>{row.positionTitle || '-'}</CTableDataCell>
                    <CTableDataCell>{formatSportsDate(row.joinedAt)}</CTableDataCell>
                    <CTableDataCell><CBadge color={statusMeta.color}>{statusMeta.label}</CBadge></CTableDataCell>
                    <CTableDataCell>{getClubMembershipSourceLabel(row.source)}</CTableDataCell>
                    <CTableDataCell>
                      <div className='d-flex gap-2 flex-wrap'>
                        <CButton size='sm' color='primary' variant='outline' onClick={() => navigate(buildDetailPath(row))}>Chi tiết</CButton>
                        <CButton size='sm' color='secondary' variant='outline' onClick={() => { setEditingRow(row); setShowModal(true) }}>Sửa</CButton>
                        <CButton size='sm' color='info' variant='outline' onClick={() => { setSelectedHistoryRow(row); setShowHistoryModal(true) }}>Lịch sử</CButton>
                        {row.status === 'active' ? <CButton size='sm' color='warning' variant='outline' onClick={() => openActionModal('deactivate', row)}>Dừng hoạt động</CButton> : null}
                        {row.status === 'inactive' ? <CButton size='sm' color='success' variant='outline' onClick={() => openActionModal('reactivate', row)}>Hoạt động lại</CButton> : null}
                        {row.status === 'left' ? <CButton size='sm' color='success' variant='outline' onClick={() => openActionModal('rejoin', row)}>Gia nhập lại</CButton> : null}
                        {row.status !== 'left' ? <CButton size='sm' color='dark' variant='outline' onClick={() => openActionModal('leave', row)}>Rời CLB</CButton> : null}
                      </div>
                    </CTableDataCell>
                  </CTableRow>
                )
              })}
            </CTableBody>
          </CTable>

          {pagination.pageCount > 1 ? (
            <div className='d-flex justify-content-end'>
              <CPagination>
                <CPaginationItem disabled={pagination.page <= 1} onClick={() => setPagination((current) => ({ ...current, page: Math.max(1, current.page - 1) }))}>Trước</CPaginationItem>
                {pages.map((entry, index) => entry === '...'
                  ? <CPaginationItem key={`managed-members-ellipsis-${index}`} disabled>...</CPaginationItem>
                  : <CPaginationItem key={`managed-members-page-${entry}`} active={pagination.page === entry} onClick={() => setPagination((current) => ({ ...current, page: entry }))}>{entry}</CPaginationItem>)}
                <CPaginationItem disabled={pagination.page >= pagination.pageCount} onClick={() => setPagination((current) => ({ ...current, page: Math.min(current.pageCount, current.page + 1) }))}>Sau</CPaginationItem>
              </CPagination>
            </div>
          ) : null}
        </>
      )}

      <ManagedClubMemberModal visible={showModal} club={club} initialMembership={editingRow} onClose={() => setShowModal(false)} onSaved={() => { setShowModal(false); setEditingRow(null); load() }} />
      <ManagedClubMemberHistoryModal visible={showHistoryModal} club={club} membership={selectedHistoryRow} onClose={() => setShowHistoryModal(false)} onSaved={(nextMembership) => {
        if (nextMembership?.id) {
          setSelectedHistoryRow(nextMembership)
        }
        load()
      }} />
      <ManagedClubMemberStatusActionModal visible={statusAction.visible} clubId={club?.id} membership={statusAction.row} actionType={statusAction.type} onClose={() => setStatusAction({ visible: false, type: '', row: null })} onSaved={() => {
        setStatusAction({ visible: false, type: '', row: null })
        load()
      }} />
    </div>
  )
}