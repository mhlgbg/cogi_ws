import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react'
import { CAlert, CButton } from '@coreui/react'
import { toAbsoluteUrl } from '../../../utils/mediaUrl'

const LISTEN_PROGRESS_EPSILON = 0.05

function getAudioUiState({
  hasAudioCapability,
  hasLimit,
  remaining,
  playCount,
  playLimit,
  loadingAudio,
  isPlaying,
  listenSatisfied,
  requirementEnabled,
}) {
  const normalizedRemaining = hasLimit ? Math.max(0, Number(remaining || 0)) : null
  const normalizedPlayCount = Math.max(0, Number(playCount || 0))
  const normalizedPlayLimit = hasLimit ? Math.max(0, Number(playLimit || 0)) : null
  const playbackState = loadingAudio ? 'loading' : isPlaying ? 'playing' : normalizedPlayCount > 0 && hasAudioCapability && normalizedRemaining === 0 && listenSatisfied !== true ? 'inactive_after_last_registered' : 'idle'
  const isPlaybackActive = playbackState === 'loading' || playbackState === 'playing' || playbackState === 'paused'
  const isLastPlayActive = hasLimit && normalizedRemaining === 0 && (loadingAudio || isPlaying)
  const isExhausted = hasLimit && normalizedRemaining === 0 && !isLastPlayActive
  const canStartNewPlay = hasAudioCapability && (!hasLimit || normalizedRemaining > 0)

  return {
    isPlaybackActive,
    isLastPlayActive,
    isExhausted,
    canStartNewPlay,
    playbackState,
    statusLabel: hasLimit
      ? isLastPlayActive
        ? `Đang sử dụng lượt ${normalizedPlayCount}/${normalizedPlayLimit}`
        : normalizedRemaining > 0
          ? `Còn ${normalizedRemaining} lượt nghe`
          : 'Đã hết lượt nghe'
      : 'Không giới hạn lượt nghe',
    playButtonLabel: loadingAudio
      ? 'Đang chuẩn bị...'
      : isPlaying
        ? 'Đang nghe'
        : isExhausted
          ? 'Đã hết lượt nghe'
          : normalizedPlayCount > 0
            ? 'Nghe lại'
            : 'Nghe',
  }
}

