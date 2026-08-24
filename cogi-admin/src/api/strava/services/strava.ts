import crypto from 'node:crypto';
import { mergeTenantWhere, resolveCurrentTenantId, toText as normalizeTenantText } from '../../../utils/tenant-scope';

const STRAVA_CONNECTION_UID = 'api::strava-connection.strava-connection';
const STRAVA_OAUTH_STATE_UID = 'api::strava-oauth-state.strava-oauth-state';
const STRAVA_ACTIVITY_UID = 'api::strava-activity.strava-activity';
const STRAVA_SYNC_JOB_UID = 'api::strava-sync-job.strava-sync-job';
const STRAVA_WEBHOOK_EVENT_UID = 'api::strava-webhook-event.strava-webhook-event';
const USER_UID = 'plugin::users-permissions.user';
const OAUTH_STATE_TTL_MS = 10 * 60 * 1000;
const STRAVA_AUTHORIZE_URL = 'https://www.strava.com/oauth/authorize';
const STRAVA_TOKEN_URL = 'https://www.strava.com/oauth/token';
const STRAVA_REVOKE_URL = 'https://www.strava.com/oauth/revoke';
const STRAVA_ACTIVITIES_URL = 'https://www.strava.com/api/v3/athlete/activities';
const STRAVA_ACTIVITY_DETAIL_URL = 'https://www.strava.com/api/v3/activities';
const STRAVA_PUSH_SUBSCRIPTIONS_URL = 'https://www.strava.com/api/v3/push_subscriptions';
const ACCESS_TOKEN_REFRESH_THRESHOLD_MS = 60 * 1000;
const INCREMENTAL_BACKTRACK_MS = 24 * 60 * 60 * 1000;
const ACTIVITY_PAGE_SIZE = 100;
const DEFAULT_STRAVA_OAUTH_STATE_RETENTION_HOURS = 24;
const DEFAULT_MAX_RETRIES = 5;
const DEFAULT_RETRY_BASE_SECONDS = 30;
const DEFAULT_RETRY_MAX_SECONDS = 15 * 60;
const DEFAULT_STRAVA_SUCCESS_REDIRECT_PATH = '/fitness?connected=1';
const DEFAULT_STRAVA_ERROR_REDIRECT_PATH = '/fitness?error=1';
const STRAVA_DIAGNOSTICS_WINDOWS = {
  '24h': 24 * 60 * 60 * 1000,
  '7d': 7 * 24 * 60 * 60 * 1000,
  '30d': 30 * 24 * 60 * 60 * 1000,
} as const;
const STRAVA_DIAGNOSTICS_CONNECTION_STALE_DAYS = 7;
const STRAVA_DIAGNOSTICS_TOKEN_EXPIRING_SOON_HOURS = 24;
const STRAVA_DIAGNOSTICS_STALE_SAMPLE_LIMIT = 5;
const STRAVA_DIAGNOSTICS_ERROR_LIMIT = 5;
const STRAVA_DIAGNOSTICS_SUBSCRIPTION_TIMEOUT_MS = 4000;

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

type StravaOAuthCallbackAutoSyncReason = 'first_connect' | 'reconnect_after_cleanup' | null;

type StravaOAuthCallbackAutoSyncContext = {
  connectionExisted: boolean;
  connectionId: number | null;
  previousStatus: string | null;
  previousCleanupStatus: StravaConnectionCleanupStatus | null;
  previousLastSyncStatus: string | null;
  localSyncedActivityCount: number;
  hadCompletedSyncJob: boolean;
  hadActiveSyncJob: boolean;
  shouldResetActivityDeleteMarkers: boolean;
  shouldAutoStartSync: boolean;
  reason: StravaOAuthCallbackAutoSyncReason;
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
  stravaAthleteId?: string | null;
  status?: string | null;
  accessToken?: string | null;
  refreshToken?: string | null;
  tokenExpiresAt?: string | null;
  disconnectedAt?: string | null;
  cleanupStatus?: string | null;
  cleanupRequestedAt?: string | null;
  cleanupCompletedAt?: string | null;
  cleanupError?: string | null;
  terminationReason?: string | null;
  scope?: string | null;
  rawAthlete?: Record<string, any> | null;
  activityDeleteMarkers?: Array<Record<string, any>> | null;
  lastSyncAt?: string | null;
  lastSyncStatus?: string | null;
  athleteFirstname?: string | null;
  athleteLastname?: string | null;
  athleteUsername?: string | null;
  profileUrl?: string | null;
  createdAt?: string | null;
  tenant?: { id?: number | string } | number | string | null;
  user?: { id?: number } | number | null;
};

type StravaConnectionCleanupStatus = 'NOT_REQUIRED' | 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED';
type StravaTerminationReason = 'manual_disconnect' | 'athlete_deauthorized' | 'user_deletion_request';

type StravaConnectionTerminationResult = {
  connectionId: number;
  status: 'DISCONNECTED';
  cleanupStatus: StravaConnectionCleanupStatus;
  terminationReason: StravaTerminationReason;
  alreadyCompleted: boolean;
  deletedActivities: number;
  deletedChallengeActivities: number;
  cleanedWebhookEvents: number;
  scrubbedSyncJobs: number;
};

type StravaRemoteRevokeResult = {
  attempted: boolean;
  success: boolean;
  warning: string | null;
  httpStatus: number | null;
};

