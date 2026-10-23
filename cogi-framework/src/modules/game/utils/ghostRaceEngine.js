export const GHOST_RACE_ENGINE_VERSION = 7
export const GHOST_RACE_PHYSICS_VERSION = 'v7-rhythm-fixedstep-2026-10'

export const GHOST_RACE_TRACK = {
  trackId: 'vkl-rhythm-track-200m',
  version: 6,
  distanceMeters: 200,
  lanes: 3,
}

const FIXED_STEP_MS = 1000 / 60
const PRACTICE_DURATION_SECONDS = 30
const clamp = (value, min, max) => Math.min(Math.max(value, min), max)
const lerp = (start, end, alpha) => start + ((end - start) * alpha)
const TAU = Math.PI * 2
const VKL_RENDER_THEME = {
  skyTop: '#0F0F10',
  skyMid: '#1A1A1C',
  skyBottom: '#232326',
  road: '#1A1A1C',
  laneLine: 'rgba(255,255,255,0.46)',
  meterLineBase: 0.72,
  meterLabel: '#F7F7F2',
  startLine: '#F4C400',
  finishDark: '#0F0F10',
  finishLight: '#FFFFFF',
  finishAccent: '#F4C400',
  runnerLeg: '#F7F7F2',
  runnerBody: '#F4C400',
  runnerArm: '#0F0F10',
  runnerHead: '#FFFFFF',
  markerGlow: 'rgba(244,196,0,0.34)',
  markerShadow: 'rgba(247,247,242,0.46)',
  overlayText: 'rgba(255,255,255,0.96)',
  finishedPanel: 'rgba(15,15,16,0.8)',
  finishedText: '#F7F7F2',
  debugPanel: 'rgba(0,0,0,0.62)',
  debugText: '#F7F7F2',
  debugFrame: 'rgba(212,175,55,0.62)',
  debugGraph: '#F4C400',
  debugLabel: '#D4AF37',
  startOverlayBg: 'rgba(15,15,16,0.72)',
  startOnYourMarks: '#F7F7F2',
  startSet: '#F4C400',
  startGo: '#F5C400',
  startFalseStart: '#D4AF37',
  startHelper: 'rgba(247,247,242,0.96)',
  ghostBody: 'rgba(212,175,55,0.55)',
  ghostLeg: 'rgba(247,247,242,0.56)',
  ghostArm: 'rgba(255,255,255,0.48)',
  ghostHead: 'rgba(255,255,255,0.7)',
}

const REPLAY_TICK_STATE_LIMIT = 7200
const REPLAY_CHECKPOINT_INTERVAL_TICKS = 15

function toMs(seconds) {
  return seconds * 1000
}

function advanceToward(currentValue, targetValue, ratePerSecond, dt) {
  const delta = targetValue - currentValue
  if (Math.abs(delta) <= 1e-7) return targetValue
  const maxStep = Math.max(0, ratePerSecond) * dt
  if (Math.abs(delta) <= maxStep) return targetValue
  return currentValue + (Math.sign(delta) * maxStep)
}

function createSpeedGraphPoints(history, width = 230, height = 72) {
  if (!Array.isArray(history) || history.length < 2) return ''
  const maxSpeed = Math.max(1, ...history.map((item) => item.speed))
  const lastIndex = Math.max(1, history.length - 1)
  return history
    .map((item, index) => {
      const x = (index / lastIndex) * width
      const y = height - ((item.speed / maxSpeed) * height)
      return `${x.toFixed(2)},${y.toFixed(2)}`
    })
    .join(' ')
}

function cloneTrackForReplay(track) {
  return {
    trackId: GHOST_RACE_TRACK.trackId,
    version: GHOST_RACE_TRACK.version,
    distanceMeters: Number(track.distanceMeters),
    lanes: Number(track.lanes),
  }
}

export function calculateCadenceQuality({
  stepCadenceHz,
  cadenceStability,
  optimalStepCadenceHz,
  optimalWindowHz,
  overfastPenaltyWindowHz,
}) {
  const cadence = Math.max(0, Number(stepCadenceHz) || 0)
  const stability = clamp(Number(cadenceStability) || 0, 0, 1)
  const center = Math.max(1.2, Number(optimalStepCadenceHz) || 5.2)
  const window = Math.max(0.3, Number(optimalWindowHz) || 0.95)
  const penaltyWindow = Math.max(0.2, Number(overfastPenaltyWindowHz) || 1.5)
  const delta = cadence - center

  let cadenceScore = 0
  if (Math.abs(delta) <= window) {
    cadenceScore = 1
  } else if (delta < 0) {
    cadenceScore = clamp(1 - ((Math.abs(delta) - window) / (window * 1.35)), 0, 1)
  } else {
    cadenceScore = clamp(1 - ((Math.abs(delta) - window) / penaltyWindow), 0.48, 1)
  }

  return clamp((cadenceScore * 0.7) + (stability * 0.3), 0, 1)
}

export class GhostRaceEngine {
  constructor({
    canvas,
    onHud = () => {},
    initialMode = 'race',
    debugEnabled = false,
    soundEnabled = true,
    track = GHOST_RACE_TRACK,
  } = {}) {
    if (!canvas || !canvas.getContext) {
      throw new Error('Ghost Race requires a valid canvas element.')
    }

    this.canvas = canvas
    this.ctx = canvas.getContext('2d')
    this.onHud = onHud
    this.mode = initialMode === 'practice' ? 'practice' : 'race'
    this.debugEnabled = Boolean(debugEnabled)
    this.soundEnabled = Boolean(soundEnabled)
    this.track = {
      distanceMeters: Math.max(80, Number(track?.distanceMeters ?? 200)),
      lanes: Math.max(1, Number(track?.lanes ?? 3)),
    }

    this.config = {
      input: {
        minValidStepIntervalMs: 75,
        staleStepThresholdMs: 420,
        stepHistorySize: 8,
      },
      cadence: {
        optimalStepCadenceHz: 5.35,
        optimalWindowHz: 1.05,
        overfastPenaltyWindowHz: 1.45,
        minRunningCadenceHz: 1.15,
        decayPerSecond: 3.4,
      },
      speed: {
        maxSpeed: 11.3,
        baseRunSpeed: 0.65,
        acceleration: 6.4,
        deceleration: 2.15,
      },
      start: {
        onYourMarksSeconds: 0.9,
        setSeconds: 0.85,
        goSeconds: 0.42,
      },
      camera: {
        nearHalfWidthRatio: 0.24,
        farHalfWidthRatio: 0.11,
        horizonRatio: 0.35,
        nearYRatio: 0.87,
        maxVisibleDistance: 120,
        followSmoothing: 9.5,
        bobFrequency: 1.7,
        bobAmplitude: 1.8,
      },
      animation: {
        phaseBaseRate: 0.45,
        phaseSpeedScale: 0.22,
        kneeLiftPx: 9.2,
        footLiftPx: 7.4,
        forwardReachPx: 1.6,
        armSwing: 5.1,
        torsoBob: 2.8,
        stepImpactDecay: 3.2,
      },
      hud: {
        publishHz: 20,
      },
      track: {
        meterTickSpacing: 5,
      },
      audio: {
        gunVolume: 0.12,
        gunFrequencyHz: 860,
        gunDurationSeconds: 0.07,
      },
    }

    this.distance = 0
    this.previousDistance = 0
    this.renderDistance = 0
    this.elapsedSeconds = 0
    this.simulationSeconds = 0
    this.tickCount = 0
    this.finishTimeSeconds = null
    this.status = 'idle'
    this.message = 'Nhấn Start để vào vị trí xuất phát.'
    this.practiceRemainingSeconds = PRACTICE_DURATION_SECONDS
    this.lastPrePauseStatus = null

    this.stepStats = {
      lastFoot: null,
      lastValidStepMs: null,
      validStepCount: 0,
      invalidRepeatedPresses: 0,
      intervalsMs: [],
      rawCadenceHz: 0,
      cadenceStability: 0,
      cadenceQuality: 0,
      cadenceBand: 'slow',
      cadenceStatus: 'Quá chậm',
      smoothedCadenceHudHz: 0,
      averageCadenceAccumulator: 0,
      averageCadenceSamples: 0,
    }

    this.motion = {
      targetSpeed: 0,
      currentSpeed: 0,
      averageSpeedAccumulator: 0,
      averageSpeedSamples: 0,
      animationPhase: 0,
      stepImpact: 0,
    }

    this.debugStats = {
      lastKeydownTimestampMs: null,
      lastInputLatencyMs: null,
      fps: 0,
      fpsFrameCounter: 0,
      fpsWindowSeconds: 0,
      speedHistory: [],
      historyLimit: 100,
    }

    this.frameId = null
    this.lastTimestamp = 0
    this.accumulator = 0
    this.lastHudPublishAt = -1
    this.pressedKeys = { left: false, right: false }
    this.startSequence = {
      stage: 'idle',
      stageElapsed: 0,
      startTick: null,
      goTick: null,
      falseStartTick: null,
      falseStartKey: null,
      falseStartAtSimSeconds: null,
    }
    this.sessionTrace = {
      countdownConfig: { ...this.config.start },
      startTick: null,
      goTick: null,
      falseStart: null,
      validInputs: [],
    }
    this.audio = {
      context: null,
      ready: false,
    }
    this.runMode = 'player'
    this.replayPlayback = null
    this.lastCompletedReplay = null
    this.recording = {
      active: false,
      replay: null,
    }
    this.ghost = {
      replay: null,
      active: false,
      tickFromGo: 0,
      animationPhase: 0,
      currentSpeed: 0,
      currentDistance: 0,
      finished: false,
    }

    this.bindInput()
    this.render(0)
    this.publishHud(true)
  }

