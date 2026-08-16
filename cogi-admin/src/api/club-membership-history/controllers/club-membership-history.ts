import { factories } from '@strapi/strapi';
import { resolveCurrentTenantId } from '../../../utils/tenant-scope';
import {
	getTenantMembershipHistory,
	handleClubMembershipHistoryError,
	listTenantHistoryForMembership,
	listTenantMembershipHistories,
} from '../services/club-membership-history';

const CLUB_MEMBERSHIP_HISTORY_UID = 'api::club-membership-history.club-membership-history' as any;

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

export default factories.createCoreController(CLUB_MEMBERSHIP_HISTORY_UID, () => ({
	async list(ctx: any) {
		const authUser = await requireAuthenticatedUser(ctx);
		if (!authUser?.id) return;
		try {
			const tenantId = resolveCurrentTenantId(ctx);
			const data = await listTenantMembershipHistories(ctx.query || {}, tenantId);
			ctx.body = { data: data.rows, meta: { pagination: data.pagination } };
		} catch (error) {
			return handleClubMembershipHistoryError(ctx, error);
		}
	},

	async getDetail(ctx: any) {
		const authUser = await requireAuthenticatedUser(ctx);
		if (!authUser?.id) return;
		try {
			const tenantId = resolveCurrentTenantId(ctx);
			const data = await getTenantMembershipHistory(ctx.params?.id, tenantId);
			ctx.body = { success: true, data };
		} catch (error) {
			return handleClubMembershipHistoryError(ctx, error);
		}
	},

	async listForMembership(ctx: any) {
		const authUser = await requireAuthenticatedUser(ctx);
		if (!authUser?.id) return;
		try {
			const tenantId = resolveCurrentTenantId(ctx);
			const data = await listTenantHistoryForMembership(ctx.params?.id, tenantId, ctx.query || {});
			ctx.body = { data: data.rows, meta: { pagination: data.pagination } };
		} catch (error) {
			return handleClubMembershipHistoryError(ctx, error);
		}
	},
}));