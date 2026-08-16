import { errors } from '@strapi/utils';

import { extractRelationRef, mergeTenantWhere, normalizeSortInput, toPositiveInt, toText, whereByParam } from '../../../utils/tenant-scope';

const EXAM_REGISTRATION_UID = 'api::exam-registration.exam-registration';
const EXAM_REGISTRATION_SUBJECT_UID = 'api::exam-registration-subject.exam-registration-subject';
const EXAM_REGISTRATION_COMPONENT_UID = 'api::exam-registration-component.exam-registration-component';
const EXAM_ROUND_UID = 'api::exam-round.exam-round';
const EXAM_ROUND_SUBJECT_UID = 'api::exam-round-subject.exam-round-subject';
const EXAM_ROUND_COMPONENT_UID = 'api::exam-round-component.exam-round-component';
const EXAM_ELIGIBILITY_UID = 'api::exam-eligibility.exam-eligibility';
const EXAM_PAYMENT_UID = 'api::exam-payment.exam-payment';
const EXAM_CANDIDATE_UID = 'api::exam-candidate.exam-candidate';

const MAX_PAGE_SIZE = 100;
const REVIEWABLE_ROUND_STATUSES = new Set(['registration_open', 'registration_paused', 'registration_closed', 'preparing_exam']);
const REGISTRATION_REVIEWABLE_STATUSES = new Set(['submitted', 'pending_review']);
const REGISTRATION_ACTIVE_STATUSES = new Set(['registered', 'accepted']);
const REGISTRATION_ACCEPT_PAYMENT_STATUSES = new Set(['paid', 'not_required', 'exempted']);

type AuthUser = {
  id: number;
  username?: string | null;
  fullName?: string | null;
  email?: string | null;
};

type HttpErrorDetails = Record<string, unknown> | Array<Record<string, unknown>> | null;
type EligibilityStatus = 'pending' | 'eligible' | 'temporarily_ineligible' | 'ineligible';
type RegistrationStatus = 'draft' | 'submitted' | 'pending_review' | 'accepted' | 'returned' | 'rejected' | 'cancelled' | 'completed';

type ReviewHistoryEntry = {
  action: string;
  timestamp: string;
  actorUserId: number | null;
  actorDisplayName: string | null;
  fromRegistrationStatus: RegistrationStatus | string | null;
  toRegistrationStatus: RegistrationStatus | string | null;
  fromEligibilityStatus: EligibilityStatus | string | null;
  toEligibilityStatus: EligibilityStatus | string | null;
  note: string | null;
  reason: string | null;
  metadata: Record<string, unknown> | null;
};

type ReadinessResult = {
  structureReady: boolean;
  eligibilityReady: boolean;
  paymentReady: boolean;
  learnerReady: boolean;
  reviewStateReady: boolean;
  candidateReady: boolean;
  canAccept: boolean;
  readyForReview: boolean;
  blockingReasons: string[];
};

type StructureValidationResult = {
  ok: boolean;
  errors: Array<{ path: string; code: string; message: string; details?: Record<string, unknown> }>;
  effectiveSubjectCount: number;
  effectiveComponentCount: number;
};

export class HttpError extends Error {
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
  throw new HttpError(status, message, code, details);
}

function normalizeText(value: unknown): string {
  return toText(value);
}

function normalizeOptionalText(value: unknown, maxLength?: number): string | null {
  const text = normalizeText(value);
  if (!text) return null;
  if (maxLength && text.length > maxLength) {
    httpError(400, `Text exceeds max length ${maxLength}`, 'INVALID_REQUEST_BODY');
  }
  return text;
}

function normalizeRequiredText(value: unknown, fieldName: string, code = 'INVALID_REQUEST_BODY', maxLength?: number): string {
  const text = normalizeText(value);
  if (!text) {
    httpError(400, `${fieldName} is required`, code);
  }
  if (maxLength && text.length > maxLength) {
    httpError(400, `${fieldName} max length is ${maxLength}`, code);
  }
  return text;
}

function ensureNoUnknownFields(payload: Record<string, unknown>, allowedKeys: string[], entityName: string) {
  const unknownKeys = Object.keys(payload || {}).filter((key) => !allowedKeys.includes(key));
  if (unknownKeys.length > 0) {
    httpError(400, `${entityName} contains unknown fields`, 'UNKNOWN_FIELDS', { entity: entityName, fields: unknownKeys });
  }
}

function decimalToNumber(value: unknown): number | null {
  const text = normalizeText(value);
  if (!text) return null;
  const numeric = Number(text);
  return Number.isFinite(numeric) ? numeric : null;
}