  bindInput() {
    if (typeof window === 'undefined' || typeof document === 'undefined') return
    this.handleKeyDown = this.handleKeyDown.bind(this)
    this.handleKeyUp = this.handleKeyUp.bind(this)
    this.handleVisibilityChange = this.handleVisibilityChange.bind(this)
    window.addEventListener('keydown', this.handleKeyDown)
    window.addEventListener('keyup', this.handleKeyUp)
    document.addEventListener('visibilitychange', this.handleVisibilityChange)
  }

  unbindInput() {
    if (typeof window === 'undefined' || typeof document === 'undefined') return
    if (this.handleKeyDown) window.removeEventListener('keydown', this.handleKeyDown)
    if (this.handleKeyUp) window.removeEventListener('keyup', this.handleKeyUp)
    if (this.handleVisibilityChange) document.removeEventListener('visibilitychange', this.handleVisibilityChange)
  }

  setMode(nextMode) {
    const normalized = nextMode === 'practice' ? 'practice' : 'race'
    if (normalized === this.mode) return
    this.mode = normalized
    this.reset()
  }

  setDebugEnabled(enabled) {
    this.debugEnabled = Boolean(enabled)
    this.publishHud(true)
  }

  setSoundEnabled(enabled) {
    this.soundEnabled = Boolean(enabled)
    this.publishHud(true)
  }

  setGhostReplay(replay) {
    if (!replay || !Array.isArray(replay.tickStates) || replay.tickStates.length === 0) {
      this.ghost = {
        replay: null,
        active: false,
        tickFromGo: 0,
        animationPhase: 0,
        currentSpeed: 0,
        currentDistance: 0,
        finished: false,
      }
      this.publishHud(true)
      return
    }

    this.ghost = {
      replay,
      active: true,
      tickFromGo: 0,
      animationPhase: 0,
      currentSpeed: 0,
      currentDistance: 0,
      finished: false,
    }
    this.publishHud(true)
  }

  startReplay(replay) {
    if (!replay || !Array.isArray(replay.inputs) || !Array.isArray(replay.tickStates)) return false

    this.ensureGunAudioReady()
    this.mode = 'race'
    this.runMode = 'replay'
    this.replayPlayback = {
      replay,
      nextInputIndex: 0,
    }
    this.resetRunState({ keepStatus: true })
    this.status = 'go'
    this.startSequence.stage = 'go'
    this.startSequence.stageElapsed = 0
    this.startSequence.goTick = this.tickCount
    this.sessionTrace.goTick = this.tickCount
    this.message = 'Replay: GO'
    this.publishHud(true)
    this.ensureLoop()
    return true
  }

  consumeCompletedReplay() {
    const completed = this.lastCompletedReplay
    this.lastCompletedReplay = null
    return completed
  }

  createReplayRecordSkeleton() {
    return {
      replayId: `ghost-${Date.now()}-${Math.floor(Math.random() * 100000)}`,
      engineVersion: GHOST_RACE_ENGINE_VERSION,
      physicsVersion: GHOST_RACE_PHYSICS_VERSION,
      mode: this.mode,
      createdAt: new Date().toISOString(),
      track: cloneTrackForReplay(this.track),
      countdownConfig: { ...this.config.start },
      startTick: null,
      goTick: null,
      falseStart: null,
      inputs: [],
      checkpoints: [],
      tickStates: [],
      result: null,
    }
  }

  start() {
    this.ensureGunAudioReady()
    if (this.status === 'paused' && (this.lastPrePauseStatus === 'running' || this.lastPrePauseStatus === 'go')) {
      this.status = this.lastPrePauseStatus
      this.message = this.mode === 'practice' ? 'Tiếp tục luyện nhịp' : 'Tiếp tục chạy'
      this.publishHud(true)
      this.ensureLoop()
      return
    }

    if (this.status !== 'idle' && this.status !== 'finished' && this.status !== 'false_start') return

    this.runMode = 'player'
    this.replayPlayback = null
    this.resetRunState({ keepStatus: true })
    if (this.mode === 'practice') {
      this.status = 'running'
      this.message = 'Luyện nhịp 30s'
    } else {
      this.status = 'on_your_marks'
      this.startSequence.stage = 'on_your_marks'
      this.startSequence.stageElapsed = 0
      this.startSequence.startTick = this.tickCount
      this.sessionTrace.startTick = this.tickCount
      this.recording.active = true
      this.recording.replay = this.createReplayRecordSkeleton()
      this.recording.replay.startTick = this.tickCount
      this.message = 'VÀO VỊ TRÍ'
    }
    this.publishHud(true)
    this.ensureLoop()
  }

  pause() {
    if (this.status === 'running' || this.status === 'go') {
      this.lastPrePauseStatus = this.status
      this.status = 'paused'
      this.message = 'Tạm dừng'
      this.publishHud(true)
    }
  }

  resetRunState({ keepStatus = false } = {}) {
    this.distance = 0
    this.previousDistance = 0
    this.renderDistance = 0
    this.elapsedSeconds = 0
    this.simulationSeconds = 0
    this.tickCount = 0
    this.finishTimeSeconds = null
    this.practiceRemainingSeconds = PRACTICE_DURATION_SECONDS
    this.lastPrePauseStatus = null
    this.pressedKeys.left = false
    this.pressedKeys.right = false
    this.startSequence = {
      stage: 'idle',
      stageElapsed: 0,
      startTick: null,
      goTick: null,
      falseStartTick: null,
      falseStartKey: null,
      falseStartAtSimSeconds: null,
    }
    this.sessionTrace = {
      countdownConfig: { ...this.config.start },
      startTick: null,
      goTick: null,
      falseStart: null,
      validInputs: [],
    }
    this.recording = {
      active: false,
      replay: null,
    }

    this.stepStats = {
      lastFoot: null,
      lastValidStepMs: null,
      validStepCount: 0,
      invalidRepeatedPresses: 0,
      intervalsMs: [],
      rawCadenceHz: 0,
      cadenceStability: 0,
      cadenceQuality: 0,
      cadenceBand: 'slow',
      cadenceStatus: 'Quá chậm',
      smoothedCadenceHudHz: 0,
      averageCadenceAccumulator: 0,
      averageCadenceSamples: 0,
    }
    this.motion = {
      targetSpeed: 0,
      currentSpeed: 0,
      averageSpeedAccumulator: 0,
      averageSpeedSamples: 0,
      animationPhase: 0,
      stepImpact: 0,
    }
    this.debugStats = {
      ...this.debugStats,
      lastKeydownTimestampMs: null,
      lastInputLatencyMs: null,
      fps: 0,
      fpsFrameCounter: 0,
      fpsWindowSeconds: 0,
      speedHistory: [],
    }

    this.accumulator = 0
    this.lastTimestamp = 0
    this.lastHudPublishAt = -1
    this.lastCompletedReplay = keepStatus ? this.lastCompletedReplay : null
    if (this.ghost.active) {
      this.ghost.tickFromGo = 0
      this.ghost.animationPhase = 0
      this.ghost.currentSpeed = 0
      this.ghost.currentDistance = 0
      this.ghost.finished = false
    }
    if (!keepStatus) {
      this.runMode = 'player'
      this.replayPlayback = null
      this.status = 'idle'
      this.message = this.mode === 'practice' ? 'Practice: Nhấn Start để bắt đầu.' : 'Nhấn Start để vào vị trí xuất phát.'
    }
  }

