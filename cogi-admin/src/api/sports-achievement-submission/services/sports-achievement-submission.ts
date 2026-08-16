import { extractRelationRef, hasOwn, mergeTenantWhere, normalizeSortInput, toText, whereByParam } from '../../../utils/tenant-scope';
import {
  acquireSubmissionVerifyLock,
  AuthUser,
  buildPagination,
  canCancelSubmissionStatus,
  canCreateSubmissionWithStatus,
  canRejectSubmissionStatus,
  canVerifySubmissionStatus,
  ensureNoManagedTenantField,
  ensureNoUnknownFields,
  findSportsClubInTenant,
  findSportsProfileInTenant,
  GenericRecord,
  HttpErrorDetails,
  mapSportsAchievementSubmissionRow,
  mapSubmissionSourceToAchievementSource,
  normalizeDateTime,
  normalizeEvidenceRefs,
  normalizeOptionalRelationRef,
  normalizeOptionalText,
  normalizePaginationQuery,
  normalizePopulateForSubmission,
  normalizePositiveNumber,
  normalizeRequiredRelationRef,
  normalizeRequiredText,
  normalizeSportType,
  normalizeSubmissionSource,
  normalizeSubmissionStatus,
  parseErrorMessage,
  SPORTS_ACHIEVEMENT_SUBMISSION_UID,
  SPORTS_ACHIEVEMENT_UID,
  SUBMISSION_SOURCE_VALUES,
  SUBMISSION_STATUS_VALUES,
  ACHIEVEMENT_TYPE_VALUES,
} from '../../sports-achievement/services/achievement-shared';
import { createVerifiedAchievementFromSubmission, findAchievementInTenant } from '../../sports-achievement/services/sports-achievement';

export class SportsAchievementSubmissionError extends Error {
  status: number;
  code?: string | null;
  details?: HttpErrorDetails;

  constructor(status: number, message: string, code?: string | null, details?: HttpErrorDetails) {
    super(message);
    this.status = status;
    this.code = code || null;
    this.details = typeof details === 'undefined' ? null : details;
  }
}

function httpError(status: number, message: string, code?: string, details?: HttpErrorDetails): never {
  throw new SportsAchievementSubmissionError(status, message, code, details);
}

function toDomainError(error: any): never {
  if (error instanceof SportsAchievementSubmissionError) throw error;
  const status = Number(error?.status || 0);
  if (status > 0) {
    throw new SportsAchievementSubmissionError(status, error.message || 'Invalid sports achievement submission request', error.code || null, error.details || null);
  }
  throw error;
}

function ensureNoUnknownWriteFields(payload: GenericRecord) {
  ensureNoUnknownFields(payload, [
    'sportsProfile',
    'club',
    'achievementType',
    'sportType',
    'title',
    'description',
    'achievedAt',
    'resultValue',
    'resultUnit',
    'resultText',
    'source',
    'sourceReference',
    'evidence',
    'status',
    'reviewNote',
    'note',
    'sourceAchievement',
  ]);
  ensureNoManagedTenantField(payload);
  if (hasOwn(payload, 'submittedBy') || hasOwn(payload, 'submittedAt') || hasOwn(payload, 'reviewedBy') || hasOwn(payload, 'reviewedAt') || hasOwn(payload, 'achievement')) {
    httpError(400, 'audit fields are managed by workflow actions', 'WORKFLOW_FIELDS_READONLY');
  }
}

