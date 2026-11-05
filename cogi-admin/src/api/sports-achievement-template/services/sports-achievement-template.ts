import { extractRelationRef, mergeTenantWhere, normalizeSortInput, toText, whereByParam } from '../../../utils/tenant-scope';
import {
  findSportsClubInTenant,
  normalizeAchievementType,
  normalizeOptionalRelationRef,
  normalizeOptionalText,
  normalizeRequiredText,
  normalizeSportType,
  type AuthUser,
  type GenericRecord,
  type HttpErrorDetails,
} from '../../sports-achievement/services/achievement-shared';

export const SPORTS_ACHIEVEMENT_TEMPLATE_UID = 'api::sports-achievement-template.sports-achievement-template' as any;
const FILE_ASSET_UID = 'api::file-asset.file-asset' as any;
const UPLOAD_FILE_UID = 'plugin::upload.file' as any;

export const TEMPLATE_STATUS_VALUES = new Set(['draft', 'active', 'archived']);
export const TEMPLATE_LAYOUT_VALUES = new Set(['default', 'race_result', 'personal_best']);
const TEMPLATE_IMAGE_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

export class SportsAchievementTemplateError extends Error {
  status: number;
  code?: string | null;
  details?: HttpErrorDetails;

  constructor(status: number, message: string, code?: string | null, details?: HttpErrorDetails) {
    super(message);
    this.status = status;
    this.code = code || null;
    this.details = typeof details === 'undefined' ? null : details;
  }
}

function httpError(status: number, message: string, code?: string, details?: HttpErrorDetails): never {
  throw new SportsAchievementTemplateError(status, message, code || null, details || null);
}

function toDomainError(error: any): never {
  if (error instanceof SportsAchievementTemplateError) throw error;
  const status = Number(error?.status || 0);
  if (status > 0) {
    throw new SportsAchievementTemplateError(status, error.message || 'Invalid sports achievement template request', error.code || null, error.details || null);
  }
  throw error;
}

function normalizeStringList(value: unknown): string[] {
  if (value === null || value === undefined || value === '') return [];
  const list = Array.isArray(value) ? value : [value];
  return list
    .flatMap((item) => typeof item === 'string' ? item.split(',') : [item])
    .map((item) => toText(item).trim())
    .filter(Boolean)
    .map((item) => item.toLowerCase());
}

function resolveDistanceLabelCandidate(entity: any): string {
  const direct = toText(entity?.distanceLabel || entity?.distance?.label || entity?.distanceLabelName || '').toLowerCase();
  if (direct) return direct;
  const distanceKm = Number(entity?.distanceKm ?? entity?.distance_km ?? 0);
  if (!Number.isFinite(distanceKm) || distanceKm <= 0) return '';
  if (Math.abs(distanceKm - 42.195) < 0.01) return 'fm';
  if (Math.abs(distanceKm - 21.0975) < 0.01) return 'hm';
  if (Math.abs(distanceKm - 10) < 0.01) return '10k';
  if (Math.abs(distanceKm - 5) < 0.01) return '5k';
  return `${distanceKm}`.toLowerCase();
}

export function normalizeTemplateStatus(value: unknown): 'draft' | 'active' | 'archived' {
  const text = toText(value).toLowerCase() || 'draft';
  if (!TEMPLATE_STATUS_VALUES.has(text)) {
    throw Object.assign(new Error('status is invalid'), { status: 400, code: 'INVALID_STATUS', details: { field: 'status' } });
  }
  return text as 'draft' | 'active' | 'archived';
}

export function normalizeTemplateLayoutKey(value: unknown): string {
  const text = toText(value).toLowerCase() || 'default';
  if (!TEMPLATE_LAYOUT_VALUES.has(text)) {
    throw Object.assign(new Error('layoutKey is invalid'), { status: 400, code: 'INVALID_LAYOUT_KEY', details: { field: 'layoutKey' } });
  }
  return text;
}

