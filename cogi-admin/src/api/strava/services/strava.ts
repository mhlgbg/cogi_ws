import crypto from 'node:crypto';
import { mergeTenantWhere, resolveCurrentTenantId, toText as normalizeTenantText } from '../../../utils/tenant-scope';

const STRAVA_CONNECTION_UID = 'api::strava-connection.strava-connection';
const STRAVA_OAUTH_STATE_UID = 'api::strava-oauth-state.strava-oauth-state';
const STRAVA_ACTIVITY_UID = 'api::strava-activity.strava-activity';
const STRAVA_SYNC_JOB_UID = 'api::strava-sync-job.strava-sync-job';
const USER_UID = 'plugin::users-permissions.user';
const OAUTH_STATE_TTL_MS = 10 * 60 * 1000;
const STRAVA_AUTHORIZE_URL = 'https://www.strava.com/oauth/authorize';
const STRAVA_TOKEN_URL = 'https://www.strava.com/oauth/token';
const STRAVA_ACTIVITIES_URL = 'https://www.strava.com/api/v3/athlete/activities';
const ACCESS_TOKEN_REFRESH_THRESHOLD_MS = 60 * 1000;
const INCREMENTAL_BACKTRACK_MS = 24 * 60 * 60 * 1000;
const ACTIVITY_PAGE_SIZE = 100;
const DEFAULT_MAX_RETRIES = 5;
const DEFAULT_RETRY_BASE_SECONDS = 30;
const DEFAULT_RETRY_MAX_SECONDS = 15 * 60;
const DEFAULT_STRAVA_SUCCESS_REDIRECT_PATH = '/fitness?connected=1';
const DEFAULT_STRAVA_ERROR_REDIRECT_PATH = '/fitness?error=1';

type JobStatus = 'queued' | 'running' | 'partial_ready' | 'completed' | 'failed' | 'cancelled';
type JobPhase = 'preparing' | 'syncing_recent' | 'syncing_history' | 'rebuilding_snapshot' | 'finalizing';
type JobSyncMode = 'initial' | 'incremental' | 'retry';

type AuthUser = {
  id: number;
  email?: string | null;
  username?: string | null;
  blocked?: boolean | null;
};

type SignedStatePayload = {
  tenantId: string;
  userId: number;
  nonce: string;
  issuedAt: number;
};

type VerifiedOAuthState = {
  tenantId: number | string;
  userId: number;
  nonce: string;
  issuedAt: number;
  recordId: number;
  frontendOrigin: string | null;
};

type StravaTokenResponse = {
  token_type?: string;
  access_token?: string;
  refresh_token?: string;
  expires_at?: number;
  expires_in?: number;
  athlete?: Record<string, any>;
  scope?: string;
};

type StravaConnectionRecord = {
  id: number;
  status?: string | null;
  accessToken?: string | null;
  refreshToken?: string | null;
  tokenExpiresAt?: string | null;
  lastSyncAt?: string | null;
  lastSyncStatus?: string | null;
  athleteFirstname?: string | null;
  athleteLastname?: string | null;
  athleteUsername?: string | null;
  profileUrl?: string | null;
};

type StravaSyncJobRecord = {
  id: number;
  status?: JobStatus | string | null;
  phase?: JobPhase | string | null;
  syncMode?: JobSyncMode | string | null;
  currentPage?: number | null;
  perPage?: number | null;
  oldestSyncedAt?: string | null;
  newestSyncedAt?: string | null;
  processedActivities?: number | null;
  createdActivities?: number | null;
  updatedActivities?: number | null;
  skippedActivities?: number | null;
  failedActivities?: number | null;
  heartbeatAt?: string | null;
  retryCount?: number | null;
  requestedAt?: string | null;
  startedAt?: string | null;
  completedAt?: string | null;
  failedAt?: string | null;
  cancelledAt?: string | null;
  claimedAt?: string | null;
  claimedBy?: string | null;
  nextRetryAt?: string | null;
  lastErrorCode?: string | null;
  lastErrorMessage?: string | null;
  metadata?: Record<string, any> | null;
  tenant?: { id?: number | string } | number | string | null;
  user?: { id?: number } | number | null;
  connection?: { id?: number } | number | null;
};

type PersistActivityCounters = {
  processed: number;
  created: number;
  updated: number;
  skipped: number;
  failed: number;
  newestSyncedAt: string | null;
  oldestSyncedAt: string | null;
  lastProcessedActivityId: string | null;
};

type StravaBatchResult = {
  ok: boolean;
  jobId: number;
  status: JobStatus;
  phase: JobPhase;
  waitForRetry?: boolean;
  completed?: boolean;
  exhausted?: boolean;
  counters?: PersistActivityCounters;
  summary?: Record<string, unknown>;
};

type StravaSyncJobStartResult = {
  job: StravaSyncJobRecord;
  created: boolean;
  alreadyRunning: boolean;
};

type AnalyticsSyncState = {
  status: JobStatus | 'idle';
  phase: JobPhase | null;
  syncMode: JobSyncMode | null;
  isDataComplete: boolean;
  dataState: 'none' | 'partial' | 'complete';
  currentSyncJobId: number | null;
  lastCompletedSyncAt: string | null;
  recentReadyAt: string | null;
  builtAt: string | null;
};

type StravaSyncErrorCategory =
  | 'rate_limit'
  | 'network'
  | 'strava_5xx'
  | 'auth_expired'
  | 'auth_revoked'
  | 'permission'
  | 'database_transient'
  | 'database_permanent'
  | 'validation'
  | 'context_invalid'
  | 'snapshot'
  | 'cancelled'
  | 'unknown';

type StravaSyncErrorClassification = {
  code: string;
  message: string;
  retryable: boolean;
  retryAfter: string | null;
  httpStatus: number | null;
  category: StravaSyncErrorCategory;
};

type SyncMode = 'incremental' | 'full';

export function toText(value: unknown): string {
  return normalizeTenantText(value);
}

