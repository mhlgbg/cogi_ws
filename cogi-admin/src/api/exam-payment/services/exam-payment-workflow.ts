import { errors } from '@strapi/utils';

import { resolveCurrentLearner } from '../../exam-round/services/exam-round-management';
import { extractRelationRef, hasOwn, mergeTenantWhere, normalizeSortInput, toPositiveInt, toText, whereByParam } from '../../../utils/tenant-scope';

const EXAM_PAYMENT_UID = 'api::exam-payment.exam-payment';
const EXAM_REGISTRATION_UID = 'api::exam-registration.exam-registration';
const FILE_ASSET_UID = 'api::file-asset.file-asset';

const MAX_PAGE_SIZE = 100;
const MAX_EVIDENCE_FILES = 5;
const MAX_PAYMENT_AMOUNT = 1_000_000_000_000;
const FUTURE_PAYMENT_TOLERANCE_MS = 5 * 60 * 1000;
const LEARNER_PAYMENT_METHODS = new Set(['bank_transfer', 'online', 'other']);
const EVIDENCE_REQUIRED_METHODS = new Set(['bank_transfer', 'online']);
const ALLOWED_EVIDENCE_MIME_TYPES = new Set(['application/pdf']);
const TRANSACTION_CODE_ACTIVE_STATUSES = ['reported', 'under_review', 'confirmed'];
const REPORTABLE_REGISTRATION_STATUSES = new Set(['submitted', 'pending_review', 'accepted']);
const REPORT_BLOCKED_PAYMENT_STATUSES = new Set(['paid', 'exempted', 'refunded', 'refund_pending']);
const REVIEWABLE_PAYMENT_STATUSES = new Set(['reported', 'under_review']);

type AuthUser = {
  id: number;
  username?: string | null;
  fullName?: string | null;
  email?: string | null;
};

type HttpErrorDetails = Record<string, unknown> | Array<Record<string, unknown>> | null;

type PaymentMethod = 'bank_transfer' | 'cash' | 'online' | 'accounting_confirmation' | 'other';
type PaymentStatus = 'reported' | 'under_review' | 'confirmed' | 'rejected' | 'refund_pending' | 'refunded' | 'cancelled';
type RegistrationPaymentStatus = 'not_required' | 'unpaid' | 'payment_reported' | 'payment_under_review' | 'partially_paid' | 'paid' | 'payment_rejected' | 'exempted' | 'refund_pending' | 'refunded';

type ReportPaymentInput = {
  amount: string;
  paymentMethod: PaymentMethod;
  transactionCode: string | null;
  payerName: string | null;
  paidAt: string;
  evidenceFileIds: number[];
  note: string | null;
};

type StartReviewInput = {
  note: string | null;
};

type ConfirmPaymentInput = {
  confirmedAmount: string | null;
  note: string | null;
};

type RejectPaymentInput = {
  reason: string;
  note: string | null;
};

