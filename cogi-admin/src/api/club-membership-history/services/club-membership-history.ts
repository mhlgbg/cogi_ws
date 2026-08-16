import { mergeTenantWhere, normalizeSortInput, toPositiveInt, toText, whereByParam } from '../../../utils/tenant-scope';

const CLUB_MEMBERSHIP_HISTORY_UID = 'api::club-membership-history.club-membership-history' as any;
const CLUB_MEMBERSHIP_UID = 'api::club-membership.club-membership' as any;

type GenericRecord = Record<string, unknown>;
type HistorySource = 'system' | 'admin' | 'self_service' | 'import' | 'campaign' | 'invite' | 'other';
type StatusValue = 'pending' | 'active' | 'inactive' | 'left' | 'suspended' | 'rejected' | null;
type RoleValue = 'member' | 'manager' | 'admin' | 'owner' | null;
type HistoryEventType = 'joined' | 'approved' | 'rejected' | 'left' | 'rejoined' | 'activated' | 'deactivated' | 'suspended' | 'reactivated' | 'role_changed' | 'position_changed' | 'member_code_changed' | 'info_updated' | 'other';

type HistoryEventInput = {
	eventType: HistoryEventType;
	eventAt?: string | Date | null;
	fromStatus?: StatusValue;
	toStatus?: StatusValue;
	fromRole?: RoleValue;
	toRole?: RoleValue;
	fromPositionTitle?: string | null;
	toPositionTitle?: string | null;
	note?: string | null;
	metadata?: Record<string, unknown> | null;
	source?: HistorySource | null;
	performedBy?: number | null;
};

type HistoryRecord = {
	id: number;
	documentId?: string | null;
	eventType?: string | null;
	eventAt?: string | null;
	fromStatus?: string | null;
	toStatus?: string | null;
	fromRole?: string | null;
	toRole?: string | null;
	fromPositionTitle?: string | null;
	toPositionTitle?: string | null;
	note?: string | null;
	metadata?: Record<string, unknown> | null;
	source?: string | null;
	performedBy?: any;
	createdAt?: string | null;
	updatedAt?: string | null;
};

type MembershipSnapshot = {
	id: number;
	documentId?: string | null;
	status?: string | null;
	role?: string | null;
	positionTitle?: string | null;
	memberCode?: string | null;
	joinedAt?: string | null;
	leftAt?: string | null;
	source?: string | null;
	approvedAt?: string | null;
	approvedBy?: any;
	createdAt?: string | null;
	updatedAt?: string | null;
};

export class ClubMembershipHistoryError extends Error {
	status: number;
	code?: string | null;
	details?: Record<string, unknown> | null;

	constructor(status: number, message: string, code?: string | null, details?: Record<string, unknown> | null) {
		super(message);
		this.status = status;
		this.code = code || null;
		this.details = details || null;
	}
}

function httpError(status: number, message: string, code?: string, details?: Record<string, unknown> | null): never {
	throw new ClubMembershipHistoryError(status, message, code, details || null);
}

function normalizeStatus(value: unknown): StatusValue {
	const text = toText(value).toLowerCase();
	if (!text) return null;
	if (['pending', 'active', 'inactive', 'left', 'suspended', 'rejected'].includes(text)) {
		return text as StatusValue;
	}
	return null;
}

function normalizeRole(value: unknown): RoleValue {
	const text = toText(value).toLowerCase();
	if (!text) return null;
	if (['member', 'manager', 'admin', 'owner'].includes(text)) {
		return text as RoleValue;
	}
	return null;
}

function normalizeHistorySource(value: unknown): HistorySource {
	const text = toText(value).toLowerCase();
	if (text === 'system' || text === 'self_service' || text === 'import' || text === 'campaign' || text === 'invite' || text === 'other') {
		return text as HistorySource;
	}
	return 'admin';
}

function mapMembershipSourceToHistorySource(value: unknown): HistorySource {
	const text = toText(value).toLowerCase();
	if (text === 'self_registration') return 'self_service';
	if (text === 'campaign') return 'campaign';
	if (text === 'invite') return 'invite';
	if (text === 'manual_import') return 'import';
	if (text === 'admin_created') return 'admin';
	if (text === 'other') return 'other';
	return 'admin';
}

function normalizeEventAt(value: unknown): string {
	if (value instanceof Date) return value.toISOString();
	const text = toText(value);
	if (!text) return new Date().toISOString();
	const date = new Date(text);
	if (Number.isNaN(date.getTime())) return new Date().toISOString();
	return date.toISOString();
}

