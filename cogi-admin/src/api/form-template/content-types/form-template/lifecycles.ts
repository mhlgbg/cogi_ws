import { errors } from '@strapi/utils';

const FORM_TEMPLATE_UID = 'api::form-template.form-template';

type RelationRef = string | number | null;
type GenericRecord = Record<string, unknown>;

function extractRelationRef(value: unknown): RelationRef {
  if (value === null || value === undefined) return null;
  if (typeof value === 'string' || typeof value === 'number') return value;
  if (typeof value !== 'object') return null;

  const relation = value as {
    id?: string | number;
    documentId?: string;
    connect?: Array<{ id?: string | number; documentId?: string } | string | number> | { id?: string | number; documentId?: string };
    set?: Array<{ id?: string | number; documentId?: string } | string | number> | { id?: string | number; documentId?: string };
  };

  if (relation.id !== undefined) return relation.id;
  if (relation.documentId) return relation.documentId;

  const candidates = [relation.connect, relation.set];
  for (const candidate of candidates) {
    if (Array.isArray(candidate) && candidate.length > 0) {
      const first = candidate[0] as { id?: string | number; documentId?: string } | string | number;
      if (typeof first === 'string' || typeof first === 'number') return first;
      if (first?.id !== undefined) return first.id;
      if (first?.documentId) return first.documentId;
    }

    if (candidate && typeof candidate === 'object') {
      const obj = candidate as { id?: string | number; documentId?: string };
      if (obj.id !== undefined) return obj.id;
      if (obj.documentId) return obj.documentId;
    }
  }

  return null;
}

function extractEntryRelationRef(value: unknown): RelationRef {
  if (value === null || value === undefined) return null;
  if (typeof value === 'string' || typeof value === 'number') return value;
  if (typeof value !== 'object') return null;

  const relation = value as { id?: string | number; documentId?: string };
  if (relation.id !== undefined) return relation.id;
  if (relation.documentId) return relation.documentId;
  return null;
}

function toText(value: unknown): string {
  if (value === null || value === undefined) return '';
  return String(value).trim();
}

function toVersion(value: unknown): number {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1) {
    throw new errors.ApplicationError('version must be an integer greater than or equal to 1');
  }
  return parsed;
}

function hasOwn(data: GenericRecord, key: string) {
  return Object.prototype.hasOwnProperty.call(data, key);
}

async function loadExistingEntry(where: unknown) {
  const id = (where as { id?: string | number } | undefined)?.id;
  if (!id) return null;

  return strapi.db.query(FORM_TEMPLATE_UID).findOne({
    where: { id },
    populate: { tenant: { select: ['id'] } },
  });
}

async function findTemplatesByTenantAndName(tenantRef: string | number, name: string) {
  return strapi.db.query(FORM_TEMPLATE_UID).findMany({
    where: {
      tenant: { id: { $eq: tenantRef } },
      name: { $eq: name },
    },
    populate: { tenant: { select: ['id'] } },
    select: ['id', 'name', 'version', 'isLocked'],
  });
}

async function ensureFormTemplateValid(params: { data?: GenericRecord; where?: unknown }) {
  const data = params.data || {};
  const existing = await loadExistingEntry(params.where);

  const tenantRef = extractRelationRef(data.tenant) ?? extractEntryRelationRef(existing?.tenant);
  const name = hasOwn(data, 'name') ? toText(data.name) : toText(existing?.name);
  const version = hasOwn(data, 'version') ? toVersion(data.version) : toVersion(existing?.version);
  const isLocked = hasOwn(data, 'isLocked') ? Boolean(data.isLocked) : Boolean(existing?.isLocked);

  if (!tenantRef) {
    throw new errors.ApplicationError('tenant is required');
  }

  if (!name) {
    throw new errors.ApplicationError('name is required');
  }

  if (!existing && !hasOwn(data, 'schema')) {
    throw new errors.ApplicationError('schema is required');
  }

  if (existing?.isLocked && hasOwn(data, 'schema')) {
    const nextSchema = JSON.stringify(data.schema ?? null);
    const currentSchema = JSON.stringify(existing?.schema ?? null);
    if (nextSchema !== currentSchema) {
      throw new errors.ApplicationError('schema cannot be modified when isLocked is true');
    }
  }

  const siblings = await findTemplatesByTenantAndName(tenantRef, name);
  const ignoreId = existing?.id ? String(existing.id) : null;

  const duplicate = (siblings || []).find((item: any) => {
    if (ignoreId && String(item?.id) === ignoreId) return false;
    return Number(item?.version) === version;
  });

  if (duplicate) {
    throw new errors.ApplicationError('tenant + name + version must be unique');
  }

  const maxSiblingVersion = (siblings || []).reduce((max: number, item: any) => {
    if (ignoreId && String(item?.id) === ignoreId) return max;
    const current = Number(item?.version || 0);
    return current > max ? current : max;
  }, 0);

  const originalIdentity = existing
    ? {
        tenantRef: extractEntryRelationRef(existing?.tenant),
        name: toText(existing?.name),
        version: Number(existing?.version || 0),
      }
    : null;

  const isSameIdentity = originalIdentity
    && String(originalIdentity.tenantRef || '') === String(tenantRef)
    && originalIdentity.name === name
    && originalIdentity.version === version;

  if (!isSameIdentity && maxSiblingVersion > 0 && version <= maxSiblingVersion) {
    throw new errors.ApplicationError(`version must be greater than existing max version ${maxSiblingVersion} for this tenant and name`);
  }

  data.name = name;
  data.version = version;
  data.isLocked = isLocked;

  if (hasOwn(data, 'status')) {
    const status = toText(data.status).toLowerCase();
    data.status = ['published', 'archived'].includes(status) ? status : 'draft';
  }
}

export default {
  async beforeCreate(event: any) {
    await ensureFormTemplateValid({ data: event.params?.data });
  },

  async beforeUpdate(event: any) {
    await ensureFormTemplateValid({ data: event.params?.data, where: event.params?.where });
  },
};