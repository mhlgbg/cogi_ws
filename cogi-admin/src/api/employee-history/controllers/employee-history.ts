/**
 * employee-history controller
 */

import { factories } from '@strapi/strapi';

const EMPLOYEE_HISTORY_UID = 'api::employee-history.employee-history';
const EMPLOYEE_UID = 'api::employee.employee';
const DEPARTMENT_UID = 'api::department.department';
const POSITION_UID = 'api::position.position';

type GenericRecord = Record<string, unknown>;
type RelationRef = string | number | null;

function hasOwn(data: GenericRecord, key: string): boolean {
	return Object.prototype.hasOwnProperty.call(data, key);
}

function toText(value: unknown): string {
	if (value === null || value === undefined) return '';
	return String(value).trim();
}

function toRelationKey(value: unknown): string | null {
	const text = toText(value);
	return text || null;
}

function extractRelationRef(value: unknown): RelationRef {
	if (value === null || value === undefined) return null;

	if (typeof value === 'string' || typeof value === 'number') {
		return value;
	}

	if (typeof value !== 'object') return null;

	const relation = value as {
		id?: number | string;
		documentId?: string;
		connect?: Array<{ id?: number | string; documentId?: string } | number | string> | { id?: number | string; documentId?: string };
		set?: Array<{ id?: number | string; documentId?: string } | number | string> | { id?: number | string; documentId?: string };
	};

	if (relation.id !== undefined) return relation.id;
	if (relation.documentId) return relation.documentId;

	const relationCandidates = [relation.connect, relation.set];
	for (const candidate of relationCandidates) {
		if (Array.isArray(candidate) && candidate.length > 0) {
			const first = candidate[0] as { id?: number | string; documentId?: string } | number | string;
			if (typeof first === 'string' || typeof first === 'number') return first;
			if (first?.id !== undefined) return first.id;
			if (first?.documentId) return first.documentId;
		}

		if (candidate && typeof candidate === 'object') {
			const obj = candidate as { id?: number | string; documentId?: string };
			if (obj.id !== undefined) return obj.id;
			if (obj.documentId) return obj.documentId;
		}
	}

	return null;
}

function mergeFilters(baseFilters: unknown, tenantId: number | string) {
	const tenantFilter = {
		tenant: {
			id: {
				$eq: tenantId,
			},
		},
	};

	if (!baseFilters || typeof baseFilters !== 'object') {
		return tenantFilter;
	}

	return {
		$and: [baseFilters, tenantFilter],
	};
}

function toPositiveInt(value: unknown, fallback: number): number {
	const parsed = Number(value);
	if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
	return Math.floor(parsed);
}

function normalizeSortInput(rawSort: unknown): Array<Record<string, 'asc' | 'desc'>> {
	if (!rawSort) return [];

	const toItem = (entry: unknown): Record<string, 'asc' | 'desc'> | null => {
		if (!entry) return null;

		if (typeof entry === 'string') {
			const [field, directionRaw] = entry.split(':');
			const key = toText(field);
			if (!key) return null;
			const direction = toText(directionRaw).toLowerCase() === 'desc' ? 'desc' : 'asc';
			return { [key]: direction };
		}

		if (typeof entry === 'object') {
			const objectEntry = entry as Record<string, unknown>;
			const firstKey = Object.keys(objectEntry)[0];
			if (!firstKey) return null;
			const direction = toText(objectEntry[firstKey]).toLowerCase() === 'desc' ? 'desc' : 'asc';
			return { [firstKey]: direction };
		}

		return null;
	};

	if (Array.isArray(rawSort)) {
		return rawSort.map(toItem).filter(Boolean) as Array<Record<string, 'asc' | 'desc'>>;
	}

	if (typeof rawSort === 'object') {
		return Object.keys(rawSort as Record<string, unknown>)
			.sort((a, b) => Number(a) - Number(b))
			.map((key) => toItem((rawSort as Record<string, unknown>)[key]))
			.filter(Boolean) as Array<Record<string, 'asc' | 'desc'>>;
	}

	const single = toItem(rawSort);
	return single ? [single] : [];
}