function normalizeOptionalText(value: unknown, maxLength?: number): string | null {
	const text = toText(value);
	if (!text) return null;
	if (maxLength && text.length > maxLength) return text.slice(0, maxLength);
	return text;
}

function normalizeMetadata(value: unknown): Record<string, unknown> | null {
	if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
	return value as Record<string, unknown>;
}

function mapPerformedBy(user: any) {
	if (!user?.id) return null;
	return {
		id: Number(user.id),
		documentId: toText(user.documentId) || null,
		username: toText(user.username) || null,
		email: toText(user.email) || null,
		fullName: toText(user.fullName) || null,
	};
}

function mapHistoryRow(row: any) {
	return {
		id: Number(row?.id || 0),
		documentId: row?.documentId || null,
		eventType: toText(row?.eventType).toLowerCase() || 'other',
		eventAt: row?.eventAt || null,
		fromStatus: normalizeStatus(row?.fromStatus),
		toStatus: normalizeStatus(row?.toStatus),
		fromRole: normalizeRole(row?.fromRole),
		toRole: normalizeRole(row?.toRole),
		fromPositionTitle: normalizeOptionalText(row?.fromPositionTitle, 150),
		toPositionTitle: normalizeOptionalText(row?.toPositionTitle, 150),
		note: normalizeOptionalText(row?.note),
		metadata: normalizeMetadata(row?.metadata),
		source: normalizeHistorySource(row?.source),
		performedBy: mapPerformedBy(row?.performedBy),
		createdAt: row?.createdAt || null,
		updatedAt: row?.updatedAt || null,
	};
}

function buildListWhere(query: Record<string, unknown>) {
	const clauses: Array<Record<string, unknown>> = [];
	const membership = toText(query.membership);
	const eventType = toText(query.eventType).toLowerCase();
	const source = toText(query.source).toLowerCase();
	const dateFrom = toText(query.dateFrom);
	const dateTo = toText(query.dateTo);

	if (membership) {
		const membershipWhere = whereByParam(membership);
		if (membershipWhere?.id) clauses.push({ membership: { id: { $eq: membershipWhere.id } } });
		if (membershipWhere?.documentId) clauses.push({ membership: { documentId: { $eq: membershipWhere.documentId } } });
	}
	if (eventType) clauses.push({ eventType: { $eq: eventType } });
	if (source) clauses.push({ source: { $eq: source } });
	if (dateFrom) clauses.push({ eventAt: { $gte: new Date(dateFrom).toISOString() } });
	if (dateTo) {
		const end = new Date(dateTo);
		if (!Number.isNaN(end.getTime())) {
			end.setHours(23, 59, 59, 999);
			clauses.push({ eventAt: { $lte: end.toISOString() } });
		}
	}

	if (clauses.length === 0) return {};
	if (clauses.length === 1) return clauses[0];
	return { $and: clauses };
}

function resolveOrderBy(query: Record<string, unknown>) {
	const normalizedSort = normalizeSortInput(query?.sort);
	if (normalizedSort.length > 0) {
		const allowed = new Set(['eventAt', 'eventType', 'source', 'createdAt']);
		const safe = normalizedSort
			.map((entry) => {
				const key = Object.keys(entry)[0];
				if (!allowed.has(key)) return null;
				return { [key]: entry[key] } as Record<string, 'asc' | 'desc'>;
			})
			.filter(Boolean) as Array<Record<string, 'asc' | 'desc'>>;
		if (safe.length > 0) return safe;
	}
	return [{ eventAt: 'desc' }, { id: 'desc' }];
}

async function findMembershipInTenant(membershipRef: unknown, tenantId: number | string, transacting?: any) {
	const where = whereByParam(membershipRef);
	if (!where) {
		httpError(404, 'Club membership not found', 'CLUB_MEMBERSHIP_NOT_FOUND');
	}
	const row = await strapi.db.query(CLUB_MEMBERSHIP_UID).findOne({
		where: mergeTenantWhere(where, tenantId),
		select: ['id', 'documentId', 'status', 'role', 'positionTitle', 'memberCode', 'joinedAt', 'leftAt', 'source', 'approvedAt', 'createdAt', 'updatedAt'],
		populate: {
			approvedBy: { select: ['id', 'documentId', 'username', 'email', 'fullName'] },
		},
		...(transacting ? { transacting } : {}),
	} as any);
	if (!row?.id) {
		httpError(404, 'Club membership not found', 'CLUB_MEMBERSHIP_NOT_FOUND');
	}
	return row;
}

