import { createHash } from 'crypto';
import { toText } from '../../../utils/tenant-scope';

const GAME_UID = 'api::game.game';
const USER_TENANT_UID = 'api::user-tenant.user-tenant';

const MAX_UNTRUSTED_EVENT_AGE_MS = 5 * 60 * 1000;
const MAX_UNTRUSTED_FUTURE_SKEW_MS = 60 * 1000;
const SUPPORTED_GAME_TYPE_CODE = 'xp_challenge';

type ActivityCode = 'daily_active' | 'community_post' | 'community_comment';
type EventPhase = 'trial' | 'official';
type RuleLimitPeriod = 'daily' | 'game';
type EventStatus = 'processed' | 'rejected' | 'duplicate';

type ProcessActivityInput = {
  tenantId: number | string;
  gameId: number | string;
  userId: number | string;
  activityCode: ActivityCode | string;
  runVersion?: number | string | null;
  sourceType?: string | null;
  sourceId?: string | null;
  occurredAt?: string | Date | null;
  metadata?: Record<string, unknown> | null;
};

type ProcessActivityResult = {
  awarded: boolean;
  xpAwarded: number;
  phase: EventPhase | null;
  reason: string;
  reasonCode: string;
  eventId: number | null;
  ledgerId: number | null;
  totalXp: number | null;
  trialXp: number | null;
  officialXp: number | null;
  duplicate: boolean;
};

type HandlerOutput = {
  sourceType: string;
  sourceId: string;
  localDateKey: string | null;
  metadata: Record<string, unknown>;
};

class XpEngineError extends Error {
  status: number;
  code: string;
  retryable: boolean;

  constructor(status: number, code: string, message: string, retryable = false) {
    super(message);
    this.status = status;
    this.code = code;
    this.retryable = retryable;
  }
}

function engineError(status: number, code: string, message: string, retryable = false): never {
  throw new XpEngineError(status, code, message, retryable);
}

function toPositiveInt(value: unknown): number {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    engineError(400, 'invalid_integer', 'Expected a positive integer');
  }
  return parsed;
}

function toOptionalDate(value: unknown, fieldName: string): Date | null {
  if (value === null || value === undefined || value === '') return null;
  const nextDate = value instanceof Date ? value : new Date(String(value));
  if (Number.isNaN(nextDate.getTime())) {
    engineError(400, 'invalid_datetime', `${fieldName} is invalid`);
  }
  return nextDate;
}

function normalizeActivityCode(value: unknown): ActivityCode {
  const normalized = toText(value).toLowerCase();
  if (normalized === 'daily_active' || normalized === 'community_post' || normalized === 'community_comment') {
    return normalized;
  }
  engineError(400, 'unsupported_activity_code', `Unsupported activityCode: ${toText(value)}`);
}

function normalizeLimitPeriod(value: unknown): RuleLimitPeriod {
  const normalized = toText(value).toLowerCase();
  if (normalized === 'daily' || normalized === 'game') {
    return normalized;
  }
  engineError(500, 'invalid_rule_limit_period', 'Game rule has invalid limit period', true);
}

function formatLocalDateKey(date: Date, timeZone: string): string {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  const parts = formatter.formatToParts(date);
  const year = parts.find((item) => item.type === 'year')?.value || '0000';
  const month = parts.find((item) => item.type === 'month')?.value || '00';
  const day = parts.find((item) => item.type === 'day')?.value || '00';
  return `${year}-${month}-${day}`;
}

function stableHash(parts: Array<string | number>) {
  return createHash('sha256').update(parts.map((item) => String(item)).join('|')).digest('hex');
}

function coerceBoolean(value: unknown, fallback = false) {
  if (value === undefined || value === null) return fallback;
  return value === true || value === 'true' || value === 1 || value === '1';
}

function resolveOccurredAt(input: ProcessActivityInput) {
  const occurredAt = toOptionalDate(input.occurredAt, 'occurredAt') || new Date();
  const now = new Date();
  const metadata = input.metadata || {};
  const occurredAtTrusted = coerceBoolean(metadata.occurredAtTrusted, false);

  if (!occurredAtTrusted) {
    const ageMs = now.getTime() - occurredAt.getTime();
    if (ageMs > MAX_UNTRUSTED_EVENT_AGE_MS) {
      engineError(409, 'untrusted_historical_event', 'OccurredAt is too old for an untrusted event');
    }
    if (ageMs < -MAX_UNTRUSTED_FUTURE_SKEW_MS) {
      engineError(409, 'untrusted_future_event', 'OccurredAt is too far in the future');
    }
  }

  return occurredAt;
}

