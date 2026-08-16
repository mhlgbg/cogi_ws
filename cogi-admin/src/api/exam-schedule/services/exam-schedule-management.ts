import { errors } from '@strapi/utils';

import { extractRelationRef, mergeTenantWhere, normalizeSortInput, toPositiveInt, toText, whereByParam } from '../../../utils/tenant-scope';

const EXAM_VENUE_UID = 'api::exam-venue.exam-venue';
const EXAM_ROOM_UID = 'api::exam-room.exam-room';
const EXAM_SCHEDULE_UID = 'api::exam-schedule.exam-schedule';
const EXAM_ROUND_UID = 'api::exam-round.exam-round';
const EXAM_ROUND_SUBJECT_UID = 'api::exam-round-subject.exam-round-subject';
const EXAM_ROUND_COMPONENT_UID = 'api::exam-round-component.exam-round-component';
const EXAM_REGISTRATION_COMPONENT_UID = 'api::exam-registration-component.exam-registration-component';
const EXAM_CANDIDATE_LIST_UID = 'api::exam-candidate-list.exam-candidate-list';
const EXAM_CANDIDATE_UID = 'api::exam-candidate.exam-candidate';

const MAX_PAGE_SIZE = 100;
const MAX_BULK_SCHEDULE_ITEMS = 200;
const MAX_DURATION_MINUTES = 1440;
const VENUE_ACTIVE_STATUSES = new Set(['draft', 'scheduled', 'published', 'in_progress']);
const ROUND_SCHEDULE_EDITABLE_STATUSES = new Set(['registration_open', 'registration_paused', 'registration_closed', 'preparing_exam']);
const SCHEDULE_ROOM_BLOCKING_STATUSES = new Set(['draft', 'scheduled', 'published', 'in_progress']);
const SCHEDULE_UPDATE_EDITABLE_STATUSES = new Set(['draft', 'scheduled']);
const SCHEDULE_PUBLISHABLE_STATUSES = new Set(['draft', 'scheduled']);
const SCHEDULE_CANCELLABLE_STATUSES = new Set(['draft', 'scheduled', 'published']);

type AuthUser = {
  id: number;
  username?: string | null;
  fullName?: string | null;
  email?: string | null;
};

type HttpErrorDetails = Record<string, unknown> | Array<Record<string, unknown>> | null;
type RoomType = 'computer' | 'standard' | 'oral' | 'practical' | 'other';
type ExamMethod = 'computer' | 'paper' | 'oral' | 'practical' | 'mixed' | 'other';

type VenueInput = {
  code: string;
  name: string;
  shortName: string | null;
  address: string | null;
  description: string | null;
  contactName: string | null;
  contactPhone: string | null;
  isActive: boolean;
  sortOrder: number;
};

type RoomInput = {
  code: string;
  name: string;
  examVenueId: number;
  floor: string | null;
  capacity: number;
  roomType: RoomType;
  isActive: boolean;
  description: string | null;
  sortOrder: number;
};

type ScheduleCreateInput = {
  examRoundComponentId: number;
  examRoomId: number;
  startAt: string;
  endAt?: string | null;
  durationMinutes: number | null;
  capacity: number | null;
  examMethod: ExamMethod | null;
  externalExamCode: string | null;
  note: string | null;
};

type ScheduleUpdateInput = {
  examRoundComponentId?: number;
  examRoomId?: number;
  startAt?: string;
  endAt?: string | null;
  durationMinutes?: number | null;
  capacity?: number | null;
  examMethod?: ExamMethod | null;
  externalExamCode?: string | null;
  note?: string | null;
};

type BulkCreateInput = { items: ScheduleCreateInput[] };
type PublishBulkInput = { scheduleIds: number[] };
type CancelInput = { reason: string };
type GenerateSchedulesInput = { date: string; startTime: string; roomId: number | null; componentIds: number[] | null };

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

function normalizeBoolean(value: unknown, fallback = false): boolean {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value !== 0;
  const text = normalizeText(value).toLowerCase();
  if (!text) return fallback;
  return ['1', 'true', 'yes', 'on'].includes(text);
}

function normalizeRequiredPositiveInteger(value: unknown, fieldName: string, code = 'INVALID_REQUEST_BODY'): number {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    httpError(400, `${fieldName} is invalid`, code);
  }
  return parsed;
}

function normalizeOptionalPositiveInteger(value: unknown, fieldName: string, code = 'INVALID_REQUEST_BODY'): number | null {
  if (value === null || value === undefined || value === '') return null;
  return normalizeRequiredPositiveInteger(value, fieldName, code);
}

function normalizeDateTime(value: unknown, fieldName: string, options: { required?: boolean } = {}): string | null {
  const text = normalizeText(value);
  if (!text) {
    if (options.required) httpError(400, `${fieldName} is required`, 'INVALID_EXAM_SCHEDULE_TIME');
    return null;
  }
  const timestamp = Date.parse(text);
  if (Number.isNaN(timestamp)) {
    httpError(400, `${fieldName} is invalid`, 'INVALID_EXAM_SCHEDULE_TIME');
  }
  return new Date(timestamp).toISOString();
}

function normalizeStoredDateTime(value: unknown): string | null {
  const text = normalizeText(value);
  if (!text) return null;
  const timestamp = Date.parse(text);
  if (Number.isNaN(timestamp)) return null;
  return new Date(timestamp).toISOString();
}

function normalizeDurationMinutes(value: unknown, fieldName = 'durationMinutes'): number | null {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0 || parsed > MAX_DURATION_MINUTES) {
    httpError(400, `${fieldName} is invalid`, 'INVALID_EXAM_SCHEDULE_DURATION');
  }
  return parsed;
}

function normalizeCapacity(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    httpError(400, 'capacity is invalid', 'INVALID_EXAM_SCHEDULE_CAPACITY');
  }
  return parsed;
}

function normalizeNonNegativeInteger(value: unknown, fieldName: string, fallback = 0): number {
  if (value === null || value === undefined || value === '') return fallback;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 0) {
    httpError(400, `${fieldName} is invalid`, 'INVALID_REQUEST_BODY');
  }
  return parsed;
}

function normalizeRoomType(value: unknown): RoomType {
  const text = normalizeText(value).toLowerCase();
  if (!['computer', 'standard', 'oral', 'practical', 'other'].includes(text)) {
    httpError(400, 'roomType is invalid', 'INVALID_REQUEST_BODY');
  }
  return text as RoomType;
}

