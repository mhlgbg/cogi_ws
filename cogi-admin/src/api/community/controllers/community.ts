import { resolveCurrentTenantId } from '../../../utils/tenant-scope';
import {
  addCommunityGroupMember,
  archiveCommunityGroup,
  buildPermissionKeysForActor,
  createCommunityComment,
  createCommunityGroup,
  createCommunityPost,
  deleteCommunityComment,
  featureCommunityPost,
  getManageCommunityPostDetail,
  getCommunityGroupDetail,
  getCommunityPostingContext,
  getMyCommunityGroups,
  hideCommunityPost,
  hideCommunityComment,
  listCommunityFeed,
  listCommunityGroupMembers,
  listCommunityGroups,
  listManageCommunityPosts,
  listMyPosts,
  listPendingCommunityPosts,
  pinCommunityPost,
  publishCommunityPost,
  removeCommunityReaction,
  rejectCommunityPost,
  removeCommunityGroupMember,
  softDeleteCommunityPost,
  submitCommunityPostForReview,
  setCommunityReaction,
  listCommunityComments,
  listCommunityReactions,
  updateCommunityGroup,
  updateCommunityGroupMember,
  updateCommunityComment,
  updateCommunityPost,
  withdrawCommunityPost,
} from '../services/community';

type AuthUser = {
  id: number;
  blocked?: boolean | null;
};

async function resolveUserFromJwt(ctx: any): Promise<AuthUser | null> {
  try {
    const authHeader = ctx.request?.headers?.authorization || ctx.request?.header?.authorization || '';
    const token = typeof authHeader === 'string' && authHeader.startsWith('Bearer ')
      ? authHeader.slice(7).trim()
      : '';
    if (!token) return null;

    const jwtService = strapi.plugin('users-permissions')?.service('jwt');
    if (!jwtService) return null;

    const decoded = await jwtService.verify(token);
    const userId = Number(decoded?.id || 0);
    if (!Number.isInteger(userId) || userId <= 0) return null;

    return strapi.db.query('plugin::users-permissions.user').findOne({
      where: { id: userId },
      select: ['id', 'blocked'],
    });
  } catch {
    return null;
  }
}

async function readAuthUser(ctx: any): Promise<AuthUser | null> {
  let authUser = ctx.state?.user as AuthUser | undefined;
  if (!authUser?.id) {
    authUser = (await resolveUserFromJwt(ctx)) || undefined;
    if (authUser?.id) ctx.state.user = authUser;
  }
  if (!authUser?.id || authUser.blocked) return null;
  return authUser;
}

async function requireAuthUser(ctx: any): Promise<AuthUser | null> {
  const authUser = await readAuthUser(ctx);
  if (!authUser?.id) {
    ctx.unauthorized('Unauthorized');
    return null;
  }
  return authUser;
}

function extractPayload(ctx: any): Record<string, unknown> {
  const body = ctx.request?.body;
  if (body?.data && typeof body.data === 'object' && !Array.isArray(body.data)) {
    return body.data as Record<string, unknown>;
  }
  if (body && typeof body === 'object' && !Array.isArray(body)) {
    return body as Record<string, unknown>;
  }
  return {};
}

function handleError(ctx: any, error: any) {
  const status = Number(error?.status || 500);
  const message = typeof error?.message === 'string' && error.message.trim()
    ? error.message.trim()
    : 'Unexpected community error';

  if (status === 400) return ctx.badRequest(message);
  if (status === 401) return ctx.unauthorized(message);
  if (status === 403) return ctx.forbidden(message);
  if (status === 404) return ctx.notFound(message);
  if (status === 409) return ctx.conflict(message);

  strapi.log.error('[community] unexpected error', error);
  return ctx.internalServerError(message);
}

