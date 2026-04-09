import fs from 'node:fs/promises';
import XLSX from 'xlsx';
import { findEntityByRef, mergeTenantWhere, resolveCurrentTenantId, toText } from '../../../utils/tenant-scope';

const SURVEY_CAMPAIGN_UID = 'api::survey-campaign.survey-campaign';
const SURVEY_ASSIGNMENT_UID = 'api::survey-assignment.survey-assignment';
const SURVEY_TEMPLATE_UID = 'api::survey-template.survey-template';
const SURVEY_RESPONSE_UID = 'api::survey-response.survey-response';
const USER_UID = 'plugin::users-permissions.user';

type UploadedFileLike = {
  filepath?: string;
  path?: string;
  tempFilePath?: string;
  buffer?: Buffer;
};

class SurveyCampaignError extends Error {
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

function toNullableString(value: unknown): string | null {
  const text = toTrimmedString(value);
  return text || null;
}

function toRequiredString(value: unknown, fieldName: string): string {
  const text = toTrimmedString(value);
  if (!text) {
    throw new SurveyCampaignError(400, `${fieldName} is required`);
  }
  return text;
}

function toIsoDateTime(value: unknown, fieldName: string): string | null {
  const text = toTrimmedString(value);
  if (!text) return null;

  const date = new Date(text);
  if (Number.isNaN(date.getTime())) {
    throw new SurveyCampaignError(400, `${fieldName} is invalid`);
  }

  return date.toISOString();
}

function toCampaignStatus(value: unknown): 'DRAFT' | 'OPEN' | 'CLOSED' {
  const text = toTrimmedString(value).toUpperCase();
  if (text === 'OPEN' || text === 'CLOSED') return text;
  return 'DRAFT';
}

function toBooleanFilter(value: unknown): boolean | null {
  if (typeof value === 'boolean') return value;
  const text = toTrimmedString(value).toLowerCase();
  if (text === 'true' || text === '1') return true;
  if (text === 'false' || text === '0') return false;
  return null;
}

function extractPayload(body: any): Record<string, unknown> {
  if (body?.data && typeof body.data === 'object' && !Array.isArray(body.data)) {
    return body.data as Record<string, unknown>;
  }

  if (body && typeof body === 'object' && !Array.isArray(body)) {
    return body as Record<string, unknown>;
  }

  return {};
}

function normalizeCampaign(campaign: any, stats?: { total: number; completed: number }) {
  const totalAssignments = Number(stats?.total || 0);
  const completedAssignments = Number(stats?.completed || 0);
  const progressPercent = totalAssignments > 0
    ? Math.round((completedAssignments / totalAssignments) * 100)
    : 0;

  return {
    id: campaign.id,
    name: campaign.name,
    description: campaign.description || '',
    academicYear: campaign.academicYear || '',
    semester: campaign.semester || '',
    startAt: campaign.startAt || null,
    endAt: campaign.endAt || null,
    campaignStatus: campaign.campaignStatus || 'DRAFT',
    surveyTemplate: campaign.survey_template
      ? {
          id: campaign.survey_template.id,
          name: campaign.survey_template.name,
          code: campaign.survey_template.code,
          type: campaign.survey_template.type,
        }
      : null,
    totalAssignments,
    completedAssignments,
    progressPercent,
  };
}

function getFilePath(file: UploadedFileLike) {
  return file.filepath || file.path || file.tempFilePath || '';
}

async function readWorkbookBuffer(file: UploadedFileLike): Promise<Buffer> {
  if (file.buffer && Buffer.isBuffer(file.buffer)) {
    return file.buffer;
  }

  const filePath = getFilePath(file);
  if (!filePath) {
    throw new SurveyCampaignError(400, 'Uploaded file path was not found');
  }

  return fs.readFile(filePath);
}

async function ensureTemplateInTenant(templateRef: unknown, tenantId: number | string) {
  const template = await findEntityByRef(SURVEY_TEMPLATE_UID, templateRef, {
    tenant: {
      select: ['id'],
    },
  });

  if (!template) {
    throw new SurveyCampaignError(400, 'survey_template is invalid');
  }

  const templateTenantId = Number(template?.tenant?.id || template?.tenant || 0);
  if (!Number.isInteger(templateTenantId) || String(templateTenantId) !== String(tenantId)) {
    throw new SurveyCampaignError(403, 'survey_template does not belong to current tenant');
  }

  return template;
}

function buildCampaignData(payload: Record<string, unknown>, tenantId: number | string) {
  const startAt = toIsoDateTime(payload.startAt, 'startAt');
  const endAt = toIsoDateTime(payload.endAt, 'endAt');

  if (startAt && endAt && new Date(endAt).getTime() < new Date(startAt).getTime()) {
    throw new SurveyCampaignError(400, 'endAt must be greater than or equal to startAt');
  }

  return {
    name: toRequiredString(payload.name, 'name'),
    description: toNullableString(payload.description),
    academicYear: toNullableString(payload.academicYear),
    semester: toNullableString(payload.semester),
    startAt,
    endAt,
    campaignStatus: toCampaignStatus(payload.campaignStatus),
    survey_template: payload.survey_template,
    tenant: tenantId,
  };
}

async function collectCampaignStats(campaignIds: number[], tenantId: number | string) {
  if (campaignIds.length === 0) {
    return new Map<number, { total: number; completed: number }>();
  }

  const rows = await strapi.db.query(SURVEY_ASSIGNMENT_UID).findMany({
    where: mergeTenantWhere({
      survey_campaign: {
        id: {
          $in: campaignIds,
        },
      },
    }, tenantId),
    select: ['id', 'isCompleted'],
    populate: {
      survey_campaign: {
        select: ['id'],
      },
    },
  });

  const stats = new Map<number, { total: number; completed: number }>();

  for (const row of rows || []) {
    const campaignId = Number(row?.survey_campaign?.id || row?.survey_campaign || 0);
    if (!Number.isInteger(campaignId) || campaignId <= 0) continue;

    const current = stats.get(campaignId) || { total: 0, completed: 0 };
    current.total += 1;
    if (row?.isCompleted) current.completed += 1;
    stats.set(campaignId, current);
  }

  return stats;
}

async function findCampaignOrThrow(id: unknown, tenantId: number | string) {
  const campaignId = toPositiveInt(id);
  if (!campaignId) {
    throw new SurveyCampaignError(400, 'Campaign id is invalid');
  }

  const campaign = await strapi.db.query(SURVEY_CAMPAIGN_UID).findOne({
    where: mergeTenantWhere({ id: campaignId }, tenantId),
    populate: {
      survey_template: {
        select: ['id', 'name', 'code', 'type'],
      },
      tenant: {
        select: ['id'],
      },
    },
  });

  if (!campaign) {
    throw new SurveyCampaignError(404, 'Survey campaign not found');
  }

  return campaign;
}

function findColumnValue(row: Record<string, unknown>, aliases: string[]) {
  const entries = Object.entries(row || {});
  for (const [key, value] of entries) {
    const normalizedKey = toTrimmedString(key).toLowerCase();
    if (aliases.includes(normalizedKey)) {
      return value;
    }
  }
  return '';
}

function normalizeImportRow(row: Record<string, unknown>) {
  return {
    studentCode: toTrimmedString(findColumnValue(row, ['studentcode', 'student_code', 'student code'])),
    courseId: toTrimmedString(findColumnValue(row, ['courseid', 'course_id', 'course id'])),
    courseName: toTrimmedString(findColumnValue(row, ['coursename', 'course_name', 'course name'])),
    classSectionId: toTrimmedString(findColumnValue(row, ['classsectionid', 'class_section_id', 'class section id'])),
    lecturerId: toTrimmedString(findColumnValue(row, ['lecturerid', 'lecturer_id', 'lecturer id'])),
    lecturerName: toTrimmedString(findColumnValue(row, ['lecturername', 'lecturer_name', 'lecturer name'])),
  };
}

export async function listSurveyCampaigns(query: any, tenantId: number | string) {
  const page = toPositiveInt(query?.page, 1) || 1;
  const pageSize = toPositiveInt(query?.pageSize, 20) || 20;
  const start = (page - 1) * pageSize;
  const campaignStatus = toTrimmedString(query?.campaignStatus).toUpperCase();
  const search = toTrimmedString(query?.q);

  const whereClauses: Record<string, unknown>[] = [];
  if (campaignStatus) {
    whereClauses.push({ campaignStatus });
  }

  if (search) {
    whereClauses.push({
      $or: [
        { name: { $containsi: search } },
        { academicYear: { $containsi: search } },
        { semester: { $containsi: search } },
      ],
    });
  }

  const baseWhere = whereClauses.length > 0 ? { $and: whereClauses } : {};
  const where = mergeTenantWhere(baseWhere, tenantId);

  const [rows, total] = await Promise.all([
    strapi.db.query(SURVEY_CAMPAIGN_UID).findMany({
      where,
      offset: start,
      limit: pageSize,
      orderBy: [{ createdAt: 'desc' }],
      populate: {
        survey_template: {
          select: ['id', 'name', 'code', 'type'],
        },
      },
    }),
    strapi.db.query(SURVEY_CAMPAIGN_UID).count({ where }),
  ]);

  const campaignIds = (rows || [])
    .map((item: any) => Number(item?.id || 0))
    .filter((item: number) => Number.isInteger(item) && item > 0);
  const statsByCampaign = await collectCampaignStats(campaignIds, tenantId);

  return {
    data: (rows || []).map((campaign: any) => normalizeCampaign(campaign, statsByCampaign.get(Number(campaign.id)))),
    meta: {
      page,
      pageSize,
      pageCount: Math.max(1, Math.ceil(total / pageSize)),
      total,
    },
  };
}

export async function getSurveyCampaignDetail(id: unknown, tenantId: number | string) {
  const campaign = await findCampaignOrThrow(id, tenantId);
  const statsByCampaign = await collectCampaignStats([Number(campaign.id)], tenantId);
  return normalizeCampaign(campaign, statsByCampaign.get(Number(campaign.id)));
}

export async function getSurveyCampaignFormOptions(tenantId: number | string) {
  const templates = await strapi.db.query(SURVEY_TEMPLATE_UID).findMany({
    where: mergeTenantWhere({ isActive: true }, tenantId),
    orderBy: [{ name: 'asc' }],
    select: ['id', 'name', 'code', 'type', 'isActive'],
  });

  return {
    templates: (templates || []).map((item: any) => ({
      id: item.id,
      name: item.name,
      code: item.code,
      type: item.type,
      isActive: Boolean(item.isActive),
    })),
  };
}

export async function createSurveyCampaign(body: any, tenantId: number | string) {
  const payload = extractPayload(body);
  await ensureTemplateInTenant(payload.survey_template, tenantId);
  const data = buildCampaignData(payload, tenantId);

  const created = await strapi.db.query(SURVEY_CAMPAIGN_UID).create({ data });
  return getSurveyCampaignDetail(created.id, tenantId);
}

export async function updateSurveyCampaign(id: unknown, body: any, tenantId: number | string) {
  const existing = await findCampaignOrThrow(id, tenantId);
  const payload = extractPayload(body);

  const templateRef = payload.survey_template ?? existing?.survey_template?.id ?? existing?.survey_template;
  await ensureTemplateInTenant(templateRef, tenantId);

  const data = buildCampaignData({
    ...existing,
    ...payload,
    survey_template: templateRef,
  }, tenantId);

  await strapi.db.query(SURVEY_CAMPAIGN_UID).update({
    where: { id: existing.id },
    data,
  });

  return getSurveyCampaignDetail(existing.id, tenantId);
}

export async function resetSurveyCampaignResponses(id: unknown, tenantId: number | string) {
  const campaign = await findCampaignOrThrow(id, tenantId);

  const responses = await strapi.db.query(SURVEY_RESPONSE_UID).findMany({
    where: mergeTenantWhere({
      survey_assignment: {
        survey_campaign: {
          id: {
            $eq: campaign.id,
          },
        },
      },
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
    }, tenantId),
    select: ['id', 'submittedAt'],
    populate: {
      survey_assignment: {
        select: ['id'],
      },
    },
  });

  const assignmentIds = [...new Set((responses || [])
    .map((item: any) => Number(item?.survey_assignment?.id || item?.survey_assignment || 0))
    .filter((value: number) => Number.isInteger(value) && value > 0))];

  for (const response of responses || []) {
    if (!response?.id) continue;
    await strapi.db.query(SURVEY_RESPONSE_UID).update({
      where: { id: response.id },
      data: {
        responseStatus: 'RESET',
      },
    });
  }

  for (const assignmentId of assignmentIds) {
    await strapi.db.query(SURVEY_ASSIGNMENT_UID).update({
      where: { id: assignmentId },
      data: {
        isCompleted: false,
      },
    });
  }

  return {
    campaignId: campaign.id,
    campaignName: campaign.name,
    resetResponses: Number(responses?.length || 0),
    resetAssignments: Number(assignmentIds.length || 0),
  };
}

export async function importSurveyAssignments(options: {
  campaignId: unknown;
  contextType: unknown;
  file: UploadedFileLike;
  tenantId: number | string;
  userId: number;
}) {
  const tenantId = options.tenantId;
  const userId = Number(options.userId);
  const campaign = await findCampaignOrThrow(options.campaignId, tenantId);
  const contextType = toTrimmedString(options.contextType).toUpperCase();

  if (contextType !== 'COURSE_LECTURER' && contextType !== 'GRADUATION_EXIT') {
    throw new SurveyCampaignError(400, 'contextType is invalid');
  }

  if (!Number.isInteger(userId) || userId <= 0) {
    throw new SurveyCampaignError(401, 'Unauthorized');
  }

  const buffer = await readWorkbookBuffer(options.file);
  const workbook = XLSX.read(buffer, { type: 'buffer' });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) {
    throw new SurveyCampaignError(400, 'Workbook does not contain any sheet');
  }