function toPositiveInt(value: unknown): number | null {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

function trimTrailingSlash(value: string): string {
  return value.replace(/\/+$/, '');
}

function isNonProductionEnvironment() {
  return toText(process.env.NODE_ENV).toLowerCase() !== 'production';
}

function normalizeAbsoluteOrigin(value: unknown): string | null {
  const text = toText(value);
  if (!text) return null;

  try {
    const parsed = new URL(text);
    if (!['http:', 'https:'].includes(parsed.protocol)) return null;
    return `${parsed.protocol}//${parsed.host}`;
  } catch {
    return null;
  }
}

function normalizeAbsoluteUrl(value: unknown): string | null {
  const text = toText(value);
  if (!text) return null;

  try {
    const parsed = new URL(text);
    if (!['http:', 'https:'].includes(parsed.protocol)) return null;
    parsed.hash = '';
    return parsed.toString();
  } catch {
    return null;
  }
}

function normalizeHost(value: unknown): string {
  const origin = normalizeAbsoluteOrigin(value);
  if (origin) {
    try {
      return new URL(origin).hostname.toLowerCase();
    } catch {
      return '';
    }
  }

  const text = toText(value).toLowerCase().replace(/^https?:\/\//, '');
  const firstHost = text.split('/')[0]?.split(',')[0]?.trim() || '';
  if (!firstHost) return '';
  if (firstHost.startsWith('[')) {
    const endBracketIndex = firstHost.indexOf(']');
    return endBracketIndex > 0 ? firstHost.slice(1, endBracketIndex) : firstHost;
  }
  const colonIndex = firstHost.indexOf(':');
  return colonIndex > -1 ? firstHost.slice(0, colonIndex) : firstHost;
}

function isLocalHost(value: unknown) {
  const host = normalizeHost(value);
  return host === 'localhost' || host === '127.0.0.1' || host === '::1';
}

function readRequestOrigin(ctx: any): string {
  return toText(ctx?.request?.header?.origin || ctx?.request?.headers?.origin || '');
}

function readRequestReferer(ctx: any): string {
  return toText(ctx?.request?.header?.referer || ctx?.request?.headers?.referer || '');
}

function readRequestHost(ctx: any): string {
  const forwardedHost = ctx?.request?.headers?.['x-forwarded-host'];
  const rawHost = Array.isArray(forwardedHost)
    ? forwardedHost[0]
    : forwardedHost || ctx?.request?.host || ctx?.host || '';
  return toText(rawHost);
}

function readRequestProtocol(ctx: any, host: string): 'http' | 'https' {
  const forwardedProto = ctx?.request?.headers?.['x-forwarded-proto'];
  const rawProto = Array.isArray(forwardedProto) ? forwardedProto[0] : forwardedProto;
  const protocol = toText(rawProto || ctx?.request?.protocol || ctx?.protocol || '').toLowerCase();
  if (protocol === 'http' || protocol === 'https') return protocol;
  return isLocalHost(host) ? 'http' : 'https';
}

function getConfiguredFrontendFallbackOrigin(): string | null {
  return normalizeAbsoluteOrigin(process.env.FRONTEND_URL);
}

async function listActiveTenantDomains(tenantId: number | string): Promise<Array<{ domain: string; isPrimary: boolean }>> {
  const rows = await strapi.db.query('api::tenant-domain.tenant-domain').findMany({
    where: {
      tenant: tenantId,
      tenantDomainStatus: 'active',
    },
    select: ['domain', 'isPrimary'],
    orderBy: [{ isPrimary: 'desc' }, { id: 'asc' }],
  });

  return (rows || []).map((row: any) => ({
    domain: normalizeHost(row?.domain),
    isPrimary: row?.isPrimary === true,
  })).filter((row: { domain: string }) => Boolean(row.domain));
}

function buildOriginFromDomain(domain: string): string | null {
  const host = normalizeHost(domain);
  if (!host) return null;
  return `${isLocalHost(host) ? 'http' : 'https'}://${host}`;
}

async function resolvePrimaryTenantFrontendOrigin(tenantId: number | string): Promise<string | null> {
  const domains = await listActiveTenantDomains(tenantId);
  const primary = domains.find((item) => item.isPrimary) || domains[0] || null;
  return primary?.domain ? buildOriginFromDomain(primary.domain) : null;
}

async function isTrustedTenantFrontendOrigin(frontendOrigin: unknown, tenantId: number | string): Promise<boolean> {
  const normalizedOrigin = normalizeAbsoluteOrigin(frontendOrigin);
  if (!normalizedOrigin) return false;

  const host = normalizeHost(normalizedOrigin);
  if (!host) return false;

  const domains = await listActiveTenantDomains(tenantId);
  if (domains.some((item) => item.domain === host)) return true;

  const frontendFallbackOrigin = getConfiguredFrontendFallbackOrigin();
  if (isNonProductionEnvironment() && frontendFallbackOrigin && normalizedOrigin === frontendFallbackOrigin) {
    return true;
  }

  return false;
}

function collectPotentialFrontendOrigins(ctx: any): string[] {
  const candidates = [
    normalizeAbsoluteOrigin(readRequestOrigin(ctx)),
    normalizeAbsoluteOrigin(readRequestReferer(ctx)),
  ].filter(Boolean) as string[];

  const host = readRequestHost(ctx);
  if (host) {
    candidates.push(`${readRequestProtocol(ctx, host)}://${host}`);
  }

  return [...new Set(candidates.map((item) => trimTrailingSlash(item)))];
}

export async function resolveTrustedFrontendOriginForOAuthStart(ctx: any, tenantId: number | string): Promise<string> {
  const domains = await listActiveTenantDomains(tenantId);
  const allowedHosts = new Set(domains.map((item) => item.domain));
  const frontendFallbackOrigin = getConfiguredFrontendFallbackOrigin();

  for (const candidate of collectPotentialFrontendOrigins(ctx)) {
    const candidateOrigin = normalizeAbsoluteOrigin(candidate);
    const candidateHost = normalizeHost(candidateOrigin);
    if (!candidateOrigin || !candidateHost) continue;

    if (allowedHosts.has(candidateHost)) {
      return trimTrailingSlash(candidateOrigin);
    }

    if (isNonProductionEnvironment() && frontendFallbackOrigin && candidateOrigin === frontendFallbackOrigin) {
      return trimTrailingSlash(candidateOrigin);
    }
  }

  const primaryTenantOrigin = domains.find((item) => item.isPrimary)?.domain
    ? buildOriginFromDomain(domains.find((item) => item.isPrimary)?.domain || '')
    : null;
  if (primaryTenantOrigin) {
    return trimTrailingSlash(primaryTenantOrigin);
  }

  if (frontendFallbackOrigin && isNonProductionEnvironment()) {
    return trimTrailingSlash(frontendFallbackOrigin);
  }

  throw Object.assign(new Error('Không thể xác định frontend origin đáng tin cậy cho tenant hiện tại.'), {
    code: 'STRAVA_FRONTEND_ORIGIN_UNRESOLVED',
    status: 500,
  });
}

function validateInternalRedirectPath(path: unknown, fallback: string): string {
  const safeFallback = toText(fallback).startsWith('/') ? toText(fallback).trim() : DEFAULT_STRAVA_SUCCESS_REDIRECT_PATH;
  const candidate = toText(path);
  const normalized = candidate || safeFallback;

  if (!normalized.startsWith('/') || normalized.startsWith('//') || normalized.includes('\\')) {
    return safeFallback;
  }

  if (/^[a-z][a-z0-9+.-]*:/i.test(normalized)) {
    return safeFallback;
  }

  try {
    const dummyBase = 'https://tenant.example';
    const parsed = new URL(normalized, `${dummyBase}/`);
    if (parsed.origin !== dummyBase) return safeFallback;
    return `${parsed.pathname}${parsed.search}`;
  } catch {
    return safeFallback;
  }
}

function mergeRedirectQuery(url: URL, query: Record<string, string>) {
  for (const [key, value] of Object.entries(query)) {
    const normalizedValue = toText(value);
    if (normalizedValue) {
      url.searchParams.set(key, normalizedValue);
    }
  }
}

function buildTenantFrontendRedirect(options: {
  frontendOrigin: string;
  path: string;
  query?: Record<string, string>;
}): string {
  const normalizedOrigin = normalizeAbsoluteOrigin(options.frontendOrigin);
  if (!normalizedOrigin) {
    throw Object.assign(new Error('Invalid frontend origin'), { code: 'STRAVA_FRONTEND_ORIGIN_INVALID', status: 500 });
  }

  const safePath = validateInternalRedirectPath(options.path, DEFAULT_STRAVA_SUCCESS_REDIRECT_PATH);
  const url = new URL(safePath, `${normalizedOrigin}/`);
  mergeRedirectQuery(url, options.query || {});
  if (url.origin !== normalizedOrigin) {
    throw Object.assign(new Error('Unsafe frontend redirect origin'), { code: 'STRAVA_FRONTEND_REDIRECT_INVALID', status: 500 });
  }
  url.hash = '';
  return url.toString();
}

function isAllowedAbsoluteRedirectOrigin(origin: string, tenantAllowedOrigins: Set<string>): boolean {
  if (isNonProductionEnvironment()) return true;
  if (tenantAllowedOrigins.has(origin)) return true;

  const frontendFallbackOrigin = getConfiguredFrontendFallbackOrigin();
  return Boolean(frontendFallbackOrigin && frontendFallbackOrigin === origin);
}

function resolveConfiguredFrontendRedirectTarget(
  value: unknown,
  fallbackPath: string,
  tenantAllowedOrigins: Set<string>,
): { absoluteUrl: string | null; path: string | null } {
  const raw = toText(value);
  const absoluteUrl = normalizeAbsoluteUrl(raw);
  if (absoluteUrl) {
    const absoluteOrigin = normalizeAbsoluteOrigin(absoluteUrl);
    if (absoluteOrigin && isAllowedAbsoluteRedirectOrigin(absoluteOrigin, tenantAllowedOrigins)) {
      return { absoluteUrl, path: null };
    }
  }

  return {
    absoluteUrl: null,
    path: validateInternalRedirectPath(raw, fallbackPath),
  };
}

function resolveStravaScopes(): string {
  return toText(process.env.STRAVA_SCOPES) || 'read,activity:read';
}

function resolveFrontendSuccessUrl(): string {
  const url = toText(process.env.STRAVA_FRONTEND_REDIRECT_SUCCESS);
  if (!url) {
    return DEFAULT_STRAVA_SUCCESS_REDIRECT_PATH;
  }

  return url;
}

function resolveFrontendErrorUrl(): string {
  const url = toText(process.env.STRAVA_FRONTEND_REDIRECT_ERROR);
  if (!url) {
    return DEFAULT_STRAVA_ERROR_REDIRECT_PATH;
  }

  return url;
}

function resolveStravaClientId(): string {
  const value = toText(process.env.STRAVA_CLIENT_ID);
  if (!value) {
    throw Object.assign(new Error('STRAVA_CLIENT_ID is not configured'), { status: 500 });
  }

  return value;
}

function resolveStravaClientSecret(): string {
  const value = toText(process.env.STRAVA_CLIENT_SECRET);
  if (!value) {
    throw Object.assign(new Error('STRAVA_CLIENT_SECRET is not configured'), { status: 500 });
  }

  return value;
}

function resolveStravaRedirectUri(): string {
  const value = toText(process.env.STRAVA_REDIRECT_URI);
  if (!value) {
    throw Object.assign(new Error('STRAVA_REDIRECT_URI is not configured'), { status: 500 });
  }

  return value;
}

function resolveStateSigningSecret(): string {
  const explicitJwtSecret = toText(process.env.JWT_SECRET);
  if (explicitJwtSecret) return explicitJwtSecret;

  const appKeys = (strapi as any).config?.get?.('server.app.keys');
  if (Array.isArray(appKeys) && typeof appKeys[0] === 'string' && appKeys[0].trim()) {
    return appKeys[0].trim();
  }

  if (typeof appKeys === 'string' && appKeys.trim()) {
    return appKeys.split(',')[0].trim();
  }

  const fallbackSecret = toText(process.env.ADMIN_JWT_SECRET);
  if (fallbackSecret) return fallbackSecret;

  throw Object.assign(new Error('No secret available to sign Strava OAuth state'), { status: 500 });
}

function encodePayload(payload: SignedStatePayload): string {
  return Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
}

function decodePayload(encodedPayload: string): SignedStatePayload {
  return JSON.parse(Buffer.from(encodedPayload, 'base64url').toString('utf8')) as SignedStatePayload;
}

function signPayload(encodedPayload: string): string {
  return crypto.createHmac('sha256', resolveStateSigningSecret()).update(encodedPayload).digest('base64url');
}

function computeStateHash(state: string): string {
  return crypto.createHash('sha256').update(state).digest('hex');
}

async function findStravaOAuthStateRecordByState(state: string) {
  const trimmedState = toText(state);
  if (!trimmedState) return null;

  const stateHash = computeStateHash(trimmedState);
  return strapi.db.query(STRAVA_OAUTH_STATE_UID).findOne({
    where: { stateHash },
    select: ['id', 'nonce', 'expiresAt', 'usedAt', 'frontendOrigin'],
    populate: {
      tenant: {
        select: ['id'],
      },
      user: {
        select: ['id'],
      },
    },
  });
}

async function resolveFrontendOriginForCallbackFallback(state: unknown): Promise<{ tenantId: number | string | null; frontendOrigin: string | null }> {
  const record = await findStravaOAuthStateRecordByState(toText(state));
  const tenantId = toText(record?.tenant?.id || record?.tenant || '') || null;
  const storedFrontendOrigin = normalizeAbsoluteOrigin(record?.frontendOrigin || '') || null;

  if (tenantId && storedFrontendOrigin && await isTrustedTenantFrontendOrigin(storedFrontendOrigin, tenantId)) {
    return { tenantId, frontendOrigin: storedFrontendOrigin };
  }

  if (tenantId) {
    const primaryTenantOrigin = await resolvePrimaryTenantFrontendOrigin(tenantId);
    if (primaryTenantOrigin) {
      return { tenantId, frontendOrigin: trimTrailingSlash(primaryTenantOrigin) };
    }
  }

  const frontendFallbackOrigin = getConfiguredFrontendFallbackOrigin();
  if (frontendFallbackOrigin) {
    return { tenantId, frontendOrigin: trimTrailingSlash(frontendFallbackOrigin) };
  }

  return { tenantId, frontendOrigin: null };
}

function buildUrlWithQuery(baseUrl: string, query: Record<string, string>): string {
  const url = new URL(baseUrl);
  for (const [key, value] of Object.entries(query)) {
    if (value) {
      url.searchParams.set(key, value);
    }
  }
  return url.toString();
}

function normalizeSyncMode(value: unknown): SyncMode {
  return toText(value).toLowerCase() === 'full' ? 'full' : 'incremental';
}

function getSafeSyncErrorMessage(error: unknown, fallback = 'Strava sync failed') {
  const message = toText((error as any)?.message || '');
  if (!message) return fallback;
  return message;
}

function normalizeVisibility(value: unknown): 'PRIVATE' | 'SHARED_WITH_GROUP' | 'PUBLIC' {
  const normalized = toText(value).toLowerCase();
  if (normalized === 'public' || normalized === 'everyone') return 'PUBLIC';
  if (normalized === 'followers_only' || normalized === 'shared_with_group') return 'SHARED_WITH_GROUP';
  return 'PRIVATE';
}

function toIsoDateTime(value: unknown): string | null {
  const raw = toText(value);
  if (!raw) return null;
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString();
}

function resolveStravaSyncBatchSize(): number {
  const parsed = Number(process.env.STRAVA_SYNC_BATCH_SIZE || ACTIVITY_PAGE_SIZE);
  if (!Number.isInteger(parsed) || parsed <= 0) return ACTIVITY_PAGE_SIZE;
  return Math.min(200, parsed);
}

function resolveStravaInitialRecentActivityLimit(): number {
  const parsed = Number(process.env.STRAVA_INITIAL_RECENT_ACTIVITY_LIMIT || 200);
  if (!Number.isInteger(parsed) || parsed <= 0) return 200;
  return Math.max(parsed, resolveStravaSyncBatchSize());
}

function resolveStravaSyncMaxRetries(): number {
  const parsed = Number(process.env.STRAVA_SYNC_MAX_RETRIES || DEFAULT_MAX_RETRIES);
  if (!Number.isInteger(parsed) || parsed <= 0) return DEFAULT_MAX_RETRIES;
  return parsed;
}

function resolveStravaRetryBaseSeconds(): number {
  const parsed = Number(process.env.STRAVA_SYNC_RETRY_BASE_SECONDS || DEFAULT_RETRY_BASE_SECONDS);
  if (!Number.isFinite(parsed) || parsed <= 0) return DEFAULT_RETRY_BASE_SECONDS;
  return Math.floor(parsed);
}

function resolveStravaRetryMaxSeconds(): number {
  const parsed = Number(process.env.STRAVA_SYNC_RETRY_MAX_SECONDS || DEFAULT_RETRY_MAX_SECONDS);
  if (!Number.isFinite(parsed) || parsed <= 0) return DEFAULT_RETRY_MAX_SECONDS;
  return Math.max(Math.floor(parsed), resolveStravaRetryBaseSeconds());
}

function normalizeRetryAt(value: unknown): string | null {
  const text = toText(value);
  if (text) {
    const iso = toIsoDateTime(text);
    if (iso) return iso;
  }

  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric <= 0) return null;
  const ms = numeric > 1_000_000_000_000 ? numeric : numeric * 1000;
  const date = new Date(ms);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function isTransientNetworkError(error: unknown) {
  const code = toText((error as any)?.code || (error as any)?.cause?.code || '').toUpperCase();
  const name = toText((error as any)?.name || '').toUpperCase();
  const message = toText((error as any)?.message || '').toUpperCase();
  return [
    'ECONNRESET',
    'ECONNREFUSED',
    'ETIMEDOUT',
    'ESOCKETTIMEDOUT',
    'UND_ERR_CONNECT_TIMEOUT',
    'UND_ERR_HEADERS_TIMEOUT',
    'UND_ERR_SOCKET',
    'ENOTFOUND',
    'EAI_AGAIN',
    'ECONNABORTED',
  ].includes(code)
    || name === 'ABORTERROR'
    || message.includes('SOCKET HANG UP')
    || message.includes('FETCH FAILED')
    || message.includes('NETWORK')
    || message.includes('TIMEOUT');
}

function isTransientDatabaseError(error: unknown) {
  const code = toText((error as any)?.code || '').toUpperCase();
  const errno = toText((error as any)?.errno || '').toUpperCase();
  const message = toText((error as any)?.message || '').toLowerCase();
  return [
    '40P01',
    '40001',
    '55P03',
    '57014',
    'ETIMEDOUT',
    'ECONNRESET',
    'ECONNREFUSED',
  ].includes(code)
    || ['40P01', '40001', '55P03', '57014'].includes(errno)
    || message.includes('deadlock')
    || message.includes('lock timeout')
    || message.includes('could not serialize access')
    || message.includes('connection terminated unexpectedly')
    || message.includes('connection timeout')
    || message.includes('too many clients')
    || message.includes('temporarily unavailable');
}

function isPermanentDatabaseError(error: unknown) {
  const message = toText((error as any)?.message || '').toLowerCase();
  return message.includes('violates')
    || message.includes('constraint')
    || message.includes('column')
    || message.includes('relation')
    || message.includes('syntax error');
}

function buildStravaSyncClientMessage(code: string, fallback = '') {
  const normalized = toText(code).toUpperCase();
  if (normalized === 'STRAVA_RATE_LIMITED') return 'Strava đang tạm giới hạn số lần truy cập. Hệ thống sẽ tự tiếp tục sau.';
  if (normalized === 'STRAVA_CONNECTION_REVOKED') return 'Kết nối Strava không còn hiệu lực. Vui lòng kết nối lại.';
  if (normalized === 'STRAVA_TOKEN_REFRESH_FAILED') return 'Không thể gia hạn kết nối Strava. Vui lòng kết nối lại.';
  if (normalized === 'STRAVA_SCOPE_MISSING') return 'Tài khoản Strava chưa cấp đủ quyền truy cập. Vui lòng kết nối lại.';
  if (normalized === 'STRAVA_NETWORK_ERROR') return 'Kết nối tới Strava đang gián đoạn. Hệ thống sẽ tự thử lại.';
  if (normalized === 'STRAVA_SERVICE_UNAVAILABLE') return 'Dịch vụ Strava đang tạm thời không sẵn sàng.';
  if (normalized === 'STRAVA_SNAPSHOT_REBUILD_FAILED' || normalized === 'STRAVA_SNAPSHOT_WRITE_FAILED') return 'Dữ liệu đã được đồng bộ nhưng chưa thể hoàn thiện thống kê.';
  if (normalized === 'STRAVA_DATABASE_TRANSIENT_ERROR') return 'Hệ thống đang tạm gián đoạn khi lưu dữ liệu và sẽ tự thử lại.';
  if (normalized === 'STRAVA_DATABASE_PERMANENT_ERROR') return 'Hệ thống chưa thể lưu dữ liệu Strava do lỗi cấu hình nội bộ.';
  if (normalized === 'STRAVA_NOT_CONNECTED') return 'Bạn chưa kết nối tài khoản Strava.';
  if (normalized === 'STRAVA_SYNC_CANCELLED') return 'Đồng bộ Strava đã bị hủy.';
  if (normalized === 'STRAVA_SNAPSHOT_CONTEXT_INVALID' || normalized === 'STRAVA_SYNC_JOB_CONTEXT_INVALID' || normalized === 'STRAVA_SYNC_CHECKPOINT_INVALID') {
    return 'Ngữ cảnh đồng bộ Strava hiện không còn hợp lệ.';
  }
  if (normalized === 'STRAVA_SYNC_PERMISSION_DENIED') return 'Tài khoản Strava hiện không có quyền truy cập dữ liệu cần thiết.';
  if (normalized === 'STRAVA_ACTIVITY_PERSIST_FAILED') return 'Hệ thống chưa thể lưu dữ liệu hoạt động Strava và sẽ tự thử lại.';
  if (normalized === 'STRAVA_ACTIVITY_FETCH_FAILED') return 'Hệ thống chưa thể tải dữ liệu hoạt động từ Strava.';
  return fallback || 'Không thể hoàn tất đồng bộ Strava lúc này.';
}

export function classifyStravaSyncError(error: unknown, context: { phase?: unknown } = {}): StravaSyncErrorClassification {
  const explicitCode = toText((error as any)?.code || '').toUpperCase();
  const httpStatus = Number((error as any)?.status || (error as any)?.response?.status || 0) || null;
  const retryAfter = normalizeRetryAt((error as any)?.nextRetryAt || (error as any)?.retryAfter || (error as any)?.rateLimitResetAt || null);
  const phase = normalizeJobPhase(context.phase);

  if (explicitCode === 'STRAVA_SYNC_CANCELLED' || explicitCode === 'STRAVA_SYNC_JOB_CANCELLED') {
    return { code: 'STRAVA_SYNC_CANCELLED', message: buildStravaSyncClientMessage('STRAVA_SYNC_CANCELLED'), retryable: false, retryAfter: null, httpStatus: httpStatus || 409, category: 'cancelled' };
  }
  if (explicitCode === 'STRAVA_RATE_LIMITED' || httpStatus === 429) {
    return { code: 'STRAVA_RATE_LIMITED', message: buildStravaSyncClientMessage('STRAVA_RATE_LIMITED'), retryable: true, retryAfter, httpStatus: 429, category: 'rate_limit' };
  }
  if (explicitCode === 'STRAVA_TOKEN_REFRESH_FAILED') {
    return { code: 'STRAVA_TOKEN_REFRESH_FAILED', message: buildStravaSyncClientMessage('STRAVA_TOKEN_REFRESH_FAILED'), retryable: false, retryAfter: null, httpStatus: httpStatus || 401, category: 'auth_revoked' };
  }
  if (explicitCode === 'STRAVA_CONNECTION_REVOKED' || explicitCode === 'STRAVA_AUTH_EXPIRED') {
    return { code: 'STRAVA_CONNECTION_REVOKED', message: buildStravaSyncClientMessage('STRAVA_CONNECTION_REVOKED'), retryable: false, retryAfter: null, httpStatus: httpStatus || 401, category: 'auth_revoked' };
  }
  if (explicitCode === 'STRAVA_SCOPE_MISSING') {
    return { code: 'STRAVA_SCOPE_MISSING', message: buildStravaSyncClientMessage('STRAVA_SCOPE_MISSING'), retryable: false, retryAfter: null, httpStatus: httpStatus || 403, category: 'permission' };
  }
  if (explicitCode === 'STRAVA_NOT_CONNECTED') {
    return { code: 'STRAVA_NOT_CONNECTED', message: buildStravaSyncClientMessage('STRAVA_NOT_CONNECTED'), retryable: false, retryAfter: null, httpStatus: httpStatus || 400, category: 'validation' };
  }
  if (explicitCode === 'STRAVA_SNAPSHOT_CONTEXT_INVALID' || explicitCode === 'STRAVA_SYNC_JOB_CONTEXT_INVALID' || explicitCode === 'STRAVA_SYNC_CHECKPOINT_INVALID' || explicitCode === 'STRAVA_SYNC_JOB_NOT_FOUND') {
    return { code: explicitCode || 'STRAVA_SYNC_JOB_CONTEXT_INVALID', message: buildStravaSyncClientMessage(explicitCode || 'STRAVA_SYNC_JOB_CONTEXT_INVALID'), retryable: false, retryAfter: null, httpStatus: httpStatus || 409, category: 'context_invalid' };
  }
  if (explicitCode === 'STRAVA_SYNC_PERMISSION_DENIED') {
    return { code: 'STRAVA_SYNC_PERMISSION_DENIED', message: buildStravaSyncClientMessage('STRAVA_SYNC_PERMISSION_DENIED'), retryable: false, retryAfter: null, httpStatus: httpStatus || 403, category: 'permission' };
  }
  if (explicitCode === 'STRAVA_ACTIVITY_PERSIST_FAILED') {
    return { code: 'STRAVA_ACTIVITY_PERSIST_FAILED', message: buildStravaSyncClientMessage('STRAVA_ACTIVITY_PERSIST_FAILED'), retryable: true, retryAfter: null, httpStatus: httpStatus || 500, category: 'database_transient' };
  }
  if (explicitCode === 'STRAVA_ACTIVITY_FETCH_FAILED') {
    const retryable = !httpStatus || httpStatus >= 500;
    return {
      code: 'STRAVA_ACTIVITY_FETCH_FAILED',
      message: buildStravaSyncClientMessage('STRAVA_ACTIVITY_FETCH_FAILED'),
      retryable,
      retryAfter,
      httpStatus: httpStatus || 502,
      category: retryable ? 'strava_5xx' : 'validation',
    };
  }
  if (explicitCode === 'STRAVA_NETWORK_ERROR') {
    return { code: 'STRAVA_NETWORK_ERROR', message: buildStravaSyncClientMessage('STRAVA_NETWORK_ERROR'), retryable: true, retryAfter: null, httpStatus: httpStatus || 503, category: 'network' };
  }
  if (explicitCode === 'STRAVA_SERVICE_UNAVAILABLE') {
    return { code: 'STRAVA_SERVICE_UNAVAILABLE', message: buildStravaSyncClientMessage('STRAVA_SERVICE_UNAVAILABLE'), retryable: true, retryAfter, httpStatus: httpStatus || 503, category: 'strava_5xx' };
  }
  if (explicitCode === 'STRAVA_DATABASE_TRANSIENT_ERROR') {
    return { code: 'STRAVA_DATABASE_TRANSIENT_ERROR', message: buildStravaSyncClientMessage('STRAVA_DATABASE_TRANSIENT_ERROR'), retryable: true, retryAfter: null, httpStatus: httpStatus || 500, category: 'database_transient' };
  }
  if (explicitCode === 'STRAVA_DATABASE_PERMANENT_ERROR') {
    return { code: 'STRAVA_DATABASE_PERMANENT_ERROR', message: buildStravaSyncClientMessage('STRAVA_DATABASE_PERMANENT_ERROR'), retryable: false, retryAfter: null, httpStatus: httpStatus || 500, category: 'database_permanent' };
  }
  if (explicitCode === 'STRAVA_SYNC_BATCH_FAILED') {
    return { code: 'STRAVA_SYNC_BATCH_FAILED', message: buildStravaSyncClientMessage('STRAVA_SYNC_BATCH_FAILED', 'Không thể hoàn tất đồng bộ Strava lúc này.'), retryable: true, retryAfter, httpStatus: httpStatus || 500, category: 'unknown' };
  }
  if (explicitCode === 'STRAVA_SNAPSHOT_REBUILD_FAILED' || explicitCode === 'STRAVA_SNAPSHOT_WRITE_FAILED') {
    const retryable = isTransientDatabaseError((error as any)?.cause || error) || isTransientNetworkError((error as any)?.cause || error);
    return {
      code: explicitCode,
      message: buildStravaSyncClientMessage(explicitCode),
      retryable,
      retryAfter: null,
      httpStatus: httpStatus || 500,
      category: 'snapshot',
    };
  }
  if (isTransientDatabaseError((error as any)?.cause || error)) {
    return { code: 'STRAVA_DATABASE_TRANSIENT_ERROR', message: buildStravaSyncClientMessage('STRAVA_DATABASE_TRANSIENT_ERROR'), retryable: true, retryAfter: null, httpStatus: httpStatus || 500, category: 'database_transient' };
  }
  if (isPermanentDatabaseError((error as any)?.cause || error)) {
    return { code: 'STRAVA_DATABASE_PERMANENT_ERROR', message: buildStravaSyncClientMessage('STRAVA_DATABASE_PERMANENT_ERROR'), retryable: false, retryAfter: null, httpStatus: httpStatus || 500, category: 'database_permanent' };
  }
  if (isTransientNetworkError((error as any)?.cause || error)) {
    return { code: 'STRAVA_NETWORK_ERROR', message: buildStravaSyncClientMessage('STRAVA_NETWORK_ERROR'), retryable: true, retryAfter: null, httpStatus: httpStatus || 503, category: 'network' };
  }
  if (httpStatus === 401) {
    return { code: 'STRAVA_CONNECTION_REVOKED', message: buildStravaSyncClientMessage('STRAVA_CONNECTION_REVOKED'), retryable: false, retryAfter: null, httpStatus, category: 'auth_revoked' };
  }
  if (httpStatus === 403) {
    const errorText = `${toText((error as any)?.message || '')} ${toText((error as any)?.body || '')}`.toLowerCase();
    const code = errorText.includes('scope') ? 'STRAVA_SCOPE_MISSING' : 'STRAVA_SYNC_PERMISSION_DENIED';
    return { code, message: buildStravaSyncClientMessage(code), retryable: false, retryAfter: null, httpStatus, category: 'permission' };
  }
  if (httpStatus && [500, 502, 503, 504].includes(httpStatus)) {
    return { code: 'STRAVA_SERVICE_UNAVAILABLE', message: buildStravaSyncClientMessage('STRAVA_SERVICE_UNAVAILABLE'), retryable: true, retryAfter: null, httpStatus, category: 'strava_5xx' };
  }

  const fallbackCode = explicitCode || (phase === 'rebuilding_snapshot' ? 'STRAVA_SNAPSHOT_REBUILD_FAILED' : 'STRAVA_SYNC_BATCH_FAILED');
  return {
    code: fallbackCode,
    message: buildStravaSyncClientMessage(fallbackCode, sanitizeSyncErrorMessage(error, 'Strava sync batch failed')),
    retryable: isRetryableSyncErrorCode(fallbackCode),
    retryAfter,
    httpStatus: httpStatus || 500,
    category: 'unknown',
  };
}

export function calculateStravaRetryDelay(options: { retryCount: number; category?: string; retryAfter?: string | null }) {
  const retryCount = Math.max(1, Number(options.retryCount || 1));
  const baseSeconds = resolveStravaRetryBaseSeconds();
  const maxSeconds = resolveStravaRetryMaxSeconds();
  const predefinedSteps = [baseSeconds, baseSeconds * 2, baseSeconds * 4, baseSeconds * 10, maxSeconds];
  const delaySeconds = predefinedSteps[Math.min(retryCount - 1, predefinedSteps.length - 1)] || maxSeconds;
  const fallbackMs = Math.max(baseSeconds, Math.min(maxSeconds, delaySeconds)) * 1000;
  const preferredRetryAt = normalizeRetryAt(options.retryAfter || null);
  const fallbackRetryAt = new Date(Date.now() + fallbackMs).toISOString();

  if (!preferredRetryAt) {
    return { delayMs: fallbackMs, nextRetryAt: fallbackRetryAt };
  }

  const preferredMs = new Date(preferredRetryAt).getTime() - Date.now();
  if (!Number.isFinite(preferredMs) || preferredMs <= 0) {
    return { delayMs: fallbackMs, nextRetryAt: fallbackRetryAt };
  }

  return preferredMs > fallbackMs
    ? { delayMs: preferredMs, nextRetryAt: preferredRetryAt }
    : { delayMs: fallbackMs, nextRetryAt: fallbackRetryAt };
}

export function getRetryJobStatus(phase: unknown, status: unknown): JobStatus {
  const normalizedPhase = normalizeJobPhase(phase);
  const normalizedStatus = normalizeJobStatus(status);
  if (normalizedStatus === 'partial_ready') return 'partial_ready';
  if (['syncing_history', 'rebuilding_snapshot', 'finalizing'].includes(normalizedPhase)) return 'partial_ready';
  return 'queued';
}

function normalizeJobStatus(value: unknown): JobStatus {
  const normalized = toText(value).toLowerCase();
  if (normalized === 'running') return 'running';
  if (normalized === 'partial_ready') return 'partial_ready';
  if (normalized === 'completed') return 'completed';
  if (normalized === 'failed') return 'failed';
  if (normalized === 'cancelled') return 'cancelled';
  return 'queued';
}

function normalizeJobPhase(value: unknown): JobPhase {
  const normalized = toText(value).toLowerCase();
  if (normalized === 'syncing_recent') return 'syncing_recent';
  if (normalized === 'syncing_history') return 'syncing_history';
  if (normalized === 'rebuilding_snapshot') return 'rebuilding_snapshot';
  if (normalized === 'finalizing') return 'finalizing';
  return 'preparing';
}

function normalizeJobSyncMode(value: unknown): JobSyncMode {
  const normalized = toText(value).toLowerCase();
  if (normalized === 'incremental') return 'incremental';
  if (normalized === 'retry') return 'retry';
  return 'initial';
}

function sanitizeSyncErrorMessage(error: unknown, fallback = 'Strava sync batch failed'): string {
  const rawMessage = toText((error as any)?.message || fallback);
  return rawMessage
    .replace(/bearer\s+[a-z0-9._\-]+/gi, 'Bearer [redacted]')
    .replace(/refresh_token=[^&\s]+/gi, 'refresh_token=[redacted]')
    .replace(/access_token=[^&\s]+/gi, 'access_token=[redacted]')
    .replace(/authorization[^\n]*/gi, 'authorization=[redacted]')
    .slice(0, 300);
}

function getSyncErrorCode(error: unknown, fallback = 'STRAVA_SYNC_BATCH_FAILED') {
  const explicitCode = toText((error as any)?.code || '');
  if (explicitCode) return explicitCode;
  return fallback;
}

function isRetryableSyncErrorCode(code: string) {
  return [
    'STRAVA_RATE_LIMITED',
    'STRAVA_NETWORK_ERROR',
    'STRAVA_SERVICE_UNAVAILABLE',
    'STRAVA_ACTIVITY_FETCH_FAILED',
    'STRAVA_ACTIVITY_PERSIST_FAILED',
    'STRAVA_DATABASE_TRANSIENT_ERROR',
    'STRAVA_SYNC_BATCH_FAILED',
    'STRAVA_SNAPSHOT_REBUILD_FAILED',
    'STRAVA_SNAPSHOT_WRITE_FAILED',
  ].includes(code);
}

function isSameMetricValue(left: unknown, right: unknown) {
  const leftText = left === null || left === undefined ? '' : String(left);
  const rightText = right === null || right === undefined ? '' : String(right);
  return leftText === rightText;
}

function shouldUpdateExistingActivity(existing: Record<string, any> | null, payload: Record<string, any>) {
  if (!existing?.id) return true;

  const comparableFields = [
    'name',
    'type',
    'sportType',
    'startDate',
    'startDateLocal',
    'timezone',
    'distance',
    'movingTime',
    'elapsedTime',
    'totalElevationGain',
    'averageSpeed',
    'maxSpeed',
    'averageHeartrate',
    'maxHeartrate',
    'calories',
    'achievementCount',
    'kudosCount',
    'locationCountry',
    'locationCity',
    'hasMap',
    'mapSummaryPolyline',
    'visibility',
    'syncStatus',
  ];

  return comparableFields.some((field) => !isSameMetricValue(existing?.[field], payload?.[field]));
}

function buildSyncedActivityWhere(
  tenantId: number | string,
  userId: number,
  extraWhere: Record<string, unknown> = {},
) {
  return mergeTenantWhere({
    user: { id: userId },
    syncStatus: 'SYNCED',
    ...extraWhere,
  }, tenantId);
}

function mergeJobMetadata(job: StravaSyncJobRecord, patch: Record<string, unknown> = {}) {
  const current = job?.metadata && typeof job.metadata === 'object' && !Array.isArray(job.metadata)
    ? { ...job.metadata }
    : {};
  return {
    ...current,
    ...patch,
  };
}

function resolveJobTenantId(job: StravaSyncJobRecord): string {
  const tenant = job?.tenant;
  if (tenant && typeof tenant === 'object' && 'id' in tenant) {
    return toText(tenant.id);
  }
  return toText(tenant);
}

function resolveJobUserId(job: StravaSyncJobRecord): number | null {
  const user = job?.user;
  if (user && typeof user === 'object' && 'id' in user) {
    return toPositiveInt(user.id);
  }
  return toPositiveInt(user);
}

function resolveJobConnectionId(job: StravaSyncJobRecord): number | null {
  const connection = job?.connection;
  if (connection && typeof connection === 'object' && 'id' in connection) {
    return toPositiveInt(connection.id);
  }
  return toPositiveInt(connection);
}

async function updateStravaSyncJobCheckpoint(jobId: number, data: Record<string, unknown>, options: { transacting?: any } = {}) {
  return strapi.db.query(STRAVA_SYNC_JOB_UID).update({
    where: { id: jobId },
    data,
    ...(options.transacting ? { transacting: options.transacting } : {}),
  });
}

async function getStravaSyncJobContext(jobId: number): Promise<StravaSyncJobRecord | null> {
  return strapi.db.query(STRAVA_SYNC_JOB_UID).findOne({
    where: { id: jobId },
    select: [
      'id',
      'status',
      'phase',
      'syncMode',
      'currentPage',
      'perPage',
      'oldestSyncedAt',
      'newestSyncedAt',
      'processedActivities',
      'createdActivities',
      'updatedActivities',
      'skippedActivities',
      'failedActivities',
      'heartbeatAt',
      'retryCount',
      'requestedAt',
      'startedAt',
      'completedAt',
      'failedAt',
      'cancelledAt',
      'claimedAt',
      'claimedBy',
      'nextRetryAt',
      'lastErrorCode',
      'lastErrorMessage',
      'metadata',
    ],
    populate: {
      tenant: { select: ['id'] },
      user: { select: ['id'] },
      connection: { select: ['id'] },
    },
  }) as Promise<StravaSyncJobRecord | null>;
}

async function getStravaSyncJobContextForOwner(jobId: number, tenantId: number | string, userId: number) {
  return strapi.db.query(STRAVA_SYNC_JOB_UID).findOne({
    where: mergeTenantWhere({
      id: jobId,
      user: { id: userId },
    }, tenantId),
    select: [
      'id',
      'status',
      'phase',
      'syncMode',
      'currentPage',
      'perPage',
      'oldestSyncedAt',
      'newestSyncedAt',
      'processedActivities',
      'createdActivities',
      'updatedActivities',
      'skippedActivities',
      'failedActivities',
      'heartbeatAt',
      'retryCount',
      'requestedAt',
      'startedAt',
      'completedAt',
      'failedAt',
      'cancelledAt',
      'claimedAt',
      'claimedBy',
      'nextRetryAt',
      'lastErrorCode',
      'lastErrorMessage',
      'metadata',
    ],
    populate: {
      tenant: { select: ['id'] },
      user: { select: ['id'] },
      connection: { select: ['id', 'status'] },
    },
  }) as Promise<StravaSyncJobRecord | null>;
}

function isActiveJobStatus(status: unknown) {
  return ['queued', 'running', 'partial_ready'].includes(normalizeJobStatus(status));
}

function toFinishedAt(job: StravaSyncJobRecord | null) {
  return job?.completedAt || job?.failedAt || job?.cancelledAt || null;
}

function buildStravaSyncProgressMessage(job: StravaSyncJobRecord | null) {
  const status = normalizeJobStatus(job?.status);
  const phase = normalizeJobPhase(job?.phase);
  const nextRetryAt = normalizeRetryAt(job?.nextRetryAt || null);
  const errorCode = toText(job?.lastErrorCode || '').toUpperCase();

  if (nextRetryAt && ['queued', 'running', 'partial_ready'].includes(status)) {
    if (errorCode === 'STRAVA_RATE_LIMITED') {
      return 'Strava đang tạm giới hạn số lần truy cập. Hệ thống sẽ tự tiếp tục sau.';
    }
    if (status === 'partial_ready') {
      return 'Dữ liệu gần đây đã sẵn sàng. Đồng bộ đang tạm dừng và sẽ tự tiếp tục.';
    }
    return 'Đồng bộ Strava đang tạm dừng và sẽ tự tiếp tục sau.';
  }

  if (status === 'queued') return 'Yêu cầu đồng bộ đang chờ xử lý.';
  if (status === 'running' && phase === 'preparing') return 'Đang chuẩn bị đồng bộ dữ liệu.';
  if (status === 'running' && phase === 'syncing_recent') return 'Đang tải các hoạt động gần đây.';
  if (status === 'partial_ready' && phase === 'syncing_history') return 'Dữ liệu gần đây đã sẵn sàng. Hệ thống đang tiếp tục đồng bộ lịch sử.';
  if (status === 'partial_ready' && phase === 'rebuilding_snapshot') return 'Đang hoàn thiện số liệu thống kê.';
  if (status === 'completed') return 'Đồng bộ hoàn tất.';
  if (status === 'failed') return buildStravaSyncClientMessage(errorCode, 'Đồng bộ chưa hoàn tất.');
  if (status === 'cancelled') return 'Đã hủy đồng bộ.';
  return 'Đang xử lý đồng bộ Strava.';
}

function serializeStravaSyncJob(job: StravaSyncJobRecord | null) {
  if (!job?.id) return null;

  const status = normalizeJobStatus(job.status);
  const phase = normalizeJobPhase(job.phase);
  const syncMode = normalizeJobSyncMode(job.syncMode);
  const metadata = mergeJobMetadata(job, {});
  const snapshotIsComplete = metadata.snapshotIsComplete === true;
  const recentReadyAt = toText(metadata.recentReadyAt || '') || null;
  const totalActivities = metadata.totalActivities ?? metadata.estimatedTotal ?? null;
  const errorCode = toText(job.lastErrorCode || '');
  const rawErrorMessage = sanitizeSyncErrorMessage(job.lastErrorMessage || '', '');
  const errorMessage = errorCode || rawErrorMessage
    ? buildStravaSyncClientMessage(errorCode, rawErrorMessage)
    : null;

  return {
    jobId: Number(job.id),
    id: Number(job.id),
    status,
    phase,
    syncMode,
    processedActivities: Number(job.processedActivities || 0),
    createdActivities: Number(job.createdActivities || 0),
    updatedActivities: Number(job.updatedActivities || 0),
    skippedActivities: Number(job.skippedActivities || 0),
    failedActivities: Number(job.failedActivities || 0),
    totalActivities: totalActivities === null ? null : Number(totalActivities || 0),
    currentPage: Number(job.currentPage || 1),
    recentReadyAt,
    requestedAt: job.requestedAt || null,
    startedAt: job.startedAt || null,
    finishedAt: toFinishedAt(job),
    nextRetryAt: job.nextRetryAt || null,
    lastErrorCode: errorCode || null,
    lastErrorMessage: errorMessage || null,
    progressMessage: buildStravaSyncProgressMessage(job),
    isDataComplete: snapshotIsComplete && status === 'completed',
    canRetry: status === 'failed' && isRetryableSyncErrorCode(errorCode),
    canCancel: ['queued', 'running', 'partial_ready'].includes(status),
  };
}

async function findActiveStravaSyncJob(tenantId: number | string, userId: number, connectionId: number, options: { transacting?: any } = {}) {
  return strapi.db.query(STRAVA_SYNC_JOB_UID).findOne({
    where: mergeTenantWhere({
      user: { id: userId },
      connection: { id: connectionId },
      status: { $in: ['queued', 'running', 'partial_ready'] },
    }, tenantId),
    populate: {
      tenant: { select: ['id'] },
      user: { select: ['id'] },
      connection: { select: ['id', 'status'] },
    },
    transacting: options.transacting,
  } as any) as Promise<StravaSyncJobRecord | null>;
}

async function findLatestStravaSyncJob(tenantId: number | string, userId: number, connectionId: number) {
  const rows = await strapi.db.query(STRAVA_SYNC_JOB_UID).findMany({
    where: mergeTenantWhere({
      user: { id: userId },
      connection: { id: connectionId },
    }, tenantId),
    orderBy: [{ requestedAt: 'desc' }, { createdAt: 'desc' }, { id: 'desc' }],
    limit: 1,
    populate: {
      tenant: { select: ['id'] },
      user: { select: ['id'] },
      connection: { select: ['id', 'status'] },
    },
  });
  return Array.isArray(rows) ? (rows[0] as StravaSyncJobRecord | null) : null;
}

async function findLatestCompletedStravaSyncJob(tenantId: number | string, userId: number, connectionId: number) {
  const rows = await strapi.db.query(STRAVA_SYNC_JOB_UID).findMany({
    where: mergeTenantWhere({
      user: { id: userId },
      connection: { id: connectionId },
      status: 'completed',
    }, tenantId),
    orderBy: [{ completedAt: 'desc' }, { requestedAt: 'desc' }, { id: 'desc' }],
    limit: 1,
    populate: {
      tenant: { select: ['id'] },
      user: { select: ['id'] },
      connection: { select: ['id', 'status'] },
    },
  });
  return Array.isArray(rows) ? (rows[0] as StravaSyncJobRecord | null) : null;
}

async function findNewerCompletedStravaSyncJob(job: StravaSyncJobRecord) {
  const tenantId = resolveJobTenantId(job);
  const userId = resolveJobUserId(job);
  const connectionId = resolveJobConnectionId(job);
  const requestedAt = toText(job?.requestedAt || '');
  if (!tenantId || !userId || !connectionId || !job?.id || !requestedAt) return null;

  const rows = await strapi.db.query(STRAVA_SYNC_JOB_UID).findMany({
    where: mergeTenantWhere({
      user: { id: userId },
      connection: { id: connectionId },
      status: 'completed',
      requestedAt: { $gt: requestedAt },
    }, tenantId),
    orderBy: [{ requestedAt: 'desc' }, { completedAt: 'desc' }, { id: 'desc' }],
    limit: 1,
    select: ['id', 'requestedAt', 'completedAt'],
  });

  return Array.isArray(rows) ? (rows[0] as StravaSyncJobRecord | null) : null;
}

async function assertCanWriteAnalyticsSnapshot(job: StravaSyncJobRecord) {
  if (!job?.id) {
    throw Object.assign(new Error('Strava sync job not found'), { code: 'STRAVA_SYNC_JOB_NOT_FOUND', status: 404 });
  }

  if (normalizeJobStatus(job.status) === 'cancelled') {
    throw Object.assign(new Error('Strava sync job is cancelled'), { code: 'STRAVA_SYNC_JOB_INVALID_STATE', status: 409 });
  }

  const newerCompletedJob = await findNewerCompletedStravaSyncJob(job);
  if (newerCompletedJob?.id) {
    throw Object.assign(new Error('A newer Strava sync job has already completed.'), {
      code: 'STRAVA_SNAPSHOT_CONTEXT_INVALID',
      status: 409,
    });
  }

  return job;
}

function buildAnalyticsSyncStateFromContext(options: {
  connection: StravaConnectionRecord | null;
  activeJob: StravaSyncJobRecord | null;
  latestJob: StravaSyncJobRecord | null;
  latestCompletedJob: StravaSyncJobRecord | null;
}): AnalyticsSyncState {
  const activeJob = options.activeJob;
  const latestJob = options.latestJob;
  const latestCompletedJob = options.latestCompletedJob;
  const activeMetadata = mergeJobMetadata(activeJob as StravaSyncJobRecord, {});
  const latestMetadata = mergeJobMetadata(latestJob as StravaSyncJobRecord, {});
  const latestCompletedMetadata = mergeJobMetadata(latestCompletedJob as StravaSyncJobRecord, {});
  const visibleJob = activeJob?.id ? activeJob : latestJob?.id ? latestJob : latestCompletedJob?.id ? latestCompletedJob : null;
  const visibleStatus = visibleJob?.id ? normalizeJobStatus(visibleJob.status) : null;
  const visiblePhase = activeJob?.id
    ? normalizeJobPhase(activeJob.phase)
    : latestJob?.id
      ? normalizeJobPhase(latestJob.phase)
      : null;
  const visibleSyncMode = activeJob?.id
    ? normalizeJobSyncMode(activeJob.syncMode)
    : latestJob?.id
      ? normalizeJobSyncMode(latestJob.syncMode)
      : null;
  const activeSyncMode = activeJob?.id ? normalizeJobSyncMode(activeJob.syncMode) : null;
  const activeRecentReadyAt = toText(activeMetadata.recentReadyAt || '') || null;
  const latestRecentReadyAt = toText(latestMetadata.recentReadyAt || '') || null;
  const hasCompletedSnapshot = latestCompletedJob?.id ? latestCompletedMetadata.snapshotIsComplete === true : false;
  const connectionLastSyncStatus = toText(options.connection?.lastSyncStatus).toUpperCase();
  const lastCompletedSyncAt = toText(
    latestCompletedMetadata.lastCompletedSyncAt
    || latestCompletedJob?.completedAt
    || (connectionLastSyncStatus === 'SUCCESS' ? options.connection?.lastSyncAt : '')
    || ''
  ) || null;
  const builtAt = toText(
    latestCompletedMetadata.snapshotRebuiltAt
    || activeMetadata.snapshotRebuiltAt
    || latestMetadata.snapshotRebuiltAt
    || ''
  ) || null;

  let isDataComplete = hasCompletedSnapshot;
  if (activeJob?.id && (!activeSyncMode || activeSyncMode === 'initial')) {
    isDataComplete = false;
  }
  if (activeJob?.id && (activeSyncMode === 'incremental' || activeSyncMode === 'retry') && hasCompletedSnapshot) {
    isDataComplete = true;
  }

  let dataState: AnalyticsSyncState['dataState'] = 'none';
  if (isDataComplete) dataState = 'complete';
  else if (activeRecentReadyAt || latestRecentReadyAt || connectionLastSyncStatus === 'PARTIAL') dataState = 'partial';

  return {
    status: visibleStatus || 'idle',
    phase: visiblePhase,
    syncMode: visibleSyncMode,
    isDataComplete,
    dataState,
    currentSyncJobId: activeJob?.id ? Number(activeJob.id) : null,
    lastCompletedSyncAt,
    recentReadyAt: activeRecentReadyAt || latestRecentReadyAt,
    builtAt,
  };
}

async function getCurrentUserAnalyticsSyncState(tenantId: number | string, userId: number): Promise<AnalyticsSyncState> {
  const connection = await getCurrentStravaConnection(tenantId, userId, false);
  if (!connection?.id) {
    return {
      status: 'idle',
      phase: null,
      syncMode: null,
      isDataComplete: false,
      dataState: 'none',
      currentSyncJobId: null,
      lastCompletedSyncAt: null,
      recentReadyAt: null,
      builtAt: null,
    };
  }

  const [activeJob, latestJob, latestCompletedJob] = await Promise.all([
    findActiveStravaSyncJob(tenantId, userId, connection.id),
    findLatestStravaSyncJob(tenantId, userId, connection.id),
    findLatestCompletedStravaSyncJob(tenantId, userId, connection.id),
  ]);

  return buildAnalyticsSyncStateFromContext({ connection, activeJob, latestJob, latestCompletedJob });
}

async function withAnalyticsSyncState<T extends Record<string, any>>(tenantId: number | string, userId: number, payload: T): Promise<T & { sync: AnalyticsSyncState }> {
  const sync = await getCurrentUserAnalyticsSyncState(tenantId, userId);
  return {
    ...payload,
    sync,
  };
}

async function determineStravaJobSyncMode(tenantId: number | string, userId: number, connection: StravaConnectionRecord): Promise<JobSyncMode> {
  const latestCompletedJob = await strapi.db.query(STRAVA_SYNC_JOB_UID).findOne({
    where: mergeTenantWhere({
      user: { id: userId },
      connection: { id: connection.id },
      status: 'completed',
    }, tenantId),
    select: ['id'],
    orderBy: [{ completedAt: 'desc' }, { id: 'desc' }],
  });

  const latestActivity = await getLatestActivityStartDateMs(tenantId, userId);
  if (!latestCompletedJob?.id || !latestActivity || toText(connection.lastSyncStatus).toUpperCase() !== 'SUCCESS') {
    return 'initial';
  }

  return 'incremental';
}

export async function startCurrentUserStravaSync(tenantId: number | string, userId: number): Promise<StravaSyncJobStartResult> {
  const connection = await getCurrentStravaConnection(tenantId, userId, true);
  if (!connection?.id) {
    throw Object.assign(new Error('Bạn chưa kết nối tài khoản Strava.'), { code: 'STRAVA_NOT_CONNECTED', status: 400 });
  }

  if (toText(connection.status).toUpperCase() !== 'ACTIVE') {
    throw Object.assign(new Error('Kết nối Strava hiện không hoạt động.'), { code: 'STRAVA_CONNECTION_INACTIVE', status: 409 });
  }

  const syncMode = await determineStravaJobSyncMode(tenantId, userId, connection);
  const perPage = resolveStravaSyncBatchSize();

  const createdJobId = await strapi.db.transaction(async ({ trx }: any) => {
    const existing = await findActiveStravaSyncJob(tenantId, userId, connection.id, { transacting: trx });
    if (existing?.id) {
      return -Number(existing.id);
    }

    const created = await strapi.db.query(STRAVA_SYNC_JOB_UID).create({
      data: {
        tenant: tenantId,
        user: userId,
        connection: connection.id,
        status: 'queued',
        phase: 'preparing',
        syncMode,
        currentPage: 1,
        perPage,
        processedActivities: 0,
        createdActivities: 0,
        updatedActivities: 0,
        skippedActivities: 0,
        failedActivities: 0,
        retryCount: 0,
        requestedAt: new Date().toISOString(),
        heartbeatAt: new Date().toISOString(),
        claimedAt: null,
        claimedBy: null,
        nextRetryAt: null,
        lastErrorCode: null,
        lastErrorMessage: null,
        metadata: {
          recentActivityLimit: resolveStravaInitialRecentActivityLimit(),
          recentProcessed: 0,
          recentPagesProcessed: 0,
          pagesProcessed: 0,
          lastCompletedPage: null,
          lastCompletedPhase: null,
          lastProcessedActivityId: null,
          rateLimitResetAt: null,
          initialRecentBatchCompleted: false,
          recentReadyAt: null,
          historyExhausted: false,
          afterTimestamp: null,
          snapshotSummary: null,
          snapshotIsComplete: false,
          snapshotRebuiltAt: null,
          previousJobId: null,
        },
      },
      transacting: trx,
    } as any);

    return Number(created.id);
  });

  const created = createdJobId > 0;
  const jobId = created ? createdJobId : Math.abs(createdJobId);
  const job = await getStravaSyncJobContext(jobId);
  if (!job?.id) {
    throw Object.assign(new Error('Không thể khởi tạo job đồng bộ Strava.'), { code: 'STRAVA_SYNC_START_FAILED', status: 500 });
  }

  return {
    job,
    created,
    alreadyRunning: !created,
  };
}

export async function getCurrentUserStravaSyncJob(tenantId: number | string, userId: number) {
  const connection = await getCurrentStravaConnection(tenantId, userId, false);
  if (!connection?.id) return null;

  const active = await findActiveStravaSyncJob(tenantId, userId, connection.id);
  if (active?.id) return active;

  return findLatestStravaSyncJob(tenantId, userId, connection.id);
}

export async function getCurrentUserStravaSyncJobDetail(tenantId: number | string, userId: number, jobId: number) {
  const job = await getStravaSyncJobContextForOwner(jobId, tenantId, userId);
  if (!job?.id) {
    throw Object.assign(new Error('Không tìm thấy job đồng bộ Strava.'), { code: 'STRAVA_SYNC_JOB_NOT_FOUND', status: 404 });
  }
  return job;
}

export async function retryCurrentUserStravaSyncJob(tenantId: number | string, userId: number, jobId: number): Promise<StravaSyncJobStartResult> {
  const job = await getCurrentUserStravaSyncJobDetail(tenantId, userId, jobId);
  const status = normalizeJobStatus(job.status);
  if (status !== 'failed') {
    throw Object.assign(new Error('Job đồng bộ Strava hiện không thể retry.'), { code: 'STRAVA_SYNC_JOB_NOT_RETRYABLE', status: 409 });
  }

  const errorCode = toText(job.lastErrorCode || '');
  if (!isRetryableSyncErrorCode(errorCode)) {
    throw Object.assign(new Error('Job đồng bộ Strava hiện không thể retry.'), { code: 'STRAVA_SYNC_JOB_NOT_RETRYABLE', status: 409 });
  }

  const connectionId = resolveJobConnectionId(job);
  if (!connectionId) {
    throw Object.assign(new Error('Không tìm thấy kết nối Strava cho job retry.'), { code: 'STRAVA_CONNECTION_REVOKED', status: 409 });
  }

  const active = await findActiveStravaSyncJob(tenantId, userId, connectionId);
  if (active?.id) {
    return {
      job: active,
      created: false,
      alreadyRunning: true,
    };
  }

  const newJobId = await strapi.db.transaction(async ({ trx }: any) => {
    const existing = await findActiveStravaSyncJob(tenantId, userId, connectionId, { transacting: trx });
    if (existing?.id) {
      return -Number(existing.id);
    }

    const metadata = mergeJobMetadata(job, { previousJobId: job.id });
    const created = await strapi.db.query(STRAVA_SYNC_JOB_UID).create({
      data: {
        tenant: tenantId,
        user: userId,
        connection: connectionId,
        status: 'queued',
        phase: normalizeJobPhase(job.phase),
        syncMode: 'retry',
        currentPage: Math.max(1, Number(job.currentPage || 1)),
        perPage: Math.max(1, Number(job.perPage || resolveStravaSyncBatchSize())),
        oldestSyncedAt: job.oldestSyncedAt || null,
        newestSyncedAt: job.newestSyncedAt || null,
        processedActivities: Number(job.processedActivities || 0),
        createdActivities: Number(job.createdActivities || 0),
        updatedActivities: Number(job.updatedActivities || 0),
        skippedActivities: Number(job.skippedActivities || 0),
        failedActivities: Number(job.failedActivities || 0),
        retryCount: Number(job.retryCount || 0),
        requestedAt: new Date().toISOString(),
        heartbeatAt: new Date().toISOString(),
        claimedAt: null,
        claimedBy: null,
        nextRetryAt: null,
        lastErrorCode: null,
        lastErrorMessage: null,
        metadata,
      },
      transacting: trx,
    } as any);

    return Number(created.id);
  });

  const created = newJobId > 0;
  const nextJobId = created ? newJobId : Math.abs(newJobId);
  const nextJob = await getStravaSyncJobContext(nextJobId);
  if (!nextJob?.id) {
    throw Object.assign(new Error('Không thể tạo job retry đồng bộ Strava.'), { code: 'STRAVA_SYNC_RETRY_FAILED', status: 500 });
  }

  return {
    job: nextJob,
    created,
    alreadyRunning: !created,
  };
}

export async function cancelCurrentUserStravaSyncJob(tenantId: number | string, userId: number, jobId: number) {
  const job = await getCurrentUserStravaSyncJobDetail(tenantId, userId, jobId);
  const status = normalizeJobStatus(job.status);
  if (!['queued', 'running', 'partial_ready'].includes(status)) {
    throw Object.assign(new Error('Job đồng bộ Strava hiện không thể hủy.'), { code: 'STRAVA_SYNC_JOB_NOT_CANCELLABLE', status: 409 });
  }

  const nowIso = new Date().toISOString();
  await updateStravaSyncJobCheckpoint(jobId, {
    status: 'cancelled',
    cancelledAt: nowIso,
    heartbeatAt: nowIso,
    nextRetryAt: null,
  });

  const cancelledJob = await getStravaSyncJobContext(jobId);
  if (!cancelledJob?.id) {
    throw Object.assign(new Error('Không thể hủy job đồng bộ Strava.'), { code: 'STRAVA_SYNC_CANCEL_FAILED', status: 500 });
  }

  return cancelledJob;
}

function validateStravaSyncJob(job: StravaSyncJobRecord | null) {
  if (!job?.id) {
    throw Object.assign(new Error('Strava sync job not found'), { code: 'STRAVA_SYNC_JOB_NOT_FOUND', status: 404 });
  }

  const status = normalizeJobStatus(job.status);
  if (['completed', 'failed', 'cancelled'].includes(status)) {
    throw Object.assign(new Error('Strava sync job is not in a runnable state'), { code: 'STRAVA_SYNC_JOB_INVALID_STATE', status: 409 });
  }

  const tenantId = resolveJobTenantId(job);
  const userId = resolveJobUserId(job);
  const connectionId = resolveJobConnectionId(job);
  if (!tenantId || !userId || !connectionId) {
    throw Object.assign(new Error('Strava sync job relations are incomplete'), { code: 'STRAVA_SYNC_JOB_INVALID_STATE', status: 409 });
  }

  return {
    tenantId,
    userId,
    connectionId,
    status,
    phase: normalizeJobPhase(job.phase),
    syncMode: normalizeJobSyncMode(job.syncMode),
  };
}

async function getStravaConnectionForJob(job: StravaSyncJobRecord) {
  const tenantId = resolveJobTenantId(job);
  const userId = resolveJobUserId(job);
  const connectionId = resolveJobConnectionId(job);

  const connection = await strapi.db.query(STRAVA_CONNECTION_UID).findOne({
    where: mergeTenantWhere({ id: connectionId, user: { id: userId } }, tenantId),
    select: ['id', 'status', 'accessToken', 'refreshToken', 'tokenExpiresAt', 'lastSyncAt', 'lastSyncStatus', 'athleteFirstname', 'athleteLastname', 'athleteUsername', 'profileUrl'],
  });

  if (!connection?.id) {
    throw Object.assign(new Error('Strava connection not found'), { code: 'STRAVA_CONNECTION_NOT_FOUND', status: 404 });
  }

  return connection as StravaConnectionRecord;
}

async function refreshStravaTokenIfNeeded(connection: StravaConnectionRecord) {
  try {
    return await getValidAccessToken(connection);
  } catch (error: any) {
    if (error?.status === 401) {
      throw Object.assign(new Error('Strava token refresh failed'), { code: 'STRAVA_TOKEN_REFRESH_FAILED', status: 401 });
    }
    throw error;
  }
}

async function updateConnectionSyncState(connectionId: number, data: Record<string, unknown>) {
  return strapi.db.query(STRAVA_CONNECTION_UID).update({
    where: { id: connectionId },
    data,
  });
}

async function markConnectionSyncRunning(connectionId: number): Promise<boolean> {
  const updatedCount = await strapi.db.connection('strava_connections')
    .where({ id: connectionId })
    .andWhere((builder: any) => builder.whereNull('last_sync_status').orWhereNot('last_sync_status', 'RUNNING'))
    .update({
      last_sync_status: 'RUNNING',
      last_sync_error: null,
      updated_at: new Date().toISOString(),
    });

  return Boolean(updatedCount);
}

async function getCurrentStravaConnection(tenantId: number | string, userId: number, requireActive = false): Promise<StravaConnectionRecord | null> {
  const connection = await strapi.db.query(STRAVA_CONNECTION_UID).findOne({
    where: mergeTenantWhere({ user: { id: userId } }, tenantId),
    select: ['id', 'status', 'accessToken', 'refreshToken', 'tokenExpiresAt', 'lastSyncAt', 'lastSyncStatus', 'athleteFirstname', 'athleteLastname', 'athleteUsername', 'profileUrl'],
  });

  if (!connection?.id) return null;
  if (requireActive && toText(connection.status) !== 'ACTIVE') {
    throw Object.assign(new Error('Strava connection is not active'), { status: 400 });
  }
  return connection as StravaConnectionRecord;
}

async function resolveUserFromJwt(ctx: any): Promise<AuthUser | null> {
  try {
    const authHeader = ctx.request?.headers?.authorization || ctx.request?.header?.authorization || '';
    const token = typeof authHeader === 'string' && authHeader.startsWith('Bearer ')
      ? authHeader.slice(7).trim()
      : '';

    if (!token) return null;

    const jwtService = strapi.plugin('users-permissions')?.service('jwt');
    if (!jwtService) return null;

    const decoded = await jwtService.verify(token);
    const userId = toPositiveInt(decoded?.id);
    if (!userId) return null;

    return strapi.db.query(USER_UID).findOne({
      where: { id: userId },
      select: ['id', 'email', 'username', 'blocked'],
    });
  } catch {
    return null;
  }
}

export async function requireAuthenticatedUser(ctx: any): Promise<AuthUser | null> {
  let authUser = ctx.state?.user as AuthUser | undefined;
  if (!authUser?.id) {
    authUser = await resolveUserFromJwt(ctx) || undefined;
    if (authUser?.id) {
      ctx.state.user = authUser;
    }
  }

  if (!authUser?.id) {
    ctx.unauthorized('Unauthorized');
    return null;
  }

  if (authUser?.blocked) {
    ctx.unauthorized('Account is blocked');
    return null;
  }

  return authUser;
}

export function getCurrentTenantId(ctx: any): number | string {
  return resolveCurrentTenantId(ctx);
}

export function buildStravaAuthorizeUrl(state: string): string {
  const url = new URL(STRAVA_AUTHORIZE_URL);
  url.searchParams.set('client_id', resolveStravaClientId());
  url.searchParams.set('redirect_uri', resolveStravaRedirectUri());
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('approval_prompt', 'auto');
  url.searchParams.set('scope', resolveStravaScopes());
  url.searchParams.set('state', state);
  return url.toString();
}

export async function createSignedOAuthState(tenantId: number | string, userId: number, options: { frontendOrigin: string }): Promise<string> {
  const nonce = crypto.randomBytes(18).toString('base64url');
  const payload: SignedStatePayload = {
    tenantId: String(tenantId),
    userId,
    nonce,
    issuedAt: Date.now(),
  };

  const encodedPayload = encodePayload(payload);
  const signature = signPayload(encodedPayload);
  const state = `${encodedPayload}.${signature}`;
  const stateHash = computeStateHash(state);
  const expiresAt = new Date(payload.issuedAt + OAUTH_STATE_TTL_MS).toISOString();

  await strapi.db.query(STRAVA_OAUTH_STATE_UID).create({
    data: {
      tenant: tenantId,
      user: userId,
      nonce,
      frontendOrigin: trimTrailingSlash(options.frontendOrigin || ''),
      stateHash,
      expiresAt,
      usedAt: null,
    },
  });

  return state;
}

export async function verifySignedOAuthState(state: string): Promise<VerifiedOAuthState> {
  const trimmedState = toText(state);
  if (!trimmedState || !trimmedState.includes('.')) {
    throw Object.assign(new Error('Invalid OAuth state'), { status: 400 });
  }

  const [encodedPayload, signature] = trimmedState.split('.');
  const expectedSignature = signPayload(encodedPayload);
  if (signature.length !== expectedSignature.length) {
    throw Object.assign(new Error('Invalid OAuth state'), { status: 400 });
  }

  const isValidSignature = crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature));
  if (!isValidSignature) {
    throw Object.assign(new Error('Invalid OAuth state'), { status: 400 });
  }

  const payload = decodePayload(encodedPayload);
  const issuedAt = Number(payload?.issuedAt || 0);
  const userId = toPositiveInt(payload?.userId);
  const tenantId = toText(payload?.tenantId);
  const nonce = toText(payload?.nonce);
  if (!issuedAt || !userId || !tenantId || !nonce) {
    throw Object.assign(new Error('Invalid OAuth state'), { status: 400 });
  }

  if (issuedAt + OAUTH_STATE_TTL_MS < Date.now()) {
    throw Object.assign(new Error('OAuth state expired'), { status: 400 });
  }

  const record = await findStravaOAuthStateRecordByState(trimmedState);

  const recordTenantId = toText(record?.tenant?.id || record?.tenant);
  const recordUserId = toPositiveInt(record?.user?.id || record?.user);
  const recordNonce = toText(record?.nonce);
  const recordExpiresAt = record?.expiresAt ? new Date(record.expiresAt).getTime() : 0;
  const recordFrontendOrigin = normalizeAbsoluteOrigin(record?.frontendOrigin || '') || null;

  if (!record?.id || record?.usedAt || !recordTenantId || !recordUserId) {
    throw Object.assign(new Error('OAuth state already used or missing'), { status: 400 });
  }

  if (recordTenantId !== tenantId || recordUserId !== userId || recordNonce !== nonce) {
    throw Object.assign(new Error('OAuth state mismatch'), { status: 400 });
  }

  if (!recordExpiresAt || recordExpiresAt < Date.now()) {
    throw Object.assign(new Error('OAuth state expired'), { status: 400 });
  }

  return {
    tenantId,
    userId,
    nonce,
    issuedAt,
    recordId: Number(record.id),
    frontendOrigin: recordFrontendOrigin,
  };
}