function normalizePopulateInput(rawPopulate: unknown): unknown {
	if (!rawPopulate) return undefined;

	if (rawPopulate === '*' || rawPopulate === true) {
		return true;
	}

	const toName = (value: unknown): string => toText(value);

	if (Array.isArray(rawPopulate)) {
		const names = rawPopulate.map(toName).filter(Boolean);
		if (names.length === 0) return undefined;
		return names;
	}

	if (typeof rawPopulate === 'object') {
		const values = Object.values(rawPopulate as Record<string, unknown>);
		const names = values.map(toName).filter(Boolean);
		if (names.length === 0) return undefined;
		return names;
	}

	const single = toName(rawPopulate);
	return single ? [single] : undefined;
}

function resolveCurrentTenantId(ctx: any): number | string {
	if (ctx.state?.tenantConflict) {
		ctx.throw(400, 'Tenant context conflict');
	}

	const tenantId = ctx.state?.tenantId ?? ctx.state?.tenant?.id;
	if (tenantId === null || tenantId === undefined || tenantId === '') {
		ctx.throw(400, 'Tenant context is required');
	}

	return tenantId;
}

function resolveRequestData(ctx: any): GenericRecord {
	const body = (ctx.request.body ??= {});
	if (!body.data || typeof body.data !== 'object' || Array.isArray(body.data)) {
		body.data = {};
	}

	return body.data as GenericRecord;
}

function whereByParam(ref: RelationRef): Record<string, unknown> | null {
	const raw = toText(ref);
	if (!raw) return null;

	const parsed = Number(raw);
	if (Number.isInteger(parsed) && parsed > 0) {
		return { id: parsed };
	}

	return { documentId: raw };
}

async function findEntityByRef(uid: string, ref: RelationRef) {
	const where = whereByParam(ref);
	if (!where) return null;

	return strapi.db.query(uid).findOne({
		where,
		populate: {
			tenant: {
				select: ['id', 'documentId'],
			},
		},
	});
}

function assertEntityTenantMatch(ctx: any, entity: any, tenantId: number | string, entityLabel: string) {
	if (!entity) {
		ctx.throw(400, `${entityLabel} is invalid`);
	}

	const entityTenantRef = extractRelationRef(entity?.tenant);
	if (toRelationKey(entityTenantRef) !== toRelationKey(tenantId)) {
		ctx.throw(403, `You do not have permission to access this ${entityLabel}`);
	}
}

async function findHistoryByParam(idParam: unknown) {
	return findEntityByRef(EMPLOYEE_HISTORY_UID, extractRelationRef(idParam));
}

async function assertHistoryInCurrentTenant(ctx: any, tenantId: number | string) {
	const history = await findHistoryByParam(ctx.params?.id);

	if (!history) {
		ctx.throw(404, 'Employee history not found');
	}

	assertEntityTenantMatch(ctx, history, tenantId, 'employee history');
	return history;
}

async function validateHistoryRelationsInTenant(ctx: any, payload: GenericRecord, tenantId: number | string) {
	const employeeRef = extractRelationRef(payload.employee);
	if (employeeRef === null) {
		ctx.throw(400, 'employee is required');
	}
	const employee = await findEntityByRef(EMPLOYEE_UID, employeeRef);
	assertEntityTenantMatch(ctx, employee, tenantId, 'employee');

	const departmentRef = extractRelationRef(payload.department);
	if (departmentRef === null) {
		ctx.throw(400, 'department is required');
	}
	const department = await findEntityByRef(DEPARTMENT_UID, departmentRef);
	assertEntityTenantMatch(ctx, department, tenantId, 'department');

	const positionRef = extractRelationRef(payload.position);
	if (positionRef === null) {
		ctx.throw(400, 'position is required');
	}
	const position = await findEntityByRef(POSITION_UID, positionRef);
	assertEntityTenantMatch(ctx, position, tenantId, 'position');

	if (hasOwn(payload, 'manager')) {
		const managerRef = extractRelationRef(payload.manager);
		if (managerRef !== null) {
			const manager = await findEntityByRef(EMPLOYEE_UID, managerRef);
			assertEntityTenantMatch(ctx, manager, tenantId, 'manager');
		}
	}
}

