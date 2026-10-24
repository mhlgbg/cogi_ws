import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import {
  CAlert,
  CBadge,
  CButton,
  CCard,
  CCardBody,
  CCol,
  CFormCheck,
  CRow,
  CSpinner,
} from '@coreui/react'
import { GhostRaceEngine } from '../utils/ghostRaceEngine'
import { TouchInputAdapter } from '../utils/touchInputAdapter'
import {
  getGameApiMessage,
  getGhostRaceSession,
  getMyGhostRaceAttempts,
  getMyGhostRacePersonalBest,
  startGhostRaceAttempt,
  submitGhostRaceAttempt,
} from '../services/gameService'

const VKL_THEME = {
  yellow: '#F4C400',
  yellowAlt: '#F5C400',
  deepBlack: '#0F0F10',
  softBlack: '#1A1A1C',
  charcoal: '#232326',
  white: '#FFFFFF',
  warmWhite: '#F7F7F2',
  mutedGold: '#D4AF37',
}

const styles = {
  page: {
    background: `linear-gradient(180deg, ${VKL_THEME.deepBlack} 0%, ${VKL_THEME.softBlack} 55%, ${VKL_THEME.charcoal} 100%)`,
    color: VKL_THEME.warmWhite,
    minHeight: '100vh',
  },
  card: {
    background: VKL_THEME.softBlack,
    color: VKL_THEME.warmWhite,
    border: `1px solid ${VKL_THEME.charcoal}`,
  },
  statLabel: { color: 'rgba(247,247,242,0.74)' },
  primaryButton: {
    background: VKL_THEME.yellow,
    borderColor: VKL_THEME.yellow,
    color: VKL_THEME.deepBlack,
    fontWeight: 700,
  },
  secondaryButton: {
    background: VKL_THEME.warmWhite,
    borderColor: VKL_THEME.warmWhite,
    color: VKL_THEME.deepBlack,
    fontWeight: 600,
  },
  toggleButton: {
    background: 'transparent',
    borderColor: VKL_THEME.mutedGold,
    color: VKL_THEME.warmWhite,
    fontWeight: 600,
  },
  toggleButtonActive: {
    background: VKL_THEME.yellow,
    borderColor: VKL_THEME.yellow,
    color: VKL_THEME.deepBlack,
    fontWeight: 700,
  },
  canvasWrap: {
    display: 'block',
    width: '100%',
    height: 'auto',
    borderRadius: '12px',
    background: VKL_THEME.deepBlack,
    border: `1px solid ${VKL_THEME.charcoal}`,
  },
}

const REPLAY_STORAGE_KEY = 'vkl-ghost-race-replays-v1'
const MAX_REPLAY_HISTORY = 20
const MAX_OPPONENTS = 5
const MAX_MOBILE_RACERS = 5
const MAX_MOBILE_GHOSTS = 4
const OPPONENT_COLORS = ['#FFFFFF', '#F7F7F2', '#D4AF37', '#E5E7EB', '#C7CAD1']
const TICK_SECONDS = 1 / 60

function detectClientDeviceProfile() {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') {
    return {
      platform: 'desktop',
      userAgent: '',
      maxTouchPoints: 0,
      coarsePointer: false,
      userAgentDataMobile: null,
    }
  }

  const userAgent = String(navigator.userAgent || '')
  const loweredUa = userAgent.toLowerCase()
  const maxTouchPoints = Number(navigator.maxTouchPoints || 0)
  const coarsePointer = Boolean(window.matchMedia?.('(pointer: coarse)')?.matches)
  const userAgentDataMobile = typeof navigator.userAgentData?.mobile === 'boolean'
    ? navigator.userAgentData.mobile
    : null

  const mobileByUa = /android|iphone|ipad|ipod|mobile|phone|tablet/i.test(loweredUa)
  const mobileByHints = userAgentDataMobile === true || maxTouchPoints >= 2 || coarsePointer
  const platform = (mobileByUa || mobileByHints) ? 'mobile' : 'desktop'

  return {
    platform,
    userAgent,
    maxTouchPoints,
    coarsePointer,
    userAgentDataMobile,
  }
}

function normalizeReplayEntry(item, index) {
  const finish = Number(item?.result?.finishTimeSeconds)
  if (!Number.isFinite(finish)) return null
  const replayId = String(item.replayId || `legacy-${index}`)
  return {
    ...item,
    replayId,
    displayName: item.displayName || `Runner ${index + 1}`,
    result: {
      ...item.result,
      finishTimeSeconds: finish,
    },
  }
}

function getReplayStateAtElapsed(replay, elapsedSeconds) {
  const states = Array.isArray(replay?.tickStates) ? replay.tickStates : []
  if (states.length === 0) {
    return { distance: 0, speed: 0, finished: false }
  }
  const clampedElapsed = Math.max(0, Number(elapsedSeconds) || 0)
  const tickFloat = clampedElapsed / TICK_SECONDS
  const index = Math.floor(tickFloat)
  const nextIndex = Math.min(index + 1, states.length - 1)
  const alpha = Math.max(0, Math.min(1, tickFloat - index))
  const current = states[Math.min(index, states.length - 1)]
  const next = states[nextIndex]
  const distance = current.distance + ((next.distance - current.distance) * alpha)
  const speed = current.speed + ((next.speed - current.speed) * alpha)
  const finished = clampedElapsed >= (replay?.result?.finishTimeSeconds ?? Number.POSITIVE_INFINITY)
  return {
    distance: finished ? 200 : Math.min(200, distance),
    speed,
    finished,
  }
}