function roundMoney(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function toMoney(value: unknown, fallback = 0): number {
  const numeric = decimalToNumber(value);
  return roundMoney(numeric === null ? fallback : numeric);
}

function normalizeStoredDateTime(value: unknown): string | null {
  const text = normalizeText(value);
  if (!text) return null;
  const timestamp = Date.parse(text);
  if (Number.isNaN(timestamp)) return null;
  return new Date(timestamp).toISOString();
}

function normalizeEligibilityStatus(value: unknown, fallback: EligibilityStatus = 'pending'): EligibilityStatus {
  const text = normalizeText(value).toLowerCase();
  if (!text) return fallback;
  if (!['pending', 'eligible', 'temporarily_ineligible', 'ineligible'].includes(text)) {
    return fallback;
  }
  return text as EligibilityStatus;
}

function normalizeRegistrationStatus(value: unknown, fallback: RegistrationStatus = 'submitted'): RegistrationStatus {
  const text = normalizeText(value).toLowerCase();
  if (!text) return fallback;
  if (!['draft', 'submitted', 'pending_review', 'accepted', 'returned', 'rejected', 'cancelled', 'completed'].includes(text)) {
    return fallback;
  }
  return text as RegistrationStatus;
}

function buildUserDisplayName(user: Pick<AuthUser, 'id' | 'fullName' | 'username' | 'email'> | null | undefined): string {
  if (!user?.id) return '';
  return normalizeText(user.fullName) || normalizeText(user.username) || normalizeText(user.email) || `User #${String(user.id)}`;
}

function summarizeWorkflowActor(user: Pick<AuthUser, 'id' | 'fullName' | 'username' | 'email'> | null | undefined) {
  if (!user?.id) return null;
  return {
    id: Number(user.id),
    displayName: buildUserDisplayName(user),
  };
}

function isPostgresClient() {
  const client = String(strapi.db?.connection?.client?.config?.client || '').toLowerCase();
  return client.includes('pg');
}

async function acquireRegistrationReviewLock(trx: any, tenantId: number, registrationId: number) {
  if (!isPostgresClient()) return;
  await trx.raw('select pg_advisory_xact_lock(hashtext(?), hashtext(?))', [String(tenantId), `exam-payment:registration:${registrationId}`]);
}

function normalizeStartReviewInput(payload: Record<string, unknown>) {
  ensureNoUnknownFields(payload, ['note'], 'payload');
  return {
    note: normalizeOptionalText(payload.note, 2000),
  };
}

function normalizeEligibilityTransitionInput(payload: Record<string, unknown>, options: { requireReason: boolean }) {
  ensureNoUnknownFields(payload, ['reason', 'note'], 'payload');
  const reason = normalizeOptionalText(payload.reason, 2000);
  if (options.requireReason && !reason) {
    httpError(400, 'reason is required', 'ELIGIBILITY_REASON_REQUIRED');
  }
  return {
    reason,
    note: normalizeOptionalText(payload.note, 2000),
  };
}

function normalizeAcceptInput(payload: Record<string, unknown>) {
  ensureNoUnknownFields(payload, ['note'], 'payload');
  return {
    note: normalizeOptionalText(payload.note, 2000),
  };
}

function normalizeRejectInput(payload: Record<string, unknown>) {
  ensureNoUnknownFields(payload, ['reason', 'note'], 'payload');
  return {
    reason: normalizeRequiredText(payload.reason, 'reason', 'REGISTRATION_REJECTION_REASON_REQUIRED', 2000),
    note: normalizeOptionalText(payload.note, 2000),
  };
}

function normalizeReturnInput(payload: Record<string, unknown>) {
  ensureNoUnknownFields(payload, ['reason', 'note'], 'payload');
  return {
    reason: normalizeRequiredText(payload.reason, 'reason', 'RETURN_REASON_REQUIRED', 2000),
    note: normalizeOptionalText(payload.note, 2000),
  };
}

async function loadRoundInTenant(tenantId: number, roundRef: unknown, transacting?: any) {
  const where = whereByParam(roundRef);
  if (!where) {
    httpError(404, 'Không tìm thấy đợt thi trong tenant hiện tại.', 'EXAM_ROUND_NOT_FOUND');
  }

  const row = await strapi.db.query(EXAM_ROUND_UID).findOne({
    where: mergeTenantWhere(where, tenantId),
    select: ['id', 'documentId', 'code', 'name', 'status', 'registrationMode', 'requireConfirmedPayment'],
    ...(transacting ? { transacting } : {}),
  } as any) as any;

  if (!row?.id) {
    httpError(404, 'Không tìm thấy đợt thi trong tenant hiện tại.', 'EXAM_ROUND_NOT_FOUND');
  }

  return row;
}

async function loadRegistrationInTenant(tenantId: number, registrationRef: unknown, transacting?: any) {
  const where = whereByParam(registrationRef);
  if (!where) {
    httpError(404, 'Không tìm thấy exam registration trong tenant hiện tại.', 'EXAM_REGISTRATION_NOT_FOUND');
  }

  const row = await strapi.db.query(EXAM_REGISTRATION_UID).findOne({
    where: mergeTenantWhere(where, tenantId),
    select: [
      'id',
      'documentId',
      'registrationCode',
      'registeredAt',
      'registrationStatus',
      'eligibilityStatus',
      'paymentStatus',
      'calculatedAmount',
      'discountAmount',
      'payableAmount',
      'confirmedPaidAmount',
      'studentCodeSnapshot',
      'fullNameSnapshot',
      'classNameSnapshot',
      'cohortSnapshot',
      'majorSnapshot',
      'note',
      'reviewedAt',
      'reviewNote',
      'acceptedAt',
      'returnedAt',
      'returnReason',
      'rejectedAt',
      'rejectionReason',
      'eligibilityReason',
      'reviewHistory',
    ],
    populate: {
      learner: { select: ['id', 'code', 'fullName', 'learnerStatus', 'dateOfBirth', 'parentPhone'] },
      examRound: {
        select: ['id', 'documentId', 'code', 'name', 'registrationMode', 'requireConfirmedPayment', 'paymentCalculationMethod', 'status'],
      },
      reviewedBy: { select: ['id', 'username', 'fullName', 'email'] },
      acceptedBy: { select: ['id', 'username', 'fullName', 'email'] },
      returnedBy: { select: ['id', 'username', 'fullName', 'email'] },
      rejectedBy: { select: ['id', 'username', 'fullName', 'email'] },
      tenant: { select: ['id'] },
      subjectRegistrations: {
        select: ['id', 'participationType', 'registrationStatus', 'feeAmount', 'subjectResultStatus', 'note'],
        populate: {
          examRoundSubject: {
            select: ['id', 'nameSnapshot', 'status', 'isRequired', 'allowSeparateRegistration', 'fee', 'calculationMethodSnapshot', 'requiredAggregateScoreSnapshot', 'requireAllComponentsSnapshot'],
          },
          componentRegistrations: {
            select: ['id', 'participationType', 'registrationStatus', 'eligibilityStatus', 'schedulingStatus', 'attendanceStatus', 'resultStatus', 'feeAmount', 'note'],
            populate: {
              examRoundComponent: {
                select: ['id', 'nameSnapshot', 'status', 'isRequired', 'allowSeparateRegistration', 'durationMinutes', 'fee'],
                populate: {
                  examRoundSubject: { select: ['id'] },
                },
              },
            },
          },
        },
      },
    },
    ...(transacting ? { transacting } : {}),
  } as any) as any;

  if (!row?.id) {
    httpError(404, 'Không tìm thấy exam registration trong tenant hiện tại.', 'EXAM_REGISTRATION_NOT_FOUND');
  }

  return row;
}

async function loadRoundStructure(tenantId: number, roundId: number, transacting?: any) {
  const [roundSubjects, roundComponents] = await Promise.all([
    strapi.db.query(EXAM_ROUND_SUBJECT_UID).findMany({
      where: mergeTenantWhere({ examRound: { id: { $eq: roundId } } }, tenantId),
      select: ['id', 'status', 'isRequired', 'allowSeparateRegistration', 'nameSnapshot'],
      ...(transacting ? { transacting } : {}),
    } as any),
    strapi.db.query(EXAM_ROUND_COMPONENT_UID).findMany({
      where: mergeTenantWhere({ examRound: { id: { $eq: roundId } } }, tenantId),
      select: ['id', 'status', 'isRequired', 'allowSeparateRegistration', 'nameSnapshot'],
      populate: {
        examRoundSubject: { select: ['id'] },
      },
      ...(transacting ? { transacting } : {}),
    } as any),
  ]);

  return { roundSubjects: roundSubjects || [], roundComponents: roundComponents || [] };
}

async function loadEligibilityForRegistration(tenantId: number, registration: any, transacting?: any) {
  const roundId = Number(extractRelationRef(registration?.examRound) || registration?.examRound?.id || 0);
  const learnerId = Number(extractRelationRef(registration?.learner) || registration?.learner?.id || 0);
  if (!roundId || !learnerId) return null;
  const rows = await strapi.db.query(EXAM_ELIGIBILITY_UID).findMany({
    where: mergeTenantWhere({
      examRound: { id: { $eq: roundId } },
      learner: { id: { $eq: learnerId } },
    }, tenantId),
    select: ['id', 'eligibilityStatus', 'reason', 'source', 'reviewedAt'],
    populate: {
      reviewedBy: { select: ['id', 'username', 'fullName', 'email'] },
    },
    orderBy: [{ reviewedAt: 'desc' }, { id: 'desc' }],
    limit: 1,
    ...(transacting ? { transacting } : {}),
  } as any) as any[];
  return rows[0] || null;
}

async function loadPaymentsForRegistration(tenantId: number, registrationId: number, transacting?: any) {
  return await strapi.db.query(EXAM_PAYMENT_UID).findMany({
    where: mergeTenantWhere({ examRegistration: { id: { $eq: registrationId } } }, tenantId),
    select: ['id', 'documentId', 'amount', 'paymentMethod', 'transactionCode', 'paidAt', 'reportedAt', 'status', 'verifiedAt', 'rejectionReason'],
    populate: {
      evidenceFiles: { select: ['id'] },
      reportedBy: { select: ['id', 'username', 'fullName', 'email'] },
      verifiedBy: { select: ['id', 'username', 'fullName', 'email'] },
    },
    orderBy: [{ reportedAt: 'desc' }, { id: 'desc' }],
    ...(transacting ? { transacting } : {}),
  } as any) as any[];
}

async function countCandidatesForRegistration(tenantId: number, registrationId: number, transacting?: any) {
  return await strapi.db.query(EXAM_CANDIDATE_UID).count({
    where: mergeTenantWhere({ examRegistration: { id: { $eq: registrationId } } }, tenantId),
    ...(transacting ? { transacting } : {}),
  } as any);
}

function assertReviewableRoundStatus(round: any) {
  const roundStatus = normalizeText(round?.status).toLowerCase();
  if (!REVIEWABLE_ROUND_STATUSES.has(roundStatus)) {
    httpError(409, 'Đợt thi hiện không cho phép xét hồ sơ đăng ký.', 'EXAM_REGISTRATION_REVIEW_NOT_ALLOWED');
  }
}

function buildStructureError(path: string, code: string, message: string, details?: Record<string, unknown>) {
  return { path, code, message, ...(details ? { details } : {}) };
}

function validateRegistrationStructure(registration: any, roundStructure: { roundSubjects: any[]; roundComponents: any[] }): StructureValidationResult {
  const errors: StructureValidationResult['errors'] = [];
  const effectiveSubjects = Array.isArray(registration?.subjectRegistrations)
    ? registration.subjectRegistrations.filter((item: any) => normalizeText(item?.registrationStatus).toLowerCase() !== 'cancelled')
    : [];

  if (effectiveSubjects.length === 0) {
    errors.push(buildStructureError('subjectRegistrations', 'EXAM_REGISTRATION_STRUCTURE_INVALID', 'Registration must contain at least one active subject registration.'));
  }

  const requiredRoundSubjectIds = new Set<number>((roundStructure.roundSubjects || [])
    .filter((item: any) => normalizeText(item?.status).toLowerCase() === 'active' && item?.isRequired === true)
    .map((item: any) => Number(item.id)));
  const selectedRoundSubjectIds = new Set<number>();
  const subjectRegistrationIds = new Set<number>();
  const componentRegistrationIds = new Set<number>();
  const selectedRoundComponentIds = new Set<number>();
  let effectiveComponentCount = 0;

  for (const subject of effectiveSubjects) {
    const subjectRegistrationId = Number(subject?.id || 0);
    if (subjectRegistrationId > 0) {
      if (subjectRegistrationIds.has(subjectRegistrationId)) {
        errors.push(buildStructureError(`subjectRegistrations[${subjectRegistrationId}]`, 'EXAM_REGISTRATION_STRUCTURE_INVALID', 'Duplicate subject registration id was found.'));
      }
      subjectRegistrationIds.add(subjectRegistrationId);
    }

    const examRoundSubjectId = Number(extractRelationRef(subject?.examRoundSubject) || subject?.examRoundSubject?.id || 0);
    if (!examRoundSubjectId) {
      errors.push(buildStructureError(`subjectRegistrations[${subjectRegistrationId}].examRoundSubject`, 'EXAM_REGISTRATION_STRUCTURE_INVALID', 'Subject registration is missing its source round subject.'));
      continue;
    }

    selectedRoundSubjectIds.add(examRoundSubjectId);
    const roundSubject = (roundStructure.roundSubjects || []).find((item: any) => Number(item.id) === examRoundSubjectId);
    if (!roundSubject) {
      errors.push(buildStructureError(`subjectRegistrations[${subjectRegistrationId}].examRoundSubject`, 'EXAM_REGISTRATION_STRUCTURE_INVALID', 'Subject snapshot source was not found in the exam round.'));
    }

    const effectiveComponents = Array.isArray(subject?.componentRegistrations)
      ? subject.componentRegistrations.filter((item: any) => normalizeText(item?.registrationStatus).toLowerCase() !== 'cancelled')
      : [];
    if (effectiveComponents.length === 0) {
      errors.push(buildStructureError(`subjectRegistrations[${subjectRegistrationId}].componentRegistrations`, 'EXAM_REGISTRATION_STRUCTURE_INVALID', 'Each active subject registration must contain at least one active component registration.'));
    }

    const requiredRoundComponentIds = new Set<number>((roundStructure.roundComponents || [])
      .filter((item: any) => Number(extractRelationRef(item?.examRoundSubject) || item?.examRoundSubject?.id || 0) === examRoundSubjectId)
      .filter((item: any) => normalizeText(item?.status).toLowerCase() === 'active' && item?.isRequired === true)
      .map((item: any) => Number(item.id)));

    for (const component of effectiveComponents) {
      effectiveComponentCount += 1;
      const componentRegistrationId = Number(component?.id || 0);
      if (componentRegistrationId > 0) {
        if (componentRegistrationIds.has(componentRegistrationId)) {
          errors.push(buildStructureError(`componentRegistrations[${componentRegistrationId}]`, 'EXAM_REGISTRATION_STRUCTURE_INVALID', 'Duplicate component registration id was found.'));
        }
        componentRegistrationIds.add(componentRegistrationId);
      }

      const participationType = normalizeText(component?.participationType).toLowerCase();
      if (!['new_exam', 'preserved_result', 'equivalent_result', 'exempted', 'not_required'].includes(participationType)) {
        errors.push(buildStructureError(`componentRegistrations[${componentRegistrationId}].participationType`, 'EXAM_REGISTRATION_STRUCTURE_INVALID', 'Component participationType is invalid.'));
      }

      const examRoundComponentId = Number(extractRelationRef(component?.examRoundComponent) || component?.examRoundComponent?.id || 0);
      if (!examRoundComponentId) {
        errors.push(buildStructureError(`componentRegistrations[${componentRegistrationId}].examRoundComponent`, 'EXAM_REGISTRATION_STRUCTURE_INVALID', 'Component registration is missing its source round component.'));
        continue;
      }

      if (selectedRoundComponentIds.has(examRoundComponentId)) {
        errors.push(buildStructureError(`componentRegistrations[${componentRegistrationId}].examRoundComponent`, 'EXAM_REGISTRATION_STRUCTURE_INVALID', 'Duplicate round component selection was found in registration components.'));
      }
      selectedRoundComponentIds.add(examRoundComponentId);

      const roundComponent = (roundStructure.roundComponents || []).find((item: any) => Number(item.id) === examRoundComponentId);
      if (!roundComponent) {
        errors.push(buildStructureError(`componentRegistrations[${componentRegistrationId}].examRoundComponent`, 'EXAM_REGISTRATION_STRUCTURE_INVALID', 'Component snapshot source was not found in the exam round.'));
        continue;
      }

      const roundComponentSubjectId = Number(extractRelationRef(roundComponent?.examRoundSubject) || roundComponent?.examRoundSubject?.id || 0);
      if (roundComponentSubjectId !== examRoundSubjectId) {
        errors.push(buildStructureError(`componentRegistrations[${componentRegistrationId}].examRoundSubject`, 'EXAM_REGISTRATION_STRUCTURE_INVALID', 'Component registration belongs to a different round subject than its subject registration.', {
          examRoundSubjectId,
          examRoundComponentId,
        }));
      }
    }

    for (const requiredRoundComponentId of requiredRoundComponentIds) {
      if (!selectedRoundComponentIds.has(requiredRoundComponentId)) {
        errors.push(buildStructureError(`subjectRegistrations[${subjectRegistrationId}].componentRegistrations`, 'EXAM_REGISTRATION_STRUCTURE_INVALID', 'A required round component is missing from the registration.', {
          examRoundComponentId: requiredRoundComponentId,
        }));
      }
    }
  }

  for (const requiredRoundSubjectId of requiredRoundSubjectIds) {
    if (!selectedRoundSubjectIds.has(requiredRoundSubjectId)) {
      errors.push(buildStructureError('subjectRegistrations', 'EXAM_REGISTRATION_STRUCTURE_INVALID', 'A required round subject is missing from the registration.', {
        examRoundSubjectId: requiredRoundSubjectId,
      }));
    }
  }

  return {
    ok: errors.length === 0,
    errors,
    effectiveSubjectCount: effectiveSubjects.length,
    effectiveComponentCount,
  };
}

function assertStructureValid(structure: StructureValidationResult) {
  if (!structure.ok) {
    httpError(409, 'Cấu trúc đăng ký dự thi không hợp lệ.', 'EXAM_REGISTRATION_STRUCTURE_INVALID', { errors: structure.errors });
  }
}

function evaluateRegistrationReadiness(registration: any, structure: StructureValidationResult, options: { candidateCount?: number } = {}): ReadinessResult {
  const blockingReasons: string[] = [];
  const registrationStatus = normalizeRegistrationStatus(registration?.registrationStatus, 'submitted');
  const registrationMode = normalizeText(registration?.examRound?.registrationMode).toLowerCase();
  const learnerReady = Number(extractRelationRef(registration?.learner) || registration?.learner?.id || 0) > 0;
  if (!learnerReady) {
    blockingReasons.push('LEARNER_NOT_FOUND');
  }

  const reviewStateReady = registrationStatus === 'submitted' || registrationStatus === 'pending_review';
  if (registrationStatus === 'accepted') blockingReasons.push('REGISTRATION_ALREADY_APPROVED');
  if (registrationStatus === 'returned') blockingReasons.push('REGISTRATION_RETURNED');
  if (registrationStatus === 'rejected') blockingReasons.push('REGISTRATION_ALREADY_REJECTED');
  if (registrationStatus === 'cancelled') blockingReasons.push('REGISTRATION_CANCELLED');

  const structureReady = structure.ok;
  if (!structureReady) {
    const hasRequiredSubjectMissing = structure.errors.some((item) => item?.details && Object.prototype.hasOwnProperty.call(item.details, 'examRoundSubjectId'));
    const hasRequiredComponentMissing = structure.errors.some((item) => item?.details && Object.prototype.hasOwnProperty.call(item.details, 'examRoundComponentId'));
    if (hasRequiredSubjectMissing) blockingReasons.push('REQUIRED_SUBJECT_MISSING');
    if (hasRequiredComponentMissing) blockingReasons.push('REQUIRED_COMPONENT_MISSING');
    if (!hasRequiredSubjectMissing && !hasRequiredComponentMissing) {
      blockingReasons.push('EXAM_REGISTRATION_STRUCTURE_INVALID');
    }
  }

  const eligibilityReady = registrationMode === 'open' || normalizeEligibilityStatus(registration?.eligibilityStatus, 'pending') === 'eligible';
  if (!eligibilityReady) {
    blockingReasons.push('ELIGIBILITY_NOT_VALID');
  }

  const requireConfirmedPayment = registration?.examRound?.requireConfirmedPayment === true;
  const paymentStatus = normalizeText(registration?.paymentStatus).toLowerCase();
  const paymentReady = !requireConfirmedPayment || REGISTRATION_ACCEPT_PAYMENT_STATUSES.has(paymentStatus);
  if (!paymentReady) {
    blockingReasons.push('PAYMENT_NOT_CONFIRMED');
  }

  const candidateCount = Math.max(0, Number(options?.candidateCount || 0));
  const candidateReady = candidateCount === 0;
  if (!candidateReady) {
    blockingReasons.push('CANDIDATE_ALREADY_EXISTS');
  }

  const dedupedBlockingReasons = [...new Set(blockingReasons)];
  const readyForReview = learnerReady && reviewStateReady && structureReady && eligibilityReady && paymentReady && candidateReady;

  return {
    structureReady,
    eligibilityReady,
    paymentReady,
    learnerReady,
    reviewStateReady,
    candidateReady,
    canAccept: readyForReview,
    readyForReview,
    blockingReasons: dedupedBlockingReasons,
  };
}

function normalizeReviewHistory(value: unknown): ReviewHistoryEntry[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item) => item && typeof item === 'object')
    .map((item: any) => ({
      action: normalizeText(item?.action) || 'UNKNOWN',
      timestamp: normalizeStoredDateTime(item?.timestamp) || new Date(0).toISOString(),
      actorUserId: Number(item?.actorUserId || 0) || null,
      actorDisplayName: normalizeOptionalText(item?.actorDisplayName, 255),
      fromRegistrationStatus: normalizeOptionalText(item?.fromRegistrationStatus, 50),
      toRegistrationStatus: normalizeOptionalText(item?.toRegistrationStatus, 50),
      fromEligibilityStatus: normalizeOptionalText(item?.fromEligibilityStatus, 50),
      toEligibilityStatus: normalizeOptionalText(item?.toEligibilityStatus, 50),
      note: normalizeOptionalText(item?.note, 2000),
      reason: normalizeOptionalText(item?.reason, 2000),
      metadata: item?.metadata && typeof item.metadata === 'object' && !Array.isArray(item.metadata) ? item.metadata : null,
    }));
}

