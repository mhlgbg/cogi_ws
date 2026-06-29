import { buildRestoreData, buildSoftDeleteData, mergeTenantSoftDeleteWhere } from '../../../utils/soft-delete';
import { mergeTenantWhere, parseOptionalPositiveInt, resolveCurrentTenantId, toText } from '../../../utils/tenant-scope';

const PUBLIC_PAGE_UID = 'api::public-page.public-page';
const LEAD_CAMPAIGN_UID = 'api::lead-campaign.lead-campaign';
const FORM_TEMPLATE_UID = 'api::form-template.form-template';

class PublicPageManagementError extends Error {
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
  if (!text) throw new PublicPageManagementError(400, `${label} is required`);
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
    throw new PublicPageManagementError(400, `${label} is invalid`);
  }
  return date.toISOString();
}

function toPublicPageStatus(value: unknown): 'draft' | 'published' | 'archived' {
  const status = toText(value).toLowerCase();
  if (status === 'published' || status === 'archived') return status;
  return 'draft';
}

function toPageType(value: unknown): 'page' | 'landing' | 'lead' | 'thank_you' | 'default_page' {
  const normalized = toText(value).toLowerCase();
  if (normalized === 'landing' || normalized === 'lead' || normalized === 'thank_you' || normalized === 'default_page') return normalized as any;
  return 'page';
}

function toLeadFormPosition(value: unknown): 'top' | 'bottom' | 'shortcode' {
  const normalized = toText(value).toLowerCase();
  if (normalized === 'top' || normalized === 'shortcode') return normalized as any;
  return 'bottom';
}

function buildActiveWhere() {
  return {
    $or: [
      { isDeleted: false },
      { isDeleted: { $null: true } },
    ],
  };
}

function readPublicPageStatus(row: any): string {
  return row?.publicPageStatus || row?.status || 'draft';
}

function normalizeMedia(media: any) {
  if (!media) return null;
  const url = media?.url || media?.attributes?.url || media?.data?.attributes?.url || '';
  return {
    id: media?.id || media?.data?.id || null,
    name: media?.name || media?.attributes?.name || media?.data?.attributes?.name || '',
    url: url || '',
    mime: media?.mime || media?.attributes?.mime || media?.data?.attributes?.mime || '',
  };
}

function normalizePublicPage(row: any) {
  return {
    id: row.id,
    title: row.title || '',
    slug: row.slug || '',
    summary: row.summary || '',
    contentHtml: row.contentHtml || '',
    publicPageStatus: readPublicPageStatus(row),
    status: readPublicPageStatus(row),
    pageType: row.pageType || 'page',
    leadFormPosition: row.leadFormPosition || 'bottom',
    seoTitle: row.seoTitle || '',
    seoDescription: row.seoDescription || '',
    seoKeywords: row.seoKeywords || '',
    seoImage: normalizeMedia(row.seoImage),
    publishedAt: row.publishedAt || null,
    isDeleted: row.isDeleted === true,
    deletedAt: row.deletedAt || null,
    leadCampaign: row.leadCampaign
      ? {
          id: row.leadCampaign.id,
          name: row.leadCampaign.name || '',
          code: row.leadCampaign.code || '',
          leadCampaignStatus: row.leadCampaign.leadCampaignStatus || 'draft',
          formTemplate: row.leadCampaign.formTemplate
            ? {
                id: row.leadCampaign.formTemplate.id,
                name: row.leadCampaign.formTemplate.name || '',
                version: Number(row.leadCampaign.formTemplate.version || 0),
              }
            : null,
        }
      : null,
  };
}

async function ensureLeadCampaignBelongsToTenant(leadCampaignId: number | null, tenantId: number | string) {
  if (!leadCampaignId) return null;

  const leadCampaign = await strapi.db.query(LEAD_CAMPAIGN_UID).findOne({
    where: mergeTenantWhere({ id: { $eq: leadCampaignId }, ...buildActiveWhere() }, tenantId),
    populate: {
      formTemplate: {
        select: ['id', 'name', 'version'],
      },
    },
  });

  if (!leadCampaign?.id) {
    throw new PublicPageManagementError(400, 'leadCampaign is invalid');
  }

  return leadCampaign;
}

