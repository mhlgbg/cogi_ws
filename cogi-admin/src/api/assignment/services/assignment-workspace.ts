import { mergeTenantWhere, toText } from '../../../utils/tenant-scope';
import { sanitizeQuickMessageHtml } from '../../quick-message/services/quick-message-html';
import storageService from '../../../services/storage-service';
import { startAssessmentAttempt } from '../../assessment-runtime/services/assessment-runtime';
import { buildSubmissionSnapshotForAutoGrade, mapSubmissionExtractionError } from './submission-content-adapters';
import {
  ensureCanTeachOrManageSession,
  findClassSessionOrThrow,
  getEligibleLearnersForSession,
  getSessionAccessContext,
} from '../../class/services/class-session';

const ASSIGNMENT_UID = 'api::assignment.assignment';
const ASSIGNMENT_TASK_UID = 'api::assignment-task.assignment-task';
const ASSIGNMENT_PROGRESS_UID = 'api::assignment-task-learner-progress.assignment-task-learner-progress';
const ASSIGNMENT_SUBMISSION_UID = 'api::assignment-submission.assignment-submission';
const ASSIGNMENT_SUBMISSION_ITEM_UID = 'api::assignment-submission-item.assignment-submission-item';
const FILE_ASSET_UID = 'api::file-asset.file-asset';
const LEARNER_UID = 'api::learner.learner';
const ASSESSMENT_UID = 'api::assessment.assessment';
const ASSESSMENT_VERSION_UID = 'api::assessment-version.assessment-version';
const ASSESSMENT_ATTEMPT_UID = 'api::assessment-attempt.assessment-attempt';
const AI_ASSISTANT_UID = 'api::ai-assistant.ai-assistant';

const TEACHER_FEATURE_KEYS = ['class.teacher-sessions', 'class.teacher-workspace'];
const STUDENT_FEATURE_KEYS = ['class.student-sessions', 'class.student-workspace', 'class.student-assignments'];
const ASSIGNMENT_STATUS_VALUES = new Set(['draft', 'published', 'closed', 'cancelled']);
const TASK_TYPE_VALUES = new Set(['todo', 'submission', 'assessment']);
const PROGRESS_STATUS_VALUES = new Set(['assigned', 'in_progress', 'submitted', 'completed', 'returned', 'missing']);
const SUBMISSION_STATUS_VALUES = new Set(['draft', 'submitted', 'returned', 'accepted']);
const SUBMISSION_ITEM_TYPE_VALUES = new Set(['html', 'link', 'image', 'video', 'audio', 'file']);
const ASSESSMENT_ATTEMPT_TERMINAL_STATUSES = new Set(['submitted', 'expired']);
const STUDENT_ASSIGNMENT_STATUS_VALUES = new Set(['pending', 'in_progress', 'completed', 'overdue']);
const DEFAULT_ASSESSMENT_SETTINGS = {
  maxAttempts: 1,
  showScoreAfterSubmit: true,
  reviewMode: 'none',
};
const AUTO_GRADE_FALLBACK_MODEL = 'gpt-4o-mini';
const DEPRECATED_OPENAI_MODELS = new Set(['gpt-3.5-turbo', 'gpt-3.5-turbo-16k']);

function httpError(status: number, message: string) {
  const error = new Error(message) as Error & { status?: number };
  error.status = status;
  return error;
}

function parsePositiveInt(value: unknown): number | null {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

function normalizeStatus<T extends string>(value: unknown, allowed: Set<T>, fieldName: string, fallback?: T): T {
  const text = toText(value).toLowerCase() as T;
  if (!text && fallback) return fallback;
  if (!allowed.has(text)) throw httpError(400, `${fieldName} is invalid`);
  return text;
}

function normalizeOptionalText(value: unknown, maxLength = 0) {
  const text = toText(value);
  if (!text) return null;
  if (maxLength > 0 && text.length > maxLength) throw httpError(400, `text exceeds max length ${maxLength}`);
  return text;
}

function normalizeRequiredText(value: unknown, fieldName: string, maxLength = 0) {
  const text = toText(value);
  if (!text) throw httpError(400, `${fieldName} is required`);
  if (maxLength > 0 && text.length > maxLength) throw httpError(400, `${fieldName} exceeds max length ${maxLength}`);
  return text;
}

function normalizeHtml(value: unknown) {
  const text = toText(value);
  return text ? sanitizeQuickMessageHtml(text) : null;
}

function normalizeGradingVersion(value: unknown) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : 1;
}

function normalizeOptionalDateTime(value: unknown, fieldName: string) {
  const text = toText(value);
  if (!text) return null;
  const date = new Date(text);
  if (Number.isNaN(date.getTime())) throw httpError(400, `${fieldName} is invalid`);
  return date.toISOString();
}

function normalizeOptionalDate(value: unknown, fieldName: string, mode: 'start' | 'end' = 'start') {
  const text = toText(value);
  if (!text) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) {
    return mode === 'end' ? `${text}T23:59:59.999Z` : `${text}T00:00:00.000Z`;
  }
  return normalizeOptionalDateTime(text, fieldName);
}

function normalizeBoolean(value: unknown, fallback = false) {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value !== 0;
  const text = toText(value).toLowerCase();
  if (!text) return fallback;
  return ['1', 'true', 'yes', 'on'].includes(text);
}

function readDateTimeMs(value: unknown) {
  const text = toText(value);
  if (!text) return null;
  const date = new Date(text);
  const ms = date.getTime();
  return Number.isNaN(ms) ? null : ms;
}

function resolveReopenTargetStatus(assignment: any) {
  return assignment?.assignedAt ? 'published' : 'draft';
}

function writeAssignmentReopenAuditLog(params: {
  assignmentId: number;
  tenantId: number | string;
  previousStatus: string;
  nextStatus: string;
  authUser: any;
}) {
  const actor = params?.authUser || {};
  const payload = {
    action: 'assignment.reopen',
    assignmentId: Number(params.assignmentId),
    tenantId: Number(params.tenantId || 0) || params.tenantId,
    at: new Date().toISOString(),
    previousStatus: params.previousStatus,
    nextStatus: params.nextStatus,
    actor: {
      id: Number(actor.id || 0) || null,
      username: actor.username || '',
      email: actor.email || '',
      fullName: actor.fullName || '',
    },
  };
  strapi.log.info(`[assignment-workspace] ${JSON.stringify(payload)}`);
}

function writeAssignmentTaskGradingAuditLog(params: {
  assignmentId: number;
  taskId: number;
  tenantId: number | string;
  oldGradingVersion: number;
  newGradingVersion: number;
  gradingChanged: boolean;
  authUser: any;
}) {
  const actor = params?.authUser || {};
  const payload = {
    action: 'assignment.task-grading-definition.update',
    assignmentId: Number(params.assignmentId),
    taskId: Number(params.taskId),
    tenantId: Number(params.tenantId || 0) || params.tenantId,
    at: new Date().toISOString(),
    oldGradingVersion: Number(params.oldGradingVersion || 1) || 1,
    newGradingVersion: Number(params.newGradingVersion || 1) || 1,
    gradingChanged: params.gradingChanged === true,
    actor: {
      id: Number(actor.id || 0) || null,
      username: actor.username || '',
      email: actor.email || '',
      fullName: actor.fullName || '',
    },
  };
  strapi.log.info(`[assignment-workspace] ${JSON.stringify(payload)}`);
}

function mapUserLite(user: any) {
  if (!user?.id) return null;
  return {
    id: Number(user.id),
    username: user.username || '',
    email: user.email || '',
    fullName: user.fullName || '',
  };
}

function mapLearnerLite(learner: any) {
  if (!learner?.id) return null;
  return {
    id: Number(learner.id),
    code: learner.code || '',
    fullName: learner.fullName || '',
    learnerStatus: learner.learnerStatus || learner.status || 'active',
    username: learner.user?.username || '',
  };
}

function mapFileAsset(row: any) {
  if (!row?.id) return null;
  return {
    id: Number(row.id),
    code: row.code || '',
    moduleKey: row.moduleKey || '',
    originalName: row.originalName || '',
    fileName: row.fileName || '',
    mimeType: row.mimeType || '',
    size: Number(row.size || 0) || 0,
    provider: row.provider || 'local',
    url: row.url || '',
    fileAssetId: Number(row.id),
    storageProvider: row.provider || 'local',
  };
}

function ensureTeacherFeature(access: { canManageClasses: boolean; permissionKeys?: Set<string> }) {
  if (access.canManageClasses) return;
  if (TEACHER_FEATURE_KEYS.some((key) => access.permissionKeys?.has(key))) return;
  throw httpError(403, 'User does not have teacher workspace feature permission in current tenant');
}

function ensureStudentFeature(access: { canManageClasses: boolean; permissionKeys?: Set<string> }) {
  if (access.canManageClasses) return;
  if (STUDENT_FEATURE_KEYS.some((key) => access.permissionKeys?.has(key))) return;
  throw httpError(403, 'User does not have student workspace feature permission in current tenant');
}

async function resolveTeacherSession(sessionRef: unknown, tenantId: number | string, authUser: any) {
  const access = await getSessionAccessContext(tenantId, authUser);
  ensureTeacherFeature(access);
  const session = await findClassSessionOrThrow(sessionRef, tenantId);
  await ensureCanTeachOrManageSession(session, access, tenantId, { mode: 'teacher', requireOperate: true });
  return { access, session };
}

async function resolveTeacherAssignment(assignmentRef: unknown, tenantId: number | string, authUser: any) {
  const access = await getSessionAccessContext(tenantId, authUser);
  ensureTeacherFeature(access);
  const assignment = await findAssignmentOrThrow(assignmentRef, tenantId);
  const session = await findClassSessionOrThrow(assignment.classSession?.id || assignment.classSession, tenantId);
  await ensureCanTeachOrManageSession(session, access, tenantId, { mode: 'teacher', requireOperate: true });
  return { access, assignment, session };
}

async function listStudentLearners(tenantId: number | string, userId: number) {
  const rows = await strapi.db.query(LEARNER_UID).findMany({
    where: mergeTenantWhere({ user: { id: { $eq: userId } } }, tenantId),
    select: ['id', 'code', 'fullName', 'learnerStatus'],
    orderBy: [{ id: 'asc' }],
  });
  return (rows || []).map(mapLearnerLite).filter(Boolean);
}

async function resolveStudentContext(query: Record<string, unknown>, tenantId: number | string, authUser: any) {
  const access = await getSessionAccessContext(tenantId, authUser);
  ensureStudentFeature(access);
  const learners = await listStudentLearners(tenantId, access.userId);
  const requestedLearnerId = parsePositiveInt(query?.learnerId);
  const learner = requestedLearnerId
    ? (learners.find((item) => Number(item?.id || 0) === requestedLearnerId) || null)
    : learners.length === 1
      ? learners[0]
      : null;
  if (requestedLearnerId && !learner) throw httpError(403, 'Learner context does not belong to current user in this tenant');
  return { access, learners, learner };
}

function requireStudentLearner(resolved: { learner: any; learners: any[] }) {
  if (resolved.learner?.id) return resolved.learner;
  if ((resolved.learners || []).length === 0) throw httpError(403, 'Bạn chưa có hồ sơ học tập được liên kết trong không gian số này.');
  throw httpError(409, 'Vui lòng chọn hồ sơ học tập đang sử dụng trước khi tiếp tục.');
}

async function findAssignmentOrThrow(assignmentRef: unknown, tenantId: number | string) {
  const id = parsePositiveInt(assignmentRef);
  if (!id) throw httpError(404, 'Assignment not found');
  const row = await strapi.db.query(ASSIGNMENT_UID).findOne({
    where: mergeTenantWhere({ id: { $eq: id } }, tenantId),
    populate: {
      class: { select: ['id', 'name', 'subjectCode', 'subject'] },
      classSession: { select: ['id', 'sessionDate', 'startTime', 'endTime', 'status'] },
      assignedBy: { select: ['id', 'username', 'email', 'fullName'] },
    },
  });
  if (!row?.id) throw httpError(404, 'Assignment not found');
  return row;
}

async function findTaskOrThrow(taskRef: unknown, tenantId: number | string) {
  const id = parsePositiveInt(taskRef);
  if (!id) throw httpError(404, 'Assignment task not found');
  const row = await strapi.db.query(ASSIGNMENT_TASK_UID).findOne({
    where: mergeTenantWhere({ id: { $eq: id } }, tenantId),
    populate: {
      assignment: {
        select: ['id', 'title', 'status', 'dueAt', 'assignedAt'],
        populate: {
          class: { select: ['id', 'name', 'subjectCode', 'subject'] },
          classSession: { select: ['id', 'sessionDate', 'startTime', 'endTime', 'status'] },
          assignedBy: { select: ['id', 'username', 'email', 'fullName'] },
        },
      },
      assessment: { select: ['id', 'documentId', 'name'] },
    },
  });
  if (!row?.id) throw httpError(404, 'Assignment task not found');
  return row;
}

async function findProgress(taskId: number, learnerId: number, tenantId: number | string) {
  return await strapi.db.query(ASSIGNMENT_PROGRESS_UID).findOne({
    where: mergeTenantWhere({
      assignmentTask: { id: { $eq: taskId } },
      learner: { id: { $eq: learnerId } },
    }, tenantId),
    populate: {
      learner: { select: ['id', 'code', 'fullName', 'learnerStatus'] },
      reviewedBy: { select: ['id', 'username', 'email', 'fullName'] },
      assignmentTask: { select: ['id', 'title', 'taskType', 'required', 'order'] },
    },
  });
}

async function ensureProgress(taskId: number, learnerId: number, tenantId: number | string, defaultStatus: string = 'assigned') {
  const existing = await findProgress(taskId, learnerId, tenantId);
  if (existing?.id) return existing;
  const created = await strapi.db.query(ASSIGNMENT_PROGRESS_UID).create({
    data: {
      assignmentTask: taskId,
      learner: learnerId,
      status: defaultStatus,
      tenant: tenantId,
    },
  });
  return await findProgress(Number(created.id), learnerId, tenantId) || created;
}

function normalizeAssessmentSettings(value: any) {
  const source = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  return {
    assessmentVersionId: parsePositiveInt(source?.assessmentVersionId || source?.versionId) || null,
    maxAttempts: parsePositiveInt(source?.maxAttempts) || DEFAULT_ASSESSMENT_SETTINGS.maxAttempts,
    showScoreAfterSubmit: normalizeBoolean(source?.showScoreAfterSubmit, DEFAULT_ASSESSMENT_SETTINGS.showScoreAfterSubmit),
    reviewMode: normalizeOptionalText(source?.reviewMode, 50) || DEFAULT_ASSESSMENT_SETTINGS.reviewMode,
  };
}

