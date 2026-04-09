import { mergeTenantWhere, resolveCurrentTenantId, toText, toPositiveInt, parseOptionalPositiveInt } from '../../../utils/tenant-scope';

const CAMPAIGN_UID = 'api::campaign.campaign';
const FORM_TEMPLATE_UID = 'api::form-template.form-template';
const ADMISSION_APPLICATION_UID = 'api::admission-application.admission-application';
const NOTIFICATION_TEMPLATE_UID = 'api::notification-template.notification-template';

class AdmissionManagementError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

function toNullableText(value: unknown): string | null {
  const text = toText(value);
  return text || null;
}

function toRequiredText(value: unknown, label: string): string {
  const text = toText(value);
  if (!text) {
    throw new AdmissionManagementError(400, `${label} is required`);
  }
  return text;
}

function toNullableDate(value: unknown, label: string): string | null {
  const text = toText(value);
  if (!text) return null;
  const date = new Date(text);
  if (Number.isNaN(date.getTime())) {
    throw new AdmissionManagementError(400, `${label} is invalid`);
  }
  return date.toISOString().slice(0, 10);
}

function toRequiredInteger(value: unknown, label: string): number {
  const parsed = parseOptionalPositiveInt(value);
  if (!parsed) {
    throw new AdmissionManagementError(400, `${label} is required`);
  }
  return parsed;
}

function toCampaignStatus(value: unknown): 'draft' | 'open' | 'closed' {
  const status = toText(value).toLowerCase();
  if (status === 'open' || status === 'closed') return status;
  return 'draft';
}

function toTemplateStatus(value: unknown): 'draft' | 'published' | 'archived' {
  const status = toText(value).toLowerCase();
  if (status === 'published' || status === 'archived') return status;
  return 'draft';
}

function toNotificationType(value: unknown): 'email' | 'sms' | 'ui' {
  const type = toText(value).toLowerCase();
  if (type === 'sms' || type === 'ui') return type;
  return 'email';
}

