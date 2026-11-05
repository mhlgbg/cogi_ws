import { randomInt, randomUUID } from 'crypto';
import { extractRelationRef, mergeTenantWhere, toText } from '../../../utils/tenant-scope';

const GAME_UID = 'api::game.game';
const GAME_TYPE_UID = 'api::game-type.game-type';
const TENANT_GAME_TYPE_UID = 'api::tenant-game-type.tenant-game-type';
const GAME_PARTICIPANT_UID = 'api::game-participant.game-participant';
const GAME_ACTIVITY_RULE_UID = 'api::game-activity-rule.game-activity-rule';
const GHOST_RACE_ATTEMPT_UID = 'api::ghost-race-attempt.ghost-race-attempt';
const GAME_EVENT_UID = 'api::game-event.game-event';
const GAME_LEDGER_UID = 'api::game-ledger.game-ledger';
const GAME_ADMIN_AUDIT_UID = 'api::game-admin-audit.game-admin-audit';
const GAME_RESET_CHALLENGE_UID = 'api::game-reset-challenge.game-reset-challenge';
const USER_TENANT_UID = 'api::user-tenant.user-tenant';
const USER_UID = 'plugin::users-permissions.user';
const TENANT_UID = 'api::tenant.tenant';

const RESET_CHALLENGE_TTL_MS = 5 * 60 * 1000;
const RESET_CHALLENGE_MAX_ATTEMPTS = 5;

const XP_CHALLENGE_GAME_TYPE_CODE = 'xp_challenge';
const GHOST_RACE_GAME_TYPE_CODE = 'ghost_race';
const SUPPORTED_GAME_TYPE_CODES = new Set([
  XP_CHALLENGE_GAME_TYPE_CODE,
  GHOST_RACE_GAME_TYPE_CODE,
]);
const GHOST_RACE_DEFAULT_SETTINGS = Object.freeze({
  distanceMeters: 200,
  cutoffSeconds: 120,
  playPlatform: 'desktop',
  physicsVersion: 'v1',
  trackVersion: 'v1',
  rulesVersion: 'v1',
  countdown: {
    onYourMarksMs: 900,
    setMs: 900,
    goHoldMs: 500,
  },
});
const GHOST_RACE_MIN_CUTOFF_SECONDS = 15;
const GHOST_RACE_MAX_CUTOFF_SECONDS = 600;
const GHOST_RACE_MIN_DISTANCE_METERS = 50;
const GHOST_RACE_MAX_DISTANCE_METERS = 2000;
const SUPPORTED_ACTIVITY_RULES = [
  {
    activityCode: 'daily_active',
    name: 'Daily Active',
    description: 'Điểm danh hoạt động mỗi ngày.',
    defaultXpAmount: 5,
    defaultMaxCount: 1,
    defaultLimitPeriod: 'daily',
  },
  {
    activityCode: 'community_post',
    name: 'Community Post',
    description: 'Bài viết community hợp lệ.',
    defaultXpAmount: 10,
    defaultMaxCount: 5,
    defaultLimitPeriod: 'daily',
  },
  {
    activityCode: 'community_comment',
    name: 'Community Comment',
    description: 'Bình luận community hợp lệ.',
    defaultXpAmount: 3,
    defaultMaxCount: 5,
    defaultLimitPeriod: 'daily',
  },
] as const;

type ActivityRuleDefinition = typeof SUPPORTED_ACTIVITY_RULES[number];
type RuleLimitPeriod = 'daily' | 'game';

class GameManagementError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

function httpError(status: number, message: string): never {
  throw new GameManagementError(status, message);
}

function toPositiveInt(value: unknown): number | null {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

function toBoolean(value: unknown): boolean {
  return value === true || value === 'true' || value === 1 || value === '1';
}

function toOptionalNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function toObjectOrNull(value: unknown): Record<string, any> | null {
  if (!value) return null;
  if (typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, any>;
  }
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return parsed as Record<string, any>;
      }
    } catch {
      return null;
    }
  }
  return null;
}

function toPositiveNumber(value: unknown, fieldName: string): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    httpError(400, `${fieldName} must be a positive number`);
  }
  return parsed;
}

function toOptionalDate(value: unknown, fieldName: string): Date | null {
  const raw = toText(value);
  if (!raw) return null;
  const nextDate = new Date(raw);
  if (Number.isNaN(nextDate.getTime())) {
    httpError(400, `${fieldName} is invalid`);
  }
  return nextDate;
}

function toRequiredDate(value: unknown, fieldName: string): Date {
  const nextDate = toOptionalDate(value, fieldName);
  if (!nextDate) {
    httpError(400, `${fieldName} is required`);
  }
  return nextDate;
}

function normalizeCode(value: unknown, fieldName: string): string {
  const text = toText(value);
  if (!text) {
    httpError(400, `${fieldName} is required`);
  }
  return text;
}

function normalizeGameTypeCode(value: unknown): string {
  return toText(value).toLowerCase();
}

function isGhostRaceGameType(value: unknown) {
  return normalizeGameTypeCode(value) === GHOST_RACE_GAME_TYPE_CODE;
}

function isXpChallengeGameType(value: unknown) {
  return normalizeGameTypeCode(value) === XP_CHALLENGE_GAME_TYPE_CODE;
}

function normalizeGhostRacePlayPlatform(value: unknown): 'desktop' | 'mobile' | 'web' {
  const normalized = toText(value).toLowerCase();
  if (normalized === 'mobile') return 'mobile';
  if (normalized === 'desktop') return 'desktop';
  if (normalized === 'web') return 'web';
  return 'desktop';
}

function resolveGhostRaceSettings(input: any, fallback?: any) {
  const base = {
    ...GHOST_RACE_DEFAULT_SETTINGS,
    ...(fallback && typeof fallback === 'object' ? fallback : {}),
    ...(input && typeof input === 'object' ? input : {}),
  } as any;

  const distanceMeters = toPositiveNumber(base.distanceMeters, 'settings.distanceMeters');
  if (distanceMeters < GHOST_RACE_MIN_DISTANCE_METERS || distanceMeters > GHOST_RACE_MAX_DISTANCE_METERS) {
    httpError(400, `settings.distanceMeters must be between ${GHOST_RACE_MIN_DISTANCE_METERS} and ${GHOST_RACE_MAX_DISTANCE_METERS}`);
  }

  const cutoffSeconds = toPositiveNumber(base.cutoffSeconds, 'settings.cutoffSeconds');
  if (cutoffSeconds < GHOST_RACE_MIN_CUTOFF_SECONDS || cutoffSeconds > GHOST_RACE_MAX_CUTOFF_SECONDS) {
    httpError(400, `settings.cutoffSeconds must be between ${GHOST_RACE_MIN_CUTOFF_SECONDS} and ${GHOST_RACE_MAX_CUTOFF_SECONDS}`);
  }

  return {
    distanceMeters,
    cutoffSeconds,
    playPlatform: normalizeGhostRacePlayPlatform(base.playPlatform),
    physicsVersion: toText(base.physicsVersion) || 'v1',
    trackVersion: toText(base.trackVersion) || 'v1',
    rulesVersion: toText(base.rulesVersion) || 'v1',
    countdown: {
      onYourMarksMs: Math.max(100, Math.round(toPositiveNumber(base?.countdown?.onYourMarksMs || 900, 'settings.countdown.onYourMarksMs'))),
      setMs: Math.max(100, Math.round(toPositiveNumber(base?.countdown?.setMs || 900, 'settings.countdown.setMs'))),
      goHoldMs: Math.max(100, Math.round(toPositiveNumber(base?.countdown?.goHoldMs || 500, 'settings.countdown.goHoldMs'))),
    },
  };
}

function extractRelationId(value: unknown): number | null {
  return toPositiveInt(extractRelationRef(value));
}

function getNow() {
  return new Date();
}

function requireNumericTenantId(tenantId: unknown): number {
  const numericTenantId = toPositiveInt(tenantId);
  if (!numericTenantId) {
    httpError(400, 'Tenant context is required');
  }
  return numericTenantId;
}

async function syncShadowValues(knexOrTrx: any, tableName: string, entityId: number, data: Record<string, unknown>) {
  const entries = Object.entries(data).filter(([, value]) => value !== undefined);
  if (!entityId || entries.length === 0) return;
  await knexOrTrx(tableName).where({ id: entityId }).update(Object.fromEntries(entries));
}

function getActivityRuleDefinition(activityCode: unknown): ActivityRuleDefinition {
  const normalized = toText(activityCode).toLowerCase();
  const definition = SUPPORTED_ACTIVITY_RULES.find((item) => item.activityCode === normalized);
  if (!definition) {
    httpError(400, `Unsupported activityCode: ${toText(activityCode)}`);
  }
  return definition;
}

function normalizeLimitPeriod(value: unknown): RuleLimitPeriod {
  const normalized = toText(value).toLowerCase();
  if (normalized === 'daily' || normalized === 'game') {
    return normalized;
  }
  httpError(400, 'limitPeriod must be either daily or game');
}

function ensureNonNegativeInteger(value: unknown, fieldName: string): number {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 0) {
    httpError(400, `${fieldName} must be a non-negative integer`);
  }
  return parsed;
}

function isUniqueConstraintError(error: any) {
  const code = toText(error?.code).toLowerCase();
  const message = toText(error?.message).toLowerCase();
  return (
    code === '23505'
    || code === 'sqlite_constraint'
    || code === 'sqlite_constraint_unique'
    || message.includes('unique constraint')
    || message.includes('duplicate key')
    || message.includes('must be unique')
  );
}

function getGameManagementErrorStatus(error: any, fallback = 400) {
  return Number(error?.status || error?.statusCode || fallback) || fallback;
}

type EffectiveGameState =
  | 'draft'
  | 'registration'
  | 'trial_upcoming'
  | 'trial_running'
  | 'official_pending'
  | 'official_running'
  | 'ended'
  | 'finalized';

type EffectivePhaseCode = 'none' | 'trial' | 'waiting_official' | 'official' | 'ended' | 'finalized';

function hasTrialWindow(game: any) {
  return Boolean(game?.trialStartAt && game?.trialEndAt);
}

function computeEffectivePhaseCode(game: any, now = getNow()): EffectivePhaseCode {
  const adminStatus = toText(game?.adminStatus).toLowerCase();
  if (adminStatus === 'draft') return 'none';
  if (adminStatus === 'finalized') return 'finalized';

  const startsAt = toOptionalDate(game?.startsAt, 'startsAt');
  const endsAt = toOptionalDate(game?.endsAt, 'endsAt');
  const trialStartAt = toOptionalDate(game?.trialStartAt, 'trialStartAt');
  const trialEndAt = toOptionalDate(game?.trialEndAt, 'trialEndAt');

  if (endsAt && now.getTime() > endsAt.getTime()) {
    return 'ended';
  }

  if (startsAt && now.getTime() >= startsAt.getTime()) {
    return 'official';
  }

  if (trialStartAt && trialEndAt) {
    if (now.getTime() >= trialStartAt.getTime() && now.getTime() < trialEndAt.getTime()) {
      return 'trial';
    }

    if (now.getTime() >= trialEndAt.getTime() && startsAt && now.getTime() < startsAt.getTime()) {
      return 'waiting_official';
    }
  }

  return 'none';
}

function computeEffectiveGameState(game: any, now = getNow()): EffectiveGameState {
  const adminStatus = toText(game?.adminStatus).toLowerCase();
  if (adminStatus === 'draft') return 'draft';
  if (adminStatus === 'finalized') return 'finalized';

  const startsAt = toOptionalDate(game?.startsAt, 'startsAt');
  const trialStartAt = toOptionalDate(game?.trialStartAt, 'trialStartAt');
  const trialEndAt = toOptionalDate(game?.trialEndAt, 'trialEndAt');
  const phaseCode = computeEffectivePhaseCode(game, now);

  if (phaseCode === 'ended') return 'ended';
  if (phaseCode === 'official') return 'official_running';
  if (phaseCode === 'waiting_official') return 'official_pending';
  if (phaseCode === 'trial') return 'trial_running';

  if (trialStartAt && trialEndAt) {
    return 'trial_upcoming';
  }

  if (startsAt) {
    return 'registration';
  }

  return 'registration';
}

async function syncGameStatusIfNeeded(game: any, trx?: any) {
  if (!game?.id) return game;

  const nextState = computeEffectiveGameState(game);
  const currentStatus = toText(game?.adminStatus).toLowerCase();
  let nextAdminStatus = currentStatus;

  if (nextState === 'official_running' && currentStatus === 'published') {
    nextAdminStatus = 'running';
  } else if (nextState === 'ended' && currentStatus !== 'ended' && currentStatus !== 'finalized' && currentStatus !== 'draft') {
    nextAdminStatus = 'ended';
  }

  if (!nextAdminStatus || nextAdminStatus === currentStatus) {
    return {
      ...game,
      adminStatus: currentStatus || game?.adminStatus,
      effectiveStatus: nextState,
    };
  }

  const updated = await strapi.db.query(GAME_UID).update({
    where: { id: Number(game.id) },
    data: { adminStatus: nextAdminStatus },
    ...(trx ? { transacting: trx } : {}),
  } as any);

  return {
    ...game,
    ...updated,
    adminStatus: nextAdminStatus,
    effectiveStatus: computeEffectiveGameState({ ...game, ...updated, adminStatus: nextAdminStatus }),
  };
}

async function requireAuthenticatedUser(ctx: any) {
  let authUser = ctx.state?.user;
  if (authUser?.id) return authUser;

  try {
    const authHeader = ctx.request?.headers?.authorization || ctx.request?.header?.authorization || '';
    const token = typeof authHeader === 'string' && authHeader.startsWith('Bearer ')
      ? authHeader.slice(7).trim()
      : '';
    if (!token) return null;

    const jwtService = strapi.plugin('users-permissions')?.service('jwt');
    const decoded = await jwtService?.verify(token);
    const userId = Number(decoded?.id || 0);
    if (!userId) return null;

    authUser = await strapi.db.query(USER_UID).findOne({
      where: { id: userId },
      select: ['id', 'username', 'email', 'fullName', 'blocked', 'confirmed'],
    });
    if (authUser?.id) {
      ctx.state.user = authUser;
    }
  } catch {
    return null;
  }

  if (!authUser?.id || authUser.blocked) return null;
  return authUser;
}

async function requireTenantMember(userId: unknown, tenantId: unknown, trx?: any) {
  const numericUserId = toPositiveInt(userId);
  const numericTenantId = toPositiveInt(tenantId);
  if (!numericUserId || !numericTenantId) {
    httpError(400, 'Tenant context is required');
  }

  const membership = await strapi.db.query(USER_TENANT_UID).findOne({
    where: {
      user: numericUserId,
      tenant: numericTenantId,
      userTenantStatus: 'active',
    },
    select: ['id', 'userTenantStatus'],
    ...(trx ? { transacting: trx } : {}),
  } as any);

  if (!membership?.id) {
    httpError(403, 'User does not belong to this tenant');
  }

  return membership;
}

async function findTenantOrThrow(tenantId: unknown) {
  const numericTenantId = toPositiveInt(tenantId);
  if (!numericTenantId) {
    httpError(400, 'Invalid tenant id');
  }

  const tenant = await strapi.db.query(TENANT_UID).findOne({
    where: { id: numericTenantId },
    select: ['id', 'name', 'code', 'tenantStatus', 'timezone'],
  });

  if (!tenant?.id) {
    httpError(404, 'Tenant not found');
  }

  return tenant;
}

async function findGameTypeByRef(ref: unknown, trx?: any) {
  const numericId = toPositiveInt(ref);
  const code = toText(ref).toLowerCase();
  const where = numericId
    ? { id: numericId }
    : code
      ? { code }
      : null;
  if (!where) {
    httpError(400, 'gameType is required');
  }

  const gameType = await strapi.db.query(GAME_TYPE_UID).findOne({
    where,
    select: ['id', 'code', 'name', 'description', 'status', 'isBuiltIn', 'defaultSettings'],
    ...(trx ? { transacting: trx } : {}),
  } as any);

  if (!gameType?.id) {
    httpError(404, 'Game type not found');
  }

  const normalizedCode = toText(gameType.code).toLowerCase();
  if (!SUPPORTED_GAME_TYPE_CODES.has(normalizedCode)) {
    httpError(400, 'Only xp_challenge and ghost_race game types are supported');
  }

  return gameType;
}

async function findTenantGameType(tenantId: unknown, gameTypeId: unknown, trx?: any) {
  const numericTenantId = toPositiveInt(tenantId);
  const numericGameTypeId = toPositiveInt(gameTypeId);
  if (!numericTenantId || !numericGameTypeId) {
    httpError(400, 'Invalid tenant game type reference');
  }

  return strapi.db.query(TENANT_GAME_TYPE_UID).findOne({
    where: {
      tenant: numericTenantId,
      gameType: numericGameTypeId,
    },
    select: ['id', 'isEnabled', 'enabledAt', 'settings'],
    populate: {
      gameType: {
        select: ['id', 'code', 'name', 'description', 'status', 'isBuiltIn'],
      },
      tenant: {
        select: ['id', 'name', 'code', 'tenantStatus', 'timezone'],
      },
    },
    ...(trx ? { transacting: trx } : {}),
  } as any);
}

async function ensureTenantGameTypeEnabled(tenantId: unknown, gameTypeId: unknown, trx?: any) {
  const tenantGameType = await findTenantGameType(tenantId, gameTypeId, trx);
  if (!tenantGameType?.id) {
    httpError(409, 'Game type has not been licensed for this tenant');
  }
  if (tenantGameType?.isEnabled !== true) {
    httpError(409, 'Game type is not enabled for this tenant');
  }
  return tenantGameType;
}

function validateGameSchedule(input: {
  registrationOpenAt: Date;
  registrationCloseAt: Date;
  trialStartAt: Date | null;
  trialEndAt: Date | null;
  startsAt: Date;
  endsAt: Date;
  lateRegistrationEnabled: boolean;
}) {
  if (input.registrationOpenAt.getTime() > input.registrationCloseAt.getTime()) {
    httpError(400, 'registrationOpenAt must be earlier than or equal to registrationCloseAt');
  }

  if (input.startsAt.getTime() >= input.endsAt.getTime()) {
    httpError(400, 'startsAt must be earlier than endsAt');
  }

  if (input.registrationOpenAt.getTime() > input.endsAt.getTime()) {
    httpError(400, 'registrationOpenAt must be before game end time');
  }

  if (!input.lateRegistrationEnabled && input.registrationCloseAt.getTime() > input.startsAt.getTime()) {
    httpError(400, 'registrationCloseAt must not be later than startsAt when late registration is disabled');
  }

  if (input.trialStartAt || input.trialEndAt) {
    if (!input.trialStartAt || !input.trialEndAt) {
      httpError(400, 'trialStartAt and trialEndAt must both be provided when trial is enabled');
    }

    if (input.trialStartAt.getTime() >= input.trialEndAt.getTime()) {
      httpError(400, 'trialStartAt must be earlier than trialEndAt');
    }

    if (input.trialEndAt.getTime() > input.startsAt.getTime()) {
      httpError(400, 'trialEndAt must be earlier than or equal to startsAt');
    }
  }
}

