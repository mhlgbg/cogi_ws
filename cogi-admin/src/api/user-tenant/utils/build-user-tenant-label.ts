import { buildLabel, pickDisplayValue } from '../../../utils/label-builder';

const USER_UID = 'plugin::users-permissions.user';
const TENANT_UID = 'api::tenant.tenant';
const USER_TENANT_UID = 'api::user-tenant.user-tenant';

const USER_PRIORITY_FIELDS = ['email', 'username', 'fullName', 'id', 'documentId'];
const TENANT_PRIORITY_FIELDS = ['name', 'code', 'title', 'id', 'documentId'];

const UNKNOWN_USER = 'Unknown User';
const UNKNOWN_TENANT = 'Unknown Tenant';

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

async function findUserByRef(ref: RelationRef | null): Promise<GenericRecord | null> {
  if (!ref) return null;

  const select = ['id', 'email', 'username', 'fullName'];

  if (ref.id !== undefined) {
    const byId = await strapi.db.query(USER_UID).findOne({
      where: { id: ref.id },
      select,
    });
    if (byId) return byId as GenericRecord;
  }

  if (ref.documentId) {
    try {
      const byDocumentId = await strapi.db.query(USER_UID).findOne({
        where: { documentId: ref.documentId },
        select,
      });
      if (byDocumentId) return byDocumentId as GenericRecord;
    } catch {
      return null;
    }
  }

  return null;
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

async function findExistingUserTenant(where: unknown): Promise<GenericRecord | null> {
  if (!where) return null;

  const normalizedWhere = isPlainObject(where)
    ? Object.fromEntries(
      Object.entries(where).filter(([key, value]) => !(key === 'locale' && (value === '' || value === null))),
    )
    : where;

  const existing = await strapi.db.query(USER_TENANT_UID).findOne({
    where: normalizedWhere,
    populate: {
      user: {
        select: ['id', 'email', 'username', 'fullName'],
      },
      tenant: {
        select: ['id', 'name', 'code'],
      },
    },
  });

  return (existing as GenericRecord | null) || null;
}

async function resolveUserDisplaySource(data: GenericRecord, existing: GenericRecord | null): Promise<unknown> {
  if (hasOwn(data, 'user')) {
    const relationInput = data.user;

    if (canUseAsDisplaySource(relationInput, USER_PRIORITY_FIELDS)) {
      return relationInput;
    }

    const fromInput = await findUserByRef(parseRelationRef(relationInput));
    if (fromInput) return fromInput;
  }

  const existingUser = existing?.user;
  if (canUseAsDisplaySource(existingUser, USER_PRIORITY_FIELDS)) {
    return existingUser;
  }

  return findUserByRef(parseRelationRef(existingUser));
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

export async function buildUserTenantLabel(params: {
  data?: GenericRecord;
  where?: unknown;
}): Promise<string> {
  const data = (params.data || {}) as GenericRecord;
  const existing = await findExistingUserTenant(params.where);

  const userSource = await resolveUserDisplaySource(data, existing);
  const tenantSource = await resolveTenantDisplaySource(data, existing);

  return buildLabel(
    [
      {
        value: userSource,
        priorityFields: USER_PRIORITY_FIELDS,
        fallback: UNKNOWN_USER,
      },
      {
        value: tenantSource,
        priorityFields: TENANT_PRIORITY_FIELDS,
        fallback: UNKNOWN_TENANT,
      },
    ],
    {
      separator: ' - ',
      fallback: `${UNKNOWN_USER} - ${UNKNOWN_TENANT}`,
    },
  );
}
