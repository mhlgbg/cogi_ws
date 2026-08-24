import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { CAlert, CButton, CCard, CCardBody, CCardHeader, CSpinner } from '@coreui/react'
import { getAssessmentVersion } from '../services/assessmentService'
import { getRuntimeApiMessage, startAssessmentAttempt } from '../services/assessmentRuntimeApi'
import '../components/assessment-runner.css'

export default function AssessmentRunnerStartPage() {
  const navigate = useNavigate()
  const { versionId } = useParams()
  const [loading, setLoading] = useState(true)
  const [starting, setStarting] = useState(false)
  const [version, setVersion] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      setError('')
      try {
        const payload = await getAssessmentVersion(versionId)
        if (cancelled) return
        setVersion(payload)
      } catch (requestError) {
        if (cancelled) return
        setError(getRuntimeApiMessage(requestError, 'Không tải được phiên bản assessment để bắt đầu làm bài.'))
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [versionId])

  async function handleStart(resumeExisting = false) {
    setStarting(true)
    setError('')
    try {
      const payload = await startAssessmentAttempt(versionId, { resumeExisting, sourceType: 'admin' })
      navigate(`/assessment-runner/${payload?.attempt?.id || payload?.attempt?.documentId}`, { replace: true })
    } catch (requestError) {
      setError(getRuntimeApiMessage(requestError, 'Không thể bắt đầu bài làm assessment.'))
    } finally {
      setStarting(false)
    }
  }

  if (loading) {
    return <div className='py-4 d-flex align-items-center gap-2'><CSpinner size='sm' /><span>Đang tải phiên bản assessment...</span></div>
  }

  return (
    <div className='assessment-runner assessment-runner-shell py-4'>
      <CCard className='ai-card'>
        <CCardHeader><strong>Làm thử assessment</strong></CCardHeader>
        <CCardBody>
          {error ? <CAlert color='danger'>{error}</CAlert> : null}
          {!version ? <CAlert color='warning' className='mb-0'>Không tìm thấy phiên bản assessment.</CAlert> : (
            <div className='d-grid gap-3'>
              <div className='fs-4 fw-semibold'>{version?.title || version?.code}</div>
              <div className='text-body-secondary'>{version?.assessment?.name || version?.assessment?.code || ''}</div>
              <div className='small text-body-secondary'>{`${version?.code || '-'} · ${version?.durationMinutes || 0} phút · ${version?.versionStatus || '-'}`}</div>
              {version?.instructions ? <div dangerouslySetInnerHTML={{ __html: version.instructions }} /> : null}
              <CAlert color='info' className='mb-0'>Bắt đầu attempt mới sẽ dùng snapshot cấu hình đề mới nhất. Tiếp tục attempt đang mở sẽ giữ nguyên snapshot cũ của attempt đó.</CAlert>
              <div className='d-flex gap-2 flex-wrap'>
                <CButton color='secondary' variant='outline' onClick={() => navigate('/assessments')}>Về ngân hàng đề</CButton>
                <CButton color='primary' onClick={() => handleStart(false)} disabled={starting || version?.versionStatus !== 'published'}>{starting ? 'Đang tạo attempt...' : 'Bắt đầu attempt mới'}</CButton>
                <CButton color='secondary' variant='outline' onClick={() => handleStart(true)} disabled={starting || version?.versionStatus !== 'published'}>Tiếp tục attempt đang mở</CButton>
              </div>
              {version?.versionStatus !== 'published' ? <CAlert color='warning' className='mb-0'>Hiện chỉ có thể làm thử phiên bản đã published.</CAlert> : null}
            </div>
          )}
        </CCardBody>
      </CCard>
    </div>
  )
}