function buildAssignmentAssessmentSourceRef(taskId: number, learnerId: number) {
  return `assignment-task:${Number(taskId)}:learner:${Number(learnerId)}`;
}

function extractAssessmentVersionId(task: any) {
  return parsePositiveInt(task?.assessmentSettings?.assessmentVersionId || task?.assessmentSettings?.versionId);
}

function summarizeVersionQuestions(version: any) {
  const sections = Array.isArray(version?.sections) ? version.sections : [];
  return sections.reduce((total: number, section: any) => total + (Array.isArray(section?.questions) ? section.questions.length : 0), 0);
}

async function resolveAssessmentTaskSelection(task: any, tenantId: number | string) {
  const assessmentId = parsePositiveInt(task?.assessmentId || task?.assessment?.id || task?.assessment);
  if (!assessmentId) throw httpError(400, 'assessmentId is required for assessment task');

  const assessment = await strapi.db.query(ASSESSMENT_UID).findOne({
    where: mergeTenantWhere({ id: { $eq: assessmentId }, status: { $eq: 'active' } }, tenantId),
    populate: {
      versions: {
        select: ['id', 'documentId', 'code', 'title', 'version', 'versionStatus', 'durationMinutes'],
        orderBy: [{ version: 'desc' }, { id: 'desc' }],
        populate: {
          sections: {
            select: ['id'],
            populate: {
              questions: { select: ['id'] },
            },
          },
        },
      },
    },
  });
  if (!assessment?.id) throw httpError(400, 'assessmentId is invalid or unavailable');

  const settings = normalizeAssessmentSettings(task?.assessmentSettings);
  const versions = Array.isArray(assessment?.versions) ? assessment.versions : [];
  const version = settings.assessmentVersionId
    ? versions.find((item: any) => Number(item?.id || 0) === settings.assessmentVersionId)
    : versions.find((item: any) => String(item?.versionStatus || '') === 'published');

  if (!version?.id || String(version?.versionStatus || '') !== 'published') {
    throw httpError(400, 'assessmentId must reference an assessment with a published version');
  }
  if (!parsePositiveInt(version?.durationMinutes)) {
    throw httpError(400, 'Selected assessment version must define durationMinutes');
  }

  return {
    assessmentId: Number(assessment.id),
    assessmentSettings: {
      ...settings,
      assessmentVersionId: Number(version.id),
    },
    assessmentSummary: {
      id: Number(assessment.id),
      documentId: assessment.documentId || null,
      code: assessment.code || '',
      title: assessment.name || '',
      status: assessment.status || 'draft',
    },
    assessmentVersionSummary: {
      id: Number(version.id),
      documentId: version.documentId || null,
      code: version.code || '',
      title: version.title || '',
      version: Number(version.version || 0) || 0,
      versionStatus: version.versionStatus || 'draft',
      durationMinutes: Number(version.durationMinutes || 0) || 0,
      questionCount: summarizeVersionQuestions(version),
    },
  };
}

async function loadAssessmentVersionsByIds(versionIds: number[], tenantId: number | string) {
  if (!versionIds.length) return new Map<number, any>();
  const rows = await strapi.db.query(ASSESSMENT_VERSION_UID).findMany({
    where: mergeTenantWhere({ id: { $in: versionIds } }, tenantId),
    populate: {
      sections: {
        select: ['id'],
        populate: {
          questions: { select: ['id'] },
        },
      },
    },
  });
  return new Map((rows || []).map((row: any) => [Number(row.id), {
    id: Number(row.id),
    documentId: row.documentId || null,
    code: row.code || '',
    title: row.title || '',
    version: Number(row.version || 0) || 0,
    versionStatus: row.versionStatus || 'draft',
    durationMinutes: Number(row.durationMinutes || 0) || 0,
    questionCount: summarizeVersionQuestions(row),
  }]));
}

async function listAssessmentAttemptsBySourceRefs(sourceRefs: string[], tenantId: number | string) {
  if (!sourceRefs.length) return [];
  return await strapi.db.query(ASSESSMENT_ATTEMPT_UID).findMany({
    where: mergeTenantWhere({ sourceRef: { $in: sourceRefs } }, tenantId),
    orderBy: [{ startedAt: 'desc' }, { id: 'desc' }],
    populate: {
      learner: { select: ['id', 'code', 'fullName', 'parentPhone'], populate: { user: { select: ['id'] } } },
      results: {
        select: ['id', 'status', 'rawScore', 'maxScore', 'pendingManualCount', 'isCurrent'],
        orderBy: [{ scoredAt: 'desc' }, { id: 'desc' }],
      },
    },
  });
}

function mapAssessmentTaskProgressFromAttempt(attempt: any) {
  if (!attempt?.id) return null;
  const currentResult = Array.isArray(attempt?.results)
    ? attempt.results.find((item: any) => item?.isCurrent === true) || attempt.results[0] || null
    : null;
  const attemptStatus = String(attempt?.status || '');
  if (attemptStatus === 'created' || attemptStatus === 'in_progress') {
    return {
      status: 'in_progress',
      startedAt: attempt?.startedAt || null,
      submittedAt: null,
      completedAt: null,
      score: null,
      maxScore: null,
    };
  }
  if (ASSESSMENT_ATTEMPT_TERMINAL_STATUSES.has(attemptStatus)) {
    const isCompleted = Boolean(currentResult?.id) && Number(currentResult?.pendingManualCount || 0) === 0;
    return {
      status: isCompleted ? 'completed' : 'submitted',
      startedAt: attempt?.startedAt || null,
      submittedAt: attempt?.submittedAt || null,
      completedAt: isCompleted ? (attempt?.submittedAt || null) : null,
      score: currentResult?.rawScore === null || currentResult?.rawScore === undefined ? null : Number(currentResult.rawScore),
      maxScore: currentResult?.maxScore === null || currentResult?.maxScore === undefined ? null : Number(currentResult.maxScore),
    };
  }
  return null;
}

async function synchronizeAssessmentProgressRows(tasks: any[], progressRows: any[], tenantId: number | string) {
  const assessmentTasks = (tasks || []).filter((task: any) => String(task?.taskType || '') === 'assessment');
  if (!assessmentTasks.length || !(progressRows || []).length) return progressRows;

  const sourceRefs: string[] = [];
  const progressBySourceRef = new Map<string, any>();
  for (const progress of progressRows || []) {
    const taskId = Number(progress?.assignmentTask?.id || progress?.assignmentTask || 0);
    const task = assessmentTasks.find((item: any) => Number(item?.id || 0) === taskId);
    if (!task?.id) continue;
    const learnerId = Number(progress?.learner?.id || progress?.learner || 0);
    if (!learnerId) continue;
    const sourceRef = buildAssignmentAssessmentSourceRef(Number(task.id), learnerId);
    sourceRefs.push(sourceRef);
    progressBySourceRef.set(sourceRef, progress);
  }

  const attempts = await listAssessmentAttemptsBySourceRefs(sourceRefs, tenantId);
  const latestAttemptBySourceRef = new Map<string, any>();
  for (const attempt of attempts || []) {
    const sourceRef = String(attempt?.sourceRef || '').trim();
    if (!sourceRef || latestAttemptBySourceRef.has(sourceRef)) continue;
    latestAttemptBySourceRef.set(sourceRef, attempt);
  }

  for (const [sourceRef, progress] of progressBySourceRef.entries()) {
    const attempt = latestAttemptBySourceRef.get(sourceRef);
    const next = mapAssessmentTaskProgressFromAttempt(attempt);
    if (!next) continue;

    const currentScore = progress?.score === null || progress?.score === undefined || progress?.score === '' ? null : Number(progress.score);
    const currentMaxScore = progress?.maxScore === null || progress?.maxScore === undefined || progress?.maxScore === '' ? null : Number(progress.maxScore);
    const changed = String(progress?.status || '') !== String(next.status || '')
      || String(progress?.startedAt || '') !== String(next.startedAt || '')
      || String(progress?.submittedAt || '') !== String(next.submittedAt || '')
      || String(progress?.completedAt || '') !== String(next.completedAt || '')
      || currentScore !== next.score
      || currentMaxScore !== next.maxScore;

    if (!changed) continue;

    await strapi.db.query(ASSIGNMENT_PROGRESS_UID).update({
      where: { id: Number(progress.id) },
      data: {
        status: next.status,
        startedAt: next.startedAt,
        submittedAt: next.submittedAt,
        completedAt: next.completedAt,
        score: next.score,
        maxScore: next.maxScore,
      },
    });

    progress.status = next.status;
    progress.startedAt = next.startedAt;
    progress.submittedAt = next.submittedAt;
    progress.completedAt = next.completedAt;
    progress.score = next.score;
    progress.maxScore = next.maxScore;
  }

  return progressRows;
}

async function normalizeTaskInput(task: any, index: number, tenantId: number | string) {
  const taskType = normalizeStatus(task?.taskType, TASK_TYPE_VALUES as Set<any>, 'taskType', 'todo' as any);
  const assessmentSelection = taskType === 'assessment'
    ? await resolveAssessmentTaskSelection(task, tenantId)
    : null;
  return {
    title: normalizeRequiredText(task?.title, 'task title', 200),
    description: normalizeHtml(task?.description),
    expectedOutcome: normalizeHtml(task?.expectedOutcome),
    gradingRubric: normalizeHtml(task?.gradingRubric),
    gradingVersion: normalizeGradingVersion(task?.gradingVersion),
    order: Number.isFinite(Number(task?.order)) ? Number(task.order) : index + 1,
    required: task?.required !== false,
    taskType,
    assessment: assessmentSelection?.assessmentId || null,
    assessmentSettings: assessmentSelection?.assessmentSettings || null,
  };
}

function hasAiGradingResult(progress: any) {
  if (!progress || typeof progress !== 'object') return false;
  const score = progress?.aiSuggestedScore;
  const maxScore = progress?.aiSuggestedMaxScore;
  const feedback = toText(progress?.aiSuggestedFeedback);
  const gradedAt = toText(progress?.aiGradedAt);
  return (score !== null && score !== undefined && score !== '')
    || (maxScore !== null && maxScore !== undefined && maxScore !== '')
    || Boolean(feedback)
    || Boolean(gradedAt);
}

function isAiGradingStale(progress: any, gradingVersion: number) {
  if (!hasAiGradingResult(progress)) return false;
  const aiVersion = parsePositiveInt(progress?.aiGradingVersion) || null;
  if (!aiVersion) return true;
  return aiVersion < normalizeGradingVersion(gradingVersion);
}

function mapAssignmentTask(row: any, progressRows: any[] = [], submissionRows: any[] = [], assessmentVersionMap: Map<number, any> = new Map()) {
  const relatedProgress = (progressRows || []).filter((item) => Number(item?.assignmentTask?.id || item?.assignmentTask || 0) === Number(row?.id || 0));
  const relatedSubmissions = (submissionRows || []).filter((item) => Number(item?.assignmentTask?.id || item?.assignmentTask || 0) === Number(row?.id || 0));
  const latestSubmitted = relatedProgress.filter((item) => item?.status === 'submitted').length;
  const completedCount = relatedProgress.filter((item) => item?.status === 'completed').length;
  const returnedCount = relatedProgress.filter((item) => item?.status === 'returned').length;
  const missingCount = relatedProgress.filter((item) => item?.status === 'missing' || item?.status === 'assigned').length;
  const assessmentSettings = normalizeAssessmentSettings(row?.assessmentSettings);
  const assessmentVersion = assessmentVersionMap.get(Number(assessmentSettings.assessmentVersionId || 0)) || null;
  const gradingVersion = normalizeGradingVersion(row?.gradingVersion);
  const aiGradedRows = relatedProgress.filter((item) => hasAiGradingResult(item));
  const staleAiRows = aiGradedRows.filter((item) => isAiGradingStale(item, gradingVersion));
  const staleUnreviewedRows = staleAiRows.filter((item) => !item?.reviewedAt);
  const staleReviewedRows = staleAiRows.filter((item) => Boolean(item?.reviewedAt));

  return {
    id: Number(row.id),
    title: row.title || '',
    description: row.description || '',
    expectedOutcome: row.expectedOutcome || '',
    gradingRubric: row.gradingRubric || '',
    gradingVersion,
    order: Number(row.order || 0) || 0,
    required: row.required !== false,
    taskType: row.taskType || 'todo',
    assessment: row.assessment?.id ? { id: Number(row.assessment.id), documentId: row.assessment.documentId || null, code: row.assessment.code || '', title: row.assessment.name || '', status: row.assessment.status || 'draft' } : null,
    assessmentVersion,
    assessmentSettings: String(row?.taskType || '') === 'assessment' ? assessmentSettings : null,
    stats: {
      learnerCount: relatedProgress.length,
      submittedCount: latestSubmitted,
      completedCount,
      returnedCount,
      missingCount,
      submissionVersionCount: relatedSubmissions.length,
      aiGradedCount: aiGradedRows.length,
      staleAiCount: staleAiRows.length,
      staleUnreviewedCount: staleUnreviewedRows.length,
      staleReviewedCount: staleReviewedRows.length,
    },
  };
}

function stripLearnerOnlyTask(task: any) {
  if (!task || typeof task !== 'object') return task;
  return {
    ...task,
    expectedOutcome: '',
    gradingRubric: '',
  };
}

function mapProgress(row: any) {
  if (!row?.id) return null;
  return {
    id: Number(row.id),
    status: row.status || 'assigned',
    startedAt: row.startedAt || null,
    submittedAt: row.submittedAt || null,
    completedAt: row.completedAt || null,
    score: row.score === null || row.score === undefined || row.score === '' ? null : Number(row.score),
    maxScore: row.maxScore === null || row.maxScore === undefined || row.maxScore === '' ? null : Number(row.maxScore),
    teacherFeedback: row.teacherFeedback || '',
    aiSuggestedScore: row.aiSuggestedScore === null || row.aiSuggestedScore === undefined || row.aiSuggestedScore === '' ? null : Number(row.aiSuggestedScore),
    aiSuggestedMaxScore: row.aiSuggestedMaxScore === null || row.aiSuggestedMaxScore === undefined || row.aiSuggestedMaxScore === '' ? null : Number(row.aiSuggestedMaxScore),
    aiSuggestedFeedback: row.aiSuggestedFeedback || '',
    aiGradingVersion: parsePositiveInt(row.aiGradingVersion),
    aiGradedAt: row.aiGradedAt || null,
    aiModel: row.aiModel || '',
    teacherReviewGradingVersion: parsePositiveInt(row.teacherReviewGradingVersion),
    reviewedBy: mapUserLite(row.reviewedBy),
    reviewedAt: row.reviewedAt || null,
    learner: mapLearnerLite(row.learner),
  };
}

