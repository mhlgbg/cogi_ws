import { getBaseUrl } from '../../../utils/tenant-base-url';
import {
  findEntityByRef,
  mergeTenantWhere,
  parseOptionalPositiveInt,
  resolveCurrentTenantId,
  toText,
  whereByParam,
} from '../../../utils/tenant-scope';

const PHOTO_FRAME_CAMPAIGN_UID = 'api::photo-frame-campaign.photo-frame-campaign';
const TENANT_UID = 'api::tenant.tenant';
const TENANT_DOMAIN_UID = 'api::tenant-domain.tenant-domain';
const ROLE_FEATURE_UID = 'api::role-feature.role-feature';
const USER_TENANT_UID = 'api::user-tenant.user-tenant';
const USER_TENANT_ROLE_UID = 'api::user-tenant-role.user-tenant-role';
const PUBLIC_PATH_PREFIX = '/frame';
const SLUG_PATTERN = /^[a-z0-9-]+$/;
const STATUS_VALUES = ['draft', 'active', 'inactive'] as const;
const STORAGE_MODE_VALUES = ['none', 'private', 'public_gallery'] as const;
const PHOTO_SHAPE_VALUES = ['circle', 'rect', 'rounded_rect', 'ellipse'] as const;
const PHOTO_FIT_MODE_VALUES = ['cover', 'contain'] as const;
const PREVIEW_MODE_VALUES = ['dim', 'hide', 'show'] as const;
const OUTPUT_FORMAT_VALUES = ['png', 'jpeg'] as const;
const DEFAULT_MIN_ZOOM = 0.5;
const DEFAULT_MAX_ZOOM = 4;
const DEFAULT_ZOOM = 1;
const DEFAULT_OUTSIDE_OVERLAY_OPACITY = 0.45;
const DEFAULT_OUTPUT_QUALITY = 0.92;

type AuthUser = {
  id: number;
  username?: string | null;
  email?: string | null;
  blocked?: boolean | null;
  isPlatformAdmin?: boolean | null;
};

class PhotoFrameCampaignError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

function extractPayload(body: any): Record<string, unknown> {
  if (body?.data && typeof body.data === 'object' && !Array.isArray(body.data)) {
    return body.data as Record<string, unknown>;
  }

  if (body && typeof body === 'object' && !Array.isArray(body)) {
    return body as Record<string, unknown>;
  }

  return {};
}

function toRequiredText(value: unknown, label: string, maxLength?: number): string {
  const text = toText(value);
  if (!text) throw new PhotoFrameCampaignError(400, `${label} is required`);
  if (maxLength && text.length > maxLength) throw new PhotoFrameCampaignError(400, `${label} max length is ${maxLength}`);
  return text;
}

function toNullableText(value: unknown, maxLength?: number): string | null {
  const text = toText(value);
  if (!text) return null;
  if (maxLength && text.length > maxLength) throw new PhotoFrameCampaignError(400, `text max length is ${maxLength}`);
  return text;
}

function slugifyVietnamese(value: unknown): string {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[đĐ]/g, (char) => (char === 'Đ' ? 'D' : 'd'))
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-')
    .slice(0, 160)
    .replace(/-+$/g, '');
}

function ensureSlug(value: unknown, fallbackName?: unknown): string {
  const raw = toText(value) || slugifyVietnamese(fallbackName);
  const normalized = raw
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[đĐ]/g, (char) => (char === 'Đ' ? 'D' : 'd'))
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]+/g, '')
    .replace(/-{2,}/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 160);

  if (!normalized) throw new PhotoFrameCampaignError(400, 'slug is required');
  if (!SLUG_PATTERN.test(normalized)) throw new PhotoFrameCampaignError(400, 'slug is invalid');
  return normalized;
}

function toStatus(value: unknown): 'draft' | 'active' | 'inactive' {
  const normalized = toText(value).toLowerCase();
  if ((STATUS_VALUES as readonly string[]).includes(normalized)) return normalized as 'draft' | 'active' | 'inactive';
  return 'draft';
}

function toStorageMode(value: unknown): 'none' | 'private' | 'public_gallery' {
  const normalized = toText(value).toLowerCase();
  if ((STORAGE_MODE_VALUES as readonly string[]).includes(normalized)) return normalized as 'none' | 'private' | 'public_gallery';
  return 'none';
}

function toPositiveInteger(value: unknown, label: string, fallbackValue?: number): number {
  if ((value === null || value === undefined || value === '') && Number.isInteger(fallbackValue)) {
    return Number(fallbackValue);
  }
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) throw new PhotoFrameCampaignError(400, `${label} must be a positive integer`);
  return parsed;
}

