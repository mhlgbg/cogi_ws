import { listTenantUsers } from '../../admin/services/manage-tenant-users';
import { extractRelationRef, hasOwn, mergeTenantWhere, normalizeSortInput, toPositiveInt, toText, whereByParam } from '../../../utils/tenant-scope';

const ASSIGNMENT_UID = 'api::sports-club-user-assignment.sports-club-user-assignment' as any;
const SPORTS_CLUB_UID = 'api::sports-club.sports-club' as any;
const USER_TENANT_UID = 'api::user-tenant.user-tenant' as any;

type HttpErrorDetails = Record<string, unknown> | Array<Record<string, unknown>> | null;
type GenericRecord = Record<string, unknown>;
type AuthUser = { id: number } | null;

export class SportsClubUserAssignmentError extends Error {
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
	throw new SportsClubUserAssignmentError(status, message, code, details);
}

function ensureNoUnknownFields(payload: GenericRecord, allowedFields: string[]) {
	const allowed = new Set(allowedFields);
	const unknown = Object.keys(payload || {}).filter((key) => !allowed.has(key));
	if (unknown.length > 0) {
		httpError(400, 'payload contains unknown fields', 'UNKNOWN_FIELDS', { fields: unknown });
	}
}

function ensureNoUnknownWriteFields(payload: GenericRecord) {
	ensureNoUnknownFields(payload, ['club', 'user', 'status', 'assignedAt', 'note']);
	if (Object.prototype.hasOwnProperty.call(payload, 'tenant')) {
		httpError(400, 'tenant is managed by tenant context', 'TENANT_CONTEXT_ONLY');
	}
	if (Object.prototype.hasOwnProperty.call(payload, 'assignedBy')) {
		httpError(400, 'assignedBy is server-managed', 'SERVER_MANAGED_FIELDS');
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

function normalizeStatus(value: unknown): 'active' | 'inactive' {
	const text = toText(value).toLowerCase();
	if (text === 'inactive') return 'inactive';
	return 'active';
}

function normalizeDateTime(value: unknown, fieldName: string): string | null {
	const text = toText(value);
	if (!text) return null;
	const date = new Date(text);
	if (Number.isNaN(date.getTime())) {
		httpError(400, `${fieldName} is invalid`, 'INVALID_DATETIME', { field: fieldName });
	}
	return date.toISOString();
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

function mapClub(club: any) {
	if (!club?.id) return null;
	return {
		id: Number(club.id),
		documentId: toText(club.documentId) || null,
		code: toText(club.code) || null,
		name: toText(club.name) || null,
		shortName: toText(club.shortName) || null,
		status: toText(club.status) || null,
		logo: mapMedia(club.logo),
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
	};
}

function mapAssignmentRow(row: any) {
	return {
		id: Number(row?.id || 0),
		documentId: row?.documentId || null,
		status: toText(row?.status).toLowerCase() || 'active',
		assignedAt: row?.assignedAt || null,
		note: normalizeOptionalText(row?.note),
		club: mapClub(row?.club),
		user: mapUser(row?.user),
		assignedBy: mapUser(row?.assignedBy),
		createdAt: row?.createdAt || null,
		updatedAt: row?.updatedAt || null,
	};
}

function buildListWhere(query: Record<string, unknown>) {
	const clauses: Array<Record<string, unknown>> = [];
	const keyword = toText(query.search ?? query.q);
	const club = extractRelationRef(query.club);
	const user = extractRelationRef(query.user);
	const status = toText(query.status).toLowerCase();
	const activeOnly = toText(query.activeOnly).toLowerCase();

	if (keyword) {
		clauses.push({
			$or: [
				{ note: { $containsi: keyword } },
				{ club: { code: { $containsi: keyword } } },
				{ club: { name: { $containsi: keyword } } },
				{ club: { shortName: { $containsi: keyword } } },
				{ user: { username: { $containsi: keyword } } },
				{ user: { email: { $containsi: keyword } } },
				{ user: { fullName: { $containsi: keyword } } },
			],
		});
	}

	if (club) {
		const clubWhere = whereByParam(club);
		if (clubWhere?.id) clauses.push({ club: { id: { $eq: clubWhere.id } } });
		if (clubWhere?.documentId) clauses.push({ club: { documentId: { $eq: clubWhere.documentId } } });
	}
	if (user) {
		const userId = Number(user);
		if (Number.isInteger(userId) && userId > 0) clauses.push({ user: { id: { $eq: userId } } });
	}
	if (status === 'active' || status === 'inactive') clauses.push({ status: { $eq: status } });
	if (activeOnly === 'true') clauses.push({ status: { $eq: 'active' } });

	if (clauses.length === 0) return {};
	if (clauses.length === 1) return clauses[0];
	return { $and: clauses };
}

function resolveOrderBy(query: Record<string, unknown>) {
	const normalizedSort = normalizeSortInput(query?.sort);
	if (normalizedSort.length > 0) {
		const allowed = new Set(['status', 'assignedAt', 'updatedAt', 'createdAt']);
		const safe = normalizedSort
			.map((entry) => {
				const key = Object.keys(entry)[0];
				if (!allowed.has(key)) return null;
				return { [key]: entry[key] } as Record<string, 'asc' | 'desc'>;
			})
			.filter(Boolean) as Array<Record<string, 'asc' | 'desc'>>;
		if (safe.length > 0) return safe;
	}
	return [{ status: 'asc' }, { assignedAt: 'desc' }, { id: 'desc' }];
}

async function findClubInTenant(clubRef: unknown, tenantId: number | string, transacting?: any) {
	const where = whereByParam(clubRef);
	if (!where) {
		httpError(404, 'Sports club not found', 'SPORTS_CLUB_NOT_FOUND');
	}
	const club = await strapi.db.query(SPORTS_CLUB_UID).findOne({
		where: mergeTenantWhere(where, tenantId),
		populate: { logo: { select: ['id', 'name', 'url', 'mime'] } },
		...(transacting ? { transacting } : {}),
	} as any);
	if (!club?.id) {
		httpError(400, 'club must belong to current tenant', 'SPORTS_CLUB_OUTSIDE_TENANT', { field: 'club' });
	}
	return club;
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
				select: ['id', 'documentId', 'username', 'email', 'fullName', 'phone'],
			},
		},
	});
	if (!membership?.user?.id) {
		httpError(400, 'user must be an active user in current tenant', 'USER_NOT_IN_TENANT', { field: 'user' });
	}
	return membership.user;
}

