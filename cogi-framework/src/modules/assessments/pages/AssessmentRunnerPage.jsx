import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { CAlert, CButton, CCard, CCardBody, CCol, CRow, CSpinner } from '@coreui/react'
import RunnerHeader from '../components/RunnerHeader'
import RunnerProgress from '../components/RunnerProgress'
import RunnerQuestion from '../components/RunnerQuestion'
import RunnerSectionNav from '../components/RunnerSectionNav'
import ResumeStateNotice from '../components/ResumeStateNotice'
import SubmitAssessmentModal from '../components/SubmitAssessmentModal'
import AssessmentCampaignRecoveryCard from '../../../features/public-assessment/components/AssessmentCampaignRecoveryCard'
import { getApiMessage, restorePublicAssessmentAttemptAccess, startPublicAssessmentCampaignRetake } from '../../../features/public-assessment/services/assessmentCampaignPublicService'
import { getRuntimeApiDetails, getRuntimeApiMessage, getAssessmentAttempt, markAudioListenRequirementSatisfied, registerAssessmentAudioPlay, resumeAssessmentAttempt, saveAssessmentAnswer, submitAssessmentAttempt, updateAssessmentProgress } from '../services/assessmentRuntimeApi'
import { getFlowState, patchFlowState } from '../../../features/public-assessment/utils/assessmentFlowStorage'
import '../components/assessment-runner.css'

function flattenQuestions(sections = []) {
  return sections.flatMap((section, sectionIndex) => (
    Array.isArray(section?.questions)
      ? section.questions.map((item, questionIndex) => ({
        ...item,
        section,
        sectionIndex,
        questionIndex,
        flatIndex: 0,
      }))
      : []
  )).map((item, flatIndex) => ({ ...item, flatIndex }))
}

function findQuestionEntry(sections, assessmentQuestionId) {
  return flattenQuestions(sections).find((item) => String(item?.assessmentQuestionId || item?.assessmentQuestionDocumentId || '') === String(assessmentQuestionId || '')) || null
}

function toAnswerMap(rows = []) {
  return rows.reduce((result, row) => {
    result[String(row?.assessmentQuestionId || '')] = row
    return result
  }, {})
}

function isAnswerComplete(questionType, answerData) {
  const type = String(questionType || '').trim()
  if (!answerData || typeof answerData !== 'object') return false
  if (type === 'single_choice' || type === 'true_false') return Array.isArray(answerData.selectedOptionIds) && answerData.selectedOptionIds.length === 1
  if (type === 'multiple_choice') return Array.isArray(answerData.selectedOptionIds) && answerData.selectedOptionIds.length > 0
  if (type === 'short_answer' || type === 'essay' || type === 'fill_blank') return String(answerData.text || '').trim().length > 0
  return false
}

function getQuestionStatus(entry, answerData) {
  const answered = isAnswerComplete(entry?.question?.type, answerData)
  const required = entry?.required !== false
  return {
    answered,
    unanswered: answered === false,
    required,
    requiredUnanswered: required && answered === false,
  }
}

function buildMissingQuestionItem(entry) {
  return {
    assessmentQuestionId: entry?.assessmentQuestionId || entry?.assessmentQuestionDocumentId || '',
    order: Number(entry?.questionIndex || 0) + 1,
    flatOrder: Number(entry?.flatIndex || 0) + 1,
    sectionCode: entry?.section?.code || '',
    sectionTitle: entry?.section?.title || entry?.section?.code || 'Phần',
    questionCode: entry?.question?.code || entry?.question?.title || '',
    questionNumber: Number(entry?.questionIndex || 0) + 1,
  }
}

function canAnswerAudioQuestion({ hasAudio = false, audioPlayCount = 0, minListenRatioBeforeAnswer = 0, listenRequirementSatisfied = false }) {
  if (!hasAudio) return true
  const threshold = Number(minListenRatioBeforeAnswer || 0)
  if (threshold > 0) return listenRequirementSatisfied === true
  return Number(audioPlayCount || 0) >= 1
}

function getAutosaveDelay(questionType) {
  if (questionType === 'single_choice' || questionType === 'true_false') return 0
  if (questionType === 'multiple_choice') return 400
  return 800
}

function buildProgressState(section, item) {
  return {
    currentSectionCode: section?.code || null,
    currentAssessmentQuestionId: item?.assessmentQuestionId || item?.assessmentQuestionDocumentId || null,
  }
}

function mapRunnerRecoveryError(error, fallback = 'Không thể khôi phục lượt làm bài.') {
  const message = getApiMessage(error, fallback)
  if (message === 'INVALID_EMAIL') return 'Email chưa đúng định dạng.'
  if (message === 'INVALID_OTP') return 'Mã OTP chưa đúng. Vui lòng thử lại.'
  if (message === 'ATTEMPT_NOT_OWNED') return 'Bạn không có quyền truy cập lượt làm bài này.'
  if (message === 'ATTEMPT_NOT_FOUND') return 'Không tìm thấy lượt làm bài.'
  if (message === 'ATTEMPT_CANCELLED') return 'Lượt làm bài này đã được quản trị viên hủy.'
  if (message === 'PUBLIC_SESSION_EXPIRED') return 'Phiên xác thực của bạn đã hết hạn. Vui lòng xác thực lại để tiếp tục.'
  if (message === 'PUBLIC_SESSION_MISMATCH') return 'Bạn không có quyền truy cập lượt làm bài này.'
  return message || fallback
}

