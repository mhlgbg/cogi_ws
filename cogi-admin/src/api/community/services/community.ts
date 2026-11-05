import { mergeTenantWhere, parseOptionalPositiveInt, toText, whereByParam } from '../../../utils/tenant-scope';
import { getActiveCommunityConfig } from '../../community-config/services/community-config-management';
import { dispatchTrustedGameActivity } from '../../game/services/xp-engine';

const COMMUNITY_GROUP_UID = 'api::community-group.community-group';
const COMMUNITY_GROUP_MEMBER_UID = 'api::community-group-member.community-group-member';
const COMMUNITY_POST_UID = 'api::community-post.community-post';
const COMMUNITY_COMMENT_UID = 'api::community-comment.community-comment';
const COMMUNITY_REACTION_UID = 'api::community-reaction.community-reaction';
const SPORTS_CLUB_UID = 'api::sports-club.sports-club';
const USER_TENANT_UID = 'api::user-tenant.user-tenant';
const USER_TENANT_ROLE_UID = 'api::user-tenant-role.user-tenant-role';
const ROLE_FEATURE_UID = 'api::role-feature.role-feature';
const USER_UID = 'plugin::users-permissions.user';
const FILE_ASSET_UID = 'api::file-asset.file-asset';
const UPLOAD_FILE_UID = 'plugin::upload.file';

const GROUP_VISIBILITY_VALUES = new Set(['public', 'members']);
const GROUP_STATUS_VALUES = new Set(['active', 'archived']);
const GROUP_LINKED_TYPE_VALUES = new Set(['none', 'club']);
const MEMBER_ROLE_VALUES = new Set(['owner', 'moderator', 'member']);
const MEMBER_STATUS_VALUES = new Set(['active', 'inactive']);
const POST_SCOPE_VALUES = new Set(['public', 'community', 'group']);
const POST_CONTENT_TYPE_VALUES = new Set(['text', 'html']);
const POST_STATUS_VALUES = new Set(['draft', 'pending', 'rejected', 'published', 'hidden']);
const COMMENT_STATUS_VALUES = new Set(['active', 'hidden', 'deleted']);
const REACTION_TYPE_VALUES = new Set(['like', 'love', 'support']);
const IMAGE_MIME_PREFIX = 'image/';
const IMAGE_EXTENSION_VALUES = new Set(['.jpg', '.jpeg', '.png', '.webp']);

class CommunityError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

function toBoolean(value: unknown, fallback = false): boolean {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value !== 0;
  const text = toText(value).toLowerCase();
  if (!text) return fallback;
  return text === 'true' || text === '1' || text === 'yes' || text === 'on';
}

function toNullableText(value: unknown): string | null {
  const text = toText(value);
  return text || null;
}

function toRequiredText(value: unknown, label: string): string {
  const text = toText(value);
  if (!text) throw new CommunityError(400, `${label} is required`);
  return text;
}

function normalizeSlug(value: unknown) {
  return toText(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[đĐ]/g, (character) => (character === 'Đ' ? 'D' : 'd'))
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function normalizeGroupVisibility(value: unknown): 'public' | 'members' {
  const normalized = toText(value).toLowerCase();
  if (GROUP_VISIBILITY_VALUES.has(normalized)) return normalized as 'public' | 'members';
  return 'members';
}

function normalizeGroupStatus(value: unknown): 'active' | 'archived' {
  const normalized = toText(value).toLowerCase();
  if (GROUP_STATUS_VALUES.has(normalized)) return normalized as 'active' | 'archived';
  return 'active';
}

function normalizeGroupLinkedType(value: unknown): 'none' | 'club' {
  const normalized = toText(value).toLowerCase();
  if (GROUP_LINKED_TYPE_VALUES.has(normalized)) return normalized as 'none' | 'club';
  return 'none';
}

function normalizeMemberRole(value: unknown): 'owner' | 'moderator' | 'member' {
  const normalized = toText(value).toLowerCase();
  if (MEMBER_ROLE_VALUES.has(normalized)) return normalized as 'owner' | 'moderator' | 'member';
  return 'member';
}

function normalizeMemberStatus(value: unknown): 'active' | 'inactive' {
  const normalized = toText(value).toLowerCase();
  if (MEMBER_STATUS_VALUES.has(normalized)) return normalized as 'active' | 'inactive';
  return 'active';
}

function normalizePostScope(value: unknown): 'public' | 'community' | 'group' {
  const normalized = toText(value).toLowerCase();
  if (POST_SCOPE_VALUES.has(normalized)) return normalized as 'public' | 'community' | 'group';
  return 'community';
}

function normalizePostContentType(value: unknown): 'text' | 'html' {
  const normalized = toText(value).toLowerCase();
  if (POST_CONTENT_TYPE_VALUES.has(normalized)) return normalized as 'text' | 'html';
  return 'text';
}

function normalizePostStatus(value: unknown): 'draft' | 'pending' | 'rejected' | 'published' | 'hidden' {
  const normalized = toText(value).toLowerCase();
  if (POST_STATUS_VALUES.has(normalized)) return normalized as 'draft' | 'pending' | 'rejected' | 'published' | 'hidden';
  return 'draft';
}

function normalizeCommentStatus(value: unknown): 'active' | 'hidden' | 'deleted' {
  const normalized = toText(value).toLowerCase();
  if (COMMENT_STATUS_VALUES.has(normalized)) return normalized as 'active' | 'hidden' | 'deleted';
  return 'active';
}

function normalizeReactionType(value: unknown): 'like' | 'love' | 'support' {
  const normalized = toText(value).toLowerCase();
  if (REACTION_TYPE_VALUES.has(normalized)) return normalized as 'like' | 'love' | 'support';
  return 'like';
}

function sanitizeHtml(value: unknown): string {
  const html = toText(value);
  if (!html) return '';
  return html
    .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, '')
    .replace(/\son\w+="[^"]*"/gi, '')
    .replace(/\son\w+='[^']*'/gi, '');
}

function normalizeYouTubeUrl(value: unknown): { videoId: string; url: string } | null {
  const raw = toText(value);
  if (!raw) return null;

  let parsedUrl: URL;
  try {
    parsedUrl = new URL(raw);
  } catch {
    throw new CommunityError(400, 'Liên kết YouTube không hợp lệ.');
  }

  const hostname = String(parsedUrl.hostname || '').toLowerCase().replace(/^www\./, '');
  const pathParts = String(parsedUrl.pathname || '').split('/').filter(Boolean);

  let videoId = '';
  if (hostname === 'youtu.be') {
    videoId = pathParts[0] || '';
  } else if (hostname === 'youtube.com' || hostname === 'm.youtube.com') {
    if (pathParts[0] === 'watch') {
      videoId = toText(parsedUrl.searchParams.get('v'));
    } else if (pathParts[0] === 'shorts' || pathParts[0] === 'embed') {
      videoId = pathParts[1] || '';
    }
  }

  if (!/^[A-Za-z0-9_-]{11}$/.test(videoId)) {
    throw new CommunityError(400, 'Liên kết YouTube không hợp lệ.');
  }

  return {
    videoId,
    url: `https://www.youtube.com/watch?v=${videoId}`,
  };
}

function mapMedia(row: any) {
  if (!row?.id) return null;
  const providerMetadata = row.provider_metadata && typeof row.provider_metadata === 'object'
    ? row.provider_metadata
    : (row.providerMetadata && typeof row.providerMetadata === 'object' ? row.providerMetadata : null);
  const bridgedFileAssetId = Number(providerMetadata?.bridgedFromFileAssetId || 0) || null;
  return {
    id: Number(row.id),
    fileAssetId: bridgedFileAssetId,
    name: toText(row.name) || null,
    provider: toText(row.provider) || null,
    url: toText(row.url) || null,
    mime: toText(row.mime) || null,
    ext: toText(row.ext) || null,
    width: Number(row.width || 0) || null,
    height: Number(row.height || 0) || null,
    formats: row.formats && typeof row.formats === 'object' ? row.formats : null,
  };
}

function mapUser(row: any) {
  if (!row?.id) return null;
  return {
    id: Number(row.id),
    username: toText(row.username) || null,
    email: toText(row.email) || null,
    fullName: toText(row.fullName) || null,
  };
}

function mapPublicCommunityUser(row: any) {
  if (!row?.id) return null;
  const fullName = toText(row.fullName);
  const username = toText(row.username);
  return {
    id: Number(row.id),
    displayName: fullName || username || `User #${Number(row.id)}`,
    username: username || null,
  };
}

function mapGroup(row: any) {
  if (!row?.id) return null;
  return {
    id: Number(row.id),
    name: toText(row.name) || null,
    slug: toText(row.slug) || null,
    description: toText(row.description) || null,
    visibility: normalizeGroupVisibility(row.visibility),
    status: normalizeGroupStatus(row.status),
    linkedType: normalizeGroupLinkedType(row.linkedType),
    linkedClub: row.linkedClub
      ? {
          id: Number(row.linkedClub.id),
          code: toText(row.linkedClub.code) || null,
          name: toText(row.linkedClub.name) || null,
          status: toText(row.linkedClub.status) || null,
        }
      : null,
    avatar: mapMedia(row.avatar),
    coverImage: mapMedia(row.coverImage),
    allowMemberPost: row.allowMemberPost !== false,
    memberPostRequiresApproval: row.memberPostRequiresApproval !== false,
    createdAt: row.createdAt || null,
    updatedAt: row.updatedAt || null,
  };
}

function mapGroupMember(row: any) {
  if (!row?.id) return null;
  return {
    id: Number(row.id),
    role: normalizeMemberRole(row.role),
    status: normalizeMemberStatus(row.status),
    joinedAt: row.joinedAt || null,
    createdAt: row.createdAt || null,
    updatedAt: row.updatedAt || null,
    user: mapUser(row.user),
    group: mapGroup(row.group),
  };
}

function mapPost(row: any) {
  if (!row?.id) return null;
  const imageMedia = Array.isArray(row.media)
    ? row.media.map((item: any, index: number) => {
        const mapped = mapMedia(item);
        if (!mapped) return null;
        return {
          type: 'image' as const,
          order: index,
          ...mapped,
        };
      }).filter(Boolean)
    : [];
  const youtubeVideoId = toText(row.youtubeVideoId);
  const youtubeUrl = toText(row.youtubeUrl);
  const youtubeMedia = youtubeVideoId
    ? [{
        type: 'youtube' as const,
        order: imageMedia.length,
        id: `youtube:${youtubeVideoId}`,
        videoId: youtubeVideoId,
        url: youtubeUrl || `https://www.youtube.com/watch?v=${youtubeVideoId}`,
      }]
    : [];

  return {
    id: Number(row.id),
    scope: normalizePostScope(row.scope),
    title: toText(row.title) || null,
    content: toText(row.content) || '',
    contentType: normalizePostContentType(row.contentType),
    status: normalizePostStatus(row.status),
    allowComment: row.allowComment !== false,
    isPinned: row.isPinned === true,
    isFeatured: row.isFeatured === true,
    publishedAt: row.publishedAt || null,
    createdAt: row.createdAt || null,
    updatedAt: row.updatedAt || null,
    author: mapUser(row.author),
    group: mapGroup(row.group),
    media: [...imageMedia, ...youtubeMedia],
    youtubeVideoId: youtubeVideoId || null,
    youtubeUrl: youtubeUrl || null,
    commentCount: Number(row.commentCount || 0) || 0,
    reactionCount: Number(row.reactionCount || 0) || 0,
    reactionSummary: row.reactionSummary && typeof row.reactionSummary === 'object'
      ? {
          like: Number((row.reactionSummary as any).like || 0) || 0,
          love: Number((row.reactionSummary as any).love || 0) || 0,
          support: Number((row.reactionSummary as any).support || 0) || 0,
        }
      : { like: 0, love: 0, support: 0 },
    myReaction: row.myReaction ? normalizeReactionType(row.myReaction) : null,
  };
}