function getEffectivePhaseMeta(game: any, now = getNow()) {
  const effectiveStatus = computeEffectiveGameState(game, now);
  switch (effectiveStatus) {
    case 'trial_upcoming':
      return {
        code: 'trial_upcoming',
        label: 'Sắp chơi thử',
        isTrial: false,
        isOfficial: false,
        notice: 'Game có giai đoạn chơi thử trước khi bước vào cuộc thi chính thức.',
      };
    case 'trial_running':
      return {
        code: 'trial_running',
        label: 'Đang chơi thử',
        isTrial: true,
        isOfficial: false,
        notice: 'Đây là giai đoạn chơi thử. XP nhận được không tính vào bảng xếp hạng chính thức.',
      };
    case 'official_pending':
      return {
        code: 'official_pending',
        label: 'Chờ chơi chính thức',
        isTrial: false,
        isOfficial: false,
        notice: 'Giai đoạn chơi thử đã kết thúc. Official XP sẽ bắt đầu tính khi game chính thức khởi động.',
      };
    case 'official_running':
      return {
        code: 'official_running',
        label: 'Đang chơi chính thức',
        isTrial: false,
        isOfficial: true,
        notice: 'Bảng xếp hạng chính thức chỉ tính Official XP.',
      };
    case 'ended':
      return {
        code: 'ended',
        label: 'Đã kết thúc',
        isTrial: false,
        isOfficial: false,
        notice: null,
      };
    case 'finalized':
      return {
        code: 'finalized',
        label: 'Đã chốt',
        isTrial: false,
        isOfficial: false,
        notice: null,
      };
    case 'draft':
      return {
        code: 'draft',
        label: 'Bản nháp',
        isTrial: false,
        isOfficial: false,
        notice: null,
      };
    default:
      return {
        code: 'registration',
        label: 'Mở đăng ký',
        isTrial: false,
        isOfficial: false,
        notice: hasTrialWindow(game)
          ? 'Game đã công bố và đang trong giai đoạn chuẩn bị chơi thử.'
          : 'Game đã công bố và đang chờ bắt đầu giai đoạn chính thức.',
      };
  }
}

function buildDefaultRulePayloads() {
  return SUPPORTED_ACTIVITY_RULES.map((item) => ({
    activityCode: item.activityCode,
    activityName: item.name,
    description: item.description,
    isEnabled: true,
    xpAmount: item.defaultXpAmount,
    maxCount: item.defaultMaxCount,
    limitPeriod: item.defaultLimitPeriod,
  }));
}

function mapRuleTableRow(row: any) {
  return {
    id: toPositiveInt(row?.id) || 0,
    activityCode: toText(row?.activity_code ?? row?.activityCode).toLowerCase(),
    isEnabled: row?.is_enabled === true || row?.isEnabled === true,
    xpAmount: Number(row?.xp_amount ?? row?.xpAmount ?? 0),
    maxCount: Number(row?.max_count ?? row?.maxCount ?? 0),
    limitPeriod: toText(row?.limit_period ?? row?.limitPeriod).toLowerCase() || 'daily',
    description: toText(row?.description) || null,
    createdAt: row?.created_at || row?.createdAt || null,
    updatedAt: row?.updated_at || row?.updatedAt || null,
    gameId: toPositiveInt(row?.game_id ?? row?.gameId) || null,
  };
}

async function loadStoredRuleRowsForGame(gameId: number, trx?: any) {
  const rows = await (trx || strapi.db.connection)('game_activity_rules')
    .select(['id', 'activity_code', 'is_enabled', 'xp_amount', 'max_count', 'limit_period', 'description', 'created_at', 'updated_at', 'game_id'])
    .where({ game_id: gameId })
    .orderBy([{ column: 'activity_code', order: 'asc' }, { column: 'id', order: 'asc' }]);

  return (rows || []).map((row: any) => mapRuleTableRow(row));
}

function buildEffectiveRuleRows(storedRows: any[], gameTypeCode: string | null | undefined) {
  const normalizedGameTypeCode = toText(gameTypeCode).toLowerCase();
  if (!isXpChallengeGameType(normalizedGameTypeCode)) {
    return (storedRows || []).map((row) => formatRuleRow(row));
  }

  const storedByCode = new Map(
    (storedRows || [])
      .map((row: any) => [toText(row?.activityCode).toLowerCase(), row] as const)
      .filter(([code]) => Boolean(code)),
  );

  return buildDefaultRulePayloads().map((item) => {
    const stored = storedByCode.get(item.activityCode);
    return formatRuleRow({
      id: stored?.id || null,
      activityCode: item.activityCode,
      isEnabled: stored?.id ? stored.isEnabled : item.isEnabled,
      xpAmount: stored?.id ? stored.xpAmount : item.xpAmount,
      maxCount: stored?.id ? stored.maxCount : item.maxCount,
      limitPeriod: stored?.id ? stored.limitPeriod : item.limitPeriod,
      description: stored?.description || item.description,
      createdAt: stored?.createdAt || null,
      updatedAt: stored?.updatedAt || null,
    });
  });
}

function summarizeRuleRows(ruleRows: any[]) {
  return {
    total: ruleRows.length,
    enabled: ruleRows.filter((item) => item?.isEnabled === true).length,
  };
}

function formatRuleRow(row: any) {
  const definition = getActivityRuleDefinition(row?.activityCode);
  return {
    id: toPositiveInt(row?.id) || 0,
    activityCode: definition.activityCode,
    activityName: definition.name,
    description: toText(row?.description) || definition.description,
    isEnabled: row?.isEnabled === true,
    xpAmount: Number(row?.xpAmount ?? 0),
    maxCount: Number(row?.maxCount ?? 0),
    limitPeriod: normalizeLimitPeriod(row?.limitPeriod || definition.defaultLimitPeriod),
    defaults: {
      xpAmount: definition.defaultXpAmount,
      maxCount: definition.defaultMaxCount,
      limitPeriod: definition.defaultLimitPeriod,
    },
    createdAt: row?.createdAt || null,
    updatedAt: row?.updatedAt || null,
  };
}

async function ensureDefaultRulesForGame(gameId: number, trx?: any) {
  const existingRows = await loadStoredRuleRowsForGame(gameId, trx);
  const existingCodes = new Set(existingRows.map((item: any) => toText(item?.activityCode).toLowerCase()).filter(Boolean));

  for (const item of buildDefaultRulePayloads()) {
    if (existingCodes.has(item.activityCode)) continue;
    const created = await strapi.db.query(GAME_ACTIVITY_RULE_UID).create({
      data: {
        game: gameId,
        activityCode: item.activityCode,
        description: item.description,
        isEnabled: item.isEnabled,
        xpAmount: item.xpAmount,
        maxCount: item.maxCount,
        limitPeriod: item.limitPeriod,
      },
      ...(trx ? { transacting: trx } : {}),
    } as any);
    await syncShadowValues(trx || strapi.db.connection, 'game_activity_rules', Number(created.id), {
      game_id: gameId,
    });
  }

  return loadStoredRuleRowsForGame(gameId, trx);
}

async function countParticipantsByGameIds(gameIds: number[]) {
  if (!Array.isArray(gameIds) || gameIds.length === 0) {
    return new Map<number, { total: number; active: number }>();
  }

  const rows = await strapi.db.connection('game_participants as gp')
    .innerJoin('games as g', function joinCurrentRun() {
      this.on('g.id', '=', 'gp.game_id')
        .andOn(strapi.db.connection.raw('COALESCE(gp.run_version, 1) = COALESCE(g.current_run_version, 1)'));
    })
    .select('gp.game_id')
    .count({ total: '*' })
    .sum({
      active: strapi.db.connection.raw(`case when gp.status = 'active' then 1 else 0 end`),
    })
    .whereIn('gp.game_id', gameIds)
    .groupBy('gp.game_id');

  const result = new Map<number, { total: number; active: number }>();
  for (const row of rows || []) {
    const gameId = Number(row?.game_id || 0);
    if (!gameId) continue;
    result.set(gameId, {
      total: Number(row?.total || 0),
      active: Number(row?.active || 0),
    });
  }
  return result;
}

async function countCurrentRunGameData(gameId: number, runVersion: number) {
  const [participantRow, eventRow, ledgerRow, officialLedgerRow] = await Promise.all([
    strapi.db.connection('game_participants')
      .where({ game_id: gameId, run_version: runVersion })
      .count({ total: '*' })
      .first(),
    strapi.db.connection('game_events')
      .where({ game_id: gameId, run_version: runVersion })
      .count({ total: '*' })
      .first(),
    strapi.db.connection('game_ledgers')
      .where({ game_id: gameId, run_version: runVersion })
      .count({ total: '*' })
      .first(),
    strapi.db.connection('game_ledgers')
      .where({ game_id: gameId, run_version: runVersion, phase: 'official', entry_type: 'credit' })
      .count({ total: '*' })
      .first(),
  ]);

  return {
    participantCount: Number(participantRow?.total || 0),
    eventCount: Number(eventRow?.total || 0),
    ledgerCount: Number(ledgerRow?.total || 0),
    officialLedgerCount: Number(officialLedgerRow?.total || 0),
  };
}

async function countHistoricalGameData(gameId: number) {
  const [participantRow, eventRow, ledgerRow] = await Promise.all([
    strapi.db.connection('game_participants')
      .where({ game_id: gameId })
      .count({ total: '*' })
      .first(),
    strapi.db.connection('game_events')
      .where({ game_id: gameId })
      .count({ total: '*' })
      .first(),
    strapi.db.connection('game_ledgers')
      .where({ game_id: gameId })
      .count({ total: '*' })
      .first(),
  ]);

  return {
    participantCount: Number(participantRow?.total || 0),
    eventCount: Number(eventRow?.total || 0),
    ledgerCount: Number(ledgerRow?.total || 0),
  };
}

async function countGhostRaceAttemptsByGame(gameId: number) {
  if (!(await strapi.db.connection.schema.hasTable('ghost_race_attempts'))) {
    return 0;
  }
  const row = await strapi.db.connection('ghost_race_attempts as gra')
    .leftJoin('ghost_race_attempts_game_lnk as grag', 'grag.ghost_race_attempt_id', 'gra.id')
    .whereRaw('COALESCE(gra.game_id, grag.game_id) = ?', [gameId])
    .count({ total: '*' })
    .first();
  return Number(row?.total || 0);
}

async function reserveNextGhostRaceLane(trx: any, gameId: number, runVersion: number, preferredLane?: number | null) {
  const client = String(trx?.client?.config?.client || '').toLowerCase();
  if (client.includes('pg')) {
    const lockKey = Number(gameId) * 100000 + Number(runVersion);
    await trx.raw('select pg_advisory_xact_lock(?)', [lockKey]);
  }

  const isPostgres = String(trx?.client?.config?.client || '').toLowerCase().includes('pg');
  const query = trx('game_participants')
    .where({ game_id: gameId, run_version: runVersion })
    .select('settings');
  if (isPostgres) {
    query.forUpdate();
  }
  const rows = await query;
  const usedLanes = new Set<number>();
  let maxLane = 0;
  for (const row of rows || []) {
    const settings = toObjectOrNull(row?.settings);
    const lane = toPositiveInt(settings?.laneNumber) || 0;
    if (lane > 0) {
      usedLanes.add(lane);
      if (lane > maxLane) maxLane = lane;
    }
  }
  const preferred = toPositiveInt(preferredLane || null);
  if (preferred && !usedLanes.has(preferred)) {
    return preferred;
  }
  return maxLane + 1;
}

async function loadStableLaneNumberForUser(gameId: number, userId: number, trx?: any) {
  const rows = await (trx || strapi.db.connection)('game_participants')
    .select(['settings', 'run_version'])
    .where({ game_id: gameId, user_id: userId })
    .orderBy([{ column: 'run_version', order: 'desc' }, { column: 'id', order: 'desc' }]);

  for (const row of rows || []) {
    const settings = toObjectOrNull(row?.settings);
    const lane = toPositiveInt(settings?.laneNumber);
    if (lane) return lane;
  }

  return null;
}

function validateGhostRacePublishSettings(game: any) {
  const gameTypeCode = toText(game?.gameType?.code).toLowerCase();
  if (!isGhostRaceGameType(gameTypeCode)) return;

  const raw = game?.settings && typeof game.settings === 'object' ? game.settings : null;
  if (!raw) {
    httpError(409, 'Ghost Race settings are required before publishing');
  }
  const settings = resolveGhostRaceSettings(raw, raw);
  if (!toText(raw?.playPlatform)) {
    httpError(409, 'Ghost Race setting playPlatform is required before publishing');
  }
  if (!Number.isFinite(Number(raw?.distanceMeters)) || Number(raw?.distanceMeters) <= 0) {
    httpError(409, 'Ghost Race setting distanceMeters must be greater than 0');
  }
  if (!Number.isFinite(Number(raw?.cutoffSeconds)) || Number(raw?.cutoffSeconds) <= 0) {
    httpError(409, 'Ghost Race setting cutoffSeconds must be greater than 0');
  }
  if (!toText(raw?.physicsVersion)) {
    httpError(409, 'Ghost Race setting physicsVersion is required');
  }
  if (!toText(raw?.rulesVersion)) {
    httpError(409, 'Ghost Race setting rulesVersion is required');
  }
  if (!toText(raw?.trackVersion)) {
    httpError(409, 'Ghost Race setting trackVersion is required');
  }
  if (!raw?.countdown || Number(raw?.countdown?.onYourMarksMs) <= 0 || Number(raw?.countdown?.setMs) <= 0 || Number(raw?.countdown?.goHoldMs) <= 0) {
    httpError(409, 'Ghost Race countdown configuration is invalid');
  }
}

async function countRulesByGameIds(gameIds: number[]) {
  if (!Array.isArray(gameIds) || gameIds.length === 0) {
    return new Map<number, { total: number; enabled: number }>();
  }

  const rows = await strapi.db.connection('game_activity_rules')
    .select('game_id')
    .count({ total: '*' })
    .sum({
      enabled: strapi.db.connection.raw(`case when is_enabled = true then 1 else 0 end`),
    })
    .whereIn('game_id', gameIds)
    .groupBy('game_id');

  const result = new Map<number, { total: number; enabled: number }>();
  for (const row of rows || []) {
    const gameId = Number(row?.game_id || 0);
    if (!gameId) continue;
    result.set(gameId, {
      total: Number(row?.total || 0),
      enabled: Number(row?.enabled || 0),
    });
  }
  return result;
}

function mapCurrentParticipantQueryRow(row: any) {
  const settings = toObjectOrNull(row?.settings);
  return {
    id: toPositiveInt(row?.id) || 0,
    status: toText(row?.status).toLowerCase() || 'active',
    runVersion: Number(row?.run_version || 1),
    registeredAt: row?.registered_at || null,
    lastActiveAt: row?.last_active_at || null,
    totalXp: Number(row?.total_xp ?? 0),
    trialXp: Number(row?.trial_xp ?? 0),
    officialXp: Number(row?.official_xp ?? 0),
    rankScore: Number(row?.rank_score ?? 0),
    laneNumber: toPositiveInt(settings?.laneNumber) || null,
    settings,
    user: {
      id: toPositiveInt(row?.user_id) || 0,
      username: toText(row?.username) || null,
      email: toText(row?.email) || null,
      fullName: toText(row?.full_name) || null,
    },
  };
}

async function loadCurrentParticipantRowsForGame(gameId: number, runVersion: number) {
  const rows = await strapi.db.connection('game_participants as gp')
    .leftJoin('up_users as u', 'u.id', 'gp.user_id')
    .select([
      'gp.id',
      'gp.status',
      'gp.run_version',
      'gp.registered_at',
      'gp.last_active_at',
      'gp.total_xp',
      'gp.trial_xp',
      'gp.official_xp',
      'gp.rank_score',
      'gp.settings',
      'u.id as user_id',
      'u.username',
      'u.email',
      'u.full_name',
    ])
    .where({
      'gp.game_id': gameId,
      'gp.run_version': runVersion,
    })
    .orderBy([{ column: 'gp.registered_at', order: 'asc' }, { column: 'gp.id', order: 'asc' }]);

  return (rows || []).map((row: any) => mapCurrentParticipantQueryRow(row));
}

async function loadCurrentUserParticipantsByGameIds(userId: number, tenantId: number, gameIds: number[]) {
  if (!gameIds.length) return new Map<number, any>();

  const rows = await strapi.db.connection('game_participants as gp')
    .innerJoin('games as g', function joinCurrentRun() {
      this.on('g.id', '=', 'gp.game_id')
        .andOn(strapi.db.connection.raw('COALESCE(gp.run_version, 1) = COALESCE(g.current_run_version, 1)'));
    })
    .leftJoin('up_users as u', 'u.id', 'gp.user_id')
    .select([
      'gp.id',
      'gp.game_id',
      'gp.status',
      'gp.run_version',
      'gp.registered_at',
      'gp.last_active_at',
      'gp.total_xp',
      'gp.trial_xp',
      'gp.official_xp',
      'gp.rank_score',
      'gp.settings',
      'u.id as user_id',
      'u.username',
      'u.email',
      'u.full_name',
    ])
    .where({
      'gp.user_id': userId,
      'gp.tenant_id': tenantId,
    })
    .whereIn('gp.game_id', gameIds);

  const map = new Map<number, any>();
  for (const row of rows || []) {
    const gameId = Number(row?.game_id || 0);
    if (!gameId) continue;
    map.set(gameId, mapCurrentParticipantQueryRow(row));
  }
  return map;
}

function resolveActiveXpPhaseCode(game: any): 'trial' | 'official' | null {
  if (game?.effectivePhase?.isTrial === true) return 'trial';
  if (game?.effectivePhase?.isOfficial === true) return 'official';
  return null;
}

async function loadParticipantLeaderboardRows(gameId: number, runVersion: number) {
  const rows = await strapi.db.connection('game_participants as gp')
    .leftJoin('up_users as u', 'u.id', 'gp.user_id')
    .select([
      'gp.id',
      'gp.user_id',
      'gp.registered_at',
      'gp.total_xp',
      'gp.trial_xp',
      'gp.official_xp',
      'gp.rank_score',
      'u.username',
      'u.email',
      'u.full_name',
    ])
    .where({
      'gp.game_id': gameId,
      'gp.run_version': runVersion,
    });

  return (rows || []).map((row: any) => ({
    participantId: Number(row?.id || 0),
    userId: Number(row?.user_id || 0),
    registeredAt: row?.registered_at || null,
    totalXp: Number(row?.total_xp || 0),
    trialXp: Number(row?.trial_xp || 0),
    officialXp: Number(row?.official_xp || 0),
    rankScore: Number(row?.rank_score || 0),
    username: toText(row?.username) || null,
    email: toText(row?.email) || null,
    fullName: toText(row?.full_name) || null,
  }));
}