async function findPublicPageOrThrow(id: unknown, tenantId: number | string, options: { includeDeleted?: boolean } = {}) {
  const numericId = parseOptionalPositiveInt(id);
  if (!numericId) throw new PublicPageManagementError(404, 'Public page not found');

  const publicPage = await strapi.db.query(PUBLIC_PAGE_UID).findOne({
    where: mergeTenantSoftDeleteWhere({ id: { $eq: numericId } }, tenantId, options),
    populate: {
      tenant: { select: ['id'] },
      seoImage: true,
      leadCampaign: {
        populate: {
          formTemplate: {
            select: ['id', 'name', 'version'],
          },
        },
      },
    },
  });

  if (!publicPage?.id) throw new PublicPageManagementError(404, 'Public page not found');
  return publicPage;
}

function buildMutationPayload(payload: Record<string, unknown>, leadCampaign: any) {
  const nextStatus = toPublicPageStatus(payload.publicPageStatus ?? payload.status);
  return {
    title: toRequiredText(payload.title, 'title'),
    slug: toRequiredText(payload.slug, 'slug'),
    summary: toNullableText(payload.summary),
    contentHtml: toNullableText(payload.contentHtml),
    publicPageStatus: nextStatus,
    pageType: toPageType(payload.pageType),
    leadCampaign: leadCampaign?.id || null,
    leadFormPosition: toLeadFormPosition(payload.leadFormPosition),
    seoTitle: toNullableText(payload.seoTitle),
    seoDescription: toNullableText(payload.seoDescription),
    seoKeywords: toNullableText(payload.seoKeywords),
    seoImage: payload.seoImage ?? null,
    publishedAt: nextStatus === 'published'
      ? (toNullableDateTime(payload.publishedAt, 'publishedAt') || new Date().toISOString())
      : toNullableDateTime(payload.publishedAt, 'publishedAt'),
  };
}

export function getTenantIdFromContext(ctx: any) {
  return resolveCurrentTenantId(ctx);
}

export async function getPublicPageFormOptions(tenantId: number | string) {
  const leadCampaigns = await strapi.db.query(LEAD_CAMPAIGN_UID).findMany({
    where: mergeTenantWhere({
      $and: [
        buildActiveWhere(),
        { leadCampaignStatus: { $ne: 'archived' } },
      ],
    }, tenantId),
    select: ['id', 'name', 'code', 'leadCampaignStatus'],
    populate: {
      formTemplate: {
        select: ['id', 'name', 'version'],
      },
    },
    orderBy: [{ name: 'asc' }, { id: 'desc' }],
  });

  return {
    statuses: ['draft', 'published', 'archived'],
    pageTypes: ['page', 'landing', 'lead', 'thank_you', 'default_page'],
    leadFormPositions: ['top', 'bottom', 'shortcode'],
    leadCampaigns: (leadCampaigns || []).map((item: any) => ({
      id: item.id,
      name: item.name || '',
      code: item.code || '',
      leadCampaignStatus: item.leadCampaignStatus || 'draft',
      label: `${item.name || 'Lead Campaign'} (${item.code || '-'})`,
      formTemplate: item.formTemplate
        ? {
            id: item.formTemplate.id,
            name: item.formTemplate.name || '',
            version: Number(item.formTemplate.version || 0),
          }
        : null,
    })),
  };
}

