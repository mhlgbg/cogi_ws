import { errors } from '@strapi/utils';
import { extractRelationRef, hasOwn, toText, whereByParam } from '../../../../utils/tenant-scope';

const CLUB_MEMBERSHIP_UID = 'api::club-membership.club-membership';
const SPORTS_PROFILE_UID = 'api::sports-profile.sports-profile';
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

function normalizeDate(value: unknown, fieldName: string): string | null {
	const text = toText(value);
	if (!text) return null;
	const date = new Date(text);
	if (Number.isNaN(date.getTime())) {
		throw new errors.ApplicationError(`${fieldName} is invalid`);
	}
	return date.toISOString().slice(0, 10);
}

function normalizeStatus(value: unknown): 'pending' | 'active' | 'inactive' | 'left' | 'suspended' | 'rejected' {
	const text = toText(value).toLowerCase();
	if (['pending', 'inactive', 'left', 'suspended', 'rejected'].includes(text)) {
		return text as 'pending' | 'active' | 'inactive' | 'left' | 'suspended' | 'rejected';
	}
	return 'active';
}

function normalizeRole(value: unknown): 'member' | 'manager' | 'admin' | 'owner' {
	const text = toText(value).toLowerCase();
	if (text === 'manager' || text === 'admin' || text === 'owner') return text;
	return 'member';
}

function normalizeSource(value: unknown): 'manual_import' | 'self_registration' | 'campaign' | 'invite' | 'admin_created' | 'other' | null {
	const text = toText(value).toLowerCase();
	if (!text) return null;
	if (['manual_import', 'self_registration', 'campaign', 'invite', 'admin_created', 'other'].includes(text)) {
		return text as 'manual_import' | 'self_registration' | 'campaign' | 'invite' | 'admin_created' | 'other';
	}
	throw new errors.ApplicationError('source is invalid');
}

async function loadExistingMembership(where: unknown) {
	const normalizedWhere = typeof where === 'object' && where !== null
		? Object.fromEntries(
			Object.entries(where as Record<string, unknown>).filter(
				([key, value]) => !(key === 'locale' && (value === '' || value === null)),
			),
		)
		: where;

	if (!normalizedWhere) return null;

	return strapi.db.query(CLUB_MEMBERSHIP_UID).findOne({
		where: normalizedWhere,
		select: ['id', 'documentId', 'memberCode', 'oldMemberCode', 'status', 'role', 'positionTitle', 'joinedAt', 'leftAt', 'source', 'sourceReference', 'joinMessage', 'note'],
		populate: {
			tenant: { select: ['id', 'documentId'] },
			sportsProfile: { select: ['id', 'documentId'] },
			club: { select: ['id', 'documentId'] },
			approvedBy: { select: ['id', 'documentId'] },
		},
	});
}

async function loadEntityInTenant(uid: string, ref: unknown, tenantRef: string | number) {
	const where = whereByParam(ref);
	if (!where) return null;
	return strapi.db.query(uid).findOne({
		where: {
			$and: [
				where,
				{ tenant: { id: { $eq: tenantRef } } },
			],
		},
		populate: { tenant: { select: ['id'] } },
		select: ['id', 'documentId'],
	});
}

async function findMembershipByProfileAndClub(tenantRef: string | number, sportsProfileRef: string | number, clubRef: string | number) {
	return strapi.db.query(CLUB_MEMBERSHIP_UID).findMany({
		where: {
			tenant: { id: { $eq: tenantRef } },
			sportsProfile: { id: { $eq: sportsProfileRef } },
			club: { id: { $eq: clubRef } },
		},
		select: ['id'],
	});
}

async function findMembershipByClubAndMemberCode(clubRef: string | number, memberCode: string) {
	if (!memberCode) return [];
	return strapi.db.query(CLUB_MEMBERSHIP_UID).findMany({
		where: {
			club: { id: { $eq: clubRef } },
			memberCode: { $eq: memberCode },
		},
		select: ['id'],
	});
}