function toBoolean(value: unknown, fallback = false): boolean {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value !== 0;
  const text = toText(value).toLowerCase();
  if (!text) return fallback;
  return ['true', '1', 'yes', 'on'].includes(text);
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


function readCampaignStatus(value: any): string {
  return value?.campaignStatus || value?.status || 'draft';
}

function readFormTemplateStatus(value: any): string {
  return value?.formTemplateStatus || value?.status || 'draft';
}

function normalizeFormTemplate(row: any, usageCount = 0) {
  return {
    id: row.id,
    name: row.name || '',
    version: Number(row.version || 0),
    formTemplateStatus: readFormTemplateStatus(row),
    status: readFormTemplateStatus(row),
    isLocked: row.isLocked === true,
    schema: row.schema ?? null,
    tenant: row.tenant ? { id: row.tenant.id } : null,
    usageCount: Number(usageCount || 0),
  };
}

function normalizeCampaign(row: any, applicationCount = 0) {
  return {
    id: row.id,
    name: row.name || '',
    code: row.code || '',
    year: Number(row.year || 0),
    grade: row.grade || '',
    startDate: row.startDate || null,
    endDate: row.endDate || null,
    campaignStatus: readCampaignStatus(row),
    status: readCampaignStatus(row),
    description: row.description || '',
    isActive: row.isActive !== false,
    formTemplateVersion: Number(row.formTemplateVersion || 0),
    formTemplate: row.formTemplate
      ? {
          id: row.formTemplate.id,
          name: row.formTemplate.name || '',
          version: Number(row.formTemplate.version || 0),
          formTemplateStatus: readFormTemplateStatus(row.formTemplate),
          status: readFormTemplateStatus(row.formTemplate),
          isLocked: row.formTemplate.isLocked === true,
        }
      : null,
    applicationCount: Number(applicationCount || 0),
  };
}

function normalizeNotificationTemplate(row: any) {
  return {
    id: row.id,
    code: row.code || '',
    name: row.name || '',
    subject: row.subject || '',
    content: row.content || '',
    variables: row.variables ?? null,
    type: row.type || 'email',
    isActive: row.isActive !== false,
    tenant: row.tenant
      ? {
          id: row.tenant.id,
          name: row.tenant.name || '',
          code: row.tenant.code || '',
        }
      : null,
  };
}

async function findCampaignOrThrow(id: unknown, tenantId: number | string) {
  const campaignId = parseOptionalPositiveInt(id);
  if (!campaignId) {
    throw new AdmissionManagementError(400, 'Campaign id is invalid');
  }

  const campaign = await strapi.db.query(CAMPAIGN_UID).findOne({
    where: mergeTenantWhere({ id: campaignId }, tenantId),
    populate: {
      formTemplate: {
        select: ['id', 'name', 'version', 'formTemplateStatus', 'isLocked'],
      },
      tenant: {
        select: ['id'],
      },
    },
  });

  if (!campaign?.id) {
    throw new AdmissionManagementError(404, 'Admission campaign not found');
  }

  return campaign;
}

async function findFormTemplateOrThrow(id: unknown, tenantId: number | string) {
  const templateId = parseOptionalPositiveInt(id);
  if (!templateId) {
    throw new AdmissionManagementError(400, 'FormTemplate id is invalid');
  }

  const template = await strapi.db.query(FORM_TEMPLATE_UID).findOne({
    where: mergeTenantWhere({ id: templateId }, tenantId),
    populate: {
      tenant: { select: ['id'] },
    },
  });

  if (!template?.id) {
    throw new AdmissionManagementError(404, 'FormTemplate not found');
  }

  return template;
}

async function findNotificationTemplateOrThrow(id: unknown, tenantId: number | string) {
  const templateId = parseOptionalPositiveInt(id);
  if (!templateId) {
    throw new AdmissionManagementError(400, 'NotificationTemplate id is invalid');
  }

  const template = await strapi.db.query(NOTIFICATION_TEMPLATE_UID).findOne({
    where: mergeTenantWhere({ id: templateId }, tenantId),
    populate: {
      tenant: { select: ['id', 'name', 'code'] },
    },
  });

  if (!template?.id) {
    throw new AdmissionManagementError(404, 'NotificationTemplate not found');
  }

  return template;
}

async function ensureCampaignCodeAvailable(code: string, excludeId?: number | null) {
  const existing = await strapi.db.query(CAMPAIGN_UID).findOne({
    where: {
      code,
      ...(excludeId ? { id: { $ne: excludeId } } : {}),
    },
    select: ['id'],
  });

  if (existing?.id) {
    throw new AdmissionManagementError(409, 'Campaign code already exists');
  }
}

async function ensureTemplateBelongsToTenant(formTemplateId: number, tenantId: number | string) {
  const formTemplate = await strapi.db.query(FORM_TEMPLATE_UID).findOne({
    where: mergeTenantWhere({ id: formTemplateId }, tenantId),
    select: ['id', 'version', 'name', 'formTemplateStatus', 'isLocked'],
  });

  if (!formTemplate?.id) {
    throw new AdmissionManagementError(400, 'formTemplate is invalid');
  }

  return formTemplate;
}

async function getApplicationCountMap(campaignIds: number[], tenantId: number | string) {
  const counts = new Map<number, number>();
  if (campaignIds.length === 0) return counts;

  const rows = await strapi.db.query(ADMISSION_APPLICATION_UID).findMany({
    where: mergeTenantWhere({
      campaign: {
        id: {
          $in: campaignIds,
        },
      },
    }, tenantId),
    select: ['id'],
    populate: {
      campaign: {
        select: ['id'],
      },
    },
  });

  for (const row of rows || []) {
    const campaignId = Number(row?.campaign?.id || row?.campaign || 0);
    if (!Number.isInteger(campaignId) || campaignId <= 0) continue;
    counts.set(campaignId, Number(counts.get(campaignId) || 0) + 1);
  }

  return counts;
}

async function getCampaignUsageCountMap(formTemplateIds: number[], tenantId: number | string) {
  const counts = new Map<number, number>();
  if (formTemplateIds.length === 0) return counts;

  const rows = await strapi.db.query(CAMPAIGN_UID).findMany({
    where: mergeTenantWhere({
      formTemplate: {
        id: {
          $in: formTemplateIds,
        },
      },
    }, tenantId),
    select: ['id'],
    populate: {
      formTemplate: {
        select: ['id'],
      },
    },
  });

  for (const row of rows || []) {
    const formTemplateId = Number(row?.formTemplate?.id || row?.formTemplate || 0);
    if (!Number.isInteger(formTemplateId) || formTemplateId <= 0) continue;
    counts.set(formTemplateId, Number(counts.get(formTemplateId) || 0) + 1);
  }

  return counts;
}

function buildCampaignData(payload: Record<string, unknown>, tenantId: number | string, formTemplateId: number) {
  const startDate = toNullableDate(payload.startDate, 'startDate');
  const endDate = toNullableDate(payload.endDate, 'endDate');

  if (startDate && endDate && endDate < startDate) {
    throw new AdmissionManagementError(400, 'endDate must be greater than or equal to startDate');
  }

  return {
    name: toRequiredText(payload.name, 'name'),
    code: toRequiredText(payload.code, 'code'),
    year: toRequiredInteger(payload.year, 'year'),
    grade: toRequiredText(payload.grade, 'grade'),
    startDate,
    endDate,
    campaignStatus: toCampaignStatus(payload.campaignStatus ?? payload.status),
    description: toNullableText(payload.description),
    isActive: toBoolean(payload.isActive, true),
    formTemplate: formTemplateId,
    tenant: tenantId,
  };
}

function parseTemplateSchema(value: unknown) {
  if (value && typeof value === 'object') return value;

  const text = toText(value);
  if (!text) {
    throw new AdmissionManagementError(400, 'schema is required');
  }

  try {
    return JSON.parse(text);
  } catch {
    throw new AdmissionManagementError(400, 'schema must be valid JSON');
  }
}

function parseNotificationVariables(value: unknown) {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value === 'object') return value;

  const text = toText(value);
  if (!text) return null;

  try {
    return JSON.parse(text);
  } catch {
    throw new AdmissionManagementError(400, 'variables must be valid JSON');
  }
}

