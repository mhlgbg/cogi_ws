import { errors } from '@strapi/utils';
import { extractRelationRef, hasOwn, toText } from '../../../../utils/tenant-scope';

const FILE_ASSET_UID = 'api::file-asset.file-asset';
const TENANT_STORAGE_UID = 'api::tenant-storage.tenant-storage';
const PROVIDER_VALUES = new Set(['local', 's3', 'minio', 'wasabi', 'azure', 'gcs']);
const STATUS_VALUES = new Set(['ACTIVE', 'DELETED', 'ARCHIVED']);

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

  const relation = value as { id?: string | number; documentId?: string };
  if (relation.id !== undefined) return relation.id;
  if (relation.documentId) return relation.documentId;
  return null;
}

function normalizeWhere(where: unknown) {
  if (typeof where !== 'object' || where === null) return where;

  return Object.fromEntries(
    Object.entries(where as Record<string, unknown>).filter(
      ([key, value]) => !(key === 'locale' && (value === '' || value === null)),
    ),
  );
}

async function loadExistingFileAsset(where: unknown) {
  const normalizedWhere = normalizeWhere(where);
  if (!normalizedWhere) return null;

  return strapi.db.query(FILE_ASSET_UID).findOne({
    where: normalizedWhere,
    populate: {
      tenant: { select: ['id', 'documentId'] },
      storageConfig: { select: ['id', 'documentId'] },
      uploadedBy: { select: ['id', 'documentId'] },
    },
  });
}

function parseNonNegativeInteger(value: unknown): number | null {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : null;
}

function normalizeNonNegativeBigInteger(value: unknown, fieldName: string): string {
  if (value === null || value === undefined || value === '') return '0';

  const text = toText(value);
  if (!/^\d+$/.test(text)) {
    throw new errors.ApplicationError(`${fieldName} must be a non-negative integer`);
  }

  return text;
}

function validateLogicalPath(value: string, fieldName: string) {
  if (!value) {
    throw new errors.ApplicationError(`${fieldName} is required`);
  }

  if (/^[A-Za-z]:[\\/]/.test(value)) {
    throw new errors.ApplicationError(`${fieldName} must not start with an absolute drive path`);
  }

  if (value.includes('../') || value.includes('..\\')) {
    throw new errors.ApplicationError(`${fieldName} must not contain directory traversal segments`);
  }
}

function formatTimestamp(date: Date): string {
  const year = String(date.getFullYear());
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const seconds = String(date.getSeconds()).padStart(2, '0');
  return `${year}${month}${day}_${hours}${minutes}${seconds}`;
}

function createRandomCodeSuffix(length = 6): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let result = '';
  for (let index = 0; index < length; index += 1) {
    result += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return result;
}

async function generateUniqueFileAssetCode(): Promise<string> {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const candidate = `FIL_${formatTimestamp(new Date())}_${createRandomCodeSuffix()}`;
    const existing = await strapi.db.query(FILE_ASSET_UID).findOne({
      where: { code: { $eq: candidate } },
      select: ['id'],
    });

    if (!existing?.id) {
      return candidate;
    }
  }

  throw new errors.ApplicationError('Unable to generate a unique file asset code');
}

async function assertStorageConfigBelongsToTenant(storageConfigRef: string | number | null, tenantRef: string | number | null) {
  if (!storageConfigRef) return;
  if (!tenantRef) {
    throw new errors.ApplicationError('tenant is required when storageConfig is provided');
  }

  const storageConfig = await strapi.db.query(TENANT_STORAGE_UID).findOne({
    where: {
      id: storageConfigRef,
      tenant: {
        id: {
          $eq: tenantRef,
        },
      },
    },
    select: ['id'],
  });

  if (!storageConfig?.id) {
    throw new errors.ApplicationError('storageConfig must belong to the same tenant');
  }
}

async function syncTenantShadowColumn(id: unknown, tenantRef: string | number | null) {
  if (!id || !tenantRef) return;

  const knex = strapi.db.connection;
  const hasTable = await knex.schema.hasTable('file_assets');
  if (!hasTable) return;

  const hasTenantIdColumn = await knex.schema.hasColumn('file_assets', 'tenant_id');
  if (!hasTenantIdColumn) return;

  await knex('file_assets').where({ id }).update({ tenant_id: tenantRef });
}

