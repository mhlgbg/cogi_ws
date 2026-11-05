import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import mime from 'mime-types';
import { S3Client, GetObjectCommand, PutObjectCommand, HeadBucketCommand, HeadObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { extractRelationRef, toText } from '../utils/tenant-scope';

const FILE_ASSET_UID = 'api::file-asset.file-asset';
const TENANT_STORAGE_UID = 'api::tenant-storage.tenant-storage';
const DEFAULT_ALLOWED_CREDENTIAL_REFS = ['VIETTEL_OBJECT_STORAGE', 'VIETTEL_S3_CREDENTIALS', 'STORAGE_S3_CREDENTIALS'];

type UploadedFileLike = {
  filepath?: string;
  path?: string;
  tempFilePath?: string;
  originalFilename?: string;
  newFilename?: string;
  mimetype?: string;
  type?: string;
  size?: number;
  name?: string;
};

type UploadLocalFileOptions = {
  tenant: {
    id?: number | string | null;
    code?: string | null;
    storageDefaultConfigId?: number | string | null;
  };
  file: UploadedFileLike;
  moduleKey: unknown;
  entityType?: unknown;
  entityId?: unknown;
  uploadedBy?: unknown;
  isPublic?: boolean;
  metadata?: unknown;
};

function resolveStorageProvider() {
  return toText(process.env.STORAGE_PROVIDER).toLowerCase() || 'local';
}

function resolveStorageRoot() {
  const configuredRoot = toText(process.env.STORAGE_ROOT) || './storage';
  return path.isAbsolute(configuredRoot)
    ? configuredRoot
    : path.resolve(process.cwd(), configuredRoot);
}

function sanitizeSegment(value: unknown, fallback = 'item') {
  const text = toText(value)
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[\\/:*?"<>|]+/g, '-')
    .replace(/[^A-Za-z0-9._-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase();

  return text || fallback;
}

function validateModuleKey(value: unknown): string {
  const moduleKey = toText(value);
  if (!moduleKey) {
    throw new Error('moduleKey is required');
  }

  if (moduleKey.includes('../') || moduleKey.includes('..\\')) {
    throw new Error('moduleKey must not contain path traversal');
  }

  return moduleKey;
}

function getFileSourcePath(file: UploadedFileLike): string {
  return toText(file.filepath || file.path || file.tempFilePath);
}

function getOriginalFileName(file: UploadedFileLike): string {
  return toText(file.originalFilename || file.newFilename || file.name) || 'file';
}

function getMimeType(file: UploadedFileLike): string {
  return toText(file.mimetype || file.type).toLowerCase() || 'application/octet-stream';
}

function getFileSize(file: UploadedFileLike): number {
  const size = Number(file.size || 0);
  return Number.isFinite(size) && size >= 0 ? Math.floor(size) : 0;
}

function getFileExtension(fileName: string, mimeType: string): string {
  const rawExtension = path.extname(fileName).toLowerCase();
  if (rawExtension) return rawExtension;

  const mimeExtension = mime.extension(mimeType);
  return mimeExtension ? `.${mimeExtension}` : '';
}

function buildStoredFileName(originalName: string, mimeType: string) {
  const extension = getFileExtension(originalName, mimeType);
  const baseName = sanitizeSegment(path.basename(originalName, extension), 'file');
  const timestamp = Date.now();
  const randomSuffix = crypto.randomBytes(3).toString('hex');
  return {
    fileName: `${baseName}-${timestamp}-${randomSuffix}${extension}`,
    extension: extension ? extension.replace(/^\./, '') : '',
  };
}

function buildRelativePath(options: { tenantCode: string; moduleKey: string; fileName: string; now: Date }) {
  const year = String(options.now.getFullYear());
  const month = String(options.now.getMonth() + 1).padStart(2, '0');
  return path.posix.join('tenants', options.tenantCode, options.moduleKey, year, month, options.fileName);
}

function normalizeRelationRef(value: unknown): string | number | null {
  return extractRelationRef(value);
}

function toBoolean(value: unknown, fallback = false): boolean {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (normalized === 'true') return true;
    if (normalized === 'false') return false;
  }
  return fallback;
}

function normalizePlainObject(value: unknown): Record<string, any> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {};
  }
  return value as Record<string, any>;
}

function getAllowedCredentialRefs(): Set<string> {
  const configured = toText(process.env.STORAGE_ALLOWED_CREDENTIAL_REFS)
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);

  const values = configured.length ? configured : DEFAULT_ALLOWED_CREDENTIAL_REFS;
  return new Set(values.map((item) => item.toUpperCase()));
}