function buildRankedLeaderboard(rows: any[], phase: 'trial' | 'official') {
  const sorted = [...rows].sort((left, right) => {
    const leftScore = phase === 'trial' ? Number(left.trialXp || 0) : Number(left.officialXp || 0);
    const rightScore = phase === 'trial' ? Number(right.trialXp || 0) : Number(right.officialXp || 0);
    if (rightScore !== leftScore) return rightScore - leftScore;
    const leftRegistered = left.registeredAt ? new Date(left.registeredAt).getTime() : 0;
    const rightRegistered = right.registeredAt ? new Date(right.registeredAt).getTime() : 0;
    if (leftRegistered !== rightRegistered) return leftRegistered - rightRegistered;
    return Number(left.participantId || 0) - Number(right.participantId || 0);
  });

  return sorted.map((row, index) => ({
    rank: index + 1,
    participantId: row.participantId,
    userId: row.userId,
    username: row.username,
    email: row.email,
    fullName: row.fullName,
    totalXp: row.totalXp,
    trialXp: row.trialXp,
    officialXp: row.officialXp,
    rankScore: phase === 'trial' ? row.trialXp : row.officialXp,
    registeredAt: row.registeredAt,
  }));
}

async function loadGameLeaderboards(gameId: number, runVersion: number) {
  const participantRows = await loadParticipantLeaderboardRows(gameId, runVersion);
  const officialAll = buildRankedLeaderboard(participantRows, 'official');
  const trialAll = buildRankedLeaderboard(participantRows, 'trial');
  return {
    officialTop10: officialAll.slice(0, 10),
    officialAll,
    trialTop10: trialAll.slice(0, 10),
    trialAll,
  };
}

async function loadParticipantHistory(gameId: number, runVersion: number, userId: number, limit = 20) {
  const rows = await strapi.db.connection('game_ledgers')
    .select(['id', 'activity_code', 'phase', 'xp_amount', 'balance_after', 'reason', 'recorded_at', 'source_type', 'source_id', 'local_date_key', 'metadata'])
    .where({
      game_id: gameId,
      run_version: runVersion,
      user_id: userId,
    })
    .orderBy([{ column: 'recorded_at', order: 'desc' }, { column: 'id', order: 'desc' }])
    .limit(limit);

  return (rows || []).map((row: any) => ({
    id: Number(row?.id || 0),
    activityCode: toText(row?.activity_code),
    phase: toText(row?.phase) || null,
    xpAmount: Number(row?.xp_amount || 0),
    balanceAfter: Number(row?.balance_after || 0),
    reason: toText(row?.reason) || null,
    recordedAt: row?.recorded_at || null,
    sourceType: toText(row?.source_type) || null,
    sourceId: toText(row?.source_id) || null,
    localDateKey: toText(row?.local_date_key) || null,
    metadata: row?.metadata || null,
  }));
}

async function loadRuleProgressSummary(game: any, runVersion: number, userId: number, rules: any[]) {
  const phase = resolveActiveXpPhaseCode(game);
  const timezone = toText(game?.timezone) || 'Asia/Ho_Chi_Minh';
  const todayKey = formatLocalDateTimeKey(new Date(), timezone);
  const rows = [];

  for (const rule of rules || []) {
    const limitPeriod = String(rule?.limitPeriod || 'daily').toLowerCase();
    let query = strapi.db.connection('game_ledgers')
      .where({
        game_id: Number(game.id),
        run_version: Number(runVersion),
        user_id: Number(userId),
        activity_code: String(rule.activityCode),
        entry_type: 'credit',
      });

    if (phase) {
      query = query.where({ phase });
    }

    if (limitPeriod === 'daily') {
      query = query.where({ local_date_key: todayKey });
    }

    const countRow = await query.count({ total: '*' }).first();
    const earnedCount = Number(countRow?.total || 0);
    const maxCount = Number(rule?.maxCount || 0);
    rows.push({
      activityCode: rule.activityCode,
      activityName: rule.activityName,
      limitPeriod,
      xpAmount: Number(rule?.xpAmount || 0),
      maxCount,
      earnedCount,
      remainingCount: maxCount > 0 ? Math.max(0, maxCount - earnedCount) : null,
      phase,
      localDateKey: limitPeriod === 'daily' ? todayKey : null,
    });
  }

  return rows;
}

