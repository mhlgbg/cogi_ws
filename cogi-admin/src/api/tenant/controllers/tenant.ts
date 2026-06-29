import { buildTenantContextPayload } from '../services/tenant-context';
import { resolveCurrentTenantId } from '../../../utils/tenant-scope';

const strapi = globalThis.strapi;

const TENANT_UID = 'api::tenant.tenant';
const TENANT_STORAGE_UID = 'api::tenant-storage.tenant-storage';

const STORAGE_PROVIDER_VALUES = ['local', 's3', 'minio', 'wasabi', 'azure', 'gcs'] as const;

const WEBSITE_SETTINGS_TEXT_FIELDS = [
  'siteTitle',
  'defaultPageTitle',
  'titleSuffix',
  'googleAnalyticsId',
  'googleTagManagerId',
  'googleSearchConsoleVerification',
  'facebookPixelId',
  'siteShortTitle',
  'siteDescription',
  'siteKeywords',
] as const;

const GOOGLE_ANALYTICS_ID_PATTERN = /^G-[A-Z0-9]+$/i;
const GOOGLE_TAG_MANAGER_ID_PATTERN = /^GTM-[A-Z0-9]+$/i;
const WEBSITE_MEDIA_MAX_FILE_SIZE = 10 * 1024 * 1024;
const ALLOWED_WEBSITE_MEDIA_TYPES = new Set([
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/svg+xml',
  'image/avif',
]);

const WEBSITE_SETTINGS_MEDIA_FIELDS = [
  'siteLogo',
  'defaultMetaImage',
  'favicon',
  'chatAvatar',
] as const;

type WebsiteSettingsTextField = typeof WEBSITE_SETTINGS_TEXT_FIELDS[number];
type WebsiteSettingsMediaField = typeof WEBSITE_SETTINGS_MEDIA_FIELDS[number];

function toText(value: unknown): string {
  if (value === null || value === undefined) return '';
  return String(value).trim();
}

function toPositiveInt(value: unknown): number | null {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

function toNonNegativeInt(value: unknown): number | null {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : null;
}

function toBoolean(value: unknown): boolean | null {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (normalized === 'true') return true;
    if (normalized === 'false') return false;
  }

  return null;
}

function resolveRequestData(ctx: any): Record<string, unknown> {
  const body = (ctx.request.body ??= {});
  if (body.data && typeof body.data === 'object' && !Array.isArray(body.data)) {
    return body.data as Record<string, unknown>;
  }

  return body as Record<string, unknown>;
}

function flattenUploadedFiles(value: unknown): any[] {
  if (!value) return [];
  if (Array.isArray(value)) {
    return value.flatMap((entry) => flattenUploadedFiles(entry));
  }
  if (
    typeof value === 'object'
    && value
    && (
      (value as Record<string, unknown>).filepath
      || (value as Record<string, unknown>).path
      || (value as Record<string, unknown>).tempFilePath
    )
  ) {
    return [value];
  }
  if (typeof value === 'object') {
    return Object.values(value as Record<string, unknown>).flatMap((entry) => flattenUploadedFiles(entry));
  }
  return [];
}

function resolveUploadFile(rawFiles: any) {
  return flattenUploadedFiles(rawFiles)[0] || null;
}

function normalizeUploadMimeType(file: any) {
  return toText(file?.mimetype || file?.type).toLowerCase();
}

function normalizeUploadSize(file: any) {
  const size = Number(file?.size || 0);
  return Number.isFinite(size) && size >= 0 ? Math.floor(size) : 0;
}

function ensureWebsiteMediaFileValid(file: any) {
  const mimeType = normalizeUploadMimeType(file);
  if (!mimeType || !ALLOWED_WEBSITE_MEDIA_TYPES.has(mimeType)) {
    throw new Error('Chỉ cho phép upload ảnh JPG, PNG, WEBP, GIF, SVG hoặc AVIF');
  }

  const size = normalizeUploadSize(file);
  if (!size || size > WEBSITE_MEDIA_MAX_FILE_SIZE) {
    throw new Error('Ảnh tải lên vượt quá giới hạn 10MB');
  }
}

