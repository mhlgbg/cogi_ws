import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  CAlert,
  CButton,
  CCard,
  CCardBody,
  CCardHeader,
  CCol,
  CForm,
  CModal,
  CModalBody,
  CModalFooter,
  CModalHeader,
  CModalTitle,
  CProgress,
  CProgressBar,
  CRow,
  CSpinner,
  CToast,
  CToastBody,
  CToaster,
} from '@coreui/react'
import SurveySection from '../components/SurveySection'
import { getSurveyAssignmentDetail, saveSurveyDraft, submitSurvey } from '../services/surveyService'

function getApiMessage(error, fallback) {
  return error?.response?.data?.error?.message || error?.response?.data?.message || error?.message || fallback
}

function isQuestionAnswered(question, answer) {
  if (!question) return false
  const value = String(answer?.value || '').trim()
  const text = String(answer?.text || '').trim()
  if (question.type === 'TEXT') return Boolean(text)
  return Boolean(value)
}

function flattenQuestions(template) {
  const rows = []
  for (const section of template?.sections || []) {
    for (const question of section?.questions || []) {
      rows.push(question)
    }
  }
  return rows
}

function formatMetaLabel(label, identifier, name) {
  const safeId = String(identifier || '').trim()
  const safeName = String(name || '').trim()
  if (!safeId && !safeName) return ''
  if (safeId && safeName) return `${label}: ${safeId} - ${safeName}`
  return `${label}: ${safeId || safeName}`
}