function determinePhase(game: any, occurredAt: Date): EventPhase | null {
  const adminStatus = toText(game?.admin_status ?? game?.adminStatus).toLowerCase();
  if (!['published', 'running'].includes(adminStatus)) {
    return null;
  }

  const trialStartAt = toOptionalDate(game?.trial_start_at ?? game?.trialStartAt, 'trialStartAt');
  const trialEndAt = toOptionalDate(game?.trial_end_at ?? game?.trialEndAt, 'trialEndAt');
  const startsAt = toOptionalDate(game?.starts_at ?? game?.startsAt, 'startsAt');
  const endsAt = toOptionalDate(game?.ends_at ?? game?.endsAt, 'endsAt');

  if (trialStartAt && trialEndAt && occurredAt.getTime() >= trialStartAt.getTime() && occurredAt.getTime() < trialEndAt.getTime()) {
    return 'trial';
  }

  if (startsAt && endsAt && occurredAt.getTime() >= startsAt.getTime() && occurredAt.getTime() <= endsAt.getTime()) {
    return 'official';
  }

  return null;
}

function evaluateLifecycleRejection(game: any, occurredAt: Date) {
  const adminStatus = toText(game?.admin_status ?? game?.adminStatus).toLowerCase();
  if (adminStatus === 'draft') {
    return { reasonCode: 'game_draft', reason: 'Game is still in draft' };
  }
  if (adminStatus === 'finalized') {
    return { reasonCode: 'game_finalized', reason: 'Game has been finalized' };
  }

  const trialStartAt = toOptionalDate(game?.trial_start_at ?? game?.trialStartAt, 'trialStartAt');
  const trialEndAt = toOptionalDate(game?.trial_end_at ?? game?.trialEndAt, 'trialEndAt');
  const startsAt = toOptionalDate(game?.starts_at ?? game?.startsAt, 'startsAt');
  const endsAt = toOptionalDate(game?.ends_at ?? game?.endsAt, 'endsAt');

  if (endsAt && occurredAt.getTime() > endsAt.getTime()) {
    return { reasonCode: 'game_ended', reason: 'Game has already ended' };
  }

  if (trialStartAt && occurredAt.getTime() < trialStartAt.getTime()) {
    return { reasonCode: 'trial_not_started', reason: 'Trial phase has not started yet' };
  }

  if (!trialStartAt && startsAt && occurredAt.getTime() < startsAt.getTime()) {
    return { reasonCode: 'official_not_started', reason: 'Official phase has not started yet' };
  }

  if (trialEndAt && startsAt && occurredAt.getTime() >= trialEndAt.getTime() && occurredAt.getTime() < startsAt.getTime()) {
    return { reasonCode: 'waiting_official', reason: 'Game is waiting for the official phase' };
  }

  return { reasonCode: 'game_not_active', reason: 'Game is not active for XP processing' };
}

async function ensureTenantMembership(userId: number, tenantId: number, trx: any) {
  const membership = await strapi.db.query(USER_TENANT_UID).findOne({
    where: {
      user: userId,
      tenant: tenantId,
      userTenantStatus: 'active',
    },
    select: ['id'],
    transacting: trx,
  } as any);

  if (!membership?.id) {
    engineError(403, 'tenant_membership_missing', 'User does not belong to this tenant');
  }
}

async function loadLockedGame(trx: any, tenantId: number, gameId: number) {
  const row = await trx('games')
    .select([
      'id',
      'tenant_id',
      'game_type_id',
      'admin_status',
      'current_run_version',
      'registration_open_at',
      'registration_close_at',
      'trial_start_at',
      'trial_end_at',
      'starts_at',
      'ends_at',
      'timezone',
    ])
    .where({ id: gameId, tenant_id: tenantId })
    .first()
    .forUpdate();

  if (!row?.id) {
    engineError(404, 'game_not_found', 'Game not found');
  }
  return row;
}

async function loadGameTypeCode(trx: any, gameTypeId: number) {
  const row = await trx('game_types').select(['id', 'code']).where({ id: gameTypeId }).first();
  if (!row?.id) {
    engineError(500, 'game_type_missing', 'Game type not found', true);
  }
  return toText(row.code).toLowerCase();
}

async function loadLockedParticipant(trx: any, params: { tenantId: number; gameId: number; userId: number; runVersion: number }) {
  const row = await trx('game_participants')
    .select(['id', 'status', 'run_version', 'registered_at', 'total_xp', 'trial_xp', 'official_xp', 'rank_score'])
    .where({
      tenant_id: params.tenantId,
      game_id: params.gameId,
      user_id: params.userId,
      run_version: params.runVersion,
    })
    .first()
    .forUpdate();

  if (!row?.id) {
    return null;
  }
  return row;
}

