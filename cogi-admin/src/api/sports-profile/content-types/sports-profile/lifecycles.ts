import { errors } from '@strapi/utils';
import { extractRelationRef, hasOwn, toText } from '../../../../utils/tenant-scope';

const SPORTS_PROFILE_UID = 'api::sports-profile.sports-profile';

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

function normalizeGender(value: unknown): 'male' | 'female' | 'other' | 'unspecified' {
	const text = toText(value).toLowerCase();
	if (text === 'male' || text === 'female' || text === 'other') return text;
	return 'unspecified';
}

function normalizeStatus(value: unknown): 'active' | 'inactive' | 'merged' {
	const text = toText(value).toLowerCase();
	if (text === 'inactive' || text === 'merged') return text;
	return 'active';
}

function normalizeSource(value: unknown): 'manual_import' | 'self_registration' | 'campaign' | 'admin_created' | 'other' | null {
	const text = toText(value).toLowerCase();
	if (!text) return null;
	if (['manual_import', 'self_registration', 'campaign', 'admin_created', 'other'].includes(text)) {
		return text as 'manual_import' | 'self_registration' | 'campaign' | 'admin_created' | 'other';
	}
	throw new errors.ApplicationError('source is invalid');
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

function normalizeBirthYear(value: unknown): number | null {
	if (value === null || value === undefined || value === '') return null;
	const parsed = Number(value);
	if (!Number.isInteger(parsed) || parsed < 1900 || parsed > 2100) {
		throw new errors.ApplicationError('birthYear is invalid');
	}
	return parsed;
}

function deriveBirthYearFromDate(dateOfBirth: string | null): number | null {
	if (!dateOfBirth) return null;
	const parsedYear = Number(String(dateOfBirth).slice(0, 4));
	return Number.isInteger(parsedYear) ? parsedYear : null;
}

async function loadExistingProfile(where: unknown) {
	const normalizedWhere = typeof where === 'object' && where !== null
		? Object.fromEntries(
			Object.entries(where as Record<string, unknown>).filter(
				([key, value]) => !(key === 'locale' && (value === '' || value === null)),
			),
		)
		: where;

	if (!normalizedWhere) return null;

	return strapi.db.query(SPORTS_PROFILE_UID).findOne({
		where: normalizedWhere,
		populate: {
			tenant: { select: ['id', 'documentId'] },
			user: { select: ['id'] },
			avatar: { select: ['id'] },
		},
	});
}

async function findProfilesByTenantAndCode(tenantRef: string | number, code: string) {
	return strapi.db.query(SPORTS_PROFILE_UID).findMany({
		where: {
			tenant: { id: { $eq: tenantRef } },
			code: { $eq: code },
		},
		select: ['id', 'code'],
	});
}

async function ensureSportsProfileValid(params: { data?: GenericRecord; where?: unknown }) {
	const data = (params.data || {}) as GenericRecord;
	const existing = await loadExistingProfile(params.where);
	const requestTenantId = getRequestContextTenantId();

	if ((data.tenant === null || data.tenant === undefined || data.tenant === '') && requestTenantId) {
		data.tenant = requestTenantId;
	}

	const tenantRef = extractRelationRef(data.tenant) || extractEntryRelationRef(existing?.tenant) || requestTenantId;
	const code = hasOwn(data, 'code')
		? normalizeRequiredString(data.code, 'code', 100).toUpperCase()
		: normalizeRequiredString(existing?.code, 'code', 100).toUpperCase();
	const fullName = hasOwn(data, 'fullName')
		? normalizeRequiredString(data.fullName, 'fullName', 150)
		: normalizeRequiredString(existing?.fullName, 'fullName', 150);
	const displayName = hasOwn(data, 'displayName') ? normalizeOptionalString(data.displayName, 150) : normalizeOptionalString(existing?.displayName, 150);
	const hometown = hasOwn(data, 'hometown') ? normalizeOptionalString(data.hometown, 150) : normalizeOptionalString(existing?.hometown, 150);
	const bio = hasOwn(data, 'bio') ? normalizeOptionalString(data.bio) : normalizeOptionalString(existing?.bio);
	const contactPhone = hasOwn(data, 'contactPhone') ? normalizeOptionalString(data.contactPhone, 30) : normalizeOptionalString(existing?.contactPhone, 30);
	const contactEmail = hasOwn(data, 'contactEmail') ? normalizeEmail(data.contactEmail) : normalizeEmail(existing?.contactEmail);
	const gender = hasOwn(data, 'gender') ? normalizeGender(data.gender) : normalizeGender(existing?.gender);
	const dateOfBirth = hasOwn(data, 'dateOfBirth') ? normalizeDate(data.dateOfBirth, 'dateOfBirth') : normalizeDate(existing?.dateOfBirth, 'dateOfBirth');
	const requestedBirthYear = hasOwn(data, 'birthYear') ? normalizeBirthYear(data.birthYear) : normalizeBirthYear(existing?.birthYear);
	const status = hasOwn(data, 'status') ? normalizeStatus(data.status) : normalizeStatus(existing?.status);
	const source = hasOwn(data, 'source') ? normalizeSource(data.source) : normalizeSource(existing?.source);
	const sourceReference = hasOwn(data, 'sourceReference') ? normalizeOptionalString(data.sourceReference, 255) : normalizeOptionalString(existing?.sourceReference, 255);
	const birthYear = dateOfBirth ? deriveBirthYearFromDate(dateOfBirth) : requestedBirthYear;

	if (!tenantRef) {
		throw new errors.ApplicationError('tenant is required');
	}

	const siblings = await findProfilesByTenantAndCode(tenantRef, code);
	const ignoreId = existing?.id ? String(existing.id) : null;
	const duplicate = (siblings || []).find((item: any) => !ignoreId || String(item?.id) !== ignoreId);
	if (duplicate) {
		throw new errors.ApplicationError('tenant + code must be unique');
	}

	data.tenant = tenantRef;
	data.code = code;
	data.fullName = fullName;
	data.displayName = displayName;
	data.hometown = hometown;
	data.bio = bio;
	data.contactPhone = contactPhone;
	data.contactEmail = contactEmail;
	data.gender = gender;
	data.dateOfBirth = dateOfBirth;
	data.birthYear = birthYear;
	data.status = status;
	data.source = source;
	data.sourceReference = sourceReference;
	if (hasOwn(data, 'user') && (data.user === '' || data.user === undefined)) data.user = null;
	if (hasOwn(data, 'avatar') && (data.avatar === '' || data.avatar === undefined)) data.avatar = null;
	if (!hasOwn(data, 'user') && existing?.user && !existing.user.id) data.user = null;
	if (!hasOwn(data, 'avatar') && existing?.avatar && !existing.avatar.id) data.avatar = null;
}

export default {
	async beforeCreate(event: any) {
		await ensureSportsProfileValid({ data: event.params?.data });
	},

	async beforeUpdate(event: any) {
		await ensureSportsProfileValid({ data: event.params?.data, where: event.params?.where });
	},
};