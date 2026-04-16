import { errors } from '@strapi/utils';
import { extractRelationRef, toText, whereByParam } from '../../../../utils/tenant-scope';

const ARTICLE_UID = 'api::article.article';
const CATEGORY_UID = 'api::category.category';

type GenericRecord = Record<string, unknown>;

function slugifyVietnamese(value: unknown) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[đĐ]/g, (char) => (char === 'Đ' ? 'D' : 'd'))
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-')
    .slice(0, 160)
    .replace(/-+$/g, '');
}

function getRequestContextTenantId(): number | string | null {
  const requestContext = strapi.requestContext?.get?.();
  const tenantId = requestContext?.state?.tenantId ?? requestContext?.state?.tenant?.id;
  if (tenantId === null || tenantId === undefined || tenantId === '') return null;
  return tenantId;
}

function getRequestContextArticleRef(): string | number | null {
  const requestContext = strapi.requestContext?.get?.();
  const rawId = requestContext?.params?.id;
  if (rawId === null || rawId === undefined || rawId === '') return null;
  return rawId;
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

async function loadExistingArticle(where: unknown) {
  const normalizedWhere = typeof where === 'object' && where !== null
    ? Object.fromEntries(
      Object.entries(where as Record<string, unknown>).filter(
        ([key, value]) => !(key === 'locale' && (value === '' || value === null)),
      ),
    )
    : where;

  if (!normalizedWhere) return null;

  return strapi.db.query(ARTICLE_UID).findOne({
    where: normalizedWhere,
    select: ['id', 'documentId', 'title', 'slug'],
    populate: {
      tenant: { select: ['id', 'documentId'] },
      category: {
        select: ['id', 'documentId'],
        populate: {
          tenant: { select: ['id', 'documentId'] },
        },
      },
    },
  });
}

async function resolveCurrentArticle(where: unknown) {
  const existingByWhere = await loadExistingArticle(where);
  if (existingByWhere) return existingByWhere;

  const requestArticleRef = getRequestContextArticleRef();
  if (!requestArticleRef) return null;

  return loadExistingArticle(whereByParam(requestArticleRef));
}

async function ensureCategoryTenantMatches(categoryRef: string | number, tenantRef: string | number) {
  const category = await strapi.db.query(CATEGORY_UID).findOne({
    where: whereByParam(categoryRef),
    populate: {
      tenant: { select: ['id', 'documentId'] },
    },
  });

  if (!category?.id) {
    throw new errors.ApplicationError('Selected category is invalid');
  }

  const categoryTenantRef = extractEntryRelationRef(category?.tenant);
  if (!categoryTenantRef || String(categoryTenantRef) !== String(tenantRef)) {
    throw new errors.ApplicationError('Article tenant must match category tenant');
  }
}

async function ensureTenantScopedSlugUnique(params: {
  slug: string;
  tenantRef: string | number;
  ignoreId?: number | string | null;
  ignoreDocumentId?: string | null;
}) {
  const matches = await strapi.db.query(ARTICLE_UID).findMany({
    where: {
      slug: params.slug,
      tenant: params.tenantRef,
    },
    select: ['id', 'documentId'],
  });

  const duplicate = (matches || []).find((item: any) => {
    if (String(item?.id) === String(params.ignoreId || '')) return false;
    if (params.ignoreDocumentId && String(item?.documentId || '') === String(params.ignoreDocumentId)) return false;
    return true;
  });
  if (duplicate) {
    throw new errors.ApplicationError('Article slug must be unique within the tenant');
  }
}

async function ensureArticleIsValid(params: { data?: GenericRecord; where?: unknown }) {
  const data = (params.data || {}) as GenericRecord;
  const existing = await resolveCurrentArticle(params.where);
  const requestTenantId = getRequestContextTenantId();
  const requestArticleRef = getRequestContextArticleRef();

  if ((data.tenant === null || data.tenant === undefined || data.tenant === '') && requestTenantId) {
    data.tenant = requestTenantId;
  }

  const tenantRef = extractRelationRef(data.tenant)
    || extractEntryRelationRef(existing?.tenant)
    || requestTenantId;

  if (!tenantRef) {
    throw new errors.ApplicationError('tenant is required');
  }

  data.tenant = tenantRef;

  const categoryRef = extractRelationRef(data.category) || extractEntryRelationRef(existing?.category);
  if (categoryRef) {
    await ensureCategoryTenantMatches(categoryRef, tenantRef);
  }

  const title = toText(data.title ?? existing?.title);
  const slug = slugifyVietnamese(toText(data.slug) || title || existing?.slug);
  if (slug) {
    data.slug = slug;
    await ensureTenantScopedSlugUnique({
      slug,
      tenantRef,
      ignoreId: existing?.id ?? null,
      ignoreDocumentId: toText(existing?.documentId) || toText(requestArticleRef) || null,
    });
  }
}

export default {
  async beforeCreate(event: any) {
    await ensureArticleIsValid({
      data: event.params?.data,
    });
  },

  async beforeUpdate(event: any) {
    await ensureArticleIsValid({
      data: event.params?.data,
      where: event.params?.where,
    });
  },
};