async function normalizeAndValidateFileAsset(params: { data?: GenericRecord; where?: unknown; isCreate: boolean }) {
  const data = (params.data || {}) as GenericRecord;
  const existing = await loadExistingFileAsset(params.where);
  const requestTenantId = getRequestContextTenantId();

  if ((data.tenant === null || data.tenant === undefined || data.tenant === '') && requestTenantId) {
    data.tenant = requestTenantId;
  }

  const tenantRef = extractRelationRef(data.tenant)
    || extractEntryRelationRef(existing?.tenant)
    || requestTenantId;
  const storageConfigRef = hasOwn(data, 'storageConfig')
    ? extractRelationRef(data.storageConfig)
    : extractEntryRelationRef(existing?.storageConfig);
  const uploadedByRef = hasOwn(data, 'uploadedBy')
    ? extractRelationRef(data.uploadedBy)
    : extractEntryRelationRef(existing?.uploadedBy);

  const moduleKey = hasOwn(data, 'moduleKey') ? toText(data.moduleKey) : toText(existing?.moduleKey);
  const originalName = hasOwn(data, 'originalName') ? toText(data.originalName) : toText(existing?.originalName);
  const fileName = hasOwn(data, 'fileName') ? toText(data.fileName) : toText(existing?.fileName);
  const entityType = hasOwn(data, 'entityType') ? toText(data.entityType) : toText(existing?.entityType);
  const entityId = hasOwn(data, 'entityId') ? toText(data.entityId) : toText(existing?.entityId);
  const extension = hasOwn(data, 'extension') ? toText(data.extension) : toText(existing?.extension);
  const mimeType = hasOwn(data, 'mimeType') ? toText(data.mimeType) : toText(existing?.mimeType);
  const relativePath = hasOwn(data, 'relativePath') ? toText(data.relativePath) : toText(existing?.relativePath);
  const url = hasOwn(data, 'url') ? toText(data.url) : toText(existing?.url);
  const checksum = hasOwn(data, 'checksum') ? toText(data.checksum) : toText(existing?.checksum);
  const code = hasOwn(data, 'code') ? toText(data.code) : toText(existing?.code);
  const provider = (hasOwn(data, 'provider') ? toText(data.provider) : toText(existing?.provider) || 'local').toLowerCase();
  const status = (hasOwn(data, 'status') ? toText(data.status) : toText(existing?.status) || 'ACTIVE').toUpperCase();
  const metadata = hasOwn(data, 'metadata') ? data.metadata : existing?.metadata;
  const lastAccessAt = hasOwn(data, 'lastAccessAt') ? data.lastAccessAt : existing?.lastAccessAt;
  const downloadCountRaw = hasOwn(data, 'downloadCount') ? data.downloadCount : existing?.downloadCount;
  const isPublicRaw = hasOwn(data, 'isPublic') ? data.isPublic : existing?.isPublic;
  const isDeletedRaw = hasOwn(data, 'isDeleted') ? data.isDeleted : existing?.isDeleted;
  const sizeRaw = hasOwn(data, 'size') ? data.size : existing?.size;

  if (!tenantRef) {
    throw new errors.ApplicationError('tenant is required');
  }
  if (!moduleKey) {
    throw new errors.ApplicationError('moduleKey is required');
  }
  if (!originalName) {
    throw new errors.ApplicationError('originalName is required');
  }
  if (!fileName) {
    throw new errors.ApplicationError('fileName is required');
  }
  if (!relativePath) {
    throw new errors.ApplicationError('relativePath is required');
  }
  if (!url) {
    throw new errors.ApplicationError('url is required');
  }

  validateLogicalPath(relativePath, 'relativePath');
  validateLogicalPath(url, 'url');

  const size = normalizeNonNegativeBigInteger(sizeRaw, 'size');
  const downloadCount = downloadCountRaw === undefined || downloadCountRaw === null || downloadCountRaw === ''
    ? 0
    : parseNonNegativeInteger(downloadCountRaw);
  if (downloadCount === null) {
    throw new errors.ApplicationError('downloadCount must be a non-negative integer');
  }

  const isPublic = isPublicRaw === undefined || isPublicRaw === null ? true : Boolean(isPublicRaw);
  let isDeleted = isDeletedRaw === undefined || isDeletedRaw === null ? false : Boolean(isDeletedRaw);
  let nextStatus = status || 'ACTIVE';

  if (!PROVIDER_VALUES.has(provider)) {
    throw new errors.ApplicationError(`provider must be one of: ${Array.from(PROVIDER_VALUES).join(', ')}`);
  }
  if (!STATUS_VALUES.has(nextStatus)) {
    throw new errors.ApplicationError(`status must be one of: ${Array.from(STATUS_VALUES).join(', ')}`);
  }

  if (params.isCreate && !code) {
    data.code = await generateUniqueFileAssetCode();
  } else if (code) {
    data.code = code;
  }

  if (!params.isCreate && nextStatus === 'DELETED') {
    isDeleted = true;
  }
  if (!params.isCreate && isDeleted === true && nextStatus !== 'DELETED') {
    nextStatus = 'DELETED';
  }

  await assertStorageConfigBelongsToTenant(storageConfigRef, tenantRef);

  data.tenant = tenantRef;
  data.storageConfig = storageConfigRef || null;
  data.uploadedBy = uploadedByRef || null;
  data.moduleKey = moduleKey;
  data.entityType = entityType || null;
  data.entityId = entityId || null;
  data.originalName = originalName;
  data.fileName = fileName;
  data.extension = extension || null;
  data.mimeType = mimeType || null;
  data.size = size;
  data.provider = provider;
  data.relativePath = relativePath;
  data.url = url;
  data.checksum = checksum || null;
  data.downloadCount = downloadCount;
  data.lastAccessAt = lastAccessAt || null;
  data.status = nextStatus;
  data.metadata = metadata ?? null;
  data.isPublic = isPublic;
  data.isDeleted = isDeleted;
  await syncTenantShadowColumn(existing?.id, tenantRef);
}

export default {
  async beforeCreate(event: any) {
    await normalizeAndValidateFileAsset({
      data: event.params?.data,
      isCreate: true,
    });
  },

  async beforeUpdate(event: any) {
    await normalizeAndValidateFileAsset({
      data: event.params?.data,
      where: event.params?.where,
      isCreate: false,
    });
  },

  async afterCreate(event: any) {
    const tenantRef = extractRelationRef(event.params?.data?.tenant) || getRequestContextTenantId();
    await syncTenantShadowColumn(event.result?.id, tenantRef);
  },

  async afterUpdate(event: any) {
    const tenantRef = extractRelationRef(event.params?.data?.tenant)
      || extractEntryRelationRef(event.result?.tenant)
      || getRequestContextTenantId();
    await syncTenantShadowColumn(event.result?.id, tenantRef);
  },
};