function appendReviewHistory(registration: any, entry: ReviewHistoryEntry) {
  return [...normalizeReviewHistory(registration?.reviewHistory), entry];
}

function buildReviewHistoryEntry(action: string, authUser: AuthUser, options: {
  timestamp: Date;
  fromRegistrationStatus?: string | null;
  toRegistrationStatus?: string | null;
  fromEligibilityStatus?: string | null;
  toEligibilityStatus?: string | null;
  note?: string | null;
  reason?: string | null;
  metadata?: Record<string, unknown> | null;
}): ReviewHistoryEntry {
  return {
    action,
    timestamp: options.timestamp.toISOString(),
    actorUserId: Number(authUser?.id || 0) || null,
    actorDisplayName: buildUserDisplayName(authUser) || null,
    fromRegistrationStatus: options.fromRegistrationStatus || null,
    toRegistrationStatus: options.toRegistrationStatus || null,
    fromEligibilityStatus: options.fromEligibilityStatus || null,
    toEligibilityStatus: options.toEligibilityStatus || null,
    note: typeof options.note === 'string' ? options.note : null,
    reason: typeof options.reason === 'string' ? options.reason : null,
    metadata: options.metadata || null,
  };
}

function buildRegistrationReviewHistory(registration: any) {
  const history = normalizeReviewHistory(registration?.reviewHistory);
  if (registration?.registeredAt) {
    history.unshift({
      action: 'SUBMITTED',
      timestamp: normalizeStoredDateTime(registration.registeredAt) || new Date(registration.registeredAt).toISOString(),
      actorUserId: null,
      actorDisplayName: null,
      fromRegistrationStatus: null,
      toRegistrationStatus: 'submitted',
      fromEligibilityStatus: null,
      toEligibilityStatus: normalizeEligibilityStatus(registration?.eligibilityStatus),
      note: null,
      reason: null,
      metadata: null,
    });
  }
  return history.sort((left, right) => Date.parse(left.timestamp) - Date.parse(right.timestamp));
}

function mapPaymentSummary(payments: any[]) {
  const reported = payments.filter((item) => normalizeText(item?.status).toLowerCase() === 'reported').length;
  const underReview = payments.filter((item) => normalizeText(item?.status).toLowerCase() === 'under_review').length;
  const confirmed = payments.filter((item) => normalizeText(item?.status).toLowerCase() === 'confirmed').length;
  const rejected = payments.filter((item) => normalizeText(item?.status).toLowerCase() === 'rejected').length;
  return { reported, underReview, confirmed, rejected, total: payments.length };
}

function mapReviewListRow(registration: any, structure: StructureValidationResult, payments: any[], options: { candidateCount?: number } = {}) {
  const readiness = evaluateRegistrationReadiness(registration, structure, options);
  const effectiveSubjects = Array.isArray(registration?.subjectRegistrations)
    ? registration.subjectRegistrations.filter((item: any) => normalizeText(item?.registrationStatus).toLowerCase() !== 'cancelled')
    : [];
  const subjectSummary = effectiveSubjects.map((subject: any) => ({
    id: Number(extractRelationRef(subject?.examRoundSubject) || subject?.examRoundSubject?.id || 0) || null,
    nameSnapshot: normalizeText(subject?.examRoundSubject?.nameSnapshot),
    componentCount: Array.isArray(subject?.componentRegistrations) ? subject.componentRegistrations.filter((item: any) => normalizeText(item?.registrationStatus).toLowerCase() !== 'cancelled').length : 0,
  }));

  return {
    id: Number(registration?.id || 0),
    documentId: registration?.documentId || null,
    registrationCode: normalizeText(registration?.registrationCode),
    registeredAt: normalizeStoredDateTime(registration?.registeredAt),
    registrationStatus: normalizeRegistrationStatus(registration?.registrationStatus),
    eligibilityStatus: normalizeEligibilityStatus(registration?.eligibilityStatus),
    paymentStatus: normalizeText(registration?.paymentStatus) || null,
    calculatedAmount: toMoney(registration?.calculatedAmount, 0),
    payableAmount: toMoney(registration?.payableAmount, 0),
    confirmedPaidAmount: toMoney(registration?.confirmedPaidAmount, 0),
    learner: {
      id: Number(extractRelationRef(registration?.learner) || registration?.learner?.id || 0) || null,
      code: normalizeText(registration?.studentCodeSnapshot || registration?.learner?.code),
      fullName: normalizeText(registration?.fullNameSnapshot || registration?.learner?.fullName),
    },
    examRound: registration?.examRound
      ? {
          id: Number(extractRelationRef(registration.examRound) || registration.examRound.id || 0),
          code: normalizeText(registration.examRound.code),
          name: normalizeText(registration.examRound.name),
          status: normalizeText(registration.examRound.status),
        }
      : null,
    subjectCount: structure.effectiveSubjectCount,
    componentCount: structure.effectiveComponentCount,
    paymentSummary: mapPaymentSummary(payments),
    eligibility: {
      status: normalizeEligibilityStatus(registration?.eligibilityStatus),
    },
    subjectsSummary: subjectSummary,
    componentsSummary: {
      total: structure.effectiveComponentCount,
    },
    readiness: {
      readyForReview: readiness.readyForReview,
      readyForCandidate: readiness.canAccept,
      blockingReasons: readiness.blockingReasons,
    },
    review: {
      reviewedBy: summarizeWorkflowActor(registration?.reviewedBy ? { id: registration.reviewedBy.id, username: registration.reviewedBy.username, fullName: registration.reviewedBy.fullName, email: registration.reviewedBy.email } : null),
      reviewedAt: normalizeStoredDateTime(registration?.reviewedAt),
      acceptedBy: summarizeWorkflowActor(registration?.acceptedBy ? { id: registration.acceptedBy.id, username: registration.acceptedBy.username, fullName: registration.acceptedBy.fullName, email: registration.acceptedBy.email } : null),
      acceptedAt: normalizeStoredDateTime(registration?.acceptedAt),
      returnedBy: summarizeWorkflowActor(registration?.returnedBy ? { id: registration.returnedBy.id, username: registration.returnedBy.username, fullName: registration.returnedBy.fullName, email: registration.returnedBy.email } : null),
      returnedAt: normalizeStoredDateTime(registration?.returnedAt),
      returnReason: normalizeOptionalText(registration?.returnReason),
      rejectedBy: summarizeWorkflowActor(registration?.rejectedBy ? { id: registration.rejectedBy.id, username: registration.rejectedBy.username, fullName: registration.rejectedBy.fullName, email: registration.rejectedBy.email } : null),
      rejectedAt: normalizeStoredDateTime(registration?.rejectedAt),
    },
  };
}