export async function consumeOAuthState(recordId: number): Promise<void> {
  const nowIso = new Date().toISOString();
  const updatedCount = await strapi.db.connection('strava_oauth_states')
    .where({ id: recordId })
    .whereNull('used_at')
    .update({ used_at: nowIso });

  if (!updatedCount) {
    throw Object.assign(new Error('OAuth state already used'), { status: 400 });
  }
}

export async function exchangeCodeForToken(code: string): Promise<StravaTokenResponse> {
  const body = new URLSearchParams();
  body.set('client_id', resolveStravaClientId());
  body.set('client_secret', resolveStravaClientSecret());
  body.set('code', toText(code));
  body.set('grant_type', 'authorization_code');

  const response = await fetch(STRAVA_TOKEN_URL, {
    method: 'POST',
    headers: {
      'content-type': 'application/x-www-form-urlencoded',
    },
    body,
  });

  if (!response.ok) {
    throw Object.assign(new Error(`Strava token exchange failed with status ${response.status}`), { status: 502 });
  }

  const parsed = await response.json() as StravaTokenResponse;
  if (!toText(parsed?.access_token) || !toText(parsed?.refresh_token) || !toPositiveInt(parsed?.expires_at)) {
    throw Object.assign(new Error('Strava token response is incomplete'), { status: 502 });
  }

  return parsed;
}

