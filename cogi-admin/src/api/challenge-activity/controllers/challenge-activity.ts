import { factories } from '@strapi/strapi';
import {
  mergeTenantWhere,
  normalizePopulateInput,
  normalizeSortInput,
  resolveCurrentTenantId,
  toPositiveInt,
  whereByParam,
} from '../../../utils/tenant-scope';

const CHALLENGE_ACTIVITY_UID = 'api::challenge-activity.challenge-activity';

const ALLOWED_POPULATE = new Set(['tenant', 'challenge', 'participant', 'user', 'acceptedBy', 'rejectedBy']);

function resolvePopulate(ctx: any) {
  const requestedPopulate = normalizePopulateInput(ctx.query?.populate);

  if (requestedPopulate === true) {
    return ['tenant', 'challenge', 'participant', 'user', 'acceptedBy', 'rejectedBy'];
  }

  if (Array.isArray(requestedPopulate) && requestedPopulate.length > 0) {
    const required = ['tenant', 'challenge', 'participant', 'user'];
    const allowedRequested = requestedPopulate.filter((item) => ALLOWED_POPULATE.has(String(item || '')));
    return Array.from(new Set([...required, ...allowedRequested]));
  }

  return ['tenant', 'challenge', 'participant', 'user'];
}

function rejectStravaBackedMutation(ctx: any) {
  return ctx.badRequest('Challenge activity ledger is restricted to the dedicated manual evidence workflow. Strava-backed activity linking is disabled.');
}

export default factories.createCoreController(CHALLENGE_ACTIVITY_UID, () => ({
  async find(ctx) {
    const tenantId = resolveCurrentTenantId(ctx);
    const query = (ctx.query || {}) as Record<string, unknown>;
    const page = toPositiveInt((query.pagination as Record<string, unknown> | undefined)?.page, 1);
    const pageSize = toPositiveInt((query.pagination as Record<string, unknown> | undefined)?.pageSize, 10);
    const start = (page - 1) * pageSize;
    const where = mergeTenantWhere(query.filters, tenantId);
    const orderBy = normalizeSortInput(query.sort);
    const populate = resolvePopulate(ctx);

    const [rows, total] = await Promise.all([
      strapi.db.query(CHALLENGE_ACTIVITY_UID).findMany({
        where,
        orderBy: orderBy.length > 0 ? orderBy : [{ createdAt: 'desc' }],
        offset: start,
        limit: pageSize,
        populate,
      }),
      strapi.db.query(CHALLENGE_ACTIVITY_UID).count({ where }),
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
    const entity = await strapi.db.query(CHALLENGE_ACTIVITY_UID).findOne({
      where: mergeTenantWhere(whereByParam(ctx.params?.id), tenantId),
      populate: resolvePopulate(ctx),
    });

    if (!entity) {
      return ctx.notFound('Challenge activity not found');
    }

    return this.transformResponse(entity);
  },

  async create(ctx) {
    return rejectStravaBackedMutation(ctx);
  },

  async update(ctx) {
    return rejectStravaBackedMutation(ctx);
  },

  async delete(ctx) {
    return rejectStravaBackedMutation(ctx);
  },
}));