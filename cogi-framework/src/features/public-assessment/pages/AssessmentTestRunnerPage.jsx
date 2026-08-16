import { useEffect, useMemo, useState } from 'react'
import { CAlert, CButton, CCard, CCardBody, CContainer, CProgress, CProgressBar } from '@coreui/react'
import { useNavigate, useParams } from 'react-router-dom'
import AssessmentProgress from '../components/AssessmentProgress'
import QuestionRenderer from '../components/QuestionRenderer'
import { getMockAssessmentTest } from '../mock/assessmentTestMock'
import { buildCampaignRegisterPath, buildCampaignResultPath, buildCampaignSoundCheckPath, buildCampaignVerifyPath } from '../utils/assessmentRoutes'
import { getFlowState, mergeFlowState } from '../utils/assessmentFlowStorage'
import { createMockAudioSampleDataUri } from '../utils/assessmentRuntime'

function toText(value) {
  if (value === null || value === undefined) return ''
  return String(value).trim()
}

function nowMs() {
  return Date.now()
}

function formatRemainingMs(value) {
  const safe = Math.max(0, Number(value || 0))
  const totalSeconds = Math.floor(safe / 1000)
  const minutes = String(Math.floor(totalSeconds / 60)).padStart(2, '0')
  const seconds = String(totalSeconds % 60).padStart(2, '0')
  return `${minutes}:${seconds}`
}

function countWords(text) {
  return toText(text).split(/\s+/).filter(Boolean).length
}

function normalizeResponseValue(question, value) {
  if (question?.type === 'multiple_choice') return Array.isArray(value) ? value : []
  return value ?? ''
}

function createAttemptState(test) {
  const firstSection = Array.isArray(test?.sections) ? test.sections[0] : null
  const firstQuestion = firstSection?.questions?.[0] || null
  return {
    startedAt: new Date().toISOString(),
    currentSectionCode: firstSection?.code || null,
    currentQuestionId: firstQuestion?.id || null,
    currentScreen: 'intro',
    currentSectionScreen: 'intro',
    responses: {},
    completedSections: [],
    sectionTimers: {},
    questionAudioState: {},
    finishedAt: null,
  }
}

function findSectionIndex(test, sectionCode) {
  return (test?.sections || []).findIndex((section) => section.code === sectionCode)
}

function findQuestionIndex(section, questionId) {
  return (section?.questions || []).findIndex((question) => question.id === questionId)
}

function getUnansweredQuestions(section, responses) {
  return (section?.questions || []).filter((question) => {
    const value = responses?.[question.id]
    if (question.type === 'multiple_choice') return !Array.isArray(value) || value.length === 0
    return !toText(value)
  })
}

