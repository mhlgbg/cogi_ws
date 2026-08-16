import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  CAlert,
  CBadge,
  CButton,
  CCol,
  CFormInput,
  CFormSelect,
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
import { listSportsClubs } from '../services/sportsClubService'
import { listClubMemberships } from '../services/clubMembershipService'
import {
  CLUB_MEMBERSHIP_ROLE_OPTIONS,
  CLUB_MEMBERSHIP_STATUS_OPTIONS,
  formatSportsDate,
  getClubMembershipRoleLabel,
  getClubMembershipSourceLabel,
  getClubMembershipStatusMeta,
  getClubOptionLabel,
} from '../utils/clubMembershipUi'

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

export default function ClubMembershipsPage() {
  const navigate = useNavigate()
  const { tenantCode } = useParams()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [rows, setRows] = useState([])
  const [clubOptions, setClubOptions] = useState([])
  const [filters, setFilters] = useState({ search: '', club: '', status: '', role: '' })
  const [appliedFilters, setAppliedFilters] = useState({ search: '', club: '', status: '', role: '' })
  const [pagination, setPagination] = useState({ page: 1, pageSize: 10, total: 0, pageCount: 1 })
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

  useEffect(() => {
    let mounted = true
    async function load() {
      setLoading(true)
      setError('')
      try {
        const result = await listClubMemberships({ page: pagination.page, pageSize: pagination.pageSize, sort: 'updatedAt:desc', ...appliedFilters })
        if (!mounted) return
        setRows(Array.isArray(result?.rows) ? result.rows : [])
        setPagination(result?.pagination || { page: 1, pageSize: 10, total: 0, pageCount: 1 })
      } catch (requestError) {
        if (!mounted) return
        setRows([])
        setError(requestError?.response?.data?.error?.message || requestError?.message || 'Không tải được danh sách membership.')
      } finally {
        if (mounted) setLoading(false)
      }
    }
    load()
    return () => { mounted = false }
  }, [appliedFilters, pagination.page, pagination.pageSize])

  const basePath = tenantCode ? `/t/${encodeURIComponent(tenantCode)}/sports/memberships` : '/sports/memberships'

  function resetFilters() {
    const next = { search: '', club: '', status: '', role: '' }
    setFilters(next)
    setAppliedFilters(next)
    setPagination((current) => ({ ...current, page: 1 }))
  }

  return (
    <div>
      <div className='d-flex justify-content-between align-items-start gap-3 flex-wrap mb-4'>
        <div>
          <div className='fs-5 fw-semibold'>Club Memberships</div>
          <div className='text-body-secondary'>Quản lý quan hệ hiện tại giữa Sports Profile và Sports Club trong tenant hiện tại.</div>
        </div>
        <CButton color='primary' onClick={() => navigate(`${basePath}/new`)}>Tạo membership</CButton>
      </div>

      <CRow className='g-3 mb-3'>
        <CCol lg={4} md={6}><CFormInput placeholder='Tìm theo memberCode, profile, club, phone, email' value={filters.search} onChange={(event) => setFilters((current) => ({ ...current, search: event.target.value }))} /></CCol>
        <CCol lg={3} md={6}><CFormSelect value={filters.club} onChange={(event) => setFilters((current) => ({ ...current, club: event.target.value }))}><option value=''>Tất cả club</option>{clubOptions.map((option) => <option key={option.id} value={option.id}>{getClubOptionLabel(option)}</option>)}</CFormSelect></CCol>
        <CCol lg={2} md={6}><CFormSelect value={filters.status} onChange={(event) => setFilters((current) => ({ ...current, status: event.target.value }))}><option value=''>Tất cả trạng thái</option>{CLUB_MEMBERSHIP_STATUS_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</CFormSelect></CCol>
        <CCol lg={2} md={6}><CFormSelect value={filters.role} onChange={(event) => setFilters((current) => ({ ...current, role: event.target.value }))}><option value=''>Tất cả vai trò</option>{CLUB_MEMBERSHIP_ROLE_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</CFormSelect></CCol>
        <CCol lg={1} md={12} className='d-flex gap-2'>
          <CButton color='primary' className='flex-grow-1' onClick={() => { setPagination((current) => ({ ...current, page: 1 })); setAppliedFilters(filters) }}>Lọc</CButton>
        </CCol>
      </CRow>
      <div className='mb-3'><CButton color='secondary' variant='outline' size='sm' onClick={resetFilters}>Xóa lọc</CButton></div>

      <div className='small text-body-secondary mb-3'>Tổng cộng {pagination.total} membership</div>
      {error ? <CAlert color='danger'>{error}</CAlert> : null}

      {loading ? (
        <div className='d-flex align-items-center gap-2'><CSpinner size='sm' />Đang tải membership...</div>
      ) : rows.length === 0 ? (
        <CAlert color='secondary' className='mb-0'>Chưa có membership phù hợp.</CAlert>
      ) : (
        <>
          <CTable responsive hover align='middle'>
            <CTableHead>
              <CTableRow>
                <CTableHeaderCell>Member Code</CTableHeaderCell>
                <CTableHeaderCell>Sports Profile</CTableHeaderCell>
                <CTableHeaderCell>Club</CTableHeaderCell>
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
                    <CTableDataCell><div className='fw-semibold'>{row.memberCode || '-'}</div><div className='small text-body-secondary'>{row.oldMemberCode || '-'}</div></CTableDataCell>
                    <CTableDataCell><div className='d-flex align-items-center gap-2'><div>{row.sportsProfile?.avatar?.url ? <img src={row.sportsProfile.avatar.url} alt={row.sportsProfile.fullName || row.sportsProfile.code} style={{ width: 36, height: 36, objectFit: 'cover', borderRadius: 10 }} /> : <div className='d-inline-flex align-items-center justify-content-center rounded bg-body-tertiary text-body-secondary' style={{ width: 36, height: 36 }}>N/A</div>}</div><div><div>{row.sportsProfile?.fullName || '-'}</div><div className='small text-body-secondary'>{row.sportsProfile?.code || '-'}</div></div></div></CTableDataCell>
                    <CTableDataCell><div className='d-flex align-items-center gap-2'><div>{row.club?.logo?.url ? <img src={row.club.logo.url} alt={row.club.name || row.club.code} style={{ width: 36, height: 36, objectFit: 'cover', borderRadius: 10 }} /> : <div className='d-inline-flex align-items-center justify-content-center rounded bg-body-tertiary text-body-secondary' style={{ width: 36, height: 36 }}>N/A</div>}</div><div><div>{row.club?.name || '-'}</div><div className='small text-body-secondary'>{row.club?.code || '-'}</div></div></div></CTableDataCell>
                    <CTableDataCell>{getClubMembershipRoleLabel(row.role)}</CTableDataCell>
                    <CTableDataCell>{row.positionTitle || '-'}</CTableDataCell>
                    <CTableDataCell>{formatSportsDate(row.joinedAt)}</CTableDataCell>
                    <CTableDataCell><CBadge color={statusMeta.color}>{statusMeta.label}</CBadge></CTableDataCell>
                    <CTableDataCell>{getClubMembershipSourceLabel(row.source)}</CTableDataCell>
                    <CTableDataCell><CButton size='sm' color='secondary' variant='outline' onClick={() => navigate(`${basePath}/${row.id}`)}>Xem chi tiết</CButton></CTableDataCell>
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
                  ? <CPaginationItem key={`club-membership-ellipsis-${index}`} disabled>...</CPaginationItem>
                  : <CPaginationItem key={`club-membership-page-${entry}`} active={pagination.page === entry} onClick={() => setPagination((current) => ({ ...current, page: entry }))}>{entry}</CPaginationItem>)}
                <CPaginationItem disabled={pagination.page >= pagination.pageCount} onClick={() => setPagination((current) => ({ ...current, page: Math.min(current.pageCount, current.page + 1) }))}>Sau</CPaginationItem>
              </CPagination>
            </div>
          ) : null}
        </>
      )}
    </div>
  )
}