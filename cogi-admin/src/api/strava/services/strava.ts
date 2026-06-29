import crypto from 'node:crypto';
import { mergeTenantWhere, resolveCurrentTenantId, toText as normalizeTenantText } from '../../../utils/tenant-scope';

const STRAVA_CONNECTION_UID = 'api::strava-connection.strava-connection';
const STRAVA_OAUTH_STATE_UID = 'api::strava-oauth-state.strava-oauth-state';
const USER_UID = 'plugin::users-permissions.user';
const OAUTH_STATE_TTL_MS = 10 * 60 * 1000;
const STRAVA_AUTHORIZE_URL = 'https://www.strava.com/oauth/authorize';
const STRAVA_TOKEN_URL = 'https://www.strava.com/oauth/token';

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

function resolveStravaScopes(): string {
  return toText(process.env.STRAVA_SCOPES) || 'read,activity:read';
}

function resolveFrontendSuccessUrl(): string {
  const url = trimTrailingSlash(toText(process.env.STRAVA_FRONTEND_REDIRECT_SUCCESS));
  if (!url) {
    throw Object.assign(new Error('STRAVA_FRONTEND_REDIRECT_SUCCESS is not configured'), { status: 500 });
  }

  return url;
}

function resolveFrontendErrorUrl(): string {
  const url = trimTrailingSlash(toText(process.env.STRAVA_FRONTEND_REDIRECT_ERROR));
  if (!url) {
    throw Object.assign(new Error('STRAVA_FRONTEND_REDIRECT_ERROR is not configured'), { status: 500 });
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

function buildUrlWithQuery(baseUrl: string, query: Record<string, string>): string {
  const url = new URL(baseUrl);
  for (const [key, value] of Object.entries(query)) {
    if (value) {
      url.searchParams.set(key, value);
    }
  }
  return url.toString();
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

export async function createSignedOAuthState(tenantId: number | string, userId: number): Promise<string> {
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

  const stateHash = computeStateHash(trimmedState);
  const record = await strapi.db.query(STRAVA_OAUTH_STATE_UID).findOne({
    where: {
      stateHash,
    },
    select: ['id', 'nonce', 'expiresAt', 'usedAt'],
    populate: {
      tenant: {
        select: ['id'],
      },
      user: {
        select: ['id'],
      },
    },
  });

  const recordTenantId = toText(record?.tenant?.id || record?.tenant);
  const recordUserId = toPositiveInt(record?.user?.id || record?.user);
  const recordNonce = toText(record?.nonce);
  const recordExpiresAt = record?.expiresAt ? new Date(record.expiresAt).getTime() : 0;

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

export function buildFrontendSuccessRedirect(): string {
  return resolveFrontendSuccessUrl();
}

export function buildFrontendErrorRedirect(reason: string): string {
  return buildUrlWithQuery(resolveFrontendErrorUrl(), {
    error: toText(reason) || 'strava_callback_failed',
  });
}

export default {
  toText,
  requireAuthenticatedUser,
  getCurrentTenantId,
  buildStravaAuthorizeUrl,
  createSignedOAuthState,
  verifySignedOAuthState,
  consumeOAuthState,
  exchangeCodeForToken,
  upsertStravaConnection,
  getCurrentUserStravaStatus,
  disconnectCurrentUser,
  buildFrontendSuccessRedirect,
  buildFrontendErrorRedirect,
};