import { useEffect, useMemo, useState } from 'react'
import { CAlert, CBadge, CButton, CCol, CFormInput, CFormSelect, CPagination, CPaginationItem, CRow, CSpinner, CTable, CTableBody, CTableDataCell, CTableHead, CTableHeaderCell, CTableRow } from '@coreui/react'
import { listSportsClubs } from '../services/sportsClubService'
import { activateSportsClubUserAssignment, deactivateSportsClubUserAssignment, getSportsClubUserAssignmentApiMessage, listSportsClubUserAssignments } from '../services/sportsClubUserAssignmentService'
import SportsClubManagerAssignModal from '../components/SportsClubManagerAssignModal'
import { ASSIGNMENT_STATUS_OPTIONS, formatAssignmentDateTime, getAssignmentClubLabel, getAssignmentStatusMeta, getAssignmentUserLabel } from '../utils/sportsClubUserAssignmentUi'

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

export default function SportsClubUserAssignmentsPage() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [rows, setRows] = useState([])
  const [clubOptions, setClubOptions] = useState([])
  const [filters, setFilters] = useState({ search: '', club: '', status: '' })
  const [appliedFilters, setAppliedFilters] = useState({ search: '', club: '', status: '' })
  const [pagination, setPagination] = useState({ page: 1, pageSize: 10, total: 0, pageCount: 1 })
  const [showAssignModal, setShowAssignModal] = useState(false)
  const pages = useMemo(() => buildPages(pagination.page, pagination.pageCount), [pagination.page, pagination.pageCount])

  useEffect(() => {
    let mounted = true
    async function loadClubs() {
      try {
        const result = await listSportsClubs({ page: 1, pageSize: 500, sort: 'name:asc' })
        if (!mounted) return
        setClubOptions(Array.isArray(result?.rows) ? result.rows : [])
      } catch {
        if (!mounted) return
        setClubOptions([])
      }
    }
    loadClubs()
    return () => { mounted = false }
  }, [])

  async function load() {
    setLoading(true)
    setError('')
    try {
      const result = await listSportsClubUserAssignments({ page: pagination.page, pageSize: pagination.pageSize, sort: 'assignedAt:desc', ...appliedFilters })
      setRows(Array.isArray(result?.rows) ? result.rows : [])
      setPagination(result?.pagination || { page: 1, pageSize: 10, total: 0, pageCount: 1 })
    } catch (requestError) {
      setRows([])
      setError(getSportsClubUserAssignmentApiMessage(requestError, 'Không tải được danh sách phân công quản lý Club.'))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [appliedFilters, pagination.page, pagination.pageSize])

  async function handleToggle(item, nextActive) {
    try {
      if (nextActive) await activateSportsClubUserAssignment(item.id)
      else await deactivateSportsClubUserAssignment(item.id)
      await load()
    } catch (requestError) {
      setError(getSportsClubUserAssignmentApiMessage(requestError, nextActive ? 'Không thể kích hoạt lại assignment.' : 'Không thể ngừng assignment.'))
    }
  }

  return (
    <div>
      <div className='d-flex justify-content-between align-items-start gap-3 flex-wrap mb-4'>
        <div>
          <div className='fs-5 fw-semibold'>Phân công quản lý CLB</div>
          <div className='text-body-secondary'>Quản lý dữ liệu User nào được phân công quản lý Club nào trong tenant hiện tại.</div>
        </div>
        <CButton color='primary' onClick={() => setShowAssignModal(true)}>Tạo assignment</CButton>
      </div>

      <CRow className='g-3 mb-3'>
        <CCol lg={5} md={6}><CFormInput placeholder='Tìm theo user, email, club hoặc ghi chú' value={filters.search} onChange={(event) => setFilters((current) => ({ ...current, search: event.target.value }))} /></CCol>
        <CCol lg={4} md={6}><CFormSelect value={filters.club} onChange={(event) => setFilters((current) => ({ ...current, club: event.target.value }))}><option value=''>Tất cả Club</option>{clubOptions.map((option) => <option key={option.id} value={option.id}>{getAssignmentClubLabel(option)}</option>)}</CFormSelect></CCol>
        <CCol lg={3} md={6}><CFormSelect value={filters.status} onChange={(event) => setFilters((current) => ({ ...current, status: event.target.value }))}><option value=''>Tất cả trạng thái</option>{ASSIGNMENT_STATUS_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</CFormSelect></CCol>
      </CRow>

      <div className='d-flex gap-2 mb-3'>
        <CButton color='primary' onClick={() => { setPagination((current) => ({ ...current, page: 1 })); setAppliedFilters(filters) }}>Lọc</CButton>
        <CButton color='secondary' variant='outline' onClick={() => { const next = { search: '', club: '', status: '' }; setFilters(next); setAppliedFilters(next); setPagination((current) => ({ ...current, page: 1 })) }}>Xóa lọc</CButton>
      </div>

      {error ? <CAlert color='danger'>{error}</CAlert> : null}
      {loading ? (
        <div className='d-flex align-items-center gap-2'><CSpinner size='sm' />Đang tải assignment...</div>
      ) : rows.length === 0 ? (
        <CAlert color='secondary' className='mb-0'>Chưa có assignment phù hợp.</CAlert>
      ) : (
        <>
          <CTable responsive hover align='middle'>
            <CTableHead>
              <CTableRow>
                <CTableHeaderCell>User</CTableHeaderCell>
                <CTableHeaderCell>Club</CTableHeaderCell>
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
                    <CTableDataCell>{getAssignmentClubLabel(item.club)}</CTableDataCell>
                    <CTableDataCell><CBadge color={statusMeta.color}>{statusMeta.label}</CBadge></CTableDataCell>
                    <CTableDataCell>{formatAssignmentDateTime(item.assignedAt)}</CTableDataCell>
                    <CTableDataCell>{getAssignmentUserLabel(item.assignedBy)}</CTableDataCell>
                    <CTableDataCell>{item.note || '-'}</CTableDataCell>
                    <CTableDataCell>
                      {item.status === 'active'
                        ? <CButton size='sm' color='warning' variant='outline' onClick={() => handleToggle(item, false)}>Deactivate</CButton>
                        : <CButton size='sm' color='success' variant='outline' onClick={() => handleToggle(item, true)}>Activate</CButton>}
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
                  ? <CPaginationItem key={`club-assignment-ellipsis-${index}`} disabled>...</CPaginationItem>
                  : <CPaginationItem key={`club-assignment-page-${entry}`} active={pagination.page === entry} onClick={() => setPagination((current) => ({ ...current, page: entry }))}>{entry}</CPaginationItem>)}
                <CPaginationItem disabled={pagination.page >= pagination.pageCount} onClick={() => setPagination((current) => ({ ...current, page: Math.min(current.pageCount, current.page + 1) }))}>Sau</CPaginationItem>
              </CPagination>
            </div>
          ) : null}
        </>
      )}

      <SportsClubManagerAssignModal visible={showAssignModal} onClose={() => setShowAssignModal(false)} onSaved={() => { setShowAssignModal(false); load() }} />
    </div>
  )
}