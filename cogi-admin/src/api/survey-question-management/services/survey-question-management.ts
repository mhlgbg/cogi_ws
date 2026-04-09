import { mergeTenantWhere, resolveCurrentTenantId } from '../../../utils/tenant-scope';

const SURVEY_TEMPLATE_UID = 'api::survey-template.survey-template';
const SURVEY_SECTION_UID = 'api::survey-section.survey-section';
const SURVEY_QUESTION_UID = 'api::survey-question.survey-question';
const SURVEY_QUESTION_OPTION_UID = 'api::survey-question-option.survey-question-option';
const SURVEY_CAMPAIGN_UID = 'api::survey-campaign.survey-campaign';
const SURVEY_ANSWER_UID = 'api::survey-answer.survey-answer';
const SURVEY_RESPONSE_UID = 'api::survey-response.survey-response';

const QUESTION_TYPES = ['LIKERT_1_5', 'SINGLE_CHOICE', 'MULTI_CHOICE', 'TEXT'] as const;
const TEMPLATE_TYPES = ['TEACHING_EVALUATION', 'GRADUATION_EXIT'] as const;
const CHOICE_QUESTION_TYPES = new Set(['LIKERT_1_5', 'SINGLE_CHOICE', 'MULTI_CHOICE']);

type QuestionType = typeof QUESTION_TYPES[number];
type TemplateType = typeof TEMPLATE_TYPES[number];

class SurveyQuestionManagementError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

function toText(value: unknown): string {
  if (value === null || value === undefined) return '';
  return String(value).trim();
}

function toNullableText(value: unknown): string | null {
  const text = toText(value);
  return text || null;
}

function toPositiveInt(value: unknown): number | null {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

function toNonNegativeInt(value: unknown, fallback = 0): number {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 0) return fallback;
  return parsed;
}

function toBoolean(value: unknown, fallback = false): boolean {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value !== 0;
  const text = toText(value).toLowerCase();
  if (!text) return fallback;
  return ['true', '1', 'yes', 'on'].includes(text);
}

function toPaginationInt(value: unknown, fallback: number): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.floor(parsed);
}

function isQuestionType(value: unknown): value is QuestionType {
  return QUESTION_TYPES.includes(String(value) as QuestionType);
}

function isTemplateType(value: unknown): value is TemplateType {
  return TEMPLATE_TYPES.includes(String(value) as TemplateType);
}

function parseIdOrThrow(value: unknown, label: string): number {
  const parsed = toPositiveInt(value);
  if (!parsed) {
    throw new SurveyQuestionManagementError(400, `${label} is invalid`);
  }
  return parsed;
}

async function findTemplateOrThrow(id: unknown, tenantId: number | string) {
  const templateId = parseIdOrThrow(id, 'Survey template id');
  const template = await strapi.db.query(SURVEY_TEMPLATE_UID).findOne({
    where: mergeTenantWhere({ id: templateId }, tenantId),
    select: ['id', 'name', 'code', 'description', 'type', 'isActive'],
  });

  if (!template?.id) {
    throw new SurveyQuestionManagementError(404, 'Survey template not found');
  }

  return template;
}

async function findSectionOrThrow(id: unknown, tenantId: number | string) {
  const sectionId = parseIdOrThrow(id, 'Survey section id');
  const section = await strapi.db.query(SURVEY_SECTION_UID).findOne({
    where: mergeTenantWhere({ id: sectionId }, tenantId),
    select: ['id', 'title', 'order'],
    populate: {
      survey_template: {
        select: ['id', 'name', 'code', 'type'],
      },
    },
  });

  if (!section?.id) {
    throw new SurveyQuestionManagementError(404, 'Survey section not found');
  }

  return section;
}

async function findQuestionOrThrow(id: unknown, tenantId: number | string) {
  const questionId = parseIdOrThrow(id, 'Survey question id');
  const question = await strapi.db.query(SURVEY_QUESTION_UID).findOne({
    where: mergeTenantWhere({ id: questionId }, tenantId),
    select: ['id', 'content', 'type', 'isRequired', 'order'],
    populate: {
      survey_section: {
        select: ['id', 'title', 'order'],
        populate: {
          survey_template: {
            select: ['id', 'name', 'code', 'type'],
          },
        },
      },
      survey_question_options: {
        select: ['id', 'label', 'value', 'order'],
      },
    },
  });

  if (!question?.id) {
    throw new SurveyQuestionManagementError(404, 'Survey question not found');
  }

  return question;
}

