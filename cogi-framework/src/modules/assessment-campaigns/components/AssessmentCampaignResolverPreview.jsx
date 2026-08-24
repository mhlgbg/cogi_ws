import { useState } from 'react'
import { CAlert, CButton, CCard, CCardBody, CCardHeader, CFormInput, CFormLabel } from '@coreui/react'
import { getApiMessage, resolveAssessmentCampaignAssessment } from '../services/assessmentCampaignService'

export default function AssessmentCampaignResolverPreview({ campaignId }) {
  const [grade, setGrade] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState(null)

  async function handleResolve() {
    setLoading(true)
    setError('')
    setResult(null)
    try {
      const payload = await resolveAssessmentCampaignAssessment(campaignId, { grade: grade === '' ? null : Number(grade) })
      setResult(payload)
    } catch (requestError) {
      setError(getApiMessage(requestError, 'Không kiểm tra được rule phân đề'))
    } finally {
      setLoading(false)
    }
  }

  const noMatchMessage = result?.status === 'NO_MATCH' ? 'Không tìm thấy bài đánh giá phù hợp với lớp đã chọn.' : result?.status === 'AMBIGUOUS_MATCH' ? 'Có nhiều quy tắc phù hợp. Vui lòng kiểm tra cấu hình phân đề.' : ''

  return (
    <CCard className='ai-card'>
      <CCardHeader><strong>Kiểm tra phân đề</strong></CCardHeader>
      <CCardBody>
        {error ? <CAlert color='danger'>{error}</CAlert> : null}
        <div className='d-flex gap-3 align-items-end flex-wrap mb-3'>
          <div>
            <CFormLabel>Lớp</CFormLabel>
            <CFormInput type='number' value={grade} onChange={(event) => setGrade(event.target.value)} style={{ width: 160 }} />
          </div>
          <CButton color='primary' onClick={handleResolve} disabled={loading}>{loading ? 'Đang kiểm tra...' : 'Kiểm tra phân đề'}</CButton>
        </div>
        {noMatchMessage ? <CAlert color='warning'>{noMatchMessage}</CAlert> : null}
        {result?.status === 'MATCHED' ? (
          <div className='border rounded-3 p-3'>
            <div className='fw-semibold mb-2'>Rule phù hợp</div>
            <div className='mb-2'>{result?.matchedRule?.name || result?.matchedRule?.code}</div>
            <div className='small text-body-secondary'>{result?.matchedRule?.gradeFrom !== null && result?.matchedRule?.gradeTo !== null ? `Lớp ${result.matchedRule.gradeFrom}–${result.matchedRule.gradeTo}` : 'Không giới hạn lớp'}</div>
            <hr />
            <div><strong>Đề:</strong> {result?.assessment?.name || result?.assessment?.code || '-'}</div>
            <div><strong>Version:</strong> {result?.assessmentVersion?.code || '-'}</div>
          </div>
        ) : null}
      </CCardBody>
    </CCard>
  )
}