function normalizeReactionFilter(value: unknown): 'all' | 'like' | 'love' | 'support' {
  const normalized = toText(value).toLowerCase();
  if (!normalized || normalized === 'all') return 'all';
  if (REACTION_TYPE_VALUES.has(normalized)) return normalized as 'like' | 'love' | 'support';
  throw new CommunityError(400, 'Invalid reaction type');
}

function mapComment(row: any) {
  if (!row?.id) return null;
  const imageMedia = Array.isArray(row.media)
    ? row.media.map((item: any, index: number) => {
        const mapped = mapMedia(item);
        if (!mapped) return null;
        return {
          type: 'image' as const,
          order: index,
          ...mapped,
        };
      }).filter(Boolean)
    : [];
  return {
    id: Number(row.id),
    content: toText(row.content) || '',
    status: normalizeCommentStatus(row.status),
    parentCommentId: Number(row?.parentComment?.id || row?.parentComment || 0) || null,
    postId: Number(row?.post?.id || row?.post || 0) || null,
    media: imageMedia,
    createdAt: row.createdAt || null,
    updatedAt: row.updatedAt || null,
    edited: Boolean(row.updatedAt && row.createdAt && row.updatedAt !== row.createdAt),
    author: mapUser(row.author),
  };
}

type CommunityActor = {
  authenticated: boolean;
  tenantMember: boolean;
  communityRole: 'guest' | 'member' | 'moderator' | 'admin';
  tenantMembershipId: number | null;
};

async function findActiveTenantMembership(userId: number, tenantId: number | string) {
  if (!Number.isInteger(userId) || userId <= 0) return null;
  return await strapi.db.query(USER_TENANT_UID).findOne({
    where: {
      user: userId,
      tenant: tenantId,
      userTenantStatus: 'active',
    },
    select: ['id'],
  });
}

async function getTenantPermissionKeys(userId: number, tenantId: number | string): Promise<Set<string>> {
  const userTenant = await findActiveTenantMembership(userId, tenantId);

  const userTenantId = Number(userTenant?.id || 0);
  if (!Number.isInteger(userTenantId) || userTenantId <= 0) return new Set();

  const userTenantRoles = await strapi.db.query(USER_TENANT_ROLE_UID).findMany({
    where: {
      userTenant: userTenantId,
      userTenantRoleStatus: 'active',
    },
    populate: {
      role: true,
    },
  });

  const roleIds = Array.from(
    new Set(
      (userTenantRoles || [])
        .map((item: any) => Number(item?.role?.id || item?.role || 0))
        .filter((value: number) => Number.isInteger(value) && value > 0),
    ),
  );

  if (roleIds.length === 0) return new Set();

  const mappings = await strapi.db.query(ROLE_FEATURE_UID).findMany({
    where: {
      role: {
        id: {
          $in: roleIds,
        },
      },
      isActive: true,
    },
    populate: ['feature'],
  });

  return new Set(
    (mappings || [])
      .map((item: any) => toText(item?.feature?.key))
      .filter(Boolean),
  );
}

async function ensureUserBelongsToTenant(userId: number, tenantId: number | string) {
  const userTenant = await findActiveTenantMembership(userId, tenantId);

  if (!userTenant?.id) {
    throw new CommunityError(400, 'User does not belong to tenant');
  }
}

async function ensureLinkedClubInTenant(clubId: number, tenantId: number | string) {
  const club = await strapi.db.query(SPORTS_CLUB_UID).findOne({
    where: mergeTenantWhere({ id: { $eq: clubId } }, tenantId),
    select: ['id', 'code', 'name', 'status'],
  });
  if (!club?.id) {
    throw new CommunityError(400, 'linkedClub is invalid for this tenant');
  }
  return club;
}

async function findGroupOrThrow(groupId: unknown, tenantId: number | string) {
  const group = await strapi.db.query(COMMUNITY_GROUP_UID).findOne({
    where: mergeTenantWhere(whereByParam(groupId), tenantId),
    populate: {
      linkedClub: { select: ['id', 'code', 'name', 'status'] },
      avatar: true,
      coverImage: true,
    },
  });
  if (!group?.id) throw new CommunityError(404, 'Community group not found');
  return group;
}

async function findGroupMembership(userId: number, groupId: number, tenantId: number | string) {
  const membership = await findActiveTenantMembership(userId, tenantId);
  if (!membership?.id) return null;
  return await strapi.db.query(COMMUNITY_GROUP_MEMBER_UID).findOne({
    where: mergeTenantWhere({
      user: userId,
      group: groupId,
      status: 'active',
    }, tenantId),
    populate: {
      user: { select: ['id', 'username', 'email', 'fullName'] },
      group: { populate: { linkedClub: true } },
    },
  });
}

export async function resolveCommunityActor(params: {
  tenantId: number | string;
  authUserId?: number | null;
  permissionKeys?: Set<string>;
}): Promise<CommunityActor> {
  const authUserId = params.authUserId || null;
  if (!authUserId) {
    return {
      authenticated: false,
      tenantMember: false,
      communityRole: 'guest',
      tenantMembershipId: null,
    };
  }

  const tenantMembership = await findActiveTenantMembership(authUserId, params.tenantId);
  if (!tenantMembership?.id) {
    return {
      authenticated: true,
      tenantMember: false,
      communityRole: 'guest',
      tenantMembershipId: null,
    };
  }

  const permissionKeys = params.permissionKeys || await getTenantPermissionKeys(authUserId, params.tenantId);
  if (hasCommunityAdminPermission(permissionKeys)) {
    return {
      authenticated: true,
      tenantMember: true,
      communityRole: 'admin',
      tenantMembershipId: Number(tenantMembership.id),
    };
  }

  const moderationMembership = await strapi.db.query(COMMUNITY_GROUP_MEMBER_UID).findOne({
    where: mergeTenantWhere({
      user: authUserId,
      status: 'active',
      role: { $in: ['owner', 'moderator'] },
    }, params.tenantId),
    select: ['id'],
  });

  return {
    authenticated: true,
    tenantMember: true,
    communityRole: moderationMembership?.id ? 'moderator' : 'member',
    tenantMembershipId: Number(tenantMembership.id),
  };
}

function requireTenantMember(actor: CommunityActor, message = 'Tính năng này dành cho thành viên của Community.') {
  if (!actor.tenantMember) {
    throw new CommunityError(403, message);
  }
}

async function getMyMemberGroupIds(userId: number, tenantId: number | string): Promise<number[]> {
  const rows = await strapi.db.query(COMMUNITY_GROUP_MEMBER_UID).findMany({
    where: mergeTenantWhere({
      user: userId,
      status: 'active',
      group: {
        status: 'active',
      },
    }, tenantId),
    populate: {
      group: { select: ['id'] },
    },
  });

  return Array.from(new Set((rows || []).map((row: any) => Number(row?.group?.id || row?.group || 0)).filter((id: number) => Number.isInteger(id) && id > 0)));
}

async function getMyModerationGroupIds(userId: number, tenantId: number | string): Promise<number[]> {
  const rows = await strapi.db.query(COMMUNITY_GROUP_MEMBER_UID).findMany({
    where: mergeTenantWhere({
      user: userId,
      status: 'active',
      role: { $in: ['owner', 'moderator'] },
      group: {
        status: 'active',
      },
    }, tenantId),
    populate: {
      group: { select: ['id'] },
    },
  });

  return Array.from(new Set((rows || []).map((row: any) => Number(row?.group?.id || row?.group || 0)).filter((id: number) => Number.isInteger(id) && id > 0)));
}

function hasCommunityAdminPermission(permissionKeys: Set<string>) {
  return permissionKeys.has('community-config.manage')
    || permissionKeys.has('community-group.manage')
    || permissionKeys.has('community-post.manage');
}

async function canManageGroupMembership(params: {
  tenantId: number | string;
  groupId: number;
  actorUserId: number;
  permissionKeys: Set<string>;
}): Promise<boolean> {
  if (hasCommunityAdminPermission(params.permissionKeys)) return true;
  const membership = await findGroupMembership(params.actorUserId, params.groupId, params.tenantId);
  if (!membership?.id) return false;
  return membership.role === 'owner' || membership.role === 'moderator';
}

async function ensureLastOwnerNotRemoved(groupId: number, tenantId: number | string, memberId: number) {
  const target = await strapi.db.query(COMMUNITY_GROUP_MEMBER_UID).findOne({
    where: mergeTenantWhere({ id: { $eq: memberId }, group: groupId }, tenantId),
    select: ['id', 'role', 'status'],
  });
  if (!target?.id || target.role !== 'owner' || target.status !== 'active') return;

  const activeOwners = await strapi.db.query(COMMUNITY_GROUP_MEMBER_UID).count({
    where: mergeTenantWhere({
      group: groupId,
      status: 'active',
      role: 'owner',
    }, tenantId),
  });

  if (activeOwners <= 1) {
    throw new CommunityError(409, 'Cannot remove the last active owner');
  }
}

async function resolveCommunityPolicy(tenantId: number | string) {
  const activeConfig = await getActiveCommunityConfig(tenantId);
  const policyConfig = activeConfig?.policyConfig && typeof activeConfig.policyConfig === 'object'
    ? activeConfig.policyConfig as Record<string, unknown>
    : {};
  const feedConfig = activeConfig?.feedConfig && typeof activeConfig.feedConfig === 'object'
    ? activeConfig.feedConfig as Record<string, unknown>
    : {};

  return {
    activeConfig,
    policy: {
      allowMemberPost: toBoolean(policyConfig.allowMemberPost, true),
      memberPostRequiresApproval: toBoolean(policyConfig.memberPostRequiresApproval, true),
      defaultAllowComment: toBoolean(policyConfig.defaultAllowComment, true),
      allowReaction: toBoolean(policyConfig.allowReaction, true),
    },
    feed: {
      pageSize: Number.isInteger(Number(feedConfig.pageSize)) && Number(feedConfig.pageSize) > 0 ? Number(feedConfig.pageSize) : 20,
      showPinned: toBoolean(feedConfig.showPinned, true),
      showFeatured: toBoolean(feedConfig.showFeatured, true),
    },
  };
}

function buildGroupWriteData(payload: Record<string, unknown>) {
  const linkedType = normalizeGroupLinkedType(payload.linkedType);
  const linkedClubRaw = parseOptionalPositiveInt(payload.linkedClub);
  if (linkedType === 'club' && !linkedClubRaw) {
    throw new CommunityError(400, 'linkedClub is required when linkedType=club');
  }
  if (linkedType === 'none' && linkedClubRaw) {
    throw new CommunityError(400, 'linkedClub must be null when linkedType=none');
  }

  return {
    name: toRequiredText(payload.name, 'name'),
    slug: normalizeSlug(payload.slug || payload.name),
    description: toNullableText(payload.description),
    visibility: normalizeGroupVisibility(payload.visibility),
    status: normalizeGroupStatus(payload.status),
    linkedType,
    linkedClubId: linkedType === 'club' ? linkedClubRaw : null,
    allowMemberPost: toBoolean(payload.allowMemberPost, true),
    memberPostRequiresApproval: toBoolean(payload.memberPostRequiresApproval, true),
    avatar: parseOptionalPositiveInt(payload.avatar),
    coverImage: parseOptionalPositiveInt(payload.coverImage),
  };
}

