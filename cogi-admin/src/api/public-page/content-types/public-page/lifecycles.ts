import { errors } from '@strapi/utils';
import { extractRelationRef, toText, whereByParam } from '../../../../utils/tenant-scope';

const PUBLIC_PAGE_UID = 'api::public-page.public-page';
const LEAD_CAMPAIGN_UID = 'api::lead-campaign.lead-campaign';

type GenericRecord = Record<string, unknown>;

function slugifyVietnamese(value: unknown) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[đĐ]/g, (char) => (char === 'Đ' ? 'D' : 'd'))
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-')
    .slice(0, 160)
    .replace(/-+$/g, '');
}

function getRequestContextTenantId(): number | string | null {
  const requestContext = strapi.requestContext?.get?.();
  const tenantId = requestContext?.state?.tenantId ?? requestContext?.state?.tenant?.id;
  if (tenantId === null || tenantId === undefined || tenantId === '') return null;
  return tenantId;
}

function getRequestContextPublicPageRef(): string | number | null {
  const requestContext = strapi.requestContext?.get?.();
  const rawId = requestContext?.params?.id;
  if (rawId === null || rawId === undefined || rawId === '') return null;
  return rawId;
}

function extractEntryRelationRef(value: unknown): string | number | null {
  if (value === null || value === undefined) return null;
  if (typeof value === 'string' || typeof value === 'number') return value;
  if (typeof value !== 'object') return null;

  const relation = value as { id?: number | string; documentId?: string };
  if (relation.id !== undefined) return relation.id;
  if (relation.documentId) return relation.documentId;
  return null;
}

async function loadExistingPublicPage(where: unknown) {
  const normalizedWhere = typeof where === 'object' && where !== null
    ? Object.fromEntries(
      Object.entries(where as Record<string, unknown>).filter(
        ([key, value]) => !(key === 'locale' && (value === '' || value === null)),
      ),
    )
    : where;

  if (!normalizedWhere) return null;

  return strapi.db.query(PUBLIC_PAGE_UID).findOne({
    where: normalizedWhere,
    select: ['id', 'documentId', 'title', 'slug'],
    populate: {
      tenant: { select: ['id', 'documentId'] },
      leadCampaign: {
        select: ['id', 'documentId'],
        populate: {
          tenant: { select: ['id', 'documentId'] },
        },
      },
    },
  });
}

async function resolveCurrentPublicPage(where: unknown) {
  const existingByWhere = await loadExistingPublicPage(where);
  if (existingByWhere) return existingByWhere;

  const requestRef = getRequestContextPublicPageRef();
  if (!requestRef) return null;

  return loadExistingPublicPage(whereByParam(requestRef));
}

async function ensureLeadCampaignTenantMatches(leadCampaignRef: string | number, tenantRef: string | number) {
  const leadCampaign = await strapi.db.query(LEAD_CAMPAIGN_UID).findOne({
    where: whereByParam(leadCampaignRef),
    populate: {
      tenant: { select: ['id', 'documentId'] },
    },
  });

  if (!leadCampaign?.id) {
    throw new errors.ApplicationError('Selected leadCampaign is invalid');
  }

  const leadCampaignTenantRef = extractEntryRelationRef(leadCampaign?.tenant);
  if (!leadCampaignTenantRef || String(leadCampaignTenantRef) !== String(tenantRef)) {
    throw new errors.ApplicationError('PublicPage tenant must match leadCampaign tenant');
  }
}

async function ensureTenantScopedSlugUnique(params: {
  slug: string;
  tenantRef: string | number;
  ignoreId?: number | string | null;
  ignoreDocumentId?: string | null;
}) {
  const matches = await strapi.db.query(PUBLIC_PAGE_UID).findMany({
    where: {
      slug: params.slug,
      tenant: params.tenantRef,
    },
    select: ['id', 'documentId'],
  });

  const duplicate = (matches || []).find((item: any) => {
    if (String(item?.id) === String(params.ignoreId || '')) return false;
    if (params.ignoreDocumentId && String(item?.documentId || '') === String(params.ignoreDocumentId)) return false;
    return true;
  });
  if (duplicate) {
    throw new errors.ApplicationError('PublicPage slug must be unique within the tenant');
  }
}

async function ensurePublicPageValid(params: { data?: GenericRecord; where?: unknown }) {
  const data = (params.data || {}) as GenericRecord;
  const existing = await resolveCurrentPublicPage(params.where);
  const requestTenantId = getRequestContextTenantId();
  const requestPageRef = getRequestContextPublicPageRef();

  if ((data.tenant === null || data.tenant === undefined || data.tenant === '') && requestTenantId) {
    data.tenant = requestTenantId;
  }

  const tenantRef = extractRelationRef(data.tenant)
    || extractEntryRelationRef(existing?.tenant)
    || requestTenantId;

  if (!tenantRef) {
    throw new errors.ApplicationError('tenant is required');
  }

  data.tenant = tenantRef;

  const title = toText(data.title ?? existing?.title);
  const slug = slugifyVietnamese(toText(data.slug) || title || existing?.slug);
  if (!title) {
    throw new errors.ApplicationError('title is required');
  }
  if (!slug) {
    throw new errors.ApplicationError('slug is required');
  }

  data.title = title;
  data.slug = slug;

  const leadCampaignRef = extractRelationRef(data.leadCampaign) || extractEntryRelationRef(existing?.leadCampaign);
  if (leadCampaignRef) {
    await ensureLeadCampaignTenantMatches(leadCampaignRef, tenantRef);
  }

  await ensureTenantScopedSlugUnique({
    slug,
    tenantRef,
    ignoreId: existing?.id ?? null,
    ignoreDocumentId: toText(existing?.documentId) || toText(requestPageRef) || null,
  });
}

export default {
  async beforeCreate(event: any) {
    await ensurePublicPageValid({
      data: event.params?.data,
    });
  },

  async beforeUpdate(event: any) {
    await ensurePublicPageValid({
      data: event.params?.data,
      where: event.params?.where,
    });
  },
};