const AudioStimulusPlayer = forwardRef(function AudioStimulusPlayer({ attemptId, assessmentQuestionId, stimulus, audioState, disabled, onRegisterPlay, onMarkListenSatisfied, onSyncState }, ref) {
  const audioRef = useRef(null)
  const playbackRef = useRef({
    playId: '',
    listening: false,
    maxAllowedTime: 0,
    maxListenedTime: 0,
    thresholdNotified: false,
    playbackStarted: false,
  })
  const [loadingAudio, setLoadingAudio] = useState(false)
  const [audioError, setAudioError] = useState('')
  const preparedMediaUrlRef = useRef('')
  const audioUrl = toAbsoluteUrl(preparedMediaUrlRef.current || stimulus?.audioAsset?.runtimeUrl || '')
  const hasAudioCapability = Boolean(stimulus?.audioAsset)
  const remaining = audioState?.remaining
  const hasLimit = audioState?.audioPlayLimit !== null && audioState?.audioPlayLimit !== undefined
  const readOnly = disabled === true
  const threshold = Number(audioState?.minListenRatioBeforeAnswer || 0)
  const requirementEnabled = hasAudioCapability && threshold > 0
  const listenSatisfied = audioState?.listenRequirementSatisfied === true
  const progressRatio = Number(audioState?.currentPlaybackRatio || 0)
  const paused = audioState?.isPaused === true
  const uiState = getAudioUiState({
    hasAudioCapability,
    hasLimit,
    remaining,
    playCount: audioState?.audioPlayCount,
    playLimit: audioState?.audioPlayLimit,
    loadingAudio,
    isPlaying: audioState?.isPlaying === true || paused,
    listenSatisfied,
    requirementEnabled,
  })

  function clearPlaybackSession({ keepError = true } = {}) {
    playbackRef.current = {
      playId: '',
      listening: false,
      maxAllowedTime: 0,
      maxListenedTime: 0,
      thresholdNotified: false,
      playbackStarted: false,
    }
    if (!keepError) setAudioError('')
  }

  function syncProgress(audio) {
    if (!audio) return
    const duration = Number.isFinite(audio.duration) && audio.duration > 0 ? audio.duration : 0
    const currentTime = Number.isFinite(audio.currentTime) && audio.currentTime > 0 ? audio.currentTime : 0
    if (playbackRef.current.listening) {
      playbackRef.current.maxAllowedTime = Math.max(playbackRef.current.maxAllowedTime, currentTime + LISTEN_PROGRESS_EPSILON)
      playbackRef.current.maxListenedTime = Math.max(playbackRef.current.maxListenedTime, currentTime)
    }
    const currentPlaybackRatio = duration > 0 ? Math.min(1, playbackRef.current.maxListenedTime / duration) : 0
    onSyncState?.({ currentPlaybackRatio })
    if (requirementEnabled && listenSatisfied !== true && playbackRef.current.thresholdNotified === false && duration > 0 && currentPlaybackRatio >= threshold) {
      playbackRef.current.thresholdNotified = true
      onMarkListenSatisfied?.(playbackRef.current.playId)
    }
  }

  function attachAudioEvents(audio) {
    audio.onplay = () => {
      preparedMediaUrlRef.current = ''
      playbackRef.current.playbackStarted = true
      playbackRef.current.listening = true
      onSyncState?.({ isPlaying: true })
    }
    audio.onplaying = () => {
      playbackRef.current.playbackStarted = true
      playbackRef.current.listening = true
      onSyncState?.({ isPlaying: true })
    }
    audio.onpause = () => {
      playbackRef.current.listening = false
      syncProgress(audio)
      onSyncState?.({ isPlaying: false, isPaused: audio.ended !== true })
    }
    audio.ontimeupdate = () => {
      syncProgress(audio)
    }
    audio.onseeking = () => {
      const currentTime = Number.isFinite(audio.currentTime) ? audio.currentTime : 0
      if (currentTime > playbackRef.current.maxAllowedTime) {
        audio.currentTime = playbackRef.current.maxAllowedTime
      }
    }
    audio.onseeked = () => {
      syncProgress(audio)
    }
    audio.onended = () => {
      playbackRef.current.listening = false
      syncProgress(audio)
      onSyncState?.({ isPlaying: false, isPaused: false, currentPlaybackRatio: 1 })
      clearPlaybackSession()
      audioRef.current = null
    }
    audio.onerror = () => {
      const started = playbackRef.current.playbackStarted === true
      setAudioError('Không thể tải tệp âm thanh. Vui lòng thử lại hoặc liên hệ bộ phận hỗ trợ.')
      onSyncState?.({ isPlaying: false, isPaused: false })
      if (!started) onSyncState?.({ mediaFailedBeforePlayback: true })
      clearPlaybackSession()
      audioRef.current = null
    }
  }

  function stopAudioPlayback() {
    if (audioRef.current) {
      audioRef.current.pause()
      audioRef.current.currentTime = 0
      audioRef.current.src = ''
      audioRef.current.load?.()
      audioRef.current = null
    }
    onSyncState?.({ isPlaying: false, isPaused: false, currentPlaybackRatio: 0 })
    clearPlaybackSession()
  }

  useEffect(() => {
    setAudioError('')
  }, [assessmentQuestionId, stimulus?.audioAsset?.id, stimulus?.audioAsset?.documentId, stimulus?.audioAsset?.runtimeUrl])

  useImperativeHandle(ref, () => ({
    stopPlayback() {
      stopAudioPlayback()
    },
  }), [])

  useEffect(() => () => {
    stopAudioPlayback()
  }, [])

  async function handlePlay() {
    if (!hasAudioCapability || disabled || uiState.isExhausted) return
    setLoadingAudio(true)
    setAudioError('')
    try {
      let playState = null
      playState = await onRegisterPlay?.(attemptId, assessmentQuestionId)
      let nextAudioUrl = toAbsoluteUrl(playState?.mediaUrl || stimulus?.audioAsset?.runtimeUrl || '')
      preparedMediaUrlRef.current = nextAudioUrl
      if (!nextAudioUrl) throw new Error('MEDIA_URL_MISSING')
      stopAudioPlayback()
      clearPlaybackSession({ keepError: false })
      const audio = new Audio(nextAudioUrl)
      audioRef.current = audio
      playbackRef.current.playId = String(playState?.playId || '')
      attachAudioEvents(audio)
      onSyncState?.({ ...(playState || {}), isPlaying: false, isPaused: false, currentPlaybackRatio: 0, mediaFailedBeforePlayback: false })
      await audio.play()
    } catch (error) {
      setAudioError('Không thể tải tệp âm thanh. Vui lòng thử lại hoặc liên hệ bộ phận hỗ trợ.')
      onSyncState?.({ isPlaying: false, isPaused: false })
      clearPlaybackSession()
    } finally {
      setLoadingAudio(false)
    }
  }

  function handlePause() {
    if (audioRef.current) {
      audioRef.current.pause()
    }
  }

  async function handleResume() {
    if (!audioRef.current || disabled) return
    try {
      await audioRef.current.play()
    } catch {
      setAudioError('Không thể tiếp tục phát tệp âm thanh. Vui lòng thử lại hoặc liên hệ bộ phận hỗ trợ.')
      onSyncState?.({ isPlaying: false, isPaused: false })
    }
  }

  return (
    <div className='assessment-runner-audio-box'>
      {audioError ? <CAlert color='warning' className='mb-0'>{audioError}</CAlert> : null}
      <div className='assessment-runner-audio-actions'>
        <CButton color='primary' onClick={paused ? handleResume : handlePlay} disabled={disabled || loadingAudio || (!paused && uiState.isExhausted) || !hasAudioCapability}>{readOnly ? 'Audio khóa sau khi nộp' : paused ? 'Tiếp tục' : uiState.playButtonLabel}</CButton>
        <CButton color='secondary' variant='outline' onClick={handlePause} disabled={disabled || !audioState?.isPlaying}>Tạm dừng</CButton>
        {hasLimit
          ? <span className='small text-body-secondary'>{readOnly ? `Đã sử dụng ${audioState?.audioPlayCount || 0}/${audioState?.audioPlayLimit} lượt nghe` : uiState.statusLabel}</span>
          : <span className='small text-body-secondary'>Không giới hạn lượt nghe</span>}
        {audioState?.allowSeek === false ? <span className='small text-body-secondary'>Không cho tua audio</span> : null}
        {requirementEnabled && listenSatisfied ? <span className='small text-body-secondary'>Bạn có thể trả lời.</span> : null}
      </div>
    </div>
  )
})

export default AudioStimulusPlayer