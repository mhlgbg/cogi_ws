import { resolveCurrentTenantId } from '../../../utils/tenant-scope';
import {
	activateManagedClubMember,
	createManagedClubAchievementCorrectionSubmission,
	createManagedClubMember,
	createManagedClubMemberHistory,
	createManagedClubProfile,
	deactivateManagedClubMember,
	deactivateManagedClubMemberWithEvent,
	deleteManagedClubMemberHistory,
	getManagedClubAchievementDetail,
	getManagedClubAchievementSubmissionDetail,
	getManagedClubMemberDetail,
	getMyManagedClubDetail,
	handleSportsClubManagementError,
	leaveManagedClubMember,
	leaveManagedClubMemberWithEvent,
	listManagedClubAchievementProfileOptions,
	listManagedClubAchievements,
	listManagedClubAchievementSubmissions,
	listManagedClubMemberHistory,
	listManagedClubMembers,
	listManagedClubProfileOptions,
	listMyManagedClubs,
	revokeManagedClubAchievement,
	rejectManagedClubAchievementSubmission,
	reactivateManagedClubMember,
	rejoinManagedClubMember,
	createManagedClubAchievementSubmission,
	submitManagedClubAchievementSubmission,
	updateManagedClubAchievementSubmission,
	updateManagedClubMemberHistory,
	updateManagedClubMember,
	verifyManagedClubAchievementSubmission,
} from '../services/sports-club-management';

type AuthUser = { id: number; blocked?: boolean | null };

async function resolveUserFromJwt(ctx: any): Promise<AuthUser | null> {
	try {
		const authHeader = ctx.request?.headers?.authorization || ctx.request?.header?.authorization || '';
		const token = typeof authHeader === 'string' && authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
		if (!token) return null;
		const jwtService = strapi.plugin('users-permissions')?.service('jwt');
		if (!jwtService) return null;
		const decoded = await jwtService.verify(token);
		const userId = Number(decoded?.id || 0);
		if (!Number.isInteger(userId) || userId <= 0) return null;
		return strapi.db.query('plugin::users-permissions.user').findOne({ where: { id: userId }, select: ['id', 'blocked'] });
	} catch {
		return null;
	}
}

async function requireAuthenticatedUser(ctx: any): Promise<AuthUser | null> {
	let authUser = ctx.state?.user as AuthUser | undefined;
	if (!authUser?.id) {
		authUser = (await resolveUserFromJwt(ctx)) || undefined;
		if (authUser?.id) ctx.state.user = authUser;
	}
	if (!authUser?.id) {
		ctx.unauthorized('Unauthorized');
		return null;
	}
	if (authUser.blocked) {
		ctx.unauthorized('Account is blocked');
		return null;
	}
	return authUser;
}

function extractPayload(ctx: any): Record<string, unknown> {
	const body = ctx.request?.body;
	if (body?.data && typeof body.data === 'object' && !Array.isArray(body.data)) return body.data as Record<string, unknown>;
	if (body && typeof body === 'object' && !Array.isArray(body)) return body as Record<string, unknown>;
	return {};
}

