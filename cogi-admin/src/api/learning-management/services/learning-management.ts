import { extractRelationRef, findEntityByRef, mergeTenantWhere, parseOptionalPositiveInt, resolveCurrentTenantId, toText, whereByParam } from '../../../utils/tenant-scope';

const LEARNING_OBJECT_UID = 'api::learning-object.learning-object';
const CONTENT_BLOCK_UID = 'api::content-block.content-block';
const SUBJECT_UID = 'api::subject.subject';
const GRADE_UID = 'api::grade.grade';
const KNOWLEDGE_NODE_UID = 'api::knowledge-node.knowledge-node';
const SKILL_UID = 'api::skill.skill';
const FORMULA_UID = 'api::formula.formula';
const QUESTION_UID = 'api::question.question';
const QUESTION_OPTION_UID = 'api::question-option.question-option';
const VISUAL_ASSET_UID = 'api::visual-asset.visual-asset';
const UPLOAD_FILE_UID = 'plugin::upload.file';

class LearningManagementError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

type RelationOption = {
  id: number | string;
  documentId?: string | null;
  code?: string;
  title?: string;
  name?: string;
  label?: string;
};

function toNullableText(value: unknown): string | null {
  const text = toText(value);
  return text || null;
}

function toPositiveInt(value: unknown, fallback: number | null = null): number | null {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) return fallback;
  return parsed;
}

function toNonNegativeInt(value: unknown, fallback = 0): number {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 0) return fallback;
  return parsed;
}

function toDecimal(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    throw new LearningManagementError(400, 'Decimal value is invalid');
  }
  return parsed;
}

function toBoolean(value: unknown, fallback = false): boolean {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value !== 0;
  const text = toText(value).toLowerCase();
  if (!text) return fallback;
  return ['true', '1', 'yes', 'on'].includes(text);
}

function ensureRequiredText(value: unknown, fieldName: string) {
  const text = toText(value);
  if (!text) {
    throw new LearningManagementError(400, `${fieldName} is required`);
  }
  return text;
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
    throw new LearningManagementError(400, `${fieldName} must be valid JSON`);
  }
}

function extractBody(body: any) {
  if (body?.data && typeof body.data === 'object' && !Array.isArray(body.data)) {
    return body.data;
  }

  if (body && typeof body === 'object' && !Array.isArray(body)) {
    return body;
  }

  return {};
}

function normalizeId(row: any) {
  return row?.documentId || row?.id;
}

function normalizeOption(row: any): RelationOption {
  return {
    id: normalizeId(row),
    documentId: row?.documentId || null,
    code: row?.code || '',
    title: row?.title || row?.name || '',
    name: row?.name || row?.title || '',
    label: row?.title || row?.name || row?.code || '',
  };
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

function mapContentBlock(row: any) {
  return {
    id: normalizeId(row),
    documentId: row?.documentId || null,
    type: row?.type || '',
    title: row?.title || '',
    order: Number(row?.order || 0),
    content: row?.content || '',
    htmlContent: row?.htmlContent || '',
    config: row?.config ?? null,
    contentBlockStatus: row?.contentBlockStatus || 'active',
    learningObject: mapSimpleRelation(row?.learningObject),
    formula: mapSimpleRelation(row?.formula),
    question: mapSimpleRelation(row?.question),
    visualAsset: mapSimpleRelation(row?.visualAsset),
    media: Array.isArray(row?.media) ? row.media[0] || null : row?.media || null,
  };
}

function mapQuestionOption(row: any) {
  return {
    id: normalizeId(row),
    documentId: row?.documentId || null,
    label: row?.label || '',
    value: row?.value || '',
    content: row?.content || '',
    isCorrect: row?.isCorrect === true,
    order: Number(row?.order || 0),
    explanation: row?.explanation || '',
  };
}

async function replaceQuestionOptions(questionId: number, options: any[], tenantId: number | string) {
  const existingOptions = await strapi.db.query(QUESTION_OPTION_UID).findMany({
    where: mergeTenantWhere({ question: { id: { $eq: questionId } } }, tenantId),
    select: ['id'],
  });

  for (const option of existingOptions || []) {
    await strapi.db.query(QUESTION_OPTION_UID).delete({ where: { id: option.id } });
  }

  for (const option of options || []) {
    await createQuestionOption({
      question: questionId,
      ...option,
    }, tenantId);
  }
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
    options: Array.isArray(row?.options) ? row.options.map(mapQuestionOption) : [],
  };
}

function mapLearningObject(row: any) {
  return {
    id: normalizeId(row),
    documentId: row?.documentId || null,
    code: row?.code || '',
    title: row?.title || '',
    slug: row?.slug || '',
    description: row?.description || '',
    version: row?.version || '',
    learningObjectStatus: row?.learningObjectStatus || 'draft',
    difficulty: row?.difficulty || '',
    estimatedMinutes: Number(row?.estimatedMinutes || 0),
    learningObjectives: row?.learningObjectives ?? null,
    tags: row?.tags ?? null,
    metadata: row?.metadata ?? null,
    subject: mapSimpleRelation(row?.subject),
    grade: mapSimpleRelation(row?.grade),
    knowledgeNodes: Array.isArray(row?.knowledgeNodes) ? row.knowledgeNodes.map(mapSimpleRelation) : [],
    prerequisites: Array.isArray(row?.prerequisites) ? row.prerequisites.map(mapSimpleRelation) : [],
    skills: Array.isArray(row?.skills) ? row.skills.map(mapSimpleRelation) : [],
    formulas: Array.isArray(row?.formulas) ? row.formulas.map(mapSimpleRelation) : [],
    visualAssets: Array.isArray(row?.visualAssets) ? row.visualAssets.map(mapSimpleRelation) : [],
    questions: Array.isArray(row?.questions) ? row.questions.map(mapQuestion) : [],
    contentBlocks: Array.isArray(row?.contentBlocks) ? row.contentBlocks.map(mapContentBlock) : [],
  };
}