export default {
  async listGroups(ctx: any) {
    const authUser = await readAuthUser(ctx);
    try {
      const tenantId = resolveCurrentTenantId(ctx);
      const permissionKeys = await buildPermissionKeysForActor(authUser?.id || null, tenantId);
      const data = await listCommunityGroups({
        tenantId,
        query: ctx.query || {},
        authUserId: authUser?.id || null,
        permissionKeys,
      });
      ctx.body = { success: true, data: data.rows, meta: { pagination: data.pagination } };
    } catch (error: any) {
      return handleError(ctx, error);
    }
  },

  async groupDetail(ctx: any) {
    const authUser = await readAuthUser(ctx);
    try {
      const tenantId = resolveCurrentTenantId(ctx);
      const permissionKeys = await buildPermissionKeysForActor(authUser?.id || null, tenantId);
      const detail = await getCommunityGroupDetail(ctx.params?.id, tenantId, authUser?.id || null, permissionKeys);
      ctx.body = { success: true, data: detail };
    } catch (error: any) {
      return handleError(ctx, error);
    }
  },

  async createGroup(ctx: any) {
    const authUser = await requireAuthUser(ctx);
    if (!authUser?.id) return;
    try {
      const tenantId = resolveCurrentTenantId(ctx);
      const data = await createCommunityGroup(extractPayload(ctx), tenantId, authUser.id);
      ctx.body = { success: true, data };
    } catch (error: any) {
      return handleError(ctx, error);
    }
  },

  async updateGroup(ctx: any) {
    const authUser = await requireAuthUser(ctx);
    if (!authUser?.id) return;
    try {
      const tenantId = resolveCurrentTenantId(ctx);
      const data = await updateCommunityGroup(ctx.params?.id, extractPayload(ctx), tenantId);
      ctx.body = { success: true, data };
    } catch (error: any) {
      return handleError(ctx, error);
    }
  },

  async archiveGroup(ctx: any) {
    const authUser = await requireAuthUser(ctx);
    if (!authUser?.id) return;
    try {
      const tenantId = resolveCurrentTenantId(ctx);
      const data = await archiveCommunityGroup(ctx.params?.id, tenantId);
      ctx.body = { success: true, data };
    } catch (error: any) {
      return handleError(ctx, error);
    }
  },

  async listGroupMembers(ctx: any) {
    const authUser = await requireAuthUser(ctx);
    if (!authUser?.id) return;
    try {
      const tenantId = resolveCurrentTenantId(ctx);
      const permissionKeys = await buildPermissionKeysForActor(authUser.id, tenantId);
      const data = await listCommunityGroupMembers(ctx.params?.id, tenantId, authUser.id, permissionKeys);
      ctx.body = { success: true, data };
    } catch (error: any) {
      return handleError(ctx, error);
    }
  },

  async addGroupMember(ctx: any) {
    const authUser = await requireAuthUser(ctx);
    if (!authUser?.id) return;
    try {
      const tenantId = resolveCurrentTenantId(ctx);
      const permissionKeys = await buildPermissionKeysForActor(authUser.id, tenantId);
      const data = await addCommunityGroupMember(ctx.params?.id, extractPayload(ctx), tenantId, authUser.id, permissionKeys);
      ctx.body = { success: true, data };
    } catch (error: any) {
      return handleError(ctx, error);
    }
  },

  async updateGroupMember(ctx: any) {
    const authUser = await requireAuthUser(ctx);
    if (!authUser?.id) return;
    try {
      const tenantId = resolveCurrentTenantId(ctx);
      const permissionKeys = await buildPermissionKeysForActor(authUser.id, tenantId);
      const data = await updateCommunityGroupMember(ctx.params?.id, ctx.params?.memberId, extractPayload(ctx), tenantId, authUser.id, permissionKeys);
      ctx.body = { success: true, data };
    } catch (error: any) {
      return handleError(ctx, error);
    }
  },

  async removeGroupMember(ctx: any) {
    const authUser = await requireAuthUser(ctx);
    if (!authUser?.id) return;
    try {
      const tenantId = resolveCurrentTenantId(ctx);
      const permissionKeys = await buildPermissionKeysForActor(authUser.id, tenantId);
      await removeCommunityGroupMember(ctx.params?.id, ctx.params?.memberId, tenantId, authUser.id, permissionKeys);
      ctx.body = { success: true };
    } catch (error: any) {
      return handleError(ctx, error);
    }
  },

  async myGroups(ctx: any) {
    const authUser = await requireAuthUser(ctx);
    if (!authUser?.id) return;
    try {
      const tenantId = resolveCurrentTenantId(ctx);
      const data = await getMyCommunityGroups(tenantId, authUser.id);
      ctx.body = { success: true, data };
    } catch (error: any) {
      return handleError(ctx, error);
    }
  },

  async postingContext(ctx: any) {
    const authUser = await readAuthUser(ctx);
    try {
      const tenantId = resolveCurrentTenantId(ctx);
      const permissionKeys = await buildPermissionKeysForActor(authUser?.id || null, tenantId);
      const data = await getCommunityPostingContext(tenantId, authUser?.id || null, permissionKeys);
      ctx.body = { success: true, data };
    } catch (error: any) {
      return handleError(ctx, error);
    }
  },

  async createPost(ctx: any) {
    const authUser = await requireAuthUser(ctx);
    if (!authUser?.id) return;
    try {
      const tenantId = resolveCurrentTenantId(ctx);
      const permissionKeys = await buildPermissionKeysForActor(authUser.id, tenantId);
      const data = await createCommunityPost(extractPayload(ctx), tenantId, authUser.id, permissionKeys);
      ctx.body = { success: true, data };
    } catch (error: any) {
      return handleError(ctx, error);
    }
  },

  async updatePost(ctx: any) {
    const authUser = await requireAuthUser(ctx);
    if (!authUser?.id) return;
    try {
      const tenantId = resolveCurrentTenantId(ctx);
      const permissionKeys = await buildPermissionKeysForActor(authUser.id, tenantId);
      const data = await updateCommunityPost(ctx.params?.id, extractPayload(ctx), tenantId, authUser.id, permissionKeys);
      ctx.body = { success: true, data };
    } catch (error: any) {
      return handleError(ctx, error);
    }
  },

  async deletePost(ctx: any) {
    const authUser = await requireAuthUser(ctx);
    if (!authUser?.id) return;
    try {
      const tenantId = resolveCurrentTenantId(ctx);
      const permissionKeys = await buildPermissionKeysForActor(authUser.id, tenantId);
      await softDeleteCommunityPost(ctx.params?.id, tenantId, authUser.id, permissionKeys);
      ctx.body = { success: true };
    } catch (error: any) {
      return handleError(ctx, error);
    }
  },

  async feed(ctx: any) {
    const authUser = await readAuthUser(ctx);
    try {
      const tenantId = resolveCurrentTenantId(ctx);
      const permissionKeys = await buildPermissionKeysForActor(authUser?.id || null, tenantId);
      const data = await listCommunityFeed({
        tenantId,
        query: ctx.query || {},
        authUserId: authUser?.id || null,
        permissionKeys,
      });
      ctx.body = { success: true, data: data.rows, meta: { pagination: data.pagination, policy: data.policy, actor: data.actor } };
    } catch (error: any) {
      return handleError(ctx, error);
    }
  },

  async listPostComments(ctx: any) {
    const authUser = await readAuthUser(ctx);
    try {
      const tenantId = resolveCurrentTenantId(ctx);
      const permissionKeys = await buildPermissionKeysForActor(authUser?.id || null, tenantId);
      const data = await listCommunityComments({
        postId: ctx.params?.postId,
        tenantId,
        authUserId: authUser?.id || null,
        permissionKeys,
        query: ctx.query || {},
      });
      ctx.body = { success: true, data: data.rows, meta: { pagination: data.pagination } };
    } catch (error: any) {
      return handleError(ctx, error);
    }
  },

  async createPostComment(ctx: any) {
    const authUser = await requireAuthUser(ctx);
    if (!authUser?.id) return;
    try {
      const tenantId = resolveCurrentTenantId(ctx);
      const permissionKeys = await buildPermissionKeysForActor(authUser.id, tenantId);
      const data = await createCommunityComment(ctx.params?.postId, extractPayload(ctx), tenantId, authUser.id, permissionKeys);
      ctx.body = { success: true, data };
    } catch (error: any) {
      return handleError(ctx, error);
    }
  },

  async updateComment(ctx: any) {
    const authUser = await requireAuthUser(ctx);
    if (!authUser?.id) return;
    try {
      const tenantId = resolveCurrentTenantId(ctx);
      const permissionKeys = await buildPermissionKeysForActor(authUser.id, tenantId);
      const data = await updateCommunityComment(ctx.params?.id, extractPayload(ctx), tenantId, authUser.id, permissionKeys);
      ctx.body = { success: true, data };
    } catch (error: any) {
      return handleError(ctx, error);
    }
  },

  async deleteComment(ctx: any) {
    const authUser = await requireAuthUser(ctx);
    if (!authUser?.id) return;
    try {
      const tenantId = resolveCurrentTenantId(ctx);
      const permissionKeys = await buildPermissionKeysForActor(authUser.id, tenantId);
      await deleteCommunityComment(ctx.params?.id, tenantId, authUser.id, permissionKeys);
      ctx.body = { success: true };
    } catch (error: any) {
      return handleError(ctx, error);
    }
  },

  async hideComment(ctx: any) {
    const authUser = await requireAuthUser(ctx);
    if (!authUser?.id) return;
    try {
      const tenantId = resolveCurrentTenantId(ctx);
      const permissionKeys = await buildPermissionKeysForActor(authUser.id, tenantId);
      await hideCommunityComment(ctx.params?.id, tenantId, authUser.id, permissionKeys);
      ctx.body = { success: true };
    } catch (error: any) {
      return handleError(ctx, error);
    }
  },

  async setPostReaction(ctx: any) {
    const authUser = await requireAuthUser(ctx);
    if (!authUser?.id) return;
    try {
      const tenantId = resolveCurrentTenantId(ctx);
      const permissionKeys = await buildPermissionKeysForActor(authUser.id, tenantId);
      const data = await setCommunityReaction(ctx.params?.postId, extractPayload(ctx), tenantId, authUser.id, permissionKeys);
      ctx.body = { success: true, data };
    } catch (error: any) {
      return handleError(ctx, error);
    }
  },

  async listPostReactions(ctx: any) {
    const authUser = await readAuthUser(ctx);
    try {
      const tenantId = resolveCurrentTenantId(ctx);
      const permissionKeys = await buildPermissionKeysForActor(authUser?.id || null, tenantId);
      const data = await listCommunityReactions({
        postId: ctx.params?.postId,
        tenantId,
        authUserId: authUser?.id || null,
        permissionKeys,
        query: ctx.query || {},
      });
      ctx.body = {
        success: true,
        data: data.rows,
        meta: {
          pagination: data.pagination,
          summary: data.summary,
          reactionCount: data.reactionCount,
          myReaction: data.myReaction,
        },
      };
    } catch (error: any) {
      return handleError(ctx, error);
    }
  },

  async removePostReaction(ctx: any) {
    const authUser = await requireAuthUser(ctx);
    if (!authUser?.id) return;
    try {
      const tenantId = resolveCurrentTenantId(ctx);
      const permissionKeys = await buildPermissionKeysForActor(authUser.id, tenantId);
      const data = await removeCommunityReaction(ctx.params?.postId, tenantId, authUser.id, permissionKeys);
      ctx.body = { success: true, data };
    } catch (error: any) {
      return handleError(ctx, error);
    }
  },

  async myPosts(ctx: any) {
    const authUser = await requireAuthUser(ctx);
    if (!authUser?.id) return;
    try {
      const tenantId = resolveCurrentTenantId(ctx);
      const data = await listMyPosts(tenantId, authUser.id, ctx.query || {});
      ctx.body = { success: true, data: data.rows, meta: { pagination: data.pagination, policy: data.policy, actor: data.actor } };
    } catch (error: any) {
      return handleError(ctx, error);
    }
  },

  async managePosts(ctx: any) {
    const authUser = await requireAuthUser(ctx);
    if (!authUser?.id) return;
    try {
      const tenantId = resolveCurrentTenantId(ctx);
      const permissionKeys = await buildPermissionKeysForActor(authUser.id, tenantId);
      const data = await listManageCommunityPosts({
        tenantId,
        authUserId: authUser.id,
        permissionKeys,
        query: ctx.query || {},
      });
      ctx.body = { success: true, data: data.rows, meta: { pagination: data.pagination } };
    } catch (error: any) {
      return handleError(ctx, error);
    }
  },

  async managePostDetail(ctx: any) {
    const authUser = await requireAuthUser(ctx);
    if (!authUser?.id) return;
    try {
      const tenantId = resolveCurrentTenantId(ctx);
      const permissionKeys = await buildPermissionKeysForActor(authUser.id, tenantId);
      const data = await getManageCommunityPostDetail(ctx.params?.id, tenantId, authUser.id, permissionKeys);
      ctx.body = { success: true, data };
    } catch (error: any) {
      return handleError(ctx, error);
    }
  },

  async listPendingPosts(ctx: any) {
    const authUser = await requireAuthUser(ctx);
    if (!authUser?.id) return;
    try {
      const tenantId = resolveCurrentTenantId(ctx);
      const permissionKeys = await buildPermissionKeysForActor(authUser.id, tenantId);
      const data = await listPendingCommunityPosts(tenantId, authUser.id, permissionKeys);
      ctx.body = { success: true, data };
    } catch (error: any) {
      return handleError(ctx, error);
    }
  },

  async publishPost(ctx: any) {
    const authUser = await requireAuthUser(ctx);
    if (!authUser?.id) return;
    try {
      const tenantId = resolveCurrentTenantId(ctx);
      const permissionKeys = await buildPermissionKeysForActor(authUser.id, tenantId);
      const data = await publishCommunityPost(ctx.params?.id, tenantId, authUser.id, permissionKeys);
      ctx.body = { success: true, data };
    } catch (error: any) {
      return handleError(ctx, error);
    }
  },

  async submitPostForReview(ctx: any) {
    const authUser = await requireAuthUser(ctx);
    if (!authUser?.id) return;
    try {
      const tenantId = resolveCurrentTenantId(ctx);
      const permissionKeys = await buildPermissionKeysForActor(authUser.id, tenantId);
      const data = await submitCommunityPostForReview(ctx.params?.id, tenantId, authUser.id, permissionKeys);
      ctx.body = { success: true, data };
    } catch (error: any) {
      return handleError(ctx, error);
    }
  },

  async withdrawPost(ctx: any) {
    const authUser = await requireAuthUser(ctx);
    if (!authUser?.id) return;
    try {
      const tenantId = resolveCurrentTenantId(ctx);
      const permissionKeys = await buildPermissionKeysForActor(authUser.id, tenantId);
      const data = await withdrawCommunityPost(ctx.params?.id, tenantId, authUser.id, permissionKeys);
      ctx.body = { success: true, data };
    } catch (error: any) {
      return handleError(ctx, error);
    }
  },

  async hidePost(ctx: any) {
    const authUser = await requireAuthUser(ctx);
    if (!authUser?.id) return;
    try {
      const tenantId = resolveCurrentTenantId(ctx);
      const permissionKeys = await buildPermissionKeysForActor(authUser.id, tenantId);
      const data = await hideCommunityPost(ctx.params?.id, tenantId, authUser.id, permissionKeys);
      ctx.body = { success: true, data };
    } catch (error: any) {
      return handleError(ctx, error);
    }
  },

  async rejectPost(ctx: any) {
    const authUser = await requireAuthUser(ctx);
    if (!authUser?.id) return;
    try {
      const tenantId = resolveCurrentTenantId(ctx);
      const permissionKeys = await buildPermissionKeysForActor(authUser.id, tenantId);
      const data = await rejectCommunityPost(ctx.params?.id, tenantId, authUser.id, permissionKeys);
      ctx.body = { success: true, data };
    } catch (error: any) {
      return handleError(ctx, error);
    }
  },

  async pinPost(ctx: any) {
    const authUser = await requireAuthUser(ctx);
    if (!authUser?.id) return;
    try {
      const tenantId = resolveCurrentTenantId(ctx);
      const permissionKeys = await buildPermissionKeysForActor(authUser.id, tenantId);
      const data = await pinCommunityPost(ctx.params?.id, tenantId, authUser.id, permissionKeys, true);
      ctx.body = { success: true, data };
    } catch (error: any) {
      return handleError(ctx, error);
    }
  },

  async unpinPost(ctx: any) {
    const authUser = await requireAuthUser(ctx);
    if (!authUser?.id) return;
    try {
      const tenantId = resolveCurrentTenantId(ctx);
      const permissionKeys = await buildPermissionKeysForActor(authUser.id, tenantId);
      const data = await pinCommunityPost(ctx.params?.id, tenantId, authUser.id, permissionKeys, false);
      ctx.body = { success: true, data };
    } catch (error: any) {
      return handleError(ctx, error);
    }
  },

  async featurePost(ctx: any) {
    const authUser = await requireAuthUser(ctx);
    if (!authUser?.id) return;
    try {
      const tenantId = resolveCurrentTenantId(ctx);
      const permissionKeys = await buildPermissionKeysForActor(authUser.id, tenantId);
      const data = await featureCommunityPost(ctx.params?.id, tenantId, authUser.id, permissionKeys, true);
      ctx.body = { success: true, data };
    } catch (error: any) {
      return handleError(ctx, error);
    }
  },

  async unfeaturePost(ctx: any) {
    const authUser = await requireAuthUser(ctx);
    if (!authUser?.id) return;
    try {
      const tenantId = resolveCurrentTenantId(ctx);
      const permissionKeys = await buildPermissionKeysForActor(authUser.id, tenantId);
      const data = await featureCommunityPost(ctx.params?.id, tenantId, authUser.id, permissionKeys, false);
      ctx.body = { success: true, data };
    } catch (error: any) {
      return handleError(ctx, error);
    }
  },
};