function buildListWhere(query: Record<string, unknown>) {
  const clauses: Array<Record<string, unknown>> = [];
  const keyword = toText(query.search ?? query.q);
  const status = toText(query.status).toLowerCase();
  const source = toText(query.source).toLowerCase();
  const achievementType = toText(query.achievementType).toLowerCase();
  const sportType = toText(query.sportType).toLowerCase();
  const clubRef = extractRelationRef(query.club);
  const profileRef = extractRelationRef(query.sportsProfile);
  const submittedFrom = normalizeDateTime(query.submittedFrom, 'submittedFrom');
  const submittedTo = normalizeDateTime(query.submittedTo, 'submittedTo');

  if (keyword) {
    clauses.push({
      $or: [
        { title: { $containsi: keyword } },
        { resultText: { $containsi: keyword } },
        { sourceReference: { $containsi: keyword } },
        { sportsProfile: { code: { $containsi: keyword } } },
        { sportsProfile: { fullName: { $containsi: keyword } } },
        { club: { code: { $containsi: keyword } } },
        { club: { name: { $containsi: keyword } } },
      ],
    });
  }

  if (status) {
    if (!SUBMISSION_STATUS_VALUES.has(status)) httpError(400, 'status is invalid', 'INVALID_STATUS', { field: 'status' });
    clauses.push({ status: { $eq: status } });
  }
  if (source) {
    if (!SUBMISSION_SOURCE_VALUES.has(source)) httpError(400, 'source is invalid', 'INVALID_SOURCE', { field: 'source' });
    clauses.push({ source: { $eq: source } });
  }
  if (achievementType) {
    if (!ACHIEVEMENT_TYPE_VALUES.has(achievementType)) httpError(400, 'achievementType is invalid', 'INVALID_ACHIEVEMENT_TYPE', { field: 'achievementType' });
    clauses.push({ achievementType: { $eq: achievementType } });
  }
  if (sportType) {
    normalizeSportType(sportType);
    clauses.push({ sportType: { $eq: sportType } });
  }
  if (clubRef) {
    const where = whereByParam(clubRef);
    if (where?.id) clauses.push({ club: { id: { $eq: where.id } } });
    if (where?.documentId) clauses.push({ club: { documentId: { $eq: where.documentId } } });
  }
  if (profileRef) {
    const where = whereByParam(profileRef);
    if (where?.id) clauses.push({ sportsProfile: { id: { $eq: where.id } } });
    if (where?.documentId) clauses.push({ sportsProfile: { documentId: { $eq: where.documentId } } });
  }
  if (submittedFrom) clauses.push({ submittedAt: { $gte: submittedFrom } });
  if (submittedTo) clauses.push({ submittedAt: { $lte: submittedTo } });

  if (clauses.length === 0) return {};
  if (clauses.length === 1) return clauses[0];
  return { $and: clauses };
}

function resolveOrderBy(query: Record<string, unknown>) {
  const normalizedSort = normalizeSortInput(query?.sort);
  if (normalizedSort.length > 0) {
    const allowed = new Set(['title', 'achievementType', 'sportType', 'status', 'source', 'submittedAt', 'reviewedAt', 'achievedAt', 'updatedAt', 'createdAt']);
    const safe = normalizedSort
      .map((entry) => {
        const key = Object.keys(entry || {})[0];
        if (!key || !allowed.has(key)) return null;
        return { [key]: entry[key] };
      })
      .filter(Boolean);
    if (safe.length > 0) return safe as Array<Record<string, 'asc' | 'desc'>>;
  }
  return [{ updatedAt: 'desc' }, { submittedAt: 'desc' }, { createdAt: 'desc' }];
}

async function findSubmissionInTenant(submissionRef: unknown, tenantId: number | string, transacting?: any) {
  const where = whereByParam(submissionRef);
  if (!where) {
    httpError(404, 'Sports achievement submission not found', 'SPORTS_ACHIEVEMENT_SUBMISSION_NOT_FOUND');
  }
  const row = await strapi.db.query(SPORTS_ACHIEVEMENT_SUBMISSION_UID).findOne({
    where: mergeTenantWhere(where, tenantId),
    populate: normalizePopulateForSubmission(),
    ...(transacting ? { transacting } : {}),
  } as any);
  if (!row?.id) {
    httpError(404, 'Sports achievement submission not found', 'SPORTS_ACHIEVEMENT_SUBMISSION_NOT_FOUND');
  }
  return row;
}

async function findOpenCorrectionSubmissionForAchievement(sourceAchievementId: number, tenantId: number | string, transacting?: any) {
  if (!Number.isInteger(Number(sourceAchievementId)) || Number(sourceAchievementId) <= 0) return null;
  return await strapi.db.query(SPORTS_ACHIEVEMENT_SUBMISSION_UID).findOne({
    where: mergeTenantWhere({
      sourceAchievement: { id: { $eq: Number(sourceAchievementId) } },
      status: { $in: ['draft', 'submitted'] },
    }, tenantId),
    populate: normalizePopulateForSubmission(),
    orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
    ...(transacting ? { transacting } : {}),
  } as any);
}

