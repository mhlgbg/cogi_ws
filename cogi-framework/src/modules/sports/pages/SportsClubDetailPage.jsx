import { useEffect, useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { CAlert, CBadge, CButton, CCard, CCardBody, CCol, CRow, CSpinner } from '@coreui/react'
import SportsClubForm from '../components/SportsClubForm'
import SportsClubManagersSection from '../components/SportsClubManagersSection'
import {
  activateSportsClub,
  deactivateSportsClub,
  getSportsClub,
  getSportsClubApiMessage,
  updateSportsClub,
} from '../services/sportsClubService'
import {
  formatSportsDate,
  formatSportsDateTime,
  getClubTypeLabel,
  getJoinPolicyLabel,
  getParentClubLabel,
  getSportTypeLabel,
  getSportsClubStatusMeta,
} from '../utils/sportsClubUi'

function InfoCard({ label, value }) {
  return (
    <CCard className='h-100'>
      <CCardBody>
        <div className='small text-body-secondary'>{label}</div>
        <div className='fw-semibold'>{value || '-'}</div>
      </CCardBody>
    </CCard>
  )
}

export default function SportsClubDetailPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const { id, tenantCode } = useParams()
  const [loading, setLoading] = useState(true)
  const [club, setClub] = useState(null)
  const [error, setError] = useState('')
  const [editing, setEditing] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState('')
  const [success, setSuccess] = useState(location.state?.message || '')

  const listPath = tenantCode ? `/t/${encodeURIComponent(tenantCode)}/sports/clubs` : '/sports/clubs'

  useEffect(() => {
    let mounted = true
    async function load() {
      setLoading(true)
      setError('')
      try {
        const result = await getSportsClub(id)
        if (!mounted) return
        setClub(result || null)
      } catch (requestError) {
        if (!mounted) return
        setClub(null)
        setError(getSportsClubApiMessage(requestError, 'Không tải được chi tiết câu lạc bộ thể thao.'))
      } finally {
        if (mounted) setLoading(false)
      }
    }
    load()
    return () => { mounted = false }
  }, [id])

  useEffect(() => {
    if (!success) return undefined
    const timer = window.setTimeout(() => setSuccess(''), 2500)
    return () => window.clearTimeout(timer)
  }, [success])

  async function handleUpdate(payload) {
    setSubmitting(true)
    setSubmitError('')
    try {
      const updated = await updateSportsClub(id, payload)
      setClub(updated)
      setEditing(false)
      setSuccess('Đã cập nhật câu lạc bộ thể thao.')
    } catch (requestError) {
      setSubmitError(getSportsClubApiMessage(requestError, 'Không thể cập nhật câu lạc bộ thể thao.'))
      throw requestError
    } finally {
      setSubmitting(false)
    }
  }

  async function handleToggleActive(nextActive) {
    const confirmed = window.confirm(nextActive
      ? 'Kích hoạt lại câu lạc bộ này?'
      : 'Chuyển câu lạc bộ này sang trạng thái ngưng hoạt động?')
    if (!confirmed) return

    setSubmitting(true)
    setSubmitError('')
    try {
      const updated = nextActive ? await activateSportsClub(id) : await deactivateSportsClub(id)
      setClub(updated)
      setSuccess(nextActive ? 'Đã kích hoạt câu lạc bộ thể thao.' : 'Đã ngưng hoạt động câu lạc bộ thể thao.')
    } catch (requestError) {
      setSubmitError(getSportsClubApiMessage(requestError, nextActive ? 'Không thể kích hoạt câu lạc bộ.' : 'Không thể ngưng hoạt động câu lạc bộ.'))
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return <div className='d-flex align-items-center gap-2'><CSpinner size='sm' />Đang tải chi tiết câu lạc bộ thể thao...</div>
  }

  if (!club) {
    return (
      <div>
        <CAlert color='danger'>{error || 'Không tìm thấy câu lạc bộ thể thao.'}</CAlert>
        <CButton color='secondary' variant='outline' onClick={() => navigate(listPath)}>Quay lại danh sách</CButton>
      </div>
    )
  }

  const statusMeta = getSportsClubStatusMeta(club.status)

  return (
    <div>
      <div className='d-flex justify-content-between align-items-start gap-3 flex-wrap mb-4'>
        <div>
          <div className='fs-5 fw-semibold'>{club.name || '-'}</div>
          <div className='text-body-secondary'>{club.code || '-'} · {club.slug || '-'}</div>
          <div className='d-flex gap-2 mt-2 flex-wrap'>
            <CBadge color={statusMeta.color}>{statusMeta.label}</CBadge>
            <CBadge color='info'>{getClubTypeLabel(club.clubType)}</CBadge>
            <CBadge color='secondary'>{getSportTypeLabel(club.sportType)}</CBadge>
          </div>
        </div>
        <div className='d-flex gap-2 flex-wrap'>
          <CButton color='secondary' variant='outline' onClick={() => navigate(listPath)}>Quay lại danh sách</CButton>
          {!editing ? <CButton color='warning' variant='outline' onClick={() => setEditing(true)} disabled={submitting}>Chỉnh sửa</CButton> : null}
          {club.status === 'active'
            ? <CButton color='warning' onClick={() => handleToggleActive(false)} disabled={submitting}>Ngưng hoạt động</CButton>
            : club.status !== 'archived'
              ? <CButton color='success' onClick={() => handleToggleActive(true)} disabled={submitting}>Kích hoạt</CButton>
              : null}
        </div>
      </div>

      {submitError ? <CAlert color='danger'>{submitError}</CAlert> : null}
      {success ? <CAlert color='success'>{success}</CAlert> : null}

      {editing ? (
        <SportsClubForm initialValues={club} submitting={submitting} submitError='' onCancel={() => setEditing(false)} onSubmit={handleUpdate} />
      ) : (
        <>
          <CRow className='g-3 mb-4'>
            <CCol md={3}><InfoCard label='Mã CLB' value={club.code} /></CCol>
            <CCol md={3}><InfoCard label='Tên ngắn' value={club.shortName || '-'} /></CCol>
            <CCol md={3}><InfoCard label='Loại CLB' value={getClubTypeLabel(club.clubType)} /></CCol>
            <CCol md={3}><InfoCard label='Môn thể thao' value={getSportTypeLabel(club.sportType)} /></CCol>
          </CRow>
          <CRow className='g-3 mb-4'>
            <CCol md={4}><InfoCard label='Parent Club' value={getParentClubLabel(club.parentClub)} /></CCol>
            <CCol md={4}><InfoCard label='Join policy' value={getJoinPolicyLabel(club.joinPolicy)} /></CCol>
            <CCol md={4}><InfoCard label='Ngày thành lập' value={formatSportsDate(club.foundedAt)} /></CCol>
          </CRow>
          <CRow className='g-3 mb-4'>
            <CCol md={4}><InfoCard label='Điện thoại liên hệ' value={club.contactPhone || '-'} /></CCol>
            <CCol md={4}><InfoCard label='Email liên hệ' value={club.contactEmail || '-'} /></CCol>
            <CCol md={4}><InfoCard label='Website' value={club.website || '-'} /></CCol>
          </CRow>
          <CRow className='g-3 mb-4'>
            <CCol md={4}>
              <CCard className='h-100'>
                <CCardBody>
                  <div className='small text-body-secondary mb-2'>Logo</div>
                  {club.logo?.url ? <img src={club.logo.url} alt={club.name || club.code} style={{ width: '100%', maxHeight: 220, objectFit: 'cover', borderRadius: 12 }} /> : <div className='text-body-secondary'>Chưa có logo</div>}
                </CCardBody>
              </CCard>
            </CCol>
            <CCol md={8}>
              <CCard className='h-100'>
                <CCardBody>
                  <div className='small text-body-secondary mb-2'>Ảnh bìa</div>
                  {club.coverImage?.url ? <img src={club.coverImage.url} alt={`${club.name || club.code} cover`} style={{ width: '100%', maxHeight: 220, objectFit: 'cover', borderRadius: 12 }} /> : <div className='text-body-secondary'>Chưa có ảnh bìa</div>}
                </CCardBody>
              </CCard>
            </CCol>
          </CRow>
          <CCard className='mb-4'>
            <CCardBody>
              <div className='small text-body-secondary mb-2'>Mô tả</div>
              <div style={{ whiteSpace: 'pre-wrap' }}>{club.description || 'Chưa có mô tả.'}</div>
              <div className='small text-body-secondary mt-3 mb-2'>Địa chỉ</div>
              <div style={{ whiteSpace: 'pre-wrap' }}>{club.address || 'Chưa có địa chỉ.'}</div>
            </CCardBody>
          </CCard>
          {Array.isArray(club.childClubs) && club.childClubs.length > 0 ? (
            <CCard className='mb-4'>
              <CCardBody>
                <div className='small text-body-secondary mb-2'>Club con</div>
                <div className='d-flex flex-wrap gap-2'>
                  {club.childClubs.map((item) => <CBadge key={item.id} color='light' textColor='dark'>{getParentClubLabel(item)}</CBadge>)}
                </div>
              </CCardBody>
            </CCard>
          ) : null}
          <SportsClubManagersSection club={club} />
          <CRow className='g-3'>
            <CCol md={6}><InfoCard label='Tạo lúc' value={formatSportsDateTime(club.createdAt)} /></CCol>
            <CCol md={6}><InfoCard label='Cập nhật lúc' value={formatSportsDateTime(club.updatedAt)} /></CCol>
          </CRow>
        </>
      )}
    </div>
  )
}