export async function refreshStravaToken(connection: StravaConnectionRecord): Promise<StravaConnectionRecord> {
  const refreshToken = toText(connection?.refreshToken);
  if (!refreshToken) {
    await updateConnectionSyncState(connection.id, {
      status: 'ERROR',
      lastSyncStatus: 'FAILED',
      lastSyncError: 'Missing refresh token. Please reconnect Strava.',
    });
    throw Object.assign(new Error('Strava token refresh failed. Please reconnect Strava.'), { status: 401 });
  }

  const body = new URLSearchParams();
  body.set('client_id', resolveStravaClientId());
  body.set('client_secret', resolveStravaClientSecret());
  body.set('grant_type', 'refresh_token');
  body.set('refresh_token', refreshToken);

  const response = await fetch(STRAVA_TOKEN_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body,
  });

  if (!response.ok) {
    await updateConnectionSyncState(connection.id, {
      status: 'ERROR',
      lastSyncStatus: 'FAILED',
      lastSyncError: 'Token refresh failed. Please reconnect Strava.',
    });
    throw Object.assign(new Error('Strava token refresh failed. Please reconnect Strava.'), { status: 401 });
  }

  const parsed = await response.json() as StravaTokenResponse;
  const nextAccessToken = toText(parsed?.access_token);
  const nextRefreshToken = toText(parsed?.refresh_token);
  const nextExpiresAt = toPositiveInt(parsed?.expires_at);
  if (!nextAccessToken || !nextRefreshToken || !nextExpiresAt) {
    await updateConnectionSyncState(connection.id, {
      status: 'ERROR',
      lastSyncStatus: 'FAILED',
      lastSyncError: 'Token refresh returned incomplete data. Please reconnect Strava.',
    });
    throw Object.assign(new Error('Strava token refresh failed. Please reconnect Strava.'), { status: 401 });
  }

  const updated = await updateConnectionSyncState(connection.id, {
    accessToken: nextAccessToken,
    refreshToken: nextRefreshToken,
    tokenExpiresAt: new Date(nextExpiresAt * 1000).toISOString(),
    status: 'ACTIVE',
    lastSyncError: null,
  });

  return {
    ...(connection || {}),
    ...(updated || {}),
    id: connection.id,
    accessToken: nextAccessToken,
    refreshToken: nextRefreshToken,
    tokenExpiresAt: new Date(nextExpiresAt * 1000).toISOString(),
    status: 'ACTIVE',
  } as StravaConnectionRecord;
}

export async function getValidAccessToken(connection: StravaConnectionRecord): Promise<string> {
  const accessToken = toText(connection?.accessToken);
  const tokenExpiresAt = connection?.tokenExpiresAt ? new Date(connection.tokenExpiresAt).getTime() : 0;

  if (!accessToken || !tokenExpiresAt || tokenExpiresAt <= Date.now() + ACCESS_TOKEN_REFRESH_THRESHOLD_MS) {
    const refreshed = await refreshStravaToken(connection);
    const nextAccessToken = toText(refreshed?.accessToken);
    if (!nextAccessToken) {
      throw Object.assign(new Error('Strava token refresh failed. Please reconnect Strava.'), { status: 401 });
    }
    return nextAccessToken;
  }

  return accessToken;
}

async function fetchStravaActivityPage(accessToken: string, options: { page: number; perPage: number; after?: number | null }) {
  const url = new URL(STRAVA_ACTIVITIES_URL);
  url.searchParams.set('page', String(options.page));
  url.searchParams.set('per_page', String(options.perPage));
  if (options.after && options.after > 0) {
    url.searchParams.set('after', String(options.after));
  }

  let response: Response;
  try {
    response = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });
  } catch (error) {
    throw Object.assign(new Error('Strava network request failed'), {
      code: 'STRAVA_NETWORK_ERROR',
      status: 503,
      cause: error,
    });
  }

  const retryAfter = toPositiveInt(response.headers.get('retry-after'));
  const rateLimitResetAtHeader = toText(response.headers.get('x-ratelimit-reset') || response.headers.get('x-readratelimit-reset') || '');
  const rateLimitResetAt = retryAfter
    ? new Date(Date.now() + retryAfter * 1000).toISOString()
    : (rateLimitResetAtHeader ? new Date(Date.now() + Number(rateLimitResetAtHeader) * 1000).toISOString() : null);

  if (response.status === 429) {
    throw Object.assign(new Error('Strava rate limit reached. Please try again later.'), {
      code: 'STRAVA_RATE_LIMITED',
      status: 429,
      nextRetryAt: rateLimitResetAt,
      rateLimitResetAt,
    });
  }

  if (response.status === 401) {
    throw Object.assign(new Error('Strava access token is no longer valid.'), {
      code: 'STRAVA_AUTH_EXPIRED',
      status: 401,
    });
  }

  if (response.status === 403) {
    let bodyText = '';
    try {
      bodyText = await response.text();
    } catch {
      bodyText = '';
    }
    const lowered = bodyText.toLowerCase();
    const code = lowered.includes('scope') ? 'STRAVA_SCOPE_MISSING' : 'STRAVA_SYNC_PERMISSION_DENIED';
    throw Object.assign(new Error('Strava permission denied.'), {
      code,
      status: 403,
      body: bodyText,
    });
  }

  if ([500, 502, 503, 504].includes(response.status)) {
    throw Object.assign(new Error(`Strava service unavailable (${response.status})`), {
      code: 'STRAVA_SERVICE_UNAVAILABLE',
      status: response.status,
    });
  }

  if (!response.ok) {
    throw Object.assign(new Error(`Failed to fetch Strava activities (${response.status})`), {
      code: 'STRAVA_ACTIVITY_FETCH_FAILED',
      status: response.status,
    });
  }

  const parsed = await response.json();
  if (!Array.isArray(parsed)) {
    throw Object.assign(new Error('Strava activities response is invalid'), {
      code: 'STRAVA_ACTIVITY_FETCH_FAILED',
      status: 502,
    });
  }

  return {
    items: parsed,
    rateLimitResetAt,
  };
}