function buildFormTemplateData(payload: Record<string, unknown>, tenantId: number | string) {
  return {
    tenant: tenantId,
    name: toRequiredText(payload.name, 'name'),
    version: toRequiredInteger(payload.version, 'version'),
    schema: parseTemplateSchema(payload.schema),
    formTemplateStatus: toTemplateStatus(payload.formTemplateStatus ?? payload.status),
    isLocked: toBoolean(payload.isLocked, false),
  };
}

function buildNotificationTemplateData(payload: Record<string, unknown>, tenantId: number | string) {
  return {
    tenant: tenantId,
    code: toRequiredText(payload.code, 'code').toLowerCase(),
    name: toRequiredText(payload.name, 'name'),
    subject: toRequiredText(payload.subject, 'subject'),
    content: toRequiredText(payload.content, 'content'),
    variables: parseNotificationVariables(payload.variables),
    type: toNotificationType(payload.type),
    isActive: toBoolean(payload.isActive, true),
  };
}

export function getTenantIdFromContext(ctx: any) {
  return resolveCurrentTenantId(ctx);
}

export async function getAdmissionCampaignFormOptions(tenantId: number | string) {
  const templates = await strapi.db.query(FORM_TEMPLATE_UID).findMany({
    where: mergeTenantWhere({ formTemplateStatus: { $ne: 'archived' } }, tenantId),
    select: ['id', 'name', 'version', 'formTemplateStatus', 'isLocked'],
    orderBy: [{ name: 'asc' }, { version: 'desc' }],
  });

  return {
    statuses: ['draft', 'open', 'closed'],
    formTemplates: (templates || []).map((item: any) => ({
      id: item.id,
      name: item.name || '',
      version: Number(item.version || 0),
      formTemplateStatus: readFormTemplateStatus(item),
      status: readFormTemplateStatus(item),
      isLocked: item.isLocked === true,
      label: `${item.name || 'Template'} v${Number(item.version || 0)}`,
    })),
  };
}