function loadReplayHistory() {
  if (typeof window === 'undefined') return []
  try {
    const raw = window.localStorage.getItem(REPLAY_STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed
      .map((item, index) => normalizeReplayEntry(item, index))
      .filter(Boolean)
      .filter((item) => item?.result?.finishTimeSeconds && Array.isArray(item?.inputs))
      .sort((a, b) => Number(a.result.finishTimeSeconds) - Number(b.result.finishTimeSeconds))
      .slice(0, MAX_REPLAY_HISTORY)
  } catch (error) {
    return []
  }
}

function saveReplayHistory(history) {
  if (typeof window === 'undefined') return
  try {
    const normalized = history
      .map((item, index) => normalizeReplayEntry(item, index))
      .filter(Boolean)
      .slice(0, MAX_REPLAY_HISTORY)
    window.localStorage.setItem(REPLAY_STORAGE_KEY, JSON.stringify(normalized))
  } catch (error) {
    // ignore storage failures in prototype mode
  }
}

const initialHud = {
  distance: 0,
  speed: 0,
  lane: 1,
  status: 'idle',
  message: 'Nhấn Start để vào vị trí xuất phát.',
  progress: 0,
  elapsedSeconds: 0,
  finishTimeSeconds: null,
  targetSpeed: 0,
  mode: 'race',
  practiceRemainingSeconds: 30,
  soundEnabled: true,
  startState: 'idle',
  runMode: 'player',
  replayAvailable: false,
  ghost: {
    active: false,
    distance: null,
    leadDistance: null,
    leader: 'none',
    finished: false,
  },
  stepCount: 0,
  invalidRepeatedPresses: 0,
  averageCadence: 0,
  averageSpeed: 0,
  cadence: {
    rawCadence: 0,
    rawStrideCadence: 0,
    smoothedCadence: 0,
    cadenceQuality: 0,
    cadenceStability: 0,
    status: 'Nhịp quá chậm',
  },
  debug: null,
}

const STAGES = {
  OVERVIEW: 'overview',
  LINEUP: 'lineup',
  COUNTDOWN: 'countdown',
  RACING: 'racing',
  SUBMITTING: 'submitting',
  RESULT: 'result',
}

export default function GhostRacePage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const officialGameId = Number(searchParams.get('gameId') || 0) || null
  const isMobilePrototype = searchParams.get('prototype') === 'mobile'
  const hasPrototypeAndGameId = isMobilePrototype && Boolean(officialGameId)
  const effectiveOfficialGameId = isMobilePrototype ? null : officialGameId
  const technicalMode = searchParams.get('debug') === '1' || searchParams.get('tech') === '1'
  const canvasRef = useRef(null)
  const leftTouchButtonRef = useRef(null)
  const rightTouchButtonRef = useRef(null)
  const touchAdapterRef = useRef(null)
  const [isMobileViewport, setIsMobileViewport] = useState(() => {
    if (typeof window === 'undefined') return false
    return window.innerWidth <= 767
  })
  const [clientDevice, setClientDevice] = useState(() => detectClientDeviceProfile())
  const engineRef = useRef(null)
  const [hud, setHud] = useState(initialHud)
  const [mode, setMode] = useState('race')
  const [debugEnabled, setDebugEnabled] = useState(false)
  const [rhythmGuideEnabled, setRhythmGuideEnabled] = useState(true)
  const [soundEnabled, setSoundEnabled] = useState(true)
  const [replayHistory, setReplayHistory] = useState([])
  const [lastReplay, setLastReplay] = useState(null)
  const [activeReplay, setActiveReplay] = useState(null)
  const [selectedGhostIds, setSelectedGhostIds] = useState([])
  const [nameEdits, setNameEdits] = useState({})
  const [raceContext, setRaceContext] = useState(null)
  const [postFinishElapsed, setPostFinishElapsed] = useState(null)
  const consumedReplayRef = useRef(null)
  const activeAttemptRef = useRef(null)
  const postFinishRafRef = useRef(null)
  const postFinishLastTsRef = useRef(0)
  const countdownWatchdogRef = useRef(null)
  const pendingEngineStartRef = useRef(false)
  const submitRequestSeqRef = useRef(0)
  const runLifecycleRef = useRef({
    runId: 0,
    completionHandled: false,
  })
  const [sessionLoading, setSessionLoading] = useState(false)
  const [sessionError, setSessionError] = useState('')
  const [sessionInfo, setSessionInfo] = useState(null)
  const [attempts, setAttempts] = useState([])
  const [personalBest, setPersonalBest] = useState(null)
  const [uiStage, setUiStage] = useState(STAGES.OVERVIEW)
  const [frozenRaceContext, setFrozenRaceContext] = useState(null)
  const [pendingSubmitPayload, setPendingSubmitPayload] = useState(null)
  const [lastSubmitStatus, setLastSubmitStatus] = useState(null)
  const [clockNow, setClockNow] = useState(() => Date.now())

  useEffect(() => {
    if (!effectiveOfficialGameId) return undefined
    const timer = window.setInterval(() => setClockNow(Date.now()), 1000)
    return () => window.clearInterval(timer)
  }, [effectiveOfficialGameId])

  useEffect(() => {
    if (typeof window === 'undefined') return undefined
    const updateViewport = () => setIsMobileViewport(window.innerWidth <= 767)
    updateViewport()
    window.addEventListener('resize', updateViewport)
    return () => window.removeEventListener('resize', updateViewport)
  }, [])

  useEffect(() => {
    setClientDevice(detectClientDeviceProfile())
  }, [])

  const instancePlayPlatform = String(sessionInfo?.raceConfig?.playPlatform || 'web').toLowerCase()
  const expectsMobileDevice = Boolean(effectiveOfficialGameId) && instancePlayPlatform === 'mobile'
  const expectsDesktopDevice = Boolean(effectiveOfficialGameId) && instancePlayPlatform === 'desktop'
  const isMobileClientDevice = clientDevice.platform === 'mobile'
  const isOfficialPlatformMismatch = expectsMobileDevice
    ? !isMobileClientDevice
    : expectsDesktopDevice
      ? isMobileClientDevice
      : false
  const platformMismatchMessage = expectsDesktopDevice
    ? 'Cuộc thi này dành cho máy tính. Vui lòng sử dụng máy tính để tham gia.'
    : 'Cuộc thi này dành cho điện thoại. Vui lòng mở trên điện thoại để tham gia.'
  const shouldBlockOfficialStart = Boolean(effectiveOfficialGameId) && isOfficialPlatformMismatch
  const isMobileLayout = isMobilePrototype || expectsMobileDevice || (!effectiveOfficialGameId && isMobileViewport)

  useEffect(() => {
    if (!engineRef.current) return undefined
    if (!isMobileLayout) {
      touchAdapterRef.current?.destroy()
      touchAdapterRef.current = null
      return undefined
    }
    const adapter = new TouchInputAdapter({ engine: engineRef.current })
    if (leftTouchButtonRef.current) adapter.bindButton(leftTouchButtonRef.current, 'left')
    if (rightTouchButtonRef.current) adapter.bindButton(rightTouchButtonRef.current, 'right')
    touchAdapterRef.current = adapter
    return () => {
      adapter.destroy()
      touchAdapterRef.current = null
    }
  }, [isMobileLayout, mode, uiStage])

  const phaseRemainingText = useMemo(() => {
    if (!sessionInfo?.phaseCode) return '-'
    const now = clockNow
    if (sessionInfo.phaseCode === 'trial') {
      const end = sessionInfo?.game?.trialEndAt ? new Date(sessionInfo.game.trialEndAt).getTime() : NaN
      if (!Number.isFinite(end)) return '-'
      const remainingMs = Math.max(0, end - now)
      return `${Math.floor(remainingMs / 60000)}m ${Math.floor((remainingMs % 60000) / 1000)}s`
    }
    if (sessionInfo.phaseCode === 'official') {
      const end = sessionInfo?.game?.endsAt ? new Date(sessionInfo.game.endsAt).getTime() : NaN
      if (!Number.isFinite(end)) return '-'
      const remainingMs = Math.max(0, end - now)
      return `${Math.floor(remainingMs / 60000)}m ${Math.floor((remainingMs % 60000) / 1000)}s`
    }
    return '-'
  }, [sessionInfo, clockNow])

  useEffect(() => {
    const shouldMountEngine = uiStage === STAGES.COUNTDOWN || uiStage === STAGES.RACING
    if (!shouldMountEngine) {
      if (engineRef.current) {
        engineRef.current.destroy()
        engineRef.current = null
      }
      return undefined
    }
    const canvas = canvasRef.current
    if (!canvas) return undefined
    if (engineRef.current?.canvas === canvas) return undefined
    if (engineRef.current) {
      engineRef.current.destroy()
      engineRef.current = null
    }

    const engine = new GhostRaceEngine({
      canvas,
      onHud: setHud,
      initialMode: mode,
      debugEnabled,
      soundEnabled,
    })
    engineRef.current = engine
    return undefined
  }, [uiStage, mode, debugEnabled, soundEnabled])

  useEffect(() => () => {
    if (countdownWatchdogRef.current) {
      window.clearTimeout(countdownWatchdogRef.current)
      countdownWatchdogRef.current = null
    }
    if (engineRef.current) {
      engineRef.current.destroy()
      engineRef.current = null
    }
  }, [])

  useEffect(() => {
    engineRef.current?.setMode(mode)
  }, [mode])

  useEffect(() => {
    engineRef.current?.setDebugEnabled(debugEnabled)
  }, [debugEnabled])

  useEffect(() => {
    engineRef.current?.setSoundEnabled(soundEnabled)
  }, [soundEnabled])

  useEffect(() => {
    const loaded = loadReplayHistory()
    setReplayHistory(loaded)
    setLastReplay(loaded[0] || null)
    setSelectedGhostIds(loaded.slice(0, 3).map((entry) => entry.replayId))
  }, [])

  useEffect(() => {
    const validIds = new Set(replayHistory.map((item) => item.replayId))
    setSelectedGhostIds((prev) => prev.filter((id) => validIds.has(id)).slice(0, MAX_OPPONENTS))
  }, [replayHistory])

  useEffect(() => {
    let mounted = true
    async function loadOfficialSession() {
      if (!effectiveOfficialGameId) {
        setSessionInfo(null)
        setAttempts([])
        setPersonalBest(null)
        setRaceContext(null)
        setFrozenRaceContext(null)
        setUiStage(STAGES.OVERVIEW)
        setSessionError('')
        return
      }
      setSessionLoading(true)
      setSessionError('')
      try {
        const [session, attemptsResult, pbResult] = await Promise.all([
          getGhostRaceSession(effectiveOfficialGameId),
          getMyGhostRaceAttempts(effectiveOfficialGameId),
          getMyGhostRacePersonalBest(effectiveOfficialGameId),
        ])
        if (!mounted) return
        setSessionInfo(session)
        setRaceContext(session?.raceContext || null)
        setAttempts(Array.isArray(attemptsResult) ? attemptsResult : [])
        setPersonalBest(pbResult?.personalBest || null)
        if (![STAGES.COUNTDOWN, STAGES.RACING, STAGES.SUBMITTING].includes(uiStage)) {
          setUiStage(STAGES.OVERVIEW)
        }
      } catch (error) {
        if (!mounted) return
        setSessionError(getGameApiMessage(error, 'Không tải được phiên đua chính thức.'))
      } finally {
        if (mounted) setSessionLoading(false)
      }
    }
    loadOfficialSession()
    return () => {
      mounted = false
    }
  }, [effectiveOfficialGameId])

  useEffect(() => {
    if (hud.status === 'finished' && hud.mode === 'race' && hud.runMode === 'player') {
      postFinishLastTsRef.current = 0
      const tick = (ts) => {
        if (postFinishLastTsRef.current === 0) postFinishLastTsRef.current = ts
        const delta = (ts - postFinishLastTsRef.current) / 1000
        postFinishLastTsRef.current = ts
        setPostFinishElapsed((prev) => {
          const base = prev === null ? (hud.elapsedSeconds || 0) : prev
          return base + Math.min(0.05, Math.max(0, delta))
        })
        postFinishRafRef.current = window.requestAnimationFrame(tick)
      }
      if (!postFinishRafRef.current) postFinishRafRef.current = window.requestAnimationFrame(tick)
    } else {
      if (postFinishRafRef.current) {
        window.cancelAnimationFrame(postFinishRafRef.current)
        postFinishRafRef.current = null
      }
      setPostFinishElapsed(null)
      postFinishLastTsRef.current = 0
    }
    return () => {
      if (postFinishRafRef.current) {
        window.cancelAnimationFrame(postFinishRafRef.current)
        postFinishRafRef.current = null
      }
    }
  }, [hud.status, hud.mode, hud.runMode, hud.elapsedSeconds])

  const refreshOfficialData = async () => {
    if (!effectiveOfficialGameId) return
    const withTimeout = (promise, timeoutMs, timeoutMessage) => new Promise((resolve, reject) => {
      const timer = window.setTimeout(() => reject(new Error(timeoutMessage)), timeoutMs)
      promise
        .then((value) => {
          window.clearTimeout(timer)
          resolve(value)
        })
        .catch((error) => {
          window.clearTimeout(timer)
          reject(error)
        })
    })
    const [sessionResult, attemptRows, pbResult] = await withTimeout(
      Promise.all([
        getGhostRaceSession(effectiveOfficialGameId),
        getMyGhostRaceAttempts(effectiveOfficialGameId),
        getMyGhostRacePersonalBest(effectiveOfficialGameId),
      ]),
      12000,
      'Timeout while refreshing official race data',
    )
    setSessionInfo(sessionResult)
    setRaceContext(sessionResult?.raceContext || null)
    setAttempts(Array.isArray(attemptRows) ? attemptRows : [])
    setPersonalBest(pbResult?.personalBest || null)
  }

  const handleStart = async () => {
    if (shouldBlockOfficialStart) {
      setSessionError(platformMismatchMessage)
      return
    }
    const shouldCreateAttempt = effectiveOfficialGameId
      && !isMobilePrototype
      && mode === 'race'
      && hud.runMode !== 'replay'

    if (shouldCreateAttempt) {
      setSessionError('')
      try {
        const startedAttempt = await startGhostRaceAttempt(effectiveOfficialGameId, {
          engineVersion: 'ghost-race-engine-v1',
          countdown: sessionInfo?.raceConfig?.countdown || undefined,
          clientPlatform: clientDevice.platform,
          userAgent: clientDevice.userAgent,
          deviceSignals: {
            maxTouchPoints: clientDevice.maxTouchPoints,
            coarsePointer: clientDevice.coarsePointer,
            userAgentDataMobile: clientDevice.userAgentDataMobile,
          },
        })
        const attemptId = Number(startedAttempt?.attemptId || 0)
        const attemptToken = String(startedAttempt?.attemptToken || '').trim()
        if (!attemptId || !attemptToken) {
          setSessionError('Không nhận được attempt hợp lệ từ backend. Vui lòng thử lại.')
          return
        }
        activeAttemptRef.current = startedAttempt
        if (startedAttempt?.raceContext) {
          setRaceContext(startedAttempt.raceContext)
          setFrozenRaceContext(startedAttempt.raceContext)
        }
      } catch (error) {
        setSessionError(getGameApiMessage(error, 'Không thể bắt đầu lượt chạy chính thức.'))
        return
      }
    }
    setPendingSubmitPayload(null)
    setLastSubmitStatus(null)
    setHud(initialHud)
    consumedReplayRef.current = null
    runLifecycleRef.current = {
      runId: runLifecycleRef.current.runId + 1,
      completionHandled: false,
    }
    pendingEngineStartRef.current = true
    setUiStage(STAGES.COUNTDOWN)
  }

  const handleGoToOverview = async () => {
    submitRequestSeqRef.current += 1
    try {
      await refreshOfficialData()
    } catch (error) {
      setSessionError(getGameApiMessage(error, 'Không thể tải lại dữ liệu tổng quan.'))
    }
    engineRef.current?.reset()
    activeAttemptRef.current = null
    pendingEngineStartRef.current = false
    setFrozenRaceContext(null)
    setPendingSubmitPayload(null)
    setLastSubmitStatus(null)
    runLifecycleRef.current = {
      runId: runLifecycleRef.current.runId,
      completionHandled: false,
    }
    setUiStage(STAGES.OVERVIEW)
  }

  const handleGoToLineup = async () => {
    if (shouldBlockOfficialStart) {
      setSessionError(platformMismatchMessage)
      return
    }
    submitRequestSeqRef.current += 1
    setSessionError('')
    engineRef.current?.reset()
    activeAttemptRef.current = null
    pendingEngineStartRef.current = false
    setFrozenRaceContext(null)
    setPendingSubmitPayload(null)
    setLastSubmitStatus(null)
    runLifecycleRef.current = {
      runId: runLifecycleRef.current.runId,
      completionHandled: false,
    }
    setUiStage(STAGES.LINEUP)
    try {
      if (effectiveOfficialGameId) {
        await refreshOfficialData()
      }
    } catch (error) {
      setSessionError(getGameApiMessage(error, 'Không thể tải danh sách xuất phát mới nhất.'))
    }
  }

  useEffect(() => {
    if (uiStage !== STAGES.COUNTDOWN) return
    if (!pendingEngineStartRef.current) return
    if (!engineRef.current) return
    pendingEngineStartRef.current = false
    engineRef.current.start()
  }, [uiStage, hud.status])

  useEffect(() => {
    if (uiStage === STAGES.COUNTDOWN && (hud.status === 'go' || hud.status === 'running')) {
      if (countdownWatchdogRef.current) {
        window.clearTimeout(countdownWatchdogRef.current)
        countdownWatchdogRef.current = null
      }
      setUiStage(STAGES.RACING)
      return
    }
  }, [hud.status, uiStage])

  useEffect(() => {
    if (uiStage !== STAGES.COUNTDOWN) {
      if (countdownWatchdogRef.current) {
        window.clearTimeout(countdownWatchdogRef.current)
        countdownWatchdogRef.current = null
      }
      return
    }
    if (countdownWatchdogRef.current) {
      window.clearTimeout(countdownWatchdogRef.current)
      countdownWatchdogRef.current = null
    }
    countdownWatchdogRef.current = window.setTimeout(() => {
      if (uiStage !== STAGES.COUNTDOWN) return
      if (hud.status === 'on_your_marks' || hud.status === 'set' || hud.status === 'go' || hud.status === 'running') return
      setSessionError('Khởi tạo lượt chạy quá thời gian. Vui lòng thử lại.')
      setUiStage(STAGES.LINEUP)
    }, 6000)
    return () => {
      if (countdownWatchdogRef.current) {
        window.clearTimeout(countdownWatchdogRef.current)
        countdownWatchdogRef.current = null
      }
    }
  }, [uiStage, hud.status])

  const handlePause = () => {
    engineRef.current?.pause()
  }

  const handleReset = () => {
    engineRef.current?.reset()
    activeAttemptRef.current = null
  }

  const handleReplayRun = () => {
    const replay = lastReplay
    if (!replay) return
    const started = engineRef.current?.startReplay(replay)
    if (started) setActiveReplay(replay)
  }

  const handlePauseReplay = () => {
    if (hud.runMode !== 'replay') return
    engineRef.current?.pause()
  }

  const handleResumeReplay = () => {
    if (hud.runMode !== 'replay') return
    engineRef.current?.start()
  }

  const handleRestartReplay = () => {
    if (!activeReplay) return
    engineRef.current?.startReplay(activeReplay)
  }

  const handleRaceWithSelectedGhosts = () => {
    const selected = selectedGhostReplays
    if (selected.length === 0) return
    setMode('race')
    engineRef.current?.setMode('race')
    engineRef.current?.setGhostReplay(null)
    engineRef.current?.start()
  }

  const handleClearGhost = () => {
    engineRef.current?.setGhostReplay(null)
  }

  const handleToggleGhost = (replayId) => {
    setSelectedGhostIds((prev) => {
      if (prev.includes(replayId)) return prev.filter((id) => id !== replayId)
      if (prev.length >= MAX_OPPONENTS) return prev
      return [...prev, replayId]
    })
  }

  const handlePickFastest = () => {
    setSelectedGhostIds(replayHistory.slice(0, MAX_OPPONENTS).map((entry) => entry.replayId))
  }

  const handleClearSelection = () => {
    setSelectedGhostIds([])
  }

  const handleRenameReplay = (replayId) => {
    const nextName = (nameEdits[replayId] || '').trim()
    if (!nextName) return
    const nextHistory = replayHistory.map((entry) => (entry.replayId === replayId ? { ...entry, displayName: nextName } : entry))
    setReplayHistory(nextHistory)
    saveReplayHistory(nextHistory)
    setNameEdits((prev) => ({ ...prev, [replayId]: '' }))
  }

  const handleDeleteReplay = (replayId) => {
    if (typeof window !== 'undefined') {
      const confirmed = window.confirm('Xóa replay này khỏi bộ nhớ cục bộ?')
      if (!confirmed) return
    }
    const nextHistory = replayHistory.filter((entry) => entry.replayId !== replayId)
    setReplayHistory(nextHistory)
    if (lastReplay?.replayId === replayId) setLastReplay(nextHistory[0] || null)
    setSelectedGhostIds((prev) => prev.filter((id) => id !== replayId))
    saveReplayHistory(nextHistory)
  }

  const handleReplaySingle = (replay) => {
    if (!replay) return
    const started = engineRef.current?.startReplay(replay)
    if (started) {
      setLastReplay(replay)
      setActiveReplay(replay)
    }
  }
  const startButtonLabel = hud.status === 'false_start' ? 'Xuất phát lại' : 'Start'

  const cadenceMeterMax = (hud.cadence?.optimalStepCadenceHz || 5.35) + (hud.cadence?.optimalWindowHz || 1.05) + 1.1
  const cadenceRatio = Math.min(Math.max((hud.cadence?.smoothedCadence || 0) / cadenceMeterMax, 0), 1)
  const cadenceQuality = hud.cadence?.cadenceQuality || 0
  const cadenceBand = hud.cadence?.band || 'slow'
  const finishSummary = hud.finishTimeSeconds
    ? `Avg speed ${hud.averageSpeed.toFixed(2)} m/s • Avg cadence ${hud.averageCadence.toFixed(2)} hz`
    : ''
  const guideBeatSeconds = 1 / Math.max(0.1, hud.cadence?.optimalStepCadenceHz || 5.35)
  const guideStepIndex = Math.floor((hud.elapsedSeconds || 0) / guideBeatSeconds) % 2
  const guideLeftActive = rhythmGuideEnabled && guideStepIndex === 0
  const guideRightActive = rhythmGuideEnabled && guideStepIndex === 1
  const speedSeries = Array.isArray(hud.debug?.speedHistory) ? hud.debug.speedHistory : []
  const speedChartPoints = speedSeries.length > 1
    ? speedSeries.map((value, index) => {
      const maxSpeed = Math.max(0.001, ...speedSeries)
      const x = (index / (speedSeries.length - 1)) * 260
      const y = 66 - ((value / maxSpeed) * 66)
      return `${x},${y}`
    }).join(' ')
    : ''
  const bestReplay = replayHistory.length > 0 ? replayHistory[0] : null
  const selectedGhostReplays = useMemo(
    () => selectedGhostIds
      .map((id) => replayHistory.find((entry) => entry.replayId === id))
      .filter(Boolean),
    [selectedGhostIds, replayHistory],
  )
  const effectiveRaceContext = frozenRaceContext || raceContext
  const raceElapsedForOpponents = postFinishElapsed ?? (hud.elapsedSeconds || 0)
  const debugManualOpponents = useMemo(
    () => selectedGhostReplays.map((entry, index) => {
      const state = getReplayStateAtElapsed(entry, raceElapsedForOpponents)
      return {
        id: `opponent-local-${entry.replayId}`,
        lane: index + 2,
        type: 'opponent',
        displayName: entry.displayName || `Runner ${index + 1}`,
        pbSeconds: Number(entry.result.finishTimeSeconds),
        distance: state.distance,
        speed: state.speed,
        finished: state.finished,
        finishTimeSeconds: Number(entry.result.finishTimeSeconds),
        replayId: entry.replayId,
        color: OPPONENT_COLORS[index % OPPONENT_COLORS.length],
        displayOrder: index + 2,
        isSelf: false,
      }
    }),
    [selectedGhostReplays, raceElapsedForOpponents],
  )
  const liveParticipant = useMemo(
    () => ({
      id: 'live-player',
      lane: Number(effectiveRaceContext?.playerLane || sessionInfo?.participant?.laneNumber || 1),
      type: 'live',
      displayName: 'Bạn',
      pbSeconds: personalBest?.finishTimeSeconds ? Number(personalBest.finishTimeSeconds) : null,
      distance: Math.min(200, Number(hud.distance || 0)),
      speed: Number(hud.speed || 0),
      finished: Boolean(hud.finishTimeSeconds),
      finishTimeSeconds: Number(hud.finishTimeSeconds || Number.POSITIVE_INFINITY),
      color: VKL_THEME.yellow,
      displayOrder: 1,
      isSelf: true,
    }),
    [hud.distance, hud.speed, hud.finishTimeSeconds, effectiveRaceContext, sessionInfo, personalBest],
  )
  const automaticDisplayRows = useMemo(
    () => (Array.isArray(effectiveRaceContext?.lineup) ? effectiveRaceContext.lineup : []).map((entry, index) => {
      const isSelf = Boolean(entry?.isSelf) || entry?.kind === 'player'
      if (isSelf) {
        return {
          ...liveParticipant,
          id: `runner-${entry?.userId || 'self'}`,
          lane: Number(entry?.lane || effectiveRaceContext?.playerLane || sessionInfo?.participant?.laneNumber || 0) || null,
          displayName: entry?.displayName || 'Bạn',
          pbSeconds: Number.isFinite(Number(entry?.finishTimeSeconds)) ? Number(entry.finishTimeSeconds) : liveParticipant.pbSeconds,
          displayOrder: Number(entry?.displayOrder || index + 1),
          isSelf: true,
          type: 'live',
        }
      }
      const replayPayload = entry?.replayPayload || null
      const state = getReplayStateAtElapsed(replayPayload, raceElapsedForOpponents)
      return {
        id: `runner-${entry?.userId || index + 1}`,
        lane: Number(entry?.lane || 0) || null,
        type: 'opponent',
        displayName: entry?.displayName || `Runner ${index + 1}`,
        pbSeconds: Number.isFinite(Number(entry?.finishTimeSeconds)) ? Number(entry.finishTimeSeconds) : null,
        distance: state.distance,
        speed: state.speed,
        finished: state.finished,
        finishTimeSeconds: Number.isFinite(Number(entry?.finishTimeSeconds)) ? Number(entry.finishTimeSeconds) : Number.POSITIVE_INFINITY,
        color: OPPONENT_COLORS[index % OPPONENT_COLORS.length],
        displayOrder: Number(entry?.displayOrder || index + 1),
        isSelf: false,
      }
    }).sort((a, b) => Number(a.displayOrder || 0) - Number(b.displayOrder || 0)),
    [effectiveRaceContext, raceElapsedForOpponents, liveParticipant, sessionInfo],
  )
  const fallbackDisplayRows = useMemo(() => {
    const items = [liveParticipant, ...debugManualOpponents]
    return items
      .map((item, index) => ({ ...item, displayOrder: Number(item.displayOrder || (index + 1)) }))
      .sort((a, b) => Number(a.displayOrder || 0) - Number(b.displayOrder || 0))
  }, [liveParticipant, debugManualOpponents])
  const displayRows = useMemo(
    () => {
      let baseRows = []
      if (!effectiveOfficialGameId) {
        baseRows = fallbackDisplayRows
      } else if (automaticDisplayRows.length > 0) {
        baseRows = automaticDisplayRows
      } else {
        baseRows = [{ ...liveParticipant, displayOrder: 1 }]
      }

      if (!isMobileLayout) return baseRows

      const selfRow = baseRows.find((entry) => entry.isSelf) || null
      const opponents = baseRows
        .filter((entry) => !entry.isSelf)
        .sort((a, b) => {
          const pbA = Number.isFinite(a.pbSeconds) ? Number(a.pbSeconds) : Number.POSITIVE_INFINITY
          const pbB = Number.isFinite(b.pbSeconds) ? Number(b.pbSeconds) : Number.POSITIVE_INFINITY
          if (Math.abs(pbA - pbB) > 0.0001) return pbA - pbB
          return Number(a.displayOrder || 999) - Number(b.displayOrder || 999)
        })
        .slice(0, MAX_MOBILE_GHOSTS)

      const limited = selfRow ? [selfRow, ...opponents] : baseRows.slice(0, MAX_MOBILE_RACERS)
      let ghostIndex = 0
      return limited.map((entry, index) => {
        if (entry.isSelf) {
          return {
            ...entry,
            displayOrder: index + 1,
            mobileLabel: 'Bạn',
          }
        }
        ghostIndex += 1
        return {
          ...entry,
          displayOrder: index + 1,
          mobileLabel: `Ghost ${ghostIndex}`,
        }
      })
    },
    [effectiveOfficialGameId, automaticDisplayRows, fallbackDisplayRows, liveParticipant, isMobileLayout],
  )
  const raceParticipants = useMemo(() => {
    const list = [...displayRows]
    return [...list]
      .sort((a, b) => {
        if (Math.abs(b.distance - a.distance) > 0.001) return b.distance - a.distance
        if (a.finished && b.finished && Math.abs(a.finishTimeSeconds - b.finishTimeSeconds) > 0.0001) {
          return a.finishTimeSeconds - b.finishTimeSeconds
        }
        return String(a.id).localeCompare(String(b.id))
      })
      .map((entry, index) => ({ ...entry, liveRank: index + 1 }))
  }, [displayRows])
  const liveRankById = useMemo(() => {
    const map = new Map()
    for (const entry of raceParticipants) {
      map.set(entry.id, entry.liveRank)
    }
    return map
  }, [raceParticipants])
  const displayRowsWithLiveRank = useMemo(
    () => displayRows.map((entry) => ({ ...entry, liveRank: liveRankById.get(entry.id) || null })),
    [displayRows, liveRankById],
  )
  const liveRanking = displayRowsWithLiveRank.find((entry) => entry.isSelf)
  const frontRunner = raceParticipants[0] || null
  const aheadOfLive = liveRanking && liveRanking.liveRank > 1 ? raceParticipants[liveRanking.liveRank - 2] : null
  const behindLive = liveRanking && liveRanking.liveRank < raceParticipants.length ? raceParticipants[liveRanking.liveRank] : null
  const leaderLabel = frontRunner ? `${frontRunner.displayName}` : '-'
  const gapAhead = aheadOfLive ? Math.max(0, aheadOfLive.distance - liveParticipant.distance) : null
  const gapBehind = behindLive ? Math.max(0, liveParticipant.distance - behindLive.distance) : null
  const globalLeaderboard = Array.isArray(sessionInfo?.leaderboard?.entries) ? sessionInfo.leaderboard.entries : []
  const missingReplayParticipants = Array.isArray(effectiveRaceContext?.missingReplayParticipants) ? effectiveRaceContext.missingReplayParticipants : []
  const laneIssues = Array.isArray(effectiveRaceContext?.laneIssues) ? effectiveRaceContext.laneIssues : []
  const isReplayMode = hud.runMode === 'replay'
  const canReplay = Boolean(lastReplay)
  const latestAttempt = Array.isArray(attempts) && attempts.length > 0 ? attempts[0] : null
  const playerRank = sessionInfo?.leaderboard?.myPersonalBest?.rank || raceContext?.summary?.myRank || null
  const totalRankedParticipants = sessionInfo?.leaderboard?.entries?.length || raceContext?.summary?.totalRankedParticipants || 0
  const countdownText = hud.startState === 'on_your_marks'
    ? '3'
    : hud.startState === 'set'
      ? '2'
      : hud.startState === 'go'
        ? '1'
        : (hud.status === 'running' && (hud.elapsedSeconds || 0) <= 0.45)
          ? 'GO'
          : null
  const resultFinishTime = pendingSubmitPayload?.finishTimeSeconds || hud.finishTimeSeconds || null
  const submitStatusValue = String(lastSubmitStatus?.submitResult?.status || lastSubmitStatus?.submitResult?.verificationStatus || '').toLowerCase()
  const resultValid = lastSubmitStatus?.ok && submitStatusValue === 'verified'
  const resultVerificationLabel = pendingSubmitPayload?.falseStart
    ? 'False Start'
    : (lastSubmitStatus?.submitResult?.status || lastSubmitStatus?.submitResult?.verificationStatus || '-')
  const latestAttemptStatus = String(latestAttempt?.status || '').toLowerCase()
  const latestAttemptReason = latestAttempt?.verificationReason || ''
  const latestAttemptFailed = Boolean(latestAttempt) && latestAttemptStatus !== 'verified'
  const mobileHeaderStatus = isMobilePrototype ? 'Prototype' : (sessionInfo?.phaseCode || 'Trial')
  const mobileTimeValue = (hud.finishTimeSeconds ?? (hud.mode === 'practice' ? hud.practiceRemainingSeconds : hud.elapsedSeconds)).toFixed(2)
  const mobileRankOrLane = `#${liveRanking?.liveRank || '-'} / ${Math.max(1, raceParticipants.length)}`
  const mobileGapLabel = aheadOfLive
    ? `Kém ${aheadOfLive.displayName} ${gapAhead?.toFixed(2)}m`
    : (behindLive ? `Hơn ${behindLive.displayName} ${gapBehind?.toFixed(2)}m` : 'Đang dẫn đầu')

  const submitOfficialAttempt = async (payload) => {
    const requestSeq = ++submitRequestSeqRef.current
    setPendingSubmitPayload(payload || null)
    setLastSubmitStatus(null)
    setUiStage(STAGES.SUBMITTING)
    if (!effectiveOfficialGameId) {
      setLastSubmitStatus({
        ok: true,
        submitResult: { status: payload?.falseStart ? 'false_start' : 'verified', verificationStatus: payload?.falseStart ? 'rejected' : 'verified' },
      })
      setUiStage(STAGES.OVERVIEW)
      return
    }
    const activeAttempt = activeAttemptRef.current
    if (!activeAttempt?.attemptId || !activeAttempt?.attemptToken) {
      setLastSubmitStatus({
        ok: false,
        error: 'Thiếu attempt đang hoạt động để gửi kết quả.',
      })
      setUiStage(STAGES.RESULT)
      return
    }
    try {
      const withTimeout = (promise, timeoutMs, timeoutMessage) => new Promise((resolve, reject) => {
        const timer = window.setTimeout(() => reject(new Error(timeoutMessage)), timeoutMs)
        promise
          .then((value) => {
            window.clearTimeout(timer)
            resolve(value)
          })
          .catch((error) => {
            window.clearTimeout(timer)
            reject(error)
          })
      })
      const submitResult = await withTimeout(
        submitGhostRaceAttempt(effectiveOfficialGameId, {
          attemptId: activeAttempt.attemptId,
          attemptToken: activeAttempt.attemptToken,
          ...payload,
        }),
        12000,
        'Timeout while submitting attempt',
      )
      if (submitRequestSeqRef.current !== requestSeq) return
      await refreshOfficialData()
      if (submitRequestSeqRef.current !== requestSeq) return
      setLastSubmitStatus({
        ok: true,
        submitResult,
      })
      activeAttemptRef.current = null
      setFrozenRaceContext(null)
      setPendingSubmitPayload(null)
      setUiStage(STAGES.OVERVIEW)
    } catch (error) {
      if (submitRequestSeqRef.current !== requestSeq) return
      setSessionError(getGameApiMessage(error, 'Không thể nộp kết quả lượt chạy chính thức.'))
      setLastSubmitStatus({
        ok: false,
        error: getGameApiMessage(error, 'Không thể nộp kết quả lượt chạy chính thức.'),
      })
      setUiStage(STAGES.RESULT)
    }
  }

  useEffect(() => {
    if (hud.status !== 'finished' || hud.mode !== 'race' || hud.runMode !== 'player') return
    if (uiStage === STAGES.SUBMITTING || uiStage === STAGES.RESULT) return
    if (runLifecycleRef.current.completionHandled) return
    const replay = engineRef.current?.consumeCompletedReplay?.()
    if (!replay || !replay.replayId || replay.falseStart) return
    if (consumedReplayRef.current === replay.replayId) return
    consumedReplayRef.current = replay.replayId
    runLifecycleRef.current = {
      runId: runLifecycleRef.current.runId,
      completionHandled: true,
    }

    const replayWithName = normalizeReplayEntry(replay, replayHistory.length) || replay
    const nextHistory = [replayWithName, ...replayHistory]
      .filter((item, index, arr) => arr.findIndex((ref) => ref.replayId === item.replayId) === index)
      .map((item, index) => normalizeReplayEntry(item, index))
      .filter(Boolean)
      .sort((a, b) => Number(a.result.finishTimeSeconds) - Number(b.result.finishTimeSeconds))
      .slice(0, MAX_REPLAY_HISTORY)
    setReplayHistory(nextHistory)
    setLastReplay(replayWithName)
    saveReplayHistory(nextHistory)
    submitOfficialAttempt({
      didFinish: true,
      falseStart: false,
      finishTimeSeconds: replayWithName?.result?.finishTimeSeconds,
      elapsedSeconds: replayWithName?.result?.finishTimeSeconds,
      distanceMeters: replayWithName?.result?.distance,
      validSteps: replayWithName?.result?.validSteps,
      averageSpeed: replayWithName?.result?.averageSpeed,
      averageCadence: replayWithName?.result?.averageCadence,
      invalidRepeatedPresses: replayWithName?.result?.invalidRepeatedPresses,
      replayMeta: replayWithName?.result || null,
      replayPayload: replayWithName,
    })
  }, [hud.status, hud.mode, hud.runMode, replayHistory, uiStage])

  useEffect(() => {
    if (hud.status !== 'false_start' || hud.mode !== 'race' || hud.runMode !== 'player') return
    if (uiStage === STAGES.SUBMITTING || uiStage === STAGES.RESULT) return
    if (runLifecycleRef.current.completionHandled) return
    const falseStartEvidence = hud.falseStart && ['left', 'right'].includes(String(hud.falseStart.foot || '').toLowerCase())
      ? hud.falseStart
      : null
    if (!falseStartEvidence) {
      setSessionError('Phát hiện trạng thái xuất phát lỗi nhưng không có bằng chứng input trước GO. Lượt chạy sẽ được ghi nhận là không hoàn thành, không tính false start.')
    }
    runLifecycleRef.current = {
      runId: runLifecycleRef.current.runId,
      completionHandled: true,
    }
    submitOfficialAttempt({
      didFinish: false,
      falseStart: Boolean(falseStartEvidence),
      elapsedSeconds: hud.elapsedSeconds || 0,
      distanceMeters: hud.distance || 0,
      validSteps: hud.stepCount || 0,
      averageSpeed: hud.averageSpeed || 0,
      averageCadence: hud.averageCadence || 0,
      invalidRepeatedPresses: hud.invalidRepeatedPresses || 0,
      replayMeta: {
        reason: falseStartEvidence ? 'false_start' : 'pre_go_interrupted_without_input_evidence',
        falseStart: falseStartEvidence,
      },
      replayPayload: null,
    })
  }, [hud.status, hud.mode, hud.runMode, hud.elapsedSeconds, hud.distance, hud.stepCount, hud.averageSpeed, hud.averageCadence, hud.invalidRepeatedPresses, hud.falseStart, uiStage])

  if (uiStage === STAGES.OVERVIEW) {
    return (
      <div
        className='container-fluid py-4 vkl-ghost-race-theme'
        style={{
          ...styles.page,
          paddingBottom: isMobileLayout ? 'calc(170px + env(safe-area-inset-bottom))' : undefined,
        }}
      >
        <div className='d-flex justify-content-between align-items-center gap-3 flex-wrap mb-3'>
          <div>
            {isMobileLayout ? (
              <>
                <div className='small' style={{ color: 'rgba(247,247,242,0.72)' }}>{mobileHeaderStatus}</div>
                <h2 className='mb-0'>VKL Sprint 200m</h2>
              </>
            ) : (
              <>
                <div className='small' style={{ color: 'rgba(247,247,242,0.72)' }}>
                  Game Center / {effectiveOfficialGameId ? `Official Session #${effectiveOfficialGameId}` : 'Prototype'}
                </div>
                <h2 className='mb-0'>{sessionInfo?.game?.name || 'Asynchronous Sprint'}</h2>
              </>
            )}
          </div>
          <CButton style={styles.toggleButton} size={isMobileLayout ? 'sm' : undefined} onClick={() => navigate('/game-center')}>
            {isMobileLayout ? 'Quay lại' : 'Quay lại Game Center'}
          </CButton>
        </div>
        {sessionError ? <CAlert className='mb-3' color='danger'>{sessionError}</CAlert> : null}
        {lastSubmitStatus?.ok ? (
          <CAlert className='mb-3' color='success'>
            Đã ghi nhận lượt chạy. PB và thứ hạng chỉ cập nhật khi attempt hợp lệ (verified) trong phase hiện tại.
          </CAlert>
        ) : null}
        {latestAttemptFailed ? (
          <CAlert className='mb-3' color='warning'>
            Lượt gần nhất chưa được tính thành tích chính thức: <strong>{latestAttempt?.status || 'rejected'}</strong>
            {latestAttemptReason ? ` — ${latestAttemptReason}` : ''}
            {sessionInfo?.raceConfig?.cutoffSeconds ? ` (cutoff: ${sessionInfo.raceConfig.cutoffSeconds}s)` : ''}
          </CAlert>
        ) : null}
        <CRow className='g-3 mb-3'>
          <CCol md={6}>
            <CCard className='border-0 shadow-sm h-100' style={styles.card}>
              <CCardBody className='d-grid gap-2'>
                <div><strong>Phase:</strong> {sessionInfo?.phaseCode || '-'}</div>
                <div><strong>Còn lại:</strong> {phaseRemainingText}</div>
                <div><strong>PB cá nhân:</strong> {personalBest?.finishTimeSeconds ? `${Number(personalBest.finishTimeSeconds).toFixed(2)}s` : 'Chưa có'}</div>
                <div><strong>Thứ hạng:</strong> {playerRank ? `${playerRank}/${Math.max(1, totalRankedParticipants)}` : '-'}</div>
                <div><strong>Số người có thành tích:</strong> {totalRankedParticipants}</div>
                <div className='d-flex gap-2 mt-2'>
                  <CButton style={styles.primaryButton} onClick={handleGoToLineup} disabled={shouldBlockOfficialStart}>Đua ngay</CButton>
                  {technicalMode ? <CButton style={styles.toggleButton} onClick={() => setUiStage(STAGES.RACING)} disabled={shouldBlockOfficialStart}>Vào kỹ thuật</CButton> : null}
                </div>
              </CCardBody>
            </CCard>
          </CCol>
          <CCol md={6}>
            <CCard className='border-0 shadow-sm h-100' style={styles.card}>
              <CCardBody>
                <div className='fw-semibold mb-2'>Bảng xếp hạng rút gọn</div>
                {globalLeaderboard.length === 0 ? (
                  <div className='small' style={styles.statLabel}>Chưa có thành tích hợp lệ.</div>
                ) : (
                  <div className='table-responsive'>
                    <table className='table table-sm mb-0' style={{ color: VKL_THEME.warmWhite }}>
                      <thead><tr><th>#</th><th>VĐV</th><th>Lane</th><th>PB</th></tr></thead>
                      <tbody>
                        {globalLeaderboard.slice(0, 5).map((entry) => (
                          <tr key={`ov-${entry.userId}-${entry.rank}`}>
                            <td>{entry.rank}</td>
                            <td>{entry.displayName}</td>
                            <td>{entry.laneNumber || '-'}</td>
                            <td>{Number(entry.finishTimeSeconds).toFixed(2)}s</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CCardBody>
            </CCard>
          </CCol>
        </CRow>
      </div>
    )
  }

  if (uiStage === STAGES.LINEUP) {
    return (
      <div className='container-fluid py-4 vkl-ghost-race-theme' style={styles.page}>
        <div className='d-flex justify-content-between align-items-center gap-3 flex-wrap mb-3'>
          <div>
            <div className='small' style={{ color: 'rgba(247,247,242,0.72)' }}>Lineup</div>
            <h2 className='mb-0'>{sessionInfo?.game?.name || 'Asynchronous Sprint'}</h2>
          </div>
          <CButton style={styles.toggleButton} onClick={() => navigate('/game-center')}>Quay lại Game Center</CButton>
        </div>
        {sessionError ? <CAlert className='mb-3' color='danger'>{sessionError}</CAlert> : null}
        <CCard className='border-0 shadow-sm mb-3' style={styles.card}>
          <CCardBody>
            <div className='fw-semibold mb-2'>Danh sách xuất phát (cố định khi bấm Sẵn sàng)</div>
            <div className='small mb-2' style={styles.statLabel}>Sắp xếp theo PB tại thời điểm lập lượt chạy. Lane giữ nguyên theo đăng ký.</div>
            {displayRowsWithLiveRank.length === 0 ? (
              <div className='small' style={styles.statLabel}>Chưa có dữ liệu lineup. Hãy thử tải lại.</div>
            ) : (
              <ol className='mb-0'>
                {displayRowsWithLiveRank.map((runner) => (
                  <li key={`lineup-${runner.id}`} style={{ marginBottom: '6px', color: runner.isSelf ? VKL_THEME.yellow : VKL_THEME.warmWhite }}>
                    <strong>{runner.isSelf ? 'Bạn' : runner.displayName}</strong> • Lane {runner.lane || '-'} • PB {Number.isFinite(runner.pbSeconds) ? `${Number(runner.pbSeconds).toFixed(2)}s` : 'Chưa có'}
                  </li>
                ))}
              </ol>
            )}
            {laneIssues.length > 0 ? (
              <CAlert className='mt-3 mb-0' color='warning'>Có VĐV thiếu lane trong dữ liệu đăng ký. Hệ thống không tự gán lane giả.</CAlert>
            ) : null}
          </CCardBody>
        </CCard>
        <div className='d-flex gap-2'>
          <CButton style={styles.secondaryButton} onClick={handleGoToOverview}>Quay lại</CButton>
          <CButton style={styles.primaryButton} onClick={handleStart} disabled={shouldBlockOfficialStart}>Sẵn sàng</CButton>
        </div>
      </div>
    )
  }

  if (uiStage === STAGES.SUBMITTING || uiStage === STAGES.RESULT) {
    return (
      <div className='container-fluid py-4 vkl-ghost-race-theme' style={styles.page}>
        <div className='d-flex justify-content-between align-items-center gap-3 flex-wrap mb-3'>
          <div>
            <div className='small' style={{ color: 'rgba(247,247,242,0.72)' }}>Kết quả lượt chạy</div>
            <h2 className='mb-0'>{sessionInfo?.game?.name || 'Asynchronous Sprint'}</h2>
          </div>
          <CButton style={styles.toggleButton} onClick={() => navigate('/game-center')}>Quay lại Game Center</CButton>
        </div>
        {sessionError ? <CAlert className='mb-3' color='danger'>{sessionError}</CAlert> : null}
        <CCard className='border-0 shadow-sm mb-3' style={styles.card}>
          <CCardBody>
            {uiStage === STAGES.SUBMITTING ? (
              <div className='d-flex align-items-center gap-2'><CSpinner size='sm' /> Đang xác nhận kết quả từ backend...</div>
            ) : (
              <div className='d-grid gap-2'>
                <div><strong>Thời gian lượt chạy:</strong> {resultFinishTime ? `${Number(resultFinishTime).toFixed(2)}s` : '-'}</div>
                <div><strong>Trạng thái:</strong> {resultVerificationLabel}</div>
                <div><strong>Hợp lệ:</strong> {resultValid ? 'Có' : 'Không'}</div>
                <div><strong>PB hiện tại:</strong> {personalBest?.finishTimeSeconds ? `${Number(personalBest.finishTimeSeconds).toFixed(2)}s` : 'Chưa có'}</div>
                <div><strong>Thứ hạng toàn giải:</strong> {playerRank ? `${playerRank}/${Math.max(1, totalRankedParticipants)}` : '-'}</div>
              </div>
            )}
          </CCardBody>
        </CCard>
        <div className='d-flex gap-2 flex-wrap'>
          <CButton style={styles.secondaryButton} onClick={handleGoToOverview}>Về tổng quan</CButton>
          <CButton style={styles.primaryButton} onClick={handleGoToLineup}>Đua tiếp</CButton>
          {uiStage === STAGES.RESULT && lastSubmitStatus?.ok === false && pendingSubmitPayload ? (
            <CButton style={styles.toggleButton} onClick={() => submitOfficialAttempt(pendingSubmitPayload)}>Thử gửi lại</CButton>
          ) : null}
        </div>
      </div>
    )
  }

  return (
    <div className='container-fluid py-4 vkl-ghost-race-theme' style={styles.page}>
      <style>{`
        .vkl-ghost-race-theme .form-check-input:checked { background-color: ${VKL_THEME.yellow}; border-color: ${VKL_THEME.yellow}; }
        .vkl-ghost-race-theme .form-check-input:focus { border-color: ${VKL_THEME.yellow}; box-shadow: 0 0 0 0.2rem rgba(244,196,0,0.25); }
        .vkl-ghost-race-theme .form-check-label { color: ${VKL_THEME.warmWhite}; }
      `}</style>
      <div className='d-flex justify-content-between align-items-center gap-3 flex-wrap mb-3'>
        <div>
          <div className='small' style={{ color: 'rgba(247,247,242,0.72)' }}>
            Game Center / {effectiveOfficialGameId ? `Official Session #${effectiveOfficialGameId}` : 'Prototype'}
          </div>
          <h2 className='mb-0'>{sessionInfo?.game?.name || 'Asynchronous Sprint'}</h2>
        </div>
        <CButton style={styles.toggleButton} onClick={() => navigate('/game-center')}>
          Quay lại Game Center
        </CButton>
      </div>

      {sessionError ? (
        <CAlert className='mb-3' color='danger'>{sessionError}</CAlert>
      ) : null}

      {isMobilePrototype ? (
        <CAlert className='mb-3' style={{ background: 'rgba(244,196,0,0.14)', borderColor: VKL_THEME.mutedGold, color: VKL_THEME.warmWhite }}>
          Mobile Prototype – Thành tích thử nghiệm, chưa ghi nhận chính thức.
        </CAlert>
      ) : null}

      {hasPrototypeAndGameId ? (
        <CAlert className='mb-3' color='info'>Prototype mode đang bật cùng gameId. Phiên này chạy local-only và không ghi Attempt backend.</CAlert>
      ) : null}

      {shouldBlockOfficialStart ? (
        <CAlert className='mb-3' color='warning'>{platformMismatchMessage}</CAlert>
      ) : null}

      {effectiveOfficialGameId && !isMobileLayout ? (
        <CCard className='border-0 shadow-sm mb-3' style={styles.card}>
          <CCardBody>
            {sessionLoading ? (
              <div className='small' style={styles.statLabel}>Đang tải phiên đua chính thức...</div>
            ) : (
              <div className='d-flex flex-wrap gap-3 align-items-center small'>
                <div><strong>Game:</strong> {sessionInfo?.game?.name || `#${effectiveOfficialGameId}`}</div>
                <div><strong>Lane:</strong> {sessionInfo?.participant?.laneNumber || '-'}</div>
                <div><strong>Phase:</strong> {sessionInfo?.phaseCode || '-'}</div>
                <div><strong>Còn lại:</strong> {phaseRemainingText}</div>
                <div><strong>Run:</strong> {sessionInfo?.game?.currentRunVersion || '-'}</div>
                <div><strong>Distance:</strong> {sessionInfo?.raceConfig?.distanceMeters || 200}m</div>
                <div><strong>Cutoff:</strong> {sessionInfo?.raceConfig?.cutoffSeconds || 120}s</div>
                <div><strong>PB:</strong> {personalBest?.finishTimeSeconds ? `${Number(personalBest.finishTimeSeconds).toFixed(2)}s` : 'Chưa có'}</div>
                <div><strong>Attempts:</strong> {attempts.length}</div>
              </div>
            )}
          </CCardBody>
        </CCard>
      ) : null}

      <CAlert className='mb-4' style={{ background: 'rgba(244,196,0,0.14)', borderColor: VKL_THEME.mutedGold, color: VKL_THEME.warmWhite }}>
        {isMobileLayout
          ? 'Rhythm-only mode: chỉ tính bước hợp lệ sau GO.'
          : 'Rhythm-only mode: không obstacle, không nhảy/cúi/chuyển làn. Điều khiển chính thức bằng ← / → và chỉ tính bước sau tín hiệu GO.'}
      </CAlert>

      <div className='d-flex gap-3 mb-4 flex-wrap align-items-center'>
        <CBadge color='warning'>{uiStage === STAGES.COUNTDOWN ? 'Countdown' : 'Racing'}</CBadge>
        {!isMobileLayout ? <span className='small' style={styles.statLabel}>Điều khiển: ArrowLeft / ArrowRight</span> : null}
        <CButton style={styles.secondaryButton} onClick={handleGoToOverview}>Hủy lượt</CButton>
        {isMobileLayout ? (
          <>
            <CButton style={styles.secondaryButton} onClick={handlePause}>Pause</CButton>
            <CButton style={styles.secondaryButton} onClick={handleReset}>Reset</CButton>
          </>
        ) : null}
        {!isMobileLayout && technicalMode ? (
          <>
            <CButton style={styles.secondaryButton} onClick={handlePause}>Pause</CButton>
            <CButton style={styles.secondaryButton} onClick={handleReset}>Reset</CButton>
            <CFormCheck
              id='ghost-race-debug'
              label='Debug'
              checked={debugEnabled}
              onChange={(event) => setDebugEnabled(Boolean(event.target.checked))}
            />
            <CFormCheck
              id='ghost-race-rhythm-guide'
              label='Rhythm guide'
              checked={rhythmGuideEnabled}
              onChange={(event) => setRhythmGuideEnabled(Boolean(event.target.checked))}
            />
            <CFormCheck
              id='ghost-race-sound'
              label='Start gun sound'
              checked={soundEnabled}
              onChange={(event) => setSoundEnabled(Boolean(event.target.checked))}
            />
          </>
        ) : null}
      </div>

      {uiStage === STAGES.COUNTDOWN ? (
        <CCard className='border-0 shadow-sm mb-4' style={styles.card}>
          <CCardBody className='text-center'>
            <div className='small mb-2' style={styles.statLabel}>Chuẩn bị xuất phát</div>
            <div style={{ fontSize: '48px', fontWeight: 800, color: VKL_THEME.yellow }}>{countdownText || '...'}</div>
            <div className='small mt-2' style={styles.statLabel}>Bước chỉ được tính sau GO</div>
          </CCardBody>
        </CCard>
      ) : null}

      {isMobileLayout ? (
        <CCard className='border-0 shadow-sm mb-3' style={styles.card}>
          <CCardBody>
            <div className='row g-2 text-center'>
              <div className='col-6'>
                <div className='small' style={styles.statLabel}>Time</div>
                <div className='fw-bold fs-4' style={{ color: VKL_THEME.yellow }}>{mobileTimeValue}s</div>
              </div>
              <div className='col-6'>
                <div className='small' style={styles.statLabel}>Distance</div>
                <div className='fw-bold fs-5'>{hud.distance.toFixed(0)}m / 200m</div>
              </div>
              <div className='col-6'>
                <div className='small' style={styles.statLabel}>Speed</div>
                <div className='fw-bold fs-5'>{hud.speed.toFixed(2)} m/s</div>
              </div>
              <div className='col-6'>
                <div className='small' style={styles.statLabel}>Rank</div>
                <div className='fw-bold fs-5'>{mobileRankOrLane}</div>
              </div>
            </div>
          </CCardBody>
        </CCard>
      ) : (
        <CCard className='border-0 shadow-sm mb-4' style={styles.card}>
          <CCardBody>
            <div className='d-flex gap-3 flex-wrap align-items-center justify-content-between'>
              <div>
                <div className='small' style={styles.statLabel}>Replay mode</div>
                <div><strong>{isReplayMode ? 'Đang phát lại' : 'Đang chạy trực tiếp'}</strong></div>
              </div>
              <div>
                <div className='small' style={styles.statLabel}>Personal Best</div>
                <div><strong>{personalBest?.finishTimeSeconds ? `${Number(personalBest.finishTimeSeconds).toFixed(2)}s` : '-'}</strong></div>
              </div>
              <div>
                <div className='small' style={styles.statLabel}>Thứ hạng realtime</div>
                <div><strong>{liveRanking ? `${liveRanking.liveRank}/${raceParticipants.length}` : '-'}</strong></div>
              </div>
              <div>
                <div className='small' style={styles.statLabel}>Người dẫn đầu</div>
                <div><strong>{leaderLabel}</strong></div>
              </div>
              <div>
                <div className='small' style={styles.statLabel}>Khoảng cách</div>
                <div>
                  <strong>
                    {aheadOfLive ? `Kém ${aheadOfLive.displayName} ${gapAhead?.toFixed(2)}m` : 'Đang dẫn đầu'}
                    {behindLive ? ` • Hơn ${behindLive.displayName} ${gapBehind?.toFixed(2)}m` : ''}
                  </strong>
                </div>
              </div>
              {isReplayMode ? (
                <div className='d-flex gap-2'>
                  <CButton style={styles.secondaryButton} onClick={handlePauseReplay}>Pause Replay</CButton>
                  <CButton style={styles.secondaryButton} onClick={handleResumeReplay}>Resume Replay</CButton>
                  <CButton style={styles.toggleButton} onClick={handleRestartReplay}>Restart Replay</CButton>
                </div>
              ) : null}
            </div>
          </CCardBody>
        </CCard>
      )}

      <CRow className='g-3 mb-4'>
        <CCol lg={isMobileLayout ? 12 : 7}>
          <CCard className='border-0 shadow-sm h-100' style={styles.card}>
            <CCardBody>
              <div className='d-flex justify-content-between align-items-center mb-2'>
                <div className='fw-semibold'>{isMobileLayout ? 'Đường chạy' : 'LIVE PLAYER'}</div>
                {!isMobileLayout ? <div className='small' style={styles.statLabel}>ArrowLeft / ArrowRight</div> : null}
              </div>
              <canvas
                ref={canvasRef}
                width={960}
                height={430}
                style={styles.canvasWrap}
              />
            </CCardBody>
          </CCard>
        </CCol>
        <CCol lg={isMobileLayout ? 12 : 5}>
          <CCard className='border-0 shadow-sm h-100' style={styles.card}>
            <CCardBody>
              {isMobileLayout ? (
                <>
                  <div className='d-flex flex-column gap-1 mb-2'>
                    <div className='fw-semibold'>Ghost race mini • Từ GO: {raceElapsedForOpponents.toFixed(2)}s</div>
                    <div className='small' style={styles.statLabel}>Hạng {mobileRankOrLane}</div>
                    <div className='small' style={styles.statLabel}>Người dẫn đầu: {leaderLabel}</div>
                    <div className='small' style={styles.statLabel}>{mobileGapLabel}</div>
                  </div>
                  <svg
                    width='100%'
                    height={Math.max(120, (displayRowsWithLiveRank.length * 30) + 24)}
                    viewBox={`0 0 520 ${Math.max(120, (displayRowsWithLiveRank.length * 30) + 24)}`}
                    style={{ background: VKL_THEME.deepBlack, borderRadius: '10px', border: `1px solid ${VKL_THEME.charcoal}` }}
                  >
                    <rect x='8' y='8' width='504' height={Math.max(102, displayRowsWithLiveRank.length * 30)} fill={VKL_THEME.softBlack} stroke={VKL_THEME.charcoal} />
                    {displayRowsWithLiveRank.map((runner, index) => {
                      const laneY = 24 + (index * 30)
                      const xStart = 110
                      const xEnd = 496
                      const x = xStart + ((Math.max(0, Math.min(200, runner.distance)) / 200) * (xEnd - xStart))
                      const laneLabel = runner.mobileLabel || (runner.isSelf ? 'Bạn' : `Ghost ${index}`)
                      return (
                        <g key={runner.id}>
                          <text x='16' y={laneY + 4} fill={runner.isSelf ? VKL_THEME.yellow : VKL_THEME.warmWhite} fontSize='11' fontWeight={runner.isSelf ? 700 : 500}>
                            {laneLabel}
                          </text>
                          <line x1={xStart} y1={laneY} x2={xEnd} y2={laneY} stroke={runner.isSelf ? 'rgba(244,196,0,0.6)' : 'rgba(255,255,255,0.18)'} strokeWidth={runner.isSelf ? 2 : 1.2} />
                          <circle cx={x} cy={laneY} r={runner.isSelf ? 6 : 5} fill={runner.isSelf ? VKL_THEME.yellow : runner.color} />
                        </g>
                      )
                    })}
                    <text x='110' y={Math.max(116, (displayRowsWithLiveRank.length * 30) + 16)} fill={VKL_THEME.warmWhite} fontSize='10'>0m</text>
                    <text x='470' y={Math.max(116, (displayRowsWithLiveRank.length * 30) + 16)} fill={VKL_THEME.warmWhite} fontSize='10'>200m</text>
                  </svg>
                </>
              ) : (
                <>
                  <div className='d-flex justify-content-between align-items-center mb-2'>
                    <div className='fw-semibold'>BẢNG ĐUA BẤT ĐỒNG BỘ</div>
                    <div className='small' style={styles.statLabel}>Từ GO: {raceElapsedForOpponents.toFixed(2)}s</div>
                  </div>
                  <svg width='100%' height='300' viewBox='0 0 520 300' style={{ background: VKL_THEME.deepBlack, borderRadius: '10px', border: `1px solid ${VKL_THEME.charcoal}` }}>
                    <rect x='20' y='24' width='480' height='240' fill={VKL_THEME.softBlack} stroke={VKL_THEME.charcoal} />
                    {[0, 1, 2, 3, 4, 5].map((index) => (
                      <line key={`meter-${index}`} x1={20 + (index * 96)} y1='24' x2={20 + (index * 96)} y2='264' stroke='rgba(244,196,0,0.26)' strokeDasharray='4 6' />
                    ))}
                    {[...displayRowsWithLiveRank].map((runner, index) => {
                      const laneY = 46 + (index * 34)
                      const x = 28 + ((Math.max(0, Math.min(200, runner.distance)) / 200) * 460)
                      const statusText = runner.finished ? `FINISHED ${Number.isFinite(runner.finishTimeSeconds) ? `(${runner.finishTimeSeconds.toFixed(2)}s)` : ''}` : 'RUNNING'
                      return (
                        <g key={runner.id}>
                          <line x1='24' y1={laneY} x2='496' y2={laneY} stroke='rgba(255,255,255,0.08)' />
                          <circle cx={x} cy={laneY} r='8' fill={runner.type === 'live' ? VKL_THEME.yellow : runner.color} />
                          <text x='30' y={laneY - 11} fill={VKL_THEME.warmWhite} fontSize='11'>
                            Dòng {runner.displayOrder} • Lane {runner.lane || '-'} • {runner.isSelf ? 'Bạn' : runner.displayName}
                          </text>
                          <text x='350' y={laneY - 11} fill={VKL_THEME.mutedGold} fontSize='10'>
                            {runner.distance.toFixed(1)}m · PB {Number.isFinite(runner.pbSeconds) ? `${Number(runner.pbSeconds).toFixed(2)}s` : '-'} · Rank realtime #{runner.liveRank || '-'} · {statusText}
                          </text>
                        </g>
                      )
                    })}
                    <text x='24' y='286' fill={VKL_THEME.warmWhite} fontSize='10'>0m</text>
                    <text x='468' y='286' fill={VKL_THEME.warmWhite} fontSize='10'>200m</text>
                  </svg>
                </>
              )}
            </CCardBody>
          </CCard>
        </CCol>
      </CRow>

      {effectiveOfficialGameId && !isMobileLayout ? (
        <CRow className='g-3 mb-4'>
          <CCol lg={7}>
            <CCard className='border-0 shadow-sm h-100' style={styles.card}>
              <CCardBody>
                <div className='d-flex justify-content-between align-items-center mb-2'>
                  <div className='fw-semibold'>Bảng xếp hạng toàn bộ người tham gia</div>
                  <div className='small' style={styles.statLabel}>
                    Phase: {sessionInfo?.leaderboard?.phase || sessionInfo?.phaseCode || '-'}
                  </div>
                </div>
                {globalLeaderboard.length === 0 ? (
                  <div className='small' style={styles.statLabel}>Chưa có thành tích hợp lệ trong phase hiện tại.</div>
                ) : (
                  <div className='table-responsive'>
                    <table className='table table-sm align-middle mb-0' style={{ color: VKL_THEME.warmWhite }}>
                      <thead>
                        <tr>
                          <th>#</th>
                          <th>VĐV</th>
                          <th>Lane</th>
                          <th>PB</th>
                          <th>Lượt chạy</th>
                          <th>Replay</th>
                        </tr>
                      </thead>
                      <tbody>
                        {globalLeaderboard.map((entry) => (
                          <tr key={`lb-${entry.userId}-${entry.rank}`}>
                            <td>{entry.rank}</td>
                            <td>{entry.displayName}</td>
                            <td>{entry.laneNumber || '-'}</td>
                            <td>{Number(entry.finishTimeSeconds).toFixed(2)}s</td>
                            <td>{entry.attemptCount || 0}</td>
                            <td>{entry.hasReplay ? 'Sẵn sàng' : 'Thiếu dữ liệu'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CCardBody>
            </CCard>
          </CCol>
          <CCol lg={5}>
            <CCard className='border-0 shadow-sm h-100' style={styles.card}>
              <CCardBody>
                <div className='fw-semibold mb-2'>Đối thủ cho lượt chạy hiện tại</div>
                <div className='small mb-2' style={styles.statLabel}>
                  Tự động chọn tối đa {MAX_OPPONENTS} người có PB tốt nhất và có replay hợp lệ tại thời điểm Start.
                </div>
                {displayRowsWithLiveRank.filter((item) => !item.isSelf).length === 0 ? (
                  <div className='small' style={styles.statLabel}>Hiện chưa có đối thủ hợp lệ. Bạn sẽ chạy một mình.</div>
                ) : (
                  <ul className='small mb-3'>
                    {displayRowsWithLiveRank.filter((item) => !item.isSelf).map((item) => (
                      <li key={`op-${item.id}`}>Dòng {item.displayOrder} • Lane {item.lane || '-'} • {item.displayName} • PB {Number(item.pbSeconds || 0).toFixed(2)}s</li>
                    ))}
                  </ul>
                )}
                {missingReplayParticipants.length > 0 ? (
                  <div className='small' style={styles.statLabel}>
                    Có {missingReplayParticipants.length} VĐV có PB nhưng thiếu replay hợp lệ nên không được dựng chuyển động trong lượt đua này.
                  </div>
                ) : null}
                {laneIssues.length > 0 ? (
                  <div className='small mt-2' style={styles.statLabel}>
                    Có {laneIssues.length} VĐV thiếu lane đăng ký trong dữ liệu participant. Hệ thống không tự gán lane giả.
                  </div>
                ) : null}
              </CCardBody>
            </CCard>
          </CCol>
        </CRow>
      ) : null}

      {!isMobileLayout ? (
        <CRow className='g-3 mb-4'>
        <CCol xs={6} md={3}>
          <CCard className='h-100 border-0 shadow-sm' style={styles.card}>
            <CCardBody>
              <div className='small' style={styles.statLabel}>Tổng tiến độ</div>
              <div className='h3 mb-0' style={{ color: VKL_THEME.yellow }}>{hud.progress.toFixed(0)}%</div>
            </CCardBody>
          </CCard>
        </CCol>
        <CCol xs={6} md={3}>
          <CCard className='h-100 border-0 shadow-sm' style={styles.card}>
            <CCardBody>
              <div className='small' style={styles.statLabel}>Quãng đường</div>
              <div className='h3 mb-0' style={{ color: VKL_THEME.yellow }}>{hud.distance.toFixed(0)}m</div>
            </CCardBody>
          </CCard>
        </CCol>
        <CCol xs={6} md={3}>
          <CCard className='h-100 border-0 shadow-sm' style={styles.card}>
            <CCardBody>
              <div className='small' style={styles.statLabel}>Tốc độ</div>
              <div className='h3 mb-0' style={{ color: VKL_THEME.yellow }}>{hud.speed.toFixed(2)} m/s</div>
            </CCardBody>
          </CCard>
        </CCol>
        <CCol xs={6} md={3}>
          <CCard className='h-100 border-0 shadow-sm' style={styles.card}>
            <CCardBody>
              <div className='small' style={styles.statLabel}>Làn</div>
              <div className='h3 mb-0'>{raceContext?.playerLane || sessionInfo?.participant?.laneNumber || hud.lane}</div>
            </CCardBody>
          </CCard>
        </CCol>
        <CCol xs={6} md={3}>
          <CCard className='h-100 border-0 shadow-sm' style={styles.card}>
            <CCardBody>
              <div className='small' style={styles.statLabel}>Thời gian</div>
              <div className='h3 mb-0' style={{ color: VKL_THEME.yellow }}>{(hud.finishTimeSeconds ?? (hud.mode === 'practice' ? hud.practiceRemainingSeconds : hud.elapsedSeconds)).toFixed(2)}s</div>
            </CCardBody>
          </CCard>
        </CCol>
        <CCol xs={6} md={3}>
          <CCard className='h-100 border-0 shadow-sm' style={styles.card}>
            <CCardBody>
              <div className='small' style={styles.statLabel}>Bước hợp lệ</div>
              <div className='h3 mb-0'>{hud.stepCount}</div>
            </CCardBody>
          </CCard>
        </CCol>
        </CRow>
      ) : null}

      {!isMobileLayout ? (
        <CCard className='border-0 shadow-sm mb-4' style={styles.card}>
        <CCardBody>
          <div className='fw-semibold mb-2'>Hiệu quả nhịp chân</div>
          <div className='position-relative rounded' style={{ height: '18px', background: `linear-gradient(90deg, ${VKL_THEME.charcoal} 0 24%, ${VKL_THEME.mutedGold} 24% 52%, ${VKL_THEME.yellow} 52% 74%, ${VKL_THEME.warmWhite} 74% 100%)` }}>
            <div
              style={{
                position: 'absolute',
                left: `${cadenceRatio * 100}%`,
                top: '-4px',
                width: '2px',
                height: '26px',
                background: VKL_THEME.white,
                transform: 'translateX(-1px)',
                boxShadow: '0 0 0 1px rgba(244,196,0,0.35)',
              }}
            />
          </div>
          <div className='d-flex justify-content-between mt-2 small' style={styles.statLabel}>
            <span>Chậm</span>
            <span>Tốt</span>
            <span>Tối ưu</span>
            <span>Quá nhanh</span>
          </div>
          <div className='mt-2 small'>
            <span style={styles.statLabel}>Phản hồi: </span>
            <strong>{hud.cadence?.status || '-'}</strong>
            <span style={styles.statLabel}> ({cadenceBand})</span>
          </div>
          <div className='mt-2 d-flex flex-wrap gap-3 small'>
            <span>Raw cadence: <strong>{(hud.cadence?.rawCadence || 0).toFixed(2)} hz</strong></span>
            <span>Stride cadence: <strong>{(hud.cadence?.rawStrideCadence || 0).toFixed(2)} hz</strong></span>
            <span>Quality: <strong>{(cadenceQuality * 100).toFixed(0)}%</strong></span>
            <span>Stability: <strong>{((hud.cadence?.cadenceStability || 0) * 100).toFixed(0)}%</strong></span>
            <span>Status: <strong>{hud.cadence?.status || '-'}</strong></span>
            <span>Invalid repeat: <strong>{hud.invalidRepeatedPresses}</strong></span>
          </div>
          {rhythmGuideEnabled ? (
            <div className='mt-3 d-flex align-items-center gap-2'>
              <div
                className='rounded-circle d-flex justify-content-center align-items-center'
                style={{
                  width: '34px',
                  height: '34px',
                  background: guideLeftActive ? VKL_THEME.yellow : VKL_THEME.charcoal,
                  color: guideLeftActive ? VKL_THEME.deepBlack : VKL_THEME.warmWhite,
                  transform: guideLeftActive ? 'scale(1.08)' : 'scale(1)',
                  transition: 'all 120ms ease-out',
                }}
              >
                L
              </div>
              <div
                className='rounded-circle d-flex justify-content-center align-items-center'
                style={{
                  width: '34px',
                  height: '34px',
                  background: guideRightActive ? VKL_THEME.yellow : VKL_THEME.charcoal,
                  color: guideRightActive ? VKL_THEME.deepBlack : VKL_THEME.warmWhite,
                  transform: guideRightActive ? 'scale(1.08)' : 'scale(1)',
                  transition: 'all 120ms ease-out',
                }}
              >
                R
              </div>
              <div className='small ms-2' style={styles.statLabel}>
                Gợi ý nhịp tối ưu ~ {(hud.cadence?.optimalStepCadenceHz || 0).toFixed(2)} bước/giây
              </div>
            </div>
          ) : null}
        </CCardBody>
        </CCard>
      ) : null}

      {!isMobileLayout && debugEnabled ? (
        <CCard className='border-0 shadow-sm mb-4' style={styles.card}>
          <CCardBody>
            <div className='fw-semibold mb-2'>Game Feel Debug</div>
            <div className='d-flex flex-wrap gap-3 small mb-3'>
              <span>FPS: <strong>{hud.debug?.fps?.toFixed ? hud.debug.fps.toFixed(1) : '-'}</strong></span>
              <span>Tick: <strong>{hud.debug?.tickHz || '-'}</strong></span>
              <span>Keydown ts: <strong>{hud.debug?.lastKeydownTimestampMs ?? '-'}</strong></span>
              <span>Input latency: <strong>{hud.debug?.inputLatencyMs ?? '-'} ms</strong></span>
              <span>Target speed: <strong>{hud.targetSpeed.toFixed(2)} m/s</strong></span>
              <span>Current speed: <strong>{hud.speed.toFixed(2)} m/s</strong></span>
              <span>Animation phase: <strong>{hud.debug?.animationPhase ?? '-'}</strong></span>
            </div>
            <div className='small mb-1' style={styles.statLabel}>Biểu đồ tốc độ theo thời gian (debug)</div>
            <svg width='260' height='66' viewBox='0 0 260 66' style={{ background: VKL_THEME.deepBlack, borderRadius: '6px', display: 'block', border: `1px solid ${VKL_THEME.charcoal}` }}>
              <polyline points={speedChartPoints} fill='none' stroke={VKL_THEME.yellow} strokeWidth='2' />
            </svg>
          </CCardBody>
        </CCard>
      ) : null}

      {hud.status === 'finished' ? (
        <CCard className='border-0 shadow-sm mb-4' style={styles.card}>
          <CCardBody>
            <div className='fw-semibold mb-2'>Kết quả lượt chạy</div>
            <div className='mb-2' style={styles.statLabel}>{finishSummary}</div>
            <div className='mb-3' style={styles.statLabel}>Đánh giá: <strong style={{ color: VKL_THEME.white }}>{hud.cadence?.status || 'Chưa xác định'}</strong></div>
            <CButton style={styles.primaryButton} onClick={handleReset}>Chạy lại</CButton>
          </CCardBody>
        </CCard>
      ) : null}

      {!isMobileLayout && (!effectiveOfficialGameId || debugEnabled) ? (
        <CCard className='border-0 shadow-sm mb-4' style={styles.card}>
          <CCardBody>
            <div className='d-flex justify-content-between align-items-center mb-2'>
              <div className='fw-semibold'>Replay Library (Local)</div>
              <div className='small' style={styles.statLabel}>Đã lưu: {replayHistory.length}</div>
            </div>
            {replayHistory.length === 0 ? (
              <div className='small' style={styles.statLabel}>Chưa có replay hợp lệ. Hoàn thành một lượt Race 200m để tạo dữ liệu phát lại cục bộ.</div>
            ) : (
              <div className='d-flex flex-column gap-2'>
                {replayHistory.map((entry, index) => {
                  const selected = selectedGhostIds.includes(entry.replayId)
                  const isPB = index === 0
                  return (
                    <div key={entry.replayId} className='rounded p-2' style={{ border: `1px solid ${selected ? VKL_THEME.yellow : VKL_THEME.charcoal}`, background: selected ? 'rgba(244,196,0,0.08)' : 'transparent' }}>
                      <div className='d-flex flex-wrap gap-2 justify-content-between align-items-center'>
                        <div>
                          <strong>{entry.displayName}</strong>{isPB ? <span style={{ color: VKL_THEME.yellow }}> • PB</span> : null}
                          <div className='small' style={styles.statLabel}>
                            {new Date(entry.createdAt).toLocaleString()} · {entry.result.finishTimeSeconds.toFixed(2)}s · Avg {entry.result.averageSpeed.toFixed(2)} m/s · Steps {entry.result.validSteps}
                          </div>
                        </div>
                        <div className='d-flex gap-2 flex-wrap'>
                          <CButton style={selected ? styles.primaryButton : styles.toggleButton} onClick={() => handleToggleGhost(entry.replayId)}>
                            {selected ? 'Bỏ chọn' : 'Chọn đối thủ'}
                          </CButton>
                          <CButton style={styles.secondaryButton} onClick={() => handleReplaySingle(entry)}>Xem riêng</CButton>
                          <CButton style={styles.toggleButton} onClick={() => handleDeleteReplay(entry.replayId)}>Xóa</CButton>
                        </div>
                      </div>
                      <div className='d-flex gap-2 mt-2'>
                        <input
                          value={nameEdits[entry.replayId] ?? ''}
                          onChange={(event) => setNameEdits((prev) => ({ ...prev, [entry.replayId]: event.target.value }))}
                          placeholder='Đổi tên hiển thị...'
                          style={{
                            flex: 1,
                            minWidth: 0,
                            background: VKL_THEME.deepBlack,
                            color: VKL_THEME.warmWhite,
                            border: `1px solid ${VKL_THEME.charcoal}`,
                            borderRadius: '6px',
                            padding: '6px 8px',
                          }}
                        />
                        <CButton style={styles.secondaryButton} onClick={() => handleRenameReplay(entry.replayId)}>Lưu tên</CButton>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </CCardBody>
        </CCard>
      ) : null}

      <CCard className='border-0 shadow-sm' style={styles.card}>
        <CCardBody>
          <div className='fw-semibold mb-2'>Điều khiển</div>
          <ul className='mb-0' style={styles.statLabel}>
            <li><strong>← / →</strong>: bước trái / bước phải (phím chính).</li>
            <li>Nhấn trước GO trong Race sẽ bị tính phạm quy (false start).</li>
            <li>Chỉ tính bước hợp lệ khi luân phiên trái/phải.</li>
            <li><strong>Race 200m</strong>: chạy về đích 200m.</li>
            <li>Đối thủ được chọn tự động từ thành tích tốt nhất hợp lệ của phase hiện tại.</li>
            <li>Mỗi lượt đua khóa danh sách đối thủ tại thời điểm Start.</li>
            {isMobileLayout ? <li>Mobile: dùng hai nút CHÂN TRÁI/CHÂN PHẢI ở đáy màn hình để chạy.</li> : <li>Desktop: dùng bàn phím ← / → để chạy.</li>}
            {technicalMode ? <li>Chế độ kỹ thuật đang bật qua query param <code>?debug=1</code> hoặc <code>?tech=1</code>.</li> : null}
          </ul>
          <div className='mt-3' style={styles.statLabel}>Trạng thái: <strong style={{ color: VKL_THEME.white }}>{hud.status}</strong> — {hud.message}</div>
        </CCardBody>
      </CCard>
      {isMobileLayout ? (
        <div
          style={{
            position: 'fixed',
            left: 0,
            right: 0,
            bottom: 0,
            zIndex: 1040,
            padding: '8px 10px calc(8px + env(safe-area-inset-bottom))',
            background: 'linear-gradient(180deg, rgba(15,15,16,0) 0%, rgba(15,15,16,0.95) 26%, rgba(15,15,16,0.98) 100%)',
            touchAction: 'none',
          }}
        >
          <div className='d-flex gap-2'>
            <button
              ref={leftTouchButtonRef}
              type='button'
              style={{
                ...styles.primaryButton,
                flex: 1,
                minHeight: '104px',
                borderRadius: '12px',
                fontSize: '1.05rem',
                letterSpacing: '0.08em',
                touchAction: 'none',
                userSelect: 'none',
              }}
              onContextMenu={(event) => event.preventDefault()}
            >
              CHÂN TRÁI
            </button>
            <button
              ref={rightTouchButtonRef}
              type='button'
              style={{
                ...styles.primaryButton,
                flex: 1,
                minHeight: '104px',
                borderRadius: '12px',
                fontSize: '1.05rem',
                letterSpacing: '0.08em',
                background: VKL_THEME.softBlack,
                borderColor: VKL_THEME.yellow,
                color: VKL_THEME.warmWhite,
                touchAction: 'none',
                userSelect: 'none',
              }}
              onContextMenu={(event) => event.preventDefault()}
            >
              CHÂN PHẢI
            </button>
          </div>
        </div>
      ) : null}
    </div>
  )
}