export async function listCommunityGroups(params: {
  tenantId: number | string;
  query: Record<string, unknown>;
  authUserId?: number | null;
  permissionKeys?: Set<string>;
}) {
  const query = params.query || {};
  const q = toText(query.q);
  const status = toText(query.status).toLowerCase();
  const mine = toBoolean(query.mine, false);
  const actor = await resolveCommunityActor({
    tenantId: params.tenantId,
    authUserId: params.authUserId || null,
    permissionKeys: params.permissionKeys || new Set<string>(),
  });
  const page = parseOptionalPositiveInt((query.pagination as any)?.page) || parseOptionalPositiveInt(query.page) || 1;
  const pageSize = parseOptionalPositiveInt((query.pagination as any)?.pageSize) || parseOptionalPositiveInt(query.pageSize) || 20;

  const whereClauses: Record<string, unknown>[] = [];
  if (q) {
    whereClauses.push({
      $or: [{ name: { $containsi: q } }, { slug: { $containsi: q } }, { description: { $containsi: q } }],
    });
  }
  if (GROUP_STATUS_VALUES.has(status)) {
    whereClauses.push({ status });
  }

  const isAdmin = Boolean(params.permissionKeys && hasCommunityAdminPermission(params.permissionKeys));
  if (!isAdmin) {
    whereClauses.push({ status: 'active' });
  }

  if (mine) {
    if (!params.authUserId) throw new CommunityError(401, 'Authentication is required');
    requireTenantMember(actor);
    const memberGroupIds = await getMyMemberGroupIds(params.authUserId, params.tenantId);
    if (memberGroupIds.length === 0) {
      return { rows: [], pagination: { page, pageSize, pageCount: 1, total: 0 } };
    }
    whereClauses.push({ id: { $in: memberGroupIds } });
  } else if (!isAdmin) {
    if (actor.tenantMember && params.authUserId) {
      const memberGroupIds = await getMyMemberGroupIds(params.authUserId, params.tenantId);
      if (memberGroupIds.length > 0) {
        whereClauses.push({
          $or: [
            { visibility: 'public' },
            { id: { $in: memberGroupIds } },
          ],
        });
      } else {
        whereClauses.push({ visibility: 'public' });
      }
    } else {
      whereClauses.push({ visibility: 'public' });
    }
  }

  const baseWhere = whereClauses.length === 0 ? {} : whereClauses.length === 1 ? whereClauses[0] : { $and: whereClauses };
  const where = mergeTenantWhere(baseWhere, params.tenantId);
  const offset = (page - 1) * pageSize;

  const [rows, total] = await Promise.all([
    strapi.db.query(COMMUNITY_GROUP_UID).findMany({
      where,
      orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
      offset,
      limit: pageSize,
      populate: {
        linkedClub: { select: ['id', 'code', 'name', 'status'] },
        avatar: true,
        coverImage: true,
      },
    }),
    strapi.db.query(COMMUNITY_GROUP_UID).count({ where }),
  ]);

  return {
    rows: (rows || []).map(mapGroup).filter(Boolean),
    pagination: {
      page,
      pageSize,
      pageCount: Math.max(1, Math.ceil(total / pageSize)),
      total,
    },
  };
}

export async function getCommunityGroupDetail(groupId: unknown, tenantId: number | string, authUserId?: number | null, permissionKeys: Set<string> = new Set<string>()) {
  const group = await findGroupOrThrow(groupId, tenantId);
  if (normalizeGroupVisibility(group.visibility) === 'members') {
    const canView = await canViewGroupFeed(group, tenantId, authUserId || null, permissionKeys);
    if (!canView) throw new CommunityError(403, 'Forbidden');
  }
  return mapGroup(group);
}

export async function createCommunityGroup(payload: Record<string, unknown>, tenantId: number | string, actorUserId: number) {
  const nextData = buildGroupWriteData(payload);
  if (!nextData.slug) throw new CommunityError(400, 'slug is required');

  if (nextData.linkedType === 'club' && nextData.linkedClubId) {
    await ensureLinkedClubInTenant(nextData.linkedClubId, tenantId);
  }

  const duplicate = await strapi.db.query(COMMUNITY_GROUP_UID).findOne({
    where: mergeTenantWhere({ slug: { $eq: nextData.slug } }, tenantId),
    select: ['id'],
  });
  if (duplicate?.id) throw new CommunityError(409, 'slug already exists in tenant');

  const created = await strapi.db.query(COMMUNITY_GROUP_UID).create({
    data: {
      tenant: tenantId,
      name: nextData.name,
      slug: nextData.slug,
      description: nextData.description,
      visibility: nextData.visibility,
      status: nextData.status,
      linkedType: nextData.linkedType,
      linkedClub: nextData.linkedClubId,
      allowMemberPost: nextData.allowMemberPost,
      memberPostRequiresApproval: nextData.memberPostRequiresApproval,
      avatar: nextData.avatar,
      coverImage: nextData.coverImage,
    },
  });

  await strapi.db.query(COMMUNITY_GROUP_MEMBER_UID).create({
    data: {
      tenant: tenantId,
      group: created.id,
      user: actorUserId,
      role: 'owner',
      status: 'active',
      joinedAt: new Date().toISOString(),
    },
  });

  const detail = await findGroupOrThrow(created.id, tenantId);
  return mapGroup(detail);
}

export async function updateCommunityGroup(groupId: unknown, payload: Record<string, unknown>, tenantId: number | string) {
  const group = await findGroupOrThrow(groupId, tenantId);
  const nextData = buildGroupWriteData({
    ...group,
    ...payload,
  });
  if (!nextData.slug) throw new CommunityError(400, 'slug is required');

  if (nextData.linkedType === 'club' && nextData.linkedClubId) {
    await ensureLinkedClubInTenant(nextData.linkedClubId, tenantId);
  }

  const duplicate = await strapi.db.query(COMMUNITY_GROUP_UID).findOne({
    where: mergeTenantWhere({
      slug: { $eq: nextData.slug },
      id: { $ne: group.id },
    }, tenantId),
    select: ['id'],
  });
  if (duplicate?.id) throw new CommunityError(409, 'slug already exists in tenant');

  await strapi.db.query(COMMUNITY_GROUP_UID).update({
    where: { id: group.id },
    data: {
      name: nextData.name,
      slug: nextData.slug,
      description: nextData.description,
      visibility: nextData.visibility,
      status: nextData.status,
      linkedType: nextData.linkedType,
      linkedClub: nextData.linkedClubId,
      allowMemberPost: nextData.allowMemberPost,
      memberPostRequiresApproval: nextData.memberPostRequiresApproval,
      avatar: nextData.avatar,
      coverImage: nextData.coverImage,
    },
  });

  const detail = await findGroupOrThrow(group.id, tenantId);
  return mapGroup(detail);
}

export async function archiveCommunityGroup(groupId: unknown, tenantId: number | string) {
  const group = await findGroupOrThrow(groupId, tenantId);
  await strapi.db.query(COMMUNITY_GROUP_UID).update({
    where: { id: group.id },
    data: { status: 'archived' },
  });
  const detail = await findGroupOrThrow(group.id, tenantId);
  return mapGroup(detail);
}

export async function listCommunityGroupMembers(groupId: unknown, tenantId: number | string, actorUserId: number, permissionKeys: Set<string>) {
  const group = await findGroupOrThrow(groupId, tenantId);
  const canManage = await canManageGroupMembership({
    tenantId,
    groupId: Number(group.id),
    actorUserId,
    permissionKeys,
  });
  if (!canManage) {
    const ownMembership = await findGroupMembership(actorUserId, Number(group.id), tenantId);
    if (!ownMembership?.id) throw new CommunityError(403, 'Forbidden');
  }

  const rows = await strapi.db.query(COMMUNITY_GROUP_MEMBER_UID).findMany({
    where: mergeTenantWhere({ group: group.id }, tenantId),
    orderBy: [{ status: 'asc' }, { role: 'asc' }, { id: 'asc' }],
    populate: {
      user: { select: ['id', 'username', 'email', 'fullName'] },
      group: {
        populate: {
          linkedClub: { select: ['id', 'code', 'name', 'status'] },
          avatar: true,
          coverImage: true,
        },
      },
    },
  });

  return (rows || []).map(mapGroupMember).filter(Boolean);
}

export async function addCommunityGroupMember(groupId: unknown, payload: Record<string, unknown>, tenantId: number | string, actorUserId: number, permissionKeys: Set<string>) {
  const group = await findGroupOrThrow(groupId, tenantId);
  const canManage = await canManageGroupMembership({
    tenantId,
    groupId: Number(group.id),
    actorUserId,
    permissionKeys,
  });
  if (!canManage) throw new CommunityError(403, 'Forbidden');

  const userId = parseOptionalPositiveInt(payload.userId || payload.user);
  if (!userId) throw new CommunityError(400, 'userId is required');
  await ensureUserBelongsToTenant(userId, tenantId);

  const user = await strapi.db.query(USER_UID).findOne({
    where: { id: userId },
    select: ['id', 'username', 'email', 'fullName', 'blocked'],
  });
  if (!user?.id || user.blocked) throw new CommunityError(400, 'Invalid user');

  const role = normalizeMemberRole(payload.role);
  const status = normalizeMemberStatus(payload.status);

  const existing = await strapi.db.query(COMMUNITY_GROUP_MEMBER_UID).findOne({
    where: mergeTenantWhere({
      group: group.id,
      user: user.id,
      status: 'active',
    }, tenantId),
    select: ['id'],
  });
  if (existing?.id && status === 'active') {
    throw new CommunityError(409, 'User already has an active membership in this group');
  }

  const created = await strapi.db.query(COMMUNITY_GROUP_MEMBER_UID).create({
    data: {
      tenant: tenantId,
      group: group.id,
      user: user.id,
      role,
      status,
      joinedAt: payload.joinedAt || new Date().toISOString(),
    },
  });

  const detail = await strapi.db.query(COMMUNITY_GROUP_MEMBER_UID).findOne({
    where: { id: created.id },
    populate: {
      user: { select: ['id', 'username', 'email', 'fullName'] },
      group: { populate: { linkedClub: true, avatar: true, coverImage: true } },
    },
  });
  return mapGroupMember(detail);
}

export async function updateCommunityGroupMember(groupId: unknown, memberId: unknown, payload: Record<string, unknown>, tenantId: number | string, actorUserId: number, permissionKeys: Set<string>) {
  const group = await findGroupOrThrow(groupId, tenantId);
  const canManage = await canManageGroupMembership({
    tenantId,
    groupId: Number(group.id),
    actorUserId,
    permissionKeys,
  });
  if (!canManage) throw new CommunityError(403, 'Forbidden');

  const normalizedMemberId = parseOptionalPositiveInt(memberId);
  if (!normalizedMemberId) throw new CommunityError(404, 'Membership not found');

  const membership = await strapi.db.query(COMMUNITY_GROUP_MEMBER_UID).findOne({
    where: mergeTenantWhere({ id: { $eq: normalizedMemberId }, group: group.id }, tenantId),
    populate: {
      user: { select: ['id', 'username', 'email', 'fullName'] },
      group: { populate: { linkedClub: true, avatar: true, coverImage: true } },
    },
  });
  if (!membership?.id) throw new CommunityError(404, 'Membership not found');

  const role = hasOwnProperty(payload, 'role') ? normalizeMemberRole(payload.role) : normalizeMemberRole(membership.role);
  const status = hasOwnProperty(payload, 'status') ? normalizeMemberStatus(payload.status) : normalizeMemberStatus(membership.status);
  if ((status !== 'active' || role !== 'owner') && normalizeMemberRole(membership.role) === 'owner' && normalizeMemberStatus(membership.status) === 'active') {
    await ensureLastOwnerNotRemoved(Number(group.id), tenantId, normalizedMemberId);
  }

  if (status === 'active') {
    const existing = await strapi.db.query(COMMUNITY_GROUP_MEMBER_UID).findOne({
      where: mergeTenantWhere({
        group: group.id,
        user: membership.user?.id || membership.user,
        status: 'active',
        id: { $ne: normalizedMemberId },
      }, tenantId),
      select: ['id'],
    });
    if (existing?.id) throw new CommunityError(409, 'User already has an active membership in this group');
  }

  await strapi.db.query(COMMUNITY_GROUP_MEMBER_UID).update({
    where: { id: normalizedMemberId },
    data: {
      role,
      status,
    },
  });

  const detail = await strapi.db.query(COMMUNITY_GROUP_MEMBER_UID).findOne({
    where: { id: normalizedMemberId },
    populate: {
      user: { select: ['id', 'username', 'email', 'fullName'] },
      group: { populate: { linkedClub: true, avatar: true, coverImage: true } },
    },
  });
  return mapGroupMember(detail);
}

