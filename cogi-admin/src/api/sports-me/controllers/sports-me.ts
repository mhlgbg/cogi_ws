import { resolveCurrentTenantId } from '../../../utils/tenant-scope';
import {
	getMyAchievement,
	getMyAchievementSubmission,
	getMyClubMembership,
	getMySportsProfile,
	handleSportsMeError,
	listMyAchievementSubmissions,
	listMyAchievements,
	listMyClubMemberships,
	listMyMembershipHistory,
	uploadMySportsProfileAvatar,
	updateMySportsProfile,
} from '../services/sports-me';

type AuthUser = { id: number; blocked?: boolean | null };

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
	if (body?.data && typeof body.data === 'object' && !Array.isArray(body.data)) {
		return body.data as Record<string, unknown>;
	}
	if (body && typeof body === 'object' && !Array.isArray(body)) {
		return body as Record<string, unknown>;
	}
	return {};
}

export default {
	async getProfile(ctx: any) {
		const authUser = await requireAuthenticatedUser(ctx);
		if (!authUser?.id) return;
		try {
			const tenantId = resolveCurrentTenantId(ctx);
			ctx.body = { success: true, data: await getMySportsProfile(tenantId, authUser.id) };
		} catch (error) {
			return handleSportsMeError(ctx, error);
		}
	},

	async updateProfile(ctx: any) {
		const authUser = await requireAuthenticatedUser(ctx);
		if (!authUser?.id) return;
		try {
			const tenantId = resolveCurrentTenantId(ctx);
			ctx.body = { success: true, data: await updateMySportsProfile(tenantId, authUser.id, extractPayload(ctx)) };
		} catch (error) {
			return handleSportsMeError(ctx, error);
		}
	},

	async uploadAvatar(ctx: any) {
		const authUser = await requireAuthenticatedUser(ctx);
		if (!authUser?.id) return;
		try {
			const tenantId = resolveCurrentTenantId(ctx);
			ctx.body = { success: true, data: await uploadMySportsProfileAvatar(tenantId, authUser.id, ctx.request?.files) };
		} catch (error) {
			return handleSportsMeError(ctx, error);
		}
	},

	async listClubs(ctx: any) {
		const authUser = await requireAuthenticatedUser(ctx);
		if (!authUser?.id) return;
		try {
			const tenantId = resolveCurrentTenantId(ctx);
			const data = await listMyClubMemberships(tenantId, authUser.id, ctx.query || {});
			ctx.body = { data: data.rows };
		} catch (error) {
			return handleSportsMeError(ctx, error);
		}
	},

	async getClubDetail(ctx: any) {
		const authUser = await requireAuthenticatedUser(ctx);
		if (!authUser?.id) return;
		try {
			const tenantId = resolveCurrentTenantId(ctx);
			ctx.body = { success: true, data: await getMyClubMembership(tenantId, authUser.id, ctx.params?.membershipId) };
		} catch (error) {
			return handleSportsMeError(ctx, error);
		}
	},

	async listClubHistory(ctx: any) {
		const authUser = await requireAuthenticatedUser(ctx);
		if (!authUser?.id) return;
		try {
			const tenantId = resolveCurrentTenantId(ctx);
			const data = await listMyMembershipHistory(tenantId, authUser.id, ctx.params?.membershipId);
			ctx.body = { success: true, data };
		} catch (error) {
			return handleSportsMeError(ctx, error);
		}
	},

	async listAchievements(ctx: any) {
		const authUser = await requireAuthenticatedUser(ctx);
		if (!authUser?.id) return;
		try {
			const tenantId = resolveCurrentTenantId(ctx);
			const data = await listMyAchievements(tenantId, authUser.id, ctx.query || {});
			ctx.body = { data: data.rows };
		} catch (error) {
			return handleSportsMeError(ctx, error);
		}
	},

	async getAchievementDetail(ctx: any) {
		const authUser = await requireAuthenticatedUser(ctx);
		if (!authUser?.id) return;
		try {
			const tenantId = resolveCurrentTenantId(ctx);
			ctx.body = { success: true, data: await getMyAchievement(tenantId, authUser.id, ctx.params?.achievementId) };
		} catch (error) {
			return handleSportsMeError(ctx, error);
		}
	},

	async listAchievementSubmissions(ctx: any) {
		const authUser = await requireAuthenticatedUser(ctx);
		if (!authUser?.id) return;
		try {
			const tenantId = resolveCurrentTenantId(ctx);
			const data = await listMyAchievementSubmissions(tenantId, authUser.id, ctx.query || {});
			ctx.body = { data: data.rows };
		} catch (error) {
			return handleSportsMeError(ctx, error);
		}
	},

	async getAchievementSubmissionDetail(ctx: any) {
		const authUser = await requireAuthenticatedUser(ctx);
		if (!authUser?.id) return;
		try {
			const tenantId = resolveCurrentTenantId(ctx);
			ctx.body = { success: true, data: await getMyAchievementSubmission(tenantId, authUser.id, ctx.params?.submissionId) };
		} catch (error) {
			return handleSportsMeError(ctx, error);
		}
	},
};