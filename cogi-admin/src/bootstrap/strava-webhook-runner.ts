import os from 'node:os'

const STRAVA_WEBHOOK_EVENT_UID = 'api::strava-webhook-event.strava-webhook-event'
const STRAVA_WEBHOOK_EVENT_TABLE = 'strava_webhook_events'
const DEFAULT_INTERVAL_SECONDS = 5
const DEFAULT_MAX_RETRIES = 5
const DEFAULT_CLAIM_BATCH_SIZE = 10
const DEFAULT_RETRY_BASE_SECONDS = 30
const DEFAULT_STALE_MINUTES = 10

type RunnerConfig = {
  enabled: boolean
  handlerEnabled: boolean
  intervalMs: number
  maxRetries: number
  batchSize: number
  staleMs: number
  runnerId: string
}

type DispatchResult = 'SUCCESS' | 'IGNORED' | 'NOT_IMPLEMENTED'

type ClaimedWebhookEvent = {
  id: number
  status: string
  objectType: string
  aspectType: string
  attempts: number
  claimedBy: string
  wasStale: boolean
}

type WebhookEventRecord = {
  id: number
  status?: string | null
  objectType?: string | null
  aspectType?: string | null
  ownerId?: string | null
  objectId?: string | null
  subscriptionId?: string | null
  eventTime?: string | null
  rawPayload?: Record<string, unknown> | null
  attempts?: number | null
  claimedBy?: string | null
}

type RunnerState = {
  timer: NodeJS.Timeout | null
  enabled: boolean
  shuttingDown: boolean
  tickInProgress: boolean
  activeEvents: Map<number, Promise<void>>
  runnerId: string
}

const runnerState: RunnerState = {
  timer: null,
  enabled: false,
  shuttingDown: false,
  tickInProgress: false,
  activeEvents: new Map(),
  runnerId: '',
}

function toText(value: unknown): string {
  if (value === null || value === undefined) return ''
  return String(value).trim()
}

function toPositiveInt(value: unknown, fallback: number): number {
  const parsed = Number(value)
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback
}

function toBoolean(value: unknown, fallback: boolean) {
  const text = toText(value).toLowerCase()
  if (!text) return fallback
  if (['1', 'true', 'yes', 'on'].includes(text)) return true
  if (['0', 'false', 'no', 'off'].includes(text)) return false
  return fallback
}

function resolveRunnerConfig(): RunnerConfig {
  const enabled = toBoolean(process.env.STRAVA_WEBHOOK_RUNNER_ENABLED, false)
  const handlerEnabled = toBoolean(process.env.STRAVA_WEBHOOK_HANDLER_ENABLED, false)
  const intervalSeconds = toPositiveInt(process.env.STRAVA_WEBHOOK_RUNNER_INTERVAL_SECONDS, DEFAULT_INTERVAL_SECONDS)
  const maxRetries = Math.max(1, toPositiveInt(process.env.STRAVA_WEBHOOK_MAX_RETRY, DEFAULT_MAX_RETRIES))
  const staleMinutes = toPositiveInt(process.env.STRAVA_WEBHOOK_STALE_MINUTES, DEFAULT_STALE_MINUTES)

  return {
    enabled,
    handlerEnabled,
    intervalMs: intervalSeconds * 1000,
    maxRetries,
    batchSize: DEFAULT_CLAIM_BATCH_SIZE,
    staleMs: staleMinutes * 60 * 1000,
    runnerId: `${os.hostname()}:${process.pid}`,
  }
}

function sanitizeWebhookErrorMessage(error: unknown): string {
  const fallback = 'Strava webhook worker failed'
  const text = toText((error as any)?.message || fallback)
  const sanitized = text
    .replace(/access[_\s-]*token/gi, 'redacted-token')
    .replace(/refresh[_\s-]*token/gi, 'redacted-token')
    .replace(/client[_\s-]*secret/gi, 'redacted-secret')

  return sanitized.slice(0, 1000) || fallback
}

function calculateWebhookRetryAt(attempts: number): Date {
  const safeAttempts = Math.max(1, Number(attempts || 1))
  const delaySeconds = DEFAULT_RETRY_BASE_SECONDS * (2 ** Math.max(0, safeAttempts - 1))
  return new Date(Date.now() + (delaySeconds * 1000))
}