function normalizeExamMethod(value: unknown, fallback: ExamMethod | null = null): ExamMethod | null {
  const text = normalizeText(value).toLowerCase();
  if (!text) return fallback;
  if (!['computer', 'paper', 'oral', 'practical', 'mixed', 'other'].includes(text)) {
    httpError(400, 'examMethod is invalid', 'INVALID_REQUEST_BODY');
  }
  return text as ExamMethod;
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

async function acquireRoomLocks(trx: any, tenantId: number, roomIds: number[]) {
  const uniqueRoomIds = Array.from(new Set(roomIds.filter((item) => Number.isInteger(item) && item > 0))).sort((a, b) => a - b);
  for (const roomId of uniqueRoomIds) {
    await acquireLock(trx, tenantId, `exam-schedule:room:${roomId}`);
  }
}

async function acquireScheduleLock(trx: any, tenantId: number, scheduleId: number) {
  await acquireLock(trx, tenantId, `exam-schedule:${scheduleId}`);
}

function toEndAt(startAt: string, durationMinutes: number): string {
  return new Date(Date.parse(startAt) + (durationMinutes * 60 * 1000)).toISOString();
}

function normalizeVenueInput(payload: Record<string, unknown>): VenueInput {
  ensureNoUnknownFields(payload, ['code', 'name', 'shortName', 'address', 'description', 'contactName', 'contactPhone', 'isActive', 'sortOrder'], 'payload');
  return {
    code: normalizeRequiredText(payload.code, 'code', 'INVALID_REQUEST_BODY', 100),
    name: normalizeRequiredText(payload.name, 'name', 'INVALID_REQUEST_BODY', 200),
    shortName: normalizeOptionalText(payload.shortName, 100),
    address: normalizeOptionalText(payload.address),
    description: normalizeOptionalText(payload.description),
    contactName: normalizeOptionalText(payload.contactName, 200),
    contactPhone: normalizeOptionalText(payload.contactPhone, 30),
    isActive: normalizeBoolean(payload.isActive, true),
    sortOrder: normalizeNonNegativeInteger(payload.sortOrder, 'sortOrder', 0),
  };
}

function normalizeRoomInput(payload: Record<string, unknown>): RoomInput {
  ensureNoUnknownFields(payload, ['code', 'name', 'examVenueId', 'floor', 'capacity', 'roomType', 'isActive', 'description', 'sortOrder'], 'payload');
  return {
    code: normalizeRequiredText(payload.code, 'code', 'INVALID_REQUEST_BODY', 100),
    name: normalizeRequiredText(payload.name, 'name', 'INVALID_REQUEST_BODY', 200),
    examVenueId: normalizeRequiredPositiveInteger(payload.examVenueId, 'examVenueId'),
    floor: normalizeOptionalText(payload.floor, 50),
    capacity: normalizeRequiredPositiveInteger(payload.capacity, 'capacity', 'INVALID_EXAM_SCHEDULE_CAPACITY'),
    roomType: normalizeRoomType(payload.roomType),
    isActive: normalizeBoolean(payload.isActive, true),
    description: normalizeOptionalText(payload.description),
    sortOrder: normalizeNonNegativeInteger(payload.sortOrder, 'sortOrder', 0),
  };
}

function normalizeScheduleCreateInput(payload: Record<string, unknown>): ScheduleCreateInput {
  ensureNoUnknownFields(payload, ['examRoundComponentId', 'examRoomId', 'startAt', 'endAt', 'durationMinutes', 'capacity', 'examMethod', 'externalExamCode', 'code', 'note'], 'payload');
  return {
    examRoundComponentId: normalizeRequiredPositiveInteger(payload.examRoundComponentId, 'examRoundComponentId'),
    examRoomId: normalizeRequiredPositiveInteger(payload.examRoomId, 'examRoomId'),
    startAt: normalizeDateTime(payload.startAt, 'startAt', { required: true }) as string,
    ...(typeof payload.endAt !== 'undefined' ? { endAt: normalizeDateTime(payload.endAt, 'endAt', { required: true }) } : {}),
    durationMinutes: normalizeDurationMinutes(payload.durationMinutes),
    capacity: normalizeCapacity(payload.capacity),
    examMethod: normalizeExamMethod(payload.examMethod),
    externalExamCode: normalizeOptionalText(payload.externalExamCode ?? payload.code, 100),
    note: normalizeOptionalText(payload.note, 2000),
  };
}

function normalizeScheduleUpdateInput(payload: Record<string, unknown>): ScheduleUpdateInput {
  ensureNoUnknownFields(payload, ['examRoundComponentId', 'examRoomId', 'startAt', 'endAt', 'durationMinutes', 'capacity', 'examMethod', 'externalExamCode', 'code', 'note'], 'payload');
  return {
    ...(typeof payload.examRoundComponentId !== 'undefined' ? { examRoundComponentId: normalizeRequiredPositiveInteger(payload.examRoundComponentId, 'examRoundComponentId') } : {}),
    ...(typeof payload.examRoomId !== 'undefined' ? { examRoomId: normalizeRequiredPositiveInteger(payload.examRoomId, 'examRoomId') } : {}),
    ...(typeof payload.startAt !== 'undefined' ? { startAt: normalizeDateTime(payload.startAt, 'startAt', { required: true }) as string } : {}),
    ...(typeof payload.endAt !== 'undefined' ? { endAt: normalizeDateTime(payload.endAt, 'endAt', { required: true }) } : {}),
    ...(typeof payload.durationMinutes !== 'undefined' ? { durationMinutes: normalizeDurationMinutes(payload.durationMinutes) } : {}),
    ...(typeof payload.capacity !== 'undefined' ? { capacity: normalizeCapacity(payload.capacity) } : {}),
    ...(typeof payload.examMethod !== 'undefined' ? { examMethod: normalizeExamMethod(payload.examMethod, 'other') } : {}),
    ...((typeof payload.externalExamCode !== 'undefined' || typeof payload.code !== 'undefined') ? { externalExamCode: normalizeOptionalText(payload.externalExamCode ?? payload.code, 100) } : {}),
    ...(typeof payload.note !== 'undefined' ? { note: normalizeOptionalText(payload.note, 2000) } : {}),
  };
}

function resolveDurationWindow(input: { startAt: string; endAt?: string | null; durationMinutes?: number | null }, fallbackDuration: number | null = null) {
  const startAt = input.startAt;
  const endAt = input.endAt ? normalizeDateTime(input.endAt, 'endAt', { required: true }) : null;
  if (endAt) {
    const startTimestamp = Date.parse(startAt);
    const endTimestamp = Date.parse(endAt);
    if (endTimestamp <= startTimestamp) {
      httpError(400, 'endAt must be later than startAt', 'EXAM_SCHEDULE_INVALID_TIME');
    }
    const durationMinutes = Math.round((endTimestamp - startTimestamp) / 60000);
    if (!Number.isInteger(durationMinutes) || durationMinutes <= 0 || durationMinutes > MAX_DURATION_MINUTES) {
      httpError(400, 'durationMinutes is invalid', 'INVALID_EXAM_SCHEDULE_DURATION');
    }
    return { startAt, endAt, durationMinutes };
  }

  const durationMinutes = normalizeDurationMinutes(input.durationMinutes) ?? fallbackDuration;
  if (!durationMinutes) httpError(400, 'durationMinutes is required', 'EXAM_SCHEDULE_DURATION_REQUIRED');
  return {
    startAt,
    endAt: toEndAt(startAt, durationMinutes),
    durationMinutes,
  };
}

function normalizeBulkCreateInput(payload: Record<string, unknown>): BulkCreateInput {
  ensureNoUnknownFields(payload, ['items'], 'payload');
  if (!Array.isArray(payload.items) || payload.items.length === 0) {
    httpError(400, 'items is required', 'BULK_ITEMS_REQUIRED');
  }
  if (payload.items.length > MAX_BULK_SCHEDULE_ITEMS) {
    httpError(400, `items exceeds limit ${MAX_BULK_SCHEDULE_ITEMS}`, 'BULK_LIMIT_EXCEEDED');
  }
  return {
    items: payload.items.map((item) => normalizeScheduleCreateInput((item || {}) as Record<string, unknown>)),
  };
}

function normalizePublishBulkInput(payload: Record<string, unknown>): PublishBulkInput {
  ensureNoUnknownFields(payload, ['scheduleIds'], 'payload');
  if (!Array.isArray(payload.scheduleIds) || payload.scheduleIds.length === 0) {
    httpError(400, 'scheduleIds is required', 'BULK_ITEMS_REQUIRED');
  }
  if (payload.scheduleIds.length > MAX_BULK_SCHEDULE_ITEMS) {
    httpError(400, `scheduleIds exceeds limit ${MAX_BULK_SCHEDULE_ITEMS}`, 'BULK_LIMIT_EXCEEDED');
  }
  const ids = payload.scheduleIds.map((item) => normalizeRequiredPositiveInteger(item, 'scheduleIds'));
  const unique = new Set<number>();
  for (const id of ids) {
    if (unique.has(id)) {
      httpError(400, 'Duplicate scheduleIds were found.', 'DUPLICATE_SCHEDULE_IN_PAYLOAD');
    }
    unique.add(id);
  }
  return { scheduleIds: ids };
}

function normalizeCancelInput(payload: Record<string, unknown>): CancelInput {
  ensureNoUnknownFields(payload, ['reason'], 'payload');
  return {
    reason: normalizeRequiredText(payload.reason, 'reason', 'SCHEDULE_CANCELLATION_REASON_REQUIRED', 2000),
  };
}

function normalizeDateOnly(value: unknown, fieldName: string): string {
  const text = normalizeText(value);
  if (!text) httpError(400, `${fieldName} is required`, 'INVALID_EXAM_SCHEDULE_TIME');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) httpError(400, `${fieldName} is invalid`, 'INVALID_EXAM_SCHEDULE_TIME');
  return text;
}

function normalizeTimeOnly(value: unknown, fieldName: string): string {
  const text = normalizeText(value);
  if (!text) httpError(400, `${fieldName} is required`, 'INVALID_EXAM_SCHEDULE_TIME');
  if (!/^\d{2}:\d{2}$/.test(text)) httpError(400, `${fieldName} is invalid`, 'INVALID_EXAM_SCHEDULE_TIME');
  return text;
}

function normalizeGenerateSchedulesInput(payload: Record<string, unknown>): GenerateSchedulesInput {
  ensureNoUnknownFields(payload, ['date', 'startTime', 'roomId', 'componentIds'], 'payload');
  const rawComponentIds = Array.isArray(payload.componentIds) ? payload.componentIds : null;
  const componentIds = rawComponentIds
    ? rawComponentIds.map((item) => normalizeRequiredPositiveInteger(item, 'componentIds'))
    : null;
  if (componentIds && new Set(componentIds).size !== componentIds.length) {
    httpError(400, 'Duplicate componentIds were found.', 'DUPLICATE_SCHEDULE_IN_PAYLOAD');
  }
  return {
    date: normalizeDateOnly(payload.date, 'date'),
    startTime: normalizeTimeOnly(payload.startTime, 'startTime'),
    roomId: payload.roomId === null || payload.roomId === undefined || payload.roomId === '' ? null : normalizeRequiredPositiveInteger(payload.roomId, 'roomId'),
    componentIds,
  };
}

function combineDateAndTime(dateText: string, timeText: string) {
  return normalizeDateTime(`${dateText}T${timeText}:00`, 'startAt', { required: true }) as string;
}

async function loadVenueInTenant(tenantId: number, venueRef: unknown, transacting?: any) {
  const where = whereByParam(venueRef);
  if (!where) {
    httpError(404, 'Không tìm thấy địa điểm thi trong tenant hiện tại.', 'EXAM_VENUE_NOT_FOUND');
  }
  const row = await strapi.db.query(EXAM_VENUE_UID).findOne({
    where: mergeTenantWhere(where, tenantId),
    select: ['id', 'documentId', 'code', 'name', 'shortName', 'address', 'description', 'contactName', 'contactPhone', 'isActive', 'sortOrder'],
    ...(transacting ? { transacting } : {}),
  } as any) as any;
  if (!row?.id) httpError(404, 'Không tìm thấy địa điểm thi trong tenant hiện tại.', 'EXAM_VENUE_NOT_FOUND');
  return row;
}

async function loadRoomInTenant(tenantId: number, roomRef: unknown, transacting?: any) {
  const where = whereByParam(roomRef);
  if (!where) httpError(404, 'Không tìm thấy phòng thi trong tenant hiện tại.', 'EXAM_ROOM_NOT_FOUND');
  const row = await strapi.db.query(EXAM_ROOM_UID).findOne({
    where: mergeTenantWhere(where, tenantId),
    select: ['id', 'documentId', 'code', 'name', 'floor', 'capacity', 'roomType', 'isActive', 'description', 'sortOrder'],
    populate: { examVenue: { select: ['id', 'documentId', 'code', 'name', 'isActive'] } },
    ...(transacting ? { transacting } : {}),
  } as any) as any;
  if (!row?.id) httpError(404, 'Không tìm thấy phòng thi trong tenant hiện tại.', 'EXAM_ROOM_NOT_FOUND');
  return row;
}

async function loadRoundInTenant(tenantId: number, roundRef: unknown, transacting?: any) {
  const where = whereByParam(roundRef);
  if (!where) httpError(404, 'Không tìm thấy đợt thi trong tenant hiện tại.', 'EXAM_ROUND_NOT_FOUND');
  const row = await strapi.db.query(EXAM_ROUND_UID).findOne({
    where: mergeTenantWhere(where, tenantId),
    select: ['id', 'documentId', 'code', 'name', 'status', 'examStartAt', 'examEndAt'],
    populate: {
      examRooms: { select: ['id'] },
      examVenues: { select: ['id', 'isActive'] },
      examRoundComponents: { select: ['id', 'status', 'nameSnapshot', 'examMethod'], populate: { examRoundSubject: { select: ['id', 'nameSnapshot', 'status'] } } },
    },
    ...(transacting ? { transacting } : {}),
  } as any) as any;
  if (!row?.id) httpError(404, 'Không tìm thấy đợt thi trong tenant hiện tại.', 'EXAM_ROUND_NOT_FOUND');
  return row;
}

async function loadRoundComponentInRound(tenantId: number, roundId: number, componentRef: unknown, transacting?: any) {
  const where = whereByParam(componentRef);
  if (!where) httpError(404, 'Không tìm thấy thành phần thi trong đợt hiện tại.', 'EXAM_ROUND_COMPONENT_INACTIVE');
  const row = await strapi.db.query(EXAM_ROUND_COMPONENT_UID).findOne({
    where: mergeTenantWhere({
      $and: [
        where,
        { examRound: { id: { $eq: roundId } } },
      ],
    }, tenantId),
    select: ['id', 'documentId', 'nameSnapshot', 'status', 'durationMinutes', 'fee', 'isRequired', 'allowSeparateRegistration', 'examMethod', 'externalExamCode'],
    populate: {
      examRound: { select: ['id', 'code', 'status'] },
      examRoundSubject: { select: ['id', 'nameSnapshot', 'status', 'isRequired', 'allowSeparateRegistration'] },
    },
    ...(transacting ? { transacting } : {}),
  } as any) as any;
  if (!row?.id) httpError(404, 'Không tìm thấy thành phần thi trong đợt hiện tại.', 'EXAM_ROUND_COMPONENT_INACTIVE');
  return row;
}

