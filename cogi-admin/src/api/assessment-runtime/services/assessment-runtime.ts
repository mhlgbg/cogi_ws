import crypto from 'node:crypto';
import { extractRelationRef, findEntityByRef, mergeTenantWhere, normalizeSortInput, resolveCurrentTenantId, toText, whereByParam } from '../../../utils/tenant-scope';
import { getAssessmentVersionDetail } from '../../assessment-management/services/assessment-management';
import { scoreAssessmentAttempt } from '../../assessment-scoring/services/assessment-scoring';

const ASSESSMENT_UID = 'api::assessment.assessment';
const ASSESSMENT_VERSION_UID = 'api::assessment-version.assessment-version';
const ASSESSMENT_SECTION_UID = 'api::assessment-section.assessment-section';
const ASSESSMENT_QUESTION_UID = 'api::assessment-question.assessment-question';
const ASSESSMENT_ATTEMPT_UID = 'api::assessment-attempt.assessment-attempt';
const ASSESSMENT_ANSWER_UID = 'api::assessment-answer.assessment-answer';
const ASSESSMENT_RESULT_UID = 'api::assessment-result.assessment-result';
const ASSESSMENT_SPEAKING_REVIEW_UID = 'api::assessment-speaking-review.assessment-speaking-review';
const ASSESSMENT_PLACEMENT_CONFIRMATION_UID = 'api::assessment-placement-confirmation.assessment-placement-confirmation';
const ASSIGNMENT_TASK_UID = 'api::assignment-task.assignment-task';
const FILE_ASSET_UID = 'api::file-asset.file-asset';
const QUESTION_UID = 'api::question.question';
const LEARNER_UID = 'api::learner.learner';
const LEAD_UID = 'api::lead.lead';
const USER_UID = 'plugin::users-permissions.user';

const ATTEMPT_STATUSES = ['created', 'in_progress', 'submitted', 'expired', 'cancelled'] as const;
const SOURCE_TYPES = ['admin', 'admin_test', 'campaign', 'public', 'learner', 'exam', 'other'] as const;
type AttemptStatus = (typeof ATTEMPT_STATUSES)[number];
type SourceType = (typeof SOURCE_TYPES)[number];

type RuntimeContext = {
  authUserId?: number | string | null;
  allowManagerAccess?: boolean;
};

type FinalizeExpiredAttemptOptions = {
  allowLegacyExpired?: boolean;
  persistDerivedExpiresAt?: boolean;
  rejectIfNotOverdue?: boolean;
  rejectIfDeadlineMissing?: boolean;
  submittedAt?: string | null;
};

type AssessmentRuntimeAudioTokenPayload = {
  purpose: 'assessment_runtime_audio';
  tenantId: number | string;
  tenantCode?: string | null;
  attemptId: string;
  assessmentQuestionId: string;
  fileAssetRef: string;
  exp: number;
};

type AssessmentRuntimeFileAssetTokenPayload = {
  purpose: 'assessment_runtime_file_asset';
  tenantId: number | string;
  tenantCode?: string | null;
  attemptId: string;
  fileAssetRef: string;
  exp: number;
};

type AnswerRuntimeMeta = {
  activeAudioPlay?: {
    playId: string;
    startedAt: string;
  } | null;
};

class AssessmentRuntimeError extends Error {
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
  if (!text) throw new AssessmentRuntimeError(400, `${fieldName} is required`);
  return text;
}

function parseBoolean(value: unknown, fallback = false): boolean {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value !== 0;
  const text = toText(value).toLowerCase();
  if (!text) return fallback;
  return ['true', '1', 'yes', 'on'].includes(text);
}

function parseOptionalInteger(value: unknown, fieldName: string): number | null {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(value);
  if (!Number.isInteger(parsed)) throw new AssessmentRuntimeError(400, `${fieldName} must be an integer`);
  return parsed;
}

function parseNonNegativeInteger(value: unknown, fieldName: string): number {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 0) throw new AssessmentRuntimeError(400, `${fieldName} must be a non-negative integer`);
  return parsed;
}

function parseAssignmentTaskSourceRef(sourceRef: unknown) {
  const text = toText(sourceRef);
  const match = /^assignment-task:(\d+):learner:(\d+)$/i.exec(text);
  if (!match) return null;
  return {
    taskId: Number(match[1]),
    learnerId: Number(match[2]),
  };
}

function parseJsonObject(value: unknown, fieldName: string) {
  if (value === undefined) return undefined;
  if (value === null || value === '') return null;
  if (typeof value === 'object') return value;
  const text = toText(value);
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    throw new AssessmentRuntimeError(400, `${fieldName} must be valid JSON`);
  }
}

function resolveEffectiveSnapshotStimulus(snapshotQuestion: any) {
  return snapshotQuestion?.sectionStimulus || snapshotQuestion?.question?.stimulus || null;
}

function hasAudioStimulus(snapshotQuestion: any) {
  return Boolean(resolveEffectiveSnapshotStimulus(snapshotQuestion)?.audioAsset);
}

function normalizeListenRequirementRatio(snapshotQuestion: any) {
  const ratio = Number(snapshotQuestion?.minListenRatioBeforeAnswer || 0);
  if (!Number.isFinite(ratio) || ratio <= 0) return 0;
  return Math.max(0, Math.min(1, ratio));
}

function hasListenRequirement(snapshotQuestion: any) {
  return normalizeListenRequirementRatio(snapshotQuestion) > 0;
}

function buildSnapshotStimulus(row: any) {
  if (!row) return null;
  return {
    id: normalizeId(row),
    documentId: row?.documentId || null,
    code: row?.code || '',
    title: row?.title || '',
    type: row?.type || '',
    instruction: row?.instruction || '',
    content: row?.content || '',
    contentType: toText(row?.contentType).toLowerCase() === 'html' ? 'html' : 'plain_text',
    audioAsset: sanitizeFileAssetSnapshot(row?.audioAsset),
    imageAsset: sanitizeFileAssetSnapshot(row?.imageAsset),
  };
}

function normalizeHtmlContentType(value: unknown): 'plain_text' | 'html' {
  return toText(value).toLowerCase() === 'html' ? 'html' : 'plain_text';
}

function normalizeQuestionDisplayMode(value: unknown): 'single' | 'all' | 'inline_fill' {
  const normalized = toText(value).toLowerCase();
  if (normalized === 'all') return 'all';
  if (normalized === 'inline_fill') return 'inline_fill';
  return 'single';
}

function normalizeQuestionLayoutContentType(_: unknown): 'html' {
  return 'html';
}

function parseAnswerRuntimeMeta(value: unknown): AnswerRuntimeMeta {
  const payload = parseJsonObject(value, 'runtimeMeta');
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return {};
  return payload as AnswerRuntimeMeta;
}

function buildActiveAudioPlayMeta(playId: string): AnswerRuntimeMeta {
  return {
    activeAudioPlay: {
      playId,
      startedAt: new Date().toISOString(),
    },
  };
}

function clearActiveAudioPlayMeta(meta: AnswerRuntimeMeta = {}): AnswerRuntimeMeta {
  return {
    ...meta,
    activeAudioPlay: null,
  };
}

function isPersistedListenRequirementSatisfied(answer: any) {
  return answer?.listenRequirementSatisfied === true;
}

function hasStartedAnyAudioPlay(answer: any) {
  return Number(answer?.audioPlayCount || 0) >= 1;
}

function resolveEffectiveAudioPlayLimit(snapshotQuestion: any) {
  if (snapshotQuestion?.sectionStimulus && snapshotQuestion?.sectionAudioPlayLimit !== null && snapshotQuestion?.sectionAudioPlayLimit !== undefined) {
    return snapshotQuestion.sectionAudioPlayLimit;
  }
  return snapshotQuestion?.audioPlayLimit ?? null;
}

function canSaveAudioAnswer(snapshotQuestion: any, answer: any) {
  if (!hasAudioStimulus(snapshotQuestion)) return { allowed: true, errorCode: null };
  if (hasListenRequirement(snapshotQuestion)) {
    return {
      allowed: isPersistedListenRequirementSatisfied(answer),
      errorCode: 'LISTEN_REQUIREMENT_NOT_SATISFIED',
    };
  }
  return {
    allowed: hasStartedAnyAudioPlay(answer),
    errorCode: 'AUDIO_NOT_STARTED',
  };
}

function normalizeDate(value: unknown) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(String(value));
  return Number.isNaN(date.getTime()) ? null : date;
}

function addMinutes(date: Date, minutes: number | null) {
  if (!minutes || minutes <= 0) return null;
  return new Date(date.getTime() + minutes * 60 * 1000);
}

function getAssessmentRuntimeMediaSigningSecret() {
  const appKeys = toText(process.env.APP_KEYS);
  if (appKeys) {
    const first = appKeys.split(',').map((item) => item.trim()).find(Boolean);
    if (first) return first;
  }
  const jwtSecret = toText(process.env.JWT_SECRET || process.env.ADMIN_JWT_SECRET);
  if (jwtSecret) return jwtSecret;
  return 'assessment-runtime-media-secret';
}

function signAssessmentRuntimeAudioToken(payload: AssessmentRuntimeAudioTokenPayload) {
  const encodedPayload = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
  const signature = crypto.createHmac('sha256', getAssessmentRuntimeMediaSigningSecret()).update(encodedPayload).digest('base64url');
  return `${encodedPayload}.${signature}`;
}

function signAssessmentRuntimeFileAssetToken(payload: AssessmentRuntimeFileAssetTokenPayload) {
  const encodedPayload = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
  const signature = crypto.createHmac('sha256', getAssessmentRuntimeMediaSigningSecret()).update(encodedPayload).digest('base64url');
  return `${encodedPayload}.${signature}`;
}

export function verifyAssessmentRuntimeAudioToken(token: string, expectedAttemptId?: unknown, expectedAssessmentQuestionId?: unknown) {
  const normalizedToken = toText(token);
  if (!normalizedToken || !normalizedToken.includes('.')) {
    throw new AssessmentRuntimeError(400, 'Invalid assessment runtime audio token');
  }

  const [encodedPayload, signature] = normalizedToken.split('.');
  const expectedSignature = crypto.createHmac('sha256', getAssessmentRuntimeMediaSigningSecret()).update(encodedPayload).digest('base64url');
  if (signature !== expectedSignature) {
    throw new AssessmentRuntimeError(400, 'Invalid assessment runtime audio token');
  }

  let payload: AssessmentRuntimeAudioTokenPayload | null = null;
  try {
    payload = JSON.parse(Buffer.from(encodedPayload, 'base64url').toString('utf8')) as AssessmentRuntimeAudioTokenPayload;
  } catch {
    throw new AssessmentRuntimeError(400, 'Invalid assessment runtime audio token');
  }

  if (payload?.purpose !== 'assessment_runtime_audio') {
    throw new AssessmentRuntimeError(400, 'Invalid assessment runtime audio token');
  }

  if (!Number.isFinite(Number(payload?.exp || 0)) || Number(payload?.exp || 0) <= Date.now()) {
    throw new AssessmentRuntimeError(401, 'Assessment runtime audio token expired');
  }

  if (expectedAttemptId !== undefined && String(payload?.attemptId || '') !== String(expectedAttemptId || '')) {
    throw new AssessmentRuntimeError(403, 'Assessment runtime audio token does not match attempt');
  }

  if (expectedAssessmentQuestionId !== undefined && String(payload?.assessmentQuestionId || '') !== String(expectedAssessmentQuestionId || '')) {
    throw new AssessmentRuntimeError(403, 'Assessment runtime audio token does not match question');
  }

  return payload;
}