function mapProgressForStudent(row: any, options: { showScoreAfterSubmit?: boolean } = {}) {
  const progress = mapProgress(row);
  if (!progress) return null;
  const sanitizedForStudent = {
    ...progress,
    aiSuggestedScore: null,
    aiSuggestedMaxScore: null,
    aiSuggestedFeedback: '',
    aiGradingVersion: null,
    aiGradedAt: null,
    aiModel: '',
    teacherReviewGradingVersion: null,
  };
  if (options.showScoreAfterSubmit === false) {
    return {
      ...sanitizedForStudent,
      score: null,
      maxScore: null,
    };
  }
  return sanitizedForStudent;
}

function normalizeStudentAssignmentStatus(progressStatus: unknown, dueAt: unknown, nowMs = Date.now()) {
  const status = toText(progressStatus).toLowerCase();
  if (status === 'completed' || status === 'submitted') return 'completed';
  const dueAtMs = readDateTimeMs(dueAt);
  if (dueAtMs !== null && dueAtMs < nowMs) return 'overdue';
  if (status === 'in_progress' || status === 'returned') return 'in_progress';
  return 'pending';
}

function compareStudentAssignmentTaskRows(left: any, right: any, statusFilter = '') {
  const normalized = toText(statusFilter).toLowerCase();
  const leftDueMs = readDateTimeMs(left?.dueAt);
  const rightDueMs = readDateTimeMs(right?.dueAt);
  const leftAssignedMs = readDateTimeMs(left?.assignedAt) || 0;
  const rightAssignedMs = readDateTimeMs(right?.assignedAt) || 0;
  const leftCompletedMs = readDateTimeMs(left?.completedAt || left?.submittedAt) || 0;
  const rightCompletedMs = readDateTimeMs(right?.completedAt || right?.submittedAt) || 0;

  if (normalized === 'completed') {
    if (leftCompletedMs !== rightCompletedMs) return rightCompletedMs - leftCompletedMs;
  } else if (normalized === 'overdue') {
    if (leftDueMs !== null && rightDueMs !== null && leftDueMs !== rightDueMs) return rightDueMs - leftDueMs;
    if (leftDueMs !== null && rightDueMs === null) return -1;
    if (leftDueMs === null && rightDueMs !== null) return 1;
  } else {
    if (leftDueMs !== null && rightDueMs !== null && leftDueMs !== rightDueMs) return leftDueMs - rightDueMs;
    if (leftDueMs !== null && rightDueMs === null) return -1;
    if (leftDueMs === null && rightDueMs !== null) return 1;
    if (leftAssignedMs !== rightAssignedMs) return leftAssignedMs - rightAssignedMs;
  }

  const leftOrder = Number(left?.order || 0);
  const rightOrder = Number(right?.order || 0);
  if (leftOrder !== rightOrder) return leftOrder - rightOrder;
  return Number(left?.taskId || 0) - Number(right?.taskId || 0);
}

function buildStudentAssignmentSummaryMeta(rows: any[]) {
  const incompleteRows = rows.filter((item) => item?.normalizedStatus !== 'completed');
  const completedRows = rows.filter((item) => item?.normalizedStatus === 'completed');
  const overdueRows = rows.filter((item) => item?.normalizedStatus === 'overdue');
  const inProgressRows = rows.filter((item) => item?.normalizedStatus === 'in_progress');
  const pendingRows = rows.filter((item) => item?.normalizedStatus === 'pending');

  return {
    totalCount: rows.length,
    incompleteCount: incompleteRows.length,
    overdueCount: overdueRows.length,
    inProgressCount: inProgressRows.length,
    pendingCount: pendingRows.length,
    completedRecentCount: completedRows.length,
    countsByStatus: {
      pending: pendingRows.length,
      in_progress: inProgressRows.length,
      completed: completedRows.length,
      overdue: overdueRows.length,
    },
    nextDueTasks: [...incompleteRows]
      .sort((left, right) => compareStudentAssignmentTaskRows(left, right, 'pending'))
      .slice(0, 5),
  };
}

function mapStudentAssignmentListItem(task: any, progress: any, submission: any, latestAttempt: any, nowMs = Date.now()) {
  const assignment = task?.assignment;
  const classEntity = assignment?.class;
  const classSession = assignment?.classSession;
  const assessmentSettings = normalizeAssessmentSettings(task?.assessmentSettings);
  const normalizedStatus = normalizeStudentAssignmentStatus(progress?.status, assignment?.dueAt, nowMs);
  const teacher = mapUserLite(assignment?.assignedBy || classSession?.teacher);
  const progressForStudent = mapProgressForStudent(progress, { showScoreAfterSubmit: assessmentSettings.showScoreAfterSubmit !== false });
  const attemptId = toText(latestAttempt?.id || latestAttempt?.documentId) || null;

  return {
    id: Number(task?.id || 0),
    taskId: Number(task?.id || 0),
    taskTitle: task?.title || '',
    taskDescription: task?.description || '',
    taskType: task?.taskType || 'todo',
    required: task?.required !== false,
    order: Number(task?.order || 0) || 0,
    assignmentId: Number(assignment?.id || 0),
    assignmentTitle: assignment?.title || '',
    assignmentDescription: assignment?.description || '',
    assignmentStatus: assignment?.status || 'draft',
    assignedAt: assignment?.assignedAt || null,
    dueAt: assignment?.dueAt || null,
    classId: Number(classEntity?.id || 0) || null,
    classCode: classEntity?.subjectCode || '',
    className: classEntity?.name || '',
    subject: classEntity?.subject || '',
    sessionId: Number(classSession?.id || 0) || null,
    sessionDate: classSession?.sessionDate || null,
    sessionStartTime: classSession?.startTime || null,
    sessionEndTime: classSession?.endTime || null,
    sessionStatus: classSession?.status || 'scheduled',
    teacher,
    learnerTaskStatus: progress?.status || 'assigned',
    normalizedStatus,
    startedAt: progressForStudent?.startedAt || null,
    completedAt: progressForStudent?.completedAt || null,
    submittedAt: progressForStudent?.submittedAt || null,
    assessmentId: Number(task?.assessment?.id || 0) || null,
    attemptId,
    attemptStatus: latestAttempt?.status || null,
    score: progressForStudent?.score ?? null,
    maxScore: progressForStudent?.maxScore ?? null,
    showScoreAfterSubmit: assessmentSettings.showScoreAfterSubmit !== false,
    latestSubmissionId: Number(submission?.id || 0) || null,
    latestSubmissionVersion: Number(submission?.version || 0) || null,
    latestSubmissionStatus: submission?.status || null,
    latestSubmissionSubmittedAt: submission?.submittedAt || null,
  };
}

function matchesStudentAssignmentSearch(item: any, keyword: string) {
  if (!keyword) return true;
  const haystacks = [
    item?.taskTitle,
    item?.taskDescription,
    item?.assignmentTitle,
    item?.assignmentDescription,
    item?.classCode,
    item?.className,
    item?.subject,
    item?.teacher?.fullName,
  ].map((value) => toText(value).toLowerCase());
  return haystacks.some((value) => value.includes(keyword));
}

function matchesStudentAssignmentFilters(item: any, filters: {
  search: string;
  classId: number | null;
  taskType: string;
  dueFromMs: number | null;
  dueToMs: number | null;
  status: string;
}) {
  if (filters.classId && Number(item?.classId || 0) !== filters.classId) return false;
  if (filters.taskType && toText(item?.taskType).toLowerCase() !== filters.taskType) return false;
  if (filters.search && !matchesStudentAssignmentSearch(item, filters.search)) return false;

  const dueAtMs = readDateTimeMs(item?.dueAt);
  if (filters.dueFromMs !== null) {
    if (dueAtMs === null || dueAtMs < filters.dueFromMs) return false;
  }
  if (filters.dueToMs !== null) {
    if (dueAtMs === null || dueAtMs > filters.dueToMs) return false;
  }
  if (filters.status && item?.normalizedStatus !== filters.status) return false;
  return true;
}

function buildAssessmentVisibilitySummary(tasks: any[]) {
  const assessmentTasks = (tasks || []).filter((task: any) => String(task?.taskType || '') === 'assessment');
  if (assessmentTasks.length === 0) return '';
  const labels = assessmentTasks.map((task: any) => {
    const title = toText(task?.title) || 'Bài kiểm tra';
    const settings = normalizeAssessmentSettings(task?.assessmentSettings);
    return `${title}: ${settings.showScoreAfterSubmit !== false ? 'Hiện điểm sau khi nộp' : 'Ẩn điểm sau khi nộp'}`;
  });
  return labels.join(' | ');
}

function mapSubmissionItem(row: any) {
  if (!row?.id) return null;
  return {
    id: Number(row.id),
    type: row.type || 'file',
    order: Number(row.order || 0) || 0,
    caption: row.caption || '',
    contentHtml: row.contentHtml || '',
    url: row.url || '',
    fileAsset: mapFileAsset(row.fileAsset),
  };
}

function mapSubmission(row: any) {
  if (!row?.id) return null;
  return {
    id: Number(row.id),
    version: Number(row.version || 1) || 1,
    status: row.status || 'draft',
    comment: row.comment || '',
    submittedAt: row.submittedAt || null,
    createdBy: mapUserLite(row.createdBy),
    items: Array.isArray(row.items) ? row.items.map(mapSubmissionItem).filter(Boolean) : [],
  };
}

async function loadAssignmentTasks(assignmentId: number, tenantId: number | string) {
  return await strapi.db.query(ASSIGNMENT_TASK_UID).findMany({
    where: mergeTenantWhere({ assignment: { id: { $eq: assignmentId } } }, tenantId),
    orderBy: [{ order: 'asc' }, { id: 'asc' }],
    populate: {
      assessment: { select: ['id', 'documentId', 'code', 'name', 'status'] },
    },
  });
}

async function loadAssignmentProgress(assignmentId: number, tenantId: number | string) {
  return await strapi.db.query(ASSIGNMENT_PROGRESS_UID).findMany({
    where: mergeTenantWhere({ assignmentTask: { assignment: { id: { $eq: assignmentId } } } }, tenantId),
    orderBy: [{ id: 'asc' }],
    populate: {
      learner: { select: ['id', 'code', 'fullName', 'learnerStatus'], populate: { user: { select: ['id', 'username'] } } },
      reviewedBy: { select: ['id', 'username', 'email', 'fullName'] },
      assignmentTask: { select: ['id', 'title', 'taskType', 'required', 'order'] },
    },
  });
}

async function loadAssignmentSubmissions(assignmentId: number, tenantId: number | string) {
  return await strapi.db.query(ASSIGNMENT_SUBMISSION_UID).findMany({
    where: mergeTenantWhere({ assignmentTask: { assignment: { id: { $eq: assignmentId } } } }, tenantId),
    orderBy: [{ version: 'desc' }, { id: 'desc' }],
    populate: {
      learner: { select: ['id', 'code', 'fullName', 'learnerStatus'], populate: { user: { select: ['id', 'username'] } } },
      assignmentTask: { select: ['id', 'title', 'taskType', 'required', 'order'] },
      createdBy: { select: ['id', 'username', 'email', 'fullName'] },
      items: {
        orderBy: [{ order: 'asc' }, { id: 'asc' }],
        populate: {
          fileAsset: { select: ['id', 'code', 'moduleKey', 'originalName', 'fileName', 'mimeType', 'size', 'provider', 'url'] },
        },
      },
    },
  });
}

async function buildAssignmentSummary(row: any, tenantId: number | string) {
  const tasks = await loadAssignmentTasks(Number(row.id), tenantId);
  const progressRows = await synchronizeAssessmentProgressRows(tasks, await loadAssignmentProgress(Number(row.id), tenantId), tenantId);
  const learners = new Set(progressRows.map((item: any) => Number(item?.learner?.id || item?.learner || 0)).filter(Boolean));
  const completedRows = progressRows.filter((item: any) => item?.status === 'completed').length;
  const submittedRows = progressRows.filter((item: any) => item?.status === 'submitted').length;
  const pendingRows = progressRows.filter((item: any) => item?.status === 'assigned' || item?.status === 'missing' || item?.status === 'in_progress' || item?.status === 'returned').length;
  const assessmentVisibilitySummary = buildAssessmentVisibilitySummary(tasks);
  return {
    id: Number(row.id),
    class: row.class ? { id: Number(row.class.id), name: row.class.name || '', subjectCode: row.class.subjectCode || '', subject: row.class.subject || '' } : null,
    classSession: row.classSession ? { id: Number(row.classSession.id), sessionDate: row.classSession.sessionDate || null, startTime: row.classSession.startTime || null, endTime: row.classSession.endTime || null, status: row.classSession.status || 'scheduled' } : null,
    title: row.title || '',
    description: row.description || '',
    dueAt: row.dueAt || null,
    assignedAt: row.assignedAt || null,
    assignedBy: mapUserLite(row.assignedBy),
    status: row.status || 'draft',
    note: row.note || '',
    taskCount: tasks.length,
    learnerCount: learners.size,
    completedCount: completedRows,
    submittedCount: submittedRows,
    pendingCount: pendingRows,
    assessmentVisibilitySummary,
  };
}

async function replaceAssignmentTasks(assignmentId: number, tenantId: number | string, taskItems: any[]) {
  const existingTasks = await loadAssignmentTasks(assignmentId, tenantId);
  for (const task of existingTasks || []) {
    await strapi.db.query(ASSIGNMENT_TASK_UID).delete({ where: { id: task.id } });
  }
  const created = [];
  for (let index = 0; index < taskItems.length; index += 1) {
    const item = await normalizeTaskInput(taskItems[index] || {}, index, tenantId);
    created.push(await strapi.db.query(ASSIGNMENT_TASK_UID).create({
      data: {
        assignment: assignmentId,
        title: item.title,
        description: item.description,
        expectedOutcome: item.expectedOutcome,
        gradingRubric: item.gradingRubric,
        gradingVersion: item.gradingVersion,
        order: item.order,
        required: item.required,
        taskType: item.taskType,
        assessment: item.assessment || null,
        assessmentSettings: item.assessmentSettings,
        tenant: tenantId,
      },
    }));
  }
  return created;
}

