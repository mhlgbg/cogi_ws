import { factories } from '@strapi/strapi';
import { resolveCurrentTenantId, toText } from '../../../utils/tenant-scope';
import {
	confirmCandidateExamImport,
	createCandidateExam,
	exportCandidateExams,
	confirmCandidateExamScoreImport,
	confirmCandidateExamRecheckImport,
	renderCandidateExamExamCard,
	getCandidateExamCardReminderSummary,
	getCandidateExamAdmissionSeasons,
	getCandidateExamDetail,
	getCandidateExamImportTemplate,
	getCandidateExamLogs,
	getCandidateExamScoreImportTemplate,
	getCandidateExamRecheckImportTemplate,
	listCandidateExams,
	normalizeCandidateExamRow,
	previewCandidateExamImport,
	restoreCandidateExam,
	previewCandidateExamScoreImport,
	previewCandidateExamRecheckImport,
	sendCandidateExamCardRemindersDirect,
	softDeleteCandidateExam,
	updateCandidateExam,
} from '../services/candidate-exam';

const CANDIDATE_EXAM_UID = 'api::candidate-exam.candidate-exam';

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

function resolveActorUserId(ctx: any): number | null {
	const userId = Number(ctx.state?.user?.id || 0);
	return Number.isInteger(userId) && userId > 0 ? userId : null;
}

function flattenUploadedFiles(value: unknown): any[] {
	if (!value) return [];
	if (Array.isArray(value)) {
		return value.flatMap((entry) => flattenUploadedFiles(entry));
	}
	if (
		typeof value === 'object'
		&& value
		&& (
			(value as Record<string, unknown>).filepath
			|| (value as Record<string, unknown>).path
			|| (value as Record<string, unknown>).tempFilePath
		)
	) {
		return [value];
	}
	if (typeof value === 'object') {
		return Object.values(value as Record<string, unknown>).flatMap((entry) => flattenUploadedFiles(entry));
	}
	return [];
}

function extractFirstUploadedFile(ctx: any) {
	return flattenUploadedFiles(ctx.request?.files)[0] || null;
}

type AuthUser = {
	id: number;
	username?: string | null;
	email?: string | null;
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
		const userId = Number(decoded?.id);
		if (!Number.isInteger(userId) || userId <= 0) return null;

		return strapi.db.query('plugin::users-permissions.user').findOne({
			where: { id: userId },
			select: ['id', 'username', 'email', 'blocked'],
		});
	} catch {
		return null;
	}
}

async function requireAuthenticatedUser(ctx: any): Promise<AuthUser | null> {
	let authUser = ctx.state?.user as AuthUser | undefined;
	if (!authUser?.id) {
		authUser = await resolveUserFromJwt(ctx) || undefined;
		if (authUser?.id) ctx.state.user = authUser;
	}
	if (!authUser?.id) {
		ctx.unauthorized('Unauthorized');
		return null;
	}

	if (authUser?.blocked) {
		ctx.unauthorized('Account is blocked');
		return null;
	}

	return authUser;
}

function handleError(ctx: any, error: any) {
	const status = Number(error?.status || 500);
	const message = typeof error?.message === 'string' && error.message.trim()
		? error.message.trim()
		: 'Unexpected candidate exam error';

	if (status === 400) return ctx.badRequest(message);
	if (status === 401) return ctx.unauthorized(message);
	if (status === 403) return ctx.forbidden(message);
	if (status === 404) return ctx.notFound(message);
	if (status === 409) return ctx.conflict(message);

	strapi.log.error('[candidate-exam] unexpected error', error);
	return ctx.internalServerError(message);
}