export default function SurveyForm() {
  const navigate = useNavigate()
  const { assignmentId } = useParams()
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [showStickyHeader, setShowStickyHeader] = useState(false)
  const [error, setError] = useState('')
  const [detail, setDetail] = useState(null)
  const [answers, setAnswers] = useState({})
  const [invalidQuestionIds, setInvalidQuestionIds] = useState(new Set())
  const [showConfirmModal, setShowConfirmModal] = useState(false)
  const [showSuccessToast, setShowSuccessToast] = useState(false)
  const [savingDraft, setSavingDraft] = useState(false)
  const [draftSavedAt, setDraftSavedAt] = useState('')
  const [hasAutoSaveStarted, setHasAutoSaveStarted] = useState(false)
  const hydratedPayloadRef = useRef('')

  useEffect(() => {
    let mounted = true

    async function load() {
      setLoading(true)
      setError('')

      try {
        const data = await getSurveyAssignmentDetail(assignmentId)
        if (!mounted) return

        setDetail(data)
        const hydratedAnswers = {}
        for (const answer of data?.draftResponse?.answers || []) {
          if (!answer?.questionId) continue
          hydratedAnswers[answer.questionId] = {
            value: String(answer?.value || ''),
            text: String(answer?.text || ''),
          }
        }

        setAnswers(hydratedAnswers)
        setInvalidQuestionIds(new Set())
        hydratedPayloadRef.current = JSON.stringify(
          Object.entries(hydratedAnswers)
            .sort(([left], [right]) => Number(left) - Number(right))
            .map(([questionId, answer]) => ({
              questionId: Number(questionId),
              value: String(answer?.value || ''),
              text: String(answer?.text || ''),
            })),
        )
        setDraftSavedAt(data?.draftResponse?.submittedAt || '')
        setHasAutoSaveStarted(false)
      } catch (loadError) {
        if (!mounted) return
        setDetail(null)
        setError(getApiMessage(loadError, 'Không tải được nội dung khảo sát'))
      } finally {
        if (mounted) setLoading(false)
      }
    }

    load()
    return () => {
      mounted = false
    }
  }, [assignmentId])

  const allQuestions = useMemo(() => flattenQuestions(detail?.template), [detail?.template])

  const answeredCount = useMemo(
    () => allQuestions.filter((question) => isQuestionAnswered(question, answers[question.id])).length,
    [allQuestions, answers],
  )

  const totalQuestions = allQuestions.length
  const progressValue = totalQuestions > 0 ? Math.round((answeredCount / totalQuestions) * 100) : 0
  const isCompleted = Boolean(detail?.assignment?.isCompleted)
  const courseMetaLabel = formatMetaLabel('Môn học', detail?.assignment?.courseId, detail?.assignment?.courseName)
  const lecturerMetaLabel = formatMetaLabel('Giảng viên', detail?.assignment?.lecturerId, detail?.assignment?.lecturerName)

  useEffect(() => {
    function handleScroll() {
      setShowStickyHeader(window.scrollY > 140)
    }

    handleScroll()
    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => {
      window.removeEventListener('scroll', handleScroll)
    }
  }, [])

  function handleAnswerChange(questionId, nextAnswer) {
    setAnswers((prev) => ({
      ...prev,
      [questionId]: {
        value: String(nextAnswer?.value || ''),
        text: String(nextAnswer?.text || ''),
      },
    }))

    setInvalidQuestionIds((prev) => {
      if (!prev.has(questionId)) return prev
      const next = new Set(prev)
      next.delete(questionId)
      return next
    })
  }

  function scrollToQuestion(questionId) {
    const target = document.getElementById(`survey-question-${questionId}`)
    if (!target) return
    target.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }

  function validateBeforeSubmit() {
    const nextInvalidIds = []

    for (const question of allQuestions) {
      if (!question?.isRequired) continue
      if (!isQuestionAnswered(question, answers[question.id])) {
        nextInvalidIds.push(question.id)
      }
    }

    const invalidSet = new Set(nextInvalidIds)
    setInvalidQuestionIds(invalidSet)

    if (nextInvalidIds.length > 0) {
      scrollToQuestion(nextInvalidIds[0])
      setError('Vui lòng trả lời đầy đủ các câu hỏi bắt buộc trước khi nộp.')
      return false
    }

    setError('')
    return true
  }

  function buildSubmitPayload() {
    return allQuestions
      .filter((question) => isQuestionAnswered(question, answers[question.id]))
      .map((question) => ({
        questionId: question.id,
        value: String(answers[question.id]?.value || ''),
        text: String(answers[question.id]?.text || ''),
      }))
  }

  const draftPayload = useMemo(
    () => allQuestions.map((question) => ({
      questionId: question.id,
      value: String(answers[question.id]?.value || ''),
      text: String(answers[question.id]?.text || ''),
    })),
    [allQuestions, answers],
  )

  useEffect(() => {
    if (loading || !detail?.template || isCompleted || submitting) return undefined

    const nextPayloadSignature = JSON.stringify(draftPayload)
    if (nextPayloadSignature === hydratedPayloadRef.current) return undefined

    const timer = window.setTimeout(async () => {
      if (savingDraft) return

      setSavingDraft(true)
      setError('')

      try {
        const saved = await saveSurveyDraft(Number(assignmentId), draftPayload)
        hydratedPayloadRef.current = nextPayloadSignature
        setDraftSavedAt(saved?.savedAt || new Date().toISOString())
        setHasAutoSaveStarted(true)
      } catch (saveError) {
        setError(getApiMessage(saveError, 'Không thể lưu tạm khảo sát'))
      } finally {
        setSavingDraft(false)
      }
    }, 800)

    return () => {
      window.clearTimeout(timer)
    }
  }, [assignmentId, detail?.template, draftPayload, isCompleted, loading, savingDraft, submitting])

  function formatSavedTime(value) {
    if (!value) return ''
    const date = new Date(value)
    if (Number.isNaN(date.getTime())) return ''
    return date.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })
  }

  function onOpenConfirm() {
    if (isCompleted || submitting) return
    if (!validateBeforeSubmit()) return
    setShowConfirmModal(true)
  }

  async function onConfirmSubmit() {
    setSubmitting(true)
    setError('')

    try {
      await submitSurvey(Number(assignmentId), buildSubmitPayload())
      setShowConfirmModal(false)
      setShowSuccessToast(true)
      setTimeout(() => {
        navigate('/survey')
      }, 900)
    } catch (submitError) {
      setError(getApiMessage(submitError, 'Không thể nộp khảo sát'))
      setShowConfirmModal(false)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className='container-fluid py-4'>
      {!loading && detail?.template && showStickyHeader ? (
        <div
          style={{
            position: 'fixed',
            top: 'calc(var(--cui-header-height, 0px) + 0.75rem)',
            left: '50%',
            transform: 'translateX(-50%)',
            width: 'min(1280px, calc(100vw - 2rem))',
            zIndex: 1030,
            pointerEvents: 'none',
          }}
        >
          <CCard
            className='shadow-sm border-0'
            style={{
              pointerEvents: 'auto',
              background: 'rgba(255, 255, 255, 0.96)',
              backdropFilter: 'blur(10px)',
            }}
          >
            <CCardBody className='py-2 px-3'>
              <div className='d-flex justify-content-between align-items-center gap-3 flex-wrap'>
                <div style={{ minWidth: 0, flex: '1 1 360px' }}>
                  <div className='fw-semibold text-truncate'>{detail?.campaign?.name || 'Khảo sát'}</div>
                  <div className='small text-medium-emphasis text-truncate'>
                    {courseMetaLabel || 'Chưa có thông tin môn học'}
                    {lecturerMetaLabel ? ` · ${lecturerMetaLabel}` : ''}
                  </div>
                </div>

                <div className='d-flex align-items-center gap-2 flex-wrap justify-content-end'>
                  <div className='small text-medium-emphasis'>
                    {answeredCount}/{totalQuestions} câu · {progressValue}%
                  </div>
                  <CButton color='light' size='sm' onClick={() => navigate('/survey')}>Quay lại</CButton>
                  <CButton
                    color='primary'
                    size='sm'
                    onClick={onOpenConfirm}
                    disabled={loading || submitting || savingDraft || isCompleted}
                  >
                    {submitting ? 'Đang nộp...' : isCompleted ? 'Đã nộp' : 'Nộp khảo sát'}
                  </CButton>
                </div>
              </div>
            </CCardBody>
          </CCard>
        </div>
      ) : null}

      <div className='d-flex justify-content-between align-items-start gap-3 flex-wrap mb-4'>
        <div>
          <h3 className='mb-1'>{detail?.campaign?.name || 'Khảo sát'}</h3>
          <div className='text-medium-emphasis'>
            {detail?.template?.name || ''}
            {courseMetaLabel
              ? ` · ${courseMetaLabel}`
              : ''}
            {lecturerMetaLabel
              ? ` · ${lecturerMetaLabel}`
              : ''}
          </div>
        </div>
        <div className='d-flex gap-2'>
          <CButton color='light' onClick={() => navigate('/survey')}>Quay lại</CButton>
          <CButton color='primary' onClick={onOpenConfirm} disabled={loading || submitting || savingDraft || isCompleted}>
            {submitting ? 'Đang nộp...' : isCompleted ? 'Đã nộp' : 'Nộp khảo sát'}
          </CButton>
        </div>
      </div>

      {error ? <CAlert color='danger'>{error}</CAlert> : null}

      {loading ? (
        <div className='text-center py-5'>
          <CSpinner color='primary' />
        </div>
      ) : detail?.template ? (
        <CRow>
          <CCol xl={9}>
            <CForm onSubmit={(event) => event.preventDefault()}>
              {(detail.template.sections || []).map((section, sectionIndex) => {
                const baseIndex = (detail.template.sections || [])
                  .slice(0, sectionIndex)
                  .reduce((total, item) => total + (item.questions?.length || 0), 0)

                return (
                  <SurveySection
                    key={section.id}
                    section={section}
                    baseIndex={baseIndex}
                    answers={answers}
                    invalidQuestionIds={invalidQuestionIds}
                    disabled={submitting || isCompleted}
                    onAnswerChange={handleAnswerChange}
                  />
                )
              })}
            </CForm>
          </CCol>

          <CCol xl={3}>
            <CCard className='shadow-sm border-0 position-sticky' style={{ top: '1rem' }}>
              <CCardHeader className='bg-white fw-bold'>Tiến độ</CCardHeader>
              <CCardBody>
                <div className='d-flex justify-content-between mb-2'>
                  <span>Đã trả lời</span>
                  <strong>{answeredCount}/{totalQuestions}</strong>
                </div>
                <CProgress className='mb-3' height={10}>
                  <CProgressBar value={progressValue} />
                </CProgress>
                <div className='small text-medium-emphasis mb-3'>{progressValue}% hoàn thành</div>
                {!isCompleted ? (
                  <div className='small text-medium-emphasis mb-3'>
                    {savingDraft
                      ? 'Đang lưu tạm...'
                      : draftSavedAt
                        ? `Đã lưu tạm lúc ${formatSavedTime(draftSavedAt)}`
                        : hasAutoSaveStarted
                          ? 'Đã lưu tạm'
                          : 'Tự động lưu khi bạn trả lời'}
                  </div>
                ) : null}
                {invalidQuestionIds.size > 0 ? (
                  <CAlert color='danger' className='mb-0'>Còn {invalidQuestionIds.size} câu bắt buộc chưa trả lời.</CAlert>
                ) : null}
              </CCardBody>
            </CCard>
          </CCol>
        </CRow>
      ) : null}

      <CModal visible={showConfirmModal} backdrop='static' onClose={() => !submitting && setShowConfirmModal(false)}>
        <CModalHeader>
          <CModalTitle>Xác nhận nộp khảo sát</CModalTitle>
        </CModalHeader>
        <CModalBody>
          Bạn đã hoàn thành khảo sát. Bạn có chắc muốn nộp?
        </CModalBody>
        <CModalFooter>
          <CButton color='secondary' variant='outline' disabled={submitting} onClick={() => setShowConfirmModal(false)}>
            Hủy
          </CButton>
          <CButton color='primary' disabled={submitting} onClick={onConfirmSubmit}>
            {submitting ? 'Đang nộp...' : 'Xác nhận nộp'}
          </CButton>
        </CModalFooter>
      </CModal>

      <CToaster placement='top-end'>
        <CToast visible={showSuccessToast} autohide delay={2000} color='success' onClose={() => setShowSuccessToast(false)}>
          <CToastBody>Nộp khảo sát thành công</CToastBody>
        </CToast>
      </CToaster>
    </div>
  )
}