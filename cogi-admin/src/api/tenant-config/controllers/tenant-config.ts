import { factories } from '@strapi/strapi';
import {
	mergeTenantWhere,
	normalizePopulateInput,
	normalizeSortInput,
	resolveCurrentTenantId,
	toPositiveInt,
	whereByParam,
} from '../../../utils/tenant-scope';

const TENANT_CONFIG_UID = 'api::tenant-config.tenant-config';

type GenericRecord = Record<string, unknown>;

function resolveRequestData(ctx: any): GenericRecord {
	const body = (ctx.request.body ??= {});
	if (!body.data || typeof body.data !== 'object' || Array.isArray(body.data)) {
		body.data = {};
	}

	return body.data as GenericRecord;
}

function resolveTenantConfigPopulate(ctx: any) {
	const requestedPopulate = normalizePopulateInput(ctx.query?.populate);

	if (requestedPopulate === true) return true;
	if (Array.isArray(requestedPopulate) && requestedPopulate.length > 0) {
		const required = ['tenant'];
		return Array.from(new Set([...required, ...requestedPopulate]));
	}

	return ['tenant'];
}

function shouldDebugTenantConfig(): boolean {
	return process.env.NODE_ENV === 'development';
}

function debugTenantConfig(payload: Record<string, unknown>) {
	if (!shouldDebugTenantConfig()) return;
	strapi.log.info(`[tenant-config.findPublicByKey] ${JSON.stringify(payload)}`);
}

export default factories.createCoreController(TENANT_CONFIG_UID, () => ({
	async findPublicByKey(ctx) {
		const key = String(ctx.params?.key || '').trim();
		const headerTenantCode = String(ctx.get?.('x-tenant-code') || ctx.request?.header?.['x-tenant-code'] || '').trim();

		debugTenantConfig({
			stage: 'request:start',
			path: ctx.request?.path || ctx.path || '',
			method: ctx.request?.method || '',
			key,
			headerTenantCode,
			stateTenantCode: ctx.state?.tenantCode || null,
			stateTenantId: ctx.state?.tenantId || null,
			stateTenantSource: ctx.state?.tenantSource || null,
			isMainDomain: ctx.state?.isMainDomain ?? null,
			tenantConflict: ctx.state?.tenantConflict ?? null,
			host: ctx.request?.host || ctx.host || '',
			origin: ctx.request?.header?.origin || ctx.request?.header?.referer || '',
		});

		try {
			const tenantId = resolveCurrentTenantId(ctx);

			if (!key) {
				debugTenantConfig({
					stage: 'request:bad-key',
					tenantId,
					headerTenantCode,
				});
				return ctx.badRequest('Tenant config key is required');
			}

			const where = mergeTenantWhere({ key: { $eq: key } }, tenantId);
			debugTenantConfig({
				stage: 'query:before',
				key,
				tenantId,
				headerTenantCode,
				where,
			});

			const entity = await strapi.db.query(TENANT_CONFIG_UID).findOne({
				where,
				populate: resolveTenantConfigPopulate(ctx),
			});

			debugTenantConfig({
				stage: 'query:after',
				key,
				tenantId,
				found: Boolean(entity),
				entityId: entity?.id || null,
				entityKey: entity?.key || null,
				hasJsonContent: entity?.jsonContent !== undefined && entity?.jsonContent !== null,
				entityTenantRef: entity?.tenant?.id || entity?.tenant || null,
			});

			if (!entity) {
				return ctx.notFound('Tenant config not found');
			}

			return this.transformResponse(entity);
		} catch (error: any) {
			debugTenantConfig({
				stage: 'request:error',
				key,
				headerTenantCode,
				stateTenantCode: ctx.state?.tenantCode || null,
				stateTenantId: ctx.state?.tenantId || null,
				errorMessage: error?.message || 'Unknown error',
				status: error?.status || error?.statusCode || null,
			});
			throw error;
		}
	},

	async find(ctx) {
		const tenantId = resolveCurrentTenantId(ctx);
		const query = (ctx.query || {}) as Record<string, unknown>;
		const page = toPositiveInt((query.pagination as Record<string, unknown> | undefined)?.page, 1);
		const pageSize = toPositiveInt((query.pagination as Record<string, unknown> | undefined)?.pageSize, 10);
		const start = (page - 1) * pageSize;
		const where = mergeTenantWhere(query.filters, tenantId);
		const orderBy = normalizeSortInput(query.sort);
		const populate = resolveTenantConfigPopulate(ctx);

		const [rows, total] = await Promise.all([
			strapi.db.query(TENANT_CONFIG_UID).findMany({
				where,
				orderBy: orderBy.length > 0 ? orderBy : undefined,
				offset: start,
				limit: pageSize,
				populate,
			}),
			strapi.db.query(TENANT_CONFIG_UID).count({ where }),
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
		const entity = await strapi.db.query(TENANT_CONFIG_UID).findOne({
			where: mergeTenantWhere(whereByParam(ctx.params?.id), tenantId),
			populate: resolveTenantConfigPopulate(ctx),
		});

		if (!entity) {
			return ctx.notFound('Tenant config not found');
		}

		return this.transformResponse(entity);
	},

	async create(ctx) {
		const tenantId = resolveCurrentTenantId(ctx);
		const data = resolveRequestData(ctx);
		data.tenant = tenantId;

		const created = await strapi.db.query(TENANT_CONFIG_UID).create({ data });
		const populatedCreated = await strapi.db.query(TENANT_CONFIG_UID).findOne({
			where: { id: created.id },
			populate: resolveTenantConfigPopulate(ctx),
		});

		return this.transformResponse(populatedCreated ?? created);
	},

	async update(ctx) {
		const tenantId = resolveCurrentTenantId(ctx);
		const existing = await strapi.db.query(TENANT_CONFIG_UID).findOne({
			where: mergeTenantWhere(whereByParam(ctx.params?.id), tenantId),
		});

		if (!existing) {
			return ctx.notFound('Tenant config not found');
		}

		const data = resolveRequestData(ctx);
		data.tenant = tenantId;

		const updated = await strapi.db.query(TENANT_CONFIG_UID).update({
			where: { id: existing.id },
			data,
		});
		const populatedUpdated = await strapi.db.query(TENANT_CONFIG_UID).findOne({
			where: { id: existing.id },
			populate: resolveTenantConfigPopulate(ctx),
		});

		return this.transformResponse(populatedUpdated ?? updated);
	},

	async delete(ctx) {
		const tenantId = resolveCurrentTenantId(ctx);
		const existing = await strapi.db.query(TENANT_CONFIG_UID).findOne({
			where: mergeTenantWhere(whereByParam(ctx.params?.id), tenantId),
		});

		if (!existing) {
			return ctx.notFound('Tenant config not found');
		}

		return await super.delete({
			...ctx,
			params: { ...ctx.params, id: existing.id },
		});
	},
}));