  reset() {
    this.resetRunState()
    this.publishHud(true)
    this.render(0)
  }

  ensureLoop() {
    if (this.frameId !== null || typeof window === 'undefined') return
    const tick = (timestamp) => {
      if (this.status === 'finished' || this.status === 'idle' || this.status === 'false_start') {
        this.frameId = null
        this.render(0)
        this.publishHud(true)
        return
      }

      if (this.lastTimestamp === 0) this.lastTimestamp = timestamp
      const deltaMs = Math.min(40, timestamp - this.lastTimestamp)
      this.lastTimestamp = timestamp
      this.accumulator += deltaMs

      this.updateFpsWindow(deltaMs / 1000)

      while (this.accumulator >= FIXED_STEP_MS) {
        this.update(FIXED_STEP_MS / 1000)
        this.accumulator -= FIXED_STEP_MS
      }

      const interpolationAlpha = clamp(this.accumulator / FIXED_STEP_MS, 0, 1)
      this.render(interpolationAlpha)
      this.publishHud(false)
      this.frameId = window.requestAnimationFrame(tick)
    }

    this.frameId = window.requestAnimationFrame(tick)
  }

  updateFpsWindow(frameDeltaSeconds) {
    this.debugStats.fpsFrameCounter += 1
    this.debugStats.fpsWindowSeconds += frameDeltaSeconds
    if (this.debugStats.fpsWindowSeconds >= 0.5) {
      this.debugStats.fps = this.debugStats.fpsFrameCounter / this.debugStats.fpsWindowSeconds
      this.debugStats.fpsFrameCounter = 0
      this.debugStats.fpsWindowSeconds = 0
    }
  }

  handleVisibilityChange() {
    if (typeof document !== 'undefined' && document.visibilityState === 'hidden' && this.status === 'running') this.pause()
  }

  ensureGunAudioReady() {
    if (!this.soundEnabled || this.audio.ready) return
    if (typeof window === 'undefined') return
    const AudioContextCtor = window.AudioContext || window.webkitAudioContext
    if (!AudioContextCtor) return
    try {
      if (!this.audio.context) this.audio.context = new AudioContextCtor()
      const context = this.audio.context
      if (context.state === 'suspended') context.resume?.()
      this.audio.ready = true
    } catch (error) {
      this.audio.ready = false
    }
  }

  playGunShot() {
    if (!this.soundEnabled || !this.audio.ready || !this.audio.context) return
    try {
      const context = this.audio.context
      const now = context.currentTime
      const gain = context.createGain()
      const osc = context.createOscillator()
      osc.type = 'square'
      osc.frequency.setValueAtTime(this.config.audio.gunFrequencyHz, now)
      gain.gain.setValueAtTime(0.001, now)
      gain.gain.linearRampToValueAtTime(this.config.audio.gunVolume, now + 0.01)
      gain.gain.exponentialRampToValueAtTime(0.001, now + this.config.audio.gunDurationSeconds)
      osc.connect(gain)
      gain.connect(context.destination)
      osc.start(now)
      osc.stop(now + this.config.audio.gunDurationSeconds)
    } catch (error) {
      // no-op: visual GO remains the fallback signal
    }
  }

  normalizeFootFromKey(key) {
    if (key === 'arrowleft') return 'left'
    if (key === 'arrowright') return 'right'
    return null
  }

  handleKeyDown(event) {
    const key = String(event.key || '').toLowerCase()
    const foot = this.normalizeFootFromKey(key)
    if (event.repeat || !foot) return

    if (event.preventDefault) event.preventDefault()
    if (this.runMode === 'replay') return
    if (this.pressedKeys[foot]) return
    this.pressedKeys[foot] = true

    const inputTimestampMs = Number(event.timeStamp)
    if (Number.isFinite(inputTimestampMs) && typeof performance !== 'undefined' && Number.isFinite(performance.now())) {
      this.debugStats.lastKeydownTimestampMs = inputTimestampMs
      this.debugStats.lastInputLatencyMs = Math.max(0, performance.now() - inputTimestampMs)
    }

    if (this.mode === 'race' && (this.status === 'on_your_marks' || this.status === 'set')) {
      this.status = 'false_start'
      this.startSequence.stage = 'false_start'
      this.startSequence.falseStartTick = this.tickCount
      this.startSequence.falseStartAtSimSeconds = this.simulationSeconds
      this.startSequence.falseStartKey = foot
      this.message = 'XUẤT PHÁT PHẠM QUY'
      this.sessionTrace.falseStart = {
        tick: this.tickCount,
        simSeconds: Number(this.simulationSeconds.toFixed(6)),
        foot,
      }
      if (this.recording.replay) {
        this.recording.replay.falseStart = { ...this.sessionTrace.falseStart }
      }
      this.recording.active = false
      this.publishHud(true)
      return
    }

    this.handleStride(foot)
  }

  handleKeyUp(event) {
    const key = String(event.key || '').toLowerCase()
    const foot = this.normalizeFootFromKey(key)
    if (!foot) return
    this.pressedKeys[foot] = false
  }

  handleStride(foot, options = {}) {
    if (this.status !== 'running' && this.status !== 'go') return

    const timeMs = toMs(this.simulationSeconds)
    if (this.stepStats.lastFoot === foot) {
      this.stepStats.invalidRepeatedPresses += 1
      this.stepStats.cadenceStatus = 'Cần luân phiên trái/phải'
      this.message = 'Cần luân phiên trái/phải'
      return
    }

    if (this.stepStats.lastValidStepMs !== null) {
      const intervalMs = timeMs - this.stepStats.lastValidStepMs
      if (intervalMs < this.config.input.minValidStepIntervalMs) {
        this.stepStats.invalidRepeatedPresses += 1
        this.stepStats.cadenceStatus = 'Nhanh quá'
        this.message = 'Nhấn quá gấp'
        return
      }
      this.stepStats.intervalsMs.push(intervalMs)
      if (this.stepStats.intervalsMs.length > this.config.input.stepHistorySize) {
        this.stepStats.intervalsMs.shift()
      }
      this.updateCadenceStats()
      this.motion.stepImpact = 1
    }

    this.stepStats.lastValidStepMs = timeMs
    this.stepStats.lastFoot = foot
    this.stepStats.validStepCount += 1
    this.sessionTrace.validInputs.push({
      tick: this.tickCount,
      simSeconds: Number(this.simulationSeconds.toFixed(6)),
      foot,
    })
    if (this.sessionTrace.validInputs.length > 500) this.sessionTrace.validInputs.shift()
    if (this.recording.active && this.recording.replay && this.mode === 'race' && this.runMode === 'player' && !options.fromReplay) {
      const goTick = this.sessionTrace.goTick ?? this.startSequence.goTick ?? this.tickCount
      this.recording.replay.inputs.push({
        tickFromGo: Math.max(0, this.tickCount - goTick),
        foot,
      })
    }
    this.message = foot === 'left' ? 'Bước trái' : 'Bước phải'
  }

  resolveCadenceBand(stepCadenceHz, cadenceQuality) {
    const slowThreshold = this.config.cadence.optimalStepCadenceHz - this.config.cadence.optimalWindowHz
    const fastThreshold = this.config.cadence.optimalStepCadenceHz + this.config.cadence.optimalWindowHz + 0.55
    if (stepCadenceHz < slowThreshold || cadenceQuality < 0.45) return 'slow'
    if (stepCadenceHz > fastThreshold) return 'fast'
    if (cadenceQuality >= 0.92) return 'optimal'
    return 'good'
  }