function formatLocalDateTimeKey(date: Date, timeZone: string): string {
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

async function loadAdminXpSummary(gameId: number, runVersion: number) {
  const [activityRows, phaseRows, eventRows, ledgerRows] = await Promise.all([
    strapi.db.connection('game_ledgers')
      .select(['activity_code', 'phase'])
      .sum({ totalXp: 'xp_amount' })
      .count({ awardCount: '*' })
      .where({ game_id: gameId, run_version: runVersion, entry_type: 'credit' })
      .groupBy(['activity_code', 'phase']),
    strapi.db.connection('game_ledgers')
      .select(['phase'])
      .sum({ totalXp: 'xp_amount' })
      .count({ awardCount: '*' })
      .where({ game_id: gameId, run_version: runVersion, entry_type: 'credit' })
      .groupBy(['phase']),
    strapi.db.connection('game_events')
      .select(['status'])
      .count({ total: '*' })
      .where({ game_id: gameId, run_version: runVersion })
      .groupBy(['status']),
    strapi.db.connection('game_ledgers')
      .select(['id', 'activity_code', 'phase', 'xp_amount', 'recorded_at', 'user_id', 'source_type', 'source_id'])
      .where({ game_id: gameId, run_version: runVersion })
      .orderBy([{ column: 'recorded_at', order: 'desc' }, { column: 'id', order: 'desc' }])
      .limit(20),
  ]);

  return {
    byActivity: (activityRows || []).map((row: any) => ({
      activityCode: toText(row?.activity_code),
      phase: toText(row?.phase),
      totalXp: Number(row?.totalXp || 0),
      awardCount: Number(row?.awardCount || 0),
    })),
    byPhase: (phaseRows || []).map((row: any) => ({
      phase: toText(row?.phase),
      totalXp: Number(row?.totalXp || 0),
      awardCount: Number(row?.awardCount || 0),
    })),
    eventStatus: (eventRows || []).map((row: any) => ({
      status: toText(row?.status),
      total: Number(row?.total || 0),
    })),
    recentLedgers: (ledgerRows || []).map((row: any) => ({
      id: Number(row?.id || 0),
      activityCode: toText(row?.activity_code),
      phase: toText(row?.phase),
      xpAmount: Number(row?.xp_amount || 0),
      recordedAt: row?.recorded_at || null,
      userId: Number(row?.user_id || 0),
      sourceType: toText(row?.source_type) || null,
      sourceId: toText(row?.source_id) || null,
    })),
  };
}

async function loadRecentGameEvents(gameId: number, runVersion: number, limit = 20) {
  const rows = await strapi.db.connection('game_events')
    .select(['id', 'activity_code', 'phase', 'status', 'occurred_at', 'processed_at', 'error_message', 'last_error_code', 'user_id', 'source_type', 'source_id', 'attempt_count'])
    .where({ game_id: gameId, run_version: runVersion })
    .orderBy([{ column: 'updated_at', order: 'desc' }, { column: 'id', order: 'desc' }])
    .limit(limit);

  return (rows || []).map((row: any) => ({
    id: Number(row?.id || 0),
    activityCode: toText(row?.activity_code),
    phase: toText(row?.phase),
    status: toText(row?.status),
    occurredAt: row?.occurred_at || null,
    processedAt: row?.processed_at || null,
    errorMessage: toText(row?.error_message) || null,
    lastErrorCode: toText(row?.last_error_code) || null,
    userId: Number(row?.user_id || 0),
    sourceType: toText(row?.source_type) || null,
    sourceId: toText(row?.source_id) || null,
    attemptCount: Number(row?.attempt_count || 0),
  }));
}

function buildRegistrationState(game: any, tenantGameTypeEnabled: boolean, currentParticipant: any, now = getNow()) {
  if (currentParticipant?.id) {
    return {
      state: 'registered',
      canRegister: false,
      reason: 'Bạn đã đăng ký tham gia game này.',
    };
  }

  if (!tenantGameTypeEnabled) {
    return {
      state: 'unavailable',
      canRegister: false,
      reason: 'Game type hiện không khả dụng cho tenant.',
    };
  }

  const effectiveStatus = computeEffectiveGameState(game, now);
  if (effectiveStatus === 'draft') {
    return {
      state: 'draft',
      canRegister: false,
      reason: 'Game chưa được công bố.',
    };
  }

  if (effectiveStatus === 'ended' || effectiveStatus === 'finalized') {
    return {
      state: 'closed',
      canRegister: false,
      reason: 'Game đã kết thúc.',
    };
  }

  const registrationOpenAt = toRequiredDate(game?.registrationOpenAt, 'registrationOpenAt');
  const registrationCloseAt = toRequiredDate(game?.registrationCloseAt, 'registrationCloseAt');
  const startsAt = toRequiredDate(game?.startsAt, 'startsAt');
  const endsAt = toRequiredDate(game?.endsAt, 'endsAt');
  const lateRegistrationEnabled = game?.lateRegistrationEnabled === true;

  if (now.getTime() < registrationOpenAt.getTime()) {
    return {
      state: 'not_open',
      canRegister: false,
      reason: 'Chưa đến thời gian mở đăng ký.',
    };
  }

  if (now.getTime() <= registrationCloseAt.getTime()) {
    return {
      state: now.getTime() >= startsAt.getTime() ? 'late_open' : 'open',
      canRegister: true,
      reason: null,
    };
  }

  if (lateRegistrationEnabled && now.getTime() >= startsAt.getTime() && now.getTime() <= endsAt.getTime()) {
    return {
      state: 'late_open',
      canRegister: true,
      reason: null,
    };
  }

  return {
    state: 'closed',
    canRegister: false,
    reason: 'Đã hết thời gian đăng ký.',
  };
}

async function writeGameAdminAudit(input: {
  tenantId: number;
  gameId: number;
  actorId: number;
  actionType: 'unpublish' | 'reset';
  reason?: string | null;
  oldRunVersion?: number | null;
  newRunVersion?: number | null;
  metadata?: Record<string, unknown> | null;
  trx?: any;
}) {
  const knexOrTrx = input.trx || strapi.db.connection;
  await knexOrTrx('game_admin_audits').insert({
    tenant_id: input.tenantId,
    game_id: input.gameId,
    actor_id: input.actorId,
    action_type: input.actionType,
    reason: toText(input.reason) || null,
    old_run_version: input.oldRunVersion || null,
    new_run_version: input.newRunVersion || null,
    metadata: input.metadata || null,
    created_at: getNow(),
    updated_at: getNow(),
  });
}

function buildAdminActionAvailability(game: any, counts: {
  participantCount: number;
  eventCount: number;
  ledgerCount: number;
  currentParticipantCount: number;
  currentEventCount: number;
  currentLedgerCount: number;
  currentOfficialLedgerCount?: number;
}) {
  const adminStatus = toText(game?.adminStatus).toLowerCase();
  const currentRunVersion = Number(game?.currentRunVersion || 1);
  const hasCurrentProgress = counts.currentEventCount > 0 || counts.currentLedgerCount > 0 || counts.currentParticipantCount > 0;
  const hasCurrentScoringData = counts.currentEventCount > 0 || counts.currentLedgerCount > 0;
  const startsAt = toOptionalDate(game?.startsAt, 'startsAt');
  const now = getNow();
  const officialPhaseStarted = Boolean(startsAt && now.getTime() >= startsAt.getTime());
  const currentOfficialLedgerCount = Number(counts.currentOfficialLedgerCount || 0);

  let unpublishAvailable = false;
  let unpublishReason: string | null = null;
  let unpublishWarning: string | null = null;

  if (adminStatus === 'finalized') {
    unpublishReason = 'Game đã finalized nên không thể rút lại công bố.';
  } else if (adminStatus === 'draft') {
    unpublishReason = 'Game đang ở trạng thái draft.';
  } else if (!['published', 'running'].includes(adminStatus)) {
    unpublishReason = 'Game chưa ở trạng thái công bố hợp lệ để rút lại.';
  } else if (officialPhaseStarted) {
    unpublishReason = 'Đã đến thời điểm bắt đầu Official nên không thể rút lại công bố.';
  } else if (currentOfficialLedgerCount > 0) {
    unpublishReason = 'Phiên hiện tại đã có Official XP nên không thể rút lại công bố.';
  } else {
    unpublishAvailable = true;
    if (counts.participantCount > 0 || counts.eventCount > 0 || counts.ledgerCount > 0) {
      unpublishWarning = 'Game sẽ quay về draft, ngừng đăng ký/ghi XP mới nhưng vẫn giữ nguyên participants, events và ledgers hiện có.';
    }
  }

  let resetAvailable = false;
  let resetReason: string | null = null;
  if (adminStatus === 'finalized') {
    resetReason = 'Game đã finalized nên không thể reset.';
  } else if (officialPhaseStarted) {
    resetReason = 'Đã đến thời điểm bắt đầu Official nên không thể reset.';
  } else if (adminStatus !== 'draft') {
    resetReason = 'Chỉ có thể reset sau khi game đã được rút công bố về draft.';
  } else if (!hasCurrentProgress) {
    resetReason = 'Phiên chơi hiện tại chưa có participant, event hoặc ledger để reset.';
  } else {
    resetAvailable = true;
  }

  let rulesAvailable = false;
  let rulesReason: string | null = null;
  if (adminStatus === 'finalized') {
    rulesReason = 'Game đã finalized nên không thể chỉnh sửa XP rules.';
  } else if (officialPhaseStarted) {
    rulesReason = 'Đã đến thời điểm bắt đầu Official nên không thể chỉnh sửa XP rules.';
  } else if (adminStatus !== 'draft') {
    rulesReason = 'Hãy rút công bố game về draft trước khi chỉnh sửa XP rules.';
  } else if (hasCurrentScoringData) {
    rulesReason = 'Phiên hiện tại đã có dữ liệu Trial/Event/Ledger, cần reset phiên trước khi chỉnh sửa XP rules.';
  } else {
    rulesAvailable = true;
  }

  return {
    currentRunVersion,
    unpublish: {
      available: unpublishAvailable,
      reason: unpublishReason,
      warning: unpublishWarning,
      preservesParticipants: counts.participantCount > 0,
    },
    reset: {
      available: resetAvailable,
      reason: resetReason,
      currentRunVersion,
      nextRunVersion: currentRunVersion + 1,
      warning: 'Reset sẽ mở một phiên chơi mới, danh sách participant hiện tại sẽ trống và người chơi phải đăng ký lại.',
    },
    rules: {
      available: rulesAvailable,
      reason: rulesReason,
      requiresReset: adminStatus === 'draft' && hasCurrentScoringData,
    },
    counts,
  };
}

function formatGameTypeRow(row: any, tenantGameType?: any) {
  return {
    id: toPositiveInt(row?.id) || 0,
    code: toText(row?.code).toLowerCase(),
    name: toText(row?.name),
    description: toText(row?.description) || null,
    status: toText(row?.status).toLowerCase() || 'active',
    isBuiltIn: row?.isBuiltIn !== false,
    isLicensed: Boolean(tenantGameType?.id),
    isEnabled: tenantGameType?.isEnabled === true,
    enabledAt: tenantGameType?.enabledAt || null,
    settings: tenantGameType?.settings || row?.defaultSettings || null,
  };
}

function formatParticipantRow(row: any) {
  const user = row?.user || null;
  const settings = toObjectOrNull(row?.settings);
  return {
    id: toPositiveInt(row?.id) || 0,
    status: toText(row?.status).toLowerCase() || 'active',
    runVersion: Number(row?.runVersion ?? row?.run_version ?? 1),
    registeredAt: row?.registeredAt || null,
    lastActiveAt: row?.lastActiveAt || null,
    totalXp: Number(row?.totalXp ?? 0),
    trialXp: Number(row?.trialXp ?? 0),
    officialXp: Number(row?.officialXp ?? 0),
    rankScore: Number(row?.rankScore ?? 0),
    laneNumber: toPositiveInt(settings?.laneNumber) || null,
    settings,
    user: user
      ? {
        id: toPositiveInt(user?.id) || 0,
        username: toText(user?.username) || null,
        email: toText(user?.email) || null,
        fullName: toText(user?.fullName) || null,
      }
      : null,
  };
}

function getDraftMutationGuardReason(game: any, actionLabel = 'edited') {
  const now = getNow();
  const adminStatus = toText(game?.adminStatus).toLowerCase();
  const trialStartAt = toOptionalDate(game?.trialStartAt, 'trialStartAt');
  const startsAt = toOptionalDate(game?.startsAt, 'startsAt');
  const effectiveStatus = computeEffectiveGameState(game, now);

  if (adminStatus === 'finalized') {
    return `Game can no longer be ${actionLabel} because it has been finalized`;
  }

  if (adminStatus === 'draft') {
    return null;
  }

  if (trialStartAt && now.getTime() >= trialStartAt.getTime()) {
    return `Game can no longer be ${actionLabel} because the trial phase has already started`;
  }

  if (startsAt && now.getTime() >= startsAt.getTime()) {
    return `Game can no longer be ${actionLabel} because the official phase has already started`;
  }

  if (!['draft', 'registration', 'trial_upcoming'].includes(effectiveStatus)) {
    return `Game can no longer be ${actionLabel} because it has already started or finished`;
  }

  return null;
}

function formatGameRow(game: any, options?: {
  participantStats?: Map<number, { total: number; active: number }>;
  ruleStats?: Map<number, { total: number; enabled: number }>;
  currentParticipant?: any | null;
  tenantGameTypeEnabled?: boolean;
}) {
  const gameId = toPositiveInt(game?.id) || 0;
  const participantStats = options?.participantStats?.get(gameId) || { total: 0, active: 0 };
  const ruleStats = options?.ruleStats?.get(gameId) || { total: 0, enabled: 0 };
  const currentParticipant = options?.currentParticipant || null;
  const effectiveStatus = computeEffectiveGameState(game);
  const effectivePhase = getEffectivePhaseMeta(game);
  const registration = buildRegistrationState(game, options?.tenantGameTypeEnabled !== false, currentParticipant);
  const gameTypeCode = toText(game?.gameType?.code).toLowerCase();
  const settings = isGhostRaceGameType(gameTypeCode)
    ? resolveGhostRaceSettings(game?.settings, game?.settings)
    : game?.settings || null;

  return {
    id: gameId,
    code: toText(game?.code),
    name: toText(game?.name),
    description: toText(game?.description) || null,
    adminStatus: toText(game?.adminStatus).toLowerCase() || 'draft',
    currentRunVersion: Number(game?.currentRunVersion || 1),
    effectiveStatus,
    timezone: toText(game?.timezone) || 'Asia/Ho_Chi_Minh',
    lateRegistrationEnabled: game?.lateRegistrationEnabled === true,
    hasTrial: hasTrialWindow(game),
    isPublic: game?.isPublic === true,
    registrationOpenAt: game?.registrationOpenAt || null,
    registrationCloseAt: game?.registrationCloseAt || null,
    trialStartAt: game?.trialStartAt || null,
    trialEndAt: game?.trialEndAt || null,
    startsAt: game?.startsAt || null,
    endsAt: game?.endsAt || null,
    effectivePhase,
    gameType: game?.gameType
      ? {
        id: toPositiveInt(game?.gameType?.id) || 0,
        code: toText(game?.gameType?.code).toLowerCase(),
        name: toText(game?.gameType?.name),
      }
      : null,
    settings,
    participantCount: participantStats.total,
    activeParticipantCount: participantStats.active,
    ruleCount: ruleStats.total,
    enabledRuleCount: ruleStats.enabled,
    editability: {
      canEdit: !getDraftMutationGuardReason(game, 'edited'),
      canPublish: !getDraftMutationGuardReason(game, 'published'),
      reason: getDraftMutationGuardReason(game, 'edited'),
      publishReason: getDraftMutationGuardReason(game, 'published'),
    },
    registration,
    myParticipation: currentParticipant ? formatParticipantRow(currentParticipant) : null,
  };
}

async function loadGameOrThrow(gameId: unknown, tenantId: unknown, options?: { includeParticipants?: boolean; includeRules?: boolean; trx?: any }) {
  const numericGameId = toPositiveInt(gameId);
  if (!numericGameId) {
    httpError(400, 'Invalid game id');
  }

  const game = await strapi.db.query(GAME_UID).findOne({
    where: mergeTenantWhere({ id: numericGameId }, Number(tenantId)),
    select: ['id', 'code', 'name', 'description', 'adminStatus', 'currentRunVersion', 'registrationOpenAt', 'registrationCloseAt', 'trialStartAt', 'trialEndAt', 'startsAt', 'endsAt', 'timezone', 'lateRegistrationEnabled', 'isPublic', 'settings', 'createdAt', 'updatedAt'],
    populate: {
      gameType: {
        select: ['id', 'code', 'name', 'description', 'status', 'isBuiltIn'],
      },
      ...(options?.includeRules ? {
        rules: {
          select: ['id', 'activityCode', 'isEnabled', 'xpAmount', 'maxCount', 'limitPeriod', 'description', 'createdAt', 'updatedAt'],
          orderBy: [{ activityCode: 'asc' }],
        },
      } : {}),
      ...(options?.includeParticipants ? {
        participants: {
          select: ['id', 'status', 'registeredAt', 'lastActiveAt', 'totalXp', 'trialXp', 'officialXp', 'rankScore', 'settings'],
          populate: {
            user: {
              select: ['id', 'username', 'email', 'fullName'],
            },
          },
          orderBy: [{ registeredAt: 'asc' }, { id: 'asc' }],
        },
      } : {}),
    },
    ...(options?.trx ? { transacting: options.trx } : {}),
  } as any);

  if (!game?.id) {
    httpError(404, 'Game not found');
  }

  return syncGameStatusIfNeeded(game, options?.trx);
}

function parseGamePayload(
  payload: any,
  fallbackTimezone = 'Asia/Ho_Chi_Minh',
  options?: { gameTypeCode?: string; currentSettings?: any; isUpdate?: boolean },
) {
  const code = normalizeCode(payload?.code, 'code');
  const name = normalizeCode(payload?.name, 'name');
  const description = toText(payload?.description) || null;
  const timezone = toText(payload?.timezone) || fallbackTimezone;
  const lateRegistrationEnabled = toBoolean(payload?.lateRegistrationEnabled);
  const hasTrial = toBoolean(payload?.hasTrial);
  const registrationOpenAt = toRequiredDate(payload?.registrationOpenAt, 'registrationOpenAt');
  const registrationCloseAt = toRequiredDate(payload?.registrationCloseAt, 'registrationCloseAt');
  const trialStartAt = hasTrial ? toRequiredDate(payload?.trialStartAt, 'trialStartAt') : null;
  const trialEndAt = hasTrial ? toRequiredDate(payload?.trialEndAt, 'trialEndAt') : null;
  const startsAt = toRequiredDate(payload?.startsAt, 'startsAt');
  const endsAt = toRequiredDate(payload?.endsAt, 'endsAt');

  validateGameSchedule({
    registrationOpenAt,
    registrationCloseAt,
    trialStartAt,
    trialEndAt,
    startsAt,
    endsAt,
    lateRegistrationEnabled,
  });

  const gameTypeCode = normalizeGameTypeCode(options?.gameTypeCode);
  const settings = isGhostRaceGameType(gameTypeCode)
    ? resolveGhostRaceSettings(payload?.settings, options?.currentSettings)
    : null;

  return {
    code,
    name,
    description,
    timezone,
    hasTrial,
    lateRegistrationEnabled,
    registrationOpenAt,
    registrationCloseAt,
    trialStartAt,
    trialEndAt,
    startsAt,
    endsAt,
    settings,
  };
}

async function ensureDraftOrUpcomingEditable(game: any) {
  if (toText(game?.adminStatus).toLowerCase() === 'draft') {
    return;
  }

  const blockedReason = getDraftMutationGuardReason(game, 'edited');
  if (blockedReason) {
    httpError(409, blockedReason);
  }
}

async function ensureGameTypeCanBeDisabled(tenantId: number, gameTypeId: number) {
  const relatedGames = await strapi.db.query(GAME_UID).findMany({
    where: mergeTenantWhere({
      gameType: {
        id: {
          $eq: gameTypeId,
        },
      },
    }, tenantId),
    select: ['id', 'adminStatus', 'trialStartAt', 'trialEndAt', 'startsAt', 'endsAt'],
  });

  const blocking = (relatedGames || []).some((item: any) => {
    const effectiveStatus = computeEffectiveGameState(item);
    return effectiveStatus !== 'ended' && effectiveStatus !== 'finalized';
  });

  if (blocking) {
    httpError(409, 'Cannot disable or revoke a game type while related games are still active, upcoming, or in draft');
  }
}

export async function listPlatformGameTypes() {
  const rows = await strapi.db.query(GAME_TYPE_UID).findMany({
    select: ['id', 'code', 'name', 'description', 'status', 'isBuiltIn', 'defaultSettings'],
    orderBy: [{ code: 'asc' }],
  });

  return (rows || []).map((item: any) => formatGameTypeRow(item));
}

export async function listPlatformTenantGameTypes(tenantId: unknown) {
  const tenant = await findTenantOrThrow(tenantId);
  const [gameTypes, tenantGameTypes] = await Promise.all([
    strapi.db.query(GAME_TYPE_UID).findMany({
      select: ['id', 'code', 'name', 'description', 'status', 'isBuiltIn', 'defaultSettings'],
      orderBy: [{ code: 'asc' }],
    }),
    strapi.db.query(TENANT_GAME_TYPE_UID).findMany({
      where: { tenant: Number(tenant.id) },
      select: ['id', 'isEnabled', 'enabledAt', 'settings'],
      populate: {
        gameType: {
          select: ['id'],
        },
      },
    }),
  ]);

  const tenantGameTypeMap = new Map<number, any>();
  for (const row of tenantGameTypes || []) {
    const gameTypeId = extractRelationId(row?.gameType);
    if (!gameTypeId) continue;
    tenantGameTypeMap.set(gameTypeId, row);
  }

  return {
    tenant: {
      id: Number(tenant.id),
      name: toText(tenant.name),
      code: toText(tenant.code),
      timezone: toText(tenant.timezone) || 'Asia/Ho_Chi_Minh',
      status: toText(tenant.tenantStatus) || null,
    },
    gameTypes: (gameTypes || []).map((item: any) => formatGameTypeRow(item, tenantGameTypeMap.get(Number(item.id)))),
  };
}

export async function updatePlatformTenantGameTypeLicense(tenantId: unknown, gameTypeRef: unknown, isLicensed: boolean) {
  const tenant = await findTenantOrThrow(tenantId);
  const gameType = await findGameTypeByRef(gameTypeRef);
  const existing = await findTenantGameType(tenant.id, gameType.id);

  if (isLicensed) {
    const now = getNow();
    const updated = existing?.id
      ? existing
      : await strapi.db.query(TENANT_GAME_TYPE_UID).create({
        data: {
          tenant: Number(tenant.id),
          gameType: Number(gameType.id),
          isEnabled: false,
          enabledAt: null,
          settings: gameType.defaultSettings || null,
        },
      });

    if (!existing?.id && updated?.id) {
      await syncShadowValues(strapi.db.connection, 'tenant_game_types', Number(updated.id), {
        tenant_id: Number(tenant.id),
        game_type_id: Number(gameType.id),
      });
    }

    const refreshed = await findTenantGameType(tenant.id, gameType.id);
    return {
      tenantId: Number(tenant.id),
      gameTypeId: Number(gameType.id),
      isLicensed: true,
      isEnabled: refreshed?.isEnabled === true,
      licensedAt: now.toISOString(),
      tenantGameTypeId: Number((refreshed || updated)?.id || 0) || null,
    };
  }

  if (existing?.id) {
    await ensureGameTypeCanBeDisabled(Number(tenant.id), Number(gameType.id));
    await strapi.db.query(TENANT_GAME_TYPE_UID).delete({
      where: { id: Number(existing.id) },
    });
  }

  return {
    tenantId: Number(tenant.id),
    gameTypeId: Number(gameType.id),
    isLicensed: false,
    isEnabled: false,
    tenantGameTypeId: null,
  };
}

export async function listTenantGameTypes(tenantId: unknown) {
  const result = await listPlatformTenantGameTypes(tenantId);
  return result.gameTypes;
}

export async function updateTenantGameTypeEnablement(tenantId: unknown, gameTypeRef: unknown, isEnabled: boolean) {
  const tenant = await findTenantOrThrow(tenantId);
  const gameType = await findGameTypeByRef(gameTypeRef);
  const existing = await findTenantGameType(tenant.id, gameType.id);

  if (!existing?.id) {
    httpError(409, 'Tenant has not been licensed to use this game type');
  }

  if (!isEnabled) {
    await ensureGameTypeCanBeDisabled(Number(tenant.id), Number(gameType.id));
  }

  const updated = await strapi.db.query(TENANT_GAME_TYPE_UID).update({
    where: { id: Number(existing.id) },
    data: {
      isEnabled,
      enabledAt: isEnabled ? getNow() : null,
    },
  });

  await syncShadowValues(strapi.db.connection, 'tenant_game_types', Number(updated?.id || existing.id), {
    tenant_id: Number(tenant.id),
    game_type_id: Number(gameType.id),
  });

  return {
    tenantId: Number(tenant.id),
    gameTypeId: Number(gameType.id),
    tenantGameTypeId: Number(updated?.id || existing.id),
    isLicensed: true,
    isEnabled,
    enabledAt: isEnabled ? updated?.enabledAt || getNow().toISOString() : null,
  };
}

async function loadTenantGames(tenantId: number) {
  const rows = await strapi.db.query(GAME_UID).findMany({
    where: mergeTenantWhere({}, tenantId),
    select: ['id', 'code', 'name', 'description', 'adminStatus', 'currentRunVersion', 'registrationOpenAt', 'registrationCloseAt', 'trialStartAt', 'trialEndAt', 'startsAt', 'endsAt', 'timezone', 'lateRegistrationEnabled', 'isPublic', 'settings', 'createdAt', 'updatedAt'],
    populate: {
      gameType: {
        select: ['id', 'code', 'name', 'description', 'status', 'isBuiltIn'],
      },
    },
    orderBy: [{ startsAt: 'desc' }, { id: 'desc' }],
  });

  const syncedRows = [];
  for (const row of rows || []) {
    syncedRows.push(await syncGameStatusIfNeeded(row));
  }
  return syncedRows;
}

export async function getGameManagementDashboard(tenantId: unknown) {
  const numericTenantId = requireNumericTenantId(tenantId);
  const [tenantGameTypes, games] = await Promise.all([
    listTenantGameTypes(numericTenantId),
    loadTenantGames(numericTenantId),
  ]);

  const gameIds = games.map((item: any) => Number(item.id)).filter((value: number) => value > 0);
  const [participantStats, ruleStats] = await Promise.all([
    countParticipantsByGameIds(gameIds),
    countRulesByGameIds(gameIds),
  ]);

  const rows = games.map((game: any) => formatGameRow(game, {
    participantStats,
    ruleStats,
    tenantGameTypeEnabled: true,
  }));

  const summary = {
    totalGames: rows.length,
    upcomingGames: rows.filter((item) => ['registration', 'trial_upcoming', 'official_pending'].includes(item.effectiveStatus)).length,
    runningGames: rows.filter((item) => ['trial_running', 'official_running'].includes(item.effectiveStatus)).length,
    endedGames: rows.filter((item) => item.effectiveStatus === 'ended' || item.effectiveStatus === 'finalized').length,
    totalParticipants: rows.reduce((sum, item) => sum + Number(item.participantCount || 0), 0),
  };

  return {
    summary,
    gameTypes: tenantGameTypes,
    games: rows,
    placeholders: {
      leaderboard: 'Reserved for Phase 3 XP Engine',
      xpAnalytics: 'Reserved for Phase 3 XP Engine',
    },
  };
}

export async function listAdminGames(tenantId: unknown) {
  const dashboard = await getGameManagementDashboard(tenantId);
  return dashboard.games;
}

export async function createAdminGame(tenantId: unknown, payload: any, authUser: any) {
  const tenant = await findTenantOrThrow(tenantId);
  const gameType = await findGameTypeByRef(payload?.gameTypeId || payload?.gameTypeCode || payload?.gameType || XP_CHALLENGE_GAME_TYPE_CODE);
  await ensureTenantGameTypeEnabled(tenant.id, gameType.id);

  const normalized = parseGamePayload(payload, toText(tenant.timezone) || 'Asia/Ho_Chi_Minh', {
    gameTypeCode: toText(gameType.code),
  });

  try {
    const created = await strapi.db.query(GAME_UID).create({
      data: {
        tenant: Number(tenant.id),
        gameType: Number(gameType.id),
        code: normalized.code,
        name: normalized.name,
        description: normalized.description,
        adminStatus: 'draft',
        currentRunVersion: 1,
        registrationOpenAt: normalized.registrationOpenAt,
        registrationCloseAt: normalized.registrationCloseAt,
        trialStartAt: normalized.trialStartAt,
        trialEndAt: normalized.trialEndAt,
        startsAt: normalized.startsAt,
        endsAt: normalized.endsAt,
        timezone: normalized.timezone,
        lateRegistrationEnabled: normalized.lateRegistrationEnabled,
        isPublic: false,
        settings: normalized.settings,
        createdBy: Number(authUser?.id || 0) || null,
      },
    } as any);

    if (isXpChallengeGameType(gameType.code)) {
      await ensureDefaultRulesForGame(Number(created.id));
    }
    await syncShadowValues(strapi.db.connection, 'games', Number(created.id), {
      tenant_id: Number(tenant.id),
      game_type_id: Number(gameType.id),
    });

    return getAdminGameDetail(created.id, tenant.id);
  } catch (error: any) {
    if (isUniqueConstraintError(error)) {
      httpError(409, 'Game code already exists in this tenant');
    }
    throw error;
  }
}

export async function updateAdminGame(gameId: unknown, tenantId: unknown, payload: any) {
  const tenant = await findTenantOrThrow(tenantId);
  const current = await loadGameOrThrow(gameId, tenant.id, { includeRules: true });
  await ensureDraftOrUpcomingEditable(current);
  const gameTypeCode = toText(current?.gameType?.code).toLowerCase();

  const normalized = parseGamePayload(payload, toText(tenant.timezone) || 'Asia/Ho_Chi_Minh', {
    gameTypeCode,
    currentSettings: current?.settings,
    isUpdate: true,
  });

  if (isGhostRaceGameType(gameTypeCode)) {
    const attemptCount = await countGhostRaceAttemptsByGame(Number(current.id));
    if (attemptCount > 0) {
      const prevSettings = resolveGhostRaceSettings(current?.settings, current?.settings);
      const nextSettings = resolveGhostRaceSettings(normalized.settings, current?.settings);
      if (
        prevSettings.distanceMeters !== nextSettings.distanceMeters
        || prevSettings.cutoffSeconds !== nextSettings.cutoffSeconds
        || prevSettings.playPlatform !== nextSettings.playPlatform
        || prevSettings.physicsVersion !== nextSettings.physicsVersion
        || prevSettings.trackVersion !== nextSettings.trackVersion
        || prevSettings.rulesVersion !== nextSettings.rulesVersion
      ) {
        httpError(409, 'Ghost race core settings are locked after attempts exist');
      }
    }
  }

  try {
    await strapi.db.query(GAME_UID).update({
      where: { id: Number(current.id) },
      data: {
        code: normalized.code,
        name: normalized.name,
        description: normalized.description,
        registrationOpenAt: normalized.registrationOpenAt,
        registrationCloseAt: normalized.registrationCloseAt,
        trialStartAt: normalized.trialStartAt,
        trialEndAt: normalized.trialEndAt,
        startsAt: normalized.startsAt,
        endsAt: normalized.endsAt,
        timezone: normalized.timezone,
        lateRegistrationEnabled: normalized.lateRegistrationEnabled,
        settings: normalized.settings,
      },
    } as any);

    await syncShadowValues(strapi.db.connection, 'games', Number(current.id), {
      tenant_id: Number(tenant.id),
      game_type_id: Number(current?.gameType?.id || 0) || null,
    });
  } catch (error: any) {
    if (isUniqueConstraintError(error)) {
      httpError(409, 'Game code already exists in this tenant');
    }
    throw error;
  }

  return getAdminGameDetail(current.id, tenant.id);
}

export async function updateAdminGameRules(gameId: unknown, tenantId: unknown, payload: any) {
  const game = await loadGameOrThrow(gameId, tenantId, { includeRules: true });
  if (!isXpChallengeGameType(game?.gameType?.code)) {
    httpError(409, 'This game type does not use XP activity rules');
  }
  const numericGameId = Number(game.id);
  const currentRunVersion = Number(game.currentRunVersion || 1);
  const [historicalCounts, currentRunCounts] = await Promise.all([
    countHistoricalGameData(numericGameId),
    countCurrentRunGameData(numericGameId, currentRunVersion),
  ]);
  const actionState = buildAdminActionAvailability(game, {
    ...historicalCounts,
    currentParticipantCount: currentRunCounts.participantCount,
    currentEventCount: currentRunCounts.eventCount,
    currentLedgerCount: currentRunCounts.ledgerCount,
    currentOfficialLedgerCount: currentRunCounts.officialLedgerCount,
  });

  if (!actionState.rules.available) {
    httpError(409, actionState.rules.reason || 'Game rules cannot be updated');
  }

  const rules = Array.isArray(payload?.rules) ? payload.rules : [];
  if (rules.length !== SUPPORTED_ACTIVITY_RULES.length) {
    httpError(400, `Exactly ${SUPPORTED_ACTIVITY_RULES.length} activity rules are required`);
  }

  const seenCodes = new Set<string>();
  try {
    await strapi.db.connection.transaction(async (trx: any) => {
      const existingRows = await loadStoredRuleRowsForGame(numericGameId, trx);
      const existingRuleMap = new Map<string, any>(
        (existingRows || [])
          .map((item: any) => [toText(item?.activityCode).toLowerCase(), item] as const)
          .filter(([code]) => Boolean(code)),
      );

      for (const input of rules) {
        const definition = getActivityRuleDefinition(input?.activityCode);
        if (seenCodes.has(definition.activityCode)) {
          httpError(400, `Duplicate activityCode: ${definition.activityCode}`);
        }
        seenCodes.add(definition.activityCode);

        const existingRule = existingRuleMap.get(definition.activityCode) || null;
        const data = {
          activityCode: definition.activityCode,
          description: toText(input?.description) || definition.description,
          isEnabled: toBoolean(input?.isEnabled),
          xpAmount: ensureNonNegativeInteger(input?.xpAmount, `${definition.activityCode}.xpAmount`),
          maxCount: ensureNonNegativeInteger(input?.maxCount, `${definition.activityCode}.maxCount`),
          limitPeriod: normalizeLimitPeriod(input?.limitPeriod ?? definition.defaultLimitPeriod),
        };

        if (existingRule?.id) {
          await strapi.db.query(GAME_ACTIVITY_RULE_UID).update({
            where: { id: Number(existingRule.id) },
            data,
            transacting: trx,
          } as any);
          await syncShadowValues(trx, 'game_activity_rules', Number(existingRule.id), {
            game_id: Number(game.id),
          });
        } else {
          const createdRule = await strapi.db.query(GAME_ACTIVITY_RULE_UID).create({
            data: {
              ...data,
              game: numericGameId,
            },
            transacting: trx,
          } as any);
          await syncShadowValues(trx, 'game_activity_rules', Number(createdRule.id), {
            game_id: Number(game.id),
          });
        }
      }
    });
  } catch (error: any) {
    if (isUniqueConstraintError(error)) {
      httpError(409, 'Duplicate game activity rule configuration');
    }
    throw error;
  }

  return getAdminGameDetail(game.id, tenantId);
}

export async function publishAdminGame(gameId: unknown, tenantId: unknown) {
  const game = await loadGameOrThrow(gameId, tenantId, { includeRules: true });
  await ensureDraftOrUpcomingEditable(game);
  await ensureTenantGameTypeEnabled(tenantId, game?.gameType?.id || extractRelationId(game?.gameType));

  const gameTypeCode = toText(game?.gameType?.code).toLowerCase();
  if (isXpChallengeGameType(gameTypeCode)) {
    const storedRules = await loadStoredRuleRowsForGame(Number(game.id));
    if (storedRules.length !== SUPPORTED_ACTIVITY_RULES.length) {
      httpError(409, 'Game must have all three XP activity rules configured before publishing');
    }

    for (const definition of SUPPORTED_ACTIVITY_RULES) {
      if (!storedRules.some((item: any) => toText(item?.activityCode).toLowerCase() === definition.activityCode)) {
        httpError(409, `Missing XP rule for activity ${definition.activityCode}`);
      }
    }
  } else if (isGhostRaceGameType(gameTypeCode)) {
    validateGhostRacePublishSettings(game);
  }

  await strapi.db.query(GAME_UID).update({
    where: { id: Number(game.id) },
    data: {
      adminStatus: 'published',
      isPublic: true,
    },
  } as any);

  return getAdminGameDetail(game.id, tenantId);
}

export async function listAdminGameParticipants(gameId: unknown, tenantId: unknown) {
  const game = await loadGameOrThrow(gameId, tenantId);
  await backfillMissingGhostRaceLanesForRun(game);
  return loadCurrentParticipantRowsForGame(Number(game.id), Number(game.currentRunVersion || 1));
}

async function loadAdminGhostRaceAttempts(gameId: number, runVersion: number, limit = 100) {
  if (!(await strapi.db.connection.schema.hasTable('ghost_race_attempts'))) return [];

  const rows = await strapi.db.connection('ghost_race_attempts as gra')
    .leftJoin('ghost_race_attempts_game_lnk as grag', 'grag.ghost_race_attempt_id', 'gra.id')
    .leftJoin('ghost_race_attempts_user_lnk as grau', 'grau.ghost_race_attempt_id', 'gra.id')
    .leftJoin('up_users as u', function joinUsers() {
      this.on('u.id', '=', strapi.db.connection.raw('COALESCE(gra.user_id, grau.user_id)'));
    })
    .select([
      'gra.id',
      'gra.phase',
      'gra.run_version',
      'gra.status',
      'gra.verification_status',
      'gra.verification_reason',
      'gra.finish_time_seconds',
      'gra.distance_meters',
      'gra.elapsed_seconds',
      'gra.valid_steps',
      'gra.lane_number_snapshot',
      'gra.created_at',
      'gra.submitted_at',
      strapi.db.connection.raw('COALESCE(gra.user_id, grau.user_id) as user_id'),
      'u.username',
      'u.email',
      'u.full_name',
    ])
    .whereRaw('COALESCE(gra.game_id, grag.game_id) = ?', [gameId])
    .where({
      'gra.run_version': runVersion,
    })
    .orderBy([{ column: 'gra.created_at', order: 'desc' }, { column: 'gra.id', order: 'desc' }])
    .limit(Math.max(1, Math.min(500, Number(limit || 100))));

  return (rows || []).map((row: any) => ({
    id: Number(row?.id || 0),
    phase: toText(row?.phase) || null,
    runVersion: Number(row?.run_version || 1),
    status: toText(row?.status) || null,
    verificationStatus: toText(row?.verification_status) || null,
    verificationReason: toText(row?.verification_reason) || null,
    finishTimeSeconds: toOptionalNumber(row?.finish_time_seconds),
    elapsedSeconds: toOptionalNumber(row?.elapsed_seconds),
    distanceMeters: toOptionalNumber(row?.distance_meters),
    validSteps: Number(row?.valid_steps || 0),
    laneNumber: toPositiveInt(row?.lane_number_snapshot) || null,
    createdAt: row?.created_at || null,
    submittedAt: row?.submitted_at || null,
    user: {
      id: toPositiveInt(row?.user_id) || 0,
      username: toText(row?.username) || null,
      email: toText(row?.email) || null,
      fullName: toText(row?.full_name) || null,
    },
  }));
}

async function loadAdminGhostRacePersonalBests(gameId: number, runVersion: number) {
  if (!(await strapi.db.connection.schema.hasTable('ghost_race_attempts'))) {
    return { trial: [], official: [] };
  }

  const rows = await strapi.db.connection('ghost_race_attempts as gra')
    .leftJoin('ghost_race_attempts_game_lnk as grag', 'grag.ghost_race_attempt_id', 'gra.id')
    .leftJoin('ghost_race_attempts_user_lnk as grau', 'grau.ghost_race_attempt_id', 'gra.id')
    .leftJoin('up_users as u', function joinUsers() {
      this.on('u.id', '=', strapi.db.connection.raw('COALESCE(gra.user_id, grau.user_id)'));
    })
    .select([
      'gra.id',
      strapi.db.connection.raw('COALESCE(gra.user_id, grau.user_id) as user_id'),
      'gra.phase',
      'gra.finish_time_seconds',
      'gra.distance_meters',
      'gra.lane_number_snapshot',
      'gra.created_at',
      'u.username',
      'u.email',
      'u.full_name',
    ])
    .whereRaw('COALESCE(gra.game_id, grag.game_id) = ?', [gameId])
    .where({
      'gra.run_version': runVersion,
      'gra.status': 'verified',
      'gra.verification_status': 'verified',
    })
    .whereNotNull('gra.finish_time_seconds')
    .orderByRaw('COALESCE(gra.user_id, grau.user_id) asc')
    .orderBy([{ column: 'gra.phase', order: 'asc' }, { column: 'gra.finish_time_seconds', order: 'asc' }, { column: 'gra.id', order: 'asc' }]);

  const bestByKey = new Map<string, any>();
  for (const row of rows || []) {
    const attemptRow = row as any;
    const userId = Number(attemptRow?.user_id || 0);
    const phase = toText(attemptRow?.phase).toLowerCase() || 'official';
    if (!userId) continue;
    const key = `${userId}:${phase}`;
    if (!bestByKey.has(key)) {
      bestByKey.set(key, attemptRow);
    }
  }

  const trial: any[] = [];
  const official: any[] = [];
  for (const row of bestByKey.values()) {
    const mapped = {
      attemptId: Number(row?.id || 0),
      phase: toText(row?.phase).toLowerCase() || null,
      finishTimeSeconds: Number(row?.finish_time_seconds || 0),
      distanceMeters: Number(row?.distance_meters || 0),
      laneNumber: toPositiveInt(row?.lane_number_snapshot) || null,
      createdAt: row?.created_at || null,
      user: {
        id: Number(row?.user_id || 0),
        username: toText(row?.username) || null,
        email: toText(row?.email) || null,
        fullName: toText(row?.full_name) || null,
      },
    };
    if (mapped.phase === 'trial') {
      trial.push(mapped);
    } else {
      official.push(mapped);
    }
  }

  trial.sort((a, b) => a.finishTimeSeconds - b.finishTimeSeconds);
  official.sort((a, b) => a.finishTimeSeconds - b.finishTimeSeconds);
  return { trial, official };
}

export async function getAdminGameDetail(gameId: unknown, tenantId: unknown) {
  const game = await loadGameOrThrow(gameId, tenantId, { includeParticipants: true, includeRules: true });
  await backfillMissingGhostRaceLanesForRun(game);
  const currentRunVersion = Number(game.currentRunVersion || 1);
  const gameTypeCode = toText(game?.gameType?.code).toLowerCase();
  const isGhostRace = isGhostRaceGameType(gameTypeCode);
  const [participantStats, storedRules, participants, historicalCounts, currentRunCounts, leaderboards, xpSummary, recentEvents, ghostAttempts, ghostPB] = await Promise.all([
    countParticipantsByGameIds([Number(game.id)]),
    loadStoredRuleRowsForGame(Number(game.id)),
    loadCurrentParticipantRowsForGame(Number(game.id), currentRunVersion),
    countHistoricalGameData(Number(game.id)),
    countCurrentRunGameData(Number(game.id), currentRunVersion),
    isGhostRace ? Promise.resolve({ officialTop10: [], trialTop10: [], officialAll: [], trialAll: [] }) : loadGameLeaderboards(Number(game.id), currentRunVersion),
    isGhostRace ? Promise.resolve({ byActivity: [], byPhase: [], eventStatus: [], recentLedgers: [] }) : loadAdminXpSummary(Number(game.id), currentRunVersion),
    isGhostRace ? Promise.resolve([]) : loadRecentGameEvents(Number(game.id), currentRunVersion),
    isGhostRace ? loadAdminGhostRaceAttempts(Number(game.id), currentRunVersion) : Promise.resolve([]),
    isGhostRace ? loadAdminGhostRacePersonalBests(Number(game.id), currentRunVersion) : Promise.resolve({ trial: [], official: [] }),
  ]);
  const effectiveRules = buildEffectiveRuleRows(storedRules, game?.gameType?.code);
  const effectiveRuleStats = summarizeRuleRows(effectiveRules);
  const adminActions = buildAdminActionAvailability(game, {
    ...historicalCounts,
    currentParticipantCount: currentRunCounts.participantCount,
    currentEventCount: currentRunCounts.eventCount,
    currentLedgerCount: currentRunCounts.ledgerCount,
    currentOfficialLedgerCount: currentRunCounts.officialLedgerCount,
  });

  return {
    game: formatGameRow(game, {
      participantStats,
      ruleStats: new Map([[Number(game.id), effectiveRuleStats]]),
      tenantGameTypeEnabled: true,
    }),
    rules: effectiveRules,
    participants,
    stats: {
      totalParticipants: participantStats.get(Number(game.id))?.total || 0,
      activeParticipants: participantStats.get(Number(game.id))?.active || 0,
      configuredRules: effectiveRuleStats.total,
      enabledRules: effectiveRuleStats.enabled,
    },
    leaderboards,
    xpSummary,
    recentEvents,
    ghostRace: isGhostRace
      ? {
        config: resolveGhostRaceSettings(game?.settings, game?.settings),
        attempts: ghostAttempts,
        personalBest: ghostPB,
      }
      : null,
    adminActions,
    placeholders: {
      leaderboard: 'Reserved for Phase 3 XP Engine',
      xpAnalytics: 'Reserved for Phase 3 XP Engine',
    },
  };
}

function requireReason(value: unknown, fieldName: string) {
  const text = toText(value);
  if (!text) {
    httpError(400, `${fieldName} is required`);
  }
  return text;
}

function parseChallengeAnswer(value: unknown) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed)) {
    httpError(400, 'answer must be an integer');
  }
  return parsed;
}