type PaymentSummary = {
  paymentStatus: RegistrationPaymentStatus;
  confirmedPaidAmount: number;
  remainingAmount: number;
  payableAmount: number;
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

function parseDateTime(value: unknown, fieldName: string, options: { required?: boolean } = {}): string | null {
  const text = normalizeText(value);
  if (!text) {
    if (options.required) {
      httpError(400, `${fieldName} is required`, 'INVALID_REQUEST_BODY');
    }
    return null;
  }

  const timestamp = Date.parse(text);
  if (Number.isNaN(timestamp)) {
    httpError(400, `${fieldName} is invalid`, 'INVALID_REQUEST_BODY');
  }
  return new Date(timestamp).toISOString();
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

function moneyToStorageString(value: number): string {
  return roundMoney(value).toFixed(2);
}

function toMoney(value: unknown, fallback = 0): number {
  const numeric = decimalToNumber(value);
  return roundMoney(numeric === null ? fallback : numeric);
}

function parsePositiveAmount(value: unknown, fieldName: string): string {
  const text = normalizeText(value);
  if (!text) {
    httpError(400, `${fieldName} is required`, 'INVALID_PAYMENT_AMOUNT');
  }

  const numeric = Number(text);
  if (!Number.isFinite(numeric) || numeric <= 0 || numeric > MAX_PAYMENT_AMOUNT) {
    httpError(400, `${fieldName} is invalid`, 'INVALID_PAYMENT_AMOUNT');
  }
  return moneyToStorageString(numeric);
}

function normalizePaymentMethod(value: unknown, fieldName: string): PaymentMethod {
  const text = normalizeText(value).toLowerCase();
  if (!['bank_transfer', 'cash', 'online', 'accounting_confirmation', 'other'].includes(text)) {
    httpError(400, `${fieldName} is invalid`, 'INVALID_PAYMENT_METHOD');
  }
  return text as PaymentMethod;
}

function normalizePaymentStatus(value: unknown, fieldName: string, fallback: PaymentStatus): PaymentStatus {
  const text = normalizeText(value).toLowerCase();
  if (!text) return fallback;
  if (!['reported', 'under_review', 'confirmed', 'rejected', 'refund_pending', 'refunded', 'cancelled'].includes(text)) {
    httpError(400, `${fieldName} is invalid`, 'INVALID_REQUEST_BODY');
  }
  return text as PaymentStatus;
}

function normalizeRegistrationPaymentStatus(value: unknown, fallback: RegistrationPaymentStatus): RegistrationPaymentStatus {
  const text = normalizeText(value).toLowerCase();
  if (!text) return fallback;
  if (!['not_required', 'unpaid', 'payment_reported', 'payment_under_review', 'partially_paid', 'paid', 'payment_rejected', 'exempted', 'refund_pending', 'refunded'].includes(text)) {
    return fallback;
  }
  return text as RegistrationPaymentStatus;
}

function normalizePositiveIdArray(value: unknown, fieldName: string): number[] {
  if (typeof value === 'undefined') return [];
  if (!Array.isArray(value)) {
    httpError(400, `${fieldName} must be an array`, 'PAYMENT_EVIDENCE_INVALID');
  }
  const parsed = value.map((entry) => {
    const id = Number(entry);
    if (!Number.isInteger(id) || id <= 0) {
      httpError(400, `${fieldName} contains invalid ids`, 'PAYMENT_EVIDENCE_INVALID');
    }
    return id;
  });
  const unique = new Set<number>();
  for (const item of parsed) {
    if (unique.has(item)) {
      httpError(400, `${fieldName} contains duplicate ids`, 'PAYMENT_EVIDENCE_INVALID');
    }
    unique.add(item);
  }
  return parsed;
}

function normalizeReportPaymentInput(payload: Record<string, unknown>): ReportPaymentInput {
  ensureNoUnknownFields(payload, ['amount', 'paymentMethod', 'transactionCode', 'payerName', 'paidAt', 'evidenceFileIds', 'note'], 'payload');
  const amount = parsePositiveAmount(payload.amount, 'amount');
  const paymentMethod = normalizePaymentMethod(payload.paymentMethod, 'paymentMethod');
  if (!LEARNER_PAYMENT_METHODS.has(paymentMethod)) {
    httpError(400, 'Learner payment method is invalid for self-service reporting.', 'INVALID_PAYMENT_METHOD_FOR_LEARNER');
  }
  const paidAt = parseDateTime(payload.paidAt, 'paidAt', { required: false }) || new Date().toISOString();
  if (Date.parse(paidAt) > Date.now() + FUTURE_PAYMENT_TOLERANCE_MS) {
    httpError(400, 'paidAt is invalid', 'INVALID_REQUEST_BODY');
  }

  const evidenceFileIds = normalizePositiveIdArray(payload.evidenceFileIds, 'evidenceFileIds');
  if (evidenceFileIds.length > MAX_EVIDENCE_FILES) {
    httpError(400, `evidenceFileIds exceeds limit ${MAX_EVIDENCE_FILES}`, 'PAYMENT_EVIDENCE_LIMIT_EXCEEDED');
  }
  if (EVIDENCE_REQUIRED_METHODS.has(paymentMethod) && evidenceFileIds.length === 0) {
    httpError(400, 'Payment evidence is required.', 'PAYMENT_EVIDENCE_REQUIRED');
  }

  return {
    amount,
    paymentMethod,
    transactionCode: normalizeOptionalText(payload.transactionCode, 100),
    payerName: normalizeOptionalText(payload.payerName, 200),
    paidAt,
    evidenceFileIds,
    note: normalizeOptionalText(payload.note, 2000),
  };
}

function normalizeStartReviewInput(payload: Record<string, unknown>): StartReviewInput {
  ensureNoUnknownFields(payload, ['note'], 'payload');
  return {
    note: normalizeOptionalText(payload.note, 2000),
  };
}

function normalizeConfirmPaymentInput(payload: Record<string, unknown>): ConfirmPaymentInput {
  ensureNoUnknownFields(payload, ['confirmedAmount', 'note'], 'payload');
  return {
    confirmedAmount: typeof payload.confirmedAmount === 'undefined' ? null : parsePositiveAmount(payload.confirmedAmount, 'confirmedAmount'),
    note: normalizeOptionalText(payload.note, 2000),
  };
}

function normalizeRejectPaymentInput(payload: Record<string, unknown>): RejectPaymentInput {
  ensureNoUnknownFields(payload, ['reason', 'note'], 'payload');
  return {
    reason: normalizeRequiredText(payload.reason, 'reason', 'PAYMENT_REJECTION_REASON_REQUIRED', 2000),
    note: normalizeOptionalText(payload.note, 2000),
  };
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

async function acquireRegistrationPaymentLock(trx: any, tenantId: number, registrationId: number) {
  if (!isPostgresClient()) return;
  await trx.raw('select pg_advisory_xact_lock(hashtext(?), hashtext(?))', [String(tenantId), `exam-payment:registration:${registrationId}`]);
}

async function acquirePaymentTransactionCodeLock(trx: any, tenantId: number, transactionCode: string) {
  if (!isPostgresClient()) return;
  await trx.raw('select pg_advisory_xact_lock(hashtext(?), hashtext(?))', [String(tenantId), `exam-payment:transaction:${transactionCode.toLowerCase()}`]);
}

function toRelationSet(value: number[]) {
  return {
    set: value,
  };
}

function buildRemainingAmount(payableAmount: number, confirmedPaidAmount: number) {
  return roundMoney(Math.max(payableAmount - confirmedPaidAmount, 0));
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
      'registrationStatus',
      'paymentStatus',
      'payableAmount',
      'confirmedPaidAmount',
      'studentCodeSnapshot',
      'fullNameSnapshot',
    ],
    populate: {
      learner: { select: ['id', 'code', 'fullName'] },
      examRound: {
        select: ['id', 'documentId', 'code', 'name', 'status', 'paymentEndAt'],
      },
      tenant: { select: ['id'] },
    },
    ...(transacting ? { transacting } : {}),
  } as any) as any;

  if (!row?.id) {
    httpError(404, 'Không tìm thấy exam registration trong tenant hiện tại.', 'EXAM_REGISTRATION_NOT_FOUND');
  }

  return row;
}

async function loadOwnedRegistrationForLearner(ctx: any, tenantId: number, registrationRef: unknown, transacting?: any) {
  const learner = await resolveCurrentLearner(ctx, tenantId, { transacting });
  const where = whereByParam(registrationRef);
  if (!where) {
    httpError(404, 'Không tìm thấy exam registration trong tenant hiện tại.', 'EXAM_REGISTRATION_NOT_FOUND');
  }

  const registration = await strapi.db.query(EXAM_REGISTRATION_UID).findOne({
    where: mergeTenantWhere({
      $and: [
        where,
        {
          learner: {
            id: { $eq: learner.id },
          },
        },
      ],
    }, tenantId),
    select: [
      'id',
      'documentId',
      'registrationCode',
      'registrationStatus',
      'paymentStatus',
      'payableAmount',
      'confirmedPaidAmount',
      'studentCodeSnapshot',
      'fullNameSnapshot',
    ],
    populate: {
      learner: { select: ['id', 'code', 'fullName'] },
      examRound: {
        select: ['id', 'documentId', 'code', 'name', 'status', 'paymentEndAt'],
      },
      tenant: { select: ['id'] },
    },
    ...(transacting ? { transacting } : {}),
  } as any) as any;

  if (!registration?.id) {
    httpError(404, 'Không tìm thấy exam registration trong tenant hiện tại.', 'EXAM_REGISTRATION_NOT_FOUND');
  }

  return { learner, registration };
}