function mapReviewDetail(registration: any, eligibility: any, payments: any[], structure: StructureValidationResult, readiness: ReadinessResult) {
  return {
    registration: {
      id: Number(registration?.id || 0),
      documentId: registration?.documentId || null,
      registrationCode: normalizeText(registration?.registrationCode),
      registeredAt: normalizeStoredDateTime(registration?.registeredAt),
      registrationStatus: normalizeRegistrationStatus(registration?.registrationStatus),
      eligibilityStatus: normalizeEligibilityStatus(registration?.eligibilityStatus),
      paymentStatus: normalizeText(registration?.paymentStatus) || null,
      calculatedAmount: toMoney(registration?.calculatedAmount, 0),
      payableAmount: toMoney(registration?.payableAmount, 0),
      confirmedPaidAmount: toMoney(registration?.confirmedPaidAmount, 0),
      learnerSnapshot: {
        studentCode: normalizeText(registration?.studentCodeSnapshot),
        fullName: normalizeText(registration?.fullNameSnapshot),
        className: normalizeOptionalText(registration?.classNameSnapshot),
        cohort: normalizeOptionalText(registration?.cohortSnapshot),
        major: normalizeOptionalText(registration?.majorSnapshot),
      },
      note: normalizeOptionalText(registration?.note),
    },
    learner: registration?.learner
      ? {
          id: Number(extractRelationRef(registration.learner) || registration.learner.id || 0),
          code: normalizeText(registration.learner.code),
          fullName: normalizeText(registration.learner.fullName),
          learnerStatus: normalizeText(registration.learner.learnerStatus) || null,
          dateOfBirth: normalizeStoredDateTime(registration.learner.dateOfBirth) || normalizeText(registration.learner.dateOfBirth) || null,
          phone: normalizeOptionalText(registration.learner.parentPhone, 30),
        }
      : null,
    examRound: registration?.examRound
      ? {
          id: Number(extractRelationRef(registration.examRound) || registration.examRound.id || 0),
          documentId: registration.examRound.documentId || null,
          code: normalizeText(registration.examRound.code),
          name: normalizeText(registration.examRound.name),
          registrationMode: normalizeText(registration.examRound.registrationMode) || null,
          requireConfirmedPayment: registration.examRound.requireConfirmedPayment === true,
          paymentCalculationMethod: normalizeText(registration.examRound.paymentCalculationMethod) || null,
          status: normalizeText(registration.examRound.status) || null,
        }
      : null,
    eligibility: eligibility
      ? {
          id: Number(eligibility.id || 0),
          status: normalizeEligibilityStatus(eligibility.eligibilityStatus),
          reason: normalizeOptionalText(eligibility.reason),
          source: normalizeOptionalText(eligibility.source),
          reviewedAt: normalizeStoredDateTime(eligibility.reviewedAt),
        }
      : null,
    subjects: (registration?.subjectRegistrations || []).map((subject: any) => ({
      id: Number(subject?.id || 0),
      participationType: normalizeText(subject?.participationType) || null,
      registrationStatus: normalizeText(subject?.registrationStatus) || null,
      feeAmount: toMoney(subject?.feeAmount, 0),
      subjectResultStatus: normalizeText(subject?.subjectResultStatus) || null,
      subject: subject?.examRoundSubject
        ? {
            id: Number(extractRelationRef(subject.examRoundSubject) || subject.examRoundSubject.id || 0),
            nameSnapshot: normalizeText(subject.examRoundSubject.nameSnapshot),
          }
        : null,
      components: (subject?.componentRegistrations || []).map((component: any) => ({
        id: Number(component?.id || 0),
        participationType: normalizeText(component?.participationType) || null,
        registrationStatus: normalizeText(component?.registrationStatus) || null,
        eligibilityStatus: normalizeText(component?.eligibilityStatus) || null,
        feeAmount: toMoney(component?.feeAmount, 0),
        schedulingStatus: normalizeText(component?.schedulingStatus) || null,
        resultStatus: normalizeText(component?.resultStatus) || null,
        component: component?.examRoundComponent
          ? {
              id: Number(extractRelationRef(component.examRoundComponent) || component.examRoundComponent.id || 0),
              nameSnapshot: normalizeText(component.examRoundComponent.nameSnapshot),
              durationMinutes: component.examRoundComponent.durationMinutes ?? null,
            }
          : null,
      })),
    })),
    payments: {
      items: payments.map((payment: any) => ({
        id: Number(payment?.id || 0),
        documentId: payment?.documentId || null,
        status: normalizeText(payment?.status) || null,
        amount: toMoney(payment?.amount, 0),
        paymentMethod: normalizeText(payment?.paymentMethod) || null,
        transactionCode: normalizeOptionalText(payment?.transactionCode),
        paidAt: normalizeStoredDateTime(payment?.paidAt),
        reportedAt: normalizeStoredDateTime(payment?.reportedAt),
        verifiedAt: normalizeStoredDateTime(payment?.verifiedAt),
        rejectionReason: normalizeOptionalText(payment?.rejectionReason),
        evidenceCount: Array.isArray(payment?.evidenceFiles) ? payment.evidenceFiles.length : 0,
      })),
      summary: mapPaymentSummary(payments),
      confirmedPaidAmount: toMoney(registration?.confirmedPaidAmount, 0),
    },
    audit: {
      reviewedBy: summarizeWorkflowActor(registration?.reviewedBy ? { id: registration.reviewedBy.id, username: registration.reviewedBy.username, fullName: registration.reviewedBy.fullName, email: registration.reviewedBy.email } : null),
      reviewedAt: normalizeStoredDateTime(registration?.reviewedAt),
      reviewNote: normalizeOptionalText(registration?.reviewNote),
      acceptedBy: summarizeWorkflowActor(registration?.acceptedBy ? { id: registration.acceptedBy.id, username: registration.acceptedBy.username, fullName: registration.acceptedBy.fullName, email: registration.acceptedBy.email } : null),
      acceptedAt: normalizeStoredDateTime(registration?.acceptedAt),
      returnedBy: summarizeWorkflowActor(registration?.returnedBy ? { id: registration.returnedBy.id, username: registration.returnedBy.username, fullName: registration.returnedBy.fullName, email: registration.returnedBy.email } : null),
      returnedAt: normalizeStoredDateTime(registration?.returnedAt),
      returnReason: normalizeOptionalText(registration?.returnReason),
      rejectedBy: summarizeWorkflowActor(registration?.rejectedBy ? { id: registration.rejectedBy.id, username: registration.rejectedBy.username, fullName: registration.rejectedBy.fullName, email: registration.rejectedBy.email } : null),
      rejectedAt: normalizeStoredDateTime(registration?.rejectedAt),
      rejectionReason: normalizeOptionalText(registration?.rejectionReason),
      eligibilityReason: normalizeOptionalText(registration?.eligibilityReason),
      history: buildRegistrationReviewHistory(registration),
    },
    structure: {
      valid: structure.ok,
      errors: structure.errors,
    },
    readiness,
  };
}

function normalizeListQuery(query: Record<string, unknown>) {
  const page = toPositiveInt(query.page, 1);
  const pageSize = Math.min(MAX_PAGE_SIZE, toPositiveInt(query.pageSize, 20));
  const registrationStatus = normalizeOptionalText(query.reviewStatus ?? query.registrationStatus)?.toLowerCase() || null;
  const eligibilityStatus = normalizeOptionalText(query.eligibilityStatus)?.toLowerCase() || null;
  const paymentStatus = normalizeOptionalText(query.paymentStatus)?.toLowerCase() || null;
  const sort = normalizeSortInput(query.sort);
  const rawReadiness = normalizeOptionalText(query.readyForReview ?? query.readiness, 20)?.toLowerCase() || null;
  const readiness = rawReadiness === 'true' ? 'ready' : rawReadiness === 'false' ? 'blocked' : rawReadiness;
  return {
    page,
    pageSize,
    examRoundId: query.examRoundId ? Number(query.examRoundId) : null,
    registrationStatus,
    eligibilityStatus: normalizeOptionalText(query.eligibilityState ?? query.eligibilityStatus)?.toLowerCase() || eligibilityStatus,
    paymentStatus,
    learnerCode: normalizeOptionalText(query.learnerCode, 100),
    learnerName: normalizeOptionalText(query.learnerName, 200),
    registrationCode: normalizeOptionalText(query.registrationCode, 100),
    keyword: normalizeOptionalText(query.keyword ?? query.search, 200),
    subjectId: query.subjectId ? Number(query.subjectId) : null,
    componentId: query.componentId ? Number(query.componentId) : null,
    readiness,
    registeredFrom: normalizeOptionalText(query.registeredFrom),
    registeredTo: normalizeOptionalText(query.registeredTo),
    sort,
  };
}

function buildReviewListWhere(query: ReturnType<typeof normalizeListQuery>) {
  const clauses: Record<string, unknown>[] = [];
  if (query.examRoundId && Number.isInteger(query.examRoundId) && query.examRoundId > 0) {
    clauses.push({ examRound: { id: { $eq: query.examRoundId } } });
  }
  if (query.registrationStatus) clauses.push({ registrationStatus: query.registrationStatus });
  if (query.eligibilityStatus) clauses.push({ eligibilityStatus: query.eligibilityStatus });
  if (query.paymentStatus) clauses.push({ paymentStatus: query.paymentStatus });
  if (query.subjectId && Number.isInteger(query.subjectId) && query.subjectId > 0) {
    clauses.push({ subjectRegistrations: { examRoundSubject: { id: { $eq: query.subjectId } } } });
  }
  if (query.componentId && Number.isInteger(query.componentId) && query.componentId > 0) {
    clauses.push({ componentRegistrations: { examRoundComponent: { id: { $eq: query.componentId } } } });
  }
  if (query.keyword) {
    clauses.push({
      $or: [
        { registrationCode: { $containsi: query.keyword } },
        { studentCodeSnapshot: { $containsi: query.keyword } },
        { fullNameSnapshot: { $containsi: query.keyword } },
      ],
    });
  }
  if (query.learnerCode) clauses.push({ studentCodeSnapshot: { $containsi: query.learnerCode } });
  if (query.learnerName) clauses.push({ fullNameSnapshot: { $containsi: query.learnerName } });
  if (query.registrationCode) clauses.push({ registrationCode: { $containsi: query.registrationCode } });
  const registeredAt: Record<string, string> = {};
  if (query.registeredFrom) registeredAt.$gte = query.registeredFrom;
  if (query.registeredTo) registeredAt.$lte = query.registeredTo;
  if (Object.keys(registeredAt).length > 0) clauses.push({ registeredAt });
  if (clauses.length === 0) return {};
  return { $and: clauses };
}

