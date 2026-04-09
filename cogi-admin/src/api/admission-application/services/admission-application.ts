/**
 * admission-application service.
 */

import { factories } from '@strapi/strapi';
import { mergeTenantWhere, toText } from '../../../utils/tenant-scope';

const ADMISSION_APPLICATION_UID = 'api::admission-application.admission-application';

function toPositiveInt(value: unknown, fallback: number) {
	const parsed = Number(value);
	return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

export function getEffectiveReviewStatus(row: any): 'submitted' | 'returned' | 'accepted' | null {
	const normalizedReviewStatus = String(row?.reviewStatus || '').trim().toLowerCase();
	if (normalizedReviewStatus === 'submitted' || normalizedReviewStatus === 'returned' || normalizedReviewStatus === 'accepted') {
		return normalizedReviewStatus;
	}

	const normalizedStatus = String(row?.admissionStatus || row?.status || '').trim().toLowerCase();
	if (normalizedStatus === 'submitted') return 'submitted';
	if (normalizedStatus === 'rejected') return 'returned';
	if (['approved', 'reviewing', 'exam_scheduled', 'passed', 'failed', 'enrolled'].includes(normalizedStatus)) {
		return 'accepted';
	}

	return null;
}

function buildReviewStatusWhere(status: string) {
	const normalized = String(status || '').trim().toLowerCase();

	if (normalized === 'submitted') {
		return {
			$or: [
				{ reviewStatus: 'submitted' },
				{ reviewStatus: { $null: true }, admissionStatus: 'submitted' },
			],
		};
	}

	if (normalized === 'returned') {
		return {
			$or: [
				{ reviewStatus: 'returned' },
				{ reviewStatus: { $null: true }, admissionStatus: 'rejected' },
			],
		};
	}

	if (normalized === 'accepted') {
		return {
			$or: [
				{ reviewStatus: 'accepted' },
				{
					reviewStatus: { $null: true },
					admissionStatus: { $in: ['approved', 'reviewing', 'exam_scheduled', 'passed', 'failed', 'enrolled'] },
				},
			],
		};
	}

	return null;
}

function buildReviewSearchWhere(keyword: string) {
	const q = toText(keyword);
	if (!q) return null;

	return {
		$or: [
			{ applicationCode: { $containsi: q } },
			{ studentName: { $containsi: q } },
			{ parent: { fullName: { $containsi: q } } },
			{ parent: { username: { $containsi: q } } },
			{ parent: { email: { $containsi: q } } },
			{ parent: { phone: { $containsi: q } } },
		],
	};
}

export async function listReviewApplications(query: Record<string, unknown>, tenantId: number | string) {
	const page = toPositiveInt(query?.page, 1);
	const pageSize = toPositiveInt(query?.pageSize, 10);
	const status = toText(query?.status || 'submitted').toLowerCase() || 'submitted';
	const whereParts: Array<Record<string, unknown>> = [];

	const statusWhere = buildReviewStatusWhere(status);
	if (statusWhere) whereParts.push(statusWhere);

	const searchWhere = buildReviewSearchWhere(String(query?.q || query?.keyword || ''));
	if (searchWhere) whereParts.push(searchWhere);

	const where = mergeTenantWhere(whereParts.length > 0 ? { $and: whereParts } : {}, tenantId);

	const [rows, total] = await strapi.db.query(ADMISSION_APPLICATION_UID).findWithCount({
		where,
		offset: (page - 1) * pageSize,
		limit: pageSize,
		orderBy: [{ submittedAt: 'desc' }, { createdAt: 'desc' }],
		select: ['id', 'applicationCode', 'studentName', 'admissionStatus', 'reviewStatus', 'createdAt', 'submittedAt', 'reviewedAt', 'reviewNote'],
		populate: {
			parent: {
				select: ['id', 'username', 'email', 'fullName', 'phone'],
			},
			reviewedBy: {
				select: ['id', 'username', 'email', 'fullName'],
			},
			campaign: {
				select: ['id', 'name', 'code'],
			},
		},
	});

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

export async function getReviewApplicationDetail(applicationId: unknown, tenantId: number | string) {
	const id = toPositiveInt(applicationId, 0);
	if (!id) {
		const error = new Error('Admission application id is invalid') as Error & { status?: number };
		error.status = 400;
		throw error;
	}

	const row = await strapi.db.query(ADMISSION_APPLICATION_UID).findOne({
		where: mergeTenantWhere({ id }, tenantId),
		populate: {
			parent: {
				select: ['id', 'username', 'email', 'fullName', 'phone'],
			},
			reviewedBy: {
				select: ['id', 'username', 'email', 'fullName'],
			},
			campaign: {
				select: ['id', 'name', 'code', 'campaignStatus', 'startDate', 'endDate', 'formTemplateVersion'],
				populate: {
					formTemplate: {
						select: ['id', 'name', 'version', 'schema', 'formTemplateStatus', 'isLocked'],
					},
				},
			},
		},
	});

	if (!row?.id) {
		const error = new Error('Admission application not found') as Error & { status?: number };
		error.status = 404;
		throw error;
	}

	return row;
}

export async function reviewApplicationDecision(
	applicationId: unknown,
	payload: Record<string, unknown>,
	reviewerId: number,
	tenantId: number | string,
) {
	const existing = await getReviewApplicationDetail(applicationId, tenantId);
	const currentStatus = getEffectiveReviewStatus(existing);

	if (currentStatus !== 'submitted') {
		const error = new Error('Chỉ hồ sơ đang chờ duyệt mới được xử lý') as Error & { status?: number };
		error.status = 409;
		throw error;
	}

	const action = toText(payload?.action).toLowerCase();
	if (action !== 'returned' && action !== 'accepted') {
		const error = new Error('action is invalid') as Error & { status?: number };
		error.status = 400;
		throw error;
	}

	const reviewNote = toText(payload?.reviewNote) || null;
	if (action === 'returned' && !reviewNote) {
		const error = new Error('Vui lòng nhập lý do trả lại hồ sơ') as Error & { status?: number };
		error.status = 400;
		throw error;
	}

	return strapi.entityService.update(ADMISSION_APPLICATION_UID, existing.id, {
		data: {
			reviewStatus: action,
			reviewedBy: reviewerId,
			reviewedAt: new Date().toISOString(),
			reviewNote,
			admissionStatus: action === 'returned' ? 'rejected' : 'approved',
		} as any,
		populate: {
			parent: {
				fields: ['id', 'username', 'email', 'fullName', 'phone'],
			},
			reviewedBy: {
				fields: ['id', 'username', 'email', 'fullName'],
			},
			campaign: {
				populate: {
					formTemplate: true,
				},
			},
		},
	});
}

export default factories.createCoreService('api::admission-application.admission-application');