async function findExamPaymentInTenant(tenantId: number, paymentRef: unknown, transacting?: any) {
  const where = whereByParam(paymentRef);
  if (!where) {
    httpError(404, 'Không tìm thấy exam payment trong tenant hiện tại.', 'EXAM_PAYMENT_NOT_FOUND');
  }

  const row = await strapi.db.query(EXAM_PAYMENT_UID).findOne({
    where: mergeTenantWhere(where, tenantId),
    select: [
      'id',
      'documentId',
      'transactionCode',
      'amount',
      'paymentMethod',
      'payerName',
      'paidAt',
      'reportedAt',
      'status',
      'verifiedAt',
      'rejectionReason',
      'refundAmount',
      'refundedAt',
      'note',
    ],
    populate: {
      examRegistration: {
        select: [
          'id',
          'documentId',
          'registrationCode',
          'registrationStatus',
          'paymentStatus',
          'payableAmount',
          'confirmedPaidAmount',
          'studentCodeSnapshot',
          'fullNameSnapshot',
        ],
        populate: {
          learner: { select: ['id', 'code', 'fullName'] },
          examRound: { select: ['id', 'documentId', 'code', 'name', 'status', 'paymentEndAt'] },
          tenant: { select: ['id'] },
        },
      },
      evidenceFiles: {
        select: ['id', 'originalName', 'fileName', 'url', 'mimeType', 'moduleKey', 'status', 'isDeleted'],
        populate: {
          tenant: { select: ['id'] },
          uploadedBy: { select: ['id', 'username', 'fullName', 'email'] },
        },
      },
      reportedBy: { select: ['id', 'username', 'fullName', 'email'] },
      verifiedBy: { select: ['id', 'username', 'fullName', 'email'] },
      tenant: { select: ['id'] },
    },
    ...(transacting ? { transacting } : {}),
  } as any) as any;

  if (!row?.id) {
    httpError(404, 'Không tìm thấy exam payment trong tenant hiện tại.', 'EXAM_PAYMENT_NOT_FOUND');
  }

  return row;
}

async function findOwnedExamPaymentForLearner(ctx: any, tenantId: number, registrationRef: unknown, paymentRef: unknown, transacting?: any) {
  const { learner, registration } = await loadOwnedRegistrationForLearner(ctx, tenantId, registrationRef, transacting);
  const where = whereByParam(paymentRef);
  if (!where) {
    httpError(404, 'Không tìm thấy exam payment trong tenant hiện tại.', 'EXAM_PAYMENT_NOT_FOUND');
  }

  const payment = await strapi.db.query(EXAM_PAYMENT_UID).findOne({
    where: mergeTenantWhere({
      $and: [
        where,
        {
          examRegistration: {
            id: { $eq: Number(registration.id) },
          },
        },
      ],
    }, tenantId),
    select: [
      'id',
      'documentId',
      'transactionCode',
      'amount',
      'paymentMethod',
      'payerName',
      'paidAt',
      'reportedAt',
      'status',
      'verifiedAt',
      'rejectionReason',
      'refundAmount',
      'refundedAt',
      'note',
    ],
    populate: {
      evidenceFiles: {
        select: ['id', 'originalName', 'fileName', 'url', 'mimeType', 'status', 'isDeleted'],
      },
      reportedBy: { select: ['id', 'username', 'fullName', 'email'] },
      verifiedBy: { select: ['id', 'username', 'fullName', 'email'] },
    },
    ...(transacting ? { transacting } : {}),
  } as any) as any;

  if (!payment?.id) {
    httpError(404, 'Không tìm thấy exam payment trong tenant hiện tại.', 'EXAM_PAYMENT_NOT_FOUND');
  }

  return { learner, registration, payment };
}

async function findPaymentsForRegistration(tenantId: number, registrationId: number, transacting?: any) {
  return await strapi.db.query(EXAM_PAYMENT_UID).findMany({
    where: mergeTenantWhere({
      examRegistration: {
        id: { $eq: registrationId },
      },
    }, tenantId),
    select: ['id', 'amount', 'status'],
    orderBy: [{ reportedAt: 'desc' }, { id: 'desc' }],
    ...(transacting ? { transacting } : {}),
  } as any) as any[];
}

async function assertPaymentTransactionCodeAvailable(tenantId: number, transactionCode: string, transacting?: any) {
  const rows = await strapi.db.query(EXAM_PAYMENT_UID).findMany({
    where: mergeTenantWhere({
      transactionCode: { $eqi: transactionCode },
      status: { $in: TRANSACTION_CODE_ACTIVE_STATUSES },
    }, tenantId),
    select: ['id', 'status', 'transactionCode'],
    limit: 1,
    ...(transacting ? { transacting } : {}),
  } as any) as any[];
  if (rows.length > 0) {
    httpError(409, 'Mã giao dịch đã tồn tại trong tenant hiện tại.', 'PAYMENT_TRANSACTION_CODE_EXISTS');
  }
}

async function validateEvidenceFilesForLearner(tenantId: number, learnerUserId: number, evidenceFileIds: number[], transacting?: any) {
  if (evidenceFileIds.length === 0) return [];

  const rows = await strapi.db.query(FILE_ASSET_UID).findMany({
    where: mergeTenantWhere({
      id: { $in: evidenceFileIds },
      uploadedBy: {
        id: { $eq: learnerUserId },
      },
      status: 'ACTIVE',
      isDeleted: false,
    }, tenantId),
    select: ['id', 'originalName', 'fileName', 'url', 'mimeType', 'status', 'isDeleted'],
    populate: {
      tenant: { select: ['id'] },
      uploadedBy: { select: ['id', 'username', 'fullName', 'email'] },
    },
    ...(transacting ? { transacting } : {}),
  } as any) as any[];

  if (rows.length !== evidenceFileIds.length) {
    httpError(409, 'Minh chứng thanh toán không hợp lệ.', 'PAYMENT_EVIDENCE_INVALID');
  }

  for (const row of rows) {
    const mimeType = normalizeText(row?.mimeType).toLowerCase();
    if (!(mimeType.startsWith('image/') || ALLOWED_EVIDENCE_MIME_TYPES.has(mimeType))) {
      httpError(409, 'Minh chứng thanh toán không hợp lệ.', 'PAYMENT_EVIDENCE_INVALID', { fileId: Number(row.id), mimeType });
    }
  }

  return rows;
}

