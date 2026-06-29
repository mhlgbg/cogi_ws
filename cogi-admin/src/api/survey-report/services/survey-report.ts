import XLSX from 'xlsx';
import fs from 'node:fs/promises';
import path from 'node:path';
import { mergeTenantWhere } from '../../../utils/tenant-scope';
import { buildActiveSoftDeleteWhere, mergeTenantSoftDeleteWhere } from '../../../utils/soft-delete';

const SURVEY_CAMPAIGN_UID = 'api::survey-campaign.survey-campaign';
const SURVEY_ASSIGNMENT_UID = 'api::survey-assignment.survey-assignment';
const SURVEY_RESPONSE_UID = 'api::survey-response.survey-response';
const SURVEY_QUESTION_UID = 'api::survey-question.survey-question';

type ResponseStatus = 'IN_PROGRESS' | 'SUBMITTED' | 'RESET';

type ExportWorkbookResult = {
  fileName: string;
  buffer: Buffer;
};

type GeneratedReportFileInfo = {
  prefix: string;
  fileName: string;
  generatedAt: string;
  size: number;
};

type LatestReportFileInfo = {
  prefix: string;
  hasFile: boolean;
  fileName: string | null;
  generatedAt: string | null;
  size: number;
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

function formatDateTime(value: unknown) {
  const text = toText(value);
  if (!text) return '';
  const date = new Date(text);
  if (Number.isNaN(date.getTime())) return text;
  return date.toLocaleString('vi-VN', { hour12: false });
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

function formatReportTimestamp(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hour = String(date.getHours()).padStart(2, '0');
  const minute = String(date.getMinutes()).padStart(2, '0');
  const second = String(date.getSeconds()).padStart(2, '0');
  return `${year}${month}${day}-${hour}${minute}${second}`;
}

function resolveAnswersReportPrefix(options: { tenantCode: unknown; campaignId: number }) {
  const tenantSegment = sanitizeFileNamePart(options.tenantCode, 'tenant');
  const campaignSegment = `C${options.campaignId}`;
  return `${tenantSegment}-${campaignSegment}-THTL`;
}

function resolveAnswersReportDirectory(tenantCode: unknown, campaignId?: number) {
  const tenantSegment = sanitizeFileNamePart(tenantCode, 'tenant');

  const storageRoot = toText(process.env.STORAGE_ROOT) || path.join(process.cwd(), 'storage');

  if (campaignId) {
    const campaignSegment = `C${campaignId}`;
    return path.join(storageRoot, tenantSegment, campaignSegment);
  }

  return path.join(storageRoot, tenantSegment, 'reports', 'survey');
}

async function findLatestReportFileByPrefix(directoryPath: string, prefix: string) {
  try {
    const names = await fs.readdir(directoryPath);
    const matchedNames = names.filter((name) => name.startsWith(`${prefix}-`) && name.toLowerCase().endsWith('.xlsx'));

    if (matchedNames.length === 0) return null;

    const entries = await Promise.all(matchedNames.map(async (name) => {
      const filePath = path.join(directoryPath, name);
      const stats = await fs.stat(filePath);
      return {
        name,
        path: filePath,
        mtimeMs: stats.mtimeMs,
        generatedAt: stats.mtime.toISOString(),
        size: Number(stats.size || 0),
      };
    }));

    entries.sort((left, right) => right.mtimeMs - left.mtimeMs);
    return entries[0] || null;
  } catch (error: any) {
    if (error?.code === 'ENOENT') return null;
    throw error;
  }
}

async function deleteReportFilesByPrefix(directoryPath: string, prefix: string) {
  try {
    const names = await fs.readdir(directoryPath);
    const matchedPaths = names
      .filter((name) => name.startsWith(`${prefix}-`) && name.toLowerCase().endsWith('.xlsx'))
      .map((name) => path.join(directoryPath, name));

    await Promise.all(matchedPaths.map(async (filePath) => {
      await fs.rm(filePath, { force: true });
    }));
  } catch (error: any) {
    if (error?.code === 'ENOENT') return;
    throw error;
  }
}

function getResponseStatus(value: any): ResponseStatus | null {
  const normalized = toText(value?.responseStatus || value?.status).toUpperCase();
  if (normalized === 'IN_PROGRESS' || normalized === 'SUBMITTED' || normalized === 'RESET') {
    return normalized;
  }

  return null;
}

function getAssignmentStatus(row: any): ResponseStatus | 'PENDING' {
  if (row?.isCompleted) return 'SUBMITTED';

  const responses = Array.isArray(row?.survey_responses) ? row.survey_responses : [];
  const hasResetFromCompleted = responses.some((item: any) => getResponseStatus(item) === 'RESET' && item?.submittedAt);
  if (hasResetFromCompleted) return 'RESET';

  const hasInProgress = responses.some((item: any) => getResponseStatus(item) === 'IN_PROGRESS');
  if (hasInProgress) return 'IN_PROGRESS';

  const hasReset = responses.some((item: any) => getResponseStatus(item) === 'RESET');
  if (hasReset) return 'RESET';

  return 'PENDING';
}

function buildSubmittedResponseWhere(campaignId: number) {
  return {
    $and: [
      {
        survey_assignment: {
          $and: [
            buildActiveSoftDeleteWhere(),
            {
              survey_campaign: {
                $and: [
                  {
                    id: {
                      $eq: campaignId,
                    },
                  },
                  buildActiveSoftDeleteWhere(),
                ],
              },
            },
          ],
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
    where: mergeTenantSoftDeleteWhere({ id: campaignId }, tenantId),
    select: ['id', 'name'],
    populate: {
      survey_template: {
        select: ['id', 'name', 'code'],
      },
    },
  });

  if (!campaign?.id) {
    throw new SurveyReportError(404, 'Survey campaign not found');
  }

  return campaign;
}

async function loadSubmittedAssignments(campaignId: number, tenantId: number | string) {
  return strapi.db.query(SURVEY_ASSIGNMENT_UID).findMany({
    where: mergeTenantSoftDeleteWhere({
      survey_campaign: {
        id: {
          $eq: campaignId,
        },
      },
    }, tenantId),
    select: ['id', 'isCompleted', 'lecturerId', 'lecturerName', 'courseId', 'courseName'],
  });
}

async function loadAssignmentsWithProgress(campaignId: number, tenantId: number | string) {
  return strapi.db.query(SURVEY_ASSIGNMENT_UID).findMany({
    where: mergeTenantSoftDeleteWhere({
      survey_campaign: {
        id: {
          $eq: campaignId,
        },
      },
    }, tenantId),
    select: ['id', 'isCompleted'],
    populate: {
      respondent: {
        select: ['id', 'username', 'fullName', 'email'],
      },
      survey_responses: {
        select: ['id', 'responseStatus', 'submittedAt', 'updatedAt', 'createdAt'],
      },
    },
    orderBy: [{ id: 'asc' }],
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
      survey_answers: {
        select: ['id', 'value'],
      },
    },
  });
}

async function loadLecturerAssignmentsForExport(campaignId: number, lecturerId: string, tenantId: number | string) {
  return strapi.db.query(SURVEY_ASSIGNMENT_UID).findMany({
    where: mergeTenantSoftDeleteWhere({
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

async function loadCourseAssignmentsForExport(campaignId: number, courseId: string, tenantId: number | string) {
  return strapi.db.query(SURVEY_ASSIGNMENT_UID).findMany({
    where: mergeTenantSoftDeleteWhere({
      survey_campaign: {
        id: {
          $eq: campaignId,
        },
      },
      courseId: {
        $eqi: courseId,
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

async function loadSubmittedResponsesForExport(assignmentIds: number[], tenantId: number | string) {
  if (assignmentIds.length === 0) return [];

  return strapi.db.query(SURVEY_RESPONSE_UID).findMany({
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
      survey_answers: {
        select: ['id', 'value', 'text'],
        populate: {
          survey_question: {
            select: ['id', 'content'],
          },
        },
      },
    },
    orderBy: [{ submittedAt: 'desc' }, { id: 'desc' }],
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
  const numericScoresByResponseId = new Map<number, { total: number; count: number }>();

  for (const response of responses || []) {
    const responseId = Number(response?.id || 0);
    if (!responseId) continue;

    for (const answer of Array.isArray(response?.survey_answers) ? response.survey_answers : []) {
      const score = toScore(answer?.value);
      if (score === null) continue;

      const current = numericScoresByResponseId.get(responseId) || { total: 0, count: 0 };
      current.total += score;
      current.count += 1;
      numericScoresByResponseId.set(responseId, current);
    }
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

export async function exportCampaignProgressReport(campaignIdInput: unknown, tenantId: number | string): Promise<ExportWorkbookResult> {
  const campaign = await findCampaignOrThrow(campaignIdInput, tenantId);
  const assignments = await loadAssignmentsWithProgress(campaign.id, tenantId);
  const progressByUser = new Map<string, {
    username: string;
    fullName: string;
    totalAssigned: number;
    completed: number;
    inProgress: number;
    pending: number;
  }>();

  for (const assignment of assignments || []) {
    const respondent = assignment?.respondent;
    const username = toText(respondent?.username || respondent?.email || respondent?.fullName || `user-${assignment?.id || 'unknown'}`);
    const fullName = toText(respondent?.fullName || respondent?.username || respondent?.email || '');
    if (!username) continue;

    const current = progressByUser.get(username) || {
      username,
      fullName,
      totalAssigned: 0,
      completed: 0,
      inProgress: 0,
      pending: 0,
    };

    if (!current.fullName && fullName) {
      current.fullName = fullName;
    }

    const status = getAssignmentStatus(assignment);
    current.totalAssigned += 1;
    if (status === 'SUBMITTED') {
      current.completed += 1;
    } else if (status === 'IN_PROGRESS') {
      current.inProgress += 1;
    } else {
      current.pending += 1;
    }

    progressByUser.set(username, current);
  }

  const rows = [...progressByUser.values()]
    .sort((left, right) => left.username.localeCompare(right.username))
    .map((item) => ({
      'Tên đăng nhập': item.username,
      'Họ và tên': item.fullName,
      'Số khảo sát phải làm': item.totalAssigned,
      'Số khảo sát đã làm': item.completed,
      'Số khảo sát đang làm dở dang': item.inProgress,
      'Số khảo sát chưa làm': item.pending,
    }));

  const workbook = XLSX.utils.book_new();
  const worksheet = XLSX.utils.json_to_sheet(rows, {
    header: [
      'Tên đăng nhập',
      'Họ và tên',
      'Số khảo sát phải làm',
      'Số khảo sát đã làm',
      'Số khảo sát đang làm dở dang',
      'Số khảo sát chưa làm',
    ],
  });
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Tien do khao sat');

  return {
    fileName: `survey-progress-${sanitizeFileNamePart(campaign.name, `campaign-${campaign.id}`)}.xlsx`,
    buffer: XLSX.write(workbook, { bookType: 'xlsx', type: 'buffer' }) as Buffer,
  };
}

export async function exportCampaignAllAnswersReport(campaignIdInput: unknown, tenantId: number | string): Promise<ExportWorkbookResult> {
  const campaign = await findCampaignOrThrow(campaignIdInput, tenantId);
  const templateId = Number(campaign?.survey_template?.id || 0);

  if (!templateId) {
    throw new SurveyReportError(400, 'Survey campaign template is invalid');
  }

  const [questions, responses] = await Promise.all([
    loadTemplateQuestions(templateId, tenantId),
    loadSubmittedCampaignResponsesForExport(campaign.id, tenantId),
  ]);

  const questionHeaders = buildQuestionHeaders(questions);
  const questionHeaderById = new Map(questionHeaders.map((item) => [item.id, item.header]));
  const headers = [
    'User name',
    'Họ tên',
    'Thời điểm nộp khảo sát',
    ...questionHeaders.map((item) => item.header),
  ];
  // Build a mapping from answer id -> question id using a direct query to
  // avoid Strapi ORM joining large sets which can produce oversized SQL.
  const allAnswerIds = new Set<number>();
  for (const response of responses || []) {
    for (const answer of Array.isArray(response?.survey_answers) ? response.survey_answers : []) {
      const aid = Number(answer?.id || 0);
      if (aid) allAnswerIds.add(aid);
    }
  }

  const answerIdList = [...allAnswerIds];
  const answerToQuestion = await loadAnswerToQuestionMap(answerIdList, tenantId);

  const rows = (responses || []).map((response: any) => {
    const assignment = response?.survey_assignment;
    const respondent = assignment?.respondent || {};
    const snapshot = response?.respondentSnapshot || {};
    const row: Record<string, unknown> = {
      'User name': toText(respondent?.username || snapshot?.username || respondent?.email || snapshot?.email || respondent?.id || ''),
      'Họ tên': toText(respondent?.fullName || snapshot?.fullName || respondent?.username || snapshot?.username || ''),
      'Thời điểm nộp khảo sát': formatDateTime(response?.submittedAt),
    };

    for (const header of questionHeaders) {
      row[header.header] = '';
    }

    for (const answer of Array.isArray(response?.survey_answers) ? response.survey_answers : []) {
      const aid = Number(answer?.id || 0);
      const questionId = Number(answer?.survey_question?.id ?? answer?.survey_question ?? answerToQuestion.get(aid) ?? 0);
      const header = questionHeaderById.get(questionId);
      if (!header) continue;
      row[header] = getAnswerDisplayValue(answer);
    }

    return row;
  });

  const workbook = XLSX.utils.book_new();
  const worksheet = rows.length > 0
    ? XLSX.utils.json_to_sheet(rows, { header: headers })
    : XLSX.utils.aoa_to_sheet([headers]);

  worksheet['!cols'] = headers.map((header, index) => ({
    wch: index < 3 ? 24 : Math.min(80, Math.max(18, String(header).length + 2)),
  }));

  XLSX.utils.book_append_sheet(workbook, worksheet, 'Tat ca cau tra loi');

  return {
    fileName: `survey-answers-${sanitizeFileNamePart(campaign.name, `campaign-${campaign.id}`)}.xlsx`,
    buffer: XLSX.write(workbook, { bookType: 'xlsx', type: 'buffer' }) as Buffer,
  };
}

export async function generateCampaignAllAnswersReportFile(
  campaignIdInput: unknown,
  tenantId: number | string,
  tenantCodeInput: unknown,
): Promise<GeneratedReportFileInfo> {
  try {
    const campaign = await findCampaignOrThrow(campaignIdInput, tenantId);
    const tenantCode = toText(tenantCodeInput) || `tenant-${tenantId}`;
      const prefix = resolveAnswersReportPrefix({ tenantCode, campaignId: Number(campaign.id || 0) });
      const reportDirectory = resolveAnswersReportDirectory(tenantCode, Number(campaign.id || 0));

      // ensure directory exists
      await fs.mkdir(reportDirectory, { recursive: true });

      // remove previous files in this campaign directory (best-effort)
      try {
        await deleteReportFilesByPrefix(reportDirectory, prefix);
      } catch (err: any) {
        // log and continue - deletion failure shouldn't block generation
        strapi.log.error('[survey-report] failed to delete old report files', err);
      }

    const workbook = await exportCampaignAllAnswersReport(campaign.id, tenantId);
    if (!workbook || !workbook.buffer) {
      throw new Error('No workbook buffer returned from exportCampaignAllAnswersReport');
    }

    const fileName = `${prefix}-${formatReportTimestamp()}.xlsx`;
    const outputPath = path.join(reportDirectory, fileName);

    await fs.writeFile(outputPath, workbook.buffer);

    const stats = await fs.stat(outputPath);
    return {
      prefix,
      fileName,
      generatedAt: stats.mtime.toISOString(),
      size: Number(stats.size || 0),
    };
  } catch (error: any) {
    // log the full error for server-side debugging and rethrow a sanitized error
    strapi.log.error('[survey-report] generateCampaignAllAnswersReportFile error', error);
    throw new SurveyReportError(500, `Failed to generate report: ${error?.message || 'unknown error'}`);
  }
}

export async function getCampaignAllAnswersLatestReportFile(
  campaignIdInput: unknown,
  tenantId: number | string,
  tenantCodeInput: unknown,
): Promise<LatestReportFileInfo> {
  const campaign = await findCampaignOrThrow(campaignIdInput, tenantId);
  const tenantCode = toText(tenantCodeInput) || `tenant-${tenantId}`;
  const prefix = resolveAnswersReportPrefix({ tenantCode, campaignId: Number(campaign.id || 0) });
  const reportDirectory = resolveAnswersReportDirectory(tenantCode, Number(campaign.id || 0));
  const latest = await findLatestReportFileByPrefix(reportDirectory, prefix);

  return {
    prefix,
    hasFile: Boolean(latest),
    fileName: latest?.name || null,
    generatedAt: latest?.generatedAt || null,
    size: Number(latest?.size || 0),
  };
}

export async function downloadCampaignAllAnswersLatestReportFile(
  campaignIdInput: unknown,
  tenantId: number | string,
  tenantCodeInput: unknown,
): Promise<ExportWorkbookResult> {
  const campaign = await findCampaignOrThrow(campaignIdInput, tenantId);
  const tenantCode = toText(tenantCodeInput) || `tenant-${tenantId}`;
  const prefix = resolveAnswersReportPrefix({ tenantCode, campaignId: Number(campaign.id || 0) });
  const reportDirectory = resolveAnswersReportDirectory(tenantCode, Number(campaign.id || 0));
  const latest = await findLatestReportFileByPrefix(reportDirectory, prefix);

  if (!latest) {
    throw new SurveyReportError(404, 'Chưa có file report, hãy tạo mới trước khi tải');
  }

  const buffer = await fs.readFile(latest.path);
  return {
    fileName: latest.name,
    buffer,
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

  const responses = await loadSubmittedResponsesForExport(assignmentIds, tenantId);

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

  const rawRows = (responses || []).flatMap((response: any) => {
    const responseId = Number(response?.id || 0);
    const responseInfo = responseInfoById.get(responseId);

    return (Array.isArray(response?.survey_answers) ? response.survey_answers : []).map((answer: any) => ({
      Student: responseInfo?.studentName || '',
      Course: responseInfo?.courseName || '',
      Question: toText(answer?.survey_question?.content || ''),
      Answer: toText(answer?.text || answer?.value || ''),
    }));
  });

  const summaryByQuestion = new Map<string, { total: number; count: number }>();

  for (const response of responses || []) {
    for (const answer of Array.isArray(response?.survey_answers) ? response.survey_answers : []) {
      const questionContent = toText(answer?.survey_question?.content || '');
      const score = toScore(answer?.value);
      if (!questionContent || score === null) continue;

      const current = summaryByQuestion.get(questionContent) || { total: 0, count: 0 };
      current.total += score;
      current.count += 1;
      summaryByQuestion.set(questionContent, current);
    }
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

export async function exportCampaignCourseReport(campaignIdInput: unknown, courseIdInput: unknown, tenantId: number | string): Promise<ExportWorkbookResult> {
  const campaign = await findCampaignOrThrow(campaignIdInput, tenantId);
  const courseId = toText(courseIdInput);

  if (!courseId) {
    throw new SurveyReportError(400, 'Course id is invalid');
  }

  const assignments = await loadCourseAssignmentsForExport(campaign.id, courseId, tenantId);
  const assignmentIds = (assignments || [])
    .map((item: any) => Number(item?.id || 0))
    .filter((item: number) => Number.isInteger(item) && item > 0);

  const responses = await loadSubmittedResponsesForExport(assignmentIds, tenantId);

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
      courseName: toText(assignment?.courseName || assignment?.courseId || courseId),
      lecturerName: toText(assignment?.lecturerName || assignment?.lecturerId || ''),
    });
  }

  const rawRows = (responses || []).flatMap((response: any) => {
    const responseId = Number(response?.id || 0);
    const responseInfo = responseInfoById.get(responseId);

    return (Array.isArray(response?.survey_answers) ? response.survey_answers : []).map((answer: any) => ({
      Student: responseInfo?.studentName || '',
      Lecturer: responseInfo?.lecturerName || '',
      Question: toText(answer?.survey_question?.content || ''),
      Answer: toText(answer?.text || answer?.value || ''),
    }));
  });

  const summaryByQuestion = new Map<string, { total: number; count: number }>();

  for (const response of responses || []) {
    for (const answer of Array.isArray(response?.survey_answers) ? response.survey_answers : []) {
      const questionContent = toText(answer?.survey_question?.content || '');
      const score = toScore(answer?.value);
      if (!questionContent || score === null) continue;

      const current = summaryByQuestion.get(questionContent) || { total: 0, count: 0 };
      current.total += score;
      current.count += 1;
      summaryByQuestion.set(questionContent, current);
    }
  }

  const summaryRows = [...summaryByQuestion.entries()]
    .map(([question, bucket]) => ({
      Question: question,
      'Avg Score': bucket.count > 0 ? toFixedScore(bucket.total / bucket.count) : '',
    }))
    .sort((left, right) => toText(left.Question).localeCompare(toText(right.Question)));

  const workbook = XLSX.utils.book_new();
  const rawSheet = XLSX.utils.json_to_sheet(rawRows, { header: ['Student', 'Lecturer', 'Question', 'Answer'] });
  const summarySheet = XLSX.utils.json_to_sheet(summaryRows, { header: ['Question', 'Avg Score'] });
  XLSX.utils.book_append_sheet(workbook, rawSheet, 'Raw data');
  XLSX.utils.book_append_sheet(workbook, summarySheet, 'Summary');

  const courseName = assignments?.[0]?.courseName || courseId;

  return {
    fileName: `survey-report-${sanitizeFileNamePart(campaign.name, `campaign-${campaign.id}`)}-${sanitizeFileNamePart(courseName, courseId)}.xlsx`,
    buffer: XLSX.write(workbook, { bookType: 'xlsx', type: 'buffer' }) as Buffer,
  };
}

async function loadTemplateQuestions(templateId: number, tenantId: number | string) {
  if (!templateId) return [];

  const questions = await strapi.db.query(SURVEY_QUESTION_UID).findMany({
    where: mergeTenantWhere({
      survey_section: {
        survey_template: {
          id: {
            $eq: templateId,
          },
        },
      },
    }, tenantId),
    select: ['id', 'content', 'order'],
    populate: {
      survey_section: {
        select: ['id', 'title', 'order'],
      },
    },
  });

  return [...(questions || [])].sort((left: any, right: any) => {
    const sectionOrderDiff = Number(left?.survey_section?.order || 0) - Number(right?.survey_section?.order || 0);
    if (sectionOrderDiff !== 0) return sectionOrderDiff;

    const questionOrderDiff = Number(left?.order || 0) - Number(right?.order || 0);
    if (questionOrderDiff !== 0) return questionOrderDiff;

    return Number(left?.id || 0) - Number(right?.id || 0);
  });
}

async function loadSubmittedCampaignResponsesForExport(campaignId: number, tenantId: number | string) {
  // Only include responses that are explicitly SUBMITTED by the respondent.
  // This ensures we don't include drafts or in-progress entries.
  return strapi.db.query(SURVEY_RESPONSE_UID).findMany({
    where: mergeTenantWhere({
      responseStatus: 'SUBMITTED',
      survey_assignment: {
        id: {
          $notNull: true,
        },
        survey_campaign: {
          id: { $eq: campaignId },
        },
      },
    }, tenantId),
    select: ['id', 'submittedAt', 'respondentSnapshot'],
    populate: {
      survey_assignment: {
        select: ['id'],
        populate: {
          respondent: {
            select: ['id', 'username', 'fullName', 'email'],
          },
        },
      },
      survey_answers: {
        select: ['id', 'value', 'text'],
        // do NOT populate `survey_question` here to avoid heavy JOINs
      },
    },
    orderBy: [{ submittedAt: 'asc' }, { id: 'asc' }],
  });
}

async function loadAnswerToQuestionMap(answerIds: number[], tenantId: number | string) {
  if (!Array.isArray(answerIds) || answerIds.length === 0) return new Map<number, number>();

  const start = Date.now();
  try {
    const map = new Map<number, number>();

    // 1) Fast path: try reading from survey_answers directly using WHERE IN
    try {
      const directStart = Date.now();
      const directRows = await strapi.db.connection('survey_answers').whereIn('id', answerIds).select();
      strapi.log.info(`[survey-report] direct survey_answers lookup returned ${directRows.length} rows in ${Date.now() - directStart}ms`);

      if (directRows && directRows.length > 0) {
        for (const r of directRows) {
          const keys = Object.keys(r || {});
          const idKey = keys.find((k) => /\bid\b/i.test(k)) || keys.find((k) => /^id$/i.test(k));
          const questionKey = keys.find((k) => /question/i.test(k));
          const aid = idKey ? Number((r as any)[idKey] || 0) : Number((r as any)?.id || 0);
          const qid = questionKey ? Number((r as any)[questionKey] || 0) : 0;
          if (aid && qid) map.set(aid, qid);
        }
      }

      if (map.size > 0) {
        strapi.log.info(`[survey-report] resolved ${map.size} mappings from survey_answers in ${Date.now() - start}ms`);
        return map;
      }
    } catch (err: any) {
      strapi.log.warn('[survey-report] survey_answers lookup failed, will try link table', err?.message || err);
    }

    // 2) Try to detect link-table columns via information_schema and query with whereIn
    try {
      const infoStart = Date.now();
      const cols = await strapi.db.connection('information_schema.columns')
        .where({ table_name: 'survey_answers_survey_question_lnk', table_schema: 'public' })
        .select('column_name');
      const colNames = (cols || []).map((c: any) => String(c.column_name || '').toLowerCase());
      const answerCol = colNames.find((c: string) => c.includes('answer'));
      const questionCol = colNames.find((c: string) => c.includes('question'));
      strapi.log.info(`[survey-report] link table columns: ${colNames.join(', ')} (checked in ${Date.now() - infoStart}ms)`);

      if (answerCol && questionCol) {
        try {
          // Ensure numeric ids and avoid huge single WHERE IN clauses by chunking
          const ids = (answerIds || []).map((v) => Number(v)).filter((v) => Number.isFinite(v) && v > 0);
          const chunkSize = 1000;
          const queryStart = Date.now();
          let total = 0;
          for (let i = 0; i < ids.length; i += chunkSize) {
            const chunk = ids.slice(i, i + chunkSize);
            const rows = await strapi.db.connection('survey_answers_survey_question_lnk')
              .whereIn(answerCol, chunk)
              .select(answerCol, questionCol);
            for (const r of rows || []) {
              const aid = Number((r as any)[answerCol] || 0);
              const qid = Number((r as any)[questionCol] || 0);
              if (aid && qid) {
                map.set(aid, qid);
                total++;
              }
            }
          }
          strapi.log.info(`[survey-report] link-table whereIn scanned ${ids.length} ids in ${Date.now() - queryStart}ms, resolved ${map.size} mappings`);
          if (map.size > 0) {
            strapi.log.info(`[survey-report] resolved ${map.size} mappings from link table in ${Date.now() - start}ms`);
            return map;
          }
        } catch (err: any) {
          // Log full stack to make the failure visible in server logs
          strapi.log.error('[survey-report] link-table whereIn attempt error', {
            message: err?.message || String(err),
            stack: err?.stack || null,
            table: 'survey_answers_survey_question_lnk',
            answerCol,
            questionCol,
            sampleIds: JSON.stringify((answerIds || []).slice(0, 10)),
          });
          throw err;
        }
      }
    } catch (err: any) {
      strapi.log.warn('[survey-report] information_schema or link-table whereIn attempt failed', err?.message || err);
    }

    // 3) Last resort: full scan of link table and filter in JS (slower)
    try {
      const scanStart = Date.now();
      const rows = await strapi.db.connection('survey_answers_survey_question_lnk').select();
      for (const r of rows || []) {
        const keys = Object.keys(r || {});
        const answerKey = keys.find((k) => /answer/i.test(k));
        const questionKey = keys.find((k) => /question/i.test(k));
        if (!answerKey || !questionKey) continue;
        const aid = Number((r as any)[answerKey] || 0);
        const qid = Number((r as any)[questionKey] || 0);
        if (aid && qid && answerIds.includes(aid)) map.set(aid, qid);
      }
      strapi.log.info(`[survey-report] full scan produced ${map.size} mappings in ${Date.now() - scanStart}ms`);
      return map;
    } catch (err: any) {
      strapi.log.error('[survey-report] full scan of link table failed', err);
      return new Map();
    }
  } catch (err: any) {
    strapi.log.error('[survey-report] failed to build answer->question map', err);
    return new Map();
  }
}

function getAnswerDisplayValue(answer: any) {
  const text = toText(answer?.text);
  if (text) return text;
  return toText(answer?.value);
}

function buildQuestionHeaders(questions: any[]) {
  const used = new Map<string, number>();

  return questions.map((question, index) => {
    const baseHeader = toText(question?.content) || `Câu ${index + 1}`;
    const usedCount = Number(used.get(baseHeader) || 0) + 1;
    used.set(baseHeader, usedCount);

    return {
      id: Number(question?.id || 0),
      header: usedCount > 1 ? `${baseHeader} (${usedCount})` : baseHeader,
    };
  }).filter((item) => item.id > 0);
}