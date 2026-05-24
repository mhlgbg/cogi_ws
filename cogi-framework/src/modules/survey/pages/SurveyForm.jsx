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
import { useAuth } from '../../../contexts/AuthContext'
import { getSurveyAssignmentDetail, saveSurveyAnswersBatch, submitSurvey } from '../services/surveyService'

const SURVEY_AUTOSAVE_BATCH_SIZE = 10
const SURVEY_AUTOSAVE_IDLE_MS = 12000
const SURVEY_LOCAL_DRAFT_PREFIX = 'survey-answer-buffer'
const SURVEY_API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:1339/api'

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

function buildSurveyLocalDraftKey(userId, assignmentId, responseId) {
  return `${SURVEY_LOCAL_DRAFT_PREFIX}:${String(userId || 'anonymous').trim()}:${String(assignmentId || '').trim()}:${String(responseId || 'draft').trim()}`
}

function readSurveyLocalDraft(storageKey) {
  if (!storageKey) return null

  try {
    const rawValue = localStorage.getItem(storageKey)
    if (!rawValue) return null

    const parsed = JSON.parse(rawValue)
    if (!parsed || typeof parsed !== 'object') return null

    return {
      answers: parsed.answers && typeof parsed.answers === 'object' ? parsed.answers : {},
      dirtyQuestionIds: Array.isArray(parsed.dirtyQuestionIds)
        ? parsed.dirtyQuestionIds.map((item) => Number(item)).filter((item) => Number.isInteger(item) && item > 0)
        : [],
      lastSavedAt: typeof parsed.lastSavedAt === 'string' ? parsed.lastSavedAt : '',
    }
  } catch {
    return null
  }
}

function writeSurveyLocalDraft(storageKey, snapshot) {
  if (!storageKey) return

  localStorage.setItem(storageKey, JSON.stringify({
    answers: snapshot?.answers || {},
    dirtyQuestionIds: Array.isArray(snapshot?.dirtyQuestionIds) ? snapshot.dirtyQuestionIds : [],
    lastSavedAt: snapshot?.lastSavedAt || '',
    updatedAt: new Date().toISOString(),
  }))
}

function clearSurveyLocalDraft(storageKey) {
  if (!storageKey) return
  localStorage.removeItem(storageKey)
}

function buildAnswerPayload(questionId, answer) {
  return {
    questionId: Number(questionId),
    value: String(answer?.value || ''),
    text: String(answer?.text || ''),
  }
}

function buildKeepaliveBatchUrl(responseId) {
  return `${String(SURVEY_API_BASE_URL).replace(/\/+$/, '')}/survey-responses/${responseId}/answers/batch`
}