export function verifyAssessmentRuntimeFileAssetToken(token: string, expectedAttemptId?: unknown) {
  const normalizedToken = toText(token);
  if (!normalizedToken || !normalizedToken.includes('.')) {
    throw new AssessmentRuntimeError(400, 'Invalid assessment runtime file asset token');
  }

  const [encodedPayload, signature] = normalizedToken.split('.');
  const expectedSignature = crypto.createHmac('sha256', getAssessmentRuntimeMediaSigningSecret()).update(encodedPayload).digest('base64url');
  if (signature !== expectedSignature) {
    throw new AssessmentRuntimeError(400, 'Invalid assessment runtime file asset token');
  }

  let payload: AssessmentRuntimeFileAssetTokenPayload | null = null;
  try {
    payload = JSON.parse(Buffer.from(encodedPayload, 'base64url').toString('utf8')) as AssessmentRuntimeFileAssetTokenPayload;
  } catch {
    throw new AssessmentRuntimeError(400, 'Invalid assessment runtime file asset token');
  }

  if (payload?.purpose !== 'assessment_runtime_file_asset') {
    throw new AssessmentRuntimeError(400, 'Invalid assessment runtime file asset token');
  }

  if (!Number.isFinite(Number(payload?.exp || 0)) || Number(payload?.exp || 0) <= Date.now()) {
    throw new AssessmentRuntimeError(401, 'Assessment runtime file asset token expired');
  }

  if (expectedAttemptId !== undefined && String(payload?.attemptId || '') !== String(expectedAttemptId || '')) {
    throw new AssessmentRuntimeError(403, 'Assessment runtime file asset token does not match attempt');
  }

  return payload;
}

function normalizeDurationMinutes(value: unknown) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) return null;
  return parsed;
}

function resolveAttemptDeadlineInfo(attempt: any) {
  const storedExpiresAt = normalizeDate(attempt?.expiresAt);
  if (storedExpiresAt) {
    return {
      expiresAt: storedExpiresAt,
      source: 'stored',
      canPersist: false,
    };
  }
  const startedAt = normalizeDate(attempt?.startedAt);
  const durationMinutes = normalizeDurationMinutes(attempt?.assessmentVersion?.durationMinutes);
  const derivedExpiresAt = startedAt && durationMinutes ? addMinutes(startedAt, durationMinutes) : null;
  return {
    expiresAt: derivedExpiresAt,
    source: derivedExpiresAt ? 'derived' : 'missing',
    canPersist: Boolean(derivedExpiresAt),
  };
}

function normalizeSimpleRelation(row: any) {
  if (!row) return null;
  return {
    id: normalizeId(row),
    documentId: row?.documentId || null,
    code: row?.code || '',
    title: row?.title || row?.name || row?.fullName || '',
    name: row?.name || row?.title || row?.fullName || '',
  };
}

function normalizeUserRelation(row: any) {
  if (!row) return null;
  return {
    id: normalizeId(row),
    documentId: row?.documentId || null,
    username: row?.username || '',
    email: row?.email || '',
    fullName: row?.fullName || '',
  };
}

