import { factories } from '@strapi/strapi';
import {
	mergeTenantWhere,
	normalizePopulateInput,
	normalizeSortInput,
	resolveCurrentTenantId,
	toPositiveInt,
	whereByParam,
} from '../../../utils/tenant-scope';

const AUTHOR_UID = 'api::author.author';

type GenericRecord = Record<string, unknown>;

function resolveRequestData(ctx: any): GenericRecord {
	const body = (ctx.request.body ??= {});
	if (!body.data || typeof body.data !== 'object' || Array.isArray(body.data)) {
		body.data = {};
	}

	return body.data as GenericRecord;
}

function resolveAuthorPopulate(ctx: any) {
	const requestedPopulate = normalizePopulateInput(ctx.query?.populate);

	if (requestedPopulate === true) return true;
	if (Array.isArray(requestedPopulate) && requestedPopulate.length > 0) {
		const required = ['tenant', 'avatar'];
		return Array.from(new Set([...required, ...requestedPopulate]));
	}

	return ['tenant', 'avatar'];
}

export default factories.createCoreController(AUTHOR_UID, () => ({
	async find(ctx) {
		const tenantId = resolveCurrentTenantId(ctx);
		const query = (ctx.query || {}) as Record<string, unknown>;
		const page = toPositiveInt((query.pagination as Record<string, unknown> | undefined)?.page, 1);
		const pageSize = toPositiveInt((query.pagination as Record<string, unknown> | undefined)?.pageSize, 10);
		const start = (page - 1) * pageSize;
		const where = mergeTenantWhere(query.filters, tenantId);
		const orderBy = normalizeSortInput(query.sort);
		const populate = resolveAuthorPopulate(ctx);

		const [rows, total] = await Promise.all([
			strapi.db.query(AUTHOR_UID).findMany({
				where,
				orderBy: orderBy.length > 0 ? orderBy : undefined,
				offset: start,
				limit: pageSize,
				populate,
			}),
			strapi.db.query(AUTHOR_UID).count({ where }),
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
		const tenantId = resolveCurrentTenantId(ctx);
		const entity = await strapi.db.query(AUTHOR_UID).findOne({
			where: mergeTenantWhere(whereByParam(ctx.params?.id), tenantId),
			populate: resolveAuthorPopulate(ctx),
		});

		if (!entity) {
			return ctx.notFound('Author not found');
		}

		return this.transformResponse(entity);
	},

	async create(ctx) {
		const tenantId = resolveCurrentTenantId(ctx);
		const data = resolveRequestData(ctx);
		data.tenant = tenantId;

		const created = await strapi.db.query(AUTHOR_UID).create({ data });
		const populatedCreated = await strapi.db.query(AUTHOR_UID).findOne({
			where: { id: created.id },
			populate: resolveAuthorPopulate(ctx),
		});

		return this.transformResponse(populatedCreated ?? created);
	},

	async update(ctx) {
		const tenantId = resolveCurrentTenantId(ctx);
		const existing = await strapi.db.query(AUTHOR_UID).findOne({
			where: mergeTenantWhere(whereByParam(ctx.params?.id), tenantId),
		});

		if (!existing) {
			return ctx.notFound('Author not found');
		}

		const data = resolveRequestData(ctx);
		data.tenant = tenantId;

		const updated = await strapi.db.query(AUTHOR_UID).update({
			where: { id: existing.id },
			data,
		});
		const populatedUpdated = await strapi.db.query(AUTHOR_UID).findOne({
			where: { id: existing.id },
			populate: resolveAuthorPopulate(ctx),
		});

		return this.transformResponse(populatedUpdated ?? updated);
	},

	async delete(ctx) {
		const tenantId = resolveCurrentTenantId(ctx);
		const existing = await strapi.db.query(AUTHOR_UID).findOne({
			where: mergeTenantWhere(whereByParam(ctx.params?.id), tenantId),
		});

		if (!existing) {
			return ctx.notFound('Author not found');
		}

		return await super.delete({
			...ctx,
			params: { ...ctx.params, id: existing.id },
		});
	},
}));