function toFloat(value: unknown, fallbackValue: number): number {
  if (value === null || value === undefined || value === '') return fallbackValue;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallbackValue;
}

function toFiniteNumber(value: unknown, label: string, fallbackValue: number): number {
  if (value === null || value === undefined || value === '') return fallbackValue;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) throw new PhotoFrameCampaignError(400, `${label} must be a valid number`);
  return parsed;
}

function toBoolean(value: unknown, fallbackValue: boolean): boolean {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value !== 0;
  const text = toText(value).toLowerCase();
  if (!text) return fallbackValue;
  if (['true', '1', 'yes', 'on'].includes(text)) return true;
  if (['false', '0', 'no', 'off'].includes(text)) return false;
  return fallbackValue;
}

function toNullableDateTime(value: unknown, label: string): string | null {
  const text = toText(value);
  if (!text) return null;
  const date = new Date(text);
  if (Number.isNaN(date.getTime())) throw new PhotoFrameCampaignError(400, `${label} is invalid`);
  return date.toISOString();
}

function getMediaUrl(media: any): string {
  return toText(media?.url || media?.formats?.small?.url || media?.formats?.thumbnail?.url || media?.formats?.medium?.url);
}

function normalizeMedia(media: any) {
  if (!media) return null;
  return {
    id: media.id,
    documentId: media.documentId || null,
    name: media.name || '',
    alternativeText: media.alternativeText || '',
    url: getMediaUrl(media),
    width: Number(media.width || 0) || null,
    height: Number(media.height || 0) || null,
    mime: media.mime || '',
    size: Number(media.size || 0) || null,
  };
}

function getFallbackPhotoAreaWidth(row: any): number {
  const width = Number(row?.width || 1080);
  return Number.isFinite(width) && width > 0 ? width : 1080;
}

function getFallbackPhotoAreaHeight(row: any): number {
  const height = Number(row?.height || 1080);
  return Number.isFinite(height) && height > 0 ? height : 1080;
}

function normalizePhotoShape(value: unknown): 'circle' | 'rect' | 'rounded_rect' | 'ellipse' {
  const normalized = toText(value).toLowerCase();
  if ((PHOTO_SHAPE_VALUES as readonly string[]).includes(normalized)) {
    return normalized as 'circle' | 'rect' | 'rounded_rect' | 'ellipse';
  }
  return 'rect';
}

function normalizePhotoFitMode(value: unknown): 'cover' | 'contain' {
  const normalized = toText(value).toLowerCase();
  if ((PHOTO_FIT_MODE_VALUES as readonly string[]).includes(normalized)) {
    return normalized as 'cover' | 'contain';
  }
  return 'cover';
}

function normalizePreviewMode(value: unknown): 'dim' | 'hide' | 'show' {
  const normalized = toText(value).toLowerCase();
  if ((PREVIEW_MODE_VALUES as readonly string[]).includes(normalized)) {
    return normalized as 'dim' | 'hide' | 'show';
  }
  return 'dim';
}

function normalizeOutputFormat(value: unknown): 'png' | 'jpeg' {
  const normalized = toText(value).toLowerCase();
  if ((OUTPUT_FORMAT_VALUES as readonly string[]).includes(normalized)) {
    return normalized as 'png' | 'jpeg';
  }
  return 'png';
}

function clampNumber(value: number, minValue: number, maxValue: number): number {
  return Math.min(maxValue, Math.max(minValue, value));
}

function normalizePhotoAreaConfig(row: any) {
  const width = getFallbackPhotoAreaWidth(row);
  const height = getFallbackPhotoAreaHeight(row);
  const photoAreaX = toFloat(row?.photoAreaX, 0);
  const photoAreaY = toFloat(row?.photoAreaY, 0);
  const photoAreaWidth = toFloat(row?.photoAreaWidth, width);
  const photoAreaHeight = toFloat(row?.photoAreaHeight, height);
  const minZoom = clampNumber(toFloat(row?.minZoom, DEFAULT_MIN_ZOOM), 0.05, 20);
  const maxZoom = clampNumber(toFloat(row?.maxZoom, DEFAULT_MAX_ZOOM), minZoom, 20);
  const defaultZoom = clampNumber(toFloat(row?.defaultZoom, DEFAULT_ZOOM), minZoom, maxZoom);
  return {
    photoShape: normalizePhotoShape(row?.photoShape),
    photoAreaX,
    photoAreaY,
    photoAreaWidth: photoAreaWidth > 0 ? photoAreaWidth : width,
    photoAreaHeight: photoAreaHeight > 0 ? photoAreaHeight : height,
    photoFitMode: normalizePhotoFitMode(row?.photoFitMode),
    minZoom,
    maxZoom,
    defaultZoom,
    defaultOffsetX: toFloat(row?.defaultOffsetX, 0),
    defaultOffsetY: toFloat(row?.defaultOffsetY, 0),
    allowRotate: toBoolean(row?.allowRotate, true),
    showOutsidePhotoAreaInPreview: normalizePreviewMode(row?.showOutsidePhotoAreaInPreview),
    outsideOverlayOpacity: clampNumber(toFloat(row?.outsideOverlayOpacity, DEFAULT_OUTSIDE_OVERLAY_OPACITY), 0, 1),
    outputFormat: normalizeOutputFormat(row?.outputFormat),
    outputQuality: clampNumber(toFloat(row?.outputQuality, DEFAULT_OUTPUT_QUALITY), 0.1, 1),
  };
}

