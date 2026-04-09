import XLSX from 'xlsx';
import { mergeTenantWhere } from '../../../utils/tenant-scope';

const SURVEY_CAMPAIGN_UID = 'api::survey-campaign.survey-campaign';
const SURVEY_ASSIGNMENT_UID = 'api::survey-assignment.survey-assignment';
const SURVEY_RESPONSE_UID = 'api::survey-response.survey-response';
const SURVEY_ANSWER_UID = 'api::survey-answer.survey-answer';

type ExportWorkbookResult = {
  fileName: string;
  buffer: Buffer;
};

class SurveyReportError extends Error {
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

function toText(value: unknown): string {
  if (value === null || value === undefined) return '';
  return String(value).trim();
}

function toScore(value: unknown): number | null {
  const text = toText(value);
  if (!text) return null;
  const numeric = Number(text);
  if (!Number.isFinite(numeric)) return null;
  return numeric;
}

function toFixedScore(value: number) {
  return Number(value.toFixed(2));
}

function sanitizeFileNamePart(value: unknown, fallback: string) {
  const text = toText(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[\\/:*?"<>|]+/g, '-')
    .replace(/[^A-Za-z0-9._-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '');

  return text || fallback;
}

function buildSubmittedResponseWhere(campaignId: number) {
  return {
    $and: [
      {
        survey_assignment: {
          survey_campaign: {
            id: {
              $eq: campaignId,
            },
          },
        },
      },
      {
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
          {
            survey_assignment: {
              isCompleted: true,
            },
            responseStatus: {
              $ne: 'RESET',
            },
          },
        ],
      },
    ],
  };
}

async function findCampaignOrThrow(id: unknown, tenantId: number | string) {
  const campaignId = toPositiveInt(id);
  if (!campaignId) {
    throw new SurveyReportError(400, 'Campaign id is invalid');
  }

  const campaign = await strapi.db.query(SURVEY_CAMPAIGN_UID).findOne({
    where: mergeTenantWhere({ id: campaignId }, tenantId),
    select: ['id', 'name'],
  });

  if (!campaign?.id) {
    throw new SurveyReportError(404, 'Survey campaign not found');
  }

  return campaign;
}

async function loadSubmittedAssignments(campaignId: number, tenantId: number | string) {
  return strapi.db.query(SURVEY_ASSIGNMENT_UID).findMany({
    where: mergeTenantWhere({
      survey_campaign: {
        id: {
          $eq: campaignId,
        },
      },
    }, tenantId),
    select: ['id', 'isCompleted', 'lecturerId', 'lecturerName', 'courseId', 'courseName'],
  });
}

async function loadSubmittedResponses(campaignId: number, tenantId: number | string) {
  return strapi.db.query(SURVEY_RESPONSE_UID).findMany({
    where: mergeTenantWhere(buildSubmittedResponseWhere(campaignId), tenantId),
    select: ['id', 'responseStatus', 'submittedAt'],
    populate: {
      survey_assignment: {
        select: ['id', 'lecturerId', 'lecturerName', 'courseId', 'courseName'],
      },
    },
  });
}

async function loadSubmittedAnswers(responseIds: number[], tenantId: number | string) {
  if (responseIds.length === 0) return [];

  return strapi.db.query(SURVEY_ANSWER_UID).findMany({
    where: mergeTenantWhere({
      survey_response: {
        id: {
          $in: responseIds,
        },
      },
    }, tenantId),
    select: ['id', 'value'],
    populate: {
      survey_response: {
        select: ['id'],
      },
    },
  });
}

async function loadLecturerAssignmentsForExport(campaignId: number, lecturerId: string, tenantId: number | string) {
  return strapi.db.query(SURVEY_ASSIGNMENT_UID).findMany({
    where: mergeTenantWhere({
      survey_campaign: {
        id: {
          $eq: campaignId,
        },
      },
      lecturerId: {
        $eqi: lecturerId,
      },
    }, tenantId),
    select: ['id', 'lecturerId', 'lecturerName', 'courseId', 'courseName'],
    populate: {
      respondent: {
        select: ['id', 'username', 'fullName', 'email'],
      },
    },
    orderBy: [{ id: 'asc' }],
  });
}

async function loadExportAnswers(responseIds: number[], tenantId: number | string) {
  if (responseIds.length === 0) return [];

  return strapi.db.query(SURVEY_ANSWER_UID).findMany({
    where: mergeTenantWhere({
      survey_response: {
        id: {
          $in: responseIds,
        },
      },
    }, tenantId),
    select: ['id', 'value', 'text'],
    populate: {
      survey_response: {
        select: ['id'],
      },
      survey_question: {
        select: ['id', 'content'],
      },
    },
    orderBy: [{ id: 'asc' }],
  });
}

function sortByAvgScore(rows: any[]) {
  return [...rows].sort((left, right) => {
    const scoreDiff = Number(right?.avgScore || 0) - Number(left?.avgScore || 0);
    if (scoreDiff !== 0) return scoreDiff;
    return toText(left?.name).localeCompare(toText(right?.name));
  });
}

async function buildGroupedReport(campaignId: number, tenantId: number | string, groupBy: 'lecturer' | 'course') {
  const responses = await loadSubmittedResponses(campaignId, tenantId);
  const responseIds = (responses || [])
    .map((item: any) => Number(item?.id || 0))
    .filter((item: number) => Number.isInteger(item) && item > 0);
  const answers = await loadSubmittedAnswers(responseIds, tenantId);
  const numericScoresByResponseId = new Map<number, { total: number; count: number }>();

  for (const answer of answers || []) {
    const responseId = Number(answer?.survey_response?.id || answer?.survey_response || 0);
    const score = toScore(answer?.value);
    if (!responseId || score === null) continue;

    const current = numericScoresByResponseId.get(responseId) || { total: 0, count: 0 };
    current.total += score;
    current.count += 1;
    numericScoresByResponseId.set(responseId, current);
  }

  const grouped = new Map<string, { name: string; totalResponses: number; totalScore: number; scoredResponses: number }>();

  for (const response of responses || []) {
    const assignment = response?.survey_assignment;
    const key = groupBy === 'lecturer'
      ? toText(assignment?.lecturerId || assignment?.lecturerName || 'unknown')
      : toText(assignment?.courseId || assignment?.courseName || 'unknown');
    const name = groupBy === 'lecturer'
      ? toText(assignment?.lecturerName || assignment?.lecturerId || 'Không xác định')
      : toText(assignment?.courseName || assignment?.courseId || 'Không xác định');

    const scoreBucket = numericScoresByResponseId.get(Number(response?.id || 0));
    const avgForResponse = scoreBucket && scoreBucket.count > 0
      ? scoreBucket.total / scoreBucket.count
      : null;

    const current = grouped.get(key) || {
      name,
      totalResponses: 0,
      totalScore: 0,
      scoredResponses: 0,
    };

    current.totalResponses += 1;
    if (avgForResponse !== null) {
      current.totalScore += avgForResponse;
      current.scoredResponses += 1;
    }
    grouped.set(key, current);
  }

  return sortByAvgScore(
    [...grouped.entries()].map(([key, value]) => ({
      key,
      [`${groupBy}Name`]: value.name,
      totalResponses: value.totalResponses,
      avgScore: value.scoredResponses > 0 ? toFixedScore(value.totalScore / value.scoredResponses) : 0,
    })),
  );
}

export async function getCampaignSummaryReport(id: unknown, tenantId: number | string) {
  const campaign = await findCampaignOrThrow(id, tenantId);
  const assignments = await loadSubmittedAssignments(campaign.id, tenantId);
  const submittedResponses = await loadSubmittedResponses(campaign.id, tenantId);
  const submittedAssignmentIds = new Set(
    (submittedResponses || [])
      .map((item: any) => Number(item?.survey_assignment?.id || item?.survey_assignment || 0))
      .filter((item: number) => Number.isInteger(item) && item > 0),
  );
  const totalAssignments = Number(assignments?.length || 0);
  const completedAssignments = (assignments || []).filter((item: any) => {
    const assignmentId = Number(item?.id || 0);
    return item?.isCompleted || submittedAssignmentIds.has(assignmentId);
  }).length;
  const completionRate = totalAssignments > 0
    ? toFixedScore((completedAssignments / totalAssignments) * 100)
    : 0;

  return {
    campaignId: campaign.id,
    campaignName: campaign.name,
    totalAssignments,
    completedAssignments,
    completionRate,
  };
}

export async function getCampaignLecturerReport(id: unknown, tenantId: number | string) {
  const campaign = await findCampaignOrThrow(id, tenantId);
  const data = await buildGroupedReport(campaign.id, tenantId, 'lecturer');
  return {
    campaignId: campaign.id,
    campaignName: campaign.name,
    items: data,
  };
}

export async function getCampaignCourseReport(id: unknown, tenantId: number | string) {
  const campaign = await findCampaignOrThrow(id, tenantId);
  const data = await buildGroupedReport(campaign.id, tenantId, 'course');
  return {
    campaignId: campaign.id,
    campaignName: campaign.name,
    items: data,
  };
}

export async function exportCampaignLecturerReport(campaignIdInput: unknown, lecturerIdInput: unknown, tenantId: number | string): Promise<ExportWorkbookResult> {
  const campaign = await findCampaignOrThrow(campaignIdInput, tenantId);
  const lecturerId = toText(lecturerIdInput);

  if (!lecturerId) {
    throw new SurveyReportError(400, 'Lecturer id is invalid');
  }

  const assignments = await loadLecturerAssignmentsForExport(campaign.id, lecturerId, tenantId);
  const assignmentIds = (assignments || [])
    .map((item: any) => Number(item?.id || 0))
    .filter((item: number) => Number.isInteger(item) && item > 0);

  const responses = assignmentIds.length > 0
    ? await strapi.db.query(SURVEY_RESPONSE_UID).findMany({
      where: mergeTenantWhere({
        responseStatus: 'SUBMITTED',
        survey_assignment: {
          id: {
            $in: assignmentIds,
          },
        },
      }, tenantId),
      select: ['id', 'submittedAt'],
      populate: {
        survey_assignment: {
          select: ['id'],
        },
      },
      orderBy: [{ submittedAt: 'desc' }, { id: 'desc' }],
    })
    : [];

  const responseIds = (responses || [])
    .map((item: any) => Number(item?.id || 0))
    .filter((item: number) => Number.isInteger(item) && item > 0);
  const answers = await loadExportAnswers(responseIds, tenantId);

  const assignmentById = new Map<number, any>();
  for (const assignment of assignments || []) {
    const assignmentId = Number(assignment?.id || 0);
    if (!assignmentId) continue;
    assignmentById.set(assignmentId, assignment);
  }

  const responseInfoById = new Map<number, {
    studentName: string;
    courseName: string;
    lecturerName: string;
  }>();

  for (const response of responses || []) {
    const responseId = Number(response?.id || 0);
    if (!responseId) continue;

    const assignmentId = Number(response?.survey_assignment?.id || response?.survey_assignment || 0);
    const assignment = assignmentById.get(assignmentId);
    const respondent = assignment?.respondent;
    responseInfoById.set(responseId, {
      studentName: toText(respondent?.fullName || respondent?.username || respondent?.email || 'Unknown Student'),
      courseName: toText(assignment?.courseName || assignment?.courseId || ''),
      lecturerName: toText(assignment?.lecturerName || assignment?.lecturerId || lecturerId),
    });
  }

  const rawRows = (answers || []).map((answer: any) => {
    const responseId = Number(answer?.survey_response?.id || answer?.survey_response || 0);
    const responseInfo = responseInfoById.get(responseId);
    const questionContent = toText(answer?.survey_question?.content || '');
    const answerValue = toText(answer?.text || answer?.value || '');

    return {
      Student: responseInfo?.studentName || '',
      Course: responseInfo?.courseName || '',
      Question: questionContent,
      Answer: answerValue,
    };
  });

  const summaryByQuestion = new Map<string, { total: number; count: number }>();

  for (const answer of answers || []) {
    const questionContent = toText(answer?.survey_question?.content || '');
    const score = toScore(answer?.value);
    if (!questionContent || score === null) continue;

    const current = summaryByQuestion.get(questionContent) || { total: 0, count: 0 };
    current.total += score;
    current.count += 1;
    summaryByQuestion.set(questionContent, current);
  }

  const summaryRows = [...summaryByQuestion.entries()]
    .map(([question, bucket]) => ({
      Question: question,
      'Avg Score': bucket.count > 0 ? toFixedScore(bucket.total / bucket.count) : '',
    }))
    .sort((left, right) => toText(left.Question).localeCompare(toText(right.Question)));

  const workbook = XLSX.utils.book_new();
  const rawSheet = XLSX.utils.json_to_sheet(rawRows, { header: ['Student', 'Course', 'Question', 'Answer'] });
  const summarySheet = XLSX.utils.json_to_sheet(summaryRows, { header: ['Question', 'Avg Score'] });
  XLSX.utils.book_append_sheet(workbook, rawSheet, 'Raw data');
  XLSX.utils.book_append_sheet(workbook, summarySheet, 'Summary');

  const lecturerName = assignments?.[0]?.lecturerName || lecturerId;

  return {
    fileName: `survey-report-${sanitizeFileNamePart(campaign.name, `campaign-${campaign.id}`)}-${sanitizeFileNamePart(lecturerName, lecturerId)}.xlsx`,
    buffer: XLSX.write(workbook, { bookType: 'xlsx', type: 'buffer' }) as Buffer,
  };
}