export default {
	async listMyManagedClubs(ctx: any) {
		const authUser = await requireAuthenticatedUser(ctx);
		if (!authUser?.id) return;
		try {
			const tenantId = resolveCurrentTenantId(ctx);
			ctx.body = { data: await listMyManagedClubs(Number(authUser.id), tenantId) };
		} catch (error) {
			return handleSportsClubManagementError(ctx, error);
		}
	},

	async getMyManagedClubDetail(ctx: any) {
		const authUser = await requireAuthenticatedUser(ctx);
		if (!authUser?.id) return;
		try {
			const tenantId = resolveCurrentTenantId(ctx);
			ctx.body = { success: true, data: await getMyManagedClubDetail(Number(authUser.id), ctx.params?.clubId, tenantId) };
		} catch (error) {
			return handleSportsClubManagementError(ctx, error);
		}
	},

	async listMembers(ctx: any) {
		const authUser = await requireAuthenticatedUser(ctx);
		if (!authUser?.id) return;
		try {
			const tenantId = resolveCurrentTenantId(ctx);
			const data = await listManagedClubMembers(Number(authUser.id), ctx.params?.clubId, tenantId, ctx.query || {});
			ctx.body = { data: data.rows, meta: { pagination: data.pagination } };
		} catch (error) {
			return handleSportsClubManagementError(ctx, error);
		}
	},

	async listProfileOptions(ctx: any) {
		const authUser = await requireAuthenticatedUser(ctx);
		if (!authUser?.id) return;
		try {
			const tenantId = resolveCurrentTenantId(ctx);
			const data = await listManagedClubProfileOptions(Number(authUser.id), ctx.params?.clubId, tenantId, ctx.query || {});
			ctx.body = { data: data.rows, meta: { pagination: data.pagination } };
		} catch (error) {
			return handleSportsClubManagementError(ctx, error);
		}
	},

	async createMember(ctx: any) {
		const authUser = await requireAuthenticatedUser(ctx);
		if (!authUser?.id) return;
		try {
			const tenantId = resolveCurrentTenantId(ctx);
			ctx.body = { success: true, data: await createManagedClubMember(Number(authUser.id), ctx.params?.clubId, tenantId, extractPayload(ctx), authUser) };
		} catch (error) {
			return handleSportsClubManagementError(ctx, error);
		}
	},

	async createProfile(ctx: any) {
		const authUser = await requireAuthenticatedUser(ctx);
		if (!authUser?.id) return;
		try {
			const tenantId = resolveCurrentTenantId(ctx);
			ctx.body = { success: true, data: await createManagedClubProfile(Number(authUser.id), ctx.params?.clubId, tenantId, extractPayload(ctx)) };
		} catch (error) {
			return handleSportsClubManagementError(ctx, error);
		}
	},

	async getMemberDetail(ctx: any) {
		const authUser = await requireAuthenticatedUser(ctx);
		if (!authUser?.id) return;
		try {
			const tenantId = resolveCurrentTenantId(ctx);
			ctx.body = { success: true, data: await getManagedClubMemberDetail(Number(authUser.id), ctx.params?.clubId, ctx.params?.membershipId, tenantId) };
		} catch (error) {
			return handleSportsClubManagementError(ctx, error);
		}
	},

	async updateMember(ctx: any) {
		const authUser = await requireAuthenticatedUser(ctx);
		if (!authUser?.id) return;
		try {
			const tenantId = resolveCurrentTenantId(ctx);
			ctx.body = { success: true, data: await updateManagedClubMember(Number(authUser.id), ctx.params?.clubId, ctx.params?.membershipId, tenantId, extractPayload(ctx), authUser) };
		} catch (error) {
			return handleSportsClubManagementError(ctx, error);
		}
	},

	async activateMember(ctx: any) {
		const authUser = await requireAuthenticatedUser(ctx);
		if (!authUser?.id) return;
		try {
			const tenantId = resolveCurrentTenantId(ctx);
			ctx.body = { success: true, data: await activateManagedClubMember(Number(authUser.id), ctx.params?.clubId, ctx.params?.membershipId, tenantId, authUser) };
		} catch (error) {
			return handleSportsClubManagementError(ctx, error);
		}
	},

	async deactivateMember(ctx: any) {
		const authUser = await requireAuthenticatedUser(ctx);
		if (!authUser?.id) return;
		try {
			const tenantId = resolveCurrentTenantId(ctx);
			ctx.body = { success: true, data: await deactivateManagedClubMemberWithEvent(Number(authUser.id), ctx.params?.clubId, ctx.params?.membershipId, tenantId, extractPayload(ctx), authUser) };
		} catch (error) {
			return handleSportsClubManagementError(ctx, error);
		}
	},

	async leaveMember(ctx: any) {
		const authUser = await requireAuthenticatedUser(ctx);
		if (!authUser?.id) return;
		try {
			const tenantId = resolveCurrentTenantId(ctx);
			ctx.body = { success: true, data: await leaveManagedClubMemberWithEvent(Number(authUser.id), ctx.params?.clubId, ctx.params?.membershipId, tenantId, extractPayload(ctx), authUser) };
		} catch (error) {
			return handleSportsClubManagementError(ctx, error);
		}
	},

	async reactivateMember(ctx: any) {
		const authUser = await requireAuthenticatedUser(ctx);
		if (!authUser?.id) return;
		try {
			const tenantId = resolveCurrentTenantId(ctx);
			ctx.body = { success: true, data: await reactivateManagedClubMember(Number(authUser.id), ctx.params?.clubId, ctx.params?.membershipId, tenantId, extractPayload(ctx), authUser) };
		} catch (error) {
			return handleSportsClubManagementError(ctx, error);
		}
	},

	async rejoinMember(ctx: any) {
		const authUser = await requireAuthenticatedUser(ctx);
		if (!authUser?.id) return;
		try {
			const tenantId = resolveCurrentTenantId(ctx);
			ctx.body = { success: true, data: await rejoinManagedClubMember(Number(authUser.id), ctx.params?.clubId, ctx.params?.membershipId, tenantId, extractPayload(ctx), authUser) };
		} catch (error) {
			return handleSportsClubManagementError(ctx, error);
		}
	},

	async listMemberHistory(ctx: any) {
		const authUser = await requireAuthenticatedUser(ctx);
		if (!authUser?.id) return;
		try {
			const tenantId = resolveCurrentTenantId(ctx);
			const data = await listManagedClubMemberHistory(Number(authUser.id), ctx.params?.clubId, ctx.params?.membershipId, tenantId, ctx.query || {});
			ctx.body = { data: data.rows, meta: { pagination: data.pagination } };
		} catch (error) {
			return handleSportsClubManagementError(ctx, error);
		}
	},

	async createMemberHistory(ctx: any) {
		const authUser = await requireAuthenticatedUser(ctx);
		if (!authUser?.id) return;
		try {
			const tenantId = resolveCurrentTenantId(ctx);
			ctx.body = { success: true, data: await createManagedClubMemberHistory(Number(authUser.id), ctx.params?.clubId, ctx.params?.membershipId, tenantId, extractPayload(ctx), authUser) };
		} catch (error) {
			return handleSportsClubManagementError(ctx, error);
		}
	},

	async updateMemberHistory(ctx: any) {
		const authUser = await requireAuthenticatedUser(ctx);
		if (!authUser?.id) return;
		try {
			const tenantId = resolveCurrentTenantId(ctx);
			ctx.body = { success: true, data: await updateManagedClubMemberHistory(Number(authUser.id), ctx.params?.clubId, ctx.params?.membershipId, ctx.params?.historyId, tenantId, extractPayload(ctx)) };
		} catch (error) {
			return handleSportsClubManagementError(ctx, error);
		}
	},

	async deleteMemberHistory(ctx: any) {
		const authUser = await requireAuthenticatedUser(ctx);
		if (!authUser?.id) return;
		try {
			const tenantId = resolveCurrentTenantId(ctx);
			ctx.body = await deleteManagedClubMemberHistory(Number(authUser.id), ctx.params?.clubId, ctx.params?.membershipId, ctx.params?.historyId, tenantId);
		} catch (error) {
			return handleSportsClubManagementError(ctx, error);
		}
	},

	async listAchievementProfileOptions(ctx: any) {
		const authUser = await requireAuthenticatedUser(ctx);
		if (!authUser?.id) return;
		try {
			const tenantId = resolveCurrentTenantId(ctx);
			const data = await listManagedClubAchievementProfileOptions(Number(authUser.id), ctx.params?.clubId, tenantId, ctx.query || {});
			ctx.body = { data };
		} catch (error) {
			return handleSportsClubManagementError(ctx, error);
		}
	},

	async listAchievementSubmissions(ctx: any) {
		const authUser = await requireAuthenticatedUser(ctx);
		if (!authUser?.id) return;
		try {
			const tenantId = resolveCurrentTenantId(ctx);
			const data = await listManagedClubAchievementSubmissions(Number(authUser.id), ctx.params?.clubId, tenantId, ctx.query || {});
			ctx.body = { data: data.rows, meta: { pagination: data.pagination } };
		} catch (error) {
			return handleSportsClubManagementError(ctx, error);
		}
	},

	async getAchievementSubmissionDetail(ctx: any) {
		const authUser = await requireAuthenticatedUser(ctx);
		if (!authUser?.id) return;
		try {
			const tenantId = resolveCurrentTenantId(ctx);
			ctx.body = { success: true, data: await getManagedClubAchievementSubmissionDetail(Number(authUser.id), ctx.params?.clubId, ctx.params?.id, tenantId) };
		} catch (error) {
			return handleSportsClubManagementError(ctx, error);
		}
	},

	async createAchievementSubmission(ctx: any) {
		const authUser = await requireAuthenticatedUser(ctx);
		if (!authUser?.id) return;
		try {
			const tenantId = resolveCurrentTenantId(ctx);
			ctx.body = { success: true, data: await createManagedClubAchievementSubmission(Number(authUser.id), ctx.params?.clubId, tenantId, extractPayload(ctx), authUser) };
		} catch (error) {
			return handleSportsClubManagementError(ctx, error);
		}
	},

	async updateAchievementSubmission(ctx: any) {
		const authUser = await requireAuthenticatedUser(ctx);
		if (!authUser?.id) return;
		try {
			const tenantId = resolveCurrentTenantId(ctx);
			ctx.body = { success: true, data: await updateManagedClubAchievementSubmission(Number(authUser.id), ctx.params?.clubId, ctx.params?.id, tenantId, extractPayload(ctx), authUser) };
		} catch (error) {
			return handleSportsClubManagementError(ctx, error);
		}
	},

	async submitAchievementSubmission(ctx: any) {
		const authUser = await requireAuthenticatedUser(ctx);
		if (!authUser?.id) return;
		try {
			const tenantId = resolveCurrentTenantId(ctx);
			ctx.body = { success: true, data: await submitManagedClubAchievementSubmission(Number(authUser.id), ctx.params?.clubId, ctx.params?.id, tenantId, authUser) };
		} catch (error) {
			return handleSportsClubManagementError(ctx, error);
		}
	},

	async verifyAchievementSubmission(ctx: any) {
		const authUser = await requireAuthenticatedUser(ctx);
		if (!authUser?.id) return;
		try {
			const tenantId = resolveCurrentTenantId(ctx);
			ctx.body = { success: true, data: await verifyManagedClubAchievementSubmission(Number(authUser.id), ctx.params?.clubId, ctx.params?.id, tenantId, extractPayload(ctx), authUser) };
		} catch (error) {
			return handleSportsClubManagementError(ctx, error);
		}
	},

	async rejectAchievementSubmission(ctx: any) {
		const authUser = await requireAuthenticatedUser(ctx);
		if (!authUser?.id) return;
		try {
			const tenantId = resolveCurrentTenantId(ctx);
			ctx.body = { success: true, data: await rejectManagedClubAchievementSubmission(Number(authUser.id), ctx.params?.clubId, ctx.params?.id, tenantId, extractPayload(ctx), authUser) };
		} catch (error) {
			return handleSportsClubManagementError(ctx, error);
		}
	},

	async listAchievements(ctx: any) {
		const authUser = await requireAuthenticatedUser(ctx);
		if (!authUser?.id) return;
		try {
			const tenantId = resolveCurrentTenantId(ctx);
			const data = await listManagedClubAchievements(Number(authUser.id), ctx.params?.clubId, tenantId, ctx.query || {});
			ctx.body = { data: data.rows, meta: { pagination: data.pagination } };
		} catch (error) {
			return handleSportsClubManagementError(ctx, error);
		}
	},

	async getAchievementDetail(ctx: any) {
		const authUser = await requireAuthenticatedUser(ctx);
		if (!authUser?.id) return;
		try {
			const tenantId = resolveCurrentTenantId(ctx);
			ctx.body = { success: true, data: await getManagedClubAchievementDetail(Number(authUser.id), ctx.params?.clubId, ctx.params?.id, tenantId) };
		} catch (error) {
			return handleSportsClubManagementError(ctx, error);
		}
	},

	async revokeAchievement(ctx: any) {
		const authUser = await requireAuthenticatedUser(ctx);
		if (!authUser?.id) return;
		try {
			const tenantId = resolveCurrentTenantId(ctx);
			ctx.body = { success: true, data: await revokeManagedClubAchievement(Number(authUser.id), ctx.params?.clubId, ctx.params?.achievementId, tenantId, extractPayload(ctx), authUser) };
		} catch (error) {
			return handleSportsClubManagementError(ctx, error);
		}
	},

	async createAchievementCorrectionSubmission(ctx: any) {
		const authUser = await requireAuthenticatedUser(ctx);
		if (!authUser?.id) return;
		try {
			const tenantId = resolveCurrentTenantId(ctx);
			ctx.body = { success: true, data: await createManagedClubAchievementCorrectionSubmission(Number(authUser.id), ctx.params?.clubId, ctx.params?.achievementId, tenantId, authUser) };
		} catch (error) {
			return handleSportsClubManagementError(ctx, error);
		}
	},
};