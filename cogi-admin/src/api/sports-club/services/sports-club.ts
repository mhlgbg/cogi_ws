import { extractRelationRef, hasOwn, mergeTenantWhere, normalizeSortInput, toPositiveInt, toText, whereByParam } from '../../../utils/tenant-scope';

const SPORTS_CLUB_UID = 'api::sports-club.sports-club' as any;

type HttpErrorDetails = Record<string, unknown> | Array<Record<string, unknown>> | null;
type GenericRecord = Record<string, unknown>;

const STATUS_VALUES = new Set(['active', 'inactive', 'archived']);
const CLUB_TYPE_VALUES = new Set(['community', 'club', 'team', 'chapter', 'training_group', 'other']);
const SPORT_TYPE_VALUES = new Set(['running', 'cycling', 'badminton', 'football', 'swimming', 'multisport', 'other']);
const JOIN_POLICY_VALUES = new Set(['open', 'approval', 'invite_only', 'closed']);

export class SportsClubError extends Error {
	status: number;
	code?: string | null;
	details?: HttpErrorDetails;

	constructor(status: number, message: string, code?: string | null, details?: HttpErrorDetails) {
		super(message);
		this.status = status;
		this.code = code || null;
		this.details = typeof details === 'undefined' ? null : details;
	}
}

function httpError(status: number, message: string, code?: string, details?: HttpErrorDetails): never {
	throw new SportsClubError(status, message, code, details);
}

function ensureNoUnknownFields(payload: GenericRecord, allowedFields: string[]) {
	const allowed = new Set(allowedFields);
	const unknown = Object.keys(payload || {}).filter((key) => !allowed.has(key));
	if (unknown.length > 0) {
		httpError(400, 'payload contains unknown fields', 'UNKNOWN_FIELDS', { fields: unknown });
	}
}

function ensureNoUnknownWriteFields(payload: GenericRecord) {
	ensureNoUnknownFields(payload, [
		'parentClub',
		'code',
		'name',
		'shortName',
		'slug',
		'clubType',
		'sportType',
		'description',
		'logo',
		'coverImage',
		'status',
		'joinPolicy',
		'foundedAt',
		'contactPhone',
		'contactEmail',
		'address',
		'website',
	]);
	if (Object.prototype.hasOwnProperty.call(payload, 'tenant')) {
		httpError(400, 'tenant is managed by tenant context', 'TENANT_CONTEXT_ONLY');
	}
}

function normalizeOptionalText(value: unknown, maxLength?: number): string | null {
	const text = toText(value);
	if (!text) return null;
	if (maxLength && text.length > maxLength) {
		httpError(400, `Text exceeds max length ${maxLength}`, 'INVALID_TEXT_LENGTH');
	}
	return text;
}

