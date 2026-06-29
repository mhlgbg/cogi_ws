import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import storageService from '../../../services/storage-service';
import { resolveCurrentTenantId } from '../../../utils/tenant-scope';

const TENANT_UID = 'api::tenant.tenant';
const TENANT_STORAGE_UID = 'api::tenant-storage.tenant-storage';
const FILE_ASSET_UID = 'api::file-asset.file-asset';
const USER_TENANT_UID = 'api::user-tenant.user-tenant';
const ADMISSION_APPLICATION_UID = 'api::admission-application.admission-application';
const ADMISSION_FILE_ENTITY_TYPE = 'api::admission-application.admission-application';

function toText(value: unknown): string {
  if (value === null || value === undefined) return '';
  return String(value).trim();
}

function toPositiveInt(value: unknown): number | null {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

function toBoolean(value: unknown, fallback = true): boolean {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (normalized === 'true') return true;
    if (normalized === 'false') return false;
  }

  return fallback;
}

function resolveStorageRoot() {
  const configuredRoot = String(process.env.STORAGE_ROOT || './storage').trim() || './storage';
  return path.isAbsolute(configuredRoot)
    ? configuredRoot
    : path.resolve(process.cwd(), configuredRoot);
}

function isPathInsideRoot(rootPath: string, absolutePath: string) {
  const relativePath = path.relative(rootPath, absolutePath);
  if (!relativePath) return true;
  return !relativePath.startsWith('..') && !path.isAbsolute(relativePath);
}

function guessContentType(filePath: string) {
  const extension = path.extname(filePath).toLowerCase();
  if (extension === '.pdf') return 'application/pdf';
  if (extension === '.png') return 'image/png';
  if (extension === '.jpg' || extension === '.jpeg') return 'image/jpeg';
  if (extension === '.gif') return 'image/gif';
  if (extension === '.webp') return 'image/webp';
  if (extension === '.svg') return 'image/svg+xml';
  if (extension === '.txt') return 'text/plain; charset=utf-8';
  return 'application/octet-stream';
}

function resolveUploadFile(value: any): any {
  if (Array.isArray(value)) return value[0] || null;
  return value || null;
}

type AdmissionAccessTokenPayload = {
  tenantId: string;
  tenantCode: string;
  campaignId: number;
  campaignCode: string;
  applicationId: number;
  studentCode: string;
  parentUserId: number;
  email: string;
  parentFullName?: string;
  parentPhone?: string;
  iat: number;
  exp: number;
};

function resolveTokenSecret(): string {
  const explicitSecret = toText(process.env.ADMISSION_V1_TOKEN_SECRET);
  if (explicitSecret) return explicitSecret;

  const appKeys = (strapi as any).config?.get?.('server.app.keys');
  if (Array.isArray(appKeys) && typeof appKeys[0] === 'string' && appKeys[0].trim()) {
    return appKeys[0].trim();
  }

  if (typeof appKeys === 'string' && appKeys.trim()) {
    return appKeys.split(',')[0].trim();
  }

  return 'admission-v1-dev-secret';
}

function fromBase64Url(input: string): string {
  return Buffer.from(input, 'base64url').toString('utf8');
}

function verifyAdmissionAccessToken(token: string): AdmissionAccessTokenPayload {
  const trimmedToken = toText(token);
  if (!trimmedToken || !trimmedToken.includes('.')) {
    throw new Error('token is invalid');
  }

  const [encodedPayload, signature] = trimmedToken.split('.');
  const expectedSignature = crypto.createHmac('sha256', resolveTokenSecret()).update(encodedPayload).digest('base64url');
  if (signature.length !== expectedSignature.length) {
    throw new Error('token is invalid');
  }

  const isValid = crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature));
  if (!isValid) {
    throw new Error('token is invalid');
  }

  const parsed = JSON.parse(fromBase64Url(encodedPayload)) as AdmissionAccessTokenPayload;
  if (!parsed?.exp || parsed.exp < Math.floor(Date.now() / 1000)) {
    throw new Error('token has expired');
  }

  return parsed;
}

