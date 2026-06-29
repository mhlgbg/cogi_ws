import { mergeTenantWhere } from '../../../utils/tenant-scope';
import { buildRestoreData, buildSoftDeleteData, mergeTenantSoftDeleteWhere } from '../../../utils/soft-delete';

const SURVEY_ASSIGNMENT_UID = 'api::survey-assignment.survey-assignment';
const SURVEY_CAMPAIGN_UID = 'api::survey-campaign.survey-campaign';
const USER_UID = 'plugin::users-permissions.user';

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

function toContextType(value: unknown): 'COURSE_LECTURER' | 'GRADUATION_EXIT' {
  const normalized = toTrimmedString(value).toUpperCase();
  if (normalized === 'COURSE_LECTURER' || normalized === 'GRADUATION_EXIT') {
    return normalized;
  }

  throw new SurveyAssignmentError(400, 'contextType is invalid');
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
    where: mergeTenantSoftDeleteWhere({ id: campaignId }, tenantId),
    select: ['id'],
  });

  if (!campaign?.id) {
    throw new SurveyAssignmentError(404, 'Survey campaign not found');
  }

  return campaign;
}

async function findRespondentByStudentCode(studentCode: unknown) {
  const normalizedStudentCode = toTrimmedString(studentCode);
  if (!normalizedStudentCode) {
    throw new SurveyAssignmentError(400, 'studentCode is required');
  }

  const respondent = await strapi.db.query(USER_UID).findOne({
    where: {
      username: {
        $eqi: normalizedStudentCode,
      },
    },
    select: ['id', 'username', 'fullName', 'email'],
  });

  if (!respondent?.id) {
    throw new SurveyAssignmentError(404, 'User not found by studentCode');
  }

  return respondent;
}

function buildDeletedFilter(query: any) {
  return {
    deletedOnly: query?.deletedOnly,
    showDeleted: query?.showDeleted,
    withDeleted: query?.withDeleted,
  };
}

function buildDuplicateWhere(options: {
  tenantId: number | string;
  campaignId: number;
  respondentId: number;
  contextType: 'COURSE_LECTURER' | 'GRADUATION_EXIT';
  classSectionId?: string;
  lecturerId?: string;
}) {
  const duplicateWhere: Record<string, unknown> = {
    tenant: {
      id: {
        $eq: options.tenantId,
      },
    },
    survey_campaign: {
      id: {
        $eq: options.campaignId,
      },
    },
    respondent: {
      id: {
        $eq: options.respondentId,
      },
    },
  };

  if (options.contextType === 'COURSE_LECTURER') {
    duplicateWhere.classSectionId = options.classSectionId || '';
    duplicateWhere.lecturerId = options.lecturerId || '';
  }

  return {
    $and: [
      duplicateWhere,
      {
        isDeleted: {
          $ne: true,
        },
      },
    ],
  };
}