function normalizeRequiredText(value: unknown, fieldName: string, maxLength?: number): string {
	const text = toText(value);
	if (!text) {
		httpError(400, `${fieldName} is required`, 'INVALID_REQUEST_BODY', { field: fieldName });
	}
	if (maxLength && text.length > maxLength) {
		httpError(400, `${fieldName} max length is ${maxLength}`, 'INVALID_REQUEST_BODY', { field: fieldName });
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

function normalizeCode(value: unknown) {
	return normalizeRequiredText(value, 'code', 100).toUpperCase();
}

function normalizeEmail(value: unknown, fieldName = 'contactEmail'): string | null {
	const text = toText(value).toLowerCase();
	if (!text) return null;
	if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(text)) {
		httpError(400, `${fieldName} is invalid`, 'INVALID_EMAIL', { field: fieldName });
	}
	return text;
}

function normalizeDate(value: unknown, fieldName: string): string | null {
	const text = toText(value);
	if (!text) return null;
	const date = new Date(text);
	if (Number.isNaN(date.getTime())) {
		httpError(400, `${fieldName} is invalid`, 'INVALID_DATE', { field: fieldName });
	}
	return date.toISOString().slice(0, 10);
}

function normalizeStatus(value: unknown): 'active' | 'inactive' | 'archived' {
	const text = toText(value).toLowerCase() || 'active';
	if (!STATUS_VALUES.has(text)) {
		httpError(400, 'status is invalid', 'INVALID_STATUS', { field: 'status' });
	}
	return text as 'active' | 'inactive' | 'archived';
}

function normalizeClubType(value: unknown): 'community' | 'club' | 'team' | 'chapter' | 'training_group' | 'other' {
	const text = toText(value).toLowerCase() || 'club';
	if (!CLUB_TYPE_VALUES.has(text)) {
		httpError(400, 'clubType is invalid', 'INVALID_CLUB_TYPE', { field: 'clubType' });
	}
	return text as 'community' | 'club' | 'team' | 'chapter' | 'training_group' | 'other';
}

function normalizeSportType(value: unknown): 'running' | 'cycling' | 'badminton' | 'football' | 'swimming' | 'multisport' | 'other' {
	const text = toText(value).toLowerCase() || 'running';
	if (!SPORT_TYPE_VALUES.has(text)) {
		httpError(400, 'sportType is invalid', 'INVALID_SPORT_TYPE', { field: 'sportType' });
	}
	return text as 'running' | 'cycling' | 'badminton' | 'football' | 'swimming' | 'multisport' | 'other';
}

function normalizeJoinPolicy(value: unknown): 'open' | 'approval' | 'invite_only' | 'closed' {
	const text = toText(value).toLowerCase() || 'approval';
	if (!JOIN_POLICY_VALUES.has(text)) {
		httpError(400, 'joinPolicy is invalid', 'INVALID_JOIN_POLICY', { field: 'joinPolicy' });
	}
	return text as 'open' | 'approval' | 'invite_only' | 'closed';
}

function normalizeMediaId(value: unknown, fieldName: string) {
	if (value === null || value === undefined || value === '') return null;
	const relationRef = extractRelationRef(value);
	const parsed = Number(relationRef ?? value);
	if (!Number.isInteger(parsed) || parsed <= 0) {
		httpError(400, `${fieldName} is invalid`, 'INVALID_MEDIA', { field: fieldName });
	}
	return parsed;
}

function normalizeBooleanFilter(value: unknown): boolean | null {
	if (typeof value === 'boolean') return value;
	const text = toText(value).toLowerCase();
	if (!text) return null;
	if (text === 'true' || text === '1' || text === 'yes') return true;
	if (text === 'false' || text === '0' || text === 'no') return false;
	return null;
}

function mapMedia(media: any) {
	if (!media?.id) return null;
	return {
		id: Number(media.id),
		name: toText(media.name) || null,
		url: toText(media.url) || null,
		mime: toText(media.mime) || null,
	};
}

function mapParentClub(club: any) {
	if (!club?.id) return null;
	return {
		id: Number(club.id),
		documentId: toText(club.documentId) || null,
		code: toText(club.code) || null,
		name: toText(club.name) || null,
		slug: toText(club.slug) || null,
		clubType: toText(club.clubType) || null,
		status: toText(club.status) || null,
	};
}

function mapSportsClubRow(row: any, options: { includeLongText?: boolean } = {}) {
	return {
		id: Number(row?.id || 0),
		documentId: row?.documentId || null,
		code: toText(row?.code),
		name: toText(row?.name),
		shortName: normalizeOptionalText(row?.shortName, 100),
		slug: toText(row?.slug),
		clubType: toText(row?.clubType).toLowerCase() || 'club',
		sportType: toText(row?.sportType).toLowerCase() || 'running',
		description: options.includeLongText ? normalizeOptionalText(row?.description) : normalizeOptionalText(row?.description, 240),
		logo: mapMedia(row?.logo),
		coverImage: mapMedia(row?.coverImage),
		status: toText(row?.status).toLowerCase() || 'active',
		joinPolicy: toText(row?.joinPolicy).toLowerCase() || 'approval',
		foundedAt: row?.foundedAt || null,
		contactPhone: normalizeOptionalText(row?.contactPhone, 30),
		contactEmail: normalizeEmail(row?.contactEmail),
		address: normalizeOptionalText(row?.address),
		website: normalizeOptionalText(row?.website, 255),
		parentClub: mapParentClub(row?.parentClub),
		childClubs: Array.isArray(row?.childClubs) ? row.childClubs.map((item: any) => mapParentClub(item)).filter(Boolean) : [],
		createdAt: row?.createdAt || null,
		updatedAt: row?.updatedAt || null,
	};
}

function buildListWhere(query: Record<string, unknown>) {
	const clauses: Array<Record<string, unknown>> = [];
	const keyword = toText(query.search ?? query.q);
	const status = toText(query.status).toLowerCase();
	const clubType = toText(query.clubType).toLowerCase();
	const sportType = toText(query.sportType).toLowerCase();
	const joinPolicy = toText(query.joinPolicy).toLowerCase();
	const rootOnly = normalizeBooleanFilter(query.rootOnly);
	const parentClub = extractRelationRef(query.parentClub);

	if (keyword) {
		clauses.push({
			$or: [
				{ code: { $containsi: keyword } },
				{ name: { $containsi: keyword } },
				{ shortName: { $containsi: keyword } },
				{ slug: { $containsi: keyword } },
				{ contactPhone: { $containsi: keyword } },
				{ contactEmail: { $containsi: keyword } },
			],
		});
	}

	if (status && STATUS_VALUES.has(status)) clauses.push({ status: { $eq: status } });
	if (clubType && CLUB_TYPE_VALUES.has(clubType)) clauses.push({ clubType: { $eq: clubType } });
	if (sportType && SPORT_TYPE_VALUES.has(sportType)) clauses.push({ sportType: { $eq: sportType } });
	if (joinPolicy && JOIN_POLICY_VALUES.has(joinPolicy)) clauses.push({ joinPolicy: { $eq: joinPolicy } });
	if (rootOnly === true) clauses.push({ parentClub: { id: { $null: true } } });
	if (parentClub) {
		const parentWhere = whereByParam(parentClub);
		if (parentWhere?.id) clauses.push({ parentClub: { id: { $eq: parentWhere.id } } });
		if (parentWhere?.documentId) clauses.push({ parentClub: { documentId: { $eq: parentWhere.documentId } } });
	}

	if (clauses.length === 0) return {};
	if (clauses.length === 1) return clauses[0];
	return { $and: clauses };
}

function resolveOrderBy(query: Record<string, unknown>) {
	const normalizedSort = normalizeSortInput(query?.sort);
	if (normalizedSort.length > 0) {
		const allowed = new Set(['code', 'name', 'shortName', 'slug', 'clubType', 'sportType', 'joinPolicy', 'status', 'foundedAt', 'updatedAt', 'createdAt']);
		const safe = normalizedSort
			.map((entry) => {
				const key = Object.keys(entry)[0];
				if (!allowed.has(key)) return null;
				return { [key]: entry[key] } as Record<string, 'asc' | 'desc'>;
			})
			.filter(Boolean) as Array<Record<string, 'asc' | 'desc'>>;
		if (safe.length > 0) return safe;
	}

	return [{ updatedAt: 'desc' }, { name: 'asc' }, { id: 'asc' }];
}

async function ensureMediaExists(mediaId: number | null, fieldName: string) {
	if (!mediaId) return null;
	const media = await strapi.db.query('plugin::upload.file').findOne({
		where: { id: mediaId },
		select: ['id'],
	});
	if (!media?.id) {
		httpError(400, `${fieldName} is invalid`, 'INVALID_MEDIA', { field: fieldName });
	}
	return mediaId;
}

async function findSportsClubInTenant(clubRef: unknown, tenantId: number | string, transacting?: any) {
	const where = whereByParam(clubRef);
	if (!where) {
		httpError(404, 'Sports club not found', 'SPORTS_CLUB_NOT_FOUND');
	}

	const club = await strapi.db.query(SPORTS_CLUB_UID).findOne({
		where: mergeTenantWhere(where, tenantId),
		populate: {
			parentClub: { select: ['id', 'documentId', 'code', 'name', 'slug', 'clubType', 'status'] },
			childClubs: { select: ['id', 'documentId', 'code', 'name', 'slug', 'clubType', 'status'] },
			logo: { select: ['id', 'name', 'url', 'mime'] },
			coverImage: { select: ['id', 'name', 'url', 'mime'] },
		},
		...(transacting ? { transacting } : {}),
	} as any);

	if (!club?.id) {
		httpError(404, 'Sports club not found', 'SPORTS_CLUB_NOT_FOUND');
	}

	return club;
}

async function findSportsClubByCode(tenantId: number | string, code: string, transacting?: any) {
	if (!code) return null;
	return await strapi.db.query(SPORTS_CLUB_UID).findOne({
		where: mergeTenantWhere({ code: { $eq: code } }, tenantId),
		select: ['id', 'documentId', 'code'],
		...(transacting ? { transacting } : {}),
	} as any);
}

async function findSportsClubBySlug(tenantId: number | string, slug: string, transacting?: any) {
	if (!slug) return null;
	return await strapi.db.query(SPORTS_CLUB_UID).findOne({
		where: mergeTenantWhere({ slug: { $eq: slug } }, tenantId),
		select: ['id', 'documentId', 'slug'],
		...(transacting ? { transacting } : {}),
	} as any);
}

function isPostgresClient() {
	const client = String(strapi.db?.connection?.client?.config?.client || '').toLowerCase();
	return client.includes('pg');
}

async function acquireSportsClubCodeLock(trx: any, tenantId: number | string, code: string) {
	if (!isPostgresClient()) return;
	await trx.raw('select pg_advisory_xact_lock(hashtext(?), hashtext(?))', [String(tenantId), `sports-club-code:${String(code || '').toUpperCase()}`]);
}

async function acquireSportsClubSlugLock(trx: any, tenantId: number | string, slug: string) {
	if (!isPostgresClient()) return;
	await trx.raw('select pg_advisory_xact_lock(hashtext(?), hashtext(?))', [String(tenantId), `sports-club-slug:${String(slug || '').toLowerCase()}`]);
}

async function ensureParentClubValid(parentRef: unknown, tenantId: number | string, currentClubId?: number | null, transacting?: any) {
	const relationRef = extractRelationRef(parentRef);
	if (!relationRef) return null;

	const parent = await findSportsClubInTenant(relationRef, tenantId, transacting);
	if (!parent?.id) {
		httpError(400, 'parentClub must belong to current tenant', 'PARENT_CLUB_OUTSIDE_TENANT', { field: 'parentClub' });
	}
	if (currentClubId && Number(parent.id) === Number(currentClubId)) {
		httpError(400, 'parentClub cannot reference itself', 'PARENT_CLUB_SELF_REFERENCE', { field: 'parentClub' });
	}

	if (currentClubId) {
		const visited = new Set<string>();
		let cursor: any = parent;
		let hops = 0;
		while (cursor?.id && hops < 50) {
			const cursorId = String(cursor.id);
			if (cursorId === String(currentClubId)) {
				httpError(400, 'parentClub causes a cycle', 'PARENT_CLUB_CYCLE', { field: 'parentClub' });
			}
			if (visited.has(cursorId)) {
				httpError(400, 'parentClub causes a cycle', 'PARENT_CLUB_CYCLE', { field: 'parentClub' });
			}
			visited.add(cursorId);
			const nextRef = extractRelationRef(cursor.parentClub);
			if (!nextRef) break;
			cursor = await findSportsClubInTenant(nextRef, tenantId, transacting);
			hops += 1;
		}
		if (hops >= 50) {
			httpError(400, 'parentClub hierarchy is too deep', 'PARENT_CLUB_DEPTH_LIMIT', { field: 'parentClub' });
		}
	}

	return parent;
}

function buildWriteData(input: GenericRecord, existing?: any) {
	const code = hasOwn(input, 'code') ? normalizeCode(input.code) : normalizeCode(existing?.code);
	const name = hasOwn(input, 'name') ? normalizeRequiredText(input.name, 'name', 150) : normalizeRequiredText(existing?.name, 'name', 150);
	const slug = hasOwn(input, 'slug') ? slugify(input.slug) : (toText(existing?.slug) || slugify(name));
	if (!slug) {
		httpError(400, 'slug is required', 'INVALID_REQUEST_BODY', { field: 'slug' });
	}

	return {
		code,
		name,
		shortName: hasOwn(input, 'shortName') ? normalizeOptionalText(input.shortName, 100) : normalizeOptionalText(existing?.shortName, 100),
		slug,
		clubType: hasOwn(input, 'clubType') ? normalizeClubType(input.clubType) : normalizeClubType(existing?.clubType),
		sportType: hasOwn(input, 'sportType') ? normalizeSportType(input.sportType) : normalizeSportType(existing?.sportType),
		description: hasOwn(input, 'description') ? normalizeOptionalText(input.description) : normalizeOptionalText(existing?.description),
		logo: hasOwn(input, 'logo') ? normalizeMediaId(input.logo, 'logo') : normalizeMediaId(existing?.logo?.id ?? existing?.logo, 'logo'),
		coverImage: hasOwn(input, 'coverImage') ? normalizeMediaId(input.coverImage, 'coverImage') : normalizeMediaId(existing?.coverImage?.id ?? existing?.coverImage, 'coverImage'),
		status: hasOwn(input, 'status') ? normalizeStatus(input.status) : normalizeStatus(existing?.status),
		joinPolicy: hasOwn(input, 'joinPolicy') ? normalizeJoinPolicy(input.joinPolicy) : normalizeJoinPolicy(existing?.joinPolicy),
		foundedAt: hasOwn(input, 'foundedAt') ? normalizeDate(input.foundedAt, 'foundedAt') : normalizeDate(existing?.foundedAt, 'foundedAt'),
		contactPhone: hasOwn(input, 'contactPhone') ? normalizeOptionalText(input.contactPhone, 30) : normalizeOptionalText(existing?.contactPhone, 30),
		contactEmail: hasOwn(input, 'contactEmail') ? normalizeEmail(input.contactEmail) : normalizeEmail(existing?.contactEmail),
		address: hasOwn(input, 'address') ? normalizeOptionalText(input.address) : normalizeOptionalText(existing?.address),
		website: hasOwn(input, 'website') ? normalizeOptionalText(input.website, 255) : normalizeOptionalText(existing?.website, 255),
		parentClub: hasOwn(input, 'parentClub') ? extractRelationRef(input.parentClub) : extractRelationRef(existing?.parentClub),
	};
}

function parseErrorMessage(error: any) {
	return toText(error?.message || error?.details?.message || error?.response?.data?.error?.message);
}

export function handleSportsClubError(ctx: any, error: any) {
	if (error instanceof SportsClubError) {
		ctx.status = error.status;
		ctx.body = {
			error: {
				status: error.status,
				name: 'SportsClubError',
				message: error.message,
				code: error.code || undefined,
				details: error.details || undefined,
			},
		};
		return;
	}

	const message = parseErrorMessage(error);
	if (/tenant \+ code must be unique/i.test(message)) {
		return handleSportsClubError(ctx, new SportsClubError(409, 'Sports club code already exists in this tenant.', 'SPORTS_CLUB_CODE_ALREADY_EXISTS', { field: 'code' }));
	}
	if (/tenant \+ slug must be unique/i.test(message)) {
		return handleSportsClubError(ctx, new SportsClubError(409, 'Sports club slug already exists in this tenant.', 'SPORTS_CLUB_SLUG_ALREADY_EXISTS', { field: 'slug' }));
	}
	if (/parentClub causes a cycle/i.test(message)) {
		return handleSportsClubError(ctx, new SportsClubError(400, 'parentClub causes a cycle', 'PARENT_CLUB_CYCLE', { field: 'parentClub' }));
	}
	if (message) {
		ctx.badRequest(message);
		return;
	}

	strapi.log.error('[sports-club] unexpected error', error);
	ctx.internalServerError('Failed to process sports club request');
}

export async function listTenantSportsClubs(query: Record<string, unknown>, tenantId: number | string) {
	const page = toPositiveInt(query.page, 1);
	const pageSize = toPositiveInt(query.pageSize, 10);
	const start = (page - 1) * pageSize;
	const where = mergeTenantWhere(buildListWhere(query), tenantId);
	const orderBy = resolveOrderBy(query);

	const [rows, total] = await Promise.all([
		strapi.db.query(SPORTS_CLUB_UID).findMany({
			where,
			orderBy,
			offset: start,
			limit: pageSize,
			populate: {
				parentClub: { select: ['id', 'documentId', 'code', 'name', 'slug', 'clubType', 'status'] },
				logo: { select: ['id', 'name', 'url', 'mime'] },
				coverImage: { select: ['id', 'name', 'url', 'mime'] },
			},
		} as any),
		strapi.db.query(SPORTS_CLUB_UID).count({ where } as any),
	]);

	return {
		rows: (rows || []).map((row: any) => mapSportsClubRow(row)),
		pagination: {
			page,
			pageSize,
			pageCount: Math.max(1, Math.ceil(total / pageSize)),
			total,
		},
	};
}

export async function getTenantSportsClub(clubRef: unknown, tenantId: number | string) {
	const club = await findSportsClubInTenant(clubRef, tenantId);
	return mapSportsClubRow(club, { includeLongText: true });
}

export async function createTenantSportsClub(input: GenericRecord, tenantId: number | string) {
	ensureNoUnknownWriteFields(input || {});
	const data = buildWriteData(input || {});
	const logoId = await ensureMediaExists(data.logo as number | null, 'logo');
	const coverImageId = await ensureMediaExists(data.coverImage as number | null, 'coverImage');

	try {
		const createdId = await strapi.db.connection.transaction(async (trx: any) => {
			await acquireSportsClubCodeLock(trx, tenantId, String(data.code || ''));
			await acquireSportsClubSlugLock(trx, tenantId, String(data.slug || ''));
			const duplicateCode = await findSportsClubByCode(tenantId, String(data.code || ''), trx);
			if (duplicateCode?.id) {
				httpError(409, 'Sports club code already exists in this tenant.', 'SPORTS_CLUB_CODE_ALREADY_EXISTS', { field: 'code' });
			}
			const duplicateSlug = await findSportsClubBySlug(tenantId, String(data.slug || ''), trx);
			if (duplicateSlug?.id) {
				httpError(409, 'Sports club slug already exists in this tenant.', 'SPORTS_CLUB_SLUG_ALREADY_EXISTS', { field: 'slug' });
			}

			const parent = await ensureParentClubValid(data.parentClub, tenantId, null, trx);
			const created = await strapi.db.query(SPORTS_CLUB_UID).create({
				data: {
					...data,
					tenant: tenantId,
					parentClub: parent?.id || null,
					logo: logoId,
					coverImage: coverImageId,
				},
				transacting: trx,
			} as any);

			return Number(created.id);
		});

		return await getTenantSportsClub(createdId, tenantId);
	} catch (error) {
		const message = parseErrorMessage(error);
		if (/tenant \+ code must be unique/i.test(message)) {
			httpError(409, 'Sports club code already exists in this tenant.', 'SPORTS_CLUB_CODE_ALREADY_EXISTS', { field: 'code' });
		}
		if (/tenant \+ slug must be unique/i.test(message)) {
			httpError(409, 'Sports club slug already exists in this tenant.', 'SPORTS_CLUB_SLUG_ALREADY_EXISTS', { field: 'slug' });
		}
		throw error;
	}
}

export async function updateTenantSportsClub(clubRef: unknown, input: GenericRecord, tenantId: number | string) {
	ensureNoUnknownWriteFields(input || {});
	const existing = await findSportsClubInTenant(clubRef, tenantId);
	const data = buildWriteData(input || {}, existing);
	const logoId = hasOwn(input, 'logo') ? await ensureMediaExists(data.logo as number | null, 'logo') : (existing.logo?.id ? Number(existing.logo.id) : null);
	const coverImageId = hasOwn(input, 'coverImage') ? await ensureMediaExists(data.coverImage as number | null, 'coverImage') : (existing.coverImage?.id ? Number(existing.coverImage.id) : null);

	try {
		await strapi.db.connection.transaction(async (trx: any) => {
			await acquireSportsClubCodeLock(trx, tenantId, String(data.code || ''));
			await acquireSportsClubSlugLock(trx, tenantId, String(data.slug || ''));
			const duplicateCode = await findSportsClubByCode(tenantId, String(data.code || ''), trx);
			if (duplicateCode?.id && Number(duplicateCode.id) !== Number(existing.id)) {
				httpError(409, 'Sports club code already exists in this tenant.', 'SPORTS_CLUB_CODE_ALREADY_EXISTS', { field: 'code' });
			}
			const duplicateSlug = await findSportsClubBySlug(tenantId, String(data.slug || ''), trx);
			if (duplicateSlug?.id && Number(duplicateSlug.id) !== Number(existing.id)) {
				httpError(409, 'Sports club slug already exists in this tenant.', 'SPORTS_CLUB_SLUG_ALREADY_EXISTS', { field: 'slug' });
			}

			const parent = await ensureParentClubValid(data.parentClub, tenantId, Number(existing.id), trx);
			await strapi.db.query(SPORTS_CLUB_UID).update({
				where: { id: existing.id },
				data: {
					...data,
					tenant: tenantId,
					parentClub: parent?.id || null,
					logo: hasOwn(input, 'logo') ? logoId : (existing.logo?.id || null),
					coverImage: hasOwn(input, 'coverImage') ? coverImageId : (existing.coverImage?.id || null),
				},
				transacting: trx,
			} as any);
		});

		return await getTenantSportsClub(existing.id, tenantId);
	} catch (error) {
		const message = parseErrorMessage(error);
		if (/tenant \+ code must be unique/i.test(message)) {
			httpError(409, 'Sports club code already exists in this tenant.', 'SPORTS_CLUB_CODE_ALREADY_EXISTS', { field: 'code' });
		}
		if (/tenant \+ slug must be unique/i.test(message)) {
			httpError(409, 'Sports club slug already exists in this tenant.', 'SPORTS_CLUB_SLUG_ALREADY_EXISTS', { field: 'slug' });
		}
		throw error;
	}
}

export async function activateTenantSportsClub(clubRef: unknown, tenantId: number | string) {
	const existing = await findSportsClubInTenant(clubRef, tenantId);
	if (toText(existing.status).toLowerCase() === 'active') {
		return mapSportsClubRow(existing, { includeLongText: true });
	}

	await strapi.db.query(SPORTS_CLUB_UID).update({
		where: { id: existing.id },
		data: { status: 'active' },
	} as any);

	return await getTenantSportsClub(existing.id, tenantId);
}

export async function deactivateTenantSportsClub(clubRef: unknown, tenantId: number | string) {
	const existing = await findSportsClubInTenant(clubRef, tenantId);
	if (toText(existing.status).toLowerCase() === 'archived') {
		httpError(409, 'Archived sports club cannot be inactivated.', 'SPORTS_CLUB_ARCHIVED_LOCKED');
	}
	if (toText(existing.status).toLowerCase() === 'inactive') {
		return mapSportsClubRow(existing, { includeLongText: true });
	}

	await strapi.db.query(SPORTS_CLUB_UID).update({
		where: { id: existing.id },
		data: { status: 'inactive' },
	} as any);

	return await getTenantSportsClub(existing.id, tenantId);
}

export default {
	listTenantSportsClubs,
	getTenantSportsClub,
	createTenantSportsClub,
	updateTenantSportsClub,
	activateTenantSportsClub,
	deactivateTenantSportsClub,
	handleSportsClubError,
};