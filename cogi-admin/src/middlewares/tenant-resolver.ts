type TenantLite = {
  id: number;
  code: string;
  tenantStatus: 'draft' | 'active' | 'inactive' | 'suspended';
};

const TENANT_UID = 'api::tenant.tenant';
const TENANT_DOMAIN_UID = 'api::tenant-domain.tenant-domain';

const SYSTEM_HOSTS = new Set(['localhost', '127.0.0.1', 'cogi.alphataiho.com']);
const SYSTEM_ROUTE_SEGMENTS = new Set([
  'admin',
  'documentation',
  'uploads',
  'content-manager',
  'content-type-builder',
  'email',
  'i18n',
  'users-permissions',
  'openapi',
  '_health',
]);

const ACTIVE_STATUS = 'active';

export function normalizeHost(host?: string | null): string {
  if (!host) return '';

  const firstHost = host.split(',')[0]?.trim().toLowerCase() || '';
  if (!firstHost) return '';

  if (firstHost.startsWith('[')) {
    const endBracketIndex = firstHost.indexOf(']');
    return endBracketIndex > 0 ? firstHost.slice(1, endBracketIndex) : firstHost;
  }

  const colonIndex = firstHost.indexOf(':');
  return colonIndex > -1 ? firstHost.slice(0, colonIndex) : firstHost;
}

export function getFirstPathSegment(path?: string | null): string {
  if (!path) return '';

  const pathname = path.split('?')[0] || '';
  const trimmed = pathname.replace(/^\/+|\/+$/g, '');
  if (!trimmed) return '';

  const [segment = ''] = trimmed.split('/');
  return segment.toLowerCase();
}

export function isSystemHost(host: string): boolean {
  return SYSTEM_HOSTS.has(host);
}

export function isSystemRoute(path?: string | null): boolean {
  if (!path || path === '/') return true;

  const segment = getFirstPathSegment(path);
  if (!segment) return true;

  return SYSTEM_ROUTE_SEGMENTS.has(segment);
}

function getRequestHost(ctx: any): string {
  const forwardedHost = ctx.request?.headers?.['x-forwarded-host'];

  if (typeof forwardedHost === 'string' && forwardedHost) {
    return normalizeHost(forwardedHost);
  }

  if (Array.isArray(forwardedHost) && forwardedHost.length > 0) {
    return normalizeHost(String(forwardedHost[0]));
  }

  return normalizeHost(ctx.request?.host || ctx.host || '');
}

function getTenantCodeHeader(ctx: any): string {
  const headerValue = ctx.get?.('x-tenant-code');
  if (typeof headerValue === 'string' && headerValue.trim()) {
    return headerValue.trim().toLowerCase();
  }

  const normalizedHeaderValue = ctx.request?.header?.['x-tenant-code'];
  if (typeof normalizedHeaderValue === 'string' && normalizedHeaderValue.trim()) {
    return normalizedHeaderValue.trim().toLowerCase();
  }

  if (Array.isArray(normalizedHeaderValue) && normalizedHeaderValue.length > 0) {
    return String(normalizedHeaderValue[0]).trim().toLowerCase();
  }

  const raw = ctx.request?.headers?.['x-tenant-code'];
  if (typeof raw === 'string') {
    return raw.trim().toLowerCase();
  }

  if (Array.isArray(raw) && raw.length > 0) {
    return String(raw[0]).trim().toLowerCase();
  }

  return '';
}

async function findActiveTenantByCode(strapi: any, code?: string): Promise<TenantLite | null> {
  if (!code) return null;

  const tenant = await strapi.db.query(TENANT_UID).findOne({
    where: {
      code,
      tenantStatus: ACTIVE_STATUS,
    },
    select: ['id', 'code', 'tenantStatus'],
  });

  return (tenant as TenantLite | null) || null;
}

async function findActiveTenantByHost(strapi: any, host: string): Promise<TenantLite | null> {
  if (!host) return null;

  const tenantDomain = await strapi.db.query(TENANT_DOMAIN_UID).findOne({
    where: {
      domain: host,
      tenantDomainStatus: ACTIVE_STATUS,
    },
    populate: {
      tenant: {
        select: ['id', 'code', 'tenantStatus'],
      },
    },
  });

  const tenant = tenantDomain?.tenant as TenantLite | null | undefined;
  if (!tenant || tenant.tenantStatus !== ACTIVE_STATUS) return null;

  return tenant;
}

export default (_config: unknown, { strapi }: { strapi: any }) => {
  return async (ctx: any, next: () => Promise<void>) => {
    const host = getRequestHost(ctx);
    const path = ctx.request?.path || ctx.path || '/';
    const firstSegment = getFirstPathSegment(path);
    const tenantCodeHeader = getTenantCodeHeader(ctx);
    const hasTenantCodeHeader = Boolean(tenantCodeHeader);
    const systemHost = isSystemHost(host);
    const systemRoute = isSystemRoute(path);

    ctx.state.tenant = null;
    ctx.state.tenantId = null;
    ctx.state.tenantCode = null;
    ctx.state.tenantSource = null;
    ctx.state.isSystemRequest = Boolean(systemRoute);
    ctx.state.tenantConflict = false;

    // Skip Strapi internal/system routes to avoid affecting admin panel.
    // Exception: if x-tenant-code header is explicitly sent, still resolve tenant.
    if (systemRoute && !hasTenantCodeHeader) {
      await next();
      return;
    }

    const tenantFromHeader = hasTenantCodeHeader
      ? await findActiveTenantByCode(strapi, tenantCodeHeader)
      : null;
    const tenantFromPath = hasTenantCodeHeader ? null : await findActiveTenantByCode(strapi, firstSegment);
    const tenantFromHost = hasTenantCodeHeader || systemHost ? null : await findActiveTenantByHost(strapi, host);

    const conflictHeaderPath =
      tenantFromHeader && tenantFromPath && tenantFromHeader.id !== tenantFromPath.id;
    const conflictHeaderHost =
      tenantFromHeader && tenantFromHost && tenantFromHeader.id !== tenantFromHost.id;
    const conflictPathHost = tenantFromPath && tenantFromHost && tenantFromPath.id !== tenantFromHost.id;

    ctx.state.tenantConflict = Boolean(conflictHeaderPath || conflictHeaderHost || conflictPathHost);

    const resolvedTenant = tenantFromHeader || tenantFromPath || tenantFromHost;
    const resolvedSource = tenantFromHeader
      ? 'header'
      : tenantFromPath
        ? 'path'
        : tenantFromHost
          ? 'host'
          : null;

    if (resolvedTenant) {
      ctx.state.tenant = resolvedTenant;
      ctx.state.tenantId = resolvedTenant.id;
      ctx.state.tenantCode = resolvedTenant.code;
      ctx.state.tenantSource = resolvedSource;
      ctx.state.isSystemRequest = false;
    } else if (systemHost) {
      ctx.state.isSystemRequest = true;
    }

    await next();
  };
};