async function loadRule(trx: any, gameId: number, activityCode: ActivityCode) {
  const row = await trx('game_activity_rules')
    .select(['id', 'activity_code', 'is_enabled', 'xp_amount', 'max_count', 'limit_period', 'description'])
    .where({ game_id: gameId, activity_code: activityCode })
    .first();

  if (!row?.id) {
    return null;
  }
  return row;
}

function buildDailyActiveHandler(input: {
  userId: number;
  occurredAt: Date;
  timeZone: string;
  phase: EventPhase;
  metadata: Record<string, unknown>;
}): HandlerOutput {
  const localDateKey = formatLocalDateKey(input.occurredAt, input.timeZone);
  return {
    sourceType: 'daily_active',
    sourceId: `daily_active:${input.userId}:${input.phase}:${localDateKey}`,
    localDateKey,
    metadata: {
      localDateKey,
      eligibility: 'trusted-daily-active',
    },
  };
}

function buildCommunityHandler(activityCode: ActivityCode, input: {
  sourceType?: string | null;
  sourceId?: string | null;
  metadata: Record<string, unknown>;
}): HandlerOutput {
  const sourceId = toText(input.sourceId || input.metadata?.sourceId);
  if (!sourceId) {
    engineError(409, 'invalid_source', `${activityCode} requires a stable sourceId`);
  }
  if (input.metadata?.isEligible === false) {
    engineError(409, 'source_not_eligible', `${activityCode} source is not eligible for XP`);
  }
  return {
    sourceType: toText(input.sourceType) || activityCode,
    sourceId,
    localDateKey: null,
    metadata: {
      eligibility: input.metadata?.isEligible === true ? 'eligible' : 'trusted',
      ...(input.metadata || {}),
    },
  };
}

function resolveHandlerOutput(params: {
  activityCode: ActivityCode;
  userId: number;
  occurredAt: Date;
  timeZone: string;
  phase: EventPhase;
  sourceType?: string | null;
  sourceId?: string | null;
  metadata: Record<string, unknown>;
}): HandlerOutput {
  if (params.activityCode === 'daily_active') {
    return buildDailyActiveHandler({
      userId: params.userId,
      occurredAt: params.occurredAt,
      timeZone: params.timeZone,
      phase: params.phase,
      metadata: params.metadata,
    });
  }
  return buildCommunityHandler(params.activityCode, {
    sourceType: params.sourceType,
    sourceId: params.sourceId,
    metadata: params.metadata,
  });
}

function formatBusinessResult(input: Partial<ProcessActivityResult> & { reasonCode: string; reason: string }): ProcessActivityResult {
  return {
    awarded: false,
    xpAwarded: 0,
    phase: null,
    eventId: null,
    ledgerId: null,
    totalXp: null,
    trialXp: null,
    officialXp: null,
    duplicate: false,
    ...input,
  };
}

async function insertEvent(trx: any, params: {
  tenantId: number;
  gameId: number;
  userId: number;
  activityCode: ActivityCode;
  runVersion: number;
  phase: EventPhase;
  sourceType: string;
  sourceId: string;
  eventHash: string;
  localDateKey: string | null;
  occurredAt: Date;
  status: 'queued' | 'processed' | 'rejected' | 'failed';
  payload: Record<string, unknown>;
  errorMessage: string | null;
  attemptCount?: number;
  nextAttemptAt?: Date | null;
  lastErrorCode?: string | null;
}) {
  const [row] = await trx('game_events')
    .insert({
      tenant_id: params.tenantId,
      game_id: params.gameId,
      user_id: params.userId,
      activity_code: params.activityCode,
      run_version: params.runVersion,
      phase: params.phase,
      source_type: params.sourceType,
      source_id: params.sourceId,
      event_hash: params.eventHash,
      local_date_key: params.localDateKey,
      occurred_at: params.occurredAt,
      status: params.status,
      processed_at: params.status === 'processed' || params.status === 'rejected' ? new Date() : null,
      attempt_count: Number(params.attemptCount || 0),
      next_attempt_at: params.nextAttemptAt || null,
      last_error_code: params.lastErrorCode || null,
      payload: params.payload,
      error_message: params.errorMessage,
      created_at: new Date(),
      updated_at: new Date(),
    })
    .returning(['id']);

  return Number(row?.id || 0);
}

