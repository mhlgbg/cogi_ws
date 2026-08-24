import { createHash, randomBytes } from 'crypto';
import { extractRelationRef, findEntityByRef, mergeTenantWhere, normalizeSortInput, resolveCurrentTenantId, toText, whereByParam } from '../../../utils/tenant-scope';
import { finalizeExpiredAssessmentAttempt, getCandidateAssessmentResultPayloadByAttempt, startAssessmentAttempt } from '../../assessment-runtime/services/assessment-runtime';

const ASSESSMENT_CAMPAIGN_UID = 'api::assessment-campaign.assessment-campaign';
const ASSESSMENT_CAMPAIGN_FIELD_UID = 'api::assessment-campaign-field.assessment-campaign-field';
const ASSESSMENT_CAMPAIGN_RULE_UID = 'api::assessment-campaign-rule.assessment-campaign-rule';
const ASSESSMENT_CAMPAIGN_PARTICIPATION_UID = 'api::assessment-campaign-participation.assessment-campaign-participation';
const ASSESSMENT_VERSION_UID = 'api::assessment-version.assessment-version';
const ASSESSMENT_ATTEMPT_UID = 'api::assessment-attempt.assessment-attempt';
const ASSESSMENT_RESULT_UID = 'api::assessment-result.assessment-result';
const ASSESSMENT_SPEAKING_REVIEW_UID = 'api::assessment-speaking-review.assessment-speaking-review';
const ASSESSMENT_PLACEMENT_CONFIRMATION_UID = 'api::assessment-placement-confirmation.assessment-placement-confirmation';
const ASSESSMENT_UID = 'api::assessment.assessment';
const LEAD_UID = 'api::lead.lead';
const USER_UID = 'plugin::users-permissions.user';

const PUBLIC_FIELD_TYPES = new Set(['text', 'email', 'phone', 'number', 'date', 'select', 'radio', 'checkbox', 'textarea']);
const OPTION_FIELD_TYPES = new Set(['select', 'radio', 'checkbox']);
const PUBLIC_FIELD_STAGES = new Set(['before_start', 'before_result', 'optional']);
const PUBLIC_ACCESS_TTL_MS = 24 * 60 * 60 * 1000;
const OTP_DEMO_CODE = '123456';
const RETAKE_REASON_CODES = new Set(['wrong_assessment', 'technical_issue', 'test_data', 'candidate_mistake', 'admin_decision', 'other']);
const LEAD_FIELD_MAP: Record<string, string> = {
  fullName: 'fullName',
  name: 'fullName',
  studentName: 'fullName',
  phone: 'phone',
  email: 'message',
  parentEmail: 'message',
  contactEmail: 'message',
};

class AssessmentCampaignError extends Error {
  status: number;
  details: any;

  constructor(status: number, message: string, details: any = null) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

type ValidationError = {
  key: string;
  code: 'REQUIRED' | 'INVALID_TYPE' | 'INVALID_EMAIL' | 'INVALID_PHONE' | 'INVALID_DATE' | 'INVALID_OPTION' | 'INVALID_OPTIONS_CONFIG';
  message: string;
};

function extractBody(body: any) {
  if (body?.data && typeof body.data === 'object' && !Array.isArray(body.data)) return body.data;
  if (body && typeof body === 'object' && !Array.isArray(body)) return body;
  return {};
}

function normalizeId(row: any) {
  return row?.documentId || row?.id || null;
}

function normalizeDbId(row: any) {
  return row?.id || null;
}

function toNullableText(value: unknown): string | null {
  const text = toText(value);
  return text || null;
}

function ensureRequiredText(value: unknown, fieldName: string) {
  const text = toText(value);
  if (!text) throw new AssessmentCampaignError(400, `${fieldName} is required`);
  return text;
}

function parseOptionalInteger(value: unknown, fieldName: string): number | null {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(value);
  if (!Number.isInteger(parsed)) throw new AssessmentCampaignError(400, `${fieldName} must be an integer`);
  return parsed;
}

function parseRequiredInteger(value: unknown, fieldName: string): number {
  const parsed = parseOptionalInteger(value, fieldName);
  if (parsed === null) throw new AssessmentCampaignError(400, `${fieldName} is required`);
  return parsed;
}

function parseOptionalJson(value: unknown, fieldName: string) {
  if (value === undefined) return undefined;
  if (value === null || value === '') return null;
  if (typeof value === 'object') return value;
  const text = toText(value);
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    throw new AssessmentCampaignError(400, `${fieldName} must be valid JSON`);
  }
}

function parseBoolean(value: unknown, fallback = false): boolean {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value !== 0;
  const text = toText(value).toLowerCase();
  if (!text) return fallback;
  return ['true', '1', 'yes', 'on'].includes(text);
}

function buildPagination(query: any) {
  const page = Math.max(1, Number(query?.page || 1) || 1);
  const pageSize = Math.max(1, Math.min(100, Number(query?.pageSize || 10) || 10));
  const start = (page - 1) * pageSize;
  return { page, pageSize, start };
}

function mapSimpleRelation(row: any) {
  if (!row) return null;
  return {
    id: normalizeId(row),
    documentId: row?.documentId || null,
    code: row?.code || '',
    title: row?.title || row?.name || '',
    name: row?.name || row?.title || '',
  };
}

function mapLead(row: any) {
  if (!row) return null;
  return {
    id: normalizeId(row),
    documentId: row?.documentId || null,
    fullName: row?.fullName || '',
    phone: row?.phone || '',
    email: row?.message || row?.email || '',
    leadStatus: row?.leadStatus || '',
  };
}

function mapCampaignField(row: any) {
  return {
    id: normalizeId(row),
    documentId: row?.documentId || null,
    key: row?.key || '',
    label: row?.label || '',
    fieldType: row?.fieldType || 'text',
    required: row?.required === true,
    order: Number(row?.order || 0),
    placeholder: row?.placeholder || '',
    helpText: row?.helpText || '',
    options: normalizeFieldOptions(row?.options),
    collectStage: row?.collectStage || 'before_start',
    status: row?.status || 'active',
  };
}

function mapCampaignRule(row: any) {
  return {
    id: normalizeId(row),
    documentId: row?.documentId || null,
    code: row?.code || '',
    name: row?.name || '',
    priority: Number(row?.priority || 0),
    status: row?.status || 'draft',
    gradeFrom: row?.gradeFrom ?? null,
    gradeTo: row?.gradeTo ?? null,
    ageFrom: row?.ageFrom ?? null,
    ageTo: row?.ageTo ?? null,
    conditions: row?.conditions ?? null,
    assessmentVersion: mapSimpleRelation(row?.assessmentVersion),
    assessment: mapSimpleRelation(row?.assessmentVersion?.assessment),
  };
}

function isPlainObject(value: unknown) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function normalizeOptionValue(value: unknown) {
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) return null;
    return value;
  }
  const text = toText(value);
  return text || null;
}

function normalizeFieldOptions(value: unknown) {
  if (value === undefined || value === null || value === '') return null;
  const raw = Array.isArray(value) ? value : [];
  const normalized = raw
    .map((item) => {
      if (typeof item === 'string' || typeof item === 'number') {
        const scalar = normalizeOptionValue(item);
        return scalar === null ? null : { label: String(item), value: scalar };
      }
      if (!isPlainObject(item)) return null;
      const label = toText((item as any).label);
      const optionValue = normalizeOptionValue((item as any).value);
      if (!label || optionValue === null) return null;
      return { label, value: optionValue };
    })
    .filter(Boolean) as Array<{ label: string; value: string | number }>;
  return normalized.length > 0 ? normalized : [];
}

function validateFieldOptionsConfig(fieldType: string, options: unknown, key = 'options'): ValidationError[] {
  if (!OPTION_FIELD_TYPES.has(fieldType)) return [];
  if (!Array.isArray(options) || options.length === 0) {
    return [{ key, code: 'INVALID_OPTIONS_CONFIG', message: `${key} must contain at least one option` }];
  }
  const seenValues = new Set<string>();
  const errors: ValidationError[] = [];
  for (const item of options) {
    if (!isPlainObject(item)) {
      errors.push({ key, code: 'INVALID_OPTIONS_CONFIG', message: `${key} options must be objects with label and value` });
      continue;
    }
    const label = toText((item as any).label);
    const optionValue = normalizeOptionValue((item as any).value);
    if (!label || optionValue === null) {
      errors.push({ key, code: 'INVALID_OPTIONS_CONFIG', message: `${key} options must include non-empty label and value` });
      continue;
    }
    const identity = `${typeof optionValue}:${String(optionValue)}`;
    if (seenValues.has(identity)) {
      errors.push({ key, code: 'INVALID_OPTIONS_CONFIG', message: `${key} option values must be unique` });
      continue;
    }
    seenValues.add(identity);
  }
  return errors;
}

