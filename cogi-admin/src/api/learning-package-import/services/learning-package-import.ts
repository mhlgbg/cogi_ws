import { extractRelationRef, mergeTenantWhere, toText } from '../../../utils/tenant-scope';

const SUBJECT_UID = 'api::subject.subject';
const GRADE_UID = 'api::grade.grade';
const KNOWLEDGE_NODE_UID = 'api::knowledge-node.knowledge-node';
const SKILL_UID = 'api::skill.skill';
const FORMULA_UID = 'api::formula.formula';
const VISUAL_ASSET_UID = 'api::visual-asset.visual-asset';
const QUESTION_UID = 'api::question.question';
const QUESTION_OPTION_UID = 'api::question-option.question-option';
const LEARNING_OBJECT_UID = 'api::learning-object.learning-object';
const CONTENT_BLOCK_UID = 'api::content-block.content-block';

const ALLOWED_UPDATE_STATUSES = ['draft', 'pending'];
const PREVIEW_TYPES = ['knowledgeNodes', 'skills', 'formulas', 'visualAssets', 'questions', 'learningObjects'] as const;

type PreviewBucketKey = typeof PREVIEW_TYPES[number];

type PreviewItem = {
  type: string;
  code: string;
  title: string;
  action: 'create' | 'update' | 'blocked' | 'error';
  currentStatus: string | null;
  message: string;
};

class LearningPackageImportError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

function normalizeArray(value: any) {
  return Array.isArray(value) ? value : [];
}

function normalizeText(value: unknown) {
  return toText(value);
}

function ensureRequiredText(value: unknown, fieldName: string) {
  const text = normalizeText(value);
  if (!text) throw new LearningPackageImportError(400, `${fieldName} is required`);
  return text;
}

function parseJson(value: unknown) {
  if (value === undefined) return undefined;
  if (value === null || value === '') return null;
  if (typeof value === 'object') return value;

  const text = normalizeText(value);
  if (!text) return null;
  return JSON.parse(text);
}

function slugify(value: string) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 120) || 'learning-object';
}

function getStatusEnum(uid: string, fieldName: string): string[] {
  const model = (strapi as any).getModel(uid);
  return Array.isArray(model?.attributes?.[fieldName]?.enum) ? model.attributes[fieldName].enum : [];
}

function pickCreateStatus(uid: string, fieldName: string, preferredDraft = true) {
  const enumValues = getStatusEnum(uid, fieldName);
  if (preferredDraft && enumValues.includes('draft')) return 'draft';
  if (enumValues.includes('pending')) return 'pending';
  if (enumValues.includes('active')) return 'active';
  return enumValues[0] || null;
}

function checkUpsertAction(existing: any, statusField: string): PreviewItem['action'] {
  if (!existing) return 'create';
  const currentStatus = normalizeText(existing?.[statusField]).toLowerCase();
  return ALLOWED_UPDATE_STATUSES.includes(currentStatus) ? 'update' : 'blocked';
}

async function findByCode(uid: string, code: string, tenantId: number | string) {
  return strapi.db.query(uid).findOne({
    where: mergeTenantWhere({ code: { $eq: code } }, tenantId),
    populate: {
      tenant: { select: ['id', 'documentId'] },
    },
  });
}

async function findSubjectByPackageValue(value: string, tenantId: number | string) {
  const text = normalizeText(value);
  if (!text) return null;

  const candidates = await strapi.db.query(SUBJECT_UID).findMany({
    where: mergeTenantWhere({
      $or: [
        { code: { $eq: text } },
        { title: { $eq: text } },
      ],
    }, tenantId),
    limit: 1,
  });

  return candidates?.[0] || null;
}

async function findGradeByPackageValue(value: string, tenantId: number | string) {
  const text = normalizeText(value);
  if (!text) return null;

  const candidates = await strapi.db.query(GRADE_UID).findMany({
    where: mergeTenantWhere({
      $or: [
        { code: { $eq: text } },
        { title: { $eq: text } },
      ],
    }, tenantId),
    limit: 1,
  });

  return candidates?.[0] || null;
}

function createEmptyPreviewResult() {
  return {
    createCount: 0,
    updateCount: 0,
    blockedCount: 0,
    warningCount: 0,
    errorCount: 0,
    blockedCodes: [],
    warningMessages: [],
    shapeErrors: [],
    subjects: [],
    grades: [],
    knowledgeNodes: [],
    skills: [],
    formulas: [],
    visualAssets: [],
    questions: [],
    learningObjects: [],
    canImport: false,
  };
}

function pushPreviewItem(result: any, bucket: PreviewBucketKey, item: PreviewItem) {
  result[bucket].push(item);
  if (item.action === 'create') result.createCount += 1;
  if (item.action === 'update') result.updateCount += 1;
  if (item.action === 'blocked') {
    result.blockedCount += 1;
    result.blockedCodes.push(item.code);
  }
  if (item.action === 'error') result.errorCount += 1;
}