  updateCadenceStats() {
    if (this.stepStats.intervalsMs.length === 0) {
      this.stepStats.rawCadenceHz = 0
      this.stepStats.cadenceStability = 0
      this.stepStats.cadenceQuality = 0
      this.stepStats.cadenceStatus = 'Quá chậm'
      return
    }

    const avgInterval = this.stepStats.intervalsMs.reduce((sum, value) => sum + value, 0) / this.stepStats.intervalsMs.length
    const variance = this.stepStats.intervalsMs.reduce((sum, value) => sum + ((value - avgInterval) ** 2), 0) / this.stepStats.intervalsMs.length
    const stdev = Math.sqrt(variance)
    const cv = stdev / Math.max(0.0001, avgInterval)

    this.stepStats.rawCadenceHz = avgInterval > 0.0001 ? 1000 / avgInterval : 0
    this.stepStats.cadenceStability = clamp(1 - (cv / 0.34), 0, 1)
    this.stepStats.cadenceQuality = calculateCadenceQuality({
      stepCadenceHz: this.stepStats.rawCadenceHz,
      cadenceStability: this.stepStats.cadenceStability,
      optimalStepCadenceHz: this.config.cadence.optimalStepCadenceHz,
      optimalWindowHz: this.config.cadence.optimalWindowHz,
      overfastPenaltyWindowHz: this.config.cadence.overfastPenaltyWindowHz,
    })
    this.stepStats.cadenceBand = this.resolveCadenceBand(this.stepStats.rawCadenceHz, this.stepStats.cadenceQuality)

    if (this.stepStats.rawCadenceHz < this.config.cadence.minRunningCadenceHz) {
      this.stepStats.cadenceStatus = 'Chậm quá'
    } else if (this.stepStats.cadenceQuality >= 0.93 && this.stepStats.cadenceStability >= 0.74) {
      this.stepStats.cadenceStatus = 'Tối ưu'
    } else if (this.stepStats.cadenceQuality >= 0.8 && this.stepStats.cadenceStability >= 0.45) {
      this.stepStats.cadenceStatus = 'Tốt'
    } else if (this.stepStats.cadenceStability < 0.4) {
      this.stepStats.cadenceStatus = 'Lệch nhịp'
    } else if (this.stepStats.rawCadenceHz > this.config.cadence.optimalStepCadenceHz + this.config.cadence.optimalWindowHz + 0.55) {
      this.stepStats.cadenceStatus = 'Nhanh quá'
    } else {
      this.stepStats.cadenceStatus = 'Giữ đều!'
    }
  }

  updateCadenceDecay(dt) {
    if (this.stepStats.lastValidStepMs === null) return
    const sinceLastMs = toMs(this.simulationSeconds) - this.stepStats.lastValidStepMs
    if (sinceLastMs <= this.config.input.staleStepThresholdMs) return

    this.stepStats.rawCadenceHz = Math.max(0, this.stepStats.rawCadenceHz - (this.config.cadence.decayPerSecond * dt))
    this.stepStats.cadenceStability *= Math.max(0, 1 - dt * 1.5)
    this.stepStats.cadenceQuality = calculateCadenceQuality({
      stepCadenceHz: this.stepStats.rawCadenceHz,
      cadenceStability: this.stepStats.cadenceStability,
      optimalStepCadenceHz: this.config.cadence.optimalStepCadenceHz,
      optimalWindowHz: this.config.cadence.optimalWindowHz,
      overfastPenaltyWindowHz: this.config.cadence.overfastPenaltyWindowHz,
    })
    this.stepStats.cadenceBand = this.resolveCadenceBand(this.stepStats.rawCadenceHz, this.stepStats.cadenceQuality)
    if (this.stepStats.rawCadenceHz < this.config.cadence.minRunningCadenceHz) this.stepStats.cadenceStatus = 'Chậm quá'
  }

  updateStartSequence(dt) {
    if (this.mode !== 'race') return
    if (this.status !== 'on_your_marks' && this.status !== 'set' && this.status !== 'go') return

    this.startSequence.stageElapsed += dt
    if (this.status === 'on_your_marks' && this.startSequence.stageElapsed >= this.config.start.onYourMarksSeconds) {
      this.status = 'set'
      this.startSequence.stage = 'set'
      this.startSequence.stageElapsed = 0
      this.message = 'SẴN SÀNG'
      return
    }

    if (this.status === 'set' && this.startSequence.stageElapsed >= this.config.start.setSeconds) {
      this.status = 'go'
      this.startSequence.stage = 'go'
      this.startSequence.stageElapsed = 0
      this.startSequence.goTick = this.tickCount
      this.sessionTrace.goTick = this.tickCount
      if (this.recording.active && this.recording.replay) {
        this.recording.replay.goTick = this.tickCount
      }
      this.message = 'ĐOÀNG! GO!'
      this.playGunShot()
      return
    }

    if (this.status === 'go' && this.startSequence.stageElapsed >= this.config.start.goSeconds) {
      this.status = 'running'
      this.startSequence.stage = 'running'
      this.startSequence.stageElapsed = 0
      this.message = 'Giữ nhịp đều'
    }
  }

  applyReplayInputsForCurrentTick() {
    if (this.runMode !== 'replay' || !this.replayPlayback?.replay) return
    const goTick = this.sessionTrace.goTick ?? this.startSequence.goTick ?? 0
    const tickFromGo = Math.max(0, this.tickCount - goTick)
    const inputs = this.replayPlayback.replay.inputs || []
    while (this.replayPlayback.nextInputIndex < inputs.length) {
      const next = inputs[this.replayPlayback.nextInputIndex]
      if (next.tickFromGo !== tickFromGo) break
      this.handleStride(next.foot, { fromReplay: true })
      this.replayPlayback.nextInputIndex += 1
    }
  }

  captureReplayTickState() {
    if (!this.recording.active || !this.recording.replay || this.mode !== 'race' || this.runMode !== 'player') return
    const goTick = this.sessionTrace.goTick ?? this.startSequence.goTick
    if (goTick === null) return
    const tickFromGo = Math.max(0, this.tickCount - goTick)
    this.recording.replay.tickStates.push({
      tickFromGo,
      elapsedSeconds: Number(this.elapsedSeconds.toFixed(6)),
      distance: Number(this.distance.toFixed(6)),
      speed: Number(this.motion.currentSpeed.toFixed(6)),
    })
    if ((tickFromGo % REPLAY_CHECKPOINT_INTERVAL_TICKS) === 0) {
      this.recording.replay.checkpoints.push({
        tickFromGo,
        elapsedSeconds: Number(this.elapsedSeconds.toFixed(6)),
        distance: Number(this.distance.toFixed(6)),
        speed: Number(this.motion.currentSpeed.toFixed(6)),
        cadence: Number(this.stepStats.rawCadenceHz.toFixed(6)),
      })
    }
    if (this.recording.replay.tickStates.length > REPLAY_TICK_STATE_LIMIT) {
      this.recording.replay.tickStates.shift()
    }
  }

  finalizeReplayRecord() {
    if (!this.recording.active || !this.recording.replay) return
    const goTick = this.recording.replay.goTick ?? this.sessionTrace.goTick ?? this.startSequence.goTick ?? this.tickCount
    const finalTickFromGo = Math.max(0, this.tickCount - goTick)
    const finalCheckpoint = {
      tickFromGo: finalTickFromGo,
      elapsedSeconds: Number(this.elapsedSeconds.toFixed(6)),
      distance: Number(this.distance.toFixed(6)),
      speed: Number(this.motion.currentSpeed.toFixed(6)),
      cadence: Number(this.stepStats.rawCadenceHz.toFixed(6)),
    }
    this.recording.replay.checkpoints.push(finalCheckpoint)
    this.recording.replay.tickStates.push({
      tickFromGo: finalTickFromGo,
      elapsedSeconds: Number(this.elapsedSeconds.toFixed(6)),
      distance: Number(this.distance.toFixed(6)),
      speed: Number(this.motion.currentSpeed.toFixed(6)),
    })
    this.recording.replay.result = {
      finishTimeSeconds: Number((this.finishTimeSeconds ?? this.elapsedSeconds).toFixed(6)),
      distance: Number(this.distance.toFixed(6)),
      averageSpeed: Number(this.getAverageSpeed().toFixed(6)),
      averageCadence: Number(this.getAverageCadenceHz().toFixed(6)),
      validSteps: this.stepStats.validStepCount,
      invalidRepeatedPresses: this.stepStats.invalidRepeatedPresses,
    }
    this.lastCompletedReplay = this.recording.replay
    this.recording.active = false
  }