function assertLearnerPaymentReportAllowed(registration: any, now = new Date()) {
  const registrationStatus = normalizeText(registration?.registrationStatus).toLowerCase();
  if (!REPORTABLE_REGISTRATION_STATUSES.has(registrationStatus)) {
    httpError(409, 'Đăng ký dự thi hiện không cho phép learner khai báo thanh toán.', 'EXAM_PAYMENT_CANNOT_BE_REPORTED');
  }

  const payableAmount = toMoney(registration?.payableAmount, 0);
  const paymentStatus = normalizeRegistrationPaymentStatus(registration?.paymentStatus, 'unpaid');
  if (payableAmount <= 0 || paymentStatus === 'not_required') {
    httpError(409, 'Đăng ký dự thi này không yêu cầu thanh toán.', 'EXAM_PAYMENT_NOT_REQUIRED');
  }

  if (REPORT_BLOCKED_PAYMENT_STATUSES.has(paymentStatus)) {
    httpError(409, 'Đăng ký dự thi hiện không cho phép learner khai báo thanh toán.', 'EXAM_PAYMENT_CANNOT_BE_REPORTED');
  }

  const roundStatus = normalizeText(registration?.examRound?.status).toLowerCase();
  if (roundStatus === 'cancelled') {
    httpError(409, 'Đăng ký dự thi hiện không cho phép learner khai báo thanh toán.', 'EXAM_PAYMENT_CANNOT_BE_REPORTED');
  }

  const paymentEndAt = normalizeStoredDateTime(registration?.examRound?.paymentEndAt);
  if (paymentEndAt && now.getTime() > Date.parse(paymentEndAt)) {
    httpError(409, 'Cửa sổ khai báo thanh toán đã hết hạn.', 'EXAM_PAYMENT_WINDOW_EXPIRED');
  }
}

function mapEvidenceFile(row: any) {
  return {
    id: Number(row?.id || 0),
    name: normalizeText(row?.originalName) || normalizeText(row?.fileName),
    url: normalizeText(row?.url) || null,
  };
}

function mapRegistrationPaymentSummary(registration: any, overrides?: Partial<PaymentSummary>) {
  const payableAmount = typeof overrides?.payableAmount === 'number' ? overrides.payableAmount : toMoney(registration?.payableAmount, 0);
  const confirmedPaidAmount = typeof overrides?.confirmedPaidAmount === 'number' ? overrides.confirmedPaidAmount : toMoney(registration?.confirmedPaidAmount, 0);
  const paymentStatus = overrides?.paymentStatus || normalizeRegistrationPaymentStatus(registration?.paymentStatus, 'unpaid');

  return {
    id: Number(registration?.id || 0),
    documentId: registration?.documentId || null,
    registrationCode: normalizeText(registration?.registrationCode),
    paymentStatus,
    payableAmount,
    confirmedPaidAmount,
    remainingAmount: buildRemainingAmount(payableAmount, confirmedPaidAmount),
  };
}

function mapExamPaymentRow(row: any) {
  return {
    id: Number(row?.id || 0),
    documentId: row?.documentId || null,
    amount: toMoney(row?.amount, 0),
    paymentMethod: normalizeText(row?.paymentMethod) || null,
    transactionCode: normalizeOptionalText(row?.transactionCode, 100),
    payerName: normalizeOptionalText(row?.payerName, 200),
    paidAt: normalizeStoredDateTime(row?.paidAt),
    reportedAt: normalizeStoredDateTime(row?.reportedAt),
    status: normalizePaymentStatus(row?.status, 'status', 'reported'),
    verifiedAt: normalizeStoredDateTime(row?.verifiedAt),
    rejectionReason: normalizeOptionalText(row?.rejectionReason),
    note: normalizeOptionalText(row?.note),
    evidenceFiles: Array.isArray(row?.evidenceFiles) ? row.evidenceFiles.map(mapEvidenceFile) : [],
    reportedBy: summarizeWorkflowActor(row?.reportedBy ? { id: row.reportedBy.id, username: row.reportedBy.username, fullName: row.reportedBy.fullName, email: row.reportedBy.email } : null),
    verifiedBy: summarizeWorkflowActor(row?.verifiedBy ? { id: row.verifiedBy.id, username: row.verifiedBy.username, fullName: row.verifiedBy.fullName, email: row.verifiedBy.email } : null),
  };
}

function mapPaymentReviewRow(row: any) {
  const registration = row?.examRegistration;
  const examRound = registration?.examRound;
  return {
    id: Number(row?.id || 0),
    amount: toMoney(row?.amount, 0),
    paymentMethod: normalizeText(row?.paymentMethod) || null,
    transactionCode: normalizeOptionalText(row?.transactionCode, 100),
    paidAt: normalizeStoredDateTime(row?.paidAt),
    reportedAt: normalizeStoredDateTime(row?.reportedAt),
    status: normalizePaymentStatus(row?.status, 'status', 'reported'),
    registrationCode: normalizeText(registration?.registrationCode),
    payableAmount: toMoney(registration?.payableAmount, 0),
    confirmedPaidAmount: toMoney(registration?.confirmedPaidAmount, 0),
    learner: {
      id: Number(extractRelationRef(registration?.learner) || registration?.learner?.id || 0) || null,
      code: normalizeText(registration?.studentCodeSnapshot || registration?.learner?.code),
      fullName: normalizeText(registration?.fullNameSnapshot || registration?.learner?.fullName),
    },
    examRound: examRound
      ? {
          id: Number(extractRelationRef(examRound) || examRound?.id || 0),
          code: normalizeText(examRound?.code),
          name: normalizeText(examRound?.name),
        }
      : null,
    evidenceCount: Array.isArray(row?.evidenceFiles) ? row.evidenceFiles.length : 0,
    reportedBy: summarizeWorkflowActor(row?.reportedBy ? { id: row.reportedBy.id, username: row.reportedBy.username, fullName: row.reportedBy.fullName, email: row.reportedBy.email } : null),
  };
}

function normalizeSortOrder(rawSort: unknown, allowedFields: string[], fallback: Array<Record<string, 'asc' | 'desc'>>) {
  const requested = normalizeSortInput(rawSort);
  const filtered = requested.filter((entry) => {
    const key = Object.keys(entry)[0] || '';
    return allowedFields.includes(key);
  });
  return filtered.length > 0 ? filtered : fallback;
}