async function fetchStravaActivityPageWithRecovery(
  connection: StravaConnectionRecord,
  options: { page: number; perPage: number; after?: number | null },
) {
  let accessToken = await refreshStravaTokenIfNeeded(connection);

  try {
    return await fetchStravaActivityPage(accessToken, options);
  } catch (error: any) {
    const classification = classifyStravaSyncError(error, { phase: 'syncing_history' });
    if (classification.httpStatus !== 401 && classification.code !== 'STRAVA_AUTH_EXPIRED') {
      throw error;
    }

    try {
      const refreshed = await refreshStravaToken(connection);
      accessToken = toText(refreshed?.accessToken);
      if (!accessToken) {
        throw Object.assign(new Error('Strava token refresh failed'), { code: 'STRAVA_TOKEN_REFRESH_FAILED', status: 401 });
      }
    } catch (refreshError) {
      throw Object.assign(new Error('Strava connection revoked after token refresh failed.'), {
        code: 'STRAVA_TOKEN_REFRESH_FAILED',
        status: 401,
        cause: refreshError,
      });
    }

    try {
      return await fetchStravaActivityPage(accessToken, options);
    } catch (retryError: any) {
      const retryClassification = classifyStravaSyncError(retryError, { phase: 'syncing_history' });
      if (retryClassification.httpStatus === 401 || retryClassification.code === 'STRAVA_AUTH_EXPIRED') {
        throw Object.assign(new Error('Strava connection is no longer valid.'), {
          code: 'STRAVA_CONNECTION_REVOKED',
          status: 401,
          cause: retryError,
        });
      }
      throw retryError;
    }
  }
}

function normalizeStravaActivity(activity: Record<string, any>) {
  return activity && typeof activity === 'object' ? activity : {};
}

function buildActivityPayload(tenantId: number | string, userId: number, connectionId: number, activity: Record<string, any>) {
  const mapData = activity?.map && typeof activity.map === 'object' ? activity.map : {};
  return {
    tenant: tenantId,
    user: userId,
    connection: connectionId,
    stravaActivityId: toText(activity?.id),
    name: toText(activity?.name) || null,
    type: toText(activity?.type) || null,
    sportType: toText(activity?.sport_type || activity?.sportType) || null,
    startDate: toIsoDateTime(activity?.start_date),
    startDateLocal: toIsoDateTime(activity?.start_date_local),
    timezone: toText(activity?.timezone) || null,
    distance: activity?.distance ?? null,
    movingTime: toPositiveInt(activity?.moving_time) ?? null,
    elapsedTime: toPositiveInt(activity?.elapsed_time) ?? null,
    totalElevationGain: activity?.total_elevation_gain ?? null,
    averageSpeed: activity?.average_speed ?? null,
    maxSpeed: activity?.max_speed ?? null,
    averageHeartrate: activity?.average_heartrate ?? null,
    maxHeartrate: activity?.max_heartrate ?? null,
    calories: activity?.calories ?? null,
    achievementCount: toPositiveInt(activity?.achievement_count) ?? 0,
    kudosCount: toPositiveInt(activity?.kudos_count) ?? 0,
    locationCountry: toText(activity?.location_country) || null,
    locationCity: toText(activity?.location_city) || null,
    hasMap: Boolean(mapData?.summary_polyline),
    mapSummaryPolyline: toText(mapData?.summary_polyline) || null,
    visibility: normalizeVisibility(activity?.visibility),
    syncStatus: 'SYNCED',
    rawActivity: activity,
  };
}

async function upsertStravaActivity(tenantId: number | string, userId: number, connectionId: number, activity: Record<string, any>, options: { transacting?: any } = {}) {
  const stravaActivityId = toText(activity?.id);
  if (!stravaActivityId) return { created: false, updated: false, skipped: true };

  const existing = await strapi.db.query(STRAVA_ACTIVITY_UID).findOne({
    where: mergeTenantWhere({ user: { id: userId }, stravaActivityId }, tenantId),
    select: ['id', 'name', 'type', 'sportType', 'startDate', 'startDateLocal', 'timezone', 'distance', 'movingTime', 'elapsedTime', 'totalElevationGain', 'averageSpeed', 'maxSpeed', 'averageHeartrate', 'maxHeartrate', 'calories', 'achievementCount', 'kudosCount', 'locationCountry', 'locationCity', 'hasMap', 'mapSummaryPolyline', 'visibility', 'syncStatus'],
    ...(options.transacting ? { transacting: options.transacting } : {}),
  } as any);

  const payload = buildActivityPayload(tenantId, userId, connectionId, activity);

  if (existing?.id) {
    if (!shouldUpdateExistingActivity(existing as Record<string, any>, payload)) {
      return { created: false, updated: false, skipped: true };
    }
    await strapi.db.query(STRAVA_ACTIVITY_UID).update({ where: { id: existing.id }, data: payload, ...(options.transacting ? { transacting: options.transacting } : {}) } as any);
    return { created: false, updated: true, skipped: false };
  }

  await strapi.db.query(STRAVA_ACTIVITY_UID).create({ data: payload, ...(options.transacting ? { transacting: options.transacting } : {}) } as any);
  return { created: true, updated: false, skipped: false };
}

async function persistStravaActivityBatch(
  tenantId: number | string,
  userId: number,
  connectionId: number,
  activities: Record<string, any>[],
  options: { transacting?: any } = {},
): Promise<PersistActivityCounters> {
  const counters: PersistActivityCounters = {
    processed: 0,
    created: 0,
    updated: 0,
    skipped: 0,
    failed: 0,
    newestSyncedAt: null,
    oldestSyncedAt: null,
    lastProcessedActivityId: null,
  };

  for (const rawActivity of activities) {
    const activity = normalizeStravaActivity(rawActivity);
    const activityDate = toIsoDateTime(activity?.start_date || activity?.start_date_local || null);
    if (!counters.newestSyncedAt && activityDate) counters.newestSyncedAt = activityDate;
    if (activityDate) counters.oldestSyncedAt = activityDate;
    counters.lastProcessedActivityId = toText(activity?.id) || counters.lastProcessedActivityId;
    counters.processed += 1;

    try {
      const result = await upsertStravaActivity(tenantId, userId, connectionId, activity, options);
      if (result.created) counters.created += 1;
      else if (result.updated) counters.updated += 1;
      else counters.skipped += 1;
    } catch {
      counters.failed += 1;
    }
  }

  return counters;
}

async function getLatestActivityStartDateMs(tenantId: number | string, userId: number): Promise<number | null> {
  const rows = await strapi.db.query(STRAVA_ACTIVITY_UID).findMany({
    where: buildSyncedActivityWhere(tenantId, userId),
    select: ['id', 'startDate'],
    orderBy: [{ startDate: 'desc' }, { id: 'desc' }],
    limit: 1,
  });
  const latest = Array.isArray(rows) ? rows[0] : null;
  if (!latest?.startDate) return null;
  const time = new Date(latest.startDate).getTime();
  return Number.isNaN(time) ? null : time;
}

async function computeActivitySummary(tenantId: number | string, userId: number) {
  const rows = await strapi.db.query(STRAVA_ACTIVITY_UID).findMany({
    where: buildSyncedActivityWhere(tenantId, userId),
    select: ['id', 'distance', 'movingTime', 'totalElevationGain'],
  });

  const totalActivities = Array.isArray(rows) ? rows.length : 0;
  const totalDistance = (rows || []).reduce((sum: number, row: Record<string, any>) => sum + Number(row?.distance || 0), 0);
  const totalMovingTime = (rows || []).reduce((sum: number, row: Record<string, any>) => sum + Number(row?.movingTime || 0), 0);
  const totalElevationGain = (rows || []).reduce((sum: number, row: Record<string, any>) => sum + Number(row?.totalElevationGain || 0), 0);

  return {
    totalActivities,
    totalDistance,
    totalMovingTime,
    totalElevationGain,
  };
}

async function markStravaSyncJobFailed(jobId: number, errorCode: string, errorMessage: string, extras: Record<string, unknown> = {}) {
  const job = await getStravaSyncJobContext(jobId);
  if (!job?.id) {
    throw Object.assign(new Error('Strava sync job not found'), { code: 'STRAVA_SYNC_JOB_NOT_FOUND', status: 404 });
  }

  const nowIso = new Date().toISOString();
  const friendlyMessage = buildStravaSyncClientMessage(errorCode, sanitizeSyncErrorMessage(errorMessage));
  const metadataPatch = extras.metadata && typeof extras.metadata === 'object' && !Array.isArray(extras.metadata)
    ? extras.metadata as Record<string, unknown>
    : {};

  await updateStravaSyncJobCheckpoint(jobId, {
    status: 'failed',
    failedAt: nowIso,
    heartbeatAt: nowIso,
    nextRetryAt: extras.nextRetryAt || null,
    retryCount: Math.max(0, Number(job.retryCount || 0)) + (extras.incrementRetry === false ? 0 : 1),
    lastErrorCode: errorCode,
    lastErrorMessage: friendlyMessage,
    metadata: mergeJobMetadata(job, metadataPatch),
  });

  const connectionId = resolveJobConnectionId(job);
  if (connectionId) {
    await updateConnectionSyncState(connectionId, {
      lastSyncStatus: 'FAILED',
      lastSyncError: friendlyMessage,
      status: errorCode === 'STRAVA_TOKEN_REFRESH_FAILED' ? 'ERROR' : 'ACTIVE',
    });
  }
}

async function markStravaSyncJobCompleted(jobId: number) {
  const job = await getStravaSyncJobContext(jobId);
  await assertCanWriteAnalyticsSnapshot(job as StravaSyncJobRecord);

  const nowIso = new Date().toISOString();
  await updateStravaSyncJobCheckpoint(jobId, {
    status: 'completed',
    phase: 'finalizing',
    completedAt: nowIso,
    heartbeatAt: nowIso,
    nextRetryAt: null,
    lastErrorCode: null,
    lastErrorMessage: null,
    metadata: mergeJobMetadata(job, {
      ...mergeJobMetadata(job, {}),
      snapshotIsComplete: true,
      lastCompletedSyncAt: nowIso,
      snapshotRebuiltAt: toText(mergeJobMetadata(job, {}).snapshotRebuiltAt || '') || nowIso,
    }),
  });

  const connectionId = resolveJobConnectionId(job);
  if (connectionId) {
    await updateConnectionSyncState(connectionId, {
      lastSyncAt: nowIso,
      lastSyncStatus: 'SUCCESS',
      lastSyncError: null,
      status: 'ACTIVE',
    });
  }

  const tenantId = resolveJobTenantId(job);
  const userId = resolveJobUserId(job);
  return userId ? computeActivitySummary(tenantId, userId) : null;
}

async function createStravaSyncJob(options: {
  tenantId: number | string;
  userId: number;
  connectionId: number;
  syncMode: JobSyncMode;
  perPage?: number;
}) {
  const nowIso = new Date().toISOString();
  const perPage = options.perPage || resolveStravaSyncBatchSize();
  const created = await strapi.db.query(STRAVA_SYNC_JOB_UID).create({
    data: {
      tenant: options.tenantId,
      user: options.userId,
      connection: options.connectionId,
      status: 'queued',
      phase: 'preparing',
      syncMode: options.syncMode,
      currentPage: 1,
      perPage,
      processedActivities: 0,
      createdActivities: 0,
      updatedActivities: 0,
      skippedActivities: 0,
      failedActivities: 0,
      retryCount: 0,
      requestedAt: nowIso,
      heartbeatAt: nowIso,
      metadata: {
        recentActivityLimit: resolveStravaInitialRecentActivityLimit(),
        recentProcessed: 0,
        recentPagesProcessed: 0,
        pagesProcessed: 0,
        lastCompletedPage: null,
        lastCompletedPhase: null,
        lastProcessedActivityId: null,
        rateLimitResetAt: null,
        initialRecentBatchCompleted: false,
        recentReadyAt: null,
        historyExhausted: false,
        afterTimestamp: null,
        snapshotSummary: null,
        snapshotIsComplete: false,
        snapshotRebuiltAt: null,
        lastCompletedSyncAt: null,
      },
    },
  });

  return Number(created?.id || 0);
}

async function assertJobNotCancelled(jobId: number) {
  const job = await getStravaSyncJobContext(jobId);
  if (!job?.id) {
    throw Object.assign(new Error('Strava sync job not found'), { code: 'STRAVA_SYNC_JOB_NOT_FOUND', status: 404 });
  }
  if (normalizeJobStatus(job.status) === 'cancelled') {
    throw Object.assign(new Error('Strava sync job is cancelled'), { code: 'STRAVA_SYNC_CANCELLED', status: 409 });
  }
  return job;
}

async function rebuildStravaJobSnapshot(jobId: number, options: { complete: boolean }) {
  const job = await getStravaSyncJobContext(jobId);
  await assertCanWriteAnalyticsSnapshot(job as StravaSyncJobRecord);

  const tenantId = resolveJobTenantId(job);
  const userId = resolveJobUserId(job);
  if (!tenantId || !userId) {
    throw Object.assign(new Error('Strava sync job relations are incomplete'), { code: 'STRAVA_SYNC_JOB_INVALID_STATE', status: 409 });
  }

  let summary;
  try {
    summary = await computeActivitySummary(tenantId, userId);
  } catch (error) {
    throw Object.assign(new Error('Không thể tính lại snapshot Strava từ activity đã đồng bộ.'), {
      code: 'STRAVA_SNAPSHOT_REBUILD_FAILED',
      status: 500,
      cause: error,
    });
  }
  const nowIso = new Date().toISOString();
  try {
    await updateStravaSyncJobCheckpoint(jobId, {
      heartbeatAt: nowIso,
      metadata: mergeJobMetadata(job, {
        ...mergeJobMetadata(job, {}),
        snapshotSummary: summary,
        snapshotIsComplete: options.complete === true,
        snapshotRebuiltAt: nowIso,
        lastCompletedSyncAt: options.complete === true
          ? (toText(job?.completedAt || '') || nowIso)
          : mergeJobMetadata(job, {}).lastCompletedSyncAt || null,
      }),
    });
  } catch (error) {
    throw Object.assign(new Error('Không thể ghi snapshot Strava sau khi rebuild.'), {
      code: 'STRAVA_SNAPSHOT_WRITE_FAILED',
      status: 500,
      cause: error,
    });
  }

  return summary;
}

async function markStravaSyncJobPartialReady(jobId: number) {
  const job = await getStravaSyncJobContext(jobId);
  await assertCanWriteAnalyticsSnapshot(job as StravaSyncJobRecord);

  const nowIso = new Date().toISOString();
  const metadata = mergeJobMetadata(job, {});
  const summary = await rebuildStravaJobSnapshot(jobId, { complete: false });
  const historyExhausted = metadata.historyExhausted === true;

  await updateStravaSyncJobCheckpoint(jobId, {
    status: 'partial_ready',
    phase: historyExhausted ? 'rebuilding_snapshot' : 'syncing_history',
    heartbeatAt: nowIso,
    metadata: mergeJobMetadata(job, {
      ...metadata,
      initialRecentBatchCompleted: true,
      recentReadyAt: metadata.recentReadyAt || nowIso,
      snapshotSummary: summary,
      snapshotIsComplete: false,
      snapshotRebuiltAt: nowIso,
    }),
  });

  const connectionId = resolveJobConnectionId(job);
  if (connectionId) {
    await updateConnectionSyncState(connectionId, {
      lastSyncAt: nowIso,
      lastSyncStatus: 'PARTIAL',
      lastSyncError: null,
      status: 'ACTIVE',
    });
  }

  return {
    phase: historyExhausted ? 'rebuilding_snapshot' as JobPhase : 'syncing_history' as JobPhase,
    summary,
  };
}

export async function processStravaSyncBatch(jobId: number): Promise<StravaBatchResult> {
  const job = await getStravaSyncJobContext(jobId);
  const context = validateStravaSyncJob(job);
  const nowIso = new Date().toISOString();

  if (normalizeJobStatus(job?.status) === 'cancelled') {
    throw Object.assign(new Error('Strava sync job is cancelled'), { code: 'STRAVA_SYNC_CANCELLED', status: 409 });
  }

  await updateStravaSyncJobCheckpoint(jobId, {
    status: context.status === 'partial_ready' ? 'partial_ready' : 'running',
    startedAt: job?.startedAt || nowIso,
    heartbeatAt: nowIso,
    nextRetryAt: null,
  });

  const reloaded = await getStravaSyncJobContext(jobId);
  const currentPhase = normalizeJobPhase(reloaded?.phase);
  const currentPage = Math.max(1, Number(reloaded?.currentPage || 1));
  const perPage = Math.max(1, Number(reloaded?.perPage || resolveStravaSyncBatchSize()));
  const metadata = mergeJobMetadata(reloaded!, {});
  const recentLimit = Math.max(1, Number(metadata.recentActivityLimit || resolveStravaInitialRecentActivityLimit()));
  const recentProcessed = Math.max(0, Number(metadata.recentProcessed || 0));
  const initialRecentBatchCompleted = metadata.initialRecentBatchCompleted === true;
  const historyExhausted = metadata.historyExhausted === true;

  try {
    if (currentPhase === 'preparing') {
      const latestStartDateMs = context.syncMode === 'incremental'
        ? await getLatestActivityStartDateMs(context.tenantId, context.userId)
        : null;
      const effectiveSyncMode: JobSyncMode = context.syncMode === 'incremental' && !latestStartDateMs ? 'initial' : context.syncMode;
      const afterTimestamp = effectiveSyncMode === 'incremental' && latestStartDateMs
        ? Math.max(0, Math.floor((latestStartDateMs - INCREMENTAL_BACKTRACK_MS) / 1000))
        : null;
      const nextPhase: JobPhase = effectiveSyncMode === 'initial' ? 'syncing_recent' : 'syncing_history';

      await updateStravaSyncJobCheckpoint(jobId, {
        syncMode: effectiveSyncMode,
        phase: nextPhase,
        currentPage: currentPage || 1,
        perPage,
        status: 'running',
        heartbeatAt: new Date().toISOString(),
        metadata: mergeJobMetadata(reloaded!, {
          ...metadata,
          recentActivityLimit: recentLimit,
          recentProcessed: recentProcessed,
          recentPagesProcessed: Number(metadata.recentPagesProcessed || 0),
          afterTimestamp,
          pagesProcessed: Number(metadata.pagesProcessed || 0),
          historyExhausted: historyExhausted,
        }),
      });

      return {
        ok: true,
        jobId,
        status: 'running',
        phase: nextPhase,
      };
    }

    if (currentPhase === 'rebuilding_snapshot') {
      await assertJobNotCancelled(jobId);
      const summary = await rebuildStravaJobSnapshot(jobId, { complete: true });
      await updateStravaSyncJobCheckpoint(jobId, {
        phase: 'finalizing',
        heartbeatAt: new Date().toISOString(),
      });
      return {
        ok: true,
        jobId,
        status: normalizeJobStatus(reloaded?.status) === 'partial_ready' ? 'partial_ready' : 'running',
        phase: 'finalizing',
        summary,
      };
    }

    if (currentPhase === 'finalizing') {
      const summary = await markStravaSyncJobCompleted(jobId);
      return {
        ok: true,
        jobId,
        status: 'completed',
        phase: 'finalizing',
        completed: true,
        summary: summary || undefined,
      };
    }

    if (currentPhase === 'syncing_recent' && !initialRecentBatchCompleted && (recentProcessed >= recentLimit || historyExhausted)) {
      await assertJobNotCancelled(jobId);
      const partial = await markStravaSyncJobPartialReady(jobId);
      return {
        ok: true,
        jobId,
        status: 'partial_ready',
        phase: partial.phase,
        summary: partial.summary,
      };
    }

    const activeJobBeforeFetch = await assertJobNotCancelled(jobId);
    const connection = await getStravaConnectionForJob(activeJobBeforeFetch);
    const afterTimestamp = toPositiveInt(metadata.afterTimestamp);
    const fetched = await fetchStravaActivityPageWithRecovery(connection, {
      page: currentPage,
      perPage,
      after: afterTimestamp,
    });

    if (!fetched.items.length) {
      const nextStatus: JobStatus = currentPhase === 'syncing_history' && initialRecentBatchCompleted ? 'partial_ready' : 'running';
      await updateStravaSyncJobCheckpoint(jobId, {
        phase: 'rebuilding_snapshot',
        status: nextStatus,
        heartbeatAt: new Date().toISOString(),
        metadata: mergeJobMetadata(reloaded!, {
          ...metadata,
          historyExhausted: true,
          rateLimitResetAt: fetched.rateLimitResetAt || metadata.rateLimitResetAt || null,
        }),
      });

      return {
        ok: true,
        jobId,
        status: nextStatus,
        phase: 'rebuilding_snapshot',
        exhausted: true,
      };
    }

    await assertJobNotCancelled(jobId);

    const persisted = await strapi.db.transaction(async ({ trx }: any) => {
      const counters = await persistStravaActivityBatch(context.tenantId, context.userId, connection.id, fetched.items, { transacting: trx });
      if (counters.failed === fetched.items.length && counters.created === 0 && counters.updated === 0 && counters.skipped === 0) {
        throw Object.assign(new Error('Failed to persist Strava activity batch'), {
          code: 'STRAVA_ACTIVITY_PERSIST_FAILED',
          status: 500,
        });
      }

      const isRecentPhase = currentPhase === 'syncing_recent';
      const nextRecentProcessed = recentProcessed + counters.processed;
      const nextHistoryExhausted = fetched.items.length < perPage;
      const nextPhase = nextHistoryExhausted ? 'rebuilding_snapshot' : currentPhase;
      const nextPage = nextHistoryExhausted ? currentPage : currentPage + 1;
      const nextHeartbeat = new Date().toISOString();
      const nextStatus: JobStatus = currentPhase === 'syncing_history' && initialRecentBatchCompleted
        ? 'partial_ready'
        : 'running';

      await updateStravaSyncJobCheckpoint(jobId, {
        phase: nextPhase,
        status: nextStatus,
        currentPage: nextPage,
        processedActivities: Number(reloaded?.processedActivities || 0) + counters.processed,
        createdActivities: Number(reloaded?.createdActivities || 0) + counters.created,
        updatedActivities: Number(reloaded?.updatedActivities || 0) + counters.updated,
        skippedActivities: Number(reloaded?.skippedActivities || 0) + counters.skipped,
        failedActivities: Number(reloaded?.failedActivities || 0) + counters.failed,
        newestSyncedAt: reloaded?.newestSyncedAt || counters.newestSyncedAt,
        oldestSyncedAt: counters.oldestSyncedAt || reloaded?.oldestSyncedAt || null,
        heartbeatAt: nextHeartbeat,
        lastErrorCode: null,
        lastErrorMessage: null,
        metadata: mergeJobMetadata(reloaded!, {
          ...metadata,
          recentProcessed: isRecentPhase ? nextRecentProcessed : recentProcessed,
          recentPagesProcessed: isRecentPhase ? Number(metadata.recentPagesProcessed || 0) + 1 : Number(metadata.recentPagesProcessed || 0),
          pagesProcessed: Number(metadata.pagesProcessed || 0) + 1,
          lastCompletedPage: currentPage,
          lastCompletedPhase: currentPhase,
          lastProcessedActivityId: counters.lastProcessedActivityId,
          rateLimitResetAt: fetched.rateLimitResetAt || null,
          historyExhausted: nextHistoryExhausted,
        }),
      }, { transacting: trx });

      return {
        counters,
        nextRecentProcessed,
        nextHistoryExhausted,
        nextPhase,
        nextStatus,
      };
    });

    const counters = persisted.counters;
    const reachedRecentLimit = currentPhase === 'syncing_recent' && persisted.nextRecentProcessed >= recentLimit;
    const shouldTransitionToPartialReady = currentPhase === 'syncing_recent' && !initialRecentBatchCompleted && (reachedRecentLimit || persisted.nextHistoryExhausted);

    if (shouldTransitionToPartialReady) {
      const partial = await markStravaSyncJobPartialReady(jobId);
      return {
        ok: true,
        jobId,
        status: 'partial_ready',
        phase: partial.phase,
        exhausted: persisted.nextHistoryExhausted,
        counters,
        summary: partial.summary,
      };
    }

    return {
      ok: true,
      jobId,
      status: persisted.nextStatus,
        phase: persisted.nextPhase as JobPhase,
        exhausted: persisted.nextPhase === 'rebuilding_snapshot',
      counters,
    };
  } catch (error: any) {
    const classified = classifyStravaSyncError(error, { phase: currentPhase });

    if (classified.code === 'STRAVA_RATE_LIMITED') {
      await updateStravaSyncJobCheckpoint(jobId, {
        heartbeatAt: new Date().toISOString(),
        metadata: mergeJobMetadata(reloaded!, {
          ...metadata,
          rateLimitResetAt: classified.retryAfter || null,
        }),
      });
    }

    if (classified.retryable) {
      throw Object.assign(new Error(classified.message), {
        code: classified.code,
        status: classified.httpStatus || error?.status || 500,
        retryAfter: classified.retryAfter,
        nextRetryAt: classified.retryAfter,
        retryable: true,
        category: classified.category,
      });
    }

    if (classified.category !== 'cancelled') {
      await markStravaSyncJobFailed(jobId, classified.code, classified.message, {
        incrementRetry: false,
      });
    }

    throw Object.assign(new Error(classified.message), {
      code: classified.code,
      status: classified.httpStatus || error?.status || 500,
      retryable: false,
      category: classified.category,
    });
  }
}