  updateGhostReplay(dt) {
    if (!this.ghost.active || !this.ghost.replay || this.mode !== 'race' || this.runMode !== 'player') return
    if (this.status !== 'go' && this.status !== 'running' && this.status !== 'finished' && this.status !== 'paused') return
    if (this.status === 'paused') return

    const tickStates = this.ghost.replay.tickStates || []
    if (tickStates.length === 0) return
    const tickState = tickStates[Math.min(this.ghost.tickFromGo, tickStates.length - 1)]
    this.ghost.currentDistance = tickState.distance
    this.ghost.currentSpeed = tickState.speed
    const speedRatio = clamp(this.ghost.currentSpeed / Math.max(0.0001, this.config.speed.maxSpeed), 0, 1)
    const phaseDrive = clamp(speedRatio * 0.95, 0, 1)
    const phaseRate = this.config.animation.phaseBaseRate + (this.ghost.currentSpeed * this.config.animation.phaseSpeedScale)
    this.ghost.animationPhase += dt * phaseRate * phaseDrive
    this.ghost.finished = this.ghost.tickFromGo >= (tickStates.length - 1)
    this.ghost.tickFromGo += 1
  }

  computeTargetSpeed() {
    const cadence = this.stepStats.rawCadenceHz
    if (cadence < this.config.cadence.minRunningCadenceHz) return 0
    const quality = this.stepStats.cadenceQuality
    const consistencyBonus = lerp(0.65, 1, this.stepStats.cadenceStability)
    const qualityCurve = Math.pow(quality, 1.12)
    const topRange = this.config.speed.maxSpeed - this.config.speed.baseRunSpeed
    return clamp(
      this.config.speed.baseRunSpeed + (qualityCurve * consistencyBonus * topRange),
      0,
      this.config.speed.maxSpeed,
    )
  }

  update(dt) {
    this.previousDistance = this.distance
    if (this.status === 'paused') {
      return
    }
    this.applyReplayInputsForCurrentTick()
    this.simulationSeconds += dt
    this.tickCount += 1
    this.updateStartSequence(dt)
    this.motion.stepImpact = Math.max(0, this.motion.stepImpact - (dt * this.config.animation.stepImpactDecay))

    const canRunMotion = this.status === 'running' || this.status === 'go'
    if (!canRunMotion) {
      this.motion.currentSpeed = advanceToward(this.motion.currentSpeed, 0, this.config.speed.deceleration, dt)
      const settleBlend = clamp(this.motion.currentSpeed / Math.max(0.0001, this.config.speed.maxSpeed), 0, 1)
      this.motion.animationPhase += dt * this.config.animation.phaseBaseRate * settleBlend
      return
    }
    this.elapsedSeconds += dt

    if (this.mode === 'practice') {
      this.practiceRemainingSeconds = Math.max(0, this.practiceRemainingSeconds - dt)
      if (this.practiceRemainingSeconds <= 0) {
        this.finishTimeSeconds = this.elapsedSeconds
        this.status = 'finished'
        this.message = 'Kết thúc luyện nhịp'
      }
    }

    this.updateCadenceDecay(dt)
    this.motion.targetSpeed = this.computeTargetSpeed()

    const accel = this.motion.currentSpeed < this.motion.targetSpeed
      ? this.config.speed.acceleration
      : this.config.speed.deceleration
    this.motion.currentSpeed = advanceToward(this.motion.currentSpeed, this.motion.targetSpeed, accel, dt)

    this.distance += this.motion.currentSpeed * dt
    const speedRatio = clamp(this.motion.currentSpeed / Math.max(0.0001, this.config.speed.maxSpeed), 0, 1)
    const phaseDrive = clamp((speedRatio * 0.95) + (this.motion.stepImpact * 0.45), 0, 1)
    const phaseRate = this.config.animation.phaseBaseRate + (this.motion.currentSpeed * this.config.animation.phaseSpeedScale)
    this.motion.animationPhase += dt * phaseRate * phaseDrive
    this.renderDistance += (this.distance - this.renderDistance) * Math.min(1, dt * this.config.camera.followSmoothing)

    this.stepStats.averageCadenceAccumulator += this.stepStats.rawCadenceHz
    this.stepStats.averageCadenceSamples += 1
    this.motion.averageSpeedAccumulator += this.motion.currentSpeed
    this.motion.averageSpeedSamples += 1
    this.captureReplayTickState()
    this.updateGhostReplay(dt)

    if (this.mode === 'race' && this.distance >= this.track.distanceMeters) {
      this.distance = this.track.distanceMeters
      this.finishTimeSeconds = this.elapsedSeconds
      this.status = 'finished'
      if (this.runMode === 'player') {
        this.message = 'Về đích!'
        this.finalizeReplayRecord()
      } else {
        const expected = this.replayPlayback?.replay?.result?.finishTimeSeconds
        if (Number.isFinite(expected)) {
          const delta = this.finishTimeSeconds - expected
          this.message = `Replay xong (Δ ${delta >= 0 ? '+' : ''}${delta.toFixed(3)}s)`
        } else {
          this.message = 'Replay xong'
        }
      }
    }
  }

  getAverageCadenceHz() {
    if (this.stepStats.averageCadenceSamples === 0) return 0
    return this.stepStats.averageCadenceAccumulator / this.stepStats.averageCadenceSamples
  }

  getAverageSpeed() {
    if (this.motion.averageSpeedSamples === 0) return 0
    return this.motion.averageSpeedAccumulator / this.motion.averageSpeedSamples
  }

  getTrackProfile() {
    const width = this.canvas.width
    const height = this.canvas.height
    const speedRatio = clamp(this.motion.currentSpeed / Math.max(0.0001, this.config.speed.maxSpeed), 0, 1)
    const bob = this.status === 'running' || this.status === 'go'
      ? Math.sin(this.motion.animationPhase * this.config.camera.bobFrequency) * (this.config.camera.bobAmplitude * (0.65 + speedRatio * 0.45))
      : 0
    return {
      width,
      height,
      centerX: width * 0.5,
      horizonY: height * this.config.camera.horizonRatio + bob,
      nearY: height * this.config.camera.nearYRatio + bob * 0.8,
      nearHalfWidth: width * this.config.camera.nearHalfWidthRatio,
      farHalfWidth: width * this.config.camera.farHalfWidthRatio,
      maxVisibleDistance: this.config.camera.maxVisibleDistance,
    }
  }

  projectWorld(worldX, worldDistanceAhead, worldHeight = 0, profile = this.getTrackProfile()) {
    if (worldDistanceAhead < -2 || worldDistanceAhead > profile.maxVisibleDistance) return null
    const depth = clamp(1 - (worldDistanceAhead / profile.maxVisibleDistance), 0, 1)
    const roadHalfWidth = lerp(profile.farHalfWidth, profile.nearHalfWidth, depth)
    const groundY = lerp(profile.horizonY, profile.nearY, depth)
    const scaleY = lerp(6.2, 78, depth)
    return {
      depth,
      roadHalfWidth,
      groundY,
      scaleY,
      screenX: profile.centerX + worldX * roadHalfWidth,
      screenY: groundY - worldHeight * scaleY,
    }
  }