type StravaActivityDeleteMarker = {
  stravaActivityId: string;
  deletedEventTime: string;
  deletedAt: string;
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

type StravaWebhookVerificationInput = {
  mode: string;
  verifyToken: string;
  challenge: string;
};

type StravaWebhookVerificationResult = {
  challenge: string;
};

type StravaWebhookEventStatus = 'pending' | 'ignored';

type StravaWebhookReceiveResult = {
  duplicate: boolean;
};

type StravaWebhookPayloadRecord = Record<string, unknown>;

type StravaWebhookEventInput = {
  subscriptionId: string;
  ownerId: string;
  objectType: 'activity' | 'athlete' | 'unknown';
  objectId: string;
  aspectType: 'create' | 'update' | 'delete' | 'unknown';
  eventTime: string;
  updates: unknown;
  rawPayload: unknown;
  status: StravaWebhookEventStatus;
  idempotencyKey: string;
};

type StravaWebhookHandlerResult = 'SUCCESS' | 'IGNORED' | 'NOT_IMPLEMENTED';

type ResolvedWebhookConnection = {
  connectionId: number;
  tenantId: number | string;
  userId: number;
  ownerId: string;
  connection: StravaConnectionRecord;
};

type ParsedWebhookAuthorized = true | false | null;

type StravaWebhookSubscription = {
  subscriptionId: number;
  callbackUrl: string | null;
  createdAt: string | null;
};

type StravaWebhookHealthWarning =
  | 'NO_SUBSCRIPTION'
  | 'MULTIPLE_SUBSCRIPTIONS'
  | 'CALLBACK_URL_MISMATCH'
  | 'VERIFY_TOKEN_MISSING'
  | 'CLIENT_ID_MISSING'
  | 'CLIENT_SECRET_MISSING'
  | 'CALLBACK_URL_MISSING';

type StravaWebhookHealthCheck = {
  healthy: boolean;
  subscriptionExists: boolean;
  subscriptionCount: number;
  callbackMatches: boolean;
  verifyTokenConfigured: boolean;
  clientConfigured: boolean;
  warnings: StravaWebhookHealthWarning[];
};

type StravaDashboardOverview = {
  subscription: {
    exists: boolean;
    healthy: boolean;
    callbackUrl: string | null;
    warningCount: number;
  };
  connections: {
    total: number;
    active: number;
    disconnected: number;
    error: number;
  };
  syncJobs: {
    pending: number;
    running: number;
    completed: number;
    failed: number;
    cancelled: number;
  };
  webhookEvents: {
    pending: number;
    processing: number;
    processed: number;
    ignored: number;
    failed: number;
    deadLetter: number;
  };
  system: {
    webhookRunnerEnabled: boolean;
    syncRunnerEnabled: boolean;
    webhookHandlerEnabled: boolean;
  };
};

type PlatformStravaSubscriptionOverview = {
  healthy: boolean;
  subscriptionExists: boolean;
  subscriptionCount: number;
  subscription: {
    id: number;
    callbackUrl: string | null;
    createdAt: string | null;
  } | null;
  callbackMatches: boolean;
  verifyTokenConfigured: boolean;
  clientConfigured: boolean;
  warnings: StravaWebhookHealthWarning[];
  system: {
    webhookRunnerEnabled: boolean;
    webhookHandlerEnabled: boolean;
    webhookCheckOnBoot: boolean;
    callbackUrlConfigured: boolean;
  };
};

type PlatformStravaConnectionStatus = 'ACTIVE' | 'DISCONNECTED' | 'ERROR';
type PlatformStravaConnectionSortField =
  | 'connectedAt'
  | 'tenantName'
  | 'userName'
  | 'userEmail'
  | 'athleteName'
  | 'status'
  | 'lastSyncAt'
  | 'tokenExpiresAt'
  | 'activityCount'
  | 'lastActivitySyncAt';

type PlatformStravaConnectionItem = {
  connectionId: number;
  tenantId: number;
  tenantName: string;
  userId: number;
  userName: string;
  userEmail: string | null;
  athleteId: string;
  athleteName: string;
  status: PlatformStravaConnectionStatus;
  connectedAt: string | null;
  disconnectedAt: string | null;
  lastSyncAt: string | null;
  lastActivitySyncAt: string | null;
  tokenExpiresAt: string | null;
  lastSyncError: string | null;
  activityCount: number;
  subscriptionId: number | null;
};

type PlatformStravaConnectionsQuery = {
  keyword?: unknown;
  status?: unknown;
  tenantId?: unknown;
  staleSync?: unknown;
  page?: unknown;
  pageSize?: unknown;
  sort?: unknown;
};

type PlatformStravaConnectionsResult = {
  data: PlatformStravaConnectionItem[];
  meta: {
    pagination: {
      page: number;
      pageSize: number;
      pageCount: number;
      total: number;
    };
    filters: {
      keyword: string;
      status: PlatformStravaConnectionStatus | null;
      tenantId: number | null;
      staleSync: boolean;
    };
    sort: {
      field: PlatformStravaConnectionSortField;
      direction: 'asc' | 'desc';
    };
  };
};

type PlatformStravaWebhookEventStatus = 'pending' | 'processing' | 'processed' | 'ignored' | 'failed' | 'dead_letter';
type PlatformStravaWebhookEventObjectType = 'activity' | 'athlete' | 'unknown';
type PlatformStravaWebhookEventAspectType = 'create' | 'update' | 'delete' | 'unknown';
type PlatformStravaWebhookEventSortField = 'eventTime' | 'tenantName' | 'status' | 'attempts' | 'processedAt' | 'claimedAt';

type PlatformStravaWebhookEventParty = {
  id: number;
  name: string;
};

type PlatformStravaWebhookEventConnection = {
  id: number;
  athleteId: string;
  athleteName: string;
  status: PlatformStravaConnectionStatus;
};

type PlatformStravaWebhookEventUser = {
  id: number;
  name: string;
  email: string | null;
};

type PlatformStravaWebhookEventListItem = {
  eventId: number;
  eventTime: string | null;
  tenant: PlatformStravaWebhookEventParty | null;
  connection: PlatformStravaWebhookEventConnection | null;
  user: PlatformStravaWebhookEventUser | null;
  objectType: PlatformStravaWebhookEventObjectType;
  objectId: string | null;
  aspectType: PlatformStravaWebhookEventAspectType;
  status: PlatformStravaWebhookEventStatus;
  attempts: number;
  processedAt: string | null;
  claimedBy: string | null;
  lastError: string | null;
};

type PlatformStravaWebhookEventTimelineItem = {
  key: string;
  label: string;
  time: string | null;
  note: string | null;
};

type PlatformStravaWebhookEventDetail = PlatformStravaWebhookEventListItem & {
  receivedAt: string | null;
  claimedAt: string | null;
  nextAttemptAt: string | null;
  ownerId: string | null;
  subscriptionId: number | null;
  updates: Record<string, unknown> | null;
  rawPayload: unknown;
  timeline: PlatformStravaWebhookEventTimelineItem[];
};

type PlatformStravaWebhookEventsQuery = {
  keyword?: unknown;
  status?: unknown;
  objectType?: unknown;
  aspectType?: unknown;
  tenantId?: unknown;
  connectionId?: unknown;
  stale?: unknown;
  dateFrom?: unknown;
  dateTo?: unknown;
  page?: unknown;
  pageSize?: unknown;
  sort?: unknown;
};

type PlatformStravaWebhookEventsResult = {
  data: PlatformStravaWebhookEventListItem[];
  meta: {
    pagination: {
      page: number;
      pageSize: number;
      pageCount: number;
      total: number;
    };
    filters: {
      keyword: string;
      status: PlatformStravaWebhookEventStatus | null;
      objectType: PlatformStravaWebhookEventObjectType | null;
      aspectType: PlatformStravaWebhookEventAspectType | null;
      tenantId: number | null;
      connectionId: number | null;
      stale: boolean;
      dateFrom: string | null;
      dateTo: string | null;
    };
    sort: {
      field: PlatformStravaWebhookEventSortField;
      direction: 'asc' | 'desc';
    };
  };
};

type PlatformStravaSyncJobStatus = JobStatus;
type PlatformStravaSyncJobPhase = JobPhase;
type PlatformStravaSyncJobMode = JobSyncMode;
type PlatformStravaSyncJobSortField = 'requestedAt' | 'tenantName' | 'userName' | 'status' | 'syncMode' | 'startedAt' | 'finishedAt' | 'claimedAt' | 'nextRetryAt' | 'processedActivities';

type PlatformStravaSyncJobTenant = {
  id: number;
  code: string | null;
  name: string;
};

type PlatformStravaSyncJobConnection = {
  id: number;
  athleteId: string;
  athleteName: string;
  status: PlatformStravaConnectionStatus | null;
};

type PlatformStravaSyncJobUser = {
  id: number;
  name: string;
  email: string | null;
};

type PlatformStravaSyncJobListItem = {
  jobId: number;
  id: number;
  tenant: PlatformStravaSyncJobTenant | null;
  connection: PlatformStravaSyncJobConnection | null;
  user: PlatformStravaSyncJobUser | null;
  status: PlatformStravaSyncJobStatus | string;
  phase: PlatformStravaSyncJobPhase | string | null;
  syncMode: PlatformStravaSyncJobMode | string | null;
  requestedAt: string | null;
  startedAt: string | null;
  finishedAt: string | null;
  claimedAt: string | null;
  claimedBy: string | null;
  nextRetryAt: string | null;
  attempts: number;
  currentPage: number;
  perPage: number;
  processedActivities: number;
  createdActivities: number;
  updatedActivities: number;
  skippedActivities: number;
  failedActivities: number;
  errorCode: string | null;
  lastError: string | null;
  progressMessage: string | null;
};

type PlatformStravaSyncJobTimelineItem = {
  key: string;
  label: string;
  time: string | null;
  note: string | null;
};

type PlatformStravaSyncJobDetail = PlatformStravaSyncJobListItem & {
  heartbeatAt: string | null;
  oldestSyncedAt: string | null;
  newestSyncedAt: string | null;
  recentReadyAt: string | null;
  totalActivities: number | null;
  retryable: boolean;
  cancellable: boolean;
  metadataSummary: Record<string, unknown> | null;
  timeline: PlatformStravaSyncJobTimelineItem[];
};

type PlatformStravaSyncJobsQuery = {
  keyword?: unknown;
  status?: unknown;
  tenantId?: unknown;
  connectionId?: unknown;
  userId?: unknown;
  syncMode?: unknown;
  jobType?: unknown;
  stale?: unknown;
  dateFrom?: unknown;
  dateTo?: unknown;
  page?: unknown;
  pageSize?: unknown;
  sort?: unknown;
};

type PlatformStravaSyncJobsResult = {
  data: PlatformStravaSyncJobListItem[];
  meta: {
    pagination: {
      page: number;
      pageSize: number;
      pageCount: number;
      total: number;
    };
    filters: {
      keyword: string;
      status: PlatformStravaSyncJobStatus | null;
      tenantId: number | null;
      connectionId: number | null;
      userId: number | null;
      syncMode: PlatformStravaSyncJobMode | null;
      stale: boolean;
      dateFrom: string | null;
      dateTo: string | null;
    };
    sort: {
      field: PlatformStravaSyncJobSortField;
      direction: 'asc' | 'desc';
    };
  };
};

type PlatformStravaDiagnosticsWindow = keyof typeof STRAVA_DIAGNOSTICS_WINDOWS;
type PlatformStravaDiagnosticsSeverity = 'info' | 'warning' | 'critical';
type PlatformStravaDiagnosticsHealthStatus = 'healthy' | 'warning' | 'critical' | 'unknown';
type PlatformStravaRunnerObservedStatus = 'disabled' | 'active' | 'recent_activity' | 'no_recent_activity' | 'unknown_runtime_state';

type PlatformStravaDiagnosticsQuery = {
  tenantId?: unknown;
  window?: unknown;
};

type PlatformStravaDiagnosticsRule = {
  code: string;
  severity: PlatformStravaDiagnosticsSeverity;
  message: string;
};

type PlatformStravaDiagnosticsRunner = {
  configured: boolean;
  enabled: boolean;
  alive: boolean | null;
  observedStatus: PlatformStravaRunnerObservedStatus;
  lastObservedActivityAt: string | null;
  activeItems: number;
  staleItems: number;
  warnings: PlatformStravaDiagnosticsRule[];
};

type PlatformStravaDiagnostics = {
  generatedAt: string;
  window: PlatformStravaDiagnosticsWindow;
  tenantId: number | null;
  health: {
    status: PlatformStravaDiagnosticsHealthStatus;
    score: null;
    reasons: PlatformStravaDiagnosticsRule[];
  };
  thresholds: {
    tokenExpiringSoonHours: number;
    staleConnectionDays: number;
    webhookStaleMinutes: number;
    syncStaleMinutes: number;
  };
  runners: {
    webhookRunner: PlatformStravaDiagnosticsRunner;
    webhookHandler: PlatformStravaDiagnosticsRunner;
    syncRunner: PlatformStravaDiagnosticsRunner;
    subscriptionCheckOnBoot: PlatformStravaDiagnosticsRunner;
  };
  subscription: {
    status: PlatformStravaDiagnosticsHealthStatus;
    configured: boolean;
    clientConfigured: boolean;
    verifyTokenConfigured: boolean;
    callbackUrlConfigured: boolean;
    subscriptionExists: boolean;
    subscriptionCount: number;
    callbackMatches: boolean;
    healthy: boolean | null;
    lastCheckedAt: string;
    warnings: PlatformStravaDiagnosticsRule[];
    error: { code: string; message: string } | null;
  };
  connections: {
    total: number;
    active: number;
    disconnected: number;
    revokedOrDisconnected: number;
    error: number;
    tokenExpired: number;
    tokenExpiringSoon: number;
    neverSynced: number;
    staleSync: number;
    withRecentFailure: number;
    reconnectRecommended: number;
  };
  webhookQueue: {
    pending: number;
    processing: number;
    failed: number;
    ignored: number;
    processed: number;
    deadLetter: number;
    retryWaiting: number;
    staleProcessing: number;
    oldestPendingAt: string | null;
    oldestRetryAt: string | null;
    latestReceivedAt: string | null;
    latestProcessedAt: string | null;
    processedLastWindow: number;
    failedLastWindow: number;
    deadLetterLastWindow: number;
  };
  webhookStats: {
    total: number;
    create: number;
    update: number;
    delete: number;
    processed: number;
    ignored: number;
    failed: number;
    deadLetter: number;
    averageProcessingDurationSeconds: number | null;
    maxProcessingDurationSeconds: number | null;
    latestEventAt: string | null;
  };
  syncQueue: {
    queued: number;
    running: number;
    partialReady: number;
    completed: number;
    failed: number;
    cancelled: number;
    retryWaiting: number;
    staleRunning: number;
    oldestQueuedAt: string | null;
    oldestRunningAt: string | null;
    latestRequestedAt: string | null;
    latestCompletedAt: string | null;
  };
  syncStats: {
    requested: number;
    completed: number;
    partialReady: number;
    failed: number;
    cancelled: number;
    averageDurationSeconds: number | null;
    maxDurationSeconds: number | null;
    processedActivities: number;
    createdActivities: number;
    updatedActivities: number;
    skippedActivities: number;
    failedActivities: number;
    latestCompletedAt: string | null;
  };
  staleItems: {
    webhookEvents: {
      count: number;
      items: Array<{
        id: number;
        status: string;
        objectType: string;
        aspectType: string;
        claimedAt: string | null;
        claimedBy: string | null;
        tenant: PlatformStravaWebhookEventParty | null;
        connection: PlatformStravaWebhookEventConnection | null;
        ageSeconds: number | null;
        detailUrl: string;
      }>;
    };
    syncJobs: {
      count: number;
      items: Array<{
        id: number;
        status: string;
        phase: string | null;
        claimedAt: string | null;
        heartbeatAt: string | null;
        claimedBy: string | null;
        tenant: PlatformStravaWebhookEventParty | null;
        connection: PlatformStravaWebhookEventConnection | null;
        ageSeconds: number | null;
        detailUrl: string;
      }>;
    };
  };
  errors: {
    webhook: {
      topLastErrorSummaries: Array<{ summary: string; count: number }>;
      topStatusFailureCounts: Array<{ status: string; count: number }>;
      deadLetterCount: number;
    };
    syncJobs: {
      topErrorCodes: Array<{ code: string; count: number }>;
      topLastErrorSummaries: Array<{ summary: string; count: number }>;
      failedCount: number;
      retryWaitingCount: number;
    };
    connections: {
      topFailureReasons: Array<{ summary: string; count: number }>;
      refreshTokenFailureCount: number;
    };
  };
  warnings: PlatformStravaDiagnosticsRule[];
  links: Record<string, string>;
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

function toBoolean(value: unknown, fallback: boolean): boolean {
  const text = toText(value).toLowerCase();
  if (!text) return fallback;
  if (['1', 'true', 'yes', 'on'].includes(text)) return true;
  if (['0', 'false', 'no', 'off'].includes(text)) return false;
  return fallback;
}

function toPositiveInt(value: unknown): number | null {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

function toPositiveIntOrDefault(value: unknown, fallback: number): number {
  const parsed = toPositiveInt(value);
  return parsed || fallback;
}

function clampInt(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function trimTrailingSlash(value: string): string {
  return value.replace(/\/+$/, '');
}

function normalizePlatformStravaConnectionStatus(value: unknown): PlatformStravaConnectionStatus | null {
  const normalized = toText(value).toUpperCase();
  if (normalized === 'ACTIVE' || normalized === 'DISCONNECTED' || normalized === 'ERROR') {
    return normalized;
  }
  return null;
}

function normalizePlatformStravaWebhookEventStatus(value: unknown): PlatformStravaWebhookEventStatus | null {
  const normalized = toText(value).toLowerCase();
  if (normalized === 'pending' || normalized === 'processing' || normalized === 'processed' || normalized === 'ignored' || normalized === 'failed' || normalized === 'dead_letter') {
    return normalized;
  }
  return null;
}

function normalizePlatformStravaWebhookEventObjectType(value: unknown): PlatformStravaWebhookEventObjectType | null {
  const normalized = toText(value).toLowerCase();
  if (normalized === 'activity' || normalized === 'athlete' || normalized === 'unknown') {
    return normalized;
  }
  return null;
}

function normalizePlatformStravaWebhookEventAspectType(value: unknown): PlatformStravaWebhookEventAspectType | null {
  const normalized = toText(value).toLowerCase();
  if (normalized === 'create' || normalized === 'update' || normalized === 'delete' || normalized === 'unknown') {
    return normalized;
  }
  return null;
}

function normalizeStravaConnectionCleanupStatus(value: unknown): StravaConnectionCleanupStatus {
  const normalized = toText(value).toUpperCase();
  if (normalized === 'PENDING' || normalized === 'RUNNING' || normalized === 'COMPLETED' || normalized === 'FAILED') {
    return normalized as StravaConnectionCleanupStatus;
  }
  return 'NOT_REQUIRED';
}

function normalizeTerminationReason(value: unknown): StravaTerminationReason {
  const normalized = toText(value).toLowerCase();
  if (normalized === 'athlete_deauthorized' || normalized === 'user_deletion_request') {
    return normalized as StravaTerminationReason;
  }
  return 'manual_disconnect';
}

function normalizePlatformStravaWebhookEventSortField(value: unknown): PlatformStravaWebhookEventSortField {
  const normalized = toText(value);
  const allowed: PlatformStravaWebhookEventSortField[] = ['eventTime', 'tenantName', 'status', 'attempts', 'processedAt', 'claimedAt'];
  return allowed.includes(normalized as PlatformStravaWebhookEventSortField)
    ? normalized as PlatformStravaWebhookEventSortField
    : 'eventTime';
}

function normalizePlatformStravaSyncJobStatus(value: unknown): PlatformStravaSyncJobStatus | null {
  const normalized = toText(value).toLowerCase();
  if (normalized === 'queued' || normalized === 'running' || normalized === 'partial_ready' || normalized === 'completed' || normalized === 'failed' || normalized === 'cancelled') {
    return normalized as PlatformStravaSyncJobStatus;
  }
  return null;
}

function normalizePlatformStravaSyncJobMode(value: unknown): PlatformStravaSyncJobMode | null {
  const normalized = toText(value).toLowerCase();
  if (normalized === 'initial' || normalized === 'incremental' || normalized === 'retry') {
    return normalized as PlatformStravaSyncJobMode;
  }
  return null;
}

function normalizePlatformStravaSyncJobSortField(value: unknown): PlatformStravaSyncJobSortField {
  const normalized = toText(value);
  const allowed: PlatformStravaSyncJobSortField[] = ['requestedAt', 'tenantName', 'userName', 'status', 'syncMode', 'startedAt', 'finishedAt', 'claimedAt', 'nextRetryAt', 'processedActivities'];
  return allowed.includes(normalized as PlatformStravaSyncJobSortField)
    ? normalized as PlatformStravaSyncJobSortField
    : 'requestedAt';
}

function parsePlatformStravaSyncJobSort(value: unknown): {
  field: PlatformStravaSyncJobSortField;
  direction: 'asc' | 'desc';
} {
  const raw = toText(value);
  if (!raw) {
    return { field: 'requestedAt', direction: 'desc' };
  }

  const [fieldPart, directionPart] = raw.split(':');
  return {
    field: normalizePlatformStravaSyncJobSortField(fieldPart),
    direction: normalizeSortDirection(directionPart),
  };
}

function parsePlatformStravaWebhookEventSort(value: unknown): {
  field: PlatformStravaWebhookEventSortField;
  direction: 'asc' | 'desc';
} {
  const raw = toText(value);
  if (!raw) {
    return { field: 'eventTime', direction: 'desc' };
  }

  const [fieldPart, directionPart] = raw.split(':');
  return {
    field: normalizePlatformStravaWebhookEventSortField(fieldPart),
    direction: normalizeSortDirection(directionPart),
  };
}

function normalizeDateInput(value: unknown, endOfDay = false): string | null {
  const text = toText(value);
  if (!text) return null;

  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) {
    return `${text}${endOfDay ? 'T23:59:59.999Z' : 'T00:00:00.000Z'}`;
  }

  const timestamp = Date.parse(text);
  if (Number.isNaN(timestamp)) return null;
  return new Date(timestamp).toISOString();
}

function summarizePlatformStravaWebhookError(value: unknown): string | null {
  const text = toText(value);
  if (!text) return null;
  const firstLine = text.split(/\r?\n/).map((item) => item.trim()).find(Boolean) || text;
  return firstLine.length > 160 ? `${firstLine.slice(0, 157)}...` : firstLine;
}

function parseJsonValue(value: unknown): unknown {
  if (value === null || value === undefined) return null;
  if (typeof value === 'string') {
    const text = value.trim();
    if (!text) return null;
    try {
      return JSON.parse(text);
    } catch {
      return value;
    }
  }
  return value;
}

function parseJsonRecord(value: unknown): Record<string, unknown> | null {
  const parsed = parseJsonValue(value);
  return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
    ? parsed as Record<string, unknown>
    : null;
}

function normalizePlatformStravaConnectionSortField(value: unknown): PlatformStravaConnectionSortField {
  const normalized = toText(value);
  const allowed: PlatformStravaConnectionSortField[] = [
    'connectedAt',
    'tenantName',
    'userName',
    'userEmail',
    'athleteName',
    'status',
    'lastSyncAt',
    'tokenExpiresAt',
    'activityCount',
    'lastActivitySyncAt',
  ];
  return allowed.includes(normalized as PlatformStravaConnectionSortField)
    ? normalized as PlatformStravaConnectionSortField
    : 'connectedAt';
}

function normalizeSortDirection(value: unknown): 'asc' | 'desc' {
  return toText(value).toLowerCase() === 'asc' ? 'asc' : 'desc';
}

function normalizeBooleanFlag(value: unknown): boolean {
  return toBoolean(value, false);
}

function normalizePlatformStravaDiagnosticsWindow(value: unknown): PlatformStravaDiagnosticsWindow {
  const normalized = toText(value).toLowerCase();
  if (normalized === '7d' || normalized === '30d') return normalized;
  return '24h';
}

function getDiagnosticsWindowStart(window: PlatformStravaDiagnosticsWindow, nowMs = Date.now()): string {
  return new Date(nowMs - STRAVA_DIAGNOSTICS_WINDOWS[window]).toISOString();
}

function getDiagnosticsConnectionStaleBefore(nowMs = Date.now()): string {
  return new Date(nowMs - (STRAVA_DIAGNOSTICS_CONNECTION_STALE_DAYS * 24 * 60 * 60 * 1000)).toISOString();
}

function resolveDiagnosticsWebhookStaleMs(): number {
  const staleMinutes = toPositiveIntOrDefault(process.env.STRAVA_WEBHOOK_STALE_MINUTES, 10);
  return staleMinutes * 60 * 1000;
}

function resolveDiagnosticsSyncStaleMs(): number {
  const staleMinutes = toPositiveIntOrDefault(process.env.STRAVA_SYNC_JOB_STALE_MINUTES, 10);
  return staleMinutes * 60 * 1000;
}

function summarizeDiagnosticsText(value: unknown, maxLength = 160): string | null {
  const text = toText(value);
  if (!text) return null;

  const firstLine = text.split(/\r?\n/).map((item) => item.trim()).find(Boolean) || text;
  const sanitized = firstLine
    .replace(/Bearer\s+[A-Za-z0-9._-]+/gi, 'Bearer [redacted]')
    .replace(/access[_\s-]*token/gi, 'redacted-token')
    .replace(/refresh[_\s-]*token/gi, 'redacted-token')
    .replace(/client[_\s-]*secret/gi, 'redacted-secret')
    .replace(/verify[_\s-]*token/gi, 'redacted-token');

  return sanitized.length > maxLength ? `${sanitized.slice(0, maxLength - 3)}...` : sanitized;
}

function makeDiagnosticsRule(code: string, severity: PlatformStravaDiagnosticsSeverity, message: string): PlatformStravaDiagnosticsRule {
  return { code, severity, message };
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number, code: string, message: string): Promise<T> {
  let timer: NodeJS.Timeout | null = null;

  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timer = setTimeout(() => {
          reject(Object.assign(new Error(message), { code, status: 504 }));
        }, timeoutMs);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

function parsePlatformStravaConnectionsSort(value: unknown): {
  field: PlatformStravaConnectionSortField;
  direction: 'asc' | 'desc';
} {
  const raw = toText(value);
  if (!raw) {
    return { field: 'connectedAt', direction: 'desc' };
  }

  const [fieldPart, directionPart] = raw.split(':');
  return {
    field: normalizePlatformStravaConnectionSortField(fieldPart),
    direction: normalizeSortDirection(directionPart),
  };
}

function buildPlatformStravaUserName(row: any): string {
  return toText(row?.userFullName) || toText(row?.userUsername) || toText(row?.userEmail) || `User #${toPositiveInt(row?.userId) || 0}`;
}

function buildPlatformStravaAthleteName(row: any): string {
  const fullName = [toText(row?.athleteFirstname), toText(row?.athleteLastname)].filter(Boolean).join(' ').trim();
  return fullName || toText(row?.athleteUsername) || toText(row?.athleteId) || 'Unknown athlete';
}

function buildPlatformStravaEventTime(value: unknown, fallback?: unknown): string | null {
  const raw = toText(value);
  if (/^\d+$/.test(raw)) {
    const epochMs = Number(raw) * 1000;
    if (Number.isFinite(epochMs)) {
      return new Date(epochMs).toISOString();
    }
  }

  const fallbackText = toText(fallback);
  if (fallbackText) return fallbackText;
  return null;
}

function buildPlatformStravaWebhookEventParty(row: any): PlatformStravaWebhookEventParty | null {
  const id = toPositiveInt(row?.tenantId);
  const name = toText(row?.tenantName);
  if (!id && !name) return null;
  return {
    id: id || 0,
    name: name || `Tenant #${id || 0}`,
  };
}

function buildPlatformStravaWebhookEventUser(row: any): PlatformStravaWebhookEventUser | null {
  const id = toPositiveInt(row?.userId);
  const name = buildPlatformStravaUserName(row);
  const email = toText(row?.userEmail) || null;
  if (!id && !name && !email) return null;
  return {
    id: id || 0,
    name,
    email,
  };
}

function buildPlatformStravaWebhookEventConnection(row: any): PlatformStravaWebhookEventConnection | null {
  const id = toPositiveInt(row?.connectionId);
  const athleteId = toText(row?.connectionAthleteId);
  const athleteName = buildPlatformStravaAthleteName({
    athleteFirstname: row?.connectionAthleteFirstname,
    athleteLastname: row?.connectionAthleteLastname,
    athleteUsername: row?.connectionAthleteUsername,
    athleteId,
  });
  const status = normalizePlatformStravaConnectionStatus(row?.connectionStatus);
  if (!id && !athleteId && !athleteName) return null;
  return {
    id: id || 0,
    athleteId,
    athleteName,
    status: status || 'ERROR',
  };
}

function buildPlatformStravaWebhookEventListItem(row: any): PlatformStravaWebhookEventListItem {
  return {
    eventId: toPositiveInt(row?.eventId) || 0,
    eventTime: buildPlatformStravaEventTime(row?.eventTime, row?.receivedAt),
    tenant: buildPlatformStravaWebhookEventParty(row),
    connection: buildPlatformStravaWebhookEventConnection(row),
    user: buildPlatformStravaWebhookEventUser(row),
    objectType: normalizePlatformStravaWebhookEventObjectType(row?.objectType) || 'unknown',
    objectId: toText(row?.objectId) || null,
    aspectType: normalizePlatformStravaWebhookEventAspectType(row?.aspectType) || 'unknown',
    status: normalizePlatformStravaWebhookEventStatus(row?.status) || 'failed',
    attempts: Number(row?.attempts || 0) || 0,
    processedAt: row?.processedAt || null,
    claimedBy: toText(row?.claimedBy) || null,
    lastError: summarizePlatformStravaWebhookError(row?.lastError),
  };
}

function buildPlatformStravaWebhookTimeline(detail: {
  receivedAt?: string | null;
  claimedAt?: string | null;
  processedAt?: string | null;
  nextAttemptAt?: string | null;
  status?: PlatformStravaWebhookEventStatus | null;
  attempts?: number;
  lastError?: string | null;
}): PlatformStravaWebhookEventTimelineItem[] {
  const items: PlatformStravaWebhookEventTimelineItem[] = [];
  const attempts = Number(detail.attempts || 0) || 0;

  if (detail.receivedAt) {
    items.push({ key: 'received', label: 'Received', time: detail.receivedAt, note: null });
  }
  if (detail.claimedAt) {
    items.push({ key: 'claimed', label: 'Claimed', time: detail.claimedAt, note: detail.status === 'processing' ? 'Processing' : null });
  }
  if (attempts > 1) {
    items.push({ key: 'retry', label: 'Retry', time: detail.nextAttemptAt || detail.processedAt || detail.claimedAt || detail.receivedAt || null, note: `Attempts: ${attempts}` });
  }
  if (detail.status === 'processed') {
    items.push({ key: 'processed', label: 'Processed', time: detail.processedAt || null, note: null });
  }
  if (detail.status === 'ignored') {
    items.push({ key: 'ignored', label: 'Ignored', time: detail.processedAt || null, note: detail.lastError || null });
  }
  if (detail.status === 'failed') {
    items.push({ key: 'failed', label: 'Failed', time: detail.processedAt || null, note: detail.lastError || null });
  }
  if (detail.status === 'dead_letter') {
    items.push({ key: 'dead_letter', label: 'Dead Letter', time: detail.processedAt || null, note: detail.lastError || null });
  }

  return items.filter((item) => item.time || item.note);
}

function buildPlatformStravaSyncJobTenant(row: any): PlatformStravaSyncJobTenant | null {
  const id = toPositiveInt(row?.tenantId);
  const name = toText(row?.tenantName);
  const code = toText(row?.tenantCode) || null;
  if (!id && !name && !code) return null;
  return {
    id: id || 0,
    code,
    name: name || code || `Tenant #${id || 0}`,
  };
}

function buildPlatformStravaSyncJobConnection(row: any): PlatformStravaSyncJobConnection | null {
  const id = toPositiveInt(row?.connectionId);
  const athleteId = toText(row?.connectionAthleteId);
  const athleteName = buildPlatformStravaAthleteName({
    athleteFirstname: row?.connectionAthleteFirstname,
    athleteLastname: row?.connectionAthleteLastname,
    athleteUsername: row?.connectionAthleteUsername,
    athleteId,
  });
  const status = normalizePlatformStravaConnectionStatus(row?.connectionStatus);
  if (!id && !athleteId && !athleteName) return null;
  return {
    id: id || 0,
    athleteId,
    athleteName,
    status,
  };
}

function buildPlatformStravaSyncJobUser(row: any): PlatformStravaSyncJobUser | null {
  const id = toPositiveInt(row?.userId);
  const name = buildPlatformStravaUserName(row);
  const email = toText(row?.userEmail) || null;
  if (!id && !name && !email) return null;
  return {
    id: id || 0,
    name,
    email,
  };
}

function buildPlatformStravaSyncJobPseudoRecord(row: any): StravaSyncJobRecord {
  return {
    id: toPositiveInt(row?.jobId) || 0,
    status: normalizeJobStatus(row?.status) || toText(row?.status) || null,
    phase: normalizeJobPhase(row?.phase) || toText(row?.phase) || null,
    syncMode: normalizeJobSyncMode(row?.syncMode) || toText(row?.syncMode) || null,
    currentPage: Number(row?.currentPage || 1) || 1,
    perPage: Number(row?.perPage || 0) || null,
    oldestSyncedAt: row?.oldestSyncedAt || null,
    newestSyncedAt: row?.newestSyncedAt || null,
    processedActivities: Number(row?.processedActivities || 0) || 0,
    createdActivities: Number(row?.createdActivities || 0) || 0,
    updatedActivities: Number(row?.updatedActivities || 0) || 0,
    skippedActivities: Number(row?.skippedActivities || 0) || 0,
    failedActivities: Number(row?.failedActivities || 0) || 0,
    heartbeatAt: row?.heartbeatAt || null,
    retryCount: Number(row?.retryCount || 0) || 0,
    requestedAt: row?.requestedAt || null,
    startedAt: row?.startedAt || null,
    completedAt: row?.completedAt || null,
    failedAt: row?.failedAt || null,
    cancelledAt: row?.cancelledAt || null,
    claimedAt: row?.claimedAt || null,
    claimedBy: toText(row?.claimedBy) || null,
    nextRetryAt: row?.nextRetryAt || null,
    lastErrorCode: toText(row?.lastErrorCode) || null,
    lastErrorMessage: toText(row?.lastErrorMessage) || null,
    metadata: parseJsonRecord(row?.metadata),
  };
}

function buildPlatformStravaSyncJobListItem(row: any): PlatformStravaSyncJobListItem {
  const pseudo = buildPlatformStravaSyncJobPseudoRecord(row);
  const serialized = serializeStravaSyncJob(pseudo);

  return {
    jobId: Number(serialized?.jobId || pseudo.id || 0),
    id: Number(serialized?.jobId || pseudo.id || 0),
    tenant: buildPlatformStravaSyncJobTenant(row),
    connection: buildPlatformStravaSyncJobConnection(row),
    user: buildPlatformStravaSyncJobUser(row),
    status: serialized?.status || normalizeJobStatus(pseudo.status) || toText(pseudo.status) || 'failed',
    phase: serialized?.phase || normalizeJobPhase(pseudo.phase) || toText(pseudo.phase) || null,
    syncMode: serialized?.syncMode || normalizeJobSyncMode(pseudo.syncMode) || toText(pseudo.syncMode) || null,
    requestedAt: pseudo.requestedAt || null,
    startedAt: pseudo.startedAt || null,
    finishedAt: serialized?.finishedAt || toFinishedAt(pseudo),
    claimedAt: pseudo.claimedAt || null,
    claimedBy: pseudo.claimedBy || null,
    nextRetryAt: pseudo.nextRetryAt || null,
    attempts: Number(pseudo.retryCount || 0) || 0,
    currentPage: Number(pseudo.currentPage || 1) || 1,
    perPage: Number(pseudo.perPage || 0) || 0,
    processedActivities: Number(pseudo.processedActivities || 0) || 0,
    createdActivities: Number(pseudo.createdActivities || 0) || 0,
    updatedActivities: Number(pseudo.updatedActivities || 0) || 0,
    skippedActivities: Number(pseudo.skippedActivities || 0) || 0,
    failedActivities: Number(pseudo.failedActivities || 0) || 0,
    errorCode: serialized?.lastErrorCode || pseudo.lastErrorCode || null,
    lastError: serialized?.lastErrorMessage || summarizePlatformStravaWebhookError(pseudo.lastErrorMessage) || null,
    progressMessage: serialized?.progressMessage || null,
  };
}

function buildPlatformStravaSyncJobTimeline(detail: {
  requestedAt?: string | null;
  claimedAt?: string | null;
  startedAt?: string | null;
  nextRetryAt?: string | null;
  completedAt?: string | null;
  failedAt?: string | null;
  cancelledAt?: string | null;
  status?: string | null;
  lastError?: string | null;
}): PlatformStravaSyncJobTimelineItem[] {
  const items: PlatformStravaSyncJobTimelineItem[] = [];
  if (detail.requestedAt) items.push({ key: 'requested', label: 'Requested', time: detail.requestedAt, note: null });
  if (detail.claimedAt) items.push({ key: 'claimed', label: 'Claimed', time: detail.claimedAt, note: null });
  if (detail.startedAt) items.push({ key: 'started', label: 'Started', time: detail.startedAt, note: null });
  if (detail.nextRetryAt && ['queued', 'running', 'partial_ready', 'failed'].includes(toText(detail.status).toLowerCase())) {
    items.push({ key: 'retry_scheduled', label: 'Retry scheduled', time: detail.nextRetryAt, note: detail.lastError || null });
  }
  if (detail.completedAt) items.push({ key: 'completed', label: 'Completed', time: detail.completedAt, note: null });
  if (detail.failedAt) items.push({ key: 'failed', label: 'Failed', time: detail.failedAt, note: detail.lastError || null });
  if (detail.cancelledAt) items.push({ key: 'cancelled', label: 'Cancelled', time: detail.cancelledAt, note: null });
  return items.filter((item) => item.time || item.note);
}

function buildPlatformStravaConnectionItem(row: any): PlatformStravaConnectionItem {
  return {
    connectionId: toPositiveInt(row?.connectionId) || 0,
    tenantId: toPositiveInt(row?.tenantId) || 0,
    tenantName: toText(row?.tenantName) || `Tenant #${toPositiveInt(row?.tenantId) || 0}`,
    userId: toPositiveInt(row?.userId) || 0,
    userName: buildPlatformStravaUserName(row),
    userEmail: toText(row?.userEmail) || null,
    athleteId: toText(row?.athleteId),
    athleteName: buildPlatformStravaAthleteName(row),
    status: normalizePlatformStravaConnectionStatus(row?.status) || 'ERROR',
    connectedAt: row?.connectedAt || null,
    disconnectedAt: row?.disconnectedAt || null,
    lastSyncAt: row?.lastSyncAt || null,
    lastActivitySyncAt: row?.lastActivitySyncAt || null,
    tokenExpiresAt: row?.tokenExpiresAt || null,
    lastSyncError: toText(row?.lastSyncError) || null,
    activityCount: Number(row?.activityCount || 0) || 0,
    subscriptionId: toPositiveInt(row?.subscriptionId),
  };
}

function applyPlatformStravaConnectionsSort(query: any, sort: { field: PlatformStravaConnectionSortField; direction: 'asc' | 'desc' }) {
  const direction = sort.direction;

  if (sort.field === 'tenantName') {
    query.orderBy('t.name', direction).orderBy('sc.id', direction);
    return;
  }

  if (sort.field === 'userName') {
    query.orderByRaw(`coalesce(nullif(u.full_name, ''), u.username, u.email) ${direction}, sc.id ${direction}`);
    return;
  }

  if (sort.field === 'userEmail') {
    query.orderBy('u.email', direction).orderBy('sc.id', direction);
    return;
  }

  if (sort.field === 'athleteName') {
    query.orderByRaw(`coalesce(nullif(trim(concat_ws(' ', coalesce(sc.athlete_firstname, ''), coalesce(sc.athlete_lastname, ''))), ''), sc.athlete_username, sc.strava_athlete_id) ${direction}, sc.id ${direction}`);
    return;
  }

  if (sort.field === 'status') {
    query.orderBy('sc.status', direction).orderBy('sc.id', direction);
    return;
  }

  if (sort.field === 'lastSyncAt') {
    query.orderBy('sc.last_sync_at', direction).orderBy('sc.id', direction);
    return;
  }

  if (sort.field === 'tokenExpiresAt') {
    query.orderBy('sc.token_expires_at', direction).orderBy('sc.id', direction);
    return;
  }

  if (sort.field === 'activityCount') {
    query.orderByRaw(`coalesce(activity_stats.activity_count, 0) ${direction}, sc.id ${direction}`);
    return;
  }

  if (sort.field === 'lastActivitySyncAt') {
    query.orderBy('activity_stats.last_activity_sync_at', direction).orderBy('sc.id', direction);
    return;
  }

  query.orderBy('sc.created_at', direction).orderBy('sc.id', direction);
}

function buildPlatformStravaConnectionsBaseQuery(filters: {
  keyword: string;
  status: PlatformStravaConnectionStatus | null;
  tenantId: number | null;
  staleSync: boolean;
}) {
  const knex = strapi.db.connection;
  const staleSyncBefore = getDiagnosticsConnectionStaleBefore();

  const activityStatsSubquery = knex('strava_activities_connection_lnk as sacl')
    .leftJoin('strava_activities as sa', 'sa.id', 'sacl.strava_activity_id')
    .groupBy('sacl.strava_connection_id')
    .select('sacl.strava_connection_id as connection_id')
    .select(knex.raw(`sum(case when coalesce(sa.sync_status, '') = 'DELETED_ON_STRAVA' then 0 else 1 end) as activity_count`))
    .select(knex.raw('max(sa.updated_at) as last_activity_sync_at'));

  const webhookStatsSubquery = knex('strava_webhook_events_connection_lnk as swecl')
    .leftJoin('strava_webhook_events as swe', 'swe.id', 'swecl.strava_webhook_event_id')
    .whereNotNull('swe.subscription_id')
    .groupBy('swecl.strava_connection_id')
    .select('swecl.strava_connection_id as connection_id')
    .select(knex.raw('max(swe.subscription_id) as subscription_id'));

  const query = knex('strava_connections as sc')
    .join('strava_connections_tenant_lnk as sctl', 'sctl.strava_connection_id', 'sc.id')
    .join('tenants as t', 't.id', 'sctl.tenant_id')
    .join('strava_connections_user_lnk as scul', 'scul.strava_connection_id', 'sc.id')
    .join('up_users as u', 'u.id', 'scul.user_id')
    .leftJoin(activityStatsSubquery.as('activity_stats'), 'activity_stats.connection_id', 'sc.id')
    .leftJoin(webhookStatsSubquery.as('webhook_stats'), 'webhook_stats.connection_id', 'sc.id');

  if (filters.status) {
    query.where('sc.status', filters.status);
  }

  if (filters.tenantId) {
    query.where('t.id', filters.tenantId);
  }

  if (filters.staleSync) {
    query
      .where('sc.status', 'ACTIVE')
      .whereNot('sc.last_sync_status', 'NEVER')
      .andWhere((builder: any) => {
        builder.whereNull('sc.last_sync_at').orWhere('sc.last_sync_at', '<=', staleSyncBefore);
      });
  }

  if (filters.keyword) {
    const pattern = `%${filters.keyword}%`;
    query.andWhere((builder: any) => {
      builder
        .whereILike('t.name', pattern)
        .orWhereILike('u.full_name', pattern)
        .orWhereILike('u.username', pattern)
        .orWhereILike('u.email', pattern)
        .orWhereILike('sc.strava_athlete_id', pattern)
        .orWhereILike('sc.athlete_username', pattern)
        .orWhereILike('sc.athlete_firstname', pattern)
        .orWhereILike('sc.athlete_lastname', pattern)
        .orWhereRaw(`concat_ws(' ', coalesce(sc.athlete_firstname, ''), coalesce(sc.athlete_lastname, '')) ilike ?`, [pattern]);
    });
  }

  return query;
}

export async function listPlatformStravaConnections(query: PlatformStravaConnectionsQuery = {}): Promise<PlatformStravaConnectionsResult> {
  const page = toPositiveIntOrDefault(query.page, 1);
  const pageSize = clampInt(toPositiveIntOrDefault(query.pageSize, 20), 1, 100);
  const keyword = toText(query.keyword);
  const status = normalizePlatformStravaConnectionStatus(query.status);
  const tenantId = toPositiveInt(query.tenantId);
  const staleSync = normalizeBooleanFlag(query.staleSync);
  const sort = parsePlatformStravaConnectionsSort(query.sort);
  const offset = (page - 1) * pageSize;

  const baseQuery = buildPlatformStravaConnectionsBaseQuery({ keyword, status, tenantId, staleSync });

  const totalRow = await baseQuery.clone().clearSelect().clearOrder().countDistinct({ total: 'sc.id' }).first();
  const total = Number((totalRow as any)?.total || 0) || 0;
  const pageCount = Math.max(1, Math.ceil(total / pageSize));

  const pageRows = await baseQuery
    .clone()
    .select([
      'sc.id as connectionId',
      't.id as tenantId',
      't.name as tenantName',
      'u.id as userId',
      'u.username as userUsername',
      'u.full_name as userFullName',
      'u.email as userEmail',
      'sc.strava_athlete_id as athleteId',
      'sc.athlete_username as athleteUsername',
      'sc.athlete_firstname as athleteFirstname',
      'sc.athlete_lastname as athleteLastname',
      'sc.status as status',
      'sc.created_at as connectedAt',
      'sc.disconnected_at as disconnectedAt',
      'sc.last_sync_at as lastSyncAt',
      'sc.token_expires_at as tokenExpiresAt',
      'sc.last_sync_error as lastSyncError',
      'activity_stats.activity_count as activityCount',
      'activity_stats.last_activity_sync_at as lastActivitySyncAt',
      'webhook_stats.subscription_id as subscriptionId',
    ])
    .modify((builder: any) => applyPlatformStravaConnectionsSort(builder, sort))
    .limit(pageSize)
    .offset(offset);

  return {
    data: (pageRows || []).map(buildPlatformStravaConnectionItem),
    meta: {
      pagination: {
        page,
        pageSize,
        pageCount,
        total,
      },
      filters: {
        keyword,
        status,
        tenantId,
        staleSync,
      },
      sort,
    },
  };
}

function buildPlatformStravaWebhookEventsBaseQuery(filters: {
  keyword: string;
  status: PlatformStravaWebhookEventStatus | null;
  objectType: PlatformStravaWebhookEventObjectType | null;
  aspectType: PlatformStravaWebhookEventAspectType | null;
  tenantId: number | null;
  connectionId: number | null;
  stale: boolean;
  dateFrom: string | null;
  dateTo: string | null;
}) {
  const knex = strapi.db.connection;
  const webhookStaleBefore = new Date(Date.now() - resolveDiagnosticsWebhookStaleMs()).toISOString();
  const eventTimeExpr = `case when swe.event_time ~ '^[0-9]+$' then to_timestamp(cast(swe.event_time as double precision)) else swe.created_at end`;
  const resolvedConnectionIdExpr = `coalesce(sc.id, fallback_conn.connection_id)`;
  const resolvedTenantIdExpr = `coalesce(t.id, fallback_conn.tenant_id)`;
  const resolvedTenantNameExpr = `coalesce(t.name, fallback_conn.tenant_name)`;
  const resolvedUserIdExpr = `coalesce(u.id, fallback_conn.user_id)`;
  const resolvedUserFullNameExpr = `coalesce(u.full_name, fallback_conn.user_full_name)`;
  const resolvedUserUsernameExpr = `coalesce(u.username, fallback_conn.user_username)`;
  const resolvedUserEmailExpr = `coalesce(u.email, fallback_conn.user_email)`;
  const resolvedAthleteIdExpr = `coalesce(sc.strava_athlete_id, fallback_conn.connection_athlete_id)`;
  const resolvedAthleteUsernameExpr = `coalesce(sc.athlete_username, fallback_conn.connection_athlete_username)`;
  const resolvedAthleteFirstnameExpr = `coalesce(sc.athlete_firstname, fallback_conn.connection_athlete_firstname)`;
  const resolvedAthleteLastnameExpr = `coalesce(sc.athlete_lastname, fallback_conn.connection_athlete_lastname)`;
  const resolvedConnectionStatusExpr = `coalesce(sc.status, fallback_conn.connection_status)`;

  const query = knex('strava_webhook_events as swe')
    .leftJoin('strava_webhook_events_tenant_lnk as swetl', 'swetl.strava_webhook_event_id', 'swe.id')
    .leftJoin('tenants as t', 't.id', 'swetl.tenant_id')
    .leftJoin('strava_webhook_events_connection_lnk as swecl', 'swecl.strava_webhook_event_id', 'swe.id')
    .leftJoin('strava_connections as sc', 'sc.id', 'swecl.strava_connection_id')
    .leftJoin('strava_webhook_events_user_lnk as sweul', 'sweul.strava_webhook_event_id', 'swe.id')
    .leftJoin('up_users as u', 'u.id', 'sweul.user_id')
    .leftJoin(
      knex.raw(`lateral (
        select
          scf.id as connection_id,
          scf.strava_athlete_id as connection_athlete_id,
          scf.athlete_username as connection_athlete_username,
          scf.athlete_firstname as connection_athlete_firstname,
          scf.athlete_lastname as connection_athlete_lastname,
          scf.status as connection_status,
          tf.id as tenant_id,
          tf.name as tenant_name,
          uf.id as user_id,
          uf.full_name as user_full_name,
          uf.username as user_username,
          uf.email as user_email
        from strava_connections scf
        join strava_connections_tenant_lnk sctlf on sctlf.strava_connection_id = scf.id
        join tenants tf on tf.id = sctlf.tenant_id
        join strava_connections_user_lnk sculf on sculf.strava_connection_id = scf.id
        join up_users uf on uf.id = sculf.user_id
        where scf.strava_athlete_id = swe.owner_id
        order by case when scf.status = 'ACTIVE' then 0 else 1 end, scf.id asc
        limit 1
      ) as fallback_conn on true`),
    );

  if (filters.status) {
    query.where('swe.status', filters.status);
  }
  if (filters.objectType) {
    query.where('swe.object_type', filters.objectType);
  }
  if (filters.aspectType) {
    query.where('swe.aspect_type', filters.aspectType);
  }
  if (filters.tenantId) {
    query.whereRaw(`${resolvedTenantIdExpr} = ?`, [filters.tenantId]);
  }
  if (filters.connectionId) {
    query.whereRaw(`${resolvedConnectionIdExpr} = ?`, [filters.connectionId]);
  }
  if (filters.stale) {
    query.where('swe.status', 'processing').whereRaw(`swe.claimed_at <= ?::timestamptz`, [webhookStaleBefore]);
  }
  if (filters.dateFrom) {
    query.whereRaw(`${eventTimeExpr} >= ?::timestamptz`, [filters.dateFrom]);
  }
  if (filters.dateTo) {
    query.whereRaw(`${eventTimeExpr} <= ?::timestamptz`, [filters.dateTo]);
  }
  if (filters.keyword) {
    const pattern = `%${filters.keyword}%`;
    query.andWhere((builder: any) => {
      builder
        .whereRaw(`${resolvedTenantNameExpr} ilike ?`, [pattern])
        .orWhereRaw(`${resolvedUserFullNameExpr} ilike ?`, [pattern])
        .orWhereRaw(`${resolvedUserUsernameExpr} ilike ?`, [pattern])
        .orWhereRaw(`${resolvedUserEmailExpr} ilike ?`, [pattern])
        .orWhereILike('swe.object_id', pattern)
        .orWhereILike('swe.owner_id', pattern)
        .orWhereRaw(`${resolvedAthleteIdExpr} ilike ?`, [pattern])
        .orWhereRaw(`${resolvedAthleteUsernameExpr} ilike ?`, [pattern])
        .orWhereRaw(`${resolvedAthleteFirstnameExpr} ilike ?`, [pattern])
        .orWhereRaw(`${resolvedAthleteLastnameExpr} ilike ?`, [pattern])
        .orWhereRaw(`concat_ws(' ', coalesce(${resolvedAthleteFirstnameExpr}, ''), coalesce(${resolvedAthleteLastnameExpr}, '')) ilike ?`, [pattern]);
    });
  }

  return {
    query,
    eventTimeExpr,
    resolvedConnectionIdExpr,
    resolvedTenantIdExpr,
    resolvedTenantNameExpr,
    resolvedUserIdExpr,
    resolvedUserFullNameExpr,
    resolvedUserUsernameExpr,
    resolvedUserEmailExpr,
    resolvedAthleteIdExpr,
    resolvedAthleteUsernameExpr,
    resolvedAthleteFirstnameExpr,
    resolvedAthleteLastnameExpr,
    resolvedConnectionStatusExpr,
  };
}

function applyPlatformStravaWebhookEventsSort(
  query: any,
  sort: { field: PlatformStravaWebhookEventSortField; direction: 'asc' | 'desc' },
  eventTimeExpr: string,
  resolvedTenantNameExpr: string,
) {
  const direction = sort.direction;
  if (sort.field === 'tenantName') {
    query.orderByRaw(`${resolvedTenantNameExpr} ${direction}, swe.id ${direction}`);
    return;
  }
  if (sort.field === 'status') {
    query.orderBy('swe.status', direction).orderBy('swe.id', direction);
    return;
  }
  if (sort.field === 'attempts') {
    query.orderBy('swe.attempts', direction).orderBy('swe.id', direction);
    return;
  }
  if (sort.field === 'processedAt') {
    query.orderBy('swe.processed_at', direction).orderBy('swe.id', direction);
    return;
  }
  if (sort.field === 'claimedAt') {
    query.orderBy('swe.claimed_at', direction).orderBy('swe.id', direction);
    return;
  }

  query.orderByRaw(`${eventTimeExpr} ${direction}, swe.id ${direction}`);
}

export async function listPlatformStravaWebhookEvents(query: PlatformStravaWebhookEventsQuery = {}): Promise<PlatformStravaWebhookEventsResult> {
  const page = toPositiveIntOrDefault(query.page, 1);
  const pageSize = clampInt(toPositiveIntOrDefault(query.pageSize, 20), 1, 100);
  const keyword = toText(query.keyword);
  const status = normalizePlatformStravaWebhookEventStatus(query.status);
  const objectType = normalizePlatformStravaWebhookEventObjectType(query.objectType);
  const aspectType = normalizePlatformStravaWebhookEventAspectType(query.aspectType);
  const tenantId = toPositiveInt(query.tenantId);
  const connectionId = toPositiveInt(query.connectionId);
  const stale = normalizeBooleanFlag(query.stale);
  const dateFrom = normalizeDateInput(query.dateFrom, false);
  const dateTo = normalizeDateInput(query.dateTo, true);
  const sort = parsePlatformStravaWebhookEventSort(query.sort);
  const offset = (page - 1) * pageSize;

  const {
    query: baseQuery,
    eventTimeExpr,
    resolvedConnectionIdExpr,
    resolvedTenantIdExpr,
    resolvedTenantNameExpr,
    resolvedUserIdExpr,
    resolvedUserFullNameExpr,
    resolvedUserUsernameExpr,
    resolvedUserEmailExpr,
    resolvedAthleteIdExpr,
    resolvedAthleteUsernameExpr,
    resolvedAthleteFirstnameExpr,
    resolvedAthleteLastnameExpr,
    resolvedConnectionStatusExpr,
  } = buildPlatformStravaWebhookEventsBaseQuery({
    keyword,
    status,
    objectType,
    aspectType,
    tenantId,
    connectionId,
    stale,
    dateFrom,
    dateTo,
  });

  const totalRow = await baseQuery.clone().clearSelect().clearOrder().countDistinct({ total: 'swe.id' }).first();
  const total = Number((totalRow as any)?.total || 0) || 0;
  const pageCount = Math.max(1, Math.ceil(total / pageSize));

  const rows = await baseQuery
    .clone()
    .select([
      'swe.id as eventId',
      'swe.event_time as eventTime',
      'swe.object_type as objectType',
      'swe.object_id as objectId',
      'swe.aspect_type as aspectType',
      'swe.status as status',
      'swe.attempts as attempts',
      'swe.processed_at as processedAt',
      'swe.claimed_by as claimedBy',
      'swe.last_error as lastError',
      'swe.created_at as receivedAt',
      strapi.db.connection.raw(`${resolvedTenantIdExpr} as "tenantId"`),
      strapi.db.connection.raw(`${resolvedTenantNameExpr} as "tenantName"`),
      strapi.db.connection.raw(`${resolvedConnectionIdExpr} as "connectionId"`),
      strapi.db.connection.raw(`${resolvedAthleteIdExpr} as "connectionAthleteId"`),
      strapi.db.connection.raw(`${resolvedAthleteUsernameExpr} as "connectionAthleteUsername"`),
      strapi.db.connection.raw(`${resolvedAthleteFirstnameExpr} as "connectionAthleteFirstname"`),
      strapi.db.connection.raw(`${resolvedAthleteLastnameExpr} as "connectionAthleteLastname"`),
      strapi.db.connection.raw(`${resolvedConnectionStatusExpr} as "connectionStatus"`),
      strapi.db.connection.raw(`${resolvedUserIdExpr} as "userId"`),
      strapi.db.connection.raw(`${resolvedUserUsernameExpr} as "userUsername"`),
      strapi.db.connection.raw(`${resolvedUserFullNameExpr} as "userFullName"`),
      strapi.db.connection.raw(`${resolvedUserEmailExpr} as "userEmail"`),
    ])
    .modify((builder: any) => applyPlatformStravaWebhookEventsSort(builder, sort, eventTimeExpr, resolvedTenantNameExpr))
    .limit(pageSize)
    .offset(offset);

  return {
    data: (rows || []).map(buildPlatformStravaWebhookEventListItem),
    meta: {
      pagination: {
        page,
        pageSize,
        pageCount,
        total,
      },
      filters: {
        keyword,
        status,
        objectType,
        aspectType,
        tenantId,
        connectionId,
        stale,
        dateFrom,
        dateTo,
      },
      sort,
    },
  };
}

export async function getPlatformStravaWebhookEventDetail(eventId: unknown): Promise<PlatformStravaWebhookEventDetail> {
  const resolvedEventId = toPositiveInt(eventId);
  if (!resolvedEventId) {
    throw Object.assign(new Error('Invalid webhook event id'), { status: 400 });
  }

  const rowResult = await strapi.db.connection('strava_webhook_events as swe')
    .leftJoin('strava_webhook_events_tenant_lnk as swetl', 'swetl.strava_webhook_event_id', 'swe.id')
    .leftJoin('tenants as t', 't.id', 'swetl.tenant_id')
    .leftJoin('strava_webhook_events_connection_lnk as swecl', 'swecl.strava_webhook_event_id', 'swe.id')
    .leftJoin('strava_connections as sc', 'sc.id', 'swecl.strava_connection_id')
    .leftJoin('strava_webhook_events_user_lnk as sweul', 'sweul.strava_webhook_event_id', 'swe.id')
    .leftJoin('up_users as u', 'u.id', 'sweul.user_id')
    .leftJoin(
      strapi.db.connection.raw(`lateral (
        select
          scf.id as connection_id,
          scf.strava_athlete_id as connection_athlete_id,
          scf.athlete_username as connection_athlete_username,
          scf.athlete_firstname as connection_athlete_firstname,
          scf.athlete_lastname as connection_athlete_lastname,
          scf.status as connection_status,
          tf.id as tenant_id,
          tf.name as tenant_name,
          uf.id as user_id,
          uf.full_name as user_full_name,
          uf.username as user_username,
          uf.email as user_email
        from strava_connections scf
        join strava_connections_tenant_lnk sctlf on sctlf.strava_connection_id = scf.id
        join tenants tf on tf.id = sctlf.tenant_id
        join strava_connections_user_lnk sculf on sculf.strava_connection_id = scf.id
        join up_users uf on uf.id = sculf.user_id
        where scf.strava_athlete_id = swe.owner_id
        order by case when scf.status = 'ACTIVE' then 0 else 1 end, scf.id asc
        limit 1
      ) as fallback_conn on true`),
    )
    .select([
      'swe.id as eventId',
      'swe.event_time as eventTime',
      'swe.created_at as receivedAt',
      'swe.claimed_at as claimedAt',
      'swe.next_attempt_at as nextAttemptAt',
      'swe.processed_at as processedAt',
      'swe.object_type as objectType',
      'swe.object_id as objectId',
      'swe.aspect_type as aspectType',
      'swe.status as status',
      'swe.attempts as attempts',
      'swe.claimed_by as claimedBy',
      'swe.last_error as lastError',
      'swe.owner_id as ownerId',
      'swe.subscription_id as subscriptionId',
      'swe.updates as updates',
      'swe.raw_payload as rawPayload',
      strapi.db.connection.raw(`coalesce(t.id, fallback_conn.tenant_id) as "tenantId"`),
      strapi.db.connection.raw(`coalesce(t.name, fallback_conn.tenant_name) as "tenantName"`),
      strapi.db.connection.raw(`coalesce(sc.id, fallback_conn.connection_id) as "connectionId"`),
      strapi.db.connection.raw(`coalesce(sc.strava_athlete_id, fallback_conn.connection_athlete_id) as "connectionAthleteId"`),
      strapi.db.connection.raw(`coalesce(sc.athlete_username, fallback_conn.connection_athlete_username) as "connectionAthleteUsername"`),
      strapi.db.connection.raw(`coalesce(sc.athlete_firstname, fallback_conn.connection_athlete_firstname) as "connectionAthleteFirstname"`),
      strapi.db.connection.raw(`coalesce(sc.athlete_lastname, fallback_conn.connection_athlete_lastname) as "connectionAthleteLastname"`),
      strapi.db.connection.raw(`coalesce(sc.status, fallback_conn.connection_status) as "connectionStatus"`),
      strapi.db.connection.raw(`coalesce(u.id, fallback_conn.user_id) as "userId"`),
      strapi.db.connection.raw(`coalesce(u.username, fallback_conn.user_username) as "userUsername"`),
      strapi.db.connection.raw(`coalesce(u.full_name, fallback_conn.user_full_name) as "userFullName"`),
      strapi.db.connection.raw(`coalesce(u.email, fallback_conn.user_email) as "userEmail"`),
    ])
    .where('swe.id', resolvedEventId)
    .first();

  const row = rowResult as any;

  if (!row) {
    throw Object.assign(new Error('Webhook event not found'), { status: 404 });
  }

  const baseItem = buildPlatformStravaWebhookEventListItem(row);
  const detail: PlatformStravaWebhookEventDetail = {
    ...baseItem,
    receivedAt: row?.receivedAt || null,
    claimedAt: row?.claimedAt || null,
    nextAttemptAt: row?.nextAttemptAt || null,
    ownerId: toText(row?.ownerId) || null,
    subscriptionId: toPositiveInt(row?.subscriptionId),
    updates: parseJsonRecord(row?.updates),
    rawPayload: parseJsonValue(row?.rawPayload),
    timeline: [],
  };

  detail.timeline = buildPlatformStravaWebhookTimeline(detail);
  return detail;
}

function buildPlatformStravaSyncJobsBaseQuery(filters: {
  keyword: string;
  status: PlatformStravaSyncJobStatus | null;
  tenantId: number | null;
  connectionId: number | null;
  userId: number | null;
  syncMode: PlatformStravaSyncJobMode | null;
  stale: boolean;
  dateFrom: string | null;
  dateTo: string | null;
}) {
  const knex = strapi.db.connection;
  const syncStaleBefore = new Date(Date.now() - resolveDiagnosticsSyncStaleMs()).toISOString();
  const requestedAtExpr = `coalesce(sj.requested_at, sj.created_at)`;
  const finishedAtExpr = `coalesce(sj.completed_at, sj.failed_at, sj.cancelled_at)`;

  const query = knex('strava_sync_jobs as sj')
    .leftJoin('strava_sync_jobs_tenant_lnk as sjtl', 'sjtl.strava_sync_job_id', 'sj.id')
    .leftJoin('tenants as t', 't.id', 'sjtl.tenant_id')
    .leftJoin('strava_sync_jobs_connection_lnk as sjcl', 'sjcl.strava_sync_job_id', 'sj.id')
    .leftJoin('strava_connections as sc', 'sc.id', 'sjcl.strava_connection_id')
    .leftJoin('strava_sync_jobs_user_lnk as sjul', 'sjul.strava_sync_job_id', 'sj.id')
    .leftJoin('up_users as u', 'u.id', 'sjul.user_id');

  if (filters.status) {
    query.where('sj.status', filters.status);
  }
  if (filters.tenantId) {
    query.where('t.id', filters.tenantId);
  }
  if (filters.connectionId) {
    query.where('sc.id', filters.connectionId);
  }
  if (filters.userId) {
    query.where('u.id', filters.userId);
  }
  if (filters.syncMode) {
    query.where('sj.sync_mode', filters.syncMode);
  }
  if (filters.stale) {
    query
      .where('sj.status', 'running')
      .whereRaw(`coalesce(sj.heartbeat_at, sj.claimed_at, sj.started_at, sj.requested_at) <= ?::timestamptz`, [syncStaleBefore]);
  }
  if (filters.dateFrom) {
    query.whereRaw(`${requestedAtExpr} >= ?::timestamptz`, [filters.dateFrom]);
  }
  if (filters.dateTo) {
    query.whereRaw(`${requestedAtExpr} <= ?::timestamptz`, [filters.dateTo]);
  }
  if (filters.keyword) {
    const pattern = `%${filters.keyword}%`;
    query.andWhere((builder: any) => {
      builder
        .whereILike('t.name', pattern)
        .orWhereILike('t.code', pattern)
        .orWhereILike('u.full_name', pattern)
        .orWhereILike('u.username', pattern)
        .orWhereILike('u.email', pattern)
        .orWhereILike('sc.strava_athlete_id', pattern)
        .orWhereILike('sc.athlete_username', pattern)
        .orWhereILike('sc.athlete_firstname', pattern)
        .orWhereILike('sc.athlete_lastname', pattern)
        .orWhereILike('sj.claimed_by', pattern)
        .orWhereILike('sj.last_error_code', pattern)
        .orWhereILike('sj.last_error_message', pattern)
        .orWhereRaw(`cast(sj.id as text) ilike ?`, [pattern])
        .orWhereRaw(`concat_ws(' ', coalesce(sc.athlete_firstname, ''), coalesce(sc.athlete_lastname, '')) ilike ?`, [pattern]);
    });
  }

  return { query, requestedAtExpr, finishedAtExpr };
}

function applyPlatformStravaSyncJobsSort(
  query: any,
  sort: { field: PlatformStravaSyncJobSortField; direction: 'asc' | 'desc' },
  requestedAtExpr: string,
  finishedAtExpr: string,
) {
  const direction = sort.direction;
  if (sort.field === 'tenantName') {
    query.orderBy('t.name', direction).orderBy('sj.id', direction);
    return;
  }
  if (sort.field === 'userName') {
    query.orderByRaw(`coalesce(nullif(u.full_name, ''), u.username, u.email) ${direction}, sj.id ${direction}`);
    return;
  }
  if (sort.field === 'status') {
    query.orderBy('sj.status', direction).orderBy('sj.id', direction);
    return;
  }
  if (sort.field === 'syncMode') {
    query.orderBy('sj.sync_mode', direction).orderBy('sj.id', direction);
    return;
  }
  if (sort.field === 'startedAt') {
    query.orderBy('sj.started_at', direction).orderBy('sj.id', direction);
    return;
  }
  if (sort.field === 'finishedAt') {
    query.orderByRaw(`${finishedAtExpr} ${direction}, sj.id ${direction}`);
    return;
  }
  if (sort.field === 'claimedAt') {
    query.orderBy('sj.claimed_at', direction).orderBy('sj.id', direction);
    return;
  }
  if (sort.field === 'nextRetryAt') {
    query.orderBy('sj.next_retry_at', direction).orderBy('sj.id', direction);
    return;
  }
  if (sort.field === 'processedActivities') {
    query.orderBy('sj.processed_activities', direction).orderBy('sj.id', direction);
    return;
  }

  query.orderByRaw(`${requestedAtExpr} ${direction}, sj.id ${direction}`);
}

export async function listPlatformStravaSyncJobs(query: PlatformStravaSyncJobsQuery = {}): Promise<PlatformStravaSyncJobsResult> {
  const page = toPositiveIntOrDefault(query.page, 1);
  const pageSize = clampInt(toPositiveIntOrDefault(query.pageSize, 20), 1, 100);
  const keyword = toText(query.keyword);
  const status = normalizePlatformStravaSyncJobStatus(query.status);
  const tenantId = toPositiveInt(query.tenantId);
  const connectionId = toPositiveInt(query.connectionId);
  const userId = toPositiveInt(query.userId);
  const syncMode = normalizePlatformStravaSyncJobMode(query.syncMode ?? query.jobType);
  const stale = normalizeBooleanFlag(query.stale);
  const dateFrom = normalizeDateInput(query.dateFrom, false);
  const dateTo = normalizeDateInput(query.dateTo, true);
  const sort = parsePlatformStravaSyncJobSort(query.sort);
  const offset = (page - 1) * pageSize;

  const { query: baseQuery, requestedAtExpr, finishedAtExpr } = buildPlatformStravaSyncJobsBaseQuery({
    keyword,
    status,
    tenantId,
    connectionId,
    userId,
    syncMode,
    stale,
    dateFrom,
    dateTo,
  });

  const totalRow = await baseQuery.clone().clearSelect().clearOrder().countDistinct({ total: 'sj.id' }).first();
  const total = Number((totalRow as any)?.total || 0) || 0;
  const pageCount = Math.max(1, Math.ceil(total / pageSize));

  const rows = await baseQuery
    .clone()
    .select([
      'sj.id as jobId',
      'sj.status as status',
      'sj.phase as phase',
      'sj.sync_mode as syncMode',
      'sj.current_page as currentPage',
      'sj.per_page as perPage',
      'sj.oldest_synced_at as oldestSyncedAt',
      'sj.newest_synced_at as newestSyncedAt',
      'sj.processed_activities as processedActivities',
      'sj.created_activities as createdActivities',
      'sj.updated_activities as updatedActivities',
      'sj.skipped_activities as skippedActivities',
      'sj.failed_activities as failedActivities',
      'sj.heartbeat_at as heartbeatAt',
      'sj.retry_count as retryCount',
      'sj.requested_at as requestedAt',
      'sj.started_at as startedAt',
      'sj.completed_at as completedAt',
      'sj.failed_at as failedAt',
      'sj.cancelled_at as cancelledAt',
      'sj.claimed_at as claimedAt',
      'sj.claimed_by as claimedBy',
      'sj.next_retry_at as nextRetryAt',
      'sj.last_error_code as lastErrorCode',
      'sj.last_error_message as lastErrorMessage',
      'sj.metadata as metadata',
      't.id as tenantId',
      't.code as tenantCode',
      't.name as tenantName',
      'sc.id as connectionId',
      'sc.strava_athlete_id as connectionAthleteId',
      'sc.athlete_username as connectionAthleteUsername',
      'sc.athlete_firstname as connectionAthleteFirstname',
      'sc.athlete_lastname as connectionAthleteLastname',
      'sc.status as connectionStatus',
      'u.id as userId',
      'u.username as userUsername',
      'u.full_name as userFullName',
      'u.email as userEmail',
    ])
    .modify((builder: any) => applyPlatformStravaSyncJobsSort(builder, sort, requestedAtExpr, finishedAtExpr))
    .limit(pageSize)
    .offset(offset);

  return {
    data: (rows || []).map(buildPlatformStravaSyncJobListItem),
    meta: {
      pagination: {
        page,
        pageSize,
        pageCount,
        total,
      },
      filters: {
        keyword,
        status,
        tenantId,
        connectionId,
        userId,
        syncMode,
        stale,
        dateFrom,
        dateTo,
      },
      sort,
    },
  };
}

export async function getPlatformStravaSyncJobDetail(jobId: unknown): Promise<PlatformStravaSyncJobDetail> {
  const resolvedJobId = toPositiveInt(jobId);
  if (!resolvedJobId) {
    throw Object.assign(new Error('Invalid sync job id'), { status: 400 });
  }

  const row = await strapi.db.connection('strava_sync_jobs as sj')
    .leftJoin('strava_sync_jobs_tenant_lnk as sjtl', 'sjtl.strava_sync_job_id', 'sj.id')
    .leftJoin('tenants as t', 't.id', 'sjtl.tenant_id')
    .leftJoin('strava_sync_jobs_connection_lnk as sjcl', 'sjcl.strava_sync_job_id', 'sj.id')
    .leftJoin('strava_connections as sc', 'sc.id', 'sjcl.strava_connection_id')
    .leftJoin('strava_sync_jobs_user_lnk as sjul', 'sjul.strava_sync_job_id', 'sj.id')
    .leftJoin('up_users as u', 'u.id', 'sjul.user_id')
    .select([
      'sj.id as jobId',
      'sj.status as status',
      'sj.phase as phase',
      'sj.sync_mode as syncMode',
      'sj.current_page as currentPage',
      'sj.per_page as perPage',
      'sj.oldest_synced_at as oldestSyncedAt',
      'sj.newest_synced_at as newestSyncedAt',
      'sj.processed_activities as processedActivities',
      'sj.created_activities as createdActivities',
      'sj.updated_activities as updatedActivities',
      'sj.skipped_activities as skippedActivities',
      'sj.failed_activities as failedActivities',
      'sj.heartbeat_at as heartbeatAt',
      'sj.retry_count as retryCount',
      'sj.requested_at as requestedAt',
      'sj.started_at as startedAt',
      'sj.completed_at as completedAt',
      'sj.failed_at as failedAt',
      'sj.cancelled_at as cancelledAt',
      'sj.claimed_at as claimedAt',
      'sj.claimed_by as claimedBy',
      'sj.next_retry_at as nextRetryAt',
      'sj.last_error_code as lastErrorCode',
      'sj.last_error_message as lastErrorMessage',
      'sj.metadata as metadata',
      't.id as tenantId',
      't.code as tenantCode',
      't.name as tenantName',
      'sc.id as connectionId',
      'sc.strava_athlete_id as connectionAthleteId',
      'sc.athlete_username as connectionAthleteUsername',
      'sc.athlete_firstname as connectionAthleteFirstname',
      'sc.athlete_lastname as connectionAthleteLastname',
      'sc.status as connectionStatus',
      'u.id as userId',
      'u.username as userUsername',
      'u.full_name as userFullName',
      'u.email as userEmail',
    ])
    .where('sj.id', resolvedJobId)
    .first() as any;

  if (!row) {
    throw Object.assign(new Error('Sync job not found'), { status: 404 });
  }

  const pseudo = buildPlatformStravaSyncJobPseudoRecord(row);
  const serialized = serializeStravaSyncJob(pseudo);
  const metadata = parseJsonRecord(row?.metadata);

  const detail: PlatformStravaSyncJobDetail = {
    ...buildPlatformStravaSyncJobListItem(row),
    heartbeatAt: pseudo.heartbeatAt || null,
    oldestSyncedAt: pseudo.oldestSyncedAt || null,
    newestSyncedAt: pseudo.newestSyncedAt || null,
    recentReadyAt: toText((metadata || {}).recentReadyAt) || null,
    totalActivities: typeof serialized?.totalActivities === 'number' ? serialized.totalActivities : null,
    retryable: Boolean(serialized?.canRetry),
    cancellable: Boolean(serialized?.canCancel),
    metadataSummary: metadata
      ? {
        recentActivityLimit: metadata.recentActivityLimit ?? null,
        recentProcessed: metadata.recentProcessed ?? null,
        recentPagesProcessed: metadata.recentPagesProcessed ?? null,
        pagesProcessed: metadata.pagesProcessed ?? null,
        lastCompletedPage: metadata.lastCompletedPage ?? null,
        lastCompletedPhase: metadata.lastCompletedPhase ?? null,
        lastProcessedActivityId: metadata.lastProcessedActivityId ?? null,
        snapshotIsComplete: metadata.snapshotIsComplete ?? null,
        snapshotRebuiltAt: metadata.snapshotRebuiltAt ?? null,
        afterTimestamp: metadata.afterTimestamp ?? null,
        historyExhausted: metadata.historyExhausted ?? null,
        rateLimitResetAt: metadata.rateLimitResetAt ?? null,
      }
      : null,
    timeline: [],
  };

  detail.timeline = buildPlatformStravaSyncJobTimeline({
    requestedAt: pseudo.requestedAt || null,
    claimedAt: pseudo.claimedAt || null,
    startedAt: pseudo.startedAt || null,
    nextRetryAt: pseudo.nextRetryAt || null,
    completedAt: pseudo.completedAt || null,
    failedAt: pseudo.failedAt || null,
    cancelledAt: pseudo.cancelledAt || null,
    status: detail.status,
    lastError: detail.lastError,
  });

  return detail;
}

function isNonProductionEnvironment() {
  return toText(process.env.NODE_ENV).toLowerCase() !== 'production';
}

function readStravaWebhookVerifyToken(): string {
  return process.env.STRAVA_WEBHOOK_VERIFY_TOKEN?.trim() || '';
}

function timingSafeEqualText(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);

  if (leftBuffer.length !== rightBuffer.length) {
    return false;
  }

  try {
    return crypto.timingSafeEqual(leftBuffer, rightBuffer);
  } catch {
    return false;
  }
}

function toWebhookScalarText(value: unknown): string {
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  if (typeof value === 'bigint') return String(value);
  return '';
}

function normalizeWebhookObjectType(value: unknown): 'activity' | 'athlete' | 'unknown' {
  const normalized = toWebhookScalarText(value).toLowerCase();
  return normalized === 'activity' || normalized === 'athlete' ? normalized : 'unknown';
}

function normalizeWebhookAspectType(value: unknown): 'create' | 'update' | 'delete' | 'unknown' {
  const normalized = toWebhookScalarText(value).toLowerCase();
  return normalized === 'create' || normalized === 'update' || normalized === 'delete' ? normalized : 'unknown';
}

function isWebhookPayloadRecord(value: unknown): value is StravaWebhookPayloadRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function buildStravaWebhookIdempotencyKey(parts: {
  subscriptionId: string;
  ownerId: string;
  objectType: string;
  objectId: string;
  aspectType: string;
  eventTime: string;
}): string {
  const raw = [
    parts.subscriptionId,
    parts.ownerId,
    parts.objectType,
    parts.objectId,
    parts.aspectType,
    parts.eventTime,
  ].join(':');

  return crypto.createHash('sha256').update(raw).digest('hex');
}

function normalizeStravaWebhookPayload(rawPayload: unknown): StravaWebhookEventInput {
  const payload = isWebhookPayloadRecord(rawPayload) ? rawPayload : {};
  const subscriptionId = toWebhookScalarText(payload.subscription_id);
  const ownerId = toWebhookScalarText(payload.owner_id);
  const objectType = normalizeWebhookObjectType(payload.object_type);
  const objectId = toWebhookScalarText(payload.object_id);
  const aspectType = normalizeWebhookAspectType(payload.aspect_type);
  const eventTime = toWebhookScalarText(payload.event_time);
  const status: StravaWebhookEventStatus = objectType === 'unknown' || aspectType === 'unknown'
    ? 'ignored'
    : 'pending';

  return {
    subscriptionId,
    ownerId,
    objectType,
    objectId,
    aspectType,
    eventTime,
    updates: payload.updates,
    rawPayload,
    status,
    idempotencyKey: buildStravaWebhookIdempotencyKey({
      subscriptionId,
      ownerId,
      objectType,
      objectId,
      aspectType,
      eventTime,
    }),
  };
}

function isStravaWebhookDuplicateError(error: any): boolean {
  const code = toText(error?.code);
  const constraint = toText(error?.constraint);
  const detail = toText(error?.detail);
  const message = toText(error?.message);

  return code === '23505'
    && (
      constraint === 'strava_webhook_events_idempotency_key_uq'
      || detail.includes('strava_webhook_events_idempotency_key_uq')
      || detail.includes('(idempotency_key)')
      || message.includes('idempotency_key')
    );
}

function isNotFoundActivityFetchError(error: any): boolean {
  const code = toText(error?.code).toUpperCase();
  const status = Number(error?.status || 0);
  return status === 404 || code === 'STRAVA_ACTIVITY_NOT_FOUND';
}

function isRetryableWebhookError(error: any): boolean {
  const code = toText(error?.code).toUpperCase();
  const status = Number(error?.status || 0);
  return code === 'STRAVA_RATE_LIMITED'
    || code === 'STRAVA_NETWORK_ERROR'
    || code === 'STRAVA_SERVICE_UNAVAILABLE'
    || code === 'STRAVA_TOKEN_REFRESH_FAILED'
    || code === 'STRAVA_CONNECTION_REVOKED'
    || code === 'AMBIGUOUS_CONNECTION'
    || status === 429
    || [500, 502, 503, 504].includes(status);
}

function parseWebhookAuthorizedValue(value: unknown): ParsedWebhookAuthorized {
  if (value === false || value === 0) return false;
  if (value === true || value === 1) return true;

  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (normalized === 'false' || normalized === '0') return false;
    if (normalized === 'true' || normalized === '1') return true;
  }

  return null;
}

function isConnectionRevoked(connection: StravaConnectionRecord | null | undefined): boolean {
  if (!connection?.id) return false;
  if (toText(connection.status).toUpperCase() !== 'ACTIVE') return true;
  return Boolean(toText(connection.disconnectedAt));
}

function assertConnectionUsable(connection: StravaConnectionRecord | null | undefined) {
  if (!connection?.id || isConnectionRevoked(connection)) {
    throw Object.assign(new Error('Strava connection is revoked or inactive.'), {
      code: 'STRAVA_CONNECTION_REVOKED',
      status: 409,
    });
  }
}

async function updateWebhookEventRelations(options: {
  eventId: number;
  tenantId?: number | string | null;
  userId?: number | null;
  connectionId?: number | null;
}) {
  const data: Record<string, unknown> = {}
  if (options.tenantId) data.tenant = options.tenantId
  if (options.userId) data.user = options.userId
  if (options.connectionId) data.connection = options.connectionId
  if (Object.keys(data).length === 0) return

  await strapi.db.query(STRAVA_WEBHOOK_EVENT_UID).update({
    where: { id: options.eventId },
    data,
  })
}

async function annotateWebhookEventIgnored(eventId: number, reason: string, relations: {
  tenantId?: number | string | null;
  userId?: number | null;
  connectionId?: number | null;
} = {}) {
  const data: Record<string, unknown> = {
    lastError: reason,
  }

  if (relations.tenantId) data.tenant = relations.tenantId
  if (relations.userId) data.user = relations.userId
  if (relations.connectionId) data.connection = relations.connectionId

  await strapi.db.query(STRAVA_WEBHOOK_EVENT_UID).update({
    where: { id: eventId },
    data,
  })
}

async function findWebhookConnectionCandidates(ownerId: string) {
  if (!ownerId) return []

  const rows = await strapi.db.query(STRAVA_CONNECTION_UID).findMany({
    where: {
      stravaAthleteId: ownerId,
    },
    select: ['id', 'status', 'accessToken', 'refreshToken', 'tokenExpiresAt', 'disconnectedAt', 'cleanupStatus', 'cleanupRequestedAt', 'cleanupCompletedAt', 'cleanupError', 'terminationReason', 'lastSyncAt', 'lastSyncStatus', 'athleteFirstname', 'athleteLastname', 'athleteUsername', 'profileUrl'],
    populate: {
      tenant: { select: ['id'] },
      user: { select: ['id'] },
    },
  })

  return Array.isArray(rows) ? rows : []
}

async function resolveWebhookConnection(event: { id: number; ownerId?: string | null }) : Promise<ResolvedWebhookConnection | null> {
  const ownerId = toText(event.ownerId)
  const candidates = await findWebhookConnectionCandidates(ownerId)
  if (candidates.length === 0) {
    await annotateWebhookEventIgnored(event.id, 'CONNECTION_NOT_FOUND')
    return null
  }

  const activeCandidates = candidates.filter((candidate: any) => toText(candidate?.status).toUpperCase() === 'ACTIVE')
  const selectedPool = activeCandidates.length > 0 ? activeCandidates : candidates
  if (selectedPool.length > 1) {
    throw Object.assign(new Error('Multiple active Strava connections match this webhook owner.'), {
      code: 'AMBIGUOUS_CONNECTION',
      status: 409,
    })
  }

  const selected = selectedPool[0] as any
  const tenantId = selected?.tenant?.id || selected?.tenant
  const userId = toPositiveInt(selected?.user?.id || selected?.user)
  const connectionId = toPositiveInt(selected?.id)

  if (!tenantId || !userId || !connectionId) {
    throw Object.assign(new Error('Resolved Strava connection is incomplete.'), {
      code: 'STRAVA_CONNECTION_INCOMPLETE',
      status: 409,
    })
  }

  await updateWebhookEventRelations({
    eventId: event.id,
    tenantId,
    userId,
    connectionId,
  })

  return {
    connectionId,
    tenantId,
    userId,
    ownerId,
    connection: selected as StravaConnectionRecord,
  }
}

async function fetchStravaActivityDetail(accessToken: string, activityId: string) {
  const url = `${STRAVA_ACTIVITY_DETAIL_URL}/${encodeURIComponent(activityId)}`

  let response: Response
  try {
    response = await fetch(url, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    })
  } catch (error) {
    throw Object.assign(new Error('Strava network request failed'), {
      code: 'STRAVA_NETWORK_ERROR',
      status: 503,
      cause: error,
    })
  }

  const retryAfter = toPositiveInt(response.headers.get('retry-after'))
  const rateLimitResetAtHeader = toText(response.headers.get('x-ratelimit-reset') || response.headers.get('x-readratelimit-reset') || '')
  const rateLimitResetAt = retryAfter
    ? new Date(Date.now() + retryAfter * 1000).toISOString()
    : (rateLimitResetAtHeader ? new Date(Date.now() + Number(rateLimitResetAtHeader) * 1000).toISOString() : null)

  if (response.status === 404) {
    throw Object.assign(new Error('Strava activity not found.'), {
      code: 'STRAVA_ACTIVITY_NOT_FOUND',
      status: 404,
    })
  }

  if (response.status === 429) {
    throw Object.assign(new Error('Strava rate limit reached. Please try again later.'), {
      code: 'STRAVA_RATE_LIMITED',
      status: 429,
      nextRetryAt: rateLimitResetAt,
      rateLimitResetAt,
    })
  }

  if (response.status === 401) {
    throw Object.assign(new Error('Strava access token is no longer valid.'), {
      code: 'STRAVA_AUTH_EXPIRED',
      status: 401,
    })
  }

  if (response.status === 403) {
    const bodyText = await response.text().catch(() => '')
    throw Object.assign(new Error('Strava permission denied.'), {
      code: 'STRAVA_SYNC_PERMISSION_DENIED',
      status: 403,
      body: bodyText,
    })
  }

  if ([500, 502, 503, 504].includes(response.status)) {
    throw Object.assign(new Error(`Strava service unavailable (${response.status})`), {
      code: 'STRAVA_SERVICE_UNAVAILABLE',
      status: response.status,
    })
  }

  if (!response.ok) {
    throw Object.assign(new Error(`Failed to fetch Strava activity (${response.status})`), {
      code: 'STRAVA_ACTIVITY_FETCH_FAILED',
      status: response.status,
    })
  }

  const parsed = await response.json()
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw Object.assign(new Error('Strava activity detail response is invalid'), {
      code: 'STRAVA_ACTIVITY_FETCH_FAILED',
      status: 502,
    })
  }

  return parsed as Record<string, any>
}

