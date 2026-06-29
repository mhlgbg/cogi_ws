import { errors } from '@strapi/utils';
import { extractRelationRef, hasOwn, toText } from '../../../../utils/tenant-scope';

const JOURNAL_CATEGORY_UID = 'api::journal-category.journal-category';

type GenericRecord = Record<string, unknown>;

function getRequestContextTenantId(): number | string | null {
  const requestContext = strapi.requestContext?.get?.();
  const tenantId = requestContext?.state?.tenantId ?? requestContext?.state?.tenant?.id;
  if (tenantId === null || tenantId === undefined || tenantId === '') return null;
  return tenantId;
}

function extractEntryRelationRef(value: unknown): string | number | null {
  if (value === null || value === undefined) return null;
  if (typeof value === 'string' || typeof value === 'number') return value;
  if (typeof value !== 'object') return null;

  const relation = value as { id?: number | string; documentId?: string };
  if (relation.id !== undefined) return relation.id;
  if (relation.documentId) return relation.documentId;
  return null;
}

function slugify(value: unknown): string {
  return toText(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

async function loadExistingCategory(where: unknown) {
  const normalizedWhere = typeof where === 'object' && where !== null
    ? Object.fromEntries(
      Object.entries(where as Record<string, unknown>).filter(
        ([key, value]) => !(key === 'locale' && (value === '' || value === null)),
      ),
    )
    : where;

  if (!normalizedWhere) return null;

  return strapi.db.query(JOURNAL_CATEGORY_UID).findOne({
    where: normalizedWhere,
    populate: {
      tenant: { select: ['id', 'documentId'] },
    },
    select: ['id', 'title', 'slug', 'description'],
  });
}

async function findCategoryByTenantAndSlug(tenantRef: string | number, slug: string) {
  return strapi.db.query(JOURNAL_CATEGORY_UID).findMany({
    where: {
      tenant: { id: { $eq: tenantRef } },
      slug: { $eq: slug },
    },
    select: ['id', 'slug'],
  });
}

async function ensureJournalCategoryValid(params: { data?: GenericRecord; where?: unknown }) {
  const data = (params.data || {}) as GenericRecord;
  const existing = await loadExistingCategory(params.where);
  const requestTenantId = getRequestContextTenantId();

  if ((data.tenant === null || data.tenant === undefined || data.tenant === '') && requestTenantId) {
    data.tenant = requestTenantId;
  }

  const tenantRef = extractRelationRef(data.tenant)
    || extractEntryRelationRef(existing?.tenant)
    || requestTenantId;
  const title = hasOwn(data, 'title') ? toText(data.title) : toText(existing?.title);
  const description = hasOwn(data, 'description') ? toText(data.description) : toText(existing?.description);
  const slug = hasOwn(data, 'slug') ? toText(data.slug) : (toText(existing?.slug) || slugify(title));

  if (!tenantRef) {
    throw new errors.ApplicationError('tenant is required');
  }

  if (!title) {
    throw new errors.ApplicationError('title is required');
  }

  if (!slug) {
    throw new errors.ApplicationError('slug is required');
  }

  const siblings = await findCategoryByTenantAndSlug(tenantRef, slug);
  const ignoreId = existing?.id ? String(existing.id) : null;
  const duplicate = (siblings || []).find((item: any) => !ignoreId || String(item?.id) !== ignoreId);
  if (duplicate) {
    throw new errors.ApplicationError('tenant + slug must be unique');
  }

  data.tenant = tenantRef;
  data.title = title;
  data.slug = slug;
  data.description = description || null;
}

export default {
  async beforeCreate(event: any) {
    await ensureJournalCategoryValid({
      data: event.params?.data,
    });
  },

  async beforeUpdate(event: any) {
    await ensureJournalCategoryValid({
      data: event.params?.data,
      where: event.params?.where,
    });
  },
};