import { factories } from '@strapi/strapi';
import {
  mergeTenantWhere,
  normalizePopulateInput,
  normalizeSortInput,
  resolveCurrentTenantId,
  toPositiveInt,
  whereByParam,
} from '../../../utils/tenant-scope';

const JOURNAL_ISSUE_ITEM_UID = 'api::journal-issue-item.journal-issue-item';

type GenericRecord = Record<string, unknown>;

function resolveRequestData(ctx: any): GenericRecord {
  const body = (ctx.request.body ??= {});
  if (!body.data || typeof body.data !== 'object' || Array.isArray(body.data)) {
    body.data = {};
  }

  return body.data as GenericRecord;
}

async function resolveExistingJournalIssueItem(ctx: any, tenantId: number | string) {
  return strapi.db.query(JOURNAL_ISSUE_ITEM_UID).findOne({
    where: mergeTenantWhere(whereByParam(ctx.params?.id), tenantId),
    select: ['id', 'documentId'],
  });
}

function resolveJournalIssueItemPopulate(ctx: any) {
  const requestedPopulate = normalizePopulateInput(ctx.query?.populate);
  const basePopulate: Record<string, unknown> = {
    tenant: true,
    journalIssue: {
      populate: ['coverImage', 'pdfFile'],
    },
    article: true,
    pdfFile: true,
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

  return basePopulate;
}

export default factories.createCoreController(JOURNAL_ISSUE_ITEM_UID, () => ({
  async find(ctx) {
    const tenantId = resolveCurrentTenantId(ctx);
    const query = (ctx.query || {}) as Record<string, unknown>;
    const page = toPositiveInt((query.pagination as Record<string, unknown> | undefined)?.page, 1);
    const pageSize = toPositiveInt((query.pagination as Record<string, unknown> | undefined)?.pageSize, 25);
    const filters = mergeTenantWhere(query.filters, tenantId);
    const sort = normalizeSortInput(query.sort);
    const populate = resolveJournalIssueItemPopulate(ctx);

    const [rows, total] = await Promise.all([
      strapi.documents(JOURNAL_ISSUE_ITEM_UID).findMany({
        filters: filters as any,
        sort: sort.length > 0 ? (sort as any) : [{ orderNo: 'asc' }, { id: 'asc' }],
        pagination: { page, pageSize },
        populate,
      }),
      strapi.documents(JOURNAL_ISSUE_ITEM_UID).count({
        filters: filters as any,
      }),
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
    const existing = await resolveExistingJournalIssueItem(ctx, tenantId);

    if (!existing?.documentId) {
      return ctx.notFound('Journal issue item not found');
    }

    const entity = await strapi.documents(JOURNAL_ISSUE_ITEM_UID).findOne({
      documentId: existing.documentId,
      populate: resolveJournalIssueItemPopulate(ctx) as any,
    });

    if (!entity) {
      return ctx.notFound('Journal issue item not found');
    }

    return this.transformResponse(entity);
  },

  async create(ctx) {
    const tenantId = resolveCurrentTenantId(ctx);
    const data = resolveRequestData(ctx);
    data.tenant = tenantId;

    const created = await strapi.documents(JOURNAL_ISSUE_ITEM_UID).create({
      data: data as any,
      populate: resolveJournalIssueItemPopulate(ctx) as any,
    });

    return this.transformResponse(created);
  },

  async update(ctx) {
    const tenantId = resolveCurrentTenantId(ctx);
    const existing = await resolveExistingJournalIssueItem(ctx, tenantId);

    if (!existing?.documentId) {
      return ctx.notFound('Journal issue item not found');
    }

    const data = resolveRequestData(ctx);
    data.tenant = tenantId;

    const updated = await strapi.documents(JOURNAL_ISSUE_ITEM_UID).update({
      documentId: existing.documentId,
      data: data as any,
      populate: resolveJournalIssueItemPopulate(ctx) as any,
    });

    return this.transformResponse(updated);
  },

  async delete(ctx) {
    const tenantId = resolveCurrentTenantId(ctx);
    const existing = await resolveExistingJournalIssueItem(ctx, tenantId);

    if (!existing?.documentId) {
      return ctx.notFound('Journal issue item not found');
    }

    await strapi.documents(JOURNAL_ISSUE_ITEM_UID).delete({
      documentId: existing.documentId,
    });

    ctx.status = 204;
    return null;
  },
}));