function extractMediaUrl(media: any): string | null {
  const direct = toText(media?.url);
  if (direct) return direct;

  const formats = media?.formats && typeof media.formats === 'object' ? media.formats : null;
  if (!formats) return null;

  for (const key of ['thumbnail', 'small', 'medium', 'large']) {
    const candidate = toText(formats?.[key]?.url);
    if (candidate) return candidate;
  }

  return null;
}

function normalizeWebsiteMedia(media: any) {
  if (!media || typeof media !== 'object') return null;

  return {
    id: toPositiveInt(media.id),
    name: toText(media.name) || null,
    url: extractMediaUrl(media),
  };
}

function validateWebsiteSettingsTextField(field: WebsiteSettingsTextField, value: string | null) {
  if (!value) return;

  if (field === 'googleAnalyticsId' && !GOOGLE_ANALYTICS_ID_PATTERN.test(value)) {
    throw new Error('googleAnalyticsId must match format G-XXXXXXXXXX');
  }

  if (field === 'googleTagManagerId' && !GOOGLE_TAG_MANAGER_ID_PATTERN.test(value)) {
    throw new Error('googleTagManagerId must match format GTM-XXXXXXX');
  }
}

function normalizeStorageConfigResponse(storageConfig: any, defaultStorageConfigId: number | null) {
  const id = toPositiveInt(storageConfig?.id);

  return {
    id,
    name: toText(storageConfig?.name) || null,
    provider: toText(storageConfig?.provider) || 'local',
    basePath: toText(storageConfig?.basePath) || null,
    publicBaseUrl: toText(storageConfig?.publicBaseUrl) || null,
    quotaGB: toText(storageConfig?.quotaGB) || '5',
    usedBytes: toText(storageConfig?.usedBytes) || '0',
    isDefault: Boolean(id && defaultStorageConfigId && id === defaultStorageConfigId),
    isActive: storageConfig?.isActive !== false,
    settings: storageConfig?.settings ?? null,
    notes: toText(storageConfig?.notes) || null,
    createdAt: storageConfig?.createdAt || null,
    updatedAt: storageConfig?.updatedAt || null,
  };
}

function buildStorageProviderError() {
  return `provider must be one of: ${STORAGE_PROVIDER_VALUES.join(', ')}`;
}

function parseStorageSettingsValue(value: unknown) {
  if (value === undefined) return undefined;
  if (value === null || value === '') return null;

  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return null;

    try {
      return JSON.parse(trimmed);
    } catch {
      throw new Error('settings must be valid JSON');
    }
  }

  if (typeof value === 'object') return value;
  throw new Error('settings must be valid JSON');
}

function buildWebsiteSettingsResponse(tenant: any, storageConfigs: any[] = []) {
  return {
    siteTitle: toText(tenant?.siteTitle) || null,
    defaultPageTitle: toText(tenant?.defaultPageTitle) || null,
    titleSuffix: toText(tenant?.titleSuffix) || null,
    googleAnalyticsId: toText(tenant?.googleAnalyticsId) || null,
    googleTagManagerId: toText(tenant?.googleTagManagerId) || null,
    googleSearchConsoleVerification: toText(tenant?.googleSearchConsoleVerification) || null,
    facebookPixelId: toText(tenant?.facebookPixelId) || null,
    siteShortTitle: toText(tenant?.siteShortTitle) || null,
    siteDescription: toText(tenant?.siteDescription) || null,
    siteKeywords: toText(tenant?.siteKeywords) || null,
    siteLogo: normalizeWebsiteMedia(tenant?.siteLogo),
    defaultMetaImage: normalizeWebsiteMedia(tenant?.defaultMetaImage),
    favicon: normalizeWebsiteMedia(tenant?.favicon),
    chatAvatar: normalizeWebsiteMedia(tenant?.chatAvatar),
    storageDefaultConfigId: toPositiveInt(tenant?.storageDefaultConfigId),
    storageConfigs,
  };
}