function isAllowedCredentialRef(ref: string): boolean {
  return getAllowedCredentialRefs().has(ref.toUpperCase());
}

function resolveCredentialFromAlias(alias: string): { accessKeyId: string; secretAccessKey: string } {
  const normalizedAlias = toText(alias).trim();
  if (!normalizedAlias) {
    throw new Error('S3 credentialRef is required');
  }

  if (!isAllowedCredentialRef(normalizedAlias)) {
    throw new Error(`credentialRef "${normalizedAlias}" is not allowed for server-side credential resolution`);
  }

  const directValue = process.env[normalizedAlias];
  if (directValue) {
    try {
      const parsed = JSON.parse(directValue);
      const accessKeyId = toText(parsed?.accessKeyId || parsed?.access_key_id || parsed?.accessKey || parsed?.keyId);
      const secretAccessKey = toText(parsed?.secretAccessKey || parsed?.secret_access_key || parsed?.secretKey || parsed?.secret);
      if (accessKeyId && secretAccessKey) {
        return { accessKeyId, secretAccessKey };
      }
    } catch {
      // ignore malformed JSON and fall through to env field patterns
    }
  }

  const accessKeyId = toText(process.env[`${normalizedAlias}_ACCESS_KEY_ID`] || process.env[`${normalizedAlias}_ACCESS_KEY`] || process.env[`${normalizedAlias}_KEY`]).trim();
  const secretAccessKey = toText(process.env[`${normalizedAlias}_SECRET_ACCESS_KEY`] || process.env[`${normalizedAlias}_SECRET_KEY`] || process.env[`${normalizedAlias}_SECRET`]).trim();

  if (!accessKeyId || !secretAccessKey) {
    throw new Error(`S3 credentialRef "${normalizedAlias}" is not configured in backend environment variables`);
  }

  return { accessKeyId, secretAccessKey };
}

function resolveTenantStorageConfigForUpload(tenant: { id?: number | string | null; storageDefaultConfigId?: number | string | null; code?: string | null } | null | undefined) {
  const tenantId = normalizeRelationRef(tenant?.id);
  if (!tenantId) {
    return null;
  }

  return strapi.db.query(TENANT_STORAGE_UID).findOne({
    where: {
      id: normalizeRelationRef(tenant?.storageDefaultConfigId) || undefined,
      tenant: {
        id: {
          $eq: tenantId,
        },
      },
    },
    populate: {
      tenant: { select: ['id', 'code'] },
    },
  });
}

async function resolveDefaultTenantStorageConfig(tenant: { id?: number | string | null; storageDefaultConfigId?: number | string | null; code?: string | null } | null | undefined) {
  const tenantId = normalizeRelationRef(tenant?.id);
  if (!tenantId) {
    return null;
  }

  const defaultConfigId = normalizeRelationRef(tenant?.storageDefaultConfigId);
  if (defaultConfigId) {
    const configured = await strapi.db.query(TENANT_STORAGE_UID).findOne({
      where: {
        id: defaultConfigId,
        tenant: {
          id: {
            $eq: tenantId,
          },
        },
      },
      populate: {
        tenant: { select: ['id', 'code'] },
      },
    });

    if (configured?.id) {
      return configured;
    }
  }

  const fallback = await strapi.db.query(TENANT_STORAGE_UID).findMany({
    where: {
      tenant: {
        id: {
          $eq: tenantId,
        },
      },
      isActive: {
        $ne: false,
      },
    },
    orderBy: [{ isDefault: 'desc' }, { id: 'asc' }],
    populate: {
      tenant: { select: ['id', 'code'] },
    },
  });

  return Array.isArray(fallback) && fallback.length > 0 ? fallback[0] : null;
}