function pushWarning(result: any, message: string) {
  result.warningCount += 1;
  result.warningMessages.push(message);
}

function validatePackageShape(packageData: any) {
  const errors: string[] = [];
  if (!packageData || typeof packageData !== 'object' || Array.isArray(packageData)) {
    errors.push('package phải là object hợp lệ');
    return errors;
  }

  if (!packageData.packageInfo || typeof packageData.packageInfo !== 'object') {
    errors.push('Thiếu packageInfo');
  }

  if (!normalizeText(packageData?.packageInfo?.code)) {
    errors.push('Thiếu packageInfo.code');
  }

  if (!Array.isArray(packageData.learningObjects)) {
    errors.push('learningObjects phải là array');
  }

  if (packageData.questions !== undefined && !Array.isArray(packageData.questions)) {
    errors.push('questions phải là array nếu được cung cấp');
  }

  normalizeArray(packageData.knowledgeNodes).forEach((item, index) => {
    if (!normalizeText(item?.code) || !normalizeText(item?.title)) {
      errors.push(`knowledgeNodes[${index}] thiếu code hoặc title`);
    }
  });

  normalizeArray(packageData.skills).forEach((item, index) => {
    if (!normalizeText(item?.code) || !normalizeText(item?.title)) {
      errors.push(`skills[${index}] thiếu code hoặc title`);
    }
  });

  normalizeArray(packageData.formulas).forEach((item, index) => {
    if (!normalizeText(item?.code) || !normalizeText(item?.title)) {
      errors.push(`formulas[${index}] thiếu code hoặc title`);
    }
  });

  normalizeArray(packageData.visualAssets).forEach((item, index) => {
    if (!normalizeText(item?.code) || !normalizeText(item?.title)) {
      errors.push(`visualAssets[${index}] thiếu code hoặc title`);
    }
  });

  normalizeArray(packageData.questions).forEach((item, index) => {
    if (!normalizeText(item?.code) || !normalizeText(item?.type) || !normalizeText(item?.questionText)) {
      errors.push(`questions[${index}] thiếu code, type hoặc questionText`);
    }
  });

  normalizeArray(packageData.learningObjects).forEach((item, index) => {
    if (!normalizeText(item?.code) || !normalizeText(item?.title)) {
      errors.push(`learningObjects[${index}] thiếu code hoặc title`);
    }

    normalizeArray(item?.contentBlocks).forEach((block, blockIndex) => {
      if (!normalizeText(block?.type)) {
        errors.push(`learningObjects[${index}].contentBlocks[${blockIndex}] thiếu type`);
      }
    });
  });

  return errors;
}

async function buildReferenceResolvers(packageData: any, tenantId: number | string) {
  const knowledgeNodesInPackage = new Set(normalizeArray(packageData.knowledgeNodes).map((item) => normalizeText(item?.code)).filter(Boolean));
  const skillsInPackage = new Set(normalizeArray(packageData.skills).map((item) => normalizeText(item?.code)).filter(Boolean));
  const formulasInPackage = new Set(normalizeArray(packageData.formulas).map((item) => normalizeText(item?.code)).filter(Boolean));
  const questionsInPackage = new Set(normalizeArray(packageData.questions).map((item) => normalizeText(item?.code)).filter(Boolean));
  const visualAssetsInPackage = new Set(normalizeArray(packageData.visualAssets).map((item) => normalizeText(item?.code)).filter(Boolean));

  const existingCache = new Map<string, any | null>();

  async function hasExisting(uid: string, code: string) {
    const cacheKey = `${uid}:${code}`;
    if (!existingCache.has(cacheKey)) {
      existingCache.set(cacheKey, await findByCode(uid, code, tenantId));
    }
    return existingCache.get(cacheKey);
  }

  return {
    existingCache,
    async resolveKnowledgeNode(code: string) {
      return knowledgeNodesInPackage.has(code) || Boolean(await hasExisting(KNOWLEDGE_NODE_UID, code));
    },
    async resolveSkill(code: string) {
      return skillsInPackage.has(code) || Boolean(await hasExisting(SKILL_UID, code));
    },
    async resolveFormula(code: string) {
      return formulasInPackage.has(code) || Boolean(await hasExisting(FORMULA_UID, code));
    },
    async resolveQuestion(code: string) {
      return questionsInPackage.has(code) || Boolean(await hasExisting(QUESTION_UID, code));
    },
    async resolveVisualAsset(code: string) {
      return visualAssetsInPackage.has(code) || Boolean(await hasExisting(VISUAL_ASSET_UID, code));
    },
    getExisting(cacheUid: string, code: string) {
      return existingCache.get(`${cacheUid}:${code}`);
    },
  };
}