export async function createMembershipHistoryEntries(options: {
	tenantId: number | string;
	membershipId: number | string;
	events: HistoryEventInput[];
	transacting?: any;
}) {
	const events = Array.isArray(options.events) ? options.events.filter(Boolean) : [];
	if (events.length === 0) return [];
	const rows = [];
	for (const item of events) {
		const created = await strapi.db.query(CLUB_MEMBERSHIP_HISTORY_UID).create({
			data: {
				tenant: options.tenantId,
				membership: options.membershipId,
				eventType: item.eventType,
				eventAt: normalizeEventAt(item.eventAt),
				fromStatus: normalizeStatus(item.fromStatus),
				toStatus: normalizeStatus(item.toStatus),
				fromRole: normalizeRole(item.fromRole),
				toRole: normalizeRole(item.toRole),
				fromPositionTitle: normalizeOptionalText(item.fromPositionTitle, 150),
				toPositionTitle: normalizeOptionalText(item.toPositionTitle, 150),
				note: normalizeOptionalText(item.note),
				metadata: normalizeMetadata(item.metadata),
				performedBy: item.performedBy || null,
				source: normalizeHistorySource(item.source),
			},
			...(options.transacting ? { transacting: options.transacting } : {}),
		} as any);
		rows.push(created);
	}
	await rebuildMembershipSnapshot(options.membershipId, options.tenantId, options.transacting);
	return rows;
}

export async function createTenantMembershipHistory(membershipRef: unknown, tenantId: number | string, payload: Record<string, unknown>, options: { performedBy?: number | null; source?: HistorySource | null; transacting?: any } = {}) {
	const membership = await findMembershipInTenant(membershipRef, tenantId, options.transacting);
	const eventType = toText(payload?.eventType).toLowerCase();
	if (!eventType) {
		httpError(400, 'eventType is required', 'INVALID_REQUEST_BODY');
	}
	const created = await strapi.db.query(CLUB_MEMBERSHIP_HISTORY_UID).create({
		data: {
			tenant: tenantId,
			membership: Number(membership.id),
			eventType,
			eventAt: normalizeEventAt(payload?.eventAt),
			note: normalizeOptionalText(payload?.note),
			metadata: normalizeMetadata(payload?.metadata),
			performedBy: options.performedBy || null,
			source: normalizeHistorySource(options.source || 'admin'),
		},
		...(options.transacting ? { transacting: options.transacting } : {}),
	} as any);
	const snapshot = await rebuildMembershipSnapshot(Number(membership.id), tenantId, options.transacting);
	return {
		history: await getTenantMembershipHistory(Number(created.id), tenantId),
		membership: snapshot,
	};
}

export async function updateTenantMembershipHistory(membershipRef: unknown, historyRef: unknown, tenantId: number | string, payload: Record<string, unknown>, options: { transacting?: any } = {}) {
	const membership = await findMembershipInTenant(membershipRef, tenantId, options.transacting);
	const where = whereByParam(historyRef);
	if (!where) {
		httpError(404, 'Club membership history not found', 'CLUB_MEMBERSHIP_HISTORY_NOT_FOUND');
	}
	const current = await strapi.db.query(CLUB_MEMBERSHIP_HISTORY_UID).findOne({
		where: mergeTenantWhere({ ...where, membership: { id: { $eq: Number(membership.id) } } }, tenantId),
		...(options.transacting ? { transacting: options.transacting } : {}),
	} as any);
	if (!current?.id) {
		httpError(404, 'Club membership history not found', 'CLUB_MEMBERSHIP_HISTORY_NOT_FOUND');
	}
	await strapi.db.query(CLUB_MEMBERSHIP_HISTORY_UID).update({
		where: { id: Number(current.id) },
		data: {
			eventType: toText(payload?.eventType) || current.eventType,
			eventAt: payload?.eventAt ? normalizeEventAt(payload.eventAt) : current.eventAt,
			note: Object.prototype.hasOwnProperty.call(payload || {}, 'note') ? normalizeOptionalText(payload.note) : current.note,
			metadata: Object.prototype.hasOwnProperty.call(payload || {}, 'metadata') ? normalizeMetadata(payload.metadata) : current.metadata,
		},
		...(options.transacting ? { transacting: options.transacting } : {}),
	} as any);
	const snapshot = await rebuildMembershipSnapshot(Number(membership.id), tenantId, options.transacting);
	return {
		history: await getTenantMembershipHistory(Number(current.id), tenantId),
		membership: snapshot,
	};
}

