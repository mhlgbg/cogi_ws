import { extractRelationRef, findEntityByRef, mergeTenantWhere, normalizeSortInput, resolveCurrentTenantId, toText, whereByParam } from '../../../utils/tenant-scope';

const ASSESSMENT_UID = 'api::assessment.assessment';
const ASSESSMENT_VERSION_UID = 'api::assessment-version.assessment-version';
const ASSESSMENT_SECTION_UID = 'api::assessment-section.assessment-section';
const ASSESSMENT_QUESTION_UID = 'api::assessment-question.assessment-question';
const ASSESSMENT_SPEAKING_CRITERION_UID = 'api::assessment-speaking-criterion.assessment-speaking-criterion';
const ASSESSMENT_CAMPAIGN_RULE_UID = 'api::assessment-campaign-rule.assessment-campaign-rule';
const ASSESSMENT_ATTEMPT_UID = 'api::assessment-attempt.assessment-attempt';
const QUESTION_UID = 'api::question.question';
const QUESTION_STIMULUS_UID = 'api::question-stimulus.question-stimulus';
const QUESTION_OPTION_UID = 'api::question-option.question-option';
const SUBJECT_UID = 'api::subject.subject';
const SKILL_UID = 'api::skill.skill';
const TENANT_UID = 'api::tenant.tenant';

const CEFR_LEVELS = ['PRE_A1', 'A1', 'A2', 'B1', 'B2', 'C1', 'C2'] as const;
type CefrLevel = (typeof CEFR_LEVELS)[number];

class AssessmentManagementError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

function extractBody(body: any) {
  if (body?.data && typeof body.data === 'object' && !Array.isArray(body.data)) return body.data;
  if (body && typeof body === 'object' && !Array.isArray(body)) return body;
  return {};
}

function normalizeId(row: any) {
  return row?.documentId || row?.id;
}

function toNullableText(value: unknown): string | null {
  const text = toText(value);
  return text || null;
}

function ensureRequiredText(value: unknown, fieldName: string) {
  const text = toText(value);
  if (!text) {
    throw new AssessmentManagementError(400, `${fieldName} is required`);
  }
  return text;
}

function parseOptionalInteger(value: unknown, fieldName: string): number | null {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(value);
  if (!Number.isInteger(parsed)) throw new AssessmentManagementError(400, `${fieldName} must be an integer`);
  return parsed;
}

function parseRequiredInteger(value: unknown, fieldName: string): number {
  const parsed = parseOptionalInteger(value, fieldName);
  if (parsed === null) throw new AssessmentManagementError(400, `${fieldName} is required`);
  return parsed;
}

function parseOptionalDecimal(value: unknown, fieldName: string): number | null {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) throw new AssessmentManagementError(400, `${fieldName} must be a valid number`);
  return parsed;
}

function parseBoolean(value: unknown, fallback = false): boolean {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value !== 0;
  const text = toText(value).toLowerCase();
  if (!text) return fallback;
  return ['true', '1', 'yes', 'on'].includes(text);
}

function parseJsonField(value: unknown, fieldName: string) {
  if (value === undefined) return undefined;
  if (value === null || value === '') return null;
  if (typeof value === 'object') return value;
  const text = toText(value);
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    throw new AssessmentManagementError(400, `${fieldName} must be valid JSON`);
  }
}

function compareCefrLevel(from: CefrLevel | null, to: CefrLevel | null) {
  if (!from || !to) return 0;
  return CEFR_LEVELS.indexOf(from) - CEFR_LEVELS.indexOf(to);
}