async function buildAssignmentWhere(query: any, tenantId: number | string, campaignId: number) {
  const whereClauses: Record<string, unknown>[] = [
    {
      survey_campaign: {
        id: {
          $eq: campaignId,
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

  const keyword = toTrimmedString(query?.q || query?.studentKeyword || query?.student || query?.keyword);
  if (keyword) {
    const matchedRespondents = await strapi.db.query(USER_UID).findMany({
      where: {
        $or: [
          { username: { $containsi: keyword } },
          { fullName: { $containsi: keyword } },
        ],
      },
      select: ['id'],
      limit: 200,
    });

    const respondentIds = (matchedRespondents || [])
      .map((row: any) => Number(row?.id || 0))
      .filter((value: number) => Number.isInteger(value) && value > 0);

    whereClauses.push({
      respondent: {
        id: {
          $in: respondentIds.length > 0 ? respondentIds : [-1],
        },
      },
    });
  }

  return mergeTenantSoftDeleteWhere({ $and: whereClauses }, tenantId, buildDeletedFilter(query));
}

export async function listSurveyAssignments(query: any, tenantId: number | string) {
  const campaign = await findCampaignOrThrow(query?.campaignId, tenantId);
  const page = toPositiveInt(query?.page, 1) || 1;
  const pageSize = toPositiveInt(query?.pageSize, 20) || 20;
  const start = (page - 1) * pageSize;

  const where = await buildAssignmentWhere(query, tenantId, Number(campaign.id));

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

export async function createSurveyAssignment(payload: any, tenantId: number | string) {
  const campaign = await findCampaignOrThrow(payload?.campaignId, tenantId);
  const contextType = toContextType(payload?.contextType);
  const respondent = await findRespondentByStudentCode(payload?.studentCode);
  const courseId = toTrimmedString(payload?.courseId);
  const courseName = toTrimmedString(payload?.courseName);
  const lecturerId = toTrimmedString(payload?.lecturerId);
  const lecturerName = toTrimmedString(payload?.lecturerName);
  const classSectionId = toTrimmedString(payload?.classSectionId);

  const duplicateWhere = buildDuplicateWhere({
    tenantId,
    campaignId: Number(campaign.id),
    respondentId: Number(respondent.id),
    contextType,
    classSectionId,
    lecturerId,
  });

  const existing = await strapi.db.query(SURVEY_ASSIGNMENT_UID).findOne({
    where: duplicateWhere,
    select: ['id'],
  });

  if (existing?.id) {
    throw new SurveyAssignmentError(409, 'Assignment already exists');
  }

  const createdEntity = await strapi.entityService.create(SURVEY_ASSIGNMENT_UID, {
    data: {
      tenant: tenantId,
      survey_campaign: campaign.id,
      respondent: respondent.id,
      contextType,
      courseId,
      courseName,
      lecturerId,
      lecturerName,
      classSectionId,
      isDeleted: false,
      deletedAt: null,
      deletedBy: null,
    } as any,
  }) as any;

  const created = await strapi.db.query(SURVEY_ASSIGNMENT_UID).findOne({
    where: mergeTenantWhere({ id: createdEntity?.id }, tenantId),
    populate: {
      respondent: {
        select: ['id', 'username', 'fullName', 'email'],
      },
      survey_responses: {
        select: ['id', 'responseStatus', 'submittedAt', 'updatedAt', 'createdAt'],
      },
    },
  });

  return normalizeAssignment(created);
}

export async function deleteSurveyAssignmentsByFilter(query: any, tenantId: number | string, userId?: number) {
  const campaign = await findCampaignOrThrow(query?.campaignId, tenantId);
  const where = await buildAssignmentWhere(query, tenantId, Number(campaign.id));

  const assignmentRows = await strapi.db.query(SURVEY_ASSIGNMENT_UID).findMany({
    where,
    select: ['id'],
  });

  const assignmentIds = (assignmentRows || [])
    .map((row: any) => Number(row?.id || 0))
    .filter((value: number) => Number.isInteger(value) && value > 0);

  if (assignmentIds.length === 0) {
    return {
      softDeletedAssignments: 0,
    };
  }

  await Promise.all(assignmentIds.map((assignmentId) => strapi.db.query(SURVEY_ASSIGNMENT_UID).update({
    where: mergeTenantWhere({ id: assignmentId }, tenantId),
    data: buildSoftDeleteData(userId),
  })));

  return {
    softDeletedAssignments: assignmentIds.length,
  };
}

export async function restoreSurveyAssignmentsByFilter(query: any, tenantId: number | string) {
  const campaign = await findCampaignOrThrow(query?.campaignId, tenantId);
  const where = await buildAssignmentWhere({
    ...query,
    deletedOnly: true,
  }, tenantId, Number(campaign.id));

  const rows = await strapi.db.query(SURVEY_ASSIGNMENT_UID).findMany({
    where,
    select: ['id'],
  });

  const assignmentIds = (rows || [])
    .map((row: any) => Number(row?.id || 0))
    .filter((value: number) => Number.isInteger(value) && value > 0);

  await Promise.all(assignmentIds.map((assignmentId) => strapi.db.query(SURVEY_ASSIGNMENT_UID).update({
    where: mergeTenantWhere({ id: assignmentId }, tenantId),
    data: buildRestoreData(),
  })));

  return {
    restoredAssignments: assignmentIds.length,
  };
}

export async function restoreSurveyAssignment(id: unknown, tenantId: number | string) {
  const assignmentId = toPositiveInt(id);
  if (!assignmentId) {
    throw new SurveyAssignmentError(400, 'assignmentId is invalid');
  }

  const existing = await strapi.db.query(SURVEY_ASSIGNMENT_UID).findOne({
    where: mergeTenantSoftDeleteWhere({ id: assignmentId }, tenantId, { deletedOnly: true }),
    populate: {
      respondent: {
        select: ['id', 'username', 'fullName', 'email'],
      },
      survey_responses: {
        select: ['id', 'responseStatus', 'submittedAt', 'updatedAt', 'createdAt'],
      },
    },
  });

  if (!existing?.id) {
    throw new SurveyAssignmentError(404, 'Survey assignment not found');
  }

  await strapi.db.query(SURVEY_ASSIGNMENT_UID).update({
    where: mergeTenantWhere({ id: existing.id }, tenantId),
    data: buildRestoreData(),
  });

  const restored = await strapi.db.query(SURVEY_ASSIGNMENT_UID).findOne({
    where: mergeTenantWhere({ id: existing.id }, tenantId),
    populate: {
      respondent: {
        select: ['id', 'username', 'fullName', 'email'],
      },
      survey_responses: {
        select: ['id', 'responseStatus', 'submittedAt', 'updatedAt', 'createdAt'],
      },
    },
  });

  return normalizeAssignment(restored);
}