export async function deleteTenantMembershipHistory(membershipRef: unknown, historyRef: unknown, tenantId: number | string, options: { transacting?: any } = {}) {
	const membership = await findMembershipInTenant(membershipRef, tenantId, options.transacting);
	const where = whereByParam(historyRef);
	if (!where) {
		httpError(404, 'Club membership history not found', 'CLUB_MEMBERSHIP_HISTORY_NOT_FOUND');
	}
	const current = await strapi.db.query(CLUB_MEMBERSHIP_HISTORY_UID).findOne({
		where: mergeTenantWhere({ ...where, membership: { id: { $eq: Number(membership.id) } } }, tenantId),
		...(options.transacting ? { transacting: options.transacting } : {}),
	} as any);
	if (!current?.id) {
		httpError(404, 'Club membership history not found', 'CLUB_MEMBERSHIP_HISTORY_NOT_FOUND');
	}
	await strapi.db.query(CLUB_MEMBERSHIP_HISTORY_UID).delete({
		where: { id: Number(current.id) },
		...(options.transacting ? { transacting: options.transacting } : {}),
	} as any);
	const snapshot = await rebuildMembershipSnapshot(Number(membership.id), tenantId, options.transacting);
	return {
		success: true,
		membership: snapshot,
	};
}

function resolveCreateEventType(toStatus: StatusValue): HistoryEventType {
	if (toStatus === 'rejected') return 'rejected';
	if (toStatus === 'active' || toStatus === 'pending') return 'joined';
	if (toStatus === 'suspended') return 'suspended';
	if (toStatus === 'inactive') return 'deactivated';
	if (toStatus === 'left') return 'left';
	return 'joined';
}

function resolveStatusEventType(fromStatus: StatusValue, toStatus: StatusValue): HistoryEventType | null {
	if (fromStatus === toStatus) return null;
	if (toStatus === 'left') return 'left';
	if (toStatus === 'inactive') return 'deactivated';
	if (toStatus === 'suspended') return 'suspended';
	if (toStatus === 'rejected') return 'rejected';
	if (toStatus === 'active') {
		if (fromStatus === 'left') return 'rejoined';
		if (fromStatus === 'inactive' || fromStatus === 'suspended') return 'reactivated';
		return 'activated';
	}
	if (toStatus === 'pending') return 'joined';
	return null;
}

function deriveToStatusFromEventType(eventType: unknown, previousStatus: StatusValue): StatusValue {
	const normalized = toText(eventType).toLowerCase();
	if (normalized === 'joined') return previousStatus === 'pending' ? 'pending' : 'active';
	if (normalized === 'approved') return 'active';
	if (normalized === 'rejected') return 'rejected';
	if (normalized === 'left') return 'left';
	if (normalized === 'rejoined') return 'active';
	if (normalized === 'activated') return 'active';
	if (normalized === 'deactivated') return 'inactive';
	if (normalized === 'suspended') return 'suspended';
	if (normalized === 'reactivated') return 'active';
	return null;
}

function isStatusLifecycleEvent(eventType: unknown): boolean {
	return deriveToStatusFromEventType(eventType, null) !== null;
}

function toDeterministicHistoryOrder(a: any, b: any) {
	const eventAtA = normalizeEventAt(a?.eventAt);
	const eventAtB = normalizeEventAt(b?.eventAt);
	if (eventAtA !== eventAtB) return eventAtA.localeCompare(eventAtB);
	const createdAtA = normalizeEventAt(a?.createdAt);
	const createdAtB = normalizeEventAt(b?.createdAt);
	if (createdAtA !== createdAtB) return createdAtA.localeCompare(createdAtB);
	return Number(a?.id || 0) - Number(b?.id || 0);
}

async function loadMembershipHistoryRows(membershipId: number | string, tenantId: number | string, transacting?: any) {
	return await strapi.db.query(CLUB_MEMBERSHIP_HISTORY_UID).findMany({
		where: mergeTenantWhere({ membership: { id: { $eq: Number(membershipId) } } }, tenantId),
		populate: {
			performedBy: { select: ['id', 'documentId', 'username', 'email', 'fullName'] },
		},
		...(transacting ? { transacting } : {}),
	} as any);
}