async function resolveAuthenticatedUserFromJwt(jwtToken: string) {
  const jwtService = strapi.plugin('users-permissions')?.service('jwt');
  if (!jwtService) return null;

  const decoded = await jwtService.verify(jwtToken);
  const userId = toPositiveInt(decoded?.id);
  if (!userId) return null;

  return strapi.db.query('plugin::users-permissions.user').findOne({
    where: { id: userId },
    select: ['id', 'blocked'],
  });
}

async function hasActiveTenantMembership(userId: number, tenantId: number) {
  const membership = await strapi.db.query(USER_TENANT_UID).findOne({
    where: {
      user: userId,
      tenant: tenantId,
      userTenantStatus: 'active',
    },
    select: ['id'],
  });

  return Boolean(membership?.id);
}

async function findFileAssetForDownloadOrThrow(fileAssetId: number) {
  const fileAsset = await strapi.db.query(FILE_ASSET_UID).findOne({
    where: {
      id: fileAssetId,
      status: {
        $ne: 'DELETED',
      },
    },
    populate: {
      tenant: { select: ['id', 'code'] },
    },
  });

  if (!fileAsset?.id) {
    throw new Error('FileAsset not found');
  }

  return fileAsset;
}

async function assertAdmissionTokenCanAccessFile(token: string, fileAsset: any) {
  const tokenPayload = verifyAdmissionAccessToken(token);
  const fileTenantId = toPositiveInt(fileAsset?.tenant?.id ?? fileAsset?.tenant);
  const tokenTenantId = toPositiveInt(tokenPayload?.tenantId);
  const tokenApplicationId = toPositiveInt(tokenPayload?.applicationId);
  const fileEntityId = toPositiveInt(fileAsset?.entityId);

  if (!fileTenantId || !tokenTenantId || fileTenantId !== tokenTenantId) {
    throw new Error('Forbidden');
  }

  if (toText(fileAsset?.entityType) !== ADMISSION_FILE_ENTITY_TYPE || !fileEntityId || !tokenApplicationId || fileEntityId !== tokenApplicationId) {
    throw new Error('Forbidden');
  }

  const application = await strapi.db.query(ADMISSION_APPLICATION_UID).findOne({
    where: {
      id: tokenApplicationId,
      tenant: {
        id: {
          $eq: tokenTenantId,
        },
      },
    },
    select: ['id'],
  });

  if (!application?.id) {
    throw new Error('Forbidden');
  }
}

async function assertJwtCanAccessFile(jwtToken: string, fileAsset: any) {
  const user = await resolveAuthenticatedUserFromJwt(jwtToken);
  const userId = toPositiveInt(user?.id);
  const fileTenantId = toPositiveInt(fileAsset?.tenant?.id ?? fileAsset?.tenant);

  if (!userId || user?.blocked || !fileTenantId) {
    throw new Error('Forbidden');
  }

  const hasMembership = await hasActiveTenantMembership(userId, fileTenantId);
  if (!hasMembership) {
    throw new Error('Forbidden');
  }
}

async function sendFileAssetResponse(ctx: any, fileAsset: any) {
  const storageRoot = resolveStorageRoot();
  const relativePath = toText(fileAsset?.relativePath);
  const absolutePath = path.resolve(storageRoot, ...relativePath.split('/').filter(Boolean));
  if (!relativePath || !isPathInsideRoot(storageRoot, absolutePath)) {
    throw new Error('Forbidden');
  }

  const stats = await fs.stat(absolutePath);
  if (!stats.isFile()) {
    throw new Error('File not found');
  }

  ctx.type = guessContentType(absolutePath);
  ctx.set('Content-Disposition', `inline; filename="${toText(fileAsset?.fileName || fileAsset?.originalName || fileAsset?.id)}"`);
  ctx.body = await fs.readFile(absolutePath);
}

async function findCurrentTenantOrThrow(ctx: any) {
  const tenantId = resolveCurrentTenantId(ctx);
  const tenant = await strapi.db.query(TENANT_UID).findOne({
    where: { id: tenantId },
    select: ['id', 'code', 'storageDefaultConfigId'],
  });

  if (!tenant?.id) {
    throw new Error('Tenant not found');
  }

  return tenant;
}