function resolveOrderBy(sort: Array<Record<string, 'asc' | 'desc'>>) {
  const allowed = new Set(['registeredAt', 'registrationStatus', 'eligibilityStatus', 'paymentStatus', 'updatedAt', 'id']);
  const filtered = sort.filter((item) => allowed.has(Object.keys(item)[0] || ''));
  return filtered.length > 0 ? filtered : [{ registeredAt: 'desc' }, { id: 'desc' }];
}

async function updateRegistrationReviewInTransaction(registrationId: number, data: Record<string, unknown>, trx: any, failureCode: string) {
  const updated = await strapi.db.query(EXAM_REGISTRATION_UID).update({
    where: { id: registrationId },
    data,
    transacting: trx,
  } as any) as any;
  if (!updated?.id) {
    httpError(409, 'Không thể cập nhật registration review workflow.', failureCode, { registrationId });
  }
  return updated;
}

async function updateSubjectRegistrationStatuses(registrationId: number, tenantId: number, data: Record<string, unknown>, trx: any) {
  const rows = await strapi.db.query(EXAM_REGISTRATION_SUBJECT_UID).findMany({
    where: mergeTenantWhere({ examRegistration: { id: { $eq: registrationId } } }, tenantId),
    select: ['id', 'registrationStatus'],
    transacting: trx,
  } as any) as any[];
  for (const row of rows) {
    const status = normalizeText(row?.registrationStatus).toLowerCase();
    if (!REGISTRATION_ACTIVE_STATUSES.has(status)) continue;
    await strapi.db.query(EXAM_REGISTRATION_SUBJECT_UID).update({
      where: { id: Number(row.id) },
      data,
      transacting: trx,
    } as any);
  }
}

async function updateComponentRegistrationsForEligibility(registrationId: number, tenantId: number, data: Record<string, unknown>, trx: any, options: { onlyNewExam?: boolean; onlyActive?: boolean } = {}) {
  const rows = await strapi.db.query(EXAM_REGISTRATION_COMPONENT_UID).findMany({
    where: mergeTenantWhere({ examRegistration: { id: { $eq: registrationId } } }, tenantId),
    select: ['id', 'participationType', 'registrationStatus', 'resultStatus'],
    transacting: trx,
  } as any) as any[];
  for (const row of rows) {
    const participationType = normalizeText(row?.participationType).toLowerCase();
    const registrationStatus = normalizeText(row?.registrationStatus).toLowerCase();
    if (options.onlyNewExam && participationType !== 'new_exam') continue;
    if (options.onlyActive && !REGISTRATION_ACTIVE_STATUSES.has(registrationStatus)) continue;

    const updateData: Record<string, unknown> = { ...data };
    if (Object.prototype.hasOwnProperty.call(updateData, 'resultStatus') && normalizeText(row?.resultStatus).toLowerCase() !== 'pending') {
      delete updateData.resultStatus;
    }
    await strapi.db.query(EXAM_REGISTRATION_COMPONENT_UID).update({
      where: { id: Number(row.id) },
      data: updateData,
      transacting: trx,
    } as any);
  }
}

async function countConfirmedPayments(registrationId: number, tenantId: number, trx: any) {
  const rows = await strapi.db.query(EXAM_PAYMENT_UID).findMany({
    where: mergeTenantWhere({ examRegistration: { id: { $eq: registrationId } }, status: 'confirmed' }, tenantId),
    select: ['id'],
    transacting: trx,
  } as any);
  return Array.isArray(rows) ? rows.length : 0;
}

async function loadCandidateCountsForRegistrations(tenantId: number, registrationIds: number[], transacting?: any) {
  const effectiveIds = [...new Set((registrationIds || []).map((item) => Number(item || 0)).filter((item) => item > 0))];
  const counts = new Map<number, number>();
  if (effectiveIds.length === 0) return counts;

  const rows = await strapi.db.query(EXAM_CANDIDATE_UID).findMany({
    where: mergeTenantWhere({ examRegistration: { id: { $in: effectiveIds } } }, tenantId),
    select: ['id'],
    populate: {
      examRegistration: { select: ['id'] },
    },
    ...(transacting ? { transacting } : {}),
  } as any) as any[];

  for (const row of rows || []) {
    const registrationId = Number(extractRelationRef(row?.examRegistration) || row?.examRegistration?.id || 0);
    if (!registrationId) continue;
    counts.set(registrationId, (counts.get(registrationId) || 0) + 1);
  }

  return counts;
}

function assertRegistrationInRound(registration: any, round: any) {
  const actualRoundId = Number(extractRelationRef(registration?.examRound) || registration?.examRound?.id || 0);
  const expectedRoundId = Number(extractRelationRef(round) || round?.id || 0);
  if (!actualRoundId || !expectedRoundId || actualRoundId !== expectedRoundId) {
    httpError(404, 'Hồ sơ đăng ký không thuộc đợt thi hiện tại.', 'EXAM_REGISTRATION_NOT_IN_ROUND');
  }
}

function buildRoundReviewSummary(items: Array<{ registrationStatus?: string | null; readiness?: { readyForReview?: boolean } | null }>) {
  let waitingForReview = 0;
  let notReadyForReview = 0;
  let approved = 0;
  let returned = 0;
  let rejected = 0;

  for (const item of items || []) {
    const status = normalizeRegistrationStatus(item?.registrationStatus, 'submitted');
    const readyForReview = item?.readiness?.readyForReview === true;
    if ((status === 'submitted' || status === 'pending_review') && readyForReview) waitingForReview += 1;
    if ((status === 'submitted' || status === 'pending_review') && !readyForReview) notReadyForReview += 1;
    if (status === 'accepted') approved += 1;
    if (status === 'returned') returned += 1;
    if (status === 'rejected') rejected += 1;
  }

  return {
    total: items.length,
    waitingForReview,
    notReadyForReview,
    approved,
    returned,
    rejected,
  };
}

function sortExamRoundReviewRows(rows: any[], sort: Array<Record<string, 'asc' | 'desc'>>) {
  if (Array.isArray(sort) && sort.length > 0) {
    const items = [...rows];
    items.sort((left, right) => {
      for (const descriptor of sort) {
        const [field, direction] = Object.entries(descriptor)[0] || [];
        if (!field || !direction) continue;
        const leftValue = left?.[field] ?? left?.registration?.[field] ?? null;
        const rightValue = right?.[field] ?? right?.registration?.[field] ?? null;
        if (leftValue === rightValue) continue;
        const comparison = String(leftValue || '').localeCompare(String(rightValue || ''), 'vi', { numeric: true, sensitivity: 'base' });
        return direction === 'desc' ? -comparison : comparison;
      }
      return 0;
    });
    return items;
  }

  const statusRank: Record<string, number> = {
    pending_review: 0,
    submitted: 1,
    returned: 2,
    accepted: 3,
    rejected: 4,
    cancelled: 5,
    completed: 6,
    draft: 7,
  };

  return [...rows].sort((left, right) => {
    const readinessDelta = Number(right?.readiness?.readyForReview === true) - Number(left?.readiness?.readyForReview === true);
    if (readinessDelta !== 0) return readinessDelta;

    const leftStatus = normalizeRegistrationStatus(left?.registrationStatus, 'submitted');
    const rightStatus = normalizeRegistrationStatus(right?.registrationStatus, 'submitted');
    const rankDelta = (statusRank[leftStatus] ?? 999) - (statusRank[rightStatus] ?? 999);
    if (rankDelta !== 0) return rankDelta;

    const leftTime = Date.parse(left?.registeredAt || '') || 0;
    const rightTime = Date.parse(right?.registeredAt || '') || 0;
    if (leftTime !== rightTime) return rightTime - leftTime;

    return Number(right?.id || 0) - Number(left?.id || 0);
  });
}

function logExamRegistrationReviewEvent(event: 'exam_registration.review_started' | 'exam_registration.marked_eligible' | 'exam_registration.marked_temporarily_ineligible' | 'exam_registration.marked_ineligible' | 'exam_registration.accepted' | 'exam_registration.rejected', payload: Record<string, unknown>) {
  strapi.log.info(`[exam-registration-review] ${event} ${JSON.stringify(payload)}`);
}

