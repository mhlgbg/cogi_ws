type TenantLite = {
  id: number;
  code: string;
  tenantStatus: 'draft' | 'active' | 'inactive' | 'suspended';
};

type TenantCodeMatchResult = {
  tenant: TenantLite | null;
  conflict: boolean;
  normalizedCode: string;
  candidates: TenantLite[];
};

import { isMainDomainHost } from '../utils/main-domain';

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

  const trimmedHost = String(host).trim().toLowerCase();
  if (!trimmedHost) return '';

  const withoutProtocol = trimmedHost.replace(/^https?:\/\//, '');
  const firstHost = withoutProtocol.split('/')[0]?.split(',')[0]?.trim() || '';
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

export function getTenantCodeFromTenantPath(path?: string | null): string {
  if (!path) return '';

  const pathname = path.split('?')[0] || '';
  const trimmed = pathname.replace(/^\/+|\/+$/g, '');
  if (!trimmed) return '';

  const [firstSegment = '', secondSegment = ''] = trimmed.split('/');
  if (firstSegment.toLowerCase() !== 't') return '';

  return normalizeTenantCode(secondSegment);
}

function normalizeTenantCode(value: unknown): string {
  if (value === null || value === undefined) return '';
  return String(value).trim().toLowerCase();
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

export function isPlatformRoute(path?: string | null): boolean {
  return getFirstPathSegment(path) === 'platform';
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

function getOriginHost(ctx: any): string {
  const requestOrigin = ctx.request?.header?.origin || ctx.request?.header?.referer || '';
  return normalizeHost(String(requestOrigin || ''));
}

function getDomainLookupHosts(ctx: any): string[] {
  const hosts = [getRequestHost(ctx), getOriginHost(ctx)].filter(Boolean);
  return [...new Set(hosts)];
}

function getTenantCodeHeader(ctx: any): string {
  const headerValue = ctx.get?.('x-tenant-code');
  if (typeof headerValue === 'string' && headerValue.trim()) {
    return normalizeTenantCode(headerValue);
  }

  const normalizedHeaderValue = ctx.request?.header?.['x-tenant-code'];
  if (typeof normalizedHeaderValue === 'string' && normalizedHeaderValue.trim()) {
    return normalizeTenantCode(normalizedHeaderValue);
  }

  if (Array.isArray(normalizedHeaderValue) && normalizedHeaderValue.length > 0) {
    return normalizeTenantCode(normalizedHeaderValue[0]);
  }

  const raw = ctx.request?.headers?.['x-tenant-code'];
  if (typeof raw === 'string') {
    return normalizeTenantCode(raw);
  }

  if (Array.isArray(raw) && raw.length > 0) {
    return normalizeTenantCode(raw[0]);
  }

  return '';
}

async function findActiveTenantsByCodeInsensitive(strapi: any, code?: string): Promise<TenantLite[]> {
  const normalizedCode = normalizeTenantCode(code);
  if (!normalizedCode) return [];

  const tenants = await strapi.db.query(TENANT_UID).findMany({
    where: {
      code: {
        $eqi: normalizedCode,
      },
      tenantStatus: ACTIVE_STATUS,
    },
    select: ['id', 'code', 'tenantStatus'],
  });

  return (tenants as TenantLite[] | null) || [];
}

async function findActiveTenantByCode(strapi: any, code?: string): Promise<TenantCodeMatchResult> {
  const normalizedCode = normalizeTenantCode(code);
  if (!normalizedCode) {
    return {
      tenant: null,
      conflict: false,
      normalizedCode,
      candidates: [],
    };
  }

  const candidates = await findActiveTenantsByCodeInsensitive(strapi, normalizedCode);
  if (candidates.length > 1) {
    return {
      tenant: null,
      conflict: true,
      normalizedCode,
      candidates,
    };
  }

  return {
    tenant: candidates[0] || null,
    conflict: false,
    normalizedCode,
    candidates,
  };
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

async function findActiveTenantByHosts(strapi: any, hosts: string[]): Promise<TenantLite | null> {
  for (const host of hosts) {
    const tenant = await findActiveTenantByHost(strapi, host);
    if (tenant) return tenant;
  }

  return null;
}

function shouldDebugTenantResolve(): boolean {
  return process.env.NODE_ENV === 'development';
}

function debugTenantResolve(payload: Record<string, unknown>) {
  if (!shouldDebugTenantResolve()) return;
  strapi.log.info(`[tenant-resolver] ${JSON.stringify(payload)}`);
}

export default (_config: unknown, { strapi }: { strapi: any }) => {
  return async (ctx: any, next: () => Promise<void>) => {
    const host = getRequestHost(ctx);
    const originHost = getOriginHost(ctx);
    const requestOrigin = String(ctx.request?.header?.origin || ctx.request?.header?.referer || '');
    const domainLookupHosts = getDomainLookupHosts(ctx);
    const path = ctx.request?.path || ctx.path || '/';
    const firstSegment = getFirstPathSegment(path);
    const pathTenantCode = getTenantCodeFromTenantPath(path);
    const tenantCodeHeader = getTenantCodeHeader(ctx);
    const hasTenantCodeHeader = Boolean(tenantCodeHeader);
    const hasPathTenantCode = Boolean(pathTenantCode);
    const systemHost = isSystemHost(host);
    const systemRoute = isSystemRoute(path);
    const platformRoute = isPlatformRoute(path);
    const isMainDomain = isMainDomainHost(host) || isMainDomainHost(requestOrigin);

    ctx.state.tenant = null;
    ctx.state.tenantId = null;
    ctx.state.tenantCode = null;
    ctx.state.tenantSource = null;
    ctx.state.isSystemRequest = Boolean(systemRoute);
    ctx.state.isPlatformRequest = platformRoute;
    ctx.state.isMainDomain = isMainDomain;
    ctx.state.tenantConflict = false;

    if (platformRoute) {
      ctx.state.isSystemRequest = false;
      debugTenantResolve({
        path,
        host,
        originHost,
        domainLookupHosts,
        requestOrigin,
        tenantCodeHeader,
        pathTenantCode,
        firstSegment,
        resolvedSource: null,
        tenantCode: null,
        tenantId: null,
        isMainDomain,
        tenantConflict: false,
        isPlatformRequest: true,
      });
      await next();
      return;
    }

    // Skip Strapi internal/system routes to avoid affecting admin panel.
    // Exception: if x-tenant-code header is explicitly sent, still resolve tenant.
    if (systemRoute && !hasTenantCodeHeader && !hasPathTenantCode) {
      await next();
      return;
    }

    const pathTenantMatch = hasPathTenantCode
      ? await findActiveTenantByCode(strapi, pathTenantCode)
      : { tenant: null, conflict: false, normalizedCode: '', candidates: [] } as TenantCodeMatchResult;
    const headerTenantMatch = hasTenantCodeHeader
      ? await findActiveTenantByCode(strapi, tenantCodeHeader)
      : { tenant: null, conflict: false, normalizedCode: '', candidates: [] } as TenantCodeMatchResult;
    const legacyPathTenantMatch = hasTenantCodeHeader || hasPathTenantCode
      ? { tenant: null, conflict: false, normalizedCode: '', candidates: [] } as TenantCodeMatchResult
      : await findActiveTenantByCode(strapi, firstSegment);

    const hasTenantCodeConflict = Boolean(
      pathTenantMatch.conflict || headerTenantMatch.conflict || legacyPathTenantMatch.conflict,
    );
    if (hasTenantCodeConflict) {
      const conflictCode = pathTenantMatch.conflict
        ? pathTenantMatch.normalizedCode
        : headerTenantMatch.conflict
          ? headerTenantMatch.normalizedCode
          : legacyPathTenantMatch.normalizedCode;
      const candidates = pathTenantMatch.conflict
        ? pathTenantMatch.candidates
        : headerTenantMatch.conflict
          ? headerTenantMatch.candidates
          : legacyPathTenantMatch.candidates;

      ctx.state.tenantConflict = true;
      strapi.log.warn('[tenant-resolver] tenant code conflict', {
        reason: 'tenant_code_case_insensitive_conflict',
        tenantCode: conflictCode,
        matchedTenantIds: candidates.map((item) => item.id),
        matchedTenantCodes: candidates.map((item) => item.code),
        path,
        host,
        tenantCodeHeader,
        pathTenantCode,
      });
      return ctx.throw(409, `Tenant code conflict for "${conflictCode}"`);
    }

    const hasExplicitTenantCode = hasTenantCodeHeader || hasPathTenantCode;
    const priorityTenantFromPath = pathTenantMatch.tenant;
    const tenantFromHeader = headerTenantMatch.tenant;
    const tenantFromPath = legacyPathTenantMatch.tenant;
    const priorityTenantFromDomain = hasExplicitTenantCode
      ? null
      : (systemHost
        ? await findActiveTenantByHosts(strapi, domainLookupHosts.filter((candidate) => candidate !== host))
        : await findActiveTenantByHosts(strapi, domainLookupHosts));
    const tenantFromHost = hasExplicitTenantCode || priorityTenantFromDomain
      ? null
      : await findActiveTenantByHosts(strapi, domainLookupHosts);

    const priorityConflictPathDomain =
      priorityTenantFromPath && priorityTenantFromDomain && priorityTenantFromPath.id !== priorityTenantFromDomain.id;
    const conflictPriorityPathHeader =
      priorityTenantFromPath && tenantFromHeader && priorityTenantFromPath.id !== tenantFromHeader.id;
    const conflictPriorityPathLegacyPath =
      priorityTenantFromPath && tenantFromPath && priorityTenantFromPath.id !== tenantFromPath.id;
    const conflictPriorityPathLegacyHost =
      priorityTenantFromPath && tenantFromHost && priorityTenantFromPath.id !== tenantFromHost.id;
    const conflictPriorityDomainHeader =
      priorityTenantFromDomain && tenantFromHeader && priorityTenantFromDomain.id !== tenantFromHeader.id;
    const conflictPriorityDomainLegacyPath =
      priorityTenantFromDomain && tenantFromPath && priorityTenantFromDomain.id !== tenantFromPath.id;
    const conflictPriorityDomainLegacyHost =
      priorityTenantFromDomain && tenantFromHost && priorityTenantFromDomain.id !== tenantFromHost.id;

    const conflictHeaderPath =
      tenantFromHeader && tenantFromPath && tenantFromHeader.id !== tenantFromPath.id;
    const conflictHeaderHost =
      tenantFromHeader && tenantFromHost && tenantFromHeader.id !== tenantFromHost.id;
    const conflictPathHost = tenantFromPath && tenantFromHost && tenantFromPath.id !== tenantFromHost.id;

    ctx.state.tenantConflict = Boolean(
      priorityConflictPathDomain ||
      conflictPriorityPathHeader ||
      conflictPriorityPathLegacyPath ||
      conflictPriorityPathLegacyHost ||
      conflictPriorityDomainHeader ||
      conflictPriorityDomainLegacyPath ||
      conflictPriorityDomainLegacyHost ||
      conflictHeaderPath ||
      conflictHeaderHost ||
      conflictPathHost,
    );

    const resolvedTenant =
      priorityTenantFromPath ||
      priorityTenantFromDomain ||
      tenantFromHeader ||
      tenantFromPath ||
      tenantFromHost;
    const resolvedSource = priorityTenantFromPath
      ? 'priority-path'
      : priorityTenantFromDomain
        ? 'domain'
        : tenantFromHeader
      ? 'header'
      : tenantFromPath
        ? 'legacy-path'
        : tenantFromHost
          ? 'host'
          : null;

    if (resolvedTenant) {
      ctx.state.tenant = resolvedTenant;
      ctx.state.tenantId = resolvedTenant.id;
      ctx.state.tenantCode = resolvedTenant.code;
      ctx.state.tenantSource = resolvedSource;
      ctx.state.isSystemRequest = false;
      debugTenantResolve({
        path,
        host,
        originHost,
        domainLookupHosts,
        requestOrigin,
        tenantCodeHeader,
        pathTenantCode,
        firstSegment,
        resolvedSource,
        tenantCode: resolvedTenant.code,
        tenantId: resolvedTenant.id,
        isMainDomain,
        tenantConflict: ctx.state.tenantConflict,
      });
    } else if (systemHost) {
      ctx.state.isSystemRequest = true;
      debugTenantResolve({
        path,
        host,
        originHost,
        domainLookupHosts,
        requestOrigin,
        tenantCodeHeader,
        pathTenantCode,
        firstSegment,
        resolvedSource: null,
        tenantCode: null,
        tenantId: null,
        isMainDomain,
        tenantConflict: ctx.state.tenantConflict,
        isSystemRequest: true,
      });
    } else {
      debugTenantResolve({
        path,
        host,
        originHost,
        domainLookupHosts,
        requestOrigin,
        tenantCodeHeader,
        pathTenantCode,
        firstSegment,
        resolvedSource: null,
        tenantCode: null,
        tenantId: null,
        isMainDomain,
        tenantConflict: ctx.state.tenantConflict,
      });
    }

    await next();
  };
};
