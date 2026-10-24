import test from 'node:test'
import assert from 'node:assert/strict'
import { GhostRaceEngine, calculateCadenceQuality } from '../src/modules/game/utils/ghostRaceEngine.js'

function createMockContext() {
  const gradient = { addColorStop: () => {} }
  return {
    fillStyle: '',
    strokeStyle: '',
    lineWidth: 1,
    font: '',
    save: () => {},
    restore: () => {},
    beginPath: () => {},
    closePath: () => {},
    moveTo: () => {},
    lineTo: () => {},
    fill: () => {},
    stroke: () => {},
    fillRect: () => {},
    clearRect: () => {},
    clip: () => {},
    arc: () => {},
    ellipse: () => {},
    translate: () => {},
    rotate: () => {},
    scale: () => {},
    fillText: () => {},
    createLinearGradient: () => gradient,
  }
}

function createMockCanvas(width = 960, height = 430) {
  const context = createMockContext()
  return { width, height, getContext: () => context }
}

function buildAlternatingScript(durationSeconds, intervalProvider) {
  const script = []
  let foot = 'left'
  let time = 0.2
  while (time < durationSeconds) {
    script.push({ time, foot })
    foot = foot === 'left' ? 'right' : 'left'
    time += intervalProvider(script.length)
  }
  return script
}

function runScenario({ mode = 'practice', durationSeconds, script }) {
  const engine = new GhostRaceEngine({
    canvas: createMockCanvas(),
    onHud: () => {},
    initialMode: mode,
  })
  engine.start()
  const dt = 1 / 60
  const ticks = Math.floor(durationSeconds / dt)
  let index = 0
  let maxSpeed = 0

  for (let tick = 0; tick < ticks; tick += 1) {
    const simTime = tick * dt
    while (index < script.length && script[index].time <= simTime + 1e-9) {
      engine.handleStride(script[index].foot)
      index += 1
    }
    engine.update(dt)
    maxSpeed = Math.max(maxSpeed, engine.motion.currentSpeed)
  }

  return {
    maxSpeed,
    avgSpeed: engine.getAverageSpeed(),
    distance: engine.distance,
    cadenceStability: engine.stepStats.cadenceStability,
    cadenceQuality: engine.stepStats.cadenceQuality,
    cadenceHz: engine.stepStats.rawCadenceHz,
    validSteps: engine.stepStats.validStepCount,
    invalidRepeat: engine.stepStats.invalidRepeatedPresses,
  }
}

function runRaceAndCaptureReplay(script, durationSeconds = 45) {
  const engine = new GhostRaceEngine({ canvas: createMockCanvas(), onHud: () => {}, initialMode: 'race' })
  engine.start()
  const dt = 1 / 60
  let index = 0
  const ticks = Math.floor(durationSeconds / dt)
  for (let tick = 0; tick < ticks; tick += 1) {
    const simTime = tick * dt
    while (index < script.length && script[index].time <= simTime + 1e-9) {
      engine.handleStride(script[index].foot)
      index += 1
    }
    engine.update(dt)
    if (engine.status === 'finished') break
  }
  return {
    engine,
    replay: engine.consumeCompletedReplay(),
  }
}

function keyEvent(key, repeat = false) {
  return {
    key,
    repeat,
    timeStamp: 100,
    preventDefault: () => {},
  }
}

test('cadence quality still rewards stable optimal rhythm', () => {
  const optimal = calculateCadenceQuality({
    stepCadenceHz: 5.3,
    cadenceStability: 0.92,
    optimalStepCadenceHz: 5.35,
    optimalWindowHz: 1.05,
    overfastPenaltyWindowHz: 1.45,
  })
  const unstable = calculateCadenceQuality({
    stepCadenceHz: 5.3,
    cadenceStability: 0.25,
    optimalStepCadenceHz: 5.35,
    optimalWindowHz: 1.05,
    overfastPenaltyWindowHz: 1.45,
  })
  const tooFast = calculateCadenceQuality({
    stepCadenceHz: 7.7,
    cadenceStability: 0.92,
    optimalStepCadenceHz: 5.35,
    optimalWindowHz: 1.05,
    overfastPenaltyWindowHz: 1.45,
  })

  assert.ok(optimal > unstable)
  assert.ok(optimal > tooFast)
})