async function ensureTemplateCodeAvailable(code: string, excludeId?: number) {
  const existing = await strapi.db.query(SURVEY_TEMPLATE_UID).findOne({
    where: {
      code,
      ...(excludeId ? { id: { $ne: excludeId } } : {}),
    },
    select: ['id'],
  });

  if (existing?.id) {
    throw new SurveyQuestionManagementError(409, 'Survey template code already exists');
  }
}

function normalizeOptionPayload(options: unknown) {
  if (!Array.isArray(options)) return [];

  return options
    .map((item, index) => {
      const label = toText((item as any)?.label);
      const value = toText((item as any)?.value);
      const order = toNonNegativeInt((item as any)?.order, index);

      if (!label || !value) return null;
      return { label, value, order };
    })
    .filter(Boolean) as Array<{ label: string; value: string; order: number }>;
}

function normalizeStoredOptions(options: any[]) {
  return [...(options || [])]
    .map((item) => ({
      label: toText(item?.label),
      value: toText(item?.value),
      order: toNonNegativeInt(item?.order, 0),
    }))
    .sort((left, right) => left.order - right.order || left.label.localeCompare(right.label));
}

function optionsEqual(left: any[], right: any[]) {
  if (left.length !== right.length) return false;

  return left.every((item, index) => {
    const candidate = right[index];
    return item.label === candidate?.label
      && item.value === candidate?.value
      && item.order === candidate?.order;
  });
}

function mapTemplateRow(template: any, stats?: { sectionCount?: number; questionCount?: number; sections?: any[] }) {
  return {
    id: template.id,
    name: template.name,
    code: template.code,
    description: template.description || '',
    type: template.type,
    isActive: template.isActive !== false,
    sectionCount: Number(stats?.sectionCount || 0),
    questionCount: Number(stats?.questionCount || 0),
    sections: Array.isArray(stats?.sections) ? stats.sections : [],
  };
}

function mapSectionRow(section: any, questionCount = 0) {
  return {
    id: section.id,
    title: section.title,
    order: Number(section.order || 0),
    questionCount: Number(questionCount || 0),
    template: section.survey_template
      ? {
        id: section.survey_template.id,
        name: section.survey_template.name,
        code: section.survey_template.code,
        type: section.survey_template.type,
      }
      : null,
  };
}

function mapQuestionRow(question: any, answerCount = 0) {
  const options = Array.isArray(question?.survey_question_options)
    ? [...question.survey_question_options]
      .map((item: any) => ({
        id: item.id,
        label: item.label || '',
        value: item.value || '',
        order: Number(item.order || 0),
      }))
      .sort((left, right) => left.order - right.order || left.id - right.id)
    : [];

  return {
    id: question.id,
    content: question.content,
    type: question.type,
    isRequired: question.isRequired === true,
    order: Number(question.order || 0),
    answerCount: Number(answerCount || 0),
    section: question.survey_section
      ? {
        id: question.survey_section.id,
        title: question.survey_section.title,
        order: Number(question.survey_section.order || 0),
      }
      : null,
    template: question?.survey_section?.survey_template
      ? {
        id: question.survey_section.survey_template.id,
        name: question.survey_section.survey_template.name,
        code: question.survey_section.survey_template.code,
        type: question.survey_section.survey_template.type,
      }
      : null,
    options,
  };
}

async function loadSectionQuestionCounts(sectionIds: number[], tenantId: number | string) {
  const counts = new Map<number, number>();
  if (sectionIds.length === 0) return counts;

  const questions = await strapi.db.query(SURVEY_QUESTION_UID).findMany({
    where: mergeTenantWhere({
      survey_section: {
        id: {
          $in: sectionIds,
        },
      },
    }, tenantId),
    select: ['id'],
    populate: {
      survey_section: {
        select: ['id'],
      },
    },
  });

  for (const question of questions || []) {
    const sectionId = Number(question?.survey_section?.id || 0);
    if (!sectionId) continue;
    counts.set(sectionId, Number(counts.get(sectionId) || 0) + 1);
  }

  return counts;
}

