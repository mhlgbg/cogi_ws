import { errors } from '@strapi/utils';

import { extractRelationRef, mergeTenantWhere, normalizeSortInput, toPositiveInt, toText, whereByParam } from '../../../utils/tenant-scope';

const EXAM_ROUND_UID = 'api::exam-round.exam-round';
const EXAM_SCHEDULE_UID = 'api::exam-schedule.exam-schedule';
const EXAM_CANDIDATE_LIST_UID = 'api::exam-candidate-list.exam-candidate-list';
const EXAM_CANDIDATE_UID = 'api::exam-candidate.exam-candidate';
const EXAM_REGISTRATION_UID = 'api::exam-registration.exam-registration';
const EXAM_REGISTRATION_SUBJECT_UID = 'api::exam-registration-subject.exam-registration-subject';
const EXAM_REGISTRATION_COMPONENT_UID = 'api::exam-registration-component.exam-registration-component';

const MAX_PAGE_SIZE = 100;
const MAX_ASSIGNMENT_ITEMS = 500;
const ALLOCATION_ALLOWED_ROUND_STATUSES = new Set(['registration_closed', 'preparing_exam']);
const ACTIVE_CANDIDATE_STATUSES = new Set(['scheduled', 'present', 'late', 'technical_issue', 'rescheduled', 'completed', 'absent', 'suspended']);
const ASSIGNABLE_REGISTRATION_COMPONENT_STATUSES = new Set(['accepted']);
const ASSIGNABLE_PARTICIPATION_TYPES = new Set(['new_exam']);
const APPROVABLE_CANDIDATE_LIST_STATUSES = new Set(['pending_approval']);
const LOCKABLE_CANDIDATE_LIST_STATUSES = new Set(['approved']);

type AuthUser = { id: number; username?: string | null; fullName?: string | null; email?: string | null };
type HttpErrorDetails = Record<string, unknown> | Array<Record<string, unknown>> | null;
type CandidateListApprovalStatus = 'draft' | 'pending_approval' | 'approved' | 'rejected';
type CandidateListLockStatus = 'unlocked' | 'locked';

type AssignmentInput = { examRegistrationComponentId: number; examScheduleId: number };