test('alternate input rule rejects repeated same-foot presses', () => {
  const engine = new GhostRaceEngine({ canvas: createMockCanvas(), onHud: () => {}, initialMode: 'practice' })
  engine.start()
  engine.handleStride('left')
  engine.update(0.12)
  engine.handleStride('left')
  engine.update(0.12)
  engine.handleStride('right')
  engine.update(0.12)
  engine.handleStride('right')
  engine.update(0.12)
  engine.handleStride('left')

  assert.equal(engine.stepStats.validStepCount, 3)
  assert.equal(engine.stepStats.invalidRepeatedPresses, 2)
})

test('race start sequence reaches GO then running in order', () => {
  const engine = new GhostRaceEngine({ canvas: createMockCanvas(), onHud: () => {}, initialMode: 'race' })
  engine.start()
  assert.equal(engine.status, 'on_your_marks')
  const dt = 1 / 60
  for (let i = 0; i < 60; i += 1) engine.update(dt)
  assert.equal(engine.status, 'set')
  for (let i = 0; i < 52; i += 1) engine.update(dt)
  assert.equal(engine.status, 'go')
  assert.ok(engine.startSequence.goTick !== null)
  for (let i = 0; i < 28; i += 1) engine.update(dt)
  assert.equal(engine.status, 'running')
  assert.ok(engine.elapsedSeconds > 0)
})

test('pressing arrow before GO triggers false start', () => {
  const engine = new GhostRaceEngine({ canvas: createMockCanvas(), onHud: () => {}, initialMode: 'race' })
  engine.start()
  engine.handleKeyDown(keyEvent('ArrowLeft'))
  assert.equal(engine.status, 'false_start')
  assert.equal(engine.sessionTrace.falseStart?.foot, 'left')
  const beforeDistance = engine.distance
  engine.update(1 / 60)
  assert.equal(engine.distance, beforeDistance)
})

test('touch pointerdown maps to the same stride inputs as keyboard controls', () => {
  const engine = new GhostRaceEngine({ canvas: createMockCanvas(), onHud: () => {}, initialMode: 'race' })
  engine.start()
  const dt = 1 / 60
  for (let i = 0; i < 132; i += 1) engine.update(dt)
  assert.equal(engine.status, 'running')

  engine.handleTouchPress('left', { pointerId: 1, timeStamp: 200, preventDefault: () => {} })
  engine.handleTouchRelease('left', 1, { preventDefault: () => {} })
  engine.update(0.2)
  engine.handleTouchPress('right', { pointerId: 2, timeStamp: 250, preventDefault: () => {} })
  engine.handleTouchRelease('right', 2, { preventDefault: () => {} })

  assert.equal(engine.stepStats.validStepCount, 2)
  assert.equal(engine.sessionTrace.validInputs[0].foot, 'left')
  assert.equal(engine.sessionTrace.validInputs[1].foot, 'right')
})

test('touch before GO triggers false start and hold does not count as post-GO step', () => {
  const engine = new GhostRaceEngine({ canvas: createMockCanvas(), onHud: () => {}, initialMode: 'race' })
  engine.start()
  engine.handleTouchPress('left', { pointerId: 11, timeStamp: 50, preventDefault: () => {} })
  assert.equal(engine.status, 'false_start')
  engine.handleTouchRelease('left', 11, { preventDefault: () => {} })

  engine.reset()
  engine.start()
  engine.pressedKeys.left = true
  const dt = 1 / 60
  for (let i = 0; i < 132; i += 1) engine.update(dt)
  assert.equal(engine.status, 'running')
  assert.equal(engine.stepStats.validStepCount, 0)

  engine.handleTouchRelease('left', 11, { preventDefault: () => {} })
  engine.handleTouchPress('left', { pointerId: 12, timeStamp: 600, preventDefault: () => {} })
  engine.handleTouchRelease('left', 12, { preventDefault: () => {} })
  assert.equal(engine.stepStats.validStepCount, 1)
})

test('holding key before GO does not create step after GO without new keydown', () => {
  const engine = new GhostRaceEngine({ canvas: createMockCanvas(), onHud: () => {}, initialMode: 'race' })
  engine.start()
  engine.pressedKeys.left = true
  const dt = 1 / 60
  for (let i = 0; i < 132; i += 1) engine.update(dt)
  assert.equal(engine.status, 'running')
  assert.equal(engine.stepStats.validStepCount, 0)
  engine.handleKeyUp(keyEvent('ArrowLeft'))
  engine.handleKeyDown(keyEvent('ArrowLeft'))
  assert.equal(engine.stepStats.validStepCount, 1)
})

