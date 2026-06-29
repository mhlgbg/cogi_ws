import { mergeTenantWhere, parseOptionalPositiveInt, resolveCurrentTenantId, toText } from '../../../utils/tenant-scope';

const LEAD_CAMPAIGN_UID = 'api::lead-campaign.lead-campaign';
const LEAD_CAPTURE_UID = 'api::lead-capture.lead-capture';
const FORM_TEMPLATE_UID = 'api::form-template.form-template';

class LeadManagementError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
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

function toRequiredText(value: unknown, label: string): string {
  const text = toText(value);
  if (!text) {
    throw new LeadManagementError(400, `${label} is required`);
  }
  return text;
}

function toNullableText(value: unknown): string | null {
  const text = toText(value);
  return text || null;
}

function toBoolean(value: unknown, fallback = false): boolean {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value !== 0;
  const text = toText(value).toLowerCase();
  if (!text) return fallback;
  return ['true', '1', 'yes', 'on'].includes(text);
}

function toNullableDateTime(value: unknown, label: string): string | null {
  const text = toText(value);
  if (!text) return null;
  const date = new Date(text);
  if (Number.isNaN(date.getTime())) {
    throw new LeadManagementError(400, `${label} is invalid`);
  }
  return date.toISOString();
}

function toLeadCampaignStatus(value: unknown): 'draft' | 'active' | 'paused' | 'closed' | 'archived' {
  const status = toText(value).toLowerCase();
  if (status === 'active' || status === 'paused' || status === 'closed' || status === 'archived') return status;
  return 'draft';
}

function parseOptionalJson(value: unknown, label: string) {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value === 'object') return value;

  const text = toText(value);
  if (!text) return null;

  try {
    return JSON.parse(text);
  } catch {
    throw new LeadManagementError(400, `${label} must be valid JSON`);
  }
}

function buildActiveLeadCampaignWhere() {
  return {
    $or: [
      { isDeleted: false },
      { isDeleted: { $null: true } },
    ],
  };
}

function readLeadCampaignStatus(value: any): string {
  return value?.leadCampaignStatus || value?.status || 'draft';
}

function normalizeLeadCampaign(row: any, leadCount = 0) {
  return {
    id: row.id,
    name: row.name || '',
    code: row.code || '',
    description: row.description || '',
    leadCampaignStatus: readLeadCampaignStatus(row),
    status: readLeadCampaignStatus(row),
    startDate: row.startDate || null,
    endDate: row.endDate || null,
    successMessage: row.successMessage || '',
    submitButtonText: row.submitButtonText || 'Đăng ký',
    autoReplyEnabled: row.autoReplyEnabled === true,
    autoReplySubject: row.autoReplySubject || '',
    autoReplyHtml: row.autoReplyHtml || '',
    internalNotifyEnabled: row.internalNotifyEnabled === true,
    internalNotifyEmails: Array.isArray(row.internalNotifyEmails) ? row.internalNotifyEmails : row.internalNotifyEmails ?? null,
    formTemplate: row.formTemplate
      ? {
          id: row.formTemplate.id,
          name: row.formTemplate.name || '',
          version: Number(row.formTemplate.version || 0),
          formTemplateStatus: row.formTemplate.formTemplateStatus || 'draft',
          isLocked: row.formTemplate.isLocked === true,
        }
      : null,
    isDeleted: row.isDeleted === true,
    leadCount: Number(leadCount || 0),
  };
}

async function ensureLeadCampaignCodeAvailable(code: string, tenantId: number | string, exceptId?: unknown) {
  const existingRows = await strapi.db.query(LEAD_CAMPAIGN_UID).findMany({
    where: mergeTenantWhere({ code: { $eqi: code } }, tenantId),
    select: ['id'],
    limit: 20,
  });

  const duplicate = (existingRows || []).find((item: any) => String(item?.id || '') !== String(exceptId || ''));
  if (duplicate?.id) {
    throw new LeadManagementError(409, 'Lead campaign code already exists in this tenant');
  }
}

