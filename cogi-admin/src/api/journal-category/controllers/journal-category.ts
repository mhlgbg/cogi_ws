import { factories } from '@strapi/strapi';
import {
  mergeTenantWhere,
  normalizePopulateInput,
  normalizeSortInput,
  resolveCurrentTenantId,
  toPositiveInt,
  whereByParam,
} from '../../../utils/tenant-scope';

const JOURNAL_CATEGORY_UID = 'api::journal-category.journal-category';

type GenericRecord = Record<string, unknown>;

function resolveRequestData(ctx: any): GenericRecord {
  const body = (ctx.request.body ??= {});
  if (!body.data || typeof body.data !== 'object' || Array.isArray(body.data)) {
    body.data = {};
  }

  return body.data as GenericRecord;
}

function resolveJournalCategoryPopulate(ctx: any) {
  const requestedPopulate = normalizePopulateInput(ctx.query?.populate);
  const basePopulate: Record<string, unknown> = {
    tenant: true,
    journalIssues: true,
  };

  if (requestedPopulate === true) return basePopulate;
  if (Array.isArray(requestedPopulate) && requestedPopulate.length > 0) {
    const mergedPopulate = { ...basePopulate };
    for (const key of requestedPopulate) {
      if (!Object.prototype.hasOwnProperty.call(mergedPopulate, key)) {
        mergedPopulate[key] = true;
      }
    }

    return mergedPopulate;
  }

  return ['tenant'];
}

export default factories.createCoreController(JOURNAL_CATEGORY_UID, () => ({
  async find(ctx) {
    const tenantId = resolveCurrentTenantId(ctx);
    const query = (ctx.query || {}) as Record<string, unknown>;
    const page = toPositiveInt((query.pagination as Record<string, unknown> | undefined)?.page, 1);
    const pageSize = toPositiveInt((query.pagination as Record<string, unknown> | undefined)?.pageSize, 10);
    const start = (page - 1) * pageSize;
    const where = mergeTenantWhere(query.filters, tenantId);
    const orderBy = normalizeSortInput(query.sort);
    const populate = resolveJournalCategoryPopulate(ctx);

    const [rows, total] = await Promise.all([
      strapi.db.query(JOURNAL_CATEGORY_UID).findMany({
        where,
        orderBy: orderBy.length > 0 ? orderBy : [{ title: 'asc' }],
        offset: start,
        limit: pageSize,
        populate,
      }),
      strapi.db.query(JOURNAL_CATEGORY_UID).count({ where }),
    ]);

    return this.transformResponse(rows, {
      pagination: {
        page,
        pageSize,
        pageCount: Math.max(1, Math.ceil(total / pageSize)),
        total,
      },
    });
  },

  async findOne(ctx) {
    const tenantId = resolveCurrentTenantId(ctx);
    const entity = await strapi.db.query(JOURNAL_CATEGORY_UID).findOne({
      where: mergeTenantWhere(whereByParam(ctx.params?.id), tenantId),
      populate: resolveJournalCategoryPopulate(ctx),
    });

    if (!entity) {
      return ctx.notFound('Journal category not found');
    }

    return this.transformResponse(entity);
  },

  async create(ctx) {
    const tenantId = resolveCurrentTenantId(ctx);
    const data = resolveRequestData(ctx);
    data.tenant = tenantId;

    const created = await strapi.db.query(JOURNAL_CATEGORY_UID).create({ data });
    const populatedCreated = await strapi.db.query(JOURNAL_CATEGORY_UID).findOne({
      where: { id: created.id },
      populate: resolveJournalCategoryPopulate(ctx),
    });

    return this.transformResponse(populatedCreated ?? created);
  },

  async update(ctx) {
    const tenantId = resolveCurrentTenantId(ctx);
    const existing = await strapi.db.query(JOURNAL_CATEGORY_UID).findOne({
      where: mergeTenantWhere(whereByParam(ctx.params?.id), tenantId),
    });

    if (!existing) {
      return ctx.notFound('Journal category not found');
    }

    const data = resolveRequestData(ctx);
    data.tenant = tenantId;

    const updated = await strapi.db.query(JOURNAL_CATEGORY_UID).update({
      where: { id: existing.id },
      data,
    });
    const populatedUpdated = await strapi.db.query(JOURNAL_CATEGORY_UID).findOne({
      where: { id: existing.id },
      populate: resolveJournalCategoryPopulate(ctx),
    });

    return this.transformResponse(populatedUpdated ?? updated);
  },

  async delete(ctx) {
    const tenantId = resolveCurrentTenantId(ctx);
    const existing = await strapi.db.query(JOURNAL_CATEGORY_UID).findOne({
      where: mergeTenantWhere(whereByParam(ctx.params?.id), tenantId),
    });

    if (!existing) {
      return ctx.notFound('Journal category not found');
    }

    return await super.delete({
      ...ctx,
      params: { ...ctx.params, id: existing.id },
    });
  },
}));