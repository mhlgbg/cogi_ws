import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { CAlert, CBadge, CButton, CCard, CCardBody, CCardHeader, CCol, CFormInput, CFormLabel, CFormSelect, CFormTextarea, CModal, CModalBody, CModalFooter, CModalHeader, CModalTitle, CNav, CNavItem, CNavLink, CRow, CSpinner, CTable, CTableBody, CTableDataCell, CTableHead, CTableHeaderCell, CTableRow } from '@coreui/react'
import CandidateAssessmentResultView from '../../../features/public-assessment/components/CandidateAssessmentResultView'
import { allowAssessmentCampaignRetake, cancelAssessmentCampaignAttempt, getApiMessage as getCampaignApiMessage } from '../../assessment-campaigns/services/assessmentCampaignService'
import { formatDateTime, formatScorePair, getAnswerScoreStatusBadgeColor, getAnswerScoreStatusLabel, getCefrLabel, getFileAssetUrl, getPlacementConfirmationBadgeColor, getPlacementConfirmationStatusLabel, getQuestionTypeLabel, getResultStatusBadgeColor, getResultStatusLabel, getScoringMethodLabel, getSpeakingReviewStatusLabel } from '../components/assessmentUi'
import { completeSpeakingReview, confirmAssessmentPlacement, createSpeakingReviewForResult, getApiMessage, getAssessmentResultCandidatePreview, getAssessmentResultDetail, recalculateAssessmentResult, rescoreAssessmentAttempt, saveSpeakingReview, setManualAnswerScore, startSpeakingReview } from '../services/assessmentService'

const TABS = [
  { key: 'overview', label: 'Tổng quan' },
  { key: 'breakdown', label: 'Chi tiết điểm' },
  { key: 'answers', label: 'Bài làm' },
  { key: 'manual', label: 'Chấm thủ công' },
  { key: 'speaking', label: 'Speaking' },
  { key: 'confirmation', label: 'Xác nhận xếp mức' },
  { key: 'candidate-preview', label: 'Góc nhìn thí sinh' },
  { key: 'history', label: 'Lịch sử' },
]

const CEFR_LEVELS = ['PRE_A1', 'A1', 'A2', 'B1', 'B2', 'C1', 'C2']
const REVIEW_MODE_OPTIONS = [
  { value: 'live', label: 'Phỏng vấn trực tiếp' },
  { value: 'recording', label: 'Nghe lại bài ghi âm' },
]
const CANCEL_REASON_OPTIONS = [
  { value: 'wrong_assessment', label: 'Chọn nhầm bài' },
  { value: 'technical_issue', label: 'Lỗi kỹ thuật' },
  { value: 'test_data', label: 'Dữ liệu thử nghiệm' },
  { value: 'candidate_mistake', label: 'Người làm bài thao tác/làm nhầm' },
  { value: 'admin_decision', label: 'Quản trị quyết định hủy' },
  { value: 'other', label: 'Khác' },
]

function ScoreCard({ label, value, helper }) {
  return (
    <CCard className='h-100 border'>
      <CCardBody>
        <div className='small text-body-secondary mb-1'>{label}</div>
        <div className='fs-4 fw-semibold'>{value}</div>
        {helper ? <div className='small text-body-secondary mt-2'>{helper}</div> : null}
      </CCardBody>
    </CCard>
  )
}

function formatOptionText(option) {
  if (!option) return '-'
  const label = String(option?.label || '').trim()
  const content = String(option?.content || option?.value || '').trim()
  if (label && content) return `${label}. ${content}`
  if (content) return content
  if (label) return label
  return '-'
}

function buildOptionLookup(options = []) {
  const lookup = new Map()
  for (const option of Array.isArray(options) ? options : []) {
    const keys = [option?.id, option?.documentId, option?.value].map((item) => String(item || '').trim()).filter(Boolean)
    for (const key of keys) lookup.set(key, option)
  }
  return lookup
}

function renderCandidateAnswer(item) {
  const answerData = item?.candidateAnswer
  const answerText = String(item?.answerText || '').trim()
  const questionType = String(item?.questionType || '').trim()
  const optionLookup = buildOptionLookup(item?.options)

  if (questionType === 'essay' || questionType === 'short_answer') {
    return answerText || 'Chưa có câu trả lời'
  }

  if (questionType === 'single_choice' || questionType === 'multiple_choice' || questionType === 'true_false') {
    const selectedIds = Array.isArray(answerData?.selectedOptionIds) ? answerData.selectedOptionIds.map((value) => String(value || '').trim()).filter(Boolean) : []
    const selectedOptions = selectedIds.map((key) => optionLookup.get(key)).filter(Boolean)
    if (selectedOptions.length > 0) {
      return (
        <div className='d-grid gap-1'>
          {selectedOptions.map((option, index) => <div key={`${String(option?.id || option?.documentId || option?.value || index)}`}>{formatOptionText(option)}</div>)}
        </div>
      )
    }
  }

  if (questionType === 'fill_blank') {
    const blanks = Array.isArray(answerData?.blanks) ? answerData.blanks : Array.isArray(answerData?.answers) ? answerData.answers : []
    if (blanks.length > 0) {
      return (
        <div className='d-grid gap-1'>
          {blanks.map((value, index) => <div key={`blank-${index}`}>{`Ô ${index + 1}: ${String(value || '').trim() || '-'}`}</div>)}
        </div>
      )
    }
  }

  if (questionType === 'ordering') {
    const ordered = Array.isArray(answerData?.orderedOptionIds) ? answerData.orderedOptionIds : []
    if (ordered.length > 0) {
      return (
        <div className='d-grid gap-1'>
          {ordered.map((key, index) => <div key={`order-${index}`}>{`${index + 1}. ${formatOptionText(optionLookup.get(String(key || '').trim()))}`}</div>)}
        </div>
      )
    }
  }

  if (questionType === 'matching') {
    const pairs = Array.isArray(answerData?.pairs) ? answerData.pairs : []
    if (pairs.length > 0) {
      return (
        <div className='d-grid gap-1'>
          {pairs.map((pair, index) => {
            const left = formatOptionText(optionLookup.get(String(pair?.leftOptionId || '').trim()))
            const right = formatOptionText(optionLookup.get(String(pair?.rightOptionId || '').trim()))
            return <div key={`pair-${index}`}>{`${left} → ${right}`}</div>
          })}
        </div>
      )
    }
  }

  if (answerText) return answerText

  return (
    <details>
      <summary>Dữ liệu kỹ thuật</summary>
      <pre className='mb-0 mt-2 text-wrap'>{JSON.stringify(answerData || {}, null, 2)}</pre>
    </details>
  )
}