async function loadScheduleInRound(tenantId: number, roundId: number, scheduleRef: unknown, transacting?: any) {
  const where = whereByParam(scheduleRef);
  if (!where) httpError(404, 'Không tìm thấy lịch thi trong round hiện tại.', 'EXAM_SCHEDULE_NOT_FOUND');
  const row = await strapi.db.query(EXAM_SCHEDULE_UID).findOne({
    where: mergeTenantWhere({
      $and: [
        where,
        { examRound: { id: { $eq: roundId } } },
      ],
    }, tenantId),
    select: ['id', 'documentId', 'startAt', 'endAt', 'durationMinutes', 'capacity', 'examMethod', 'externalExamCode', 'status', 'note', 'schedulePublishedAt', 'cancelledAt', 'cancellationReason'],
    populate: {
      examRound: { select: ['id', 'documentId', 'code', 'name', 'status', 'examStartAt', 'examEndAt'] },
      examRoundSubject: { select: ['id', 'documentId', 'nameSnapshot', 'status'] },
      examRoundComponent: { select: ['id', 'documentId', 'nameSnapshot', 'status', 'durationMinutes', 'examMethod'], populate: { examRoundSubject: { select: ['id', 'status'] } } },
      examRoom: { select: ['id', 'documentId', 'code', 'name', 'capacity', 'roomType', 'isActive'], populate: { examVenue: { select: ['id', 'documentId', 'code', 'name', 'isActive'] } } },
      examVenue: { select: ['id', 'documentId', 'code', 'name', 'isActive'] },
      schedulePublishedBy: { select: ['id', 'username', 'fullName', 'email'] },
      cancelledBy: { select: ['id', 'username', 'fullName', 'email'] },
      registrationComponents: { select: ['id'] },
      examCandidateLists: { select: ['id'] },
    },
    ...(transacting ? { transacting } : {}),
  } as any) as any;
  if (!row?.id) httpError(404, 'Không tìm thấy lịch thi trong round hiện tại.', 'EXAM_SCHEDULE_NOT_FOUND');
  return row;
}

async function ensureVenueCodeAvailable(tenantId: number, code: string, excludeId?: number, transacting?: any) {
  const rows = await strapi.db.query(EXAM_VENUE_UID).findMany({
    where: mergeTenantWhere({ code, ...(excludeId ? { id: { $ne: excludeId } } : {}) }, tenantId),
    select: ['id'],
    limit: 1,
    ...(transacting ? { transacting } : {}),
  } as any) as any[];
  if (rows.length > 0) httpError(409, 'Mã địa điểm thi đã tồn tại trong tenant hiện tại.', 'EXAM_SCHEDULE_ALREADY_EXISTS');
}

async function ensureRoomCodeAvailable(tenantId: number, venueId: number, code: string, excludeId?: number, transacting?: any) {
  const rows = await strapi.db.query(EXAM_ROOM_UID).findMany({
    where: mergeTenantWhere({ examVenue: { id: { $eq: venueId } }, code, ...(excludeId ? { id: { $ne: excludeId } } : {}) }, tenantId),
    select: ['id'],
    limit: 1,
    ...(transacting ? { transacting } : {}),
  } as any) as any[];
  if (rows.length > 0) httpError(409, 'Mã phòng thi đã tồn tại trong địa điểm thi hiện tại.', 'EXAM_SCHEDULE_ALREADY_EXISTS');
}

function assertRoundScheduleEditable(round: any) {
  const status = normalizeText(round?.status).toLowerCase();
  if (!ROUND_SCHEDULE_EDITABLE_STATUSES.has(status)) {
    httpError(409, 'Đợt thi hiện không cho phép quản lý lịch thi.', 'EXAM_SCHEDULE_NOT_EDITABLE');
  }
}

function buildMethodMismatchWarning(roomType: RoomType, examMethod: ExamMethod | null) {
  if (!examMethod) return null;
  const mismatch = (
    (examMethod === 'computer' && roomType !== 'computer')
    || (examMethod === 'practical' && roomType !== 'practical' && roomType !== 'computer')
    || (examMethod === 'oral' && roomType !== 'oral' && roomType !== 'standard')
  );
  if (!mismatch) return null;
  return { code: 'EXAM_ROOM_METHOD_MISMATCH', message: 'Room type may not match the requested exam method.' };
}

function buildExamWindowWarning(round: any) {
  const examStartAt = normalizeStoredDateTime(round?.examStartAt);
  const examEndAt = normalizeStoredDateTime(round?.examEndAt);
  if (examStartAt && examEndAt) return null;
  return { code: 'EXAM_ROUND_EXAM_WINDOW_NOT_CONFIGURED', message: 'Exam round exam window is not fully configured.' };
}

function assertScheduleWithinExamWindow(round: any, startAt: string, endAt: string, options: { allowDraftWhenMissingWindow?: boolean } = {}) {
  const examStartAt = normalizeStoredDateTime(round?.examStartAt);
  const examEndAt = normalizeStoredDateTime(round?.examEndAt);
  if (!examStartAt || !examEndAt) {
    if (options.allowDraftWhenMissingWindow) return;
    httpError(409, 'Exam round exam window is not configured.', 'EXAM_ROUND_EXAM_WINDOW_NOT_CONFIGURED');
  }
  if (Date.parse(startAt) < Date.parse(examStartAt as string) || Date.parse(endAt) > Date.parse(examEndAt as string)) {
    httpError(409, 'Exam schedule is outside the configured exam window.', 'EXAM_SCHEDULE_OUTSIDE_EXAM_WINDOW');
  }
}

async function countAssignedRegistrationComponents(tenantId: number, scheduleId: number, transacting?: any) {
  return await strapi.db.query(EXAM_REGISTRATION_COMPONENT_UID).count({
    where: mergeTenantWhere({ examSchedule: { id: { $eq: scheduleId } } }, tenantId),
    ...(transacting ? { transacting } : {}),
  } as any);
}

async function countCandidateListsForSchedule(tenantId: number, scheduleId: number, transacting?: any) {
  return await strapi.db.query(EXAM_CANDIDATE_LIST_UID).count({
    where: mergeTenantWhere({ examSchedule: { id: { $eq: scheduleId } } }, tenantId),
    ...(transacting ? { transacting } : {}),
  } as any);
}

async function countCandidatesForSchedule(tenantId: number, scheduleId: number, transacting?: any) {
  return await strapi.db.query(EXAM_CANDIDATE_UID).count({
    where: mergeTenantWhere({ examCandidateList: { examSchedule: { id: { $eq: scheduleId } } } }, tenantId),
    ...(transacting ? { transacting } : {}),
  } as any);
}

async function findRoomScheduleConflict(tenantId: number, roomId: number, startAt: string, endAt: string, options: { excludeScheduleId?: number; transacting?: any } = {}) {
  const rows = await strapi.db.query(EXAM_SCHEDULE_UID).findMany({
    where: mergeTenantWhere({
      examRoom: { id: { $eq: roomId } },
      status: { $in: Array.from(SCHEDULE_ROOM_BLOCKING_STATUSES) },
      ...(options.excludeScheduleId ? { id: { $ne: options.excludeScheduleId } } : {}),
    }, tenantId),
    select: ['id', 'documentId', 'startAt', 'endAt', 'status', 'externalExamCode'],
    populate: {
      examRound: { select: ['id', 'code'] },
      examRoundComponent: { select: ['id', 'nameSnapshot'] },
    },
    ...(options.transacting ? { transacting: options.transacting } : {}),
  } as any) as any[];
  return (rows || []).find((row) => {
    const existingStart = normalizeStoredDateTime(row?.startAt);
    const existingEnd = normalizeStoredDateTime(row?.endAt);
    if (!existingStart || !existingEnd) return false;
    return Date.parse(startAt) < Date.parse(existingEnd) && Date.parse(endAt) > Date.parse(existingStart);
  }) || null;
}

function assertNoRoomConflict(conflict: any) {
  if (!conflict?.id) return;
  httpError(409, 'Exam room has a conflicting schedule in the requested time range.', 'EXAM_ROOM_SCHEDULE_CONFLICT', {
    conflictingScheduleId: Number(conflict.id),
    conflictingScheduleCode: normalizeOptionalText(conflict?.externalExamCode, 100),
    startAt: normalizeStoredDateTime(conflict.startAt),
    endAt: normalizeStoredDateTime(conflict.endAt),
    componentName: normalizeText(conflict?.examRoundComponent?.nameSnapshot),
    roundCode: normalizeText(conflict?.examRound?.code),
  });
}

function assertRoomAllowedForRound(round: any, room: any) {
  const allowedRoomIds = new Set<number>((round?.examRooms || []).map((item: any) => Number(extractRelationRef(item) || item?.id || 0)).filter((item: number) => item > 0));
  const roomId = Number(extractRelationRef(room) || room?.id || 0);
  if (!roomId || !allowedRoomIds.has(roomId)) {
    httpError(409, 'Exam room is not allowed for this exam round.', 'EXAM_ROOM_NOT_ALLOWED_FOR_ROUND', { roomId });
  }
}

async function ensureScheduleNotDuplicate(tenantId: number, roundId: number, componentId: number, roomId: number, startAt: string, endAt: string, options: { excludeScheduleId?: number; transacting?: any } = {}) {
  const rows = await strapi.db.query(EXAM_SCHEDULE_UID).findMany({
    where: mergeTenantWhere({
      examRound: { id: { $eq: roundId } },
      examRoundComponent: { id: { $eq: componentId } },
      examRoom: { id: { $eq: roomId } },
      startAt,
      endAt,
      ...(options.excludeScheduleId ? { id: { $ne: options.excludeScheduleId } } : {}),
    }, tenantId),
    select: ['id'],
    limit: 1,
    ...(options.transacting ? { transacting: options.transacting } : {}),
  } as any) as any[];
  if (rows.length > 0) {
    httpError(409, 'Exam schedule already exists for the same component, room, and time range.', 'EXAM_SCHEDULE_ALREADY_EXISTS');
  }
}

