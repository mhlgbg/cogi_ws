import { extractRelationRef, hasOwn, mergeTenantWhere, normalizeSortInput, toPositiveInt, toText, whereByParam } from '../../../utils/tenant-scope';
import {
	buildMembershipCreateHistoryEvents,
	buildMembershipUpdateHistoryEvents,
	createMembershipHistoryEntries,
} from '../../club-membership-history/services/club-membership-history';

const CLUB_MEMBERSHIP_UID = 'api::club-membership.club-membership' as any;
const SPORTS_PROFILE_UID = 'api::sports-profile.sports-profile' as any;
const SPORTS_CLUB_UID = 'api::sports-club.sports-club' as any;
const MEMBERSHIP_PROFILE_LINK_TABLE = 'club_memberships_sports_profile_lnk';
const MEMBERSHIP_CLUB_LINK_TABLE = 'club_memberships_club_lnk';

type HttpErrorDetails = Record<string, unknown> | Array<Record<string, unknown>> | null;
type GenericRecord = Record<string, unknown>;

const STATUS_VALUES = new Set(['pending', 'active', 'inactive', 'left', 'suspended', 'rejected']);
const ROLE_VALUES = new Set(['member', 'manager', 'admin', 'owner']);
const SOURCE_VALUES = new Set(['manual_import', 'self_registration', 'campaign', 'invite', 'admin_created', 'other']);

type AuthUser = { id: number } | null;

