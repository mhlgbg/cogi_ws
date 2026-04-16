import { factories } from '@strapi/strapi';
import {
	mergeTenantWhere,
	normalizePopulateInput,
	normalizeSortInput,
	resolveCurrentTenantId,
	toPositiveInt,
	whereByParam,
} from '../../../utils/tenant-scope';

const SLIDER_UID = 'api::slider.slider';

function mergeSliderActiveWhere(baseWhere: unknown) {
	const activeWhere = {
		isActive: {
			$eq: true,
		},
	};

	if (!baseWhere || typeof baseWhere !== 'object') {
		return activeWhere;
	}

	return {
		$and: [baseWhere, activeWhere],
	};
}

function resolveRequestData(ctx: any): Record<string, unknown> {
	const body = (ctx.request.body ??= {});
	if (!body.data || typeof body.data !== 'object' || Array.isArray(body.data)) {
		body.data = {};
	}

	return body.data as Record<string, unknown>;
}

function resolveSliderPopulate(ctx: any) {
	const rawPopulate = ctx.query?.populate;
	const requestedPopulate = normalizePopulateInput(rawPopulate);
	const shouldPopulateItems = requestedPopulate === true || (Array.isArray(requestedPopulate) && requestedPopulate.includes('items'));
	const shouldPopulateTenant = requestedPopulate === true || !requestedPopulate || (Array.isArray(requestedPopulate) && requestedPopulate.includes('tenant'));

	if (requestedPopulate === true) {
		return {
			tenant: true,
			items: {
				where: {
					isActive: {
						$eq: true,
					},
				},
				orderBy: [{ order: 'asc' }, { id: 'asc' }],
				populate: ['image'],
			},
		};
	}

	const populate: Record<string, unknown> = {};
	if (shouldPopulateTenant) {
		populate.tenant = true;
	}

	if (shouldPopulateItems) {
		populate.items = {
			where: {
				isActive: {
					$eq: true,
				},
			},
			orderBy: [{ order: 'asc' }, { id: 'asc' }],
			populate: ['image'],
		};
	}

	return Object.keys(populate).length > 0 ? populate : ['tenant'];
}

export default factories.createCoreController(SLIDER_UID, () => ({
	async find(ctx) {
		const tenantId = resolveCurrentTenantId(ctx);
		const query = (ctx.query || {}) as Record<string, unknown>;
		const page = toPositiveInt((query.pagination as Record<string, unknown> | undefined)?.page, 1);
		const pageSize = toPositiveInt((query.pagination as Record<string, unknown> | undefined)?.pageSize, 10);
		const start = (page - 1) * pageSize;
		const where = mergeTenantWhere(mergeSliderActiveWhere(query.filters), tenantId);
		const orderBy = normalizeSortInput(query.sort);
		const populate = resolveSliderPopulate(ctx);

		const [rows, total] = await Promise.all([
			strapi.db.query(SLIDER_UID).findMany({
				where,
				orderBy: orderBy.length > 0 ? orderBy : undefined,
				offset: start,
				limit: pageSize,
				populate,
			}),
			strapi.db.query(SLIDER_UID).count({ where }),
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
		const entity = await strapi.db.query(SLIDER_UID).findOne({
			where: mergeTenantWhere(mergeSliderActiveWhere(whereByParam(ctx.params?.id)), tenantId),
			populate: resolveSliderPopulate(ctx),
		});

		if (!entity) {
			return ctx.notFound('Slider not found');
		}

		return this.transformResponse(entity);
	},

	async create(ctx) {
		const tenantId = resolveCurrentTenantId(ctx);
		const data = resolveRequestData(ctx);
		data.tenant = tenantId;

		const created = await strapi.db.query(SLIDER_UID).create({ data });
		const populatedCreated = await strapi.db.query(SLIDER_UID).findOne({
			where: { id: created.id },
			populate: resolveSliderPopulate(ctx),
		});

		return this.transformResponse(populatedCreated ?? created);
	},

	async update(ctx) {
		const tenantId = resolveCurrentTenantId(ctx);
		const existing = await strapi.db.query(SLIDER_UID).findOne({
			where: mergeTenantWhere(whereByParam(ctx.params?.id), tenantId),
		});

		if (!existing) {
			return ctx.notFound('Slider not found');
		}

		const data = resolveRequestData(ctx);
		data.tenant = tenantId;

		const updated = await strapi.db.query(SLIDER_UID).update({
			where: { id: existing.id },
			data,
		});
		const populatedUpdated = await strapi.db.query(SLIDER_UID).findOne({
			where: { id: existing.id },
			populate: resolveSliderPopulate(ctx),
		});

		return this.transformResponse(populatedUpdated ?? updated);
	},

	async delete(ctx) {
		const tenantId = resolveCurrentTenantId(ctx);
		const existing = await strapi.db.query(SLIDER_UID).findOne({
			where: mergeTenantWhere(whereByParam(ctx.params?.id), tenantId),
		});

		if (!existing) {
			return ctx.notFound('Slider not found');
		}

		return await super.delete({
			...ctx,
			params: { ...ctx.params, id: existing.id },
		});
	},
}));