function mapVenue(row: any) {
  return {
    id: Number(row?.id || 0),
    documentId: row?.documentId || null,
    code: normalizeText(row?.code),
    name: normalizeText(row?.name),
    shortName: normalizeOptionalText(row?.shortName, 100),
    address: normalizeOptionalText(row?.address),
    description: normalizeOptionalText(row?.description),
    contactName: normalizeOptionalText(row?.contactName, 200),
    contactPhone: normalizeOptionalText(row?.contactPhone, 30),
    isActive: row?.isActive === true,
    sortOrder: Number(row?.sortOrder || 0) || 0,
  };
}

function mapRoom(row: any) {
  return {
    id: Number(row?.id || 0),
    documentId: row?.documentId || null,
    code: normalizeText(row?.code),
    name: normalizeText(row?.name),
    floor: normalizeOptionalText(row?.floor, 50),
    capacity: Number(row?.capacity || 0) || 0,
    roomType: normalizeText(row?.roomType) || null,
    isActive: row?.isActive === true,
    description: normalizeOptionalText(row?.description),
    sortOrder: Number(row?.sortOrder || 0) || 0,
    examVenue: row?.examVenue ? mapVenue(row.examVenue) : null,
  };
}

async function buildScheduleSummary(schedule: any, tenantId: number, transacting?: any) {
  const assignedCount = await countAssignedRegistrationComponents(tenantId, Number(schedule.id), transacting);
  const warnings = [] as Array<{ code: string; message: string }>;
  const mismatchWarning = buildMethodMismatchWarning((normalizeText(schedule?.examRoom?.roomType) || 'other') as RoomType, normalizeExamMethod(schedule?.examMethod, 'other'));
  if (mismatchWarning) warnings.push(mismatchWarning);
  const missingWindowWarning = buildExamWindowWarning(schedule?.examRound);
  if (missingWindowWarning) warnings.push(missingWindowWarning);
  return {
    id: Number(schedule?.id || 0),
    documentId: schedule?.documentId || null,
    status: normalizeText(schedule?.status) || null,
    startAt: normalizeStoredDateTime(schedule?.startAt),
    endAt: normalizeStoredDateTime(schedule?.endAt),
    durationMinutes: Number(schedule?.durationMinutes || 0) || 0,
    capacity: Number(schedule?.capacity || 0) || 0,
    examMethod: normalizeText(schedule?.examMethod) || null,
    externalExamCode: normalizeOptionalText(schedule?.externalExamCode, 100),
    note: normalizeOptionalText(schedule?.note),
    subject: schedule?.examRoundSubject ? { id: Number(extractRelationRef(schedule.examRoundSubject) || schedule.examRoundSubject.id || 0), nameSnapshot: normalizeText(schedule.examRoundSubject.nameSnapshot) } : null,
    component: schedule?.examRoundComponent ? { id: Number(extractRelationRef(schedule.examRoundComponent) || schedule.examRoundComponent.id || 0), nameSnapshot: normalizeText(schedule.examRoundComponent.nameSnapshot) } : null,
    examVenue: schedule?.examVenue ? mapVenue(schedule.examVenue) : null,
    examRoom: schedule?.examRoom ? mapRoom(schedule.examRoom) : null,
    assignedCount,
    availableCapacity: Math.max((Number(schedule?.capacity || 0) || 0) - assignedCount, 0),
    warnings,
    audit: {
      publishedBy: summarizeActor(schedule?.schedulePublishedBy ? { id: schedule.schedulePublishedBy.id, username: schedule.schedulePublishedBy.username, fullName: schedule.schedulePublishedBy.fullName, email: schedule.schedulePublishedBy.email } : null),
      publishedAt: normalizeStoredDateTime(schedule?.schedulePublishedAt),
      cancelledBy: summarizeActor(schedule?.cancelledBy ? { id: schedule.cancelledBy.id, username: schedule.cancelledBy.username, fullName: schedule.cancelledBy.fullName, email: schedule.cancelledBy.email } : null),
      cancelledAt: normalizeStoredDateTime(schedule?.cancelledAt),
      cancellationReason: normalizeOptionalText(schedule?.cancellationReason),
    },
  };
}

function assertRoomAndVenueActive(room: any) {
  if (room?.isActive !== true) httpError(409, 'Exam room is inactive.', 'EXAM_ROOM_INACTIVE');
  if (room?.examVenue?.isActive !== true) httpError(409, 'Exam venue is inactive.', 'EXAM_VENUE_INACTIVE');
}

function assertScheduleNotFinalized(schedule: any) {
  const candidateLists = Array.isArray(schedule?.examCandidateLists) ? schedule.examCandidateLists : [];
  const hasFinalizedList = candidateLists.some((item: any) => normalizeText(item?.approvalStatus).toLowerCase() === 'approved' && normalizeText(item?.lockStatus).toLowerCase() === 'locked');
  if (hasFinalizedList) {
    httpError(409, 'Exam schedule is finalized for attendance and cannot be changed.', 'CANDIDATE_LIST_FINALIZED');
  }
}

function assertComponentActive(component: any) {
  if (normalizeText(component?.status).toLowerCase() !== 'active') httpError(409, 'Exam round component is inactive.', 'EXAM_ROUND_COMPONENT_INACTIVE');
  if (normalizeText(component?.examRoundSubject?.status).toLowerCase() !== 'active') httpError(409, 'Exam round component is inactive because its subject is inactive.', 'EXAM_ROUND_COMPONENT_INACTIVE');
}

async function resolveScheduleDraft(tenantId: number, round: any, component: any, room: any, input: ScheduleCreateInput | ScheduleUpdateInput, options: { existingScheduleId?: number; transacting?: any } = {}) {
  const warnings: Array<{ code: string; message: string }> = [];
  assertRoundScheduleEditable(round);
  assertComponentActive(component);
  assertRoomAndVenueActive(room);
  assertRoomAllowedForRound(round, room);

  const startAt = 'startAt' in input && input.startAt ? input.startAt : null;
  if (!startAt) httpError(400, 'startAt is required', 'INVALID_EXAM_SCHEDULE_TIME');

  const resolvedWindow = resolveDurationWindow({
    startAt,
    endAt: (input as any).endAt,
    durationMinutes: (input as any).durationMinutes,
  }, Number(component?.durationMinutes || 0) || null);
  const durationMinutes = resolvedWindow.durationMinutes;
  const endAt = resolvedWindow.endAt;
  const capacity = normalizeCapacity((input as any).capacity) ?? (Number(room?.capacity || 0) || 0);
  if (!Number.isInteger(capacity) || capacity <= 0) httpError(400, 'capacity is invalid', 'INVALID_EXAM_SCHEDULE_CAPACITY');
  if (capacity > Number(room?.capacity || 0)) httpError(409, 'Schedule capacity exceeds room capacity.', 'EXAM_SCHEDULE_CAPACITY_EXCEEDS_ROOM');

  const examMethod = normalizeExamMethod((input as any).examMethod, normalizeExamMethod(component?.examMethod, 'other'));
  const mismatchWarning = buildMethodMismatchWarning((normalizeText(room?.roomType) || 'other') as RoomType, examMethod);
  if (mismatchWarning) warnings.push(mismatchWarning);
  const missingWindowWarning = buildExamWindowWarning(round);
  if (missingWindowWarning) warnings.push(missingWindowWarning);
  assertScheduleWithinExamWindow(round, startAt, endAt, { allowDraftWhenMissingWindow: true });

  await ensureScheduleNotDuplicate(tenantId, Number(extractRelationRef(round) || round?.id || 0), Number(extractRelationRef(component) || component?.id || 0), Number(extractRelationRef(room) || room?.id || 0), startAt, endAt, { excludeScheduleId: options.existingScheduleId, transacting: options.transacting });
  const conflict = await findRoomScheduleConflict(tenantId, Number(extractRelationRef(room) || room?.id || 0), startAt, endAt, { excludeScheduleId: options.existingScheduleId, transacting: options.transacting });
  assertNoRoomConflict(conflict);

  return {
    data: {
      examRound: Number(extractRelationRef(round) || round?.id || 0),
      examRoundSubject: Number(extractRelationRef(component?.examRoundSubject) || component?.examRoundSubject?.id || 0),
      examRoundComponent: Number(extractRelationRef(component) || component?.id || 0),
      examRoom: Number(extractRelationRef(room) || room?.id || 0),
      examVenue: Number(extractRelationRef(room?.examVenue) || room?.examVenue?.id || 0),
      startAt,
      durationMinutes,
      endAt,
      capacity,
      examMethod,
      externalExamCode: normalizeOptionalText((input as any).externalExamCode, 100),
      note: normalizeOptionalText((input as any).note, 2000),
    },
    warnings,
  };
}

async function logEvent(event: string, payload: Record<string, unknown>) {
  strapi.log.info(`[exam-schedule-management] ${event} ${JSON.stringify(payload)}`);
}