function validateCefrValue(value: unknown, fieldName: string): CefrLevel | null {
  const text = toText(value).toUpperCase();
  if (!text) return null;
  if (!CEFR_LEVELS.includes(text as CefrLevel)) {
    throw new AssessmentManagementError(400, `${fieldName} is invalid`);
  }
  return text as CefrLevel;
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

function getFileAssetResponse(row: any) {
  if (!row) return null;
  return {
    id: normalizeId(row),
    documentId: row?.documentId || null,
    code: row?.code || '',
    moduleKey: row?.moduleKey || '',
    originalName: row?.originalName || '',
    fileName: row?.fileName || '',
    extension: row?.extension || '',
    mimeType: row?.mimeType || '',
    size: row?.size || null,
    provider: row?.provider || '',
    relativePath: row?.relativePath || '',
    url: row?.url || '',
    status: row?.status || '',
    isPublic: row?.isPublic !== false,
  };
}

function mapQuestionOption(row: any) {
  return {
    id: normalizeId(row),
    documentId: row?.documentId || null,
    label: row?.label || '',
    value: row?.value || '',
    content: row?.content || '',
    imageAsset: getFileAssetResponse(row?.imageAsset),
    isCorrect: row?.isCorrect === true,
    order: Number(row?.order || 0),
    explanation: row?.explanation || '',
  };
}

function mapQuestionStimulus(row: any) {
  if (!row) return null;
  return {
    id: normalizeId(row),
    documentId: row?.documentId || null,
    code: row?.code || '',
    title: row?.title || '',
    type: row?.type || '',
    instruction: row?.instruction || '',
    content: row?.content || '',
    audioAsset: getFileAssetResponse(row?.audioAsset),
    imageAsset: getFileAssetResponse(row?.imageAsset),
    stimulusStatus: row?.stimulusStatus || 'draft',
  };
}

function mapQuestion(row: any) {
  return {
    id: normalizeId(row),
    documentId: row?.documentId || null,
    code: row?.code || '',
    title: row?.title || '',
    questionText: row?.questionText || '',
    type: row?.type || '',
    difficulty: row?.difficulty || '',
    correctAnswer: row?.correctAnswer ?? null,
    explanation: row?.explanation || '',
    rubric: row?.rubric ?? null,
    questionStatus: row?.questionStatus || 'draft',
    subject: mapSimpleRelation(row?.subject),
    grade: mapSimpleRelation(row?.grade),
    knowledgeNode: mapSimpleRelation(row?.knowledgeNode),
    skills: Array.isArray(row?.skills) ? row.skills.map(mapSimpleRelation) : [],
    formulas: Array.isArray(row?.formulas) ? row.formulas.map(mapSimpleRelation) : [],
    stimulus: mapQuestionStimulus(row?.stimulus),
    options: Array.isArray(row?.options) ? row.options.map(mapQuestionOption) : [],
  };
}

function mapAssessmentQuestion(row: any) {
  return {
    id: normalizeId(row),
    documentId: row?.documentId || null,
    createdAt: row?.createdAt || null,
    order: Number(row?.order || 0),
    points: row?.points ?? 1,
    required: row?.required !== false,
    audioPlayLimit: row?.audioPlayLimit ?? null,
    allowSeek: row?.allowSeek !== false,
    minWords: row?.minWords ?? null,
    maxWords: row?.maxWords ?? null,
    config: row?.config ?? null,
    question: mapQuestion(row?.question),
  };
}

function mapAssessmentSection(row: any) {
  return {
    id: normalizeId(row),
    documentId: row?.documentId || null,
    code: row?.code || '',
    title: row?.title || '',
    description: row?.description || '',
    instruction: row?.instruction || '',
    order: Number(row?.order || 0),
    skill: mapSimpleRelation(row?.skill),
    assessmentQuestions: Array.isArray(row?.questions) ? row.questions.map(mapAssessmentQuestion) : [],
  };
}

function mapAssessmentSpeakingCriterion(row: any) {
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

function mapAssessmentVersion(row: any, options: { includeSections?: boolean } = {}) {
  return {
    id: normalizeId(row),
    documentId: row?.documentId || null,
    code: row?.code || '',
    version: Number(row?.version || 0),
    title: row?.title || '',
    description: row?.description || '',
    versionStatus: row?.versionStatus || 'draft',
    durationMinutes: row?.durationMinutes ?? null,
    gradeFrom: row?.gradeFrom ?? null,
    gradeTo: row?.gradeTo ?? null,
    candidateLevelFrom: row?.candidateLevelFrom || null,
    candidateLevelTo: row?.candidateLevelTo || null,
    resultMode: row?.resultMode || 'provisional',
    requiresSpeaking: row?.requiresSpeaking !== false,
    requiresTeacherConfirmation: row?.requiresTeacherConfirmation !== false,
    ceilingLevel: row?.ceilingLevel || null,
    instructions: row?.instructions || '',
    assessment: mapSimpleRelation(row?.assessment),
    speakingCriteria: Array.isArray(row?.speakingCriteria) ? row.speakingCriteria.map(mapAssessmentSpeakingCriterion) : undefined,
    sections: options.includeSections && Array.isArray(row?.sections) ? row.sections.map(mapAssessmentSection) : undefined,
  };
}

function getSectionAssessmentQuestions(section: any) {
  if (Array.isArray(section?.assessmentQuestions)) return section.assessmentQuestions;
  if (Array.isArray(section?.questions)) return section.questions;
  return [];
}

function summarizeAssessmentSections(sections: any[]) {
  return (Array.isArray(sections) ? sections : []).reduce((result, section) => {
    const assessmentQuestions = getSectionAssessmentQuestions(section);
    const totalPoints = assessmentQuestions.reduce((sum: number, item: any) => sum + Number(item?.points || 0), 0);
    return {
      totalSections: result.totalSections + 1,
      totalQuestions: result.totalQuestions + assessmentQuestions.length,
      totalPoints: result.totalPoints + totalPoints,
    };
  }, { totalSections: 0, totalQuestions: 0, totalPoints: 0 });
}

function mapAssessment(row: any, options: { includeVersions?: boolean } = {}) {
  return {
    id: normalizeId(row),
    documentId: row?.documentId || null,
    code: row?.code || '',
    name: row?.name || '',
    description: row?.description || '',
    assessmentType: row?.assessmentType || 'placement',
    status: row?.status || 'draft',
    subject: mapSimpleRelation(row?.subject),
    versions: options.includeVersions && Array.isArray(row?.versions)
      ? row.versions.map((item: any) => mapAssessmentVersion(item))
      : undefined,
  };
}

function toConnectRelation(ref: unknown) {
  const relationRef = extractRelationRef(ref);
  if (relationRef === null || relationRef === undefined || relationRef === '') return null;
  return { connect: [relationRef] };
}

async function ensureEntityInTenant(uid: string, ref: unknown, tenantId: number | string, label: string) {
  if (ref === null || ref === undefined || ref === '') return null;
  const entity = await findEntityByRef(uid, ref, {
    tenant: { select: ['id', 'documentId'] },
  });
  if (!entity) throw new AssessmentManagementError(400, `${label} is invalid`);
  const entityTenantRef = extractRelationRef(entity?.tenant);
  if (String(entityTenantRef || '') !== String(tenantId)) {
    throw new AssessmentManagementError(403, `${label} does not belong to current tenant`);
  }
  return entity;
}

async function ensureAssessmentCodeUnique(code: string, tenantId: number | string, existingId?: number | null) {
  const duplicate = await strapi.db.query(ASSESSMENT_UID).findOne({
    where: mergeTenantWhere({ code: { $eq: code } }, tenantId),
    select: ['id'],
  });
  if (duplicate?.id && Number(duplicate.id) !== Number(existingId || 0)) {
    throw new AssessmentManagementError(409, 'Assessment code already exists in this tenant');
  }
}

async function ensureAssessmentVersionCodeUnique(code: string, tenantId: number | string, existingId?: number | null) {
  const duplicate = await strapi.db.query(ASSESSMENT_VERSION_UID).findOne({
    where: mergeTenantWhere({ code: { $eq: code } }, tenantId),
    select: ['id'],
  });
  if (duplicate?.id && Number(duplicate.id) !== Number(existingId || 0)) {
    throw new AssessmentManagementError(409, 'Assessment Version code already exists in this tenant');
  }
}

async function ensureAssessmentVersionNumberUnique(assessmentId: number, version: number, tenantId: number | string, existingId?: number | null) {
  const duplicate = await strapi.db.query(ASSESSMENT_VERSION_UID).findOne({
    where: mergeTenantWhere({
      assessment: { id: { $eq: assessmentId } },
      version: { $eq: version },
    }, tenantId),
    select: ['id'],
  });
  if (duplicate?.id && Number(duplicate.id) !== Number(existingId || 0)) {
    throw new AssessmentManagementError(409, 'Assessment version number already exists for this assessment');
  }
}

async function ensureSectionCodeUnique(assessmentVersionId: number, code: string, tenantId: number | string, existingId?: number | null) {
  const duplicate = await strapi.db.query(ASSESSMENT_SECTION_UID).findOne({
    where: mergeTenantWhere({
      assessmentVersion: { id: { $eq: assessmentVersionId } },
      code: { $eq: code },
    }, tenantId),
    select: ['id'],
  });
  if (duplicate?.id && Number(duplicate.id) !== Number(existingId || 0)) {
    throw new AssessmentManagementError(409, 'Assessment Section code already exists in this version');
  }
}

async function ensureAssessmentQuestionUnique(sectionId: number, questionId: number, tenantId: number | string, existingId?: number | null) {
  const section = await findAssessmentSectionOrThrow(sectionId, tenantId, { includeQuestions: true });
  const assessmentQuestions = Array.isArray(section?.questions) ? section.questions : [];
  const duplicate = assessmentQuestions.find((item: any) => {
    const currentId = Number(item?.id || 0);
    const linkedQuestionId = Number(extractRelationRef(item?.question) || item?.question?.id || 0);
    if (!Number.isInteger(linkedQuestionId) || linkedQuestionId <= 0) return false;
    if (currentId && currentId === Number(existingId || 0)) return false;
    return linkedQuestionId === Number(questionId);
  });
  if (duplicate?.id) {
    throw new AssessmentManagementError(409, 'Question is already assigned to this section');
  }
}

async function ensureSpeakingCriterionCodeUnique(assessmentVersionId: number, code: string, tenantId: number | string, existingId?: number | null) {
  const duplicate = await strapi.db.query(ASSESSMENT_SPEAKING_CRITERION_UID).findOne({
    where: mergeTenantWhere({
      assessmentVersion: { id: { $eq: assessmentVersionId } },
      code: { $eq: code },
    }, tenantId),
    select: ['id'],
  });
  if (duplicate?.id && Number(duplicate.id) !== Number(existingId || 0)) {
    throw new AssessmentManagementError(409, 'Speaking criterion code already exists in this assessment version');
  }
}

async function findAssessmentOrThrow(id: unknown, tenantId: number | string, options: { includeVersions?: boolean } = {}) {
  const where = whereByParam(id);
  if (!where) throw new AssessmentManagementError(400, 'Assessment id is invalid');
  const row = await strapi.db.query(ASSESSMENT_UID).findOne({
    where: mergeTenantWhere(where, tenantId),
    populate: {
      subject: { select: ['id', 'documentId', 'code', 'title'] },
      versions: options.includeVersions ? {
        select: ['id', 'documentId', 'code', 'version', 'title', 'versionStatus', 'durationMinutes', 'gradeFrom', 'gradeTo', 'candidateLevelFrom', 'candidateLevelTo', 'resultMode', 'requiresSpeaking', 'requiresTeacherConfirmation', 'ceilingLevel'],
        orderBy: [{ version: 'desc' }, { id: 'desc' }],
        populate: {
          sections: {
            select: ['id'],
            populate: {
              questions: { select: ['id'] },
            },
          },
        },
      } : undefined,
    },
  });
  if (!row) throw new AssessmentManagementError(404, 'Assessment not found');
  return row;
}

function getAssessmentVersionDetailPopulate() {
  return {
    assessment: { select: ['id', 'documentId', 'code', 'name', 'assessmentType', 'status'] },
    speakingCriteria: {
      select: ['id', 'documentId', 'code', 'label', 'description', 'guidance', 'order', 'maxScore', 'weight', 'required', 'status'],
      orderBy: [{ order: 'asc' }, { id: 'asc' }],
    },
    sections: {
      populate: {
        skill: { select: ['id', 'documentId', 'code', 'title'] },
        questions: {
          populate: {
            question: {
              populate: {
                subject: { select: ['id', 'documentId', 'code', 'title'] },
                grade: { select: ['id', 'documentId', 'code', 'title'] },
                knowledgeNode: { select: ['id', 'documentId', 'code', 'title'] },
                skills: { select: ['id', 'documentId', 'code', 'title'] },
                formulas: { select: ['id', 'documentId', 'code', 'title'] },
                stimulus: {
                  populate: {
                    audioAsset: { select: ['id', 'documentId', 'code', 'moduleKey', 'originalName', 'fileName', 'mimeType', 'url', 'relativePath', 'provider', 'status', 'isPublic'] },
                    imageAsset: { select: ['id', 'documentId', 'code', 'moduleKey', 'originalName', 'fileName', 'mimeType', 'url', 'relativePath', 'provider', 'status', 'isPublic'] },
                  },
                },
                options: {
                  populate: {
                    imageAsset: { select: ['id', 'documentId', 'code', 'moduleKey', 'originalName', 'fileName', 'mimeType', 'url', 'relativePath', 'provider', 'status', 'isPublic'] },
                  },
                },
              },
            },
          },
          orderBy: [{ order: 'asc' }, { id: 'asc' }],
        },
      },
      orderBy: [{ order: 'asc' }, { id: 'asc' }],
    },
  };
}

async function findAssessmentVersionOrThrow(id: unknown, tenantId: number | string, options: { includeSections?: boolean } = {}) {
  const where = whereByParam(id);
  if (!where) throw new AssessmentManagementError(400, 'Assessment Version id is invalid');
  const row = await strapi.db.query(ASSESSMENT_VERSION_UID).findOne({
    where: mergeTenantWhere(where, tenantId),
    populate: options.includeSections ? getAssessmentVersionDetailPopulate() : {
      assessment: { select: ['id', 'documentId', 'code', 'name'] },
    },
  });
  if (!row) throw new AssessmentManagementError(404, 'Assessment Version not found');
  return row;
}

async function findAssessmentSectionOrThrow(id: unknown, tenantId: number | string, options: { includeQuestions?: boolean } = {}) {
  const where = whereByParam(id);
  if (!where) throw new AssessmentManagementError(400, 'Assessment Section id is invalid');
  const row = await strapi.db.query(ASSESSMENT_SECTION_UID).findOne({
    where: mergeTenantWhere(where, tenantId),
    populate: {
      skill: { select: ['id', 'documentId', 'code', 'title'] },
      assessmentVersion: { select: ['id', 'documentId', 'code', 'versionStatus'] },
      questions: options.includeQuestions ? {
        populate: {
          question: {
            select: ['id', 'documentId', 'code', 'title', 'questionText', 'type', 'questionStatus'],
          },
        },
      } : undefined,
    },
  });
  if (!row) throw new AssessmentManagementError(404, 'Assessment Section not found');
  return row;
}

async function findAssessmentSpeakingCriterionOrThrow(id: unknown, tenantId: number | string) {
  const where = whereByParam(id);
  if (!where) throw new AssessmentManagementError(400, 'Assessment Speaking Criterion id is invalid');
  const row = await strapi.db.query(ASSESSMENT_SPEAKING_CRITERION_UID).findOne({
    where: mergeTenantWhere(where, tenantId),
    populate: {
      assessmentVersion: { select: ['id', 'documentId', 'code', 'versionStatus', 'requiresSpeaking'] },
    },
  });
  if (!row) throw new AssessmentManagementError(404, 'Assessment Speaking Criterion not found');
  return row;
}

async function findAssessmentQuestionOrThrow(id: unknown, tenantId: number | string) {
  const where = whereByParam(id);
  if (!where) throw new AssessmentManagementError(400, 'Assessment Question id is invalid');
  const row = await strapi.db.query(ASSESSMENT_QUESTION_UID).findOne({
    where: mergeTenantWhere(where, tenantId),
    populate: {
      section: {
        populate: {
          assessmentVersion: { select: ['id', 'documentId', 'versionStatus'] },
        },
      },
      question: { select: ['id', 'documentId', 'code', 'title', 'type', 'questionStatus'] },
    },
  });
  if (!row) throw new AssessmentManagementError(404, 'Assessment Question not found');
  return row;
}

function ensureVersionDraft(version: any) {
  if (toText(version?.versionStatus) !== 'draft') {
    throw new AssessmentManagementError(409, 'Only draft assessment versions can be structurally modified');
  }
}

function validateVersionRange(data: any) {
  const gradeFrom = data?.gradeFrom ?? null;
  const gradeTo = data?.gradeTo ?? null;
  if (gradeFrom !== null && gradeTo !== null && Number(gradeFrom) > Number(gradeTo)) {
    throw new AssessmentManagementError(400, 'gradeFrom must be less than or equal to gradeTo');
  }
  const candidateLevelFrom = data?.candidateLevelFrom || null;
  const candidateLevelTo = data?.candidateLevelTo || null;
  if (candidateLevelFrom && candidateLevelTo && compareCefrLevel(candidateLevelFrom, candidateLevelTo) > 0) {
    throw new AssessmentManagementError(400, 'candidateLevelFrom must be less than or equal to candidateLevelTo');
  }
}

function validateAssessmentQuestionConfig(data: any) {
  const minWords = data?.minWords ?? null;
  const maxWords = data?.maxWords ?? null;
  if (minWords !== null && maxWords !== null && Number(minWords) > Number(maxWords)) {
    throw new AssessmentManagementError(400, 'minWords must be less than or equal to maxWords');
  }
  const audioPlayLimit = data?.audioPlayLimit ?? null;
  if (audioPlayLimit !== null && Number(audioPlayLimit) < 1) {
    throw new AssessmentManagementError(400, 'audioPlayLimit must be greater than or equal to 1');
  }
}

async function sanitizeAssessmentPayload(body: any, tenantId: number | string, existing?: any) {
  const payload = extractBody(body);
  const subject = await ensureEntityInTenant(SUBJECT_UID, payload.subject ?? existing?.subject, tenantId, 'subject');
  return {
    code: ensureRequiredText(payload.code ?? existing?.code, 'code'),
    name: ensureRequiredText(payload.name ?? existing?.name, 'name'),
    description: toNullableText(payload.description ?? existing?.description),
    assessmentType: toText(payload.assessmentType ?? existing?.assessmentType) || 'placement',
    status: toText(payload.status ?? existing?.status) || 'draft',
    subject: subject ? subject.id : null,
    tenant: tenantId,
  };
}

async function sanitizeAssessmentVersionPayload(body: any, tenantId: number | string, existing?: any) {
  const payload = extractBody(body);
  const assessment = await ensureEntityInTenant(ASSESSMENT_UID, payload.assessment ?? existing?.assessment, tenantId, 'assessment');
  const data = {
    code: ensureRequiredText(payload.code ?? existing?.code, 'code'),
    version: parseRequiredInteger(payload.version ?? existing?.version, 'version'),
    title: ensureRequiredText(payload.title ?? existing?.title, 'title'),
    description: toNullableText(payload.description ?? existing?.description),
    assessment: assessment ? assessment.id : null,
    versionStatus: toText(payload.versionStatus ?? existing?.versionStatus) || 'draft',
    durationMinutes: parseOptionalInteger(payload.durationMinutes ?? existing?.durationMinutes, 'durationMinutes'),
    gradeFrom: parseOptionalInteger(payload.gradeFrom ?? existing?.gradeFrom, 'gradeFrom'),
    gradeTo: parseOptionalInteger(payload.gradeTo ?? existing?.gradeTo, 'gradeTo'),
    candidateLevelFrom: validateCefrValue(payload.candidateLevelFrom ?? existing?.candidateLevelFrom, 'candidateLevelFrom'),
    candidateLevelTo: validateCefrValue(payload.candidateLevelTo ?? existing?.candidateLevelTo, 'candidateLevelTo'),
    resultMode: toText(payload.resultMode ?? existing?.resultMode) || 'provisional',
    requiresSpeaking: parseBoolean(payload.requiresSpeaking ?? existing?.requiresSpeaking, true),
    requiresTeacherConfirmation: parseBoolean(payload.requiresTeacherConfirmation ?? existing?.requiresTeacherConfirmation, true),
    ceilingLevel: validateCefrValue(payload.ceilingLevel ?? existing?.ceilingLevel, 'ceilingLevel'),
    instructions: toNullableText(payload.instructions ?? existing?.instructions),
    tenant: tenantId,
  };
  validateVersionRange(data);
  return data;
}

async function sanitizeAssessmentSectionPayload(body: any, tenantId: number | string, existing?: any) {
  const payload = extractBody(body);
  const assessmentVersion = await ensureEntityInTenant(ASSESSMENT_VERSION_UID, payload.assessmentVersion ?? existing?.assessmentVersion, tenantId, 'assessmentVersion');
  const skill = await ensureEntityInTenant(SKILL_UID, payload.skill ?? existing?.skill, tenantId, 'skill');
  return {
    code: ensureRequiredText(payload.code ?? existing?.code, 'code'),
    title: ensureRequiredText(payload.title ?? existing?.title, 'title'),
    description: toNullableText(payload.description ?? existing?.description),
    instruction: toNullableText(payload.instruction ?? existing?.instruction),
    order: parseRequiredInteger(payload.order ?? existing?.order ?? 0, 'order'),
    skill: skill ? skill.id : null,
    assessmentVersion: assessmentVersion ? assessmentVersion.id : null,
    tenant: tenantId,
  };
}

async function sanitizeAssessmentQuestionPayload(body: any, tenantId: number | string, existing?: any) {
  const payload = extractBody(body);
  const section = await ensureEntityInTenant(ASSESSMENT_SECTION_UID, payload.section ?? existing?.section, tenantId, 'section');
  const question = await ensureEntityInTenant(QUESTION_UID, payload.question ?? existing?.question, tenantId, 'question');
  const data = {
    section: section ? section.id : null,
    question: question ? question.id : null,
    order: parseRequiredInteger(payload.order ?? existing?.order ?? 0, 'order'),
    points: parseOptionalDecimal(payload.points ?? existing?.points ?? 1, 'points') ?? 1,
    required: parseBoolean(payload.required ?? existing?.required, true),
    audioPlayLimit: parseOptionalInteger(payload.audioPlayLimit ?? existing?.audioPlayLimit, 'audioPlayLimit'),
    allowSeek: parseBoolean(payload.allowSeek ?? existing?.allowSeek, true),
    minWords: parseOptionalInteger(payload.minWords ?? existing?.minWords, 'minWords'),
    maxWords: parseOptionalInteger(payload.maxWords ?? existing?.maxWords, 'maxWords'),
    config: parseJsonField(payload.config ?? existing?.config, 'config'),
    tenant: tenantId,
  };
  validateAssessmentQuestionConfig(data);
  return data;
}

async function sanitizeAssessmentSpeakingCriterionPayload(body: any, tenantId: number | string, existing?: any) {
  const payload = extractBody(body);
  const assessmentVersion = await ensureEntityInTenant(ASSESSMENT_VERSION_UID, payload.assessmentVersion ?? existing?.assessmentVersion, tenantId, 'assessmentVersion');
  if (!assessmentVersion) throw new AssessmentManagementError(400, 'assessmentVersion is required');
  return {
    assessmentVersion: assessmentVersion.id,
    code: ensureRequiredText(payload.code ?? existing?.code, 'code'),
    label: ensureRequiredText(payload.label ?? existing?.label, 'label'),
    description: toNullableText(payload.description ?? existing?.description),
    guidance: toNullableText(payload.guidance ?? existing?.guidance),
    order: parseRequiredInteger(payload.order ?? existing?.order ?? 0, 'order'),
    maxScore: parseOptionalDecimal(payload.maxScore ?? existing?.maxScore, 'maxScore'),
    weight: parseOptionalDecimal(payload.weight ?? existing?.weight, 'weight'),
    required: parseBoolean(payload.required ?? existing?.required, true),
    status: toText(payload.status ?? existing?.status) || 'active',
    tenant: tenantId,
  };
}

function ensureSpeakingCriteriaEditable(version: any) {
  const versionStatus = toText(version?.versionStatus);
  if (versionStatus === 'retired') {
    throw new AssessmentManagementError(409, 'Retired assessment versions cannot be modified.');
  }
}

async function validatePublishableVersion(versionId: number, tenantId: number | string) {
  const version = await findAssessmentVersionOrThrow(versionId, tenantId, { includeSections: true });
  validateVersionRange(version);
  const sections = Array.isArray(version?.sections) ? version.sections : [];
  if (sections.length === 0) throw new AssessmentManagementError(400, 'Assessment Version must have at least one section before publishing');
  const stats = summarizeAssessmentSections(sections);
  if (stats.totalQuestions === 0) throw new AssessmentManagementError(400, 'Assessment Version must have at least one question before publishing');

  for (const section of sections) {
    if (!Number.isInteger(Number(section?.order))) {
      throw new AssessmentManagementError(400, `Section ${section?.code || ''} has invalid order`);
    }
    const assessmentQuestions = getSectionAssessmentQuestions(section);
    for (const assessmentQuestion of assessmentQuestions) {
      validateAssessmentQuestionConfig(assessmentQuestion);
      const linkedQuestion = assessmentQuestion?.question;
      if (!linkedQuestion?.id) {
        throw new AssessmentManagementError(400, `Assessment question in section ${section?.code || ''} is missing a linked question`);
      }
      if (toText(linkedQuestion?.questionStatus) !== 'active') {
        throw new AssessmentManagementError(400, `Question ${linkedQuestion?.code || ''} must be active before publishing this version`);
      }
    }
  }

  return version;
}

export function getTenantIdFromContext(ctx: any) {
  return resolveCurrentTenantId(ctx);
}

export async function listAssessments(query: Record<string, unknown> = {}, tenantId: number | string) {
  const { page, pageSize, start } = buildPagination(query);
  const q = toText(query?.q || query?.search);
  const assessmentType = toText(query?.assessmentType);
  const subjectRef = toText(query?.subjectId || query?.subject);
  const status = toText(query?.status);
  const whereClauses: any[] = [];

  if (q) {
    whereClauses.push({
      $or: [
        { code: { $containsi: q } },
        { name: { $containsi: q } },
        { description: { $containsi: q } },
      ],
    });
  }
  if (assessmentType) whereClauses.push({ assessmentType });
  if (subjectRef) whereClauses.push({ subject: whereByParam(subjectRef) });
  if (status) whereClauses.push({ status });

  const where = mergeTenantWhere(whereClauses.length > 0 ? { $and: whereClauses } : {}, tenantId);
  const orderBy = normalizeSortInput(query?.sort).length > 0 ? normalizeSortInput(query?.sort) : [{ updatedAt: 'desc' }, { id: 'desc' }];
  const [rows, total] = await Promise.all([
    strapi.db.query(ASSESSMENT_UID).findMany({
      where,
      offset: start,
      limit: pageSize,
      orderBy,
      populate: {
        subject: { select: ['id', 'documentId', 'code', 'title'] },
        versions: { select: ['id', 'code', 'version', 'versionStatus'], orderBy: [{ version: 'desc' }, { id: 'desc' }] },
      },
    }),
    strapi.db.query(ASSESSMENT_UID).count({ where }),
  ]);

  return {
    data: (rows || []).map((row: any) => ({
      ...mapAssessment(row),
      versionCount: Array.isArray(row?.versions) ? row.versions.length : 0,
      latestPublishedVersion: Array.isArray(row?.versions)
        ? row.versions.find((item: any) => toText(item?.versionStatus) === 'published') || null
        : null,
    })),
    meta: { pagination: { page, pageSize, total, pageCount: Math.max(1, Math.ceil(total / pageSize)) } },
  };
}

export async function getAssessmentDetail(id: unknown, tenantId: number | string) {
  const row = await findAssessmentOrThrow(id, tenantId, { includeVersions: true });
  return {
    ...mapAssessment(row),
    versions: Array.isArray(row?.versions) ? row.versions.map((item: any) => {
      const stats = summarizeAssessmentSections(item?.sections || []);
      return {
        ...mapAssessmentVersion(item),
        sectionCount: stats.totalSections,
        questionCount: stats.totalQuestions,
      };
    }) : [],
  };
}

export async function createAssessment(body: any, tenantId: number | string) {
  const data = await sanitizeAssessmentPayload(body, tenantId);
  await ensureAssessmentCodeUnique(data.code, tenantId);
  const created = await strapi.db.query(ASSESSMENT_UID).create({ data });
  return getAssessmentDetail(created.id, tenantId);
}

export async function updateAssessment(id: unknown, body: any, tenantId: number | string) {
  const existing = await findAssessmentOrThrow(id, tenantId, { includeVersions: true });
  const data = await sanitizeAssessmentPayload(body, tenantId, existing);
  await ensureAssessmentCodeUnique(data.code, tenantId, Number(existing.id));
  await strapi.db.query(ASSESSMENT_UID).update({ where: { id: existing.id }, data });
  return getAssessmentDetail(existing.id, tenantId);
}

export async function archiveAssessment(id: unknown, tenantId: number | string) {
  const existing = await findAssessmentOrThrow(id, tenantId);
  await strapi.db.query(ASSESSMENT_UID).update({ where: { id: existing.id }, data: { status: 'archived' } });
  const row = await findAssessmentOrThrow(existing.id, tenantId);
  return mapAssessment(row);
}

export async function deleteAssessment(id: unknown, tenantId: number | string) {
  const existing = await findAssessmentOrThrow(id, tenantId, { includeVersions: true });
  const versionCount = Array.isArray(existing?.versions) ? existing.versions.length : 0;
  if (versionCount > 0) {
    throw new AssessmentManagementError(409, 'Assessment cannot be deleted because it already has versions');
  }
  await strapi.db.query(ASSESSMENT_UID).delete({ where: { id: existing.id } });
  return { id: normalizeId(existing) };
}

export async function listAssessmentVersions(query: Record<string, unknown> = {}, tenantId: number | string) {
  const { page, pageSize, start } = buildPagination(query);
  const q = toText(query?.q || query?.search);
  const assessmentRef = toText(query?.assessmentId || query?.assessment);
  const versionStatus = toText(query?.versionStatus || query?.status);
  const whereClauses: any[] = [];
  if (q) {
    whereClauses.push({
      $or: [
        { code: { $containsi: q } },
        { title: { $containsi: q } },
        { description: { $containsi: q } },
      ],
    });
  }
  if (assessmentRef) whereClauses.push({ assessment: whereByParam(assessmentRef) });
  if (versionStatus) whereClauses.push({ versionStatus });
  const where = mergeTenantWhere(whereClauses.length > 0 ? { $and: whereClauses } : {}, tenantId);
  const orderBy = normalizeSortInput(query?.sort).length > 0 ? normalizeSortInput(query?.sort) : [{ updatedAt: 'desc' }, { id: 'desc' }];
  const [rows, total] = await Promise.all([
    strapi.db.query(ASSESSMENT_VERSION_UID).findMany({
      where,
      offset: start,
      limit: pageSize,
      orderBy,
      populate: {
        assessment: { select: ['id', 'documentId', 'code', 'name'] },
        sections: {
          select: ['id'],
          populate: {
            questions: { select: ['id'] },
          },
        },
      },
    }),
    strapi.db.query(ASSESSMENT_VERSION_UID).count({ where }),
  ]);

  return {
    data: (rows || []).map((row: any) => ({
      ...mapAssessmentVersion(row),
      sectionCount: summarizeAssessmentSections(row?.sections || []).totalSections,
      questionCount: summarizeAssessmentSections(row?.sections || []).totalQuestions,
    })),
    meta: { pagination: { page, pageSize, total, pageCount: Math.max(1, Math.ceil(total / pageSize)) } },
  };
}

export async function getAssessmentVersionDetail(id: unknown, tenantId: number | string) {
  const row = await findAssessmentVersionOrThrow(id, tenantId, { includeSections: true });
  return mapAssessmentVersion(row, { includeSections: true });
}

export async function validateAssessmentVersion(id: unknown, tenantId: number | string) {
  const version = await findAssessmentVersionOrThrow(id, tenantId, { includeSections: true });
  const checks = [] as Array<{ key: string; level: 'success' | 'warning' | 'error' | 'info'; message: string }>;

  if (!version?.assessment?.id) {
    checks.push({ key: 'assessment', level: 'error', message: 'Phiên bản chưa gắn assessment.' });
  } else {
    checks.push({ key: 'assessment', level: 'success', message: 'Đã gắn assessment.' });
  }

  try {
    validateVersionRange(version);
    checks.push({ key: 'ranges', level: 'success', message: 'Grade range và candidate level range hợp lệ.' });
  } catch (error: any) {
    checks.push({ key: 'ranges', level: 'error', message: error?.message || 'Grade range hoặc candidate level range không hợp lệ.' });
  }

  const sections = Array.isArray(version?.sections) ? version.sections : [];
  const stats = summarizeAssessmentSections(sections);
  if (sections.length === 0) {
    checks.push({ key: 'sections', level: 'error', message: 'Phiên bản chưa có section nào.' });
  } else {
    checks.push({ key: 'sections', level: 'success', message: `Có ${sections.length} section.` });
  }

  let questionWarnings = 0;
  let configErrors = 0;
  for (const section of sections) {
    const assessmentQuestions = getSectionAssessmentQuestions(section);
    for (const assessmentQuestion of assessmentQuestions) {
      try {
        validateAssessmentQuestionConfig(assessmentQuestion);
      } catch {
        configErrors += 1;
      }
      const linkedQuestion = assessmentQuestion?.question;
      if (linkedQuestion?.questionStatus !== 'active') {
        questionWarnings += 1;
      }
    }
  }

  if (stats.totalQuestions === 0) {
    checks.push({ key: 'questions', level: 'error', message: 'Phiên bản chưa có câu hỏi.' });
  } else {
    checks.push({ key: 'questions', level: 'success', message: `Có ${stats.totalQuestions} câu hỏi.` });
  }

  if (stats.totalQuestions === 0) {
    checks.push({ key: 'runtime-config', level: 'info', message: 'Chưa có câu hỏi để kiểm tra runtime config.' });
  } else if (configErrors > 0) {
    checks.push({ key: 'runtime-config', level: 'error', message: `${configErrors} assessment-question có runtime config không hợp lệ.` });
  } else {
    checks.push({ key: 'runtime-config', level: 'success', message: 'Runtime config của assessment-question hợp lệ.' });
  }

  if (stats.totalQuestions === 0) {
    checks.push({ key: 'question-status', level: 'info', message: 'Chưa có câu hỏi để kiểm tra trạng thái.' });
  } else if (questionWarnings > 0) {
    checks.push({ key: 'question-status', level: 'warning', message: `${questionWarnings} câu hỏi chưa active trong Question Bank.` });
  } else {
    checks.push({ key: 'question-status', level: 'success', message: 'Tất cả câu hỏi liên kết đang active.' });
  }

  return {
    version: mapAssessmentVersion(version, { includeSections: true }),
    checks,
    summary: {
      hasErrors: checks.some((item) => item.level === 'error'),
      hasWarnings: checks.some((item) => item.level === 'warning'),
      totalSections: sections.length,
      totalQuestions: stats.totalQuestions,
    },
  };
}

export async function createAssessmentVersion(body: any, tenantId: number | string) {
  const data = await sanitizeAssessmentVersionPayload(body, tenantId);
  await ensureAssessmentVersionCodeUnique(data.code, tenantId);
  await ensureAssessmentVersionNumberUnique(Number(data.assessment), Number(data.version), tenantId);
  const created = await strapi.db.query(ASSESSMENT_VERSION_UID).create({ data });
  const row = await findAssessmentVersionOrThrow(created.id, tenantId, { includeSections: true });
  return mapAssessmentVersion(row, { includeSections: true });
}

export async function updateAssessmentVersion(id: unknown, body: any, tenantId: number | string) {
  const existing = await findAssessmentVersionOrThrow(id, tenantId, { includeSections: true });
  if (toText(existing?.versionStatus) === 'published') {
    throw new AssessmentManagementError(409, 'Published assessment versions cannot be modified structurally. Create a new version instead.');
  }
  if (toText(existing?.versionStatus) === 'retired') {
    throw new AssessmentManagementError(409, 'Retired assessment versions cannot be modified.');
  }
  const data = await sanitizeAssessmentVersionPayload(body, tenantId, existing);
  await ensureAssessmentVersionCodeUnique(data.code, tenantId, Number(existing.id));
  await ensureAssessmentVersionNumberUnique(Number(data.assessment), Number(data.version), tenantId, Number(existing.id));
  await strapi.db.query(ASSESSMENT_VERSION_UID).update({ where: { id: existing.id }, data });
  const row = await findAssessmentVersionOrThrow(existing.id, tenantId, { includeSections: true });
  return mapAssessmentVersion(row, { includeSections: true });
}

export async function publishAssessmentVersion(id: unknown, tenantId: number | string) {
  const version = await validatePublishableVersion(Number((await findAssessmentVersionOrThrow(id, tenantId)).id), tenantId);
  if (toText(version?.versionStatus) === 'retired') {
    throw new AssessmentManagementError(409, 'Retired assessment versions cannot be published');
  }
  await strapi.db.query(ASSESSMENT_VERSION_UID).update({ where: { id: version.id }, data: { versionStatus: 'published' } });
  const row = await findAssessmentVersionOrThrow(version.id, tenantId, { includeSections: true });
  return mapAssessmentVersion(row, { includeSections: true });
}

export async function retireAssessmentVersion(id: unknown, tenantId: number | string) {
  const existing = await findAssessmentVersionOrThrow(id, tenantId, { includeSections: true });
  await strapi.db.query(ASSESSMENT_VERSION_UID).update({ where: { id: existing.id }, data: { versionStatus: 'retired' } });
  const row = await findAssessmentVersionOrThrow(existing.id, tenantId, { includeSections: true });
  return mapAssessmentVersion(row, { includeSections: true });
}

export async function deleteAssessmentVersion(id: unknown, tenantId: number | string) {
  const existing = await findAssessmentVersionOrThrow(id, tenantId, { includeSections: true });
  if (toText(existing?.versionStatus) !== 'draft') {
    throw new AssessmentManagementError(409, 'Only draft assessment versions can be deleted');
  }
  const attemptCount = await strapi.db.query(ASSESSMENT_ATTEMPT_UID).count({
    where: mergeTenantWhere({ assessmentVersion: { id: { $eq: Number(existing.id) } } }, tenantId),
  });
  if (Number(attemptCount || 0) > 0) {
    throw new AssessmentManagementError(409, 'Assessment Version cannot be deleted because it already has attempts');
  }
  const campaignRuleCount = await strapi.db.query(ASSESSMENT_CAMPAIGN_RULE_UID).count({
    where: mergeTenantWhere({ assessmentVersion: { id: { $eq: Number(existing.id) } } }, tenantId),
  });
  if (Number(campaignRuleCount || 0) > 0) {
    throw new AssessmentManagementError(409, 'Assessment Version cannot be deleted because it is referenced by assessment campaign rules');
  }
  if (Array.isArray(existing?.sections) && existing.sections.length > 0) {
    throw new AssessmentManagementError(409, 'Assessment Version cannot be deleted because it still has sections');
  }
  await strapi.db.query(ASSESSMENT_VERSION_UID).delete({ where: { id: existing.id } });
  return { id: normalizeId(existing) };
}

export async function cloneAssessmentVersion(id: unknown, body: any, tenantId: number | string) {
  const source = await findAssessmentVersionOrThrow(id, tenantId, { includeSections: true });
  const payload = extractBody(body);
  const cloneData = await sanitizeAssessmentVersionPayload({
    code: payload.code,
    version: payload.version,
    title: payload.title,
    description: payload.description ?? source.description,
    assessment: source.assessment?.id || source.assessment,
    versionStatus: 'draft',
    durationMinutes: payload.durationMinutes ?? source.durationMinutes,
    gradeFrom: payload.gradeFrom ?? source.gradeFrom,
    gradeTo: payload.gradeTo ?? source.gradeTo,
    candidateLevelFrom: payload.candidateLevelFrom ?? source.candidateLevelFrom,
    candidateLevelTo: payload.candidateLevelTo ?? source.candidateLevelTo,
    resultMode: payload.resultMode ?? source.resultMode,
    requiresSpeaking: payload.requiresSpeaking ?? source.requiresSpeaking,
    requiresTeacherConfirmation: payload.requiresTeacherConfirmation ?? source.requiresTeacherConfirmation,
    ceilingLevel: payload.ceilingLevel ?? source.ceilingLevel,
    instructions: payload.instructions ?? source.instructions,
  }, tenantId);
  await ensureAssessmentVersionCodeUnique(cloneData.code, tenantId);
  await ensureAssessmentVersionNumberUnique(Number(cloneData.assessment), Number(cloneData.version), tenantId);

  const createdVersion = await strapi.db.query(ASSESSMENT_VERSION_UID).create({ data: cloneData });
  const sections = Array.isArray(source?.sections) ? source.sections : [];
  for (const section of sections) {
    const createdSection = await strapi.db.query(ASSESSMENT_SECTION_UID).create({
      data: {
        code: section.code,
        title: section.title,
        description: section.description,
        instruction: section.instruction,
        order: section.order,
        skill: extractRelationRef(section.skill) || section.skill?.id || null,
        assessmentVersion: createdVersion.id,
        tenant: tenantId,
      },
    });
    const assessmentQuestions = getSectionAssessmentQuestions(section);
    for (const assessmentQuestion of assessmentQuestions) {
      await strapi.db.query(ASSESSMENT_QUESTION_UID).create({
        data: {
          section: createdSection.id,
          question: extractRelationRef(assessmentQuestion.question) || assessmentQuestion.question?.id,
          order: assessmentQuestion.order,
          points: assessmentQuestion.points,
          required: assessmentQuestion.required,
          audioPlayLimit: assessmentQuestion.audioPlayLimit,
          allowSeek: assessmentQuestion.allowSeek,
          minWords: assessmentQuestion.minWords,
          maxWords: assessmentQuestion.maxWords,
          config: assessmentQuestion.config,
          tenant: tenantId,
        },
      });
    }
  }

  for (const criterion of Array.isArray(source?.speakingCriteria) ? source.speakingCriteria : []) {
    await strapi.db.query(ASSESSMENT_SPEAKING_CRITERION_UID).create({
      data: {
        assessmentVersion: createdVersion.id,
        code: criterion.code,
        label: criterion.label,
        description: criterion.description,
        guidance: criterion.guidance,
        order: criterion.order,
        maxScore: criterion.maxScore,
        weight: criterion.weight,
        required: criterion.required !== false,
        status: criterion.status || 'active',
        tenant: tenantId,
      },
    });
  }

  const row = await findAssessmentVersionOrThrow(createdVersion.id, tenantId, { includeSections: true });
  return mapAssessmentVersion(row, { includeSections: true });
}

export async function listAssessmentSpeakingCriteria(query: Record<string, unknown> = {}, tenantId: number | string) {
  const assessmentVersionRef = toText(query?.assessmentVersionId || query?.assessmentVersion);
  if (!assessmentVersionRef) throw new AssessmentManagementError(400, 'assessmentVersion is required');
  const status = toText(query?.status);
  const whereClauses: any[] = [{ assessmentVersion: whereByParam(assessmentVersionRef) }];
  if (status) whereClauses.push({ status });
  const rows = await strapi.db.query(ASSESSMENT_SPEAKING_CRITERION_UID).findMany({
    where: mergeTenantWhere({ $and: whereClauses }, tenantId),
    orderBy: [{ order: 'asc' }, { id: 'asc' }],
    populate: { assessmentVersion: { select: ['id', 'documentId', 'code', 'title', 'versionStatus', 'requiresSpeaking'] } },
  });
  return (rows || []).map(mapAssessmentSpeakingCriterion);
}

export async function createAssessmentSpeakingCriterion(body: any, tenantId: number | string) {
  const data = await sanitizeAssessmentSpeakingCriterionPayload(body, tenantId);
  const version = await findAssessmentVersionOrThrow(data.assessmentVersion, tenantId);
  ensureSpeakingCriteriaEditable(version);
  await ensureSpeakingCriterionCodeUnique(Number(data.assessmentVersion), data.code, tenantId);
  const created = await strapi.db.query(ASSESSMENT_SPEAKING_CRITERION_UID).create({ data });
  const row = await findAssessmentSpeakingCriterionOrThrow(created.id, tenantId);
  return mapAssessmentSpeakingCriterion(row);
}

export async function updateAssessmentSpeakingCriterion(id: unknown, body: any, tenantId: number | string) {
  const existing = await findAssessmentSpeakingCriterionOrThrow(id, tenantId);
  ensureSpeakingCriteriaEditable(existing?.assessmentVersion);
  const data = await sanitizeAssessmentSpeakingCriterionPayload(body, tenantId, existing);
  await ensureSpeakingCriterionCodeUnique(Number(data.assessmentVersion), data.code, tenantId, Number(existing.id));
  await strapi.db.query(ASSESSMENT_SPEAKING_CRITERION_UID).update({ where: { id: existing.id }, data });
  const row = await findAssessmentSpeakingCriterionOrThrow(existing.id, tenantId);
  return mapAssessmentSpeakingCriterion(row);
}

export async function deleteAssessmentSpeakingCriterion(id: unknown, tenantId: number | string) {
  const existing = await findAssessmentSpeakingCriterionOrThrow(id, tenantId);
  ensureSpeakingCriteriaEditable(existing?.assessmentVersion);
  await strapi.db.query(ASSESSMENT_SPEAKING_CRITERION_UID).delete({ where: { id: existing.id } });
  return { id: normalizeId(existing) };
}

export async function createAssessmentSection(body: any, tenantId: number | string) {
  const data = await sanitizeAssessmentSectionPayload(body, tenantId);
  const version = await findAssessmentVersionOrThrow(data.assessmentVersion, tenantId);
  ensureVersionDraft(version);
  await ensureSectionCodeUnique(Number(data.assessmentVersion), data.code, tenantId);
  const created = await strapi.db.query(ASSESSMENT_SECTION_UID).create({ data });
  const row = await findAssessmentSectionOrThrow(created.id, tenantId, { includeQuestions: true });
  return mapAssessmentSection(row);
}

export async function updateAssessmentSection(id: unknown, body: any, tenantId: number | string) {
  const existing = await findAssessmentSectionOrThrow(id, tenantId, { includeQuestions: true });
  ensureVersionDraft(existing?.assessmentVersion);
  const data = await sanitizeAssessmentSectionPayload(body, tenantId, existing);
  await ensureSectionCodeUnique(Number(data.assessmentVersion), data.code, tenantId, Number(existing.id));
  await strapi.db.query(ASSESSMENT_SECTION_UID).update({ where: { id: existing.id }, data });
  const row = await findAssessmentSectionOrThrow(existing.id, tenantId, { includeQuestions: true });
  return mapAssessmentSection(row);
}

export async function deleteAssessmentSection(id: unknown, tenantId: number | string) {
  const existing = await findAssessmentSectionOrThrow(id, tenantId, { includeQuestions: true });
  ensureVersionDraft(existing?.assessmentVersion);
  if (Array.isArray(existing?.questions) && existing.questions.length > 0) {
    throw new AssessmentManagementError(409, 'Assessment Section cannot be deleted because it still has assessment questions');
  }
  await strapi.db.query(ASSESSMENT_SECTION_UID).delete({ where: { id: existing.id } });
  return { id: normalizeId(existing) };
}

export async function reorderAssessmentSections(versionId: unknown, body: any, tenantId: number | string) {
  const version = await findAssessmentVersionOrThrow(versionId, tenantId);
  ensureVersionDraft(version);
  const payload = extractBody(body);
  const items = Array.isArray(payload.items) ? payload.items : [];
  for (const item of items) {
    const section = await findAssessmentSectionOrThrow(item.id, tenantId);
    if (String(extractRelationRef(section?.assessmentVersion) || section?.assessmentVersion?.id || '') !== String(version.id)) {
      throw new AssessmentManagementError(400, 'Section does not belong to the specified assessment version');
    }
    await strapi.db.query(ASSESSMENT_SECTION_UID).update({
      where: { id: section.id },
      data: { order: parseRequiredInteger(item.order, 'order') },
    });
  }
  return getAssessmentVersionDetail(version.id, tenantId);
}

export async function addAssessmentQuestion(body: any, tenantId: number | string) {
  const data = await sanitizeAssessmentQuestionPayload(body, tenantId);
  const section = await findAssessmentSectionOrThrow(data.section, tenantId, { includeQuestions: true });
  ensureVersionDraft(section?.assessmentVersion);
  const questionEntity = await ensureEntityInTenant(QUESTION_UID, data.question, tenantId, 'question');
  await ensureAssessmentQuestionUnique(Number(data.section), Number(data.question), tenantId);
  let created: any;
  try {
    created = await strapi.db.query(ASSESSMENT_QUESTION_UID).create({ data });
  } catch (error) {
    const documentsApi = typeof strapi.documents === 'function' ? strapi.documents(ASSESSMENT_QUESTION_UID) : null;
    const sectionRelation = toConnectRelation(section?.documentId || section?.id || data.section);
    const questionRelation = toConnectRelation(questionEntity?.documentId || questionEntity?.id || data.question);
    const tenantRelation = toConnectRelation(tenantId);

    if (!documentsApi || !sectionRelation || !questionRelation || !tenantRelation) {
      throw error;
    }

    created = await documentsApi.create({
      data: {
        section: sectionRelation,
        question: questionRelation,
        order: data.order,
        points: data.points,
        required: data.required,
        audioPlayLimit: data.audioPlayLimit,
        allowSeek: data.allowSeek,
        minWords: data.minWords,
        maxWords: data.maxWords,
        config: data.config,
        tenant: tenantRelation,
      } as any,
    });
  }
  try {
    const row = await findAssessmentQuestionOrThrow(created?.documentId || created?.id, tenantId);
    return mapAssessmentQuestion(row);
  } catch {
    return {
      id: normalizeId(created),
      documentId: created?.documentId || null,
      order: Number(data.order || 0),
      points: data.points ?? 1,
      required: data.required !== false,
      audioPlayLimit: data.audioPlayLimit ?? null,
      allowSeek: data.allowSeek !== false,
      minWords: data.minWords ?? null,
      maxWords: data.maxWords ?? null,
      config: data.config ?? null,
      question: null,
    };
  }
}

export async function updateAssessmentQuestion(id: unknown, body: any, tenantId: number | string) {
  const existing = await findAssessmentQuestionOrThrow(id, tenantId);
  const versionStatus = toText(existing?.section?.assessmentVersion?.versionStatus);
  if (versionStatus !== 'draft') {
    throw new AssessmentManagementError(409, 'Only draft assessment versions can be structurally modified');
  }
  const data = await sanitizeAssessmentQuestionPayload(body, tenantId, existing);
  await ensureAssessmentQuestionUnique(Number(data.section), Number(data.question), tenantId, Number(existing.id));
  await strapi.db.query(ASSESSMENT_QUESTION_UID).update({ where: { id: existing.id }, data });
  const row = await findAssessmentQuestionOrThrow(existing.id, tenantId);
  return mapAssessmentQuestion(row);
}

export async function removeAssessmentQuestion(id: unknown, tenantId: number | string) {
  const existing = await findAssessmentQuestionOrThrow(id, tenantId);
  const versionStatus = toText(existing?.section?.assessmentVersion?.versionStatus);
  if (versionStatus !== 'draft') {
    throw new AssessmentManagementError(409, 'Only draft assessment versions can be structurally modified');
  }
  await strapi.db.query(ASSESSMENT_QUESTION_UID).delete({ where: { id: existing.id } });
  return { id: normalizeId(existing) };
}

export async function reorderAssessmentQuestions(sectionId: unknown, body: any, tenantId: number | string) {
  const section = await findAssessmentSectionOrThrow(sectionId, tenantId, { includeQuestions: true });
  ensureVersionDraft(section?.assessmentVersion);
  const payload = extractBody(body);
  const items = Array.isArray(payload.items) ? payload.items : [];
  for (const item of items) {
    const assessmentQuestion = await findAssessmentQuestionOrThrow(item.id, tenantId);
    if (String(extractRelationRef(assessmentQuestion?.section) || assessmentQuestion?.section?.id || '') !== String(section.id)) {
      throw new AssessmentManagementError(400, 'Assessment Question does not belong to the specified section');
    }
    await strapi.db.query(ASSESSMENT_QUESTION_UID).update({
      where: { id: assessmentQuestion.id },
      data: { order: parseRequiredInteger(item.order, 'order') },
    });
  }
  return getAssessmentVersionDetail(extractRelationRef(section.assessmentVersion) || section.assessmentVersion?.id, tenantId);
}
