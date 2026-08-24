import { CAlert, CButton, CCard, CCardBody, CContainer } from '@coreui/react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import AssessmentProgress from '../components/AssessmentProgress'
import { assessmentSpeakingPrompts, getMockSpeakingSlots } from '../mock/assessmentSpeakingMock'
import { getFlowState, mergeFlowState } from '../utils/assessmentFlowStorage'
import { buildCampaignQualificationPath, buildCampaignResultPath, buildCampaignTestPath } from '../utils/assessmentRoutes'

function resolveFinishedAssessment(assessment) {
  return assessment?.finished === true || Boolean(assessment?.attempt?.finishedAt)
}

function formatSeconds(totalSeconds) {
  const safe = Math.max(0, Number(totalSeconds || 0))
  const minutes = String(Math.floor(safe / 60)).padStart(2, '0')
  const seconds = String(safe % 60).padStart(2, '0')
  return `${minutes}:${seconds}`
}

function describeSpeakingStatus(speaking) {
  if (speaking?.status === 'booked') return 'Đã ghi nhận lịch Speaking.'
  if (speaking?.status === 'submitted') return 'Đã ghi nhận phần Speaking.'
  return ''
}

function createAudioPromptState(prompts) {
  return (prompts || []).map((prompt) => ({
    promptId: prompt.id,
    source: null,
    status: 'idle',
    fileName: '',
    objectUrl: '',
    durationSeconds: 0,
    warning: '',
  }))
}

