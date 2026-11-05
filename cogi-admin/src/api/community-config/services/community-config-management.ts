import { mergeTenantWhere, parseOptionalPositiveInt, resolveCurrentTenantId, toText, whereByParam } from '../../../utils/tenant-scope';

const COMMUNITY_CONFIG_UID = 'api::community-config.community-config';
const TENANT_UID = 'api::tenant.tenant';

const STATUS_VALUES = new Set(['draft', 'active', 'archived']);
const SIDEBAR_ITEM_TYPES = [
  'home',
  'public-feed',
  'community-feed',
  'my-posts',
  'saved',
  'group',
  'events',
  'page-link',
  'external-link',
  'admin',
];
const SIDEBAR_VISIBILITY_VALUES = ['public', 'authenticated', 'admin'];
const FEED_DEFAULT_VALUES = ['mixed', 'public', 'community'];

class CommunityConfigError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

function readPayload(body: any): Record<string, unknown> {
  if (body?.data && typeof body.data === 'object' && !Array.isArray(body.data)) {
    return body.data as Record<string, unknown>;
  }

  if (body && typeof body === 'object' && !Array.isArray(body)) {
    return body as Record<string, unknown>;
  }

  return {};
}

function toNullableText(value: unknown): string | null {
  const text = toText(value);
  return text || null;
}

function toRequiredText(value: unknown, label: string): string {
  const text = toText(value);
  if (!text) throw new CommunityConfigError(400, `${label} is required`);
  return text;
}

function toBoolean(value: unknown, fallback = false): boolean {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value !== 0;
  const normalized = toText(value).toLowerCase();
  if (!normalized) return fallback;
  return normalized === 'true' || normalized === '1' || normalized === 'yes' || normalized === 'on';
}

function toNullableIsoDateTime(value: unknown, label: string): string | null {
  const text = toText(value);
  if (!text) return null;
  const parsed = new Date(text);
  if (Number.isNaN(parsed.getTime())) {
    throw new CommunityConfigError(400, `${label} is invalid`);
  }
  return parsed.toISOString();
}

function normalizeStatus(value: unknown, fallback: 'draft' | 'active' | 'archived' = 'draft'): 'draft' | 'active' | 'archived' {
  const normalized = toText(value).toLowerCase();
  if (STATUS_VALUES.has(normalized)) return normalized as 'draft' | 'active' | 'archived';
  return fallback;
}

function normalizeHeaderConfig(value: unknown) {
  const source = value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
  return {
    communityName: toNullableText(source.communityName),
    slogan: toNullableText(source.slogan),
    showSearch: toBoolean(source.showSearch, true),
    showNotification: toBoolean(source.showNotification, true),
    showUserMenu: toBoolean(source.showUserMenu, true),
  };
}

function normalizeSidebarItem(value: unknown, index: number) {
  const source = value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
  const type = toText(source.type).toLowerCase();
  const visibility = toText(source.visibility).toLowerCase();
  const order = Number(source.order);

  return {
    id: toText(source.id) || `item-${index + 1}`,
    label: toText(source.label) || `Item ${index + 1}`,
    icon: toNullableText(source.icon),
    type: SIDEBAR_ITEM_TYPES.includes(type) ? type : 'page-link',
    target: toNullableText(source.target),
    order: Number.isFinite(order) ? order : index,
    enabled: toBoolean(source.enabled, true),
    visibility: SIDEBAR_VISIBILITY_VALUES.includes(visibility) ? visibility : 'public',
  };
}

function normalizeSidebarConfig(value: unknown) {
  const source = value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
  const rawItems = Array.isArray(source.items) ? source.items : [];

  const items = rawItems
    .map((item, index) => normalizeSidebarItem(item, index))
    .sort((a, b) => a.order - b.order);

  return {
    items,
  };
}