async function prepareWriteData(input: GenericRecord, tenantId: number | string, existing?: any, transacting?: any) {
  ensureNoUnknownWriteFields(input);
  try {
    const sportsProfileRef = hasOwn(input, 'sportsProfile') ? normalizeRequiredRelationRef(input.sportsProfile, 'sportsProfile') : normalizeOptionalRelationRef(existing?.sportsProfile);
    if (!sportsProfileRef) httpError(400, 'sportsProfile is required', 'INVALID_REQUEST_BODY', { field: 'sportsProfile' });
    const clubRef = hasOwn(input, 'club') ? normalizeRequiredRelationRef(input.club, 'club') : normalizeOptionalRelationRef(existing?.club);
    if (!clubRef) httpError(400, 'club is required', 'INVALID_REQUEST_BODY', { field: 'club' });

    const sportsProfile = await findSportsProfileInTenant(sportsProfileRef, tenantId, transacting);
    const club = await findSportsClubInTenant(clubRef, tenantId, transacting);
    const sourceAchievementRef = hasOwn(input, 'sourceAchievement') ? normalizeOptionalRelationRef(input.sourceAchievement) : normalizeOptionalRelationRef(existing?.sourceAchievement);
    const sourceAchievement = sourceAchievementRef ? await findAchievementInTenant(sourceAchievementRef, tenantId, transacting) : null;

    const status = hasOwn(input, 'status') ? normalizeSubmissionStatus(input.status) : normalizeSubmissionStatus(existing?.status);
    const achievementType = hasOwn(input, 'achievementType') ? toText(input.achievementType).toLowerCase() : toText(existing?.achievementType).toLowerCase();
    if (!ACHIEVEMENT_TYPE_VALUES.has(achievementType)) httpError(400, 'achievementType is invalid', 'INVALID_ACHIEVEMENT_TYPE', { field: 'achievementType' });
    const title = hasOwn(input, 'title') ? normalizeRequiredText(input.title, 'title', 200) : normalizeRequiredText(existing?.title, 'title', 200);
    const description = hasOwn(input, 'description') ? normalizeOptionalText(input.description) : normalizeOptionalText(existing?.description);
    const sportType = hasOwn(input, 'sportType') ? normalizeSportType(input.sportType) : normalizeSportType(existing?.sportType);
    const achievedAt = hasOwn(input, 'achievedAt') ? normalizeDateTime(input.achievedAt, 'achievedAt') : normalizeDateTime(existing?.achievedAt, 'achievedAt');
    const resultValue = hasOwn(input, 'resultValue') ? normalizePositiveNumber(input.resultValue, 'resultValue') : normalizePositiveNumber(existing?.resultValue, 'resultValue');
    const resultUnit = hasOwn(input, 'resultUnit') ? normalizeOptionalText(input.resultUnit, 50) : normalizeOptionalText(existing?.resultUnit, 50);
    const resultText = hasOwn(input, 'resultText') ? normalizeOptionalText(input.resultText, 255) : normalizeOptionalText(existing?.resultText, 255);
    const source = hasOwn(input, 'source') ? normalizeSubmissionSource(input.source) : normalizeSubmissionSource(existing?.source || 'other');
    const sourceReference = hasOwn(input, 'sourceReference') ? normalizeOptionalText(input.sourceReference, 255) : normalizeOptionalText(existing?.sourceReference, 255);
    const evidenceIds = hasOwn(input, 'evidence') ? normalizeEvidenceRefs(input.evidence) : normalizeEvidenceRefs(existing?.evidence);
    const reviewNote = hasOwn(input, 'reviewNote') ? normalizeOptionalText(input.reviewNote) : normalizeOptionalText(existing?.reviewNote);
    const note = hasOwn(input, 'note') ? normalizeOptionalText(input.note) : normalizeOptionalText(existing?.note);

    return { sportsProfile, club, sourceAchievement, status, achievementType, title, description, sportType, achievedAt, resultValue, resultUnit, resultText, source, sourceReference, evidenceIds, reviewNote, note };
  } catch (error) {
    toDomainError(error);
  }
}

export async function listTenantSportsAchievementSubmissions(query: Record<string, unknown>, tenantId: number | string) {
  const { page, pageSize, start } = normalizePaginationQuery(query || {});
  const where = mergeTenantWhere(buildListWhere(query || {}), tenantId);
  const orderBy = resolveOrderBy(query || {});
  const [rows, total] = await Promise.all([
    strapi.db.query(SPORTS_ACHIEVEMENT_SUBMISSION_UID).findMany({ where, orderBy, offset: start, limit: pageSize, populate: normalizePopulateForSubmission() } as any),
    strapi.db.query(SPORTS_ACHIEVEMENT_SUBMISSION_UID).count({ where } as any),
  ]);
  return {
    rows: (rows || []).map((row: any) => mapSportsAchievementSubmissionRow(row)).filter(Boolean),
    pagination: buildPagination(page, pageSize, total),
  };
}