function toResetChallengeSummary(row: any) {
  return {
    id: toPositiveInt(row?.id) || 0,
    leftOperand: Number(row?.leftOperand ?? 0),
    rightOperand: Number(row?.rightOperand ?? 0),
    expiresAt: row?.expiresAt || null,
    maxAttempts: Number(row?.maxAttempts ?? RESET_CHALLENGE_MAX_ATTEMPTS),
    remainingAttempts: Math.max(0, Number(row?.maxAttempts ?? RESET_CHALLENGE_MAX_ATTEMPTS) - Number(row?.attemptCount ?? 0)),
  };
}

async function expireActiveResetChallenges(gameId: number, tenantId: number, actorId: number, trx?: any) {
  const activeChallenges = await strapi.db.query(GAME_RESET_CHALLENGE_UID).findMany({
    where: {
      tenant: tenantId,
      game: gameId,
      actor: actorId,
      purpose: 'reset',
      status: 'active',
    },
    select: ['id'],
    ...(trx ? { transacting: trx } : {}),
  } as any);

  for (const item of activeChallenges || []) {
    await strapi.db.query(GAME_RESET_CHALLENGE_UID).update({
      where: { id: Number(item.id) },
      data: {
        status: 'expired',
      },
      ...(trx ? { transacting: trx } : {}),
    } as any);
  }
}

export async function unpublishAdminGame(gameId: unknown, tenantId: unknown, authUser: any) {
  const numericGameId = toPositiveInt(gameId);
  if (!numericGameId) httpError(400, 'Invalid game id');
  const numericTenantId = requireNumericTenantId(tenantId);
  const actorId = toPositiveInt(authUser?.id);
  if (!actorId) httpError(401, 'Unauthorized');

  const result = await strapi.db.connection.transaction(async (trx: any) => {
    const lockedGame = await trx('games')
      .select(['id', 'admin_status', 'current_run_version', 'starts_at'])
      .where({ id: numericGameId, tenant_id: numericTenantId })
      .first()
      .forUpdate();

    if (!lockedGame?.id) {
      httpError(404, 'Game not found');
    }

    const game = await loadGameOrThrow(numericGameId, numericTenantId, { trx });
    const currentRunVersion = Number(lockedGame.current_run_version || game.currentRunVersion || 1);
    const [historicalCounts, currentRunCounts] = await Promise.all([
      countHistoricalGameData(numericGameId),
      countCurrentRunGameData(numericGameId, currentRunVersion),
    ]);

    const actionState = buildAdminActionAvailability(game, {
      ...historicalCounts,
      currentParticipantCount: currentRunCounts.participantCount,
      currentEventCount: currentRunCounts.eventCount,
      currentLedgerCount: currentRunCounts.ledgerCount,
      currentOfficialLedgerCount: currentRunCounts.officialLedgerCount,
    });

    if (!actionState.unpublish.available) {
      httpError(409, actionState.unpublish.reason || 'Game cannot be unpublished');
    }

    await trx('games')
      .where({ id: numericGameId, tenant_id: numericTenantId })
      .update({
        admin_status: 'draft',
        is_public: false,
        updated_at: getNow(),
      });

    await writeGameAdminAudit({
      tenantId: numericTenantId,
      gameId: numericGameId,
      actorId,
      actionType: 'unpublish',
      reason: actionState.unpublish.warning || 'manual-unpublish-before-official',
      oldRunVersion: currentRunVersion,
      newRunVersion: currentRunVersion,
      metadata: {
        participantCount: historicalCounts.participantCount,
        eventCount: historicalCounts.eventCount,
        ledgerCount: historicalCounts.ledgerCount,
        currentRunVersion,
        currentOfficialLedgerCount: currentRunCounts.officialLedgerCount,
        preservesParticipants: actionState.unpublish.preservesParticipants,
      },
      trx,
    });

    return {
      message: historicalCounts.participantCount > 0 || historicalCounts.eventCount > 0 || historicalCounts.ledgerCount > 0
        ? 'Game da duoc rut cong bo ve draft. Participants, events va ledgers duoc giu nguyen.'
        : 'Game da duoc rut cong bo ve draft.',
    };
  });

  return {
    ...result,
    ...(await getAdminGameDetail(numericGameId, numericTenantId)),
  };
}

