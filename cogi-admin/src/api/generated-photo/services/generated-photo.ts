import fs from 'node:fs/promises';
import path from 'node:path';

import storageService from '../../../services/storage-service';
import { mergeTenantWhere, parseOptionalPositiveInt, resolveCurrentTenantId, toText, whereByParam } from '../../../utils/tenant-scope';

const GENERATED_PHOTO_UID = 'api::generated-photo.generated-photo';
const PHOTO_FRAME_CAMPAIGN_UID = 'api::photo-frame-campaign.photo-frame-campaign';
const FILE_ASSET_UID = 'api::file-asset.file-asset';
const ROLE_FEATURE_UID = 'api::role-feature.role-feature';
const USER_TENANT_UID = 'api::user-tenant.user-tenant';
const USER_TENANT_ROLE_UID = 'api::user-tenant-role.user-tenant-role';

type AuthUser = {
  id: number;
  username?: string | null;
  email?: string | null;
  blocked?: boolean | null;
  isPlatformAdmin?: boolean | null;
};

class GeneratedPhotoError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

function extractBody(body: any): Record<string, unknown> {
  if (body?.data && typeof body.data === 'object' && !Array.isArray(body.data)) return body.data as Record<string, unknown>;
  if (body && typeof body === 'object' && !Array.isArray(body)) return body as Record<string, unknown>;
  return {};
}

function toBoolean(value: unknown, fallbackValue = false): boolean {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value !== 0;
  const text = toText(value).toLowerCase();
  if (!text) return fallbackValue;
  if (['true', '1', 'yes', 'on'].includes(text)) return true;
  if (['false', '0', 'no', 'off'].includes(text)) return false;
  return fallbackValue;
}

function toGeneratedPhotoStatus(value: unknown): 'active' | 'hidden' {
  return toText(value).toLowerCase() === 'hidden' ? 'hidden' : 'active';
}

function resolveUploadFile(rawFiles: any) {
  if (!rawFiles) return null;
  const direct = rawFiles.file || rawFiles.image || rawFiles.files || rawFiles;
  if (Array.isArray(direct)) return direct[0] || null;
  return direct || null;
}

function buildStoredFileName(campaignSlug: string, outputFormat: string) {
  const safeSlug = toText(campaignSlug).replace(/[^a-z0-9-]+/gi, '-').replace(/-{2,}/g, '-').replace(/^-+|-+$/g, '').toLowerCase() || 'frame';
  return `${safeSlug}-${Date.now()}.${outputFormat === 'jpeg' ? 'jpg' : 'png'}`;
}

function resolveStorageRoot() {
  const configuredRoot = toText(process.env.STORAGE_ROOT) || './storage';
  return path.isAbsolute(configuredRoot)
    ? configuredRoot
    : path.resolve(process.cwd(), configuredRoot);
}

function normalizeImageFile(row: any) {
  if (!row) return null;
  return {
    id: row.id,
    fileAssetId: Number(row.id || 0) || null,
    code: row.code || '',
    originalName: row.originalName || row.fileName || '',
    fileName: row.fileName || '',
    mimeType: row.mimeType || '',
    size: Number(row.size || 0) || 0,
    provider: row.provider || 'local',
    storageProvider: row.provider || 'local',
    url: row.url || '',
  };
}

function normalizeUser(row: any) {
  if (!row) return null;
  return {
    id: row.id,
    username: row.username || '',
    email: row.email || '',
    fullName: row.fullName || '',
  };
}

function normalizeGeneratedPhoto(row: any) {
  if (!row) return null;
  return {
    id: row.id,
    documentId: row.documentId || null,
    sessionId: row.sessionId || null,
    consentPublicGallery: row.consentPublicGallery === true,
    status: row.status || 'active',
    originalFilename: row.originalFilename || row.image?.originalName || '',
    mimeType: row.mimeType || row.image?.mimeType || '',
    fileSize: Number(row.fileSize || row.image?.size || 0) || 0,
    width: Number(row.width || 0) || null,
    height: Number(row.height || 0) || null,
    createdAt: row.createdAt || null,
    updatedAt: row.updatedAt || null,
    user: normalizeUser(row.user),
    campaign: row.campaign
      ? {
          id: row.campaign.id,
          name: row.campaign.name || '',
          slug: row.campaign.slug || '',
          generatedImageStorageMode: row.campaign.generatedImageStorageMode || 'none',
        }
      : null,
    image: normalizeImageFile(row.image),
  };
}

async function findPublicCampaignBySlug(ctx: any, slug: string) {
  const tenantId = ctx.state?.tenant?.id ?? ctx.state?.tenantId;
  if (!tenantId) {
    throw new GeneratedPhotoError(404, 'Không tìm thấy chiến dịch khung hình.');
  }

  return strapi.db.query(PHOTO_FRAME_CAMPAIGN_UID).findOne({
    where: mergeTenantWhere({
      slug: {
        $eq: slug,
      },
    }, tenantId),
    populate: {
      tenant: {
        select: ['id', 'code', 'name'],
      },
    },
  });
}

