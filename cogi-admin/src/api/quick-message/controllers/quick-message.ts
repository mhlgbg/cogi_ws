import {
	cancelQuickMessage,
	cloneQuickMessageAccessBatch,
	createQuickMessageActivityMessage,
	createQuickMessage,
	createQuickMessageAccess,
	getQuickMessageActivityAccessDetail,
	getQuickMessageDetail,
	getTenantIdFromContext,
	listQuickMessageActivityAccesses,
	listQuickMessageActivityLogs,
	listQuickMessageActivityMessages,
	listQuickMessageReplies,
	listQuickMessages,
	lockQuickMessage,
	markQuickMessageActivityRead,
	markQuickMessageRepliesReadAll,
	unlockQuickMessage,
	updateQuickMessage,
} from '../services/quick-message-admin';
import {
	createQuickMessageAccessTokenPublic,
	listQuickMessagePublicMessages,
	markQuickMessagePublicMessagesRead,
	openQuickMessageContentPublic,
	QuickMessagePublicError,
	lookupQuickMessageAccessPublic,
	sendQuickMessagePublicReply,
	verifyQuickMessageAccessPinPublic,
} from '../services/quick-message-public';
import { handleManageError, requireAuthenticatedUser } from './manage-auth';

function applyQuickMessagePublicHeaders(ctx: any) {
	ctx.set('Cache-Control', 'no-store');
	ctx.set('X-Robots-Tag', 'noindex, nofollow');
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

function handlePublicLookupError(ctx: any, error: any) {
	applyQuickMessagePublicHeaders(ctx);
	const status = Number(error?.status || 500);
	const code = typeof error?.code === 'string' && error.code.trim() ? error.code.trim() : 'QUICK_MESSAGE_LOOKUP_FAILED';
	const message = typeof error?.message === 'string' && error.message.trim()
		? error.message.trim()
		: 'Không thể tra cứu mã truy cập vào lúc này.';

	if (status === 404 || status === 400 || status === 429 || status === 500) {
		ctx.status = status;
		ctx.body = {
			success: false,
			error: { code, message },
		};
		return;
	}

	ctx.status = status;
	ctx.body = {
		success: false,
		error: { code, message },
	};
	return;
}

export default {
	async listManage(ctx: any) {
		const authUser = await requireAuthenticatedUser(ctx);
		if (!authUser?.id) return;

		try {
			const result = await listQuickMessages(ctx.request?.query || {}, getTenantIdFromContext(ctx));
			ctx.body = { success: true, data: result.data, pagination: result.pagination };
		} catch (error: any) {
			return handleManageError(ctx, error, 'quick-message.manage');
		}
	},

	async detailManage(ctx: any) {
		const authUser = await requireAuthenticatedUser(ctx);
		if (!authUser?.id) return;

		try {
			const data = await getQuickMessageDetail(ctx.params?.id, getTenantIdFromContext(ctx));
			ctx.body = { success: true, data };
		} catch (error: any) {
			return handleManageError(ctx, error, 'quick-message.manage');
		}
	},

	async createManage(ctx: any) {
		const authUser = await requireAuthenticatedUser(ctx);
		if (!authUser?.id) return;

		try {
			const data = await createQuickMessage(ctx.request?.body || {}, getTenantIdFromContext(ctx), authUser);
			ctx.body = { success: true, data };
		} catch (error: any) {
			return handleManageError(ctx, error, 'quick-message.manage');
		}
	},

	async updateManage(ctx: any) {
		const authUser = await requireAuthenticatedUser(ctx);
		if (!authUser?.id) return;

		try {
			const data = await updateQuickMessage(ctx.params?.id, ctx.request?.body || {}, getTenantIdFromContext(ctx), authUser);
			ctx.body = { success: true, data };
		} catch (error: any) {
			return handleManageError(ctx, error, 'quick-message.manage');
		}
	},

	async lockManage(ctx: any) {
		const authUser = await requireAuthenticatedUser(ctx);
		if (!authUser?.id) return;

		try {
			const data = await lockQuickMessage(ctx.params?.id, getTenantIdFromContext(ctx));
			ctx.body = { success: true, data };
		} catch (error: any) {
			return handleManageError(ctx, error, 'quick-message.manage');
		}
	},

	async unlockManage(ctx: any) {
		const authUser = await requireAuthenticatedUser(ctx);
		if (!authUser?.id) return;

		try {
			const data = await unlockQuickMessage(ctx.params?.id, ctx.request?.body || {}, getTenantIdFromContext(ctx));
			ctx.body = { success: true, data };
		} catch (error: any) {
			return handleManageError(ctx, error, 'quick-message.manage');
		}
	},

	async cancelManage(ctx: any) {
		const authUser = await requireAuthenticatedUser(ctx);
		if (!authUser?.id) return;

		try {
			const data = await cancelQuickMessage(ctx.params?.id, getTenantIdFromContext(ctx));
			ctx.body = { success: true, data };
		} catch (error: any) {
			return handleManageError(ctx, error, 'quick-message.manage');
		}
	},

	async createAccessManage(ctx: any) {
		const authUser = await requireAuthenticatedUser(ctx);
		if (!authUser?.id) return;

		try {
			const data = await createQuickMessageAccess(ctx.params?.messageId, ctx.request?.body || {}, getTenantIdFromContext(ctx));
			ctx.body = { success: true, data };
		} catch (error: any) {
			return handleManageError(ctx, error, 'quick-message.manage');
		}
	},

	async cloneAccessBatchManage(ctx: any) {
		const authUser = await requireAuthenticatedUser(ctx);
		if (!authUser?.id) return;

		try {
			const data = await cloneQuickMessageAccessBatch(ctx.params?.id, ctx.request?.body || {}, getTenantIdFromContext(ctx));
			ctx.body = { success: true, data };
		} catch (error: any) {
			return handleManageError(ctx, error, 'quick-message.manage');
		}
	},

	async listRepliesManage(ctx: any) {
		const authUser = await requireAuthenticatedUser(ctx);
		if (!authUser?.id) return;

		try {
			const result = await listQuickMessageReplies(ctx.params?.messageId, ctx.request?.query || {}, getTenantIdFromContext(ctx));
			ctx.body = { success: true, data: result.data, message: result.message, pagination: result.pagination };
		} catch (error: any) {
			return handleManageError(ctx, error, 'quick-message.manage');
		}
	},

	async readAllRepliesManage(ctx: any) {
		const authUser = await requireAuthenticatedUser(ctx);
		if (!authUser?.id) return;

		try {
			const data = await markQuickMessageRepliesReadAll(ctx.params?.messageId, getTenantIdFromContext(ctx));
			ctx.body = { success: true, data };
		} catch (error: any) {
			return handleManageError(ctx, error, 'quick-message.manage');
		}
	},

	async listActivityAccessesManage(ctx: any) {
		const authUser = await requireAuthenticatedUser(ctx);
		if (!authUser?.id) return;

		try {
			const result = await listQuickMessageActivityAccesses(ctx.params?.messageId, ctx.request?.query || {}, getTenantIdFromContext(ctx));
			ctx.body = { success: true, data: result.data, message: result.message, pagination: result.pagination };
		} catch (error: any) {
			return handleManageError(ctx, error, 'quick-message.activity');
		}
	},

	async activityAccessDetailManage(ctx: any) {
		const authUser = await requireAuthenticatedUser(ctx);
		if (!authUser?.id) return;

		try {
			const data = await getQuickMessageActivityAccessDetail(ctx.params?.messageId, ctx.params?.accessId, getTenantIdFromContext(ctx));
			ctx.body = { success: true, data };
		} catch (error: any) {
			return handleManageError(ctx, error, 'quick-message.activity');
		}
	},

	async listActivityMessagesManage(ctx: any) {
		const authUser = await requireAuthenticatedUser(ctx);
		if (!authUser?.id) return;

		try {
			const result = await listQuickMessageActivityMessages(ctx.params?.messageId, ctx.params?.accessId, ctx.request?.query || {}, getTenantIdFromContext(ctx));
			ctx.body = { success: true, data: result.data, pagination: result.pagination };
		} catch (error: any) {
			return handleManageError(ctx, error, 'quick-message.activity');
		}
	},

	async createActivityMessageManage(ctx: any) {
		const authUser = await requireAuthenticatedUser(ctx);
		if (!authUser?.id) return;

		try {
			const data = await createQuickMessageActivityMessage(ctx.params?.messageId, ctx.params?.accessId, ctx.request?.body || {}, getTenantIdFromContext(ctx), authUser);
			ctx.body = { success: true, data };
		} catch (error: any) {
			return handleManageError(ctx, error, 'quick-message.activity');
		}
	},

	async markActivityReadManage(ctx: any) {
		const authUser = await requireAuthenticatedUser(ctx);
		if (!authUser?.id) return;

		try {
			const data = await markQuickMessageActivityRead(ctx.params?.messageId, ctx.params?.accessId, getTenantIdFromContext(ctx));
			ctx.body = { success: true, data };
		} catch (error: any) {
			return handleManageError(ctx, error, 'quick-message.activity');
		}
	},

	async listActivityLogsManage(ctx: any) {
		const authUser = await requireAuthenticatedUser(ctx);
		if (!authUser?.id) return;

		try {
			const result = await listQuickMessageActivityLogs(ctx.params?.messageId, ctx.params?.accessId, ctx.request?.query || {}, getTenantIdFromContext(ctx));
			ctx.body = { success: true, data: result.data, pagination: result.pagination };
		} catch (error: any) {
			return handleManageError(ctx, error, 'quick-message.activity');
		}
	},

	async lookupPublic(ctx: any) {
		applyQuickMessagePublicHeaders(ctx);
		try {
			const data = await lookupQuickMessageAccessPublic(ctx.params?.code);
			ctx.body = { success: true, data };
		} catch (error: any) {
			if (error instanceof QuickMessagePublicError) {
				return handlePublicLookupError(ctx, error);
			}

			strapi.log.error('[quick-message.public.lookup] unexpected error', error);
			return handlePublicLookupError(ctx, new QuickMessagePublicError(500, 'QUICK_MESSAGE_LOOKUP_FAILED', 'Không thể tra cứu mã truy cập vào lúc này.'));
		}
	},

	async verifyPinPublic(ctx: any) {
		applyQuickMessagePublicHeaders(ctx);
		try {
			const data = await verifyQuickMessageAccessPinPublic(ctx.params?.code, extractPayload(ctx));
			ctx.body = { success: true, data };
		} catch (error: any) {
			if (error instanceof QuickMessagePublicError) {
				return handlePublicLookupError(ctx, error);
			}

			strapi.log.error('[quick-message.public.verify-pin] unexpected error', error);
			return handlePublicLookupError(ctx, new QuickMessagePublicError(500, 'QUICK_MESSAGE_VERIFY_FAILED', 'Không thể xác minh mã truy cập vào lúc này.'));
		}
	},

	async accessPublic(ctx: any) {
		applyQuickMessagePublicHeaders(ctx);
		try {
			const data = await createQuickMessageAccessTokenPublic(ctx.params?.code);
			ctx.body = { success: true, data };
		} catch (error: any) {
			if (error instanceof QuickMessagePublicError) {
				return handlePublicLookupError(ctx, error);
			}

			strapi.log.error('[quick-message.public.access] unexpected error', error);
			return handlePublicLookupError(ctx, new QuickMessagePublicError(500, 'QUICK_MESSAGE_ACCESS_FAILED', 'Không thể cấp quyền truy cập vào lúc này.'));
		}
	},

	async openPublic(ctx: any) {
		applyQuickMessagePublicHeaders(ctx);
		try {
			const data = await openQuickMessageContentPublic(
				ctx.params?.code,
				ctx.request?.headers?.authorization || ctx.request?.header?.authorization || '',
			);
			ctx.body = { success: true, data };
		} catch (error: any) {
			if (error instanceof QuickMessagePublicError) {
				return handlePublicLookupError(ctx, error);
			}

			strapi.log.error('[quick-message.public.open] unexpected error', error);
			return handlePublicLookupError(ctx, new QuickMessagePublicError(500, 'QUICK_MESSAGE_OPEN_FAILED', 'Không thể mở thông điệp vào lúc này.'));
		}
	},

	async listMessagesPublic(ctx: any) {
		applyQuickMessagePublicHeaders(ctx);
		try {
			const data = await listQuickMessagePublicMessages(
				ctx.params?.code,
				ctx.request?.headers?.authorization || ctx.request?.header?.authorization || '',
				ctx.request?.query || {},
			);
			ctx.body = { success: true, data };
		} catch (error: any) {
			if (error instanceof QuickMessagePublicError) {
				return handlePublicLookupError(ctx, error);
			}

			strapi.log.error('[quick-message.public.messages.list] unexpected error', error);
			return handlePublicLookupError(ctx, new QuickMessagePublicError(500, 'QUICK_MESSAGE_MESSAGES_FAILED', 'Không thể tải trao đổi vào lúc này.'));
		}
	},

	async createMessagePublic(ctx: any) {
		applyQuickMessagePublicHeaders(ctx);
		try {
			const data = await sendQuickMessagePublicReply(
				ctx.params?.code,
				ctx.request?.headers?.authorization || ctx.request?.header?.authorization || '',
				extractPayload(ctx),
				{
					ipAddress: ctx.request?.ip || ctx.ip || '',
					userAgent: ctx.request?.headers?.['user-agent'] || '',
				},
			);
			ctx.body = { success: true, data };
		} catch (error: any) {
			if (error instanceof QuickMessagePublicError) {
				return handlePublicLookupError(ctx, error);
			}

			strapi.log.error('[quick-message.public.messages.create] unexpected error', error);
			return handlePublicLookupError(ctx, new QuickMessagePublicError(500, 'QUICK_MESSAGE_REPLY_FAILED', 'Không thể gửi phản hồi vào lúc này.'));
		}
	},

	async markMessagesReadPublic(ctx: any) {
		applyQuickMessagePublicHeaders(ctx);
		try {
			const data = await markQuickMessagePublicMessagesRead(
				ctx.params?.code,
				ctx.request?.headers?.authorization || ctx.request?.header?.authorization || '',
			);
			ctx.body = { success: true, data };
		} catch (error: any) {
			if (error instanceof QuickMessagePublicError) {
				return handlePublicLookupError(ctx, error);
			}

			strapi.log.error('[quick-message.public.messages.read] unexpected error', error);
			return handlePublicLookupError(ctx, new QuickMessagePublicError(500, 'QUICK_MESSAGE_MESSAGES_READ_FAILED', 'Không thể cập nhật trạng thái đọc vào lúc này.'));
		}
	},
};