const TENANT_DOMAIN_UID = 'api::tenant-domain.tenant-domain';
const CORS_CACHE_TTL_MS = 5 * 60 * 1000;

const corsOriginCache = new Map<string, { allowed: boolean; expiresAt: number }>();

function normalizeOriginHost(origin: string): string {
  try {
    const url = new URL(String(origin || '').trim());
    return String(url.hostname || '').trim().toLowerCase();
  } catch {
    return '';
  }
}

function isSystemDomain(host: string): boolean {
  if (!host) return false;
  if (host === 'localhost' || host === '127.0.0.1') return true;
  if (host === 'alphataiho.com') return true;
  return host.endsWith('.alphataiho.com');
}

function readCorsCache(host: string): boolean | null {
  const cached = corsOriginCache.get(host);
  if (!cached) return null;

  if (cached.expiresAt <= Date.now()) {
    corsOriginCache.delete(host);
    return null;
  }

  return cached.allowed;
}

function writeCorsCache(host: string, allowed: boolean) {
  corsOriginCache.set(host, {
    allowed,
    expiresAt: Date.now() + CORS_CACHE_TTL_MS,
  });
}

async function resolveCorsOrigin(ctx: any) {
  const origin = String(ctx.request?.header?.origin || '').trim();
  if (!origin) return false;

  const host = normalizeOriginHost(origin);
  if (!host) {
    return false;
  }

  if (isSystemDomain(host)) {
    return origin;
  }

  const cachedAllowed = readCorsCache(host);
  if (cachedAllowed !== null) {
    if (!cachedAllowed) {
      const app = (globalThis as any).strapi;
      app?.log?.warn?.(`CORS blocked origin: ${origin}`);
      return false;
    }

    return origin;
  }

  const app = (globalThis as any).strapi;
  if (!app?.db?.query) {
    return false;
  }

  const tenantDomain = await app.db.query(TENANT_DOMAIN_UID).findOne({
    where: {
      domain: host,
      tenantDomainStatus: 'active',
    },
    select: ['id'],
  });

  const allowed = Boolean(tenantDomain?.id);
  writeCorsCache(host, allowed);

  if (!allowed) {
    app.log?.warn?.(`CORS blocked origin: ${origin}`);
    return false;
  }

  return origin;
}

export default [
  'strapi::logger',
  'strapi::errors',
  'strapi::security',
  'global::tenant-resolver',
  {
    name: 'strapi::cors',
    config: {
      // Dynamic CORS for multi-tenant custom domains.
      // System domains are allowed directly; tenant custom domains are resolved from tenant-domain.
      origin: resolveCorsOrigin,
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      headers: '*',
      credentials: true,
      keepHeaderOnError: true,
    },
  },
  'strapi::poweredBy',
  'strapi::query',
  {
    name: 'strapi::body',
    config: {
      formLimit: '25mb',
      jsonLimit: '25mb',
      textLimit: '25mb',
      formidable: {
        maxFileSize: 20 * 1024 * 1024,
        multiples: false,
      },
    },
  },
  'strapi::session',
  'strapi::favicon',
  'strapi::public',
];