function buildS3ObjectRoot(basePath: string | null | undefined, tenantCode: string): string {
  const cleanedBasePath = toText(basePath).replace(/\\/g, '/').replace(/^\/+|\/+$/g, '');
  if (!cleanedBasePath) {
    return path.posix.join('tenants', tenantCode);
  }

  const normalizedBase = cleanedBasePath.replace(/\/+/g, '/');
  const normalizedTenantCode = sanitizeSegment(tenantCode, 'tenant');
  const lowerBase = normalizedBase.toLowerCase();
  const tenantMarker = `tenants/${normalizedTenantCode}`.toLowerCase();

  if (lowerBase === tenantMarker || lowerBase.endsWith(`/${normalizedTenantCode}`)) {
    return normalizedBase;
  }

  return path.posix.join(normalizedBase, normalizedTenantCode);
}

export function readS3ConfigFromStorage(storageConfig: any) {
  const config = normalizePlainObject(storageConfig?.settings);
  const providerOptions = normalizePlainObject(config?.providerOptions);
  const s3Options = normalizePlainObject(providerOptions?.s3Options ?? config?.s3Options);
  const params = normalizePlainObject(s3Options?.params);

  const endpoint = toText(s3Options?.endpoint || config?.endpoint || process.env.VIETTEL_S3_ENDPOINT || '').trim();
  const region = toText(s3Options?.region || config?.region || process.env.VIETTEL_S3_REGION || '').trim();
  const bucket = toText(params?.Bucket || s3Options?.bucket || config?.bucket || process.env.VIETTEL_S3_BUCKET || '').trim();
  const forcePathStyle = toBoolean(s3Options?.forcePathStyle ?? config?.forcePathStyle ?? process.env.VIETTEL_S3_FORCE_PATH_STYLE ?? 'true', true);
  const credentialRef = toText(s3Options?.credentialRef || config?.credentialRef || process.env.VIETTEL_S3_CREDENTIAL_REF || 'VIETTEL_OBJECT_STORAGE').trim();
  const rootPath = toText(providerOptions?.rootPath || s3Options?.rootPath || config?.rootPath || '').trim();

  return {
    endpoint,
    region,
    bucket,
    forcePathStyle,
    credentialRef,
    rootPath,
    publicBaseUrl: toText(storageConfig?.publicBaseUrl || config?.publicBaseUrl || '').trim(),
  };
}

function buildS3ClientFromSettings(settings: { endpoint: string; region: string; bucket: string; forcePathStyle: boolean; credentialRef: string }, overrideBucket?: string) {
  const endpoint = toText(settings.endpoint).trim();
  const region = toText(settings.region).trim();
  const bucket = toText(overrideBucket || settings.bucket).trim();
  if (!endpoint || !region || !bucket) {
    throw new Error('S3 storage is misconfigured: endpoint, region, and bucket are required');
  }

  const credentials = resolveCredentialFromAlias(settings.credentialRef || 'VIETTEL_OBJECT_STORAGE');

  return {
    client: new S3Client({
      endpoint,
      region,
      forcePathStyle: settings.forcePathStyle,
      credentials,
    }),
    bucket,
    endpoint,
    region,
  };
}