function buildScheduleBoardSummary(round: any, rows: any[]) {
  const activeRows = (rows || []).filter((item) => normalizeText(item?.status).toLowerCase() !== 'cancelled');
  const activeComponents = Array.isArray(round?.examRoundComponents)
    ? round.examRoundComponents.filter((item: any) => normalizeText(item?.status).toLowerCase() === 'active')
    : [];
  const scheduledComponentIds = new Set<number>();
  const scheduledSubjectIds = new Set<number>();
  const usedRoomIds = new Set<number>();
  const blockingReasons: string[] = [];

  for (const item of activeRows) {
    const componentId = Number(extractRelationRef(item?.examRoundComponent) || item?.examRoundComponent?.id || 0);
    const subjectId = Number(extractRelationRef(item?.examRoundSubject) || item?.examRoundSubject?.id || 0);
    const roomId = Number(extractRelationRef(item?.examRoom) || item?.examRoom?.id || 0);
    if (componentId > 0) scheduledComponentIds.add(componentId);
    if (subjectId > 0) scheduledSubjectIds.add(subjectId);
    if (roomId > 0) usedRoomIds.add(roomId);
  }

  const componentsWithoutSchedule = activeComponents.filter((item: any) => !scheduledComponentIds.has(Number(item?.id || 0)));
  if (activeRows.length === 0) blockingReasons.push('NO_SCHEDULES');
  if (componentsWithoutSchedule.length > 0) blockingReasons.push('COMPONENT_WITHOUT_SCHEDULE');
  if (activeRows.some((item) => item?.examRoom?.id && Number(item?.capacity || 0) <= 0)) blockingReasons.push('INVALID_CAPACITY');
  if (activeRows.some((item) => item?.examRoom?.isActive !== true || item?.examRoom?.examVenue?.isActive !== true)) blockingReasons.push('INVALID_ROOM');
  if (activeRows.some((item) => !item?.examRoom?.id)) blockingReasons.push('SCHEDULE_ROOM_REQUIRED');

  const byRoom = new Map<number, any[]>();
  for (const item of activeRows) {
    const roomId = Number(extractRelationRef(item?.examRoom) || item?.examRoom?.id || 0);
    if (!roomId) continue;
    if (!byRoom.has(roomId)) byRoom.set(roomId, []);
    byRoom.get(roomId)?.push(item);
  }

  for (const schedules of byRoom.values()) {
    const sorted = schedules.slice().sort((left, right) => Date.parse(normalizeStoredDateTime(left?.startAt) || '') - Date.parse(normalizeStoredDateTime(right?.startAt) || ''));
    for (let index = 1; index < sorted.length; index += 1) {
      const previous = sorted[index - 1];
      const current = sorted[index];
      const previousEnd = Date.parse(normalizeStoredDateTime(previous?.endAt) || '');
      const currentStart = Date.parse(normalizeStoredDateTime(current?.startAt) || '');
      if (Number.isFinite(previousEnd) && Number.isFinite(currentStart) && currentStart < previousEnd) {
        blockingReasons.push('ROOM_CONFLICT');
        index = sorted.length;
        break;
      }
    }
  }

  for (const item of activeRows) {
    const startAt = normalizeStoredDateTime(item?.startAt);
    const endAt = normalizeStoredDateTime(item?.endAt);
    const examStartAt = normalizeStoredDateTime(round?.examStartAt);
    const examEndAt = normalizeStoredDateTime(round?.examEndAt);
    if (startAt && endAt && examStartAt && examEndAt) {
      if (Date.parse(startAt) < Date.parse(examStartAt) || Date.parse(endAt) > Date.parse(examEndAt)) {
        blockingReasons.push('SCHEDULE_OUTSIDE_EXAM_WINDOW');
        break;
      }
    }
  }

  const totalCapacity = activeRows.reduce((total, item) => total + (Number(item?.capacity || 0) || 0), 0);
  const assignedCount = activeRows.reduce((total, item) => total + (Number(item?.assignedCount || 0) || 0), 0);

  return {
    total: rows.length,
    subjectsScheduled: scheduledSubjectIds.size,
    componentsScheduled: scheduledComponentIds.size,
    roomsInUse: usedRoomIds.size,
    totalCapacity,
    assignedCount,
    remainingCapacity: Math.max(totalCapacity - assignedCount, 0),
    unscheduledComponents: componentsWithoutSchedule.length,
    unscheduledComponentItems: componentsWithoutSchedule.map((item: any) => ({
      id: Number(item?.id || 0),
      nameSnapshot: normalizeText(item?.nameSnapshot),
      examMethod: normalizeText(item?.examMethod) || null,
      subject: item?.examRoundSubject ? { id: Number(extractRelationRef(item.examRoundSubject) || item.examRoundSubject.id || 0), nameSnapshot: normalizeText(item.examRoundSubject.nameSnapshot) } : null,
    })),
    readyForAllocation: blockingReasons.length === 0,
    blockingReasons: [...new Set(blockingReasons)],
  };
}

export async function listExamVenues(tenantId: number, rawQuery: Record<string, unknown>) {
  const page = toPositiveInt(rawQuery.page, 1);
  const pageSize = Math.min(MAX_PAGE_SIZE, toPositiveInt(rawQuery.pageSize, 20));
  const search = normalizeOptionalText(rawQuery.search, 200);
  const where = mergeTenantWhere(search ? { $or: [{ code: { $containsi: search } }, { name: { $containsi: search } }, { address: { $containsi: search } }] } : {}, tenantId);
  const start = (page - 1) * pageSize;
  const [rows, total] = await Promise.all([
    strapi.db.query(EXAM_VENUE_UID).findMany({ where, offset: start, limit: pageSize, orderBy: [{ isActive: 'desc' }, { sortOrder: 'asc' }, { name: 'asc' }, { id: 'asc' }] } as any),
    strapi.db.query(EXAM_VENUE_UID).count({ where } as any),
  ]);
  return { data: (rows || []).map(mapVenue), meta: { pagination: { page, pageSize, pageCount: Math.max(1, Math.ceil(total / pageSize)), total } } };
}

export async function getExamVenueDetail(tenantId: number, venueRef: unknown) {
  return mapVenue(await loadVenueInTenant(tenantId, venueRef));
}

export async function createExamVenue(tenantId: number, payload: Record<string, unknown>, authUser: AuthUser) {
  const input = normalizeVenueInput(payload || {});
  await ensureVenueCodeAvailable(tenantId, input.code);
  const created = await strapi.db.query(EXAM_VENUE_UID).create({ data: { ...input, tenant: tenantId } } as any) as any;
  if (!created?.id) httpError(409, 'Không thể tạo địa điểm thi.', 'EXAM_SCHEDULE_CREATE_FAILED');
  await logEvent('exam_venue.created', { tenantId, venueId: Number(created.id), actorUserId: authUser.id, timestamp: new Date().toISOString() });
  return mapVenue(await loadVenueInTenant(tenantId, created.id));
}

export async function updateExamVenue(tenantId: number, venueRef: unknown, payload: Record<string, unknown>, authUser: AuthUser) {
  const existing = await loadVenueInTenant(tenantId, venueRef);
  const input = normalizeVenueInput(payload || {});
  await ensureVenueCodeAvailable(tenantId, input.code, Number(existing.id));
  const updated = await strapi.db.query(EXAM_VENUE_UID).update({ where: { id: Number(existing.id) }, data: { ...input, tenant: tenantId } } as any) as any;
  if (!updated?.id) httpError(409, 'Không thể cập nhật địa điểm thi.', 'EXAM_SCHEDULE_UPDATE_FAILED');
  await logEvent('exam_venue.updated', { tenantId, venueId: Number(existing.id), actorUserId: authUser.id, timestamp: new Date().toISOString() });
  return mapVenue(await loadVenueInTenant(tenantId, existing.id));
}

export async function setExamVenueActive(tenantId: number, venueRef: unknown, payload: Record<string, unknown>, authUser: AuthUser) {
  ensureNoUnknownFields(payload || {}, ['isActive'], 'payload');
  const existing = await loadVenueInTenant(tenantId, venueRef);
  const isActive = normalizeBoolean((payload || {}).isActive, true);
  const updated = await strapi.db.query(EXAM_VENUE_UID).update({ where: { id: Number(existing.id) }, data: { isActive } } as any) as any;
  if (!updated?.id) httpError(409, 'Không thể cập nhật trạng thái địa điểm thi.', 'EXAM_SCHEDULE_UPDATE_FAILED');
  await logEvent('exam_venue.updated', { tenantId, venueId: Number(existing.id), actorUserId: authUser.id, timestamp: new Date().toISOString() });
  return mapVenue(await loadVenueInTenant(tenantId, existing.id));
}

export async function listExamRooms(tenantId: number, rawQuery: Record<string, unknown>) {
  const page = toPositiveInt(rawQuery.page, 1);
  const pageSize = Math.min(MAX_PAGE_SIZE, toPositiveInt(rawQuery.pageSize, 20));
  const search = normalizeOptionalText(rawQuery.search, 200);
  const where = mergeTenantWhere(search ? { $or: [{ code: { $containsi: search } }, { name: { $containsi: search } }] } : {}, tenantId);
  const start = (page - 1) * pageSize;
  const [rows, total] = await Promise.all([
    strapi.db.query(EXAM_ROOM_UID).findMany({ where, offset: start, limit: pageSize, orderBy: [{ isActive: 'desc' }, { sortOrder: 'asc' }, { name: 'asc' }, { id: 'asc' }], populate: { examVenue: { select: ['id', 'documentId', 'code', 'name', 'shortName', 'isActive', 'sortOrder'] } } } as any),
    strapi.db.query(EXAM_ROOM_UID).count({ where } as any),
  ]);
  return { data: (rows || []).map(mapRoom), meta: { pagination: { page, pageSize, pageCount: Math.max(1, Math.ceil(total / pageSize)), total } } };
}

export async function getExamRoomDetail(tenantId: number, roomRef: unknown) {
  return mapRoom(await loadRoomInTenant(tenantId, roomRef));
}

export async function createExamRoom(tenantId: number, payload: Record<string, unknown>, authUser: AuthUser) {
  const input = normalizeRoomInput(payload || {});
  const venue = await loadVenueInTenant(tenantId, input.examVenueId);
  if (input.isActive && venue?.isActive !== true) httpError(409, 'Exam venue is inactive.', 'EXAM_VENUE_INACTIVE');
  await ensureRoomCodeAvailable(tenantId, Number(venue.id), input.code);
  const created = await strapi.db.query(EXAM_ROOM_UID).create({ data: { code: input.code, name: input.name, examVenue: Number(venue.id), floor: input.floor, capacity: input.capacity, roomType: input.roomType, isActive: input.isActive, description: input.description, sortOrder: input.sortOrder, tenant: tenantId } } as any) as any;
  if (!created?.id) httpError(409, 'Không thể tạo phòng thi.', 'EXAM_SCHEDULE_CREATE_FAILED');
  await logEvent('exam_room.created', { tenantId, roomId: Number(created.id), actorUserId: authUser.id, timestamp: new Date().toISOString() });
  return mapRoom(await loadRoomInTenant(tenantId, created.id));
}

export async function updateExamRoom(tenantId: number, roomRef: unknown, payload: Record<string, unknown>, authUser: AuthUser) {
  const existing = await loadRoomInTenant(tenantId, roomRef);
  const input = normalizeRoomInput(payload || {});
  const venue = await loadVenueInTenant(tenantId, input.examVenueId);
  if (input.isActive && venue?.isActive !== true) httpError(409, 'Exam venue is inactive.', 'EXAM_VENUE_INACTIVE');
  const venueChanged = Number(extractRelationRef(existing?.examVenue) || existing?.examVenue?.id || 0) !== Number(venue.id);
  if (venueChanged) {
    const scheduleCount = await strapi.db.query(EXAM_SCHEDULE_UID).count({ where: mergeTenantWhere({ examRoom: { id: { $eq: Number(existing.id) } }, status: { $in: ['draft', 'scheduled', 'published', 'in_progress'] } }, tenantId) } as any);
    if (scheduleCount > 0) httpError(409, 'Exam room cannot move to another venue while active schedules exist.', 'EXAM_ROOM_SCHEDULE_CONFLICT');
  }
  await ensureRoomCodeAvailable(tenantId, Number(venue.id), input.code, Number(existing.id));
  const updated = await strapi.db.query(EXAM_ROOM_UID).update({ where: { id: Number(existing.id) }, data: { code: input.code, name: input.name, examVenue: Number(venue.id), floor: input.floor, capacity: input.capacity, roomType: input.roomType, isActive: input.isActive, description: input.description, sortOrder: input.sortOrder, tenant: tenantId } } as any) as any;
  if (!updated?.id) httpError(409, 'Không thể cập nhật phòng thi.', 'EXAM_SCHEDULE_UPDATE_FAILED');
  await logEvent('exam_room.updated', { tenantId, roomId: Number(existing.id), actorUserId: authUser.id, timestamp: new Date().toISOString() });
  return mapRoom(await loadRoomInTenant(tenantId, existing.id));
}