export async function removeCommunityGroupMember(groupId: unknown, memberId: unknown, tenantId: number | string, actorUserId: number, permissionKeys: Set<string>) {
  const group = await findGroupOrThrow(groupId, tenantId);
  const canManage = await canManageGroupMembership({
    tenantId,
    groupId: Number(group.id),
    actorUserId,
    permissionKeys,
  });
  if (!canManage) throw new CommunityError(403, 'Forbidden');

  const normalizedMemberId = parseOptionalPositiveInt(memberId);
  if (!normalizedMemberId) throw new CommunityError(404, 'Membership not found');
  await ensureLastOwnerNotRemoved(Number(group.id), tenantId, normalizedMemberId);

  const existing = await strapi.db.query(COMMUNITY_GROUP_MEMBER_UID).findOne({
    where: mergeTenantWhere({ id: { $eq: normalizedMemberId }, group: group.id }, tenantId),
    select: ['id'],
  });
  if (!existing?.id) throw new CommunityError(404, 'Membership not found');

  await strapi.db.query(COMMUNITY_GROUP_MEMBER_UID).update({
    where: { id: existing.id },
    data: {
      status: 'inactive',
    },
  });
}

export async function getMyCommunityGroups(tenantId: number | string, authUserId: number) {
  const actor = await resolveCommunityActor({ tenantId, authUserId });
  if (!actor.tenantMember) return [];
  const rows = await strapi.db.query(COMMUNITY_GROUP_MEMBER_UID).findMany({
    where: mergeTenantWhere({
      user: authUserId,
      status: 'active',
      group: { status: 'active' },
    }, tenantId),
    orderBy: [{ updatedAt: 'desc' }],
    populate: {
      group: {
        populate: {
          linkedClub: { select: ['id', 'code', 'name', 'status'] },
          avatar: true,
          coverImage: true,
        },
      },
    },
  });

  return (rows || []).map((row: any) => ({
    id: Number(row.id),
    role: normalizeMemberRole(row.role),
    joinedAt: row.joinedAt || null,
    group: mapGroup(row.group),
  })).filter((row: any) => row.group);
}

function hasOwnProperty(payload: Record<string, unknown>, key: string) {
  return Object.prototype.hasOwnProperty.call(payload, key);
}

async function canViewGroupFeed(group: any, tenantId: number | string, authUserId: number | null, permissionKeys: Set<string>) {
  const actor = await resolveCommunityActor({ tenantId, authUserId, permissionKeys });
  if (hasCommunityAdminPermission(permissionKeys)) return true;
  if (!actor.tenantMember || !authUserId) return false;
  const membership = await findGroupMembership(authUserId, Number(group.id), tenantId);
  return Boolean(membership?.id);
}

async function canModeratePost(post: any, tenantId: number | string, authUserId: number, permissionKeys: Set<string>) {
  const actor = await resolveCommunityActor({ tenantId, authUserId, permissionKeys });
  if (hasCommunityAdminPermission(permissionKeys)) return true;
  if (!actor.tenantMember) return false;
  if (post.scope !== 'group' || !post.group?.id) return false;
  const membership = await findGroupMembership(authUserId, Number(post.group.id), tenantId);
  if (!membership?.id) return false;
  return membership.role === 'owner' || membership.role === 'moderator';
}

async function findPostOrThrow(postId: unknown, tenantId: number | string) {
  const post = await strapi.db.query(COMMUNITY_POST_UID).findOne({
    where: mergeTenantWhere(whereByParam(postId), tenantId),
    populate: {
      author: { select: ['id', 'username', 'email', 'fullName'] },
      group: { select: ['id', 'status', 'visibility'] },
      media: true,
    },
  });
  if (!post?.id || post.isDeleted === true) throw new CommunityError(404, 'Community post not found');
  return post;
}

async function canViewCommunityPost(post: any, tenantId: number | string, authUserId: number | null, permissionKeys: Set<string>) {
  const actor = await resolveCommunityActor({ tenantId, authUserId, permissionKeys });
  if (normalizePostStatus(post.status) !== 'published') return false;

  if (post.scope === 'public') return true;
  if (hasCommunityAdminPermission(permissionKeys)) return true;

  if (post.scope === 'community') {
    return actor.tenantMember;
  }

  if (post.scope === 'group') {
    return await canViewGroupFeed(post.group || {}, tenantId, authUserId, permissionKeys);
  }

  return false;
}

async function enrichPostsWithInteractions(posts: any[], tenantId: number | string, authUserId: number | null) {
  if (!Array.isArray(posts) || posts.length === 0) return posts;
  const postIds = Array.from(new Set(posts.map((row) => Number(row?.id || 0)).filter((id) => Number.isInteger(id) && id > 0)));
  if (postIds.length === 0) return posts;

  const [commentRows, reactionRows] = await Promise.all([
    strapi.db.query(COMMUNITY_COMMENT_UID).findMany({
      where: mergeTenantWhere({
        post: { id: { $in: postIds } },
        status: 'active',
      }, tenantId),
      select: ['id'],
      populate: {
        post: { select: ['id'] },
      },
    }),
    strapi.db.query(COMMUNITY_REACTION_UID).findMany({
      where: mergeTenantWhere({
        post: { id: { $in: postIds } },
      }, tenantId),
      select: ['id', 'type'],
      populate: {
        post: { select: ['id'] },
        user: { select: ['id'] },
      },
    }),
  ]);

  const commentCountByPost: Record<number, number> = {};
  for (const comment of commentRows || []) {
    const postId = Number((comment as any)?.post?.id || (comment as any)?.post || 0);
    if (!postId) continue;
    commentCountByPost[postId] = Number(commentCountByPost[postId] || 0) + 1;
  }

  const reactionSummaryByPost: Record<number, { like: number; love: number; support: number }> = {};
  const myReactionByPost: Record<number, 'like' | 'love' | 'support' | null> = {};
  for (const reaction of reactionRows || []) {
    const postId = Number((reaction as any)?.post?.id || (reaction as any)?.post || 0);
    if (!postId) continue;
    const type = normalizeReactionType((reaction as any).type);
    if (!reactionSummaryByPost[postId]) {
      reactionSummaryByPost[postId] = { like: 0, love: 0, support: 0 };
    }
    reactionSummaryByPost[postId][type] += 1;

    if (authUserId && Number((reaction as any)?.user?.id || (reaction as any)?.user || 0) === authUserId) {
      myReactionByPost[postId] = type;
    }
  }

  return posts.map((post) => {
    const postId = Number(post?.id || 0);
    const summary = reactionSummaryByPost[postId] || { like: 0, love: 0, support: 0 };
    const reactionCount = summary.like + summary.love + summary.support;
    return {
      ...post,
      commentCount: Number(commentCountByPost[postId] || 0),
      reactionCount,
      reactionSummary: summary,
      myReaction: myReactionByPost[postId] || null,
    };
  });
}

async function resolvePostStatusForCreate(params: {
  scope: 'public' | 'community' | 'group';
  group: any | null;
  tenantId: number | string;
  authUserId: number;
  permissionKeys: Set<string>;
  requestedStatus: 'draft' | 'pending' | 'rejected' | 'published' | 'hidden';
}) {
  const isAdmin = hasCommunityAdminPermission(params.permissionKeys);
  const requestedStatus = params.requestedStatus;
  if (requestedStatus === 'draft') return 'draft';

  if (params.scope === 'group') {
    if (!params.group?.id) throw new CommunityError(400, 'group is required');
    const membership = await findGroupMembership(params.authUserId, Number(params.group.id), params.tenantId);
    const isGroupModerator = Boolean(membership?.id && (membership.role === 'owner' || membership.role === 'moderator'));
    if (!membership?.id && !isAdmin) throw new CommunityError(403, 'Only group members can post in this group');
    if (!isAdmin && !isGroupModerator && params.group.allowMemberPost === false) {
      throw new CommunityError(403, 'Group does not allow member posts');
    }
    if (isAdmin || isGroupModerator) return 'published';
    if (params.group.memberPostRequiresApproval !== false) return 'pending';
    return 'published';
  }

  const communityPolicy = await resolveCommunityPolicy(params.tenantId);
  if (!isAdmin && communityPolicy.policy.allowMemberPost === false) {
    throw new CommunityError(403, 'Community does not allow member posts');
  }
  if (isAdmin) return 'published';
  if (communityPolicy.policy.memberPostRequiresApproval !== false) return 'pending';
  return 'published';
}

async function canMemberDirectPublishPost(post: any, tenantId: number | string, authUserId: number, permissionKeys: Set<string>) {
  const actor = await resolveCommunityActor({ tenantId, authUserId, permissionKeys });
  if (!actor.tenantMember || !authUserId) return false;

  const isOwner = Number(post?.author?.id || post?.author || 0) === authUserId;
  if (!isOwner) return false;

  if (post?.scope === 'group') {
    const group = post?.group?.id ? await findGroupOrThrow(post.group.id, tenantId) : null;
    return Boolean(group && group.memberPostRequiresApproval === false);
  }

  const communityPolicy = await resolveCommunityPolicy(tenantId);
  return communityPolicy.policy.memberPostRequiresApproval === false;
}

