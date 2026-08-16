import { randomBytes } from 'node:crypto';

import { errors } from '@strapi/utils';
import { enqueueMail } from '../../../services/mail-queue';
import storageService from '../../../services/storage-service';
import { getBaseUrl } from '../../../utils/tenant-base-url';
import { createExamRoom as createExamRoomMaster, createExamVenue as createExamVenueMaster } from '../../exam-schedule/services/exam-schedule-management';

import { extractRelationRef, hasOwn, mergeTenantWhere, normalizeSortInput, toPositiveInt, toText, whereByParam } from '../../../utils/tenant-scope';

const EXAM_PROGRAM_UID = 'api::exam-program.exam-program';
const EXAM_PROGRAM_SUBJECT_UID = 'api::exam-program-subject.exam-program-subject';
const OUTCOME_STANDARD_UID = 'api::outcome-standard.outcome-standard';
const EXAM_SUBJECT_UID = 'api::exam-subject.exam-subject';
const EXAM_SUBJECT_COMPONENT_UID = 'api::exam-subject-component.exam-subject-component';
const EXAM_COMPONENT_UID = 'api::exam-component.exam-component';
const EXAM_ROUND_UID = 'api::exam-round.exam-round';
const EXAM_ROUND_SUBJECT_UID = 'api::exam-round-subject.exam-round-subject';
const EXAM_ROUND_COMPONENT_UID = 'api::exam-round-component.exam-round-component';
const EXAM_VENUE_UID = 'api::exam-venue.exam-venue';
const EXAM_ROOM_UID = 'api::exam-room.exam-room';
const EXAM_SCHEDULE_UID = 'api::exam-schedule.exam-schedule';
const PAYMENT_PROFILE_UID = 'api::payment-profile.payment-profile';
const EXAM_ELIGIBILITY_UID = 'api::exam-eligibility.exam-eligibility';
const EXAM_REGISTRATION_UID = 'api::exam-registration.exam-registration';
const EXAM_REGISTRATION_SUBJECT_UID = 'api::exam-registration-subject.exam-registration-subject';
const EXAM_REGISTRATION_COMPONENT_UID = 'api::exam-registration-component.exam-registration-component';
const FILE_ASSET_UID = 'api::file-asset.file-asset';
const LEARNER_UID = 'api::learner.learner';
const ENROLLMENT_UID = 'api::enrollment.enrollment';
const TENANT_UID = 'api::tenant.tenant';
const REGISTRATION_CONCURRENCY_GUARD_WINDOW_MS = 500;
const ELIGIBILITY_BULK_LIMIT = 500;
const REGISTRATION_CODE_PREFIX = 'EXR';
const REGISTRATION_CODE_MAX_ATTEMPTS = 10;
const PAYMENT_TRANSFER_CONTENT_MAX_LENGTH = 255;
const PAYMENT_REPORT_FUTURE_TOLERANCE_MS = 5 * 60 * 1000;
const PAYMENT_EVIDENCE_MAX_FILE_SIZE = 10 * 1024 * 1024;
const PAYMENT_EVIDENCE_ALLOWED_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'application/pdf']);
const EXAM_COMPONENT_ALLOWED_FIELDS = ['code', 'name', 'description', 'minimumScore', 'maximumScore', 'passingScore', 'defaultDurationMinutes', 'examMethod', 'isActive'];
const EXAM_COMPONENT_ALLOWED_METHODS = ['computer', 'paper', 'oral', 'practical', 'mixed', 'other'] as const;
const EXAM_SUBJECT_ALLOWED_FIELDS = ['code', 'name', 'calculationMethod', 'requiredAggregateScore', 'requireAllComponents', 'defaultFee', 'ruleDescription', 'isActive'];
const EXAM_SUBJECT_ALLOWED_METHODS = ['total', 'average', 'all_components_pass', 'custom'] as const;
const EXAM_PROGRAM_ALLOWED_FIELDS = ['code', 'name', 'passingMethod', 'feeCalculationMethod', 'defaultFee', 'targetDescription', 'validFrom', 'validTo', 'isActive'];
const EXAM_PROGRAM_PASSING_METHODS = ['all_subjects_pass', 'any_subject_pass', 'custom'] as const;
const EXAM_PROGRAM_FEE_METHODS = ['sum_subject_fees', 'fixed'] as const;

type AuthUser = {
  id: number;
  username?: string | null;
  fullName?: string | null;
  email?: string | null;
};

type HttpErrorDetails = Record<string, unknown> | Array<Record<string, unknown>> | null;

type CreateExamRoundInput = {
  examProgramId: number;
  code: string;
  name: string;
  academicYear: string | null;
  semester: string | null;
  registrationMode: 'open' | 'restricted';
  registrationStartAt: string | null;
  registrationEndAt: string | null;
  paymentStartAt: string | null;
  paymentEndAt: string | null;
  candidateListClosingAt: string | null;
  examStartAt: string | null;
  examEndAt: string | null;
  paymentCalculationMethod: 'program_fee' | 'subject_fee' | 'component_fee' | 'fixed';
  fixedFee: string | null;
  allowSubjectSelection: boolean;
  allowComponentSelection: boolean;
  requireConfirmedPayment: boolean;
  allowCancellation: boolean;
  cancellationDeadline: string | null;
  instructions: string | null;
  paymentInstructions: string | null;
};

type SubjectSnapshotDraft = {
  sourceProgramSubjectId: number;
  examSubjectId: number;
  nameSnapshot: string;
  calculationMethodSnapshot: 'total' | 'average' | 'all_components_pass' | 'custom';
  requiredAggregateScoreSnapshot: string | null;
  requireAllComponentsSnapshot: boolean;
  ruleDescriptionSnapshot: string | null;
  fee: string | null;
  isRequired: boolean;
  allowSeparateRegistration: boolean;
  displayOrder: number;
};

type ComponentSnapshotDraft = {
  sourceSubjectId: number;
  examComponentId: number;
  nameSnapshot: string;
  minimumScoreSnapshot: string | null;
  maximumScoreSnapshot: string | null;
  passingScoreSnapshot: string | null;
  eliminationScoreSnapshot: string | null;
  durationMinutes: number | null;
  examMethod: 'computer' | 'paper' | 'oral' | 'practical' | 'mixed' | 'other';
  fee: string | null;
  isRequired: boolean;
  allowSeparateRegistration: boolean;
  displayOrder: number;
};

type UpdateStructureInput = {
  paymentCalculationMethod?: 'fixed' | 'program_fee' | 'subject_fee' | 'component_fee';
  fixedFee?: string | null;
  allowSubjectSelection?: boolean;
  allowComponentSelection?: boolean;
  subjects: Array<{
    examRoundSubjectId: number;
    status?: 'active' | 'inactive';
    isRequired?: boolean;
    allowSeparateRegistration?: boolean;
    fee?: string | null;
    displayOrder?: number;
    calculationMethodSnapshot?: 'total' | 'average' | 'all_components_pass' | 'custom';
    requiredAggregateScoreSnapshot?: string | null;
    requireAllComponentsSnapshot?: boolean;
    ruleDescriptionSnapshot?: string | null;
    components?: Array<{
      examRoundComponentId: number;
      status?: 'active' | 'inactive';
      isRequired?: boolean;
      allowSeparateRegistration?: boolean;
      minimumScoreSnapshot?: string | null;
      maximumScoreSnapshot?: string | null;
      passingScoreSnapshot?: string | null;
      eliminationScoreSnapshot?: string | null;
      durationMinutes?: number | null;
      fee?: string | null;
      examMethod?: 'computer' | 'paper' | 'oral' | 'practical' | 'mixed' | 'other';
      externalExamCode?: string | null;
      displayOrder?: number;
    }>;
  }>;
};

type UpdatePaymentSettingsInput = {
  paymentMethodSnapshot?: 'bank_transfer' | 'cash' | 'other';
  paymentBankCodeSnapshot?: string | null;
  paymentBankNameSnapshot?: string | null;
  paymentAccountNumberSnapshot?: string | null;
  paymentAccountHolderSnapshot?: string | null;
  paymentBankBranchSnapshot?: string | null;
  paymentCurrencySnapshot?: string | null;
  paymentTransferContentTemplateSnapshot?: string | null;
  paymentInstructionSnapshot?: string | null;
  paymentSupportPhoneSnapshot?: string | null;
  paymentSupportEmailSnapshot?: string | null;
  paymentQrImageSnapshot?: number | null;
};

type MutableRoundComponent = {
  id: number;
  examRoundSubjectId: number;
  codeSnapshot: string | null;
  status: 'active' | 'inactive' | 'cancelled';
  isRequired: boolean;
  allowSeparateRegistration: boolean;
  minimumScoreSnapshot: string | null;
  maximumScoreSnapshot: string | null;
  passingScoreSnapshot: string | null;
  eliminationScoreSnapshot: string | null;
  durationMinutes: number | null;
  fee: string | null;
  examMethod: 'computer' | 'paper' | 'oral' | 'practical' | 'mixed' | 'other';
  externalExamCode: string | null;
  displayOrder: number;
  nameSnapshot: string;
};

type MutableRoundSubject = {
  id: number;
  codeSnapshot: string | null;
  status: 'active' | 'inactive' | 'cancelled';
  isRequired: boolean;
  allowSeparateRegistration: boolean;
  fee: string | null;
  displayOrder: number;
  calculationMethodSnapshot: 'total' | 'average' | 'all_components_pass' | 'custom';
  requiredAggregateScoreSnapshot: string | null;
  requireAllComponentsSnapshot: boolean;
  ruleDescriptionSnapshot: string | null;
  nameSnapshot: string;
  components: MutableRoundComponent[];
};

type MutableExamRoundStructure = {
  round: {
    id: number;
    documentId: string | null;
    code: string;
    status: string;
    paymentCalculationMethod: 'fixed' | 'program_fee' | 'subject_fee' | 'component_fee';
    fixedFee: string | null;
    allowSubjectSelection: boolean;
    allowComponentSelection: boolean;
  };
  subjects: MutableRoundSubject[];
  orphanComponentIds: number[];
};

type WorkflowValidationError = {
  status: number;
  path: string;
  code: string;
  message: string;
  details?: Record<string, unknown> | null;
};

type WorkflowNoteInput = {
  note: string | null;
};

type WorkflowReturnInput = {
  reason: string;
};

type VenueRoomConfigurationInput = {
  venueIds: number[];
  roomIds: number[];
};

type OptionalReasonInput = {
  reason: string | null;
};

type RequiredPauseReasonInput = {
  reason: string;
};

type RegistrationWindowState = 'before_registration_window' | 'within_registration_window' | 'after_registration_window';
type RegistrationWindowStatus = 'before' | 'within' | 'after';

type EligibilityStatus = 'pending' | 'eligible' | 'temporarily_ineligible' | 'ineligible';
type EligibilitySource = 'synchronized' | 'imported' | 'manual' | 'rule_based';
type DuplicateHandling = 'reject' | 'skip' | 'update';

export type CurrentLearner = {
  id: number;
  documentId?: string | null;
  code: string;
  fullName: string;
  dateOfBirth?: string | null;
  learnerStatus: string;
  className: string | null;
  cohort: string | null;
  major: string | null;
};

type LearnerSupportInfo = {
  organizationName: string | null;
  supportPhone: string | null;
  supportEmail: string | null;
  supportWebsite: string | null;
  supportNote: string | null;
};

type CreateLearnerProfileInput = {
  code: string;
  fullName: string;
  dateOfBirth: string;
  phone: string;
  email: string;
};

type SelfRegistrationInput = {
  subjectIds: number[];
  componentIds: number[];
  note: string | null;
  hasSubjectIds: boolean;
  hasComponentIds: boolean;
};

type SubjectSelection = {
  subject: MutableRoundSubject;
  components: MutableRoundComponent[];
};

type FeeBreakdownSubject = {
  examRoundSubjectId: number;
  codeSnapshot: string | null;
  nameSnapshot: string;
  amount: number;
  isRequired: boolean;
};

type FeeBreakdownComponent = {
  examRoundComponentId: number;
  examRoundSubjectId: number;
  codeSnapshot: string | null;
  nameSnapshot: string;
  amount: number;
  isRequired: boolean;
};

type FeeSummary = {
  currency: 'VND';
  calculationMethod: 'fixed' | 'program_fee' | 'subject_fee' | 'component_fee';
  fixedFee: number | null;
  subjectFeeTotal: number;
  componentFeeTotal: number;
  calculatedAmount: number;
  discountAmount: number;
  payableAmount: number;
  confirmedPaidAmount: number;
  paymentStatus: 'unpaid' | 'not_required';
  subjects: FeeBreakdownSubject[];
  components: FeeBreakdownComponent[];
};

type RegistrationPaymentSnapshot = {
  paymentRequired: boolean;
  paymentConfigured: boolean;
  paymentMethod: 'bank_transfer' | 'cash' | 'other' | null;
  paymentProfileName: string | null;
  paymentProfileCode: string | null;
  bankCode: string | null;
  bankName: string | null;
  accountNumber: string | null;
  accountHolder: string | null;
  bankBranch: string | null;
  currency: string | null;
  transferContentTemplate: string | null;
  transferContent: string | null;
  paymentInstruction: string | null;
  supportPhone: string | null;
  supportEmail: string | null;
  qrImage: ReturnType<typeof mapPaymentProfileMedia>;
};

type PaymentEvidenceSummary = {
  id: number;
  name: string | null;
  url: string | null;
  mimeType: string | null;
  provider: string | null;
  fileAssetId: number;
};

type PaymentReportSummary = {
  canReport: boolean;
  reportedAt: string | null;
  reportedByUserId: number | null;
  transferAt: string | null;
  senderName: string | null;
  maskedSenderAccount: string | null;
  senderBank: string | null;
  transactionReference: string | null;
  note: string | null;
  evidence: PaymentEvidenceSummary | null;
  confirmedAt: string | null;
  rejectedAt: string | null;
  rejectionReason: string | null;
};

type ReportPaymentInput = {
  paymentTransferAt: string;
  paymentSenderName: string;
  paymentSenderAccount: string | null;
  paymentSenderBank: string | null;
  paymentTransactionReference: string | null;
  paymentReportNote: string | null;
  paymentEvidenceId: number | null;
};

type ConfirmPaymentInput = {
  confirmationNote: string | null;
};

type RejectPaymentReportInput = {
  reason: string;
};

type ExamRoundPaymentListQuery = {
  page: number;
  pageSize: number;
  keyword: string | null;
  paymentStatus: string | null;
  registrationStatus: string | null;
  paymentMethod: string | null;
  hasEvidence: boolean | null;
  reportedFrom: string | null;
  reportedTo: string | null;
  confirmedFrom: string | null;
  confirmedTo: string | null;
  sort: Array<Record<string, 'asc' | 'desc'>>;
};

type EligibilityDecision = {
  status: EligibilityStatus | null;
  reason: string | null;
  canRegister: boolean;
  reasonCode: string | null;
};

type CreateEligibilityInput = {
  learnerId: number;
  eligibilityStatus: EligibilityStatus;
  source: EligibilitySource;
  reason: string | null;
  note: string | null;
};

type BulkEligibilityItemInput = {
  learnerId: number;
  eligibilityStatus: EligibilityStatus;
  reason: string | null;
  note: string | null;
};

type BulkCreateEligibilitiesInput = {
  items: BulkEligibilityItemInput[];
  source: EligibilitySource;
  duplicateHandling: DuplicateHandling;
};

type LearnerEligibilityLookupQuery = {
  page: number;
  pageSize: number;
  search: string;
  excludeExisting: boolean;
};

const EXAM_COMPONENT_LIST_POPULATE = {
  tenant: {
    select: ['id', 'name', 'code'],
  },
};

const EXAM_SUBJECT_LIST_FIELDS = ['id', 'documentId', 'code', 'name', 'calculationMethod', 'requiredAggregateScore', 'requireAllComponents', 'defaultFee', 'ruleDescription', 'isActive', 'createdAt', 'updatedAt'] as const;
const EXAM_PROGRAM_LIST_FIELDS = ['id', 'documentId', 'code', 'name', 'passingMethod', 'feeCalculationMethod', 'defaultFee', 'targetDescription', 'validFrom', 'validTo', 'isActive', 'createdAt', 'updatedAt'] as const;
const OUTCOME_STANDARD_LIST_FIELDS = ['id', 'documentId', 'code', 'name', 'applicableDescription', 'recognitionMethod', 'validFrom', 'validTo', 'isActive', 'createdAt', 'updatedAt'] as const;

function buildExamRoundManagementWhere(query: Record<string, unknown>) {
  const whereClauses: Array<Record<string, unknown>> = [];
  const keyword = toText(query?.search ?? query?.q);
  const status = toText(query?.status).toLowerCase();
  const examProgramId = toText(query?.examProgramId);
  const registrationMode = toText(query?.registrationMode).toLowerCase();
  const registrationStartFrom = normalizeText(query?.registrationStartFrom) || normalizeText(query?.['filters[registrationStartAt][$gte]']);
  const registrationStartTo = normalizeText(query?.registrationStartTo) || normalizeText(query?.['filters[registrationStartAt][$lte]']);

  if (keyword) {
    whereClauses.push({
      $or: [
        { code: { $containsi: keyword } },
        { name: { $containsi: keyword } },
      ],
    });
  }

  if (status) whereClauses.push({ status: { $eq: status } });
  if (registrationMode) whereClauses.push({ registrationMode: { $eq: registrationMode } });

  if (examProgramId) {
    const parsed = Number(examProgramId);
    whereClauses.push(Number.isInteger(parsed) && parsed > 0
      ? { examProgram: { id: { $eq: parsed } } }
      : { examProgram: { documentId: { $eq: examProgramId } } });
  }

  if (registrationStartFrom) {
    whereClauses.push({ registrationStartAt: { $gte: registrationStartFrom } });
  }
  if (registrationStartTo) {
    whereClauses.push({ registrationStartAt: { $lte: registrationStartTo } });
  }

  if (whereClauses.length === 0) return {};
  if (whereClauses.length === 1) return whereClauses[0];
  return { $and: whereClauses };
}

export async function listExamRoundsManagement(query: Record<string, unknown> = {}, tenantId: number) {
  const pagination = (query?.pagination && typeof query.pagination === 'object' && !Array.isArray(query.pagination))
    ? (query.pagination as Record<string, unknown>)
    : {};
  const page = toPositiveInt(query?.page ?? query?.['pagination[page]'] ?? pagination.page, 1);
  const pageSize = Math.min(100, toPositiveInt(query?.pageSize ?? query?.['pagination[pageSize]'] ?? pagination.pageSize, 10));
  const where = mergeTenantWhere(buildExamRoundManagementWhere(query), tenantId);

  const [rows, total] = await Promise.all([
    strapi.db.query(EXAM_ROUND_UID).findMany({
      where,
      select: ['id', 'documentId', 'code', 'name', 'academicYear', 'semester', 'status', 'registrationMode', 'registrationStartAt', 'registrationEndAt', 'examStartAt', 'examEndAt', 'paymentCalculationMethod', 'fixedFee', 'updatedAt', 'createdAt'],
      populate: {
        examProgram: {
          select: ['id', 'documentId', 'code', 'name'],
        },
      },
      orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
      offset: (page - 1) * pageSize,
      limit: pageSize,
    }),
    strapi.db.query(EXAM_ROUND_UID).count({ where }),
  ]);

  return {
    rows,
    pagination: {
      page,
      pageSize,
      total,
      pageCount: Math.max(1, Math.ceil(total / pageSize)),
    },
  };
}

export async function getExamRoundManagementDetail(roundId: unknown, tenantId: number, transacting?: any) {
  const where = whereByParam(roundId);
  if (!where) return null;

  return strapi.db.query(EXAM_ROUND_UID).findOne({
    where: mergeTenantWhere(where, tenantId),
    populate: {
      examProgram: {
        select: ['id', 'documentId', 'code', 'name'],
      },
      submittedBy: { select: ['id', 'username', 'fullName', 'email'] },
      approvedBy: { select: ['id', 'username', 'fullName', 'email'] },
      returnedBy: { select: ['id', 'username', 'fullName', 'email'] },
      registrationOpenedBy: { select: ['id', 'username', 'fullName', 'email'] },
      registrationPausedBy: { select: ['id', 'username', 'fullName', 'email'] },
      registrationResumedBy: { select: ['id', 'username', 'fullName', 'email'] },
      registrationClosedBy: { select: ['id', 'username', 'fullName', 'email'] },
      paymentProfile: {
        select: ['id', 'documentId', 'name', 'code', 'paymentMethod', 'bankCode', 'bankName', 'accountNumber', 'accountHolder', 'bankBranch', 'currency', 'transferContentTemplate', 'paymentInstruction', 'supportPhone', 'supportEmail', 'isActive', 'isDefault', 'sortOrder'],
        populate: {
          qrImage: { select: ['id', 'name', 'url', 'mime'] },
        },
      },
      paymentProfileAppliedBy: { select: ['id', 'username', 'fullName', 'email'] },
      paymentSettingsUpdatedBy: { select: ['id', 'username', 'fullName', 'email'] },
      paymentQrImageSnapshot: { select: ['id', 'name', 'url', 'mime'] },
      examRoundSubjects: {
        select: ['id', 'nameSnapshot', 'status', 'isRequired', 'allowSeparateRegistration', 'fee', 'displayOrder', 'calculationMethodSnapshot', 'requiredAggregateScoreSnapshot', 'requireAllComponentsSnapshot', 'ruleDescriptionSnapshot'],
      },
      examRoundComponents: {
        select: ['id', 'nameSnapshot', 'status', 'isRequired', 'allowSeparateRegistration', 'minimumScoreSnapshot', 'maximumScoreSnapshot', 'passingScoreSnapshot', 'eliminationScoreSnapshot', 'durationMinutes', 'fee', 'examMethod', 'externalExamCode', 'displayOrder'],
        populate: {
          examRoundSubject: {
            select: ['id'],
          },
        },
      },
    },
    ...(transacting ? { transacting } : {}),
  });
}

function buildExamConfigurationProgramWhere(query: Record<string, unknown>) {
  const whereClauses: Array<Record<string, unknown>> = [];
  const keyword = toText(query?.search ?? query?.q);
  const activeFilter = toText(query?.isActive).toLowerCase();
  const feeCalculationMethod = toText(query?.feeCalculationMethod).toLowerCase();

  if (keyword) {
    whereClauses.push({
      $or: [
        { code: { $containsi: keyword } },
        { name: { $containsi: keyword } },
      ],
    });
  }

  if (activeFilter === 'true' || activeFilter === 'false') {
    whereClauses.push({ isActive: { $eq: activeFilter === 'true' } });
  }

  if (feeCalculationMethod && feeCalculationMethod !== 'all') {
    whereClauses.push({ feeCalculationMethod: { $eq: feeCalculationMethod } });
  }

  if (whereClauses.length === 0) return {};
  if (whereClauses.length === 1) return whereClauses[0];
  return { $and: whereClauses };
}

function normalizeExamProgramRow(row: any, programSubjectCountMap: Map<number, number>) {
  return {
    ...row,
    programSubjectCount: programSubjectCountMap.get(Number(row?.id || 0)) ?? null,
  };
}

async function countProgramSubjectsByProgramIds(tenantId: number, programIds: number[]) {
  if (!programIds.length) return new Map<number, number>();

  const rows = await strapi.db.query(EXAM_PROGRAM_SUBJECT_UID).findMany({
    where: mergeTenantWhere({
      examProgram: {
        id: {
          $in: programIds,
        },
      },
    }, tenantId),
    select: ['id'],
    populate: {
      examProgram: {
        select: ['id'],
      },
    },
  }) as any[];

  const countMap = new Map<number, number>();
  for (const row of rows) {
    const programId = Number(extractRelationRef(row?.examProgram) || row?.examProgram?.id || 0);
    if (!programId) continue;
    countMap.set(programId, (countMap.get(programId) || 0) + 1);
  }

  return countMap;
}

export async function listExamConfigurationPrograms(query: Record<string, unknown> = {}, tenantId: number) {
  const page = toPositiveInt(query?.page, 1);
  const pageSize = Math.min(100, toPositiveInt(query?.pageSize, 10));
  const where = mergeTenantWhere(buildExamConfigurationProgramWhere(query), tenantId);
  const sort = normalizeSortInput(query?.sort);

  const [rows, total] = await Promise.all([
    strapi.db.query(EXAM_PROGRAM_UID).findMany({
      where,
      select: [...EXAM_PROGRAM_LIST_FIELDS],
      orderBy: sort.length > 0 ? sort : [{ code: 'asc' }, { name: 'asc' }, { id: 'asc' }],
      offset: (page - 1) * pageSize,
      limit: pageSize,
    }),
    strapi.db.query(EXAM_PROGRAM_UID).count({ where }),
  ]);

  const programIds = rows.map((row: any) => Number(row?.id || 0)).filter((value: number) => Number.isInteger(value) && value > 0);
  const programSubjectCountMap = await countProgramSubjectsByProgramIds(tenantId, programIds);

  return {
    rows: rows.map((row: any) => normalizeExamProgramRow(row, programSubjectCountMap)),
    pagination: {
      page,
      pageSize,
      total,
      pageCount: Math.max(1, Math.ceil(total / pageSize)),
    },
  };
}

export async function getExamConfigurationProgramDetail(programId: unknown, tenantId: number) {
  const where = whereByParam(programId);
  if (!where) return null;

  const program = await strapi.db.query(EXAM_PROGRAM_UID).findOne({
    where: mergeTenantWhere(where, tenantId),
    select: [...EXAM_PROGRAM_LIST_FIELDS],
  }) as any;

  if (!program?.id) {
    return null;
  }

  const programSubjects = await strapi.db.query(EXAM_PROGRAM_SUBJECT_UID).findMany({
    where: mergeTenantWhere({
      examProgram: {
        id: {
          $eq: Number(program.id),
        },
      },
    }, tenantId),
    select: ['id', 'displayOrder', 'isRequired', 'feeOverride'],
    populate: {
      examSubject: {
        select: ['id', 'documentId', 'code', 'name', 'calculationMethod', 'requiredAggregateScore', 'requireAllComponents', 'defaultFee', 'ruleDescription', 'isActive'],
      },
    },
    orderBy: [{ displayOrder: 'asc' }, { id: 'asc' }],
  }) as any[];

  return {
    ...program,
    programSubjectCount: programSubjects.length,
    programSubjects,
  };
}

function buildExamConfigurationOutcomeWhere(query: Record<string, unknown>) {
  const whereClauses: Array<Record<string, unknown>> = [];
  const keyword = toText(query?.search ?? query?.q);
  const activeFilter = toText(query?.isActive).toLowerCase();
  const recognitionMethod = toText(query?.recognitionMethod).toLowerCase();
  const examProgramId = toText(query?.examProgramId);

  if (keyword) {
    whereClauses.push({
      $or: [
        { code: { $containsi: keyword } },
        { name: { $containsi: keyword } },
      ],
    });
  }

  if (activeFilter === 'true' || activeFilter === 'false') {
    whereClauses.push({ isActive: { $eq: activeFilter === 'true' } });
  }

  if (recognitionMethod && recognitionMethod !== 'all') {
    whereClauses.push({ recognitionMethod: { $eq: recognitionMethod } });
  }

  if (examProgramId) {
    const parsedId = Number(examProgramId);
    whereClauses.push(Number.isInteger(parsedId) && parsedId > 0
      ? { examProgram: { id: { $eq: parsedId } } }
      : { examProgram: { documentId: { $eq: examProgramId } } });
  }

  if (whereClauses.length === 0) return {};
  if (whereClauses.length === 1) return whereClauses[0];
  return { $and: whereClauses };
}

export async function listExamConfigurationOutcomes(query: Record<string, unknown> = {}, tenantId: number) {
  const page = toPositiveInt(query?.page, 1);
  const pageSize = Math.min(100, toPositiveInt(query?.pageSize, 10));
  const where = mergeTenantWhere(buildExamConfigurationOutcomeWhere(query), tenantId);
  const sort = normalizeSortInput(query?.sort);

  const [rows, total] = await Promise.all([
    strapi.db.query(OUTCOME_STANDARD_UID).findMany({
      where,
      select: [...OUTCOME_STANDARD_LIST_FIELDS],
      populate: {
        examProgram: {
          select: ['id', 'documentId', 'code', 'name', 'isActive'],
        },
      },
      orderBy: sort.length > 0 ? sort : [{ code: 'asc' }, { name: 'asc' }, { id: 'asc' }],
      offset: (page - 1) * pageSize,
      limit: pageSize,
    }),
    strapi.db.query(OUTCOME_STANDARD_UID).count({ where }),
  ]);

  return {
    rows,
    pagination: {
      page,
      pageSize,
      total,
      pageCount: Math.max(1, Math.ceil(total / pageSize)),
    },
  };
}

export async function getExamConfigurationOutcomeDetail(outcomeId: unknown, tenantId: number) {
  const where = whereByParam(outcomeId);
  if (!where) return null;

  return strapi.db.query(OUTCOME_STANDARD_UID).findOne({
    where: mergeTenantWhere(where, tenantId),
    select: [...OUTCOME_STANDARD_LIST_FIELDS],
    populate: {
      examProgram: {
        select: ['id', 'documentId', 'code', 'name', 'passingMethod', 'feeCalculationMethod', 'defaultFee', 'isActive'],
      },
    },
  });
}

function normalizeExamProgramPassingMethod(value: unknown, options: { required?: boolean } = {}): typeof EXAM_PROGRAM_PASSING_METHODS[number] | undefined {
  const normalized = normalizeText(value).toLowerCase();
  if (!normalized) {
    if (options.required) return 'all_subjects_pass';
    return undefined;
  }

  if (!EXAM_PROGRAM_PASSING_METHODS.includes(normalized as typeof EXAM_PROGRAM_PASSING_METHODS[number])) {
    httpError(400, 'passingMethod is invalid', 'INVALID_PROGRAM_PASSING_METHOD', { path: 'passingMethod' });
  }

  return normalized as typeof EXAM_PROGRAM_PASSING_METHODS[number];
}

function normalizeExamProgramFeeMethod(value: unknown, options: { required?: boolean } = {}): typeof EXAM_PROGRAM_FEE_METHODS[number] | undefined {
  const normalized = normalizeText(value).toLowerCase();
  if (!normalized) {
    if (options.required) return 'sum_subject_fees';
    return undefined;
  }

  if (!EXAM_PROGRAM_FEE_METHODS.includes(normalized as typeof EXAM_PROGRAM_FEE_METHODS[number])) {
    httpError(400, 'feeCalculationMethod is invalid', 'INVALID_PAYMENT_CALCULATION_METHOD', { path: 'feeCalculationMethod' });
  }

  return normalized as typeof EXAM_PROGRAM_FEE_METHODS[number];
}

function normalizeExamProgramWriteInput(payload: Record<string, unknown>, options: { partial?: boolean } = {}): ExamProgramWriteInput {
  ensureNoUnknownFields(payload, EXAM_PROGRAM_ALLOWED_FIELDS, 'examProgram');

  const partial = options.partial === true;
  const input: ExamProgramWriteInput = {};

  if (!partial || hasOwn(payload, 'code')) {
    input.code = normalizeRequiredText(payload.code, 'code', 100);
  }

  if (!partial || hasOwn(payload, 'name')) {
    input.name = normalizeRequiredText(payload.name, 'name', 200);
  }

  if (!partial || hasOwn(payload, 'passingMethod')) {
    input.passingMethod = normalizeExamProgramPassingMethod(payload.passingMethod, { required: !partial });
  }

  if (!partial || hasOwn(payload, 'feeCalculationMethod')) {
    input.feeCalculationMethod = normalizeExamProgramFeeMethod(payload.feeCalculationMethod, { required: !partial });
  }

  if (hasOwn(payload, 'defaultFee')) {
    input.defaultFee = parseDecimalInput(payload.defaultFee, 'defaultFee', { min: 0 });
  } else if (!partial) {
    input.defaultFee = null;
  }

  if (hasOwn(payload, 'targetDescription')) {
    input.targetDescription = normalizeOptionalText(payload.targetDescription);
  } else if (!partial) {
    input.targetDescription = null;
  }

  if (hasOwn(payload, 'validFrom')) {
    input.validFrom = parseDateTime(payload.validFrom, 'validFrom');
  } else if (!partial) {
    input.validFrom = null;
  }

  if (hasOwn(payload, 'validTo')) {
    input.validTo = parseDateTime(payload.validTo, 'validTo');
  } else if (!partial) {
    input.validTo = null;
  }

  if (hasOwn(payload, 'isActive')) {
    input.isActive = normalizeExamComponentBoolean(payload.isActive, 'isActive');
  } else if (!partial) {
    input.isActive = true;
  }

  return input;
}

function validateExamProgramBusinessRules(values: {
  feeCalculationMethod: typeof EXAM_PROGRAM_FEE_METHODS[number];
  defaultFee: string | null;
  validFrom: string | null;
  validTo: string | null;
}) {
  const defaultFee = decimalToNumber(values.defaultFee);

  if (values.feeCalculationMethod === 'fixed' && defaultFee === null) {
    httpError(400, 'defaultFee is required when feeCalculationMethod is fixed', 'FIXED_FEE_REQUIRED', { path: 'defaultFee' });
  }

  if (defaultFee !== null && defaultFee < 0) {
    httpError(400, 'defaultFee must be at least 0', 'INVALID_FIXED_FEE', { path: 'defaultFee' });
  }

  if (values.validFrom && values.validTo && Date.parse(values.validFrom) > Date.parse(values.validTo)) {
    httpError(400, 'validFrom cannot be after validTo', 'INVALID_DATE_RANGE', { path: 'validFrom' });
  }
}

async function ensureExamProgramCodeUnique(tenantId: number, code: string, currentId?: number) {
  const duplicate = await strapi.db.query(EXAM_PROGRAM_UID).findOne({
    where: mergeTenantWhere({ code: { $eqi: code } }, tenantId),
    select: ['id', 'code'],
  });

  if (duplicate?.id && duplicate.id !== currentId) {
    httpError(409, 'Exam program code already exists', 'EXAM_PROGRAM_CODE_EXISTS', { path: 'code', value: code });
  }
}

function buildExamProgramWriteData(input: ExamProgramWriteInput) {
  const data: Record<string, unknown> = {};
  if (typeof input.code === 'string') data.code = input.code;
  if (typeof input.name === 'string') data.name = input.name;
  if (typeof input.passingMethod !== 'undefined') data.passingMethod = input.passingMethod;
  if (typeof input.feeCalculationMethod !== 'undefined') data.feeCalculationMethod = input.feeCalculationMethod;
  if (typeof input.defaultFee !== 'undefined') data.defaultFee = input.defaultFee;
  if (typeof input.targetDescription !== 'undefined') data.targetDescription = input.targetDescription;
  if (typeof input.validFrom !== 'undefined') data.validFrom = input.validFrom;
  if (typeof input.validTo !== 'undefined') data.validTo = input.validTo;
  if (typeof input.isActive !== 'undefined') data.isActive = input.isActive;
  return data;
}

function normalizeOutcomeRecognitionMethod(value: unknown, options: { required?: boolean } = {}): OutcomeStandardWriteInput['recognitionMethod'] | undefined {
  const allowed = ['exam_program', 'certificate', 'exemption', 'equivalent_result', 'multiple_methods'] as const;
  const normalized = normalizeText(value).toLowerCase() as OutcomeStandardWriteInput['recognitionMethod'];
  if (!normalized) {
    if (options.required) return 'exam_program';
    return undefined;
  }
  if (!allowed.includes(normalized as any)) {
    httpError(400, 'recognitionMethod is invalid', 'INVALID_OUTCOME_STANDARD_CONFIGURATION', { path: 'recognitionMethod' });
  }
  return normalized;
}

function normalizeOutcomeStandardWriteInput(payload: Record<string, unknown>, options: { partial?: boolean } = {}): OutcomeStandardWriteInput {
  const allowedFields = ['code', 'name', 'examProgram', 'applicableDescription', 'recognitionMethod', 'validFrom', 'validTo', 'isActive'];
  ensureNoUnknownFields(payload, allowedFields, 'outcomeStandard');
  const partial = options.partial === true;
  const input: OutcomeStandardWriteInput = {};

  if (!partial || hasOwn(payload, 'code')) input.code = normalizeRequiredText(payload.code, 'code', 100);
  if (!partial || hasOwn(payload, 'name')) input.name = normalizeRequiredText(payload.name, 'name', 200);
  if (!partial || hasOwn(payload, 'recognitionMethod')) input.recognitionMethod = normalizeOutcomeRecognitionMethod(payload.recognitionMethod, { required: !partial });
  if (hasOwn(payload, 'applicableDescription')) input.applicableDescription = normalizeOptionalText(payload.applicableDescription);
  else if (!partial) input.applicableDescription = null;
  if (hasOwn(payload, 'validFrom')) input.validFrom = parseDateTime(payload.validFrom, 'validFrom');
  else if (!partial) input.validFrom = null;
  if (hasOwn(payload, 'validTo')) input.validTo = parseDateTime(payload.validTo, 'validTo');
  else if (!partial) input.validTo = null;
  if (hasOwn(payload, 'isActive')) input.isActive = normalizeExamComponentBoolean(payload.isActive, 'isActive');
  else if (!partial) input.isActive = true;
  if (hasOwn(payload, 'examProgram')) {
    const relationRef = extractRelationRef(payload.examProgram);
    input.examProgram = relationRef ?? null;
  } else if (!partial) {
    input.examProgram = null;
  }

  return input;
}

async function resolveOutcomeProgramRef(tenantId: number, ref: unknown) {
  const where = whereByParam(ref);
  if (!where) return null;
  return strapi.db.query(EXAM_PROGRAM_UID).findOne({
    where: mergeTenantWhere(where, tenantId),
    select: ['id', 'documentId', 'code', 'name', 'isActive'],
  }) as any;
}

function validateOutcomeStandardBusinessRules(values: { validFrom: string | null; validTo: string | null }) {
  if (values.validFrom && values.validTo && Date.parse(values.validFrom) > Date.parse(values.validTo)) {
    httpError(400, 'validFrom cannot be after validTo', 'INVALID_EFFECTIVE_DATE_RANGE', { path: 'validFrom' });
  }
}

async function ensureOutcomeStandardCodeUnique(tenantId: number, code: string, currentId?: number) {
  const duplicate = await strapi.db.query(OUTCOME_STANDARD_UID).findOne({
    where: mergeTenantWhere({ code: { $eqi: code } }, tenantId),
    select: ['id', 'code'],
  });
  if (duplicate?.id && duplicate.id !== currentId) {
    httpError(409, 'Outcome standard code already exists', 'OUTCOME_STANDARD_CODE_EXISTS', { path: 'code', value: code });
  }
}

function buildOutcomeStandardWriteData(input: OutcomeStandardWriteInput, examProgramId?: number | null) {
  const data: Record<string, unknown> = {};
  if (typeof input.code === 'string') data.code = input.code;
  if (typeof input.name === 'string') data.name = input.name;
  if (typeof input.applicableDescription !== 'undefined') data.applicableDescription = input.applicableDescription;
  if (typeof input.recognitionMethod !== 'undefined') data.recognitionMethod = input.recognitionMethod;
  if (typeof input.validFrom !== 'undefined') data.validFrom = input.validFrom;
  if (typeof input.validTo !== 'undefined') data.validTo = input.validTo;
  if (typeof input.isActive !== 'undefined') data.isActive = input.isActive;
  if (typeof examProgramId !== 'undefined') data.examProgram = examProgramId;
  return data;
}

export async function createExamConfigurationOutcome(tenantId: number, payload: Record<string, unknown>, _authUser: AuthUser) {
  const input = normalizeOutcomeStandardWriteInput(payload, { partial: false });
  validateOutcomeStandardBusinessRules({ validFrom: input.validFrom || null, validTo: input.validTo || null });
  await ensureOutcomeStandardCodeUnique(tenantId, input.code || '');

  let examProgramId: number | null = null;
  if (input.examProgram !== null && typeof input.examProgram !== 'undefined') {
    const examProgram = await resolveOutcomeProgramRef(tenantId, input.examProgram);
    if (!examProgram?.id) {
      httpError(404, 'Exam program not found', 'EXAM_PROGRAM_NOT_FOUND', { path: 'examProgram' });
    }
    examProgramId = Number(examProgram.id);
  }

  const created = await strapi.db.query(OUTCOME_STANDARD_UID).create({
    data: {
      ...buildOutcomeStandardWriteData({ ...input, recognitionMethod: input.recognitionMethod || 'exam_program' }, examProgramId),
      tenant: tenantId,
    },
  });

  return getExamConfigurationOutcomeDetail(created?.id, tenantId);
}

export async function updateExamConfigurationOutcome(tenantId: number, outcomeId: unknown, payload: Record<string, unknown>, _authUser: AuthUser) {
  const current = await getExamConfigurationOutcomeDetail(outcomeId, tenantId);
  if (!current?.id) {
    httpError(404, 'Outcome standard not found', 'OUTCOME_STANDARD_NOT_FOUND');
  }

  const input = normalizeOutcomeStandardWriteInput(payload, { partial: true });
  validateOutcomeStandardBusinessRules({
    validFrom: typeof input.validFrom !== 'undefined' ? input.validFrom : normalizeText(current.validFrom) || null,
    validTo: typeof input.validTo !== 'undefined' ? input.validTo : normalizeText(current.validTo) || null,
  });

  const nextCode = typeof input.code === 'string' ? input.code : normalizeText(current.code);
  await ensureOutcomeStandardCodeUnique(tenantId, nextCode, Number(current.id));

  let examProgramId: number | null | undefined;
  if (typeof input.examProgram !== 'undefined') {
    if (input.examProgram === null) {
      examProgramId = null;
    } else {
      const examProgram = await resolveOutcomeProgramRef(tenantId, input.examProgram);
      if (!examProgram?.id) {
        httpError(404, 'Exam program not found', 'EXAM_PROGRAM_NOT_FOUND', { path: 'examProgram' });
      }
      examProgramId = Number(examProgram.id);
    }
  }

  const data = buildOutcomeStandardWriteData({
    ...input,
    recognitionMethod: typeof input.recognitionMethod !== 'undefined' ? input.recognitionMethod : normalizeOutcomeRecognitionMethod(current.recognitionMethod, { required: true }) || 'exam_program',
  }, examProgramId);
  if (Object.keys(data).length === 0) {
    return current;
  }

  await strapi.db.query(OUTCOME_STANDARD_UID).update({
    where: { id: Number(current.id) },
    data,
  });

  return getExamConfigurationOutcomeDetail(current.id, tenantId);
}

function buildExamConfigurationSubjectWhere(query: Record<string, unknown>) {
  const whereClauses: Array<Record<string, unknown>> = [];
  const keyword = toText(query?.search ?? query?.q);
  const activeFilter = toText(query?.isActive).toLowerCase();
  const calculationMethod = toText(query?.calculationMethod).toLowerCase();

  if (keyword) {
    whereClauses.push({
      $or: [
        { code: { $containsi: keyword } },
        { name: { $containsi: keyword } },
      ],
    });
  }

  if (activeFilter === 'true' || activeFilter === 'false') {
    whereClauses.push({ isActive: { $eq: activeFilter === 'true' } });
  }

  if (calculationMethod && calculationMethod !== 'all') {
    whereClauses.push({ calculationMethod: { $eq: calculationMethod } });
  }

  if (whereClauses.length === 0) return {};
  if (whereClauses.length === 1) return whereClauses[0];
  return { $and: whereClauses };
}

function normalizeExamSubjectRow(row: any, subjectComponentCountMap: Map<number, number>) {
  return {
    ...row,
    subjectComponentCount: subjectComponentCountMap.get(Number(row?.id || 0)) ?? null,
  };
}

async function countSubjectComponentsBySubjectIds(tenantId: number, subjectIds: number[]) {
  if (!subjectIds.length) return new Map<number, number>();

  const rows = await strapi.db.query(EXAM_SUBJECT_COMPONENT_UID).findMany({
    where: mergeTenantWhere({
      examSubject: {
        id: {
          $in: subjectIds,
        },
      },
    }, tenantId),
    select: ['id'],
    populate: {
      examSubject: {
        select: ['id'],
      },
    },
  }) as any[];

  const countMap = new Map<number, number>();
  for (const row of rows) {
    const subjectId = Number(extractRelationRef(row?.examSubject) || row?.examSubject?.id || 0);
    if (!subjectId) continue;
    countMap.set(subjectId, (countMap.get(subjectId) || 0) + 1);
  }

  return countMap;
}

export async function listExamConfigurationSubjects(query: Record<string, unknown> = {}, tenantId: number) {
  const page = toPositiveInt(query?.page, 1);
  const pageSize = Math.min(100, toPositiveInt(query?.pageSize, 10));
  const where = mergeTenantWhere(buildExamConfigurationSubjectWhere(query), tenantId);
  const sort = normalizeSortInput(query?.sort);

  const [rows, total] = await Promise.all([
    strapi.db.query(EXAM_SUBJECT_UID).findMany({
      where,
      select: [...EXAM_SUBJECT_LIST_FIELDS],
      orderBy: sort.length > 0 ? sort : [{ code: 'asc' }, { name: 'asc' }, { id: 'asc' }],
      offset: (page - 1) * pageSize,
      limit: pageSize,
    }),
    strapi.db.query(EXAM_SUBJECT_UID).count({ where }),
  ]);

  const subjectIds = rows.map((row: any) => Number(row?.id || 0)).filter((value: number) => Number.isInteger(value) && value > 0);
  const subjectComponentCountMap = await countSubjectComponentsBySubjectIds(tenantId, subjectIds);

  return {
    rows: rows.map((row: any) => normalizeExamSubjectRow(row, subjectComponentCountMap)),
    pagination: {
      page,
      pageSize,
      total,
      pageCount: Math.max(1, Math.ceil(total / pageSize)),
    },
  };
}

export async function getExamConfigurationSubjectDetail(subjectId: unknown, tenantId: number) {
  const where = whereByParam(subjectId);
  if (!where) return null;

  const subject = await strapi.db.query(EXAM_SUBJECT_UID).findOne({
    where: mergeTenantWhere(where, tenantId),
    select: [...EXAM_SUBJECT_LIST_FIELDS],
  }) as any;

  if (!subject?.id) {
    return null;
  }

  const subjectComponents = await strapi.db.query(EXAM_SUBJECT_COMPONENT_UID).findMany({
    where: mergeTenantWhere({
      examSubject: {
        id: {
          $eq: Number(subject.id),
        },
      },
    }, tenantId),
    select: ['id', 'displayOrder', 'isRequired', 'weight', 'passingScoreOverride', 'eliminationScoreOverride', 'durationMinutesOverride'],
    populate: {
      examComponent: {
        select: ['id', 'documentId', 'code', 'name', 'componentType', 'minimumScore', 'maximumScore', 'passingScore', 'eliminationScore', 'defaultDurationMinutes', 'examMethod', 'isActive'],
      },
    },
    orderBy: [{ displayOrder: 'asc' }, { id: 'asc' }],
  }) as any[];

  return {
    ...subject,
    subjectComponentCount: subjectComponents.length,
    subjectComponents,
  };
}

function normalizeExamSubjectMethod(value: unknown, options: { required?: boolean } = {}): typeof EXAM_SUBJECT_ALLOWED_METHODS[number] | undefined {
  const normalized = normalizeText(value).toLowerCase();
  if (!normalized) {
    if (options.required) return 'total';
    return undefined;
  }

  if (!EXAM_SUBJECT_ALLOWED_METHODS.includes(normalized as typeof EXAM_SUBJECT_ALLOWED_METHODS[number])) {
    httpError(400, 'calculationMethod is invalid', 'INVALID_CALCULATION_METHOD', { path: 'calculationMethod' });
  }

  return normalized as typeof EXAM_SUBJECT_ALLOWED_METHODS[number];
}

function normalizeExamSubjectWriteInput(payload: Record<string, unknown>, options: { partial?: boolean } = {}): ExamSubjectWriteInput {
  ensureNoUnknownFields(payload, EXAM_SUBJECT_ALLOWED_FIELDS, 'examSubject');

  const partial = options.partial === true;
  const input: ExamSubjectWriteInput = {};

  if (!partial || hasOwn(payload, 'code')) {
    input.code = normalizeRequiredText(payload.code, 'code', 100);
  }

  if (!partial || hasOwn(payload, 'name')) {
    input.name = normalizeRequiredText(payload.name, 'name', 200);
  }

  if (!partial || hasOwn(payload, 'calculationMethod')) {
    input.calculationMethod = normalizeExamSubjectMethod(payload.calculationMethod, { required: !partial });
  }

  if (hasOwn(payload, 'requiredAggregateScore')) {
    input.requiredAggregateScore = parseDecimalInput(payload.requiredAggregateScore, 'requiredAggregateScore');
  } else if (!partial) {
    input.requiredAggregateScore = null;
  }

  if (hasOwn(payload, 'requireAllComponents')) {
    input.requireAllComponents = normalizeExamComponentBoolean(payload.requireAllComponents, 'requireAllComponents');
  } else if (!partial) {
    input.requireAllComponents = true;
  }

  if (hasOwn(payload, 'defaultFee')) {
    input.defaultFee = parseDecimalInput(payload.defaultFee, 'defaultFee', { min: 0 });
  } else if (!partial) {
    input.defaultFee = null;
  }

  if (hasOwn(payload, 'ruleDescription')) {
    input.ruleDescription = normalizeOptionalText(payload.ruleDescription);
  } else if (!partial) {
    input.ruleDescription = null;
  }

  if (hasOwn(payload, 'isActive')) {
    input.isActive = normalizeExamComponentBoolean(payload.isActive, 'isActive');
  } else if (!partial) {
    input.isActive = true;
  }

  return input;
}

function validateExamSubjectBusinessRules(values: {
  calculationMethod: typeof EXAM_SUBJECT_ALLOWED_METHODS[number];
  requiredAggregateScore: string | null;
  defaultFee: string | null;
}) {
  const requiredAggregateScore = decimalToNumber(values.requiredAggregateScore);
  const defaultFee = decimalToNumber(values.defaultFee);

  if ((values.calculationMethod === 'total' || values.calculationMethod === 'average') && requiredAggregateScore === null) {
    httpError(400, 'requiredAggregateScore is required', 'INVALID_SCORE_RANGE', { path: 'requiredAggregateScore' });
  }

  if (requiredAggregateScore !== null && requiredAggregateScore < 0) {
    httpError(400, 'requiredAggregateScore must be at least 0', 'INVALID_SCORE_RANGE', { path: 'requiredAggregateScore' });
  }

  if (defaultFee !== null && defaultFee < 0) {
    httpError(400, 'defaultFee must be at least 0', 'INVALID_DEFAULT_FEE', { path: 'defaultFee' });
  }
}

async function ensureExamSubjectCodeUnique(tenantId: number, code: string, currentId?: number) {
  const duplicate = await strapi.db.query(EXAM_SUBJECT_UID).findOne({
    where: mergeTenantWhere({ code: { $eqi: code } }, tenantId),
    select: ['id', 'code'],
  });

  if (duplicate?.id && duplicate.id !== currentId) {
    httpError(409, 'Exam subject code already exists', 'EXAM_SUBJECT_CODE_EXISTS', { path: 'code', value: code });
  }
}

function buildExamSubjectWriteData(input: ExamSubjectWriteInput) {
  const data: Record<string, unknown> = {};

  if (typeof input.code === 'string') data.code = input.code;
  if (typeof input.name === 'string') data.name = input.name;
  if (typeof input.calculationMethod !== 'undefined') data.calculationMethod = input.calculationMethod;
  if (typeof input.requiredAggregateScore !== 'undefined') data.requiredAggregateScore = input.requiredAggregateScore;
  if (typeof input.requireAllComponents !== 'undefined') data.requireAllComponents = input.requireAllComponents;
  if (typeof input.defaultFee !== 'undefined') data.defaultFee = input.defaultFee;
  if (typeof input.ruleDescription !== 'undefined') data.ruleDescription = input.ruleDescription;
  if (typeof input.isActive !== 'undefined') data.isActive = input.isActive;

  return data;
}

function buildExamConfigurationComponentWhere(query: Record<string, unknown>) {
  const whereClauses: Array<Record<string, unknown>> = [];
  const keyword = toText(query?.search ?? query?.q);
  const componentType = toText(query?.componentType).toLowerCase();
  const examMethod = toText(query?.examMethod).toLowerCase();
  const activeFilter = toText(query?.isActive).toLowerCase();

  if (keyword) {
    whereClauses.push({
      $or: [
        { code: { $containsi: keyword } },
        { name: { $containsi: keyword } },
        { description: { $containsi: keyword } },
      ],
    });
  }

  if (componentType && componentType !== 'all') {
    whereClauses.push({ componentType: { $eq: componentType } });
  }

  if (examMethod && examMethod !== 'all') {
    whereClauses.push({ examMethod: { $eq: examMethod } });
  }

  if (activeFilter === 'true' || activeFilter === 'false') {
    whereClauses.push({ isActive: { $eq: activeFilter === 'true' } });
  }

  if (whereClauses.length === 0) return {};
  if (whereClauses.length === 1) return whereClauses[0];
  return { $and: whereClauses };
}

export async function listExamConfigurationComponents(query: Record<string, unknown> = {}, tenantId: number) {
  const page = toPositiveInt(query?.page, 1);
  const pageSize = Math.min(100, toPositiveInt(query?.pageSize, 10));
  const where = mergeTenantWhere(buildExamConfigurationComponentWhere(query), tenantId);
  const sort = normalizeSortInput(query?.sort);

  const [rows, total] = await Promise.all([
    strapi.db.query(EXAM_COMPONENT_UID).findMany({
      where,
      populate: EXAM_COMPONENT_LIST_POPULATE,
      orderBy: sort.length > 0 ? sort : [{ displayOrder: 'asc' }, { name: 'asc' }, { id: 'asc' }],
      offset: (page - 1) * pageSize,
      limit: pageSize,
    }),
    strapi.db.query(EXAM_COMPONENT_UID).count({ where }),
  ]);

  return {
    rows,
    pagination: {
      page,
      pageSize,
      total,
      pageCount: Math.max(1, Math.ceil(total / pageSize)),
    },
  };
}

export async function getExamConfigurationComponentDetail(componentId: unknown, tenantId: number) {
  const where = whereByParam(componentId);
  if (!where) return null;

  return strapi.db.query(EXAM_COMPONENT_UID).findOne({
    where: mergeTenantWhere(where, tenantId),
    populate: EXAM_COMPONENT_LIST_POPULATE,
  });
}

type ExamComponentWriteInput = {
  code?: string;
  name?: string;
  description?: string | null;
  minimumScore?: string;
  maximumScore?: string;
  passingScore?: string | null;
  defaultDurationMinutes?: number | null;
  examMethod?: typeof EXAM_COMPONENT_ALLOWED_METHODS[number];
  isActive?: boolean;
};

type ExamSubjectWriteInput = {
  code?: string;
  name?: string;
  calculationMethod?: typeof EXAM_SUBJECT_ALLOWED_METHODS[number];
  requiredAggregateScore?: string | null;
  requireAllComponents?: boolean;
  defaultFee?: string | null;
  ruleDescription?: string | null;
  isActive?: boolean;
};

type ExamProgramWriteInput = {
  code?: string;
  name?: string;
  passingMethod?: typeof EXAM_PROGRAM_PASSING_METHODS[number];
  feeCalculationMethod?: typeof EXAM_PROGRAM_FEE_METHODS[number];
  defaultFee?: string | null;
  targetDescription?: string | null;
  validFrom?: string | null;
  validTo?: string | null;
  isActive?: boolean;
};

type OutcomeStandardWriteInput = {
  code?: string;
  name?: string;
  examProgram?: number | string | null;
  applicableDescription?: string | null;
  recognitionMethod?: 'exam_program' | 'certificate' | 'exemption' | 'equivalent_result' | 'multiple_methods';
  validFrom?: string | null;
  validTo?: string | null;
  isActive?: boolean;
};

type ReplaceExamSubjectComponentsInput = {
  componentIds: Array<number | string>;
};

type UpdateExamSubjectComponentInput = {
  isRequired?: boolean;
  weight?: string | null;
  passingScoreOverride?: string | null;
  eliminationScoreOverride?: string | null;
  durationMinutesOverride?: number | null;
};

type ReplaceExamProgramSubjectsInput = {
  subjectIds: Array<number | string>;
};

type UpdateExamProgramSubjectInput = {
  isRequired?: boolean;
  feeOverride?: string | null;
};

type UpdateEligibilityInput = {
  eligibilityStatus: EligibilityStatus;
  reason: string | null;
  note: string | null;
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
    httpError(400, `Text exceeds max length ${maxLength}`, 'INVALID_TEXT_LENGTH');
  }
  return text;
}

function normalizeRequiredText(value: unknown, fieldName: string, maxLength?: number): string {
  const text = normalizeText(value);
  if (!text) {
    httpError(400, `${fieldName} is required`, 'INVALID_REQUEST_BODY');
  }
  if (maxLength && text.length > maxLength) {
    httpError(400, `${fieldName} max length is ${maxLength}`, 'INVALID_REQUEST_BODY');
  }
  return text;
}

function normalizeEmail(value: unknown, fieldName: string): string {
  const text = normalizeText(value).toLowerCase();
  if (!text || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(text)) {
    httpError(400, `${fieldName} is invalid`, 'INVALID_EMAIL');
  }
  return text;
}

function normalizePhone(value: unknown, fieldName: string): string {
  const text = normalizeText(value);
  if (!text) {
    httpError(400, `${fieldName} is invalid`, 'INVALID_PHONE');
  }
  if (text.length > 30) {
    httpError(400, `${fieldName} is invalid`, 'INVALID_PHONE');
  }
  return text;
}

function normalizeDateOnly(value: unknown, fieldName: string): string {
  const text = normalizeText(value);
  if (!text) {
    httpError(400, `${fieldName} is invalid`, 'INVALID_DATE_OF_BIRTH');
  }
  const date = new Date(text);
  if (Number.isNaN(date.getTime())) {
    httpError(400, `${fieldName} is invalid`, 'INVALID_DATE_OF_BIRTH');
  }
  const normalized = date.toISOString().slice(0, 10);
  if (Date.parse(`${normalized}T00:00:00.000Z`) > Date.now()) {
    httpError(400, `${fieldName} is invalid`, 'INVALID_DATE_OF_BIRTH');
  }
  return normalized;
}

function normalizeLearnerCode(value: unknown): string {
  const code = normalizeRequiredText(value, 'code', 100);
  return code;
}

function normalizeCreateLearnerProfileInput(payload: Record<string, unknown>): CreateLearnerProfileInput {
  ensureNoUnknownFields(payload, ['code', 'fullName', 'dateOfBirth', 'phone', 'email'], 'payload');
  return {
    code: normalizeLearnerCode(payload.code),
    fullName: normalizeRequiredText(payload.fullName, 'fullName', 200),
    dateOfBirth: normalizeDateOnly(payload.dateOfBirth, 'dateOfBirth'),
    phone: normalizePhone(payload.phone, 'phone'),
    email: normalizeEmail(payload.email, 'email'),
  };
}

function normalizeBoolean(value: unknown, fallback = false): boolean {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value !== 0;
  const text = normalizeText(value).toLowerCase();
  if (!text) return fallback;
  return ['1', 'true', 'yes', 'on'].includes(text);
}

function normalizePositiveInteger(value: unknown, fieldName: string): number {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    httpError(400, `${fieldName} must be a positive integer`, 'INVALID_REQUEST_BODY');
  }
  return parsed;
}

function normalizeEnum<T extends string>(value: unknown, allowed: T[], fallback: T, fieldName: string): T {
  const normalized = normalizeText(value).toLowerCase() as T;
  if (!normalized) return fallback;
  if (!allowed.includes(normalized)) {
    httpError(400, `${fieldName} is invalid`, 'INVALID_REQUEST_BODY');
  }
  return normalized;
}

function parseDateTime(value: unknown, fieldName: string, options: { required?: boolean } = {}): string | null {
  const text = normalizeText(value);
  if (!text) {
    if (options.required) {
      httpError(400, `${fieldName} is required`, 'INVALID_DATE_RANGE');
    }
    return null;
  }
  const timestamp = Date.parse(text);
  if (Number.isNaN(timestamp)) {
    httpError(400, `${fieldName} is invalid`, 'INVALID_DATE_RANGE');
  }
  return new Date(timestamp).toISOString();
}

function parseDecimalInput(value: unknown, fieldName: string, options: { required?: boolean; min?: number; allowNull?: boolean } = {}): string | null {
  const text = normalizeText(value);
  if (!text) {
    if (options.required) {
      httpError(400, `${fieldName} is required`, 'INVALID_PAYMENT_CONFIGURATION');
    }
    return options.allowNull === false ? '0' : null;
  }

  const numeric = Number(text);
  if (!Number.isFinite(numeric)) {
    httpError(400, `${fieldName} must be a valid decimal`, 'INVALID_PAYMENT_CONFIGURATION');
  }
  if (typeof options.min === 'number' && numeric < options.min) {
    httpError(400, `${fieldName} must be at least ${options.min}`, 'INVALID_PAYMENT_CONFIGURATION');
  }
  return text;
}

function ensureNoUnknownFields(payload: Record<string, unknown>, allowedKeys: string[], entityName: string) {
  const unknownKeys = Object.keys(payload || {}).filter((key) => !allowedKeys.includes(key));
  if (unknownKeys.length > 0) {
    httpError(400, `${entityName} contains unknown fields`, 'UNKNOWN_FIELDS', { entity: entityName, fields: unknownKeys });
  }
}

function parseStrictOptionalBoolean(value: unknown, fieldName: string): boolean | undefined {
  if (typeof value === 'undefined') return undefined;
  if (typeof value !== 'boolean') {
    httpError(400, `${fieldName} must be a boolean`, 'INVALID_REQUEST_BODY');
  }
  return value;
}

function parseNonNegativeInteger(value: unknown, fieldName: string): number {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 0) {
    httpError(400, `${fieldName} must be a non-negative integer`, 'INVALID_REQUEST_BODY');
  }
  return parsed;
}

function normalizeEmailValue(value: unknown, fieldName: string): string | null {
  const text = normalizeText(value).toLowerCase();
  if (!text) return null;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(text)) {
    httpError(400, `${fieldName} is invalid`, 'INVALID_EMAIL');
  }
  return text;
}

function normalizeUpperOptionalText(value: unknown, maxLength?: number): string | null {
  const text = normalizeOptionalText(value, maxLength);
  return text ? text.toUpperCase() : null;
}

function normalizePaymentProfileMethod(value: unknown, fieldName: string, fallback: 'bank_transfer' | 'cash' | 'other' = 'bank_transfer') {
  return normalizeEnum(value, ['bank_transfer', 'cash', 'other'], fallback, fieldName);
}

function normalizeMediaRelationId(value: unknown, fieldName: string): number | null {
  if (value === null || value === undefined || value === '') return null;
  const relationRef = extractRelationRef(value);
  const parsed = Number(relationRef ?? value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    httpError(400, `${fieldName} is invalid`, 'PAYMENT_PROFILE_INVALID_QR_IMAGE');
  }
  return parsed;
}

function validateTransferTemplatePlaceholders(value: string | null, fieldName: string) {
  if (!value) return;
  const allowed = new Set(['registrationCode', 'learnerCode', 'fullName', 'roundCode']);
  const matches = value.match(/\{([^}]+)\}/g) || [];
  for (const item of matches) {
    const name = item.slice(1, -1).trim();
    if (!allowed.has(name)) {
      httpError(400, `${fieldName} contains unsupported placeholder`, 'PAYMENT_TRANSFER_TEMPLATE_INVALID_PLACEHOLDER', {
        field: fieldName,
        placeholder: item,
      });
    }
  }
}

function parsePositiveDuration(value: unknown, fieldName: string): number | null {
  if (value === null) return null;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0 || parsed > 1440) {
    httpError(400, `${fieldName} is invalid`, 'INVALID_DURATION', { path: fieldName });
  }
  return parsed;
}

function parseExamComponentScore(value: unknown, fieldName: string, options: { required?: boolean } = {}): string | null {
  const text = normalizeText(value);
  if (!text) {
    if (options.required) {
      httpError(400, `${fieldName} is required`, 'INVALID_SCORE_RANGE', { path: fieldName });
    }
    return null;
  }

  const numeric = Number(text);
  if (!Number.isFinite(numeric)) {
    httpError(400, `${fieldName} must be a valid number`, 'INVALID_SCORE_RANGE', { path: fieldName });
  }

  return String(numeric);
}

function normalizeExamComponentMethod(value: unknown, options: { required?: boolean } = {}): typeof EXAM_COMPONENT_ALLOWED_METHODS[number] | undefined {
  const normalized = normalizeText(value).toLowerCase();
  if (!normalized) {
    if (options.required) return 'other';
    return undefined;
  }

  if (!EXAM_COMPONENT_ALLOWED_METHODS.includes(normalized as typeof EXAM_COMPONENT_ALLOWED_METHODS[number])) {
    httpError(400, 'examMethod is invalid', 'INVALID_EXAM_METHOD', { path: 'examMethod' });
  }

  return normalized as typeof EXAM_COMPONENT_ALLOWED_METHODS[number];
}

function normalizeExamComponentBoolean(value: unknown, fieldName: string): boolean {
  if (typeof value !== 'boolean') {
    httpError(400, `${fieldName} must be a boolean`, 'INVALID_REQUEST_BODY', { path: fieldName });
  }

  return value;
}

function normalizeExamComponentWriteInput(payload: Record<string, unknown>, options: { partial?: boolean } = {}): ExamComponentWriteInput {
  ensureNoUnknownFields(payload, EXAM_COMPONENT_ALLOWED_FIELDS, 'examComponent');

  const partial = options.partial === true;
  const input: ExamComponentWriteInput = {};

  if (!partial || hasOwn(payload, 'code')) {
    input.code = normalizeRequiredText(payload.code, 'code', 100);
  }

  if (!partial || hasOwn(payload, 'name')) {
    input.name = normalizeRequiredText(payload.name, 'name', 200);
  }

  if (hasOwn(payload, 'description')) {
    input.description = normalizeOptionalText(payload.description);
  } else if (!partial) {
    input.description = null;
  }

  if (!partial || hasOwn(payload, 'minimumScore')) {
    input.minimumScore = parseExamComponentScore(payload.minimumScore, 'minimumScore', { required: !partial });
  }

  if (!partial || hasOwn(payload, 'maximumScore')) {
    input.maximumScore = parseExamComponentScore(payload.maximumScore, 'maximumScore', { required: !partial });
  }

  if (hasOwn(payload, 'passingScore')) {
    input.passingScore = parseExamComponentScore(payload.passingScore, 'passingScore');
  } else if (!partial) {
    input.passingScore = null;
  }

  if (hasOwn(payload, 'defaultDurationMinutes')) {
    const durationValue = payload.defaultDurationMinutes;
    input.defaultDurationMinutes = durationValue === '' || typeof durationValue === 'undefined'
      ? null
      : parsePositiveDuration(durationValue, 'defaultDurationMinutes');
  } else if (!partial) {
    input.defaultDurationMinutes = null;
  }

  if (!partial || hasOwn(payload, 'examMethod')) {
    input.examMethod = normalizeExamComponentMethod(payload.examMethod, { required: !partial });
  }

  if (hasOwn(payload, 'isActive')) {
    input.isActive = normalizeExamComponentBoolean(payload.isActive, 'isActive');
  } else if (!partial) {
    input.isActive = true;
  }

  return input;
}

function validateExamComponentBusinessRules(values: {
  minimumScore: string | null;
  maximumScore: string | null;
  passingScore: string | null;
}) {
  const minimumScore = decimalToNumber(values.minimumScore);
  const maximumScore = decimalToNumber(values.maximumScore);
  const passingScore = decimalToNumber(values.passingScore);

  if (minimumScore === null || maximumScore === null) {
    httpError(400, 'minimumScore and maximumScore are required', 'INVALID_SCORE_RANGE', { path: 'scoreRange' });
  }

  if (minimumScore > maximumScore) {
    httpError(400, 'minimumScore must be less than or equal to maximumScore', 'INVALID_SCORE_RANGE', { path: 'scoreRange' });
  }

  if (passingScore !== null && (passingScore < minimumScore || passingScore > maximumScore)) {
    httpError(400, 'passingScore is outside the valid score range', 'INVALID_PASSING_SCORE', { path: 'passingScore' });
  }
}

async function ensureExamComponentCodeUnique(tenantId: number, code: string, currentId?: number) {
  const duplicate = await strapi.db.query(EXAM_COMPONENT_UID).findOne({
    where: mergeTenantWhere({ code: { $eqi: code } }, tenantId),
    select: ['id', 'code'],
  });

  if (duplicate?.id && duplicate.id !== currentId) {
    httpError(409, 'Exam component code already exists', 'EXAM_COMPONENT_CODE_EXISTS', { path: 'code', value: code });
  }
}

function buildExamComponentWriteData(input: ExamComponentWriteInput) {
  const data: Record<string, unknown> = {};

  if (typeof input.code === 'string') data.code = input.code;
  if (typeof input.name === 'string') data.name = input.name;
  if (typeof input.description !== 'undefined') data.description = input.description;
  if (typeof input.minimumScore !== 'undefined') data.minimumScore = input.minimumScore;
  if (typeof input.maximumScore !== 'undefined') data.maximumScore = input.maximumScore;
  if (typeof input.passingScore !== 'undefined') data.passingScore = input.passingScore;
  if (typeof input.defaultDurationMinutes !== 'undefined') data.defaultDurationMinutes = input.defaultDurationMinutes;
  if (typeof input.examMethod !== 'undefined') data.examMethod = input.examMethod;
  if (typeof input.isActive !== 'undefined') data.isActive = input.isActive;

  return data;
}

export async function createExamConfigurationComponent(tenantId: number, payload: Record<string, unknown>, _authUser: AuthUser) {
  const input = normalizeExamComponentWriteInput(payload, { partial: false });
  validateExamComponentBusinessRules({
    minimumScore: input.minimumScore || null,
    maximumScore: input.maximumScore || null,
    passingScore: input.passingScore || null,
  });

  await ensureExamComponentCodeUnique(tenantId, input.code || '');

  const created = await strapi.db.query(EXAM_COMPONENT_UID).create({
    data: {
      ...buildExamComponentWriteData(input),
      componentType: 'skill',
      tenant: tenantId,
    },
  });

  return getExamConfigurationComponentDetail(created?.id, tenantId);
}

export async function updateExamConfigurationComponent(tenantId: number, componentId: unknown, payload: Record<string, unknown>, _authUser: AuthUser) {
  const current = await getExamConfigurationComponentDetail(componentId, tenantId);
  if (!current?.id) {
    httpError(404, 'Exam component not found', 'EXAM_COMPONENT_NOT_FOUND');
  }

  const input = normalizeExamComponentWriteInput(payload, { partial: true });
  const nextValues = {
    minimumScore: typeof input.minimumScore !== 'undefined' ? input.minimumScore : decimalToString(current.minimumScore),
    maximumScore: typeof input.maximumScore !== 'undefined' ? input.maximumScore : decimalToString(current.maximumScore),
    passingScore: typeof input.passingScore !== 'undefined' ? input.passingScore : decimalToString(current.passingScore),
  };

  validateExamComponentBusinessRules(nextValues);

  const nextCode = typeof input.code === 'string' ? input.code : normalizeText(current.code);
  await ensureExamComponentCodeUnique(tenantId, nextCode, Number(current.id));

  const data = buildExamComponentWriteData(input);
  if (Object.keys(data).length === 0) {
    return current;
  }

  await strapi.db.query(EXAM_COMPONENT_UID).update({
    where: { id: Number(current.id) },
    data,
  });

  return getExamConfigurationComponentDetail(current.id, tenantId);
}

export async function createExamConfigurationSubject(tenantId: number, payload: Record<string, unknown>, _authUser: AuthUser) {
  const input = normalizeExamSubjectWriteInput(payload, { partial: false });
  const calculationMethod = input.calculationMethod || 'total';

  validateExamSubjectBusinessRules({
    calculationMethod,
    requiredAggregateScore: input.requiredAggregateScore || null,
    defaultFee: input.defaultFee || null,
  });

  await ensureExamSubjectCodeUnique(tenantId, input.code || '');

  const created = await strapi.db.query(EXAM_SUBJECT_UID).create({
    data: {
      ...buildExamSubjectWriteData({ ...input, calculationMethod }),
      tenant: tenantId,
    },
  });

  return getExamConfigurationSubjectDetail(created?.id, tenantId);
}

export async function updateExamConfigurationSubject(tenantId: number, subjectId: unknown, payload: Record<string, unknown>, _authUser: AuthUser) {
  const current = await getExamConfigurationSubjectDetail(subjectId, tenantId);
  if (!current?.id) {
    httpError(404, 'Exam subject not found', 'EXAM_SUBJECT_NOT_FOUND');
  }

  const input = normalizeExamSubjectWriteInput(payload, { partial: true });
  const calculationMethod = typeof input.calculationMethod !== 'undefined'
    ? input.calculationMethod
    : normalizeExamSubjectMethod(current.calculationMethod, { required: true }) || 'total';

  validateExamSubjectBusinessRules({
    calculationMethod,
    requiredAggregateScore: typeof input.requiredAggregateScore !== 'undefined' ? input.requiredAggregateScore : decimalToString(current.requiredAggregateScore),
    defaultFee: typeof input.defaultFee !== 'undefined' ? input.defaultFee : decimalToString(current.defaultFee),
  });

  const nextCode = typeof input.code === 'string' ? input.code : normalizeText(current.code);
  await ensureExamSubjectCodeUnique(tenantId, nextCode, Number(current.id));

  const data = buildExamSubjectWriteData({ ...input, calculationMethod });
  if (Object.keys(data).length === 0) {
    return current;
  }

  await strapi.db.query(EXAM_SUBJECT_UID).update({
    where: { id: Number(current.id) },
    data,
  });

  return getExamConfigurationSubjectDetail(current.id, tenantId);
}

export async function createExamConfigurationProgram(tenantId: number, payload: Record<string, unknown>, _authUser: AuthUser) {
  const input = normalizeExamProgramWriteInput(payload, { partial: false });
  const feeCalculationMethod = input.feeCalculationMethod || 'sum_subject_fees';

  validateExamProgramBusinessRules({
    feeCalculationMethod,
    defaultFee: input.defaultFee || null,
    validFrom: input.validFrom || null,
    validTo: input.validTo || null,
  });

  await ensureExamProgramCodeUnique(tenantId, input.code || '');

  const created = await strapi.db.query(EXAM_PROGRAM_UID).create({
    data: {
      ...buildExamProgramWriteData({ ...input, feeCalculationMethod, passingMethod: input.passingMethod || 'all_subjects_pass' }),
      tenant: tenantId,
    },
  });

  return getExamConfigurationProgramDetail(created?.id, tenantId);
}

export async function updateExamConfigurationProgram(tenantId: number, programId: unknown, payload: Record<string, unknown>, _authUser: AuthUser) {
  const current = await getExamConfigurationProgramDetail(programId, tenantId);
  if (!current?.id) {
    httpError(404, 'Exam program not found', 'EXAM_PROGRAM_NOT_FOUND');
  }

  const input = normalizeExamProgramWriteInput(payload, { partial: true });
  const feeCalculationMethod = typeof input.feeCalculationMethod !== 'undefined'
    ? input.feeCalculationMethod
    : normalizeExamProgramFeeMethod(current.feeCalculationMethod, { required: true }) || 'sum_subject_fees';

  validateExamProgramBusinessRules({
    feeCalculationMethod,
    defaultFee: typeof input.defaultFee !== 'undefined' ? input.defaultFee : decimalToString(current.defaultFee),
    validFrom: typeof input.validFrom !== 'undefined' ? input.validFrom : normalizeText(current.validFrom) || null,
    validTo: typeof input.validTo !== 'undefined' ? input.validTo : normalizeText(current.validTo) || null,
  });

  const nextCode = typeof input.code === 'string' ? input.code : normalizeText(current.code);
  await ensureExamProgramCodeUnique(tenantId, nextCode, Number(current.id));

  const data = buildExamProgramWriteData({
    ...input,
    feeCalculationMethod,
    passingMethod: typeof input.passingMethod !== 'undefined'
      ? input.passingMethod
      : normalizeExamProgramPassingMethod(current.passingMethod, { required: true }) || 'all_subjects_pass',
  });
  if (Object.keys(data).length === 0) {
    return current;
  }

  await strapi.db.query(EXAM_PROGRAM_UID).update({
    where: { id: Number(current.id) },
    data,
  });

  return getExamConfigurationProgramDetail(current.id, tenantId);
}

function normalizeReplaceExamProgramSubjectsInput(payload: Record<string, unknown>): ReplaceExamProgramSubjectsInput {
  ensureNoUnknownFields(payload, ['subjectIds'], 'programSubjectStructure');

  if (!Array.isArray(payload.subjectIds)) {
    httpError(400, 'subjectIds must be an array', 'INVALID_REQUEST_BODY', { path: 'subjectIds' });
  }

  const seenKeys = new Set<string>();
  const subjectIds = payload.subjectIds.map((entry, index) => {
    const refText = normalizeText(entry);
    if (!refText) {
      httpError(400, 'subjectIds contains an invalid value', 'INVALID_REQUEST_BODY', { path: `subjectIds[${index}]` });
    }
    if (seenKeys.has(refText.toLowerCase())) {
      httpError(409, 'Duplicate exam subject in program structure payload', 'EXAM_PROGRAM_SUBJECT_ALREADY_EXISTS', { path: `subjectIds[${index}]`, value: refText });
    }
    seenKeys.add(refText.toLowerCase());
    const parsed = Number(refText);
    return Number.isInteger(parsed) && parsed > 0 ? parsed : refText;
  });

  return { subjectIds };
}

export async function replaceExamConfigurationProgramSubjects(tenantId: number, programId: unknown, payload: Record<string, unknown>, _authUser: AuthUser) {
  const program = await getExamConfigurationProgramDetail(programId, tenantId);
  if (!program?.id) {
    httpError(404, 'Exam program not found', 'EXAM_PROGRAM_NOT_FOUND');
  }

  const input = normalizeReplaceExamProgramSubjectsInput(payload);
  const existingRows = await strapi.db.query(EXAM_PROGRAM_SUBJECT_UID).findMany({
    where: mergeTenantWhere({
      examProgram: {
        id: {
          $eq: Number(program.id),
        },
      },
    }, tenantId),
    select: ['id', 'displayOrder', 'isRequired', 'feeOverride'],
    populate: {
      examSubject: {
        select: ['id', 'documentId'],
      },
    },
    orderBy: [{ displayOrder: 'asc' }, { id: 'asc' }],
  }) as any[];

  const existingBySubjectKey = new Map<string, any>();
  for (const row of existingRows) {
    const subjectRef = extractRelationRef(row?.examSubject) || row?.examSubject?.id || row?.examSubject?.documentId;
    const key = normalizeText(subjectRef).toLowerCase();
    if (key) existingBySubjectKey.set(key, row);
  }

  const requestedWhere = input.subjectIds.length > 0
    ? input.subjectIds.map((ref) => whereByParam(ref)).filter(Boolean)
    : [];

  const requestedSubjects = requestedWhere.length > 0
    ? await strapi.db.query(EXAM_SUBJECT_UID).findMany({
        where: mergeTenantWhere({ $or: requestedWhere }, tenantId),
        select: ['id', 'documentId', 'isActive'],
      }) as any[]
    : [];

  const subjectByKey = new Map<string, any>();
  for (const subject of requestedSubjects) {
    if (subject?.id) subjectByKey.set(String(subject.id).toLowerCase(), subject);
    if (subject?.documentId) subjectByKey.set(String(subject.documentId).toLowerCase(), subject);
  }

  for (let index = 0; index < input.subjectIds.length; index += 1) {
    const requestedRef = input.subjectIds[index];
    const requestedKey = normalizeText(requestedRef).toLowerCase();
    const subject = subjectByKey.get(requestedKey);

    if (!subject?.id) {
      httpError(404, 'Exam subject not found', 'EXAM_SUBJECT_NOT_FOUND', { path: `subjectIds[${index}]`, value: requestedRef });
    }
    if (subject.isActive === false) {
      httpError(409, 'Exam subject is inactive', 'EXAM_SUBJECT_INACTIVE', { path: `subjectIds[${index}]`, value: requestedRef });
    }
  }

  const requestedIdSet = new Set(requestedSubjects.map((subject) => Number(subject.id)).filter((value) => Number.isInteger(value) && value > 0));
  const rowsToDelete = existingRows.filter((row) => {
    const subjectId = Number(extractRelationRef(row?.examSubject) || row?.examSubject?.id || 0);
    return subjectId > 0 && !requestedIdSet.has(subjectId);
  });

  for (const row of rowsToDelete) {
    await strapi.db.query(EXAM_PROGRAM_SUBJECT_UID).delete({ where: { id: Number(row.id) } });
  }

  for (let index = 0; index < input.subjectIds.length; index += 1) {
    const requestedRef = input.subjectIds[index];
    const requestedKey = normalizeText(requestedRef).toLowerCase();
    const subject = subjectByKey.get(requestedKey);
    const existing = existingBySubjectKey.get(requestedKey);
    const nextDisplayOrder = index + 1;

    if (existing?.id) {
      await strapi.db.query(EXAM_PROGRAM_SUBJECT_UID).update({
        where: { id: Number(existing.id) },
        data: { displayOrder: nextDisplayOrder },
      });
      continue;
    }

    await strapi.db.query(EXAM_PROGRAM_SUBJECT_UID).create({
      data: {
        examProgram: Number(program.id),
        examSubject: Number(subject.id),
        displayOrder: nextDisplayOrder,
        isRequired: true,
        tenant: tenantId,
      },
    });
  }

  return getExamConfigurationProgramDetail(program.id, tenantId);
}

function normalizeExamProgramSubjectUpdateInput(payload: Record<string, unknown>): UpdateExamProgramSubjectInput {
  ensureNoUnknownFields(payload, ['isRequired', 'feeOverride'], 'examProgramSubject');
  const input: UpdateExamProgramSubjectInput = {};
  if (hasOwn(payload, 'isRequired')) {
    input.isRequired = normalizeExamComponentBoolean(payload.isRequired, 'isRequired');
  }
  if (hasOwn(payload, 'feeOverride')) {
    input.feeOverride = parseDecimalInput(payload.feeOverride, 'feeOverride', { min: 0 });
  }
  return input;
}

export async function updateExamConfigurationProgramSubject(
  tenantId: number,
  programId: unknown,
  programSubjectId: unknown,
  payload: Record<string, unknown>,
  _authUser: AuthUser,
) {
  const program = await getExamConfigurationProgramDetail(programId, tenantId);
  if (!program?.id) {
    httpError(404, 'Exam program not found', 'EXAM_PROGRAM_NOT_FOUND');
  }

  const where = whereByParam(programSubjectId);
  if (!where) {
    httpError(404, 'Exam program subject not found', 'EXAM_PROGRAM_SUBJECT_NOT_FOUND');
  }

  const current = await strapi.db.query(EXAM_PROGRAM_SUBJECT_UID).findOne({
    where: mergeTenantWhere({
      ...where,
      examProgram: {
        id: {
          $eq: Number(program.id),
        },
      },
    }, tenantId),
    select: ['id', 'isRequired', 'feeOverride'],
  }) as any;

  if (!current?.id) {
    httpError(404, 'Exam program subject not found', 'EXAM_PROGRAM_SUBJECT_NOT_FOUND');
  }

  const input = normalizeExamProgramSubjectUpdateInput(payload);
  const data: Record<string, unknown> = {};
  if (typeof input.isRequired !== 'undefined') data.isRequired = input.isRequired;
  if (typeof input.feeOverride !== 'undefined') data.feeOverride = input.feeOverride;

  if (Object.keys(data).length === 0) {
    return getExamConfigurationProgramDetail(program.id, tenantId);
  }

  await strapi.db.query(EXAM_PROGRAM_SUBJECT_UID).update({
    where: { id: Number(current.id) },
    data,
  });

  return getExamConfigurationProgramDetail(program.id, tenantId);
}

function normalizeReplaceExamSubjectComponentsInput(payload: Record<string, unknown>): ReplaceExamSubjectComponentsInput {
  ensureNoUnknownFields(payload, ['componentIds'], 'subjectComponentStructure');

  if (!Array.isArray(payload.componentIds)) {
    httpError(400, 'componentIds must be an array', 'INVALID_REQUEST_BODY', { path: 'componentIds' });
  }

  const seenKeys = new Set<string>();
  const componentIds = payload.componentIds.map((entry, index) => {
    const refText = normalizeText(entry);
    if (!refText) {
      httpError(400, 'componentIds contains an invalid value', 'INVALID_REQUEST_BODY', { path: `componentIds[${index}]` });
    }

    if (seenKeys.has(refText.toLowerCase())) {
      httpError(409, 'Duplicate exam component in subject structure payload', 'EXAM_SUBJECT_COMPONENT_DUPLICATE', { path: `componentIds[${index}]`, value: refText });
    }
    seenKeys.add(refText.toLowerCase());

    const parsed = Number(refText);
    return Number.isInteger(parsed) && parsed > 0 ? parsed : refText;
  });

  return { componentIds };
}

export async function replaceExamConfigurationSubjectComponents(tenantId: number, subjectId: unknown, payload: Record<string, unknown>, _authUser: AuthUser) {
  const subject = await getExamConfigurationSubjectDetail(subjectId, tenantId);
  if (!subject?.id) {
    httpError(404, 'Exam subject not found', 'EXAM_SUBJECT_NOT_FOUND');
  }

  const input = normalizeReplaceExamSubjectComponentsInput(payload);
  const existingRows = await strapi.db.query(EXAM_SUBJECT_COMPONENT_UID).findMany({
    where: mergeTenantWhere({
      examSubject: {
        id: {
          $eq: Number(subject.id),
        },
      },
    }, tenantId),
    select: ['id', 'displayOrder', 'isRequired', 'weight', 'passingScoreOverride', 'eliminationScoreOverride', 'durationMinutesOverride'],
    populate: {
      examComponent: {
        select: ['id', 'documentId', 'componentType'],
      },
    },
    orderBy: [{ displayOrder: 'asc' }, { id: 'asc' }],
  }) as any[];

  const existingByComponentKey = new Map<string, any>();
  for (const row of existingRows) {
    const componentRef = extractRelationRef(row?.examComponent) || row?.examComponent?.id || row?.examComponent?.documentId;
    const key = normalizeText(componentRef).toLowerCase();
    if (key) existingByComponentKey.set(key, row);
  }

  const requestedWhere = input.componentIds.length > 0
    ? input.componentIds.map((ref) => whereByParam(ref)).filter(Boolean)
    : [];

  const requestedComponents = requestedWhere.length > 0
    ? await strapi.db.query(EXAM_COMPONENT_UID).findMany({
        where: mergeTenantWhere({
          $or: requestedWhere,
        }, tenantId),
        select: ['id', 'documentId', 'componentType'],
      }) as any[]
    : [];

  const componentByKey = new Map<string, any>();
  for (const component of requestedComponents) {
    if (component?.id) componentByKey.set(String(component.id).toLowerCase(), component);
    if (component?.documentId) componentByKey.set(String(component.documentId).toLowerCase(), component);
  }

  for (let index = 0; index < input.componentIds.length; index += 1) {
    const requestedRef = input.componentIds[index];
    const requestedKey = normalizeText(requestedRef).toLowerCase();
    const component = componentByKey.get(requestedKey);

    if (!component?.id) {
      httpError(404, 'Exam component not found', 'EXAM_COMPONENT_NOT_FOUND', { path: `componentIds[${index}]`, value: requestedRef });
    }

    if (normalizeText(component.componentType).toLowerCase() !== 'skill') {
      httpError(409, 'Only skill exam components can be assigned to exam subjects in this workflow', 'EXAM_SUBJECT_COMPONENT_INVALID_TYPE', { path: `componentIds[${index}]`, value: requestedRef });
    }
  }

  const requestedIdSet = new Set(requestedComponents.map((component) => Number(component.id)).filter((value) => Number.isInteger(value) && value > 0));
  const rowsToDelete = existingRows.filter((row) => {
    const componentId = Number(extractRelationRef(row?.examComponent) || row?.examComponent?.id || 0);
    return componentId > 0 && !requestedIdSet.has(componentId);
  });

  for (const row of rowsToDelete) {
    await strapi.db.query(EXAM_SUBJECT_COMPONENT_UID).delete({
      where: { id: Number(row.id) },
    });
  }

  for (let index = 0; index < input.componentIds.length; index += 1) {
    const requestedRef = input.componentIds[index];
    const requestedKey = normalizeText(requestedRef).toLowerCase();
    const component = componentByKey.get(requestedKey);
    const existing = existingByComponentKey.get(requestedKey);
    const nextDisplayOrder = index + 1;

    if (existing?.id) {
      await strapi.db.query(EXAM_SUBJECT_COMPONENT_UID).update({
        where: { id: Number(existing.id) },
        data: {
          displayOrder: nextDisplayOrder,
        },
      });
      continue;
    }

    await strapi.db.query(EXAM_SUBJECT_COMPONENT_UID).create({
      data: {
        examSubject: Number(subject.id),
        examComponent: Number(component.id),
        displayOrder: nextDisplayOrder,
        isRequired: true,
        tenant: tenantId,
      },
    });
  }

  return getExamConfigurationSubjectDetail(subject.id, tenantId);
}

function normalizeExamSubjectComponentUpdateInput(payload: Record<string, unknown>): UpdateExamSubjectComponentInput {
  ensureNoUnknownFields(payload, ['isRequired', 'weight', 'passingScoreOverride', 'eliminationScoreOverride', 'durationMinutesOverride'], 'examSubjectComponent');

  const input: UpdateExamSubjectComponentInput = {};

  if (hasOwn(payload, 'isRequired')) {
    input.isRequired = normalizeExamComponentBoolean(payload.isRequired, 'isRequired');
  }

  if (hasOwn(payload, 'weight')) {
    const normalized = parseDecimalInput(payload.weight, 'weight');
    const numeric = decimalToNumber(normalized);
    if (numeric !== null && numeric < 0) {
      httpError(400, 'weight must be at least 0', 'INVALID_COMPONENT_WEIGHT', { path: 'weight' });
    }
    input.weight = normalized;
  }

  if (hasOwn(payload, 'passingScoreOverride')) {
    input.passingScoreOverride = parseDecimalInput(payload.passingScoreOverride, 'passingScoreOverride');
  }

  if (hasOwn(payload, 'eliminationScoreOverride')) {
    input.eliminationScoreOverride = parseDecimalInput(payload.eliminationScoreOverride, 'eliminationScoreOverride');
  }

  if (hasOwn(payload, 'durationMinutesOverride')) {
    const durationValue = payload.durationMinutesOverride;
    input.durationMinutesOverride = durationValue === '' || durationValue === null || typeof durationValue === 'undefined'
      ? null
      : parsePositiveDuration(durationValue, 'durationMinutesOverride');
  }

  return input;
}

function validateExamSubjectComponentBusinessRules(component: any, input: UpdateExamSubjectComponentInput) {
  const minimumScore = decimalToNumber(component?.minimumScore);
  const maximumScore = decimalToNumber(component?.maximumScore);
  const passingScoreOverride = typeof input.passingScoreOverride !== 'undefined' ? decimalToNumber(input.passingScoreOverride) : undefined;
  const eliminationScoreOverride = typeof input.eliminationScoreOverride !== 'undefined' ? decimalToNumber(input.eliminationScoreOverride) : undefined;

  if (typeof passingScoreOverride !== 'undefined' && passingScoreOverride !== null) {
    if (minimumScore === null || maximumScore === null || passingScoreOverride < minimumScore || passingScoreOverride > maximumScore) {
      httpError(400, 'passingScoreOverride is outside the valid score range', 'INVALID_COMPONENT_PASSING_SCORE', { path: 'passingScoreOverride' });
    }
  }

  if (typeof eliminationScoreOverride !== 'undefined' && eliminationScoreOverride !== null) {
    if (minimumScore === null || maximumScore === null || eliminationScoreOverride < minimumScore || eliminationScoreOverride > maximumScore) {
      httpError(400, 'eliminationScoreOverride is outside the valid score range', 'INVALID_COMPONENT_PASSING_SCORE', { path: 'eliminationScoreOverride' });
    }
  }
}

export async function updateExamConfigurationSubjectComponent(
  tenantId: number,
  subjectId: unknown,
  subjectComponentId: unknown,
  payload: Record<string, unknown>,
  _authUser: AuthUser,
) {
  const subject = await getExamConfigurationSubjectDetail(subjectId, tenantId);
  if (!subject?.id) {
    httpError(404, 'Exam subject not found', 'EXAM_SUBJECT_NOT_FOUND');
  }

  const where = whereByParam(subjectComponentId);
  if (!where) {
    httpError(404, 'Exam subject component not found', 'EXAM_SUBJECT_COMPONENT_NOT_FOUND');
  }

  const current = await strapi.db.query(EXAM_SUBJECT_COMPONENT_UID).findOne({
    where: mergeTenantWhere({
      ...where,
      examSubject: {
        id: {
          $eq: Number(subject.id),
        },
      },
    }, tenantId),
    select: ['id', 'isRequired', 'weight', 'passingScoreOverride', 'eliminationScoreOverride', 'durationMinutesOverride'],
    populate: {
      examComponent: {
        select: ['id', 'minimumScore', 'maximumScore', 'passingScore', 'eliminationScore', 'defaultDurationMinutes', 'isActive'],
      },
    },
  }) as any;

  if (!current?.id) {
    httpError(404, 'Exam subject component not found', 'EXAM_SUBJECT_COMPONENT_NOT_FOUND');
  }

  const input = normalizeExamSubjectComponentUpdateInput(payload);
  validateExamSubjectComponentBusinessRules(current?.examComponent, input);

  const data: Record<string, unknown> = {};
  if (typeof input.isRequired !== 'undefined') data.isRequired = input.isRequired;
  if (typeof input.weight !== 'undefined') data.weight = input.weight;
  if (typeof input.passingScoreOverride !== 'undefined') data.passingScoreOverride = input.passingScoreOverride;
  if (typeof input.eliminationScoreOverride !== 'undefined') data.eliminationScoreOverride = input.eliminationScoreOverride;
  if (typeof input.durationMinutesOverride !== 'undefined') data.durationMinutesOverride = input.durationMinutesOverride;

  if (Object.keys(data).length === 0) {
    return getExamConfigurationSubjectDetail(subject.id, tenantId);
  }

  await strapi.db.query(EXAM_SUBJECT_COMPONENT_UID).update({
    where: { id: Number(current.id) },
    data,
  });

  return getExamConfigurationSubjectDetail(subject.id, tenantId);
}

function decimalToNumber(value: unknown): number | null {
  const text = normalizeText(value);
  if (!text) return null;
  const numeric = Number(text);
  return Number.isFinite(numeric) ? numeric : null;
}

function decimalToString(value: unknown): string | null {
  const text = normalizeText(value);
  if (!text) return null;
  const numeric = Number(text);
  return Number.isFinite(numeric) ? String(numeric) : null;
}

function roundMoney(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function moneyToStorageString(value: number): string {
  return String(roundMoney(value));
}

function toMoney(value: unknown, fallback = 0): number {
  const numeric = decimalToNumber(value);
  return roundMoney(numeric === null ? fallback : numeric);
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

function normalizeStoredDateTime(value: unknown): string | null {
  const text = normalizeText(value);
  if (!text) return null;
  const timestamp = Date.parse(text);
  if (Number.isNaN(timestamp)) return null;
  return new Date(timestamp).toISOString();
}

function pushWorkflowValidationError(
  errors: WorkflowValidationError[],
  status: number,
  path: string,
  code: string,
  message: string,
  details?: Record<string, unknown> | null,
) {
  errors.push({
    status,
    path,
    code,
    message,
    ...(details ? { details } : {}),
  });
}

function throwFirstValidationError(errors: WorkflowValidationError[]) {
  if (!errors.length) return;
  const first = errors[0];
  httpError(first.status, first.message, first.code, first.details || { path: first.path });
}

function normalizeWorkflowNoteInput(payload: Record<string, unknown>): WorkflowNoteInput {
  ensureNoUnknownFields(payload, ['note'], 'payload');
  return {
    note: normalizeOptionalText(payload.note, 2000),
  };
}

function normalizeWorkflowReturnInput(payload: Record<string, unknown>): WorkflowReturnInput {
  ensureNoUnknownFields(payload, ['reason'], 'payload');
  const reason = normalizeText(payload.reason);
  if (!reason) {
    httpError(400, 'reason is required', 'RETURN_REASON_REQUIRED');
  }
  if (reason.length > 2000) {
    httpError(400, 'reason max length is 2000', 'RETURN_REASON_REQUIRED');
  }
  return { reason };
}

function normalizeVenueRoomConfigurationInput(payload: Record<string, unknown>): VenueRoomConfigurationInput {
  ensureNoUnknownFields(payload, ['venueIds', 'roomIds'], 'payload');
  if (!Array.isArray(payload.venueIds) || !Array.isArray(payload.roomIds)) {
    httpError(400, 'venueIds and roomIds must be arrays', 'INVALID_REQUEST_BODY');
  }

  const venueIds = payload.venueIds.map((item) => normalizePositiveInteger(item, 'venueIds'));
  const roomIds = payload.roomIds.map((item) => normalizePositiveInteger(item, 'roomIds'));

  if (new Set(venueIds).size !== venueIds.length) {
    httpError(400, 'Duplicate venueIds were found.', 'DUPLICATE_EXAM_VENUE');
  }
  if (new Set(roomIds).size !== roomIds.length) {
    httpError(400, 'Duplicate roomIds were found.', 'DUPLICATE_EXAM_ROOM');
  }

  return { venueIds, roomIds };
}

async function loadExamVenueInTenant(tenantId: number, venueRef: unknown, transacting?: any) {
  const where = whereByParam(venueRef);
  if (!where) {
    httpError(404, 'Không tìm thấy địa điểm thi trong tenant hiện tại.', 'EXAM_VENUE_NOT_FOUND');
  }

  const row = await strapi.db.query(EXAM_VENUE_UID).findOne({
    where: mergeTenantWhere(where, tenantId),
    select: ['id', 'documentId', 'code', 'name', 'shortName', 'address', 'description', 'contactName', 'contactPhone', 'isActive', 'sortOrder'],
    ...(transacting ? { transacting } : {}),
  } as any) as any;

  if (!row?.id) {
    httpError(404, 'Không tìm thấy địa điểm thi trong tenant hiện tại.', 'EXAM_VENUE_NOT_FOUND');
  }

  return row;
}

async function loadExamRoomInTenant(tenantId: number, roomRef: unknown, transacting?: any) {
  const where = whereByParam(roomRef);
  if (!where) {
    httpError(404, 'Không tìm thấy phòng thi trong tenant hiện tại.', 'EXAM_ROOM_NOT_FOUND');
  }

  const row = await strapi.db.query(EXAM_ROOM_UID).findOne({
    where: mergeTenantWhere(where, tenantId),
    select: ['id', 'documentId', 'code', 'name', 'floor', 'capacity', 'roomType', 'isActive', 'description', 'sortOrder'],
    populate: {
      examVenue: { select: ['id', 'documentId', 'code', 'name', 'shortName', 'isActive', 'sortOrder'] },
    },
    ...(transacting ? { transacting } : {}),
  } as any) as any;

  if (!row?.id) {
    httpError(404, 'Không tìm thấy phòng thi trong tenant hiện tại.', 'EXAM_ROOM_NOT_FOUND');
  }

  return row;
}

function mapExamVenueConfigurationItem(venue: any, options: { selected?: boolean; selectedRoomCount?: number; selectedCapacity?: number; activeRoomCount?: number; totalRoomCount?: number } = {}) {
  return {
    id: Number(venue?.id || 0),
    documentId: venue?.documentId || null,
    code: normalizeText(venue?.code),
    name: normalizeText(venue?.name),
    shortName: normalizeOptionalText(venue?.shortName, 100),
    address: normalizeOptionalText(venue?.address),
    description: normalizeOptionalText(venue?.description),
    contactName: normalizeOptionalText(venue?.contactName, 200),
    contactPhone: normalizeOptionalText(venue?.contactPhone, 30),
    isActive: venue?.isActive === true,
    sortOrder: Number(venue?.sortOrder || 0) || 0,
    selected: options.selected === true,
    activeRoomCount: Number(options.activeRoomCount || 0) || 0,
    totalRoomCount: Number(options.totalRoomCount || 0) || 0,
    selectedRoomCount: Number(options.selectedRoomCount || 0) || 0,
    selectedCapacity: Number(options.selectedCapacity || 0) || 0,
  };
}

function mapExamRoomConfigurationItem(room: any, options: { selected?: boolean; scheduleCount?: number } = {}) {
  return {
    id: Number(room?.id || 0),
    documentId: room?.documentId || null,
    code: normalizeText(room?.code),
    name: normalizeText(room?.name),
    floor: normalizeOptionalText(room?.floor, 50),
    capacity: Number(room?.capacity || 0) || 0,
    roomType: normalizeText(room?.roomType).toLowerCase() || 'standard',
    isActive: room?.isActive === true,
    sortOrder: Number(room?.sortOrder || 0) || 0,
    description: normalizeOptionalText(room?.description),
    selected: options.selected === true,
    scheduleCount: Number(options.scheduleCount || 0) || 0,
    examVenue: room?.examVenue ? {
      id: Number(extractRelationRef(room.examVenue) || room.examVenue.id || 0),
      documentId: room.examVenue.documentId || null,
      code: normalizeText(room.examVenue.code),
      name: normalizeText(room.examVenue.name),
      shortName: normalizeOptionalText(room.examVenue.shortName, 100),
      isActive: room.examVenue.isActive === true,
      sortOrder: Number(room.examVenue.sortOrder || 0) || 0,
    } : null,
  };
}

async function loadExamRoundVenueRoomContext(tenantId: number, roundRef: unknown, transacting?: any) {
  const where = whereByParam(roundRef);
  if (!where) {
    httpError(404, 'Không tìm thấy đợt thi trong tenant hiện tại.', 'EXAM_ROUND_NOT_FOUND');
  }

  const round = await strapi.db.query(EXAM_ROUND_UID).findOne({
    where: mergeTenantWhere(where, tenantId),
    select: ['id', 'documentId', 'code', 'name', 'status', 'examStartAt', 'examEndAt'],
    populate: {
      examVenues: { select: ['id', 'documentId', 'code', 'name', 'shortName', 'address', 'description', 'contactName', 'contactPhone', 'isActive', 'sortOrder'] },
      examRooms: {
        select: ['id', 'documentId', 'code', 'name', 'floor', 'capacity', 'roomType', 'isActive', 'description', 'sortOrder'],
        populate: {
          examVenue: { select: ['id', 'documentId', 'code', 'name', 'shortName', 'isActive', 'sortOrder'] },
        },
      },
      examRoundComponents: { select: ['id', 'nameSnapshot', 'status', 'examMethod'] },
    },
    ...(transacting ? { transacting } : {}),
  } as any) as any;

  if (!round?.id) {
    httpError(404, 'Không tìm thấy đợt thi trong tenant hiện tại.', 'EXAM_ROUND_NOT_FOUND');
  }

  return round;
}

async function countSchedulesForRoomsInRound(tenantId: number, roundId: number, roomIds: number[], transacting?: any) {
  const effectiveIds = Array.from(new Set((roomIds || []).map((item) => Number(item || 0)).filter((item) => item > 0)));
  if (!effectiveIds.length) return new Map<number, number>();
  const rows = await strapi.db.query(EXAM_SCHEDULE_UID).findMany({
    where: mergeTenantWhere({
      examRound: { id: { $eq: roundId } },
      examRoom: { id: { $in: effectiveIds } },
      status: { $in: ['draft', 'scheduled', 'published', 'in_progress'] },
    }, tenantId),
    select: ['id'],
    populate: { examRoom: { select: ['id'] } },
    ...(transacting ? { transacting } : {}),
  } as any) as any[];

  const counts = new Map<number, number>();
  for (const row of rows || []) {
    const roomId = Number(extractRelationRef(row?.examRoom) || row?.examRoom?.id || 0);
    if (!roomId) continue;
    counts.set(roomId, (counts.get(roomId) || 0) + 1);
  }
  return counts;
}

async function countSchedulesForVenuesInRound(tenantId: number, roundId: number, venueIds: number[], transacting?: any) {
  const effectiveIds = Array.from(new Set((venueIds || []).map((item) => Number(item || 0)).filter((item) => item > 0)));
  if (!effectiveIds.length) return new Map<number, number>();
  const rows = await strapi.db.query(EXAM_SCHEDULE_UID).findMany({
    where: mergeTenantWhere({
      examRound: { id: { $eq: roundId } },
      examVenue: { id: { $in: effectiveIds } },
      status: { $in: ['draft', 'scheduled', 'published', 'in_progress'] },
    }, tenantId),
    select: ['id'],
    populate: { examVenue: { select: ['id'] } },
    ...(transacting ? { transacting } : {}),
  } as any) as any[];

  const counts = new Map<number, number>();
  for (const row of rows || []) {
    const venueId = Number(extractRelationRef(row?.examVenue) || row?.examVenue?.id || 0);
    if (!venueId) continue;
    counts.set(venueId, (counts.get(venueId) || 0) + 1);
  }
  return counts;
}

function buildVenueRoomReadiness(round: any, venues: any[], rooms: any[]) {
  const activeComponents = Array.isArray(round?.examRoundComponents)
    ? round.examRoundComponents.filter((item: any) => normalizeText(item?.status).toLowerCase() === 'active')
    : [];
  const requiresPhysicalRooms = activeComponents.length > 0;
  const blockingReasons: string[] = [];
  const warnings: Array<{ code: string; message: string }> = [];
  const activeVenues = venues.filter((item) => item?.isActive === true);
  const activeRooms = rooms.filter((item) => item?.isActive === true && item?.examVenue?.isActive === true);
  const zeroCapacityRooms = rooms.filter((item) => Number(item?.capacity || 0) <= 0);
  const inactiveVenues = venues.filter((item) => item?.isActive !== true);
  const inactiveRooms = rooms.filter((item) => item?.isActive !== true || item?.examVenue?.isActive !== true);

  if (venues.length === 0) blockingReasons.push('NO_SELECTED_VENUES');
  if (requiresPhysicalRooms && activeRooms.length === 0) blockingReasons.push('NO_ACTIVE_ROOMS');
  if (zeroCapacityRooms.length > 0) blockingReasons.push('ROOM_CAPACITY_INVALID');
  if (inactiveVenues.length > 0) warnings.push({ code: 'INACTIVE_VENUE_SELECTED', message: 'Đợt thi đang chứa địa điểm đã ngừng sử dụng.' });
  if (inactiveRooms.length > 0) warnings.push({ code: 'INACTIVE_ROOM_SELECTED', message: 'Đợt thi đang chứa phòng thi đã ngừng sử dụng.' });
  if (zeroCapacityRooms.length > 0) warnings.push({ code: 'ZERO_CAPACITY_ROOM_SELECTED', message: 'Có phòng thi có sức chứa bằng 0 nên chưa sẵn sàng tạo lịch.' });

  return {
    readyForScheduling: blockingReasons.length === 0,
    blockingReasons,
    warnings,
    summary: {
      venueCount: venues.length,
      activeVenueCount: activeVenues.length,
      roomCount: rooms.length,
      activeRoomCount: activeRooms.length,
      totalCapacity: rooms.reduce((total, item) => total + Math.max(0, Number(item?.capacity || 0)), 0),
      inactiveVenueCount: inactiveVenues.length,
      inactiveRoomCount: inactiveRooms.length,
      zeroCapacityRoomCount: zeroCapacityRooms.length,
    },
  };
}

function normalizeOptionalReasonInput(payload: Record<string, unknown>): OptionalReasonInput {
  ensureNoUnknownFields(payload, ['reason'], 'payload');
  const reason = normalizeOptionalText(payload.reason, 2000);
  return { reason };
}

function normalizePauseReasonInput(payload: Record<string, unknown>): RequiredPauseReasonInput {
  ensureNoUnknownFields(payload, ['reason'], 'payload');
  const reason = normalizeText(payload.reason);
  if (!reason) {
    httpError(400, 'reason is required', 'REGISTRATION_PAUSE_REASON_REQUIRED');
  }
  if (reason.length > 2000) {
    httpError(400, 'reason max length is 2000', 'REGISTRATION_PAUSE_REASON_REQUIRED');
  }
  return { reason };
}

function normalizeEligibilityStatus(value: unknown, fieldName: string, fallback: EligibilityStatus = 'pending'): EligibilityStatus {
  const text = normalizeText(value).toLowerCase();
  if (!text) return fallback;
  if (!['pending', 'eligible', 'temporarily_ineligible', 'ineligible'].includes(text)) {
    httpError(400, `${fieldName} is invalid`, 'INVALID_ELIGIBILITY_STATUS');
  }
  return text as EligibilityStatus;
}

function normalizeEligibilitySource(value: unknown, fieldName: string, fallback: EligibilitySource): EligibilitySource {
  const text = normalizeText(value).toLowerCase();
  if (!text) return fallback;
  if (!['synchronized', 'imported', 'manual', 'rule_based'].includes(text)) {
    httpError(400, `${fieldName} is invalid`, 'INVALID_ELIGIBILITY_SOURCE');
  }
  return text as EligibilitySource;
}

function normalizeDuplicateHandling(value: unknown): DuplicateHandling {
  const text = normalizeText(value).toLowerCase();
  if (!text) return 'skip';
  if (!['reject', 'skip', 'update'].includes(text)) {
    httpError(400, 'duplicateHandling is invalid', 'INVALID_DUPLICATE_HANDLING');
  }
  return text as DuplicateHandling;
}

function assertEligibilityReasonRequired(status: EligibilityStatus, reason: string | null) {
  if ((status === 'temporarily_ineligible' || status === 'ineligible') && !normalizeText(reason)) {
    httpError(400, 'reason is required', 'ELIGIBILITY_REASON_REQUIRED');
  }
}

function normalizeCreateEligibilityInput(payload: Record<string, unknown>): CreateEligibilityInput {
  ensureNoUnknownFields(payload, ['learnerId', 'eligibilityStatus', 'source', 'reason', 'note'], 'payload');
  const learnerId = normalizePositiveInteger(payload.learnerId, 'learnerId');
  const eligibilityStatus = normalizeEligibilityStatus(payload.eligibilityStatus, 'eligibilityStatus', 'pending');
  const source = normalizeEligibilitySource(payload.source, 'source', 'manual');
  const reason = normalizeOptionalText(payload.reason, 2000);
  const note = normalizeOptionalText(payload.note, 2000);
  assertEligibilityReasonRequired(eligibilityStatus, reason);
  return { learnerId, eligibilityStatus, source, reason, note };
}

function normalizeBulkCreateEligibilitiesInput(payload: Record<string, unknown>): BulkCreateEligibilitiesInput {
  ensureNoUnknownFields(payload, ['items', 'source', 'duplicateHandling'], 'payload');
  if (!Array.isArray(payload.items) || payload.items.length === 0) {
    httpError(400, 'items is required', 'BULK_ITEMS_REQUIRED');
  }
  if (payload.items.length > ELIGIBILITY_BULK_LIMIT) {
    httpError(400, `items exceeds limit ${ELIGIBILITY_BULK_LIMIT}`, 'BULK_LIMIT_EXCEEDED');
  }

  const seenLearnerIds = new Set<number>();
  const items = payload.items.map((entry, index) => {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
      httpError(400, `items[${index}] is invalid`, 'BULK_ITEMS_REQUIRED');
    }
    const item = entry as Record<string, unknown>;
    ensureNoUnknownFields(item, ['learnerId', 'eligibilityStatus', 'reason', 'note'], 'item');
    const learnerId = normalizePositiveInteger(item.learnerId, 'learnerId');
    if (seenLearnerIds.has(learnerId)) {
      httpError(400, 'Duplicate learnerId in payload', 'DUPLICATE_LEARNER_IN_PAYLOAD', { learnerId });
    }
    seenLearnerIds.add(learnerId);
    const eligibilityStatus = normalizeEligibilityStatus(item.eligibilityStatus, 'eligibilityStatus', 'pending');
    const reason = normalizeOptionalText(item.reason, 2000);
    const note = normalizeOptionalText(item.note, 2000);
    assertEligibilityReasonRequired(eligibilityStatus, reason);
    return { learnerId, eligibilityStatus, reason, note };
  });

  return {
    items,
    source: normalizeEligibilitySource(payload.source, 'source', 'imported'),
    duplicateHandling: normalizeDuplicateHandling(payload.duplicateHandling),
  };
}

function normalizeUpdateEligibilityInput(payload: Record<string, unknown>): UpdateEligibilityInput {
  ensureNoUnknownFields(payload, ['eligibilityStatus', 'reason', 'note'], 'payload');
  const hasStatus = Object.prototype.hasOwnProperty.call(payload, 'eligibilityStatus');
  if (!hasStatus) {
    httpError(400, 'eligibilityStatus is required', 'INVALID_ELIGIBILITY_STATUS');
  }
  const eligibilityStatus = normalizeEligibilityStatus(payload.eligibilityStatus, 'eligibilityStatus');
  const reason = normalizeOptionalText(payload.reason, 2000);
  const note = normalizeOptionalText(payload.note, 2000);
  assertEligibilityReasonRequired(eligibilityStatus, reason);
  return { eligibilityStatus, reason, note };
}

function normalizeMarkIneligibleInput(payload: Record<string, unknown>): { reason: string; note: string | null } {
  ensureNoUnknownFields(payload, ['reason', 'note'], 'payload');
  const reason = normalizeText(payload.reason);
  if (!reason) {
    httpError(400, 'reason is required', 'ELIGIBILITY_REASON_REQUIRED');
  }
  if (reason.length > 2000) {
    httpError(400, 'reason max length is 2000', 'ELIGIBILITY_REASON_REQUIRED');
  }
  const note = normalizeOptionalText(payload.note, 2000);
  return { reason, note };
}

function isExamEligibilityEditableStatus(status: unknown): boolean {
  const normalized = normalizeText(status).toLowerCase();
  return normalized === 'approved' || normalized === 'registration_open' || normalized === 'registration_paused';
}

function assertExamEligibilityEditableRound(round: any) {
  if (!isExamEligibilityEditableStatus(round?.status)) {
    httpError(409, 'Exam eligibility cannot be edited for the current exam round status.', 'EXAM_ELIGIBILITY_NOT_EDITABLE');
  }
}

function mapEligibilityLearnerSummary(learner: any) {
  return {
    id: Number(learner?.id || 0),
    code: normalizeText(learner?.code),
    fullName: normalizeText(learner?.fullName),
    dateOfBirth: normalizeText(learner?.dateOfBirth) || null,
    parentPhone: normalizeText(learner?.parentPhone) || null,
    learnerStatus: normalizeText(learner?.learnerStatus) || 'active',
    className: null,
    cohort: null,
    major: null,
  };
}

function mapEligibilityRow(row: any, options: { includeTimestamps?: boolean; includeReviewedBy?: boolean; registrationSummary?: any | null } = {}) {
  return {
    id: Number(row?.id || 0),
    examRoundId: Number(extractRelationRef(row?.examRound) || row?.examRound?.id || 0) || null,
    learner: row?.learner ? mapEligibilityLearnerSummary(row.learner) : null,
    eligibilityStatus: normalizeEligibilityStatus(row?.eligibilityStatus, 'eligibilityStatus', 'pending'),
    source: normalizeEligibilitySource(row?.source, 'source', 'manual'),
    reason: normalizeOptionalText(row?.reason),
    note: normalizeOptionalText(row?.note),
    reviewedAt: normalizeStoredDateTime(row?.reviewedAt),
    ...(options.includeReviewedBy
      ? { reviewedBy: summarizeWorkflowActor(row?.reviewedBy ? { id: row.reviewedBy.id, username: row.reviewedBy.username, fullName: row.reviewedBy.fullName, email: row.reviewedBy.email } : null) }
      : {}),
    ...(options.includeTimestamps
      ? { createdAt: normalizeStoredDateTime(row?.createdAt), updatedAt: normalizeStoredDateTime(row?.updatedAt) }
      : {}),
    registrationSummary: options.registrationSummary ? mapExistingRegistrationSummary(options.registrationSummary) : null,
  };
}

function resolveRegistrationWindowState(round: any, now = new Date()): RegistrationWindowState {
  const registrationStartAt = normalizeStoredDateTime(round?.registrationStartAt);
  const registrationEndAt = normalizeStoredDateTime(round?.registrationEndAt);
  const nowTimestamp = now.getTime();
  if (registrationStartAt && nowTimestamp < Date.parse(registrationStartAt)) {
    return 'before_registration_window';
  }
  if (registrationEndAt && nowTimestamp > Date.parse(registrationEndAt)) {
    return 'after_registration_window';
  }
  return 'within_registration_window';
}

function mapRegistrationWindowStatus(state: RegistrationWindowState): RegistrationWindowStatus {
  if (state === 'before_registration_window') return 'before';
  if (state === 'after_registration_window') return 'after';
  return 'within';
}

function buildRegistrationAvailabilityResult(round: any, structure: MutableExamRoundStructure, now = new Date()) {
  const registrationWindowState = resolveRegistrationWindowState(round, now);
  const registrationWindowStatus = mapRegistrationWindowStatus(registrationWindowState);
  const roundStatus = normalizeText(round?.status).toLowerCase();

  if (roundStatus !== 'registration_open') {
    if (roundStatus === 'approved' || roundStatus === 'registration_paused' || roundStatus === 'registration_closed') {
      return {
        canRegister: false,
        reasonCode: 'EXAM_REGISTRATION_NOT_OPEN',
        registrationWindowStatus,
      };
    }

    return {
      canRegister: false,
      reasonCode: 'EXAM_ROUND_NOT_READY_FOR_REGISTRATION',
      registrationWindowStatus,
    };
  }

  const readinessErrors = collectExamRoundReadinessErrors(round, structure);
  if (readinessErrors.length > 0) {
    return {
      canRegister: false,
      reasonCode: 'EXAM_ROUND_NOT_READY_FOR_REGISTRATION',
      registrationWindowStatus,
    };
  }

  if (registrationWindowState === 'before_registration_window') {
    return {
      canRegister: false,
      reasonCode: 'EXAM_REGISTRATION_NOT_STARTED',
      registrationWindowStatus,
    };
  }

  if (registrationWindowState === 'after_registration_window') {
    return {
      canRegister: false,
      reasonCode: 'EXAM_REGISTRATION_WINDOW_EXPIRED',
      registrationWindowStatus,
    };
  }

  return {
    canRegister: true,
    reasonCode: null,
    registrationWindowStatus,
  };
}

function throwRegistrationAvailabilityError(reasonCode: string) {
  if (reasonCode === 'EXAM_REGISTRATION_NOT_OPEN') {
    httpError(409, 'Đợt thi hiện chưa mở đăng ký.', reasonCode);
  }
  if (reasonCode === 'EXAM_REGISTRATION_NOT_STARTED') {
    httpError(409, 'Chưa tới thời điểm mở đăng ký.', reasonCode);
  }
  if (reasonCode === 'EXAM_REGISTRATION_WINDOW_EXPIRED') {
    httpError(409, 'Cửa sổ đăng ký đã kết thúc.', reasonCode);
  }
  httpError(409, 'Đợt thi chưa sẵn sàng để learner đăng ký.', 'EXAM_ROUND_NOT_READY_FOR_REGISTRATION');
}

export async function resolveCurrentLearner(ctx: any, tenantId: number, options: { transacting?: any } = {}): Promise<CurrentLearner> {
  const authUserId = Number(ctx?.state?.user?.id || 0);
  if (!Number.isInteger(authUserId) || authUserId <= 0) {
    httpError(401, 'Unauthorized', 'UNAUTHORIZED');
  }

  const learners = await strapi.db.query(LEARNER_UID).findMany({
    where: mergeTenantWhere({
      user: {
        id: {
          $eq: authUserId,
        },
      },
    }, tenantId),
    select: ['id', 'documentId', 'code', 'fullName', 'dateOfBirth', 'learnerStatus'],
    orderBy: [{ id: 'asc' }],
    ...(options.transacting ? { transacting: options.transacting } : {}),
  } as any) as any[];

  if (learners.length === 0) {
    httpError(403, 'Người dùng hiện tại không có learner trong tenant này.', 'CURRENT_USER_HAS_NO_LEARNER');
  }

  if (learners.length > 1) {
    httpError(409, 'Người dùng hiện tại có nhiều learner trong cùng tenant.', 'CURRENT_USER_HAS_MULTIPLE_LEARNERS');
  }

  const learner = learners[0];
  const enrollments = await strapi.db.query(ENROLLMENT_UID).findMany({
    where: mergeTenantWhere({
      learner: {
        id: {
          $eq: Number(learner.id),
        },
      },
      enrollmentStatus: 'active',
    }, tenantId),
    select: ['id'],
    populate: {
      class: {
        select: ['id', 'name'],
        populate: {
          tenant: { select: ['id'] },
        },
      },
    },
    orderBy: [{ id: 'asc' }],
    ...(options.transacting ? { transacting: options.transacting } : {}),
  } as any) as any[];

  const classNames = new Set<string>();
  for (const enrollment of enrollments) {
    const classTenantId = Number(extractRelationRef(enrollment?.class?.tenant) || enrollment?.class?.tenant?.id || 0);
    if (classTenantId > 0 && classTenantId !== tenantId) {
      continue;
    }
    const className = normalizeText(enrollment?.class?.name);
    if (className) classNames.add(className);
  }

  return {
    id: Number(learner.id),
    documentId: learner.documentId || null,
    code: normalizeText(learner.code),
    fullName: normalizeText(learner.fullName),
    dateOfBirth: normalizeStoredDateTime(learner.dateOfBirth) || normalizeText(learner.dateOfBirth) || null,
    learnerStatus: normalizeText(learner.learnerStatus) || 'active',
    className: classNames.size === 1 ? Array.from(classNames)[0] : null,
    cohort: null,
    major: null,
  };
}

async function loadLearnerSupportInfo(tenantId: number, transacting?: any): Promise<LearnerSupportInfo> {
  const tenant = await strapi.db.query(TENANT_UID).findOne({
    where: { id: tenantId },
    select: ['id', 'name', 'shortName', 'siteTitle', 'slogan', 'siteDescription', 'description'],
    ...(transacting ? { transacting } : {}),
  } as any) as any;

  return {
    organizationName: normalizeText(tenant?.siteTitle) || normalizeText(tenant?.shortName) || normalizeText(tenant?.name) || null,
    supportPhone: null,
    supportEmail: null,
    supportWebsite: null,
    supportNote: normalizeOptionalText(tenant?.slogan) || normalizeOptionalText(tenant?.siteDescription) || normalizeOptionalText(tenant?.description) || null,
  };
}

function mapCurrentLearnerProfile(learner: CurrentLearner) {
  return {
    id: learner.id,
    documentId: learner.documentId || null,
    code: learner.code,
    fullName: learner.fullName,
    dateOfBirth: learner.dateOfBirth || null,
    className: learner.className || null,
  };
}

function mapPortalUser(authUser: AuthUser | null | undefined) {
  if (!authUser?.id) return null;
  return {
    id: Number(authUser.id),
    username: normalizeText(authUser.username) || null,
    fullName: normalizeText(authUser.fullName) || null,
    email: normalizeText(authUser.email) || null,
  };
}

async function loadPortalUserProfile(userId: number, transacting?: any) {
  const user = await strapi.db.query('plugin::users-permissions.user').findOne({
    where: { id: userId },
    select: ['id', 'username', 'email', 'fullName', 'phone'],
    ...(transacting ? { transacting } : {}),
  } as any) as any;

  if (!user?.id) {
    httpError(401, 'Unauthorized', 'UNAUTHORIZED');
  }

  return {
    id: Number(user.id),
    displayName: normalizeText(user.fullName) || normalizeText(user.username) || normalizeText(user.email),
    email: normalizeEmail(user.email, 'email'),
    phone: normalizeOptionalText(user.phone, 30),
    username: normalizeText(user.username) || null,
  };
}

async function resolveCurrentLearnerOptional(ctx: any, tenantId: number, options: { transacting?: any } = {}): Promise<CurrentLearner | null> {
  try {
    return await resolveCurrentLearner(ctx, tenantId, options);
  } catch (error: any) {
    if (error instanceof HttpError && error.code === 'CURRENT_USER_HAS_NO_LEARNER') {
      return null;
    }
    throw error;
  }
}

async function findLearnerByCodeInTenant(tenantId: number, code: string, transacting?: any) {
  return await strapi.db.query(LEARNER_UID).findOne({
    where: mergeTenantWhere({ code: { $eqi: code } }, tenantId),
    select: ['id', 'documentId', 'code', 'fullName', 'dateOfBirth', 'parentPhone', 'learnerStatus'],
    populate: {
      user: { select: ['id', 'username', 'fullName', 'email'] },
    },
    ...(transacting ? { transacting } : {}),
  } as any) as any;
}

async function findPotentialDuplicateLearnerInTenant(tenantId: number, input: CreateLearnerProfileInput, transacting?: any) {
  const rows = await strapi.db.query(LEARNER_UID).findMany({
    where: mergeTenantWhere({
      code: { $nei: input.code },
      $or: [
        {
          $and: [
            { fullName: { $eqi: input.fullName } },
            { dateOfBirth: { $eq: input.dateOfBirth } },
          ],
        },
        {
          $and: [
            { fullName: { $eqi: input.fullName } },
            { parentPhone: { $eq: input.phone } },
          ],
        },
      ],
    }, tenantId),
    select: ['id'],
    limit: 1,
    ...(transacting ? { transacting } : {}),
  } as any) as any[];

  return rows[0] || null;
}

async function acquireLearnerProfileUserLock(trx: any, tenantId: number, userId: number) {
  if (!isPostgresClient()) return;
  await trx.raw('select pg_advisory_xact_lock(hashtext(?), hashtext(?))', [String(tenantId), `learner-profile-user:${userId}`]);
}

async function acquireLearnerCodeLock(trx: any, tenantId: number, code: string) {
  if (!isPostgresClient()) return;
  await trx.raw('select pg_advisory_xact_lock(hashtext(?), hashtext(?))', [String(tenantId), `learner-code:${code.toLowerCase()}`]);
}

async function buildLearnerProfileContext(ctx: any, tenantId: number, roundRef: unknown, authUser: AuthUser, options: { transacting?: any } = {}) {
  const round = await findExamRoundByRef(tenantId, roundRef, options.transacting);
  const learner = await resolveCurrentLearnerOptional(ctx, tenantId, options);
  const workflowRound = await loadExamRoundWorkflowContext(tenantId, Number(round.id), options.transacting);
  const structure = await loadExamRoundStructure(tenantId, Number(round.id), options.transacting, { requireDraft: false });
  const eligibility = learner ? await findLearnerEligibilityForRound(tenantId, Number(round.id), learner.id, options.transacting) : null;
  const existingRegistration = learner ? await findExistingEffectiveRegistration(tenantId, Number(round.id), learner.id, options.transacting) : null;
  const availabilityDecision = buildLearnerFacingRoundAvailability(workflowRound, learner, structure, eligibility, existingRegistration);
  const userProfile = await loadPortalUserProfile(Number(authUser.id), options.transacting);

  return {
    examRound: {
      id: Number(workflowRound.id),
      documentId: workflowRound.documentId || null,
      code: normalizeText(workflowRound.code),
      name: normalizeText(workflowRound.name),
      registrationMode: normalizeText(workflowRound.registrationMode).toLowerCase() || null,
      status: normalizeText(workflowRound.status).toLowerCase() || null,
      registrationStartAt: normalizeStoredDateTime(workflowRound.registrationStartAt),
      registrationEndAt: normalizeStoredDateTime(workflowRound.registrationEndAt),
    },
    userProfile,
    learner: learner ? mapCurrentLearnerProfile(learner) : null,
    learnerState: learner ? 'linked' : 'missing',
    support: await loadLearnerSupportInfo(tenantId, options.transacting),
    existingRegistration: mapExistingRegistrationSummary(existingRegistration),
    eligibility: mapLearnerFacingEligibilityState(workflowRound, availabilityDecision.eligibilityDecision),
    canCreateLearnerForRound: learner === null && availabilityDecision.requiresLearnerCreation === true && availabilityDecision.canRegister === true,
    canContinueRegistration: learner !== null && availabilityDecision.canRegister === true,
    reasonCode: learner === null && availabilityDecision.requiresLearnerCreation === true && availabilityDecision.canRegister === true
      ? 'LEARNER_PROFILE_REQUIRED'
      : availabilityDecision.reasonCode,
  };
}

async function resolveCurrentLearnerForPortal(ctx: any, tenantId: number, options: { transacting?: any } = {}): Promise<CurrentLearner> {
  try {
    return await resolveCurrentLearner(ctx, tenantId, options);
  } catch (error: any) {
    if (error instanceof HttpError && error.code === 'CURRENT_USER_HAS_NO_LEARNER') {
      const support = await loadLearnerSupportInfo(tenantId, options.transacting);
      httpError(403, 'Tài khoản hiện tại chưa được liên kết với learner nào trong tenant này.', 'LEARNER_NOT_LINKED_TO_USER', support);
    }
    throw error;
  }
}

function normalizeLearnerFacingRoundReasonCode(roundStatus: string, registrationWindowStatus: RegistrationWindowStatus): string | null {
  if (roundStatus === 'registration_paused') return 'EXAM_ROUND_REGISTRATION_PAUSED';
  if (roundStatus === 'registration_closed') return 'EXAM_ROUND_REGISTRATION_CLOSED';
  if (roundStatus === 'approved' && registrationWindowStatus === 'before') return 'REGISTRATION_WINDOW_NOT_STARTED';
  if (registrationWindowStatus === 'after') return 'REGISTRATION_WINDOW_ENDED';
  if (roundStatus === 'approved') return 'EXAM_ROUND_REGISTRATION_NOT_OPEN';
  if (roundStatus === 'registration_open' && registrationWindowStatus === 'before') return 'REGISTRATION_WINDOW_NOT_STARTED';
  return 'EXAM_ROUND_NOT_AVAILABLE';
}

function summarizeRichText(value: unknown, maxLength = 240): string | null {
  const text = normalizeText(value).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  if (!text) return null;
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength - 1).trim()}…`;
}

function assertLearnerProfileComplete(learner: CurrentLearner) {
  const missingFields: string[] = [];
  if (!normalizeText(learner.code)) missingFields.push('code');
  if (!normalizeText(learner.fullName)) missingFields.push('fullName');
  if (missingFields.length > 0) {
    httpError(409, 'Hồ sơ learner chưa đầy đủ để đăng ký dự thi.', 'LEARNER_PROFILE_INCOMPLETE', {
      fields: missingFields,
    });
  }
}

function normalizePositiveIdArray(value: unknown, fieldName: string, duplicateCode: string): number[] {
  if (typeof value === 'undefined') return [];
  if (!Array.isArray(value)) {
    httpError(400, `${fieldName} must be an array`, 'INVALID_REQUEST_BODY');
  }
  const parsed = value.map((entry) => normalizePositiveInteger(entry, fieldName));
  const unique = new Set<number>();
  for (const item of parsed) {
    if (unique.has(item)) {
      httpError(400, `${fieldName} contains duplicate values`, duplicateCode, { [fieldName]: parsed });
    }
    unique.add(item);
  }
  return parsed;
}

function normalizeSelfRegistrationInput(payload: Record<string, unknown>): SelfRegistrationInput {
  ensureNoUnknownFields(payload, ['subjectIds', 'componentIds', 'note'], 'payload');
  return {
    subjectIds: normalizePositiveIdArray(payload.subjectIds, 'subjectIds', 'DUPLICATE_SUBJECT_SELECTION'),
    componentIds: normalizePositiveIdArray(payload.componentIds, 'componentIds', 'DUPLICATE_COMPONENT_SELECTION'),
    note: normalizeOptionalText(payload.note, 2000),
    hasSubjectIds: hasOwn(payload, 'subjectIds'),
    hasComponentIds: hasOwn(payload, 'componentIds'),
  };
}

async function findLearnerEligibilityForRound(tenantId: number, roundId: number, learnerId: number, transacting?: any) {
  const rows = await strapi.db.query(EXAM_ELIGIBILITY_UID).findMany({
    where: mergeTenantWhere({
      examRound: { id: { $eq: roundId } },
      learner: { id: { $eq: learnerId } },
    }, tenantId),
    select: ['id', 'eligibilityStatus', 'reason'],
    orderBy: [{ id: 'desc' }],
    limit: 1,
    ...(transacting ? { transacting } : {}),
  } as any) as any[];
  return rows[0] || null;
}

function evaluateLearnerEligibility(round: any, eligibility: any): EligibilityDecision {
  const registrationMode = normalizeText(round?.registrationMode).toLowerCase();
  const status = eligibility
    ? normalizeEligibilityStatus(eligibility.eligibilityStatus, 'eligibilityStatus', 'pending')
    : null;
  const reason = normalizeOptionalText(eligibility?.reason);

  if (registrationMode === 'open') {
    if (status === null || status === 'eligible') {
      return { status, reason, canRegister: true, reasonCode: null };
    }
    if (status === 'pending') {
      return { status, reason, canRegister: false, reasonCode: 'EXAM_ELIGIBILITY_PENDING' };
    }
    if (status === 'temporarily_ineligible') {
      return { status, reason, canRegister: false, reasonCode: 'EXAM_LEARNER_TEMPORARILY_INELIGIBLE' };
    }
    return { status, reason, canRegister: false, reasonCode: 'EXAM_LEARNER_NOT_ELIGIBLE' };
  }

  if (status === 'eligible') {
    return { status, reason, canRegister: true, reasonCode: null };
  }
  if (status === 'pending') {
    return { status, reason, canRegister: false, reasonCode: 'EXAM_ELIGIBILITY_PENDING' };
  }
  if (status === 'temporarily_ineligible') {
    return { status, reason, canRegister: false, reasonCode: 'EXAM_LEARNER_TEMPORARILY_INELIGIBLE' };
  }
  return { status, reason, canRegister: false, reasonCode: 'EXAM_LEARNER_NOT_ELIGIBLE' };
}

function throwEligibilityDecisionError(decision: EligibilityDecision) {
  if (decision.reasonCode === 'EXAM_ELIGIBILITY_PENDING') {
    httpError(409, 'Learner đang chờ xét điều kiện dự thi.', decision.reasonCode);
  }
  if (decision.reasonCode === 'EXAM_LEARNER_TEMPORARILY_INELIGIBLE') {
    httpError(409, 'Learner hiện tạm thời chưa đủ điều kiện dự thi.', decision.reasonCode);
  }
  httpError(409, 'Learner không đủ điều kiện đăng ký dự thi.', decision.reasonCode || 'EXAM_LEARNER_NOT_ELIGIBLE');
}

async function findExistingEffectiveRegistration(tenantId: number, roundId: number, learnerId: number, transacting?: any) {
  const rows = await strapi.db.query(EXAM_REGISTRATION_UID).findMany({
    where: mergeTenantWhere({
      examRound: { id: { $eq: roundId } },
      learner: { id: { $eq: learnerId } },
      registrationStatus: {
        $notIn: ['cancelled', 'rejected'],
      },
    }, tenantId),
    select: [
      'id',
      'documentId',
      'registrationCode',
      'registrationStatus',
      'paymentStatus',
      'payableAmount',
      'registeredAt',
    ],
    orderBy: [{ registeredAt: 'desc' }, { id: 'desc' }],
    limit: 1,
    ...(transacting ? { transacting } : {}),
  } as any) as any[];
  return rows[0] || null;
}

function mapExistingRegistrationSummary(registration: any) {
  if (!registration?.id) return null;
  return {
    id: Number(registration.id),
    documentId: registration.documentId || null,
    registrationCode: normalizeText(registration.registrationCode),
    registrationStatus: normalizeText(registration.registrationStatus) || null,
    paymentStatus: normalizeText(registration.paymentStatus) || null,
    payableAmount: toMoney(registration.payableAmount, 0),
    registeredAt: normalizeStoredDateTime(registration.registeredAt),
  };
}

function mapLearnerFacingEligibilityState(round: any, decision: EligibilityDecision) {
  const registrationMode = normalizeText(round?.registrationMode).toLowerCase() || null;
  if (registrationMode === 'open' && decision.status === null) {
    return {
      registrationMode,
      status: null,
      reason: null,
    };
  }

  return {
    registrationMode,
    status: decision.status,
    reason: decision.reason,
  };
}

function buildLearnerFacingRoundAvailability(round: any, learner: CurrentLearner | null, structure: MutableExamRoundStructure | null, eligibility: any, existingRegistration: any): {
  learnerState: 'linked' | 'missing';
  registrationWindowStatus: RegistrationWindowStatus;
  requiresLearnerCreation: boolean;
  canRegister: boolean;
  reasonCode: string | null;
  eligibilityDecision: EligibilityDecision;
} {
  const roundStatus = normalizeText(round?.status).toLowerCase();
  const registrationMode = normalizeText(round?.registrationMode).toLowerCase();
  const registrationWindowStatus = mapRegistrationWindowStatus(resolveRegistrationWindowState(round));
  const availability = structure
    ? buildRegistrationAvailabilityResult(round, structure)
    : {
        canRegister: false,
        reasonCode: normalizeLearnerFacingRoundReasonCode(roundStatus, registrationWindowStatus),
        registrationWindowStatus,
      };

  const baseReasonCode = !availability.canRegister
    ? availability.reasonCode
    : null;

  if (existingRegistration?.id) {
    return {
      learnerState: learner ? 'linked' : 'missing',
      registrationWindowStatus,
      requiresLearnerCreation: false,
      canRegister: false,
      reasonCode: 'EXAM_REGISTRATION_ALREADY_EXISTS',
      eligibilityDecision: learner ? evaluateLearnerEligibility(round, eligibility) : { status: null, reason: null, canRegister: registrationMode === 'open', reasonCode: null },
    };
  }

  if (registrationMode === 'open') {
    if (!learner) {
      return {
        learnerState: 'missing',
        registrationWindowStatus,
        requiresLearnerCreation: availability.canRegister,
        canRegister: availability.canRegister,
        reasonCode: availability.canRegister ? null : (baseReasonCode || 'EXAM_ROUND_OPEN_FOR_PROFILE_CREATION'),
        eligibilityDecision: { status: null, reason: null, canRegister: true, reasonCode: null },
      };
    }

    const eligibilityDecision = evaluateLearnerEligibility(round, eligibility);
    return {
      learnerState: 'linked',
      registrationWindowStatus,
      requiresLearnerCreation: false,
      canRegister: availability.canRegister,
      reasonCode: baseReasonCode,
      eligibilityDecision,
    };
  }

  if (!learner) {
    return {
      learnerState: 'missing',
      registrationWindowStatus,
      requiresLearnerCreation: false,
      canRegister: false,
      reasonCode: 'LEARNER_REQUIRED_FOR_RESTRICTED_ROUND',
      eligibilityDecision: { status: null, reason: null, canRegister: false, reasonCode: 'LEARNER_REQUIRED_FOR_RESTRICTED_ROUND' },
    };
  }

  const eligibilityDecision = evaluateLearnerEligibility(round, eligibility);
  return {
    learnerState: 'linked',
    registrationWindowStatus,
    requiresLearnerCreation: false,
    canRegister: availability.canRegister && eligibilityDecision.canRegister,
    reasonCode: !availability.canRegister
      ? baseReasonCode
      : !eligibilityDecision.canRegister
        ? (eligibilityDecision.reasonCode || 'LEARNER_NOT_ELIGIBLE')
        : null,
    eligibilityDecision,
  };
}

function mapLearnerFacingRoundListItem(round: any, options: {
  eligibilityDecision: EligibilityDecision;
  existingRegistration: any | null;
  registrationWindowStatus: RegistrationWindowStatus;
  canRegister: boolean;
  reasonCode: string | null;
  learnerState: 'linked' | 'missing';
  requiresLearnerCreation: boolean;
}) {
  return {
    id: Number(round?.id || 0),
    documentId: round?.documentId || null,
    code: normalizeText(round?.code),
    name: normalizeText(round?.name),
    shortDescription: summarizeRichText(round?.instructions) || summarizeRichText(round?.paymentInstructions),
    academicYear: normalizeText(round?.academicYear) || null,
    semester: normalizeText(round?.semester) || null,
    registrationStartAt: normalizeStoredDateTime(round?.registrationStartAt),
    registrationEndAt: normalizeStoredDateTime(round?.registrationEndAt),
    examStartAt: normalizeStoredDateTime(round?.examStartAt),
    examEndAt: normalizeStoredDateTime(round?.examEndAt),
    registrationMode: normalizeText(round?.registrationMode).toLowerCase() || null,
    paymentCalculationMethod: normalizeText(round?.paymentCalculationMethod).toLowerCase() || null,
    fixedFee: toMoney(round?.fixedFee, 0),
    status: normalizeText(round?.status).toLowerCase() || null,
    learnerState: options.learnerState,
    requiresLearnerCreation: options.requiresLearnerCreation,
    registrationWindowState: options.registrationWindowStatus,
    canRegister: options.canRegister,
    canView: true,
    reasonCode: options.reasonCode,
    eligibility: mapLearnerFacingEligibilityState(round, options.eligibilityDecision),
    existingRegistration: mapExistingRegistrationSummary(options.existingRegistration),
  };
}

function normalizeLearnerRoundListQuery(query: Record<string, unknown>) {
  const page = toPositiveInt(query.page, 1);
  const pageSize = Math.min(50, toPositiveInt(query.pageSize, 12));
  const search = normalizeText(query.search);
  return { page, pageSize, search };
}

function buildLearnerFacingExamRoundWhere(query: { search: string }) {
  const clauses: any[] = [
    {
      status: {
        $in: ['approved', 'registration_open', 'registration_paused', 'registration_closed', 'preparing_exam', 'exam_in_progress', 'scoring', 'completed'],
      },
    },
  ];

  if (query.search) {
    clauses.push({
      $or: [
        { code: { $containsi: query.search } },
        { name: { $containsi: query.search } },
      ],
    });
  }

  return clauses.length > 1 ? { $and: clauses } : clauses[0];
}

async function buildLearnerFacingRoundAccessRecords(tenantId: number, learner: CurrentLearner | null, rounds: any[]) {
  const roundIds = rounds.map((round) => Number(round?.id || 0)).filter((value) => value > 0);
  if (roundIds.length === 0) return [];

  const [eligibilityRows, registrationRows] = learner ? await Promise.all([
    strapi.db.query(EXAM_ELIGIBILITY_UID).findMany({
      where: mergeTenantWhere({
        examRound: { id: { $in: roundIds } },
        learner: { id: { $eq: learner.id } },
      }, tenantId),
      select: ['id', 'eligibilityStatus', 'reason'],
      populate: {
        examRound: { select: ['id'] },
      },
      orderBy: [{ id: 'desc' }],
    } as any),
    strapi.db.query(EXAM_REGISTRATION_UID).findMany({
      where: mergeTenantWhere({
        examRound: { id: { $in: roundIds } },
        learner: { id: { $eq: learner.id } },
        registrationStatus: {
          $notIn: ['cancelled', 'rejected'],
        },
      }, tenantId),
      select: ['id', 'documentId', 'registrationCode', 'registrationStatus', 'paymentStatus', 'payableAmount', 'registeredAt'],
      populate: {
        examRound: { select: ['id'] },
      },
      orderBy: [{ registeredAt: 'desc' }, { id: 'desc' }],
    } as any),
  ]) : [[], []];

  const eligibilityByRoundId = new Map<number, any>();
  for (const row of eligibilityRows || []) {
    const roundId = Number(extractRelationRef(row?.examRound) || row?.examRound?.id || 0);
    if (!roundId || eligibilityByRoundId.has(roundId)) continue;
    eligibilityByRoundId.set(roundId, row);
  }

  const registrationByRoundId = new Map<number, any>();
  for (const row of registrationRows || []) {
    const roundId = Number(extractRelationRef(row?.examRound) || row?.examRound?.id || 0);
    if (!roundId || registrationByRoundId.has(roundId)) continue;
    registrationByRoundId.set(roundId, row);
  }

  return rounds
    .map((round) => {
      const roundId = Number(round?.id || 0);
      const eligibility = eligibilityByRoundId.get(roundId) || null;
      const existingRegistration = registrationByRoundId.get(roundId) || null;
      const visibilityMode = normalizeText(round?.registrationMode).toLowerCase();
      const canView = Boolean(existingRegistration?.id)
        || visibilityMode === 'open'
        || Boolean(eligibility?.id);

      if (!canView) return null;

      const availabilityDecision = buildLearnerFacingRoundAvailability(round, learner, null, eligibility, existingRegistration);

      return mapLearnerFacingRoundListItem(round, {
        eligibilityDecision: availabilityDecision.eligibilityDecision,
        existingRegistration,
        registrationWindowStatus: availabilityDecision.registrationWindowStatus,
        canRegister: availabilityDecision.canRegister,
        reasonCode: availabilityDecision.reasonCode,
        learnerState: availabilityDecision.learnerState,
        requiresLearnerCreation: availabilityDecision.requiresLearnerCreation,
      });
    })
    .filter(Boolean);
}

function setEquals(left: number[], right: number[]): boolean {
  if (left.length !== right.length) return false;
  const rightSet = new Set(right);
  for (const item of left) {
    if (!rightSet.has(item)) return false;
  }
  return true;
}

function resolveSubjectSelection(structure: MutableExamRoundStructure, input: SelfRegistrationInput): MutableRoundSubject[] {
  const activeSubjects = structure.subjects.filter((subject) => subject.status === 'active');
  const allSubjectsById = new Map<number, MutableRoundSubject>(structure.subjects.map((subject) => [subject.id, subject]));
  const activeSubjectsById = new Map<number, MutableRoundSubject>(activeSubjects.map((subject) => [subject.id, subject]));
  const activeSubjectIds = activeSubjects.map((subject) => subject.id);

  if (!structure.round.allowSubjectSelection) {
    if (input.hasSubjectIds && !setEquals(input.subjectIds, activeSubjectIds)) {
      httpError(400, 'Đợt thi không cho phép learner tự chọn môn.', 'SUBJECT_SELECTION_NOT_ALLOWED');
    }
    if (activeSubjects.length === 0) {
      httpError(400, 'Không có môn thi active để đăng ký.', 'SUBJECT_SELECTION_REQUIRED');
    }
    return activeSubjects;
  }

  const selectedSubjectIds = new Set<number>();
  if (!input.hasSubjectIds) {
    for (const subject of activeSubjects) {
      if (subject.isRequired) {
        selectedSubjectIds.add(subject.id);
      }
    }
  } else {
    for (const subjectId of input.subjectIds) {
      const subject = allSubjectsById.get(subjectId);
      if (!subject || subject.status !== 'active') {
        httpError(400, 'Subject selection is invalid.', 'INVALID_SUBJECT_SELECTION', { examRoundSubjectId: subjectId });
      }
      if (!subject.isRequired && !subject.allowSeparateRegistration) {
        httpError(400, 'Subject selection is invalid.', 'INVALID_SUBJECT_SELECTION', { examRoundSubjectId: subjectId });
      }
      selectedSubjectIds.add(subjectId);
    }

    const missingRequiredSubjectIds = activeSubjects
      .filter((subject) => subject.isRequired && !selectedSubjectIds.has(subject.id))
      .map((subject) => subject.id);

    if (missingRequiredSubjectIds.length > 0) {
      httpError(400, 'Thiếu môn thi bắt buộc.', 'REQUIRED_SUBJECT_MISSING', { examRoundSubjectIds: missingRequiredSubjectIds });
    }
  }

  const selectedSubjects = activeSubjects.filter((subject) => selectedSubjectIds.has(subject.id));
  if (selectedSubjects.length === 0) {
    httpError(400, 'Learner phải chọn ít nhất một môn thi.', 'SUBJECT_SELECTION_REQUIRED');
  }

  for (const subjectId of selectedSubjectIds) {
    if (!activeSubjectsById.has(subjectId)) {
      httpError(400, 'Subject selection is invalid.', 'INVALID_SUBJECT_SELECTION', { examRoundSubjectId: subjectId });
    }
  }

  return selectedSubjects;
}

function resolveComponentSelection(structure: MutableExamRoundStructure, selectedSubjects: MutableRoundSubject[], input: SelfRegistrationInput): SubjectSelection[] {
  const allComponentsById = new Map<number, MutableRoundComponent>();
  const selectedSubjectIds = new Set<number>(selectedSubjects.map((subject) => subject.id));
  for (const subject of structure.subjects) {
    for (const component of subject.components) {
      allComponentsById.set(component.id, component);
    }
  }

  if (!structure.round.allowComponentSelection) {
    const expectedComponentIds = selectedSubjects.flatMap((subject) => subject.components.filter((component) => component.status === 'active').map((component) => component.id));
    if (input.hasComponentIds && !setEquals(input.componentIds, expectedComponentIds)) {
      httpError(400, 'Đợt thi không cho phép learner tự chọn thành phần thi.', 'COMPONENT_SELECTION_NOT_ALLOWED');
    }
    return selectedSubjects.map((subject) => {
      const components = subject.components.filter((component) => component.status === 'active');
      if (components.length === 0) {
        httpError(400, 'Mỗi môn thi phải có ít nhất một thành phần thi.', 'COMPONENT_SELECTION_REQUIRED', { examRoundSubjectId: subject.id });
      }
      return { subject, components };
    });
  }

  const selectedComponentIdsBySubjectId = new Map<number, Set<number>>();
  if (!input.hasComponentIds) {
    for (const subject of selectedSubjects) {
      const set = new Set<number>();
      for (const component of subject.components) {
        if (component.status === 'active' && component.isRequired) {
          set.add(component.id);
        }
      }
      selectedComponentIdsBySubjectId.set(subject.id, set);
    }
  } else {
    for (const componentId of input.componentIds) {
      const component = allComponentsById.get(componentId);
      if (!component || component.status !== 'active') {
        httpError(400, 'Component selection is invalid.', 'INVALID_COMPONENT_SELECTION', { examRoundComponentId: componentId });
      }
      if (!selectedSubjectIds.has(component.examRoundSubjectId)) {
        httpError(400, 'Component không thuộc các môn thi đã chọn.', 'COMPONENT_SUBJECT_MISMATCH', { examRoundComponentId: componentId });
      }
      if (!component.isRequired && !component.allowSeparateRegistration) {
        httpError(400, 'Component selection is invalid.', 'INVALID_COMPONENT_SELECTION', { examRoundComponentId: componentId });
      }
      if (!selectedComponentIdsBySubjectId.has(component.examRoundSubjectId)) {
        selectedComponentIdsBySubjectId.set(component.examRoundSubjectId, new Set<number>());
      }
      selectedComponentIdsBySubjectId.get(component.examRoundSubjectId)?.add(component.id);
    }
  }

  return selectedSubjects.map((subject) => {
    const activeComponents = subject.components.filter((component) => component.status === 'active');
    const selectedIds = selectedComponentIdsBySubjectId.get(subject.id) || new Set<number>();
    const requiredComponentIds = activeComponents.filter((component) => component.isRequired).map((component) => component.id);

    if (input.hasComponentIds) {
      const missingRequiredComponentIds = requiredComponentIds.filter((componentId) => !selectedIds.has(componentId));
      if (missingRequiredComponentIds.length > 0) {
        httpError(400, 'Thiếu thành phần thi bắt buộc.', 'REQUIRED_COMPONENT_MISSING', {
          examRoundSubjectId: subject.id,
          examRoundComponentIds: missingRequiredComponentIds,
        });
      }
    }

    const components = activeComponents.filter((component) => selectedIds.has(component.id));
    if (components.length === 0) {
      httpError(400, 'Mỗi môn thi phải có ít nhất một thành phần thi.', 'COMPONENT_SELECTION_REQUIRED', { examRoundSubjectId: subject.id });
    }

    return { subject, components };
  });
}

function buildDefaultSelection(structure: MutableExamRoundStructure): SubjectSelection[] {
  const defaultSubjects = structure.subjects.filter((subject) => subject.status === 'active' && (!structure.round.allowSubjectSelection || subject.isRequired));
  return defaultSubjects.map((subject) => ({
    subject,
    components: subject.components.filter((component) => component.status === 'active' && (!structure.round.allowComponentSelection || component.isRequired)),
  }));
}

function calculateFeeSummary(round: any, selectedSubjects: SubjectSelection[]): FeeSummary {
  const calculationMethod = normalizeEnum(
    round?.paymentCalculationMethod,
    ['fixed', 'program_fee', 'subject_fee', 'component_fee'],
    'program_fee',
    'paymentCalculationMethod',
  );

  const subjectBreakdown = selectedSubjects.map((item) => {
    const amount = roundMoney(decimalToNumber(item.subject.fee) || 0);
    return {
      examRoundSubjectId: item.subject.id,
      codeSnapshot: item.subject.codeSnapshot,
      nameSnapshot: item.subject.nameSnapshot,
      amount,
      isRequired: item.subject.isRequired,
    };
  });
  const componentBreakdown = selectedSubjects.flatMap((item) => item.components.map((component) => ({
    examRoundComponentId: component.id,
    examRoundSubjectId: item.subject.id,
    codeSnapshot: component.codeSnapshot,
    nameSnapshot: component.nameSnapshot,
    amount: roundMoney(decimalToNumber(component.fee) || 0),
    isRequired: component.isRequired,
  })));
  const subjectFeeTotal = roundMoney(subjectBreakdown.reduce((sum, item) => sum + item.amount, 0));
  const componentFeeTotal = roundMoney(componentBreakdown.reduce((sum, item) => sum + item.amount, 0));

  let calculatedAmount = 0;
  let fixedFee: number | null = null;
  if (calculationMethod === 'fixed' || calculationMethod === 'program_fee') {
    fixedFee = decimalToNumber(round?.fixedFee);
    if (fixedFee === null || fixedFee < 0) {
      httpError(409, 'Cấu hình lệ phí đợt thi không hợp lệ.', 'INVALID_FEE_CONFIGURATION');
    }
    calculatedAmount = roundMoney(fixedFee);
  } else if (calculationMethod === 'subject_fee') {
    if (subjectBreakdown.some((item) => item.amount < 0)) {
      httpError(409, 'Cấu hình lệ phí môn thi không hợp lệ.', 'INVALID_FEE_CONFIGURATION');
    }
    calculatedAmount = subjectFeeTotal;
  } else {
    if (componentBreakdown.some((item) => item.amount < 0)) {
      httpError(409, 'Cấu hình lệ phí thành phần thi không hợp lệ.', 'INVALID_FEE_CONFIGURATION');
    }
    calculatedAmount = componentFeeTotal;
  }

  const discountAmount = 0;
  const payableAmount = roundMoney(Math.max(calculatedAmount - discountAmount, 0));

  return {
    currency: 'VND',
    calculationMethod,
    fixedFee,
    subjectFeeTotal,
    componentFeeTotal,
    calculatedAmount,
    discountAmount,
    payableAmount,
    confirmedPaidAmount: 0,
    paymentStatus: payableAmount > 0 ? 'unpaid' : 'not_required',
    subjects: subjectBreakdown,
    components: componentBreakdown,
  };
}

async function acquireLearnerRegistrationLock(trx: any, tenantId: number, roundId: number, learnerId: number) {
  if (!isPostgresClient()) return;
  await trx.raw('select pg_advisory_xact_lock(hashtext(?), hashtext(?))', [String(tenantId), `exam-registration:${roundId}:${learnerId}`]);
}

async function findRegistrationCodeByValue(tenantId: number, registrationCode: string, transacting?: any) {
  return strapi.db.query(EXAM_REGISTRATION_UID).findOne({
    where: mergeTenantWhere({ registrationCode }, tenantId),
    select: ['id'],
    ...(transacting ? { transacting } : {}),
  } as any);
}

async function generateRegistrationCode(tenantId: number, transacting?: any): Promise<string> {
  const now = new Date();
  const prefix = `${REGISTRATION_CODE_PREFIX}-${now.getUTCFullYear()}${String(now.getUTCMonth() + 1).padStart(2, '0')}`;

  for (let attempt = 0; attempt < REGISTRATION_CODE_MAX_ATTEMPTS; attempt += 1) {
    const suffix = randomBytes(4).toString('hex').toUpperCase();
    const registrationCode = `${prefix}-${suffix}`;
    const existing = await findRegistrationCodeByValue(tenantId, registrationCode, transacting);
    if (!existing?.id) {
      return registrationCode;
    }
  }

  httpError(409, 'Không thể sinh mã đăng ký dự thi duy nhất.', 'REGISTRATION_CODE_GENERATION_FAILED');
}

async function syncExamRegistrationShadowColumns(registrationId: number, tenantId: number, roundId: number, learnerId: number, transacting?: any) {
  const builder = transacting || strapi.db.connection
  await builder('exam_registrations')
    .where({ id: registrationId })
    .update({
      tenant_scope_id: tenantId,
      exam_round_scope_id: roundId,
      learner_scope_id: learnerId,
    })
}

function buildContextSubjects(structure: MutableExamRoundStructure) {
  return structure.subjects
    .filter((subject) => subject.status === 'active')
    .map((subject) => ({
      examRoundSubjectId: subject.id,
      codeSnapshot: subject.codeSnapshot,
      nameSnapshot: subject.nameSnapshot,
      isRequired: subject.isRequired,
      allowSeparateRegistration: subject.allowSeparateRegistration,
      fee: decimalToNumber(subject.fee),
      calculationRule: {
        method: subject.calculationMethodSnapshot,
        requiredAggregateScore: decimalToNumber(subject.requiredAggregateScoreSnapshot),
        requireAllComponents: subject.requireAllComponentsSnapshot !== false,
        ruleDescription: normalizeOptionalText(subject.ruleDescriptionSnapshot),
      },
      selectedByDefault: !structure.round.allowSubjectSelection || subject.isRequired,
      components: subject.components
        .filter((component) => component.status === 'active')
        .map((component) => ({
          examRoundComponentId: component.id,
          codeSnapshot: component.codeSnapshot,
          nameSnapshot: component.nameSnapshot,
          isRequired: component.isRequired,
          allowSeparateRegistration: component.allowSeparateRegistration,
          durationMinutes: component.durationMinutes,
          examMethod: component.examMethod,
          fee: decimalToNumber(component.fee),
          selectedByDefault: !structure.round.allowComponentSelection || component.isRequired,
        })),
    }));
}

function normalizeTextWithoutAccents(value: unknown): string {
  return normalizeText(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D');
}

function trimWhitespace(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

function renderPaymentTransferContent(template: string | null, values: Record<string, string | null | undefined>): string | null {
  const normalizedTemplate = normalizeOptionalText(template, PAYMENT_TRANSFER_CONTENT_MAX_LENGTH);
  if (!normalizedTemplate) return null;

  validateTransferTemplatePlaceholders(normalizedTemplate, 'paymentTransferContentTemplateSnapshot');

  const rendered = normalizedTemplate.replace(/\{([^}]+)\}/g, (_match, rawName) => {
    const name = normalizeText(rawName);
    if (!['registrationCode', 'learnerCode', 'fullName', 'roundCode'].includes(name)) {
      httpError(409, 'Mẫu nội dung chuyển khoản không hợp lệ.', 'PAYMENT_TEMPLATE_INVALID', { placeholder: rawName });
    }
    return String(values[name] || '').trim();
  });

  const normalized = trimWhitespace(rendered);
  if (!normalized) {
    httpError(409, 'Mẫu nội dung chuyển khoản không tạo ra giá trị hợp lệ.', 'PAYMENT_TEMPLATE_INVALID');
  }
  return normalized.slice(0, PAYMENT_TRANSFER_CONTENT_MAX_LENGTH);
}

function hasExamRoundPaymentSnapshot(round: any): boolean {
  return Boolean(
    normalizeText(round?.paymentMethodSnapshot)
    || normalizeText(round?.paymentBankCodeSnapshot)
    || normalizeText(round?.paymentBankNameSnapshot)
    || normalizeText(round?.paymentAccountNumberSnapshot)
    || normalizeText(round?.paymentAccountHolderSnapshot)
    || normalizeText(round?.paymentTransferContentTemplateSnapshot)
    || round?.paymentQrImageSnapshot?.id,
  );
}

function assertExamRoundPaymentSnapshotReady(round: any, paymentRequired: boolean) {
  if (!paymentRequired) return;
  if (!hasExamRoundPaymentSnapshot(round)) {
    httpError(409, 'Đợt thi chưa có snapshot thanh toán hợp lệ.', 'PAYMENT_PROFILE_NOT_CONFIGURED');
  }
  try {
    assertPaymentSnapshotValid(round);
  } catch (error: any) {
    if (error instanceof HttpError) {
      httpError(409, 'Cấu hình thanh toán của đợt thi không hợp lệ.', 'PAYMENT_SETTINGS_INVALID', error.details || null);
    }
    throw error;
  }
}

function buildRegistrationPaymentSnapshot(round: any, learner: CurrentLearner, registrationCode: string, feeSummary: FeeSummary): RegistrationPaymentSnapshot {
  const paymentRequired = feeSummary.payableAmount > 0;
  assertExamRoundPaymentSnapshotReady(round, paymentRequired);

  const transferContent = paymentRequired
    ? renderPaymentTransferContent(round?.paymentTransferContentTemplateSnapshot, {
        registrationCode,
        learnerCode: learner.code,
        fullName: normalizeTextWithoutAccents(learner.fullName),
        roundCode: normalizeText(round?.code),
      })
    : null;

  return {
    paymentRequired,
    paymentConfigured: paymentRequired ? hasExamRoundPaymentSnapshot(round) : false,
    paymentMethod: paymentRequired ? normalizePaymentProfileMethod(round?.paymentMethodSnapshot, 'paymentMethodSnapshot') : null,
    paymentProfileName: paymentRequired ? normalizeOptionalText(round?.paymentProfileNameSnapshot, 150) : null,
    paymentProfileCode: paymentRequired ? normalizeUpperOptionalText(round?.paymentProfileCodeSnapshot, 100) : null,
    bankCode: paymentRequired ? normalizeUpperOptionalText(round?.paymentBankCodeSnapshot, 20) : null,
    bankName: paymentRequired ? normalizeOptionalText(round?.paymentBankNameSnapshot, 150) : null,
    accountNumber: paymentRequired ? normalizeOptionalText(round?.paymentAccountNumberSnapshot, 100) : null,
    accountHolder: paymentRequired ? normalizeOptionalText(round?.paymentAccountHolderSnapshot, 150) : null,
    bankBranch: paymentRequired ? normalizeOptionalText(round?.paymentBankBranchSnapshot, 150) : null,
    currency: normalizeUpperOptionalText(round?.paymentCurrencySnapshot || feeSummary.currency, 10) || feeSummary.currency,
    transferContentTemplate: paymentRequired ? normalizeOptionalText(round?.paymentTransferContentTemplateSnapshot, 255) : null,
    transferContent,
    paymentInstruction: paymentRequired ? normalizeOptionalText(round?.paymentInstructionSnapshot) : null,
    supportPhone: paymentRequired ? normalizeOptionalText(round?.paymentSupportPhoneSnapshot, 30) : null,
    supportEmail: paymentRequired ? normalizeEmailValue(round?.paymentSupportEmailSnapshot, 'paymentSupportEmailSnapshot') : null,
    qrImage: paymentRequired ? mapPaymentProfileMedia(round?.paymentQrImageSnapshot) : null,
  };
}

function mapRegistrationPaymentSnapshot(registration: any): RegistrationPaymentSnapshot {
  const paymentRequired = toMoney(registration?.amountDue ?? registration?.payableAmount, 0) > 0 && normalizeText(registration?.paymentStatus).toLowerCase() !== 'not_required';
  return {
    paymentRequired,
    paymentConfigured: paymentRequired ? hasExamRoundPaymentSnapshot(registration) : false,
    paymentMethod: paymentRequired ? normalizeText(registration?.paymentMethodSnapshot).toLowerCase() as 'bank_transfer' | 'cash' | 'other' : null,
    paymentProfileName: normalizeOptionalText(registration?.paymentProfileNameSnapshot, 150),
    paymentProfileCode: normalizeUpperOptionalText(registration?.paymentProfileCodeSnapshot, 100),
    bankCode: normalizeUpperOptionalText(registration?.paymentBankCodeSnapshot, 20),
    bankName: normalizeOptionalText(registration?.paymentBankNameSnapshot, 150),
    accountNumber: normalizeOptionalText(registration?.paymentAccountNumberSnapshot, 100),
    accountHolder: normalizeOptionalText(registration?.paymentAccountHolderSnapshot, 150),
    bankBranch: normalizeOptionalText(registration?.paymentBankBranchSnapshot, 150),
    currency: normalizeUpperOptionalText(registration?.currency || registration?.paymentCurrencySnapshot, 10),
    transferContentTemplate: normalizeOptionalText(registration?.paymentTransferContentTemplateSnapshot, 255),
    transferContent: normalizeOptionalText(registration?.paymentTransferContent, 255),
    paymentInstruction: normalizeOptionalText(registration?.paymentInstructionSnapshot),
    supportPhone: normalizeOptionalText(registration?.paymentSupportPhoneSnapshot, 30),
    supportEmail: normalizeOptionalText(registration?.paymentSupportEmailSnapshot),
    qrImage: mapPaymentProfileMedia(registration?.paymentQrImageSnapshot),
  };
}

function mapLearnerSummary(learner: CurrentLearner) {
  return {
    id: learner.id,
    code: learner.code,
    fullName: learner.fullName,
  };
}

function mapPaymentProfileMedia(media: any) {
  if (!media?.id) return null;
  return {
    id: Number(media.id),
    name: normalizeText(media.name) || null,
    url: normalizeText(media.url) || null,
    mime: normalizeText(media.mime) || null,
  };
}

function maskSensitiveAccount(value: unknown): string | null {
  const text = normalizeText(value);
  if (!text) return null;
  if (text.length <= 4) return text;
  return `${'*'.repeat(Math.max(0, text.length - 4))}${text.slice(-4)}`;
}

function mapFileAssetSummary(row: any): PaymentEvidenceSummary | null {
  if (!row?.id) return null;
  return {
    id: Number(row.id),
    fileAssetId: Number(row.id),
    name: normalizeOptionalText(row?.originalName || row?.fileName, 255),
    url: normalizeOptionalText(row?.url, 500),
    mimeType: normalizeOptionalText(row?.mimeType, 100),
    provider: normalizeOptionalText(row?.provider, 50),
  };
}

function normalizeReportPaymentInput(payload: Record<string, unknown>): ReportPaymentInput {
  ensureNoUnknownFields(payload || {}, [
    'paymentTransferAt',
    'paymentSenderName',
    'paymentSenderAccount',
    'paymentSenderBank',
    'paymentTransactionReference',
    'paymentReportNote',
    'paymentEvidenceId',
  ], 'payload');

  const paymentTransferAt = parseDateTime(payload.paymentTransferAt, 'paymentTransferAt', { required: true });
  if (!paymentTransferAt) {
    httpError(400, 'paymentTransferAt is required', 'INVALID_PAYMENT_TRANSFER_AT');
  }
  if (Date.parse(paymentTransferAt) > Date.now() + PAYMENT_REPORT_FUTURE_TOLERANCE_MS) {
    httpError(400, 'paymentTransferAt is invalid', 'INVALID_PAYMENT_TRANSFER_AT');
  }

  const paymentSenderName = normalizeRequiredText(payload.paymentSenderName, 'paymentSenderName', 200);
  const paymentSenderAccount = normalizeOptionalText(payload.paymentSenderAccount, 100);
  const paymentSenderBank = normalizeOptionalText(payload.paymentSenderBank, 150);
  const paymentTransactionReference = normalizeOptionalText(payload.paymentTransactionReference, 100);
  const paymentReportNote = normalizeOptionalText(payload.paymentReportNote, 2000);
  const paymentEvidenceId = payload.paymentEvidenceId === null || typeof payload.paymentEvidenceId === 'undefined' || payload.paymentEvidenceId === ''
    ? null
    : normalizePositiveInteger(payload.paymentEvidenceId, 'paymentEvidenceId');

  return {
    paymentTransferAt,
    paymentSenderName,
    paymentSenderAccount,
    paymentSenderBank,
    paymentTransactionReference,
    paymentReportNote,
    paymentEvidenceId,
  };
}

function isLearnerPaymentReportableStatus(paymentStatus: string | null) {
  return paymentStatus === 'unpaid';
}

function buildPaymentReportSummary(registration: any): PaymentReportSummary {
  const paymentStatus = normalizeText(registration?.paymentStatus).toLowerCase() || null;
  const registrationStatus = normalizeText(registration?.registrationStatus).toLowerCase() || null;
  const paymentDueAt = normalizeStoredDateTime(registration?.paymentDueAt);
  const withinPaymentWindow = !paymentDueAt || Date.now() <= Date.parse(paymentDueAt);
  return {
    canReport: isLearnerPaymentReportableStatus(paymentStatus)
      && toMoney(registration?.amountDue ?? registration?.payableAmount, 0) > 0
      && !['cancelled', 'rejected'].includes(registrationStatus || '')
      && withinPaymentWindow,
    reportedAt: normalizeStoredDateTime(registration?.paymentReportedAt),
    reportedByUserId: Number(extractRelationRef(registration?.paymentReportedBy) || registration?.paymentReportedBy?.id || 0) || null,
    transferAt: normalizeStoredDateTime(registration?.paymentTransferAt),
    senderName: normalizeOptionalText(registration?.paymentSenderName, 200),
    maskedSenderAccount: maskSensitiveAccount(registration?.paymentSenderAccount),
    senderBank: normalizeOptionalText(registration?.paymentSenderBank, 150),
    transactionReference: normalizeOptionalText(registration?.paymentTransactionReference, 100),
    note: normalizeOptionalText(registration?.paymentReportNote),
    evidence: mapFileAssetSummary(registration?.paymentEvidence),
    confirmedAt: normalizeStoredDateTime(registration?.paymentConfirmedAt),
    rejectedAt: normalizeStoredDateTime(registration?.paymentRejectedAt),
    rejectionReason: normalizeOptionalText(registration?.paymentRejectionReason),
  };
}

function normalizeConfirmPaymentInput(payload: Record<string, unknown>): ConfirmPaymentInput {
  ensureNoUnknownFields(payload || {}, ['confirmationNote'], 'payload');
  return {
    confirmationNote: normalizeOptionalText(payload.confirmationNote, 2000),
  };
}

function normalizeRejectPaymentReportInput(payload: Record<string, unknown>): RejectPaymentReportInput {
  ensureNoUnknownFields(payload || {}, ['reason'], 'payload');
  const reason = normalizeRequiredText(payload.reason, 'reason', 2000);
  return { reason };
}

function normalizeExamRoundPaymentListQuery(query: Record<string, unknown>): ExamRoundPaymentListQuery {
  const page = toPositiveInt(query.page, 1);
  const pageSize = Math.min(100, toPositiveInt(query.pageSize, 20));
  const keyword = normalizeOptionalText(query.keyword ?? query.search, 200);
  const paymentStatus = normalizeOptionalText(query.paymentStatus, 50)?.toLowerCase() || null;
  const registrationStatus = normalizeOptionalText(query.registrationStatus, 50)?.toLowerCase() || null;
  const paymentMethod = normalizeOptionalText(query.paymentMethod, 50)?.toLowerCase() || null;
  const hasEvidenceText = normalizeOptionalText(query.hasEvidence, 10)?.toLowerCase() || null;
  const hasEvidence = hasEvidenceText === 'true' ? true : hasEvidenceText === 'false' ? false : null;
  return {
    page,
    pageSize,
    keyword,
    paymentStatus,
    registrationStatus,
    paymentMethod,
    hasEvidence,
    reportedFrom: parseDateTime(query.reportedFrom, 'reportedFrom'),
    reportedTo: parseDateTime(query.reportedTo, 'reportedTo'),
    confirmedFrom: parseDateTime(query.confirmedFrom, 'confirmedFrom'),
    confirmedTo: parseDateTime(query.confirmedTo, 'confirmedTo'),
    sort: normalizeSortInput(query.sort),
  };
}

async function findExamRoundInTenantForPayment(tenantId: number, roundRef: unknown, transacting?: any) {
  const round = await findExamRoundByRef(tenantId, roundRef, transacting);
  if (!round?.id) {
    httpError(404, 'Không tìm thấy đợt thi trong tenant hiện tại.', 'EXAM_ROUND_NOT_FOUND');
  }
  return round;
}

async function loadExamRegistrationInRoundForTenant(tenantId: number, roundRef: unknown, registrationRef: unknown, transacting?: any) {
  const round = await findExamRoundInTenantForPayment(tenantId, roundRef, transacting);
  const where = whereByParam(registrationRef);
  if (!where) {
    httpError(404, 'Không tìm thấy hồ sơ đăng ký.', 'EXAM_REGISTRATION_NOT_FOUND');
  }

  const registration = await strapi.db.query(EXAM_REGISTRATION_UID).findOne({
    where: mergeTenantWhere({
      $and: [
        where,
        { examRound: { id: { $eq: Number(round.id) } } },
      ],
    }, tenantId),
    select: [
      'id', 'documentId', 'registrationCode', 'registeredAt', 'registrationStatus', 'eligibilityStatus', 'paymentStatus',
      'paymentCalculationMethodSnapshot', 'fixedFeeSnapshot', 'subjectFeeTotalSnapshot', 'componentFeeTotalSnapshot', 'calculatedAmount', 'discountAmount', 'payableAmount', 'amountDue', 'currency', 'paymentDueAt', 'confirmedPaidAmount',
      'paymentReportedAt', 'paymentReportNote', 'paymentTransferAt', 'paymentSenderName', 'paymentSenderAccount', 'paymentSenderBank', 'paymentTransactionReference', 'paymentReportUpdatedAt', 'paymentConfirmedAt', 'paymentConfirmationNote', 'paymentRejectedAt', 'paymentRejectionReason',
      'acceptedAt', 'returnedAt', 'returnReason', 'rejectedAt', 'rejectionReason',
      'studentCodeSnapshot', 'fullNameSnapshot', 'classNameSnapshot', 'cohortSnapshot', 'majorSnapshot',
      'paymentMethodSnapshot', 'paymentProfileNameSnapshot', 'paymentProfileCodeSnapshot', 'paymentBankCodeSnapshot', 'paymentBankNameSnapshot', 'paymentAccountNumberSnapshot', 'paymentAccountHolderSnapshot', 'paymentBankBranchSnapshot', 'paymentTransferContentTemplateSnapshot', 'paymentTransferContent', 'paymentInstructionSnapshot', 'paymentSupportPhoneSnapshot', 'paymentSupportEmailSnapshot',
      'createdAt', 'updatedAt',
    ],
    populate: {
      learner: { select: ['id', 'documentId', 'code', 'fullName', 'dateOfBirth'] },
      examRound: { select: ['id', 'documentId', 'code', 'name', 'status', 'registrationMode', 'registrationStartAt', 'registrationEndAt', 'examStartAt', 'examEndAt', 'paymentEndAt'] },
      paymentReportedBy: { select: ['id', 'username', 'fullName', 'email'] },
      paymentConfirmedBy: { select: ['id', 'username', 'fullName', 'email'] },
      paymentRejectedBy: { select: ['id', 'username', 'fullName', 'email'] },
      paymentEvidence: { select: ['id', 'originalName', 'fileName', 'url', 'mimeType', 'provider', 'status', 'isDeleted', 'size'] },
      paymentQrImageSnapshot: { select: ['id', 'name', 'url', 'mime'] },
      subjectRegistrations: {
        select: ['id', 'subjectCodeSnapshot', 'nameSnapshot', 'isRequiredSnapshot', 'allowSeparateRegistrationSnapshot', 'calculationMethodSnapshot', 'requiredAggregateScoreSnapshot', 'requireAllComponentsSnapshot', 'ruleDescriptionSnapshot', 'participationType', 'registrationStatus', 'feeAmount'],
        orderBy: [{ id: 'asc' }],
        populate: {
          examRoundSubject: { select: ['id'] },
          componentRegistrations: {
            select: ['id', 'componentCodeSnapshot', 'nameSnapshot', 'isRequiredSnapshot', 'allowSeparateRegistrationSnapshot', 'durationMinutesSnapshot', 'examMethodSnapshot', 'participationType', 'registrationStatus', 'feeAmount'],
            orderBy: [{ id: 'asc' }],
            populate: { examRoundComponent: { select: ['id'] } },
          },
        },
      },
    },
    ...(transacting ? { transacting } : {}),
  } as any) as any;

  if (!registration?.id) {
    httpError(404, 'Không tìm thấy hồ sơ đăng ký.', 'EXAM_REGISTRATION_NOT_FOUND');
  }

  return { round, registration };
}

function assertAdminPaymentConfirmAllowed(registration: any) {
  const amountDue = toMoney(registration?.amountDue ?? registration?.payableAmount, 0);
  if (amountDue <= 0) {
    httpError(409, 'Registration này không yêu cầu thanh toán.', 'PAYMENT_NOT_REQUIRED');
  }
  const registrationStatus = normalizeText(registration?.registrationStatus).toLowerCase();
  if (registrationStatus === 'cancelled') {
    httpError(409, 'Registration đã bị hủy.', 'REGISTRATION_CANCELLED');
  }
  if (registrationStatus === 'rejected') {
    httpError(409, 'Registration đã bị từ chối.', 'REGISTRATION_REJECTED');
  }

  const paymentStatus = normalizeText(registration?.paymentStatus).toLowerCase();
  if (paymentStatus === 'paid') {
    httpError(409, 'Thanh toán đã được xác nhận trước đó.', 'PAYMENT_ALREADY_CONFIRMED');
  }
  if (paymentStatus !== 'payment_reported') {
    httpError(409, 'Registration hiện chưa có thông báo chuyển tiền hợp lệ để xác nhận.', 'PAYMENT_CONFIRMATION_NOT_ALLOWED');
  }
}

function assertAdminPaymentRejectAllowed(registration: any) {
  const amountDue = toMoney(registration?.amountDue ?? registration?.payableAmount, 0);
  if (amountDue <= 0) {
    httpError(409, 'Registration này không yêu cầu thanh toán.', 'PAYMENT_NOT_REQUIRED');
  }
  const paymentStatus = normalizeText(registration?.paymentStatus).toLowerCase();
  if (paymentStatus === 'paid') {
    httpError(409, 'Thanh toán đã được xác nhận, không thể trả lại thông báo.', 'PAYMENT_ALREADY_CONFIRMED');
  }
  if (paymentStatus === 'payment_rejected') {
    httpError(409, 'Thông báo thanh toán đã được trả lại trước đó.', 'PAYMENT_REPORT_ALREADY_REJECTED');
  }
  if (paymentStatus !== 'payment_reported') {
    httpError(409, 'Registration hiện chưa có thông báo chuyển tiền để trả lại.', 'PAYMENT_REPORT_REJECTION_NOT_ALLOWED');
  }
}

function mapExamRoundPaymentListItem(row: any) {
  return {
    id: Number(row?.id || 0),
    documentId: row?.documentId || null,
    registrationCode: normalizeText(row?.registrationCode),
    learner: {
      code: normalizeText(row?.studentCodeSnapshot),
      fullName: normalizeText(row?.fullNameSnapshot),
    },
    amountDue: toMoney(row?.amountDue ?? row?.payableAmount, 0),
    currency: normalizeUpperOptionalText(row?.currency, 10) || 'VND',
    paymentStatus: normalizeText(row?.paymentStatus).toLowerCase() || null,
    registrationStatus: normalizeText(row?.registrationStatus).toLowerCase() || null,
    paymentReportedAt: normalizeStoredDateTime(row?.paymentReportedAt),
    paymentTransferAt: normalizeStoredDateTime(row?.paymentTransferAt),
    paymentSenderName: normalizeOptionalText(row?.paymentSenderName, 200),
    paymentSenderBank: normalizeOptionalText(row?.paymentSenderBank, 150),
    maskedPaymentSenderAccount: maskSensitiveAccount(row?.paymentSenderAccount),
    paymentTransactionReference: normalizeOptionalText(row?.paymentTransactionReference, 100),
    hasEvidence: Boolean(row?.paymentEvidenceId),
    paymentConfirmedAt: normalizeStoredDateTime(row?.paymentConfirmedAt),
    paymentRejectedAt: normalizeStoredDateTime(row?.paymentRejectedAt),
    updatedAt: normalizeStoredDateTime(row?.updatedAt),
  };
}

function buildAdminPaymentDetailResponse(registration: any) {
  const learnerDetail = buildLearnerExamRegistrationDetailResponse(registration);
  return {
    ...learnerDetail,
    paymentReport: {
      ...learnerDetail.paymentReport,
      senderAccount: normalizeOptionalText(registration?.paymentSenderAccount, 100),
      confirmedAt: normalizeStoredDateTime(registration?.paymentConfirmedAt),
      confirmedBy: summarizeWorkflowActor(registration?.paymentConfirmedBy ? {
        id: registration.paymentConfirmedBy.id,
        username: registration.paymentConfirmedBy.username,
        fullName: registration.paymentConfirmedBy.fullName,
        email: registration.paymentConfirmedBy.email,
      } : null),
      confirmationNote: normalizeOptionalText(registration?.paymentConfirmationNote),
      rejectedAt: normalizeStoredDateTime(registration?.paymentRejectedAt),
      rejectedBy: summarizeWorkflowActor(registration?.paymentRejectedBy ? {
        id: registration.paymentRejectedBy.id,
        username: registration.paymentRejectedBy.username,
        fullName: registration.paymentRejectedBy.fullName,
        email: registration.paymentRejectedBy.email,
      } : null),
      rejectionReason: normalizeOptionalText(registration?.paymentRejectionReason),
    },
  };
}

function mapPaymentProfileSummary(profile: any) {
  if (!profile?.id) return null;
  return {
    id: Number(profile.id),
    documentId: profile.documentId || null,
    name: normalizeText(profile.name),
    code: normalizeText(profile.code),
    paymentMethod: normalizeText(profile.paymentMethod).toLowerCase() || 'bank_transfer',
    bankCode: normalizeOptionalText(profile.bankCode),
    bankName: normalizeOptionalText(profile.bankName),
    accountNumber: normalizeOptionalText(profile.accountNumber),
    accountHolder: normalizeOptionalText(profile.accountHolder),
    bankBranch: normalizeOptionalText(profile.bankBranch),
    currency: normalizeText(profile.currency) || 'VND',
    transferContentTemplate: normalizeOptionalText(profile.transferContentTemplate),
    paymentInstruction: normalizeOptionalText(profile.paymentInstruction),
    supportPhone: normalizeOptionalText(profile.supportPhone),
    supportEmail: normalizeOptionalText(profile.supportEmail),
    isActive: profile.isActive !== false,
    isDefault: profile.isDefault === true,
    sortOrder: Number(profile.sortOrder || 0) || 0,
    qrImage: mapPaymentProfileMedia(profile.qrImage),
  };
}

function buildPaymentSnapshotFromProfile(profile: any) {
  return {
    paymentMethodSnapshot: normalizePaymentProfileMethod(profile?.paymentMethod, 'paymentMethodSnapshot'),
    paymentProfileNameSnapshot: normalizeOptionalText(profile?.name, 150),
    paymentProfileCodeSnapshot: normalizeUpperOptionalText(profile?.code, 100),
    paymentBankCodeSnapshot: normalizeUpperOptionalText(profile?.bankCode, 20),
    paymentBankNameSnapshot: normalizeOptionalText(profile?.bankName, 150),
    paymentAccountNumberSnapshot: normalizeOptionalText(profile?.accountNumber, 100),
    paymentAccountHolderSnapshot: normalizeOptionalText(profile?.accountHolder, 150),
    paymentBankBranchSnapshot: normalizeOptionalText(profile?.bankBranch, 150),
    paymentCurrencySnapshot: normalizeUpperOptionalText(profile?.currency || 'VND', 10),
    paymentTransferContentTemplateSnapshot: normalizeOptionalText(profile?.transferContentTemplate, 255),
    paymentInstructionSnapshot: normalizeOptionalText(profile?.paymentInstruction),
    paymentSupportPhoneSnapshot: normalizeOptionalText(profile?.supportPhone, 30),
    paymentSupportEmailSnapshot: normalizeEmailValue(profile?.supportEmail, 'paymentSupportEmailSnapshot'),
    paymentQrImageSnapshot: profile?.qrImage?.id ? Number(profile.qrImage.id) : null,
  };
}

function normalizePaymentSettingsInput(payload: Record<string, unknown>): UpdatePaymentSettingsInput {
  ensureNoUnknownFields(payload, [
    'paymentMethodSnapshot',
    'paymentBankCodeSnapshot',
    'paymentBankNameSnapshot',
    'paymentAccountNumberSnapshot',
    'paymentAccountHolderSnapshot',
    'paymentBankBranchSnapshot',
    'paymentCurrencySnapshot',
    'paymentTransferContentTemplateSnapshot',
    'paymentInstructionSnapshot',
    'paymentSupportPhoneSnapshot',
    'paymentSupportEmailSnapshot',
    'paymentQrImageSnapshot',
  ], 'payload');

  const input: UpdatePaymentSettingsInput = {
    ...(hasOwn(payload, 'paymentMethodSnapshot') ? { paymentMethodSnapshot: normalizePaymentProfileMethod(payload.paymentMethodSnapshot, 'paymentMethodSnapshot') } : {}),
    ...(hasOwn(payload, 'paymentBankCodeSnapshot') ? { paymentBankCodeSnapshot: normalizeUpperOptionalText(payload.paymentBankCodeSnapshot, 20) } : {}),
    ...(hasOwn(payload, 'paymentBankNameSnapshot') ? { paymentBankNameSnapshot: normalizeOptionalText(payload.paymentBankNameSnapshot, 150) } : {}),
    ...(hasOwn(payload, 'paymentAccountNumberSnapshot') ? { paymentAccountNumberSnapshot: normalizeOptionalText(payload.paymentAccountNumberSnapshot, 100) } : {}),
    ...(hasOwn(payload, 'paymentAccountHolderSnapshot') ? { paymentAccountHolderSnapshot: normalizeOptionalText(payload.paymentAccountHolderSnapshot, 150) } : {}),
    ...(hasOwn(payload, 'paymentBankBranchSnapshot') ? { paymentBankBranchSnapshot: normalizeOptionalText(payload.paymentBankBranchSnapshot, 150) } : {}),
    ...(hasOwn(payload, 'paymentCurrencySnapshot') ? { paymentCurrencySnapshot: normalizeUpperOptionalText(payload.paymentCurrencySnapshot, 10) } : {}),
    ...(hasOwn(payload, 'paymentTransferContentTemplateSnapshot') ? { paymentTransferContentTemplateSnapshot: normalizeOptionalText(payload.paymentTransferContentTemplateSnapshot, 255) } : {}),
    ...(hasOwn(payload, 'paymentInstructionSnapshot') ? { paymentInstructionSnapshot: normalizeOptionalText(payload.paymentInstructionSnapshot) } : {}),
    ...(hasOwn(payload, 'paymentSupportPhoneSnapshot') ? { paymentSupportPhoneSnapshot: normalizeOptionalText(payload.paymentSupportPhoneSnapshot, 30) } : {}),
    ...(hasOwn(payload, 'paymentSupportEmailSnapshot') ? { paymentSupportEmailSnapshot: normalizeEmailValue(payload.paymentSupportEmailSnapshot, 'paymentSupportEmailSnapshot') } : {}),
    ...(hasOwn(payload, 'paymentQrImageSnapshot') ? { paymentQrImageSnapshot: normalizeMediaRelationId(payload.paymentQrImageSnapshot, 'paymentQrImageSnapshot') } : {}),
  };

  validateTransferTemplatePlaceholders(input.paymentTransferContentTemplateSnapshot ?? null, 'paymentTransferContentTemplateSnapshot');
  return input;
}

function assertPaymentSnapshotValid(snapshot: UpdatePaymentSettingsInput | Record<string, unknown>) {
  const method = normalizePaymentProfileMethod(snapshot?.paymentMethodSnapshot, 'paymentMethodSnapshot');
  if (method === 'bank_transfer') {
    if (!normalizeText(snapshot?.paymentBankCodeSnapshot) && !normalizeText(snapshot?.paymentBankNameSnapshot)) {
      httpError(400, 'bankCode or bankName is required for bank transfer.', 'PAYMENT_PROFILE_BANK_INFO_REQUIRED', { field: 'paymentBankNameSnapshot' });
    }
    if (!normalizeText(snapshot?.paymentAccountNumberSnapshot)) {
      httpError(400, 'accountNumber is required for bank transfer.', 'PAYMENT_PROFILE_BANK_INFO_REQUIRED', { field: 'paymentAccountNumberSnapshot' });
    }
    if (!normalizeText(snapshot?.paymentAccountHolderSnapshot)) {
      httpError(400, 'accountHolder is required for bank transfer.', 'PAYMENT_PROFILE_BANK_INFO_REQUIRED', { field: 'paymentAccountHolderSnapshot' });
    }
  }
}

async function findPaymentProfileInTenant(tenantId: number, paymentProfileRef: unknown, transacting?: any) {
  const where = whereByParam(paymentProfileRef);
  if (!where) {
    httpError(404, 'Payment profile not found in current tenant.', 'PAYMENT_PROFILE_NOT_FOUND');
  }

  const profile = await strapi.db.query(PAYMENT_PROFILE_UID).findOne({
    where: mergeTenantWhere(where, tenantId),
    populate: {
      qrImage: { select: ['id', 'name', 'url', 'mime'] },
    },
    ...(transacting ? { transacting } : {}),
  } as any) as any;

  if (!profile?.id) {
    httpError(404, 'Payment profile not found in current tenant.', 'PAYMENT_PROFILE_NOT_FOUND');
  }

  return profile;
}

function isExamRoundPaymentSettingsEditableStatus(status: unknown): boolean {
  const normalized = normalizeText(status).toLowerCase();
  return ['draft', 'approved', 'registration_open', 'registration_paused', 'registration_closed'].includes(normalized);
}

function assertExamRoundPaymentSettingsEditableRound(round: any) {
  if (!isExamRoundPaymentSettingsEditableStatus(round?.status)) {
    httpError(409, 'Exam round payment settings cannot be edited for the current status.', 'EXAM_ROUND_PAYMENT_SETTINGS_NOT_EDITABLE');
  }
}

async function countExistingRegistrationsForRound(tenantId: number, roundId: number, transacting?: any) {
  return await strapi.db.query(EXAM_REGISTRATION_UID).count({
    where: mergeTenantWhere({
      examRound: { id: { $eq: roundId } },
      registrationStatus: {
        $notIn: ['cancelled', 'rejected'],
      },
    }, tenantId),
    ...(transacting ? { transacting } : {}),
  } as any);
}

function buildExamRoundPaymentSettingsResponse(round: any) {
  return {
    paymentConfiguration: {
      paymentCalculationMethod: normalizeText(round?.paymentCalculationMethod).toLowerCase() || null,
      fixedFee: decimalToNumber(round?.fixedFee),
      requireConfirmedPayment: round?.requireConfirmedPayment === true,
      paymentStartAt: normalizeStoredDateTime(round?.paymentStartAt),
      paymentEndAt: normalizeStoredDateTime(round?.paymentEndAt),
    },
    paymentSettings: {
      paymentProfile: mapPaymentProfileSummary(round?.paymentProfile),
      snapshot: {
        paymentMethod: normalizeText(round?.paymentMethodSnapshot).toLowerCase() || null,
        paymentProfileName: normalizeOptionalText(round?.paymentProfileNameSnapshot),
        paymentProfileCode: normalizeOptionalText(round?.paymentProfileCodeSnapshot),
        bankCode: normalizeOptionalText(round?.paymentBankCodeSnapshot),
        bankName: normalizeOptionalText(round?.paymentBankNameSnapshot),
        accountNumber: normalizeOptionalText(round?.paymentAccountNumberSnapshot),
        accountHolder: normalizeOptionalText(round?.paymentAccountHolderSnapshot),
        bankBranch: normalizeOptionalText(round?.paymentBankBranchSnapshot),
        currency: normalizeOptionalText(round?.paymentCurrencySnapshot),
        transferContentTemplate: normalizeOptionalText(round?.paymentTransferContentTemplateSnapshot),
        paymentInstruction: normalizeOptionalText(round?.paymentInstructionSnapshot),
        supportPhone: normalizeOptionalText(round?.paymentSupportPhoneSnapshot),
        supportEmail: normalizeOptionalText(round?.paymentSupportEmailSnapshot),
        qrImage: mapPaymentProfileMedia(round?.paymentQrImageSnapshot),
      },
      customized: round?.paymentProfileCustomized === true,
      appliedAt: normalizeStoredDateTime(round?.paymentProfileAppliedAt),
      appliedBy: summarizeWorkflowActor(round?.paymentProfileAppliedBy ? {
        id: round.paymentProfileAppliedBy.id,
        username: round.paymentProfileAppliedBy.username,
        fullName: round.paymentProfileAppliedBy.fullName,
        email: round.paymentProfileAppliedBy.email,
      } : null),
      updatedAt: normalizeStoredDateTime(round?.paymentSettingsUpdatedAt),
      updatedBy: summarizeWorkflowActor(round?.paymentSettingsUpdatedBy ? {
        id: round.paymentSettingsUpdatedBy.id,
        username: round.paymentSettingsUpdatedBy.username,
        fullName: round.paymentSettingsUpdatedBy.fullName,
        email: round.paymentSettingsUpdatedBy.email,
      } : null),
    },
  };
}

function buildRegistrationResponseSubjects(selectedSubjects: SubjectSelection[]) {
  return selectedSubjects.map((item) => ({
    examRoundSubjectId: item.subject.id,
    subjectCodeSnapshot: item.subject.codeSnapshot,
    name: item.subject.nameSnapshot,
    isRequired: item.subject.isRequired,
    allowSeparateRegistration: item.subject.allowSeparateRegistration,
    feeAmount: toMoney(item.subject.fee, 0),
    components: item.components.map((component) => ({
      examRoundComponentId: component.id,
      componentCodeSnapshot: component.codeSnapshot,
      name: component.nameSnapshot,
      isRequired: component.isRequired,
      allowSeparateRegistration: component.allowSeparateRegistration,
      durationMinutes: component.durationMinutes,
      examMethod: component.examMethod,
      feeAmount: toMoney(component.fee, 0),
    })),
  }));
}

function buildRegistrationFeeResponse(feeSummary: FeeSummary, paymentDueAt: string | null) {
  return {
    calculationMethod: feeSummary.calculationMethod,
    currency: feeSummary.currency,
    fixedFee: feeSummary.fixedFee,
    subjectFeeTotal: feeSummary.subjectFeeTotal,
    componentFeeTotal: feeSummary.componentFeeTotal,
    calculatedAmount: feeSummary.calculatedAmount,
    discountAmount: feeSummary.discountAmount,
    payableAmount: feeSummary.payableAmount,
    amountDue: feeSummary.payableAmount,
    confirmedPaidAmount: feeSummary.confirmedPaidAmount,
    paymentDueAt,
    paymentStatus: feeSummary.paymentStatus,
    subjects: feeSummary.subjects,
    components: feeSummary.components,
  };
}

function logLearnerRegistrationCreated(payload: Record<string, unknown>) {
  strapi.log.info(`[exam-registration] exam_registration.created_by_learner ${JSON.stringify(payload)}`);
}

function buildTenantPath(tenantCode: string | null | undefined, path: string) {
  const normalizedTenantCode = normalizeText(tenantCode);
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  if (!normalizedTenantCode) return normalizedPath;
  return `/t/${encodeURIComponent(normalizedTenantCode)}${normalizedPath}`;
}

function trimTrailingSlash(value: string): string {
  return value.replace(/\/+$/, '');
}

async function buildLearnerRegistrationDetailLink(ctx: any, tenantId: number, registrationId: number) {
  const baseUrl = trimTrailingSlash(await getBaseUrl(ctx, { tenantId }));
  const tenantCode = normalizeText(ctx?.state?.tenant?.code || ctx?.state?.tenantCode || '');
  return `${baseUrl}${buildTenantPath(tenantCode || null, `/learner/exam-registrations/${registrationId}`)}`;
}

function buildLearnerRegistrationOptionsResponse(options: {
  workflowRound: any;
  learner: CurrentLearner;
  eligibilityDecision: EligibilityDecision;
  existingRegistration: any;
  availability: { canRegister: boolean; reasonCode: string | null; registrationWindowStatus: RegistrationWindowStatus };
  structure: MutableExamRoundStructure;
  feePreview: FeeSummary;
}) {
  let paymentConfigured = options.feePreview.payableAmount <= 0;
  let paymentReasonCode: string | null = null;
  try {
    assertExamRoundPaymentSnapshotReady(options.workflowRound, options.feePreview.payableAmount > 0);
    paymentConfigured = true;
  } catch (error: any) {
    if (error instanceof HttpError) {
      paymentReasonCode = error.code || 'PAYMENT_SETTINGS_INVALID';
    } else {
      throw error;
    }
  }

  const reasonCode = !options.availability.canRegister
    ? options.availability.reasonCode
    : options.existingRegistration?.id
      ? 'EXAM_REGISTRATION_ALREADY_EXISTS'
      : !options.eligibilityDecision.canRegister
        ? options.eligibilityDecision.reasonCode
        : !paymentConfigured
          ? paymentReasonCode
          : null;

  return {
    examRound: {
      id: Number(options.workflowRound.id),
      documentId: options.workflowRound.documentId || null,
      code: options.workflowRound.code,
      name: options.workflowRound.name,
      status: options.workflowRound.status,
      registrationStartAt: normalizeStoredDateTime(options.workflowRound.registrationStartAt),
      registrationEndAt: normalizeStoredDateTime(options.workflowRound.registrationEndAt),
      examStartAt: normalizeStoredDateTime(options.workflowRound.examStartAt),
      examEndAt: normalizeStoredDateTime(options.workflowRound.examEndAt),
    },
    learner: mapLearnerSummary(options.learner),
    canRegister: reasonCode === null,
    reasonCode,
    registrationWindowState: options.availability.registrationWindowStatus,
    existingRegistration: mapExistingRegistrationSummary(options.existingRegistration),
    allowSubjectSelection: options.workflowRound.allowSubjectSelection === true,
    allowComponentSelection: options.workflowRound.allowComponentSelection === true,
    paymentCalculationMethod: normalizeText(options.workflowRound.paymentCalculationMethod).toLowerCase() || null,
    paymentRequired: options.feePreview.payableAmount > 0,
    paymentConfigured,
    paymentDueAt: normalizeStoredDateTime(options.workflowRound.paymentEndAt),
    eligibility: {
      registrationMode: normalizeText(options.workflowRound.registrationMode).toLowerCase() || null,
      status: options.eligibilityDecision.status,
      reason: options.eligibilityDecision.reason,
    },
    subjects: buildContextSubjects(options.structure),
    feeConfiguration: {
      paymentCalculationMethod: options.feePreview.calculationMethod,
      fixedFee: options.feePreview.fixedFee,
      currency: options.feePreview.currency,
    },
    feePreview: buildRegistrationFeeResponse(options.feePreview, normalizeStoredDateTime(options.workflowRound.paymentEndAt)),
  };
}

async function loadTenantStorageUploadContext(tenantId: number, transacting?: any) {
  const tenant = await strapi.db.query(TENANT_UID).findOne({
    where: { id: tenantId },
    select: ['id', 'code', 'storageDefaultConfigId'],
    ...(transacting ? { transacting } : {}),
  } as any) as any;

  if (!tenant?.id) {
    httpError(404, 'Tenant not found', 'CROSS_TENANT_ACCESS');
  }

  return {
    id: Number(tenant.id),
    code: normalizeText(tenant.code),
    storageDefaultConfigId: Number(tenant.storageDefaultConfigId || 0) || null,
  };
}

function normalizePaymentEvidenceUploadMimeType(file: any) {
  return String(file?.mimetype || file?.type || '').trim().toLowerCase();
}

function normalizePaymentEvidenceUploadSize(file: any) {
  const size = Number(file?.size || 0);
  return Number.isFinite(size) && size >= 0 ? Math.floor(size) : 0;
}

function assertPaymentEvidenceUploadValid(file: any) {
  const mimeType = normalizePaymentEvidenceUploadMimeType(file);
  if (!mimeType || !PAYMENT_EVIDENCE_ALLOWED_MIME_TYPES.has(mimeType)) {
    httpError(400, 'Loại file chứng từ không được hỗ trợ.', 'PAYMENT_EVIDENCE_UNSUPPORTED_TYPE');
  }

  const size = normalizePaymentEvidenceUploadSize(file);
  if (!size || size > PAYMENT_EVIDENCE_MAX_FILE_SIZE) {
    httpError(400, 'Kích thước file chứng từ vượt giới hạn cho phép.', 'PAYMENT_EVIDENCE_TOO_LARGE');
  }
}

function assertLearnerPaymentReportAllowed(registration: any, now = new Date()) {
  const registrationStatus = normalizeText(registration?.registrationStatus).toLowerCase();
  if (registrationStatus === 'cancelled') {
    httpError(409, 'Registration đã bị hủy.', 'REGISTRATION_CANCELLED');
  }
  if (registrationStatus === 'rejected') {
    httpError(409, 'Registration đã bị từ chối.', 'REGISTRATION_REJECTED');
  }

  const amountDue = toMoney(registration?.amountDue ?? registration?.payableAmount, 0);
  if (amountDue <= 0) {
    httpError(409, 'Registration này không yêu cầu thanh toán.', 'PAYMENT_NOT_REQUIRED');
  }

  const paymentStatus = normalizeText(registration?.paymentStatus).toLowerCase() || null;
  if (paymentStatus === 'not_required' || paymentStatus === 'exempted') {
    httpError(409, 'Registration này không yêu cầu thanh toán.', 'PAYMENT_NOT_REQUIRED');
  }
  if (paymentStatus === 'payment_reported' || paymentStatus === 'payment_under_review') {
    httpError(409, 'Registration đã có thông báo chuyển tiền đang chờ xử lý.', 'PAYMENT_ALREADY_REPORTED');
  }
  if (paymentStatus === 'paid' || paymentStatus === 'partially_paid') {
    httpError(409, 'Registration này đã được xác nhận thanh toán.', 'PAYMENT_ALREADY_CONFIRMED');
  }
  if (!isLearnerPaymentReportableStatus(paymentStatus)) {
    httpError(409, 'Registration hiện không cho phép báo chuyển tiền.', 'PAYMENT_REPORT_NOT_ALLOWED');
  }

  const paymentDueAt = normalizeStoredDateTime(registration?.paymentDueAt);
  if (paymentDueAt && now.getTime() > Date.parse(paymentDueAt)) {
    httpError(409, 'Registration hiện không cho phép báo chuyển tiền.', 'PAYMENT_REPORT_NOT_ALLOWED');
  }
}

async function findLearnerOwnedPaymentEvidence(tenantId: number, userId: number, fileAssetId: number, transacting?: any) {
  const fileAsset = await strapi.db.query(FILE_ASSET_UID).findOne({
    where: mergeTenantWhere({
      id: { $eq: fileAssetId },
      uploadedBy: { id: { $eq: userId } },
      status: 'ACTIVE',
      isDeleted: false,
    }, tenantId),
    select: ['id', 'originalName', 'fileName', 'url', 'mimeType', 'provider', 'status', 'isDeleted'],
    populate: {
      tenant: { select: ['id'] },
      uploadedBy: { select: ['id'] },
    },
    ...(transacting ? { transacting } : {}),
  } as any) as any;

  if (!fileAsset?.id) {
    httpError(409, 'Minh chứng thanh toán không hợp lệ.', 'INVALID_PAYMENT_EVIDENCE');
  }

  const mimeType = normalizeText(fileAsset.mimeType).toLowerCase();
  if (!(mimeType.startsWith('image/') || mimeType === 'application/pdf')) {
    httpError(409, 'Minh chứng thanh toán không hợp lệ.', 'INVALID_PAYMENT_EVIDENCE');
  }

  return fileAsset;
}

async function acquireLearnerPaymentReportLock(trx: any, tenantId: number, registrationId: number) {
  if (!isPostgresClient()) return;
  await trx.raw('select pg_advisory_xact_lock(hashtext(?), hashtext(?))', [String(tenantId), `exam-registration-payment-report:${registrationId}`]);
}

async function loadLearnerRegistrationInTenant(tenantId: number, registrationRef: unknown, learnerId: number, transacting?: any) {
  const where = whereByParam(registrationRef);
  if (!where) {
    httpError(404, 'Không tìm thấy hồ sơ đăng ký dự thi.', 'EXAM_REGISTRATION_NOT_FOUND');
  }

  const registration = await strapi.db.query(EXAM_REGISTRATION_UID).findOne({
    where: mergeTenantWhere({
      $and: [
        where,
        { learner: { id: { $eq: learnerId } } },
      ],
    }, tenantId),
    select: [
      'id', 'documentId', 'registrationCode', 'registeredAt', 'registrationSource', 'registrationStatus', 'eligibilityStatus', 'paymentStatus',
      'paymentCalculationMethodSnapshot', 'fixedFeeSnapshot', 'subjectFeeTotalSnapshot', 'componentFeeTotalSnapshot', 'calculatedAmount', 'discountAmount', 'payableAmount', 'amountDue', 'currency', 'paymentDueAt', 'confirmedPaidAmount',
      'paymentReportedAt', 'paymentReportNote', 'paymentTransferAt', 'paymentSenderName', 'paymentSenderAccount', 'paymentSenderBank', 'paymentTransactionReference', 'paymentReportUpdatedAt', 'paymentConfirmedAt',
      'studentCodeSnapshot', 'fullNameSnapshot', 'classNameSnapshot', 'cohortSnapshot', 'majorSnapshot',
      'paymentMethodSnapshot', 'paymentProfileNameSnapshot', 'paymentProfileCodeSnapshot', 'paymentBankCodeSnapshot', 'paymentBankNameSnapshot', 'paymentAccountNumberSnapshot', 'paymentAccountHolderSnapshot', 'paymentBankBranchSnapshot', 'paymentTransferContentTemplateSnapshot', 'paymentTransferContent', 'paymentInstructionSnapshot', 'paymentSupportPhoneSnapshot', 'paymentSupportEmailSnapshot',
      'createdAt',
    ],
    populate: {
      learner: { select: ['id', 'documentId', 'code', 'fullName', 'dateOfBirth'] },
      examRound: { select: ['id', 'documentId', 'code', 'name', 'status', 'registrationMode', 'registrationStartAt', 'registrationEndAt', 'examStartAt', 'examEndAt', 'paymentEndAt'] },
      paymentReportedBy: { select: ['id'] },
      paymentConfirmedBy: { select: ['id'] },
      paymentEvidence: { select: ['id', 'originalName', 'fileName', 'url', 'mimeType', 'provider', 'status', 'isDeleted'] },
      paymentQrImageSnapshot: { select: ['id', 'name', 'url', 'mime'] },
      subjectRegistrations: {
        select: ['id', 'subjectCodeSnapshot', 'nameSnapshot', 'isRequiredSnapshot', 'allowSeparateRegistrationSnapshot', 'calculationMethodSnapshot', 'requiredAggregateScoreSnapshot', 'requireAllComponentsSnapshot', 'ruleDescriptionSnapshot', 'participationType', 'registrationStatus', 'feeAmount'],
        orderBy: [{ id: 'asc' }],
        populate: {
          examRoundSubject: { select: ['id'] },
          componentRegistrations: {
            select: ['id', 'componentCodeSnapshot', 'nameSnapshot', 'isRequiredSnapshot', 'allowSeparateRegistrationSnapshot', 'durationMinutesSnapshot', 'examMethodSnapshot', 'participationType', 'registrationStatus', 'feeAmount'],
            orderBy: [{ id: 'asc' }],
            populate: {
              examRoundComponent: { select: ['id'] },
            },
          },
        },
      },
    },
    ...(transacting ? { transacting } : {}),
  } as any) as any;

  if (!registration?.id) {
    httpError(404, 'Không tìm thấy hồ sơ đăng ký dự thi.', 'EXAM_REGISTRATION_NOT_FOUND');
  }

  return registration;
}

function buildLearnerExamRegistrationDetailResponse(registration: any) {
  const learner = registration?.learner || null;
  const round = registration?.examRound || null;
  const subjects = (registration?.subjectRegistrations || []).map((subject: any) => ({
    id: Number(subject.id || 0) || 0,
    examRoundSubjectId: Number(extractRelationRef(subject?.examRoundSubject) || subject?.examRoundSubject?.id || 0) || 0,
    subjectCodeSnapshot: normalizeOptionalText(subject?.subjectCodeSnapshot, 100),
    nameSnapshot: normalizeOptionalText(subject?.nameSnapshot, 200),
    isRequired: subject?.isRequiredSnapshot !== false,
    allowSeparateRegistration: subject?.allowSeparateRegistrationSnapshot === true,
    calculationMethod: normalizeText(subject?.calculationMethodSnapshot).toLowerCase() || null,
    requiredAggregateScore: decimalToNumber(subject?.requiredAggregateScoreSnapshot),
    requireAllComponents: subject?.requireAllComponentsSnapshot !== false,
    ruleDescription: normalizeOptionalText(subject?.ruleDescriptionSnapshot),
    participationType: normalizeText(subject?.participationType).toLowerCase() || null,
    registrationStatus: normalizeText(subject?.registrationStatus).toLowerCase() || null,
    feeAmount: toMoney(subject?.feeAmount, 0),
    components: (subject?.componentRegistrations || []).map((component: any) => ({
      id: Number(component.id || 0) || 0,
      examRoundComponentId: Number(extractRelationRef(component?.examRoundComponent) || component?.examRoundComponent?.id || 0) || 0,
      componentCodeSnapshot: normalizeOptionalText(component?.componentCodeSnapshot, 100),
      nameSnapshot: normalizeOptionalText(component?.nameSnapshot, 200),
      isRequired: component?.isRequiredSnapshot !== false,
      allowSeparateRegistration: component?.allowSeparateRegistrationSnapshot === true,
      durationMinutes: Number(component?.durationMinutesSnapshot || 0) || null,
      examMethod: normalizeText(component?.examMethodSnapshot).toLowerCase() || null,
      participationType: normalizeText(component?.participationType).toLowerCase() || null,
      registrationStatus: normalizeText(component?.registrationStatus).toLowerCase() || null,
      feeAmount: toMoney(component?.feeAmount, 0),
    })),
  }));

  return {
    registration: {
      id: Number(registration.id),
      documentId: registration.documentId || null,
      registrationCode: normalizeText(registration.registrationCode),
      registrationStatus: normalizeText(registration.registrationStatus).toLowerCase() || null,
      eligibilityStatus: normalizeText(registration.eligibilityStatus).toLowerCase() || null,
      paymentStatus: normalizeText(registration.paymentStatus).toLowerCase() || null,
      registrationSource: normalizeText(registration.registrationSource).toLowerCase() || null,
      registeredAt: normalizeStoredDateTime(registration.registeredAt),
      createdAt: normalizeStoredDateTime(registration.createdAt),
    },
    learner: learner ? {
      id: Number(learner.id),
      documentId: learner.documentId || null,
      code: normalizeText(registration.studentCodeSnapshot || learner.code),
      fullName: normalizeText(registration.fullNameSnapshot || learner.fullName),
      dateOfBirth: normalizeStoredDateTime(learner.dateOfBirth) || normalizeText(learner.dateOfBirth) || null,
      className: normalizeOptionalText(registration.classNameSnapshot, 200),
      cohort: normalizeOptionalText(registration.cohortSnapshot, 100),
      major: normalizeOptionalText(registration.majorSnapshot, 200),
    } : null,
    examRound: round ? {
      id: Number(round.id),
      documentId: round.documentId || null,
      code: normalizeText(round.code),
      name: normalizeText(round.name),
      status: normalizeText(round.status).toLowerCase() || null,
      registrationMode: normalizeText(round.registrationMode).toLowerCase() || null,
      registrationStartAt: normalizeStoredDateTime(round.registrationStartAt),
      registrationEndAt: normalizeStoredDateTime(round.registrationEndAt),
      examStartAt: normalizeStoredDateTime(round.examStartAt),
      examEndAt: normalizeStoredDateTime(round.examEndAt),
    } : null,
    subjects,
    fee: {
      calculationMethod: normalizeText(registration.paymentCalculationMethodSnapshot).toLowerCase() || null,
      fixedFee: decimalToNumber(registration.fixedFeeSnapshot),
      subjectFeeTotal: toMoney(registration.subjectFeeTotalSnapshot, 0),
      componentFeeTotal: toMoney(registration.componentFeeTotalSnapshot, 0),
      calculatedAmount: toMoney(registration.calculatedAmount, 0),
      discountAmount: toMoney(registration.discountAmount, 0),
      payableAmount: toMoney(registration.payableAmount, 0),
      amountDue: toMoney(registration.amountDue ?? registration.payableAmount, 0),
      confirmedPaidAmount: toMoney(registration.confirmedPaidAmount, 0),
      currency: normalizeUpperOptionalText(registration.currency, 10) || 'VND',
      paymentDueAt: normalizeStoredDateTime(registration.paymentDueAt || round?.paymentEndAt),
    },
    payment: mapRegistrationPaymentSnapshot(registration),
    paymentReport: buildPaymentReportSummary(registration),
    status: {
      registrationStatus: normalizeText(registration.registrationStatus).toLowerCase() || null,
      eligibilityStatus: normalizeText(registration.eligibilityStatus).toLowerCase() || null,
      paymentStatus: normalizeText(registration.paymentStatus).toLowerCase() || null,
    },
    review: {
      acceptedAt: normalizeStoredDateTime(registration.acceptedAt),
      returnedAt: normalizeStoredDateTime(registration.returnedAt),
      returnReason: normalizeOptionalText(registration.returnReason),
      rejectedAt: normalizeStoredDateTime(registration.rejectedAt),
      rejectionReason: normalizeOptionalText(registration.rejectionReason),
    },
  };
}

async function enqueueLearnerRegistrationEmail(ctx: any, options: {
  tenantId: number;
  learner: CurrentLearner;
  authUser: AuthUser;
  registrationId: number;
  registrationCode: string;
  examRoundCode: string;
  examRoundName: string;
  registeredAt: string;
  subjects: ReturnType<typeof buildRegistrationResponseSubjects>;
  feeSummary: FeeSummary;
  paymentDueAt: string | null;
  paymentSnapshot: RegistrationPaymentSnapshot;
}) {
  const recipientEmail = normalizeText(options.authUser?.email).toLowerCase();
  if (!recipientEmail) return;

  try {
    const detailUrl = await buildLearnerRegistrationDetailLink(ctx, options.tenantId, options.registrationId);
    const subjectLines = options.subjects
      .map((subject) => {
        const componentText = (subject.components || []).map((component) => component.name).filter(Boolean).join(', ');
        return componentText ? `${subject.name}: ${componentText}` : subject.name;
      })
      .filter(Boolean);

    const htmlParts = [
      `<p>Xin chào ${options.learner.fullName || 'bạn'},</p>`,
      `<p>Hệ thống đã ghi nhận hồ sơ đăng ký dự thi của bạn.</p>`,
      '<ul>',
      `<li>Mã hồ sơ: <strong>${options.registrationCode}</strong></li>`,
      `<li>Đợt thi: <strong>${options.examRoundName}</strong> (${options.examRoundCode})</li>`,
      `<li>Thời gian đăng ký: <strong>${options.registeredAt}</strong></li>`,
      `<li>Lệ phí phải nộp: <strong>${new Intl.NumberFormat('vi-VN').format(options.feeSummary.payableAmount)} ${options.feeSummary.currency}</strong></li>`,
      options.paymentDueAt ? `<li>Hạn thanh toán: <strong>${options.paymentDueAt}</strong></li>` : '',
      '</ul>',
      subjectLines.length > 0 ? `<p>Nội dung đăng ký: ${subjectLines.join(' | ')}</p>` : '',
      options.paymentSnapshot.paymentRequired ? '<p><strong>Thông tin chuyển khoản</strong></p>' : '<p>Đợt thi này không yêu cầu nộp lệ phí.</p>',
      options.paymentSnapshot.paymentRequired ? '<ul>' : '',
      options.paymentSnapshot.paymentRequired ? `<li>Ngân hàng: <strong>${options.paymentSnapshot.bankName || options.paymentSnapshot.bankCode || '-'}</strong></li>` : '',
      options.paymentSnapshot.paymentRequired ? `<li>Số tài khoản: <strong>${options.paymentSnapshot.accountNumber || '-'}</strong></li>` : '',
      options.paymentSnapshot.paymentRequired ? `<li>Chủ tài khoản: <strong>${options.paymentSnapshot.accountHolder || '-'}</strong></li>` : '',
      options.paymentSnapshot.paymentRequired ? `<li>Nội dung chuyển khoản: <strong>${options.paymentSnapshot.transferContent || '-'}</strong></li>` : '',
      options.paymentSnapshot.paymentRequired ? '</ul>' : '',
      `<p>Xem hồ sơ chi tiết tại: <a href="${detailUrl}">${detailUrl}</a></p>`,
    ].filter(Boolean);

    await enqueueMail({
      to: recipientEmail,
      subject: `[${options.examRoundCode}] Xác nhận đăng ký dự thi ${options.registrationCode}`,
      html: htmlParts.join(''),
      text: [
        `Xin chào ${options.learner.fullName || 'bạn'},`,
        'Hệ thống đã ghi nhận hồ sơ đăng ký dự thi của bạn.',
        `Mã hồ sơ: ${options.registrationCode}`,
        `Đợt thi: ${options.examRoundName} (${options.examRoundCode})`,
        `Lệ phí phải nộp: ${options.feeSummary.payableAmount} ${options.feeSummary.currency}`,
        options.paymentDueAt ? `Hạn thanh toán: ${options.paymentDueAt}` : '',
        options.paymentSnapshot.paymentRequired ? `Ngân hàng: ${options.paymentSnapshot.bankName || options.paymentSnapshot.bankCode || '-'}` : 'Đợt thi này không yêu cầu nộp lệ phí.',
        options.paymentSnapshot.paymentRequired ? `Số tài khoản: ${options.paymentSnapshot.accountNumber || '-'}` : '',
        options.paymentSnapshot.paymentRequired ? `Chủ tài khoản: ${options.paymentSnapshot.accountHolder || '-'}` : '',
        options.paymentSnapshot.paymentRequired ? `Nội dung chuyển khoản: ${options.paymentSnapshot.transferContent || '-'}` : '',
        `Xem hồ sơ: ${detailUrl}`,
      ].filter(Boolean).join('\n'),
      metadata: {
        module: 'exam-registration',
        tenantId: options.tenantId,
        registrationId: options.registrationId,
        registrationCode: options.registrationCode,
      },
    });
  } catch (error: any) {
    strapi.log.error('[exam-registration] failed to enqueue learner registration email', {
      tenantId: options.tenantId,
      registrationId: options.registrationId,
      registrationCode: options.registrationCode,
      message: normalizeText(error?.message) || 'Unknown email enqueue error',
    });
  }
}

function registrationStateChangedDuringRequest(currentStatus: string, round: any, requestStartedAt: Date): boolean {
  const startedAt = requestStartedAt.getTime() - REGISTRATION_CONCURRENCY_GUARD_WINDOW_MS;
  if (currentStatus === 'registration_paused') {
    const pausedAt = normalizeStoredDateTime(round?.registrationPausedAt);
    return Boolean(pausedAt && Date.parse(pausedAt) >= startedAt);
  }
  if (currentStatus === 'registration_open') {
    const resumedAt = normalizeStoredDateTime(round?.registrationResumedAt);
    return Boolean(resumedAt && Date.parse(resumedAt) >= startedAt);
  }
  return false;
}

function assertChronologicalOrder(leftIso: string | null, rightIso: string | null, message: string) {
  if (!leftIso || !rightIso) return;
  if (Date.parse(leftIso) >= Date.parse(rightIso)) {
    httpError(400, message, 'INVALID_DATE_RANGE');
  }
}

function assertLessOrEqual(leftIso: string | null, rightIso: string | null, message: string) {
  if (!leftIso || !rightIso) return;
  if (Date.parse(leftIso) > Date.parse(rightIso)) {
    httpError(400, message, 'INVALID_DATE_RANGE');
  }
}

function normalizeInput(payload: Record<string, unknown>): CreateExamRoundInput {
  const paymentCalculationMethod = normalizeEnum(payload.paymentCalculationMethod, ['program_fee', 'subject_fee', 'component_fee', 'fixed'], 'program_fee', 'paymentCalculationMethod');
  const registrationStartAt = parseDateTime(payload.registrationStartAt, 'registrationStartAt', { required: true });
  const registrationEndAt = parseDateTime(payload.registrationEndAt, 'registrationEndAt', { required: true });
  const paymentStartAt = parseDateTime(payload.paymentStartAt, 'paymentStartAt');
  const paymentEndAt = parseDateTime(payload.paymentEndAt, 'paymentEndAt');
  const candidateListClosingAt = parseDateTime(payload.candidateListClosingAt, 'candidateListClosingAt');
  const examStartAt = parseDateTime(payload.examStartAt, 'examStartAt');
  const examEndAt = parseDateTime(payload.examEndAt, 'examEndAt');
  const cancellationDeadline = parseDateTime(payload.cancellationDeadline, 'cancellationDeadline');

  assertChronologicalOrder(registrationStartAt, registrationEndAt, 'registrationStartAt must be before registrationEndAt');
  assertLessOrEqual(paymentStartAt, paymentEndAt, 'paymentStartAt must be before or equal to paymentEndAt');
  assertLessOrEqual(registrationEndAt, candidateListClosingAt, 'candidateListClosingAt cannot be before registrationEndAt');
  assertLessOrEqual(candidateListClosingAt, examStartAt, 'examStartAt cannot be before candidateListClosingAt');
  assertLessOrEqual(examStartAt, examEndAt, 'examEndAt cannot be before examStartAt');
  assertLessOrEqual(cancellationDeadline, registrationEndAt, 'cancellationDeadline cannot be after registrationEndAt');

  if ((paymentStartAt && !paymentEndAt) || (!paymentStartAt && paymentEndAt)) {
    httpError(400, 'paymentStartAt and paymentEndAt must be provided together', 'INVALID_DATE_RANGE');
  }

  const fixedFee = paymentCalculationMethod === 'fixed'
    ? parseDecimalInput(payload.fixedFee, 'fixedFee', { required: true, min: 0 })
    : null;

  return {
    examProgramId: normalizePositiveInteger(payload.examProgramId, 'examProgramId'),
    code: normalizeRequiredText(payload.code, 'code', 100),
    name: normalizeRequiredText(payload.name, 'name', 200),
    academicYear: normalizeOptionalText(payload.academicYear, 50),
    semester: normalizeOptionalText(payload.semester, 50),
    registrationMode: normalizeEnum(payload.registrationMode, ['open', 'restricted'], 'restricted', 'registrationMode'),
    registrationStartAt,
    registrationEndAt,
    paymentStartAt,
    paymentEndAt,
    candidateListClosingAt,
    examStartAt,
    examEndAt,
    paymentCalculationMethod,
    fixedFee,
    allowSubjectSelection: normalizeBoolean(payload.allowSubjectSelection, false),
    allowComponentSelection: normalizeBoolean(payload.allowComponentSelection, false),
    requireConfirmedPayment: normalizeBoolean(payload.requireConfirmedPayment, true),
    allowCancellation: normalizeBoolean(payload.allowCancellation, false),
    cancellationDeadline,
    instructions: normalizeOptionalText(payload.instructions),
    paymentInstructions: normalizeOptionalText(payload.paymentInstructions),
  };
}

function isPostgresClient() {
  const client = String(strapi.db?.connection?.client?.config?.client || '').toLowerCase();
  return client.includes('pg');
}

async function acquireExamRoundCodeLock(trx: any, tenantId: number, code: string) {
  if (!isPostgresClient()) return;
  await trx.raw('select pg_advisory_xact_lock(hashtext(?), hashtext(?))', [String(tenantId), code.toLowerCase()]);
}

async function findExamRoundByCode(tenantId: number, code: string, transacting?: any) {
  return strapi.db.query(EXAM_ROUND_UID).findOne({
    where: mergeTenantWhere({ code }, tenantId),
    select: ['id', 'documentId', 'code'],
    ...(transacting ? { transacting } : {}),
  });
}

async function loadProgramGraph(tenantId: number, examProgramId: number) {
  const examProgram = await strapi.db.query(EXAM_PROGRAM_UID).findOne({
    where: mergeTenantWhere({ id: examProgramId }, tenantId),
    select: ['id', 'documentId', 'code', 'name', 'isActive', 'defaultFee', 'feeCalculationMethod'],
  }) as any;

  if (!examProgram?.id) {
    httpError(404, 'Không tìm thấy chương trình thi trong tenant hiện tại.', 'EXAM_PROGRAM_NOT_FOUND');
  }

  if (examProgram.isActive === false) {
    httpError(409, 'Chương trình thi đang ngưng hoạt động.', 'EXAM_PROGRAM_INACTIVE');
  }

  const programSubjects = await strapi.db.query(EXAM_PROGRAM_SUBJECT_UID).findMany({
    where: mergeTenantWhere({ examProgram: { id: { $eq: examProgram.id } } }, tenantId),
    select: ['id', 'displayOrder', 'isRequired', 'feeOverride'],
    populate: {
      tenant: { select: ['id'] },
      examSubject: {
        select: ['id', 'code', 'name', 'isActive', 'calculationMethod', 'requiredAggregateScore', 'requireAllComponents', 'defaultFee', 'ruleDescription'],
        populate: {
          tenant: { select: ['id'] },
        },
      },
    },
    orderBy: [{ displayOrder: 'asc' }, { id: 'asc' }],
  }) as any[];

  if (!programSubjects.length) {
    httpError(409, 'Chương trình thi chưa có môn thi nào.', 'EXAM_PROGRAM_EMPTY');
  }

  const subjectIds = programSubjects
    .map((item) => Number(extractRelationRef(item?.examSubject) || item?.examSubject?.id || 0))
    .filter((value) => Number.isInteger(value) && value > 0);

  const subjectComponents = subjectIds.length > 0
    ? await strapi.db.query(EXAM_SUBJECT_COMPONENT_UID).findMany({
        where: mergeTenantWhere({
          examSubject: {
            id: {
              $in: subjectIds,
            },
          },
        }, tenantId),
        select: ['id', 'displayOrder', 'isRequired', 'weight', 'passingScoreOverride', 'eliminationScoreOverride', 'durationMinutesOverride'],
        populate: {
          tenant: { select: ['id'] },
          examSubject: {
            select: ['id'],
            populate: { tenant: { select: ['id'] } },
          },
          examComponent: {
            select: ['id', 'code', 'name', 'isActive', 'minimumScore', 'maximumScore', 'passingScore', 'eliminationScore', 'defaultDurationMinutes', 'examMethod'],
            populate: { tenant: { select: ['id'] } },
          },
        },
        orderBy: [{ displayOrder: 'asc' }, { id: 'asc' }],
      }) as any[]
    : [];

  return {
    examProgram,
    programSubjects,
    subjectComponents,
  };
}

function validateProgramGraph(tenantId: number, programGraph: Awaited<ReturnType<typeof loadProgramGraph>>, input: CreateExamRoundInput) {
  const configErrors: Array<Record<string, unknown>> = [];
  const warnings: Array<Record<string, unknown>> = [];
  const subjectComponentsBySubjectId = new Map<number, any[]>();

  for (const item of programGraph.subjectComponents) {
    const subjectId = Number(extractRelationRef(item?.examSubject) || item?.examSubject?.id || 0);
    if (!subjectComponentsBySubjectId.has(subjectId)) {
      subjectComponentsBySubjectId.set(subjectId, []);
    }
    subjectComponentsBySubjectId.get(subjectId)?.push(item);
  }

  const subjectDrafts: SubjectSnapshotDraft[] = [];
  const componentDraftsBySubjectId = new Map<number, ComponentSnapshotDraft[]>();

  for (const programSubject of programGraph.programSubjects) {
    const programSubjectTenantId = Number(extractRelationRef(programSubject?.tenant) || programSubject?.tenant?.id || 0);
    const subject = programSubject?.examSubject;
    const subjectId = Number(extractRelationRef(subject) || subject?.id || 0);
    const subjectTenantId = Number(extractRelationRef(subject?.tenant) || subject?.tenant?.id || 0);

    if (programSubjectTenantId && programSubjectTenantId !== tenantId) {
      configErrors.push({ code: 'CROSS_TENANT_RELATION', path: `programSubject:${programSubject.id}`, message: 'Program subject belongs to another tenant.' });
      continue;
    }

    if (!subject?.id) {
      configErrors.push({ code: 'EXAM_SUBJECT_INVALID', path: `programSubject:${programSubject.id}`, message: 'Referenced exam subject is missing.' });
      continue;
    }

    if (subjectTenantId && subjectTenantId !== tenantId) {
      configErrors.push({ code: 'CROSS_TENANT_RELATION', path: `examSubject:${subjectId}`, message: 'Exam subject belongs to another tenant.' });
      continue;
    }

    if (subject.isActive === false) {
      configErrors.push({ code: 'EXAM_SUBJECT_INVALID', path: `examSubject:${subjectId}`, message: 'Exam subject is inactive.' });
      continue;
    }

    const subjectComponents = subjectComponentsBySubjectId.get(subjectId) || [];
    if (subjectComponents.length === 0) {
      configErrors.push({ code: 'EXAM_SUBJECT_INVALID', path: `examSubject:${subjectId}`, message: 'Exam subject has no valid subject-component configuration.' });
      continue;
    }

    const subjectFee = decimalToString(programSubject?.feeOverride) ?? decimalToString(subject?.defaultFee);
    subjectDrafts.push({
      sourceProgramSubjectId: Number(programSubject.id),
      examSubjectId: subjectId,
      nameSnapshot: normalizeRequiredText(subject.name, 'subject.name', 200),
      calculationMethodSnapshot: normalizeEnum(subject.calculationMethod, ['total', 'average', 'all_components_pass', 'custom'], 'total', 'calculationMethodSnapshot'),
      requiredAggregateScoreSnapshot: decimalToString(subject.requiredAggregateScore),
      requireAllComponentsSnapshot: subject.requireAllComponents !== false,
      ruleDescriptionSnapshot: normalizeOptionalText(subject.ruleDescription),
      fee: subjectFee,
      isRequired: programSubject.isRequired !== false,
      allowSeparateRegistration: input.allowSubjectSelection === true,
      displayOrder: Number(programSubject.displayOrder || 0) || 0,
    });

    const componentDrafts: ComponentSnapshotDraft[] = [];
    for (const subjectComponent of subjectComponents) {
      const subjectComponentTenantId = Number(extractRelationRef(subjectComponent?.tenant) || subjectComponent?.tenant?.id || 0);
      const component = subjectComponent?.examComponent;
      const componentId = Number(extractRelationRef(component) || component?.id || 0);
      const componentTenantId = Number(extractRelationRef(component?.tenant) || component?.tenant?.id || 0);

      if (subjectComponentTenantId && subjectComponentTenantId !== tenantId) {
        configErrors.push({ code: 'CROSS_TENANT_RELATION', path: `subjectComponent:${subjectComponent.id}`, message: 'Subject component belongs to another tenant.' });
        continue;
      }

      if (!component?.id) {
        configErrors.push({ code: 'EXAM_COMPONENT_INVALID', path: `subjectComponent:${subjectComponent.id}`, message: 'Referenced exam component is missing.' });
        continue;
      }

      if (componentTenantId && componentTenantId !== tenantId) {
        configErrors.push({ code: 'CROSS_TENANT_RELATION', path: `examComponent:${componentId}`, message: 'Exam component belongs to another tenant.' });
        continue;
      }

      if (component.isActive === false) {
        configErrors.push({ code: 'EXAM_COMPONENT_INVALID', path: `examComponent:${componentId}`, message: 'Exam component is inactive.' });
        continue;
      }

      const minimumScore = decimalToNumber(component.minimumScore);
      const maximumScore = decimalToNumber(component.maximumScore);
      const passingScore = decimalToNumber(subjectComponent.passingScoreOverride) ?? decimalToNumber(component.passingScore);
      const eliminationScore = decimalToNumber(subjectComponent.eliminationScoreOverride) ?? decimalToNumber(component.eliminationScore);
      const durationMinutes = Number(subjectComponent.durationMinutesOverride || component.defaultDurationMinutes || 0) || null;

      if (minimumScore === null || maximumScore === null || minimumScore >= maximumScore) {
        configErrors.push({ code: 'EXAM_COMPONENT_INVALID', path: `examComponent:${componentId}`, message: 'minimumScoreSnapshot must be less than maximumScoreSnapshot.' });
        continue;
      }

      if (passingScore !== null && (passingScore < minimumScore || passingScore > maximumScore)) {
        configErrors.push({ code: 'EXAM_COMPONENT_INVALID', path: `examComponent:${componentId}`, message: 'passingScoreSnapshot is outside the valid score range.' });
        continue;
      }

      if (eliminationScore !== null && (eliminationScore < minimumScore || eliminationScore > maximumScore)) {
        configErrors.push({ code: 'EXAM_COMPONENT_INVALID', path: `examComponent:${componentId}`, message: 'eliminationScoreSnapshot is outside the valid score range.' });
        continue;
      }

      if (durationMinutes !== null && durationMinutes <= 0) {
        configErrors.push({ code: 'EXAM_COMPONENT_INVALID', path: `examComponent:${componentId}`, message: 'durationMinutes must be greater than 0.' });
        continue;
      }

      if (input.paymentCalculationMethod === 'component_fee') {
        warnings.push({ code: 'COMPONENT_FEE_NOT_CONFIGURED', message: `Component fee is not configured for exam component ${componentId}; snapshot fee will be null.` });
      }

      componentDrafts.push({
        sourceSubjectId: subjectId,
        examComponentId: componentId,
        nameSnapshot: normalizeRequiredText(component.name, 'component.name', 200),
        minimumScoreSnapshot: decimalToString(component.minimumScore),
        maximumScoreSnapshot: decimalToString(component.maximumScore),
        passingScoreSnapshot: decimalToString(subjectComponent.passingScoreOverride) ?? decimalToString(component.passingScore),
        eliminationScoreSnapshot: decimalToString(subjectComponent.eliminationScoreOverride) ?? decimalToString(component.eliminationScore),
        durationMinutes,
        examMethod: normalizeEnum(component.examMethod, ['computer', 'paper', 'oral', 'practical', 'mixed', 'other'], 'other', 'examMethod'),
        fee: null,
        isRequired: subjectComponent.isRequired !== false,
        allowSeparateRegistration: input.allowComponentSelection === true,
        displayOrder: Number(subjectComponent.displayOrder || 0) || 0,
      });
    }

    if (componentDrafts.length === 0) {
      configErrors.push({ code: 'EXAM_SUBJECT_INVALID', path: `examSubject:${subjectId}`, message: 'Exam subject has no active exam components after validation.' });
      continue;
    }

    componentDraftsBySubjectId.set(subjectId, componentDrafts);
  }

  if (configErrors.length > 0) {
    httpError(409, 'Cấu hình chương trình thi không hợp lệ để tạo đợt thi.', 'SNAPSHOT_CREATION_FAILED', configErrors);
  }

  return { subjectDrafts, componentDraftsBySubjectId, warnings };
}

function resolveExamRoundFixedFee(input: CreateExamRoundInput, examProgram: any, subjectDrafts: SubjectSnapshotDraft[]): string | null {
  if (input.paymentCalculationMethod === 'fixed') {
    return input.fixedFee;
  }

  if (input.paymentCalculationMethod === 'program_fee') {
    const programDefaultFee = decimalToString(examProgram?.defaultFee);
    if (programDefaultFee !== null) return programDefaultFee;

    if (normalizeText(examProgram?.feeCalculationMethod).toLowerCase() === 'sum_subject_fees') {
      const total = subjectDrafts.reduce((sum, item) => sum + (decimalToNumber(item.fee) || 0), 0);
      return String(total);
    }
  }

  return null;
}

function buildExamRoundCreateData(input: CreateExamRoundInput, tenantId: number, examProgramId: number, fixedFee: string | null) {
  return {
    code: input.code,
    name: input.name,
    examProgram: examProgramId,
    academicYear: input.academicYear,
    semester: input.semester,
    registrationMode: input.registrationMode,
    registrationStartAt: input.registrationStartAt,
    registrationEndAt: input.registrationEndAt,
    paymentStartAt: input.paymentStartAt,
    paymentEndAt: input.paymentEndAt,
    candidateListClosingAt: input.candidateListClosingAt,
    examStartAt: input.examStartAt,
    examEndAt: input.examEndAt,
    paymentCalculationMethod: input.paymentCalculationMethod,
    fixedFee,
    allowSubjectSelection: input.allowSubjectSelection,
    allowComponentSelection: input.allowComponentSelection,
    requireConfirmedPayment: input.requireConfirmedPayment,
    allowCancellation: input.allowCancellation,
    cancellationDeadline: input.cancellationDeadline,
    instructions: input.instructions,
    paymentInstructions: input.paymentInstructions,
    status: 'draft',
    tenant: tenantId,
  };
}

function isUniqueViolation(error: any): boolean {
  return String(error?.code || '') === '23505';
}

async function acquireExamRoundStructureLock(trx: any, tenantId: number, roundId: number) {
  if (!isPostgresClient()) return;
  await trx.raw('select pg_advisory_xact_lock(hashtext(?), ?)', [String(tenantId), Number(roundId)]);
}

async function findExamRoundByRef(tenantId: number, roundRef: unknown, transacting?: any) {
  const where = whereByParam(roundRef);
  if (!where) {
    httpError(400, 'Invalid exam round id', 'EXAM_ROUND_NOT_FOUND');
  }

  const round = await strapi.db.query(EXAM_ROUND_UID).findOne({
    where: mergeTenantWhere(where, tenantId),
    select: ['id', 'documentId', 'code', 'status', 'allowSubjectSelection', 'allowComponentSelection', 'paymentCalculationMethod', 'fixedFee'],
    ...(transacting ? { transacting } : {}),
  }) as any;

  if (!round?.id) {
    httpError(404, 'Không tìm thấy đợt thi trong tenant hiện tại.', 'EXAM_ROUND_NOT_FOUND');
  }

  return round;
}

async function loadExamRoundWorkflowContext(tenantId: number, roundRef: unknown, transacting?: any) {
  const where = whereByParam(roundRef);
  if (!where) {
    httpError(400, 'Invalid exam round id', 'EXAM_ROUND_NOT_FOUND');
  }

  const round = await strapi.db.query(EXAM_ROUND_UID).findOne({
    where: mergeTenantWhere(where, tenantId),
    select: [
      'id',
      'documentId',
      'code',
      'name',
      'status',
      'registrationMode',
      'registrationStartAt',
      'registrationEndAt',
      'paymentStartAt',
      'paymentEndAt',
      'candidateListClosingAt',
      'examStartAt',
      'examEndAt',
      'paymentCalculationMethod',
      'fixedFee',
      'paymentMethodSnapshot',
      'paymentProfileNameSnapshot',
      'paymentProfileCodeSnapshot',
      'paymentBankCodeSnapshot',
      'paymentBankNameSnapshot',
      'paymentAccountNumberSnapshot',
      'paymentAccountHolderSnapshot',
      'paymentBankBranchSnapshot',
      'paymentCurrencySnapshot',
      'paymentTransferContentTemplateSnapshot',
      'paymentInstructionSnapshot',
      'paymentSupportPhoneSnapshot',
      'paymentSupportEmailSnapshot',
      'allowSubjectSelection',
      'allowComponentSelection',
      'requireConfirmedPayment',
      'allowCancellation',
      'cancellationDeadline',
      'submittedAt',
      'approvedAt',
      'returnedAt',
      'approvalNote',
      'returnReason',
      'registrationOpenedAt',
      'registrationPausedAt',
      'registrationPauseReason',
      'registrationResumedAt',
      'registrationClosedAt',
      'registrationCloseReason',
    ],
    populate: {
      tenant: { select: ['id'] },
      examProgram: {
        select: ['id', 'documentId', 'code', 'name'],
        populate: { tenant: { select: ['id'] } },
      },
      submittedBy: { select: ['id', 'username', 'fullName', 'email'] },
      approvedBy: { select: ['id', 'username', 'fullName', 'email'] },
      returnedBy: { select: ['id', 'username', 'fullName', 'email'] },
      registrationOpenedBy: { select: ['id', 'username', 'fullName', 'email'] },
      registrationPausedBy: { select: ['id', 'username', 'fullName', 'email'] },
      registrationResumedBy: { select: ['id', 'username', 'fullName', 'email'] },
      registrationClosedBy: { select: ['id', 'username', 'fullName', 'email'] },
      paymentQrImageSnapshot: { select: ['id', 'name', 'url', 'mime'] },
    },
    ...(transacting ? { transacting } : {}),
  }) as any;

  if (!round?.id) {
    httpError(404, 'Không tìm thấy đợt thi trong tenant hiện tại.', 'EXAM_ROUND_NOT_FOUND');
  }

  return round;
}

async function findLearnerInTenant(tenantId: number, learnerRef: unknown, transacting?: any) {
  const learner = await strapi.db.query(LEARNER_UID).findOne({
    where: mergeTenantWhere(whereByParam(learnerRef), tenantId),
    select: ['id', 'code', 'fullName', 'dateOfBirth', 'parentPhone', 'learnerStatus'],
    ...(transacting ? { transacting } : {}),
  }) as any;

  if (!learner?.id) {
    httpError(404, 'Không tìm thấy learner trong tenant hiện tại.', 'LEARNER_NOT_FOUND');
  }

  return learner;
}

async function findExamEligibilityInRound(tenantId: number, roundId: number, eligibilityRef: unknown, transacting?: any) {
  const where = whereByParam(eligibilityRef);
  if (!where) {
    httpError(404, 'Không tìm thấy exam eligibility trong round hiện tại.', 'EXAM_ELIGIBILITY_NOT_FOUND');
  }

  const entity = await strapi.db.query(EXAM_ELIGIBILITY_UID).findOne({
    where: mergeTenantWhere({
      $and: [
        where,
        {
          examRound: {
            id: { $eq: roundId },
          },
        },
      ],
    }, tenantId),
    populate: {
      examRound: { select: ['id', 'documentId', 'code', 'status'] },
      learner: { select: ['id', 'code', 'fullName', 'dateOfBirth', 'parentPhone', 'learnerStatus'] },
      reviewedBy: { select: ['id', 'username', 'fullName', 'email'] },
    },
    ...(transacting ? { transacting } : {}),
  } as any) as any;

  if (!entity?.id) {
    httpError(404, 'Không tìm thấy exam eligibility trong round hiện tại.', 'EXAM_ELIGIBILITY_NOT_FOUND');
  }

  return entity;
}

async function findExistingEligibilitiesByLearnerIds(tenantId: number, roundId: number, learnerIds: number[], transacting?: any) {
  if (learnerIds.length === 0) return [];
  return await strapi.db.query(EXAM_ELIGIBILITY_UID).findMany({
    where: mergeTenantWhere({
      examRound: { id: { $eq: roundId } },
      learner: { id: { $in: learnerIds } },
    }, tenantId),
    populate: {
      learner: { select: ['id', 'code', 'fullName', 'dateOfBirth', 'parentPhone', 'learnerStatus'] },
      reviewedBy: { select: ['id', 'username', 'fullName', 'email'] },
    },
    ...(transacting ? { transacting } : {}),
  } as any) as any[];
}

function resolveEligibilityReviewFields(status: EligibilityStatus, authUser: AuthUser, now: Date) {
  if (status === 'pending') {
    return {
      reviewedBy: null,
      reviewedAt: null,
    };
  }

  return {
    reviewedBy: authUser.id,
    reviewedAt: now,
  };
}

async function countActiveRegistrationsForEligibility(tenantId: number, roundId: number, learnerId: number, transacting?: any) {
  const rows = await strapi.db.query(EXAM_REGISTRATION_UID).findMany({
    where: mergeTenantWhere({
      examRound: { id: { $eq: roundId } },
      learner: { id: { $eq: learnerId } },
      registrationStatus: {
        $notIn: ['cancelled', 'rejected', 'completed'],
      },
    }, tenantId),
    select: ['id'],
    ...(transacting ? { transacting } : {}),
  } as any);
  return Array.isArray(rows) ? rows.length : 0;
}

async function findRegisteredLearnerIdsForRound(tenantId: number, roundId: number, transacting?: any) {
  const rows = await strapi.db.query(EXAM_REGISTRATION_UID).findMany({
    where: mergeTenantWhere({
      examRound: { id: { $eq: roundId } },
      registrationStatus: {
        $notIn: ['cancelled', 'rejected'],
      },
    }, tenantId),
    select: ['id'],
    populate: {
      learner: { select: ['id'] },
    },
    ...(transacting ? { transacting } : {}),
  } as any) as any[];

  const learnerIds = new Set<number>();
  for (const row of rows) {
    const learnerId = Number(extractRelationRef(row?.learner) || row?.learner?.id || 0);
    if (learnerId > 0) learnerIds.add(learnerId);
  }
  return Array.from(learnerIds);
}

async function findEffectiveRegistrationsByLearnerIds(tenantId: number, roundId: number, learnerIds: number[], transacting?: any) {
  if (!learnerIds.length) return new Map<number, any>();

  const rows = await strapi.db.query(EXAM_REGISTRATION_UID).findMany({
    where: mergeTenantWhere({
      examRound: { id: { $eq: roundId } },
      learner: { id: { $in: learnerIds } },
      registrationStatus: {
        $notIn: ['cancelled', 'rejected'],
      },
    }, tenantId),
    select: ['id', 'documentId', 'registrationCode', 'registrationStatus', 'paymentStatus', 'payableAmount', 'registeredAt'],
    populate: {
      learner: { select: ['id'] },
    },
    orderBy: [{ registeredAt: 'desc' }, { id: 'desc' }],
    ...(transacting ? { transacting } : {}),
  } as any) as any[];

  const registrationMap = new Map<number, any>();
  for (const row of rows) {
    const learnerId = Number(extractRelationRef(row?.learner) || row?.learner?.id || 0);
    if (!learnerId || registrationMap.has(learnerId)) continue;
    registrationMap.set(learnerId, row);
  }
  return registrationMap;
}

async function countRegisteredLearnersForRound(tenantId: number, roundId: number, transacting?: any) {
  const learnerIds = await findRegisteredLearnerIdsForRound(tenantId, roundId, transacting);
  return learnerIds.length;
}

function normalizeEligibilityListQuery(query: Record<string, unknown>) {
  const page = toPositiveInt(query.page, 1);
  const pageSize = Math.min(100, toPositiveInt(query.pageSize, 20));
  const search = normalizeText(query.search);
  const learnerId = normalizeText(query.learnerId) ? normalizePositiveInteger(query.learnerId, 'learnerId') : null;
  const eligibilityStatus = normalizeText(query.eligibilityStatus)
    ? normalizeEligibilityStatus(query.eligibilityStatus, 'eligibilityStatus')
    : null;
  const source = normalizeText(query.source)
    ? normalizeEligibilitySource(query.source, 'source', 'manual')
    : null;
  const registrationState = normalizeText(query.registrationState).toLowerCase();
  if (registrationState && !['registered', 'unregistered'].includes(registrationState)) {
    httpError(400, 'registrationState is invalid', 'INVALID_REGISTRATION_STATE');
  }
  const classFilter = normalizeText(query.class);
  const cohortFilter = normalizeText(query.cohort);
  const majorFilter = normalizeText(query.major);
  const sort = normalizeSortInput(query.sort);
  return { page, pageSize, search, learnerId, eligibilityStatus, source, registrationState: registrationState || null, classFilter, cohortFilter, majorFilter, sort };
}

function normalizeLearnerEligibilityLookupQuery(query: Record<string, unknown>): LearnerEligibilityLookupQuery {
  const page = toPositiveInt(query.page, 1);
  const pageSize = Math.min(50, toPositiveInt(query.pageSize, 20));
  const search = normalizeText(query.search);
  const excludeExistingText = normalizeText(query.excludeExisting).toLowerCase();
  return {
    page,
    pageSize,
    search,
    excludeExisting: excludeExistingText ? excludeExistingText !== 'false' && excludeExistingText !== '0' : false,
  };
}

function buildEligibilityListWhere(roundId: number, query: ReturnType<typeof normalizeEligibilityListQuery>) {
  const clauses: any[] = [
    {
      examRound: {
        id: { $eq: roundId },
      },
    },
  ];

  if (query.learnerId) {
    clauses.push({ learner: { id: { $eq: query.learnerId } } });
  }

  if (query.eligibilityStatus) {
    clauses.push({ eligibilityStatus: query.eligibilityStatus });
  }

  if (query.source) {
    clauses.push({ source: query.source });
  }

  if (query.search) {
    clauses.push({
      learner: {
        $or: [
          { code: { $containsi: query.search } },
          { fullName: { $containsi: query.search } },
          { parentPhone: { $containsi: query.search } },
        ],
      },
    });
  }

  if (query.classFilter || query.cohortFilter || query.majorFilter) {
    clauses.push({ id: { $eq: -1 } });
  }

  return clauses.length > 1 ? { $and: clauses } : clauses[0];
}

function mapLearnerLookupRow(learner: any, existingEligibility?: any | null, registrationSummary?: any | null) {
  return {
    id: Number(learner?.id || 0),
    code: normalizeText(learner?.code),
    fullName: normalizeText(learner?.fullName),
    dateOfBirth: normalizeText(learner?.dateOfBirth) || null,
    parentPhone: normalizeText(learner?.parentPhone) || null,
    learnerStatus: normalizeText(learner?.learnerStatus) || 'active',
    existingEligibility: existingEligibility?.id
      ? {
          id: Number(existingEligibility.id),
          eligibilityStatus: normalizeEligibilityStatus(existingEligibility.eligibilityStatus, 'eligibilityStatus', 'pending'),
          reason: normalizeOptionalText(existingEligibility.reason),
        }
      : null,
    registrationSummary: registrationSummary ? mapExistingRegistrationSummary(registrationSummary) : null,
  };
}

function resolveEligibilityOrderBy(sort: Array<Record<string, 'asc' | 'desc'>>) {
  if (sort.length === 0) {
    return [{ updatedAt: 'desc' }, { id: 'desc' }];
  }

  const allowed = new Set(['id', 'eligibilityStatus', 'source', 'reviewedAt', 'createdAt', 'updatedAt']);
  return sort
    .map((entry) => {
      const key = Object.keys(entry)[0];
      if (!allowed.has(key)) return null;
      return { [key]: entry[key] } as Record<string, 'asc' | 'desc'>;
    })
    .filter(Boolean) as Array<Record<string, 'asc' | 'desc'>>;
}

function normalizeStructureUpdateInput(payload: Record<string, unknown>): UpdateStructureInput {
  ensureNoUnknownFields(payload, ['paymentCalculationMethod', 'fixedFee', 'allowSubjectSelection', 'allowComponentSelection', 'subjects'], 'payload');
  const rawSubjects = payload.subjects;
  if (!Array.isArray(rawSubjects)) {
    httpError(400, 'subjects must be an array', 'INVALID_REQUEST_BODY');
  }

  const seenSubjectIds = new Set<number>();
  const seenComponentIds = new Set<number>();

  const subjects = rawSubjects.map((item, subjectIndex) => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) {
      httpError(400, `subjects[${subjectIndex}] is invalid`, 'INVALID_REQUEST_BODY');
    }

    const subjectPayload = item as Record<string, unknown>;
    ensureNoUnknownFields(subjectPayload, [
      'id',
      'examRoundSubjectId',
      'status',
      'isRequired',
      'allowSeparateRegistration',
      'fee',
      'displayOrder',
      'calculationMethodSnapshot',
      'requiredAggregateScoreSnapshot',
      'requireAllComponentsSnapshot',
      'ruleDescriptionSnapshot',
      'components',
    ], 'subject');

    const rawSubjectId = typeof subjectPayload.examRoundSubjectId !== 'undefined' ? subjectPayload.examRoundSubjectId : subjectPayload.id;
    const examRoundSubjectId = normalizePositiveInteger(rawSubjectId, 'examRoundSubjectId');
    if (seenSubjectIds.has(examRoundSubjectId)) {
      httpError(400, 'Duplicate subject id in payload', 'DUPLICATE_SUBJECT_IN_PAYLOAD', { examRoundSubjectId });
    }
    seenSubjectIds.add(examRoundSubjectId);

    const rawComponents = typeof subjectPayload.components === 'undefined' ? [] : subjectPayload.components;
    if (!Array.isArray(rawComponents)) {
      httpError(400, `subjects[${subjectIndex}].components must be an array`, 'INVALID_REQUEST_BODY');
    }

    const components = rawComponents.map((componentItem, componentIndex) => {
      if (!componentItem || typeof componentItem !== 'object' || Array.isArray(componentItem)) {
        httpError(400, `subjects[${subjectIndex}].components[${componentIndex}] is invalid`, 'INVALID_REQUEST_BODY');
      }

      const componentPayload = componentItem as Record<string, unknown>;
      ensureNoUnknownFields(componentPayload, [
        'id',
        'examRoundComponentId',
        'status',
        'isRequired',
        'allowSeparateRegistration',
        'minimumScoreSnapshot',
        'maximumScoreSnapshot',
        'passingScoreSnapshot',
        'eliminationScoreSnapshot',
        'durationMinutes',
        'fee',
        'examMethod',
        'externalExamCode',
        'displayOrder',
      ], 'component');

      const rawComponentId = typeof componentPayload.examRoundComponentId !== 'undefined' ? componentPayload.examRoundComponentId : componentPayload.id;
      const examRoundComponentId = normalizePositiveInteger(rawComponentId, 'examRoundComponentId');
      if (seenComponentIds.has(examRoundComponentId)) {
        httpError(400, 'Duplicate component id in payload', 'DUPLICATE_COMPONENT_IN_PAYLOAD', { examRoundComponentId });
      }
      seenComponentIds.add(examRoundComponentId);

      return {
        examRoundComponentId,
        ...(typeof componentPayload.status !== 'undefined' ? { status: normalizeEnum(componentPayload.status, ['active', 'inactive'], 'active', 'component.status') } : {}),
        ...(typeof componentPayload.isRequired !== 'undefined' ? { isRequired: parseStrictOptionalBoolean(componentPayload.isRequired, 'component.isRequired') } : {}),
        ...(typeof componentPayload.allowSeparateRegistration !== 'undefined' ? { allowSeparateRegistration: parseStrictOptionalBoolean(componentPayload.allowSeparateRegistration, 'component.allowSeparateRegistration') } : {}),
        ...(typeof componentPayload.minimumScoreSnapshot !== 'undefined' ? { minimumScoreSnapshot: parseDecimalInput(componentPayload.minimumScoreSnapshot, 'minimumScoreSnapshot', { required: true }) } : {}),
        ...(typeof componentPayload.maximumScoreSnapshot !== 'undefined' ? { maximumScoreSnapshot: parseDecimalInput(componentPayload.maximumScoreSnapshot, 'maximumScoreSnapshot', { required: true }) } : {}),
        ...(typeof componentPayload.passingScoreSnapshot !== 'undefined' ? { passingScoreSnapshot: parseDecimalInput(componentPayload.passingScoreSnapshot, 'passingScoreSnapshot') } : {}),
        ...(typeof componentPayload.eliminationScoreSnapshot !== 'undefined' ? { eliminationScoreSnapshot: parseDecimalInput(componentPayload.eliminationScoreSnapshot, 'eliminationScoreSnapshot') } : {}),
        ...(typeof componentPayload.durationMinutes !== 'undefined' ? { durationMinutes: parsePositiveDuration(componentPayload.durationMinutes, 'durationMinutes') } : {}),
        ...(typeof componentPayload.fee !== 'undefined' ? { fee: parseDecimalInput(componentPayload.fee, 'component.fee', { min: 0 }) } : {}),
        ...(typeof componentPayload.examMethod !== 'undefined' ? { examMethod: normalizeEnum(componentPayload.examMethod, ['computer', 'paper', 'oral', 'practical', 'mixed', 'other'], 'other', 'component.examMethod') } : {}),
        ...(typeof componentPayload.externalExamCode !== 'undefined' ? { externalExamCode: normalizeOptionalText(componentPayload.externalExamCode, 100) } : {}),
        ...(typeof componentPayload.displayOrder !== 'undefined' ? { displayOrder: parseNonNegativeInteger(componentPayload.displayOrder, 'component.displayOrder') } : {}),
      };
    });

    return {
      examRoundSubjectId,
      ...(typeof subjectPayload.status !== 'undefined' ? { status: normalizeEnum(subjectPayload.status, ['active', 'inactive'], 'active', 'subject.status') } : {}),
      ...(typeof subjectPayload.isRequired !== 'undefined' ? { isRequired: parseStrictOptionalBoolean(subjectPayload.isRequired, 'subject.isRequired') } : {}),
      ...(typeof subjectPayload.allowSeparateRegistration !== 'undefined' ? { allowSeparateRegistration: parseStrictOptionalBoolean(subjectPayload.allowSeparateRegistration, 'subject.allowSeparateRegistration') } : {}),
      ...(typeof subjectPayload.fee !== 'undefined' ? { fee: parseDecimalInput(subjectPayload.fee, 'subject.fee', { min: 0 }) } : {}),
      ...(typeof subjectPayload.displayOrder !== 'undefined' ? { displayOrder: parseNonNegativeInteger(subjectPayload.displayOrder, 'subject.displayOrder') } : {}),
      ...(typeof subjectPayload.calculationMethodSnapshot !== 'undefined' ? { calculationMethodSnapshot: normalizeEnum(subjectPayload.calculationMethodSnapshot, ['total', 'average', 'all_components_pass', 'custom'], 'total', 'calculationMethodSnapshot') } : {}),
      ...(typeof subjectPayload.requiredAggregateScoreSnapshot !== 'undefined' ? { requiredAggregateScoreSnapshot: parseDecimalInput(subjectPayload.requiredAggregateScoreSnapshot, 'requiredAggregateScoreSnapshot') } : {}),
      ...(typeof subjectPayload.requireAllComponentsSnapshot !== 'undefined' ? { requireAllComponentsSnapshot: parseStrictOptionalBoolean(subjectPayload.requireAllComponentsSnapshot, 'requireAllComponentsSnapshot') } : {}),
      ...(typeof subjectPayload.ruleDescriptionSnapshot !== 'undefined' ? { ruleDescriptionSnapshot: normalizeOptionalText(subjectPayload.ruleDescriptionSnapshot) } : {}),
      components,
    };
  });

  return {
    ...(typeof payload.paymentCalculationMethod !== 'undefined'
      ? { paymentCalculationMethod: normalizeEnum(payload.paymentCalculationMethod, ['fixed', 'program_fee', 'subject_fee', 'component_fee'], 'fixed', 'paymentCalculationMethod') }
      : {}),
    ...(typeof payload.fixedFee !== 'undefined' ? { fixedFee: parseDecimalInput(payload.fixedFee, 'fixedFee', { min: 0 }) } : {}),
    ...(typeof payload.allowSubjectSelection !== 'undefined' ? { allowSubjectSelection: parseStrictOptionalBoolean(payload.allowSubjectSelection, 'allowSubjectSelection') } : {}),
    ...(typeof payload.allowComponentSelection !== 'undefined' ? { allowComponentSelection: parseStrictOptionalBoolean(payload.allowComponentSelection, 'allowComponentSelection') } : {}),
    subjects,
  };
}

async function loadExamRoundStructure(tenantId: number, roundId: number, transacting: any, options: { requireDraft?: boolean } = {}) {
  const round = await findExamRoundByRef(tenantId, roundId, transacting);
  if (options.requireDraft !== false && normalizeText(round.status).toLowerCase() !== 'draft') {
    httpError(409, 'Chỉ có thể sửa cấu trúc khi đợt thi còn ở trạng thái draft.', 'EXAM_ROUND_NOT_EDITABLE');
  }

  const subjects = await strapi.db.query(EXAM_ROUND_SUBJECT_UID).findMany({
    where: mergeTenantWhere({ examRound: { id: { $eq: round.id } } }, tenantId),
    select: ['id', 'nameSnapshot', 'calculationMethodSnapshot', 'requiredAggregateScoreSnapshot', 'requireAllComponentsSnapshot', 'ruleDescriptionSnapshot', 'fee', 'isRequired', 'allowSeparateRegistration', 'displayOrder', 'status'],
    populate: {
      examSubject: { select: ['id', 'code'] },
    },
    orderBy: [{ displayOrder: 'asc' }, { id: 'asc' }],
    transacting,
  } as any) as any[];

  const components = await strapi.db.query(EXAM_ROUND_COMPONENT_UID).findMany({
    where: mergeTenantWhere({ examRound: { id: { $eq: round.id } } }, tenantId),
    select: ['id', 'nameSnapshot', 'minimumScoreSnapshot', 'maximumScoreSnapshot', 'passingScoreSnapshot', 'eliminationScoreSnapshot', 'durationMinutes', 'fee', 'isRequired', 'allowSeparateRegistration', 'displayOrder', 'status', 'examMethod', 'externalExamCode'],
    populate: {
      examRoundSubject: { select: ['id'] },
      examComponent: { select: ['id', 'code'] },
    },
    orderBy: [{ displayOrder: 'asc' }, { id: 'asc' }],
    transacting,
  } as any) as any[];

  const componentsBySubjectId = new Map<number, MutableRoundComponent[]>();
  for (const component of components) {
    const subjectId = Number(extractRelationRef(component?.examRoundSubject) || component?.examRoundSubject?.id || 0);
    const normalized: MutableRoundComponent = {
      id: Number(component.id),
      examRoundSubjectId: subjectId,
      codeSnapshot: normalizeOptionalText(component?.examComponent?.code, 100),
      status: normalizeEnum(component.status, ['active', 'inactive', 'cancelled'], 'active', 'status'),
      isRequired: component.isRequired !== false,
      allowSeparateRegistration: component.allowSeparateRegistration === true,
      minimumScoreSnapshot: decimalToString(component.minimumScoreSnapshot),
      maximumScoreSnapshot: decimalToString(component.maximumScoreSnapshot),
      passingScoreSnapshot: decimalToString(component.passingScoreSnapshot),
      eliminationScoreSnapshot: decimalToString(component.eliminationScoreSnapshot),
      durationMinutes: Number(component.durationMinutes || 0) || null,
      fee: decimalToString(component.fee),
      examMethod: normalizeEnum(component.examMethod, ['computer', 'paper', 'oral', 'practical', 'mixed', 'other'], 'other', 'examMethod'),
      externalExamCode: normalizeOptionalText(component.externalExamCode, 100),
      displayOrder: Number(component.displayOrder || 0) || 0,
      nameSnapshot: normalizeRequiredText(component.nameSnapshot, 'nameSnapshot', 200),
    };
    if (!componentsBySubjectId.has(subjectId)) componentsBySubjectId.set(subjectId, []);
    componentsBySubjectId.get(subjectId)?.push(normalized);
  }

  const subjectGraph: MutableRoundSubject[] = subjects.map((subject) => ({
    id: Number(subject.id),
    codeSnapshot: normalizeOptionalText(subject?.examSubject?.code, 100),
    status: normalizeEnum(subject.status, ['active', 'inactive', 'cancelled'], 'active', 'status'),
    isRequired: subject.isRequired !== false,
    allowSeparateRegistration: subject.allowSeparateRegistration === true,
    fee: decimalToString(subject.fee),
    displayOrder: Number(subject.displayOrder || 0) || 0,
    calculationMethodSnapshot: normalizeEnum(subject.calculationMethodSnapshot, ['total', 'average', 'all_components_pass', 'custom'], 'total', 'calculationMethodSnapshot'),
    requiredAggregateScoreSnapshot: decimalToString(subject.requiredAggregateScoreSnapshot),
    requireAllComponentsSnapshot: subject.requireAllComponentsSnapshot !== false,
    ruleDescriptionSnapshot: normalizeOptionalText(subject.ruleDescriptionSnapshot),
    nameSnapshot: normalizeRequiredText(subject.nameSnapshot, 'nameSnapshot', 200),
    components: componentsBySubjectId.get(Number(subject.id)) || [],
  }));

  const subjectIds = new Set(subjectGraph.map((subject) => subject.id));
  const orphanComponentIds = Array.from(componentsBySubjectId.entries())
    .filter(([subjectId]) => !subjectIds.has(subjectId))
    .flatMap(([, items]) => items.map((item) => item.id));

  return {
    round: {
      id: Number(round.id),
      documentId: round.documentId || null,
      code: round.code,
      status: round.status,
      paymentCalculationMethod: normalizeEnum(round.paymentCalculationMethod, ['fixed', 'program_fee', 'subject_fee', 'component_fee'], 'fixed', 'paymentCalculationMethod'),
      fixedFee: decimalToString(round.fixedFee),
      allowSubjectSelection: round.allowSubjectSelection === true,
      allowComponentSelection: round.allowComponentSelection === true,
    },
    subjects: subjectGraph,
    orphanComponentIds,
  };
}

function mergeStructureUpdate(current: MutableExamRoundStructure, input: UpdateStructureInput) {
  const subjectMap = new Map<number, MutableRoundSubject>();
  const componentMap = new Map<number, MutableRoundComponent>();
  if (typeof input.paymentCalculationMethod !== 'undefined') current.round.paymentCalculationMethod = input.paymentCalculationMethod;
  if (typeof input.fixedFee !== 'undefined') current.round.fixedFee = input.fixedFee;
  if (typeof input.allowSubjectSelection !== 'undefined') current.round.allowSubjectSelection = input.allowSubjectSelection;
  if (typeof input.allowComponentSelection !== 'undefined') current.round.allowComponentSelection = input.allowComponentSelection;

  for (const subject of current.subjects) {
    subjectMap.set(subject.id, subject);
    for (const component of subject.components) {
      componentMap.set(component.id, component);
    }
  }

  for (const subjectPatch of input.subjects) {
    const subject = subjectMap.get(subjectPatch.examRoundSubjectId);
    if (!subject) {
      httpError(404, 'Không tìm thấy subject snapshot trong đợt thi hiện tại.', 'EXAM_ROUND_SUBJECT_NOT_FOUND', { examRoundSubjectId: subjectPatch.examRoundSubjectId });
    }

    if (typeof subjectPatch.status !== 'undefined') subject.status = subjectPatch.status;
    if (typeof subjectPatch.isRequired !== 'undefined') subject.isRequired = subjectPatch.isRequired;
    if (typeof subjectPatch.allowSeparateRegistration !== 'undefined') subject.allowSeparateRegistration = subjectPatch.allowSeparateRegistration;
    if (typeof subjectPatch.fee !== 'undefined') subject.fee = subjectPatch.fee;
    if (typeof subjectPatch.displayOrder !== 'undefined') subject.displayOrder = subjectPatch.displayOrder;
    if (typeof subjectPatch.calculationMethodSnapshot !== 'undefined') subject.calculationMethodSnapshot = subjectPatch.calculationMethodSnapshot;
    if (typeof subjectPatch.requiredAggregateScoreSnapshot !== 'undefined') subject.requiredAggregateScoreSnapshot = subjectPatch.requiredAggregateScoreSnapshot;
    if (typeof subjectPatch.requireAllComponentsSnapshot !== 'undefined') subject.requireAllComponentsSnapshot = subjectPatch.requireAllComponentsSnapshot;
    if (typeof subjectPatch.ruleDescriptionSnapshot !== 'undefined') subject.ruleDescriptionSnapshot = subjectPatch.ruleDescriptionSnapshot;

    for (const componentPatch of subjectPatch.components || []) {
      const component = componentMap.get(componentPatch.examRoundComponentId);
      if (!component) {
        httpError(404, 'Không tìm thấy component snapshot trong đợt thi hiện tại.', 'EXAM_ROUND_COMPONENT_NOT_FOUND', { examRoundComponentId: componentPatch.examRoundComponentId });
      }

      if (component.examRoundSubjectId !== subject.id) {
        httpError(409, 'Component không thuộc subject đang được cập nhật.', 'EXAM_COMPONENT_SUBJECT_MISMATCH', {
          examRoundSubjectId: subject.id,
          examRoundComponentId: component.id,
        });
      }

      if (typeof componentPatch.status !== 'undefined') component.status = componentPatch.status;
      if (typeof componentPatch.isRequired !== 'undefined') component.isRequired = componentPatch.isRequired;
      if (typeof componentPatch.allowSeparateRegistration !== 'undefined') component.allowSeparateRegistration = componentPatch.allowSeparateRegistration;
      if (typeof componentPatch.minimumScoreSnapshot !== 'undefined') component.minimumScoreSnapshot = componentPatch.minimumScoreSnapshot;
      if (typeof componentPatch.maximumScoreSnapshot !== 'undefined') component.maximumScoreSnapshot = componentPatch.maximumScoreSnapshot;
      if (typeof componentPatch.passingScoreSnapshot !== 'undefined') component.passingScoreSnapshot = componentPatch.passingScoreSnapshot;
      if (typeof componentPatch.eliminationScoreSnapshot !== 'undefined') component.eliminationScoreSnapshot = componentPatch.eliminationScoreSnapshot;
      if (typeof componentPatch.durationMinutes !== 'undefined') component.durationMinutes = componentPatch.durationMinutes;
      if (typeof componentPatch.fee !== 'undefined') component.fee = componentPatch.fee;
      if (typeof componentPatch.examMethod !== 'undefined') component.examMethod = componentPatch.examMethod;
      if (typeof componentPatch.externalExamCode !== 'undefined') component.externalExamCode = componentPatch.externalExamCode;
      if (typeof componentPatch.displayOrder !== 'undefined') component.displayOrder = componentPatch.displayOrder;
    }
  }

  return current;
}

function collectStructureValidationErrors(structure: MutableExamRoundStructure): WorkflowValidationError[] {
  const errors: WorkflowValidationError[] = [];
  const { round, subjects } = structure;
  const activeSubjects = subjects.filter((item) => item.status === 'active');
  if (activeSubjects.length === 0) {
    pushWorkflowValidationError(errors, 409, 'subjects', 'EXAM_ROUND_HAS_NO_ACTIVE_SUBJECT', 'Đợt thi phải còn ít nhất một môn active.');
  }

  for (const orphanComponentId of structure.orphanComponentIds) {
    pushWorkflowValidationError(errors, 409, `components[${orphanComponentId}].examRoundSubject`, 'EXAM_COMPONENT_SUBJECT_MISMATCH', 'Component snapshot không thuộc subject snapshot hợp lệ trong đợt thi.', { examRoundComponentId: orphanComponentId });
  }

  if (round.paymentCalculationMethod === 'fixed') {
    const fixedFee = decimalToNumber(round.fixedFee);
    if (fixedFee === null || fixedFee < 0) {
      pushWorkflowValidationError(errors, 409, 'round.fixedFee', 'INVALID_EXAM_ROUND_FEE_STRUCTURE', 'fixedFee is required when paymentCalculationMethod=fixed.');
    }
  }

  if (round.paymentCalculationMethod !== 'fixed' && round.fixedFee !== null) {
    round.fixedFee = null;
  }

  const externalCodes = new Map<string, number>();

  for (const subject of subjects) {
    if (subject.isRequired && subject.status !== 'active') {
      pushWorkflowValidationError(errors, 400, `subjects[${subject.id}].isRequired`, 'INVALID_SUBJECT_RULE_CONFIGURATION', 'Subject inactive không thể là bắt buộc.', { examRoundSubjectId: subject.id });
    }
    if (!['active', 'inactive', 'cancelled'].includes(subject.status)) {
      pushWorkflowValidationError(errors, 400, `subjects[${subject.id}].status`, 'INVALID_SUBJECT_RULE_CONFIGURATION', 'Subject status is invalid.', { examRoundSubjectId: subject.id });
    }
    if (subject.status === 'cancelled') {
      pushWorkflowValidationError(errors, 400, `subjects[${subject.id}].status`, 'INVALID_SUBJECT_RULE_CONFIGURATION', 'Không cho phép đặt subject ở trạng thái cancelled khi đợt còn draft.', { examRoundSubjectId: subject.id });
    }
    if (!round.allowSubjectSelection && subject.allowSeparateRegistration) {
      pushWorkflowValidationError(errors, 400, `subjects[${subject.id}].allowSeparateRegistration`, 'SUBJECT_SELECTION_NOT_ALLOWED', 'Không cho phép allowSeparateRegistration ở subject khi round không cho chọn môn.', { examRoundSubjectId: subject.id });
    }
    if (!round.allowSubjectSelection && subject.status === 'active' && !subject.isRequired) {
      pushWorkflowValidationError(errors, 400, `subjects[${subject.id}].isRequired`, 'SUBJECT_SELECTION_NOT_ALLOWED', 'Mọi subject active phải là bắt buộc khi round không cho chọn môn.', { examRoundSubjectId: subject.id });
    }

    const requiredAggregateScore = decimalToNumber(subject.requiredAggregateScoreSnapshot);
    if ((subject.calculationMethodSnapshot === 'total' || subject.calculationMethodSnapshot === 'average') && requiredAggregateScore === null) {
      pushWorkflowValidationError(errors, 400, `subjects[${subject.id}].requiredAggregateScoreSnapshot`, 'INVALID_SUBJECT_RULE_CONFIGURATION', 'requiredAggregateScoreSnapshot là bắt buộc cho total/average.', { examRoundSubjectId: subject.id });
    }
    if (requiredAggregateScore !== null && requiredAggregateScore < 0) {
      pushWorkflowValidationError(errors, 400, `subjects[${subject.id}].requiredAggregateScoreSnapshot`, 'INVALID_SUBJECT_RULE_CONFIGURATION', 'requiredAggregateScoreSnapshot phải >= 0.', { examRoundSubjectId: subject.id });
    }
    if (subject.calculationMethodSnapshot === 'custom' && !normalizeText(subject.ruleDescriptionSnapshot)) {
      pushWorkflowValidationError(errors, 400, `subjects[${subject.id}].ruleDescriptionSnapshot`, 'INVALID_SUBJECT_RULE_CONFIGURATION', 'custom calculation requires ruleDescriptionSnapshot.', { examRoundSubjectId: subject.id });
    }

    if (round.paymentCalculationMethod === 'subject_fee' && subject.status === 'active') {
      const fee = decimalToNumber(subject.fee);
      if (fee === null || fee < 0) {
        pushWorkflowValidationError(errors, 409, `subjects[${subject.id}].fee`, 'INVALID_EXAM_ROUND_FEE_STRUCTURE', 'Subject fee configuration is invalid for subject_fee.', { examRoundSubjectId: subject.id });
      }
    }

    for (const component of subject.components) {
      if (component.status === 'active' && subject.status !== 'active') {
        pushWorkflowValidationError(errors, 409, `subjects[${subject.id}].components[${component.id}].status`, 'EXAM_SUBJECT_HAS_NO_ACTIVE_COMPONENT', 'Component active không thể thuộc subject inactive.', { examRoundSubjectId: subject.id, examRoundComponentId: component.id });
      }
      if (component.isRequired && component.status !== 'active') {
        pushWorkflowValidationError(errors, 400, `subjects[${subject.id}].components[${component.id}].isRequired`, 'INVALID_SUBJECT_RULE_CONFIGURATION', 'Component inactive không thể là bắt buộc.', { examRoundComponentId: component.id });
      }
      if (component.status === 'cancelled') {
        pushWorkflowValidationError(errors, 400, `subjects[${subject.id}].components[${component.id}].status`, 'INVALID_SUBJECT_RULE_CONFIGURATION', 'Không cho phép đặt component ở trạng thái cancelled khi đợt còn draft.', { examRoundComponentId: component.id });
      }
      if (!round.allowComponentSelection && component.allowSeparateRegistration) {
        pushWorkflowValidationError(errors, 400, `subjects[${subject.id}].components[${component.id}].allowSeparateRegistration`, 'COMPONENT_SELECTION_NOT_ALLOWED', 'Không cho phép component allowSeparateRegistration khi round không cho chọn component.', { examRoundComponentId: component.id });
      }
      if (!round.allowComponentSelection && component.status === 'active' && !component.isRequired) {
        pushWorkflowValidationError(errors, 400, `subjects[${subject.id}].components[${component.id}].isRequired`, 'COMPONENT_SELECTION_NOT_ALLOWED', 'Mọi component active phải là bắt buộc khi round không cho chọn component.', { examRoundComponentId: component.id });
      }
      if (subject.requireAllComponentsSnapshot && component.status === 'active' && !component.isRequired) {
        pushWorkflowValidationError(errors, 400, `subjects[${subject.id}].components[${component.id}].isRequired`, 'INVALID_SUBJECT_RULE_CONFIGURATION', 'requireAllComponentsSnapshot=true yêu cầu mọi component active phải isRequired=true.', { examRoundComponentId: component.id });
      }

      const minimumScore = decimalToNumber(component.minimumScoreSnapshot);
      const maximumScore = decimalToNumber(component.maximumScoreSnapshot);
      const passingScore = decimalToNumber(component.passingScoreSnapshot);
      const eliminationScore = decimalToNumber(component.eliminationScoreSnapshot);
      if (minimumScore === null || maximumScore === null || maximumScore <= minimumScore) {
        pushWorkflowValidationError(errors, 400, `subjects[${subject.id}].components[${component.id}].scoreRange`, 'INVALID_COMPONENT_SCORE_RANGE', 'Component score range is invalid.', { examRoundComponentId: component.id });
      }
      if (passingScore !== null && (passingScore < minimumScore || passingScore > maximumScore)) {
        pushWorkflowValidationError(errors, 400, `subjects[${subject.id}].components[${component.id}].passingScoreSnapshot`, 'INVALID_COMPONENT_SCORE_RANGE', 'passingScoreSnapshot is outside score range.', { examRoundComponentId: component.id });
      }
      if (eliminationScore !== null && (eliminationScore < minimumScore || eliminationScore > maximumScore)) {
        pushWorkflowValidationError(errors, 400, `subjects[${subject.id}].components[${component.id}].eliminationScoreSnapshot`, 'INVALID_COMPONENT_SCORE_RANGE', 'eliminationScoreSnapshot is outside score range.', { examRoundComponentId: component.id });
      }
      if (component.durationMinutes !== null && (!Number.isInteger(component.durationMinutes) || component.durationMinutes <= 0 || component.durationMinutes > 1440)) {
        pushWorkflowValidationError(errors, 400, `subjects[${subject.id}].components[${component.id}].durationMinutes`, 'INVALID_COMPONENT_DURATION', 'durationMinutes is invalid.', { examRoundComponentId: component.id });
      }
      if (round.paymentCalculationMethod === 'component_fee' && component.status === 'active') {
        const fee = decimalToNumber(component.fee);
        if (fee === null || fee < 0) {
          pushWorkflowValidationError(errors, 409, `subjects[${subject.id}].components[${component.id}].fee`, 'INVALID_EXAM_ROUND_FEE_STRUCTURE', 'Component fee configuration is invalid for component_fee.', { examRoundComponentId: component.id });
        }
      }
      const externalCode = normalizeText(component.externalExamCode).toLowerCase();
      if (externalCode && component.status === 'active') {
        if (externalCodes.has(externalCode)) {
          pushWorkflowValidationError(errors, 409, `subjects[${subject.id}].components[${component.id}].externalExamCode`, 'INVALID_COMPONENT_EXTERNAL_CODE', 'externalExamCode must be unique within the exam round structure.', { examRoundComponentId: component.id, externalExamCode: component.externalExamCode });
        }
        externalCodes.set(externalCode, component.id);
      }
    }

    const activeComponents = subject.components.filter((component) => component.status === 'active');
    if (subject.status === 'active' && activeComponents.length === 0) {
      pushWorkflowValidationError(errors, 409, `subjects[${subject.id}].components`, 'EXAM_SUBJECT_HAS_NO_ACTIVE_COMPONENT', 'Mỗi subject active phải có ít nhất một component active.', { examRoundSubjectId: subject.id });
    }
  }

  return errors;
}

function validateStructureGraph(structure: MutableExamRoundStructure) {
  throwFirstValidationError(collectStructureValidationErrors(structure));
}

function collectExamRoundReadinessErrors(round: any, structure: MutableExamRoundStructure): WorkflowValidationError[] {
  const errors = collectStructureValidationErrors(structure);

  if (!normalizeText(round?.code)) {
    pushWorkflowValidationError(errors, 409, 'round.code', 'EXAM_ROUND_NOT_READY_FOR_APPROVAL', 'code is required.');
  }
  if (!normalizeText(round?.name)) {
    pushWorkflowValidationError(errors, 409, 'round.name', 'EXAM_ROUND_NOT_READY_FOR_APPROVAL', 'name is required.');
  }

  const registrationMode = normalizeText(round?.registrationMode).toLowerCase();
  if (!['open', 'restricted'].includes(registrationMode)) {
    pushWorkflowValidationError(errors, 409, 'round.registrationMode', 'EXAM_ROUND_NOT_READY_FOR_APPROVAL', 'registrationMode is invalid.');
  }

  const paymentMethod = normalizeText(round?.paymentCalculationMethod).toLowerCase();
  if (!['program_fee', 'subject_fee', 'component_fee', 'fixed'].includes(paymentMethod)) {
    pushWorkflowValidationError(errors, 409, 'round.paymentCalculationMethod', 'EXAM_ROUND_NOT_READY_FOR_APPROVAL', 'paymentCalculationMethod is invalid.');
  }

  const examProgramId = Number(extractRelationRef(round?.examProgram) || round?.examProgram?.id || 0);
  const examProgramTenantId = Number(extractRelationRef(round?.examProgram?.tenant) || round?.examProgram?.tenant?.id || 0);
  if (!examProgramId) {
    pushWorkflowValidationError(errors, 409, 'round.examProgram', 'EXAM_ROUND_NOT_READY_FOR_APPROVAL', 'examProgram is required.');
  } else if (examProgramTenantId && examProgramTenantId !== Number(extractRelationRef(round?.tenant) || round?.tenant?.id || 0)) {
    pushWorkflowValidationError(errors, 409, 'round.examProgram', 'CROSS_TENANT_RELATION', 'examProgram belongs to another tenant.');
  }

  const registrationStartAt = normalizeStoredDateTime(round?.registrationStartAt);
  const registrationEndAt = normalizeStoredDateTime(round?.registrationEndAt);
  const paymentStartAt = normalizeStoredDateTime(round?.paymentStartAt);
  const paymentEndAt = normalizeStoredDateTime(round?.paymentEndAt);
  const candidateListClosingAt = normalizeStoredDateTime(round?.candidateListClosingAt);
  const examStartAt = normalizeStoredDateTime(round?.examStartAt);
  const examEndAt = normalizeStoredDateTime(round?.examEndAt);
  const cancellationDeadline = normalizeStoredDateTime(round?.cancellationDeadline);

  if (!registrationStartAt) {
    pushWorkflowValidationError(errors, 409, 'round.registrationStartAt', 'EXAM_ROUND_NOT_READY_FOR_APPROVAL', 'registrationStartAt is required.');
  }
  if (!registrationEndAt) {
    pushWorkflowValidationError(errors, 409, 'round.registrationEndAt', 'EXAM_ROUND_NOT_READY_FOR_APPROVAL', 'registrationEndAt is required.');
  }
  if (registrationStartAt && registrationEndAt && Date.parse(registrationStartAt) >= Date.parse(registrationEndAt)) {
    pushWorkflowValidationError(errors, 409, 'round.registrationEndAt', 'EXAM_ROUND_NOT_READY_FOR_APPROVAL', 'registrationStartAt must be before registrationEndAt.');
  }
  if ((paymentStartAt && !paymentEndAt) || (!paymentStartAt && paymentEndAt)) {
    pushWorkflowValidationError(errors, 409, 'round.paymentStartAt', 'EXAM_ROUND_NOT_READY_FOR_APPROVAL', 'paymentStartAt and paymentEndAt must be provided together.');
  }
  if (paymentStartAt && paymentEndAt && Date.parse(paymentStartAt) > Date.parse(paymentEndAt)) {
    pushWorkflowValidationError(errors, 409, 'round.paymentEndAt', 'EXAM_ROUND_NOT_READY_FOR_APPROVAL', 'paymentStartAt must be before or equal to paymentEndAt.');
  }
  if (registrationEndAt && candidateListClosingAt && Date.parse(registrationEndAt) > Date.parse(candidateListClosingAt)) {
    pushWorkflowValidationError(errors, 409, 'round.candidateListClosingAt', 'EXAM_ROUND_NOT_READY_FOR_APPROVAL', 'candidateListClosingAt cannot be before registrationEndAt.');
  }
  if (candidateListClosingAt && examStartAt && Date.parse(candidateListClosingAt) > Date.parse(examStartAt)) {
    pushWorkflowValidationError(errors, 409, 'round.examStartAt', 'EXAM_ROUND_NOT_READY_FOR_APPROVAL', 'examStartAt cannot be before candidateListClosingAt.');
  }
  if (examStartAt && examEndAt && Date.parse(examStartAt) > Date.parse(examEndAt)) {
    pushWorkflowValidationError(errors, 409, 'round.examEndAt', 'EXAM_ROUND_NOT_READY_FOR_APPROVAL', 'examEndAt cannot be before examStartAt.');
  }
  if (cancellationDeadline && registrationEndAt && Date.parse(cancellationDeadline) > Date.parse(registrationEndAt)) {
    pushWorkflowValidationError(errors, 409, 'round.cancellationDeadline', 'EXAM_ROUND_NOT_READY_FOR_APPROVAL', 'cancellationDeadline cannot be after registrationEndAt.');
  }

  return errors;
}

function summarizeStructure(subjects: MutableRoundSubject[]) {
  let activeComponents = 0;
  let inactiveComponents = 0;
  for (const subject of subjects) {
    for (const component of subject.components) {
      if (component.status === 'active') activeComponents += 1;
      else inactiveComponents += 1;
    }
  }

  return {
    activeSubjects: subjects.filter((item) => item.status === 'active').length,
    inactiveSubjects: subjects.filter((item) => item.status !== 'active').length,
    activeComponents,
    inactiveComponents,
  };
}

async function updateRoundSubjectInTransaction(subject: MutableRoundSubject, trx: any) {
  return strapi.db.query(EXAM_ROUND_SUBJECT_UID).update({
    where: { id: subject.id },
    data: {
      status: subject.status,
      isRequired: subject.isRequired,
      allowSeparateRegistration: subject.allowSeparateRegistration,
      fee: subject.fee,
      displayOrder: subject.displayOrder,
      calculationMethodSnapshot: subject.calculationMethodSnapshot,
      requiredAggregateScoreSnapshot: subject.requiredAggregateScoreSnapshot,
      requireAllComponentsSnapshot: subject.requireAllComponentsSnapshot,
      ruleDescriptionSnapshot: subject.ruleDescriptionSnapshot,
    },
    transacting: trx,
  } as any);
}

async function updateExamRoundInTransaction(round: MutableExamRoundStructure['round'], trx: any) {
  return strapi.db.query(EXAM_ROUND_UID).update({
    where: { id: round.id },
    data: {
      paymentCalculationMethod: round.paymentCalculationMethod,
      fixedFee: round.fixedFee,
      allowSubjectSelection: round.allowSubjectSelection,
      allowComponentSelection: round.allowComponentSelection,
    },
    transacting: trx,
  } as any);
}

async function updateRoundComponentInTransaction(component: MutableRoundComponent, trx: any) {
  return strapi.db.query(EXAM_ROUND_COMPONENT_UID).update({
    where: { id: component.id },
    data: {
      status: component.status,
      isRequired: component.isRequired,
      allowSeparateRegistration: component.allowSeparateRegistration,
      minimumScoreSnapshot: component.minimumScoreSnapshot,
      maximumScoreSnapshot: component.maximumScoreSnapshot,
      passingScoreSnapshot: component.passingScoreSnapshot,
      eliminationScoreSnapshot: component.eliminationScoreSnapshot,
      durationMinutes: component.durationMinutes,
      fee: component.fee,
      examMethod: component.examMethod,
      externalExamCode: component.externalExamCode,
      displayOrder: component.displayOrder,
    },
    transacting: trx,
  } as any);
}

function logExamRoundWorkflowEvent(
  event:
  | 'exam_round.submitted_for_approval'
  | 'exam_round.approved'
  | 'exam_round.returned_to_draft'
  | 'exam_round.registration_opened'
  | 'exam_round.registration_paused'
  | 'exam_round.registration_resumed'
  | 'exam_round.registration_closed',
  payload: Record<string, unknown>,
) {
  strapi.log.info(`[exam-round-workflow] ${event} ${JSON.stringify(payload)}`);
}

async function updateExamRoundWorkflowInTransaction(roundId: number, data: Record<string, unknown>, trx: any, failureCode = 'EXAM_ROUND_WORKFLOW_FAILED') {
  const updated = await strapi.db.query(EXAM_ROUND_UID).update({
    where: { id: roundId },
    data,
    transacting: trx,
  } as any) as any;

  if (!updated?.id) {
    httpError(409, 'Workflow update failed for exam round.', failureCode, { examRoundId: roundId });
  }

  return updated;
}

function buildApprovalReadinessDetails(errors: WorkflowValidationError[]) {
  return {
    errors: errors.map((error) => ({
      path: error.path,
      code: error.code,
      message: error.message,
      ...(error.details ? { details: error.details } : {}),
    })),
  };
}

async function assertExamRoundReadyForApproval(tenantId: number, roundId: number, trx: any) {
  const round = await loadExamRoundWorkflowContext(tenantId, roundId, trx);
  const structure = await loadExamRoundStructure(tenantId, Number(round.id), trx, { requireDraft: false });
  const errors = collectExamRoundReadinessErrors(round, structure);
  if (errors.length > 0) {
    httpError(409, 'Đợt thi chưa sẵn sàng để trình/phê duyệt.', 'EXAM_ROUND_NOT_READY_FOR_APPROVAL', buildApprovalReadinessDetails(errors));
  }
  return { round, structure };
}

function buildRegistrationReadinessDetails(errors: WorkflowValidationError[]) {
  return buildApprovalReadinessDetails(errors);
}

async function assertExamRoundReadyForRegistration(tenantId: number, roundId: number, trx: any) {
  const round = await loadExamRoundWorkflowContext(tenantId, roundId, trx);
  const structure = await loadExamRoundStructure(tenantId, Number(round.id), trx, { requireDraft: false });
  const errors = collectExamRoundReadinessErrors(round, structure);
  if (errors.length > 0) {
    httpError(409, 'Đợt thi chưa sẵn sàng để vận hành đăng ký.', 'EXAM_ROUND_NOT_READY_FOR_REGISTRATION', buildRegistrationReadinessDetails(errors));
  }
  return { round, structure };
}

function assertRegistrationDatesPresent(round: any) {
  const registrationStartAt = normalizeStoredDateTime(round?.registrationStartAt);
  const registrationEndAt = normalizeStoredDateTime(round?.registrationEndAt);
  if (!registrationStartAt || !registrationEndAt) {
    httpError(409, 'registrationStartAt và registrationEndAt là bắt buộc để mở/tiếp tục đăng ký.', 'REGISTRATION_DATES_REQUIRED');
  }
  return { registrationStartAt, registrationEndAt };
}

function assertRegistrationDateRange(round: any) {
  const { registrationStartAt, registrationEndAt } = assertRegistrationDatesPresent(round);
  if (Date.parse(registrationStartAt) >= Date.parse(registrationEndAt)) {
    httpError(409, 'registrationStartAt phải nhỏ hơn registrationEndAt.', 'INVALID_REGISTRATION_DATE_RANGE');
  }
  return { registrationStartAt, registrationEndAt };
}

function assertRegistrationWindowNotExpired(round: any, now = new Date()) {
  assertRegistrationDateRange(round);
  const windowState = resolveRegistrationWindowState(round, now);
  if (windowState === 'after_registration_window') {
    httpError(409, 'Cửa sổ đăng ký đã kết thúc.', 'REGISTRATION_WINDOW_EXPIRED');
  }
  return windowState;
}

async function countEligibleLearnersForRound(tenantId: number, roundId: number, trx: any) {
  const rows = await strapi.db.query(EXAM_ELIGIBILITY_UID).findMany({
    where: mergeTenantWhere({ examRound: { id: { $eq: roundId } }, eligibilityStatus: 'eligible' }, tenantId),
    select: ['id'],
    transacting: trx,
  } as any);
  return Array.isArray(rows) ? rows.length : 0;
}

export async function submitExamRoundForApproval(tenantId: number, roundRef: unknown, payload: Record<string, unknown>, authUser: AuthUser) {
  const input = normalizeWorkflowNoteInput(payload || {});

  return strapi.db.connection.transaction(async (trx: any) => {
    const initialRound = await findExamRoundByRef(tenantId, roundRef, trx);
    await acquireExamRoundStructureLock(trx, tenantId, Number(initialRound.id));

    const round = await loadExamRoundWorkflowContext(tenantId, Number(initialRound.id), trx);
    if (normalizeText(round.status).toLowerCase() !== 'draft') {
      httpError(409, 'Chỉ có thể trình duyệt đợt thi đang ở trạng thái draft.', 'EXAM_ROUND_CANNOT_BE_SUBMITTED');
    }

    await assertExamRoundReadyForApproval(tenantId, Number(initialRound.id), trx);

    const now = new Date();
    await updateExamRoundWorkflowInTransaction(Number(round.id), {
      status: 'pending_approval',
      submittedBy: authUser.id,
      submittedAt: now,
      approvalNote: typeof input.note === 'string' ? input.note : null,
      returnedBy: null,
      returnedAt: null,
      returnReason: null,
    }, trx);

    logExamRoundWorkflowEvent('exam_round.submitted_for_approval', {
      tenantId,
      examRoundId: Number(round.id),
      documentId: round.documentId || null,
      userId: authUser.id,
      fromStatus: 'draft',
      toStatus: 'pending_approval',
      note: input.note,
      timestamp: now.toISOString(),
    });

    return {
      id: Number(round.id),
      documentId: round.documentId || null,
      code: round.code,
      status: 'pending_approval',
      submittedAt: now.toISOString(),
      submittedBy: summarizeWorkflowActor(authUser),
    };
  });
}

export async function approveExamRound(tenantId: number, roundRef: unknown, payload: Record<string, unknown>, authUser: AuthUser) {
  const input = normalizeWorkflowNoteInput(payload || {});

  return strapi.db.connection.transaction(async (trx: any) => {
    const initialRound = await findExamRoundByRef(tenantId, roundRef, trx);
    await acquireExamRoundStructureLock(trx, tenantId, Number(initialRound.id));

    const round = await loadExamRoundWorkflowContext(tenantId, Number(initialRound.id), trx);
    if (normalizeText(round.status).toLowerCase() !== 'pending_approval') {
      httpError(409, 'Chỉ có thể phê duyệt đợt thi đang chờ duyệt.', 'EXAM_ROUND_CANNOT_BE_APPROVED');
    }

    const submittedById = Number(extractRelationRef(round?.submittedBy) || round?.submittedBy?.id || 0);
    if (submittedById > 0 && submittedById === Number(authUser.id)) {
      httpError(409, 'Người đã trình duyệt không được tự phê duyệt cùng đợt thi.', 'EXAM_ROUND_SELF_APPROVAL_NOT_ALLOWED');
    }

    await assertExamRoundReadyForApproval(tenantId, Number(initialRound.id), trx);

    const now = new Date();
    await updateExamRoundWorkflowInTransaction(Number(round.id), {
      status: 'approved',
      approvedBy: authUser.id,
      approvedAt: now,
      approvalNote: typeof input.note === 'string' ? input.note : round.approvalNote || null,
    }, trx);

    logExamRoundWorkflowEvent('exam_round.approved', {
      tenantId,
      examRoundId: Number(round.id),
      documentId: round.documentId || null,
      userId: authUser.id,
      fromStatus: 'pending_approval',
      toStatus: 'approved',
      note: input.note,
      timestamp: now.toISOString(),
    });

    return {
      id: Number(round.id),
      documentId: round.documentId || null,
      code: round.code,
      status: 'approved',
      approvedAt: now.toISOString(),
      approvedBy: summarizeWorkflowActor(authUser),
    };
  });
}

export async function returnExamRoundToDraft(tenantId: number, roundRef: unknown, payload: Record<string, unknown>, authUser: AuthUser) {
  const input = normalizeWorkflowReturnInput(payload || {});

  return strapi.db.connection.transaction(async (trx: any) => {
    const initialRound = await findExamRoundByRef(tenantId, roundRef, trx);
    await acquireExamRoundStructureLock(trx, tenantId, Number(initialRound.id));

    const round = await loadExamRoundWorkflowContext(tenantId, Number(initialRound.id), trx);
    if (normalizeText(round.status).toLowerCase() !== 'pending_approval') {
      httpError(409, 'Chỉ có thể trả về draft đợt thi đang chờ duyệt.', 'EXAM_ROUND_CANNOT_BE_RETURNED');
    }

    const now = new Date();
    await updateExamRoundWorkflowInTransaction(Number(round.id), {
      status: 'draft',
      returnedBy: authUser.id,
      returnedAt: now,
      returnReason: input.reason,
      approvedBy: null,
      approvedAt: null,
    }, trx);

    logExamRoundWorkflowEvent('exam_round.returned_to_draft', {
      tenantId,
      examRoundId: Number(round.id),
      documentId: round.documentId || null,
      userId: authUser.id,
      fromStatus: 'pending_approval',
      toStatus: 'draft',
      reason: input.reason,
      timestamp: now.toISOString(),
    });

    return {
      id: Number(round.id),
      documentId: round.documentId || null,
      code: round.code,
      status: 'draft',
      returnedAt: now.toISOString(),
      returnReason: input.reason,
    };
  });
}

export async function openExamRoundRegistration(tenantId: number, roundRef: unknown, payload: Record<string, unknown>, authUser: AuthUser) {
  const input = normalizeWorkflowNoteInput(payload || {});

  return strapi.db.connection.transaction(async (trx: any) => {
    const initialRound = await findExamRoundByRef(tenantId, roundRef, trx);
    await acquireExamRoundStructureLock(trx, tenantId, Number(initialRound.id));

    const round = await loadExamRoundWorkflowContext(tenantId, Number(initialRound.id), trx);
    if (normalizeText(round.status).toLowerCase() !== 'approved') {
      httpError(409, 'Chỉ có thể mở đăng ký từ đợt thi đã được phê duyệt.', 'EXAM_ROUND_CANNOT_OPEN_REGISTRATION');
    }

    const approvedById = Number(extractRelationRef(round?.approvedBy) || round?.approvedBy?.id || 0);
    const approvedAt = normalizeStoredDateTime(round?.approvedAt);
    if (!approvedById || !approvedAt) {
      httpError(409, 'Đợt thi chưa có dấu vết phê duyệt hợp lệ.', 'EXAM_ROUND_CANNOT_OPEN_REGISTRATION');
    }

    const now = new Date();
    assertRegistrationWindowNotExpired(round, now);
    await assertExamRoundReadyForRegistration(tenantId, Number(initialRound.id), trx);

    const warnings: Array<{ code: string; message: string }> = [];
    if (normalizeText(round.registrationMode).toLowerCase() === 'restricted') {
      const eligibleCount = await countEligibleLearnersForRound(tenantId, Number(round.id), trx);
      if (eligibleCount === 0) {
        warnings.push({
          code: 'RESTRICTED_ROUND_HAS_NO_ELIGIBILITY',
          message: 'Đợt đăng ký có điều kiện nhưng chưa có sinh viên trong danh sách được phép đăng ký.',
        });
      }
    }

    await updateExamRoundWorkflowInTransaction(Number(round.id), {
      status: 'registration_open',
      registrationOpenedBy: authUser.id,
      registrationOpenedAt: now,
      registrationPausedBy: null,
      registrationPausedAt: null,
      registrationPauseReason: null,
    }, trx, 'EXAM_ROUND_REGISTRATION_WORKFLOW_FAILED');

    logExamRoundWorkflowEvent('exam_round.registration_opened', {
      tenantId,
      roundId: Number(round.id),
      documentId: round.documentId || null,
      actorUserId: authUser.id,
      fromStatus: 'approved',
      toStatus: 'registration_open',
      note: input.note,
      timestamp: now.toISOString(),
    });

    return {
      id: Number(round.id),
      documentId: round.documentId || null,
      code: round.code,
      status: 'registration_open',
      registrationStartAt: normalizeStoredDateTime(round.registrationStartAt),
      registrationEndAt: normalizeStoredDateTime(round.registrationEndAt),
      registrationOpenedAt: now.toISOString(),
      registrationOpenedBy: summarizeWorkflowActor(authUser),
      registrationMode: normalizeText(round.registrationMode).toLowerCase() || null,
      warnings,
    };
  });
}

export async function pauseExamRoundRegistration(tenantId: number, roundRef: unknown, payload: Record<string, unknown>, authUser: AuthUser) {
  const input = normalizePauseReasonInput(payload || {});

  return strapi.db.connection.transaction(async (trx: any) => {
    const initialRound = await findExamRoundByRef(tenantId, roundRef, trx);
    await acquireExamRoundStructureLock(trx, tenantId, Number(initialRound.id));

    const round = await loadExamRoundWorkflowContext(tenantId, Number(initialRound.id), trx);
    if (normalizeText(round.status).toLowerCase() !== 'registration_open') {
      httpError(409, 'Chỉ có thể tạm dừng khi đợt thi đang mở đăng ký.', 'EXAM_ROUND_CANNOT_PAUSE_REGISTRATION');
    }

    const now = new Date();
    await updateExamRoundWorkflowInTransaction(Number(round.id), {
      status: 'registration_paused',
      registrationPausedBy: authUser.id,
      registrationPausedAt: now,
      registrationPauseReason: input.reason,
    }, trx, 'EXAM_ROUND_REGISTRATION_WORKFLOW_FAILED');

    logExamRoundWorkflowEvent('exam_round.registration_paused', {
      tenantId,
      roundId: Number(round.id),
      documentId: round.documentId || null,
      actorUserId: authUser.id,
      fromStatus: 'registration_open',
      toStatus: 'registration_paused',
      reason: input.reason,
      timestamp: now.toISOString(),
    });

    return {
      id: Number(round.id),
      documentId: round.documentId || null,
      code: round.code,
      status: 'registration_paused',
      registrationPausedAt: now.toISOString(),
      registrationPauseReason: input.reason,
    };
  });
}

export async function resumeExamRoundRegistration(tenantId: number, roundRef: unknown, payload: Record<string, unknown>, authUser: AuthUser) {
  const input = normalizeWorkflowNoteInput(payload || {});

  return strapi.db.connection.transaction(async (trx: any) => {
    const initialRound = await findExamRoundByRef(tenantId, roundRef, trx);
    await acquireExamRoundStructureLock(trx, tenantId, Number(initialRound.id));

    const round = await loadExamRoundWorkflowContext(tenantId, Number(initialRound.id), trx);
    if (normalizeText(round.status).toLowerCase() !== 'registration_paused') {
      httpError(409, 'Chỉ có thể tiếp tục khi đợt thi đang tạm dừng đăng ký.', 'EXAM_ROUND_CANNOT_RESUME_REGISTRATION');
    }

    const now = new Date();
    assertRegistrationWindowNotExpired(round, now);
    await assertExamRoundReadyForRegistration(tenantId, Number(initialRound.id), trx);

    await updateExamRoundWorkflowInTransaction(Number(round.id), {
      status: 'registration_open',
      registrationResumedBy: authUser.id,
      registrationResumedAt: now,
    }, trx, 'EXAM_ROUND_REGISTRATION_WORKFLOW_FAILED');

    logExamRoundWorkflowEvent('exam_round.registration_resumed', {
      tenantId,
      roundId: Number(round.id),
      documentId: round.documentId || null,
      actorUserId: authUser.id,
      fromStatus: 'registration_paused',
      toStatus: 'registration_open',
      note: input.note,
      timestamp: now.toISOString(),
    });

    return {
      id: Number(round.id),
      documentId: round.documentId || null,
      code: round.code,
      status: 'registration_open',
      registrationResumedAt: now.toISOString(),
    };
  });
}

export async function closeExamRoundRegistration(tenantId: number, roundRef: unknown, payload: Record<string, unknown>, authUser: AuthUser) {
  const input = normalizeOptionalReasonInput(payload || {});
  const requestStartedAt = new Date();

  return strapi.db.connection.transaction(async (trx: any) => {
    const initialRound = await findExamRoundByRef(tenantId, roundRef, trx);
    await acquireExamRoundStructureLock(trx, tenantId, Number(initialRound.id));

    const round = await loadExamRoundWorkflowContext(tenantId, Number(initialRound.id), trx);
    const currentStatus = normalizeText(round.status).toLowerCase();
    if (currentStatus !== 'registration_open' && currentStatus !== 'registration_paused') {
      httpError(409, 'Chỉ có thể đóng khi đợt thi đang mở hoặc tạm dừng đăng ký.', 'EXAM_ROUND_CANNOT_CLOSE_REGISTRATION');
    }

    if (registrationStateChangedDuringRequest(currentStatus, round, requestStartedAt)) {
      httpError(409, 'Trạng thái đợt thi đã thay đổi bởi một thao tác đăng ký khác đang chạy đồng thời.', 'EXAM_ROUND_CANNOT_CLOSE_REGISTRATION');
    }

    const now = new Date();
    await updateExamRoundWorkflowInTransaction(Number(round.id), {
      status: 'registration_closed',
      registrationClosedBy: authUser.id,
      registrationClosedAt: now,
      registrationCloseReason: input.reason,
    }, trx, 'EXAM_ROUND_REGISTRATION_WORKFLOW_FAILED');

    logExamRoundWorkflowEvent('exam_round.registration_closed', {
      tenantId,
      roundId: Number(round.id),
      documentId: round.documentId || null,
      actorUserId: authUser.id,
      fromStatus: currentStatus,
      toStatus: 'registration_closed',
      reason: input.reason,
      timestamp: now.toISOString(),
    });

    return {
      id: Number(round.id),
      documentId: round.documentId || null,
      code: round.code,
      status: 'registration_closed',
      registrationClosedAt: now.toISOString(),
      registrationCloseReason: input.reason,
    };
  });
}

export async function createExamRoundEligibility(tenantId: number, roundRef: unknown, payload: Record<string, unknown>, authUser: AuthUser) {
  const input = normalizeCreateEligibilityInput(payload || {});

  return strapi.db.connection.transaction(async (trx: any) => {
    const round = await findExamRoundByRef(tenantId, roundRef, trx);
    await acquireExamRoundStructureLock(trx, tenantId, Number(round.id));

    const workflowRound = await loadExamRoundWorkflowContext(tenantId, Number(round.id), trx);
    assertExamEligibilityEditableRound(workflowRound);

    const learner = await findLearnerInTenant(tenantId, input.learnerId, trx);
    const existing = await findExistingEligibilitiesByLearnerIds(tenantId, Number(round.id), [input.learnerId], trx);
    if (existing.length > 0) {
      httpError(409, 'Learner already has exam eligibility in this round.', 'EXAM_ELIGIBILITY_ALREADY_EXISTS', { learnerId: input.learnerId, examRoundId: Number(round.id) });
    }

    const now = new Date();
    const created = await strapi.db.query(EXAM_ELIGIBILITY_UID).create({
      data: {
        examRound: Number(round.id),
        learner: learner.id,
        tenant: tenantId,
        source: input.source,
        eligibilityStatus: input.eligibilityStatus,
        reason: input.reason,
        note: input.note,
        ...resolveEligibilityReviewFields(input.eligibilityStatus, authUser, now),
      },
      transacting: trx,
    } as any) as any;

    if (!created?.id) {
      httpError(409, 'Failed to create exam eligibility.', 'EXAM_ELIGIBILITY_CREATE_FAILED');
    }

    const fresh = await findExamEligibilityInRound(tenantId, Number(round.id), created.id, trx);

    strapi.log.info(`[exam-eligibility] exam_eligibility.created ${JSON.stringify({ tenantId, examRoundId: Number(round.id), eligibilityId: Number(created.id), learnerId: learner.id, actorUserId: authUser.id, beforeStatus: null, afterStatus: input.eligibilityStatus, source: input.source, timestamp: now.toISOString() })}`);

    return mapEligibilityRow(fresh, { includeReviewedBy: true });
  });
}

export async function bulkCreateExamRoundEligibilities(tenantId: number, roundRef: unknown, payload: Record<string, unknown>, authUser: AuthUser) {
  const input = normalizeBulkCreateEligibilitiesInput(payload || {});

  return strapi.db.connection.transaction(async (trx: any) => {
    const round = await findExamRoundByRef(tenantId, roundRef, trx);
    await acquireExamRoundStructureLock(trx, tenantId, Number(round.id));

    const workflowRound = await loadExamRoundWorkflowContext(tenantId, Number(round.id), trx);
    assertExamEligibilityEditableRound(workflowRound);

    const learnerIds = input.items.map((item) => item.learnerId);
    const learnerRows = await strapi.db.query(LEARNER_UID).findMany({
      where: mergeTenantWhere({ id: { $in: learnerIds } }, tenantId),
      select: ['id', 'code', 'fullName', 'learnerStatus'],
      transacting: trx,
    } as any) as any[];

    const learnerMap = new Map<number, any>(learnerRows.map((row) => [Number(row.id), row]));
    const missingLearnerIds = learnerIds.filter((learnerId) => !learnerMap.has(learnerId));
    if (missingLearnerIds.length > 0) {
      httpError(404, 'One or more learners were not found in tenant.', 'LEARNER_NOT_FOUND', { learnerIds: missingLearnerIds });
    }

    const existingRows = await findExistingEligibilitiesByLearnerIds(tenantId, Number(round.id), learnerIds, trx);
    const existingByLearnerId = new Map<number, any>();
    for (const row of existingRows) {
      const learnerId = Number(extractRelationRef(row?.learner) || row?.learner?.id || 0);
      if (learnerId > 0) existingByLearnerId.set(learnerId, row);
    }

    if (input.duplicateHandling === 'reject' && existingByLearnerId.size > 0) {
      httpError(409, 'Duplicate eligibilities were found for this round.', 'EXAM_ELIGIBILITY_DUPLICATE_FOUND', {
        learnerIds: Array.from(existingByLearnerId.keys()),
      });
    }

    const now = new Date();
    let created = 0;
    let updated = 0;
    let skipped = 0;
    const skippedItems: Array<{ learnerId: number; reason: string }> = [];

    for (const item of input.items) {
      const existing = existingByLearnerId.get(item.learnerId);
      if (existing?.id) {
        if (input.duplicateHandling === 'skip') {
          skipped += 1;
          skippedItems.push({ learnerId: item.learnerId, reason: 'already_exists' });
          continue;
        }

        if (input.duplicateHandling === 'update') {
          await strapi.db.query(EXAM_ELIGIBILITY_UID).update({
            where: { id: existing.id },
            data: {
              eligibilityStatus: item.eligibilityStatus,
              source: input.source,
              reason: item.reason,
              note: item.note,
              ...resolveEligibilityReviewFields(item.eligibilityStatus, authUser, now),
            },
            transacting: trx,
          } as any);
          updated += 1;
          continue;
        }
      }

      const createdRow = await strapi.db.query(EXAM_ELIGIBILITY_UID).create({
        data: {
          examRound: Number(round.id),
          learner: item.learnerId,
          tenant: tenantId,
          source: input.source,
          eligibilityStatus: item.eligibilityStatus,
          reason: item.reason,
          note: item.note,
          ...resolveEligibilityReviewFields(item.eligibilityStatus, authUser, now),
        },
        transacting: trx,
      } as any) as any;
      if (!createdRow?.id) {
        httpError(409, 'Failed to bulk create exam eligibilities.', 'EXAM_ELIGIBILITY_BULK_FAILED');
      }
      created += 1;
    }

    strapi.log.info(`[exam-eligibility] exam_eligibility.bulk_processed ${JSON.stringify({ tenantId, examRoundId: Number(round.id), actorUserId: authUser.id, source: input.source, duplicateHandling: input.duplicateHandling, received: input.items.length, created, updated, skipped, timestamp: now.toISOString() })}`);

    return {
      examRoundId: Number(round.id),
      summary: {
        received: input.items.length,
        created,
        updated,
        skipped,
        failed: 0,
      },
      skipped: skippedItems,
    };
  });
}

export async function listExamRoundEligibilities(tenantId: number, roundRef: unknown, rawQuery: Record<string, unknown>, _authUser: AuthUser) {
  const round = await findExamRoundByRef(tenantId, roundRef);
  const query = normalizeEligibilityListQuery(rawQuery || {});
  const orderBy = resolveEligibilityOrderBy(query.sort);
  const start = (query.page - 1) * query.pageSize;
  const registeredLearnerIds = query.registrationState ? await findRegisteredLearnerIdsForRound(tenantId, Number(round.id)) : [];
  const registrationClause = query.registrationState === 'registered'
    ? (registeredLearnerIds.length > 0 ? { learner: { id: { $in: registeredLearnerIds } } } : { id: { $eq: -1 } })
    : query.registrationState === 'unregistered'
      ? (registeredLearnerIds.length > 0 ? { learner: { id: { $notIn: registeredLearnerIds } } } : null)
      : null;
  const baseWhere = buildEligibilityListWhere(Number(round.id), query);
  const where = mergeTenantWhere(registrationClause
    ? { $and: [baseWhere, registrationClause] }
    : baseWhere, tenantId);

  const [rows, total, pending, eligible, temporarilyIneligible, ineligible] = await Promise.all([
    strapi.db.query(EXAM_ELIGIBILITY_UID).findMany({
      where,
      offset: start,
      limit: query.pageSize,
      orderBy: orderBy.length > 0 ? orderBy : [{ updatedAt: 'desc' }, { id: 'desc' }],
      populate: {
        learner: { select: ['id', 'code', 'fullName', 'dateOfBirth', 'parentPhone', 'learnerStatus'] },
        reviewedBy: { select: ['id', 'username', 'fullName', 'email'] },
        examRound: { select: ['id'] },
      },
    } as any),
    strapi.db.query(EXAM_ELIGIBILITY_UID).count({ where } as any),
    strapi.db.query(EXAM_ELIGIBILITY_UID).count({ where: mergeTenantWhere({ examRound: { id: { $eq: Number(round.id) } }, eligibilityStatus: 'pending' }, tenantId) } as any),
    strapi.db.query(EXAM_ELIGIBILITY_UID).count({ where: mergeTenantWhere({ examRound: { id: { $eq: Number(round.id) } }, eligibilityStatus: 'eligible' }, tenantId) } as any),
    strapi.db.query(EXAM_ELIGIBILITY_UID).count({ where: mergeTenantWhere({ examRound: { id: { $eq: Number(round.id) } }, eligibilityStatus: 'temporarily_ineligible' }, tenantId) } as any),
    strapi.db.query(EXAM_ELIGIBILITY_UID).count({ where: mergeTenantWhere({ examRound: { id: { $eq: Number(round.id) } }, eligibilityStatus: 'ineligible' }, tenantId) } as any),
  ]);

  const learnerIds = (rows || []).map((row: any) => Number(extractRelationRef(row?.learner) || row?.learner?.id || 0)).filter((value: number) => value > 0);
  const registrationByLearnerId = await findEffectiveRegistrationsByLearnerIds(tenantId, Number(round.id), learnerIds);
  const registered = await countRegisteredLearnersForRound(tenantId, Number(round.id));

  return {
    data: (rows || []).map((row: any) => {
      const learnerId = Number(extractRelationRef(row?.learner) || row?.learner?.id || 0);
      return mapEligibilityRow(row, {
        includeReviewedBy: true,
        registrationSummary: learnerId > 0 ? registrationByLearnerId.get(learnerId) || null : null,
      });
    }),
    meta: {
      pagination: {
        page: query.page,
        pageSize: query.pageSize,
        pageCount: Math.max(1, Math.ceil(total / query.pageSize)),
        total,
      },
      summary: {
        pending,
        eligible,
        temporarilyIneligible,
        ineligible,
        registered,
        notRegistered: Math.max(0, total - registered),
      },
    },
  };
}

export async function getExamRoundEligibility(tenantId: number, roundRef: unknown, eligibilityRef: unknown, _authUser: AuthUser) {
  const round = await findExamRoundByRef(tenantId, roundRef);
  const entity = await findExamEligibilityInRound(tenantId, Number(round.id), eligibilityRef);
  const learnerId = Number(extractRelationRef(entity?.learner) || entity?.learner?.id || 0);
  const registrationSummary = learnerId > 0 ? await findExistingEffectiveRegistration(tenantId, Number(round.id), learnerId) : null;
  return mapEligibilityRow(entity, { includeReviewedBy: true, includeTimestamps: true, registrationSummary });
}

export async function listLearnersForExamRoundEligibility(tenantId: number, roundRef: unknown, rawQuery: Record<string, unknown>, _authUser: AuthUser) {
  const round = await findExamRoundByRef(tenantId, roundRef);
  const query = normalizeLearnerEligibilityLookupQuery(rawQuery || {});
  const clauses: any[] = [];

  if (query.search) {
    clauses.push({
      $or: [
        { code: { $containsi: query.search } },
        { fullName: { $containsi: query.search } },
        { parentPhone: { $containsi: query.search } },
      ],
    });
  }

  if (query.excludeExisting) {
    const existingRows = await strapi.db.query(EXAM_ELIGIBILITY_UID).findMany({
      where: mergeTenantWhere({ examRound: { id: { $eq: Number(round.id) } } }, tenantId),
      select: ['id'],
      populate: {
        learner: { select: ['id'] },
      },
    } as any) as any[];
    const existingLearnerIds = existingRows
      .map((row: any) => Number(extractRelationRef(row?.learner) || row?.learner?.id || 0))
      .filter((value: number) => value > 0);
    if (existingLearnerIds.length > 0) {
      clauses.push({ id: { $notIn: existingLearnerIds } });
    }
  }

  const where = mergeTenantWhere(clauses.length > 1 ? { $and: clauses } : (clauses[0] || {}), tenantId);
  const offset = (query.page - 1) * query.pageSize;
  const [rows, total] = await Promise.all([
    strapi.db.query(LEARNER_UID).findMany({
      where,
      select: ['id', 'code', 'fullName', 'dateOfBirth', 'parentPhone', 'learnerStatus'],
      orderBy: [{ fullName: 'asc' }, { code: 'asc' }, { id: 'asc' }],
      offset,
      limit: query.pageSize,
    } as any),
    strapi.db.query(LEARNER_UID).count({ where } as any),
  ]);

  const learnerIds = (rows || []).map((row: any) => Number(row?.id || 0)).filter((value: number) => value > 0);
  const existingRows = await findExistingEligibilitiesByLearnerIds(tenantId, Number(round.id), learnerIds);
  const existingByLearnerId = new Map<number, any>();
  for (const row of existingRows) {
    const learnerId = Number(extractRelationRef(row?.learner) || row?.learner?.id || 0);
    if (learnerId > 0) existingByLearnerId.set(learnerId, row);
  }
  const registrationByLearnerId = await findEffectiveRegistrationsByLearnerIds(tenantId, Number(round.id), learnerIds);

  const data = (rows || []).map((row: any) => mapLearnerLookupRow(row, existingByLearnerId.get(Number(row?.id || 0)) || null, registrationByLearnerId.get(Number(row?.id || 0)) || null));

  return {
    data,
    meta: {
      pagination: {
        page: query.page,
        pageSize: query.pageSize,
        pageCount: Math.max(1, Math.ceil(total / query.pageSize)),
        total,
      },
    },
  };
}

export async function updateExamRoundEligibility(tenantId: number, roundRef: unknown, eligibilityRef: unknown, payload: Record<string, unknown>, authUser: AuthUser) {
  const input = normalizeUpdateEligibilityInput(payload || {});

  return strapi.db.connection.transaction(async (trx: any) => {
    const round = await findExamRoundByRef(tenantId, roundRef, trx);
    await acquireExamRoundStructureLock(trx, tenantId, Number(round.id));
    const workflowRound = await loadExamRoundWorkflowContext(tenantId, Number(round.id), trx);
    assertExamEligibilityEditableRound(workflowRound);

    const entity = await findExamEligibilityInRound(tenantId, Number(round.id), eligibilityRef, trx);
    const now = new Date();
    await strapi.db.query(EXAM_ELIGIBILITY_UID).update({
      where: { id: entity.id },
      data: {
        eligibilityStatus: input.eligibilityStatus,
        reason: input.reason,
        note: input.note,
        ...resolveEligibilityReviewFields(input.eligibilityStatus, authUser, now),
      },
      transacting: trx,
    } as any);

    const fresh = await findExamEligibilityInRound(tenantId, Number(round.id), entity.id, trx);
    strapi.log.info(`[exam-eligibility] exam_eligibility.updated ${JSON.stringify({ tenantId, examRoundId: Number(round.id), eligibilityId: Number(entity.id), learnerId: Number(extractRelationRef(entity?.learner) || entity?.learner?.id || 0), actorUserId: authUser.id, beforeStatus: normalizeEligibilityStatus(entity?.eligibilityStatus, 'eligibilityStatus', 'pending'), afterStatus: input.eligibilityStatus, source: normalizeEligibilitySource(entity?.source, 'source', 'manual'), timestamp: now.toISOString() })}`);
    return mapEligibilityRow(fresh, { includeReviewedBy: true, includeTimestamps: true });
  });
}

export async function markExamRoundEligibilityIneligible(tenantId: number, roundRef: unknown, eligibilityRef: unknown, payload: Record<string, unknown>, authUser: AuthUser) {
  const input = normalizeMarkIneligibleInput(payload || {});

  return strapi.db.connection.transaction(async (trx: any) => {
    const round = await findExamRoundByRef(tenantId, roundRef, trx);
    await acquireExamRoundStructureLock(trx, tenantId, Number(round.id));
    const workflowRound = await loadExamRoundWorkflowContext(tenantId, Number(round.id), trx);
    assertExamEligibilityEditableRound(workflowRound);

    const entity = await findExamEligibilityInRound(tenantId, Number(round.id), eligibilityRef, trx);
    const learnerId = Number(extractRelationRef(entity?.learner) || entity?.learner?.id || 0);
    const warnings: Array<{ code: string; message: string }> = [];
    const activeRegistrations = await countActiveRegistrationsForEligibility(tenantId, Number(round.id), learnerId, trx);
    if (activeRegistrations > 0) {
      warnings.push({
        code: 'EXAM_ELIGIBILITY_HAS_ACTIVE_REGISTRATION',
        message: 'Learner đã có đăng ký dự thi đang hiệu lực. Việc loại khỏi danh sách không tự hủy đăng ký.',
      });
    }

    const now = new Date();
    await strapi.db.query(EXAM_ELIGIBILITY_UID).update({
      where: { id: entity.id },
      data: {
        eligibilityStatus: 'ineligible',
        reason: input.reason,
        note: input.note,
        reviewedBy: authUser.id,
        reviewedAt: now,
      },
      transacting: trx,
    } as any);

    const fresh = await findExamEligibilityInRound(tenantId, Number(round.id), entity.id, trx);
    strapi.log.info(`[exam-eligibility] exam_eligibility.marked_ineligible ${JSON.stringify({ tenantId, examRoundId: Number(round.id), eligibilityId: Number(entity.id), learnerId, actorUserId: authUser.id, beforeStatus: normalizeEligibilityStatus(entity?.eligibilityStatus, 'eligibilityStatus', 'pending'), afterStatus: 'ineligible', source: normalizeEligibilitySource(entity?.source, 'source', 'manual'), timestamp: now.toISOString() })}`);
    return {
      ...mapEligibilityRow(fresh, { includeReviewedBy: true, includeTimestamps: true }),
      warnings,
    };
  });
}

export async function createExamRoundFromProgram(tenantId: number, payload: Record<string, unknown>, _authUser: AuthUser) {
  const input = normalizeInput(payload || {});

  const existing = await findExamRoundByCode(tenantId, input.code);
  if (existing?.id) {
    httpError(409, 'Mã đợt thi đã tồn tại trong tenant hiện tại.', 'EXAM_ROUND_CODE_EXISTS');
  }

  const graph = await loadProgramGraph(tenantId, input.examProgramId);
  const { subjectDrafts, componentDraftsBySubjectId, warnings } = validateProgramGraph(tenantId, graph, input);
  const resolvedFixedFee = resolveExamRoundFixedFee(input, graph.examProgram, subjectDrafts);

  try {
    const result = await strapi.db.connection.transaction(async (trx: any) => {
      await acquireExamRoundCodeLock(trx, tenantId, input.code);

      const duplicateAfterLock = await findExamRoundByCode(tenantId, input.code, trx);
      if (duplicateAfterLock?.id) {
        httpError(409, 'Mã đợt thi đã tồn tại trong tenant hiện tại.', 'EXAM_ROUND_CODE_EXISTS');
      }

      const createdRound = await strapi.db.query(EXAM_ROUND_UID).create({
        data: buildExamRoundCreateData(input, tenantId, graph.examProgram.id, resolvedFixedFee),
        select: ['id', 'documentId', 'code', 'name', 'status', 'paymentCalculationMethod', 'fixedFee'],
        transacting: trx,
      } as any) as any;

      const createdSubjects: any[] = [];
      const subjectMap = new Map<number, any>();
      for (const subjectDraft of subjectDrafts) {
        const createdSubject = await strapi.db.query(EXAM_ROUND_SUBJECT_UID).create({
          data: {
            examRound: createdRound.id,
            examSubject: subjectDraft.examSubjectId,
            sourceProgramSubject: subjectDraft.sourceProgramSubjectId,
            nameSnapshot: subjectDraft.nameSnapshot,
            calculationMethodSnapshot: subjectDraft.calculationMethodSnapshot,
            requiredAggregateScoreSnapshot: subjectDraft.requiredAggregateScoreSnapshot,
            requireAllComponentsSnapshot: subjectDraft.requireAllComponentsSnapshot,
            ruleDescriptionSnapshot: subjectDraft.ruleDescriptionSnapshot,
            fee: subjectDraft.fee,
            isRequired: subjectDraft.isRequired,
            allowSeparateRegistration: subjectDraft.allowSeparateRegistration,
            displayOrder: subjectDraft.displayOrder,
            status: 'active',
            tenant: tenantId,
          },
          select: ['id'],
          transacting: trx,
        } as any) as any;

        createdSubjects.push(createdSubject);
        subjectMap.set(subjectDraft.examSubjectId, createdSubject);
      }

      let componentCount = 0;
      for (const [subjectId, componentDrafts] of componentDraftsBySubjectId.entries()) {
        const roundSubject = subjectMap.get(subjectId);
        if (!roundSubject?.id) {
          httpError(500, 'Không thể map exam-round-subject vừa tạo.', 'SNAPSHOT_CREATION_FAILED');
        }

        for (const componentDraft of componentDrafts) {
          await strapi.db.query(EXAM_ROUND_COMPONENT_UID).create({
            data: {
              examRound: createdRound.id,
              examRoundSubject: roundSubject.id,
              examComponent: componentDraft.examComponentId,
              nameSnapshot: componentDraft.nameSnapshot,
              minimumScoreSnapshot: componentDraft.minimumScoreSnapshot,
              maximumScoreSnapshot: componentDraft.maximumScoreSnapshot,
              passingScoreSnapshot: componentDraft.passingScoreSnapshot,
              eliminationScoreSnapshot: componentDraft.eliminationScoreSnapshot,
              durationMinutes: componentDraft.durationMinutes,
              examMethod: componentDraft.examMethod,
              fee: componentDraft.fee,
              isRequired: componentDraft.isRequired,
              allowSeparateRegistration: componentDraft.allowSeparateRegistration,
              displayOrder: componentDraft.displayOrder,
              status: 'active',
              tenant: tenantId,
            },
            transacting: trx,
          } as any);

          componentCount += 1;
        }
      }

      return {
        examRound: {
          id: createdRound.id,
          documentId: createdRound.documentId || null,
          code: createdRound.code,
          name: createdRound.name,
          status: 'draft',
          examProgram: {
            id: graph.examProgram.id,
            name: graph.examProgram.name,
          },
        },
        summary: {
          subjectsCreated: createdSubjects.length,
          componentsCreated: componentCount,
          feeCalculationMethod: input.paymentCalculationMethod,
          fixedFee: resolvedFixedFee,
        },
        ...(warnings.length > 0 ? { warnings } : {}),
      };
    });

    return result;
  } catch (error: any) {
    if (error instanceof HttpError) throw error;

    if (isUniqueViolation(error)) {
      httpError(409, 'Mã đợt thi đã tồn tại trong tenant hiện tại.', 'EXAM_ROUND_CODE_EXISTS');
    }

    throw error;
  }
}

export async function updateExamRoundStructure(tenantId: number, roundRef: unknown, payload: Record<string, unknown>, _authUser: AuthUser) {
  const input = normalizeStructureUpdateInput(payload || {});

  try {
    return await strapi.db.connection.transaction(async (trx: any) => {
      const round = await findExamRoundByRef(tenantId, roundRef, trx);
      await acquireExamRoundStructureLock(trx, tenantId, Number(round.id));

      const structure = await loadExamRoundStructure(tenantId, Number(round.id), trx);
      const merged = mergeStructureUpdate(structure, input);
      validateStructureGraph(merged);

      await updateExamRoundInTransaction(merged.round, trx);
      for (const subject of merged.subjects) {
        await updateRoundSubjectInTransaction(subject, trx);
        for (const component of subject.components) {
          await updateRoundComponentInTransaction(component, trx);
        }
      }

      return {
        examRound: {
          id: merged.round.id,
          documentId: merged.round.documentId,
          code: merged.round.code,
          status: merged.round.status,
          paymentCalculationMethod: merged.round.paymentCalculationMethod,
          fixedFee: merged.round.fixedFee,
          allowSubjectSelection: merged.round.allowSubjectSelection,
          allowComponentSelection: merged.round.allowComponentSelection,
        },
        summary: summarizeStructure(merged.subjects),
        subjects: merged.subjects
          .slice()
          .sort((left, right) => left.displayOrder - right.displayOrder || left.id - right.id)
          .map((subject) => ({
            id: subject.id,
            nameSnapshot: subject.nameSnapshot,
            status: subject.status,
            isRequired: subject.isRequired,
            allowSeparateRegistration: subject.allowSeparateRegistration,
            fee: subject.fee,
            displayOrder: subject.displayOrder,
            components: subject.components
              .slice()
              .sort((left, right) => left.displayOrder - right.displayOrder || left.id - right.id)
              .map((component) => ({
                id: component.id,
                nameSnapshot: component.nameSnapshot,
                status: component.status,
                isRequired: component.isRequired,
                allowSeparateRegistration: component.allowSeparateRegistration,
                durationMinutes: component.durationMinutes,
                minimumScoreSnapshot: component.minimumScoreSnapshot,
                maximumScoreSnapshot: component.maximumScoreSnapshot,
                passingScoreSnapshot: component.passingScoreSnapshot,
                eliminationScoreSnapshot: component.eliminationScoreSnapshot,
                fee: component.fee,
                displayOrder: component.displayOrder,
              })),
          })),
      };
    });
  } catch (error: any) {
    if (error instanceof HttpError) throw error;
    throw error;
  }
}

export function handleExamRoundManagementError(ctx: any, error: unknown) {
  const maybeHttpError = error && typeof error === 'object' && Number.isInteger((error as any).status)
    ? error as { status: number; message: string; code?: string | null; details?: HttpErrorDetails }
    : null;

  if (error instanceof HttpError || maybeHttpError) {
    const normalizedError = (error instanceof HttpError ? error : maybeHttpError) as { status: number; message: string; code?: string | null; details?: HttpErrorDetails };
    const body = {
      error: normalizedError.message,
      ...(normalizedError.code ? { code: normalizedError.code } : {}),
      status: normalizedError.status,
      ...(normalizedError.details ? { details: normalizedError.details } : {}),
    };

    if (normalizedError.status === 400) {
      ctx.status = 400;
      ctx.body = body;
      return;
    }
    if (normalizedError.status === 401) return ctx.unauthorized(normalizedError.message);
    if (normalizedError.status === 403) {
      ctx.status = 403;
      ctx.body = body;
      return;
    }
    if (normalizedError.status === 404) {
      ctx.status = 404;
      ctx.body = body;
      return;
    }
    if (normalizedError.status === 409) {
      ctx.status = 409;
      ctx.body = body;
      return;
    }

    ctx.status = normalizedError.status;
    ctx.body = body;
    return;
  }

  if (error instanceof errors.ApplicationError) {
    return ctx.badRequest(error.message);
  }

  strapi.log.error('[exam-round-management] unexpected error', error);
  return ctx.internalServerError('Failed to process exam round management request');
}

export async function getCurrentLearnerProfile(ctx: any, tenantId: number, _authUser: AuthUser) {
  const learner = await resolveCurrentLearnerOptional(ctx, tenantId);
  return {
    user: mapPortalUser(_authUser),
    learner: learner ? mapCurrentLearnerProfile(learner) : null,
    learnerState: learner ? 'linked' : 'missing',
    support: await loadLearnerSupportInfo(tenantId),
  };
}

export async function listLearnerExamRounds(ctx: any, tenantId: number, rawQuery: Record<string, unknown>, _authUser: AuthUser) {
  const learner = await resolveCurrentLearnerOptional(ctx, tenantId);
  const query = normalizeLearnerRoundListQuery(rawQuery || {});
  const where = mergeTenantWhere(buildLearnerFacingExamRoundWhere(query), tenantId);

  const rows = await strapi.db.query(EXAM_ROUND_UID).findMany({
    where,
    select: ['id', 'documentId', 'code', 'name', 'academicYear', 'semester', 'registrationMode', 'registrationStartAt', 'registrationEndAt', 'examStartAt', 'examEndAt', 'paymentCalculationMethod', 'fixedFee', 'status', 'instructions', 'paymentInstructions', 'updatedAt'],
    orderBy: [
      { registrationStartAt: 'asc' },
      { examStartAt: 'asc' },
      { id: 'desc' },
    ],
  } as any) as any[];

  const visibleRows = await buildLearnerFacingRoundAccessRecords(tenantId, learner, rows || []);
  const total = visibleRows.length;
  const start = (query.page - 1) * query.pageSize;
  const pageRows = visibleRows.slice(start, start + query.pageSize);

  return {
    data: pageRows,
    meta: {
      pagination: {
        page: query.page,
        pageSize: query.pageSize,
        total,
        pageCount: Math.max(1, Math.ceil(total / query.pageSize)),
      },
      serverNow: new Date().toISOString(),
    },
    user: mapPortalUser(_authUser),
    learner: learner ? mapCurrentLearnerProfile(learner) : null,
    learnerState: learner ? 'linked' : 'missing',
    support: await loadLearnerSupportInfo(tenantId),
  };
}

export async function getLearnerExamRoundDetail(ctx: any, tenantId: number, roundRef: unknown, _authUser: AuthUser) {
  const learner = await resolveCurrentLearnerOptional(ctx, tenantId);
  const round = await findExamRoundByRef(tenantId, roundRef);
  const visibleRows = await buildLearnerFacingRoundAccessRecords(tenantId, learner, [round]);
  const summary = visibleRows[0];
  if (!summary) {
    httpError(404, 'Không tìm thấy đợt thi phù hợp cho learner hiện tại.', 'EXAM_ROUND_NOT_AVAILABLE');
  }

  const structure = await loadExamRoundStructure(tenantId, Number(round.id), undefined, { requireDraft: false });
  const workflowRound = await loadExamRoundWorkflowContext(tenantId, Number(round.id));
  const eligibility = learner ? await findLearnerEligibilityForRound(tenantId, Number(round.id), learner.id) : null;
  const existingRegistration = learner ? await findExistingEffectiveRegistration(tenantId, Number(round.id), learner.id) : null;
  const availabilityDecision = buildLearnerFacingRoundAvailability(workflowRound, learner, structure, eligibility, existingRegistration);
  const defaultSelection = buildDefaultSelection(structure);
  const feePreview = calculateFeeSummary(workflowRound, defaultSelection);

  return {
    user: mapPortalUser(_authUser),
    learner: learner ? mapCurrentLearnerProfile(learner) : null,
    learnerState: learner ? 'linked' : 'missing',
    support: await loadLearnerSupportInfo(tenantId),
    serverNow: new Date().toISOString(),
    examRound: {
      id: Number(round.id),
      documentId: round.documentId || null,
      code: normalizeText(round.code),
      name: normalizeText(round.name),
      academicYear: normalizeText(round.academicYear) || null,
      semester: normalizeText(round.semester) || null,
      status: normalizeText(round.status).toLowerCase() || null,
      registrationMode: normalizeText(round.registrationMode).toLowerCase() || null,
      registrationStartAt: normalizeStoredDateTime(round.registrationStartAt),
      registrationEndAt: normalizeStoredDateTime(round.registrationEndAt),
      examStartAt: normalizeStoredDateTime(round.examStartAt),
      examEndAt: normalizeStoredDateTime(round.examEndAt),
      instructions: normalizeOptionalText(round.instructions),
      paymentInstructions: normalizeOptionalText(round.paymentInstructions),
    },
    availability: {
      registrationWindowState: availabilityDecision.registrationWindowStatus,
      canRegister: availabilityDecision.canRegister === true,
      requiresLearnerCreation: availabilityDecision.requiresLearnerCreation === true,
      reasonCode: availabilityDecision.reasonCode || null,
    },
    eligibility: mapLearnerFacingEligibilityState(workflowRound, availabilityDecision.eligibilityDecision),
    existingRegistration: mapExistingRegistrationSummary(existingRegistration),
    configuration: {
      allowSubjectSelection: workflowRound.allowSubjectSelection === true,
      allowComponentSelection: workflowRound.allowComponentSelection === true,
      paymentCalculationMethod: workflowRound.paymentCalculationMethod,
      requireConfirmedPayment: workflowRound.requireConfirmedPayment === true,
      fixedFee: toMoney(round.fixedFee, 0),
    },
    subjects: buildContextSubjects(structure),
    feePreview,
  };
}

export async function getLearnerProfileContext(ctx: any, tenantId: number, roundRef: unknown, authUser: AuthUser) {
  return await buildLearnerProfileContext(ctx, tenantId, roundRef, authUser);
}

export async function listActivePaymentProfilesForExamRound(query: Record<string, unknown> = {}, tenantId: number) {
  const page = Math.min(100, toPositiveInt(query?.page, 1));
  const pageSize = Math.min(100, toPositiveInt(query?.pageSize, 50));
  const keyword = normalizeText(query?.search ?? query?.q);
  const whereClauses: Array<Record<string, unknown>> = [{ isActive: { $eq: true } }];

  if (keyword) {
    whereClauses.push({
      $or: [
        { name: { $containsi: keyword } },
        { code: { $containsi: keyword } },
        { bankName: { $containsi: keyword } },
        { accountNumber: { $containsi: keyword } },
        { accountHolder: { $containsi: keyword } },
      ],
    });
  }

  const where = mergeTenantWhere(whereClauses.length > 1 ? { $and: whereClauses } : whereClauses[0], tenantId);
  const [rows, total] = await Promise.all([
    strapi.db.query(PAYMENT_PROFILE_UID).findMany({
      where,
      select: ['id', 'documentId', 'name', 'code', 'paymentMethod', 'bankCode', 'bankName', 'accountNumber', 'accountHolder', 'bankBranch', 'currency', 'transferContentTemplate', 'paymentInstruction', 'supportPhone', 'supportEmail', 'isActive', 'isDefault', 'sortOrder'],
      populate: {
        qrImage: { select: ['id', 'name', 'url', 'mime'] },
      },
      orderBy: [{ isDefault: 'desc' }, { sortOrder: 'asc' }, { name: 'asc' }, { id: 'asc' }],
      offset: (page - 1) * pageSize,
      limit: pageSize,
    } as any),
    strapi.db.query(PAYMENT_PROFILE_UID).count({ where } as any),
  ]);

  return {
    data: (rows || []).map((row: any) => mapPaymentProfileSummary(row)),
    meta: {
      pagination: {
        page,
        pageSize,
        total,
        pageCount: Math.max(1, Math.ceil(total / pageSize)),
      },
    },
  };
}

export async function applyPaymentProfileToExamRound(tenantId: number, roundRef: unknown, payload: Record<string, unknown>, authUser: AuthUser) {
  ensureNoUnknownFields(payload || {}, ['paymentProfileId'], 'payload');
  const paymentProfileRef = payload?.paymentProfileId;
  if (!paymentProfileRef) {
    httpError(400, 'paymentProfileId is required', 'INVALID_REQUEST_BODY');
  }

  return await strapi.db.connection.transaction(async (trx: any) => {
    const round = await findExamRoundByRef(tenantId, roundRef, trx);
    await acquireExamRoundStructureLock(trx, tenantId, Number(round.id));
    const workflowRound = await loadExamRoundWorkflowContext(tenantId, Number(round.id), trx);
    assertExamRoundPaymentSettingsEditableRound(workflowRound);

    const paymentProfile = await findPaymentProfileInTenant(tenantId, paymentProfileRef, trx);
    if (paymentProfile.isActive === false) {
      httpError(409, 'Inactive payment profile cannot be applied.', 'PAYMENT_PROFILE_INACTIVE_CANNOT_BE_DEFAULT');
    }

    const now = new Date();
    const registrations = await countExistingRegistrationsForRound(tenantId, Number(round.id), trx);
    const warnings: Array<{ code: string; message: string }> = [];
    if (registrations > 0) {
      warnings.push({
        code: 'EXAM_ROUND_PAYMENT_SNAPSHOT_HAS_REGISTRATIONS',
        message: 'Thay đổi chỉ áp dụng cho hồ sơ đăng ký được tạo sau thời điểm cập nhật. Các hồ sơ đã tồn tại cần snapshot riêng ở bước tiếp theo.',
      });
    }

    await strapi.db.query(EXAM_ROUND_UID).update({
      where: { id: Number(round.id) },
      data: {
        paymentProfile: Number(paymentProfile.id),
        ...buildPaymentSnapshotFromProfile(paymentProfile),
        paymentProfileCustomized: false,
        paymentProfileAppliedAt: now,
        paymentProfileAppliedBy: authUser.id,
        paymentSettingsUpdatedAt: now,
        paymentSettingsUpdatedBy: authUser.id,
      },
      transacting: trx,
    } as any);

    const fresh = await getExamRoundManagementDetail(round.id, tenantId, trx);
    return {
      ...buildExamRoundPaymentSettingsResponse(fresh),
      ...(warnings.length > 0 ? { warnings } : {}),
    };
  });
}

export async function updateExamRoundPaymentSettings(tenantId: number, roundRef: unknown, payload: Record<string, unknown>, authUser: AuthUser) {
  const input = normalizePaymentSettingsInput(payload || {});

  return await strapi.db.connection.transaction(async (trx: any) => {
    const round = await findExamRoundByRef(tenantId, roundRef, trx);
    await acquireExamRoundStructureLock(trx, tenantId, Number(round.id));
    const workflowRound = await loadExamRoundWorkflowContext(tenantId, Number(round.id), trx);
    assertExamRoundPaymentSettingsEditableRound(workflowRound);

    const current = await getExamRoundManagementDetail(round.id, tenantId);
    const nextSnapshot = {
      paymentMethodSnapshot: hasOwn(input, 'paymentMethodSnapshot') ? input.paymentMethodSnapshot : normalizePaymentProfileMethod(current?.paymentMethodSnapshot, 'paymentMethodSnapshot', 'bank_transfer'),
      paymentBankCodeSnapshot: hasOwn(input, 'paymentBankCodeSnapshot') ? input.paymentBankCodeSnapshot : normalizeOptionalText(current?.paymentBankCodeSnapshot, 20),
      paymentBankNameSnapshot: hasOwn(input, 'paymentBankNameSnapshot') ? input.paymentBankNameSnapshot : normalizeOptionalText(current?.paymentBankNameSnapshot, 150),
      paymentAccountNumberSnapshot: hasOwn(input, 'paymentAccountNumberSnapshot') ? input.paymentAccountNumberSnapshot : normalizeOptionalText(current?.paymentAccountNumberSnapshot, 100),
      paymentAccountHolderSnapshot: hasOwn(input, 'paymentAccountHolderSnapshot') ? input.paymentAccountHolderSnapshot : normalizeOptionalText(current?.paymentAccountHolderSnapshot, 150),
      paymentBankBranchSnapshot: hasOwn(input, 'paymentBankBranchSnapshot') ? input.paymentBankBranchSnapshot : normalizeOptionalText(current?.paymentBankBranchSnapshot, 150),
      paymentCurrencySnapshot: hasOwn(input, 'paymentCurrencySnapshot') ? input.paymentCurrencySnapshot : normalizeUpperOptionalText(current?.paymentCurrencySnapshot, 10),
      paymentTransferContentTemplateSnapshot: hasOwn(input, 'paymentTransferContentTemplateSnapshot') ? input.paymentTransferContentTemplateSnapshot : normalizeOptionalText(current?.paymentTransferContentTemplateSnapshot, 255),
      paymentInstructionSnapshot: hasOwn(input, 'paymentInstructionSnapshot') ? input.paymentInstructionSnapshot : normalizeOptionalText(current?.paymentInstructionSnapshot),
      paymentSupportPhoneSnapshot: hasOwn(input, 'paymentSupportPhoneSnapshot') ? input.paymentSupportPhoneSnapshot : normalizeOptionalText(current?.paymentSupportPhoneSnapshot, 30),
      paymentSupportEmailSnapshot: hasOwn(input, 'paymentSupportEmailSnapshot') ? input.paymentSupportEmailSnapshot : normalizeEmailValue(current?.paymentSupportEmailSnapshot, 'paymentSupportEmailSnapshot'),
      paymentQrImageSnapshot: hasOwn(input, 'paymentQrImageSnapshot') ? input.paymentQrImageSnapshot : (current?.paymentQrImageSnapshot?.id ? Number(current.paymentQrImageSnapshot.id) : null),
    };

    assertPaymentSnapshotValid(nextSnapshot);

    const now = new Date();
    const registrations = await countExistingRegistrationsForRound(tenantId, Number(round.id), trx);
    const warnings: Array<{ code: string; message: string }> = [];
    if (registrations > 0) {
      warnings.push({
        code: 'EXAM_ROUND_PAYMENT_SNAPSHOT_HAS_REGISTRATIONS',
        message: 'Thay đổi chỉ áp dụng cho hồ sơ đăng ký được tạo sau thời điểm cập nhật. Các hồ sơ đã tồn tại cần snapshot riêng ở bước tiếp theo.',
      });
    }

    await strapi.db.query(EXAM_ROUND_UID).update({
      where: { id: Number(round.id) },
      data: {
        ...nextSnapshot,
        paymentProfileCustomized: true,
        paymentSettingsUpdatedAt: now,
        paymentSettingsUpdatedBy: authUser.id,
      },
      transacting: trx,
    } as any);

    const fresh = await getExamRoundManagementDetail(round.id, tenantId, trx);
    return {
      ...buildExamRoundPaymentSettingsResponse(fresh),
      ...(warnings.length > 0 ? { warnings } : {}),
    };
  });
}

export async function getExamRoundVenueRoomConfiguration(tenantId: number, roundRef: unknown) {
  const round = await loadExamRoundVenueRoomContext(tenantId, roundRef);
  const [availableVenues, availableRooms, selectedRoomScheduleCounts] = await Promise.all([
    strapi.db.query(EXAM_VENUE_UID).findMany({
      where: mergeTenantWhere({}, tenantId),
      select: ['id', 'documentId', 'code', 'name', 'shortName', 'address', 'description', 'contactName', 'contactPhone', 'isActive', 'sortOrder'],
      orderBy: [{ isActive: 'desc' }, { sortOrder: 'asc' }, { name: 'asc' }, { id: 'asc' }],
    } as any) as Promise<any[]>,
    strapi.db.query(EXAM_ROOM_UID).findMany({
      where: mergeTenantWhere({}, tenantId),
      select: ['id', 'documentId', 'code', 'name', 'floor', 'capacity', 'roomType', 'isActive', 'description', 'sortOrder'],
      populate: {
        examVenue: { select: ['id', 'documentId', 'code', 'name', 'shortName', 'address', 'description', 'contactName', 'contactPhone', 'isActive', 'sortOrder'] },
      },
      orderBy: [{ isActive: 'desc' }, { sortOrder: 'asc' }, { name: 'asc' }, { id: 'asc' }],
    } as any) as Promise<any[]>,
    countSchedulesForRoomsInRound(tenantId, Number(round.id), (round?.examRooms || []).map((item: any) => Number(item?.id || 0))),
  ]);

  const selectedVenueIds = new Set((round?.examVenues || []).map((item: any) => Number(item?.id || 0)).filter((item: number) => item > 0));
  const selectedRoomIds = new Set((round?.examRooms || []).map((item: any) => Number(item?.id || 0)).filter((item: number) => item > 0));

  const selectedRooms = (round?.examRooms || []).map((item: any) => mapExamRoomConfigurationItem(item, {
    selected: true,
    scheduleCount: selectedRoomScheduleCounts.get(Number(item?.id || 0)) || 0,
  }));
  const selectedRoomsByVenueId = new Map<number, any[]>();
  for (const room of selectedRooms) {
    const venueId = Number(room?.examVenue?.id || 0);
    if (!venueId) continue;
    if (!selectedRoomsByVenueId.has(venueId)) selectedRoomsByVenueId.set(venueId, []);
    selectedRoomsByVenueId.get(venueId)?.push(room);
  }

  const venueRoomCounts = new Map<number, { total: number; active: number }>();
  for (const room of availableRooms || []) {
    const venueId = Number(extractRelationRef(room?.examVenue) || room?.examVenue?.id || 0);
    if (!venueId) continue;
    const bucket = venueRoomCounts.get(venueId) || { total: 0, active: 0 };
    bucket.total += 1;
    if (room?.isActive === true) bucket.active += 1;
    venueRoomCounts.set(venueId, bucket);
  }

  const selectedVenues = (round?.examVenues || []).map((item: any) => {
    const counts = venueRoomCounts.get(Number(item?.id || 0)) || { total: 0, active: 0 };
    const selectedVenueRooms = selectedRoomsByVenueId.get(Number(item?.id || 0)) || [];
    return mapExamVenueConfigurationItem(item, {
      selected: true,
      totalRoomCount: counts.total,
      activeRoomCount: counts.active,
      selectedRoomCount: selectedVenueRooms.length,
      selectedCapacity: selectedVenueRooms.reduce((total, room) => total + Math.max(0, Number(room?.capacity || 0)), 0),
    });
  });

  const mappedAvailableVenues = (availableVenues || []).map((item: any) => {
    const counts = venueRoomCounts.get(Number(item?.id || 0)) || { total: 0, active: 0 };
    const selectedVenueRooms = selectedRoomsByVenueId.get(Number(item?.id || 0)) || [];
    return mapExamVenueConfigurationItem(item, {
      selected: selectedVenueIds.has(Number(item?.id || 0)),
      totalRoomCount: counts.total,
      activeRoomCount: counts.active,
      selectedRoomCount: selectedVenueRooms.length,
      selectedCapacity: selectedVenueRooms.reduce((total, room) => total + Math.max(0, Number(room?.capacity || 0)), 0),
    });
  });
  const mappedAvailableRooms = (availableRooms || []).map((item: any) => mapExamRoomConfigurationItem(item, {
    selected: selectedRoomIds.has(Number(item?.id || 0)),
    scheduleCount: selectedRoomScheduleCounts.get(Number(item?.id || 0)) || 0,
  }));

  const readiness = buildVenueRoomReadiness(round, selectedVenues, selectedRooms);

  return {
    round: {
      id: Number(round.id),
      documentId: round.documentId || null,
      code: normalizeText(round.code),
      name: normalizeText(round.name),
      status: normalizeText(round.status).toLowerCase() || null,
    },
    selectedVenues,
    selectedRooms,
    availableVenues: mappedAvailableVenues,
    availableRooms: mappedAvailableRooms,
    readiness,
  };
}

export async function updateExamRoundVenuesRooms(tenantId: number, roundRef: unknown, payload: Record<string, unknown>, authUser: AuthUser) {
  const input = normalizeVenueRoomConfigurationInput(payload || {});

  return await strapi.db.connection.transaction(async (trx: any) => {
    const initialRound = await findExamRoundByRef(tenantId, roundRef, trx);
    await acquireExamRoundStructureLock(trx, tenantId, Number(initialRound.id));
    const round = await loadExamRoundVenueRoomContext(tenantId, Number(initialRound.id), trx);

    const selectedVenues = [] as any[];
    for (const venueId of input.venueIds) {
      const venue = await loadExamVenueInTenant(tenantId, venueId, trx);
      if (venue?.isActive !== true) {
        httpError(409, 'Exam venue is inactive.', 'EXAM_VENUE_INACTIVE');
      }
      selectedVenues.push(venue);
    }

    const selectedVenueIds = new Set(selectedVenues.map((item) => Number(item.id)));
    const selectedRooms = [] as any[];
    for (const roomId of input.roomIds) {
      const room = await loadExamRoomInTenant(tenantId, roomId, trx);
      if (room?.isActive !== true) {
        httpError(409, 'Exam room is inactive.', 'EXAM_ROOM_INACTIVE');
      }
      if (room?.examVenue?.isActive !== true) {
        httpError(409, 'Exam venue is inactive.', 'EXAM_VENUE_INACTIVE');
      }
      const venueId = Number(extractRelationRef(room?.examVenue) || room?.examVenue?.id || 0);
      if (!selectedVenueIds.has(venueId)) {
        httpError(409, 'Exam room does not belong to selected venues.', 'EXAM_ROOM_NOT_IN_SELECTED_VENUE', { roomId, examVenueId: venueId });
      }
      if (Number(room?.capacity || 0) < 0) {
        httpError(409, 'Exam room capacity is invalid.', 'EXAM_ROOM_INVALID_CAPACITY', { roomId });
      }
      selectedRooms.push(room);
    }

    const currentVenueIds = new Set<number>((round?.examVenues || []).map((item: any) => Number(item?.id || 0)).filter((item: number) => item > 0));
    const currentRoomIds = new Set<number>((round?.examRooms || []).map((item: any) => Number(item?.id || 0)).filter((item: number) => item > 0));
    const removedVenueIds = Array.from(currentVenueIds).filter((item: number) => !selectedVenueIds.has(item));
    const removedRoomIds = Array.from(currentRoomIds).filter((item: number) => !input.roomIds.includes(item));

    const [removedVenueScheduleCounts, removedRoomScheduleCounts] = await Promise.all([
      countSchedulesForVenuesInRound(tenantId, Number(round.id), removedVenueIds, trx),
      countSchedulesForRoomsInRound(tenantId, Number(round.id), removedRoomIds, trx),
    ]);

    const blockedVenueId = removedVenueIds.find((venueId) => (removedVenueScheduleCounts.get(venueId) || 0) > 0);
    if (blockedVenueId) {
      httpError(409, 'Exam venue is in use by schedules of this round.', 'EXAM_VENUE_IN_USE_BY_EXAM_SCHEDULE', { venueId: blockedVenueId });
    }

    const blockedRoomId = removedRoomIds.find((roomId) => (removedRoomScheduleCounts.get(roomId) || 0) > 0);
    if (blockedRoomId) {
      httpError(409, 'Exam room is in use by schedules of this round.', 'EXAM_ROOM_IN_USE_BY_EXAM_SCHEDULE', { roomId: blockedRoomId });
    }

    await strapi.db.query(EXAM_ROUND_UID).update({
      where: { id: Number(round.id) },
      data: {
        examVenues: input.venueIds,
        examRooms: input.roomIds,
      },
      transacting: trx,
    } as any);

    strapi.log.info(`[exam-round-management] exam_round.venues_rooms_updated ${JSON.stringify({ tenantId, examRoundId: Number(round.id), actorUserId: Number(authUser.id || 0), venueIds: input.venueIds, roomIds: input.roomIds, timestamp: new Date().toISOString() })}`);

    return await getExamRoundVenueRoomConfiguration(tenantId, Number(round.id));
  });
}

export async function createExamVenueForRound(tenantId: number, roundRef: unknown, payload: Record<string, unknown>, authUser: AuthUser) {
  await findExamRoundByRef(tenantId, roundRef);
  return await createExamVenueMaster(tenantId, payload, authUser);
}

export async function createExamRoomForRound(tenantId: number, roundRef: unknown, payload: Record<string, unknown>, authUser: AuthUser) {
  await findExamRoundByRef(tenantId, roundRef);
  return await createExamRoomMaster(tenantId, payload, authUser);
}

export async function createLearnerProfileForExamRound(ctx: any, tenantId: number, roundRef: unknown, payload: Record<string, unknown>, authUser: AuthUser) {
  const input = normalizeCreateLearnerProfileInput(payload || {});

  return await strapi.db.connection.transaction(async (trx: any) => {
    const userProfile = await loadPortalUserProfile(Number(authUser.id), trx);
    if (input.email !== userProfile.email) {
      httpError(400, 'email is invalid', 'INVALID_EMAIL');
    }

    const initialRound = await findExamRoundByRef(tenantId, roundRef, trx);
    await acquireExamRoundStructureLock(trx, tenantId, Number(initialRound.id));
    await acquireLearnerProfileUserLock(trx, tenantId, Number(authUser.id));
    await acquireLearnerCodeLock(trx, tenantId, input.code);

    const context = await buildLearnerProfileContext(ctx, tenantId, Number(initialRound.id), authUser, { transacting: trx });

    if (context.learner?.id) {
      return {
        learner: context.learner,
        nextStep: 'registration',
        messageCode: 'LEARNER_ALREADY_LINKED_TO_USER',
      };
    }

    if (normalizeText(context.examRound.registrationMode).toLowerCase() !== 'open') {
      httpError(403, 'Learner creation is not allowed for restricted round.', 'LEARNER_CREATION_NOT_ALLOWED_FOR_RESTRICTED_ROUND');
    }

    if (!context.canCreateLearnerForRound) {
      httpError(409, 'Learner profile cannot be created for this exam round right now.', context.reasonCode || 'LEARNER_PROFILE_REQUIRED');
    }

    const existingByCode = await findLearnerByCodeInTenant(tenantId, input.code, trx);
    if (existingByCode?.id) {
      const linkedUserId = Number(extractRelationRef(existingByCode.user) || existingByCode.user?.id || 0);
      if (linkedUserId > 0 && linkedUserId === Number(authUser.id)) {
        return {
          learner: mapCurrentLearnerProfile({
            id: Number(existingByCode.id),
            documentId: existingByCode.documentId || null,
            code: normalizeText(existingByCode.code),
            fullName: normalizeText(existingByCode.fullName),
            dateOfBirth: normalizeStoredDateTime(existingByCode.dateOfBirth) || normalizeText(existingByCode.dateOfBirth) || null,
            learnerStatus: normalizeText(existingByCode.learnerStatus) || 'active',
            className: null,
            cohort: null,
            major: null,
          }),
          nextStep: 'registration',
          messageCode: 'LEARNER_ALREADY_LINKED_TO_USER',
        };
      }

      if (linkedUserId > 0) {
        httpError(409, 'Learner already belongs to another user.', 'LEARNER_ALREADY_LINKED_TO_ANOTHER_USER');
      }

      httpError(409, 'Learner exists and requires manual linking.', 'LEARNER_REQUIRES_MANUAL_LINKING');
    }

    const suspiciousDuplicate = await findPotentialDuplicateLearnerInTenant(tenantId, input, trx);
    if (suspiciousDuplicate?.id) {
      httpError(409, 'Potential learner duplicate requires manual review.', 'LEARNER_DUPLICATE_SUSPECTED');
    }

    try {
      const created = await strapi.db.query(LEARNER_UID).create({
        data: {
          code: input.code,
          fullName: input.fullName,
          dateOfBirth: input.dateOfBirth,
          parentPhone: input.phone,
          learnerStatus: 'active',
          user: Number(authUser.id),
          tenant: tenantId,
        },
        select: ['id', 'documentId', 'code', 'fullName', 'dateOfBirth'],
        transacting: trx,
      } as any) as any;

      if (!created?.id) {
        httpError(409, 'Learner creation failed.', 'CONCURRENT_LEARNER_CREATION');
      }

      strapi.log.info(`[learner-profile] learner_profile.created_for_exam_round ${JSON.stringify({ tenantId, examRoundId: Number(initialRound.id), learnerId: Number(created.id), userId: Number(authUser.id), code: input.code, timestamp: new Date().toISOString() })}`);

      return {
        learner: {
          id: Number(created.id),
          documentId: created.documentId || null,
          code: normalizeText(created.code),
          fullName: normalizeText(created.fullName),
          dateOfBirth: normalizeStoredDateTime(created.dateOfBirth) || normalizeText(created.dateOfBirth) || null,
        },
        nextStep: 'registration',
      };
    } catch (error: any) {
      if (error instanceof HttpError) throw error;
      if (isUniqueViolation(error)) {
        httpError(409, 'Learner code already exists in this tenant.', 'LEARNER_CODE_ALREADY_EXISTS');
      }
      if (String(error?.message || '').toLowerCase().includes('learner code already exists')) {
        httpError(409, 'Learner code already exists in this tenant.', 'LEARNER_CODE_ALREADY_EXISTS');
      }
      throw error;
    }
  });
}

export async function getMyExamRoundRegistrationContext(ctx: any, tenantId: number, roundRef: unknown, _authUser: AuthUser) {
  return getLearnerRegistrationOptions(ctx, tenantId, roundRef, _authUser);
}

export async function getLearnerRegistrationOptions(ctx: any, tenantId: number, roundRef: unknown, _authUser: AuthUser) {
  const round = await findExamRoundByRef(tenantId, roundRef);
  const learner = await resolveCurrentLearner(ctx, tenantId);
  const workflowRound = await loadExamRoundWorkflowContext(tenantId, Number(round.id));
  const structure = await loadExamRoundStructure(tenantId, Number(round.id), undefined, { requireDraft: false });
  const availability = buildRegistrationAvailabilityResult(workflowRound, structure);
  const eligibility = await findLearnerEligibilityForRound(tenantId, Number(round.id), learner.id);
  const eligibilityDecision = evaluateLearnerEligibility(workflowRound, eligibility);
  const existingRegistration = await findExistingEffectiveRegistration(tenantId, Number(round.id), learner.id);
  const defaultSelection = buildDefaultSelection(structure);
  const feePreview = calculateFeeSummary(workflowRound, defaultSelection);
  return buildLearnerRegistrationOptionsResponse({
    workflowRound,
    learner,
    eligibilityDecision,
    existingRegistration,
    availability,
    structure,
    feePreview,
  });
}

export async function getLearnerExamRegistrationDetail(ctx: any, tenantId: number, registrationRef: unknown, _authUser: AuthUser) {
  const learner = await resolveCurrentLearner(ctx, tenantId);
  const registration = await loadLearnerRegistrationInTenant(tenantId, registrationRef, learner.id);
  return {
    user: mapPortalUser(_authUser),
    support: await loadLearnerSupportInfo(tenantId),
    ...buildLearnerExamRegistrationDetailResponse(registration),
  };
}

export async function uploadPaymentEvidenceForRegistration(ctx: any, tenantId: number, registrationRef: unknown, file: any, authUser: AuthUser) {
  assertPaymentEvidenceUploadValid(file);
  const learner = await resolveCurrentLearner(ctx, tenantId);
  const registration = await loadLearnerRegistrationInTenant(tenantId, registrationRef, learner.id);
  assertLearnerPaymentReportAllowed(registration);

  const tenant = await loadTenantStorageUploadContext(tenantId);
  const uploaded = await storageService.uploadLocalFile({
    tenant,
    file,
    moduleKey: 'exam-payment-evidence',
    entityType: EXAM_REGISTRATION_UID,
    entityId: String(registration.id),
    uploadedBy: authUser.id,
    isPublic: false,
    metadata: {
      runType: 'learner-payment-report',
      registrationId: Number(registration.id),
      tenantId,
    },
  });

  return {
    paymentEvidence: mapFileAssetSummary(uploaded),
  };
}

export async function reportLearnerPaymentForRegistration(ctx: any, tenantId: number, registrationRef: unknown, payload: Record<string, unknown>, authUser: AuthUser) {
  const input = normalizeReportPaymentInput(payload || {});

  return await strapi.db.connection.transaction(async (trx: any) => {
    const learner = await resolveCurrentLearner(ctx, tenantId, { transacting: trx });
    const registration = await loadLearnerRegistrationInTenant(tenantId, registrationRef, learner.id, trx);
    await acquireLearnerPaymentReportLock(trx, tenantId, Number(registration.id));

    const refreshed = await loadLearnerRegistrationInTenant(tenantId, registrationRef, learner.id, trx);
    assertLearnerPaymentReportAllowed(refreshed);

    const paymentEvidence = input.paymentEvidenceId
      ? await findLearnerOwnedPaymentEvidence(tenantId, authUser.id, input.paymentEvidenceId, trx)
      : null;

    const now = new Date();
    const updated = await strapi.db.query(EXAM_REGISTRATION_UID).update({
      where: { id: Number(refreshed.id) },
      data: {
        paymentStatus: 'payment_reported',
        paymentReportedAt: now,
        paymentReportedBy: authUser.id,
        paymentReportNote: input.paymentReportNote,
        paymentTransferAt: input.paymentTransferAt,
        paymentSenderName: input.paymentSenderName,
        paymentSenderAccount: input.paymentSenderAccount,
        paymentSenderBank: input.paymentSenderBank,
        paymentTransactionReference: input.paymentTransactionReference,
        paymentEvidence: paymentEvidence?.id ? Number(paymentEvidence.id) : null,
        paymentReportUpdatedAt: now,
      },
      transacting: trx,
    } as any) as any;

    if (!updated?.id) {
      httpError(409, 'Không thể ghi nhận thông báo chuyển tiền.', 'CONCURRENT_PAYMENT_REPORT');
    }

    const reportedRegistration = await loadLearnerRegistrationInTenant(tenantId, Number(refreshed.id), learner.id, trx);

    strapi.log.info(`[exam-registration] exam_registration.payment_reported_by_learner ${JSON.stringify({
      tenantId,
      registrationId: Number(reportedRegistration.id),
      registrationCode: normalizeText(reportedRegistration.registrationCode),
      learnerId: learner.id,
      actorUserId: authUser.id,
      paymentStatus: 'payment_reported',
      paymentTransferAt: input.paymentTransferAt,
      hasEvidence: Boolean(paymentEvidence?.id),
      timestamp: now.toISOString(),
    })}`);

    return {
      registration: {
        id: Number(reportedRegistration.id),
        documentId: reportedRegistration.documentId || null,
        registrationCode: normalizeText(reportedRegistration.registrationCode),
        paymentStatus: normalizeText(reportedRegistration.paymentStatus).toLowerCase() || 'payment_reported',
        paymentReportedAt: normalizeStoredDateTime(reportedRegistration.paymentReportedAt),
      },
      paymentReport: buildPaymentReportSummary(reportedRegistration),
      detailPath: buildTenantPath(normalizeText(ctx?.state?.tenant?.code || ctx?.state?.tenantCode || ''), `/learner/exam-registrations/${Number(reportedRegistration.id)}`),
    };
  });
}

export async function getExamRoundPaymentSummary(tenantId: number, roundRef: unknown, _authUser: AuthUser) {
  const round = await findExamRoundInTenantForPayment(tenantId, roundRef);
  const summaryRow = await strapi.db.connection('exam_registrations as registration')
    .where('registration.tenant_scope_id', tenantId)
    .andWhere('registration.exam_round_scope_id', Number(round.id))
    .whereNotIn('registration.registration_status', ['cancelled', 'rejected'])
    .select([
      strapi.db.connection.raw('count(*)::int as "totalRegistrations"'),
      strapi.db.connection.raw('count(*) filter (where coalesce(registration.amount_due, registration.payable_amount, 0) > 0)::int as "paymentRequired"'),
      strapi.db.connection.raw(`count(*) filter (where registration.payment_status = 'not_required')::int as "notRequired"`),
      strapi.db.connection.raw(`count(*) filter (where registration.payment_status = 'unpaid')::int as "unpaid"`),
      strapi.db.connection.raw(`count(*) filter (where registration.payment_status = 'payment_reported')::int as "reported"`),
      strapi.db.connection.raw(`count(*) filter (where registration.payment_status = 'paid')::int as "confirmed"`),
      strapi.db.connection.raw(`count(*) filter (where registration.payment_status = 'payment_rejected')::int as "rejected"`),
      strapi.db.connection.raw('coalesce(sum(case when coalesce(registration.amount_due, registration.payable_amount, 0) > 0 then coalesce(registration.amount_due, registration.payable_amount, 0) else 0 end), 0) as "amountDueTotal"'),
      strapi.db.connection.raw(`coalesce(sum(case when registration.payment_status = 'paid' then coalesce(registration.amount_due, registration.payable_amount, 0) else 0 end), 0) as "amountConfirmedTotal"`),
      strapi.db.connection.raw(`coalesce(sum(case when registration.payment_status = 'payment_reported' then coalesce(registration.amount_due, registration.payable_amount, 0) else 0 end), 0) as "amountPendingConfirmation"`),
    ])
    .first() as any;

  return {
    totalRegistrations: Number(summaryRow?.totalRegistrations || 0),
    paymentRequired: Number(summaryRow?.paymentRequired || 0),
    notRequired: Number(summaryRow?.notRequired || 0),
    unpaid: Number(summaryRow?.unpaid || 0),
    reported: Number(summaryRow?.reported || 0),
    confirmed: Number(summaryRow?.confirmed || 0),
    rejected: Number(summaryRow?.rejected || 0),
    amountDueTotal: toMoney(summaryRow?.amountDueTotal, 0),
    amountConfirmedTotal: toMoney(summaryRow?.amountConfirmedTotal, 0),
    amountPendingConfirmation: toMoney(summaryRow?.amountPendingConfirmation, 0),
  };
}

export async function listExamRoundPayments(tenantId: number, roundRef: unknown, rawQuery: Record<string, unknown>, _authUser: AuthUser) {
  const round = await findExamRoundInTenantForPayment(tenantId, roundRef);
  const query = normalizeExamRoundPaymentListQuery(rawQuery || {});

  const builder = strapi.db.connection('exam_registrations as registration')
    .leftJoin('exam_registrations_payment_evidence_lnk as evidence_link', 'evidence_link.exam_registration_id', 'registration.id')
    .where('registration.tenant_scope_id', tenantId)
    .andWhere('registration.exam_round_scope_id', Number(round.id));

  if (query.keyword) {
    builder.andWhere((subBuilder: any) => {
      subBuilder
        .whereILike('registration.registration_code', `%${query.keyword}%`)
        .orWhereILike('registration.student_code_snapshot', `%${query.keyword}%`)
        .orWhereILike('registration.full_name_snapshot', `%${query.keyword}%`)
        .orWhereILike('registration.payment_sender_name', `%${query.keyword}%`)
        .orWhereILike('registration.payment_transaction_reference', `%${query.keyword}%`)
        .orWhereILike('registration.payment_transfer_content', `%${query.keyword}%`);
    });
  }

  if (query.paymentStatus) builder.andWhere('registration.payment_status', query.paymentStatus);
  if (query.registrationStatus) builder.andWhere('registration.registration_status', query.registrationStatus);
  if (query.paymentMethod) builder.andWhere('registration.payment_method_snapshot', query.paymentMethod);
  if (query.hasEvidence === true) builder.whereNotNull('evidence_link.file_asset_id');
  if (query.hasEvidence === false) builder.whereNull('evidence_link.file_asset_id');
  if (query.reportedFrom) builder.andWhere('registration.payment_reported_at', '>=', query.reportedFrom);
  if (query.reportedTo) builder.andWhere('registration.payment_reported_at', '<=', query.reportedTo);
  if (query.confirmedFrom) builder.andWhere('registration.payment_confirmed_at', '>=', query.confirmedFrom);
  if (query.confirmedTo) builder.andWhere('registration.payment_confirmed_at', '<=', query.confirmedTo);

  const countBuilder = builder.clone().clearSelect().clearOrder().countDistinct({ count: 'registration.id' }).first();

  const rows = await builder
    .select(
      'registration.id',
      strapi.db.connection.raw('registration.document_id as "documentId"'),
      strapi.db.connection.raw('registration.registration_code as "registrationCode"'),
      strapi.db.connection.raw('registration.student_code_snapshot as "studentCodeSnapshot"'),
      strapi.db.connection.raw('registration.full_name_snapshot as "fullNameSnapshot"'),
      strapi.db.connection.raw('registration.amount_due as "amountDue"'),
      strapi.db.connection.raw('registration.payable_amount as "payableAmount"'),
      'registration.currency',
      strapi.db.connection.raw('registration.payment_status as "paymentStatus"'),
      strapi.db.connection.raw('registration.registration_status as "registrationStatus"'),
      strapi.db.connection.raw('registration.payment_reported_at as "paymentReportedAt"'),
      strapi.db.connection.raw('registration.payment_transfer_at as "paymentTransferAt"'),
      strapi.db.connection.raw('registration.payment_sender_name as "paymentSenderName"'),
      strapi.db.connection.raw('registration.payment_sender_bank as "paymentSenderBank"'),
      strapi.db.connection.raw('registration.payment_sender_account as "paymentSenderAccount"'),
      strapi.db.connection.raw('registration.payment_transaction_reference as "paymentTransactionReference"'),
      strapi.db.connection.raw('registration.payment_confirmed_at as "paymentConfirmedAt"'),
      strapi.db.connection.raw('registration.payment_rejected_at as "paymentRejectedAt"'),
      strapi.db.connection.raw('registration.updated_at as "updatedAt"'),
      strapi.db.connection.raw('case when evidence_link.file_asset_id is not null then true else false end as "hasEvidence"'),
    )
    .orderByRaw(`case registration.payment_status when 'payment_reported' then 0 when 'unpaid' then 1 when 'paid' then 2 when 'payment_rejected' then 3 when 'not_required' then 4 else 5 end asc`)
    .orderBy('registration.payment_reported_at', 'desc')
    .orderBy('registration.updated_at', 'desc')
    .orderBy('registration.id', 'desc')
    .offset((query.page - 1) * query.pageSize)
    .limit(query.pageSize);

  const totalRow = await countBuilder;
  const total = Number(totalRow?.count || 0) || 0;

  return {
    data: (rows || []).map(mapExamRoundPaymentListItem),
    meta: {
      pagination: {
        page: query.page,
        pageSize: query.pageSize,
        total,
        pageCount: Math.max(1, Math.ceil(total / query.pageSize)),
      },
    },
  };
}

export async function getExamRoundPaymentDetail(tenantId: number, roundRef: unknown, registrationRef: unknown, _authUser: AuthUser) {
  const { registration } = await loadExamRegistrationInRoundForTenant(tenantId, roundRef, registrationRef);
  return buildAdminPaymentDetailResponse(registration);
}

export async function confirmPaymentForExamRegistration(tenantId: number, roundRef: unknown, registrationRef: unknown, payload: Record<string, unknown>, authUser: AuthUser) {
  const input = normalizeConfirmPaymentInput(payload || {});

  return await strapi.db.connection.transaction(async (trx: any) => {
    const { registration } = await loadExamRegistrationInRoundForTenant(tenantId, roundRef, registrationRef, trx);
    await acquireLearnerPaymentReportLock(trx, tenantId, Number(registration.id));

    const refreshed = (await loadExamRegistrationInRoundForTenant(tenantId, roundRef, registrationRef, trx)).registration;
    assertAdminPaymentConfirmAllowed(refreshed);

    const now = new Date();
    const updated = await strapi.db.query(EXAM_REGISTRATION_UID).update({
      where: { id: Number(refreshed.id) },
      data: {
        paymentStatus: 'paid',
        paymentConfirmedAt: now,
        paymentConfirmedBy: authUser.id,
        paymentConfirmationNote: input.confirmationNote,
        confirmedPaidAmount: moneyToStorageString(toMoney(refreshed.amountDue ?? refreshed.payableAmount, 0)),
      },
      transacting: trx,
    } as any) as any;

    if (!updated?.id) {
      httpError(409, 'Trạng thái thanh toán đã được người khác cập nhật.', 'CONCURRENT_PAYMENT_UPDATE');
    }

    const nextRegistration = (await loadExamRegistrationInRoundForTenant(tenantId, roundRef, registrationRef, trx)).registration;
    strapi.log.info(`[exam-registration] exam_registration.payment_confirmed ${JSON.stringify({ tenantId, registrationId: Number(nextRegistration.id), actorUserId: authUser.id, fromStatus: normalizeText(refreshed.paymentStatus).toLowerCase(), toStatus: 'paid', timestamp: now.toISOString() })}`);
    return {
      registration: buildAdminPaymentDetailResponse(nextRegistration).registration,
      paymentReport: buildAdminPaymentDetailResponse(nextRegistration).paymentReport,
    };
  });
}

export async function rejectPaymentReportForExamRegistration(tenantId: number, roundRef: unknown, registrationRef: unknown, payload: Record<string, unknown>, authUser: AuthUser) {
  const input = normalizeRejectPaymentReportInput(payload || {});

  return await strapi.db.connection.transaction(async (trx: any) => {
    const { registration } = await loadExamRegistrationInRoundForTenant(tenantId, roundRef, registrationRef, trx);
    await acquireLearnerPaymentReportLock(trx, tenantId, Number(registration.id));

    const refreshed = (await loadExamRegistrationInRoundForTenant(tenantId, roundRef, registrationRef, trx)).registration;
    assertAdminPaymentRejectAllowed(refreshed);

    const now = new Date();
    const updated = await strapi.db.query(EXAM_REGISTRATION_UID).update({
      where: { id: Number(refreshed.id) },
      data: {
        paymentStatus: 'payment_rejected',
        paymentRejectedAt: now,
        paymentRejectedBy: authUser.id,
        paymentRejectionReason: input.reason,
      },
      transacting: trx,
    } as any) as any;

    if (!updated?.id) {
      httpError(409, 'Trạng thái thanh toán đã được người khác cập nhật.', 'CONCURRENT_PAYMENT_UPDATE');
    }

    const nextRegistration = (await loadExamRegistrationInRoundForTenant(tenantId, roundRef, registrationRef, trx)).registration;
    strapi.log.info(`[exam-registration] exam_registration.payment_report_rejected ${JSON.stringify({ tenantId, registrationId: Number(nextRegistration.id), actorUserId: authUser.id, fromStatus: normalizeText(refreshed.paymentStatus).toLowerCase(), toStatus: 'payment_rejected', timestamp: now.toISOString() })}`);
    return {
      registration: buildAdminPaymentDetailResponse(nextRegistration).registration,
      paymentReport: buildAdminPaymentDetailResponse(nextRegistration).paymentReport,
    };
  });
}

export async function registerCurrentLearnerForExamRound(ctx: any, tenantId: number, roundRef: unknown, payload: Record<string, unknown>, authUser: AuthUser) {
  const input = normalizeSelfRegistrationInput(payload || {});

  try {
    const result = await strapi.db.connection.transaction(async (trx: any) => {
      const initialRound = await findExamRoundByRef(tenantId, roundRef, trx);
      const learner = await resolveCurrentLearner(ctx, tenantId, { transacting: trx });
      assertLearnerProfileComplete(learner);

      await acquireLearnerRegistrationLock(trx, tenantId, Number(initialRound.id), learner.id);

      const workflowRound = await loadExamRoundWorkflowContext(tenantId, Number(initialRound.id), trx);
      const structure = await loadExamRoundStructure(tenantId, Number(initialRound.id), trx, { requireDraft: false });
      const availability = buildRegistrationAvailabilityResult(workflowRound, structure);
      if (!availability.canRegister) {
        throwRegistrationAvailabilityError(availability.reasonCode || 'EXAM_ROUND_NOT_READY_FOR_REGISTRATION');
      }

      const eligibility = await findLearnerEligibilityForRound(tenantId, Number(initialRound.id), learner.id, trx);
      const eligibilityDecision = evaluateLearnerEligibility(workflowRound, eligibility);
      if (!eligibilityDecision.canRegister) {
        throwEligibilityDecisionError(eligibilityDecision);
      }

      const existingRegistration = await findExistingEffectiveRegistration(tenantId, Number(initialRound.id), learner.id, trx);
      if (existingRegistration?.id) {
        httpError(409, 'Learner đã có đăng ký dự thi đang hiệu lực trong đợt này.', 'EXAM_REGISTRATION_ALREADY_EXISTS', {
          registration: mapExistingRegistrationSummary(existingRegistration),
        });
      }

      const selectedSubjects = resolveSubjectSelection(structure, input);
      const selectedSubjectComponents = resolveComponentSelection(structure, selectedSubjects, input);
      const feeSummary = calculateFeeSummary(workflowRound, selectedSubjectComponents);
      const registrationCode = await generateRegistrationCode(tenantId, trx);
      const registeredAt = new Date();
      const paymentSnapshot = buildRegistrationPaymentSnapshot(workflowRound, learner, registrationCode, feeSummary);
      const paymentDueAt = normalizeStoredDateTime(workflowRound.paymentEndAt);

      const createdRegistration = await strapi.db.query(EXAM_REGISTRATION_UID).create({
        data: {
          registrationCode,
          examRound: Number(initialRound.id),
          learner: learner.id,
          registeredAt,
          registrationSource: 'learner',
          registrationStatus: 'submitted',
          eligibilityStatus: 'eligible',
          paymentStatus: feeSummary.paymentStatus,
          paymentCalculationMethodSnapshot: feeSummary.calculationMethod,
          fixedFeeSnapshot: feeSummary.fixedFee === null ? null : moneyToStorageString(feeSummary.fixedFee),
          subjectFeeTotalSnapshot: moneyToStorageString(feeSummary.subjectFeeTotal),
          componentFeeTotalSnapshot: moneyToStorageString(feeSummary.componentFeeTotal),
          calculatedAmount: moneyToStorageString(feeSummary.calculatedAmount),
          discountAmount: moneyToStorageString(feeSummary.discountAmount),
          payableAmount: moneyToStorageString(feeSummary.payableAmount),
          amountDue: moneyToStorageString(feeSummary.payableAmount),
          currency: paymentSnapshot.currency || feeSummary.currency,
          paymentDueAt: paymentDueAt || null,
          confirmedPaidAmount: moneyToStorageString(feeSummary.confirmedPaidAmount),
          studentCodeSnapshot: learner.code,
          fullNameSnapshot: learner.fullName,
          classNameSnapshot: learner.className,
          cohortSnapshot: learner.cohort,
          majorSnapshot: learner.major,
          paymentMethodSnapshot: paymentSnapshot.paymentMethod,
          paymentProfileNameSnapshot: paymentSnapshot.paymentProfileName,
          paymentProfileCodeSnapshot: paymentSnapshot.paymentProfileCode,
          paymentBankCodeSnapshot: paymentSnapshot.bankCode,
          paymentBankNameSnapshot: paymentSnapshot.bankName,
          paymentAccountNumberSnapshot: paymentSnapshot.accountNumber,
          paymentAccountHolderSnapshot: paymentSnapshot.accountHolder,
          paymentBankBranchSnapshot: paymentSnapshot.bankBranch,
          paymentTransferContentTemplateSnapshot: paymentSnapshot.transferContentTemplate,
          paymentTransferContent: paymentSnapshot.transferContent,
          paymentInstructionSnapshot: paymentSnapshot.paymentInstruction,
          paymentSupportPhoneSnapshot: paymentSnapshot.supportPhone,
          paymentSupportEmailSnapshot: paymentSnapshot.supportEmail,
          paymentQrImageSnapshot: paymentSnapshot.qrImage?.id ? Number(paymentSnapshot.qrImage.id) : null,
          note: input.note,
          tenant: tenantId,
        },
        select: ['id', 'documentId', 'registrationCode', 'registrationStatus', 'paymentStatus', 'registeredAt'],
        transacting: trx,
      } as any) as any;

      if (!createdRegistration?.id) {
        httpError(409, 'Không thể tạo đăng ký dự thi.', 'EXAM_REGISTRATION_CREATE_FAILED');
      }

      await syncExamRegistrationShadowColumns(Number(createdRegistration.id), tenantId, Number(initialRound.id), learner.id, trx);

      const subjectRegistrationIds = new Map<number, number>();
      let componentCount = 0;
      for (const subjectSelection of selectedSubjectComponents) {
        const createdSubjectRegistration = await strapi.db.query(EXAM_REGISTRATION_SUBJECT_UID).create({
          data: {
            examRegistration: Number(createdRegistration.id),
            examRoundSubject: subjectSelection.subject.id,
            subjectCodeSnapshot: subjectSelection.subject.codeSnapshot,
            nameSnapshot: subjectSelection.subject.nameSnapshot,
            isRequiredSnapshot: subjectSelection.subject.isRequired,
            allowSeparateRegistrationSnapshot: subjectSelection.subject.allowSeparateRegistration,
            calculationMethodSnapshot: subjectSelection.subject.calculationMethodSnapshot,
            requiredAggregateScoreSnapshot: subjectSelection.subject.requiredAggregateScoreSnapshot,
            requireAllComponentsSnapshot: subjectSelection.subject.requireAllComponentsSnapshot,
            ruleDescriptionSnapshot: subjectSelection.subject.ruleDescriptionSnapshot,
            participationType: 'new_exam',
            registrationStatus: 'registered',
            feeAmount: moneyToStorageString(toMoney(subjectSelection.subject.fee, 0)),
            subjectResultStatus: 'not_evaluated',
            tenant: tenantId,
          },
          select: ['id'],
          transacting: trx,
        } as any) as any;

        if (!createdSubjectRegistration?.id) {
          httpError(409, 'Không thể tạo đăng ký môn thi.', 'EXAM_REGISTRATION_CREATE_FAILED');
        }

        subjectRegistrationIds.set(subjectSelection.subject.id, Number(createdSubjectRegistration.id));

        for (const component of subjectSelection.components) {
          const createdComponentRegistration = await strapi.db.query(EXAM_REGISTRATION_COMPONENT_UID).create({
            data: {
              examRegistration: Number(createdRegistration.id),
              examRegistrationSubject: Number(createdSubjectRegistration.id),
              examRoundComponent: component.id,
              componentCodeSnapshot: component.codeSnapshot,
              nameSnapshot: component.nameSnapshot,
              isRequiredSnapshot: component.isRequired,
              allowSeparateRegistrationSnapshot: component.allowSeparateRegistration,
              durationMinutesSnapshot: component.durationMinutes,
              examMethodSnapshot: component.examMethod,
              participationType: 'new_exam',
              registrationStatus: 'registered',
              eligibilityStatus: 'eligible',
              schedulingStatus: 'not_scheduled',
              attendanceStatus: 'not_checked_in',
              resultStatus: 'pending',
              feeAmount: moneyToStorageString(toMoney(component.fee, 0)),
              sourceResult: null,
              examSchedule: null,
              tenant: tenantId,
            },
            select: ['id'],
            transacting: trx,
          } as any) as any;

          if (!createdComponentRegistration?.id) {
            httpError(409, 'Không thể tạo đăng ký thành phần thi.', 'EXAM_REGISTRATION_CREATE_FAILED');
          }
          componentCount += 1;
        }
      }

      logLearnerRegistrationCreated({
        tenantId,
        examRoundId: Number(initialRound.id),
        learnerId: learner.id,
        registrationId: Number(createdRegistration.id),
        registrationCode,
        subjectCount: selectedSubjectComponents.length,
        componentCount,
        payableAmount: feeSummary.payableAmount,
        actorUserId: authUser.id,
        timestamp: registeredAt.toISOString(),
      });

      return {
        registration: {
          id: Number(createdRegistration.id),
          documentId: createdRegistration.documentId || null,
          registrationCode,
          registrationStatus: 'submitted',
          paymentStatus: feeSummary.paymentStatus,
          registeredAt: registeredAt.toISOString(),
          paymentDueAt,
          learner: mapLearnerSummary(learner),
          examRound: {
            id: Number(workflowRound.id),
            code: workflowRound.code,
            name: workflowRound.name,
          },
        },
        subjects: buildRegistrationResponseSubjects(selectedSubjectComponents),
        fee: buildRegistrationFeeResponse(feeSummary, paymentDueAt),
        payment: paymentSnapshot,
        detailPath: buildTenantPath(normalizeText(ctx?.state?.tenant?.code || ctx?.state?.tenantCode || ''), `/learner/exam-registrations/${Number(createdRegistration.id)}`),
        emailPayload: {
          learner,
          registrationId: Number(createdRegistration.id),
          registrationCode,
          examRoundCode: normalizeText(workflowRound.code),
          examRoundName: normalizeText(workflowRound.name),
          registeredAt: registeredAt.toISOString(),
          subjects: buildRegistrationResponseSubjects(selectedSubjectComponents),
          feeSummary,
          paymentDueAt,
          paymentSnapshot,
        },
      };
    });

    await enqueueLearnerRegistrationEmail(ctx, {
      tenantId,
      learner: result.emailPayload.learner,
      authUser,
      registrationId: result.emailPayload.registrationId,
      registrationCode: result.emailPayload.registrationCode,
      examRoundCode: result.emailPayload.examRoundCode,
      examRoundName: result.emailPayload.examRoundName,
      registeredAt: result.emailPayload.registeredAt,
      subjects: result.emailPayload.subjects,
      feeSummary: result.emailPayload.feeSummary,
      paymentDueAt: result.emailPayload.paymentDueAt,
      paymentSnapshot: result.emailPayload.paymentSnapshot,
    });

    return {
      registration: result.registration,
      subjects: result.subjects,
      fee: result.fee,
      payment: result.payment,
      detailPath: result.detailPath,
    };
  } catch (error: any) {
    if (error instanceof HttpError) throw error;
    if (isUniqueViolation(error)) {
      const initialRound = await findExamRoundByRef(tenantId, roundRef);
      const learner = await resolveCurrentLearner(ctx, tenantId);
      const existingRegistration = await findExistingEffectiveRegistration(tenantId, Number(initialRound.id), learner.id);
      httpError(409, 'Learner đã có đăng ký dự thi đang hiệu lực trong đợt này.', 'EXAM_REGISTRATION_ALREADY_EXISTS', {
        registration: mapExistingRegistrationSummary(existingRegistration),
      });
    }
    httpError(409, 'Không thể tạo đăng ký dự thi.', 'EXAM_REGISTRATION_CREATE_FAILED');
  }
}