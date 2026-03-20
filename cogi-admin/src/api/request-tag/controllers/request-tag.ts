import { mergeTenantWhere, resolveCurrentTenantId } from '../../../utils/tenant-scope';

const REQUEST_TAG_UID = 'api::request-tag.request-tag';

function parsePositiveInt(value: unknown): number | null {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

function toNullableString(value: unknown): string | null {
  const text = String(value || '').trim();
  return text || null;
}

function sanitizeData(input: any) {
  const payload = input && typeof input === 'object' ? input : {};
  const data: Record<string, unknown> = {};

  if (Object.prototype.hasOwnProperty.call(payload, 'name')) {
    data.name = toNullableString(payload.name);
  }
  if (Object.prototype.hasOwnProperty.call(payload, 'group')) {
    data.group = toNullableString(payload.group);
  }
  if (Object.prototype.hasOwnProperty.call(payload, 'description')) {
    data.description = toNullableString(payload.description);
  }
  if (Object.prototype.hasOwnProperty.call(payload, 'isActive')) {
    data.isActive = Boolean(payload.isActive);
  }

  return data;
}

export default {
  async find(ctx) {
    if (!ctx.state.user?.id) {
      return ctx.unauthorized('Unauthorized');
    }

    const tenantId = resolveCurrentTenantId(ctx);
    const page = parsePositiveInt(ctx.query?.page || ctx.query?.['pagination[page]']) || 1;
    const pageSize = parsePositiveInt(ctx.query?.pageSize || ctx.query?.['pagination[pageSize]']) || 50;
    const q = String(ctx.query?.q || '').trim();

    const andWhere: Record<string, unknown>[] = [
      {
        isActive: {
          $ne: false,
        },
      },
      {
        publishedAt: {
          $notNull: true,
        },
      },
    ];

    if (q) {
      andWhere.push({
        $or: [
          { name: { $containsi: q } },
          { slug: { $containsi: q } },
          { description: { $containsi: q } },
          { group: { $containsi: q } },
        ],
      });
    }

    const where = mergeTenantWhere(andWhere.length > 1 ? { $and: andWhere } : andWhere[0], tenantId);
    const total = await strapi.db.query(REQUEST_TAG_UID).count({ where });
    const offset = (page - 1) * pageSize;

    const rows = await strapi.db.query(REQUEST_TAG_UID).findMany({
      where,
      orderBy: [{ name: 'asc' }],
      offset,
      limit: pageSize,
    });

    ctx.body = {
      data: rows,
      meta: {
        pagination: {
          page,
          pageSize,
          total,
          pageCount: Math.ceil(total / pageSize),
        },
      },
    };
  },

  async findOne(ctx) {
    if (!ctx.state.user?.id) {
      return ctx.unauthorized('Unauthorized');
    }

    const tenantId = resolveCurrentTenantId(ctx);
    const id = Number(ctx.params?.id);
    if (!Number.isInteger(id) || id <= 0) {
      return ctx.badRequest('Invalid request tag id');
    }

    const row = await strapi.db.query(REQUEST_TAG_UID).findOne({
      where: mergeTenantWhere({ id, publishedAt: { $notNull: true } }, tenantId),
    });

    if (!row) {
      return ctx.notFound('Request tag not found');
    }

    ctx.body = { data: row };
  },

  async create(ctx) {
    if (!ctx.state.user?.id) {
      return ctx.unauthorized('Unauthorized');
    }

    const tenantId = resolveCurrentTenantId(ctx);
    const body = ctx.request?.body?.data || ctx.request?.body || {};
    const data = sanitizeData(body);

    if (!data.name) {
      return ctx.badRequest('name is required');
    }

    data.tenant = tenantId;

    const created = await strapi.db.query(REQUEST_TAG_UID).create({
      data,
    });

    ctx.body = { data: created };
  },

  async update(ctx) {
    if (!ctx.state.user?.id) {
      return ctx.unauthorized('Unauthorized');
    }

    const tenantId = resolveCurrentTenantId(ctx);
    const id = Number(ctx.params?.id);
    if (!Number.isInteger(id) || id <= 0) {
      return ctx.badRequest('Invalid request tag id');
    }

    const existing = await strapi.db.query(REQUEST_TAG_UID).findOne({
      where: mergeTenantWhere({ id }, tenantId),
      select: ['id'],
    });

    if (!existing) {
      return ctx.notFound('Request tag not found');
    }

    const body = ctx.request?.body?.data || ctx.request?.body || {};
    const data = sanitizeData(body);
    data.tenant = tenantId;

    const updated = await strapi.db.query(REQUEST_TAG_UID).update({
      where: mergeTenantWhere({ id }, tenantId),
      data,
    });

    ctx.body = { data: updated };
  },

  async delete(ctx) {
    if (!ctx.state.user?.id) {
      return ctx.unauthorized('Unauthorized');
    }

    const tenantId = resolveCurrentTenantId(ctx);
    const id = Number(ctx.params?.id);
    if (!Number.isInteger(id) || id <= 0) {
      return ctx.badRequest('Invalid request tag id');
    }

    const existing = await strapi.db.query(REQUEST_TAG_UID).findOne({
      where: mergeTenantWhere({ id }, tenantId),
      select: ['id'],
    });

    if (!existing) {
      return ctx.notFound('Request tag not found');
    }

    await strapi.db.query(REQUEST_TAG_UID).delete({
      where: mergeTenantWhere({ id }, tenantId),
    });

    ctx.body = { data: { id } };
  },
};