export async function createGameResetChallenge(gameId: unknown, tenantId: unknown, authUser: any) {
  const game = await loadGameOrThrow(gameId, tenantId);
  const numericGameId = Number(game.id);
  const numericTenantId = requireNumericTenantId(tenantId);
  const actorId = toPositiveInt(authUser?.id);
  if (!actorId) httpError(401, 'Unauthorized');

  const currentRunVersion = Number(game.currentRunVersion || 1);
  const currentRunCounts = await countCurrentRunGameData(numericGameId, currentRunVersion);
  const actionState = buildAdminActionAvailability(game, {
    ...(await countHistoricalGameData(numericGameId)),
    currentParticipantCount: currentRunCounts.participantCount,
    currentEventCount: currentRunCounts.eventCount,
    currentLedgerCount: currentRunCounts.ledgerCount,
    currentOfficialLedgerCount: currentRunCounts.officialLedgerCount,
  });

  if (!actionState.reset.available) {
    httpError(409, actionState.reset.reason || 'Game reset is not available');
  }

  const leftOperand = randomInt(10, 100);
  const rightOperand = randomInt(10, 100);
  const expiresAt = new Date(Date.now() + RESET_CHALLENGE_TTL_MS);

  await expireActiveResetChallenges(numericGameId, numericTenantId, actorId);

  const created = await strapi.db.query(GAME_RESET_CHALLENGE_UID).create({
    data: {
      tenant: numericTenantId,
      game: numericGameId,
      actor: actorId,
      purpose: 'reset',
      nonce: randomUUID(),
      leftOperand,
      rightOperand,
      expectedProduct: leftOperand * rightOperand,
      gameRunVersion: currentRunVersion,
      status: 'active',
      attemptCount: 0,
      maxAttempts: RESET_CHALLENGE_MAX_ATTEMPTS,
      expiresAt,
      usedAt: null,
      lastAttemptAt: null,
    },
  } as any);

  await syncShadowValues(strapi.db.connection, 'game_reset_challenges', Number(created.id), {
    tenant_id: numericTenantId,
    game_id: numericGameId,
    actor_id: actorId,
  });

  return {
    challenge: toResetChallengeSummary(created),
    adminAction: actionState.reset,
  };
}

export async function resetAdminGame(gameId: unknown, tenantId: unknown, authUser: any, input: any) {
  const numericGameId = toPositiveInt(gameId);
  const numericTenantId = requireNumericTenantId(tenantId);
  const actorId = toPositiveInt(authUser?.id);
  if (!numericGameId) httpError(400, 'Invalid game id');
  if (!actorId) httpError(401, 'Unauthorized');

  const reason = requireReason(input?.reason, 'reason');
  const answer = parseChallengeAnswer(input?.answer);
  if (input?.acknowledged !== true) {
    httpError(400, 'acknowledged must be true');
  }

  const result = await strapi.db.connection.transaction(async (trx: any) => {
    const lockedGame = await trx('games')
      .select(['id', 'admin_status', 'current_run_version'])
      .where({ id: numericGameId, tenant_id: numericTenantId })
      .first()
      .forUpdate();

    if (!lockedGame?.id) {
      httpError(404, 'Game not found');
    }

    const game = await loadGameOrThrow(numericGameId, numericTenantId, { trx });
    const currentRunVersion = Number(lockedGame.current_run_version || game.currentRunVersion || 1);
    const currentRunCounts = await countCurrentRunGameData(numericGameId, currentRunVersion);
    const actionState = buildAdminActionAvailability(game, {
      ...(await countHistoricalGameData(numericGameId)),
      currentParticipantCount: currentRunCounts.participantCount,
      currentEventCount: currentRunCounts.eventCount,
      currentLedgerCount: currentRunCounts.ledgerCount,
      currentOfficialLedgerCount: currentRunCounts.officialLedgerCount,
    });

    if (!actionState.reset.available) {
      httpError(409, actionState.reset.reason || 'Game reset is not available');
    }

    const challengeId = toPositiveInt(input?.challengeId);
    if (!challengeId) {
      httpError(400, 'challengeId is required');
    }

    const challenge = await strapi.db.query(GAME_RESET_CHALLENGE_UID).findOne({
      where: {
        id: challengeId,
        tenant: numericTenantId,
        game: numericGameId,
        actor: actorId,
        purpose: 'reset',
      },
      select: ['id', 'status', 'attemptCount', 'maxAttempts', 'expiresAt', 'usedAt', 'expectedProduct', 'gameRunVersion'],
      transacting: trx,
    } as any);

    if (!challenge?.id) {
      httpError(404, 'Reset challenge not found');
    }

    const now = getNow();
    const isExpired = challenge.expiresAt ? new Date(challenge.expiresAt).getTime() < now.getTime() : true;
    if (challenge.status !== 'active' || challenge.usedAt || isExpired) {
      await strapi.db.query(GAME_RESET_CHALLENGE_UID).update({
        where: { id: Number(challenge.id) },
        data: {
          status: isExpired ? 'expired' : challenge.status,
          lastAttemptAt: now,
        },
        transacting: trx,
      } as any);
      httpError(409, isExpired ? 'Reset challenge has expired' : 'Reset challenge has already been used');
    }

    if (Number(challenge.gameRunVersion || 0) !== currentRunVersion) {
      await strapi.db.query(GAME_RESET_CHALLENGE_UID).update({
        where: { id: Number(challenge.id) },
        data: {
          status: 'failed',
          lastAttemptAt: now,
        },
        transacting: trx,
      } as any);
      httpError(409, 'Reset challenge is no longer valid for the current run version');
    }

    if (Number(challenge.attemptCount || 0) >= Number(challenge.maxAttempts || RESET_CHALLENGE_MAX_ATTEMPTS)) {
      await strapi.db.query(GAME_RESET_CHALLENGE_UID).update({
        where: { id: Number(challenge.id) },
        data: {
          status: 'failed',
          lastAttemptAt: now,
        },
        transacting: trx,
      } as any);
      httpError(409, 'Reset challenge attempt limit exceeded');
    }

    const expectedProduct = Number(challenge.expectedProduct || 0);
    if (answer !== expectedProduct) {
      const nextAttempts = Number(challenge.attemptCount || 0) + 1;
      await strapi.db.query(GAME_RESET_CHALLENGE_UID).update({
        where: { id: Number(challenge.id) },
        data: {
          attemptCount: nextAttempts,
          lastAttemptAt: now,
          status: nextAttempts >= Number(challenge.maxAttempts || RESET_CHALLENGE_MAX_ATTEMPTS) ? 'failed' : 'active',
        },
        transacting: trx,
      } as any);
      httpError(409, 'Incorrect multiplication answer');
    }

    const nextRunVersion = currentRunVersion + 1;
    await strapi.db.query(GAME_RESET_CHALLENGE_UID).update({
      where: { id: Number(challenge.id) },
      data: {
        status: 'used',
        usedAt: now,
        lastAttemptAt: now,
        attemptCount: Number(challenge.attemptCount || 0) + 1,
      },
      transacting: trx,
    } as any);

    await trx('games')
      .where({ id: numericGameId })
      .update({
        current_run_version: nextRunVersion,
        updated_at: now,
      });

    await writeGameAdminAudit({
      tenantId: numericTenantId,
      gameId: numericGameId,
      actorId,
      actionType: 'reset',
      reason,
      oldRunVersion: currentRunVersion,
      newRunVersion: nextRunVersion,
      metadata: {
        challengeId: Number(challenge.id),
        previousCurrentRunCounts: currentRunCounts,
      },
      trx,
    });

    return {
      challengeId: Number(challenge.id),
      oldRunVersion: currentRunVersion,
      newRunVersion: nextRunVersion,
    };
  });

  return {
    message: 'Da reset du lieu choi va chuyen sang phien moi.',
    ...result,
    detail: await getAdminGameDetail(numericGameId, numericTenantId),
  };
}

export async function listGameCenterGames(tenantId: unknown, authUser: any) {
  const numericTenantId = requireNumericTenantId(tenantId);
  await requireTenantMember(authUser?.id, numericTenantId);

  const [tenantGameTypes, games] = await Promise.all([
    listTenantGameTypes(numericTenantId),
    strapi.db.query(GAME_UID).findMany({
      where: mergeTenantWhere({
        adminStatus: {
          $in: ['published', 'running', 'ended', 'finalized'],
        },
      }, numericTenantId),
      select: ['id', 'code', 'name', 'description', 'adminStatus', 'currentRunVersion', 'registrationOpenAt', 'registrationCloseAt', 'trialStartAt', 'trialEndAt', 'startsAt', 'endsAt', 'timezone', 'lateRegistrationEnabled', 'isPublic', 'settings', 'createdAt', 'updatedAt'],
      populate: {
        gameType: {
          select: ['id', 'code', 'name', 'description', 'status', 'isBuiltIn'],
        },
      },
      orderBy: [{ startsAt: 'asc' }, { id: 'desc' }],
    }),
  ]);

  const syncedGames = [];
  for (const row of games || []) {
    syncedGames.push(await syncGameStatusIfNeeded(row));
  }

  const gameIds = syncedGames.map((item: any) => Number(item.id)).filter((value: number) => value > 0);
  const [participantStats, ruleStats, currentParticipants] = await Promise.all([
    countParticipantsByGameIds(gameIds),
    countRulesByGameIds(gameIds),
    loadCurrentUserParticipantsByGameIds(Number(authUser.id), numericTenantId, gameIds),
  ]);

  const enabledGameTypeIds = new Set(
    (tenantGameTypes || [])
      .filter((item: any) => item.isLicensed && item.isEnabled)
      .map((item: any) => Number(item.id))
      .filter((value: number) => value > 0),
  );

  const rows = syncedGames.map((game: any) => formatGameRow(game, {
    participantStats,
    ruleStats,
    currentParticipant: currentParticipants.get(Number(game.id)) || null,
    tenantGameTypeEnabled: enabledGameTypeIds.has(Number(game?.gameType?.id || 0)),
  }));

  return {
    summary: {
      upcomingGames: rows.filter((item) => ['registration', 'trial_upcoming', 'official_pending'].includes(item.effectiveStatus)).length,
      runningGames: rows.filter((item) => ['trial_running', 'official_running'].includes(item.effectiveStatus)).length,
      endedGames: rows.filter((item) => item.effectiveStatus === 'ended' || item.effectiveStatus === 'finalized').length,
      registeredGames: rows.filter((item) => Boolean(item.myParticipation?.id)).length,
    },
    games: rows,
  };
}

export async function getGameCenterGameDetail(gameId: unknown, tenantId: unknown, authUser: any) {
  const numericTenantId = requireNumericTenantId(tenantId);
  await requireTenantMember(authUser?.id, numericTenantId);

  const game = await loadGameOrThrow(gameId, numericTenantId, { includeRules: true });
  await backfillMissingGhostRaceLanesForRun(game);
  await ensureGhostRaceLaneForCurrentParticipant(game, numericTenantId, Number(authUser.id));
  const tenantGameType = await findTenantGameType(numericTenantId, game?.gameType?.id || extractRelationId(game?.gameType));
  const gameIdNumber = Number(game.id);
  const [participantStats, currentParticipants, storedRules, leaderboards] = await Promise.all([
    countParticipantsByGameIds([gameIdNumber]),
    loadCurrentUserParticipantsByGameIds(Number(authUser.id), numericTenantId, [gameIdNumber]),
    loadStoredRuleRowsForGame(gameIdNumber),
    loadGameLeaderboards(gameIdNumber, Number(game.currentRunVersion || 1)),
  ]);
  const effectiveRules = buildEffectiveRuleRows(storedRules, game?.gameType?.code);
  const effectiveRuleStats = summarizeRuleRows(effectiveRules);
  const currentParticipant = currentParticipants.get(gameIdNumber) || null;
  const progress = currentParticipant?.id
    ? await loadRuleProgressSummary(game, Number(game.currentRunVersion || 1), Number(authUser.id), effectiveRules)
    : [];
  const history = currentParticipant?.id
    ? await loadParticipantHistory(gameIdNumber, Number(game.currentRunVersion || 1), Number(authUser.id), 20)
    : [];
  const myOfficialRank = leaderboards.officialAll.find((item: any) => Number(item.userId || 0) === Number(authUser.id))?.rank || null;
  const myTrialRank = leaderboards.trialAll.find((item: any) => Number(item.userId || 0) === Number(authUser.id))?.rank || null;

  return {
    game: {
      ...formatGameRow(game, {
        participantStats,
        ruleStats: new Map([[gameIdNumber, effectiveRuleStats]]),
        currentParticipant,
        tenantGameTypeEnabled: tenantGameType?.isEnabled === true,
      }),
      registration: buildRegistrationState(game, tenantGameType?.isEnabled === true, currentParticipant),
      myParticipation: currentParticipant ? formatParticipantRow(currentParticipant) : null,
    },
    rules: effectiveRules,
    stats: {
      totalParticipants: participantStats.get(gameIdNumber)?.total || 0,
      activeParticipants: participantStats.get(gameIdNumber)?.active || 0,
      configuredRules: effectiveRuleStats.total,
      enabledRules: effectiveRuleStats.enabled,
    },
    progress,
    history,
    leaderboards,
    mySummary: currentParticipant?.id ? {
      totalXp: currentParticipant.totalXp,
      trialXp: currentParticipant.trialXp,
      officialXp: currentParticipant.officialXp,
      officialRank: myOfficialRank,
      trialRank: myTrialRank,
    } : null,
  };
}

function resolveGhostRacePhaseCode(game: any): 'trial' | 'official' | null {
  const phase = getEffectivePhaseMeta(game);
  if (phase?.isTrial) return 'trial';
  if (phase?.isOfficial) return 'official';
  return null;
}

function ensureGhostRaceFeatureEnabled(game: any) {
  const gameTypeCode = toText(game?.gameType?.code).toLowerCase();
  if (!isGhostRaceGameType(gameTypeCode)) {
    httpError(409, 'This game is not configured as ghost_race');
  }
}

async function ensureGhostRaceLaneForCurrentParticipant(game: any, tenantId: number, userId: number) {
  if (!isGhostRaceGameType(game?.gameType?.code)) return null;

  const gameId = Number(game.id);
  const runVersion = Number(game.currentRunVersion || 1);
  const existingMap = await loadCurrentUserParticipantsByGameIds(userId, tenantId, [gameId]);
  const current = existingMap.get(gameId) || null;
  if (!current?.id) return null;
  if (toPositiveInt(current?.laneNumber || current?.settings?.laneNumber)) {
    return current;
  }

  const repaired = await strapi.db.connection.transaction(async (trx: any) => {
    const lockedRow = await trx('game_participants')
      .select(['id', 'settings'])
      .where({
        id: Number(current.id),
        game_id: gameId,
        run_version: runVersion,
        tenant_id: tenantId,
        user_id: userId,
      })
      .first()
      .forUpdate();

    if (!lockedRow?.id) return null;
    const lockedSettings = toObjectOrNull(lockedRow?.settings);
    const existingLane = toPositiveInt(lockedSettings?.laneNumber);
    if (existingLane) {
      return { id: Number(lockedRow.id), laneNumber: existingLane };
    }

    const preferredLane = await loadStableLaneNumberForUser(gameId, userId, trx);
    const laneNumber = await reserveNextGhostRaceLane(trx, gameId, runVersion, preferredLane);
    await strapi.db.query(GAME_PARTICIPANT_UID).update({
      where: { id: Number(lockedRow.id) },
      data: {
        settings: {
          ...(lockedSettings || {}),
          laneNumber,
          laneAssignedAt: getNow().toISOString(),
          laneSource: 'repair-current-participant',
        },
      },
      transacting: trx,
    } as any);
    return { id: Number(lockedRow.id), laneNumber };
  });

  if (repaired?.laneNumber) {
    strapi.log.info(`[ghost-race] lane repaired for participant ${repaired.id} in game ${gameId}: lane ${repaired.laneNumber}`);
  }
  const refreshedMap = await loadCurrentUserParticipantsByGameIds(userId, tenantId, [gameId]);
  return refreshedMap.get(gameId) || null;
}

async function backfillMissingGhostRaceLanesForRun(game: any) {
  if (!isGhostRaceGameType(game?.gameType?.code)) return 0;
  const gameId = Number(game.id);
  const runVersion = Number(game.currentRunVersion || 1);

  const updatedCount = await strapi.db.connection.transaction(async (trx: any) => {
    const client = String(trx?.client?.config?.client || '').toLowerCase();
    if (client.includes('pg')) {
      const lockKey = gameId * 100000 + runVersion;
      await trx.raw('select pg_advisory_xact_lock(?)', [lockKey]);
    }

    const rows = await trx('game_participants')
      .select(['id', 'user_id', 'settings'])
      .where({ game_id: gameId, run_version: runVersion })
      .orderBy([{ column: 'id', order: 'asc' }])
      .forUpdate();

    let repaired = 0;
    for (const row of rows || []) {
      const settings = toObjectOrNull(row?.settings);
      const existingLane = toPositiveInt(settings?.laneNumber);
      if (existingLane) continue;

      const userId = Number(row?.user_id || 0);
      const preferredLane = userId > 0 ? await loadStableLaneNumberForUser(gameId, userId, trx) : null;
      const laneNumber = await reserveNextGhostRaceLane(trx, gameId, runVersion, preferredLane);
      await strapi.db.query(GAME_PARTICIPANT_UID).update({
        where: { id: Number(row.id) },
        data: {
          settings: {
            ...(settings || {}),
            laneNumber,
            laneAssignedAt: getNow().toISOString(),
            laneSource: 'backfill',
          },
        },
        transacting: trx,
      } as any);
      repaired += 1;
    }

    return repaired;
  });

  if (updatedCount > 0) {
    strapi.log.info(`[ghost-race] backfilled ${updatedCount} participant lane(s) for game ${gameId}, run ${runVersion}`);
  }
  return updatedCount;
}

async function loadCurrentParticipantOrThrow(game: any, tenantId: number, userId: number) {
  await ensureGhostRaceLaneForCurrentParticipant(game, tenantId, userId);
  const map = await loadCurrentUserParticipantsByGameIds(userId, tenantId, [Number(game.id)]);
  const participant = map.get(Number(game.id));
  if (!participant?.id) {
    httpError(409, 'User must register before starting a ghost race attempt');
  }
  if (toText(participant.status).toLowerCase() !== 'active') {
    httpError(403, 'Participant is not active for this run');
  }
  return participant;
}

function getGhostRacePhaseOrThrow(game: any) {
  const phaseCode = resolveGhostRacePhaseCode(game);
  if (!phaseCode) {
    httpError(409, 'Ghost race attempts are only allowed during active Trial or Official phase');
  }
  return phaseCode;
}

function toReplayPayloadOrNull(value: unknown) {
  const parsed = toObjectOrNull(value);
  if (!parsed) return null;
  return parsed;
}

function hasValidGhostRaceReplayPayload(replayPayload: any) {
  if (!replayPayload || typeof replayPayload !== 'object') return false;
  if (!Array.isArray(replayPayload.tickStates) || replayPayload.tickStates.length < 2) return false;
  const firstState = replayPayload.tickStates[0] || null;
  const lastState = replayPayload.tickStates[replayPayload.tickStates.length - 1] || null;
  const startDistance = toOptionalNumber(firstState?.distance);
  const endDistance = toOptionalNumber(lastState?.distance);
  if (!Number.isFinite(startDistance as number) || !Number.isFinite(endDistance as number)) return false;
  if (Number(endDistance) <= Number(startDistance)) return false;
  const inputs = Array.isArray(replayPayload.inputs) ? replayPayload.inputs : [];
  const checkpoints = Array.isArray(replayPayload.checkpoints) ? replayPayload.checkpoints : [];
  if (inputs.length < 1 && checkpoints.length < 1) return false;
  return true;
}

