import { factories } from '@strapi/strapi';
import { resolveCurrentTenantId } from '../../../utils/tenant-scope';
import {
	activateTenantSportsClub,
	createTenantSportsClub,
	deactivateTenantSportsClub,
	getTenantSportsClub,
	handleSportsClubError,
	listTenantSportsClubs,
	updateTenantSportsClub,
} from '../services/sports-club';

const SPORTS_CLUB_UID = 'api::sports-club.sports-club' as any;

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

export default factories.createCoreController(SPORTS_CLUB_UID, () => ({
	async list(ctx: any) {
		const authUser = await requireAuthenticatedUser(ctx);
		if (!authUser?.id) return;

		try {
			const tenantId = resolveCurrentTenantId(ctx);
			const data = await listTenantSportsClubs(ctx.query || {}, tenantId);
			ctx.body = { data: data.rows, meta: { pagination: data.pagination } };
		} catch (error) {
			return handleSportsClubError(ctx, error);
		}
	},

	async getDetail(ctx: any) {
		const authUser = await requireAuthenticatedUser(ctx);
		if (!authUser?.id) return;

		try {
			const tenantId = resolveCurrentTenantId(ctx);
			const data = await getTenantSportsClub(ctx.params?.id, tenantId);
			ctx.body = { success: true, data };
		} catch (error) {
			return handleSportsClubError(ctx, error);
		}
	},

	async create(ctx: any) {
		const authUser = await requireAuthenticatedUser(ctx);
		if (!authUser?.id) return;

		try {
			const tenantId = resolveCurrentTenantId(ctx);
			const data = await createTenantSportsClub(extractPayload(ctx), tenantId);
			ctx.body = { success: true, data };
		} catch (error) {
			return handleSportsClubError(ctx, error);
		}
	},

	async update(ctx: any) {
		const authUser = await requireAuthenticatedUser(ctx);
		if (!authUser?.id) return;

		try {
			const tenantId = resolveCurrentTenantId(ctx);
			const data = await updateTenantSportsClub(ctx.params?.id, extractPayload(ctx), tenantId);
			ctx.body = { success: true, data };
		} catch (error) {
			return handleSportsClubError(ctx, error);
		}
	},

	async activate(ctx: any) {
		const authUser = await requireAuthenticatedUser(ctx);
		if (!authUser?.id) return;

		try {
			const tenantId = resolveCurrentTenantId(ctx);
			const data = await activateTenantSportsClub(ctx.params?.id, tenantId);
			ctx.body = { success: true, data };
		} catch (error) {
			return handleSportsClubError(ctx, error);
		}
	},

	async deactivate(ctx: any) {
		const authUser = await requireAuthenticatedUser(ctx);
		if (!authUser?.id) return;

		try {
			const tenantId = resolveCurrentTenantId(ctx);
			const data = await deactivateTenantSportsClub(ctx.params?.id, tenantId);
			ctx.body = { success: true, data };
		} catch (error) {
			return handleSportsClubError(ctx, error);
		}
	},
}));