export function resolveS3ClientForStorageConfig(storageConfig: any, overrideBucket?: string) {
  const settings = readS3ConfigFromStorage(storageConfig);
  const { client, bucket, endpoint, region } = buildS3ClientFromSettings({
    endpoint: settings.endpoint,
    region: settings.region,
    bucket: settings.bucket,
    forcePathStyle: settings.forcePathStyle,
    credentialRef: settings.credentialRef,
  }, overrideBucket);

  return {
    client,
    bucket,
    endpoint,
    region,
    forcePathStyle: settings.forcePathStyle,
    credentialRef: settings.credentialRef,
    settings,
  };
}

export async function testS3StorageConnection(storageConfig: any) {
  const configId = normalizeRelationRef(storageConfig?.id);
  const { client, bucket, endpoint, region, credentialRef } = resolveS3ClientForStorageConfig(storageConfig);
  const testObjectKey = `tenant-storage-tests/${new Date().toISOString().slice(0, 10)}/${crypto.randomBytes(6).toString('hex')}/connection-check.txt`;
  const payload = Buffer.from(`cogi-s3-connection-test-${Date.now()}\n`);

  const steps: Record<string, { status: 'PASS' | 'FAIL' | 'UNVERIFIED'; message: string }> = {
    configuration: { status: 'PASS', message: `endpoint=${endpoint}; region=${region}; bucket=${bucket}` },
    authentication: { status: 'PASS', message: `credentialRef=${credentialRef}` },
    bucketAccess: { status: 'FAIL', message: 'HeadBucket not verified yet' },
    upload: { status: 'FAIL', message: 'Upload not verified yet' },
    download: { status: 'FAIL', message: 'Download not verified yet' },
    delete: { status: 'FAIL', message: 'Delete not verified yet' },
  };

  try {
    await client.send(new HeadBucketCommand({ Bucket: bucket }));
    steps.bucketAccess = { status: 'PASS', message: `Bucket ${bucket} is reachable` };
  } catch (error: any) {
    const message = String(error?.message || 'HeadBucket failed');
    steps.bucketAccess = { status: 'UNVERIFIED', message: `HeadBucket check was not verified: ${message}` };
  }

  try {
    await client.send(new PutObjectCommand({
      Bucket: bucket,
      Key: testObjectKey,
      Body: payload,
      ContentType: 'text/plain; charset=utf-8',
    }));
    steps.upload = { status: 'PASS', message: `Uploaded to ${testObjectKey}` };
  } catch (error: any) {
    const message = String(error?.message || 'Upload failed');
    steps.upload = { status: 'FAIL', message: `Upload failed: ${message}` };
  }

  if (steps.upload.status === 'PASS') {
    try {
      const response = await client.send(new GetObjectCommand({
        Bucket: bucket,
        Key: testObjectKey,
      }));
      const body = response.Body as any;
      const output = body && typeof body.transformToByteArray === 'function'
        ? Buffer.from(await body.transformToByteArray())
        : Buffer.from(await (async () => {
            const chunks: Buffer[] = [];
            for await (const chunk of body as AsyncIterable<any>) {
              chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
            }
            return Buffer.concat(chunks);
          })());

      if (output.length === payload.length) {
        steps.download = { status: 'PASS', message: `Downloaded ${output.length} bytes from ${testObjectKey}` };
      } else {
        steps.download = { status: 'FAIL', message: `Downloaded ${output.length} bytes, expected ${payload.length}` };
      }
    } catch (error: any) {
      const message = String(error?.message || 'Download failed');
      steps.download = { status: 'FAIL', message: `Download failed: ${message}` };
    }
  }

  if (steps.upload.status === 'PASS') {
    try {
      await client.send(new DeleteObjectCommand({
        Bucket: bucket,
        Key: testObjectKey,
      }));
      steps.delete = { status: 'PASS', message: `Deleted ${testObjectKey}` };
    } catch (error: any) {
      const message = String(error?.message || 'Delete failed');
      steps.delete = { status: 'FAIL', message: `Delete failed: ${message}` };
    }
  }

  const statuses = Object.values(steps).map((entry) => entry.status);
  const summary = statuses.every((status) => status === 'PASS')
    ? 'PASS'
    : statuses.some((status) => status === 'UNVERIFIED')
      ? 'UNVERIFIED'
      : 'FAIL';

  return {
    provider: 's3',
    storageConfigId: configId,
    summary,
    endpoint,
    region,
    bucket,
    steps,
  };
}

