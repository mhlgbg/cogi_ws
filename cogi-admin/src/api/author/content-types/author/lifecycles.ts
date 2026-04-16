import { errors } from '@strapi/utils';
import { extractRelationRef } from '../../../../utils/tenant-scope';

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

async function loadExistingAuthor(where: unknown) {
  const normalizedWhere = typeof where === 'object' && where !== null
    ? Object.fromEntries(
      Object.entries(where as Record<string, unknown>).filter(
        ([key, value]) => !(key === 'locale' && (value === '' || value === null)),
      ),
    )
    : where;

  if (!normalizedWhere) return null;

  return strapi.db.query('api::author.author').findOne({
    where: normalizedWhere,
    populate: {
      tenant: { select: ['id', 'documentId'] },
    },
  });
}

async function ensureAuthorIsValid(params: { data?: GenericRecord; where?: unknown }) {
  const data = (params.data || {}) as GenericRecord;
  const existing = await loadExistingAuthor(params.where);
  const requestTenantId = getRequestContextTenantId();

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
}

export default {
  async beforeCreate(event: any) {
    await ensureAuthorIsValid({
      data: event.params?.data,
    });
  },

  async beforeUpdate(event: any) {
    await ensureAuthorIsValid({
      data: event.params?.data,
      where: event.params?.where,
    });
  },
};