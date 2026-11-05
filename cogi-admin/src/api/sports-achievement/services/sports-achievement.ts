import { extractRelationRef, hasOwn, mergeTenantWhere, normalizeSortInput, toText, whereByParam } from '../../../utils/tenant-scope';
import {
  ACHIEVEMENT_SOURCE_VALUES,
  ACHIEVEMENT_STATUS_VALUES,
  ACHIEVEMENT_TYPE_VALUES,
  AuthUser,
  buildPagination,
  ensureNoManagedTenantField,
  ensureNoUnknownFields,
  findSportsClubInTenant,
  findSportsProfileInTenant,
  findUserByRef,
  GenericRecord,
  HttpErrorDetails,
  mapSportsAchievementRow,
  normalizeAchievementSource,
  normalizeAchievementStatus,
  normalizeAchievementType,
  normalizeDateTime,
  normalizeDistanceKm,
  normalizeDurationSeconds,
  normalizeEvidenceRefs,
  normalizeBooleanFlag,
  normalizeOptionalRelationRef,
  normalizeOptionalText,
  normalizePaginationQuery,
  normalizePopulateForAchievement,
  normalizePositiveNumber,
  normalizeRequiredRelationRef,
  normalizeRequiredText,
  normalizeRaceType,
  normalizeSportType,
  isRunningPerformanceType,
  formatDurationSeconds,
  parseErrorMessage,
  SPORTS_ACHIEVEMENT_UID,
} from './achievement-shared';

export class SportsAchievementError extends Error {
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
  throw new SportsAchievementError(status, message, code, details);
}

function toDomainError(error: any): never {
  if (error instanceof SportsAchievementError) throw error;
  const status = Number(error?.status || 0);
  if (status > 0) {
    throw new SportsAchievementError(status, error.message || 'Invalid sports achievement request', error.code || null, error.details || null);
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
    'eventCode',
    'raceType',
    'bib',
    'distancePending',
    'description',
    'achievedAt',
    'resultValue',
    'distanceKm',
    'durationSeconds',
    'resultUnit',
    'resultText',
    'source',
    'sourceReference',
    'shareTemplate',
    'shareTemplateSource',
    'evidence',
    'note',
    'verifiedAt',
    'verifiedBy',
    'status',
  ]);
  ensureNoManagedTenantField(payload);
}

