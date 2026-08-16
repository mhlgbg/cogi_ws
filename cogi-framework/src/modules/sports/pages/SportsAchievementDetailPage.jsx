import { useEffect, useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { CAlert, CBadge, CButton, CCard, CCardBody, CCol, CRow, CSpinner } from '@coreui/react'
import SportsAchievementForm from '../components/SportsAchievementForm'
import { getSportsAchievement, getSportsAchievementApiMessage, updateSportsAchievement } from '../services/sportsAchievementService'
import { formatSportsDateTime, getAchievementSourceLabel, getAchievementStatusMeta, getAchievementTypeLabel, getSportTypeLabel, getUserLabel } from '../utils/sportsAchievementUi'

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

export default function SportsAchievementDetailPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const { id, tenantCode } = useParams()
  const [loading, setLoading] = useState(true)
  const [achievement, setAchievement] = useState(null)
  const [error, setError] = useState('')
  const [editing, setEditing] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState('')
  const [success, setSuccess] = useState(location.state?.message || '')

  const listPath = tenantCode ? `/t/${encodeURIComponent(tenantCode)}/sports/achievements` : '/sports/achievements'

  useEffect(() => {
    let mounted = true
    async function load() {
      setLoading(true)
      setError('')
      try {
        const result = await getSportsAchievement(id)
        if (!mounted) return
        setAchievement(result || null)
      } catch (requestError) {
        if (!mounted) return
        setAchievement(null)
        setError(getSportsAchievementApiMessage(requestError, 'Không tải được achievement.'))
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
      const updated = await updateSportsAchievement(id, payload)
      setAchievement(updated)
      setEditing(false)
      setSuccess('Đã cập nhật achievement.')
    } catch (requestError) {
      setSubmitError(getSportsAchievementApiMessage(requestError, 'Không thể cập nhật achievement.'))
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return <div className='d-flex align-items-center gap-2'><CSpinner size='sm' />Đang tải achievement...</div>
  }

  if (!achievement) {
    return (
      <div>
        <CAlert color='danger'>{error || 'Không tìm thấy achievement.'}</CAlert>
        <CButton color='secondary' variant='outline' onClick={() => navigate(listPath)}>Quay lại danh sách</CButton>
      </div>
    )
  }

  const statusMeta = getAchievementStatusMeta(achievement.status)

  return (
    <div>
      <div className='d-flex justify-content-between align-items-start gap-3 flex-wrap mb-4'>
        <div>
          <div className='fs-5 fw-semibold'>{achievement.title || 'Sports Achievement'}</div>
          <div className='text-body-secondary'>{achievement.sportsProfile?.fullName || '-'} · {achievement.club?.name || 'Không gắn CLB'}</div>
          <div className='d-flex gap-2 mt-2 flex-wrap'>
            <CBadge color={statusMeta.color}>{statusMeta.label}</CBadge>
            <CBadge color='info'>{getAchievementTypeLabel(achievement.achievementType)}</CBadge>
          </div>
        </div>
        <div className='d-flex gap-2 flex-wrap'>
          <CButton color='secondary' variant='outline' onClick={() => navigate(listPath)}>Quay lại danh sách</CButton>
          {!editing ? <CButton color='warning' variant='outline' onClick={() => setEditing(true)} disabled={submitting}>Chỉnh sửa</CButton> : null}
        </div>
      </div>

      {submitError ? <CAlert color='danger'>{submitError}</CAlert> : null}
      {success ? <CAlert color='success'>{success}</CAlert> : null}

      {editing ? (
        <SportsAchievementForm initialValues={achievement} submitting={submitting} submitError='' onCancel={() => setEditing(false)} onSubmit={handleUpdate} />
      ) : (
        <>
          <CRow className='g-3 mb-4'>
            <CCol md={4}><InfoCard label='Sports Profile' value={[achievement.sportsProfile?.fullName, achievement.sportsProfile?.code].filter(Boolean).join(' - ')} /></CCol>
            <CCol md={4}><InfoCard label='CLB' value={[achievement.club?.name, achievement.club?.code].filter(Boolean).join(' - ') || 'Không gắn CLB'} /></CCol>
            <CCol md={4}><InfoCard label='Môn' value={getSportTypeLabel(achievement.sportType)} /></CCol>
            <CCol md={4}><InfoCard label='Nguồn' value={getAchievementSourceLabel(achievement.source)} /></CCol>
            <CCol md={4}><InfoCard label='Achieved At' value={formatSportsDateTime(achievement.achievedAt)} /></CCol>
            <CCol md={4}><InfoCard label='Verified At' value={formatSportsDateTime(achievement.verifiedAt)} /></CCol>
            <CCol md={4}><InfoCard label='Result Value' value={achievement.resultValue === null ? '-' : String(achievement.resultValue)} /></CCol>
            <CCol md={4}><InfoCard label='Result Unit' value={achievement.resultUnit || '-'} /></CCol>
            <CCol md={4}><InfoCard label='Result Text' value={achievement.resultText || '-'} /></CCol>
            <CCol md={6}><InfoCard label='Source Reference' value={achievement.sourceReference || '-'} /></CCol>
            <CCol md={6}><InfoCard label='Verified By' value={getUserLabel(achievement.verifiedBy)} /></CCol>
          </CRow>

          <CCard className='mb-4'>
            <CCardBody>
              <div className='small text-body-secondary mb-2'>Mô tả</div>
              <div style={{ whiteSpace: 'pre-wrap' }}>{achievement.description || 'Không có.'}</div>
              <div className='small text-body-secondary mt-3 mb-2'>Ghi chú</div>
              <div style={{ whiteSpace: 'pre-wrap' }}>{achievement.note || 'Không có.'}</div>
            </CCardBody>
          </CCard>

          <CCard className='mb-4'>
            <CCardBody>
              <div className='small text-body-secondary mb-2'>Evidence</div>
              {achievement.evidence.length === 0 ? <div className='text-body-secondary'>Chưa có evidence.</div> : (
                <div className='d-flex flex-column gap-2'>
                  {achievement.evidence.map((item) => <a key={item.id} href={item.url} target='_blank' rel='noreferrer'>{item.name || item.url || `Media #${item.id}`}</a>)}
                </div>
              )}
            </CCardBody>
          </CCard>

          <CRow className='g-3'>
            <CCol md={6}><InfoCard label='Tạo lúc' value={formatSportsDateTime(achievement.createdAt)} /></CCol>
            <CCol md={6}><InfoCard label='Cập nhật lúc' value={formatSportsDateTime(achievement.updatedAt)} /></CCol>
          </CRow>
        </>
      )}
    </div>
  )
}