function compareCefrLevel(left, right) {
  return CEFR_LEVELS.indexOf(String(left || '').trim()) - CEFR_LEVELS.indexOf(String(right || '').trim())
}

function getAllowedLevels(versionConfig) {
  const fromIndex = versionConfig?.candidateLevelFrom ? Math.max(0, CEFR_LEVELS.indexOf(versionConfig.candidateLevelFrom)) : 0
  const toIndex = versionConfig?.candidateLevelTo ? CEFR_LEVELS.indexOf(versionConfig.candidateLevelTo) : CEFR_LEVELS.length - 1
  const ceilingIndex = versionConfig?.ceilingLevel ? CEFR_LEVELS.indexOf(versionConfig.ceilingLevel) : CEFR_LEVELS.length - 1
  const upperBound = Math.min(toIndex >= 0 ? toIndex : CEFR_LEVELS.length - 1, ceilingIndex >= 0 ? ceilingIndex : CEFR_LEVELS.length - 1)
  return CEFR_LEVELS.filter((_, index) => index >= fromIndex && index <= upperBound)
}

function getLevelComparisonMessage(provisionalLevel, speakingLevel) {
  if (!provisionalLevel || !speakingLevel) return ''
  const diff = compareCefrLevel(speakingLevel, provisionalLevel)
  if (diff === 0) return 'Hai kết quả nhất quán.'
  if (diff > 0) return 'Speaking đề xuất mức cao hơn kết quả online.'
  return 'Speaking đề xuất mức thấp hơn kết quả online.'
}

function buildCriteriaDraft(review) {
  const rows = Array.isArray(review?.criteriaScores) && review.criteriaScores.length > 0
    ? review.criteriaScores
    : Array.isArray(review?.criteriaSnapshot)
      ? review.criteriaSnapshot.map((item) => ({ ...item, score: '', note: '' }))
      : []
  return rows.map((item) => ({
    criterionCode: item?.criterionCode || item?.code || '',
    code: item?.criterionCode || item?.code || '',
    label: item?.label || '',
    description: item?.description || '',
    guidance: item?.guidance || '',
    order: Number(item?.order || 0),
    score: item?.score ?? '',
    maxScore: item?.maxScore ?? '',
    required: item?.required !== false,
    note: item?.note || '',
  }))
}

function summarizeSpeakingCriteria(criteriaScores = []) {
  const summary = (Array.isArray(criteriaScores) ? criteriaScores : []).reduce((acc, item) => {
    const score = item?.score === '' || item?.score === null || item?.score === undefined ? null : Number(item.score)
    const maxScore = Number(item?.maxScore || 0)
    return {
      scoredCount: acc.scoredCount + (score === null || Number.isNaN(score) ? 0 : 1),
      overallScore: acc.overallScore + (score === null || Number.isNaN(score) ? 0 : score),
      overallMaxScore: acc.overallMaxScore + maxScore,
    }
  }, { scoredCount: 0, overallScore: 0, overallMaxScore: 0 })
  return {
    ...summary,
    percentage: summary.scoredCount > 0 && summary.overallMaxScore > 0 ? Number(((summary.overallScore / summary.overallMaxScore) * 100).toFixed(2)) : null,
  }
}

function hasMissingRequiredCriteria(criteriaScores = []) {
  return (Array.isArray(criteriaScores) ? criteriaScores : []).some((item) => item?.required !== false && (item?.score === '' || item?.score === null || item?.score === undefined))
}