async function normalizePostImageMediaIds(mediaValue: unknown) {
  const candidateIds = Array.isArray(mediaValue)
    ? Array.from(new Set(mediaValue.map(parseOptionalPositiveInt).filter(Boolean) as number[]))
    : [];
  if (candidateIds.length === 0) return [];

  const uploadFiles = await strapi.db.query(UPLOAD_FILE_UID).findMany({
    where: {
      id: { $in: candidateIds },
    },
    select: ['id', 'mime', 'ext'],
  });
  const uploadFileById = new Map<number, any>();
  for (const file of uploadFiles || []) {
    const fileId = Number((file as any)?.id || 0);
    if (fileId > 0) uploadFileById.set(fileId, file);
  }

  const missingIds = candidateIds.filter((fileId) => !uploadFileById.has(fileId));
  const bridgedUploadIds = new Map<number, number>();

  if (missingIds.length > 0) {
    const fileAssets = await strapi.db.query(FILE_ASSET_UID).findMany({
      where: {
        id: { $in: missingIds },
      },
      select: ['id', 'originalName', 'fileName', 'extension', 'mimeType', 'size', 'provider', 'url', 'relativePath'],
    });
    const fileAssetById = new Map<number, any>();
    for (const fileAsset of fileAssets || []) {
      const fileAssetId = Number((fileAsset as any)?.id || 0);
      if (fileAssetId > 0) fileAssetById.set(fileAssetId, fileAsset);
    }

    for (const fileAssetId of missingIds) {
      const fileAsset = fileAssetById.get(fileAssetId);
      if (!fileAsset?.id) throw new CommunityError(400, 'Ảnh tải lên không hợp lệ.');

      const mime = toText(fileAsset.mimeType).toLowerCase();
      const ext = (() => {
        const raw = toText(fileAsset.extension).toLowerCase();
        if (!raw) return '';
        return raw.startsWith('.') ? raw : `.${raw}`;
      })();
      const isImageMime = mime.startsWith(IMAGE_MIME_PREFIX);
      const isSupportedExt = IMAGE_EXTENSION_VALUES.has(ext);
      if (!isImageMime || !isSupportedExt) {
        throw new CommunityError(400, 'Hiện Community chưa hỗ trợ tải video trực tiếp. Vui lòng tải video lên YouTube và dán liên kết vào bài viết.');
      }

      const existingUploadFile = await strapi.db.query(UPLOAD_FILE_UID).findOne({
        where: {
          url: toText(fileAsset.url),
          provider: toText(fileAsset.provider) || 'local',
        },
        select: ['id'],
      });
      if (existingUploadFile?.id) {
        bridgedUploadIds.set(fileAssetId, Number(existingUploadFile.id));
        continue;
      }

      const originalName = toText(fileAsset.originalName) || toText(fileAsset.fileName) || `community-image-${fileAsset.id}${ext}`;
      const baseHash = toText(fileAsset.fileName || fileAsset.originalName || `community-image-${fileAsset.id}`)
        .replace(/\.[^.]+$/, '')
        .replace(/[^A-Za-z0-9._-]+/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-+|-+$/g, '')
        .toLowerCase() || `community-image-${fileAsset.id}`;
      const createdUploadFile = await strapi.db.query(UPLOAD_FILE_UID).create({
        data: {
          name: originalName,
          alternativeText: null,
          caption: null,
          ext,
          folderPath: '/',
          formats: null,
          hash: `${baseHash}-file-asset-${fileAsset.id}`,
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
      });
      if (!createdUploadFile?.id) {
        throw new CommunityError(500, 'Không thể đồng bộ ảnh bài viết.');
      }
      bridgedUploadIds.set(fileAssetId, Number(createdUploadFile.id));
    }
  }

  const normalizedUploadIds: number[] = [];
  for (const fileId of candidateIds) {
    const file = uploadFileById.get(fileId);
    if (file?.id) {
      const mime = toText(file.mime).toLowerCase();
      const ext = toText(file.ext).toLowerCase();
      const isImageMime = mime.startsWith(IMAGE_MIME_PREFIX);
      const isSupportedExt = IMAGE_EXTENSION_VALUES.has(ext);
      if (!isImageMime || !isSupportedExt) {
        throw new CommunityError(400, 'Hiện Community chưa hỗ trợ tải video trực tiếp. Vui lòng tải video lên YouTube và dán liên kết vào bài viết.');
      }
      normalizedUploadIds.push(Number(file.id));
      continue;
    }

    const bridgedId = bridgedUploadIds.get(fileId);
    if (!bridgedId) {
      throw new CommunityError(400, 'Ảnh tải lên không hợp lệ.');
    }
    normalizedUploadIds.push(bridgedId);
  }

  return Array.from(new Set(normalizedUploadIds));
}

async function normalizePostWritePayload(payload: Record<string, unknown>) {
  const scope = normalizePostScope(payload.scope);
  const contentType = normalizePostContentType(payload.contentType);
  const groupId = parseOptionalPositiveInt(payload.group);
  if (scope === 'group' && !groupId) {
    throw new CommunityError(400, 'group is required when scope=group');
  }
  if (scope !== 'group' && groupId) {
    throw new CommunityError(400, 'group must be null unless scope=group');
  }

  const content = contentType === 'html'
    ? sanitizeHtml(payload.content)
    : toText(payload.content);
  if (!content) throw new CommunityError(400, 'content is required');

  const media = await normalizePostImageMediaIds(payload.media);
  const youtube = normalizeYouTubeUrl(payload.youtubeUrl);

  return {
    scope,
    groupId,
    title: toNullableText(payload.title),
    content,
    contentType,
    allowComment: toBoolean(payload.allowComment, true),
    media,
    youtubeUrl: youtube?.url || null,
    youtubeVideoId: youtube?.videoId || null,
    requestedStatus: normalizePostStatus(payload.status),
  };
}

export async function createCommunityPost(payload: Record<string, unknown>, tenantId: number | string, authUserId: number, permissionKeys: Set<string>) {
  const actor = await resolveCommunityActor({ tenantId, authUserId, permissionKeys });
  requireTenantMember(actor);
  const normalized = await normalizePostWritePayload(payload);
  if (normalized.requestedStatus !== 'draft') {
    throw new CommunityError(400, 'Use dedicated workflow actions to submit/publish posts');
  }

  let group = null;
  if (normalized.scope === 'group' && normalized.groupId) {
    group = await findGroupOrThrow(normalized.groupId, tenantId);
    if (group.status !== 'active') throw new CommunityError(400, 'group is not active');
  }

  const isAdmin = hasCommunityAdminPermission(permissionKeys);
  if (!isAdmin && normalized.scope === 'group') {
    const membership = await findGroupMembership(authUserId, Number(group?.id || 0), tenantId);
    if (!membership?.id) throw new CommunityError(403, 'Only group members can create posts in this group');
    if (group?.allowMemberPost === false) throw new CommunityError(403, 'Group does not allow member posts');
  }
  if (!isAdmin && normalized.scope !== 'group') {
    const communityPolicy = await resolveCommunityPolicy(tenantId);
    if (communityPolicy.policy.allowMemberPost === false) {
      throw new CommunityError(403, 'Community does not allow member posts');
    }
  }

  const finalStatus: 'draft' = 'draft';

  const policy = await resolveCommunityPolicy(tenantId);
  const allowComment = hasOwnProperty(payload, 'allowComment')
    ? normalized.allowComment
    : (normalized.scope === 'group' ? true : policy.policy.defaultAllowComment);

  const created = await strapi.db.query(COMMUNITY_POST_UID).create({
    data: {
      tenant: tenantId,
      author: authUserId,
      scope: normalized.scope,
      group: normalized.groupId,
      title: normalized.title,
      content: normalized.content,
      contentType: normalized.contentType,
      media: normalized.media,
      youtubeUrl: normalized.youtubeUrl,
      youtubeVideoId: normalized.youtubeVideoId,
      status: finalStatus,
      allowComment,
      isPinned: false,
      isFeatured: false,
      publishedAt: null,
      isDeleted: false,
    },
  });

  const detail = await strapi.db.query(COMMUNITY_POST_UID).findOne({
    where: { id: created.id },
    populate: {
      author: { select: ['id', 'username', 'email', 'fullName'] },
      group: { populate: { linkedClub: true, avatar: true, coverImage: true } },
      media: true,
    },
  });
  return mapPost(detail);
}

export async function updateCommunityPost(postId: unknown, payload: Record<string, unknown>, tenantId: number | string, authUserId: number, permissionKeys: Set<string>) {
  const actor = await resolveCommunityActor({ tenantId, authUserId, permissionKeys });
  const existing = await strapi.db.query(COMMUNITY_POST_UID).findOne({
    where: mergeTenantWhere(whereByParam(postId), tenantId),
    populate: {
      group: { select: ['id', 'allowMemberPost', 'memberPostRequiresApproval', 'status'] },
      author: { select: ['id'] },
    },
  });
  if (!existing?.id) throw new CommunityError(404, 'Community post not found');
  if (existing.isDeleted === true) throw new CommunityError(404, 'Community post not found');

  const isOwner = Number(existing.author?.id || existing.author || 0) === authUserId;
  const canModerate = await canModeratePost(existing, tenantId, authUserId, permissionKeys);
  if (!canModerate) requireTenantMember(actor);
  if (!isOwner && !canModerate) throw new CommunityError(403, 'Forbidden');
  if (!canModerate && !['draft', 'rejected'].includes(normalizePostStatus(existing.status))) {
    throw new CommunityError(403, 'Only draft or rejected posts can be edited.');
  }

  const mergedPayload = {
    scope: hasOwnProperty(payload, 'scope') ? payload.scope : existing.scope,
    group: hasOwnProperty(payload, 'group') ? payload.group : existing.group?.id || existing.group || null,
    title: hasOwnProperty(payload, 'title') ? payload.title : existing.title,
    content: hasOwnProperty(payload, 'content') ? payload.content : existing.content,
    contentType: hasOwnProperty(payload, 'contentType') ? payload.contentType : existing.contentType,
    allowComment: hasOwnProperty(payload, 'allowComment') ? payload.allowComment : existing.allowComment,
    media: hasOwnProperty(payload, 'media') ? payload.media : (Array.isArray(existing.media) ? existing.media.map((item: any) => Number(item?.id || item)).filter(Boolean) : []),
    youtubeUrl: hasOwnProperty(payload, 'youtubeUrl') ? payload.youtubeUrl : existing.youtubeUrl,
    status: hasOwnProperty(payload, 'status') ? payload.status : existing.status,
  };
  const normalized = await normalizePostWritePayload(mergedPayload);

  const finalStatus = normalizePostStatus(existing.status);

  await strapi.db.query(COMMUNITY_POST_UID).update({
    where: { id: existing.id },
    data: {
      scope: normalized.scope,
      group: normalized.groupId,
      title: normalized.title,
      content: normalized.content,
      contentType: normalized.contentType,
      allowComment: normalized.allowComment,
      media: normalized.media,
      youtubeUrl: normalized.youtubeUrl,
      youtubeVideoId: normalized.youtubeVideoId,
      status: finalStatus,
      publishedAt: finalStatus === 'published'
        ? (existing.publishedAt || new Date().toISOString())
        : null,
    },
  });

  const detail = await strapi.db.query(COMMUNITY_POST_UID).findOne({
    where: { id: existing.id },
    populate: {
      author: { select: ['id', 'username', 'email', 'fullName'] },
      group: { populate: { linkedClub: true, avatar: true, coverImage: true } },
      media: true,
    },
  });
  return mapPost(detail);
}

export async function submitCommunityPostForReview(postId: unknown, tenantId: number | string, authUserId: number, permissionKeys: Set<string>) {
  const actor = await resolveCommunityActor({ tenantId, authUserId, permissionKeys });
  const existing = await strapi.db.query(COMMUNITY_POST_UID).findOne({
    where: mergeTenantWhere(whereByParam(postId), tenantId),
    populate: {
      group: { select: ['id', 'allowMemberPost', 'memberPostRequiresApproval', 'status'] },
      author: { select: ['id'] },
    },
  });
  if (!existing?.id || existing.isDeleted === true) throw new CommunityError(404, 'Community post not found');

  const isOwner = Number(existing.author?.id || existing.author || 0) === authUserId;
  const canModerate = await canModeratePost(existing, tenantId, authUserId, permissionKeys);
  if (!canModerate) requireTenantMember(actor);
  if (!isOwner && !canModerate) throw new CommunityError(403, 'Forbidden');
  if (!['draft', 'rejected'].includes(normalizePostStatus(existing.status))) {
    throw new CommunityError(409, 'Only draft or rejected posts can be submitted for review');
  }

  if (!canModerate && existing.scope === 'group') {
    const groupId = Number(existing.group?.id || existing.group || 0);
    const membership = await findGroupMembership(authUserId, groupId, tenantId);
    if (!membership?.id) throw new CommunityError(403, 'Only group members can submit this post');
    if (existing.group?.allowMemberPost === false) throw new CommunityError(403, 'Group does not allow member posts');
    if (existing.group?.memberPostRequiresApproval === false) {
      throw new CommunityError(403, 'This group does not require post review. Use publish directly.');
    }
  }
  if (!canModerate && existing.scope !== 'group') {
    const policy = await resolveCommunityPolicy(tenantId);
    if (policy.policy.allowMemberPost === false) throw new CommunityError(403, 'Community does not allow member posts');
    if (policy.policy.memberPostRequiresApproval === false) {
      throw new CommunityError(403, 'Member posts do not require review under the active Community policy.');
    }
  }

  await strapi.db.query(COMMUNITY_POST_UID).update({
    where: { id: existing.id },
    data: {
      status: 'pending',
      publishedAt: null,
    },
  });

  const detail = await strapi.db.query(COMMUNITY_POST_UID).findOne({
    where: { id: existing.id },
    populate: {
      author: { select: ['id', 'username', 'email', 'fullName'] },
      group: { populate: { linkedClub: true, avatar: true, coverImage: true } },
      media: true,
    },
  });
  return mapPost(detail);
}

export async function withdrawCommunityPost(postId: unknown, tenantId: number | string, authUserId: number, permissionKeys: Set<string>) {
  const actor = await resolveCommunityActor({ tenantId, authUserId, permissionKeys });
  const existing = await strapi.db.query(COMMUNITY_POST_UID).findOne({
    where: mergeTenantWhere(whereByParam(postId), tenantId),
    populate: {
      group: { select: ['id'] },
      author: { select: ['id'] },
    },
  });
  if (!existing?.id || existing.isDeleted === true) throw new CommunityError(404, 'Community post not found');

  const isOwner = Number(existing.author?.id || existing.author || 0) === authUserId;
  const canModerate = await canModeratePost(existing, tenantId, authUserId, permissionKeys);
  if (!canModerate) requireTenantMember(actor);
  if (!isOwner && !canModerate) throw new CommunityError(403, 'Forbidden');
  if (normalizePostStatus(existing.status) !== 'pending') {
    throw new CommunityError(409, 'Only pending posts can be withdrawn');
  }

  await strapi.db.query(COMMUNITY_POST_UID).update({
    where: { id: existing.id },
    data: {
      status: 'draft',
      publishedAt: null,
    },
  });

  const detail = await strapi.db.query(COMMUNITY_POST_UID).findOne({
    where: { id: existing.id },
    populate: {
      author: { select: ['id', 'username', 'email', 'fullName'] },
      group: { populate: { linkedClub: true, avatar: true, coverImage: true } },
      media: true,
    },
  });
  return mapPost(detail);
}

export async function softDeleteCommunityPost(postId: unknown, tenantId: number | string, authUserId: number, permissionKeys: Set<string>) {
  const actor = await resolveCommunityActor({ tenantId, authUserId, permissionKeys });
  const existing = await strapi.db.query(COMMUNITY_POST_UID).findOne({
    where: mergeTenantWhere(whereByParam(postId), tenantId),
    populate: {
      group: { select: ['id'] },
      author: { select: ['id'] },
    },
  });
  if (!existing?.id || existing.isDeleted === true) throw new CommunityError(404, 'Community post not found');

  const isOwner = Number(existing.author?.id || existing.author || 0) === authUserId;
  const canModerate = await canModeratePost(existing, tenantId, authUserId, permissionKeys);
  if (!canModerate) requireTenantMember(actor);
  if (!isOwner && !canModerate) throw new CommunityError(403, 'Forbidden');

  await strapi.db.query(COMMUNITY_POST_UID).update({
    where: { id: existing.id },
    data: {
      isDeleted: true,
      deletedAt: new Date().toISOString(),
      deletedBy: authUserId,
    },
  });
}

function buildFeedSortOptions(policy: { showPinned: boolean; showFeatured: boolean }, query: Record<string, unknown>) {
  const sortList: Array<Record<string, 'asc' | 'desc'>> = [];
  if (query.mine !== true) {
    if (policy.showPinned) sortList.push({ isPinned: 'desc' });
    if (policy.showFeatured) sortList.push({ isFeatured: 'desc' });
  }
  sortList.push({ publishedAt: 'desc' });
  sortList.push({ id: 'desc' });
  return sortList;
}

export async function listCommunityFeed(params: {
  tenantId: number | string;
  query: Record<string, unknown>;
  authUserId?: number | null;
  permissionKeys?: Set<string>;
}) {
  const query = params.query || {};
  const authUserId = params.authUserId || null;
  const permissionKeys = params.permissionKeys || new Set<string>();
  const actor = await resolveCommunityActor({ tenantId: params.tenantId, authUserId, permissionKeys });
  const isAdmin = hasCommunityAdminPermission(permissionKeys);
  const policy = await resolveCommunityPolicy(params.tenantId);
  const page = parseOptionalPositiveInt((query.pagination as any)?.page) || parseOptionalPositiveInt(query.page) || 1;
  const pageSize = parseOptionalPositiveInt((query.pagination as any)?.pageSize) || parseOptionalPositiveInt(query.pageSize) || policy.feed.pageSize;
  const scope = toText(query.scope).toLowerCase();
  const mine = toBoolean(query.mine, false);
  const featuredOnly = toBoolean(query.featured, false);
  const pinnedOnly = toBoolean(query.pinned, false);

  const whereClauses: Record<string, unknown>[] = [{ isDeleted: { $ne: true } }];
  if (featuredOnly) whereClauses.push({ isFeatured: true });
  if (pinnedOnly) whereClauses.push({ isPinned: true });

  if (mine) {
    if (!authUserId) throw new CommunityError(401, 'Authentication is required');
    requireTenantMember(actor);
    whereClauses.push({ author: authUserId });
    if (POST_SCOPE_VALUES.has(scope)) {
      whereClauses.push({ scope });
    }
  } else {
    whereClauses.push({ status: 'published' });

    if (scope === 'public') {
      whereClauses.push({ scope: 'public' });
    } else if (scope === 'community') {
      if (!actor.tenantMember && !isAdmin) {
        whereClauses.push({ id: { $eq: 0 } });
      } else {
        whereClauses.push({ scope: 'community' });
      }
    } else if (scope === 'group') {
      const groupId = parseOptionalPositiveInt(query.groupId);
      if (!groupId) throw new CommunityError(400, 'groupId is required for scope=group');
      const group = await findGroupOrThrow(groupId, params.tenantId);
      const canView = await canViewGroupFeed(group, params.tenantId, authUserId, permissionKeys);
      if (!canView) throw new CommunityError(403, 'Forbidden');
      whereClauses.push({ scope: 'group', group: group.id });
    } else if (actor.tenantMember && !isAdmin) {
      const memberGroupIds = await getMyMemberGroupIds(authUserId, params.tenantId);
      if (memberGroupIds.length > 0) {
        whereClauses.push({
          $or: [
            { scope: 'public' },
            { scope: 'community' },
            { scope: 'group', group: { id: { $in: memberGroupIds } } },
          ],
        });
      } else {
        whereClauses.push({
          scope: {
            $in: ['public', 'community'],
          },
        });
      }
    } else if (isAdmin) {
      whereClauses.push({
        scope: {
          $in: ['public', 'community', 'group'],
        },
      });
    } else {
      whereClauses.push({ scope: 'public' });
    }
  }

  const where = mergeTenantWhere(
    whereClauses.length === 1 ? whereClauses[0] : { $and: whereClauses },
    params.tenantId,
  );
  const offset = (page - 1) * pageSize;
  const [rows, total] = await Promise.all([
    strapi.db.query(COMMUNITY_POST_UID).findMany({
      where,
      orderBy: buildFeedSortOptions(policy.feed, { mine }),
      offset,
      limit: pageSize,
      populate: {
        author: { select: ['id', 'username', 'email', 'fullName'] },
        group: {
          populate: {
            linkedClub: { select: ['id', 'code', 'name', 'status'] },
            avatar: true,
            coverImage: true,
          },
        },
        media: true,
      },
    }),
    strapi.db.query(COMMUNITY_POST_UID).count({ where }),
  ]);

  const mappedRows = (rows || []).map(mapPost).filter(Boolean);
  const enrichedRows = await enrichPostsWithInteractions(mappedRows as any[], params.tenantId, authUserId || null);

  return {
    rows: enrichedRows,
    pagination: {
      page,
      pageSize,
      pageCount: Math.max(1, Math.ceil(total / pageSize)),
      total,
    },
    policy: {
      showPinned: policy.feed.showPinned,
      showFeatured: policy.feed.showFeatured,
    },
    actor,
  };
}

export async function listMyPosts(tenantId: number | string, authUserId: number, query: Record<string, unknown>) {
  const actor = await resolveCommunityActor({ tenantId, authUserId });
  requireTenantMember(actor);
  return await listCommunityFeed({
    tenantId,
    authUserId,
    permissionKeys: await getTenantPermissionKeys(authUserId, tenantId),
    query: {
      ...query,
      mine: true,
    },
  });
}

export async function getCommunityPostingContext(tenantId: number | string, authUserId: number | null, permissionKeys: Set<string>) {
  const actor = await resolveCommunityActor({ tenantId, authUserId, permissionKeys });
  const [myGroups, policy] = await Promise.all([
    actor.tenantMember && authUserId ? getMyCommunityGroups(tenantId, authUserId) : Promise.resolve([]),
    resolveCommunityPolicy(tenantId),
  ]);
  const canAdmin = hasCommunityAdminPermission(permissionKeys);
  return {
    activeConfigId: policy.activeConfig?.id || null,
    policyConfig: policy.policy,
    defaultAllowComment: policy.policy.defaultAllowComment,
    myGroups,
    canAdmin,
    actor,
  };
}

export async function listPendingCommunityPosts(tenantId: number | string, authUserId: number, permissionKeys: Set<string>) {
  const isAdmin = hasCommunityAdminPermission(permissionKeys);
  let where: Record<string, unknown> = { status: 'pending', isDeleted: { $ne: true } };
  if (!isAdmin) {
    const moderationGroupIds = await getMyModerationGroupIds(authUserId, tenantId);
    if (moderationGroupIds.length === 0) return [];
    where = {
      ...where,
      scope: 'group',
      group: {
        id: {
          $in: moderationGroupIds,
        },
      },
    };
  }

  const rows = await strapi.db.query(COMMUNITY_POST_UID).findMany({
    where: mergeTenantWhere(where, tenantId),
    orderBy: [{ createdAt: 'asc' }],
    populate: {
      author: { select: ['id', 'username', 'email', 'fullName'] },
      group: { populate: { linkedClub: true, avatar: true, coverImage: true } },
      media: true,
    },
  });
  return (rows || []).map(mapPost).filter(Boolean);
}

async function updatePostModeration(postId: unknown, tenantId: number | string, authUserId: number, permissionKeys: Set<string>, data: Record<string, unknown>) {
  const post = await strapi.db.query(COMMUNITY_POST_UID).findOne({
    where: mergeTenantWhere(whereByParam(postId), tenantId),
    populate: {
      group: { select: ['id', 'memberPostRequiresApproval'] },
      author: { select: ['id'] },
    },
  });
  if (!post?.id || post.isDeleted === true) throw new CommunityError(404, 'Community post not found');

  const canModerate = await canModeratePost(post, tenantId, authUserId, permissionKeys);
  const isOwner = Number(post.author?.id || post.author || 0) === authUserId;
  if (data.status === 'published' && !canModerate && !isOwner) {
    throw new CommunityError(403, 'Forbidden');
  }
  if (data.status === 'published' && !canModerate && isOwner) {
    const canDirectPublish = await canMemberDirectPublishPost(post, tenantId, authUserId, permissionKeys);
    if (!canDirectPublish) {
      throw new CommunityError(403, 'Member posts require approval before publication.');
    }
  }
  if (!canModerate && !isOwner && data.status !== 'published') {
    throw new CommunityError(403, 'Forbidden');
  }

  await strapi.db.query(COMMUNITY_POST_UID).update({
    where: { id: post.id },
    data,
  });

  const detail = await strapi.db.query(COMMUNITY_POST_UID).findOne({
    where: { id: post.id },
    populate: {
      author: { select: ['id', 'username', 'email', 'fullName'] },
      group: { populate: { linkedClub: true, avatar: true, coverImage: true } },
      media: true,
    },
  });
  return mapPost(detail);
}

export async function publishCommunityPost(postId: unknown, tenantId: number | string, authUserId: number, permissionKeys: Set<string>) {
  const detail = await updatePostModeration(postId, tenantId, authUserId, permissionKeys, {
    status: 'published',
    publishedAt: new Date().toISOString(),
  });
  if (detail?.id && detail?.author?.id && detail?.publishedAt) {
    try {
      await dispatchTrustedGameActivity({
        tenantId,
        userId: detail.author.id,
        activityCode: 'community_post',
        sourceType: 'community_post',
        sourceId: String(detail.id),
        occurredAt: detail.publishedAt,
        metadata: {
          internalTrusted: true,
          occurredAtTrusted: true,
          isEligible: true,
          communityPostId: detail.id,
        },
      });
    } catch (error) {
      strapi.log.error('[community.publishCommunityPost] failed to dispatch XP event', error);
    }
  }
  return detail;
}

export async function hideCommunityPost(postId: unknown, tenantId: number | string, authUserId: number, permissionKeys: Set<string>) {
  return await updatePostModeration(postId, tenantId, authUserId, permissionKeys, {
    status: 'hidden',
  });
}

export async function rejectCommunityPost(postId: unknown, tenantId: number | string, authUserId: number, permissionKeys: Set<string>) {
  return await updatePostModeration(postId, tenantId, authUserId, permissionKeys, {
    status: 'rejected',
    publishedAt: null,
  });
}

export async function pinCommunityPost(postId: unknown, tenantId: number | string, authUserId: number, permissionKeys: Set<string>, pinned: boolean) {
  return await updatePostModeration(postId, tenantId, authUserId, permissionKeys, {
    isPinned: pinned,
  });
}

export async function featureCommunityPost(postId: unknown, tenantId: number | string, authUserId: number, permissionKeys: Set<string>, featured: boolean) {
  return await updatePostModeration(postId, tenantId, authUserId, permissionKeys, {
    isFeatured: featured,
  });
}

async function normalizeCommentWritePayload(payload: Record<string, unknown>) {
  const content = toText(payload.content);
  if (!content) throw new CommunityError(400, 'content is required');
  const parentCommentId = parseOptionalPositiveInt(payload.parentCommentId);
  const media = await normalizePostImageMediaIds(payload.media);
  return {
    content,
    parentCommentId,
    media,
  };
}

async function canModerateComment(comment: any, tenantId: number | string, authUserId: number, permissionKeys: Set<string>) {
  if (hasCommunityAdminPermission(permissionKeys)) return true;
  const post = await findPostOrThrow(comment.post?.id || comment.post, tenantId);
  return await canModeratePost(post, tenantId, authUserId, permissionKeys);
}

export async function listCommunityComments(params: {
  postId: unknown;
  tenantId: number | string;
  authUserId?: number | null;
  permissionKeys?: Set<string>;
  query?: Record<string, unknown>;
}) {
  const query = params.query || {};
  const authUserId = params.authUserId || null;
  const permissionKeys = params.permissionKeys || new Set<string>();
  const post = await findPostOrThrow(params.postId, params.tenantId);
  const canView = await canViewCommunityPost(post, params.tenantId, authUserId, permissionKeys);
  if (!canView) throw new CommunityError(403, 'Forbidden');
  const canModerateCurrentPost = authUserId
    ? await canModeratePost(post, params.tenantId, authUserId, permissionKeys)
    : false;

  const page = parseOptionalPositiveInt((query.pagination as any)?.page) || parseOptionalPositiveInt(query.page) || 1;
  const pageSize = parseOptionalPositiveInt((query.pagination as any)?.pageSize) || parseOptionalPositiveInt(query.pageSize) || 10;
  const offset = (page - 1) * pageSize;

  const topLevelWhere = mergeTenantWhere({
    post: post.id,
    status: 'active',
    parentComment: null,
  }, params.tenantId);

  const [topRows, total] = await Promise.all([
    strapi.db.query(COMMUNITY_COMMENT_UID).findMany({
      where: topLevelWhere,
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      offset,
      limit: pageSize,
      populate: {
        author: { select: ['id', 'username', 'email', 'fullName'] },
        post: { select: ['id'] },
        media: true,
      },
    }),
    strapi.db.query(COMMUNITY_COMMENT_UID).count({ where: topLevelWhere }),
  ]);

  const topIds = (topRows || []).map((row: any) => Number(row.id)).filter((id: number) => Number.isInteger(id) && id > 0);
  const replyRows = topIds.length > 0
    ? await strapi.db.query(COMMUNITY_COMMENT_UID).findMany({
      where: mergeTenantWhere({
        post: post.id,
        status: 'active',
        parentComment: { id: { $in: topIds } },
      }, params.tenantId),
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      populate: {
        author: { select: ['id', 'username', 'email', 'fullName'] },
        post: { select: ['id'] },
        parentComment: { select: ['id'] },
        media: true,
      },
    })
    : [];

  const replyByParentId = new Map<number, any[]>();
  for (const row of replyRows || []) {
    const parentId = Number(row?.parentComment?.id || row?.parentComment || 0);
    if (!parentId) continue;
    const list = replyByParentId.get(parentId) || [];
    list.push(row);
    replyByParentId.set(parentId, list);
  }

  const mappedTop = (topRows || []).map((row: any) => {
    const mapped = mapComment(row);
    if (!mapped) return null;
    const replies = (replyByParentId.get(mapped.id) || []).map(mapComment).filter(Boolean);
    const canEdit = Boolean(authUserId && mapped.author?.id === authUserId && mapped.status === 'active');
    return {
      ...mapped,
      canEdit,
      canDelete: canEdit,
      canModerate: canModerateCurrentPost,
      replies: replies.map((reply: any) => ({
        ...reply,
        canEdit: Boolean(authUserId && reply.author?.id === authUserId && reply.status === 'active'),
        canDelete: Boolean(authUserId && reply.author?.id === authUserId && reply.status === 'active'),
        canModerate: canModerateCurrentPost,
      })),
    };
  }).filter(Boolean);

  return {
    rows: mappedTop,
    pagination: {
      page,
      pageSize,
      pageCount: Math.max(1, Math.ceil(total / pageSize)),
      total,
    },
  };
}

export async function createCommunityComment(postId: unknown, payload: Record<string, unknown>, tenantId: number | string, authUserId: number, permissionKeys: Set<string>) {
  const actor = await resolveCommunityActor({ tenantId, authUserId, permissionKeys });
  requireTenantMember(actor);
  const post = await findPostOrThrow(postId, tenantId);
  const canView = await canViewCommunityPost(post, tenantId, authUserId, permissionKeys);
  if (!canView) throw new CommunityError(403, 'Forbidden');
  if (normalizePostStatus(post.status) !== 'published') throw new CommunityError(409, 'Only published posts can be commented');
  if (post.allowComment === false) throw new CommunityError(403, 'Comment is disabled for this post');

  const normalized = await normalizeCommentWritePayload(payload);
  let parentCommentId: number | null = null;
  if (normalized.parentCommentId) {
    const parent = await strapi.db.query(COMMUNITY_COMMENT_UID).findOne({
      where: mergeTenantWhere({ id: normalized.parentCommentId, post: post.id }, tenantId),
      populate: {
        parentComment: { select: ['id'] },
      },
    });
    if (!parent?.id) throw new CommunityError(400, 'parentComment is invalid');
    if (parent.parentComment?.id || parent.parentComment) throw new CommunityError(400, 'Reply depth exceeds 1 level');
    if (normalizeCommentStatus(parent.status) !== 'active') throw new CommunityError(400, 'parentComment is not active');
    parentCommentId = Number(parent.id);
  }

  const created = await strapi.db.query(COMMUNITY_COMMENT_UID).create({
    data: {
      tenant: tenantId,
      post: post.id,
      author: authUserId,
      parentComment: parentCommentId,
      content: normalized.content,
      media: normalized.media,
      status: 'active',
    },
  });

  const detail = await strapi.db.query(COMMUNITY_COMMENT_UID).findOne({
    where: { id: created.id },
    populate: {
      author: { select: ['id', 'username', 'email', 'fullName'] },
      post: { select: ['id'] },
      parentComment: { select: ['id'] },
      media: true,
    },
  });
  const mapped = mapComment(detail);
  if (mapped?.id && mapped?.author?.id && mapped?.status === 'active') {
    try {
      await dispatchTrustedGameActivity({
        tenantId,
        userId: mapped.author.id,
        activityCode: 'community_comment',
        sourceType: 'community_comment',
        sourceId: String(mapped.id),
        occurredAt: mapped.createdAt || new Date().toISOString(),
        metadata: {
          internalTrusted: true,
          occurredAtTrusted: true,
          isEligible: true,
          communityCommentId: mapped.id,
          postId: post.id,
        },
      });
    } catch (error) {
      strapi.log.error('[community.createCommunityComment] failed to dispatch XP event', error);
    }
  }
  return mapped;
}

export async function updateCommunityComment(commentId: unknown, payload: Record<string, unknown>, tenantId: number | string, authUserId: number, permissionKeys: Set<string>) {
  const actor = await resolveCommunityActor({ tenantId, authUserId, permissionKeys });
  const comment = await strapi.db.query(COMMUNITY_COMMENT_UID).findOne({
    where: mergeTenantWhere(whereByParam(commentId), tenantId),
    populate: {
      post: { select: ['id'] },
      author: { select: ['id'] },
      parentComment: { select: ['id'] },
      media: true,
    },
  });
  if (!comment?.id) throw new CommunityError(404, 'Comment not found');
  if (normalizeCommentStatus(comment.status) !== 'active') throw new CommunityError(409, 'Comment cannot be edited');
  const isOwner = Number(comment.author?.id || comment.author || 0) === authUserId;
  requireTenantMember(actor);
  if (!isOwner) throw new CommunityError(403, 'Forbidden');

  const mergedPayload = {
    content: hasOwnProperty(payload, 'content') ? payload.content : comment.content,
    media: hasOwnProperty(payload, 'media')
      ? payload.media
      : (Array.isArray(comment.media) ? comment.media.map((item: any) => Number(item?.id || item)).filter(Boolean) : []),
  };
  const normalized = await normalizeCommentWritePayload(mergedPayload);

  await strapi.db.query(COMMUNITY_COMMENT_UID).update({
    where: { id: comment.id },
    data: {
      content: normalized.content,
      media: normalized.media,
    },
  });

  const detail = await strapi.db.query(COMMUNITY_COMMENT_UID).findOne({
    where: { id: comment.id },
    populate: {
      author: { select: ['id', 'username', 'email', 'fullName'] },
      post: { select: ['id'] },
      parentComment: { select: ['id'] },
      media: true,
    },
  });
  return mapComment(detail);
}

export async function deleteCommunityComment(commentId: unknown, tenantId: number | string, authUserId: number, permissionKeys: Set<string>) {
  const actor = await resolveCommunityActor({ tenantId, authUserId, permissionKeys });
  const comment = await strapi.db.query(COMMUNITY_COMMENT_UID).findOne({
    where: mergeTenantWhere(whereByParam(commentId), tenantId),
    populate: {
      post: { select: ['id'] },
      author: { select: ['id'] },
    },
  });
  if (!comment?.id) throw new CommunityError(404, 'Comment not found');
  const isOwner = Number(comment.author?.id || comment.author || 0) === authUserId;
  const canModerate = await canModerateComment(comment, tenantId, authUserId, permissionKeys);
  if (!canModerate) requireTenantMember(actor);
  if (!isOwner && !canModerate) throw new CommunityError(403, 'Forbidden');

  await strapi.db.query(COMMUNITY_COMMENT_UID).update({
    where: { id: comment.id },
    data: {
      status: 'deleted',
      content: '',
    },
  });
}

export async function hideCommunityComment(commentId: unknown, tenantId: number | string, authUserId: number, permissionKeys: Set<string>) {
  const actor = await resolveCommunityActor({ tenantId, authUserId, permissionKeys });
  const comment = await strapi.db.query(COMMUNITY_COMMENT_UID).findOne({
    where: mergeTenantWhere(whereByParam(commentId), tenantId),
    populate: {
      post: { select: ['id'] },
      author: { select: ['id'] },
    },
  });
  if (!comment?.id) throw new CommunityError(404, 'Comment not found');
  const canModerate = await canModerateComment(comment, tenantId, authUserId, permissionKeys);
  if (!canModerate) requireTenantMember(actor);
  if (!canModerate) throw new CommunityError(403, 'Forbidden');

  await strapi.db.query(COMMUNITY_COMMENT_UID).update({
    where: { id: comment.id },
    data: {
      status: 'hidden',
    },
  });
}

async function buildPostInteractionState(postId: number, tenantId: number | string, authUserId: number | null) {
  const [comments, reactions] = await Promise.all([
    strapi.db.query(COMMUNITY_COMMENT_UID).count({
      where: mergeTenantWhere({
        post: postId,
        status: 'active',
      }, tenantId),
    }),
    strapi.db.query(COMMUNITY_REACTION_UID).findMany({
      where: mergeTenantWhere({
        post: postId,
      }, tenantId),
      select: ['id', 'type'],
      populate: {
        user: { select: ['id'] },
      },
    }),
  ]);

  const summary = { like: 0, love: 0, support: 0 };
  let myReaction: 'like' | 'love' | 'support' | null = null;
  for (const reaction of reactions || []) {
    const type = normalizeReactionType((reaction as any).type);
    summary[type] += 1;
    if (authUserId && Number((reaction as any)?.user?.id || (reaction as any)?.user || 0) === authUserId) {
      myReaction = type;
    }
  }

  return {
    commentCount: Number(comments || 0),
    reactionCount: Number(summary.like + summary.love + summary.support),
    reactionSummary: summary,
    myReaction,
  };
}

export async function listCommunityReactions(params: {
  postId: unknown;
  tenantId: number | string;
  authUserId?: number | null;
  permissionKeys?: Set<string>;
  query?: Record<string, unknown>;
}) {
  const query = params.query || {};
  const authUserId = params.authUserId || null;
  const permissionKeys = params.permissionKeys || new Set<string>();

  const post = await findPostOrThrow(params.postId, params.tenantId);
  const canView = await canViewCommunityPost(post, params.tenantId, authUserId, permissionKeys);
  if (!canView) throw new CommunityError(403, 'Forbidden');

  const reactionType = normalizeReactionFilter(query.type);
  const page = parseOptionalPositiveInt((query.pagination as any)?.page) || parseOptionalPositiveInt(query.page) || 1;
  const requestedPageSize = parseOptionalPositiveInt((query.pagination as any)?.pageSize) || parseOptionalPositiveInt(query.pageSize) || 20;
  const pageSize = Math.max(1, Math.min(requestedPageSize, 100));
  const offset = (page - 1) * pageSize;

  const whereBase = mergeTenantWhere(
    {
      post: post.id,
      ...(reactionType !== 'all' ? { type: reactionType } : {}),
    },
    params.tenantId,
  );

  const summaryWhereBase = mergeTenantWhere(
    {
      post: post.id,
    },
    params.tenantId,
  );

  const [rows, total, likeCount, loveCount, supportCount, myReactionRow] = await Promise.all([
    strapi.db.query(COMMUNITY_REACTION_UID).findMany({
      where: whereBase,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      offset,
      limit: pageSize,
      select: ['id', 'type', 'createdAt'],
      populate: {
        user: { select: ['id', 'username', 'fullName'] },
      },
    }),
    strapi.db.query(COMMUNITY_REACTION_UID).count({ where: whereBase }),
    strapi.db.query(COMMUNITY_REACTION_UID).count({ where: { ...summaryWhereBase, type: 'like' } }),
    strapi.db.query(COMMUNITY_REACTION_UID).count({ where: { ...summaryWhereBase, type: 'love' } }),
    strapi.db.query(COMMUNITY_REACTION_UID).count({ where: { ...summaryWhereBase, type: 'support' } }),
    authUserId
      ? strapi.db.query(COMMUNITY_REACTION_UID).findOne({
        where: mergeTenantWhere({
          post: post.id,
          user: authUserId,
        }, params.tenantId),
        select: ['id', 'type'],
      })
      : Promise.resolve(null),
  ]);

  const summary = {
    like: Number(likeCount || 0),
    love: Number(loveCount || 0),
    support: Number(supportCount || 0),
  };

  const mappedRows = (rows || []).map((reaction: any) => ({
    id: Number(reaction?.id || 0) || null,
    type: normalizeReactionType(reaction?.type),
    createdAt: reaction?.createdAt || null,
    user: mapPublicCommunityUser(reaction?.user),
  })).filter((reaction: any) => reaction.id && reaction.user);

  return {
    rows: mappedRows,
    pagination: {
      page,
      pageSize,
      pageCount: Math.max(1, Math.ceil(total / pageSize)),
      total: Number(total || 0),
    },
    summary,
    reactionCount: Number(summary.like + summary.love + summary.support),
    myReaction: myReactionRow?.type ? normalizeReactionType(myReactionRow.type) : null,
  };
}

export async function setCommunityReaction(postId: unknown, payload: Record<string, unknown>, tenantId: number | string, authUserId: number, permissionKeys: Set<string>) {
  const actor = await resolveCommunityActor({ tenantId, authUserId, permissionKeys });
  requireTenantMember(actor);
  const post = await findPostOrThrow(postId, tenantId);
  const canView = await canViewCommunityPost(post, tenantId, authUserId, permissionKeys);
  if (!canView) throw new CommunityError(403, 'Forbidden');
  if (normalizePostStatus(post.status) !== 'published') throw new CommunityError(409, 'Only published posts can be reacted');

  const policy = await resolveCommunityPolicy(tenantId);
  if (policy.policy.allowReaction === false) throw new CommunityError(403, 'Reaction is disabled');

  const type = normalizeReactionType(payload.type);
  const existing = await strapi.db.query(COMMUNITY_REACTION_UID).findOne({
    where: mergeTenantWhere({
      post: post.id,
      user: authUserId,
    }, tenantId),
    select: ['id', 'type'],
  });

  if (existing?.id && normalizeReactionType(existing.type) === type) {
    await strapi.db.query(COMMUNITY_REACTION_UID).delete({
      where: { id: existing.id },
    });
  } else if (existing?.id) {
    await strapi.db.query(COMMUNITY_REACTION_UID).update({
      where: { id: existing.id },
      data: { type },
    });
  } else {
    await strapi.db.query(COMMUNITY_REACTION_UID).create({
      data: {
        tenant: tenantId,
        post: post.id,
        user: authUserId,
        type,
      },
    });
  }

  return await buildPostInteractionState(Number(post.id), tenantId, authUserId);
}

export async function removeCommunityReaction(postId: unknown, tenantId: number | string, authUserId: number, permissionKeys: Set<string>) {
  const actor = await resolveCommunityActor({ tenantId, authUserId, permissionKeys });
  requireTenantMember(actor);
  const post = await findPostOrThrow(postId, tenantId);
  const canView = await canViewCommunityPost(post, tenantId, authUserId, permissionKeys);
  if (!canView) throw new CommunityError(403, 'Forbidden');

  const existing = await strapi.db.query(COMMUNITY_REACTION_UID).findOne({
    where: mergeTenantWhere({
      post: post.id,
      user: authUserId,
    }, tenantId),
    select: ['id'],
  });
  if (existing?.id) {
    await strapi.db.query(COMMUNITY_REACTION_UID).delete({
      where: { id: existing.id },
    });
  }

  return await buildPostInteractionState(Number(post.id), tenantId, authUserId);
}

export async function buildPermissionKeysForActor(authUserId: number | null, tenantId: number | string) {
  if (!authUserId) return new Set<string>();
  return await getTenantPermissionKeys(authUserId, tenantId);
}

function parseDateBoundary(value: unknown, mode: 'start' | 'end'): string | null {
  const raw = toText(value);
  if (!raw) return null;

  const normalized = /^\d{4}-\d{2}-\d{2}$/.test(raw)
    ? `${raw}${mode === 'start' ? 'T00:00:00.000Z' : 'T23:59:59.999Z'}`
    : raw;
  const timestamp = Date.parse(normalized);
  if (Number.isNaN(timestamp)) {
    throw new CommunityError(400, `Invalid ${mode === 'start' ? 'dateFrom' : 'dateTo'}`);
  }

  return new Date(timestamp).toISOString();
}

async function ensureManagePostAccess(params: { tenantId: number | string; authUserId: number; permissionKeys: Set<string> }) {
  const isAdmin = hasCommunityAdminPermission(params.permissionKeys);
  if (isAdmin) {
    return { isAdmin: true, moderationGroupIds: [] as number[] };
  }

  const moderationGroupIds = await getMyModerationGroupIds(params.authUserId, params.tenantId);
  if (moderationGroupIds.length === 0) {
    throw new CommunityError(403, 'Forbidden');
  }

  return { isAdmin: false, moderationGroupIds };
}

export async function listManageCommunityPosts(params: {
  tenantId: number | string;
  authUserId: number;
  permissionKeys: Set<string>;
  query: Record<string, unknown>;
}) {
  const query = params.query || {};
  const { isAdmin, moderationGroupIds } = await ensureManagePostAccess({
    tenantId: params.tenantId,
    authUserId: params.authUserId,
    permissionKeys: params.permissionKeys,
  });

  const page = parseOptionalPositiveInt((query.pagination as any)?.page) || parseOptionalPositiveInt(query.page) || 1;
  const pageSize = parseOptionalPositiveInt((query.pagination as any)?.pageSize) || parseOptionalPositiveInt(query.pageSize) || 20;
  const status = toText(query.status).toLowerCase();
  const scope = toText(query.scope).toLowerCase();
  const q = toText(query.q);
  const author = toText(query.author);
  const authorId = parseOptionalPositiveInt(query.authorId);
  const groupId = parseOptionalPositiveInt(query.groupId);
  const pinned = toBoolean(query.pinned, false);
  const featured = toBoolean(query.featured, false);
  const dateFrom = parseDateBoundary(query.dateFrom, 'start');
  const dateTo = parseDateBoundary(query.dateTo, 'end');

  if (groupId) {
    await findGroupOrThrow(groupId, params.tenantId);
    if (!isAdmin && !moderationGroupIds.includes(groupId)) {
      throw new CommunityError(403, 'Forbidden');
    }
  }

  const whereClauses: Record<string, unknown>[] = [{ isDeleted: { $ne: true } }];
  if (POST_STATUS_VALUES.has(status)) whereClauses.push({ status });
  if (POST_SCOPE_VALUES.has(scope)) whereClauses.push({ scope });
  if (groupId) whereClauses.push({ group: groupId });
  if (authorId) whereClauses.push({ author: authorId });
  if (pinned) whereClauses.push({ isPinned: true });
  if (featured) whereClauses.push({ isFeatured: true });

  if (dateFrom || dateTo) {
    const createdAt: Record<string, string> = {};
    if (dateFrom) createdAt.$gte = dateFrom;
    if (dateTo) createdAt.$lte = dateTo;
    whereClauses.push({ createdAt });
  }

  if (q) {
    whereClauses.push({
      $or: [
        { title: { $containsi: q } },
        { content: { $containsi: q } },
        { author: { fullName: { $containsi: q } } },
        { author: { username: { $containsi: q } } },
        { author: { email: { $containsi: q } } },
      ],
    });
  }

  if (author) {
    whereClauses.push({
      $or: [
        { author: { fullName: { $containsi: author } } },
        { author: { username: { $containsi: author } } },
        { author: { email: { $containsi: author } } },
      ],
    });
  }

  if (!isAdmin) {
    whereClauses.push({
      scope: 'group',
      group: { id: { $in: moderationGroupIds } },
    });
  }

  const where = mergeTenantWhere(whereClauses.length === 1 ? whereClauses[0] : { $and: whereClauses }, params.tenantId);
  const offset = (page - 1) * pageSize;

  const [rows, total] = await Promise.all([
    strapi.db.query(COMMUNITY_POST_UID).findMany({
      where,
      orderBy: [{ status: 'asc' }, { isPinned: 'desc' }, { isFeatured: 'desc' }, { createdAt: 'desc' }, { id: 'desc' }],
      offset,
      limit: pageSize,
      populate: {
        author: { select: ['id', 'username', 'email', 'fullName'] },
        group: { populate: { linkedClub: { select: ['id', 'code', 'name', 'status'] }, avatar: true, coverImage: true } },
        media: true,
      },
    }),
    strapi.db.query(COMMUNITY_POST_UID).count({ where }),
  ]);

  const mappedRows = (rows || []).map(mapPost).filter(Boolean);
  const enrichedRows = await enrichPostsWithInteractions(mappedRows as any[], params.tenantId, params.authUserId || null);

  return {
    rows: enrichedRows,
    pagination: {
      page,
      pageSize,
      pageCount: Math.max(1, Math.ceil(total / pageSize)),
      total,
    },
  };
}

export async function getManageCommunityPostDetail(postId: unknown, tenantId: number | string, authUserId: number, permissionKeys: Set<string>) {
  await ensureManagePostAccess({ tenantId, authUserId, permissionKeys });

  const post = await strapi.db.query(COMMUNITY_POST_UID).findOne({
    where: mergeTenantWhere(whereByParam(postId), tenantId),
    populate: {
      author: { select: ['id', 'username', 'email', 'fullName'] },
      group: { populate: { linkedClub: { select: ['id', 'code', 'name', 'status'] }, avatar: true, coverImage: true } },
      media: true,
    },
  });
  if (!post?.id || post.isDeleted === true) throw new CommunityError(404, 'Community post not found');

  const canModerate = await canModeratePost(post, tenantId, authUserId, permissionKeys);
  if (!canModerate) throw new CommunityError(403, 'Forbidden');

  const mapped = mapPost(post);
  if (!mapped) throw new CommunityError(404, 'Community post not found');
  const [enriched] = await enrichPostsWithInteractions([mapped], tenantId, authUserId);
  return enriched;
}
