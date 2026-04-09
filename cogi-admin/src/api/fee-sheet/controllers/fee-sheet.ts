import { factories } from '@strapi/strapi';
import {
	mergeTenantWhere,
	resolveCurrentTenantId,
	toPositiveInt,
	toText,
	whereByParam,
} from '../../../utils/tenant-scope';

const FEE_SHEET_UID = 'api::fee-sheet.fee-sheet';
const FEE_SHEET_CLASS_UID = 'api::fee-sheet-class.fee-sheet-class';
const CLASS_UID = 'api::class.class';

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
			select: ['id', 'username', 'email', 'blocked'],
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

function toIsoDate(value: unknown) {
	const text = toText(value);
	if (!text) return null;
	const date = new Date(text);
	if (Number.isNaN(date.getTime())) {
		throw new Error('Invalid date value');
	}
	return date.toISOString().slice(0, 10);
}

function normalizeFeeSheet(raw: any) {
	if (!raw) return null;
	const feeSheetStatus = raw.feeSheetStatus || raw.status || 'draft';
	return {
		id: raw.id,
		name: raw.name || '',
		fromDate: raw.fromDate || null,
		toDate: raw.toDate || null,
		feeSheetStatus,
		status: feeSheetStatus,
		note: raw.note || '',
		updatedAt: raw.updatedAt || null,
		feeSheetClasses: Array.isArray(raw.feeSheetClasses)
			? raw.feeSheetClasses.map((item: any) => ({
				id: item.id,
				classNameSnapshot: item.classNameSnapshot || item.class?.name || '',
				teacherNameSnapshot: item.teacherNameSnapshot || '',
				feeSheetClassStatus: item.feeSheetClassStatus || item.status || 'draft',
				status: item.feeSheetClassStatus || item.status || 'draft',
				feeItemsCount: Array.isArray(item.feeItems) ? item.feeItems.length : 0,
			}))
			: [],
	};
}

async function findFeeSheetOrThrow(idParam: unknown, tenantId: number | string) {
	const entity = await strapi.db.query(FEE_SHEET_UID).findOne({
		where: mergeTenantWhere(whereByParam(idParam), tenantId),
		populate: {
			feeSheetClasses: {
				populate: {
					class: { select: ['id', 'name'] },
					teacher: { select: ['id', 'username', 'email', 'fullName'] },
					feeItems: { select: ['id'] },
				},
			},
		},
	});

	if (!entity) throw new Error('Fee sheet not found');
	return entity;
}