export async function getTenantSportsAchievementSubmission(submissionRef: unknown, tenantId: number | string) {
  return mapSportsAchievementSubmissionRow(await findSubmissionInTenant(submissionRef, tenantId), { includeLongText: true });
}

export async function createTenantSportsAchievementSubmission(payload: Record<string, unknown>, tenantId: number | string, authUser: AuthUser = null, options: { transacting?: any } = {}) {
  try {
    const prepared = await prepareWriteData(payload || {}, tenantId, undefined, options.transacting);
    if (!canCreateSubmissionWithStatus(prepared.status)) {
      httpError(400, 'Submission can only be created as draft or submitted.', 'INVALID_SUBMISSION_CREATE_STATUS');
    }
    const now = new Date().toISOString();
    const created = await strapi.db.query(SPORTS_ACHIEVEMENT_SUBMISSION_UID).create({
      data: {
        tenant: tenantId,
        sportsProfile: Number(prepared.sportsProfile.id),
        club: Number(prepared.club.id),
        achievementType: prepared.achievementType,
        sportType: prepared.sportType,
        title: prepared.title,
        description: prepared.description,
        achievedAt: prepared.achievedAt,
        resultValue: prepared.resultValue,
        resultUnit: prepared.resultUnit,
        resultText: prepared.resultText,
        evidence: prepared.evidenceIds,
        source: prepared.source,
        sourceReference: prepared.sourceReference,
        status: prepared.status,
        submittedBy: prepared.status === 'submitted' ? authUser?.id || null : null,
        submittedAt: prepared.status === 'submitted' ? now : null,
        reviewNote: prepared.reviewNote,
        sourceAchievement: prepared.sourceAchievement?.id ? Number(prepared.sourceAchievement.id) : null,
        note: prepared.note,
      },
      ...(options.transacting ? { transacting: options.transacting } : {}),
    } as any);
    return await getTenantSportsAchievementSubmission(Number(created.id), tenantId);
  } catch (error) {
    toDomainError(error);
  }
}

export async function updateTenantSportsAchievementSubmission(submissionRef: unknown, payload: Record<string, unknown>, tenantId: number | string, authUser: AuthUser = null, options: { transacting?: any } = {}) {
  const current = await findSubmissionInTenant(submissionRef, tenantId, options.transacting);
  if (current.status === 'verified' || current.status === 'rejected') {
    httpError(409, 'Verified or rejected submissions are read-only. Use workflow actions instead.', 'SUBMISSION_READ_ONLY');
  }
  if (hasOwn(payload, 'status')) {
    const nextStatus = normalizeSubmissionStatus(payload.status);
    if (nextStatus !== current.status) {
      httpError(409, 'Use workflow actions to change submission status.', 'SUBMISSION_STATUS_ACTION_REQUIRED');
    }
  }
  try {
    const prepared = await prepareWriteData(payload || {}, tenantId, current, options.transacting);
    const updated = await strapi.db.query(SPORTS_ACHIEVEMENT_SUBMISSION_UID).update({
      where: { id: Number(current.id) },
      data: {
        sportsProfile: Number(prepared.sportsProfile.id),
        club: Number(prepared.club.id),
        achievementType: prepared.achievementType,
        sportType: prepared.sportType,
        title: prepared.title,
        description: prepared.description,
        achievedAt: prepared.achievedAt,
        resultValue: prepared.resultValue,
        resultUnit: prepared.resultUnit,
        resultText: prepared.resultText,
        evidence: prepared.evidenceIds,
        source: prepared.source,
        sourceReference: prepared.sourceReference,
        reviewNote: current.status === 'draft' ? null : prepared.reviewNote,
        sourceAchievement: prepared.sourceAchievement?.id ? Number(prepared.sourceAchievement.id) : (extractRelationRef(current.sourceAchievement) || null),
        note: prepared.note,
      },
      ...(options.transacting ? { transacting: options.transacting } : {}),
    } as any);
    return await getTenantSportsAchievementSubmission(Number(updated.id || current.id), tenantId);
  } catch (error) {
    toDomainError(error);
  }
}

