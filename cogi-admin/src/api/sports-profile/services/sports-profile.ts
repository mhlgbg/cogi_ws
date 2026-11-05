import fs from 'node:fs/promises';
import XLSX from 'xlsx';
import { extractRelationRef, hasOwn, mergeTenantWhere, normalizeSortInput, toPositiveInt, toText, whereByParam } from '../../../utils/tenant-scope';

const SPORTS_PROFILE_UID = 'api::sports-profile.sports-profile' as any;
const USER_UID = 'plugin::users-permissions.user' as any;
const USER_TENANT_UID = 'api::user-tenant.user-tenant' as any;

type HttpErrorDetails = Record<string, unknown> | Array<Record<string, unknown>> | null;
type GenericRecord = Record<string, unknown>;

const GENDER_VALUES = new Set(['male', 'female', 'other', 'unspecified']);
const STATUS_VALUES = new Set(['active', 'inactive', 'merged']);
const SOURCE_VALUES = new Set(['manual_import', 'self_registration', 'campaign', 'admin_created', 'other']);
const IMPORT_TEMPLATE_FIELDS = [
	'profileCode',
	'fullName',
	'displayName',
	'gender',
	'birthYear',
	'dateOfBirth',
	'hometown',
	'phone',
	'email',
	'facebookName',
	'facebookUrl',
	'bio',
	'status',
	'source',
	'sourceRef',
];
const IMPORT_FIELD_ALIASES: Record<string, string[]> = {
	profileCode: ['profilecode', 'profile_code', 'code', 'vklid', 'vkl id', 'vkl_id', 'vkl id', 'mã hồ sơ', 'ma ho so', 'profile code'],
	fullName: ['fullname', 'full_name', 'full name', 'ho ten', 'họ tên', 'name', 'ten'],
	displayName: ['displayname', 'display_name', 'display name', 'ten hien thi', 'tên hiển thị'],
	gender: ['gender', 'sex', 'gioi tinh', 'giới tính', 'sexs', 'gender_code'],
	birthYear: ['birthyear', 'birth_year', 'birth year', 'nam sinh', 'năm sinh', 'ns'],
	dateOfBirth: ['dateofbirth', 'date_of_birth', 'date of birth', 'ngay sinh', 'ngày sinh', 'dob'],
	hometown: ['hometown', 'home_town', 'que quan', 'quê quán', 'city'],
	phone: ['phone', 'mobile', 'contactphone', 'contact_phone', 'sdt', 'so dien thoai', 'số điện thoại'],
	email: ['email', 'e-mail', 'mail', 'contactemail', 'contact_email'],
	facebookName: ['facebookname', 'facebook_name', 'fb_name', 'fb name', 'name fb', 'ten fb'],
	facebookUrl: ['facebookurl', 'facebook_url', 'fb_url', 'fb url', 'link fb', 'link facebook'],
	bio: ['bio', 'description', 'note', 'ghi chu', 'ghi chú'],
	status: ['status', 'trang thai', 'trạng thái'],
	source: ['source', 'nguon', 'nguồn'],
	sourceRef: ['sourceref', 'source_ref', 'source reference', 'source_reference', 'ref', 'ghi chu', 'ghi chú'],
};