export async function listExamRegistrationsForReview(tenantId: number, rawQuery: Record<string, unknown>, _authUser: AuthUser) {
  const query = normalizeListQuery(rawQuery || {});
  const where = mergeTenantWhere(buildReviewListWhere(query), tenantId);
  const orderBy = resolveOrderBy(query.sort);
  const start = (query.page - 1) * query.pageSize;

  const baseQuery = {
    where,
    orderBy,
    select: [
      'id', 'documentId', 'registrationCode', 'registeredAt', 'registrationStatus', 'eligibilityStatus', 'paymentStatus',
      'calculatedAmount', 'payableAmount', 'confirmedPaidAmount', 'studentCodeSnapshot', 'fullNameSnapshot',
      'reviewedAt', 'acceptedAt', 'rejectedAt',
    ],
    populate: {
      learner: { select: ['id', 'code', 'fullName'] },
      examRound: { select: ['id', 'code', 'name', 'status', 'requireConfirmedPayment'] },
      reviewedBy: { select: ['id', 'username', 'fullName', 'email'] },
      acceptedBy: { select: ['id', 'username', 'fullName', 'email'] },
      rejectedBy: { select: ['id', 'username', 'fullName', 'email'] },
      subjectRegistrations: {
        select: ['id', 'registrationStatus'],
        populate: {
          examRoundSubject: { select: ['id', 'nameSnapshot'] },
          componentRegistrations: {
            select: ['id', 'registrationStatus'],
            populate: {
              examRoundComponent: { select: ['id', 'nameSnapshot'] },
            },
          },
        },
      },
    },
  } as any;

  let rows = [] as any[];
  let total = 0;

  if (query.readiness === 'ready' || query.readiness === 'blocked') {
    const allRows = await strapi.db.query(EXAM_REGISTRATION_UID).findMany(baseQuery) as any[];
    const roundStructureCache = new Map<number, any>();
    const filteredRows = [] as any[];
    for (const row of allRows || []) {
      const roundId = Number(extractRelationRef(row?.examRound) || row?.examRound?.id || 0);
      if (!roundStructureCache.has(roundId)) {
        roundStructureCache.set(roundId, await loadRoundStructure(tenantId, roundId));
      }
      const structure = validateRegistrationStructure(row, roundStructureCache.get(roundId));
      const readiness = evaluateRegistrationReadiness(row, structure);
      if ((query.readiness === 'ready' && readiness.canAccept) || (query.readiness === 'blocked' && !readiness.canAccept)) {
        filteredRows.push(row);
      }
    }
    total = filteredRows.length;
    rows = filteredRows.slice(start, start + query.pageSize);
  } else {
    rows = await strapi.db.query(EXAM_REGISTRATION_UID).findMany({
      ...baseQuery,
      offset: start,
      limit: query.pageSize,
    } as any) as any[];
    total = await strapi.db.query(EXAM_REGISTRATION_UID).count({ where } as any);
  }

  const [submitted, pendingReview, eligible, temporarilyIneligible, ineligible, accepted, rejected, unpaid, paymentReported, partiallyPaid, paid, notRequired] = await Promise.all([
    strapi.db.query(EXAM_REGISTRATION_UID).count({ where: mergeTenantWhere({ $and: [buildReviewListWhere(query), { registrationStatus: 'submitted' }] }, tenantId) } as any),
    strapi.db.query(EXAM_REGISTRATION_UID).count({ where: mergeTenantWhere({ $and: [buildReviewListWhere(query), { registrationStatus: 'pending_review' }] }, tenantId) } as any),
    strapi.db.query(EXAM_REGISTRATION_UID).count({ where: mergeTenantWhere({ $and: [buildReviewListWhere(query), { eligibilityStatus: 'eligible' }] }, tenantId) } as any),
    strapi.db.query(EXAM_REGISTRATION_UID).count({ where: mergeTenantWhere({ $and: [buildReviewListWhere(query), { eligibilityStatus: 'temporarily_ineligible' }] }, tenantId) } as any),
    strapi.db.query(EXAM_REGISTRATION_UID).count({ where: mergeTenantWhere({ $and: [buildReviewListWhere(query), { eligibilityStatus: 'ineligible' }] }, tenantId) } as any),
    strapi.db.query(EXAM_REGISTRATION_UID).count({ where: mergeTenantWhere({ $and: [buildReviewListWhere(query), { registrationStatus: 'accepted' }] }, tenantId) } as any),
    strapi.db.query(EXAM_REGISTRATION_UID).count({ where: mergeTenantWhere({ $and: [buildReviewListWhere(query), { registrationStatus: 'rejected' }] }, tenantId) } as any),
    strapi.db.query(EXAM_REGISTRATION_UID).count({ where: mergeTenantWhere({ $and: [buildReviewListWhere(query), { paymentStatus: 'unpaid' }] }, tenantId) } as any),
    strapi.db.query(EXAM_REGISTRATION_UID).count({ where: mergeTenantWhere({ $and: [buildReviewListWhere(query), { paymentStatus: 'payment_reported' }] }, tenantId) } as any),
    strapi.db.query(EXAM_REGISTRATION_UID).count({ where: mergeTenantWhere({ $and: [buildReviewListWhere(query), { paymentStatus: 'partially_paid' }] }, tenantId) } as any),
    strapi.db.query(EXAM_REGISTRATION_UID).count({ where: mergeTenantWhere({ $and: [buildReviewListWhere(query), { paymentStatus: 'paid' }] }, tenantId) } as any),
    strapi.db.query(EXAM_REGISTRATION_UID).count({ where: mergeTenantWhere({ $and: [buildReviewListWhere(query), { paymentStatus: 'not_required' }] }, tenantId) } as any),
  ]);

  const data = [];
  const roundStructureCache = new Map<number, any>();
  for (const row of rows || []) {
    const roundId = Number(extractRelationRef(row?.examRound) || row?.examRound?.id || 0);
    if (!roundStructureCache.has(roundId)) {
      roundStructureCache.set(roundId, await loadRoundStructure(tenantId, roundId));
    }
    const roundStructure = roundStructureCache.get(roundId);
    const structure = validateRegistrationStructure(row, roundStructure);
    const payments = await loadPaymentsForRegistration(tenantId, Number(row.id));
    data.push(mapReviewListRow(row, structure, payments));
  }

  const ready = data.filter((item: any) => item?.readiness?.readyForCandidate === true).length;
  const blocked = data.filter((item: any) => item?.readiness?.readyForCandidate !== true).length;

  return {
    data,
    meta: {
      pagination: {
        page: query.page,
        pageSize: query.pageSize,
        pageCount: Math.max(1, Math.ceil(total / query.pageSize)),
        total,
      },
      summary: {
        submitted,
        pendingReview,
        eligible,
        temporarilyIneligible,
        ineligible,
        accepted,
        rejected,
        unpaid,
        paymentReported,
        partiallyPaid,
        paid,
        notRequired,
        ready,
        blocked,
      },
    },
  };
}

export async function getExamRegistrationReviewDetail(tenantId: number, registrationRef: unknown, _authUser: AuthUser) {
  const registration = await loadRegistrationInTenant(tenantId, registrationRef);
  const roundId = Number(extractRelationRef(registration?.examRound) || registration?.examRound?.id || 0);
  const roundStructure = await loadRoundStructure(tenantId, roundId);
  const structure = validateRegistrationStructure(registration, roundStructure);
  const readiness = evaluateRegistrationReadiness(registration, structure);
  const eligibility = await loadEligibilityForRegistration(tenantId, registration);
  const payments = await loadPaymentsForRegistration(tenantId, Number(registration.id));
  return mapReviewDetail(registration, eligibility, payments, structure, readiness);
}

export async function startExamRegistrationReview(tenantId: number, registrationRef: unknown, payload: Record<string, unknown>, authUser: AuthUser) {
  const input = normalizeStartReviewInput(payload || {});

  return strapi.db.connection.transaction(async (trx: any) => {
    const registration = await loadRegistrationInTenant(tenantId, registrationRef, trx);
    await acquireRegistrationReviewLock(trx, tenantId, Number(registration.id));
    const current = await loadRegistrationInTenant(tenantId, registrationRef, trx);
    assertReviewableRoundStatus(current?.examRound);

    const currentStatus = normalizeRegistrationStatus(current?.registrationStatus);
    if (currentStatus === 'pending_review') {
      httpError(409, 'Registration đang ở trạng thái chờ xét.', 'EXAM_REGISTRATION_ALREADY_UNDER_REVIEW');
    }
    if (currentStatus !== 'submitted') {
      httpError(409, 'Registration hiện không thể bắt đầu xét.', 'EXAM_REGISTRATION_CANNOT_START_REVIEW');
    }

    const now = new Date();
    const reviewHistory = appendReviewHistory(current, buildReviewHistoryEntry('REVIEW_STARTED', authUser, {
      timestamp: now,
      fromRegistrationStatus: 'submitted',
      toRegistrationStatus: 'pending_review',
      fromEligibilityStatus: normalizeEligibilityStatus(current?.eligibilityStatus),
      toEligibilityStatus: normalizeEligibilityStatus(current?.eligibilityStatus),
      note: input.note,
    }));
    await updateRegistrationReviewInTransaction(Number(current.id), {
      registrationStatus: 'pending_review',
      reviewedBy: authUser.id,
      reviewedAt: now,
      reviewHistory,
      ...(typeof input.note === 'string' ? { reviewNote: input.note } : {}),
    }, trx, 'EXAM_REGISTRATION_REVIEW_FAILED');

    logExamRegistrationReviewEvent('exam_registration.review_started', {
      tenantId,
      examRoundId: Number(extractRelationRef(current?.examRound) || current?.examRound?.id || 0),
      registrationId: Number(current.id),
      learnerId: Number(extractRelationRef(current?.learner) || current?.learner?.id || 0),
      actorUserId: authUser.id,
      fromRegistrationStatus: 'submitted',
      toRegistrationStatus: 'pending_review',
      fromEligibilityStatus: normalizeEligibilityStatus(current?.eligibilityStatus),
      toEligibilityStatus: normalizeEligibilityStatus(current?.eligibilityStatus),
      reason: input.note,
      timestamp: now.toISOString(),
    });

    const refreshed = await loadRegistrationInTenant(tenantId, current.id, trx);
    const roundStructure = await loadRoundStructure(tenantId, Number(extractRelationRef(refreshed?.examRound) || refreshed?.examRound?.id || 0), trx);
    const structure = validateRegistrationStructure(refreshed, roundStructure);
    const readiness = evaluateRegistrationReadiness(refreshed, structure);
    return {
      registration: {
        id: Number(refreshed.id),
        registrationCode: normalizeText(refreshed.registrationCode),
        registrationStatus: normalizeRegistrationStatus(refreshed.registrationStatus),
        reviewedAt: normalizeStoredDateTime(refreshed.reviewedAt),
        reviewedBy: summarizeWorkflowActor(authUser),
      },
      readiness,
    };
  });
}

async function transitionEligibility(tenantId: number, registrationRef: unknown, payload: Record<string, unknown>, authUser: AuthUser, targetEligibilityStatus: EligibilityStatus, event: 'exam_registration.marked_eligible' | 'exam_registration.marked_temporarily_ineligible' | 'exam_registration.marked_ineligible') {
  const input = normalizeEligibilityTransitionInput(payload || {}, { requireReason: targetEligibilityStatus !== 'eligible' });

  return strapi.db.connection.transaction(async (trx: any) => {
    const registration = await loadRegistrationInTenant(tenantId, registrationRef, trx);
    await acquireRegistrationReviewLock(trx, tenantId, Number(registration.id));
    const current = await loadRegistrationInTenant(tenantId, registrationRef, trx);
    assertReviewableRoundStatus(current?.examRound);
    const currentStatus = normalizeRegistrationStatus(current?.registrationStatus);
    if (!REGISTRATION_REVIEWABLE_STATUSES.has(currentStatus)) {
      const code = targetEligibilityStatus === 'eligible' ? 'EXAM_REGISTRATION_CANNOT_MARK_ELIGIBLE' : 'EXAM_REGISTRATION_CANNOT_MARK_INELIGIBLE';
      httpError(409, 'Registration hiện không thể cập nhật trạng thái điều kiện.', code);
    }

    const roundStructure = await loadRoundStructure(tenantId, Number(extractRelationRef(current?.examRound) || current?.examRound?.id || 0), trx);
    const structure = validateRegistrationStructure(current, roundStructure);
    assertStructureValid(structure);

    const now = new Date();
    const nextRegistrationStatus = currentStatus === 'submitted' ? 'pending_review' : currentStatus;
    const reviewHistory = appendReviewHistory(current, buildReviewHistoryEntry(`ELIGIBILITY_${String(targetEligibilityStatus || '').toUpperCase()}`, authUser, {
      timestamp: now,
      fromRegistrationStatus: currentStatus,
      toRegistrationStatus: nextRegistrationStatus,
      fromEligibilityStatus: normalizeEligibilityStatus(current?.eligibilityStatus),
      toEligibilityStatus: targetEligibilityStatus,
      note: input.note,
      reason: input.reason,
    }));
    await updateRegistrationReviewInTransaction(Number(current.id), {
      eligibilityStatus: targetEligibilityStatus,
      eligibilityReason: input.reason,
      registrationStatus: nextRegistrationStatus,
      reviewedBy: authUser.id,
      reviewedAt: now,
      reviewHistory,
      ...(typeof input.note === 'string' ? { reviewNote: input.note } : {}),
    }, trx, 'EXAM_REGISTRATION_REVIEW_FAILED');

    if (targetEligibilityStatus === 'eligible') {
      await updateComponentRegistrationsForEligibility(Number(current.id), tenantId, { eligibilityStatus: 'eligible' }, trx, { onlyNewExam: true, onlyActive: true });
    } else if (targetEligibilityStatus === 'temporarily_ineligible') {
      await updateComponentRegistrationsForEligibility(Number(current.id), tenantId, { eligibilityStatus: 'pending' }, trx, { onlyNewExam: true, onlyActive: true });
    } else {
      await updateComponentRegistrationsForEligibility(Number(current.id), tenantId, { eligibilityStatus: 'ineligible' }, trx, { onlyNewExam: true, onlyActive: true });
    }

    logExamRegistrationReviewEvent(event, {
      tenantId,
      examRoundId: Number(extractRelationRef(current?.examRound) || current?.examRound?.id || 0),
      registrationId: Number(current.id),
      learnerId: Number(extractRelationRef(current?.learner) || current?.learner?.id || 0),
      actorUserId: authUser.id,
      fromRegistrationStatus: currentStatus,
      toRegistrationStatus: nextRegistrationStatus,
      fromEligibilityStatus: normalizeEligibilityStatus(current?.eligibilityStatus),
      toEligibilityStatus: targetEligibilityStatus,
      reason: input.reason,
      timestamp: now.toISOString(),
    });

    const refreshed = await loadRegistrationInTenant(tenantId, current.id, trx);
    const refreshedStructure = validateRegistrationStructure(refreshed, roundStructure);
    const readiness = evaluateRegistrationReadiness(refreshed, refreshedStructure);
    return {
      registration: {
        id: Number(refreshed.id),
        registrationCode: normalizeText(refreshed.registrationCode),
        registrationStatus: normalizeRegistrationStatus(refreshed.registrationStatus),
        eligibilityStatus: normalizeEligibilityStatus(refreshed.eligibilityStatus),
        reviewedAt: normalizeStoredDateTime(refreshed.reviewedAt),
        reviewedBy: summarizeWorkflowActor(authUser),
        eligibilityReason: normalizeOptionalText(refreshed.eligibilityReason),
      },
      readiness,
    };
  });
}