function getRelationOptionQueryConfig(uid: string) {
  const orderBy = [{ title: 'asc' }, { code: 'asc' }, { id: 'asc' }];

  switch (uid) {
    case KNOWLEDGE_NODE_UID:
      return {
        orderBy,
        populate: {
          subject: { select: ['id', 'documentId', 'code', 'title'] },
          grade: { select: ['id', 'documentId', 'code', 'title'] },
        },
      };
    case SKILL_UID:
    case FORMULA_UID:
    case VISUAL_ASSET_UID:
      return {
        orderBy,
        populate: {
          subject: { select: ['id', 'documentId', 'code', 'title'] },
          grade: { select: ['id', 'documentId', 'code', 'title'] },
          knowledgeNode: { select: ['id', 'documentId', 'code', 'title'] },
        },
      };
    case SUBJECT_UID:
    case GRADE_UID:
    default:
      return {
        orderBy,
      };
  }
}

function buildPagination(query: any) {
  const page = toPositiveInt(query?.page, 1) || 1;
  const pageSize = toPositiveInt(query?.pageSize, 10) || 10;
  const start = (page - 1) * pageSize;
  return { page, pageSize, start };
}

function toRelationIdList(value: unknown): Array<number | string> {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => extractRelationRef(item))
    .filter((item) => item !== null && item !== undefined && item !== '');
}

function mapRelationIds(value: unknown): Array<number | string> {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => normalizeId(item))
    .filter((item) => item !== null && item !== undefined && item !== '');
}

async function ensureEntityInTenant(uid: string, ref: unknown, tenantId: number | string, label: string) {
  if (ref === null || ref === undefined || ref === '') return null;
  const entity = await findEntityByRef(uid, ref, {
    tenant: {
      select: ['id', 'documentId'],
    },
  });
  if (!entity) {
    throw new LearningManagementError(400, `${label} is invalid`);
  }

  const entityTenantRef = extractRelationRef(entity?.tenant);
  if (String(entityTenantRef || '') !== String(tenantId)) {
    throw new LearningManagementError(403, `${label} does not belong to current tenant`);
  }

  return entity;
}

async function ensureEntityListInTenant(uid: string, refs: unknown[], tenantId: number | string, label: string) {
  const entities = [];
  for (const ref of refs || []) {
    const entity = await ensureEntityInTenant(uid, ref, tenantId, label);
    if (entity) entities.push(entity);
  }
  return entities;
}

async function findLearningObjectOrThrow(id: unknown, tenantId: number | string) {
  const where = whereByParam(id);
  if (!where) {
    throw new LearningManagementError(400, 'Learning Object id is invalid');
  }

  const row = await strapi.db.query(LEARNING_OBJECT_UID).findOne({
    where: mergeTenantWhere(where, tenantId),
    populate: {
      subject: { select: ['id', 'documentId', 'code', 'title'] },
      grade: { select: ['id', 'documentId', 'code', 'title'] },
      knowledgeNodes: { select: ['id', 'documentId', 'code', 'title'] },
      prerequisites: { select: ['id', 'documentId', 'code', 'title'] },
      skills: { select: ['id', 'documentId', 'code', 'title'] },
      formulas: { select: ['id', 'documentId', 'code', 'title'] },
      visualAssets: { select: ['id', 'documentId', 'code', 'title'] },
      contentBlocks: {
        populate: {
          formula: { select: ['id', 'documentId', 'code', 'title'] },
          question: { select: ['id', 'documentId', 'code', 'title'] },
          visualAsset: { select: ['id', 'documentId', 'code', 'title'] },
          media: true,
        },
        orderBy: [{ order: 'asc' }, { id: 'asc' }],
      },
      questions: {
        populate: {
          subject: { select: ['id', 'documentId', 'code', 'title'] },
          grade: { select: ['id', 'documentId', 'code', 'title'] },
          knowledgeNode: { select: ['id', 'documentId', 'code', 'title'] },
          skills: { select: ['id', 'documentId', 'code', 'title'] },
          formulas: { select: ['id', 'documentId', 'code', 'title'] },
          options: { select: ['id', 'documentId', 'label', 'value', 'content', 'isCorrect', 'order', 'explanation'] },
        },
      },
    },
  });

  if (!row) {
    throw new LearningManagementError(404, 'Learning Object not found');
  }

  return row;
}

