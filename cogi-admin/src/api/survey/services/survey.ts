import { mergeTenantWhere } from '../../../utils/tenant-scope';

const SURVEY_ASSIGNMENT_UID = 'api::survey-assignment.survey-assignment';
const SURVEY_CAMPAIGN_UID = 'api::survey-campaign.survey-campaign';
const SURVEY_TEMPLATE_UID = 'api::survey-template.survey-template';
const SURVEY_QUESTION_UID = 'api::survey-question.survey-question';
const SURVEY_RESPONSE_UID = 'api::survey-response.survey-response';
const SURVEY_ANSWER_UID = 'api::survey-answer.survey-answer';

type TenantId = number | string | undefined;

type SubmitAnswerPayload = {
  questionId?: number | string;
  value?: string | null;
  text?: string | null;
};

type SubmitPayload = {
  assignmentId?: number | string;
  answers?: SubmitAnswerPayload[];
};

type AuthUser = {
  id: number;
  username?: string | null;
  email?: string | null;
};

class SurveyError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

function toPositiveInt(value: unknown): number | null {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

function toTrimmedString(value: unknown): string {
  if (value === null || value === undefined) return '';
  return String(value).trim();
}

function applyTenantWhere(baseWhere: Record<string, unknown>, tenantId?: TenantId) {
  if (tenantId === null || tenantId === undefined || tenantId === '') {
    return baseWhere;
  }

  return mergeTenantWhere(baseWhere, tenantId);
}

function getRelationId(value: any): number | null {
  if (!value) return null;
  if (typeof value === 'number') return value > 0 ? value : null;
  if (typeof value === 'string') {
    const parsed = Number(value);
    return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
  }

  const parsed = Number(value.id);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

function normalizeOption(option: any) {
  return {
    id: option.id,
    label: option.label,
    value: option.value,
    order: option.order ?? 0,
  };
}

function normalizeQuestion(question: any) {
  const options = Array.isArray(question?.survey_question_options)
    ? [...question.survey_question_options].sort((left: any, right: any) => {
        const orderDiff = Number(left?.order || 0) - Number(right?.order || 0);
        return orderDiff !== 0 ? orderDiff : Number(left?.id || 0) - Number(right?.id || 0);
      }).map(normalizeOption)
    : [];

  return {
    id: question.id,
    content: question.content,
    type: question.type,
    isRequired: Boolean(question.isRequired),
    order: question.order ?? 0,
    options,
  };
}

function normalizeSection(section: any) {
  const questions = Array.isArray(section?.survey_questions)
    ? [...section.survey_questions].sort((left: any, right: any) => {
        const orderDiff = Number(left?.order || 0) - Number(right?.order || 0);
        return orderDiff !== 0 ? orderDiff : Number(left?.id || 0) - Number(right?.id || 0);
      }).map(normalizeQuestion)
    : [];

  return {
    id: section.id,
    title: section.title,
    order: section.order ?? 0,
    questions,
  };
}

function normalizeTemplate(template: any) {
  const sections = Array.isArray(template?.survey_sections)
    ? [...template.survey_sections].sort((left: any, right: any) => {
        const orderDiff = Number(left?.order || 0) - Number(right?.order || 0);
        return orderDiff !== 0 ? orderDiff : Number(left?.id || 0) - Number(right?.id || 0);
      }).map(normalizeSection)
    : [];

  return {
    id: template.id,
    name: template.name,
    code: template.code,
    description: template.description,
    type: template.type,
    isActive: Boolean(template.isActive),
    sections,
  };
}

function normalizeCampaign(campaign: any) {
  return {
    id: campaign.id,
    name: campaign.name,
    description: campaign.description,
    startAt: campaign.startAt,
    endAt: campaign.endAt,
    campaignStatus: campaign.campaignStatus,
    academicYear: campaign.academicYear,
    semester: campaign.semester,
  };
}

function normalizeAssignmentSummary(row: any) {
  const responses = Array.isArray(row?.survey_responses) ? row.survey_responses : [];
  const hasSubmittedResponse = responses.some((item: any) => item?.status === 'SUBMITTED');
  const hasInProgressResponse = responses.some((item: any) => item?.status === 'IN_PROGRESS');
  const latestResponse = responses.length > 0
    ? [...responses].sort((left: any, right: any) => {
        const leftTime = new Date(left?.submittedAt || left?.updatedAt || left?.createdAt || 0).getTime();
        const rightTime = new Date(right?.submittedAt || right?.updatedAt || right?.createdAt || 0).getTime();
        return rightTime - leftTime;
      })[0]
    : null;

  return {
    id: row.id,
    contextType: row.contextType,
    courseId: row.courseId || null,
    courseName: row.courseName || null,
    lecturerId: row.lecturerId || null,
    lecturerName: row.lecturerName || null,
    isCompleted: Boolean(row.isCompleted),
    hasInProgressResponse,
    hasSubmittedResponse,
    latestResponseStatus: latestResponse?.status || null,
    campaign: row.survey_campaign ? {
      ...normalizeCampaign(row.survey_campaign),
      template: row.survey_campaign?.survey_template
        ? {
            id: row.survey_campaign.survey_template.id,
            name: row.survey_campaign.survey_template.name,
            code: row.survey_campaign.survey_template.code,
            type: row.survey_campaign.survey_template.type,
          }
        : null,
    } : null,
  };
}

function normalizeAssignmentDetail(row: any) {
  const responses = Array.isArray(row?.survey_responses) ? row.survey_responses : [];
  const draftResponse = responses.find((item: any) => item?.status === 'IN_PROGRESS') || null;
  const draftAnswers = Array.isArray(draftResponse?.survey_answers)
    ? draftResponse.survey_answers.map((answer: any) => ({
        id: answer.id,
        questionId: getRelationId(answer?.survey_question),
        optionId: getRelationId(answer?.survey_question_option),
        value: answer?.value || '',
        text: answer?.text || '',
      })).filter((item: any) => Number.isInteger(item.questionId) && item.questionId > 0)
    : [];

  return {
    assignment: {
      id: row.id,
      contextType: row.contextType,
      isCompleted: Boolean(row.isCompleted),
      courseId: row.courseId || null,
      courseName: row.courseName || null,
      classSectionId: row.classSectionId || null,
      lecturerId: row.lecturerId || null,
      lecturerName: row.lecturerName || null,
      programId: row.programId || null,
      cohortId: row.cohortId || null,
    },
    campaign: row.survey_campaign ? normalizeCampaign(row.survey_campaign) : null,
    template: row.survey_campaign?.survey_template ? normalizeTemplate(row.survey_campaign.survey_template) : null,
    draftResponse: draftResponse ? {
      id: draftResponse.id,
      status: draftResponse.status,
      submittedAt: draftResponse.submittedAt || null,
      answers: draftAnswers,
    } : null,
  };
}

function normalizeSubmitResult(response: any, assignmentId: number, answersCount: number) {
  return {
    assignmentId,
    responseId: response?.id || null,
    submittedAt: response?.submittedAt || null,
    status: response?.status || 'SUBMITTED',
    answersCount,
  };
}

async function findAssignmentById(assignmentId: number, tenantId?: TenantId) {
  return strapi.db.query(SURVEY_ASSIGNMENT_UID).findOne({
    where: applyTenantWhere({ id: assignmentId }, tenantId),
    populate: {
      respondent: {
        select: ['id', 'username', 'email'],
      },
      survey_campaign: {
        populate: {
          survey_template: {
            populate: {
              survey_sections: {
                populate: {
                  survey_questions: {
                    populate: {
                      survey_question_options: true,
                    },
                  },
                },
              },
            },
          },
        },
      },
      tenant: {
        select: ['id'],
      },
      survey_responses: {
        select: ['id', 'status', 'submittedAt', 'createdAt', 'updatedAt'],
        populate: {
          survey_answers: {
            populate: {
              survey_question: true,
              survey_question_option: true,
            },
          },
        },
      },
    },
  });
}

function assertAssignmentOwner(assignment: any, userId: number) {
  const respondentId = getRelationId(assignment?.respondent);
  if (!respondentId || respondentId !== userId) {
    throw new SurveyError(403, 'You do not own this survey assignment');
  }
}

function assertCampaignOpen(assignment: any) {
  if (assignment?.survey_campaign?.campaignStatus !== 'OPEN') {
    throw new SurveyError(403, 'Survey campaign is not open');
  }
}

function assertNotCompleted(assignment: any) {
  if (assignment?.isCompleted) {
    throw new SurveyError(409, 'Survey assignment already submitted');
  }

  const hasSubmittedResponse = Array.isArray(assignment?.survey_responses)
    && assignment.survey_responses.some((item: any) => item?.status === 'SUBMITTED');

  if (hasSubmittedResponse) {
    throw new SurveyError(409, 'Survey assignment already submitted');
  }
}

async function loadTemplateQuestions(templateId: number, tenantId?: TenantId) {
  return strapi.db.query(SURVEY_QUESTION_UID).findMany({
    where: applyTenantWhere({
      survey_section: {
        survey_template: {
          id: templateId,
        },
      },
    }, tenantId),
    populate: {
      survey_question_options: true,
      survey_section: {
        populate: {
          survey_template: true,
        },
      },
    },
    orderBy: [{ order: 'asc' }, { id: 'asc' }],
  });
}

function buildQuestionMap(questions: any[]) {
  const questionMap = new Map<number, any>();

  for (const question of questions || []) {
    if (Number.isInteger(question?.id)) {
      questionMap.set(question.id, question);
    }
  }

  return questionMap;
}

function inferQuestionOptionId(question: any, value: string): number | null {
  if (!value) return null;
  const options = Array.isArray(question?.survey_question_options) ? question.survey_question_options : [];
  const matched = options.find((option: any) => String(option?.value || '') === value);
  return matched?.id || null;
}

function validateAnswerPayload(question: any, answer: SubmitAnswerPayload) {
  const value = toTrimmedString(answer?.value);
  const text = toTrimmedString(answer?.text);

  if (question.type === 'TEXT') {
    if (!text) {
      throw new SurveyError(400, `Question ${question.id} requires text answer`);
    }
    return { value: '', text };
  }

  if (!value) {
    throw new SurveyError(400, `Question ${question.id} requires selected value`);
  }

  if (question.type === 'LIKERT_1_5' || question.type === 'SINGLE_CHOICE') {
    const matchedOptionId = inferQuestionOptionId(question, value);
    if (!matchedOptionId) {
      throw new SurveyError(400, `Question ${question.id} has invalid option value`);
    }
  }

  return { value, text };
}

function validateRequiredQuestions(questions: any[], answersByQuestionId: Map<number, SubmitAnswerPayload>) {
  for (const question of questions) {
    if (!question?.isRequired) continue;
    const answer = answersByQuestionId.get(question.id);
    if (!answer) {
      throw new SurveyError(400, `Question ${question.id} is required`);
    }

    const normalized = validateAnswerPayload(question, answer);
    if (question.type === 'TEXT' && !normalized.text) {
      throw new SurveyError(400, `Question ${question.id} is required`);
    }

    if (question.type !== 'TEXT' && !normalized.value) {
      throw new SurveyError(400, `Question ${question.id} is required`);
    }
  }
}

async function findInProgressResponse(assignmentId: number, tenantId: number | string) {
  return strapi.db.query(SURVEY_RESPONSE_UID).findOne({
    where: mergeTenantWhere({
      survey_assignment: assignmentId,
      status: 'IN_PROGRESS',
    }, tenantId),
    populate: {
      survey_answers: true,
    },
    orderBy: [{ updatedAt: 'desc' }, { createdAt: 'desc' }, { id: 'desc' }],
  });
}

async function replaceResponseAnswers(responseId: number, answersByQuestionId: Map<number, SubmitAnswerPayload>, questionMap: Map<number, any>, tenantId: number | string, trx: any) {
  const existingAnswers = await strapi.db.query(SURVEY_ANSWER_UID).findMany({
    where: mergeTenantWhere({ survey_response: responseId }, tenantId),
    transacting: trx,
  } as any);

  for (const answer of existingAnswers || []) {
    await strapi.db.query(SURVEY_ANSWER_UID).delete({
      where: { id: answer.id },
      transacting: trx,
    } as any);
  }

  for (const [questionId, rawAnswer] of answersByQuestionId.entries()) {
    const question = questionMap.get(questionId);
    if (!question) continue;

    const normalized = question.type === 'TEXT'
      ? { value: '', text: toTrimmedString(rawAnswer?.text) }
      : { value: toTrimmedString(rawAnswer?.value), text: toTrimmedString(rawAnswer?.text) };

    const hasMeaningfulAnswer = question.type === 'TEXT'
      ? Boolean(normalized.text)
      : Boolean(normalized.value);

    if (!hasMeaningfulAnswer) continue;

    const optionId = question.type === 'LIKERT_1_5' || question.type === 'SINGLE_CHOICE'
      ? inferQuestionOptionId(question, normalized.value)
      : null;

    await strapi.db.query(SURVEY_ANSWER_UID).create({
      data: {
        survey_response: responseId,
        survey_question: question.id,
        survey_question_option: optionId,
        value: normalized.value || null,
        text: normalized.text || null,
        tenant: tenantId,
      },
      transacting: trx,
    } as any);
  }
}

async function buildValidatedSubmissionContext(userIdInput: unknown, payloadInput: SubmitPayload, tenantId?: TenantId) {
  const userId = toPositiveInt(userIdInput);
  if (!userId) {
    throw new SurveyError(401, 'Unauthorized');
  }

  const payload = payloadInput && typeof payloadInput === 'object' ? payloadInput : {};
  const assignmentId = toPositiveInt(payload.assignmentId);
  if (!assignmentId) {
    throw new SurveyError(400, 'assignmentId is required');
  }

  if (!Array.isArray(payload.answers)) {
    throw new SurveyError(400, 'answers must be an array');
  }

  const assignment = await findAssignmentById(assignmentId, tenantId);
  if (!assignment) {
    throw new SurveyError(404, 'Survey assignment not found');
  }

  assertAssignmentOwner(assignment, userId);
  assertCampaignOpen(assignment);

  const assignmentTenantId = getRelationId(assignment?.tenant);
  if (!assignmentTenantId) {
    throw new SurveyError(400, 'Survey assignment is missing tenant');
  }

  const templateId = getRelationId(assignment?.survey_campaign?.survey_template);
  if (!templateId) {
    throw new SurveyError(400, 'Survey assignment is missing template');
  }

  const answersByQuestionId = new Map<number, SubmitAnswerPayload>();
  for (const item of payload.answers) {
    const questionId = toPositiveInt(item?.questionId);
    if (!questionId) {
      throw new SurveyError(400, 'Each answer must include valid questionId');
    }
    if (answersByQuestionId.has(questionId)) {
      throw new SurveyError(400, `Duplicate answer for question ${questionId}`);
    }

    answersByQuestionId.set(questionId, item);
  }

  const templateQuestions = await loadTemplateQuestions(templateId, assignmentTenantId);
  const questionMap = buildQuestionMap(templateQuestions || []);

  for (const questionId of answersByQuestionId.keys()) {
    if (!questionMap.has(questionId)) {
      throw new SurveyError(400, `Question ${questionId} does not belong to assignment template`);
    }
  }

  return {
    userId,
    assignment,
    assignmentTenantId,
    answersByQuestionId,
    templateQuestions,
    questionMap,
  };
}

function normalizeDraftResult(response: any, assignmentId: number, answersCount: number) {
  return {
    assignmentId,
    responseId: response?.id || null,
    savedAt: response?.updatedAt || response?.createdAt || null,
    status: response?.status || 'IN_PROGRESS',
    answersCount,
  };
}

export default {
  async getMyAssignments(userIdInput: unknown, tenantId?: TenantId) {
    const userId = toPositiveInt(userIdInput);
    if (!userId) {
      throw new SurveyError(401, 'Unauthorized');
    }

    const rows = await strapi.db.query(SURVEY_ASSIGNMENT_UID).findMany({
      where: applyTenantWhere({ respondent: userId }, tenantId),
      populate: {
        survey_campaign: {
          populate: {
            survey_template: {
              select: ['id', 'name', 'code', 'type'],
            },
          },
        },
        survey_responses: {
          select: ['id', 'status', 'submittedAt', 'createdAt', 'updatedAt'],
        },
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    });

    return (rows || []).map(normalizeAssignmentSummary);
  },

  async getAssignmentDetail(assignmentIdInput: unknown, userIdInput: unknown, tenantId?: TenantId) {
    const assignmentId = toPositiveInt(assignmentIdInput);
    const userId = toPositiveInt(userIdInput);

    if (!assignmentId) {
      throw new SurveyError(400, 'Invalid assignment id');
    }

    if (!userId) {
      throw new SurveyError(401, 'Unauthorized');
    }

    const assignment = await findAssignmentById(assignmentId, tenantId);
    if (!assignment) {
      throw new SurveyError(404, 'Survey assignment not found');
    }

    assertAssignmentOwner(assignment, userId);
    assertCampaignOpen(assignment);

    return normalizeAssignmentDetail(assignment);
  },

  async saveDraftSurvey(userIdInput: unknown, payloadInput: SubmitPayload, tenantId?: TenantId, authUser?: AuthUser) {
    const context = await buildValidatedSubmissionContext(userIdInput, payloadInput, tenantId);
    const {
      assignment,
      assignmentTenantId,
      answersByQuestionId,
      questionMap,
    } = context;

    assertNotCompleted(assignment);

    try {
      const draft = await strapi.db.transaction(async ({ trx }: any) => {
        const existingDraft = await findInProgressResponse(assignment.id, assignmentTenantId);

        if (existingDraft?.id) {
          await strapi.db.query(SURVEY_RESPONSE_UID).update({
            where: { id: existingDraft.id },
            data: {
              respondentSnapshot: {
                id: context.userId,
                username: authUser?.username || assignment?.respondent?.username || null,
              },
            },
            transacting: trx,
          } as any);

          await replaceResponseAnswers(existingDraft.id, answersByQuestionId, questionMap, assignmentTenantId, trx);

          return strapi.db.query(SURVEY_RESPONSE_UID).findOne({
            where: { id: existingDraft.id },
            populate: { survey_answers: true },
            transacting: trx,
          } as any);
        }

        const createdDraft = await strapi.db.query(SURVEY_RESPONSE_UID).create({
          data: {
            survey_assignment: assignment.id,
            status: 'IN_PROGRESS',
            tenant: assignmentTenantId,
            respondentSnapshot: {
              id: context.userId,
              username: authUser?.username || assignment?.respondent?.username || null,
            },
          },
          transacting: trx,
        } as any);

        await replaceResponseAnswers(createdDraft.id, answersByQuestionId, questionMap, assignmentTenantId, trx);

        return strapi.db.query(SURVEY_RESPONSE_UID).findOne({
          where: { id: createdDraft.id },
          populate: { survey_answers: true },
          transacting: trx,
        } as any);
      });

      return normalizeDraftResult(draft, assignment.id, answersByQuestionId.size);
    } catch (error: any) {
      if (error instanceof SurveyError) {
        throw error;
      }

      strapi.log.error('[survey.saveDraftSurvey] failed', error);
      throw new SurveyError(500, 'Failed to save survey draft');
    }
  },

  async submitSurvey(userIdInput: unknown, payloadInput: SubmitPayload, tenantId?: TenantId, authUser?: AuthUser) {
    const context = await buildValidatedSubmissionContext(userIdInput, payloadInput, tenantId);
    const {
      userId,
      assignment,
      assignmentTenantId,
      answersByQuestionId,
      templateQuestions,
      questionMap,
    } = context;

    if (answersByQuestionId.size === 0) {
      throw new SurveyError(400, 'answers must be a non-empty array');
    }
    assertNotCompleted(assignment);

    validateRequiredQuestions(templateQuestions || [], answersByQuestionId);

    try {
      const submittedAt = new Date().toISOString();

      const response = await strapi.db.transaction(async ({ trx }: any) => {
        const existingDraft = await findInProgressResponse(assignment.id, assignmentTenantId);
        let targetResponseId = existingDraft?.id || null;

        if (targetResponseId) {
          await strapi.db.query(SURVEY_RESPONSE_UID).update({
            where: { id: targetResponseId },
            data: {
              status: 'SUBMITTED',
              submittedAt,
              respondentSnapshot: {
                id: userId,
                username: authUser?.username || assignment?.respondent?.username || null,
              },
            },
            transacting: trx,
          } as any);
        } else {
          const createdResponse = await strapi.db.query(SURVEY_RESPONSE_UID).create({
            data: {
              survey_assignment: assignment.id,
              status: 'SUBMITTED',
              submittedAt,
              tenant: assignmentTenantId,
              respondentSnapshot: {
                id: userId,
                username: authUser?.username || assignment?.respondent?.username || null,
              },
            },
            transacting: trx,
          } as any);

          targetResponseId = createdResponse.id;
        }

        await replaceResponseAnswers(targetResponseId, answersByQuestionId, questionMap, assignmentTenantId, trx);

        const updateAssignmentParams: any = {
          where: { id: assignment.id },
          data: {
            isCompleted: true,
          },
          transacting: trx,
        };

        await strapi.db.query(SURVEY_ASSIGNMENT_UID).update(updateAssignmentParams);

        const findResponseParams: any = {
          where: { id: targetResponseId },
          populate: {
            survey_answers: true,
          },
          transacting: trx,
        };

        return strapi.db.query(SURVEY_RESPONSE_UID).findOne(findResponseParams);
      });

      return normalizeSubmitResult(response, assignment.id, answersByQuestionId.size);
    } catch (error: any) {
      if (error instanceof SurveyError) {
        throw error;
      }

      strapi.log.error('[survey.submitSurvey] failed', error);
      throw new SurveyError(500, 'Failed to submit survey');
    }
  },
};