function sanitizeFileAssetSnapshot(row: any) {
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

function buildLegacyRuntimeFileAssetUrl(asset: any) {
  const explicitUrl = toText(asset?.url);
  if (explicitUrl) return explicitUrl;
  const relativePath = toText(asset?.relativePath).replace(/^\/+/, '');
  return relativePath ? `/storage/${relativePath}` : '';
}

function buildRuntimeFileAssetDeliveryUrl(attempt: any, asset: any) {
  const fileAssetRef = toText(asset?.id || asset?.documentId);
  if (!fileAssetRef) return buildLegacyRuntimeFileAssetUrl(asset);

  const attemptRefValue = String(normalizeId(attempt) || '');
  const token = signAssessmentRuntimeFileAssetToken({
    purpose: 'assessment_runtime_file_asset',
    tenantId: extractRelationRef(attempt?.tenant) || '',
    tenantCode: toText(attempt?.tenant?.code) || null,
    attemptId: attemptRefValue,
    fileAssetRef,
    exp: Date.now() + 10 * 60 * 1000,
  });

  return `/api/storage/files/${encodeURIComponent(fileAssetRef)}/download?mediaToken=${encodeURIComponent(token)}`;
}

function buildRuntimeFileAssetDescriptor(attempt: any, asset: any) {
  if (!asset || typeof asset !== 'object') return null;

  return {
    ...asset,
    name: toText(asset?.fileName || asset?.originalName || asset?.code || 'file'),
    url: buildRuntimeFileAssetDeliveryUrl(attempt, asset),
  };
}

function buildRuntimeAudioAssetDescriptor(attempt: any, assessmentQuestionRef: unknown, audioAsset: any) {
  if (!audioAsset || typeof audioAsset !== 'object') return null;

  const attemptRefValue = String(normalizeId(attempt) || '');
  const assessmentQuestionRefValue = String(assessmentQuestionRef || '');
  const fileAssetRef = String(normalizeId(audioAsset) || audioAsset?.documentId || '');
  const token = signAssessmentRuntimeAudioToken({
    purpose: 'assessment_runtime_audio',
    tenantId: extractRelationRef(attempt?.tenant) || '',
    tenantCode: toText(attempt?.tenant?.code) || null,
    attemptId: attemptRefValue,
    assessmentQuestionId: assessmentQuestionRefValue,
    fileAssetRef,
    exp: Date.now() + 10 * 60 * 1000,
  });
  const runtimeUrl = `/api/assessment-runtime/assessment-attempts/${encodeURIComponent(attemptRefValue)}/questions/${encodeURIComponent(assessmentQuestionRefValue)}/audio?mediaToken=${encodeURIComponent(token)}`;

  return {
    ...audioAsset,
    name: toText(audioAsset?.fileName || audioAsset?.originalName || audioAsset?.code || 'audio'),
    url: runtimeUrl,
    runtimeUrl,
  };
}

function sortByOrder<T extends Record<string, any>>(rows: T[] = []) {
  return [...rows].sort((left, right) => {
    const leftOrder = Number(left?.order || 0);
    const rightOrder = Number(right?.order || 0);
    if (leftOrder !== rightOrder) return leftOrder - rightOrder;
    return String(normalizeId(left) || '').localeCompare(String(normalizeId(right) || ''));
  });
}

function buildCandidateQuestionSnapshot(item: any) {
  const question = item?.question || {};
  const options = sortByOrder(Array.isArray(question?.options) ? question.options : []).map((option: any) => ({
    id: normalizeId(option),
    documentId: option?.documentId || null,
    label: option?.label || '',
    value: option?.value || '',
    content: option?.content || '',
    order: Number(option?.order || 0),
    imageAsset: sanitizeFileAssetSnapshot(option?.imageAsset),
  }));
  return {
    assessmentQuestionId: normalizeId(item),
    assessmentQuestionDocumentId: item?.documentId || null,
    questionId: normalizeId(question),
    questionDocumentId: question?.documentId || null,
    questionCode: question?.code || '',
    order: Number(item?.order || 0),
    points: Number(item?.points || 0),
    required: item?.required !== false,
    audioPlayLimit: item?.audioPlayLimit ?? null,
    allowSeek: item?.allowSeek !== false,
    minListenRatioBeforeAnswer: item?.minListenRatioBeforeAnswer ?? null,
    minWords: item?.minWords ?? null,
    maxWords: item?.maxWords ?? null,
    config: item?.config ?? null,
    question: {
      id: normalizeId(question),
      documentId: question?.documentId || null,
      code: question?.code || '',
      title: question?.title || '',
      questionText: question?.questionText || '',
      questionTextType: toText(question?.questionTextType).toLowerCase() === 'html' ? 'html' : 'plain_text',
      type: question?.type || '',
      difficulty: question?.difficulty || '',
      questionImageAssetCode: question?.questionImageAsset?.code || null,
      questionImageAsset: sanitizeFileAssetSnapshot(question?.questionImageAsset),
      stimulus: buildSnapshotStimulus(question?.stimulus),
      options,
    },
  };
}

function buildScoringQuestionSnapshot(item: any) {
  const question = item?.question || {};
  return {
    assessmentQuestionId: normalizeId(item),
    assessmentQuestionDocumentId: item?.documentId || null,
    questionId: normalizeId(question),
    questionDocumentId: question?.documentId || null,
    questionCode: question?.code || '',
    order: Number(item?.order || 0),
    points: Number(item?.points || 0),
    questionType: question?.type || '',
    correctAnswer: question?.correctAnswer ?? null,
    rubric: question?.rubric ?? null,
    explanation: question?.explanation || '',
    options: sortByOrder(Array.isArray(question?.options) ? question.options : []).map((option: any) => ({
      id: normalizeId(option),
      documentId: option?.documentId || null,
      label: option?.label || '',
      value: option?.value || '',
      isCorrect: option?.isCorrect === true,
      order: Number(option?.order || 0),
    })),
  };
}

function buildAttemptSnapshots(versionDetail: any) {
  const sections = sortByOrder(Array.isArray(versionDetail?.sections) ? versionDetail.sections : []).map((section: any) => {
    const assessmentQuestions = sortByOrder(Array.isArray(section?.assessmentQuestions) ? section.assessmentQuestions : []);
    return {
      id: normalizeId(section),
      documentId: section?.documentId || null,
      code: section?.code || '',
      title: section?.title || '',
      description: section?.description || '',
      instruction: section?.instruction || '',
      instructionContentType: normalizeHtmlContentType(section?.instructionContentType),
      instructionImageAssetCode: section?.instructionImageAsset?.code || null,
      instructionImageAsset: sanitizeFileAssetSnapshot(section?.instructionImageAsset),
      stimulusCode: section?.stimulus?.code || null,
      stimulus: buildSnapshotStimulus(section?.stimulus),
      questionDisplayMode: normalizeQuestionDisplayMode(section?.questionDisplayMode),
      questionLayoutContent: section?.questionLayoutContent || '',
      questionLayoutContentType: normalizeQuestionLayoutContentType(section?.questionLayoutContentType),
      audioPlayLimit: section?.audioPlayLimit ?? null,
      listenLimit: section?.audioPlayLimit ?? null,
      order: Number(section?.order || 0),
      skill: normalizeSimpleRelation(section?.skill),
      questions: assessmentQuestions.map(buildCandidateQuestionSnapshot),
      scoringQuestions: assessmentQuestions.map(buildScoringQuestionSnapshot),
    };
  });

  const totalQuestions = sections.reduce((sum, section) => sum + (Array.isArray(section.questions) ? section.questions.length : 0), 0);
  return {
    definitionSnapshot: {
      snapshotVersion: 1,
      assessment: {
        id: normalizeId(versionDetail?.assessment),
        documentId: versionDetail?.assessment?.documentId || null,
        code: versionDetail?.assessment?.code || '',
        name: versionDetail?.assessment?.name || '',
        assessmentType: versionDetail?.assessment?.assessmentType || '',
      },
      version: {
        id: normalizeId(versionDetail),
        documentId: versionDetail?.documentId || null,
        code: versionDetail?.code || '',
        version: Number(versionDetail?.version || 0),
        title: versionDetail?.title || '',
        durationMinutes: versionDetail?.durationMinutes ?? null,
        instructions: versionDetail?.instructions || '',
        gradeFrom: versionDetail?.gradeFrom ?? null,
        gradeTo: versionDetail?.gradeTo ?? null,
        candidateLevelFrom: versionDetail?.candidateLevelFrom || null,
        candidateLevelTo: versionDetail?.candidateLevelTo || null,
        resultMode: versionDetail?.resultMode || '',
        requiresSpeaking: versionDetail?.requiresSpeaking !== false,
        requiresTeacherConfirmation: versionDetail?.requiresTeacherConfirmation !== false,
        ceilingLevel: versionDetail?.ceilingLevel || null,
        totalSections: sections.length,
        totalQuestions,
      },
      sections: sections.map((section) => ({
        id: section.id,
        documentId: section.documentId,
        code: section.code,
        title: section.title,
        description: section.description,
        instruction: section.instruction,
        instructionContentType: section.instructionContentType,
        instructionImageAssetCode: section.instructionImageAssetCode,
        instructionImageAsset: section.instructionImageAsset,
        stimulusCode: section.stimulusCode,
        stimulus: section.stimulus,
        questionDisplayMode: section.questionDisplayMode,
        questionLayoutContent: section.questionLayoutContent,
        questionLayoutContentType: section.questionLayoutContentType,
        audioPlayLimit: section.audioPlayLimit,
        listenLimit: section.listenLimit,
        order: section.order,
        skill: section.skill,
        questions: section.questions,
      })),
    },
    scoringSnapshot: {
      snapshotVersion: 1,
      assessment: {
        id: normalizeId(versionDetail?.assessment),
        documentId: versionDetail?.assessment?.documentId || null,
        code: versionDetail?.assessment?.code || '',
      },
      version: {
        id: normalizeId(versionDetail),
        documentId: versionDetail?.documentId || null,
        code: versionDetail?.code || '',
        version: Number(versionDetail?.version || 0),
      },
      sections: sections.map((section) => ({
        id: section.id,
        documentId: section.documentId,
        code: section.code,
        title: section.title,
        order: section.order,
        questions: section.scoringQuestions,
      })),
    },
  };
}

function flattenAttemptQuestions(definitionSnapshot: any) {
  const sections = Array.isArray(definitionSnapshot?.sections) ? definitionSnapshot.sections : [];
  const rows: any[] = [];
  for (const section of sections) {
    const questions = Array.isArray(section?.questions) ? section.questions : [];
    for (const item of questions) {
      rows.push({
        ...item,
        sectionCode: section?.code || '',
        sectionTitle: section?.title || '',
        sectionOrder: Number(section?.order || 0),
        sectionStimulus: section?.stimulus || null,
        sectionStimulusCode: section?.stimulusCode || null,
        questionDisplayMode: normalizeQuestionDisplayMode(section?.questionDisplayMode),
        sectionAudioPlayLimit: section?.listenLimit ?? section?.audioPlayLimit ?? null,
      });
    }
  }
  return sortByOrder(rows);
}

function findAttemptQuestionSnapshot(definitionSnapshot: any, assessmentQuestionRef: unknown) {
  const target = String(assessmentQuestionRef || '').trim();
  if (!target) return null;
  return flattenAttemptQuestions(definitionSnapshot).find((item) => String(item?.assessmentQuestionId || '') === target || String(item?.assessmentQuestionDocumentId || '') === target) || null;
}

async function resolveSnapshotAudioFileAsset(snapshotAudioAsset: any, tenantId: number | string) {
  const refs = [snapshotAudioAsset?.id, snapshotAudioAsset?.documentId].filter(Boolean);
  for (const ref of refs) {
    const entity = await findEntityByRef(FILE_ASSET_UID, ref, { tenant: { select: ['id', 'documentId'] } });
    if (!entity?.id) continue;
    const entityTenantRef = extractRelationRef(entity?.tenant);
    if (String(entityTenantRef || '') !== String(tenantId)) continue;
    return entity;
  }
  return null;
}

async function buildAttemptQuestionAudioResponse(attemptRef: unknown, assessmentQuestionRef: unknown, tenantId: number | string, context: RuntimeContext = {}) {
  const attempt = await markAttemptExpiredIfNeeded(await findAttemptOrThrow(attemptRef, tenantId, { includeAnswers: false }), tenantId);
  await ensureAttemptAccess(attempt, context);
  const snapshotQuestion = findAttemptQuestionSnapshot(attempt?.definitionSnapshot, assessmentQuestionRef);
  if (!snapshotQuestion) throw new AssessmentRuntimeError(404, 'assessmentQuestion does not belong to this attempt');
  const snapshotAudioAsset = resolveEffectiveSnapshotStimulus(snapshotQuestion)?.audioAsset;
  if (!snapshotAudioAsset) throw new AssessmentRuntimeError(404, 'Audio stimulus not found');

  const fileAsset = await resolveSnapshotAudioFileAsset(snapshotAudioAsset, tenantId);
  if (!fileAsset?.id && !snapshotAudioAsset?.relativePath) throw new AssessmentRuntimeError(404, 'Audio stimulus file path not found');

  return {
    attempt,
    assessmentQuestionId: snapshotQuestion?.assessmentQuestionId || snapshotQuestion?.assessmentQuestionDocumentId || null,
    fileAsset,
    snapshotAudioAsset,
    fileName: toText(fileAsset?.fileName || fileAsset?.originalName || snapshotAudioAsset?.fileName || snapshotAudioAsset?.originalName || 'audio.mp3') || 'audio.mp3',
    contentType: toText(fileAsset?.mimeType || snapshotAudioAsset?.mimeType) || 'application/octet-stream',
  };
}

export async function getAssessmentQuestionAudioDelivery(attemptRef: unknown, assessmentQuestionRef: unknown, tenantId: number | string, context: RuntimeContext = {}) {
  const resolved = await buildAttemptQuestionAudioResponse(attemptRef, assessmentQuestionRef, tenantId, context);
  const attemptRefValue = String(normalizeId(resolved.attempt) || '');
  const assessmentQuestionRefValue = String(resolved.assessmentQuestionId || '');
  const fileAssetRef = String(normalizeId(resolved.fileAsset) || normalizeId(resolved.snapshotAudioAsset) || '');
  const token = signAssessmentRuntimeAudioToken({
    purpose: 'assessment_runtime_audio',
    tenantId,
    tenantCode: toText(resolved.attempt?.tenant?.code) || null,
    attemptId: attemptRefValue,
    assessmentQuestionId: assessmentQuestionRefValue,
    fileAssetRef,
    exp: Date.now() + 10 * 60 * 1000,
  });
  return {
    url: `/api/assessment-runtime/assessment-attempts/${encodeURIComponent(attemptRefValue)}/questions/${encodeURIComponent(assessmentQuestionRefValue)}/audio?mediaToken=${encodeURIComponent(token)}`,
    fileName: resolved.fileName,
    mimeType: resolved.contentType,
  };
}

export async function streamAssessmentQuestionAudio(attemptRef: unknown, assessmentQuestionRef: unknown, tenantId: number | string, context: RuntimeContext = {}) {
  return buildAttemptQuestionAudioResponse(attemptRef, assessmentQuestionRef, tenantId, context);
}

function getAllowedOptionRefs(questionSnapshot: any) {
  return new Set((Array.isArray(questionSnapshot?.question?.options) ? questionSnapshot.question.options : []).flatMap((option: any) => [String(option?.id || ''), String(option?.documentId || '')].filter(Boolean)));
}

function validateAnswerData(questionSnapshot: any, rawAnswerData: unknown) {
  const questionType = toText(questionSnapshot?.question?.type);
  const answerData = parseJsonObject(rawAnswerData, 'answerData');
  if (answerData === undefined) throw new AssessmentRuntimeError(400, 'answerData is required');
  if (answerData === null || typeof answerData !== 'object' || Array.isArray(answerData)) {
    throw new AssessmentRuntimeError(400, 'answerData must be an object');
  }

  const optionRefs = getAllowedOptionRefs(questionSnapshot);
  const selectedOptionIds = Array.isArray((answerData as any).selectedOptionIds) ? (answerData as any).selectedOptionIds.map((item: any) => String(item || '').trim()).filter(Boolean) : null;

  if (questionType === 'single_choice' || questionType === 'true_false') {
    if (selectedOptionIds === null) throw new AssessmentRuntimeError(400, 'selectedOptionIds is required');
    if (selectedOptionIds.length > 1) throw new AssessmentRuntimeError(400, 'single choice answer can only contain one selected option');
    if (selectedOptionIds.some((item: string) => !optionRefs.has(item))) throw new AssessmentRuntimeError(400, 'selected option does not belong to this question');
  }

  if (questionType === 'multiple_choice') {
    if (selectedOptionIds === null) throw new AssessmentRuntimeError(400, 'selectedOptionIds is required');
    if (selectedOptionIds.some((item: string) => !optionRefs.has(item))) throw new AssessmentRuntimeError(400, 'selected option does not belong to this question');
  }

  if (questionType === 'short_answer' || questionType === 'essay') {
    if ((answerData as any).text !== undefined && typeof (answerData as any).text !== 'string') {
      throw new AssessmentRuntimeError(400, 'text must be a string');
    }
  }

  if (questionType === 'fill_blank') {
    const blanks = (answerData as any).blanks;
    if (blanks !== undefined && !Array.isArray(blanks) && typeof blanks !== 'object') {
      throw new AssessmentRuntimeError(400, 'blanks must be an array or object');
    }
  }

  if (questionType === 'ordering') {
    const orderedItemIds = (answerData as any).orderedItemIds;
    if (orderedItemIds !== undefined && !Array.isArray(orderedItemIds)) {
      throw new AssessmentRuntimeError(400, 'orderedItemIds must be an array');
    }
  }

  if (questionType === 'matching') {
    const pairs = (answerData as any).pairs;
    if (pairs !== undefined && !Array.isArray(pairs)) {
      throw new AssessmentRuntimeError(400, 'pairs must be an array');
    }
  }

  return answerData;
}

function isAnswerComplete(questionType: unknown, answerData: any) {
  const type = toText(questionType);
  if (!answerData || typeof answerData !== 'object') return false;
  if (type === 'single_choice' || type === 'true_false') return Array.isArray(answerData.selectedOptionIds) && answerData.selectedOptionIds.length === 1;
  if (type === 'multiple_choice') return Array.isArray(answerData.selectedOptionIds) && answerData.selectedOptionIds.length > 0;
  if (type === 'short_answer' || type === 'essay') return toText(answerData.text).length > 0;
  if (type === 'fill_blank') {
    if (Array.isArray(answerData.blanks)) return answerData.blanks.some((item: any) => toText(item?.value).length > 0);
    if (answerData.blanks && typeof answerData.blanks === 'object') return Object.values(answerData.blanks).some((value) => toText(value).length > 0);
    return false;
  }
  if (type === 'ordering') return Array.isArray(answerData.orderedItemIds) && answerData.orderedItemIds.length > 0;
  if (type === 'matching') return Array.isArray(answerData.pairs) && answerData.pairs.length > 0;
  return false;
}

function buildAnswerQuestionSnapshot(questionSnapshot: any) {
  return {
    assessmentQuestionId: questionSnapshot?.assessmentQuestionId || null,
    questionId: questionSnapshot?.question?.id || null,
    questionCode: questionSnapshot?.question?.code || '',
    questionType: questionSnapshot?.question?.type || '',
    required: questionSnapshot?.required !== false,
  };
}

function mapAttempt(row: any) {
  return {
    id: normalizeId(row),
    documentId: row?.documentId || null,
    code: row?.code || '',
    status: row?.status || 'created',
    startedAt: row?.startedAt || null,
    submittedAt: row?.submittedAt || null,
    expiresAt: row?.expiresAt || null,
    sourceType: row?.sourceType || null,
    sourceRef: row?.sourceRef || null,
    candidateNameSnapshot: row?.candidateNameSnapshot || null,
    candidateEmailSnapshot: row?.candidateEmailSnapshot || null,
    candidatePhoneSnapshot: row?.candidatePhoneSnapshot || null,
    progressState: row?.progressState || null,
    assessment: normalizeSimpleRelation(row?.assessment),
    assessmentVersion: normalizeSimpleRelation(row?.assessmentVersion),
    user: normalizeUserRelation(row?.user),
    learner: row?.learner ? { id: normalizeId(row.learner), documentId: row.learner?.documentId || null, code: row.learner?.code || '', fullName: row.learner?.fullName || '' } : null,
    lead: row?.lead ? { id: normalizeId(row.lead), documentId: row.lead?.documentId || null, fullName: row.lead?.fullName || '', phone: row.lead?.phone || '' } : null,
  };
}

function mapAnswer(row: any) {
  return {
    id: normalizeId(row),
    documentId: row?.documentId || null,
    assessmentQuestionId: normalizeId(row?.assessmentQuestion),
    questionId: normalizeId(row?.question),
    answerData: row?.answerData ?? null,
    questionSnapshot: row?.questionSnapshot ?? null,
    firstAnsweredAt: row?.firstAnsweredAt || null,
    lastAnsweredAt: row?.lastAnsweredAt || null,
    timeSpentSeconds: Number(row?.timeSpentSeconds || 0),
    audioPlayCount: Number(row?.audioPlayCount || 0),
    listenRequirementSatisfied: row?.listenRequirementSatisfied === true,
    listenRequirementSatisfiedAt: row?.listenRequirementSatisfiedAt || null,
  };
}

async function ensureEntityInTenant(uid: string, ref: unknown, tenantId: number | string, label: string) {
  if (ref === null || ref === undefined || ref === '') return null;
  const entity = await findEntityByRef(uid, ref, { tenant: { select: ['id', 'documentId'] } });
  if (!entity) throw new AssessmentRuntimeError(400, `${label} is invalid`);
  const entityTenantRef = extractRelationRef(entity?.tenant);
  if (String(entityTenantRef || '') !== String(tenantId)) {
    throw new AssessmentRuntimeError(403, `${label} does not belong to current tenant`);
  }
  return entity;
}

async function ensureEntityExists(uid: string, ref: unknown, label: string) {
  if (ref === null || ref === undefined || ref === '') return null;
  const entity = await findEntityByRef(uid, ref);
  if (!entity) throw new AssessmentRuntimeError(400, `${label} is invalid`);
  return entity;
}

async function ensureAttemptCodeUnique(code: string, tenantId: number | string, existingId?: number | null) {
  const duplicate = await strapi.db.query(ASSESSMENT_ATTEMPT_UID).findOne({
    where: mergeTenantWhere({ code: { $eq: code } }, tenantId),
    select: ['id'],
  });
  if (duplicate?.id && Number(duplicate.id) !== Number(existingId || 0)) {
    throw new AssessmentRuntimeError(409, 'Assessment Attempt code already exists in this tenant');
  }
}

async function generateAttemptCode(tenantId: number | string) {
  for (let attempt = 0; attempt < 25; attempt += 1) {
    const code = `ATT-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
    const duplicate = await strapi.db.query(ASSESSMENT_ATTEMPT_UID).findOne({ where: mergeTenantWhere({ code: { $eq: code } }, tenantId), select: ['id'] });
    if (!duplicate?.id) return code;
  }
  throw new AssessmentRuntimeError(500, 'Could not generate unique assessment attempt code');
}

function buildAttemptPopulate(options: { includeAnswers?: boolean } = {}) {
  const populate: any = {
    tenant: { select: ['id', 'documentId', 'code'] },
    assessment: { select: ['id', 'documentId', 'code', 'name', 'assessmentType', 'status'] },
    assessmentVersion: { select: ['id', 'documentId', 'code', 'title', 'versionStatus', 'version', 'durationMinutes', 'resultMode', 'requiresSpeaking', 'requiresTeacherConfirmation'] },
    user: { select: ['id', 'username', 'email', 'fullName'] },
    learner: {
      select: ['id', 'documentId', 'code', 'fullName', 'parentPhone'],
      populate: { user: { select: ['id'] } },
    },
    lead: { select: ['id', 'documentId', 'fullName', 'phone'] },
  }
  if (options.includeAnswers) {
    populate.answers = {
      populate: {
        assessmentQuestion: { select: ['id', 'documentId', 'order'] },
        question: { select: ['id', 'documentId', 'code', 'type'] },
      },
      orderBy: [{ updatedAt: 'asc' }, { id: 'asc' }],
    }
  };
  return populate;
}

async function findAttemptOrThrow(id: unknown, tenantId: number | string, options: { includeAnswers?: boolean } = {}) {
  const where = whereByParam(id);
  if (!where) throw new AssessmentRuntimeError(400, 'Assessment Attempt id is invalid');
  const row = await strapi.db.query(ASSESSMENT_ATTEMPT_UID).findOne({
    where: mergeTenantWhere(where, tenantId),
    populate: buildAttemptPopulate(options),
  });
  if (!row) throw new AssessmentRuntimeError(404, 'Assessment Attempt not found');
  return row;
}

async function listAttemptAnswers(attemptId: unknown, tenantId: number | string) {
  return strapi.db.query(ASSESSMENT_ANSWER_UID).findMany({
    where: mergeTenantWhere({ attempt: whereByParam(attemptId) }, tenantId),
    populate: {
      assessmentQuestion: { select: ['id', 'documentId', 'order'] },
      question: { select: ['id', 'documentId', 'code', 'type'] },
    },
    orderBy: [{ updatedAt: 'asc' }, { id: 'asc' }],
  });
}

async function findAttemptAnswer(attemptId: unknown, assessmentQuestionId: unknown, tenantId: number | string) {
  const answers = await listAttemptAnswers(attemptId, tenantId);
  const target = String(assessmentQuestionId || '');
  return (answers || []).find((item: any) => String(normalizeId(item?.assessmentQuestion) || '') === target || String(item?.assessmentQuestion?.documentId || '') === target) || null;
}

async function ensureAttemptScored(attemptId: unknown, tenantId: number | string) {
  const existingResult = await findCurrentResultByAttemptOrNull(attemptId, tenantId)
  if (existingResult?.id) return existingResult
  try {
    await scoreAssessmentAttempt(attemptId, tenantId, { scoringVersion: 1 })
  } catch (error) {
    strapi.log.error('[assessment-runtime] timeout/manual submit scoring failed', error)
  }
  return findCurrentResultByAttemptOrNull(attemptId, tenantId)
}

async function finalizeAttemptSubmission(attempt: any, tenantId: number | string, options: { enforceRequired?: boolean; submittedAt?: string | null } = {}) {
  const status = toText(attempt?.status)
  if (status === 'cancelled') throw new AssessmentRuntimeError(409, 'ATTEMPT_CANCELLED')

  const answers: Array<ReturnType<typeof mapAnswer>> = (attempt?.answers || []).map(mapAnswer)
  const answerMap = new Map<string, ReturnType<typeof mapAnswer>>(answers.map((answer) => [String(answer?.assessmentQuestionId || ''), answer]))
  const missing = flattenAttemptQuestions(attempt?.definitionSnapshot).filter((item) => {
    if (item?.required === false) return false
    const answer: ReturnType<typeof mapAnswer> | undefined = answerMap.get(String(item?.assessmentQuestionId || ''))
    return !answer || !isAnswerComplete(answer?.questionSnapshot?.questionType || item?.question?.type, answer?.answerData)
  }).map((item) => ({
    assessmentQuestionId: item?.assessmentQuestionId || null,
    questionCode: item?.question?.code || item?.questionCode || '',
    sectionCode: item?.sectionCode || '',
    order: Number(item?.order || 0),
  }))

  if (options.enforceRequired !== false && missing.length > 0) {
    throw new AssessmentRuntimeError(400, `Missing required answers: ${missing.map((item) => item.questionCode).join(', ')}`, { missingRequired: missing })
  }

  if (status !== 'submitted') {
    await strapi.db.query(ASSESSMENT_ATTEMPT_UID).update({
      where: { id: attempt.id },
      data: {
        status: 'submitted',
        submittedAt: options.submittedAt || new Date().toISOString(),
      },
    })
  }

  const refreshed = await findAttemptOrThrow(attempt.id, tenantId, { includeAnswers: true })
  await ensureAttemptScored(refreshed.id, tenantId)
  return {
    ...buildRuntimeResponse(refreshed, refreshed?.answers || []),
    submission: {
      answeredCount: resolveAttemptProgress(refreshed?.definitionSnapshot, (refreshed?.answers || []).map(mapAnswer), refreshed?.progressState || null).answeredCount,
      totalQuestions: Number(refreshed?.definitionSnapshot?.version?.totalQuestions || 0),
      missingRequired: options.enforceRequired === false ? [] : missing,
      autoSubmitted: options.enforceRequired === false,
    },
  }
}

async function autoSubmitTimedOutAttempt(attempt: any, tenantId: number | string) {
  return finalizeExpiredAssessmentAttempt(attempt, tenantId, {
    allowLegacyExpired: true,
    persistDerivedExpiresAt: true,
  })
}

export async function finalizeExpiredAssessmentAttempt(attemptRef: unknown, tenantId: number | string, options: FinalizeExpiredAttemptOptions = {}) {
  let attempt = attemptRef && typeof attemptRef === 'object' && 'id' in (attemptRef as Record<string, any>)
    ? attemptRef
    : await findAttemptOrThrow(attemptRef, tenantId, { includeAnswers: true });

  const status = toText(attempt?.status) as AttemptStatus;
  if (status === 'submitted' || status === 'cancelled') return attempt;

  const isLegacyExpired = status === 'expired' && !attempt?.submittedAt;
  const isActiveAttempt = status === 'created' || status === 'in_progress';
  if (!isActiveAttempt && !(options.allowLegacyExpired === true && isLegacyExpired)) {
    if (options.rejectIfNotOverdue) throw new AssessmentRuntimeError(409, 'Assessment Attempt is not eligible for timeout finalization');
    return attempt;
  }

  const deadline = resolveAttemptDeadlineInfo(attempt);
  if (!deadline.expiresAt) {
    if (options.rejectIfDeadlineMissing) throw new AssessmentRuntimeError(409, 'Assessment Attempt deadline is unavailable');
    return attempt;
  }
  if (deadline.expiresAt.getTime() > Date.now()) {
    if (options.rejectIfNotOverdue) throw new AssessmentRuntimeError(409, 'Assessment Attempt is not overdue');
    return attempt;
  }

  if (!attempt?.expiresAt && deadline.source === 'derived' && options.persistDerivedExpiresAt === true) {
    await strapi.db.query(ASSESSMENT_ATTEMPT_UID).update({
      where: { id: Number(attempt.id) },
      data: { expiresAt: deadline.expiresAt.toISOString() },
    });
    attempt = await findAttemptOrThrow(attempt.id, tenantId, { includeAnswers: true });
  }

  await finalizeAttemptSubmission(attempt, tenantId, {
    enforceRequired: false,
    submittedAt: options.submittedAt || deadline.expiresAt.toISOString(),
  });
  return findAttemptOrThrow(attempt.id, tenantId, { includeAnswers: true });
}

async function markAttemptExpiredIfNeeded(attempt: any, tenantId: number | string) {
  const status = toText(attempt?.status) as AttemptStatus;
  if (status === 'submitted' || status === 'cancelled') return attempt;
  return autoSubmitTimedOutAttempt(attempt, tenantId);
}

function ensureWritableAttempt(attempt: any) {
  const status = toText(attempt?.status);
  if (status === 'submitted') throw new AssessmentRuntimeError(409, 'Assessment Attempt is already submitted');
  if (status === 'expired') throw new AssessmentRuntimeError(409, 'Assessment Attempt is expired');
  if (status === 'cancelled') throw new AssessmentRuntimeError(409, 'ATTEMPT_CANCELLED');
  if (status !== 'created' && status !== 'in_progress') throw new AssessmentRuntimeError(409, 'Assessment Attempt is not writable');
}

function resolveAttemptProgress(definitionSnapshot: any, answers: any[], progressState: any) {
  const questions = flattenAttemptQuestions(definitionSnapshot);
  const answerMap = new Map((answers || []).map((answer) => [String(answer?.assessmentQuestionId || ''), answer]));
  const answeredCount = questions.reduce((count, item) => {
    const answer = answerMap.get(String(item?.assessmentQuestionId || ''));
    return count + (answer && isAnswerComplete(answer?.questionSnapshot?.questionType || item?.question?.type, answer?.answerData) ? 1 : 0);
  }, 0);
  return {
    answeredCount,
    totalQuestions: questions.length,
    currentAssessmentQuestionId: progressState?.currentAssessmentQuestionId || null,
    currentSectionCode: progressState?.currentSectionCode || null,
  };
}

function buildRuntimeResponse(attempt: any, answers: any[] = []) {
  const mappedAnswers = (answers || []).map(mapAnswer);
  const buildRuntimeStimulusDescriptor = (stimulus: any, assessmentQuestionRef: unknown) => {
    if (!stimulus) return null;
    return {
      ...stimulus,
      imageAsset: buildRuntimeFileAssetDescriptor(attempt, stimulus?.imageAsset),
      audioAsset: buildRuntimeAudioAssetDescriptor(attempt, assessmentQuestionRef, stimulus?.audioAsset),
    };
  };
  const candidateDefinition = attempt?.definitionSnapshot && Array.isArray(attempt?.definitionSnapshot?.sections)
    ? {
        ...attempt.definitionSnapshot,
        sections: attempt.definitionSnapshot.sections.map((section: any) => ({
          ...section,
          description: section?.description || '',
          instructionContentType: normalizeHtmlContentType(section?.instructionContentType),
          instructionImage: buildRuntimeFileAssetDescriptor(attempt, section?.instructionImageAsset),
          stimulus: buildRuntimeStimulusDescriptor(section?.stimulus, section?.questions?.[0]?.assessmentQuestionId || section?.questions?.[0]?.assessmentQuestionDocumentId || ''),
          questionDisplayMode: normalizeQuestionDisplayMode(section?.questionDisplayMode),
          questionLayoutContent: section?.questionLayoutContent || '',
          questionLayoutContentType: normalizeQuestionLayoutContentType(section?.questionLayoutContentType),
          audioPlayLimit: section?.listenLimit ?? section?.audioPlayLimit ?? null,
          listenLimit: section?.listenLimit ?? section?.audioPlayLimit ?? null,
          questions: Array.isArray(section?.questions)
            ? section.questions.map((item: any) => {
                const assessmentQuestionRefValue = String(item?.assessmentQuestionId || item?.assessmentQuestionDocumentId || '');
                const question = item?.question || {};
                return {
                  ...item,
                  question: {
                    ...question,
                    questionImageAsset: buildRuntimeFileAssetDescriptor(attempt, question?.questionImageAsset),
                    options: Array.isArray(question?.options)
                      ? question.options.map((option: any) => ({
                          ...option,
                          imageAsset: buildRuntimeFileAssetDescriptor(attempt, option?.imageAsset),
                        }))
                      : [],
                    stimulus: buildRuntimeStimulusDescriptor(question?.stimulus, assessmentQuestionRefValue),
                  },
                };
              })
            : [],
        })),
      }
    : attempt?.definitionSnapshot || null;
  return {
    attempt: mapAttempt(attempt),
    candidateDefinition,
    answers: mappedAnswers,
    progress: resolveAttemptProgress(candidateDefinition, mappedAnswers, attempt?.progressState || null),
    serverTime: new Date().toISOString(),
    expiresAt: attempt?.expiresAt || null,
  };
}

function mapCandidateResult(row: any, options: { revealScores?: boolean } = {}) {
  if (!row) return null
  const revealScores = options.revealScores === true
  const objectiveScore = revealScores ? row?.objectiveScore ?? null : null
  const objectiveMaxScore = revealScores ? row?.objectiveMaxScore ?? null : null
  const objectivePercentage = objectiveScore === null || objectiveScore === undefined || objectiveMaxScore === null || objectiveMaxScore === undefined || Number(objectiveMaxScore) <= 0
    ? null
    : Number(((Number(objectiveScore) / Number(objectiveMaxScore)) * 100).toFixed(2))
  return {
    id: normalizeId(row),
    documentId: row?.documentId || null,
    status: row?.status || 'pending',
    rawScore: revealScores ? row?.rawScore ?? null : null,
    maxScore: revealScores ? row?.maxScore ?? null : null,
    percentage: revealScores ? row?.percentage ?? null : null,
    objectiveScore,
    objectiveMaxScore,
    objectivePercentage,
    provisionalLevel: revealScores ? (row?.provisionalLevel || null) : null,
    placementLabel: revealScores ? (row?.placementLabel || null) : null,
    pendingManualCount: Number(row?.pendingManualCount || 0),
    pendingManualMaxScore: row?.pendingManualMaxScore ?? null,
    configuredTotalMaxScore: row?.configuredTotalMaxScore ?? null,
    sectionScores: revealScores && Array.isArray(row?.sectionScores) ? row.sectionScores : [],
  }
}

function mapCandidateSpeakingReview(row: any, options: { revealScores?: boolean } = {}) {
  if (!row) return null
  const revealScores = options.revealScores === true
  return {
    status: row?.status || 'pending',
    reviewMode: row?.reviewMode || 'live',
    overallScore: revealScores ? row?.overallScore ?? null : null,
    overallMaxScore: revealScores ? row?.maxScore ?? null : null,
    percentage: revealScores ? row?.percentage ?? null : null,
    suggestedLevel: revealScores ? (row?.suggestedLevel || null) : null,
    reviewedAt: row?.reviewedAt || null,
  }
}

function mapCandidateConfirmation(row: any, options: { revealScores?: boolean } = {}) {
  if (!row) return null
  const revealScores = options.revealScores === true
  return {
    status: row?.status || 'draft',
    confirmedLevel: revealScores ? (row?.confirmedLevel || null) : null,
    confirmedLabel: revealScores ? (row?.confirmedLabel || null) : null,
    confirmedAt: row?.confirmedAt || null,
  }
}

async function resolveAssignmentAttemptVisibility(attempt: any, tenantId: number | string) {
  if (toText(attempt?.sourceType) !== 'learner') return null
  const parsed = parseAssignmentTaskSourceRef(attempt?.sourceRef)
  if (!parsed?.taskId) return null
  const task = await strapi.db.query(ASSIGNMENT_TASK_UID).findOne({
    where: mergeTenantWhere({ id: { $eq: parsed.taskId } }, tenantId),
    select: ['id', 'taskType', 'assessmentSettings'],
  })
  if (!task?.id || toText(task?.taskType) !== 'assessment') return null
  const settings = task?.assessmentSettings && typeof task.assessmentSettings === 'object' && !Array.isArray(task.assessmentSettings)
    ? task.assessmentSettings
    : {}
  return {
    taskId: Number(task.id),
    showScoreAfterSubmit: settings?.showScoreAfterSubmit !== false,
  }
}

function shouldRevealCandidateScores(result: any, confirmation: any, visibility: { showScoreAfterSubmit: boolean } | null) {
  if (visibility?.showScoreAfterSubmit === false) return false
  if (!result?.id) return false
  if (Number(result?.pendingManualCount || 0) > 0) return false
  return rowHasCandidateVisibleScore(result, confirmation)
}

function rowHasCandidateVisibleScore(result: any, confirmation: any) {
  return result?.rawScore !== null
    && result?.rawScore !== undefined
    || result?.percentage !== null
    && result?.percentage !== undefined
    || Boolean(result?.provisionalLevel)
    || Boolean(confirmation?.confirmedLevel)
    || (Array.isArray(result?.sectionScores) && result.sectionScores.length > 0)
}

function deriveCandidateWorkflowState(attempt: any, result: any, speakingReview: any, confirmation: any) {
  const attemptStatus = toText(attempt?.status)
  if (attemptStatus === 'cancelled') return 'cancelled'
  if (attemptStatus === 'expired') return 'expired'
  if (attemptStatus !== 'submitted') return 'submitted'
  if (!result?.id) return 'scoring'
  if (Number(result?.pendingManualCount || 0) > 0) return 'manual_scoring_pending'
  if (toText(confirmation?.status) === 'confirmed' && confirmation?.confirmedLevel) return 'confirmed'
  if (attempt?.assessmentVersion?.requiresSpeaking !== false) {
    const speakingStatus = toText(speakingReview?.status)
    if (!speakingReview?.id || speakingStatus === 'pending') return 'speaking_pending'
    if (speakingStatus === 'in_review') return 'speaking_in_review'
  }
  if (attempt?.assessmentVersion?.requiresTeacherConfirmation !== false) return 'confirmation_pending'
  return 'provisional_ready'
}

function buildCandidateStatusBanner(workflowState: string, version: any) {
  if (workflowState === 'scoring') {
    return {
      title: 'Đang xử lý kết quả',
      message: 'Kết quả của bạn đang được hệ thống xử lý.',
    }
  }
  if (workflowState === 'manual_scoring_pending') {
    return {
      title: 'Đang hoàn tất chấm bài',
      message: 'Bài làm của bạn đã được ghi nhận. Giáo viên đang hoàn tất việc chấm bài.',
    }
  }
  if (workflowState === 'speaking_pending') {
    return {
      title: 'Chờ Speaking',
      message: 'Bạn đã hoàn thành phần online. Vui lòng thực hiện phần Speaking theo hướng dẫn.',
    }
  }
  if (workflowState === 'speaking_in_review') {
    return {
      title: 'Speaking đang được đánh giá',
      message: 'Phần Speaking đang được giáo viên đánh giá.',
    }
  }
  if (workflowState === 'confirmation_pending') {
    return {
      title: 'Chờ xác nhận',
      message: version?.requiresSpeaking !== false
        ? 'Phần Speaking đã hoàn thành. Kết quả đang chờ giáo viên xác nhận.'
        : 'Kết quả đang chờ giáo viên xác nhận mức xếp cuối cùng.',
    }
  }
  if (workflowState === 'confirmed') {
    return {
      title: 'Đã xác nhận',
      message: 'Kết quả đánh giá của bạn đã được xác nhận.',
    }
  }
  if (workflowState === 'expired') {
    return {
      title: 'Lượt làm bài đã hết hạn',
      message: 'Thời gian làm bài đã kết thúc.',
    }
  }
  if (workflowState === 'cancelled') {
    return {
      title: 'Lượt làm bài đã bị hủy',
      message: 'Lượt làm bài này không còn hiệu lực.',
    }
  }
  return {
    title: 'Kết quả sơ bộ',
    message: version?.requiresSpeaking !== false
      ? 'Đây là kết quả sơ bộ từ bài đánh giá online. Bạn cần hoàn thành phần Speaking để giáo viên xác nhận mức xếp cuối cùng.'
      : 'Đây là kết quả sơ bộ từ bài đánh giá online.',
  }
}

async function findCurrentResultByAttemptOrNull(attemptRef: unknown, tenantId: number | string) {
  return strapi.db.query(ASSESSMENT_RESULT_UID).findOne({
    where: mergeTenantWhere({ attempt: whereByParam(attemptRef), isCurrent: true }, tenantId),
    populate: {
      assessment: { select: ['id', 'documentId', 'code', 'name'] },
      assessmentVersion: { select: ['id', 'documentId', 'code', 'title', 'version', 'resultMode', 'requiresSpeaking', 'requiresTeacherConfirmation'] },
    },
    orderBy: [{ scoredAt: 'desc' }, { id: 'desc' }],
  })
}

async function findCurrentSpeakingReviewByResultOrNull(resultRef: unknown, tenantId: number | string) {
  return strapi.db.query(ASSESSMENT_SPEAKING_REVIEW_UID).findOne({
    where: mergeTenantWhere({ assessmentResult: whereByParam(resultRef) }, tenantId),
    select: ['id', 'documentId', 'status', 'reviewMode', 'overallScore', 'maxScore', 'percentage', 'suggestedLevel', 'reviewedAt'],
    orderBy: [{ reviewedAt: 'desc' }, { id: 'desc' }],
  })
}

async function findCurrentPlacementConfirmationByResultOrNull(resultRef: unknown, tenantId: number | string) {
  return strapi.db.query(ASSESSMENT_PLACEMENT_CONFIRMATION_UID).findOne({
    where: mergeTenantWhere({ assessmentResult: whereByParam(resultRef), isCurrent: true }, tenantId),
    select: ['id', 'documentId', 'status', 'confirmedLevel', 'confirmedLabel', 'confirmedAt'],
    orderBy: [{ confirmedAt: 'desc' }, { id: 'desc' }],
  })
}

async function resolveActorPayload(payload: any, tenantId: number | string, authUserId?: number | string | null) {
  const learner = await ensureEntityInTenant(LEARNER_UID, payload.learner, tenantId, 'learner');
  const lead = await ensureEntityExists(LEAD_UID, payload.lead, 'lead');
  const explicitUser = await ensureEntityExists(USER_UID, payload.user, 'user');
  const authUser = authUserId ? await ensureEntityExists(USER_UID, authUserId, 'authUser') : null;
  const user = explicitUser || authUser || null;
  const sourceTypeText = toText(payload.sourceType).toLowerCase();
  const sourceType = SOURCE_TYPES.includes(sourceTypeText as SourceType) ? (sourceTypeText as SourceType) : null;
  return {
    user,
    learner,
    lead,
    sourceType,
    sourceRef: toNullableText(payload.sourceRef),
    candidateNameSnapshot: sourceType === 'admin_test'
      ? toNullableText(payload.candidateNameSnapshot) || `Test by ${authUser?.fullName || authUser?.username || authUser?.email || 'Admin'}`
      : toNullableText(payload.candidateNameSnapshot) || learner?.fullName || lead?.fullName || authUser?.fullName || null,
    candidateEmailSnapshot: toNullableText(payload.candidateEmailSnapshot) || user?.email || null,
    candidatePhoneSnapshot: toNullableText(payload.candidatePhoneSnapshot) || learner?.parentPhone || lead?.phone || null,
  };
}

function buildAttemptReuseWhere(versionRef: unknown, actor: any, tenantId: number | string) {
  const whereClauses: any[] = [
    { assessmentVersion: whereByParam(versionRef) },
    { status: { $in: ['created', 'in_progress'] } },
  ];
  if (actor?.user?.id) whereClauses.push({ user: { id: { $eq: Number(actor.user.id) } } });
  if (actor?.learner?.id) whereClauses.push({ learner: { id: { $eq: Number(actor.learner.id) } } });
  if (actor?.lead?.id) whereClauses.push({ lead: { id: { $eq: Number(actor.lead.id) } } });
  if (actor?.sourceRef) whereClauses.push({ sourceRef: { $eq: actor.sourceRef } });
  if (whereClauses.length <= 2) return null;
  return mergeTenantWhere({ $and: whereClauses }, tenantId);
}

async function resolveRunnableVersion(versionRef: unknown, tenantId: number | string, allowDraft = false) {
  const version = await getAssessmentVersionDetail(versionRef, tenantId);
  const versionStatus = toText(version?.versionStatus);
  if (versionStatus !== 'published' && !allowDraft) {
    throw new AssessmentRuntimeError(409, 'Only published assessment versions can be started');
  }
  if (!version?.assessment?.id) throw new AssessmentRuntimeError(400, 'Assessment Version is missing assessment');
  return version;
}

async function resolveAttemptDefinitionContext(versionRef: unknown, tenantId: number | string, allowDraft = false) {
  const versionDetail = await resolveRunnableVersion(versionRef, tenantId, allowDraft);
  const assessmentVersionEntity = await findEntityByRef(ASSESSMENT_VERSION_UID, versionRef, {
    assessment: { select: ['id', 'documentId'] },
    tenant: { select: ['id', 'documentId'] },
  });
  if (!assessmentVersionEntity) throw new AssessmentRuntimeError(400, 'assessmentVersion is invalid');
  const versionTenantRef = extractRelationRef(assessmentVersionEntity?.tenant);
  if (String(versionTenantRef || '') !== String(tenantId)) {
    throw new AssessmentRuntimeError(403, 'assessmentVersion does not belong to current tenant');
  }
  if (!assessmentVersionEntity?.id) throw new AssessmentRuntimeError(400, 'Assessment Version is missing database id');
  const assessmentRef = extractRelationRef(assessmentVersionEntity?.assessment) || versionDetail?.assessment?.documentId || versionDetail?.assessment?.id;
  const assessmentEntity = await ensureEntityInTenant(ASSESSMENT_UID, assessmentRef, tenantId, 'assessment');
  if (!assessmentEntity?.id) throw new AssessmentRuntimeError(400, 'Assessment is missing database id');
  return {
    versionDetail,
    assessmentVersionEntity,
    assessmentEntity,
  };
}

async function ensureAttemptVersionConsistency(versionId: unknown, tenantId: number | string) {
  const version = await getAssessmentVersionDetail(versionId, tenantId);
  if (!version?.assessment?.id) throw new AssessmentRuntimeError(400, 'Assessment Version is missing assessment');
  return version;
}

async function ensureAttemptAccess(attempt: any, context: RuntimeContext = {}) {
  if (context.allowManagerAccess) return;
  const authUserId = String(context.authUserId || '');
  if (!authUserId) throw new AssessmentRuntimeError(401, 'Unauthorized');
  const attemptUserRef = String(normalizeId(attempt?.user) || '');
  const learnerUserRef = String(normalizeId(attempt?.learner?.user) || '');
  if (attemptUserRef && attemptUserRef === authUserId) return;
  if (learnerUserRef && learnerUserRef === authUserId) return;
  throw new AssessmentRuntimeError(403, 'You do not have access to this assessment attempt');
}

export function getTenantIdFromContext(ctx: any) {
  return resolveCurrentTenantId(ctx);
}

export async function startAssessmentAttempt(versionId: unknown, body: any, tenantId: number | string, context: RuntimeContext = {}) {
  const payload = extractBody(body);
  const actor = await resolveActorPayload(payload, tenantId, context.authUserId);
  const isAdminTest = actor?.sourceType === 'admin_test';
  if (isAdminTest && !context.authUserId) throw new AssessmentRuntimeError(401, 'Unauthorized');
  const allowDraft = parseBoolean(payload.allowDraft, isAdminTest);
  const resumeExisting = parseBoolean(payload.resumeExisting, isAdminTest ? false : true);

  if (isAdminTest) {
    actor.sourceRef = actor.sourceRef || toText((await getAssessmentVersionDetail(versionId, tenantId))?.code) || toText(versionId);
    actor.learner = null;
    actor.lead = null;
  }

  if (resumeExisting && !isAdminTest) {
    const reuseWhere = buildAttemptReuseWhere(versionId, actor, tenantId);
    if (reuseWhere) {
      const existing = await strapi.db.query(ASSESSMENT_ATTEMPT_UID).findOne({
        where: reuseWhere,
        orderBy: [{ startedAt: 'desc' }, { id: 'desc' }],
        populate: buildAttemptPopulate({ includeAnswers: true }),
      });
      if (existing) {
        const current = await markAttemptExpiredIfNeeded(existing, tenantId);
        if (toText(current?.status) === 'created' || toText(current?.status) === 'in_progress') {
          return buildRuntimeResponse(current, current?.answers || []);
        }
      }
    }
  }

  const { versionDetail, assessmentVersionEntity, assessmentEntity } = await resolveAttemptDefinitionContext(versionId, tenantId, allowDraft);
  const { definitionSnapshot, scoringSnapshot } = buildAttemptSnapshots(versionDetail);
  const startedAt = new Date();
  const durationMinutes = parseOptionalInteger(versionDetail?.durationMinutes, 'durationMinutes');
  if (!durationMinutes || durationMinutes <= 0) {
    throw new AssessmentRuntimeError(409, 'Assessment Version durationMinutes is required to start a timed attempt');
  }
  const expiresAt = addMinutes(startedAt, durationMinutes);
  const code = await generateAttemptCode(tenantId);
  await ensureAttemptCodeUnique(code, tenantId);

  const created = await strapi.db.query(ASSESSMENT_ATTEMPT_UID).create({
    data: {
      code,
      assessment: Number(assessmentEntity.id),
      assessmentVersion: Number(assessmentVersionEntity.id),
      status: 'in_progress',
      startedAt,
      expiresAt,
      user: normalizeDbId(actor.user),
      learner: normalizeDbId(actor.learner),
      lead: normalizeDbId(actor.lead),
      candidateNameSnapshot: actor.candidateNameSnapshot,
      candidateEmailSnapshot: actor.candidateEmailSnapshot,
      candidatePhoneSnapshot: actor.candidatePhoneSnapshot,
      sourceType: actor.sourceType,
      sourceRef: actor.sourceRef,
      definitionSnapshot,
      scoringSnapshot,
      progressState: payload.progressState && typeof payload.progressState === 'object' ? payload.progressState : null,
      tenant: tenantId,
    },
  });
  const attempt = await findAttemptOrThrow(created.id, tenantId, { includeAnswers: true });
  return buildRuntimeResponse(attempt, []);
}

export async function getAssessmentAttempt(id: unknown, tenantId: number | string, context: RuntimeContext = {}) {
  const attempt = await markAttemptExpiredIfNeeded(await findAttemptOrThrow(id, tenantId, { includeAnswers: true }), tenantId);
  await ensureAttemptAccess(attempt, context);
  return buildRuntimeResponse(attempt, attempt?.answers || []);
}

export async function resumeAssessmentAttempt(id: unknown, tenantId: number | string, context: RuntimeContext = {}) {
  return getAssessmentAttempt(id, tenantId, context);
}

export async function listAssessmentAttempts(query: Record<string, unknown> = {}, tenantId: number | string) {
  const page = Math.max(1, Number(query?.page || 1) || 1);
  const pageSize = Math.max(1, Math.min(100, Number(query?.pageSize || 10) || 10));
  const start = (page - 1) * pageSize;
  const q = toText(query?.q || query?.search);
  const assessmentVersionRef = toText(query?.assessmentVersionId || query?.assessmentVersion);
  const assessmentRef = toText(query?.assessmentId || query?.assessment);
  const status = toText(query?.status);
  const whereClauses: any[] = [];
  if (q) {
    whereClauses.push({
      $or: [
        { code: { $containsi: q } },
        { candidateNameSnapshot: { $containsi: q } },
        { candidateEmailSnapshot: { $containsi: q } },
        { candidatePhoneSnapshot: { $containsi: q } },
        { sourceRef: { $containsi: q } },
      ],
    });
  }
  if (assessmentVersionRef) whereClauses.push({ assessmentVersion: whereByParam(assessmentVersionRef) });
  if (assessmentRef) whereClauses.push({ assessment: whereByParam(assessmentRef) });
  if (status) whereClauses.push({ status });
  const where = mergeTenantWhere(whereClauses.length > 0 ? { $and: whereClauses } : {}, tenantId);
  const orderBy = normalizeSortInput(query?.sort).length > 0 ? normalizeSortInput(query?.sort) : [{ startedAt: 'desc' }, { id: 'desc' }];
  const [rows, total] = await Promise.all([
    strapi.db.query(ASSESSMENT_ATTEMPT_UID).findMany({ where, offset: start, limit: pageSize, orderBy, populate: buildAttemptPopulate() }),
    strapi.db.query(ASSESSMENT_ATTEMPT_UID).count({ where }),
  ]);
  return {
    data: (rows || []).map((row: any) => ({
      ...mapAttempt(row),
      questionCount: Number(row?.definitionSnapshot?.version?.totalQuestions || 0),
    })),
    meta: { pagination: { page, pageSize, total, pageCount: Math.max(1, Math.ceil(total / pageSize)) } },
  };
}

export async function saveAssessmentAnswer(attemptId: unknown, assessmentQuestionId: unknown, body: any, tenantId: number | string, context: RuntimeContext = {}) {
  const payload = extractBody(body);
  const attempt = await markAttemptExpiredIfNeeded(await findAttemptOrThrow(attemptId, tenantId, { includeAnswers: true }), tenantId);
  await ensureAttemptAccess(attempt, context);
  ensureWritableAttempt(attempt);

  const snapshotQuestion = findAttemptQuestionSnapshot(attempt?.definitionSnapshot, assessmentQuestionId);
  if (!snapshotQuestion) throw new AssessmentRuntimeError(400, 'assessmentQuestion does not belong to this attempt');
  const assessmentQuestion = await ensureEntityInTenant(ASSESSMENT_QUESTION_UID, snapshotQuestion.assessmentQuestionId || snapshotQuestion.assessmentQuestionDocumentId, tenantId, 'assessmentQuestion');
  const question = await ensureEntityInTenant(QUESTION_UID, snapshotQuestion.questionId || snapshotQuestion.questionDocumentId, tenantId, 'question');
  const answerData = validateAnswerData(snapshotQuestion, payload.answerData);
  const timeSpentDelta = payload.timeSpentDelta !== undefined ? parseNonNegativeInteger(payload.timeSpentDelta, 'timeSpentDelta') : (payload.timeSpentSeconds !== undefined ? parseNonNegativeInteger(payload.timeSpentSeconds, 'timeSpentSeconds') : 0);
  const progressState = payload.progressState && typeof payload.progressState === 'object' && !Array.isArray(payload.progressState) ? payload.progressState : null;
  const existing = await findAttemptAnswer(attempt.id, normalizeId(assessmentQuestion), tenantId);
  const now = new Date().toISOString();
  const complete = isAnswerComplete(snapshotQuestion?.question?.type, answerData);
  const audioAnswerGate = canSaveAudioAnswer(snapshotQuestion, existing);
  if (!audioAnswerGate.allowed && audioAnswerGate.errorCode) {
    throw new AssessmentRuntimeError(409, audioAnswerGate.errorCode);
  }

  let saved: any;
  if (existing?.id) {
    saved = await strapi.db.query(ASSESSMENT_ANSWER_UID).update({
      where: { id: existing.id },
      data: {
        answerData,
        lastAnsweredAt: now,
        firstAnsweredAt: existing?.firstAnsweredAt || (complete ? now : null),
        timeSpentSeconds: Number(existing?.timeSpentSeconds || 0) + timeSpentDelta,
        runtimeMeta: existing?.runtimeMeta ?? null,
      },
      populate: {
        assessmentQuestion: { select: ['id', 'documentId'] },
        question: { select: ['id', 'documentId', 'code', 'type'] },
      },
    });
  } else {
    saved = await strapi.db.query(ASSESSMENT_ANSWER_UID).create({
      data: {
        attempt: attempt.id,
        assessmentQuestion: assessmentQuestion.id,
        question: question.id,
        answerData,
        questionSnapshot: buildAnswerQuestionSnapshot(snapshotQuestion),
        firstAnsweredAt: complete ? now : null,
        lastAnsweredAt: now,
        timeSpentSeconds: timeSpentDelta,
        audioPlayCount: 0,
        listenRequirementSatisfied: false,
        listenRequirementSatisfiedAt: null,
        runtimeMeta: null,
        tenant: tenantId,
      },
      populate: {
        assessmentQuestion: { select: ['id', 'documentId'] },
        question: { select: ['id', 'documentId', 'code', 'type'] },
      },
    });
  }

  if (progressState) {
    await strapi.db.query(ASSESSMENT_ATTEMPT_UID).update({ where: { id: attempt.id }, data: { progressState } });
  }

  return {
    answer: mapAnswer(saved),
    isComplete: complete,
    progress: resolveAttemptProgress(attempt?.definitionSnapshot, [...(attempt?.answers || []).filter((item: any) => String(normalizeId(item?.assessmentQuestion) || '') !== String(normalizeId(assessmentQuestion) || '')), mapAnswer(saved)], progressState || attempt?.progressState || null),
  };
}

export async function registerAssessmentAudioPlay(attemptId: unknown, assessmentQuestionId: unknown, body: any, tenantId: number | string, context: RuntimeContext = {}) {
  extractBody(body);
  const attempt = await markAttemptExpiredIfNeeded(await findAttemptOrThrow(attemptId, tenantId, { includeAnswers: true }), tenantId);
  await ensureAttemptAccess(attempt, context);
  ensureWritableAttempt(attempt);
  const snapshotQuestion = findAttemptQuestionSnapshot(attempt?.definitionSnapshot, assessmentQuestionId);
  if (!snapshotQuestion) throw new AssessmentRuntimeError(400, 'assessmentQuestion does not belong to this attempt');
  if (!hasAudioStimulus(snapshotQuestion)) throw new AssessmentRuntimeError(400, 'assessmentQuestion does not have audio stimulus');
  const mediaDelivery = await getAssessmentQuestionAudioDelivery(attempt.id, assessmentQuestionId, tenantId, context);

  const assessmentQuestion = await ensureEntityInTenant(ASSESSMENT_QUESTION_UID, snapshotQuestion.assessmentQuestionId || snapshotQuestion.assessmentQuestionDocumentId, tenantId, 'assessmentQuestion');
  const question = await ensureEntityInTenant(QUESTION_UID, snapshotQuestion.questionId || snapshotQuestion.questionDocumentId, tenantId, 'question');
  const audioPlayLimit = resolveEffectiveAudioPlayLimit(snapshotQuestion);
  const allowSeek = snapshotQuestion?.allowSeek !== false;
  const existing = await findAttemptAnswer(attempt.id, normalizeId(assessmentQuestion), tenantId);
  const currentCount = Number(existing?.audioPlayCount || 0);
  const playId = crypto.randomUUID();
  const runtimeMeta = buildActiveAudioPlayMeta(playId);

  if (audioPlayLimit !== null && currentCount >= Number(audioPlayLimit)) {
    throw new AssessmentRuntimeError(409, 'Audio play limit exceeded for this question');
  }

  let saved: any;
  if (existing?.id) {
    saved = await strapi.db.query(ASSESSMENT_ANSWER_UID).update({
      where: { id: existing.id },
      data: { audioPlayCount: currentCount + 1, runtimeMeta },
      populate: {
        assessmentQuestion: { select: ['id', 'documentId'] },
        question: { select: ['id', 'documentId', 'code', 'type'] },
      },
    });
  } else {
    saved = await strapi.db.query(ASSESSMENT_ANSWER_UID).create({
      data: {
        attempt: attempt.id,
        assessmentQuestion: assessmentQuestion.id,
        question: question.id,
        answerData: null,
        questionSnapshot: buildAnswerQuestionSnapshot(snapshotQuestion),
        firstAnsweredAt: null,
        lastAnsweredAt: null,
        timeSpentSeconds: 0,
        audioPlayCount: 1,
        listenRequirementSatisfied: false,
        listenRequirementSatisfiedAt: null,
        runtimeMeta,
        tenant: tenantId,
      },
      populate: {
        assessmentQuestion: { select: ['id', 'documentId'] },
        question: { select: ['id', 'documentId', 'code', 'type'] },
      },
    });
  }

  const used = Number(saved?.audioPlayCount || 0);
  return {
    assessmentQuestionId: normalizeId(saved?.assessmentQuestion),
    audioPlayCount: used,
    audioPlayLimit,
    remaining: audioPlayLimit === null ? null : Math.max(0, Number(audioPlayLimit) - used),
    allowSeek,
    minListenRatioBeforeAnswer: normalizeListenRequirementRatio(snapshotQuestion),
    listenRequirementSatisfied: saved?.listenRequirementSatisfied === true,
    playId,
    mediaUrl: mediaDelivery.url,
    mediaMimeType: mediaDelivery.mimeType,
  };
}

export async function markAudioListenRequirementSatisfied(attemptId: unknown, assessmentQuestionId: unknown, body: any, tenantId: number | string, context: RuntimeContext = {}) {
  const payload = extractBody(body);
  const attempt = await markAttemptExpiredIfNeeded(await findAttemptOrThrow(attemptId, tenantId, { includeAnswers: true }), tenantId);
  await ensureAttemptAccess(attempt, context);
  ensureWritableAttempt(attempt);
  const snapshotQuestion = findAttemptQuestionSnapshot(attempt?.definitionSnapshot, assessmentQuestionId);
  if (!snapshotQuestion) throw new AssessmentRuntimeError(400, 'assessmentQuestion does not belong to this attempt');
  if (!hasAudioStimulus(snapshotQuestion)) throw new AssessmentRuntimeError(400, 'assessmentQuestion does not have audio stimulus');
  if (!hasListenRequirement(snapshotQuestion)) {
    return {
      assessmentQuestionId: snapshotQuestion?.assessmentQuestionId || snapshotQuestion?.assessmentQuestionDocumentId || null,
      listenRequirementSatisfied: true,
      listenRequirementSatisfiedAt: null,
      minListenRatioBeforeAnswer: 0,
    };
  }

  const assessmentQuestion = await ensureEntityInTenant(ASSESSMENT_QUESTION_UID, snapshotQuestion.assessmentQuestionId || snapshotQuestion.assessmentQuestionDocumentId, tenantId, 'assessmentQuestion');
  const existing = await findAttemptAnswer(attempt.id, normalizeId(assessmentQuestion), tenantId);
  if (!existing?.id) throw new AssessmentRuntimeError(409, 'LISTEN_REQUIREMENT_PLAY_NOT_FOUND');
  if (existing?.listenRequirementSatisfied === true) {
    return {
      assessmentQuestionId: normalizeId(existing?.assessmentQuestion),
      listenRequirementSatisfied: true,
      listenRequirementSatisfiedAt: existing?.listenRequirementSatisfiedAt || null,
      minListenRatioBeforeAnswer: normalizeListenRequirementRatio(snapshotQuestion),
    };
  }

  const playId = ensureRequiredText(payload.playId, 'playId');
  const runtimeMeta = parseAnswerRuntimeMeta(existing?.runtimeMeta);
  if (String(runtimeMeta?.activeAudioPlay?.playId || '') !== playId) {
    throw new AssessmentRuntimeError(409, 'LISTEN_REQUIREMENT_PLAY_NOT_ACTIVE');
  }

  const now = new Date().toISOString();
  const saved = await strapi.db.query(ASSESSMENT_ANSWER_UID).update({
    where: { id: existing.id },
    data: {
      listenRequirementSatisfied: true,
      listenRequirementSatisfiedAt: now,
      runtimeMeta: clearActiveAudioPlayMeta(runtimeMeta),
    },
    populate: {
      assessmentQuestion: { select: ['id', 'documentId'] },
      question: { select: ['id', 'documentId', 'code', 'type'] },
    },
  });

  return {
    assessmentQuestionId: normalizeId(saved?.assessmentQuestion),
    listenRequirementSatisfied: true,
    listenRequirementSatisfiedAt: now,
    minListenRatioBeforeAnswer: normalizeListenRequirementRatio(snapshotQuestion),
  };
}

export async function updateAssessmentProgress(attemptId: unknown, body: any, tenantId: number | string, context: RuntimeContext = {}) {
  const payload = extractBody(body);
  const attempt = await markAttemptExpiredIfNeeded(await findAttemptOrThrow(attemptId, tenantId, { includeAnswers: true }), tenantId);
  await ensureAttemptAccess(attempt, context);
  ensureWritableAttempt(attempt);
  const progressState = payload.progressState && typeof payload.progressState === 'object' && !Array.isArray(payload.progressState) ? payload.progressState : null;
  if (!progressState) throw new AssessmentRuntimeError(400, 'progressState is required');
  await strapi.db.query(ASSESSMENT_ATTEMPT_UID).update({ where: { id: attempt.id }, data: { progressState } });
  const refreshed = await findAttemptOrThrow(attempt.id, tenantId, { includeAnswers: true });
  return {
    attempt: mapAttempt(refreshed),
    progress: resolveAttemptProgress(refreshed?.definitionSnapshot, (refreshed?.answers || []).map(mapAnswer), refreshed?.progressState || null),
  };
}

export async function submitAssessmentAttempt(attemptId: unknown, tenantId: number | string, context: RuntimeContext = {}) {
  let attempt = await markAttemptExpiredIfNeeded(await findAttemptOrThrow(attemptId, tenantId, { includeAnswers: true }), tenantId);
  await ensureAttemptAccess(attempt, context);
  const status = toText(attempt?.status);
  if (status === 'submitted') {
    await ensureAttemptScored(attempt.id, tenantId)
    return finalizeAttemptSubmission(attempt, tenantId, { enforceRequired: false, submittedAt: attempt?.submittedAt || new Date().toISOString() })
  }
  ensureWritableAttempt(attempt);
  return finalizeAttemptSubmission(attempt, tenantId, { enforceRequired: true, submittedAt: new Date().toISOString() });
}

export async function getCandidateAssessmentResult(attemptId: unknown, tenantId: number | string, context: RuntimeContext = {}) {
  const attempt = await markAttemptExpiredIfNeeded(await findAttemptOrThrow(attemptId, tenantId, { includeAnswers: false }), tenantId)
  await ensureAttemptAccess(attempt, context)

  return getCandidateAssessmentResultPayloadByAttempt(attempt.id, tenantId)
}

export async function getCandidateAssessmentResultPayloadByAttempt(attemptId: unknown, tenantId: number | string) {
  const attempt = await markAttemptExpiredIfNeeded(await findAttemptOrThrow(attemptId, tenantId, { includeAnswers: false }), tenantId)

  const result = await findCurrentResultByAttemptOrNull(attempt.id, tenantId)
  const speakingReview = result?.id ? await findCurrentSpeakingReviewByResultOrNull(result.id, tenantId) : null
  const confirmation = result?.id ? await findCurrentPlacementConfirmationByResultOrNull(result.id, tenantId) : null
  const visibility = await resolveAssignmentAttemptVisibility(attempt, tenantId)

  const workflowState = deriveCandidateWorkflowState(attempt, result, speakingReview, confirmation)
  const revealScores = shouldRevealCandidateScores(result, confirmation, visibility)
  const effectiveWorkflowState = visibility?.showScoreAfterSubmit === false && workflowState === 'provisional_ready'
    ? 'submitted'
    : workflowState
  const banner = buildCandidateStatusBanner(effectiveWorkflowState, attempt?.assessmentVersion)

  return {
    attempt: {
      id: normalizeId(attempt),
      documentId: attempt?.documentId || null,
      code: attempt?.code || '',
      status: attempt?.status || '',
      startedAt: attempt?.startedAt || null,
      submittedAt: attempt?.submittedAt || null,
      candidateName: attempt?.candidateNameSnapshot || attempt?.learner?.fullName || attempt?.lead?.fullName || attempt?.user?.fullName || attempt?.user?.username || null,
    },
    assessment: {
      code: attempt?.assessment?.code || '',
      name: attempt?.assessment?.name || attempt?.assessment?.title || '',
    },
    version: {
      code: attempt?.assessmentVersion?.code || '',
      title: attempt?.assessmentVersion?.title || '',
      resultMode: attempt?.assessmentVersion?.resultMode || 'provisional',
      requiresSpeaking: attempt?.assessmentVersion?.requiresSpeaking !== false,
      requiresTeacherConfirmation: attempt?.assessmentVersion?.requiresTeacherConfirmation !== false,
    },
    result: mapCandidateResult(result, { revealScores }),
    speaking: mapCandidateSpeakingReview(speakingReview, { revealScores }),
    confirmation: mapCandidateConfirmation(confirmation, { revealScores }),
    workflowState: effectiveWorkflowState,
    statusBanner: banner,
    allowResultView: visibility?.showScoreAfterSubmit !== false,
    revealScores,
  }
}

export async function hasAttemptsForAssessmentVersion(versionId: unknown, tenantId: number | string) {
  const count = await strapi.db.query(ASSESSMENT_ATTEMPT_UID).count({
    where: mergeTenantWhere({ assessmentVersion: whereByParam(versionId) }, tenantId),
  });
  return Number(count || 0) > 0;
}

export async function ensureAttemptVersionExists(versionId: unknown, tenantId: number | string) {
  return ensureAttemptVersionConsistency(versionId, tenantId);
}

export default {
  getTenantIdFromContext,
  startAssessmentAttempt,
  getAssessmentAttempt,
  getAssessmentQuestionAudioDelivery,
  streamAssessmentQuestionAudio,
  getCandidateAssessmentResult,
  getCandidateAssessmentResultPayloadByAttempt,
  resumeAssessmentAttempt,
  listAssessmentAttempts,
  saveAssessmentAnswer,
  registerAssessmentAudioPlay,
  markAudioListenRequirementSatisfied,
  updateAssessmentProgress,
  submitAssessmentAttempt,
  finalizeExpiredAssessmentAttempt,
  hasAttemptsForAssessmentVersion,
  ensureAttemptVersionExists,
  verifyAssessmentRuntimeFileAssetToken,
};