export async function markExamRegistrationEligible(tenantId: number, registrationRef: unknown, payload: Record<string, unknown>, authUser: AuthUser) {
  return transitionEligibility(tenantId, registrationRef, payload, authUser, 'eligible', 'exam_registration.marked_eligible');
}

export async function markExamRegistrationTemporarilyIneligible(tenantId: number, registrationRef: unknown, payload: Record<string, unknown>, authUser: AuthUser) {
  return transitionEligibility(tenantId, registrationRef, payload, authUser, 'temporarily_ineligible', 'exam_registration.marked_temporarily_ineligible');
}

export async function markExamRegistrationIneligible(tenantId: number, registrationRef: unknown, payload: Record<string, unknown>, authUser: AuthUser) {
  return transitionEligibility(tenantId, registrationRef, payload, authUser, 'ineligible', 'exam_registration.marked_ineligible');
}

export async function acceptExamRegistration(tenantId: number, registrationRef: unknown, payload: Record<string, unknown>, authUser: AuthUser) {
  const input = normalizeAcceptInput(payload || {});

  return strapi.db.connection.transaction(async (trx: any) => {
    const registration = await loadRegistrationInTenant(tenantId, registrationRef, trx);
    await acquireRegistrationReviewLock(trx, tenantId, Number(registration.id));
    const current = await loadRegistrationInTenant(tenantId, registrationRef, trx);
    assertReviewableRoundStatus(current?.examRound);

    const currentStatus = normalizeRegistrationStatus(current?.registrationStatus);
    if (!REGISTRATION_REVIEWABLE_STATUSES.has(currentStatus)) {
      httpError(409, 'Registration hiện không thể được chấp nhận.', 'EXAM_REGISTRATION_CANNOT_BE_ACCEPTED');
    }

    if (normalizeEligibilityStatus(current?.eligibilityStatus) !== 'eligible') {
      httpError(409, 'Registration hiện chưa đủ điều kiện để được chấp nhận.', 'EXAM_REGISTRATION_NOT_ELIGIBLE');
    }

    const roundStructure = await loadRoundStructure(tenantId, Number(extractRelationRef(current?.examRound) || current?.examRound?.id || 0), trx);
    const structure = validateRegistrationStructure(current, roundStructure);
    assertStructureValid(structure);

    const candidateCount = await countCandidatesForRegistration(tenantId, Number(current.id), trx);
    const readiness = evaluateRegistrationReadiness(current, structure, { candidateCount });
    if (!readiness.readyForReview) {
      const primaryCode = readiness.blockingReasons[0] || 'REGISTRATION_NOT_READY_FOR_REVIEW';
      httpError(409, 'Hồ sơ hiện chưa sẵn sàng để duyệt.', primaryCode, { blockingReasons: readiness.blockingReasons });
    }

    const now = new Date();
    const reviewHistory = appendReviewHistory(current, buildReviewHistoryEntry('APPROVED', authUser, {
      timestamp: now,
      fromRegistrationStatus: currentStatus,
      toRegistrationStatus: 'accepted',
      fromEligibilityStatus: normalizeEligibilityStatus(current?.eligibilityStatus),
      toEligibilityStatus: 'eligible',
      note: input.note,
      metadata: {
        paymentStatus: normalizeText(current?.paymentStatus).toLowerCase() || null,
      },
    }));
    await updateRegistrationReviewInTransaction(Number(current.id), {
      registrationStatus: 'accepted',
      eligibilityStatus: 'eligible',
      acceptedBy: authUser.id,
      acceptedAt: now,
      reviewedBy: extractRelationRef(current?.reviewedBy) ? extractRelationRef(current.reviewedBy) : authUser.id,
      reviewedAt: current?.reviewedAt || now,
      returnedBy: null,
      returnedAt: null,
      returnReason: null,
      rejectedBy: null,
      rejectedAt: null,
      rejectionReason: null,
      reviewHistory,
      ...(typeof input.note === 'string' ? { reviewNote: input.note } : {}),
    }, trx, 'EXAM_REGISTRATION_ACCEPT_FAILED');

    await updateSubjectRegistrationStatuses(Number(current.id), tenantId, { registrationStatus: 'accepted' }, trx);
    await updateComponentRegistrationsForEligibility(Number(current.id), tenantId, { registrationStatus: 'accepted', eligibilityStatus: 'eligible' }, trx, { onlyNewExam: true, onlyActive: true });

    logExamRegistrationReviewEvent('exam_registration.accepted', {
      tenantId,
      examRoundId: Number(extractRelationRef(current?.examRound) || current?.examRound?.id || 0),
      registrationId: Number(current.id),
      learnerId: Number(extractRelationRef(current?.learner) || current?.learner?.id || 0),
      actorUserId: authUser.id,
      fromRegistrationStatus: currentStatus,
      toRegistrationStatus: 'accepted',
      fromEligibilityStatus: normalizeEligibilityStatus(current?.eligibilityStatus),
      toEligibilityStatus: 'eligible',
      reason: input.note,
      timestamp: now.toISOString(),
    });

    const refreshed = await loadRegistrationInTenant(tenantId, current.id, trx);
    const refreshedStructure = validateRegistrationStructure(refreshed, roundStructure);
    const refreshedReadiness = evaluateRegistrationReadiness(refreshed, refreshedStructure);
    return {
      registration: {
        id: Number(refreshed.id),
        registrationCode: normalizeText(refreshed.registrationCode),
        registrationStatus: normalizeRegistrationStatus(refreshed.registrationStatus),
        eligibilityStatus: normalizeEligibilityStatus(refreshed.eligibilityStatus),
        paymentStatus: normalizeText(refreshed.paymentStatus) || null,
        acceptedAt: normalizeStoredDateTime(refreshed.acceptedAt),
        acceptedBy: summarizeWorkflowActor(authUser),
      },
      readiness: refreshedReadiness,
    };
  });
}

export async function rejectExamRegistration(tenantId: number, registrationRef: unknown, payload: Record<string, unknown>, authUser: AuthUser) {
  const input = normalizeRejectInput(payload || {});

  return strapi.db.connection.transaction(async (trx: any) => {
    const registration = await loadRegistrationInTenant(tenantId, registrationRef, trx);
    await acquireRegistrationReviewLock(trx, tenantId, Number(registration.id));
    const current = await loadRegistrationInTenant(tenantId, registrationRef, trx);
    assertReviewableRoundStatus(current?.examRound);

    const currentStatus = normalizeRegistrationStatus(current?.registrationStatus);
    if (!REGISTRATION_REVIEWABLE_STATUSES.has(currentStatus) && currentStatus !== 'returned') {
      httpError(409, 'Registration hiện không thể bị từ chối.', 'EXAM_REGISTRATION_CANNOT_BE_REJECTED');
    }

    const warnings: Array<{ code: string; message: string }> = [];
    if (await countConfirmedPayments(Number(current.id), tenantId, trx) > 0) {
      warnings.push({
        code: 'EXAM_REGISTRATION_REJECTED_WITH_CONFIRMED_PAYMENT',
        message: 'Registration bị từ chối dù đã có payment confirmed. Hệ thống không tự refund.',
      });
    }

    const now = new Date();
    const reviewHistory = appendReviewHistory(current, buildReviewHistoryEntry('REJECTED', authUser, {
      timestamp: now,
      fromRegistrationStatus: currentStatus,
      toRegistrationStatus: 'rejected',
      fromEligibilityStatus: normalizeEligibilityStatus(current?.eligibilityStatus),
      toEligibilityStatus: normalizeEligibilityStatus(current?.eligibilityStatus),
      note: input.note,
      reason: input.reason,
      metadata: warnings.length > 0 ? { warnings } : null,
    }));
    await updateRegistrationReviewInTransaction(Number(current.id), {
      registrationStatus: 'rejected',
      rejectedBy: authUser.id,
      rejectedAt: now,
      rejectionReason: input.reason,
      reviewedBy: authUser.id,
      reviewedAt: now,
      reviewHistory,
      ...(typeof input.note === 'string' ? { reviewNote: input.note } : {}),
    }, trx, 'EXAM_REGISTRATION_REJECT_FAILED');

    await updateSubjectRegistrationStatuses(Number(current.id), tenantId, { registrationStatus: 'cancelled' }, trx);
    await updateComponentRegistrationsForEligibility(Number(current.id), tenantId, { registrationStatus: 'cancelled', resultStatus: 'cancelled' }, trx, { onlyActive: true });

    logExamRegistrationReviewEvent('exam_registration.rejected', {
      tenantId,
      examRoundId: Number(extractRelationRef(current?.examRound) || current?.examRound?.id || 0),
      registrationId: Number(current.id),
      learnerId: Number(extractRelationRef(current?.learner) || current?.learner?.id || 0),
      actorUserId: authUser.id,
      fromRegistrationStatus: currentStatus,
      toRegistrationStatus: 'rejected',
      fromEligibilityStatus: normalizeEligibilityStatus(current?.eligibilityStatus),
      toEligibilityStatus: normalizeEligibilityStatus(current?.eligibilityStatus),
      reason: input.reason,
      timestamp: now.toISOString(),
    });

    const refreshed = await loadRegistrationInTenant(tenantId, current.id, trx);
    return {
      registration: {
        id: Number(refreshed.id),
        registrationCode: normalizeText(refreshed.registrationCode),
        registrationStatus: normalizeRegistrationStatus(refreshed.registrationStatus),
        rejectedAt: normalizeStoredDateTime(refreshed.rejectedAt),
        rejectionReason: normalizeOptionalText(refreshed.rejectionReason),
      },
      warnings,
    };
  });
}