export async function submitAchievementSubmission(submissionRef: unknown, tenantId: number | string, authUser: AuthUser = null, options: { transacting?: any } = {}) {
  const current = await findSubmissionInTenant(submissionRef, tenantId, options.transacting);
  if (current.status === 'submitted') {
    return mapSportsAchievementSubmissionRow(current, { includeLongText: true });
  }
  if (current.status !== 'draft') {
    httpError(409, 'Only draft submissions can be submitted.', 'SUBMISSION_SUBMIT_NOT_ALLOWED');
  }
  await strapi.db.query(SPORTS_ACHIEVEMENT_SUBMISSION_UID).update({
    where: { id: Number(current.id) },
    data: {
      status: 'submitted',
      submittedAt: current.submittedAt || new Date().toISOString(),
      submittedBy: extractRelationRef(current.submittedBy) || authUser?.id || null,
    },
    ...(options.transacting ? { transacting: options.transacting } : {}),
  } as any);
  return await getTenantSportsAchievementSubmission(Number(current.id), tenantId);
}

export async function cancelAchievementSubmission(submissionRef: unknown, tenantId: number | string, authUser: AuthUser = null, options: { transacting?: any } = {}) {
  const current = await findSubmissionInTenant(submissionRef, tenantId, options.transacting);
  if (current.status === 'cancelled') {
    return mapSportsAchievementSubmissionRow(current, { includeLongText: true });
  }
  if (!canCancelSubmissionStatus(current.status)) {
    httpError(409, 'Only draft or submitted submissions can be cancelled.', 'SUBMISSION_CANCEL_NOT_ALLOWED');
  }
  await strapi.db.query(SPORTS_ACHIEVEMENT_SUBMISSION_UID).update({
    where: { id: Number(current.id) },
    data: {
      status: 'cancelled',
      reviewedAt: new Date().toISOString(),
      reviewedBy: authUser?.id || extractRelationRef(current.reviewedBy) || null,
    },
    ...(options.transacting ? { transacting: options.transacting } : {}),
  } as any);
  return await getTenantSportsAchievementSubmission(Number(current.id), tenantId);
}

export async function rejectAchievementSubmission(submissionRef: unknown, tenantId: number | string, payload: Record<string, unknown>, authUser: AuthUser = null, options: { transacting?: any } = {}) {
  const current = await findSubmissionInTenant(submissionRef, tenantId, options.transacting);
  if (!canRejectSubmissionStatus(current.status)) {
    httpError(409, 'Only submitted submissions can be rejected.', 'SUBMISSION_REJECT_NOT_ALLOWED');
  }
  const reviewNote = hasOwn(payload || {}, 'reviewNote') ? normalizeOptionalText(payload.reviewNote) : normalizeOptionalText(current.reviewNote);
  await strapi.db.query(SPORTS_ACHIEVEMENT_SUBMISSION_UID).update({
    where: { id: Number(current.id) },
    data: {
      status: 'rejected',
      reviewedAt: new Date().toISOString(),
      reviewedBy: authUser?.id || null,
      reviewNote,
    },
    ...(options.transacting ? { transacting: options.transacting } : {}),
  } as any);
  return await getTenantSportsAchievementSubmission(Number(current.id), tenantId);
}

