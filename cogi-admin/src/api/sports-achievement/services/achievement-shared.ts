import { extractRelationRef, hasOwn, mergeTenantWhere, toPositiveInt, toText, whereByParam } from '../../../utils/tenant-scope';

export const SPORTS_ACHIEVEMENT_UID = 'api::sports-achievement.sports-achievement' as any;
export const SPORTS_ACHIEVEMENT_SUBMISSION_UID = 'api::sports-achievement-submission.sports-achievement-submission' as any;
export const SPORTS_PROFILE_UID = 'api::sports-profile.sports-profile' as any;
export const SPORTS_CLUB_UID = 'api::sports-club.sports-club' as any;
export const USER_UID = 'plugin::users-permissions.user' as any;

export const ACHIEVEMENT_STATUS_VALUES = new Set(['active', 'revoked']);
export const ACHIEVEMENT_TYPE_VALUES = new Set(['personal_best', 'race_result', 'champion', 'podium', 'finisher', 'distance_milestone', 'streak', 'club_award', 'system_award', 'other']);
export const ACHIEVEMENT_SOURCE_VALUES = new Set(['club', 'event', 'manual', 'system', 'strava', 'import', 'other']);
export const SUBMISSION_SOURCE_VALUES = new Set(['club_manager', 'member', 'event', 'public_form', 'import', 'system', 'strava', 'other']);
export const SUBMISSION_STATUS_VALUES = new Set(['draft', 'submitted', 'verified', 'rejected', 'cancelled']);
export const SPORT_TYPE_VALUES = new Set(['running', 'cycling', 'badminton', 'football', 'swimming', 'multisport', 'other']);

export type AuthUser = { id: number; blocked?: boolean | null } | null;
export type GenericRecord = Record<string, unknown>;
export type HttpErrorDetails = Record<string, unknown> | Array<Record<string, unknown>> | null;

export function normalizeOptionalText(value: unknown, maxLength?: number): string | null {
  const text = toText(value);
  if (!text) return null;
  if (maxLength && text.length > maxLength) {
    throw Object.assign(new Error(`Text exceeds max length ${maxLength}`), { status: 400, code: 'INVALID_TEXT_LENGTH' });
  }
  return text;
}

export function normalizeRequiredText(value: unknown, fieldName: string, maxLength?: number): string {
  const text = toText(value);
  if (!text) {
    throw Object.assign(new Error(`${fieldName} is required`), { status: 400, code: 'INVALID_REQUEST_BODY', details: { field: fieldName } });
  }
  if (maxLength && text.length > maxLength) {
    throw Object.assign(new Error(`${fieldName} max length is ${maxLength}`), { status: 400, code: 'INVALID_REQUEST_BODY', details: { field: fieldName } });
  }
  return text;
}

export function normalizeOptionalRelationRef(value: unknown): string | number | null {
  const ref = extractRelationRef(value);
  return ref === null || ref === undefined || ref === '' ? null : ref;
}

export function normalizeRequiredRelationRef(value: unknown, fieldName: string): string | number {
  const ref = normalizeOptionalRelationRef(value);
  if (ref === null) {
    throw Object.assign(new Error(`${fieldName} is required`), { status: 400, code: 'INVALID_REQUEST_BODY', details: { field: fieldName } });
  }
  return ref;
}

export function normalizeDateTime(value: unknown, fieldName: string): string | null {
  const text = toText(value);
  if (!text) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) {
    const noonDate = new Date(`${text}T12:00:00`);
    if (Number.isNaN(noonDate.getTime())) {
      throw Object.assign(new Error(`${fieldName} is invalid`), { status: 400, code: 'INVALID_DATE', details: { field: fieldName } });
    }
    return noonDate.toISOString();
  }
  const date = new Date(text);
  if (Number.isNaN(date.getTime())) {
    throw Object.assign(new Error(`${fieldName} is invalid`), { status: 400, code: 'INVALID_DATE', details: { field: fieldName } });
  }
  return date.toISOString();
}

export function normalizePositiveNumber(value: unknown, fieldName: string): number | null {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    throw Object.assign(new Error(`${fieldName} must be numeric`), { status: 400, code: 'INVALID_NUMBER', details: { field: fieldName } });
  }
  return parsed;
}

export function normalizeAchievementStatus(value: unknown): 'active' | 'revoked' {
  const text = toText(value).toLowerCase() || 'active';
  if (!ACHIEVEMENT_STATUS_VALUES.has(text)) {
    throw Object.assign(new Error('status is invalid'), { status: 400, code: 'INVALID_STATUS', details: { field: 'status' } });
  }
  return text as 'active' | 'revoked';
}