function readWebsiteSettingsPayload(ctx: any) {
  const data = resolveRequestData(ctx);
  const payload: Record<string, unknown> = {};
  let storageDefaultConfigId: number | null | undefined;

  for (const field of WEBSITE_SETTINGS_TEXT_FIELDS) {
    if (!Object.prototype.hasOwnProperty.call(data, field)) continue;
    const value = toText(data[field as WebsiteSettingsTextField]) || null;
    validateWebsiteSettingsTextField(field, value);
    payload[field] = value;
  }

  for (const field of WEBSITE_SETTINGS_MEDIA_FIELDS) {
    if (!Object.prototype.hasOwnProperty.call(data, field)) continue;
    const rawValue = data[field as WebsiteSettingsMediaField];
    if (rawValue === null || rawValue === undefined || rawValue === '') {
      payload[field] = null;
      continue;
    }

    const mediaId = toPositiveInt((rawValue as any)?.id ?? rawValue);
    if (!mediaId) {
      throw new Error(`${field} must be a positive media id or null`);
    }

    payload[field] = mediaId;
  }

  if (Object.prototype.hasOwnProperty.call(data, 'storageDefaultConfigId')) {
    const rawValue = data.storageDefaultConfigId;
    if (rawValue === null || rawValue === undefined || rawValue === '') {
      storageDefaultConfigId = null;
    } else {
      const parsed = toPositiveInt(rawValue);
      if (!parsed) {
        throw new Error('storageDefaultConfigId must be a positive integer, null, or omitted');
      }

      storageDefaultConfigId = parsed;
    }
  }

  return {
    payload,
    storageDefaultConfigId,
  };
}

function readStorageConfigPayload(ctx: any, { partial = false }: { partial?: boolean } = {}) {
  const data = resolveRequestData(ctx);
  const payload: Record<string, unknown> = {};

  if (Object.prototype.hasOwnProperty.call(data, 'name')) {
    const name = toText(data.name);
    if (!name) throw new Error('name is required');
    payload.name = name;
  } else if (!partial) {
    throw new Error('name is required');
  }

  if (Object.prototype.hasOwnProperty.call(data, 'provider')) {
    const provider = toText(data.provider).toLowerCase();
    if (!provider || !STORAGE_PROVIDER_VALUES.includes(provider as any)) {
      throw new Error(buildStorageProviderError());
    }

    payload.provider = provider;
  } else if (!partial) {
    payload.provider = 'local';
  }

  if (Object.prototype.hasOwnProperty.call(data, 'basePath')) {
    const basePath = toText(data.basePath);
    if (!basePath) throw new Error('basePath is required');
    payload.basePath = basePath;
  } else if (!partial) {
    throw new Error('basePath is required');
  }

  if (Object.prototype.hasOwnProperty.call(data, 'publicBaseUrl')) {
    payload.publicBaseUrl = toText(data.publicBaseUrl) || null;
  }

  if (Object.prototype.hasOwnProperty.call(data, 'quotaGB')) {
    const rawValue = toText(data.quotaGB);
    if (!rawValue) {
      payload.quotaGB = null;
    } else {
      const parsed = Number(rawValue);
      if (!Number.isFinite(parsed) || parsed < 0) {
        throw new Error('quotaGB must be a non-negative number');
      }

      payload.quotaGB = String(parsed);
    }
  } else if (!partial) {
    payload.quotaGB = '5';
  }

  if (Object.prototype.hasOwnProperty.call(data, 'usedBytes')) {
    const rawValue = data.usedBytes;
    if (rawValue === null || rawValue === undefined || rawValue === '') {
      payload.usedBytes = '0';
    } else {
      const parsed = toNonNegativeInt(rawValue);
      if (parsed === null) {
        throw new Error('usedBytes must be a non-negative integer');
      }

      payload.usedBytes = String(parsed);
    }
  } else if (!partial) {
    payload.usedBytes = '0';
  }

  if (Object.prototype.hasOwnProperty.call(data, 'isActive')) {
    const parsed = toBoolean(data.isActive);
    if (parsed === null) throw new Error('isActive must be a boolean');
    payload.isActive = parsed;
  } else if (!partial) {
    payload.isActive = true;
  }

  if (Object.prototype.hasOwnProperty.call(data, 'settings')) {
    payload.settings = parseStorageSettingsValue(data.settings);
  }

  if (Object.prototype.hasOwnProperty.call(data, 'notes')) {
    payload.notes = toText(data.notes) || null;
  }

  return payload;
}