async function fetchStravaActivityDetailWithRecovery(connection: StravaConnectionRecord, activityId: string) {
  assertConnectionUsable(connection)
  let accessToken = await refreshStravaTokenIfNeeded(connection)

  try {
    return await fetchStravaActivityDetail(accessToken, activityId)
  } catch (error: any) {
    const classification = classifyStravaSyncError(error, { phase: 'syncing_recent' })
    if (classification.httpStatus !== 401 && classification.code !== 'STRAVA_AUTH_EXPIRED') {
      throw error
    }

    try {
      const refreshed = await refreshStravaToken(connection)
      accessToken = toText(refreshed?.accessToken)
      if (!accessToken) {
        throw Object.assign(new Error('Strava token refresh failed'), { code: 'STRAVA_TOKEN_REFRESH_FAILED', status: 401 })
      }
    } catch (refreshError) {
      throw Object.assign(new Error('Strava connection revoked after token refresh failed.'), {
        code: 'STRAVA_TOKEN_REFRESH_FAILED',
        status: 401,
        cause: refreshError,
      })
    }

    try {
      return await fetchStravaActivityDetail(accessToken, activityId)
    } catch (retryError: any) {
      const retryClassification = classifyStravaSyncError(retryError, { phase: 'syncing_recent' })
      if (retryClassification.httpStatus === 401 || retryClassification.code === 'STRAVA_AUTH_EXPIRED') {
        throw Object.assign(new Error('Strava connection is no longer valid.'), {
          code: 'STRAVA_CONNECTION_REVOKED',
          status: 401,
          cause: retryError,
        })
      }
      throw retryError
    }
  }
}