async function listEligibleLearnersForAssignment(classSession: any, assignedAtIso: string | null, tenantId: number | string) {
  if (!assignedAtIso) return await getEligibleLearnersForSession(classSession, tenantId);
  const assignedDate = assignedAtIso.slice(0, 10);
  const rows = await strapi.db.query('api::enrollment.enrollment').findMany({
    where: mergeTenantWhere({
      class: { id: { $eq: Number(classSession?.class?.id || classSession?.class || 0) } },
      $and: [
        { $or: [{ joinDate: null }, { joinDate: { $lte: assignedDate } }] },
        { $or: [{ leaveDate: null }, { leaveDate: { $gte: assignedDate } }] },
      ],
    }, tenantId),
    orderBy: [{ joinDate: 'asc' }, { id: 'asc' }],
    populate: {
      learner: {
        select: ['id', 'code', 'fullName', 'learnerStatus'],
        populate: { user: { select: ['id', 'username'] } },
      },
    },
  });
  return (rows || []).filter((row: any) => row?.learner?.id).map((row: any) => ({
    enrollmentId: Number(row.id),
    joinDate: row.joinDate || null,
    leaveDate: row.leaveDate || null,
    enrollmentStatus: row.enrollmentStatus || 'active',
    learner: mapLearnerLite(row.learner),
  }));
}

async function initializeAssignmentProgress(assignmentId: number, tenantId: number | string) {
  const assignment = await findAssignmentOrThrow(assignmentId, tenantId);
  const classSession = await findClassSessionOrThrow(assignment.classSession?.id || assignment.classSession, tenantId);
  const tasks = await loadAssignmentTasks(assignmentId, tenantId);
  const learners = await listEligibleLearnersForAssignment(classSession, assignment.assignedAt || null, tenantId);

  for (const task of tasks || []) {
    for (const learnerRow of learners || []) {
      const learnerId = Number(learnerRow?.learner?.id || 0);
      if (!learnerId) continue;
      const existing = await findProgress(Number(task.id), learnerId, tenantId);
      if (existing?.id) continue;
      await strapi.db.query(ASSIGNMENT_PROGRESS_UID).create({
        data: {
          assignmentTask: Number(task.id),
          learner: learnerId,
          status: 'assigned',
          tenant: tenantId,
        },
      });
    }
  }
}

async function loadTaskProgressRows(taskId: number, tenantId: number | string) {
  return await strapi.db.query(ASSIGNMENT_PROGRESS_UID).findMany({
    where: mergeTenantWhere({ assignmentTask: { id: { $eq: Number(taskId) } } }, tenantId),
    orderBy: [{ id: 'asc' }],
    populate: {
      learner: { select: ['id', 'code', 'fullName', 'learnerStatus'] },
      reviewedBy: { select: ['id', 'username', 'email', 'fullName'] },
      assignmentTask: { select: ['id', 'title', 'taskType', 'required', 'order'] },
    },
  });
}

function summarizeTaskStaleGrading(progressRows: any[], gradingVersion: number) {
  const aiRows = (progressRows || []).filter((row) => hasAiGradingResult(row));
  const staleRows = aiRows.filter((row) => isAiGradingStale(row, gradingVersion));
  const staleUnreviewedRows = staleRows.filter((row) => !row?.reviewedAt);
  const staleReviewedRows = staleRows.filter((row) => Boolean(row?.reviewedAt));
  return {
    aiGradedCount: aiRows.length,
    staleAiCount: staleRows.length,
    staleUnreviewedCount: staleUnreviewedRows.length,
    staleReviewedCount: staleReviewedRows.length,
  };
}

function buildLearnerMatrix(tasks: any[], progressRows: any[], submissionRows: any[]) {
  const learnerMap = new Map<number, any>();
  for (const progress of progressRows || []) {
    const learnerId = Number(progress?.learner?.id || progress?.learner || 0);
    if (!learnerId) continue;
    if (!learnerMap.has(learnerId)) {
      learnerMap.set(learnerId, {
        learner: mapLearnerLite(progress.learner),
        tasks: [],
        completedCount: 0,
        submittedCount: 0,
      });
    }
  }

  const result = [];
  for (const entry of learnerMap.values()) {
    for (const task of tasks || []) {
      const progress = (progressRows || []).find((item: any) => Number(item?.assignmentTask?.id || item?.assignmentTask || 0) === Number(task.id) && Number(item?.learner?.id || item?.learner || 0) === Number(entry.learner.id)) || null;
      const submissions = (submissionRows || []).filter((item: any) => Number(item?.assignmentTask?.id || item?.assignmentTask || 0) === Number(task.id) && Number(item?.learner?.id || item?.learner || 0) === Number(entry.learner.id)).map(mapSubmission).filter(Boolean);
      const taskGradingVersion = normalizeGradingVersion(task?.gradingVersion);
      const aiGradingVersion = parsePositiveInt(progress?.aiGradingVersion) || null;
      if (progress?.status === 'completed') entry.completedCount += 1;
      if (progress?.status === 'submitted') entry.submittedCount += 1;
      entry.tasks.push({
        taskId: Number(task.id),
        taskTitle: toText(task?.title),
        taskType: toText(task?.taskType) || 'todo',
        gradingVersion: taskGradingVersion,
        status: progress?.status || 'assigned',
        score: progress?.score === null || progress?.score === undefined || progress?.score === '' ? null : Number(progress.score),
        maxScore: progress?.maxScore === null || progress?.maxScore === undefined || progress?.maxScore === '' ? null : Number(progress.maxScore),
        teacherFeedback: progress?.teacherFeedback || '',
        aiGradingVersion,
        aiGradedAt: progress?.aiGradedAt || null,
        teacherReviewGradingVersion: parsePositiveInt(progress?.teacherReviewGradingVersion) || null,
        hasAiGrading: hasAiGradingResult(progress),
        aiStale: isAiGradingStale(progress, taskGradingVersion),
        reviewedAt: progress?.reviewedAt || null,
        submissionCount: submissions.length,
        latestSubmission: submissions[0] || null,
      });
    }
    result.push(entry);
  }

  return result;
}

async function buildTeacherAssignmentDetail(assignmentId: number, tenantId: number | string) {
  const assignment = await findAssignmentOrThrow(assignmentId, tenantId);
  const tasks = await loadAssignmentTasks(assignmentId, tenantId);
  const progressRows = await synchronizeAssessmentProgressRows(tasks, await loadAssignmentProgress(assignmentId, tenantId), tenantId);
  const submissionRows = await loadAssignmentSubmissions(assignmentId, tenantId);
  const assessmentVersionMap = await loadAssessmentVersionsByIds(tasks.map((task: any) => extractAssessmentVersionId(task)).filter(Boolean) as number[], tenantId);
  return {
    ...(await buildAssignmentSummary(assignment, tenantId)),
    tasks: tasks.map((row: any) => mapAssignmentTask(row, progressRows, submissionRows, assessmentVersionMap)),
    learners: buildLearnerMatrix(tasks, progressRows, submissionRows),
  };
}

async function ensureAssignmentVisibleToStudent(assignmentId: number, tenantId: number | string, learnerId: number) {
  const assignment = await findAssignmentOrThrow(assignmentId, tenantId);
  if (!['published', 'closed'].includes(String(assignment.status || ''))) throw httpError(404, 'Assignment not found');
  const taskIds = (await loadAssignmentTasks(assignmentId, tenantId)).map((item: any) => Number(item.id)).filter(Boolean);
  const progressRows = taskIds.length > 0
    ? await strapi.db.query(ASSIGNMENT_PROGRESS_UID).findMany({
        where: mergeTenantWhere({ assignmentTask: { id: { $in: taskIds } }, learner: { id: { $eq: learnerId } } }, tenantId),
        populate: { learner: { select: ['id', 'code', 'fullName', 'learnerStatus'] }, reviewedBy: { select: ['id', 'username', 'email', 'fullName'] }, assignmentTask: { select: ['id', 'title', 'taskType', 'required', 'order'] } },
      })
    : [];
  if ((progressRows || []).length === 0) throw httpError(404, 'Assignment not found');
  return { assignment, progressRows };
}

async function loadSubmissionVersionsForLearner(taskId: number, learnerId: number, tenantId: number | string) {
  return await strapi.db.query(ASSIGNMENT_SUBMISSION_UID).findMany({
    where: mergeTenantWhere({ assignmentTask: { id: { $eq: taskId } }, learner: { id: { $eq: learnerId } } }, tenantId),
    orderBy: [{ version: 'desc' }, { id: 'desc' }],
    populate: {
      createdBy: { select: ['id', 'username', 'email', 'fullName'] },
      items: { orderBy: [{ order: 'asc' }, { id: 'asc' }], populate: { fileAsset: { select: ['id', 'code', 'moduleKey', 'originalName', 'fileName', 'mimeType', 'size', 'provider', 'url'] } } },
    },
  });
}

async function findSubmissionVersionForLearner(submissionId: number, learnerId: number, tenantId: number | string) {
  const row = await strapi.db.query(ASSIGNMENT_SUBMISSION_UID).findOne({
    where: mergeTenantWhere({ id: { $eq: submissionId }, learner: { id: { $eq: learnerId } } }, tenantId),
    populate: {
      assignmentTask: {
        select: ['id', 'title', 'taskType', 'required', 'order'],
        populate: {
          assignment: { select: ['id', 'status'] },
        },
      },
      createdBy: { select: ['id', 'username', 'email', 'fullName'] },
      items: { orderBy: [{ order: 'asc' }, { id: 'asc' }], populate: { fileAsset: { select: ['id', 'code', 'moduleKey', 'originalName', 'fileName', 'mimeType', 'size', 'provider', 'url'] } } },
    },
  });
  if (!row?.id) throw httpError(404, 'Submission not found');
  const assignmentId = Number(row?.assignmentTask?.assignment?.id || row?.assignmentTask?.assignment || 0);
  if (!assignmentId) throw httpError(404, 'Submission not found');
  await ensureAssignmentVisibleToStudent(assignmentId, tenantId, learnerId);
  return row;
}

function normalizeUrl(value: unknown, fieldName: string) {
  const text = toText(value);
  if (!text) throw httpError(400, `${fieldName} is required`);
  try {
    const parsed = new URL(text);
    if (!['http:', 'https:'].includes(parsed.protocol)) throw httpError(400, `${fieldName} is invalid`);
    return parsed.toString();
  } catch {
    throw httpError(400, `${fieldName} is invalid`);
  }
}

async function loadFileAssetInTenant(fileAssetRef: unknown, tenantId: number | string) {
  const id = parsePositiveInt(fileAssetRef);
  if (!id) throw httpError(400, 'fileAsset is required');
  const row = await strapi.db.query(FILE_ASSET_UID).findOne({
    where: mergeTenantWhere({ id: { $eq: id }, status: { $eq: 'ACTIVE' }, isDeleted: { $ne: true } }, tenantId),
    select: ['id', 'code', 'moduleKey', 'originalName', 'fileName', 'mimeType', 'size', 'provider', 'url'],
  });
  if (!row?.id) throw httpError(400, `fileAsset ${id} does not belong to current tenant`);
  return row;
}

async function normalizeSubmissionItems(items: any[], tenantId: number | string) {
  const normalized = [];
  const source = Array.isArray(items) ? items : [];
  for (let index = 0; index < source.length; index += 1) {
    const item = source[index] || {};
    const type = normalizeStatus(item?.type, SUBMISSION_ITEM_TYPE_VALUES as Set<any>, 'submission item type');
    const base = {
      type,
      order: Number.isFinite(Number(item?.order)) ? Number(item.order) : index + 1,
      caption: normalizeOptionalText(item?.caption, 255),
      contentHtml: null as string | null,
      url: null as string | null,
      fileAsset: null as any,
    };

    if (type === 'html') {
      base.contentHtml = normalizeHtml(item?.contentHtml);
      if (!base.contentHtml) throw httpError(400, 'contentHtml is required for html submission item');
    } else if (type === 'link') {
      base.url = normalizeUrl(item?.url, 'url');
    } else {
      const fileAssetRef = typeof item?.fileAsset === 'object' && item?.fileAsset
        ? ((item.fileAsset as any).id || item.fileAsset)
        : item?.fileAsset;
      const fileAsset = await loadFileAssetInTenant(fileAssetRef, tenantId);
      const mimeType = String(fileAsset?.mimeType || '').toLowerCase();
      if (type === 'image' && !mimeType.startsWith('image/')) throw httpError(400, 'fileAsset mimeType is invalid for image submission item');
      if (type === 'video' && !mimeType.startsWith('video/')) throw httpError(400, 'fileAsset mimeType is invalid for video submission item');
      if (type === 'audio' && !mimeType.startsWith('audio/')) throw httpError(400, 'fileAsset mimeType is invalid for audio submission item');
      base.fileAsset = fileAsset;
    }

    normalized.push(base);
  }
  return normalized;
}