export default factories.createCoreController(FEE_SHEET_UID, () => ({
	async find(ctx) {
		if (!(await requireAuthenticatedUser(ctx))) return;

		const tenantId = resolveCurrentTenantId(ctx);
		const query = (ctx.query || {}) as Record<string, unknown>;
		const page = toPositiveInt((query.pagination as Record<string, unknown> | undefined)?.page, 1);
		const pageSize = Math.min(100, toPositiveInt((query.pagination as Record<string, unknown> | undefined)?.pageSize, 10));
		const start = (page - 1) * pageSize;
		const keyword = toText(query.q);
		const where = mergeTenantWhere(keyword ? {
			name: { $containsi: keyword },
		} : {}, tenantId);

		const [rows, total] = await Promise.all([
			strapi.db.query(FEE_SHEET_UID).findMany({
				where,
				offset: start,
				limit: pageSize,
				orderBy: [{ fromDate: 'desc' }, { id: 'desc' }],
				populate: {
					feeSheetClasses: {
						populate: {
							class: { select: ['id', 'name'] },
							teacher: { select: ['id', 'username', 'email', 'fullName'] },
							feeItems: { select: ['id'] },
						},
					},
				},
			}),
			strapi.db.query(FEE_SHEET_UID).count({ where }),
		]);

		ctx.body = {
			data: (rows || []).map(normalizeFeeSheet),
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

	async formOptions(ctx) {
		if (!(await requireAuthenticatedUser(ctx))) return;
		const tenantId = resolveCurrentTenantId(ctx);

		const classes = await strapi.db.query(CLASS_UID).findMany({
			where: {
				tenant: tenantId,
				classStatus: 'active',
			},
			populate: {
				mainTeacher: { select: ['id', 'username', 'email', 'fullName'] },
			},
			orderBy: [{ name: 'asc' }, { id: 'asc' }],
		});

		ctx.body = {
			data: {
				classes: (classes || []).map((item: any) => ({
					id: item.id,
					name: item.name || '',
					subject: item.subject || '',
					label: [item.name || '', item.subject || ''].filter(Boolean).join(' - ') || `Class #${item.id}`,
				})),
			},
		};
	},

	async findOne(ctx) {
		if (!(await requireAuthenticatedUser(ctx))) return;
		const tenantId = resolveCurrentTenantId(ctx);

		try {
			const entity = await findFeeSheetOrThrow(ctx.params?.id, tenantId);
			ctx.body = { data: normalizeFeeSheet(entity) };
		} catch (error: any) {
			return ctx.notFound(error?.message || 'Fee sheet not found');
		}
	},

	async create(ctx) {
		if (!(await requireAuthenticatedUser(ctx))) return;
		const tenantId = resolveCurrentTenantId(ctx);
		const data = resolveRequestData(ctx);

		try {
			const created = await strapi.db.query(FEE_SHEET_UID).create({
				data: {
					name: toText(data.name),
					fromDate: toIsoDate(data.fromDate),
					toDate: toIsoDate(data.toDate),
					note: toText(data.note) || null,
					feeSheetStatus: toText(data.feeSheetStatus ?? data.status).toLowerCase() || 'draft',
					tenant: tenantId,
				},
			});

			const populated = await findFeeSheetOrThrow(created.id, tenantId);
			ctx.body = { data: normalizeFeeSheet(populated) };
		} catch (error: any) {
			return ctx.badRequest(error?.message || 'Invalid fee sheet payload');
		}
	},

	async update(ctx) {
		if (!(await requireAuthenticatedUser(ctx))) return;
		const tenantId = resolveCurrentTenantId(ctx);
		const data = resolveRequestData(ctx);

		try {
			const feeSheet = await findFeeSheetOrThrow(ctx.params?.id, tenantId);
			await strapi.db.query(FEE_SHEET_UID).update({
				where: { id: feeSheet.id },
				data: {
					name: toText(data.name ?? feeSheet.name),
					fromDate: toIsoDate(data.fromDate ?? feeSheet.fromDate),
					toDate: toIsoDate(data.toDate ?? feeSheet.toDate),
					note: toText(data.note ?? feeSheet.note) || null,
					feeSheetStatus: toText(data.feeSheetStatus ?? data.status ?? feeSheet.feeSheetStatus ?? feeSheet.status).toLowerCase() || feeSheet.feeSheetStatus || feeSheet.status,
					tenant: tenantId,
				},
			});

			const populated = await findFeeSheetOrThrow(feeSheet.id, tenantId);
			ctx.body = { data: normalizeFeeSheet(populated) };
		} catch (error: any) {
			return ctx.badRequest(error?.message || 'Invalid fee sheet payload');
		}
	},

	async generate(ctx) {
		if (!(await requireAuthenticatedUser(ctx))) return;
		const tenantId = resolveCurrentTenantId(ctx);
		const feeSheetService = strapi.service(FEE_SHEET_UID) as any;
		const body = ctx.request?.body || {};
		const classIds = Array.isArray(body.classIds)
			? body.classIds.map((item: unknown) => Number(item)).filter((item: number) => Number.isInteger(item) && item > 0)
			: [];
		const regenerate = Boolean(body.regenerate);
		const unitPrice = Number(body.unitPrice);

		if (classIds.length === 0) {
			return ctx.badRequest('classIds is required');
		}

		if (!Number.isFinite(unitPrice) || unitPrice < 0) {
			return ctx.badRequest('unitPrice must be a non-negative number');
		}

		try {
			const result = await feeSheetService.generateForClasses({
				feeSheetId: Number(ctx.params?.id),
				classIds,
				regenerate,
				unitPrice,
				tenantId,
			});

			const feeSheet = await findFeeSheetOrThrow(ctx.params?.id, tenantId);
			ctx.body = {
				data: {
					...result,
					feeSheet: normalizeFeeSheet(feeSheet),
				},
			};
		} catch (error: any) {
			return ctx.badRequest(error?.message || 'Failed to generate fee sheet');
		}
	},
}));