async function resolveSummaryStorageConfig(tenant: any) {
  const storageDefaultConfigId = toPositiveInt(tenant?.storageDefaultConfigId);
  if (storageDefaultConfigId) {
    const storageConfig = await strapi.db.query(TENANT_STORAGE_UID).findOne({
      where: {
        id: storageDefaultConfigId,
        tenant: {
          id: {
            $eq: tenant.id,
          },
        },
      },
      select: ['id', 'provider', 'quotaGB', 'usedBytes'],
    });

    if (storageConfig?.id) return storageConfig;
  }

  const storageConfigs = await strapi.db.query(TENANT_STORAGE_UID).findMany({
    where: {
      tenant: {
        id: {
          $eq: tenant.id,
        },
      },
    },
    select: ['id', 'provider', 'quotaGB', 'usedBytes', 'isDefault', 'isActive'],
  });

  return (storageConfigs || []).sort((left: any, right: any) => {
    if (Boolean(left?.isDefault) !== Boolean(right?.isDefault)) return left?.isDefault ? -1 : 1;
    if (Boolean(left?.isActive) !== Boolean(right?.isActive)) return left?.isActive ? -1 : 1;
    return (Number(left?.id || 0) - Number(right?.id || 0));
  })[0] || null;
}

function parseBigInteger(value: unknown): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) return 0;
  return Math.floor(parsed);
}

function buildFileAssetListWhere(tenantId: number, query: any) {
  const keyword = toText(query?.keyword);
  const moduleKey = toText(query?.moduleKey);
  const status = toText(query?.status).toUpperCase();

  const where: Record<string, unknown> = {
    tenant: {
      id: {
        $eq: tenantId,
      },
    },
  };

  const andConditions: unknown[] = [];
  if (keyword) {
    andConditions.push({
      $or: [
        { originalName: { $containsi: keyword } },
        { fileName: { $containsi: keyword } },
        { relativePath: { $containsi: keyword } },
        { url: { $containsi: keyword } },
      ],
    });
  }

  if (moduleKey) {
    andConditions.push({ moduleKey: { $eq: moduleKey } });
  }

  if (status) {
    andConditions.push({ status: { $eq: status } });
  }

  if (andConditions.length === 0) {
    return where;
  }

  return {
    $and: [where, ...andConditions],
  };
}

async function findTenantFileAssetOrThrow(tenantId: number, fileAssetId: number) {
  const fileAsset = await strapi.db.query(FILE_ASSET_UID).findOne({
    where: {
      id: fileAssetId,
      tenant: {
        id: {
          $eq: tenantId,
        },
      },
    },
  });

  if (!fileAsset?.id) {
    throw new Error('FileAsset not found');
  }

  return fileAsset;
}