export async function upsertStravaConnection(
  tenantId: number | string,
  userId: number,
  tokenResponse: StravaTokenResponse,
  callbackScope?: string,
): Promise<any> {
  const athlete = tokenResponse?.athlete || {};
  const stravaAthleteId = toText(athlete?.id);
  if (!stravaAthleteId) {
    throw Object.assign(new Error('Strava athlete data is missing'), { status: 502 });
  }

  const existing = await strapi.db.query(STRAVA_CONNECTION_UID).findOne({
    where: mergeTenantWhere({ user: { id: userId } }, tenantId),
    select: ['id', 'lastSyncStatus'],
  });

  const payload = {
    tenant: tenantId,
    user: userId,
    stravaAthleteId,
    athleteUsername: toText(athlete?.username) || null,
    athleteFirstname: toText(athlete?.firstname) || null,
    athleteLastname: toText(athlete?.lastname) || null,
    profileUrl: toText(athlete?.profile) || null,
    accessToken: toText(tokenResponse?.access_token),
    refreshToken: toText(tokenResponse?.refresh_token),
    tokenExpiresAt: new Date(Number(tokenResponse?.expires_at) * 1000).toISOString(),
    scope: toText(tokenResponse?.scope) || toText(callbackScope) || resolveStravaScopes(),
    status: 'ACTIVE',
    disconnectedAt: null,
    rawAthlete: athlete,
    lastSyncStatus: toText(existing?.lastSyncStatus) || 'NEVER',
  };

  if (existing?.id) {
    return strapi.db.query(STRAVA_CONNECTION_UID).update({
      where: { id: existing.id },
      data: payload,
    });
  }

  return strapi.db.query(STRAVA_CONNECTION_UID).create({
    data: payload,
  });
}

export async function getCurrentUserStravaStatus(tenantId: number | string, userId: number) {
  const connection = await strapi.db.query(STRAVA_CONNECTION_UID).findOne({
    where: mergeTenantWhere({ user: { id: userId } }, tenantId),
    select: ['id', 'status', 'athleteFirstname', 'athleteLastname', 'profileUrl', 'lastSyncAt', 'lastSyncStatus'],
  });

  if (!connection?.id) {
    return {
      connected: false,
      status: 'DISCONNECTED',
      athleteFirstname: null,
      athleteLastname: null,
      profileUrl: null,
      lastSyncAt: null,
      lastSyncStatus: 'NEVER',
    };
  }

  return {
    connected: toText(connection.status) === 'ACTIVE',
    status: connection.status || 'DISCONNECTED',
    athleteFirstname: connection.athleteFirstname || null,
    athleteLastname: connection.athleteLastname || null,
    profileUrl: connection.profileUrl || null,
    lastSyncAt: connection.lastSyncAt || null,
    lastSyncStatus: connection.lastSyncStatus || 'NEVER',
  };
}

export async function disconnectCurrentUser(tenantId: number | string, userId: number) {
  const connection = await strapi.db.query(STRAVA_CONNECTION_UID).findOne({
    where: mergeTenantWhere({ user: { id: userId } }, tenantId),
    select: ['id'],
  });

  if (connection?.id) {
    await strapi.db.query(STRAVA_CONNECTION_UID).update({
      where: { id: connection.id },
      data: {
        status: 'DISCONNECTED',
        disconnectedAt: new Date().toISOString(),
        accessToken: null,
        refreshToken: null,
      },
    });
  }

  return {
    success: true,
  };
}

export async function syncCurrentUserActivities(tenantId: number | string, userId: number, modeInput: unknown = 'incremental') {
  const mode = normalizeSyncMode(modeInput);
  const connection = await getCurrentStravaConnection(tenantId, userId, true);
  if (!connection?.id) {
    throw Object.assign(new Error('Strava connection is not active'), { status: 400 });
  }

  const canRun = await markConnectionSyncRunning(connection.id);
  if (!canRun) {
    throw Object.assign(new Error('Tài khoản Strava này đang được đồng bộ.'), { status: 409 });
  }

  let jobId: number | null = null;
  try {
    jobId = await createStravaSyncJob({
      tenantId,
      userId,
      connectionId: connection.id,
      syncMode: mode === 'incremental' ? 'incremental' : 'initial',
      perPage: resolveStravaSyncBatchSize(),
    });

    let iterations = 0;
    let lastBatchResult: StravaBatchResult | null = null;
    while (iterations < 10000) {
      iterations += 1;
      const batchResult = await processStravaSyncBatch(jobId);
      lastBatchResult = batchResult;

      if (batchResult.completed) break;
      if (batchResult.waitForRetry) {
        throw Object.assign(new Error('Strava rate limit reached. Please try again later.'), { status: 429, code: 'STRAVA_RATE_LIMITED' });
      }
    }

    if (!lastBatchResult?.completed) {
      throw Object.assign(new Error('Strava sync batch wrapper exceeded iteration limit'), { status: 500, code: 'STRAVA_SYNC_BATCH_FAILED' });
    }

    const summary = await computeActivitySummary(tenantId, userId);
    const finalJob = await getStravaSyncJobContext(jobId);
    const lastSyncAt = toText(finalJob?.completedAt || new Date().toISOString());

    return {
      success: true,
      mode: mode === 'incremental' ? normalizeJobSyncMode(finalJob?.syncMode) : 'initial',
      processed: Number(finalJob?.processedActivities || 0),
      created: Number(finalJob?.createdActivities || 0),
      updated: Number(finalJob?.updatedActivities || 0),
      lastSyncAt,
      jobId,
      summary,
    };
  } catch (error: any) {
    const classified = classifyStravaSyncError(error);
    const safeMessage = classified.message;

    if (!jobId) {
      await updateConnectionSyncState(connection.id, {
        lastSyncStatus: 'FAILED',
        lastSyncError: safeMessage,
        status: classified.httpStatus === 401 ? 'ERROR' : connection.status || 'ACTIVE',
      });
    } else if (classified.code !== 'STRAVA_RATE_LIMITED' && classified.category !== 'cancelled') {
      const job = await getStravaSyncJobContext(jobId);
      if (job?.id && !['failed', 'completed', 'cancelled'].includes(normalizeJobStatus(job.status))) {
        await markStravaSyncJobFailed(jobId, classified.code, safeMessage, {
          incrementRetry: false,
        });
      }
    }

    throw Object.assign(new Error(safeMessage), { code: classified.code, status: classified.httpStatus || error?.status || 500 });
  }
}

export async function listCurrentUserActivities(
  tenantId: number | string,
  userId: number,
  query: Record<string, unknown> = {},
) {
  const page = Math.max(1, toPositiveInt(query.page) || 1);
  const pageSize = Math.max(1, Math.min(100, toPositiveInt(query.pageSize) || 20));
  const offset = (page - 1) * pageSize;
  const sportType = toText(query.sportType || '');
  const from = toText(query.from || '');
  const to = toText(query.to || '');
  const sort = toText(query.sort || 'startDate:desc').toLowerCase();

  const whereClauses: Array<Record<string, unknown>> = [{ user: { id: userId } }, { syncStatus: 'SYNCED' }];
  if (sportType) whereClauses.push({ sportType: { $eq: sportType } });
  if (from) {
    const fromIso = toIsoDateTime(from);
    if (fromIso) whereClauses.push({ startDate: { $gte: fromIso } });
  }
  if (to) {
    const toDate = new Date(to);
    if (!Number.isNaN(toDate.getTime())) {
      toDate.setHours(23, 59, 59, 999);
      whereClauses.push({ startDate: { $lte: toDate.toISOString() } });
    }
  }

  const orderBy = sort === 'startdate:asc' ? [{ startDate: 'asc' }, { id: 'asc' }] : [{ startDate: 'desc' }, { id: 'desc' }];
  const where = mergeTenantWhere({ $and: whereClauses }, tenantId);

  const rows = await strapi.db.query(STRAVA_ACTIVITY_UID).findMany({
    where,
    limit: pageSize,
    offset,
    orderBy,
    select: ['id', 'stravaActivityId', 'name', 'type', 'sportType', 'startDate', 'startDateLocal', 'timezone', 'distance', 'movingTime', 'elapsedTime', 'totalElevationGain', 'averageSpeed', 'maxSpeed', 'averageHeartrate', 'maxHeartrate', 'calories', 'achievementCount', 'kudosCount', 'locationCountry', 'locationCity', 'hasMap', 'visibility', 'syncStatus', 'createdAt', 'updatedAt'],
  });
  const total = await strapi.db.query(STRAVA_ACTIVITY_UID).count({ where });

  return {
    items: (rows || []).map((row: Record<string, any>) => ({
      id: row.id,
      stravaActivityId: row.stravaActivityId || null,
      name: row.name || null,
      type: row.type || null,
      sportType: row.sportType || null,
      startDate: row.startDate || null,
      startDateLocal: row.startDateLocal || null,
      timezone: row.timezone || null,
      distance: row.distance ?? null,
      movingTime: row.movingTime ?? null,
      elapsedTime: row.elapsedTime ?? null,
      totalElevationGain: row.totalElevationGain ?? null,
      averageSpeed: row.averageSpeed ?? null,
      maxSpeed: row.maxSpeed ?? null,
      averageHeartrate: row.averageHeartrate ?? null,
      maxHeartrate: row.maxHeartrate ?? null,
      calories: row.calories ?? null,
      achievementCount: row.achievementCount ?? null,
      kudosCount: row.kudosCount ?? null,
      locationCountry: row.locationCountry || null,
      locationCity: row.locationCity || null,
      hasMap: Boolean(row.hasMap),
      visibility: row.visibility || 'PRIVATE',
      syncStatus: row.syncStatus || 'SYNCED',
    })),
    pagination: {
      page,
      pageSize,
      pageCount: Math.ceil(total / pageSize) || 1,
      total,
    },
  };
}

export async function getCurrentUserActivitySummary(tenantId: number | string, userId: number) {
  const summary = await computeActivitySummary(tenantId, userId);
  const connection = await getCurrentStravaConnection(tenantId, userId, false);
  return withAnalyticsSyncState(tenantId, userId, {
    ...summary,
    lastSyncAt: connection?.lastSyncAt || null,
    lastSyncStatus: connection?.lastSyncStatus || 'NEVER',
  });
}

type AnalyticsActivityRow = {
  id: number;
  stravaActivityId?: string | null;
  name?: string | null;
  sportType?: string | null;
  type?: string | null;
  startDate?: string | null;
  startDateLocal?: string | null;
  distance?: number | string | null;
  movingTime?: number | null;
  totalElevationGain?: number | string | null;
  averageSpeed?: number | string | null;
};

async function loadAnalyticsActivityRows(tenantId: number | string, userId: number): Promise<AnalyticsActivityRow[]> {
  const rows = await strapi.db.query(STRAVA_ACTIVITY_UID).findMany({
    where: buildSyncedActivityWhere(tenantId, userId),
    select: ['id', 'stravaActivityId', 'name', 'sportType', 'type', 'startDate', 'startDateLocal', 'distance', 'movingTime', 'totalElevationGain', 'averageSpeed'],
    orderBy: [{ startDate: 'desc' }, { id: 'desc' }],
  });
  return Array.isArray(rows) ? rows as AnalyticsActivityRow[] : [];
}

function normalizeSportGroup(value: unknown): 'run' | 'ride' | 'walk' | 'other' {
  const normalized = toText(value).toLowerCase();
  if (['run', 'trailrun', 'virtualrun'].includes(normalized)) return 'run';
  if (['ride', 'mountainbikeride', 'gravelride', 'virtualride', 'ebikeride'].includes(normalized)) return 'ride';
  if (['walk', 'hike'].includes(normalized)) return 'walk';
  return 'other';
}

function filterAnalyticsRows(rows: AnalyticsActivityRow[], options: { sportType?: unknown; year?: unknown } = {}) {
  const sportType = toText(options.sportType || 'all').toLowerCase();
  const year = toPositiveInt(options.year);
  return rows.filter((row) => {
    const rowSport = normalizeSportGroup(row.sportType || row.type || '');
    if (sportType && sportType !== 'all' && rowSport !== sportType) return false;
    if (year) {
      const date = getActivityDate(row);
      if (!date || date.getUTCFullYear() !== year) return false;
    }
    return true;
  });
}

function toAverageSpeedKmh(row: AnalyticsActivityRow) {
  const avgSpeed = normalizeMetricNumber(row.averageSpeed);
  if (avgSpeed > 0) return avgSpeed * 3.6;
  const distance = normalizeMetricNumber(row.distance);
  const movingTime = normalizeMetricNumber(row.movingTime);
  if (distance <= 0 || movingTime <= 0) return 0;
  return (distance / movingTime) * 3.6;
}

function buildActivityRecord(row: AnalyticsActivityRow | null) {
  if (!row) return null;
  return {
    id: row.id,
    stravaActivityId: row.stravaActivityId || null,
    name: row.name || null,
    sportType: row.sportType || row.type || null,
    sportGroup: normalizeSportGroup(row.sportType || row.type || ''),
    startDate: row.startDate || null,
    startDateLocal: row.startDateLocal || null,
    distance: normalizeMetricNumber(row.distance),
    movingTime: normalizeMetricNumber(row.movingTime),
    totalElevationGain: normalizeMetricNumber(row.totalElevationGain),
    averageSpeed: toAverageSpeedKmh(row),
  };
}

function buildGroupedBestDistance(rows: AnalyticsActivityRow[], groupBy: 'day' | 'week' | 'month' | 'year') {
  const map = new Map<string, { key: string; label: string; distance: number; activityCount: number; year?: number; month?: number; weekStart?: string; weekEnd?: string; date?: string }>();
  for (const row of rows) {
    const date = getActivityDate(row);
    if (!date) continue;
    let key = '';
    let label = '';
    let meta: Record<string, unknown> = {};
    if (groupBy === 'day') {
      key = getActivityDateKey(row);
      label = key;
      meta = { date: key };
    } else if (groupBy === 'week') {
      const period = getTrendPeriod(date, 'week');
      const start = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
      const diff = (start.getUTCDay() + 6) % 7;
      start.setUTCDate(start.getUTCDate() - diff);
      const end = new Date(start);
      end.setUTCDate(end.getUTCDate() + 6);
      key = period.period;
      label = period.label;
      meta = { weekStart: start.toISOString().slice(0, 10), weekEnd: end.toISOString().slice(0, 10) };
    } else if (groupBy === 'month') {
      const period = getTrendPeriod(date, 'month');
      key = period.period;
      label = period.label;
      meta = { year: date.getUTCFullYear(), month: date.getUTCMonth() + 1 };
    } else {
      const period = getTrendPeriod(date, 'year');
      key = period.period;
      label = period.label;
      meta = { year: date.getUTCFullYear() };
    }

    const current = map.get(key) || { key, label, distance: 0, activityCount: 0, ...meta };
    current.distance += normalizeMetricNumber(row.distance);
    current.activityCount += 1;
    map.set(key, current as any);
  }

  const sorted = Array.from(map.values()).sort((a, b) => b.distance - a.distance || b.activityCount - a.activityCount);
  return sorted[0] || null;
}

function buildMilestones(currentValue: number, targets: number[]) {
  const safeValue = normalizeMetricNumber(currentValue);
  const achieved = targets.filter((target) => safeValue >= target);
  const nextTarget = targets.find((target) => safeValue < target) || null;
  return {
    currentValue: safeValue,
    achieved,
    next: nextTarget ? {
      target: nextTarget,
      progress: nextTarget > 0 ? safeValue / nextTarget : 0,
    } : null,
  };
}

function normalizeMetricNumber(value: unknown): number {
  const numeric = Number(value || 0);
  return Number.isFinite(numeric) ? numeric : 0;
}

function getActivityDateKey(row: AnalyticsActivityRow): string {
  const local = toText(row?.startDateLocal || '');
  if (local) return local.slice(0, 10);
  const utc = toText(row?.startDate || '');
  return utc ? utc.slice(0, 10) : '';
}

function getActivityDate(row: AnalyticsActivityRow): Date | null {
  const raw = toText(row?.startDateLocal || row?.startDate || '');
  if (!raw) return null;
  const date = new Date(raw);
  return Number.isNaN(date.getTime()) ? null : date;
}

function startOfYear(year: number) {
  return new Date(Date.UTC(year, 0, 1, 0, 0, 0, 0));
}

function endOfYear(year: number) {
  return new Date(Date.UTC(year, 11, 31, 23, 59, 59, 999));
}