function normalizePublicTenant(tenant: any) {
  if (!tenant) return null;
  return {
    code: tenant.code || '',
    name: tenant.shortName || tenant.name || tenant.code || '',
    siteTitle: tenant.siteTitle || '',
    slogan: tenant.slogan || '',
    logoUrl: getMediaUrl(tenant.logo),
    faviconUrl: getMediaUrl(tenant.favicon) || getMediaUrl(tenant.logo),
  };
}

function normalizeOwner(owner: any) {
  if (!owner) return null;
  return {
    id: owner.id,
    documentId: owner.documentId || null,
    username: owner.username || '',
    email: owner.email || '',
    fullName: owner.fullName || '',
  };
}

function formatDateTime(value: unknown): string | null {
  const text = toText(value);
  return text || null;
}

function getTenantCode(ctx: any): string {
  return toText(ctx.state?.tenant?.code || ctx.get?.('x-tenant-code') || ctx.request?.header?.['x-tenant-code']).toLowerCase();
}

async function getUserTenantRoleIds(userId: number, tenantId: number | string): Promise<number[]> {
  const userTenant = await strapi.db.query(USER_TENANT_UID).findOne({
    where: {
      user: userId,
      tenant: tenantId,
      userTenantStatus: 'active',
    },
    select: ['id'],
  });

  const userTenantId = parseOptionalPositiveInt(userTenant?.id);
  if (!userTenantId) return [];

  const rows = await strapi.db.query(USER_TENANT_ROLE_UID).findMany({
    where: {
      userTenant: userTenantId,
      userTenantRoleStatus: 'active',
    },
    populate: {
      role: true,
    },
  });

  return (rows || [])
    .map((row: any) => parseOptionalPositiveInt(row?.role?.id ?? row?.role))
    .filter((value: number | null): value is number => Boolean(value));
}

async function getPermissionKeysForUser(userId: number, tenantId: number | string): Promise<Set<string>> {
  const roleIds = await getUserTenantRoleIds(userId, tenantId);
  if (roleIds.length === 0) return new Set();

  const mappings = await strapi.db.query(ROLE_FEATURE_UID).findMany({
    where: {
      role: {
        id: {
          $in: roleIds,
        },
      },
    },
    populate: ['feature'],
  });

  return new Set(
    (mappings || [])
      .map((item: any) => toText(item?.feature?.key).toLowerCase())
      .filter(Boolean),
  );
}

async function resolveAccessScope(ctx: any, authUser: AuthUser) {
  const tenantId = resolveCurrentTenantId(ctx);
  const permissionKeys = await getPermissionKeysForUser(authUser.id, tenantId);
  const canManageAll = Boolean(authUser?.isPlatformAdmin)
    || permissionKeys.has('photo-frame-campaign.manage.all');
  const canViewTenantOwners = canManageAll;
  const isSuperAdmin = Boolean(authUser?.isPlatformAdmin);
  return {
    tenantId,
    permissionKeys,
    canManageAll,
    canViewTenantOwners,
    isSuperAdmin,
  };
}

function mergeOwnershipWhere(baseWhere: Record<string, unknown>, accessScope: Awaited<ReturnType<typeof resolveAccessScope>>, authUser: AuthUser) {
  if (accessScope.canManageAll) return mergeTenantWhere(baseWhere, accessScope.tenantId);
  return mergeTenantWhere({
    $and: [
      baseWhere,
      {
        ownerUser: {
          id: {
            $eq: authUser.id,
          },
        },
      },
    ],
  }, accessScope.tenantId);
}

function buildKeywordWhere(keyword: string) {
  const q = toText(keyword);
  if (!q) return {};
  return {
    $or: [
      { name: { $containsi: q } },
      { slug: { $containsi: q } },
    ],
  };
}

