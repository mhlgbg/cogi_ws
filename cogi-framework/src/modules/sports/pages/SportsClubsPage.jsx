import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  CAlert,
  CBadge,
  CButton,
  CCol,
  CFormCheck,
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
import {
  CLUB_TYPE_OPTIONS,
  getClubTypeLabel,
  getJoinPolicyLabel,
  getParentClubLabel,
  getSportTypeLabel,
  getSportsClubStatusMeta,
  JOIN_POLICY_OPTIONS,
  SPORT_TYPE_OPTIONS,
  STATUS_OPTIONS,
} from '../utils/sportsClubUi'

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

export default function SportsClubsPage() {
  const navigate = useNavigate()
  const { tenantCode } = useParams()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [rows, setRows] = useState([])
  const [filters, setFilters] = useState({ search: '', status: '', clubType: '', sportType: '', joinPolicy: '', rootOnly: false })
  const [appliedFilters, setAppliedFilters] = useState({ search: '', status: '', clubType: '', sportType: '', joinPolicy: '', rootOnly: '' })
  const [pagination, setPagination] = useState({ page: 1, pageSize: 10, total: 0, pageCount: 1 })
  const pages = useMemo(() => buildPages(pagination.page, pagination.pageCount), [pagination.page, pagination.pageCount])

  useEffect(() => {
    let mounted = true
    async function load() {
      setLoading(true)
      setError('')
      try {
        const result = await listSportsClubs({ page: pagination.page, pageSize: pagination.pageSize, sort: 'updatedAt:desc', ...appliedFilters })
        if (!mounted) return
        setRows(Array.isArray(result?.rows) ? result.rows : [])
        setPagination(result?.pagination || { page: 1, pageSize: 10, total: 0, pageCount: 1 })
      } catch (requestError) {
        if (!mounted) return
        setRows([])
        setError(requestError?.response?.data?.error?.message || requestError?.message || 'Không tải được danh sách CLB thể thao.')
      } finally {
        if (mounted) setLoading(false)
      }
    }
    load()
    return () => { mounted = false }
  }, [appliedFilters, pagination.page, pagination.pageSize])

  const basePath = tenantCode ? `/t/${encodeURIComponent(tenantCode)}/sports/clubs` : '/sports/clubs'

  function resetFilters() {
    const next = { search: '', status: '', clubType: '', sportType: '', joinPolicy: '', rootOnly: false }
    setFilters(next)
    setAppliedFilters({ ...next, rootOnly: '' })
    setPagination((current) => ({ ...current, page: 1 }))
  }

  return (
    <div>
      <div className='d-flex justify-content-between align-items-start gap-3 flex-wrap mb-4'>
        <div>
          <div className='fs-5 fw-semibold'>Câu lạc bộ thể thao</div>
          <div className='text-body-secondary'>Quản lý club, team, chapter và cộng đồng thể thao theo tenant, không gắn membership trong phạm vi task này.</div>
        </div>
        <CButton color='primary' onClick={() => navigate(`${basePath}/new`)}>Tạo CLB thể thao</CButton>
      </div>

      <CRow className='g-3 mb-3'>
        <CCol lg={4} md={6}><CFormInput placeholder='Tìm theo mã, tên, tên ngắn, slug, điện thoại, email' value={filters.search} onChange={(event) => setFilters((current) => ({ ...current, search: event.target.value }))} /></CCol>
        <CCol lg={2} md={6}><CFormSelect value={filters.status} onChange={(event) => setFilters((current) => ({ ...current, status: event.target.value }))}><option value=''>Tất cả trạng thái</option>{STATUS_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</CFormSelect></CCol>
        <CCol lg={2} md={6}><CFormSelect value={filters.clubType} onChange={(event) => setFilters((current) => ({ ...current, clubType: event.target.value }))}><option value=''>Tất cả loại CLB</option>{CLUB_TYPE_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</CFormSelect></CCol>
        <CCol lg={2} md={6}><CFormSelect value={filters.sportType} onChange={(event) => setFilters((current) => ({ ...current, sportType: event.target.value }))}><option value=''>Tất cả môn</option>{SPORT_TYPE_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</CFormSelect></CCol>
        <CCol lg={2} md={6}><CFormSelect value={filters.joinPolicy} onChange={(event) => setFilters((current) => ({ ...current, joinPolicy: event.target.value }))}><option value=''>Tất cả join policy</option>{JOIN_POLICY_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</CFormSelect></CCol>
        <CCol xs={12} className='d-flex justify-content-between align-items-center gap-3 flex-wrap'>
          <CFormCheck label='Chỉ hiển thị root clubs' checked={Boolean(filters.rootOnly)} onChange={(event) => setFilters((current) => ({ ...current, rootOnly: event.target.checked }))} />
          <div className='d-flex gap-2'>
            <CButton color='primary' onClick={() => { setPagination((current) => ({ ...current, page: 1 })); setAppliedFilters({ ...filters, rootOnly: filters.rootOnly ? 'true' : '' }) }}>Lọc</CButton>
            <CButton color='secondary' variant='outline' onClick={resetFilters}>Xóa lọc</CButton>
          </div>
        </CCol>
      </CRow>

      <div className='small text-body-secondary mb-3'>Tổng cộng {pagination.total} CLB</div>
      {error ? <CAlert color='danger'>{error}</CAlert> : null}

      {loading ? (
        <div className='d-flex align-items-center gap-2'><CSpinner size='sm' />Đang tải danh sách CLB thể thao...</div>
      ) : rows.length === 0 ? (
        <CAlert color='secondary' className='mb-0'>Chưa có CLB phù hợp.</CAlert>
      ) : (
        <>
          <CTable responsive hover align='middle'>
            <CTableHead>
              <CTableRow>
                <CTableHeaderCell>Logo</CTableHeaderCell>
                <CTableHeaderCell>Mã</CTableHeaderCell>
                <CTableHeaderCell>Tên</CTableHeaderCell>
                <CTableHeaderCell>Tên ngắn</CTableHeaderCell>
                <CTableHeaderCell>Loại</CTableHeaderCell>
                <CTableHeaderCell>Môn</CTableHeaderCell>
                <CTableHeaderCell>Parent Club</CTableHeaderCell>
                <CTableHeaderCell>Join Policy</CTableHeaderCell>
                <CTableHeaderCell>Trạng thái</CTableHeaderCell>
                <CTableHeaderCell>Thao tác</CTableHeaderCell>
              </CTableRow>
            </CTableHead>
            <CTableBody>
              {rows.map((row) => {
                const statusMeta = getSportsClubStatusMeta(row.status)
                return (
                  <CTableRow key={row.id}>
                    <CTableDataCell>{row.logo?.url ? <img src={row.logo.url} alt={row.name || row.code} style={{ width: 44, height: 44, objectFit: 'cover', borderRadius: 10 }} /> : <div className='d-inline-flex align-items-center justify-content-center rounded bg-body-tertiary text-body-secondary' style={{ width: 44, height: 44 }}>N/A</div>}</CTableDataCell>
                    <CTableDataCell className='fw-semibold'>{row.code || '-'}</CTableDataCell>
                    <CTableDataCell><div>{row.name || '-'}</div><div className='small text-body-secondary'>{row.slug || '-'}</div></CTableDataCell>
                    <CTableDataCell>{row.shortName || '-'}</CTableDataCell>
                    <CTableDataCell>{getClubTypeLabel(row.clubType)}</CTableDataCell>
                    <CTableDataCell>{getSportTypeLabel(row.sportType)}</CTableDataCell>
                    <CTableDataCell>{getParentClubLabel(row.parentClub)}</CTableDataCell>
                    <CTableDataCell>{getJoinPolicyLabel(row.joinPolicy)}</CTableDataCell>
                    <CTableDataCell><CBadge color={statusMeta.color}>{statusMeta.label}</CBadge></CTableDataCell>
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
                  ? <CPaginationItem key={`sports-club-ellipsis-${index}`} disabled>...</CPaginationItem>
                  : <CPaginationItem key={`sports-club-page-${entry}`} active={pagination.page === entry} onClick={() => setPagination((current) => ({ ...current, page: entry }))}>{entry}</CPaginationItem>)}
                <CPaginationItem disabled={pagination.page >= pagination.pageCount} onClick={() => setPagination((current) => ({ ...current, page: Math.min(current.pageCount, current.page + 1) }))}>Sau</CPaginationItem>
              </CPagination>
            </div>
          ) : null}
        </>
      )}
    </div>
  )
}