export async function listAdmissionCampaigns(query: any, tenantId: number | string) {
  const q = toText(query?.q).toLowerCase();
  const status = toText(query?.campaignStatus || query?.status).toLowerCase();
  const year = parseOptionalPositiveInt(query?.year);

  const whereClauses: Array<Record<string, unknown>> = [];
  if (q) {
    whereClauses.push({
      $or: [
        { name: { $containsi: q } },
        { code: { $containsi: q } },
        { grade: { $containsi: q } },
      ],
    });
  }
  if (status) whereClauses.push({ campaignStatus: status });
  if (year) whereClauses.push({ year: { $eq: year } });

  const where = whereClauses.length > 0 ? { $and: whereClauses } : {};
  const rows = await strapi.db.query(CAMPAIGN_UID).findMany({
    where: mergeTenantWhere(where, tenantId),
    populate: {
      formTemplate: {
        select: ['id', 'name', 'version', 'formTemplateStatus', 'isLocked'],
      },
      tenant: {
        select: ['id'],
      },
    },
    orderBy: [{ year: 'desc' }, { createdAt: 'desc' }, { id: 'desc' }],
  });

  const campaignIds = (rows || []).map((item: any) => Number(item?.id || 0)).filter((id: number) => id > 0);
  const applicationCountMap = await getApplicationCountMap(campaignIds, tenantId);

  return {
    data: (rows || []).map((item: any) => normalizeCampaign(item, applicationCountMap.get(Number(item.id || 0)) || 0)),
  };
}

export async function getAdmissionCampaignDetail(id: unknown, tenantId: number | string) {
  const campaign = await findCampaignOrThrow(id, tenantId);
  const applicationCountMap = await getApplicationCountMap([Number(campaign.id)], tenantId);
  return normalizeCampaign(campaign, applicationCountMap.get(Number(campaign.id || 0)) || 0);
}

export async function createAdmissionCampaign(body: any, tenantId: number | string) {
  const payload = extractPayload(body);
  const code = toRequiredText(payload.code, 'code');
  await ensureCampaignCodeAvailable(code);

  const formTemplateId = toRequiredInteger(payload.formTemplate, 'formTemplate');
  await ensureTemplateBelongsToTenant(formTemplateId, tenantId);

  const created = await strapi.db.query(CAMPAIGN_UID).create({
    data: buildCampaignData({ ...payload, code }, tenantId, formTemplateId),
  });

  return getAdmissionCampaignDetail(created.id, tenantId);
}

export async function updateAdmissionCampaign(id: unknown, body: any, tenantId: number | string) {
  const campaign = await findCampaignOrThrow(id, tenantId);
  const payload = extractPayload(body);
  const code = toRequiredText(payload.code ?? campaign.code, 'code');
  await ensureCampaignCodeAvailable(code, Number(campaign.id));

  const formTemplateId = toRequiredInteger(payload.formTemplate ?? campaign.formTemplate?.id ?? campaign.formTemplate, 'formTemplate');
  await ensureTemplateBelongsToTenant(formTemplateId, tenantId);

  await strapi.db.query(CAMPAIGN_UID).update({
    where: { id: campaign.id },
    data: buildCampaignData({ ...campaign, ...payload, code }, tenantId, formTemplateId),
  });

  return getAdmissionCampaignDetail(campaign.id, tenantId);
}