async function findAssignmentInTenant(assignmentRef: unknown, tenantId: number | string, transacting?: any) {
	const where = whereByParam(assignmentRef);
	if (!where) {
		httpError(404, 'Club user assignment not found', 'CLUB_USER_ASSIGNMENT_NOT_FOUND');
	}
	const row = await strapi.db.query(ASSIGNMENT_UID).findOne({
		where: mergeTenantWhere(where, tenantId),
		populate: {
			club: { select: ['id', 'documentId', 'code', 'name', 'shortName', 'status'], populate: { logo: { select: ['id', 'name', 'url', 'mime'] } } },
			user: { select: ['id', 'documentId', 'username', 'email', 'fullName', 'phone'] },
			assignedBy: { select: ['id', 'documentId', 'username', 'email', 'fullName', 'phone'] },
		},
		...(transacting ? { transacting } : {}),
	} as any);
	if (!row?.id) {
		httpError(404, 'Club user assignment not found', 'CLUB_USER_ASSIGNMENT_NOT_FOUND');
	}
	return row;
}

async function findAssignmentByClubAndUser(tenantId: number | string, clubId: number | string, userId: number | string, transacting?: any) {
	return await strapi.db.query(ASSIGNMENT_UID).findOne({
		where: mergeTenantWhere({
			club: { id: { $eq: clubId } },
			user: { id: { $eq: userId } },
		}, tenantId),
		select: ['id', 'status', 'assignedAt', 'documentId'],
		...(transacting ? { transacting } : {}),
	} as any);
}

function isPostgresClient() {
	const client = String(strapi.db?.connection?.client?.config?.client || '').toLowerCase();
	return client.includes('pg');
}

async function acquireAssignmentLock(trx: any, tenantId: number | string, clubId: number | string, userId: number | string) {
	if (!isPostgresClient()) return;
	await trx.raw('select pg_advisory_xact_lock(hashtext(?), hashtext(?))', [String(tenantId), `sports-club-user-assignment:${String(clubId)}:${String(userId)}`]);
}

function prepareWriteData(input: GenericRecord, existing?: any) {
	const status = hasOwn(input, 'status') ? normalizeStatus(input.status) : normalizeStatus(existing?.status);
	const assignedAt = hasOwn(input, 'assignedAt') ? normalizeDateTime(input.assignedAt, 'assignedAt') : (existing?.assignedAt || null);
	return {
		clubRef: hasOwn(input, 'club') ? extractRelationRef(input.club) : extractRelationRef(existing?.club),
		userRef: hasOwn(input, 'user') ? extractRelationRef(input.user) : extractRelationRef(existing?.user),
		status,
		assignedAt,
		note: hasOwn(input, 'note') ? normalizeOptionalText(input.note) : normalizeOptionalText(existing?.note),
	};
}

function parseErrorMessage(error: any) {
	return toText(error?.message || error?.details?.message || error?.response?.data?.error?.message);
}

