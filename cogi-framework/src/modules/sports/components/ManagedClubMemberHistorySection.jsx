import { useEffect, useMemo, useState } from 'react'
import { CAlert, CBadge, CCard, CCardBody, CPagination, CPaginationItem, CSpinner } from '@coreui/react'
import { listManagedClubMemberHistory } from '../services/sportsClubManagementService'
import { formatSportsDateTime, getApprovedByLabel, getClubMembershipRoleLabel, getClubMembershipSourceLabel, getClubMembershipStatusMeta } from '../utils/clubMembershipUi'

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

function getEventLabel(eventType) {
  const key = String(eventType || '').trim().toLowerCase()
  if (key === 'joined') return 'Gia nhập'
  if (key === 'approved') return 'Được duyệt'
  if (key === 'rejected') return 'Bị từ chối'
  if (key === 'left') return 'Rời CLB'
  if (key === 'rejoined') return 'Gia nhập lại'
  if (key === 'activated') return 'Kích hoạt'
  if (key === 'deactivated') return 'Ngưng hoạt động'
  if (key === 'suspended') return 'Tạm đình chỉ'
  if (key === 'reactivated') return 'Hoạt động lại'
  if (key === 'role_changed') return 'Thay đổi vai trò'
  if (key === 'position_changed') return 'Thay đổi chức danh'
  if (key === 'member_code_changed') return 'Thay đổi mã thành viên'
  return 'Sự kiện khác'
}

export default function ManagedClubMemberHistorySection({ clubId, membershipId }) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [rows, setRows] = useState([])
  const [pagination, setPagination] = useState({ page: 1, pageSize: 10, total: 0, pageCount: 1 })
  const pages = useMemo(() => buildPages(pagination.page, pagination.pageCount), [pagination.page, pagination.pageCount])

  useEffect(() => {
    let mounted = true
    async function load() {
      if (!clubId || !membershipId) return
      setLoading(true)
      setError('')
      try {
        const result = await listManagedClubMemberHistory(clubId, membershipId, { page: pagination.page, pageSize: pagination.pageSize, sort: 'eventAt:desc' })
        if (!mounted) return
        setRows(Array.isArray(result?.rows) ? result.rows : [])
        setPagination(result?.pagination || { page: 1, pageSize: 10, total: 0, pageCount: 1 })
      } catch (requestError) {
        if (!mounted) return
        setRows([])
        setError(requestError?.response?.data?.error?.message || requestError?.message || 'Không tải được lịch sử thành viên.')
      } finally {
        if (mounted) setLoading(false)
      }
    }
    load()
    return () => { mounted = false }
  }, [clubId, membershipId, pagination.page, pagination.pageSize])

  return (
    <div className='mt-4'>
      <div className='fw-semibold mb-3'>Lịch sử</div>
      {error ? <CAlert color='danger'>{error}</CAlert> : null}
      {loading ? (
        <div className='d-flex align-items-center gap-2'><CSpinner size='sm' />Đang tải lịch sử...</div>
      ) : rows.length === 0 ? (
        <CAlert color='secondary' className='mb-0'>Chưa có lịch sử thay đổi.</CAlert>
      ) : (
        <>
          {rows.map((item) => {
            const fromStatus = getClubMembershipStatusMeta(item.fromStatus)
            const toStatus = getClubMembershipStatusMeta(item.toStatus)
            const oldMemberCode = item.metadata?.oldMemberCode ? String(item.metadata.oldMemberCode).trim() : ''
            const newMemberCode = item.metadata?.newMemberCode ? String(item.metadata.newMemberCode).trim() : ''
            return (
              <CCard className='mb-3' key={item.id}>
                <CCardBody>
                  <div className='d-flex justify-content-between gap-3 flex-wrap mb-2'>
                    <div className='fw-semibold'>{getEventLabel(item.eventType)}</div>
                    <div className='small text-body-secondary'>{formatSportsDateTime(item.eventAt)}</div>
                  </div>
                  <div className='d-flex gap-2 flex-wrap mb-2'>
                    <CBadge color='info'>{getClubMembershipSourceLabel(item.source)}</CBadge>
                    {item.performedBy?.id ? <CBadge color='secondary'>{getApprovedByLabel(item.performedBy)}</CBadge> : null}
                  </div>
                  {item.fromStatus || item.toStatus ? <div className='mb-2'>Trạng thái: <CBadge color={fromStatus.color}>{fromStatus.label}</CBadge> {' -> '} <CBadge color={toStatus.color}>{toStatus.label}</CBadge></div> : null}
                  {item.fromRole || item.toRole ? <div className='mb-2'>Vai trò: <strong>{getClubMembershipRoleLabel(item.fromRole)}</strong> {' -> '} <strong>{getClubMembershipRoleLabel(item.toRole)}</strong></div> : null}
                  {item.fromPositionTitle || item.toPositionTitle ? <div className='mb-2'>Chức danh: <strong>{item.fromPositionTitle || '-'}</strong> {' -> '} <strong>{item.toPositionTitle || '-'}</strong></div> : null}
                  {oldMemberCode || newMemberCode ? <div className='mb-2'>Mã thành viên: <strong>{oldMemberCode || '-'}</strong> {' -> '} <strong>{newMemberCode || '-'}</strong></div> : null}
                  {item.note ? <div style={{ whiteSpace: 'pre-wrap' }}>{item.note}</div> : null}
                </CCardBody>
              </CCard>
            )
          })}
          {pagination.pageCount > 1 ? (
            <div className='d-flex justify-content-end'>
              <CPagination>
                <CPaginationItem disabled={pagination.page <= 1} onClick={() => setPagination((current) => ({ ...current, page: Math.max(1, current.page - 1) }))}>Trước</CPaginationItem>
                {pages.map((entry, index) => entry === '...'
                  ? <CPaginationItem key={`managed-history-ellipsis-${index}`} disabled>...</CPaginationItem>
                  : <CPaginationItem key={`managed-history-page-${entry}`} active={pagination.page === entry} onClick={() => setPagination((current) => ({ ...current, page: entry }))}>{entry}</CPaginationItem>)}
                <CPaginationItem disabled={pagination.page >= pagination.pageCount} onClick={() => setPagination((current) => ({ ...current, page: Math.min(current.pageCount, current.page + 1) }))}>Sau</CPaginationItem>
              </CPagination>
            </div>
          ) : null}
        </>
      )}
    </div>
  )
}