function normalizeFeedConfig(value: unknown) {
  const source = value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
  const defaultFeedRaw = toText(source.defaultFeed).toLowerCase();
  const pageSizeRaw = Number(source.pageSize);
  return {
    defaultFeed: FEED_DEFAULT_VALUES.includes(defaultFeedRaw) ? defaultFeedRaw : 'mixed',
    showFeatured: toBoolean(source.showFeatured, true),
    showPinned: toBoolean(source.showPinned, true),
    infiniteScroll: toBoolean(source.infiniteScroll, true),
    pageSize: Number.isInteger(pageSizeRaw) && pageSizeRaw > 0 ? pageSizeRaw : 20,
  };
}

function normalizePolicyConfig(value: unknown) {
  const source = value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
  return {
    allowMemberPost: toBoolean(source.allowMemberPost, true),
    memberPostRequiresApproval: toBoolean(source.memberPostRequiresApproval, true),
    allowReaction: toBoolean(source.allowReaction, true),
    defaultAllowComment: toBoolean(source.defaultAllowComment, true),
  };
}

function normalizeConfigForResponse(row: any) {
  return {
    id: row.id,
    name: row.name || '',
    description: row.description || '',
    status: normalizeStatus(row.status, 'draft'),
    headerConfig: normalizeHeaderConfig(row.headerConfig),
    sidebarConfig: normalizeSidebarConfig(row.sidebarConfig),
    feedConfig: normalizeFeedConfig(row.feedConfig),
    policyConfig: normalizePolicyConfig(row.policyConfig),
    effectiveFrom: row.effectiveFrom || null,
    effectiveTo: row.effectiveTo || null,
    createdAt: row.createdAt || null,
    updatedAt: row.updatedAt || null,
    createdBy: row.createdBy
      ? {
          id: row.createdBy.id,
          username: row.createdBy.username || null,
          email: row.createdBy.email || null,
        }
      : null,
    updatedBy: row.updatedBy
      ? {
          id: row.updatedBy.id,
          username: row.updatedBy.username || null,
          email: row.updatedBy.email || null,
        }
      : null,
  };
}

function assertEffectiveRange(effectiveFrom: string | null, effectiveTo: string | null) {
  if (!effectiveFrom || !effectiveTo) return;
  if (new Date(effectiveFrom).getTime() > new Date(effectiveTo).getTime()) {
    throw new CommunityConfigError(400, 'effectiveFrom must be earlier than or equal to effectiveTo');
  }
}

async function findCommunityConfigOrThrow(id: unknown, tenantId: number | string) {
  const entity = await strapi.db.query(COMMUNITY_CONFIG_UID).findOne({
    where: mergeTenantWhere(whereByParam(id), tenantId),
    populate: {
      tenant: { select: ['id'] },
      createdBy: { select: ['id', 'username', 'email'] },
      updatedBy: { select: ['id', 'username', 'email'] },
    },
  });

  if (!entity?.id) throw new CommunityConfigError(404, 'Community config not found');
  return entity;
}

function buildMutationData(payload: Record<string, unknown>, existing: any = null) {
  const requestedStatus = normalizeStatus(payload.status, normalizeStatus(existing?.status, 'draft'));
  if (requestedStatus === 'active' && normalizeStatus(existing?.status, 'draft') !== 'active') {
    throw new CommunityConfigError(409, 'Use activate action to set active status');
  }

  const name = toRequiredText(payload.name ?? existing?.name, 'name');
  const description = toNullableText(payload.description ?? existing?.description);
  const status = requestedStatus;
  const headerConfig = normalizeHeaderConfig(payload.headerConfig ?? existing?.headerConfig);
  const sidebarConfig = normalizeSidebarConfig(payload.sidebarConfig ?? existing?.sidebarConfig);
  const feedConfig = normalizeFeedConfig(payload.feedConfig ?? existing?.feedConfig);
  const policyConfig = normalizePolicyConfig(payload.policyConfig ?? existing?.policyConfig);
  const effectiveFrom = toNullableIsoDateTime(payload.effectiveFrom ?? existing?.effectiveFrom, 'effectiveFrom');
  const effectiveTo = toNullableIsoDateTime(payload.effectiveTo ?? existing?.effectiveTo, 'effectiveTo');
  assertEffectiveRange(effectiveFrom, effectiveTo);

  return {
    name,
    description,
    status,
    headerConfig,
    sidebarConfig,
    feedConfig,
    policyConfig,
    effectiveFrom,
    effectiveTo,
  };
}

