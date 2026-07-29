import {
	cancelQuickMessageAccess,
	changeQuickMessageAccessPin,
	disableQuickMessageAccessPin,
	enableQuickMessageAccessPin,
	getTenantIdFromContext,
	lockQuickMessageAccess,
	unlockQuickMessageAccess,
	updateQuickMessageAccess,
} from '../../quick-message/services/quick-message-admin';
import { handleManageError, requireAuthenticatedUser } from '../../quick-message/controllers/manage-auth';

export default {
	async updateManage(ctx: any) {
		const authUser = await requireAuthenticatedUser(ctx);
		if (!authUser?.id) return;

		try {
			const data = await updateQuickMessageAccess(ctx.params?.id, ctx.request?.body || {}, getTenantIdFromContext(ctx));
			ctx.body = { success: true, data };
		} catch (error: any) {
			return handleManageError(ctx, error, 'quick-message-access.manage');
		}
	},

	async enablePinManage(ctx: any) {
		const authUser = await requireAuthenticatedUser(ctx);
		if (!authUser?.id) return;

		try {
			const data = await enableQuickMessageAccessPin(ctx.params?.id, ctx.request?.body || {}, getTenantIdFromContext(ctx));
			ctx.body = { success: true, data };
		} catch (error: any) {
			return handleManageError(ctx, error, 'quick-message-access.manage');
		}
	},

	async changePinManage(ctx: any) {
		const authUser = await requireAuthenticatedUser(ctx);
		if (!authUser?.id) return;

		try {
			const data = await changeQuickMessageAccessPin(ctx.params?.id, ctx.request?.body || {}, getTenantIdFromContext(ctx));
			ctx.body = { success: true, data };
		} catch (error: any) {
			return handleManageError(ctx, error, 'quick-message-access.manage');
		}
	},

	async disablePinManage(ctx: any) {
		const authUser = await requireAuthenticatedUser(ctx);
		if (!authUser?.id) return;

		try {
			const data = await disableQuickMessageAccessPin(ctx.params?.id, getTenantIdFromContext(ctx));
			ctx.body = { success: true, data };
		} catch (error: any) {
			return handleManageError(ctx, error, 'quick-message-access.manage');
		}
	},

	async lockManage(ctx: any) {
		const authUser = await requireAuthenticatedUser(ctx);
		if (!authUser?.id) return;

		try {
			const data = await lockQuickMessageAccess(ctx.params?.id, getTenantIdFromContext(ctx));
			ctx.body = { success: true, data };
		} catch (error: any) {
			return handleManageError(ctx, error, 'quick-message-access.manage');
		}
	},

	async unlockManage(ctx: any) {
		const authUser = await requireAuthenticatedUser(ctx);
		if (!authUser?.id) return;

		try {
			const data = await unlockQuickMessageAccess(ctx.params?.id, ctx.request?.body || {}, getTenantIdFromContext(ctx));
			ctx.body = { success: true, data };
		} catch (error: any) {
			return handleManageError(ctx, error, 'quick-message-access.manage');
		}
	},

	async cancelManage(ctx: any) {
		const authUser = await requireAuthenticatedUser(ctx);
		if (!authUser?.id) return;

		try {
			const data = await cancelQuickMessageAccess(ctx.params?.id, getTenantIdFromContext(ctx));
			ctx.body = { success: true, data };
		} catch (error: any) {
			return handleManageError(ctx, error, 'quick-message-access.manage');
		}
	},
};