export async function listPublicPages(query: any, tenantId: number | string) {
  const q = toText(query?.q).toLowerCase();
  const status = toText(query?.publicPageStatus || query?.status).toLowerCase();
  const pageType = toText(query?.pageType).toLowerCase();
  const whereClauses: Array<Record<string, unknown>> = [];

  if (q) {
    whereClauses.push({
      $or: [
        { title: { $containsi: q } },
        { slug: { $containsi: q } },
        { summary: { $containsi: q } },
      ],
    });
  }
  if (status && status !== 'all') whereClauses.push({ publicPageStatus: status });
  if (pageType) whereClauses.push({ pageType });

  const where = whereClauses.length > 0 ? { $and: whereClauses } : {};
  const rows = await strapi.db.query(PUBLIC_PAGE_UID).findMany({
    where: mergeTenantSoftDeleteWhere(where, tenantId, query),
    populate: {
      seoImage: true,
      leadCampaign: {
        populate: {
          formTemplate: {
            select: ['id', 'name', 'version'],
          },
        },
      },
    },
    orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
  });

  return {
    data: (rows || []).map((item: any) => normalizePublicPage(item)),
  };
}

export async function getPublicPageDetail(id: unknown, tenantId: number | string) {
  const page = await findPublicPageOrThrow(id, tenantId, { includeDeleted: true });
  return normalizePublicPage(page);
}

export async function createPublicPage(body: any, tenantId: number | string) {
  const payload = extractPayload(body);
  const leadCampaignId = parseOptionalPositiveInt(payload.leadCampaign);
  const leadCampaign = await ensureLeadCampaignBelongsToTenant(leadCampaignId, tenantId);
  const created = await strapi.db.query(PUBLIC_PAGE_UID).create({
    data: {
      ...buildMutationPayload(payload, leadCampaign),
      tenant: tenantId,
      isDeleted: false,
    },
    populate: {
      seoImage: true,
      leadCampaign: {
        populate: {
          formTemplate: {
            select: ['id', 'name', 'version'],
          },
        },
      },
    },
  });

  return normalizePublicPage(created);
}

export async function updatePublicPage(id: unknown, body: any, tenantId: number | string) {
  const existing = await findPublicPageOrThrow(id, tenantId, { includeDeleted: true });
  const payload = extractPayload(body);
  const leadCampaignId = parseOptionalPositiveInt(payload.leadCampaign);
  const leadCampaign = await ensureLeadCampaignBelongsToTenant(leadCampaignId, tenantId);

  const updated = await strapi.db.query(PUBLIC_PAGE_UID).update({
    where: { id: existing.id },
    data: {
      ...buildMutationPayload(payload, leadCampaign),
      tenant: tenantId,
    },
    populate: {
      seoImage: true,
      leadCampaign: {
        populate: {
          formTemplate: {
            select: ['id', 'name', 'version'],
          },
        },
      },
    },
  });

  return normalizePublicPage(updated);
}

export async function softDeletePublicPage(id: unknown, tenantId: number | string, userId?: number | null, reason?: string | null) {
  const existing = await findPublicPageOrThrow(id, tenantId, { includeDeleted: true });

  const deleted = await strapi.db.query(PUBLIC_PAGE_UID).update({
    where: { id: existing.id },
    data: {
      ...buildSoftDeleteData(userId),
      deleteReason: reason || null,
      restoredAt: null,
      restoredBy: null,
      restoreReason: null,
    },
    populate: {
      seoImage: true,
      leadCampaign: {
        populate: {
          formTemplate: {
            select: ['id', 'name', 'version'],
          },
        },
      },
    },
  });

  return normalizePublicPage(deleted);
}

export async function restorePublicPage(id: unknown, tenantId: number | string, userId?: number | null, reason?: string | null) {
  const existing = await findPublicPageOrThrow(id, tenantId, { includeDeleted: true });
  if (!existing?.isDeleted) return normalizePublicPage(existing);

  const restored = await strapi.db.query(PUBLIC_PAGE_UID).update({
    where: { id: existing.id },
    data: {
      ...buildRestoreData(),
      restoredAt: new Date().toISOString(),
      restoredBy: userId || null,
      restoreReason: reason || null,
    },
    populate: {
      seoImage: true,
      leadCampaign: {
        populate: {
          formTemplate: {
            select: ['id', 'name', 'version'],
          },
        },
      },
    },
  });

  return normalizePublicPage(restored);
}