export function handleSportsClubUserAssignmentError(ctx: any, error: any) {
	if (error instanceof SportsClubUserAssignmentError) {
		ctx.status = error.status;
		ctx.body = {
			error: {
				status: error.status,
				name: 'SportsClubUserAssignmentError',
				message: error.message,
				code: error.code || undefined,
				details: error.details || undefined,
			},
		};
		return;
	}
	const message = parseErrorMessage(error);
	if (message) {
		ctx.badRequest(message);
		return;
	}
	strapi.log.error('[sports-club-user-assignment] unexpected error', error);
	ctx.internalServerError('Failed to process sports club user assignment request');
}

export async function listTenantSportsClubUserAssignments(query: Record<string, unknown>, tenantId: number | string) {
	const page = toPositiveInt(query.page, 1);
	const pageSize = toPositiveInt(query.pageSize, 10);
	const start = (page - 1) * pageSize;
	const where = mergeTenantWhere(buildListWhere(query), tenantId);
	const orderBy = resolveOrderBy(query);
	const [rows, total] = await Promise.all([
		strapi.db.query(ASSIGNMENT_UID).findMany({
			where,
			orderBy,
			offset: start,
			limit: pageSize,
			populate: {
				club: { select: ['id', 'documentId', 'code', 'name', 'shortName', 'status'], populate: { logo: { select: ['id', 'name', 'url', 'mime'] } } },
				user: { select: ['id', 'documentId', 'username', 'email', 'fullName', 'phone'] },
				assignedBy: { select: ['id', 'documentId', 'username', 'email', 'fullName', 'phone'] },
			},
		} as any),
		strapi.db.query(ASSIGNMENT_UID).count({ where } as any),
	]);
	return {
		rows: (rows || []).map((row: any) => mapAssignmentRow(row)),
		pagination: {
			page,
			pageSize,
			pageCount: Math.max(1, Math.ceil(total / pageSize)),
			total,
		},
	};
}

export async function getTenantSportsClubUserAssignment(assignmentRef: unknown, tenantId: number | string) {
	const row = await findAssignmentInTenant(assignmentRef, tenantId);
	return mapAssignmentRow(row);
}

export async function createTenantSportsClubUserAssignment(input: GenericRecord, tenantId: number | string, authUser: AuthUser = null) {
	ensureNoUnknownWriteFields(input || {});
	const prepared = prepareWriteData(input || {});
	const clubRef = prepared.clubRef;
	const userRef = prepared.userRef;
	if (!clubRef) httpError(400, 'club is required', 'INVALID_REQUEST_BODY', { field: 'club' });
	if (!userRef) httpError(400, 'user is required', 'INVALID_REQUEST_BODY', { field: 'user' });

	const assignmentId = await strapi.db.connection.transaction(async (trx: any) => {
		const club = await findClubInTenant(clubRef, tenantId, trx);
		const user = await ensureUserInTenant(userRef, tenantId);
		await acquireAssignmentLock(trx, tenantId, Number(club.id), Number(user.id));
		const existing = await findAssignmentByClubAndUser(tenantId, Number(club.id), Number(user.id), trx);
		const assignedAt = prepared.assignedAt || new Date().toISOString();

		if (existing?.id) {
			if (toText(existing.status).toLowerCase() === 'active') {
				httpError(409, 'User này đã được phân công quản lý Club.', 'CLUB_USER_ASSIGNMENT_ALREADY_ACTIVE');
			}
			await strapi.db.query(ASSIGNMENT_UID).update({
				where: { id: Number(existing.id) },
				data: {
					status: 'active',
					assignedAt,
					assignedBy: authUser?.id || null,
					note: prepared.note,
				},
				transacting: trx,
			} as any);
			return Number(existing.id);
		}

		const created = await strapi.db.query(ASSIGNMENT_UID).create({
			data: {
				tenant: tenantId,
				club: Number(club.id),
				user: Number(user.id),
				status: 'active',
				assignedAt,
				assignedBy: authUser?.id || null,
				note: prepared.note,
			},
			transacting: trx,
		} as any);
		return Number(created.id);
	});

	return await getTenantSportsClubUserAssignment(assignmentId, tenantId);
}

