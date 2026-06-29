import { factories } from '@strapi/strapi';
import {
  extractRelationRef,
  mergeTenantWhere,
  normalizePopulateInput,
  normalizeSortInput,
  resolveCurrentTenantId,
  toPositiveInt,
  whereByParam,
} from '../../../utils/tenant-scope';

const JOURNAL_ISSUE_UID = 'api::journal-issue.journal-issue';

type GenericRecord = Record<string, unknown>;

function resolveRequestData(ctx: any): GenericRecord {
  const body = (ctx.request.body ??= {});
  if (!body.data || typeof body.data !== 'object' || Array.isArray(body.data)) {
    body.data = {};
  }

  return body.data as GenericRecord;
}

function toText(value: unknown): string {
  if (value === null || value === undefined) return '';
  return String(value).trim();
}

function resolveReadStatus(rawStatus: unknown): 'draft' | 'published' {
  return toText(rawStatus).toLowerCase() === 'draft' ? 'draft' : 'published';
}

function resolveWriteStatus(rawStatus: unknown): 'draft' | 'published' {
  return toText(rawStatus).toLowerCase() === 'published' ? 'published' : 'draft';
}

function toConnectRelation(value: unknown) {
  if (value === undefined) return undefined;
  if (value === null || value === '') return null;

  if (typeof value === 'object' && value !== null) {
    const relation = value as Record<string, unknown>;
    if (Object.prototype.hasOwnProperty.call(relation, 'connect') || Object.prototype.hasOwnProperty.call(relation, 'disconnect') || Object.prototype.hasOwnProperty.call(relation, 'set')) {
      return value;
    }
  }

  const relationRef = extractRelationRef(value);
  if (relationRef === null || relationRef === undefined || relationRef === '') return null;
  return { connect: [relationRef] };
}

function normalizeJournalIssueRelationPayload(data: GenericRecord) {
  const relationFields = ['tenant', 'journalCategory', 'coverImage', 'pdfFile'];

  for (const field of relationFields) {
    if (!Object.prototype.hasOwnProperty.call(data, field)) continue;
    const normalized = toConnectRelation(data[field]);
    data[field] = normalized === undefined ? data[field] : normalized;
  }
}

async function resolveExistingJournalIssue(ctx: any, tenantId: number | string) {
  return strapi.db.query(JOURNAL_ISSUE_UID).findOne({
    where: mergeTenantWhere(whereByParam(ctx.params?.id), tenantId),
    select: ['id', 'documentId'],
  });
}

function resolveJournalIssuePopulate(ctx: any) {
  const requestedPopulate = normalizePopulateInput(ctx.query?.populate);
  const basePopulate: Record<string, unknown> = {
    tenant: true,
    journalCategory: true,
    coverImage: true,
    pdfFile: true,
    issueItems: {
      populate: {
        article: true,
        pdfFile: true,
        tenant: true,
      },
    },
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

export default factories.createCoreController(JOURNAL_ISSUE_UID, () => ({
  async find(ctx) {
    const tenantId = resolveCurrentTenantId(ctx);
    const query = (ctx.query || {}) as Record<string, unknown>;
    const page = toPositiveInt((query.pagination as Record<string, unknown> | undefined)?.page, 1);
    const pageSize = toPositiveInt((query.pagination as Record<string, unknown> | undefined)?.pageSize, 10);
    const filters = mergeTenantWhere(query.filters, tenantId);
    const sort = normalizeSortInput(query.sort);
    const populate = resolveJournalIssuePopulate(ctx);
    const status = resolveReadStatus(query.status);

    const [rows, total] = await Promise.all([
      strapi.documents(JOURNAL_ISSUE_UID).findMany({
        filters: filters as any,
        sort: sort.length > 0 ? (sort as any) : [{ publicAt: 'desc' }, { year: 'desc' }, { updatedAt: 'desc' }],
        status,
        pagination: { page, pageSize },
        populate,
      }),
      strapi.documents(JOURNAL_ISSUE_UID).count({
        filters: filters as any,
        status,
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
    const existing = await resolveExistingJournalIssue(ctx, tenantId);

    if (!existing?.documentId) {
      return ctx.notFound('Journal issue not found');
    }

    const entity = await strapi.documents(JOURNAL_ISSUE_UID).findOne({
      documentId: existing.documentId,
      status: resolveReadStatus(ctx.query?.status),
      populate: resolveJournalIssuePopulate(ctx) as any,
    });

    if (!entity) {
      return ctx.notFound('Journal issue not found');
    }

    return this.transformResponse(entity);
  },

  async create(ctx) {
    const tenantId = resolveCurrentTenantId(ctx);
    const data = resolveRequestData(ctx);
    data.tenant = tenantId;
    delete data.publishedAt;
    normalizeJournalIssueRelationPayload(data);

    const created = await strapi.documents(JOURNAL_ISSUE_UID).create({
      data: data as any,
      status: resolveWriteStatus(ctx.query?.status),
      populate: resolveJournalIssuePopulate(ctx) as any,
    });

    return this.transformResponse(created);
  },

  async update(ctx) {
    const tenantId = resolveCurrentTenantId(ctx);
    const existing = await resolveExistingJournalIssue(ctx, tenantId);

    if (!existing?.documentId) {
      return ctx.notFound('Journal issue not found');
    }

    const data = resolveRequestData(ctx);
    data.tenant = tenantId;
    delete data.publishedAt;
    normalizeJournalIssueRelationPayload(data);

    const updated = await strapi.documents(JOURNAL_ISSUE_UID).update({
      documentId: existing.documentId,
      data: data as any,
      status: resolveWriteStatus(ctx.query?.status),
      populate: resolveJournalIssuePopulate(ctx) as any,
    });

    return this.transformResponse(updated);
  },

  async delete(ctx) {
    const tenantId = resolveCurrentTenantId(ctx);
    const existing = await resolveExistingJournalIssue(ctx, tenantId);

    if (!existing?.documentId) {
      return ctx.notFound('Journal issue not found');
    }

    await strapi.documents(JOURNAL_ISSUE_UID).delete({
      documentId: existing.documentId,
    });

    ctx.status = 204;
    return null;
  },
}));