async function ensureCampaignAccessible(ctx: any, authUser: AuthUser, accessScope: Awaited<ReturnType<typeof resolveAccessScope>>) {
  const campaign = await strapi.db.query(PHOTO_FRAME_CAMPAIGN_UID).findOne({
    where: mergeOwnershipWhere(whereByParam(ctx.params?.id) || {}, accessScope, authUser),
    populate: {
      frameImage: true,
      ownerUser: {
        select: ['id', 'documentId', 'username', 'email', 'fullName'],
      },
      tenant: {
        select: ['id', 'code', 'name'],
      },
    },
  });

  if (!campaign?.id) throw new PhotoFrameCampaignError(404, 'Photo frame campaign not found');
  return campaign;
}

async function ensureSlugUnique(slug: string, tenantId: number | string, excludeId?: number | null) {
  const where: Record<string, unknown> = {
    slug: { $eq: slug },
  };

  if (excludeId) {
    where.id = { $ne: excludeId };
  }

  const existing = await strapi.db.query(PHOTO_FRAME_CAMPAIGN_UID).findOne({
    where: mergeTenantWhere(where, tenantId),
    select: ['id'],
  });

  if (existing?.id) {
    throw new PhotoFrameCampaignError(409, 'slug already exists in current tenant');
  }
}

function validateFrameImage(frameImage: any) {
  const mime = toText(frameImage?.mime).toLowerCase();
  if (mime && mime !== 'image/png') {
    throw new PhotoFrameCampaignError(400, 'frameImage must be a PNG image');
  }
}

function validateTimeRange(startAt: string | null, endAt: string | null) {
  if (startAt && endAt && new Date(startAt).getTime() > new Date(endAt).getTime()) {
    throw new PhotoFrameCampaignError(400, 'startAt must be earlier than or equal to endAt');
  }
}

async function findTenant(tenantId: number | string) {
  return strapi.db.query(TENANT_UID).findOne({
    where: { id: tenantId },
    select: ['id', 'name', 'code', 'defaultPublicRoute'],
  });
}

async function findTenantOwners(tenantId: number | string) {
  const userTenants = await strapi.db.query(USER_TENANT_UID).findMany({
    where: {
      tenant: tenantId,
      userTenantStatus: 'active',
    },
    populate: {
      user: {
        select: ['id', 'documentId', 'username', 'email', 'fullName'],
      },
    },
    orderBy: [{ createdAt: 'desc' }],
  });

  const seen = new Set<number>();
  return (userTenants || [])
    .map((row: any) => row?.user)
    .filter((user: any) => {
      const userId = parseOptionalPositiveInt(user?.id);
      if (!userId || seen.has(userId)) return false;
      seen.add(userId);
      return true;
    })
    .map((user: any) => normalizeOwner(user));
}

async function findTenantList() {
  const rows = await strapi.db.query(TENANT_UID).findMany({
    where: {
      tenantStatus: 'active',
    },
    select: ['id', 'name', 'code'],
    orderBy: [{ name: 'asc' }],
  });

  return (rows || []).map((row: any) => ({
    id: row.id,
    code: row.code || '',
    name: row.name || row.code || `Tenant #${row.id}`,
  }));
}

async function findPrimaryTenantDomain(tenantId: number | string): Promise<string> {
  const row = await strapi.db.query(TENANT_DOMAIN_UID).findOne({
    where: {
      tenant: tenantId,
      tenantDomainStatus: 'active',
      isPrimary: true,
    },
    select: ['domain'],
  });
  return toText(row?.domain).toLowerCase();
}

function trimTrailingSlash(value: string) {
  return String(value || '').replace(/\/+$/, '');
}

function buildFramePublicPath(slug: string, tenantCode: string, baseUrl: string, primaryDomain: string) {
  const normalizedBaseUrl = trimTrailingSlash(baseUrl);
  const normalizedPath = `${PUBLIC_PATH_PREFIX}/${encodeURIComponent(slug)}`;
  if (primaryDomain) {
    return `${normalizedBaseUrl}${normalizedPath}`;
  }

  const tenantPathPrefix = tenantCode ? `/t/${encodeURIComponent(tenantCode)}` : '';
  return `${normalizedBaseUrl}${tenantPathPrefix}${normalizedPath}`;
}

async function buildPublicUrl(ctx: any, campaign: any, tenant?: any) {
  const resolvedTenant = tenant || campaign?.tenant || await findTenant(resolveCurrentTenantId(ctx));
  const tenantId = resolvedTenant?.id || resolveCurrentTenantId(ctx);
  const baseUrl = trimTrailingSlash(await getBaseUrl(ctx, { tenantId }));
  const primaryDomain = await findPrimaryTenantDomain(tenantId);
  const tenantCode = toText(resolvedTenant?.code || getTenantCode(ctx));
  return buildFramePublicPath(toText(campaign?.slug), tenantCode, baseUrl, primaryDomain);
}

