/**
 * candidate-exam-log service.
 */

import { factories } from '@strapi/strapi';
import { buildRestoreData, buildSoftDeleteData, mergeTenantSoftDeleteWhere } from '../../../utils/soft-delete';
import { normalizeSortInput, parseOptionalPositiveInt, toPositiveInt, toText, whereByParam } from '../../../utils/tenant-scope';

const CANDIDATE_EXAM_LOG_UID = 'api::candidate-exam-log.candidate-exam-log';

const CANDIDATE_EXAM_LOG_POPULATE = {
	tenant: {
		select: ['id', 'name', 'code'],
	},
	admissionSeason: {
		select: ['id', 'name', 'code'],
	},
	candidateExam: {
		select: ['id', 'applicationCode', 'studentCode', 'fullName', 'candidateNumber', 'candidateExamStatus'],
	},
	admissionApplication: {
		select: ['id', 'applicationCode', 'studentCode', 'studentName', 'admissionStatus'],
	},
	actionBy: {
		select: ['id', 'username', 'email', 'fullName'],
	},
	deletedBy: {
		select: ['id', 'username', 'email', 'fullName'],
	},
	restoredBy: {
		select: ['id', 'username', 'email', 'fullName'],
	},
};

function resolveSortOrder(query: Record<string, unknown>) {
	const normalizedSort = normalizeSortInput(query?.sort);
	if (normalizedSort.length > 0) return normalizedSort;

	const sortBy = toText(query?.sortBy);
	if (!sortBy) {
		return [{ actionAt: 'desc' }, { id: 'desc' }] as Array<Record<string, 'asc' | 'desc'>>;
	}

	return [
		{ [sortBy]: toText(query?.sortOrder).toLowerCase() === 'asc' ? 'asc' : 'desc' } as Record<string, 'asc' | 'desc'>,
		{ id: 'desc' },
	];
}

function buildBaseWhere(query: Record<string, unknown>) {
	const whereClauses: Array<Record<string, unknown>> = [];
	const action = toText(query?.action).toLowerCase();
	const actorType = toText(query?.actorType).toLowerCase();
	const candidateExamId = parseOptionalPositiveInt(query?.candidateExamId ?? query?.candidateExam);
	const admissionSeasonId = parseOptionalPositiveInt(query?.admissionSeasonId ?? query?.admissionSeason);
	const admissionApplicationId = parseOptionalPositiveInt(query?.admissionApplicationId ?? query?.admissionApplication);

	if (action && action !== 'all') {
		whereClauses.push({ action: { $eq: action } });
	}
	if (actorType && actorType !== 'all') {
		whereClauses.push({ actorType: { $eq: actorType } });
	}
	if (candidateExamId) {
		whereClauses.push({ candidateExam: { id: { $eq: candidateExamId } } });
	}
	if (admissionSeasonId) {
		whereClauses.push({ admissionSeason: { id: { $eq: admissionSeasonId } } });
	}
	if (admissionApplicationId) {
		whereClauses.push({ admissionApplication: { id: { $eq: admissionApplicationId } } });
	}

	if (whereClauses.length === 0) return {};
	if (whereClauses.length === 1) return whereClauses[0];
	return { $and: whereClauses };
}

export async function listCandidateExamLogs(query: Record<string, unknown> = {}, tenantId: number | string) {
	const page = toPositiveInt(query?.page, 1);
	const pageSize = Math.min(100, toPositiveInt(query?.pageSize, 20));
	const where = mergeTenantSoftDeleteWhere(buildBaseWhere(query), tenantId, query);

	const [rows, total] = await Promise.all([
		strapi.db.query(CANDIDATE_EXAM_LOG_UID).findMany({
			where,
			populate: CANDIDATE_EXAM_LOG_POPULATE,
			orderBy: resolveSortOrder(query),
			offset: (page - 1) * pageSize,
			limit: pageSize,
		}),
		strapi.db.query(CANDIDATE_EXAM_LOG_UID).count({ where }),
	]);

	return {
		rows,
		pagination: {
			page,
			pageSize,
			total,
			pageCount: Math.max(1, Math.ceil(total / pageSize)),
		},
	};
}