async function previewSimpleItems(result: any, bucket: PreviewBucketKey, items: any[], tenantId: number | string, config: { uid: string; type: string; statusField: string; titleField?: string; extraValidate?: (item: any, result: any) => void; }) {
  for (const item of items) {
    const code = ensureRequiredText(item?.code, `${config.type}.code`);
    const title = normalizeText(item?.title) || code;
    config.extraValidate?.(item, result);
    const existing = await findByCode(config.uid, code, tenantId);
    const action = checkUpsertAction(existing, config.statusField);
    const currentStatus = existing ? normalizeText(existing?.[config.statusField]) || null : null;
    const message = action === 'create'
      ? 'Sẽ tạo mới'
      : action === 'update'
        ? 'Sẽ cập nhật bản ghi đang ở trạng thái cho phép'
        : 'Code đã tồn tại nhưng trạng thái hiện tại không cho phép cập nhật';

    pushPreviewItem(result, bucket, {
      type: config.type,
      code,
      title,
      action,
      currentStatus,
      message,
    });
  }
}

async function previewQuestions(result: any, questions: any[], tenantId: number | string) {
  for (const question of questions) {
    const code = ensureRequiredText(question?.code, 'question.code');
    const title = normalizeText(question?.title) || normalizeText(question?.questionText) || code;
    const existing = await findByCode(QUESTION_UID, code, tenantId);
    const action = checkUpsertAction(existing, 'questionStatus');
    const currentStatus = existing ? normalizeText(existing?.questionStatus) || null : null;
    const message = action === 'create'
      ? 'Sẽ tạo mới'
      : action === 'update'
        ? 'Sẽ cập nhật question draft/pending và tạo lại options'
        : 'Question đã tồn tại nhưng không ở trạng thái draft/pending';

    pushPreviewItem(result, 'questions', {
      type: 'question',
      code,
      title,
      action,
      currentStatus,
      message,
    });
  }
}

async function previewLearningObjects(result: any, learningObjects: any[], tenantId: number | string, resolvers: any) {
  for (const learningObject of learningObjects) {
    const code = ensureRequiredText(learningObject?.code, 'learningObject.code');
    const title = ensureRequiredText(learningObject?.title, 'learningObject.title');
    const relationErrors: string[] = [];

    for (const relationCode of normalizeArray(learningObject?.questions).map((item) => normalizeText(item)).filter(Boolean)) {
      if (!await resolvers.resolveQuestion(relationCode)) {
        relationErrors.push(`Không resolve được question code ${relationCode}`);
      }
    }

    for (const relationCode of normalizeArray(learningObject?.skills).map((item) => normalizeText(item)).filter(Boolean)) {
      if (!await resolvers.resolveSkill(relationCode)) {
        relationErrors.push(`Không resolve được skill code ${relationCode}`);
      }
    }

    for (const relationCode of normalizeArray(learningObject?.knowledgeNodes).map((item) => normalizeText(item)).filter(Boolean)) {
      if (!await resolvers.resolveKnowledgeNode(relationCode)) {
        relationErrors.push(`Không resolve được knowledgeNode code ${relationCode}`);
      }
    }

    for (const relationCode of normalizeArray(learningObject?.formulas).map((item) => normalizeText(item)).filter(Boolean)) {
      if (!await resolvers.resolveFormula(relationCode)) {
        relationErrors.push(`Không resolve được formula code ${relationCode}`);
      }
    }

    for (const relationCode of normalizeArray(learningObject?.visualAssets).map((item) => normalizeText(item)).filter(Boolean)) {
      if (!await resolvers.resolveVisualAsset(relationCode)) {
        relationErrors.push(`Không resolve được visualAsset code ${relationCode}`);
      }
    }

    const existing = await findByCode(LEARNING_OBJECT_UID, code, tenantId);
    const currentStatus = existing ? normalizeText(existing?.learningObjectStatus) || null : null;

    if (relationErrors.length > 0) {
      pushPreviewItem(result, 'learningObjects', {
        type: 'learningObject',
        code,
        title,
        action: 'error',
        currentStatus,
        message: relationErrors.join(' | '),
      });
      continue;
    }

    const action = checkUpsertAction(existing, 'learningObjectStatus');
    const message = action === 'create'
      ? 'Sẽ tạo mới learning object và content blocks'
      : action === 'update'
        ? 'Sẽ cập nhật learning object draft/pending và tạo lại content blocks'
        : 'Learning object đã tồn tại nhưng không ở trạng thái draft/pending';

    pushPreviewItem(result, 'learningObjects', {
      type: 'learningObject',
      code,
      title,
      action,
      currentStatus,
      message,
    });
  }
}

