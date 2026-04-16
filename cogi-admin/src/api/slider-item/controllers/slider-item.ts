import { factories } from '@strapi/strapi';
import {
	assertEntityTenantMatch,
	findEntityByRef,
	normalizePopulateInput,
	normalizeSortInput,
	resolveCurrentTenantId,
	toPositiveInt,
	whereByParam,
} from '../../../utils/tenant-scope';

const SLIDER_ITEM_UID = 'api::slider-item.slider-item';
const SLIDER_UID = 'api::slider.slider';

type GenericRecord = Record<string, unknown>;

function resolveRequestData(ctx: any): GenericRecord {
	const body = (ctx.request.body ??= {});
	if (!body.data || typeof body.data !== 'object' || Array.isArray(body.data)) {
		body.data = {};
	}

	return body.data as GenericRecord;
}

function resolveSliderItemPopulate(ctx: any) {
	const requestedPopulate = normalizePopulateInput(ctx.query?.populate);

	if (requestedPopulate === true) return true;
	if (Array.isArray(requestedPopulate) && requestedPopulate.length > 0) {
		const required = ['slider', 'image'];
		return Array.from(new Set([...required, ...requestedPopulate]));
	}

	return ['slider', 'image'];
}

function mergeSliderTenantWhere(baseWhere: unknown, tenantId: number | string) {
	const sliderTenantWhere = {
		slider: {
			tenant: {
				id: {
					$eq: tenantId,
				},
			},
		},
	};

	if (!baseWhere || typeof baseWhere !== 'object') {
		return sliderTenantWhere;
	}

	return {
		$and: [baseWhere, sliderTenantWhere],
	};
}

async function validateSliderInTenant(data: GenericRecord, tenantId: number | string, ctx: any) {
	const slider = await findEntityByRef(SLIDER_UID, data.slider, {
		tenant: { select: ['id', 'documentId'] },
	});
	assertEntityTenantMatch(slider, tenantId, 'Selected slider does not belong to current tenant', ctx);
	return slider;
}

export default factories.createCoreController(SLIDER_ITEM_UID, () => ({
	async find(ctx) {
		const tenantId = resolveCurrentTenantId(ctx);
		const query = (ctx.query || {}) as Record<string, unknown>;
		const page = toPositiveInt((query.pagination as Record<string, unknown> | undefined)?.page, 1);
		const pageSize = toPositiveInt((query.pagination as Record<string, unknown> | undefined)?.pageSize, 10);
		const start = (page - 1) * pageSize;
		const where = mergeSliderTenantWhere(query.filters, tenantId);
		const orderBy = normalizeSortInput(query.sort);
		const populate = resolveSliderItemPopulate(ctx);

		const [rows, total] = await Promise.all([
			strapi.db.query(SLIDER_ITEM_UID).findMany({
				where,
				orderBy: orderBy.length > 0 ? orderBy : [{ order: 'asc' }, { id: 'asc' }],
				offset: start,
				limit: pageSize,
				populate,
			}),
			strapi.db.query(SLIDER_ITEM_UID).count({ where }),
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
		const entity = await strapi.db.query(SLIDER_ITEM_UID).findOne({
			where: mergeSliderTenantWhere(whereByParam(ctx.params?.id), tenantId),
			populate: resolveSliderItemPopulate(ctx),
		});

		if (!entity) {
			return ctx.notFound('Slider item not found');
		}

		return this.transformResponse(entity);
	},

	async create(ctx) {
		const tenantId = resolveCurrentTenantId(ctx);
		const data = resolveRequestData(ctx);
		await validateSliderInTenant(data, tenantId, ctx);

		const created = await strapi.db.query(SLIDER_ITEM_UID).create({ data });
		const populatedCreated = await strapi.db.query(SLIDER_ITEM_UID).findOne({
			where: { id: created.id },
			populate: resolveSliderItemPopulate(ctx),
		});

		return this.transformResponse(populatedCreated ?? created);
	},

	async update(ctx) {
		const tenantId = resolveCurrentTenantId(ctx);
		const existing = await strapi.db.query(SLIDER_ITEM_UID).findOne({
			where: mergeSliderTenantWhere(whereByParam(ctx.params?.id), tenantId),
			populate: ['slider', 'slider.tenant'],
		});

		if (!existing) {
			return ctx.notFound('Slider item not found');
		}

		const data = resolveRequestData(ctx);
		if (!Object.prototype.hasOwnProperty.call(data, 'slider')) {
			data.slider = existing.slider?.id || existing.slider;
		}

		await validateSliderInTenant(data, tenantId, ctx);

		const updated = await strapi.db.query(SLIDER_ITEM_UID).update({
			where: { id: existing.id },
			data,
		});
		const populatedUpdated = await strapi.db.query(SLIDER_ITEM_UID).findOne({
			where: { id: existing.id },
			populate: resolveSliderItemPopulate(ctx),
		});

		return this.transformResponse(populatedUpdated ?? updated);
	},

	async delete(ctx) {
		const tenantId = resolveCurrentTenantId(ctx);
		const existing = await strapi.db.query(SLIDER_ITEM_UID).findOne({
			where: mergeSliderTenantWhere(whereByParam(ctx.params?.id), tenantId),
		});

		if (!existing) {
			return ctx.notFound('Slider item not found');
		}

		return await super.delete({
			...ctx,
			params: { ...ctx.params, id: existing.id },
		});
	},
}));