async function findCurrentTenantOrThrow(ctx: any) {
  const tenantId = resolveCurrentTenantId(ctx);
  const tenant = await strapi.db.query(TENANT_UID).findOne({
    where: { id: tenantId },
    populate: {
      siteLogo: {
        select: ['id', 'name', 'url', 'formats'],
      },
      defaultMetaImage: {
        select: ['id', 'name', 'url', 'formats'],
      },
      favicon: {
        select: ['id', 'name', 'url', 'formats'],
      },
      chatAvatar: {
        select: ['id', 'name', 'url', 'formats'],
      },
    },
  });

  if (!tenant?.id) {
    throw new Error('Tenant not found');
  }

  return tenant;
}

async function findTenantStorageConfigs(tenantId: number, defaultStorageConfigId: number | null) {
  const rows = await strapi.db.query(TENANT_STORAGE_UID).findMany({
    where: {
      tenant: {
        id: {
          $eq: tenantId,
        },
      },
    },
  });

  return (rows || [])
    .map((item: any) => normalizeStorageConfigResponse(item, defaultStorageConfigId))
    .sort((left, right) => {
      if (left.isDefault !== right.isDefault) return left.isDefault ? -1 : 1;
      return String(left.name || '').localeCompare(String(right.name || '')) || ((left.id || 0) - (right.id || 0));
    });
}

async function findTenantStorageConfigOrThrow(tenantId: number, storageConfigId: number) {
  const storageConfig = await strapi.db.query(TENANT_STORAGE_UID).findOne({
    where: {
      id: storageConfigId,
      tenant: {
        id: {
          $eq: tenantId,
        },
      },
    },
  });

  if (!storageConfig?.id) {
    throw new Error('Storage config not found');
  }

  return storageConfig;
}

async function syncTenantStorageDefaultFlags(tenantId: number, defaultStorageConfigId: number | null) {
  const rows = await strapi.db.query(TENANT_STORAGE_UID).findMany({
    where: {
      tenant: {
        id: {
          $eq: tenantId,
        },
      },
    },
    select: ['id', 'isDefault'],
  });

  for (const row of rows || []) {
    const id = toPositiveInt((row as any)?.id);
    if (!id) continue;

    const nextIsDefault = Boolean(defaultStorageConfigId && id === defaultStorageConfigId);
    if (Boolean((row as any)?.isDefault) === nextIsDefault) continue;

    await strapi.db.query(TENANT_STORAGE_UID).update({
      where: { id },
      data: {
        isDefault: nextIsDefault,
      },
    });
  }
}

async function validateDefaultStorageConfigId(tenantId: number, storageDefaultConfigId: number | null | undefined) {
  if (storageDefaultConfigId === undefined || storageDefaultConfigId === null) {
    return null;
  }

  const storageConfig = await findTenantStorageConfigOrThrow(tenantId, storageDefaultConfigId);
  return toPositiveInt(storageConfig.id);
}