function buildAssessmentVersionPath(attempt) {
  const assessmentId = attempt?.assessment?.id || attempt?.assessment?.documentId || ''
  const versionId = attempt?.assessmentVersion?.id || attempt?.assessmentVersion?.documentId || ''
  if (!assessmentId) return '/assessments'
  return `/assessments/${assessmentId}?tab=structure&version=${versionId}`
}

export default function AssessmentRunnerPage() {
  const navigate = useNavigate()
  const { attemptId, tenantCode } = useParams()
  const questionViewportRef = useRef(null)
  const audioPlayerRef = useRef(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [autoSubmitting, setAutoSubmitting] = useState(false)
  const [recovering, setRecovering] = useState(false)
  const [retakeStarting, setRetakeStarting] = useState(false)
  const [error, setError] = useState('')
  const [recoveryError, setRecoveryError] = useState('')
  const [statusCode, setStatusCode] = useState('')
  const [runtime, setRuntime] = useState(null)
  const [currentAssessmentQuestionId, setCurrentAssessmentQuestionId] = useState('')
  const [answerDrafts, setAnswerDrafts] = useState({})
  const [saveStates, setSaveStates] = useState({})
  const [audioStates, setAudioStates] = useState({})
  const [submitModalVisible, setSubmitModalVisible] = useState(false)
  const [submitError, setSubmitError] = useState('')
  const [missingRequired, setMissingRequired] = useState([])
  const [submitModalMode, setSubmitModalMode] = useState('confirm')
  const [resumeNoticeVisible, setResumeNoticeVisible] = useState(false)
  const [submittedJustNow, setSubmittedJustNow] = useState(false)
  const [autoSubmittedByTimeout, setAutoSubmittedByTimeout] = useState(false)
  const [remainingSeconds, setRemainingSeconds] = useState(null)
  const [offline, setOffline] = useState(typeof navigator !== 'undefined' ? navigator.onLine === false : false)
  const saveTimersRef = useRef({})
  const mountedRef = useRef(false)
  const timeoutSubmitTriggeredRef = useRef(false)
  const serverSyncRef = useRef({ expiresAt: null, serverTime: null, loadedAt: null })
  const flowState = useMemo(() => getFlowState() || {}, [attemptId])
  const flowAttemptId = String(flowState?.publicSession?.attemptId || flowState?.participation?.attemptId || '')
  const flowToken = String(flowState?.publicSession?.token || '').trim()
  const flowTenantCode = String(flowState?.tenantCode || tenantCode || '').trim()
  const runtimeRequestOptions = useMemo(() => {
    if (!flowAttemptId || flowAttemptId !== String(attemptId || '')) return {}
    if (!flowToken) return flowTenantCode ? { tenantCode: flowTenantCode } : {}
    return { tenantCode: flowTenantCode, publicAccessToken: flowToken }
  }, [attemptId, flowAttemptId, flowTenantCode, flowToken])

  const definition = runtime?.candidateDefinition || null
  const attempt = runtime?.attempt || null
  const sections = Array.isArray(definition?.sections) ? definition.sections : []
  const flatQuestions = useMemo(() => flattenQuestions(sections), [sections])
  const totalQuestions = Number(runtime?.progress?.totalQuestions || definition?.version?.totalQuestions || flatQuestions.length || 0)
  const answerMap = useMemo(() => toAnswerMap(runtime?.answers || []), [runtime?.answers])
  const questionStates = useMemo(() => flatQuestions.reduce((result, item) => {
    const questionId = String(item?.assessmentQuestionId || item?.assessmentQuestionDocumentId || '')
    const answer = answerMap[String(item?.assessmentQuestionId || '')]
    const answerData = answerDrafts[questionId] ?? answer?.answerData
    result[questionId] = getQuestionStatus(item, answerData)
    return result
  }, {}), [answerDrafts, answerMap, flatQuestions])
  const answeredMap = useMemo(() => Object.keys(questionStates).reduce((result, key) => {
    result[key] = questionStates[key]?.answered === true
    return result
  }, {}), [questionStates])
  const answeredCount = useMemo(() => Object.values(answeredMap).filter((value) => value === true).length, [answeredMap])
  const unansweredQuestions = useMemo(() => flatQuestions.filter((item) => questionStates[String(item?.assessmentQuestionId || item?.assessmentQuestionDocumentId || '')]?.unanswered === true), [flatQuestions, questionStates])
  const requiredUnansweredQuestions = useMemo(() => flatQuestions.filter((item) => questionStates[String(item?.assessmentQuestionId || item?.assessmentQuestionDocumentId || '')]?.requiredUnanswered === true), [flatQuestions, questionStates])

  const currentEntry = useMemo(() => findQuestionEntry(sections, currentAssessmentQuestionId) || flatQuestions[0] || null, [currentAssessmentQuestionId, flatQuestions, sections])
  const currentSection = currentEntry?.section || null
  const currentSectionIndex = Math.max(0, sections.findIndex((item) => item?.code === currentSection?.code))
  const currentSectionQuestions = Array.isArray(currentSection?.questions) ? currentSection.questions : []
  const currentQuestionIndex = Math.max(0, currentSectionQuestions.findIndex((item) => String(item?.assessmentQuestionId || item?.assessmentQuestionDocumentId || '') === String(currentEntry?.assessmentQuestionId || '')))
  const currentAnswerDraft = currentEntry ? answerDrafts[String(currentEntry.assessmentQuestionId || currentEntry.assessmentQuestionDocumentId || '')] ?? answerMap[String(currentEntry.assessmentQuestionId || '')]?.answerData ?? {} : {}
  const flatQuestionIndex = Math.max(0, flatQuestions.findIndex((item) => String(item?.assessmentQuestionId || '') === String(currentEntry?.assessmentQuestionId || '')))
  const previousRequiredUnanswered = useMemo(() => {
    if (!currentEntry) return null
    for (let index = flatQuestionIndex - 1; index >= 0; index -= 1) {
      const candidate = flatQuestions[index]
      if (questionStates[String(candidate?.assessmentQuestionId || candidate?.assessmentQuestionDocumentId || '')]?.requiredUnanswered === true) return candidate
    }
    return null
  }, [currentEntry, flatQuestionIndex, flatQuestions, questionStates])
  const nextRequiredUnanswered = useMemo(() => {
    if (!currentEntry) return null
    for (let index = flatQuestionIndex + 1; index < flatQuestions.length; index += 1) {
      const candidate = flatQuestions[index]
      if (questionStates[String(candidate?.assessmentQuestionId || candidate?.assessmentQuestionDocumentId || '')]?.requiredUnanswered === true) return candidate
    }
    return null
  }, [currentEntry, flatQuestionIndex, flatQuestions, questionStates])
  const firstRequiredUnanswered = requiredUnansweredQuestions[0] || null
  const expiresAtMs = useMemo(() => {
    const raw = runtime?.expiresAt || attempt?.expiresAt || serverSyncRef.current.expiresAt || null
    if (!raw) return null
    const parsed = new Date(raw).getTime()
    return Number.isFinite(parsed) ? parsed : null
  }, [attempt?.expiresAt, runtime?.expiresAt])

  const readOnly = ['submitted', 'expired', 'cancelled'].includes(String(attempt?.status || '').trim())
  const submitted = String(attempt?.status || '').trim() === 'submitted'
  const expired = String(attempt?.status || '').trim() === 'expired' || remainingSeconds === 0
  const currentAudioState = audioStates[String(currentEntry?.assessmentQuestionId || '')] || { audioPlayCount: 0, audioPlayLimit: currentEntry?.audioPlayLimit ?? null, remaining: currentEntry?.audioPlayLimit ?? null, allowSeek: currentEntry?.allowSeek !== false, minListenRatioBeforeAnswer: currentEntry?.minListenRatioBeforeAnswer ?? null, listenRequirementSatisfied: false, currentPlaybackRatio: 0, isPlaying: false }
  const currentMinListenRatio = Number(currentEntry?.minListenRatioBeforeAnswer || 0)
  const currentHasAudio = Boolean(currentEntry?.question?.stimulus?.audioAsset)
  const currentRequiresListenThreshold = currentHasAudio && currentMinListenRatio > 0
  const currentCanAnswerAudio = canAnswerAudioQuestion({
    hasAudio: currentHasAudio,
    audioPlayCount: currentAudioState?.audioPlayCount,
    minListenRatioBeforeAnswer: currentMinListenRatio,
    listenRequirementSatisfied: currentAudioState?.listenRequirementSatisfied === true,
  })
  const answersLockedByListenRequirement = !readOnly && !expired && currentCanAnswerAudio === false
  const audioDisabled = readOnly || expired
  const answerLockedMessage = answersLockedByListenRequirement
    ? currentRequiresListenThreshold
        ? `Nghe ít nhất ${Math.round(currentMinListenRatio * 100)}% để chọn đáp án.`
        : 'Hãy nhấn Nghe trước khi trả lời.'
    : ''

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
      Object.values(saveTimersRef.current).forEach((timerId) => window.clearTimeout(timerId))
    }
  }, [])

  useEffect(() => {
    function handleOnline() {
      setOffline(false)
      Object.keys(saveStates).forEach((key) => {
        if (saveStates[key]?.status === 'error') {
          const draft = answerDrafts[key]
          if (draft && currentEntry && String(currentEntry.assessmentQuestionId || '') === key) {
            performSave(key, draft, currentEntry, false)
          }
        }
      })
    }
    function handleOffline() { setOffline(true) }
    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [answerDrafts, currentEntry, saveStates])

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      setError('')
      try {
        const payload = await resumeAssessmentAttempt(attemptId, runtimeRequestOptions)
        if (cancelled) return
        hydrateRuntime(payload)
      } catch (resumeError) {
        try {
          const payload = await getAssessmentAttempt(attemptId, runtimeRequestOptions)
          if (cancelled) return
          hydrateRuntime(payload)
        } catch (requestError) {
          if (!cancelled) {
            setStatusCode(getApiMessage(requestError, getRuntimeApiMessage(requestError, 'Không tải được assessment attempt.')))
            setError(getRuntimeApiMessage(requestError, 'Không tải được assessment attempt.'))
          }
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [attemptId, runtimeRequestOptions])

  useEffect(() => {
    if (!attempt?.id || readOnly) return undefined
    const handleBeforeUnload = (event) => {
      event.preventDefault()
      event.returnValue = ''
    }
    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [attempt?.id, readOnly])

  useEffect(() => {
    if (!attempt?.id || readOnly || remainingSeconds === null || remainingSeconds > 0 || timeoutSubmitTriggeredRef.current) return undefined
    timeoutSubmitTriggeredRef.current = true
    handleTimeoutAutoSubmit()
  }, [attempt?.id, readOnly, remainingSeconds])

  useEffect(() => {
    if (!expiresAtMs) {
      setRemainingSeconds(null)
      return undefined
    }

    function updateTimer() {
      setRemainingSeconds(Math.max(0, Math.floor((expiresAtMs - Date.now()) / 1000)))
    }

    updateTimer()
    const intervalId = window.setInterval(updateTimer, 1000)
    return () => window.clearInterval(intervalId)
  }, [expiresAtMs])

  useEffect(() => {
    if (!currentEntry?.assessmentQuestionId || !questionViewportRef.current) return undefined
    const timerId = window.requestAnimationFrame(() => {
      questionViewportRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    })
    return () => window.cancelAnimationFrame(timerId)
  }, [currentEntry?.assessmentQuestionId])

  function hydrateRuntime(payload) {
    setRuntime(payload)
    const mappedAnswers = toAnswerMap(payload?.answers || [])
    setAnswerDrafts(Object.keys(mappedAnswers).reduce((result, key) => {
      result[key] = mappedAnswers[key]?.answerData || {}
      return result
    }, {}))
    setAudioStates(flattenQuestions(payload?.candidateDefinition?.sections || []).reduce((result, item) => {
      const key = String(item?.assessmentQuestionId || item?.assessmentQuestionDocumentId || '')
      const current = mappedAnswers[key] || null
      const audioPlayLimit = item?.audioPlayLimit ?? null
      result[key] = {
        audioPlayCount: current?.audioPlayCount || 0,
        audioPlayLimit,
        remaining: audioPlayLimit === null || audioPlayLimit === undefined ? null : Math.max(0, Number(audioPlayLimit || 0) - Number(current?.audioPlayCount || 0)),
        allowSeek: item?.allowSeek !== false,
        minListenRatioBeforeAnswer: item?.minListenRatioBeforeAnswer ?? null,
        listenRequirementSatisfied: current?.listenRequirementSatisfied === true,
        listenRequirementSatisfiedAt: current?.listenRequirementSatisfiedAt || null,
        currentPlaybackRatio: 0,
        playId: '',
        mediaFailedBeforePlayback: false,
        isPlaying: false,
      }
      return result
    }, {}))
    const questionId = payload?.progress?.currentAssessmentQuestionId || flattenQuestions(payload?.candidateDefinition?.sections || [])[0]?.assessmentQuestionId || ''
    setCurrentAssessmentQuestionId(String(questionId || ''))
    serverSyncRef.current = { expiresAt: payload?.expiresAt || null, serverTime: payload?.serverTime || null, loadedAt: Date.now() }
    const runtimeStatus = String(payload?.attempt?.status || '').trim()
    setResumeNoticeVisible(runtimeStatus === 'in_progress' && (payload?.progress?.answeredCount || 0) > 0)
    if (runtimeStatus !== 'submitted') {
      setSubmittedJustNow(false)
      setAutoSubmittedByTimeout(false)
      timeoutSubmitTriggeredRef.current = false
    }
  }

  async function handleTimeoutAutoSubmit() {
    if (!attempt?.id) return
    setAutoSubmitting(true)
    setSubmitError('')
    setMissingRequired([])
    try {
      const payload = await submitAssessmentAttempt(attempt.id, runtimeRequestOptions)
      if (!mountedRef.current) return
      setSubmittedJustNow(true)
      setAutoSubmittedByTimeout(true)
      hydrateRuntime(payload)
      if (runtimeRequestOptions?.publicAccessToken) {
        patchFlowState({
          participation: {
            ...(flowState?.participation || {}),
            status: 'submitted',
            attemptId: attempt.id,
            attemptCode: attempt.code || flowState?.participation?.attemptCode || null,
          },
        })
      }
    } catch (requestError) {
      if (!mountedRef.current) return
      const message = getRuntimeApiMessage(requestError, 'Không thể tự động nộp bài khi hết thời gian.')
      if (message === 'Assessment Attempt is already submitted') {
        await refreshAttemptState()
        setAutoSubmittedByTimeout(true)
        return
      }
      if (message === 'ATTEMPT_CANCELLED') {
        setError('Lượt làm bài này đã được quản trị viên hủy.')
        setRuntime((prev) => prev ? { ...prev, attempt: { ...(prev.attempt || {}), status: 'cancelled' } } : prev)
        return
      }
      setError('Đã hết thời gian làm bài. Hệ thống đang đồng bộ nộp bài, vui lòng tải lại trang nếu kết quả chưa cập nhật.')
      timeoutSubmitTriggeredRef.current = false
    } finally {
      if (mountedRef.current) setAutoSubmitting(false)
    }
  }

  async function refreshAttemptState() {
    try {
      const payload = await getAssessmentAttempt(attemptId, runtimeRequestOptions)
      if (!mountedRef.current) return
      hydrateRuntime(payload)
    } catch (requestError) {
      if (!mountedRef.current) return
      setStatusCode(getApiMessage(requestError, getRuntimeApiMessage(requestError, 'Không làm mới được trạng thái attempt.')))
      setError(getRuntimeApiMessage(requestError, 'Không làm mới được trạng thái attempt.'))
    }
  }

  async function handleRecoverAccess(values) {
    setRecovering(true)
    setRecoveryError('')
    try {
      const restored = await restorePublicAssessmentAttemptAccess(attemptId, values, flowTenantCode)
      patchFlowState({
        tenantCode: flowTenantCode,
        campaignCode: restored?.campaign?.slug || flowState?.campaignCode || '',
        participation: {
          ...(flowState?.participation || {}),
          attemptId: restored?.attempt?.id || restored?.attempt?.documentId || attemptId,
          attemptCode: restored?.attempt?.code || flowState?.participation?.attemptCode || null,
          participationCode: restored?.participation?.code || flowState?.participation?.participationCode || null,
          status: restored?.participation?.status || flowState?.participation?.status || null,
          retakeAllowed: restored?.participation?.retakeAllowed === true,
          retakeReason: restored?.participation?.retakeReason || null,
          retakeCount: restored?.participation?.retakeCount || 0,
        },
        publicSession: {
          token: restored?.publicAccessToken || '',
          expiresAt: restored?.publicAccessExpiresAt || null,
          attemptId: restored?.attempt?.id || restored?.attempt?.documentId || attemptId,
        },
        verification: {
          ...(flowState?.verification || {}),
          method: 'email',
          target: values.email,
          emailVerified: true,
          phoneVerified: false,
          verifiedAt: new Date().toISOString(),
        },
      })
      setStatusCode('')
      setError('')
      const payload = await getAssessmentAttempt(attemptId, { tenantCode: flowTenantCode, publicAccessToken: restored?.publicAccessToken || '' })
      hydrateRuntime(payload)
    } catch (requestError) {
      setRecoveryError(mapRunnerRecoveryError(requestError))
    } finally {
      setRecovering(false)
      setLoading(false)
    }
  }

  async function handleStartRetake() {
    if (!runtimeRequestOptions?.publicAccessToken) return
    setRetakeStarting(true)
    setRecoveryError('')
    try {
      const next = await startPublicAssessmentCampaignRetake(attemptId, flowTenantCode, runtimeRequestOptions.publicAccessToken)
      patchFlowState({
        participation: {
          ...(flowState?.participation || {}),
          attemptId: next?.attempt?.id || next?.attempt?.documentId || null,
          attemptCode: next?.attempt?.code || null,
          participationCode: next?.participation?.code || flowState?.participation?.participationCode || null,
          status: next?.participation?.status || null,
          retakeAllowed: false,
        },
        publicSession: {
          token: next?.publicAccessToken || '',
          expiresAt: next?.publicAccessExpiresAt || null,
          attemptId: next?.attempt?.id || next?.attempt?.documentId || null,
        },
      })
      navigate(buildAssessmentRunnerPath(flowTenantCode, next?.attempt?.id || next?.attempt?.documentId))
    } catch (requestError) {
      setRecoveryError(mapRunnerRecoveryError(requestError, 'Không thể bắt đầu lại bài đánh giá.'))
    } finally {
      setRetakeStarting(false)
    }
  }

  function markSaveState(questionId, status, message = '') {
    setSaveStates((prev) => ({ ...prev, [questionId]: { status, message } }))
  }

  async function performSave(questionId, answerData, entry, withProgress = true) {
    if (!attempt?.id || !entry || readOnly) return
    markSaveState(questionId, 'saving')
    try {
      const payload = await saveAssessmentAnswer(attempt.id, questionId, {
        answerData,
        progressState: withProgress ? buildProgressState(entry.section, entry) : undefined,
      }, runtimeRequestOptions)
      setRuntime((prev) => prev ? {
        ...prev,
        progress: payload?.progress || prev.progress,
        answers: (() => {
          const map = toAnswerMap(prev.answers || [])
          map[String(payload?.answer?.assessmentQuestionId || questionId)] = payload.answer
          return Object.values(map)
        })(),
      } : prev)
      markSaveState(questionId, 'saved')
    } catch (requestError) {
      const message = getRuntimeApiMessage(requestError, 'Không lưu được câu trả lời.')
      if (message === 'ATTEMPT_CANCELLED') {
        setError('Lượt làm bài này đã được quản trị viên hủy.')
        setRuntime((prev) => prev ? { ...prev, attempt: { ...(prev.attempt || {}), status: 'cancelled' } } : prev)
      }
      markSaveState(questionId, 'error', message === 'ATTEMPT_CANCELLED' ? 'Lượt làm bài này đã được quản trị viên hủy.' : message)
    }
  }

  function scheduleSave(entry, nextAnswerData) {
    const questionId = String(entry?.assessmentQuestionId || entry?.assessmentQuestionDocumentId || '')
    if (!questionId) return
    const delay = getAutosaveDelay(entry?.question?.type)
    setAnswerDrafts((prev) => ({ ...prev, [questionId]: nextAnswerData }))
    if (saveTimersRef.current[questionId]) window.clearTimeout(saveTimersRef.current[questionId])
    if (delay === 0) {
      performSave(questionId, nextAnswerData, entry)
      return
    }
    markSaveState(questionId, 'saving')
    saveTimersRef.current[questionId] = window.setTimeout(() => {
      performSave(questionId, nextAnswerData, entry)
    }, delay)
  }

  async function flushPendingSave(entry) {
    const questionId = String(entry?.assessmentQuestionId || entry?.assessmentQuestionDocumentId || '')
    if (!questionId) return
    if (!saveTimersRef.current[questionId]) return
    window.clearTimeout(saveTimersRef.current[questionId])
    delete saveTimersRef.current[questionId]
    const answerData = answerDrafts[questionId] ?? answerMap[String(entry?.assessmentQuestionId || '')]?.answerData
    await performSave(questionId, answerData || {}, entry)
  }

  function stopActiveAudioPlayback() {
    audioPlayerRef.current?.stopPlayback?.()
  }

  async function beforeQuestionLeave() {
    stopActiveAudioPlayback()
    await flushPendingSave(currentEntry)
  }

  async function handleUpdateProgress(section, item) {
    if (!attempt?.id || readOnly) return
    try {
      const payload = await updateAssessmentProgress(attempt.id, { progressState: buildProgressState(section, item) }, runtimeRequestOptions)
      setRuntime((prev) => prev ? { ...prev, attempt: payload?.attempt || prev.attempt, progress: payload?.progress || prev.progress } : prev)
    } catch {
      // keep local navigation state even if progress sync fails
    }
  }

  async function goToQuestion(section, item) {
    const questionId = String(item?.assessmentQuestionId || item?.assessmentQuestionDocumentId || '')
    if (currentEntry && String(currentEntry?.assessmentQuestionId || currentEntry?.assessmentQuestionDocumentId || '') !== questionId) {
      await beforeQuestionLeave()
    }
    setCurrentAssessmentQuestionId(questionId)
    handleUpdateProgress(section, item)
  }

  async function moveToRequiredUnanswered(target) {
    if (!target) return
    await goToQuestion(target.section, target)
  }

  async function handleRegisterAudioPlay() {
    if (!attempt?.id || !currentEntry) return null
    try {
      const payload = await registerAssessmentAudioPlay(attempt.id, currentEntry.assessmentQuestionId, {}, runtimeRequestOptions)
      setAudioStates((prev) => ({
        ...prev,
        [String(currentEntry.assessmentQuestionId)]: {
          ...(prev[String(currentEntry.assessmentQuestionId)] || {}),
          ...payload,
          currentPlaybackRatio: 0,
          mediaFailedBeforePlayback: false,
          isPlaying: false,
        },
      }))
      return payload
    } catch (requestError) {
      throw new Error(getRuntimeApiMessage(requestError, 'Bạn đã sử dụng hết số lượt nghe.'))
    }
  }

  async function handleMarkListenSatisfied(playId) {
    if (!attempt?.id || !currentEntry || !playId) return
    try {
      const payload = await markAudioListenRequirementSatisfied(attempt.id, currentEntry.assessmentQuestionId, { playId }, runtimeRequestOptions)
      setAudioStates((prev) => ({
        ...prev,
        [String(currentEntry.assessmentQuestionId)]: {
          ...(prev[String(currentEntry.assessmentQuestionId)] || {}),
          listenRequirementSatisfied: payload?.listenRequirementSatisfied === true,
          listenRequirementSatisfiedAt: payload?.listenRequirementSatisfiedAt || null,
        },
      }))
      setRuntime((prev) => prev ? {
        ...prev,
        answers: (() => {
          const map = toAnswerMap(prev.answers || [])
          const key = String(currentEntry.assessmentQuestionId || '')
          const existing = map[key] || { assessmentQuestionId: key, answerData: null, audioPlayCount: prev.answers?.find?.((item) => String(item?.assessmentQuestionId || '') === key)?.audioPlayCount || 0 }
          map[key] = {
            ...existing,
            listenRequirementSatisfied: payload?.listenRequirementSatisfied === true,
            listenRequirementSatisfiedAt: payload?.listenRequirementSatisfiedAt || null,
          }
          return Object.values(map)
        })(),
      } : prev)
    } catch (requestError) {
      const message = getRuntimeApiMessage(requestError, 'Không thể xác nhận thời lượng nghe tối thiểu.')
      setAudioStates((prev) => ({
        ...prev,
        [String(currentEntry.assessmentQuestionId)]: {
          ...(prev[String(currentEntry.assessmentQuestionId)] || {}),
          isPlaying: false,
        },
      }))
      setError(message)
    }
  }

  function handleSyncAudioState(nextState) {
    if (!currentEntry) return
    setAudioStates((prev) => ({
      ...prev,
      [String(currentEntry.assessmentQuestionId)]: {
        ...(prev[String(currentEntry.assessmentQuestionId)] || {}),
        ...nextState,
      },
    }))
  }

  async function handleSubmit() {
    if (!attempt?.id) return
    await beforeQuestionLeave()
    setSubmitting(true)
    setSubmitError('')
    setMissingRequired([])
    try {
      const payload = await submitAssessmentAttempt(attempt.id, runtimeRequestOptions)
      setSubmittedJustNow(true)
      hydrateRuntime(payload)
      if (runtimeRequestOptions?.publicAccessToken) {
        patchFlowState({
          participation: {
            ...(flowState?.participation || {}),
            status: 'submitted',
            attemptId: attempt.id,
            attemptCode: attempt.code || flowState?.participation?.attemptCode || null,
          },
        })
      }
      setSubmitModalVisible(false)
    } catch (requestError) {
      const details = getRuntimeApiDetails(requestError)
      const missing = Array.isArray(details?.missingRequired) ? details.missingRequired : []
      const message = getRuntimeApiMessage(requestError, 'Không thể nộp bài.')
      if (message === 'ATTEMPT_CANCELLED') {
        setError('Lượt làm bài này đã được quản trị viên hủy.')
        setRuntime((prev) => prev ? { ...prev, attempt: { ...(prev.attempt || {}), status: 'cancelled' } } : prev)
      }
      setSubmitError(message === 'ATTEMPT_CANCELLED' ? 'Lượt làm bài này đã được quản trị viên hủy.' : message)
      setMissingRequired(missing.length > 0 ? missing : requiredUnansweredQuestions.map(buildMissingQuestionItem))
      setSubmitModalMode('incomplete')
      setSubmitModalVisible(true)
    } finally {
      setSubmitting(false)
    }
  }

  async function jumpToMissing(item) {
    const target = findQuestionEntry(sections, item?.assessmentQuestionId)
    if (!target) return
    setSubmitModalVisible(false)
    await goToQuestion(target.section, target)
  }

  function openSubmitModal() {
    const missing = requiredUnansweredQuestions.map(buildMissingQuestionItem)
    setSubmitError('')
    setMissingRequired(missing)
    setSubmitModalMode(missing.length > 0 ? 'incomplete' : 'confirm')
    setSubmitModalVisible(true)
  }

  async function handleContinueIncomplete() {
    if (!firstRequiredUnanswered) return
    setSubmitModalVisible(false)
    await goToQuestion(firstRequiredUnanswered.section, firstRequiredUnanswered)
  }

  if (loading) {
    return <div className='py-4 d-flex align-items-center gap-2'><CSpinner size='sm' /><span>Đang tải assessment runner...</span></div>
  }

  const shouldShowRecovery = !runtime && ['Unauthorized', 'PUBLIC_SESSION_EXPIRED', 'PUBLIC_SESSION_MISMATCH', 'ATTEMPT_NOT_OWNED'].includes(String(statusCode || ''))

  if (shouldShowRecovery) {
    return (
      <div className='assessment-runner assessment-runner-shell py-4'>
        <AssessmentCampaignRecoveryCard
          title='Xác thực để tiếp tục bài kiểm tra'
          description='Phiên truy cập hiện tại không còn hiệu lực. Vui lòng nhập email đã dùng khi đăng ký và mã OTP để tiếp tục bài kiểm tra của bạn.'
          initialEmail={flowState?.verification?.target || ''}
          loading={recovering}
          error={recoveryError}
          submitLabel='Xác thực và tiếp tục'
          onSubmit={handleRecoverAccess}
        />
      </div>
    )
  }

  if (error) {
    return <div className='assessment-runner assessment-runner-shell py-4'><CAlert color='danger'>{error}</CAlert></div>
  }

  const cancelledWithRetake = String(attempt?.status || '') === 'cancelled' && flowState?.participation?.retakeAllowed === true

  if (String(attempt?.status || '') === 'cancelled') {
    return (
      <div className='assessment-runner assessment-runner-shell py-4 d-grid gap-3'>
        <CAlert color='warning'>Lượt làm bài này đã được hủy.</CAlert>
        {cancelledWithRetake ? (
          <div>
            <CAlert color='info'>VitaminFun đã cho phép bạn thực hiện lại bài đánh giá.</CAlert>
            <CButton color='primary' onClick={handleStartRetake} disabled={retakeStarting}>{retakeStarting ? 'Đang chuẩn bị...' : 'Bắt đầu làm lại'}</CButton>
          </div>
        ) : null}
      </div>
    )
  }

  if (!runtime || !currentEntry) {
    return <div className='assessment-runner assessment-runner-shell py-4'><CAlert color='warning'>Không có dữ liệu attempt để hiển thị.</CAlert></div>
  }

  return (
    <div className='assessment-runner assessment-runner-shell py-4'>
      {offline ? <CAlert color='warning' className='mb-0'>Mất kết nối. Bài làm vẫn giữ local và sẽ thử lưu lại khi có mạng.</CAlert> : null}
      {autoSubmitting ? <CAlert color='warning' className='mb-0'>Đã hết thời gian làm bài. Hệ thống đang tự động nộp bài...</CAlert> : null}
      <ResumeStateNotice visible={resumeNoticeVisible} />
      {submitted ? (
        <CAlert color={submittedJustNow ? 'success' : 'info'} className='mb-0 d-flex justify-content-between align-items-center gap-3 flex-wrap'>
          <span>{autoSubmittedByTimeout ? 'Bài làm đã được tự động nộp khi hết thời gian.' : submittedJustNow ? 'Bài làm đã được nộp thành công.' : 'Bài làm này đã được nộp.'}</span>
          <CButton color='primary' size='sm' onClick={() => navigate('result')}>Xem kết quả</CButton>
        </CAlert>
      ) : null}
      {attempt?.status === 'expired' ? <CAlert color='danger' className='mb-0'>Đã hết thời gian làm bài. Hệ thống đã tự động nộp những câu trả lời bạn đã hoàn thành.</CAlert> : null}

      <CCard className='ai-card'>
        <CCardBody>
          <RunnerHeader
            attempt={attempt}
            version={definition?.version}
            progress={{ ...(runtime?.progress || {}), answeredCount, totalQuestions }}
            remainingSeconds={remainingSeconds}
            expired={expired}
            readOnlyMode={readOnly}
            submittedAt={attempt?.submittedAt || null}
            onOpenSubmit={openSubmitModal}
            onBack={() => navigate(String(attempt?.sourceType || '').trim() === 'admin_test' ? buildAssessmentVersionPath(attempt) : '/assessments')}
          />
        </CCardBody>
      </CCard>

      <div className='assessment-runner-layout'>
        <div className='assessment-runner-sidebar'>
          <RunnerProgress answeredCount={answeredCount} totalQuestions={totalQuestions} />
          <RunnerSectionNav sections={sections} activeSectionCode={currentSection?.code || ''} answeredMap={answeredMap} currentAssessmentQuestionId={currentEntry?.assessmentQuestionId || ''} onSelectQuestion={goToQuestion} />
        </div>

        <div className='assessment-runner-main'>
          <div ref={questionViewportRef} className='assessment-runner-question-stage'>
            <RunnerQuestion
              audioPlayerRef={audioPlayerRef}
              attemptId={attempt?.id}
              item={currentEntry}
              sectionIndex={currentSectionIndex}
              questionIndex={currentQuestionIndex}
              totalQuestions={totalQuestions}
              value={currentAnswerDraft}
              disabled={readOnly || expired || answersLockedByListenRequirement}
              audioDisabled={audioDisabled}
              answerLockedMessage={answerLockedMessage}
              saveState={saveStates[String(currentEntry?.assessmentQuestionId || '')] || { status: 'saved' }}
              audioState={currentAudioState}
              onChange={(nextValue) => scheduleSave(currentEntry, nextValue)}
              onRegisterPlay={handleRegisterAudioPlay}
              onMarkListenSatisfied={handleMarkListenSatisfied}
              onSyncAudioState={handleSyncAudioState}
            />
          </div>

          <div className='assessment-runner-bottom-bar'>
            <div className='assessment-runner-navigation'>
              <CButton
                type='button'
                color='secondary'
                variant='outline'
                onClick={() => void moveToRequiredUnanswered(previousRequiredUnanswered)}
                disabled={readOnly || !previousRequiredUnanswered}
                title='Đi tới câu chưa làm gần nhất phía trước'
                aria-label='Đi tới câu chưa làm gần nhất phía trước'
              >
                <span className='assessment-runner-nav-label-desktop'>← Trước</span>
                <span className='assessment-runner-nav-label-mobile'>← Trước</span>
              </CButton>
              <div className='assessment-runner-statusline small text-body-secondary'>
                {readOnly
                  ? submitted ? 'Chế độ xem lại bài đã nộp' : 'Chế độ chỉ đọc'
                  : requiredUnansweredQuestions.length === 0 ? 'Bạn đã hoàn thành tất cả câu bắt buộc.'
                  : saveStates[String(currentEntry?.assessmentQuestionId || '')]?.status === 'error' ? saveStates[String(currentEntry?.assessmentQuestionId || '')]?.message || 'Lỗi lưu. Vui lòng thử lại.' : saveStates[String(currentEntry?.assessmentQuestionId || '')]?.status === 'saving' ? 'Đang lưu...' : 'Đã lưu tự động'}
              </div>
              <div className='d-flex gap-2 flex-wrap assessment-runner-navigation-actions'>
                {!readOnly ? (
                  <CButton
                    type='button'
                    color='primary'
                    variant='outline'
                    onClick={() => void moveToRequiredUnanswered(nextRequiredUnanswered)}
                    disabled={!nextRequiredUnanswered}
                    title='Đi tới câu chưa làm gần nhất phía sau'
                    aria-label='Đi tới câu chưa làm gần nhất phía sau'
                  >
                    <span className='assessment-runner-nav-label-desktop'>Tiếp →</span>
                    <span className='assessment-runner-nav-label-mobile'>Tiếp →</span>
                  </CButton>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      </div>

      <SubmitAssessmentModal
        visible={submitModalVisible}
        mode={submitModalMode}
        answeredCount={answeredCount}
        totalQuestions={totalQuestions}
        missingRequired={missingRequired}
        submitting={submitting}
        submitError={submitError}
        onClose={() => setSubmitModalVisible(false)}
        onSubmit={handleSubmit}
        onContinue={handleContinueIncomplete}
        onJumpToMissing={jumpToMissing}
      />
    </div>
  )
}