async function ensureTemplateBelongsToTenant(formTemplateId: number | null, tenantId: number | string) {
  if (!formTemplateId) return null;

  const template = await strapi.db.query(FORM_TEMPLATE_UID).findOne({
    where: mergeTenantWhere({ id: { $eq: formTemplateId } }, tenantId),
    select: ['id', 'name', 'version', 'formTemplateStatus', 'isLocked'],
  });

  if (!template?.id) {
    throw new LeadManagementError(400, 'formTemplate is invalid');
  }

  return template;
}

async function findLeadCampaignOrThrow(id: unknown, tenantId: number | string) {
  const numericId = parseOptionalPositiveInt(id);
  if (!numericId) {
    throw new LeadManagementError(404, 'Lead campaign not found');
  }

  const campaign = await strapi.db.query(LEAD_CAMPAIGN_UID).findOne({
    where: mergeTenantWhere({ id: { $eq: numericId }, ...buildActiveLeadCampaignWhere() }, tenantId),
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
    throw new LeadManagementError(404, 'Lead campaign not found');
  }

  return campaign;
}

async function getLeadCountMap(campaignIds: number[], tenantId: number | string) {
  if (!Array.isArray(campaignIds) || campaignIds.length === 0) return new Map<number, number>();

  const rows = await strapi.db.query(LEAD_CAPTURE_UID).findMany({
    where: mergeTenantWhere({ campaign: { id: { $in: campaignIds } } }, tenantId),
    select: ['id'],
    populate: {
      campaign: {
        select: ['id'],
      },
    },
  });

  const countMap = new Map<number, number>();
  for (const row of rows || []) {
    const campaignId = Number(row?.campaign?.id || row?.campaign || 0);
    if (!campaignId) continue;
    countMap.set(campaignId, Number(countMap.get(campaignId) || 0) + 1);
  }

  return countMap;
}

function buildLeadCampaignMutationPayload(payload: Record<string, unknown>, formTemplate: any) {
  return {
    name: toRequiredText(payload.name, 'name'),
    code: toRequiredText(payload.code, 'code'),
    description: toNullableText(payload.description),
    leadCampaignStatus: toLeadCampaignStatus(payload.leadCampaignStatus ?? payload.status),
    startDate: toNullableDateTime(payload.startDate, 'startDate'),
    endDate: toNullableDateTime(payload.endDate, 'endDate'),
    formTemplate: formTemplate?.id || null,
    successMessage: toNullableText(payload.successMessage),
    submitButtonText: toNullableText(payload.submitButtonText) || 'Đăng ký',
    autoReplyEnabled: toBoolean(payload.autoReplyEnabled, false),
    autoReplySubject: toNullableText(payload.autoReplySubject),
    autoReplyHtml: toNullableText(payload.autoReplyHtml),
    internalNotifyEnabled: toBoolean(payload.internalNotifyEnabled, false),
    internalNotifyEmails: parseOptionalJson(payload.internalNotifyEmails, 'internalNotifyEmails'),
    isDeleted: toBoolean(payload.isDeleted, false),
  };
}

export function getTenantIdFromContext(ctx: any) {
  return resolveCurrentTenantId(ctx);
}

export async function getLeadCampaignFormOptions(tenantId: number | string) {
  const templates = await strapi.db.query(FORM_TEMPLATE_UID).findMany({
    where: mergeTenantWhere({ formTemplateStatus: { $ne: 'archived' } }, tenantId),
    select: ['id', 'name', 'version', 'formTemplateStatus', 'isLocked'],
    orderBy: [{ name: 'asc' }, { version: 'desc' }],
  });

  return {
    statuses: ['draft', 'active', 'paused', 'closed', 'archived'],
    formTemplates: (templates || []).map((item: any) => ({
      id: item.id,
      name: item.name || '',
      version: Number(item.version || 0),
      formTemplateStatus: item.formTemplateStatus || 'draft',
      status: item.formTemplateStatus || 'draft',
      isLocked: item.isLocked === true,
      label: `${item.name || 'Template'} v${Number(item.version || 0)}`,
    })),
  };
}

export async function listLeadCampaigns(query: any, tenantId: number | string) {
  const q = toText(query?.q).toLowerCase();
  const status = toText(query?.leadCampaignStatus || query?.status).toLowerCase();

  const whereClauses: Array<Record<string, unknown>> = [buildActiveLeadCampaignWhere()];
  if (q) {
    whereClauses.push({
      $or: [
        { name: { $containsi: q } },
        { code: { $containsi: q } },
      ],
    });
  }
  if (status) whereClauses.push({ leadCampaignStatus: status });

  const where = whereClauses.length > 1 ? { $and: whereClauses } : whereClauses[0];
  const rows = await strapi.db.query(LEAD_CAMPAIGN_UID).findMany({
    where: mergeTenantWhere(where, tenantId),
    populate: {
      formTemplate: {
        select: ['id', 'name', 'version', 'formTemplateStatus', 'isLocked'],
      },
      tenant: {
        select: ['id'],
      },
    },
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
  });

  const campaignIds = (rows || []).map((item: any) => Number(item?.id || 0)).filter((id: number) => id > 0);
  const leadCountMap = await getLeadCountMap(campaignIds, tenantId);

  return {
    data: (rows || []).map((item: any) => normalizeLeadCampaign(item, leadCountMap.get(Number(item.id || 0)) || 0)),
  };
}

export async function getLeadCampaignDetail(id: unknown, tenantId: number | string) {
  const campaign = await findLeadCampaignOrThrow(id, tenantId);
  const leadCountMap = await getLeadCountMap([Number(campaign.id)], tenantId);
  return normalizeLeadCampaign(campaign, leadCountMap.get(Number(campaign.id || 0)) || 0);
}

export async function createLeadCampaign(body: any, tenantId: number | string) {
  const payload = extractPayload(body);
  const code = toRequiredText(payload.code, 'code');
  await ensureLeadCampaignCodeAvailable(code, tenantId);

  const formTemplateId = parseOptionalPositiveInt(payload.formTemplate);
  const formTemplate = await ensureTemplateBelongsToTenant(formTemplateId, tenantId);

  const created = await strapi.db.query(LEAD_CAMPAIGN_UID).create({
    data: {
      ...buildLeadCampaignMutationPayload(payload, formTemplate),
      tenant: tenantId,
    },
    populate: {
      formTemplate: {
        select: ['id', 'name', 'version', 'formTemplateStatus', 'isLocked'],
      },
      tenant: {
        select: ['id'],
      },
    },
  });

  return normalizeLeadCampaign(created, 0);
}

export async function updateLeadCampaign(id: unknown, body: any, tenantId: number | string) {
  const existing = await findLeadCampaignOrThrow(id, tenantId);
  const payload = extractPayload(body);
  const code = toRequiredText(payload.code, 'code');
  await ensureLeadCampaignCodeAvailable(code, tenantId, existing.id);

  const formTemplateId = parseOptionalPositiveInt(payload.formTemplate);
  const formTemplate = await ensureTemplateBelongsToTenant(formTemplateId, tenantId);

  const updated = await strapi.db.query(LEAD_CAMPAIGN_UID).update({
    where: { id: existing.id },
    data: buildLeadCampaignMutationPayload(payload, formTemplate),
    populate: {
      formTemplate: {
        select: ['id', 'name', 'version', 'formTemplateStatus', 'isLocked'],
      },
      tenant: {
        select: ['id'],
      },
    },
  });

  const leadCountMap = await getLeadCountMap([Number(existing.id)], tenantId);
  return normalizeLeadCampaign(updated, leadCountMap.get(Number(existing.id || 0)) || 0);
}