async function updateEventStatus(trx: any, params: {
  eventId: number;
  status: 'processed' | 'rejected' | 'failed';
  errorMessage?: string | null;
  payload?: Record<string, unknown>;
  lastErrorCode?: string | null;
  incrementAttempt?: boolean;
  nextAttemptAt?: Date | null;
}) {
  const current = await trx('game_events').select(['attempt_count']).where({ id: params.eventId }).first();
  await trx('game_events')
    .where({ id: params.eventId })
    .update({
      status: params.status,
      processed_at: params.status === 'processed' || params.status === 'rejected' ? new Date() : null,
      error_message: params.errorMessage ?? null,
      payload: params.payload ?? undefined,
      last_error_code: params.lastErrorCode || null,
      attempt_count: params.incrementAttempt ? Number(current?.attempt_count || 0) + 1 : Number(current?.attempt_count || 0),
      next_attempt_at: params.nextAttemptAt === undefined ? undefined : params.nextAttemptAt,
      updated_at: new Date(),
    });
}

async function insertLedger(trx: any, params: {
  tenantId: number;
  gameId: number;
  participantId: number;
  userId: number;
  activityCode: ActivityCode;
  runVersion: number;
  phase: EventPhase;
  sourceType: string;
  sourceId: string;
  localDateKey: string | null;
  xpAmount: number;
  balanceAfter: number;
  recordedAt: Date;
  reason: string;
  metadata: Record<string, unknown>;
  referenceEventId: number;
}) {
  const [row] = await trx('game_ledgers')
    .insert({
      tenant_id: params.tenantId,
      game_id: params.gameId,
      participant_id: params.participantId,
      user_id: params.userId,
      activity_code: params.activityCode,
      run_version: params.runVersion,
      phase: params.phase,
      source_type: params.sourceType,
      source_id: params.sourceId,
      local_date_key: params.localDateKey,
      entry_type: 'credit',
      xp_amount: params.xpAmount,
      balance_after: params.balanceAfter,
      reason: params.reason,
      metadata: params.metadata,
      recorded_at: params.recordedAt,
      reference_event_id: params.referenceEventId,
      created_at: new Date(),
      updated_at: new Date(),
    })
    .returning(['id']);

  return Number(row?.id || 0);
}

async function countAwardedEntries(trx: any, params: {
  gameId: number;
  runVersion: number;
  phase: EventPhase;
  userId: number;
  activityCode: ActivityCode;
  limitPeriod: RuleLimitPeriod;
  localDateKey: string | null;
}) {
  let query = trx('game_ledgers')
    .where({
      game_id: params.gameId,
      run_version: params.runVersion,
      phase: params.phase,
      user_id: params.userId,
      activity_code: params.activityCode,
      entry_type: 'credit',
    });

  if (params.limitPeriod === 'daily') {
    query = query.where({ local_date_key: params.localDateKey });
  }

  const row = await query.count({ total: '*' }).first();
  return Number(row?.total || 0);
}

async function findExistingEvent(trx: any, params: {
  gameId: number;
  runVersion: number;
  eventHash: string;
}) {
  return trx('game_events')
    .select(['id', 'status', 'error_message', 'payload', 'phase', 'attempt_count'])
    .where({
      game_id: params.gameId,
      run_version: params.runVersion,
      event_hash: params.eventHash,
    })
    .first();
}

async function findLedgerBySource(trx: any, params: {
  gameId: number;
  runVersion: number;
  activityCode: ActivityCode;
  sourceType: string;
  sourceId: string;
}) {
  return trx('game_ledgers')
    .select(['id', 'balance_after'])
    .where({
      game_id: params.gameId,
      run_version: params.runVersion,
      activity_code: params.activityCode,
      source_type: params.sourceType,
      source_id: params.sourceId,
    })
    .first();
}

function isUniqueViolation(error: any) {
  const code = toText(error?.code).toLowerCase();
  const message = toText(error?.message).toLowerCase();
  return code === '23505' || code === 'sqlite_constraint' || message.includes('unique');
}

export function getActivityHandlerRegistry() {
  return {
    daily_active: {
      code: 'daily_active',
      description: 'Stable daily activity keyed by user and local game date.',
    },
    community_post: {
      code: 'community_post',
      description: 'Trusted published community post event.',
    },
    community_comment: {
      code: 'community_comment',
      description: 'Trusted eligible community comment event.',
    },
  };
}

