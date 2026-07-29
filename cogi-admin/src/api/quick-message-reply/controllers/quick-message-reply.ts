import { getTenantIdFromContext, markQuickMessageReplyRead } from '../../quick-message/services/quick-message-admin';
import { handleManageError, requireAuthenticatedUser } from '../../quick-message/controllers/manage-auth';

export default {
	async readManage(ctx: any) {
		const authUser = await requireAuthenticatedUser(ctx);
		if (!authUser?.id) return;

		try {
			const data = await markQuickMessageReplyRead(ctx.params?.id, getTenantIdFromContext(ctx));
			ctx.body = { success: true, data };
		} catch (error: any) {
			return handleManageError(ctx, error, 'quick-message-reply.manage');
		}
	},
};