export default function SurveyForm() {
  const auth = useAuth()
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
  const [saveState, setSaveState] = useState('idle')
  const [lastSavedAt, setLastSavedAt] = useState('')
  const [dirtyQuestionIds, setDirtyQuestionIds] = useState(new Set())
  const [saveErrorMessage, setSaveErrorMessage] = useState('')
  const answersRef = useRef({})
  const dirtyQuestionIdsRef = useRef(new Set())
  const answerRevisionRef = useRef({})
  const isSavingBatchRef = useRef(false)
  const activeSavePromiseRef = useRef(null)
  const flushAfterSaveRef = useRef(false)
  const lastSavedAtRef = useRef('')

  const responseId = Number(detail?.draftResponse?.id || 0)
  const draftStorageKey = useMemo(
    () => buildSurveyLocalDraftKey(auth?.user?.id || 'anonymous', assignmentId, responseId || 'draft'),
    [assignmentId, auth?.user?.id, responseId],
  )

  function persistLocalDraft(nextAnswers = answersRef.current, nextDirtyQuestionIds = dirtyQuestionIdsRef.current, nextLastSavedAt = lastSavedAtRef.current) {
    writeSurveyLocalDraft(draftStorageKey, {
      answers: nextAnswers,
      dirtyQuestionIds: Array.from(nextDirtyQuestionIds),
      lastSavedAt: nextLastSavedAt,
    })
  }

  function commitAnswers(nextAnswers) {
    answersRef.current = nextAnswers
    setAnswers(nextAnswers)
  }

  function commitDirtyQuestionIds(nextDirtyQuestionIds, nextAnswers = answersRef.current, nextLastSavedAt = lastSavedAtRef.current) {
    dirtyQuestionIdsRef.current = nextDirtyQuestionIds
    setDirtyQuestionIds(new Set(nextDirtyQuestionIds))
    persistLocalDraft(nextAnswers, nextDirtyQuestionIds, nextLastSavedAt)
  }

  function commitLastSavedAt(nextLastSavedAt, nextAnswers = answersRef.current, nextDirtyQuestionIds = dirtyQuestionIdsRef.current) {
    lastSavedAtRef.current = nextLastSavedAt
    setLastSavedAt(nextLastSavedAt)
    persistLocalDraft(nextAnswers, nextDirtyQuestionIds, nextLastSavedAt)
  }

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

        const nextStorageKey = buildSurveyLocalDraftKey(auth?.user?.id || 'anonymous', assignmentId, data?.draftResponse?.id || 'draft')
        const bufferedDraft = readSurveyLocalDraft(nextStorageKey)
        const mergedAnswers = bufferedDraft?.answers && typeof bufferedDraft.answers === 'object'
          ? { ...hydratedAnswers, ...bufferedDraft.answers }
          : hydratedAnswers
        const nextDirtyQuestionIds = new Set(bufferedDraft?.dirtyQuestionIds || [])
        const nextLastSavedAt = bufferedDraft?.lastSavedAt || ''

        setAnswers(hydratedAnswers)
        answersRef.current = mergedAnswers
        setAnswers(mergedAnswers)
        setInvalidQuestionIds(new Set())
        dirtyQuestionIdsRef.current = nextDirtyQuestionIds
        setDirtyQuestionIds(new Set(nextDirtyQuestionIds))
        lastSavedAtRef.current = nextLastSavedAt
        setLastSavedAt(nextLastSavedAt)
        setSaveErrorMessage('')
        setSaveState(nextDirtyQuestionIds.size > 0 ? 'unsaved' : nextLastSavedAt ? 'saved' : 'idle')
        persistLocalDraft(mergedAnswers, nextDirtyQuestionIds, nextLastSavedAt)
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
  }, [assignmentId, auth?.user?.id])

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
    const nextAnswers = {
      ...answersRef.current,
      [questionId]: {
        value: String(nextAnswer?.value || ''),
        text: String(nextAnswer?.text || ''),
      },
    }

    answerRevisionRef.current[questionId] = Number(answerRevisionRef.current[questionId] || 0) + 1
    commitAnswers(nextAnswers)

    const nextDirtyQuestionIds = new Set(dirtyQuestionIdsRef.current)
    nextDirtyQuestionIds.add(Number(questionId))
    commitDirtyQuestionIds(nextDirtyQuestionIds, nextAnswers)
    setSaveErrorMessage('')
    setSaveState('unsaved')

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

  function buildBatchPayload(questionIds, answersSnapshot = answersRef.current) {
    return questionIds.map((questionId) => buildAnswerPayload(questionId, answersSnapshot[questionId]))
  }

  async function flushPendingAnswers(options = {}) {
    const forceAll = options?.forceAll === true
    const targetQuestionIds = forceAll
      ? allQuestions.map((question) => Number(question.id)).filter((questionId) => Number.isInteger(questionId) && questionId > 0)
      : Array.from(dirtyQuestionIdsRef.current)

    if (targetQuestionIds.length === 0) {
      return true
    }

    if (!responseId) {
      return false
    }

    if (isSavingBatchRef.current) {
      flushAfterSaveRef.current = true
      return activeSavePromiseRef.current || false
    }

    const revisionSnapshot = new Map(
      targetQuestionIds.map((questionId) => [questionId, Number(answerRevisionRef.current[questionId] || 0)]),
    )
    const payload = buildBatchPayload(targetQuestionIds)

    if (payload.length === 0) {
      return true
    }

    isSavingBatchRef.current = true
    setSaveErrorMessage('')
    setSaveState('saving')

    const savePromise = (async () => {
      try {
        const saved = await saveSurveyAnswersBatch(responseId, payload)
        const nextSavedAt = saved?.savedAt || new Date().toISOString()
        commitLastSavedAt(nextSavedAt)

        const nextDirtyQuestionIds = new Set(dirtyQuestionIdsRef.current)
        targetQuestionIds.forEach((questionId) => {
          if (Number(answerRevisionRef.current[questionId] || 0) === Number(revisionSnapshot.get(questionId) || 0)) {
            nextDirtyQuestionIds.delete(questionId)
          }
        })

        commitDirtyQuestionIds(nextDirtyQuestionIds)
        setSaveState(nextDirtyQuestionIds.size > 0 ? 'unsaved' : 'saved')
        return true
      } catch (saveError) {
        setSaveErrorMessage(getApiMessage(saveError, 'Lỗi lưu, hệ thống sẽ thử lại'))
        setSaveState('error')
        persistLocalDraft()
        return false
      } finally {
        isSavingBatchRef.current = false
        activeSavePromiseRef.current = null

        if (flushAfterSaveRef.current && dirtyQuestionIdsRef.current.size > 0 && !submitting) {
          flushAfterSaveRef.current = false
          void flushPendingAnswers()
        }
      }
    })()

    activeSavePromiseRef.current = savePromise
    return savePromise
  }

  useEffect(() => {
    if (loading || !detail?.template || isCompleted || submitting) return undefined
    if (dirtyQuestionIds.size < SURVEY_AUTOSAVE_BATCH_SIZE) return undefined

    void flushPendingAnswers()
    return undefined
  }, [detail?.template, dirtyQuestionIds.size, isCompleted, loading, submitting])

  useEffect(() => {
    if (loading || !detail?.template || isCompleted || submitting) return undefined
    if (dirtyQuestionIds.size === 0) return undefined

    const timer = window.setTimeout(() => {
      void flushPendingAnswers()
    }, SURVEY_AUTOSAVE_IDLE_MS)

    return () => {
      window.clearTimeout(timer)
    }
  }, [detail?.template, dirtyQuestionIds.size, isCompleted, loading, submitting])

  useEffect(() => {
    if (!responseId || isCompleted) return undefined

    function attemptKeepaliveFlush() {
      if (dirtyQuestionIdsRef.current.size === 0 || isSavingBatchRef.current) return

      const token = localStorage.getItem('authJwt')
      if (!token) return

      try {
        fetch(buildKeepaliveBatchUrl(responseId), {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            answers: buildBatchPayload(Array.from(dirtyQuestionIdsRef.current), answersRef.current),
          }),
          keepalive: true,
        })
      } catch {
        // Keep localStorage buffer for the next restore.
      }
    }

    function handleBeforeUnload() {
      attemptKeepaliveFlush()
    }

    function handleVisibilityChange() {
      if (document.visibilityState === 'hidden') {
        attemptKeepaliveFlush()
      }
    }

    window.addEventListener('beforeunload', handleBeforeUnload)
    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [isCompleted, responseId])

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
      if (activeSavePromiseRef.current) {
        await activeSavePromiseRef.current
      }

      const savedBeforeSubmit = await flushPendingAnswers({ forceAll: true })
      if (!savedBeforeSubmit) {
        throw new Error(saveErrorMessage || 'Không thể lưu khảo sát trước khi nộp')
      }

      await submitSurvey(Number(assignmentId), buildSubmitPayload())
      commitDirtyQuestionIds(new Set())
      clearSurveyLocalDraft(draftStorageKey)
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
                    disabled={loading || submitting || isCompleted}
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
          <CButton color='primary' onClick={onOpenConfirm} disabled={loading || submitting || isCompleted}>
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
                    {saveState === 'saving'
                      ? 'Đang lưu...'
                      : saveState === 'error'
                        ? (saveErrorMessage || 'Lỗi lưu, hệ thống sẽ thử lại')
                        : dirtyQuestionIds.size > 0
                          ? 'Có thay đổi chưa lưu'
                          : lastSavedAt
                            ? `Đã lưu lúc ${formatSavedTime(lastSavedAt)}`
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