export class ClubMembershipError extends Error {
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
	throw new ClubMembershipError(status, message, code, details);
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
		'sportsProfile',
		'club',
		'memberCode',
		'oldMemberCode',
		'status',
		'role',
		'positionTitle',
		'joinedAt',
		'leftAt',
		'source',
		'sourceReference',
		'joinMessage',
		'note',
	]);
	if (Object.prototype.hasOwnProperty.call(payload, 'tenant')) {
		httpError(400, 'tenant is managed by tenant context', 'TENANT_CONTEXT_ONLY');
	}
	if (Object.prototype.hasOwnProperty.call(payload, 'approvedAt') || Object.prototype.hasOwnProperty.call(payload, 'approvedBy')) {
		httpError(400, 'approvedAt and approvedBy are server-managed fields', 'SERVER_MANAGED_FIELDS');
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

function normalizeRequiredRelationRef(value: unknown, fieldName: string) {
	const ref = extractRelationRef(value);
	if (!ref) {
		httpError(400, `${fieldName} is required`, 'INVALID_REQUEST_BODY', { field: fieldName });
	}
	return ref;
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

function normalizeStatus(value: unknown): 'pending' | 'active' | 'inactive' | 'left' | 'suspended' | 'rejected' {
	const text = toText(value).toLowerCase() || 'active';
	if (!STATUS_VALUES.has(text)) {
		httpError(400, 'status is invalid', 'INVALID_STATUS', { field: 'status' });
	}
	return text as 'pending' | 'active' | 'inactive' | 'left' | 'suspended' | 'rejected';
}

function normalizeRole(value: unknown): 'member' | 'manager' | 'admin' | 'owner' {
	const text = toText(value).toLowerCase() || 'member';
	if (!ROLE_VALUES.has(text)) {
		httpError(400, 'role is invalid', 'INVALID_ROLE', { field: 'role' });
	}
	return text as 'member' | 'manager' | 'admin' | 'owner';
}

function normalizeSource(value: unknown): 'manual_import' | 'self_registration' | 'campaign' | 'invite' | 'admin_created' | 'other' | null {
	const text = toText(value).toLowerCase();
	if (!text) return null;
	if (!SOURCE_VALUES.has(text)) {
		httpError(400, 'source is invalid', 'INVALID_SOURCE', { field: 'source' });
	}
	return text as 'manual_import' | 'self_registration' | 'campaign' | 'invite' | 'admin_created' | 'other';
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

function mapSportsProfile(profile: any) {
	if (!profile?.id) return null;
	return {
		id: Number(profile.id),
		documentId: toText(profile.documentId) || null,
		code: toText(profile.code) || null,
		fullName: toText(profile.fullName) || null,
		displayName: toText(profile.displayName) || null,
		contactPhone: toText(profile.contactPhone) || null,
		contactEmail: toText(profile.contactEmail) || null,
		avatar: mapMedia(profile.avatar),
	};
}

function mapClub(club: any) {
	if (!club?.id) return null;
	return {
		id: Number(club.id),
		documentId: toText(club.documentId) || null,
		code: toText(club.code) || null,
		name: toText(club.name) || null,
		shortName: toText(club.shortName) || null,
		logo: mapMedia(club.logo),
	};
}

function mapApprovedBy(user: any) {
	if (!user?.id) return null;
	return {
		id: Number(user.id),
		documentId: toText(user.documentId) || null,
		username: toText(user.username) || null,
		email: toText(user.email) || null,
		fullName: toText(user.fullName) || null,
	};
}

function mapMembershipRowBase(row: any) {
	return {
		id: Number(row?.id || 0),
		documentId: row?.documentId || null,
		memberCode: normalizeOptionalText(row?.memberCode, 100),
		oldMemberCode: normalizeOptionalText(row?.oldMemberCode, 100),
		status: toText(row?.status).toLowerCase() || 'active',
		role: toText(row?.role).toLowerCase() || 'member',
		positionTitle: normalizeOptionalText(row?.positionTitle, 150),
		joinedAt: row?.joinedAt || null,
		leftAt: row?.leftAt || null,
		source: toText(row?.source).toLowerCase() || null,
		sourceReference: normalizeOptionalText(row?.sourceReference, 255),
		joinMessage: normalizeOptionalText(row?.joinMessage),
		note: normalizeOptionalText(row?.note),
		approvedAt: row?.approvedAt || null,
		approvedBy: mapApprovedBy(row?.approvedBy),
		createdAt: row?.createdAt || null,
		updatedAt: row?.updatedAt || null,
		sportsProfileRef: extractRelationRef(row?.sportsProfile),
		clubRef: extractRelationRef(row?.club),
	};
}

function mapClubMembershipRow(row: any, options: { includeLongText?: boolean } = {}) {
	return {
		id: Number(row?.id || 0),
		documentId: row?.documentId || null,
		memberCode: normalizeOptionalText(row?.memberCode, 100),
		oldMemberCode: normalizeOptionalText(row?.oldMemberCode, 100),
		status: toText(row?.status).toLowerCase() || 'active',
		role: toText(row?.role).toLowerCase() || 'member',
		positionTitle: normalizeOptionalText(row?.positionTitle, 150),
		joinedAt: row?.joinedAt || null,
		leftAt: row?.leftAt || null,
		source: toText(row?.source).toLowerCase() || null,
		sourceReference: normalizeOptionalText(row?.sourceReference, 255),
		joinMessage: options.includeLongText ? normalizeOptionalText(row?.joinMessage) : normalizeOptionalText(row?.joinMessage, 240),
		note: options.includeLongText ? normalizeOptionalText(row?.note) : normalizeOptionalText(row?.note, 240),
		approvedAt: row?.approvedAt || null,
		approvedBy: mapApprovedBy(row?.approvedBy),
		sportsProfile: mapSportsProfile(row?.sportsProfile),
		club: mapClub(row?.club),
		createdAt: row?.createdAt || null,
		updatedAt: row?.updatedAt || null,
	};
}

function buildListWhere(query: Record<string, unknown>) {
	const clauses: Array<Record<string, unknown>> = [];
	const keyword = toText(query.search ?? query.q);
	const status = toText(query.status).toLowerCase();
	const role = toText(query.role).toLowerCase();
	const club = extractRelationRef(query.club);
	const sportsProfile = extractRelationRef(query.sportsProfile);
	const source = toText(query.source).toLowerCase();
	const hasMemberCode = normalizeBooleanFilter(query.hasMemberCode);

	if (keyword) {
		clauses.push({
			$or: [
				{ memberCode: { $containsi: keyword } },
				{ oldMemberCode: { $containsi: keyword } },
				{ sportsProfile: { code: { $containsi: keyword } } },
				{ sportsProfile: { fullName: { $containsi: keyword } } },
				{ sportsProfile: { displayName: { $containsi: keyword } } },
				{ sportsProfile: { contactPhone: { $containsi: keyword } } },
				{ sportsProfile: { contactEmail: { $containsi: keyword } } },
				{ club: { code: { $containsi: keyword } } },
				{ club: { name: { $containsi: keyword } } },
			],
		});
	}

	if (status && STATUS_VALUES.has(status)) clauses.push({ status: { $eq: status } });
	if (role && ROLE_VALUES.has(role)) clauses.push({ role: { $eq: role } });
	if (source && SOURCE_VALUES.has(source)) clauses.push({ source: { $eq: source } });
	if (club) {
		const clubWhere = whereByParam(club);
		if (clubWhere?.id) clauses.push({ club: { id: { $eq: clubWhere.id } } });
		if (clubWhere?.documentId) clauses.push({ club: { documentId: { $eq: clubWhere.documentId } } });
	}
	if (sportsProfile) {
		const profileWhere = whereByParam(sportsProfile);
		if (profileWhere?.id) clauses.push({ sportsProfile: { id: { $eq: profileWhere.id } } });
		if (profileWhere?.documentId) clauses.push({ sportsProfile: { documentId: { $eq: profileWhere.documentId } } });
	}
	if (hasMemberCode === true) clauses.push({ memberCode: { $notNull: true, $ne: '' } });
	if (hasMemberCode === false) clauses.push({ $or: [{ memberCode: { $null: true } }, { memberCode: { $eq: '' } }] });

	if (clauses.length === 0) return {};
	if (clauses.length === 1) return clauses[0];
	return { $and: clauses };
}

function resolveOrderBy(query: Record<string, unknown>) {
	const normalizedSort = normalizeSortInput(query?.sort);
	if (normalizedSort.length > 0) {
		const allowed = new Set(['memberCode', 'oldMemberCode', 'status', 'role', 'joinedAt', 'leftAt', 'source', 'updatedAt', 'createdAt']);
		const safe = normalizedSort
			.map((entry) => {
				const key = Object.keys(entry)[0];
				if (!allowed.has(key)) return null;
				return { [key]: entry[key] } as Record<string, 'asc' | 'desc'>;
			})
			.filter(Boolean) as Array<Record<string, 'asc' | 'desc'>>;
		if (safe.length > 0) return safe;
	}
	return [{ updatedAt: 'desc' }, { id: 'asc' }];
}

async function findSportsProfileInTenant(profileRef: unknown, tenantId: number | string, transacting?: any) {
	const where = whereByParam(profileRef);
	if (!where) httpError(404, 'Sports profile not found', 'SPORTS_PROFILE_NOT_FOUND');
	const row = await strapi.db.query(SPORTS_PROFILE_UID).findOne({
		where: mergeTenantWhere(where, tenantId),
		populate: { avatar: { select: ['id', 'name', 'url', 'mime'] } },
		...(transacting ? { transacting } : {}),
	} as any);
	if (!row?.id) httpError(400, 'sportsProfile must belong to current tenant', 'SPORTS_PROFILE_OUTSIDE_TENANT', { field: 'sportsProfile' });
	return row;
}

async function findSportsClubInTenant(clubRef: unknown, tenantId: number | string, transacting?: any) {
	const where = whereByParam(clubRef);
	if (!where) httpError(404, 'Sports club not found', 'SPORTS_CLUB_NOT_FOUND');
	const row = await strapi.db.query(SPORTS_CLUB_UID).findOne({
		where: mergeTenantWhere(where, tenantId),
		populate: { logo: { select: ['id', 'name', 'url', 'mime'] } },
		...(transacting ? { transacting } : {}),
	} as any);
	if (!row?.id) httpError(400, 'club must belong to current tenant', 'SPORTS_CLUB_OUTSIDE_TENANT', { field: 'club' });
	return row;
}

async function findMembershipInTenant(membershipRef: unknown, tenantId: number | string, transacting?: any) {
	const where = whereByParam(membershipRef);
	if (!where) httpError(404, 'Club membership not found', 'CLUB_MEMBERSHIP_NOT_FOUND');
	const row = await strapi.db.query(CLUB_MEMBERSHIP_UID).findOne({
		where: mergeTenantWhere(where, tenantId),
		populate: {
			sportsProfile: { select: ['id', 'documentId'] },
			club: { select: ['id', 'documentId'] },
			approvedBy: { select: ['id', 'documentId', 'username', 'email', 'fullName'] },
		},
		...(transacting ? { transacting } : {}),
	} as any);
	if (!row?.id) httpError(404, 'Club membership not found', 'CLUB_MEMBERSHIP_NOT_FOUND');
	return row;
}

async function hydrateMembershipRelations(rows: any[], tenantId: number | string, options: { includeLongText?: boolean } = {}) {
	const items = Array.isArray(rows) ? rows : [];
	if (items.length === 0) return [];

	const membershipIds = items.map((row) => Number(row?.id || 0)).filter((value) => Number.isInteger(value) && value > 0);
	const [profileLinks, clubLinks] = await Promise.all([
		strapi.db.connection(MEMBERSHIP_PROFILE_LINK_TABLE)
			.select('club_membership_id', 'sports_profile_id')
			.whereIn('club_membership_id', membershipIds),
		strapi.db.connection(MEMBERSHIP_CLUB_LINK_TABLE)
			.select('club_membership_id', 'sports_club_id')
			.whereIn('club_membership_id', membershipIds),
	]);

	const profileRefByMembershipId = new Map<string, number>();
	for (const item of profileLinks || []) {
		const membershipId = Number(item?.club_membership_id || 0);
		const profileId = Number(item?.sports_profile_id || 0);
		if (membershipId > 0 && profileId > 0) {
			profileRefByMembershipId.set(String(membershipId), profileId);
		}
	}

	const clubRefByMembershipId = new Map<string, number>();
	for (const item of clubLinks || []) {
		const membershipId = Number(item?.club_membership_id || 0);
		const clubId = Number(item?.sports_club_id || 0);
		if (membershipId > 0 && clubId > 0) {
			clubRefByMembershipId.set(String(membershipId), clubId);
		}
	}

	const profileIds = Array.from(new Set(Array.from(profileRefByMembershipId.values())));
	const clubIds = Array.from(new Set(Array.from(clubRefByMembershipId.values())));

	const [profiles, clubs] = await Promise.all([
		Promise.all(profileIds.map((ref) => findSportsProfileInTenant(ref, tenantId).catch(() => null))),
		Promise.all(clubIds.map((ref) => findSportsClubInTenant(ref, tenantId).catch(() => null))),
	]);

	const profilesById = new Map<string, any>();
	for (const profile of profiles || []) {
		if (profile?.id) profilesById.set(String(profile.id), profile);
		if (profile?.documentId) profilesById.set(String(profile.documentId), profile);
	}
	const clubsById = new Map<string, any>();
	for (const club of clubs || []) {
		if (club?.id) clubsById.set(String(club.id), club);
		if (club?.documentId) clubsById.set(String(club.documentId), club);
	}

	return items.map((row) => {
		const base = mapMembershipRowBase(row);
		const sportsProfileId = profileRefByMembershipId.get(String(base.id));
		const sportsProfile = sportsProfileId
			? profilesById.get(String(sportsProfileId)) || null
			: null;
		const clubId = clubRefByMembershipId.get(String(base.id));
		const club = clubId
			? clubsById.get(String(clubId)) || null
			: null;

		return {
			id: base.id,
			documentId: base.documentId,
			memberCode: base.memberCode,
			oldMemberCode: base.oldMemberCode,
			status: base.status,
			role: base.role,
			positionTitle: base.positionTitle,
			joinedAt: base.joinedAt,
			leftAt: base.leftAt,
			source: base.source,
			sourceReference: base.sourceReference,
			joinMessage: options.includeLongText ? base.joinMessage : normalizeOptionalText(base.joinMessage, 240),
			note: options.includeLongText ? base.note : normalizeOptionalText(base.note, 240),
			approvedAt: base.approvedAt,
			approvedBy: base.approvedBy,
			sportsProfile: mapSportsProfile(sportsProfile),
			club: mapClub(club),
			createdAt: base.createdAt,
			updatedAt: base.updatedAt,
		};
	});
}

async function findMembershipByProfileAndClub(tenantId: number | string, sportsProfileId: number | string, clubId: number | string, transacting?: any) {
	return await strapi.db.query(CLUB_MEMBERSHIP_UID).findOne({
		where: mergeTenantWhere({
			sportsProfile: { id: { $eq: sportsProfileId } },
			club: { id: { $eq: clubId } },
		}, tenantId),
		select: ['id'],
		...(transacting ? { transacting } : {}),
	} as any);
}

async function findMembershipByClubAndMemberCode(clubId: number | string, memberCode: string, transacting?: any) {
	if (!memberCode) return null;
	return await strapi.db.query(CLUB_MEMBERSHIP_UID).findOne({
		where: {
			club: { id: { $eq: clubId } },
			memberCode: { $eq: memberCode },
		},
		select: ['id'],
		...(transacting ? { transacting } : {}),
	} as any);
}

function isPostgresClient() {
	const client = String(strapi.db?.connection?.client?.config?.client || '').toLowerCase();
	return client.includes('pg');
}

async function acquireMembershipUniqueLock(trx: any, tenantId: number | string, sportsProfileId: number | string, clubId: number | string) {
	if (!isPostgresClient()) return;
	await trx.raw('select pg_advisory_xact_lock(hashtext(?), hashtext(?))', [String(tenantId), `club-membership:${String(sportsProfileId)}:${String(clubId)}`]);
}

async function acquireMemberCodeLock(trx: any, clubId: number | string, memberCode: string | null) {
	if (!isPostgresClient() || !memberCode) return;
	await trx.raw('select pg_advisory_xact_lock(hashtext(?), hashtext(?))', [String(clubId), `club-member-code:${String(memberCode).toUpperCase()}`]);
}

function parseErrorMessage(error: any) {
	return toText(error?.message || error?.details?.message || error?.response?.data?.error?.message);
}

function prepareWriteData(input: GenericRecord, existing?: any) {
	const sportsProfileRef = hasOwn(input, 'sportsProfile') ? normalizeRequiredRelationRef(input.sportsProfile, 'sportsProfile') : extractRelationRef(existing?.sportsProfile);
	const clubRef = hasOwn(input, 'club') ? normalizeRequiredRelationRef(input.club, 'club') : extractRelationRef(existing?.club);
	const status = hasOwn(input, 'status') ? normalizeStatus(input.status) : normalizeStatus(existing?.status);
	const role = hasOwn(input, 'role') ? normalizeRole(input.role) : normalizeRole(existing?.role);
	const memberCode = hasOwn(input, 'memberCode') ? normalizeOptionalText(input.memberCode, 100)?.toUpperCase() || null : normalizeOptionalText(existing?.memberCode, 100)?.toUpperCase() || null;
	const oldMemberCode = hasOwn(input, 'oldMemberCode') ? normalizeOptionalText(input.oldMemberCode, 100)?.toUpperCase() || null : normalizeOptionalText(existing?.oldMemberCode, 100)?.toUpperCase() || null;
	const positionTitle = hasOwn(input, 'positionTitle') ? normalizeOptionalText(input.positionTitle, 150) : normalizeOptionalText(existing?.positionTitle, 150);
	const previousStatus = normalizeStatus(existing?.status);
	const previousJoinedAt = normalizeDate(existing?.joinedAt, 'joinedAt');
	let joinedAt = hasOwn(input, 'joinedAt') ? normalizeDate(input.joinedAt, 'joinedAt') : previousJoinedAt;
	let leftAt = hasOwn(input, 'leftAt') ? normalizeDate(input.leftAt, 'leftAt') : normalizeDate(existing?.leftAt, 'leftAt');
	const source = hasOwn(input, 'source') ? normalizeSource(input.source) : normalizeSource(existing?.source);
	const sourceReference = hasOwn(input, 'sourceReference') ? normalizeOptionalText(input.sourceReference, 255) : normalizeOptionalText(existing?.sourceReference, 255);
	const joinMessage = hasOwn(input, 'joinMessage') ? normalizeOptionalText(input.joinMessage) : normalizeOptionalText(existing?.joinMessage);
	const note = hasOwn(input, 'note') ? normalizeOptionalText(input.note) : normalizeOptionalText(existing?.note);

	if (!joinedAt && status === 'active') {
		joinedAt = new Date().toISOString().slice(0, 10);
	}
	if (status === 'left' && !leftAt) {
		leftAt = new Date().toISOString().slice(0, 10);
	}
	if (previousStatus === 'left' && status === 'active') {
		leftAt = null;
		joinedAt = previousJoinedAt || joinedAt;
	}

	return {
		sportsProfileRef,
		clubRef,
		memberCode,
		oldMemberCode,
		status,
		role,
		positionTitle,
		joinedAt,
		leftAt,
		source,
		sourceReference,
		joinMessage,
		note,
		previousStatus,
	};
}

function buildApprovalFields(status: string, authUser: AuthUser, existing?: any) {
	const currentApprovedAt = existing?.approvedAt || null;
	const currentApprovedBy = extractRelationRef(existing?.approvedBy) || existing?.approvedBy?.id || null;
	if (status === 'active') {
		return {
			approvedAt: currentApprovedAt || new Date().toISOString(),
			approvedBy: currentApprovedBy || authUser?.id || null,
		};
	}
	if (status === 'pending' || status === 'rejected') {
		return {
			approvedAt: status === 'rejected' ? null : currentApprovedAt,
			approvedBy: status === 'rejected' ? null : currentApprovedBy,
		};
	}
	return {
		approvedAt: currentApprovedAt,
		approvedBy: currentApprovedBy,
	};
}

export function handleClubMembershipError(ctx: any, error: any) {
	if (error instanceof ClubMembershipError) {
		ctx.status = error.status;
		ctx.body = {
			error: {
				status: error.status,
				name: 'ClubMembershipError',
				message: error.message,
				code: error.code || undefined,
				details: error.details || undefined,
			},
		};
		return;
	}

	const message = parseErrorMessage(error);
	if (/tenant \+ sportsProfile \+ club must be unique/i.test(message)) {
		return handleClubMembershipError(ctx, new ClubMembershipError(409, 'Membership already exists for this sports profile in this club.', 'CLUB_MEMBERSHIP_ALREADY_EXISTS', { field: 'sportsProfile' }));
	}
	if (/club \+ memberCode must be unique/i.test(message)) {
		return handleClubMembershipError(ctx, new ClubMembershipError(409, 'memberCode already exists in this club.', 'CLUB_MEMBER_CODE_ALREADY_EXISTS', { field: 'memberCode' }));
	}
	if (message) {
		ctx.badRequest(message);
		return;
	}

	strapi.log.error('[club-membership] unexpected error', error);
	ctx.internalServerError('Failed to process club membership request');
}

export async function listTenantClubMemberships(query: Record<string, unknown>, tenantId: number | string) {
	const page = toPositiveInt(query.page, 1);
	const pageSize = toPositiveInt(query.pageSize, 10);
	const start = (page - 1) * pageSize;
	const where = mergeTenantWhere(buildListWhere(query), tenantId);
	const orderBy = resolveOrderBy(query);

	const [rows, total] = await Promise.all([
		strapi.db.query(CLUB_MEMBERSHIP_UID).findMany({
			where,
			orderBy,
			offset: start,
			limit: pageSize,
			populate: {
				approvedBy: { select: ['id', 'documentId', 'username', 'email', 'fullName'] },
			},
		} as any),
		strapi.db.query(CLUB_MEMBERSHIP_UID).count({ where } as any),
	]);
	const hydratedRows = await hydrateMembershipRelations(rows || [], tenantId);

	return {
		rows: hydratedRows,
		pagination: {
			page,
			pageSize,
			pageCount: Math.max(1, Math.ceil(total / pageSize)),
			total,
		},
	};
}

export async function getTenantClubMembership(membershipRef: unknown, tenantId: number | string) {
	const row = await findMembershipInTenant(membershipRef, tenantId);
	const hydrated = await hydrateMembershipRelations([row], tenantId, { includeLongText: true });
	return hydrated[0] || null;
}

export async function createTenantClubMembership(input: GenericRecord, tenantId: number | string, authUser: AuthUser = null) {
	ensureNoUnknownWriteFields(input || {});
	const prepared = prepareWriteData(input || {});

	try {
		const createdId = await strapi.db.connection.transaction(async (trx: any) => {
			const sportsProfile = await findSportsProfileInTenant(prepared.sportsProfileRef, tenantId, trx);
			const club = await findSportsClubInTenant(prepared.clubRef, tenantId, trx);
			await acquireMembershipUniqueLock(trx, tenantId, sportsProfile.id, club.id);
			await acquireMemberCodeLock(trx, club.id, prepared.memberCode);

			const duplicate = await findMembershipByProfileAndClub(tenantId, sportsProfile.id, club.id, trx);
			if (duplicate?.id) {
				httpError(409, 'Membership already exists for this sports profile in this club.', 'CLUB_MEMBERSHIP_ALREADY_EXISTS', { field: 'sportsProfile' });
			}
			const duplicateMemberCode = await findMembershipByClubAndMemberCode(club.id, prepared.memberCode || '', trx);
			if (prepared.memberCode && duplicateMemberCode?.id) {
				httpError(409, 'memberCode already exists in this club.', 'CLUB_MEMBER_CODE_ALREADY_EXISTS', { field: 'memberCode' });
			}

			const approval = buildApprovalFields(prepared.status, authUser, null);
			const created = await strapi.db.query(CLUB_MEMBERSHIP_UID).create({
				data: {
					tenant: tenantId,
					sportsProfile: sportsProfile.id,
					club: club.id,
					memberCode: prepared.memberCode,
					oldMemberCode: prepared.oldMemberCode,
					status: prepared.status,
					role: prepared.role,
					positionTitle: prepared.positionTitle,
					joinedAt: prepared.joinedAt,
					leftAt: prepared.leftAt,
					source: prepared.source,
					sourceReference: prepared.sourceReference,
					joinMessage: prepared.joinMessage,
					note: prepared.note,
					approvedAt: approval.approvedAt,
					approvedBy: approval.approvedBy,
				},
				transacting: trx,
			} as any);

			const createdSnapshot = await strapi.db.query(CLUB_MEMBERSHIP_UID).findOne({
				where: { id: Number(created.id) },
				select: ['id', 'documentId', 'status', 'role', 'positionTitle', 'memberCode', 'joinedAt', 'leftAt', 'source', 'approvedAt', 'createdAt', 'updatedAt'],
				populate: { approvedBy: { select: ['id', 'documentId', 'username', 'email', 'fullName'] } },
				transacting: trx,
			} as any);

			await createMembershipHistoryEntries({
				tenantId,
				membershipId: Number(created.id),
				events: buildMembershipCreateHistoryEvents(createdSnapshot, { performedBy: authUser?.id || null }),
				transacting: trx,
			});

			return Number(created.id);
		});

		return await getTenantClubMembership(createdId, tenantId);
	} catch (error) {
		const message = parseErrorMessage(error);
		if (/tenant \+ sportsProfile \+ club must be unique/i.test(message)) {
			httpError(409, 'Membership already exists for this sports profile in this club.', 'CLUB_MEMBERSHIP_ALREADY_EXISTS', { field: 'sportsProfile' });
		}
		if (/club \+ memberCode must be unique/i.test(message)) {
			httpError(409, 'memberCode already exists in this club.', 'CLUB_MEMBER_CODE_ALREADY_EXISTS', { field: 'memberCode' });
		}
		throw error;
	}
}

export async function updateTenantClubMembership(membershipRef: unknown, input: GenericRecord, tenantId: number | string, authUser: AuthUser = null) {
	ensureNoUnknownWriteFields(input || {});
	const existing = await findMembershipInTenant(membershipRef, tenantId);
	const prepared = prepareWriteData(input || {}, existing);

	try {
		await strapi.db.connection.transaction(async (trx: any) => {
			const sportsProfile = await findSportsProfileInTenant(prepared.sportsProfileRef, tenantId, trx);
			const club = await findSportsClubInTenant(prepared.clubRef, tenantId, trx);
			await acquireMembershipUniqueLock(trx, tenantId, sportsProfile.id, club.id);
			await acquireMemberCodeLock(trx, club.id, prepared.memberCode);

			const duplicate = await findMembershipByProfileAndClub(tenantId, sportsProfile.id, club.id, trx);
			if (duplicate?.id && Number(duplicate.id) !== Number(existing.id)) {
				httpError(409, 'Membership already exists for this sports profile in this club.', 'CLUB_MEMBERSHIP_ALREADY_EXISTS', { field: 'sportsProfile' });
			}
			const duplicateMemberCode = await findMembershipByClubAndMemberCode(club.id, prepared.memberCode || '', trx);
			if (prepared.memberCode && duplicateMemberCode?.id && Number(duplicateMemberCode.id) !== Number(existing.id)) {
				httpError(409, 'memberCode already exists in this club.', 'CLUB_MEMBER_CODE_ALREADY_EXISTS', { field: 'memberCode' });
			}

			const approval = buildApprovalFields(prepared.status, authUser, existing);
			await strapi.db.query(CLUB_MEMBERSHIP_UID).update({
				where: { id: existing.id },
				data: {
					tenant: tenantId,
					sportsProfile: sportsProfile.id,
					club: club.id,
					memberCode: prepared.memberCode,
					oldMemberCode: prepared.oldMemberCode,
					status: prepared.status,
					role: prepared.role,
					positionTitle: prepared.positionTitle,
					joinedAt: prepared.joinedAt,
					leftAt: prepared.leftAt,
					source: prepared.source,
					sourceReference: prepared.sourceReference,
					joinMessage: prepared.joinMessage,
					note: prepared.note,
					approvedAt: approval.approvedAt,
					approvedBy: approval.approvedBy,
				},
				transacting: trx,
			} as any);

			const updatedSnapshot = await strapi.db.query(CLUB_MEMBERSHIP_UID).findOne({
				where: { id: Number(existing.id) },
				select: ['id', 'documentId', 'status', 'role', 'positionTitle', 'memberCode', 'joinedAt', 'leftAt', 'source', 'approvedAt', 'createdAt', 'updatedAt'],
				populate: { approvedBy: { select: ['id', 'documentId', 'username', 'email', 'fullName'] } },
				transacting: trx,
			} as any);

			await createMembershipHistoryEntries({
				tenantId,
				membershipId: Number(existing.id),
				events: buildMembershipUpdateHistoryEvents(existing as any, updatedSnapshot as any, { performedBy: authUser?.id || null }),
				transacting: trx,
			});
		});

		return await getTenantClubMembership(existing.id, tenantId);
	} catch (error) {
		const message = parseErrorMessage(error);
		if (/tenant \+ sportsProfile \+ club must be unique/i.test(message)) {
			httpError(409, 'Membership already exists for this sports profile in this club.', 'CLUB_MEMBERSHIP_ALREADY_EXISTS', { field: 'sportsProfile' });
		}
		if (/club \+ memberCode must be unique/i.test(message)) {
			httpError(409, 'memberCode already exists in this club.', 'CLUB_MEMBER_CODE_ALREADY_EXISTS', { field: 'memberCode' });
		}
		throw error;
	}
}

export async function activateTenantClubMembership(membershipRef: unknown, tenantId: number | string, authUser: AuthUser = null) {
	const existing = await findMembershipInTenant(membershipRef, tenantId);
	return await updateTenantClubMembership(existing.id, { status: 'active' }, tenantId, authUser);
}

export async function deactivateTenantClubMembership(membershipRef: unknown, tenantId: number | string, authUser: AuthUser = null) {
	const existing = await findMembershipInTenant(membershipRef, tenantId);
	return await updateTenantClubMembership(existing.id, { status: 'inactive' }, tenantId, authUser);
}

export async function leaveTenantClubMembership(membershipRef: unknown, tenantId: number | string, authUser: AuthUser = null) {
	const existing = await findMembershipInTenant(membershipRef, tenantId);
	return await updateTenantClubMembership(existing.id, { status: 'left' }, tenantId, authUser);
}

export async function suspendTenantClubMembership(membershipRef: unknown, tenantId: number | string, authUser: AuthUser = null) {
	const existing = await findMembershipInTenant(membershipRef, tenantId);
	return await updateTenantClubMembership(existing.id, { status: 'suspended' }, tenantId, authUser);
}

export default {
	listTenantClubMemberships,
	getTenantClubMembership,
	createTenantClubMembership,
	updateTenantClubMembership,
	activateTenantClubMembership,
	deactivateTenantClubMembership,
	leaveTenantClubMembership,
	suspendTenantClubMembership,
	handleClubMembershipError,
};