async function previewSubjectAndGrade(result: any, packageData: any, tenantId: number | string) {
  const subjectText = normalizeText(packageData?.packageInfo?.subject);
  const gradeText = normalizeText(packageData?.packageInfo?.grade);

  if (subjectText) {
    const existingSubject = await findSubjectByPackageValue(subjectText, tenantId);
    result.subjects.push({
      type: 'subject',
      code: subjectText,
      title: subjectText,
      action: existingSubject ? 'update' : 'create',
      currentStatus: existingSubject ? normalizeText(existingSubject?.subjectStatus) || null : null,
      message: existingSubject ? 'Sẽ dùng subject hiện có theo tenant' : 'Sẽ tạo mới subject theo packageInfo.subject',
    });
  }

  if (gradeText) {
    const existingGrade = await findGradeByPackageValue(gradeText, tenantId);
    result.grades.push({
      type: 'grade',
      code: gradeText,
      title: gradeText,
      action: existingGrade ? 'update' : 'create',
      currentStatus: existingGrade ? normalizeText(existingGrade?.gradeStatus) || null : null,
      message: existingGrade ? 'Sẽ dùng grade hiện có theo tenant' : 'Sẽ tạo mới grade theo packageInfo.grade',
    });
  }
}

async function computePreview(packageData: any, tenantId: number | string, user: any) {
  const result = createEmptyPreviewResult();
  const shapeErrors = validatePackageShape(packageData);
  result.shapeErrors = shapeErrors;
  result.errorCount += shapeErrors.length;

  if (shapeErrors.length > 0) {
    result.canImport = false;
    return result;
  }

  await previewSubjectAndGrade(result, packageData, tenantId);

  await previewSimpleItems(result, 'knowledgeNodes', normalizeArray(packageData.knowledgeNodes), tenantId, {
    uid: KNOWLEDGE_NODE_UID,
    type: 'knowledgeNode',
    statusField: 'knowledgeNodeStatus',
  });

  await previewSimpleItems(result, 'skills', normalizeArray(packageData.skills), tenantId, {
    uid: SKILL_UID,
    type: 'skill',
    statusField: 'skillStatus',
    extraValidate: (item, previewResult) => {
      if (!normalizeText(item?.level)) {
        pushWarning(previewResult, `Skill ${normalizeText(item?.code)} thiếu level, sẽ dùng mặc định understand`);
      }
    },
  });

  await previewSimpleItems(result, 'formulas', normalizeArray(packageData.formulas), tenantId, {
    uid: FORMULA_UID,
    type: 'formula',
    statusField: 'formulaStatus',
  });

  await previewSimpleItems(result, 'visualAssets', normalizeArray(packageData.visualAssets), tenantId, {
    uid: VISUAL_ASSET_UID,
    type: 'visualAsset',
    statusField: 'visualAssetStatus',
    extraValidate: (item, previewResult) => {
      if (!normalizeText(item?.type)) {
        pushWarning(previewResult, `VisualAsset ${normalizeText(item?.code)} thiếu type, sẽ dùng mặc định other`);
      }
    },
  });

  await previewQuestions(result, normalizeArray(packageData.questions), tenantId);

  const resolvers = await buildReferenceResolvers(packageData, tenantId);
  await previewLearningObjects(result, normalizeArray(packageData.learningObjects), tenantId, resolvers);

  result.canImport = result.blockedCount === 0 && result.errorCount === 0;
  return result;
}

async function ensureSubjectAndGrade(packageData: any, tenantId: number | string) {
  const subjectText = normalizeText(packageData?.packageInfo?.subject);
  const gradeText = normalizeText(packageData?.packageInfo?.grade);

  let subject = await findSubjectByPackageValue(subjectText, tenantId);
  if (!subject && subjectText) {
    const status = pickCreateStatus(SUBJECT_UID, 'subjectStatus', true) || 'active';
    const created = await strapi.db.query(SUBJECT_UID).create({
      data: {
        code: subjectText,
        title: subjectText,
        subjectStatus: status,
        tenant: tenantId,
      },
    });
    subject = created;
  }

  let grade = await findGradeByPackageValue(gradeText, tenantId);
  if (!grade && gradeText) {
    const status = pickCreateStatus(GRADE_UID, 'gradeStatus', true) || 'active';
    const created = await strapi.db.query(GRADE_UID).create({
      data: {
        code: gradeText,
        title: gradeText,
        gradeStatus: status,
        tenant: tenantId,
      },
    });
    grade = created;
  }

  return { subject, grade };
}

async function resolveCodeMap(uid: string, codes: string[], tenantId: number | string) {
  const map = new Map<string, any>();
  if (codes.length === 0) return map;

  const rows = await strapi.db.query(uid).findMany({
    where: mergeTenantWhere({ code: { $in: codes } }, tenantId),
  });

  for (const row of rows || []) {
    const code = normalizeText(row?.code);
    if (code) map.set(code, row);
  }

  return map;
}