export async function listFormTemplates(query: any, tenantId: number | string) {
  const q = toText(query?.q).toLowerCase();
  const status = toText(query?.formTemplateStatus || query?.status).toLowerCase();

  const whereClauses: Array<Record<string, unknown>> = [];
  if (q) {
    whereClauses.push({ name: { $containsi: q } });
  }
  if (status) whereClauses.push({ formTemplateStatus: status });

  const where = whereClauses.length > 0 ? { $and: whereClauses } : {};
  const rows = await strapi.db.query(FORM_TEMPLATE_UID).findMany({
    where: mergeTenantWhere(where, tenantId),
    populate: {
      tenant: { select: ['id'] },
    },
    orderBy: [{ name: 'asc' }, { version: 'desc' }, { createdAt: 'desc' }],
  });

  const formTemplateIds = (rows || []).map((item: any) => Number(item?.id || 0)).filter((id: number) => id > 0);
  const usageCountMap = await getCampaignUsageCountMap(formTemplateIds, tenantId);

  return {
    data: (rows || []).map((item: any) => normalizeFormTemplate(item, usageCountMap.get(Number(item.id || 0)) || 0)),
  };
}

export async function getFormTemplateDetail(id: unknown, tenantId: number | string) {
  const template = await findFormTemplateOrThrow(id, tenantId);
  const usageCountMap = await getCampaignUsageCountMap([Number(template.id)], tenantId);
  return normalizeFormTemplate(template, usageCountMap.get(Number(template.id || 0)) || 0);
}

export async function createFormTemplate(body: any, tenantId: number | string) {
  const payload = extractPayload(body);

  const created = await strapi.db.query(FORM_TEMPLATE_UID).create({
    data: buildFormTemplateData(payload, tenantId),
  });

  return getFormTemplateDetail(created.id, tenantId);
}

export async function updateFormTemplate(id: unknown, body: any, tenantId: number | string) {
  const template = await findFormTemplateOrThrow(id, tenantId);
  const payload = extractPayload(body);

  await strapi.db.query(FORM_TEMPLATE_UID).update({
    where: { id: template.id },
    data: buildFormTemplateData({ ...template, ...payload }, tenantId),
  });

  return getFormTemplateDetail(template.id, tenantId);
}

export async function listNotificationTemplates(query: any, tenantId: number | string) {
  const q = toText(query?.q).toLowerCase();
  const type = toText(query?.type).toLowerCase();
  const activeFilter = toText(query?.isActive).toLowerCase();

  const whereClauses: Array<Record<string, unknown>> = [];
  if (q) {
    whereClauses.push({
      $or: [
        { name: { $containsi: q } },
        { code: { $containsi: q } },
        { subject: { $containsi: q } },
      ],
    });
  }
  if (type) whereClauses.push({ type });
  if (activeFilter === 'true' || activeFilter === 'false') {
    whereClauses.push({ isActive: activeFilter === 'true' });
  }

  const where = whereClauses.length > 0 ? { $and: whereClauses } : {};
  const rows = await strapi.db.query(NOTIFICATION_TEMPLATE_UID).findMany({
    where: mergeTenantWhere(where, tenantId),
    populate: {
      tenant: { select: ['id', 'name', 'code'] },
    },
    orderBy: [{ code: 'asc' }, { createdAt: 'desc' }, { id: 'desc' }],
  });

  return {
    data: (rows || []).map((item: any) => normalizeNotificationTemplate(item)),
  };
}

export async function getNotificationTemplateDetail(id: unknown, tenantId: number | string) {
  const template = await findNotificationTemplateOrThrow(id, tenantId);
  return normalizeNotificationTemplate(template);
}

export async function createNotificationTemplate(body: any, tenantId: number | string) {
  const payload = extractPayload(body);

  const created = await strapi.db.query(NOTIFICATION_TEMPLATE_UID).create({
    data: buildNotificationTemplateData(payload, tenantId),
  });

  return getNotificationTemplateDetail(created.id, tenantId);
}

export async function updateNotificationTemplate(id: unknown, body: any, tenantId: number | string) {
  const template = await findNotificationTemplateOrThrow(id, tenantId);
  const payload = extractPayload(body);

  await strapi.db.query(NOTIFICATION_TEMPLATE_UID).update({
    where: { id: template.id },
    data: buildNotificationTemplateData({ ...template, ...payload }, tenantId),
  });

  return getNotificationTemplateDetail(template.id, tenantId);
}