function resolvePublicAvailability(campaign: any) {
  if (!campaign) {
    throw new GeneratedPhotoError(404, 'Không tìm thấy chiến dịch khung hình.');
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
    };
  }

  if (Number.isFinite(endAtTime) && endAtTime !== null && endAtTime < now) {
    return {
      code: 'ended',
      message: 'Chiến dịch đã kết thúc.',
    };
  }

  return {
    code: 'active',
    message: '',
  };
}

async function getUserTenantRoleIds(userId: number, tenantId: number | string): Promise<number[]> {
  const userTenant = await strapi.db.query(USER_TENANT_UID).findOne({
    where: { user: userId, tenant: tenantId, userTenantStatus: 'active' },
    select: ['id'],
  });
  const userTenantId = parseOptionalPositiveInt(userTenant?.id);
  if (!userTenantId) return [];

  const rows = await strapi.db.query(USER_TENANT_ROLE_UID).findMany({
    where: { userTenant: userTenantId, userTenantRoleStatus: 'active' },
    populate: { role: true },
  });

  return (rows || []).map((row: any) => parseOptionalPositiveInt(row?.role?.id ?? row?.role)).filter((value: number | null): value is number => Boolean(value));
}

async function getPermissionKeysForUser(userId: number, tenantId: number | string): Promise<Set<string>> {
  const roleIds = await getUserTenantRoleIds(userId, tenantId);
  if (roleIds.length === 0) return new Set();
  const mappings = await strapi.db.query(ROLE_FEATURE_UID).findMany({
    where: { role: { id: { $in: roleIds } } },
    populate: ['feature'],
  });
  return new Set((mappings || []).map((item: any) => toText(item?.feature?.key).toLowerCase()).filter(Boolean));
}

async function resolveAccessScope(ctx: any, authUser: AuthUser) {
  const tenantId = resolveCurrentTenantId(ctx);
  const permissionKeys = await getPermissionKeysForUser(authUser.id, tenantId);
  return {
    tenantId,
    canManageAll: Boolean(authUser?.isPlatformAdmin) || permissionKeys.has('photo-frame-campaign.manage.all'),
  };
}

async function findManagedCampaignOrThrow(campaignId: unknown, ctx: any, authUser: AuthUser, accessScope?: Awaited<ReturnType<typeof resolveAccessScope>>) {
  const resolvedScope = accessScope || await resolveAccessScope(ctx, authUser);
  const where = whereByParam(campaignId);
  if (!where) throw new GeneratedPhotoError(404, 'Photo frame campaign not found');

  const campaignWhere = resolvedScope.canManageAll
    ? mergeTenantWhere(where, resolvedScope.tenantId)
    : mergeTenantWhere({
        $and: [where, { ownerUser: { id: { $eq: authUser.id } } }],
      }, resolvedScope.tenantId);

  const campaign = await strapi.db.query(PHOTO_FRAME_CAMPAIGN_UID).findOne({
    where: campaignWhere,
    select: ['id', 'name', 'slug', 'generatedImageStorageMode'],
    populate: {
      ownerUser: { select: ['id'] },
      tenant: { select: ['id', 'code', 'name'] },
    },
  });
  if (!campaign?.id) throw new GeneratedPhotoError(404, 'Photo frame campaign not found');
  return campaign;
}

async function findGeneratedPhotoOrThrow(id: unknown, ctx: any, authUser: AuthUser) {
  const accessScope = await resolveAccessScope(ctx, authUser);
  const baseWhere = whereByParam(id);
  if (!baseWhere) throw new GeneratedPhotoError(404, 'GeneratedPhoto not found');

  const where = accessScope.canManageAll
    ? mergeTenantWhere(baseWhere, accessScope.tenantId)
    : mergeTenantWhere({
        $and: [baseWhere, { campaign: { ownerUser: { id: { $eq: authUser.id } } } }],
      }, accessScope.tenantId);

  const generatedPhoto = await strapi.db.query(GENERATED_PHOTO_UID).findOne({
    where,
    populate: {
      image: true,
      user: { select: ['id', 'username', 'email', 'fullName'] },
      campaign: { select: ['id', 'name', 'slug', 'generatedImageStorageMode'] },
      tenant: { select: ['id', 'code'] },
    },
  });
  if (!generatedPhoto?.id) throw new GeneratedPhotoError(404, 'GeneratedPhoto not found');
  return { generatedPhoto, accessScope };
}

