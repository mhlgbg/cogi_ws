import { extractRelationRef, findEntityByRef, mergeTenantWhere, normalizeSortInput, resolveCurrentTenantId, toText, whereByParam } from '../../../utils/tenant-scope';

const ASSESSMENT_ATTEMPT_UID = 'api::assessment-attempt.assessment-attempt';
const ASSESSMENT_ANSWER_UID = 'api::assessment-answer.assessment-answer';
const ASSESSMENT_RESULT_UID = 'api::assessment-result.assessment-result';
const ASSESSMENT_ANSWER_SCORE_UID = 'api::assessment-answer-score.assessment-answer-score';
const ASSESSMENT_PLACEMENT_RULE_UID = 'api::assessment-placement-rule.assessment-placement-rule';
const ASSESSMENT_SPEAKING_REVIEW_UID = 'api::assessment-speaking-review.assessment-speaking-review';
const ASSESSMENT_SPEAKING_CRITERION_UID = 'api::assessment-speaking-criterion.assessment-speaking-criterion';
const ASSESSMENT_PLACEMENT_CONFIRMATION_UID = 'api::assessment-placement-confirmation.assessment-placement-confirmation';
const ASSESSMENT_UID = 'api::assessment.assessment';
const ASSESSMENT_VERSION_UID = 'api::assessment-version.assessment-version';
const ASSESSMENT_QUESTION_UID = 'api::assessment-question.assessment-question';
const QUESTION_UID = 'api::question.question';
const FILE_ASSET_UID = 'api::file-asset.file-asset';
const USER_UID = 'plugin::users-permissions.user';
const LEARNER_UID = 'api::learner.learner';
const LEAD_UID = 'api::lead.lead';
const TENANT_UID = 'api::tenant.tenant';

const AUTO_SCORABLE_TYPES = new Set(['single_choice', 'multiple_choice', 'true_false']);
const PENDING_MANUAL_TYPES = new Set(['essay', 'short_answer', 'fill_blank', 'ordering', 'matching']);
const CEFR_LEVELS = ['PRE_A1', 'A1', 'A2', 'B1', 'B2', 'C1', 'C2'] as const;

type ScoreContext = {
  authUserId?: number | string | null;
};

class AssessmentScoringError extends Error {
  status: number;
  details: any;

  constructor(status: number, message: string, details: any = null) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

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
  if (!text) throw new AssessmentScoringError(400, `${fieldName} is required`);
  return text;
}

function parseOptionalDecimal(value: unknown, fieldName: string): number | null {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) throw new AssessmentScoringError(400, `${fieldName} must be a valid number`);
  return parsed;
}

function parseRequiredInteger(value: unknown, fieldName: string): number {
  const parsed = Number(value);
  if (!Number.isInteger(parsed)) throw new AssessmentScoringError(400, `${fieldName} must be an integer`);
  return parsed;
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

function parseDateBoundary(value: unknown, fieldName: string, boundary: 'start' | 'end') {
  const text = toText(value);
  if (!text) return null;
  const parsed = new Date(text);
  if (Number.isNaN(parsed.getTime())) throw new AssessmentScoringError(400, `${fieldName} must be a valid date`);
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) {
    if (boundary === 'start') parsed.setHours(0, 0, 0, 0);
    else parsed.setHours(23, 59, 59, 999);
  }
  return parsed.toISOString();
}

function compareCefrLevel(left: string | null | undefined, right: string | null | undefined) {
  if (!left || !right) return 0;
  return CEFR_LEVELS.indexOf(left as any) - CEFR_LEVELS.indexOf(right as any);
}

function isValidCefrLevel(value: unknown) {
  const text = toText(value).toUpperCase();
  return !text || CEFR_LEVELS.includes(text as any);
}

function toRoundedPercentage(rawScore: number, maxScore: number) {
  if (!Number.isFinite(rawScore) || !Number.isFinite(maxScore) || maxScore <= 0) return null;
  return Number(((rawScore / maxScore) * 100).toFixed(2));
}

function sortByOrder<T extends Record<string, any>>(rows: T[] = []) {
  return [...rows].sort((left, right) => {
    const leftOrder = Number(left?.order || 0);
    const rightOrder = Number(right?.order || 0);
    if (leftOrder !== rightOrder) return leftOrder - rightOrder;
    return String(normalizeId(left) || '').localeCompare(String(normalizeId(right) || ''));
  });
}

function toSelectionSet(value: unknown) {
  return new Set(Array.isArray(value) ? value.map((item) => String(item || '').trim()).filter(Boolean) : []);
}

