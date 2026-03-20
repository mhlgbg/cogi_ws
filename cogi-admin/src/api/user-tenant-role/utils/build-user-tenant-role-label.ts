import { buildLabel, pickDisplayValue } from '../../../utils/label-builder';

const USER_TENANT_ROLE_UID = 'api::user-tenant-role.user-tenant-role';
const USER_TENANT_UID = 'api::user-tenant.user-tenant';
const ROLE_UID = 'plugin::users-permissions.role';

const USER_PRIORITY_FIELDS = ['email', 'username', 'fullName', 'id', 'documentId'];
const TENANT_PRIORITY_FIELDS = ['name', 'code', 'title', 'id', 'documentId'];
const ROLE_PRIORITY_FIELDS = ['name', 'title', 'code', 'label', 'id', 'documentId'];

const UNKNOWN_USER = 'Unknown User';
const UNKNOWN_TENANT = 'Unknown Tenant';
const UNKNOWN_USER_TENANT = 'Unknown UserTenant';
const UNKNOWN_ROLE = 'Unknown Role';

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

function buildUserTenantDisplay(source: unknown): string {
  if (!source) return UNKNOWN_USER_TENANT;

  const explicitLabel = pickDisplayValue(source, ['label'], '');
  if (explicitLabel) return explicitLabel;

  if (!isPlainObject(source)) {
    return UNKNOWN_USER_TENANT;
  }

  const userDisplay = pickDisplayValue(source.user, USER_PRIORITY_FIELDS, UNKNOWN_USER);
  const tenantDisplay = pickDisplayValue(source.tenant, TENANT_PRIORITY_FIELDS, UNKNOWN_TENANT);

  return buildLabel([
    { value: userDisplay, fallback: UNKNOWN_USER },
    { value: tenantDisplay, fallback: UNKNOWN_TENANT },
  ], {
    separator: ' - ',
    fallback: UNKNOWN_USER_TENANT,
  });
}

async function findUserTenantByRef(ref: RelationRef | null): Promise<GenericRecord | null> {
  if (!ref) return null;

  const populate = {
    user: {
      select: ['id', 'email', 'username', 'fullName'],
    },
    tenant: {
      select: ['id', 'name', 'code'],
    },
  };

  if (ref.id !== undefined) {
    const byId = await strapi.db.query(USER_TENANT_UID).findOne({
      where: { id: ref.id },
      select: ['id', 'label'],
      populate,
    });

    if (byId) return byId as GenericRecord;
  }

  if (ref.documentId) {
    const byDocumentId = await strapi.db.query(USER_TENANT_UID).findOne({
      where: { documentId: ref.documentId },
      select: ['id', 'label'],
      populate,
    });

    if (byDocumentId) return byDocumentId as GenericRecord;
  }

  return null;
}

async function findRoleByRef(ref: RelationRef | null): Promise<GenericRecord | null> {
  if (!ref) return null;

  const select = ['id', 'name'];

  if (ref.id !== undefined) {
    const byId = await strapi.db.query(ROLE_UID).findOne({
      where: { id: ref.id },
      select,
    });

    if (byId) return byId as GenericRecord;
  }

  if (ref.documentId) {
    try {
      const byDocumentId = await strapi.db.query(ROLE_UID).findOne({
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

async function findExistingUserTenantRole(where: unknown): Promise<GenericRecord | null> {
  if (!where) return null;

  const normalizedWhere = isPlainObject(where)
    ? Object.fromEntries(
      Object.entries(where).filter(([key, value]) => !(key === 'locale' && (value === '' || value === null))),
    )
    : where;

  const existing = await strapi.db.query(USER_TENANT_ROLE_UID).findOne({
    where: normalizedWhere,
    populate: {
      userTenant: {
        select: ['id', 'label'],
        populate: {
          user: {
            select: ['id', 'email', 'username', 'fullName'],
          },
          tenant: {
            select: ['id', 'name', 'code'],
          },
        },
      },
      role: {
        select: ['id', 'name'],
      },
    },
  });

  return (existing as GenericRecord | null) || null;
}

async function resolveUserTenantSource(data: GenericRecord, existing: GenericRecord | null): Promise<unknown> {
  if (hasOwn(data, 'userTenant')) {
    const relationInput = data.userTenant;

    if (canUseAsDisplaySource(relationInput, ['label'])) {
      return relationInput;
    }

    const fromInput = await findUserTenantByRef(parseRelationRef(relationInput));
    if (fromInput) return fromInput;
  }

  const existingUserTenant = existing?.userTenant;
  if (existingUserTenant) return existingUserTenant;

  return findUserTenantByRef(parseRelationRef(existingUserTenant));
}

async function resolveRoleSource(data: GenericRecord, existing: GenericRecord | null): Promise<unknown> {
  if (hasOwn(data, 'role')) {
    const relationInput = data.role;

    if (canUseAsDisplaySource(relationInput, ROLE_PRIORITY_FIELDS)) {
      return relationInput;
    }

    const fromInput = await findRoleByRef(parseRelationRef(relationInput));
    if (fromInput) return fromInput;
  }

  const existingRole = existing?.role;
  if (canUseAsDisplaySource(existingRole, ROLE_PRIORITY_FIELDS)) {
    return existingRole;
  }

  return findRoleByRef(parseRelationRef(existingRole));
}

export async function buildUserTenantRoleLabel(params: {
  data?: GenericRecord;
  where?: unknown;
}): Promise<string> {
  const data = (params.data || {}) as GenericRecord;
  const existing = await findExistingUserTenantRole(params.where);

  const userTenantSource = await resolveUserTenantSource(data, existing);
  const roleSource = await resolveRoleSource(data, existing);

  const userTenantDisplay = buildUserTenantDisplay(userTenantSource);
  const roleDisplay = pickDisplayValue(roleSource, ROLE_PRIORITY_FIELDS, UNKNOWN_ROLE);

  return buildLabel(
    [
      { value: userTenantDisplay, fallback: UNKNOWN_USER_TENANT },
      { value: roleDisplay, fallback: UNKNOWN_ROLE },
    ],
    {
      separator: ' - ',
      fallback: `${UNKNOWN_USER_TENANT} - ${UNKNOWN_ROLE}`,
    },
  );
}
