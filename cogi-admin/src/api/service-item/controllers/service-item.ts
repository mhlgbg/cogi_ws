import { factories } from '@strapi/strapi';
import {
	assertEntityTenantMatch,
	findEntityByRef,
	mergeTenantWhere,
	normalizePopulateInput,
	normalizeSortInput,
	resolveCurrentTenantId,
	toPositiveInt,
	whereByParam,
} from '../../../utils/tenant-scope';

const SERVICE_ITEM_UID = 'api::service-item.service-item';
const SERVICE_CATEGORY_UID = 'api::service-category.service-category';

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
		if (authUser?.id) {
			ctx.state.user = authUser;
		}
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

async function validateCategoryTenant(data: GenericRecord, tenantId: number | string, ctx: any) {
	if (!Object.prototype.hasOwnProperty.call(data, 'category')) return;

	if (data.category === null || data.category === undefined || data.category === '') return;

	const category = await findEntityByRef(SERVICE_CATEGORY_UID, data.category, {
		tenant: {
			select: ['id', 'documentId'],
		},
	});

	assertEntityTenantMatch(category, tenantId, 'Selected service category does not belong to current tenant', ctx);
}

function resolveServiceItemPopulate(ctx: any) {
	const requestedPopulate = normalizePopulateInput(ctx.query?.populate);

	if (requestedPopulate === true) return true;
	if (Array.isArray(requestedPopulate) && requestedPopulate.length > 0) {
		return requestedPopulate.includes('category') ? requestedPopulate : ['category', ...requestedPopulate];
	}

	return ['category'];
}

export default factories.createCoreController(SERVICE_ITEM_UID, () => ({
	async find(ctx) {
		if (!(await requireAuthenticatedUser(ctx))) return;

		const tenantId = resolveCurrentTenantId(ctx);
		const query = (ctx.query || {}) as Record<string, unknown>;
		const page = toPositiveInt((query.pagination as Record<string, unknown> | undefined)?.page, 1);
		const pageSize = toPositiveInt((query.pagination as Record<string, unknown> | undefined)?.pageSize, 10);
		const start = (page - 1) * pageSize;
		const where = mergeTenantWhere(query.filters, tenantId);
		const orderBy = normalizeSortInput(query.sort);
		const populate = resolveServiceItemPopulate(ctx);

		const [rows, total] = await Promise.all([
			strapi.db.query(SERVICE_ITEM_UID).findMany({
				where,
				orderBy: orderBy.length > 0 ? orderBy : undefined,
				offset: start,
				limit: pageSize,
				populate,
			}),
			strapi.db.query(SERVICE_ITEM_UID).count({ where }),
		]);

		return this.transformResponse(rows, {
			pagination: {
				page,
				pageSize,
				pageCount: Math.max(1, Math.ceil(total / pageSize)),
				total,
			},
		});
	},

	async findOne(ctx) {
		if (!(await requireAuthenticatedUser(ctx))) return;

		const tenantId = resolveCurrentTenantId(ctx);
		const entity = await strapi.db.query(SERVICE_ITEM_UID).findOne({
			where: mergeTenantWhere(whereByParam(ctx.params?.id), tenantId),
			populate: resolveServiceItemPopulate(ctx),
		});

		if (!entity) {
			return ctx.notFound('Service item not found');
		}

		return this.transformResponse(entity);
	},

	async create(ctx) {
		if (!(await requireAuthenticatedUser(ctx))) return;

		const tenantId = resolveCurrentTenantId(ctx);
		const data = resolveRequestData(ctx);
		await validateCategoryTenant(data, tenantId, ctx);
		data.tenant = tenantId;

		const created = await strapi.db.query(SERVICE_ITEM_UID).create({ data });
		const populatedCreated = await strapi.db.query(SERVICE_ITEM_UID).findOne({
			where: { id: created.id },
			populate: resolveServiceItemPopulate(ctx),
		});

		return this.transformResponse(populatedCreated ?? created);
	},

	async update(ctx) {
		if (!(await requireAuthenticatedUser(ctx))) return;

		const tenantId = resolveCurrentTenantId(ctx);
		const existing = await strapi.db.query(SERVICE_ITEM_UID).findOne({
			where: mergeTenantWhere(whereByParam(ctx.params?.id), tenantId),
		});

		if (!existing) {
			return ctx.notFound('Service item not found');
		}

		const data = resolveRequestData(ctx);
		await validateCategoryTenant(data, tenantId, ctx);
		data.tenant = tenantId;

		const updated = await strapi.db.query(SERVICE_ITEM_UID).update({
			where: { id: existing.id },
			data,
		});
		const populatedUpdated = await strapi.db.query(SERVICE_ITEM_UID).findOne({
			where: { id: existing.id },
			populate: resolveServiceItemPopulate(ctx),
		});

		return this.transformResponse(populatedUpdated ?? updated);
	},

	async delete(ctx) {
		if (!(await requireAuthenticatedUser(ctx))) return;

		const tenantId = resolveCurrentTenantId(ctx);
		const existing = await strapi.db.query(SERVICE_ITEM_UID).findOne({
			where: mergeTenantWhere(whereByParam(ctx.params?.id), tenantId),
		});

		if (!existing) {
			return ctx.notFound('Service item not found');
		}

		return await super.delete({
			...ctx,
			params: { ...ctx.params, id: existing.id },
		});
	},
}));
