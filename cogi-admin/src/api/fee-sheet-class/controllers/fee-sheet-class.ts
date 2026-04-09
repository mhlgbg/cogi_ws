import { factories } from '@strapi/strapi';
import {
	mergeTenantWhere,
	resolveCurrentTenantId,
	toPositiveInt,
	toText,
	whereByParam,
} from '../../../utils/tenant-scope';

const FEE_SHEET_CLASS_UID = 'api::fee-sheet-class.fee-sheet-class';
const FEE_ITEM_UID = 'api::fee-item.fee-item';

type GenericRecord = Record<string, unknown>;

async function resolveUserFromJwt(ctx: any) {
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
			select: ['id', 'username', 'email', 'blocked', 'fullName'],
		});
	} catch {
		return null;
	}
}

async function requireAuthenticatedUser(ctx: any) {
	let authUser = ctx.state?.user;
	if (!authUser?.id) {
		authUser = await resolveUserFromJwt(ctx);
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

function resolveRequestData(ctx: any): GenericRecord {
	const body = (ctx.request.body ??= {});
	if (!body.data || typeof body.data !== 'object' || Array.isArray(body.data)) {
		body.data = {};
	}

	return body.data as GenericRecord;
}

function toDecimal(value: unknown, fallback = 0) {
	const parsed = Number(value);
	return Number.isFinite(parsed) ? parsed : fallback;
}

function mapFeeItemRow(row: any) {
	const quantity = Number(row.sessions || 0);
	const feeItemPaymentStatus = row.feeItemPaymentStatus || row.status || 'unpaid';
	return {
		id: row.id,
		learnerCodeSnapshot: row.learnerCodeSnapshot || row.learner?.code || '',
		learnerNameSnapshot: row.learnerNameSnapshot || row.learner?.fullName || '',
		quantity,
		sessions: quantity,
		unitPrice: Number(row.unitPrice || 0),
		discountPercent: Number(row.discountPercent || 0),
		discountAmount: Number(row.discountAmount || 0),
		amount: Number(row.amount || 0),
		paidAmount: Number(row.paidAmount || 0),
		feeItemPaymentStatus,
		status: feeItemPaymentStatus,
		note: row.note || '',
		updatedAt: row.updatedAt || null,
	};
}

function computeCanEdit(feeSheetClass: any) {
	const feeSheetStatus = toText(feeSheetClass?.feeSheet?.feeSheetStatus || feeSheetClass?.feeSheet?.status).toLowerCase();
	const classStatus = toText(feeSheetClass?.feeSheetClassStatus || feeSheetClass?.status).toLowerCase();
	return classStatus === 'draft' && feeSheetStatus !== 'approved';
}

function normalizeMineRow(row: any) {
	const canEdit = computeCanEdit(row);
	const feeSheetClassStatus = row.feeSheetClassStatus || row.status || 'draft';
	return {
		id: row.id,
		feeSheetClassStatus,
		status: feeSheetClassStatus,
		classNameSnapshot: row.classNameSnapshot || row.class?.name || '',
		teacherNameSnapshot: row.teacherNameSnapshot || row.teacher?.fullName || row.teacher?.username || '',
		updatedAt: row.updatedAt || null,
		canEdit,
		feeItemsCount: Array.isArray(row.feeItems) ? row.feeItems.length : 0,
		feeSheet: row.feeSheet
			? {
				id: row.feeSheet.id,
				name: row.feeSheet.name || '',
				fromDate: row.feeSheet.fromDate || null,
				toDate: row.feeSheet.toDate || null,
				feeSheetStatus: row.feeSheet.feeSheetStatus || row.feeSheet.status || 'draft',
				status: row.feeSheet.feeSheetStatus || row.feeSheet.status || 'draft',
				note: row.feeSheet.note || '',
			}
			: null,
		feeItems: Array.isArray(row.feeItems) ? row.feeItems.map(mapFeeItemRow) : [],
	};
}

function normalizeAdminRow(row: any) {
	const feeSheetClassStatus = row.feeSheetClassStatus || row.status || 'draft';
	return {
		id: row.id,
		feeSheetClassStatus,
		status: feeSheetClassStatus,
		classNameSnapshot: row.classNameSnapshot || row.class?.name || '',
		teacherNameSnapshot: row.teacherNameSnapshot || row.teacher?.fullName || row.teacher?.username || '',
		updatedAt: row.updatedAt || null,
		feeItemsCount: Array.isArray(row.feeItems) ? row.feeItems.length : 0,
		feeSheet: row.feeSheet
			? {
				id: row.feeSheet.id,
				name: row.feeSheet.name || '',
				fromDate: row.feeSheet.fromDate || null,
				toDate: row.feeSheet.toDate || null,
				feeSheetStatus: row.feeSheet.feeSheetStatus || row.feeSheet.status || 'draft',
				status: row.feeSheet.feeSheetStatus || row.feeSheet.status || 'draft',
				note: row.feeSheet.note || '',
			}
			: null,
		feeItems: Array.isArray(row.feeItems) ? row.feeItems.map(mapFeeItemRow) : [],
	};
}

async function findFeeSheetClassOrThrow(idParam: unknown, tenantId: number | string) {
	const entity = await strapi.db.query(FEE_SHEET_CLASS_UID).findOne({
		where: mergeTenantWhere(whereByParam(idParam), tenantId),
		populate: {
			feeSheet: {
				select: ['id', 'name', 'fromDate', 'toDate', 'feeSheetStatus', 'note'],
			},
			class: {
				select: ['id', 'name', 'subject', 'subjectCode'],
			},
			teacher: {
				select: ['id', 'username', 'email', 'fullName'],
			},
			feeItems: {
				orderBy: [{ learnerCodeSnapshot: 'asc' }, { id: 'asc' }],
				populate: {
					learner: {
						select: ['id', 'code', 'fullName'],
					},
				},
			},
		},
	});

	if (!entity) throw new Error('Fee sheet class not found');
	return entity;
}

async function findMineFeeSheetClassOrThrow(idParam: unknown, tenantId: number | string, userId: number) {
	const entity = await strapi.db.query(FEE_SHEET_CLASS_UID).findOne({
		where: mergeTenantWhere({
			...whereByParam(idParam),
			teacher: {
				id: {
					$eq: userId,
				},
			},
		}, tenantId),
		populate: {
			feeSheet: {
				select: ['id', 'name', 'fromDate', 'toDate', 'feeSheetStatus', 'note'],
			},
			class: {
				select: ['id', 'name', 'subject', 'subjectCode'],
			},
			teacher: {
				select: ['id', 'username', 'email', 'fullName'],
			},
			feeItems: {
				orderBy: [{ learnerCodeSnapshot: 'asc' }, { id: 'asc' }],
				populate: {
					learner: {
						select: ['id', 'code', 'fullName'],
					},
				},
			},
		},
	});

	if (!entity) throw new Error('Fee sheet class not found');
	return entity;
}

export default factories.createCoreController(FEE_SHEET_CLASS_UID, () => ({
	async findOne(ctx) {
		if (!(await requireAuthenticatedUser(ctx))) return;

		const tenantId = resolveCurrentTenantId(ctx);
		try {
			const entity = await findFeeSheetClassOrThrow(ctx.params?.id, tenantId);
			ctx.body = { data: normalizeAdminRow(entity) };
		} catch (error: any) {
			return ctx.notFound(error?.message || 'Fee sheet class not found');
		}
	},

	async listMine(ctx) {
		const authUser = await requireAuthenticatedUser(ctx);
		if (!authUser?.id) return;

		const tenantId = resolveCurrentTenantId(ctx);
		const query = (ctx.query || {}) as Record<string, unknown>;
		const page = toPositiveInt((query.pagination as Record<string, unknown> | undefined)?.page, 1);
		const pageSize = Math.min(100, toPositiveInt((query.pagination as Record<string, unknown> | undefined)?.pageSize, 10));
		const start = (page - 1) * pageSize;
		const keyword = toText(query.q);
		const status = toText(query.feeSheetClassStatus || query.status).toLowerCase();
		const clauses: Record<string, unknown>[] = [{
			teacher: {
				id: {
					$eq: authUser.id,
				},
			},
		}];

		if (keyword) {
			clauses.push({
				$or: [
					{ classNameSnapshot: { $containsi: keyword } },
					{ teacherNameSnapshot: { $containsi: keyword } },
					{ feeSheet: { name: { $containsi: keyword } } },
				],
			});
		}

		if (status === 'draft' || status === 'submitted' || status === 'approved') {
			clauses.push({ feeSheetClassStatus: status });
		}

		const where = mergeTenantWhere({ $and: clauses }, tenantId);
		const [rows, total] = await Promise.all([
			strapi.db.query(FEE_SHEET_CLASS_UID).findMany({
				where,
				offset: start,
				limit: pageSize,
				orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
				populate: {
					feeSheet: {
						select: ['id', 'name', 'fromDate', 'toDate', 'feeSheetStatus', 'note'],
					},
					class: {
						select: ['id', 'name', 'subject', 'subjectCode'],
					},
					teacher: {
						select: ['id', 'username', 'email', 'fullName'],
					},
					feeItems: { select: ['id'] },
				},
			}),
			strapi.db.query(FEE_SHEET_CLASS_UID).count({ where }),
		]);

		ctx.body = {
			data: (rows || []).map(normalizeMineRow),
			meta: {
				pagination: {
					page,
					pageSize,
					pageCount: Math.max(1, Math.ceil(total / pageSize)),
					total,
				},
			},
		};
	},

	async findMineOne(ctx) {
		const authUser = await requireAuthenticatedUser(ctx);
		if (!authUser?.id) return;

		const tenantId = resolveCurrentTenantId(ctx);
		try {
			const entity = await findMineFeeSheetClassOrThrow(ctx.params?.id, tenantId, authUser.id);
			ctx.body = { data: normalizeMineRow(entity) };
		} catch (error: any) {
			return ctx.notFound(error?.message || 'Fee sheet class not found');
		}
	},

	async updateMineFeeItem(ctx) {
		const authUser = await requireAuthenticatedUser(ctx);
		if (!authUser?.id) return;

		const tenantId = resolveCurrentTenantId(ctx);
		const data = resolveRequestData(ctx);

		try {
			const feeSheetClass = await findMineFeeSheetClassOrThrow(ctx.params?.id, tenantId, authUser.id);
			if (!computeCanEdit(feeSheetClass)) {
				return ctx.badRequest('Fee sheet class can no longer be edited');
			}

			const nextQuantity = Number.isFinite(Number(data.quantity))
				? Number(data.quantity)
				: Number.isFinite(Number(data.sessions))
					? Number(data.sessions)
					: null;

			const feeItemId = Number(ctx.params?.feeItemId);
			if (!Number.isInteger(feeItemId) || feeItemId <= 0) {
				return ctx.badRequest('feeItemId is invalid');
			}

			const feeItem = await strapi.db.query(FEE_ITEM_UID).findOne({
				where: mergeTenantWhere({
					id: feeItemId,
					feeSheetClass: {
						id: {
							$eq: feeSheetClass.id,
						},
					},
				}, tenantId),
				populate: {
					learner: {
						select: ['id', 'code', 'fullName'],
					},
				},
			});

			if (!feeItem?.id) {
				return ctx.notFound('Fee item not found');
			}

			await strapi.db.query(FEE_ITEM_UID).update({
				where: { id: feeItem.id },
				data: {
					sessions: nextQuantity ?? feeItem.sessions,
					unitPrice: Number.isFinite(Number(data.unitPrice)) ? Number(data.unitPrice) : feeItem.unitPrice,
					discountPercent: Number.isFinite(Number(data.discountPercent)) ? Number(data.discountPercent) : feeItem.discountPercent,
					discountAmount: Number.isFinite(Number(data.discountAmount)) ? Number(data.discountAmount) : feeItem.discountAmount,
					note: Object.prototype.hasOwnProperty.call(data, 'note') ? toText(data.note) || null : feeItem.note,
					feeSheetClass: feeSheetClass.id,
					learner: feeItem.learner?.id,
					tenant: tenantId,
				},
			});

			const refreshed = await findMineFeeSheetClassOrThrow(feeSheetClass.id, tenantId, authUser.id);
			const nextFeeItem = Array.isArray(refreshed.feeItems)
				? refreshed.feeItems.find((item: any) => Number(item.id) === feeItem.id)
				: null;

			ctx.body = {
				data: {
					feeSheetClass: normalizeMineRow(refreshed),
					feeItem: nextFeeItem ? mapFeeItemRow(nextFeeItem) : null,
				},
			};
		} catch (error: any) {
			return ctx.badRequest(error?.message || 'Failed to update fee item');
		}
	},

	async submitMine(ctx) {
		const authUser = await requireAuthenticatedUser(ctx);
		if (!authUser?.id) return;

		const tenantId = resolveCurrentTenantId(ctx);
		try {
			const feeSheetClass = await findMineFeeSheetClassOrThrow(ctx.params?.id, tenantId, authUser.id);
			if (!computeCanEdit(feeSheetClass)) {
				return ctx.badRequest('Fee sheet class can no longer be submitted');
			}

			await strapi.db.query(FEE_SHEET_CLASS_UID).update({
				where: { id: feeSheetClass.id },
				data: {
					feeSheetClassStatus: 'submitted',
				},
			});

			const refreshed = await findMineFeeSheetClassOrThrow(feeSheetClass.id, tenantId, authUser.id);
			ctx.body = { data: normalizeMineRow(refreshed) };
		} catch (error: any) {
			return ctx.badRequest(error?.message || 'Failed to submit fee sheet class');
		}
	},
}));