export async function verifyAchievementSubmission(submissionRef: unknown, tenantId: number | string, payload: Record<string, unknown>, authUser: AuthUser = null) {
  if (!authUser?.id) {
    httpError(401, 'Authenticated user is required for verification.', 'UNAUTHORIZED');
  }

  const submissionIdRef = whereByParam(submissionRef);
  if (!submissionIdRef?.id && !submissionIdRef?.documentId) {
    httpError(404, 'Sports achievement submission not found', 'SPORTS_ACHIEVEMENT_SUBMISSION_NOT_FOUND');
  }

  return await strapi.db.transaction(async ({ trx }: any) => {
    const current = await findSubmissionInTenant(submissionRef, tenantId, trx);
    await acquireSubmissionVerifyLock(trx, tenantId, Number(current.id));
    const locked = await findSubmissionInTenant(Number(current.id), tenantId, trx);

    if (locked.status === 'verified' && locked.achievement?.id) {
      return mapSportsAchievementSubmissionRow(locked, { includeLongText: true });
    }
    if (locked.status === 'verified' && !locked.achievement?.id) {
      httpError(409, 'Submission is marked verified but missing achievement relation.', 'SUBMISSION_VERIFY_INCONSISTENT');
    }
    if (!canVerifySubmissionStatus(locked.status) || locked.status !== 'submitted') {
      httpError(409, 'Only submitted submissions can be verified.', 'SUBMISSION_VERIFY_NOT_ALLOWED');
    }

    const reviewNote = hasOwn(payload || {}, 'reviewNote') ? normalizeOptionalText(payload.reviewNote) : normalizeOptionalText(locked.reviewNote);
    const achievement = await createVerifiedAchievementFromSubmission({
      ...locked,
      source: mapSubmissionSourceToAchievementSource(locked.source),
    }, tenantId, authUser, { transacting: trx });

    await strapi.db.query(SPORTS_ACHIEVEMENT_SUBMISSION_UID).update({
      where: { id: Number(locked.id) },
      data: {
        status: 'verified',
        reviewedAt: new Date().toISOString(),
        reviewedBy: authUser?.id || null,
        reviewNote,
        achievement: Number(achievement.id),
      },
      transacting: trx,
    } as any);

    return await getTenantSportsAchievementSubmission(Number(locked.id), tenantId);
  });
}

export async function createAndVerifyAchievementSubmission(payload: Record<string, unknown>, tenantId: number | string, authUser: AuthUser = null) {
  if (!authUser?.id) {
    httpError(401, 'Authenticated user is required for direct recording.', 'UNAUTHORIZED');
  }
  return await strapi.db.transaction(async ({ trx }: any) => {
    const created = await createTenantSportsAchievementSubmission({ ...payload, status: 'submitted', source: payload?.source || 'club_manager' }, tenantId, authUser, { transacting: trx });
    return await verifyAchievementSubmission(Number(created.id), tenantId, { reviewNote: payload?.reviewNote }, authUser);
  });
}

export async function createCorrectionSubmissionFromAchievement(achievementRef: unknown, tenantId: number | string, authUser: AuthUser = null, options: { transacting?: any } = {}) {
  if (!authUser?.id) {
    httpError(401, 'Authenticated user is required for correction submission.', 'UNAUTHORIZED');
  }
  const achievement = await findAchievementInTenant(achievementRef, tenantId, options.transacting);
  if (toText(achievement.status).toLowerCase() !== 'revoked') {
    httpError(409, 'Only revoked achievements can create correction submissions.', 'CORRECTION_REQUIRES_REVOKED_ACHIEVEMENT');
  }
  const existing = await findOpenCorrectionSubmissionForAchievement(Number(achievement.id), tenantId, options.transacting);
  if (existing?.id) {
    return mapSportsAchievementSubmissionRow(existing, { includeLongText: true });
  }
  return await createTenantSportsAchievementSubmission({
    sportsProfile: achievement?.sportsProfile?.id || extractRelationRef(achievement?.sportsProfile),
    club: achievement?.club?.id || extractRelationRef(achievement?.club),
    achievementType: achievement?.achievementType,
    sportType: achievement?.sportType,
    title: achievement?.title,
    description: achievement?.description,
    achievedAt: achievement?.achievedAt,
    resultValue: achievement?.resultValue,
    resultUnit: achievement?.resultUnit,
    resultText: achievement?.resultText,
    evidence: Array.isArray(achievement?.evidence) ? achievement.evidence.map((item: any) => item?.id || extractRelationRef(item)).filter(Boolean) : [],
    source: 'club_manager',
    sourceReference: achievement?.sourceReference,
    note: achievement?.note,
    status: 'draft',
    sourceAchievement: Number(achievement.id),
  }, tenantId, authUser, options);
}

export function handleSportsAchievementSubmissionError(ctx: any, error: any) {
  if (error instanceof SportsAchievementSubmissionError) {
    ctx.status = error.status;
    ctx.body = {
      error: {
        status: error.status,
        name: 'SportsAchievementSubmissionError',
        message: error.message,
        code: error.code || undefined,
        details: error.details || undefined,
      },
    };
    return;
  }

  const message = parseErrorMessage(error);
  if (message) {
    ctx.badRequest(message);
    return;
  }

  strapi.log.error('[sports-achievement-submission] unexpected error', error);
  ctx.internalServerError('Failed to process sports achievement submission request');
}