function normalizeDateOnly(value: unknown) {
  const text = toText(value);
  if (!text) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return null;
  const date = new Date(`${text}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) return null;
  const normalized = date.toISOString().slice(0, 10);
  return normalized === text ? text : null;
}

function normalizeDateTime(value: unknown) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(String(value));
  return Number.isNaN(date.getTime()) ? null : date;
}

function addMinutesToDate(date: Date, minutes: number | null) {
  if (!minutes || minutes <= 0) return null;
  return new Date(date.getTime() + minutes * 60 * 1000);
}

function resolveAttemptDeadlineState(attempt: any) {
  const storedExpiresAt = normalizeDateTime(attempt?.expiresAt);
  if (storedExpiresAt) {
    return {
      expiresAt: storedExpiresAt.toISOString(),
      deadlineSource: 'stored',
      isOverdue: storedExpiresAt.getTime() <= Date.now(),
      canPersist: false,
    };
  }
  const startedAt = normalizeDateTime(attempt?.startedAt);
  const durationMinutes = parseOptionalInteger(attempt?.durationMinutes ?? attempt?.assessmentVersion?.durationMinutes, 'durationMinutes');
  const derivedExpiresAt = startedAt && durationMinutes && durationMinutes > 0 ? addMinutesToDate(startedAt, durationMinutes) : null;
  return {
    expiresAt: derivedExpiresAt ? derivedExpiresAt.toISOString() : null,
    deadlineSource: derivedExpiresAt ? 'derived' : 'missing',
    isOverdue: derivedExpiresAt ? derivedExpiresAt.getTime() <= Date.now() : false,
    canPersist: Boolean(derivedExpiresAt),
  };
}

function resolveCurrentAttemptResult(row: any) {
  return Array.isArray(row?.assessmentAttempt?.results)
    ? row.assessmentAttempt.results.find((item: any) => item?.isCurrent !== false) || row.assessmentAttempt.results[0] || null
    : null;
}

function normalizeAssessmentCampaignFieldValue(fieldDefinition: any, rawValue: unknown): { value: any; errors: ValidationError[] } {
  const key = toText(fieldDefinition?.key);
  const fieldType = toText(fieldDefinition?.fieldType).toLowerCase();
  const options = normalizeFieldOptions(fieldDefinition?.options);
  const optionValues = new Set((options || []).map((item) => `${typeof item.value}:${String(item.value)}`));

  if (rawValue === undefined) return { value: undefined, errors: [] };

  if (fieldType === 'text' || fieldType === 'textarea' || fieldType === 'phone') {
    const text = toText(rawValue);
    if (!text) return { value: '', errors: [] };
    if (fieldType === 'phone' && !validatePhone(text)) {
      return { value: text, errors: [{ key, code: 'INVALID_PHONE', message: `${fieldDefinition?.label || key} is invalid` }] };
    }
    return { value: text, errors: [] };
  }

  if (fieldType === 'email') {
    const email = normalizeEmail(rawValue);
    if (!email) return { value: '', errors: [] };
    if (!validateEmail(email)) {
      return { value: email, errors: [{ key, code: 'INVALID_EMAIL', message: `${fieldDefinition?.label || key} is invalid` }] };
    }
    return { value: email, errors: [] };
  }

  if (fieldType === 'number') {
    if (rawValue === null || rawValue === '') return { value: null, errors: [] };
    const parsed = typeof rawValue === 'number' ? rawValue : Number(rawValue);
    if (!Number.isFinite(parsed)) {
      return { value: rawValue, errors: [{ key, code: 'INVALID_TYPE', message: `${fieldDefinition?.label || key} is invalid` }] };
    }
    return { value: parsed, errors: [] };
  }

  if (fieldType === 'date') {
    if (rawValue === null || rawValue === '') return { value: null, errors: [] };
    const normalized = normalizeDateOnly(rawValue);
    if (!normalized) {
      return { value: rawValue, errors: [{ key, code: 'INVALID_DATE', message: `${fieldDefinition?.label || key} is invalid` }] };
    }
    return { value: normalized, errors: [] };
  }

  if (fieldType === 'select' || fieldType === 'radio') {
    if (Array.isArray(rawValue)) {
      return { value: rawValue, errors: [{ key, code: 'INVALID_TYPE', message: `${fieldDefinition?.label || key} is invalid` }] };
    }
    if (rawValue === null || rawValue === '') return { value: null, errors: [] };
    const normalized = normalizeOptionValue(rawValue);
    const identity = normalized === null ? null : `${typeof normalized}:${String(normalized)}`;
    if (!identity || !optionValues.has(identity)) {
      return { value: normalized, errors: [{ key, code: 'INVALID_OPTION', message: `${fieldDefinition?.label || key} is invalid` }] };
    }
    return { value: normalized, errors: [] };
  }

  if (fieldType === 'checkbox') {
    const rawArray = Array.isArray(rawValue) ? rawValue : [];
    const normalized = Array.from(new Set(rawArray
      .map((item) => normalizeOptionValue(item))
      .filter((item) => item !== null)
      .map((item) => `${typeof item}:${String(item)}`)));
    const invalid = normalized.filter((item) => !optionValues.has(item));
    if (invalid.length > 0) {
      return { value: rawArray, errors: [{ key, code: 'INVALID_OPTION', message: `${fieldDefinition?.label || key} is invalid` }] };
    }
    return {
      value: normalized.map((identity) => {
        const [kind, ...rest] = identity.split(':');
        const merged = rest.join(':');
        return kind === 'number' ? Number(merged) : merged;
      }),
      errors: [],
    };
  }

  return { value: rawValue, errors: [{ key, code: 'INVALID_TYPE', message: `${fieldDefinition?.label || key} is invalid` }] };
}

function validateAssessmentCampaignCollectedData(fieldDefinitions: any[], submittedData: Record<string, any>, stage: string) {
  const normalizedStage = toText(stage);
  const allFields = Array.isArray(fieldDefinitions) ? fieldDefinitions.map(mapCampaignField) : [];
  const knownFieldMap = new Map<string, any>(allFields.map((field: any) => [toText(field.key), field]));
  const activeStageFields = allFields.filter((field: any) => toText(field?.status) === 'active' && toText(field?.collectStage) === normalizedStage);
  const activeStageMap = new Map<string, any>(activeStageFields.map((field: any) => [toText(field.key), field]));
  const normalizedData: Record<string, any> = {};
  const errors: ValidationError[] = [];
  const ignoredKeys: string[] = [];
  const unsupportedKeys: string[] = [];

  for (const key of Object.keys(submittedData || {})) {
    const normalizedKey = toText(key);
    const knownField = knownFieldMap.get(normalizedKey);
    const activeStageField = activeStageMap.get(normalizedKey);
    if (!knownField) {
      unsupportedKeys.push(key);
      continue;
    }
    if (!activeStageField) {
      ignoredKeys.push(key);
      continue;
    }
    const result = normalizeAssessmentCampaignFieldValue(activeStageField, submittedData[key]);
    if (result.errors.length > 0) errors.push(...result.errors);
    normalizedData[key] = result.value;
  }

  for (const field of activeStageFields) {
    const key = toText(field?.key);
    const normalized = Object.prototype.hasOwnProperty.call(normalizedData, key)
      ? normalizedData[key]
      : undefined;
    const fieldType = toText(field?.fieldType).toLowerCase();
    const empty = fieldType === 'checkbox'
      ? !Array.isArray(normalized) || normalized.length === 0
      : normalized === undefined || normalized === null || (typeof normalized === 'string' && normalized === '');
    if (field?.required === true && empty) {
      errors.push({ key, code: 'REQUIRED', message: `${field?.label || key} is required` });
    }
  }

  return {
    valid: errors.length === 0 && unsupportedKeys.length === 0,
    data: normalizedData,
    errors,
    unsupportedKeys,
    ignoredKeys,
  };
}

function mapParticipation(row: any) {
  const currentResult = resolveCurrentAttemptResult(row);
  const attemptDeadline = resolveAttemptDeadlineState({
    ...(row?.assessmentAttempt || {}),
    startedAt: row?.assessmentAttempt?.startedAt || row?.assessmentStartedAt || row?.startedAt || null,
    durationMinutes: row?.assessmentAttempt?.assessmentVersion?.durationMinutes ?? row?.assessmentVersion?.durationMinutes ?? row?.assessmentVersionSnapshot?.durationMinutes ?? null,
  });
  const displayStatus = deriveParticipationDisplayStatus(row, attemptDeadline, currentResult);
  const canFinalizeTimeout = canFinalizeParticipationTimeout(row, attemptDeadline, currentResult);
  return {
    id: normalizeId(row),
    documentId: row?.documentId || null,
    code: row?.code || '',
    status: displayStatus,
    rawStatus: row?.status || 'created',
    startedAt: row?.startedAt || null,
    verifiedAt: row?.verifiedAt || null,
    assessmentStartedAt: row?.assessmentStartedAt || null,
    submittedAt: row?.submittedAt || null,
    completedAt: row?.completedAt || null,
    lead: mapLead(row?.lead),
    matchedRule: mapCampaignRule(row?.matchedRule),
    assessmentVersion: mapSimpleRelation(row?.assessmentVersion),
    assessmentAttempt: row?.assessmentAttempt ? {
      id: normalizeId(row.assessmentAttempt),
      documentId: row.assessmentAttempt?.documentId || null,
      code: row.assessmentAttempt?.code || '',
      status: row.assessmentAttempt?.status || '',
      startedAt: row.assessmentAttempt?.startedAt || row?.assessmentStartedAt || row?.startedAt || null,
      expiresAt: attemptDeadline.expiresAt,
      deadlineSource: attemptDeadline.deadlineSource,
      durationMinutes: row?.assessmentAttempt?.assessmentVersion?.durationMinutes ?? row?.assessmentVersion?.durationMinutes ?? row?.assessmentVersionSnapshot?.durationMinutes ?? null,
      submittedAt: row.assessmentAttempt?.submittedAt || null,
      cancelledAt: row.assessmentAttempt?.cancelledAt || null,
      cancelReason: row.assessmentAttempt?.cancelReason || null,
      cancelNote: row.assessmentAttempt?.cancelNote || '',
    } : null,
    isOverdue: attemptDeadline.isOverdue,
    canFinalizeTimeout,
    retakeAllowed: row?.retakeAllowed === true,
    retakeAllowedAt: row?.retakeAllowedAt || null,
    retakeAllowedBy: mapUserSummary(row?.retakeAllowedBy) || null,
    retakeReason: row?.retakeReason || null,
    retakeNote: row?.retakeNote || '',
    retakeCount: Number(row?.retakeCount || 0),
    result: currentResult ? {
      id: normalizeId(currentResult),
      documentId: currentResult?.documentId || null,
      status: currentResult?.status || '',
      provisionalLevel: currentResult?.provisionalLevel || null,
      confirmedLevel: currentResult?.confirmedLevel || null,
    } : null,
    assessmentVersionSnapshot: row?.assessmentVersionSnapshot ?? null,
    collectedData: getCollectedData(row),
    sourceMetadata: row?.sourceMetadata ?? null,
  };
}

function mapUserSummary(row: any) {
  if (!row) return null;
  return {
    id: normalizeId(row),
    documentId: row?.documentId || null,
    username: row?.username || '',
    email: row?.email || '',
    fullName: row?.fullName || row?.username || row?.email || '',
  };
}

function mapCampaign(row: any, options: { includeChildren?: boolean } = {}) {
  return {
    id: normalizeId(row),
    documentId: row?.documentId || null,
    code: row?.code || '',
    name: row?.name || '',
    slug: row?.slug || '',
    description: row?.description || '',
    status: row?.status || 'draft',
    startAt: row?.startAt || null,
    endAt: row?.endAt || null,
    publicTitle: row?.publicTitle || '',
    publicDescription: row?.publicDescription || '',
    publicContent: row?.publicContent || '',
    successMessage: row?.successMessage || '',
    resultIntro: row?.resultIntro || '',
    settings: row?.settings ?? null,
    publicUrl: row?.slug ? `/campaign/${row.slug}` : null,
    fields: options.includeChildren && Array.isArray(row?.fields) ? row.fields.map(mapCampaignField) : undefined,
    rules: options.includeChildren && Array.isArray(row?.rules) ? row.rules.map(mapCampaignRule) : undefined,
  };
}

function mapPublicCampaign(row: any) {
  const fields = Array.isArray(row?.fields) ? row.fields.filter((item: any) => toText(item?.status) === 'active' && toText(item?.collectStage) === 'before_start') : [];
  return {
    code: row?.code || '',
    slug: row?.slug || '',
    publicTitle: row?.publicTitle || row?.name || '',
    publicDescription: row?.publicDescription || row?.description || '',
    publicContent: row?.publicContent || '',
    status: row?.status || 'draft',
    startAt: row?.startAt || null,
    endAt: row?.endAt || null,
    fields: fields.map(mapCampaignField),
  };
}

async function ensureEntityInTenant(uid: string, ref: unknown, tenantId: number | string, label: string) {
  if (ref === null || ref === undefined || ref === '') return null;
  const entity = await findEntityByRef(uid, ref, { tenant: { select: ['id', 'documentId'] } });
  if (!entity) throw new AssessmentCampaignError(400, `${label} is invalid`);
  const entityTenantRef = extractRelationRef(entity?.tenant);
  if (String(entityTenantRef || '') !== String(tenantId)) {
    throw new AssessmentCampaignError(403, `${label} does not belong to current tenant`);
  }
  return entity;
}

async function ensureAssessmentVersionForRule(ref: unknown, tenantId: number | string) {
  const entity = await ensureEntityInTenant(ASSESSMENT_VERSION_UID, ref, tenantId, 'assessmentVersion');
  if (!entity) throw new AssessmentCampaignError(400, 'assessmentVersion is required');
  return entity;
}

function ensureValidRange(from: number | null, to: number | null, label: string) {
  if (from !== null && to !== null && from > to) {
    throw new AssessmentCampaignError(400, `${label} range is invalid`);
  }
}

async function ensureCampaignCodeUnique(code: string, tenantId: number | string, existingId?: number | null) {
  const duplicate = await strapi.db.query(ASSESSMENT_CAMPAIGN_UID).findOne({ where: mergeTenantWhere({ code: { $eq: code } }, tenantId), select: ['id'] });
  if (duplicate?.id && Number(duplicate.id) !== Number(existingId || 0)) throw new AssessmentCampaignError(409, 'Assessment Campaign code already exists in this tenant');
}

async function ensureCampaignSlugUnique(slug: string, tenantId: number | string, existingId?: number | null) {
  const duplicate = await strapi.db.query(ASSESSMENT_CAMPAIGN_UID).findOne({ where: mergeTenantWhere({ slug: { $eq: slug } }, tenantId), select: ['id'] });
  if (duplicate?.id && Number(duplicate.id) !== Number(existingId || 0)) throw new AssessmentCampaignError(409, 'Assessment Campaign slug already exists in this tenant');
}

async function ensureCampaignFieldKeyUnique(campaignId: number, key: string, tenantId: number | string, existingId?: number | null) {
  const duplicate = await strapi.db.query(ASSESSMENT_CAMPAIGN_FIELD_UID).findOne({
    where: mergeTenantWhere({ assessmentCampaign: { id: { $eq: campaignId } }, key: { $eq: key } }, tenantId),
    select: ['id'],
  });
  if (duplicate?.id && Number(duplicate.id) !== Number(existingId || 0)) throw new AssessmentCampaignError(409, 'Field key already exists in this assessment campaign');
}

async function ensureCampaignRuleCodeUnique(campaignId: number, code: string, tenantId: number | string, existingId?: number | null) {
  const duplicate = await strapi.db.query(ASSESSMENT_CAMPAIGN_RULE_UID).findOne({
    where: mergeTenantWhere({ assessmentCampaign: { id: { $eq: campaignId } }, code: { $eq: code } }, tenantId),
    select: ['id'],
  });
  if (duplicate?.id && Number(duplicate.id) !== Number(existingId || 0)) throw new AssessmentCampaignError(409, 'Rule code already exists in this assessment campaign');
}

function rangesOverlap(fromA: number | null, toA: number | null, fromB: number | null, toB: number | null) {
  const leftA = fromA ?? Number.NEGATIVE_INFINITY;
  const rightA = toA ?? Number.POSITIVE_INFINITY;
  const leftB = fromB ?? Number.NEGATIVE_INFINITY;
  const rightB = toB ?? Number.POSITIVE_INFINITY;
  return leftA <= rightB && leftB <= rightA;
}

async function ensureRuleNoOverlap(data: any, tenantId: number | string, existingId?: number | null) {
  if (toText(data?.status) !== 'active') return;
  const rows = await strapi.db.query(ASSESSMENT_CAMPAIGN_RULE_UID).findMany({
    where: mergeTenantWhere({ assessmentCampaign: { id: { $eq: Number(data.assessmentCampaign) } }, status: { $eq: 'active' } }, tenantId),
    select: ['id', 'gradeFrom', 'gradeTo'],
  });
  for (const row of rows || []) {
    if (Number(row?.id || 0) === Number(existingId || 0)) continue;
    if (rangesOverlap(data?.gradeFrom ?? null, data?.gradeTo ?? null, row?.gradeFrom ?? null, row?.gradeTo ?? null)) {
      throw new AssessmentCampaignError(409, 'Assessment Campaign Rule grade range overlaps an existing active rule');
    }
  }
}

async function ensureRuleAssessmentVersionUsable(data: any, tenantId: number | string) {
  const version = await ensureAssessmentVersionForRule(data.assessmentVersion, tenantId);
  if (toText(data?.status) === 'active' && toText(version?.versionStatus) !== 'published') {
    throw new AssessmentCampaignError(409, 'Active rules must reference a published assessment version');
  }
  return version;
}

async function findCampaignOrThrow(id: unknown, tenantId: number | string, options: { includeChildren?: boolean } = {}) {
  const where = whereByParam(id);
  if (!where) throw new AssessmentCampaignError(400, 'Assessment Campaign id is invalid');
  const row = await strapi.db.query(ASSESSMENT_CAMPAIGN_UID).findOne({
    where: mergeTenantWhere(where, tenantId),
    populate: options.includeChildren ? {
      fields: { orderBy: [{ order: 'asc' }, { id: 'asc' }] },
      rules: { populate: { assessmentVersion: { populate: { assessment: { select: ['id', 'documentId', 'code', 'name'] } }, select: ['id', 'documentId', 'code', 'title', 'version', 'versionStatus'] } }, orderBy: [{ priority: 'asc' }, { id: 'asc' }] },
      participations: { select: ['id'] },
    } : undefined,
  });
  if (!row) throw new AssessmentCampaignError(404, 'Assessment Campaign not found');
  return row;
}

async function findCampaignFieldOrThrow(id: unknown, tenantId: number | string) {
  const where = whereByParam(id);
  if (!where) throw new AssessmentCampaignError(400, 'Assessment Campaign Field id is invalid');
  const row = await strapi.db.query(ASSESSMENT_CAMPAIGN_FIELD_UID).findOne({
    where: mergeTenantWhere(where, tenantId),
    populate: { assessmentCampaign: { select: ['id', 'documentId', 'code'] } },
  });
  if (!row) throw new AssessmentCampaignError(404, 'Assessment Campaign Field not found');
  return row;
}

async function findCampaignRuleOrThrow(id: unknown, tenantId: number | string) {
  const where = whereByParam(id);
  if (!where) throw new AssessmentCampaignError(400, 'Assessment Campaign Rule id is invalid');
  const row = await strapi.db.query(ASSESSMENT_CAMPAIGN_RULE_UID).findOne({
    where: mergeTenantWhere(where, tenantId),
    populate: { assessmentCampaign: { select: ['id', 'documentId', 'code'] }, assessmentVersion: { populate: { assessment: { select: ['id', 'documentId', 'code', 'name'] } }, select: ['id', 'documentId', 'code', 'title', 'version', 'versionStatus'] } },
  });
  if (!row) throw new AssessmentCampaignError(404, 'Assessment Campaign Rule not found');
  return row;
}

async function sanitizeCampaignPayload(body: any, tenantId: number | string, existing?: any) {
  const payload = extractBody(body);
  return {
    tenant: tenantId,
    code: ensureRequiredText(payload.code ?? existing?.code, 'code'),
    name: ensureRequiredText(payload.name ?? existing?.name, 'name'),
    slug: ensureRequiredText(payload.slug ?? existing?.slug, 'slug'),
    description: toNullableText(payload.description ?? existing?.description),
    status: toText(payload.status ?? existing?.status) || 'draft',
    startAt: toNullableText(payload.startAt ?? existing?.startAt),
    endAt: toNullableText(payload.endAt ?? existing?.endAt),
    publicTitle: toNullableText(payload.publicTitle ?? existing?.publicTitle),
    publicDescription: toNullableText(payload.publicDescription ?? existing?.publicDescription),
    publicContent: toNullableText(payload.publicContent ?? existing?.publicContent),
    successMessage: toNullableText(payload.successMessage ?? existing?.successMessage),
    resultIntro: toNullableText(payload.resultIntro ?? existing?.resultIntro),
    settings: parseOptionalJson(payload.settings ?? existing?.settings, 'settings'),
  };
}

async function sanitizeCampaignFieldPayload(body: any, tenantId: number | string, existing?: any) {
  const payload = extractBody(body);
  const campaign = await ensureEntityInTenant(ASSESSMENT_CAMPAIGN_UID, payload.assessmentCampaign ?? existing?.assessmentCampaign, tenantId, 'assessmentCampaign');
  if (!campaign) throw new AssessmentCampaignError(400, 'assessmentCampaign is required');
  const fieldType = toText(payload.fieldType ?? existing?.fieldType) || 'text';
  const collectStage = toText(payload.collectStage ?? existing?.collectStage) || 'before_start';
  if (!PUBLIC_FIELD_TYPES.has(fieldType)) throw new AssessmentCampaignError(400, 'INVALID_INPUT', { fields: [{ key: 'fieldType', code: 'INVALID_TYPE', message: 'fieldType is invalid' }] });
  if (!PUBLIC_FIELD_STAGES.has(collectStage)) throw new AssessmentCampaignError(400, 'INVALID_INPUT', { fields: [{ key: 'collectStage', code: 'INVALID_TYPE', message: 'collectStage is invalid' }] });
  const options = normalizeFieldOptions(parseOptionalJson(payload.options ?? existing?.options, 'options'));
  const optionErrors = validateFieldOptionsConfig(fieldType, options, 'options');
  if (optionErrors.length > 0) throw new AssessmentCampaignError(400, 'INVALID_INPUT', { fields: optionErrors });
  return {
    tenant: tenantId,
    assessmentCampaign: campaign.id,
    key: ensureRequiredText(payload.key ?? existing?.key, 'key'),
    label: ensureRequiredText(payload.label ?? existing?.label, 'label'),
    fieldType,
    required: parseBoolean(payload.required ?? existing?.required, false),
    order: parseRequiredInteger(payload.order ?? existing?.order ?? 0, 'order'),
    placeholder: toNullableText(payload.placeholder ?? existing?.placeholder),
    helpText: toNullableText(payload.helpText ?? existing?.helpText),
    options,
    collectStage,
    status: toText(payload.status ?? existing?.status) || 'active',
  };
}

async function sanitizeCampaignRulePayload(body: any, tenantId: number | string, existing?: any) {
  const payload = extractBody(body);
  const campaign = await ensureEntityInTenant(ASSESSMENT_CAMPAIGN_UID, payload.assessmentCampaign ?? existing?.assessmentCampaign, tenantId, 'assessmentCampaign');
  if (!campaign) throw new AssessmentCampaignError(400, 'assessmentCampaign is required');
  const data = {
    tenant: tenantId,
    assessmentCampaign: campaign.id,
    assessmentVersion: payload.assessmentVersion ?? existing?.assessmentVersion,
    code: ensureRequiredText(payload.code ?? existing?.code, 'code'),
    name: ensureRequiredText(payload.name ?? existing?.name, 'name'),
    priority: parseRequiredInteger(payload.priority ?? existing?.priority ?? 0, 'priority'),
    status: toText(payload.status ?? existing?.status) || 'draft',
    gradeFrom: parseOptionalInteger(payload.gradeFrom ?? existing?.gradeFrom, 'gradeFrom'),
    gradeTo: parseOptionalInteger(payload.gradeTo ?? existing?.gradeTo, 'gradeTo'),
    ageFrom: parseOptionalInteger(payload.ageFrom ?? existing?.ageFrom, 'ageFrom'),
    ageTo: parseOptionalInteger(payload.ageTo ?? existing?.ageTo, 'ageTo'),
    conditions: parseOptionalJson(payload.conditions ?? existing?.conditions, 'conditions'),
  } as any;
  ensureValidRange(data.gradeFrom, data.gradeTo, 'grade');
  ensureValidRange(data.ageFrom, data.ageTo, 'age');
  const version = await ensureRuleAssessmentVersionUsable(data, tenantId);
  data.assessmentVersion = version.id;
  await ensureRuleNoOverlap(data, tenantId, Number(existing?.id || 0) || undefined);
  return data;
}

function deriveParticipationDisplayStatus(row: any, deadline = resolveAttemptDeadlineState(row?.assessmentAttempt), currentResult = resolveCurrentAttemptResult(row)) {
  const participationStatus = toText(row?.status);
  const attemptStatus = toText(row?.assessmentAttempt?.status);
  if (attemptStatus === 'cancelled') return 'cancelled';
  if (attemptStatus === 'submitted') return participationStatus === 'completed' ? 'completed' : 'submitted';
  if (attemptStatus === 'expired') return !row?.assessmentAttempt?.submittedAt && !currentResult?.id ? 'expired_legacy' : 'expired';
  if ((attemptStatus === 'created' || attemptStatus === 'in_progress') && deadline?.isOverdue) return 'overdue';
  if (participationStatus) return participationStatus;
  return attemptStatus || 'created';
}

function canFinalizeParticipationTimeout(row: any, deadline = resolveAttemptDeadlineState(row?.assessmentAttempt), currentResult = resolveCurrentAttemptResult(row)) {
  const attemptStatus = toText(row?.assessmentAttempt?.status);
  if (attemptStatus === 'submitted' || attemptStatus === 'cancelled') return false;
  if (attemptStatus === 'expired') return Boolean(deadline?.expiresAt) && !row?.assessmentAttempt?.submittedAt && !currentResult?.id;
  return (attemptStatus === 'created' || attemptStatus === 'in_progress') && deadline?.isOverdue === true;
}

function normalizeCampaignStatus(value: unknown) {
  return toText(value).toLowerCase();
}

function isAssessmentCampaignOpen(campaign: any) {
  const status = normalizeCampaignStatus(campaign?.status);
  if (status === 'paused') return { ok: false, code: 'CAMPAIGN_PAUSED' };
  if (status !== 'active') return { ok: false, code: status === 'ended' || status === 'archived' ? 'CAMPAIGN_ENDED' : 'CAMPAIGN_NOT_STARTED' };
  const now = Date.now();
  const startAt = campaign?.startAt ? new Date(campaign.startAt).getTime() : null;
  const endAt = campaign?.endAt ? new Date(campaign.endAt).getTime() : null;
  if (startAt && startAt > now) return { ok: false, code: 'CAMPAIGN_NOT_STARTED' };
  if (endAt && endAt < now) return { ok: false, code: 'CAMPAIGN_ENDED' };
  return { ok: true, code: 'OPEN' };
}

function readFieldValue(source: Record<string, any>, key: string) {
  return source?.[key];
}

function normalizeFieldValue(field: any, value: unknown) {
  const fieldType = toText(field?.fieldType || field?.type).toLowerCase();
  if (fieldType === 'checkbox') {
    return Array.isArray(value) ? value : [];
  }
  return value === undefined ? '' : value;
}

function isEmptyNormalizedFieldValue(field: any, value: unknown) {
  const fieldType = toText(field?.fieldType).toLowerCase();
  if (fieldType === 'checkbox') return !Array.isArray(value) || value.length === 0;
  return value === undefined || value === null || (typeof value === 'string' && value === '');
}

function validateEmail(value: unknown) {
  const text = toText(value).toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(text);
}

function validatePhone(value: unknown) {
  const text = toText(value);
  return /^[0-9+\s().-]{8,20}$/.test(text);
}

function normalizeEmail(value: unknown) {
  return toText(value).toLowerCase();
}

function parseCampaignGrade(value: unknown) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed)) return { valid: false, grade: null };
  if (parsed < 1 || parsed > 12) return { valid: false, grade: parsed };
  return { valid: true, grade: parsed };
}

function validateBeforeStartFields(fields: any[], attributes: Record<string, any>) {
  const result = validateAssessmentCampaignCollectedData(fields, attributes, 'before_start');
  return result.errors.map((item) => ({ key: item.key, message: item.message }));
}

function getSourceMetadata(row: any) {
  return row?.sourceMetadata && typeof row.sourceMetadata === 'object' && !Array.isArray(row.sourceMetadata)
    ? row.sourceMetadata
    : {};
}

function getCollectedData(row: any) {
  return row?.collectedData && typeof row.collectedData === 'object' && !Array.isArray(row.collectedData)
    ? row.collectedData
    : {};
}

function readParticipationAttributes(row: any) {
  const metadata = getSourceMetadata(row);
  const nested = metadata?.attributes && typeof metadata.attributes === 'object' && !Array.isArray(metadata.attributes)
    ? metadata.attributes
    : {};
  const flat = Object.entries(metadata).reduce((result: Record<string, any>, [key, value]) => {
    if (key === 'attributes' || key.startsWith('__')) return result;
    result[key] = value;
    return result;
  }, {} as Record<string, any>);
  return { ...flat, ...nested };
}

function hashPublicAccessToken(token: string) {
  return createHash('sha256').update(String(token || '')).digest('hex');
}

function issuePublicAccessToken() {
  return randomBytes(24).toString('hex');
}

function buildParticipationSourceMetadata(existingRow: any, attributes: Record<string, any>, options: { publicAccess?: any; profile?: any } = {}) {
  const metadata = getSourceMetadata(existingRow);
  const mergedAttributes = {
    ...readParticipationAttributes(existingRow),
    ...(attributes || {}),
  };
  return {
    ...mergedAttributes,
    attributes: mergedAttributes,
    __publicAccess: options.publicAccess ?? metadata.__publicAccess ?? null,
    __profile: {
      ...(metadata.__profile && typeof metadata.__profile === 'object' ? metadata.__profile : {}),
      ...(options.profile && typeof options.profile === 'object' ? options.profile : {}),
    },
  };
}

function hasPersistableFieldValue(field: any, value: unknown) {
  if (value === undefined) return false;
  const fieldType = toText(field?.fieldType).toLowerCase();
  if (fieldType === 'checkbox') return Array.isArray(value);
  if (value === null) return false;
  if (typeof value === 'string') return value.trim() !== '';
  return true;
}

function getLeadPersistenceUpdates(submittedData: Record<string, any>, fieldDefinitions: any[], lead: any) {
  const updates: Record<string, any> = {};
  for (const field of fieldDefinitions || []) {
    const key = toText(field?.key);
    const leadField = LEAD_FIELD_MAP[key];
    if (!leadField) continue;
    if (!Object.prototype.hasOwnProperty.call(submittedData || {}, key)) continue;
    const normalizedValue = submittedData[key];
    if (!hasPersistableFieldValue(field, normalizedValue)) continue;
    if (leadField === 'message') updates[leadField] = normalizeEmail(normalizedValue);
    else updates[leadField] = normalizedValue;
  }
  if (!lead?.id) return {};
  return updates;
}

async function saveAssessmentCampaignCollectedData(options: {
  participation: any;
  lead: any;
  fieldDefinitions: any[];
  submittedData: Record<string, any>;
  stage: string;
  tenantId: number | string;
  extraParticipationData?: Record<string, any>;
}) {
  const participation = options?.participation;
  const lead = options?.lead;
  const fieldDefinitions = Array.isArray(options?.fieldDefinitions) ? options.fieldDefinitions : [];
  const submittedData = options?.submittedData && typeof options.submittedData === 'object' && !Array.isArray(options.submittedData) ? options.submittedData : {};
  const tenantId = options?.tenantId;
  const stage = toText(options?.stage);
  if (!participation?.id) throw new AssessmentCampaignError(400, 'participation is required');
  if (!tenantId) throw new AssessmentCampaignError(400, 'tenantId is required');

  const validation = validateAssessmentCampaignCollectedData(fieldDefinitions, submittedData, stage);
  if (validation.unsupportedKeys.length > 0 || validation.errors.length > 0) {
    throw new AssessmentCampaignError(400, 'INVALID_INPUT', {
      unsupportedFields: validation.unsupportedKeys,
      fields: validation.errors,
    });
  }
  const allowedFields = fieldDefinitions.filter((field: any) => toText(field?.status) === 'active' && toText(field?.collectStage) === stage);
  const normalizedData = validation.data;

  const existingCollectedData = getCollectedData(participation);
  const nextCollectedData = { ...existingCollectedData };
  for (const key of Object.keys(normalizedData || {})) {
    const field = allowedFields.find((item: any) => toText(item?.key) === toText(key));
    if (!field) continue;
    const normalizedValue = normalizedData[key];
    if (!hasPersistableFieldValue(field, normalizedValue)) continue;
    nextCollectedData[key] = normalizedValue;
  }

  const leadUpdates = getLeadPersistenceUpdates(normalizedData, allowedFields, lead);
  let updatedLead = lead || null;
  if (updatedLead?.id && Object.keys(leadUpdates).length > 0) {
    await strapi.db.query(LEAD_UID).update({ where: { id: Number(updatedLead.id) }, data: leadUpdates });
    updatedLead = await strapi.db.query(LEAD_UID).findOne({ where: { id: Number(updatedLead.id) } });
  }

  const participationData: Record<string, any> = {
    collectedData: nextCollectedData,
    ...(options?.extraParticipationData || {}),
  };
  if (updatedLead?.id) participationData.lead = Number(updatedLead.id);
  await strapi.db.query(ASSESSMENT_CAMPAIGN_PARTICIPATION_UID).update({ where: { id: Number(participation.id) }, data: participationData });
  const refreshedParticipation = await strapi.db.query(ASSESSMENT_CAMPAIGN_PARTICIPATION_UID).findOne({
    where: mergeTenantWhere({ id: { $eq: Number(participation.id) } }, tenantId),
    populate: {
      lead: true,
      assessmentAttempt: { select: ['id', 'documentId', 'code', 'status', 'submittedAt'] },
      matchedRule: { populate: { assessmentVersion: { select: ['id', 'documentId', 'code', 'title'] } } },
      assessmentVersion: { select: ['id', 'documentId', 'code', 'title'] },
      assessmentCampaign: { populate: { fields: { orderBy: [{ order: 'asc' }, { id: 'asc' }] } } },
    },
  });

  return {
    lead: updatedLead,
    participation: refreshedParticipation,
    collectedData: nextCollectedData,
  };
}

function getStageFields(campaign: any, stage: string) {
  return (Array.isArray(campaign?.fields) ? campaign.fields : [])
    .filter((item: any) => toText(item?.status) === 'active' && toText(item?.collectStage) === stage)
    .sort((left: any, right: any) => {
      const leftOrder = Number(left?.order || 0);
      const rightOrder = Number(right?.order || 0);
      if (leftOrder !== rightOrder) return leftOrder - rightOrder;
      return Number(left?.id || 0) - Number(right?.id || 0);
    });
}

function getLeadValueForField(lead: any, key: string) {
  const normalizedKey = toText(key);
  if (!normalizedKey) return undefined;
  if (normalizedKey === 'fullName' || normalizedKey === 'studentName' || normalizedKey === 'name') {
    const fullName = toText(lead?.fullName);
    const email = toText(lead?.message).toLowerCase();
    if (!fullName) return undefined;
    if (email && fullName.toLowerCase() === email) return undefined;
    return fullName;
  }
  if (normalizedKey === 'phone') return lead?.phone;
  if (normalizedKey === 'email' || normalizedKey === 'parentEmail' || normalizedKey === 'contactEmail') return lead?.message;
  return undefined;
}

function getPrefilledFieldValue(field: any, lead: any, attributes: Record<string, any>) {
  const key = toText(field?.key);
  if (!key) return field?.fieldType === 'checkbox' ? [] : '';
  const attributeValue = attributes?.[key];
  if (attributeValue !== undefined && attributeValue !== null && !(typeof attributeValue === 'string' && attributeValue.trim() === '')) {
    return normalizeFieldValue(field, attributeValue);
  }
  const leadValue = getLeadValueForField(lead, key);
  if (leadValue !== undefined && leadValue !== null && !(typeof leadValue === 'string' && String(leadValue).trim() === '')) {
    return normalizeFieldValue(field, leadValue);
  }
  return field?.fieldType === 'checkbox' ? [] : '';
}

function buildPublicAccessMetadata(participation: any, attempt: any, previous: any = null) {
  const token = issuePublicAccessToken();
  return {
    token,
    session: {
      tokenHash: hashPublicAccessToken(token),
      attemptId: Number(attempt?.id || 0) || null,
      participationCode: participation?.code || null,
      issuedAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + PUBLIC_ACCESS_TTL_MS).toISOString(),
      previousIssuedAt: previous?.issuedAt || null,
    },
  };
}

function validateRecoveryOtp(otp: unknown) {
  if (toText(otp) !== OTP_DEMO_CODE) throw new AssessmentCampaignError(400, 'INVALID_OTP');
}

function parseRetakeReason(value: unknown, fieldName: string) {
  const reason = toText(value);
  if (!reason) throw new AssessmentCampaignError(400, `${fieldName} is required`);
  if (!RETAKE_REASON_CODES.has(reason)) throw new AssessmentCampaignError(400, `${fieldName} is invalid`);
  return reason;
}

function doesParticipationBelongToEmail(participation: any, email: string) {
  const normalizedEmail = normalizeEmail(email);
  if (!normalizedEmail) return false;
  const leadEmail = normalizeEmail(participation?.lead?.message || participation?.lead?.email || '');
  const metadataEmail = normalizeEmail(readParticipationAttributes(participation)?.email || '');
  return leadEmail === normalizedEmail || metadataEmail === normalizedEmail;
}

function getParticipationPriority(status: string) {
  if (status === 'in_progress') return 1;
  if (status === 'submitted' || status === 'result_pending') return 2;
  if (status === 'completed') return 3;
  return 4;
}

function buildRecoveryActionForParticipation(participation: any) {
  const status = toText(participation?.status || participation?.assessmentAttempt?.status);
  const attemptStatus = toText(participation?.assessmentAttempt?.status);
  if (attemptStatus === 'cancelled') {
    if (participation?.retakeAllowed === true) {
      return {
        action: 'start_retake',
        actionLabel: 'Bắt đầu làm lại',
        description: 'Bài đánh giá trước của bạn đã được hủy. VitaminFun đã cho phép bạn thực hiện lại bài đánh giá.',
        routeType: 'retake',
      };
    }
    return {
      action: 'cancelled_support',
      actionLabel: 'Liên hệ hỗ trợ',
      description: 'Lượt làm bài trước đã được hủy. Vui lòng liên hệ VitaminFun để được hỗ trợ.',
      routeType: 'none',
    };
  }
  if (status === 'in_progress' || status === 'created' || status === 'verified' || status === 'ready') {
    return {
      action: 'resume_attempt',
      actionLabel: 'Tiếp tục bài kiểm tra',
      description: 'Bạn có một bài kiểm tra chưa hoàn thành.',
      routeType: 'runner',
    };
  }
  if (status === 'submitted' || status === 'result_pending') {
    return {
      action: 'view_result_status',
      actionLabel: 'Xem trạng thái kết quả',
      description: 'Bạn đã hoàn thành bài kiểm tra. Kết quả đang được xử lý hoặc chờ hoàn tất thông tin.',
      routeType: 'result',
    };
  }
  return {
    action: 'view_result',
    actionLabel: 'Xem lại kết quả',
    description: 'Bài kiểm tra đã hoàn thành.',
    routeType: 'result',
  };
}

async function refreshParticipationPublicAccess(participation: any, tenantId: number | string) {
  const attemptRef = participation?.assessmentAttempt?.id || participation?.assessmentAttempt?.documentId;
  const attempt = attemptRef ? await ensureEntityInTenant(ASSESSMENT_ATTEMPT_UID, attemptRef, tenantId, 'assessmentAttempt') : null;
  if (!attempt?.id) throw new AssessmentCampaignError(404, 'ATTEMPT_NOT_FOUND');
  const publicAccess = buildPublicAccessMetadata(participation, attempt, getSourceMetadata(participation).__publicAccess || null);
  await strapi.db.query(ASSESSMENT_CAMPAIGN_PARTICIPATION_UID).update({
    where: { id: Number(participation.id) },
    data: {
      sourceMetadata: buildParticipationSourceMetadata(participation, readParticipationAttributes(participation), { publicAccess: publicAccess.session }),
    },
  });
  const refreshed = await findParticipationByAttemptOrThrow(attempt, tenantId, { includeCampaignFields: true });
  return { participation: refreshed, attempt, publicAccess };
}

function mapRecoveredParticipation(row: any, publicAccess: any) {
  const action = buildRecoveryActionForParticipation(row);
  return {
    ...mapParticipation(row),
    recovery: {
      ...action,
      publicAccessToken: publicAccess?.token || '',
      publicAccessExpiresAt: publicAccess?.session?.expiresAt || null,
      suggested: getParticipationPriority(toText(row?.status)) === 1,
    },
  };
}

async function findCampaignBySlugOrThrow(slug: string, tenantId: number | string, options: { includeChildren?: boolean } = {}) {
  const normalizedSlug = ensureRequiredText(slug, 'slug');
  const row = await strapi.db.query(ASSESSMENT_CAMPAIGN_UID).findOne({
    where: mergeTenantWhere({ slug: { $eq: normalizedSlug } }, tenantId),
    populate: options.includeChildren ? {
      fields: { orderBy: [{ order: 'asc' }, { id: 'asc' }] },
      rules: { populate: { assessmentVersion: { populate: { assessment: { select: ['id', 'documentId', 'code', 'name', 'assessmentType', 'status'] } }, select: ['id', 'documentId', 'code', 'title', 'version', 'versionStatus', 'durationMinutes'] } }, orderBy: [{ priority: 'asc' }, { id: 'asc' }] },
    } : undefined,
  });
  if (!row) throw new AssessmentCampaignError(404, 'CAMPAIGN_NOT_FOUND');
  return row;
}

async function findOrCreateLeadFromAttributes(attributes: Record<string, any>) {
  const phone = toText(attributes?.phone || attributes?.parentPhone || attributes?.zalo || '');
  const fullName = toText(attributes?.fullName || attributes?.studentName || attributes?.name || '');
  const email = toText(attributes?.email || '').toLowerCase();
  if (!phone && !email && !fullName) return null;
  let existing = null;
  if (phone) {
    existing = await strapi.db.query(LEAD_UID).findOne({ where: { phone: { $eq: phone } } });
  }
  if (!existing && fullName) {
    existing = await strapi.db.query(LEAD_UID).findOne({ where: { fullName: { $eq: fullName } }, orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }] });
  }
  if (existing?.id) {
    await strapi.db.query(LEAD_UID).update({ where: { id: existing.id }, data: { fullName: fullName || existing.fullName, phone: phone || existing.phone, message: email || existing.message, leadStatus: existing.leadStatus || 'new' } });
    return strapi.db.query(LEAD_UID).findOne({ where: { id: existing.id } });
  }
  return strapi.db.query(LEAD_UID).create({ data: { fullName: fullName || phone || email || 'Lead', phone: phone || null, message: email || null, channel: 'web', leadStatus: 'new', pageUrl: null } });
}

function extractCandidateIdentityFromAttributes(attributes: Record<string, any>) {
  const fullName = toText(attributes?.fullName || attributes?.studentName || attributes?.name || '');
  const parsedGrade = parseCampaignGrade(attributes?.grade);
  const dateOfBirth = normalizeDateOnly(attributes?.dateOfBirth || attributes?.birthDate || attributes?.dob || attributes?.studentDateOfBirth || '');
  return {
    fullName,
    normalizedFullName: fullName.toLowerCase(),
    grade: parsedGrade.valid ? parsedGrade.grade : null,
    dateOfBirth,
  };
}

function extractCandidateIdentityFromParticipation(participation: any) {
  const attributes = readParticipationAttributes(participation);
  const collectedData = getCollectedData(participation);
  const fullName = toText(attributes?.fullName || attributes?.studentName || attributes?.name || participation?.lead?.fullName || '');
  const parsedGrade = parseCampaignGrade(attributes?.grade ?? collectedData?.grade ?? participation?.sourceMetadata?.grade);
  const dateOfBirth = normalizeDateOnly(attributes?.dateOfBirth || attributes?.birthDate || attributes?.dob || attributes?.studentDateOfBirth || collectedData?.dateOfBirth || '');
  return {
    fullName,
    normalizedFullName: fullName.toLowerCase(),
    grade: parsedGrade.valid ? parsedGrade.grade : null,
    dateOfBirth,
  };
}

function isSameCandidateIdentity(left: any, right: any) {
  const leftName = toText(left?.normalizedFullName || left?.fullName).toLowerCase();
  const rightName = toText(right?.normalizedFullName || right?.fullName).toLowerCase();
  if (!leftName || !rightName || leftName !== rightName) return false;
  const leftGrade = left?.grade === null || left?.grade === undefined ? null : Number(left.grade);
  const rightGrade = right?.grade === null || right?.grade === undefined ? null : Number(right.grade);
  if (leftGrade !== null && rightGrade !== null && leftGrade !== rightGrade) return false;
  const leftDob = toText(left?.dateOfBirth || '');
  const rightDob = toText(right?.dateOfBirth || '');
  if (leftDob && rightDob && leftDob !== rightDob) return false;
  return true;
}

async function createLeadForNewRegistration(attributes: Record<string, any>) {
  const phone = toText(attributes?.phone || attributes?.parentPhone || attributes?.zalo || '');
  const fullName = toText(attributes?.fullName || attributes?.studentName || attributes?.name || '');
  const email = toText(attributes?.email || '').toLowerCase();
  if (!phone && !email && !fullName) return null;
  return strapi.db.query(LEAD_UID).create({
    data: {
      fullName: fullName || phone || email || 'Lead',
      phone: phone || null,
      message: email || null,
      channel: 'web',
      leadStatus: 'new',
      pageUrl: null,
    },
  });
}

async function generateParticipationCode(tenantId: number | string) {
  for (let attempt = 0; attempt < 25; attempt += 1) {
    const code = `ACP-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
    const duplicate = await strapi.db.query(ASSESSMENT_CAMPAIGN_PARTICIPATION_UID).findOne({ where: mergeTenantWhere({ code: { $eq: code } }, tenantId), select: ['id'] });
    if (!duplicate?.id) return code;
  }
  throw new AssessmentCampaignError(500, 'Could not generate unique assessment campaign participation code');
}