async function createOrUpdateDraftSubmission(taskId: number, learnerId: number, payload: Record<string, unknown>, tenantId: number | string, createdBy: any, mode: 'draft' | 'submitted') {
  const task = await findTaskOrThrow(taskId, tenantId);
  if (String(task.taskType || '') !== 'submission') throw httpError(400, 'This assignment task does not accept submissions');
  const progress = await ensureProgress(taskId, learnerId, tenantId, 'assigned');
  const submissions = await loadSubmissionVersionsForLearner(taskId, learnerId, tenantId);
  const latest = submissions[0] || null;
  const items = await normalizeSubmissionItems(Array.isArray(payload?.items) ? payload.items as any[] : [], tenantId);
  const comment = normalizeOptionalText(payload?.comment);
  const now = new Date().toISOString();
  const nextStatus = mode === 'submitted' ? 'submitted' : 'draft';

  let submissionId = parsePositiveInt(payload?.submissionId);
  let target = submissionId ? submissions.find((item: any) => Number(item.id) === submissionId) : null;
  if (!target && latest && latest.status === 'draft') {
    target = latest;
  }

  if (target?.id) {
    await strapi.db.query(ASSIGNMENT_SUBMISSION_UID).update({
      where: { id: Number(target.id) },
      data: {
        status: nextStatus,
        comment,
        submittedAt: nextStatus === 'submitted' ? now : null,
      },
    });
    const existingItems = await strapi.db.query(ASSIGNMENT_SUBMISSION_ITEM_UID).findMany({ where: mergeTenantWhere({ assignmentSubmission: { id: { $eq: Number(target.id) } } }, tenantId), select: ['id'] });
    for (const existing of existingItems || []) {
      await strapi.db.query(ASSIGNMENT_SUBMISSION_ITEM_UID).delete({ where: { id: existing.id } });
    }
    for (const item of items) {
      await strapi.db.query(ASSIGNMENT_SUBMISSION_ITEM_UID).create({
        data: {
          assignmentSubmission: Number(target.id),
          type: item.type,
          order: item.order,
          caption: item.caption,
          contentHtml: item.contentHtml,
          url: item.url,
          fileAsset: item.fileAsset?.id || null,
          tenant: tenantId,
        },
      });
    }
    await strapi.db.query(ASSIGNMENT_PROGRESS_UID).update({
      where: { id: Number(progress.id) },
      data: {
        status: nextStatus === 'submitted' ? 'submitted' : (progress.status === 'assigned' ? 'in_progress' : progress.status),
        startedAt: progress.startedAt || now,
        submittedAt: nextStatus === 'submitted' ? now : progress.submittedAt || null,
        completedAt: null,
        tenant: tenantId,
      },
    });
    return await loadSubmissionVersionsForLearner(taskId, learnerId, tenantId);
  }

  const nextVersion = (submissions[0]?.version || 0) + 1;
  const created = await strapi.db.query(ASSIGNMENT_SUBMISSION_UID).create({
    data: {
      assignmentTask: taskId,
      learner: learnerId,
      version: nextVersion,
      status: nextStatus,
      comment,
      submittedAt: nextStatus === 'submitted' ? now : null,
      createdBy: null,
      tenant: tenantId,
    },
  });
  for (const item of items) {
    await strapi.db.query(ASSIGNMENT_SUBMISSION_ITEM_UID).create({
      data: {
        assignmentSubmission: Number(created.id),
        type: item.type,
        order: item.order,
        caption: item.caption,
        contentHtml: item.contentHtml,
        url: item.url,
        fileAsset: item.fileAsset?.id || null,
        tenant: tenantId,
      },
    });
  }
  await strapi.db.query(ASSIGNMENT_PROGRESS_UID).update({
    where: { id: Number(progress.id) },
    data: {
      status: nextStatus === 'submitted' ? 'submitted' : (progress.status === 'assigned' ? 'in_progress' : progress.status),
      startedAt: progress.startedAt || now,
      submittedAt: nextStatus === 'submitted' ? now : progress.submittedAt || null,
      completedAt: null,
      tenant: tenantId,
    },
  });
  return await loadSubmissionVersionsForLearner(taskId, learnerId, tenantId);
}

export async function listTeacherSessionAssignments(sessionRef: unknown, tenantId: number | string, authUser: any) {
  const { session } = await resolveTeacherSession(sessionRef, tenantId, authUser);
  const rows = await strapi.db.query(ASSIGNMENT_UID).findMany({
    where: mergeTenantWhere({ classSession: { id: { $eq: Number(session.id) } } }, tenantId),
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    populate: {
      class: { select: ['id', 'name', 'subjectCode', 'subject'] },
      classSession: { select: ['id', 'sessionDate', 'startTime', 'endTime', 'status'] },
      assignedBy: { select: ['id', 'username', 'email', 'fullName'] },
    },
  });
  const result = [];
  for (const row of rows || []) result.push(await buildAssignmentSummary(row, tenantId));
  return result;
}

export async function createTeacherSessionAssignment(sessionRef: unknown, payload: Record<string, unknown>, tenantId: number | string, authUser: any) {
  const { access, session } = await resolveTeacherSession(sessionRef, tenantId, authUser);
  const title = normalizeRequiredText(payload?.title, 'title', 200);
  const dueAt = normalizeOptionalDateTime(payload?.dueAt, 'dueAt');
  const description = normalizeHtml(payload?.description);
  const note = normalizeOptionalText(payload?.note);
  const tasks = Array.isArray(payload?.tasks) ? payload.tasks as any[] : [];
  if (tasks.length === 0) throw httpError(400, 'tasks is required');

  const created = await strapi.db.query(ASSIGNMENT_UID).create({
    data: {
      class: Number(session.class?.id || session.class),
      classSession: Number(session.id),
      title,
      description,
      assignedBy: access.userId,
      assignedAt: null,
      dueAt,
      status: 'draft',
      note,
      tenant: tenantId,
    },
  });
  await replaceAssignmentTasks(Number(created.id), tenantId, tasks);
  return await buildTeacherAssignmentDetail(Number(created.id), tenantId);
}

export async function updateTeacherAssignment(assignmentRef: unknown, payload: Record<string, unknown>, tenantId: number | string, authUser: any) {
  const { assignment } = await resolveTeacherAssignment(assignmentRef, tenantId, authUser);
  if (String(assignment.status || '') !== 'draft') throw httpError(409, 'Only draft assignment can be edited');
  const title = normalizeRequiredText(payload?.title ?? assignment.title, 'title', 200);
  const dueAt = normalizeOptionalDateTime(payload?.dueAt ?? assignment.dueAt, 'dueAt');
  const description = normalizeHtml(payload?.description ?? assignment.description);
  const note = normalizeOptionalText(payload?.note ?? assignment.note);
  const tasks = Array.isArray(payload?.tasks) ? payload.tasks as any[] : null;
  await strapi.db.query(ASSIGNMENT_UID).update({
    where: { id: Number(assignment.id) },
    data: {
      title,
      dueAt,
      description,
      note,
    },
  });
  if (tasks) await replaceAssignmentTasks(Number(assignment.id), tenantId, tasks);
  return await buildTeacherAssignmentDetail(Number(assignment.id), tenantId);
}

export async function updateTeacherAssignmentTaskGradingDefinition(assignmentRef: unknown, taskRef: unknown, payload: Record<string, unknown>, tenantId: number | string, authUser: any) {
  const { assignment, access } = await resolveTeacherAssignment(assignmentRef, tenantId, authUser);
  if (String(assignment.status || '') !== 'published') throw httpError(409, 'Chỉ cho phép sửa tiêu chí chấm khi assignment đang ở trạng thái published.');

  const task = await findTaskOrThrow(taskRef, tenantId);
  if (Number(task.assignment?.id || task.assignment || 0) !== Number(assignmentRef)) throw httpError(404, 'Assignment task not found');

  const hasExpectedOutcome = Object.prototype.hasOwnProperty.call(payload || {}, 'expectedOutcome');
  const hasGradingRubric = Object.prototype.hasOwnProperty.call(payload || {}, 'gradingRubric');
  if (!hasExpectedOutcome && !hasGradingRubric) {
    throw httpError(400, 'expectedOutcome hoặc gradingRubric là bắt buộc.');
  }

  const prevExpectedOutcome = normalizeHtml(task?.expectedOutcome);
  const prevGradingRubric = normalizeHtml(task?.gradingRubric);
  const nextExpectedOutcome = hasExpectedOutcome ? normalizeHtml(payload?.expectedOutcome) : prevExpectedOutcome;
  const nextGradingRubric = hasGradingRubric ? normalizeHtml(payload?.gradingRubric) : prevGradingRubric;
  const oldGradingVersion = normalizeGradingVersion(task?.gradingVersion);
  const gradingChanged = toText(prevExpectedOutcome) !== toText(nextExpectedOutcome)
    || toText(prevGradingRubric) !== toText(nextGradingRubric);
  const nextGradingVersion = gradingChanged ? oldGradingVersion + 1 : oldGradingVersion;

  await strapi.db.query(ASSIGNMENT_TASK_UID).update({
    where: { id: Number(task.id) },
    data: {
      expectedOutcome: nextExpectedOutcome,
      gradingRubric: nextGradingRubric,
      gradingVersion: nextGradingVersion,
    },
  });

  writeAssignmentTaskGradingAuditLog({
    assignmentId: Number(assignment.id),
    taskId: Number(task.id),
    tenantId,
    oldGradingVersion,
    newGradingVersion: nextGradingVersion,
    gradingChanged,
    authUser: {
      id: access?.userId || authUser?.id || null,
      username: authUser?.username || '',
      email: authUser?.email || '',
      fullName: authUser?.fullName || '',
    },
  });

  const refreshedTask = await findTaskOrThrow(task.id, tenantId);
  const progressRows = await loadTaskProgressRows(Number(task.id), tenantId);
  const staleSummary = summarizeTaskStaleGrading(progressRows, nextGradingVersion);

  return {
    assignmentId: Number(assignment.id),
    task: mapAssignmentTask(refreshedTask, progressRows, [], new Map()),
    gradingVersion: nextGradingVersion,
    oldGradingVersion,
    gradingChanged,
    ...staleSummary,
  };
}

export async function publishTeacherAssignment(assignmentRef: unknown, tenantId: number | string, authUser: any) {
  const { assignment } = await resolveTeacherAssignment(assignmentRef, tenantId, authUser);
  if (String(assignment.status || '') !== 'draft') throw httpError(409, 'Only draft assignment can be published');
  const tasks = await loadAssignmentTasks(Number(assignment.id), tenantId);
  if (!tasks.length) throw httpError(400, 'Assignment must have at least one task before publishing');
  const assignedAt = new Date().toISOString();
  await strapi.db.query(ASSIGNMENT_UID).update({
    where: { id: Number(assignment.id) },
    data: {
      status: 'published',
      assignedAt,
    },
  });
  await initializeAssignmentProgress(Number(assignment.id), tenantId);
  return await buildTeacherAssignmentDetail(Number(assignment.id), tenantId);
}

export async function closeTeacherAssignment(assignmentRef: unknown, tenantId: number | string, authUser: any) {
  const { assignment } = await resolveTeacherAssignment(assignmentRef, tenantId, authUser);
  if (!['published', 'closed'].includes(String(assignment.status || ''))) throw httpError(409, 'Only published assignment can be closed');
  await strapi.db.query(ASSIGNMENT_UID).update({ where: { id: Number(assignment.id) }, data: { status: 'closed' } });
  return await buildTeacherAssignmentDetail(Number(assignment.id), tenantId);
}

export async function cancelTeacherAssignment(assignmentRef: unknown, tenantId: number | string, authUser: any) {
  const { assignment } = await resolveTeacherAssignment(assignmentRef, tenantId, authUser);
  if (String(assignment.status || '') === 'cancelled') return await buildTeacherAssignmentDetail(Number(assignment.id), tenantId);
  await strapi.db.query(ASSIGNMENT_UID).update({ where: { id: Number(assignment.id) }, data: { status: 'cancelled' } });
  return await buildTeacherAssignmentDetail(Number(assignment.id), tenantId);
}

export async function reopenTeacherAssignment(assignmentRef: unknown, tenantId: number | string, authUser: any) {
  const { assignment, access } = await resolveTeacherAssignment(assignmentRef, tenantId, authUser);
  const previousStatus = String(assignment.status || '');
  if (previousStatus !== 'cancelled') throw httpError(409, 'Only cancelled assignment can be reopened');

  const nextStatus = resolveReopenTargetStatus(assignment);
  await strapi.db.query(ASSIGNMENT_UID).update({
    where: { id: Number(assignment.id) },
    data: { status: nextStatus },
  });

  writeAssignmentReopenAuditLog({
    assignmentId: Number(assignment.id),
    tenantId,
    previousStatus,
    nextStatus,
    authUser: {
      id: access?.userId || authUser?.id || null,
      username: authUser?.username || '',
      email: authUser?.email || '',
      fullName: authUser?.fullName || '',
    },
  });

  return await buildTeacherAssignmentDetail(Number(assignment.id), tenantId);
}

export async function getTeacherAssignmentDetail(assignmentRef: unknown, tenantId: number | string, authUser: any) {
  await resolveTeacherAssignment(assignmentRef, tenantId, authUser);
  return await buildTeacherAssignmentDetail(Number(assignmentRef), tenantId);
}

export async function getTeacherAssignmentLearnerTaskDetail(assignmentRef: unknown, taskRef: unknown, learnerRef: unknown, tenantId: number | string, authUser: any) {
  await resolveTeacherAssignment(assignmentRef, tenantId, authUser);
  const task = await findTaskOrThrow(taskRef, tenantId);
  if (Number(task.assignment?.id || task.assignment || 0) !== Number(assignmentRef)) throw httpError(404, 'Assignment task not found');
  const learnerId = parsePositiveInt(learnerRef);
  if (!learnerId) throw httpError(404, 'Learner not found');
  const progress = await findProgress(Number(task.id), learnerId, tenantId);
  if (!progress?.id) throw httpError(404, 'Assignment learner progress not found');
  const submissions = await loadSubmissionVersionsForLearner(Number(task.id), learnerId, tenantId);
  const mappedTask = mapAssignmentTask(task);
  const mappedProgress = mapProgress(progress);
  const currentGradingVersion = normalizeGradingVersion(mappedTask?.gradingVersion);
  const aiStale = isAiGradingStale(mappedProgress, currentGradingVersion);
  return {
    assignmentId: Number(assignmentRef),
    task: mappedTask,
    learner: mapLearnerLite(progress.learner),
    progress: {
      ...mappedProgress,
      aiStale,
      staleReason: aiStale
        ? `AI đã chấm theo tiêu chí cũ (${mappedProgress?.aiGradingVersion ? `v${mappedProgress.aiGradingVersion}` : 'unknown'}) trong khi task hiện tại là v${currentGradingVersion}.`
        : '',
    },
    submissions: submissions.map(mapSubmission).filter(Boolean),
  };
}