function normalizeCampaign(row: any, publicUrl: string, options: { includeOwner?: boolean } = {}) {
  const photoAreaConfig = normalizePhotoAreaConfig(row);
  return {
    id: row.id,
    documentId: row.documentId || null,
    name: row.name || '',
    slug: row.slug || '',
    description: row.description || '',
    status: row.status || 'draft',
    generatedImageStorageMode: row.generatedImageStorageMode || 'none',
    width: Number(row.width || 1080),
    height: Number(row.height || 1080),
    ...photoAreaConfig,
    startAt: formatDateTime(row.startAt),
    endAt: formatDateTime(row.endAt),
    createdAt: formatDateTime(row.createdAt),
    updatedAt: formatDateTime(row.updatedAt),
    frameImage: normalizeMedia(row.frameImage),
    ownerUser: options.includeOwner ? normalizeOwner(row.ownerUser) : normalizeOwner(row.ownerUser),
    tenant: row.tenant
      ? {
          id: row.tenant.id,
          code: row.tenant.code || '',
          name: row.tenant.name || row.tenant.code || '',
        }
      : null,
    publicPath: `${PUBLIC_PATH_PREFIX}/${encodeURIComponent(toText(row.slug))}`,
    publicUrl,
  };
}

function normalizePublicCampaign(row: any) {
  const photoAreaConfig = normalizePhotoAreaConfig(row);
  return {
    name: row?.name || '',
    slug: row?.slug || '',
    description: row?.description || '',
    frameImage: normalizeMedia(row?.frameImage),
    width: Number(row?.width || 1080),
    height: Number(row?.height || 1080),
    ...photoAreaConfig,
    status: row?.status || 'draft',
    startAt: formatDateTime(row?.startAt),
    endAt: formatDateTime(row?.endAt),
    generatedImageStorageMode: row?.generatedImageStorageMode || 'none',
    tenant: normalizePublicTenant(row?.tenant),
  };
}

export function resolvePublicAvailability(campaign: any) {
  if (!campaign) {
    throw new PhotoFrameCampaignError(404, 'Không tìm thấy chiến dịch khung hình.');
  }

  const now = Date.now();
  const status = toText(campaign?.status).toLowerCase();
  const startAtTime = campaign?.startAt ? new Date(campaign.startAt).getTime() : null;
  const endAtTime = campaign?.endAt ? new Date(campaign.endAt).getTime() : null;

  if (status !== 'active') {
    return {
      code: 'inactive',
      message: 'Chiến dịch hiện chưa hoạt động.',
    };
  }

  if (Number.isFinite(startAtTime) && startAtTime !== null && startAtTime > now) {
    return {
      code: 'scheduled',
      message: 'Chiến dịch chưa bắt đầu.',
      startAt: formatDateTime(campaign?.startAt),
    };
  }

  if (Number.isFinite(endAtTime) && endAtTime !== null && endAtTime < now) {
    return {
      code: 'ended',
      message: 'Chiến dịch đã kết thúc.',
      endAt: formatDateTime(campaign?.endAt),
    };
  }

  return {
    code: 'active',
    message: '',
  };
}

