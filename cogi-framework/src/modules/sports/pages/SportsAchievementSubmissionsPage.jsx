import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { CAlert, CBadge, CButton, CCol, CFormInput, CFormSelect, CPagination, CPaginationItem, CRow, CSpinner, CTable, CTableBody, CTableDataCell, CTableHead, CTableHeaderCell, CTableRow } from '@coreui/react'
import { listSportsAchievementSubmissions } from '../services/sportsAchievementSubmissionService'
import {
  ACHIEVEMENT_TYPE_OPTIONS,
  formatSportsDateTime,
  getAchievementTypeLabel,
  getSportTypeLabel,
  getSubmissionSourceLabel,
  getSubmissionStatusMeta,
  SPORT_TYPE_OPTIONS,
  SUBMISSION_SOURCE_OPTIONS,
  SUBMISSION_STATUS_OPTIONS,
} from '../utils/sportsAchievementUi'

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

export default function SportsAchievementSubmissionsPage() {
  const navigate = useNavigate()
  const { tenantCode } = useParams()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [rows, setRows] = useState([])
  const [filters, setFilters] = useState({ search: '', status: '', source: '', achievementType: '', sportType: '' })
  const [appliedFilters, setAppliedFilters] = useState({ search: '', status: '', source: '', achievementType: '', sportType: '' })
  const [pagination, setPagination] = useState({ page: 1, pageSize: 10, total: 0, pageCount: 1 })
  const pages = useMemo(() => buildPages(pagination.page, pagination.pageCount), [pagination.page, pagination.pageCount])

  useEffect(() => {
    let mounted = true
    async function load() {
      setLoading(true)
      setError('')
      try {
        const result = await listSportsAchievementSubmissions({ page: pagination.page, pageSize: pagination.pageSize, sort: 'updatedAt:desc', ...appliedFilters })
        if (!mounted) return
        setRows(Array.isArray(result?.rows) ? result.rows : [])
        setPagination(result?.pagination || { page: 1, pageSize: 10, total: 0, pageCount: 1 })
      } catch (requestError) {
        if (!mounted) return
        setRows([])
        setError(requestError?.response?.data?.error?.message || requestError?.message || 'Không tải được submission.')
      } finally {
        if (mounted) setLoading(false)
      }
    }
    load()
    return () => { mounted = false }
  }, [appliedFilters, pagination.page, pagination.pageSize])

  const basePath = tenantCode ? `/t/${encodeURIComponent(tenantCode)}/sports/achievement-submissions` : '/sports/achievement-submissions'

  return (
    <div>
      <div className='d-flex justify-content-between align-items-start gap-3 flex-wrap mb-4'>
        <div>
          <div className='fs-5 fw-semibold'>Sports Achievement Submissions</div>
          <div className='text-body-secondary'>Quản lý quy trình đề nghị, xét duyệt và liên kết sang achievement đã ghi nhận.</div>
        </div>
        <CButton color='primary' onClick={() => navigate(`${basePath}/new`)}>Tạo submission</CButton>
      </div>

      <CRow className='g-3 mb-3'>
        <CCol lg={4} md={6}><CFormInput placeholder='Tìm theo title, result text, source reference, profile, club' value={filters.search} onChange={(event) => setFilters((current) => ({ ...current, search: event.target.value }))} /></CCol>
        <CCol lg={2} md={6}><CFormSelect value={filters.status} onChange={(event) => setFilters((current) => ({ ...current, status: event.target.value }))}><option value=''>Tất cả trạng thái</option>{SUBMISSION_STATUS_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</CFormSelect></CCol>
        <CCol lg={2} md={6}><CFormSelect value={filters.source} onChange={(event) => setFilters((current) => ({ ...current, source: event.target.value }))}><option value=''>Tất cả nguồn</option>{SUBMISSION_SOURCE_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</CFormSelect></CCol>
        <CCol lg={2} md={6}><CFormSelect value={filters.achievementType} onChange={(event) => setFilters((current) => ({ ...current, achievementType: event.target.value }))}><option value=''>Tất cả loại</option>{ACHIEVEMENT_TYPE_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</CFormSelect></CCol>
        <CCol lg={2} md={6}><CFormSelect value={filters.sportType} onChange={(event) => setFilters((current) => ({ ...current, sportType: event.target.value }))}><option value=''>Tất cả môn</option>{SPORT_TYPE_OPTIONS.filter((option) => option.value).map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</CFormSelect></CCol>
      </CRow>
      <div className='d-flex gap-2 mb-3'>
        <CButton color='primary' onClick={() => { setPagination((current) => ({ ...current, page: 1 })); setAppliedFilters(filters) }}>Lọc</CButton>
        <CButton color='secondary' variant='outline' onClick={() => { const next = { search: '', status: '', source: '', achievementType: '', sportType: '' }; setFilters(next); setAppliedFilters(next); setPagination((current) => ({ ...current, page: 1 })) }}>Xóa lọc</CButton>
      </div>

      <div className='small text-body-secondary mb-3'>Tổng cộng {pagination.total} submission</div>
      {error ? <CAlert color='danger'>{error}</CAlert> : null}

      {loading ? (
        <div className='d-flex align-items-center gap-2'><CSpinner size='sm' />Đang tải submission...</div>
      ) : rows.length === 0 ? (
        <CAlert color='secondary' className='mb-0'>Chưa có submission phù hợp.</CAlert>
      ) : (
        <>
          <CTable responsive hover align='middle'>
            <CTableHead>
              <CTableRow>
                <CTableHeaderCell>Sports Profile</CTableHeaderCell>
                <CTableHeaderCell>CLB</CTableHeaderCell>
                <CTableHeaderCell>Tiêu đề</CTableHeaderCell>
                <CTableHeaderCell>Loại</CTableHeaderCell>
                <CTableHeaderCell>Kết quả</CTableHeaderCell>
                <CTableHeaderCell>Achieved At</CTableHeaderCell>
                <CTableHeaderCell>Nguồn</CTableHeaderCell>
                <CTableHeaderCell>Trạng thái</CTableHeaderCell>
                <CTableHeaderCell>Submitted At</CTableHeaderCell>
                <CTableHeaderCell>Reviewed At</CTableHeaderCell>
                <CTableHeaderCell>Achievement</CTableHeaderCell>
                <CTableHeaderCell>Thao tác</CTableHeaderCell>
              </CTableRow>
            </CTableHead>
            <CTableBody>
              {rows.map((row) => {
                const statusMeta = getSubmissionStatusMeta(row.status)
                return (
                  <CTableRow key={row.id}>
                    <CTableDataCell><div>{row.sportsProfile?.fullName || '-'}</div><div className='small text-body-secondary'>{row.sportsProfile?.code || '-'}</div></CTableDataCell>
                    <CTableDataCell><div>{row.club?.name || '-'}</div><div className='small text-body-secondary'>{row.club?.code || '-'}</div></CTableDataCell>
                    <CTableDataCell><div className='fw-semibold'>{row.title || '-'}</div><div className='small text-body-secondary'>{getSportTypeLabel(row.sportType)}</div></CTableDataCell>
                    <CTableDataCell>{getAchievementTypeLabel(row.achievementType)}</CTableDataCell>
                    <CTableDataCell><div>{row.resultText || '-'}</div><div className='small text-body-secondary'>{row.resultValue ?? '-'} {row.resultUnit || ''}</div></CTableDataCell>
                    <CTableDataCell>{formatSportsDateTime(row.achievedAt)}</CTableDataCell>
                    <CTableDataCell>{getSubmissionSourceLabel(row.source)}</CTableDataCell>
                    <CTableDataCell><CBadge color={statusMeta.color}>{statusMeta.label}</CBadge></CTableDataCell>
                    <CTableDataCell>{formatSportsDateTime(row.submittedAt)}</CTableDataCell>
                    <CTableDataCell>{formatSportsDateTime(row.reviewedAt)}</CTableDataCell>
                    <CTableDataCell>{row.achievement?.id ? row.achievement.title || `#${row.achievement.id}` : '-'}</CTableDataCell>
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
                  ? <CPaginationItem key={`sports-achievement-submission-ellipsis-${index}`} disabled>...</CPaginationItem>
                  : <CPaginationItem key={`sports-achievement-submission-page-${entry}`} active={pagination.page === entry} onClick={() => setPagination((current) => ({ ...current, page: entry }))}>{entry}</CPaginationItem>)}
                <CPaginationItem disabled={pagination.page >= pagination.pageCount} onClick={() => setPagination((current) => ({ ...current, page: Math.min(current.pageCount, current.page + 1) }))}>Sau</CPaginationItem>
              </CPagination>
            </div>
          ) : null}
        </>
      )}
    </div>
  )
}