async function loadWebsiteSettingsResponseForTenant(tenantId: number) {
  const tenant = await strapi.db.query(TENANT_UID).findOne({
    where: { id: tenantId },
    populate: {
      siteLogo: {
        select: ['id', 'name', 'url', 'formats'],
      },
      defaultMetaImage: {
        select: ['id', 'name', 'url', 'formats'],
      },
      favicon: {
        select: ['id', 'name', 'url', 'formats'],
      },
      chatAvatar: {
        select: ['id', 'name', 'url', 'formats'],
      },
    },
  });

  if (!tenant?.id) {
    throw new Error('Tenant not found');
  }

  const defaultStorageConfigId = toPositiveInt((tenant as any)?.storageDefaultConfigId);
  const storageConfigs = await findTenantStorageConfigs(tenant.id, defaultStorageConfigId);
  return buildWebsiteSettingsResponse(tenant, storageConfigs);
}

function shouldReturnBadRequest(errorMessage: string) {
  return [
    'must be a positive media id or null',
    'must match format',
    'storageDefaultConfigId must be a positive integer, null, or omitted',
    'storageDefaultConfigId must belong to the current tenant',
    'Storage config not found',
    'name is required',
    'basePath is required',
    'provider must be one of:',
    'quotaGB must be a non-negative number',
    'usedBytes must be a non-negative integer',
    'settings must be valid JSON',
    'isActive must be a boolean',
  ].some((fragment) => errorMessage.includes(fragment));
}