function buildMutationPayload(payload: Record<string, unknown>) {
  const name = toRequiredText(payload.name, 'name', 200);
  const slug = ensureSlug(payload.slug, name);
  const description = toNullableText(payload.description);
  const width = toPositiveInteger(payload.width, 'width', 1080);
  const height = toPositiveInteger(payload.height, 'height', 1080);
  const photoShape = normalizePhotoShape(payload.photoShape);
  const photoAreaX = toFiniteNumber(payload.photoAreaX, 'photoAreaX', 0);
  const photoAreaY = toFiniteNumber(payload.photoAreaY, 'photoAreaY', 0);
  const photoAreaWidth = toFiniteNumber(payload.photoAreaWidth, 'photoAreaWidth', width);
  const photoAreaHeight = toFiniteNumber(payload.photoAreaHeight, 'photoAreaHeight', height);
  const photoFitMode = normalizePhotoFitMode(payload.photoFitMode);
  const minZoom = clampNumber(toFiniteNumber(payload.minZoom, 'minZoom', DEFAULT_MIN_ZOOM), 0.05, 20);
  const maxZoom = clampNumber(toFiniteNumber(payload.maxZoom, 'maxZoom', DEFAULT_MAX_ZOOM), minZoom, 20);
  const defaultZoom = clampNumber(toFiniteNumber(payload.defaultZoom, 'defaultZoom', DEFAULT_ZOOM), minZoom, maxZoom);
  const defaultOffsetX = toFiniteNumber(payload.defaultOffsetX, 'defaultOffsetX', 0);
  const defaultOffsetY = toFiniteNumber(payload.defaultOffsetY, 'defaultOffsetY', 0);
  const allowRotate = toBoolean(payload.allowRotate, true);
  const showOutsidePhotoAreaInPreview = normalizePreviewMode(payload.showOutsidePhotoAreaInPreview);
  const outsideOverlayOpacity = clampNumber(toFiniteNumber(payload.outsideOverlayOpacity, 'outsideOverlayOpacity', DEFAULT_OUTSIDE_OVERLAY_OPACITY), 0, 1);
  const outputFormat = normalizeOutputFormat(payload.outputFormat);
  const outputQuality = clampNumber(toFiniteNumber(payload.outputQuality, 'outputQuality', DEFAULT_OUTPUT_QUALITY), 0.1, 1);
  const status = toStatus(payload.status);
  const generatedImageStorageMode = toStorageMode(payload.generatedImageStorageMode);
  const startAt = toNullableDateTime(payload.startAt, 'startAt');
  const endAt = toNullableDateTime(payload.endAt, 'endAt');
  validateTimeRange(startAt, endAt);
  if (photoAreaWidth <= 0) throw new PhotoFrameCampaignError(400, 'photoAreaWidth must be greater than 0');
  if (photoAreaHeight <= 0) throw new PhotoFrameCampaignError(400, 'photoAreaHeight must be greater than 0');

  return {
    name,
    slug,
    description,
    width,
    height,
    photoShape,
    photoAreaX,
    photoAreaY,
    photoAreaWidth,
    photoAreaHeight,
    photoFitMode,
    minZoom,
    maxZoom,
    defaultZoom,
    defaultOffsetX,
    defaultOffsetY,
    allowRotate,
    showOutsidePhotoAreaInPreview,
    outsideOverlayOpacity,
    outputFormat,
    outputQuality,
    status,
    generatedImageStorageMode,
    startAt,
    endAt,
    frameImage: payload.frameImage ?? null,
  };
}

export async function findPublicCampaignBySlug(ctx: any, slug: string) {
  const tenantId = ctx.state?.tenant?.id ?? ctx.state?.tenantId;
  if (!tenantId) {
    throw new PhotoFrameCampaignError(404, 'Không tìm thấy chiến dịch khung hình.');
  }

  return strapi.db.query(PHOTO_FRAME_CAMPAIGN_UID).findOne({
    where: mergeTenantWhere({
      slug: {
        $eq: slug,
      },
    }, tenantId),
    populate: {
      frameImage: true,
      tenant: {
        select: ['id', 'code', 'name', 'shortName', 'siteTitle', 'slogan'],
        populate: {
          logo: {
            select: ['url'],
          },
          favicon: {
            select: ['url'],
          },
        },
      },
    },
  });
}

export async function getPublicPhotoFrameCampaign(ctx: any) {
  const slug = ensureSlug(ctx.params?.slug);
  const campaign = await findPublicCampaignBySlug(ctx, slug);
  const availability = resolvePublicAvailability(campaign);

  return {
    availability,
    campaign: normalizePublicCampaign(campaign),
  };
}