async function removeStoredFileAsset(fileAsset: any) {
  if (!fileAsset?.id) return;
  const provider = toText(fileAsset?.provider).toLowerCase() || 'local';
  if (provider === 'local') {
    const relativePath = toText(fileAsset?.relativePath || '');
    if (relativePath) {
      const absolutePath = path.join(resolveStorageRoot(), ...relativePath.split('/'));
      try {
        await fs.unlink(absolutePath);
      } catch {
        // Ignore local cleanup errors if the file is already absent.
      }
    }
  }
  await strapi.db.query(FILE_ASSET_UID).delete({ where: { id: fileAsset.id } });
}

function buildGeneratedPhotoListWhere(query: Record<string, unknown>, campaignId: number) {
  const andWhere: Array<Record<string, unknown>> = [{ campaign: { id: { $eq: campaignId } } }];
  if (toText(query.status)) {
    andWhere.push({ status: { $eq: toGeneratedPhotoStatus(query.status) } });
  }
  if (toText(query.consent).toLowerCase() === 'true') andWhere.push({ consentPublicGallery: { $eq: true } });
  if (toText(query.consent).toLowerCase() === 'false') andWhere.push({ consentPublicGallery: { $eq: false } });
  const userMode = toText(query.userMode).toLowerCase();
  if (userMode === 'anonymous') andWhere.push({ user: { id: { $null: true } } });
  if (userMode === 'user') andWhere.push({ user: { id: { $notNull: true } } });
  const from = toText(query.from);
  if (from) andWhere.push({ createdAt: { $gte: new Date(`${from}T00:00:00.000Z`).toISOString() } });
  const to = toText(query.to);
  if (to) andWhere.push({ createdAt: { $lte: new Date(`${to}T23:59:59.999Z`).toISOString() } });
  return andWhere.length > 0 ? { $and: andWhere } : {};
}

export async function createGeneratedPhotoFromPublic(ctx: any, authUser: AuthUser | null) {
  const slug = toText(ctx.params?.slug).toLowerCase();
  if (!slug) throw new GeneratedPhotoError(400, 'slug is required');

  const campaign = await findPublicCampaignBySlug(ctx, slug);
  const availability = resolvePublicAvailability(campaign);
  if (availability.code !== 'active') throw new GeneratedPhotoError(400, availability.message || 'Photo frame campaign is not active');

  const storageMode = toText(campaign?.generatedImageStorageMode).toLowerCase();
  if (storageMode === 'none') throw new GeneratedPhotoError(400, 'Campaign does not store GeneratedPhoto records');

  const uploadFile = resolveUploadFile(ctx.request?.files);
  if (!uploadFile) throw new GeneratedPhotoError(400, 'file is required');

  const payload = extractBody(ctx.request?.body || {});
  const consentPublicGallery = toBoolean(payload.consentPublicGallery, false);
  const sessionId = toText(payload.sessionId) || null;
  const outputFormat = toText(payload.outputFormat).toLowerCase() === 'jpeg' ? 'jpeg' : 'png';
  const tenantId = campaign?.tenant?.id || ctx.state?.tenant?.id || ctx.state?.tenantId;
  const tenantCode = campaign?.tenant?.code || ctx.state?.tenant?.code;
  if (!tenantId || !tenantCode) throw new GeneratedPhotoError(400, 'Tenant context is required');

  const fileAsset = await storageService.uploadLocalFile({
    tenant: { id: tenantId, code: tenantCode },
    file: {
      filepath: uploadFile.filepath || uploadFile.path || uploadFile.tempFilePath,
      originalFilename: buildStoredFileName(campaign.slug || slug, outputFormat),
      mimetype: uploadFile.mimetype || uploadFile.type,
      size: uploadFile.size,
    },
    moduleKey: 'photo-frame-generated',
    entityType: 'photo-frame-campaign',
    entityId: String(campaign.id),
    uploadedBy: authUser?.id || null,
    isPublic: false,
    metadata: {
      campaignId: campaign.id,
      campaignSlug: campaign.slug || slug,
      consentPublicGallery,
      generatedPhoto: true,
    },
  });

  const created = await strapi.db.query(GENERATED_PHOTO_UID).create({
    data: {
      tenant: tenantId,
      campaign: campaign.id,
      image: fileAsset.id,
      sessionId,
      user: authUser?.id || null,
      consentPublicGallery,
      status: 'active',
      originalFilename: fileAsset.originalName || fileAsset.fileName || null,
      mimeType: fileAsset.mimeType || null,
      fileSize: String(fileAsset.size || '0'),
      width: Number(campaign.width || 0) || null,
      height: Number(campaign.height || 0) || null,
    },
  });

  const row = await strapi.db.query(GENERATED_PHOTO_UID).findOne({
    where: { id: created.id },
    populate: {
      image: true,
      user: { select: ['id', 'username', 'email', 'fullName'] },
      campaign: { select: ['id', 'name', 'slug', 'generatedImageStorageMode'] },
    },
  });
  return normalizeGeneratedPhoto(row || created);
}