async function loadQuestionAnswerCounts(questionIds: number[], tenantId: number | string) {
  const counts = new Map<number, number>();
  if (questionIds.length === 0) return counts;

  const answers = await strapi.db.query(SURVEY_ANSWER_UID).findMany({
    where: mergeTenantWhere({
      survey_question: {
        id: {
          $in: questionIds,
        },
      },
      survey_response: {
        $or: [
          {
            responseStatus: 'SUBMITTED',
          },
          {
            responseStatus: {
              $null: true,
            },
            submittedAt: {
              $notNull: true,
            },
          },
        ],
      },
    }, tenantId),
    select: ['id'],
    populate: {
      survey_question: {
        select: ['id'],
      },
    },
  });

  for (const answer of answers || []) {
    const questionId = Number(answer?.survey_question?.id || 0);
    if (!questionId) continue;
    counts.set(questionId, Number(counts.get(questionId) || 0) + 1);
  }

  return counts;
}

async function removeQuestionOptions(questionId: number, tenantId: number | string) {
  const existingOptions = await strapi.db.query(SURVEY_QUESTION_OPTION_UID).findMany({
    where: mergeTenantWhere({
      survey_question: {
        id: {
          $eq: questionId,
        },
      },
    }, tenantId),
    select: ['id'],
  });

  for (const option of existingOptions || []) {
    if (!option?.id) continue;
    await strapi.db.query(SURVEY_QUESTION_OPTION_UID).delete({
      where: { id: option.id },
    });
  }
}

async function createQuestionOptions(questionId: number, tenantId: number | string, options: Array<{ label: string; value: string; order: number }>) {
  for (const option of options) {
    await strapi.db.query(SURVEY_QUESTION_OPTION_UID).create({
      data: {
        label: option.label,
        value: option.value,
        order: option.order,
        survey_question: questionId,
        tenant: tenantId,
      },
    });
  }
}

async function getQuestionAnswerCount(questionId: number, tenantId: number | string) {
  return strapi.db.query(SURVEY_ANSWER_UID).count({
    where: mergeTenantWhere({
      survey_question: {
        id: {
          $eq: questionId,
        },
      },
      survey_response: {
        $or: [
          {
            responseStatus: 'SUBMITTED',
          },
          {
            responseStatus: {
              $null: true,
            },
            submittedAt: {
              $notNull: true,
            },
          },
        ],
      },
    }, tenantId),
  });
}

async function hasQuestionSubmittedAnswers(questionId: number, tenantId: number | string) {
  const response = await strapi.db.query(SURVEY_RESPONSE_UID).findOne({
    where: mergeTenantWhere({
      $or: [
        {
          responseStatus: 'SUBMITTED',
        },
        {
          responseStatus: {
            $null: true,
          },
          submittedAt: {
            $notNull: true,
          },
        },
      ],
      survey_answers: {
        survey_question: {
          id: {
            $eq: questionId,
          },
        },
      },
    }, tenantId),
    select: ['id'],
  });

  return Boolean(response?.id);
}

function sanitizeQuestionPayload(body: any) {
  const content = toText(body?.content);
  const type = toText(body?.type);
  const sectionId = toPositiveInt(body?.sectionId);
  const order = toNonNegativeInt(body?.order, 0);
  const isRequired = toBoolean(body?.isRequired, false);

  if (!content) {
    throw new SurveyQuestionManagementError(400, 'Question content is required');
  }

  if (!isQuestionType(type)) {
    throw new SurveyQuestionManagementError(400, 'Question type is invalid');
  }

  if (!sectionId) {
    throw new SurveyQuestionManagementError(400, 'Survey section is required');
  }

  const options = CHOICE_QUESTION_TYPES.has(type)
    ? normalizeOptionPayload(body?.options)
    : [];

  if (CHOICE_QUESTION_TYPES.has(type) && options.length === 0) {
    throw new SurveyQuestionManagementError(400, 'Choice questions must have at least one option');
  }

  return {
    content,
    type,
    sectionId,
    order,
    isRequired,
    options,
  };
}