function ensureNoWorkflowWriteFields(payload: GenericRecord, options: { allowWorkflowFields?: boolean } = {}) {
  if (options.allowWorkflowFields) return;
  const workflowFields = ['status', 'verifiedAt', 'verifiedBy', 'revokedAt', 'revokedBy', 'revokeReason'];
  const attemptedFields = workflowFields.filter((field) => hasOwn(payload, field));
  if (attemptedFields.length > 0) {
    httpError(400, 'workflow fields are managed by the system', 'WORKFLOW_FIELDS_READONLY', { fields: attemptedFields });
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
  const achievedFrom = normalizeDateTime(query.achievedFrom, 'achievedFrom');
  const achievedTo = normalizeDateTime(query.achievedTo, 'achievedTo');
  const verifiedFrom = normalizeDateTime(query.verifiedFrom, 'verifiedFrom');
  const verifiedTo = normalizeDateTime(query.verifiedTo, 'verifiedTo');

  if (keyword) {
    clauses.push({
      $or: [
        { title: { $containsi: keyword } },
        { eventCode: { $containsi: keyword } },
        { raceType: { $containsi: keyword } },
        { bib: { $containsi: keyword } },
        { description: { $containsi: keyword } },
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
    if (!ACHIEVEMENT_STATUS_VALUES.has(status)) httpError(400, 'status is invalid', 'INVALID_STATUS', { field: 'status' });
    clauses.push({ status: { $eq: status } });
  }
  if (source) {
    if (!ACHIEVEMENT_SOURCE_VALUES.has(source)) httpError(400, 'source is invalid', 'INVALID_SOURCE', { field: 'source' });
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
  if (achievedFrom) clauses.push({ achievedAt: { $gte: achievedFrom } });
  if (achievedTo) clauses.push({ achievedAt: { $lte: achievedTo } });
  if (verifiedFrom) clauses.push({ verifiedAt: { $gte: verifiedFrom } });
  if (verifiedTo) clauses.push({ verifiedAt: { $lte: verifiedTo } });

  if (clauses.length === 0) return {};
  if (clauses.length === 1) return clauses[0];
  return { $and: clauses };
}

function resolveOrderBy(query: Record<string, unknown>) {
  const normalizedSort = normalizeSortInput(query?.sort);
  if (normalizedSort.length > 0) {
    const allowed = new Set(['title', 'achievementType', 'sportType', 'status', 'source', 'achievedAt', 'verifiedAt', 'updatedAt', 'createdAt']);
    const safe = normalizedSort
      .map((entry) => {
        const key = Object.keys(entry || {})[0];
        if (!key || !allowed.has(key)) return null;
        return { [key]: entry[key] };
      })
      .filter(Boolean);
    if (safe.length > 0) return safe as Array<Record<string, 'asc' | 'desc'>>;
  }
  return [{ verifiedAt: 'desc' }, { achievedAt: 'desc' }, { createdAt: 'desc' }];
}

export async function findAchievementInTenant(achievementRef: unknown, tenantId: number | string, transacting?: any) {
  const where = whereByParam(achievementRef);
  if (!where) {
    httpError(404, 'Sports achievement not found', 'SPORTS_ACHIEVEMENT_NOT_FOUND');
  }
  const row = await strapi.db.query(SPORTS_ACHIEVEMENT_UID).findOne({
    where: mergeTenantWhere(where, tenantId),
    populate: normalizePopulateForAchievement(),
    ...(transacting ? { transacting } : {}),
  } as any);
  if (!row?.id) {
    httpError(404, 'Sports achievement not found', 'SPORTS_ACHIEVEMENT_NOT_FOUND');
  }
  return row;
}

async function prepareWriteData(
  input: GenericRecord,
  tenantId: number | string,
  existing?: any,
  transacting?: any,
  options: { allowWorkflowFields?: boolean } = {},
) {
  ensureNoUnknownWriteFields(input);
  ensureNoWorkflowWriteFields(input, options);

  try {
    const sportsProfileRef = hasOwn(input, 'sportsProfile') ? normalizeRequiredRelationRef(input.sportsProfile, 'sportsProfile') : normalizeOptionalRelationRef(existing?.sportsProfile);
    if (!sportsProfileRef) httpError(400, 'sportsProfile is required', 'INVALID_REQUEST_BODY', { field: 'sportsProfile' });
    const clubRef = hasOwn(input, 'club') ? normalizeOptionalRelationRef(input.club) : normalizeOptionalRelationRef(existing?.club);
    const verifiedByRef = hasOwn(input, 'verifiedBy') ? normalizeOptionalRelationRef(input.verifiedBy) : normalizeOptionalRelationRef(existing?.verifiedBy);

    const sportsProfile = await findSportsProfileInTenant(sportsProfileRef, tenantId, transacting);
    const club = clubRef ? await findSportsClubInTenant(clubRef, tenantId, transacting) : null;
    const verifiedBy = verifiedByRef ? await findUserByRef(verifiedByRef, transacting) : null;

    const status = hasOwn(input, 'status') ? normalizeAchievementStatus(input.status) : normalizeAchievementStatus(existing?.status);
    const achievementType = hasOwn(input, 'achievementType') ? normalizeAchievementType(input.achievementType) : normalizeAchievementType(existing?.achievementType);
    const title = hasOwn(input, 'title') ? normalizeRequiredText(input.title, 'title', 200) : normalizeRequiredText(existing?.title, 'title', 200);
    const eventCode = hasOwn(input, 'eventCode') ? normalizeOptionalText(input.eventCode, 120) : normalizeOptionalText(existing?.eventCode, 120);
    const raceType = hasOwn(input, 'raceType') ? normalizeRaceType(input.raceType) : normalizeRaceType(existing?.raceType);
    const bib = hasOwn(input, 'bib') ? normalizeOptionalText(input.bib, 120) : normalizeOptionalText(existing?.bib, 120);
    const requestedDistancePending = hasOwn(input, 'distancePending') ? normalizeBooleanFlag(input.distancePending, 'distancePending') : normalizeBooleanFlag(existing?.distancePending, 'distancePending');
    const description = hasOwn(input, 'description') ? normalizeOptionalText(input.description) : normalizeOptionalText(existing?.description);
    const sportType = hasOwn(input, 'sportType') ? normalizeSportType(input.sportType) : normalizeSportType(existing?.sportType);
    const achievedAt = hasOwn(input, 'achievedAt') ? normalizeDateTime(input.achievedAt, 'achievedAt') : normalizeDateTime(existing?.achievedAt, 'achievedAt');
    const resultValue = hasOwn(input, 'resultValue') ? normalizePositiveNumber(input.resultValue, 'resultValue') : normalizePositiveNumber(existing?.resultValue, 'resultValue');
    const distanceKm = hasOwn(input, 'distanceKm') ? normalizeDistanceKm(input.distanceKm) : normalizeDistanceKm(existing?.distanceKm);
    const durationSeconds = hasOwn(input, 'durationSeconds') ? normalizeDurationSeconds(input.durationSeconds) : normalizeDurationSeconds(existing?.durationSeconds);
    const resultUnit = hasOwn(input, 'resultUnit') ? normalizeOptionalText(input.resultUnit, 50) : normalizeOptionalText(existing?.resultUnit, 50);
    const resultText = hasOwn(input, 'resultText') ? normalizeOptionalText(input.resultText, 255) : normalizeOptionalText(existing?.resultText, 255);
    const source = hasOwn(input, 'source') ? normalizeAchievementSource(input.source) : normalizeAchievementSource(existing?.source || 'manual');
    const sourceReference = hasOwn(input, 'sourceReference') ? normalizeOptionalText(input.sourceReference, 255) : normalizeOptionalText(existing?.sourceReference, 255);
    const shareTemplate = hasOwn(input, 'shareTemplate') ? normalizeOptionalRelationRef(input.shareTemplate) : normalizeOptionalRelationRef(existing?.shareTemplate);
    const shareTemplateSource = hasOwn(input, 'shareTemplateSource') ? toText(input.shareTemplateSource).toLowerCase() : toText(existing?.shareTemplateSource || 'none').toLowerCase();
    if (!['explicit', 'auto', 'none'].includes(shareTemplateSource)) {
      httpError(400, 'shareTemplateSource is invalid', 'INVALID_SHARE_TEMPLATE_SOURCE', { field: 'shareTemplateSource' });
    }
    const evidenceIds = hasOwn(input, 'evidence') ? normalizeEvidenceRefs(input.evidence) : normalizeEvidenceRefs(existing?.evidence);
    const note = hasOwn(input, 'note') ? normalizeOptionalText(input.note) : normalizeOptionalText(existing?.note);
    const verifiedAt = hasOwn(input, 'verifiedAt') ? normalizeDateTime(input.verifiedAt, 'verifiedAt') : normalizeDateTime(existing?.verifiedAt, 'verifiedAt');
    const runningMode = isRunningPerformanceType(sportType, achievementType);
    const allowsMissingDistance = runningMode && achievementType === 'race_result';
    const distancePending = distanceKm === null ? requestedDistancePending : false;
    if (runningMode) {
      if (!achievedAt) httpError(400, 'achievedAt is required for running results', 'INVALID_REQUEST_BODY', { field: 'achievedAt' });
      if (durationSeconds === null) httpError(400, 'durationSeconds is required for running results', 'INVALID_REQUEST_BODY', { field: 'durationSeconds' });
      if (distanceKm === null) {
        if (!allowsMissingDistance) {
          httpError(400, 'distanceKm is required for running results', 'INVALID_REQUEST_BODY', { field: 'distanceKm' });
        }
        if (!distancePending) {
          httpError(400, 'distanceKm is required for running results unless distancePending is explicitly true', 'INVALID_REQUEST_BODY', { field: 'distanceKm' });
        }
      }
    }

    return {
      sportsProfile,
      club,
      verifiedBy,
      status,
      achievementType,
      title,
      eventCode,
      raceType,
      bib,
      distancePending,
      description,
      sportType,
      achievedAt,
      resultValue: runningMode ? durationSeconds : resultValue,
      distanceKm,
      durationSeconds,
      resultUnit: runningMode ? 'seconds' : resultUnit,
      resultText: runningMode ? formatDurationSeconds(durationSeconds) : resultText,
      source,
      sourceReference,
      shareTemplate,
      shareTemplateSource,
      evidenceIds,
      note,
      verifiedAt,
    };
  } catch (error) {
    toDomainError(error);
  }
}

export async function listTenantSportsAchievements(query: Record<string, unknown>, tenantId: number | string) {
  const { page, pageSize, start } = normalizePaginationQuery(query || {});
  const where = mergeTenantWhere(buildListWhere(query || {}), tenantId);
  const orderBy = resolveOrderBy(query || {});

  const [rows, total] = await Promise.all([
    strapi.db.query(SPORTS_ACHIEVEMENT_UID).findMany({
      where,
      orderBy,
      offset: start,
      limit: pageSize,
      populate: normalizePopulateForAchievement(),
    } as any),
    strapi.db.query(SPORTS_ACHIEVEMENT_UID).count({ where } as any),
  ]);

  return {
    rows: (rows || []).map((row: any) => mapSportsAchievementRow(row)).filter(Boolean),
    pagination: buildPagination(page, pageSize, total),
  };
}

export async function getTenantSportsAchievement(achievementRef: unknown, tenantId: number | string) {
  return mapSportsAchievementRow(await findAchievementInTenant(achievementRef, tenantId), { includeLongText: true });
}

export async function createTenantSportsAchievement(
  payload: Record<string, unknown>,
  tenantId: number | string,
  authUser: AuthUser = null,
  options: { transacting?: any; allowWorkflowFields?: boolean } = {},
) {
  try {
    const prepared = await prepareWriteData(payload || {}, tenantId, undefined, options.transacting, { allowWorkflowFields: options.allowWorkflowFields === true });
    const now = new Date().toISOString();
    const created = await strapi.db.query(SPORTS_ACHIEVEMENT_UID).create({
      data: {
        tenant: tenantId,
        sportsProfile: Number(prepared.sportsProfile.id),
        club: prepared.club?.id ? Number(prepared.club.id) : null,
        achievementType: prepared.achievementType,
        sportType: prepared.sportType,
        title: prepared.title,
        eventCode: prepared.eventCode,
        raceType: prepared.raceType,
        bib: prepared.bib,
        distancePending: prepared.distancePending,
        description: prepared.description,
        achievedAt: prepared.achievedAt,
        resultValue: prepared.resultValue,
        distanceKm: prepared.distanceKm,
        durationSeconds: prepared.durationSeconds,
        resultUnit: prepared.resultUnit,
        resultText: prepared.resultText,
        source: prepared.source,
        sourceReference: prepared.sourceReference,
        shareTemplate: prepared.shareTemplate ? Number(prepared.shareTemplate) : null,
        shareTemplateSource: prepared.shareTemplateSource || 'none',
        evidence: prepared.evidenceIds,
        note: prepared.note,
        status: prepared.status || 'active',
        verifiedAt: prepared.verifiedAt || now,
        verifiedBy: prepared.verifiedBy?.id || authUser?.id || null,
      },
      ...(options.transacting ? { transacting: options.transacting } : {}),
    } as any);
    return await getTenantSportsAchievement(Number(created.id), tenantId);
  } catch (error) {
    toDomainError(error);
  }
}

export async function updateTenantSportsAchievement(
  achievementRef: unknown,
  payload: Record<string, unknown>,
  tenantId: number | string,
  authUser: AuthUser = null,
  options: { transacting?: any; allowWorkflowFields?: boolean } = {},
) {
  const current = await findAchievementInTenant(achievementRef, tenantId, options.transacting);
  try {
    const prepared = await prepareWriteData(payload || {}, tenantId, current, options.transacting, { allowWorkflowFields: options.allowWorkflowFields === true });
    const updated = await strapi.db.query(SPORTS_ACHIEVEMENT_UID).update({
      where: { id: Number(current.id) },
      data: {
        sportsProfile: Number(prepared.sportsProfile.id),
        club: prepared.club?.id ? Number(prepared.club.id) : null,
        achievementType: prepared.achievementType,
        sportType: prepared.sportType,
        title: prepared.title,
        eventCode: prepared.eventCode,
        raceType: prepared.raceType,
        bib: prepared.bib,
        distancePending: prepared.distancePending,
        description: prepared.description,
        achievedAt: prepared.achievedAt,
        resultValue: prepared.resultValue,
        distanceKm: prepared.distanceKm,
        durationSeconds: prepared.durationSeconds,
        resultUnit: prepared.resultUnit,
        resultText: prepared.resultText,
        source: prepared.source,
        sourceReference: prepared.sourceReference,
        shareTemplate: prepared.shareTemplate ? Number(prepared.shareTemplate) : null,
        shareTemplateSource: prepared.shareTemplateSource || 'none',
        evidence: prepared.evidenceIds,
        note: prepared.note,
        status: prepared.status,
        verifiedAt: prepared.verifiedAt || current.verifiedAt || new Date().toISOString(),
        verifiedBy: prepared.verifiedBy?.id || extractRelationRef(current.verifiedBy) || authUser?.id || null,
        revokedAt: current.revokedAt || null,
        revokedBy: extractRelationRef(current.revokedBy) || null,
        revokeReason: current.revokeReason || null,
      },
      ...(options.transacting ? { transacting: options.transacting } : {}),
    } as any);
    return await getTenantSportsAchievement(Number(updated.id || current.id), tenantId);
  } catch (error) {
    toDomainError(error);
  }
}

export async function revokeSportsAchievement(achievementRef: unknown, tenantId: number | string, payload: Record<string, unknown>, authUser: AuthUser = null, options: { transacting?: any } = {}) {
  if (!authUser?.id) {
    httpError(401, 'Authenticated user is required for revoke.', 'UNAUTHORIZED');
  }
  const current = await findAchievementInTenant(achievementRef, tenantId, options.transacting);
  if (toText(current.status).toLowerCase() === 'revoked') {
    httpError(409, 'Sports achievement already revoked.', 'SPORTS_ACHIEVEMENT_ALREADY_REVOKED');
  }
  const revokeReason = normalizeOptionalText(payload?.reason || payload?.revokeReason);
  if (!revokeReason) {
    httpError(400, 'revokeReason is required', 'INVALID_REQUEST_BODY', { field: 'revokeReason' });
  }
  await strapi.db.query(SPORTS_ACHIEVEMENT_UID).update({
    where: { id: Number(current.id) },
    data: {
      status: 'revoked',
      revokedAt: new Date().toISOString(),
      revokedBy: authUser.id,
      revokeReason,
    },
    ...(options.transacting ? { transacting: options.transacting } : {}),
  } as any);
  return await getTenantSportsAchievement(Number(current.id), tenantId);
}

export async function createVerifiedAchievementFromSubmission(submission: any, tenantId: number | string, authUser: AuthUser, options: { transacting?: any } = {}) {
  const shareTemplateRef = submission?.shareTemplate?.id || extractRelationRef(submission?.shareTemplate) || submission?.shareTemplateId || submission?.shareTemplate || null;
  const shareTemplateSource = submission?.shareTemplateSource || (shareTemplateRef ? 'explicit' : 'none');
  const result = await createTenantSportsAchievement({
    sportsProfile: submission?.sportsProfile?.id || extractRelationRef(submission?.sportsProfile),
    club: submission?.club?.id || extractRelationRef(submission?.club),
    achievementType: submission?.achievementType,
    sportType: submission?.sportType,
    title: submission?.title,
    eventCode: submission?.eventCode,
    raceType: submission?.raceType,
    bib: submission?.bib,
    distancePending: Boolean(submission?.distancePending),
    description: submission?.description,
    achievedAt: submission?.achievedAt,
    resultValue: submission?.resultValue,
    distanceKm: submission?.distanceKm,
    durationSeconds: submission?.durationSeconds,
    resultUnit: submission?.resultUnit,
    resultText: submission?.resultText,
    source: submission?.source,
    sourceReference: submission?.sourceReference,
    shareTemplate: shareTemplateRef,
    shareTemplateSource,
    evidence: Array.isArray(submission?.evidence) ? submission.evidence.map((item: any) => item?.id || extractRelationRef(item)).filter(Boolean) : [],
    note: submission?.note,
    status: 'active',
    verifiedAt: new Date().toISOString(),
    verifiedBy: authUser?.id || null,
  }, tenantId, authUser, { ...options, allowWorkflowFields: true });
  return result;
}

export function handleSportsAchievementError(ctx: any, error: any) {
  if (error instanceof SportsAchievementError) {
    ctx.status = error.status;
    ctx.body = {
      error: {
        status: error.status,
        name: 'SportsAchievementError',
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

  strapi.log.error('[sports-achievement] unexpected error', error);
  ctx.internalServerError('Failed to process sports achievement request');
}