function normalizeListMyQuery(query: Record<string, unknown>) {
  const page = toPositiveInt(query.page, 1);
  const pageSize = Math.min(MAX_PAGE_SIZE, toPositiveInt(query.pageSize, 20));
  const status = normalizeOptionalText(query.status)?.toLowerCase() || null;
  if (status && !['reported', 'under_review', 'confirmed', 'rejected', 'refund_pending', 'refunded', 'cancelled'].includes(status)) {
    httpError(400, 'status is invalid', 'INVALID_REQUEST_BODY');
  }
  const sort = normalizeSortOrder(query.sort, ['reportedAt', 'paidAt', 'amount', 'status', 'id'], [{ reportedAt: 'desc' }, { id: 'desc' }]);
  return { page, pageSize, status, sort };
}

function normalizeAdminReviewQuery(query: Record<string, unknown>) {
  const page = toPositiveInt(query.page, 1);
  const pageSize = Math.min(MAX_PAGE_SIZE, toPositiveInt(query.pageSize, 20));
  const examRoundId = normalizeOptionalId(query.examRoundId, 'examRoundId');
  const registrationId = normalizeOptionalId(query.registrationId, 'registrationId');
  const status = normalizeOptionalText(query.status)?.toLowerCase() || null;
  if (status && !['reported', 'under_review', 'confirmed', 'rejected', 'refund_pending', 'refunded', 'cancelled'].includes(status)) {
    httpError(400, 'status is invalid', 'INVALID_REQUEST_BODY');
  }
  const paymentMethod = normalizeOptionalText(query.paymentMethod)?.toLowerCase() || null;
  if (paymentMethod && !['bank_transfer', 'cash', 'online', 'accounting_confirmation', 'other'].includes(paymentMethod)) {
    httpError(400, 'paymentMethod is invalid', 'INVALID_REQUEST_BODY');
  }
  const sort = normalizeSortOrder(query.sort, ['reportedAt', 'paidAt', 'amount', 'status', 'id'], [{ reportedAt: 'desc' }, { id: 'desc' }]);
  return {
    page,
    pageSize,
    examRoundId,
    registrationId,
    status,
    paymentMethod,
    transactionCode: normalizeOptionalText(query.transactionCode, 100),
    learnerCode: normalizeOptionalText(query.learnerCode, 100),
    learnerName: normalizeOptionalText(query.learnerName, 200),
    paidFrom: parseDateTime(query.paidFrom, 'paidFrom'),
    paidTo: parseDateTime(query.paidTo, 'paidTo'),
    reportedFrom: parseDateTime(query.reportedFrom, 'reportedFrom'),
    reportedTo: parseDateTime(query.reportedTo, 'reportedTo'),
    sort,
  };
}

function normalizeOptionalId(value: unknown, fieldName: string): number | null {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    httpError(400, `${fieldName} is invalid`, 'INVALID_REQUEST_BODY');
  }
  return parsed;
}

function buildAdminReviewWhere(query: ReturnType<typeof normalizeAdminReviewQuery>) {
  const clauses: Record<string, unknown>[] = [];
  if (query.examRoundId) {
    clauses.push({ examRegistration: { examRound: { id: { $eq: query.examRoundId } } } });
  }
  if (query.registrationId) {
    clauses.push({ examRegistration: { id: { $eq: query.registrationId } } });
  }
  if (query.status) {
    clauses.push({ status: query.status });
  }
  if (query.paymentMethod) {
    clauses.push({ paymentMethod: query.paymentMethod });
  }
  if (query.transactionCode) {
    clauses.push({ transactionCode: { $containsi: query.transactionCode } });
  }
  if (query.learnerCode) {
    clauses.push({ examRegistration: { studentCodeSnapshot: { $containsi: query.learnerCode } } });
  }
  if (query.learnerName) {
    clauses.push({ examRegistration: { fullNameSnapshot: { $containsi: query.learnerName } } });
  }

  const paidRange: Record<string, string> = {};
  if (query.paidFrom) paidRange.$gte = query.paidFrom;
  if (query.paidTo) paidRange.$lte = query.paidTo;
  if (Object.keys(paidRange).length > 0) {
    clauses.push({ paidAt: paidRange });
  }

  const reportedRange: Record<string, string> = {};
  if (query.reportedFrom) reportedRange.$gte = query.reportedFrom;
  if (query.reportedTo) reportedRange.$lte = query.reportedTo;
  if (Object.keys(reportedRange).length > 0) {
    clauses.push({ reportedAt: reportedRange });
  }

  if (clauses.length === 0) return {};
  return { $and: clauses };
}

function applyAdminReviewFiltersToKnex(builder: any, tenantId: number, query: ReturnType<typeof normalizeAdminReviewQuery>) {
  builder.where('tenant_link.tenant_id', tenantId);

  if (query.examRoundId) {
    builder.where('registration_round_link.exam_round_id', query.examRoundId);
  }
  if (query.registrationId) {
    builder.where('registration.id', query.registrationId);
  }
  if (query.status) {
    builder.where('payment.status', query.status);
  }
  if (query.paymentMethod) {
    builder.where('payment.payment_method', query.paymentMethod);
  }
  if (query.transactionCode) {
    builder.whereILike('payment.transaction_code', `%${query.transactionCode}%`);
  }
  if (query.learnerCode) {
    builder.whereILike('registration.student_code_snapshot', `%${query.learnerCode}%`);
  }
  if (query.learnerName) {
    builder.whereILike('registration.full_name_snapshot', `%${query.learnerName}%`);
  }
  if (query.paidFrom) {
    builder.where('payment.paid_at', '>=', query.paidFrom);
  }
  if (query.paidTo) {
    builder.where('payment.paid_at', '<=', query.paidTo);
  }
  if (query.reportedFrom) {
    builder.where('payment.reported_at', '>=', query.reportedFrom);
  }
  if (query.reportedTo) {
    builder.where('payment.reported_at', '<=', query.reportedTo);
  }
}

