import { buildLabel, pickDisplayValue } from '../../../utils/label-builder';

const TENANT_UID = 'api::tenant.tenant';
const FEATURE_UID = 'api::feature.feature';
const TENANT_FEATURE_UID = 'api::tenant-feature.tenant-feature';

const TENANT_PRIORITY_FIELDS = ['name', 'code', 'id', 'documentId'];
const FEATURE_PRIORITY_FIELDS = ['name', 'key', 'id', 'documentId'];

const UNKNOWN_TENANT = 'Unknown Tenant';
const UNKNOWN_FEATURE = 'Unknown Feature';

type GenericRecord = Record<string, unknown>;

type RelationRef = {
  id?: number | string;
  documentId?: string;
};

function isPlainObject(value: unknown): value is GenericRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function hasOwn(data: GenericRecord, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(data, key);
}

function parseRelationRef(value: unknown): RelationRef | null {
  if (value === null || value === undefined) return null;

  if (typeof value === 'number') {
    return { id: value };
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return null;

    if (/^\d+$/.test(trimmed)) {
      return { id: Number(trimmed) };
    }

    return { documentId: trimmed };
  }

  if (!isPlainObject(value)) return null;

  if (value.id !== undefined || typeof value.documentId === 'string') {
    return {
      id: value.id as number | string | undefined,
      documentId: (value.documentId as string | undefined) || undefined,
    };
  }

  const connect = value.connect;
  if (Array.isArray(connect) && connect.length > 0) {
    return parseRelationRef(connect[0]);
  }

  if (isPlainObject(connect)) {
    return parseRelationRef(connect);
  }

  const set = value.set;
  if (Array.isArray(set) && set.length > 0) {
    return parseRelationRef(set[0]);
  }

  if (isPlainObject(set)) {
    return parseRelationRef(set);
  }

  return null;
}

function canUseAsDisplaySource(value: unknown, priorityFields: string[]): boolean {
  if (!isPlainObject(value)) return false;

  const display = pickDisplayValue(value, priorityFields, '');
  return Boolean(display && display.trim());
}

async function findTenantByRef(ref: RelationRef | null): Promise<GenericRecord | null> {
  if (!ref) return null;

  const select = ['id', 'name', 'code'];

  if (ref.id !== undefined) {
    const byId = await strapi.db.query(TENANT_UID).findOne({
      where: { id: ref.id },
      select,
    });

    if (byId) return byId as GenericRecord;
  }

  if (ref.documentId) {
    const byDocumentId = await strapi.db.query(TENANT_UID).findOne({
      where: { documentId: ref.documentId },
      select,
    });

    if (byDocumentId) return byDocumentId as GenericRecord;
  }

  return null;
}

async function findFeatureByRef(ref: RelationRef | null): Promise<GenericRecord | null> {
  if (!ref) return null;

  const select = ['id', 'name', 'key'];

  if (ref.id !== undefined) {
    const byId = await strapi.db.query(FEATURE_UID).findOne({
      where: { id: ref.id },
      select,
    });

    if (byId) return byId as GenericRecord;
  }

  if (ref.documentId) {
    const byDocumentId = await strapi.db.query(FEATURE_UID).findOne({
      where: { documentId: ref.documentId },
      select,
    });

    if (byDocumentId) return byDocumentId as GenericRecord;
  }

  return null;
}

async function findExistingTenantFeature(where: unknown): Promise<GenericRecord | null> {
  if (!where) return null;

  const normalizedWhere = isPlainObject(where)
    ? Object.fromEntries(
      Object.entries(where).filter(([key, value]) => !(key === 'locale' && (value === '' || value === null))),
    )
    : where;

  const existing = await strapi.db.query(TENANT_FEATURE_UID).findOne({
    where: normalizedWhere,
    populate: {
      tenant: {
        select: ['id', 'name', 'code'],
      },
      feature: {
        select: ['id', 'name', 'key'],
      },
    },
  });

  return (existing as GenericRecord | null) || null;
}

async function resolveTenantDisplaySource(data: GenericRecord, existing: GenericRecord | null): Promise<unknown> {
  if (hasOwn(data, 'tenant')) {
    const relationInput = data.tenant;

    if (canUseAsDisplaySource(relationInput, TENANT_PRIORITY_FIELDS)) {
      return relationInput;
    }

    const fromInput = await findTenantByRef(parseRelationRef(relationInput));
    if (fromInput) return fromInput;
  }

  const existingTenant = existing?.tenant;
  if (canUseAsDisplaySource(existingTenant, TENANT_PRIORITY_FIELDS)) {
    return existingTenant;
  }

  return findTenantByRef(parseRelationRef(existingTenant));
}

async function resolveFeatureDisplaySource(data: GenericRecord, existing: GenericRecord | null): Promise<unknown> {
  if (hasOwn(data, 'feature')) {
    const relationInput = data.feature;

    if (canUseAsDisplaySource(relationInput, FEATURE_PRIORITY_FIELDS)) {
      return relationInput;
    }

    const fromInput = await findFeatureByRef(parseRelationRef(relationInput));
    if (fromInput) return fromInput;
  }

  const existingFeature = existing?.feature;
  if (canUseAsDisplaySource(existingFeature, FEATURE_PRIORITY_FIELDS)) {
    return existingFeature;
  }

  return findFeatureByRef(parseRelationRef(existingFeature));
}

export async function buildTenantFeatureLabel(params: {
  data?: GenericRecord;
  where?: unknown;
}): Promise<string> {
  const data = (params.data || {}) as GenericRecord;
  const existing = await findExistingTenantFeature(params.where);

  const tenantSource = await resolveTenantDisplaySource(data, existing);
  const featureSource = await resolveFeatureDisplaySource(data, existing);

  return buildLabel(
    [
      {
        value: tenantSource,
        priorityFields: TENANT_PRIORITY_FIELDS,
        fallback: UNKNOWN_TENANT,
      },
      {
        value: featureSource,
        priorityFields: FEATURE_PRIORITY_FIELDS,
        fallback: UNKNOWN_FEATURE,
      },
    ],
    {
      separator: ' - ',
      fallback: `${UNKNOWN_TENANT} - ${UNKNOWN_FEATURE}`,
    },
  );
}