async function findReusableParticipation(campaignId: number, leadId: number | null, tenantId: number | string) {
  const whereClauses: any[] = [
    { assessmentCampaign: { id: { $eq: campaignId } } },
    { status: { $in: ['created', 'verified', 'ready', 'in_progress'] } },
  ];
  if (leadId) whereClauses.push({ lead: { id: { $eq: leadId } } });
  const row = await strapi.db.query(ASSESSMENT_CAMPAIGN_PARTICIPATION_UID).findOne({
    where: mergeTenantWhere({ $and: whereClauses }, tenantId),
    populate: {
      matchedRule: { populate: { assessmentVersion: { select: ['id', 'documentId', 'code', 'title'] } } },
      assessmentVersion: { select: ['id', 'documentId', 'code', 'title'] },
      assessmentAttempt: { select: ['id', 'documentId', 'code', 'status', 'startedAt', 'submittedAt'] },
    },
    orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
  });
  return row || null;
}

async function findLatestParticipation(campaignId: number, leadId: number | null, tenantId: number | string) {
  const whereClauses: any[] = [{ assessmentCampaign: { id: { $eq: campaignId } } }];
  if (leadId) whereClauses.push({ lead: { id: { $eq: leadId } } });
  return strapi.db.query(ASSESSMENT_CAMPAIGN_PARTICIPATION_UID).findOne({
    where: mergeTenantWhere({ $and: whereClauses }, tenantId),
    populate: {
      lead: true,
      matchedRule: { populate: { assessmentVersion: { select: ['id', 'documentId', 'code', 'title'] } } },
      assessmentVersion: { select: ['id', 'documentId', 'code', 'title', 'versionStatus'] },
      assessmentAttempt: { select: ['id', 'documentId', 'code', 'status', 'startedAt', 'submittedAt', 'cancelledAt', 'cancelReason', 'cancelNote'] },
      retakeAllowedBy: { select: ['id', 'documentId', 'username', 'email', 'fullName'] },
    },
    orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
  });
}

