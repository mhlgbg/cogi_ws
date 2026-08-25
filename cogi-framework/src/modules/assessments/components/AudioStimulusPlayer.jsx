import { useEffect, useRef, useState } from 'react'
import { CAlert, CButton } from '@coreui/react'
import { toAbsoluteUrl } from '../../../utils/mediaUrl'

export default function AudioStimulusPlayer({ attemptId, assessmentQuestionId, stimulus, audioState, disabled, onRegisterPlay, onSyncState }) {
  const audioRef = useRef(null)
  const [loadingAudio, setLoadingAudio] = useState(false)
  const [audioError, setAudioError] = useState('')
  const preparedMediaUrlRef = useRef('')
  const audioUrl = toAbsoluteUrl(preparedMediaUrlRef.current || stimulus?.audioAsset?.runtimeUrl || '')
  const hasAudioCapability = Boolean(stimulus?.audioAsset)
  const remaining = audioState?.remaining
  const hasLimit = audioState?.audioPlayLimit !== null && audioState?.audioPlayLimit !== undefined
  const exhausted = hasLimit && Number(remaining || 0) <= 0
  const readOnly = disabled === true

  useEffect(() => () => {
    if (audioRef.current) {
      audioRef.current.pause()
      audioRef.current = null
    }
  }, [])

  async function handlePlay() {
    if (!hasAudioCapability || disabled || exhausted) return
    setLoadingAudio(true)
    setAudioError('')
    try {
      let nextAudioUrl = preparedMediaUrlRef.current
      let playState = null
      if (!nextAudioUrl) {
        playState = await onRegisterPlay?.(attemptId, assessmentQuestionId)
        nextAudioUrl = toAbsoluteUrl(playState?.mediaUrl || stimulus?.audioAsset?.runtimeUrl || '')
        preparedMediaUrlRef.current = nextAudioUrl
      }
      if (!nextAudioUrl) throw new Error('MEDIA_URL_MISSING')
      const audio = new Audio(nextAudioUrl)
      audioRef.current = audio
      audio.onplay = () => {
        preparedMediaUrlRef.current = ''
      }
      audio.onended = () => onSyncState?.({ isPlaying: false })
      audio.onerror = () => {
        setAudioError('Không thể tải tệp âm thanh. Vui lòng thử lại hoặc liên hệ bộ phận hỗ trợ.')
        onSyncState?.({ isPlaying: false })
      }
      onSyncState?.({ ...(playState || {}), isPlaying: true })
      await audio.play()
    } catch (error) {
      setAudioError('Không thể tải tệp âm thanh. Vui lòng thử lại hoặc liên hệ bộ phận hỗ trợ.')
      onSyncState?.({ isPlaying: false })
    } finally {
      setLoadingAudio(false)
    }
  }

  function handlePause() {
    if (audioRef.current) {
      audioRef.current.pause()
      onSyncState?.({ isPlaying: false })
    }
  }

  return (
    <div className='assessment-runner-audio-box'>
      {audioError ? <CAlert color='warning' className='mb-0'>{audioError}</CAlert> : null}
      <div className='assessment-runner-audio-actions'>
        <CButton color='primary' onClick={handlePlay} disabled={disabled || loadingAudio || exhausted || !hasAudioCapability}>{readOnly ? 'Audio khóa sau khi nộp' : loadingAudio ? 'Đang chuẩn bị...' : exhausted ? 'Đã hết lượt nghe' : audioState?.audioPlayCount > 0 ? 'Nghe lại' : 'Nghe'}</CButton>
        <CButton color='secondary' variant='outline' onClick={handlePause} disabled={disabled || !audioState?.isPlaying}>Tạm dừng</CButton>
        {hasLimit
          ? <span className='small text-body-secondary'>{readOnly ? `Đã sử dụng ${audioState?.audioPlayCount || 0}/${audioState?.audioPlayLimit} lượt nghe` : remaining > 0 ? `Còn ${remaining} lượt nghe` : 'Đã hết lượt nghe'}</span>
          : <span className='small text-body-secondary'>Không giới hạn lượt nghe</span>}
        {audioState?.allowSeek === false ? <span className='small text-body-secondary'>Không cho tua audio</span> : null}
      </div>
    </div>
  )
}