export async function processGameActivity(input: ProcessActivityInput): Promise<ProcessActivityResult> {
  const tenantId = toPositiveInt(input.tenantId);
  const gameId = toPositiveInt(input.gameId);
  const userId = toPositiveInt(input.userId);
  const activityCode = normalizeActivityCode(input.activityCode);
  const occurredAt = resolveOccurredAt(input);
  const metadata = (input.metadata || {}) as Record<string, unknown>;

  if (!tenantId || !gameId || !userId) {
    engineError(400, 'invalid_scope', 'tenantId, gameId and userId are required');
  }

  try {
    return await strapi.db.connection.transaction(async (trx: any) => {
      await ensureTenantMembership(userId, tenantId, trx);

      const game = await loadLockedGame(trx, tenantId, gameId);
      const gameTypeCode = await loadGameTypeCode(trx, Number(game.game_type_id || 0));
      if (gameTypeCode !== SUPPORTED_GAME_TYPE_CODE) {
        return formatBusinessResult({
          reasonCode: 'unsupported_game_type',
          reason: 'XP Engine currently supports xp_challenge only',
        });
      }

      const phase = determinePhase(game, occurredAt);
      if (!phase) {
        const rejected = evaluateLifecycleRejection(game, occurredAt);
        return formatBusinessResult(rejected);
      }

      const requestedRunVersion = metadata.internalTrusted === true && input.runVersion ? toPositiveInt(input.runVersion) : null;
      const currentRunVersion = Number(game.current_run_version || 1);
      const runVersion = requestedRunVersion || currentRunVersion;
      if (requestedRunVersion && requestedRunVersion !== currentRunVersion) {
        return formatBusinessResult({
          phase,
          reasonCode: 'stale_run_version',
          reason: 'Activity belongs to an outdated run version',
        });
      }
      const participant = await loadLockedParticipant(trx, {
        tenantId,
        gameId,
        userId,
        runVersion,
      });

      if (!participant?.id) {
        return formatBusinessResult({
          phase,
          reasonCode: 'participant_not_registered',
          reason: 'User is not registered for the current run version',
        });
      }

      if (participant.registered_at && occurredAt.getTime() < new Date(participant.registered_at).getTime()) {
        return formatBusinessResult({
          phase,
          reasonCode: 'occurred_before_registration',
          reason: 'OccurredAt is earlier than the participant registration time',
        });
      }

      const rule = await loadRule(trx, gameId, activityCode);
      if (!rule?.id) {
        return formatBusinessResult({
          phase,
          reasonCode: 'rule_missing',
          reason: 'No XP rule is configured for this activity',
        });
      }

      if (rule.is_enabled !== true) {
        return formatBusinessResult({
          phase,
          reasonCode: 'rule_disabled',
          reason: 'XP rule is disabled for this activity',
        });
      }

      const xpAmount = Number(rule.xp_amount || 0);
      if (!Number.isInteger(xpAmount) || xpAmount < 0) {
        engineError(500, 'invalid_rule_xp', 'XP rule is invalid', true);
      }

      const handlerOutput = resolveHandlerOutput({
        activityCode,
        userId,
        occurredAt,
        timeZone: toText(game.timezone) || 'Asia/Ho_Chi_Minh',
        phase,
        sourceType: input.sourceType,
        sourceId: input.sourceId,
        metadata,
      });

      const eventHash = stableHash([gameId, runVersion, activityCode, handlerOutput.sourceType, handlerOutput.sourceId]);
      const existingEvent = await findExistingEvent(trx, { gameId, runVersion, eventHash });
      if (existingEvent?.id) {
        if (['failed', 'queued'].includes(toText(existingEvent.status).toLowerCase())) {
          // continue and reuse this event row as the retry target
        } else {
        const existingLedger = await findLedgerBySource(trx, {
          gameId,
          runVersion,
          activityCode,
          sourceType: handlerOutput.sourceType,
          sourceId: handlerOutput.sourceId,
        });
        return {
          awarded: false,
          xpAwarded: 0,
          phase,
          reason: 'This event has already been processed',
          reasonCode: 'duplicate',
          eventId: Number(existingEvent.id || 0) || null,
          ledgerId: Number(existingLedger?.id || 0) || null,
          totalXp: Number(participant.total_xp ?? 0),
          trialXp: Number(participant.trial_xp ?? 0),
          officialXp: Number(participant.official_xp ?? 0),
          duplicate: true,
        };
        }
      }

      const limitPeriod = normalizeLimitPeriod(rule.limit_period);
      const localDateKey = limitPeriod === 'daily'
        ? (handlerOutput.localDateKey || formatLocalDateKey(occurredAt, toText(game.timezone) || 'Asia/Ho_Chi_Minh'))
        : null;
      const awardedCount = await countAwardedEntries(trx, {
        gameId,
        runVersion,
        phase,
        userId,
        activityCode,
        limitPeriod,
        localDateKey,
      });
      const maxCount = Number(rule.max_count || 0);
      const retryEventId = Number(existingEvent?.id || 0) || null;
      if (maxCount > 0 && awardedCount >= maxCount) {
        const rejectionPayload = {
          metadata: handlerOutput.metadata,
          rule: {
            id: Number(rule.id),
            xpAmount,
            maxCount,
            limitPeriod,
          },
        };
        let eventId = retryEventId || 0;
        if (retryEventId) {
          await updateEventStatus(trx, {
            eventId: retryEventId,
            status: 'rejected',
            errorMessage: 'Activity limit has been reached for the current scope',
            payload: rejectionPayload,
            lastErrorCode: 'limit_reached',
            incrementAttempt: true,
            nextAttemptAt: null,
          });
        } else {
          eventId = await insertEvent(trx, {
            tenantId,
            gameId,
            userId,
            activityCode,
            runVersion,
            phase,
            sourceType: handlerOutput.sourceType,
            sourceId: handlerOutput.sourceId,
            eventHash,
            localDateKey,
            occurredAt,
            status: 'rejected',
            payload: rejectionPayload,
            errorMessage: 'Activity limit has been reached for the current scope',
            lastErrorCode: 'limit_reached',
          });
        }

        return {
          awarded: false,
          xpAwarded: 0,
          phase,
          reason: 'Activity limit has been reached',
          reasonCode: 'limit_reached',
          eventId,
          ledgerId: null,
          totalXp: Number(participant.total_xp ?? 0),
          trialXp: Number(participant.trial_xp ?? 0),
          officialXp: Number(participant.official_xp ?? 0),
          duplicate: false,
        };
      }

      const currentTrialXp = Number(participant.trial_xp ?? 0);
      const currentOfficialXp = Number(participant.official_xp ?? 0);
      const nextTrialXp = phase === 'trial' ? currentTrialXp + xpAmount : currentTrialXp;
      const nextOfficialXp = phase === 'official' ? currentOfficialXp + xpAmount : currentOfficialXp;
      const nextTotalXp = nextTrialXp + nextOfficialXp;
      const nextRankScore = nextOfficialXp;

      let eventId = retryEventId || 0;
      let ledgerId = 0;
      try {
        const processedPayload = {
          metadata: handlerOutput.metadata,
          rule: {
            id: Number(rule.id),
            xpAmount,
            maxCount,
            limitPeriod,
          },
        };
        if (retryEventId) {
          await updateEventStatus(trx, {
            eventId: retryEventId,
            status: 'processed',
            errorMessage: null,
            payload: processedPayload,
            lastErrorCode: null,
            incrementAttempt: true,
            nextAttemptAt: null,
          });
        } else {
          eventId = await insertEvent(trx, {
            tenantId,
            gameId,
            userId,
            activityCode,
            runVersion,
            phase,
            sourceType: handlerOutput.sourceType,
            sourceId: handlerOutput.sourceId,
            eventHash,
            localDateKey,
            occurredAt,
            status: 'processed',
            payload: processedPayload,
            errorMessage: null,
            lastErrorCode: null,
          });
        }

        ledgerId = await insertLedger(trx, {
          tenantId,
          gameId,
          participantId: Number(participant.id),
          userId,
          activityCode,
          runVersion,
          phase,
          sourceType: handlerOutput.sourceType,
          sourceId: handlerOutput.sourceId,
          localDateKey,
          xpAmount,
          balanceAfter: phase === 'trial' ? nextTrialXp : nextOfficialXp,
          recordedAt: occurredAt,
          reason: `Awarded ${xpAmount} XP for ${activityCode}`,
          metadata: {
            ruleId: Number(rule.id),
            xpAmount,
            maxCount,
            limitPeriod,
            localDateKey,
          },
          referenceEventId: eventId,
        });
      } catch (error: any) {
        if (isUniqueViolation(error)) {
          const duplicateEvent = await findExistingEvent(trx, { gameId, runVersion, eventHash });
          const duplicateLedger = await findLedgerBySource(trx, {
            gameId,
            runVersion,
            activityCode,
            sourceType: handlerOutput.sourceType,
            sourceId: handlerOutput.sourceId,
          });
          return {
            awarded: false,
            xpAwarded: 0,
            phase,
            reason: 'This event has already been processed',
            reasonCode: 'duplicate',
            eventId: Number(duplicateEvent?.id || 0) || null,
            ledgerId: Number(duplicateLedger?.id || 0) || null,
            totalXp: Number(participant.total_xp ?? 0),
            trialXp: currentTrialXp,
            officialXp: currentOfficialXp,
            duplicate: true,
          };
        }
        throw error;
      }

      await trx('game_participants')
        .where({ id: Number(participant.id) })
        .update({
          total_xp: nextTotalXp,
          trial_xp: nextTrialXp,
          official_xp: nextOfficialXp,
          rank_score: nextRankScore,
          last_active_at: occurredAt,
          updated_at: new Date(),
        });

      return {
        awarded: true,
        xpAwarded: xpAmount,
        phase,
        reason: 'XP awarded successfully',
        reasonCode: 'awarded',
        eventId,
        ledgerId,
        totalXp: nextTotalXp,
        trialXp: nextTrialXp,
        officialXp: nextOfficialXp,
        duplicate: false,
      };
    });
  } catch (error: any) {
    if (error instanceof XpEngineError) {
      throw error;
    }
    strapi.log.error('[game.xp-engine] unexpected error', error);
    throw new XpEngineError(500, 'technical_error', 'Technical error while processing activity', true);
  }
}