export async function getPhotoFrameCampaignFormOptions(ctx: any, authUser: AuthUser) {
  const accessScope = await resolveAccessScope(ctx, authUser);
  const tenant = await findTenant(accessScope.tenantId);
  const primaryDomain = await findPrimaryTenantDomain(accessScope.tenantId);
  const baseUrl = trimTrailingSlash(await getBaseUrl(ctx, { tenantId: accessScope.tenantId }));
  const tenantCode = toText(tenant?.code || getTenantCode(ctx));
  return {
    statuses: [...STATUS_VALUES],
    storageModes: [
      { value: 'none', label: 'Không lưu ảnh', description: 'Ảnh kết quả sẽ không được lưu trên server.' },
      { value: 'private', label: 'Lưu riêng tư', description: 'Ảnh kết quả có thể được lưu để owner/admin xem nội bộ.' },
      { value: 'public_gallery', label: 'Lưu và cho phép thư viện công khai', description: 'Chuẩn bị cho thư viện công khai sau này, cần consent ở bước public.' },
    ],
    photoShapes: [
      { value: 'rect', label: 'Hình chữ nhật' },
      { value: 'rounded_rect', label: 'Chữ nhật bo góc' },
      { value: 'circle', label: 'Hình tròn' },
      { value: 'ellipse', label: 'Ellipse' },
    ],
    photoFitModes: [
      { value: 'cover', label: 'Cover', description: 'Ảnh luôn phủ kín vùng ảnh.' },
      { value: 'contain', label: 'Contain', description: 'Ảnh nằm trọn trong vùng ảnh và có thể chừa khoảng trống.' },
    ],
    previewModes: [
      { value: 'dim', label: 'Làm mờ ngoài vùng ảnh' },
      { value: 'hide', label: 'Ẩn ngoài vùng ảnh' },
      { value: 'show', label: 'Hiện toàn bộ ảnh' },
    ],
    outputFormats: [
      { value: 'png', label: 'PNG' },
      { value: 'jpeg', label: 'JPEG' },
    ],
    defaults: {
      photoShape: 'rect',
      photoAreaX: 0,
      photoAreaY: 0,
      photoAreaWidth: 1080,
      photoAreaHeight: 1080,
      photoFitMode: 'cover',
      minZoom: DEFAULT_MIN_ZOOM,
      maxZoom: DEFAULT_MAX_ZOOM,
      defaultZoom: DEFAULT_ZOOM,
      defaultOffsetX: 0,
      defaultOffsetY: 0,
      allowRotate: true,
      showOutsidePhotoAreaInPreview: 'dim',
      outsideOverlayOpacity: DEFAULT_OUTSIDE_OVERLAY_OPACITY,
      outputFormat: 'png',
      outputQuality: DEFAULT_OUTPUT_QUALITY,
    },
    tenant: tenant
      ? {
          id: tenant.id,
          code: tenant.code || '',
          name: tenant.name || tenant.code || '',
        }
      : null,
    owners: accessScope.canViewTenantOwners ? await findTenantOwners(accessScope.tenantId) : [],
    tenants: accessScope.isSuperAdmin ? await findTenantList() : [],
    canManageAll: accessScope.canManageAll,
    canFilterOwners: accessScope.canViewTenantOwners,
    canFilterTenants: accessScope.isSuperAdmin,
    recommendedFrameNotice: 'Khuyến nghị sử dụng PNG nền trong suốt. Khung sẽ được đặt phía trên ảnh của người dùng.',
    publicPathTemplate: `${PUBLIC_PATH_PREFIX}/:slug`,
    publicUrlTemplate: buildFramePublicPath(':slug', tenantCode, baseUrl, primaryDomain),
  };
}

export async function listPhotoFrameCampaigns(ctx: any, authUser: AuthUser) {
  const accessScope = await resolveAccessScope(ctx, authUser);
  const query = ctx.request?.query || {};
  const page = Math.max(1, Number(query.page || 1) || 1);
  const pageSize = Math.max(1, Math.min(100, Number(query.pageSize || 10) || 10));
  const start = (page - 1) * pageSize;
  const andWhere: Array<Record<string, unknown>> = [];

  const keywordWhere = buildKeywordWhere(query.q);
  if (Object.keys(keywordWhere).length > 0) andWhere.push(keywordWhere);

  const status = toText(query.status).toLowerCase();
  if (status) {
    andWhere.push({ status: { $eq: status } });
  }

  const storageMode = toText(query.generatedImageStorageMode).toLowerCase();
  if (storageMode) {
    andWhere.push({ generatedImageStorageMode: { $eq: storageMode } });
  }

  if (accessScope.canViewTenantOwners) {
    const ownerId = parseOptionalPositiveInt(query.ownerId);
    if (ownerId) {
      andWhere.push({ ownerUser: { id: { $eq: ownerId } } });
    }
  }

  const baseWhere = andWhere.length > 0 ? { $and: andWhere } : {};
  const where = mergeOwnershipWhere(baseWhere, accessScope, authUser);

  const [rows, total, tenant] = await Promise.all([
    strapi.db.query(PHOTO_FRAME_CAMPAIGN_UID).findMany({
      where,
      populate: {
        frameImage: true,
        ownerUser: {
          select: ['id', 'documentId', 'username', 'email', 'fullName'],
        },
        tenant: {
          select: ['id', 'code', 'name'],
        },
      },
      orderBy: [{ createdAt: 'desc' }],
      offset: start,
      limit: pageSize,
    }),
    strapi.db.query(PHOTO_FRAME_CAMPAIGN_UID).count({ where }),
    findTenant(accessScope.tenantId),
  ]);

  const data = await Promise.all(
    (rows || []).map(async (row: any) => normalizeCampaign(row, await buildPublicUrl(ctx, row, tenant), { includeOwner: accessScope.canViewTenantOwners })),
  );

  return {
    data,
    pagination: {
      page,
      pageSize,
      pageCount: Math.max(1, Math.ceil(total / pageSize)),
      total,
    },
    permissions: {
      canManageAll: accessScope.canManageAll,
      canFilterOwners: accessScope.canViewTenantOwners,
      canFilterTenants: accessScope.isSuperAdmin,
    },
  };
}

