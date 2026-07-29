import crypto from 'node:crypto';

import { errors } from '@strapi/utils';

import { enqueueMail } from '../../../services/mail-queue';
import { getBaseUrl } from '../../../utils/tenant-base-url';
import { toText, whereByParam } from '../../../utils/tenant-scope';
import {
  buildActivationLink,
  checkUserTenantExists,
  createUserTenant,
  sendInviteNotification,
  updateUserPhoneIfEmpty,
} from '../../admin/services/invite-user';
import { ensureUserHasAuthenticatedRole } from '../../auth-extended/services/ensure-authenticated-role';

const REGISTRATION_CAMPAIGN_UID = 'api::registration-campaign.registration-campaign';
const CAMPAIGN_REGISTRATION_UID = 'api::campaign-registration.campaign-registration';
const USER_UID = 'plugin::users-permissions.user';
const USER_TENANT_UID = 'api::user-tenant.user-tenant';
const USER_TENANT_ROLE_UID = 'api::user-tenant-role.user-tenant-role';
const TENANT_ROLE_UID = 'api::tenant-role.tenant-role';
const ROLE_FEATURE_UID = 'api::role-feature.role-feature';
const TENANT_FEATURE_UID = 'api::tenant-feature.tenant-feature';
const FEATURE_UID = 'api::feature.feature';
const ACTIVATION_TOKEN_UID = 'api::activation-token.activation-token';
const NOTIFICATION_SERVICE_UID = 'api::notification.notification';
const NOTIFICATION_TEMPLATE_SERVICE_UID = 'api::notification-template.notification-template';
const MAIL_LOG_UID = 'api::mail-log.mail-log';

const REGISTRATION_VERIFICATION_TEMPLATE_CODE = 'registration_campaign_verification';
const REGISTRATION_COMPLETION_TEMPLATE_CODE = 'campaign_registration_completed';
const REGISTRATION_REJECTION_TEMPLATE_CODE = 'campaign_registration_rejected';
const ACTIVE_REGISTRATION_STATUSES = ['pending_verification', 'verified', 'approved'];
const RESEND_COOLDOWN_MS = 60 * 1000;
const ACTIVATION_TOKEN_TTL_MS = 48 * 60 * 60 * 1000;
const REGISTRATION_PUBLIC_TOKEN_TTL_MS = 24 * 60 * 60 * 1000;

type CampaignNotificationType = 'verification' | 'completion' | 'rejection';

type AuthUser = {
  id: number;
  email?: string | null;
  blocked?: boolean | null;
};

export class HttpError extends Error {
  status: number;
  code?: string | null;

  constructor(status: number, message: string, code?: string | null) {
    super(message);
    this.status = status;
    this.code = code || null;
  }
}

function httpError(status: number, message: string, code?: string): never {
  throw new HttpError(status, message, code);
}

function normalizeText(value: unknown): string {
  return toText(value);
}

function normalizeEmail(value: unknown): string {
  return normalizeText(value).toLowerCase();
}

function normalizePhone(value: unknown): string {
  return normalizeText(value);
}

function normalizeCode(value: unknown): string {
  return normalizeText(value).toLowerCase();
}

function normalizePath(value: unknown): string | null {
  const text = normalizeText(value);
  if (!text) return null;
  return text.startsWith('/') ? text : `/${text}`;
}

function normalizeStatus(value: unknown): string {
  return normalizeText(value).toLowerCase();
}

function normalizeEnumValue<T extends string>(value: unknown, allowedValues: T[], fallback: T): T {
  const normalized = normalizeText(value).toLowerCase() as T;
  return allowedValues.includes(normalized) ? normalized : fallback;
}

function ensureEmail(value: unknown, fieldName = 'email'): string {
  const email = normalizeEmail(value);
  if (!email) {
    httpError(400, `${fieldName} is required`);
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    httpError(400, `${fieldName} is invalid`);
  }

  return email;
}

function ensureRequiredText(value: unknown, fieldName: string): string {
  const text = normalizeText(value);
  if (!text) {
    httpError(400, `${fieldName} is required`);
  }
  return text;
}

function ensurePositiveInteger(value: unknown, fieldName: string): number {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    httpError(400, `${fieldName} must be a positive integer`);
  }
  return parsed;
}

function ensureObject(value: unknown, fieldName: string): Record<string, unknown> {
  if (!value) return {};
  if (typeof value === 'object' && !Array.isArray(value)) {
    return { ...(value as Record<string, unknown>) };
  }
  httpError(400, `${fieldName} must be an object`);
}

function toDateOrNull(value: unknown): Date | null {
  const text = normalizeText(value);
  if (!text) return null;
  const date = new Date(text);
  return Number.isNaN(date.getTime()) ? null : date;
}

function isTemplateNotFoundError(error: unknown): boolean {
  const message = (error as { message?: string })?.message || '';
  const code = (error as { details?: { code?: string } })?.details?.code || '';
  return code === 'NOTIFICATION_TEMPLATE_NOT_FOUND' || message.includes('Active notification template not found');
}

function maskEmail(email: string): string {
  const normalized = normalizeEmail(email);
  const [localPart, domainPart] = normalized.split('@');
  if (!localPart || !domainPart) return '';

  const visiblePrefix = localPart.slice(0, Math.min(2, localPart.length));
  const maskedLocal = `${visiblePrefix}${'*'.repeat(Math.max(2, localPart.length - visiblePrefix.length))}`;
  return `${maskedLocal}@${domainPart}`;
}