async function removeFileIfExists(filePath: string) {
  try {
    await fs.unlink(filePath);
  } catch {
    // ignore cleanup errors
  }
}

async function uploadS3File(options: UploadLocalFileOptions, storageConfig: any) {
  const tenantId = normalizeRelationRef(options.tenant?.id);
  const tenantCode = sanitizeSegment(options.tenant?.code, 'tenant');
  if (!tenantId) {
    throw new Error('tenant.id is required');
  }
  if (!toText(options.tenant?.code)) {
    throw new Error('tenant.code is required');
  }

  const file = options.file;
  if (!file || typeof file !== 'object') {
    throw new Error('file is required');
  }

  const sourcePath = getFileSourcePath(file);
  if (!sourcePath) {
    throw new Error('Uploaded file source path is missing');
  }

  const originalName = getOriginalFileName(file);
  const mimeType = getMimeType(file);
  const size = getFileSize(file);
  if (size < 0) {
    throw new Error('file size must be non-negative');
  }

  const moduleKey = validateModuleKey(options.moduleKey);
  const safeModuleKey = sanitizeSegment(moduleKey, 'module');
  const now = new Date();
  const { fileName, extension } = buildStoredFileName(originalName, mimeType);
  const s3Settings = readS3ConfigFromStorage(storageConfig);
  const objectRoot = buildS3ObjectRoot(storageConfig?.basePath || s3Settings.rootPath, tenantCode);
  const objectKey = path.posix.join(objectRoot, safeModuleKey, String(now.getFullYear()), String(now.getMonth() + 1).padStart(2, '0'), fileName);

  const { client, bucket, endpoint, region } = buildS3ClientFromSettings({
    endpoint: s3Settings.endpoint,
    region: s3Settings.region,
    bucket: s3Settings.bucket,
    forcePathStyle: s3Settings.forcePathStyle,
    credentialRef: s3Settings.credentialRef,
  });

  const key = objectKey.replace(/\\/g, '/').replace(/^\/+/, '');
  const payload = await fs.readFile(sourcePath);
  const putCommand = new PutObjectCommand({
    Bucket: bucket,
    Key: key,
    Body: payload,
    ContentType: mimeType,
  });

  await client.send(putCommand);

  const uploadedByRef = normalizeRelationRef(options.uploadedBy);
  const storageConfigRef = normalizeRelationRef(options.tenant?.storageDefaultConfigId);
  const basePublicUrl = toText(s3Settings.publicBaseUrl || storageConfig?.publicBaseUrl || '').trim();
  const url = basePublicUrl
    ? `${basePublicUrl.replace(/\/+$/, '')}/${key.replace(/^\/+/, '')}`
    : `s3://${bucket}/${key}`;

  try {
    const created = await strapi.db.query(FILE_ASSET_UID).create({
      data: {
        tenant: tenantId,
        storageConfig: storageConfigRef || null,
        moduleKey,
        entityType: toText(options.entityType) || null,
        entityId: toText(options.entityId) || null,
        originalName,
        fileName,
        extension: extension || null,
        mimeType,
        size: String(size),
        provider: 's3',
        relativePath: key,
        url,
        uploadedBy: uploadedByRef || null,
        isPublic: options.isPublic !== false,
        status: 'ACTIVE',
        metadata: {
          provider: 's3',
          bucket,
          objectKey: key,
          endpoint,
          region,
          forcePathStyle: s3Settings.forcePathStyle,
          credentialRef: s3Settings.credentialRef,
          storageConfigId: storageConfigRef || null,
          tenantCode,
          moduleKey: safeModuleKey,
        },
      },
      populate: {
        tenant: { select: ['id', 'code', 'name'] },
        storageConfig: { select: ['id', 'name', 'provider'] },
        uploadedBy: { select: ['id', 'username', 'email'] },
      },
    });

    return created;
  } catch (error) {
    try {
      await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
    } catch {
      // ignore cleanup errors
    }
    throw error;
  }
}

