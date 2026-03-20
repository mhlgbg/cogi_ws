type GenericRecord = Record<string, unknown>;
export type RelationRef = string | number | null;

export function hasOwn(data: GenericRecord, key: string): boolean {
	return Object.prototype.hasOwnProperty.call(data, key);
}

export function toText(value: unknown): string {
	if (value === null || value === undefined) return '';
	return String(value).trim();
}

export function toRelationKey(value: unknown): string | null {
	const text = toText(value);
	return text || null;
}

export function extractRelationRef(value: unknown): RelationRef {
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

export function resolveCurrentTenantId(ctx: any): number | string {
	if (ctx.state?.tenantConflict) {
		ctx.throw(400, 'Tenant context conflict');
	}

	const tenantId = ctx.state?.tenantId ?? ctx.state?.tenant?.id;
	if (tenantId === null || tenantId === undefined || tenantId === '') {
		ctx.throw(400, 'Tenant context is required');
	}

	return tenantId;
}

export function mergeTenantWhere(baseWhere: unknown, tenantId: number | string) {
	const tenantFilter = {
		tenant: {
			id: {
				$eq: tenantId,
			},
		},
	};

	if (!baseWhere || typeof baseWhere !== 'object') {
		return tenantFilter;
	}

	return {
		$and: [baseWhere, tenantFilter],
	};
}

export function toPositiveInt(value: unknown, fallback: number): number {
	const parsed = Number(value);
	if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
	return Math.floor(parsed);
}

export function parseOptionalPositiveInt(value: unknown): number | null {
	const parsed = Number(value);
	return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

export function normalizeSortInput(rawSort: unknown): Array<Record<string, 'asc' | 'desc'>> {
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

export function normalizePopulateInput(rawPopulate: unknown): unknown {
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

export function whereByParam(idParam: unknown) {
	const rawId = toText(idParam);
	if (!rawId) return null;

	const parsedId = Number(rawId);
	return Number.isInteger(parsedId) && parsedId > 0
		? { id: parsedId }
		: { documentId: rawId };
}

export async function findEntityByRef(uid: string, ref: unknown, populate?: unknown) {
	const where = whereByParam(extractRelationRef(ref));
	if (!where) return null;

	return strapi.db.query(uid).findOne({
		where,
		populate,
	});
}

export function assertEntityTenantMatch(entity: any, tenantId: number | string, message: string, ctx: any) {
	if (!entity) {
		ctx.throw(400, message);
	}

	const entityTenantRef = extractRelationRef(entity?.tenant);
	if (toRelationKey(entityTenantRef) !== toRelationKey(tenantId)) {
		ctx.throw(403, message);
	}

	return entity;
}