async function findLatestParticipationByCandidateIdentity(campaignId: number, attributes: Record<string, any>, tenantId: number | string) {
  const candidateIdentity = extractCandidateIdentityFromAttributes(attributes);
  if (!candidateIdentity.normalizedFullName) return null;
  const rows = await strapi.db.query(ASSESSMENT_CAMPAIGN_PARTICIPATION_UID).findMany({
    where: mergeTenantWhere({
      assessmentCampaign: { id: { $eq: campaignId } },
      lead: { fullName: { $eq: candidateIdentity.fullName } },
    }, tenantId),
    populate: {
      lead: true,
      matchedRule: { populate: { assessmentVersion: { select: ['id', 'documentId', 'code', 'title'] } } },
      assessmentVersion: { select: ['id', 'documentId', 'code', 'title', 'versionStatus'] },
      assessmentAttempt: { select: ['id', 'documentId', 'code', 'status', 'startedAt', 'submittedAt', 'cancelledAt', 'cancelReason', 'cancelNote'] },
      retakeAllowedBy: { select: ['id', 'documentId', 'username', 'email', 'fullName'] },
    },
    orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
  });
  return (rows || []).find((row: any) => isSameCandidateIdentity(candidateIdentity, extractCandidateIdentityFromParticipation(row))) || null;
}

async function findActiveAttemptByParticipationCode(participationCode: string, tenantId: number | string) {
  const code = toText(participationCode);
  if (!code) return null;
  return strapi.db.query(ASSESSMENT_ATTEMPT_UID).findOne({
    where: mergeTenantWhere({ sourceRef: { $eq: code }, status: { $in: ['created', 'in_progress'] } }, tenantId),
    orderBy: [{ startedAt: 'desc' }, { id: 'desc' }],
    populate: { assessmentVersion: { select: ['id', 'documentId', 'code', 'title'] } },
  });
}

async function ensureUserEntity(ref: unknown) {
  if (ref === null || ref === undefined || ref === '') return null;
  const entity = await findEntityByRef(USER_UID, ref, {});
  if (!entity) throw new AssessmentCampaignError(400, 'cancelledBy is invalid');
  return entity;
}

async function invalidateAttemptCurrentArtifacts(attemptId: number, tenantId: number | string) {
  const results = await strapi.db.query(ASSESSMENT_RESULT_UID).findMany({
    where: mergeTenantWhere({ attempt: { id: { $eq: attemptId } } }, tenantId),
    select: ['id', 'status', 'isCurrent'],
  });
  for (const result of results || []) {
    await strapi.db.query(ASSESSMENT_RESULT_UID).update({
      where: { id: Number(result.id) },
      data: {
        isCurrent: false,
        status: 'cancelled',
      },
    });
  }

  for (const result of results || []) {
    const confirmations = await strapi.db.query(ASSESSMENT_PLACEMENT_CONFIRMATION_UID).findMany({
      where: mergeTenantWhere({ assessmentResult: { id: { $eq: Number(result.id) } } }, tenantId),
      select: ['id', 'status', 'isCurrent'],
    });
    for (const confirmation of confirmations || []) {
      await strapi.db.query(ASSESSMENT_PLACEMENT_CONFIRMATION_UID).update({
        where: { id: Number(confirmation.id) },
        data: {
          isCurrent: false,
          status: 'cancelled',
        },
      });
    }

    const reviews = await strapi.db.query(ASSESSMENT_SPEAKING_REVIEW_UID).findMany({
      where: mergeTenantWhere({ assessmentResult: { id: { $eq: Number(result.id) } } }, tenantId),
      select: ['id', 'status'],
    });
    for (const review of reviews || []) {
      if (!['pending', 'in_review'].includes(toText(review?.status))) continue;
      await strapi.db.query(ASSESSMENT_SPEAKING_REVIEW_UID).update({
        where: { id: Number(review.id) },
        data: { status: 'cancelled' },
      });
    }
  }
}

async function ensureRetakeVersionUsable(participation: any, tenantId: number | string) {
  const versionRef = participation?.assessmentVersion?.id || participation?.assessmentVersion?.documentId || participation?.matchedRule?.assessmentVersion?.id || participation?.matchedRule?.assessmentVersion?.documentId;
  if (!versionRef) throw new AssessmentCampaignError(409, 'RETAKE_VERSION_UNAVAILABLE');
  const version = await ensureAssessmentVersionForRule(versionRef, tenantId);
  if (toText(version?.versionStatus) !== 'published') throw new AssessmentCampaignError(409, 'RETAKE_VERSION_UNAVAILABLE');
  return version;
}