test('browser key repeat does not create fake steps', () => {
  const engine = new GhostRaceEngine({ canvas: createMockCanvas(), onHud: () => {}, initialMode: 'practice' })
  engine.start()
  engine.handleKeyDown(keyEvent('ArrowLeft'))
  engine.handleKeyDown(keyEvent('ArrowLeft', true))
  engine.handleKeyUp(keyEvent('ArrowLeft'))
  engine.update(0.12)
  engine.handleKeyDown(keyEvent('ArrowRight'))
  engine.handleKeyDown(keyEvent('ArrowRight', true))
  engine.handleKeyUp(keyEvent('ArrowRight'))
  assert.equal(engine.stepStats.validStepCount, 2)
  assert.equal(engine.stepStats.invalidRepeatedPresses, 0)
})

test('A and D are ignored in official controls', () => {
  const engine = new GhostRaceEngine({ canvas: createMockCanvas(), onHud: () => {}, initialMode: 'practice' })
  engine.start()
  engine.handleKeyDown(keyEvent('a'))
  engine.handleKeyDown(keyEvent('d'))
  assert.equal(engine.stepStats.validStepCount, 0)
})

test('scenario suite: stable rhythm outperforms unstable/too-fast rhythm', () => {
  const stable10 = runScenario({
    durationSeconds: 10,
    script: buildAlternatingScript(10, () => 0.185),
  })
  const stable30 = runScenario({
    durationSeconds: 30,
    script: buildAlternatingScript(30, () => 0.186),
  })
  const irregular = runScenario({
    durationSeconds: 10,
    script: buildAlternatingScript(10, (index) => {
      const arr = [0.11, 0.31, 0.17, 0.28, 0.15, 0.34]
      return arr[index % arr.length]
    }),
  })
  const tooFast = runScenario({
    durationSeconds: 10,
    script: buildAlternatingScript(10, () => 0.105),
  })

  assert.ok(stable10.maxSpeed >= 10 && stable10.maxSpeed <= 12.4)
  assert.ok(stable30.avgSpeed > irregular.avgSpeed)
  assert.ok(stable10.avgSpeed > tooFast.avgSpeed)
  assert.ok(stable10.cadenceStability > irregular.cadenceStability)
})

test('scenario: stop pressing then recover', () => {
  const script = [
    ...buildAlternatingScript(4, () => 0.19),
    ...buildAlternatingScript(10, () => 0.19).map((item) => ({ ...item, time: item.time + 6 })),
  ]
  const result = runScenario({ durationSeconds: 12, script })
  assert.ok(result.maxSpeed > 9.5)
  assert.ok(result.distance > 55)
})

test('deterministic replay with same scripted cadence input', () => {
  const script = buildAlternatingScript(8, (index) => {
    const arr = [0.19, 0.2, 0.18, 0.21]
    return arr[index % arr.length]
  })
  const first = runScenario({ durationSeconds: 8, script })
  const second = runScenario({ durationSeconds: 8, script })
  assert.deepEqual(
    {
      maxSpeed: Number(first.maxSpeed.toFixed(6)),
      avgSpeed: Number(first.avgSpeed.toFixed(6)),
      distance: Number(first.distance.toFixed(6)),
      cadence: Number(first.cadenceHz.toFixed(6)),
      quality: Number(first.cadenceQuality.toFixed(6)),
      validSteps: first.validSteps,
      invalidRepeat: first.invalidRepeat,
    },
    {
      maxSpeed: Number(second.maxSpeed.toFixed(6)),
      avgSpeed: Number(second.avgSpeed.toFixed(6)),
      distance: Number(second.distance.toFixed(6)),
      cadence: Number(second.cadenceHz.toFixed(6)),
      quality: Number(second.cadenceQuality.toFixed(6)),
      validSteps: second.validSteps,
      invalidRepeat: second.invalidRepeat,
    },
  )
})

test('race still reaches finish and records time', () => {
  const engine = new GhostRaceEngine({ canvas: createMockCanvas(), onHud: () => {}, initialMode: 'race' })
  engine.start()
  const dt = 1 / 60
  const script = buildAlternatingScript(45, () => 0.186)
  let index = 0
  for (let tick = 0; tick < 45 / dt; tick += 1) {
    const simTime = tick * dt
    while (index < script.length && script[index].time <= simTime + 1e-9) {
      engine.handleStride(script[index].foot)
      index += 1
    }
    engine.update(dt)
    if (engine.status === 'finished') break
  }
  assert.equal(engine.status, 'finished')
  assert.equal(engine.distance, engine.track.distanceMeters)
  assert.ok(engine.finishTimeSeconds !== null)
})