function resolveRunnerDisplayName(user: any, fallbackLabel: string) {
  const fullName = toText(user?.fullName || user?.full_name);
  if (fullName) return fullName;
  const username = toText(user?.username);
  if (username) return username;
  const email = toText(user?.email);
  if (email) return email;
  return fallbackLabel;
}

async function loadGhostRacePhaseLeaderboard(
  gameId: number,
  tenantId: number,
  runVersion: number,
  phaseCode: 'trial' | 'official',
) {
  if (!(await strapi.db.connection.schema.hasTable('ghost_race_attempts'))) {
    return {
      entries: [],
      totalParticipantsWithAttempt: 0,
    };
  }

  const [bestRows, attemptCountRows] = await Promise.all([
    strapi.db.connection('ghost_race_attempts as gra')
      .leftJoin('ghost_race_attempts_tenant_lnk as grat', 'grat.ghost_race_attempt_id', 'gra.id')
      .leftJoin('ghost_race_attempts_game_lnk as grag', 'grag.ghost_race_attempt_id', 'gra.id')
      .leftJoin('ghost_race_attempts_user_lnk as grau', 'grau.ghost_race_attempt_id', 'gra.id')
      .leftJoin('up_users as u', function joinUsers() {
        this.on('u.id', '=', strapi.db.connection.raw('COALESCE(gra.user_id, grau.user_id)'));
      })
      .select([
        'gra.id',
        strapi.db.connection.raw('COALESCE(gra.user_id, grau.user_id) as user_id'),
        'gra.finish_time_seconds',
        'gra.distance_meters',
        'gra.replay_payload',
        'gra.created_at',
        'u.username',
        'u.email',
        'u.full_name',
      ])
      .whereRaw('COALESCE(gra.tenant_id, grat.tenant_id) = ?', [tenantId])
      .whereRaw('COALESCE(gra.game_id, grag.game_id) = ?', [gameId])
      .where({
        'gra.run_version': runVersion,
        'gra.phase': phaseCode,
        'gra.status': 'verified',
        'gra.verification_status': 'verified',
      })
      .whereNotNull('gra.finish_time_seconds')
      .orderBy([
        { column: 'user_id', order: 'asc' },
        { column: 'gra.finish_time_seconds', order: 'asc' },
        { column: 'gra.id', order: 'asc' },
      ]),
    strapi.db.connection('ghost_race_attempts as gra')
      .leftJoin('ghost_race_attempts_tenant_lnk as grat', 'grat.ghost_race_attempt_id', 'gra.id')
      .leftJoin('ghost_race_attempts_game_lnk as grag', 'grag.ghost_race_attempt_id', 'gra.id')
      .leftJoin('ghost_race_attempts_user_lnk as grau', 'grau.ghost_race_attempt_id', 'gra.id')
      .select(strapi.db.connection.raw('COALESCE(gra.user_id, grau.user_id) as user_id'))
      .count<{ user_id: number; count: string }[]>('* as count')
      .whereRaw('COALESCE(gra.tenant_id, grat.tenant_id) = ?', [tenantId])
      .whereRaw('COALESCE(gra.game_id, grag.game_id) = ?', [gameId])
      .where({
        'gra.run_version': runVersion,
        'gra.phase': phaseCode,
      })
      .groupByRaw('COALESCE(gra.user_id, grau.user_id)'),
  ]);

  const bestByUser = new Map<number, any>();
  for (const row of bestRows || []) {
    const bestRow = row as any;
    const userId = Number(bestRow?.user_id || 0);
    if (!userId || bestByUser.has(userId)) continue;
    bestByUser.set(userId, bestRow);
  }

  const attemptCounts = new Map<number, number>();
  for (const row of attemptCountRows || []) {
    const userId = Number((row as any)?.user_id || 0);
    if (!userId) continue;
    attemptCounts.set(userId, Number((row as any)?.count || 0));
  }

  const laneMap = new Map<number, number | null>();
  if (bestByUser.size > 0) {
    const participantRows = await strapi.db.connection('game_participants')
      .select(['user_id', 'settings'])
      .where({
        game_id: gameId,
        tenant_id: tenantId,
        run_version: runVersion,
      })
      .whereIn('user_id', [...bestByUser.keys()]);
    for (const row of participantRows || []) {
      const userId = Number(row?.user_id || 0);
      if (!userId) continue;
      const settings = toObjectOrNull(row?.settings);
      laneMap.set(userId, toPositiveInt(settings?.laneNumber) || null);
    }
  }

  const sortedRows = [...bestByUser.values()].sort((left: any, right: any) => {
    const leftFinish = Number(left?.finish_time_seconds || Number.POSITIVE_INFINITY);
    const rightFinish = Number(right?.finish_time_seconds || Number.POSITIVE_INFINITY);
    if (leftFinish !== rightFinish) return leftFinish - rightFinish;
    const leftCreated = left?.created_at ? new Date(left.created_at).getTime() : 0;
    const rightCreated = right?.created_at ? new Date(right.created_at).getTime() : 0;
    if (leftCreated !== rightCreated) return leftCreated - rightCreated;
    return Number(left?.id || 0) - Number(right?.id || 0);
  });

  let nextRank = 0;
  let processed = 0;
  let lastFinish: number | null = null;
  const entries = sortedRows.map((row: any) => {
    const finishTimeSeconds = Number(row?.finish_time_seconds || 0);
    if (lastFinish === null || Math.abs(finishTimeSeconds - lastFinish) > 1e-9) {
      nextRank = processed + 1;
      lastFinish = finishTimeSeconds;
    }
    processed += 1;
    const userId = Number(row?.user_id || 0);
    const replayPayload = toReplayPayloadOrNull(row?.replay_payload);
    const validReplay = hasValidGhostRaceReplayPayload(replayPayload);
    return {
      rank: nextRank,
      userId,
      displayName: resolveRunnerDisplayName(row, `Runner #${userId || '?'}`),
      finishTimeSeconds,
      distanceMeters: Number(row?.distance_meters || 0),
      attemptId: Number(row?.id || 0),
      createdAt: row?.created_at || null,
      attemptCount: attemptCounts.get(userId) || 0,
      laneNumber: laneMap.has(userId) ? laneMap.get(userId) : null,
      hasReplay: validReplay,
      replayPayload: validReplay ? replayPayload : null,
    };
  });

  return {
    entries,
    totalParticipantsWithAttempt: attemptCounts.size,
  };
}

function buildAsyncRaceOpponentsSnapshot(
  leaderboardEntries: any[],
  currentUserId: number,
  maxOpponents = 5,
) {
  const opponentEntries = (leaderboardEntries || [])
    .filter((entry: any) => Number(entry?.userId || 0) !== currentUserId);
  const withReplay = opponentEntries.filter((entry: any) => entry.hasReplay && entry.replayPayload);
  const withoutReplay = opponentEntries.filter((entry: any) => !entry.hasReplay);
  const selectedOpponents = withReplay.slice(0, Math.max(0, Math.min(5, maxOpponents)));
  return {
    selectedOpponents: selectedOpponents.map((entry: any, index: number) => ({
      lane: toPositiveInt(entry?.laneNumber) || null,
      userId: Number(entry.userId || 0),
      displayName: toText(entry.displayName) || `Runner #${index + 1}`,
      rank: Number(entry.rank || index + 1),
      finishTimeSeconds: Number(entry.finishTimeSeconds || 0),
      replayPayload: entry.replayPayload,
    })),
    missingReplayParticipants: withoutReplay.slice(0, 10).map((entry: any) => ({
      userId: Number(entry.userId || 0),
      displayName: toText(entry.displayName) || '-',
      rank: Number(entry.rank || 0),
      finishTimeSeconds: Number(entry.finishTimeSeconds || 0),
      reason: 'missing_or_invalid_replay',
    })),
  };
}

function buildAsyncRaceDisplayLineup(params: {
  leaderboardEntries: any[];
  currentUserId: number;
  currentUserLane: number | null;
  currentUserDisplayName: string;
  maxOpponents?: number;
}) {
  const {
    leaderboardEntries,
    currentUserId,
    currentUserLane,
    currentUserDisplayName,
    maxOpponents = 5,
  } = params;
  const opponentSnapshot = buildAsyncRaceOpponentsSnapshot(leaderboardEntries, currentUserId, maxOpponents);
  const myEntry = (leaderboardEntries || []).find((entry: any) => Number(entry?.userId || 0) === currentUserId) || null;

  const lineupSeed = [
    {
      kind: 'player',
      userId: currentUserId,
      displayName: currentUserDisplayName || 'Bạn',
      lane: toPositiveInt(currentUserLane) || null,
      finishTimeSeconds: Number.isFinite(Number(myEntry?.finishTimeSeconds)) ? Number(myEntry.finishTimeSeconds) : null,
      replayPayload: null,
    },
    ...opponentSnapshot.selectedOpponents.map((entry: any) => ({
      kind: 'opponent',
      userId: Number(entry.userId || 0),
      displayName: toText(entry.displayName) || 'Runner',
      lane: toPositiveInt(entry.lane) || null,
      finishTimeSeconds: Number.isFinite(Number(entry.finishTimeSeconds)) ? Number(entry.finishTimeSeconds) : null,
      replayPayload: entry.replayPayload || null,
    })),
  ];

  const laneIssues: any[] = [];
  for (const item of lineupSeed) {
    if (!toPositiveInt(item.lane)) {
      laneIssues.push({
        userId: Number(item.userId || 0),
        displayName: toText(item.displayName) || '-',
        reason: 'missing_lane_assignment',
      });
    }
  }

  const sortedLineup = [...lineupSeed].sort((left: any, right: any) => {
    const leftPb = Number.isFinite(Number(left?.finishTimeSeconds)) ? Number(left.finishTimeSeconds) : Number.POSITIVE_INFINITY;
    const rightPb = Number.isFinite(Number(right?.finishTimeSeconds)) ? Number(right.finishTimeSeconds) : Number.POSITIVE_INFINITY;
    if (leftPb !== rightPb) return leftPb - rightPb;
    const leftIsPlayer = left.kind === 'player';
    const rightIsPlayer = right.kind === 'player';
    if (leftIsPlayer !== rightIsPlayer) return leftIsPlayer ? -1 : 1;
    return Number(left.userId || 0) - Number(right.userId || 0);
  });

  return {
    lineup: sortedLineup.map((item: any, index: number) => ({
      displayOrder: index + 1,
      kind: item.kind,
      userId: Number(item.userId || 0),
      displayName: toText(item.displayName) || '-',
      lane: toPositiveInt(item.lane) || null,
      finishTimeSeconds: Number.isFinite(Number(item.finishTimeSeconds)) ? Number(item.finishTimeSeconds) : null,
      replayPayload: item.kind === 'opponent' ? (item.replayPayload || null) : null,
      isSelf: item.kind === 'player',
    })),
    laneIssues,
    opponentSnapshot,
  };
}

function normalizeAttemptSummary(payload: any, game: any) {
  const replayPayload = toReplayPayloadOrNull(payload?.replayPayload);
  const replayMeta = toObjectOrNull(payload?.replayMeta);
  const finishTimeSeconds = toOptionalNumber(payload?.finishTimeSeconds ?? replayMeta?.finishTimeSeconds);
  const distanceMeters = toOptionalNumber(payload?.distanceMeters ?? replayMeta?.distanceMeters ?? replayMeta?.distance);
  const elapsedSeconds = toOptionalNumber(payload?.elapsedSeconds ?? replayMeta?.elapsedSeconds);
  const validSteps = toPositiveInt(payload?.validSteps ?? replayMeta?.validSteps ?? replayMeta?.stepCount) || 0;
  const averageSpeed = toOptionalNumber(payload?.averageSpeed ?? replayMeta?.averageSpeed);
  const averageCadence = toOptionalNumber(payload?.averageCadence ?? replayMeta?.averageCadence);
  const falseStart = toBoolean(payload?.falseStart ?? replayMeta?.falseStart);
  const didFinish = toBoolean(payload?.didFinish ?? replayMeta?.didFinish ?? (Number.isFinite(finishTimeSeconds) && Number(finishTimeSeconds) > 0));
  const settings = resolveGhostRaceSettings(game?.settings, game?.settings);

  return {
    replayPayload,
    replayMeta,
    finishTimeSeconds,
    distanceMeters: Number.isFinite(distanceMeters as number) ? Number(distanceMeters) : null,
    elapsedSeconds: Number.isFinite(elapsedSeconds as number) ? Number(elapsedSeconds) : null,
    validSteps,
    averageSpeed: Number.isFinite(averageSpeed as number) ? Number(averageSpeed) : null,
    averageCadence: Number.isFinite(averageCadence as number) ? Number(averageCadence) : null,
    falseStart,
    didFinish,
    settings,
  };
}

function verifyGhostRaceAttempt(summary: ReturnType<typeof normalizeAttemptSummary>) {
  if (summary.falseStart) {
    return { verificationStatus: 'rejected', status: 'false_start', reason: 'False start is not a valid finish attempt' };
  }
  if (!summary.didFinish) {
    return { verificationStatus: 'rejected', status: 'rejected', reason: 'Attempt did not finish the race' };
  }
  if (!hasValidGhostRaceReplayPayload(summary.replayPayload)) {
    return { verificationStatus: 'rejected', status: 'rejected', reason: 'Replay payload is missing or invalid' };
  }
  if (!Number.isFinite(summary.finishTimeSeconds) || Number(summary.finishTimeSeconds) <= 0) {
    return { verificationStatus: 'rejected', status: 'rejected', reason: 'Missing finish time' };
  }
  if (Number(summary.finishTimeSeconds) > Number(summary.settings.cutoffSeconds)) {
    return { verificationStatus: 'rejected', status: 'timeout', reason: 'Finish time exceeded configured cutoff' };
  }
  if (!Number.isFinite(summary.distanceMeters) || Number(summary.distanceMeters) + 0.01 < Number(summary.settings.distanceMeters)) {
    return { verificationStatus: 'rejected', status: 'rejected', reason: 'Distance is shorter than track requirement' };
  }
  return { verificationStatus: 'verified', status: 'verified', reason: null };
}

function normalizeClientPlatform(value: unknown): 'desktop' | 'mobile' | null {
  const normalized = toText(value).toLowerCase();
  if (normalized === 'mobile') return 'mobile';
  if (normalized === 'desktop') return 'desktop';
  return null;
}

function inferClientPlatform(payload: any): 'desktop' | 'mobile' | null {
  const explicit = normalizeClientPlatform(payload?.clientPlatform);
  if (explicit) return explicit;

  const userAgent = toText(payload?.userAgent).toLowerCase();
  if (userAgent) {
    if (/android|iphone|ipad|ipod|mobile|phone|tablet/i.test(userAgent)) return 'mobile';
    if (/windows nt|macintosh|x11|linux x86_64|cros/i.test(userAgent)) return 'desktop';
  }

  const maxTouchPoints = Number(payload?.deviceSignals?.maxTouchPoints ?? payload?.maxTouchPoints ?? 0);
  const coarsePointer = payload?.deviceSignals?.coarsePointer === true || payload?.coarsePointer === true;
  if (Number.isFinite(maxTouchPoints) && maxTouchPoints >= 2) return 'mobile';
  if (coarsePointer) return 'mobile';

  return null;
}

function assertGhostRacePlatformCompatible(settings: any, payload: any) {
  const expectedPlatform = normalizeGhostRacePlayPlatform(settings?.playPlatform);
  if (expectedPlatform === 'web') return;

  const detectedClientPlatform = inferClientPlatform(payload);
  if (!detectedClientPlatform) return;
  if (detectedClientPlatform === expectedPlatform) return;

  if (expectedPlatform === 'desktop') {
    httpError(409, 'Cuộc thi này dành cho máy tính. Vui lòng sử dụng máy tính để tham gia.');
  }
  httpError(409, 'Cuộc thi này dành cho điện thoại. Vui lòng mở trên điện thoại để tham gia.');
}

export async function getGhostRaceSession(gameId: unknown, tenantId: unknown, authUser: any) {
  const numericTenantId = requireNumericTenantId(tenantId);
  const numericUserId = toPositiveInt(authUser?.id);
  if (!numericUserId) httpError(401, 'Unauthorized');

  await requireTenantMember(numericUserId, numericTenantId);
  const game = await loadGameOrThrow(gameId, numericTenantId);
  ensureGhostRaceFeatureEnabled(game);
  await ensureTenantGameTypeEnabled(numericTenantId, game?.gameType?.id || extractRelationId(game?.gameType));
  const participant = await loadCurrentParticipantOrThrow(game, numericTenantId, numericUserId);
  const phaseCode = resolveGhostRacePhaseCode(game);
  const settings = resolveGhostRaceSettings(game?.settings, game?.settings);
  const runVersion = Number(game.currentRunVersion || 1);
  const raceLeaderboard = phaseCode
    ? await loadGhostRacePhaseLeaderboard(Number(game.id), numericTenantId, runVersion, phaseCode)
    : { entries: [], totalParticipantsWithAttempt: 0 };
  const displayName = resolveRunnerDisplayName(participant?.user || authUser, 'Bạn');
  const playerLane = toPositiveInt(participant?.laneNumber || participant?.settings?.laneNumber);
  const displayLineup = phaseCode
    ? buildAsyncRaceDisplayLineup({
      leaderboardEntries: raceLeaderboard.entries,
      currentUserId: numericUserId,
      currentUserLane: playerLane,
      currentUserDisplayName: displayName,
      maxOpponents: 5,
    })
    : { lineup: [], laneIssues: [], opponentSnapshot: { selectedOpponents: [], missingReplayParticipants: [] } };
  const opponentSnapshot = displayLineup.opponentSnapshot;
  const myRank = raceLeaderboard.entries.find((entry: any) => Number(entry.userId || 0) === numericUserId)?.rank || null;
  const myPersonalBest = raceLeaderboard.entries.find((entry: any) => Number(entry.userId || 0) === numericUserId) || null;

  return {
    game: formatGameRow(game, {
      currentParticipant: participant,
      tenantGameTypeEnabled: true,
    }),
    participant: formatParticipantRow(participant),
    raceConfig: settings,
    phaseCode,
    runVersion,
    raceContext: {
      playerLane: playerLane || null,
      lineup: displayLineup.lineup,
      opponents: opponentSnapshot.selectedOpponents,
      missingReplayParticipants: opponentSnapshot.missingReplayParticipants,
      laneIssues: displayLineup.laneIssues,
      maxOpponents: 5,
      summary: {
        totalRankedParticipants: raceLeaderboard.entries.length,
        totalParticipantsWithAttempt: raceLeaderboard.totalParticipantsWithAttempt,
        myRank,
      },
    },
    leaderboard: {
      phase: phaseCode,
      entries: raceLeaderboard.entries.map((entry: any) => ({
        rank: entry.rank,
        userId: entry.userId,
        displayName: entry.displayName,
        laneNumber: entry.laneNumber || null,
        finishTimeSeconds: entry.finishTimeSeconds,
        attemptCount: entry.attemptCount,
        hasReplay: entry.hasReplay,
      })),
      myPersonalBest: myPersonalBest
        ? {
          rank: myPersonalBest.rank,
          finishTimeSeconds: myPersonalBest.finishTimeSeconds,
          attemptCount: myPersonalBest.attemptCount,
        }
        : null,
    },
  };
}

