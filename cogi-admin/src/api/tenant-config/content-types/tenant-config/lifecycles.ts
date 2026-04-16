import { errors } from '@strapi/utils';
import { extractRelationRef, hasOwn, toText } from '../../../../utils/tenant-scope';

const TENANT_CONFIG_UID = 'api::tenant-config.tenant-config';

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

async function loadExistingTenantConfig(where: unknown) {
	const normalizedWhere = typeof where === 'object' && where !== null
		? Object.fromEntries(
			Object.entries(where as Record<string, unknown>).filter(
				([key, value]) => !(key === 'locale' && (value === '' || value === null)),
			),
		)
		: where;

	if (!normalizedWhere) return null;

	return strapi.db.query(TENANT_CONFIG_UID).findOne({
		where: normalizedWhere,
		populate: {
			tenant: { select: ['id', 'documentId'] },
		},
	});
}

async function findTenantConfigsByTenantAndKey(tenantRef: string | number, key: string) {
	return strapi.db.query(TENANT_CONFIG_UID).findMany({
		where: {
			tenant: { id: { $eq: tenantRef } },
			key: { $eq: key },
		},
		select: ['id', 'key'],
	});
}

async function syncTenantShadowColumn(id: unknown, tenantRef: string | number | null) {
	if (!id || !tenantRef) return;

	const knex = strapi.db.connection;
	const hasTable = await knex.schema.hasTable('tenant_configs');
	if (!hasTable) return;

	const hasTenantIdColumn = await knex.schema.hasColumn('tenant_configs', 'tenant_id');
	if (!hasTenantIdColumn) return;

	await knex('tenant_configs').where({ id }).update({ tenant_id: tenantRef });
}

async function ensureTenantConfigIsValid(params: { data?: GenericRecord; where?: unknown }) {
	const data = (params.data || {}) as GenericRecord;
	const existing = await loadExistingTenantConfig(params.where);
	const requestTenantId = getRequestContextTenantId();

	if ((data.tenant === null || data.tenant === undefined || data.tenant === '') && requestTenantId) {
		data.tenant = requestTenantId;
	}

	const tenantRef = extractRelationRef(data.tenant)
		|| extractEntryRelationRef(existing?.tenant)
		|| requestTenantId;
	const key = hasOwn(data, 'key') ? toText(data.key) : toText(existing?.key);
	const description = hasOwn(data, 'description') ? toText(data.description) : toText(existing?.description);
	const jsonContent = hasOwn(data, 'jsonContent') ? data.jsonContent : existing?.jsonContent;

	if (!tenantRef) {
		throw new errors.ApplicationError('tenant is required');
	}

	if (!key) {
		throw new errors.ApplicationError('key is required');
	}

	if (jsonContent === undefined || jsonContent === null) {
		throw new errors.ApplicationError('jsonContent is required');
	}

	const siblings = await findTenantConfigsByTenantAndKey(tenantRef, key);
	const ignoreId = existing?.id ? String(existing.id) : null;
	const duplicate = (siblings || []).find((item: any) => !ignoreId || String(item?.id) !== ignoreId);

	if (duplicate) {
		throw new errors.ApplicationError('tenant + key must be unique');
	}

	data.tenant = tenantRef;
	data.key = key;
	data.description = description || null;
	data.jsonContent = jsonContent;
	await syncTenantShadowColumn(existing?.id, tenantRef);
}

export default {
	async beforeCreate(event: any) {
		await ensureTenantConfigIsValid({
			data: event.params?.data,
		});
	},

	async beforeUpdate(event: any) {
		await ensureTenantConfigIsValid({
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