async function upsertKnowledgeNodes(items: any[], ctx: any) {
  const { tenantId, subject, grade } = ctx;
  const resultMap = new Map<string, any>();

  for (const item of items) {
    const code = normalizeText(item?.code);
    const existing = await findByCode(KNOWLEDGE_NODE_UID, code, tenantId);
    const status = pickCreateStatus(KNOWLEDGE_NODE_UID, 'knowledgeNodeStatus', true) || 'active';
    const payload = {
      code,
      title: ensureRequiredText(item?.title, 'knowledgeNode.title'),
      description: normalizeText(item?.description) || null,
      subject: subject?.id || null,
      grade: grade?.id || null,
      order: Number(item?.order || 0) || 0,
      level: Number(item?.level || 0) || 0,
      knowledgeNodeStatus: existing?.knowledgeNodeStatus && ALLOWED_UPDATE_STATUSES.includes(normalizeText(existing.knowledgeNodeStatus).toLowerCase())
        ? existing.knowledgeNodeStatus
        : status,
      tenant: tenantId,
    };

    const row = existing
      ? await strapi.db.query(KNOWLEDGE_NODE_UID).update({ where: { id: existing.id }, data: payload })
      : await strapi.db.query(KNOWLEDGE_NODE_UID).create({ data: payload });

    resultMap.set(code, row);
  }

  for (const item of items) {
    const code = normalizeText(item?.code);
    const parentCode = normalizeText(item?.parent);
    if (!parentCode) continue;

    const row = resultMap.get(code);
    const parent = resultMap.get(parentCode) || await findByCode(KNOWLEDGE_NODE_UID, parentCode, tenantId);
    if (!row || !parent) continue;

    const updated = await strapi.db.query(KNOWLEDGE_NODE_UID).update({
      where: { id: row.id },
      data: { parent: parent.id },
    });
    resultMap.set(code, updated);
  }

  return resultMap;
}

async function upsertSkills(items: any[], ctx: any) {
  const { tenantId, subject, grade, knowledgeNodeMap } = ctx;
  const resultMap = new Map<string, any>();
  const status = pickCreateStatus(SKILL_UID, 'skillStatus', true) || 'active';

  for (const item of items) {
    const code = normalizeText(item?.code);
    const existing = await findByCode(SKILL_UID, code, tenantId);
    const knowledgeNodeCode = normalizeText(item?.knowledgeNode);
    const knowledgeNode = knowledgeNodeCode ? (knowledgeNodeMap.get(knowledgeNodeCode) || await findByCode(KNOWLEDGE_NODE_UID, knowledgeNodeCode, tenantId)) : null;
    const payload = {
      code,
      title: ensureRequiredText(item?.title, 'skill.title'),
      description: normalizeText(item?.description) || null,
      level: normalizeText(item?.level) || 'understand',
      skillStatus: existing?.skillStatus && ALLOWED_UPDATE_STATUSES.includes(normalizeText(existing.skillStatus).toLowerCase())
        ? existing.skillStatus
        : status,
      subject: subject?.id || null,
      grade: grade?.id || null,
      knowledgeNode: knowledgeNode?.id || null,
      tenant: tenantId,
    };
    const row = existing
      ? await strapi.db.query(SKILL_UID).update({ where: { id: existing.id }, data: payload })
      : await strapi.db.query(SKILL_UID).create({ data: payload });
    resultMap.set(code, row);
  }

  return resultMap;
}

async function upsertFormulas(items: any[], ctx: any) {
  const { tenantId, subject, grade, knowledgeNodeMap } = ctx;
  const resultMap = new Map<string, any>();
  const status = pickCreateStatus(FORMULA_UID, 'formulaStatus', true) || 'active';

  for (const item of items) {
    const code = normalizeText(item?.code);
    const existing = await findByCode(FORMULA_UID, code, tenantId);
    const knowledgeNodeCode = normalizeText(item?.knowledgeNode);
    const knowledgeNode = knowledgeNodeCode ? (knowledgeNodeMap.get(knowledgeNodeCode) || await findByCode(KNOWLEDGE_NODE_UID, knowledgeNodeCode, tenantId)) : null;
    const payload = {
      code,
      title: ensureRequiredText(item?.title, 'formula.title'),
      description: normalizeText(item?.description) || null,
      latex: normalizeText(item?.latex) || null,
      plainText: normalizeText(item?.plainText) || null,
      examples: item?.examples ?? null,
      formulaStatus: existing?.formulaStatus && ALLOWED_UPDATE_STATUSES.includes(normalizeText(existing.formulaStatus).toLowerCase())
        ? existing.formulaStatus
        : status,
      subject: subject?.id || null,
      grade: grade?.id || null,
      knowledgeNode: knowledgeNode?.id || null,
      tenant: tenantId,
    };
    const row = existing
      ? await strapi.db.query(FORMULA_UID).update({ where: { id: existing.id }, data: payload })
      : await strapi.db.query(FORMULA_UID).create({ data: payload });
    resultMap.set(code, row);
  }

  return resultMap;
}

