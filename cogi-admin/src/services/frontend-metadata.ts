import { buildActiveSoftDeleteWhere } from '../utils/soft-delete';
import { mergeTenantWhere } from '../utils/tenant-scope';

const PUBLIC_PAGE_UID = 'api::public-page.public-page';
const ASSESSMENT_CAMPAIGN_UID = 'api::assessment-campaign.assessment-campaign';
const TENANT_UID = 'api::tenant.tenant';
const DEFAULT_PLATFORM_TITLE = 'COGI Platform';

type FrontendTenantMetadata = {
  id: number | null;
  code: string;
  name: string;
  shortName: string;
  siteTitle: string;
  defaultPageTitle: string;
  titleSuffix: string;
  siteDescription: string;
  defaultMetaImage: string;
  logo: string;
};

type FrontendPublicPageMetadata = {
  id: number | null;
  slug: string;
  title: string;
  seoTitle: string;
  seoDescription: string;
  seoImage: string;
};

type FrontendAssessmentCampaignMetadata = {
  id: number | null;
  slug: string;
  title: string;
  seoTitle: string;
  seoDescription: string;
  seoImage: string;
};

export type ResolvedFrontendMetadata = {
  title: string;
  description: string;
  image: string;
  url: string;
  routeKind: 'public-page' | 'assessment-campaign' | 'tenant-fallback' | 'platform-fallback';
  tenantCode: string;
  pageSlug: string;
};