function buildListWhere(query: Record<string, unknown>) {
  const clauses: Array<Record<string, unknown>> = [];
  const keyword = toText(query.search ?? query.q);
  const status = toText(query.status).toLowerCase();
  const sportType = toText(query.sportType).toLowerCase();
  const clubRef = extractRelationRef(query.club);
  const code = toText(query.code);
  const name = toText(query.name);

  if (keyword) {
    clauses.push({
      $or: [
        { name: { $containsi: keyword } },
        { code: { $containsi: keyword } },
        { club: { name: { $containsi: keyword } } },
      ],
    });
  }

  if (status) {
    if (!TEMPLATE_STATUS_VALUES.has(status)) httpError(400, 'status is invalid', 'INVALID_STATUS', { field: 'status' });
    clauses.push({ status: { $eq: status } });
  }

  if (sportType) {
    normalizeSportType(sportType);
    clauses.push({ sportType: { $eq: sportType } });
  }

  if (code) {
    clauses.push({ code: { $containsi: code } });
  }

  if (name) {
    clauses.push({ name: { $containsi: name } });
  }

  if (clubRef) {
    const where = whereByParam(clubRef);
    if (where?.id) clauses.push({ club: { id: { $eq: where.id } } });
    if (where?.documentId) clauses.push({ club: { documentId: { $eq: where.documentId } } });
  }

  if (clauses.length === 0) return {};
  if (clauses.length === 1) return clauses[0];
  return { $and: clauses };
}

function resolveOrderBy(query: Record<string, unknown>) {
  const normalizedSort = normalizeSortInput(query?.sort);
  if (normalizedSort.length > 0) {
    const allowed = new Set(['priority', 'name', 'status', 'sportType', 'createdAt', 'updatedAt', 'code']);
    const safe = normalizedSort
      .map((entry) => {
        const key = Object.keys(entry || {})[0];
        if (!key || !allowed.has(key)) return null;
        return { [key]: entry[key] };
      })
      .filter(Boolean);
    if (safe.length > 0) return safe as Array<Record<string, 'asc' | 'desc'>>;
  }
  return [{ priority: 'asc' }, { createdAt: 'asc' }, { id: 'asc' }];
}

function mapTemplateMedia(media: any) {
  if (!media?.id) return null;
  const providerMetadata = media.provider_metadata && typeof media.provider_metadata === 'object'
    ? media.provider_metadata
    : (media.providerMetadata && typeof media.providerMetadata === 'object' ? media.providerMetadata : null);
  return {
    id: Number(media.id),
    documentId: media.documentId || null,
    name: toText(media.name) || null,
    url: toText(media.url) || null,
    mime: toText(media.mime) || null,
    provider: toText(media.provider) || null,
    fileAssetId: Number(providerMetadata?.bridgedFromFileAssetId || 0) || null,
  };
}

