/**
 * request-message controller
 */

import { factories } from '@strapi/strapi';
import { mergeTenantWhere, resolveCurrentTenantId } from '../../../utils/tenant-scope';

const REQUEST_MESSAGE_UID = 'api::request-message.request-message';

export default factories.createCoreController(REQUEST_MESSAGE_UID, ({ strapi }) => ({
  async find(ctx) {
    // Add publishedAt filter to the query
    const rawFilters = ctx.query?.filters;
    const filters =
      rawFilters && typeof rawFilters === 'object' && !Array.isArray(rawFilters)
        ? (rawFilters as Record<string, any>)
        : {};
    const publishedAtFilter =
      filters.publishedAt && typeof filters.publishedAt === 'object' && (filters.publishedAt as Record<string, any>).$notNull
        ? filters.publishedAt
        : { $notNull: true };

    ctx.query.filters = {
      ...filters,
      publishedAt: publishedAtFilter,
    };

    // Call the default find with modified query
    const { data, meta } = await super.find(ctx);

    // Additionally filter at database level for safety
    const filteredData = data.filter((item: any) => item.publishedAt !== null && item.publishedAt !== undefined);

    return { data: filteredData, meta };
  },

  async findOne(ctx) {
    const tenantId = resolveCurrentTenantId(ctx);
    const id = ctx.params?.id;

    // Ensure only published records are returned
    const where = mergeTenantWhere({ id, publishedAt: { $notNull: true } }, tenantId);
    const row = await strapi.db.query(REQUEST_MESSAGE_UID).findOne({ where });

    if (!row) {
      return ctx.notFound('Request message not found');
    }

    ctx.body = { data: row };
  },
}));