function computeRetryAt(attemptCount: number) {
  const safeAttempt = Math.max(1, attemptCount);
  const delaySeconds = Math.min(300, 15 * safeAttempt);
  return new Date(Date.now() + delaySeconds * 1000);
}

async function recordFailedActivityEvent(params: {
  tenantId: number;
  gameId: number;
  userId: number;
  activityCode: ActivityCode;
  runVersion: number;
  phase: EventPhase;
  sourceType: string;
  sourceId: string;
  localDateKey: string | null;
  occurredAt: Date;
  payload: Record<string, unknown>;
  errorCode: string;
  errorMessage: string;
}) {
  const eventHash = stableHash([params.gameId, params.runVersion, params.activityCode, params.sourceType, params.sourceId]);
  const existing = await strapi.db.connection('game_events')
    .select(['id', 'attempt_count'])
    .where({
      game_id: params.gameId,
      run_version: params.runVersion,
      event_hash: eventHash,
    })
    .first();

  if (existing?.id) {
    const nextAttempts = Number(existing.attempt_count || 0) + 1;
    await strapi.db.connection('game_events')
      .where({ id: Number(existing.id) })
      .update({
        status: 'failed',
        error_message: params.errorMessage,
        last_error_code: params.errorCode,
        attempt_count: nextAttempts,
        next_attempt_at: computeRetryAt(nextAttempts),
        updated_at: new Date(),
      });
    return Number(existing.id);
  }

  const [row] = await strapi.db.connection('game_events')
    .insert({
      tenant_id: params.tenantId,
      game_id: params.gameId,
      user_id: params.userId,
      activity_code: params.activityCode,
      run_version: params.runVersion,
      phase: params.phase,
      source_type: params.sourceType,
      source_id: params.sourceId,
      event_hash: eventHash,
      local_date_key: params.localDateKey,
      occurred_at: params.occurredAt,
      status: 'failed',
      attempt_count: 1,
      next_attempt_at: computeRetryAt(1),
      last_error_code: params.errorCode,
      payload: params.payload,
      error_message: params.errorMessage,
      created_at: new Date(),
      updated_at: new Date(),
    })
    .returning(['id']);

  return Number(row?.id || 0);
}