async function findWebhookActivityRecord(tenantId: number | string, connectionId: number, activityId: string) {
  return strapi.db.query(STRAVA_ACTIVITY_UID).findOne({
    where: mergeTenantWhere({ connection: { id: connectionId }, stravaActivityId: activityId }, tenantId),
    select: ['id', 'syncStatus'],
  } as any)
}

async function cancelOpenStravaSyncJobsForConnection(connectionId: number) {
  const nowIso = new Date().toISOString()
  await strapi.db.connection('strava_sync_jobs as j')
    .whereIn('j.status', ['queued', 'running', 'partial_ready', 'failed'])
    .whereExists(function existsConnection(this: any) {
      this.select(strapi.db.connection.raw('1'))
        .from('strava_sync_jobs_connection_lnk as lnk')
        .whereRaw('lnk.strava_sync_job_id = j.id')
        .andWhere('lnk.strava_connection_id', connectionId)
    })
    .update({
      status: 'cancelled',
      cancelled_at: nowIso,
      heartbeat_at: nowIso,
      next_retry_at: null,
      claimed_at: null,
      claimed_by: null,
      last_error_code: 'STRAVA_CONNECTION_REVOKED',
      last_error_message: 'Kết nối Strava đã bị thu hồi quyền truy cập.',
    })
}

async function getStravaConnectionForTermination(connectionRef: number | { id?: number | null } | null | undefined): Promise<StravaConnectionRecord | null> {
  const connectionId = toPositiveInt(typeof connectionRef === 'number' ? connectionRef : connectionRef?.id)
  if (!connectionId) return null

  const connection = await strapi.db.query(STRAVA_CONNECTION_UID).findOne({
    where: { id: connectionId },
    select: [
      'id',
      'stravaAthleteId',
      'status',
      'accessToken',
      'refreshToken',
      'tokenExpiresAt',
      'scope',
      'disconnectedAt',
      'cleanupStatus',
      'cleanupRequestedAt',
      'cleanupCompletedAt',
      'cleanupError',
      'terminationReason',
      'lastSyncAt',
      'lastSyncStatus',
      'athleteFirstname',
      'athleteLastname',
      'athleteUsername',
      'profileUrl',
      'rawAthlete',
      'createdAt',
    ],
    populate: {
      tenant: { select: ['id'] },
      user: { select: ['id'] },
    },
  })

  return (connection as StravaConnectionRecord | null) || null
}

async function markStravaConnectionCleanupState(connectionId: number, data: Record<string, unknown>) {
  await strapi.db.query(STRAVA_CONNECTION_UID).update({
    where: { id: connectionId },
    data,
  })
}

async function getCurrentStravaConnectionForTermination(tenantId: number | string, userId: number): Promise<StravaConnectionRecord | null> {
  const connection = await strapi.db.query(STRAVA_CONNECTION_UID).findOne({
    where: mergeTenantWhere({ user: { id: userId } }, tenantId),
    select: [
      'id',
      'stravaAthleteId',
      'status',
      'accessToken',
      'refreshToken',
      'tokenExpiresAt',
      'scope',
      'disconnectedAt',
      'cleanupStatus',
      'cleanupRequestedAt',
      'cleanupCompletedAt',
      'cleanupError',
      'terminationReason',
      'lastSyncAt',
      'lastSyncStatus',
      'athleteFirstname',
      'athleteLastname',
      'athleteUsername',
      'profileUrl',
      'rawAthlete',
      'createdAt',
    ],
    populate: {
      tenant: { select: ['id'] },
      user: { select: ['id'] },
    },
  })

  return (connection as StravaConnectionRecord | null) || null
}

