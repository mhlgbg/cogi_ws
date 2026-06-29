import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import mime from 'mime-types';
import { extractRelationRef, toText } from '../utils/tenant-scope';

const FILE_ASSET_UID = 'api::file-asset.file-asset';

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

async function removeFileIfExists(filePath: string) {
  try {
    await fs.unlink(filePath);
  } catch {
    // ignore cleanup errors
  }
}

export async function uploadLocalFile(options: UploadLocalFileOptions) {
  const provider = resolveStorageProvider();
  if (provider !== 'local') {
    throw new Error(`Only local storage provider is supported right now. Current provider: ${provider || 'unknown'}`);
  }

  const tenantId = normalizeRelationRef(options.tenant?.id);
  const tenantCode = sanitizeSegment(options.tenant?.code, 'tenant');
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
};