export async function recalculateRegistrationPaymentSummary(options: { trx: any; tenantId: number; registrationId: number }) {
  const registration = await loadRegistrationInTenant(options.tenantId, options.registrationId, options.trx);
  const payments = await findPaymentsForRegistration(options.tenantId, Number(registration.id), options.trx);
  const payableAmount = toMoney(registration?.payableAmount, 0);
  const confirmedPaidAmount = roundMoney(payments
    .filter((item) => normalizePaymentStatus(item?.status, 'status', 'reported') === 'confirmed')
    .reduce((sum, item) => sum + toMoney(item?.amount, 0), 0));

  let paymentStatus: RegistrationPaymentStatus = 'unpaid';
  if (payableAmount <= 0) {
    paymentStatus = 'not_required';
  } else if (confirmedPaidAmount >= payableAmount) {
    paymentStatus = 'paid';
  } else if (confirmedPaidAmount > 0) {
    paymentStatus = 'partially_paid';
  } else if (payments.some((item) => normalizePaymentStatus(item?.status, 'status', 'reported') === 'under_review')) {
    paymentStatus = 'payment_under_review';
  } else if (payments.some((item) => normalizePaymentStatus(item?.status, 'status', 'reported') === 'reported')) {
    paymentStatus = 'payment_reported';
  } else if (payments.some((item) => normalizePaymentStatus(item?.status, 'status', 'reported') === 'rejected')) {
    paymentStatus = 'payment_rejected';
  }

  await strapi.db.query(EXAM_REGISTRATION_UID).update({
    where: { id: Number(registration.id) },
    data: {
      paymentStatus,
      confirmedPaidAmount: moneyToStorageString(confirmedPaidAmount),
    },
    transacting: options.trx,
  } as any);

  return {
    registration,
    summary: {
      paymentStatus,
      confirmedPaidAmount,
      payableAmount,
      remainingAmount: buildRemainingAmount(payableAmount, confirmedPaidAmount),
    },
  };
}

function logExamPaymentEvent(event: 'exam_payment.reported' | 'exam_payment.review_started' | 'exam_payment.confirmed' | 'exam_payment.rejected', payload: Record<string, unknown>) {
  strapi.log.info(`[exam-payment] ${event} ${JSON.stringify(payload)}`);
}

export async function reportExamPaymentByLearner(ctx: any, tenantId: number, registrationRef: unknown, payload: Record<string, unknown>, authUser: AuthUser) {
  const input = normalizeReportPaymentInput(payload || {});

  try {
    return await strapi.db.connection.transaction(async (trx: any) => {
      const { learner, registration } = await loadOwnedRegistrationForLearner(ctx, tenantId, registrationRef, trx);
      await acquireRegistrationPaymentLock(trx, tenantId, Number(registration.id));

      const refreshed = await loadOwnedRegistrationForLearner(ctx, tenantId, registrationRef, trx);
      assertLearnerPaymentReportAllowed(refreshed.registration);

      if (input.transactionCode) {
        await acquirePaymentTransactionCodeLock(trx, tenantId, input.transactionCode);
        await assertPaymentTransactionCodeAvailable(tenantId, input.transactionCode, trx);
      }

      const evidenceFiles = await validateEvidenceFilesForLearner(tenantId, authUser.id, input.evidenceFileIds, trx);
      const now = new Date();
      const created = await strapi.db.query(EXAM_PAYMENT_UID).create({
        data: {
          examRegistration: Number(refreshed.registration.id),
          transactionCode: input.transactionCode,
          amount: input.amount,
          paymentMethod: input.paymentMethod,
          payerName: input.payerName,
          paidAt: input.paidAt,
          reportedAt: now,
          status: 'reported',
          evidenceFiles: toRelationSet(evidenceFiles.map((item) => Number(item.id))),
          reportedBy: authUser.id,
          verifiedBy: null,
          verifiedAt: null,
          rejectionReason: null,
          refundAmount: moneyToStorageString(0),
          refundedAt: null,
          note: input.note,
          tenant: tenantId,
        },
        transacting: trx,
      } as any) as any;

      if (!created?.id) {
        httpError(409, 'Không thể tạo exam payment.', 'EXAM_PAYMENT_REPORT_FAILED');
      }

      const { summary } = await recalculateRegistrationPaymentSummary({
        trx,
        tenantId,
        registrationId: Number(refreshed.registration.id),
      });

      const payment = await findExamPaymentInTenant(tenantId, created.id, trx);

      logExamPaymentEvent('exam_payment.reported', {
        tenantId,
        examRoundId: Number(extractRelationRef(payment?.examRegistration?.examRound) || payment?.examRegistration?.examRound?.id || 0),
        registrationId: Number(refreshed.registration.id),
        paymentId: Number(payment.id),
        actorUserId: authUser.id,
        amount: toMoney(payment.amount, 0),
        fromStatus: null,
        toStatus: 'reported',
        timestamp: now.toISOString(),
      });

      return {
        payment: mapExamPaymentRow(payment),
        registration: mapRegistrationPaymentSummary(refreshed.registration, summary),
        learner: {
          id: learner.id,
          code: learner.code,
          fullName: learner.fullName,
        },
      };
    });
  } catch (error: any) {
    if (error instanceof HttpError) throw error;
    throw error;
  }
}

export async function listMyExamRegistrationPayments(ctx: any, tenantId: number, registrationRef: unknown, rawQuery: Record<string, unknown>, _authUser: AuthUser) {
  const { registration } = await loadOwnedRegistrationForLearner(ctx, tenantId, registrationRef);
  const query = normalizeListMyQuery(rawQuery || {});
  const where = mergeTenantWhere({
    $and: [
      {
        examRegistration: {
          id: { $eq: Number(registration.id) },
        },
      },
      ...(query.status ? [{ status: query.status }] : []),
    ],
  }, tenantId);
  const start = (query.page - 1) * query.pageSize;
  const [rows, total] = await Promise.all([
    strapi.db.query(EXAM_PAYMENT_UID).findMany({
      where,
      offset: start,
      limit: query.pageSize,
      orderBy: query.sort,
      populate: {
        evidenceFiles: { select: ['id', 'originalName', 'fileName', 'url', 'mimeType', 'status', 'isDeleted'] },
        reportedBy: { select: ['id', 'username', 'fullName', 'email'] },
        verifiedBy: { select: ['id', 'username', 'fullName', 'email'] },
      },
    } as any),
    strapi.db.query(EXAM_PAYMENT_UID).count({ where } as any),
  ]);

  return {
    data: (rows || []).map(mapExamPaymentRow),
    meta: {
      pagination: {
        page: query.page,
        pageSize: query.pageSize,
        pageCount: Math.max(1, Math.ceil(total / query.pageSize)),
        total,
      },
    },
    registration: mapRegistrationPaymentSummary(registration),
  };
}

export async function getMyExamRegistrationPaymentDetail(ctx: any, tenantId: number, registrationRef: unknown, paymentRef: unknown, _authUser: AuthUser) {
  const { registration, payment } = await findOwnedExamPaymentForLearner(ctx, tenantId, registrationRef, paymentRef);
  return {
    payment: mapExamPaymentRow(payment),
    registration: mapRegistrationPaymentSummary(registration),
  };
}