function compactTextForAi(value: unknown) {
  const sanitized = sanitizeQuickMessageHtml(toText(value));
  return toText(sanitized)
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeOpenAiModel(value: unknown) {
  return toText(value);
}

async function findPreferredOpenAiAssistantModel(tenantId: number | string) {
  const enabledRows = await strapi.db.query(AI_ASSISTANT_UID).findMany({
    where: mergeTenantWhere({ enabled: true, provider: { $eq: 'OPENAI' } }, tenantId),
    orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
    limit: 1,
    select: ['id', 'model'],
  });
  const enabledModel = normalizeOpenAiModel(enabledRows?.[0]?.model);
  if (enabledModel) return enabledModel;

  const anyRows = await strapi.db.query(AI_ASSISTANT_UID).findMany({
    where: mergeTenantWhere({ provider: { $eq: 'OPENAI' } }, tenantId),
    orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
    limit: 1,
    select: ['id', 'model'],
  });
  return normalizeOpenAiModel(anyRows?.[0]?.model);
}

async function resolveAutoGradeOpenAiModel(tenantId: number | string) {
  const tenantModel = await findPreferredOpenAiAssistantModel(tenantId);
  const envOpenAiModel = normalizeOpenAiModel(process.env.OPENAI_MODEL);
  const envDefaultModel = normalizeOpenAiModel(process.env.OPENAI_DEFAULT_MODEL);
  const candidates = [tenantModel, envOpenAiModel, envDefaultModel, AUTO_GRADE_FALLBACK_MODEL];
  for (const candidate of candidates) {
    if (!candidate) continue;
    if (DEPRECATED_OPENAI_MODELS.has(candidate)) continue;
    return candidate;
  }
  return AUTO_GRADE_FALLBACK_MODEL;
}

function parseAutoGradeJson(content: string, expectedMaxScore: number) {
  let parsed: any = null;
  try {
    parsed = JSON.parse(content);
  } catch {
    const match = content.match(/\{[\s\S]*\}/);
    if (!match) {
      throw httpError(502, 'OpenAI trả về dữ liệu không đúng JSON cho auto-grade. Vui lòng thử lại.');
    }
    try {
      parsed = JSON.parse(match[0]);
    } catch {
      throw httpError(502, 'OpenAI trả về JSON không hợp lệ cho auto-grade. Vui lòng thử lại.');
    }
  }

  const score = Number(parsed?.score);
  const providedMaxScore = parsed?.maxScore === null || parsed?.maxScore === undefined || parsed?.maxScore === '' ? null : Number(parsed.maxScore);
  const teacherFeedback = toText(parsed?.teacherFeedback);
  if (!Number.isFinite(score)) {
    throw httpError(502, 'OpenAI trả về score không hợp lệ cho auto-grade.');
  }
  if (!Number.isFinite(expectedMaxScore) || expectedMaxScore <= 0) {
    throw httpError(500, 'Server maxScore không hợp lệ cho auto-grade.');
  }
  if (providedMaxScore !== null && (!Number.isFinite(providedMaxScore) || providedMaxScore <= 0)) {
    throw httpError(502, 'OpenAI trả về maxScore không hợp lệ cho auto-grade.');
  }
  if (providedMaxScore !== null && Math.abs(providedMaxScore - expectedMaxScore) > 1e-9) {
    throw httpError(502, 'OpenAI trả về maxScore không khớp với maxScore hệ thống.');
  }
  if (score < 0 || score > expectedMaxScore) {
    throw httpError(502, 'OpenAI trả về score ngoài phạm vi 0..maxScore cho auto-grade.');
  }
  if (!teacherFeedback) {
    throw httpError(502, 'OpenAI chưa trả về teacherFeedback hợp lệ cho auto-grade.');
  }

  return {
    score,
    maxScore: expectedMaxScore,
    teacherFeedback,
  };
}

async function callOpenAiForAssignmentAutoGrade(input: {
  tenantId: number | string;
  assignmentTitle: string;
  taskTitle: string;
  taskInstruction: string;
  expectedOutcome: string;
  gradingRubric: string;
  learnerName: string;
  submissionText: string;
  maxScore: number;
}) {
  const apiKey = toText(process.env.OPENAI_API_KEY);
  if (!apiKey) {
    throw httpError(503, 'OPENAI_API_KEY chưa được cấu hình trên server để chấm tự động.');
  }

  const model = await resolveAutoGradeOpenAiModel(input.tenantId);
  const safeMaxScore = Number.isFinite(Number(input.maxScore)) && Number(input.maxScore) > 0 ? Number(input.maxScore) : 10;
  const safeInstruction = compactTextForAi(input.taskInstruction);
  const safeExpectedOutcome = compactTextForAi(input.expectedOutcome);
  const safeGradingRubric = compactTextForAi(input.gradingRubric);
  const prompt = [
    'Bạn là giáo viên chấm bài tự động cho bài tập học sinh.',
    'Hãy đọc kỹ yêu cầu task, expected outcome, grading rubric và nội dung học sinh nộp để chấm điểm.',
    'Trả về JSON duy nhất theo schema sau:',
    '{"score": 0, "maxScore": 10, "teacherFeedback": "string"}',
    'Quy tắc:',
    '- score phải là số nguyên hoặc số thập phân hợp lệ trong khoảng từ 0 đến maxScore',
    '- maxScore phải bằng đúng giá trị được cung cấp từ hệ thống',
    '- teacherFeedback phải là nhận xét ngắn, rõ ràng, tiếng Việt, có thể nhấn mạnh điểm mạnh và điểm cần cải thiện',
    '- Chấm dựa trên task instruction, expected outcome và grading rubric.',
    '- Nếu grading rubric đã đủ tiêu chí thì không tự tạo thêm tiêu chí mới.',
    '- Không trừ điểm chỉ để tạo ra góp ý.',
    '- Nếu bài đáp ứng đầy đủ yêu cầu và không có lỗi đáng kể thì có thể cho điểm tối đa.',
    '- Góp ý cải thiện không đồng nghĩa bắt buộc phải trừ điểm.',
    '- Chấp nhận cách trình bày khác nếu vẫn đạt expected outcome.',
    '- Chỉ đánh giá nội dung học sinh thực sự nộp.',
    '- Nếu có Blockly XML, hãy phân tích cấu trúc khối lệnh, luồng xử lý, điều kiện và phép tính trước khi chấm điểm.',
    '- Nếu không đủ dữ liệu để chấm thì phản ánh rõ trong teacherFeedback, không bịa dữ kiện.',
    '- Do not reduce the score merely to make the feedback more critical.',
    '- If the submission fully satisfies the expected outcome and grading rubric, award full credit.',
    '- Chỉ trả về JSON, không thêm text ngoài JSON.',
    '',
    `TASK TITLE:\n${input.taskTitle || 'Task'}`,
    `ASSIGNMENT TITLE:\n${input.assignmentTitle || 'Bài tập'}`,
    `STUDENT INSTRUCTION:\n${safeInstruction || 'Không có hướng dẫn.'}`,
    `EXPECTED OUTCOME:\n${safeExpectedOutcome || 'Không có expected outcome.'}`,
    `GRADING RUBRIC:\n${safeGradingRubric || 'Không có grading rubric.'}`,
    `MAX SCORE:\n${safeMaxScore}`,
    `STUDENT:\n${input.learnerName || 'Học sinh'}`,
    `STUDENT SUBMISSION:\n${input.submissionText || 'Không có nội dung bài làm.'}`,
  ].join('\n');

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      temperature: 0.2,
      max_tokens: 300,
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content: [
            'Bạn là trợ lý chấm bài cho giáo viên.',
            'Chỉ trả về JSON hợp lệ đúng schema yêu cầu.',
            'Không tự thay đổi maxScore, luôn giữ maxScore bằng giá trị hệ thống cung cấp.',
          ].join(' '),
        },
        { role: 'user', content: prompt },
      ],
    }),
  });

  if (!response.ok) {
    const responseText = await response.text().catch(() => '');
    throw httpError(502, `OpenAI chấm tự động thất bại: ${responseText || response.statusText || 'unknown error'}`);
  }

  const payload: any = await response.json();
  const content = toText(payload?.choices?.[0]?.message?.content);
  if (!content) {
    throw httpError(502, 'OpenAI không trả về nội dung chấm điểm hợp lệ.');
  }

  const parsed = parseAutoGradeJson(content, safeMaxScore);
  return {
    ...parsed,
    model,
  };
}

export async function autoGradeTeacherAssignmentTask(assignmentRef: unknown, taskRef: unknown, learnerRef: unknown, tenantId: number | string, authUser: any) {
  const { assignment } = await resolveTeacherAssignment(assignmentRef, tenantId, authUser);
  const task = await findTaskOrThrow(taskRef, tenantId);
  if (Number(task.assignment?.id || task.assignment || 0) !== Number(assignmentRef)) throw httpError(404, 'Assignment task not found');
  if (String(task.taskType || '') !== 'submission') throw httpError(400, 'Chấm tự động chỉ áp dụng cho task nộp bài.');

  const learnerId = parsePositiveInt(learnerRef);
  if (!learnerId) throw httpError(404, 'Learner not found');

  const progress = await findProgress(Number(task.id), learnerId, tenantId);
  if (!progress?.id) throw httpError(404, 'Assignment learner progress not found');

  const submissions = await loadSubmissionVersionsForLearner(Number(task.id), learnerId, tenantId);
  const latestSubmission = submissions[0] || null;
  if (!latestSubmission?.id) throw httpError(400, 'Không có submission nào để chấm tự động.');

  if (progress?.status === 'completed' && (progress?.score !== null && progress?.score !== undefined)) {
    throw httpError(409, 'Task này đã được chấm, không thể chấm tự động lại trừ khi giáo viên muốn cập nhật bằng review mới.');
  }

  let submissionText = '';
  try {
    submissionText = await buildSubmissionSnapshotForAutoGrade(latestSubmission, {
      logger: strapi.log,
      context: {
        assignmentId: Number(assignmentRef),
        taskId: Number(task.id),
        learnerId,
        submissionId: Number(latestSubmission.id),
      },
    });
  } catch (error) {
    const mappedError = mapSubmissionExtractionError(error);
    strapi.log.warn(`[assignment-workspace:auto-grade] submission extract failed assignment=${Number(assignmentRef)} task=${Number(task.id)} learner=${learnerId} submission=${Number(latestSubmission.id)} code=${toText((mappedError as any)?.code)} status=${Number((mappedError as any)?.status || 0)} message=${mappedError.message}`);
    throw mappedError;
  }
  if (!submissionText) throw httpError(400, 'Submission không có nội dung để chấm tự động.');
  const configuredMaxScore = Number(progress?.maxScore);
  const systemMaxScore = Number.isFinite(configuredMaxScore) && configuredMaxScore > 0 ? configuredMaxScore : 10;

  const proposal = await callOpenAiForAssignmentAutoGrade({
    tenantId,
    assignmentTitle: toText(assignment?.title || ''),
    taskTitle: toText(task?.title || ''),
    taskInstruction: toText(task?.description || ''),
    expectedOutcome: toText(task?.expectedOutcome || ''),
    gradingRubric: toText(task?.gradingRubric || ''),
    learnerName: toText(progress?.learner?.fullName || progress?.learner?.code || ''),
    submissionText,
    maxScore: systemMaxScore,
  });
  const currentTaskGradingVersion = normalizeGradingVersion(task?.gradingVersion);
  const aiGradedAt = new Date().toISOString();
  await strapi.db.query(ASSIGNMENT_PROGRESS_UID).update({
    where: { id: Number(progress.id) },
    data: {
      aiSuggestedScore: Number(proposal.score),
      aiSuggestedMaxScore: Number(proposal.maxScore),
      aiSuggestedFeedback: normalizeHtml(proposal.teacherFeedback) || proposal.teacherFeedback,
      aiGradingVersion: currentTaskGradingVersion,
      aiGradedAt,
      aiModel: toText(proposal.model).slice(0, 120) || null,
    },
  });
  const updatedProgress = await findProgress(Number(task.id), learnerId, tenantId);

  return {
    assignmentId: Number(assignmentRef),
    task: mapAssignmentTask(task),
    learner: mapLearnerLite(progress.learner),
    progress: mapProgress(updatedProgress || progress),
    submission: mapSubmission(latestSubmission),
    proposal: {
      score: Number(proposal.score),
      maxScore: Number(proposal.maxScore),
      teacherFeedback: normalizeHtml(proposal.teacherFeedback) || proposal.teacherFeedback,
      gradingVersion: currentTaskGradingVersion,
      model: toText(proposal.model),
      source: 'openai',
      generatedAt: aiGradedAt,
    },
  };
}

export async function batchRegradeStaleUnreviewedTeacherAssignmentTask(assignmentRef: unknown, taskRef: unknown, tenantId: number | string, authUser: any) {
  const { assignment } = await resolveTeacherAssignment(assignmentRef, tenantId, authUser);
  if (!['published', 'closed'].includes(String(assignment.status || ''))) {
    throw httpError(409, 'Chỉ hỗ trợ chấm lại khi assignment ở trạng thái published hoặc closed.');
  }
  const task = await findTaskOrThrow(taskRef, tenantId);
  if (Number(task.assignment?.id || task.assignment || 0) !== Number(assignmentRef)) throw httpError(404, 'Assignment task not found');
  if (String(task.taskType || '') !== 'submission') throw httpError(400, 'Chỉ hỗ trợ chấm lại cho task nộp bài.');

  const gradingVersion = normalizeGradingVersion(task?.gradingVersion);
  const progressRows = await loadTaskProgressRows(Number(task.id), tenantId);
  const candidates = (progressRows || []).filter((row) =>
    String(row?.status || '') === 'submitted'
    && !row?.reviewedAt
    && hasAiGradingResult(row)
    && isAiGradingStale(row, gradingVersion)
    && parsePositiveInt(row?.learner?.id || row?.learner)
  );

  const failures: Array<{ learnerId: number; learnerCode: string; reason: string }> = [];
  let regradedCount = 0;

  for (const row of candidates) {
    const learnerId = parsePositiveInt(row?.learner?.id || row?.learner);
    if (!learnerId) continue;
    try {
      await autoGradeTeacherAssignmentTask(assignmentRef, taskRef, learnerId, tenantId, authUser);
      regradedCount += 1;
    } catch (error: any) {
      failures.push({
        learnerId,
        learnerCode: toText(row?.learner?.code || row?.learner?.fullName || learnerId),
        reason: error?.message || 'Unknown error',
      });
    }
  }

  const refreshedTask = await findTaskOrThrow(task.id, tenantId);
  const refreshedRows = await loadTaskProgressRows(Number(task.id), tenantId);
  const staleSummary = summarizeTaskStaleGrading(refreshedRows, normalizeGradingVersion(refreshedTask?.gradingVersion));

  return {
    assignmentId: Number(assignmentRef),
    taskId: Number(task.id),
    gradingVersion: normalizeGradingVersion(refreshedTask?.gradingVersion),
    totalCandidates: candidates.length,
    regradedCount,
    failedCount: failures.length,
    failures: failures.slice(0, 20),
    ...staleSummary,
  };
}