export class SportsProfileError extends Error {
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
	throw new SportsProfileError(status, message, code, details);
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
		'code',
		'fullName',
		'displayName',
		'avatar',
		'gender',
		'dateOfBirth',
		'birthYear',
		'hometown',
		'bio',
		'contactPhone',
		'contactEmail',
		'status',
		'source',
		'sourceReference',
		'user',
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

function summarizeOptionalText(value: unknown, maxLength?: number): string | null {
	const text = toText(value);
	if (!text) return null;
	if (!maxLength || text.length <= maxLength) return text;
	return text.slice(0, maxLength);
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

function normalizeBirthYear(value: unknown): number | null {
	if (value === null || value === undefined || value === '') return null;
	const parsed = Number(value);
	if (!Number.isInteger(parsed) || parsed < 1900 || parsed > 2100) {
		httpError(400, 'birthYear is invalid', 'INVALID_BIRTH_YEAR', { field: 'birthYear' });
	}
	return parsed;
}

function deriveBirthYearFromDate(dateOfBirth: string | null): number | null {
	if (!dateOfBirth) return null;
	const parsedYear = Number(String(dateOfBirth).slice(0, 4));
	return Number.isInteger(parsedYear) ? parsedYear : null;
}

function normalizeGender(value: unknown): 'male' | 'female' | 'other' | 'unspecified' {
	const text = toText(value).toLowerCase() || 'unspecified';
	if (!GENDER_VALUES.has(text)) {
		httpError(400, 'gender is invalid', 'INVALID_GENDER', { field: 'gender' });
	}
	return text as 'male' | 'female' | 'other' | 'unspecified';
}

function normalizeStatus(value: unknown): 'active' | 'inactive' | 'merged' {
	const text = toText(value).toLowerCase() || 'active';
	if (!STATUS_VALUES.has(text)) {
		httpError(400, 'status is invalid', 'INVALID_STATUS', { field: 'status' });
	}
	return text as 'active' | 'inactive' | 'merged';
}

function normalizeSource(value: unknown): 'manual_import' | 'self_registration' | 'campaign' | 'admin_created' | 'other' | null {
	const text = toText(value).toLowerCase();
	if (!text) return null;
	if (!SOURCE_VALUES.has(text)) {
		httpError(400, 'source is invalid', 'INVALID_SOURCE', { field: 'source' });
	}
	return text as 'manual_import' | 'self_registration' | 'campaign' | 'admin_created' | 'other';
}

function normalizeMediaId(value: unknown) {
	if (value === null || value === undefined || value === '') return null;
	const relationRef = extractRelationRef(value);
	const parsed = Number(relationRef ?? value);
	if (!Number.isInteger(parsed) || parsed <= 0) {
		httpError(400, 'avatar is invalid', 'INVALID_MEDIA', { field: 'avatar' });
	}
	return parsed;
}

function normalizeHasUserFilter(value: unknown): boolean | null {
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

function mapUser(user: any) {
	if (!user?.id) return null;
	return {
		id: Number(user.id),
		documentId: toText(user.documentId) || null,
		username: toText(user.username) || null,
		email: toText(user.email) || null,
		fullName: toText(user.fullName) || null,
		phone: toText(user.phone) || null,
		blocked: Boolean(user.blocked),
		confirmed: typeof user.confirmed === 'boolean' ? Boolean(user.confirmed) : null,
	};
}

function mapLinkedProfileSummary(profile: any) {
	if (!profile?.id) return null;
	return {
		id: Number(profile.id),
		documentId: toText(profile.documentId) || null,
		code: toText(profile.code) || null,
		fullName: toText(profile.fullName) || null,
		displayName: toText(profile.displayName) || null,
		status: toText(profile.status).toLowerCase() || 'active',
	};
}

function mapSportsProfileRow(row: any, options: { includeLongText?: boolean } = {}) {
	return {
		id: Number(row?.id || 0),
		documentId: row?.documentId || null,
		code: toText(row?.code),
		fullName: toText(row?.fullName),
		displayName: summarizeOptionalText(row?.displayName, 150),
		gender: toText(row?.gender).toLowerCase() || 'unspecified',
		dateOfBirth: row?.dateOfBirth || null,
		birthYear: Number.isInteger(Number(row?.birthYear)) ? Number(row.birthYear) : null,
		hometown: summarizeOptionalText(row?.hometown, 150),
		bio: options.includeLongText ? summarizeOptionalText(row?.bio) : summarizeOptionalText(row?.bio, 240),
		contactPhone: summarizeOptionalText(row?.contactPhone, 30),
		contactEmail: normalizeEmail(row?.contactEmail),
		status: toText(row?.status).toLowerCase() || 'active',
		source: toText(row?.source).toLowerCase() || null,
		sourceReference: summarizeOptionalText(row?.sourceReference, 255),
		avatar: mapMedia(row?.avatar),
		user: mapUser(row?.user),
		hasUser: Boolean(row?.user?.id),
		createdAt: row?.createdAt || null,
		updatedAt: row?.updatedAt || null,
	};
}

function buildListWhere(query: Record<string, unknown>) {
	const clauses: Array<Record<string, unknown>> = [];
	const keyword = toText(query.search ?? query.q);
	const status = toText(query.status).toLowerCase();
	const gender = toText(query.gender).toLowerCase();
	const birthYear = normalizeBirthYear(query.birthYear);
	const hasUser = normalizeHasUserFilter(query.hasUser);

	if (keyword) {
		clauses.push({
			$or: [
				{ code: { $containsi: keyword } },
				{ fullName: { $containsi: keyword } },
				{ displayName: { $containsi: keyword } },
				{ contactPhone: { $containsi: keyword } },
				{ contactEmail: { $containsi: keyword } },
				{ user: { email: { $containsi: keyword } } },
				{ user: { phone: { $containsi: keyword } } },
				{ user: { fullName: { $containsi: keyword } } },
			],
		});
	}

	if (status && STATUS_VALUES.has(status)) clauses.push({ status: { $eq: status } });
	if (gender && GENDER_VALUES.has(gender)) clauses.push({ gender: { $eq: gender } });
	if (birthYear !== null) clauses.push({ birthYear: { $eq: birthYear } });
	if (hasUser === true) clauses.push({ user: { id: { $notNull: true } } });
	if (hasUser === false) clauses.push({ user: { id: { $null: true } } });

	if (clauses.length === 0) return {};
	if (clauses.length === 1) return clauses[0];
	return { $and: clauses };
}

function resolveOrderBy(query: Record<string, unknown>) {
	const normalizedSort = normalizeSortInput(query?.sort);
	if (normalizedSort.length > 0) {
		const allowed = new Set(['code', 'fullName', 'displayName', 'gender', 'dateOfBirth', 'birthYear', 'contactPhone', 'contactEmail', 'status', 'updatedAt', 'createdAt']);
		const safe = normalizedSort
			.map((entry) => {
				const key = Object.keys(entry)[0];
				if (!allowed.has(key)) return null;
				return { [key]: entry[key] } as Record<string, 'asc' | 'desc'>;
			})
			.filter(Boolean) as Array<Record<string, 'asc' | 'desc'>>;
		if (safe.length > 0) return safe;
	}

	return [{ updatedAt: 'desc' }, { fullName: 'asc' }, { id: 'asc' }];
}

async function ensureUserInTenant(userRef: unknown, tenantId: number | string) {
	const userId = Number(extractRelationRef(userRef));
	if (!Number.isInteger(userId) || userId <= 0) {
		httpError(400, 'user is invalid', 'INVALID_USER', { field: 'user' });
	}

	const membership = await strapi.db.query(USER_TENANT_UID).findOne({
		where: {
			user: userId,
			tenant: tenantId,
			userTenantStatus: 'active',
		},
		populate: {
			user: {
				select: ['id', 'username', 'email', 'fullName', 'documentId', 'phone', 'blocked', 'confirmed'],
			},
		},
	});

	if (!membership?.user?.id) {
		httpError(400, 'user must be an active user in current tenant', 'USER_NOT_IN_TENANT', { field: 'user' });
	}

	return membership.user;
}

async function findUserTenantMembership(userRef: unknown, tenantId: number | string, transacting?: any) {
	const userId = Number(extractRelationRef(userRef));
	if (!Number.isInteger(userId) || userId <= 0) {
		httpError(400, 'user is invalid', 'INVALID_USER', { field: 'user' });
	}

	const membership = await strapi.db.query(USER_TENANT_UID).findOne({
		where: {
			user: userId,
			tenant: tenantId,
			userTenantStatus: 'active',
		},
		populate: {
			user: {
				select: ['id', 'documentId', 'username', 'email', 'fullName', 'phone', 'blocked', 'confirmed'],
			},
		},
		...(transacting ? { transacting } : {}),
	} as any);

	if (!membership?.id || !membership?.user?.id) {
		httpError(400, 'user must be an active user in current tenant', 'USER_NOT_IN_TENANT', { field: 'user' });
	}

	return membership;
}

async function ensureAvatarExists(mediaId: number | null) {
	if (!mediaId) return null;
	const media = await strapi.db.query('plugin::upload.file').findOne({
		where: { id: mediaId },
		select: ['id'],
	});
	if (!media?.id) {
		httpError(400, 'avatar is invalid', 'INVALID_MEDIA', { field: 'avatar' });
	}
	return mediaId;
}

async function findSportsProfileInTenant(profileRef: unknown, tenantId: number | string, transacting?: any) {
	const where = whereByParam(profileRef);
	if (!where) {
		httpError(404, 'Sports profile not found', 'SPORTS_PROFILE_NOT_FOUND');
	}

	const profile = await strapi.db.query(SPORTS_PROFILE_UID).findOne({
		where: mergeTenantWhere(where, tenantId),
		populate: {
			avatar: { select: ['id', 'name', 'url', 'mime'] },
			user: { select: ['id', 'documentId', 'username', 'email', 'fullName', 'phone', 'blocked', 'confirmed'] },
		},
		...(transacting ? { transacting } : {}),
	} as any);

	if (!profile?.id) {
		httpError(404, 'Sports profile not found', 'SPORTS_PROFILE_NOT_FOUND');
	}

	return profile;
}

async function findSportsProfileByCode(tenantId: number | string, code: string, transacting?: any) {
	if (!code) return null;
	return await strapi.db.query(SPORTS_PROFILE_UID).findOne({
		where: mergeTenantWhere({ code: { $eq: code } }, tenantId),
		select: ['id', 'documentId', 'code'],
		...(transacting ? { transacting } : {}),
	} as any);
}

async function findProfilesByUserIds(tenantId: number | string, userIds: number[], transacting?: any) {
	const uniqueIds = Array.from(new Set((userIds || []).map((value) => Number(value)).filter((value) => Number.isInteger(value) && value > 0)));
	if (uniqueIds.length === 0) return [];

	return await strapi.db.query(SPORTS_PROFILE_UID).findMany({
		where: mergeTenantWhere({
			user: { id: { $in: uniqueIds } },
		}, tenantId),
		select: ['id', 'documentId', 'code', 'fullName', 'displayName', 'status', 'updatedAt'],
		populate: {
			user: { select: ['id'] },
		},
		orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
		...(transacting ? { transacting } : {}),
	} as any);
}

async function findActiveOrAmbiguousProfileByUser(tenantId: number | string, userId: number | string, excludeProfileId?: number | null, transacting?: any) {
	const rows = await strapi.db.query(SPORTS_PROFILE_UID).findMany({
		where: mergeTenantWhere({
			user: { id: { $eq: Number(userId) } },
			...(excludeProfileId ? { id: { $ne: Number(excludeProfileId) } } : {}),
		}, tenantId),
		select: ['id', 'documentId', 'code', 'fullName', 'displayName', 'status', 'updatedAt'],
		orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
		...(transacting ? { transacting } : {}),
	} as any);

	if (!Array.isArray(rows) || rows.length === 0) return null;
	const activeRow = rows.find((item: any) => toText(item?.status).toLowerCase() !== 'merged');
	if (activeRow?.id) return { profile: activeRow, kind: 'active' as const };
	return { profile: rows[0], kind: 'merged' as const };
}

function isPostgresClient() {
	const client = String(strapi.db?.connection?.client?.config?.client || '').toLowerCase();
	return client.includes('pg');
}

async function acquireSportsProfileCodeLock(trx: any, tenantId: number | string, code: string) {
	if (!isPostgresClient()) return;
	await trx.raw('select pg_advisory_xact_lock(hashtext(?), hashtext(?))', [String(tenantId), `sports-profile-code:${String(code || '').toUpperCase()}`]);
}

async function acquireSportsProfileLinkLock(trx: any, tenantId: number | string, profileId: number | string, userId: number | string) {
	if (!isPostgresClient()) return;
	await trx.raw('select pg_advisory_xact_lock(hashtext(?), hashtext(?))', [String(tenantId), `sports-profile:${String(profileId)}`]);
	await trx.raw('select pg_advisory_xact_lock(hashtext(?), hashtext(?))', [String(tenantId), `sports-profile-user:${String(userId)}`]);
}

async function acquireSportsProfileUserLock(trx: any, tenantId: number | string, userId: number | string) {
	if (!isPostgresClient()) return;
	await trx.raw('select pg_advisory_xact_lock(hashtext(?), hashtext(?))', [String(tenantId), `sports-profile-user:${String(userId)}`]);
}

function buildLinkedProfileConflictDetails(profile: any, kind: 'active' | 'merged') {
	return {
		linkedSportsProfile: mapLinkedProfileSummary(profile),
		conflictType: kind,
	};
}

async function validateProfileUserChange(existing: any, nextUserId: number | null, tenantId: number | string, transacting?: any) {
	const currentUserId = Number(existing?.user?.id || 0) || null;
	if (nextUserId === currentUserId) {
		return currentUserId ? mapUser(existing.user) : null;
	}

	if (currentUserId && nextUserId && currentUserId !== nextUserId) {
		httpError(409, 'Hồ sơ thể thao này đã liên kết User khác. Hãy gỡ liên kết hiện tại trước.', 'SPORTS_PROFILE_ALREADY_LINKED_TO_OTHER_USER', {
			field: 'user',
			currentUser: mapUser(existing.user),
		});
	}

	if (!nextUserId) return null;

	const membership = await findUserTenantMembership(nextUserId, tenantId, transacting);
	const conflict = await findActiveOrAmbiguousProfileByUser(tenantId, Number(membership.user.id), Number(existing.id), transacting);
	if (conflict?.profile?.id) {
		if (conflict.kind === 'active') {
			httpError(409, 'User này đã được liên kết với một hồ sơ thể thao khác.', 'USER_ALREADY_LINKED_TO_ACTIVE_SPORTS_PROFILE', buildLinkedProfileConflictDetails(conflict.profile, conflict.kind));
		}
		httpError(409, 'User này đang liên kết với một hồ sơ thể thao đã gộp. Cần rà soát dữ liệu trước khi liên kết mới.', 'USER_LINKED_TO_MERGED_SPORTS_PROFILE', buildLinkedProfileConflictDetails(conflict.profile, conflict.kind));
	}

	return membership.user;
}

function buildLinkableUserWhere(keyword: string) {
	if (!keyword) return { userTenantStatus: 'active' };
	return {
		userTenantStatus: 'active',
		user: {
			$or: [
				{ username: { $containsi: keyword } },
				{ email: { $containsi: keyword } },
				{ fullName: { $containsi: keyword } },
				{ phone: { $containsi: keyword } },
			],
		},
	};
}

async function logSportsProfileLinkAction(event: string, payload: Record<string, unknown>) {
	strapi.log.info(`[sports-profile] ${event} ${JSON.stringify(payload)}`);
}

function buildWriteData(input: GenericRecord, existing?: any) {
	const code = hasOwn(input, 'code') ? normalizeCode(input.code) : normalizeCode(existing?.code);
	const fullName = hasOwn(input, 'fullName') ? normalizeRequiredText(input.fullName, 'fullName', 150) : normalizeRequiredText(existing?.fullName, 'fullName', 150);

	return {
		code,
		fullName,
		displayName: hasOwn(input, 'displayName') ? normalizeOptionalText(input.displayName, 150) : normalizeOptionalText(existing?.displayName, 150),
		avatar: hasOwn(input, 'avatar') ? normalizeMediaId(input.avatar) : normalizeMediaId(existing?.avatar?.id ?? existing?.avatar),
		gender: hasOwn(input, 'gender') ? normalizeGender(input.gender) : normalizeGender(existing?.gender),
		dateOfBirth: hasOwn(input, 'dateOfBirth') ? normalizeDate(input.dateOfBirth, 'dateOfBirth') : normalizeDate(existing?.dateOfBirth, 'dateOfBirth'),
		birthYear: hasOwn(input, 'birthYear') ? normalizeBirthYear(input.birthYear) : normalizeBirthYear(existing?.birthYear),
		hometown: hasOwn(input, 'hometown') ? normalizeOptionalText(input.hometown, 150) : normalizeOptionalText(existing?.hometown, 150),
		bio: hasOwn(input, 'bio') ? normalizeOptionalText(input.bio) : normalizeOptionalText(existing?.bio),
		contactPhone: hasOwn(input, 'contactPhone') ? normalizeOptionalText(input.contactPhone, 30) : normalizeOptionalText(existing?.contactPhone, 30),
		contactEmail: hasOwn(input, 'contactEmail') ? normalizeEmail(input.contactEmail) : normalizeEmail(existing?.contactEmail),
		status: hasOwn(input, 'status') ? normalizeStatus(input.status) : normalizeStatus(existing?.status),
		source: hasOwn(input, 'source') ? normalizeSource(input.source) : normalizeSource(existing?.source),
		sourceReference: hasOwn(input, 'sourceReference') ? normalizeOptionalText(input.sourceReference, 255) : normalizeOptionalText(existing?.sourceReference, 255),
		user: hasOwn(input, 'user') ? extractRelationRef(input.user) : extractRelationRef(existing?.user),
	};
}

function normalizeImportKey(value: unknown): string {
	return toText(value).trim().toLowerCase().replace(/[^a-z0-9]+/g, '');
}

function getImportColumnValue(row: Record<string, unknown>, aliases: string[]) {
	const normalizedAliases = new Set(aliases.map((alias: string) => normalizeImportKey(alias)));
	for (const [key, value] of Object.entries(row || {})) {
		if (normalizedAliases.has(normalizeImportKey(key))) return value;
	}
	return null;
}

function normalizeImportText(value: unknown): string {
	return toText(value).replace(/\s+/g, ' ').trim();
}

function normalizeImportGender(value: unknown): 'male' | 'female' | 'other' | 'unspecified' {
	const text = normalizeImportText(value).toLowerCase();
	if (!text) return 'unspecified';
	if (['m', 'male', 'nam', 'man', 'boy'].includes(text)) return 'male';
	if (['f', 'female', 'nu', 'nữ', 'woman', 'girl'].includes(text)) return 'female';
	if (['other', 'khac', 'khác'].includes(text)) return 'other';
	return 'unspecified';
}

function normalizeImportStatus(value: unknown): 'active' | 'inactive' | 'merged' {
	const text = normalizeImportText(value).toLowerCase();
	if (!text) return 'active';
	if (['active', 'đang hoạt động', 'hoat dong', 'enabled', '1'].includes(text)) return 'active';
	if (['inactive', 'ngung hoat dong', 'ngừng hoạt động', 'disabled', '0'].includes(text)) return 'inactive';
	if (['merged', 'gop', 'gộp'].includes(text)) return 'merged';
	return 'active';
}

function normalizeImportSource(value: unknown): 'manual_import' | 'self_registration' | 'campaign' | 'admin_created' | 'other' | null {
	const text = normalizeImportText(value).toLowerCase();
	if (!text) return null;
	if (['manual_import', 'manual-import', 'manual import', 'import tay', 'nhập tay', 'import'].includes(text)) return 'manual_import';
	if (['self_registration', 'self-registration', 'self registration', 'tự đăng ký', 'tu dang ky'].includes(text)) return 'self_registration';
	if (['campaign', 'chiến dịch', 'chien dich'].includes(text)) return 'campaign';
	if (['admin_created', 'admin-created', 'admin created', 'admin tao', 'admin tạo'].includes(text)) return 'admin_created';
	return 'other';
}

function parseImportDate(value: unknown): string | null {
	if (value === null || value === undefined || value === '') return null;
	if (value instanceof Date) {
		if (Number.isNaN(value.getTime())) return null;
		return value.toISOString().slice(0, 10);
	}
	if (typeof value === 'number') {
		const asDate = new Date(Date.UTC(1899, 11, 30 + value));
		if (!Number.isNaN(asDate.getTime())) return asDate.toISOString().slice(0, 10);
		return null;
	}
	const text = normalizeImportText(value);
	if (!text) return null;
	const match = text.match(/^\d{4}-\d{2}-\d{2}$/);
	if (match) {
		const parsed = new Date(`${text}T00:00:00Z`);
		if (!Number.isNaN(parsed.getTime())) return parsed.toISOString().slice(0, 10);
	}
	const dayMatch = text.match(/^\d{1,2}[/-]\d{1,2}[/-]\d{2,4}$/);
	if (dayMatch) {
		const normalized = text.replace(/\//g, '-');
		const parsed = new Date(normalized);
		if (!Number.isNaN(parsed.getTime())) return parsed.toISOString().slice(0, 10);
	}
	const parsed = new Date(text);
	if (!Number.isNaN(parsed.getTime())) return parsed.toISOString().slice(0, 10);
	return null;
}

function normalizeImportPhone(value: unknown): string | null {
	const text = normalizeImportText(value);
	if (!text) return null;
	return text;
}

function normalizeImportEmail(value: unknown): string | null {
	const text = normalizeImportText(value).toLowerCase();
	if (!text) return null;
	if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(text)) return text;
	return text;
}

function buildImportRecord(rawRow: Record<string, unknown>) {
	const candidate = {
		profileCode: normalizeImportText(getImportColumnValue(rawRow, IMPORT_FIELD_ALIASES.profileCode) ?? rawRow.profileCode ?? rawRow.code),
		fullName: normalizeImportText(getImportColumnValue(rawRow, IMPORT_FIELD_ALIASES.fullName) ?? rawRow.fullName ?? rawRow.name),
		displayName: normalizeImportText(getImportColumnValue(rawRow, IMPORT_FIELD_ALIASES.displayName) ?? rawRow.displayName),
		gender: normalizeImportGender(getImportColumnValue(rawRow, IMPORT_FIELD_ALIASES.gender) ?? rawRow.gender ?? rawRow.sex),
		birthYear: normalizeImportText(getImportColumnValue(rawRow, IMPORT_FIELD_ALIASES.birthYear) ?? rawRow.birthYear ?? rawRow.ns),
		dateOfBirth: parseImportDate(getImportColumnValue(rawRow, IMPORT_FIELD_ALIASES.dateOfBirth) ?? rawRow.dateOfBirth ?? rawRow.dob),
		hometown: normalizeImportText(getImportColumnValue(rawRow, IMPORT_FIELD_ALIASES.hometown) ?? rawRow.hometown),
		phone: normalizeImportPhone(getImportColumnValue(rawRow, IMPORT_FIELD_ALIASES.phone) ?? rawRow.phone ?? rawRow.contactPhone),
		email: normalizeImportEmail(getImportColumnValue(rawRow, IMPORT_FIELD_ALIASES.email) ?? rawRow.email ?? rawRow.contactEmail),
		facebookName: normalizeImportText(getImportColumnValue(rawRow, IMPORT_FIELD_ALIASES.facebookName) ?? rawRow.facebookName),
		facebookUrl: normalizeImportText(getImportColumnValue(rawRow, IMPORT_FIELD_ALIASES.facebookUrl) ?? rawRow.facebookUrl),
		bio: normalizeImportText(getImportColumnValue(rawRow, IMPORT_FIELD_ALIASES.bio) ?? rawRow.bio ?? rawRow.note),
		status: normalizeImportStatus(getImportColumnValue(rawRow, IMPORT_FIELD_ALIASES.status) ?? rawRow.status),
		source: normalizeImportSource(getImportColumnValue(rawRow, IMPORT_FIELD_ALIASES.source) ?? rawRow.source),
		sourceRef: normalizeImportText(getImportColumnValue(rawRow, IMPORT_FIELD_ALIASES.sourceRef) ?? rawRow.sourceRef ?? rawRow.sourceReference),
	};

	if (candidate.profileCode) candidate.profileCode = candidate.profileCode.toUpperCase();
	if (candidate.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(candidate.email)) {
		candidate.email = candidate.email.replace(/\s+/g, '');
	}
	return candidate;
}

function validateImportedProfileRecord(record: Record<string, any>, isCreate: boolean) {
	const errors: string[] = [];
	const warnings: string[] = [];
	const normalizedCode = normalizeImportText(record.profileCode || '').toUpperCase();
	if (!normalizedCode) errors.push('profileCode is required');
	if (isCreate && !normalizeImportText(record.fullName)) errors.push('fullName is required when creating a new sports profile');
	if (record.birthYear) {
		const yearValue = Number(record.birthYear);
		if (!Number.isInteger(yearValue) || yearValue < 1900 || yearValue > 2100) {
			errors.push('birthYear must be a valid year between 1900 and 2100');
		}
	}
	if (record.dateOfBirth) {
		const parsedDate = parseImportDate(record.dateOfBirth);
		if (!parsedDate) {
			errors.push('dateOfBirth is invalid');
		}
	}
	if (record.birthYear && record.dateOfBirth) {
		const yearValue = Number(record.birthYear);
		const parsedYear = Number(String(parseImportDate(record.dateOfBirth) || '').slice(0, 4));
		if (Number.isInteger(yearValue) && Number.isInteger(parsedYear) && yearValue !== parsedYear) {
			warnings.push('birthYear and dateOfBirth are inconsistent; the year will be derived from dateOfBirth');
		}
	}
	if (record.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(record.email)) {
		errors.push('email is invalid');
	}
	if (record.status && !STATUS_VALUES.has(record.status)) {
		errors.push('status is invalid');
	}
	if (record.gender && !GENDER_VALUES.has(record.gender)) {
		errors.push('gender is invalid');
	}
	if (record.source && record.source !== null && !SOURCE_VALUES.has(record.source)) {
		errors.push('source is invalid');
	}
	return { errors, warnings };
}

function buildImportPayload(record: Record<string, any>) {
	const payload: GenericRecord = {
		code: normalizeImportText(record.profileCode || '').toUpperCase(),
		fullName: normalizeImportText(record.fullName) || undefined,
		displayName: normalizeImportText(record.displayName) || undefined,
		gender: normalizeImportGender(record.gender),
		dateOfBirth: parseImportDate(record.dateOfBirth),
		birthYear: normalizeImportText(record.birthYear) ? Number(String(normalizeImportText(record.birthYear)).slice(0, 4)) : undefined,
		hometown: normalizeImportText(record.hometown) || undefined,
		bio: normalizeImportText(record.bio) || undefined,
		contactPhone: normalizeImportPhone(record.phone) || undefined,
		contactEmail: normalizeImportEmail(record.email) || undefined,
		status: normalizeImportStatus(record.status),
		source: normalizeImportSource(record.source) || undefined,
		sourceReference: normalizeImportText(record.sourceRef) || undefined,
	};
	if (payload.dateOfBirth && payload.birthYear && payload.birthYear !== Number(String(payload.dateOfBirth).slice(0, 4))) {
		payload.birthYear = Number(String(payload.dateOfBirth).slice(0, 4));
	}
	if (!payload.fullName) delete payload.fullName;
	if (!payload.displayName) delete payload.displayName;
	if (!payload.dateOfBirth) delete payload.dateOfBirth;
	if (!payload.contactPhone) delete payload.contactPhone;
	if (!payload.contactEmail) delete payload.contactEmail;
	if (!payload.hometown) delete payload.hometown;
	if (!payload.bio) delete payload.bio;
	if (!payload.sourceReference) delete payload.sourceReference;
	if (!payload.source) delete payload.source;
	if (!payload.birthYear) delete payload.birthYear;
	if (!payload.code) delete payload.code;
	return payload;
}

function applySafeUpdatePatch(existing: Record<string, any>, record: Record<string, any>) {
	const payload: GenericRecord = {};
	const fieldMap: Record<string, string> = {
		fullName: 'fullName',
		displayName: 'displayName',
		gender: 'gender',
		dateOfBirth: 'dateOfBirth',
		birthYear: 'birthYear',
		hometown: 'hometown',
		bio: 'bio',
		contactPhone: 'contactPhone',
		contactEmail: 'contactEmail',
		status: 'status',
		source: 'source',
		sourceReference: 'sourceReference',
	};
	for (const [inputKey, modelKey] of Object.entries(fieldMap)) {
		const value = (record as Record<string, any>)[inputKey];
		if (value === null || value === undefined || value === '') continue;
		const normalizedValue = modelKey === 'fullName' ? normalizeImportText(value) : value;
		if (normalizedValue !== existing?.[modelKey]) {
			payload[modelKey] = normalizedValue;
		}
	}
	return payload;
}

function summarizeCurrentProfile(existing: any) {
	if (!existing?.id) return null;
	return {
		id: Number(existing.id),
		code: toText(existing.code),
		fullName: toText(existing.fullName),
		displayName: toText(existing.displayName),
		gender: toText(existing.gender),
		dateOfBirth: existing.dateOfBirth || null,
		birthYear: Number.isInteger(Number(existing.birthYear)) ? Number(existing.birthYear) : null,
		contactPhone: toText(existing.contactPhone),
		contactEmail: toText(existing.contactEmail),
		status: toText(existing.status),
		source: toText(existing.source),
		sourceReference: toText(existing.sourceReference),
	};
}

function getUploadedFilePath(file: any): string {
	return toText(file?.filepath || file?.path || file?.tempFilePath);
}

async function readUploadedFileBuffer(file: any): Promise<Buffer> {
	if (file?.buffer && Buffer.isBuffer(file.buffer)) {
		return file.buffer;
	}

	if (file?.data && Buffer.isBuffer(file.data)) {
		return file.data;
	}

	const filePath = getUploadedFilePath(file);
	if (!filePath) {
		throw new SportsProfileError(400, 'Excel file content is required', 'SPORTS_PROFILE_IMPORT_INVALID_FILE');
	}

	return fs.readFile(filePath);
}

async function readImportWorksheet(file: any) {
	if (!file) {
		throw new SportsProfileError(400, 'Excel file is required', 'SPORTS_PROFILE_IMPORT_INVALID_FILE');
	}
	const buffer = await readUploadedFileBuffer(file);
	const workbook = XLSX.read(buffer, { type: 'buffer', cellDates: true, raw: false });
	const sheetNames = workbook?.SheetNames || [];
	const preferredName = sheetNames.find((name) => normalizeImportKey(name) === 'sportsprofiles') || sheetNames.find((name) => normalizeImportKey(name) === 'data');
	const worksheet = preferredName ? workbook.Sheets[preferredName] : workbook.Sheets[sheetNames[0]];
	if (!worksheet) {
		throw new SportsProfileError(400, 'The uploaded Excel file does not contain a valid worksheet', 'SPORTS_PROFILE_IMPORT_INVALID_FILE');
	}
	const rows = XLSX.utils.sheet_to_json(worksheet, { defval: '', raw: false, blankrows: false });
	return rows as Record<string, unknown>[];
}

function computeImportSummary(rows: any[]) {
	const summary = {
		totalRows: rows.length,
		createCount: 0,
		updateCount: 0,
		unchangedCount: 0,
		errorCount: 0,
		warningCount: 0,
	};
	for (const row of rows) {
		if (row.status === 'CREATE') summary.createCount += 1;
		if (row.status === 'UPDATE') summary.updateCount += 1;
		if (row.status === 'UNCHANGED') summary.unchangedCount += 1;
		if (row.status === 'ERROR') summary.errorCount += 1;
		summary.warningCount += Number(Array.isArray(row.warnings) ? row.warnings.length : 0);
	}
	return summary;
}

function parseErrorMessage(error: any) {
	return toText(error?.message || error?.details?.message || error?.response?.data?.error?.message);
}

export function handleSportsProfileError(ctx: any, error: any) {
	if (error instanceof SportsProfileError) {
		ctx.status = error.status;
		ctx.body = {
			error: {
				status: error.status,
				name: 'SportsProfileError',
				message: error.message,
				code: error.code || undefined,
				details: error.details || undefined,
			},
		};
		return;
	}

	const message = parseErrorMessage(error);
	if (/tenant \+ code must be unique/i.test(message)) {
		return handleSportsProfileError(ctx, new SportsProfileError(409, 'Sports profile code already exists in this tenant.', 'SPORTS_PROFILE_CODE_ALREADY_EXISTS', { field: 'code' }));
	}

	if (message) {
		ctx.badRequest(message);
		return;
	}

	strapi.log.error('[sports-profile] unexpected error', error);
	ctx.internalServerError('Failed to process sports profile request');
}

export async function listTenantSportsProfiles(query: Record<string, unknown>, tenantId: number | string) {
	const page = toPositiveInt(query.page, 1);
	const pageSize = toPositiveInt(query.pageSize, 10);
	const start = (page - 1) * pageSize;
	const where = mergeTenantWhere(buildListWhere(query), tenantId);
	const orderBy = resolveOrderBy(query);

	const [rows, total] = await Promise.all([
		strapi.db.query(SPORTS_PROFILE_UID).findMany({
			where,
			orderBy,
			offset: start,
			limit: pageSize,
			populate: {
				avatar: { select: ['id', 'name', 'url', 'mime'] },
				user: { select: ['id', 'documentId', 'username', 'email', 'fullName', 'phone', 'blocked', 'confirmed'] },
			},
		} as any),
		strapi.db.query(SPORTS_PROFILE_UID).count({ where } as any),
	]);

	return {
		rows: (rows || []).map((row: any) => mapSportsProfileRow(row)),
		pagination: {
			page,
			pageSize,
			pageCount: Math.max(1, Math.ceil(total / pageSize)),
			total,
		},
	};
}

export async function getTenantSportsProfile(profileRef: unknown, tenantId: number | string) {
	const profile = await findSportsProfileInTenant(profileRef, tenantId);
	return mapSportsProfileRow(profile, { includeLongText: true });
}

export async function getSportsProfileImportTemplate() {
	const workbook = XLSX.utils.book_new();
	const rows = [{
		profileCode: 'VKL0001',
		fullName: 'Nguyễn Văn A',
		displayName: 'A',
		gender: 'M',
		birthYear: 2001,
		dateOfBirth: '2001-01-15',
		hometown: 'Hà Nội',
		phone: '0901234567',
		email: 'a@example.com',
		facebookName: 'nguyenvana',
		facebookUrl: 'https://facebook.com/nguyenvana',
		bio: 'Runner',
		status: 'active',
		source: 'manual_import',
		sourceRef: 'VKL Import 2025',
	}];
	const worksheet = XLSX.utils.json_to_sheet(rows);
	worksheet['!cols'] = [
		{ wch: 18 }, { wch: 24 }, { wch: 18 }, { wch: 10 }, { wch: 10 }, { wch: 18 }, { wch: 18 }, { wch: 20 }, { wch: 28 }, { wch: 24 }, { wch: 30 }, { wch: 24 }, { wch: 16 }, { wch: 16 }, { wch: 24 },
	];
	XLSX.utils.book_append_sheet(workbook, worksheet, 'SportsProfiles');
	const instructions = XLSX.utils.aoa_to_sheet([
		['Instructions'],
		['1. Use the first sheet named SportsProfiles.'],
		['2. profileCode is required and unique per tenant.'],
		['3. fullName is required when creating a new profile.'],
		['4. Empty cells do not clear existing values during update.'],
		['5. birthYear and dateOfBirth must be consistent if both are provided.'],
		['6. gender accepts M/F or male/female etc.'],
		['7. status accepts active, inactive, merged.'],
		['8. facebookName and facebookUrl are optional metadata and are not persisted in the current model schema.'],
	]);
	XLSX.utils.book_append_sheet(workbook, instructions, 'Instructions');
	return {
		contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
		fileName: 'sports-profiles-import-template.xlsx',
		buffer: XLSX.write(workbook, { bookType: 'xlsx', type: 'buffer' }) as Buffer,
	};
}

export async function previewSportsProfileImport(file: any, tenantId: number | string) {
	const rows = await readImportWorksheet(file);
	if (!rows.length) {
		throw new SportsProfileError(400, 'The Excel file is empty or has no data rows.', 'SPORTS_PROFILE_IMPORT_EMPTY');
	}
	const fileRows: any[] = [];
	const seenCodes = new Map<string, number>();
	const validCodes = new Set<string>();

	for (const [index, rawRow] of rows.entries()) {
		const record = buildImportRecord(rawRow as Record<string, unknown>);
		const rowNumber = index + 2;
		const isCreate = !record.profileCode ? false : !(await findSportsProfileByCode(tenantId, record.profileCode));
		const validation = validateImportedProfileRecord(record, isCreate);
		const warnings = [...validation.warnings];
		const errors = [...validation.errors];
		const duplicateCode = record.profileCode ? seenCodes.get(record.profileCode) : null;
		if (duplicateCode) {
			errors.push(`Duplicate profileCode "${record.profileCode}" in the same file at row ${duplicateCode}`);
		}
		if (record.profileCode) {
			seenCodes.set(record.profileCode, rowNumber);
			validCodes.add(record.profileCode);
		}
		const existing = record.profileCode ? await findSportsProfileByCode(tenantId, record.profileCode) : null;
		let status = 'ERROR';
		let action: 'CREATE' | 'UPDATE' | 'UNCHANGED' | 'ERROR' = 'ERROR';
		let currentProfile: any = null;
		let newValues: Record<string, any> | null = null;
		let reason = null as string | null;

		if (errors.length === 0) {
			if (existing?.id) {
				currentProfile = await strapi.db.query(SPORTS_PROFILE_UID).findOne({
					where: { id: existing.id },
					populate: {
						avatar: { select: ['id', 'name', 'url', 'mime'] },
						user: { select: ['id', 'documentId', 'username', 'email', 'fullName', 'phone', 'blocked', 'confirmed'] },
					},
				} as any);
				const payload = buildImportPayload(record);
				const safePatch = applySafeUpdatePatch(currentProfile || {}, payload);
				newValues = safePatch;
				if (Object.keys(safePatch).length === 0) {
					status = 'UNCHANGED';
					action = 'UNCHANGED';
					reason = 'No allowed field differs from the current record';
				} else {
					status = 'UPDATE';
					action = 'UPDATE';
					reason = 'Allowed fields will be updated without affecting user ownership, tenant, or memberships';
				}
			} else {
				newValues = buildImportPayload(record);
				status = 'CREATE';
				action = 'CREATE';
				reason = 'New sports profile will be created';
			}
		} else {
			reason = errors.join('; ');
		}

		const previewRow = {
			rowNumber,
			profileCode: record.profileCode || null,
			fullName: record.fullName || null,
			status,
			action,
			currentProfile: summarizeCurrentProfile(currentProfile),
			newValues,
			warnings,
			errors,
			reason,
		};
		fileRows.push(previewRow);
	}

	const summary = computeImportSummary(fileRows);
	return {
		fileName: 'sports-profiles-import.xlsx',
		summary,
		rows: fileRows,
	};
}

export async function confirmSportsProfileImport(file: any, tenantId: number | string, actorUserId: number | null = null) {
	const preview = await previewSportsProfileImport(file, tenantId);
	const errors = preview.rows.filter((row: any) => row.status === 'ERROR');
	if (errors.length > 0) {
		throw new SportsProfileError(400, 'Import contains unresolved validation errors. Fix the file and retry the import.', 'SPORTS_PROFILE_IMPORT_VALIDATION_FAILED', { errors: errors.map((row: any) => ({ rowNumber: row.rowNumber, profileCode: row.profileCode, errors: row.errors })) });
	}

	let createdCount = 0;
	let updatedCount = 0;
	let unchangedCount = 0;
	const createdRows: any[] = [];
	const updatedRows: any[] = [];
	const unchangedRows: any[] = [];
	const auditRows: any[] = [];

	for (const row of preview.rows) {
		if (row.status === 'UNCHANGED') {
			unchangedCount += 1;
			unchangedRows.push({ rowNumber: row.rowNumber, profileCode: row.profileCode, action: 'UNCHANGED' });
			continue;
		}
		if (row.status === 'CREATE') {
			const created = await createTenantSportsProfile(row.newValues || {}, tenantId);
			createdCount += 1;
			createdRows.push({ rowNumber: row.rowNumber, profileCode: row.profileCode, id: created?.id || null, action: 'CREATE' });
			auditRows.push({ rowNumber: row.rowNumber, profileCode: row.profileCode, action: 'CREATE', actorUserId, tenantId, createdAt: new Date().toISOString() });
			continue;
		}
		if (row.status === 'UPDATE') {
			const existing = row.currentProfile ? await findSportsProfileInTenant(row.currentProfile.id, tenantId) : null;
			if (!existing?.id) {
				throw new SportsProfileError(404, `Unable to find sports profile for update: ${row.profileCode || row.rowNumber}`, 'SPORTS_PROFILE_NOT_FOUND');
			}
			const updated = await updateTenantSportsProfile(existing.id, row.newValues || {}, tenantId);
			updatedCount += 1;
			updatedRows.push({ rowNumber: row.rowNumber, profileCode: row.profileCode, id: updated?.id || null, action: 'UPDATE' });
			auditRows.push({ rowNumber: row.rowNumber, profileCode: row.profileCode, action: 'UPDATE', actorUserId, tenantId, createdAt: new Date().toISOString() });
		}
	}

	strapi.log.info(`[sports-profile-import] tenant=${tenantId} actorUserId=${actorUserId} created=${createdCount} updated=${updatedCount} unchanged=${unchangedCount} total=${preview.summary.totalRows}`);
	return {
		fileName: 'sports-profiles-import.xlsx',
		summary: {
			totalRows: preview.summary.totalRows,
			createdCount,
			updatedCount,
			unchangedCount,
			errorCount: 0,
		},
		created: createdRows,
		updated: updatedRows,
		unchanged: unchangedRows,
		audit: auditRows,
	};
}

export async function createTenantSportsProfile(input: GenericRecord, tenantId: number | string) {
	ensureNoUnknownWriteFields(input || {});
	const data = buildWriteData(input || {});
	data.birthYear = data.dateOfBirth ? deriveBirthYearFromDate(data.dateOfBirth as string | null) : (data.birthYear as number | null);
	const linkedUser = data.user ? await validateProfileUserChange({ id: null, user: null }, Number(data.user), tenantId) : null;
	const avatarId = await ensureAvatarExists(data.avatar as number | null);

	try {
		const createdId = await strapi.db.connection.transaction(async (trx: any) => {
			await acquireSportsProfileCodeLock(trx, tenantId, String(data.code || ''));
			if (linkedUser?.id) {
				await acquireSportsProfileUserLock(trx, tenantId, Number(linkedUser.id));
				await validateProfileUserChange({ id: null, user: null }, Number(linkedUser.id), tenantId, trx);
			}
			const duplicate = await findSportsProfileByCode(tenantId, String(data.code || ''), trx);
			if (duplicate?.id) {
				httpError(409, 'Sports profile code already exists in this tenant.', 'SPORTS_PROFILE_CODE_ALREADY_EXISTS', { field: 'code' });
			}

			const created = await strapi.db.query(SPORTS_PROFILE_UID).create({
				data: {
					...data,
					tenant: tenantId,
					user: linkedUser?.id || null,
					avatar: avatarId,
					status: data.status || 'active',
				},
				transacting: trx,
			} as any);

			return Number(created.id);
		});

		return await getTenantSportsProfile(createdId, tenantId);
	} catch (error) {
		const message = parseErrorMessage(error);
		if (/tenant \+ code must be unique/i.test(message)) {
			httpError(409, 'Sports profile code already exists in this tenant.', 'SPORTS_PROFILE_CODE_ALREADY_EXISTS', { field: 'code' });
		}
		throw error;
	}
}

export async function updateTenantSportsProfile(profileRef: unknown, input: GenericRecord, tenantId: number | string) {
	ensureNoUnknownWriteFields(input || {});
	const existing = await findSportsProfileInTenant(profileRef, tenantId);
	const data = buildWriteData(input || {}, existing);
	data.birthYear = data.dateOfBirth ? deriveBirthYearFromDate(data.dateOfBirth as string | null) : (data.birthYear as number | null);
	const linkedUser = hasOwn(input, 'user')
		? await validateProfileUserChange(existing, data.user ? Number(data.user) : null, tenantId)
		: mapUser(existing.user);
	const avatarId = hasOwn(input, 'avatar')
		? await ensureAvatarExists(data.avatar as number | null)
		: (existing.avatar?.id ? Number(existing.avatar.id) : null);

	try {
		await strapi.db.connection.transaction(async (trx: any) => {
			await acquireSportsProfileCodeLock(trx, tenantId, String(data.code || ''));
			if (hasOwn(input, 'user') && linkedUser?.id) {
				await acquireSportsProfileLinkLock(trx, tenantId, Number(existing.id), Number(linkedUser.id));
				await validateProfileUserChange(existing, Number(linkedUser.id), tenantId, trx);
			} else if (hasOwn(input, 'user') && !linkedUser?.id && existing.user?.id) {
				await acquireSportsProfileLinkLock(trx, tenantId, Number(existing.id), Number(existing.user.id));
			}
			const duplicate = await findSportsProfileByCode(tenantId, String(data.code || ''), trx);
			if (duplicate?.id && Number(duplicate.id) !== Number(existing.id)) {
				httpError(409, 'Sports profile code already exists in this tenant.', 'SPORTS_PROFILE_CODE_ALREADY_EXISTS', { field: 'code' });
			}

			await strapi.db.query(SPORTS_PROFILE_UID).update({
				where: { id: existing.id },
				data: {
					...data,
					tenant: tenantId,
					user: hasOwn(input, 'user') ? (linkedUser?.id || null) : (existing.user?.id || null),
					avatar: hasOwn(input, 'avatar') ? avatarId : (existing.avatar?.id || null),
				},
				transacting: trx,
			} as any);
		});

		return await getTenantSportsProfile(existing.id, tenantId);
	} catch (error) {
		const message = parseErrorMessage(error);
		if (/tenant \+ code must be unique/i.test(message)) {
			httpError(409, 'Sports profile code already exists in this tenant.', 'SPORTS_PROFILE_CODE_ALREADY_EXISTS', { field: 'code' });
		}
		throw error;
	}
}

export async function listLinkableTenantUsersForSportsProfile(profileRef: unknown, query: Record<string, unknown>, tenantId: number | string) {
	await findSportsProfileInTenant(profileRef, tenantId);
	const page = toPositiveInt(query.page, 1);
	const pageSize = Math.min(100, toPositiveInt(query.pageSize, 10));
	const keyword = toText(query.keyword ?? query.search ?? query.q);
	const where = {
		tenant: tenantId,
		...buildLinkableUserWhere(keyword),
	};

	const total = await strapi.db.query(USER_TENANT_UID).count({ where } as any);
	const rows = await strapi.db.query(USER_TENANT_UID).findMany({
		where,
		offset: (page - 1) * pageSize,
		limit: pageSize,
		orderBy: [{ id: 'desc' }],
		select: ['id', 'label', 'userTenantStatus', 'joinedAt'],
		populate: {
			user: {
				select: ['id', 'documentId', 'username', 'email', 'fullName', 'phone', 'blocked', 'confirmed'],
			},
		},
	} as any);

	const profiles = await findProfilesByUserIds(tenantId, (rows || []).map((item: any) => Number(item?.user?.id || 0)));
	const profileByUserId = new Map<number, any>();
		for (const profile of profiles || []) {
			const userId = Number(profile?.user?.id || 0);
			if (!userId || profileByUserId.has(userId)) continue;
			profileByUserId.set(userId, profile);
		}

	return {
		rows: (rows || []).map((row: any) => {
			const user = mapUser(row?.user);
			const linkedSportsProfile = user?.id ? mapLinkedProfileSummary(profileByUserId.get(Number(user.id))) : null;
			const isMergedOnly = linkedSportsProfile?.status === 'merged';
			return {
				userTenantId: Number(row?.id || 0) || null,
				userTenantStatus: toText(row?.userTenantStatus) || null,
				joinedAt: row?.joinedAt || null,
				label: toText(row?.label) || null,
				user,
				linkedSportsProfile,
				canLink: !linkedSportsProfile,
				linkBlockedReason: linkedSportsProfile
					? (isMergedOnly
						? 'User đang liên kết với hồ sơ thể thao đã gộp; cần rà soát dữ liệu trước khi liên kết mới.'
						: 'User này đã được liên kết với một hồ sơ thể thao khác.')
					: null,
			};
		}),
		pagination: {
			page,
			pageSize,
			pageCount: Math.max(1, Math.ceil(total / pageSize)),
			total,
		},
	};
}

export async function linkTenantSportsProfileUser(profileRef: unknown, input: GenericRecord, tenantId: number | string, authUser: { id: number } | null = null) {
	ensureNoUnknownFields(input || {}, ['userId']);
	const userId = Number(extractRelationRef(input?.userId ?? input?.user));
	if (!Number.isInteger(userId) || userId <= 0) {
		httpError(400, 'userId is required', 'INVALID_REQUEST_BODY', { field: 'userId' });
	}

	const existing = await findSportsProfileInTenant(profileRef, tenantId);
	if (toText(existing.status).toLowerCase() === 'merged') {
		httpError(409, 'Không thể liên kết User với hồ sơ thể thao đã gộp.', 'SPORTS_PROFILE_MERGED_LOCKED');
	}
	if (existing.user?.id && Number(existing.user.id) !== userId) {
		httpError(409, 'Hồ sơ thể thao này đã liên kết User khác. Hãy gỡ liên kết hiện tại trước.', 'SPORTS_PROFILE_ALREADY_LINKED_TO_OTHER_USER', {
			field: 'userId',
			currentUser: mapUser(existing.user),
		});
	}

	await strapi.db.connection.transaction(async (trx: any) => {
		await acquireSportsProfileLinkLock(trx, tenantId, Number(existing.id), userId);
		await validateProfileUserChange(existing, userId, tenantId, trx);
		await strapi.db.query(SPORTS_PROFILE_UID).update({
			where: { id: Number(existing.id) },
			data: { user: userId },
			transacting: trx,
		} as any);
	});

	await logSportsProfileLinkAction('link-user', {
		tenantId,
		profileId: Number(existing.id),
		userId,
		actorUserId: Number(authUser?.id || 0) || null,
		timestamp: new Date().toISOString(),
	});

	return await getTenantSportsProfile(existing.id, tenantId);
}

export async function unlinkTenantSportsProfileUser(profileRef: unknown, tenantId: number | string, authUser: { id: number } | null = null) {
	const existing = await findSportsProfileInTenant(profileRef, tenantId);
	if (!existing.user?.id) {
		return mapSportsProfileRow(existing, { includeLongText: true });
	}

	const previousUserId = Number(existing.user.id);
	await strapi.db.connection.transaction(async (trx: any) => {
		await acquireSportsProfileLinkLock(trx, tenantId, Number(existing.id), previousUserId);
		await strapi.db.query(SPORTS_PROFILE_UID).update({
			where: { id: Number(existing.id) },
			data: { user: null },
			transacting: trx,
		} as any);
	});

	await logSportsProfileLinkAction('unlink-user', {
		tenantId,
		profileId: Number(existing.id),
		userId: previousUserId,
		actorUserId: Number(authUser?.id || 0) || null,
		timestamp: new Date().toISOString(),
	});

	return await getTenantSportsProfile(existing.id, tenantId);
}

export async function activateTenantSportsProfile(profileRef: unknown, tenantId: number | string) {
	const existing = await findSportsProfileInTenant(profileRef, tenantId);
	if (toText(existing.status).toLowerCase() === 'active') {
		return mapSportsProfileRow(existing, { includeLongText: true });
	}

	await strapi.db.query(SPORTS_PROFILE_UID).update({
		where: { id: existing.id },
		data: { status: 'active' },
	} as any);

	return await getTenantSportsProfile(existing.id, tenantId);
}

export async function deactivateTenantSportsProfile(profileRef: unknown, tenantId: number | string) {
	const existing = await findSportsProfileInTenant(profileRef, tenantId);
	if (toText(existing.status).toLowerCase() === 'merged') {
		httpError(409, 'Merged sports profile cannot be inactivated.', 'SPORTS_PROFILE_MERGED_LOCKED');
	}
	if (toText(existing.status).toLowerCase() === 'inactive') {
		return mapSportsProfileRow(existing, { includeLongText: true });
	}

	await strapi.db.query(SPORTS_PROFILE_UID).update({
		where: { id: existing.id },
		data: { status: 'inactive' },
	} as any);

	return await getTenantSportsProfile(existing.id, tenantId);
}

export default {
	listTenantSportsProfiles,
	getTenantSportsProfile,
	createTenantSportsProfile,
	updateTenantSportsProfile,
	activateTenantSportsProfile,
	deactivateTenantSportsProfile,
	listLinkableTenantUsersForSportsProfile,
	linkTenantSportsProfileUser,
	unlinkTenantSportsProfileUser,
	handleSportsProfileError,
};