async function buildRetakeAttemptResponse(participation: any, attempt: any, tenantId: number | string, publicAccess: any, resumed = false) {
  const refreshedParticipation = await findParticipationByAttemptOrThrow(attempt, tenantId, { includeCampaignFields: true });
  return {
    status: resumed ? 'MATCHED' : 'RETAKE_STARTED',
    resumed,
    campaign: mapPublicCampaign(refreshedParticipation?.assessmentCampaign),
    participation: mapParticipation(refreshedParticipation),
    assessmentVersion: mapSimpleRelation(refreshedParticipation?.assessmentVersion || refreshedParticipation?.matchedRule?.assessmentVersion),
    attempt: {
      id: normalizeId(attempt),
      documentId: attempt?.documentId || null,
      code: attempt?.code || '',
      status: attempt?.status || '',
    },
    publicAccessToken: publicAccess.token,
    publicAccessExpiresAt: publicAccess.session.expiresAt,
  };
}

async function findParticipationByAttemptOrThrow(attempt: any, tenantId: number | string, options: { includeCampaignFields?: boolean } = {}) {
  const populate = {
    lead: true,
    assessmentAttempt: { select: ['id', 'documentId', 'code', 'status', 'submittedAt'] },
    matchedRule: { populate: { assessmentVersion: { select: ['id', 'documentId', 'code', 'title'] } } },
    assessmentVersion: { select: ['id', 'documentId', 'code', 'title'] },
    assessmentCampaign: options.includeCampaignFields
      ? { populate: { fields: { orderBy: [{ order: 'asc' }, { id: 'asc' }] } } }
      : { select: ['id', 'documentId', 'code', 'slug', 'publicTitle', 'publicDescription'] },
  } as any;
  const byAttempt = await strapi.db.query(ASSESSMENT_CAMPAIGN_PARTICIPATION_UID).findOne({
    where: mergeTenantWhere({ assessmentAttempt: { id: { $eq: Number(attempt?.id || 0) } } }, tenantId),
    populate,
  });
  if (byAttempt?.id) return byAttempt;
  const sourceRef = toText(attempt?.sourceRef);
  if (toText(attempt?.sourceType) === 'campaign' && sourceRef) {
    const sourceWhere = whereByParam(sourceRef);
    const sourceConditions = sourceWhere ? [{ code: { $eq: sourceRef } }, sourceWhere] : [{ code: { $eq: sourceRef } }];
    const bySourceRef = await strapi.db.query(ASSESSMENT_CAMPAIGN_PARTICIPATION_UID).findOne({
      where: mergeTenantWhere({ $or: sourceConditions }, tenantId),
      populate,
    });
    if (bySourceRef?.id) return bySourceRef;
  }
  strapi.log.error('[assessment-campaign] participation linkage missing', {
    attemptId: attempt?.id || null,
    attemptDocumentId: attempt?.documentId || null,
    sourceType: attempt?.sourceType || null,
    sourceRef,
    tenantId,
  });
  throw new AssessmentCampaignError(404, 'CAMPAIGN_PARTICIPATION_NOT_FOUND');
}

async function syncParticipationStatusWithAttempt(participation: any, attempt: any, tenantId: number | string) {
  const nextStatus = toText(attempt?.status) === 'submitted'
    ? (toText(participation?.status) === 'completed' ? 'completed' : 'submitted')
    : participation?.status;
  const nextSubmittedAt = attempt?.submittedAt || participation?.submittedAt || null;
  if (nextStatus === participation?.status && String(nextSubmittedAt || '') === String(participation?.submittedAt || '')) return participation;
  await strapi.db.query(ASSESSMENT_CAMPAIGN_PARTICIPATION_UID).update({
    where: { id: Number(participation.id) },
    data: {
      status: nextStatus,
      submittedAt: nextSubmittedAt,
    },
  });
  return strapi.db.query(ASSESSMENT_CAMPAIGN_PARTICIPATION_UID).findOne({
    where: mergeTenantWhere({ id: { $eq: Number(participation.id) } }, tenantId),
    populate: {
      lead: true,
      assessmentAttempt: { select: ['id', 'documentId', 'code', 'status', 'submittedAt'] },
      matchedRule: { populate: { assessmentVersion: { select: ['id', 'documentId', 'code', 'title'] } } },
      assessmentVersion: { select: ['id', 'documentId', 'code', 'title'] },
      assessmentCampaign: { populate: { fields: { orderBy: [{ order: 'asc' }, { id: 'asc' }] } } },
    },
  });
}

async function resolvePublicCampaignAttemptContext(attemptRef: unknown, tenantId: number | string, publicAccessToken: string) {
  const attempt = await ensureEntityInTenant(ASSESSMENT_ATTEMPT_UID, attemptRef, tenantId, 'assessmentAttempt');
  if (!attempt?.id) throw new AssessmentCampaignError(404, 'ATTEMPT_NOT_FOUND');
  if (toText(attempt?.sourceType) !== 'campaign') throw new AssessmentCampaignError(400, 'ATTEMPT_IS_NOT_CAMPAIGN');
  let participation = await findParticipationByAttemptOrThrow(attempt, tenantId, { includeCampaignFields: true });
  const access = getSourceMetadata(participation).__publicAccess;
  if (!publicAccessToken || !access?.tokenHash) {
    throw new AssessmentCampaignError(401, 'PUBLIC_SESSION_EXPIRED', { campaignSlug: participation?.assessmentCampaign?.slug || null });
  }
  if (access?.expiresAt && new Date(access.expiresAt).getTime() < Date.now()) {
    throw new AssessmentCampaignError(401, 'PUBLIC_SESSION_EXPIRED', { campaignSlug: participation?.assessmentCampaign?.slug || null });
  }
  if (hashPublicAccessToken(publicAccessToken) !== access.tokenHash) {
    throw new AssessmentCampaignError(403, 'PUBLIC_SESSION_MISMATCH', { campaignSlug: participation?.assessmentCampaign?.slug || null });
  }
  if (access?.attemptId && Number(access.attemptId) !== Number(attempt.id)) {
    throw new AssessmentCampaignError(403, 'PUBLIC_SESSION_MISMATCH', { campaignSlug: participation?.assessmentCampaign?.slug || null });
  }
  participation = await syncParticipationStatusWithAttempt(participation, attempt, tenantId);
  return {
    attempt,
    participation,
    campaign: participation?.assessmentCampaign,
    lead: participation?.lead || null,
    attributes: readParticipationAttributes(participation),
  };
}

function buildLeadUpdatePayload(attributes: Record<string, any>, existingLead: any) {
  const email = toText(attributes?.email || attributes?.parentEmail || attributes?.contactEmail || '');
  const phone = toText(attributes?.phone || '');
  const parentPhone = toText(attributes?.parentPhone || '');
  const fullName = toText(attributes?.fullName || attributes?.studentName || attributes?.name || '');
  const payload: Record<string, any> = {};
  if (fullName) payload.fullName = fullName;
  if (phone) payload.phone = phone;
  else if (parentPhone && !toText(existingLead?.phone)) payload.phone = parentPhone;
  if (email) payload.message = email;
  return payload;
}

async function ensureParticipationLead(participation: any, attributes: Record<string, any>) {
  if (participation?.lead?.id) return participation.lead;
  const lead = await findOrCreateLeadFromAttributes(attributes);
  if (lead?.id) {
    await strapi.db.query(ASSESSMENT_CAMPAIGN_PARTICIPATION_UID).update({ where: { id: Number(participation.id) }, data: { lead: Number(lead.id) } });
    if (participation?.assessmentAttempt?.id) {
      await strapi.db.query(ASSESSMENT_ATTEMPT_UID).update({ where: { id: Number(participation.assessmentAttempt.id) }, data: { lead: Number(lead.id) } });
    }
  }
  return lead || null;
}

function mapPublicCompletionFields(fields: any[], lead: any, attributes: Record<string, any>) {
  return (fields || []).map((field: any) => ({
    ...mapCampaignField(field),
    value: getPrefilledFieldValue(field, lead, attributes),
  }));
}

async function buildAssessmentCampaignResultGate(attemptRef: unknown, tenantId: number | string, publicAccessToken: string) {
  const context = await resolvePublicCampaignAttemptContext(attemptRef, tenantId, publicAccessToken);
  if (toText(context.attempt?.status) === 'cancelled') {
    const action = buildRecoveryActionForParticipation(context.participation);
    return {
      canViewResult: false,
      reason: context.participation?.retakeAllowed === true ? 'RETAKE_AVAILABLE' : 'ATTEMPT_CANCELLED',
      missingFields: [],
      fields: [],
      profile: context.attributes,
      participation: mapParticipation(context.participation),
      campaign: mapPublicCampaign(context.campaign),
      attempt: {
        id: normalizeId(context.attempt),
        documentId: context.attempt?.documentId || null,
        code: context.attempt?.code || '',
        status: context.attempt?.status || '',
        submittedAt: context.attempt?.submittedAt || null,
      },
      recovery: action,
      context,
    };
  }
  const beforeResultFields = getStageFields(context.campaign, 'before_result');
  const requiredFields = beforeResultFields.filter((field: any) => field?.required === true);
  const missingFields = requiredFields
    .map((field: any) => {
      const normalized = normalizeAssessmentCampaignFieldValue(field, getPrefilledFieldValue(field, context.lead, context.attributes));
      return { field, value: normalized.value, errors: normalized.errors };
    })
    .filter(({ field, value, errors }) => errors.length > 0 || isEmptyNormalizedFieldValue(field, value))
    .map(({ field }) => mapCampaignField(field));
  const canViewResult = missingFields.length === 0;
  return {
    canViewResult,
    reason: canViewResult ? null : 'MISSING_REQUIRED_FIELDS',
    missingFields,
    fields: mapPublicCompletionFields(beforeResultFields, context.lead, context.attributes),
    profile: context.attributes,
    participation: mapParticipation(context.participation),
    campaign: mapPublicCampaign(context.campaign),
    attempt: {
      id: normalizeId(context.attempt),
      documentId: context.attempt?.documentId || null,
      code: context.attempt?.code || '',
      status: context.attempt?.status || '',
      submittedAt: context.attempt?.submittedAt || null,
    },
    context,
  };
}

export async function resolvePublicAssessmentAttemptAccess(attemptRef: unknown, tenantId: number | string, publicAccessToken: string) {
  return resolvePublicCampaignAttemptContext(attemptRef, tenantId, publicAccessToken);
}

export function getTenantIdFromContext(ctx: any) {
  return resolveCurrentTenantId(ctx);
}

export async function listAssessmentCampaigns(query: Record<string, unknown> = {}, tenantId: number | string) {
  const { page, pageSize, start } = buildPagination(query);
  const q = toText(query?.q || query?.search);
  const status = toText(query?.status);
  const whereClauses: any[] = [];
  if (q) whereClauses.push({ $or: [{ code: { $containsi: q } }, { name: { $containsi: q } }, { slug: { $containsi: q } }] });
  if (status) whereClauses.push({ status });
  const where = mergeTenantWhere(whereClauses.length > 0 ? { $and: whereClauses } : {}, tenantId);
  const orderBy = normalizeSortInput(query?.sort).length > 0 ? normalizeSortInput(query?.sort) : [{ updatedAt: 'desc' }, { id: 'desc' }];
  const [rows, total] = await Promise.all([
    strapi.db.query(ASSESSMENT_CAMPAIGN_UID).findMany({ where, offset: start, limit: pageSize, orderBy, populate: { participations: { select: ['id'] } } }),
    strapi.db.query(ASSESSMENT_CAMPAIGN_UID).count({ where }),
  ]);
  return {
    data: (rows || []).map((row: any) => ({
      ...mapCampaign(row),
      leadCount: 0,
      participationCount: Array.isArray(row?.participations) ? row.participations.length : 0,
    })),
    meta: { pagination: { page, pageSize, total, pageCount: Math.max(1, Math.ceil(total / pageSize)) } },
  };
}

export async function getAssessmentCampaignDetail(id: unknown, tenantId: number | string) {
  const row = await findCampaignOrThrow(id, tenantId, { includeChildren: true });
  const participationCount = await strapi.db.query(ASSESSMENT_CAMPAIGN_PARTICIPATION_UID).count({ where: mergeTenantWhere({ assessmentCampaign: { id: { $eq: Number(row.id) } } }, tenantId) });
  const resultRows = await strapi.db.query(ASSESSMENT_CAMPAIGN_PARTICIPATION_UID).findMany({
    where: mergeTenantWhere({ assessmentCampaign: { id: { $eq: Number(row.id) } } }, tenantId),
    populate: { lead: { select: ['id'] }, assessmentAttempt: { populate: { results: { select: ['id', 'status', 'confirmedLevel'] } } } },
  });
  const completedCount = (resultRows || []).filter((item: any) => Array.isArray(item?.assessmentAttempt?.results) && item.assessmentAttempt.results.some((result: any) => result?.confirmedLevel || result?.status === 'provisional')).length;
  const leadKeys = new Set((resultRows || []).map((item: any) => String(item?.lead?.id || '')).filter(Boolean));
  const verifiedCount = (resultRows || []).filter((item: any) => Boolean(item?.verifiedAt)).length;
  return {
    ...mapCampaign(row, { includeChildren: true }),
    summary: {
      totalLeads: leadKeys.size,
      totalVerified: verifiedCount,
      totalStarted: Number(participationCount || 0),
      totalSubmitted: (resultRows || []).filter((item: any) => ['submitted', 'result_pending', 'completed'].includes(toText(item?.status))).length,
      totalCompleted: completedCount,
    },
  };
}

export async function createAssessmentCampaign(body: any, tenantId: number | string) {
  const data = await sanitizeCampaignPayload(body, tenantId);
  await ensureCampaignCodeUnique(data.code, tenantId);
  await ensureCampaignSlugUnique(data.slug, tenantId);
  const created = await strapi.db.query(ASSESSMENT_CAMPAIGN_UID).create({ data });
  return getAssessmentCampaignDetail(created.id, tenantId);
}

export async function updateAssessmentCampaign(id: unknown, body: any, tenantId: number | string) {
  const existing = await findCampaignOrThrow(id, tenantId, { includeChildren: true });
  const data = await sanitizeCampaignPayload(body, tenantId, existing);
  await ensureCampaignCodeUnique(data.code, tenantId, Number(existing.id));
  await ensureCampaignSlugUnique(data.slug, tenantId, Number(existing.id));
  await strapi.db.query(ASSESSMENT_CAMPAIGN_UID).update({ where: { id: existing.id }, data });
  return getAssessmentCampaignDetail(existing.id, tenantId);
}

export async function listAssessmentCampaignFields(campaignId: unknown, tenantId: number | string) {
  const campaign = await findCampaignOrThrow(campaignId, tenantId);
  const rows = await strapi.db.query(ASSESSMENT_CAMPAIGN_FIELD_UID).findMany({ where: mergeTenantWhere({ assessmentCampaign: { id: { $eq: Number(campaign.id) } } }, tenantId), orderBy: [{ order: 'asc' }, { id: 'asc' }] });
  return (rows || []).map(mapCampaignField);
}

export async function createAssessmentCampaignField(body: any, tenantId: number | string) {
  const data = await sanitizeCampaignFieldPayload(body, tenantId);
  await ensureCampaignFieldKeyUnique(Number(data.assessmentCampaign), data.key, tenantId);
  const created = await strapi.db.query(ASSESSMENT_CAMPAIGN_FIELD_UID).create({ data });
  const row = await findCampaignFieldOrThrow(created.id, tenantId);
  return mapCampaignField(row);
}