const SEO_MANAGED_TAG_PATTERNS = [
  /<title\b[^>]*>[\s\S]*?<\/title>\s*/i,
  /<meta\b[^>]*name=(['"])description\1[^>]*>\s*/gi,
  /<meta\b[^>]*property=(['"])og:type\1[^>]*>\s*/gi,
  /<meta\b[^>]*property=(['"])og:title\1[^>]*>\s*/gi,
  /<meta\b[^>]*property=(['"])og:description\1[^>]*>\s*/gi,
  /<meta\b[^>]*property=(['"])og:image\1[^>]*>\s*/gi,
  /<meta\b[^>]*property=(['"])og:url\1[^>]*>\s*/gi,
  /<meta\b[^>]*name=(['"])twitter:card\1[^>]*>\s*/gi,
  /<meta\b[^>]*name=(['"])twitter:title\1[^>]*>\s*/gi,
  /<meta\b[^>]*name=(['"])twitter:description\1[^>]*>\s*/gi,
  /<meta\b[^>]*name=(['"])twitter:image\1[^>]*>\s*/gi,
];

function normalizeText(value: unknown): string {
  if (value === null || value === undefined) return '';
  return String(value).trim();
}

function normalizeMetadataText(value: unknown): string {
  return normalizeText(value).replace(/\s+/g, ' ');
}

export function escapeHtml(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function extractMediaUrl(media: any): string {
  return normalizeText(
    media?.url
    || media?.attributes?.url
    || media?.data?.attributes?.url
    || media?.formats?.small?.url
    || media?.formats?.thumbnail?.url,
  );
}

function decodePathSegment(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function normalizeHost(value: unknown): string {
  return normalizeText(value).replace(/^https?:\/\//i, '').split('/')[0].split(',')[0].trim();
}

function readRequestHost(ctx: any): string {
  const forwardedHost = ctx?.request?.headers?.['x-forwarded-host'];
  const rawHost = Array.isArray(forwardedHost)
    ? forwardedHost[0]
    : forwardedHost || ctx?.request?.host || ctx?.host || '';
  return normalizeHost(rawHost);
}

function readRequestProtocol(ctx: any, host: string): string {
  const forwardedProto = ctx?.request?.headers?.['x-forwarded-proto'];
  const rawProto = Array.isArray(forwardedProto) ? forwardedProto[0] : forwardedProto;
  const forwardedProtocol = normalizeText(rawProto).toLowerCase();
  if (forwardedProtocol === 'http' || forwardedProtocol === 'https') return forwardedProtocol;

  const lowerHost = host.toLowerCase();
  if (lowerHost.startsWith('localhost') || lowerHost.startsWith('127.0.0.1')) {
    const requestProtocol = normalizeText(ctx?.request?.protocol || ctx?.protocol || '').toLowerCase();
    return requestProtocol === 'https' ? 'https' : 'http';
  }

  return 'https';
}

function buildRequestOrigin(ctx: any): string {
  const host = readRequestHost(ctx);
  const protocol = readRequestProtocol(ctx, host);
  return host ? `${protocol}://${host}` : normalizeText(process.env.FRONTEND_URL || 'http://localhost:5173').replace(/\/+$/, '');
}

function buildCanonicalUrl(ctx: any): string {
  const origin = buildRequestOrigin(ctx);
  const requestUrl = normalizeText(ctx?.request?.url || ctx?.url || ctx?.path || '/') || '/';

  try {
    return new URL(requestUrl, `${origin}/`).toString();
  } catch {
    const path = requestUrl.startsWith('/') ? requestUrl : `/${requestUrl}`;
    return `${origin}${path}`;
  }
}

function toAbsoluteUrl(value: unknown, origin: string): string {
  const source = normalizeText(value);
  if (!source) return '';
  if (/^https?:\/\//i.test(source)) return source;
  if (source.startsWith('//')) {
    const protocol = normalizeText(origin).toLowerCase().startsWith('http://') ? 'http:' : 'https:';
    return `${protocol}${source}`;
  }

  try {
    return new URL(source.startsWith('/') ? source : `/${source}`, `${origin}/`).toString();
  } catch {
    return source;
  }
}

function extractPublicPageSlug(pathname: string): string {
  const match = pathname.match(/^\/(?:t\/[^/]+\/)?page\/([^/?#]+)/i);
  if (!match?.[1]) return '';
  return normalizeText(decodePathSegment(match[1]));
}

function extractAssessmentCampaignSlug(pathname: string): string {
  const match = pathname.match(/^\/(?:t\/[^/]+\/)?campaign\/([^/?#]+)/i);
  if (!match?.[1]) return '';
  return normalizeText(decodePathSegment(match[1]));
}

function shouldAppendTitleSuffix(baseTitle: string, titleSuffix: string): boolean {
  const normalizedTitle = normalizeMetadataText(baseTitle).toLowerCase();
  const normalizedSuffix = normalizeMetadataText(titleSuffix).toLowerCase();
  if (!normalizedTitle || !normalizedSuffix) return false;
  if (normalizedTitle === normalizedSuffix) return false;
  if (normalizedTitle.endsWith(`| ${normalizedSuffix}`)) return false;
  if (normalizedTitle.endsWith(`- ${normalizedSuffix}`)) return false;
  if (normalizedTitle.endsWith(`: ${normalizedSuffix}`)) return false;
  if (normalizedTitle.endsWith(normalizedSuffix)) return false;
  return true;
}

function applyTitleSuffix(baseTitle: string, titleSuffix: string): string {
  if (!shouldAppendTitleSuffix(baseTitle, titleSuffix)) return normalizeMetadataText(baseTitle);
  return `${normalizeMetadataText(baseTitle)} | ${normalizeMetadataText(titleSuffix)}`;
}

function normalizeTenantMetadata(row: any): FrontendTenantMetadata {
  return {
    id: Number.isInteger(Number(row?.id)) ? Number(row.id) : null,
    code: normalizeText(row?.code),
    name: normalizeMetadataText(row?.name),
    shortName: normalizeMetadataText(row?.shortName),
    siteTitle: normalizeMetadataText(row?.siteTitle),
    defaultPageTitle: normalizeMetadataText(row?.defaultPageTitle),
    titleSuffix: normalizeMetadataText(row?.titleSuffix),
    siteDescription: normalizeMetadataText(row?.siteDescription || row?.description),
    defaultMetaImage: normalizeText(extractMediaUrl(row?.defaultMetaImage)),
    logo: normalizeText(extractMediaUrl(row?.logo || row?.siteLogo)),
  };
}

function normalizePublicPageMetadata(row: any): FrontendPublicPageMetadata | null {
  if (!row || typeof row !== 'object') return null;

  return {
    id: Number.isInteger(Number(row?.id)) ? Number(row.id) : null,
    slug: normalizeText(row?.slug),
    title: normalizeMetadataText(row?.title),
    seoTitle: normalizeMetadataText(row?.seoTitle),
    seoDescription: normalizeMetadataText(row?.seoDescription),
    seoImage: normalizeText(extractMediaUrl(row?.seoImage)),
  };
}

function normalizeAssessmentCampaignMetadata(row: any): FrontendAssessmentCampaignMetadata | null {
  if (!row || typeof row !== 'object') return null;

  return {
    id: Number.isInteger(Number(row?.id)) ? Number(row.id) : null,
    slug: normalizeText(row?.slug),
    title: normalizeMetadataText(row?.seoTitle || row?.publicTitle || row?.name || row?.title),
    seoTitle: normalizeMetadataText(row?.seoTitle),
    seoDescription: normalizeMetadataText(row?.seoDescription || row?.publicDescription || row?.description),
    seoImage: normalizeText(extractMediaUrl(row?.seoImage)),
  };
}

async function loadTenantMetadata(strapi: any, tenantId: number | string | null | undefined) {
  const numericTenantId = Number(tenantId);
  if (!Number.isInteger(numericTenantId) || numericTenantId <= 0) return null;

  const tenant = await strapi.db.query(TENANT_UID).findOne({
    where: { id: numericTenantId },
    select: ['id', 'code', 'name', 'shortName', 'siteTitle', 'defaultPageTitle', 'titleSuffix', 'siteDescription', 'description'],
    populate: {
      defaultMetaImage: {
        select: ['url'],
      },
      logo: {
        select: ['url'],
      },
      siteLogo: {
        select: ['url'],
      },
    },
  });

  return tenant ? normalizeTenantMetadata(tenant) : null;
}

async function loadPublicPageMetadata(strapi: any, tenantId: number | string | null | undefined, slug: string) {
  const normalizedSlug = normalizeText(slug);
  if (!normalizedSlug) return null;
  if (!tenantId) return null;

  const row = await strapi.db.query(PUBLIC_PAGE_UID).findOne({
    where: mergeTenantWhere({
      $and: [
        { slug: normalizedSlug },
        buildActiveSoftDeleteWhere(),
        { publicPageStatus: 'published' },
      ],
    }, tenantId),
    select: ['id', 'slug', 'title', 'seoTitle', 'seoDescription'],
    populate: {
      seoImage: {
        select: ['url'],
      },
    },
  });

  return normalizePublicPageMetadata(row);
}

async function loadAssessmentCampaignMetadata(strapi: any, tenantId: number | string | null | undefined, slug: string) {
  const normalizedSlug = normalizeText(slug);
  if (!normalizedSlug) return null;
  if (!tenantId) return null;

  const row = await strapi.db.query(ASSESSMENT_CAMPAIGN_UID).findOne({
    where: mergeTenantWhere({ slug: { $eq: normalizedSlug } }, tenantId),
    select: ['id', 'slug', 'name', 'publicTitle', 'publicDescription', 'description', 'status'],
  });

  return normalizeAssessmentCampaignMetadata(row);
}

export function buildResolvedFrontendMetadata(input: {
  url: string;
  tenant?: Partial<FrontendTenantMetadata> | null;
  page?: Partial<FrontendPublicPageMetadata> | null;
  campaign?: Partial<FrontendAssessmentCampaignMetadata> | null;
}): ResolvedFrontendMetadata {
  const tenant = input.tenant || null;
  const page = input.page || null;
  const campaign = input.campaign || null;

  const tenantDefaultTitle = normalizeMetadataText(tenant?.defaultPageTitle);
  const tenantSiteTitle = normalizeMetadataText(tenant?.siteTitle);
  const pageSeoTitle = normalizeMetadataText(page?.seoTitle);
  const pageTitle = normalizeMetadataText(page?.title);
  const pageDerivedTitle = pageSeoTitle || pageTitle;
  const campaignSeoTitle = normalizeMetadataText(campaign?.seoTitle);
  const campaignTitle = normalizeMetadataText(campaign?.title);
  const campaignDerivedTitle = campaignSeoTitle || campaignTitle;
  const tenantTitleSuffix = normalizeMetadataText(tenant?.titleSuffix);
  const contentTitle = pageDerivedTitle || campaignDerivedTitle;

  const title = contentTitle
    ? applyTitleSuffix(contentTitle, tenantTitleSuffix)
    : tenantDefaultTitle || tenantSiteTitle || DEFAULT_PLATFORM_TITLE;

  const description = normalizeMetadataText(page?.seoDescription)
    || normalizeMetadataText(campaign?.seoDescription)
    || normalizeMetadataText(tenant?.siteDescription);

  const image = normalizeText(page?.seoImage)
    || normalizeText(campaign?.seoImage)
    || normalizeText(tenant?.defaultMetaImage)
    || normalizeText(tenant?.logo);

  const routeKind = pageDerivedTitle || normalizeText(page?.seoImage) || normalizeText(page?.seoDescription)
    ? 'public-page'
    : campaignDerivedTitle || normalizeText(campaign?.seoImage) || normalizeText(campaign?.seoDescription)
      ? 'assessment-campaign'
      : tenantDefaultTitle || tenantSiteTitle || description || image
        ? 'tenant-fallback'
        : 'platform-fallback';

  return {
    title,
    description,
    image: normalizeText(image),
    url: normalizeText(input.url),
    routeKind,
    tenantCode: normalizeText(tenant?.code),
    pageSlug: normalizeText(page?.slug || campaign?.slug),
  };
}

export async function resolveFrontendMetadata(strapi: any, ctx: any): Promise<ResolvedFrontendMetadata> {
  const pathname = normalizeText(ctx?.request?.path || ctx?.path || '/') || '/';
  const pageSlug = extractPublicPageSlug(pathname);
  const campaignSlug = extractAssessmentCampaignSlug(pathname);
  const tenant = await loadTenantMetadata(strapi, ctx?.state?.tenantId ?? ctx?.state?.tenant?.id ?? null);
  const page = pageSlug
    ? await loadPublicPageMetadata(strapi, tenant?.id, pageSlug)
    : null;
  const campaign = !page && campaignSlug
    ? await loadAssessmentCampaignMetadata(strapi, tenant?.id, campaignSlug)
    : null;
  const origin = buildRequestOrigin(ctx);
  const metadata = buildResolvedFrontendMetadata({
    url: buildCanonicalUrl(ctx),
    tenant,
    page,
    campaign,
  });

  return {
    ...metadata,
    image: toAbsoluteUrl(metadata.image, origin),
  };
}

export function renderFrontendSeoHead(metadata: Pick<ResolvedFrontendMetadata, 'title' | 'description' | 'image' | 'url'>): string {
  const title = escapeHtml(normalizeMetadataText(metadata.title) || DEFAULT_PLATFORM_TITLE);
  const description = escapeHtml(normalizeMetadataText(metadata.description));
  const image = escapeHtml(normalizeText(metadata.image));
  const url = escapeHtml(normalizeText(metadata.url));

  return [
    `    <title>${title}</title>`,
    `    <meta name="description" content="${description}" />`,
    '    <meta property="og:type" content="website" />',
    `    <meta property="og:title" content="${title}" />`,
    `    <meta property="og:description" content="${description}" />`,
    `    <meta property="og:image" content="${image}" />`,
    `    <meta property="og:url" content="${url}" />`,
    '    <meta name="twitter:card" content="summary_large_image" />',
    `    <meta name="twitter:title" content="${title}" />`,
    `    <meta name="twitter:description" content="${description}" />`,
    `    <meta name="twitter:image" content="${image}" />`,
  ].join('\n');
}

export function injectFrontendSeoHead(html: string, metadata: Pick<ResolvedFrontendMetadata, 'title' | 'description' | 'image' | 'url'>): string {
  let nextHtml = String(html || '');

  for (const pattern of SEO_MANAGED_TAG_PATTERNS) {
    nextHtml = nextHtml.replace(pattern, '');
  }

  const headTags = renderFrontendSeoHead(metadata);
  if (/<\/head>/i.test(nextHtml)) {
    return nextHtml.replace(/<\/head>/i, `${headTags}\n  </head>`);
  }

  return `${headTags}\n${nextHtml}`;
}