async function loadDispatchableGames(tenantId: number, userId: number) {
  return strapi.db.connection('games as g')
    .innerJoin('game_participants as gp', function joinCurrentParticipant() {
      this.on('gp.game_id', '=', 'g.id')
        .andOn('gp.user_id', '=', strapi.db.connection.raw('?', [userId]))
        .andOn(strapi.db.connection.raw('COALESCE(gp.run_version, 1) = COALESCE(g.current_run_version, 1)'));
    })
    .select([
      'g.id',
      'g.game_type_id',
      'g.admin_status',
      'g.current_run_version',
      'g.trial_start_at',
      'g.trial_end_at',
      'g.starts_at',
      'g.ends_at',
      'g.timezone',
    ])
    .where({ 'g.tenant_id': tenantId })
    .whereIn('g.admin_status', ['published', 'running']);
}

export async function dispatchTrustedGameActivity(input: {
  tenantId: number | string;
  userId: number | string;
  activityCode: ActivityCode | string;
  sourceType?: string | null;
  sourceId?: string | null;
  occurredAt?: string | Date | null;
  metadata?: Record<string, unknown> | null;
}) {
  const tenantId = toPositiveInt(input.tenantId);
  const userId = toPositiveInt(input.userId);
  const activityCode = normalizeActivityCode(input.activityCode);
  const occurredAt = toOptionalDate(input.occurredAt, 'occurredAt') || new Date();
  const metadata = { ...(input.metadata || {}), occurredAtTrusted: true, internalTrusted: true } as Record<string, unknown>;
  const games = await loadDispatchableGames(tenantId, userId);
  const results = [];

  for (const game of games || []) {
    const gameTypeCode = await loadGameTypeCode(strapi.db.connection, Number(game.game_type_id || 0));
    if (gameTypeCode !== SUPPORTED_GAME_TYPE_CODE) continue;

    const phase = determinePhase(game, occurredAt);
    if (!phase) continue;

    const handlerOutput = resolveHandlerOutput({
      activityCode,
      userId,
      occurredAt,
      timeZone: toText(game.timezone) || 'Asia/Ho_Chi_Minh',
      phase,
      sourceType: input.sourceType,
      sourceId: input.sourceId,
      metadata,
    });

    try {
      const result = await processGameActivity({
        tenantId,
        gameId: Number(game.id),
        userId,
        runVersion: Number(game.current_run_version || 1),
        activityCode,
        sourceType: handlerOutput.sourceType,
        sourceId: handlerOutput.sourceId,
        occurredAt,
        metadata,
      });
      results.push({ gameId: Number(game.id), ...result });
    } catch (error: any) {
      const code = error instanceof XpEngineError ? error.code : 'technical_error';
      const message = error instanceof XpEngineError ? error.message : 'Technical error while processing activity';
      const eventId = await recordFailedActivityEvent({
        tenantId,
        gameId: Number(game.id),
        userId,
        activityCode,
        runVersion: Number(game.current_run_version || 1),
        phase,
        sourceType: handlerOutput.sourceType,
        sourceId: handlerOutput.sourceId,
        localDateKey: handlerOutput.localDateKey,
        occurredAt,
        payload: { metadata: handlerOutput.metadata },
        errorCode: code,
        errorMessage: message,
      });
      results.push({
        awarded: false,
        xpAwarded: 0,
        phase,
        reason: message,
        reasonCode: code,
        eventId,
        ledgerId: null,
        totalXp: null,
        trialXp: null,
        officialXp: null,
        duplicate: false,
        gameId: Number(game.id),
      });
    }
  }

  return results;
}