export async function listGeneratedPhotosByCampaign(ctx: any, authUser: AuthUser) {
  const accessScope = await resolveAccessScope(ctx, authUser);
  const campaign = await findManagedCampaignOrThrow(ctx.params?.id, ctx, authUser, accessScope);
  const query = (ctx.request?.query || {}) as Record<string, unknown>;
  const page = Math.max(1, Number(query.page || 1) || 1);
  const pageSize = Math.max(1, Math.min(100, Number(query.pageSize || 12) || 12));
  const where = mergeTenantWhere(buildGeneratedPhotoListWhere(query, Number(campaign.id)), accessScope.tenantId);

  const [rows, total] = await Promise.all([
    strapi.db.query(GENERATED_PHOTO_UID).findMany({
      where,
      populate: {
        image: true,
        user: { select: ['id', 'username', 'email', 'fullName'] },
        campaign: { select: ['id', 'name', 'slug', 'generatedImageStorageMode'] },
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      offset: (page - 1) * pageSize,
      limit: pageSize,
    }),
    strapi.db.query(GENERATED_PHOTO_UID).count({ where }),
  ]);

  return {
    campaign: {
      id: campaign.id,
      name: campaign.name || '',
      slug: campaign.slug || '',
      generatedImageStorageMode: campaign.generatedImageStorageMode || 'none',
    },
    data: (rows || []).map(normalizeGeneratedPhoto).filter(Boolean),
    pagination: {
      page,
      pageSize,
      pageCount: Math.max(1, Math.ceil(total / pageSize)),
      total,
    },
  };
}

export async function getGeneratedPhotoSummaryByCampaign(ctx: any, authUser: AuthUser) {
  const accessScope = await resolveAccessScope(ctx, authUser);
  const campaign = await findManagedCampaignOrThrow(ctx.params?.id, ctx, authUser, accessScope);
  const baseWhere = mergeTenantWhere({ campaign: { id: { $eq: Number(campaign.id) } } }, accessScope.tenantId);

  const [total, active, hidden, consented, anonymous, withUser] = await Promise.all([
    strapi.db.query(GENERATED_PHOTO_UID).count({ where: baseWhere }),
    strapi.db.query(GENERATED_PHOTO_UID).count({ where: { $and: [baseWhere, { status: { $eq: 'active' } }] } as any }),
    strapi.db.query(GENERATED_PHOTO_UID).count({ where: { $and: [baseWhere, { status: { $eq: 'hidden' } }] } as any }),
    strapi.db.query(GENERATED_PHOTO_UID).count({ where: { $and: [baseWhere, { consentPublicGallery: { $eq: true } }] } as any }),
    strapi.db.query(GENERATED_PHOTO_UID).count({ where: { $and: [baseWhere, { user: { id: { $null: true } } }] } as any }),
    strapi.db.query(GENERATED_PHOTO_UID).count({ where: { $and: [baseWhere, { user: { id: { $notNull: true } } }] } as any }),
  ]);

  return {
    campaign: {
      id: campaign.id,
      name: campaign.name || '',
      slug: campaign.slug || '',
      generatedImageStorageMode: campaign.generatedImageStorageMode || 'none',
    },
    counts: { total, active, hidden, consented, anonymous, withUser },
  };
}

export async function updateGeneratedPhotoStatusById(ctx: any, authUser: AuthUser) {
  const { generatedPhoto } = await findGeneratedPhotoOrThrow(ctx.params?.id, ctx, authUser);
  const payload = extractBody(ctx.request?.body || {});
  const status = toGeneratedPhotoStatus(payload.status);

  await strapi.db.query(GENERATED_PHOTO_UID).update({
    where: { id: generatedPhoto.id },
    data: { status },
  });

  const row = await strapi.db.query(GENERATED_PHOTO_UID).findOne({
    where: { id: generatedPhoto.id },
    populate: {
      image: true,
      user: { select: ['id', 'username', 'email', 'fullName'] },
      campaign: { select: ['id', 'name', 'slug', 'generatedImageStorageMode'] },
    },
  });
  return normalizeGeneratedPhoto(row || generatedPhoto);
}

export async function deleteGeneratedPhotoById(ctx: any, authUser: AuthUser) {
  const { generatedPhoto } = await findGeneratedPhotoOrThrow(ctx.params?.id, ctx, authUser);
  const fileAsset = generatedPhoto.image;
  await strapi.db.query(GENERATED_PHOTO_UID).delete({ where: { id: generatedPhoto.id } });
  if (fileAsset?.id) {
    await removeStoredFileAsset(fileAsset);
  }
  return { id: generatedPhoto.id, deleted: true, fileAssetId: Number(fileAsset?.id || 0) || null };
}