export function normalizeAchievementType(value: unknown): string {
  const text = toText(value).toLowerCase();
  if (!ACHIEVEMENT_TYPE_VALUES.has(text)) {
    throw Object.assign(new Error('achievementType is invalid'), { status: 400, code: 'INVALID_ACHIEVEMENT_TYPE', details: { field: 'achievementType' } });
  }
  return text;
}

export function normalizeAchievementSource(value: unknown): string {
  const text = toText(value).toLowerCase();
  if (!ACHIEVEMENT_SOURCE_VALUES.has(text)) {
    throw Object.assign(new Error('source is invalid'), { status: 400, code: 'INVALID_SOURCE', details: { field: 'source' } });
  }
  return text;
}

export function normalizeSubmissionSource(value: unknown): string {
  const text = toText(value).toLowerCase();
  if (!SUBMISSION_SOURCE_VALUES.has(text)) {
    throw Object.assign(new Error('source is invalid'), { status: 400, code: 'INVALID_SOURCE', details: { field: 'source' } });
  }
  return text;
}

export function normalizeSubmissionStatus(value: unknown): 'draft' | 'submitted' | 'verified' | 'rejected' | 'cancelled' {
  const text = toText(value).toLowerCase() || 'draft';
  if (!SUBMISSION_STATUS_VALUES.has(text)) {
    throw Object.assign(new Error('status is invalid'), { status: 400, code: 'INVALID_STATUS', details: { field: 'status' } });
  }
  return text as 'draft' | 'submitted' | 'verified' | 'rejected' | 'cancelled';
}

export function normalizeSportType(value: unknown): string | null {
  const text = toText(value).toLowerCase();
  if (!text) return null;
  if (!SPORT_TYPE_VALUES.has(text)) {
    throw Object.assign(new Error('sportType is invalid'), { status: 400, code: 'INVALID_SPORT_TYPE', details: { field: 'sportType' } });
  }
  return text;
}

export function normalizeEvidenceRefs(value: unknown): number[] {
  if (value === null || value === undefined || value === '') return [];
  const items = Array.isArray(value) ? value : [value];
  const ids = items
    .map((item) => extractRelationRef(item) ?? item)
    .map((item) => Number(item))
    .filter((item) => Number.isInteger(item) && item > 0);
  return Array.from(new Set(ids));
}

export function ensureNoUnknownFields(payload: GenericRecord, allowedFields: string[]) {
  const allowed = new Set(allowedFields);
  const unknown = Object.keys(payload || {}).filter((key) => !allowed.has(key));
  if (unknown.length > 0) {
    throw Object.assign(new Error('payload contains unknown fields'), { status: 400, code: 'UNKNOWN_FIELDS', details: { fields: unknown } });
  }
}

export function ensureNoManagedTenantField(payload: GenericRecord) {
  if (hasOwn(payload, 'tenant')) {
    throw Object.assign(new Error('tenant is managed by tenant context'), { status: 400, code: 'TENANT_CONTEXT_ONLY' });
  }
}

export function parseErrorMessage(error: any) {
  return toText(error?.message || error?.details?.message || error?.response?.data?.error?.message);
}

export function mapMedia(media: any) {
  if (!media?.id) return null;
  return {
    id: Number(media.id),
    name: toText(media.name) || null,
    url: toText(media.url) || null,
    mime: toText(media.mime) || null,
  };
}

export function mapUser(user: any) {
  if (!user?.id) return null;
  return {
    id: Number(user.id),
    documentId: toText(user.documentId) || null,
    username: toText(user.username) || null,
    email: toText(user.email) || null,
    fullName: toText(user.fullName) || null,
  };
}

export function mapSportsProfile(profile: any) {
  if (!profile?.id) return null;
  return {
    id: Number(profile.id),
    documentId: toText(profile.documentId) || null,
    code: toText(profile.code) || null,
    fullName: toText(profile.fullName) || null,
    displayName: toText(profile.displayName) || null,
    contactPhone: toText(profile.contactPhone) || null,
    contactEmail: toText(profile.contactEmail) || null,
    avatar: mapMedia(profile.avatar),
  };
}

export function mapSportsClub(club: any) {
  if (!club?.id) return null;
  return {
    id: Number(club.id),
    documentId: toText(club.documentId) || null,
    code: toText(club.code) || null,
    name: toText(club.name) || null,
    shortName: toText(club.shortName) || null,
    logo: mapMedia(club.logo),
  };
}

export function mapAchievementReference(row: any) {
  if (!row?.id) return null;
  return {
    id: Number(row.id),
    documentId: toText(row.documentId) || null,
    title: toText(row.title) || null,
    status: toText(row.status) || 'active',
    verifiedAt: row.verifiedAt || null,
    revokedAt: row.revokedAt || null,
  };
}