export async function returnExamRegistration(tenantId: number, registrationRef: unknown, payload: Record<string, unknown>, authUser: AuthUser) {
  const input = normalizeReturnInput(payload || {});

  return strapi.db.connection.transaction(async (trx: any) => {
    const registration = await loadRegistrationInTenant(tenantId, registrationRef, trx);
    await acquireRegistrationReviewLock(trx, tenantId, Number(registration.id));
    const current = await loadRegistrationInTenant(tenantId, registrationRef, trx);
    assertReviewableRoundStatus(current?.examRound);

    const currentStatus = normalizeRegistrationStatus(current?.registrationStatus);
    if (!REGISTRATION_REVIEWABLE_STATUSES.has(currentStatus)) {
      httpError(409, 'Registration hiện không thể bị trả lại.', 'REVIEW_ACTION_NOT_ALLOWED');
    }

    const now = new Date();
    const reviewHistory = appendReviewHistory(current, buildReviewHistoryEntry('RETURNED', authUser, {
      timestamp: now,
      fromRegistrationStatus: currentStatus,
      toRegistrationStatus: 'returned',
      fromEligibilityStatus: normalizeEligibilityStatus(current?.eligibilityStatus),
      toEligibilityStatus: normalizeEligibilityStatus(current?.eligibilityStatus),
      note: input.note,
      reason: input.reason,
    }));
    await updateRegistrationReviewInTransaction(Number(current.id), {
      registrationStatus: 'returned',
      returnedBy: authUser.id,
      returnedAt: now,
      returnReason: input.reason,
      reviewedBy: authUser.id,
      reviewedAt: now,
      reviewHistory,
      ...(typeof input.note === 'string' ? { reviewNote: input.note } : {}),
    }, trx, 'CONCURRENT_REVIEW_UPDATE');

    logExamRegistrationReviewEvent('exam_registration.returned' as any, {
      tenantId,
      examRoundId: Number(extractRelationRef(current?.examRound) || current?.examRound?.id || 0),
      registrationId: Number(current.id),
      learnerId: Number(extractRelationRef(current?.learner) || current?.learner?.id || 0),
      actorUserId: authUser.id,
      fromRegistrationStatus: currentStatus,
      toRegistrationStatus: 'returned',
      fromEligibilityStatus: normalizeEligibilityStatus(current?.eligibilityStatus),
      toEligibilityStatus: normalizeEligibilityStatus(current?.eligibilityStatus),
      reason: input.reason,
      timestamp: now.toISOString(),
    });

    const refreshed = await loadRegistrationInTenant(tenantId, current.id, trx);
    const roundStructure = await loadRoundStructure(tenantId, Number(extractRelationRef(refreshed?.examRound) || refreshed?.examRound?.id || 0), trx);
    const structure = validateRegistrationStructure(refreshed, roundStructure);
    const candidateCount = await countCandidatesForRegistration(tenantId, Number(refreshed.id), trx);
    const readiness = evaluateRegistrationReadiness(refreshed, structure, { candidateCount });
    return {
      registration: {
        id: Number(refreshed.id),
        registrationCode: normalizeText(refreshed.registrationCode),
        registrationStatus: normalizeRegistrationStatus(refreshed.registrationStatus),
        returnedAt: normalizeStoredDateTime(refreshed.returnedAt),
        returnReason: normalizeOptionalText(refreshed.returnReason),
        returnedBy: summarizeWorkflowActor(authUser),
      },
      readiness,
    };
  });
}

async function loadRoundReviewRows(tenantId: number, roundId: number, query: ReturnType<typeof normalizeListQuery>, transacting?: any) {
  const where = mergeTenantWhere(buildReviewListWhere({ ...query, examRoundId: roundId }), tenantId);
  const rows = await strapi.db.query(EXAM_REGISTRATION_UID).findMany({
    where,
    orderBy: [{ registeredAt: 'desc' }, { id: 'desc' }],
    select: [
      'id', 'documentId', 'registrationCode', 'registeredAt', 'registrationStatus', 'eligibilityStatus', 'paymentStatus',
      'calculatedAmount', 'payableAmount', 'confirmedPaidAmount', 'studentCodeSnapshot', 'fullNameSnapshot',
      'reviewedAt', 'acceptedAt', 'returnedAt', 'returnReason', 'rejectedAt',
    ],
    populate: {
      learner: { select: ['id', 'code', 'fullName'] },
      examRound: { select: ['id', 'code', 'name', 'status', 'registrationMode', 'requireConfirmedPayment'] },
      reviewedBy: { select: ['id', 'username', 'fullName', 'email'] },
      acceptedBy: { select: ['id', 'username', 'fullName', 'email'] },
      returnedBy: { select: ['id', 'username', 'fullName', 'email'] },
      rejectedBy: { select: ['id', 'username', 'fullName', 'email'] },
      subjectRegistrations: {
        select: ['id', 'registrationStatus'],
        populate: {
          examRoundSubject: { select: ['id', 'nameSnapshot'] },
          componentRegistrations: {
            select: ['id', 'registrationStatus'],
            populate: {
              examRoundComponent: { select: ['id', 'nameSnapshot'] },
            },
          },
        },
      },
    },
    ...(transacting ? { transacting } : {}),
  } as any) as any[];

  const candidateCounts = await loadCandidateCountsForRegistrations(tenantId, (rows || []).map((item: any) => Number(item?.id || 0)), transacting);
  const structureCache = new Map<number, any>();

  return (rows || []).map((row: any) => {
    const currentRoundId = Number(extractRelationRef(row?.examRound) || row?.examRound?.id || 0);
    if (!structureCache.has(currentRoundId)) {
      structureCache.set(currentRoundId, null);
    }
    return { row, currentRoundId, candidateCount: candidateCounts.get(Number(row?.id || 0)) || 0 };
  });
}

export async function getExamRoundReviewSummary(tenantId: number, roundRef: unknown, _authUser: AuthUser) {
  const round = await loadRoundInTenant(tenantId, roundRef);
  const query = normalizeListQuery({ page: 1, pageSize: MAX_PAGE_SIZE });
  const rows = await loadRoundReviewRows(tenantId, Number(round.id), query);
  const structureCache = new Map<number, any>();
  const items = [] as any[];

  for (const item of rows) {
    if (!structureCache.has(item.currentRoundId)) {
      structureCache.set(item.currentRoundId, await loadRoundStructure(tenantId, item.currentRoundId));
    }
    const structure = validateRegistrationStructure(item.row, structureCache.get(item.currentRoundId));
    const listRow = mapReviewListRow(item.row, structure, [], { candidateCount: item.candidateCount });
    items.push(listRow);
  }

  return buildRoundReviewSummary(items);
}

export async function listExamRoundReviews(tenantId: number, roundRef: unknown, rawQuery: Record<string, unknown>, _authUser: AuthUser) {
  const round = await loadRoundInTenant(tenantId, roundRef);
  const query = normalizeListQuery({ ...(rawQuery || {}), examRoundId: Number(round.id) });
  const rows = await loadRoundReviewRows(tenantId, Number(round.id), query);
  const structureCache = new Map<number, any>();
  const items = [] as any[];

  for (const item of rows) {
    if (!structureCache.has(item.currentRoundId)) {
      structureCache.set(item.currentRoundId, await loadRoundStructure(tenantId, item.currentRoundId));
    }
    const structure = validateRegistrationStructure(item.row, structureCache.get(item.currentRoundId));
    items.push(mapReviewListRow(item.row, structure, [], { candidateCount: item.candidateCount }));
  }

  const readinessFiltered = query.readiness === 'ready'
    ? items.filter((item) => item?.readiness?.readyForReview === true)
    : query.readiness === 'blocked'
      ? items.filter((item) => item?.readiness?.readyForReview !== true)
      : items;

  const sorted = sortExamRoundReviewRows(readinessFiltered, query.sort);
  const total = sorted.length;
  const start = (query.page - 1) * query.pageSize;
  const pageData = sorted.slice(start, start + query.pageSize);
  const summary = buildRoundReviewSummary(items);

  return {
    data: pageData,
    meta: {
      pagination: {
        page: query.page,
        pageSize: query.pageSize,
        pageCount: Math.max(1, Math.ceil(total / query.pageSize)),
        total,
      },
      summary,
    },
  };
}

export async function getExamRoundReviewDetail(tenantId: number, roundRef: unknown, registrationRef: unknown, _authUser: AuthUser) {
  const round = await loadRoundInTenant(tenantId, roundRef);
  const registration = await loadRegistrationInTenant(tenantId, registrationRef);
  assertRegistrationInRound(registration, round);
  const roundId = Number(extractRelationRef(registration?.examRound) || registration?.examRound?.id || 0);
  const roundStructure = await loadRoundStructure(tenantId, roundId);
  const structure = validateRegistrationStructure(registration, roundStructure);
  const candidateCount = await countCandidatesForRegistration(tenantId, Number(registration.id));
  const readiness = evaluateRegistrationReadiness(registration, structure, { candidateCount });
  const eligibility = await loadEligibilityForRegistration(tenantId, registration);
  const payments = await loadPaymentsForRegistration(tenantId, Number(registration.id));
  const detail = mapReviewDetail(registration, eligibility, payments, structure, readiness);
  return {
    ...detail,
    reviewStatus: normalizeRegistrationStatus(registration?.registrationStatus),
    readiness: {
      ...detail.readiness,
      readyForReview: readiness.readyForReview,
    },
    candidate: {
      count: candidateCount,
      exists: candidateCount > 0,
    },
  };
}

export async function approveExamRegistrationForRound(tenantId: number, roundRef: unknown, registrationRef: unknown, payload: Record<string, unknown>, authUser: AuthUser) {
  const round = await loadRoundInTenant(tenantId, roundRef);
  const registration = await loadRegistrationInTenant(tenantId, registrationRef);
  assertRegistrationInRound(registration, round);
  return acceptExamRegistration(tenantId, Number(registration.id), payload, authUser);
}

export async function returnExamRegistrationForRound(tenantId: number, roundRef: unknown, registrationRef: unknown, payload: Record<string, unknown>, authUser: AuthUser) {
  const round = await loadRoundInTenant(tenantId, roundRef);
  const registration = await loadRegistrationInTenant(tenantId, registrationRef);
  assertRegistrationInRound(registration, round);
  return returnExamRegistration(tenantId, Number(registration.id), payload, authUser);
}

export async function rejectExamRegistrationForRound(tenantId: number, roundRef: unknown, registrationRef: unknown, payload: Record<string, unknown>, authUser: AuthUser) {
  const round = await loadRoundInTenant(tenantId, roundRef);
  const registration = await loadRegistrationInTenant(tenantId, registrationRef);
  assertRegistrationInRound(registration, round);
  return rejectExamRegistration(tenantId, Number(registration.id), payload, authUser);
}

export function handleExamRegistrationReviewError(ctx: any, error: unknown) {
  if (error instanceof HttpError) {
    const body = {
      error: error.message,
      ...(error.code ? { code: error.code } : {}),
      status: error.status,
      ...(error.details ? { details: error.details } : {}),
    };

    if (error.status === 400) {
      ctx.status = 400;
      ctx.body = body;
      return;
    }
    if (error.status === 401) return ctx.unauthorized(error.message);
    if (error.status === 403) {
      ctx.status = 403;
      ctx.body = body;
      return;
    }
    if (error.status === 404) {
      ctx.status = 404;
      ctx.body = body;
      return;
    }
    if (error.status === 409) {
      ctx.status = 409;
      ctx.body = body;
      return;
    }

    ctx.status = error.status;
    ctx.body = body;
    return;
  }

  if (error instanceof errors.ApplicationError) {
    return ctx.badRequest(error.message);
  }

  strapi.log.error('[exam-registration-review] unexpected error', error);
  return ctx.internalServerError('Failed to process exam registration review request');
}