async function blockStravaConnectionAccessForTermination(connection: StravaConnectionRecord, terminationReason: StravaTerminationReason | string) {
  const normalizedReason = normalizeTerminationReason(terminationReason)
  const nowIso = new Date().toISOString()
  const currentCleanupStatus = normalizeStravaConnectionCleanupStatus(connection.cleanupStatus)
  if (currentCleanupStatus === 'COMPLETED' && toText(connection.status).toUpperCase() === 'DISCONNECTED') {
    return {
      disconnectedAt: toText(connection.disconnectedAt) || nowIso,
      cleanupRequestedAt: toText(connection.cleanupRequestedAt) || nowIso,
    }
  }

  const disconnectedAt = toText(connection.disconnectedAt) || nowIso
  const cleanupRequestedAt = toText(connection.cleanupRequestedAt) || nowIso
  await markStravaConnectionCleanupState(connection.id, {
    status: 'DISCONNECTED',
    disconnectedAt,
    cleanupStatus: currentCleanupStatus === 'COMPLETED' ? 'COMPLETED' : 'PENDING',
    cleanupRequestedAt,
    cleanupCompletedAt: currentCleanupStatus === 'COMPLETED' ? connection.cleanupCompletedAt || null : null,
    terminationReason: toText(connection.terminationReason) || normalizedReason,
  })
  await cancelOpenStravaSyncJobsForConnection(connection.id)

  return {
    disconnectedAt,
    cleanupRequestedAt,
  }
}

