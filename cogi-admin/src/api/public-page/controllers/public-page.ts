import { factories } from '@strapi/strapi';
import { buildActiveSoftDeleteWhere } from '../../../utils/soft-delete';
import { mergeTenantWhere, normalizePopulateInput, normalizeSortInput, resolveCurrentTenantId, toPositiveInt, whereByParam } from '../../../utils/tenant-scope';

const PUBLIC_PAGE_UID = 'api::public-page.public-page';

function resolvePublicPagePopulate(ctx: any) {
  const requestedPopulate = normalizePopulateInput(ctx.query?.populate);
  const basePopulate: Record<string, unknown> = {
    tenant: true,
    leadCampaign: {
      select: [
        'id',
        'name',
        'code',
        'description',
        'leadCampaignStatus',
        'startDate',
        'endDate',
        'successMessage',
        'submitButtonText',
        'autoReplyEnabled',
        'autoReplySubject',
        'autoReplyHtml',
        'internalNotifyEnabled',
        'internalNotifyEmails',
      ],
      populate: {
        formTemplate: {
          select: ['id', 'name', 'version', 'schema', 'formTemplateStatus', 'isLocked'],
        },
      },
    },
    seoImage: true,
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

function normalizePageStatus(value: unknown): 'published' {
  return 'published';
}

export default factories.createCoreController(PUBLIC_PAGE_UID, () => ({
  async find(ctx) {
    const tenantId = resolveCurrentTenantId(ctx);
    const query = (ctx.query || {}) as Record<string, unknown>;
    const page = toPositiveInt((query.pagination as Record<string, unknown> | undefined)?.page, 1);
    const pageSize = toPositiveInt((query.pagination as Record<string, unknown> | undefined)?.pageSize, 10);
    const start = (page - 1) * pageSize;
    const where = mergeTenantWhere({
      $and: [
        query.filters || {},
        buildActiveSoftDeleteWhere(),
        { publicPageStatus: normalizePageStatus(query.status) },
      ],
    }, tenantId);
    const orderBy = normalizeSortInput(query.sort);
    const populate = resolvePublicPagePopulate(ctx);

    const [rows, total] = await Promise.all([
      strapi.db.query(PUBLIC_PAGE_UID).findMany({
        where,
        orderBy: orderBy.length > 0 ? orderBy : [{ publishedAt: 'desc' }, { updatedAt: 'desc' }],
        offset: start,
        limit: pageSize,
        populate,
      }),
      strapi.db.query(PUBLIC_PAGE_UID).count({ where }),
    ]);

    if (Array.isArray(rows) && rows.length > 0) {
      const first = rows[0] as any;
      strapi.log.info(`[public-page.find] slug=${String((query.filters as any)?.slug?.$eq || '')} pageId=${String(first?.id || '')} leadCampaign=${String(first?.leadCampaign?.id || first?.leadCampaign || '')} formTemplate=${String(first?.leadCampaign?.formTemplate?.id || first?.leadCampaign?.formTemplate || '')}`);
    }

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
    const entity = await strapi.db.query(PUBLIC_PAGE_UID).findOne({
      where: mergeTenantWhere({
        $and: [
          whereByParam(ctx.params?.id) || {},
          buildActiveSoftDeleteWhere(),
          { publicPageStatus: 'published' },
        ],
      }, tenantId),
      populate: resolvePublicPagePopulate(ctx),
    });

    if (!entity) {
      return ctx.notFound('Public page not found');
    }

    strapi.log.info(`[public-page.findOne] pageId=${String((entity as any)?.id || '')} leadCampaign=${String((entity as any)?.leadCampaign?.id || (entity as any)?.leadCampaign || '')} formTemplate=${String((entity as any)?.leadCampaign?.formTemplate?.id || (entity as any)?.leadCampaign?.formTemplate || '')}`);

    return this.transformResponse(entity);
  },
}));