export async function listAdminExamPaymentsForReview(tenantId: number, rawQuery: Record<string, unknown>, _authUser: AuthUser) {
  const query = normalizeAdminReviewQuery(rawQuery || {});
  const where = mergeTenantWhere(buildAdminReviewWhere(query), tenantId);
  const start = (query.page - 1) * query.pageSize;

  const summaryBuilder = strapi.db.connection('exam_payments as payment')
    .innerJoin('exam_payments_tenant_lnk as tenant_link', 'tenant_link.exam_payment_id', 'payment.id')
    .innerJoin('exam_payments_exam_registration_lnk as payment_registration_link', 'payment_registration_link.exam_payment_id', 'payment.id')
    .innerJoin('exam_registrations as registration', 'registration.id', 'payment_registration_link.exam_registration_id')
    .innerJoin('exam_registrations_exam_round_lnk as registration_round_link', 'registration_round_link.exam_registration_id', 'registration.id');

  applyAdminReviewFiltersToKnex(summaryBuilder, tenantId, query);

  const [rows, total, summaryRowRaw] = await Promise.all([
    strapi.db.query(EXAM_PAYMENT_UID).findMany({
      where,
      offset: start,
      limit: query.pageSize,
      orderBy: query.sort,
      populate: {
        examRegistration: {
          select: ['id', 'documentId', 'registrationCode', 'payableAmount', 'confirmedPaidAmount', 'studentCodeSnapshot', 'fullNameSnapshot'],
          populate: {
            learner: { select: ['id', 'code', 'fullName'] },
            examRound: { select: ['id', 'documentId', 'code', 'name'] },
          },
        },
        evidenceFiles: { select: ['id'] },
        reportedBy: { select: ['id', 'username', 'fullName', 'email'] },
      },
    } as any),
    strapi.db.query(EXAM_PAYMENT_UID).count({ where } as any),
    summaryBuilder
      .clone()
      .select(
        strapi.db.connection.raw(`count(*) filter (where payment.status = 'reported') as reported_count`),
        strapi.db.connection.raw(`count(*) filter (where payment.status = 'under_review') as under_review_count`),
        strapi.db.connection.raw(`count(*) filter (where payment.status = 'confirmed') as confirmed_count`),
        strapi.db.connection.raw(`count(*) filter (where payment.status = 'rejected') as rejected_count`),
        strapi.db.connection.raw(`coalesce(sum(case when payment.status = 'reported' then payment.amount else 0 end), 0) as total_reported_amount`),
        strapi.db.connection.raw(`coalesce(sum(case when payment.status = 'confirmed' then payment.amount else 0 end), 0) as total_confirmed_amount`),
      )
      .first(),
  ]);

  const summaryRow = (summaryRowRaw || {}) as Record<string, unknown>;

  const reportedCount = Number(summaryRow?.reported_count || 0);
  const underReviewCount = Number(summaryRow?.under_review_count || 0);
  const confirmedCount = Number(summaryRow?.confirmed_count || 0);
  const rejectedCount = Number(summaryRow?.rejected_count || 0);
  const totalReportedAmount = roundMoney(Number(summaryRow?.total_reported_amount || 0));
  const totalConfirmedAmount = roundMoney(Number(summaryRow?.total_confirmed_amount || 0));

  return {
    data: (rows || []).map(mapPaymentReviewRow),
    meta: {
      pagination: {
        page: query.page,
        pageSize: query.pageSize,
        pageCount: Math.max(1, Math.ceil(total / query.pageSize)),
        total,
      },
      summary: {
        reported: reportedCount,
        underReview: underReviewCount,
        confirmed: confirmedCount,
        rejected: rejectedCount,
        totalReportedAmount,
        totalConfirmedAmount,
      },
    },
  };
}

export async function getAdminExamPaymentReviewDetail(tenantId: number, paymentRef: unknown, _authUser: AuthUser) {
  const payment = await findExamPaymentInTenant(tenantId, paymentRef);
  return {
    payment: mapExamPaymentRow(payment),
    registration: mapRegistrationPaymentSummary(payment.examRegistration),
    learner: {
      id: Number(extractRelationRef(payment?.examRegistration?.learner) || payment?.examRegistration?.learner?.id || 0) || null,
      code: normalizeText(payment?.examRegistration?.studentCodeSnapshot || payment?.examRegistration?.learner?.code),
      fullName: normalizeText(payment?.examRegistration?.fullNameSnapshot || payment?.examRegistration?.learner?.fullName),
    },
    examRound: payment?.examRegistration?.examRound
      ? {
          id: Number(extractRelationRef(payment.examRegistration.examRound) || payment.examRegistration.examRound.id || 0),
          documentId: payment.examRegistration.examRound.documentId || null,
          code: normalizeText(payment.examRegistration.examRound.code),
          name: normalizeText(payment.examRegistration.examRound.name),
        }
      : null,
  };
}

export async function startExamPaymentReview(tenantId: number, paymentRef: unknown, payload: Record<string, unknown>, authUser: AuthUser) {
  const input = normalizeStartReviewInput(payload || {});

  return strapi.db.connection.transaction(async (trx: any) => {
    const current = await findExamPaymentInTenant(tenantId, paymentRef, trx);
    const registrationId = Number(extractRelationRef(current?.examRegistration) || current?.examRegistration?.id || 0);
    await acquireRegistrationPaymentLock(trx, tenantId, registrationId);

    const payment = await findExamPaymentInTenant(tenantId, paymentRef, trx);
    const fromStatus = normalizePaymentStatus(payment?.status, 'status', 'reported');
    if (fromStatus !== 'reported') {
      httpError(409, 'Exam payment hiện không thể chuyển sang đang kiểm tra.', 'PAYMENT_CANNOT_START_REVIEW');
    }

    const updated = await strapi.db.query(EXAM_PAYMENT_UID).update({
      where: { id: Number(payment.id) },
      data: {
        status: 'under_review',
        ...(typeof input.note === 'string' ? { note: input.note } : {}),
      },
      transacting: trx,
    } as any);

    if (!updated?.id) {
      httpError(409, 'Không thể cập nhật trạng thái exam payment.', 'EXAM_PAYMENT_REVIEW_FAILED');
    }

    const { summary } = await recalculateRegistrationPaymentSummary({ trx, tenantId, registrationId });
    const refreshed = await findExamPaymentInTenant(tenantId, payment.id, trx);

    logExamPaymentEvent('exam_payment.review_started', {
      tenantId,
      examRoundId: Number(extractRelationRef(refreshed?.examRegistration?.examRound) || refreshed?.examRegistration?.examRound?.id || 0),
      registrationId,
      paymentId: Number(refreshed.id),
      actorUserId: authUser.id,
      amount: toMoney(refreshed.amount, 0),
      fromStatus,
      toStatus: 'under_review',
      timestamp: new Date().toISOString(),
    });

    return {
      payment: mapExamPaymentRow(refreshed),
      registration: mapRegistrationPaymentSummary(refreshed.examRegistration, summary),
    };
  });
}