async function revokeStravaAuthorizationRemotely(connection: StravaConnectionRecord): Promise<StravaRemoteRevokeResult> {
  const refreshToken = toText(connection?.refreshToken)
  const accessToken = toText(connection?.accessToken)
  const token = refreshToken || accessToken
  const tokenTypeHint = refreshToken ? 'refresh_token' : (accessToken ? 'access_token' : '')
  if (!token) {
    return {
      attempted: false,
      success: true,
      warning: null,
      httpStatus: null,
    }
  }

  let authValue = ''
  try {
    authValue = Buffer.from(`${resolveStravaClientId()}:${resolveStravaClientSecret()}`, 'utf8').toString('base64')
  } catch {
    return {
      attempted: false,
      success: false,
      warning: 'Remote Strava revoke could not be attempted because Strava API credentials are not configured.',
      httpStatus: null,
    }
  }
  const body = new URLSearchParams()
  body.set('token', token)
  if (tokenTypeHint) body.set('token_type_hint', tokenTypeHint)

  let response: Response
  try {
    response = await fetch(STRAVA_REVOKE_URL, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${authValue}`,
        'content-type': 'application/x-www-form-urlencoded',
      },
      body,
    })
  } catch {
    return {
      attempted: true,
      success: false,
      warning: 'Remote Strava revoke failed because Strava was unreachable.',
      httpStatus: null,
    }
  }

  if (response.status === 200) {
    return {
      attempted: true,
      success: true,
      warning: null,
      httpStatus: 200,
    }
  }

  if ([500, 502, 503, 504].includes(response.status)) {
    return {
      attempted: true,
      success: false,
      warning: `Remote Strava revoke failed with status ${response.status}.`,
      httpStatus: response.status,
    }
  }

  return {
    attempted: true,
    success: false,
    warning: `Remote Strava revoke returned status ${response.status}.`,
    httpStatus: response.status,
  }
}

function sanitizeStravaSyncJobMetadataForTermination(metadata: Record<string, any> | null | undefined) {
  const next = metadata && typeof metadata === 'object' && !Array.isArray(metadata)
    ? { ...metadata }
    : {}

  next.lastProcessedActivityId = null
  next.snapshotSummary = null
  return next
}

function normalizeDeleteEventTime(value: unknown): string {
  const text = toText(value)
  if (!text) return ''
  const numeric = Number(text)
  if (Number.isFinite(numeric) && numeric > 0) return String(Math.floor(numeric))
  const parsedMs = Date.parse(text)
  if (!Number.isNaN(parsedMs)) return String(Math.floor(parsedMs / 1000))
  return ''
}

function normalizeActivityDeleteMarkers(value: unknown): StravaActivityDeleteMarker[] {
  let source = value
  if (typeof source === 'string') {
    try {
      source = JSON.parse(source)
    } catch {
      source = []
    }
  }
  if (!Array.isArray(source)) return []

  const next = source
    .map((entry) => {
      if (!entry || typeof entry !== 'object' || Array.isArray(entry)) return null
      const stravaActivityId = toText((entry as any).stravaActivityId)
      const deletedEventTime = normalizeDeleteEventTime((entry as any).deletedEventTime)
      const deletedAt = toText((entry as any).deletedAt) || new Date().toISOString()
      if (!stravaActivityId || !deletedEventTime) return null
      const numericEventTime = Number(deletedEventTime)
        if (!Number.isFinite(numericEventTime) || numericEventTime <= 0) return null
      return {
        stravaActivityId,
        deletedEventTime,
        deletedAt,
      }
    })
    .filter(Boolean) as StravaActivityDeleteMarker[]

  const deduped = new Map<string, StravaActivityDeleteMarker>()
  for (const marker of next) {
    const existing = deduped.get(marker.stravaActivityId)
    if (!existing || Number(marker.deletedEventTime) >= Number(existing.deletedEventTime)) {
      deduped.set(marker.stravaActivityId, marker)
    }
  }

  return Array.from(deduped.values())
    .sort((left, right) => Number(right.deletedEventTime) - Number(left.deletedEventTime))
    .slice(0, 200)
}

async function getActivityDeleteMarkers(connectionId: number): Promise<StravaActivityDeleteMarker[]> {
  const row = await strapi.db.connection('strava_connections')
    .select('activity_delete_markers as activityDeleteMarkers')
    .where({ id: connectionId })
    .first() as any

  return normalizeActivityDeleteMarkers(row?.activityDeleteMarkers)
}

async function storeActivityDeleteMarker(connectionId: number, stravaActivityId: string, deletedEventTime: unknown) {
  const normalizedActivityId = toText(stravaActivityId)
  const normalizedEventTime = normalizeDeleteEventTime(deletedEventTime) || String(Math.floor(Date.now() / 1000))
  if (!normalizedActivityId) return

  const existing = await strapi.db.connection('strava_connections')
    .select('activity_delete_markers as activityDeleteMarkers')
    .where({ id: connectionId })
    .first() as any

  const markers = normalizeActivityDeleteMarkers(existing?.activityDeleteMarkers)
    .filter((entry) => entry.stravaActivityId !== normalizedActivityId)
  markers.unshift({
    stravaActivityId: normalizedActivityId,
    deletedEventTime: normalizedEventTime,
    deletedAt: new Date().toISOString(),
  })

  await strapi.db.connection('strava_connections')
    .where({ id: connectionId })
    .update({
      activity_delete_markers: strapi.db.connection.raw('?::jsonb', [JSON.stringify(normalizeActivityDeleteMarkers(markers))]),
      updated_at: new Date().toISOString(),
    })
}

function shouldIgnoreActivityEventAfterDeleteMarker(markers: StravaActivityDeleteMarker[], stravaActivityId: string, eventTime: unknown) {
  const normalizedActivityId = toText(stravaActivityId)
  if (!normalizedActivityId) return false
  const marker = markers.find((entry) => entry.stravaActivityId === normalizedActivityId)
  if (!marker) return false

  const normalizedEventTime = normalizeDeleteEventTime(eventTime)
  if (!normalizedEventTime) return true
  return true
}

async function invalidateConnectionSnapshotSummariesForDeletedActivity(tenantId: number | string, userId: number, connectionId: number, deletedStravaActivityId: string) {
  const rows = await strapi.db.query(STRAVA_SYNC_JOB_UID).findMany({
    where: mergeTenantWhere({ user: { id: userId }, connection: { id: connectionId } }, tenantId),
    select: ['id', 'metadata'],
  } as any)

  const jobs = Array.isArray(rows) ? rows : []
  for (const job of jobs) {
    const metadata = job?.metadata && typeof job.metadata === 'object' && !Array.isArray(job.metadata)
      ? { ...job.metadata }
      : {}
    metadata.snapshotSummary = null
    if (toText(metadata.lastProcessedActivityId) === toText(deletedStravaActivityId)) {
      metadata.lastProcessedActivityId = null
    }

    await strapi.db.query(STRAVA_SYNC_JOB_UID).update({
      where: { id: job.id },
      data: { metadata },
    } as any)
  }
}

async function listStravaActivitiesForConnection(tenantId: number | string, connectionId: number) {
  const rows = await strapi.db.query(STRAVA_ACTIVITY_UID).findMany({
    where: mergeTenantWhere({ connection: { id: connectionId } }, tenantId),
    select: ['id'],
  } as any)
  return Array.isArray(rows) ? rows : []
}

async function listChallengeActivitiesForStravaActivities(tenantId: number | string, activityIds: number[]) {
  if (activityIds.length === 0) return []
  const rows = await strapi.db.query('api::challenge-activity.challenge-activity').findMany({
    where: mergeTenantWhere({ activity: { id: { $in: activityIds } } }, tenantId),
    select: ['id', 'status', 'countedDistance', 'countedMovingTime', 'countedElevationGain', 'countedActivityCount'],
    populate: {
      participant: { select: ['id'] },
    },
  } as any)
  return Array.isArray(rows) ? rows : []
}

async function recalculateChallengeParticipantAggregates(tenantId: number | string, participantIds: number[]) {
  const uniqueParticipantIds = Array.from(new Set(participantIds.map((value) => toPositiveInt(value)).filter(Boolean)))
  const nowIso = new Date().toISOString()

  for (const participantId of uniqueParticipantIds) {
    const rows = await strapi.db.query('api::challenge-activity.challenge-activity').findMany({
      where: mergeTenantWhere({ participant: { id: participantId }, status: 'ACCEPTED' }, tenantId),
      select: ['countedDistance', 'countedMovingTime', 'countedElevationGain', 'countedActivityCount'],
    } as any)

    const totalDistance = (rows || []).reduce((sum: number, row: Record<string, any>) => sum + Number(row?.countedDistance || 0), 0)
    const totalMovingTime = (rows || []).reduce((sum: number, row: Record<string, any>) => sum + Number(row?.countedMovingTime || 0), 0)
    const totalElevationGain = (rows || []).reduce((sum: number, row: Record<string, any>) => sum + Number(row?.countedElevationGain || 0), 0)
    const activityCount = (rows || []).reduce((sum: number, row: Record<string, any>) => sum + Number(row?.countedActivityCount || 0), 0)

    await strapi.db.query('api::challenge-participant.challenge-participant').update({
      where: { id: participantId },
      data: {
        totalDistance,
        totalMovingTime,
        totalElevationGain,
        activityCount,
        lastCalculatedAt: nowIso,
      },
    } as any)
  }
}

async function cleanupChallengeDerivedDataForActivities(tenantId: number | string, activityIds: number[]) {
  const challengeActivities = await listChallengeActivitiesForStravaActivities(tenantId, activityIds)
  if (challengeActivities.length === 0) {
    return {
      deletedChallengeActivities: 0,
    }
  }

  const participantIds = Array.from(new Set(challengeActivities.map((row: any) => toPositiveInt(row?.participant?.id || row?.participant)).filter(Boolean)))
  for (const row of challengeActivities) {
    const id = toPositiveInt((row as any)?.id)
    if (!id) continue
    await strapi.db.query('api::challenge-activity.challenge-activity').delete({ where: { id } } as any)
  }

  await recalculateChallengeParticipantAggregates(tenantId, participantIds)

  return {
    deletedChallengeActivities: challengeActivities.length,
  }
}

async function cleanupStravaActivitiesForConnection(tenantId: number | string, connectionId: number) {
  const activities = await listStravaActivitiesForConnection(tenantId, connectionId)
  const activityIds = activities.map((row: any) => toPositiveInt(row?.id)).filter(Boolean)
  const challengeCleanup = await cleanupChallengeDerivedDataForActivities(tenantId, activityIds)

  for (const activityId of activityIds) {
    await strapi.db.query(STRAVA_ACTIVITY_UID).delete({ where: { id: activityId } } as any)
  }

  return {
    deletedActivities: activityIds.length,
    deletedChallengeActivities: challengeCleanup.deletedChallengeActivities,
  }
}

async function cleanupStravaWebhookEventsForConnection(tenantId: number | string, userId: number, connectionId: number) {
  const rows = await strapi.db.query(STRAVA_WEBHOOK_EVENT_UID).findMany({
    where: mergeTenantWhere({
      $or: [
        { connection: { id: connectionId } },
        { user: { id: userId } },
      ],
    }, tenantId),
    select: ['id'],
  } as any)

  const eventIds = Array.isArray(rows) ? rows.map((row: any) => toPositiveInt(row?.id)).filter(Boolean) : []
  for (const eventId of eventIds) {
    await strapi.db.query(STRAVA_WEBHOOK_EVENT_UID).update({
      where: { id: eventId },
      data: {
        rawPayload: null,
        updates: null,
      },
    })
  }

  return {
    cleanedWebhookEvents: eventIds.length,
  }
}

async function scrubWebhookEventPayload(eventId: number) {
  await strapi.db.query(STRAVA_WEBHOOK_EVENT_UID).update({
    where: { id: eventId },
    data: {
      rawPayload: null,
      updates: null,
    },
  })
}

async function cleanupStravaSyncJobsForConnection(tenantId: number | string, userId: number, connectionId: number) {
  const rows = await strapi.db.query(STRAVA_SYNC_JOB_UID).findMany({
    where: mergeTenantWhere({ user: { id: userId }, connection: { id: connectionId } }, tenantId),
    select: ['id', 'metadata'],
  } as any)

  const jobs = Array.isArray(rows) ? rows : []
  for (const job of jobs) {
    const jobId = toPositiveInt((job as any)?.id)
    if (!jobId) continue
    await strapi.db.query(STRAVA_SYNC_JOB_UID).update({
      where: { id: jobId },
      data: {
        metadata: sanitizeStravaSyncJobMetadataForTermination((job as any)?.metadata),
      },
    })
  }

  return {
    scrubbedSyncJobs: jobs.length,
  }
}

async function terminateStravaConnection(options: {
  connection: number | { id?: number | null } | null | undefined;
  terminationReason: StravaTerminationReason | string;
  source?: string;
  skipRemoteRevoke?: boolean;
  completionCleanupError?: string | null;
}): Promise<StravaConnectionTerminationResult> {
  const reason = normalizeTerminationReason(options.terminationReason)
  const skipRemoteRevoke = options.skipRemoteRevoke === true
  if (!skipRemoteRevoke) {
    throw Object.assign(new Error('Remote Strava revoke is not implemented in this patch.'), {
      code: 'STRAVA_REMOTE_REVOKE_NOT_IMPLEMENTED',
      status: 501,
    })
  }

  const connection = await getStravaConnectionForTermination(options.connection)
  if (!connection?.id) {
    throw Object.assign(new Error('Strava connection not found.'), {
      code: 'STRAVA_CONNECTION_NOT_FOUND',
      status: 404,
    })
  }

  const cleanupStatus = normalizeStravaConnectionCleanupStatus(connection.cleanupStatus)
  if (cleanupStatus === 'COMPLETED' && toText(connection.status).toUpperCase() === 'DISCONNECTED') {
    return {
      connectionId: connection.id,
      status: 'DISCONNECTED',
      cleanupStatus,
      terminationReason: normalizeTerminationReason(connection.terminationReason || reason),
      alreadyCompleted: true,
      deletedActivities: 0,
      deletedChallengeActivities: 0,
      cleanedWebhookEvents: 0,
      scrubbedSyncJobs: 0,
    }
  }

  const tenantId = connection?.tenant && typeof connection.tenant === 'object' ? connection.tenant.id : connection?.tenant
  const userId = connection?.user && typeof connection.user === 'object' ? connection.user.id : connection?.user
  const resolvedTenantId = tenantId ? String(tenantId) : ''
  const resolvedUserId = toPositiveInt(userId)
  if (!resolvedTenantId || !resolvedUserId) {
    throw Object.assign(new Error('Strava connection relations are incomplete.'), {
      code: 'STRAVA_CONNECTION_INCOMPLETE',
      status: 409,
    })
  }

  const requestedAt = toText(connection.cleanupRequestedAt) || new Date().toISOString()
  const disconnectedAt = toText(connection.disconnectedAt) || new Date().toISOString()
  const persistedReason = toText(connection.terminationReason) || reason

  await markStravaConnectionCleanupState(connection.id, {
    status: 'DISCONNECTED',
    disconnectedAt,
    accessToken: null,
    refreshToken: null,
    tokenExpiresAt: null,
    stravaAthleteId: null,
    athleteUsername: null,
    athleteFirstname: null,
    athleteLastname: null,
    profileUrl: null,
    rawAthlete: null,
    scope: null,
    cleanupStatus: 'RUNNING',
    cleanupRequestedAt: requestedAt,
    cleanupCompletedAt: null,
    cleanupError: null,
    terminationReason: persistedReason,
  })

  try {
    await cancelOpenStravaSyncJobsForConnection(connection.id)
    const activityCleanup = await cleanupStravaActivitiesForConnection(resolvedTenantId, connection.id)
    const syncJobCleanup = await cleanupStravaSyncJobsForConnection(resolvedTenantId, resolvedUserId, connection.id)
    const webhookCleanup = await cleanupStravaWebhookEventsForConnection(resolvedTenantId, resolvedUserId, connection.id)
    const completedAt = new Date().toISOString()

    await markStravaConnectionCleanupState(connection.id, {
      cleanupStatus: 'COMPLETED',
      cleanupCompletedAt: completedAt,
      cleanupError: options.completionCleanupError ? sanitizeTerminationErrorMessage(options.completionCleanupError) : null,
      terminationReason: persistedReason,
    })

    return {
      connectionId: connection.id,
      status: 'DISCONNECTED',
      cleanupStatus: 'COMPLETED',
      terminationReason: reason,
      alreadyCompleted: false,
      deletedActivities: activityCleanup.deletedActivities,
      deletedChallengeActivities: activityCleanup.deletedChallengeActivities,
      cleanedWebhookEvents: webhookCleanup.cleanedWebhookEvents,
      scrubbedSyncJobs: syncJobCleanup.scrubbedSyncJobs,
    }
  } catch (error: any) {
    await markStravaConnectionCleanupState(connection.id, {
      status: 'DISCONNECTED',
      disconnectedAt,
      accessToken: null,
      refreshToken: null,
      tokenExpiresAt: null,
      stravaAthleteId: null,
      athleteUsername: null,
      athleteFirstname: null,
      athleteLastname: null,
      profileUrl: null,
      rawAthlete: null,
      scope: null,
      cleanupStatus: 'FAILED',
      cleanupRequestedAt: requestedAt,
      cleanupCompletedAt: null,
      cleanupError: sanitizeTerminationErrorMessage(error),
      terminationReason: persistedReason,
    })

    throw Object.assign(new Error('Failed to terminate Strava connection.'), {
      code: 'STRAVA_CONNECTION_TERMINATION_FAILED',
      status: Number(error?.status || 500) || 500,
      cause: error,
    })
  }
}

async function revokeStravaConnectionForWebhook(resolved: ResolvedWebhookConnection) {
  await terminateStravaConnection({
    connection: resolved.connectionId,
    terminationReason: 'athlete_deauthorized',
    source: 'athlete_deauthorization',
    skipRemoteRevoke: true,
  })
}

async function deleteWebhookActivityRecord(tenantId: number | string, userId: number, connectionId: number, activityId: string, eventTime?: unknown) {
  await storeActivityDeleteMarker(connectionId, activityId, eventTime)
  const existing = await findWebhookActivityRecord(tenantId, connectionId, activityId)
  if (!existing?.id) return { deleted: false }

  const activityIdList = [toPositiveInt(existing.id)].filter(Boolean)
  await cleanupChallengeDerivedDataForActivities(tenantId, activityIdList)
  await strapi.db.query(STRAVA_ACTIVITY_UID).delete({
    where: { id: existing.id },
  } as any)
  await invalidateConnectionSnapshotSummariesForDeletedActivity(tenantId, userId, connectionId, activityId)

  return { deleted: true }
}

export async function processActivityWebhookEvent(event: { id: number; objectId?: string | null; ownerId?: string | null; aspectType?: string | null; eventTime?: string | null }): Promise<StravaWebhookHandlerResult> {
  const resolved = await resolveWebhookConnection(event)
  if (!resolved) return 'IGNORED'

  const objectId = toText(event.objectId)
  const eventTime = toText(event.eventTime)
  const aspectType = toText(event.aspectType).toLowerCase()
  const scopedRelations = {
    tenantId: resolved.tenantId,
    userId: resolved.userId,
    connectionId: resolved.connectionId,
  }

  if (isConnectionRevoked(resolved.connection)) {
    await annotateWebhookEventIgnored(event.id, 'CONNECTION_REVOKED', scopedRelations)
    return 'IGNORED'
  }

  if (!objectId) {
    await annotateWebhookEventIgnored(event.id, 'ACTIVITY_ID_MISSING', scopedRelations)
    return 'IGNORED'
  }

  if (aspectType === 'delete') {
    await deleteWebhookActivityRecord(resolved.tenantId, resolved.userId, resolved.connectionId, objectId, eventTime)
    await scrubWebhookEventPayload(event.id)
    return 'SUCCESS'
  }

  if (!['create', 'update'].includes(aspectType)) {
    return 'NOT_IMPLEMENTED'
  }

  const deleteMarkers = await getActivityDeleteMarkers(resolved.connectionId)
  if (shouldIgnoreActivityEventAfterDeleteMarker(deleteMarkers, objectId, eventTime)) {
    await scrubWebhookEventPayload(event.id)
    return 'SUCCESS'
  }

  try {
    const activity = await fetchStravaActivityDetailWithRecovery(resolved.connection, objectId)
    await upsertStravaActivity(resolved.tenantId, resolved.userId, resolved.connectionId, activity)
    return 'SUCCESS'
  } catch (error: any) {
    if (isNotFoundActivityFetchError(error)) {
      await annotateWebhookEventIgnored(event.id, 'ACTIVITY_NOT_FOUND', scopedRelations)
      return 'IGNORED'
    }

    if (toText(error?.code).toUpperCase() === 'STRAVA_SYNC_PERMISSION_DENIED') {
      throw Object.assign(new Error('Strava permission denied.'), {
        code: 'STRAVA_SYNC_PERMISSION_DENIED',
        status: 403,
      })
    }

    if (isRetryableWebhookError(error)) {
      throw error
    }

    throw Object.assign(new Error('Failed to process Strava activity webhook.'), {
      code: toText(error?.code).toUpperCase() || 'STRAVA_ACTIVITY_WEBHOOK_FAILED',
      status: Number(error?.status || 500) || 500,
      cause: error,
    })
  }
}

export async function processAthleteWebhookEvent(event: { id: number; ownerId?: string | null; aspectType?: string | null; rawPayload?: unknown }): Promise<StravaWebhookHandlerResult> {
  const aspectType = toText(event.aspectType).toLowerCase()
  const resolved = await resolveWebhookConnection(event)
  if (!resolved) return 'IGNORED'

  const scopedRelations = {
    tenantId: resolved.tenantId,
    userId: resolved.userId,
    connectionId: resolved.connectionId,
  }

  if (aspectType !== 'update') {
    await annotateWebhookEventIgnored(event.id, 'UNSUPPORTED_ATHLETE_UPDATE', scopedRelations)
    return 'IGNORED'
  }

  const payload = isWebhookPayloadRecord(event.rawPayload) ? event.rawPayload : {}
  const updates = isWebhookPayloadRecord(payload.updates) ? payload.updates : {}
  const authorized = parseWebhookAuthorizedValue(updates.authorized)

  if (authorized !== false) {
    await annotateWebhookEventIgnored(event.id, 'UNSUPPORTED_ATHLETE_UPDATE', scopedRelations)
    return 'IGNORED'
  }

  if (isConnectionRevoked(resolved.connection)
    && !toText(resolved.connection.accessToken)
    && !toText(resolved.connection.refreshToken)
    && normalizeStravaConnectionCleanupStatus(resolved.connection.cleanupStatus) === 'COMPLETED') {
    return 'SUCCESS'
  }

  await revokeStravaConnectionForWebhook(resolved)
  return 'SUCCESS'
}

function getConfiguredMainDomainHost(): string {
  return normalizeHost(process.env.MAIN_DOMAIN || '');
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

function isManagedTenantSubdomainHost(value: unknown): boolean {
  const host = normalizeHost(value);
  const mainDomainHost = getConfiguredMainDomainHost();
  if (!host || !mainDomainHost) return false;
  if (host === mainDomainHost) return false;
  return host.endsWith(`.${mainDomainHost}`);
}

function readRequestOrigin(ctx: any): string {
  return toText(ctx?.request?.header?.origin || ctx?.request?.headers?.origin || '');
}

function readExplicitFrontendOrigin(ctx: any): string {
  return toText(ctx?.request?.header?.['x-frontend-origin'] || ctx?.request?.headers?.['x-frontend-origin'] || '');
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

async function findActiveTenantIdByDomainHost(host: unknown): Promise<string | null> {
  const normalizedHost = normalizeHost(host);
  if (!normalizedHost) return null;

  const tenantDomain = await strapi.db.query('api::tenant-domain.tenant-domain').findOne({
    where: {
      domain: normalizedHost,
      tenantDomainStatus: 'active',
    },
    populate: {
      tenant: {
        select: ['id'],
      },
    },
  });

  return toText(tenantDomain?.tenant?.id || tenantDomain?.tenant || '') || null;
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

  if (isManagedTenantSubdomainHost(host)) return true;

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
    normalizeAbsoluteOrigin(readExplicitFrontendOrigin(ctx)),
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

    if (isManagedTenantSubdomainHost(candidateHost)) {
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

export async function resolveTenantIdForStravaOAuthStart(ctx: any): Promise<number | string> {
  for (const candidate of collectPotentialFrontendOrigins(ctx)) {
    const candidateHost = normalizeHost(candidate);
    if (!candidateHost) continue;

    const tenantId = await findActiveTenantIdByDomainHost(candidateHost);
    if (tenantId) {
      return tenantId;
    }
  }

  return resolveCurrentTenantId(ctx);
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

function resolveStravaWebhookCallbackUrl(required = true): string {
  const value = toText(process.env.STRAVA_WEBHOOK_CALLBACK_URL);
  if (!value) {
    if (!required) return '';
    throw Object.assign(new Error('STRAVA_WEBHOOK_CALLBACK_URL is not configured'), {
      code: 'STRAVA_WEBHOOK_CALLBACK_URL_MISSING',
      status: 500,
    });
  }

  try {
    const parsed = new URL(value);
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      throw new Error('invalid protocol');
    }
    return parsed.toString();
  } catch {
    throw Object.assign(new Error('STRAVA_WEBHOOK_CALLBACK_URL is invalid'), {
      code: 'STRAVA_WEBHOOK_CALLBACK_URL_INVALID',
      status: 500,
    });
  }
}

function shouldCheckStravaWebhookOnBoot(): boolean {
  return toBoolean(process.env.STRAVA_WEBHOOK_CHECK_ON_BOOT, false);
}

function normalizeWebhookSubscription(item: any): StravaWebhookSubscription {
  const rawCreatedAt = item?.created_at;
  let createdAt: string | null = null;

  if (rawCreatedAt !== null && rawCreatedAt !== undefined && rawCreatedAt !== '') {
    const numeric = typeof rawCreatedAt === 'number'
      ? rawCreatedAt
      : (/^\d+(\.\d+)?$/.test(String(rawCreatedAt).trim()) ? Number(rawCreatedAt) : NaN);

    if (Number.isFinite(numeric)) {
      const millis = numeric > 1e12 ? numeric : numeric * 1000;
      const timestamp = new Date(millis).getTime();
      createdAt = Number.isFinite(timestamp) ? new Date(timestamp).toISOString() : null;
    } else {
      const timestamp = Date.parse(String(rawCreatedAt));
      createdAt = Number.isFinite(timestamp) ? new Date(timestamp).toISOString() : null;
    }
  }

  return {
    subscriptionId: Number(item?.id || 0) || 0,
    callbackUrl: toText(item?.callback_url) || null,
    createdAt,
  };
}

async function requestStravaWebhookSubscriptions(options: {
  method: 'GET' | 'POST' | 'DELETE';
  subscriptionId?: number | null;
  body?: Record<string, unknown> | null;
  operation: 'list' | 'create' | 'delete';
}) {
  const clientId = resolveStravaClientId();
  const clientSecret = resolveStravaClientSecret();
  const url = new URL(options.subscriptionId
    ? `${STRAVA_PUSH_SUBSCRIPTIONS_URL}/${String(options.subscriptionId)}`
    : STRAVA_PUSH_SUBSCRIPTIONS_URL);

  if (options.method === 'GET' || options.method === 'DELETE') {
    url.searchParams.set('client_id', clientId);
    url.searchParams.set('client_secret', clientSecret);
  }

  const startedAt = Date.now();
  const headers: Record<string, string> = {};
  let body: string | undefined;
  if (options.method === 'POST') {
    headers['content-type'] = 'application/json';
    body = JSON.stringify({
      client_id: clientId,
      client_secret: clientSecret,
      ...(options.body || {}),
    });
  }

  let response: Response;
  try {
    response = await fetch(url.toString(), {
      method: options.method,
      headers,
      body,
    });
  } catch (error) {
    const code = options.operation === 'delete'
      ? 'STRAVA_SUBSCRIPTION_DELETE_FAILED'
      : options.operation === 'create'
        ? 'STRAVA_SUBSCRIPTION_CREATE_FAILED'
        : 'STRAVA_SUBSCRIPTION_LIST_FAILED';
    throw Object.assign(new Error('Strava subscription request failed'), {
      code,
      status: 503,
      cause: error,
    });
  }

  const durationMs = Date.now() - startedAt;
  const subscriptionId = options.subscriptionId ? String(options.subscriptionId) : '-';
  strapi.log.info(`[strava.subscription] operation=${options.operation} method=${options.method} subscriptionId=${subscriptionId} callbackUrl=${options.body?.callback_url ? String(options.body.callback_url) : '-'} status=${String(response.status)} duration=${String(durationMs)}ms`);

  if (options.method === 'GET' && response.status === 404) {
    return { ok: true, status: 404, data: [] };
  }

  if (options.method === 'DELETE' && response.status === 404) {
    return { ok: true, status: 404, data: null };
  }

  if (!response.ok) {
    const code = options.operation === 'delete'
      ? 'STRAVA_SUBSCRIPTION_DELETE_FAILED'
      : options.operation === 'create'
        ? 'STRAVA_SUBSCRIPTION_CREATE_FAILED'
        : 'STRAVA_SUBSCRIPTION_LIST_FAILED';
    throw Object.assign(new Error(`Strava subscription ${options.operation} failed`), {
      code,
      status: response.status,
    });
  }

  const text = await response.text();
  const data = text ? JSON.parse(text) : null;
  return { ok: true, status: response.status, data };
}

export async function listWebhookSubscriptions(): Promise<StravaWebhookSubscription[]> {
  const result = await requestStravaWebhookSubscriptions({ method: 'GET', operation: 'list' });
  return Array.isArray(result.data) ? result.data.map(normalizeWebhookSubscription).filter((item) => item.subscriptionId > 0) : [];
}

export async function getWebhookSubscription(): Promise<StravaWebhookSubscription | null> {
  const callbackUrl = resolveStravaWebhookCallbackUrl(false);
  const subscriptions = await listWebhookSubscriptions();
  if (!callbackUrl) return subscriptions[0] || null;
  return subscriptions.find((item) => item.callbackUrl === callbackUrl) || subscriptions[0] || null;
}

export async function createWebhookSubscription(): Promise<{ subscription: StravaWebhookSubscription; existed: boolean }> {
  const callbackUrl = resolveStravaWebhookCallbackUrl(true);
  const verifyToken = readStravaWebhookVerifyToken();
  if (!verifyToken) {
    throw Object.assign(new Error('Strava webhook verify token is not configured'), {
      code: 'STRAVA_SUBSCRIPTION_CREATE_FAILED',
      status: 500,
    });
  }

  const existing = await listWebhookSubscriptions();
  const matched = existing.find((item) => item.callbackUrl === callbackUrl);
  if (matched) {
    return { subscription: matched, existed: true };
  }

  const result = await requestStravaWebhookSubscriptions({
    method: 'POST',
    operation: 'create',
    body: {
      callback_url: callbackUrl,
      verify_token: verifyToken,
    },
  });

  const subscription = normalizeWebhookSubscription(result.data || {});
  if (!subscription.subscriptionId) {
    throw Object.assign(new Error('Strava subscription create returned invalid payload'), {
      code: 'STRAVA_SUBSCRIPTION_CREATE_FAILED',
      status: 502,
    });
  }

  return { subscription, existed: false };
}

export async function deleteWebhookSubscription(subscriptionId: number | string): Promise<{ deleted: boolean }> {
  const normalizedId = toPositiveInt(subscriptionId);
  if (!normalizedId) {
    return { deleted: false };
  }

  const result = await requestStravaWebhookSubscriptions({
    method: 'DELETE',
    operation: 'delete',
    subscriptionId: normalizedId,
  });

  return { deleted: result.status !== 404 };
}

export async function deleteAllWebhookSubscriptions(): Promise<{ deletedIds: number[] }> {
  const subscriptions = await listWebhookSubscriptions();
  const deletedIds: number[] = [];
  for (const subscription of subscriptions) {
    const result = await deleteWebhookSubscription(subscription.subscriptionId);
    if (result.deleted) {
      deletedIds.push(subscription.subscriptionId);
    }
  }
  return { deletedIds };
}

export async function checkWebhookHealth(): Promise<StravaWebhookHealthCheck> {
  const warnings: StravaWebhookHealthWarning[] = [];
  const callbackUrl = resolveStravaWebhookCallbackUrl(false);
  const verifyTokenConfigured = Boolean(readStravaWebhookVerifyToken());
  const clientIdConfigured = Boolean(toText(process.env.STRAVA_CLIENT_ID));
  const clientSecretConfigured = Boolean(toText(process.env.STRAVA_CLIENT_SECRET));
  const clientConfigured = clientIdConfigured && clientSecretConfigured;

  if (!callbackUrl) warnings.push('CALLBACK_URL_MISSING');
  if (!verifyTokenConfigured) warnings.push('VERIFY_TOKEN_MISSING');
  if (!clientIdConfigured) warnings.push('CLIENT_ID_MISSING');
  if (!clientSecretConfigured) warnings.push('CLIENT_SECRET_MISSING');

  let subscriptions: StravaWebhookSubscription[] = [];
  if (clientConfigured) {
    try {
      subscriptions = await listWebhookSubscriptions();
    } catch {
      subscriptions = [];
    }
  }

  const subscriptionCount = subscriptions.length;
  const subscriptionExists = subscriptionCount > 0;
  const callbackMatches = Boolean(callbackUrl) && subscriptions.some((item) => item.callbackUrl === callbackUrl);

  if (!subscriptionExists) warnings.push('NO_SUBSCRIPTION');
  if (subscriptionCount > 1) warnings.push('MULTIPLE_SUBSCRIPTIONS');
  if (subscriptionExists && callbackUrl && !callbackMatches) warnings.push('CALLBACK_URL_MISMATCH');

  return {
    healthy: warnings.length === 0,
    subscriptionExists,
    subscriptionCount,
    callbackMatches,
    verifyTokenConfigured,
    clientConfigured,
    warnings,
  };
}

export async function getStravaDashboardOverview(): Promise<StravaDashboardOverview> {
  const [health, subscriptions, connectionRows, syncJobRows, webhookEventRows] = await Promise.all([
    checkWebhookHealth(),
    listWebhookSubscriptions(),
    strapi.db.connection('strava_connections')
      .select('status')
      .count('* as count')
      .groupBy('status'),
    strapi.db.connection('strava_sync_jobs')
      .select('status')
      .count('* as count')
      .groupBy('status'),
    strapi.db.connection('strava_webhook_events')
      .select('status')
      .count('* as count')
      .groupBy('status'),
  ]);

  const connectionCounts = new Map<string, number>();
  for (const row of connectionRows || []) {
    connectionCounts.set(toText((row as any)?.status).toUpperCase(), Number((row as any)?.count || 0));
  }

  const syncJobCounts = new Map<string, number>();
  for (const row of syncJobRows || []) {
    syncJobCounts.set(toText((row as any)?.status).toLowerCase(), Number((row as any)?.count || 0));
  }

  const webhookEventCounts = new Map<string, number>();
  for (const row of webhookEventRows || []) {
    webhookEventCounts.set(toText((row as any)?.status).toLowerCase(), Number((row as any)?.count || 0));
  }

  const matchedSubscription = subscriptions.find((item) => item.callbackUrl === resolveStravaWebhookCallbackUrl(false)) || subscriptions[0] || null;

  return {
    subscription: {
      exists: health.subscriptionExists,
      healthy: health.healthy,
      callbackUrl: matchedSubscription?.callbackUrl || null,
      warningCount: health.warnings.length,
    },
    connections: {
      total: Array.from(connectionCounts.values()).reduce((sum, value) => sum + value, 0),
      active: connectionCounts.get('ACTIVE') || 0,
      disconnected: connectionCounts.get('DISCONNECTED') || 0,
      error: connectionCounts.get('ERROR') || 0,
    },
    syncJobs: {
      pending: syncJobCounts.get('queued') || 0,
      running: (syncJobCounts.get('running') || 0) + (syncJobCounts.get('partial_ready') || 0),
      completed: syncJobCounts.get('completed') || 0,
      failed: syncJobCounts.get('failed') || 0,
      cancelled: syncJobCounts.get('cancelled') || 0,
    },
    webhookEvents: {
      pending: webhookEventCounts.get('pending') || 0,
      processing: webhookEventCounts.get('processing') || 0,
      processed: webhookEventCounts.get('processed') || 0,
      ignored: webhookEventCounts.get('ignored') || 0,
      failed: webhookEventCounts.get('failed') || 0,
      deadLetter: webhookEventCounts.get('dead_letter') || 0,
    },
    system: {
      webhookRunnerEnabled: toBoolean(process.env.STRAVA_WEBHOOK_RUNNER_ENABLED, false),
      syncRunnerEnabled: toBoolean(process.env.STRAVA_SYNC_RUNNER_ENABLED, false),
      webhookHandlerEnabled: toBoolean(process.env.STRAVA_WEBHOOK_HANDLER_ENABLED, false),
    },
  };
}

export async function getPlatformStravaSubscriptionOverview(): Promise<PlatformStravaSubscriptionOverview> {
  const [health, subscription] = await Promise.all([
    checkWebhookHealth(),
    getWebhookSubscription(),
  ]);

  return {
    healthy: health.healthy,
    subscriptionExists: health.subscriptionExists,
    subscriptionCount: health.subscriptionCount,
    subscription: subscription?.subscriptionId
      ? {
        id: subscription.subscriptionId,
        callbackUrl: subscription.callbackUrl || null,
        createdAt: subscription.createdAt || null,
      }
      : null,
    callbackMatches: health.callbackMatches,
    verifyTokenConfigured: health.verifyTokenConfigured,
    clientConfigured: health.clientConfigured,
    warnings: health.warnings,
    system: {
      webhookRunnerEnabled: toBoolean(process.env.STRAVA_WEBHOOK_RUNNER_ENABLED, false),
      webhookHandlerEnabled: toBoolean(process.env.STRAVA_WEBHOOK_HANDLER_ENABLED, false),
      webhookCheckOnBoot: shouldCheckStravaWebhookOnBoot(),
      callbackUrlConfigured: Boolean(resolveStravaWebhookCallbackUrl(false)),
    },
  };
}

async function getPlatformStravaSubscriptionDiagnostics(generatedAt: string): Promise<PlatformStravaDiagnostics['subscription']> {
  const callbackUrl = resolveStravaWebhookCallbackUrl(false);
  const verifyTokenConfigured = Boolean(readStravaWebhookVerifyToken());
  const clientConfigured = Boolean(toText(process.env.STRAVA_CLIENT_ID)) && Boolean(toText(process.env.STRAVA_CLIENT_SECRET));
  const callbackUrlConfigured = Boolean(callbackUrl);
  const configured = clientConfigured && verifyTokenConfigured && callbackUrlConfigured;
  const warnings: PlatformStravaDiagnosticsRule[] = [];

  if (!verifyTokenConfigured) warnings.push(makeDiagnosticsRule('VERIFY_TOKEN_MISSING', 'warning', 'Thiếu verify token cho Strava webhook.'));
  if (!clientConfigured) warnings.push(makeDiagnosticsRule('STRAVA_CLIENT_NOT_CONFIGURED', 'warning', 'Thiếu cấu hình Strava client cho subscription check.'));
  if (!callbackUrlConfigured) warnings.push(makeDiagnosticsRule('CALLBACK_URL_MISSING', 'warning', 'Thiếu callback URL cho Strava webhook subscription.'));

  try {
    const subscriptions = clientConfigured
      ? await withTimeout(listWebhookSubscriptions(), STRAVA_DIAGNOSTICS_SUBSCRIPTION_TIMEOUT_MS, 'STRAVA_SUBSCRIPTION_TIMEOUT', 'Strava subscription check timed out.')
      : [];

    const subscriptionCount = subscriptions.length;
    const subscriptionExists = subscriptionCount > 0;
    const callbackMatches = Boolean(callbackUrl) && subscriptions.some((item) => item.callbackUrl === callbackUrl);

    if (!subscriptionExists) warnings.push(makeDiagnosticsRule('SUBSCRIPTION_MISSING', 'warning', 'Chưa có Strava webhook subscription.'));
    if (subscriptionCount > 1) warnings.push(makeDiagnosticsRule('MULTIPLE_SUBSCRIPTIONS', 'warning', 'Có nhiều Strava webhook subscription đang tồn tại.'));
    if (subscriptionExists && callbackUrl && !callbackMatches) warnings.push(makeDiagnosticsRule('SUBSCRIPTION_CALLBACK_MISMATCH', 'critical', 'Callback URL của Strava subscription không khớp cấu hình hiện tại.'));

    const status: PlatformStravaDiagnosticsHealthStatus = warnings.some((item) => item.severity === 'critical')
      ? 'critical'
      : warnings.length > 0
        ? 'warning'
        : 'healthy';

    return {
      status,
      configured,
      clientConfigured,
      verifyTokenConfigured,
      callbackUrlConfigured,
      subscriptionExists,
      subscriptionCount,
      callbackMatches,
      healthy: warnings.length === 0,
      lastCheckedAt: generatedAt,
      warnings,
      error: null,
    };
  } catch (error: any) {
    warnings.push(makeDiagnosticsRule('SUBSCRIPTION_CHECK_ERROR', 'warning', 'Không thể xác minh Strava subscription từ endpoint ngoài.'));

    return {
      status: configured ? 'warning' : 'unknown',
      configured,
      clientConfigured,
      verifyTokenConfigured,
      callbackUrlConfigured,
      subscriptionExists: false,
      subscriptionCount: 0,
      callbackMatches: false,
      healthy: null,
      lastCheckedAt: generatedAt,
      warnings,
      error: {
        code: toText(error?.code) || 'STRAVA_SUBSCRIPTION_CHECK_FAILED',
        message: summarizeDiagnosticsText(error?.message || 'Không thể kiểm tra Strava subscription.') || 'Không thể kiểm tra Strava subscription.',
      },
    };
  }
}

function buildDiagnosticsLinks(): Record<string, string> {
  return {
    failedSyncJobs: '/platform/integrations/strava?tab=sync-jobs&status=failed',
    runningSyncJobs: '/platform/integrations/strava?tab=sync-jobs&status=running',
    staleSyncJobs: '/platform/integrations/strava?tab=sync-jobs&status=running&stale=1',
    deadLetterWebhooks: '/platform/integrations/strava?tab=webhook-events&status=dead_letter',
    failedWebhooks: '/platform/integrations/strava?tab=webhook-events&status=failed',
    processingWebhooks: '/platform/integrations/strava?tab=webhook-events&status=processing',
    revokedConnections: '/platform/integrations/strava?tab=connections&status=DISCONNECTED',
    staleConnections: '/platform/integrations/strava?tab=connections&staleSync=1',
    subscription: '/platform/integrations/strava?tab=subscription',
  };
}

function buildDiagnosticsRunner(options: {
  configured: boolean;
  enabled: boolean;
  lastObservedActivityAt: string | null;
  activeItems: number;
  staleItems: number;
  staleMs: number;
  warnings?: PlatformStravaDiagnosticsRule[];
}): PlatformStravaDiagnosticsRunner {
  const warnings = Array.isArray(options.warnings) ? options.warnings : [];
  const lastObservedMs = Date.parse(String(options.lastObservedActivityAt || ''));
  const hasRecentActivity = Number.isFinite(lastObservedMs) && lastObservedMs >= (Date.now() - options.staleMs);
  let observedStatus: PlatformStravaRunnerObservedStatus = 'unknown_runtime_state';
  let alive: boolean | null = null;

  if (!options.enabled) {
    observedStatus = 'disabled';
    alive = false;
  } else if (options.activeItems > 0) {
    observedStatus = 'active';
    alive = true;
  } else if (hasRecentActivity) {
    observedStatus = 'recent_activity';
    alive = true;
  } else if (options.lastObservedActivityAt) {
    observedStatus = 'no_recent_activity';
  }

  return {
    configured: options.configured,
    enabled: options.enabled,
    alive,
    observedStatus,
    lastObservedActivityAt: options.lastObservedActivityAt,
    activeItems: options.activeItems,
    staleItems: options.staleItems,
    warnings,
  };
}

function getHealthStatusFromRules(rules: PlatformStravaDiagnosticsRule[]): PlatformStravaDiagnosticsHealthStatus {
  if (rules.some((item) => item.severity === 'critical')) return 'critical';
  if (rules.some((item) => item.severity === 'warning')) return 'warning';
  if (rules.some((item) => item.severity === 'info')) return 'healthy';
  return 'healthy';
}

export async function getPlatformStravaDiagnostics(query: PlatformStravaDiagnosticsQuery = {}): Promise<PlatformStravaDiagnostics> {
  const knex = strapi.db.connection;
  const nowMs = Date.now();
  const generatedAt = new Date(nowMs).toISOString();
  const window = normalizePlatformStravaDiagnosticsWindow(query.window);
  const tenantId = toPositiveInt(query.tenantId);
  const windowStart = getDiagnosticsWindowStart(window, nowMs);
  const webhookStaleMs = resolveDiagnosticsWebhookStaleMs();
  const webhookStaleBefore = new Date(nowMs - webhookStaleMs).toISOString();
  const syncStaleMs = resolveDiagnosticsSyncStaleMs();
  const syncStaleBefore = new Date(nowMs - syncStaleMs).toISOString();
  const staleConnectionBefore = getDiagnosticsConnectionStaleBefore(nowMs);
  const tokenExpiringSoonBefore = new Date(nowMs + (STRAVA_DIAGNOSTICS_TOKEN_EXPIRING_SOON_HOURS * 60 * 60 * 1000)).toISOString();

  const applyConnectionTenantFilter = (builder: any) => {
    if (tenantId) builder.where('sctl.tenant_id', tenantId);
  };
  const applySyncTenantFilter = (builder: any) => {
    if (tenantId) builder.where('sjtl.tenant_id', tenantId);
  };
  const applyWebhookTenantFilter = (builder: any) => {
    if (tenantId) {
      builder.where((inner: any) => {
        inner.where('swetl.tenant_id', tenantId).orWhere('sctl.tenant_id', tenantId);
      });
    }
  };

  const [
    connectionSummaryRow,
    webhookQueueRow,
    webhookStatsRow,
    syncQueueRow,
    syncStatsRow,
    staleWebhookCountRow,
    staleWebhookRows,
    staleSyncCountRow,
    staleSyncRows,
    webhookErrorRows,
    webhookFailureStatusRows,
    syncErrorCodeRows,
    syncErrorMessageRows,
    syncFailureCountsRow,
    connectionErrorSummaryRows,
    connectionRefreshFailureCountRow,
    subscription,
  ] = await Promise.all([
    knex('strava_connections as sc')
      .join('strava_connections_tenant_lnk as sctl', 'sctl.strava_connection_id', 'sc.id')
      .modify(applyConnectionTenantFilter)
      .select(knex.raw(`
        count(distinct sc.id) as total,
        count(distinct sc.id) filter (where sc.status = 'ACTIVE') as active,
        count(distinct sc.id) filter (where sc.status = 'DISCONNECTED') as disconnected,
        count(distinct sc.id) filter (where sc.status = 'ERROR') as error,
        count(distinct sc.id) filter (where sc.token_expires_at is not null and sc.token_expires_at <= ?::timestamptz) as token_expired,
        count(distinct sc.id) filter (where sc.token_expires_at is not null and sc.token_expires_at > ?::timestamptz and sc.token_expires_at <= ?::timestamptz) as token_expiring_soon,
        count(distinct sc.id) filter (where coalesce(sc.last_sync_status, 'NEVER') = 'NEVER') as never_synced,
        count(distinct sc.id) filter (where sc.status = 'ACTIVE' and coalesce(sc.last_sync_status, 'NEVER') <> 'NEVER' and (sc.last_sync_at is null or sc.last_sync_at <= ?::timestamptz)) as stale_sync,
        count(distinct sc.id) filter (where sc.last_sync_status = 'FAILED' and coalesce(sc.last_sync_at, sc.updated_at, sc.created_at) >= ?::timestamptz) as with_recent_failure,
        count(distinct sc.id) filter (where sc.status = 'DISCONNECTED' or sc.last_sync_error ilike '%reconnect%' or sc.last_sync_error ilike '%revoked%' or sc.last_sync_error ilike '%refresh token%') as reconnect_recommended
      `, [generatedAt, generatedAt, tokenExpiringSoonBefore, staleConnectionBefore, windowStart]))
      .first(),
    knex('strava_webhook_events as swe')
      .leftJoin('strava_webhook_events_tenant_lnk as swetl', 'swetl.strava_webhook_event_id', 'swe.id')
      .leftJoin('strava_webhook_events_connection_lnk as swecl', 'swecl.strava_webhook_event_id', 'swe.id')
      .leftJoin('strava_connections_tenant_lnk as sctl', 'sctl.strava_connection_id', 'swecl.strava_connection_id')
      .modify(applyWebhookTenantFilter)
      .select(knex.raw(`
        count(distinct swe.id) filter (where swe.status = 'pending') as pending,
        count(distinct swe.id) filter (where swe.status = 'processing') as processing,
        count(distinct swe.id) filter (where swe.status = 'failed') as failed,
        count(distinct swe.id) filter (where swe.status = 'ignored') as ignored,
        count(distinct swe.id) filter (where swe.status = 'processed') as processed,
        count(distinct swe.id) filter (where swe.status = 'dead_letter') as dead_letter,
        count(distinct swe.id) filter (where swe.status = 'failed' and swe.next_attempt_at is not null and swe.next_attempt_at > ?::timestamptz) as retry_waiting,
        count(distinct swe.id) filter (where swe.status = 'processing' and swe.claimed_at is not null and swe.claimed_at <= ?::timestamptz) as stale_processing,
        min(case when swe.status = 'pending' then swe.created_at end) as oldest_pending_at,
        min(case when swe.status = 'failed' and swe.next_attempt_at is not null and swe.next_attempt_at > ?::timestamptz then swe.next_attempt_at end) as oldest_retry_at,
        max(swe.created_at) as latest_received_at,
        max(swe.processed_at) as latest_processed_at,
        count(distinct swe.id) filter (where swe.status = 'processed' and swe.processed_at is not null and swe.processed_at >= ?::timestamptz) as processed_last_window,
        count(distinct swe.id) filter (where swe.status = 'failed' and coalesce(swe.next_attempt_at, swe.updated_at, swe.created_at) >= ?::timestamptz) as failed_last_window,
        count(distinct swe.id) filter (where swe.status = 'dead_letter' and swe.processed_at is not null and swe.processed_at >= ?::timestamptz) as dead_letter_last_window
      `, [generatedAt, webhookStaleBefore, generatedAt, windowStart, windowStart, windowStart]))
      .first(),
    knex('strava_webhook_events as swe')
      .leftJoin('strava_webhook_events_tenant_lnk as swetl', 'swetl.strava_webhook_event_id', 'swe.id')
      .leftJoin('strava_webhook_events_connection_lnk as swecl', 'swecl.strava_webhook_event_id', 'swe.id')
      .leftJoin('strava_connections_tenant_lnk as sctl', 'sctl.strava_connection_id', 'swecl.strava_connection_id')
      .modify(applyWebhookTenantFilter)
      .where('swe.created_at', '>=', windowStart)
      .select(knex.raw(`
        count(distinct swe.id) as total,
        count(distinct swe.id) filter (where swe.aspect_type = 'create') as create_count,
        count(distinct swe.id) filter (where swe.aspect_type = 'update') as update_count,
        count(distinct swe.id) filter (where swe.aspect_type = 'delete') as delete_count,
        count(distinct swe.id) filter (where swe.status = 'processed') as processed,
        count(distinct swe.id) filter (where swe.status = 'ignored') as ignored,
        count(distinct swe.id) filter (where swe.status = 'failed') as failed,
        count(distinct swe.id) filter (where swe.status = 'dead_letter') as dead_letter,
        avg(extract(epoch from (swe.processed_at - swe.created_at))) filter (where swe.processed_at is not null and swe.processed_at >= swe.created_at) as avg_processing_seconds,
        max(extract(epoch from (swe.processed_at - swe.created_at))) filter (where swe.processed_at is not null and swe.processed_at >= swe.created_at) as max_processing_seconds,
        max(swe.created_at) as latest_event_at
      `))
      .first(),
    knex('strava_sync_jobs as sj')
      .join('strava_sync_jobs_tenant_lnk as sjtl', 'sjtl.strava_sync_job_id', 'sj.id')
      .modify(applySyncTenantFilter)
      .select(knex.raw(`
        count(distinct sj.id) filter (where sj.status = 'queued') as queued,
        count(distinct sj.id) filter (where sj.status = 'running') as running,
        count(distinct sj.id) filter (where sj.status = 'partial_ready') as partial_ready,
        count(distinct sj.id) filter (where sj.status = 'completed') as completed,
        count(distinct sj.id) filter (where sj.status = 'failed') as failed,
        count(distinct sj.id) filter (where sj.status = 'cancelled') as cancelled,
        count(distinct sj.id) filter (where sj.status in ('queued', 'partial_ready') and sj.next_retry_at is not null and sj.next_retry_at > ?::timestamptz) as retry_waiting,
        count(distinct sj.id) filter (where sj.status = 'running' and coalesce(sj.heartbeat_at, sj.claimed_at, sj.started_at, sj.requested_at) <= ?::timestamptz) as stale_running,
        min(case when sj.status = 'queued' then coalesce(sj.requested_at, sj.created_at) end) as oldest_queued_at,
        min(case when sj.status = 'running' then coalesce(sj.heartbeat_at, sj.claimed_at, sj.started_at, sj.requested_at) end) as oldest_running_at,
        max(coalesce(sj.requested_at, sj.created_at)) as latest_requested_at,
        max(sj.completed_at) filter (where sj.status = 'completed') as latest_completed_at
      `, [generatedAt, syncStaleBefore]))
      .first(),
    knex('strava_sync_jobs as sj')
      .join('strava_sync_jobs_tenant_lnk as sjtl', 'sjtl.strava_sync_job_id', 'sj.id')
      .modify(applySyncTenantFilter)
      .whereRaw(`coalesce(sj.requested_at, sj.created_at) >= ?::timestamptz`, [windowStart])
      .select(knex.raw(`
        count(distinct sj.id) as requested,
        count(distinct sj.id) filter (where sj.status = 'completed') as completed,
        count(distinct sj.id) filter (where sj.status = 'partial_ready') as partial_ready,
        count(distinct sj.id) filter (where sj.status = 'failed') as failed,
        count(distinct sj.id) filter (where sj.status = 'cancelled') as cancelled,
        avg(extract(epoch from (coalesce(sj.completed_at, sj.failed_at) - sj.started_at))) filter (where sj.started_at is not null and ((sj.status = 'completed' and sj.completed_at is not null and sj.completed_at >= sj.started_at) or (sj.status = 'failed' and sj.failed_at is not null and sj.failed_at >= sj.started_at))) as avg_duration_seconds,
        max(extract(epoch from (coalesce(sj.completed_at, sj.failed_at) - sj.started_at))) filter (where sj.started_at is not null and ((sj.status = 'completed' and sj.completed_at is not null and sj.completed_at >= sj.started_at) or (sj.status = 'failed' and sj.failed_at is not null and sj.failed_at >= sj.started_at))) as max_duration_seconds,
        sum(coalesce(sj.processed_activities, 0)) as processed_activities,
        sum(coalesce(sj.created_activities, 0)) as created_activities,
        sum(coalesce(sj.updated_activities, 0)) as updated_activities,
        sum(coalesce(sj.skipped_activities, 0)) as skipped_activities,
        sum(coalesce(sj.failed_activities, 0)) as failed_activities,
        max(sj.completed_at) filter (where sj.status = 'completed') as latest_completed_at
      `))
      .first(),
    knex('strava_webhook_events as swe')
      .leftJoin('strava_webhook_events_tenant_lnk as swetl', 'swetl.strava_webhook_event_id', 'swe.id')
      .leftJoin('strava_webhook_events_connection_lnk as swecl', 'swecl.strava_webhook_event_id', 'swe.id')
      .leftJoin('strava_connections_tenant_lnk as sctl', 'sctl.strava_connection_id', 'swecl.strava_connection_id')
      .modify(applyWebhookTenantFilter)
      .where('swe.status', 'processing')
      .whereRaw(`swe.claimed_at <= ?::timestamptz`, [webhookStaleBefore])
      .countDistinct({ total: 'swe.id' })
      .first(),
    knex('strava_webhook_events as swe')
      .leftJoin('strava_webhook_events_tenant_lnk as swetl', 'swetl.strava_webhook_event_id', 'swe.id')
      .leftJoin('tenants as t', 't.id', 'swetl.tenant_id')
      .leftJoin('strava_webhook_events_connection_lnk as swecl', 'swecl.strava_webhook_event_id', 'swe.id')
      .leftJoin('strava_connections as sc', 'sc.id', 'swecl.strava_connection_id')
      .leftJoin('strava_connections_tenant_lnk as sctl', 'sctl.strava_connection_id', 'sc.id')
      .modify(applyWebhookTenantFilter)
      .where('swe.status', 'processing')
      .whereRaw(`swe.claimed_at <= ?::timestamptz`, [webhookStaleBefore])
      .select([
        'swe.id as id',
        'swe.status as status',
        'swe.object_type as objectType',
        'swe.aspect_type as aspectType',
        'swe.claimed_at as claimedAt',
        'swe.claimed_by as claimedBy',
        't.id as tenantId',
        't.name as tenantName',
        'sc.id as connectionId',
        'sc.strava_athlete_id as connectionAthleteId',
        'sc.athlete_username as connectionAthleteUsername',
        'sc.athlete_firstname as connectionAthleteFirstname',
        'sc.athlete_lastname as connectionAthleteLastname',
        'sc.status as connectionStatus',
        knex.raw(`extract(epoch from (?::timestamptz - swe.claimed_at)) as age_seconds`, [generatedAt]),
      ])
      .orderBy('swe.claimed_at', 'asc')
      .limit(STRAVA_DIAGNOSTICS_STALE_SAMPLE_LIMIT),
    knex('strava_sync_jobs as sj')
      .join('strava_sync_jobs_tenant_lnk as sjtl', 'sjtl.strava_sync_job_id', 'sj.id')
      .modify(applySyncTenantFilter)
      .where('sj.status', 'running')
      .whereRaw(`coalesce(sj.heartbeat_at, sj.claimed_at, sj.started_at, sj.requested_at) <= ?::timestamptz`, [syncStaleBefore])
      .countDistinct({ total: 'sj.id' })
      .first(),
    knex('strava_sync_jobs as sj')
      .join('strava_sync_jobs_tenant_lnk as sjtl', 'sjtl.strava_sync_job_id', 'sj.id')
      .leftJoin('tenants as t', 't.id', 'sjtl.tenant_id')
      .leftJoin('strava_sync_jobs_connection_lnk as sjcl', 'sjcl.strava_sync_job_id', 'sj.id')
      .leftJoin('strava_connections as sc', 'sc.id', 'sjcl.strava_connection_id')
      .modify(applySyncTenantFilter)
      .where('sj.status', 'running')
      .whereRaw(`coalesce(sj.heartbeat_at, sj.claimed_at, sj.started_at, sj.requested_at) <= ?::timestamptz`, [syncStaleBefore])
      .select([
        'sj.id as id',
        'sj.status as status',
        'sj.phase as phase',
        'sj.claimed_at as claimedAt',
        'sj.heartbeat_at as heartbeatAt',
        'sj.claimed_by as claimedBy',
        't.id as tenantId',
        't.name as tenantName',
        'sc.id as connectionId',
        'sc.strava_athlete_id as connectionAthleteId',
        'sc.athlete_username as connectionAthleteUsername',
        'sc.athlete_firstname as connectionAthleteFirstname',
        'sc.athlete_lastname as connectionAthleteLastname',
        'sc.status as connectionStatus',
        knex.raw(`extract(epoch from (?::timestamptz - coalesce(sj.heartbeat_at, sj.claimed_at, sj.started_at, sj.requested_at))) as age_seconds`, [generatedAt]),
      ])
      .orderByRaw(`coalesce(sj.heartbeat_at, sj.claimed_at, sj.started_at, sj.requested_at) asc`)
      .limit(STRAVA_DIAGNOSTICS_STALE_SAMPLE_LIMIT),
    knex('strava_webhook_events as swe')
      .leftJoin('strava_webhook_events_tenant_lnk as swetl', 'swetl.strava_webhook_event_id', 'swe.id')
      .leftJoin('strava_webhook_events_connection_lnk as swecl', 'swecl.strava_webhook_event_id', 'swe.id')
      .leftJoin('strava_connections_tenant_lnk as sctl', 'sctl.strava_connection_id', 'swecl.strava_connection_id')
      .modify(applyWebhookTenantFilter)
      .where('swe.created_at', '>=', windowStart)
      .whereIn('swe.status', ['failed', 'dead_letter'])
      .whereNotNull('swe.last_error')
      .select('swe.last_error as lastError')
      .countDistinct({ count: 'swe.id' })
      .groupBy('swe.last_error')
      .orderBy('count', 'desc')
      .limit(STRAVA_DIAGNOSTICS_ERROR_LIMIT),
    knex('strava_webhook_events as swe')
      .leftJoin('strava_webhook_events_tenant_lnk as swetl', 'swetl.strava_webhook_event_id', 'swe.id')
      .leftJoin('strava_webhook_events_connection_lnk as swecl', 'swecl.strava_webhook_event_id', 'swe.id')
      .leftJoin('strava_connections_tenant_lnk as sctl', 'sctl.strava_connection_id', 'swecl.strava_connection_id')
      .modify(applyWebhookTenantFilter)
      .where('swe.created_at', '>=', windowStart)
      .whereIn('swe.status', ['failed', 'dead_letter', 'ignored'])
      .select('swe.status as status')
      .countDistinct({ count: 'swe.id' })
      .groupBy('swe.status')
      .orderBy('count', 'desc')
      .limit(STRAVA_DIAGNOSTICS_ERROR_LIMIT),
    knex('strava_sync_jobs as sj')
      .join('strava_sync_jobs_tenant_lnk as sjtl', 'sjtl.strava_sync_job_id', 'sj.id')
      .modify(applySyncTenantFilter)
      .whereRaw(`coalesce(sj.requested_at, sj.created_at) >= ?::timestamptz`, [windowStart])
      .whereNotNull('sj.last_error_code')
      .select('sj.last_error_code as code')
      .countDistinct({ count: 'sj.id' })
      .groupBy('sj.last_error_code')
      .orderBy('count', 'desc')
      .limit(STRAVA_DIAGNOSTICS_ERROR_LIMIT),
    knex('strava_sync_jobs as sj')
      .join('strava_sync_jobs_tenant_lnk as sjtl', 'sjtl.strava_sync_job_id', 'sj.id')
      .modify(applySyncTenantFilter)
      .whereRaw(`coalesce(sj.requested_at, sj.created_at) >= ?::timestamptz`, [windowStart])
      .whereNotNull('sj.last_error_message')
      .select('sj.last_error_message as message')
      .countDistinct({ count: 'sj.id' })
      .groupBy('sj.last_error_message')
      .orderBy('count', 'desc')
      .limit(STRAVA_DIAGNOSTICS_ERROR_LIMIT),
    knex('strava_sync_jobs as sj')
      .join('strava_sync_jobs_tenant_lnk as sjtl', 'sjtl.strava_sync_job_id', 'sj.id')
      .modify(applySyncTenantFilter)
      .whereRaw(`coalesce(sj.requested_at, sj.created_at) >= ?::timestamptz`, [windowStart])
      .select(knex.raw(`
        count(distinct sj.id) filter (where sj.status = 'failed') as failed_count,
        count(distinct sj.id) filter (where sj.status in ('queued', 'partial_ready') and sj.next_retry_at is not null and sj.next_retry_at > ?::timestamptz) as retry_waiting_count
      `, [generatedAt]))
      .first(),
    knex('strava_connections as sc')
      .join('strava_connections_tenant_lnk as sctl', 'sctl.strava_connection_id', 'sc.id')
      .modify(applyConnectionTenantFilter)
      .whereNotNull('sc.last_sync_error')
      .select('sc.last_sync_error as error')
      .countDistinct({ count: 'sc.id' })
      .groupBy('sc.last_sync_error')
      .orderBy('count', 'desc')
      .limit(STRAVA_DIAGNOSTICS_ERROR_LIMIT),
    knex('strava_connections as sc')
      .join('strava_connections_tenant_lnk as sctl', 'sctl.strava_connection_id', 'sc.id')
      .modify(applyConnectionTenantFilter)
      .where((builder: any) => {
        builder.whereILike('sc.last_sync_error', '%refresh token%').orWhereILike('sc.last_sync_error', '%reconnect%');
      })
      .countDistinct({ total: 'sc.id' })
      .first(),
    getPlatformStravaSubscriptionDiagnostics(generatedAt),
  ]);

  const connections = {
    total: Number((connectionSummaryRow as any)?.total || 0),
    active: Number((connectionSummaryRow as any)?.active || 0),
    disconnected: Number((connectionSummaryRow as any)?.disconnected || 0),
    revokedOrDisconnected: Number((connectionSummaryRow as any)?.disconnected || 0),
    error: Number((connectionSummaryRow as any)?.error || 0),
    tokenExpired: Number((connectionSummaryRow as any)?.token_expired || 0),
    tokenExpiringSoon: Number((connectionSummaryRow as any)?.token_expiring_soon || 0),
    neverSynced: Number((connectionSummaryRow as any)?.never_synced || 0),
    staleSync: Number((connectionSummaryRow as any)?.stale_sync || 0),
    withRecentFailure: Number((connectionSummaryRow as any)?.with_recent_failure || 0),
    reconnectRecommended: Number((connectionSummaryRow as any)?.reconnect_recommended || 0),
  };

  const webhookQueue = {
    pending: Number((webhookQueueRow as any)?.pending || 0),
    processing: Number((webhookQueueRow as any)?.processing || 0),
    failed: Number((webhookQueueRow as any)?.failed || 0),
    ignored: Number((webhookQueueRow as any)?.ignored || 0),
    processed: Number((webhookQueueRow as any)?.processed || 0),
    deadLetter: Number((webhookQueueRow as any)?.dead_letter || 0),
    retryWaiting: Number((webhookQueueRow as any)?.retry_waiting || 0),
    staleProcessing: Number((webhookQueueRow as any)?.stale_processing || 0),
    oldestPendingAt: (webhookQueueRow as any)?.oldest_pending_at || null,
    oldestRetryAt: (webhookQueueRow as any)?.oldest_retry_at || null,
    latestReceivedAt: (webhookQueueRow as any)?.latest_received_at || null,
    latestProcessedAt: (webhookQueueRow as any)?.latest_processed_at || null,
    processedLastWindow: Number((webhookQueueRow as any)?.processed_last_window || 0),
    failedLastWindow: Number((webhookQueueRow as any)?.failed_last_window || 0),
    deadLetterLastWindow: Number((webhookQueueRow as any)?.dead_letter_last_window || 0),
  };

  const webhookStats = {
    total: Number((webhookStatsRow as any)?.total || 0),
    create: Number((webhookStatsRow as any)?.create_count || 0),
    update: Number((webhookStatsRow as any)?.update_count || 0),
    delete: Number((webhookStatsRow as any)?.delete_count || 0),
    processed: Number((webhookStatsRow as any)?.processed || 0),
    ignored: Number((webhookStatsRow as any)?.ignored || 0),
    failed: Number((webhookStatsRow as any)?.failed || 0),
    deadLetter: Number((webhookStatsRow as any)?.dead_letter || 0),
    averageProcessingDurationSeconds: (webhookStatsRow as any)?.avg_processing_seconds !== null ? Number((webhookStatsRow as any)?.avg_processing_seconds || 0) : null,
    maxProcessingDurationSeconds: (webhookStatsRow as any)?.max_processing_seconds !== null ? Number((webhookStatsRow as any)?.max_processing_seconds || 0) : null,
    latestEventAt: (webhookStatsRow as any)?.latest_event_at || null,
  };

  const syncQueue = {
    queued: Number((syncQueueRow as any)?.queued || 0),
    running: Number((syncQueueRow as any)?.running || 0),
    partialReady: Number((syncQueueRow as any)?.partial_ready || 0),
    completed: Number((syncQueueRow as any)?.completed || 0),
    failed: Number((syncQueueRow as any)?.failed || 0),
    cancelled: Number((syncQueueRow as any)?.cancelled || 0),
    retryWaiting: Number((syncQueueRow as any)?.retry_waiting || 0),
    staleRunning: Number((syncQueueRow as any)?.stale_running || 0),
    oldestQueuedAt: (syncQueueRow as any)?.oldest_queued_at || null,
    oldestRunningAt: (syncQueueRow as any)?.oldest_running_at || null,
    latestRequestedAt: (syncQueueRow as any)?.latest_requested_at || null,
    latestCompletedAt: (syncQueueRow as any)?.latest_completed_at || null,
  };

  const syncStats = {
    requested: Number((syncStatsRow as any)?.requested || 0),
    completed: Number((syncStatsRow as any)?.completed || 0),
    partialReady: Number((syncStatsRow as any)?.partial_ready || 0),
    failed: Number((syncStatsRow as any)?.failed || 0),
    cancelled: Number((syncStatsRow as any)?.cancelled || 0),
    averageDurationSeconds: (syncStatsRow as any)?.avg_duration_seconds !== null ? Number((syncStatsRow as any)?.avg_duration_seconds || 0) : null,
    maxDurationSeconds: (syncStatsRow as any)?.max_duration_seconds !== null ? Number((syncStatsRow as any)?.max_duration_seconds || 0) : null,
    processedActivities: Number((syncStatsRow as any)?.processed_activities || 0),
    createdActivities: Number((syncStatsRow as any)?.created_activities || 0),
    updatedActivities: Number((syncStatsRow as any)?.updated_activities || 0),
    skippedActivities: Number((syncStatsRow as any)?.skipped_activities || 0),
    failedActivities: Number((syncStatsRow as any)?.failed_activities || 0),
    latestCompletedAt: (syncStatsRow as any)?.latest_completed_at || null,
  };

  let staleWebhookItems = (staleWebhookRows || []).map((row: any) => ({
    id: Number(row?.id || 0),
    status: toText(row?.status) || 'processing',
    objectType: toText(row?.objectType) || 'unknown',
    aspectType: toText(row?.aspectType) || 'unknown',
    claimedAt: row?.claimedAt || null,
    claimedBy: summarizeDiagnosticsText(row?.claimedBy, 120),
    tenant: row?.tenantId ? { id: Number(row.tenantId), name: toText(row?.tenantName) || `Tenant ${String(row.tenantId)}` } : null,
    connection: row?.connectionId ? {
      id: Number(row.connectionId),
      athleteId: toText(row?.connectionAthleteId) || '-',
      athleteName: buildPlatformStravaAthleteName({ athleteFirstname: row?.connectionAthleteFirstname, athleteLastname: row?.connectionAthleteLastname, athleteUsername: row?.connectionAthleteUsername, athleteId: row?.connectionAthleteId }),
      status: normalizePlatformStravaConnectionStatus(row?.connectionStatus) || 'ERROR',
    } : null,
    ageSeconds: row?.age_seconds !== null && row?.age_seconds !== undefined ? Math.max(0, Math.round(Number(row.age_seconds || 0))) : null,
    detailUrl: `/platform/integrations/strava/webhook-events/${String(row?.id || '')}`,
  }));

  if (staleWebhookItems.length === 0 && webhookQueue.staleProcessing > 0) {
    const fallbackWebhookIds = await knex('strava_webhook_events as swe')
      .leftJoin('strava_webhook_events_tenant_lnk as swetl', 'swetl.strava_webhook_event_id', 'swe.id')
      .leftJoin('strava_webhook_events_connection_lnk as swecl', 'swecl.strava_webhook_event_id', 'swe.id')
      .modify((builder: any) => {
        if (!tenantId) return;
        builder.where((inner: any) => {
          inner
            .whereExists(function existsEventTenant(this: any) {
              this.select(knex.raw('1'))
                .from({ evtl: 'strava_webhook_events_tenant_lnk' })
                .whereRaw('evtl.strava_webhook_event_id = swe.id')
                .andWhere('evtl.tenant_id', tenantId);
            })
            .orWhereExists(function existsConnectionTenant(this: any) {
              this.select(knex.raw('1'))
                .from({ evcl: 'strava_webhook_events_connection_lnk' })
                .join({ ctl: 'strava_connections_tenant_lnk' }, 'ctl.strava_connection_id', 'evcl.strava_connection_id')
                .whereRaw('evcl.strava_webhook_event_id = swe.id')
                .andWhere('ctl.tenant_id', tenantId);
            });
        });
      })
      .where('swe.status', 'processing')
      .whereRaw(`swe.claimed_at <= ?::timestamptz`, [webhookStaleBefore])
      .select('swe.id as id')
      .orderBy('swe.claimed_at', 'asc')
      .limit(STRAVA_DIAGNOSTICS_STALE_SAMPLE_LIMIT);

    const fallbackDetails = await Promise.all(
      (fallbackWebhookIds || []).map((row: any) => getPlatformStravaWebhookEventDetail(row?.id)),
    );

    staleWebhookItems = fallbackDetails.map((detail) => {
      const claimedAtMs = Date.parse(String(detail?.claimedAt || ''));
      return {
        id: Number(detail?.eventId || 0),
        status: toText(detail?.status) || 'processing',
        objectType: toText(detail?.objectType) || 'unknown',
        aspectType: toText(detail?.aspectType) || 'unknown',
        claimedAt: detail?.claimedAt || null,
        claimedBy: summarizeDiagnosticsText(detail?.claimedBy, 120),
        tenant: detail?.tenant || null,
        connection: detail?.connection || null,
        ageSeconds: Number.isFinite(claimedAtMs) ? Math.max(0, Math.round((Date.parse(generatedAt) - claimedAtMs) / 1000)) : null,
        detailUrl: `/platform/integrations/strava/webhook-events/${String(detail?.eventId || '')}`,
      };
    });
  }

  const staleSyncItems = (staleSyncRows || []).map((row: any) => ({
    id: Number(row?.id || 0),
    status: toText(row?.status) || 'running',
    phase: toText(row?.phase) || null,
    claimedAt: row?.claimedAt || null,
    heartbeatAt: row?.heartbeatAt || null,
    claimedBy: summarizeDiagnosticsText(row?.claimedBy, 120),
    tenant: row?.tenantId ? { id: Number(row.tenantId), name: toText(row?.tenantName) || `Tenant ${String(row.tenantId)}` } : null,
    connection: row?.connectionId ? {
      id: Number(row.connectionId),
      athleteId: toText(row?.connectionAthleteId) || '-',
      athleteName: buildPlatformStravaAthleteName({ athleteFirstname: row?.connectionAthleteFirstname, athleteLastname: row?.connectionAthleteLastname, athleteUsername: row?.connectionAthleteUsername, athleteId: row?.connectionAthleteId }),
      status: normalizePlatformStravaConnectionStatus(row?.connectionStatus) || 'ERROR',
    } : null,
    ageSeconds: row?.age_seconds !== null && row?.age_seconds !== undefined ? Math.max(0, Math.round(Number(row.age_seconds || 0))) : null,
    detailUrl: `/platform/integrations/strava/sync-jobs/${String(row?.id || '')}`,
  }));

  const errors = {
    webhook: {
      topLastErrorSummaries: (webhookErrorRows || []).map((row: any) => ({
        summary: summarizePlatformStravaWebhookError(row?.lastError) || 'Unknown webhook error',
        count: Number(row?.count || 0),
      })),
      topStatusFailureCounts: (webhookFailureStatusRows || []).map((row: any) => ({
        status: toText(row?.status) || 'unknown',
        count: Number(row?.count || 0),
      })),
      deadLetterCount: webhookQueue.deadLetter,
    },
    syncJobs: {
      topErrorCodes: (syncErrorCodeRows || []).map((row: any) => ({
        code: toText(row?.code) || 'UNKNOWN',
        count: Number(row?.count || 0),
      })),
      topLastErrorSummaries: (syncErrorMessageRows || []).map((row: any) => ({
        summary: summarizeDiagnosticsText(row?.message) || 'Unknown sync error',
        count: Number(row?.count || 0),
      })),
      failedCount: Number((syncFailureCountsRow as any)?.failed_count || 0),
      retryWaitingCount: Number((syncFailureCountsRow as any)?.retry_waiting_count || 0),
    },
    connections: {
      topFailureReasons: (connectionErrorSummaryRows || []).map((row: any) => ({
        summary: summarizeDiagnosticsText(row?.error) || 'Unknown connection issue',
        count: Number(row?.count || 0),
      })),
      refreshTokenFailureCount: Number((connectionRefreshFailureCountRow as any)?.total || 0),
    },
  };

  const warnings: PlatformStravaDiagnosticsRule[] = [
    ...subscription.warnings,
  ];

  if (!toBoolean(process.env.STRAVA_WEBHOOK_RUNNER_ENABLED, false)) {
    warnings.push(makeDiagnosticsRule('WEBHOOK_RUNNER_DISABLED', 'warning', 'Webhook runner hiện đang tắt theo cấu hình môi trường.'));
  }
  if (!toBoolean(process.env.STRAVA_SYNC_RUNNER_ENABLED, false)) {
    warnings.push(makeDiagnosticsRule('SYNC_RUNNER_DISABLED', 'warning', 'Sync runner hiện đang tắt theo cấu hình môi trường.'));
  }
  if (webhookQueue.staleProcessing > 0) {
    warnings.push(makeDiagnosticsRule('WEBHOOK_STALE_PROCESSING', 'critical', 'Có webhook event đang processing quá thời hạn stale.'));
  }
  if (syncQueue.staleRunning > 0) {
    warnings.push(makeDiagnosticsRule('SYNC_STALE_RUNNING', 'critical', 'Có sync job đang running quá thời hạn stale.'));
  }
  if (webhookQueue.deadLetter > 0) {
    warnings.push(makeDiagnosticsRule('WEBHOOK_DEAD_LETTER_PRESENT', 'warning', 'Có webhook event đang ở dead letter.'));
  }
  if (errors.syncJobs.failedCount > 0) {
    warnings.push(makeDiagnosticsRule('SYNC_FAILED_PRESENT', 'warning', 'Có sync job failed trong cửa sổ đã chọn.'));
  }
  if (connections.revokedOrDisconnected > 0) {
    warnings.push(makeDiagnosticsRule('CONNECTION_REVOKED_PRESENT', 'warning', 'Có Strava connection đã disconnected hoặc bị thu hồi quyền.'));
  }
  if (connections.staleSync > 0) {
    warnings.push(makeDiagnosticsRule('CONNECTION_SYNC_STALE', 'warning', 'Có Strava connection không sync trong thời gian stale đã khai báo.'));
  }
  if (errors.connections.refreshTokenFailureCount > 0) {
    warnings.push(makeDiagnosticsRule('TOKEN_REFRESH_FAILURE_PRESENT', 'warning', 'Có Strava connection gặp lỗi refresh token hoặc cần reconnect.'));
  }
  if (connections.active > 0 && subscription.subscriptionExists && subscription.callbackMatches && !webhookQueue.latestReceivedAt) {
    warnings.push(makeDiagnosticsRule('NO_RECENT_WEBHOOK_ACTIVITY', 'info', 'Không có webhook activity gần đây trong hệ thống hiện tại.'));
  }

  const runners = {
    webhookRunner: buildDiagnosticsRunner({
      configured: true,
      enabled: toBoolean(process.env.STRAVA_WEBHOOK_RUNNER_ENABLED, false),
      lastObservedActivityAt: webhookQueue.latestProcessedAt || webhookQueue.latestReceivedAt,
      activeItems: webhookQueue.processing,
      staleItems: webhookQueue.staleProcessing,
      staleMs: webhookStaleMs,
      warnings: warnings.filter((item) => ['WEBHOOK_RUNNER_DISABLED', 'WEBHOOK_STALE_PROCESSING', 'WEBHOOK_DEAD_LETTER_PRESENT', 'NO_RECENT_WEBHOOK_ACTIVITY'].includes(item.code)),
    }),
    webhookHandler: buildDiagnosticsRunner({
      configured: true,
      enabled: toBoolean(process.env.STRAVA_WEBHOOK_HANDLER_ENABLED, false),
      lastObservedActivityAt: webhookQueue.latestProcessedAt,
      activeItems: 0,
      staleItems: webhookQueue.staleProcessing,
      staleMs: webhookStaleMs,
      warnings: warnings.filter((item) => ['WEBHOOK_RUNNER_DISABLED', 'NO_RECENT_WEBHOOK_ACTIVITY'].includes(item.code)),
    }),
    syncRunner: buildDiagnosticsRunner({
      configured: true,
      enabled: toBoolean(process.env.STRAVA_SYNC_RUNNER_ENABLED, false),
      lastObservedActivityAt: syncQueue.latestCompletedAt || syncQueue.latestRequestedAt,
      activeItems: syncQueue.running + syncQueue.partialReady,
      staleItems: syncQueue.staleRunning,
      staleMs: syncStaleMs,
      warnings: warnings.filter((item) => ['SYNC_RUNNER_DISABLED', 'SYNC_STALE_RUNNING', 'SYNC_FAILED_PRESENT'].includes(item.code)),
    }),
    subscriptionCheckOnBoot: buildDiagnosticsRunner({
      configured: true,
      enabled: shouldCheckStravaWebhookOnBoot(),
      lastObservedActivityAt: null,
      activeItems: 0,
      staleItems: 0,
      staleMs: webhookStaleMs,
      warnings: subscription.warnings,
    }),
  };

  return {
    generatedAt,
    window,
    tenantId,
    health: {
      status: getHealthStatusFromRules(warnings),
      score: null,
      reasons: warnings.filter((item) => item.severity !== 'info'),
    },
    thresholds: {
      tokenExpiringSoonHours: STRAVA_DIAGNOSTICS_TOKEN_EXPIRING_SOON_HOURS,
      staleConnectionDays: STRAVA_DIAGNOSTICS_CONNECTION_STALE_DAYS,
      webhookStaleMinutes: Math.round(webhookStaleMs / 60000),
      syncStaleMinutes: Math.round(syncStaleMs / 60000),
    },
    runners,
    subscription,
    connections,
    webhookQueue,
    webhookStats,
    syncQueue,
    syncStats,
    staleItems: {
      webhookEvents: {
        count: Math.max(webhookQueue.staleProcessing, Number((staleWebhookCountRow as any)?.total || 0)),
        items: staleWebhookItems,
      },
      syncJobs: {
        count: Number((staleSyncCountRow as any)?.total || 0),
        items: staleSyncItems,
      },
    },
    errors,
    warnings,
    links: buildDiagnosticsLinks(),
  };
}

export async function createPlatformStravaSubscription(): Promise<PlatformStravaSubscriptionOverview & { existed: boolean }> {
  const result = await createWebhookSubscription();
  const overview = await getPlatformStravaSubscriptionOverview();
  return {
    ...overview,
    existed: result.existed,
  };
}

export async function deletePlatformStravaSubscription(): Promise<PlatformStravaSubscriptionOverview & { deleted: boolean; deletedSubscriptionId: number | null }> {
  const current = await getWebhookSubscription();
  if (!current?.subscriptionId) {
    const overview = await getPlatformStravaSubscriptionOverview();
    return {
      ...overview,
      deleted: false,
      deletedSubscriptionId: null,
    };
  }

  const result = await deleteWebhookSubscription(current.subscriptionId);
  const overview = await getPlatformStravaSubscriptionOverview();
  return {
    ...overview,
    deleted: result.deleted,
    deletedSubscriptionId: current.subscriptionId,
  };
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

function resolveStravaOAuthStateRetentionMs(): number {
  const configuredHours = Math.max(1, toPositiveInt(process.env.STRAVA_OAUTH_STATE_RETENTION_HOURS) || DEFAULT_STRAVA_OAUTH_STATE_RETENTION_HOURS);
  return configuredHours * 60 * 60 * 1000;
}

export async function cleanupStaleStravaOAuthStates(now = new Date()): Promise<number> {
  const retentionCutoffIso = new Date(now.getTime() - resolveStravaOAuthStateRetentionMs()).toISOString();

  const deletedCount = await strapi.db.connection('strava_oauth_states')
    .where((builder: any) => {
      builder
        .where((usedBuilder: any) => {
          usedBuilder.whereNotNull('used_at').andWhere('used_at', '<=', retentionCutoffIso);
        })
        .orWhere((expiredBuilder: any) => {
          expiredBuilder.whereNotNull('expires_at').andWhere('expires_at', '<=', retentionCutoffIso);
        });
    })
    .del();

  return Number(deletedCount || 0) || 0;
}

async function cleanupStaleStravaOAuthStatesBestEffort(context: 'create' | 'verify'): Promise<void> {
  try {
    await cleanupStaleStravaOAuthStates();
  } catch (error) {
    strapi.log.warn(`[strava.oauth-state] cleanup failed during ${context}: ${error instanceof Error ? error.message : String(error)}`);
  }
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

function sanitizeTerminationErrorMessage(error: unknown, fallback = 'Strava cleanup failed'): string {
  if (typeof error === 'string') {
    return sanitizeSyncErrorMessage({ message: error }, fallback);
  }
  return sanitizeSyncErrorMessage(error, fallback);
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

export async function getOAuthCallbackAutoSyncContext(
  tenantId: number | string,
  userId: number,
): Promise<StravaOAuthCallbackAutoSyncContext> {
  const existing = await strapi.db.query(STRAVA_CONNECTION_UID).findOne({
    where: mergeTenantWhere({ user: { id: userId } }, tenantId),
    select: ['id', 'status', 'cleanupStatus', 'lastSyncStatus'],
  });

  if (!existing?.id) {
    return {
      connectionExisted: false,
      connectionId: null,
      previousStatus: null,
      previousCleanupStatus: null,
      previousLastSyncStatus: null,
      localSyncedActivityCount: 0,
      hadCompletedSyncJob: false,
      hadActiveSyncJob: false,
      shouldResetActivityDeleteMarkers: false,
      shouldAutoStartSync: true,
      reason: 'first_connect',
    };
  }

  const connectionId = Number(existing.id);
  const [localSyncedActivityCount, completedSyncJobCount, activeJob] = await Promise.all([
    strapi.db.query(STRAVA_ACTIVITY_UID).count({
      where: buildSyncedActivityWhere(tenantId, userId, { connection: { id: connectionId } }),
    } as any),
    strapi.db.query(STRAVA_SYNC_JOB_UID).count({
      where: mergeTenantWhere({
        user: { id: userId },
        connection: { id: connectionId },
        status: 'completed',
      }, tenantId),
    } as any),
    findActiveStravaSyncJob(tenantId, userId, connectionId),
  ]);

  const previousStatus = toText(existing.status).toUpperCase() || null;
  const previousCleanupStatus = existing.cleanupStatus
    ? normalizeStravaConnectionCleanupStatus(existing.cleanupStatus)
    : null;
  const previousLastSyncStatus = toText(existing.lastSyncStatus).toUpperCase() || null;
  const syncedActivityCount = Number(localSyncedActivityCount || 0);
  const hadCompletedSyncJob = Number(completedSyncJobCount || 0) > 0;
  const hadActiveSyncJob = Boolean(activeJob?.id);
  const cleanupIncomplete = previousCleanupStatus === 'PENDING'
    || previousCleanupStatus === 'RUNNING'
    || previousCleanupStatus === 'FAILED';
  const reconnectAfterCompletedCleanup = previousStatus === 'DISCONNECTED'
    && previousCleanupStatus === 'COMPLETED'
    && syncedActivityCount === 0;
  const neverHadLocalDataOrSync = syncedActivityCount === 0
    && !hadCompletedSyncJob
    && previousLastSyncStatus !== 'SUCCESS';

  let reason: StravaOAuthCallbackAutoSyncReason = null;
  if (reconnectAfterCompletedCleanup) {
    reason = 'reconnect_after_cleanup';
  } else if (!cleanupIncomplete && previousStatus !== 'ACTIVE' && neverHadLocalDataOrSync) {
    reason = 'first_connect';
  }

  return {
    connectionExisted: true,
    connectionId,
    previousStatus,
    previousCleanupStatus,
    previousLastSyncStatus,
    localSyncedActivityCount: syncedActivityCount,
    hadCompletedSyncJob,
    hadActiveSyncJob,
    shouldResetActivityDeleteMarkers: reconnectAfterCompletedCleanup,
    shouldAutoStartSync: Boolean(reason) && !hadActiveSyncJob,
    reason,
  };
}

export async function startCurrentUserStravaSync(tenantId: number | string, userId: number): Promise<StravaSyncJobStartResult> {
  const connection = await getCurrentStravaConnection(tenantId, userId, true);
  if (!connection?.id) {
    throw Object.assign(new Error('Bạn chưa kết nối tài khoản Strava.'), { code: 'STRAVA_NOT_CONNECTED', status: 400 });
  }

  if (isConnectionRevoked(connection)) {
    throw Object.assign(new Error('Kết nối Strava đã bị thu hồi quyền truy cập.'), { code: 'STRAVA_CONNECTION_REVOKED', status: 409 });
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

async function cancelStravaSyncJobForRevokedConnection(jobId: number) {
  const nowIso = new Date().toISOString()
  await updateStravaSyncJobCheckpoint(jobId, {
    status: 'cancelled',
    cancelledAt: nowIso,
    heartbeatAt: nowIso,
    nextRetryAt: null,
    claimedAt: null,
    claimedBy: null,
    lastErrorCode: 'STRAVA_CONNECTION_REVOKED',
    lastErrorMessage: buildStravaSyncClientMessage('STRAVA_CONNECTION_REVOKED'),
  })
}

async function getStravaConnectionForJob(job: StravaSyncJobRecord) {
  const tenantId = resolveJobTenantId(job);
  const userId = resolveJobUserId(job);
  const connectionId = resolveJobConnectionId(job);

  const connection = await strapi.db.query(STRAVA_CONNECTION_UID).findOne({
    where: mergeTenantWhere({ id: connectionId, user: { id: userId } }, tenantId),
    select: ['id', 'status', 'accessToken', 'refreshToken', 'tokenExpiresAt', 'disconnectedAt', 'lastSyncAt', 'lastSyncStatus', 'athleteFirstname', 'athleteLastname', 'athleteUsername', 'profileUrl'],
  });

  if (!connection?.id) {
    throw Object.assign(new Error('Strava connection not found'), { code: 'STRAVA_CONNECTION_NOT_FOUND', status: 404 });
  }

  if (isConnectionRevoked(connection as StravaConnectionRecord)) {
    throw Object.assign(new Error('Strava connection is revoked or inactive.'), {
      code: 'STRAVA_CONNECTION_REVOKED',
      status: 409,
    })
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
    select: ['id', 'status', 'accessToken', 'refreshToken', 'tokenExpiresAt', 'disconnectedAt', 'lastSyncAt', 'lastSyncStatus', 'athleteFirstname', 'athleteLastname', 'athleteUsername', 'profileUrl'],
  });

  if (!connection?.id) return null;
  if (requireActive && isConnectionRevoked(connection as StravaConnectionRecord)) {
    throw Object.assign(new Error('Strava connection is revoked or inactive.'), {
      code: 'STRAVA_CONNECTION_REVOKED',
      status: 409,
    });
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
  await cleanupStaleStravaOAuthStatesBestEffort('create');

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
  await cleanupStaleStravaOAuthStatesBestEffort('verify');

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

export function verifyStravaWebhookSubscription(
  input: StravaWebhookVerificationInput,
): StravaWebhookVerificationResult {
  const configuredVerifyToken = readStravaWebhookVerifyToken();
  if (!configuredVerifyToken) {
    throw Object.assign(new Error('Strava webhook verification is not configured'), { status: 503 });
  }

  if (input.mode !== 'subscribe') {
    throw Object.assign(new Error('Invalid webhook verification mode'), { status: 400 });
  }

  if (!input.challenge || !input.challenge.trim()) {
    throw Object.assign(new Error('Missing webhook challenge'), { status: 400 });
  }

  if (!timingSafeEqualText(input.verifyToken, configuredVerifyToken)) {
    throw Object.assign(new Error('Invalid webhook verify token'), { status: 403 });
  }

  return {
    challenge: input.challenge,
  };
}

export async function receiveStravaWebhookEvent(rawPayload: unknown): Promise<StravaWebhookReceiveResult> {
  const normalized = normalizeStravaWebhookPayload(rawPayload);

  try {
    await strapi.db.query(STRAVA_WEBHOOK_EVENT_UID).create({
      data: {
        subscriptionId: normalized.subscriptionId,
        ownerId: normalized.ownerId,
        objectType: normalized.objectType,
        objectId: normalized.objectId,
        aspectType: normalized.aspectType,
        eventTime: normalized.eventTime,
        updates: normalized.updates,
        rawPayload: normalized.rawPayload,
        status: normalized.status,
        attempts: 0,
        idempotencyKey: normalized.idempotencyKey,
      },
    });

    return { duplicate: false };
  } catch (error: any) {
    if (isStravaWebhookDuplicateError(error)) {
      strapi.log.info('[strava.webhookReceive] duplicate ignored');
      return { duplicate: true };
    }

    throw error;
  }
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
  assertConnectionUsable(connection)
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
  assertConnectionUsable(connection)
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
  options: {
    resetActivityDeleteMarkers?: boolean;
  } = {},
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
    cleanupStatus: 'NOT_REQUIRED',
    cleanupRequestedAt: null,
    cleanupCompletedAt: null,
    cleanupError: null,
    terminationReason: null,
    status: 'ACTIVE',
    disconnectedAt: null,
    rawAthlete: athlete,
    lastSyncStatus: toText(existing?.lastSyncStatus) || 'NEVER',
  };

  if (options.resetActivityDeleteMarkers === true) {
    Object.assign(payload, {
      activityDeleteMarkers: [],
    });
  }

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
  const connection = await getCurrentStravaConnectionForTermination(tenantId, userId)
  if (!connection?.id) {
    return {
      success: true,
    }
  }

  const cleanupStatus = normalizeStravaConnectionCleanupStatus(connection.cleanupStatus)
  if (cleanupStatus === 'COMPLETED' && toText(connection.status).toUpperCase() === 'DISCONNECTED') {
    return {
      success: true,
    }
  }

  await blockStravaConnectionAccessForTermination(connection, 'manual_disconnect')
  const remoteRevoke = await revokeStravaAuthorizationRemotely(connection)
  await terminateStravaConnection({
    connection: connection.id,
    terminationReason: 'manual_disconnect',
    source: 'manual_disconnect',
    skipRemoteRevoke: true,
    completionCleanupError: remoteRevoke.success ? null : remoteRevoke.warning,
  })

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

  const redirectUrl = buildTenantFrontendRedirect({
    frontendOrigin,
    path: target.path || DEFAULT_STRAVA_SUCCESS_REDIRECT_PATH,
  });

  return redirectUrl;
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
  shouldCheckStravaWebhookOnBoot,
  getStravaDashboardOverview,
  getPlatformStravaDiagnostics,
  getPlatformStravaSubscriptionOverview,
  createPlatformStravaSubscription,
  deletePlatformStravaSubscription,
  listPlatformStravaConnections,
  listPlatformStravaWebhookEvents,
  getPlatformStravaWebhookEventDetail,
  listPlatformStravaSyncJobs,
  getPlatformStravaSyncJobDetail,
  getWebhookSubscription,
  listWebhookSubscriptions,
  createWebhookSubscription,
  deleteWebhookSubscription,
  deleteAllWebhookSubscriptions,
  checkWebhookHealth,
  classifyStravaSyncError,
  calculateStravaRetryDelay,
  getRetryJobStatus,
  processActivityWebhookEvent,
  processAthleteWebhookEvent,
  cancelStravaSyncJobForRevokedConnection,
  requireAuthenticatedUser,
  getCurrentTenantId,
  resolveTenantIdForStravaOAuthStart,
  resolveTrustedFrontendOriginForOAuthStart,
  buildStravaAuthorizeUrl,
  createSignedOAuthState,
  receiveStravaWebhookEvent,
  verifyStravaWebhookSubscription,
  verifySignedOAuthState,
  consumeOAuthState,
  cleanupStaleStravaOAuthStates,
  scrubWebhookEventPayload,
  exchangeCodeForToken,
  getOAuthCallbackAutoSyncContext,
  upsertStravaConnection,
  terminateStravaConnection,
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