async function listRelationOptions(uid: string, tenantId: number | string, options: any = {}) {
  const whereClauses: any[] = [];
  const search = toText(options?.q);
  if (search) {
    whereClauses.push({
      $or: [
        { code: { $containsi: search } },
        { title: { $containsi: search } },
        { name: { $containsi: search } },
        { description: { $containsi: search } },
      ],
    });
  }

  if (options?.subject) {
    whereClauses.push({ subject: { id: { $eq: options.subject } } });
  }
  if (options?.grade) {
    whereClauses.push({ grade: { id: { $eq: options.grade } } });
  }
  if (options?.knowledgeNode) {
    whereClauses.push({ knowledgeNode: { id: { $eq: options.knowledgeNode } } });
  }

  const where = mergeTenantWhere(whereClauses.length > 0 ? { $and: whereClauses } : {}, tenantId);
  const queryConfig = getRelationOptionQueryConfig(uid);

  if (toPositiveInt(options?.page) !== null || toPositiveInt(options?.pageSize) !== null) {
    const { page, pageSize, start } = buildPagination(options);
    const [rows, total] = await Promise.all([
      strapi.db.query(uid).findMany({
        where,
        offset: start,
        limit: pageSize,
        ...queryConfig,
      }),
      strapi.db.query(uid).count({ where }),
    ]);

    return {
      data: (rows || []).map((row: any) => ({
        ...normalizeOption(row),
        description: row?.description || '',
        order: Number(row?.order || 0),
        status: row?.gradeStatus || row?.subjectStatus || row?.knowledgeNodeStatus || row?.skillStatus || row?.formulaStatus || row?.visualAssetStatus || '',
        updatedAt: row?.updatedAt || null,
        createdAt: row?.createdAt || null,
        gradeStatus: row?.gradeStatus || '',
        subject: mapSimpleRelation(row?.subject),
        grade: mapSimpleRelation(row?.grade),
        knowledgeNode: mapSimpleRelation(row?.knowledgeNode),
        type: row?.type || '',
        latex: row?.latex || '',
        plainText: row?.plainText || '',
        examples: row?.examples ?? null,
        formulaStatus: row?.formulaStatus || '',
      })),
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

  const rows = await strapi.db.query(uid).findMany({
    where,
    ...queryConfig,
  });

  return (rows || []).map((row: any) => ({
    ...normalizeOption(row),
    description: row?.description || '',
    order: Number(row?.order || 0),
    status: row?.gradeStatus || row?.subjectStatus || row?.knowledgeNodeStatus || row?.skillStatus || row?.formulaStatus || row?.visualAssetStatus || '',
    updatedAt: row?.updatedAt || null,
    createdAt: row?.createdAt || null,
    gradeStatus: row?.gradeStatus || '',
    subject: mapSimpleRelation(row?.subject),
    grade: mapSimpleRelation(row?.grade),
    knowledgeNode: mapSimpleRelation(row?.knowledgeNode),
    type: row?.type || '',
    latex: row?.latex || '',
    plainText: row?.plainText || '',
    examples: row?.examples ?? null,
    formulaStatus: row?.formulaStatus || '',
  }));
}

export function getTenantIdFromContext(ctx: any) {
  return resolveCurrentTenantId(ctx);
}

export async function getLearningManagementBootstrap(tenantId: number | string) {
  const [subjects, grades, knowledgeNodes, skills, formulas, visualAssets] = await Promise.all([
    listRelationOptions(SUBJECT_UID, tenantId),
    listRelationOptions(GRADE_UID, tenantId),
    listRelationOptions(KNOWLEDGE_NODE_UID, tenantId),
    listRelationOptions(SKILL_UID, tenantId),
    listRelationOptions(FORMULA_UID, tenantId),
    listRelationOptions(VISUAL_ASSET_UID, tenantId),
  ]);

  return {
    subjects,
    grades,
    knowledgeNodes,
    skills,
    formulas,
    visualAssets,
    learningObjectStatuses: ['draft', 'active', 'archived'],
    difficulties: ['easy', 'medium', 'hard'],
    contentBlockTypes: ['text', 'html', 'image', 'video', 'audio', 'question', 'formula', 'example', 'exercise', 'interactive', 'summary'],
    contentBlockStatuses: ['active', 'hidden', 'archived'],
    questionTypes: ['single_choice', 'multiple_choice', 'true_false', 'short_answer', 'essay', 'ordering', 'matching', 'fill_blank'],
    questionStatuses: ['draft', 'active', 'archived'],
    subjectStatuses: ['active', 'archived'],
    gradeStatuses: ['active', 'archived'],
    skillStatuses: ['active', 'archived'],
    formulaStatuses: ['active', 'archived'],
    knowledgeNodeStatuses: ['active', 'archived'],
    visualAssetStatuses: ['active', 'archived'],
  };
}

export async function listLearningObjects(query: any, tenantId: number | string) {
  const { page, pageSize, start } = buildPagination(query);
  const q = toText(query?.q);
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

  const subjectId = toText(query?.subjectId);
  if (subjectId) whereClauses.push({ subject: whereByParam(subjectId) });

  const gradeId = toText(query?.gradeId);
  if (gradeId) whereClauses.push({ grade: whereByParam(gradeId) });

  const knowledgeNodeId = toText(query?.knowledgeNodeId);
  if (knowledgeNodeId) {
    whereClauses.push({
      knowledgeNodes: whereByParam(knowledgeNodeId),
    });
  }

  const difficulty = toText(query?.difficulty);
  if (difficulty) whereClauses.push({ difficulty });

  const learningObjectStatus = toText(query?.learningObjectStatus);
  if (learningObjectStatus) whereClauses.push({ learningObjectStatus });

  const where = mergeTenantWhere(whereClauses.length > 0 ? { $and: whereClauses } : {}, tenantId);
  const [rows, total] = await Promise.all([
    strapi.db.query(LEARNING_OBJECT_UID).findMany({
      where,
      offset: start,
      limit: pageSize,
      orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
      populate: {
        subject: { select: ['id', 'documentId', 'code', 'title'] },
        grade: { select: ['id', 'documentId', 'code', 'title'] },
        knowledgeNodes: { select: ['id', 'documentId', 'code', 'title'] },
        skills: { select: ['id', 'documentId', 'code', 'title'] },
        formulas: { select: ['id', 'documentId', 'code', 'title'] },
        visualAssets: { select: ['id', 'documentId', 'code', 'title'] },
        contentBlocks: { select: ['id', 'documentId', 'type', 'title', 'order'] },
        questions: {
          select: ['id', 'documentId', 'code', 'title', 'type'],
        },
      },
    }),
    strapi.db.query(LEARNING_OBJECT_UID).count({ where }),
  ]);

  return {
    data: (rows || []).map(mapLearningObject),
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

export async function getLearningObjectDetail(id: unknown, tenantId: number | string) {
  const row = await findLearningObjectOrThrow(id, tenantId);
  return mapLearningObject(row);
}

async function sanitizeLearningObjectPayload(body: any, tenantId: number | string, existing?: any) {
  const payload = extractBody(body);
  const subject = await ensureEntityInTenant(SUBJECT_UID, payload.subject ?? existing?.subject, tenantId, 'subject');
  const grade = await ensureEntityInTenant(GRADE_UID, payload.grade ?? existing?.grade, tenantId, 'grade');
  const knowledgeNodes = await ensureEntityListInTenant(KNOWLEDGE_NODE_UID, toRelationIdList(payload.knowledgeNodes), tenantId, 'knowledgeNode');
  const prerequisites = await ensureEntityListInTenant(LEARNING_OBJECT_UID, toRelationIdList(payload.prerequisites), tenantId, 'prerequisite');
  const skills = await ensureEntityListInTenant(SKILL_UID, toRelationIdList(payload.skills), tenantId, 'skill');
  const formulas = await ensureEntityListInTenant(FORMULA_UID, toRelationIdList(payload.formulas), tenantId, 'formula');
  const visualAssets = await ensureEntityListInTenant(VISUAL_ASSET_UID, toRelationIdList(payload.visualAssets), tenantId, 'visualAsset');
  const questions = await ensureEntityListInTenant(QUESTION_UID, toRelationIdList(payload.questions), tenantId, 'question');

  return {
    code: ensureRequiredText(payload.code ?? existing?.code, 'code'),
    title: ensureRequiredText(payload.title ?? existing?.title, 'title'),
    slug: toNullableText(payload.slug ?? existing?.slug),
    description: toNullableText(payload.description ?? existing?.description),
    version: toNullableText(payload.version ?? existing?.version),
    learningObjectStatus: toText(payload.learningObjectStatus ?? existing?.learningObjectStatus) || 'draft',
    difficulty: toNullableText(payload.difficulty ?? existing?.difficulty),
    estimatedMinutes: toPositiveInt(payload.estimatedMinutes ?? existing?.estimatedMinutes, null),
    learningObjectives: parseJsonField(payload.learningObjectives ?? existing?.learningObjectives, 'learningObjectives'),
    tags: parseJsonField(payload.tags ?? existing?.tags, 'tags'),
    metadata: parseJsonField(payload.metadata ?? existing?.metadata, 'metadata'),
    subject: subject ? subject.id : null,
    grade: grade ? grade.id : null,
    knowledgeNodes: knowledgeNodes.map((item: any) => item.id),
    prerequisites: prerequisites.map((item: any) => item.id),
    skills: skills.map((item: any) => item.id),
    formulas: formulas.map((item: any) => item.id),
    visualAssets: visualAssets.map((item: any) => item.id),
    questions: questions.map((item: any) => item.id),
    tenant: tenantId,
  };
}

export async function createLearningObject(body: any, tenantId: number | string) {
  const data = await sanitizeLearningObjectPayload(body, tenantId);
  const created = await strapi.db.query(LEARNING_OBJECT_UID).create({ data });
  return getLearningObjectDetail(created.id, tenantId);
}

export async function updateLearningObject(id: unknown, body: any, tenantId: number | string) {
  const existing = await findLearningObjectOrThrow(id, tenantId);
  const data = await sanitizeLearningObjectPayload(body, tenantId, existing);
  await strapi.db.query(LEARNING_OBJECT_UID).update({
    where: { id: existing.id },
    data,
  });
  return getLearningObjectDetail(existing.id, tenantId);
}

export async function deleteLearningObject(id: unknown, tenantId: number | string) {
  const existing = await findLearningObjectOrThrow(id, tenantId);
  await strapi.db.query(LEARNING_OBJECT_UID).delete({ where: { id: existing.id } });
  return { id: existing.id };
}

async function sanitizeSubjectPayload(body: any) {
  const payload = extractBody(body);
  return {
    code: ensureRequiredText(payload.code, 'code'),
    title: ensureRequiredText(payload.title, 'title'),
    description: toNullableText(payload.description),
    subjectStatus: toText(payload.subjectStatus) || 'active',
  };
}

async function sanitizeGradePayload(body: any) {
  const payload = extractBody(body);
  return {
    code: ensureRequiredText(payload.code, 'code'),
    title: ensureRequiredText(payload.title, 'title'),
    order: toNonNegativeInt(payload.order, 0),
    description: toNullableText(payload.description),
    gradeStatus: toText(payload.gradeStatus) || 'active',
  };
}

export async function getSubjects(query: any, tenantId: number | string) {
  return listRelationOptions(SUBJECT_UID, tenantId, query);
}

export async function createSubject(body: any, tenantId: number | string) {
  const payload = await sanitizeSubjectPayload(body);
  const created = await strapi.db.query(SUBJECT_UID).create({ data: { ...payload, tenant: tenantId } });
  const row = await ensureEntityInTenant(SUBJECT_UID, created.id, tenantId, 'subject');
  return normalizeOption(row);
}

export async function updateSubject(id: unknown, body: any, tenantId: number | string) {
  const existing = await ensureEntityInTenant(SUBJECT_UID, id, tenantId, 'subject');
  if (!existing) {
    throw new LearningManagementError(404, 'Subject not found');
  }

  const payload = await sanitizeSubjectPayload(body);
  await strapi.db.query(SUBJECT_UID).update({
    where: { id: existing.id },
    data: payload,
  });

  const row = await ensureEntityInTenant(SUBJECT_UID, existing.id, tenantId, 'subject');
  return normalizeOption(row);
}

export async function deleteSubject(id: unknown, tenantId: number | string) {
  const existing = await ensureEntityInTenant(SUBJECT_UID, id, tenantId, 'subject');
  if (!existing) {
    throw new LearningManagementError(404, 'Subject not found');
  }

  await strapi.db.query(SUBJECT_UID).delete({ where: { id: existing.id } });
  return { id: normalizeId(existing) };
}

export async function getGrades(query: any, tenantId: number | string) {
  return listRelationOptions(GRADE_UID, tenantId, query);
}

export async function createGrade(body: any, tenantId: number | string) {
  const payload = await sanitizeGradePayload(body);
  const created = await strapi.db.query(GRADE_UID).create({
    data: {
      ...payload,
      tenant: tenantId,
    },
  });
  const row = await ensureEntityInTenant(GRADE_UID, created.id, tenantId, 'grade');
  return normalizeOption(row);
}

export async function updateGrade(id: unknown, body: any, tenantId: number | string) {
  const existing = await ensureEntityInTenant(GRADE_UID, id, tenantId, 'grade');
  if (!existing) {
    throw new LearningManagementError(404, 'Grade not found');
  }

  const payload = await sanitizeGradePayload(body);
  await strapi.db.query(GRADE_UID).update({
    where: { id: existing.id },
    data: payload,
  });

  const row = await ensureEntityInTenant(GRADE_UID, existing.id, tenantId, 'grade');
  return normalizeOption(row);
}

export async function deleteGrade(id: unknown, tenantId: number | string) {
  const existing = await ensureEntityInTenant(GRADE_UID, id, tenantId, 'grade');
  if (!existing) {
    throw new LearningManagementError(404, 'Grade not found');
  }

  await strapi.db.query(GRADE_UID).delete({ where: { id: existing.id } });
  return { id: normalizeId(existing) };
}

export async function getKnowledgeNodes(query: any, tenantId: number | string) {
  return listRelationOptions(KNOWLEDGE_NODE_UID, tenantId, query);
}

export async function createKnowledgeNode(body: any, tenantId: number | string) {
  const payload = extractBody(body);
  const subject = await ensureEntityInTenant(SUBJECT_UID, payload.subject, tenantId, 'subject');
  const grade = await ensureEntityInTenant(GRADE_UID, payload.grade, tenantId, 'grade');
  const parent = await ensureEntityInTenant(KNOWLEDGE_NODE_UID, payload.parent, tenantId, 'parent');
  const created = await strapi.db.query(KNOWLEDGE_NODE_UID).create({
    data: {
      code: ensureRequiredText(payload.code, 'code'),
      title: ensureRequiredText(payload.title, 'title'),
      description: toNullableText(payload.description),
      subject: subject ? subject.id : null,
      grade: grade ? grade.id : null,
      parent: parent ? parent.id : null,
      order: toNonNegativeInt(payload.order, 0),
      level: toNonNegativeInt(payload.level, 0),
      knowledgeNodeStatus: toText(payload.knowledgeNodeStatus) || 'active',
      tenant: tenantId,
    },
  });
  const row = await ensureEntityInTenant(KNOWLEDGE_NODE_UID, created.id, tenantId, 'knowledgeNode');
  return normalizeOption(row);
}

export async function getSkills(query: any, tenantId: number | string) {
  return listRelationOptions(SKILL_UID, tenantId, query);
}

export async function createSkill(body: any, tenantId: number | string) {
  const payload = extractBody(body);
  const subject = await ensureEntityInTenant(SUBJECT_UID, payload.subject, tenantId, 'subject');
  const grade = await ensureEntityInTenant(GRADE_UID, payload.grade, tenantId, 'grade');
  const knowledgeNode = await ensureEntityInTenant(KNOWLEDGE_NODE_UID, payload.knowledgeNode, tenantId, 'knowledgeNode');
  const parentSkill = await ensureEntityInTenant(SKILL_UID, payload.parentSkill, tenantId, 'parentSkill');
  const created = await strapi.db.query(SKILL_UID).create({
    data: {
      code: ensureRequiredText(payload.code, 'code'),
      title: ensureRequiredText(payload.title, 'title'),
      description: toNullableText(payload.description),
      subject: subject ? subject.id : null,
      grade: grade ? grade.id : null,
      knowledgeNode: knowledgeNode ? knowledgeNode.id : null,
      parentSkill: parentSkill ? parentSkill.id : null,
      level: ensureRequiredText(payload.level, 'level'),
      skillStatus: toText(payload.skillStatus) || 'active',
      tenant: tenantId,
    },
  });
  const row = await ensureEntityInTenant(SKILL_UID, created.id, tenantId, 'skill');
  return normalizeOption(row);
}

export async function getFormulas(query: any, tenantId: number | string) {
  return listRelationOptions(FORMULA_UID, tenantId, query);
}

export async function createFormula(body: any, tenantId: number | string) {
  const payload = extractBody(body);
  const subject = await ensureEntityInTenant(SUBJECT_UID, payload.subject, tenantId, 'subject');
  const grade = await ensureEntityInTenant(GRADE_UID, payload.grade, tenantId, 'grade');
  const knowledgeNode = await ensureEntityInTenant(KNOWLEDGE_NODE_UID, payload.knowledgeNode, tenantId, 'knowledgeNode');
  const created = await strapi.db.query(FORMULA_UID).create({
    data: {
      code: ensureRequiredText(payload.code, 'code'),
      title: ensureRequiredText(payload.title, 'title'),
      description: toNullableText(payload.description),
      latex: toNullableText(payload.latex),
      plainText: toNullableText(payload.plainText),
      examples: parseJsonField(payload.examples, 'examples'),
      formulaStatus: toText(payload.formulaStatus) || 'active',
      subject: subject ? subject.id : null,
      grade: grade ? grade.id : null,
      knowledgeNode: knowledgeNode ? knowledgeNode.id : null,
      tenant: tenantId,
    },
  });
  const row = await ensureEntityInTenant(FORMULA_UID, created.id, tenantId, 'formula');
  return normalizeOption(row);
}

export async function updateFormula(id: unknown, body: any, tenantId: number | string) {
  const existing = await ensureEntityInTenant(FORMULA_UID, id, tenantId, 'formula');
  if (!existing) {
    throw new LearningManagementError(404, 'Formula not found');
  }

  const payload = extractBody(body);
  const subject = await ensureEntityInTenant(SUBJECT_UID, payload.subject ?? existing?.subject, tenantId, 'subject');
  const grade = await ensureEntityInTenant(GRADE_UID, payload.grade ?? existing?.grade, tenantId, 'grade');
  const knowledgeNode = await ensureEntityInTenant(KNOWLEDGE_NODE_UID, payload.knowledgeNode ?? existing?.knowledgeNode, tenantId, 'knowledgeNode');

  await strapi.db.query(FORMULA_UID).update({
    where: { id: existing.id },
    data: {
      code: ensureRequiredText(payload.code ?? existing?.code, 'code'),
      title: ensureRequiredText(payload.title ?? existing?.title, 'title'),
      description: toNullableText(payload.description ?? existing?.description),
      latex: toNullableText(payload.latex ?? existing?.latex),
      plainText: toNullableText(payload.plainText ?? existing?.plainText),
      examples: parseJsonField(payload.examples ?? existing?.examples, 'examples'),
      formulaStatus: toText(payload.formulaStatus ?? existing?.formulaStatus) || 'active',
      subject: subject ? subject.id : null,
      grade: grade ? grade.id : null,
      knowledgeNode: knowledgeNode ? knowledgeNode.id : null,
      tenant: tenantId,
    },
  });

  const row = await ensureEntityInTenant(FORMULA_UID, existing.id, tenantId, 'formula');
  return normalizeOption(row);
}

export async function deleteFormula(id: unknown, tenantId: number | string) {
  const existing = await ensureEntityInTenant(FORMULA_UID, id, tenantId, 'formula');
  if (!existing) {
    throw new LearningManagementError(404, 'Formula not found');
  }

  await strapi.db.query(FORMULA_UID).delete({ where: { id: existing.id } });
  return { id: normalizeId(existing) };
}

export async function getVisualAssets(query: any, tenantId: number | string) {
  return listRelationOptions(VISUAL_ASSET_UID, tenantId, query);
}

export async function createVisualAsset(body: any, tenantId: number | string) {
  const payload = extractBody(body);
  const subject = await ensureEntityInTenant(SUBJECT_UID, payload.subject, tenantId, 'subject');
  const grade = await ensureEntityInTenant(GRADE_UID, payload.grade, tenantId, 'grade');
  const knowledgeNode = await ensureEntityInTenant(KNOWLEDGE_NODE_UID, payload.knowledgeNode, tenantId, 'knowledgeNode');
  const uploadFile = await ensureEntityInTenant(UPLOAD_FILE_UID, payload.file, tenantId, 'file').catch(() => null);
  const created = await strapi.db.query(VISUAL_ASSET_UID).create({
    data: {
      code: toNullableText(payload.code),
      title: ensureRequiredText(payload.title, 'title'),
      type: ensureRequiredText(payload.type, 'type'),
      file: uploadFile ? uploadFile.id : null,
      url: toNullableText(payload.url),
      description: toNullableText(payload.description),
      altText: toNullableText(payload.altText),
      visualAssetStatus: toText(payload.visualAssetStatus) || 'active',
      subject: subject ? subject.id : null,
      grade: grade ? grade.id : null,
      knowledgeNode: knowledgeNode ? knowledgeNode.id : null,
      tenant: tenantId,
    },
  });
  const row = await ensureEntityInTenant(VISUAL_ASSET_UID, created.id, tenantId, 'visualAsset');
  return normalizeOption(row);
}

export async function getContentBlocks(learningObjectId: unknown, tenantId: number | string) {
  const learningObject = await findLearningObjectOrThrow(learningObjectId, tenantId);
  const rows = await strapi.db.query(CONTENT_BLOCK_UID).findMany({
    where: mergeTenantWhere({ learningObject: { id: { $eq: learningObject.id } } }, tenantId),
    orderBy: [{ order: 'asc' }, { id: 'asc' }],
    populate: {
      learningObject: { select: ['id', 'documentId', 'code', 'title'] },
      formula: { select: ['id', 'documentId', 'code', 'title'] },
      question: { select: ['id', 'documentId', 'code', 'title'] },
      visualAsset: { select: ['id', 'documentId', 'code', 'title'] },
      media: true,
    },
  });
  return {
    learningObject: mapLearningObject(learningObject),
    blocks: (rows || []).map(mapContentBlock),
  };
}

async function sanitizeContentBlockPayload(body: any, tenantId: number | string, existing?: any) {
  const payload = extractBody(body);
  const learningObject = await findLearningObjectOrThrow(payload.learningObject ?? existing?.learningObject?.id ?? existing?.learningObject, tenantId);
  const formula = await ensureEntityInTenant(FORMULA_UID, payload.formula ?? existing?.formula, tenantId, 'formula');
  const question = await ensureEntityInTenant(QUESTION_UID, payload.question ?? existing?.question, tenantId, 'question');
  const visualAsset = await ensureEntityInTenant(VISUAL_ASSET_UID, payload.visualAsset ?? existing?.visualAsset, tenantId, 'visualAsset');
  const media = await ensureEntityInTenant(UPLOAD_FILE_UID, payload.media ?? existing?.media, tenantId, 'media').catch(() => null);

  return {
    learningObject: learningObject.id,
    type: ensureRequiredText(payload.type ?? existing?.type, 'type'),
    title: toNullableText(payload.title ?? existing?.title),
    order: toNonNegativeInt(payload.order ?? existing?.order, 0),
    content: toNullableText(payload.content ?? existing?.content),
    htmlContent: toNullableText(payload.htmlContent ?? existing?.htmlContent),
    formula: formula ? formula.id : null,
    question: question ? question.id : null,
    visualAsset: visualAsset ? visualAsset.id : null,
    media: media ? media.id : null,
    config: parseJsonField(payload.config ?? existing?.config, 'config'),
    contentBlockStatus: toText(payload.contentBlockStatus ?? existing?.contentBlockStatus) || 'active',
    tenant: tenantId,
  };
}

async function findContentBlockOrThrow(id: unknown, tenantId: number | string) {
  const where = whereByParam(id);
  if (!where) throw new LearningManagementError(400, 'Content Block id is invalid');
  const row = await strapi.db.query(CONTENT_BLOCK_UID).findOne({
    where: mergeTenantWhere(where, tenantId),
    populate: {
      learningObject: { select: ['id', 'documentId', 'code', 'title'] },
      formula: { select: ['id', 'documentId', 'code', 'title'] },
      question: { select: ['id', 'documentId', 'code', 'title'] },
      visualAsset: { select: ['id', 'documentId', 'code', 'title'] },
      media: true,
    },
  });
  if (!row) throw new LearningManagementError(404, 'Content Block not found');
  return row;
}

export async function createContentBlock(body: any, tenantId: number | string) {
  const data = await sanitizeContentBlockPayload(body, tenantId);
  const created = await strapi.db.query(CONTENT_BLOCK_UID).create({ data });
  const row = await findContentBlockOrThrow(created.id, tenantId);
  return mapContentBlock(row);
}

export async function updateContentBlock(id: unknown, body: any, tenantId: number | string) {
  const existing = await findContentBlockOrThrow(id, tenantId);
  const data = await sanitizeContentBlockPayload(body, tenantId, existing);
  await strapi.db.query(CONTENT_BLOCK_UID).update({ where: { id: existing.id }, data });
  const row = await findContentBlockOrThrow(existing.id, tenantId);
  return mapContentBlock(row);
}

export async function deleteContentBlock(id: unknown, tenantId: number | string) {
  const existing = await findContentBlockOrThrow(id, tenantId);
  await strapi.db.query(CONTENT_BLOCK_UID).delete({ where: { id: existing.id } });
  return { id: existing.id };
}

export async function getQuestions(query: any, tenantId: number | string) {
  const q = toText(query?.q);
  const learningObjectId = toText(query?.learningObjectId);
  const subjectId = toText(query?.subjectId);
  const gradeId = toText(query?.gradeId);
  const type = toText(query?.type);
  const questionStatus = toText(query?.questionStatus);
  const whereClauses: any[] = [];

  if (q) {
    whereClauses.push({
      $or: [
        { code: { $containsi: q } },
        { title: { $containsi: q } },
        { questionText: { $containsi: q } },
      ],
    });
  }

  if (learningObjectId) {
    whereClauses.push({ learningObjects: whereByParam(learningObjectId) });
  }

  if (subjectId) {
    whereClauses.push({ subject: whereByParam(subjectId) });
  }

  if (gradeId) {
    whereClauses.push({ grade: whereByParam(gradeId) });
  }

  if (type) {
    whereClauses.push({ type });
  }

  if (questionStatus) {
    whereClauses.push({ questionStatus });
  }

  const where = mergeTenantWhere(whereClauses.length > 0 ? { $and: whereClauses } : {}, tenantId);
  const shouldPaginate = toPositiveInt(query?.page) !== null || toPositiveInt(query?.pageSize) !== null;

  if (shouldPaginate) {
    const { page, pageSize, start } = buildPagination(query);
    const [rows, total] = await Promise.all([
      strapi.db.query(QUESTION_UID).findMany({
        where,
        offset: start,
        limit: pageSize,
        orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
        populate: {
          subject: { select: ['id', 'documentId', 'code', 'title'] },
          grade: { select: ['id', 'documentId', 'code', 'title'] },
          knowledgeNode: { select: ['id', 'documentId', 'code', 'title'] },
          skills: { select: ['id', 'documentId', 'code', 'title'] },
          formulas: { select: ['id', 'documentId', 'code', 'title'] },
          options: { select: ['id', 'documentId', 'label', 'value', 'content', 'isCorrect', 'order', 'explanation'] },
          learningObjects: { select: ['id', 'documentId', 'code', 'title'] },
        },
      }),
      strapi.db.query(QUESTION_UID).count({ where }),
    ]);

    return {
      data: (rows || []).map(mapQuestion),
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

  const rows = await strapi.db.query(QUESTION_UID).findMany({
    where,
    orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
    populate: {
      subject: { select: ['id', 'documentId', 'code', 'title'] },
      grade: { select: ['id', 'documentId', 'code', 'title'] },
      knowledgeNode: { select: ['id', 'documentId', 'code', 'title'] },
      skills: { select: ['id', 'documentId', 'code', 'title'] },
      formulas: { select: ['id', 'documentId', 'code', 'title'] },
      options: { select: ['id', 'documentId', 'label', 'value', 'content', 'isCorrect', 'order', 'explanation'] },
      learningObjects: { select: ['id', 'documentId', 'code', 'title'] },
    },
  });

  return (rows || []).map(mapQuestion);
}

async function sanitizeQuestionPayload(body: any, tenantId: number | string, existing?: any) {
  const payload = extractBody(body);
  const subject = await ensureEntityInTenant(SUBJECT_UID, payload.subject ?? existing?.subject, tenantId, 'subject');
  const grade = await ensureEntityInTenant(GRADE_UID, payload.grade ?? existing?.grade, tenantId, 'grade');
  const knowledgeNode = await ensureEntityInTenant(KNOWLEDGE_NODE_UID, payload.knowledgeNode ?? existing?.knowledgeNode, tenantId, 'knowledgeNode');
  const skillRefs = payload.skills !== undefined ? toRelationIdList(payload.skills) : mapRelationIds(existing?.skills);
  const formulaRefs = payload.formulas !== undefined ? toRelationIdList(payload.formulas) : mapRelationIds(existing?.formulas);
  const learningObjectRefs = payload.learningObjects !== undefined ? toRelationIdList(payload.learningObjects) : mapRelationIds(existing?.learningObjects);
  const skills = await ensureEntityListInTenant(SKILL_UID, skillRefs, tenantId, 'skill');
  const formulas = await ensureEntityListInTenant(FORMULA_UID, formulaRefs, tenantId, 'formula');
  const learningObjects = await ensureEntityListInTenant(LEARNING_OBJECT_UID, learningObjectRefs, tenantId, 'learningObject');

  return {
    code: ensureRequiredText(payload.code ?? existing?.code, 'code'),
    title: toNullableText(payload.title ?? existing?.title),
    questionText: ensureRequiredText(payload.questionText ?? existing?.questionText, 'questionText'),
    type: ensureRequiredText(payload.type ?? existing?.type, 'type'),
    subject: subject ? subject.id : null,
    grade: grade ? grade.id : null,
    knowledgeNode: knowledgeNode ? knowledgeNode.id : null,
    difficulty: toNullableText(payload.difficulty ?? existing?.difficulty),
    skills: skills.map((item: any) => item.id),
    formulas: formulas.map((item: any) => item.id),
    learningObjects: learningObjects.map((item: any) => item.id),
    correctAnswer: parseJsonField(payload.correctAnswer ?? existing?.correctAnswer, 'correctAnswer'),
    explanation: toNullableText(payload.explanation ?? existing?.explanation),
    rubric: parseJsonField(payload.rubric ?? existing?.rubric, 'rubric'),
    questionStatus: toText(payload.questionStatus ?? existing?.questionStatus) || 'active',
    tenant: tenantId,
  };
}

async function findQuestionOrThrow(id: unknown, tenantId: number | string) {
  const where = whereByParam(id);
  if (!where) throw new LearningManagementError(400, 'Question id is invalid');
  const row = await strapi.db.query(QUESTION_UID).findOne({
    where: mergeTenantWhere(where, tenantId),
    populate: {
      subject: { select: ['id', 'documentId', 'code', 'title'] },
      grade: { select: ['id', 'documentId', 'code', 'title'] },
      knowledgeNode: { select: ['id', 'documentId', 'code', 'title'] },
      skills: { select: ['id', 'documentId', 'code', 'title'] },
      formulas: { select: ['id', 'documentId', 'code', 'title'] },
      options: { select: ['id', 'documentId', 'label', 'value', 'content', 'isCorrect', 'order', 'explanation'] },
      learningObjects: { select: ['id', 'documentId', 'code', 'title'] },
    },
  });
  if (!row) throw new LearningManagementError(404, 'Question not found');
  return row;
}

export async function createQuestion(body: any, tenantId: number | string) {
  const payload = extractBody(body);
  const data = await sanitizeQuestionPayload(payload, tenantId);
  const created = await strapi.db.query(QUESTION_UID).create({ data });
  const options = Array.isArray(payload.options) ? payload.options : [];

  for (const option of options) {
    await createQuestionOption({
      question: created.id,
      ...option,
    }, tenantId);
  }

  const row = await findQuestionOrThrow(created.id, tenantId);
  return mapQuestion(row);
}

export async function updateQuestion(id: unknown, body: any, tenantId: number | string) {
  const existing = await findQuestionOrThrow(id, tenantId);
  const payload = extractBody(body);
  const data = await sanitizeQuestionPayload(payload, tenantId, existing);

  await strapi.db.query(QUESTION_UID).update({
    where: { id: existing.id },
    data,
  });

  if (payload.options !== undefined) {
    const options = Array.isArray(payload.options) ? payload.options : [];
    await replaceQuestionOptions(existing.id, options, tenantId);
  }

  const row = await findQuestionOrThrow(existing.id, tenantId);
  return mapQuestion(row);
}

export async function deleteQuestion(id: unknown, tenantId: number | string) {
  const existing = await findQuestionOrThrow(id, tenantId);
  const optionIds = Array.isArray(existing?.options)
    ? existing.options.map((item: any) => Number(item?.id || 0)).filter((item: number) => Number.isInteger(item) && item > 0)
    : [];

  for (const optionId of optionIds) {
    await strapi.db.query(QUESTION_OPTION_UID).delete({ where: { id: optionId } });
  }

  await strapi.db.query(QUESTION_UID).delete({ where: { id: existing.id } });
  return { id: normalizeId(existing) };
}

export async function createQuestionOption(body: any, tenantId: number | string) {
  const payload = extractBody(body);
  const question = await ensureEntityInTenant(QUESTION_UID, payload.question, tenantId, 'question');
  if (!question) throw new LearningManagementError(400, 'question is required');

  const created = await strapi.db.query(QUESTION_OPTION_UID).create({
    data: {
      question: question.id,
      label: toNullableText(payload.label),
      value: toNullableText(payload.value),
      content: toNullableText(payload.content),
      isCorrect: toBoolean(payload.isCorrect, false),
      order: toNonNegativeInt(payload.order, 0),
      explanation: toNullableText(payload.explanation),
      tenant: tenantId,
    },
  });

  const row = await strapi.db.query(QUESTION_OPTION_UID).findOne({ where: { id: created.id } });
  return mapQuestionOption(row);
}

export async function attachQuestionToLearningObject(learningObjectId: unknown, questionId: unknown, tenantId: number | string) {
  const learningObject = await findLearningObjectOrThrow(learningObjectId, tenantId);
  const question = await findQuestionOrThrow(questionId, tenantId);
  const currentIds = Array.isArray(learningObject?.questions)
    ? learningObject.questions.map((item: any) => item.id)
    : [];
  const nextIds = [...new Set([...currentIds, question.id])];

  await strapi.db.query(LEARNING_OBJECT_UID).update({
    where: { id: learningObject.id },
    data: {
      questions: nextIds,
    },
  });

  return getLearningObjectDetail(learningObject.id, tenantId);
}

export async function detachQuestionFromLearningObject(learningObjectId: unknown, questionId: unknown, tenantId: number | string) {
  const learningObject = await findLearningObjectOrThrow(learningObjectId, tenantId);
  const questionWhere = whereByParam(questionId);
  const question = await strapi.db.query(QUESTION_UID).findOne({ where: mergeTenantWhere(questionWhere, tenantId) });
  if (!question) throw new LearningManagementError(404, 'Question not found');

  const currentIds = Array.isArray(learningObject?.questions)
    ? learningObject.questions.map((item: any) => item.id)
    : [];
  const nextIds = currentIds.filter((item: any) => String(item) !== String(question.id));

  await strapi.db.query(LEARNING_OBJECT_UID).update({
    where: { id: learningObject.id },
    data: {
      questions: nextIds,
    },
  });

  return getLearningObjectDetail(learningObject.id, tenantId);
}