export async function rebuildMembershipSnapshot(membershipRef: unknown, tenantId: number | string, transacting?: any) {
	const membership = await findMembershipInTenant(membershipRef, tenantId, transacting);
	const historyRows = await loadMembershipHistoryRows(Number(membership.id), tenantId, transacting);
	const sortedRows = (historyRows || []).slice().sort(toDeterministicHistoryOrder);

	if (sortedRows.length === 0) {
		return membership;
	}

	let currentStatus: StatusValue = null;
	let firstJoinedAt: string | null = normalizeOptionalText(membership.joinedAt);
	let lastLeftAt: string | null = normalizeOptionalText(membership.leftAt);

	for (const row of sortedRows as HistoryRecord[]) {
		const eventType = toText(row?.eventType).toLowerCase();
		const eventAt = normalizeEventAt(row?.eventAt || row?.createdAt || new Date());
		const nextStatus = isStatusLifecycleEvent(eventType)
			? (normalizeStatus(row?.toStatus) || deriveToStatusFromEventType(eventType, currentStatus))
			: currentStatus;
		const nextFromStatus = isStatusLifecycleEvent(eventType) ? currentStatus : normalizeStatus(row?.fromStatus);
		const nextToStatus = isStatusLifecycleEvent(eventType) ? nextStatus : normalizeStatus(row?.toStatus);

		if (isStatusLifecycleEvent(eventType)) {
			await strapi.db.query(CLUB_MEMBERSHIP_HISTORY_UID).update({
				where: { id: Number(row.id) },
				data: {
					fromStatus: nextFromStatus,
					toStatus: nextToStatus,
				},
				...(transacting ? { transacting } : {}),
			} as any);
			currentStatus = nextToStatus;
			if (eventType === 'joined' && !firstJoinedAt) {
				firstJoinedAt = eventAt;
			}
			if (eventType === 'left') {
				lastLeftAt = eventAt;
			}
			if (eventType === 'rejoined' || eventType === 'activated' || eventType === 'reactivated' || eventType === 'approved' || eventType === 'joined') {
				lastLeftAt = null;
			}
		}
	}

	const finalStatus = currentStatus || normalizeStatus(membership.status) || 'active';
	const finalJoinedAt = firstJoinedAt || normalizeOptionalText(membership.joinedAt) || null;
	const finalLeftAt = finalStatus === 'left' ? (lastLeftAt || normalizeOptionalText(membership.leftAt) || null) : null;

	await strapi.db.query(CLUB_MEMBERSHIP_UID).update({
		where: { id: Number(membership.id) },
		data: {
			status: finalStatus,
			joinedAt: finalJoinedAt,
			leftAt: finalLeftAt,
		},
		...(transacting ? { transacting } : {}),
	} as any);

	return await findMembershipInTenant(Number(membership.id), tenantId, transacting);
}

function resolveStatusEventAt(previous: MembershipSnapshot | null, next: MembershipSnapshot): string {
	const nextStatus = normalizeStatus(next.status);
	if (nextStatus === 'left' && next.leftAt) {
		return normalizeEventAt(next.leftAt);
	}
	if ((nextStatus === 'active' || nextStatus === 'pending') && next.joinedAt) {
		return normalizeEventAt(next.joinedAt);
	}
	return normalizeEventAt(next.updatedAt || next.createdAt || new Date());
}

export function buildMembershipCreateHistoryEvents(membership: MembershipSnapshot, options: { performedBy?: number | null } = {}) {
	const toStatus = normalizeStatus(membership.status);
	if (!toStatus) return [];
	return [{
		eventType: resolveCreateEventType(toStatus),
		eventAt: membership.joinedAt || membership.createdAt || new Date(),
		fromStatus: null,
		toStatus,
		source: mapMembershipSourceToHistorySource(membership.source),
		performedBy: options.performedBy || null,
	}];
}