export async function processPendingGameEvents(limit = 25) {
  const rows = await strapi.db.connection.transaction(async (trx: any) => {
    return trx('game_events')
      .select([
        'id',
        'tenant_id',
        'game_id',
        'user_id',
        'activity_code',
        'run_version',
        'source_type',
        'source_id',
        'occurred_at',
        'payload',
      ])
      .where('status', 'failed')
      .andWhere((builder: any) => {
        builder.whereNull('next_attempt_at').orWhere('next_attempt_at', '<=', new Date());
      })
      .orderBy([{ column: 'updated_at', order: 'asc' }, { column: 'id', order: 'asc' }])
      .limit(limit);
  });

  const results = [];
  for (const row of rows || []) {
    try {
      const result = await processGameActivity({
        tenantId: Number(row.tenant_id),
        gameId: Number(row.game_id),
        userId: Number(row.user_id),
        runVersion: Number(row.run_version || 1),
        activityCode: toText(row.activity_code),
        sourceType: toText(row.source_type),
        sourceId: toText(row.source_id),
        occurredAt: row.occurred_at,
        metadata: {
          ...(row.payload?.metadata || row.payload || {}),
          occurredAtTrusted: true,
          internalTrusted: true,
        },
      });
      if (result.awarded === false && !result.duplicate) {
        await strapi.db.connection('game_events')
          .where({ id: Number(row.id) })
          .update({
            status: 'rejected',
            processed_at: new Date(),
            error_message: result.reason || 'Event rejected by lifecycle policy',
            last_error_code: result.reasonCode || 'rejected',
            next_attempt_at: null,
            updated_at: new Date(),
          });
      }
      results.push({ eventId: Number(row.id), ...result });
    } catch (error: any) {
      const attempts = await strapi.db.connection('game_events').select(['attempt_count']).where({ id: Number(row.id) }).first();
      await strapi.db.connection('game_events')
        .where({ id: Number(row.id) })
        .update({
          status: 'failed',
          error_message: error?.message || 'Technical error while retrying activity',
          last_error_code: error instanceof XpEngineError ? error.code : 'technical_error',
          attempt_count: Number(attempts?.attempt_count || 0) + 1,
          next_attempt_at: computeRetryAt(Number(attempts?.attempt_count || 0) + 1),
          updated_at: new Date(),
        });
      results.push({ eventId: Number(row.id), error: error?.message || 'retry_failed' });
    }
  }

  return results;
}

export { XpEngineError };
