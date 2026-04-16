import { buildTenantContextPayload } from '../services/tenant-context';

export default {
  async me(ctx: any) {
    try {
      const tenantContext = await buildTenantContextPayload(strapi, ctx);
      if (!tenantContext) {
        return ctx.notFound('Tenant not found');
      }

      ctx.body = {
        displayName: tenantContext.displayName,
        domain: tenantContext.domain,
        logo: tenantContext.logo,
      };
    } catch (error) {
      strapi.log.error('[tenant.me] unexpected error', error);
      return ctx.internalServerError('Failed to load tenant branding');
    }
  },

  async context(ctx: any) {
    try {
      const tenantContext = await buildTenantContextPayload(strapi, ctx);
      if (!tenantContext) {
        return ctx.notFound('Tenant not found');
      }

      ctx.body = tenantContext;
    } catch (error) {
      strapi.log.error('[tenant.context] unexpected error', error);
      return ctx.internalServerError('Failed to load tenant context');
    }
  },
};