export function mapSubmissionReference(row: any) {
  if (!row?.id) return null;
  return {
    id: Number(row.id),
    documentId: toText(row.documentId) || null,
    title: toText(row.title) || null,
    status: toText(row.status) || 'draft',
    submittedAt: row.submittedAt || null,
  };
}

export function mapSportsAchievementRow(row: any, options: { includeLongText?: boolean } = {}) {
  if (!row?.id) return null;
  return {
    id: Number(row.id),
    documentId: toText(row.documentId) || null,
    title: toText(row.title) || null,
    description: options.includeLongText ? normalizeOptionalText(row.description) : normalizeOptionalText(row.description, 240),
    achievementType: toText(row.achievementType) || 'other',
    sportType: toText(row.sportType) || null,
    achievedAt: row.achievedAt || null,
    resultValue: row.resultValue === null || row.resultValue === undefined || row.resultValue === '' ? null : Number(row.resultValue),
    resultUnit: toText(row.resultUnit) || null,
    resultText: toText(row.resultText) || null,
    status: toText(row.status) || 'active',
    source: toText(row.source) || 'manual',
    sourceReference: toText(row.sourceReference) || null,
    evidence: Array.isArray(row.evidence) ? row.evidence.map((item: any) => mapMedia(item)).filter(Boolean) : [],
    note: options.includeLongText ? normalizeOptionalText(row.note) : normalizeOptionalText(row.note, 240),
    verifiedAt: row.verifiedAt || null,
    verifiedBy: mapUser(row.verifiedBy),
    revokedAt: row.revokedAt || null,
    revokedBy: mapUser(row.revokedBy),
    revokeReason: options.includeLongText ? normalizeOptionalText(row.revokeReason) : normalizeOptionalText(row.revokeReason, 240),
    sportsProfile: mapSportsProfile(row.sportsProfile),
    club: mapSportsClub(row.club),
    createdAt: row.createdAt || null,
    updatedAt: row.updatedAt || null,
  };
}

export function mapSportsAchievementSubmissionRow(row: any, options: { includeLongText?: boolean } = {}) {
  if (!row?.id) return null;
  return {
    id: Number(row.id),
    documentId: toText(row.documentId) || null,
    title: toText(row.title) || null,
    description: options.includeLongText ? normalizeOptionalText(row.description) : normalizeOptionalText(row.description, 240),
    achievementType: toText(row.achievementType) || 'other',
    sportType: toText(row.sportType) || null,
    achievedAt: row.achievedAt || null,
    resultValue: row.resultValue === null || row.resultValue === undefined || row.resultValue === '' ? null : Number(row.resultValue),
    resultUnit: toText(row.resultUnit) || null,
    resultText: toText(row.resultText) || null,
    source: toText(row.source) || 'other',
    sourceReference: toText(row.sourceReference) || null,
    status: toText(row.status) || 'draft',
    evidence: Array.isArray(row.evidence) ? row.evidence.map((item: any) => mapMedia(item)).filter(Boolean) : [],
    submittedBy: mapUser(row.submittedBy),
    submittedAt: row.submittedAt || null,
    reviewedBy: mapUser(row.reviewedBy),
    reviewedAt: row.reviewedAt || null,
    reviewNote: options.includeLongText ? normalizeOptionalText(row.reviewNote) : normalizeOptionalText(row.reviewNote, 240),
    note: options.includeLongText ? normalizeOptionalText(row.note) : normalizeOptionalText(row.note, 240),
    sportsProfile: mapSportsProfile(row.sportsProfile),
    club: mapSportsClub(row.club),
    achievement: mapAchievementReference(row.achievement),
    sourceAchievement: mapAchievementReference(row.sourceAchievement),
    createdAt: row.createdAt || null,
    updatedAt: row.updatedAt || null,
  };
}

export async function findSportsProfileInTenant(profileRef: unknown, tenantId: number | string, transacting?: any) {
  const where = whereByParam(profileRef);
  if (!where) {
    throw Object.assign(new Error('sportsProfile is required'), { status: 400, code: 'INVALID_REQUEST_BODY', details: { field: 'sportsProfile' } });
  }
  const row = await strapi.db.query(SPORTS_PROFILE_UID).findOne({
    where: mergeTenantWhere(where, tenantId),
    populate: { avatar: { select: ['id', 'name', 'url', 'mime'] } },
    ...(transacting ? { transacting } : {}),
  } as any);
  if (!row?.id) {
    throw Object.assign(new Error('Sports profile not found'), { status: 404, code: 'SPORTS_PROFILE_NOT_FOUND' });
  }
  return row;
}