function buildListWhere(query: Record<string, unknown>) {
  const whereClauses: Record<string, unknown>[] = [];
  const q = toText(query.q);
  const status = normalizeStatus(query.status, 'draft');
  const hasStatus = STATUS_VALUES.has(toText(query.status).toLowerCase());

  if (q) {
    whereClauses.push({
      $or: [
        { name: { $containsi: q } },
        { description: { $containsi: q } },
      ],
    });
  }

  if (hasStatus) {
    whereClauses.push({ status });
  }

  if (whereClauses.length === 0) return {};
  if (whereClauses.length === 1) return whereClauses[0];
  return { $and: whereClauses };
}

export function getTenantIdFromContext(ctx: any) {
  return resolveCurrentTenantId(ctx);
}

export async function listCommunityConfigs(query: Record<string, unknown>, tenantId: number | string) {
  const page = parseOptionalPositiveInt((query.pagination as Record<string, unknown> | undefined)?.page) || 1;
  const pageSize = parseOptionalPositiveInt((query.pagination as Record<string, unknown> | undefined)?.pageSize) || 20;
  const start = (page - 1) * pageSize;
  const where = mergeTenantWhere(buildListWhere(query), tenantId);

  const [rows, total] = await Promise.all([
    strapi.db.query(COMMUNITY_CONFIG_UID).findMany({
      where,
      orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
      offset: start,
      limit: pageSize,
      populate: {
        createdBy: { select: ['id', 'username', 'email'] },
        updatedBy: { select: ['id', 'username', 'email'] },
      },
    }),
    strapi.db.query(COMMUNITY_CONFIG_UID).count({ where }),
  ]);

  return {
    data: (rows || []).map(normalizeConfigForResponse),
    meta: {
      pagination: {
        page,
        pageSize,
        pageCount: Math.max(1, Math.ceil(total / pageSize)),
        total,
      },
    },
  };
}

export async function getCommunityConfigDetail(id: unknown, tenantId: number | string) {
  const row = await findCommunityConfigOrThrow(id, tenantId);
  return normalizeConfigForResponse(row);
}

export async function createCommunityConfig(body: any, tenantId: number | string) {
  const payload = readPayload(body);
  const nextData = buildMutationData(payload, null);
  if (nextData.status === 'active') {
    throw new CommunityConfigError(409, 'Use activate action to set active status');
  }

  const created = await strapi.db.query(COMMUNITY_CONFIG_UID).create({
    data: {
      ...nextData,
      tenant: tenantId,
    },
  });

  const detail = await findCommunityConfigOrThrow(created.id, tenantId);
  return normalizeConfigForResponse(detail);
}

export async function updateCommunityConfig(id: unknown, body: any, tenantId: number | string) {
  const existing = await findCommunityConfigOrThrow(id, tenantId);
  const payload = readPayload(body);
  const nextData = buildMutationData(payload, existing);

  await strapi.db.query(COMMUNITY_CONFIG_UID).update({
    where: { id: existing.id },
    data: {
      ...nextData,
      tenant: tenantId,
    },
  });

  const detail = await findCommunityConfigOrThrow(existing.id, tenantId);
  return normalizeConfigForResponse(detail);
}

export async function archiveCommunityConfig(id: unknown, tenantId: number | string) {
  const existing = await findCommunityConfigOrThrow(id, tenantId);
  if (normalizeStatus(existing.status, 'draft') === 'archived') {
    return normalizeConfigForResponse(existing);
  }

  await strapi.db.query(COMMUNITY_CONFIG_UID).update({
    where: { id: existing.id },
    data: {
      status: 'archived',
    },
  });

  const detail = await findCommunityConfigOrThrow(existing.id, tenantId);
  return normalizeConfigForResponse(detail);
}