function sha256(value: string): string {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function generateOpaqueToken(bytes = 32): string {
  return crypto.randomBytes(bytes).toString('base64url');
}

function isVerificationExpired(registration: any): boolean {
  const expiresAt = toDateOrNull(registration?.verificationExpiresAt);
  return Boolean(expiresAt && expiresAt.getTime() < Date.now());
}

function getNonDeletedWhere() {
  return {
    $or: [
      { isDeleted: false },
      { isDeleted: { $null: true } },
    ],
  };
}

function pickRegistrationSource(campaign: any, payloadSource: unknown): string {
  const explicit = normalizeEnumValue(
    payloadSource,
    ['campaign_link', 'manual_code', 'invite', 'admin', 'import', 'api', 'other'],
    'campaign_link'
  );

  if (normalizeText(payloadSource)) {
    return explicit;
  }

  return normalizeStatus(campaign?.registrationMode) === 'public_code' ? 'manual_code' : 'campaign_link';
}

function buildBackendBaseUrl(ctx: any): string {
  const configured = normalizeText(process.env.BACKEND_URL);
  if (configured) {
    return configured.replace(/\/+$/, '');
  }

  const host = normalizeText(ctx?.request?.host || ctx?.host);
  const protocol = normalizeText(ctx?.request?.protocol || ctx?.protocol) || 'http';
  if (host) {
    return `${protocol}://${host}`.replace(/\/+$/, '');
  }

  return 'http://localhost:1339';
}

function trimTrailingSlash(value: string): string {
  return value.replace(/\/+$/, '');
}

function getSigningSecret(): string {
  const appKeys = normalizeText(process.env.APP_KEYS);
  if (appKeys) {
    const first = appKeys.split(',').map((item) => item.trim()).find(Boolean);
    if (first) return first;
  }

  const jwtSecret = normalizeText(process.env.JWT_SECRET || process.env.ADMIN_JWT_SECRET);
  if (jwtSecret) return jwtSecret;

  return 'registration-campaign-secret';
}

function signRegistrationStateToken(payload: Record<string, unknown>): string {
  const encodedPayload = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
  const signature = crypto.createHmac('sha256', getSigningSecret()).update(encodedPayload).digest('base64url');
  return `${encodedPayload}.${signature}`;
}

function verifyRegistrationStateToken(token: string, expectedPurpose: string) {
  const normalizedToken = normalizeText(token);
  if (!normalizedToken || !normalizedToken.includes('.')) {
    httpError(400, 'Invalid registration token', 'REGISTRATION_TOKEN_INVALID');
  }

  const [encodedPayload, signature] = normalizedToken.split('.');
  const expectedSignature = crypto.createHmac('sha256', getSigningSecret()).update(encodedPayload).digest('base64url');
  if (signature !== expectedSignature) {
    httpError(400, 'Invalid registration token', 'REGISTRATION_TOKEN_INVALID');
  }

  let payload: any = null;
  try {
    payload = JSON.parse(Buffer.from(encodedPayload, 'base64url').toString('utf8'));
  } catch {
    httpError(400, 'Invalid registration token', 'REGISTRATION_TOKEN_INVALID');
  }

  if (normalizeText(payload?.purpose) !== expectedPurpose) {
    httpError(400, 'Invalid registration token purpose', 'REGISTRATION_TOKEN_INVALID');
  }

  const expiresAt = Number(payload?.exp || 0);
  if (!Number.isFinite(expiresAt) || expiresAt <= Date.now()) {
    httpError(410, 'Registration token has expired', 'REGISTRATION_TOKEN_EXPIRED');
  }

  return payload;
}

function buildTenantPath(tenantCode: string, path: string) {
  const normalizedTenantCode = normalizeText(tenantCode);
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  if (!normalizedTenantCode) return normalizedPath;
  return `/t/${encodeURIComponent(normalizedTenantCode)}${normalizedPath}`;
}

async function buildFrontendPublicUrl(ctx: any, tenantId: number | string, tenantCode: string, path: string) {
  const baseUrl = trimTrailingSlash(await getBaseUrl(ctx, { tenantId }));
  return `${baseUrl}${buildTenantPath(tenantCode, path)}`;
}

function buildPublicAccessToken(registration: any, campaign: any) {
  return signRegistrationStateToken({
    purpose: 'registration_access',
    registrationId: Number(registration?.id || 0),
    campaignId: Number(campaign?.id || 0),
    tenantId: Number(campaign?.tenant?.id || campaign?.tenant || 0),
    campaignCode: normalizeCode(campaign?.code),
    tenantCode: normalizeText(campaign?.tenant?.code),
    email: normalizeEmail(registration?.email),
    exp: Date.now() + REGISTRATION_PUBLIC_TOKEN_TTL_MS,
  });
}

function buildCompletionToken(registration: any, campaign: any) {
  return signRegistrationStateToken({
    purpose: 'registration_complete',
    registrationId: Number(registration?.id || 0),
    campaignId: Number(campaign?.id || 0),
    tenantId: Number(campaign?.tenant?.id || campaign?.tenant || 0),
    campaignCode: normalizeCode(campaign?.code),
    tenantCode: normalizeText(campaign?.tenant?.code),
    email: normalizeEmail(registration?.email),
    verifiedAt: registration?.verifiedAt || null,
    exp: Date.now() + REGISTRATION_PUBLIC_TOKEN_TTL_MS,
  });
}

async function buildVerificationLink(ctx: any, token: string, campaign: any): Promise<string> {
  return buildFrontendPublicUrl(
    ctx,
    Number(campaign?.tenant?.id || campaign?.tenant || 0),
    normalizeText(campaign?.tenant?.code),
    `/join/verify?token=${encodeURIComponent(token)}`,
  );
}

function buildSafeMetadata(existingValue: unknown, patch: Record<string, unknown>) {
  const base = existingValue && typeof existingValue === 'object' && !Array.isArray(existingValue)
    ? { ...(existingValue as Record<string, unknown>) }
    : {};

  return {
    ...base,
    ...patch,
  };
}

async function resolveUserFromJwt(ctx: any) {
  try {
    const authHeader = ctx.request?.headers?.authorization || ctx.request?.header?.authorization || '';
    const token = typeof authHeader === 'string' && authHeader.startsWith('Bearer ')
      ? authHeader.slice(7).trim()
      : '';
    if (!token) return null;

    const jwtService = strapi.plugin('users-permissions')?.service('jwt');
    if (!jwtService) return null;

    const decoded = await jwtService.verify(token);
    const userId = Number(decoded?.id || 0);
    if (!Number.isInteger(userId) || userId <= 0) return null;

    return strapi.db.query(USER_UID).findOne({
      where: { id: userId },
      select: ['id', 'username', 'email', 'fullName', 'phone', 'provider', 'confirmed', 'blocked', 'isPlatformAdmin', 'createdAt', 'updatedAt'],
    });
  } catch {
    return null;
  }
}

async function sanitizeAuthUser(user: any, ctx: any) {
  const userModel = strapi.getModel(USER_UID);
  return strapi.contentAPI.sanitize.output(user, userModel, { auth: ctx.state?.auth });
}

async function loadAuthUserForResponse(userId: number) {
  return strapi.db.query(USER_UID).findOne({
    where: { id: userId },
    select: ['id', 'username', 'email', 'fullName', 'phone', 'provider', 'confirmed', 'blocked', 'isPlatformAdmin', 'createdAt', 'updatedAt'],
  });
}

function buildRedirectPathForTargetFeature(campaign: any): string {
  const configured = normalizePath(campaign?.redirectPath);
  if (configured) return configured;
  const targetFeature = normalizeText(campaign?.targetFeature).toLowerCase();
  if (targetFeature === 'fitness.manage' || targetFeature === 'fitness') {
    return '/fitness';
  }
  return '/dashboard';
}

function buildCheckEmailPath(campaign: any, registration: any, registrationToken: string) {
  const tenantCode = normalizeText(campaign?.tenant?.code);
  const campaignCode = normalizeCode(campaign?.code);
  return buildTenantPath(
    tenantCode,
    `/join/${encodeURIComponent(campaignCode)}/check-email?token=${encodeURIComponent(registrationToken)}&email=${encodeURIComponent(maskEmail(normalizeEmail(registration?.email || '')) || '')}`,
  );
}

function buildCompleteAccountPath(campaign: any, completionToken: string) {
  return buildTenantPath(
    normalizeText(campaign?.tenant?.code),
    `/join/complete-account?token=${encodeURIComponent(completionToken)}`,
  );
}

function buildCompletePath(campaign: any, completionToken: string) {
  return buildTenantPath(
    normalizeText(campaign?.tenant?.code),
    `/join/complete?token=${encodeURIComponent(completionToken)}`,
  );
}

function buildLoginPath(campaign: any, completionToken: string) {
  const completePath = buildCompletePath(campaign, completionToken);
  const loginBasePath = buildTenantPath(normalizeText(campaign?.tenant?.code), '/login');
  const searchParams = new URLSearchParams();
  searchParams.set('redirect', completePath);
  return `${loginBasePath}?${searchParams.toString()}`;
}

function assertInternalRedirectPath(path: string | null) {
  const normalized = normalizePath(path);
  if (!normalized) return '/dashboard';
  if (/^https?:\/\//i.test(normalized)) {
    httpError(400, 'External redirect is not allowed', 'INVALID_REDIRECT_PATH');
  }
  return normalized;
}

function getCompletionMeta(registration: any) {
  const metadata = registration?.metadata && typeof registration.metadata === 'object' && !Array.isArray(registration.metadata)
    ? registration.metadata as Record<string, unknown>
    : {};
  return {
    status: normalizeText(metadata.completionStatus) || null,
    error: normalizeText(metadata.completionError) || null,
    code: normalizeText(metadata.completionErrorCode) || null,
    targetFeatureGranted: metadata.targetFeatureGranted === true,
    defaultRoleAssigned: metadata.defaultRoleAssigned === true,
  };
}

function rolePriority(role: any): number {
  const haystack = [role?.code, role?.type, role?.name, role?.label]
    .map((value) => normalizeText(value).toLowerCase())
    .filter(Boolean)
    .join(' ');

  if (!haystack) return 1;
  if (/(member|user|participant|learner|student|customer|authenticated)/.test(haystack)) return 0;
  if (/(admin|manager|owner|staff|teacher|editor)/.test(haystack)) return 2;
  return 1;
}

async function findCampaignByCode(tenantId: number | string, code: string) {
  const tenantWhere = whereByParam(tenantId);
  if (!tenantWhere) {
    httpError(400, 'Tenant context is required');
  }

  return strapi.db.query(REGISTRATION_CAMPAIGN_UID).findOne({
    where: {
      code: {
        $eqi: code,
      },
      tenant: tenantWhere,
      ...getNonDeletedWhere(),
    },
    populate: {
      tenant: {
        select: ['id', 'name', 'code', 'shortName', 'slogan'],
      },
      coverImage: {
        select: ['id', 'name', 'url', 'formats'],
      },
      verificationNotificationTemplate: {
        select: ['id', 'documentId', 'code', 'name', 'subject', 'content', 'type', 'isActive', 'variables'],
      },
      completionNotificationTemplate: {
        select: ['id', 'documentId', 'code', 'name', 'subject', 'content', 'type', 'isActive', 'variables'],
      },
      rejectionNotificationTemplate: {
        select: ['id', 'documentId', 'code', 'name', 'subject', 'content', 'type', 'isActive', 'variables'],
      },
    },
  });
}

async function findRegistrationById(id: number, tenantId: number | string) {
  const tenantWhere = whereByParam(tenantId);
  if (!tenantWhere) {
    httpError(400, 'Tenant context is required');
  }

  return strapi.db.query(CAMPAIGN_REGISTRATION_UID).findOne({
    where: {
      id,
      tenant: tenantWhere,
      ...getNonDeletedWhere(),
    },
    populate: {
      campaign: {
        populate: {
          tenant: {
            select: ['id', 'name', 'code', 'shortName', 'slogan'],
          },
          defaultTenantRole: {
            select: ['id', 'name', 'description', 'type'],
          },
          verificationNotificationTemplate: {
            select: ['id', 'documentId', 'code', 'name', 'subject', 'content', 'type', 'isActive', 'variables'],
          },
          completionNotificationTemplate: {
            select: ['id', 'documentId', 'code', 'name', 'subject', 'content', 'type', 'isActive', 'variables'],
          },
          rejectionNotificationTemplate: {
            select: ['id', 'documentId', 'code', 'name', 'subject', 'content', 'type', 'isActive', 'variables'],
          },
        },
      },
      user: {
        select: ['id', 'email', 'fullName', 'phone', 'confirmed', 'blocked', 'provider'],
      },
      membership: {
        select: ['id', 'userTenantStatus'],
      },
    },
  });
}

async function findLatestRegistrationByCampaignAndEmail(campaignId: number, email: string) {
  const rows = await strapi.db.query(CAMPAIGN_REGISTRATION_UID).findMany({
    where: {
      campaign: campaignId,
      email: {
        $eqi: email,
      },
      ...getNonDeletedWhere(),
    },
    orderBy: [{ createdAt: 'desc' }],
    populate: {
      campaign: {
        populate: {
          tenant: {
            select: ['id', 'name', 'code', 'shortName', 'slogan'],
          },
          defaultTenantRole: {
            select: ['id', 'name', 'description', 'type'],
          },
          verificationNotificationTemplate: {
            select: ['id', 'documentId', 'code', 'name', 'subject', 'content', 'type', 'isActive', 'variables'],
          },
          completionNotificationTemplate: {
            select: ['id', 'documentId', 'code', 'name', 'subject', 'content', 'type', 'isActive', 'variables'],
          },
          rejectionNotificationTemplate: {
            select: ['id', 'documentId', 'code', 'name', 'subject', 'content', 'type', 'isActive', 'variables'],
          },
        },
      },
      user: {
        select: ['id', 'email', 'fullName', 'phone', 'confirmed', 'blocked', 'provider'],
      },
      membership: {
        select: ['id', 'userTenantStatus'],
      },
    },
    limit: 1,
  });

  return Array.isArray(rows) && rows.length > 0 ? rows[0] : null;
}

async function countActiveRegistrations(campaignId: number) {
  return strapi.db.query(CAMPAIGN_REGISTRATION_UID).count({
    where: {
      campaign: campaignId,
      status: {
        $in: ACTIVE_REGISTRATION_STATUSES,
      },
      ...getNonDeletedWhere(),
    },
  });
}

function getEnabledCampaignFields(campaign: any) {
  const fields = Array.isArray(campaign?.formConfig?.fields) ? campaign.formConfig.fields : [];
  return fields.filter((field: any) => field?.enabled !== false);
}

function validateRegistrationInput(campaign: any, payload: Record<string, unknown>) {
  const errors: string[] = [];
  const fullName = ensureRequiredText(payload.fullName, 'fullName');
  const email = ensureEmail(payload.email);
  const phone = normalizePhone(payload.phone) || null;
  const formData = ensureObject(payload.formData, 'formData');
  const enabledFields = getEnabledCampaignFields(campaign);

  for (const field of enabledFields) {
    const key = normalizeText(field?.key);
    if (!key || ['fullName', 'email', 'phone'].includes(key)) continue;
    const required = field?.required === true;
    const value = formData[key];
    const textValue = normalizeText(value);

    if (required && !textValue && !(Array.isArray(value) && value.length > 0)) {
      errors.push(`${key} is required`);
      continue;
    }

    if ((field?.type === 'select' || field?.type === 'radio') && textValue) {
      const allowedOptions = Array.isArray(field?.options) ? field.options.map((option: any) => normalizeText(option?.value || option)).filter(Boolean) : [];
      if (allowedOptions.length > 0 && !allowedOptions.includes(textValue)) {
        errors.push(`${key} is invalid`);
      }
    }
  }

  const phoneField = enabledFields.find((field: any) => normalizeText(field?.key) === 'phone');
  if (phoneField?.required === true && !phone) {
    errors.push('phone is required');
  }

  return {
    fullName,
    email,
    phone,
    formData,
    errors,
  };
}

async function findRegistrationBySignedToken(token: string, expectedPurpose: 'registration_access' | 'registration_complete') {
  const payload = verifyRegistrationStateToken(token, expectedPurpose);
  const tenantId = Number(payload?.tenantId || 0);
  const registrationId = Number(payload?.registrationId || 0);
  if (!tenantId || !registrationId) {
    httpError(400, 'Invalid registration token', 'REGISTRATION_TOKEN_INVALID');
  }

  const registration = await findRegistrationById(registrationId, tenantId);
  if (!registration?.id) {
    httpError(404, 'Registration not found', 'REGISTRATION_NOT_FOUND');
  }

  if (normalizeEmail(registration.email) !== normalizeEmail(payload?.email)) {
    httpError(400, 'Invalid registration token', 'REGISTRATION_TOKEN_INVALID');
  }

  return {
    payload,
    registration,
    campaign: registration.campaign,
  };
}

async function ensureTenantMembershipForCampaign(userId: number, tenantId: number) {
  const membership = await strapi.db.query(USER_TENANT_UID).findOne({
    where: {
      user: userId,
      tenant: tenantId,
    },
    select: ['id', 'userTenantStatus'],
  });

  if (!membership?.id) {
    const created = await createUserTenant(userId, tenantId, 'active');
    return {
      membershipId: Number(created.id),
      created: true,
      activated: true,
    };
  }

  const status = normalizeStatus(membership.userTenantStatus);
  if (status === 'inactive' || status === 'suspended') {
    httpError(409, 'Membership is blocked for this tenant', 'TENANT_MEMBERSHIP_BLOCKED');
  }

  if (status === 'pending') {
    await strapi.db.query(USER_TENANT_UID).update({
      where: { id: membership.id },
      data: {
        userTenantStatus: 'active',
        joinedAt: new Date(),
        leftAt: null,
      },
    });
    return {
      membershipId: Number(membership.id),
      created: false,
      activated: true,
    };
  }

  return {
    membershipId: Number(membership.id),
    created: false,
    activated: false,
  };
}

async function ensureDefaultTenantRoleForCampaign(membershipId: number, campaign: any) {
  const tenantId = Number(campaign?.tenant?.id || campaign?.tenant || 0);
  const roleId = Number(campaign?.defaultTenantRole?.id || campaign?.defaultTenantRole || 0);
  if (!roleId) {
    httpError(409, 'Campaign default tenant role is not configured', 'DEFAULT_TENANT_ROLE_NOT_CONFIGURED');
  }

  const tenantRole = await strapi.db.query(TENANT_ROLE_UID).findOne({
    where: {
      tenant: tenantId,
      role: roleId,
      isActive: true,
    },
    populate: {
      role: {
        select: ['id', 'name', 'description', 'type'],
      },
    },
  });

  if (!tenantRole?.id) {
    httpError(409, 'Campaign default tenant role is not available for this tenant', 'TENANT_ROLE_NOT_AVAILABLE');
  }

  const existingAssignment = await strapi.db.query(USER_TENANT_ROLE_UID).findOne({
    where: {
      userTenant: membershipId,
      role: roleId,
    },
    select: ['id', 'userTenantRoleStatus'],
  });

  if (existingAssignment?.id) {
    if (existingAssignment.userTenantRoleStatus !== 'active') {
      await strapi.db.query(USER_TENANT_ROLE_UID).update({
        where: { id: existingAssignment.id },
        data: {
          userTenantRoleStatus: 'active',
          revokedAt: null,
        },
      });
    }

    return {
      roleId,
      created: false,
      roleName: normalizeText(tenantRole?.role?.name) || normalizeText(tenantRole?.role?.type) || `Role #${roleId}`,
    };
  }

  const activeRoleCount = await strapi.db.query(USER_TENANT_ROLE_UID).count({
    where: {
      userTenant: membershipId,
      userTenantRoleStatus: 'active',
    },
  });

  await strapi.db.query(USER_TENANT_ROLE_UID).create({
    data: {
      userTenant: membershipId,
      role: roleId,
      userTenantRoleStatus: 'active',
      assignedAt: new Date(),
      isPrimary: Number(activeRoleCount) === 0,
    },
  });

  return {
    roleId,
    created: true,
    roleName: normalizeText(tenantRole?.role?.name) || normalizeText(tenantRole?.role?.type) || `Role #${roleId}`,
  };
}

async function membershipHasTargetFeature(membershipId: number, tenantId: number, featureKey: string) {
  if (!membershipId || !featureKey) return false;

  const assignments = await strapi.db.query(USER_TENANT_ROLE_UID).findMany({
    where: {
      userTenant: membershipId,
      userTenantRoleStatus: 'active',
    },
    populate: {
      role: {
        select: ['id'],
      },
    },
  });

  const roleIds = Array.from(new Set((assignments || [])
    .map((item: any) => Number(item?.role?.id || item?.role || 0))
    .filter((value: number) => Number.isInteger(value) && value > 0)));
  if (roleIds.length === 0) return false;

  const feature = await strapi.db.query(FEATURE_UID).findOne({
    where: {
      key: featureKey,
    },
    select: ['id'],
  });
  if (!feature?.id) return false;

  const mapping = await strapi.db.query(ROLE_FEATURE_UID).findOne({
    where: {
      role: {
        id: {
          $in: roleIds,
        },
      },
      feature: feature.id,
      isActive: true,
    },
    select: ['id'],
  });
  if (!mapping?.id) return false;

  const tenantFeature = await strapi.db.query(TENANT_FEATURE_UID).findOne({
    where: {
      tenant: tenantId,
      feature: feature.id,
      isEnabled: true,
    },
    select: ['id'],
  });

  return Boolean(tenantFeature?.id);
}

async function buildAuthResponse(ctx: any, userId: number) {
  const user = await loadAuthUserForResponse(userId);
  if (!user?.id) {
    httpError(500, 'Failed to load authenticated user');
  }

  const jwt = strapi.plugin('users-permissions').service('jwt').issue({ id: userId });
  return {
    jwt,
    user: await sanitizeAuthUser(user, ctx),
  };
}

async function completeCampaignRegistration(ctx: any, registration: any, currentUser: any, actorUserId?: number | null) {
  if (!registration?.id) {
    httpError(404, 'Registration not found', 'REGISTRATION_NOT_FOUND');
  }

  if (!currentUser?.id) {
    httpError(401, 'Login is required to complete registration', 'LOGIN_REQUIRED');
  }

  if (currentUser.blocked) {
    httpError(403, 'User account is blocked', 'USER_BLOCKED');
  }

  const campaign = registration.campaign;
  if (!campaign?.id || normalizeStatus(campaign?.status) === 'cancelled') {
    httpError(409, 'Campaign is no longer available', 'CAMPAIGN_NOT_AVAILABLE');
  }

  if (normalizeEmail(currentUser.email) !== normalizeEmail(registration.email)) {
    httpError(403, 'Logged in account does not match registration email', 'REGISTRATION_EMAIL_MISMATCH');
  }

  const currentStatus = normalizeStatus(registration.status);
  if (currentStatus === 'approved') {
    return {
      registration,
      redirectPath: assertInternalRedirectPath(buildRedirectPathForTargetFeature(campaign)),
      alreadyApproved: true,
    };
  }

  if (currentStatus !== 'verified') {
    httpError(409, 'Registration must be verified before completion', 'REGISTRATION_NOT_VERIFIED');
  }

  const tenantId = Number(campaign?.tenant?.id || campaign?.tenant || 0);

  try {
    await ensureUserHasAuthenticatedRole(strapi, Number(currentUser.id));
    await updateUserPhoneIfEmpty(Number(currentUser.id), normalizePhone(registration.phone));

    const membership = await ensureTenantMembershipForCampaign(Number(currentUser.id), tenantId);
    const roleAssignment = await ensureDefaultTenantRoleForCampaign(membership.membershipId, campaign);
    const targetFeatureGranted = await membershipHasTargetFeature(membership.membershipId, tenantId, normalizeText(campaign.targetFeature));
    if (!targetFeatureGranted) {
      httpError(409, 'Default role does not grant target feature access', 'TARGET_FEATURE_ACCESS_NOT_GRANTED');
    }

    await strapi.db.query(CAMPAIGN_REGISTRATION_UID).update({
      where: { id: registration.id },
      data: {
        status: 'approved',
        approvedAt: new Date(),
        approvedBy: actorUserId || null,
        user: Number(currentUser.id),
        membership: membership.membershipId,
        metadata: buildSafeMetadata(registration.metadata, {
          completionStatus: 'approved',
          completionError: null,
          completionErrorCode: null,
          targetFeatureGranted: true,
          defaultRoleAssigned: true,
          targetRoleId: roleAssignment.roleId,
          targetRoleName: roleAssignment.roleName,
        }),
      },
    });

    const freshRegistration = await findRegistrationById(Number(registration.id), tenantId);
    const notification = await sendCompletionEmail(ctx, campaign, freshRegistration);
    return {
      registration: freshRegistration,
      redirectPath: assertInternalRedirectPath(buildRedirectPathForTargetFeature(campaign)),
      alreadyApproved: false,
      notification,
    };
  } catch (error) {
    const completionCode = error instanceof HttpError ? error.code || null : null;
    const completionMessage = error instanceof Error ? error.message : 'Failed to complete registration';
    await strapi.db.query(CAMPAIGN_REGISTRATION_UID).update({
      where: { id: registration.id },
      data: {
        metadata: buildSafeMetadata(registration.metadata, {
          completionStatus: 'failed',
          completionError: completionMessage,
          completionErrorCode: completionCode,
          targetFeatureGranted: false,
          defaultRoleAssigned: false,
        }),
      },
    });
    throw error;
  }
}

function ensureCampaignVisible(campaign: any) {
  if (!campaign?.id) {
    httpError(404, 'Registration campaign not found');
  }

  const status = normalizeStatus(campaign.status);
  if (status === 'cancelled' || status === 'draft') {
    httpError(404, 'Registration campaign not found');
  }

  return campaign;
}

function ensureCampaignOpenForRegistration(campaign: any) {
  ensureCampaignVisible(campaign);

  if (normalizeStatus(campaign.status) !== 'open') {
    httpError(409, 'Registration campaign is not open');
  }

  const now = Date.now();
  const startAt = toDateOrNull(campaign.startAt);
  const endAt = toDateOrNull(campaign.endAt);

  if (startAt && startAt.getTime() > now) {
    httpError(409, 'Registration campaign has not started');
  }

  if (endAt && endAt.getTime() < now) {
    httpError(409, 'Registration campaign has ended');
  }

  const registrationMode = normalizeStatus(campaign.registrationMode);
  if (registrationMode === 'invite_only' || registrationMode === 'admin_only') {
    httpError(403, 'Registration campaign does not accept public registrations');
  }
}

async function ensureCampaignCapacity(campaign: any) {
  const maxRegistrations = Number(campaign?.maxRegistrations || 0);
  if (!Number.isInteger(maxRegistrations) || maxRegistrations <= 0) {
    return;
  }

  const total = await countActiveRegistrations(Number(campaign.id));
  if (Number(total) >= maxRegistrations) {
    httpError(409, 'Registration campaign has reached maximum registrations');
  }
}

function toPublicCampaign(campaign: any) {
  const tenant = campaign?.tenant || null;
  return {
    id: campaign.id,
    name: normalizeText(campaign.name),
    code: normalizeCode(campaign.code),
    description: normalizeText(campaign.description) || null,
    shortDescription: normalizeText(campaign.shortDescription) || null,
    status: normalizeStatus(campaign.status) || 'draft',
    registrationMode: normalizeStatus(campaign.registrationMode) || 'public_code',
    targetFeature: normalizeText(campaign.targetFeature),
    verificationRequired: Boolean(campaign.verificationRequired),
    verificationMethod: normalizeStatus(campaign.verificationMethod) || 'email_link',
    verificationExpireMinutes: Number(campaign.verificationExpireMinutes || 0) || 1440,
    autoApprove: Boolean(campaign.autoApprove),
    requireTermsAcceptance: Boolean(campaign.requireTermsAcceptance),
    termsContent: normalizeText(campaign.termsContent) || null,
    successMessage: normalizeText(campaign.successMessage) || null,
    redirectPath: normalizePath(campaign.redirectPath),
    formConfig: campaign.formConfig && typeof campaign.formConfig === 'object' ? campaign.formConfig : { fields: [] },
    startAt: campaign.startAt || null,
    endAt: campaign.endAt || null,
    maxRegistrations: Number(campaign?.maxRegistrations || 0) || null,
    coverImage: campaign.coverImage || null,
    tenant: tenant
      ? {
          id: tenant.id,
          code: normalizeText(tenant.code),
          name: normalizeText(tenant.name) || normalizeText(tenant.shortName) || normalizeText(tenant.code),
          shortName: normalizeText(tenant.shortName) || null,
          slogan: normalizeText(tenant.slogan) || null,
        }
      : null,
  };
}

function buildVerificationFallbackEmail(data: {
  fullName: string;
  tenantName: string;
  campaignName: string;
  verificationLink: string;
}) {
  const subject = `Xac minh email dang ky ${data.tenantName}`;

  return {
    subject,
    text:
      `Xin chao ${data.fullName},\n\n` +
      `Ban da dang ky tham gia ${data.campaignName} tai ${data.tenantName}. ` +
      `Vui long xac minh email qua link sau:\n${data.verificationLink}\n\n` +
      'Neu ban khong thuc hien yeu cau nay, vui long bo qua email nay.',
    html:
      `<p>Xin chao <strong>${data.fullName}</strong>,</p>` +
      `<p>Ban da dang ky tham gia <strong>${data.campaignName}</strong> tai <strong>${data.tenantName}</strong>.</p>` +
      `<p><a href="${data.verificationLink}" style="display:inline-block;padding:10px 16px;background:#2563eb;color:#fff;text-decoration:none;border-radius:6px;">Xac minh email</a></p>` +
      '<p>Nếu nút không hoạt động, vui long su dung link sau:</p>' +
      `<p><a href="${data.verificationLink}">${data.verificationLink}</a></p>`,
  };
}

function buildCampaignSupportEmail(campaign: any) {
  return normalizeText(process.env.SMTP_REPLY_TO)
    || normalizeText(process.env.SMTP_FROM)
    || normalizeText(process.env.COMPANY_DEFAULT_REPLY_TO)
    || normalizeText(process.env.COMPANY_DEFAULT_FROM)
    || normalizeText(process.env.SES_DEFAULT_REPLY_TO)
    || normalizeText(process.env.SES_DEFAULT_FROM)
    || 'support@example.com';
}

async function buildFeatureUrl(ctx: any, campaign: any) {
  const tenantId = Number(campaign?.tenant?.id || campaign?.tenant || 0);
  const tenantCode = normalizeText(campaign?.tenant?.code);
  const redirectPath = assertInternalRedirectPath(buildRedirectPathForTargetFeature(campaign));
  return buildFrontendPublicUrl(ctx, tenantId, tenantCode, redirectPath);
}

async function buildLoginUrl(ctx: any, campaign: any) {
  const tenantId = Number(campaign?.tenant?.id || campaign?.tenant || 0);
  const tenantCode = normalizeText(campaign?.tenant?.code);
  const baseUrl = await buildFrontendPublicUrl(ctx, tenantId, tenantCode, '/login');
  const redirectPath = assertInternalRedirectPath(buildRedirectPathForTargetFeature(campaign));
  const searchParams = new URLSearchParams();
  searchParams.set('redirect', buildTenantPath(tenantCode, redirectPath));
  return `${baseUrl}?${searchParams.toString()}`;
}

function formatNotificationDateTime(value: Date | string | null | undefined) {
  const date = value instanceof Date ? value : (value ? new Date(value) : null);
  if (!date || Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

function getNotificationConfig(type: CampaignNotificationType) {
  if (type === 'completion') {
    return {
      fieldName: 'completionNotificationTemplate',
      mailType: REGISTRATION_COMPLETION_TEMPLATE_CODE,
      fallbackCode: null,
      requiredVariables: ['fullName', 'campaignName', 'tenantName', 'featureName', 'featureUrl', 'loginUrl', 'supportEmail'],
      missingTemplateCode: 'CAMPAIGN_COMPLETION_TEMPLATE_NOT_CONFIGURED',
      invalidTemplateCode: 'CAMPAIGN_COMPLETION_TEMPLATE_INVALID',
      allowRepeat: false,
    };
  }

  if (type === 'rejection') {
    return {
      fieldName: 'rejectionNotificationTemplate',
      mailType: REGISTRATION_REJECTION_TEMPLATE_CODE,
      fallbackCode: null,
      requiredVariables: ['fullName', 'campaignName', 'tenantName', 'rejectionReason', 'supportEmail'],
      missingTemplateCode: 'CAMPAIGN_REJECTION_TEMPLATE_NOT_CONFIGURED',
      invalidTemplateCode: 'CAMPAIGN_REJECTION_TEMPLATE_INVALID',
      allowRepeat: false,
    };
  }

  return {
    fieldName: 'verificationNotificationTemplate',
    mailType: REGISTRATION_VERIFICATION_TEMPLATE_CODE,
    fallbackCode: REGISTRATION_VERIFICATION_TEMPLATE_CODE,
    requiredVariables: ['fullName', 'campaignName', 'tenantName', 'verificationUrl', 'verificationExpiresAt', 'supportEmail'],
    missingTemplateCode: 'CAMPAIGN_VERIFICATION_TEMPLATE_NOT_CONFIGURED',
    invalidTemplateCode: 'CAMPAIGN_VERIFICATION_TEMPLATE_INVALID',
    allowRepeat: true,
  };
}

async function findNotificationLogsForRegistration(tenantId: number, registrationId: number, mailType: string) {
  const rows = await strapi.db.query(MAIL_LOG_UID).findMany({
    where: {
      tenant: tenantId,
      mailType,
    },
    orderBy: [{ queuedAt: 'desc' }, { createdAt: 'desc' }, { id: 'desc' }],
    select: ['id', 'mailType', 'sendStatus', 'toEmail', 'subject', 'html', 'text', 'lastError', 'lastProviderError', 'fallbackError', 'queuedAt', 'sentAt', 'failedAt', 'createdAt', 'metadata'],
    limit: 100,
  });

  return (rows || []).filter((item: any) => Number(item?.metadata?.registrationId || 0) === registrationId);
}

async function findLatestNotificationLogForRegistration(tenantId: number, registrationId: number, mailType: string) {
  const rows = await findNotificationLogsForRegistration(tenantId, registrationId, mailType);
  return rows[0] || null;
}

async function findSuccessfulNotificationLogForRegistration(tenantId: number, registrationId: number, mailType: string) {
  const rows = await findNotificationLogsForRegistration(tenantId, registrationId, mailType);
  return rows.find((item: any) => normalizeText(item?.sendStatus).toUpperCase() === 'SENT') || null;
}

async function createFailedNotificationMailLog(options: {
  tenantId: number;
  campaignId: number;
  registrationId: number;
  mailType: string;
  recipientEmail: string;
  errorCode: string;
  errorMessage: string;
  template?: any;
  metadata?: Record<string, unknown>;
}) {
  const now = new Date();
  return strapi.db.query(MAIL_LOG_UID).create({
    data: {
      tenant: options.tenantId,
      mailType: options.mailType,
      toEmail: options.recipientEmail,
      subject: options.template?.subject || `${options.mailType}`,
      html: null,
      text: null,
      provider: null,
      fallbackProvider: null,
      providerMessageId: null,
      sendStatus: 'FAILED',
      attempts: 1,
      lastError: options.errorMessage,
      lastProviderError: null,
      fallbackError: null,
      queuedAt: now,
      sentAt: null,
      failedAt: now,
      metadata: {
        ...(options.metadata || {}),
        campaignId: options.campaignId,
        registrationId: options.registrationId,
        templateId: options.template?.id || null,
        templateCode: normalizeCode(options.template?.code),
        notificationErrorCode: options.errorCode,
      },
    },
  });
}

function normalizeNotificationError(type: CampaignNotificationType, error: unknown) {
  const config = getNotificationConfig(type);
  const detailsCode = normalizeText((error as any)?.details?.code).toUpperCase();
  const message = normalizeText((error as any)?.message) || 'Email sending failed';

  if (detailsCode === 'NOTIFICATION_TEMPLATE_VARIABLE_MISSING') {
    return {
      code: 'NOTIFICATION_TEMPLATE_VARIABLE_MISSING',
      message: 'Notification template variables are missing',
    };
  }

  if (detailsCode === 'NOTIFICATION_TEMPLATE_INACTIVE' || detailsCode === 'NOTIFICATION_TEMPLATE_WRONG_TYPE' || detailsCode === 'NOTIFICATION_TEMPLATE_NOT_FOUND') {
    return {
      code: message.toLowerCase().includes('not found') ? config.missingTemplateCode : config.invalidTemplateCode,
      message,
    };
  }

  return {
    code: 'CAMPAIGN_NOTIFICATION_SEND_FAILED',
    message,
  };
}

async function resolveNotificationTemplateForType(campaign: any, type: CampaignNotificationType) {
  const tenantId = Number(campaign?.tenant?.id || campaign?.tenant || 0);
  const templateService = strapi.service(NOTIFICATION_TEMPLATE_SERVICE_UID) as any;
  const config = getNotificationConfig(type);
  const selectedTemplateRef = campaign?.[config.fieldName];

  if (selectedTemplateRef) {
    const selected = await templateService.findTenantTemplateByRef(tenantId, selectedTemplateRef, { selectContent: true });
    if (!selected?.id) {
      return { template: null, errorCode: config.missingTemplateCode, errorMessage: 'Notification template not found' };
    }
    if (selected.isActive === false || normalizeStatus(selected.type) !== 'email') {
      return { template: selected, errorCode: config.invalidTemplateCode, errorMessage: 'Notification template is invalid' };
    }
    return { template: selected, errorCode: null, errorMessage: null };
  }

  if (config.fallbackCode) {
    const fallbackTemplate = await templateService.findActiveTenantTemplateByCode(tenantId, config.fallbackCode, { selectContent: true });
    if (fallbackTemplate?.id) {
      return { template: fallbackTemplate, errorCode: null, errorMessage: null };
    }
  }

  return { template: null, errorCode: config.missingTemplateCode, errorMessage: 'Notification template is not configured' };
}

async function resolveFeatureDisplayName(campaign: any) {
  const feature = await findFeatureByKey(normalizeText(campaign?.targetFeature));
  return normalizeText(feature?.name) || normalizeText(campaign?.targetFeature) || 'feature';
}

async function buildCampaignNotificationPayload(type: CampaignNotificationType, ctx: any, campaign: any, registration: any, extraVariables: Record<string, unknown> = {}) {
  const tenantName = normalizeText(campaign?.tenant?.name) || normalizeText(campaign?.tenant?.shortName) || 'COGI';
  const base = {
    email: normalizeEmail(registration?.email),
    fullName: normalizeText(registration?.fullName) || normalizeEmail(registration?.email),
    campaignName: normalizeText(campaign?.name) || 'campaign',
    tenantName,
    supportEmail: buildCampaignSupportEmail(campaign),
  };

  if (type === 'completion') {
    return {
      ...base,
      featureName: await resolveFeatureDisplayName(campaign),
      featureUrl: await buildFeatureUrl(ctx, campaign),
      loginUrl: await buildLoginUrl(ctx, campaign),
      ...extraVariables,
    };
  }

  if (type === 'rejection') {
    return {
      ...base,
      rejectionReason: normalizeText(extraVariables.rejectionReason || registration?.rejectionReason) || 'Thong tin dang ky chua phu hop.',
    };
  }

  return {
    ...base,
    verificationUrl: normalizeText(extraVariables.verificationUrl),
    verificationExpiresAt: normalizeText(extraVariables.verificationExpiresAt),
  };
}

async function sendCampaignRegistrationNotification(options: {
  type: CampaignNotificationType;
  ctx: any;
  campaign: any;
  registration: any;
  extraVariables?: Record<string, unknown>;
  retryOnlyIfFailed?: boolean;
}) {
  const config = getNotificationConfig(options.type);
  const campaign = options.campaign;
  const registration = options.registration;
  const tenantId = Number(campaign?.tenant?.id || campaign?.tenant || 0);
  const registrationId = Number(registration?.id || 0);
  const campaignId = Number(campaign?.id || 0);
  const recipientEmail = ensureEmail(registration?.email);

  if (!config.allowRepeat) {
    const sentLog = await findSuccessfulNotificationLogForRegistration(tenantId, registrationId, config.mailType);
    if (sentLog?.id) {
      return {
        ok: true,
        emailSent: false,
        skipped: true,
        reason: 'already_sent',
        mailLogId: sentLog.id,
        templateCode: normalizeCode(sentLog?.metadata?.templateCode || ''),
        emailError: null,
        errorCode: null,
        errorMessage: null,
        usedFallback: false,
      };
    }
  }

  if (options.retryOnlyIfFailed === true) {
    const latestLog = await findLatestNotificationLogForRegistration(tenantId, registrationId, config.mailType);
    const latestStatus = normalizeText(latestLog?.sendStatus).toUpperCase();
    if (!latestLog?.id || latestStatus !== 'FAILED') {
      httpError(409, 'Email is not eligible for retry', 'EMAIL_RETRY_NOT_ALLOWED');
    }
  }

  const resolvedTemplate = await resolveNotificationTemplateForType(campaign, options.type);
  if (!resolvedTemplate.template?.id) {
    const failedLog = await createFailedNotificationMailLog({
      tenantId,
      campaignId,
      registrationId,
      mailType: config.mailType,
      recipientEmail,
      errorCode: resolvedTemplate.errorCode || config.missingTemplateCode,
      errorMessage: resolvedTemplate.errorMessage || 'Notification template is not configured',
      metadata: {
        notificationPurpose: options.type,
      },
    });
    return {
      ok: false,
      emailSent: false,
      skipped: false,
      mailLogId: failedLog?.id || null,
      errorCode: resolvedTemplate.errorCode || config.missingTemplateCode,
      errorMessage: resolvedTemplate.errorMessage || 'Notification template is not configured',
      templateCode: null,
      emailError: resolvedTemplate.errorMessage || 'Notification template is not configured',
      usedFallback: false,
    };
  }

  if (resolvedTemplate.errorCode) {
    const failedLog = await createFailedNotificationMailLog({
      tenantId,
      campaignId,
      registrationId,
      mailType: config.mailType,
      recipientEmail,
      errorCode: resolvedTemplate.errorCode,
      errorMessage: resolvedTemplate.errorMessage || 'Notification template is invalid',
      template: resolvedTemplate.template,
      metadata: {
        notificationPurpose: options.type,
      },
    });
    return {
      ok: false,
      emailSent: false,
      skipped: false,
      mailLogId: failedLog?.id || null,
      errorCode: resolvedTemplate.errorCode,
      errorMessage: resolvedTemplate.errorMessage || 'Notification template is invalid',
      templateCode: normalizeCode(resolvedTemplate.template?.code),
      emailError: resolvedTemplate.errorMessage || 'Notification template is invalid',
      usedFallback: false,
    };
  }

  const payload = await buildCampaignNotificationPayload(options.type, options.ctx, campaign, registration, options.extraVariables || {});
  const templateService = strapi.service(NOTIFICATION_TEMPLATE_SERVICE_UID) as any;

  try {
    const queued = await templateService.queueTemplateEmail(
      resolvedTemplate.template,
      tenantId,
      recipientEmail,
      payload,
      {
        mailType: config.mailType,
        requiredVariables: config.requiredVariables,
        metadata: {
          campaignId,
          registrationId,
          notificationPurpose: options.type,
        },
      },
    );

    return {
      ok: true,
      emailSent: true,
      skipped: false,
      mailLogId: queued.mailLogId || null,
      templateCode: normalizeCode(resolvedTemplate.template.code),
      errorCode: null,
      errorMessage: null,
      emailError: null,
      usedFallback: normalizeCode(resolvedTemplate.template.code) === normalizeCode(config.fallbackCode),
    };
  } catch (error) {
    const normalized = normalizeNotificationError(options.type, error);
    const failedLog = await createFailedNotificationMailLog({
      tenantId,
      campaignId,
      registrationId,
      mailType: config.mailType,
      recipientEmail,
      errorCode: normalized.code,
      errorMessage: normalized.message,
      template: resolvedTemplate.template,
      metadata: {
        notificationPurpose: options.type,
      },
    });
    return {
      ok: false,
      emailSent: false,
      skipped: false,
      mailLogId: failedLog?.id || null,
      templateCode: normalizeCode(resolvedTemplate.template?.code),
      errorCode: normalized.code,
      errorMessage: normalized.message,
      emailError: normalized.message,
      usedFallback: false,
    };
  }
}

async function resolveCampaignTemplateForPurpose(campaign: any, fieldName: string, fallbackCode?: string | null) {
  const tenantId = Number(campaign?.tenant?.id || campaign?.tenant || 0);
  const templateService = strapi.service(NOTIFICATION_TEMPLATE_SERVICE_UID) as any;
  const selected = campaign?.[fieldName]?.id
    ? await templateService.findTenantTemplateByRef(tenantId, campaign[fieldName].id, { selectContent: true })
    : null;

  if (selected?.id && selected.isActive !== false && normalizeStatus(selected.type) === 'email') {
    return {
      template: selected,
      usedFallback: false,
    };
  }

  const normalizedFallbackCode = normalizeCode(fallbackCode);
  if (normalizedFallbackCode) {
    const fallbackTemplate = await templateService.findActiveTenantTemplateByCode(tenantId, normalizedFallbackCode, { selectContent: true });
    if (fallbackTemplate?.id) {
      return {
        template: fallbackTemplate,
        usedFallback: true,
      };
    }
  }

  return {
    template: null,
    usedFallback: false,
  };
}

async function sendCampaignTemplateEmail(options: {
  ctx: any;
  campaign: any;
  registration: any;
  fieldName: string;
  fallbackCode?: string | null;
  mailType: string;
  payload: Record<string, unknown>;
  metadata?: Record<string, unknown>;
}) {
  const tenantId = Number(options.campaign?.tenant?.id || options.campaign?.tenant || 0);
  const recipientEmail = normalizeEmail(options.registration?.email);
  const templateService = strapi.service(NOTIFICATION_TEMPLATE_SERVICE_UID) as any;
  const resolved = await resolveCampaignTemplateForPurpose(options.campaign, options.fieldName, options.fallbackCode);

  if (!resolved.template?.id) {
    return {
      emailSent: false,
      emailError: 'Notification template is not configured',
      templateCode: normalizeCode(options.fallbackCode),
      usedFallback: false,
      mailLogId: null,
      configMissing: true,
    };
  }

  const queued = await templateService.queueTemplateEmail(
    resolved.template,
    tenantId,
    recipientEmail,
    options.payload,
    {
      mailType: options.mailType,
      metadata: {
        ...(options.metadata || {}),
        campaignId: options.campaign?.id || null,
        registrationId: options.registration?.id || null,
        usedFallbackTemplate: resolved.usedFallback,
      },
    },
  );

  return {
    emailSent: true,
    emailError: null,
    templateCode: normalizeCode(resolved.template.code),
    usedFallback: resolved.usedFallback,
    mailLogId: queued.mailLogId || null,
    configMissing: false,
  };
}

async function buildCompletionEmailPayload(ctx: any, campaign: any, registration: any) {
  return {
    email: normalizeEmail(registration?.email),
    fullName: normalizeText(registration?.fullName) || normalizeEmail(registration?.email),
    campaignName: normalizeText(campaign?.name) || 'campaign',
    tenantName: normalizeText(campaign?.tenant?.name) || normalizeText(campaign?.tenant?.shortName) || 'COGI',
    featureName: normalizeText(campaign?.targetFeature) || 'feature',
    featureUrl: await buildFeatureUrl(ctx, campaign),
    loginUrl: await buildLoginUrl(ctx, campaign),
    supportEmail: buildCampaignSupportEmail(campaign),
  };
}

async function sendCompletionEmail(ctx: any, campaign: any, registration: any) {
  return sendCampaignRegistrationNotification({
    type: 'completion',
    ctx,
    campaign,
    registration,
  });
}

async function sendRejectionEmail(ctx: any, campaign: any, registration: any, reason: string | null) {
  return sendCampaignRegistrationNotification({
    type: 'rejection',
    ctx,
    campaign,
    registration,
    extraVariables: {
      rejectionReason: normalizeText(reason) || 'Thong tin dang ky chua phu hop.',
    },
  });
}

async function sendVerificationEmail(ctx: any, campaign: any, registration: any, rawToken: string) {
  const verificationLink = await buildVerificationLink(ctx, rawToken, campaign);
  const verificationExpiresAt = formatNotificationDateTime(registration?.verificationExpiresAt);
  return sendCampaignRegistrationNotification({
    type: 'verification',
    ctx,
    campaign,
    registration,
    extraVariables: {
      verificationUrl: verificationLink,
      verificationExpiresAt,
    },
  });
}

async function upsertVerificationState(ctx: any, campaign: any, registrationId: number) {
  const verificationExpireMinutes = Number(campaign?.verificationExpireMinutes || 1440) || 1440;
  const rawToken = generateOpaqueToken(32);
  const now = new Date();
  const verificationExpiresAt = new Date(now.getTime() + verificationExpireMinutes * 60 * 1000);

  const updated = await strapi.db.query(CAMPAIGN_REGISTRATION_UID).update({
    where: { id: registrationId },
    data: {
      verificationTokenHash: sha256(rawToken),
      verificationExpiresAt,
      verificationSentAt: now,
      lastVerificationRequestAt: now,
      verificationSendCount: Number((campaign as any)?.verificationSendCount || 0),
    },
  });

  return {
    registration: updated,
    rawToken,
    verificationExpiresAt,
  };
}

async function refreshVerificationState(ctx: any, campaign: any, registration: any) {
  const verificationExpireMinutes = Number(campaign?.verificationExpireMinutes || 1440) || 1440;
  const rawToken = generateOpaqueToken(32);
  const now = new Date();
  const verificationExpiresAt = new Date(now.getTime() + verificationExpireMinutes * 60 * 1000);
  const sendCount = Number(registration?.verificationSendCount || 0) + 1;

  await strapi.db.query(CAMPAIGN_REGISTRATION_UID).update({
    where: { id: registration.id },
    data: {
      verificationTokenHash: sha256(rawToken),
      verificationExpiresAt,
      verificationSentAt: now,
      lastVerificationRequestAt: now,
      verificationSendCount: sendCount,
      status: 'pending_verification',
      emailChangedAt: null,
    },
  });

  const freshRegistration = await strapi.db.query(CAMPAIGN_REGISTRATION_UID).findOne({
    where: { id: registration.id },
    populate: {
      campaign: {
        populate: {
          tenant: {
            select: ['id', 'name', 'code', 'shortName', 'slogan'],
          },
        },
      },
    },
  });

  const notification = await sendVerificationEmail(ctx, campaign, freshRegistration, rawToken);
  return {
    registration: freshRegistration,
    notification,
    verificationExpiresAt,
  };
}

async function findFeatureByKey(featureKey: string) {
  return strapi.db.query(FEATURE_UID).findOne({
    where: {
      key: {
        $eq: featureKey,
      },
    },
    select: ['id', 'key', 'name', 'path'],
  });
}

async function findAssignableRoleForFeature(tenantId: number, featureKey: string) {
  const feature = await findFeatureByKey(featureKey);
  if (!feature?.id) {
    httpError(400, `Target feature \"${featureKey}\" was not found`);
  }

  const tenantFeature = await strapi.db.query(TENANT_FEATURE_UID).findOne({
    where: {
      tenant: tenantId,
      feature: feature.id,
      isEnabled: true,
    },
    select: ['id'],
  });

  if (!tenantFeature?.id) {
    httpError(400, `Feature \"${featureKey}\" is not enabled for this tenant`);
  }

  const tenantRoles = await strapi.db.query(TENANT_ROLE_UID).findMany({
    where: {
      tenant: tenantId,
      isActive: true,
    },
    populate: {
      role: {
        select: ['id', 'name', 'type', 'description'],
      },
    },
  });

  const roleIds = (tenantRoles || [])
    .map((row: any) => Number(row?.role?.id || row?.role || 0))
    .filter((value: number) => Number.isInteger(value) && value > 0);

  if (roleIds.length === 0) {
    httpError(400, 'No active tenant roles are available for this tenant');
  }

  const roleFeatures = await strapi.db.query(ROLE_FEATURE_UID).findMany({
    where: {
      role: {
        id: {
          $in: roleIds,
        },
      },
      feature: feature.id,
      isActive: true,
    },
    populate: {
      role: {
        select: ['id', 'name', 'type', 'description'],
      },
      feature: {
        select: ['id', 'key', 'name'],
      },
    },
  });

  const candidates = (roleFeatures || [])
    .map((row: any) => row?.role)
    .filter((role: any) => Number(role?.id || 0) > 0)
    .sort((left: any, right: any) => {
      const leftRank = rolePriority(left);
      const rightRank = rolePriority(right);
      if (leftRank !== rightRank) return leftRank - rightRank;
      return Number(left?.id || 0) - Number(right?.id || 0);
    });

  if (candidates.length === 0) {
    httpError(400, `No active tenant role grants feature \"${featureKey}\"`);
  }

  return {
    feature,
    role: candidates[0],
  };
}

async function activateMembershipIfNeeded(userTenantId: number) {
  const membership = await strapi.db.query(USER_TENANT_UID).findOne({
    where: { id: userTenantId },
    select: ['id', 'userTenantStatus'],
  });

  if (!membership?.id || membership.userTenantStatus === 'active') {
    return membership;
  }

  return strapi.db.query(USER_TENANT_UID).update({
    where: { id: userTenantId },
    data: {
      userTenantStatus: 'active',
      leftAt: null,
      joinedAt: new Date(),
    },
  });
}

async function ensureRoleForMembership(userTenantId: number, roleId: number) {
  const existingAssignment = await strapi.db.query(USER_TENANT_ROLE_UID).findOne({
    where: {
      userTenant: userTenantId,
      role: roleId,
    },
    select: ['id', 'userTenantRoleStatus'],
  });

  if (existingAssignment?.id) {
    if (existingAssignment.userTenantRoleStatus !== 'active') {
      await strapi.db.query(USER_TENANT_ROLE_UID).update({
        where: { id: existingAssignment.id },
        data: {
          userTenantRoleStatus: 'active',
          revokedAt: null,
        },
      });
    }

    return existingAssignment.id;
  }

  const activeRoleCount = await strapi.db.query(USER_TENANT_ROLE_UID).count({
    where: {
      userTenant: userTenantId,
      userTenantRoleStatus: 'active',
    },
  });

  const created = await strapi.db.query(USER_TENANT_ROLE_UID).create({
    data: {
      userTenant: userTenantId,
      role: roleId,
      userTenantRoleStatus: 'active',
      assignedAt: new Date(),
      isPrimary: Number(activeRoleCount) === 0,
    },
  });

  return created.id;
}

async function createOrRefreshActivationToken(userId: number) {
  const token = generateOpaqueToken(48);
  const expiresAt = new Date(Date.now() + ACTIVATION_TOKEN_TTL_MS);

  const existing = await strapi.db.query(ACTIVATION_TOKEN_UID).findOne({
    where: { user: userId },
    select: ['id'],
  });

  if (existing?.id) {
    await strapi.db.query(ACTIVATION_TOKEN_UID).update({
      where: { id: existing.id },
      data: {
        token,
        expiresAt,
        usedAt: null,
        note: 'registration_campaign',
      },
    });
  } else {
    await strapi.db.query(ACTIVATION_TOKEN_UID).create({
      data: {
        token,
        expiresAt,
        usedAt: null,
        user: userId,
        note: 'registration_campaign',
      },
    });
  }

  return {
    token,
    expiresAt,
  };
}

async function createOrLinkUserForApprovedRegistration(ctx: any, registration: any, campaign: any) {
  const tenantId = Number(campaign?.tenant?.id || campaign?.tenant || 0);
  const email = ensureEmail(registration?.email);
  const phone = normalizePhone(registration?.phone);
  const fullName = ensureRequiredText(registration?.fullName, 'fullName');
  const targetFeature = ensureRequiredText(campaign?.targetFeature, 'targetFeature');
  const roleSelection = await findAssignableRoleForFeature(tenantId, targetFeature);
  const roleId = Number(roleSelection.role.id);
  const roleName = normalizeText(roleSelection.role.name) || normalizeText(roleSelection.role.type) || `Role #${roleId}`;

  let user = await strapi.db.query(USER_UID).findOne({
    where: {
      email: {
        $eqi: email,
      },
    },
    select: ['id', 'email', 'fullName', 'phone', 'confirmed', 'blocked', 'provider'],
  });

  if (user?.blocked) {
    httpError(409, 'The existing account for this email is blocked');
  }

  let userId = Number(user?.id || 0);
  let userTenantId = Number(registration?.membership?.id || registration?.membership || 0);
  let activationToken: string | null = null;
  let activationExpiresAt: string | null = null;
  let activationEmailSent = false;
  let activationEmailError: string | null = null;
  let inviteTemplateCode: string | null = null;
  let inviteUsedFallback = false;
  let membershipStatus = 'active';
  let isNewUser = false;

  if (!userId) {
    isNewUser = true;
    const password = generateOpaqueToken(24);
    const createdUser = await strapi.plugin('users-permissions').service('user').add({
      email,
      username: email,
      provider: 'local',
      fullName,
      phone: phone || undefined,
      confirmed: false,
      blocked: false,
      password,
    });

    userId = Number(createdUser.id);
    user = await strapi.db.query(USER_UID).findOne({
      where: { id: userId },
      select: ['id', 'email', 'fullName', 'phone', 'confirmed', 'blocked', 'provider'],
    });
  }

  await updateUserPhoneIfEmpty(userId, phone);
  await ensureUserHasAuthenticatedRole(strapi, userId);

  const userConfirmed = Boolean(user?.confirmed);
  membershipStatus = userConfirmed ? 'active' : 'pending';

  if (!userTenantId) {
    const existingMembership = await checkUserTenantExists(userId, tenantId);
    if (existingMembership.exists) {
      userTenantId = Number(existingMembership.userTenant?.id || 0);
    }
  }

  if (!userTenantId) {
    const createdMembership = await createUserTenant(userId, tenantId, membershipStatus as 'active' | 'pending');
    userTenantId = Number(createdMembership.id);
  }

  if (userConfirmed) {
    await activateMembershipIfNeeded(userTenantId);
  }

  // TODO(registration-campaign): use campaign.defaultTenantRole when completing an approved registration.
  await ensureRoleForMembership(userTenantId, roleId);

  if (!userConfirmed) {
    const activationState = await createOrRefreshActivationToken(userId);
    activationToken = activationState.token;
    activationExpiresAt = activationState.expiresAt.toISOString();

    const notification = await sendInviteNotification({
      email,
      fullName,
      tenantId,
      tenantName: normalizeText(campaign?.tenant?.name),
      tenantCode: normalizeText(campaign?.tenant?.code),
      roleName,
      link: await buildActivationLink(ctx, activationToken, { tenantId }),
      invitePurpose: 'tenant',
      templateCode: 'tenant_invite',
    });

    activationEmailSent = notification.emailSent;
    activationEmailError = notification.emailError || null;
    inviteTemplateCode = notification.templateCode;
    inviteUsedFallback = notification.usedFallback;
  }

  return {
    userId,
    userTenantId,
    roleId,
    roleName,
    featureKey: normalizeText(roleSelection.feature.key),
    featureName: normalizeText(roleSelection.feature.name),
    isNewUser,
    activationRequired: !userConfirmed,
    activationToken,
    activationExpiresAt,
    activationEmailSent,
    activationEmailError,
    inviteTemplateCode,
    inviteUsedFallback,
    membershipStatus,
  };
}

async function approveRegistrationInternal(ctx: any, registration: any, actor: AuthUser | null) {
  if (!registration?.id) {
    httpError(404, 'Registration not found');
  }

  const currentStatus = normalizeStatus(registration.status);
  if (currentStatus === 'approved') {
    return {
      registration,
      approval: {
        alreadyApproved: true,
        activationRequired: !Boolean(registration?.user?.confirmed),
        activationEmailSent: false,
        activationEmailError: null,
        inviteTemplateCode: null,
        inviteUsedFallback: false,
      },
    };
  }

  if (currentStatus === 'rejected' || currentStatus === 'cancelled') {
    httpError(409, 'Only verified or pending registrations can be approved');
  }

  if (currentStatus === 'pending_verification' && registration?.campaign?.verificationRequired !== false) {
    httpError(409, 'Registration email has not been verified yet');
  }

  const approval = await createOrLinkUserForApprovedRegistration(ctx, registration, registration.campaign);
  const now = new Date();
  await strapi.db.query(CAMPAIGN_REGISTRATION_UID).update({
    where: { id: registration.id },
    data: {
      status: 'approved',
      approvedAt: now,
      approvedBy: actor?.id || null,
      rejectedAt: null,
      rejectedBy: null,
      rejectionReason: null,
      cancelledAt: null,
      user: approval.userId,
      membership: approval.userTenantId,
      metadata: buildSafeMetadata(registration.metadata, {
        targetFeature: approval.featureKey,
        targetFeatureName: approval.featureName,
        targetRoleId: approval.roleId,
        targetRoleName: approval.roleName,
        activationRequired: approval.activationRequired,
        activationEmailSent: approval.activationEmailSent,
        activationInviteTemplateCode: approval.inviteTemplateCode,
      }),
    },
  });

  const freshRegistration = await strapi.db.query(CAMPAIGN_REGISTRATION_UID).findOne({
    where: { id: registration.id },
    populate: {
      campaign: true,
      user: {
        select: ['id', 'email', 'fullName', 'confirmed'],
      },
      membership: {
        select: ['id', 'userTenantStatus'],
      },
      approvedBy: {
        select: ['id', 'email'],
      },
    },
  });

  return {
    registration: freshRegistration,
    approval,
  };
}

function buildRegistrationSummary(registration: any) {
  return {
    id: registration?.id,
    status: normalizeStatus(registration?.status) || 'pending_verification',
    email: normalizeEmail(registration?.email),
    maskedEmail: maskEmail(normalizeEmail(registration?.email)),
    fullName: normalizeText(registration?.fullName),
    phone: normalizePhone(registration?.phone) || null,
    registeredAt: registration?.registeredAt || null,
    verifiedAt: registration?.verifiedAt || null,
    approvedAt: registration?.approvedAt || null,
    rejectedAt: registration?.rejectedAt || null,
    cancelledAt: registration?.cancelledAt || null,
    emailChangedAt: registration?.emailChangedAt || null,
    verificationExpiresAt: registration?.verificationExpiresAt || null,
    verificationSentAt: registration?.verificationSentAt || null,
    verificationSendCount: Number(registration?.verificationSendCount || 0),
    userId: Number(registration?.user?.id || registration?.user || 0) || null,
    membershipId: Number(registration?.membership?.id || registration?.membership || 0) || null,
  };
}

function buildDeferredCompletionResponse(registration: any, campaign: any, error: unknown) {
  const message = error instanceof Error ? error.message : 'Không thể hoàn tất đăng ký lúc này.';
  const code = error instanceof HttpError ? error.code || null : null;

  return {
    ok: true,
    status: 'verified',
    nextAction: 'await_support',
    completionBlocked: true,
    completionError: message,
    completionErrorCode: code,
    message: 'Email đã được xác minh nhưng chiến dịch chưa thể hoàn tất tự động. Vui lòng liên hệ quản trị viên để được hỗ trợ.',
    registration: buildRegistrationSummary(registration),
    redirectPath: assertInternalRedirectPath(buildRedirectPathForTargetFeature(campaign)),
    redirectUrl: null,
  };
}

export async function getPublicRegistrationCampaignByCode(tenantId: number | string, campaignCode: string) {
  const campaign = await findCampaignByCode(tenantId, normalizeCode(campaignCode));
  if (!campaign?.id) {
    httpError(404, 'Registration campaign not found');
  }
  return toPublicCampaign(campaign);
}

export async function registerToCampaign(ctx: any, tenantId: number | string, campaignCode: string, payload: Record<string, unknown>) {
  const campaign = await findCampaignByCode(tenantId, normalizeCode(campaignCode));
  ensureCampaignOpenForRegistration(campaign);

  const validatedInput = validateRegistrationInput(campaign, payload);
  if (validatedInput.errors.length > 0) {
    httpError(400, validatedInput.errors[0]);
  }

  const fullName = validatedInput.fullName;
  const email = validatedInput.email;
  const phone = validatedInput.phone;
  const formData = validatedInput.formData;
  const termsAccepted = Boolean(payload.termsAccepted);

  if (campaign.requireTermsAcceptance && !termsAccepted) {
    httpError(400, 'termsAccepted must be true');
  }

  const latestRegistration = await findLatestRegistrationByCampaignAndEmail(Number(campaign.id), email);
  const latestStatus = normalizeStatus(latestRegistration?.status);

  if (latestStatus === 'pending_verification') {
    const registrationToken = buildPublicAccessToken(latestRegistration, campaign);
    const lastRequestedAt = toDateOrNull(latestRegistration.lastVerificationRequestAt);

    if (!lastRequestedAt || Date.now() - lastRequestedAt.getTime() >= RESEND_COOLDOWN_MS) {
      const refreshed = await refreshVerificationState(ctx, campaign, latestRegistration);
      return {
        ok: true,
        status: 'pending_verification',
        nextAction: 'check_email',
        registrationCreated: false,
        verificationRequired: true,
        verificationEmailSent: refreshed.notification.emailSent === true,
        emailSent: refreshed.notification.emailSent,
        emailError: refreshed.notification.emailError || null,
        emailErrorCode: refreshed.notification.errorCode || null,
        message: refreshed.notification.emailSent === true
          ? 'Đăng ký đã tồn tại và đang chờ xác minh email.'
          : 'Đăng ký đã được ghi nhận nhưng chưa thể gửi email xác minh. Vui lòng thử gửi lại.',
        maskedEmail: maskEmail(email),
        registrationToken,
        checkEmailPath: buildCheckEmailPath(campaign, latestRegistration, registrationToken),
        registration: buildRegistrationSummary(latestRegistration),
      };
    }

    return {
      ok: true,
      status: 'pending_verification',
      nextAction: 'check_email',
      registrationCreated: false,
      verificationRequired: true,
      verificationEmailSent: null,
      message: 'Đăng ký đã tồn tại và đang chờ xác minh email.',
      maskedEmail: maskEmail(email),
      registrationToken,
      checkEmailPath: buildCheckEmailPath(campaign, latestRegistration, registrationToken),
      registration: buildRegistrationSummary(latestRegistration),
    };
  }

  if (latestStatus === 'approved') {
    return {
      ok: true,
      status: 'approved',
      nextAction: 'completed',
      message: 'Bạn đã hoàn tất đăng ký chiến dịch này.',
      redirectPath: assertInternalRedirectPath(buildRedirectPathForTargetFeature(campaign)),
      registration: buildRegistrationSummary(latestRegistration),
    };
  }

  if (latestStatus === 'verified' && !campaign.autoApprove) {
    return {
      ok: true,
      status: 'verified',
      requireApproval: true,
      nextAction: 'await_approval',
      message: 'Đăng ký đã được xác minh và đang chờ phê duyệt.',
      registration: buildRegistrationSummary(latestRegistration),
    };
  }

  if (['rejected', 'cancelled', 'expired'].includes(latestStatus)) {
    return {
      ok: true,
      status: latestStatus,
      nextAction: 'contact_admin',
      message: latestStatus === 'expired'
        ? 'Đăng ký trước đó đã hết hạn. Hãy yêu cầu gửi lại email hoặc liên hệ quản trị viên.'
        : 'Đăng ký này hiện không thể tiếp tục. Vui lòng liên hệ quản trị viên để được hỗ trợ.',
      registration: buildRegistrationSummary(latestRegistration),
    };
  }

  if (!latestRegistration) {
    await ensureCampaignCapacity(campaign);
  }

  const now = new Date();
  const baseData: Record<string, unknown> = {
    tenant: Number(campaign.tenant?.id || campaign.tenant || 0),
    campaign: Number(campaign.id),
    fullName,
    email,
    phone,
    formData,
    registeredAt: now,
    registrationSource: pickRegistrationSource(campaign, payload.registrationSource),
    termsAccepted,
    termsAcceptedAt: termsAccepted ? now : null,
    metadata: buildSafeMetadata(latestRegistration?.metadata, {
      targetFeature: normalizeText(campaign.targetFeature),
      campaignCode: normalizeCode(campaign.code),
    }),
  };

  const verificationRequired = campaign.verificationRequired !== false && normalizeStatus(campaign.verificationMethod) !== 'none';
  const verificationMethod = normalizeStatus(campaign.verificationMethod) || 'email_link';

  if (verificationRequired && verificationMethod !== 'email_link') {
    httpError(400, `verificationMethod \"${verificationMethod}\" is not supported yet`);
  }

  let registration: any = null;
  if (latestRegistration && latestStatus === 'pending_verification') {
    registration = await strapi.db.query(CAMPAIGN_REGISTRATION_UID).update({
      where: { id: latestRegistration.id },
      data: {
        ...baseData,
        status: 'pending_verification',
        verifiedAt: null,
        approvedAt: null,
        approvedBy: null,
        rejectedAt: null,
        rejectedBy: null,
        rejectionReason: null,
        cancelledAt: null,
      },
    });
  } else {
    registration = await strapi.db.query(CAMPAIGN_REGISTRATION_UID).create({
      data: {
        ...baseData,
        status: verificationRequired ? 'pending_verification' : 'verified',
        verifiedAt: verificationRequired ? null : now,
      },
    });
  }

  if (!verificationRequired) {
    const freshRegistration = await findRegistrationById(Number(registration.id), tenantId);
    if (campaign.autoApprove) {
      const currentUser = await resolveUserFromJwt(ctx);
      if (currentUser?.id && normalizeEmail(currentUser.email) === email) {
        const result = await completeCampaignRegistration(ctx, freshRegistration, currentUser, null);
        return {
          ok: true,
          status: 'approved',
          nextAction: 'completed',
          message: 'Bạn đã tham gia chiến dịch thành công.',
          redirectPath: result.redirectPath,
          registration: buildRegistrationSummary(result.registration),
        };
      }

      const existingUser = await strapi.db.query(USER_UID).findOne({
        where: {
          email: {
            $eqi: email,
          },
        },
        select: ['id', 'email', 'confirmed', 'blocked'],
      });

      if (existingUser?.id) {
        const completionToken = buildCompletionToken(freshRegistration, campaign);
        return {
          ok: true,
          status: 'requires_login',
          nextAction: 'login',
          message: 'Email này đã có tài khoản. Hãy đăng nhập để hoàn tất tham gia chiến dịch.',
          completionToken,
          loginPath: buildLoginPath(campaign, completionToken),
          completePath: buildCompletePath(campaign, completionToken),
          registration: buildRegistrationSummary(freshRegistration),
        };
      }

      const completionToken = buildCompletionToken(freshRegistration, campaign);
      return {
        ok: true,
        status: 'requires_account_setup',
        nextAction: 'complete_account',
        message: 'Email đã được xác minh. Hãy đặt mật khẩu để hoàn tất tài khoản.',
        completionToken,
        completeAccountPath: buildCompleteAccountPath(campaign, completionToken),
        registration: buildRegistrationSummary(freshRegistration),
      };
    }

    await strapi.db.query(CAMPAIGN_REGISTRATION_UID).update({
      where: { id: registration.id },
      data: { status: 'verified' },
    });

    const verifiedRegistration = await findRegistrationById(Number(registration.id), tenantId);
    return {
      ok: true,
      status: 'verified',
      requireApproval: true,
      nextAction: 'await_approval',
      message: 'Email đã được xác minh. Đăng ký của bạn đang chờ phê duyệt.',
      registration: buildRegistrationSummary(verifiedRegistration),
    };
  }

  const refreshed = await refreshVerificationState(ctx, campaign, registration);
  const registrationToken = buildPublicAccessToken(refreshed.registration, campaign);

  return {
    ok: true,
    status: 'pending_verification',
    nextAction: 'check_email',
    registrationCreated: true,
    verificationRequired: true,
    verificationMethod: 'email_link',
    verificationEmailSent: refreshed.notification.emailSent === true,
    emailSent: refreshed.notification.emailSent,
    emailError: refreshed.notification.emailError || null,
    emailErrorCode: refreshed.notification.errorCode || null,
    notificationTemplateCode: refreshed.notification.templateCode,
    notificationUsedFallback: refreshed.notification.usedFallback,
    message: refreshed.notification.emailSent === true
      ? 'Đăng ký đã được ghi nhận. Vui lòng kiểm tra email để xác minh.'
      : 'Đăng ký đã được ghi nhận nhưng chưa thể gửi email xác minh. Vui lòng thử gửi lại.',
    maskedEmail: maskEmail(email),
    registrationToken,
    checkEmailPath: buildCheckEmailPath(campaign, refreshed.registration, registrationToken),
    registration: buildRegistrationSummary(refreshed.registration),
  };
}

export async function resendRegistrationVerification(ctx: any, tenantId: number | string, payload: Record<string, unknown>) {
  let campaign: any = null;
  let registration: any = null;

  if (payload.registrationToken) {
    const tokenResult = await findRegistrationBySignedToken(String(payload.registrationToken), 'registration_access');
    campaign = tokenResult.campaign;
    registration = tokenResult.registration;
  } else {
    const campaignCode = ensureRequiredText(payload.campaignCode, 'campaignCode');
    const email = ensureEmail(payload.email);
    campaign = await findCampaignByCode(tenantId, normalizeCode(campaignCode));
    ensureCampaignVisible(campaign);
    registration = await findLatestRegistrationByCampaignAndEmail(Number(campaign.id), email);
  }

  if (!registration?.id) {
    return {
      ok: true,
      message: 'If a pending registration exists, a new verification email has been sent.',
    };
  }

  const status = normalizeStatus(registration.status);
  if (status !== 'pending_verification' && status !== 'expired') {
    return {
      ok: true,
      message: 'If a pending registration exists, a new verification email has been sent.',
    };
  }

  const lastRequestedAt = toDateOrNull(registration.lastVerificationRequestAt);
  if (lastRequestedAt && Date.now() - lastRequestedAt.getTime() < RESEND_COOLDOWN_MS) {
    httpError(429, 'Please wait before requesting another verification email');
  }

  const refreshed = await refreshVerificationState(ctx, campaign, registration);
  return {
    ok: true,
    status: 'pending_verification',
    nextAction: 'check_email',
    verificationEmailSent: refreshed.notification.emailSent === true,
    emailSent: refreshed.notification.emailSent,
    emailError: refreshed.notification.emailError || null,
    emailErrorCode: refreshed.notification.errorCode || null,
    notificationTemplateCode: refreshed.notification.templateCode,
    notificationUsedFallback: refreshed.notification.usedFallback,
    message: refreshed.notification.emailSent === true
      ? 'Nếu có đăng ký đang chờ, hệ thống đã gửi lại email xác minh.'
      : 'Đăng ký vẫn được giữ lại nhưng chưa thể gửi email xác minh. Vui lòng thử lại sau.',
    maskedEmail: maskEmail(normalizeEmail(registration.email)),
    registrationToken: buildPublicAccessToken(refreshed.registration, campaign),
  };
}

export async function changeRegistrationEmail(ctx: any, tenantId: number | string, payload: Record<string, unknown>) {
  const newEmail = ensureEmail(payload.newEmail || payload.email, 'newEmail');
  let campaign: any = null;
  let registration: any = null;
  let currentEmail = '';

  if (payload.registrationToken) {
    const tokenResult = await findRegistrationBySignedToken(String(payload.registrationToken), 'registration_access');
    campaign = tokenResult.campaign;
    registration = tokenResult.registration;
    currentEmail = normalizeEmail(registration.email);
  } else {
    const campaignCode = ensureRequiredText(payload.campaignCode, 'campaignCode');
    currentEmail = ensureEmail(payload.currentEmail, 'currentEmail');
    campaign = await findCampaignByCode(tenantId, normalizeCode(campaignCode));
    ensureCampaignVisible(campaign);
    registration = await findLatestRegistrationByCampaignAndEmail(Number(campaign.id), currentEmail);
  }

  if (currentEmail === newEmail) {
    httpError(400, 'newEmail must be different from currentEmail');
  }

  const existingOnNewEmail = await findLatestRegistrationByCampaignAndEmail(Number(campaign.id), newEmail);
  if (normalizeStatus(existingOnNewEmail?.status) === 'approved') {
    httpError(409, 'The new email is already approved for this campaign');
  }

  if (!registration?.id) {
    return {
      ok: true,
      message: 'If a pending registration exists, the verification email has been updated and resent.',
    };
  }

  const status = normalizeStatus(registration.status);
  if (status !== 'pending_verification' && status !== 'expired') {
    httpError(409, 'Only pending registrations can change email');
  }

  await strapi.db.query(CAMPAIGN_REGISTRATION_UID).update({
    where: { id: registration.id },
    data: {
      email: newEmail,
      emailChangedAt: new Date(),
      verifiedAt: null,
      status: 'pending_verification',
      user: null,
      membership: null,
    },
  });

  const freshRegistration = await findLatestRegistrationByCampaignAndEmail(Number(campaign.id), newEmail);
  const refreshed = await refreshVerificationState(ctx, campaign, freshRegistration);

  return {
    ok: true,
    status: 'pending_verification',
    nextAction: 'check_email',
    verificationEmailSent: refreshed.notification.emailSent === true,
    emailSent: refreshed.notification.emailSent,
    emailError: refreshed.notification.emailError || null,
    emailErrorCode: refreshed.notification.errorCode || null,
    notificationTemplateCode: refreshed.notification.templateCode,
    notificationUsedFallback: refreshed.notification.usedFallback,
    message: refreshed.notification.emailSent === true
      ? 'Email xác minh đã được gửi tới địa chỉ mới.'
      : 'Đã cập nhật email nhưng chưa thể gửi thư xác minh. Vui lòng thử lại sau.',
    maskedEmail: maskEmail(newEmail),
    registrationToken: buildPublicAccessToken(refreshed.registration, campaign),
    registration: buildRegistrationSummary(refreshed.registration),
  };
}

export async function verifyRegistrationEmail(ctx: any, token: string) {
  const normalizedToken = normalizeText(token);
  if (!normalizedToken) {
    httpError(400, 'token is required');
  }

  const registration = await strapi.db.query(CAMPAIGN_REGISTRATION_UID).findOne({
    where: {
      verificationTokenHash: sha256(normalizedToken),
      ...getNonDeletedWhere(),
    },
    populate: {
      campaign: {
        populate: {
          tenant: {
            select: ['id', 'name', 'code', 'shortName', 'slogan'],
          },
          defaultTenantRole: {
            select: ['id', 'name', 'description', 'type'],
          },
          verificationNotificationTemplate: {
            select: ['id', 'documentId', 'code', 'name', 'subject', 'content', 'type', 'isActive', 'variables'],
          },
          completionNotificationTemplate: {
            select: ['id', 'documentId', 'code', 'name', 'subject', 'content', 'type', 'isActive', 'variables'],
          },
          rejectionNotificationTemplate: {
            select: ['id', 'documentId', 'code', 'name', 'subject', 'content', 'type', 'isActive', 'variables'],
          },
        },
      },
      user: {
        select: ['id', 'email', 'fullName', 'confirmed', 'blocked', 'provider'],
      },
      membership: {
        select: ['id', 'userTenantStatus'],
      },
    },
  });

  if (!registration?.id) {
    httpError(400, 'Invalid verification token');
  }

  const campaign = registration.campaign;
  ensureCampaignVisible(campaign);

  const currentStatus = normalizeStatus(registration.status);
  if (currentStatus === 'approved') {
    return {
      ok: true,
      status: 'approved',
      message: 'Đăng ký này đã được hoàn tất trước đó.',
      registration: buildRegistrationSummary(registration),
      redirectPath: normalizePath(campaign.redirectPath),
    };
  }

  if (currentStatus === 'rejected' || currentStatus === 'cancelled') {
    httpError(409, 'Registration is no longer active');
  }

  if (isVerificationExpired(registration)) {
    await strapi.db.query(CAMPAIGN_REGISTRATION_UID).update({
      where: { id: registration.id },
      data: {
        status: 'expired',
      },
    });
    httpError(410, 'Verification token has expired');
  }

  if (currentStatus === 'pending_verification') {
    await strapi.db.query(CAMPAIGN_REGISTRATION_UID).update({
      where: { id: registration.id },
      data: {
        status: 'verified',
        verifiedAt: new Date(),
      },
    });
  }

  const verifiedRegistration = await strapi.db.query(CAMPAIGN_REGISTRATION_UID).findOne({
    where: { id: registration.id },
    populate: {
      campaign: {
        populate: {
          tenant: {
            select: ['id', 'name', 'code', 'shortName', 'slogan'],
          },
          defaultTenantRole: {
            select: ['id', 'name', 'description', 'type'],
          },
          verificationNotificationTemplate: {
            select: ['id', 'documentId', 'code', 'name', 'subject', 'content', 'type', 'isActive', 'variables'],
          },
          completionNotificationTemplate: {
            select: ['id', 'documentId', 'code', 'name', 'subject', 'content', 'type', 'isActive', 'variables'],
          },
          rejectionNotificationTemplate: {
            select: ['id', 'documentId', 'code', 'name', 'subject', 'content', 'type', 'isActive', 'variables'],
          },
        },
      },
      user: {
        select: ['id', 'email', 'fullName', 'confirmed', 'blocked', 'provider'],
      },
      membership: {
        select: ['id', 'userTenantStatus'],
      },
    },
  });

  const currentUser = await resolveUserFromJwt(ctx);

  if (!campaign.autoApprove) {
    const redirectUrl = await buildVerificationRedirectUrl(
      ctx,
      verifiedRegistration?.campaign || campaign,
      'success',
      'Email verified successfully. Your registration is waiting for approval.'
    );

    return {
      ok: true,
      status: 'verified',
      requireApproval: true,
      nextAction: 'await_approval',
      message: 'Email đã được xác minh. Đăng ký của bạn đang chờ phê duyệt.',
      registration: buildRegistrationSummary(verifiedRegistration),
      redirectPath: normalizePath(campaign.redirectPath),
      redirectUrl,
    };
  }

  if (currentUser?.id && normalizeEmail(currentUser.email) === normalizeEmail(verifiedRegistration.email)) {
    try {
      const result = await completeCampaignRegistration(ctx, verifiedRegistration, currentUser, null);
      return {
        ok: true,
        status: 'approved',
        nextAction: 'completed',
        message: 'Bạn đã tham gia chiến dịch thành công.',
        registration: buildRegistrationSummary(result.registration),
        redirectPath: result.redirectPath,
        redirectUrl: await buildVerificationRedirectUrl(ctx, verifiedRegistration?.campaign || campaign, 'success', campaign.successMessage || 'Bạn đã tham gia chiến dịch thành công.'),
      };
    } catch (error) {
      const latestRegistration = await findRegistrationById(Number(verifiedRegistration.id), Number(campaign?.tenant?.id || campaign?.tenant || 0));
      return buildDeferredCompletionResponse(latestRegistration || verifiedRegistration, campaign, error);
    }
  }

  const existingUser = await strapi.db.query(USER_UID).findOne({
    where: {
      email: {
        $eqi: verifiedRegistration.email,
      },
    },
    select: ['id', 'email', 'confirmed', 'blocked'],
  });

  const completionToken = buildCompletionToken(verifiedRegistration, campaign);

  if (existingUser?.id) {
    return {
      ok: true,
      status: 'requires_login',
      nextAction: 'login',
      message: 'Email này đã có tài khoản. Hãy đăng nhập để hoàn tất tham gia chiến dịch.',
      completionToken,
      loginPath: buildLoginPath(campaign, completionToken),
      completePath: buildCompletePath(campaign, completionToken),
      redirectPath: assertInternalRedirectPath(buildRedirectPathForTargetFeature(campaign)),
      registration: buildRegistrationSummary(verifiedRegistration),
    };
  }

  return {
    ok: true,
    status: 'requires_account_setup',
    nextAction: 'complete_account',
    message: 'Email đã được xác minh. Hãy đặt mật khẩu để hoàn tất tài khoản.',
    completionToken,
    completeAccountPath: buildCompleteAccountPath(campaign, completionToken),
    registration: buildRegistrationSummary(verifiedRegistration),
    redirectPath: assertInternalRedirectPath(buildRedirectPathForTargetFeature(campaign)),
  };
}

export async function completeRegistrationAccount(ctx: any, payload: Record<string, unknown>) {
  const completionToken = ensureRequiredText(payload.token, 'token');
  const tokenResult = await findRegistrationBySignedToken(completionToken, 'registration_complete');
  const registration = tokenResult.registration;
  const campaign = tokenResult.campaign;

  if (!campaign?.autoApprove) {
    return {
      ok: true,
      status: 'verified',
      nextAction: 'await_approval',
      message: 'Email đã được xác minh. Đăng ký của bạn đang chờ phê duyệt.',
      registration: buildRegistrationSummary(registration),
    };
  }

  const existingUser = await strapi.db.query(USER_UID).findOne({
    where: {
      email: {
        $eqi: registration.email,
      },
    },
    select: ['id', 'email', 'blocked'],
  });
  if (existingUser?.id) {
    return {
      ok: true,
      status: 'requires_login',
      nextAction: 'login',
      message: 'Email này đã có tài khoản. Hãy đăng nhập để hoàn tất tham gia chiến dịch.',
      loginPath: buildLoginPath(campaign, completionToken),
      completePath: buildCompletePath(campaign, completionToken),
      registration: buildRegistrationSummary(registration),
    };
  }

  const fullName = normalizeText(payload.fullName) || normalizeText(registration.fullName);
  const password = typeof payload.password === 'string' ? payload.password : '';
  const passwordConfirmation = typeof payload.passwordConfirmation === 'string' ? payload.passwordConfirmation : '';

  if (!fullName) {
    httpError(400, 'fullName is required');
  }
  if (!password) {
    httpError(400, 'password is required');
  }
  if (password.length < 8) {
    httpError(400, 'password must be at least 8 characters');
  }
  if (password !== passwordConfirmation) {
    httpError(400, 'password confirmation does not match');
  }

  const createdUser = await strapi.plugin('users-permissions').service('user').add({
    email: normalizeEmail(registration.email),
    username: normalizeEmail(registration.email),
    provider: 'local',
    fullName,
    phone: normalizePhone(registration.phone) || undefined,
    confirmed: true,
    blocked: false,
    password,
  });

  const currentUser = await strapi.db.query(USER_UID).findOne({
    where: { id: createdUser.id },
    select: ['id', 'username', 'email', 'fullName', 'phone', 'provider', 'confirmed', 'blocked', 'isPlatformAdmin', 'createdAt', 'updatedAt'],
  });

  try {
    const result = await completeCampaignRegistration(ctx, registration, currentUser, null);
    const authPayload = await buildAuthResponse(ctx, Number(createdUser.id));

    return {
      ok: true,
      status: 'approved',
      nextAction: 'completed',
      message: 'Bạn đã tham gia chiến dịch thành công.',
      redirectPath: result.redirectPath,
      registration: buildRegistrationSummary(result.registration),
      ...authPayload,
    };
  } catch (error) {
    const latestRegistration = await findRegistrationById(Number(registration.id), Number(campaign?.tenant?.id || campaign?.tenant || 0));
    return buildDeferredCompletionResponse(latestRegistration || registration, campaign, error);
  }
}

export async function completeRegistrationForCurrentUser(ctx: any, payload: Record<string, unknown>) {
  const completionToken = ensureRequiredText(payload.token, 'token');
  const currentUser = await resolveUserFromJwt(ctx);
  if (!currentUser?.id) {
    httpError(401, 'Login is required to complete registration', 'LOGIN_REQUIRED');
  }

  const tokenResult = await findRegistrationBySignedToken(completionToken, 'registration_complete');
  const registration = tokenResult.registration;
  const campaign = tokenResult.campaign;

  if (!campaign?.autoApprove) {
    return {
      ok: true,
      status: 'verified',
      nextAction: 'await_approval',
      message: 'Email đã được xác minh. Đăng ký của bạn đang chờ phê duyệt.',
      registration: buildRegistrationSummary(registration),
      redirectPath: assertInternalRedirectPath(buildRedirectPathForTargetFeature(campaign)),
    };
  }

  try {
    const result = await completeCampaignRegistration(ctx, registration, currentUser, null);
    return {
      ok: true,
      status: 'approved',
      nextAction: 'completed',
      message: 'Bạn đã tham gia chiến dịch thành công.',
      redirectPath: result.redirectPath,
      registration: buildRegistrationSummary(result.registration),
    };
  } catch (error) {
    const latestRegistration = await findRegistrationById(Number(registration.id), Number(campaign?.tenant?.id || campaign?.tenant || 0));
    return buildDeferredCompletionResponse(latestRegistration || registration, campaign, error);
  }
}

export async function retryCompleteApprovedRegistration(ctx: any, tenantId: number | string, registrationId: number, actor: AuthUser) {
  const registration = await findRegistrationById(registrationId, tenantId);
  if (!registration?.id) {
    httpError(404, 'Registration not found', 'REGISTRATION_NOT_FOUND');
  }

  if (normalizeStatus(registration.status) === 'approved') {
    return {
      ok: true,
      status: 'approved',
      message: 'Registration has already been completed',
      registration: buildRegistrationSummary(registration),
      redirectPath: assertInternalRedirectPath(buildRedirectPathForTargetFeature(registration.campaign)),
    };
  }

  const linkedUser = registration.user?.id
    ? registration.user
    : await strapi.db.query(USER_UID).findOne({
        where: {
          email: {
            $eqi: registration.email,
          },
        },
        select: ['id', 'username', 'email', 'fullName', 'phone', 'provider', 'confirmed', 'blocked', 'isPlatformAdmin', 'createdAt', 'updatedAt'],
      });

  if (!linkedUser?.id) {
    httpError(409, 'Cannot retry completion before user account is created or linked', 'LOGIN_REQUIRED');
  }

  const result = await completeCampaignRegistration(ctx, registration, linkedUser, actor?.id || null);
  return {
    ok: true,
    status: 'approved',
    message: 'Registration completed successfully',
    redirectPath: result.redirectPath,
    registration: buildRegistrationSummary(result.registration),
    notification: result.notification || null,
  };
}

export async function resendVerificationNotificationForRegistration(ctx: any, tenantId: number | string, registrationId: number) {
  const registration = await findRegistrationById(registrationId, tenantId);
  if (!registration?.id) {
    httpError(404, 'Registration not found', 'REGISTRATION_NOT_FOUND');
  }

  const status = normalizeStatus(registration.status);
  if (!['pending_verification', 'expired'].includes(status)) {
    httpError(409, 'Only pending verification registrations can resend email', 'REGISTRATION_NOT_PENDING_VERIFICATION');
  }

  const lastRequestedAt = toDateOrNull(registration.lastVerificationRequestAt);
  if (lastRequestedAt && Date.now() - lastRequestedAt.getTime() < RESEND_COOLDOWN_MS) {
    httpError(429, 'Please wait before requesting another verification email');
  }

  const refreshed = await refreshVerificationState(ctx, registration.campaign, registration);
  return {
    ok: true,
    status: 'pending_verification',
    verificationEmailSent: refreshed.notification.emailSent === true,
    emailSent: refreshed.notification.emailSent,
    emailError: refreshed.notification.emailError || null,
    emailErrorCode: refreshed.notification.errorCode || null,
    notificationTemplateCode: refreshed.notification.templateCode,
    notificationUsedFallback: refreshed.notification.usedFallback,
    message: refreshed.notification.emailSent === true
      ? 'Đã gửi lại email xác minh.'
      : 'Đăng ký vẫn được giữ lại nhưng chưa thể gửi email xác minh. Vui lòng thử lại sau.',
    registration: buildRegistrationSummary(refreshed.registration),
  };
}

export async function resendCompletionNotificationForRegistration(ctx: any, tenantId: number | string, registrationId: number) {
  const registration = await findRegistrationById(registrationId, tenantId);
  if (!registration?.id) {
    httpError(404, 'Registration not found', 'REGISTRATION_NOT_FOUND');
  }

  if (normalizeStatus(registration.status) !== 'approved') {
    httpError(409, 'Completion email can only be retried for approved registrations', 'REGISTRATION_NOT_APPROVED');
  }

  const notification = await sendCampaignRegistrationNotification({
    type: 'completion',
    ctx,
    campaign: registration.campaign,
    registration,
    retryOnlyIfFailed: true,
  });

  return {
    ok: notification.emailSent === true,
    message: notification.emailSent === true
      ? 'Đã gửi lại email hoàn tất đăng ký.'
      : 'Chưa thể gửi lại email hoàn tất đăng ký.',
    notification,
    registration: buildRegistrationSummary(registration),
  };
}

export async function resendRejectionNotificationForRegistration(ctx: any, tenantId: number | string, registrationId: number) {
  const registration = await findRegistrationById(registrationId, tenantId);
  if (!registration?.id) {
    httpError(404, 'Registration not found', 'REGISTRATION_NOT_FOUND');
  }

  if (normalizeStatus(registration.status) !== 'rejected') {
    httpError(409, 'Rejection email can only be retried for rejected registrations', 'REGISTRATION_NOT_REJECTED');
  }

  const notification = await sendCampaignRegistrationNotification({
    type: 'rejection',
    ctx,
    campaign: registration.campaign,
    registration,
    extraVariables: {
      rejectionReason: normalizeText(registration.rejectionReason),
    },
    retryOnlyIfFailed: true,
  });

  return {
    ok: notification.emailSent === true,
    message: notification.emailSent === true
      ? 'Đã gửi lại email từ chối đăng ký.'
      : 'Chưa thể gửi lại email từ chối đăng ký.',
    notification,
    registration: buildRegistrationSummary(registration),
  };
}

export async function approveCampaignRegistration(ctx: any, tenantId: number | string, registrationId: number, actor: AuthUser) {
  const registration = await findRegistrationById(registrationId, tenantId);
  if (!registration?.id) {
    httpError(404, 'Registration not found');
  }

  const currentStatus = normalizeStatus(registration.status);
  if (currentStatus === 'approved') {
    return {
      ok: true,
      message: 'Registration approved successfully',
      registration: buildRegistrationSummary(registration),
      redirectPath: assertInternalRedirectPath(buildRedirectPathForTargetFeature(registration.campaign)),
    };
  }

  if (currentStatus !== 'verified') {
    httpError(409, 'Registration must be verified before approval', 'REGISTRATION_NOT_VERIFIED');
  }

  const linkedUser = registration.user?.id
    ? registration.user
    : await strapi.db.query(USER_UID).findOne({
        where: {
          email: {
            $eqi: registration.email,
          },
        },
        select: ['id', 'username', 'email', 'fullName', 'phone', 'provider', 'confirmed', 'blocked', 'isPlatformAdmin', 'createdAt', 'updatedAt'],
      });

  if (!linkedUser?.id) {
    httpError(409, 'Registration account is not ready. User must complete account setup or login first.', 'REGISTRATION_ACCOUNT_NOT_READY');
  }

  const result = await completeCampaignRegistration(ctx, registration, linkedUser, actor.id);
  return {
    ok: true,
    message: 'Registration approved successfully',
    registration: buildRegistrationSummary(result.registration),
    redirectPath: result.redirectPath,
  };
}

export async function rejectCampaignRegistration(
  tenantId: number | string,
  registrationId: number,
  actor: AuthUser,
  payload: Record<string, unknown>,
) {
  const registration = await findRegistrationById(registrationId, tenantId);
  if (!registration?.id) {
    httpError(404, 'Registration not found');
  }

  const currentStatus = normalizeStatus(registration.status);
  if (currentStatus === 'approved') {
    httpError(409, 'Approved registrations cannot be rejected');
  }

  if (currentStatus === 'rejected') {
    return {
      ok: true,
      message: 'Registration has already been rejected',
      registration: buildRegistrationSummary(registration),
    };
  }

  if (currentStatus === 'cancelled') {
    httpError(409, 'Cancelled registrations cannot be rejected');
  }

  const reason = normalizeText(payload.reason || payload.rejectionReason) || null;
  const updated = await strapi.db.query(CAMPAIGN_REGISTRATION_UID).update({
    where: { id: registrationId },
    data: {
      status: 'rejected',
      rejectedAt: new Date(),
      rejectedBy: actor.id,
      rejectionReason: reason,
      approvedAt: null,
      approvedBy: null,
      cancelledAt: null,
      verificationTokenHash: null,
    },
  });

  const freshRegistration = await findRegistrationById(registrationId, tenantId);
  const notification = await sendRejectionEmail(null, registration.campaign, freshRegistration || updated, reason);

  return {
    ok: true,
    message: 'Registration rejected successfully',
    registration: buildRegistrationSummary(freshRegistration || updated),
    notification,
  };
}

export async function cancelCampaignRegistration(
  tenantId: number | string,
  registrationId: number,
  actor: AuthUser,
  payload: Record<string, unknown>,
) {
  const registration = await findRegistrationById(registrationId, tenantId);
  if (!registration?.id) {
    httpError(404, 'Registration not found');
  }

  const currentStatus = normalizeStatus(registration.status);
  if (currentStatus === 'approved') {
    httpError(409, 'Approved registrations cannot be cancelled');
  }

  if (currentStatus === 'cancelled') {
    return {
      ok: true,
      message: 'Registration has already been cancelled',
      registration: buildRegistrationSummary(registration),
    };
  }

  const reason = normalizeText(payload.reason || payload.cancelReason) || null;
  const updated = await strapi.db.query(CAMPAIGN_REGISTRATION_UID).update({
    where: { id: registrationId },
    data: {
      status: 'cancelled',
      cancelledAt: new Date(),
      approvedAt: null,
      approvedBy: null,
      rejectedAt: null,
      rejectedBy: null,
      rejectionReason: reason,
      verificationTokenHash: null,
      metadata: buildSafeMetadata(registration.metadata, {
        cancelledBy: actor.id,
        cancelReason: reason,
      }),
    },
  });

  return {
    ok: true,
    message: 'Registration cancelled successfully',
    registration: buildRegistrationSummary(updated),
  };
}

export function handleRegistrationCampaignError(ctx: any, error: unknown) {
  if (error instanceof HttpError) {
    const body = error.code
      ? {
          error: error.message,
          code: error.code,
          status: error.status,
        }
      : null;

    if (error.status === 400) {
      if (body) {
        ctx.status = 400;
        ctx.body = body;
        return;
      }
      return ctx.badRequest(error.message);
    }
    if (error.status === 401) return ctx.unauthorized(error.message);
    if (error.status === 403) {
      if (body) {
        ctx.status = 403;
        ctx.body = body;
        return;
      }
      return ctx.forbidden(error.message);
    }
    if (error.status === 404) {
      if (body) {
        ctx.status = 404;
        ctx.body = body;
        return;
      }
      return ctx.notFound(error.message);
    }
    if (error.status === 409) {
      if (body) {
        ctx.status = 409;
        ctx.body = body;
        return;
      }
      return ctx.conflict(error.message);
    }
    if (error.status === 410 || error.status === 429) {
      ctx.status = error.status;
      ctx.body = {
        error: error.message,
        ...(error.code ? { code: error.code } : {}),
        status: error.status,
      };
      return;
    }
    return ctx.throw(error.status, error.message);
  }

  if (error instanceof errors.ApplicationError) {
    return ctx.badRequest(error.message);
  }

  strapi.log.error('[registration-campaign] unexpected error', error);
  return ctx.internalServerError('Failed to process registration campaign request');
}

export async function buildVerificationRedirectUrl(ctx: any, campaign: any, status: 'success' | 'error', message: string) {
  const redirectPath = normalizePath(campaign?.redirectPath);
  if (!redirectPath) return null;

  const baseUrl = await getBaseUrl(ctx, { tenantId: Number(campaign?.tenant?.id || campaign?.tenant || 0) || null });
  const url = new URL(redirectPath, `${baseUrl}/`);
  url.searchParams.set('verificationStatus', status);
  url.searchParams.set('message', message);
  return url.toString();
}