async function upsertVisualAssets(items: any[], ctx: any) {
  const { tenantId, subject, grade, knowledgeNodeMap } = ctx;
  const resultMap = new Map<string, any>();
  const status = pickCreateStatus(VISUAL_ASSET_UID, 'visualAssetStatus', true) || 'active';

  for (const item of items) {
    const code = normalizeText(item?.code);
    const existing = await findByCode(VISUAL_ASSET_UID, code, tenantId);
    const knowledgeNodeCode = normalizeText(item?.knowledgeNode);
    const knowledgeNode = knowledgeNodeCode ? (knowledgeNodeMap.get(knowledgeNodeCode) || await findByCode(KNOWLEDGE_NODE_UID, knowledgeNodeCode, tenantId)) : null;
    const payload = {
      code,
      title: ensureRequiredText(item?.title, 'visualAsset.title'),
      type: normalizeText(item?.type) || 'other',
      url: normalizeText(item?.url) || null,
      description: normalizeText(item?.description) || null,
      altText: normalizeText(item?.altText) || null,
      visualAssetStatus: existing?.visualAssetStatus && ALLOWED_UPDATE_STATUSES.includes(normalizeText(existing.visualAssetStatus).toLowerCase())
        ? existing.visualAssetStatus
        : status,
      subject: subject?.id || null,
      grade: grade?.id || null,
      knowledgeNode: knowledgeNode?.id || null,
      tenant: tenantId,
    };
    const row = existing
      ? await strapi.db.query(VISUAL_ASSET_UID).update({ where: { id: existing.id }, data: payload })
      : await strapi.db.query(VISUAL_ASSET_UID).create({ data: payload });
    resultMap.set(code, row);
  }

  return resultMap;
}

async function replaceQuestionOptions(questionId: number, options: any[], tenantId: number | string) {
  const existingOptions = await strapi.db.query(QUESTION_OPTION_UID).findMany({
    where: mergeTenantWhere({ question: { id: { $eq: questionId } } }, tenantId),
    select: ['id'],
  });

  for (const option of existingOptions || []) {
    await strapi.db.query(QUESTION_OPTION_UID).delete({ where: { id: option.id } });
  }

  for (let index = 0; index < options.length; index += 1) {
    const option = options[index];
    await strapi.db.query(QUESTION_OPTION_UID).create({
      data: {
        label: normalizeText(option?.label) || null,
        value: normalizeText(option?.value) || null,
        content: normalizeText(option?.content) || null,
        isCorrect: option?.isCorrect === true,
        order: Number(option?.order ?? index + 1) || index + 1,
        explanation: normalizeText(option?.explanation) || null,
        question: questionId,
        tenant: tenantId,
      },
    });
  }
}

async function upsertQuestions(items: any[], ctx: any) {
  const { tenantId, subject, grade, knowledgeNodeMap, skillMap, formulaMap } = ctx;
  const resultMap = new Map<string, any>();
  const status = pickCreateStatus(QUESTION_UID, 'questionStatus', true) || 'draft';

  for (const item of items) {
    const code = normalizeText(item?.code);
    const existing = await findByCode(QUESTION_UID, code, tenantId);
    const knowledgeNodeCode = normalizeText(item?.knowledgeNode);
    const knowledgeNode = knowledgeNodeCode ? (knowledgeNodeMap.get(knowledgeNodeCode) || await findByCode(KNOWLEDGE_NODE_UID, knowledgeNodeCode, tenantId)) : null;
    const skillIds = [] as number[];
    for (const ref of normalizeArray(item?.skills).map((value) => normalizeText(value)).filter(Boolean)) {
      const skill = skillMap.get(ref) || await findByCode(SKILL_UID, ref, tenantId);
      if (skill?.id) skillIds.push(skill.id);
    }
    const formulaIds = [] as number[];
    for (const ref of normalizeArray(item?.formulas).map((value) => normalizeText(value)).filter(Boolean)) {
      const formula = formulaMap.get(ref) || await findByCode(FORMULA_UID, ref, tenantId);
      if (formula?.id) formulaIds.push(formula.id);
    }

    const payload = {
      code,
      title: normalizeText(item?.title) || code,
      questionText: ensureRequiredText(item?.questionText, 'question.questionText'),
      type: ensureRequiredText(item?.type, 'question.type'),
      difficulty: normalizeText(item?.difficulty) || null,
      correctAnswer: item?.correctAnswer ?? null,
      explanation: normalizeText(item?.explanation) || null,
      rubric: item?.rubric ?? null,
      questionStatus: existing?.questionStatus && ALLOWED_UPDATE_STATUSES.includes(normalizeText(existing.questionStatus).toLowerCase())
        ? existing.questionStatus
        : status,
      subject: subject?.id || null,
      grade: grade?.id || null,
      knowledgeNode: knowledgeNode?.id || null,
      skills: skillIds,
      formulas: formulaIds,
      tenant: tenantId,
    };

    const row = existing
      ? await strapi.db.query(QUESTION_UID).update({ where: { id: existing.id }, data: payload })
      : await strapi.db.query(QUESTION_UID).create({ data: payload });

    await replaceQuestionOptions(row.id, normalizeArray(item?.options), tenantId);
    resultMap.set(code, row);
  }

  return resultMap;
}

