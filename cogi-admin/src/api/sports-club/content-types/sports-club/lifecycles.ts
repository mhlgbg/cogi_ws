import { errors } from '@strapi/utils';
import { extractRelationRef, hasOwn, toText, whereByParam } from '../../../../utils/tenant-scope';

const SPORTS_CLUB_UID = 'api::sports-club.sports-club';

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

function normalizeOptionalString(value: unknown, maxLength?: number): string | null {
	const text = toText(value);
	if (!text) return null;
	if (maxLength && text.length > maxLength) {
		throw new errors.ApplicationError(`text exceeds max length ${maxLength}`);
	}
	return text;
}

function normalizeRequiredString(value: unknown, fieldName: string, maxLength?: number): string {
	const text = toText(value);
	if (!text) throw new errors.ApplicationError(`${fieldName} is required`);
	if (maxLength && text.length > maxLength) {
		throw new errors.ApplicationError(`${fieldName} exceeds max length ${maxLength}`);
	}
	return text;
}

function normalizeEmail(value: unknown): string | null {
	const text = toText(value).toLowerCase();
	if (!text) return null;
	if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(text)) {
		throw new errors.ApplicationError('contactEmail is invalid');
	}
	return text;
}

function slugify(value: unknown): string {
	return toText(value)
		.normalize('NFD')
		.replace(/[\u0300-\u036f]/g, '')
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-+|-+$/g, '');
}

function normalizeStatus(value: unknown): 'active' | 'inactive' | 'archived' {
	const text = toText(value).toLowerCase();
	if (text === 'inactive' || text === 'archived') return text;
	return 'active';
}

function normalizeClubType(value: unknown): 'community' | 'club' | 'team' | 'chapter' | 'training_group' | 'other' {
	const text = toText(value).toLowerCase();
	if (['community', 'team', 'chapter', 'training_group', 'other'].includes(text)) {
		return text as 'community' | 'club' | 'team' | 'chapter' | 'training_group' | 'other';
	}
	return 'club';
}

function normalizeSportType(value: unknown): 'running' | 'cycling' | 'badminton' | 'football' | 'swimming' | 'multisport' | 'other' {
	const text = toText(value).toLowerCase();
	if (['cycling', 'badminton', 'football', 'swimming', 'multisport', 'other'].includes(text)) {
		return text as 'running' | 'cycling' | 'badminton' | 'football' | 'swimming' | 'multisport' | 'other';
	}
	return 'running';
}

function normalizeJoinPolicy(value: unknown): 'open' | 'approval' | 'invite_only' | 'closed' {
	const text = toText(value).toLowerCase();
	if (text === 'open' || text === 'invite_only' || text === 'closed') return text;
	return 'approval';
}

function normalizeDate(value: unknown, fieldName: string): string | null {
	const text = toText(value);
	if (!text) return null;
	const date = new Date(text);
	if (Number.isNaN(date.getTime())) {
		throw new errors.ApplicationError(`${fieldName} is invalid`);
	}
	return date.toISOString().slice(0, 10);
}

async function loadExistingClub(where: unknown) {
	const normalizedWhere = typeof where === 'object' && where !== null
		? Object.fromEntries(
			Object.entries(where as Record<string, unknown>).filter(
				([key, value]) => !(key === 'locale' && (value === '' || value === null)),
			),
		)
		: where;

	if (!normalizedWhere) return null;

	return strapi.db.query(SPORTS_CLUB_UID).findOne({
		where: normalizedWhere,
		populate: {
			tenant: { select: ['id', 'documentId'] },
			parentClub: { select: ['id', 'documentId'] },
			logo: { select: ['id'] },
			coverImage: { select: ['id'] },
		},
	});
}

async function findClubsByTenantAndCode(tenantRef: string | number, code: string) {
	return strapi.db.query(SPORTS_CLUB_UID).findMany({
		where: {
			tenant: { id: { $eq: tenantRef } },
			code: { $eq: code },
		},
		select: ['id', 'code'],
	});
}

async function findClubsByTenantAndSlug(tenantRef: string | number, slug: string) {
	return strapi.db.query(SPORTS_CLUB_UID).findMany({
		where: {
			tenant: { id: { $eq: tenantRef } },
			slug: { $eq: slug },
		},
		select: ['id', 'slug'],
	});
}

async function loadClubInTenant(ref: unknown, tenantRef: string | number) {
	const where = whereByParam(ref);
	if (!where) return null;
	return strapi.db.query(SPORTS_CLUB_UID).findOne({
		where: {
			$and: [
				where,
				{ tenant: { id: { $eq: tenantRef } } },
			],
		},
		populate: {
			parentClub: { select: ['id', 'documentId'] },
			tenant: { select: ['id', 'documentId'] },
		},
		select: ['id', 'documentId', 'code', 'slug'],
	});
}

async function ensureNoParentCycle(options: { tenantRef: string | number; currentId?: string | number | null; parentRef: string | number | null }) {
	const { tenantRef, currentId, parentRef } = options;
	if (!parentRef || !currentId) return;

	const targetId = String(currentId);
	const visited = new Set<string>();
	let cursorRef: string | number | null = parentRef;
	let hops = 0;

	while (cursorRef && hops < 50) {
		const club = await loadClubInTenant(cursorRef, tenantRef);
		if (!club?.id) return;
		const clubId = String(club.id);
		if (clubId === targetId) {
			throw new errors.ApplicationError('parentClub causes a cycle');
		}
		if (visited.has(clubId)) {
			throw new errors.ApplicationError('parentClub causes a cycle');
		}
		visited.add(clubId);
		cursorRef = extractEntryRelationRef(club.parentClub);
		hops += 1;
	}

	if (hops >= 50) {
		throw new errors.ApplicationError('parentClub hierarchy is too deep');
	}
}