export async function reviewTeacherAssignmentTask(assignmentRef: unknown, taskRef: unknown, learnerRef: unknown, payload: Record<string, unknown>, tenantId: number | string, authUser: any) {
  const { access } = await resolveTeacherAssignment(assignmentRef, tenantId, authUser);
  const task = await findTaskOrThrow(taskRef, tenantId);
  if (Number(task.assignment?.id || task.assignment || 0) !== Number(assignmentRef)) throw httpError(404, 'Assignment task not found');
  const learnerId = parsePositiveInt(learnerRef);
  if (!learnerId) throw httpError(404, 'Learner not found');
  const progress = await findProgress(Number(task.id), learnerId, tenantId);
  if (!progress?.id) throw httpError(404, 'Assignment learner progress not found');
  const nextStatus = normalizeStatus(payload?.status, new Set(['completed', 'returned']) as Set<any>, 'status');
  const score = payload?.score === null || payload?.score === undefined || payload?.score === '' ? null : Number(payload.score);
  const maxScore = payload?.maxScore === null || payload?.maxScore === undefined || payload?.maxScore === '' ? null : Number(payload.maxScore);
  if (score !== null && !Number.isFinite(score)) throw httpError(400, 'score is invalid');
  if (maxScore !== null && !Number.isFinite(maxScore)) throw httpError(400, 'maxScore is invalid');
  const currentGradingVersion = normalizeGradingVersion(task?.gradingVersion);
  const staleAiDetected = isAiGradingStale(progress, currentGradingVersion);
  const allowStaleReview = payload?.confirmStaleAiReview === true;
  if (staleAiDetected && !allowStaleReview) {
    throw httpError(409, `AI proposal hiện tại được chấm theo tiêu chí cũ (v${parsePositiveInt(progress?.aiGradingVersion) || 1}), trong khi task đang ở v${currentGradingVersion}. Vui lòng chấm lại theo tiêu chí mới hoặc xác nhận tiếp tục lưu review.`);
  }
  const teacherFeedback = normalizeHtml(payload?.teacherFeedback) || null;
  const reviewedAt = new Date().toISOString();
  await strapi.db.query(ASSIGNMENT_PROGRESS_UID).update({
    where: { id: Number(progress.id) },
    data: {
      status: nextStatus,
      completedAt: nextStatus === 'completed' ? reviewedAt : null,
      teacherFeedback,
      reviewedBy: access.userId,
      reviewedAt,
      teacherReviewGradingVersion: currentGradingVersion,
      score,
      maxScore,
    },
  });
  if (String(task.taskType || '') === 'submission') {
    const submissionId = parsePositiveInt(payload?.submissionId);
    const submissions = await loadSubmissionVersionsForLearner(Number(task.id), learnerId, tenantId);
    const target = submissionId
      ? submissions.find((item: any) => Number(item.id) === submissionId)
      : submissions[0];
    if (target?.id) {
      await strapi.db.query(ASSIGNMENT_SUBMISSION_UID).update({
        where: { id: Number(target.id) },
        data: {
          status: nextStatus === 'completed' ? 'accepted' : 'returned',
        },
      });
    }
  }
  return await getTeacherAssignmentLearnerTaskDetail(assignmentRef, taskRef, learnerId, tenantId, authUser);
}

export async function listStudentSessionAssignments(sessionRef: unknown, query: Record<string, unknown>, tenantId: number | string, authUser: any) {
  const resolved = await resolveStudentContext(query, tenantId, authUser);
  const learner = requireStudentLearner(resolved);
  const session = await findClassSessionOrThrow(sessionRef, tenantId);
  const rows = await strapi.db.query(ASSIGNMENT_UID).findMany({
    where: mergeTenantWhere({ classSession: { id: { $eq: Number(session.id) } }, status: { $in: ['published', 'closed'] } }, tenantId),
    orderBy: [{ assignedAt: 'desc' }, { id: 'desc' }],
    populate: {
      class: { select: ['id', 'name', 'subjectCode', 'subject'] },
      classSession: { select: ['id', 'sessionDate', 'startTime', 'endTime', 'status'] },
      assignedBy: { select: ['id', 'username', 'email', 'fullName'] },
    },
  });
  const result = [];
  for (const row of rows || []) {
    const tasks = await loadAssignmentTasks(Number(row.id), tenantId);
    const progressRows = await strapi.db.query(ASSIGNMENT_PROGRESS_UID).findMany({
      where: mergeTenantWhere({ assignmentTask: { assignment: { id: { $eq: Number(row.id) } } }, learner: { id: { $eq: Number(learner.id) } } }, tenantId),
      populate: { assignmentTask: { select: ['id'] }, learner: { select: ['id', 'code', 'fullName', 'learnerStatus'] }, reviewedBy: { select: ['id', 'username', 'email', 'fullName'] } },
    });
    if (!progressRows.length) continue;
    result.push({
      ...(await buildAssignmentSummary(row, tenantId)),
      totalTaskCount: tasks.length,
      completedTaskCount: progressRows.filter((item: any) => item?.status === 'completed').length,
      myProgressState: progressRows.some((item: any) => item?.status === 'returned')
        ? 'returned'
        : progressRows.every((item: any) => item?.status === 'completed')
          ? 'completed'
          : progressRows.some((item: any) => item?.status === 'submitted')
            ? 'submitted'
            : progressRows.some((item: any) => item?.status === 'in_progress')
              ? 'in_progress'
              : 'assigned',
    });
  }
  return result;
}

export async function listStudentAssignments(query: Record<string, unknown>, tenantId: number | string, authUser: any) {
  const resolved = await resolveStudentContext(query, tenantId, authUser);
  const learner = requireStudentLearner(resolved);
  const page = Math.max(1, Number(query?.page || 1) || 1);
  const pageSize = Math.max(1, Math.min(50, Number(query?.pageSize || 10) || 10));
  const classId = parsePositiveInt(query?.classId);
  const taskType = toText(query?.taskType).toLowerCase();
  const rawStatus = toText(query?.status).toLowerCase();
  const status = rawStatus === 'all' ? '' : (rawStatus ? normalizeStatus(rawStatus, STUDENT_ASSIGNMENT_STATUS_VALUES as Set<any>, 'status') : '');
  const search = toText(query?.search).toLowerCase();
  const dueFromMs = readDateTimeMs(normalizeOptionalDate(query?.dueFrom, 'dueFrom', 'start'));
  const dueToMs = readDateTimeMs(normalizeOptionalDate(query?.dueTo, 'dueTo', 'end'));
  if (taskType && !TASK_TYPE_VALUES.has(taskType as any)) throw httpError(400, 'taskType is invalid');

  const progressRows = await strapi.db.query(ASSIGNMENT_PROGRESS_UID).findMany({
    where: mergeTenantWhere({
      learner: { id: { $eq: Number(learner.id) } },
      assignmentTask: {
        assignment: {
          status: { $in: ['published', 'closed'] },
        },
      },
    }, tenantId),
    orderBy: [{ id: 'desc' }],
    populate: {
      learner: { select: ['id', 'code', 'fullName', 'learnerStatus'] },
      reviewedBy: { select: ['id', 'username', 'email', 'fullName'] },
      assignmentTask: {
        select: ['id', 'title', 'description', 'taskType', 'required', 'order', 'assessmentSettings'],
        populate: {
          assessment: { select: ['id', 'documentId', 'code', 'name', 'status'] },
          assignment: {
            select: ['id', 'title', 'description', 'status', 'note', 'assignedAt', 'dueAt'],
            populate: {
              class: { select: ['id', 'name', 'subjectCode', 'subject'] },
              classSession: {
                select: ['id', 'sessionDate', 'startTime', 'endTime', 'status'],
                populate: {
                  teacher: { select: ['id', 'username', 'email', 'fullName'] },
                },
              },
              assignedBy: { select: ['id', 'username', 'email', 'fullName'] },
            },
          },
        },
      },
    },
  });

  const progressRowsByAssignmentId = new Map<number, any[]>();
  const taskRowsByAssignmentId = new Map<number, any[]>();
  for (const row of progressRows || []) {
    const task = row?.assignmentTask;
    const assignmentId = Number(task?.assignment?.id || task?.assignment || 0);
    if (!assignmentId || !task?.id) continue;
    if (!progressRowsByAssignmentId.has(assignmentId)) progressRowsByAssignmentId.set(assignmentId, []);
    if (!taskRowsByAssignmentId.has(assignmentId)) taskRowsByAssignmentId.set(assignmentId, []);
    progressRowsByAssignmentId.get(assignmentId)?.push(row);
    taskRowsByAssignmentId.get(assignmentId)?.push(task);
  }

  for (const [assignmentId, rows] of progressRowsByAssignmentId.entries()) {
    await synchronizeAssessmentProgressRows(taskRowsByAssignmentId.get(assignmentId) || [], rows, tenantId);
  }

  const taskIds = (progressRows || []).map((row: any) => Number(row?.assignmentTask?.id || 0)).filter(Boolean);
  const submissions = taskIds.length > 0
    ? await strapi.db.query(ASSIGNMENT_SUBMISSION_UID).findMany({
        where: mergeTenantWhere({
          assignmentTask: { id: { $in: taskIds } },
          learner: { id: { $eq: Number(learner.id) } },
        }, tenantId),
        orderBy: [{ version: 'desc' }, { id: 'desc' }],
        populate: {
          assignmentTask: { select: ['id'] },
        },
      })
    : [];
  const latestSubmissionByTaskId = new Map<number, any>();
  for (const submission of submissions || []) {
    const taskId = Number(submission?.assignmentTask?.id || submission?.assignmentTask || 0);
    if (!taskId || latestSubmissionByTaskId.has(taskId)) continue;
    latestSubmissionByTaskId.set(taskId, submission);
  }

  const assessmentTaskSourceRefs = (progressRows || [])
    .map((row: any) => {
      const task = row?.assignmentTask;
      if (toText(task?.taskType).toLowerCase() !== 'assessment') return '';
      return buildAssignmentAssessmentSourceRef(Number(task?.id || 0), Number(learner.id));
    })
    .filter(Boolean);
  const attempts = await listAssessmentAttemptsBySourceRefs(assessmentTaskSourceRefs, tenantId);
  const latestAttemptBySourceRef = new Map<string, any>();
  for (const attempt of attempts || []) {
    const sourceRef = toText(attempt?.sourceRef);
    if (!sourceRef || latestAttemptBySourceRef.has(sourceRef)) continue;
    latestAttemptBySourceRef.set(sourceRef, attempt);
  }

  const nowMs = Date.now();
  const allRows = (progressRows || []).map((row: any) => {
    const task = row?.assignmentTask;
    if (!task?.id || !task?.assignment?.id) return null;
    const sourceRef = toText(task?.taskType).toLowerCase() === 'assessment'
      ? buildAssignmentAssessmentSourceRef(Number(task.id), Number(learner.id))
      : '';
    return mapStudentAssignmentListItem(
      task,
      row,
      latestSubmissionByTaskId.get(Number(task.id)) || null,
      sourceRef ? latestAttemptBySourceRef.get(sourceRef) || null : null,
      nowMs,
    );
  }).filter(Boolean);

  const baseFilteredRows = allRows.filter((item: any) => matchesStudentAssignmentFilters(item, {
    search,
    classId,
    taskType,
    dueFromMs,
    dueToMs,
    status: '',
  }));
  const summary = buildStudentAssignmentSummaryMeta(baseFilteredRows);
  const filteredRows = baseFilteredRows
    .filter((item: any) => matchesStudentAssignmentFilters(item, {
      search,
      classId,
      taskType,
      dueFromMs,
      dueToMs,
      status,
    }))
    .sort((left: any, right: any) => compareStudentAssignmentTaskRows(left, right, status));

  const total = filteredRows.length;
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const currentPage = Math.min(page, pageCount);
  const start = (currentPage - 1) * pageSize;

  return {
    data: filteredRows.slice(start, start + pageSize),
    meta: {
      pagination: {
        page: currentPage,
        pageSize,
        pageCount,
        total,
      },
      summary,
      serverNow: new Date(nowMs).toISOString(),
    },
  };
}

export async function getStudentAssignmentDetail(assignmentRef: unknown, query: Record<string, unknown>, tenantId: number | string, authUser: any) {
  const resolved = await resolveStudentContext(query, tenantId, authUser);
  const learner = requireStudentLearner(resolved);
  const { assignment, progressRows } = await ensureAssignmentVisibleToStudent(Number(assignmentRef), tenantId, Number(learner.id));
  const tasks = await loadAssignmentTasks(Number(assignment.id), tenantId);
  const syncedProgressRows = await synchronizeAssessmentProgressRows(tasks, progressRows, tenantId);
  const taskIds = tasks.map((item: any) => Number(item.id)).filter(Boolean);
  const assessmentVersionMap = await loadAssessmentVersionsByIds(tasks.map((task: any) => extractAssessmentVersionId(task)).filter(Boolean) as number[], tenantId);
  const submissions = taskIds.length > 0
    ? await strapi.db.query(ASSIGNMENT_SUBMISSION_UID).findMany({
        where: mergeTenantWhere({ assignmentTask: { id: { $in: taskIds } }, learner: { id: { $eq: Number(learner.id) } } }, tenantId),
        orderBy: [{ version: 'desc' }, { id: 'desc' }],
        populate: {
          createdBy: { select: ['id', 'username', 'email', 'fullName'] },
          assignmentTask: { select: ['id', 'title', 'taskType', 'required', 'order'] },
          items: { orderBy: [{ order: 'asc' }, { id: 'asc' }], populate: { fileAsset: { select: ['id', 'code', 'moduleKey', 'originalName', 'fileName', 'mimeType', 'size', 'provider', 'url'] } } },
        },
      })
    : [];
  return {
    ...(await buildAssignmentSummary(assignment, tenantId)),
    learner,
    tasks: tasks.map((task: any) => {
      const myProgress = syncedProgressRows.find((item: any) => Number(item?.assignmentTask?.id || item?.assignmentTask || 0) === Number(task.id)) || null;
      const mySubmissions = submissions.filter((item: any) => Number(item?.assignmentTask?.id || item?.assignmentTask || 0) === Number(task.id)).map(mapSubmission).filter(Boolean);
      return {
        ...stripLearnerOnlyTask(mapAssignmentTask(task, syncedProgressRows, submissions, assessmentVersionMap)),
        myProgress: mapProgressForStudent(myProgress, { showScoreAfterSubmit: normalizeAssessmentSettings(task?.assessmentSettings).showScoreAfterSubmit !== false }),
        submissions: mySubmissions,
      };
    }),
  };
}

export async function getStudentAssignmentTaskDetail(taskRef: unknown, query: Record<string, unknown>, tenantId: number | string, authUser: any) {
  const resolved = await resolveStudentContext(query, tenantId, authUser);
  requireStudentLearner(resolved);
  const task = await findTaskOrThrow(taskRef, tenantId);
  const assignmentId = Number(task.assignment?.id || task.assignment || 0);
  if (!assignmentId) throw httpError(404, 'Assignment task not found');

  const detail = await getStudentAssignmentDetail(assignmentId, query, tenantId, authUser);
  const selectedTask = (detail?.tasks || []).find((item: any) => Number(item?.id || 0) === Number(task.id)) || null;
  if (!selectedTask?.id) throw httpError(404, 'Assignment task not found');

  return {
    learner: detail.learner,
    assignment: {
      id: detail.id,
      title: detail.title,
      description: detail.description,
      dueAt: detail.dueAt,
      assignedAt: detail.assignedAt,
      assignedBy: detail.assignedBy,
      status: detail.status,
      note: detail.note,
      taskCount: detail.taskCount,
      completedCount: detail.completedCount,
      class: detail.class,
      classSession: detail.classSession,
    },
    task: selectedTask,
  };
}