export function getTenantIdFromContext(ctx: any) {
  return resolveCurrentTenantId(ctx);
}

export async function getSurveyQuestionManagementBootstrap(tenantId: number | string) {
  const [templates, sections] = await Promise.all([
    strapi.db.query(SURVEY_TEMPLATE_UID).findMany({
      where: mergeTenantWhere({}, tenantId),
      select: ['id', 'name', 'code', 'description', 'type', 'isActive'],
      orderBy: [{ type: 'asc' }, { name: 'asc' }, { id: 'asc' }],
    }),
    strapi.db.query(SURVEY_SECTION_UID).findMany({
      where: mergeTenantWhere({}, tenantId),
      select: ['id', 'title', 'order'],
      orderBy: [{ order: 'asc' }, { title: 'asc' }, { id: 'asc' }],
      populate: {
        survey_template: {
          select: ['id', 'name', 'code', 'type'],
        },
      },
    }),
  ]);

  const sectionIds = (sections || []).map((item: any) => Number(item?.id || 0)).filter((id: number) => id > 0);
  const sectionQuestionCounts = await loadSectionQuestionCounts(sectionIds, tenantId);
  const templateStats = new Map<number, { sectionCount: number; questionCount: number; sections: any[] }>();

  for (const section of sections || []) {
    const templateId = Number(section?.survey_template?.id || 0);
    if (!templateId) continue;

    const stats = templateStats.get(templateId) || { sectionCount: 0, questionCount: 0, sections: [] };
    stats.sectionCount += 1;

    const questionCount = Number(sectionQuestionCounts.get(Number(section.id)) || 0);
    stats.questionCount += questionCount;
    stats.sections.push(mapSectionRow(section, questionCount));
    templateStats.set(templateId, stats);
  }

  return {
    templates: (templates || []).map((template: any) => {
      const stats = templateStats.get(Number(template?.id || 0));
      return mapTemplateRow(template, stats);
    }),
    questionTypes: [...QUESTION_TYPES],
    templateTypes: [...TEMPLATE_TYPES],
  };
}