async function ensureSportsClubValid(params: { data?: GenericRecord; where?: unknown }) {
	const data = (params.data || {}) as GenericRecord;
	const existing = await loadExistingClub(params.where);
	const requestTenantId = getRequestContextTenantId();

	if ((data.tenant === null || data.tenant === undefined || data.tenant === '') && requestTenantId) {
		data.tenant = requestTenantId;
	}

	const tenantRef = extractRelationRef(data.tenant) || extractEntryRelationRef(existing?.tenant) || requestTenantId;
	const code = hasOwn(data, 'code')
		? normalizeRequiredString(data.code, 'code', 100).toUpperCase()
		: normalizeRequiredString(existing?.code, 'code', 100).toUpperCase();
	const name = hasOwn(data, 'name')
		? normalizeRequiredString(data.name, 'name', 150)
		: normalizeRequiredString(existing?.name, 'name', 150);
	const shortName = hasOwn(data, 'shortName') ? normalizeOptionalString(data.shortName, 100) : normalizeOptionalString(existing?.shortName, 100);
	const slugInput = hasOwn(data, 'slug') ? toText(data.slug) : (toText(existing?.slug) || slugify(name));
	const slug = slugify(slugInput);
	const description = hasOwn(data, 'description') ? normalizeOptionalString(data.description) : normalizeOptionalString(existing?.description);
	const clubType = hasOwn(data, 'clubType') ? normalizeClubType(data.clubType) : normalizeClubType(existing?.clubType);
	const sportType = hasOwn(data, 'sportType') ? normalizeSportType(data.sportType) : normalizeSportType(existing?.sportType);
	const status = hasOwn(data, 'status') ? normalizeStatus(data.status) : normalizeStatus(existing?.status);
	const joinPolicy = hasOwn(data, 'joinPolicy') ? normalizeJoinPolicy(data.joinPolicy) : normalizeJoinPolicy(existing?.joinPolicy);
	const foundedAt = hasOwn(data, 'foundedAt') ? normalizeDate(data.foundedAt, 'foundedAt') : normalizeDate(existing?.foundedAt, 'foundedAt');
	const contactPhone = hasOwn(data, 'contactPhone') ? normalizeOptionalString(data.contactPhone, 30) : normalizeOptionalString(existing?.contactPhone, 30);
	const contactEmail = hasOwn(data, 'contactEmail') ? normalizeEmail(data.contactEmail) : normalizeEmail(existing?.contactEmail);
	const address = hasOwn(data, 'address') ? normalizeOptionalString(data.address) : normalizeOptionalString(existing?.address);
	const website = hasOwn(data, 'website') ? normalizeOptionalString(data.website, 255) : normalizeOptionalString(existing?.website, 255);
	const parentClubRef = hasOwn(data, 'parentClub') ? extractRelationRef(data.parentClub) : extractEntryRelationRef(existing?.parentClub);

	if (!tenantRef) {
		throw new errors.ApplicationError('tenant is required');
	}

	if (!slug) {
		throw new errors.ApplicationError('slug is required');
	}

	const siblingsByCode = await findClubsByTenantAndCode(tenantRef, code);
	const siblingsBySlug = await findClubsByTenantAndSlug(tenantRef, slug);
	const ignoreId = existing?.id ? String(existing.id) : null;
	const duplicateCode = (siblingsByCode || []).find((item: any) => !ignoreId || String(item?.id) !== ignoreId);
	if (duplicateCode) {
		throw new errors.ApplicationError('tenant + code must be unique');
	}
	const duplicateSlug = (siblingsBySlug || []).find((item: any) => !ignoreId || String(item?.id) !== ignoreId);
	if (duplicateSlug) {
		throw new errors.ApplicationError('tenant + slug must be unique');
	}

	let parentClub = null;
	if (parentClubRef) {
		parentClub = await loadClubInTenant(parentClubRef, tenantRef);
		if (!parentClub?.id) {
			throw new errors.ApplicationError('parentClub must belong to current tenant');
		}
		if (existing?.id && String(parentClub.id) === String(existing.id)) {
			throw new errors.ApplicationError('parentClub cannot reference itself');
		}
		await ensureNoParentCycle({ tenantRef, currentId: existing?.id || null, parentRef: parentClub.id });
	}

	data.tenant = tenantRef;
	data.code = code;
	data.name = name;
	data.shortName = shortName;
	data.slug = slug;
	data.description = description;
	data.clubType = clubType;
	data.sportType = sportType;
	data.status = status;
	data.joinPolicy = joinPolicy;
	data.foundedAt = foundedAt;
	data.contactPhone = contactPhone;
	data.contactEmail = contactEmail;
	data.address = address;
	data.website = website;
	data.parentClub = parentClub?.id || null;
	if (hasOwn(data, 'logo') && (data.logo === '' || data.logo === undefined)) data.logo = null;
	if (hasOwn(data, 'coverImage') && (data.coverImage === '' || data.coverImage === undefined)) data.coverImage = null;
}

export default {
	async beforeCreate(event: any) {
		await ensureSportsClubValid({ data: event.params?.data });
	},

	async beforeUpdate(event: any) {
		await ensureSportsClubValid({ data: event.params?.data, where: event.params?.where });
	},
};