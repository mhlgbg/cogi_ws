import { factories } from '@strapi/strapi';
import { resolveCurrentTenantId } from '../../../utils/tenant-scope';
import {
	activateTenantSportsClubUserAssignment,
	createTenantSportsClubUserAssignment,
	deactivateTenantSportsClubUserAssignment,
	getTenantSportsClubUserAssignment,
	handleSportsClubUserAssignmentError,
	listAssignableTenantUsers,
	listTenantSportsClubUserAssignments,
	updateTenantSportsClubUserAssignment,
} from '../services/sports-club-user-assignment';

const ASSIGNMENT_UID = 'api::sports-club-user-assignment.sports-club-user-assignment' as any;

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

export default factories.createCoreController(ASSIGNMENT_UID, () => ({
	async list(ctx: any) {
		const authUser = await requireAuthenticatedUser(ctx);
		if (!authUser?.id) return;
		try {
			const tenantId = resolveCurrentTenantId(ctx);
			const data = await listTenantSportsClubUserAssignments(ctx.query || {}, tenantId);
			ctx.body = { data: data.rows, meta: { pagination: data.pagination } };
		} catch (error) {
			return handleSportsClubUserAssignmentError(ctx, error);
		}
	},

	async getDetail(ctx: any) {
		const authUser = await requireAuthenticatedUser(ctx);
		if (!authUser?.id) return;
		try {
			const tenantId = resolveCurrentTenantId(ctx);
			ctx.body = { success: true, data: await getTenantSportsClubUserAssignment(ctx.params?.id, tenantId) };
		} catch (error) {
			return handleSportsClubUserAssignmentError(ctx, error);
		}
	},

	async create(ctx: any) {
		const authUser = await requireAuthenticatedUser(ctx);
		if (!authUser?.id) return;
		try {
			const tenantId = resolveCurrentTenantId(ctx);
			ctx.body = { success: true, data: await createTenantSportsClubUserAssignment(extractPayload(ctx), tenantId, authUser) };
		} catch (error) {
			return handleSportsClubUserAssignmentError(ctx, error);
		}
	},

	async update(ctx: any) {
		const authUser = await requireAuthenticatedUser(ctx);
		if (!authUser?.id) return;
		try {
			const tenantId = resolveCurrentTenantId(ctx);
			ctx.body = { success: true, data: await updateTenantSportsClubUserAssignment(ctx.params?.id, extractPayload(ctx), tenantId, authUser) };
		} catch (error) {
			return handleSportsClubUserAssignmentError(ctx, error);
		}
	},

	async activate(ctx: any) {
		const authUser = await requireAuthenticatedUser(ctx);
		if (!authUser?.id) return;
		try {
			const tenantId = resolveCurrentTenantId(ctx);
			ctx.body = { success: true, data: await activateTenantSportsClubUserAssignment(ctx.params?.id, tenantId, authUser) };
		} catch (error) {
			return handleSportsClubUserAssignmentError(ctx, error);
		}
	},

	async deactivate(ctx: any) {
		const authUser = await requireAuthenticatedUser(ctx);
		if (!authUser?.id) return;
		try {
			const tenantId = resolveCurrentTenantId(ctx);
			ctx.body = { success: true, data: await deactivateTenantSportsClubUserAssignment(ctx.params?.id, tenantId) };
		} catch (error) {
			return handleSportsClubUserAssignmentError(ctx, error);
		}
	},

	async listAssignableUsers(ctx: any) {
		const authUser = await requireAuthenticatedUser(ctx);
		if (!authUser?.id) return;
		try {
			const tenantId = resolveCurrentTenantId(ctx);
			const data = await listAssignableTenantUsers(ctx.query || {}, tenantId);
			ctx.body = { data: data.rows, meta: { pagination: data.pagination } };
		} catch (error) {
			return handleSportsClubUserAssignmentError(ctx, error);
		}
	},
}));