export async function getStudentSubmissionVersionDetail(submissionRef: unknown, query: Record<string, unknown>, tenantId: number | string, authUser: any) {
  const resolved = await resolveStudentContext(query, tenantId, authUser);
  const learner = requireStudentLearner(resolved);
  const submissionId = parsePositiveInt(submissionRef);
  if (!submissionId) throw httpError(404, 'Submission not found');
  const row = await findSubmissionVersionForLearner(submissionId, Number(learner.id), tenantId);
  return {
    learner,
    task: stripLearnerOnlyTask(mapAssignmentTask(row.assignmentTask)),
    submission: mapSubmission(row),
  };
}

async function listAvailableAssessmentTaskOptions(query: Record<string, unknown>, tenantId: number | string) {
  const page = Math.max(1, Number(query?.page || 1) || 1);
  const pageSize = Math.max(1, Math.min(20, Number(query?.pageSize || 10) || 10));
  const start = (page - 1) * pageSize;
  const q = toText(query?.q || query?.search);
  const where = mergeTenantWhere({
    status: { $eq: 'active' },
    ...(q ? {
      $or: [
        { code: { $containsi: q } },
        { name: { $containsi: q } },
      ],
    } : {}),
  }, tenantId);

  const [rows, total] = await Promise.all([
    strapi.db.query(ASSESSMENT_UID).findMany({
      where,
      offset: start,
      limit: pageSize,
      orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
      populate: {
        versions: {
          select: ['id', 'documentId', 'code', 'title', 'version', 'versionStatus', 'durationMinutes'],
          orderBy: [{ version: 'desc' }, { id: 'desc' }],
          populate: {
            sections: {
              select: ['id'],
              populate: {
                questions: { select: ['id'] },
              },
            },
          },
        },
      },
    }),
    strapi.db.query(ASSESSMENT_UID).count({ where }),
  ]);

  const items = (rows || []).map((row: any) => {
    const versions = Array.isArray(row?.versions) ? row.versions : [];
    const version = versions.find((item: any) => String(item?.versionStatus || '') === 'published' && parsePositiveInt(item?.durationMinutes));
    if (!version?.id) return null;
    return {
      id: Number(row.id),
      documentId: row.documentId || null,
      code: row.code || '',
      title: row.name || '',
      status: row.status || 'draft',
      assessmentVersion: {
        id: Number(version.id),
        documentId: version.documentId || null,
        code: version.code || '',
        title: version.title || '',
        version: Number(version.version || 0) || 0,
        versionStatus: version.versionStatus || 'draft',
        durationMinutes: Number(version.durationMinutes || 0) || 0,
        questionCount: summarizeVersionQuestions(version),
      },
    };
  }).filter(Boolean);

  return {
    data: items,
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

export async function listTeacherSessionAssessmentOptions(sessionRef: unknown, query: Record<string, unknown>, tenantId: number | string, authUser: any) {
  await resolveTeacherSession(sessionRef, tenantId, authUser);
  return listAvailableAssessmentTaskOptions(query, tenantId);
}

export async function listTeacherAssignmentAssessmentOptions(assignmentRef: unknown, query: Record<string, unknown>, tenantId: number | string, authUser: any) {
  await resolveTeacherAssignment(assignmentRef, tenantId, authUser);
  return listAvailableAssessmentTaskOptions(query, tenantId);
}

async function startTeacherAssessmentPreviewAttemptInternal(versionRef: unknown, tenantId: number | string, userId: number) {
  const assessmentVersionId = parsePositiveInt(versionRef);
  if (!assessmentVersionId) throw httpError(400, 'assessmentVersionId is required');
  const runtime = await startAssessmentAttempt(assessmentVersionId, {
    sourceType: 'admin_test',
    resumeExisting: false,
    sourceRef: `assignment-preview:${userId}:${assessmentVersionId}:${Date.now()}`,
  }, tenantId, {
    authUserId: userId,
    allowManagerAccess: true,
  });
  const attemptRef = toText(runtime?.attempt?.id || runtime?.attempt?.documentId);
  if (!attemptRef) throw httpError(500, 'Preview attempt started but no attempt id was returned');
  return {
    attempt: {
      id: attemptRef,
      status: runtime?.attempt?.status || 'in_progress',
    },
    runnerPath: `/assessment-runner/${encodeURIComponent(attemptRef)}`,
  };
}

export async function startTeacherSessionAssessmentPreviewAttempt(sessionRef: unknown, payload: Record<string, unknown>, tenantId: number | string, authUser: any) {
  const { access } = await resolveTeacherSession(sessionRef, tenantId, authUser);
  return startTeacherAssessmentPreviewAttemptInternal(payload?.assessmentVersionId, tenantId, Number(access.userId));
}

export async function startTeacherAssignmentAssessmentPreviewAttempt(assignmentRef: unknown, payload: Record<string, unknown>, tenantId: number | string, authUser: any) {
  const { access } = await resolveTeacherAssignment(assignmentRef, tenantId, authUser);
  return startTeacherAssessmentPreviewAttemptInternal(payload?.assessmentVersionId, tenantId, Number(access.userId));
}

export async function startStudentAssessmentTaskAttempt(taskRef: unknown, query: Record<string, unknown>, tenantId: number | string, authUser: any) {
  const resolved = await resolveStudentContext(query, tenantId, authUser);
  const learner = requireStudentLearner(resolved);
  const task = await findTaskOrThrow(taskRef, tenantId);
  if (String(task?.taskType || '') !== 'assessment') throw httpError(400, 'Only assessment tasks support assessment attempt launch');

  const { assignment, progressRows } = await ensureAssignmentVisibleToStudent(Number(task.assignment?.id || task.assignment || 0), tenantId, Number(learner.id));
  const taskProgress = (progressRows || []).find((item: any) => Number(item?.assignmentTask?.id || item?.assignmentTask || 0) === Number(task.id)) || await ensureProgress(Number(task.id), Number(learner.id), tenantId, 'assigned');
  const assessmentSettings = normalizeAssessmentSettings(task?.assessmentSettings);
  const assessmentVersionId = parsePositiveInt(assessmentSettings.assessmentVersionId);
  if (!assessmentVersionId) throw httpError(409, 'Assessment task is missing assessment version');

  const sourceRef = buildAssignmentAssessmentSourceRef(Number(task.id), Number(learner.id));
  const attempts = await listAssessmentAttemptsBySourceRefs([sourceRef], tenantId);
  const latestAttempt = (attempts || []).find((item: any) => Number(item?.learner?.id || 0) === Number(learner.id)) || null;
  const maxAttempts = Math.max(1, Number(assessmentSettings.maxAttempts || DEFAULT_ASSESSMENT_SETTINGS.maxAttempts) || DEFAULT_ASSESSMENT_SETTINGS.maxAttempts);
  const attemptCount = (attempts || []).filter((item: any) => Number(item?.learner?.id || 0) === Number(learner.id)).length;
  const latestAttemptRef = toText(latestAttempt?.id || latestAttempt?.documentId);
  const latestAttemptStatus = toText(latestAttempt?.status);

  if (latestAttemptRef && (latestAttemptStatus === 'created' || latestAttemptStatus === 'in_progress')) {
    await strapi.db.query(ASSIGNMENT_PROGRESS_UID).update({
      where: { id: Number(taskProgress.id) },
      data: {
        status: 'in_progress',
        startedAt: latestAttempt?.startedAt || taskProgress?.startedAt || new Date().toISOString(),
      },
    });
    return {
      assignmentId: Number(assignment.id),
      taskId: Number(task.id),
      learnerId: Number(learner.id),
      attempt: {
        id: latestAttemptRef,
        status: latestAttempt.status || 'in_progress',
      },
      runnerPath: `/assessment-runner/${encodeURIComponent(latestAttemptRef)}`,
      resultPath: `/assessment-runner/${encodeURIComponent(latestAttemptRef)}/result`,
      reused: true,
      showScoreAfterSubmit: assessmentSettings.showScoreAfterSubmit !== false,
    };
  }

  if (latestAttemptRef && ASSESSMENT_ATTEMPT_TERMINAL_STATUSES.has(latestAttemptStatus) && assessmentSettings.showScoreAfterSubmit !== false) {
    return {
      assignmentId: Number(assignment.id),
      taskId: Number(task.id),
      learnerId: Number(learner.id),
      attempt: {
        id: latestAttemptRef,
        status: latestAttempt.status || 'submitted',
      },
      runnerPath: `/assessment-runner/${encodeURIComponent(latestAttemptRef)}`,
      resultPath: `/assessment-runner/${encodeURIComponent(latestAttemptRef)}/result`,
      reused: true,
      resultAvailable: true,
      showScoreAfterSubmit: true,
    };
  }

  if (attemptCount >= maxAttempts && latestAttemptRef) {
    return {
      assignmentId: Number(assignment.id),
      taskId: Number(task.id),
      learnerId: Number(learner.id),
      attempt: {
        id: latestAttemptRef,
        status: latestAttempt.status || 'submitted',
      },
      runnerPath: `/assessment-runner/${encodeURIComponent(latestAttemptRef)}`,
      resultPath: `/assessment-runner/${encodeURIComponent(latestAttemptRef)}/result`,
      reused: true,
      maxAttemptsReached: true,
      showScoreAfterSubmit: assessmentSettings.showScoreAfterSubmit !== false,
    };
  }

  const runtime = await startAssessmentAttempt(assessmentVersionId, {
    learner: Number(learner.id),
    sourceType: 'learner',
    sourceRef,
    resumeExisting: true,
  }, tenantId, { authUserId: authUser?.id || null });

  const attemptRef = toText(runtime?.attempt?.id || runtime?.attempt?.documentId);
  if (!attemptRef) throw httpError(500, 'Assessment attempt started but no attempt id was returned');

  await strapi.db.query(ASSIGNMENT_PROGRESS_UID).update({
    where: { id: Number(taskProgress.id) },
    data: {
      status: 'in_progress',
      startedAt: runtime?.attempt?.startedAt || new Date().toISOString(),
    },
  });

  return {
    assignmentId: Number(assignment.id),
    taskId: Number(task.id),
    learnerId: Number(learner.id),
    attempt: {
      id: attemptRef,
      status: runtime?.attempt?.status || 'in_progress',
    },
    runnerPath: `/assessment-runner/${encodeURIComponent(attemptRef)}`,
    resultPath: `/assessment-runner/${encodeURIComponent(attemptRef)}/result`,
    reused: false,
    showScoreAfterSubmit: assessmentSettings.showScoreAfterSubmit !== false,
  };
}

export async function updateStudentTodoProgress(taskRef: unknown, query: Record<string, unknown>, payload: Record<string, unknown>, tenantId: number | string, authUser: any) {
  const resolved = await resolveStudentContext(query, tenantId, authUser);
  const learner = requireStudentLearner(resolved);
  const task = await findTaskOrThrow(taskRef, tenantId);
  if (!['published', 'closed'].includes(String(task.assignment?.status || ''))) throw httpError(404, 'Assignment task not found');
  const progress = await ensureProgress(Number(task.id), Number(learner.id), tenantId, 'assigned');
  const nextStatus = normalizeStatus(payload?.status, new Set(['in_progress', 'completed']) as Set<any>, 'status');
  if (String(task.taskType || '') !== 'todo') throw httpError(400, 'Only todo tasks support direct progress update');
  const now = new Date().toISOString();
  await strapi.db.query(ASSIGNMENT_PROGRESS_UID).update({
    where: { id: Number(progress.id) },
    data: {
      status: nextStatus,
      startedAt: progress.startedAt || now,
      completedAt: nextStatus === 'completed' ? now : null,
      submittedAt: null,
    },
  });
  return await getStudentAssignmentDetail(Number(task.assignment?.id || task.assignment || 0), query, tenantId, authUser);
}

export async function saveStudentAssignmentSubmission(taskRef: unknown, query: Record<string, unknown>, payload: Record<string, unknown>, tenantId: number | string, authUser: any, mode: 'draft' | 'submitted') {
  const resolved = await resolveStudentContext(query, tenantId, authUser);
  const learner = requireStudentLearner(resolved);
  const task = await findTaskOrThrow(taskRef, tenantId);
  const assignmentId = Number(task.assignment?.id || task.assignment || 0);
  await ensureAssignmentVisibleToStudent(assignmentId, tenantId, Number(learner.id));
  await createOrUpdateDraftSubmission(Number(task.id), Number(learner.id), payload, tenantId, authUser, mode);
  return await getStudentAssignmentDetail(assignmentId, query, tenantId, authUser);
}

export async function uploadStudentAssignmentFile(taskRef: unknown, query: Record<string, unknown>, file: any, tenant: { id?: number | string; code?: string | null; storageDefaultConfigId?: number | string | null }, authUser: any) {
  const tenantId = Number(tenant?.id || 0);
  if (!tenantId) throw httpError(400, 'Tenant context is required');

  const resolved = await resolveStudentContext(query, tenantId, authUser);
  const learner = requireStudentLearner(resolved);
  const task = await findTaskOrThrow(taskRef, tenantId);
  const assignmentId = Number(task.assignment?.id || task.assignment || 0);
  await ensureAssignmentVisibleToStudent(assignmentId, tenantId, Number(learner.id));

  if (!file || typeof file !== 'object') throw httpError(400, 'file is required');

  const uploaded = await storageService.uploadLocalFile({
    tenant,
    file,
    moduleKey: 'assignment-submission',
    entityType: 'assignment-task',
    entityId: String(task.id),
    uploadedBy: authUser?.id || null,
    isPublic: false,
    metadata: {
      assignmentId,
      assignmentTaskId: Number(task.id),
      learnerId: Number(learner.id),
    },
  });

  return mapFileAsset(uploaded);
}

export function getAssignmentWorkspaceErrorStatus(error: any, fallback = 400) {
  const status = Number(error?.status || error?.statusCode || 0);
  if (Number.isInteger(status) && status > 0) return status;
  const message = String(error?.message || '').toLowerCase();
  if (message.includes('not found')) return 404;
  if (message.includes('forbidden')) return 403;
  if (message.includes('conflict')) return 409;
  return fallback;
}