export async function setExamRoomActive(tenantId: number, roomRef: unknown, payload: Record<string, unknown>, authUser: AuthUser) {
  ensureNoUnknownFields(payload || {}, ['isActive'], 'payload');
  const existing = await loadRoomInTenant(tenantId, roomRef);
  const isActive = normalizeBoolean((payload || {}).isActive, true);
  if (isActive && existing?.examVenue?.isActive !== true) httpError(409, 'Exam venue is inactive.', 'EXAM_VENUE_INACTIVE');
  const updated = await strapi.db.query(EXAM_ROOM_UID).update({ where: { id: Number(existing.id) }, data: { isActive } } as any) as any;
  if (!updated?.id) httpError(409, 'Không thể cập nhật trạng thái phòng thi.', 'EXAM_SCHEDULE_UPDATE_FAILED');
  await logEvent('exam_room.updated', { tenantId, roomId: Number(existing.id), actorUserId: authUser.id, timestamp: new Date().toISOString() });
  return mapRoom(await loadRoomInTenant(tenantId, existing.id));
}

export async function listExamRoundSchedules(tenantId: number, roundRef: unknown, rawQuery: Record<string, unknown>) {
  const round = await loadRoundInTenant(tenantId, roundRef);
  const page = toPositiveInt(rawQuery.page, 1);
  const pageSize = Math.min(MAX_PAGE_SIZE, toPositiveInt(rawQuery.pageSize, 20));
  const search = normalizeOptionalText(rawQuery.search, 200);
  const whereParts: Record<string, unknown>[] = [{ examRound: { id: { $eq: Number(round.id) } } }];
  const status = normalizeOptionalText(rawQuery.status)?.toLowerCase();
  const examRoundSubjectId = normalizeOptionalPositiveInteger(rawQuery.subjectId ?? rawQuery.examRoundSubjectId, 'examRoundSubjectId');
  const examRoundComponentId = normalizeOptionalPositiveInteger(rawQuery.componentId ?? rawQuery.examRoundComponentId, 'examRoundComponentId');
  const examVenueId = normalizeOptionalPositiveInteger(rawQuery.venueId ?? rawQuery.examVenueId, 'examVenueId');
  const examRoomId = normalizeOptionalPositiveInteger(rawQuery.roomId ?? rawQuery.examRoomId, 'examRoomId');
  const startFrom = normalizeDateTime(rawQuery.dateFrom ?? rawQuery.startFrom, 'startFrom');
  const startTo = normalizeDateTime(rawQuery.dateTo ?? rawQuery.startTo, 'startTo');
  if (status) whereParts.push({ status });
  if (examRoundSubjectId) whereParts.push({ examRoundSubject: { id: { $eq: examRoundSubjectId } } });
  if (examRoundComponentId) whereParts.push({ examRoundComponent: { id: { $eq: examRoundComponentId } } });
  if (examVenueId) whereParts.push({ examVenue: { id: { $eq: examVenueId } } });
  if (examRoomId) whereParts.push({ examRoom: { id: { $eq: examRoomId } } });
  if (search) whereParts.push({ $or: [{ externalExamCode: { $containsi: search } }, { note: { $containsi: search } }] });
  const startAt: Record<string, string> = {};
  if (startFrom) startAt.$gte = startFrom;
  if (startTo) startAt.$lte = startTo;
  if (Object.keys(startAt).length > 0) whereParts.push({ startAt });
  const where = mergeTenantWhere(whereParts.length > 0 ? { $and: whereParts } : {}, tenantId);
  const orderBy = normalizeSortInput(rawQuery.sort).length > 0 ? normalizeSortInput(rawQuery.sort) : [{ startAt: 'asc' }, { id: 'asc' }];
  const start = (page - 1) * pageSize;
  const [rows, total, allRows] = await Promise.all([
    strapi.db.query(EXAM_SCHEDULE_UID).findMany({ where, offset: start, limit: pageSize, orderBy, populate: { examRound: { select: ['id', 'documentId', 'code', 'name', 'status', 'examStartAt', 'examEndAt'] }, examRoundSubject: { select: ['id', 'documentId', 'nameSnapshot', 'status'] }, examRoundComponent: { select: ['id', 'documentId', 'nameSnapshot', 'status', 'durationMinutes', 'examMethod'] }, examVenue: { select: ['id', 'documentId', 'code', 'name', 'isActive'] }, examRoom: { select: ['id', 'documentId', 'code', 'name', 'capacity', 'roomType', 'isActive'], populate: { examVenue: { select: ['id', 'documentId', 'code', 'name', 'isActive'] } } }, publishedBy: { select: ['id', 'username', 'fullName', 'email'] }, cancelledBy: { select: ['id', 'username', 'fullName', 'email'] } } } as any),
    strapi.db.query(EXAM_SCHEDULE_UID).count({ where } as any),
    strapi.db.query(EXAM_SCHEDULE_UID).findMany({ where, select: ['id', 'status', 'capacity'], populate: { examRound: { select: ['id', 'status', 'examStartAt', 'examEndAt'] }, examRoom: { select: ['id', 'capacity', 'roomType', 'isActive'], populate: { examVenue: { select: ['id', 'isActive'] } } } } } as any),
  ]);
  const data = [];
  for (const row of rows || []) data.push(await buildScheduleSummary(row, tenantId));
  let draft = 0;
  let published = 0;
  let cancelled = 0;
  const fullRows = [] as any[];
  for (const row of allRows || []) {
    const statusValue = normalizeText(row?.status).toLowerCase();
    if (statusValue === 'draft') draft += 1;
    if (statusValue === 'published') published += 1;
    if (statusValue === 'cancelled') cancelled += 1;
    fullRows.push({
      ...row,
      assignedCount: await countAssignedRegistrationComponents(tenantId, Number(row.id)),
    });
  }
  const boardSummary = buildScheduleBoardSummary(round, fullRows);
  return { data, meta: { pagination: { page, pageSize, pageCount: Math.max(1, Math.ceil(total / pageSize)), total }, summary: { ...boardSummary, draft, published, cancelled } } };
}

export async function getExamRoundScheduleSummary(tenantId: number, roundRef: unknown) {
  const round = await loadRoundInTenant(tenantId, roundRef);
  const rows = await strapi.db.query(EXAM_SCHEDULE_UID).findMany({
    where: mergeTenantWhere({ examRound: { id: { $eq: Number(round.id) } } }, tenantId),
    populate: {
      examRoundSubject: { select: ['id', 'nameSnapshot'] },
      examRoundComponent: { select: ['id', 'nameSnapshot'] },
      examRoom: { select: ['id', 'capacity', 'isActive'], populate: { examVenue: { select: ['id', 'isActive'] } } },
    },
  } as any) as any[];
  const enriched = [] as any[];
  for (const row of rows || []) {
    enriched.push({ ...row, assignedCount: await countAssignedRegistrationComponents(tenantId, Number(row.id)) });
  }
  return buildScheduleBoardSummary(round, enriched);
}

async function findExistingScheduleCountsByComponent(tenantId: number, roundId: number, componentIds: number[], transacting?: any) {
  const effectiveIds = Array.from(new Set((componentIds || []).map((item) => Number(item || 0)).filter((item) => item > 0)));
  const counts = new Map<number, number>();
  if (!effectiveIds.length) return counts;

  const rows = await strapi.db.query(EXAM_SCHEDULE_UID).findMany({
    where: mergeTenantWhere({
      examRound: { id: { $eq: roundId } },
      examRoundComponent: { id: { $in: effectiveIds } },
      status: { $notIn: ['cancelled'] },
    }, tenantId),
    select: ['id'],
    populate: { examRoundComponent: { select: ['id'] } },
    ...(transacting ? { transacting } : {}),
  } as any) as any[];

  for (const row of rows || []) {
    const componentId = Number(extractRelationRef(row?.examRoundComponent) || row?.examRoundComponent?.id || 0);
    if (!componentId) continue;
    counts.set(componentId, (counts.get(componentId) || 0) + 1);
  }
  return counts;
}

async function buildGeneratedScheduleDraft(round: any, component: any, room: any | null, startAt: string) {
  assertRoundScheduleEditable(round);
  assertComponentActive(component);

  const snapshotDuration = Number(component?.durationMinutes || 0);
  const durationMinutes = Number.isInteger(snapshotDuration) && snapshotDuration > 0 ? snapshotDuration : 60;
  const endAt = toEndAt(startAt, durationMinutes);
  assertScheduleWithinExamWindow(round, startAt, endAt, { allowDraftWhenMissingWindow: true });

  if (room?.id) {
    assertRoomAndVenueActive(room);
    assertRoomAllowedForRound(round, room);
  }

  return {
    data: {
      examRound: Number(extractRelationRef(round) || round?.id || 0),
      examRoundSubject: Number(extractRelationRef(component?.examRoundSubject) || component?.examRoundSubject?.id || 0),
      examRoundComponent: Number(extractRelationRef(component) || component?.id || 0),
      examRoom: room?.id ? Number(extractRelationRef(room) || room?.id || 0) : null,
      examVenue: room?.examVenue?.id ? Number(extractRelationRef(room?.examVenue) || room?.examVenue?.id || 0) : null,
      startAt,
      durationMinutes,
      endAt,
      capacity: room?.id ? (Number(room?.capacity || 0) || null) : null,
      examMethod: normalizeExamMethod(component?.examMethod, 'other'),
      externalExamCode: null,
      note: null,
    },
    usedFallbackDuration: !(Number.isInteger(snapshotDuration) && snapshotDuration > 0),
  };
}