  renderRoad(profile, renderDistance) {
    const ctx = this.ctx
    const leftNearX = profile.centerX - profile.nearHalfWidth
    const rightNearX = profile.centerX + profile.nearHalfWidth
    const leftFarX = profile.centerX - profile.farHalfWidth
    const rightFarX = profile.centerX + profile.farHalfWidth

    const sky = ctx.createLinearGradient(0, 0, 0, profile.height)
    sky.addColorStop(0, VKL_RENDER_THEME.skyTop)
    sky.addColorStop(0.45, VKL_RENDER_THEME.skyMid)
    sky.addColorStop(1, VKL_RENDER_THEME.skyBottom)
    ctx.fillStyle = sky
    ctx.fillRect(0, 0, profile.width, profile.height)

    ctx.fillStyle = VKL_RENDER_THEME.road
    ctx.beginPath()
    ctx.moveTo(leftFarX, profile.horizonY)
    ctx.lineTo(rightFarX, profile.horizonY)
    ctx.lineTo(rightNearX, profile.nearY)
    ctx.lineTo(leftNearX, profile.nearY)
    ctx.closePath()
    ctx.fill()

    for (let laneBoundary = 1; laneBoundary < this.track.lanes; laneBoundary += 1) {
      const boundaryX = ((laneBoundary / this.track.lanes) * 2) - 1
      const near = this.projectWorld(boundaryX, 0, 0, profile)
      const far = this.projectWorld(boundaryX, profile.maxVisibleDistance, 0, profile)
      if (!near || !far) continue
      ctx.strokeStyle = VKL_RENDER_THEME.laneLine
      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.moveTo(near.screenX, near.groundY)
      ctx.lineTo(far.screenX, far.groundY)
      ctx.stroke()
    }

    const markerOffset = renderDistance % this.config.track.meterTickSpacing
    for (let z = this.config.track.meterTickSpacing - markerOffset; z < profile.maxVisibleDistance; z += this.config.track.meterTickSpacing) {
      const left = this.projectWorld(-0.9, z, 0, profile)
      const right = this.projectWorld(0.9, z, 0, profile)
      if (!left || !right) continue
      const alpha = clamp(left.depth * VKL_RENDER_THEME.meterLineBase, 0.12, 0.68)
      ctx.strokeStyle = `rgba(244,196,0,${alpha})`
      ctx.lineWidth = Math.max(1, left.depth * 3.2)
      ctx.beginPath()
      ctx.moveTo(left.screenX, left.groundY)
      ctx.lineTo(right.screenX, right.groundY)
      ctx.stroke()
    }

    for (let meter = 0; meter <= this.track.distanceMeters; meter += 20) {
      const ahead = meter - renderDistance
      const marker = this.projectWorld(-1.02, ahead, 0, profile)
      if (!marker) continue
      ctx.fillStyle = VKL_RENDER_THEME.meterLabel
      ctx.font = `${Math.max(10, marker.depth * 19)}px sans-serif`
      ctx.fillText(`${meter}m`, marker.screenX, marker.groundY - 2)
    }

    const startLine = this.projectWorld(0, -0.2, 0, profile)
    if (startLine) {
      const left = this.projectWorld(-1, -0.2, 0, profile)
      const right = this.projectWorld(1, -0.2, 0, profile)
      if (left && right) {
        ctx.strokeStyle = VKL_RENDER_THEME.startLine
        ctx.lineWidth = 3
        ctx.beginPath()
        ctx.moveTo(left.screenX, left.groundY)
        ctx.lineTo(right.screenX, right.groundY)
        ctx.stroke()
      }
    }
  }

  renderFinishLine(profile, renderDistance) {
    if (this.mode !== 'race') return
    const finishAhead = this.track.distanceMeters - renderDistance
    const halfDepth = 0.55
    const nearLeft = this.projectWorld(-1, finishAhead - halfDepth, 0, profile)
    const nearRight = this.projectWorld(1, finishAhead - halfDepth, 0, profile)
    const farLeft = this.projectWorld(-1, finishAhead + halfDepth, 0, profile)
    const farRight = this.projectWorld(1, finishAhead + halfDepth, 0, profile)
    if (!nearLeft || !nearRight || !farLeft || !farRight) return

    const ctx = this.ctx
    ctx.save()
    ctx.beginPath()
    ctx.moveTo(farLeft.screenX, farLeft.groundY)
    ctx.lineTo(farRight.screenX, farRight.groundY)
    ctx.lineTo(nearRight.screenX, nearRight.groundY)
    ctx.lineTo(nearLeft.screenX, nearLeft.groundY)
    ctx.closePath()
    ctx.clip()

    const minX = Math.min(farLeft.screenX, farRight.screenX, nearLeft.screenX, nearRight.screenX)
    const maxX = Math.max(farLeft.screenX, farRight.screenX, nearLeft.screenX, nearRight.screenX)
    const minY = Math.min(farLeft.groundY, farRight.groundY, nearLeft.groundY, nearRight.groundY)
    const maxY = Math.max(farLeft.groundY, farRight.groundY, nearLeft.groundY, nearRight.groundY)
    const cell = Math.max(4, (maxX - minX) / 14)
    for (let y = minY; y <= maxY + cell; y += cell) {
      for (let x = minX; x <= maxX + cell; x += cell) {
        const dark = (Math.floor((x - minX) / cell) + Math.floor((y - minY) / cell)) % 2 === 0
        if (!dark && (Math.floor((x - minX) / cell) % 3 === 1)) ctx.fillStyle = VKL_RENDER_THEME.finishAccent
        else ctx.fillStyle = dark ? VKL_RENDER_THEME.finishDark : VKL_RENDER_THEME.finishLight
        ctx.fillRect(x, y, cell, cell)
      }
    }
    ctx.restore()
  }

  drawLeg({ hipX, hipY, phase01, strideWeight }) {
    const cfg = this.config.animation
    const swing = phase01 < 0.5 ? (phase01 / 0.5) : ((1 - phase01) / 0.5)
    const liftCurve = Math.sin(Math.PI * swing)
    const stancePhase = phase01 >= 0.5
    const forwardSign = phase01 < 0.5 ? 1 : -1

    const kneeLift = liftCurve * cfg.kneeLiftPx * strideWeight
    const footLift = liftCurve * cfg.footLiftPx * strideWeight
    const forwardReach = forwardSign * cfg.forwardReachPx * strideWeight
    const stanceCompression = stancePhase ? (1 - swing) * 1.25 * strideWeight : 0

    const kneeX = hipX + (forwardReach * 0.55)
    const kneeY = hipY + 13.5 - kneeLift + stanceCompression
    const footX = hipX + forwardReach
    const footY = hipY + 30 - footLift + stanceCompression
    return { kneeX, kneeY, footX, footY }
  }