export default function AssessmentTestRunnerPage() {
  const navigate = useNavigate()
  const { tenantCode, campaignCode } = useParams()
  const [flowState, setFlowState] = useState(() => getFlowState())
  const [tick, setTick] = useState(nowMs())
  const [warningMessage, setWarningMessage] = useState('')
  const [sectionConfirm, setSectionConfirm] = useState(null)
  const audioSampleSrc = useMemo(() => createMockAudioSampleDataUri(), [])

  const isSameFlow = flowState?.tenantCode === tenantCode && flowState?.campaignCode === campaignCode
  const qualification = isSameFlow ? flowState?.qualification : null
  const verification = isSameFlow ? flowState?.verification : null
  const assessment = isSameFlow ? flowState?.assessment : null
  const test = getMockAssessmentTest(assessment?.test?.code)
  const registerPath = buildCampaignRegisterPath(tenantCode, campaignCode)
  const verifyPath = buildCampaignVerifyPath(tenantCode, campaignCode)
  const soundCheckPath = buildCampaignSoundCheckPath(tenantCode, campaignCode)
  const resultPath = buildCampaignResultPath(tenantCode, campaignCode)
  const hasQualification = Boolean(qualification?.student?.grade && qualification?.parent?.email)
  const emailVerified = verification?.emailVerified === true
  const soundConfirmed = assessment?.soundConfirmed === true

  useEffect(() => {
    const timer = window.setInterval(() => setTick(nowMs()), 1000)
    return () => window.clearInterval(timer)
  }, [])

  useEffect(() => {
    if (!isSameFlow || !test) return
    if (assessment?.attempt) return
    const nextState = mergeFlowState((current) => ({
      ...current,
      assessment: {
        ...(current.assessment || {}),
        attempt: createAttemptState(test),
      },
    }))
    setFlowState(nextState)
  }, [assessment?.attempt, isSameFlow, test])

  useEffect(() => {
    if (!isSameFlow || !assessment?.attempt?.startedAt) return undefined
    const handleBeforeUnload = (event) => {
      event.preventDefault()
      event.returnValue = ''
    }
    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [assessment?.attempt?.startedAt, isSameFlow])

  function syncState(nextState) {
    setFlowState(nextState)
    return nextState
  }

  if (!hasQualification) {
    navigate(registerPath, { replace: true })
    return null
  }
  if (!emailVerified) {
    navigate(verifyPath, { replace: true })
    return null
  }
  if (!soundConfirmed) {
    navigate(soundCheckPath, { replace: true })
    return null
  }
  if (!test) {
    return (
      <CContainer className='assessment-public-shell py-4'>
        <CAlert color='warning' className='mb-0'>Bài đánh giá cho nhóm lớp này hiện chưa được cấu hình.</CAlert>
      </CContainer>
    )
  }

  const attempt = assessment?.attempt || createAttemptState(test)
  const currentSectionIndex = Math.max(0, findSectionIndex(test, attempt.currentSectionCode))
  const currentSection = test.sections[currentSectionIndex]
  const currentQuestionIndex = Math.max(0, findQuestionIndex(currentSection, attempt.currentQuestionId))
  const currentQuestion = currentSection?.questions?.[currentQuestionIndex] || null
  const currentValue = currentQuestion ? normalizeResponseValue(currentQuestion, attempt.responses?.[currentQuestion.id]) : ''
  const completedSections = Array.isArray(attempt.completedSections) ? attempt.completedSections : []
  const sectionTimer = attempt.sectionTimers?.[currentSection?.code] || null
  const remainingMs = sectionTimer?.remainingMsAtStart && sectionTimer?.lastStartedAt
    ? sectionTimer.remainingMsAtStart - (tick - sectionTimer.lastStartedAt)
    : currentSection?.suggestedMinutes ? currentSection.suggestedMinutes * 60 * 1000 : 0
  const questionProgress = currentSection?.questions?.length ? Math.round(((currentQuestionIndex + 1) / currentSection.questions.length) * 100) : 0
  const unansweredQuestions = getUnansweredQuestions(currentSection, attempt.responses)
  const writingWordCount = currentQuestion?.type === 'long_text' ? countWords(currentValue) : 0
  const audioState = attempt.questionAudioState?.[currentQuestion?.id] || { playsUsed: 0, isPlaying: false }

  function updateAttempt(mutator) {
    const nextState = mergeFlowState((current) => {
      const nextAttempt = mutator(current.assessment?.attempt || createAttemptState(test))
      return {
        ...current,
        assessment: {
          ...(current.assessment || {}),
          test: current.assessment?.test || assessment?.test,
          attempt: nextAttempt,
        },
      }
    })
    syncState(nextState)
  }

  function startSection(section) {
    updateAttempt((currentAttempt) => ({
      ...currentAttempt,
      currentSectionCode: section.code,
      currentQuestionId: section.questions?.[0]?.id || null,
      currentSectionScreen: 'questions',
      sectionTimers: {
        ...(currentAttempt.sectionTimers || {}),
        [section.code]: currentAttempt.sectionTimers?.[section.code] || {
          remainingMsAtStart: (section.suggestedMinutes || 0) * 60 * 1000,
          lastStartedAt: nowMs(),
        },
      },
    }))
  }

  function updateResponse(value) {
    if (!currentQuestion) return
    updateAttempt((currentAttempt) => ({
      ...currentAttempt,
      responses: {
        ...(currentAttempt.responses || {}),
        [currentQuestion.id]: value,
      },
      lastSavedAt: new Date().toISOString(),
    }))
    setWarningMessage('Đã lưu')
    window.setTimeout(() => setWarningMessage(''), 1200)
  }

  function moveQuestion(direction) {
    if (!currentSection) return
    const nextIndex = currentQuestionIndex + direction
    const target = currentSection.questions?.[nextIndex]
    if (!target) return
    updateAttempt((currentAttempt) => ({
      ...currentAttempt,
      currentQuestionId: target.id,
    }))
  }

  function jumpToQuestion(questionId) {
    if (!currentSection || completedSections.includes(currentSection.code)) return
    updateAttempt((currentAttempt) => ({
      ...currentAttempt,
      currentQuestionId: questionId,
    }))
  }

  function handlePlayAudio() {
    if (!currentQuestion || !currentQuestion.audioKey) return
    if (audioState.playsUsed >= Number(currentQuestion.maxPlays || 1)) return
    const audio = new window.Audio(audioSampleSrc)
    updateAttempt((currentAttempt) => ({
      ...currentAttempt,
      questionAudioState: {
        ...(currentAttempt.questionAudioState || {}),
        [currentQuestion.id]: {
          playsUsed: Number(audioState.playsUsed || 0) + 1,
          isPlaying: true,
        },
      },
    }))
    audio.onended = () => {
      updateAttempt((currentAttempt) => ({
        ...currentAttempt,
        questionAudioState: {
          ...(currentAttempt.questionAudioState || {}),
          [currentQuestion.id]: {
            playsUsed: Number(currentAttempt.questionAudioState?.[currentQuestion.id]?.playsUsed || 0),
            isPlaying: false,
          },
        },
      }))
    }
    audio.onerror = () => {
      setWarningMessage('Không thể phát âm thanh. Vui lòng thử lại.')
      updateAttempt((currentAttempt) => ({
        ...currentAttempt,
        questionAudioState: {
          ...(currentAttempt.questionAudioState || {}),
          [currentQuestion.id]: {
            playsUsed: Math.max(0, Number(currentAttempt.questionAudioState?.[currentQuestion.id]?.playsUsed || 1) - 1),
            isPlaying: false,
          },
        },
      }))
    }
    audio.play().catch(() => {
      setWarningMessage('Không thể phát âm thanh. Vui lòng thử lại.')
    })
  }

  function openSectionConfirm() {
    const nextSection = test.sections[currentSectionIndex + 1] || null
    const unansweredCount = unansweredQuestions.length
    setSectionConfirm({
      currentSectionTitle: currentSection.title,
      nextSectionTitle: nextSection?.title || null,
      unansweredCount,
      isLastSection: !nextSection,
    })
  }

  function completeCurrentSection() {
    const nextSection = test.sections[currentSectionIndex + 1] || null
    updateAttempt((currentAttempt) => ({
      ...currentAttempt,
      completedSections: Array.from(new Set([...(currentAttempt.completedSections || []), currentSection.code])),
      currentSectionCode: nextSection?.code || currentSection.code,
      currentQuestionId: nextSection?.questions?.[0]?.id || currentQuestion.id,
      currentSectionScreen: nextSection ? 'intro' : 'complete',
      finishedAt: nextSection ? null : new Date().toISOString(),
    }))
    setSectionConfirm(null)
  }

  function renderSectionProgress() {
    return (
      <div className='assessment-test-section-progress'>
        {test.sections.map((section, index) => {
          const isCompleted = completedSections.includes(section.code)
          const isCurrent = section.code === currentSection.code
          return (
            <div key={section.code} className={`assessment-test-section-pill${isCompleted ? ' completed' : ''}${isCurrent ? ' current' : ''}`}>
              <span>{index + 1}</span>
              <span>{section.title}</span>
            </div>
          )
        })}
      </div>
    )
  }

  function renderQuestionNavigator() {
    return (
      <div className='assessment-test-question-nav'>
        {currentSection.questions.map((question, index) => {
          const answered = (() => {
            const value = attempt.responses?.[question.id]
            return question.type === 'multiple_choice' ? Array.isArray(value) && value.length > 0 : Boolean(toText(value))
          })()
          const isCurrent = question.id === currentQuestion.id
          return (
            <button key={question.id} type='button' className={`assessment-test-question-chip${answered ? ' answered' : ''}${isCurrent ? ' current' : ''}`} onClick={() => jumpToQuestion(question.id)}>
              {index + 1}
            </button>
          )
        })}
      </div>
    )
  }

  if (attempt.currentScreen === 'intro') {
    return (
      <CContainer className='assessment-public-shell py-3 py-md-4'>
        <CCard className='assessment-card'>
          <CCardBody className='p-4 p-md-5 text-center'>
            <AssessmentProgress currentStep={4} totalSteps={5} label='Bài kiểm tra' />
            <div className='assessment-section-title'>{test.title}</div>
            <p className='assessment-section-lead mb-4'>{`4 phần · ${test.estimatedMinutes}`}</p>
            <div className='assessment-trust-panel mb-4'>
              <div className='assessment-domain-copy'>Bạn có thể thay đổi câu trả lời trong phần đang làm. Sau khi chuyển sang phần tiếp theo, bạn sẽ không quay lại phần trước.</div>
            </div>
            {renderSectionProgress()}
            <div className='d-flex justify-content-center mt-4'>
              <CButton color='primary' className='assessment-primary-cta' onClick={() => updateAttempt((currentAttempt) => ({ ...currentAttempt, currentScreen: 'section', currentSectionScreen: 'intro' }))}>BẮT ĐẦU</CButton>
            </div>
          </CCardBody>
        </CCard>
      </CContainer>
    )
  }

  if (attempt.currentSectionScreen === 'complete') {
    return (
      <CContainer className='assessment-public-shell py-3 py-md-4'>
        <CCard className='assessment-card'>
          <CCardBody className='p-4 p-md-5 text-center'>
            <AssessmentProgress currentStep={4} totalSteps={5} label='Hoàn thành bài đánh giá' />
            <div className='assessment-section-title'>Bạn đã hoàn thành bài đánh giá</div>
            <div className='assessment-trust-list my-4'>
              {test.sections.map((section) => (
                <div key={section.code} className='assessment-trust-item justify-content-center'>
                  <div className='assessment-trust-icon'>✓</div>
                  <div className='fw-semibold'>{section.title}</div>
                </div>
              ))}
            </div>
            <CButton color='primary' className='assessment-primary-cta' onClick={() => navigate(resultPath)}>XEM KẾT QUẢ SƠ BỘ</CButton>
          </CCardBody>
        </CCard>
      </CContainer>
    )
  }

  if (attempt.currentSectionScreen === 'intro') {
    return (
      <CContainer className='assessment-public-shell py-3 py-md-4'>
        <CCard className='assessment-card'>
          <CCardBody className='p-4 p-md-5 text-center'>
            <AssessmentProgress currentStep={4} totalSteps={5} label={`Phần ${currentSectionIndex + 1}/4`} />
            <div className='assessment-section-title'>{currentSection.title}</div>
            <p className='assessment-section-lead mb-4'>{currentSection.instructions}</p>
            {currentSection.code === 'listening' ? <div className='assessment-secondary-note mb-4'>Bạn có thể phát audio theo số lần được cấu hình cho câu hỏi.</div> : null}
            <CButton color='primary' className='assessment-primary-cta' onClick={() => startSection(currentSection)}>{`BẮT ĐẦU ${currentSection.title.toUpperCase()}`}</CButton>
          </CCardBody>
        </CCard>
      </CContainer>
    )
  }

  return (
    <CContainer className='assessment-public-shell py-3 py-md-4'>
      <CCard className='assessment-card'>
        <CCardBody className='p-4 p-md-5'>
          <div className='d-flex justify-content-between gap-3 align-items-start flex-wrap mb-3'>
            <div>
              <div className='assessment-secondary-note'>{test.title}</div>
              <div className='assessment-section-title mb-1'>{currentSection.title}</div>
              <div className='assessment-secondary-note'>{`Câu ${currentQuestionIndex + 1} / ${currentSection.questions.length}`}</div>
            </div>
            <div className='text-end'>
              <div className='assessment-secondary-note'>Thời gian gợi ý còn lại</div>
              <div className='fw-semibold'>{formatRemainingMs(remainingMs)}</div>
              {remainingMs <= 0 ? <div className='assessment-form-error mt-1'>Thời gian gợi ý đã hết. Bạn vẫn có thể hoàn thành phần này.</div> : null}
            </div>
          </div>

          {renderSectionProgress()}

          <div className='d-flex justify-content-between align-items-center gap-3 flex-wrap mt-3'>
            <div className='assessment-secondary-note'>{warningMessage || 'Đã lưu cục bộ trong phiên làm bài.'}</div>
            <div className='d-flex align-items-center gap-3'>
              <span className='assessment-secondary-note'>{`${questionProgress}%`}</span>
              <div style={{ width: 180 }}>
                <CProgress height={8}>
                  <CProgressBar value={questionProgress} />
                </CProgress>
              </div>
            </div>
          </div>

          <div className='mt-3'>
            {renderQuestionNavigator()}
          </div>

          <div className={`mt-4 ${currentSection.code === 'reading' ? 'assessment-reading-layout' : ''}`}>
            {currentSection.code === 'reading' ? (
              <div className='assessment-reading-passage-card'>
                <div className='assessment-form-section-title'>Reading Passage</div>
                <div className='assessment-domain-copy'>{currentSection.passage}</div>
              </div>
            ) : null}

            <div className='assessment-question-card'>
              <div className='assessment-form-section-title'>{currentQuestion.prompt}</div>
              {currentQuestion.audioKey ? (
                <div className='mb-3'>
                  <div className='d-flex align-items-center gap-3 flex-wrap'>
                    <CButton type='button' color='secondary' variant='outline' onClick={handlePlayAudio} disabled={audioState.isPlaying || Number(audioState.playsUsed || 0) >= Number(currentQuestion.maxPlays || 1)}>
                      {audioState.isPlaying ? 'ĐANG PHÁT...' : '▶ NGHE'}
                    </CButton>
                    <div className='assessment-secondary-note'>{`Lượt nghe: ${Number(audioState.playsUsed || 0)}/${Number(currentQuestion.maxPlays || 1)}`}</div>
                  </div>
                </div>
              ) : null}

              <QuestionRenderer question={currentQuestion} value={currentValue} onChange={updateResponse} />

              {currentQuestion.type === 'long_text' ? (
                <div className='mt-3'>
                  <div className='assessment-secondary-note'>{`${writingWordCount} / ${currentQuestion.suggestedWords || 100} words`}</div>
                  {currentQuestion.minWords && writingWordCount < currentQuestion.minWords ? <div className='assessment-form-error mt-1'>{`Bạn nên viết ít nhất ${currentQuestion.minWords} từ.`}</div> : null}
                </div>
              ) : null}
            </div>
          </div>

          <div className='d-flex justify-content-between gap-3 flex-wrap mt-4'>
            <CButton color='secondary' variant='outline' disabled={currentQuestionIndex === 0} onClick={() => moveQuestion(-1)}>QUAY LẠI</CButton>
            {currentQuestionIndex < currentSection.questions.length - 1 ? (
              <CButton color='primary' onClick={() => moveQuestion(1)}>TIẾP THEO</CButton>
            ) : (
              <CButton color='primary' onClick={openSectionConfirm}>HOÀN THÀNH PHẦN</CButton>
            )}
          </div>

          {sectionConfirm ? (
            <CAlert color='warning' className='mt-4 mb-0'>
              <div className='fw-semibold mb-2'>{sectionConfirm.unansweredCount > 0 ? `Bạn còn ${sectionConfirm.unansweredCount} câu chưa trả lời.` : `Bạn đã hoàn thành ${sectionConfirm.currentSectionTitle}.`}</div>
              <div className='mb-3'>
                {sectionConfirm.isLastSection
                  ? 'Sau khi tiếp tục, bạn sẽ kết thúc bài đánh giá.'
                  : `Sau khi tiếp tục, bạn sẽ chuyển sang ${sectionConfirm.nextSectionTitle} và không thể quay lại phần này.`}
              </div>
              <div className='d-flex gap-2 flex-wrap'>
                <CButton color='secondary' variant='outline' onClick={() => setSectionConfirm(null)}>XEM LẠI</CButton>
                <CButton color='primary' onClick={completeCurrentSection}>{sectionConfirm.isLastSection ? 'HOÀN THÀNH BÀI ĐÁNH GIÁ' : 'CHUYỂN SANG PHẦN TIẾP THEO'}</CButton>
              </div>
            </CAlert>
          ) : null}
        </CCardBody>
      </CCard>
    </CContainer>
  )
}
