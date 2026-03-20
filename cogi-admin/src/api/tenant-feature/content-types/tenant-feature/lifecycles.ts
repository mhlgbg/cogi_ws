import { errors } from '@strapi/utils';
import { buildTenantFeatureLabel } from '../../utils/build-tenant-feature-label';

const TENANT_FEATURE_UID = 'api::tenant-feature.tenant-feature';

type GenericRecord = Record<string, unknown>;

type RelationRef = string | number | null;

function extractRelationRef(value: unknown): RelationRef {
  if (value === null || value === undefined) return null;

  if (typeof value === 'string' || typeof value === 'number') {
    return value;
  }

  if (typeof value !== 'object') return null;

  const relation = value as {
    id?: number | string;
    documentId?: string;
    connect?: Array<{ id?: number | string; documentId?: string } | number | string> | { id?: number | string; documentId?: string };
    set?: Array<{ id?: number | string; documentId?: string } | number | string> | { id?: number | string; documentId?: string };
  };

  if (relation.id !== undefined) return relation.id;
  if (relation.documentId) return relation.documentId;

  const relationCandidates = [relation.connect, relation.set];
  for (const candidate of relationCandidates) {
    if (Array.isArray(candidate) && candidate.length > 0) {
      const first = candidate[0] as { id?: number | string; documentId?: string } | number | string;
      if (typeof first === 'string' || typeof first === 'number') return first;
      if (first?.id !== undefined) return first.id;
      if (first?.documentId) return first.documentId;
    }

    if (candidate && typeof candidate === 'object') {
      const obj = candidate as { id?: number | string; documentId?: string };
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

  const relation = value as { id?: number | string; documentId?: string };
  if (relation.id !== undefined) return relation.id;
  if (relation.documentId) return relation.documentId;

  return null;
}

async function loadExistingEntry(where: unknown) {
  if (!where) return null;

  const normalizedWhere = typeof where === 'object' && where !== null
    ? Object.fromEntries(
      Object.entries(where as Record<string, unknown>).filter(
        ([key, value]) => !(key === 'locale' && (value === '' || value === null)),
      ),
    )
    : where;

  return strapi.db.query(TENANT_FEATURE_UID).findOne({
    where: normalizedWhere,
    populate: ['tenant', 'feature'],
  });
}

async function ensureUniqueTenantFeature(params: {
  data?: GenericRecord;
  existingEntry?: any;
  ignoreId?: number | string | null;
}) {
  const tenantRef = extractRelationRef(params.data?.tenant) ?? extractEntryRelationRef(params.existingEntry?.tenant);
  const featureRef = extractRelationRef(params.data?.feature) ?? extractEntryRelationRef(params.existingEntry?.feature);

  if (!tenantRef || !featureRef) return;

  const mappings = await strapi.db.query(TENANT_FEATURE_UID).findMany({
    populate: ['tenant', 'feature'],
  });

  const duplicate = (mappings || []).find((item: any) => {
    if (params.ignoreId && String(item?.id) === String(params.ignoreId)) {
      return false;
    }

    const existingTenantRef = extractEntryRelationRef(item?.tenant);
    const existingFeatureRef = extractEntryRelationRef(item?.feature);

    return String(existingTenantRef) === String(tenantRef) && String(existingFeatureRef) === String(featureRef);
  });

  if (duplicate) {
    throw new errors.ApplicationError('Tenant-feature mapping already exists');
  }
}

async function assignLabel(event: any) {
  const data = (event.params?.data || {}) as GenericRecord;

  data.label = await buildTenantFeatureLabel({
    data,
    where: event.params?.where,
  });
}

export default {
  async beforeCreate(event: any) {
    await ensureUniqueTenantFeature({
      data: event.params?.data,
    });

    await assignLabel(event);
  },

  async beforeUpdate(event: any) {
    const existingEntry = await loadExistingEntry(event.params?.where);

    await ensureUniqueTenantFeature({
      data: event.params?.data,
      existingEntry,
      ignoreId: existingEntry?.id ?? null,
    });

    await assignLabel(event);
  },
};