async function replaceContentBlocks(learningObjectId: number, blocks: any[], tenantId: number | string, relationMaps: any) {
  const existingBlocks = await strapi.db.query(CONTENT_BLOCK_UID).findMany({
    where: mergeTenantWhere({ learningObject: { id: { $eq: learningObjectId } } }, tenantId),
    select: ['id'],
  });

  for (const block of existingBlocks || []) {
    await strapi.db.query(CONTENT_BLOCK_UID).delete({ where: { id: block.id } });
  }

  for (let index = 0; index < blocks.length; index += 1) {
    const block = blocks[index];
    const formulaCode = normalizeText(block?.formula);
    const questionCode = normalizeText(block?.question);
    const visualAssetCode = normalizeText(block?.visualAsset);
    const formula = formulaCode ? relationMaps.formulaMap.get(formulaCode) || await findByCode(FORMULA_UID, formulaCode, tenantId) : null;
    const question = questionCode ? relationMaps.questionMap.get(questionCode) || await findByCode(QUESTION_UID, questionCode, tenantId) : null;
    const visualAsset = visualAssetCode ? relationMaps.visualAssetMap.get(visualAssetCode) || await findByCode(VISUAL_ASSET_UID, visualAssetCode, tenantId) : null;

    await strapi.db.query(CONTENT_BLOCK_UID).create({
      data: {
        learningObject: learningObjectId,
        type: ensureRequiredText(block?.type, 'contentBlock.type'),
        title: normalizeText(block?.title) || null,
        order: Number(block?.order ?? index + 1) || index + 1,
        content: normalizeText(block?.content) || null,
        htmlContent: normalizeText(block?.htmlContent) || null,
        formula: formula?.id || null,
        question: question?.id || null,
        visualAsset: visualAsset?.id || null,
        config: block?.config ?? null,
        contentBlockStatus: pickCreateStatus(CONTENT_BLOCK_UID, 'contentBlockStatus', false) || 'active',
        tenant: tenantId,
      },
    });
  }
}

async function upsertLearningObjects(items: any[], ctx: any) {
  const { tenantId, subject, grade, knowledgeNodeMap, skillMap, formulaMap, visualAssetMap, questionMap } = ctx;
  const resultMap = new Map<string, any>();
  const status = pickCreateStatus(LEARNING_OBJECT_UID, 'learningObjectStatus', true) || 'draft';

  for (const item of items) {
    const code = normalizeText(item?.code);
    const existing = await findByCode(LEARNING_OBJECT_UID, code, tenantId);
    const knowledgeNodeIds = [] as number[];
    for (const ref of normalizeArray(item?.knowledgeNodes).map((value) => normalizeText(value)).filter(Boolean)) {
      const node = knowledgeNodeMap.get(ref) || await findByCode(KNOWLEDGE_NODE_UID, ref, tenantId);
      if (node?.id) knowledgeNodeIds.push(node.id);
    }
    const skillIds = [] as number[];
    for (const ref of normalizeArray(item?.skills).map((value) => normalizeText(value)).filter(Boolean)) {
      const skill = skillMap.get(ref) || await findByCode(SKILL_UID, ref, tenantId);
      if (skill?.id) skillIds.push(skill.id);
    }
    const formulaIds = [] as number[];
    for (const ref of normalizeArray(item?.formulas).map((value) => normalizeText(value)).filter(Boolean)) {
      const formula = formulaMap.get(ref) || await findByCode(FORMULA_UID, ref, tenantId);
      if (formula?.id) formulaIds.push(formula.id);
    }
    const visualAssetIds = [] as number[];
    for (const ref of normalizeArray(item?.visualAssets).map((value) => normalizeText(value)).filter(Boolean)) {
      const visualAsset = visualAssetMap.get(ref) || await findByCode(VISUAL_ASSET_UID, ref, tenantId);
      if (visualAsset?.id) visualAssetIds.push(visualAsset.id);
    }
    const questionIds = [] as number[];
    for (const ref of normalizeArray(item?.questions).map((value) => normalizeText(value)).filter(Boolean)) {
      const question = questionMap.get(ref) || await findByCode(QUESTION_UID, ref, tenantId);
      if (question?.id) questionIds.push(question.id);
    }

    const payload = {
      code,
      title: ensureRequiredText(item?.title, 'learningObject.title'),
      slug: normalizeText(existing?.slug) || slugify(normalizeText(item?.code) || normalizeText(item?.title)),
      description: normalizeText(item?.description) || null,
      version: normalizeText(item?.version || ctx.packageInfo?.version) || null,
      learningObjectStatus: existing?.learningObjectStatus && ALLOWED_UPDATE_STATUSES.includes(normalizeText(existing.learningObjectStatus).toLowerCase())
        ? existing.learningObjectStatus
        : status,
      difficulty: normalizeText(item?.difficulty) || null,
      estimatedMinutes: Number(item?.estimatedMinutes || 0) || 0,
      learningObjectives: item?.learningObjectives ?? null,
      tags: item?.tags ?? null,
      metadata: item?.metadata ?? null,
      subject: subject?.id || null,
      grade: grade?.id || null,
      knowledgeNodes: knowledgeNodeIds,
      skills: skillIds,
      formulas: formulaIds,
      visualAssets: visualAssetIds,
      questions: questionIds,
      tenant: tenantId,
    };

    const row = existing
      ? await strapi.db.query(LEARNING_OBJECT_UID).update({ where: { id: existing.id }, data: payload })
      : await strapi.db.query(LEARNING_OBJECT_UID).create({ data: payload });

    await replaceContentBlocks(row.id, normalizeArray(item?.contentBlocks), tenantId, {
      formulaMap,
      questionMap,
      visualAssetMap,
    });

    resultMap.set(code, row);
  }

  return resultMap;
}