export async function cloneCommunityConfig(id: unknown, tenantId: number | string) {
  const existing = await findCommunityConfigOrThrow(id, tenantId);
  const cloned = await strapi.db.query(COMMUNITY_CONFIG_UID).create({
    data: {
      tenant: tenantId,
      name: `${toText(existing.name) || 'Community Config'} (Copy)`,
      description: existing.description || null,
      status: 'draft',
      headerConfig: normalizeHeaderConfig(existing.headerConfig),
      sidebarConfig: normalizeSidebarConfig(existing.sidebarConfig),
      feedConfig: normalizeFeedConfig(existing.feedConfig),
      policyConfig: normalizePolicyConfig(existing.policyConfig),
      effectiveFrom: existing.effectiveFrom || null,
      effectiveTo: existing.effectiveTo || null,
    },
  });

  const detail = await findCommunityConfigOrThrow(cloned.id, tenantId);
  return normalizeConfigForResponse(detail);
}

export async function activateCommunityConfig(id: unknown, tenantId: number | string) {
  const targetId = parseOptionalPositiveInt(id);
  if (!targetId) {
    throw new CommunityConfigError(404, 'Community config not found');
  }

  await strapi.db.connection.transaction(async (trx: any) => {
    const target = await strapi.db.query(COMMUNITY_CONFIG_UID).findOne({
      where: mergeTenantWhere({ id: { $eq: targetId } }, tenantId),
      select: ['id', 'status'],
      transacting: trx,
    } as any);

    if (!target?.id) {
      throw new CommunityConfigError(404, 'Community config not found');
    }

    const activeRows = await strapi.db.query(COMMUNITY_CONFIG_UID).findMany({
      where: mergeTenantWhere({
        status: { $eq: 'active' },
      }, tenantId),
      select: ['id'],
      transacting: trx,
    } as any);

    for (const row of activeRows || []) {
      if (Number(row.id) === Number(target.id)) continue;
      await strapi.db.query(COMMUNITY_CONFIG_UID).update({
        where: { id: row.id },
        data: { status: 'archived' },
        transacting: trx,
      } as any);
    }

    await strapi.db.query(COMMUNITY_CONFIG_UID).update({
      where: { id: target.id },
      data: { status: 'active' },
      transacting: trx,
    } as any);
  });

  const detail = await findCommunityConfigOrThrow(targetId, tenantId);
  return normalizeConfigForResponse(detail);
}

export async function getActiveCommunityConfig(tenantId: number | string) {
  const activeConfig = await strapi.db.query(COMMUNITY_CONFIG_UID).findOne({
    where: mergeTenantWhere({ status: { $eq: 'active' } }, tenantId),
    orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
    populate: {
      createdBy: { select: ['id', 'username', 'email'] },
      updatedBy: { select: ['id', 'username', 'email'] },
    },
  });

  return activeConfig ? normalizeConfigForResponse(activeConfig) : null;
}

export async function getCommunityConfigPreview(id: unknown, tenantId: number | string) {
  const detail = await findCommunityConfigOrThrow(id, tenantId);
  return normalizeConfigForResponse(detail);
}

function extractMediaUrl(media: any): string {
  return toText(media?.url || media?.attributes?.url || media?.data?.attributes?.url || media?.data?.url);
}

export async function getTenantCommunityBranding(tenantId: number | string) {
  const tenant = await strapi.db.query(TENANT_UID).findOne({
    where: { id: tenantId },
    select: ['id', 'name', 'shortName', 'code', 'slogan', 'primaryColor'],
    populate: {
      logo: { select: ['url'] },
    },
  });

  if (!tenant?.id) {
    throw new CommunityConfigError(404, 'Tenant not found');
  }

  return {
    id: tenant.id,
    name: tenant.name || tenant.shortName || tenant.code || 'Tenant',
    shortName: tenant.shortName || null,
    code: tenant.code || null,
    slogan: tenant.slogan || null,
    primaryColor: tenant.primaryColor || null,
    logoUrl: extractMediaUrl(tenant.logo) || null,
  };
}

export function getCommunityConfigFormOptions() {
  return {
    statuses: ['draft', 'active', 'archived'],
    sidebarItemTypes: SIDEBAR_ITEM_TYPES,
    sidebarVisibility: SIDEBAR_VISIBILITY_VALUES,
    defaultFeeds: FEED_DEFAULT_VALUES,
  };
}