export default {
  async me(ctx: any) {
    try {
      const tenantContext = await buildTenantContextPayload(strapi, ctx);
      if (!tenantContext) {
        return ctx.notFound('Tenant not found');
      }

      ctx.body = {
        displayName: tenantContext.displayName,
        domain: tenantContext.domain,
        logo: tenantContext.logo,
        favicon: tenantContext.favicon,
        siteTitle: tenantContext.siteTitle,
        defaultPageTitle: tenantContext.defaultPageTitle,
        titleSuffix: tenantContext.titleSuffix,
        googleAnalyticsId: tenantContext.googleAnalyticsId,
        googleTagManagerId: tenantContext.googleTagManagerId,
        googleSearchConsoleVerification: tenantContext.googleSearchConsoleVerification,
        facebookPixelId: tenantContext.facebookPixelId,
        slogan: tenantContext.slogan,
        banner: tenantContext.banner,
        chatAvatar: tenantContext.chatAvatar,
      };
    } catch (error) {
      strapi.log.error('[tenant.me] unexpected error', error);
      return ctx.internalServerError('Failed to load tenant branding');
    }
  },

  async context(ctx: any) {
    try {
      const tenantContext = await buildTenantContextPayload(strapi, ctx);
      if (!tenantContext) {
        return ctx.notFound('Tenant not found');
      }

      ctx.body = tenantContext;
    } catch (error) {
      strapi.log.error('[tenant.context] unexpected error', error);
      return ctx.internalServerError('Failed to load tenant context');
    }
  },

  async getWebsiteSettings(ctx: any) {
    try {
      const tenantId = toPositiveInt(resolveCurrentTenantId(ctx));
      if (!tenantId) {
        throw new Error('Tenant not found');
      }

      ctx.body = {
        data: await loadWebsiteSettingsResponseForTenant(tenantId),
      };
    } catch (error: any) {
      if (error?.message === 'Tenant not found') {
        return ctx.notFound('Tenant not found');
      }

      strapi.log.error('[tenant.getWebsiteSettings] unexpected error', error);
      return ctx.internalServerError('Failed to load tenant website settings');
    }
  },

  async updateWebsiteSettings(ctx: any) {
    try {
      const tenant = await findCurrentTenantOrThrow(ctx);
      const { payload, storageDefaultConfigId } = readWebsiteSettingsPayload(ctx);

      if (storageDefaultConfigId !== undefined) {
        const validatedStorageDefaultConfigId = await validateDefaultStorageConfigId(tenant.id, storageDefaultConfigId);
        payload.storageDefaultConfigId = validatedStorageDefaultConfigId;
      }

      await strapi.db.query(TENANT_UID).update({
        where: { id: tenant.id },
        data: payload,
      });

      if (storageDefaultConfigId !== undefined) {
        await syncTenantStorageDefaultFlags(tenant.id, storageDefaultConfigId);
      }

      ctx.body = {
        data: await loadWebsiteSettingsResponseForTenant(tenant.id),
      };
    } catch (error: any) {
      if (error?.message === 'Tenant not found') {
        return ctx.notFound('Tenant not found');
      }

      const message = String(error?.message || '');

      if (shouldReturnBadRequest(message)) {
        return ctx.badRequest(error.message);
      }

      strapi.log.error('[tenant.updateWebsiteSettings] unexpected error', error);
      return ctx.internalServerError('Failed to update tenant website settings');
    }
  },

  async uploadWebsiteMedia(ctx: any) {
    try {
      const tenant = await findCurrentTenantOrThrow(ctx);
      const uploadFile = resolveUploadFile(ctx.request?.files);
      if (!uploadFile) {
        return ctx.badRequest('file is required');
      }

      ensureWebsiteMediaFileValid(uploadFile);

      const uploadService = strapi.plugin('upload').service('upload');
      const uploadedFiles = await uploadService.upload({
        data: {},
        files: [uploadFile],
      });

      const uploaded = Array.isArray(uploadedFiles) ? uploadedFiles[0] : uploadedFiles;
      if (!uploaded?.id) {
        throw new Error('Không nhận được dữ liệu media sau khi upload');
      }

      ctx.body = {
        data: normalizeWebsiteMedia(uploaded),
      };
    } catch (error: any) {
      if (error?.message === 'Tenant not found') {
        return ctx.notFound('Tenant not found');
      }

      const message = String(error?.message || '');
      if (
        message === 'file is required'
        || message.includes('Chỉ cho phép upload ảnh')
        || message.includes('vượt quá giới hạn 10MB')
      ) {
        return ctx.badRequest(message);
      }

      strapi.log.error('[tenant.uploadWebsiteMedia] unexpected error', error);
      return ctx.internalServerError('Failed to upload tenant website media');
    }
  },

  async createWebsiteStorageConfig(ctx: any) {
    try {
      const tenant = await findCurrentTenantOrThrow(ctx);
      const payload = readStorageConfigPayload(ctx);

      await strapi.db.query(TENANT_STORAGE_UID).create({
        data: {
          ...payload,
          tenant: tenant.id,
          isDefault: false,
        },
      });

      ctx.body = {
        data: await loadWebsiteSettingsResponseForTenant(tenant.id),
      };
    } catch (error: any) {
      if (error?.message === 'Tenant not found') {
        return ctx.notFound('Tenant not found');
      }

      const message = String(error?.message || '');
      if (shouldReturnBadRequest(message)) {
        return ctx.badRequest(error.message);
      }

      strapi.log.error('[tenant.createWebsiteStorageConfig] unexpected error', error);
      return ctx.internalServerError('Failed to create tenant storage config');
    }
  },

  async updateWebsiteStorageConfig(ctx: any) {
    try {
      const tenant = await findCurrentTenantOrThrow(ctx);
      const storageConfigId = toPositiveInt(ctx.params?.id);
      if (!storageConfigId) {
        return ctx.badRequest('Storage config id is required');
      }

      await findTenantStorageConfigOrThrow(tenant.id, storageConfigId);
      const payload = readStorageConfigPayload(ctx, { partial: true });

      await strapi.db.query(TENANT_STORAGE_UID).update({
        where: { id: storageConfigId },
        data: payload,
      });

      ctx.body = {
        data: await loadWebsiteSettingsResponseForTenant(tenant.id),
      };
    } catch (error: any) {
      if (error?.message === 'Tenant not found') {
        return ctx.notFound('Tenant not found');
      }

      const message = String(error?.message || '');
      if (shouldReturnBadRequest(message)) {
        return ctx.badRequest(error.message);
      }

      strapi.log.error('[tenant.updateWebsiteStorageConfig] unexpected error', error);
      return ctx.internalServerError('Failed to update tenant storage config');
    }
  },
};