export async function startGhostRaceAttempt(gameId: unknown, tenantId: unknown, authUser: any, payload: any) {
  const numericTenantId = requireNumericTenantId(tenantId);
  const numericUserId = toPositiveInt(authUser?.id);
  if (!numericUserId) httpError(401, 'Unauthorized');

  await requireTenantMember(numericUserId, numericTenantId);
  const game = await loadGameOrThrow(gameId, numericTenantId);
  ensureGhostRaceFeatureEnabled(game);
  await ensureTenantGameTypeEnabled(numericTenantId, game?.gameType?.id || extractRelationId(game?.gameType));
  const participant = await loadCurrentParticipantOrThrow(game, numericTenantId, numericUserId);
  const phaseCode = getGhostRacePhaseOrThrow(game);
  const now = getNow();
  const settings = resolveGhostRaceSettings(game?.settings, game?.settings);
  assertGhostRacePlatformCompatible(settings, payload);
  const runVersion = Number(game.currentRunVersion || 1);
  const raceLeaderboard = await loadGhostRacePhaseLeaderboard(Number(game.id), numericTenantId, runVersion, phaseCode);
  const displayName = resolveRunnerDisplayName(participant?.user || authUser, 'Bạn');
  const playerLane = toPositiveInt(participant?.laneNumber || participant?.settings?.laneNumber);
  const displayLineup = buildAsyncRaceDisplayLineup({
    leaderboardEntries: raceLeaderboard.entries,
    currentUserId: numericUserId,
    currentUserLane: playerLane,
    currentUserDisplayName: displayName,
    maxOpponents: 5,
  });
  const opponentSnapshot = displayLineup.opponentSnapshot;
  const myRankAtStart = raceLeaderboard.entries.find((entry: any) => Number(entry.userId || 0) === numericUserId)?.rank || null;
  const laneNumber = toPositiveInt(participant?.laneNumber || participant?.settings?.laneNumber);
  if (!laneNumber) {
    httpError(409, 'Participant lane is missing. Please re-register for this run');
  }

  const startedAt = phaseCode === 'official' ? toOptionalDate(game?.startsAt, 'startsAt') : toOptionalDate(game?.trialStartAt, 'trialStartAt');
  const endedAt = phaseCode === 'official' ? toOptionalDate(game?.endsAt, 'endsAt') : toOptionalDate(game?.trialEndAt, 'trialEndAt');
  if (startedAt && now.getTime() < startedAt.getTime()) {
    httpError(409, 'Race phase has not started yet');
  }
  if (endedAt && now.getTime() >= endedAt.getTime()) {
    httpError(409, 'Race phase has ended');
  }

  const countdownConfig = {
    onYourMarksMs: Math.max(100, Math.round(toPositiveNumber(payload?.countdown?.onYourMarksMs ?? settings.countdown.onYourMarksMs, 'countdown.onYourMarksMs'))),
    setMs: Math.max(100, Math.round(toPositiveNumber(payload?.countdown?.setMs ?? settings.countdown.setMs, 'countdown.setMs'))),
    goHoldMs: Math.max(100, Math.round(toPositiveNumber(payload?.countdown?.goHoldMs ?? settings.countdown.goHoldMs, 'countdown.goHoldMs'))),
  };
  const attemptToken = randomUUID();
  const created = await strapi.db.query(GHOST_RACE_ATTEMPT_UID).create({
    data: {
      tenant: numericTenantId,
      game: Number(game.id),
      participant: Number(participant.id),
      user: numericUserId,
      attemptToken,
      phase: phaseCode,
      runVersion,
      laneNumberSnapshot: laneNumber,
      engineVersion: toText(payload?.engineVersion) || 'ghost-race-engine-v1',
      physicsVersion: settings.physicsVersion,
      trackVersion: settings.trackVersion,
      rulesVersion: settings.rulesVersion,
      authorizedStartAt: now,
      cutoffSecondsSnapshot: settings.cutoffSeconds,
      distanceMeters: settings.distanceMeters,
      status: 'ready',
      verificationStatus: 'pending_verification',
      replayMeta: {
        countdown: countdownConfig,
        configuredCountdown: settings.countdown,
        requestedClientPlatform: normalizeClientPlatform(payload?.clientPlatform),
        requestedUserAgent: toText(payload?.userAgent) || null,
        requestedDeviceSignals: toObjectOrNull(payload?.deviceSignals),
        sessionClientId: toText(payload?.sessionClientId) || null,
        asyncRaceSnapshot: {
          phase: phaseCode,
          runVersion,
          playerLane: laneNumber,
          myRankAtStart,
          displayLineup: displayLineup.lineup.map((item: any) => ({
            displayOrder: item.displayOrder,
            kind: item.kind,
            userId: item.userId,
            displayName: item.displayName,
            lane: item.lane,
            finishTimeSeconds: item.finishTimeSeconds,
          })),
          opponents: opponentSnapshot.selectedOpponents.map((item: any) => ({
            lane: item.lane || null,
            userId: item.userId,
            displayName: item.displayName,
            rank: item.rank,
            finishTimeSeconds: item.finishTimeSeconds,
          })),
          generatedAt: now.toISOString(),
        },
      },
    },
  } as any);
  await syncShadowValues(strapi.db.connection, 'ghost_race_attempts', Number(created?.id || 0), {
    tenant_id: numericTenantId,
    game_id: Number(game.id),
    user_id: numericUserId,
    participant_id: Number(participant.id),
  });

  return {
    attemptId: Number(created?.id || 0),
    attemptToken,
    raceConfig: settings,
    phase: phaseCode,
    runVersion,
    laneNumber,
    status: toText(created?.status).toLowerCase() || 'ready',
    raceContext: {
      playerLane: laneNumber,
      lineup: displayLineup.lineup,
      opponents: opponentSnapshot.selectedOpponents,
      missingReplayParticipants: opponentSnapshot.missingReplayParticipants,
      laneIssues: displayLineup.laneIssues,
      maxOpponents: 5,
      summary: {
        totalRankedParticipants: raceLeaderboard.entries.length,
        totalParticipantsWithAttempt: raceLeaderboard.totalParticipantsWithAttempt,
        myRankAtStart,
      },
    },
  };
}

export async function submitGhostRaceAttempt(gameId: unknown, tenantId: unknown, authUser: any, payload: any) {
  const numericTenantId = requireNumericTenantId(tenantId);
  const numericUserId = toPositiveInt(authUser?.id);
  if (!numericUserId) httpError(401, 'Unauthorized');

  await requireTenantMember(numericUserId, numericTenantId);
  const game = await loadGameOrThrow(gameId, numericTenantId);
  ensureGhostRaceFeatureEnabled(game);
  const attemptId = toPositiveInt(payload?.attemptId);
  const attemptToken = toText(payload?.attemptToken);
  if (!attemptId || !attemptToken) {
    httpError(400, 'attemptId and attemptToken are required');
  }

  const attempt = await strapi.db.query(GHOST_RACE_ATTEMPT_UID).findOne({
    where: {
      id: attemptId,
      tenant: numericTenantId,
      game: Number(game.id),
      user: numericUserId,
      attemptToken,
    },
    select: ['id', 'status', 'phase', 'runVersion', 'verificationStatus', 'submittedAt', 'replayMeta'],
  } as any);
  if (!attempt?.id) {
    httpError(404, 'Attempt not found');
  }
  if (toText(attempt.status).toLowerCase() === 'verified') {
    return {
      attemptId: Number(attempt.id),
      verificationStatus: 'verified',
      status: 'verified',
      duplicate: true,
    };
  }

  const summary = normalizeAttemptSummary(payload, game);
  const verified = verifyGhostRaceAttempt(summary);
  const now = getNow();
  const updated = await strapi.db.query(GHOST_RACE_ATTEMPT_UID).update({
    where: { id: Number(attempt.id) },
    data: {
      status: verified.status,
      verificationStatus: verified.verificationStatus,
      verificationReason: verified.reason,
      submittedAt: now,
      finishTimeSeconds: summary.finishTimeSeconds,
      elapsedSeconds: summary.elapsedSeconds,
      distanceMeters: summary.distanceMeters,
      averageSpeed: summary.averageSpeed,
      averageCadence: summary.averageCadence,
      validSteps: summary.validSteps,
      invalidRepeatedPresses: toPositiveInt(payload?.invalidRepeatedPresses) || 0,
      replayMeta: summary.replayMeta,
      replayPayload: summary.replayPayload,
    },
  } as any);

  const phaseCode = toText(attempt.phase).toLowerCase() === 'trial' ? 'trial' : 'official';
  const runVersion = Number(attempt.runVersion || game.currentRunVersion || 1);
  const phaseLeaderboard = await loadGhostRacePhaseLeaderboard(Number(game.id), numericTenantId, runVersion, phaseCode);
  const myEntry = phaseLeaderboard.entries.find((entry: any) => Number(entry.userId || 0) === numericUserId) || null;
  const snapshotRank = toPositiveInt((attempt?.replayMeta as any)?.asyncRaceSnapshot?.myRankAtStart);
  const rankDelta = snapshotRank && myEntry?.rank ? snapshotRank - Number(myEntry.rank || 0) : null;

  return {
    attemptId: Number(updated?.id || attempt.id),
    status: verified.status,
    verificationStatus: verified.verificationStatus,
    verificationReason: verified.reason,
    leaderboard: {
      phase: phaseCode,
      myRank: myEntry?.rank || null,
      myPersonalBestSeconds: myEntry?.finishTimeSeconds || null,
      totalRankedParticipants: phaseLeaderboard.entries.length,
      rankDeltaFromStart: rankDelta,
    },
  };
}

export async function listMyGhostRaceAttempts(gameId: unknown, tenantId: unknown, authUser: any) {
  const numericTenantId = requireNumericTenantId(tenantId);
  const numericUserId = toPositiveInt(authUser?.id);
  if (!numericUserId) httpError(401, 'Unauthorized');

  await requireTenantMember(numericUserId, numericTenantId);
  const game = await loadGameOrThrow(gameId, numericTenantId);
  ensureGhostRaceFeatureEnabled(game);

  const rows = await strapi.db.query(GHOST_RACE_ATTEMPT_UID).findMany({
    where: {
      tenant: numericTenantId,
      game: Number(game.id),
      user: numericUserId,
      runVersion: Number(game.currentRunVersion || 1),
    },
    select: [
      'id',
      'phase',
      'runVersion',
      'status',
      'verificationStatus',
      'verificationReason',
      'finishTimeSeconds',
      'distanceMeters',
      'averageSpeed',
      'averageCadence',
      'validSteps',
      'createdAt',
      'submittedAt',
    ],
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    limit: 30,
  } as any);

  return rows || [];
}

export async function getMyGhostRacePersonalBest(gameId: unknown, tenantId: unknown, authUser: any) {
  const numericTenantId = requireNumericTenantId(tenantId);
  const numericUserId = toPositiveInt(authUser?.id);
  if (!numericUserId) httpError(401, 'Unauthorized');

  await requireTenantMember(numericUserId, numericTenantId);
  const game = await loadGameOrThrow(gameId, numericTenantId);
  ensureGhostRaceFeatureEnabled(game);
  const runVersion = Number(game.currentRunVersion || 1);
  const phaseCode = resolveGhostRacePhaseCode(game);
  if (!phaseCode) {
    return {
      gameId: Number(game.id),
      runVersion,
      phase: null,
      personalBest: null,
    };
  }

  const rows = await strapi.db.connection('ghost_race_attempts')
    .leftJoin('ghost_race_attempts_tenant_lnk as grat', 'grat.ghost_race_attempt_id', 'ghost_race_attempts.id')
    .leftJoin('ghost_race_attempts_game_lnk as grag', 'grag.ghost_race_attempt_id', 'ghost_race_attempts.id')
    .leftJoin('ghost_race_attempts_user_lnk as grau', 'grau.ghost_race_attempt_id', 'ghost_race_attempts.id')
    .whereRaw('COALESCE(ghost_race_attempts.tenant_id, grat.tenant_id) = ?', [numericTenantId])
    .whereRaw('COALESCE(ghost_race_attempts.game_id, grag.game_id) = ?', [Number(game.id)])
    .whereRaw('COALESCE(ghost_race_attempts.user_id, grau.user_id) = ?', [numericUserId])
    .where({
      run_version: runVersion,
      phase: phaseCode,
      status: 'verified',
      verification_status: 'verified',
    })
    .whereNotNull('finish_time_seconds')
    .orderBy([{ column: 'finish_time_seconds', order: 'asc' }, { column: 'ghost_race_attempts.id', order: 'asc' }])
    .limit(1);
  const best = rows?.[0] || null;

  return {
    gameId: Number(game.id),
    runVersion,
    phase: phaseCode,
    personalBest: best
      ? {
        attemptId: Number(best.id),
        finishTimeSeconds: Number(best.finish_time_seconds),
        distanceMeters: Number(best.distance_meters || 0),
        phase: toText(best.phase),
        createdAt: best.created_at || null,
      }
      : null,
  };
}

export async function registerCurrentUserForGame(gameId: unknown, tenantId: unknown, authUser: any) {
  const numericTenantId = requireNumericTenantId(tenantId);
  const numericUserId = toPositiveInt(authUser?.id);
  if (!numericUserId) {
    httpError(401, 'Unauthorized');
  }

  await requireTenantMember(numericUserId, numericTenantId);
  const game = await loadGameOrThrow(gameId, numericTenantId);
  const currentRunVersion = Number(game.currentRunVersion || 1);
  const gameTypeCode = toText(game?.gameType?.code).toLowerCase();
  const tenantGameType = await ensureTenantGameTypeEnabled(numericTenantId, game?.gameType?.id || extractRelationId(game?.gameType));
  const registrationState = buildRegistrationState(game, tenantGameType?.isEnabled === true, null);

  if (!registrationState.canRegister) {
    httpError(409, registrationState.reason || 'Registration is not available');
  }

  try {
    const participant = await strapi.db.connection.transaction(async (trx: any) => {
      const existing = await strapi.db.query(GAME_PARTICIPANT_UID).findOne({
        where: mergeTenantWhere({
          game: Number(game.id),
          user: numericUserId,
          runVersion: currentRunVersion,
        }, numericTenantId),
        select: ['id', 'status', 'registeredAt', 'lastActiveAt', 'totalXp', 'trialXp', 'officialXp', 'rankScore', 'settings'],
        populate: {
          user: {
            select: ['id', 'username', 'email', 'fullName'],
          },
        },
        transacting: trx,
      } as any);

      if (existing?.id) {
        const existingSettings = toObjectOrNull(existing?.settings);
        if (isGhostRaceGameType(gameTypeCode) && !toPositiveInt(existingSettings?.laneNumber)) {
          const stableLane = await loadStableLaneNumberForUser(Number(game.id), numericUserId, trx);
          const nextLane = await reserveNextGhostRaceLane(trx, Number(game.id), currentRunVersion, stableLane);
          const patched = await strapi.db.query(GAME_PARTICIPANT_UID).update({
            where: { id: Number(existing.id) },
            data: {
              settings: {
                ...(existingSettings || {}),
                laneNumber: nextLane,
                laneAssignedAt: getNow().toISOString(),
              },
            },
            populate: {
              user: {
                select: ['id', 'username', 'email', 'fullName'],
              },
            },
            transacting: trx,
          } as any);
          return { created: false, participant: patched };
        }
        return { created: false, participant: existing };
      }

      const participantSettings = isGhostRaceGameType(gameTypeCode)
        ? {
          laneNumber: await reserveNextGhostRaceLane(
            trx,
            Number(game.id),
            currentRunVersion,
            await loadStableLaneNumberForUser(Number(game.id), numericUserId, trx),
          ),
          laneAssignedAt: getNow().toISOString(),
        }
        : null;

      const created = await strapi.db.query(GAME_PARTICIPANT_UID).create({
        data: {
          tenant: numericTenantId,
          game: Number(game.id),
          user: numericUserId,
          status: 'active',
          runVersion: currentRunVersion,
          registeredAt: getNow(),
          totalXp: 0,
          trialXp: 0,
          officialXp: 0,
          rankScore: 0,
          settings: participantSettings,
        },
        populate: {
          user: {
            select: ['id', 'username', 'email', 'fullName'],
          },
        },
        transacting: trx,
      } as any);

      await syncShadowValues(trx, 'game_participants', Number(created.id), {
        tenant_id: numericTenantId,
        game_id: Number(game.id),
        user_id: numericUserId,
      });

      return { created: true, participant: created };
    });

    return {
      created: participant.created,
      participant: formatParticipantRow(participant.participant),
    };
  } catch (error: any) {
    if (isUniqueConstraintError(error)) {
      const existing = await strapi.db.query(GAME_PARTICIPANT_UID).findOne({
        where: mergeTenantWhere({
          game: Number(game.id),
          user: numericUserId,
          runVersion: currentRunVersion,
        }, numericTenantId),
        select: ['id', 'status', 'registeredAt', 'lastActiveAt', 'totalXp', 'trialXp', 'officialXp', 'rankScore', 'settings'],
        populate: {
          user: {
            select: ['id', 'username', 'email', 'fullName'],
          },
        },
      });

      if (existing?.id) {
        const existingSettings = toObjectOrNull(existing?.settings);
        if (isGhostRaceGameType(gameTypeCode) && !toPositiveInt(existingSettings?.laneNumber)) {
          const lane = await strapi.db.connection.transaction(async (trx: any) => {
            const stableLane = await loadStableLaneNumberForUser(Number(game.id), numericUserId, trx);
            const nextLane = await reserveNextGhostRaceLane(trx, Number(game.id), currentRunVersion, stableLane);
            await strapi.db.query(GAME_PARTICIPANT_UID).update({
              where: { id: Number(existing.id) },
              data: {
                settings: {
                  ...(existingSettings || {}),
                  laneNumber: nextLane,
                  laneAssignedAt: getNow().toISOString(),
                },
              },
              transacting: trx,
            } as any);
            return nextLane;
          });
          existing.settings = {
            ...(existingSettings || {}),
            laneNumber: lane,
          };
        }
        return {
          created: false,
          participant: formatParticipantRow(existing),
        };
      }
    }

    throw error;
  }
}

export {
  GameManagementError,
  getGameManagementErrorStatus,
  requireAuthenticatedUser,
};