type CandidateListReadiness = {
  status: 'draft' | 'finalized';
  readyToFinalize: boolean;
  readyForAttendance: boolean;
  blockingReasons: string[];
  candidateCount: number;
  capacity: number;
  remainingCapacity: number;
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

function normalizeText(value: unknown): string { return toText(value); }

function normalizeOptionalText(value: unknown, maxLength?: number): string | null {
  const text = normalizeText(value);
  if (!text) return null;
  if (maxLength && text.length > maxLength) httpError(400, `Text exceeds max length ${maxLength}`, 'INVALID_REQUEST_BODY');
  return text;
}

function normalizeRequiredText(value: unknown, fieldName: string, code = 'INVALID_REQUEST_BODY', maxLength?: number): string {
  const text = normalizeText(value);
  if (!text) httpError(400, `${fieldName} is required`, code);
  if (maxLength && text.length > maxLength) httpError(400, `${fieldName} max length is ${maxLength}`, code);
  return text;
}

function ensureNoUnknownFields(payload: Record<string, unknown>, allowedKeys: string[], entityName: string) {
  const unknownKeys = Object.keys(payload || {}).filter((key) => !allowedKeys.includes(key));
  if (unknownKeys.length > 0) httpError(400, `${entityName} contains unknown fields`, 'UNKNOWN_FIELDS', { entity: entityName, fields: unknownKeys });
}

function normalizeStoredDateTime(value: unknown): string | null {
  const text = normalizeText(value);
  if (!text) return null;
  const timestamp = Date.parse(text);
  if (Number.isNaN(timestamp)) return null;
  return new Date(timestamp).toISOString();
}

function buildUserDisplayName(user: Pick<AuthUser, 'id' | 'fullName' | 'username' | 'email'> | null | undefined): string {
  if (!user?.id) return '';
  return normalizeText(user.fullName) || normalizeText(user.username) || normalizeText(user.email) || `User #${String(user.id)}`;
}

function summarizeActor(user: Pick<AuthUser, 'id' | 'fullName' | 'username' | 'email'> | null | undefined) {
  if (!user?.id) return null;
  return { id: Number(user.id), displayName: buildUserDisplayName(user) };
}

function isPostgresClient() {
  const client = String(strapi.db?.connection?.client?.config?.client || '').toLowerCase();
  return client.includes('pg');
}

async function acquireLock(trx: any, tenantId: number, key: string) {
  if (!isPostgresClient()) return;
  await trx.raw('select pg_advisory_xact_lock(hashtext(?), hashtext(?))', [String(tenantId), key]);
}

async function acquireScheduleLocks(trx: any, tenantId: number, scheduleIds: number[]) {
  const ids = Array.from(new Set(scheduleIds.filter((item) => Number.isInteger(item) && item > 0))).sort((a, b) => a - b);
  for (const id of ids) await acquireLock(trx, tenantId, `exam-schedule:${id}`);
}

async function acquireRegistrationComponentLocks(trx: any, tenantId: number, componentIds: number[]) {
  const ids = Array.from(new Set(componentIds.filter((item) => Number.isInteger(item) && item > 0))).sort((a, b) => a - b);
  for (const id of ids) await acquireLock(trx, tenantId, `exam-registration-component:${id}`);
}

async function acquireCandidateListLock(trx: any, tenantId: number, candidateListId: number) {
  await acquireLock(trx, tenantId, `exam-candidate-list:${candidateListId}`);
}

function normalizeAssignmentInput(payload: Record<string, unknown>): { assignments: AssignmentInput[] } {
  ensureNoUnknownFields(payload, ['assignments'], 'payload');
  if (!Array.isArray(payload.assignments) || payload.assignments.length === 0) httpError(400, 'assignments is required', 'ALLOCATION_ITEMS_REQUIRED');
  if (payload.assignments.length > MAX_ASSIGNMENT_ITEMS) httpError(400, `assignments exceeds limit ${MAX_ASSIGNMENT_ITEMS}`, 'ALLOCATION_LIMIT_EXCEEDED');
  const assignments = payload.assignments.map((entry, index) => {
    const item = (entry || {}) as Record<string, unknown>;
    ensureNoUnknownFields(item, ['examRegistrationComponentId', 'examScheduleId'], `assignments[${index}]`);
    const examRegistrationComponentId = Number(item.examRegistrationComponentId);
    const examScheduleId = Number(item.examScheduleId);
    if (!Number.isInteger(examRegistrationComponentId) || examRegistrationComponentId <= 0) httpError(400, 'examRegistrationComponentId is invalid', 'INVALID_REQUEST_BODY');
    if (!Number.isInteger(examScheduleId) || examScheduleId <= 0) httpError(400, 'examScheduleId is invalid', 'INVALID_REQUEST_BODY');
    return { examRegistrationComponentId, examScheduleId };
  });
  const seen = new Set<number>();
  for (const assignment of assignments) {
    if (seen.has(assignment.examRegistrationComponentId)) httpError(400, 'Duplicate assignment for registration component in payload.', 'DUPLICATE_ASSIGNMENT_IN_PAYLOAD');
    seen.add(assignment.examRegistrationComponentId);
  }
  return { assignments };
}

function normalizePreviewInput(payload: Record<string, unknown>) {
  ensureNoUnknownFields(payload, ['examRoundComponentIds', 'strategy', 'sortLearnersBy', 'dryRun'], 'payload');
  const ids = Array.isArray(payload.examRoundComponentIds) ? payload.examRoundComponentIds.map((item) => Number(item)).filter((item) => Number.isInteger(item) && item > 0) : [];
  const strategy = normalizeOptionalText(payload.strategy, 50)?.toLowerCase() || 'fill_sequentially';
  if (!['fill_sequentially', 'balance_rooms'].includes(strategy)) httpError(400, 'strategy is invalid', 'INVALID_REQUEST_BODY');
  const sortLearnersBy = normalizeOptionalText(payload.sortLearnersBy, 50)?.toLowerCase() || 'learner_code';
  if (!['learner_code', 'full_name', 'registration_time'].includes(sortLearnersBy)) httpError(400, 'sortLearnersBy is invalid', 'INVALID_REQUEST_BODY');
  const dryRun = payload.dryRun === true;
  return { examRoundComponentIds: ids, strategy, sortLearnersBy, dryRun };
}

function normalizeReassignInput(payload: Record<string, unknown>) {
  ensureNoUnknownFields(payload, ['examCandidateId', 'targetExamScheduleId', 'reason'], 'payload');
  const examCandidateId = Number(payload.examCandidateId);
  const targetExamScheduleId = Number(payload.targetExamScheduleId);
  if (!Number.isInteger(examCandidateId) || examCandidateId <= 0) httpError(400, 'examCandidateId is invalid', 'INVALID_REQUEST_BODY');
  if (!Number.isInteger(targetExamScheduleId) || targetExamScheduleId <= 0) httpError(400, 'targetExamScheduleId is invalid', 'INVALID_REQUEST_BODY');
  const reason = normalizeRequiredText(payload.reason, 'reason', 'REASSIGN_REASON_REQUIRED', 2000);
  return { examCandidateId, targetExamScheduleId, reason };
}

function normalizeUnassignInput(payload: Record<string, unknown>) {
  ensureNoUnknownFields(payload, ['examCandidateIds', 'reason'], 'payload');
  if (!Array.isArray(payload.examCandidateIds) || payload.examCandidateIds.length === 0) httpError(400, 'examCandidateIds is required', 'ALLOCATION_ITEMS_REQUIRED');
  if (payload.examCandidateIds.length > MAX_ASSIGNMENT_ITEMS) httpError(400, `examCandidateIds exceeds limit ${MAX_ASSIGNMENT_ITEMS}`, 'ALLOCATION_LIMIT_EXCEEDED');
  const examCandidateIds = payload.examCandidateIds.map((item) => Number(item));
  for (const id of examCandidateIds) if (!Number.isInteger(id) || id <= 0) httpError(400, 'examCandidateIds contains invalid ids', 'INVALID_REQUEST_BODY');
  const reason = normalizeRequiredText(payload.reason, 'reason', 'UNASSIGN_REASON_REQUIRED', 2000);
  return { examCandidateIds, reason };
}

function normalizeCandidateListReasonInput(payload: Record<string, unknown>, code: string) {
  ensureNoUnknownFields(payload, ['reason', 'note'], 'payload');
  return { reason: normalizeRequiredText(payload.reason, 'reason', code, 2000), note: normalizeOptionalText(payload.note, 2000) };
}

function normalizeSimpleNoteInput(payload: Record<string, unknown>) {
  ensureNoUnknownFields(payload, ['note'], 'payload');
  return { note: normalizeOptionalText(payload.note, 2000) };
}

function normalizeFinalizeInput(payload: Record<string, unknown>) {
  ensureNoUnknownFields(payload, ['note'], 'payload');
  return { note: normalizeOptionalText(payload.note, 2000) };
}

function normalizeReopenInput(payload: Record<string, unknown>) {
  ensureNoUnknownFields(payload, ['reason', 'note'], 'payload');
  return {
    reason: normalizeRequiredText(payload.reason, 'reason', 'REOPEN_REASON_REQUIRED', 2000),
    note: normalizeOptionalText(payload.note, 2000),
  };
}

function normalizeGenerateSequenceInput(payload: Record<string, unknown>) {
  ensureNoUnknownFields(payload, ['sortBy', 'overwriteExisting'], 'payload');
  const sortBy = normalizeOptionalText(payload.sortBy, 50)?.toLowerCase() || 'full_name';
  if (!['full_name', 'learner_code', 'registration_code'].includes(sortBy)) {
    httpError(400, 'sortBy is invalid', 'INVALID_REQUEST_BODY');
  }
  return {
    sortBy,
    overwriteExisting: payload.overwriteExisting === true,
  };
}

function normalizeGenerateNumbersInput(payload: Record<string, unknown>) {
  ensureNoUnknownFields(payload, ['candidateNumberPrefix', 'startNumber', 'padding', 'generateSeatNumber'], 'payload');
  const candidateNumberPrefix = normalizeOptionalText(payload.candidateNumberPrefix, 50) || '';
  const startNumber = typeof payload.startNumber === 'undefined' ? 1 : Number(payload.startNumber);
  const padding = typeof payload.padding === 'undefined' ? 3 : Number(payload.padding);
  if (!Number.isInteger(startNumber) || startNumber <= 0) httpError(400, 'startNumber is invalid', 'INVALID_REQUEST_BODY');
  if (!Number.isInteger(padding) || padding <= 0 || padding > 10) httpError(400, 'padding is invalid', 'INVALID_REQUEST_BODY');
  return { candidateNumberPrefix, startNumber, padding, generateSeatNumber: payload.generateSeatNumber !== false };
}

function normalizeSortOrder(rawSort: unknown, allowedFields: string[], fallback: Array<Record<string, 'asc' | 'desc'>>) {
  const requested = normalizeSortInput(rawSort);
  const filtered = requested.filter((entry) => allowedFields.includes(Object.keys(entry)[0] || ''));
  return filtered.length > 0 ? filtered : fallback;
}

async function loadRoundInTenant(tenantId: number, roundRef: unknown, transacting?: any) {
  const where = whereByParam(roundRef);
  if (!where) httpError(404, 'Không tìm thấy đợt thi trong tenant hiện tại.', 'EXAM_ROUND_NOT_FOUND');
  const row = await strapi.db.query(EXAM_ROUND_UID).findOne({
    where: mergeTenantWhere(where, tenantId),
    select: ['id', 'documentId', 'code', 'name', 'status'],
    ...(transacting ? { transacting } : {}),
  } as any) as any;
  if (!row?.id) httpError(404, 'Không tìm thấy đợt thi trong tenant hiện tại.', 'EXAM_ROUND_NOT_FOUND');
  return row;
}

function assertAllocationAllowed(round: any) {
  const status = normalizeText(round?.status).toLowerCase();
  if (!ALLOCATION_ALLOWED_ROUND_STATUSES.has(status)) httpError(409, 'Đợt thi hiện không cho phép phân bổ thí sinh.', 'EXAM_CANDIDATE_ALLOCATION_NOT_ALLOWED');
}

async function loadScheduleInRound(tenantId: number, roundId: number, scheduleRef: unknown, transacting?: any) {
  const where = whereByParam(scheduleRef);
  if (!where) httpError(404, 'Không tìm thấy lịch thi trong round hiện tại.', 'EXAM_SCHEDULE_NOT_FOUND');
  const row = await strapi.db.query(EXAM_SCHEDULE_UID).findOne({
    where: mergeTenantWhere({ $and: [where, { examRound: { id: { $eq: roundId } } }] }, tenantId),
    select: ['id', 'documentId', 'startAt', 'endAt', 'capacity', 'status', 'examMethod', 'externalExamCode', 'schedulePublishedAt'],
    populate: {
      examRound: { select: ['id', 'documentId', 'code', 'name', 'status'] },
      examRoundSubject: { select: ['id', 'documentId', 'nameSnapshot', 'status'] },
      examRoundComponent: { select: ['id', 'documentId', 'nameSnapshot', 'status'] },
      examRoom: { select: ['id', 'documentId', 'code', 'name', 'capacity', 'roomType', 'isActive'], populate: { examVenue: { select: ['id', 'documentId', 'code', 'name', 'isActive'] } } },
      examVenue: { select: ['id', 'documentId', 'code', 'name', 'isActive'] },
      examCandidateLists: { select: ['id', 'approvalStatus', 'lockStatus'] },
    },
    ...(transacting ? { transacting } : {}),
  } as any) as any;
  if (!row?.id) httpError(404, 'Không tìm thấy lịch thi trong round hiện tại.', 'EXAM_SCHEDULE_NOT_FOUND');
  return row;
}

async function loadRegistrationComponentInRound(tenantId: number, roundId: number, componentRef: unknown, transacting?: any) {
  const where = whereByParam(componentRef);
  if (!where) httpError(404, 'Không tìm thấy registration component trong round hiện tại.', 'EXAM_REGISTRATION_COMPONENT_NOT_FOUND');
  const row = await strapi.db.query(EXAM_REGISTRATION_COMPONENT_UID).findOne({
    where: mergeTenantWhere({ $and: [where, { examRegistration: { examRound: { id: { $eq: roundId } } } }] }, tenantId),
    select: ['id', 'documentId', 'participationType', 'registrationStatus', 'eligibilityStatus', 'schedulingStatus', 'resultStatus'],
    populate: {
      examRegistration: { select: ['id', 'documentId', 'registrationCode', 'registrationStatus', 'paymentStatus', 'acceptedAt', 'studentCodeSnapshot', 'fullNameSnapshot'] , populate: { learner: { select: ['id', 'code', 'fullName', 'learnerStatus'] } } },
      examRegistrationSubject: { select: ['id', 'documentId', 'registrationStatus'], populate: { examRoundSubject: { select: ['id', 'documentId', 'nameSnapshot', 'status'] } } },
      examRoundComponent: { select: ['id', 'documentId', 'nameSnapshot', 'status'], populate: { examRoundSubject: { select: ['id', 'documentId', 'nameSnapshot', 'status'] } } },
      examSchedule: { select: ['id', 'documentId', 'status', 'startAt', 'endAt'] },
      learner: { select: ['id', 'code', 'fullName'] },
      examCandidates: { select: ['id', 'candidateStatus'], populate: { examCandidateList: { select: ['id'] } } },
    },
    ...(transacting ? { transacting } : {}),
  } as any) as any;
  if (!row?.id) httpError(404, 'Không tìm thấy registration component trong round hiện tại.', 'EXAM_REGISTRATION_COMPONENT_NOT_FOUND');
  return row;
}

async function loadCandidateListInRound(tenantId: number, roundId: number, candidateListRef: unknown, transacting?: any) {
  const where = whereByParam(candidateListRef);
  if (!where) httpError(404, 'Không tìm thấy candidate list trong round hiện tại.', 'EXAM_CANDIDATE_LIST_NOT_FOUND');
  const row = await strapi.db.query(EXAM_CANDIDATE_LIST_UID).findOne({
    where: mergeTenantWhere({ $and: [where, { examRound: { id: { $eq: roundId } } }] }, tenantId),
    select: ['id', 'documentId', 'code', 'name', 'version', 'approvalStatus', 'lockStatus', 'approvedAt', 'lockedAt', 'publishedAt', 'submittedAt', 'returnedAt', 'returnReason', 'unlockedAt', 'unlockReason', 'note'],
    populate: {
      examRound: { select: ['id', 'documentId', 'code', 'name', 'status'] },
      examSchedule: { select: ['id', 'documentId', 'startAt', 'endAt', 'capacity', 'status'], populate: { examRoundSubject: { select: ['id', 'nameSnapshot'] }, examRoundComponent: { select: ['id', 'nameSnapshot'] }, examRoom: { select: ['id', 'code', 'name', 'capacity', 'isActive'], populate: { examVenue: { select: ['id', 'code', 'name', 'isActive'] } } } } },
      preparedBy: { select: ['id', 'username', 'fullName', 'email'] },
      submittedBy: { select: ['id', 'username', 'fullName', 'email'] },
      approvedBy: { select: ['id', 'username', 'fullName', 'email'] },
      returnedBy: { select: ['id', 'username', 'fullName', 'email'] },
      lockedBy: { select: ['id', 'username', 'fullName', 'email'] },
      unlockedBy: { select: ['id', 'username', 'fullName', 'email'] },
      examCandidates: {
        select: ['id', 'candidateNumber', 'sequenceNumber', 'seatNumber', 'candidateStatus', 'attendanceStatus', 'synchronizationStatus'],
        populate: {
          learner: { select: ['id', 'code', 'fullName'] },
          examRegistration: { select: ['id', 'registrationCode', 'registrationStatus'], populate: { learner: { select: ['id'] } } },
          examRegistrationSubject: { select: ['id'] },
          examRegistrationComponent: {
            select: ['id', 'registrationStatus', 'eligibilityStatus', 'schedulingStatus'],
            populate: {
              examRegistration: { select: ['id'] },
              examRegistrationSubject: { select: ['id'] },
              examSchedule: { select: ['id', 'startAt', 'endAt', 'status'] },
              examRoundComponent: { select: ['id'] },
            },
          },
          componentResults: { select: ['id'] },
        },
      },
    },
    ...(transacting ? { transacting } : {}),
  } as any) as any;
  if (!row?.id) httpError(404, 'Không tìm thấy candidate list trong round hiện tại.', 'EXAM_CANDIDATE_LIST_NOT_FOUND');
  return row;
}

async function loadCandidateInRound(tenantId: number, roundId: number, candidateRef: unknown, transacting?: any) {
  const where = whereByParam(candidateRef);
  if (!where) httpError(404, 'Không tìm thấy candidate trong round hiện tại.', 'EXAM_CANDIDATE_NOT_FOUND');
  const row = await strapi.db.query(EXAM_CANDIDATE_UID).findOne({
    where: mergeTenantWhere({ $and: [where, { examRegistration: { examRound: { id: { $eq: roundId } } } }] }, tenantId),
    select: ['id', 'documentId', 'candidateNumber', 'sequenceNumber', 'seatNumber', 'candidateStatus', 'attendanceStatus', 'synchronizationStatus', 'note'],
    populate: {
      examCandidateList: { select: ['id', 'approvalStatus', 'lockStatus'], populate: { examSchedule: { select: ['id', 'startAt', 'endAt', 'status'], populate: { examRoundComponent: { select: ['id', 'nameSnapshot'] } } } } },
      examRegistration: { select: ['id', 'registrationCode', 'registrationStatus'] },
      examRegistrationSubject: { select: ['id'] },
      examRegistrationComponent: { select: ['id', 'participationType', 'registrationStatus', 'eligibilityStatus', 'schedulingStatus'], populate: { examRoundComponent: { select: ['id', 'nameSnapshot'] }, examSchedule: { select: ['id', 'startAt', 'endAt', 'status'] } } },
      learner: { select: ['id', 'code', 'fullName'] },
      componentResults: { select: ['id'] },
    },
    ...(transacting ? { transacting } : {}),
  } as any) as any;
  if (!row?.id) httpError(404, 'Không tìm thấy candidate trong round hiện tại.', 'EXAM_CANDIDATE_NOT_FOUND');
  return row;
}

function deriveCandidateListStatus(list: any): 'draft' | 'finalized' {
  const approvalStatus = normalizeText(list?.approvalStatus).toLowerCase();
  const lockStatus = normalizeText(list?.lockStatus).toLowerCase();
  if (approvalStatus === 'approved' && lockStatus === 'locked') return 'finalized';
  return 'draft';
}

function sortCandidatesForSequence(candidates: any[], sortBy: string) {
  return [...(candidates || [])].sort((left: any, right: any) => {
    if (sortBy === 'learner_code') {
      return normalizeText(left?.learner?.code).localeCompare(normalizeText(right?.learner?.code))
        || normalizeText(left?.examRegistration?.registrationCode).localeCompare(normalizeText(right?.examRegistration?.registrationCode))
        || (Number(left?.id || 0) - Number(right?.id || 0));
    }
    if (sortBy === 'registration_code') {
      return normalizeText(left?.examRegistration?.registrationCode).localeCompare(normalizeText(right?.examRegistration?.registrationCode))
        || normalizeText(left?.learner?.code).localeCompare(normalizeText(right?.learner?.code))
        || (Number(left?.id || 0) - Number(right?.id || 0));
    }
    return normalizeText(left?.learner?.fullName).localeCompare(normalizeText(right?.learner?.fullName))
      || normalizeText(left?.learner?.code).localeCompare(normalizeText(right?.learner?.code))
      || normalizeText(left?.examRegistration?.registrationCode).localeCompare(normalizeText(right?.examRegistration?.registrationCode))
      || (Number(left?.id || 0) - Number(right?.id || 0));
  });
}

function buildCandidateListReadiness(list: any, activeCandidates: any[]): CandidateListReadiness {
  const blockingReasons: string[] = [];
  const status = deriveCandidateListStatus(list);
  const candidateCount = activeCandidates.length;
  const capacity = Number(list?.examSchedule?.capacity || 0) || 0;
  const remainingCapacity = Math.max(capacity - candidateCount, 0);
  if (candidateCount <= 0) blockingReasons.push('EMPTY_CANDIDATE_LIST');
  if (!list?.examSchedule?.id) blockingReasons.push('SCHEDULE_INVALID');
  if (normalizeText(list?.examSchedule?.status).toLowerCase() === 'cancelled') blockingReasons.push('SCHEDULE_CANCELLED');
  if (!list?.examSchedule?.examRoom?.id || list?.examSchedule?.examRoom?.isActive !== true || list?.examSchedule?.examRoom?.examVenue?.isActive !== true) blockingReasons.push('ROOM_INVALID');
  if (capacity > 0 && candidateCount > capacity) blockingReasons.push('CAPACITY_EXCEEDED');

  const componentIds = new Set<number>();
  const seenSequence = new Set<number>();
  for (const candidate of activeCandidates) {
    const registrationStatus = normalizeText(candidate?.examRegistration?.registrationStatus).toLowerCase();
    const componentStatus = normalizeText(candidate?.examRegistrationComponent?.registrationStatus).toLowerCase();
    if (registrationStatus !== 'accepted') blockingReasons.push('REGISTRATION_NOT_APPROVED');
    if (registrationStatus === 'cancelled' || registrationStatus === 'rejected') blockingReasons.push('REGISTRATION_CANCELLED');
    if (componentStatus !== 'accepted') blockingReasons.push('REGISTRATION_NOT_APPROVED');
    const componentId = Number(extractRelationRef(candidate?.examRegistrationComponent) || candidate?.examRegistrationComponent?.id || 0);
    if (componentId > 0) {
      if (componentIds.has(componentId)) blockingReasons.push('DUPLICATE_CANDIDATE');
      componentIds.add(componentId);
    } else {
      blockingReasons.push('ORPHAN_CANDIDATE');
    }
    if (Number(extractRelationRef(candidate?.examRegistrationComponent?.examSchedule) || candidate?.examRegistrationComponent?.examSchedule?.id || 0) !== Number(extractRelationRef(list?.examSchedule) || list?.examSchedule?.id || 0)) {
      blockingReasons.push('ORPHAN_CANDIDATE');
    }
    const sequenceNumber = Number(candidate?.sequenceNumber || 0);
    if (!sequenceNumber) {
      blockingReasons.push('SEQUENCE_NUMBER_MISSING');
    } else if (seenSequence.has(sequenceNumber)) {
      blockingReasons.push('SEQUENCE_NUMBER_MISSING');
    } else {
      seenSequence.add(sequenceNumber);
    }
  }

  const uniqueReasons = [...new Set(blockingReasons)];
  const readyToFinalize = uniqueReasons.length === 0;
  return {
    status,
    readyToFinalize,
    readyForAttendance: status === 'finalized' && candidateCount > 0 && readyToFinalize,
    blockingReasons: uniqueReasons,
    candidateCount,
    capacity,
    remainingCapacity,
  };
}

async function findCandidateListBySchedule(tenantId: number, scheduleId: number, transacting?: any) {
  const rows = await strapi.db.query(EXAM_CANDIDATE_LIST_UID).findMany({
    where: mergeTenantWhere({ examSchedule: { id: { $eq: scheduleId } } }, tenantId),
    select: ['id', 'documentId', 'code', 'name', 'version', 'approvalStatus', 'lockStatus', 'submittedAt', 'approvedAt', 'lockedAt'],
    populate: { examSchedule: { select: ['id'] } },
    limit: 1,
    ...(transacting ? { transacting } : {}),
  } as any) as any[];
  return rows[0] || null;
}

async function countActiveCandidatesForList(tenantId: number, candidateListId: number, transacting?: any) {
  const rows = await strapi.db.query(EXAM_CANDIDATE_UID).findMany({
    where: mergeTenantWhere({ examCandidateList: { id: { $eq: candidateListId } } }, tenantId),
    select: ['id', 'candidateStatus'],
    ...(transacting ? { transacting } : {}),
  } as any) as any[];
  return (rows || []).filter((item) => normalizeText(item?.candidateStatus).toLowerCase() !== 'cancelled').length;
}

async function countActiveCandidatesForSchedule(tenantId: number, scheduleId: number, transacting?: any) {
  const schedule = await loadScheduleInRound(tenantId, Number(extractRelationRef((await loadRoundForSchedule(tenantId, scheduleId, transacting))?.examRound) || 0), scheduleId, transacting).catch(() => null);
  if (!schedule?.id) return 0;
  const list = await findCandidateListBySchedule(tenantId, Number(schedule.id), transacting);
  if (!list?.id) return 0;
  return await countActiveCandidatesForList(tenantId, Number(list.id), transacting);
}

async function loadRoundForSchedule(tenantId: number, scheduleId: number, transacting?: any) {
  const row = await strapi.db.query(EXAM_SCHEDULE_UID).findOne({
    where: mergeTenantWhere({ id: { $eq: scheduleId } }, tenantId),
    populate: { examRound: { select: ['id'] } },
    ...(transacting ? { transacting } : {}),
  } as any) as any;
  return row || null;
}

function assertScheduleAvailableForAllocation(schedule: any, candidateList: any | null, activeCount: number) {
  const status = normalizeText(schedule?.status).toLowerCase();
  if (status !== 'published') httpError(409, 'Schedule is not available for allocation.', 'EXAM_SCHEDULE_NOT_AVAILABLE_FOR_ALLOCATION');
  if (candidateList?.lockStatus === 'locked') httpError(409, 'Candidate list is locked.', 'EXAM_CANDIDATE_LIST_LOCKED');
  if (normalizeText(candidateList?.approvalStatus).toLowerCase() === 'approved' && normalizeText(candidateList?.lockStatus).toLowerCase() === 'locked') {
    httpError(409, 'Candidate list has already been finalized.', 'CANDIDATE_LIST_FINALIZED');
  }
  const availableCapacity = Math.max((Number(schedule?.capacity || 0) || 0) - activeCount, 0);
  if (availableCapacity <= 0) httpError(409, 'Schedule capacity is full.', 'EXAM_SCHEDULE_CAPACITY_FULL');
}

function assertRegistrationComponentAssignable(component: any) {
  if (normalizeText(component?.examRegistration?.registrationStatus).toLowerCase() !== 'accepted') httpError(409, 'Registration is not accepted.', 'EXAM_REGISTRATION_NOT_ACCEPTED');
  if (!ASSIGNABLE_REGISTRATION_COMPONENT_STATUSES.has(normalizeText(component?.registrationStatus).toLowerCase())) httpError(409, 'Registration component is not assignable.', 'EXAM_REGISTRATION_COMPONENT_NOT_ELIGIBLE');
  if (!ASSIGNABLE_PARTICIPATION_TYPES.has(normalizeText(component?.participationType).toLowerCase())) httpError(409, 'Registration component is not assignable.', 'EXAM_REGISTRATION_COMPONENT_NOT_ELIGIBLE');
  if (normalizeText(component?.eligibilityStatus).toLowerCase() !== 'eligible') httpError(409, 'Registration component is not eligible.', 'EXAM_REGISTRATION_COMPONENT_NOT_ELIGIBLE');
  if (extractRelationRef(component?.examSchedule) || component?.examSchedule?.id) httpError(409, 'Registration component is already assigned.', 'EXAM_REGISTRATION_COMPONENT_ALREADY_ASSIGNED');
  if (Array.isArray(component?.examCandidates) && component.examCandidates.some((item: any) => normalizeText(item?.candidateStatus).toLowerCase() !== 'cancelled')) {
    httpError(409, 'Registration component is already assigned.', 'EXAM_REGISTRATION_COMPONENT_ALREADY_ASSIGNED');
  }
  if (normalizeText(component?.examRoundComponent?.status).toLowerCase() !== 'active') httpError(409, 'Registration component source is inactive.', 'EXAM_REGISTRATION_COMPONENT_NOT_ELIGIBLE');
  if (normalizeText(component?.examRoundComponent?.examRoundSubject?.status).toLowerCase() !== 'active') httpError(409, 'Registration component source is inactive.', 'EXAM_REGISTRATION_COMPONENT_NOT_ELIGIBLE');
}

async function findLearnerScheduleConflict(tenantId: number, learnerId: number, startAt: string, endAt: string, options: { excludeCandidateId?: number; transacting?: any } = {}) {
  const rows = await strapi.db.query(EXAM_CANDIDATE_UID).findMany({
    where: mergeTenantWhere({ learner: { id: { $eq: learnerId } }, ...(options.excludeCandidateId ? { id: { $ne: options.excludeCandidateId } } : {}) }, tenantId),
    select: ['id', 'candidateStatus'],
    populate: {
      examCandidateList: { populate: { examSchedule: { select: ['id', 'startAt', 'endAt'] } } },
    },
    ...(options.transacting ? { transacting: options.transacting } : {}),
  } as any) as any[];
  return (rows || []).find((row) => {
    if (normalizeText(row?.candidateStatus).toLowerCase() === 'cancelled') return false;
    const schedule = row?.examCandidateList?.examSchedule;
    const existingStart = normalizeStoredDateTime(schedule?.startAt);
    const existingEnd = normalizeStoredDateTime(schedule?.endAt);
    if (!existingStart || !existingEnd) return false;
    return Date.parse(startAt) < Date.parse(existingEnd) && Date.parse(endAt) > Date.parse(existingStart);
  }) || null;
}

function assertNoLearnerScheduleConflict(conflict: any, learnerId: number) {
  if (!conflict?.id) return;
  const schedule = conflict?.examCandidateList?.examSchedule;
  httpError(409, 'Learner has an overlapping exam schedule.', 'LEARNER_EXAM_SCHEDULE_CONFLICT', {
    learnerId,
    conflictingCandidateId: Number(conflict.id),
    conflictingScheduleId: Number(extractRelationRef(schedule) || schedule?.id || 0),
    startAt: normalizeStoredDateTime(schedule?.startAt),
    endAt: normalizeStoredDateTime(schedule?.endAt),
  });
}

async function createOrGetCandidateListForSchedule(tenantId: number, round: any, schedule: any, authUser: AuthUser, trx: any) {
  const existing = await findCandidateListBySchedule(tenantId, Number(schedule.id), trx);
  if (existing?.id) return await loadCandidateListInRound(tenantId, Number(round.id), existing.id, trx);
  const code = `ECL-${normalizeText(round?.code || 'ROUND')}-${String(schedule.id).padStart(4, '0')}`.slice(0, 100);
  const componentName = normalizeText(schedule?.examRoundComponent?.nameSnapshot || 'Component');
  const roomName = normalizeText(schedule?.examRoom?.name || schedule?.examRoom?.code || 'Room');
  const name = `${componentName} - ${roomName} - ${normalizeStoredDateTime(schedule?.startAt) || ''}`.slice(0, 200);
  const created = await strapi.db.query(EXAM_CANDIDATE_LIST_UID).create({
    data: {
      code,
      name,
      examRound: Number(round.id),
      examSchedule: Number(schedule.id),
      version: 1,
      approvalStatus: 'draft',
      lockStatus: 'unlocked',
      preparedBy: authUser.id,
      tenant: tenantId,
    },
    transacting: trx,
  } as any) as any;
  if (!created?.id) httpError(409, 'Cannot create candidate list for schedule.', 'EXAM_CANDIDATE_ALLOCATION_FAILED');
  return await loadCandidateListInRound(tenantId, Number(round.id), created.id, trx);
}

function candidateIsActive(candidate: any) {
  return normalizeText(candidate?.candidateStatus).toLowerCase() !== 'cancelled';
}

async function createCandidateForAssignment(tenantId: number, candidateList: any, registrationComponent: any, authUser: AuthUser, trx: any) {
  const created = await strapi.db.query(EXAM_CANDIDATE_UID).create({
    data: {
      examCandidateList: Number(candidateList.id),
      examRegistration: Number(extractRelationRef(registrationComponent?.examRegistration) || registrationComponent?.examRegistration?.id || 0),
      examRegistrationSubject: Number(extractRelationRef(registrationComponent?.examRegistrationSubject) || registrationComponent?.examRegistrationSubject?.id || 0),
      examRegistrationComponent: Number(registrationComponent.id),
      learner: Number(extractRelationRef(registrationComponent?.examRegistration?.learner) || registrationComponent?.examRegistration?.learner?.id || 0),
      synchronizationStatus: 'not_required',
      attendanceStatus: 'not_checked_in',
      candidateStatus: 'scheduled',
      tenant: tenantId,
    },
    transacting: trx,
  } as any) as any;
  if (!created?.id) httpError(409, 'Cannot create exam candidate.', 'EXAM_CANDIDATE_ALLOCATION_FAILED');
  return created;
}

async function updateRegistrationComponentSchedule(registrationComponentId: number, scheduleId: number | null, trx: any) {
  const data: Record<string, unknown> = {
    examSchedule: scheduleId,
    schedulingStatus: scheduleId ? 'scheduled' : 'not_scheduled',
  };
  await strapi.db.query(EXAM_REGISTRATION_COMPONENT_UID).update({ where: { id: registrationComponentId }, data, transacting: trx } as any);
}

function mapScheduleSummary(schedule: any, candidateList: any | null, assignedCount: number) {
  return {
    scheduleId: Number(schedule?.id || 0),
    component: schedule?.examRoundComponent ? { id: Number(extractRelationRef(schedule.examRoundComponent) || schedule.examRoundComponent.id || 0), nameSnapshot: normalizeText(schedule.examRoundComponent.nameSnapshot) } : null,
    room: schedule?.examRoom ? { id: Number(extractRelationRef(schedule.examRoom) || schedule.examRoom.id || 0), code: normalizeText(schedule.examRoom.code), name: normalizeText(schedule.examRoom.name) } : null,
    venue: schedule?.examVenue ? { id: Number(extractRelationRef(schedule.examVenue) || schedule.examVenue.id || 0), code: normalizeText(schedule.examVenue.code), name: normalizeText(schedule.examVenue.name) } : null,
    startAt: normalizeStoredDateTime(schedule?.startAt),
    endAt: normalizeStoredDateTime(schedule?.endAt),
    capacity: Number(schedule?.capacity || 0) || 0,
    assignedCount,
    availableCapacity: Math.max((Number(schedule?.capacity || 0) || 0) - assignedCount, 0),
    candidateListId: candidateList?.id ? Number(candidateList.id) : null,
    candidateListApprovalStatus: candidateList?.approvalStatus || null,
    lockStatus: candidateList?.lockStatus || null,
  };
}

async function getAssignableSchedulesForComponent(tenantId: number, roundId: number, componentId: number, learnerId: number, transacting?: any) {
  const rows = await strapi.db.query(EXAM_SCHEDULE_UID).findMany({
    where: mergeTenantWhere({ examRound: { id: { $eq: roundId } }, examRoundComponent: { id: { $eq: componentId } }, status: 'published' }, tenantId),
    select: ['id', 'documentId', 'startAt', 'endAt', 'capacity', 'status'],
    populate: {
      examRoundComponent: { select: ['id', 'nameSnapshot'] },
      examRoom: { select: ['id', 'code', 'name', 'capacity', 'roomType', 'isActive'], populate: { examVenue: { select: ['id', 'code', 'name', 'isActive'] } } },
      examVenue: { select: ['id', 'code', 'name', 'isActive'] },
    },
    orderBy: [{ startAt: 'asc' }, { id: 'asc' }],
    ...(transacting ? { transacting } : {}),
  } as any) as any[];
  const result = [];
  for (const row of rows || []) {
    const candidateList = await findCandidateListBySchedule(tenantId, Number(row.id), transacting);
    const assignedCount = candidateList?.id ? await countActiveCandidatesForList(tenantId, Number(candidateList.id), transacting) : 0;
    if (candidateList?.lockStatus === 'locked') continue;
    if (Math.max((Number(row?.capacity || 0) || 0) - assignedCount, 0) <= 0) continue;
    const learnerConflict = await findLearnerScheduleConflict(tenantId, learnerId, normalizeStoredDateTime(row.startAt) as string, normalizeStoredDateTime(row.endAt) as string, { transacting });
    result.push({ ...mapScheduleSummary(row, candidateList, assignedCount), conflictWarning: learnerConflict ? 'LEARNER_EXAM_SCHEDULE_CONFLICT' : null });
  }
  return result;
}

function sortComponentsForPreview(items: any[], sortLearnersBy: string) {
  const list = [...items];
  list.sort((left, right) => {
    if (sortLearnersBy === 'full_name') {
      return normalizeText(left?.examRegistration?.fullNameSnapshot || left?.examRegistration?.learner?.fullName).localeCompare(normalizeText(right?.examRegistration?.fullNameSnapshot || right?.examRegistration?.learner?.fullName));
    }
    if (sortLearnersBy === 'registration_time') {
      return Date.parse(normalizeStoredDateTime(left?.examRegistration?.registeredAt) || '') - Date.parse(normalizeStoredDateTime(right?.examRegistration?.registeredAt) || '');
    }
    return normalizeText(left?.examRegistration?.studentCodeSnapshot || left?.examRegistration?.learner?.code).localeCompare(normalizeText(right?.examRegistration?.studentCodeSnapshot || right?.examRegistration?.learner?.code));
  });
  return list;
}

async function validateCandidateChain(tenantId: number, roundId: number, candidateList: any, candidates: any[]) {
  const errors: Array<{ path: string; code: string; message: string }> = [];
  for (const candidate of candidates || []) {
    const registration = candidate?.examRegistration;
    const registrationComponent = candidate?.examRegistrationComponent;
    const registrationSubject = candidate?.examRegistrationSubject;
    const learnerId = Number(extractRelationRef(candidate?.learner) || candidate?.learner?.id || 0);
    const registrationLearnerId = Number(extractRelationRef(registration?.learner) || registration?.learner?.id || 0);
    if (learnerId !== registrationLearnerId) errors.push({ path: `candidate:${candidate.id}.learner`, code: 'EXAM_CANDIDATE_CHAIN_INVALID', message: 'Candidate learner does not match registration learner.' });
    if (Number(extractRelationRef(registrationComponent?.examRegistration) || registrationComponent?.examRegistration?.id || 0) !== Number(registration?.id || 0)) errors.push({ path: `candidate:${candidate.id}.registration`, code: 'EXAM_CANDIDATE_CHAIN_INVALID', message: 'Candidate registration does not match registration component registration.' });
    if (Number(extractRelationRef(registrationComponent?.examRegistrationSubject) || registrationComponent?.examRegistrationSubject?.id || 0) !== Number(registrationSubject?.id || 0)) errors.push({ path: `candidate:${candidate.id}.registrationSubject`, code: 'EXAM_CANDIDATE_CHAIN_INVALID', message: 'Candidate registration subject does not match registration component subject.' });
    if (Number(extractRelationRef(registrationComponent?.examSchedule) || registrationComponent?.examSchedule?.id || 0) !== Number(extractRelationRef(candidateList?.examSchedule) || candidateList?.examSchedule?.id || 0)) errors.push({ path: `candidate:${candidate.id}.schedule`, code: 'EXAM_CANDIDATE_CHAIN_INVALID', message: 'Candidate schedule does not match registration component schedule.' });
    if (normalizeText(registration?.registrationStatus).toLowerCase() !== 'accepted') errors.push({ path: `candidate:${candidate.id}.registrationStatus`, code: 'EXAM_CANDIDATE_CHAIN_INVALID', message: 'Candidate registration is not accepted.' });
    if (normalizeText(registrationComponent?.registrationStatus).toLowerCase() !== 'accepted') errors.push({ path: `candidate:${candidate.id}.componentStatus`, code: 'EXAM_CANDIDATE_CHAIN_INVALID', message: 'Candidate registration component is not accepted.' });
  }
  if (errors.length > 0) httpError(409, 'Candidate chain is invalid.', 'EXAM_CANDIDATE_CHAIN_INVALID', { errors });
}

function logAllocationEvent(event: string, payload: Record<string, unknown>) {
  strapi.log.info(`[exam-candidate-allocation] ${event} ${JSON.stringify(payload)}`);
}

export async function listUnassignedRegistrationComponents(tenantId: number, roundRef: unknown, rawQuery: Record<string, unknown>, _authUser: AuthUser) {
  const round = await loadRoundInTenant(tenantId, roundRef);
  assertAllocationAllowed(round);
  const page = toPositiveInt(rawQuery.page, 1);
  const pageSize = Math.min(MAX_PAGE_SIZE, toPositiveInt(rawQuery.pageSize, 20));
  const whereParts: Record<string, unknown>[] = [
    { examRegistration: { examRound: { id: { $eq: Number(round.id) } }, registrationStatus: 'accepted' } },
    { registrationStatus: 'accepted' },
    { participationType: 'new_exam' },
    { eligibilityStatus: 'eligible' },
    { examSchedule: { id: { $null: true } } },
  ];
  const examRoundSubjectId = Number(rawQuery.examRoundSubjectId || 0);
  if (Number.isInteger(examRoundSubjectId) && examRoundSubjectId > 0) whereParts.push({ examRegistrationSubject: { examRoundSubject: { id: { $eq: examRoundSubjectId } } } });
  const examRoundComponentId = Number(rawQuery.examRoundComponentId || 0);
  if (Number.isInteger(examRoundComponentId) && examRoundComponentId > 0) whereParts.push({ examRoundComponent: { id: { $eq: examRoundComponentId } } });
  const learnerCode = normalizeOptionalText(rawQuery.learnerCode, 100);
  if (learnerCode) whereParts.push({ examRegistration: { studentCodeSnapshot: { $containsi: learnerCode } } });
  const learnerName = normalizeOptionalText(rawQuery.learnerName, 200);
  if (learnerName) whereParts.push({ examRegistration: { fullNameSnapshot: { $containsi: learnerName } } });
  const where = mergeTenantWhere({ $and: whereParts }, tenantId);
  const orderBy = normalizeSortOrder(rawQuery.sort, ['id'], [{ id: 'asc' }]);
  const start = (page - 1) * pageSize;
  const [rows, total] = await Promise.all([
    strapi.db.query(EXAM_REGISTRATION_COMPONENT_UID).findMany({ where, offset: start, limit: pageSize, orderBy, populate: { examRegistration: { select: ['id', 'documentId', 'registrationCode', 'paymentStatus', 'acceptedAt', 'registeredAt', 'studentCodeSnapshot', 'fullNameSnapshot', 'classNameSnapshot', 'cohortSnapshot', 'majorSnapshot'], populate: { learner: { select: ['id', 'code', 'fullName'] } } }, examRegistrationSubject: { select: ['id'], populate: { examRoundSubject: { select: ['id', 'nameSnapshot'] } } }, examRoundComponent: { select: ['id', 'nameSnapshot'] }, learner: { select: ['id', 'code', 'fullName'] }, examCandidates: { select: ['id', 'candidateStatus'] } } } as any),
    strapi.db.query(EXAM_REGISTRATION_COMPONENT_UID).count({ where } as any),
  ]);
  const data = [];
  for (const row of rows || []) {
    if (Array.isArray(row?.examCandidates) && row.examCandidates.some(candidateIsActive)) continue;
    const learnerId = Number(extractRelationRef(row?.examRegistration?.learner) || row?.examRegistration?.learner?.id || 0);
    const availableSchedules = await getAssignableSchedulesForComponent(tenantId, Number(round.id), Number(extractRelationRef(row?.examRoundComponent) || row?.examRoundComponent?.id || 0), learnerId);
    data.push({
      registrationComponentId: Number(row?.id || 0),
      registrationCode: normalizeText(row?.examRegistration?.registrationCode),
      learner: { id: learnerId, code: normalizeText(row?.examRegistration?.studentCodeSnapshot || row?.examRegistration?.learner?.code), fullName: normalizeText(row?.examRegistration?.fullNameSnapshot || row?.examRegistration?.learner?.fullName), className: normalizeOptionalText(row?.examRegistration?.classNameSnapshot), cohort: normalizeOptionalText(row?.examRegistration?.cohortSnapshot), major: normalizeOptionalText(row?.examRegistration?.majorSnapshot) },
      subject: row?.examRegistrationSubject?.examRoundSubject ? { id: Number(extractRelationRef(row.examRegistrationSubject.examRoundSubject) || row.examRegistrationSubject.examRoundSubject.id || 0), nameSnapshot: normalizeText(row.examRegistrationSubject.examRoundSubject.nameSnapshot) } : null,
      component: row?.examRoundComponent ? { id: Number(extractRelationRef(row.examRoundComponent) || row.examRoundComponent.id || 0), nameSnapshot: normalizeText(row.examRoundComponent.nameSnapshot) } : null,
      paymentStatus: normalizeText(row?.examRegistration?.paymentStatus) || null,
      acceptedAt: normalizeStoredDateTime(row?.examRegistration?.acceptedAt),
      availableSchedules,
      conflictWarnings: availableSchedules.filter((item: any) => item.conflictWarning).map((item: any) => item.conflictWarning),
    });
  }
  return { data, meta: { pagination: { page, pageSize, pageCount: Math.max(1, Math.ceil(total / pageSize)), total } } };
}

export async function getAllocationCapacityOverview(tenantId: number, roundRef: unknown, rawQuery: Record<string, unknown>, _authUser: AuthUser) {
  const round = await loadRoundInTenant(tenantId, roundRef);
  const whereParts: Record<string, unknown>[] = [{ examRound: { id: { $eq: Number(round.id) } } }];
  const scheduleId = Number(rawQuery.scheduleId || 0);
  const examRoundComponentId = Number((rawQuery.examRoundComponentId ?? rawQuery.componentId) || 0);
  const examRoundSubjectId = Number((rawQuery.examRoundSubjectId ?? rawQuery.subjectId) || 0);
  if (Number.isInteger(scheduleId) && scheduleId > 0) whereParts.push({ id: { $eq: scheduleId } });
  if (Number.isInteger(examRoundComponentId) && examRoundComponentId > 0) whereParts.push({ examRoundComponent: { id: { $eq: examRoundComponentId } } });
  if (Number.isInteger(examRoundSubjectId) && examRoundSubjectId > 0) whereParts.push({ examRoundSubject: { id: { $eq: examRoundSubjectId } } });
  const where = mergeTenantWhere({ $and: whereParts }, tenantId);
  const rows = await strapi.db.query(EXAM_SCHEDULE_UID).findMany({ where, orderBy: normalizeSortOrder(rawQuery.sort, ['startAt', 'id'], [{ startAt: 'asc' }, { id: 'asc' }]), populate: { examRoundComponent: { select: ['id', 'nameSnapshot'] }, examRoom: { select: ['id', 'code', 'name', 'capacity'], populate: { examVenue: { select: ['id', 'code', 'name'] } } }, examVenue: { select: ['id', 'code', 'name'] } } } as any) as any[];
  const data = [];
  let totalCapacity = 0;
  let assignedCount = 0;
  for (const row of rows || []) {
    const candidateList = await findCandidateListBySchedule(tenantId, Number(row.id));
    const activeCount = candidateList?.id ? await countActiveCandidatesForList(tenantId, Number(candidateList.id)) : 0;
    const assignedByRegistrationComponents = await strapi.db.query(EXAM_REGISTRATION_COMPONENT_UID).count({ where: mergeTenantWhere({ examSchedule: { id: { $eq: Number(row.id) } } }, tenantId) } as any);
    const item = mapScheduleSummary(row, candidateList, activeCount);
    data.push({ ...item, warnings: activeCount !== assignedByRegistrationComponents ? [{ code: 'ALLOCATION_COUNT_MISMATCH', message: 'Candidate count and registration-component assignment count are not aligned.' }] : [] });
    totalCapacity += Number(row?.capacity || 0) || 0;
    assignedCount += activeCount;
  }
  return { data, meta: { summary: { totalSchedules: data.length, totalCapacity, assignedCount, remainingCapacity: Math.max(totalCapacity - assignedCount, 0) } } };
}

export async function getExamCandidateAllocationPreview(tenantId: number, roundRef: unknown, payload: Record<string, unknown>, _authUser: AuthUser) {
  const round = await loadRoundInTenant(tenantId, roundRef);
  assertAllocationAllowed(round);
  const input = normalizePreviewInput(payload || {});
  const where = mergeTenantWhere({
    examRegistration: { examRound: { id: { $eq: Number(round.id) } }, registrationStatus: 'accepted' },
    registrationStatus: 'accepted',
    participationType: 'new_exam',
    eligibilityStatus: 'eligible',
    examSchedule: { id: { $null: true } },
    ...(input.examRoundComponentIds.length > 0 ? { examRoundComponent: { id: { $in: input.examRoundComponentIds } } } : {}),
  }, tenantId);
  const rows = await strapi.db.query(EXAM_REGISTRATION_COMPONENT_UID).findMany({ where, populate: { examRegistration: { select: ['id', 'registrationCode', 'registeredAt', 'studentCodeSnapshot', 'fullNameSnapshot'], populate: { learner: { select: ['id', 'code', 'fullName'] } } }, examRoundComponent: { select: ['id', 'nameSnapshot'] } } } as any) as any[];
  const ordered = sortComponentsForPreview(rows || [], input.sortLearnersBy);
  const assignments: Array<{ examRegistrationComponentId: number; examScheduleId: number }> = [];
  const unassigned: Array<{ examRegistrationComponentId: number; reason: string }> = [];
  const conflicts: Array<{ examRegistrationComponentId: number; code: string }> = [];
  const scheduleUsage = new Map<number, number>();
  for (const row of ordered) {
    const learnerId = Number(extractRelationRef(row?.examRegistration?.learner) || row?.examRegistration?.learner?.id || 0);
    const schedules = await getAssignableSchedulesForComponent(tenantId, Number(round.id), Number(extractRelationRef(row?.examRoundComponent) || row?.examRoundComponent?.id || 0), learnerId);
    const fit = schedules.filter((item: any) => {
      const used = scheduleUsage.get(Number(item.scheduleId)) || 0;
      return (item.availableCapacity - used) > 0 && !item.conflictWarning;
    });
    if (fit.length === 0) {
      unassigned.push({ examRegistrationComponentId: Number(row.id), reason: 'EXAM_SCHEDULE_CAPACITY_INSUFFICIENT' });
      continue;
    }
    let chosen = fit[0];
    if (input.strategy === 'balance_rooms') {
      chosen = [...fit].sort((left: any, right: any) => ((scheduleUsage.get(Number(left.scheduleId)) || 0) - (scheduleUsage.get(Number(right.scheduleId)) || 0)) || (left.scheduleId - right.scheduleId))[0];
    }
    assignments.push({ examRegistrationComponentId: Number(row.id), examScheduleId: Number(chosen.scheduleId) });
    scheduleUsage.set(Number(chosen.scheduleId), (scheduleUsage.get(Number(chosen.scheduleId)) || 0) + 1);
  }
  return { assignments, unassigned, conflicts, capacitySummary: Object.fromEntries(scheduleUsage.entries()) };
}

async function executeAssignments(tenantId: number, round: any, assignments: AssignmentInput[], authUser: AuthUser, trx: any) {
  const scheduleIds = assignments.map((item) => item.examScheduleId);
  const registrationComponentIds = assignments.map((item) => item.examRegistrationComponentId);
  await acquireScheduleLocks(trx, tenantId, scheduleIds);
  await acquireRegistrationComponentLocks(trx, tenantId, registrationComponentIds);
  const seenScheduleNewCounts = new Map<number, number>();
  const createdCandidateIds: number[] = [];
  const candidateListIds = new Set<number>();
  for (const assignment of assignments) {
    const component = await loadRegistrationComponentInRound(tenantId, Number(round.id), assignment.examRegistrationComponentId, trx);
    assertRegistrationComponentAssignable(component);
    const schedule = await loadScheduleInRound(tenantId, Number(round.id), assignment.examScheduleId, trx);
    if (Number(extractRelationRef(component?.examRoundComponent) || component?.examRoundComponent?.id || 0) !== Number(extractRelationRef(schedule?.examRoundComponent) || schedule?.examRoundComponent?.id || 0)) {
      httpError(409, 'Schedule component does not match registration component.', 'EXAM_SCHEDULE_COMPONENT_MISMATCH');
    }
    const existingCandidateList = await findCandidateListBySchedule(tenantId, Number(schedule.id), trx);
    const activeCount = existingCandidateList?.id ? await countActiveCandidatesForList(tenantId, Number(existingCandidateList.id), trx) : 0;
    assertScheduleAvailableForAllocation(schedule, existingCandidateList, activeCount + (seenScheduleNewCounts.get(Number(schedule.id)) || 0));
    const learnerId = Number(extractRelationRef(component?.examRegistration?.learner) || component?.examRegistration?.learner?.id || 0);
    const conflict = await findLearnerScheduleConflict(tenantId, learnerId, normalizeStoredDateTime(schedule?.startAt) as string, normalizeStoredDateTime(schedule?.endAt) as string, { transacting: trx });
    assertNoLearnerScheduleConflict(conflict, learnerId);
    const candidateList = await createOrGetCandidateListForSchedule(tenantId, round, schedule, authUser, trx);
    if (normalizeText(candidateList?.lockStatus).toLowerCase() === 'locked') httpError(409, 'Candidate list is locked.', 'EXAM_CANDIDATE_LIST_LOCKED');
    const createdCandidate = await createCandidateForAssignment(tenantId, candidateList, component, authUser, trx);
    await updateRegistrationComponentSchedule(Number(component.id), Number(schedule.id), trx);
    createdCandidateIds.push(Number(createdCandidate.id));
    candidateListIds.add(Number(candidateList.id));
    seenScheduleNewCounts.set(Number(schedule.id), (seenScheduleNewCounts.get(Number(schedule.id)) || 0) + 1);
    logAllocationEvent('exam_candidate.assigned', { tenantId, examRoundId: Number(round.id), candidateListId: Number(candidateList.id), scheduleId: Number(schedule.id), candidateId: Number(createdCandidate.id), registrationComponentId: Number(component.id), learnerId, actorUserId: authUser.id, fromStatus: null, toStatus: 'scheduled', timestamp: new Date().toISOString() });
  }
  return { createdCandidateIds, candidateListIds: Array.from(candidateListIds) };
}

export async function assignRegistrationComponentsToSchedules(tenantId: number, roundRef: unknown, payload: Record<string, unknown>, authUser: AuthUser) {
  const round = await loadRoundInTenant(tenantId, roundRef);
  assertAllocationAllowed(round);
  const input = normalizeAssignmentInput(payload || {});
  return await strapi.db.connection.transaction(async (trx: any) => {
    const result = await executeAssignments(tenantId, round, input.assignments, authUser, trx);
    return { examRoundId: Number(round.id), summary: { assigned: result.createdCandidateIds.length, candidateListsTouched: result.candidateListIds.length }, candidateIds: result.createdCandidateIds };
  });
}

export async function autoAssignExamCandidates(tenantId: number, roundRef: unknown, payload: Record<string, unknown>, authUser: AuthUser) {
  const round = await loadRoundInTenant(tenantId, roundRef);
  assertAllocationAllowed(round);
  const input = normalizePreviewInput(payload || {});
  const preview = await getExamCandidateAllocationPreview(tenantId, roundRef, payload, authUser);
  if (input.dryRun) return { dryRun: true, ...preview };
  if ((preview.unassigned || []).length > 0) {
    httpError(409, 'Insufficient schedule capacity for all requested assignments.', 'EXAM_SCHEDULE_CAPACITY_INSUFFICIENT', { unassigned: preview.unassigned });
  }
  return await strapi.db.connection.transaction(async (trx: any) => {
    const result = await executeAssignments(tenantId, round, preview.assignments, authUser, trx);
    logAllocationEvent('exam_candidate.auto_assigned', { tenantId, examRoundId: Number(round.id), actorUserId: authUser.id, assigned: result.createdCandidateIds.length, timestamp: new Date().toISOString() });
    return { dryRun: false, examRoundId: Number(round.id), summary: { assigned: result.createdCandidateIds.length, candidateListsTouched: result.candidateListIds.length }, assignments: preview.assignments };
  });
}

export async function reassignExamCandidate(tenantId: number, roundRef: unknown, payload: Record<string, unknown>, authUser: AuthUser) {
  const round = await loadRoundInTenant(tenantId, roundRef);
  assertAllocationAllowed(round);
  const input = normalizeReassignInput(payload || {});
  return await strapi.db.connection.transaction(async (trx: any) => {
    const candidate = await loadCandidateInRound(tenantId, Number(round.id), input.examCandidateId, trx);
    const targetSchedule = await loadScheduleInRound(tenantId, Number(round.id), input.targetExamScheduleId, trx);
    await acquireScheduleLocks(trx, tenantId, [Number(extractRelationRef(candidate?.examCandidateList?.examSchedule) || candidate?.examCandidateList?.examSchedule?.id || 0), Number(targetSchedule.id)]);
    await acquireRegistrationComponentLocks(trx, tenantId, [Number(extractRelationRef(candidate?.examRegistrationComponent) || candidate?.examRegistrationComponent?.id || 0)]);
    const current = await loadCandidateInRound(tenantId, Number(round.id), input.examCandidateId, trx);
    if (normalizeText(current?.examCandidateList?.lockStatus).toLowerCase() === 'locked') httpError(409, 'Candidate list is locked.', 'EXAM_CANDIDATE_LIST_LOCKED');
    if (Number(extractRelationRef(current?.examRegistrationComponent?.examRoundComponent) || current?.examRegistrationComponent?.examRoundComponent?.id || 0) !== Number(extractRelationRef(targetSchedule?.examRoundComponent) || targetSchedule?.examRoundComponent?.id || 0)) {
      httpError(409, 'Target schedule component does not match candidate component.', 'EXAM_SCHEDULE_COMPONENT_MISMATCH');
    }
    const targetCandidateList = await createOrGetCandidateListForSchedule(tenantId, round, targetSchedule, authUser, trx);
    const targetActiveCount = await countActiveCandidatesForList(tenantId, Number(targetCandidateList.id), trx);
    assertScheduleAvailableForAllocation(targetSchedule, targetCandidateList, targetActiveCount);
    const learnerId = Number(extractRelationRef(current?.learner) || current?.learner?.id || 0);
    const conflict = await findLearnerScheduleConflict(tenantId, learnerId, normalizeStoredDateTime(targetSchedule?.startAt) as string, normalizeStoredDateTime(targetSchedule?.endAt) as string, { excludeCandidateId: Number(current.id), transacting: trx });
    assertNoLearnerScheduleConflict(conflict, learnerId);
    await strapi.db.query(EXAM_CANDIDATE_UID).update({ where: { id: Number(current.id) }, data: { examCandidateList: Number(targetCandidateList.id) }, transacting: trx } as any);
    await updateRegistrationComponentSchedule(Number(extractRelationRef(current?.examRegistrationComponent) || current?.examRegistrationComponent?.id || 0), Number(targetSchedule.id), trx);
    logAllocationEvent('exam_candidate.reassigned', { tenantId, examRoundId: Number(round.id), candidateListId: Number(targetCandidateList.id), scheduleId: Number(targetSchedule.id), candidateId: Number(current.id), registrationComponentId: Number(extractRelationRef(current?.examRegistrationComponent) || current?.examRegistrationComponent?.id || 0), learnerId, actorUserId: authUser.id, reason: input.reason, timestamp: new Date().toISOString() });
    return { candidateId: Number(current.id), targetScheduleId: Number(targetSchedule.id), targetCandidateListId: Number(targetCandidateList.id) };
  });
}

export async function unassignExamCandidates(tenantId: number, roundRef: unknown, payload: Record<string, unknown>, authUser: AuthUser) {
  const round = await loadRoundInTenant(tenantId, roundRef);
  assertAllocationAllowed(round);
  const input = normalizeUnassignInput(payload || {});
  return await strapi.db.connection.transaction(async (trx: any) => {
    const candidateIds = [...input.examCandidateIds];
    const affected: number[] = [];
    for (const candidateId of candidateIds) {
      const candidate = await loadCandidateInRound(tenantId, Number(round.id), candidateId, trx);
      await acquireCandidateListLock(trx, tenantId, Number(extractRelationRef(candidate?.examCandidateList) || candidate?.examCandidateList?.id || 0));
      await acquireRegistrationComponentLocks(trx, tenantId, [Number(extractRelationRef(candidate?.examRegistrationComponent) || candidate?.examRegistrationComponent?.id || 0)]);
      const current = await loadCandidateInRound(tenantId, Number(round.id), candidateId, trx);
      if (normalizeText(current?.examCandidateList?.lockStatus).toLowerCase() === 'locked') httpError(409, 'Candidate list is locked.', 'EXAM_CANDIDATE_LIST_LOCKED');
      if (normalizeText(current?.candidateStatus).toLowerCase() !== 'scheduled') httpError(409, 'Candidate cannot be unassigned.', 'EXAM_CANDIDATE_CANNOT_BE_UNASSIGNED');
      if (normalizeText(current?.attendanceStatus).toLowerCase() !== 'not_checked_in') httpError(409, 'Candidate cannot be unassigned.', 'EXAM_CANDIDATE_CANNOT_BE_UNASSIGNED');
      const scheduleStatus = normalizeText(current?.examCandidateList?.examSchedule?.status).toLowerCase();
      if (scheduleStatus === 'in_progress' || scheduleStatus === 'completed') httpError(409, 'Candidate cannot be unassigned.', 'EXAM_CANDIDATE_CANNOT_BE_UNASSIGNED');
      await strapi.db.query(EXAM_CANDIDATE_UID).update({ where: { id: Number(current.id) }, data: { candidateStatus: 'cancelled', note: input.reason }, transacting: trx } as any);
      await updateRegistrationComponentSchedule(Number(extractRelationRef(current?.examRegistrationComponent) || current?.examRegistrationComponent?.id || 0), null, trx);
      affected.push(Number(current.id));
      logAllocationEvent('exam_candidate.unassigned', { tenantId, examRoundId: Number(round.id), candidateListId: Number(extractRelationRef(current?.examCandidateList) || current?.examCandidateList?.id || 0), scheduleId: Number(extractRelationRef(current?.examCandidateList?.examSchedule) || current?.examCandidateList?.examSchedule?.id || 0), candidateId: Number(current.id), registrationComponentId: Number(extractRelationRef(current?.examRegistrationComponent) || current?.examRegistrationComponent?.id || 0), learnerId: Number(extractRelationRef(current?.learner) || current?.learner?.id || 0), actorUserId: authUser.id, reason: input.reason, timestamp: new Date().toISOString() });
    }
    return { unassignedCandidateIds: affected };
  });
}

export async function listCandidateLists(tenantId: number, roundRef: unknown, rawQuery: Record<string, unknown>, _authUser: AuthUser) {
  const round = await loadRoundInTenant(tenantId, roundRef);
  const page = toPositiveInt(rawQuery.page, 1);
  const pageSize = Math.min(MAX_PAGE_SIZE, toPositiveInt(rawQuery.pageSize, 20));
  const whereParts: Record<string, unknown>[] = [{ examRound: { id: { $eq: Number(round.id) } } }];
  const scheduleId = Number(rawQuery.scheduleId || 0); if (Number.isInteger(scheduleId) && scheduleId > 0) whereParts.push({ examSchedule: { id: { $eq: scheduleId } } });
  const approvalStatus = normalizeOptionalText(rawQuery.approvalStatus)?.toLowerCase(); if (approvalStatus) whereParts.push({ approvalStatus });
  const lockStatus = normalizeOptionalText(rawQuery.lockStatus)?.toLowerCase(); if (lockStatus) whereParts.push({ lockStatus });
  const search = normalizeOptionalText(rawQuery.search, 100); if (search) whereParts.push({ $or: [{ code: { $containsi: search } }, { name: { $containsi: search } }] });
  const where = mergeTenantWhere({ $and: whereParts }, tenantId);
  const orderBy = normalizeSortOrder(rawQuery.sort, ['id', 'approvedAt'], [{ id: 'asc' }]);
  const start = (page - 1) * pageSize;
  const [rows, total] = await Promise.all([
    strapi.db.query(EXAM_CANDIDATE_LIST_UID).findMany({ where, offset: start, limit: pageSize, orderBy, populate: { examSchedule: { select: ['id', 'documentId', 'startAt', 'endAt', 'capacity', 'status'], populate: { examRoundComponent: { select: ['id', 'nameSnapshot'] }, examRoundSubject: { select: ['id', 'nameSnapshot'] }, examRoom: { select: ['id', 'code', 'name', 'capacity', 'isActive'], populate: { examVenue: { select: ['id', 'code', 'name', 'isActive'] } } } } }, preparedBy: { select: ['id', 'username', 'fullName', 'email'] }, submittedBy: { select: ['id', 'username', 'fullName', 'email'] }, approvedBy: { select: ['id', 'username', 'fullName', 'email'] }, lockedBy: { select: ['id', 'username', 'fullName', 'email'] }, examCandidates: { select: ['id', 'candidateStatus', 'sequenceNumber'], populate: { examRegistration: { select: ['id', 'registrationStatus'] }, examRegistrationComponent: { select: ['id', 'registrationStatus'], populate: { examSchedule: { select: ['id'] } } } } } } } as any),
    strapi.db.query(EXAM_CANDIDATE_LIST_UID).count({ where } as any),
  ]);
  const data = [];
  let totalCandidates = 0; let totalCapacity = 0; let draft = 0; let pendingApproval = 0; let approved = 0; let locked = 0;
  for (const row of rows || []) {
    const activeCount = await countActiveCandidatesForList(tenantId, Number(row.id));
    const activeCandidates = Array.isArray(row?.examCandidates) ? row.examCandidates.filter(candidateIsActive) : [];
    const readiness = buildCandidateListReadiness(row, activeCandidates);
    totalCandidates += activeCount;
    totalCapacity += Number(row?.examSchedule?.capacity || 0) || 0;
    if (normalizeText(row?.approvalStatus).toLowerCase() === 'draft') draft += 1;
    if (normalizeText(row?.approvalStatus).toLowerCase() === 'pending_approval') pendingApproval += 1;
    if (normalizeText(row?.approvalStatus).toLowerCase() === 'approved') approved += 1;
    if (normalizeText(row?.lockStatus).toLowerCase() === 'locked') locked += 1;
    data.push({
      id: Number(row?.id || 0), documentId: row?.documentId || null, code: normalizeText(row?.code), name: normalizeText(row?.name), version: Number(row?.version || 1),
      approvalStatus: normalizeText(row?.approvalStatus) || null, lockStatus: normalizeText(row?.lockStatus) || null,
      status: readiness.status,
      schedule: row?.examSchedule ? { id: Number(extractRelationRef(row.examSchedule) || row.examSchedule.id || 0), startAt: normalizeStoredDateTime(row.examSchedule.startAt), endAt: normalizeStoredDateTime(row.examSchedule.endAt), status: normalizeText(row.examSchedule.status) || null } : null,
      room: row?.examSchedule?.examRoom ? { id: Number(extractRelationRef(row.examSchedule.examRoom) || row.examSchedule.examRoom.id || 0), code: normalizeText(row.examSchedule.examRoom.code), name: normalizeText(row.examSchedule.examRoom.name) } : null,
      venue: row?.examSchedule?.examRoom?.examVenue ? { id: Number(extractRelationRef(row.examSchedule.examRoom.examVenue) || row.examSchedule.examRoom.examVenue.id || 0), code: normalizeText(row.examSchedule.examRoom.examVenue.code), name: normalizeText(row.examSchedule.examRoom.examVenue.name) } : null,
      component: row?.examSchedule?.examRoundComponent ? { id: Number(extractRelationRef(row.examSchedule.examRoundComponent) || row.examSchedule.examRoundComponent.id || 0), nameSnapshot: normalizeText(row.examSchedule.examRoundComponent.nameSnapshot) } : null,
      capacity: Number(row?.examSchedule?.capacity || 0) || 0,
      activeCandidateCount: activeCount,
      availableCapacity: Math.max((Number(row?.examSchedule?.capacity || 0) || 0) - activeCount, 0),
      readyToFinalize: readiness.readyToFinalize,
      readyForAttendance: readiness.readyForAttendance,
      blockingReasons: readiness.blockingReasons,
      finalizedAt: normalizeStoredDateTime(row?.lockedAt) || normalizeStoredDateTime(row?.approvedAt),
      finalizedBy: summarizeActor(row?.lockedBy ? { id: row.lockedBy.id, username: row.lockedBy.username, fullName: row.lockedBy.fullName, email: row.lockedBy.email } : (row?.approvedBy ? { id: row.approvedBy.id, username: row.approvedBy.username, fullName: row.approvedBy.fullName, email: row.approvedBy.email } : null)),
      numbersGenerated: Array.isArray(row?.examCandidates) && row.examCandidates.length > 0 ? row.examCandidates.every((item: any) => normalizeText(item?.candidateNumber)) : false,
      preparedBy: summarizeActor(row?.preparedBy ? { id: row.preparedBy.id, username: row.preparedBy.username, fullName: row.preparedBy.fullName, email: row.preparedBy.email } : null),
      submittedBy: summarizeActor(row?.submittedBy ? { id: row.submittedBy.id, username: row.submittedBy.username, fullName: row.submittedBy.fullName, email: row.submittedBy.email } : null),
      approvedBy: summarizeActor(row?.approvedBy ? { id: row.approvedBy.id, username: row.approvedBy.username, fullName: row.approvedBy.fullName, email: row.approvedBy.email } : null),
      lockedBy: summarizeActor(row?.lockedBy ? { id: row.lockedBy.id, username: row.lockedBy.username, fullName: row.lockedBy.fullName, email: row.lockedBy.email } : null),
    });
  }
  return { data, meta: { pagination: { page, pageSize, pageCount: Math.max(1, Math.ceil(total / pageSize)), total }, summary: { totalLists: total, draft, pendingApproval, approved, locked, totalCandidates, totalCapacity } } };
}

export async function getCandidateListDetail(tenantId: number, roundRef: unknown, candidateListRef: unknown, rawQuery: Record<string, unknown>, _authUser: AuthUser) {
  const round = await loadRoundInTenant(tenantId, roundRef);
  const list = await loadCandidateListInRound(tenantId, Number(round.id), candidateListRef);
  const page = toPositiveInt(rawQuery.page, 1);
  const pageSize = Math.min(MAX_PAGE_SIZE, toPositiveInt(rawQuery.pageSize, 1000));
  const candidates = (list?.examCandidates || []).slice((page - 1) * pageSize, (page - 1) * pageSize + pageSize);
  await validateCandidateChain(tenantId, Number(round.id), list, list?.examCandidates || []);
  const activeCount = await countActiveCandidatesForList(tenantId, Number(list.id));
  const activeCandidates = Array.isArray(list?.examCandidates) ? list.examCandidates.filter(candidateIsActive) : [];
  const readiness = buildCandidateListReadiness(list, activeCandidates);
  return {
    id: Number(list?.id || 0), documentId: list?.documentId || null, code: normalizeText(list?.code), name: normalizeText(list?.name), version: Number(list?.version || 1), approvalStatus: normalizeText(list?.approvalStatus) || null, lockStatus: normalizeText(list?.lockStatus) || null, status: readiness.status,
    schedule: list?.examSchedule ? { id: Number(extractRelationRef(list.examSchedule) || list.examSchedule.id || 0), startAt: normalizeStoredDateTime(list.examSchedule.startAt), endAt: normalizeStoredDateTime(list.examSchedule.endAt), capacity: Number(list.examSchedule.capacity || 0) || 0, status: normalizeText(list.examSchedule.status) || null } : null,
    component: list?.examSchedule?.examRoundComponent ? { id: Number(extractRelationRef(list.examSchedule.examRoundComponent) || list.examSchedule.examRoundComponent.id || 0), nameSnapshot: normalizeText(list.examSchedule.examRoundComponent.nameSnapshot) } : null,
    subject: list?.examSchedule?.examRoundSubject ? { id: Number(extractRelationRef(list.examSchedule.examRoundSubject) || list.examSchedule.examRoundSubject.id || 0), nameSnapshot: normalizeText(list.examSchedule.examRoundSubject.nameSnapshot) } : null,
    room: list?.examSchedule?.examRoom ? { id: Number(extractRelationRef(list.examSchedule.examRoom) || list.examSchedule.examRoom.id || 0), code: normalizeText(list.examSchedule.examRoom.code), name: normalizeText(list.examSchedule.examRoom.name) } : null,
    venue: list?.examSchedule?.examRoom?.examVenue ? { id: Number(extractRelationRef(list.examSchedule.examRoom.examVenue) || list.examSchedule.examRoom.examVenue.id || 0), code: normalizeText(list.examSchedule.examRoom.examVenue.code), name: normalizeText(list.examSchedule.examRoom.examVenue.name) } : null,
    capacity: Number(list?.examSchedule?.capacity || 0) || 0,
    activeCandidateCount: activeCount,
    availableCapacity: Math.max((Number(list?.examSchedule?.capacity || 0) || 0) - activeCount, 0),
    readiness,
    blockingReasons: readiness.blockingReasons,
    finalizedAt: normalizeStoredDateTime(list?.lockedAt) || normalizeStoredDateTime(list?.approvedAt),
    finalizedBy: summarizeActor(list?.lockedBy ? { id: list.lockedBy.id, username: list.lockedBy.username, fullName: list.lockedBy.fullName, email: list.lockedBy.email } : (list?.approvedBy ? { id: list.approvedBy.id, username: list.approvedBy.username, fullName: list.approvedBy.fullName, email: list.approvedBy.email } : null)),
    candidates: candidates.map((item: any) => ({ id: Number(item?.id || 0), candidateNumber: normalizeOptionalText(item?.candidateNumber, 100), sequenceNumber: Number(item?.sequenceNumber || 0) || null, seatNumber: normalizeOptionalText(item?.seatNumber, 100), candidateStatus: normalizeText(item?.candidateStatus) || null, attendanceStatus: normalizeText(item?.attendanceStatus) || null, synchronizationStatus: normalizeText(item?.synchronizationStatus) || null, learner: item?.learner ? { id: Number(extractRelationRef(item.learner) || item.learner.id || 0), code: normalizeText(item.learner.code), fullName: normalizeText(item.learner.fullName) } : null, registrationCode: normalizeText(item?.examRegistration?.registrationCode) || null })),
    meta: { pagination: { page, pageSize, total: (list?.examCandidates || []).length, pageCount: Math.max(1, Math.ceil((list?.examCandidates || []).length / pageSize)) } },
    audit: {
      preparedBy: summarizeActor(list?.preparedBy ? { id: list.preparedBy.id, username: list.preparedBy.username, fullName: list.preparedBy.fullName, email: list.preparedBy.email } : null),
      submittedBy: summarizeActor(list?.submittedBy ? { id: list.submittedBy.id, username: list.submittedBy.username, fullName: list.submittedBy.fullName, email: list.submittedBy.email } : null),
      submittedAt: normalizeStoredDateTime(list?.submittedAt),
      approvedBy: summarizeActor(list?.approvedBy ? { id: list.approvedBy.id, username: list.approvedBy.username, fullName: list.approvedBy.fullName, email: list.approvedBy.email } : null),
      approvedAt: normalizeStoredDateTime(list?.approvedAt),
      returnedBy: summarizeActor(list?.returnedBy ? { id: list.returnedBy.id, username: list.returnedBy.username, fullName: list.returnedBy.fullName, email: list.returnedBy.email } : null),
      returnedAt: normalizeStoredDateTime(list?.returnedAt),
      returnReason: normalizeOptionalText(list?.returnReason),
      lockedBy: summarizeActor(list?.lockedBy ? { id: list.lockedBy.id, username: list.lockedBy.username, fullName: list.lockedBy.fullName, email: list.lockedBy.email } : null),
      lockedAt: normalizeStoredDateTime(list?.lockedAt),
      unlockedBy: summarizeActor(list?.unlockedBy ? { id: list.unlockedBy.id, username: list.unlockedBy.username, fullName: list.unlockedBy.fullName, email: list.unlockedBy.email } : null),
      unlockedAt: normalizeStoredDateTime(list?.unlockedAt),
      unlockReason: normalizeOptionalText(list?.unlockReason),
    },
  };
}

export async function submitCandidateListForApproval(tenantId: number, roundRef: unknown, candidateListRef: unknown, payload: Record<string, unknown>, authUser: AuthUser) {
  const input = normalizeSimpleNoteInput(payload || {});
  const round = await loadRoundInTenant(tenantId, roundRef);
  return await strapi.db.connection.transaction(async (trx: any) => {
    const list = await loadCandidateListInRound(tenantId, Number(round.id), candidateListRef, trx);
    await acquireCandidateListLock(trx, tenantId, Number(list.id));
    const current = await loadCandidateListInRound(tenantId, Number(round.id), candidateListRef, trx);
    if (normalizeText(current?.approvalStatus).toLowerCase() !== 'draft' || normalizeText(current?.lockStatus).toLowerCase() !== 'unlocked') httpError(409, 'Candidate list cannot be submitted for approval.', 'EXAM_CANDIDATE_LIST_CANNOT_BE_SUBMITTED');
    const activeCount = await countActiveCandidatesForList(tenantId, Number(current.id), trx);
    if (activeCount <= 0) httpError(409, 'Candidate list is not ready.', 'EXAM_CANDIDATE_LIST_NOT_READY');
    if (activeCount > (Number(current?.examSchedule?.capacity || 0) || 0)) httpError(409, 'Candidate list exceeds schedule capacity.', 'EXAM_CANDIDATE_LIST_NOT_READY');
    await validateCandidateChain(tenantId, Number(round.id), current, current?.examCandidates || []);
    await strapi.db.query(EXAM_CANDIDATE_LIST_UID).update({ where: { id: Number(current.id) }, data: { approvalStatus: 'pending_approval', submittedBy: authUser.id, submittedAt: new Date(), note: input.note || current.note || null }, transacting: trx } as any);
    logAllocationEvent('exam_candidate_list.submitted', { tenantId, examRoundId: Number(round.id), candidateListId: Number(current.id), scheduleId: Number(extractRelationRef(current?.examSchedule) || current?.examSchedule?.id || 0), actorUserId: authUser.id, fromStatus: 'draft', toStatus: 'pending_approval', timestamp: new Date().toISOString() });
    return { candidateListId: Number(current.id), approvalStatus: 'pending_approval' };
  });
}

export async function approveCandidateList(tenantId: number, roundRef: unknown, candidateListRef: unknown, payload: Record<string, unknown>, authUser: AuthUser) {
  normalizeSimpleNoteInput(payload || {});
  const round = await loadRoundInTenant(tenantId, roundRef);
  return await strapi.db.connection.transaction(async (trx: any) => {
    const list = await loadCandidateListInRound(tenantId, Number(round.id), candidateListRef, trx);
    await acquireCandidateListLock(trx, tenantId, Number(list.id));
    const current = await loadCandidateListInRound(tenantId, Number(round.id), candidateListRef, trx);
    if (!APPROVABLE_CANDIDATE_LIST_STATUSES.has(normalizeText(current?.approvalStatus).toLowerCase() as CandidateListApprovalStatus)) httpError(409, 'Candidate list cannot be approved.', 'EXAM_CANDIDATE_LIST_CANNOT_BE_APPROVED');
    const submittedById = Number(extractRelationRef(current?.submittedBy) || current?.submittedBy?.id || 0);
    if (submittedById > 0 && submittedById === Number(authUser.id)) httpError(409, 'Submitter cannot approve the same candidate list.', 'EXAM_CANDIDATE_LIST_CANNOT_BE_APPROVED');
    await validateCandidateChain(tenantId, Number(round.id), current, current?.examCandidates || []);
    await strapi.db.query(EXAM_CANDIDATE_LIST_UID).update({ where: { id: Number(current.id) }, data: { approvalStatus: 'approved', approvedBy: authUser.id, approvedAt: new Date() }, transacting: trx } as any);
    logAllocationEvent('exam_candidate_list.approved', { tenantId, examRoundId: Number(round.id), candidateListId: Number(current.id), scheduleId: Number(extractRelationRef(current?.examSchedule) || current?.examSchedule?.id || 0), actorUserId: authUser.id, fromStatus: 'pending_approval', toStatus: 'approved', timestamp: new Date().toISOString() });
    return { candidateListId: Number(current.id), approvalStatus: 'approved' };
  });
}

export async function returnCandidateListToDraft(tenantId: number, roundRef: unknown, candidateListRef: unknown, payload: Record<string, unknown>, authUser: AuthUser) {
  const input = normalizeCandidateListReasonInput(payload || {}, 'RETURN_REASON_REQUIRED');
  const round = await loadRoundInTenant(tenantId, roundRef);
  return await strapi.db.connection.transaction(async (trx: any) => {
    const list = await loadCandidateListInRound(tenantId, Number(round.id), candidateListRef, trx);
    await acquireCandidateListLock(trx, tenantId, Number(list.id));
    const current = await loadCandidateListInRound(tenantId, Number(round.id), candidateListRef, trx);
    if (normalizeText(current?.approvalStatus).toLowerCase() !== 'pending_approval') httpError(409, 'Candidate list cannot be returned to draft.', 'EXAM_CANDIDATE_LIST_CANNOT_BE_RETURNED');
    await strapi.db.query(EXAM_CANDIDATE_LIST_UID).update({ where: { id: Number(current.id) }, data: { approvalStatus: 'draft', returnedBy: authUser.id, returnedAt: new Date(), returnReason: input.reason, note: input.note || current.note || null }, transacting: trx } as any);
    logAllocationEvent('exam_candidate_list.returned', { tenantId, examRoundId: Number(round.id), candidateListId: Number(current.id), scheduleId: Number(extractRelationRef(current?.examSchedule) || current?.examSchedule?.id || 0), actorUserId: authUser.id, fromStatus: 'pending_approval', toStatus: 'draft', reason: input.reason, timestamp: new Date().toISOString() });
    return { candidateListId: Number(current.id), approvalStatus: 'draft' };
  });
}

export async function lockCandidateList(tenantId: number, roundRef: unknown, candidateListRef: unknown, payload: Record<string, unknown>, authUser: AuthUser) {
  normalizeSimpleNoteInput(payload || {});
  const round = await loadRoundInTenant(tenantId, roundRef);
  return await strapi.db.connection.transaction(async (trx: any) => {
    const list = await loadCandidateListInRound(tenantId, Number(round.id), candidateListRef, trx);
    await acquireCandidateListLock(trx, tenantId, Number(list.id));
    const current = await loadCandidateListInRound(tenantId, Number(round.id), candidateListRef, trx);
    if (normalizeText(current?.approvalStatus).toLowerCase() !== 'approved' || normalizeText(current?.lockStatus).toLowerCase() !== 'unlocked') httpError(409, 'Candidate list cannot be locked.', 'EXAM_CANDIDATE_LIST_CANNOT_BE_LOCKED');
    await strapi.db.query(EXAM_CANDIDATE_LIST_UID).update({ where: { id: Number(current.id) }, data: { lockStatus: 'locked', lockedBy: authUser.id, lockedAt: new Date() }, transacting: trx } as any);
    logAllocationEvent('exam_candidate_list.locked', { tenantId, examRoundId: Number(round.id), candidateListId: Number(current.id), scheduleId: Number(extractRelationRef(current?.examSchedule) || current?.examSchedule?.id || 0), actorUserId: authUser.id, fromStatus: 'unlocked', toStatus: 'locked', timestamp: new Date().toISOString() });
    return { candidateListId: Number(current.id), lockStatus: 'locked' };
  });
}

export async function unlockCandidateList(tenantId: number, roundRef: unknown, candidateListRef: unknown, payload: Record<string, unknown>, authUser: AuthUser) {
  const input = normalizeCandidateListReasonInput(payload || {}, 'UNLOCK_REASON_REQUIRED');
  const round = await loadRoundInTenant(tenantId, roundRef);
  return await strapi.db.connection.transaction(async (trx: any) => {
    const list = await loadCandidateListInRound(tenantId, Number(round.id), candidateListRef, trx);
    await acquireCandidateListLock(trx, tenantId, Number(list.id));
    const current = await loadCandidateListInRound(tenantId, Number(round.id), candidateListRef, trx);
    if (normalizeText(current?.lockStatus).toLowerCase() !== 'locked') httpError(409, 'Candidate list cannot be unlocked.', 'EXAM_CANDIDATE_LIST_CANNOT_BE_UNLOCKED');
    await strapi.db.query(EXAM_CANDIDATE_LIST_UID).update({ where: { id: Number(current.id) }, data: { lockStatus: 'unlocked', approvalStatus: 'draft', unlockedBy: authUser.id, unlockedAt: new Date(), unlockReason: input.reason, note: input.note || current.note || null }, transacting: trx } as any);
    logAllocationEvent('exam_candidate_list.unlocked', { tenantId, examRoundId: Number(round.id), candidateListId: Number(current.id), scheduleId: Number(extractRelationRef(current?.examSchedule) || current?.examSchedule?.id || 0), actorUserId: authUser.id, fromStatus: 'locked', toStatus: 'unlocked', reason: input.reason, timestamp: new Date().toISOString() });
    return { candidateListId: Number(current.id), lockStatus: 'unlocked', approvalStatus: 'draft' };
  });
}

export async function generateCandidateNumbers(tenantId: number, roundRef: unknown, candidateListRef: unknown, payload: Record<string, unknown>, authUser: AuthUser) {
  const input = normalizeGenerateNumbersInput(payload || {});
  const round = await loadRoundInTenant(tenantId, roundRef);
  return await strapi.db.connection.transaction(async (trx: any) => {
    const list = await loadCandidateListInRound(tenantId, Number(round.id), candidateListRef, trx);
    await acquireCandidateListLock(trx, tenantId, Number(list.id));
    const current = await loadCandidateListInRound(tenantId, Number(round.id), candidateListRef, trx);
    if (normalizeText(current?.approvalStatus).toLowerCase() !== 'draft' || normalizeText(current?.lockStatus).toLowerCase() !== 'unlocked') httpError(409, 'Candidate numbers cannot be generated for this list.', 'EXAM_CANDIDATE_LIST_NOT_READY');
    const activeCandidates = (current?.examCandidates || []).filter(candidateIsActive);
    if (activeCandidates.length === 0) httpError(409, 'Candidate list is not ready.', 'EXAM_CANDIDATE_LIST_NOT_READY');
    if (activeCandidates.some((item: any) => normalizeText(item?.candidateNumber))) httpError(409, 'Candidate numbers have already been generated.', 'CANDIDATE_NUMBER_ALREADY_EXISTS');
    const sorted = [...activeCandidates].sort((left: any, right: any) => normalizeText(left?.learner?.code).localeCompare(normalizeText(right?.learner?.code)) || normalizeText(left?.learner?.fullName).localeCompare(normalizeText(right?.learner?.fullName)) || (Number(left?.id || 0) - Number(right?.id || 0)));
    for (let index = 0; index < sorted.length; index += 1) {
      const candidate = sorted[index];
      const candidateNumber = `${input.candidateNumberPrefix}${String(input.startNumber + index).padStart(input.padding, '0')}`;
      const duplicate = await strapi.db.query(EXAM_CANDIDATE_UID).findMany({ where: mergeTenantWhere({ examRegistration: { examRound: { id: { $eq: Number(round.id) } } }, candidateNumber }, tenantId), select: ['id'], limit: 1, transacting: trx } as any) as any[];
      if (duplicate.length > 0) httpError(409, 'Candidate number already exists in this exam round.', 'CANDIDATE_NUMBER_ALREADY_EXISTS');
      await strapi.db.query(EXAM_CANDIDATE_UID).update({ where: { id: Number(candidate.id) }, data: { candidateNumber, ...(input.generateSeatNumber ? { seatNumber: String(index + 1) } : {}) }, transacting: trx } as any);
    }
    logAllocationEvent('exam_candidate_numbers.generated', { tenantId, examRoundId: Number(round.id), candidateListId: Number(current.id), scheduleId: Number(extractRelationRef(current?.examSchedule) || current?.examSchedule?.id || 0), actorUserId: authUser.id, reason: input.candidateNumberPrefix, timestamp: new Date().toISOString() });
    return { candidateListId: Number(current.id), generated: sorted.length };
  });
}

export async function generateCandidateSequence(tenantId: number, roundRef: unknown, candidateListRef: unknown, payload: Record<string, unknown>, authUser: AuthUser) {
  const input = normalizeGenerateSequenceInput(payload || {});
  const round = await loadRoundInTenant(tenantId, roundRef);
  return await strapi.db.connection.transaction(async (trx: any) => {
    const list = await loadCandidateListInRound(tenantId, Number(round.id), candidateListRef, trx);
    await acquireCandidateListLock(trx, tenantId, Number(list.id));
    const current = await loadCandidateListInRound(tenantId, Number(round.id), candidateListRef, trx);
    if (deriveCandidateListStatus(current) === 'finalized') {
      httpError(409, 'Finalized candidate list cannot regenerate sequence.', 'CANDIDATE_LIST_FINALIZED');
    }
    const activeCandidates = (current?.examCandidates || []).filter(candidateIsActive);
    if (activeCandidates.length === 0) {
      httpError(409, 'Candidate list is empty.', 'EMPTY_CANDIDATE_LIST');
    }
    if (!input.overwriteExisting && activeCandidates.some((item: any) => Number(item?.sequenceNumber || 0) > 0)) {
      httpError(409, 'Sequence numbers already exist.', 'SEQUENCE_NUMBER_ALREADY_EXISTS');
    }
    const sorted = sortCandidatesForSequence(activeCandidates, input.sortBy);
    for (let index = 0; index < sorted.length; index += 1) {
      await strapi.db.query(EXAM_CANDIDATE_UID).update({
        where: { id: Number(sorted[index].id) },
        data: { sequenceNumber: index + 1 },
        transacting: trx,
      } as any);
    }
    logAllocationEvent('exam_candidate_list.sequence_generated', { tenantId, examRoundId: Number(round.id), candidateListId: Number(current.id), actorUserId: authUser.id, sortBy: input.sortBy, overwriteExisting: input.overwriteExisting, timestamp: new Date().toISOString() });
    return { candidateListId: Number(current.id), generated: sorted.length };
  });
}

export async function finalizeCandidateList(tenantId: number, roundRef: unknown, candidateListRef: unknown, payload: Record<string, unknown>, authUser: AuthUser) {
  const input = normalizeFinalizeInput(payload || {});
  const round = await loadRoundInTenant(tenantId, roundRef);
  return await strapi.db.connection.transaction(async (trx: any) => {
    const list = await loadCandidateListInRound(tenantId, Number(round.id), candidateListRef, trx);
    await acquireCandidateListLock(trx, tenantId, Number(list.id));
    const current = await loadCandidateListInRound(tenantId, Number(round.id), candidateListRef, trx);
    const activeCandidates = (current?.examCandidates || []).filter(candidateIsActive);
    await validateCandidateChain(tenantId, Number(round.id), current, current?.examCandidates || []);
    const readiness = buildCandidateListReadiness(current, activeCandidates);
    if (!readiness.readyToFinalize) {
      httpError(409, 'Candidate list is not ready to finalize.', 'CANDIDATE_LIST_NOT_READY', { blockingReasons: readiness.blockingReasons });
    }
    const now = new Date();
    await strapi.db.query(EXAM_CANDIDATE_LIST_UID).update({
      where: { id: Number(current.id) },
      data: {
        approvalStatus: 'approved',
        approvedBy: authUser.id,
        approvedAt: now,
        lockStatus: 'locked',
        lockedBy: authUser.id,
        lockedAt: now,
        ...(typeof input.note === 'string' ? { note: input.note } : {}),
      },
      transacting: trx,
    } as any);
    logAllocationEvent('exam_candidate_list.finalized', { tenantId, examRoundId: Number(round.id), candidateListId: Number(current.id), scheduleId: Number(extractRelationRef(current?.examSchedule) || current?.examSchedule?.id || 0), actorUserId: authUser.id, timestamp: now.toISOString() });
    return { candidateListId: Number(current.id), status: 'finalized', finalizedAt: now.toISOString(), finalizedBy: summarizeActor(authUser) };
  });
}

export async function reopenCandidateList(tenantId: number, roundRef: unknown, candidateListRef: unknown, payload: Record<string, unknown>, authUser: AuthUser) {
  const input = normalizeReopenInput(payload || {});
  const round = await loadRoundInTenant(tenantId, roundRef);
  return await strapi.db.connection.transaction(async (trx: any) => {
    const list = await loadCandidateListInRound(tenantId, Number(round.id), candidateListRef, trx);
    await acquireCandidateListLock(trx, tenantId, Number(list.id));
    const current = await loadCandidateListInRound(tenantId, Number(round.id), candidateListRef, trx);
    if (deriveCandidateListStatus(current) !== 'finalized') {
      httpError(409, 'Candidate list is not finalized.', 'CANDIDATE_LIST_NOT_FINALIZED');
    }
    const activeCandidates = (current?.examCandidates || []).filter(candidateIsActive);
    if (activeCandidates.some((item: any) => normalizeText(item?.attendanceStatus).toLowerCase() !== 'not_checked_in')) {
      httpError(409, 'Candidate list cannot be reopened after attendance has started.', 'CANDIDATE_LIST_HAS_ATTENDANCE');
    }
    if (activeCandidates.some((item: any) => Array.isArray(item?.componentResults) && item.componentResults.length > 0)) {
      httpError(409, 'Candidate list cannot be reopened after results exist.', 'CANDIDATE_LIST_HAS_RESULTS');
    }
    await strapi.db.query(EXAM_CANDIDATE_LIST_UID).update({
      where: { id: Number(current.id) },
      data: {
        approvalStatus: 'draft',
        lockStatus: 'unlocked',
        unlockedBy: authUser.id,
        unlockedAt: new Date(),
        unlockReason: input.reason,
        note: input.note || current.note || null,
      },
      transacting: trx,
    } as any);
    logAllocationEvent('exam_candidate_list.reopened', { tenantId, examRoundId: Number(round.id), candidateListId: Number(current.id), scheduleId: Number(extractRelationRef(current?.examSchedule) || current?.examSchedule?.id || 0), actorUserId: authUser.id, reason: input.reason, timestamp: new Date().toISOString() });
    return { candidateListId: Number(current.id), status: 'draft' };
  });
}

export function handleExamCandidateAllocationError(ctx: any, error: unknown) {
  if (error instanceof HttpError) {
    const body = { error: error.message, ...(error.code ? { code: error.code } : {}), status: error.status, ...(error.details ? { details: error.details } : {}) };
    if (error.status === 400) { ctx.status = 400; ctx.body = body; return; }
    if (error.status === 401) return ctx.unauthorized(error.message);
    if (error.status === 403) { ctx.status = 403; ctx.body = body; return; }
    if (error.status === 404) { ctx.status = 404; ctx.body = body; return; }
    if (error.status === 409) { ctx.status = 409; ctx.body = body; return; }
    ctx.status = error.status; ctx.body = body; return;
  }
  if (error instanceof errors.ApplicationError) return ctx.badRequest(error.message);
  strapi.log.error('[exam-candidate-allocation] unexpected error', error);
  return ctx.internalServerError('Failed to process exam candidate allocation request');
}