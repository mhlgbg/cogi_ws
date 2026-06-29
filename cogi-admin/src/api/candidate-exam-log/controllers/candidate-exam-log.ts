import { factories } from '@strapi/strapi';
import { resolveCurrentTenantId } from '../../../utils/tenant-scope';
import {
	createCandidateExamLog,
	getCandidateExamLogDetail,
	listCandidateExamLogs,
	restoreCandidateExamLog,
	softDeleteCandidateExamLog,
	updateCandidateExamLog,
} from '../services/candidate-exam-log';

const CANDIDATE_EXAM_LOG_UID = 'api::candidate-exam-log.candidate-exam-log';

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

export default factories.createCoreController(CANDIDATE_EXAM_LOG_UID, () => ({
	async find(ctx) {
		const tenantId = resolveCurrentTenantId(ctx);
		const result = await listCandidateExamLogs(ctx.query || {}, tenantId);
		ctx.body = {
			success: true,
			data: result.rows,
			pagination: result.pagination,
		};
	},

	async findOne(ctx) {
		const tenantId = resolveCurrentTenantId(ctx);
		const entity = await getCandidateExamLogDetail(ctx.params?.id, tenantId, { includeDeleted: true });
		if (!entity) return ctx.notFound('CandidateExamLog not found');
		ctx.body = { success: true, data: entity };
	},

	async create(ctx) {
		const tenantId = resolveCurrentTenantId(ctx);
		const entity = await createCandidateExamLog(extractPayload(ctx), tenantId, resolveActorUserId(ctx));
		ctx.body = { success: true, data: entity };
	},

	async update(ctx) {
		const tenantId = resolveCurrentTenantId(ctx);
		const entity = await updateCandidateExamLog(ctx.params?.id, extractPayload(ctx), tenantId, resolveActorUserId(ctx));
		ctx.body = { success: true, data: entity };
	},

	async delete(ctx) {
		const tenantId = resolveCurrentTenantId(ctx);
		const body = extractPayload(ctx);
		const entity = await softDeleteCandidateExamLog(ctx.params?.id, tenantId, resolveActorUserId(ctx), String(body.reason || '').trim() || null);
		ctx.body = { success: true, data: entity };
	},

	async restore(ctx) {
		const tenantId = resolveCurrentTenantId(ctx);
		const body = extractPayload(ctx);
		const entity = await restoreCandidateExamLog(ctx.params?.id, tenantId, resolveActorUserId(ctx), String(body.reason || '').trim() || null);
		ctx.body = { success: true, data: entity };
	},
}));