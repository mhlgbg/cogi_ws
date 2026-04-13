const TENANT_DOMAIN_UID = 'api::tenant-domain.tenant-domain';

function normalizeText(value: unknown): string {
  if (value === null || value === undefined) return '';
  return String(value).trim();
}

function trimTrailingSlash(value: string): string {
  return value.replace(/\/+$/, '');
}

function toPositiveInt(value: unknown): number | null {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

function readOrigin(ctx: any): string {
  return normalizeText(ctx?.request?.header?.origin || ctx?.request?.headers?.origin || '');
}

function readHost(ctx: any): string {
  const forwardedHost = ctx?.request?.headers?.['x-forwarded-host'];
  const rawHost = Array.isArray(forwardedHost)
    ? forwardedHost[0]
    : forwardedHost || ctx?.request?.host || ctx?.host || '';

  return normalizeText(rawHost);
}

function readProtocol(ctx: any, host: string): string {
  const forwardedProto = ctx?.request?.headers?.['x-forwarded-proto'];
  const rawProto = Array.isArray(forwardedProto) ? forwardedProto[0] : forwardedProto;
  const normalizedProto = normalizeText(rawProto || ctx?.request?.protocol || ctx?.protocol || '').toLowerCase();

  if (normalizedProto === 'http' || normalizedProto === 'https') {
    return normalizedProto;
  }

  const normalizedHost = host.toLowerCase();
  if (normalizedHost.startsWith('localhost') || normalizedHost.startsWith('127.0.0.1')) {
    return 'http';
  }

  return 'https';
}

async function findPrimaryTenantDomain(tenantId: number | null): Promise<string> {
  if (!tenantId) return '';

  const app = (globalThis as any).strapi;
  if (!app?.db?.query) return '';

  const primaryDomain = await app.db.query(TENANT_DOMAIN_UID).findOne({
    where: {
      tenant: tenantId,
      tenantDomainStatus: 'active',
      isPrimary: true,
    },
    select: ['domain'],
  });

  return normalizeText(primaryDomain?.domain).toLowerCase();
}

export async function getBaseUrl(ctx: any, options?: { tenantId?: number | string | null }): Promise<string> {
  const tenantId = toPositiveInt(options?.tenantId ?? ctx?.state?.tenant?.id ?? ctx?.state?.tenantId);
  const primaryDomain = await findPrimaryTenantDomain(tenantId);
  if (primaryDomain) {
    return `https://${primaryDomain}`;
  }

  const origin = readOrigin(ctx);
  if (origin) {
    try {
      const parsed = new URL(origin);
      return trimTrailingSlash(`${parsed.protocol}//${parsed.host}`);
    } catch {
      // Ignore malformed origin and continue with host fallback.
    }
  }

  const host = readHost(ctx);
  if (host) {
    const protocol = readProtocol(ctx, host);
    return trimTrailingSlash(`${protocol}://${host}`);
  }

  return trimTrailingSlash(process.env.FRONTEND_URL?.trim() || 'http://localhost:5173');
}

export async function buildActivationLink(
  ctx: any,
  activationToken: string,
  options?: { tenantId?: number | string | null },
): Promise<string> {
  const baseUrl = await getBaseUrl(ctx, options);
  return `${baseUrl}/activate?token=${encodeURIComponent(activationToken)}`;
}

export async function buildResetPasswordLink(
  ctx: any,
  resetPasswordToken: string,
  options?: { tenantId?: number | string | null },
): Promise<string> {
  const baseUrl = await getBaseUrl(ctx, options);
  return `${baseUrl}/reset-password?code=${encodeURIComponent(resetPasswordToken)}`;
}

export async function buildVerifyEmailLink(
  ctx: any,
  confirmationToken: string,
  options?: { tenantId?: number | string | null },
): Promise<string> {
  const baseUrl = await getBaseUrl(ctx, options);
  return `${baseUrl}/verify-email?token=${encodeURIComponent(confirmationToken)}`;
}