async function getWebhookEventById(strapi: any, eventId: number): Promise<WebhookEventRecord | null> {
  const row = await strapi.db.query(STRAVA_WEBHOOK_EVENT_UID).findOne({
    where: { id: eventId },
    select: ['id', 'status', 'objectType', 'aspectType', 'ownerId', 'objectId', 'subscriptionId', 'eventTime', 'rawPayload', 'attempts', 'claimedBy'],
  })

  return (row as WebhookEventRecord | null) || null
}

async function claimNextStravaWebhookEvents(options: { strapi: any, runnerId: string, batchSize: number, staleMs: number }): Promise<ClaimedWebhookEvent[]> {
  const { strapi, runnerId, batchSize, staleMs } = options
  const knex = strapi.db.connection
  const now = new Date()
  const staleBefore = new Date(now.getTime() - staleMs)

  return knex.transaction(async (trx: any) => {
    const candidates = await trx(STRAVA_WEBHOOK_EVENT_TABLE)
      .select([
        'id',
        'status',
        'object_type as objectType',
        'aspect_type as aspectType',
        'attempts',
        'claimed_by as claimedBy',
        'claimed_at as claimedAt',
      ])
      .andWhere((builder: any) => {
        builder
          .where((readyBuilder: any) => {
            readyBuilder
              .whereIn('status', ['pending', 'failed'])
              .andWhere((attemptBuilder: any) => {
                attemptBuilder.whereNull('next_attempt_at').orWhere('next_attempt_at', '<=', now)
              })
          })
          .orWhere((staleBuilder: any) => {
            staleBuilder
              .where('status', 'processing')
              .whereNotNull('claimed_at')
              .where('claimed_at', '<=', staleBefore)
          })
      })
      .orderBy('created_at', 'asc')
      .orderBy('id', 'asc')
      .limit(batchSize)
      .forUpdate()
      .skipLocked()

    const ids = candidates.map((candidate: any) => Number(candidate.id || 0)).filter(Boolean)
    if (ids.length === 0) return []

    await trx(STRAVA_WEBHOOK_EVENT_TABLE)
      .whereIn('id', ids)
      .update({
        status: 'processing',
        claimed_at: now,
        claimed_by: runnerId,
      })

    return candidates.map((candidate: any) => ({
      id: Number(candidate.id || 0),
      status: 'processing',
      objectType: toText(candidate.objectType),
      aspectType: toText(candidate.aspectType),
      attempts: Number(candidate.attempts || 0),
      claimedBy: toText(candidate.claimedBy),
      wasStale: toText(candidate.status).toLowerCase() === 'processing' && Boolean(candidate.claimedAt),
    }))
  })
}

async function markWebhookEventProcessed(strapi: any, eventId: number, runnerId: string) {
  const now = new Date()
  await strapi.db.query(STRAVA_WEBHOOK_EVENT_UID).update({
    where: {
      id: eventId,
      claimedBy: runnerId,
    },
    data: {
      status: 'processed',
      processedAt: now,
      nextAttemptAt: null,
      lastError: null,
    },
  })
}

async function markWebhookEventIgnored(strapi: any, eventId: number, runnerId: string) {
  const now = new Date()
  await strapi.db.query(STRAVA_WEBHOOK_EVENT_UID).update({
    where: {
      id: eventId,
      claimedBy: runnerId,
    },
    data: {
      status: 'ignored',
      processedAt: now,
      nextAttemptAt: null,
    },
  })
}

async function releaseWebhookEventToPending(strapi: any, eventId: number, runnerId: string) {
  await strapi.db.query(STRAVA_WEBHOOK_EVENT_UID).update({
    where: {
      id: eventId,
      claimedBy: runnerId,
    },
    data: {
      status: 'pending',
      claimedAt: null,
      claimedBy: null,
    },
  })
}

async function releaseClaimedWebhookEventsForShutdown(strapi: any, eventIds: number[], runnerId: string) {
  if (eventIds.length === 0) return

  await strapi.db.connection(STRAVA_WEBHOOK_EVENT_TABLE)
    .whereIn('id', eventIds)
    .andWhere('claimed_by', runnerId)
    .update({
      status: 'pending',
      claimed_at: null,
      claimed_by: null,
    })

  eventIds.forEach((eventId) => {
    strapi.log.info(`[strava-webhook-runner] released event=${String(eventId)} reason=shutdown`)
  })
}