export async function getCandidateExamLogDetail(idParam: unknown, tenantId: number | string, options: { includeDeleted?: boolean } = {}) {
	const where = whereByParam(idParam);
	if (!where) return null;

	return strapi.db.query(CANDIDATE_EXAM_LOG_UID).findOne({
		where: mergeTenantSoftDeleteWhere(where, tenantId, options),
		populate: CANDIDATE_EXAM_LOG_POPULATE,
	});
}

export async function createCandidateExamLogEntry(payload: Record<string, unknown>) {
	return strapi.db.query(CANDIDATE_EXAM_LOG_UID).create({
		data: {
			...(payload || {}),
			actionAt: String(payload?.actionAt || new Date().toISOString()),
			actorType: String(payload?.actorType || 'system').trim().toLowerCase(),
		},
		populate: CANDIDATE_EXAM_LOG_POPULATE,
	});
}

export async function createCandidateExamLog(payload: Record<string, unknown>, tenantId: number | string, userId?: number | null) {
	return createCandidateExamLogEntry({
		...(payload || {}),
		tenant: tenantId,
		actionBy: payload?.actionBy ?? userId ?? null,
		actorType: payload?.actorType ?? (userId ? 'staff' : 'system'),
	});
}

export async function updateCandidateExamLog(idParam: unknown, payload: Record<string, unknown>, tenantId: number | string, userId?: number | null) {
	const where = whereByParam(idParam);
	if (!where) {
		const error = new Error('CandidateExamLog not found') as Error & { status?: number };
		error.status = 404;
		throw error;
	}

	const existing = await getCandidateExamLogDetail(idParam, tenantId, { includeDeleted: true });
	if (!existing) {
		const error = new Error('CandidateExamLog not found') as Error & { status?: number };
		error.status = 404;
		throw error;
	}

	return strapi.db.query(CANDIDATE_EXAM_LOG_UID).update({
		where,
		data: {
			...(payload || {}),
			actionBy: payload?.actionBy ?? userId ?? existing?.actionBy?.id ?? existing?.actionBy ?? null,
		},
		populate: CANDIDATE_EXAM_LOG_POPULATE,
	});
}

export async function softDeleteCandidateExamLog(idParam: unknown, tenantId: number | string, userId?: number | null, reason?: string | null) {
	const where = whereByParam(idParam);
	if (!where) {
		const error = new Error('CandidateExamLog not found') as Error & { status?: number };
		error.status = 404;
		throw error;
	}

	const existing = await getCandidateExamLogDetail(idParam, tenantId, { includeDeleted: true });
	if (!existing) {
		const error = new Error('CandidateExamLog not found') as Error & { status?: number };
		error.status = 404;
		throw error;
	}

	return strapi.db.query(CANDIDATE_EXAM_LOG_UID).update({
		where,
		data: {
			...buildSoftDeleteData(userId),
			deleteReason: reason || null,
		},
		populate: CANDIDATE_EXAM_LOG_POPULATE,
	});
}

export async function restoreCandidateExamLog(idParam: unknown, tenantId: number | string, userId?: number | null, reason?: string | null) {
	const where = whereByParam(idParam);
	if (!where) {
		const error = new Error('CandidateExamLog not found') as Error & { status?: number };
		error.status = 404;
		throw error;
	}

	const existing = await getCandidateExamLogDetail(idParam, tenantId, { includeDeleted: true });
	if (!existing) {
		const error = new Error('CandidateExamLog not found') as Error & { status?: number };
		error.status = 404;
		throw error;
	}

	return strapi.db.query(CANDIDATE_EXAM_LOG_UID).update({
		where,
		data: {
			...buildRestoreData(),
			restoredAt: new Date().toISOString(),
			restoredBy: userId || null,
			restoreReason: reason || null,
		},
		populate: CANDIDATE_EXAM_LOG_POPULATE,
	});
}

export default factories.createCoreService(CANDIDATE_EXAM_LOG_UID);