export async function confirmExamPayment(tenantId: number, paymentRef: unknown, payload: Record<string, unknown>, authUser: AuthUser) {
  const input = normalizeConfirmPaymentInput(payload || {});

  return strapi.db.connection.transaction(async (trx: any) => {
    const current = await findExamPaymentInTenant(tenantId, paymentRef, trx);
    const registrationId = Number(extractRelationRef(current?.examRegistration) || current?.examRegistration?.id || 0);
    await acquireRegistrationPaymentLock(trx, tenantId, registrationId);

    const payment = await findExamPaymentInTenant(tenantId, paymentRef, trx);
    const fromStatus = normalizePaymentStatus(payment?.status, 'status', 'reported');
    if (!REVIEWABLE_PAYMENT_STATUSES.has(fromStatus)) {
      httpError(409, 'Exam payment hiện không thể xác nhận.', 'PAYMENT_CANNOT_BE_CONFIRMED');
    }

    if (input.confirmedAmount && roundMoney(Number(input.confirmedAmount)) !== toMoney(payment.amount, 0)) {
      httpError(400, 'Chưa hỗ trợ xác nhận một phần payment.', 'PARTIAL_PAYMENT_CONFIRMATION_NOT_SUPPORTED');
    }

    const now = new Date();
    const updated = await strapi.db.query(EXAM_PAYMENT_UID).update({
      where: { id: Number(payment.id) },
      data: {
        status: 'confirmed',
        verifiedBy: authUser.id,
        verifiedAt: now,
        rejectionReason: null,
        ...(typeof input.note === 'string' ? { note: input.note } : {}),
      },
      transacting: trx,
    } as any);

    if (!updated?.id) {
      httpError(409, 'Không thể xác nhận exam payment.', 'EXAM_PAYMENT_CONFIRM_FAILED');
    }

    const { summary } = await recalculateRegistrationPaymentSummary({ trx, tenantId, registrationId });
    const refreshed = await findExamPaymentInTenant(tenantId, payment.id, trx);

    logExamPaymentEvent('exam_payment.confirmed', {
      tenantId,
      examRoundId: Number(extractRelationRef(refreshed?.examRegistration?.examRound) || refreshed?.examRegistration?.examRound?.id || 0),
      registrationId,
      paymentId: Number(refreshed.id),
      actorUserId: authUser.id,
      amount: toMoney(refreshed.amount, 0),
      fromStatus,
      toStatus: 'confirmed',
      timestamp: now.toISOString(),
    });

    return {
      payment: {
        id: Number(refreshed.id),
        status: 'confirmed',
        amount: toMoney(refreshed.amount, 0),
        verifiedAt: now.toISOString(),
        verifiedBy: summarizeWorkflowActor(authUser),
      },
      registration: mapRegistrationPaymentSummary(refreshed.examRegistration, summary),
    };
  });
}

export async function rejectExamPayment(tenantId: number, paymentRef: unknown, payload: Record<string, unknown>, authUser: AuthUser) {
  const input = normalizeRejectPaymentInput(payload || {});

  return strapi.db.connection.transaction(async (trx: any) => {
    const current = await findExamPaymentInTenant(tenantId, paymentRef, trx);
    const registrationId = Number(extractRelationRef(current?.examRegistration) || current?.examRegistration?.id || 0);
    await acquireRegistrationPaymentLock(trx, tenantId, registrationId);

    const payment = await findExamPaymentInTenant(tenantId, paymentRef, trx);
    const fromStatus = normalizePaymentStatus(payment?.status, 'status', 'reported');
    if (!REVIEWABLE_PAYMENT_STATUSES.has(fromStatus)) {
      httpError(409, 'Exam payment hiện không thể từ chối.', 'PAYMENT_CANNOT_BE_REJECTED');
    }

    const now = new Date();
    const updated = await strapi.db.query(EXAM_PAYMENT_UID).update({
      where: { id: Number(payment.id) },
      data: {
        status: 'rejected',
        verifiedBy: authUser.id,
        verifiedAt: now,
        rejectionReason: input.reason,
        ...(typeof input.note === 'string' ? { note: input.note } : {}),
      },
      transacting: trx,
    } as any);

    if (!updated?.id) {
      httpError(409, 'Không thể từ chối exam payment.', 'EXAM_PAYMENT_REJECT_FAILED');
    }

    const { summary } = await recalculateRegistrationPaymentSummary({ trx, tenantId, registrationId });
    const refreshed = await findExamPaymentInTenant(tenantId, payment.id, trx);

    logExamPaymentEvent('exam_payment.rejected', {
      tenantId,
      examRoundId: Number(extractRelationRef(refreshed?.examRegistration?.examRound) || refreshed?.examRegistration?.examRound?.id || 0),
      registrationId,
      paymentId: Number(refreshed.id),
      actorUserId: authUser.id,
      amount: toMoney(refreshed.amount, 0),
      fromStatus,
      toStatus: 'rejected',
      timestamp: now.toISOString(),
    });

    return {
      payment: {
        id: Number(refreshed.id),
        status: 'rejected',
        amount: toMoney(refreshed.amount, 0),
        verifiedAt: now.toISOString(),
        verifiedBy: summarizeWorkflowActor(authUser),
        rejectionReason: input.reason,
      },
      registration: mapRegistrationPaymentSummary(refreshed.examRegistration, summary),
    };
  });
}

export function handleExamPaymentWorkflowError(ctx: any, error: unknown) {
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

  strapi.log.error('[exam-payment-workflow] unexpected error', error);
  return ctx.internalServerError('Failed to process exam payment workflow request');
}