function computeStreaks(rows: AnalyticsActivityRow[]) {
  const uniqueDays = Array.from(new Set(rows.map(getActivityDateKey).filter(Boolean))).sort();
  if (!uniqueDays.length) {
    return { activeDays: 0, currentStreak: 0, longestStreak: 0 };
  }

  let longestStreak = 1;
  let currentRun = 1;
  for (let i = 1; i < uniqueDays.length; i += 1) {
    const prev = new Date(`${uniqueDays[i - 1]}T00:00:00Z`).getTime();
    const current = new Date(`${uniqueDays[i]}T00:00:00Z`).getTime();
    const diffDays = Math.round((current - prev) / (24 * 60 * 60 * 1000));
    if (diffDays === 1) {
      currentRun += 1;
      if (currentRun > longestStreak) longestStreak = currentRun;
    } else {
      currentRun = 1;
    }
  }

  const todayKey = new Date().toISOString().slice(0, 10);
  const yesterday = new Date();
  yesterday.setUTCDate(yesterday.getUTCDate() - 1);
  const yesterdayKey = yesterday.toISOString().slice(0, 10);
  let anchorIndex = uniqueDays.length - 1;
  if (uniqueDays[anchorIndex] !== todayKey && uniqueDays[anchorIndex] !== yesterdayKey) {
    return { activeDays: uniqueDays.length, currentStreak: 0, longestStreak };
  }

  let currentStreak = 1;
  for (let i = anchorIndex; i > 0; i -= 1) {
    const current = new Date(`${uniqueDays[i]}T00:00:00Z`).getTime();
    const prev = new Date(`${uniqueDays[i - 1]}T00:00:00Z`).getTime();
    const diffDays = Math.round((current - prev) / (24 * 60 * 60 * 1000));
    if (diffDays === 1) currentStreak += 1;
    else break;
  }

  return {
    activeDays: uniqueDays.length,
    currentStreak,
    longestStreak,
  };
}

function buildOverviewTotals(rows: AnalyticsActivityRow[]) {
  const totalActivities = rows.length;
  const totalDistance = rows.reduce((sum, row) => sum + normalizeMetricNumber(row.distance), 0);
  const totalMovingTime = rows.reduce((sum, row) => sum + normalizeMetricNumber(row.movingTime), 0);
  const totalElevationGain = rows.reduce((sum, row) => sum + normalizeMetricNumber(row.totalElevationGain), 0);
  const averageDistance = totalActivities > 0 ? totalDistance / totalActivities : 0;
  const averageMovingTime = totalActivities > 0 ? totalMovingTime / totalActivities : 0;
  const streaks = computeStreaks(rows);
  return {
    totalActivities,
    totalDistance,
    totalMovingTime,
    totalElevationGain,
    activeDays: streaks.activeDays,
    averageDistance,
    averageMovingTime,
    currentStreak: streaks.currentStreak,
    longestStreak: streaks.longestStreak,
  };
}

function buildSportBreakdown(rows: AnalyticsActivityRow[]) {
  const map = new Map<string, { name: string; activityCount: number; totalDistance: number }>();
  for (const row of rows) {
    const key = toText(row.sportType || row.type || 'Khác') || 'Khác';
    const current = map.get(key) || { name: key, activityCount: 0, totalDistance: 0 };
    current.activityCount += 1;
    current.totalDistance += normalizeMetricNumber(row.distance);
    map.set(key, current);
  }
  const sorted = Array.from(map.values()).sort((a, b) => b.activityCount - a.activityCount || b.totalDistance - a.totalDistance);
  if (sorted.length <= 5) return sorted;
  const top = sorted.slice(0, 4);
  const rest = sorted.slice(4).reduce((acc, item) => ({
    name: 'Khác',
    activityCount: acc.activityCount + item.activityCount,
    totalDistance: acc.totalDistance + item.totalDistance,
  }), { name: 'Khác', activityCount: 0, totalDistance: 0 });
  return [...top, rest];
}

export async function getCurrentUserAnalyticsOverview(tenantId: number | string, userId: number) {
  const rows = await loadAnalyticsActivityRows(tenantId, userId);
  const connection = await getCurrentStravaConnection(tenantId, userId, false);
  const currentYear = new Date().getUTCFullYear();
  const currentYearRows = rows.filter((row) => {
    const date = getActivityDate(row);
    return date && date >= startOfYear(currentYear) && date <= endOfYear(currentYear);
  });
  const latestActivity = rows[0]
    ? {
      id: rows[0].id,
      name: rows[0].name || null,
      sportType: rows[0].sportType || rows[0].type || null,
      startDate: rows[0].startDate || null,
      startDateLocal: rows[0].startDateLocal || null,
      distance: normalizeMetricNumber(rows[0].distance),
      movingTime: normalizeMetricNumber(rows[0].movingTime),
      totalElevationGain: normalizeMetricNumber(rows[0].totalElevationGain),
    }
    : null;

  return withAnalyticsSyncState(tenantId, userId, {
    allTime: buildOverviewTotals(rows),
    currentYear: buildOverviewTotals(currentYearRows),
    latestActivity,
    sportBreakdown: buildSportBreakdown(rows),
    lastSyncAt: connection?.lastSyncAt || null,
    lastSyncStatus: connection?.lastSyncStatus || 'NEVER',
  });
}