async function markWebhookEventFailed(options: {
  strapi: any
  eventId: number
  runnerId: string
  attempts: number
  maxRetries: number
  error: unknown
}) {
  const { strapi, eventId, runnerId, attempts, maxRetries, error } = options
  const nextAttempts = Math.max(0, Number(attempts || 0)) + 1
  const sanitizedError = sanitizeWebhookErrorMessage(error)

  if (nextAttempts >= maxRetries) {
    await strapi.db.query(STRAVA_WEBHOOK_EVENT_UID).update({
      where: {
        id: eventId,
        claimedBy: runnerId,
      },
      data: {
        status: 'dead_letter',
        attempts: nextAttempts,
        processedAt: new Date(),
        lastError: sanitizedError,
        nextAttemptAt: null,
      },
    })
    return { deadLetter: true, nextAttemptAt: null as Date | null }
  }

  const nextAttemptAt = calculateWebhookRetryAt(nextAttempts)
  await strapi.db.query(STRAVA_WEBHOOK_EVENT_UID).update({
    where: {
      id: eventId,
      claimedBy: runnerId,
    },
    data: {
      status: 'failed',
      attempts: nextAttempts,
      processedAt: null,
      lastError: sanitizedError,
      nextAttemptAt,
    },
  })

  return { deadLetter: false, nextAttemptAt }
}

async function handleActivityEvent(strapi: any, event: WebhookEventRecord, handlerEnabled: boolean): Promise<DispatchResult> {
  strapi.log.info(`[strava-webhook-runner] handle activity event=${String(event.id)} aspect=${toText(event.aspectType) || '-'} objectId=${toText(event.objectId) || '-'}`)
  if (!handlerEnabled) return 'NOT_IMPLEMENTED'
  return strapi.service('api::strava.strava').processActivityWebhookEvent(event)
}

async function handleAthleteEvent(strapi: any, event: WebhookEventRecord, handlerEnabled: boolean): Promise<DispatchResult> {
  strapi.log.info(`[strava-webhook-runner] handle athlete event=${String(event.id)} aspect=${toText(event.aspectType) || '-'} ownerId=${toText(event.ownerId) || '-'}`)
  if (!handlerEnabled) return 'NOT_IMPLEMENTED'
  return strapi.service('api::strava.strava').processAthleteWebhookEvent(event)
}

async function dispatchWebhookEvent(strapi: any, event: WebhookEventRecord, handlerEnabled: boolean): Promise<DispatchResult> {
  switch (toText(event.objectType).toLowerCase()) {
    case 'activity':
      return handleActivityEvent(strapi, event, handlerEnabled)
    case 'athlete':
      return handleAthleteEvent(strapi, event, handlerEnabled)
    default:
      strapi.log.info(`[strava-webhook-runner] skip unknown objectType event=${String(event.id)} objectType=${toText(event.objectType) || '-'}`)
      return 'NOT_IMPLEMENTED'
  }
}

async function runClaimedWebhookEvent(options: { strapi: any, event: ClaimedWebhookEvent, config: RunnerConfig }) {
  const { strapi, event, config } = options
  const currentEvent = await getWebhookEventById(strapi, event.id)

  if (!currentEvent?.id) return
  if (toText(currentEvent.status).toLowerCase() !== 'processing') return
  if (toText(currentEvent.claimedBy) !== config.runnerId) return

  try {
    const dispatchResult = await dispatchWebhookEvent(strapi, currentEvent, config.handlerEnabled)
    if (dispatchResult === 'NOT_IMPLEMENTED') {
      await releaseWebhookEventToPending(strapi, event.id, config.runnerId)
      strapi.log.info(`[strava-webhook-runner] released event=${String(event.id)} objectType=${toText(currentEvent.objectType) || '-'} aspect=${toText(currentEvent.aspectType) || '-'} reason=not_implemented`)
      return
    }

    if (dispatchResult === 'IGNORED') {
      await markWebhookEventIgnored(strapi, event.id, config.runnerId)
      strapi.log.info(`[strava-webhook-runner] ignored event=${String(event.id)} objectType=${toText(currentEvent.objectType) || '-'} aspect=${toText(currentEvent.aspectType) || '-'} attempts=${String(currentEvent.attempts || 0)}`)
      return
    }

    await markWebhookEventProcessed(strapi, event.id, config.runnerId)
    strapi.log.info(`[strava-webhook-runner] processed event=${String(event.id)} objectType=${toText(currentEvent.objectType) || '-'} aspect=${toText(currentEvent.aspectType) || '-'} attempts=${String(currentEvent.attempts || 0)}`)
  } catch (error: any) {
    const result = await markWebhookEventFailed({
      strapi,
      eventId: event.id,
      runnerId: config.runnerId,
      attempts: Number(currentEvent.attempts || 0),
      maxRetries: config.maxRetries,
      error,
    })

    if (result.deadLetter) {
      strapi.log.warn(`[strava-webhook-runner] dead_letter event=${String(event.id)} objectType=${toText(currentEvent.objectType) || '-'} aspect=${toText(currentEvent.aspectType) || '-'} attempts=${String(Number(currentEvent.attempts || 0) + 1)}`)
      return
    }

    strapi.log.warn(`[strava-webhook-runner] failed event=${String(event.id)} objectType=${toText(currentEvent.objectType) || '-'} aspect=${toText(currentEvent.aspectType) || '-'} attempts=${String(Number(currentEvent.attempts || 0) + 1)} nextAttemptAt=${result.nextAttemptAt ? result.nextAttemptAt.toISOString() : '-'}`)
  }
}