export async function updateAssessmentCampaignField(id: unknown, body: any, tenantId: number | string) {
  const existing = await findCampaignFieldOrThrow(id, tenantId);
  const data = await sanitizeCampaignFieldPayload(body, tenantId, existing);
  await ensureCampaignFieldKeyUnique(Number(data.assessmentCampaign), data.key, tenantId, Number(existing.id));
  await strapi.db.query(ASSESSMENT_CAMPAIGN_FIELD_UID).update({ where: { id: existing.id }, data });
  const row = await findCampaignFieldOrThrow(existing.id, tenantId);
  return mapCampaignField(row);
}

export async function deleteAssessmentCampaignField(id: unknown, tenantId: number | string) {
  const existing = await findCampaignFieldOrThrow(id, tenantId);
  await strapi.db.query(ASSESSMENT_CAMPAIGN_FIELD_UID).delete({ where: { id: existing.id } });
  return { id: normalizeId(existing) };
}

export async function reorderAssessmentCampaignFields(campaignId: unknown, body: any, tenantId: number | string) {
  const campaign = await findCampaignOrThrow(campaignId, tenantId);
  const payload = extractBody(body);
  const items = Array.isArray(payload.items) ? payload.items : [];
  for (const item of items) {
    const field = await findCampaignFieldOrThrow(item.id, tenantId);
    if (String(extractRelationRef(field?.assessmentCampaign) || field?.assessmentCampaign?.id || '') !== String(campaign.id)) {
      throw new AssessmentCampaignError(400, 'Field does not belong to the specified assessment campaign');
    }
    await strapi.db.query(ASSESSMENT_CAMPAIGN_FIELD_UID).update({ where: { id: field.id }, data: { order: parseRequiredInteger(item.order, 'order') } });
  }
  return listAssessmentCampaignFields(campaign.id, tenantId);
}

export async function listAssessmentCampaignRules(campaignId: unknown, tenantId: number | string) {
  const campaign = await findCampaignOrThrow(campaignId, tenantId);
  const rows = await strapi.db.query(ASSESSMENT_CAMPAIGN_RULE_UID).findMany({
    where: mergeTenantWhere({ assessmentCampaign: { id: { $eq: Number(campaign.id) } } }, tenantId),
    orderBy: [{ priority: 'asc' }, { id: 'asc' }],
    populate: { assessmentVersion: { populate: { assessment: { select: ['id', 'documentId', 'code', 'name'] } }, select: ['id', 'documentId', 'code', 'title', 'version', 'versionStatus'] } },
  });
  return (rows || []).map(mapCampaignRule);
}

export async function createAssessmentCampaignRule(body: any, tenantId: number | string) {
  const data = await sanitizeCampaignRulePayload(body, tenantId);
  await ensureCampaignRuleCodeUnique(Number(data.assessmentCampaign), data.code, tenantId);
  const created = await strapi.db.query(ASSESSMENT_CAMPAIGN_RULE_UID).create({ data });
  const row = await findCampaignRuleOrThrow(created.id, tenantId);
  return mapCampaignRule(row);
}

export async function updateAssessmentCampaignRule(id: unknown, body: any, tenantId: number | string) {
  const existing = await findCampaignRuleOrThrow(id, tenantId);
  const data = await sanitizeCampaignRulePayload(body, tenantId, existing);
  await ensureCampaignRuleCodeUnique(Number(data.assessmentCampaign), data.code, tenantId, Number(existing.id));
  await strapi.db.query(ASSESSMENT_CAMPAIGN_RULE_UID).update({ where: { id: existing.id }, data });
  const row = await findCampaignRuleOrThrow(existing.id, tenantId);
  return mapCampaignRule(row);
}

export async function deleteAssessmentCampaignRule(id: unknown, tenantId: number | string) {
  const existing = await findCampaignRuleOrThrow(id, tenantId);
  const usageCount = await strapi.db.query(ASSESSMENT_CAMPAIGN_PARTICIPATION_UID).count({ where: mergeTenantWhere({ matchedRule: { id: { $eq: Number(existing.id) } } }, tenantId) });
  if (Number(usageCount || 0) > 0) {
    throw new AssessmentCampaignError(409, 'Assessment Campaign Rule cannot be deleted because it has participation history');
  }
  await strapi.db.query(ASSESSMENT_CAMPAIGN_RULE_UID).delete({ where: { id: existing.id } });
  return { id: normalizeId(existing) };
}

export async function resolveAssessmentCampaignAssessment(campaignId: unknown, body: any, tenantId: number | string) {
  const campaign = await findCampaignOrThrow(campaignId, tenantId);
  const payload = extractBody(body);
  const grade = parseOptionalInteger(payload.grade, 'grade');
  if (grade === null) {
    return { status: 'NO_MATCH', matchedRule: null, assessmentVersion: null, reason: 'GRADE_REQUIRED' };
  }
  const rows = await strapi.db.query(ASSESSMENT_CAMPAIGN_RULE_UID).findMany({
    where: mergeTenantWhere({ assessmentCampaign: { id: { $eq: Number(campaign.id) } }, status: { $eq: 'active' } }, tenantId),
    orderBy: [{ priority: 'asc' }, { id: 'asc' }],
    populate: { assessmentVersion: { populate: { assessment: { select: ['id', 'documentId', 'code', 'name'] } }, select: ['id', 'documentId', 'code', 'title', 'version', 'versionStatus'] } },
  });
  const matches = (rows || []).filter((row: any) => {
    const from = row?.gradeFrom === null || row?.gradeFrom === undefined ? Number.NEGATIVE_INFINITY : Number(row.gradeFrom);
    const to = row?.gradeTo === null || row?.gradeTo === undefined ? Number.POSITIVE_INFINITY : Number(row.gradeTo);
    return grade >= from && grade <= to;
  });
  if (matches.length === 0) return { status: 'NO_MATCH', matchedRule: null, assessmentVersion: null, reason: 'NO_RULE_MATCHED' };
  if (matches.length > 1) return { status: 'AMBIGUOUS_MATCH', matchedRule: null, assessmentVersion: null, reason: 'MULTIPLE_RULES_MATCHED' };
  const matched = matches[0];
  return {
    status: 'MATCHED',
    matchedRule: mapCampaignRule(matched),
    assessmentVersion: mapSimpleRelation(matched?.assessmentVersion),
    assessment: mapSimpleRelation(matched?.assessmentVersion?.assessment),
    reason: 'GRADE_MATCH',
  };
}

export async function listAssessmentCampaignParticipations(campaignId: unknown, query: Record<string, unknown> = {}, tenantId: number | string) {
  const campaign = await findCampaignOrThrow(campaignId, tenantId);
  const { page, pageSize, start } = buildPagination(query);
  const q = toText(query?.q || query?.search);
  const status = toText(query?.status);
  const whereClauses: any[] = [{ assessmentCampaign: { id: { $eq: Number(campaign.id) } } }];
  if (status) whereClauses.push({ status });
  const where = mergeTenantWhere({ $and: whereClauses }, tenantId);
  const [rows, total] = await Promise.all([
    strapi.db.query(ASSESSMENT_CAMPAIGN_PARTICIPATION_UID).findMany({
      where,
      offset: start,
      limit: pageSize,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      populate: {
        lead: { select: ['id', 'documentId', 'fullName', 'phone'] },
        matchedRule: { populate: { assessmentVersion: { populate: { assessment: { select: ['id', 'documentId', 'code', 'name'] } }, select: ['id', 'documentId', 'code', 'title'] } } },
        assessmentVersion: { select: ['id', 'documentId', 'code', 'title', 'durationMinutes'] },
        assessmentAttempt: {
          select: ['id', 'documentId', 'code', 'status', 'startedAt', 'expiresAt', 'submittedAt', 'cancelledAt', 'cancelReason', 'cancelNote'],
          populate: {
            assessmentVersion: { select: ['id', 'documentId', 'code', 'durationMinutes'] },
            results: { select: ['id', 'documentId', 'status', 'provisionalLevel', 'confirmedLevel', 'isCurrent'] },
          },
        },
      },
    }),
    strapi.db.query(ASSESSMENT_CAMPAIGN_PARTICIPATION_UID).count({ where }),
  ]);
  const filtered = q
    ? rows.filter((row: any) => [row?.code, row?.lead?.fullName, row?.lead?.phone, row?.assessmentAttempt?.code].some((value: any) => toText(value).toLowerCase().includes(q.toLowerCase())))
    : rows;
  return {
    data: (filtered || []).map((row: any) => mapParticipation(row)),
    meta: { pagination: { page, pageSize, total: q ? filtered.length : total, pageCount: Math.max(1, Math.ceil((q ? filtered.length : total) / pageSize)) } },
  };
}

async function finalizeCampaignAttemptTimeoutCore(attemptRef: unknown, tenantId: number | string) {
  const attempt = await ensureEntityInTenant(ASSESSMENT_ATTEMPT_UID, attemptRef, tenantId, 'assessmentAttempt');
  if (!attempt?.id) throw new AssessmentCampaignError(404, 'ATTEMPT_NOT_FOUND');
  if (toText(attempt?.sourceType) !== 'campaign') throw new AssessmentCampaignError(400, 'ATTEMPT_IS_NOT_CAMPAIGN');

  const finalizedAttempt = await finalizeExpiredAssessmentAttempt(attempt.id, tenantId, {
    allowLegacyExpired: true,
    persistDerivedExpiresAt: true,
    rejectIfNotOverdue: true,
    rejectIfDeadlineMissing: true,
  });
  const participation = await syncParticipationStatusWithAttempt(
    await findParticipationByAttemptOrThrow(finalizedAttempt, tenantId, { includeCampaignFields: true }),
    finalizedAttempt,
    tenantId,
  );
  const currentResult = await strapi.db.query(ASSESSMENT_RESULT_UID).findOne({
    where: mergeTenantWhere({ attempt: { id: { $eq: Number(finalizedAttempt.id) } }, isCurrent: true }, tenantId),
    select: ['id', 'documentId', 'status', 'provisionalLevel', 'confirmedLevel'],
    orderBy: [{ scoredAt: 'desc' }, { id: 'desc' }],
  });
  return {
    attempt: {
      id: normalizeId(finalizedAttempt),
      documentId: finalizedAttempt?.documentId || null,
      code: finalizedAttempt?.code || '',
      status: finalizedAttempt?.status || '',
      startedAt: finalizedAttempt?.startedAt || null,
      expiresAt: finalizedAttempt?.expiresAt || null,
      submittedAt: finalizedAttempt?.submittedAt || null,
    },
    participation: mapParticipation(participation),
    result: currentResult ? {
      id: normalizeId(currentResult),
      documentId: currentResult?.documentId || null,
      status: currentResult?.status || '',
      provisionalLevel: currentResult?.provisionalLevel || null,
      confirmedLevel: currentResult?.confirmedLevel || null,
    } : null,
  };
}

export async function finalizeAssessmentCampaignAttemptTimeout(attemptRef: unknown, tenantId: number | string) {
  return finalizeCampaignAttemptTimeoutCore(attemptRef, tenantId);
}

export async function finalizeOverdueAssessmentCampaignAttempts(campaignId: unknown, tenantId: number | string) {
  const campaign = await findCampaignOrThrow(campaignId, tenantId);
  const rows = await strapi.db.query(ASSESSMENT_CAMPAIGN_PARTICIPATION_UID).findMany({
    where: mergeTenantWhere({
      assessmentCampaign: { id: { $eq: Number(campaign.id) } },
      assessmentAttempt: {
        status: { $eq: 'in_progress' },
        expiresAt: { $lte: new Date().toISOString() },
      },
    }, tenantId),
    populate: {
      assessmentAttempt: { select: ['id', 'documentId', 'code', 'status', 'expiresAt', 'submittedAt'] },
    },
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
  });

  if (!Array.isArray(rows) || rows.length === 0) {
    return { found: 0, processed: 0, alreadyFinalized: 0, failed: 0, failures: [] };
  }

  let processed = 0;
  let alreadyFinalized = 0;
  let failed = 0;
  const failures: Array<{ attemptId: string | null; attemptCode: string; message: string }> = [];

  for (const row of rows) {
    const attemptRefValue = normalizeId(row?.assessmentAttempt);
    try {
      await finalizeCampaignAttemptTimeoutCore(attemptRefValue, tenantId);
      processed += 1;
    } catch (error: any) {
      const message = toText(error?.message);
      if (message === 'Assessment Attempt is already submitted') {
        alreadyFinalized += 1;
        continue;
      }
      failed += 1;
      failures.push({
        attemptId: attemptRefValue,
        attemptCode: row?.assessmentAttempt?.code || '',
        message: message || 'Unexpected timeout finalization error',
      });
    }
  }

  return {
    found: rows.length,
    processed,
    alreadyFinalized,
    failed,
    failures,
  };
}

export async function listAssessmentCampaignLeads(campaignId: unknown, query: Record<string, unknown> = {}, tenantId: number | string) {
  const participations = await listAssessmentCampaignParticipations(campaignId, { ...query, page: 1, pageSize: 1000 }, tenantId);
  const leadMap = new Map<string, any>();
  for (const row of participations.data || []) {
    const key = String(row?.lead?.id || row?.lead?.documentId || row?.lead?.phone || row?.code || '');
    if (!key || !row?.lead) continue;
    if (!leadMap.has(key)) {
      leadMap.set(key, {
        lead: row.lead,
        participationCount: 0,
        latestStatus: row.status,
        latestCreatedAt: row.startedAt || null,
        collectedData: row.collectedData || null,
        sourceMetadata: row.sourceMetadata || null,
      });
    }
    const current = leadMap.get(key);
    current.participationCount += 1;
  }
  return Array.from(leadMap.values()).map((item) => ({
    ...item.lead,
    email: item?.lead?.email || item?.collectedData?.email || item?.sourceMetadata?.email || item?.sourceMetadata?.attributes?.email || '',
    participationCount: item.participationCount,
    grade: item?.sourceMetadata?.grade ?? item?.sourceMetadata?.attributes?.grade ?? item?.lead?.grade ?? null,
    status: item.latestStatus,
    createdAt: item.latestCreatedAt,
  }));
}

export async function listAssessmentCampaignResults(campaignId: unknown, query: Record<string, unknown> = {}, tenantId: number | string) {
  const participations = await listAssessmentCampaignParticipations(campaignId, { ...query, page: 1, pageSize: 1000 }, tenantId);
  const rows = (participations.data || []).filter((item: any) => item?.result?.id);
  return rows.map((item: any) => ({
    participationId: item.id,
    lead: item.lead,
    grade: item?.collectedData?.grade ?? item?.sourceMetadata?.grade ?? item?.sourceMetadata?.attributes?.grade ?? null,
    assessmentVersion: item.assessmentVersion,
    assessmentAttempt: item.assessmentAttempt,
    result: item.result,
    provisionalLevel: item?.result?.provisionalLevel || null,
    confirmedLevel: item?.result?.confirmedLevel || null,
    status: item?.result?.status || null,
  }));
}

export async function getPublicAssessmentCampaignBySlug(slug: string, tenantId: number | string) {
  const campaign = await findCampaignBySlugOrThrow(slug, tenantId, { includeChildren: true });
  const availability = isAssessmentCampaignOpen(campaign);
  if (!availability.ok) {
    throw new AssessmentCampaignError(409, availability.code);
  }
  return mapPublicCampaign(campaign);
}