export async function updateTenantSportsClubUserAssignment(assignmentRef: unknown, input: GenericRecord, tenantId: number | string, authUser: AuthUser = null) {
	ensureNoUnknownWriteFields(input || {});
	const existing = await findAssignmentInTenant(assignmentRef, tenantId);
	const prepared = prepareWriteData(input || {}, existing);
	const clubRef = prepared.clubRef;
	const userRef = prepared.userRef;
	if (!clubRef) httpError(400, 'club is required', 'INVALID_REQUEST_BODY', { field: 'club' });
	if (!userRef) httpError(400, 'user is required', 'INVALID_REQUEST_BODY', { field: 'user' });

	await strapi.db.connection.transaction(async (trx: any) => {
		const club = await findClubInTenant(clubRef, tenantId, trx);
		const user = await ensureUserInTenant(userRef, tenantId);
		await acquireAssignmentLock(trx, tenantId, Number(club.id), Number(user.id));
		const duplicate = await findAssignmentByClubAndUser(tenantId, Number(club.id), Number(user.id), trx);
		if (duplicate?.id && Number(duplicate.id) !== Number(existing.id)) {
			httpError(409, 'User này đã có assignment với Club này.', 'CLUB_USER_ASSIGNMENT_DUPLICATE');
		}
		await strapi.db.query(ASSIGNMENT_UID).update({
			where: { id: Number(existing.id) },
			data: {
				tenant: tenantId,
				club: Number(club.id),
				user: Number(user.id),
				status: prepared.status,
				assignedAt: prepared.assignedAt || existing.assignedAt || new Date().toISOString(),
				assignedBy: authUser?.id || existing.assignedBy?.id || null,
				note: prepared.note,
			},
			transacting: trx,
		} as any);
	});

	return await getTenantSportsClubUserAssignment(existing.id, tenantId);
}

export async function activateTenantSportsClubUserAssignment(assignmentRef: unknown, tenantId: number | string, authUser: AuthUser = null) {
	const existing = await findAssignmentInTenant(assignmentRef, tenantId);
	if (toText(existing.status).toLowerCase() === 'active') return mapAssignmentRow(existing);
	await strapi.db.query(ASSIGNMENT_UID).update({
		where: { id: Number(existing.id) },
		data: {
			status: 'active',
			assignedAt: new Date().toISOString(),
			assignedBy: authUser?.id || null,
		},
	} as any);
	return await getTenantSportsClubUserAssignment(existing.id, tenantId);
}

export async function deactivateTenantSportsClubUserAssignment(assignmentRef: unknown, tenantId: number | string) {
	const existing = await findAssignmentInTenant(assignmentRef, tenantId);
	if (toText(existing.status).toLowerCase() === 'inactive') return mapAssignmentRow(existing);
	await strapi.db.query(ASSIGNMENT_UID).update({
		where: { id: Number(existing.id) },
		data: { status: 'inactive' },
	} as any);
	return await getTenantSportsClubUserAssignment(existing.id, tenantId);
}

export async function listAssignableTenantUsers(query: Record<string, unknown>, tenantId: number | string) {
	const page = toPositiveInt(query.page, 1);
	const pageSize = Math.min(100, toPositiveInt(query.pageSize, 10));
	const result = await listTenantUsers({
		tenantId: Number(tenantId),
		page,
		pageSize,
		search: toText(query.search ?? query.q),
	});
	return {
		rows: (Array.isArray(result?.data) ? result.data : []).map((item: any) => ({
			userTenantId: Number(item?.userTenantId || 0) || null,
			user: mapUser(item?.user),
			userTenantStatus: toText(item?.userTenantStatus) || null,
			joinedAt: item?.joinedAt || null,
			label: toText(item?.label) || null,
			activeRoleIds: Array.isArray(item?.activeRoleIds) ? item.activeRoleIds : [],
		})),
		pagination: result?.meta || { page, pageSize, total: 0, pageCount: 1 },
	};
}

export async function isUserAssignedToClub(userId: number, clubId: number, tenantId: number | string) {
	if (!Number.isInteger(Number(userId)) || Number(userId) <= 0) return false;
	if (!Number.isInteger(Number(clubId)) || Number(clubId) <= 0) return false;
	const row = await strapi.db.query(ASSIGNMENT_UID).findOne({
		where: mergeTenantWhere({
			user: { id: { $eq: Number(userId) } },
			club: { id: { $eq: Number(clubId) } },
			status: { $eq: 'active' },
		}, tenantId),
		select: ['id'],
	} as any);
	return Boolean(row?.id);
}

export async function getAssignedClubIds(userId: number, tenantId: number | string) {
	if (!Number.isInteger(Number(userId)) || Number(userId) <= 0) return [];
	const rows = await strapi.db.query(ASSIGNMENT_UID).findMany({
		where: mergeTenantWhere({
			user: { id: { $eq: Number(userId) } },
			status: { $eq: 'active' },
		}, tenantId),
		populate: { club: { select: ['id'] } },
	} as any);
	return Array.from(new Set((rows || []).map((item: any) => Number(item?.club?.id || 0)).filter((value: number) => value > 0)));
}

export default {
	listTenantSportsClubUserAssignments,
	getTenantSportsClubUserAssignment,
	createTenantSportsClubUserAssignment,
	updateTenantSportsClubUserAssignment,
	activateTenantSportsClubUserAssignment,
	deactivateTenantSportsClubUserAssignment,
	listAssignableTenantUsers,
	isUserAssignedToClub,
	getAssignedClubIds,
	handleSportsClubUserAssignmentError,
};