  const worksheet = workbook.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(worksheet, {
    defval: '',
    raw: false,
  });

  const skippedRows: Array<Record<string, unknown>> = [];
  const errorRows: Array<Record<string, unknown>> = [];
  let created = 0;

  for (let index = 0; index < rows.length; index += 1) {
    const rowNumber = index + 2;
    const row = normalizeImportRow(rows[index] || {});

    if (!row.studentCode) {
      errorRows.push({ rowNumber, studentCode: '', message: 'studentCode is required' });
      continue;
    }

    try {
      const respondent = await strapi.db.query(USER_UID).findOne({
        where: {
          username: {
            $eqi: row.studentCode,
          },
        },
        select: ['id', 'username', 'email', 'fullName'],
      });

      if (!respondent?.id) {
        errorRows.push({ rowNumber, studentCode: row.studentCode, message: 'User not found by studentCode' });
        continue;
      }

      const duplicateWhere: Record<string, unknown> = {
        tenant: {
          id: {
            $eq: tenantId,
          },
        },
        survey_campaign: {
          id: {
            $eq: campaign.id,
          },
        },
        respondent: {
          id: {
            $eq: respondent.id,
          },
        },
      };

      if (contextType === 'COURSE_LECTURER') {
        duplicateWhere.classSectionId = row.classSectionId;
        duplicateWhere.lecturerId = row.lecturerId;
      }

      const existing = await strapi.db.query(SURVEY_ASSIGNMENT_UID).findOne({
        where: duplicateWhere,
        select: ['id'],
      });

      if (existing?.id) {
        skippedRows.push({
          rowNumber,
          studentCode: row.studentCode,
          courseId: row.courseId,
          lecturerId: row.lecturerId,
          classSectionId: row.classSectionId,
          message: 'Assignment already exists',
        });
        continue;
      }

      await strapi.db.query(SURVEY_ASSIGNMENT_UID).create({
        data: {
          respondent: respondent.id,
          survey_campaign: campaign.id,
          contextType,
          courseId: row.courseId,
          courseName: row.courseName,
          classSectionId: row.classSectionId,
          lecturerId: row.lecturerId,
          lecturerName: row.lecturerName,
          tenant: tenantId,
        },
      });

      created += 1;
    } catch (error: any) {
      errorRows.push({
        rowNumber,
        studentCode: row.studentCode,
        message: toText(error?.message) || 'Failed to import assignment',
      });
    }
  }

  return {
    campaignId: campaign.id,
    campaignName: campaign.name,
    total: rows.length,
    created,
    skipped: skippedRows.length,
    errors: errorRows.length,
    skippedRows,
    errorRows,
  };
}

export function getTenantIdFromContext(ctx: any) {
  return resolveCurrentTenantId(ctx);
}