export async function resolvePublicAssessmentCampaign(slug: string, body: any, tenantId: number | string) {
  const campaign = await findCampaignBySlugOrThrow(slug, tenantId, { includeChildren: true });
  const availability = isAssessmentCampaignOpen(campaign);
  if (!availability.ok) throw new AssessmentCampaignError(409, availability.code);
  const payload = extractBody(body);
  const attributes = payload?.attributes && typeof payload.attributes === 'object' && !Array.isArray(payload.attributes) ? payload.attributes : payload || {};
  const beforeStartFields = (Array.isArray(campaign?.fields) ? campaign.fields : []).filter((item: any) => toText(item?.status) === 'active' && toText(item?.collectStage) === 'before_start');
  const validationErrors = validateBeforeStartFields(beforeStartFields, attributes);
  if (validationErrors.length > 0) throw new AssessmentCampaignError(400, 'INVALID_INPUT', { fields: validationErrors });
  const parsedGrade = parseCampaignGrade(attributes?.grade);
  if (!parsedGrade.valid) throw new AssessmentCampaignError(400, 'INVALID_GRADE');
  const resolved = await resolveAssessmentCampaignAssessment(campaign.id, { grade: parsedGrade.grade }, tenantId);
  if (resolved?.status === 'NO_MATCH') {
    strapi.log.warn('[assessment-campaign] no assessment match', { tenantId, campaign: campaign.code, slug: campaign.slug, grade: parsedGrade.grade, reason: resolved?.reason, timestamp: new Date().toISOString() });
  }
  return resolved;
}

export async function startPublicAssessmentCampaign(slug: string, body: any, tenantId: number | string) {
  const campaign = await findCampaignBySlugOrThrow(slug, tenantId, { includeChildren: true });
  const availability = isAssessmentCampaignOpen(campaign);
  if (!availability.ok) throw new AssessmentCampaignError(409, availability.code);

  const payload = extractBody(body);
  const attributes = payload?.attributes && typeof payload.attributes === 'object' && !Array.isArray(payload.attributes) ? payload.attributes : payload || {};
  const beforeStartFields = (Array.isArray(campaign?.fields) ? campaign.fields : []).filter((item: any) => toText(item?.status) === 'active' && toText(item?.collectStage) === 'before_start');
  const validationErrors = validateBeforeStartFields(beforeStartFields, attributes);
  if (validationErrors.length > 0) throw new AssessmentCampaignError(400, 'INVALID_INPUT', { fields: validationErrors });

  const parsedGrade = parseCampaignGrade(attributes?.grade);
  if (!parsedGrade.valid) throw new AssessmentCampaignError(400, 'INVALID_GRADE');
  const resolved = await resolveAssessmentCampaignAssessment(campaign.id, { grade: parsedGrade.grade }, tenantId);
  if (resolved?.status === 'NO_MATCH' || resolved?.status === 'AMBIGUOUS_MATCH') {
    if (resolved?.status === 'NO_MATCH') {
      strapi.log.warn('[assessment-campaign] no assessment match', { tenantId, campaign: campaign.code, slug: campaign.slug, grade: parsedGrade.grade, reason: resolved?.reason, timestamp: new Date().toISOString() });
    }
    return resolved;
  }
  const assessmentVersion = await ensureAssessmentVersionForRule(resolved?.assessmentVersion?.id || resolved?.assessmentVersion?.documentId, tenantId);
  const matchedRuleEntity = resolved?.matchedRule?.id || resolved?.matchedRule?.documentId
    ? await ensureEntityInTenant(ASSESSMENT_CAMPAIGN_RULE_UID, resolved?.matchedRule?.id || resolved?.matchedRule?.documentId, tenantId, 'matchedRule')
    : null;
  if (toText(assessmentVersion?.versionStatus) !== 'published') {
    throw new AssessmentCampaignError(409, 'ASSESSMENT_VERSION_UNAVAILABLE');
  }

  const latestParticipation = await findLatestParticipationByCandidateIdentity(Number(campaign.id), attributes, tenantId);
  const lead = latestParticipation?.lead || await createLeadForNewRegistration(attributes);
  const existingParticipation = latestParticipation && ['created', 'verified', 'ready', 'in_progress'].includes(toText(latestParticipation?.status)) ? latestParticipation : null;
  if (existingParticipation?.assessmentAttempt?.id && ['created', 'in_progress'].includes(toText(existingParticipation?.assessmentAttempt?.status))) {
    const resumedAccess = buildPublicAccessMetadata(existingParticipation, existingParticipation.assessmentAttempt, getSourceMetadata(existingParticipation).__publicAccess || null);
    await saveAssessmentCampaignCollectedData({
      participation: existingParticipation,
      lead: lead || existingParticipation?.lead || null,
      fieldDefinitions: Array.isArray(campaign?.fields) ? campaign.fields : beforeStartFields,
      submittedData: attributes,
      stage: 'before_start',
      tenantId,
      extraParticipationData: {
        sourceMetadata: buildParticipationSourceMetadata(existingParticipation, attributes, { publicAccess: resumedAccess.session }),
      },
    });
    const refreshedParticipation = await findParticipationByAttemptOrThrow(existingParticipation.assessmentAttempt, tenantId, { includeCampaignFields: true });
    return {
      status: 'MATCHED',
      campaign: mapPublicCampaign(campaign),
      matchedRule: mapCampaignRule(refreshedParticipation?.matchedRule),
      assessmentVersion: mapSimpleRelation(refreshedParticipation?.assessmentVersion || refreshedParticipation?.matchedRule?.assessmentVersion),
      participation: mapParticipation(refreshedParticipation),
      attempt: {
        id: normalizeId(refreshedParticipation.assessmentAttempt),
        documentId: refreshedParticipation.assessmentAttempt?.documentId || null,
        code: refreshedParticipation.assessmentAttempt?.code || '',
        status: refreshedParticipation.assessmentAttempt?.status || '',
      },
      publicAccessToken: resumedAccess.token,
      publicAccessExpiresAt: resumedAccess.session.expiresAt,
      resumed: true,
    };
  }

  if (latestParticipation?.assessmentAttempt?.id && toText(latestParticipation?.assessmentAttempt?.status) === 'cancelled') {
    const resumedAccess = buildPublicAccessMetadata(latestParticipation, latestParticipation.assessmentAttempt, getSourceMetadata(latestParticipation).__publicAccess || null);
    await strapi.db.query(ASSESSMENT_CAMPAIGN_PARTICIPATION_UID).update({
      where: { id: Number(latestParticipation.id) },
      data: {
        sourceMetadata: buildParticipationSourceMetadata(latestParticipation, attributes, { publicAccess: resumedAccess.session }),
      },
    });
    const refreshedParticipation = await findParticipationByAttemptOrThrow(latestParticipation.assessmentAttempt, tenantId, { includeCampaignFields: true });
    const action = buildRecoveryActionForParticipation(refreshedParticipation);
    if (refreshedParticipation?.retakeAllowed === true) {
      return {
        status: 'RETAKE_AVAILABLE',
        campaign: mapPublicCampaign(campaign),
        participation: mapParticipation(refreshedParticipation),
        assessmentVersion: mapSimpleRelation(refreshedParticipation?.assessmentVersion || refreshedParticipation?.matchedRule?.assessmentVersion),
        attempt: {
          id: normalizeId(refreshedParticipation.assessmentAttempt),
          documentId: refreshedParticipation.assessmentAttempt?.documentId || null,
          code: refreshedParticipation.assessmentAttempt?.code || '',
          status: refreshedParticipation.assessmentAttempt?.status || '',
        },
        publicAccessToken: resumedAccess.token,
        publicAccessExpiresAt: resumedAccess.session.expiresAt,
        recovery: action,
      };
    }
    throw new AssessmentCampaignError(409, 'ATTEMPT_CANCELLED', { campaignSlug: campaign.slug, participationCode: refreshedParticipation.code });
  }

  if (latestParticipation?.assessmentAttempt?.id && ['submitted', 'expired'].includes(toText(latestParticipation?.assessmentAttempt?.status))) {
    const resumedAccess = buildPublicAccessMetadata(latestParticipation, latestParticipation.assessmentAttempt, getSourceMetadata(latestParticipation).__publicAccess || null);
    await strapi.db.query(ASSESSMENT_CAMPAIGN_PARTICIPATION_UID).update({
      where: { id: Number(latestParticipation.id) },
      data: {
        sourceMetadata: buildParticipationSourceMetadata(latestParticipation, attributes, { publicAccess: resumedAccess.session }),
      },
    });
    const refreshedParticipation = await findParticipationByAttemptOrThrow(latestParticipation.assessmentAttempt, tenantId, { includeCampaignFields: true });
    const action = buildRecoveryActionForParticipation(refreshedParticipation);
    return {
      status: action.action === 'view_result' || action.action === 'view_result_status' ? 'MATCHED' : action.action === 'start_retake' ? 'RETAKE_AVAILABLE' : 'MATCHED',
      campaign: mapPublicCampaign(campaign),
      participation: mapParticipation(refreshedParticipation),
      assessmentVersion: mapSimpleRelation(refreshedParticipation?.assessmentVersion || refreshedParticipation?.matchedRule?.assessmentVersion),
      attempt: {
        id: normalizeId(refreshedParticipation.assessmentAttempt),
        documentId: refreshedParticipation.assessmentAttempt?.documentId || null,
        code: refreshedParticipation.assessmentAttempt?.code || '',
        status: refreshedParticipation.assessmentAttempt?.status || '',
      },
      publicAccessToken: resumedAccess.token,
      publicAccessExpiresAt: resumedAccess.session.expiresAt,
      recovery: action,
      resumed: false,
    };
  }

  const participation = existingParticipation?.id
    ? existingParticipation
    : await strapi.db.query(ASSESSMENT_CAMPAIGN_PARTICIPATION_UID).create({
        data: {
          code: await generateParticipationCode(tenantId),
          assessmentCampaign: Number(campaign.id),
          lead: lead?.id ? Number(lead.id) : null,
          matchedRule: matchedRuleEntity?.id || null,
          assessmentVersion: assessmentVersion.id,
          status: 'verified',
          verifiedAt: new Date().toISOString(),
          assessmentVersionSnapshot: {
            ruleCode: resolved?.matchedRule?.code || null,
            assessmentCode: resolved?.assessment?.code || null,
            assessmentVersionCode: resolved?.assessmentVersion?.code || null,
            resolvedAt: new Date().toISOString(),
          },
          sourceMetadata: buildParticipationSourceMetadata(null, attributes),
          tenant: tenantId,
        },
      });

  const attemptPayload = await startAssessmentAttempt(assessmentVersion.id, {
    resumeExisting: true,
    sourceType: 'campaign',
    sourceRef: participation?.code || participation?.documentId || participation?.id,
    lead: lead?.id ? Number(lead.id) : null,
    candidateNameSnapshot: toText(attributes?.fullName || attributes?.studentName || attributes?.name || ''),
    candidateEmailSnapshot: toText(attributes?.email || ''),
    candidatePhoneSnapshot: toText(attributes?.phone || attributes?.parentPhone || ''),
  }, tenantId, {});

  const attemptRef = attemptPayload?.attempt?.documentId || attemptPayload?.attempt?.id || null;
  const attemptEntity = attemptRef ? await ensureEntityInTenant(ASSESSMENT_ATTEMPT_UID, attemptRef, tenantId, 'assessmentAttempt') : null;
  if (!attemptEntity?.id) throw new AssessmentCampaignError(500, 'START_ATTEMPT_FAILED');
  const publicAccess = buildPublicAccessMetadata(participation, attemptEntity, getSourceMetadata(participation).__publicAccess || null);
  await saveAssessmentCampaignCollectedData({
    participation,
    lead,
    fieldDefinitions: Array.isArray(campaign?.fields) ? campaign.fields : beforeStartFields,
    submittedData: attributes,
    stage: 'before_start',
    tenantId,
    extraParticipationData: {
      matchedRule: matchedRuleEntity?.id || null,
      assessmentVersion: assessmentVersion.id,
      assessmentAttempt: attemptEntity.id,
      status: 'in_progress',
      startedAt: participation?.startedAt || new Date().toISOString(),
      verifiedAt: participation?.verifiedAt || new Date().toISOString(),
      assessmentStartedAt: new Date().toISOString(),
      sourceMetadata: buildParticipationSourceMetadata(participation, attributes, { publicAccess: publicAccess.session }),
      assessmentVersionSnapshot: {
        ruleCode: resolved?.matchedRule?.code || null,
        assessmentCode: resolved?.assessment?.code || null,
        assessmentVersionCode: resolved?.assessmentVersion?.code || null,
        resolvedAt: new Date().toISOString(),
      },
    },
  });

  const linked = await strapi.db.query(ASSESSMENT_CAMPAIGN_PARTICIPATION_UID).findOne({
    where: mergeTenantWhere({ id: { $eq: Number(participation.id) } }, tenantId),
    populate: {
      lead: true,
      matchedRule: { populate: { assessmentVersion: { select: ['id', 'documentId', 'code', 'title'] } } },
      assessmentVersion: { select: ['id', 'documentId', 'code', 'title'] },
      assessmentAttempt: { select: ['id', 'documentId', 'code', 'status'] },
    },
  });

  return {
    status: 'MATCHED',
    campaign: mapPublicCampaign(campaign),
    matchedRule: mapCampaignRule(linked?.matchedRule),
    assessmentVersion: mapSimpleRelation(linked?.assessmentVersion),
    participation: mapParticipation(linked),
    attempt: {
      id: normalizeId(linked?.assessmentAttempt),
      documentId: linked?.assessmentAttempt?.documentId || null,
      code: linked?.assessmentAttempt?.code || '',
      status: linked?.assessmentAttempt?.status || '',
    },
    publicAccessToken: publicAccess.token,
    publicAccessExpiresAt: publicAccess.session.expiresAt,
    resumed: false,
  };
}

export async function getAssessmentCampaignResultGate(attemptRef: unknown, tenantId: number | string, publicAccessToken: string) {
  const gate = await buildAssessmentCampaignResultGate(attemptRef, tenantId, publicAccessToken);
  if (!gate.canViewResult) {
    return {
      canViewResult: false,
      reason: gate.reason,
      missingFields: gate.missingFields,
      fields: gate.fields,
      profile: gate.profile,
      campaign: gate.campaign,
      attempt: gate.attempt,
      participation: gate.participation,
      candidateResult: null,
    };
  }
  const candidateResult = await getCandidateAssessmentResultPayloadByAttempt(gate.context.attempt.id, tenantId);
  return {
    canViewResult: true,
    reason: null,
    missingFields: [],
    fields: gate.fields,
    profile: gate.profile,
    campaign: gate.campaign,
    attempt: gate.attempt,
    participation: gate.participation,
    candidateResult,
  };
}

export async function restorePublicAssessmentAttemptAccess(attemptRef: unknown, body: any, tenantId: number | string) {
  const payload = extractBody(body);
  const email = normalizeEmail(payload?.email);
  if (!validateEmail(email)) throw new AssessmentCampaignError(400, 'INVALID_EMAIL');
  validateRecoveryOtp(payload?.otp);

  const attempt = await ensureEntityInTenant(ASSESSMENT_ATTEMPT_UID, attemptRef, tenantId, 'assessmentAttempt');
  if (!attempt?.id) throw new AssessmentCampaignError(404, 'ATTEMPT_NOT_FOUND');
  if (toText(attempt?.sourceType) !== 'campaign') throw new AssessmentCampaignError(400, 'ATTEMPT_IS_NOT_CAMPAIGN');

  const participation = await findParticipationByAttemptOrThrow(attempt, tenantId, { includeCampaignFields: true });
  if (!doesParticipationBelongToEmail(participation, email)) {
    throw new AssessmentCampaignError(403, 'ATTEMPT_NOT_OWNED');
  }

  const refreshed = await refreshParticipationPublicAccess(participation, tenantId);
  return {
    status: 'ACCESS_GRANTED',
    email,
    campaign: mapPublicCampaign(refreshed.participation?.assessmentCampaign),
    participation: mapParticipation(refreshed.participation),
    attempt: {
      id: normalizeId(refreshed.attempt),
      documentId: refreshed.attempt?.documentId || null,
      code: refreshed.attempt?.code || '',
      status: refreshed.attempt?.status || '',
      submittedAt: refreshed.attempt?.submittedAt || null,
    },
    publicAccessToken: refreshed.publicAccess.token,
    publicAccessExpiresAt: refreshed.publicAccess.session.expiresAt,
    recovery: buildRecoveryActionForParticipation(refreshed.participation),
  };
}