function parsePositiveInt(value: unknown): number | null {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

function normalizeUploadExt(value: unknown): string {
  const ext = toText(value).toLowerCase();
  if (!ext) return '';
  return ext.startsWith('.') ? ext : `.${ext}`;
}

function ensureImageMimeType(mimeType: unknown, fieldName: string) {
  const mime = toText(mimeType).toLowerCase();
  if (!mime || !TEMPLATE_IMAGE_MIME_TYPES.has(mime)) {
    httpError(400, `${fieldName} must be an image file (PNG, JPG, WEBP)`, 'INVALID_TEMPLATE_ASSET_MIME', { field: fieldName });
  }
  return mime;
}

async function ensureUploadFileForTenantFileAsset(fileAsset: any, transacting?: any) {
  const existingUploadFile = await strapi.db.query(UPLOAD_FILE_UID).findOne({
    where: {
      url: toText(fileAsset.url),
      provider: toText(fileAsset.provider) || 'local',
    },
    select: ['id'],
    ...(transacting ? { transacting } : {}),
  } as any);
  if (existingUploadFile?.id) {
    return Number(existingUploadFile.id);
  }

  const mime = ensureImageMimeType(fileAsset?.mimeType, 'asset');
  const ext = normalizeUploadExt(fileAsset?.extension);
  const originalName = toText(fileAsset?.originalName || fileAsset?.fileName) || `template-asset-${Number(fileAsset.id || 0)}${ext || ''}`;
  const baseHash = toText(fileAsset?.fileName || fileAsset?.originalName || `template-asset-${Number(fileAsset.id || 0)}`)
    .replace(/\.[^.]+$/, '')
    .replace(/[^A-Za-z0-9._-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase() || `template-asset-${Number(fileAsset.id || 0)}`;

  const createdUploadFile = await strapi.db.query(UPLOAD_FILE_UID).create({
    data: {
      name: originalName,
      alternativeText: null,
      caption: null,
      ext,
      folderPath: '/',
      formats: null,
      hash: `${baseHash}-file-asset-${Number(fileAsset.id)}`,
      height: null,
      mime,
      previewUrl: null,
      provider: toText(fileAsset.provider) || 'local',
      provider_metadata: {
        bridgedFromFileAssetId: Number(fileAsset.id),
        relativePath: toText(fileAsset.relativePath) || null,
      },
      size: Math.max(0.001, Number((Number(fileAsset.size || 0) / 1024).toFixed(3))),
      url: toText(fileAsset.url),
      width: null,
    },
    ...(transacting ? { transacting } : {}),
  } as any);
  if (!createdUploadFile?.id) {
    httpError(500, 'Failed to bridge template file asset for media relation', 'TEMPLATE_ASSET_BRIDGE_FAILED');
  }
  return Number(createdUploadFile.id);
}

async function resolveTemplateMediaRelationRef(assetRef: unknown, tenantId: number | string, fieldName: string, transacting?: any) {
  const where = whereByParam(assetRef);
  if (!where) return null;

  const uploadRow = await strapi.db.query(UPLOAD_FILE_UID).findOne({
    where,
    select: ['id', 'mime', 'provider_metadata'],
    ...(transacting ? { transacting } : {}),
  } as any);
  if (uploadRow?.id) {
    ensureImageMimeType(uploadRow?.mime, fieldName);
    const providerMetadata = uploadRow.provider_metadata && typeof uploadRow.provider_metadata === 'object'
      ? uploadRow.provider_metadata
      : null;
    const bridgedFileAssetId = parsePositiveInt(providerMetadata?.bridgedFromFileAssetId);
    if (!bridgedFileAssetId) {
      httpError(409, `${fieldName} must be uploaded via Tenant Storage`, 'TEMPLATE_ASSET_NOT_TENANT_STORAGE', { field: fieldName });
    }
    const bridgedAsset = await strapi.db.query(FILE_ASSET_UID).findOne({
      where: mergeTenantWhere({ id: { $eq: bridgedFileAssetId } }, tenantId),
      select: ['id', 'mimeType', 'status', 'isDeleted'],
      ...(transacting ? { transacting } : {}),
    } as any);
    if (!bridgedAsset?.id || bridgedAsset?.isDeleted || toText(bridgedAsset?.status).toUpperCase() !== 'ACTIVE') {
      httpError(409, `${fieldName} is not active in current tenant`, 'TEMPLATE_ASSET_NOT_ACTIVE', { field: fieldName });
    }
    ensureImageMimeType(bridgedAsset?.mimeType, fieldName);
    return Number(uploadRow.id);
  }

  const fileAsset = await strapi.db.query(FILE_ASSET_UID).findOne({
    where: mergeTenantWhere(where, tenantId),
    select: ['id', 'originalName', 'fileName', 'extension', 'mimeType', 'size', 'provider', 'url', 'relativePath', 'status', 'isDeleted'],
    ...(transacting ? { transacting } : {}),
  } as any);
  if (!fileAsset?.id) {
    httpError(404, `${fieldName} file asset not found in current tenant`, 'TEMPLATE_ASSET_NOT_FOUND', { field: fieldName });
  }
  if (fileAsset?.isDeleted || toText(fileAsset?.status).toUpperCase() !== 'ACTIVE') {
    httpError(409, `${fieldName} file asset is not active`, 'TEMPLATE_ASSET_NOT_ACTIVE', { field: fieldName });
  }
  ensureImageMimeType(fileAsset?.mimeType, fieldName);
  return await ensureUploadFileForTenantFileAsset(fileAsset, transacting);
}

export function mapAchievementTemplateRow(row: any) {
  if (!row?.id) return null;
  return {
    id: Number(row.id),
    documentId: row.documentId || null,
    tenant: row.tenant?.id ? { id: Number(row.tenant.id), documentId: row.tenant.documentId || null } : null,
    club: row.club?.id ? { id: Number(row.club.id), documentId: row.club.documentId || null, code: toText(row.club.code), name: toText(row.club.name) } : null,
    name: toText(row.name) || null,
    code: toText(row.code) || null,
    sportType: toText(row.sportType) || null,
    achievementTypes: Array.isArray(row.achievementTypes) ? row.achievementTypes.map((item: any) => toText(item)) : [],
    distanceLabels: Array.isArray(row.distanceLabels) ? row.distanceLabels.map((item: any) => toText(item)) : [],
    priority: Number(row.priority ?? 100),
    status: toText(row.status) || 'draft',
    backgroundAsset: mapTemplateMedia(row.backgroundAsset),
    previewAsset: mapTemplateMedia(row.previewAsset),
    layoutKey: toText(row.layoutKey) || 'default',
    layoutConfig: row.layoutConfig ?? null,
    createdAt: row.createdAt || null,
    updatedAt: row.updatedAt || null,
  };
}

export async function findAchievementTemplateInTenant(templateRef: unknown, tenantId: number | string, transacting?: any) {
  const where = whereByParam(extractRelationRef(templateRef) ?? templateRef);
  if (!where) {
    httpError(404, 'Sports achievement template not found', 'SPORTS_ACHIEVEMENT_TEMPLATE_NOT_FOUND');
  }
  const row = await strapi.db.query(SPORTS_ACHIEVEMENT_TEMPLATE_UID).findOne({
    where: mergeTenantWhere(where, tenantId),
    populate: {
      tenant: { select: ['id', 'documentId'] },
      club: { select: ['id', 'documentId', 'code', 'name'] },
      backgroundAsset: { select: ['id', 'documentId', 'name', 'url', 'mime', 'provider', 'provider_metadata'] },
      previewAsset: { select: ['id', 'documentId', 'name', 'url', 'mime', 'provider', 'provider_metadata'] },
    },
    ...(transacting ? { transacting } : {}),
  } as any);
  if (!row?.id) {
    httpError(404, 'Sports achievement template not found', 'SPORTS_ACHIEVEMENT_TEMPLATE_NOT_FOUND');
  }
  return row;
}

export async function listTenantSportsAchievementTemplates(query: Record<string, unknown>, tenantId: number | string) {
  const { page, pageSize, start } = { page: Number(query.page || 1), pageSize: Number(query.pageSize || 50), start: Number(query.start || 0) } as any;
  const where = mergeTenantWhere(buildListWhere(query || {}), tenantId);
  const orderBy = resolveOrderBy(query || {});

  const [rows, total] = await Promise.all([
    strapi.db.query(SPORTS_ACHIEVEMENT_TEMPLATE_UID).findMany({
      where,
      orderBy,
      offset: start,
      limit: pageSize,
      populate: {
        tenant: { select: ['id', 'documentId'] },
        club: { select: ['id', 'documentId', 'code', 'name'] },
        backgroundAsset: { select: ['id', 'documentId', 'name', 'url', 'mime', 'provider', 'provider_metadata'] },
        previewAsset: { select: ['id', 'documentId', 'name', 'url', 'mime', 'provider', 'provider_metadata'] },
      },
    } as any),
    strapi.db.query(SPORTS_ACHIEVEMENT_TEMPLATE_UID).count({ where } as any),
  ]);

  return {
    rows: (rows || []).map((row: any) => mapAchievementTemplateRow(row)).filter(Boolean),
    pagination: { page, pageSize, total, pageCount: Math.max(1, Math.ceil(total / Math.max(pageSize, 1))) },
  };
}

export async function getTenantSportsAchievementTemplate(templateRef: unknown, tenantId: number | string) {
  return mapAchievementTemplateRow(await findAchievementTemplateInTenant(templateRef, tenantId));
}

async function prepareTemplateWriteData(payload: GenericRecord, tenantId: number | string, existing?: any, transacting?: any) {
  const normalized = payload || {};
  const hasBackgroundAsset = Object.prototype.hasOwnProperty.call(normalized, 'backgroundAsset');
  const hasPreviewAsset = Object.prototype.hasOwnProperty.call(normalized, 'previewAsset');
  const clubRef = Object.prototype.hasOwnProperty.call(normalized, 'club') ? normalizeOptionalRelationRef(normalized.club) : normalizeOptionalRelationRef(existing?.club);
  const backgroundAssetId = hasBackgroundAsset
    ? await resolveTemplateMediaRelationRef(normalized.backgroundAsset, tenantId, 'backgroundAsset', transacting)
    : (normalizeOptionalRelationRef(existing?.backgroundAsset) ? Number(normalizeOptionalRelationRef(existing?.backgroundAsset)) : null);
  const previewAssetId = hasPreviewAsset
    ? await resolveTemplateMediaRelationRef(normalized.previewAsset, tenantId, 'previewAsset', transacting)
    : (normalizeOptionalRelationRef(existing?.previewAsset) ? Number(normalizeOptionalRelationRef(existing?.previewAsset)) : null);
  const club = clubRef ? await findSportsClubInTenant(clubRef, tenantId, transacting) : null;
  const name = Object.prototype.hasOwnProperty.call(normalized, 'name') ? normalizeRequiredText(normalized.name, 'name', 200) : normalizeRequiredText(existing?.name, 'name', 200);
  const code = Object.prototype.hasOwnProperty.call(normalized, 'code') ? normalizeRequiredText(normalized.code, 'code', 100) : normalizeRequiredText(existing?.code, 'code', 100);
  const sportType = Object.prototype.hasOwnProperty.call(normalized, 'sportType') ? normalizeSportType(normalized.sportType) : normalizeSportType(existing?.sportType);
  if (!sportType) httpError(400, 'sportType is required', 'INVALID_REQUEST_BODY', { field: 'sportType' });

  const achievementTypes = Object.prototype.hasOwnProperty.call(normalized, 'achievementTypes')
    ? normalizeStringList(normalized.achievementTypes).map((item) => normalizeAchievementType(item))
    : normalizeStringList(existing?.achievementTypes).map((item) => normalizeAchievementType(item));
  const distanceLabels = Object.prototype.hasOwnProperty.call(normalized, 'distanceLabels') ? normalizeStringList(normalized.distanceLabels) : normalizeStringList(existing?.distanceLabels);
  const priority = Object.prototype.hasOwnProperty.call(normalized, 'priority') ? Number(normalized.priority ?? 100) : Number(existing?.priority ?? 100);
  if (!Number.isInteger(priority)) httpError(400, 'priority must be an integer', 'INVALID_PRIORITY', { field: 'priority' });
  const status = Object.prototype.hasOwnProperty.call(normalized, 'status') ? normalizeTemplateStatus(normalized.status) : normalizeTemplateStatus(existing?.status || 'draft');
  const layoutKey = Object.prototype.hasOwnProperty.call(normalized, 'layoutKey') ? normalizeTemplateLayoutKey(normalized.layoutKey) : normalizeTemplateLayoutKey(existing?.layoutKey || 'default');
  const layoutConfig = Object.prototype.hasOwnProperty.call(normalized, 'layoutConfig') ? (typeof normalized.layoutConfig === 'string' ? JSON.parse(normalized.layoutConfig) : normalized.layoutConfig) : existing?.layoutConfig ?? null;

  return {
    club,
    name,
    code,
    sportType,
    achievementTypes,
    distanceLabels,
    priority,
    status,
    backgroundAssetId,
    previewAssetId,
    layoutKey,
    layoutConfig,
  };
}

export async function createTenantSportsAchievementTemplate(payload: Record<string, unknown>, tenantId: number | string, authUser: AuthUser = null, options: { transacting?: any } = {}) {
  try {
    const prepared = await prepareTemplateWriteData(payload || {}, tenantId, undefined, options.transacting);
    if (!prepared.club?.id) httpError(400, 'club is required', 'INVALID_REQUEST_BODY', { field: 'club' });
    const created = await strapi.db.query(SPORTS_ACHIEVEMENT_TEMPLATE_UID).create({
      data: {
        tenant: Number(tenantId),
        club: Number(prepared.club.id),
        name: prepared.name,
        code: prepared.code,
        sportType: prepared.sportType,
        achievementTypes: prepared.achievementTypes,
        distanceLabels: prepared.distanceLabels,
        priority: prepared.priority,
        status: prepared.status,
        backgroundAsset: prepared.backgroundAssetId ? Number(prepared.backgroundAssetId) : null,
        previewAsset: prepared.previewAssetId ? Number(prepared.previewAssetId) : null,
        layoutKey: prepared.layoutKey,
        layoutConfig: prepared.layoutConfig,
      },
      ...(options.transacting ? { transacting: options.transacting } : {}),
    } as any);
    return await getTenantSportsAchievementTemplate(Number(created.id), tenantId);
  } catch (error) {
    toDomainError(error);
  }
}

export async function updateTenantSportsAchievementTemplate(templateRef: unknown, payload: Record<string, unknown>, tenantId: number | string, authUser: AuthUser = null, options: { transacting?: any } = {}) {
  const current = await findAchievementTemplateInTenant(templateRef, tenantId, options.transacting);
  try {
    const prepared = await prepareTemplateWriteData(payload || {}, tenantId, current, options.transacting);
    const updated = await strapi.db.query(SPORTS_ACHIEVEMENT_TEMPLATE_UID).update({
      where: { id: Number(current.id) },
      data: {
        club: Number(prepared.club.id),
        name: prepared.name,
        code: prepared.code,
        sportType: prepared.sportType,
        achievementTypes: prepared.achievementTypes,
        distanceLabels: prepared.distanceLabels,
        priority: prepared.priority,
        status: prepared.status,
        backgroundAsset: prepared.backgroundAssetId ? Number(prepared.backgroundAssetId) : null,
        previewAsset: prepared.previewAssetId ? Number(prepared.previewAssetId) : null,
        layoutKey: prepared.layoutKey,
        layoutConfig: prepared.layoutConfig,
      },
      ...(options.transacting ? { transacting: options.transacting } : {}),
    } as any);
    return await getTenantSportsAchievementTemplate(Number(updated.id || current.id), tenantId);
  } catch (error) {
    toDomainError(error);
  }
}

export async function resolveAchievementTemplateForEntity(entity: any, tenantId: number | string) {
  const clubId = Number(entity?.club?.id || entity?.club || entity?.clubId || 0);
  const sportType = toText(entity?.sportType || entity?.sportTypeName || entity?.sport || '').toLowerCase();
  const achievementType = toText(entity?.achievementType || entity?.achievement_type || '').toLowerCase();
  const distanceLabel = resolveDistanceLabelCandidate(entity);

  if (entity?.shareTemplate) {
    let explicitRow: any = null;
    try {
      explicitRow = await findAchievementTemplateInTenant(entity.shareTemplate, tenantId);
    } catch (error: any) {
      if (error instanceof SportsAchievementTemplateError && error.code === 'SPORTS_ACHIEVEMENT_TEMPLATE_NOT_FOUND') {
        return { source: 'explicit', status: 'invalid_explicit_template', template: null, reason: 'Selected template no longer exists.' };
      }
      throw error;
    }
    if (toText(explicitRow.status).toLowerCase() !== 'active') {
      return { source: 'explicit', status: 'invalid_explicit_template', template: null, reason: 'Selected template is not active.' };
    }
    return { source: 'explicit', status: 'resolved', template: mapAchievementTemplateRow(explicitRow) };
  }

  if (!clubId || !sportType || !achievementType) {
    return { source: 'auto', status: 'no_match', template: null, reason: 'Missing club, sport, or achievement metadata.' };
  }

  const rows = await strapi.db.query(SPORTS_ACHIEVEMENT_TEMPLATE_UID).findMany({
    where: mergeTenantWhere({
      club: { id: { $eq: Number(clubId) } },
      sportType: { $eq: sportType },
      status: { $eq: 'active' },
    }, tenantId),
    orderBy: [{ priority: 'asc' }, { createdAt: 'asc' }, { id: 'asc' }],
    populate: {
      tenant: { select: ['id', 'documentId'] },
      club: { select: ['id', 'documentId', 'code', 'name'] },
      backgroundAsset: { select: ['id', 'documentId', 'name', 'url', 'mime', 'provider', 'provider_metadata'] },
      previewAsset: { select: ['id', 'documentId', 'name', 'url', 'mime', 'provider', 'provider_metadata'] },
    },
  } as any);

  const eligible = (rows || []).filter((template: any) => {
    const templateStatus = toText(template.status).toLowerCase();
    if (templateStatus !== 'active') return false;
    const matchesSport = toText(template.sportType).toLowerCase() === sportType;
    if (!matchesSport) return false;
    const allowedTypes = Array.isArray(template.achievementTypes) ? template.achievementTypes.map((item: any) => toText(item).toLowerCase()) : [];
    if (allowedTypes.length > 0 && !allowedTypes.includes(achievementType)) return false;
    const distanceLabels = Array.isArray(template.distanceLabels) ? template.distanceLabels.map((item: any) => toText(item).toLowerCase()) : [];
    if (distanceLabels.length > 0 && !distanceLabels.includes(distanceLabel)) return false;
    return true;
  });

  if (!eligible.length) {
    return { source: 'auto', status: 'no_match', template: null, reason: 'No active template matched the achievement metadata.' };
  }

  return { source: 'auto', status: 'resolved', template: mapAchievementTemplateRow(eligible[0]) };
}

export async function listEligibleAchievementTemplatesForEntity(entity: any, tenantId: number | string) {
  const clubId = Number(entity?.club?.id || entity?.club || entity?.clubId || 0);
  const sportType = toText(entity?.sportType || entity?.sportTypeName || entity?.sport || '').toLowerCase();
  const achievementType = toText(entity?.achievementType || entity?.achievement_type || '').toLowerCase();
  const distanceLabel = resolveDistanceLabelCandidate(entity);
  if (!clubId || !sportType || !achievementType) return [];

  const rows = await strapi.db.query(SPORTS_ACHIEVEMENT_TEMPLATE_UID).findMany({
    where: mergeTenantWhere({
      club: { id: { $eq: Number(clubId) } },
      sportType: { $eq: sportType },
      status: { $eq: 'active' },
    }, tenantId),
    orderBy: [{ priority: 'asc' }, { createdAt: 'asc' }, { id: 'asc' }],
    populate: {
      tenant: { select: ['id', 'documentId'] },
      club: { select: ['id', 'documentId', 'code', 'name'] },
      backgroundAsset: { select: ['id', 'documentId', 'name', 'url', 'mime', 'provider', 'provider_metadata'] },
      previewAsset: { select: ['id', 'documentId', 'name', 'url', 'mime', 'provider', 'provider_metadata'] },
    },
  } as any);

  return (rows || [])
    .filter((template: any) => {
      if (toText(template?.status).toLowerCase() !== 'active') return false;
      if (toText(template?.sportType).toLowerCase() !== sportType) return false;
      const allowedTypes = Array.isArray(template?.achievementTypes) ? template.achievementTypes.map((item: any) => toText(item).toLowerCase()) : [];
      if (allowedTypes.length > 0 && !allowedTypes.includes(achievementType)) return false;
      const distanceLabels = Array.isArray(template?.distanceLabels) ? template.distanceLabels.map((item: any) => toText(item).toLowerCase()) : [];
      if (distanceLabels.length > 0 && !distanceLabels.includes(distanceLabel)) return false;
      return true;
    })
    .map((row: any) => mapAchievementTemplateRow(row))
    .filter(Boolean);
}
