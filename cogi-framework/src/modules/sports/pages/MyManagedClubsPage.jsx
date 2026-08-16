import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { CAlert, CBadge, CButton, CCard, CCardBody, CCol, CRow, CSpinner } from '@coreui/react'
import { listMyManagedClubs, getSportsClubManagementApiMessage } from '../services/sportsClubManagementService'
import { formatAssignmentDateTime } from '../utils/sportsClubUserAssignmentUi'
import { getClubTypeLabel, getParentClubLabel, getSportTypeLabel, getSportsClubStatusMeta } from '../utils/sportsClubUi'

export default function MyManagedClubsPage() {
  const navigate = useNavigate()
  const { tenantCode } = useParams()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [rows, setRows] = useState([])

  useEffect(() => {
    let mounted = true
    async function load() {
      setLoading(true)
      setError('')
      try {
        const result = await listMyManagedClubs()
        if (!mounted) return
        setRows(Array.isArray(result) ? result : [])
      } catch (requestError) {
        if (!mounted) return
        setRows([])
        setError(getSportsClubManagementApiMessage(requestError, 'Không tải được danh sách Club bạn quản lý.'))
      } finally {
        if (mounted) setLoading(false)
      }
    }
    load()
    return () => { mounted = false }
  }, [])

  const basePath = tenantCode ? `/t/${encodeURIComponent(tenantCode)}/sports/my-clubs` : '/sports/my-clubs'

  return (
    <div>
      <div className='mb-4'>
        <div className='fs-5 fw-semibold'>CLB tôi quản lý</div>
        <div className='text-body-secondary'>Danh sách các Club mà bạn đang được phân công quản lý trong tenant hiện tại.</div>
      </div>
      {error ? <CAlert color='danger'>{error}</CAlert> : null}
      {loading ? (
        <div className='d-flex align-items-center gap-2'><CSpinner size='sm' />Đang tải danh sách Club...</div>
      ) : rows.length === 0 ? (
        <CAlert color='secondary' className='mb-0'>Bạn hiện chưa được phân công quản lý câu lạc bộ nào.</CAlert>
      ) : (
        <CRow className='g-4'>
          {rows.map((club) => {
            const statusMeta = getSportsClubStatusMeta(club.status)
            return (
              <CCol md={6} xl={4} key={club.id}>
                <CCard className='h-100'>
                  <CCardBody className='d-flex flex-column gap-3'>
                    <div className='d-flex gap-3'>
                      <div>
                        {club.logo?.url ? <img src={club.logo.url} alt={club.name || club.code} style={{ width: 72, height: 72, objectFit: 'cover', borderRadius: 14 }} /> : <div className='d-inline-flex align-items-center justify-content-center rounded bg-body-tertiary text-body-secondary' style={{ width: 72, height: 72 }}>N/A</div>}
                      </div>
                      <div className='flex-grow-1'>
                        <div className='fw-semibold fs-5'>{club.name || '-'}</div>
                        <div className='text-body-secondary'>{[club.shortName, club.code].filter(Boolean).join(' · ') || '-'}</div>
                        <div className='d-flex gap-2 mt-2 flex-wrap'>
                          <CBadge color={statusMeta.color}>{statusMeta.label}</CBadge>
                          <CBadge color='info'>{getClubTypeLabel(club.clubType)}</CBadge>
                          <CBadge color='secondary'>{getSportTypeLabel(club.sportType)}</CBadge>
                        </div>
                      </div>
                    </div>
                    <div className='small text-body-secondary'>Parent Club: {club.parentClub?.id ? getParentClubLabel(club.parentClub) : 'Root club'}</div>
                    <div className='small text-body-secondary'>Ngày được phân công: {formatAssignmentDateTime(club.assignedAt)}</div>
                    <div className='small text-body-secondary'>{club.assignmentNote || 'Không có ghi chú phân công.'}</div>
                    <div className='mt-auto'>
                      <CButton color='primary' onClick={() => navigate(`${basePath}/${club.id}`)}>Vào workspace</CButton>
                    </div>
                  </CCardBody>
                </CCard>
              </CCol>
            )
          })}
        </CRow>
      )}
    </div>
  )
}