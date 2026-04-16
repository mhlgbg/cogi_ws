import { errors } from '@strapi/utils';
import { extractRelationRef, hasOwn, toText } from '../../../../utils/tenant-scope';

const SLIDER_UID = 'api::slider.slider';

type GenericRecord = Record<string, unknown>;

function getRequestContextTenantId(): number | string | null {
	const requestContext = strapi.requestContext?.get?.();
	const tenantId = requestContext?.state?.tenantId ?? requestContext?.state?.tenant?.id;
	if (tenantId === null || tenantId === undefined || tenantId === '') return null;
	return tenantId;
}

function extractEntryRelationRef(value: unknown): string | number | null {
	if (value === null || value === undefined) return null;
	if (typeof value === 'string' || typeof value === 'number') return value;
	if (typeof value !== 'object') return null;

	const relation = value as { id?: number | string; documentId?: string };
	if (relation.id !== undefined) return relation.id;
	if (relation.documentId) return relation.documentId;
	return null;
}

async function loadExistingSlider(where: unknown) {
	const normalizedWhere = typeof where === 'object' && where !== null
		? Object.fromEntries(
			Object.entries(where as Record<string, unknown>).filter(
				([key, value]) => !(key === 'locale' && (value === '' || value === null)),
			),
		)
		: where;

	if (!normalizedWhere) return null;

	return strapi.db.query(SLIDER_UID).findOne({
		where: normalizedWhere,
		populate: {
			tenant: { select: ['id', 'documentId'] },
		},
	});
}

async function findSlidersByTenantAndCode(tenantRef: string | number, code: string) {
	return strapi.db.query(SLIDER_UID).findMany({
		where: {
			tenant: { id: { $eq: tenantRef } },
			code: { $eq: code },
		},
		select: ['id', 'code'],
	});
}

async function syncTenantShadowColumn(id: unknown, tenantRef: string | number | null) {
	if (!id || !tenantRef) return;

	const knex = strapi.db.connection;
	const hasTable = await knex.schema.hasTable('sliders');
	if (!hasTable) return;

	const hasTenantIdColumn = await knex.schema.hasColumn('sliders', 'tenant_id');
	if (!hasTenantIdColumn) return;

	await knex('sliders').where({ id }).update({ tenant_id: tenantRef });
}

async function ensureSliderIsValid(params: { data?: GenericRecord; where?: unknown }) {
	const data = (params.data || {}) as GenericRecord;
	const existing = await loadExistingSlider(params.where);
	const requestTenantId = getRequestContextTenantId();

	if ((data.tenant === null || data.tenant === undefined || data.tenant === '') && requestTenantId) {
		data.tenant = requestTenantId;
	}

	const tenantRef = extractRelationRef(data.tenant)
		|| extractEntryRelationRef(existing?.tenant)
		|| requestTenantId;
	const name = hasOwn(data, 'name') ? toText(data.name) : toText(existing?.name);
	const code = hasOwn(data, 'code') ? toText(data.code) : toText(existing?.code);
	const description = hasOwn(data, 'description') ? toText(data.description) : toText(existing?.description);
	const intervalRaw = hasOwn(data, 'interval') ? data.interval : existing?.interval;
	const isActive = hasOwn(data, 'isActive') ? Boolean(data.isActive) : Boolean(existing?.isActive ?? true);

	if (!tenantRef) {
		throw new errors.ApplicationError('tenant is required');
	}

	if (!name) {
		throw new errors.ApplicationError('name is required');
	}

	if (!code) {
		throw new errors.ApplicationError('code is required');
	}

	let interval: number | null = null;
	if (intervalRaw !== undefined && intervalRaw !== null && intervalRaw !== '') {
		const parsedInterval = Number(intervalRaw);
		if (!Number.isFinite(parsedInterval) || parsedInterval < 0) {
			throw new errors.ApplicationError('interval must be a non-negative number');
		}
		interval = Math.floor(parsedInterval);
	}

	const siblings = await findSlidersByTenantAndCode(tenantRef, code);
	const ignoreId = existing?.id ? String(existing.id) : null;
	const duplicate = (siblings || []).find((item: any) => !ignoreId || String(item?.id) !== ignoreId);

	if (duplicate) {
		throw new errors.ApplicationError('tenant + code must be unique');
	}

	data.tenant = tenantRef;
	data.name = name;
	data.code = code;
	data.description = description || null;
	data.interval = interval;
	data.isActive = isActive;
	await syncTenantShadowColumn(existing?.id, tenantRef);
}

export default {
	async beforeCreate(event: any) {
		await ensureSliderIsValid({
			data: event.params?.data,
		});
	},

	async beforeUpdate(event: any) {
		await ensureSliderIsValid({
			data: event.params?.data,
			where: event.params?.where,
		});
	},

	async afterCreate(event: any) {
		const tenantRef = extractRelationRef(event.params?.data?.tenant) || getRequestContextTenantId();
		await syncTenantShadowColumn(event.result?.id, tenantRef);
	},

	async afterUpdate(event: any) {
		const tenantRef = extractRelationRef(event.params?.data?.tenant)
			|| extractEntryRelationRef(event.result?.tenant)
			|| getRequestContextTenantId();
		await syncTenantShadowColumn(event.result?.id, tenantRef);
	},
};