export function buildMembershipUpdateHistoryEvents(previous: MembershipSnapshot, next: MembershipSnapshot, options: { performedBy?: number | null } = {}) {
	const events: HistoryEventInput[] = [];
	const previousStatus = normalizeStatus(previous?.status);
	const nextStatus = normalizeStatus(next?.status);
	const previousRole = normalizeRole(previous?.role);
	const nextRole = normalizeRole(next?.role);
	const previousPositionTitle = normalizeOptionalText(previous?.positionTitle, 150);
	const nextPositionTitle = normalizeOptionalText(next?.positionTitle, 150);
	const previousMemberCode = normalizeOptionalText(previous?.memberCode, 100);
	const nextMemberCode = normalizeOptionalText(next?.memberCode, 100);
	const source = mapMembershipSourceToHistorySource(next?.source || previous?.source);
	const performedBy = options.performedBy || null;

	const statusEventType = resolveStatusEventType(previousStatus, nextStatus);
	if (statusEventType) {
		events.push({
			eventType: statusEventType,
			eventAt: resolveStatusEventAt(previous, next),
			fromStatus: previousStatus,
			toStatus: nextStatus,
			source,
			performedBy,
		});
	}

	if (previousRole !== nextRole) {
		events.push({
			eventType: 'role_changed',
			eventAt: next.updatedAt || new Date(),
			fromRole: previousRole,
			toRole: nextRole,
			source,
			performedBy,
		});
	}

	if (previousPositionTitle !== nextPositionTitle) {
		events.push({
			eventType: 'position_changed',
			eventAt: next.updatedAt || new Date(),
			fromPositionTitle: previousPositionTitle,
			toPositionTitle: nextPositionTitle,
			source,
			performedBy,
		});
	}

	if (previousMemberCode !== nextMemberCode) {
		events.push({
			eventType: 'member_code_changed',
			eventAt: next.updatedAt || new Date(),
			source,
			performedBy,
			metadata: {
				oldMemberCode: previousMemberCode,
				newMemberCode: nextMemberCode,
			},
		});
	}

	return events;
}

export async function listTenantMembershipHistories(query: Record<string, unknown>, tenantId: number | string) {
	const page = toPositiveInt(query.page, 1);
	const pageSize = toPositiveInt(query.pageSize, 10);
	const start = (page - 1) * pageSize;
	const where = mergeTenantWhere(buildListWhere(query), tenantId);
	const orderBy = resolveOrderBy(query);

	const [rows, total] = await Promise.all([
		strapi.db.query(CLUB_MEMBERSHIP_HISTORY_UID).findMany({
			where,
			orderBy,
			offset: start,
			limit: pageSize,
			populate: {
				performedBy: { select: ['id', 'documentId', 'username', 'email', 'fullName'] },
			},
		} as any),
		strapi.db.query(CLUB_MEMBERSHIP_HISTORY_UID).count({ where } as any),
	]);

	return {
		rows: (rows || []).map((row: any) => mapHistoryRow(row)),
		pagination: {
			page,
			pageSize,
			pageCount: Math.max(1, Math.ceil(total / pageSize)),
			total,
		},
	};
}

export async function getTenantMembershipHistory(historyRef: unknown, tenantId: number | string) {
	const where = whereByParam(historyRef);
	if (!where) {
		httpError(404, 'Club membership history not found', 'CLUB_MEMBERSHIP_HISTORY_NOT_FOUND');
	}
	const row = await strapi.db.query(CLUB_MEMBERSHIP_HISTORY_UID).findOne({
		where: mergeTenantWhere(where, tenantId),
		populate: {
			performedBy: { select: ['id', 'documentId', 'username', 'email', 'fullName'] },
		},
	} as any);
	if (!row?.id) {
		httpError(404, 'Club membership history not found', 'CLUB_MEMBERSHIP_HISTORY_NOT_FOUND');
	}
	return mapHistoryRow(row);
}

export async function listTenantHistoryForMembership(membershipRef: unknown, tenantId: number | string, query: Record<string, unknown>) {
	const membership = await findMembershipInTenant(membershipRef, tenantId);
	const nextQuery = { ...(query || {}), membership: String(membership.id) };
	return await listTenantMembershipHistories(nextQuery, tenantId);
}

export function handleClubMembershipHistoryError(ctx: any, error: any) {
	if (error instanceof ClubMembershipHistoryError) {
		ctx.status = error.status;
		ctx.body = {
			error: {
				status: error.status,
				name: 'ClubMembershipHistoryError',
				message: error.message,
				code: error.code || undefined,
				details: error.details || undefined,
			},
		};
		return;
	}

	const message = toText(error?.message || error?.details?.message || error?.response?.data?.error?.message);
	if (message) {
		ctx.badRequest(message);
		return;
	}

	strapi.log.error('[club-membership-history] unexpected error', error);
	ctx.internalServerError('Failed to process club membership history request');
}

export default {
	createMembershipHistoryEntries,
	buildMembershipCreateHistoryEvents,
	buildMembershipUpdateHistoryEvents,
	listTenantMembershipHistories,
	getTenantMembershipHistory,
	listTenantHistoryForMembership,
	handleClubMembershipHistoryError,
};