export default function AssessmentResultDetailPage() {
  const navigate = useNavigate()
  const { id } = useParams()
  const [searchParams, setSearchParams] = useSearchParams()
  const requestedTab = String(searchParams.get('tab') || '').trim()
  const activeTab = TABS.some((item) => item.key === requestedTab) ? requestedTab : 'overview'
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [payload, setPayload] = useState(null)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [drafts, setDrafts] = useState({})
  const [speakingDraft, setSpeakingDraft] = useState({ criteriaScores: [], promptNotes: '', reviewNotes: '', strengths: '', areasForImprovement: '', suggestedLevel: '' })
  const [confirmationDraft, setConfirmationDraft] = useState({ confirmedLevel: '', confirmedBandCode: '', confirmedLabel: '', confirmationNote: '' })
  const [candidatePreview, setCandidatePreview] = useState(null)
  const [previewLoading, setPreviewLoading] = useState(false)
  const [cancelModalVisible, setCancelModalVisible] = useState(false)
  const [cancelDraft, setCancelDraft] = useState({ cancelReason: 'admin_decision', cancelNote: '' })
  const [retakeDraft, setRetakeDraft] = useState({ retakeReason: 'admin_decision', retakeNote: '' })

  const result = payload?.result || null
  const versionConfig = payload?.versionConfig || null
  const speakingReview = payload?.speakingReview || null
  const placementConfirmation = payload?.placementConfirmation || null
  const reviewItems = payload?.reviewItems || []
  const manualItems = Array.isArray(payload?.manualScoringItems) && payload.manualScoringItems.length > 0
    ? payload.manualScoringItems
    : reviewItems.filter((item) => item?.manualScoreRequired === true && ['pending', 'manual_scored'].includes(String(item?.status || '').trim()))
  const sectionScores = Array.isArray(result?.sectionScores) ? result.sectionScores : []
  const historyRows = payload?.history || []
  const placementWarning = !payload?.placementContext?.hasActiveRules ? 'Chưa cấu hình quy tắc xếp mức.' : ''
  const allowedLevels = useMemo(() => getAllowedLevels(versionConfig), [versionConfig])
  const speakingSummaryPreview = useMemo(() => summarizeSpeakingCriteria(speakingDraft.criteriaScores), [speakingDraft.criteriaScores])

  useEffect(() => {
    loadDetail()
  }, [id])

  useEffect(() => {
    if (activeTab !== requestedTab) {
      const next = new URLSearchParams(searchParams)
      next.set('tab', activeTab)
      setSearchParams(next, { replace: true })
    }
  }, [activeTab, requestedTab, searchParams, setSearchParams])

  useEffect(() => {
    setDrafts(Object.fromEntries(manualItems.map((item) => [String(item.answerScoreId), { awardedPoints: item.awardedPoints ?? '', manualScoreNote: item.manualScoreNote || '' }])))
  }, [payload?.result?.id, manualItems.length])

  useEffect(() => {
    setSpeakingDraft({
      criteriaScores: buildCriteriaDraft(speakingReview),
      reviewMode: speakingReview?.reviewMode || 'live',
      promptNotes: speakingReview?.promptNotes || '',
      reviewNotes: speakingReview?.reviewNotes || '',
      strengths: speakingReview?.strengths || '',
      areasForImprovement: speakingReview?.areasForImprovement || '',
      suggestedLevel: speakingReview?.suggestedLevel || '',
    })
  }, [speakingReview?.id, speakingReview?.status])

  useEffect(() => {
    setConfirmationDraft({
      confirmedLevel: placementConfirmation?.confirmedLevel || speakingReview?.suggestedLevel || result?.provisionalLevel || '',
      confirmedBandCode: placementConfirmation?.confirmedBandCode || '',
      confirmedLabel: placementConfirmation?.confirmedLabel || '',
      confirmationNote: placementConfirmation?.confirmationNote || '',
    })
  }, [placementConfirmation?.id, speakingReview?.suggestedLevel, result?.provisionalLevel])

  useEffect(() => {
    if (activeTab !== 'candidate-preview' || !id) return
    loadCandidatePreview()
  }, [activeTab, id, payload?.result?.id, payload?.speakingReview?.id, payload?.placementConfirmation?.id])

  async function loadDetail(nextMessage = '') {
    setLoading(true)
    setError('')
    try {
      const detail = await getAssessmentResultDetail(id)
      setPayload(detail)
      if (nextMessage) setSuccess(nextMessage)
    } catch (requestError) {
      setPayload(null)
      setError(getApiMessage(requestError, 'Không tải được chi tiết kết quả đánh giá'))
    } finally {
      setLoading(false)
    }
  }

  async function loadCandidatePreview() {
    setPreviewLoading(true)
    try {
      const preview = await getAssessmentResultCandidatePreview(id)
      setCandidatePreview(preview)
    } catch (requestError) {
      setCandidatePreview(null)
      setError(getApiMessage(requestError, 'Không tải được bản xem trước giao diện thí sinh'))
    } finally {
      setPreviewLoading(false)
    }
  }

  async function handleSaveManual(item) {
    const draft = drafts[String(item.answerScoreId)] || {}
    setSaving(true)
    setError('')
    setSuccess('')
    try {
      await setManualAnswerScore(item.answerScoreId, { awardedPoints: draft.awardedPoints, manualScoreNote: draft.manualScoreNote })
      await loadDetail('Đã lưu điểm chấm thủ công và cập nhật kết quả')
    } catch (requestError) {
      setError(getApiMessage(requestError, 'Không lưu được điểm chấm thủ công'))
    } finally {
      setSaving(false)
    }
  }

  async function handleRecalculate() {
    if (!result?.id) return
    setSaving(true)
    setError('')
    setSuccess('')
    try {
      await recalculateAssessmentResult(result.id)
      await loadDetail('Đã tính lại kết quả hiện tại')
    } catch (requestError) {
      setError(getApiMessage(requestError, 'Không tính lại được kết quả'))
    } finally {
      setSaving(false)
    }
  }

  async function handleRescore() {
    if (!result?.attempt?.id) return
    if (!window.confirm('Hệ thống sẽ tạo một kết quả mới từ snapshot của bài làm. Kết quả hiện tại được giữ lại trong lịch sử.')) return
    setSaving(true)
    setError('')
    setSuccess('')
    try {
      const rescored = await rescoreAssessmentAttempt(result.attempt.id, { scoringVersion: result.scoringVersion || 1 })
      navigate(`/assessment-results/${rescored.id}`)
    } catch (requestError) {
      setError(getApiMessage(requestError, 'Không chấm lại được từ snapshot'))
    } finally {
      setSaving(false)
    }
  }

  async function handleCreateOrStartSpeaking() {
    if (!result?.id) return
    setSaving(true)
    setError('')
    setSuccess('')
    try {
      const review = speakingReview?.id ? speakingReview : await createSpeakingReviewForResult(result.id)
      if (review?.id && review?.status !== 'completed') {
        await startSpeakingReview(review.id)
      }
      await loadDetail('Đã khởi tạo đánh giá Speaking')
    } catch (requestError) {
      setError(getApiMessage(requestError, 'Không khởi tạo được đánh giá Speaking'))
    } finally {
      setSaving(false)
    }
  }

  async function handleSaveSpeakingDraft() {
    if (!speakingReview?.id) return
    setSaving(true)
    setError('')
    setSuccess('')
    try {
      await saveSpeakingReview(speakingReview.id, speakingDraft)
      await loadDetail('Đã lưu nháp đánh giá Speaking')
    } catch (requestError) {
      setError(getApiMessage(requestError, 'Không lưu được đánh giá Speaking'))
    } finally {
      setSaving(false)
    }
  }

  async function handleCompleteSpeaking() {
    if (!speakingReview?.id) return
    if (hasMissingRequiredCriteria(speakingDraft.criteriaScores)) {
      setError('Vui lòng chấm đầy đủ các tiêu chí bắt buộc trước khi hoàn thành.')
      return
    }
    if (!window.confirm('Bạn có chắc muốn hoàn thành đánh giá Speaking?\n\nSau khi hoàn thành, phiếu đánh giá sẽ chuyển sang chỉ đọc\nvà có thể được dùng để xác nhận mức xếp cuối cùng.')) return
    setSaving(true)
    setError('')
    setSuccess('')
    try {
      await completeSpeakingReview(speakingReview.id, speakingDraft)
      await loadDetail('Đã hoàn thành đánh giá Speaking')
    } catch (requestError) {
      setError(getApiMessage(requestError, 'Không hoàn thành được đánh giá Speaking'))
    } finally {
      setSaving(false)
    }
  }

  async function handleConfirmPlacement() {
    if (!result?.id) return
    if (!window.confirm('Kết quả này sẽ được ghi nhận là mức xếp chính thức. Kết quả sơ bộ và đánh giá Speaking vẫn được giữ trong lịch sử.')) return
    setSaving(true)
    setError('')
    setSuccess('')
    try {
      await confirmAssessmentPlacement(result.id, confirmationDraft)
      await loadDetail('Đã xác nhận mức xếp cuối cùng')
    } catch (requestError) {
      setError(getApiMessage(requestError, 'Không xác nhận được mức xếp'))
    } finally {
      setSaving(false)
    }
  }

  async function handleCancelAttempt() {
    if (!result?.attempt?.id) return
    if (cancelDraft.cancelReason === 'other' && !String(cancelDraft.cancelNote || '').trim()) {
      setError('Vui lòng nhập ghi chú khi chọn lý do Khác.')
      return
    }
    setSaving(true)
    setError('')
    setSuccess('')
    try {
      await cancelAssessmentCampaignAttempt(result.attempt.id, cancelDraft)
      setCancelModalVisible(false)
      await loadDetail('Đã hủy lượt làm bài. Dữ liệu vẫn được giữ trong lịch sử.')
    } catch (requestError) {
      setError(getCampaignApiMessage(requestError, 'Không hủy được lượt làm bài'))
    } finally {
      setSaving(false)
    }
  }

  async function handleAllowRetake() {
    if (!result?.attempt?.id) return
    if (retakeDraft.retakeReason === 'other' && !String(retakeDraft.retakeNote || '').trim()) {
      setError('Vui lòng nhập ghi chú khi chọn lý do Khác.')
      return
    }
    setSaving(true)
    setError('')
    setSuccess('')
    try {
      await allowAssessmentCampaignRetake(result.attempt.id, retakeDraft)
      await loadDetail('Đã cho phép thí sinh làm lại. Chưa tạo lượt làm mới cho đến khi thí sinh tự bắt đầu lại.')
    } catch (requestError) {
      setError(getCampaignApiMessage(requestError, 'Không cấp quyền làm lại được'))
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <div className='py-4 d-flex align-items-center gap-2'><CSpinner size='sm' /><span>Đang tải kết quả đánh giá...</span></div>
  if (!result) return <CAlert color='warning'>Không tìm thấy kết quả đánh giá.</CAlert>

  return (
    <>
      <CCard className='mb-4 ai-card'>
        <CCardHeader className='d-flex justify-content-between align-items-start gap-3 flex-wrap'>
          <div>
            <div className='d-flex align-items-center gap-2 flex-wrap mb-2'>
              <CButton color='secondary' variant='outline' size='sm' onClick={() => navigate('/assessment-results')}>Về danh sách</CButton>
              <CBadge color={getResultStatusBadgeColor(result.status)}>{getResultStatusLabel(result.status)}</CBadge>
              {placementConfirmation?.status === 'confirmed' ? <CBadge color={getPlacementConfirmationBadgeColor(placementConfirmation.status)}>Đã xác nhận</CBadge> : null}
              {result.isCurrent === false ? <CBadge color='secondary'>Đã thay thế</CBadge> : null}
              {Number(result.pendingManualCount || 0) > 0 ? <CBadge color='warning'>{`${result.pendingManualCount} câu chờ chấm`}</CBadge> : null}
              {result.provisionalLevel ? <CBadge color='success'>Sơ bộ</CBadge> : null}
            </div>
            <div className='fs-4 fw-semibold'>{payload?.candidate?.name || result.attempt?.candidateDisplayName || '-'}</div>
            <div className='text-body-secondary'>{`${result.assessment?.name || result.assessment?.code || '-'} · ${result.assessmentVersion?.code || '-'}`}</div>
            <div className='small text-body-secondary mt-2'>{`Mã lượt làm ${result.attempt?.code || '-'} · Nộp lúc ${formatDateTime(result.attempt?.submittedAt)}`}</div>
            {placementConfirmation?.confirmedLevel ? <div className='small text-body-secondary mt-2'>{`Mức xếp cuối: ${getCefrLabel(placementConfirmation.confirmedLevel)}`}</div> : null}
          </div>
          <div className='d-flex gap-2 flex-wrap'>
            {String(result.attempt?.status || '') !== 'cancelled' ? <CButton color='danger' variant='outline' onClick={() => setCancelModalVisible(true)} disabled={saving}>Hủy lượt làm</CButton> : <CButton color='warning' variant='outline' onClick={handleAllowRetake} disabled={saving}>Cho phép làm lại</CButton>}
            <CButton color='secondary' variant='outline' onClick={handleRecalculate} disabled={saving}>Tính lại kết quả</CButton>
            <CButton color='warning' variant='outline' onClick={handleRescore} disabled={saving}>Chấm lại từ snapshot</CButton>
          </div>
        </CCardHeader>
      </CCard>

      {success ? <CAlert color='success'>{success}</CAlert> : null}
      {error ? <CAlert color='danger'>{error}</CAlert> : null}
      {placementWarning ? <CAlert color='warning'>{placementWarning}</CAlert> : null}
      {String(result?.status || '') === 'cancelled' || String(result?.attempt?.status || '') === 'cancelled' ? <CAlert color='secondary'>Lượt làm này đã bị hủy. Kết quả này chỉ được lưu để tra cứu lịch sử và không còn hiệu lực.</CAlert> : null}

      <CNav variant='tabs' className='mb-4 flex-nowrap overflow-auto'>
        {TABS.map((tab) => (
          <CNavItem key={tab.key}><CNavLink active={tab.key === activeTab} href='#' onClick={(event) => { event.preventDefault(); const next = new URLSearchParams(searchParams); next.set('tab', tab.key); setSearchParams(next) }}>{tab.label}</CNavLink></CNavItem>
        ))}
      </CNav>

      {activeTab === 'overview' ? (
        <div className='d-grid gap-4'>
          <CRow className='g-3'>
            <CCol md={6} lg={4}><ScoreCard label='Điểm hiện tại' value={formatScorePair(result.rawScore, result.maxScore)} helper={Number(result.pendingManualCount || 0) > 0 ? `Chờ chấm: ${result.pendingManualCount} câu · tối đa ${result.pendingManualMaxScore ?? 0} điểm · Tổng điểm cấu hình: ${result.configuredTotalMaxScore ?? '-'}` : ''} /></CCol>
            <CCol md={6} lg={2}><ScoreCard label='Điểm tối đa đã chấm' value={String(result.maxScore ?? '-')} /></CCol>
            <CCol md={6} lg={2}><ScoreCard label='Tỷ lệ' value={result.percentage !== null && result.percentage !== undefined ? `${result.percentage}%` : '-'} /></CCol>
            <CCol md={6} lg={2}><ScoreCard label='Câu chờ chấm' value={String(result.pendingManualCount ?? 0)} /></CCol>
            <CCol md={6} lg={2}><ScoreCard label='Mức sơ bộ' value={result.provisionalLevel ? getCefrLabel(result.provisionalLevel) : '-'} helper={result.placementLabel || placementWarning || ''} /></CCol>
            <CCol md={6} lg={2}><ScoreCard label='Mức Speaking' value={speakingReview?.suggestedLevel ? getCefrLabel(speakingReview.suggestedLevel) : '-'} helper={speakingReview?.status ? getSpeakingReviewStatusLabel(speakingReview.status) : ''} /></CCol>
            <CCol md={6} lg={2}><ScoreCard label='Mức xác nhận' value={placementConfirmation?.confirmedLevel ? getCefrLabel(placementConfirmation.confirmedLevel) : '-'} helper={placementConfirmation?.status ? getPlacementConfirmationStatusLabel(placementConfirmation.status) : ''} /></CCol>
          </CRow>
          <CCard className='ai-card'>
            <CCardHeader><strong>Thông tin bổ sung</strong></CCardHeader>
            <CCardBody>
              <CRow className='g-3'>
                <CCol md={6}><div><strong>Assessment:</strong> {result.assessment?.name || result.assessment?.code || '-'}</div></CCol>
                <CCol md={6}><div><strong>Version:</strong> {result.assessmentVersion?.code || '-'}</div></CCol>
                <CCol md={6}><div><strong>Attempt:</strong> {result.attempt?.code || '-'}</div></CCol>
                <CCol md={6}><div><strong>Started:</strong> {formatDateTime(result.attempt?.startedAt)}</div></CCol>
                <CCol md={6}><div><strong>Submitted:</strong> {formatDateTime(result.attempt?.submittedAt)}</div></CCol>
                <CCol md={6}><div><strong>Scored at:</strong> {formatDateTime(result.scoredAt)}</div></CCol>
                <CCol md={6}><div><strong>Scoring version:</strong> {result.scoringVersion || 1}</div></CCol>
                <CCol md={6}><div><strong>Result mode:</strong> {result.resultMode || '-'}</div></CCol>
                {String(result?.attempt?.status || '') === 'cancelled' ? <CCol md={6}><div><strong>Cancelled at:</strong> {formatDateTime(result.attempt?.cancelledAt)}</div></CCol> : null}
                {String(result?.attempt?.status || '') === 'cancelled' ? <CCol md={6}><div><strong>Cancelled by:</strong> {result.attempt?.cancelledBy?.fullName || result.attempt?.cancelledBy?.username || result.attempt?.cancelledBy?.email || '-'}</div></CCol> : null}
                {String(result?.attempt?.status || '') === 'cancelled' ? <CCol md={6}><div><strong>Reason:</strong> {result.attempt?.cancelReason || '-'}</div></CCol> : null}
                {String(result?.attempt?.status || '') === 'cancelled' ? <CCol md={12}><div><strong>Note:</strong> {result.attempt?.cancelNote || '-'}</div></CCol> : null}
              </CRow>
            </CCardBody>
          </CCard>
          <CCard className='ai-card'>
            <CCardHeader><strong>Phân tích theo phần</strong></CCardHeader>
            <CCardBody>
              <div className='d-grid gap-3'>
                {sectionScores.map((item) => (
                  <div key={item.sectionCode} className='d-flex justify-content-between align-items-center border rounded-3 p-3 gap-3'>
                    <div className='fw-semibold'>{item.title || item.sectionCode}</div>
                    <div className='text-body-secondary'>{Number(item.pendingCount || 0) > 0 ? 'Chờ chấm' : formatScorePair(item.rawScore, item.maxScore)}</div>
                  </div>
                ))}
              </div>
            </CCardBody>
          </CCard>
        </div>
      ) : null}

      {activeTab === 'breakdown' ? (
        <CCard className='ai-card'>
          <CCardHeader><strong>Chi tiết điểm</strong></CCardHeader>
          <CCardBody>
            <CTable responsive hover align='middle'>
              <CTableHead><CTableRow><CTableHeaderCell>Mã câu</CTableHeaderCell><CTableHeaderCell>Loại</CTableHeaderCell><CTableHeaderCell>Trạng thái chấm</CTableHeaderCell><CTableHeaderCell>Điểm</CTableHeaderCell><CTableHeaderCell>Phương thức</CTableHeaderCell></CTableRow></CTableHead>
              <CTableBody>
                {reviewItems.map((item) => (
                  <CTableRow key={`${item.answerScoreId}-${item.assessmentQuestionId}`}>
                    <CTableDataCell>{item.questionCode}</CTableDataCell>
                    <CTableDataCell>{getQuestionTypeLabel(item.questionType)}</CTableDataCell>
                    <CTableDataCell><CBadge color={getAnswerScoreStatusBadgeColor(item.status)}>{getAnswerScoreStatusLabel(item.status)}</CBadge></CTableDataCell>
                    <CTableDataCell>{item.awardedPoints === null || item.awardedPoints === undefined ? `- / ${item.maxPoints ?? '-'}` : `${item.awardedPoints} / ${item.maxPoints ?? '-'}`}</CTableDataCell>
                    <CTableDataCell>{getScoringMethodLabel(item.scoringMethod)}</CTableDataCell>
                  </CTableRow>
                ))}
              </CTableBody>
            </CTable>
          </CCardBody>
        </CCard>
      ) : null}

      {activeTab === 'answers' ? (
        <div className='d-grid gap-3'>
          {reviewItems.map((item) => (
            <CCard key={`answer-${item.assessmentQuestionId}`} className='ai-card'>
              <CCardHeader className='d-flex justify-content-between align-items-center gap-3 flex-wrap'>
                <div><strong>{item.sectionTitle || item.sectionCode} · {item.questionCode}</strong><div className='small text-body-secondary'>{getQuestionTypeLabel(item.questionType)}</div></div>
                <CBadge color={getAnswerScoreStatusBadgeColor(item.status)}>{getAnswerScoreStatusLabel(item.status)}</CBadge>
              </CCardHeader>
              <CCardBody>
                <div className='mb-3'><strong>Câu hỏi:</strong> {item.questionPrompt || '-'}</div>
                {item.stimulus?.instruction || item.stimulus?.content ? <div className='small text-body-secondary mb-3'>{item.stimulus?.instruction || item.stimulus?.content}</div> : null}
                <div className='mb-3'><strong>Bài làm:</strong></div>
                <div className='border rounded-3 p-3 bg-body-tertiary text-break'>{renderCandidateAnswer(item)}</div>
                <div className='small text-body-secondary mt-3'>Điểm: {item.awardedPoints === null || item.awardedPoints === undefined ? `- / ${item.maxPoints ?? '-'}` : `${item.awardedPoints} / ${item.maxPoints ?? '-'}`}</div>
                {item.isCorrect === true ? <div className='small text-success mt-1'>Đúng</div> : null}
                {item.isCorrect === false ? <div className='small text-danger mt-1'>Sai</div> : null}
                <div className='small text-body-secondary mt-1'>Phương thức chấm: {getScoringMethodLabel(item.scoringMethod)}</div>
              </CCardBody>
            </CCard>
          ))}
        </div>
      ) : null}

      {activeTab === 'manual' ? (
        <div className='d-grid gap-3'>
          {manualItems.length === 0 ? <CAlert color='info'>Không có câu hỏi nào đang chờ chấm thủ công.</CAlert> : manualItems.map((item) => {
            const draft = drafts[String(item.answerScoreId)] || { awardedPoints: item.awardedPoints ?? '', manualScoreNote: item.manualScoreNote || '' }
            return (
              <CCard key={`manual-${item.answerScoreId}`} className='ai-card'>
                <CCardHeader className='d-flex justify-content-between align-items-center gap-3 flex-wrap'>
                  <div><strong>{item.sectionTitle || item.sectionCode} · {item.questionCode}</strong><div className='small text-body-secondary'>{getQuestionTypeLabel(item.questionType)}</div></div>
                  <CBadge color={getAnswerScoreStatusBadgeColor(item.status)}>{getAnswerScoreStatusLabel(item.status)}</CBadge>
                </CCardHeader>
                <CCardBody>
                  <CRow className='g-3'>
                    <CCol lg={8}>
                      <div className='mb-2'><strong>Đề bài</strong></div>
                      <div className='mb-3'>{item.questionPrompt || '-'}</div>
                      {item.stimulus?.instruction || item.stimulus?.content ? <div className='small text-body-secondary mb-3'>{item.stimulus?.instruction || item.stimulus?.content}</div> : null}
                      <div className='mb-2'><strong>Bài làm của thí sinh</strong></div>
                      <div className='border rounded-3 p-3 bg-body-tertiary text-break'>{renderCandidateAnswer(item)}</div>
                    </CCol>
                    <CCol lg={4}>
                      <div className='small text-body-secondary mb-2'>Số từ: {item.wordCount || 0}</div>
                      {(item.minWords || item.maxWords) ? <div className='small text-body-secondary mb-2'>Yêu cầu: {item.minWords ?? 0}–{item.maxWords ?? 0} từ</div> : null}
                      <div className='small text-body-secondary mb-3'>Tối đa: {item.maxPoints ?? '-'}</div>
                      <CFormLabel>Điểm</CFormLabel>
                      <CFormInput type='number' step='0.01' value={draft.awardedPoints} onChange={(event) => setDrafts((prev) => ({ ...prev, [String(item.answerScoreId)]: { ...prev[String(item.answerScoreId)], awardedPoints: event.target.value } }))} />
                      <CFormLabel className='mt-3'>Nhận xét nội bộ</CFormLabel>
                      <CFormTextarea rows={5} value={draft.manualScoreNote} onChange={(event) => setDrafts((prev) => ({ ...prev, [String(item.answerScoreId)]: { ...prev[String(item.answerScoreId)], manualScoreNote: event.target.value } }))} />
                      <div className='d-grid mt-3'><CButton color='primary' onClick={() => handleSaveManual(item)} disabled={saving}>Lưu điểm</CButton></div>
                    </CCol>
                  </CRow>
                </CCardBody>
              </CCard>
            )
          })}
        </div>
      ) : null}

      {activeTab === 'speaking' ? (
        versionConfig?.requiresSpeaking === false ? <CAlert color='info'>Bài đánh giá này không yêu cầu Speaking.</CAlert> : !speakingReview ? (
          <CCard className='ai-card'>
            <CCardHeader><strong>Đánh giá Speaking</strong></CCardHeader>
            <CCardBody>
              <div className='mb-3'>Chưa thực hiện đánh giá Speaking.</div>
              <CButton color='primary' onClick={handleCreateOrStartSpeaking} disabled={saving}>Bắt đầu đánh giá Speaking</CButton>
            </CCardBody>
          </CCard>
        ) : (
          <div className='d-grid gap-4'>
            <CCard className='ai-card'>
              <CCardHeader className='d-flex justify-content-between align-items-center gap-2 flex-wrap'>
                <div>
                  <strong>Đánh giá Speaking</strong>
                  <div className='small text-body-secondary'>{`${payload?.candidate?.name || '-'} · ${result.assessment?.name || result.assessment?.code || '-'}`}</div>
                </div>
                <CBadge color={getAnswerScoreStatusBadgeColor(speakingReview.status === 'completed' ? 'manual_scored' : speakingReview.status === 'in_review' ? 'pending' : 'not_scored')}>{getSpeakingReviewStatusLabel(speakingReview.status)}</CBadge>
              </CCardHeader>
              <CCardBody>
                <div className='small text-body-secondary mb-2'>{`Mức sơ bộ online: ${result.provisionalLevel ? getCefrLabel(result.provisionalLevel) : '-'}`}</div>
                <div className='small text-body-secondary mb-3'>{`${payload?.candidate?.name || '-'} · ${result.assessmentVersion?.code || '-'} · Nộp lúc ${formatDateTime(result.attempt?.submittedAt)}`}</div>
                <CRow className='g-3'>
                  <CCol md={6} lg={4}>
                    <ScoreCard label='Tổng điểm Speaking' value={`${speakingSummaryPreview.overallScore}/${speakingSummaryPreview.overallMaxScore || 0}`} helper={speakingSummaryPreview.percentage !== null ? `${speakingSummaryPreview.percentage}%` : 'Chưa đủ dữ liệu để tính tỷ lệ'} />
                  </CCol>
                  <CCol md={6} lg={4}>
                    <ScoreCard label='Mức Speaking đề xuất' value={speakingDraft.suggestedLevel ? getCefrLabel(speakingDraft.suggestedLevel) : '-'} helper={getLevelComparisonMessage(result.provisionalLevel, speakingDraft.suggestedLevel)} />
                  </CCol>
                  <CCol md={6} lg={4}>
                    <div className='border rounded-3 p-3 h-100'>
                      <div className='small text-body-secondary mb-1'>Hình thức đánh giá</div>
                      <CFormSelect value={speakingDraft.reviewMode || 'live'} disabled={saving || speakingReview.status === 'completed'} onChange={(event) => setSpeakingDraft((prev) => ({ ...prev, reviewMode: event.target.value }))}>
                        {REVIEW_MODE_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                      </CFormSelect>
                    </div>
                  </CCol>
                  {speakingDraft.reviewMode === 'recording' ? (
                    <CCol xs={12}>
                      <div className='border rounded-3 p-3'>
                        <div className='fw-semibold mb-2'>Bản ghi Speaking</div>
                        {speakingReview?.recordingAsset?.url ? <audio controls className='w-100' src={getFileAssetUrl(speakingReview.recordingAsset)} /> : <div className='small text-body-secondary'>Không có bản ghi được lưu trong hệ thống.</div>}
                      </div>
                    </CCol>
                  ) : null}
                  {speakingDraft.criteriaScores.map((criterion, index) => (
                    <CCol md={6} key={`${criterion.code || index}`}>
                      <div className='border rounded-3 p-3 h-100'>
                        <div className='d-flex justify-content-between align-items-start gap-2 mb-2'>
                          <div className='fw-semibold'>{criterion.label || criterion.code}</div>
                          {criterion.required !== false ? <CBadge color='warning'>Bắt buộc</CBadge> : <CBadge color='secondary'>Tùy chọn</CBadge>}
                        </div>
                        {criterion.description ? <div className='small text-body-secondary mb-2'>{criterion.description}</div> : null}
                        {criterion.guidance ? <div className='small text-body-secondary mb-2'>{criterion.guidance}</div> : null}
                        <CFormLabel>{`Điểm / ${criterion.maxScore ?? '-'}`}</CFormLabel>
                        <CFormInput
                          type='number'
                          step='0.01'
                          value={criterion.score}
                          disabled={saving || speakingReview.status === 'completed'}
                          onChange={(event) => setSpeakingDraft((prev) => ({
                            ...prev,
                            criteriaScores: prev.criteriaScores.map((item, itemIndex) => itemIndex === index ? { ...item, score: event.target.value } : item),
                          }))}
                        />
                        <CFormLabel className='mt-3'>Nhận xét tiêu chí</CFormLabel>
                        <CFormTextarea rows={3} value={criterion.note || ''} disabled={saving || speakingReview.status === 'completed'} onChange={(event) => setSpeakingDraft((prev) => ({
                          ...prev,
                          criteriaScores: prev.criteriaScores.map((item, itemIndex) => itemIndex === index ? { ...item, note: event.target.value } : item),
                        }))} />
                      </div>
                    </CCol>
                  ))}
                  <CCol md={6}><CFormLabel>Mức đề xuất</CFormLabel><CFormSelect value={speakingDraft.suggestedLevel} disabled={saving || speakingReview.status === 'completed'} onChange={(event) => setSpeakingDraft((prev) => ({ ...prev, suggestedLevel: event.target.value }))}><option value=''>Chưa chọn</option>{allowedLevels.map((item) => <option key={item} value={item}>{getCefrLabel(item)}</option>)}</CFormSelect></CCol>
                  <CCol md={6}><CFormLabel>Ghi chú nội dung/phỏng vấn</CFormLabel><CFormTextarea rows={3} value={speakingDraft.promptNotes} disabled={saving || speakingReview.status === 'completed'} onChange={(event) => setSpeakingDraft((prev) => ({ ...prev, promptNotes: event.target.value }))} /></CCol>
                  <CCol md={6}><CFormLabel>Điểm mạnh</CFormLabel><CFormTextarea rows={3} value={speakingDraft.strengths} disabled={saving || speakingReview.status === 'completed'} onChange={(event) => setSpeakingDraft((prev) => ({ ...prev, strengths: event.target.value }))} /></CCol>
                  <CCol md={6}><CFormLabel>Điểm cần cải thiện</CFormLabel><CFormTextarea rows={3} value={speakingDraft.areasForImprovement} disabled={saving || speakingReview.status === 'completed'} onChange={(event) => setSpeakingDraft((prev) => ({ ...prev, areasForImprovement: event.target.value }))} /></CCol>
                  <CCol md={12}><CFormLabel>Nhận xét chung</CFormLabel><CFormTextarea rows={4} value={speakingDraft.reviewNotes} disabled={saving || speakingReview.status === 'completed'} onChange={(event) => setSpeakingDraft((prev) => ({ ...prev, reviewNotes: event.target.value }))} /></CCol>
                </CRow>
                <div className='small text-body-secondary mt-3'>{`Người đánh giá: ${speakingReview?.reviewer?.fullName || '-'} · Bắt đầu lúc: ${formatDateTime(speakingReview?.reviewStartedAt)} · Hoàn thành lúc: ${formatDateTime(speakingReview?.reviewedAt)}`}</div>
                {speakingReview.status !== 'completed' ? (
                  <div className='d-flex gap-2 flex-wrap mt-3'>
                    <CButton color='secondary' variant='outline' onClick={handleSaveSpeakingDraft} disabled={saving}>Lưu nháp</CButton>
                    <CButton color='primary' onClick={handleCompleteSpeaking} disabled={saving}>Hoàn thành đánh giá</CButton>
                  </div>
                ) : null}
              </CCardBody>
            </CCard>
          </div>
        )
      ) : null}

      {activeTab === 'confirmation' ? (
        <div className='d-grid gap-4'>
          <CCard className='ai-card'>
            <CCardHeader><strong>Xác nhận xếp mức</strong></CCardHeader>
            <CCardBody>
              <CRow className='g-3 mb-3'>
                <CCol md={4}><ScoreCard label='Online sơ bộ' value={result.provisionalLevel ? getCefrLabel(result.provisionalLevel) : '-'} helper={result.placementLabel || ''} /></CCol>
                <CCol md={4}><ScoreCard label='Speaking đề xuất' value={speakingReview?.suggestedLevel ? getCefrLabel(speakingReview.suggestedLevel) : '-'} helper={getLevelComparisonMessage(result.provisionalLevel, speakingReview?.suggestedLevel)} /></CCol>
                <CCol md={4}><ScoreCard label='Mức giáo viên xác nhận' value={placementConfirmation?.confirmedLevel ? getCefrLabel(placementConfirmation.confirmedLevel) : '-'} helper={placementConfirmation?.status ? getPlacementConfirmationStatusLabel(placementConfirmation.status) : ''} /></CCol>
              </CRow>
              {versionConfig?.requiresSpeaking !== false && speakingReview?.status !== 'completed' ? <CAlert color='warning'>Cần hoàn thành Speaking Review trước khi xác nhận mức xếp.</CAlert> : null}
              <CRow className='g-3'>
                <CCol md={4}><CFormLabel>Mức xếp cuối cùng</CFormLabel><CFormSelect value={confirmationDraft.confirmedLevel} disabled={saving || placementConfirmation?.status === 'confirmed'} onChange={(event) => setConfirmationDraft((prev) => ({ ...prev, confirmedLevel: event.target.value }))}><option value=''>Chọn mức</option>{allowedLevels.map((item) => <option key={item} value={item}>{getCefrLabel(item)}</option>)}</CFormSelect></CCol>
                <CCol md={4}><CFormLabel>Nhãn</CFormLabel><CFormInput value={confirmationDraft.confirmedLabel} disabled={saving || placementConfirmation?.status === 'confirmed'} onChange={(event) => setConfirmationDraft((prev) => ({ ...prev, confirmedLabel: event.target.value }))} /></CCol>
                <CCol md={4}><CFormLabel>Band code</CFormLabel><CFormInput value={confirmationDraft.confirmedBandCode} disabled={saving || placementConfirmation?.status === 'confirmed'} onChange={(event) => setConfirmationDraft((prev) => ({ ...prev, confirmedBandCode: event.target.value }))} /></CCol>
                <CCol md={12}><CFormLabel>Ghi chú xác nhận</CFormLabel><CFormTextarea rows={4} value={confirmationDraft.confirmationNote} disabled={saving || placementConfirmation?.status === 'confirmed'} onChange={(event) => setConfirmationDraft((prev) => ({ ...prev, confirmationNote: event.target.value }))} /></CCol>
              </CRow>
              <div className='small text-body-secondary mt-3'>{`Người xác nhận: ${placementConfirmation?.confirmedBy?.fullName || '-'} · Xác nhận lúc: ${formatDateTime(placementConfirmation?.confirmedAt)}`}</div>
              {placementConfirmation?.status !== 'confirmed' ? <div className='mt-3'><CButton color='primary' onClick={handleConfirmPlacement} disabled={saving}>Xác nhận mức xếp</CButton></div> : null}
            </CCardBody>
          </CCard>
          {Array.isArray(payload?.placementConfirmationHistory) && payload.placementConfirmationHistory.length > 0 ? (
            <CCard className='ai-card'>
              <CCardHeader><strong>Lịch sử xác nhận</strong></CCardHeader>
              <CCardBody>
                <CTable responsive hover align='middle'>
                  <CTableHead><CTableRow><CTableHeaderCell>Thời điểm</CTableHeaderCell><CTableHeaderCell>Trạng thái</CTableHeaderCell><CTableHeaderCell>Mức xác nhận</CTableHeaderCell><CTableHeaderCell>Người xác nhận</CTableHeaderCell></CTableRow></CTableHead>
                  <CTableBody>
                    {payload.placementConfirmationHistory.map((item) => (
                      <CTableRow key={item.id}>
                        <CTableDataCell>{formatDateTime(item.confirmedAt)}</CTableDataCell>
                        <CTableDataCell><CBadge color={getPlacementConfirmationBadgeColor(item.status)}>{getPlacementConfirmationStatusLabel(item.status)}</CBadge></CTableDataCell>
                        <CTableDataCell>{item.confirmedLevel ? getCefrLabel(item.confirmedLevel) : '-'}</CTableDataCell>
                        <CTableDataCell>{item.confirmedBy?.fullName || '-'}</CTableDataCell>
                      </CTableRow>
                    ))}
                  </CTableBody>
                </CTable>
              </CCardBody>
            </CCard>
          ) : null}
        </div>
      ) : null}

      {activeTab === 'candidate-preview' ? (
        <CCard className='ai-card'>
          <CCardHeader className='d-flex justify-content-between align-items-center gap-2 flex-wrap'>
            <div>
              <strong>Góc nhìn thí sinh</strong>
              <div className='small text-body-secondary'>Bản xem trước giao diện kết quả dành cho thí sinh từ candidate-safe view model.</div>
            </div>
            <CButton color='secondary' variant='outline' onClick={loadCandidatePreview} disabled={previewLoading}>{previewLoading ? 'Đang làm mới...' : 'Làm mới bản xem trước'}</CButton>
          </CCardHeader>
          <CCardBody>
            {previewLoading && !candidatePreview ? <div className='d-flex align-items-center gap-2'><CSpinner size='sm' /><span>Đang tải bản xem trước...</span></div> : candidatePreview ? <CandidateAssessmentResultView payload={candidatePreview} previewMode refreshing={previewLoading} onRefresh={loadCandidatePreview} /> : <CAlert color='warning'>Không tải được bản xem trước giao diện thí sinh.</CAlert>}
          </CCardBody>
        </CCard>
      ) : null}

      {activeTab === 'history' ? (
        <CCard className='ai-card'>
          <CCardHeader><strong>Lịch sử</strong></CCardHeader>
          <CCardBody>
            <CTable responsive hover align='middle'>
              <CTableHead><CTableRow><CTableHeaderCell>Mã kết quả</CTableHeaderCell><CTableHeaderCell>Phiên bản chấm</CTableHeaderCell><CTableHeaderCell>Thời điểm</CTableHeaderCell><CTableHeaderCell>Trạng thái</CTableHeaderCell><CTableHeaderCell>Điểm</CTableHeaderCell><CTableHeaderCell>Mức</CTableHeaderCell><CTableHeaderCell>Hiện tại</CTableHeaderCell></CTableRow></CTableHead>
              <CTableBody>
                {historyRows.map((item) => (
                  <CTableRow key={item.id}>
                    <CTableDataCell>{item.code}</CTableDataCell>
                    <CTableDataCell>{item.scoringVersion}</CTableDataCell>
                    <CTableDataCell>{formatDateTime(item.scoredAt || item.createdAt)}</CTableDataCell>
                    <CTableDataCell><CBadge color={getResultStatusBadgeColor(item.status)}>{getResultStatusLabel(item.status)}</CBadge></CTableDataCell>
                    <CTableDataCell>{formatScorePair(item.rawScore, item.maxScore)}</CTableDataCell>
                    <CTableDataCell>{item.provisionalLevel ? getCefrLabel(item.provisionalLevel) : '-'}</CTableDataCell>
                    <CTableDataCell>{item.isCurrent ? 'Hiện tại' : '-'}</CTableDataCell>
                  </CTableRow>
                ))}
              </CTableBody>
            </CTable>
          </CCardBody>
        </CCard>
      ) : null}

      <CModal visible={cancelModalVisible} backdrop='static' onClose={() => { if (!saving) setCancelModalVisible(false) }}>
        <CModalHeader><CModalTitle>Hủy lượt làm</CModalTitle></CModalHeader>
        <CModalBody>
          <CAlert color='warning'>Lượt làm sẽ không còn được tính là kết quả hợp lệ. Dữ liệu bài làm vẫn được lưu để tra cứu lịch sử.</CAlert>
          <CFormLabel>Lý do</CFormLabel>
          <CFormSelect value={cancelDraft.cancelReason} onChange={(event) => setCancelDraft((prev) => ({ ...prev, cancelReason: event.target.value }))}>
            {CANCEL_REASON_OPTIONS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
          </CFormSelect>
          <CFormLabel className='mt-3'>Ghi chú</CFormLabel>
          <CFormTextarea rows={4} value={cancelDraft.cancelNote} onChange={(event) => setCancelDraft((prev) => ({ ...prev, cancelNote: event.target.value }))} />
        </CModalBody>
        <CModalFooter>
          <CButton color='secondary' variant='outline' onClick={() => setCancelModalVisible(false)} disabled={saving}>Đóng</CButton>
          <CButton color='danger' onClick={handleCancelAttempt} disabled={saving}>Xác nhận hủy</CButton>
        </CModalFooter>
      </CModal>
    </>
  )
}