export async function runStravaWebhookRunnerTick(strapi: any) {
  const config = resolveRunnerConfig()
  if (!config.enabled || runnerState.shuttingDown) return
  if (runnerState.tickInProgress) return

  runnerState.tickInProgress = true

  try {
    const slots = Math.max(0, config.batchSize - runnerState.activeEvents.size)
    if (slots <= 0) return

    const claimedEvents = await claimNextStravaWebhookEvents({
      strapi,
      runnerId: config.runnerId,
      batchSize: slots,
      staleMs: config.staleMs,
    })

    if (runnerState.shuttingDown) {
      await releaseClaimedWebhookEventsForShutdown(strapi, claimedEvents.map((event) => event.id), config.runnerId)
      return
    }

    claimedEvents.forEach((event) => {
      strapi.log.info(`[strava-webhook-runner] claimed event=${String(event.id)} objectType=${event.objectType || '-'} aspect=${event.aspectType || '-'} attempts=${String(event.attempts || 0)}${event.wasStale ? ' stale-recovered=true' : ''}${event.claimedBy ? ` previousClaimedBy=${event.claimedBy}` : ''}`)
    })

    await Promise.allSettled(claimedEvents.map((event) => {
      const promise = runClaimedWebhookEvent({ strapi, event, config })
        .finally(() => {
          runnerState.activeEvents.delete(event.id)
        })
      runnerState.activeEvents.set(event.id, promise)
      return promise
    }))
  } finally {
    runnerState.tickInProgress = false
  }
}

export async function startStravaWebhookRunner(strapi: any) {
  const config = resolveRunnerConfig()
  runnerState.runnerId = config.runnerId
  runnerState.shuttingDown = false

  if (!config.enabled) {
    runnerState.enabled = false
    strapi.log.info('[strava-webhook-runner] disabled')
    return
  }

  if (runnerState.timer) {
    strapi.log.info('[strava-webhook-runner] already started')
    return
  }

  runnerState.enabled = true
  runnerState.timer = setInterval(() => {
    void runStravaWebhookRunnerTick(strapi)
  }, config.intervalMs)

  strapi.log.info(`[strava-webhook-runner] started interval=${String(config.intervalMs)}ms batchSize=${String(config.batchSize)} maxRetries=${String(config.maxRetries)} staleMs=${String(config.staleMs)} handlerEnabled=${String(config.handlerEnabled)} runnerId=${config.runnerId}`)
  void runStravaWebhookRunnerTick(strapi)
}

export async function stopStravaWebhookRunner(strapi: any) {
  runnerState.shuttingDown = true

  if (runnerState.timer) {
    clearInterval(runnerState.timer)
    runnerState.timer = null
  }

  while (runnerState.tickInProgress || runnerState.activeEvents.size > 0) {
    const activeEvents = Array.from(runnerState.activeEvents.values())
    if (activeEvents.length > 0) {
      await Promise.allSettled(activeEvents)
    }
    await new Promise<void>((resolve) => setImmediate(resolve))
  }

  runnerState.activeEvents.clear()
  runnerState.enabled = false
  strapi.log.info('[strava-webhook-runner] stopped')
}