export default factories.createCoreController(CANDIDATE_EXAM_UID, () => ({
	async admissionSeasons(ctx) {
		const authUser = await requireAuthenticatedUser(ctx);
		if (!authUser?.id) return;

		try {
			const tenantId = resolveCurrentTenantId(ctx);
			const data = await getCandidateExamAdmissionSeasons(tenantId);
			ctx.body = { success: true, data };
		} catch (error: any) {
			return handleError(ctx, error);
		}
	},

	async importTemplate(ctx) {
		const authUser = await requireAuthenticatedUser(ctx);
		if (!authUser?.id) return;

		try {
			const template = await getCandidateExamImportTemplate();
			ctx.set('Content-Type', template.contentType);
			ctx.set('Content-Disposition', `attachment; filename="${template.fileName}"`);
			ctx.body = template.buffer;
		} catch (error: any) {
			return handleError(ctx, error);
		}
	},

	async scoreImportTemplate(ctx) {
		const authUser = await requireAuthenticatedUser(ctx);
		if (!authUser?.id) return;

		try {
			const template = await getCandidateExamScoreImportTemplate();
			ctx.set('Content-Type', template.contentType);
			ctx.set('Content-Disposition', `attachment; filename="${template.fileName}"`);
			ctx.body = template.buffer;
		} catch (error: any) {
			return handleError(ctx, error);
		}
	},

	async importPreview(ctx) {
		const authUser = await requireAuthenticatedUser(ctx);
		if (!authUser?.id) return;

		try {
			const tenantId = resolveCurrentTenantId(ctx);
			const file = extractFirstUploadedFile(ctx);
			if (!file) return ctx.badRequest('File Excel is required');
			const data = await previewCandidateExamImport(file, extractPayload(ctx), tenantId);
			ctx.body = { success: true, data };
		} catch (error: any) {
			return handleError(ctx, error);
		}
	},

	async scoreImportPreview(ctx) {
		const authUser = await requireAuthenticatedUser(ctx);
		if (!authUser?.id) return;

		try {
			const tenantId = resolveCurrentTenantId(ctx);
			const file = extractFirstUploadedFile(ctx);
			if (!file) return ctx.badRequest('File Excel is required');
			const data = await previewCandidateExamScoreImport(file, extractPayload(ctx), tenantId);
			ctx.body = { success: true, data };
		} catch (error: any) {
			return handleError(ctx, error);
		}
	},

	async importConfirm(ctx) {
		const authUser = await requireAuthenticatedUser(ctx);
		if (!authUser?.id) return;

		try {
			const tenantId = resolveCurrentTenantId(ctx);
			const file = extractFirstUploadedFile(ctx);
			if (!file) return ctx.badRequest('File Excel is required');
			const data = await confirmCandidateExamImport(file, extractPayload(ctx), tenantId, resolveActorUserId(ctx));
			ctx.body = { success: true, data };
		} catch (error: any) {
			return handleError(ctx, error);
		}
	},

	async scoreImportConfirm(ctx) {
		const authUser = await requireAuthenticatedUser(ctx);
		if (!authUser?.id) return;

		try {
			const tenantId = resolveCurrentTenantId(ctx);
			const file = extractFirstUploadedFile(ctx);
			if (!file) return ctx.badRequest('File Excel is required');
			const data = await confirmCandidateExamScoreImport(file, extractPayload(ctx), tenantId, resolveActorUserId(ctx));
			ctx.body = { success: true, data };
		} catch (error: any) {
			return handleError(ctx, error);
		}
	},

	async recheckImportTemplate(ctx) {
		const authUser = await requireAuthenticatedUser(ctx);
		if (!authUser?.id) return;

		try {
			const template = await getCandidateExamRecheckImportTemplate();
			ctx.set('Content-Type', template.contentType);
			ctx.set('Content-Disposition', `attachment; filename="${template.fileName}"`);
			ctx.body = template.buffer;
		} catch (error: any) {
			return handleError(ctx, error);
		}
	},

	async recheckImportPreview(ctx) {
		const authUser = await requireAuthenticatedUser(ctx);
		if (!authUser?.id) return;

		try {
			const tenantId = resolveCurrentTenantId(ctx);
			const file = extractFirstUploadedFile(ctx);
			if (!file) return ctx.badRequest('File Excel is required');
			const data = await previewCandidateExamRecheckImport(file, extractPayload(ctx), tenantId);
			ctx.body = { success: true, data };
		} catch (error: any) {
			return handleError(ctx, error);
		}
	},

	async recheckImportConfirm(ctx) {
		const authUser = await requireAuthenticatedUser(ctx);
		if (!authUser?.id) return;

		try {
			const tenantId = resolveCurrentTenantId(ctx);
			const file = extractFirstUploadedFile(ctx);
			if (!file) return ctx.badRequest('File Excel is required');
			const data = await confirmCandidateExamRecheckImport(file, extractPayload(ctx), tenantId, resolveActorUserId(ctx));
			ctx.body = { success: true, data };
		} catch (error: any) {
			return handleError(ctx, error);
		}
	},

	async find(ctx) {
		const authUser = await requireAuthenticatedUser(ctx);
		if (!authUser?.id) return;

		try {
			const tenantId = resolveCurrentTenantId(ctx);
			const result = await listCandidateExams(ctx.query || {}, tenantId);
			ctx.body = {
				success: true,
				data: result,
			};
		} catch (error: any) {
			return handleError(ctx, error);
		}
	},

	async export(ctx) {
		const authUser = await requireAuthenticatedUser(ctx);
		if (!authUser?.id) return;

		try {
			const tenantId = resolveCurrentTenantId(ctx);
			const result = await exportCandidateExams(ctx.query || {}, tenantId);
			ctx.set('Content-Type', result.contentType);
			ctx.set('Content-Disposition', `attachment; filename="${result.fileName}"`);
			ctx.body = result.buffer;
		} catch (error: any) {
			return handleError(ctx, error);
		}
	},

	async cardReminderSummary(ctx) {
		const authUser = await requireAuthenticatedUser(ctx);
		if (!authUser?.id) return;

		try {
			const tenantId = resolveCurrentTenantId(ctx);
			const data = await getCandidateExamCardReminderSummary(ctx.query || {}, tenantId);
			ctx.body = { success: true, data };
		} catch (error: any) {
			return handleError(ctx, error);
		}
	},

	async findOne(ctx) {
		const authUser = await requireAuthenticatedUser(ctx);
		if (!authUser?.id) return;

		try {
			const tenantId = resolveCurrentTenantId(ctx);
			const entity = await getCandidateExamDetail(ctx.params?.id, tenantId, { includeDeleted: true });
			if (!entity) return ctx.notFound('CandidateExam not found');
			ctx.body = { success: true, data: normalizeCandidateExamRow(entity) };
		} catch (error: any) {
			return handleError(ctx, error);
		}
	},

	async examCard(ctx) {
		const authUser = await requireAuthenticatedUser(ctx);
		if (!authUser?.id) return;

		try {
			const tenantId = resolveCurrentTenantId(ctx);
			const data = await renderCandidateExamExamCard(ctx.params?.id, tenantId, {
				userId: resolveActorUserId(ctx),
				ip: toText(ctx.request?.ip || ctx.ip || ''),
				userAgent: toText(ctx.request?.headers?.['user-agent'] || ''),
				assetBaseUrl: toText(ctx.request?.origin || ''),
				refererUrl: toText(ctx.request?.headers?.referer || ''),
			});
			ctx.body = { success: true, data };
		} catch (error: any) {
			return handleError(ctx, error);
		}
	},

	async logs(ctx) {
		const authUser = await requireAuthenticatedUser(ctx);
		if (!authUser?.id) return;

		try {
			const tenantId = resolveCurrentTenantId(ctx);
			const data = await getCandidateExamLogs(ctx.params?.id, tenantId, ctx.query || {});
			ctx.body = { success: true, data };
		} catch (error: any) {
			return handleError(ctx, error);
		}
	},

	async create(ctx) {
		const authUser = await requireAuthenticatedUser(ctx);
		if (!authUser?.id) return;

		try {
			const tenantId = resolveCurrentTenantId(ctx);
			const entity = await createCandidateExam(extractPayload(ctx), tenantId, resolveActorUserId(ctx));
			ctx.body = { success: true, data: entity };
		} catch (error: any) {
			return handleError(ctx, error);
		}
	},

	async update(ctx) {
		const authUser = await requireAuthenticatedUser(ctx);
		if (!authUser?.id) return;

		try {
			const tenantId = resolveCurrentTenantId(ctx);
			const entity = await updateCandidateExam(ctx.params?.id, extractPayload(ctx), tenantId, resolveActorUserId(ctx));
			ctx.body = { success: true, data: entity };
		} catch (error: any) {
			return handleError(ctx, error);
		}
	},

	async sendCardRemindersDirect(ctx) {
		const authUser = await requireAuthenticatedUser(ctx);
		if (!authUser?.id) return;

		try {
			const tenantId = resolveCurrentTenantId(ctx);
			const data = await sendCandidateExamCardRemindersDirect(extractPayload(ctx), tenantId, resolveActorUserId(ctx));
			ctx.body = { success: true, data };
		} catch (error: any) {
			return handleError(ctx, error);
		}
	},

	async delete(ctx) {
		const authUser = await requireAuthenticatedUser(ctx);
		if (!authUser?.id) return;

		try {
			const tenantId = resolveCurrentTenantId(ctx);
			const body = extractPayload(ctx);
			const entity = await softDeleteCandidateExam(ctx.params?.id, tenantId, resolveActorUserId(ctx), String(body.reason || '').trim() || null);
			ctx.body = { success: true, data: entity };
		} catch (error: any) {
			return handleError(ctx, error);
		}
	},

	async restore(ctx) {
		const authUser = await requireAuthenticatedUser(ctx);
		if (!authUser?.id) return;

		try {
			const tenantId = resolveCurrentTenantId(ctx);
			const body = extractPayload(ctx);
			const entity = await restoreCandidateExam(ctx.params?.id, tenantId, resolveActorUserId(ctx), String(body.reason || '').trim() || null);
			ctx.body = { success: true, data: entity };
		} catch (error: any) {
			return handleError(ctx, error);
		}
	},
}));