export async function findSportsClubInTenant(clubRef: unknown, tenantId: number | string, transacting?: any) {
  const where = whereByParam(clubRef);
  if (!where) {
    throw Object.assign(new Error('club is required'), { status: 400, code: 'INVALID_REQUEST_BODY', details: { field: 'club' } });
  }
  const row = await strapi.db.query(SPORTS_CLUB_UID).findOne({
    where: mergeTenantWhere(where, tenantId),
    populate: { logo: { select: ['id', 'name', 'url', 'mime'] } },
    ...(transacting ? { transacting } : {}),
  } as any);
  if (!row?.id) {
    throw Object.assign(new Error('Sports club not found'), { status: 404, code: 'SPORTS_CLUB_NOT_FOUND' });
  }
  return row;
}

export async function findUserByRef(userRef: unknown, transacting?: any) {
  const where = whereByParam(userRef);
  if (!where) return null;
  const row = await strapi.db.query(USER_UID).findOne({
    where,
    select: ['id', 'documentId', 'username', 'email', 'fullName'],
    ...(transacting ? { transacting } : {}),
  } as any);
  if (!row?.id) {
    throw Object.assign(new Error('User not found'), { status: 404, code: 'USER_NOT_FOUND' });
  }
  return row;
}

export function isPostgresClient() {
  const client = String(strapi.db?.connection?.client?.config?.client || '').toLowerCase();
  return client.includes('pg');
}

export async function acquireSubmissionVerifyLock(trx: any, tenantId: number | string, submissionId: number | string) {
  if (!isPostgresClient()) return;
  await trx.raw('select pg_advisory_xact_lock(hashtext(?), hashtext(?))', [String(tenantId), `sports-achievement-submission:${String(submissionId)}`]);
}

export function buildPagination(page: number, pageSize: number, total: number) {
  return {
    page,
    pageSize,
    pageCount: Math.max(1, Math.ceil(total / pageSize)),
    total,
  };
}

export function normalizePaginationQuery(query: Record<string, unknown>) {
  const page = toPositiveInt(query.page, 1);
  const pageSize = Math.min(100, toPositiveInt(query.pageSize, 10));
  return { page, pageSize, start: (page - 1) * pageSize };
}

export function mapSubmissionSourceToAchievementSource(source: unknown): 'club' | 'event' | 'manual' | 'system' | 'strava' | 'import' | 'other' {
  const normalized = toText(source).toLowerCase();
  if (normalized === 'club_manager') return 'club';
  if (normalized === 'member') return 'manual';
  if (normalized === 'event') return 'event';
  if (normalized === 'public_form') return 'manual';
  if (normalized === 'import') return 'import';
  if (normalized === 'system') return 'system';
  if (normalized === 'strava') return 'strava';
  return 'other';
}

export function canCreateSubmissionWithStatus(status: string) {
  return status === 'draft' || status === 'submitted';
}

export function canCancelSubmissionStatus(status: string) {
  return status === 'draft' || status === 'submitted';
}

export function canVerifySubmissionStatus(status: string) {
  return status === 'submitted' || status === 'verified';
}

export function canRejectSubmissionStatus(status: string) {
  return status === 'submitted';
}

export function normalizePopulateForAchievement() {
  return {
    sportsProfile: { select: ['id', 'documentId', 'code', 'fullName', 'displayName', 'contactPhone', 'contactEmail'], populate: { avatar: { select: ['id', 'name', 'url', 'mime'] } } },
    club: { select: ['id', 'documentId', 'code', 'name', 'shortName'], populate: { logo: { select: ['id', 'name', 'url', 'mime'] } } },
    verifiedBy: { select: ['id', 'documentId', 'username', 'email', 'fullName'] },
    revokedBy: { select: ['id', 'documentId', 'username', 'email', 'fullName'] },
    evidence: { select: ['id', 'name', 'url', 'mime'] },
  };
}

export function normalizePopulateForSubmission() {
  return {
    sportsProfile: { select: ['id', 'documentId', 'code', 'fullName', 'displayName', 'contactPhone', 'contactEmail'], populate: { avatar: { select: ['id', 'name', 'url', 'mime'] } } },
    club: { select: ['id', 'documentId', 'code', 'name', 'shortName'], populate: { logo: { select: ['id', 'name', 'url', 'mime'] } } },
    submittedBy: { select: ['id', 'documentId', 'username', 'email', 'fullName'] },
    reviewedBy: { select: ['id', 'documentId', 'username', 'email', 'fullName'] },
    achievement: { select: ['id', 'documentId', 'title', 'status', 'verifiedAt'] },
    sourceAchievement: { select: ['id', 'documentId', 'title', 'status', 'verifiedAt', 'revokedAt'] },
    evidence: { select: ['id', 'name', 'url', 'mime'] },
  };
}