export async function generateExamRoundSchedules(tenantId: number, roundRef: unknown, payload: Record<string, unknown>, authUser: AuthUser) {
  const input = normalizeGenerateSchedulesInput(payload || {});

  return await strapi.db.connection.transaction(async (trx: any) => {
    const round = await loadRoundInTenant(tenantId, roundRef, trx);
    const activeComponents = Array.isArray(round?.examRoundComponents)
      ? round.examRoundComponents.filter((item: any) => normalizeText(item?.status).toLowerCase() === 'active')
      : [];

    const requestedIds = input.componentIds && input.componentIds.length > 0
      ? input.componentIds
      : activeComponents.map((item: any) => Number(item?.id || 0)).filter((item: number) => item > 0);

    const componentMap = new Map<number, any>(activeComponents.map((item: any) => [Number(item?.id || 0), item]));
    const selectedComponents = requestedIds.map((componentId) => {
      const component = componentMap.get(componentId);
      if (!component) {
        httpError(409, 'Exam round component is inactive or not in round.', 'EXAM_COMPONENT_NOT_IN_ROUND', { componentId });
      }
      return component;
    });

    const startAt = combineDateAndTime(input.date, input.startTime);
    const room = input.roomId ? await loadRoomInTenant(tenantId, input.roomId, trx) : null;
    if (room?.id) {
      await acquireRoomLocks(trx, tenantId, [Number(room.id)]);
      assertRoomAndVenueActive(room);
      assertRoomAllowedForRound(round, room);
    }

    const existingScheduleCounts = await findExistingScheduleCountsByComponent(tenantId, Number(round.id), requestedIds, trx);
    const skipped = [] as Array<{ componentId: number; subjectId: number | null; reason: string }>;
    const creatableComponents = [] as any[];

    for (const component of selectedComponents) {
      const componentId = Number(component?.id || 0);
      if ((existingScheduleCounts.get(componentId) || 0) > 0) {
        skipped.push({
          componentId,
          subjectId: Number(extractRelationRef(component?.examRoundSubject) || component?.examRoundSubject?.id || 0) || null,
          reason: 'ALREADY_HAS_SCHEDULE',
        });
        continue;
      }
      creatableComponents.push(component);
    }

    if (room?.id && creatableComponents.length > 1) {
      httpError(409, 'Không thể dùng cùng một phòng cho nhiều ca diễn ra đồng thời.', 'EXAM_ROOM_SCHEDULE_CONFLICT', { roomId: Number(room.id) });
    }

    const drafts = [] as Array<{ component: any; draft: any }>;
    for (const component of creatableComponents) {
      const draft = await buildGeneratedScheduleDraft(round, component, room, startAt);
      if (room?.id) {
        const conflict = await findRoomScheduleConflict(tenantId, Number(room.id), String(draft.data.startAt), String(draft.data.endAt), { transacting: trx });
        assertNoRoomConflict(conflict);
      }
      drafts.push({ component, draft });
    }

    const createdSchedules = [] as any[];
    for (const item of drafts) {
      const created = await strapi.db.query(EXAM_SCHEDULE_UID).create({
        data: {
          ...item.draft.data,
          status: 'draft',
          tenant: tenantId,
        },
        transacting: trx,
      } as any) as any;
      if (!created?.id) {
        httpError(409, 'Không thể sinh tự động ca thi.', 'EXAM_SCHEDULE_CREATE_FAILED');
      }
      createdSchedules.push(await buildScheduleSummary(await loadScheduleInRound(tenantId, Number(round.id), created.id, trx), tenantId, trx));
    }

    await logEvent('exam_schedule.generated', {
      tenantId,
      examRoundId: Number(round.id),
      actorUserId: authUser.id,
      startAt,
      roomId: room?.id ? Number(room.id) : null,
      createdCount: createdSchedules.length,
      skippedCount: skipped.length,
      timestamp: new Date().toISOString(),
    });

    return {
      createdCount: createdSchedules.length,
      skippedCount: skipped.length,
      created: createdSchedules,
      skipped,
    };
  });
}

export async function getExamRoundScheduleDetail(tenantId: number, roundRef: unknown, scheduleRef: unknown) {
  const round = await loadRoundInTenant(tenantId, roundRef);
  const schedule = await loadScheduleInRound(tenantId, Number(round.id), scheduleRef);
  return await buildScheduleSummary(schedule, tenantId);
}

export async function createExamRoundSchedule(tenantId: number, roundRef: unknown, payload: Record<string, unknown>, authUser: AuthUser) {
  const input = normalizeScheduleCreateInput(payload || {});
  return await strapi.db.connection.transaction(async (trx: any) => {
    const round = await loadRoundInTenant(tenantId, roundRef, trx);
    const component = await loadRoundComponentInRound(tenantId, Number(round.id), input.examRoundComponentId, trx);
    const room = await loadRoomInTenant(tenantId, input.examRoomId, trx);
    await acquireRoomLocks(trx, tenantId, [Number(room.id)]);
    const draft = await resolveScheduleDraft(tenantId, round, component, room, input, { transacting: trx });
    const created = await strapi.db.query(EXAM_SCHEDULE_UID).create({ data: { ...draft.data, status: 'draft', tenant: tenantId } } as any) as any;
    if (!created?.id) httpError(409, 'Không thể tạo lịch thi.', 'EXAM_SCHEDULE_CREATE_FAILED');
    await logEvent('exam_schedule.created', { tenantId, examRoundId: Number(round.id), scheduleId: Number(created.id), roomId: Number(room.id), componentId: Number(component.id), actorUserId: authUser.id, fromStatus: null, toStatus: 'draft', startAt: draft.data.startAt, endAt: draft.data.endAt, timestamp: new Date().toISOString() });
    const schedule = await loadScheduleInRound(tenantId, Number(round.id), created.id, trx);
    return { schedule: await buildScheduleSummary(schedule, tenantId, trx), warnings: draft.warnings };
  });
}

export async function bulkCreateExamRoundSchedules(tenantId: number, roundRef: unknown, payload: Record<string, unknown>, authUser: AuthUser) {
  const input = normalizeBulkCreateInput(payload || {});
  return await strapi.db.connection.transaction(async (trx: any) => {
    const round = await loadRoundInTenant(tenantId, roundRef, trx);
    const roomIds = input.items.map((item) => item.examRoomId);
    await acquireRoomLocks(trx, tenantId, roomIds);
    const seenKeys = new Set<string>();
    const drafts: Array<{ data: Record<string, unknown>; warnings: Array<{ code: string; message: string }> }> = [];
    for (const item of input.items) {
      const component = await loadRoundComponentInRound(tenantId, Number(round.id), item.examRoundComponentId, trx);
      const room = await loadRoomInTenant(tenantId, item.examRoomId, trx);
      const draft = await resolveScheduleDraft(tenantId, round, component, room, item, { transacting: trx });
      const duplicateKey = `${item.examRoundComponentId}:${item.examRoomId}:${draft.data.startAt}:${draft.data.endAt}`;
      if (seenKeys.has(duplicateKey)) {
        httpError(400, 'Duplicate schedule item exists in payload.', 'DUPLICATE_SCHEDULE_IN_PAYLOAD');
      }
      seenKeys.add(duplicateKey);
      for (const existing of drafts) {
        if (Number(existing.data.examRoom) !== Number(draft.data.examRoom)) continue;
        const leftStart = Date.parse(String(existing.data.startAt));
        const leftEnd = Date.parse(String(existing.data.endAt));
        const rightStart = Date.parse(String(draft.data.startAt));
        const rightEnd = Date.parse(String(draft.data.endAt));
        if (rightStart < leftEnd && rightEnd > leftStart) {
          httpError(409, 'Exam room has conflicting schedules inside the bulk payload.', 'EXAM_ROOM_SCHEDULE_CONFLICT');
        }
      }
      drafts.push(draft);
    }
    const createdIds: number[] = [];
    for (const draft of drafts) {
      const created = await strapi.db.query(EXAM_SCHEDULE_UID).create({ data: { ...draft.data, status: 'draft', tenant: tenantId } } as any) as any;
      if (!created?.id) httpError(409, 'Không thể tạo lịch thi hàng loạt.', 'EXAM_SCHEDULE_CREATE_FAILED');
      createdIds.push(Number(created.id));
    }
    await logEvent('exam_schedule.bulk_created', { tenantId, examRoundId: Number(round.id), actorUserId: authUser.id, created: createdIds.length, timestamp: new Date().toISOString() });
    const schedules = [];
    for (const id of createdIds) schedules.push(await buildScheduleSummary(await loadScheduleInRound(tenantId, Number(round.id), id, trx), tenantId, trx));
    return { examRoundId: Number(round.id), summary: { received: input.items.length, created: createdIds.length }, schedules };
  });
}

export async function updateExamRoundSchedule(tenantId: number, roundRef: unknown, scheduleRef: unknown, payload: Record<string, unknown>, authUser: AuthUser) {
  const input = normalizeScheduleUpdateInput(payload || {});
  return await strapi.db.connection.transaction(async (trx: any) => {
    const round = await loadRoundInTenant(tenantId, roundRef, trx);
    const existing = await loadScheduleInRound(tenantId, Number(round.id), scheduleRef, trx);
    await acquireScheduleLock(trx, tenantId, Number(existing.id));
    const current = await loadScheduleInRound(tenantId, Number(round.id), scheduleRef, trx);
    if (!SCHEDULE_UPDATE_EDITABLE_STATUSES.has(normalizeText(current?.status).toLowerCase())) {
      httpError(409, 'Exam schedule is not editable in its current status.', 'EXAM_SCHEDULE_NOT_EDITABLE');
    }
    assertScheduleNotFinalized(current);
    const room = typeof input.examRoomId !== 'undefined' ? await loadRoomInTenant(tenantId, input.examRoomId, trx) : current.examRoom;
    await acquireRoomLocks(trx, tenantId, [Number(extractRelationRef(room) || room?.id || 0)]);
    const component = typeof input.examRoundComponentId !== 'undefined'
      ? await loadRoundComponentInRound(tenantId, Number(round.id), input.examRoundComponentId, trx)
      : current.examRoundComponent;
    if (typeof input.examRoundComponentId !== 'undefined') {
      const candidateCount = await countCandidatesForSchedule(tenantId, Number(current.id), trx);
      const candidateListCount = await countCandidateListsForSchedule(tenantId, Number(current.id), trx);
      if (candidateCount > 0 || candidateListCount > 0) {
        httpError(409, 'Exam schedule is already in use by candidate allocation.', 'EXAM_SCHEDULE_IN_USE');
      }
    }
    const draft = await resolveScheduleDraft(tenantId, round, component, room, {
      examRoundComponentId: Number(extractRelationRef(component) || component?.id || 0),
      examRoomId: Number(extractRelationRef(room) || room?.id || 0),
      startAt: input.startAt || normalizeStoredDateTime(current.startAt) || '',
      endAt: typeof input.endAt !== 'undefined' ? input.endAt ?? null : normalizeStoredDateTime(current.endAt),
      durationMinutes: typeof input.durationMinutes !== 'undefined' ? input.durationMinutes ?? null : Number(current.durationMinutes || 0),
      capacity: typeof input.capacity !== 'undefined' ? input.capacity ?? null : Number(current.capacity || 0),
      examMethod: typeof input.examMethod !== 'undefined' ? input.examMethod ?? null : normalizeExamMethod(current.examMethod, 'other'),
      externalExamCode: typeof input.externalExamCode !== 'undefined' ? input.externalExamCode ?? null : normalizeOptionalText(current.externalExamCode, 100),
      note: typeof input.note !== 'undefined' ? input.note ?? null : normalizeOptionalText(current.note),
    }, { existingScheduleId: Number(current.id), transacting: trx });
    const updated = await strapi.db.query(EXAM_SCHEDULE_UID).update({ where: { id: Number(current.id) }, data: { ...draft.data, examVenue: Number(extractRelationRef(room?.examVenue) || room?.examVenue?.id || 0) }, transacting: trx } as any) as any;
    if (!updated?.id) httpError(409, 'Không thể cập nhật lịch thi.', 'EXAM_SCHEDULE_UPDATE_FAILED');
    await logEvent('exam_schedule.updated', { tenantId, examRoundId: Number(round.id), scheduleId: Number(current.id), roomId: Number(extractRelationRef(room) || room?.id || 0), componentId: Number(extractRelationRef(component) || component?.id || 0), actorUserId: authUser.id, fromStatus: normalizeText(current.status), toStatus: normalizeText(current.status), startAt: draft.data.startAt, endAt: draft.data.endAt, timestamp: new Date().toISOString() });
    return { schedule: await buildScheduleSummary(await loadScheduleInRound(tenantId, Number(round.id), current.id, trx), tenantId, trx), warnings: draft.warnings };
  });
}