function sameSelection(left: Set<string>, right: Set<string>) {
  if (left.size !== right.size) return false;
  for (const value of left) {
    if (!right.has(value)) return false;
  }
  return true;
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

function resolveCandidateDisplayName(attempt: any) {
  return toText(
    attempt?.candidateNameSnapshot
    || attempt?.learner?.fullName
    || attempt?.lead?.fullName
    || attempt?.user?.fullName
    || attempt?.user?.username
    || attempt?.user?.email,
  ) || null;
}

function mapAttempt(row: any) {
  return {
    id: normalizeId(row),
    documentId: row?.documentId || null,
    code: row?.code || '',
    status: row?.status || '',
    startedAt: row?.startedAt || null,
    submittedAt: row?.submittedAt || null,
    expiresAt: row?.expiresAt || null,
    sourceType: row?.sourceType || null,
    sourceRef: row?.sourceRef || null,
    candidateNameSnapshot: row?.candidateNameSnapshot || null,
    candidateEmailSnapshot: row?.candidateEmailSnapshot || null,
    candidatePhoneSnapshot: row?.candidatePhoneSnapshot || null,
    cancelledAt: row?.cancelledAt || null,
    cancelledBy: mapUserSummary(row?.cancelledBy),
    cancelReason: row?.cancelReason || null,
    cancelNote: row?.cancelNote || '',
    candidateDisplayName: resolveCandidateDisplayName(row),
    assessment: mapSimpleRelation(row?.assessment),
    assessmentVersion: mapSimpleRelation(row?.assessmentVersion),
    user: mapUserSummary(row?.user),
    learner: row?.learner ? { id: normalizeId(row.learner), documentId: row?.learner?.documentId || null, code: row?.learner?.code || '', fullName: row?.learner?.fullName || '' } : null,
    lead: row?.lead ? { id: normalizeId(row.lead), documentId: row?.lead?.documentId || null, fullName: row?.lead?.fullName || '', phone: row?.lead?.phone || '' } : null,
  };
}

function mapAnswer(row: any) {
  return {
    id: normalizeId(row),
    dbId: normalizeDbId(row),
    documentId: row?.documentId || null,
    answerData: row?.answerData ?? null,
    questionSnapshot: row?.questionSnapshot ?? null,
    timeSpentSeconds: Number(row?.timeSpentSeconds || 0),
    audioPlayCount: Number(row?.audioPlayCount || 0),
    assessmentQuestion: mapSimpleRelation(row?.assessmentQuestion),
    question: mapSimpleRelation(row?.question),
  };
}

function mapAnswerScore(row: any) {
  return {
    id: normalizeId(row),
    documentId: row?.documentId || null,
    status: row?.status || 'pending',
    awardedPoints: row?.awardedPoints ?? null,
    maxPoints: row?.maxPoints ?? null,
    isCorrect: row?.isCorrect ?? null,
    scoringMethod: row?.scoringMethod || 'none',
    manualScoreRequired: row?.manualScoreRequired === true,
    manualScoreNote: row?.manualScoreNote || '',
    manualScoredAt: row?.manualScoredAt || null,
    scoredBy: mapUserSummary(row?.scoredBy),
    assessmentQuestion: mapSimpleRelation(row?.assessmentQuestion),
    question: mapSimpleRelation(row?.question),
  };
}

function mapSpeakingCriterion(row: any) {
  return {
    id: normalizeId(row),
    documentId: row?.documentId || null,
    code: row?.code || '',
    label: row?.label || '',
    description: row?.description || '',
    guidance: row?.guidance || '',
    order: Number(row?.order || 0),
    maxScore: row?.maxScore ?? null,
    weight: row?.weight ?? null,
    required: row?.required !== false,
    status: row?.status || 'active',
    assessmentVersion: mapSimpleRelation(row?.assessmentVersion),
  };
}

function mapFileAssetSummary(row: any) {
  if (!row) return null;
  return {
    id: normalizeId(row),
    documentId: row?.documentId || null,
    code: row?.code || '',
    originalName: row?.originalName || '',
    fileName: row?.fileName || '',
    mimeType: row?.mimeType || '',
    url: row?.url || '',
    relativePath: row?.relativePath || '',
    provider: row?.provider || '',
  };
}

function mapSpeakingReview(row: any) {
  if (!row) return null;
  return {
    id: normalizeId(row),
    documentId: row?.documentId || null,
    status: row?.status || 'pending',
    reviewMode: row?.reviewMode || 'live',
    recordingAsset: mapFileAssetSummary(row?.recordingAsset),
    reviewStartedAt: row?.reviewStartedAt || null,
    reviewedAt: row?.reviewedAt || null,
    overallScore: row?.overallScore ?? null,
    maxScore: row?.maxScore ?? null,
    overallMaxScore: row?.maxScore ?? null,
    percentage: row?.percentage ?? null,
    criteriaSnapshot: row?.criteriaSnapshot ?? [],
    criteriaScores: row?.criteriaScores ?? [],
    promptNotes: row?.promptNotes || '',
    reviewNotes: row?.reviewNotes || '',
    strengths: row?.strengths || '',
    areasForImprovement: row?.areasForImprovement || '',
    suggestedLevel: row?.suggestedLevel || null,
    reviewer: mapUserSummary(row?.reviewer),
  };
}

function mapPlacementConfirmation(row: any) {
  if (!row) return null;
  return {
    id: normalizeId(row),
    documentId: row?.documentId || null,
    status: row?.status || 'draft',
    decision: row?.decision || null,
    provisionalLevelSnapshot: row?.provisionalLevelSnapshot || null,
    provisionalBandCodeSnapshot: row?.provisionalBandCodeSnapshot || null,
    provisionalLabelSnapshot: row?.provisionalLabelSnapshot || null,
    speakingSuggestedLevelSnapshot: row?.speakingSuggestedLevelSnapshot || null,
    speakingSummarySnapshot: row?.speakingSummarySnapshot ?? null,
    resultSnapshot: row?.resultSnapshot ?? null,
    confirmedLevel: row?.confirmedLevel || null,
    confirmedBandCode: row?.confirmedBandCode || null,
    confirmedLabel: row?.confirmedLabel || null,
    confirmationNote: row?.confirmationNote || '',
    confirmedAt: row?.confirmedAt || null,
    isCurrent: row?.isCurrent !== false,
    confirmedBy: mapUserSummary(row?.confirmedBy),
  };
}

function mapCandidateSafeResultPreview(payload: any) {
  if (!payload) return null;
  return {
    attempt: payload?.attempt ? {
      code: payload.attempt.code || '',
      status: payload.attempt.status || '',
      startedAt: payload.attempt.startedAt || null,
      submittedAt: payload.attempt.submittedAt || null,
      candidateName: payload.attempt.candidateName || null,
    } : null,
    assessment: payload?.assessment ? {
      code: payload.assessment.code || '',
      name: payload.assessment.name || '',
    } : null,
    version: payload?.version ? {
      code: payload.version.code || '',
      title: payload.version.title || '',
      resultMode: payload.version.resultMode || 'provisional',
      requiresSpeaking: payload.version.requiresSpeaking !== false,
      requiresTeacherConfirmation: payload.version.requiresTeacherConfirmation !== false,
    } : null,
    result: payload?.result ? {
      status: payload.result.status || 'pending',
      rawScore: payload.result.rawScore ?? null,
      maxScore: payload.result.maxScore ?? null,
      percentage: payload.result.percentage ?? null,
      provisionalLevel: payload.result.provisionalLevel || null,
      placementLabel: payload.result.placementLabel || null,
      pendingManualCount: Number(payload.result.pendingManualCount || 0),
      pendingManualMaxScore: payload.result.pendingManualMaxScore ?? null,
      configuredTotalMaxScore: payload.result.configuredTotalMaxScore ?? null,
      sectionScores: Array.isArray(payload.result.sectionScores) ? payload.result.sectionScores : [],
    } : null,
    speaking: payload?.speaking ? {
      status: payload.speaking.status || 'pending',
      reviewMode: payload.speaking.reviewMode || 'live',
      overallScore: payload.speaking.overallScore ?? null,
      overallMaxScore: payload.speaking.overallMaxScore ?? payload.speaking.maxScore ?? null,
      percentage: payload.speaking.percentage ?? null,
      suggestedLevel: payload.speaking.suggestedLevel || null,
      reviewedAt: payload.speaking.reviewedAt || null,
    } : null,
    confirmation: payload?.confirmation ? {
      status: payload.confirmation.status || 'draft',
      confirmedLevel: payload.confirmation.confirmedLevel || null,
      confirmedLabel: payload.confirmation.confirmedLabel || null,
      confirmedAt: payload.confirmation.confirmedAt || null,
    } : null,
    workflowState: payload?.workflowState || 'scoring',
    statusBanner: payload?.statusBanner || null,
    revealScores: payload?.revealScores === true,
  };
}

function mapResult(row: any) {
  return {
    id: normalizeId(row),
    documentId: row?.documentId || null,
    code: row?.code || '',
    status: row?.status || 'pending',
    resultMode: row?.resultMode || 'provisional',
    scoringVersion: Number(row?.scoringVersion || 1),
    scoringStartedAt: row?.scoringStartedAt || null,
    scoredAt: row?.scoredAt || null,
    rawScore: row?.rawScore ?? null,
    maxScore: row?.maxScore ?? null,
    percentage: row?.percentage ?? null,
    objectiveScore: row?.objectiveScore ?? null,
    objectiveMaxScore: row?.objectiveMaxScore ?? null,
    manualScore: row?.manualScore ?? null,
    manualMaxScore: row?.manualMaxScore ?? null,
    pendingManualCount: Number(row?.pendingManualCount || 0),
    pendingManualMaxScore: row?.pendingManualMaxScore ?? null,
    configuredTotalMaxScore: row?.configuredTotalMaxScore ?? null,
    sectionScores: row?.sectionScores ?? [],
    scoreSummary: row?.scoreSummary ?? null,
    provisionalLevel: row?.provisionalLevel || null,
    placementBandCode: row?.placementBandCode || null,
    placementLabel: row?.placementLabel || null,
    placementNotes: row?.placementNotes || null,
    speakingReviewStatus: row?.speakingReviewStatus || null,
    speakingSuggestedLevel: row?.speakingSuggestedLevel || null,
    speakingReviewedAt: row?.speakingReviewedAt || null,
    confirmationStatus: row?.confirmationStatus || null,
    confirmedLevel: row?.confirmedLevel || null,
    confirmedBandCode: row?.confirmedBandCode || null,
    confirmedLabel: row?.confirmedLabel || null,
    confirmedAt: row?.confirmedAt || null,
    resultSnapshot: row?.resultSnapshot ?? null,
    isCurrent: row?.isCurrent !== false,
    attempt: mapAttempt(row?.attempt),
    assessment: mapSimpleRelation(row?.assessment),
    assessmentVersion: mapSimpleRelation(row?.assessmentVersion),
    answerScores: Array.isArray(row?.answerScores) ? row.answerScores.map(mapAnswerScore) : [],
  };
}

function mapPlacementRule(row: any) {
  return {
    id: normalizeId(row),
    documentId: row?.documentId || null,
    code: row?.code || '',
    label: row?.label || '',
    order: Number(row?.order || 0),
    ruleType: row?.ruleType || 'percentage',
    scoreBasis: row?.scoreBasis || 'objective_only',
    minPercentage: row?.minPercentage ?? null,
    maxPercentage: row?.maxPercentage ?? null,
    minRawScore: row?.minRawScore ?? null,
    maxRawScore: row?.maxRawScore ?? null,
    level: row?.level || null,
    placementBandCode: row?.placementBandCode || null,
    placementLabel: row?.placementLabel || null,
    status: row?.status || 'active',
    assessmentVersion: mapSimpleRelation(row?.assessmentVersion),
  };
}

function mapResultHistoryItem(row: any) {
  return {
    id: normalizeId(row),
    documentId: row?.documentId || null,
    code: row?.code || '',
    status: row?.status || 'pending',
    scoringVersion: Number(row?.scoringVersion || 1),
    scoredAt: row?.scoredAt || null,
    createdAt: row?.createdAt || null,
    rawScore: row?.rawScore ?? null,
    maxScore: row?.maxScore ?? null,
    percentage: row?.percentage ?? null,
    provisionalLevel: row?.provisionalLevel || null,
    placementLabel: row?.placementLabel || null,
    isCurrent: row?.isCurrent !== false,
  };
}

function deriveResultWorkflowState(row: any) {
  if (toText(row?.status) === 'cancelled' || toText(row?.attempt?.status) === 'cancelled') return 'cancelled';
  if (toText(row?.confirmationStatus) === 'confirmed' || toText(row?.confirmedLevel)) return 'confirmed';
  if (Number(row?.pendingManualCount || 0) > 0) return 'manual_pending';
  if (row?.assessmentVersion?.requiresSpeaking !== false && toText(row?.speakingReviewStatus) !== 'completed') return 'speaking_pending';
  if (row?.assessmentVersion?.requiresTeacherConfirmation !== false) return 'confirmation_pending';
  return 'provisional_ready';
}

function mapResultListItem(row: any) {
  const attempt = mapAttempt(row?.attempt);
  return {
    id: normalizeId(row),
    documentId: row?.documentId || null,
    code: row?.code || '',
    status: row?.status || 'pending',
    scoringVersion: Number(row?.scoringVersion || 1),
    rawScore: row?.rawScore ?? null,
    maxScore: row?.maxScore ?? null,
    percentage: row?.percentage ?? null,
    pendingManualCount: Number(row?.pendingManualCount || 0),
    pendingManualMaxScore: row?.pendingManualMaxScore ?? null,
    configuredTotalMaxScore: row?.configuredTotalMaxScore ?? null,
    scoreSummary: row?.scoreSummary ?? null,
    provisionalLevel: row?.provisionalLevel || null,
    placementLabel: row?.placementLabel || null,
    speakingReviewStatus: row?.speakingReviewStatus || null,
    speakingSuggestedLevel: row?.speakingSuggestedLevel || null,
    confirmationStatus: row?.confirmationStatus || null,
    confirmedLevel: row?.confirmedLevel || null,
    confirmedLabel: row?.confirmedLabel || null,
    requiresSpeaking: row?.assessmentVersion?.requiresSpeaking !== false,
    requiresTeacherConfirmation: row?.assessmentVersion?.requiresTeacherConfirmation !== false,
    workflowState: deriveResultWorkflowState(row),
    isCurrent: row?.isCurrent !== false,
    submittedAt: row?.attempt?.submittedAt || null,
    candidateName: attempt?.candidateDisplayName || null,
    candidateEmail: row?.attempt?.candidateEmailSnapshot || row?.attempt?.user?.email || null,
    attempt,
    assessment: mapSimpleRelation(row?.assessment),
    assessmentVersion: mapSimpleRelation(row?.assessmentVersion),
  };
}

function mapCandidatePreviewResult(row: any, options: { revealScores?: boolean } = {}) {
  if (!row) return null;
  const revealScores = options.revealScores === true;
  return {
    status: row?.status || 'pending',
    rawScore: revealScores ? row?.rawScore ?? null : null,
    maxScore: revealScores ? row?.maxScore ?? null : null,
    percentage: revealScores ? row?.percentage ?? null : null,
    provisionalLevel: row?.provisionalLevel || null,
    placementLabel: row?.placementLabel || null,
    pendingManualCount: Number(row?.pendingManualCount || 0),
    pendingManualMaxScore: row?.pendingManualMaxScore ?? null,
    configuredTotalMaxScore: row?.configuredTotalMaxScore ?? null,
    sectionScores: revealScores && Array.isArray(row?.sectionScores) ? row.sectionScores : [],
  };
}

function mapCandidatePreviewSpeaking(row: any, options: { revealScores?: boolean } = {}) {
  if (!row) return null;
  const revealScores = options.revealScores === true;
  return {
    status: row?.status || 'pending',
    reviewMode: row?.reviewMode || 'live',
    overallScore: revealScores ? row?.overallScore ?? null : null,
    overallMaxScore: revealScores ? row?.maxScore ?? null : null,
    percentage: revealScores ? row?.percentage ?? null : null,
    suggestedLevel: row?.suggestedLevel || null,
    reviewedAt: row?.reviewedAt || null,
  };
}

function mapCandidatePreviewConfirmation(row: any) {
  if (!row) return null;
  return {
    status: row?.status || 'draft',
    confirmedLevel: row?.confirmedLevel || null,
    confirmedLabel: row?.confirmedLabel || null,
    confirmedAt: row?.confirmedAt || null,
  };
}

async function ensureEntityInTenant(uid: string, ref: unknown, tenantId: number | string, label: string) {
  if (ref === null || ref === undefined || ref === '') return null;
  const entity = await findEntityByRef(uid, ref, { tenant: { select: ['id', 'documentId'] } });
  if (!entity) throw new AssessmentScoringError(400, `${label} is invalid`);
  const entityTenantRef = extractRelationRef(entity?.tenant);
  if (String(entityTenantRef || '') !== String(tenantId)) {
    throw new AssessmentScoringError(403, `${label} does not belong to current tenant`);
  }
  return entity;
}

async function generateResultCode(tenantId: number | string) {
  for (let attempt = 0; attempt < 25; attempt += 1) {
    const code = `RES-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
    const duplicate = await strapi.db.query(ASSESSMENT_RESULT_UID).findOne({ where: mergeTenantWhere({ code: { $eq: code } }, tenantId), select: ['id'] });
    if (!duplicate?.id) return code;
  }
  throw new AssessmentScoringError(500, 'Could not generate unique assessment result code');
}

async function buildResultPopulate() {
  return {
    attempt: {
      select: ['id', 'documentId', 'code', 'status', 'startedAt', 'submittedAt', 'expiresAt', 'sourceType', 'sourceRef', 'candidateNameSnapshot', 'candidateEmailSnapshot', 'candidatePhoneSnapshot', 'cancelledAt', 'cancelReason', 'cancelNote'],
      populate: {
        user: { select: ['id', 'username', 'email', 'fullName'] },
        learner: { select: ['id', 'documentId', 'code', 'fullName'] },
        lead: { select: ['id', 'documentId', 'fullName', 'phone'] },
        cancelledBy: { select: ['id', 'username', 'email', 'fullName'] },
      },
    },
    assessment: { select: ['id', 'documentId', 'code', 'name'] },
    assessmentVersion: { select: ['id', 'documentId', 'code', 'title', 'version', 'ceilingLevel', 'resultMode', 'candidateLevelFrom', 'candidateLevelTo', 'requiresSpeaking', 'requiresTeacherConfirmation', 'versionStatus'] },
    answerScores: {
      populate: {
        assessmentQuestion: { select: ['id', 'documentId', 'order', 'points', 'required', 'minWords', 'maxWords'] },
        question: { select: ['id', 'documentId', 'code', 'title', 'type'] },
        scoredBy: { select: ['id', 'username', 'email', 'fullName'] },
      },
      orderBy: [{ id: 'asc' }],
    },
  };
}

async function buildResultDetailPopulate() {
  return {
    attempt: {
      select: ['id', 'documentId', 'code', 'status', 'startedAt', 'submittedAt', 'expiresAt', 'sourceType', 'sourceRef', 'candidateNameSnapshot', 'candidateEmailSnapshot', 'candidatePhoneSnapshot', 'cancelledAt', 'cancelReason', 'cancelNote', 'definitionSnapshot', 'scoringSnapshot'],
      populate: {
        assessment: { select: ['id', 'documentId', 'code', 'name'] },
        assessmentVersion: { select: ['id', 'documentId', 'code', 'title', 'version', 'ceilingLevel', 'resultMode', 'candidateLevelFrom', 'candidateLevelTo', 'requiresSpeaking', 'requiresTeacherConfirmation', 'versionStatus'] },
        user: { select: ['id', 'username', 'email', 'fullName'] },
        learner: { select: ['id', 'documentId', 'code', 'fullName'] },
        lead: { select: ['id', 'documentId', 'fullName', 'phone'] },
        cancelledBy: { select: ['id', 'username', 'email', 'fullName'] },
        answers: {
          populate: {
            assessmentQuestion: { select: ['id', 'documentId', 'order', 'points', 'required', 'minWords', 'maxWords'] },
            question: { select: ['id', 'documentId', 'code', 'title', 'type'] },
          },
          orderBy: [{ id: 'asc' }],
        },
      },
    },
    assessment: { select: ['id', 'documentId', 'code', 'name'] },
    assessmentVersion: { select: ['id', 'documentId', 'code', 'title', 'version', 'ceilingLevel', 'resultMode', 'candidateLevelFrom', 'candidateLevelTo', 'requiresSpeaking', 'requiresTeacherConfirmation', 'versionStatus'] },
    answerScores: {
      populate: {
        answer: { populate: { assessmentQuestion: { select: ['id', 'documentId'] }, question: { select: ['id', 'documentId', 'code', 'type'] } } },
        assessmentQuestion: { select: ['id', 'documentId', 'order', 'points', 'required', 'minWords', 'maxWords'] },
        question: { select: ['id', 'documentId', 'code', 'title', 'type'] },
        scoredBy: { select: ['id', 'username', 'email', 'fullName'] },
      },
      orderBy: [{ id: 'asc' }],
    },
  };
}

async function findResultByAttemptOrThrow(attemptId: unknown, tenantId: number | string) {
  const row = await strapi.db.query(ASSESSMENT_RESULT_UID).findOne({
    where: mergeTenantWhere({ attempt: whereByParam(attemptId), isCurrent: true }, tenantId),
    populate: await buildResultPopulate(),
    orderBy: [{ scoredAt: 'desc' }, { id: 'desc' }],
  });
  if (!row) throw new AssessmentScoringError(404, 'Assessment Result not found');
  return row;
}

async function findResultByIdOrThrow(resultId: unknown, tenantId: number | string, options: { detail?: boolean } = {}) {
  const where = whereByParam(resultId);
  if (!where) throw new AssessmentScoringError(400, 'Assessment Result id is invalid');
  const row = await strapi.db.query(ASSESSMENT_RESULT_UID).findOne({
    where: mergeTenantWhere(where, tenantId),
    populate: options.detail ? await buildResultDetailPopulate() : await buildResultPopulate(),
  });
  if (!row) throw new AssessmentScoringError(404, 'Assessment Result not found');
  return row;
}

async function findAttemptForScoringOrThrow(attemptId: unknown, tenantId: number | string) {
  const where = whereByParam(attemptId);
  if (!where) throw new AssessmentScoringError(400, 'Assessment Attempt id is invalid');
  const row = await strapi.db.query(ASSESSMENT_ATTEMPT_UID).findOne({
    where: mergeTenantWhere(where, tenantId),
    populate: {
      assessment: { select: ['id', 'documentId', 'code', 'name'] },
      assessmentVersion: { select: ['id', 'documentId', 'code', 'title', 'version', 'resultMode', 'ceilingLevel', 'candidateLevelFrom', 'candidateLevelTo'] },
      answers: {
        populate: {
          assessmentQuestion: { select: ['id', 'documentId'] },
          question: { select: ['id', 'documentId', 'code', 'type'] },
        },
        orderBy: [{ id: 'asc' }],
      },
    },
  });
  if (!row) throw new AssessmentScoringError(404, 'Assessment Attempt not found');
  return row;
}

async function findPlacementRuleOrThrow(id: unknown, tenantId: number | string) {
  const where = whereByParam(id);
  if (!where) throw new AssessmentScoringError(400, 'Assessment Placement Rule id is invalid');
  const row = await strapi.db.query(ASSESSMENT_PLACEMENT_RULE_UID).findOne({
    where: mergeTenantWhere(where, tenantId),
    populate: { assessmentVersion: { select: ['id', 'documentId', 'code', 'candidateLevelFrom', 'candidateLevelTo', 'ceilingLevel'] } },
  });
  if (!row) throw new AssessmentScoringError(404, 'Assessment Placement Rule not found');
  return row;
}

function getScoringQuestions(scoringSnapshot: any) {
  const sections = Array.isArray(scoringSnapshot?.sections) ? scoringSnapshot.sections : [];
  const rows: any[] = [];
  for (const section of sections) {
    const questions = Array.isArray(section?.questions) ? section.questions : [];
    for (const question of questions) {
      rows.push({
        ...question,
        sectionCode: section?.code || '',
        sectionTitle: section?.title || '',
        sectionOrder: Number(section?.order || 0),
      });
    }
  }
  return sortByOrder(rows);
}

function findAnswerForSnapshot(answerMap: Map<string, any>, snapshotQuestion: any) {
  return answerMap.get(String(snapshotQuestion?.assessmentQuestionId || '')) || null;
}

function buildAutoScoringDetail(snapshotQuestion: any, answer: any, detail: any = {}) {
  return {
    assessmentQuestionId: snapshotQuestion?.assessmentQuestionId || null,
    questionCode: snapshotQuestion?.questionCode || '',
    questionType: snapshotQuestion?.questionType || '',
    selectedOptionIds: answer?.answerData?.selectedOptionIds || [],
    correctOptionIds: Array.isArray(snapshotQuestion?.options) ? snapshotQuestion.options.filter((option: any) => option?.isCorrect === true).map((option: any) => String(option?.id || option?.documentId || '')).filter(Boolean) : [],
    ...detail,
  };
}

function scoreObjectiveAnswer(snapshotQuestion: any, answer: any) {
  const type = toText(snapshotQuestion?.questionType);
  const maxPoints = Number(snapshotQuestion?.points || 0);
  const selected = toSelectionSet(answer?.answerData?.selectedOptionIds);
  const optionRefs: Set<string> = new Set<string>((Array.isArray(snapshotQuestion?.options) ? snapshotQuestion.options : []).flatMap((option: any) => [String(option?.id || ''), String(option?.documentId || '')].filter(Boolean) as string[]));
  const correct: Set<string> = new Set<string>((Array.isArray(snapshotQuestion?.options) ? snapshotQuestion.options : []).filter((option: any) => option?.isCorrect === true).flatMap((option: any) => [String(option?.id || ''), String(option?.documentId || '')].filter(Boolean) as string[]));
  const invalidSelection = [...selected].some((item) => !optionRefs.has(item));
  if (invalidSelection) {
    return {
      status: 'invalid',
      awardedPoints: 0,
      maxPoints,
      isCorrect: false,
      scoringMethod: 'auto',
      manualScoreRequired: false,
      scoringDetail: buildAutoScoringDetail(snapshotQuestion, answer, { reason: 'selected option does not belong to question' }),
    };
  }
  const isCorrect = sameSelection(selected, correct);
  return {
    status: 'auto_scored',
    awardedPoints: isCorrect ? maxPoints : 0,
    maxPoints,
    isCorrect,
    scoringMethod: 'auto',
    manualScoreRequired: false,
    scoringDetail: buildAutoScoringDetail(snapshotQuestion, answer),
  };
}

function scoreSnapshotQuestion(snapshotQuestion: any, answer: any) {
  const type = toText(snapshotQuestion?.questionType);
  const maxPoints = Number(snapshotQuestion?.points || 0);
  if (AUTO_SCORABLE_TYPES.has(type)) {
    return scoreObjectiveAnswer(snapshotQuestion, answer);
  }
  if (PENDING_MANUAL_TYPES.has(type)) {
    return {
      status: 'pending',
      awardedPoints: null,
      maxPoints,
      isCorrect: null,
      scoringMethod: 'manual',
      manualScoreRequired: true,
      scoringDetail: {
        assessmentQuestionId: snapshotQuestion?.assessmentQuestionId || null,
        questionCode: snapshotQuestion?.questionCode || '',
        questionType: type,
        reason: 'manual scoring required',
      },
    };
  }
  return {
    status: 'not_scored',
    awardedPoints: null,
    maxPoints,
    isCorrect: null,
    scoringMethod: 'none',
    manualScoreRequired: false,
    scoringDetail: {
      assessmentQuestionId: snapshotQuestion?.assessmentQuestionId || null,
      questionCode: snapshotQuestion?.questionCode || '',
      questionType: type,
      reason: 'question type not supported for automatic scoring',
    },
  };
}

function calculateSectionScores(snapshotQuestions: any[], answerScores: any[]) {
  const sectionMap = new Map<string, any>();
  for (const snapshotQuestion of snapshotQuestions) {
    const key = String(snapshotQuestion?.sectionCode || '');
    if (!sectionMap.has(key)) {
      sectionMap.set(key, {
        sectionCode: snapshotQuestion?.sectionCode || '',
        title: snapshotQuestion?.sectionTitle || '',
        order: Number(snapshotQuestion?.sectionOrder || 0),
        rawScore: 0,
        maxScore: 0,
        percentage: null,
        configuredMaxScore: 0,
        scoredCount: 0,
        pendingCount: 0,
        pendingMaxScore: 0,
      });
    }
  }
  for (const answerScore of answerScores) {
    const sectionKey = String(answerScore?.sectionCode || '');
    const bucket = sectionMap.get(sectionKey);
    if (!bucket) continue;
    const maxPoints = Number(answerScore?.maxPoints || 0);
    bucket.configuredMaxScore += maxPoints;
    if (answerScore?.status === 'pending') {
      bucket.pendingCount += 1;
      bucket.pendingMaxScore += maxPoints;
    }
    if (answerScore?.awardedPoints !== null && answerScore?.awardedPoints !== undefined) {
      bucket.rawScore += Number(answerScore.awardedPoints || 0);
      bucket.maxScore += maxPoints;
      bucket.scoredCount += 1;
    }
  }
  return [...sectionMap.values()].map((bucket) => ({
    ...bucket,
    rawScore: bucket.maxScore > 0 ? Number(bucket.rawScore.toFixed(2)) : bucket.pendingCount > 0 ? null : Number(bucket.rawScore.toFixed(2)),
    maxScore: bucket.maxScore > 0 ? Number(bucket.maxScore.toFixed(2)) : bucket.pendingCount > 0 ? Number(bucket.configuredMaxScore.toFixed(2)) : Number(bucket.maxScore.toFixed(2)),
    percentage: bucket.maxScore > 0 ? toRoundedPercentage(bucket.rawScore, bucket.maxScore) : null,
  }));
}

function buildStoredScoreRows(snapshotQuestions: any[], answerScores: any[]) {
  const scoreByAssessmentQuestion = new Map<string, any>();
  for (const row of Array.isArray(answerScores) ? answerScores : []) {
    const key = String(normalizeId(row?.assessmentQuestion) || row?.assessmentQuestionId || '');
    if (key) scoreByAssessmentQuestion.set(key, row);
  }
  return snapshotQuestions.map((snapshotQuestion) => {
    const key = String(snapshotQuestion?.assessmentQuestionId || '');
    const persisted = scoreByAssessmentQuestion.get(key) || null;
    const fallback = scoreSnapshotQuestion(snapshotQuestion, null);
    return {
      assessmentQuestionId: snapshotQuestion?.assessmentQuestionId || null,
      assessmentQuestionDocumentId: snapshotQuestion?.assessmentQuestionDocumentId || null,
      questionId: snapshotQuestion?.questionId || null,
      questionDocumentId: snapshotQuestion?.questionDocumentId || null,
      questionCode: snapshotQuestion?.questionCode || persisted?.question?.code || '',
      questionType: snapshotQuestion?.questionType || persisted?.question?.type || '',
      sectionCode: snapshotQuestion?.sectionCode || '',
      sectionTitle: snapshotQuestion?.sectionTitle || '',
      status: persisted?.status || fallback.status,
      awardedPoints: persisted?.awardedPoints ?? fallback.awardedPoints,
      maxPoints: persisted?.maxPoints ?? fallback.maxPoints,
      isCorrect: persisted?.isCorrect ?? fallback.isCorrect,
      scoringMethod: persisted?.scoringMethod || fallback.scoringMethod,
      scoringDetail: persisted?.scoringDetail ?? fallback.scoringDetail,
      manualScoreRequired: persisted?.manualScoreRequired === true || fallback.manualScoreRequired === true,
      manualScoreNote: persisted?.manualScoreNote || '',
      manualScoredAt: persisted?.manualScoredAt || null,
      scoredBy: persisted?.scoredBy || null,
    };
  });
}

function extractAnswerText(answerData: any) {
  if (!answerData || typeof answerData !== 'object') return '';
  if (typeof answerData.text === 'string') return answerData.text.trim();
  if (typeof answerData.answerText === 'string') return answerData.answerText.trim();
  if (Array.isArray(answerData.lines)) return answerData.lines.map((item) => toText(item)).filter(Boolean).join(' ').trim();
  return '';
}

function countWords(text: string) {
  const normalized = toText(text);
  if (!normalized) return 0;
  return normalized.split(/\s+/).filter(Boolean).length;
}

function buildAnswerReviewItems(resultRow: any) {
  const definitionSnapshot = resultRow?.attempt?.definitionSnapshot;
  const scoringSnapshot = resultRow?.attempt?.scoringSnapshot;
  const snapshotQuestions = getScoringQuestions(scoringSnapshot);
  const candidateSections = Array.isArray(definitionSnapshot?.sections) ? definitionSnapshot.sections : [];
  const orderedDefinitionQuestions = candidateSections.flatMap((section: any) => {
    const questions = sortByOrder(Array.isArray(section?.questions) ? section.questions : []);
    return questions.map((question: any) => ({
      ...question,
      sectionCode: section?.code || '',
      sectionTitle: section?.title || '',
      sectionOrder: Number(section?.order || 0),
    }));
  });
  const scoringQuestionMap = new Map(snapshotQuestions.map((item) => [String(item?.assessmentQuestionId || ''), item]));
  const answerMap = new Map<string, any>((Array.isArray(resultRow?.attempt?.answers) ? resultRow.attempt.answers : []).map((answer: any) => [String(normalizeId(answer?.assessmentQuestion) || answer?.questionSnapshot?.assessmentQuestionId || ''), answer]));
  const scoreMap = new Map<string, any>((Array.isArray(resultRow?.answerScores) ? resultRow.answerScores : []).map((score: any) => [String(normalizeId(score?.assessmentQuestion) || ''), score]));

  return orderedDefinitionQuestions.map((question) => {
    const key = String(question?.assessmentQuestionId || '');
    const answer = answerMap.get(key) || null;
    const score = scoreMap.get(key) || null;
    const scoringQuestion = scoringQuestionMap.get(key) || null;
    const answerText = extractAnswerText(answer?.answerData);
    const correctOptionIds = Array.isArray(scoringQuestion?.options)
      ? scoringQuestion.options.filter((option: any) => option?.isCorrect === true).map((option: any) => normalizeId(option)).filter(Boolean)
      : [];
    return {
      assessmentQuestionId: key || null,
      answerScoreId: normalizeId(score),
      sectionCode: question?.sectionCode || '',
      sectionTitle: question?.sectionTitle || '',
      sectionOrder: Number(question?.sectionOrder || 0),
      order: Number(question?.order || 0),
      questionCode: question?.questionCode || question?.question?.code || '',
      questionType: question?.question?.type || scoringQuestion?.questionType || score?.question?.type || '',
      questionTitle: question?.question?.title || '',
      questionPrompt: question?.question?.questionText || '',
      stimulus: question?.question?.stimulus || null,
      options: Array.isArray(question?.question?.options) ? question.question.options : [],
      candidateAnswer: answer?.answerData ?? null,
      answerText,
      wordCount: countWords(answerText),
      minWords: question?.minWords ?? null,
      maxWords: question?.maxWords ?? null,
      timeSpentSeconds: Number(answer?.timeSpentSeconds || 0),
      audioPlayCount: Number(answer?.audioPlayCount || 0),
      maxPoints: score?.maxPoints ?? question?.points ?? 0,
      awardedPoints: score?.awardedPoints ?? null,
      status: score?.status || 'not_scored',
      scoringMethod: score?.scoringMethod || 'none',
      manualScoreRequired: score?.manualScoreRequired === true || PENDING_MANUAL_TYPES.has(toText(question?.question?.type || scoringQuestion?.questionType)),
      manualScoreNote: score?.manualScoreNote || '',
      manualScoredAt: score?.manualScoredAt || null,
      scoredBy: mapUserSummary(score?.scoredBy),
      isCorrect: score?.isCorrect ?? null,
      correctOptionIds,
      correctAnswer: scoringQuestion?.correctAnswer ?? null,
      explanation: scoringQuestion?.explanation || '',
    };
  });
}

async function listResultHistory(attemptRef: unknown, tenantId: number | string) {
  const rows = await strapi.db.query(ASSESSMENT_RESULT_UID).findMany({
    where: mergeTenantWhere({ attempt: whereByParam(attemptRef) }, tenantId),
    select: ['id', 'documentId', 'code', 'status', 'scoringVersion', 'scoredAt', 'createdAt', 'rawScore', 'maxScore', 'percentage', 'provisionalLevel', 'placementLabel', 'isCurrent'],
    orderBy: [{ scoredAt: 'desc' }, { id: 'desc' }],
  });
  return (rows || []).map(mapResultHistoryItem);
}

async function recalculateResultRowOrThrow(resultId: unknown, tenantId: number | string) {
  const row = await findResultByIdOrThrow(resultId, tenantId, { detail: true });
  if (row?.isCurrent === false || toText(row?.status) === 'superseded') {
    throw new AssessmentScoringError(409, 'Only current assessment results can be recalculated');
  }
  const scoringSnapshot = row?.attempt?.scoringSnapshot;
  if (!scoringSnapshot || typeof scoringSnapshot !== 'object') {
    throw new AssessmentScoringError(400, 'Assessment Attempt is missing scoringSnapshot');
  }
  const snapshotQuestions = getScoringQuestions(scoringSnapshot);
  const scoreRows = buildStoredScoreRows(snapshotQuestions, row?.answerScores || []);
  const summary = calculateResultSummary(scoreRows);
  const sectionScores = calculateSectionScores(snapshotQuestions, scoreRows);
  const placementRules = await listPlacementRulesForVersion(row?.assessmentVersion?.id || row?.assessmentVersion?.documentId, tenantId);
  const placement = applyPlacementRules(placementRules, {
    ceilingLevel: row?.assessmentVersion?.ceilingLevel || row?.attempt?.assessmentVersion?.ceilingLevel || scoringSnapshot?.version?.ceilingLevel || null,
  }, summary);
  const resultStatus = buildResultStatus(summary, placement);
  const resultSnapshot = buildResultSnapshot({
    ...row.attempt,
    assessment: row?.assessment || row?.attempt?.assessment,
    assessmentVersion: row?.assessmentVersion || row?.attempt?.assessmentVersion,
  }, scoreRows, summary, sectionScores, placement, placementRules);

  await strapi.db.query(ASSESSMENT_RESULT_UID).update({
    where: { id: row.id },
    data: {
      status: resultStatus,
      rawScore: summary.rawScore,
      maxScore: summary.maxScore,
      percentage: summary.percentage,
      objectiveScore: summary.objectiveScore,
      objectiveMaxScore: summary.objectiveMaxScore,
      manualScore: summary.manualScore,
      manualMaxScore: summary.manualMaxScore,
      pendingManualCount: summary.pendingManualCount,
      pendingManualMaxScore: summary.pendingManualMaxScore,
      configuredTotalMaxScore: summary.configuredTotalMaxScore,
      sectionScores,
      scoreSummary: summary,
      provisionalLevel: placement.provisionalLevel,
      placementBandCode: placement.placementBandCode,
      placementLabel: placement.placementLabel,
      placementNotes: placement.placementNotes,
      resultSnapshot,
      scoredAt: new Date().toISOString(),
    },
  });

  return findResultByIdOrThrow(row.id, tenantId);
}

function calculateResultSummary(answerScores: any[]) {
  const summary = {
    rawScore: 0,
    maxScore: 0,
    percentage: null as number | null,
    objectiveScore: 0,
    objectiveMaxScore: 0,
    manualScore: 0,
    manualMaxScore: 0,
    pendingManualCount: 0,
    pendingManualMaxScore: 0,
    configuredTotalMaxScore: 0,
  };
  for (const score of answerScores) {
    const maxPoints = Number(score?.maxPoints || 0);
    summary.configuredTotalMaxScore += maxPoints;
    if (score?.status === 'pending') {
      summary.pendingManualCount += 1;
      summary.pendingManualMaxScore += maxPoints;
    }
    if (score?.status === 'manual_scored') {
      summary.manualScore += Number(score?.awardedPoints || 0);
      summary.manualMaxScore += maxPoints;
    }
    if (AUTO_SCORABLE_TYPES.has(toText(score?.questionType))) {
      summary.objectiveMaxScore += maxPoints;
      summary.objectiveScore += Number(score?.awardedPoints || 0);
    }
    if (score?.awardedPoints !== null && score?.awardedPoints !== undefined) {
      summary.rawScore += Number(score.awardedPoints || 0);
      summary.maxScore += maxPoints;
    }
  }
  summary.rawScore = Number(summary.rawScore.toFixed(2));
  summary.maxScore = Number(summary.maxScore.toFixed(2));
  summary.objectiveScore = Number(summary.objectiveScore.toFixed(2));
  summary.objectiveMaxScore = Number(summary.objectiveMaxScore.toFixed(2));
  summary.manualScore = Number(summary.manualScore.toFixed(2));
  summary.manualMaxScore = Number(summary.manualMaxScore.toFixed(2));
  summary.pendingManualMaxScore = Number(summary.pendingManualMaxScore.toFixed(2));
  summary.configuredTotalMaxScore = Number(summary.configuredTotalMaxScore.toFixed(2));
  summary.percentage = toRoundedPercentage(summary.rawScore, summary.maxScore);
  return summary;
}

async function listPlacementRulesForVersion(assessmentVersionRef: unknown, tenantId: number | string) {
  const where = mergeTenantWhere({ assessmentVersion: whereByParam(assessmentVersionRef) }, tenantId);
  const rows = await strapi.db.query(ASSESSMENT_PLACEMENT_RULE_UID).findMany({
    where,
    populate: { assessmentVersion: { select: ['id', 'documentId', 'code', 'candidateLevelFrom', 'candidateLevelTo', 'ceilingLevel'] } },
    orderBy: [{ order: 'asc' }, { id: 'asc' }],
  });
  return (rows || []).map(mapPlacementRule);
}

function resolvePlacementBasisSummary(scoreBasis: string, summary: any) {
  if (scoreBasis === 'objective_only') {
    return {
      rawScore: Number(summary.objectiveScore || 0),
      maxScore: Number(summary.objectiveMaxScore || 0),
      percentage: toRoundedPercentage(Number(summary.objectiveScore || 0), Number(summary.objectiveMaxScore || 0)),
    };
  }
  if (scoreBasis === 'final_total') {
    return {
      rawScore: Number(summary.rawScore || 0),
      maxScore: Number(summary.configuredTotalMaxScore || 0),
      percentage: toRoundedPercentage(Number(summary.rawScore || 0), Number(summary.configuredTotalMaxScore || 0)),
    };
  }
  return {
    rawScore: Number(summary.rawScore || 0),
    maxScore: Number(summary.maxScore || 0),
    percentage: Number(summary.percentage ?? 0) || null,
  };
}

function clampPlacementLevel(level: string | null, ceilingLevel: string | null) {
  if (!level || !ceilingLevel) return { level, ceilingApplied: false };
  if (compareCefrLevel(level, ceilingLevel) > 0) {
    return { level: ceilingLevel, ceilingApplied: true };
  }
  return { level, ceilingApplied: false };
}

function applyPlacementRules(rules: any[], assessmentVersion: any, summary: any) {
  const activeRules = (Array.isArray(rules) ? rules : []).filter((item) => toText(item?.status) === 'active');
  if (activeRules.length === 0) {
    return {
      provisionalLevel: null,
      placementBandCode: null,
      placementLabel: null,
      placementNotes: 'No active placement rules configured.',
      rule: null,
      scoreBasis: null,
      ceilingApplied: false,
    };
  }
  const groupedByBasis = new Map<string, any[]>();
  for (const rule of activeRules) {
    const basis = toText(rule?.scoreBasis) || 'objective_only';
    if (!groupedByBasis.has(basis)) groupedByBasis.set(basis, []);
    groupedByBasis.get(basis)?.push(rule);
  }
  for (const [basis, groupedRules] of groupedByBasis.entries()) {
    const basisSummary = resolvePlacementBasisSummary(basis, summary);
    if (basis === 'final_total' && Number(summary.pendingManualCount || 0) > 0) continue;
    const matched = groupedRules.find((rule) => {
      if (rule?.ruleType === 'raw_score') {
        const rawScore = basisSummary.rawScore;
        const min = rule?.minRawScore === null || rule?.minRawScore === undefined ? null : Number(rule.minRawScore);
        const max = rule?.maxRawScore === null || rule?.maxRawScore === undefined ? null : Number(rule.maxRawScore);
        if (min !== null && rawScore < min) return false;
        if (max !== null && rawScore > max) return false;
        return true;
      }
      const percentage = basisSummary.percentage;
      if (percentage === null || percentage === undefined) return false;
      const min = rule?.minPercentage === null || rule?.minPercentage === undefined ? null : Number(rule.minPercentage);
      const max = rule?.maxPercentage === null || rule?.maxPercentage === undefined ? null : Number(rule.maxPercentage);
      if (min !== null && percentage < min) return false;
      if (max !== null && percentage > max) return false;
      return true;
    }) || null;
    if (!matched) continue;
    const clamped = clampPlacementLevel(matched?.level || null, assessmentVersion?.ceilingLevel || null);
    return {
      provisionalLevel: clamped.level,
      placementBandCode: matched?.placementBandCode || matched?.code || null,
      placementLabel: matched?.placementLabel || matched?.label || null,
      placementNotes: clamped.ceilingApplied ? `Placement level was clamped by ceiling level ${assessmentVersion?.ceilingLevel}.` : null,
      rule: matched,
      scoreBasis: basis,
      ceilingApplied: clamped.ceilingApplied,
    };
  }
  return {
    provisionalLevel: null,
    placementBandCode: null,
    placementLabel: null,
    placementNotes: 'No placement rule matched the current score summary.',
    rule: null,
    scoreBasis: null,
    ceilingApplied: false,
  };
}

async function listSpeakingCriteriaForVersion(assessmentVersionRef: unknown, tenantId: number | string) {
  const rows = await strapi.db.query(ASSESSMENT_SPEAKING_CRITERION_UID).findMany({
    where: mergeTenantWhere({
      assessmentVersion: whereByParam(assessmentVersionRef),
      status: { $eq: 'active' },
    }, tenantId),
    orderBy: [{ order: 'asc' }, { id: 'asc' }],
    populate: { assessmentVersion: { select: ['id', 'documentId', 'code', 'title'] } },
  });
  return (rows || []).map(mapSpeakingCriterion);
}

function buildSpeakingCriteriaSnapshot(criteria: any[]) {
  return sortByOrder((Array.isArray(criteria) ? criteria : []).map((item) => ({
    criterionCode: item?.code || item?.criterionCode || '',
    code: item?.code || item?.criterionCode || '',
    label: item?.label || '',
    description: item?.description || '',
    guidance: item?.guidance || '',
    order: Number(item?.order || 0),
    maxScore: item?.maxScore ?? null,
    weight: item?.weight ?? null,
    required: item?.required !== false,
    status: item?.status || 'active',
  })));
}

function buildCriteriaScoreMap(rows: any[]) {
  const map = new Map<string, any>();
  for (const row of Array.isArray(rows) ? rows : []) {
    const key = toText(row?.criterionCode || row?.code).toUpperCase();
    if (key) map.set(key, row);
  }
  return map;
}

function normalizeCriteriaScores(criteriaSnapshot: any[], rawCriteriaScores: any, options: { requireAll?: boolean } = {}) {
  const entries = Array.isArray(rawCriteriaScores) ? rawCriteriaScores : [];
  const entryMap = buildCriteriaScoreMap(entries);
  return (Array.isArray(criteriaSnapshot) ? criteriaSnapshot : []).map((criterion) => {
    const criterionCode = toText(criterion?.criterionCode || criterion?.code).toUpperCase();
    const code = criterionCode;
    const matched = entryMap.get(code) || null;
    const score = parseOptionalDecimal(matched?.score, `${code || 'criterion'}.score`);
    const maxScore = Number(criterion?.maxScore || 0);
    const required = criterion?.required !== false;
    if (options.requireAll && required && score === null) {
      throw new AssessmentScoringError(400, `Score is required for criterion ${criterion?.label || code || ''}`.trim());
    }
    if (score !== null && score < 0) {
      throw new AssessmentScoringError(400, `Score for criterion ${criterion?.label || code || ''} must be greater than or equal to 0`.trim());
    }
    if (score !== null && score > maxScore) {
      throw new AssessmentScoringError(400, `Score for criterion ${criterion?.label || code || ''} must be less than or equal to maxScore`.trim());
    }
    return {
      criterionCode: criterion?.criterionCode || criterion?.code || '',
      code: criterion?.criterionCode || criterion?.code || '',
      label: criterion?.label || '',
      description: criterion?.description || '',
      guidance: criterion?.guidance || '',
      order: Number(criterion?.order || 0),
      score,
      maxScore: criterion?.maxScore ?? null,
      weight: criterion?.weight ?? null,
      required,
      note: toNullableText(matched?.note),
    };
  });
}

function summarizeCriteriaScores(criteriaScores: any[]) {
  return (Array.isArray(criteriaScores) ? criteriaScores : []).reduce((result, item) => ({
    overallScore: result.overallScore + Number(item?.score || 0),
    maxScore: result.maxScore + Number(item?.maxScore || 0),
    scoredCount: result.scoredCount + (item?.score === null || item?.score === undefined ? 0 : 1),
  }), { overallScore: 0, maxScore: 0, scoredCount: 0 });
}

function validateLevelAgainstVersion(level: string | null | undefined, version: any, fieldName: string) {
  const normalized = toText(level).toUpperCase();
  if (!normalized) return null;
  if (!isValidCefrLevel(normalized)) throw new AssessmentScoringError(400, `${fieldName} is invalid`);
  const candidateFrom = toText(version?.candidateLevelFrom).toUpperCase();
  const candidateTo = toText(version?.candidateLevelTo).toUpperCase();
  const ceilingLevel = toText(version?.ceilingLevel).toUpperCase();
  if (candidateFrom && compareCefrLevel(normalized, candidateFrom) < 0) {
    throw new AssessmentScoringError(400, `${fieldName} is below candidateLevelFrom of the assessment version`);
  }
  if (candidateTo && compareCefrLevel(normalized, candidateTo) > 0) {
    throw new AssessmentScoringError(400, `${fieldName} is above candidateLevelTo of the assessment version`);
  }
  if (ceilingLevel && compareCefrLevel(normalized, ceilingLevel) > 0) {
    throw new AssessmentScoringError(400, `${fieldName} is above ceilingLevel of the assessment version`);
  }
  return normalized;
}

async function findCurrentSpeakingReviewByResultOrNull(resultRef: unknown, tenantId: number | string) {
  const row = await strapi.db.query(ASSESSMENT_SPEAKING_REVIEW_UID).findOne({
    where: mergeTenantWhere({ assessmentResult: whereByParam(resultRef) }, tenantId),
    populate: {
      reviewer: { select: ['id', 'username', 'email', 'fullName'] },
      recordingAsset: { select: ['id', 'documentId', 'code', 'originalName', 'fileName', 'mimeType', 'url', 'relativePath', 'provider'] },
      assessmentVersion: { select: ['id', 'documentId', 'code', 'candidateLevelFrom', 'candidateLevelTo', 'ceilingLevel', 'requiresSpeaking', 'requiresTeacherConfirmation'] },
    },
    orderBy: [{ reviewedAt: 'desc' }, { id: 'desc' }],
  });
  return row || null;
}

async function findSpeakingReviewOrThrow(id: unknown, tenantId: number | string) {
  const where = whereByParam(id);
  if (!where) throw new AssessmentScoringError(400, 'Assessment Speaking Review id is invalid');
  const row = await strapi.db.query(ASSESSMENT_SPEAKING_REVIEW_UID).findOne({
    where: mergeTenantWhere(where, tenantId),
    populate: {
      reviewer: { select: ['id', 'username', 'email', 'fullName'] },
      recordingAsset: { select: ['id', 'documentId', 'code', 'originalName', 'fileName', 'mimeType', 'url', 'relativePath', 'provider'] },
      assessmentResult: { select: ['id', 'documentId', 'isCurrent'] },
      assessmentVersion: { select: ['id', 'documentId', 'code', 'candidateLevelFrom', 'candidateLevelTo', 'ceilingLevel', 'requiresSpeaking', 'requiresTeacherConfirmation'] },
    },
  });
  if (!row) throw new AssessmentScoringError(404, 'Assessment Speaking Review not found');
  return row;
}

async function listPlacementConfirmationsForResult(resultRef: unknown, tenantId: number | string) {
  const rows = await strapi.db.query(ASSESSMENT_PLACEMENT_CONFIRMATION_UID).findMany({
    where: mergeTenantWhere({ assessmentResult: whereByParam(resultRef) }, tenantId),
    populate: { confirmedBy: { select: ['id', 'username', 'email', 'fullName'] } },
    orderBy: [{ confirmedAt: 'desc' }, { id: 'desc' }],
  });
  return (rows || []).map(mapPlacementConfirmation);
}

async function findCurrentPlacementConfirmationByResultOrNull(resultRef: unknown, tenantId: number | string) {
  const row = await strapi.db.query(ASSESSMENT_PLACEMENT_CONFIRMATION_UID).findOne({
    where: mergeTenantWhere({ assessmentResult: whereByParam(resultRef), isCurrent: true }, tenantId),
    populate: { confirmedBy: { select: ['id', 'username', 'email', 'fullName'] } },
    orderBy: [{ confirmedAt: 'desc' }, { id: 'desc' }],
  });
  return row || null;
}

async function markCurrentPlacementConfirmationsSuperseded(resultDbId: number, tenantId: number | string) {
  const rows = await strapi.db.query(ASSESSMENT_PLACEMENT_CONFIRMATION_UID).findMany({
    where: mergeTenantWhere({ assessmentResult: { id: { $eq: resultDbId } }, isCurrent: true }, tenantId),
    select: ['id'],
  });
  for (const row of rows || []) {
    await strapi.db.query(ASSESSMENT_PLACEMENT_CONFIRMATION_UID).update({ where: { id: row.id }, data: { isCurrent: false, status: 'superseded' } });
  }
}

async function updateResultSpeakingCache(resultDbId: number, review: any | null) {
  await strapi.db.query(ASSESSMENT_RESULT_UID).update({
    where: { id: resultDbId },
    data: {
      speakingReviewStatus: review?.status || null,
      speakingSuggestedLevel: review?.suggestedLevel || null,
      speakingReviewedAt: review?.reviewedAt || null,
    },
  });
}

async function updateResultConfirmationCache(resultDbId: number, confirmation: any | null) {
  await strapi.db.query(ASSESSMENT_RESULT_UID).update({
    where: { id: resultDbId },
    data: {
      confirmationStatus: confirmation?.status || null,
      confirmedLevel: confirmation?.confirmedLevel || null,
      confirmedBandCode: confirmation?.confirmedBandCode || null,
      confirmedLabel: confirmation?.confirmedLabel || null,
      confirmedAt: confirmation?.confirmedAt || null,
    },
  });
}

function deriveConfirmationDecision(provisionalLevel: string | null | undefined, confirmedLevel: string | null | undefined) {
  const left = toText(provisionalLevel).toUpperCase();
  const right = toText(confirmedLevel).toUpperCase();
  if (!left || !right) return 'manual';
  const diff = compareCefrLevel(right, left);
  if (diff === 0) return 'keep';
  if (diff > 0) return 'raise';
  return 'lower';
}

async function markExistingResultsSuperseded(attemptDbId: number, tenantId: number | string) {
  const currentRows = await strapi.db.query(ASSESSMENT_RESULT_UID).findMany({
    where: mergeTenantWhere({ attempt: { id: { $eq: attemptDbId } }, isCurrent: true }, tenantId),
    select: ['id'],
  });
  for (const row of currentRows || []) {
    await strapi.db.query(ASSESSMENT_RESULT_UID).update({ where: { id: row.id }, data: { isCurrent: false, status: 'superseded' } });
  }
}

async function ensurePlacementRuleVersionCompatibility(data: any, assessmentVersion: any) {
  const level = toText(data?.level).toUpperCase();
  if (level && !isValidCefrLevel(level)) throw new AssessmentScoringError(400, 'level is invalid');
  const candidateFrom = toText(assessmentVersion?.candidateLevelFrom).toUpperCase();
  const candidateTo = toText(assessmentVersion?.candidateLevelTo).toUpperCase();
  if (level && candidateFrom && compareCefrLevel(level, candidateFrom) < 0) {
    throw new AssessmentScoringError(400, 'level is below candidateLevelFrom of the assessment version');
  }
  if (level && candidateTo && compareCefrLevel(level, candidateTo) > 0) {
    throw new AssessmentScoringError(400, 'level is above candidateLevelTo of the assessment version');
  }
}

async function ensurePlacementRuleNoOverlap(data: any, tenantId: number | string, existingId?: number | null) {
  const rows = await strapi.db.query(ASSESSMENT_PLACEMENT_RULE_UID).findMany({
    where: mergeTenantWhere({
      assessmentVersion: { id: { $eq: Number(data.assessmentVersion) } },
      ruleType: { $eq: data.ruleType },
      scoreBasis: { $eq: data.scoreBasis },
      status: { $eq: 'active' },
    }, tenantId),
    select: ['id', 'minPercentage', 'maxPercentage', 'minRawScore', 'maxRawScore'],
  });
  const currentMin = data.ruleType === 'raw_score' ? Number(data.minRawScore ?? Number.NEGATIVE_INFINITY) : Number(data.minPercentage ?? Number.NEGATIVE_INFINITY);
  const currentMax = data.ruleType === 'raw_score' ? Number(data.maxRawScore ?? Number.POSITIVE_INFINITY) : Number(data.maxPercentage ?? Number.POSITIVE_INFINITY);
  for (const row of rows || []) {
    if (Number(row?.id || 0) === Number(existingId || 0)) continue;
    const rowMin = data.ruleType === 'raw_score' ? Number(row?.minRawScore ?? Number.NEGATIVE_INFINITY) : Number(row?.minPercentage ?? Number.NEGATIVE_INFINITY);
    const rowMax = data.ruleType === 'raw_score' ? Number(row?.maxRawScore ?? Number.POSITIVE_INFINITY) : Number(row?.maxPercentage ?? Number.POSITIVE_INFINITY);
    const overlaps = currentMin <= rowMax && rowMin <= currentMax;
    if (overlaps) throw new AssessmentScoringError(409, 'Placement rule overlaps an existing active rule in this assessment version');
  }
}

async function sanitizePlacementRulePayload(body: any, tenantId: number | string, existing?: any) {
  const payload = extractBody(body);
  const assessmentVersion = await ensureEntityInTenant(ASSESSMENT_VERSION_UID, payload.assessmentVersion ?? existing?.assessmentVersion, tenantId, 'assessmentVersion');
  const ruleType = toText(payload.ruleType ?? existing?.ruleType) || 'percentage';
  const scoreBasis = toText(payload.scoreBasis ?? existing?.scoreBasis) || 'objective_only';
  const data = {
    assessmentVersion: assessmentVersion?.id,
    code: ensureRequiredText(payload.code ?? existing?.code, 'code'),
    label: ensureRequiredText(payload.label ?? existing?.label, 'label'),
    order: parseRequiredInteger(payload.order ?? existing?.order ?? 0, 'order'),
    ruleType,
    scoreBasis,
    minPercentage: parseOptionalDecimal(payload.minPercentage ?? existing?.minPercentage, 'minPercentage'),
    maxPercentage: parseOptionalDecimal(payload.maxPercentage ?? existing?.maxPercentage, 'maxPercentage'),
    minRawScore: parseOptionalDecimal(payload.minRawScore ?? existing?.minRawScore, 'minRawScore'),
    maxRawScore: parseOptionalDecimal(payload.maxRawScore ?? existing?.maxRawScore, 'maxRawScore'),
    level: toNullableText(payload.level ?? existing?.level)?.toUpperCase() || null,
    placementBandCode: toNullableText(payload.placementBandCode ?? existing?.placementBandCode),
    placementLabel: toNullableText(payload.placementLabel ?? existing?.placementLabel),
    status: toText(payload.status ?? existing?.status) || 'active',
    tenant: tenantId,
  } as any;
  if (data.ruleType === 'percentage' && data.minPercentage !== null && data.maxPercentage !== null && Number(data.minPercentage) > Number(data.maxPercentage)) {
    throw new AssessmentScoringError(400, 'minPercentage must be less than or equal to maxPercentage');
  }
  if (data.ruleType === 'raw_score' && data.minRawScore !== null && data.maxRawScore !== null && Number(data.minRawScore) > Number(data.maxRawScore)) {
    throw new AssessmentScoringError(400, 'minRawScore must be less than or equal to maxRawScore');
  }
  await ensurePlacementRuleVersionCompatibility(data, assessmentVersion);
  await ensurePlacementRuleNoOverlap(data, tenantId, Number(existing?.id || 0) || undefined);
  return data;
}

function buildResultStatus(summary: any, placement: any) {
  if (Number(summary.pendingManualCount || 0) > 0) return 'partially_scored';
  if (placement?.provisionalLevel) return 'provisional';
  return 'partially_scored';
}

function buildResultSnapshot(attempt: any, answerScores: any[], summary: any, sectionScores: any[], placement: any, rules: any[]) {
  return {
    snapshotVersion: 1,
    attempt: {
      id: normalizeId(attempt),
      documentId: attempt?.documentId || null,
      code: attempt?.code || '',
      submittedAt: attempt?.submittedAt || null,
    },
    assessment: {
      id: normalizeId(attempt?.assessment),
      documentId: attempt?.assessment?.documentId || null,
      code: attempt?.assessment?.code || '',
      name: attempt?.assessment?.name || '',
    },
    version: {
      id: normalizeId(attempt?.assessmentVersion),
      documentId: attempt?.assessmentVersion?.documentId || null,
      code: attempt?.assessmentVersion?.code || '',
      title: attempt?.assessmentVersion?.title || '',
      version: attempt?.assessmentVersion?.version ?? null,
      resultMode: attempt?.assessmentVersion?.resultMode || 'provisional',
      ceilingLevel: attempt?.assessmentVersion?.ceilingLevel || null,
    },
    scoreSummary: summary,
    sectionScores,
    placement: {
      provisionalLevel: placement?.provisionalLevel || null,
      placementBandCode: placement?.placementBandCode || null,
      placementLabel: placement?.placementLabel || null,
      placementNotes: placement?.placementNotes || null,
      scoreBasis: placement?.scoreBasis || null,
      ceilingApplied: placement?.ceilingApplied === true,
      rule: placement?.rule || null,
    },
    rules: rules.map((item) => ({
      code: item?.code || '',
      label: item?.label || '',
      ruleType: item?.ruleType || '',
      scoreBasis: item?.scoreBasis || '',
      minPercentage: item?.minPercentage ?? null,
      maxPercentage: item?.maxPercentage ?? null,
      minRawScore: item?.minRawScore ?? null,
      maxRawScore: item?.maxRawScore ?? null,
      level: item?.level || null,
      placementBandCode: item?.placementBandCode || null,
      placementLabel: item?.placementLabel || null,
    })),
    answerScores: answerScores.map((item) => ({
      assessmentQuestionId: item?.assessmentQuestionId || null,
      questionCode: item?.questionCode || '',
      questionType: item?.questionType || '',
      status: item?.status || '',
      awardedPoints: item?.awardedPoints ?? null,
      maxPoints: item?.maxPoints ?? null,
      scoringMethod: item?.scoringMethod || '',
      manualScoreRequired: item?.manualScoreRequired === true,
    })),
  };
}

export function getTenantIdFromContext(ctx: any) {
  return resolveCurrentTenantId(ctx);
}

export async function getAssessmentResult(attemptId: unknown, tenantId: number | string) {
  const row = await findResultByAttemptOrThrow(attemptId, tenantId);
  return mapResult(row);
}

export async function listAssessmentResults(query: Record<string, unknown> = {}, tenantId: number | string) {
  const { page, pageSize, start } = buildPagination(query);
  const q = toText(query?.q || query?.keyword);
  const assessmentRef = toText(query?.assessmentId || query?.assessment);
  const assessmentVersionRef = toText(query?.assessmentVersionId || query?.assessmentVersion);
  const status = toText(query?.status || query?.resultStatus);
  const provisionalLevel = toText(query?.provisionalLevel).toUpperCase();
  const hasManualPending = query?.hasManualPending;
  const currentOnly = query?.currentOnly;
  const submittedFrom = parseDateBoundary(query?.submittedFrom, 'submittedFrom', 'start');
  const submittedTo = parseDateBoundary(query?.submittedTo, 'submittedTo', 'end');
  const whereClauses: any[] = [];

  if (q) {
    whereClauses.push({
      $or: [
        { code: { $containsi: q } },
        { attempt: { code: { $containsi: q } } },
        { attempt: { candidateNameSnapshot: { $containsi: q } } },
        { attempt: { candidateEmailSnapshot: { $containsi: q } } },
        { assessment: { code: { $containsi: q } } },
        { assessment: { name: { $containsi: q } } },
      ],
    });
  }
  if (assessmentRef) whereClauses.push({ assessment: whereByParam(assessmentRef) });
  if (assessmentVersionRef) whereClauses.push({ assessmentVersion: whereByParam(assessmentVersionRef) });
  if (currentOnly !== undefined && currentOnly !== null && currentOnly !== '') {
    whereClauses.push({ isCurrent: { $eq: parseBoolean(currentOnly) } });
  }
  if (status) whereClauses.push({ status: { $eq: status } });
  if (provisionalLevel) whereClauses.push({ provisionalLevel: { $eq: provisionalLevel } });
  if (hasManualPending !== undefined && hasManualPending !== null && hasManualPending !== '') {
    whereClauses.push(parseBoolean(hasManualPending) ? { pendingManualCount: { $gt: 0 } } : { pendingManualCount: { $eq: 0 } });
  }
  if (submittedFrom || submittedTo) {
    const submittedAtWhere: any = {};
    if (submittedFrom) submittedAtWhere.$gte = submittedFrom;
    if (submittedTo) submittedAtWhere.$lte = submittedTo;
    whereClauses.push({ attempt: { submittedAt: submittedAtWhere } });
  }

  const where = mergeTenantWhere(whereClauses.length > 0 ? { $and: whereClauses } : {}, tenantId);
  const orderBy = normalizeSortInput(query?.sort).length > 0 ? normalizeSortInput(query?.sort) : [{ scoredAt: 'desc' }, { id: 'desc' }];
  const [rows, total] = await Promise.all([
    strapi.db.query(ASSESSMENT_RESULT_UID).findMany({
      where,
      offset: start,
      limit: pageSize,
      orderBy,
      populate: {
        attempt: {
          select: ['id', 'documentId', 'code', 'submittedAt', 'candidateNameSnapshot', 'candidateEmailSnapshot', 'candidatePhoneSnapshot'],
          populate: {
            user: { select: ['id', 'username', 'email', 'fullName'] },
            learner: { select: ['id', 'documentId', 'code', 'fullName'] },
            lead: { select: ['id', 'documentId', 'fullName', 'phone'] },
          },
        },
        assessment: { select: ['id', 'documentId', 'code', 'name'] },
        assessmentVersion: { select: ['id', 'documentId', 'code', 'title', 'version', 'candidateLevelFrom', 'candidateLevelTo', 'requiresSpeaking', 'requiresTeacherConfirmation', 'versionStatus', 'ceilingLevel'] },
      },
    }),
    strapi.db.query(ASSESSMENT_RESULT_UID).count({ where }),
  ]);

  return {
    data: (rows || []).map(mapResultListItem),
    meta: {
      pagination: {
        page,
        pageSize,
        pageCount: Math.max(1, Math.ceil(total / pageSize)),
        total,
      },
    },
  };
}

export async function getAssessmentResultDetail(resultId: unknown, tenantId: number | string) {
  const row = await findResultByIdOrThrow(resultId, tenantId, { detail: true });
  const reviewItems = buildAnswerReviewItems(row);
  const history = await listResultHistory(row?.attempt?.id || row?.attempt?.documentId, tenantId);
  const placementRules = await listPlacementRulesForVersion(row?.assessmentVersion?.id || row?.assessmentVersion?.documentId, tenantId);
  const speakingReview = await findCurrentSpeakingReviewByResultOrNull(row.id, tenantId);
  const placementConfirmation = await findCurrentPlacementConfirmationByResultOrNull(row.id, tenantId);
  const placementConfirmationHistory = await listPlacementConfirmationsForResult(row.id, tenantId);
  return {
    result: mapResult(row),
    versionConfig: {
      id: normalizeId(row?.assessmentVersion),
      documentId: row?.assessmentVersion?.documentId || null,
      code: row?.assessmentVersion?.code || '',
      version: Number(row?.assessmentVersion?.version || 0),
      candidateLevelFrom: row?.assessmentVersion?.candidateLevelFrom || null,
      candidateLevelTo: row?.assessmentVersion?.candidateLevelTo || null,
      requiresSpeaking: row?.assessmentVersion?.requiresSpeaking !== false,
      requiresTeacherConfirmation: row?.assessmentVersion?.requiresTeacherConfirmation !== false,
      ceilingLevel: row?.assessmentVersion?.ceilingLevel || null,
      versionStatus: row?.assessmentVersion?.versionStatus || null,
    },
    candidate: {
      name: resolveCandidateDisplayName(row?.attempt),
      email: row?.attempt?.candidateEmailSnapshot || row?.attempt?.user?.email || null,
      phone: row?.attempt?.candidatePhoneSnapshot || row?.attempt?.lead?.phone || null,
      user: mapUserSummary(row?.attempt?.user),
      learner: row?.attempt?.learner ? { id: normalizeId(row.attempt.learner), documentId: row?.attempt?.learner?.documentId || null, code: row?.attempt?.learner?.code || '', fullName: row?.attempt?.learner?.fullName || '' } : null,
      lead: row?.attempt?.lead ? { id: normalizeId(row.attempt.lead), documentId: row?.attempt?.lead?.documentId || null, fullName: row?.attempt?.lead?.fullName || '', phone: row?.attempt?.lead?.phone || '' } : null,
    },
    reviewItems,
    manualScoringItems: reviewItems.filter((item) => item.manualScoreRequired === true && ['pending', 'manual_scored'].includes(toText(item?.status))),
    speakingReview: mapSpeakingReview(speakingReview),
    placementConfirmation: mapPlacementConfirmation(placementConfirmation),
    placementConfirmationHistory,
    history,
    placementContext: {
      activeRuleCount: (placementRules || []).filter((item) => toText(item?.status) === 'active').length,
      hasActiveRules: (placementRules || []).some((item) => toText(item?.status) === 'active'),
    },
  };
}

export async function listAssessmentPlacementRules(query: Record<string, unknown> = {}, tenantId: number | string) {
  const assessmentVersionRef = toText(query?.assessmentVersionId || query?.assessmentVersion);
  const status = toText(query?.status);
  const whereClauses: any[] = [];
  if (assessmentVersionRef) whereClauses.push({ assessmentVersion: whereByParam(assessmentVersionRef) });
  if (status) whereClauses.push({ status });
  const where = mergeTenantWhere(whereClauses.length > 0 ? { $and: whereClauses } : {}, tenantId);
  const orderBy = normalizeSortInput(query?.sort).length > 0 ? normalizeSortInput(query?.sort) : [{ order: 'asc' }, { id: 'asc' }];
  const rows = await strapi.db.query(ASSESSMENT_PLACEMENT_RULE_UID).findMany({ where, orderBy, populate: { assessmentVersion: { select: ['id', 'documentId', 'code', 'title'] } } });
  return (rows || []).map(mapPlacementRule);
}

export async function createAssessmentPlacementRule(body: any, tenantId: number | string) {
  const data = await sanitizePlacementRulePayload(body, tenantId);
  const created = await strapi.db.query(ASSESSMENT_PLACEMENT_RULE_UID).create({ data });
  const row = await findPlacementRuleOrThrow(created.id, tenantId);
  return mapPlacementRule(row);
}

export async function updateAssessmentPlacementRule(id: unknown, body: any, tenantId: number | string) {
  const existing = await findPlacementRuleOrThrow(id, tenantId);
  const data = await sanitizePlacementRulePayload(body, tenantId, existing);
  await strapi.db.query(ASSESSMENT_PLACEMENT_RULE_UID).update({ where: { id: existing.id }, data });
  const row = await findPlacementRuleOrThrow(existing.id, tenantId);
  return mapPlacementRule(row);
}

export async function deleteAssessmentPlacementRule(id: unknown, tenantId: number | string) {
  const existing = await findPlacementRuleOrThrow(id, tenantId);
  await strapi.db.query(ASSESSMENT_PLACEMENT_RULE_UID).delete({ where: { id: existing.id } });
  return { id: normalizeId(existing) };
}

export async function getSpeakingReviewForResult(resultId: unknown, tenantId: number | string) {
  const result = await findResultByIdOrThrow(resultId, tenantId, { detail: true });
  const review = await findCurrentSpeakingReviewByResultOrNull(result.id, tenantId);
  const criteria = await listSpeakingCriteriaForVersion(result?.assessmentVersion?.id || result?.assessmentVersion?.documentId, tenantId);
  return {
    result: mapResult(result),
    versionConfig: {
      requiresSpeaking: result?.assessmentVersion?.requiresSpeaking !== false,
      requiresTeacherConfirmation: result?.assessmentVersion?.requiresTeacherConfirmation !== false,
      candidateLevelFrom: result?.assessmentVersion?.candidateLevelFrom || null,
      candidateLevelTo: result?.assessmentVersion?.candidateLevelTo || null,
      ceilingLevel: result?.assessmentVersion?.ceilingLevel || null,
    },
    criteriaDefinitions: criteria,
    speakingReview: mapSpeakingReview(review),
  };
}

export async function createSpeakingReviewForResult(resultId: unknown, tenantId: number | string, context: ScoreContext = {}) {
  const result = await findResultByIdOrThrow(resultId, tenantId, { detail: true });
  if (result?.isCurrent === false || toText(result?.status) === 'superseded') {
    throw new AssessmentScoringError(409, 'Only current assessment results can create speaking reviews');
  }
  if (result?.assessmentVersion?.requiresSpeaking === false) {
    throw new AssessmentScoringError(409, 'This assessment version does not require speaking review');
  }
  const existing = await findCurrentSpeakingReviewByResultOrNull(result.id, tenantId);
  if (existing?.id) return mapSpeakingReview(existing);

  const criteria = await listSpeakingCriteriaForVersion(result?.assessmentVersion?.id || result?.assessmentVersion?.documentId, tenantId);
  const criteriaSnapshot = buildSpeakingCriteriaSnapshot(criteria);
  const created = await strapi.db.query(ASSESSMENT_SPEAKING_REVIEW_UID).create({
    data: {
      assessmentResult: Number(result.id),
      assessmentAttempt: Number(result?.attempt?.id),
      assessment: Number(result?.assessment?.id),
      assessmentVersion: Number(result?.assessmentVersion?.id),
      user: result?.attempt?.user?.id ? Number(result.attempt.user.id) : null,
      learner: result?.attempt?.learner?.id ? Number(result.attempt.learner.id) : null,
      lead: result?.attempt?.lead?.id ? Number(result.attempt.lead.id) : null,
      status: 'pending',
      reviewer: context.authUserId ? Number(context.authUserId) : null,
      criteriaSnapshot,
      criteriaScores: criteriaSnapshot.map((item: any) => ({ criterionCode: item.criterionCode || item.code, code: item.code, label: item.label, description: item.description || '', guidance: item.guidance || '', order: item.order, score: null, maxScore: item.maxScore, required: item.required !== false, note: null })),
      reviewMode: 'live',
      maxScore: criteriaSnapshot.reduce((sum: number, item: any) => sum + Number(item?.maxScore || 0), 0),
      percentage: null,
      tenant: tenantId,
    },
  });
  const row = await findSpeakingReviewOrThrow(created.id, tenantId);
  await updateResultSpeakingCache(Number(result.id), row);
  return mapSpeakingReview(row);
}

export async function startSpeakingReview(id: unknown, tenantId: number | string, context: ScoreContext = {}) {
  const review = await findSpeakingReviewOrThrow(id, tenantId);
  if (toText(review?.status) === 'completed') return mapSpeakingReview(review);
  if (toText(review?.status) === 'cancelled') throw new AssessmentScoringError(409, 'Cancelled speaking reviews cannot be started');
  const authUserId = Number(context.authUserId || 0);
  if (!Number.isInteger(authUserId) || authUserId <= 0) throw new AssessmentScoringError(401, 'Unauthorized');
  await strapi.db.query(ASSESSMENT_SPEAKING_REVIEW_UID).update({
    where: { id: review.id },
    data: {
      status: 'in_review',
      reviewer: authUserId,
      reviewStartedAt: review?.reviewStartedAt || new Date().toISOString(),
    },
  });
  const updated = await findSpeakingReviewOrThrow(review.id, tenantId);
  await updateResultSpeakingCache(Number(review?.assessmentResult?.id || review?.assessmentResult), updated);
  return mapSpeakingReview(updated);
}

async function saveSpeakingReviewInternal(id: unknown, body: any, tenantId: number | string, options: { complete?: boolean; authUserId?: number | string | null } = {}) {
  const review = await findSpeakingReviewOrThrow(id, tenantId);
  const currentStatus = toText(review?.status) || 'pending';
  if (currentStatus === 'completed' || currentStatus === 'cancelled') {
    throw new AssessmentScoringError(409, 'This speaking review is read-only');
  }
  const payload = extractBody(body);
  const criteriaSnapshot = Array.isArray(review?.criteriaSnapshot) ? review.criteriaSnapshot : [];
  const criteriaScores = normalizeCriteriaScores(criteriaSnapshot, payload.criteriaScores, { requireAll: options.complete === true });
  const summary = summarizeCriteriaScores(criteriaScores);
  const percentage = summary.scoredCount > 0 && Number(summary.maxScore || 0) > 0 ? toRoundedPercentage(Number(summary.overallScore || 0), Number(summary.maxScore || 0)) : null;
  const suggestedLevel = validateLevelAgainstVersion(payload.suggestedLevel ?? review?.suggestedLevel, review?.assessmentVersion, 'suggestedLevel');
  const reviewMode = ['live', 'recording'].includes(toText(payload.reviewMode || review?.reviewMode)) ? toText(payload.reviewMode || review?.reviewMode) : 'live';
  const recordingAsset = await ensureEntityInTenant(FILE_ASSET_UID, payload.recordingAsset ?? review?.recordingAsset, tenantId, 'recordingAsset');
  const normalizedMaxScore = Number(summary.maxScore || review?.maxScore || 0) || null;
  const normalizedOverallScore = summary.scoredCount > 0 ? Number(summary.overallScore.toFixed(2)) : null;
  if (normalizedOverallScore !== null && normalizedOverallScore < 0) throw new AssessmentScoringError(400, 'overallScore must be greater than or equal to 0');
  if (normalizedOverallScore !== null && normalizedMaxScore !== null && normalizedOverallScore > normalizedMaxScore) {
    throw new AssessmentScoringError(400, 'overallScore must be less than or equal to maxScore');
  }
  const authUserId = Number(options.authUserId || 0);
  const nextStatus = options.complete === true ? 'completed' : currentStatus === 'pending' ? 'in_review' : currentStatus;
  const nextReviewer = Number(review?.reviewer?.id || 0) || authUserId || null;
  await strapi.db.query(ASSESSMENT_SPEAKING_REVIEW_UID).update({
    where: { id: review.id },
    data: {
      status: nextStatus,
      reviewer: nextReviewer,
      reviewStartedAt: review?.reviewStartedAt || (nextReviewer ? new Date().toISOString() : null),
      reviewedAt: options.complete === true ? new Date().toISOString() : review?.reviewedAt || null,
      reviewMode,
      recordingAsset: recordingAsset ? Number(recordingAsset.id) : null,
      overallScore: normalizedOverallScore,
      maxScore: normalizedMaxScore,
      percentage,
      criteriaScores,
      promptNotes: toNullableText(payload.promptNotes ?? review?.promptNotes),
      reviewNotes: toNullableText(payload.reviewNotes ?? review?.reviewNotes),
      strengths: toNullableText(payload.strengths ?? review?.strengths),
      areasForImprovement: toNullableText(payload.areasForImprovement ?? review?.areasForImprovement),
      suggestedLevel,
    },
  });
  const updated = await findSpeakingReviewOrThrow(review.id, tenantId);
  await updateResultSpeakingCache(Number(review?.assessmentResult?.id || review?.assessmentResult), updated);
  return mapSpeakingReview(updated);
}

export async function saveSpeakingReview(id: unknown, body: any, tenantId: number | string, context: ScoreContext = {}) {
  return saveSpeakingReviewInternal(id, body, tenantId, { authUserId: context.authUserId });
}

export async function completeSpeakingReview(id: unknown, body: any, tenantId: number | string, context: ScoreContext = {}) {
  const authUserId = Number(context.authUserId || 0);
  if (!Number.isInteger(authUserId) || authUserId <= 0) throw new AssessmentScoringError(401, 'Unauthorized');
  return saveSpeakingReviewInternal(id, body, tenantId, { complete: true, authUserId });
}

export async function getPlacementConfirmationForResult(resultId: unknown, tenantId: number | string) {
  const result = await findResultByIdOrThrow(resultId, tenantId, { detail: true });
  const current = await findCurrentPlacementConfirmationByResultOrNull(result.id, tenantId);
  const history = await listPlacementConfirmationsForResult(result.id, tenantId);
  const speakingReview = await findCurrentSpeakingReviewByResultOrNull(result.id, tenantId);
  return {
    result: mapResult(result),
    speakingReview: mapSpeakingReview(speakingReview),
    placementConfirmation: mapPlacementConfirmation(current),
    history,
  };
}

export async function getCandidatePreviewForAssessmentResult(resultId: unknown, tenantId: number | string) {
  const result = await findResultByIdOrThrow(resultId, tenantId, { detail: true });
  const attempt = result?.attempt || null;
  if (!attempt?.id) throw new AssessmentScoringError(404, 'Assessment Attempt not found for this result');

  const speakingReview = await findCurrentSpeakingReviewByResultOrNull(result.id, tenantId);
  const confirmation = await findCurrentPlacementConfirmationByResultOrNull(result.id, tenantId);
  const workflowState = (() => {
    const attemptStatus = toText(attempt?.status)
    if (attemptStatus === 'cancelled') return 'cancelled'
    if (attemptStatus === 'expired') return 'expired'
    if (attemptStatus !== 'submitted') return 'submitted'
    if (!result?.id) return 'scoring'
    if (Number(result?.pendingManualCount || 0) > 0) return 'manual_scoring_pending'
    if (toText(confirmation?.status) === 'confirmed' && confirmation?.confirmedLevel) return 'confirmed'
    if (result?.assessmentVersion?.requiresSpeaking !== false) {
      const speakingStatus = toText(speakingReview?.status)
      if (!speakingReview?.id || speakingStatus === 'pending') return 'speaking_pending'
      if (speakingStatus === 'in_review') return 'speaking_in_review'
    }
    if (result?.assessmentVersion?.requiresTeacherConfirmation !== false) return 'confirmation_pending'
    return 'provisional_ready'
  })();

  const revealScores = Number(result?.pendingManualCount || 0) === 0 && Boolean(result?.provisionalLevel || confirmation?.confirmedLevel)
  const statusBanner = (() => {
    if (workflowState === 'scoring') return { title: 'Đang xử lý kết quả', message: 'Kết quả của bạn đang được hệ thống xử lý.' }
    if (workflowState === 'manual_scoring_pending') return { title: 'Đang hoàn tất chấm bài', message: 'Bài làm của bạn đã được ghi nhận. Giáo viên đang hoàn tất việc chấm bài.' }
    if (workflowState === 'speaking_pending') return { title: 'Chờ Speaking', message: 'Bạn đã hoàn thành phần online. Vui lòng thực hiện phần Speaking theo hướng dẫn.' }
    if (workflowState === 'speaking_in_review') return { title: 'Speaking đang được đánh giá', message: 'Phần Speaking đang được giáo viên đánh giá.' }
    if (workflowState === 'confirmation_pending') return { title: 'Chờ xác nhận', message: result?.assessmentVersion?.requiresSpeaking !== false ? 'Phần Speaking đã hoàn thành. Kết quả đang chờ giáo viên xác nhận.' : 'Kết quả đang chờ giáo viên xác nhận mức xếp cuối cùng.' }
    if (workflowState === 'confirmed') return { title: 'Đã xác nhận', message: 'Kết quả đánh giá của bạn đã được xác nhận.' }
    if (workflowState === 'expired') return { title: 'Lượt làm bài đã hết hạn', message: 'Thời gian làm bài đã kết thúc.' }
    if (workflowState === 'cancelled') return { title: 'Lượt làm bài đã bị hủy', message: 'Lượt làm bài này không còn hiệu lực.' }
    return { title: 'Kết quả sơ bộ', message: result?.assessmentVersion?.requiresSpeaking !== false ? 'Đây là kết quả sơ bộ từ bài đánh giá online. Bạn cần hoàn thành phần Speaking để giáo viên xác nhận mức xếp cuối cùng.' : 'Đây là kết quả sơ bộ từ bài đánh giá online.' }
  })();

  return mapCandidateSafeResultPreview({
    attempt: {
      code: attempt?.code || '',
      status: attempt?.status || '',
      startedAt: attempt?.startedAt || null,
      submittedAt: attempt?.submittedAt || null,
      candidateName: attempt?.candidateDisplayName || attempt?.candidateNameSnapshot || null,
    },
    assessment: {
      code: result?.assessment?.code || '',
      name: result?.assessment?.name || '',
    },
    version: {
      code: result?.assessmentVersion?.code || '',
      title: result?.assessmentVersion?.title || '',
      resultMode: result?.assessmentVersion?.resultMode || 'provisional',
      requiresSpeaking: result?.assessmentVersion?.requiresSpeaking !== false,
      requiresTeacherConfirmation: result?.assessmentVersion?.requiresTeacherConfirmation !== false,
    },
    result: mapCandidatePreviewResult(result, { revealScores }),
    speaking: mapCandidatePreviewSpeaking(speakingReview, { revealScores }),
    confirmation: mapCandidatePreviewConfirmation(confirmation),
    workflowState,
    statusBanner,
    revealScores,
  });
}

export async function confirmAssessmentPlacement(resultId: unknown, body: any, tenantId: number | string, context: ScoreContext = {}) {
  const authUserId = Number(context.authUserId || 0);
  if (!Number.isInteger(authUserId) || authUserId <= 0) throw new AssessmentScoringError(401, 'Unauthorized');
  const result = await findResultByIdOrThrow(resultId, tenantId, { detail: true });
  if (result?.isCurrent === false || toText(result?.status) === 'superseded') {
    throw new AssessmentScoringError(409, 'Only current assessment results can be confirmed');
  }
  const version = result?.assessmentVersion || result?.attempt?.assessmentVersion;
  const speakingReview = await findCurrentSpeakingReviewByResultOrNull(result.id, tenantId);
  if (version?.requiresSpeaking !== false && toText(speakingReview?.status) !== 'completed') {
    throw new AssessmentScoringError(409, 'Completed speaking review is required before confirmation');
  }
  const payload = extractBody(body);
  const confirmedLevel = validateLevelAgainstVersion(payload.confirmedLevel, version, 'confirmedLevel');
  if (!confirmedLevel) throw new AssessmentScoringError(400, 'confirmedLevel is required');
  const decision = deriveConfirmationDecision(result?.provisionalLevel, confirmedLevel);
  await markCurrentPlacementConfirmationsSuperseded(Number(result.id), tenantId);
  const created = await strapi.db.query(ASSESSMENT_PLACEMENT_CONFIRMATION_UID).create({
    data: {
      assessmentResult: Number(result.id),
      assessmentSpeakingReview: speakingReview?.id ? Number(speakingReview.id) : null,
      assessmentAttempt: Number(result?.attempt?.id),
      assessment: Number(result?.assessment?.id),
      assessmentVersion: Number(result?.assessmentVersion?.id),
      confirmedBy: authUserId,
      status: 'confirmed',
      decision,
      provisionalLevelSnapshot: result?.provisionalLevel || null,
      provisionalBandCodeSnapshot: result?.placementBandCode || null,
      provisionalLabelSnapshot: result?.placementLabel || null,
      speakingSuggestedLevelSnapshot: speakingReview?.suggestedLevel || null,
      speakingSummarySnapshot: speakingReview ? {
        speakingReviewId: normalizeId(speakingReview),
        reviewMode: speakingReview?.reviewMode || 'live',
        overallScore: speakingReview?.overallScore ?? null,
        maxScore: speakingReview?.maxScore ?? null,
        percentage: speakingReview?.percentage ?? null,
        suggestedLevel: speakingReview?.suggestedLevel || null,
        reviewedAt: speakingReview?.reviewedAt || null,
        criteriaScores: speakingReview?.criteriaScores ?? [],
      } : null,
      resultSnapshot: {
        resultId: normalizeId(result),
        resultCode: result?.code || '',
        scoringVersion: result?.scoringVersion || 1,
        assessmentVersionCode: result?.assessmentVersion?.code || '',
        provisionalLevel: result?.provisionalLevel || null,
        placementBandCode: result?.placementBandCode || null,
        placementLabel: result?.placementLabel || null,
      },
      confirmedLevel,
      confirmedBandCode: toNullableText(payload.confirmedBandCode),
      confirmedLabel: toNullableText(payload.confirmedLabel),
      confirmationNote: toNullableText(payload.confirmationNote),
      confirmedAt: new Date().toISOString(),
      isCurrent: true,
      tenant: tenantId,
    },
  });
  const current = await findCurrentPlacementConfirmationByResultOrNull(result.id, tenantId);
  await updateResultConfirmationCache(Number(result.id), current);
  return mapPlacementConfirmation(current || created);
}

export async function setManualAnswerScore(answerScoreId: unknown, body: any, tenantId: number | string, context: ScoreContext = {}) {
  const where = whereByParam(answerScoreId);
  if (!where) throw new AssessmentScoringError(400, 'Assessment Answer Score id is invalid');
  const row = await strapi.db.query(ASSESSMENT_ANSWER_SCORE_UID).findOne({
    where: mergeTenantWhere(where, tenantId),
    populate: {
      result: { select: ['id', 'documentId', 'status', 'isCurrent'] },
      answer: { select: ['id', 'documentId', 'questionSnapshot'] },
      question: { select: ['id', 'documentId', 'code', 'type'] },
      assessmentQuestion: { select: ['id', 'documentId', 'order', 'points', 'required', 'minWords', 'maxWords'] },
      scoredBy: { select: ['id', 'username', 'email', 'fullName'] },
    },
  });
  if (!row) throw new AssessmentScoringError(404, 'Assessment Answer Score not found');
  if (!row?.result?.id || row?.result?.isCurrent === false || toText(row?.result?.status) === 'superseded') {
    throw new AssessmentScoringError(409, 'Only current assessment result scores can be manually updated');
  }
  const payload = extractBody(body);
  const awardedPoints = parseOptionalDecimal(payload.awardedPoints, 'awardedPoints');
  if (awardedPoints === null) throw new AssessmentScoringError(400, 'awardedPoints is required');
  const maxPoints = Number(row?.maxPoints ?? 0);
  if (awardedPoints < 0) throw new AssessmentScoringError(400, 'awardedPoints must be greater than or equal to 0');
  if (awardedPoints > maxPoints) throw new AssessmentScoringError(400, 'awardedPoints must be less than or equal to maxPoints');

  const questionType = toText(row?.question?.type || row?.answer?.questionSnapshot?.questionType);
  const currentStatus = toText(row?.status) || 'pending';
  const manualAllowed = row?.manualScoreRequired === true || PENDING_MANUAL_TYPES.has(questionType);
  if (!manualAllowed) throw new AssessmentScoringError(409, 'This answer score does not allow manual scoring');
  if (!['pending', 'manual_scored'].includes(currentStatus)) throw new AssessmentScoringError(409, 'Only pending or manually scored answers can be updated manually');

  const authUserId = Number(context.authUserId || 0);
  if (!Number.isInteger(authUserId) || authUserId <= 0) throw new AssessmentScoringError(401, 'Unauthorized');

  await strapi.db.query(ASSESSMENT_ANSWER_SCORE_UID).update({
    where: { id: row.id },
    data: {
      awardedPoints,
      status: 'manual_scored',
      scoringMethod: 'manual',
      isCorrect: null,
      scoredBy: authUserId,
      manualScoredAt: new Date().toISOString(),
      manualScoreNote: toNullableText(payload.manualScoreNote),
    },
  });

  const recalculated = await recalculateResultRowOrThrow(row.result.id, tenantId);
  const refreshedScore = (recalculated?.answerScores || []).find((item: any) => String(item?.id || item?.documentId || '') === String(normalizeId(row) || row.id || '')) || null;

  return {
    result: mapResult(recalculated),
    answerScore: refreshedScore,
  };
}

export async function scoreAssessmentAttempt(attemptId: unknown, tenantId: number | string, options: { forceRescore?: boolean; scoringVersion?: number } = {}) {
  const attempt = await findAttemptForScoringOrThrow(attemptId, tenantId);
  const status = toText(attempt?.status);
  if (status !== 'submitted') throw new AssessmentScoringError(409, 'Only submitted assessment attempts can be scored');

  const forceRescore = options.forceRescore === true;
  const scoringVersion = Number(options.scoringVersion || 1) || 1;
  const currentResult = await strapi.db.query(ASSESSMENT_RESULT_UID).findOne({
    where: mergeTenantWhere({ attempt: { id: { $eq: Number(attempt.id) } }, isCurrent: true }, tenantId),
    populate: await buildResultPopulate(),
    orderBy: [{ scoredAt: 'desc' }, { id: 'desc' }],
  });
  if (currentResult && !forceRescore && Number(currentResult?.scoringVersion || 1) === scoringVersion) {
    return mapResult(currentResult);
  }

  if (forceRescore && currentResult?.id) {
    await markExistingResultsSuperseded(Number(attempt.id), tenantId);
  }

  const scoringSnapshot = attempt?.scoringSnapshot;
  if (!scoringSnapshot || typeof scoringSnapshot !== 'object') {
    throw new AssessmentScoringError(400, 'Assessment Attempt is missing scoringSnapshot');
  }
  const snapshotQuestions = getScoringQuestions(scoringSnapshot);
  const answers = Array.isArray(attempt?.answers) ? attempt.answers.map(mapAnswer) : [];
  const answerMap = new Map<string, any>(answers.map((answer) => [String(answer?.assessmentQuestion?.id || answer?.assessmentQuestion?.documentId || answer?.assessmentQuestion?.code || answer?.assessmentQuestionId || ''), answer]));

  const sectionByAssessmentQuestion = new Map(snapshotQuestions.map((item) => [String(item?.assessmentQuestionId || ''), item]));
  const scoreRows = snapshotQuestions.map((snapshotQuestion) => {
    const answer = answerMap.get(String(snapshotQuestion?.assessmentQuestionId || '')) || null;
    const score = scoreSnapshotQuestion(snapshotQuestion, answer);
    return {
      assessmentQuestionId: snapshotQuestion?.assessmentQuestionId || null,
      assessmentQuestionDocumentId: snapshotQuestion?.assessmentQuestionDocumentId || null,
      questionId: snapshotQuestion?.questionId || null,
      questionDocumentId: snapshotQuestion?.questionDocumentId || null,
      questionCode: snapshotQuestion?.questionCode || '',
      questionType: snapshotQuestion?.questionType || '',
      sectionCode: snapshotQuestion?.sectionCode || '',
      sectionTitle: snapshotQuestion?.sectionTitle || '',
      ...score,
    };
  });

  const summary = calculateResultSummary(scoreRows);
  const sectionScores = calculateSectionScores(snapshotQuestions, scoreRows);
  const placementRules = await listPlacementRulesForVersion(attempt?.assessmentVersion?.id || attempt?.assessmentVersion?.documentId, tenantId);
  const placement = applyPlacementRules(placementRules, {
    ceilingLevel: attempt?.assessmentVersion?.ceilingLevel || scoringSnapshot?.version?.ceilingLevel || null,
  }, summary);
  const resultStatus = buildResultStatus(summary, placement);

  if (!forceRescore && currentResult?.id) {
    return mapResult(currentResult);
  }
  if (currentResult?.id) {
    await markExistingResultsSuperseded(Number(attempt.id), tenantId);
  }

  const code = await generateResultCode(tenantId);
  const resultSnapshot = buildResultSnapshot(attempt, scoreRows, summary, sectionScores, placement, placementRules);
  const createdResult = await strapi.db.query(ASSESSMENT_RESULT_UID).create({
    data: {
      code,
      attempt: Number(attempt.id),
      assessment: Number(normalizeDbId(attempt?.assessment)),
      assessmentVersion: Number(normalizeDbId(attempt?.assessmentVersion)),
      status: resultStatus,
      resultMode: scoringSnapshot?.version?.resultMode || 'provisional',
      scoringVersion,
      scoringStartedAt: attempt?.submittedAt || new Date().toISOString(),
      scoredAt: new Date().toISOString(),
      rawScore: summary.rawScore,
      maxScore: summary.maxScore,
      percentage: summary.percentage,
      objectiveScore: summary.objectiveScore,
      objectiveMaxScore: summary.objectiveMaxScore,
      manualScore: summary.manualScore,
      manualMaxScore: summary.manualMaxScore,
      pendingManualCount: summary.pendingManualCount,
      pendingManualMaxScore: summary.pendingManualMaxScore,
      configuredTotalMaxScore: summary.configuredTotalMaxScore,
      sectionScores,
      scoreSummary: summary,
      provisionalLevel: placement.provisionalLevel,
      placementBandCode: placement.placementBandCode,
      placementLabel: placement.placementLabel,
      placementNotes: placement.placementNotes,
      speakingReviewStatus: attempt?.assessmentVersion?.requiresSpeaking === false ? null : 'pending',
      speakingSuggestedLevel: null,
      speakingReviewedAt: null,
      confirmationStatus: attempt?.assessmentVersion?.requiresTeacherConfirmation === false ? null : 'draft',
      confirmedLevel: null,
      confirmedBandCode: null,
      confirmedLabel: null,
      confirmedAt: null,
      resultSnapshot,
      isCurrent: true,
      tenant: tenantId,
    },
  });

  for (const row of scoreRows) {
    const answer = answers.find((item) => String(item?.assessmentQuestion?.id || item?.assessmentQuestion?.documentId || '') === String(row.assessmentQuestionId || row.assessmentQuestionDocumentId || '')) || null;
    await strapi.db.query(ASSESSMENT_ANSWER_SCORE_UID).create({
      data: {
        result: Number(createdResult.id),
        attempt: Number(attempt.id),
        answer: answer?.dbId ? Number(answer.dbId) : null,
        assessmentQuestion: await ensureEntityInTenant(ASSESSMENT_QUESTION_UID, row.assessmentQuestionId || row.assessmentQuestionDocumentId, tenantId, 'assessmentQuestion').then((item) => Number(item.id)),
        question: await ensureEntityInTenant(QUESTION_UID, row.questionId || row.questionDocumentId, tenantId, 'question').then((item) => Number(item.id)),
        status: row.status,
        awardedPoints: row.awardedPoints,
        maxPoints: row.maxPoints,
        isCorrect: row.isCorrect,
        scoringMethod: row.scoringMethod,
        scoringDetail: row.scoringDetail,
        manualScoreRequired: row.manualScoreRequired,
        tenant: tenantId,
      },
    });
  }

  const result = await findResultByAttemptOrThrow(attemptId, tenantId);
  return mapResult(result);
}

export async function rescoreAssessmentAttempt(attemptId: unknown, tenantId: number | string, options: { scoringVersion?: number } = {}) {
  return scoreAssessmentAttempt(attemptId, tenantId, { ...options, forceRescore: true });
}

export async function recalculateAssessmentResult(resultId: unknown, tenantId: number | string) {
  const row = await recalculateResultRowOrThrow(resultId, tenantId);
  return mapResult(row);
}

export default {
  getTenantIdFromContext,
  getAssessmentResult,
  listAssessmentResults,
  getAssessmentResultDetail,
  getCandidatePreviewForAssessmentResult,
  getSpeakingReviewForResult,
  createSpeakingReviewForResult,
  startSpeakingReview,
  saveSpeakingReview,
  completeSpeakingReview,
  getPlacementConfirmationForResult,
  confirmAssessmentPlacement,
  listAssessmentPlacementRules,
  createAssessmentPlacementRule,
  updateAssessmentPlacementRule,
  deleteAssessmentPlacementRule,
  scoreAssessmentAttempt,
  setManualAnswerScore,
  rescoreAssessmentAttempt,
  recalculateAssessmentResult,
};