test('completed race produces replay data with go tick and inputs', () => {
  const script = buildAlternatingScript(45, () => 0.186)
  const { replay } = runRaceAndCaptureReplay(script)
  assert.ok(replay)
  assert.equal(replay.mode, 'race')
  assert.equal(replay.falseStart, null)
  assert.ok(Array.isArray(replay.inputs) && replay.inputs.length > 0)
  assert.ok(Array.isArray(replay.checkpoints) && replay.checkpoints.length > 0)
  assert.ok(Array.isArray(replay.tickStates) && replay.tickStates.length > 0)
  assert.ok(Number.isFinite(replay.result.finishTimeSeconds))
})

test('replay playback reproduces original finish time and distance', () => {
  const script = buildAlternatingScript(45, () => 0.186)
  const { replay } = runRaceAndCaptureReplay(script)
  const replayEngine = new GhostRaceEngine({ canvas: createMockCanvas(), onHud: () => {}, initialMode: 'race' })
  const started = replayEngine.startReplay(replay)
  assert.equal(started, true)
  const dt = 1 / 60
  for (let tick = 0; tick < 45 / dt; tick += 1) {
    replayEngine.update(dt)
    if (replayEngine.status === 'finished') break
  }
  assert.equal(replayEngine.status, 'finished')
  assert.equal(replayEngine.distance, replayEngine.track.distanceMeters)
  assert.ok(Math.abs(replayEngine.finishTimeSeconds - replay.result.finishTimeSeconds) <= dt * 1.1)
})

test('pause and resume during replay keeps simulation aligned', () => {
  const script = buildAlternatingScript(45, () => 0.186)
  const { replay } = runRaceAndCaptureReplay(script)
  const replayEngine = new GhostRaceEngine({ canvas: createMockCanvas(), onHud: () => {}, initialMode: 'race' })
  replayEngine.startReplay(replay)
  const dt = 1 / 60
  for (let i = 0; i < 120; i += 1) replayEngine.update(dt)
  replayEngine.pause()
  const frozenElapsed = replayEngine.elapsedSeconds
  const frozenTick = replayEngine.tickCount
  for (let i = 0; i < 120; i += 1) replayEngine.update(dt)
  assert.equal(replayEngine.elapsedSeconds, frozenElapsed)
  assert.equal(replayEngine.tickCount, frozenTick)
  replayEngine.start()
  for (let i = 0; i < 45 / dt; i += 1) {
    replayEngine.update(dt)
    if (replayEngine.status === 'finished') break
  }
  assert.equal(replayEngine.status, 'finished')
  assert.ok(Math.abs(replayEngine.finishTimeSeconds - replay.result.finishTimeSeconds) <= dt * 1.1)
})

test('keyboard input is ignored during replay playback', () => {
  const script = buildAlternatingScript(45, () => 0.186)
  const { replay } = runRaceAndCaptureReplay(script)
  const replayEngine = new GhostRaceEngine({ canvas: createMockCanvas(), onHud: () => {}, initialMode: 'race' })
  const baselineEngine = new GhostRaceEngine({ canvas: createMockCanvas(), onHud: () => {}, initialMode: 'race' })
  replayEngine.startReplay(replay)
  baselineEngine.startReplay(replay)
  const dt = 1 / 60
  for (let i = 0; i < 180; i += 1) {
    replayEngine.handleKeyDown(keyEvent('ArrowLeft'))
    replayEngine.handleKeyDown(keyEvent('ArrowRight'))
    replayEngine.update(dt)
    baselineEngine.update(dt)
  }
  assert.equal(replayEngine.stepStats.validStepCount, baselineEngine.stepStats.validStepCount)
  assert.equal(Number(replayEngine.distance.toFixed(6)), Number(baselineEngine.distance.toFixed(6)))
})

test('false start does not create completed replay record', () => {
  const engine = new GhostRaceEngine({ canvas: createMockCanvas(), onHud: () => {}, initialMode: 'race' })
  engine.start()
  engine.handleKeyDown(keyEvent('ArrowLeft'))
  assert.equal(engine.status, 'false_start')
  const replay = engine.consumeCompletedReplay()
  assert.equal(replay, null)
})