export default function AssessmentSpeakingPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const { tenantCode, campaignCode } = useParams()
  const [flowState, setFlowState] = useState(() => getFlowState())
  const [selectedDate, setSelectedDate] = useState('')
  const [selectedTime, setSelectedTime] = useState('')
  const [liveSuccess, setLiveSuccess] = useState(false)
  const [audioSuccess, setAudioSuccess] = useState(false)
  const [audioError, setAudioError] = useState('')
  const [audioPermissionError, setAudioPermissionError] = useState('')
  const [recordings, setRecordings] = useState(() => createAudioPromptState(assessmentSpeakingPrompts))
  const [recordingPromptId, setRecordingPromptId] = useState('')
  const [recordingSeconds, setRecordingSeconds] = useState(0)
  const mediaRecorderRef = useRef(null)
  const mediaStreamRef = useRef(null)
  const recordingChunksRef = useRef([])
  const recordingStartedAtRef = useRef(0)
  const recordingsRef = useRef(recordings)
  const fileInputRefs = useRef({})
  const isSameFlow = flowState?.campaignCode === campaignCode && flowState?.tenantCode === tenantCode
  const assessment = isSameFlow ? flowState?.assessment : null
  const qualificationCompleted = assessment?.qualificationCompleted === true
  const qualification = isSameFlow ? flowState?.qualification : null
  const speaking = isSameFlow ? flowState?.speaking : null
  const resultPath = buildCampaignResultPath(tenantCode, campaignCode)
  const testPath = buildCampaignTestPath(tenantCode, campaignCode)
  const qualificationPath = buildCampaignQualificationPath(tenantCode, campaignCode)
  const speakingSlots = useMemo(() => getMockSpeakingSlots(), [])
  const mode = useMemo(() => {
    const params = new URLSearchParams(location.search)
    const value = String(params.get('mode') || '').trim().toLowerCase()
    return value === 'audio' ? 'audio' : value === 'live' ? 'live' : ''
  }, [location.search])

  const selectedSlotDay = speakingSlots.find((entry) => entry.date === selectedDate) || null
  const hasAudioResponses = recordings.every((item) => item.status === 'recorded')
  const hasMediaRecorderSupport = typeof window !== 'undefined' && typeof window.MediaRecorder !== 'undefined' && typeof navigator !== 'undefined' && navigator?.mediaDevices?.getUserMedia

  useEffect(() => {
    if (!resolveFinishedAssessment(assessment)) {
      navigate(testPath, { replace: true })
      return
    }
    if (!qualificationCompleted) {
      navigate(qualificationPath, { replace: true })
    }
  }, [assessment, navigate, qualificationCompleted, qualificationPath, testPath])

  useEffect(() => {
    setFlowState(getFlowState())
  }, [location.key])

  useEffect(() => {
    if (mode === 'live') {
      setAudioSuccess(false)
      setAudioError('')
    }
    if (mode === 'audio') {
      setLiveSuccess(false)
    }
  }, [mode])

  useEffect(() => {
    if (speaking?.status === 'booked' && speaking?.mode === 'live') {
      setLiveSuccess(true)
      setSelectedDate(String(speaking?.slot?.date || ''))
      setSelectedTime(String(speaking?.slot?.time || ''))
    }
    if (speaking?.status === 'submitted' && speaking?.mode === 'audio') {
      setAudioSuccess(true)
    }
  }, [speaking])

  useEffect(() => {
    if (!recordingPromptId) return undefined
    const timer = window.setInterval(() => {
      const elapsed = Math.max(0, Math.floor((Date.now() - recordingStartedAtRef.current) / 1000))
      setRecordingSeconds(elapsed)
    }, 500)
    return () => window.clearInterval(timer)
  }, [recordingPromptId])

  useEffect(() => {
    recordingsRef.current = recordings
  }, [recordings])

  useEffect(() => () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop()
    }
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => track.stop())
      mediaStreamRef.current = null
    }
    recordingsRef.current.forEach((item) => {
      if (item.objectUrl) URL.revokeObjectURL(item.objectUrl)
    })
  }, [])

  if (!resolveFinishedAssessment(assessment)) {
    return null
  }
  if (!qualificationCompleted) {
    return null
  }

  const isLiveMode = mode === 'live'

  function syncFlow(mutator) {
    const nextState = mergeFlowState(mutator)
    setFlowState(nextState)
    return nextState
  }

  function handleSwitchMode(nextMode) {
    navigate(`${location.pathname}?mode=${encodeURIComponent(nextMode)}`)
  }

  function handleSelectDate(date) {
    setSelectedDate(date)
    setSelectedTime('')
  }

  function handleConfirmLiveSlot() {
    if (!selectedDate || !selectedTime) return
    const selectedLabel = selectedSlotDay?.label || selectedDate
    syncFlow((current) => ({
      ...current,
      speaking: {
        ...(current?.speaking || {}),
        mode: 'live',
        status: 'booked',
        slot: {
          date: selectedDate,
          dateLabel: selectedLabel,
          time: selectedTime,
        },
        audioResponses: [],
      },
    }))
    setLiveSuccess(true)
  }

  function updateRecordingState(promptId, patch) {
    setRecordings((current) => current.map((item) => {
      if (item.promptId !== promptId) return item
      if (item.objectUrl && patch.objectUrl && item.objectUrl !== patch.objectUrl) URL.revokeObjectURL(item.objectUrl)
      return { ...item, ...patch }
    }))
  }

  async function beginRecording(promptId) {
    setAudioError('')
    setAudioPermissionError('')
    if (!hasMediaRecorderSupport) {
      fileInputRefs.current[promptId]?.click()
      return
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      mediaStreamRef.current = stream
      const recorder = new window.MediaRecorder(stream)
      mediaRecorderRef.current = recorder
      recordingChunksRef.current = []
      recordingStartedAtRef.current = Date.now()
      setRecordingPromptId(promptId)
      setRecordingSeconds(0)
      updateRecordingState(promptId, { status: 'recording', warning: '', source: 'record', fileName: '' })

      recorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) recordingChunksRef.current.push(event.data)
      }

      recorder.onstop = () => {
        const chunks = recordingChunksRef.current || []
        const blob = chunks.length ? new Blob(chunks, { type: recorder.mimeType || 'audio/webm' }) : null
        const durationSeconds = Math.max(1, Math.floor((Date.now() - recordingStartedAtRef.current) / 1000))
        const objectUrl = blob ? URL.createObjectURL(blob) : ''
        updateRecordingState(promptId, {
          status: objectUrl ? 'recorded' : 'idle',
          source: objectUrl ? 'record' : null,
          objectUrl,
          durationSeconds,
          warning: durationSeconds < 15 ? 'Câu trả lời hơi ngắn. Bạn có thể ghi lại nếu muốn.' : '',
          fileName: objectUrl ? 'Ghi âm trực tiếp' : '',
        })
        setRecordingPromptId('')
        setRecordingSeconds(0)
        if (mediaStreamRef.current) {
          mediaStreamRef.current.getTracks().forEach((track) => track.stop())
          mediaStreamRef.current = null
        }
      }

      recorder.start()
    } catch {
      setAudioPermissionError('Trình duyệt chưa được phép sử dụng microphone. Bạn có thể cấp quyền hoặc chọn file audio từ thiết bị.')
      updateRecordingState(promptId, { status: 'idle', source: null })
    }
  }

  function stopRecording() {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop()
    }
  }

  function handlePickAudioFile(promptId, file) {
    if (!file) return
    const objectUrl = URL.createObjectURL(file)
    updateRecordingState(promptId, {
      status: 'recorded',
      source: 'file',
      fileName: file.name || 'Audio file',
      objectUrl,
      durationSeconds: 0,
      warning: '',
    })
    setAudioPermissionError('')
  }

  function handleReplayAudio(item) {
    if (!item?.objectUrl) return
    const audio = new window.Audio(item.objectUrl)
    audio.play().catch(() => {
      setAudioError('Không thể phát lại audio trên trình duyệt hiện tại.')
    })
  }

  function handleResetAudio(promptId) {
    const current = recordings.find((item) => item.promptId === promptId)
    if (current?.objectUrl) URL.revokeObjectURL(current.objectUrl)
    updateRecordingState(promptId, {
      status: 'idle',
      source: null,
      fileName: '',
      objectUrl: '',
      durationSeconds: 0,
      warning: '',
    })
  }

  function handleSubmitAudio() {
    if (!hasAudioResponses) return
    syncFlow((current) => ({
      ...current,
      speaking: {
        ...(current?.speaking || {}),
        mode: 'audio',
        status: 'submitted',
        slot: null,
        audioResponses: recordings.map((item) => ({
          promptId: item.promptId,
          source: item.source,
          fileName: item.fileName || null,
          durationSeconds: item.durationSeconds || 0,
        })),
      },
    }))
    setAudioSuccess(true)
  }

  function renderLanding() {
    return (
      <>
        <div className='assessment-badge mb-3'>SPEAKING</div>
        <div className='assessment-section-title'>Speaking cùng giáo viên</div>
        <p className='assessment-section-lead mb-4'>Phần Speaking giúp giáo viên xác nhận mức độ phù hợp trước khi đưa ra kết quả cuối cùng và tư vấn lộ trình học.</p>
        <div className='assessment-secondary-note mb-4'>Thời lượng dự kiến: 5–7 phút</div>

        <div className='assessment-speaking-mode-grid'>
          <article className='assessment-speaking-mode-card assessment-speaking-mode-card--highlight'>
            <div className='assessment-speaking-mode-card__eyebrow'>Option A</div>
            <h2 className='assessment-speaking-mode-card__title'>Speaking trực tiếp</h2>
            <p className='assessment-speaking-mode-card__copy'>Chọn thời gian phù hợp để học sinh trao đổi trực tiếp với giáo viên trong khoảng 5–7 phút.</p>
            <div className='assessment-trust-list mb-4'>
              {['Trao đổi trực tiếp với giáo viên', 'Khoảng 5–7 phút', 'Nhận xác nhận chuyên môn sau buổi Speaking'].map((item) => (
                <div key={item} className='assessment-trust-item'>
                  <div className='assessment-trust-icon'>•</div>
                  <div className='assessment-domain-copy'>{item}</div>
                </div>
              ))}
            </div>
            <CButton color='primary' className='assessment-primary-cta w-100' onClick={() => handleSwitchMode('live')}>CHỌN LỊCH SPEAKING</CButton>
          </article>

          <article className='assessment-speaking-mode-card'>
            <div className='assessment-speaking-mode-card__eyebrow'>Option B</div>
            <h2 className='assessment-speaking-mode-card__title'>Gửi audio Speaking</h2>
            <p className='assessment-speaking-mode-card__copy'>Học sinh trả lời 3 câu hỏi Speaking và gửi audio để giáo viên xem xét.</p>
            <div className='assessment-trust-list mb-4'>
              {['Thực hiện ngay trên web', '3 câu hỏi ngắn', 'Giáo viên sẽ nghe và đánh giá sau'].map((item) => (
                <div key={item} className='assessment-trust-item'>
                  <div className='assessment-trust-icon'>•</div>
                  <div className='assessment-domain-copy'>{item}</div>
                </div>
              ))}
            </div>
            <CButton color='secondary' variant='outline' className='assessment-primary-cta w-100' onClick={() => handleSwitchMode('audio')}>GỬI AUDIO SPEAKING</CButton>
          </article>
        </div>
      </>
    )
  }

  function renderLiveMode() {
    if (liveSuccess) {
      return (
        <div className='assessment-speaking-success'>
          <div className='assessment-badge mb-3'>LIVE SPEAKING</div>
          <div className='assessment-section-title'>Đã ghi nhận lịch Speaking</div>
          <p className='assessment-section-lead mb-4'>Vitaminfun sẽ xác nhận lịch và hướng dẫn tham gia trước buổi Speaking.</p>
          <div className='assessment-speaking-summary-card mb-4'>
            <div className='assessment-speaking-summary-card__label'>Thời gian</div>
            <div className='assessment-speaking-summary-card__value'>{speaking?.slot?.dateLabel || selectedSlotDay?.label || '—'}</div>
            <div className='assessment-speaking-summary-card__value'>{speaking?.slot?.time || selectedTime || '—'}</div>
            <div className='assessment-speaking-summary-card__meta'>Speaking trực tiếp với giáo viên · khoảng 5–7 phút</div>
            {qualification?.student?.name ? <div className='assessment-speaking-summary-card__meta'>{`Học sinh: ${qualification.student.name}`}</div> : null}
          </div>
          {import.meta.env.DEV ? <div className='assessment-dev-note mb-4'>UI demo — chưa tạo booking thật.</div> : null}
          <div className='d-flex flex-wrap gap-3'>
            <CButton color='primary' className='assessment-primary-cta' onClick={() => navigate(resultPath)}>VỀ TRANG KẾT QUẢ</CButton>
            <CButton color='secondary' variant='outline' onClick={() => handleSwitchMode('audio')}>Chưa tiện đặt lịch? Gửi audio Speaking</CButton>
          </div>
        </div>
      )
    }

    return (
      <>
        <div className='assessment-badge mb-3'>LIVE SPEAKING</div>
        <div className='assessment-section-title'>Đặt lịch Speaking</div>
        <p className='assessment-section-lead mb-4'>Hãy chọn thời gian phù hợp để học sinh trao đổi trực tiếp với giáo viên.</p>

        <div className='assessment-speaking-live-layout'>
          <div className='assessment-speaking-live-dates'>
            {speakingSlots.map((slotDay) => (
              <button
                key={slotDay.date}
                type='button'
                aria-pressed={selectedDate === slotDay.date}
                className={`assessment-speaking-date-card${selectedDate === slotDay.date ? ' active' : ''}`}
                onClick={() => handleSelectDate(slotDay.date)}
              >
                <span className='assessment-speaking-date-card__label'>{slotDay.label}</span>
                <span className='assessment-speaking-date-card__meta'>{`${slotDay.times.length} khung giờ`}</span>
              </button>
            ))}
          </div>

          <div className='assessment-speaking-live-times'>
            <div className='assessment-form-section-title'>Khung giờ có sẵn</div>
            {selectedSlotDay ? (
              <div className='assessment-speaking-time-chip-wrap'>
                {selectedSlotDay.times.map((time) => (
                  <button
                    key={`${selectedSlotDay.date}-${time}`}
                    type='button'
                    aria-pressed={selectedTime === time}
                    className={`assessment-speaking-time-chip${selectedTime === time ? ' active' : ''}`}
                    onClick={() => setSelectedTime(time)}
                  >
                    {time}
                  </button>
                ))}
              </div>
            ) : <div className='assessment-secondary-note'>Chọn ngày trước để xem khung giờ.</div>}

            {selectedDate && selectedTime ? (
              <div className='assessment-speaking-summary-card mt-4'>
                <div className='assessment-speaking-summary-card__label'>Bạn đã chọn</div>
                <div className='assessment-speaking-summary-card__value'>{selectedSlotDay?.label || selectedDate}</div>
                <div className='assessment-speaking-summary-card__value'>{selectedTime}</div>
                <div className='assessment-speaking-summary-card__meta'>Speaking trực tiếp với giáo viên · khoảng 5–7 phút</div>
                {qualification?.student?.name ? <div className='assessment-speaking-summary-card__meta'>{`Học sinh: ${qualification.student.name}`}</div> : null}
              </div>
            ) : null}
          </div>
        </div>

        <div className='d-flex flex-wrap gap-3 mt-4'>
          <CButton color='primary' className='assessment-primary-cta' disabled={!selectedDate || !selectedTime} onClick={handleConfirmLiveSlot}>XÁC NHẬN LỊCH SPEAKING</CButton>
          <CButton color='secondary' variant='outline' onClick={() => handleSwitchMode('audio')}>Chưa tiện đặt lịch? Gửi audio Speaking</CButton>
        </div>
      </>
    )
  }

  function renderAudioPrompt(item, index) {
    const prompt = assessmentSpeakingPrompts[index]
    if (!prompt) return null
    const isRecording = recordingPromptId === item.promptId
    return (
      <article key={item.promptId} className='assessment-speaking-prompt-card'>
        <div className='assessment-speaking-prompt-card__header'>
          <div>
            <div className='assessment-speaking-prompt-card__eyebrow'>{`${index + 1}/3`}</div>
            <h2 className='assessment-speaking-prompt-card__title'>{prompt.title}</h2>
          </div>
          <div className={`assessment-speaking-prompt-status${item.status === 'recorded' ? ' completed' : isRecording ? ' recording' : ''}`}>
            {item.status === 'recorded' ? '✓ Đã ghi' : isRecording ? `● Đang ghi ${formatSeconds(recordingSeconds)}` : 'Sẵn sàng'}
          </div>
        </div>
        <div className='assessment-speaking-prompt-card__prompt'>{prompt.prompt}</div>
        <div className='assessment-domain-copy mb-3'>{prompt.helper}</div>

        {item.warning ? <div className='assessment-secondary-note mb-3'>{item.warning}</div> : null}
        {item.fileName ? <div className='assessment-secondary-note mb-3'>{`Tệp: ${item.fileName}`}</div> : null}
        {item.durationSeconds > 0 ? <div className='assessment-secondary-note mb-3'>{`Thời lượng: ${formatSeconds(item.durationSeconds)}`}</div> : null}

        <div className='assessment-speaking-prompt-actions'>
          {isRecording ? (
            <CButton color='danger' className='assessment-primary-cta' onClick={stopRecording}>DỪNG GHI</CButton>
          ) : item.status === 'recorded' ? (
            <>
              <CButton color='secondary' variant='outline' onClick={() => handleReplayAudio(item)}>NGHE LẠI</CButton>
              <CButton color='secondary' variant='outline' onClick={() => handleResetAudio(item.promptId)}>GHI LẠI</CButton>
            </>
          ) : (
            <>
              <CButton color='primary' className='assessment-primary-cta' onClick={() => beginRecording(item.promptId)}>BẮT ĐẦU GHI</CButton>
              <CButton color='secondary' variant='outline' onClick={() => fileInputRefs.current[item.promptId]?.click()}>CHỌN FILE AUDIO</CButton>
            </>
          )}

          <input
            ref={(node) => { fileInputRefs.current[item.promptId] = node }}
            type='file'
            accept='audio/*'
            className='assessment-file-input-hidden'
            onChange={(event) => {
              const file = event.target.files?.[0]
              handlePickAudioFile(item.promptId, file)
              event.target.value = ''
            }}
          />
        </div>
      </article>
    )
  }

  function renderAudioMode() {
    if (audioSuccess) {
      return (
        <div className='assessment-speaking-success'>
          <div className='assessment-badge mb-3'>AUDIO SPEAKING</div>
          <div className='assessment-section-title'>Đã ghi nhận phần Speaking</div>
          <p className='assessment-section-lead mb-4'>Giáo viên sẽ nghe phần trả lời và xác nhận kết quả cuối cùng.</p>
          <div className='assessment-speaking-summary-card mb-4'>
            <div className='assessment-speaking-summary-card__label'>Hình thức</div>
            <div className='assessment-speaking-summary-card__value'>Gửi audio Speaking</div>
            <div className='assessment-speaking-summary-card__meta'>3 câu hỏi ngắn đã được ghi nhận trong UI demo.</div>
            <div className='assessment-speaking-summary-card__meta'>Nếu cần thêm thông tin, Vitaminfun có thể mời học sinh Speaking trực tiếp.</div>
          </div>
          {import.meta.env.DEV ? <div className='assessment-dev-note mb-4'>UI demo — chưa upload audio thật và chưa có AI/teacher review backend.</div> : null}
          <div className='d-flex flex-wrap gap-3'>
            <CButton color='primary' className='assessment-primary-cta' onClick={() => navigate(resultPath)}>VỀ TRANG KẾT QUẢ</CButton>
            <CButton color='secondary' variant='outline' onClick={() => handleSwitchMode('live')}>Muốn trao đổi trực tiếp? Đặt lịch Speaking</CButton>
          </div>
        </div>
      )
    }

    return (
      <>
        <div className='assessment-badge mb-3'>AUDIO SPEAKING</div>
        <div className='assessment-section-title'>Gửi audio Speaking</div>
        <p className='assessment-section-lead mb-2'>Học sinh trả lời 3 câu hỏi dưới đây bằng tiếng Anh.</p>
        <div className='assessment-secondary-note mb-4'>Mỗi câu trả lời nên khoảng 30–60 giây. Hãy chọn nơi yên tĩnh và nói tự nhiên.</div>

        {audioPermissionError ? <CAlert color='warning'>{audioPermissionError}</CAlert> : null}
        {audioError ? <CAlert color='danger'>{audioError}</CAlert> : null}
        {!hasMediaRecorderSupport ? <CAlert color='info'>Trình duyệt hiện tại không hỗ trợ MediaRecorder. Bạn vẫn có thể chọn file audio từ thiết bị.</CAlert> : null}

        <div className='assessment-speaking-audio-progress mb-4'>
          {recordings.map((item, index) => (
            <div key={item.promptId} className={`assessment-speaking-audio-progress__item${item.status === 'recorded' ? ' completed' : ''}`}>
              {`Prompt ${index + 1} ${item.status === 'recorded' ? '✓' : '○'}`}
            </div>
          ))}
        </div>

        <div className='assessment-speaking-prompts-grid'>
          {recordings.map((item, index) => renderAudioPrompt(item, index))}
        </div>

        <div className='d-flex flex-wrap gap-3 mt-4'>
          <CButton color='primary' className='assessment-primary-cta' disabled={!hasAudioResponses} onClick={handleSubmitAudio}>GỬI AUDIO SPEAKING</CButton>
          <CButton color='secondary' variant='outline' onClick={() => handleSwitchMode('live')}>Muốn trao đổi trực tiếp? Đặt lịch Speaking</CButton>
        </div>
        <div className='assessment-secondary-note mt-3'>Nếu bạn refresh trang trước khi gửi, các đoạn audio ghi trực tiếp trong trình duyệt có thể cần ghi lại.</div>
      </>
    )
  }

  return (
    <CContainer className='assessment-public-shell py-3 py-md-4'>
      <CCard className='assessment-card'>
        <CCardBody className='p-4 p-md-5'>
          <AssessmentProgress currentStep={6} totalSteps={6} label='Speaking cùng giáo viên' />
          <div className='assessment-trust-panel mb-4'>
            <div className='assessment-domain-copy'>Trang này dùng chung cho cả URL theo tenant code và URL theo custom domain.</div>
            <div className='assessment-domain-copy'>{describeSpeakingStatus(speaking) || 'Speaking là bước xác nhận tiếp theo trước khi có đánh giá cuối cùng.'}</div>
          </div>

          {!mode ? renderLanding() : isLiveMode ? renderLiveMode() : renderAudioMode()}

          <div className='d-flex flex-wrap gap-3 mt-4'>
            <CButton color='secondary' variant='outline' onClick={() => navigate(resultPath)}>Quay lại kết quả sơ bộ</CButton>
          </div>
        </CCardBody>
      </CCard>
    </CContainer>
  )
}