export default {
  async downloadFileAsset(ctx: any) {
    const fileAssetId = toPositiveInt(ctx.params?.id);
    if (!fileAssetId) {
      return ctx.badRequest('Invalid file id');
    }

    try {
      const fileAsset = await findFileAssetForDownloadOrThrow(fileAssetId);
      if (fileAsset.isPublic === true) {
        await sendFileAssetResponse(ctx, fileAsset);
        return;
      }

      const jwtToken = toText(ctx.request?.query?.jwt);
      const admissionToken = toText(ctx.request?.query?.token);

      if (jwtToken) {
        await assertJwtCanAccessFile(jwtToken, fileAsset);
        await sendFileAssetResponse(ctx, fileAsset);
        return;
      }

      if (admissionToken) {
        await assertAdmissionTokenCanAccessFile(admissionToken, fileAsset);
        await sendFileAssetResponse(ctx, fileAsset);
        return;
      }

      return ctx.forbidden('Private file requires authenticated download');
    } catch (error: any) {
      if (error?.message === 'FileAsset not found' || error?.message === 'File not found') {
        return ctx.notFound('File not found');
      }
      if (error?.message === 'token is invalid') {
        return ctx.badRequest('token is invalid');
      }
      if (error?.message === 'token has expired') {
        return ctx.unauthorized('token has expired');
      }

      if (error?.message === 'Forbidden') {
        return ctx.forbidden('Forbidden');
      }

      strapi.log.error('[storage.downloadFileAsset] unexpected error', error);
      return ctx.internalServerError('Failed to download file');
    }
  },

  async getTenantStorageSummary(ctx: any) {
    try {
      const tenant = await findCurrentTenantOrThrow(ctx);
      const storageConfig = await resolveSummaryStorageConfig(tenant);
      const rows = await strapi.db.query(FILE_ASSET_UID).findMany({
        where: {
          tenant: {
            id: {
              $eq: tenant.id,
            },
          },
        },
        select: ['size', 'status'],
      });

      const fileCount = rows.length;
      const activeFileCount = rows.filter((item: any) => toText(item?.status).toUpperCase() === 'ACTIVE').length;
      const deletedFileCount = rows.filter((item: any) => toText(item?.status).toUpperCase() === 'DELETED').length;
      const usedBytes = rows.reduce((sum: number, item: any) => sum + parseBigInteger(item?.size), 0);
      const quotaGB = Number(storageConfig?.quotaGB ?? 5) || 5;
      const usedGB = Number((usedBytes / (1024 ** 3)).toFixed(3));
      const quotaBytes = quotaGB > 0 ? quotaGB * (1024 ** 3) : 0;
      const percentUsed = quotaBytes > 0 ? Number(((usedBytes / quotaBytes) * 100).toFixed(2)) : 0;

      ctx.body = {
        ok: true,
        data: {
          provider: toText(storageConfig?.provider) || 'local',
          quotaGB,
          usedBytes,
          usedGB,
          percentUsed,
          fileCount,
          activeFileCount,
          deletedFileCount,
        },
      };
    } catch (error: any) {
      if (error?.message === 'Tenant not found') {
        return ctx.notFound('Tenant not found');
      }

      strapi.log.error('[storage.getTenantStorageSummary] unexpected error', error);
      return ctx.internalServerError('Failed to load tenant storage summary');
    }
  },

  async listTenantStorageFiles(ctx: any) {
    try {
      const tenant = await findCurrentTenantOrThrow(ctx);
      const page = Math.max(1, toPositiveInt(ctx.request?.query?.page) || 1);
      const pageSize = Math.max(1, Math.min(100, toPositiveInt(ctx.request?.query?.pageSize) || 10));
      const where = buildFileAssetListWhere(tenant.id, ctx.request?.query || {});

      const [total, rows] = await Promise.all([
        strapi.db.query(FILE_ASSET_UID).count({ where }),
        strapi.db.query(FILE_ASSET_UID).findMany({
          where,
          select: ['id', 'code', 'moduleKey', 'entityType', 'entityId', 'originalName', 'fileName', 'extension', 'mimeType', 'size', 'provider', 'relativePath', 'url', 'downloadCount', 'lastAccessAt', 'status', 'isPublic', 'isDeleted', 'createdAt', 'updatedAt'],
          populate: {
            uploadedBy: {
              select: ['id', 'username', 'email'],
            },
          },
          orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
          offset: (page - 1) * pageSize,
          limit: pageSize,
        }),
      ]);

      ctx.body = {
        ok: true,
        data: rows || [],
        pagination: {
          page,
          pageSize,
          pageCount: total > 0 ? Math.ceil(total / pageSize) : 1,
          total,
        },
      };
    } catch (error: any) {
      if (error?.message === 'Tenant not found') {
        return ctx.notFound('Tenant not found');
      }

      strapi.log.error('[storage.listTenantStorageFiles] unexpected error', error);
      return ctx.internalServerError('Failed to load tenant storage files');
    }
  },

  async uploadTenantStorageFile(ctx: any) {
    try {
      const tenant = await findCurrentTenantOrThrow(ctx);
      const file = resolveUploadFile(ctx.request?.files?.file);
      if (!file) {
        return ctx.badRequest('file is required');
      }

      const moduleKey = ctx.request?.body?.moduleKey;
      if (!toText(moduleKey)) {
        return ctx.badRequest('moduleKey is required');
      }

      const fileAsset = await storageService.uploadLocalFile({
        tenant,
        file,
        moduleKey,
        entityType: ctx.request?.body?.entityType,
        entityId: ctx.request?.body?.entityId,
        uploadedBy: ctx.state?.user?.id || null,
        isPublic: toBoolean(ctx.request?.body?.isPublic, true),
        metadata: null,
      });

      ctx.body = {
        ok: true,
        data: fileAsset,
      };
    } catch (error: any) {
      const message = String(error?.message || '');

      if (
        message === 'Tenant not found'
        || message === 'file is required'
        || message === 'moduleKey is required'
        || message === 'moduleKey must not contain path traversal'
        || message === 'tenant.id is required'
        || message === 'tenant.code is required'
        || message === 'Uploaded file source path is missing'
        || message === 'file size must be non-negative'
        || message.includes('Only local storage provider is supported right now')
      ) {
        return ctx.badRequest(message);
      }

      strapi.log.error('[storage.uploadTenantStorageFile] unexpected error', error);
      return ctx.internalServerError('Failed to upload tenant storage file');
    }
  },

  async deleteTenantStorageFile(ctx: any) {
    const fileAssetId = toPositiveInt(ctx.params?.id);
    if (!fileAssetId) {
      return ctx.badRequest('Invalid file id');
    }

    try {
      const tenant = await findCurrentTenantOrThrow(ctx);
      const fileAsset = await findTenantFileAssetOrThrow(tenant.id, fileAssetId);
      const updated = await strapi.db.query(FILE_ASSET_UID).update({
        where: { id: fileAsset.id },
        data: {
          status: 'DELETED',
          isDeleted: true,
        },
      });

      ctx.body = {
        ok: true,
        data: updated,
      };
    } catch (error: any) {
      if (error?.message === 'Tenant not found') {
        return ctx.notFound('Tenant not found');
      }
      if (error?.message === 'FileAsset not found') {
        return ctx.notFound('FileAsset not found');
      }

      strapi.log.error('[storage.deleteTenantStorageFile] unexpected error', error);
      return ctx.internalServerError('Failed to delete tenant storage file');
    }
  },

  async restoreTenantStorageFile(ctx: any) {
    const fileAssetId = toPositiveInt(ctx.params?.id);
    if (!fileAssetId) {
      return ctx.badRequest('Invalid file id');
    }

    try {
      const tenant = await findCurrentTenantOrThrow(ctx);
      const fileAsset = await findTenantFileAssetOrThrow(tenant.id, fileAssetId);
      const updated = await strapi.db.query(FILE_ASSET_UID).update({
        where: { id: fileAsset.id },
        data: {
          status: 'ACTIVE',
          isDeleted: false,
        },
      });

      ctx.body = {
        ok: true,
        data: updated,
      };
    } catch (error: any) {
      if (error?.message === 'Tenant not found') {
        return ctx.notFound('Tenant not found');
      }
      if (error?.message === 'FileAsset not found') {
        return ctx.notFound('FileAsset not found');
      }

      strapi.log.error('[storage.restoreTenantStorageFile] unexpected error', error);
      return ctx.internalServerError('Failed to restore tenant storage file');
    }
  },

  async uploadTest(ctx: any) {
    try {
      const tenant = await findCurrentTenantOrThrow(ctx);

      const file = resolveUploadFile(ctx.request?.files?.file);
      if (!file) {
        return ctx.badRequest('file is required');
      }

      const fileAsset = await storageService.uploadLocalFile({
        tenant,
        file,
        moduleKey: ctx.request?.body?.moduleKey,
        entityType: ctx.request?.body?.entityType,
        entityId: ctx.request?.body?.entityId,
        uploadedBy: ctx.state?.user?.id || null,
        isPublic: true,
        metadata: null,
      });

      ctx.body = {
        ok: true,
        data: fileAsset,
      };
    } catch (error: any) {
      const message = String(error?.message || '');

      if (
        message === 'Tenant not found'
        || message === 'file is required'
        || message === 'moduleKey is required'
        || message === 'moduleKey must not contain path traversal'
        || message === 'tenant.id is required'
        || message === 'tenant.code is required'
        || message === 'Uploaded file source path is missing'
        || message === 'file size must be non-negative'
        || message.includes('Only local storage provider is supported right now')
      ) {
        return ctx.badRequest(message);
      }

      strapi.log.error('[storage.uploadTest] unexpected error', error);
      return ctx.internalServerError('Failed to upload storage test file');
    }
  },
};