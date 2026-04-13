const TENANT_UID = 'api::tenant.tenant';
const TENANT_DOMAIN_UID = 'api::tenant-domain.tenant-domain';

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
  return normalizeText(rawHost).toLowerCase();
}

export default {
  async me(ctx: any) {
    try {
      const tenantId = Number(ctx.state?.tenant?.id || ctx.state?.tenantId || 0);
      if (!Number.isInteger(tenantId) || tenantId <= 0) {
        return ctx.notFound('Tenant not found');
      }

      const tenant = await strapi.db.query(TENANT_UID).findOne({
        where: { id: tenantId, tenantStatus: 'active' },
        select: ['id', 'name', 'shortName', 'code'],
        populate: {
          logo: {
            select: ['url'],
          },
        },
      });

      if (!tenant?.id) {
        return ctx.notFound('Tenant not found');
      }

      const primaryDomain = await strapi.db.query(TENANT_DOMAIN_UID).findOne({
        where: {
          tenant: tenantId,
          tenantDomainStatus: 'active',
          isPrimary: true,
        },
        select: ['domain'],
      });

      ctx.body = {
        displayName: normalizeText(tenant.shortName) || normalizeText(tenant.name) || normalizeText(tenant.code),
        domain: normalizeText(primaryDomain?.domain) || readRequestHost(ctx),
        logo: extractMediaUrl(tenant.logo),
      };
    } catch (error) {
      strapi.log.error('[tenant.me] unexpected error', error);
      return ctx.internalServerError('Failed to load tenant branding');
    }
  },
};