export async function uploadLocalFile(options: UploadLocalFileOptions) {
  const tenantId = normalizeRelationRef(options.tenant?.id);
  const tenantCode = sanitizeSegment(options.tenant?.code, 'tenant');
  const storageConfig = await resolveDefaultTenantStorageConfig(options.tenant);
  const provider = toText(storageConfig?.provider || resolveStorageProvider()).toLowerCase() || 'local';

  if (provider === 's3') {
    return uploadS3File(options, storageConfig);
  }

  if (provider !== 'local') {
    throw new Error(`Unsupported storage provider: ${provider}`);
  }
  if (!tenantId) {
    throw new Error('tenant.id is required');
  }
  if (!toText(options.tenant?.code)) {
    throw new Error('tenant.code is required');
  }

  const moduleKey = validateModuleKey(options.moduleKey);
  const safeModuleKey = sanitizeSegment(moduleKey, 'module');
  const file = options.file;
  if (!file || typeof file !== 'object') {
    throw new Error('file is required');
  }

  const sourcePath = getFileSourcePath(file);
  if (!sourcePath) {
    throw new Error('Uploaded file source path is missing');
  }

  const originalName = getOriginalFileName(file);
  const mimeType = getMimeType(file);
  const size = getFileSize(file);
  if (size < 0) {
    throw new Error('file size must be non-negative');
  }

  const now = new Date();
  const { fileName, extension } = buildStoredFileName(originalName, mimeType);
  const relativePath = buildRelativePath({
    tenantCode,
    moduleKey: safeModuleKey,
    fileName,
    now,
  });

  if (relativePath.includes('../') || relativePath.includes('..\\')) {
    throw new Error('relativePath must not contain path traversal');
  }

  const storageRoot = resolveStorageRoot();
  const absolutePath = path.join(storageRoot, ...relativePath.split('/'));
  const absoluteDir = path.dirname(absolutePath);
  const url = `/storage/${relativePath.replace(/\\/g, '/')}`;
  if (url.includes('../') || url.includes('..\\')) {
    throw new Error('url must not contain path traversal');
  }

  await fs.mkdir(absoluteDir, { recursive: true });
  await fs.copyFile(sourcePath, absolutePath);

  const uploadedByRef = normalizeRelationRef(options.uploadedBy);
  const storageConfigRef = normalizeRelationRef(options.tenant?.storageDefaultConfigId);

  try {
    const created = await strapi.db.query(FILE_ASSET_UID).create({
      data: {
        tenant: tenantId,
        storageConfig: storageConfigRef || null,
        moduleKey,
        entityType: toText(options.entityType) || null,
        entityId: toText(options.entityId) || null,
        originalName,
        fileName,
        extension: extension || null,
        mimeType,
        size: String(size),
        provider: 'local',
        relativePath,
        url,
        uploadedBy: uploadedByRef || null,
        isPublic: options.isPublic !== false,
        status: 'ACTIVE',
        metadata: options.metadata ?? null,
      },
      populate: {
        tenant: { select: ['id', 'code', 'name'] },
        storageConfig: { select: ['id', 'name', 'provider'] },
        uploadedBy: { select: ['id', 'username', 'email'] },
      },
    });

    return created;
  } catch (error) {
    await removeFileIfExists(absolutePath);
    throw error;
  }
}

export async function uploadLocalFiles(optionsList: UploadLocalFileOptions[]) {
  const normalizedList = Array.isArray(optionsList) ? optionsList : []
  const results = []

  for (const options of normalizedList) {
    results.push(await uploadLocalFile(options))
  }

  return results
}

export default {
  uploadLocalFile,
  uploadLocalFiles,
  testS3StorageConnection,
};