function getWeekKey(date: Date) {
  const target = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const dayNr = (target.getUTCDay() + 6) % 7;
  target.setUTCDate(target.getUTCDate() - dayNr + 3);
  const firstThursday = new Date(Date.UTC(target.getUTCFullYear(), 0, 4));
  const firstDayNr = (firstThursday.getUTCDay() + 6) % 7;
  firstThursday.setUTCDate(firstThursday.getUTCDate() - firstDayNr + 3);
  const week = 1 + Math.round((target.getTime() - firstThursday.getTime()) / (7 * 24 * 60 * 60 * 1000));
  return `${target.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
}

function getTrendPeriod(date: Date, groupBy: 'week' | 'month' | 'year') {
  if (groupBy === 'year') {
    const year = date.getUTCFullYear();
    return { period: String(year), label: `Năm ${year}` };
  }
  if (groupBy === 'week') {
    const key = getWeekKey(date);
    const [year, week] = key.split('-W');
    return { period: key, label: `Tuần ${Number(week)}/${year}` };
  }
  const year = date.getUTCFullYear();
  const month = date.getUTCMonth() + 1;
  return { period: `${year}-${String(month).padStart(2, '0')}`, label: `Tháng ${month}/${year}` };
}

function resolveTrendRange(range: string) {
  const now = new Date();
  const currentYear = now.getUTCFullYear();
  if (range === '30d') {
    const start = new Date(now);
    start.setUTCDate(start.getUTCDate() - 29);
    start.setUTCHours(0, 0, 0, 0);
    return { start, end: now };
  }
  if (range === '90d') {
    const start = new Date(now);
    start.setUTCDate(start.getUTCDate() - 89);
    start.setUTCHours(0, 0, 0, 0);
    return { start, end: now };
  }
  if (range === 'current-year') {
    return { start: startOfYear(currentYear), end: endOfYear(currentYear) };
  }
  if (range === 'previous-year') {
    return { start: startOfYear(currentYear - 1), end: endOfYear(currentYear - 1) };
  }
  if (range === '12m') {
    const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 11, 1, 0, 0, 0, 0));
    return { start, end: now };
  }
  return { start: null, end: null };
}

function filterRowsByRangeAndSport(rows: AnalyticsActivityRow[], options: { range?: unknown; sportType?: unknown } = {}) {
  const range = toText(options.range || '12m').toLowerCase();
  const sportType = toText(options.sportType || 'all').toLowerCase();
  const { start, end } = resolveTrendRange(range);
  return rows.filter((row) => {
    const date = getActivityDate(row);
    if (!date) return false;
    if (start && date < start) return false;
    if (end && date > end) return false;
    const normalizedSport = normalizeSportGroup(row.sportType || row.type || '');
    if (sportType && sportType !== 'all' && normalizedSport !== sportType) return false;
    return true;
  });
}

function getWeekdayNumber(date: Date) {
  const day = date.getUTCDay();
  return day === 0 ? 7 : day;
}

function getWeekdayLabel(weekday: number) {
  return ['Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy', 'Chủ Nhật'][weekday - 1] || 'Không rõ';
}

function getTimeOfDayKey(date: Date) {
  const hour = date.getUTCHours();
  if (hour >= 4 && hour <= 6) return 'early_morning';
  if (hour >= 7 && hour <= 10) return 'morning';
  if (hour >= 11 && hour <= 13) return 'noon';
  if (hour >= 14 && hour <= 17) return 'afternoon';
  if (hour >= 18 && hour <= 21) return 'evening';
  return 'late_night';
}

function getTimeOfDayLabel(key: string) {
  const labels: Record<string, string> = {
    early_morning: 'Sáng sớm',
    morning: 'Buổi sáng',
    noon: 'Buổi trưa',
    afternoon: 'Buổi chiều',
    evening: 'Buổi tối',
    late_night: 'Đêm muộn',
  };
  return labels[key] || key;
}

function buildWeekdayInsights(rows: AnalyticsActivityRow[]) {
  const dayMaps = Array.from({ length: 7 }, (_, index) => ({
    weekday: index + 1,
    label: getWeekdayLabel(index + 1),
    activityCount: 0,
    activeDays: 0,
    distance: 0,
    movingTime: 0,
  }));
  const uniqueDayMap = new Map<string, Set<number>>();
  for (const row of rows) {
    const date = getActivityDate(row);
    if (!date) continue;
    const weekday = getWeekdayNumber(date);
    const item = dayMaps[weekday - 1];
    item.activityCount += 1;
    item.distance += normalizeMetricNumber(row.distance);
    item.movingTime += normalizeMetricNumber(row.movingTime);
    const dayKey = getActivityDateKey(row);
    if (dayKey) {
      const bucket = uniqueDayMap.get(dayKey) || new Set<number>();
      bucket.add(weekday);
      uniqueDayMap.set(dayKey, bucket);
    }
  }
  uniqueDayMap.forEach((weekdays) => {
    weekdays.forEach((weekday) => { dayMaps[weekday - 1].activeDays += 1; });
  });
  const totalActivities = rows.length || 0;
  const weekendActivities = dayMaps.filter((item) => item.weekday >= 6).reduce((sum, item) => sum + item.activityCount, 0);
  const topWeekday = [...dayMaps].sort((a, b) => b.activityCount - a.activityCount || b.distance - a.distance)[0] || null;
  const leastWeekday = [...dayMaps].sort((a, b) => a.activityCount - b.activityCount || a.distance - b.distance)[0] || null;
  return {
    items: dayMaps,
    topWeekday,
    leastWeekday,
    weekendRate: totalActivities > 0 ? weekendActivities / totalActivities : 0,
    weekdayRate: totalActivities > 0 ? (totalActivities - weekendActivities) / totalActivities : 0,
  };
}

function buildTimeOfDayInsights(rows: AnalyticsActivityRow[]) {
  const keys = ['early_morning', 'morning', 'noon', 'afternoon', 'evening', 'late_night'];
  const items = keys.map((key) => ({
    key,
    label: getTimeOfDayLabel(key),
    activityCount: 0,
    distance: 0,
    movingTime: 0,
    averageDistance: 0,
    averagePace: null as number | null,
    averageSpeed: null as number | null,
  }));
  for (const row of rows) {
    const date = getActivityDate(row);
    if (!date) continue;
    const bucketKey = getTimeOfDayKey(date);
    const item = items.find((entry) => entry.key === bucketKey);
    if (!item) continue;
    item.activityCount += 1;
    item.distance += normalizeMetricNumber(row.distance);
    item.movingTime += normalizeMetricNumber(row.movingTime);
  }
  items.forEach((item) => {
    item.averageDistance = item.activityCount > 0 ? item.distance / item.activityCount : 0;
    item.averageSpeed = item.distance > 0 && item.movingTime > 0 ? (item.distance / item.movingTime) * 3.6 : null;
    item.averagePace = item.distance > 0 && item.movingTime > 0 ? item.movingTime / (item.distance / 1000) : null;
  });
  const topPeriod = [...items].sort((a, b) => b.activityCount - a.activityCount || b.distance - a.distance)[0] || null;
  const bestDistancePeriod = [...items].filter((item) => item.activityCount > 0).sort((a, b) => b.averageDistance - a.averageDistance)[0] || null;
  const runWalkItems = items.filter((item) => item.averagePace && Number.isFinite(item.averagePace));
  const rideItems = items.filter((item) => item.averageSpeed && Number.isFinite(item.averageSpeed));
  const bestPacePeriod = [...runWalkItems].sort((a, b) => (a.averagePace || Infinity) - (b.averagePace || Infinity))[0] || null;
  const bestSpeedPeriod = [...rideItems].sort((a, b) => (b.averageSpeed || 0) - (a.averageSpeed || 0))[0] || null;
  return { items, topPeriod, bestDistancePeriod, bestPacePeriod, bestSpeedPeriod };
}

function buildFrequencyInsights(rows: AnalyticsActivityRow[], range: string) {
  const filteredRows = rows;
  if (!filteredRows.length) {
    return {
      averageActivitiesPerWeek: 0,
      averageActiveDaysPerWeek: 0,
      averageDistancePerWeek: 0,
      averageMovingTimePerWeek: 0,
      activeWeeks: 0,
      inactiveWeeks: 0,
      activeWeekRate: 0,
      totalWeeks: 0,
      weekDayCounts: [] as number[],
    };
  }
  const dates = filteredRows.map(getActivityDate).filter(Boolean) as Date[];
  const rangeStart = resolveTrendRange(range).start || dates[dates.length - 1];
  const rangeEnd = resolveTrendRange(range).end || dates[0];
  const totalWeeks = Math.max(1, Math.ceil((rangeEnd.getTime() - rangeStart.getTime() + 1) / (7 * 24 * 60 * 60 * 1000)));
  const weekMap = new Map<string, { activeDays: Set<string>; activityCount: number; distance: number; movingTime: number }>();
  for (const row of filteredRows) {
    const date = getActivityDate(row);
    if (!date) continue;
    const weekKey = getWeekKey(date);
    const current = weekMap.get(weekKey) || { activeDays: new Set<string>(), activityCount: 0, distance: 0, movingTime: 0 };
    current.activityCount += 1;
    current.distance += normalizeMetricNumber(row.distance);
    current.movingTime += normalizeMetricNumber(row.movingTime);
    current.activeDays.add(getActivityDateKey(row));
    weekMap.set(weekKey, current);
  }
  const activeWeeks = weekMap.size;
  const inactiveWeeks = Math.max(0, totalWeeks - activeWeeks);
  const totals = buildOverviewTotals(filteredRows);
  const weekDayCounts = Array.from(weekMap.values()).map((item) => item.activeDays.size);
  return {
    averageActivitiesPerWeek: totals.totalActivities / totalWeeks,
    averageActiveDaysPerWeek: totals.activeDays / totalWeeks,
    averageDistancePerWeek: totals.totalDistance / totalWeeks,
    averageMovingTimePerWeek: totals.totalMovingTime / totalWeeks,
    activeWeeks,
    inactiveWeeks,
    activeWeekRate: totalWeeks > 0 ? activeWeeks / totalWeeks : 0,
    totalWeeks,
    weekDayCounts,
  };
}

function buildConsistencyInsights(frequency: ReturnType<typeof buildFrequencyInsights>) {
  const weekDayCounts = frequency.weekDayCounts || [];
  if (!frequency.totalWeeks) {
    return { score: 0, level: 'none', activeWeekRate: 0, stabilityScore: 0, description: 'Chưa có đủ dữ liệu để đánh giá độ đều đặn.' };
  }
  const mean = weekDayCounts.length ? weekDayCounts.reduce((sum, value) => sum + value, 0) / weekDayCounts.length : 0;
  const variance = weekDayCounts.length ? weekDayCounts.reduce((sum, value) => sum + ((value - mean) ** 2), 0) / weekDayCounts.length : 0;
  const stddev = Math.sqrt(variance);
  const activeWeekRate = frequency.activeWeekRate || 0;
  const stabilityScore = Math.max(0, 1 - Math.min(1, stddev / 3));
  const score = Math.round(((0.7 * activeWeekRate) + (0.3 * stabilityScore)) * 100);
  const level = score >= 80 ? 'Rất đều đặn' : score >= 60 ? 'Đều đặn' : score >= 40 ? 'Tương đối' : 'Chưa đều';
  return {
    score,
    level,
    activeWeekRate,
    stabilityScore,
    description: 'Điểm đều đặn phản ánh mức độ duy trì luyện tập giữa các tuần, không phản ánh cường độ hay chất lượng buổi tập.',
  };
}

function resolveDistanceBuckets(sportType: string) {
  if (sportType === 'run' || sportType === 'walk') {
    return [
      { key: 'lt3', label: 'Dưới 3 km', min: 0, max: 3 },
      { key: '3to5', label: '3 đến dưới 5 km', min: 3, max: 5 },
      { key: '5to10', label: '5 đến dưới 10 km', min: 5, max: 10 },
      { key: '10to21', label: '10 đến dưới 21,1 km', min: 10, max: 21.1 },
      { key: '21to42', label: '21,1 đến dưới 42,2 km', min: 21.1, max: 42.2 },
      { key: 'gte42', label: 'Từ 42,2 km trở lên', min: 42.2, max: Infinity },
    ];
  }
  if (sportType === 'ride') {
    return [
      { key: 'lt10', label: 'Dưới 10 km', min: 0, max: 10 },
      { key: '10to20', label: '10 đến dưới 20 km', min: 10, max: 20 },
      { key: '20to50', label: '20 đến dưới 50 km', min: 20, max: 50 },
      { key: '50to100', label: '50 đến dưới 100 km', min: 50, max: 100 },
      { key: 'gte100', label: 'Từ 100 km trở lên', min: 100, max: Infinity },
    ];
  }
  return [
    { key: 'lt3', label: 'Dưới 3 km', min: 0, max: 3 },
    { key: '3to5', label: '3–5 km', min: 3, max: 5 },
    { key: '5to10', label: '5–10 km', min: 5, max: 10 },
    { key: '10to20', label: '10–20 km', min: 10, max: 20 },
    { key: '20to50', label: '20–50 km', min: 20, max: 50 },
    { key: 'gte50', label: 'Trên 50 km', min: 50, max: Infinity },
  ];
}

function buildDistanceDistribution(rows: AnalyticsActivityRow[], sportType: string) {
  const buckets = resolveDistanceBuckets(sportType).map((bucket) => ({ ...bucket, count: 0 }));
  for (const row of rows) {
    const distanceKm = normalizeMetricNumber(row.distance) / 1000;
    const bucket = buckets.find((item) => distanceKm >= item.min && distanceKm < item.max);
    if (bucket) bucket.count += 1;
  }
  const total = rows.length || 1;
  const items = buckets.map((bucket) => ({
    key: bucket.key,
    label: bucket.label,
    activityCount: bucket.count,
    rate: bucket.count / total,
  }));
  const mostCommonBucket = [...items].sort((a, b) => b.activityCount - a.activityCount)[0] || null;
  return { items, mostCommonBucket };
}

function buildDurationDistribution(rows: AnalyticsActivityRow[]) {
  const buckets = [
    { key: 'lt30', label: 'Dưới 30 phút', min: 0, max: 30 * 60, count: 0 },
    { key: '30to60', label: '30–60 phút', min: 30 * 60, max: 60 * 60, count: 0 },
    { key: '60to90', label: '60–90 phút', min: 60 * 60, max: 90 * 60, count: 0 },
    { key: '90to120', label: '90–120 phút', min: 90 * 60, max: 120 * 60, count: 0 },
    { key: 'gt120', label: 'Trên 120 phút', min: 120 * 60, max: Infinity, count: 0 },
  ];
  for (const row of rows) {
    const movingTime = normalizeMetricNumber(row.movingTime);
    const bucket = buckets.find((item) => movingTime >= item.min && movingTime < item.max);
    if (bucket) bucket.count += 1;
  }
  const total = rows.length || 1;
  const items = buckets.map((bucket) => ({
    key: bucket.key,
    label: bucket.label,
    activityCount: bucket.count,
    rate: bucket.count / total,
  }));
  const mostCommonBucket = [...items].sort((a, b) => b.activityCount - a.activityCount)[0] || null;
  return { items, mostCommonBucket, medianMovingTime: null };
}

function buildSportDistributionInsights(rows: AnalyticsActivityRow[]) {
  const map = new Map<string, { key: string; label: string; activityCount: number; distance: number; movingTime: number }>();
  for (const row of rows) {
    const key = normalizeSportGroup(row.sportType || row.type || '');
    const label = key === 'run' ? 'Chạy bộ' : key === 'ride' ? 'Đạp xe' : key === 'walk' ? 'Đi bộ' : 'Khác';
    const current = map.get(key) || { key, label, activityCount: 0, distance: 0, movingTime: 0 };
    current.activityCount += 1;
    current.distance += normalizeMetricNumber(row.distance);
    current.movingTime += normalizeMetricNumber(row.movingTime);
    map.set(key, current);
  }
  return {
    items: Array.from(map.values()).sort((a, b) => b.activityCount - a.activityCount || b.distance - a.distance),
  };
}

function buildRecentComparison(rows: AnalyticsActivityRow[]) {
  const now = new Date();
  const currentStart = new Date(now);
  currentStart.setUTCDate(currentStart.getUTCDate() - 29);
  currentStart.setUTCHours(0, 0, 0, 0);
  const previousEnd = new Date(currentStart);
  previousEnd.setUTCDate(previousEnd.getUTCDate() - 1);
  previousEnd.setUTCHours(23, 59, 59, 999);
  const previousStart = new Date(previousEnd);
  previousStart.setUTCDate(previousStart.getUTCDate() - 29);
  previousStart.setUTCHours(0, 0, 0, 0);

  const toMetrics = (subset: AnalyticsActivityRow[]) => {
    const totals = buildOverviewTotals(subset);
    const averageDistancePerActivity = totals.totalActivities > 0 ? totals.totalDistance / totals.totalActivities : 0;
    return {
      totalActivities: totals.totalActivities,
      totalDistance: totals.totalDistance,
      totalMovingTime: totals.totalMovingTime,
      activeDays: totals.activeDays,
      averageDistancePerActivity,
    };
  };
  const currentRows = rows.filter((row) => {
    const date = getActivityDate(row);
    return date && date >= currentStart && date <= now;
  });
  const previousRows = rows.filter((row) => {
    const date = getActivityDate(row);
    return date && date >= previousStart && date <= previousEnd;
  });
  const current = toMetrics(currentRows);
  const previous = toMetrics(previousRows);
  const buildChange = (currentValue: number, previousValue: number) => ({
    currentValue,
    previousValue,
    delta: currentValue - previousValue,
    percent: previousValue > 0 ? ((currentValue - previousValue) / previousValue) : null,
  });
  return {
    current,
    previous,
    changes: {
      totalActivities: buildChange(current.totalActivities, previous.totalActivities),
      totalDistance: buildChange(current.totalDistance, previous.totalDistance),
      totalMovingTime: buildChange(current.totalMovingTime, previous.totalMovingTime),
      activeDays: buildChange(current.activeDays, previous.activeDays),
      averageDistancePerActivity: buildChange(current.averageDistancePerActivity, previous.averageDistancePerActivity),
    },
  };
}

function buildInsightStatements(payload: {
  weekday: ReturnType<typeof buildWeekdayInsights>;
  timeOfDay: ReturnType<typeof buildTimeOfDayInsights>;
  frequency: ReturnType<typeof buildFrequencyInsights>;
  consistency: ReturnType<typeof buildConsistencyInsights>;
  distanceDistribution: ReturnType<typeof buildDistanceDistribution>;
  sportDistribution: ReturnType<typeof buildSportDistributionInsights>;
  recentComparison: ReturnType<typeof buildRecentComparison>;
}) {
  const statements: string[] = [];
  const totalActivities = payload.weekday.items.reduce((sum, item) => sum + item.activityCount, 0);
  if (payload.timeOfDay.topPeriod?.activityCount) {
    statements.push(`Bạn thường luyện tập vào ${payload.timeOfDay.topPeriod.label.toLowerCase()}.`);
  }
  if (payload.weekday.topWeekday?.activityCount) {
    const ratio = totalActivities > 0 ? (payload.weekday.topWeekday.activityCount / totalActivities) * 100 : 0;
    statements.push(`Bạn hoạt động nhiều nhất vào ${payload.weekday.topWeekday.label}, chiếm ${ratio.toFixed(1).replace('.', ',')}% số hoạt động.`);
  }
  if (payload.distanceDistribution.mostCommonBucket?.activityCount) {
    const rate = (payload.distanceDistribution.mostCommonBucket.rate || 0) * 100;
    statements.push(`Cự ly quen thuộc của bạn là ${payload.distanceDistribution.mostCommonBucket.label.toLowerCase()}, chiếm ${rate.toFixed(1).replace('.', ',')}% số hoạt động.`);
  }
  if (payload.frequency.activeWeekRate > 0) {
    statements.push(`Bạn duy trì hoạt động trong ${Math.round(payload.frequency.activeWeekRate * 100)}% số tuần.`);
  }
  const topSport = payload.sportDistribution.items[0];
  if (topSport?.activityCount) {
    const rate = totalActivities > 0 ? (topSport.activityCount / totalActivities) * 100 : 0;
    statements.push(`${topSport.label} là nhóm hoạt động chính của bạn, chiếm ${rate.toFixed(1).replace('.', ',')}% số buổi tập.`);
  }
  const distanceChange = payload.recentComparison.changes.totalDistance;
  if (distanceChange && distanceChange.percent !== null) {
    const direction = distanceChange.delta >= 0 ? 'tăng' : 'giảm';
    statements.push(`30 ngày gần đây tổng quãng đường của bạn ${direction} ${Math.abs(distanceChange.percent * 100).toFixed(1).replace('.', ',')}% so với 30 ngày trước đó.`);
  }
  return statements.slice(0, 6);
}

export async function getCurrentUserAnalyticsInsights(
  tenantId: number | string,
  userId: number,
  query: Record<string, unknown> = {},
) {
  const range = toText(query.range || '12m').toLowerCase();
  const sportType = toText(query.sportType || 'all').toLowerCase();
  const allRows = await loadAnalyticsActivityRows(tenantId, userId);
  const rows = filterRowsByRangeAndSport(allRows, { range, sportType });

  const weekday = buildWeekdayInsights(rows);
  const timeOfDay = buildTimeOfDayInsights(rows);
  const frequency = buildFrequencyInsights(rows, range);
  const consistency = buildConsistencyInsights(frequency);
  const distanceDistribution = buildDistanceDistribution(rows, sportType);
  const durationDistribution = buildDurationDistribution(rows);
  const sportDistribution = buildSportDistributionInsights(rows);
  const recentComparison = buildRecentComparison(rows);
  const statements = buildInsightStatements({ weekday, timeOfDay, frequency, consistency, distanceDistribution, sportDistribution, recentComparison });

  return withAnalyticsSyncState(tenantId, userId, {
    filters: { range, sportType },
    weekday,
    timeOfDay,
    frequency: {
      averageActivitiesPerWeek: frequency.averageActivitiesPerWeek,
      averageActiveDaysPerWeek: frequency.averageActiveDaysPerWeek,
      averageDistancePerWeek: frequency.averageDistancePerWeek,
      averageMovingTimePerWeek: frequency.averageMovingTimePerWeek,
      activeWeeks: frequency.activeWeeks,
      inactiveWeeks: frequency.inactiveWeeks,
      activeWeekRate: frequency.activeWeekRate,
    },
    consistency,
    distanceDistribution,
    durationDistribution,
    sportDistribution,
    recentComparison,
    statements,
  });
}

export async function getCurrentUserAnalyticsTrends(
  tenantId: number | string,
  userId: number,
  query: Record<string, unknown> = {},
) {
  const range = toText(query.range || '12m').toLowerCase();
  const metric = toText(query.metric || 'distance') || 'distance';
  let groupBy = toText(query.groupBy || '').toLowerCase() as 'week' | 'month' | 'year';
  if (!['week', 'month', 'year'].includes(groupBy)) {
    groupBy = range === '12m' ? 'month' : 'month';
  }
  if (range === '12m' && groupBy === 'week') groupBy = 'month';

  const { start, end } = resolveTrendRange(range);
  const rows = (await loadAnalyticsActivityRows(tenantId, userId)).filter((row) => {
    const date = getActivityDate(row);
    if (!date) return false;
    if (start && date < start) return false;
    if (end && date > end) return false;
    return true;
  });

  const bucket = new Map<string, { period: string; label: string; value: number }>();
  for (const row of rows) {
    const date = getActivityDate(row);
    if (!date) continue;
    const info = getTrendPeriod(date, groupBy);
    const current = bucket.get(info.period) || { ...info, value: 0 };
    if (metric === 'activities') current.value += 1;
    else if (metric === 'movingTime') current.value += normalizeMetricNumber(row.movingTime);
    else if (metric === 'elevation') current.value += normalizeMetricNumber(row.totalElevationGain);
    else current.value += normalizeMetricNumber(row.distance);
    bucket.set(info.period, current);
  }

  return withAnalyticsSyncState(tenantId, userId, {
    metric,
    groupBy,
    items: Array.from(bucket.values()).sort((a, b) => a.period.localeCompare(b.period)),
  });
}

export async function getCurrentUserAnalyticsYearly(tenantId: number | string, userId: number) {
  const rows = await loadAnalyticsActivityRows(tenantId, userId);
  const map = new Map<number, { year: number; totalActivities: number; totalDistance: number; totalMovingTime: number; totalElevationGain: number }>();

  for (const row of rows) {
    const date = getActivityDate(row);
    if (!date) continue;
    const year = date.getUTCFullYear();
    const current = map.get(year) || { year, totalActivities: 0, totalDistance: 0, totalMovingTime: 0, totalElevationGain: 0 };
    current.totalActivities += 1;
    current.totalDistance += normalizeMetricNumber(row.distance);
    current.totalMovingTime += normalizeMetricNumber(row.movingTime);
    current.totalElevationGain += normalizeMetricNumber(row.totalElevationGain);
    map.set(year, current);
  }

  return withAnalyticsSyncState(tenantId, userId, {
    items: Array.from(map.values())
      .map((item) => ({
        ...item,
        averageDistance: item.totalActivities > 0 ? item.totalDistance / item.totalActivities : 0,
      }))
      .sort((a, b) => b.year - a.year),
  });
}

export async function getCurrentUserAnalyticsRecords(
  tenantId: number | string,
  userId: number,
  query: Record<string, unknown> = {},
) {
  const rows = filterAnalyticsRows(await loadAnalyticsActivityRows(tenantId, userId), query);
  const longestDistance = [...rows].sort((a, b) => normalizeMetricNumber(b.distance) - normalizeMetricNumber(a.distance))[0] || null;
  const longestMovingTime = [...rows].sort((a, b) => normalizeMetricNumber(b.movingTime) - normalizeMetricNumber(a.movingTime))[0] || null;
  const highestElevation = [...rows].sort((a, b) => normalizeMetricNumber(b.totalElevationGain) - normalizeMetricNumber(a.totalElevationGain))[0] || null;
  const highestAverageSpeed = [...rows]
    .filter((row) => normalizeMetricNumber(row.distance) > 0 && normalizeMetricNumber(row.movingTime) > 0)
    .sort((a, b) => toAverageSpeedKmh(b) - toAverageSpeedKmh(a))[0] || null;
  const bestDay = buildGroupedBestDistance(rows, 'day');
  const bestWeek = buildGroupedBestDistance(rows, 'week');
  const bestMonth = buildGroupedBestDistance(rows, 'month');
  const bestYear = buildGroupedBestDistance(rows, 'year');

  return withAnalyticsSyncState(tenantId, userId, {
    records: {
      longestDistance: longestDistance ? {
        value: normalizeMetricNumber(longestDistance.distance),
        activity: buildActivityRecord(longestDistance),
      } : { value: 0, activity: null },
      longestMovingTime: longestMovingTime ? {
        value: normalizeMetricNumber(longestMovingTime.movingTime),
        activity: buildActivityRecord(longestMovingTime),
      } : { value: 0, activity: null },
      highestElevation: highestElevation ? {
        value: normalizeMetricNumber(highestElevation.totalElevationGain),
        activity: buildActivityRecord(highestElevation),
      } : { value: 0, activity: null },
      highestAverageSpeed: highestAverageSpeed ? {
        value: toAverageSpeedKmh(highestAverageSpeed),
        activity: buildActivityRecord(highestAverageSpeed),
      } : { value: 0, activity: null },
      bestDay: bestDay ? {
        date: bestDay.date || null,
        distance: bestDay.distance,
        activityCount: bestDay.activityCount,
      } : { date: null, distance: 0, activityCount: 0 },
      bestWeek: bestWeek ? {
        weekStart: bestWeek.weekStart || null,
        weekEnd: bestWeek.weekEnd || null,
        distance: bestWeek.distance,
        activityCount: bestWeek.activityCount,
      } : { weekStart: null, weekEnd: null, distance: 0, activityCount: 0 },
      bestMonth: bestMonth ? {
        year: bestMonth.year || null,
        month: bestMonth.month || null,
        distance: bestMonth.distance,
        activityCount: bestMonth.activityCount,
      } : { year: null, month: null, distance: 0, activityCount: 0 },
      bestYear: bestYear ? {
        year: bestYear.year || null,
        distance: bestYear.distance,
        activityCount: bestYear.activityCount,
      } : { year: null, distance: 0, activityCount: 0 },
    },
  });
}

export async function getCurrentUserTopActivities(
  tenantId: number | string,
  userId: number,
  query: Record<string, unknown> = {},
) {
  const rows = filterAnalyticsRows(await loadAnalyticsActivityRows(tenantId, userId), query);
  const sortBy = toText(query.sortBy || 'distance');
  const limit = Math.min(50, Math.max(1, toPositiveInt(query.limit) || 10));

  const getValue = (row: AnalyticsActivityRow) => {
    if (sortBy === 'movingTime') return normalizeMetricNumber(row.movingTime);
    if (sortBy === 'elevation') return normalizeMetricNumber(row.totalElevationGain);
    if (sortBy === 'averageSpeed') return toAverageSpeedKmh(row);
    return normalizeMetricNumber(row.distance);
  };

  return withAnalyticsSyncState(tenantId, userId, {
    sortBy,
    items: [...rows]
      .filter((row) => getValue(row) > 0)
      .sort((a, b) => getValue(b) - getValue(a))
      .slice(0, limit)
      .map((row) => ({
        ...buildActivityRecord(row),
        paceSecondsPerKm: normalizeSportGroup(row.sportType || row.type || '') !== 'ride' && normalizeMetricNumber(row.distance) > 0 && normalizeMetricNumber(row.movingTime) > 0
          ? normalizeMetricNumber(row.movingTime) / (normalizeMetricNumber(row.distance) / 1000)
          : null,
      })),
  });
}

export async function getCurrentUserYearlyRecords(tenantId: number | string, userId: number) {
  const rows = await loadAnalyticsActivityRows(tenantId, userId);
  const yearMap = new Map<number, AnalyticsActivityRow[]>();
  for (const row of rows) {
    const date = getActivityDate(row);
    if (!date) continue;
    const year = date.getUTCFullYear();
    const list = yearMap.get(year) || [];
    list.push(row);
    yearMap.set(year, list);
  }

  const items = Array.from(yearMap.entries()).map(([year, yearRows]) => {
    const longestDistance = [...yearRows].sort((a, b) => normalizeMetricNumber(b.distance) - normalizeMetricNumber(a.distance))[0] || null;
    const longestMovingTime = [...yearRows].sort((a, b) => normalizeMetricNumber(b.movingTime) - normalizeMetricNumber(a.movingTime))[0] || null;
    const highestElevation = [...yearRows].sort((a, b) => normalizeMetricNumber(b.totalElevationGain) - normalizeMetricNumber(a.totalElevationGain))[0] || null;
    const bestDay = buildGroupedBestDistance(yearRows, 'day');
    const bestMonth = buildGroupedBestDistance(yearRows, 'month');
    const recordCount = [longestDistance, longestMovingTime, highestElevation, bestDay, bestMonth].filter(Boolean).length;
    return {
      year,
      longestDistance: buildActivityRecord(longestDistance),
      longestMovingTime: buildActivityRecord(longestMovingTime),
      highestElevation: buildActivityRecord(highestElevation),
      bestDay: bestDay ? {
        date: bestDay.date || null,
        distance: bestDay.distance,
        activityCount: bestDay.activityCount,
      } : null,
      bestMonth: bestMonth ? {
        year: bestMonth.year || null,
        month: bestMonth.month || null,
        distance: bestMonth.distance,
        activityCount: bestMonth.activityCount,
      } : null,
      recordCount,
    };
  }).sort((a, b) => b.year - a.year);

  return withAnalyticsSyncState(tenantId, userId, { items });
}

export async function getCurrentUserMilestones(tenantId: number | string, userId: number) {
  const rows = await loadAnalyticsActivityRows(tenantId, userId);
  const totals = buildOverviewTotals(rows);
  return withAnalyticsSyncState(tenantId, userId, {
    distance: buildMilestones(totals.totalDistance / 1000, [100, 500, 1000, 2000, 5000, 10000, 20000, 50000]),
    activities: buildMilestones(totals.totalActivities, [10, 50, 100, 500, 1000, 2000, 5000]),
    activeDays: buildMilestones(totals.activeDays, [30, 100, 365, 500, 1000]),
  });
}

export async function buildFrontendSuccessRedirect(options: {
  tenantId?: number | string | null;
  frontendOrigin?: string | null;
} = {}): Promise<string> {
  const tenantId = toText(options.tenantId || '') || null;
  const tenantAllowedOrigins = new Set<string>();
  if (tenantId) {
    const domains = await listActiveTenantDomains(tenantId);
    for (const item of domains) {
      const origin = buildOriginFromDomain(item.domain);
      if (origin) tenantAllowedOrigins.add(origin);
    }
  }

  const target = resolveConfiguredFrontendRedirectTarget(
    resolveFrontendSuccessUrl(),
    DEFAULT_STRAVA_SUCCESS_REDIRECT_PATH,
    tenantAllowedOrigins,
  );

  if (target.absoluteUrl) {
    return target.absoluteUrl;
  }

  const frontendOrigin = normalizeAbsoluteOrigin(options.frontendOrigin || '')
    || (tenantId ? await resolvePrimaryTenantFrontendOrigin(tenantId) : null)
    || getConfiguredFrontendFallbackOrigin();

  if (!frontendOrigin) {
    throw Object.assign(new Error('No trusted frontend origin available for Strava success redirect.'), {
      code: 'STRAVA_FRONTEND_ORIGIN_UNRESOLVED',
      status: 500,
    });
  }

  return buildTenantFrontendRedirect({
    frontendOrigin,
    path: target.path || DEFAULT_STRAVA_SUCCESS_REDIRECT_PATH,
  });
}

export async function buildFrontendErrorRedirect(options: {
  state?: string | null;
  tenantId?: number | string | null;
  frontendOrigin?: string | null;
  reason?: string | null;
} = {}): Promise<string> {
  const fallbackContext = await resolveFrontendOriginForCallbackFallback(options.state || '');
  const tenantId = toText(options.tenantId || fallbackContext.tenantId || '') || null;
  const tenantAllowedOrigins = new Set<string>();
  if (tenantId) {
    const domains = await listActiveTenantDomains(tenantId);
    for (const item of domains) {
      const origin = buildOriginFromDomain(item.domain);
      if (origin) tenantAllowedOrigins.add(origin);
    }
  }

  const target = resolveConfiguredFrontendRedirectTarget(
    resolveFrontendErrorUrl(),
    DEFAULT_STRAVA_ERROR_REDIRECT_PATH,
    tenantAllowedOrigins,
  );
  const reason = toText(options.reason || '') || 'strava_callback_failed';

  if (target.absoluteUrl) {
    const absolute = new URL(target.absoluteUrl);
    if (!absolute.searchParams.get('error')) {
      absolute.searchParams.set('error', '1');
    }
    absolute.searchParams.set('reason', reason);
    absolute.hash = '';
    return absolute.toString();
  }

  const frontendOrigin = normalizeAbsoluteOrigin(options.frontendOrigin || '')
    || fallbackContext.frontendOrigin
    || (tenantId ? await resolvePrimaryTenantFrontendOrigin(tenantId) : null)
    || getConfiguredFrontendFallbackOrigin();

  if (!frontendOrigin) {
    throw Object.assign(new Error('No trusted frontend origin available for Strava error redirect.'), {
      code: 'STRAVA_FRONTEND_ORIGIN_UNRESOLVED',
      status: 500,
    });
  }

  return buildTenantFrontendRedirect({
    frontendOrigin,
    path: target.path || DEFAULT_STRAVA_ERROR_REDIRECT_PATH,
    query: { reason },
  });
}

export default {
  toText,
  classifyStravaSyncError,
  calculateStravaRetryDelay,
  getRetryJobStatus,
  requireAuthenticatedUser,
  getCurrentTenantId,
  resolveTrustedFrontendOriginForOAuthStart,
  buildStravaAuthorizeUrl,
  createSignedOAuthState,
  verifySignedOAuthState,
  consumeOAuthState,
  exchangeCodeForToken,
  upsertStravaConnection,
  getCurrentUserStravaStatus,
  disconnectCurrentUser,
  refreshStravaToken,
  getValidAccessToken,
  serializeStravaSyncJob,
  startCurrentUserStravaSync,
  getCurrentUserStravaSyncJob,
  getCurrentUserStravaSyncJobDetail,
  retryCurrentUserStravaSyncJob,
  cancelCurrentUserStravaSyncJob,
  processStravaSyncBatch,
  syncCurrentUserActivities,
  listCurrentUserActivities,
  getCurrentUserActivitySummary,
  getCurrentUserAnalyticsOverview,
  getCurrentUserAnalyticsTrends,
  getCurrentUserAnalyticsYearly,
  getCurrentUserAnalyticsInsights,
  getCurrentUserAnalyticsRecords,
  getCurrentUserTopActivities,
  getCurrentUserYearlyRecords,
  getCurrentUserMilestones,
  buildFrontendSuccessRedirect,
  buildFrontendErrorRedirect,
};