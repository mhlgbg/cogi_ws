const TENANT_UID = 'api::tenant.tenant';
const TENANT_DOMAIN_UID = 'api::tenant-domain.tenant-domain';
const ACTIVE_STATUS = 'active';
const SYSTEM_HOSTS = new Set(['localhost', '127.0.0.1', 'cogi.alphataiho.com']);

function normalizeText(value: unknown): string {
  if (value === null || value === undefined) return '';
  return String(value).trim();
}

function extractMediaUrl(media: any): string | null {
  if (!media) return null;
  if (typeof media.url === 'string' && media.url.trim()) return media.url.trim();
  if (media?.data?.attributes?.url && typeof media.data.attributes.url === 'string') {
    return media.data.attributes.url.trim();
  }
  if (media?.attributes?.url && typeof media.attributes.url === 'string') {
    return media.attributes.url.trim();
  }
  return null;
}

function readRequestHost(ctx: any): string {
  const forwardedHost = ctx.request?.headers?.['x-forwarded-host'];
  const rawHost = Array.isArray(forwardedHost) ? forwardedHost[0] : forwardedHost || ctx.request?.host || ctx.host || '';
  const originHost = ctx.request?.header?.origin || ctx.request?.header?.referer || '';
  const normalizedRawHost = normalizeText(rawHost).toLowerCase().replace(/^https?:\/\//, '').split('/')[0].split(',')[0].trim().split(':')[0];
  const normalizedOriginHost = normalizeText(originHost).toLowerCase().replace(/^https?:\/\//, '').split('/')[0].split(',')[0].trim().split(':')[0];

  if ((!normalizedRawHost || SYSTEM_HOSTS.has(normalizedRawHost)) && normalizedOriginHost) {
    return normalizedOriginHost;
  }

  return normalizedRawHost || normalizedOriginHost;
}

function readTenantSettings(settings: unknown): Record<string, any> {
  if (!settings || typeof settings !== 'object' || Array.isArray(settings)) return {};
  return settings as Record<string, any>;
}

function buildDefaultPublicRoute(tenant: any, tenantCode: string, settings: Record<string, any>): string {
  const configuredRoute = normalizeText(
    tenant?.defaultPublicRoute || settings.defaultPublicRoute || settings.publicRoute || settings.landingPageRoute,
  );
  if (configuredRoute) return configuredRoute;
  if (tenantCode) return `/t/${encodeURIComponent(tenantCode)}`;
  return '/';
}

function buildDefaultProtectedRoute(tenant: any, settings: Record<string, any>): string {
  const configuredRoute = normalizeText(
    tenant?.defaultProtectedRoute || settings.defaultProtectedRoute || settings.protectedRoute || settings.homeRoute,
  );
  if (configuredRoute) return configuredRoute;
  return '/';
}

export async function buildTenantContextPayload(strapi: any, ctx: any) {
  const tenantId = Number(ctx.state?.tenant?.id || ctx.state?.tenantId || 0);
  if (!Number.isInteger(tenantId) || tenantId <= 0) {
    return null;
  }

  const tenant = await strapi.db.query(TENANT_UID).findOne({
    where: { id: tenantId, tenantStatus: ACTIVE_STATUS },
    select: ['id', 'name', 'shortName', 'code', 'slogan', 'siteTitle', 'defaultPageTitle', 'titleSuffix', 'googleAnalyticsId', 'googleTagManagerId', 'googleSearchConsoleVerification', 'facebookPixelId', 'settings', 'defaultPublicRoute', 'defaultProtectedRoute'],
    populate: {
      logo: {
        select: ['url'],
      },
      favicon: {
        select: ['url'],
      },
      banner: {
        select: ['url'],
      },
      chatAvatar: {
        select: ['url'],
      },
    },
  });

  if (!tenant?.id) {
    return null;
  }

  const primaryDomain = await strapi.db.query(TENANT_DOMAIN_UID).findOne({
    where: {
      tenant: tenantId,
      tenantDomainStatus: ACTIVE_STATUS,
      isPrimary: true,
    },
    select: ['domain'],
  });

  const settings = readTenantSettings((tenant as any).settings);
  const code = normalizeText((tenant as any).code);
  const displayName = normalizeText((tenant as any).shortName) || normalizeText((tenant as any).name) || code || 'Tenant';

  return {
    code: code || 'default',
    name: displayName,
    displayName,
    domain: normalizeText(primaryDomain?.domain) || readRequestHost(ctx) || 'localhost',
    logo: extractMediaUrl((tenant as any).logo),
    favicon: extractMediaUrl((tenant as any).favicon) || extractMediaUrl((tenant as any).logo),
    siteTitle: normalizeText((tenant as any).siteTitle),
    defaultPageTitle: normalizeText((tenant as any).defaultPageTitle),
    titleSuffix: normalizeText((tenant as any).titleSuffix),
    googleAnalyticsId: normalizeText((tenant as any).googleAnalyticsId),
    googleTagManagerId: normalizeText((tenant as any).googleTagManagerId),
    googleSearchConsoleVerification: normalizeText((tenant as any).googleSearchConsoleVerification),
    facebookPixelId: normalizeText((tenant as any).facebookPixelId),
    slogan: normalizeText((tenant as any).slogan),
    banner: extractMediaUrl((tenant as any).banner),
    chatAvatar: extractMediaUrl((tenant as any).chatAvatar),
    defaultPublicRoute: buildDefaultPublicRoute(tenant, code, settings),
    defaultProtectedRoute: buildDefaultProtectedRoute(tenant, settings),
    isMainDomain: Boolean(ctx.state?.isMainDomain),
  };
}