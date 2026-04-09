import { mergeTenantWhere } from '../../../utils/tenant-scope';

const SURVEY_ASSIGNMENT_UID = 'api::survey-assignment.survey-assignment';
const SURVEY_CAMPAIGN_UID = 'api::survey-campaign.survey-campaign';

type ResponseStatus = 'IN_PROGRESS' | 'SUBMITTED' | 'RESET';

class SurveyAssignmentError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

function toPositiveInt(value: unknown, fallback: number | null = null): number | null {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) return fallback;
  return parsed;
}

function toTrimmedString(value: unknown): string {
  if (value === null || value === undefined) return '';
  return String(value).trim();
}

function toBooleanFilter(value: unknown): boolean | null {
  if (typeof value === 'boolean') return value;
  const text = toTrimmedString(value).toLowerCase();
  if (text === 'true' || text === '1') return true;
  if (text === 'false' || text === '0') return false;
  return null;
}

function getResponseStatus(value: any): ResponseStatus | null {
  const normalized = toTrimmedString(value?.responseStatus || value?.status).toUpperCase();
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

function normalizeAssignment(row: any) {
  const latestResponseStatus = getAssignmentStatus(row);
  const wasCompletedBeforeReset = Array.isArray(row?.survey_responses)
    && row.survey_responses.some((item: any) => getResponseStatus(item) === 'RESET' && item?.submittedAt);

  return {
    id: row.id,
    student: {
      id: row?.respondent?.id || null,
      studentCode: row?.respondent?.username || '',
      fullName: row?.respondent?.fullName || '',
      email: row?.respondent?.email || '',
    },
    courseId: row.courseId || '',
    courseName: row.courseName || '',
    lecturerId: row.lecturerId || '',
    lecturerName: row.lecturerName || '',
    classSectionId: row.classSectionId || '',
    contextType: row.contextType || '',
    isCompleted: Boolean(row.isCompleted),
    latestResponseStatus,
    wasCompletedBeforeReset,
    statusLabel: latestResponseStatus === 'SUBMITTED' ? 'COMPLETED' : latestResponseStatus,
  };
}

async function findCampaignOrThrow(id: unknown, tenantId: number | string) {
  const campaignId = toPositiveInt(id);
  if (!campaignId) {
    throw new SurveyAssignmentError(400, 'campaignId is required');
  }

  const campaign = await strapi.db.query(SURVEY_CAMPAIGN_UID).findOne({
    where: mergeTenantWhere({ id: campaignId }, tenantId),
    select: ['id'],
  });

  if (!campaign?.id) {
    throw new SurveyAssignmentError(404, 'Survey campaign not found');
  }

  return campaign;
}

export async function listSurveyAssignments(query: any, tenantId: number | string) {
  const campaign = await findCampaignOrThrow(query?.campaignId, tenantId);
  const page = toPositiveInt(query?.page, 1) || 1;
  const pageSize = toPositiveInt(query?.pageSize, 20) || 20;
  const start = (page - 1) * pageSize;

  const whereClauses: Record<string, unknown>[] = [
    {
      survey_campaign: {
        id: {
          $eq: campaign.id,
        },
      },
    },
  ];

  const isCompleted = toBooleanFilter(query?.isCompleted);
  if (isCompleted !== null) {
    whereClauses.push({ isCompleted });
  }

  const courseId = toTrimmedString(query?.courseId);
  if (courseId) {
    whereClauses.push({ courseId: { $eqi: courseId } });
  }

  const lecturerId = toTrimmedString(query?.lecturerId);
  if (lecturerId) {
    whereClauses.push({ lecturerId: { $eqi: lecturerId } });
  }

  const where = mergeTenantWhere({ $and: whereClauses }, tenantId);

  const [rows, total] = await Promise.all([
    strapi.db.query(SURVEY_ASSIGNMENT_UID).findMany({
      where,
      offset: start,
      limit: pageSize,
      orderBy: [{ createdAt: 'desc' }],
      populate: {
        respondent: {
          select: ['id', 'username', 'fullName', 'email'],
        },
        survey_responses: {
          select: ['id', 'responseStatus', 'submittedAt', 'updatedAt', 'createdAt'],
        },
      },
    }),
    strapi.db.query(SURVEY_ASSIGNMENT_UID).count({ where }),
  ]);

  return {
    data: (rows || []).map(normalizeAssignment),
    meta: {
      page,
      pageSize,
      pageCount: Math.max(1, Math.ceil(total / pageSize)),
      total,
    },
  };
}