async function ensureClubMembershipValid(params: { data?: GenericRecord; where?: unknown }) {
	const data = (params.data || {}) as GenericRecord;
	const existing = await loadExistingMembership(params.where);
	const requestTenantId = getRequestContextTenantId();

	if ((data.tenant === null || data.tenant === undefined || data.tenant === '') && requestTenantId) {
		data.tenant = requestTenantId;
	}

	const tenantRef = extractRelationRef(data.tenant) || extractEntryRelationRef(existing?.tenant) || requestTenantId;
	const sportsProfileRef = hasOwn(data, 'sportsProfile') ? extractRelationRef(data.sportsProfile) : extractEntryRelationRef(existing?.sportsProfile);
	const clubRef = hasOwn(data, 'club') ? extractRelationRef(data.club) : extractEntryRelationRef(existing?.club);
	const memberCode = hasOwn(data, 'memberCode') ? normalizeOptionalString(data.memberCode, 100)?.toUpperCase() || null : normalizeOptionalString(existing?.memberCode, 100)?.toUpperCase() || null;
	const oldMemberCode = hasOwn(data, 'oldMemberCode') ? normalizeOptionalString(data.oldMemberCode, 100)?.toUpperCase() || null : normalizeOptionalString(existing?.oldMemberCode, 100)?.toUpperCase() || null;
	const status = hasOwn(data, 'status') ? normalizeStatus(data.status) : normalizeStatus(existing?.status);
	const role = hasOwn(data, 'role') ? normalizeRole(data.role) : normalizeRole(existing?.role);
	const positionTitle = hasOwn(data, 'positionTitle') ? normalizeOptionalString(data.positionTitle, 150) : normalizeOptionalString(existing?.positionTitle, 150);
	const currentJoinedAt = normalizeDate(existing?.joinedAt, 'joinedAt');
	let joinedAt = hasOwn(data, 'joinedAt') ? normalizeDate(data.joinedAt, 'joinedAt') : currentJoinedAt;
	let leftAt = hasOwn(data, 'leftAt') ? normalizeDate(data.leftAt, 'leftAt') : normalizeDate(existing?.leftAt, 'leftAt');
	const source = hasOwn(data, 'source') ? normalizeSource(data.source) : normalizeSource(existing?.source);
	const sourceReference = hasOwn(data, 'sourceReference') ? normalizeOptionalString(data.sourceReference, 255) : normalizeOptionalString(existing?.sourceReference, 255);
	const joinMessage = hasOwn(data, 'joinMessage') ? normalizeOptionalString(data.joinMessage) : normalizeOptionalString(existing?.joinMessage);
	const note = hasOwn(data, 'note') ? normalizeOptionalString(data.note) : normalizeOptionalString(existing?.note);

	if (!tenantRef) {
		throw new errors.ApplicationError('tenant is required');
	}
	if (!sportsProfileRef) {
		throw new errors.ApplicationError('sportsProfile is required');
	}
	if (!clubRef) {
		throw new errors.ApplicationError('club is required');
	}

	const sportsProfile = await loadEntityInTenant(SPORTS_PROFILE_UID, sportsProfileRef, tenantRef);
	if (!sportsProfile?.id) {
		throw new errors.ApplicationError('sportsProfile must belong to current tenant');
	}
	const club = await loadEntityInTenant(SPORTS_CLUB_UID, clubRef, tenantRef);
	if (!club?.id) {
		throw new errors.ApplicationError('club must belong to current tenant');
	}

	const siblings = await findMembershipByProfileAndClub(tenantRef, sportsProfile.id, club.id);
	const ignoreId = existing?.id ? String(existing.id) : null;
	const duplicate = (siblings || []).find((item: any) => !ignoreId || String(item?.id) !== ignoreId);
	if (duplicate) {
		throw new errors.ApplicationError('tenant + sportsProfile + club must be unique');
	}

	if (memberCode) {
		const sameMemberCode = await findMembershipByClubAndMemberCode(club.id, memberCode);
		const duplicateMemberCode = (sameMemberCode || []).find((item: any) => !ignoreId || String(item?.id) !== ignoreId);
		if (duplicateMemberCode) {
			throw new errors.ApplicationError('club + memberCode must be unique');
		}
	}

	if (!joinedAt && status === 'active') {
		joinedAt = new Date().toISOString().slice(0, 10);
	}
	if (status === 'left') {
		if (!leftAt) leftAt = new Date().toISOString().slice(0, 10);
	} else if (status === 'active' && currentJoinedAt && normalizeStatus(existing?.status) === 'left') {
		leftAt = null;
		joinedAt = currentJoinedAt;
	}

	data.tenant = tenantRef;
	data.sportsProfile = sportsProfile.id;
	data.club = club.id;
	data.memberCode = memberCode;
	data.oldMemberCode = oldMemberCode;
	data.status = status;
	data.role = role;
	data.positionTitle = positionTitle;
	data.joinedAt = joinedAt;
	data.leftAt = leftAt;
	data.source = source;
	data.sourceReference = sourceReference;
	data.joinMessage = joinMessage;
	data.note = note;
	if (hasOwn(data, 'approvedAt')) delete data.approvedAt;
	if (hasOwn(data, 'approvedBy')) delete data.approvedBy;
}

export default {
	async beforeCreate(event: any) {
		await ensureClubMembershipValid({ data: event.params?.data });
	},

	async beforeUpdate(event: any) {
		await ensureClubMembershipValid({ data: event.params?.data, where: event.params?.where });
	},
};