export async function cloneExamRoundSchedule(tenantId: number, roundRef: unknown, scheduleRef: unknown, payload: Record<string, unknown>, authUser: AuthUser) {
  const input = normalizeScheduleUpdateInput(payload || {});
  return await strapi.db.connection.transaction(async (trx: any) => {
    const round = await loadRoundInTenant(tenantId, roundRef, trx);
    const current = await loadScheduleInRound(tenantId, Number(round.id), scheduleRef, trx);
    const component = typeof input.examRoundComponentId !== 'undefined'
      ? await loadRoundComponentInRound(tenantId, Number(round.id), input.examRoundComponentId, trx)
      : current.examRoundComponent;
    const room = typeof input.examRoomId !== 'undefined'
      ? await loadRoomInTenant(tenantId, input.examRoomId, trx)
      : current.examRoom;
    await acquireRoomLocks(trx, tenantId, [Number(extractRelationRef(room) || room?.id || 0)]);
    const draft = await resolveScheduleDraft(tenantId, round, component, room, {
      examRoundComponentId: Number(extractRelationRef(component) || component?.id || 0),
      examRoomId: Number(extractRelationRef(room) || room?.id || 0),
      startAt: input.startAt || normalizeStoredDateTime(current.startAt) || '',
      endAt: typeof input.endAt !== 'undefined' ? input.endAt ?? null : normalizeStoredDateTime(current.endAt),
      durationMinutes: typeof input.durationMinutes !== 'undefined' ? input.durationMinutes ?? null : Number(current.durationMinutes || 0),
      capacity: typeof input.capacity !== 'undefined' ? input.capacity ?? null : Number(current.capacity || 0),
      examMethod: typeof input.examMethod !== 'undefined' ? input.examMethod ?? null : normalizeExamMethod(current.examMethod, 'other'),
      externalExamCode: typeof input.externalExamCode !== 'undefined' ? input.externalExamCode ?? null : null,
      note: typeof input.note !== 'undefined' ? input.note ?? null : normalizeOptionalText(current.note, 2000),
    }, { transacting: trx });
    const created = await strapi.db.query(EXAM_SCHEDULE_UID).create({ data: { ...draft.data, status: 'draft', tenant: tenantId } } as any) as any;
    if (!created?.id) httpError(409, 'Không thể nhân bản lịch thi.', 'EXAM_SCHEDULE_CREATE_FAILED');
    await logEvent('exam_schedule.cloned', { tenantId, examRoundId: Number(round.id), sourceScheduleId: Number(current.id), scheduleId: Number(created.id), actorUserId: authUser.id, timestamp: new Date().toISOString() });
    return { schedule: await buildScheduleSummary(await loadScheduleInRound(tenantId, Number(round.id), created.id, trx), tenantId, trx), warnings: draft.warnings };
  });
}

async function publishOneSchedule(tenantId: number, roundId: number, scheduleId: number, authUser: AuthUser, trx: any) {
  const schedule = await loadScheduleInRound(tenantId, roundId, scheduleId, trx);
  await acquireScheduleLock(trx, tenantId, Number(schedule.id));
  const current = await loadScheduleInRound(tenantId, roundId, scheduleId, trx);
  if (!SCHEDULE_PUBLISHABLE_STATUSES.has(normalizeText(current?.status).toLowerCase())) {
    httpError(409, 'Exam schedule cannot be published from its current status.', 'EXAM_SCHEDULE_CANNOT_BE_PUBLISHED');
  }
  assertRoundScheduleEditable(current?.examRound);
  assertRoomAndVenueActive(current?.examRoom);
  assertComponentActive(current?.examRoundComponent);
  assertScheduleWithinExamWindow(current?.examRound, normalizeStoredDateTime(current.startAt) as string, normalizeStoredDateTime(current.endAt) as string);
  const conflict = await findRoomScheduleConflict(tenantId, Number(extractRelationRef(current?.examRoom) || current?.examRoom?.id || 0), normalizeStoredDateTime(current.startAt) as string, normalizeStoredDateTime(current.endAt) as string, { excludeScheduleId: Number(current.id), transacting: trx });
  assertNoRoomConflict(conflict);
  const updated = await strapi.db.query(EXAM_SCHEDULE_UID).update({ where: { id: Number(current.id) }, data: { status: 'published', schedulePublishedBy: authUser.id, schedulePublishedAt: new Date() }, transacting: trx } as any) as any;
  if (!updated?.id) httpError(409, 'Không thể publish lịch thi.', 'EXAM_SCHEDULE_PUBLISH_FAILED');
  await logEvent('exam_schedule.published', { tenantId, examRoundId: roundId, scheduleId: Number(current.id), roomId: Number(extractRelationRef(current?.examRoom) || current?.examRoom?.id || 0), componentId: Number(extractRelationRef(current?.examRoundComponent) || current?.examRoundComponent?.id || 0), actorUserId: authUser.id, fromStatus: normalizeText(current.status), toStatus: 'published', startAt: normalizeStoredDateTime(current.startAt), endAt: normalizeStoredDateTime(current.endAt), timestamp: new Date().toISOString() });
  return await loadScheduleInRound(tenantId, roundId, current.id, trx);
}

export async function publishExamRoundSchedule(tenantId: number, roundRef: unknown, scheduleRef: unknown, authUser: AuthUser) {
  return await strapi.db.connection.transaction(async (trx: any) => {
    const round = await loadRoundInTenant(tenantId, roundRef, trx);
    const schedule = await publishOneSchedule(tenantId, Number(round.id), normalizeRequiredPositiveInteger(scheduleRef, 'scheduleId'), authUser, trx);
    return { schedule: await buildScheduleSummary(schedule, tenantId, trx) };
  });
}

export async function publishExamRoundSchedulesBulk(tenantId: number, roundRef: unknown, payload: Record<string, unknown>, authUser: AuthUser) {
  const input = normalizePublishBulkInput(payload || {});
  return await strapi.db.connection.transaction(async (trx: any) => {
    const round = await loadRoundInTenant(tenantId, roundRef, trx);
    const schedules = [];
    for (const scheduleId of input.scheduleIds) {
      schedules.push(await publishOneSchedule(tenantId, Number(round.id), scheduleId, authUser, trx));
    }
    await logEvent('exam_schedule.bulk_published', { tenantId, examRoundId: Number(round.id), actorUserId: authUser.id, scheduleIds: input.scheduleIds, timestamp: new Date().toISOString() });
    const mapped = [];
    for (const schedule of schedules) mapped.push(await buildScheduleSummary(schedule, tenantId, trx));
    return { examRoundId: Number(round.id), summary: { published: mapped.length }, schedules: mapped };
  });
}

export async function cancelExamRoundSchedule(tenantId: number, roundRef: unknown, scheduleRef: unknown, payload: Record<string, unknown>, authUser: AuthUser) {
  const input = normalizeCancelInput(payload || {});
  return await strapi.db.connection.transaction(async (trx: any) => {
    const round = await loadRoundInTenant(tenantId, roundRef, trx);
    const schedule = await loadScheduleInRound(tenantId, Number(round.id), scheduleRef, trx);
    await acquireScheduleLock(trx, tenantId, Number(schedule.id));
    const current = await loadScheduleInRound(tenantId, Number(round.id), scheduleRef, trx);
    if (!SCHEDULE_CANCELLABLE_STATUSES.has(normalizeText(current?.status).toLowerCase())) {
      httpError(409, 'Exam schedule cannot be cancelled from its current status.', 'EXAM_SCHEDULE_CANNOT_BE_CANCELLED');
    }
    assertScheduleNotFinalized(current);
    const assignedCount = await countAssignedRegistrationComponents(tenantId, Number(current.id), trx);
    if (assignedCount > 0) httpError(409, 'Exam schedule is already assigned to registration components.', 'EXAM_SCHEDULE_ALREADY_ASSIGNED');
    const candidateCount = await countCandidatesForSchedule(tenantId, Number(current.id), trx);
    if (candidateCount > 0 || await countCandidateListsForSchedule(tenantId, Number(current.id), trx) > 0) {
      httpError(409, 'Exam schedule already has candidates.', 'EXAM_SCHEDULE_HAS_CANDIDATES');
    }
    const updated = await strapi.db.query(EXAM_SCHEDULE_UID).update({ where: { id: Number(current.id) }, data: { status: 'cancelled', cancelledBy: authUser.id, cancelledAt: new Date(), cancellationReason: input.reason }, transacting: trx } as any) as any;
    if (!updated?.id) httpError(409, 'Không thể hủy lịch thi.', 'EXAM_SCHEDULE_CANCEL_FAILED');
    await logEvent('exam_schedule.cancelled', { tenantId, examRoundId: Number(round.id), scheduleId: Number(current.id), roomId: Number(extractRelationRef(current?.examRoom) || current?.examRoom?.id || 0), componentId: Number(extractRelationRef(current?.examRoundComponent) || current?.examRoundComponent?.id || 0), actorUserId: authUser.id, fromStatus: normalizeText(current.status), toStatus: 'cancelled', startAt: normalizeStoredDateTime(current.startAt), endAt: normalizeStoredDateTime(current.endAt), timestamp: new Date().toISOString() });
    return { schedule: await buildScheduleSummary(await loadScheduleInRound(tenantId, Number(round.id), current.id, trx), tenantId, trx) };
  });
}

export function handleExamScheduleManagementError(ctx: any, error: unknown) {
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
  strapi.log.error('[exam-schedule-management] unexpected error', error);
  return ctx.internalServerError('Failed to process exam schedule management request');
}