function pickAllowedHistoryData(input: GenericRecord): GenericRecord {
	const allowedKeys = [
		'startDate',
		'endDate',
		'assignmentType',
		'isPrimary',
		'isCurrent',
		'decisionNo',
		'note',
		'employee',
		'department',
		'position',
		'manager',
	];

	const payload: GenericRecord = {};
	for (const key of allowedKeys) {
		if (hasOwn(input, key)) {
			payload[key] = input[key];
		}
	}

	return payload;
}

export default factories.createCoreController(EMPLOYEE_HISTORY_UID, () => ({
	async find(ctx) {
		const tenantId = resolveCurrentTenantId(ctx);

		const query = (ctx.query || {}) as Record<string, unknown>;
		const page = toPositiveInt((query.pagination as Record<string, unknown> | undefined)?.page, 1);
		const pageSize = toPositiveInt((query.pagination as Record<string, unknown> | undefined)?.pageSize, 10);
		const start = (page - 1) * pageSize;

		const where = mergeFilters(query.filters, tenantId);
		const orderBy = normalizeSortInput(query.sort);
		const populate = normalizePopulateInput(query.populate);

		const [rows, total] = await Promise.all([
			strapi.db.query(EMPLOYEE_HISTORY_UID).findMany({
				where,
				orderBy: orderBy.length > 0 ? orderBy : undefined,
				offset: start,
				limit: pageSize,
				populate,
			}),
			strapi.db.query(EMPLOYEE_HISTORY_UID).count({ where }),
		]);

		const pageCount = Math.max(1, Math.ceil(total / pageSize));

		return this.transformResponse(rows, {
			pagination: {
				page,
				pageSize,
				pageCount,
				total,
			},
		});
	},

	async findOne(ctx) {
		const tenantId = resolveCurrentTenantId(ctx);
		await assertHistoryInCurrentTenant(ctx, tenantId);
		return await super.findOne(ctx);
	},

	async create(ctx) {
		const tenantId = resolveCurrentTenantId(ctx);
		const data = resolveRequestData(ctx);
		const payload = pickAllowedHistoryData(data);
		await validateHistoryRelationsInTenant(ctx, payload, tenantId);
		payload.tenant = tenantId;

		const created = await strapi.db.query(EMPLOYEE_HISTORY_UID).create({
			data: payload,
		});

		const populatedCreated = await strapi.db.query(EMPLOYEE_HISTORY_UID).findOne({
			where: { id: created.id },
			populate: normalizePopulateInput(ctx.query?.populate),
		});

		return this.transformResponse(populatedCreated ?? created);
	},

	async update(ctx) {
		const tenantId = resolveCurrentTenantId(ctx);
		const history = await assertHistoryInCurrentTenant(ctx, tenantId);

		const data = resolveRequestData(ctx);
		const payload = pickAllowedHistoryData(data);

		const baseEntity = history || {};
		if (!hasOwn(payload, 'employee')) payload.employee = (baseEntity as any).employee;
		if (!hasOwn(payload, 'department')) payload.department = (baseEntity as any).department;
		if (!hasOwn(payload, 'position')) payload.position = (baseEntity as any).position;

		await validateHistoryRelationsInTenant(ctx, payload, tenantId);
		payload.tenant = tenantId;

		const updated = await strapi.db.query(EMPLOYEE_HISTORY_UID).update({
			where: { id: history.id },
			data: payload,
		});

		const populatedUpdated = await strapi.db.query(EMPLOYEE_HISTORY_UID).findOne({
			where: { id: history.id },
			populate: normalizePopulateInput(ctx.query?.populate),
		});

		return this.transformResponse(populatedUpdated ?? updated);
	},

	async delete(ctx) {
		const tenantId = resolveCurrentTenantId(ctx);
		await assertHistoryInCurrentTenant(ctx, tenantId);
		return await super.delete(ctx);
	},
}));