export async function listSurveyQuestions(query: Record<string, unknown>, tenantId: number | string) {
  const page = toPaginationInt(query?.page, 1);
  const pageSize = toPaginationInt(query?.pageSize, 10);
  const start = (page - 1) * pageSize;

  const q = toText(query?.q);
  const templateId = toPositiveInt(query?.templateId);
  const sectionId = toPositiveInt(query?.sectionId);
  const type = toText(query?.type);
  const includeInactive = toBoolean(query?.includeInactive, false);

  const baseWhere: Record<string, unknown> = {};

  if (q) {
    baseWhere.content = { $containsi: q };
  }

  if (sectionId) {
    baseWhere.survey_section = {
      ...(baseWhere.survey_section as Record<string, unknown> || {}),
      id: {
        $eq: sectionId,
      },
    };
  }

  if (templateId) {
    baseWhere.survey_section = {
      ...(baseWhere.survey_section as Record<string, unknown> || {}),
      survey_template: {
        id: {
          $eq: templateId,
        },
        ...(includeInactive ? {} : { isActive: { $eq: true } }),
      },
    };
  } else if (!includeInactive) {
    baseWhere.survey_section = {
      ...(baseWhere.survey_section as Record<string, unknown> || {}),
      survey_template: {
        ...(baseWhere.survey_section as Record<string, any>)?.survey_template,
        isActive: {
          $eq: true,
        },
      },
    };
  }

  if (type && isQuestionType(type)) {
    baseWhere.type = { $eq: type };
  }

  const where = mergeTenantWhere(baseWhere, tenantId);
  const [rows, total] = await Promise.all([
    strapi.db.query(SURVEY_QUESTION_UID).findMany({
      where,
      offset: start,
      limit: pageSize,
      orderBy: [{ order: 'asc' }, { id: 'asc' }],
      select: ['id', 'content', 'type', 'isRequired', 'order'],
      populate: {
        survey_section: {
          select: ['id', 'title', 'order'],
          populate: {
            survey_template: {
              select: ['id', 'name', 'code', 'type', 'isActive'],
            },
          },
        },
        survey_question_options: {
          select: ['id', 'label', 'value', 'order'],
        },
      },
    }),
    strapi.db.query(SURVEY_QUESTION_UID).count({ where }),
  ]);

  const questionIds = (rows || []).map((item: any) => Number(item?.id || 0)).filter((id: number) => id > 0);
  const answerCounts = await loadQuestionAnswerCounts(questionIds, tenantId);

  return {
    data: (rows || []).map((question: any) => mapQuestionRow(question, answerCounts.get(Number(question.id)) || 0)),
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

export async function createSurveyTemplate(body: any, tenantId: number | string) {
  const name = toText(body?.name);
  const code = toText(body?.code);
  const description = toNullableText(body?.description);
  const type = toText(body?.type);
  const isActive = toBoolean(body?.isActive, true);

  if (!name) {
    throw new SurveyQuestionManagementError(400, 'Template name is required');
  }

  if (!code) {
    throw new SurveyQuestionManagementError(400, 'Template code is required');
  }

  if (!isTemplateType(type)) {
    throw new SurveyQuestionManagementError(400, 'Template type is invalid');
  }

  await ensureTemplateCodeAvailable(code);

  const created = await strapi.db.query(SURVEY_TEMPLATE_UID).create({
    data: {
      name,
      code,
      description,
      type,
      isActive,
      tenant: tenantId,
    },
  });

  const reloaded = await findTemplateOrThrow(created.id, tenantId);
  return mapTemplateRow(reloaded);
}

export async function updateSurveyTemplate(id: unknown, body: any, tenantId: number | string) {
  const existing = await findTemplateOrThrow(id, tenantId);
  const name = toText(body?.name);
  const code = toText(body?.code);
  const description = toNullableText(body?.description);
  const type = toText(body?.type);
  const isActive = toBoolean(body?.isActive, true);

  if (!name) {
    throw new SurveyQuestionManagementError(400, 'Template name is required');
  }

  if (!code) {
    throw new SurveyQuestionManagementError(400, 'Template code is required');
  }

  if (!isTemplateType(type)) {
    throw new SurveyQuestionManagementError(400, 'Template type is invalid');
  }

  await ensureTemplateCodeAvailable(code, existing.id);

  await strapi.db.query(SURVEY_TEMPLATE_UID).update({
    where: { id: existing.id },
    data: {
      name,
      code,
      description,
      type,
      isActive,
      tenant: tenantId,
    },
  });

  const reloaded = await findTemplateOrThrow(existing.id, tenantId);
  return mapTemplateRow(reloaded);
}

export async function deleteSurveyTemplate(id: unknown, tenantId: number | string) {
  const existing = await findTemplateOrThrow(id, tenantId);
  const [sectionCount, campaignCount] = await Promise.all([
    strapi.db.query(SURVEY_SECTION_UID).count({
      where: mergeTenantWhere({
        survey_template: {
          id: {
            $eq: existing.id,
          },
        },
      }, tenantId),
    }),
    strapi.db.query(SURVEY_CAMPAIGN_UID).count({
      where: mergeTenantWhere({
        survey_template: {
          id: {
            $eq: existing.id,
          },
        },
      }, tenantId),
    }),
  ]);

  if (sectionCount > 0) {
    throw new SurveyQuestionManagementError(409, 'Cannot delete template that still has sections');
  }

  if (campaignCount > 0) {
    throw new SurveyQuestionManagementError(409, 'Cannot delete template that is already used by survey campaigns');
  }

  await strapi.db.query(SURVEY_TEMPLATE_UID).delete({ where: { id: existing.id } });
  return { id: existing.id };
}

export async function createSurveySection(body: any, tenantId: number | string) {
  const title = toText(body?.title);
  const templateId = parseIdOrThrow(body?.templateId, 'Survey template id');
  const order = toNonNegativeInt(body?.order, 0);

  if (!title) {
    throw new SurveyQuestionManagementError(400, 'Section title is required');
  }

  const template = await findTemplateOrThrow(templateId, tenantId);
  const created = await strapi.db.query(SURVEY_SECTION_UID).create({
    data: {
      title,
      order,
      survey_template: template.id,
      tenant: tenantId,
    },
  });

  const reloaded = await findSectionOrThrow(created.id, tenantId);
  return mapSectionRow(reloaded, 0);
}

export async function updateSurveySection(id: unknown, body: any, tenantId: number | string) {
  const existing = await findSectionOrThrow(id, tenantId);
  const title = toText(body?.title);
  const templateId = parseIdOrThrow(body?.templateId, 'Survey template id');
  const order = toNonNegativeInt(body?.order, 0);

  if (!title) {
    throw new SurveyQuestionManagementError(400, 'Section title is required');
  }

  const template = await findTemplateOrThrow(templateId, tenantId);
  await strapi.db.query(SURVEY_SECTION_UID).update({
    where: { id: existing.id },
    data: {
      title,
      order,
      survey_template: template.id,
      tenant: tenantId,
    },
  });

  const reloaded = await findSectionOrThrow(existing.id, tenantId);
  const questionCount = await strapi.db.query(SURVEY_QUESTION_UID).count({
    where: mergeTenantWhere({
      survey_section: {
        id: {
          $eq: existing.id,
        },
      },
    }, tenantId),
  });
  return mapSectionRow(reloaded, questionCount);
}

export async function deleteSurveySection(id: unknown, tenantId: number | string) {
  const existing = await findSectionOrThrow(id, tenantId);
  const questionCount = await strapi.db.query(SURVEY_QUESTION_UID).count({
    where: mergeTenantWhere({
      survey_section: {
        id: {
          $eq: existing.id,
        },
      },
    }, tenantId),
  });

  if (questionCount > 0) {
    throw new SurveyQuestionManagementError(409, 'Cannot delete section that still has questions');
  }

  await strapi.db.query(SURVEY_SECTION_UID).delete({ where: { id: existing.id } });
  return { id: existing.id };
}

export async function createSurveyQuestion(body: any, tenantId: number | string) {
  const payload = sanitizeQuestionPayload(body);
  const section = await findSectionOrThrow(payload.sectionId, tenantId);

  const created = await strapi.db.query(SURVEY_QUESTION_UID).create({
    data: {
      content: payload.content,
      type: payload.type,
      isRequired: payload.isRequired,
      order: payload.order,
      survey_section: section.id,
      tenant: tenantId,
    },
  });

  if (payload.options.length > 0) {
    await createQuestionOptions(created.id, tenantId, payload.options);
  }

  const reloaded = await findQuestionOrThrow(created.id, tenantId);
  return mapQuestionRow(reloaded, 0);
}

export async function updateSurveyQuestion(id: unknown, body: any, tenantId: number | string) {
  const existing = await findQuestionOrThrow(id, tenantId);
  const payload = sanitizeQuestionPayload(body);
  const answerCount = await getQuestionAnswerCount(existing.id, tenantId);

  if (await hasQuestionSubmittedAnswers(existing.id, tenantId)) {
    throw new SurveyQuestionManagementError(409, 'Question already has submitted answers');
  }

  const section = await findSectionOrThrow(payload.sectionId, tenantId);

  await strapi.db.query(SURVEY_QUESTION_UID).update({
    where: { id: existing.id },
    data: {
      content: payload.content,
      type: payload.type,
      isRequired: payload.isRequired,
      order: payload.order,
      survey_section: section.id,
      tenant: tenantId,
    },
  });

  await removeQuestionOptions(existing.id, tenantId);
  if (payload.options.length > 0) {
    await createQuestionOptions(existing.id, tenantId, payload.options);
  }

  const reloaded = await findQuestionOrThrow(existing.id, tenantId);
  return mapQuestionRow(reloaded, answerCount);
}

export async function deleteSurveyQuestion(id: unknown, tenantId: number | string) {
  const existing = await findQuestionOrThrow(id, tenantId);
  const answerCount = await getQuestionAnswerCount(existing.id, tenantId);
  if (answerCount > 0) {
    throw new SurveyQuestionManagementError(409, 'Cannot delete question that already has submitted answers');
  }

  await removeQuestionOptions(existing.id, tenantId);
  await strapi.db.query(SURVEY_QUESTION_UID).delete({ where: { id: existing.id } });
  return { id: existing.id };
}