  renderRunner(profile) {
    const runnerProjection = this.projectWorld(0, 0, 0, profile)
    if (!runnerProjection) return

    const ctx = this.ctx
    const speedRatio = clamp(this.motion.currentSpeed / Math.max(0.0001, this.config.speed.maxSpeed), 0, 1)
    const phase = this.motion.animationPhase
    const leftPhase = ((phase % 1) + 1) % 1
    const rightPhase = ((leftPhase + 0.5) % 1 + 1) % 1
    const strideWeight = clamp((speedRatio * 1.05) + (this.motion.stepImpact * 0.35), 0, 1)
    const armSwingWave = Math.sin(leftPhase * TAU)
    const armSwingLeft = -armSwingWave * this.config.animation.armSwing * strideWeight
    const armSwingRight = armSwingWave * this.config.animation.armSwing * strideWeight
    const bodyBob = Math.sin(leftPhase * TAU) * (this.config.animation.torsoBob * (0.2 + speedRatio * 0.55))
    const stepKick = this.motion.stepImpact * 3.2

    const hipY = 12
    const leftLeg = this.drawLeg({ hipX: -6, hipY, phase01: leftPhase, strideWeight })
    const rightLeg = this.drawLeg({ hipX: 6, hipY, phase01: rightPhase, strideWeight })
    const supportLeg = leftLeg.footY >= rightLeg.footY ? leftLeg : rightLeg
    const baseFootY = Math.max(leftLeg.footY, rightLeg.footY)

    const x = runnerProjection.screenX
    const y = runnerProjection.groundY - baseFootY
    const stretch = 1 + (this.motion.stepImpact * 0.05)

    ctx.save()
    ctx.translate(x, y)
    ctx.scale(stretch, 1)

    const contactCenter = (leftLeg.footX + rightLeg.footX) / 2
    const markerX = lerp(contactCenter, supportLeg.footX, 0.38)
    const markerY = baseFootY + 1.2
    ctx.fillStyle = VKL_RENDER_THEME.markerGlow
    ctx.beginPath()
    ctx.ellipse(markerX, markerY, 12 + (speedRatio * 4), 4.5 + (speedRatio * 1.2), 0, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = VKL_RENDER_THEME.markerShadow
    ctx.beginPath()
    ctx.ellipse(markerX, markerY + 0.6, 7, 2.1, 0, 0, Math.PI * 2)
    ctx.fill()

    ctx.strokeStyle = VKL_RENDER_THEME.runnerLeg
    ctx.lineWidth = 4
    ctx.beginPath()
    ctx.moveTo(-6, hipY)
    ctx.lineTo(leftLeg.kneeX, leftLeg.kneeY)
    ctx.lineTo(leftLeg.footX, leftLeg.footY)
    ctx.moveTo(6, hipY)
    ctx.lineTo(rightLeg.kneeX, rightLeg.kneeY)
    ctx.lineTo(rightLeg.footX, rightLeg.footY)
    ctx.stroke()

    ctx.fillStyle = VKL_RENDER_THEME.runnerBody
    ctx.beginPath()
    ctx.ellipse(0, -8 - bodyBob - stepKick, 17, 22, 0, 0, Math.PI * 2)
    ctx.fill()

    ctx.strokeStyle = VKL_RENDER_THEME.runnerArm
    ctx.lineWidth = 4
    ctx.beginPath()
    ctx.moveTo(-10, -8 - bodyBob)
    ctx.lineTo(-16 + armSwingLeft, 16 - bodyBob)
    ctx.moveTo(10, -8 - bodyBob)
    ctx.lineTo(16 + armSwingRight, 16 - bodyBob)
    ctx.stroke()

    ctx.fillStyle = VKL_RENDER_THEME.runnerHead
    ctx.beginPath()
    ctx.arc(0, -31 - bodyBob - stepKick, 10, 0, Math.PI * 2)
    ctx.fill()

    ctx.restore()
  }

  renderGhostRunner(profile, renderDistance) {
    if (!this.ghost.active || !this.ghost.replay || this.mode !== 'race' || this.runMode !== 'player') return
    const ahead = this.ghost.currentDistance - renderDistance
    const ghostProjection = this.projectWorld(0.18, ahead, 0, profile)
    if (!ghostProjection) return

    const ctx = this.ctx
    const speedRatio = clamp(this.ghost.currentSpeed / Math.max(0.0001, this.config.speed.maxSpeed), 0, 1)
    const phase = this.ghost.animationPhase
    const leftPhase = ((phase % 1) + 1) % 1
    const rightPhase = ((leftPhase + 0.5) % 1 + 1) % 1
    const strideWeight = clamp(speedRatio * 1.05, 0, 1)
    const armSwingWave = Math.sin(leftPhase * TAU)
    const armSwingLeft = -armSwingWave * this.config.animation.armSwing * strideWeight
    const armSwingRight = armSwingWave * this.config.animation.armSwing * strideWeight
    const bodyBob = Math.sin(leftPhase * TAU) * (this.config.animation.torsoBob * (0.2 + speedRatio * 0.55))

    const hipY = 12
    const leftLeg = this.drawLeg({ hipX: -6, hipY, phase01: leftPhase, strideWeight })
    const rightLeg = this.drawLeg({ hipX: 6, hipY, phase01: rightPhase, strideWeight })
    const baseFootY = Math.max(leftLeg.footY, rightLeg.footY)

    const x = ghostProjection.screenX
    const y = ghostProjection.groundY - baseFootY
    ctx.save()
    ctx.translate(x, y)
    ctx.globalAlpha = 0.75

    ctx.strokeStyle = VKL_RENDER_THEME.ghostLeg
    ctx.lineWidth = 3.2
    ctx.beginPath()
    ctx.moveTo(-6, hipY)
    ctx.lineTo(leftLeg.kneeX, leftLeg.kneeY)
    ctx.lineTo(leftLeg.footX, leftLeg.footY)
    ctx.moveTo(6, hipY)
    ctx.lineTo(rightLeg.kneeX, rightLeg.kneeY)
    ctx.lineTo(rightLeg.footX, rightLeg.footY)
    ctx.stroke()

    ctx.fillStyle = VKL_RENDER_THEME.ghostBody
    ctx.beginPath()
    ctx.ellipse(0, -8 - bodyBob, 16, 20, 0, 0, Math.PI * 2)
    ctx.fill()

    ctx.strokeStyle = VKL_RENDER_THEME.ghostArm
    ctx.lineWidth = 3
    ctx.beginPath()
    ctx.moveTo(-9, -8 - bodyBob)
    ctx.lineTo(-15 + armSwingLeft, 14 - bodyBob)
    ctx.moveTo(9, -8 - bodyBob)
    ctx.lineTo(15 + armSwingRight, 14 - bodyBob)
    ctx.stroke()

    ctx.fillStyle = VKL_RENDER_THEME.ghostHead
    ctx.beginPath()
    ctx.arc(0, -30 - bodyBob, 8.8, 0, Math.PI * 2)
    ctx.fill()
    ctx.restore()
  }

  renderDebugOverlay(profile) {
    if (!this.debugEnabled) return
    const ctx = this.ctx
    ctx.fillStyle = VKL_RENDER_THEME.debugPanel
    ctx.fillRect(profile.width - 335, 14, 316, 238)
    ctx.fillStyle = VKL_RENDER_THEME.debugText
    ctx.font = '12px monospace'

    const strideCadence = this.stepStats.rawCadenceHz / 2
    const lines = [
      `mode: ${this.mode}`,
      `engine: v${GHOST_RACE_ENGINE_VERSION}`,
      `state: ${this.status}`,
      `fps: ${this.debugStats.fps.toFixed(1)}`,
      `tick: ${Math.round(1000 / FIXED_STEP_MS)} hz`,
      `last keydown ts: ${this.debugStats.lastKeydownTimestampMs?.toFixed?.(1) ?? '-'}`,
      `input latency: ${this.debugStats.lastInputLatencyMs?.toFixed?.(2) ?? '-'} ms`,
      `cadence step: ${this.stepStats.rawCadenceHz.toFixed(2)} hz`,
      `cadence stride: ${strideCadence.toFixed(2)} hz`,
      `stability: ${(this.stepStats.cadenceStability * 100).toFixed(0)}%`,
      `quality: ${(this.stepStats.cadenceQuality * 100).toFixed(0)}%`,
      `speed current: ${this.motion.currentSpeed.toFixed(2)} m/s`,
      `speed target: ${this.motion.targetSpeed.toFixed(2)} m/s`,
      `animation phase: ${this.motion.animationPhase.toFixed(2)}`,
      `valid steps: ${this.stepStats.validStepCount}`,
      `invalid repeat: ${this.stepStats.invalidRepeatedPresses}`,
      `start tick: ${this.sessionTrace.startTick ?? '-'}`,
      `go tick: ${this.sessionTrace.goTick ?? '-'}`,
      `distance: ${this.distance.toFixed(2)}m`,
    ]
    lines.forEach((line, index) => ctx.fillText(line, profile.width - 324, 32 + (index * 13.5)))

    const graphX = profile.width - 324
    const graphY = 196
    const graphW = 228
    const graphH = 54
    ctx.strokeStyle = VKL_RENDER_THEME.debugFrame
    ctx.lineWidth = 1
    ctx.strokeRect(graphX, graphY, graphW, graphH)
    const points = createSpeedGraphPoints(this.debugStats.speedHistory, graphW, graphH)
    if (points) {
      ctx.strokeStyle = VKL_RENDER_THEME.debugGraph
      ctx.lineWidth = 2
      ctx.beginPath()
      const split = points.split(' ')
      split.forEach((pair, index) => {
        const [px, py] = pair.split(',').map(Number)
        const x = graphX + px
        const y = graphY + py
        if (index === 0) ctx.moveTo(x, y)
        else ctx.lineTo(x, y)
      })
      ctx.stroke()
    }
    ctx.fillStyle = VKL_RENDER_THEME.debugLabel
    ctx.fillText('speed graph (m/s)', graphX + 4, graphY - 4)
  }

  publishHud(force = false) {
    const minInterval = 1 / this.config.hud.publishHz
    if (!force && this.lastHudPublishAt >= 0 && (this.elapsedSeconds - this.lastHudPublishAt) < minInterval) return
    this.lastHudPublishAt = this.elapsedSeconds
    this.stepStats.smoothedCadenceHudHz += (this.stepStats.rawCadenceHz - this.stepStats.smoothedCadenceHudHz) * 0.2

    this.debugStats.speedHistory.push({ t: this.elapsedSeconds, speed: this.motion.currentSpeed })
    if (this.debugStats.speedHistory.length > this.debugStats.historyLimit) this.debugStats.speedHistory.shift()

    const averageCadence = this.getAverageCadenceHz()
    const averageSpeed = this.getAverageSpeed()
    const ghostDistance = this.ghost.active ? Number(this.ghost.currentDistance.toFixed(3)) : null
    const leadDistance = this.ghost.active ? Number((this.distance - this.ghost.currentDistance).toFixed(3)) : null
    const leader = leadDistance === null ? 'none' : (leadDistance >= 0 ? 'player' : 'ghost')
    this.onHud({
      distance: this.distance,
      speed: Number(this.motion.currentSpeed.toFixed(2)),
      targetSpeed: Number(this.motion.targetSpeed.toFixed(2)),
      progress: clamp((this.distance / this.track.distanceMeters) * 100, 0, 100),
      status: this.status,
      message: this.message,
      mode: this.mode,
      elapsedSeconds: Number(this.elapsedSeconds.toFixed(2)),
      simulationSeconds: Number(this.simulationSeconds.toFixed(2)),
      finishTimeSeconds: this.finishTimeSeconds !== null ? Number(this.finishTimeSeconds.toFixed(2)) : null,
      practiceRemainingSeconds: Number(this.practiceRemainingSeconds.toFixed(2)),
      soundEnabled: this.soundEnabled,
      startState: this.startSequence.stage,
      startTick: this.startSequence.startTick,
      goTick: this.startSequence.goTick,
      falseStart: this.sessionTrace.falseStart,
      runMode: this.runMode,
      replayAvailable: Boolean(this.lastCompletedReplay),
      ghost: {
        active: this.ghost.active,
        distance: ghostDistance,
        leadDistance,
        leader,
        finished: this.ghost.finished,
      },
      cadence: {
        rawCadence: Number(this.stepStats.rawCadenceHz.toFixed(2)),
        rawStrideCadence: Number((this.stepStats.rawCadenceHz / 2).toFixed(2)),
        smoothedCadence: Number(this.stepStats.smoothedCadenceHudHz.toFixed(2)),
        cadenceStability: Number(this.stepStats.cadenceStability.toFixed(3)),
        cadenceQuality: Number(this.stepStats.cadenceQuality.toFixed(3)),
        band: this.stepStats.cadenceBand,
        status: this.stepStats.cadenceStatus,
        optimalStepCadenceHz: Number(this.config.cadence.optimalStepCadenceHz.toFixed(2)),
        optimalWindowHz: Number(this.config.cadence.optimalWindowHz.toFixed(2)),
      },
      stepCount: this.stepStats.validStepCount,
      lastValidFoot: this.stepStats.lastFoot,
      invalidRepeatedPresses: this.stepStats.invalidRepeatedPresses,
      averageCadence: Number(averageCadence.toFixed(2)),
      averageSpeed: Number(averageSpeed.toFixed(2)),
      lane: Math.floor(this.track.lanes / 2) + 1,
      collisionCount: 0,
      sessionTrace: this.sessionTrace,
      debug: this.debugEnabled
        ? {
          fps: Number(this.debugStats.fps.toFixed(2)),
          tickHz: Math.round(1000 / FIXED_STEP_MS),
          lastKeydownTimestampMs: this.debugStats.lastKeydownTimestampMs !== null ? Number(this.debugStats.lastKeydownTimestampMs.toFixed(2)) : null,
          inputLatencyMs: this.debugStats.lastInputLatencyMs !== null ? Number(this.debugStats.lastInputLatencyMs.toFixed(2)) : null,
          animationPhase: Number(this.motion.animationPhase.toFixed(3)),
          speedHistory: this.debugStats.speedHistory.slice(-60).map((item) => Number(item.speed.toFixed(3))),
        }
        : null,
    })
  }

  renderStartSequenceOverlay(profile) {
    if (this.mode !== 'race') return
    if (this.status !== 'on_your_marks' && this.status !== 'set' && this.status !== 'go' && this.status !== 'false_start') return

    const ctx = this.ctx
    const centerX = profile.width * 0.5
    const centerY = profile.height * 0.27
    const pulse = 0.92 + (Math.sin(this.simulationSeconds * TAU * 1.8) * 0.08)

    let text = 'VÀO VỊ TRÍ'
    let color = VKL_RENDER_THEME.startOnYourMarks
    let helper = 'Giữ tay khỏi phím cho tới tín hiệu GO'
    if (this.status === 'set') {
      text = 'SẴN SÀNG'
      color = VKL_RENDER_THEME.startSet
      helper = 'Chờ tín hiệu súng xuất phát'
    } else if (this.status === 'go') {
      text = 'ĐOÀNG! GO!'
      color = VKL_RENDER_THEME.startGo
      helper = 'Bắt đầu bấm ← → luân phiên'
    } else if (this.status === 'false_start') {
      text = 'XUẤT PHÁT PHẠM QUY'
      color = VKL_RENDER_THEME.startFalseStart
      helper = 'Nhấn Start để xuất phát lại'
    }

    ctx.save()
    ctx.globalAlpha = this.status === 'go' ? 0.82 : 0.9
    ctx.fillStyle = VKL_RENDER_THEME.startOverlayBg
    ctx.fillRect(profile.width * 0.18, profile.height * 0.16, profile.width * 0.64, profile.height * 0.21)
    ctx.globalAlpha = 1
    ctx.fillStyle = color
    ctx.font = `700 ${Math.round(30 * pulse)}px sans-serif`
    ctx.textAlign = 'center'
    ctx.fillText(text, centerX, centerY)
    ctx.fillStyle = VKL_RENDER_THEME.startHelper
    ctx.font = '600 15px sans-serif'
    ctx.fillText(helper, centerX, centerY + 32)
    ctx.restore()
  }

  renderOverlay(profile) {
    const ctx = this.ctx
    ctx.fillStyle = VKL_RENDER_THEME.overlayText
    ctx.font = '600 18px sans-serif'
    ctx.fillText(`D: ${(this.distance / this.track.distanceMeters * 100).toFixed(0)}%`, 26, 38)
    ctx.fillText(`Speed: ${this.motion.currentSpeed.toFixed(2)} m/s`, 26, 64)
    ctx.fillText(`Cadence: ${this.stepStats.rawCadenceHz.toFixed(2)} hz`, 26, 90)
    if (this.mode === 'practice') {
      ctx.fillText(`Practice: ${this.practiceRemainingSeconds.toFixed(1)}s`, 26, 116)
    } else {
      ctx.fillText(`Time: ${this.elapsedSeconds.toFixed(2)}s`, 26, 116)
    }
    ctx.fillText(this.message, 26, 142)

    if (this.status === 'finished') {
      ctx.fillStyle = VKL_RENDER_THEME.finishedPanel
      ctx.fillRect(profile.width * 0.2, profile.height * 0.12, profile.width * 0.6, profile.height * 0.23)
      ctx.fillStyle = VKL_RENDER_THEME.finishedText
      ctx.font = '700 28px sans-serif'
      ctx.fillText(this.mode === 'practice' ? 'Hoàn thành practice' : 'Về đích!', profile.width * 0.35, profile.height * 0.2)
      ctx.font = '600 20px sans-serif'
      ctx.fillText(`Time: ${(this.finishTimeSeconds || 0).toFixed(2)}s`, profile.width * 0.35, profile.height * 0.26)
      ctx.fillText(`Avg speed: ${this.getAverageSpeed().toFixed(2)} m/s`, profile.width * 0.35, profile.height * 0.31)
    }
  }

  render(interpolationAlpha = 0) {
    const ctx = this.ctx
    const renderDistance = lerp(this.previousDistance, this.distance, interpolationAlpha)
    const profile = this.getTrackProfile()
    ctx.clearRect(0, 0, profile.width, profile.height)
    this.renderRoad(profile, renderDistance)
    this.renderFinishLine(profile, renderDistance)
    this.renderGhostRunner(profile, renderDistance)
    this.renderRunner(profile)
    this.renderStartSequenceOverlay(profile)
    this.renderOverlay(profile)
    this.renderDebugOverlay(profile)
  }

  destroy() {
    this.unbindInput()
    if (this.frameId !== null && typeof window !== 'undefined') {
      window.cancelAnimationFrame(this.frameId)
      this.frameId = null
    }
    if (this.audio?.context?.close) {
      this.audio.context.close().catch(() => {})
    }
  }
}