async function executeImport(packageData: any, tenantId: number | string) {
  const { subject, grade } = await ensureSubjectAndGrade(packageData, tenantId);
  const knowledgeNodeMap = await upsertKnowledgeNodes(normalizeArray(packageData.knowledgeNodes), { tenantId, subject, grade });
  const skillMap = await upsertSkills(normalizeArray(packageData.skills), { tenantId, subject, grade, knowledgeNodeMap });
  const formulaMap = await upsertFormulas(normalizeArray(packageData.formulas), { tenantId, subject, grade, knowledgeNodeMap });
  const visualAssetMap = await upsertVisualAssets(normalizeArray(packageData.visualAssets), { tenantId, subject, grade, knowledgeNodeMap });
  const questionMap = await upsertQuestions(normalizeArray(packageData.questions), { tenantId, subject, grade, knowledgeNodeMap, skillMap, formulaMap });
  const learningObjectMap = await upsertLearningObjects(normalizeArray(packageData.learningObjects), {
    tenantId,
    subject,
    grade,
    packageInfo: packageData?.packageInfo || {},
    knowledgeNodeMap,
    skillMap,
    formulaMap,
    visualAssetMap,
    questionMap,
  });

  return {
    subject,
    grade,
    knowledgeNodeMap,
    skillMap,
    formulaMap,
    visualAssetMap,
    questionMap,
    learningObjectMap,
  };
}

async function withOptionalTransaction<T>(callback: () => Promise<T>): Promise<T> {
  const db: any = strapi.db as any;
  if (typeof db?.transaction === 'function') {
    return db.transaction(callback);
  }
  return callback();
}

export default {
  validatePackageShape,

  async resolveExistingByCode(type: string, code: string, tenantId: number | string) {
    const uidMap: Record<string, string> = {
      subject: SUBJECT_UID,
      grade: GRADE_UID,
      knowledgeNode: KNOWLEDGE_NODE_UID,
      skill: SKILL_UID,
      formula: FORMULA_UID,
      visualAsset: VISUAL_ASSET_UID,
      question: QUESTION_UID,
      learningObject: LEARNING_OBJECT_UID,
    };

    const uid = uidMap[type];
    if (!uid) return null;
    return findByCode(uid, code, tenantId);
  },

  checkUpsertAction,

  async previewPackage(packageData: any, tenantId: number | string, user: any) {
    return computePreview(packageData, tenantId, user);
  },

  async importPackage(packageData: any, tenantId: number | string, user: any) {
    const preview = await computePreview(packageData, tenantId, user);
    if (!preview.canImport) {
      throw new LearningPackageImportError(409, 'Có dữ liệu đang ở trạng thái không được phép cập nhật hoặc có lỗi. Vui lòng xử lý trước khi import.');
    }

    const imported = await withOptionalTransaction(() => executeImport(packageData, tenantId));

    return {
      ...preview,
      success: true,
      imported: {
        subjects: imported.subject ? 1 : 0,
        grades: imported.grade ? 1 : 0,
        knowledgeNodes: imported.knowledgeNodeMap.size,
        skills: imported.skillMap.size,
        formulas: imported.formulaMap.size,
        visualAssets: imported.visualAssetMap.size,
        questions: imported.questionMap.size,
        learningObjects: imported.learningObjectMap.size,
      },
    };
  },
};