export async function recoverPublicAssessmentCampaignParticipations(slug: string, body: any, tenantId: number | string) {
  const payload = extractBody(body);
  const email = normalizeEmail(payload?.email);
  if (!validateEmail(email)) throw new AssessmentCampaignError(400, 'INVALID_EMAIL');
  validateRecoveryOtp(payload?.otp);

  const campaign = await findCampaignBySlugOrThrow(slug, tenantId, { includeChildren: true });
  const rows = await strapi.db.query(ASSESSMENT_CAMPAIGN_PARTICIPATION_UID).findMany({
    where: mergeTenantWhere({ assessmentCampaign: { id: { $eq: Number(campaign.id) } } }, tenantId),
    populate: {
      lead: true,
      assessmentAttempt: { select: ['id', 'documentId', 'code', 'status', 'startedAt', 'submittedAt'] },
      matchedRule: { populate: { assessmentVersion: { select: ['id', 'documentId', 'code', 'title'] } } },
      assessmentVersion: { select: ['id', 'documentId', 'code', 'title'] },
      assessmentCampaign: { populate: { fields: { orderBy: [{ order: 'asc' }, { id: 'asc' }] } } },
    },
    orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
  });
  const owned = (rows || []).filter((row: any) => row?.assessmentAttempt?.id && doesParticipationBelongToEmail(row, email));
  if (owned.length === 0) throw new AssessmentCampaignError(403, 'ATTEMPT_NOT_OWNED');

  const sorted = [...owned].sort((left: any, right: any) => {
    const leftPriority = getParticipationPriority(toText(left?.status));
    const rightPriority = getParticipationPriority(toText(right?.status));
    if (leftPriority !== rightPriority) return leftPriority - rightPriority;
    return new Date(right?.submittedAt || right?.assessmentStartedAt || right?.startedAt || right?.updatedAt || 0).getTime()
      - new Date(left?.submittedAt || left?.assessmentStartedAt || left?.startedAt || left?.updatedAt || 0).getTime();
  });

  const recovered = [];
  for (const participation of sorted) {
    recovered.push(await refreshParticipationPublicAccess(participation, tenantId));
  }

  return {
    status: 'RECOVERED',
    email,
    campaign: mapPublicCampaign(campaign),
    participations: recovered.map((item, index) => ({
      ...mapRecoveredParticipation(item.participation, item.publicAccess),
      recovery: {
        ...mapRecoveredParticipation(item.participation, item.publicAccess).recovery,
        suggested: index === 0,
      },
    })),
  };
}

export async function cancelAssessmentCampaignAttempt(attemptRef: unknown, body: any, tenantId: number | string, context: { authUserId?: number | string | null } = {}) {
  const attempt = await ensureEntityInTenant(ASSESSMENT_ATTEMPT_UID, attemptRef, tenantId, 'assessmentAttempt');
  if (!attempt?.id) throw new AssessmentCampaignError(404, 'ATTEMPT_NOT_FOUND');
  if (toText(attempt?.sourceType) !== 'campaign') throw new AssessmentCampaignError(400, 'ATTEMPT_IS_NOT_CAMPAIGN');
  if (toText(attempt?.status) === 'cancelled') throw new AssessmentCampaignError(409, 'ATTEMPT_ALREADY_CANCELLED');

  const payload = extractBody(body);
  const cancelReason = parseRetakeReason(payload?.cancelReason || payload?.reason, 'cancelReason');
  const cancelNote = toNullableText(payload?.cancelNote || payload?.note);
  if (cancelReason === 'other' && !cancelNote) throw new AssessmentCampaignError(400, 'cancelNote is required');
  const actor = await ensureUserEntity(context?.authUserId || payload?.cancelledBy);
  const participation = await findParticipationByAttemptOrThrow(attempt, tenantId, { includeCampaignFields: true });

  await strapi.db.query(ASSESSMENT_ATTEMPT_UID).update({
    where: { id: Number(attempt.id) },
    data: {
      status: 'cancelled',
      cancelledAt: new Date().toISOString(),
      cancelledBy: actor?.id ? Number(actor.id) : null,
      cancelReason,
      cancelNote,
    },
  });
  await invalidateAttemptCurrentArtifacts(Number(attempt.id), tenantId);
  await strapi.db.query(ASSESSMENT_CAMPAIGN_PARTICIPATION_UID).update({
    where: { id: Number(participation.id) },
    data: {
      status: 'cancelled',
    },
  });

  const refreshedAttempt = await ensureEntityInTenant(ASSESSMENT_ATTEMPT_UID, attemptRef, tenantId, 'assessmentAttempt');
  const refreshedParticipation = await findParticipationByAttemptOrThrow(refreshedAttempt, tenantId, { includeCampaignFields: true });
  return {
    attempt: {
      id: normalizeId(refreshedAttempt),
      documentId: refreshedAttempt?.documentId || null,
      code: refreshedAttempt?.code || '',
      status: refreshedAttempt?.status || '',
      cancelledAt: refreshedAttempt?.cancelledAt || null,
      cancelReason: refreshedAttempt?.cancelReason || null,
      cancelNote: refreshedAttempt?.cancelNote || '',
      cancelledBy: mapUserSummary(refreshedAttempt?.cancelledBy),
    },
    participation: mapParticipation(refreshedParticipation),
  };
}

export async function allowAssessmentCampaignRetake(attemptRef: unknown, body: any, tenantId: number | string, context: { authUserId?: number | string | null } = {}) {
  const attempt = await ensureEntityInTenant(ASSESSMENT_ATTEMPT_UID, attemptRef, tenantId, 'assessmentAttempt');
  if (!attempt?.id) throw new AssessmentCampaignError(404, 'ATTEMPT_NOT_FOUND');
  if (toText(attempt?.sourceType) !== 'campaign') throw new AssessmentCampaignError(400, 'ATTEMPT_IS_NOT_CAMPAIGN');
  if (toText(attempt?.status) !== 'cancelled') throw new AssessmentCampaignError(409, 'ATTEMPT_NOT_CANCELLED');

  const payload = extractBody(body);
  const retakeReason = parseRetakeReason(payload?.retakeReason || payload?.reason || 'admin_decision', 'retakeReason');
  const retakeNote = toNullableText(payload?.retakeNote || payload?.note);
  if (retakeReason === 'other' && !retakeNote) throw new AssessmentCampaignError(400, 'retakeNote is required');
  const actor = await ensureUserEntity(context?.authUserId || payload?.retakeAllowedBy);
  const participation = await findParticipationByAttemptOrThrow(attempt, tenantId, { includeCampaignFields: true });

  await strapi.db.query(ASSESSMENT_CAMPAIGN_PARTICIPATION_UID).update({
    where: { id: Number(participation.id) },
    data: {
      retakeAllowed: true,
      retakeAllowedAt: new Date().toISOString(),
      retakeAllowedBy: actor?.id ? Number(actor.id) : null,
      retakeReason,
      retakeNote,
      status: 'cancelled',
    },
  });
  const refreshedParticipation = await findParticipationByAttemptOrThrow(attempt, tenantId, { includeCampaignFields: true });
  return {
    participation: mapParticipation(refreshedParticipation),
    recovery: buildRecoveryActionForParticipation(refreshedParticipation),
  };
}

export async function startAssessmentCampaignRetake(attemptRef: unknown, tenantId: number | string, publicAccessToken: string) {
  const context = await resolvePublicCampaignAttemptContext(attemptRef, tenantId, publicAccessToken);
  const participation = context.participation;
  const currentAttempt = context.attempt;
  if (toText(currentAttempt?.status) !== 'cancelled') throw new AssessmentCampaignError(409, 'ATTEMPT_NOT_CANCELLED');

  const existingActiveAttempt = await findActiveAttemptByParticipationCode(participation?.code || '', tenantId);
  if (existingActiveAttempt?.id) {
    const publicAccess = buildPublicAccessMetadata(participation, existingActiveAttempt, getSourceMetadata(participation).__publicAccess || null);
    await strapi.db.query(ASSESSMENT_CAMPAIGN_PARTICIPATION_UID).update({
      where: { id: Number(participation.id) },
      data: {
        assessmentAttempt: Number(existingActiveAttempt.id),
        retakeAllowed: false,
        sourceMetadata: buildParticipationSourceMetadata(participation, readParticipationAttributes(participation), { publicAccess: publicAccess.session }),
      },
    });
    return buildRetakeAttemptResponse(participation, existingActiveAttempt, tenantId, publicAccess, true);
  }

  if (participation?.retakeAllowed !== true) throw new AssessmentCampaignError(409, 'RETAKE_NOT_ALLOWED');
  const version = await ensureRetakeVersionUsable(participation, tenantId);

  const attemptPayload = await startAssessmentAttempt(version.id, {
    resumeExisting: true,
    sourceType: 'campaign',
    sourceRef: participation?.code || participation?.documentId || participation?.id,
    lead: participation?.lead?.id ? Number(participation.lead.id) : null,
    candidateNameSnapshot: toText(readParticipationAttributes(participation)?.fullName || participation?.lead?.fullName || ''),
    candidateEmailSnapshot: toText(readParticipationAttributes(participation)?.email || participation?.lead?.message || ''),
    candidatePhoneSnapshot: toText(readParticipationAttributes(participation)?.phone || readParticipationAttributes(participation)?.parentPhone || participation?.lead?.phone || ''),
  }, tenantId, {});

  const nextAttemptRef = attemptPayload?.attempt?.documentId || attemptPayload?.attempt?.id || null;
  const nextAttempt = nextAttemptRef ? await ensureEntityInTenant(ASSESSMENT_ATTEMPT_UID, nextAttemptRef, tenantId, 'assessmentAttempt') : null;
  if (!nextAttempt?.id) throw new AssessmentCampaignError(500, 'START_ATTEMPT_FAILED');

  const publicAccess = buildPublicAccessMetadata(participation, nextAttempt, getSourceMetadata(participation).__publicAccess || null);
  await strapi.db.query(ASSESSMENT_CAMPAIGN_PARTICIPATION_UID).update({
    where: { id: Number(participation.id) },
    data: {
      assessmentAttempt: Number(nextAttempt.id),
      status: 'in_progress',
      startedAt: participation?.startedAt || new Date().toISOString(),
      assessmentStartedAt: new Date().toISOString(),
      retakeAllowed: false,
      retakeCount: Number(participation?.retakeCount || 0) + 1,
      sourceMetadata: buildParticipationSourceMetadata(participation, readParticipationAttributes(participation), { publicAccess: publicAccess.session }),
    },
  });
  return buildRetakeAttemptResponse(participation, nextAttempt, tenantId, publicAccess, false);
}

export async function completeAssessmentCampaignResultProfile(attemptRef: unknown, body: any, tenantId: number | string, publicAccessToken: string) {
  const gate = await buildAssessmentCampaignResultGate(attemptRef, tenantId, publicAccessToken);
  const payload = extractBody(body);
  const attributes = payload?.attributes && typeof payload.attributes === 'object' && !Array.isArray(payload.attributes) ? payload.attributes : payload || {};
  const allowedFields = getStageFields(gate.context.campaign, 'before_result');
  const allowedKeys = new Set(allowedFields.map((field: any) => toText(field.key)).filter(Boolean));
  const incomingKeys = Object.keys(attributes || {}).filter((key) => !allowedKeys.has(toText(key)));
  if (incomingKeys.length > 0) throw new AssessmentCampaignError(400, 'INVALID_INPUT', { unsupportedFields: incomingKeys });

  const mergedAttributes = { ...gate.context.attributes };
  for (const field of allowedFields) {
    const key = toText(field?.key);
    if (!key) continue;
    if (Object.prototype.hasOwnProperty.call(attributes || {}, key)) mergedAttributes[key] = attributes[key];
  }
  const validationErrors = allowedFields
    .flatMap((field: any) => {
      const result = normalizeAssessmentCampaignFieldValue(field, mergedAttributes[field.key]);
      return result.errors.map((error) => ({ key: error.key, message: error.message }));
    });
  if (validationErrors.length > 0) throw new AssessmentCampaignError(400, 'INVALID_INPUT', { fields: validationErrors });

  const stageSubmittedData = allowedFields.reduce((result: Record<string, any>, field: any) => {
    const key = toText(field?.key);
    if (!key) return result;
    if (Object.prototype.hasOwnProperty.call(mergedAttributes, key)) result[key] = mergedAttributes[key];
    return result;
  }, {});

  let lead = await ensureParticipationLead(gate.context.participation, mergedAttributes);

  const existingProfileMeta = getSourceMetadata(gate.context.participation).__profile;
  await saveAssessmentCampaignCollectedData({
    participation: gate.context.participation,
    lead,
    fieldDefinitions: allowedFields,
    submittedData: stageSubmittedData,
    stage: 'before_result',
    tenantId,
    extraParticipationData: {
      status: gate.context.attempt?.submittedAt ? 'submitted' : gate.context.participation?.status || 'verified',
      submittedAt: gate.context.attempt?.submittedAt || gate.context.participation?.submittedAt || null,
      sourceMetadata: buildParticipationSourceMetadata(gate.context.participation, mergedAttributes, {
        publicAccess: getSourceMetadata(gate.context.participation).__publicAccess || null,
        profile: {
          ...(existingProfileMeta && typeof existingProfileMeta === 'object' ? existingProfileMeta : {}),
          beforeResultCompletedAt: new Date().toISOString(),
        },
      }),
    },
  });

  return getAssessmentCampaignResultGate(attemptRef, tenantId, publicAccessToken);
}

export default {
  getTenantIdFromContext,
  listAssessmentCampaigns,
  getAssessmentCampaignDetail,
  createAssessmentCampaign,
  updateAssessmentCampaign,
  listAssessmentCampaignFields,
  createAssessmentCampaignField,
  updateAssessmentCampaignField,
  deleteAssessmentCampaignField,
  reorderAssessmentCampaignFields,
  listAssessmentCampaignRules,
  createAssessmentCampaignRule,
  updateAssessmentCampaignRule,
  deleteAssessmentCampaignRule,
  resolveAssessmentCampaignAssessment,
  listAssessmentCampaignParticipations,
  listAssessmentCampaignLeads,
  listAssessmentCampaignResults,
  getPublicAssessmentCampaignBySlug,
  resolvePublicAssessmentCampaign,
  startPublicAssessmentCampaign,
  resolvePublicAssessmentAttemptAccess,
  cancelAssessmentCampaignAttempt,
  finalizeAssessmentCampaignAttemptTimeout,
  finalizeOverdueAssessmentCampaignAttempts,
  allowAssessmentCampaignRetake,
  startAssessmentCampaignRetake,
  restorePublicAssessmentAttemptAccess,
  recoverPublicAssessmentCampaignParticipations,
  getAssessmentCampaignResultGate,
  completeAssessmentCampaignResultProfile,
};