export async function getPhotoFrameCampaignDetail(ctx: any, authUser: AuthUser) {
  const accessScope = await resolveAccessScope(ctx, authUser);
  const campaign = await ensureCampaignAccessible(ctx, authUser, accessScope);
  return normalizeCampaign(campaign, await buildPublicUrl(ctx, campaign), { includeOwner: true });
}

export async function createPhotoFrameCampaign(ctx: any, authUser: AuthUser) {
  const accessScope = await resolveAccessScope(ctx, authUser);
  const payload = buildMutationPayload(extractPayload(ctx.request?.body));
  await ensureSlugUnique(payload.slug, accessScope.tenantId);

  if (!payload.frameImage) {
    throw new PhotoFrameCampaignError(400, 'frameImage is required');
  }

  const frameImage = await findEntityByRef('plugin::upload.file', payload.frameImage);
  if (frameImage) validateFrameImage(frameImage);

  const created = await strapi.db.query(PHOTO_FRAME_CAMPAIGN_UID).create({
    data: {
      ...payload,
      tenant: accessScope.tenantId,
      ownerUser: authUser.id,
    },
  });

  const populated = await strapi.db.query(PHOTO_FRAME_CAMPAIGN_UID).findOne({
    where: { id: created.id },
    populate: {
      frameImage: true,
      ownerUser: {
        select: ['id', 'documentId', 'username', 'email', 'fullName'],
      },
      tenant: {
        select: ['id', 'code', 'name'],
      },
    },
  });

  return normalizeCampaign(populated ?? created, await buildPublicUrl(ctx, populated ?? created), { includeOwner: true });
}

export async function updatePhotoFrameCampaign(ctx: any, authUser: AuthUser) {
  const accessScope = await resolveAccessScope(ctx, authUser);
  const existing = await ensureCampaignAccessible(ctx, authUser, accessScope);
  const payload = buildMutationPayload(extractPayload(ctx.request?.body));
  await ensureSlugUnique(payload.slug, accessScope.tenantId, existing.id);

  if (!payload.frameImage) {
    payload.frameImage = existing.frameImage?.id || existing.frameImage || null;
  }

  if (!payload.frameImage) {
    throw new PhotoFrameCampaignError(400, 'frameImage is required');
  }

  const frameImageRef = parseOptionalPositiveInt((payload.frameImage as any)?.id ?? payload.frameImage);
  const frameImage = frameImageRef
    ? await findEntityByRef('plugin::upload.file', frameImageRef)
    : null;
  if (frameImage) validateFrameImage(frameImage);

  const updated = await strapi.db.query(PHOTO_FRAME_CAMPAIGN_UID).update({
    where: { id: existing.id },
    data: {
      ...payload,
      tenant: accessScope.tenantId,
      ownerUser: existing.ownerUser?.id || authUser.id,
    },
  });

  const populated = await strapi.db.query(PHOTO_FRAME_CAMPAIGN_UID).findOne({
    where: { id: existing.id },
    populate: {
      frameImage: true,
      ownerUser: {
        select: ['id', 'documentId', 'username', 'email', 'fullName'],
      },
      tenant: {
        select: ['id', 'code', 'name'],
      },
    },
  });

  return normalizeCampaign(populated ?? updated, await buildPublicUrl(ctx, populated ?? updated), { includeOwner: true });
}

export async function togglePhotoFrameCampaignStatus(ctx: any, authUser: AuthUser) {
  const accessScope = await resolveAccessScope(ctx, authUser);
  const existing = await ensureCampaignAccessible(ctx, authUser, accessScope);
  const requestedStatus = toStatus(extractPayload(ctx.request?.body).status);
  const nextStatus = requestedStatus === 'draft'
    ? (existing.status === 'active' ? 'inactive' : 'active')
    : requestedStatus;

  const updated = await strapi.db.query(PHOTO_FRAME_CAMPAIGN_UID).update({
    where: { id: existing.id },
    data: { status: nextStatus },
  });

  const populated = await strapi.db.query(PHOTO_FRAME_CAMPAIGN_UID).findOne({
    where: { id: existing.id },
    populate: {
      frameImage: true,
      ownerUser: {
        select: ['id', 'documentId', 'username', 'email', 'fullName'],
      },
      tenant: {
        select: ['id', 'code', 'name'],
      },
    },
  });

  return normalizeCampaign(populated ?? updated, await buildPublicUrl(ctx, populated ?? updated), { includeOwner: true });
}

export async function deletePhotoFrameCampaign(ctx: any, authUser: AuthUser) {
  const accessScope = await resolveAccessScope(ctx, authUser);
  const existing = await ensureCampaignAccessible(ctx, authUser, accessScope);
  await strapi.db.query(PHOTO_FRAME_CAMPAIGN_UID).delete({
    where: { id: existing.id },
  });
  return { id: existing.id, deleted: true };
}