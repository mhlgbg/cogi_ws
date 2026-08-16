import { listTenantHistoryForMembership } from '../../club-membership-history/services/club-membership-history';
import { createTenantMembershipHistory, deleteTenantMembershipHistory, updateTenantMembershipHistory } from '../../club-membership-history/services/club-membership-history';
import {
	getTenantSportsAchievement,
	listTenantSportsAchievements,
	revokeSportsAchievement,
} from '../../sports-achievement/services/sports-achievement';
import {
	createCorrectionSubmissionFromAchievement,
	createAndVerifyAchievementSubmission,
	createTenantSportsAchievementSubmission,
	getTenantSportsAchievementSubmission,
	listTenantSportsAchievementSubmissions,
	rejectAchievementSubmission,
	submitAchievementSubmission,
	updateTenantSportsAchievementSubmission,
	verifyAchievementSubmission,
} from '../../sports-achievement-submission/services/sports-achievement-submission';
import {
  activateTenantClubMembership,
  createTenantClubMembership,
  deactivateTenantClubMembership,
  getTenantClubMembership,
  leaveTenantClubMembership,
  listTenantClubMemberships,
  updateTenantClubMembership,
} from '../../club-membership/services/club-membership';
import { getAssignedClubIds, isUserAssignedToClub } from '../../sports-club-user-assignment/services/sports-club-user-assignment';
import { createTenantSportsProfile } from '../../sports-profile/services/sports-profile';
import { listTenantSportsProfiles } from '../../sports-profile/services/sports-profile';
import { mergeTenantWhere, toPositiveInt, toText, whereByParam } from '../../../utils/tenant-scope';

const SPORTS_CLUB_UID = 'api::sports-club.sports-club' as any;
const CLUB_MEMBERSHIP_UID = 'api::club-membership.club-membership' as any;
const SPORTS_ACHIEVEMENT_UID = 'api::sports-achievement.sports-achievement' as any;
const SPORTS_ACHIEVEMENT_SUBMISSION_UID = 'api::sports-achievement-submission.sports-achievement-submission' as any;

type AuthUser = { id: number } | null;

export class SportsClubManagementError extends Error {
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
	throw new SportsClubManagementError(status, message, code, details || null);
}

function normalizeOptionalText(value: unknown): string | null {
	const text = toText(value);
	return text || null;
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

function mapClubHeader(row: any) {
	if (!row?.id) return null;
	return {
		id: Number(row.id),
		documentId: row.documentId || null,
		code: toText(row.code),
		name: toText(row.name),
		shortName: normalizeOptionalText(row.shortName),
		slug: normalizeOptionalText(row.slug),
		clubType: toText(row.clubType) || 'club',
		sportType: toText(row.sportType) || 'running',
		status: toText(row.status) || 'active',
		parentClub: row.parentClub?.id
			? {
				id: Number(row.parentClub.id),
				documentId: row.parentClub.documentId || null,
				code: toText(row.parentClub.code),
				name: toText(row.parentClub.name),
				shortName: normalizeOptionalText(row.parentClub.shortName),
			}
			: null,
		logo: mapMedia(row.logo),
		assignedAt: row.assignedAt || null,
		assignmentNote: normalizeOptionalText(row.assignmentNote),
	};
}

async function findManagedClubInTenant(userId: number, clubRef: unknown, tenantId: number | string) {
	const where = whereByParam(clubRef);
	if (!where) {
		httpError(404, 'Sports club not found', 'SPORTS_CLUB_NOT_FOUND');
	}
	const club = await strapi.db.query(SPORTS_CLUB_UID).findOne({
		where: mergeTenantWhere(where, tenantId),
		populate: {
			parentClub: { select: ['id', 'documentId', 'code', 'name', 'shortName'] },
			logo: { select: ['id', 'name', 'url', 'mime'] },
		},
	} as any);
	if (!club?.id) {
		httpError(404, 'Sports club not found', 'SPORTS_CLUB_NOT_FOUND');
	}
	const assigned = await isUserAssignedToClub(userId, Number(club.id), tenantId);
	if (!assigned) {
		httpError(403, 'Bạn không được phân công quản lý CLB này.', 'CLUB_ASSIGNMENT_REQUIRED');
	}
	return club;
}

async function findManagedMembershipInClub(userId: number, clubRef: unknown, membershipRef: unknown, tenantId: number | string) {
	const club = await findManagedClubInTenant(userId, clubRef, tenantId);
	const membership = await getTenantClubMembership(membershipRef, tenantId);
	if (Number(membership?.club?.id || 0) !== Number(club.id)) {
		httpError(404, 'Club membership not found in this club', 'CLUB_MEMBERSHIP_NOT_IN_CLUB');
	}
	return { club, membership };
}

async function findExistingMembershipByProfileInClub(tenantId: number | string, clubId: number, sportsProfileRef: unknown) {
	const profileWhere = whereByParam(sportsProfileRef);
	if (!profileWhere) return null;
	const queryWhere = profileWhere.id
		? { sportsProfile: { id: { $eq: profileWhere.id } }, club: { id: { $eq: clubId } } }
		: { sportsProfile: { documentId: { $eq: profileWhere.documentId } }, club: { id: { $eq: clubId } } };
	return await strapi.db.query(CLUB_MEMBERSHIP_UID).findOne({
		where: mergeTenantWhere(queryWhere, tenantId),
		select: ['id', 'status'],
	} as any);
}

async function findManagedAchievementSubmissionInClub(userId: number, clubRef: unknown, submissionRef: unknown, tenantId: number | string) {
	const club = await findManagedClubInTenant(userId, clubRef, tenantId);
	const submission = await getTenantSportsAchievementSubmission(submissionRef, tenantId);
	if (Number(submission?.club?.id || 0) !== Number(club.id)) {
		httpError(404, 'Sports achievement submission not found in this club', 'SPORTS_ACHIEVEMENT_SUBMISSION_NOT_IN_CLUB');
	}
	return { club, submission };
}

async function findManagedAchievementInClub(userId: number, clubRef: unknown, achievementRef: unknown, tenantId: number | string) {
	const club = await findManagedClubInTenant(userId, clubRef, tenantId);
	const achievement = await getTenantSportsAchievement(achievementRef, tenantId);
	if (Number(achievement?.club?.id || 0) !== Number(club.id)) {
		httpError(404, 'Sports achievement not found in this club', 'SPORTS_ACHIEVEMENT_NOT_IN_CLUB');
	}
	return { club, achievement };
}

async function loadMembershipSummariesForClub(tenantId: number | string, clubId: number, sportsProfileIds: number[]) {
	const uniqueProfileIds = Array.from(new Set((sportsProfileIds || []).map((item) => Number(item)).filter((item) => Number.isInteger(item) && item > 0)));
	if (uniqueProfileIds.length === 0) return new Map<number, any>();
	const rows = await strapi.db.query(CLUB_MEMBERSHIP_UID).findMany({
		where: mergeTenantWhere({
			club: { id: { $eq: Number(clubId) } },
			sportsProfile: { id: { $in: uniqueProfileIds } },
		}, tenantId),
		select: ['id', 'documentId', 'memberCode', 'oldMemberCode', 'status', 'role', 'positionTitle', 'joinedAt', 'leftAt', 'updatedAt'],
		populate: {
			sportsProfile: { select: ['id'] },
		},
		orderBy: [{ updatedAt: 'desc' }, { createdAt: 'desc' }],
	} as any);
	const map = new Map<number, any>();
	for (const row of rows || []) {
		const profileId = Number(row?.sportsProfile?.id || 0);
		if (!profileId || map.has(profileId)) continue;
		map.set(profileId, {
			id: Number(row.id),
			documentId: row.documentId || null,
			memberCode: toText(row.memberCode) || null,
			oldMemberCode: toText(row.oldMemberCode) || null,
			status: toText(row.status) || null,
			role: toText(row.role) || null,
			positionTitle: toText(row.positionTitle) || null,
			joinedAt: row.joinedAt || null,
			leftAt: row.leftAt || null,
		});
	}
	return map;
}

function attachMembershipSummary<T extends { sportsProfile?: { id?: number | null } | null }>(items: T[], summaries: Map<number, any>) {
	return (items || []).map((item) => ({
		...item,
		clubMembership: item?.sportsProfile?.id ? summaries.get(Number(item.sportsProfile.id)) || null : null,
	}));
}

export async function listMyManagedClubs(userId: number, tenantId: number | string) {
	const clubIds = await getAssignedClubIds(userId, tenantId);
	if (clubIds.length === 0) {
		return [];
	}
	const assignmentRows = await strapi.db.query('api::sports-club-user-assignment.sports-club-user-assignment').findMany({
		where: mergeTenantWhere({
			user: { id: { $eq: Number(userId) } },
			status: { $eq: 'active' },
			club: { id: { $in: clubIds } },
		}, tenantId),
		populate: {
			club: {
				select: ['id', 'documentId', 'code', 'name', 'shortName', 'slug', 'clubType', 'sportType', 'status'],
				populate: {
					parentClub: { select: ['id', 'documentId', 'code', 'name', 'shortName'] },
					logo: { select: ['id', 'name', 'url', 'mime'] },
				},
			},
		},
		orderBy: [{ assignedAt: 'desc' }],
	} as any);
	return (assignmentRows || [])
		.map((row: any) => {
			if (!row?.club?.id) return null;
			return mapClubHeader({ ...row.club, assignedAt: row.assignedAt || null, assignmentNote: row.note || null });
		})
		.filter(Boolean);
}

export async function getMyManagedClubDetail(userId: number, clubRef: unknown, tenantId: number | string) {
	return mapClubHeader(await findManagedClubInTenant(userId, clubRef, tenantId));
}

export async function listManagedClubMembers(userId: number, clubRef: unknown, tenantId: number | string, query: Record<string, unknown>) {
	const club = await findManagedClubInTenant(userId, clubRef, tenantId);
	return await listTenantClubMemberships({ ...(query || {}), club: Number(club.id) }, tenantId);
}

export async function listManagedClubProfileOptions(userId: number, clubRef: unknown, tenantId: number | string, query: Record<string, unknown>) {
	await findManagedClubInTenant(userId, clubRef, tenantId);
	const page = toPositiveInt(query.page, 1);
	const pageSize = Math.min(100, toPositiveInt(query.pageSize, 20));
	return await listTenantSportsProfiles({
		page,
		pageSize,
		search: toText(query.search ?? query.q),
		sort: 'fullName:asc',
	}, tenantId);
}

export async function listManagedClubAchievementProfileOptions(userId: number, clubRef: unknown, tenantId: number | string, query: Record<string, unknown>) {
	const club = await findManagedClubInTenant(userId, clubRef, tenantId);
	const page = Math.min(100, toPositiveInt(query.pageSize ?? query.limit, 100));
	const currentMembers = await listTenantClubMemberships({
		club: Number(club.id),
		page: 1,
		pageSize: page,
		sort: 'updatedAt:desc',
		...(query.search ? { search: query.search } : {}),
	}, tenantId);
	return currentMembers.rows || [];
}

export async function createManagedClubMember(userId: number, clubRef: unknown, tenantId: number | string, payload: Record<string, unknown>, authUser: AuthUser = null) {
	const club = await findManagedClubInTenant(userId, clubRef, tenantId);
	const sportsProfileRef = payload?.sportsProfile;
	if (!sportsProfileRef) {
		httpError(400, 'sportsProfile is required', 'INVALID_REQUEST_BODY', { field: 'sportsProfile' });
	}
	const existing = await findExistingMembershipByProfileInClub(tenantId, Number(club.id), sportsProfileRef);
	if (existing?.id) {
		const currentStatus = toText(existing.status).toLowerCase();
		if (currentStatus === 'active' || currentStatus === 'pending') {
			httpError(409, 'Hồ sơ này đã là thành viên của CLB.', 'CLUB_MEMBER_ALREADY_EXISTS');
		}
		return await updateTenantClubMembership(Number(existing.id), {
			memberCode: payload.memberCode,
			oldMemberCode: payload.oldMemberCode,
			status: payload.status || 'active',
			role: payload.role,
			positionTitle: payload.positionTitle,
			joinedAt: payload.joinedAt,
			leftAt: payload.leftAt,
			source: payload.source,
			sourceReference: payload.sourceReference,
			joinMessage: payload.joinMessage,
			note: payload.note,
			sportsProfile: payload.sportsProfile,
			club: Number(club.id),
		}, tenantId, authUser);
	}
	return await createTenantClubMembership({ ...payload, club: Number(club.id) }, tenantId, authUser);
}

export async function createManagedClubProfile(userId: number, clubRef: unknown, tenantId: number | string, payload: Record<string, unknown>) {
	await findManagedClubInTenant(userId, clubRef, tenantId);
	return await createTenantSportsProfile({
		code: payload.code,
		fullName: payload.fullName,
		displayName: payload.displayName,
		gender: payload.gender,
		dateOfBirth: payload.dateOfBirth,
		birthYear: payload.birthYear,
		contactPhone: payload.contactPhone,
		contactEmail: payload.contactEmail,
		hometown: payload.hometown,
	}, tenantId);
}

export async function getManagedClubMemberDetail(userId: number, clubRef: unknown, membershipRef: unknown, tenantId: number | string) {
	const result = await findManagedMembershipInClub(userId, clubRef, membershipRef, tenantId);
	return result.membership;
}

export async function updateManagedClubMember(userId: number, clubRef: unknown, membershipRef: unknown, tenantId: number | string, payload: Record<string, unknown>, authUser: AuthUser = null) {
	const { club, membership } = await findManagedMembershipInClub(userId, clubRef, membershipRef, tenantId);
	return await updateTenantClubMembership(Number(membership.id), {
		memberCode: payload.memberCode,
		oldMemberCode: payload.oldMemberCode,
		role: payload.role,
		positionTitle: payload.positionTitle,
		source: payload.source,
		sourceReference: payload.sourceReference,
		joinMessage: payload.joinMessage,
		note: payload.note,
		sportsProfile: Number(membership.sportsProfile?.id),
		club: Number(club.id),
	}, tenantId, authUser);
}

export async function activateManagedClubMember(userId: number, clubRef: unknown, membershipRef: unknown, tenantId: number | string, authUser: AuthUser = null) {
	await findManagedMembershipInClub(userId, clubRef, membershipRef, tenantId);
	return await createTenantMembershipHistory(membershipRef, tenantId, {
		eventType: 'reactivated',
		eventAt: new Date().toISOString(),
	}, { performedBy: authUser?.id || null, source: 'admin' });
}

export async function deactivateManagedClubMember(userId: number, clubRef: unknown, membershipRef: unknown, tenantId: number | string, authUser: AuthUser = null) {
	await findManagedMembershipInClub(userId, clubRef, membershipRef, tenantId);
	return await createTenantMembershipHistory(membershipRef, tenantId, {
		eventType: 'deactivated',
		eventAt: new Date().toISOString(),
	}, { performedBy: authUser?.id || null, source: 'admin' });
}

export async function leaveManagedClubMember(userId: number, clubRef: unknown, membershipRef: unknown, tenantId: number | string, authUser: AuthUser = null) {
	await findManagedMembershipInClub(userId, clubRef, membershipRef, tenantId);
	return await createTenantMembershipHistory(membershipRef, tenantId, {
		eventType: 'left',
		eventAt: new Date().toISOString(),
	}, { performedBy: authUser?.id || null, source: 'admin' });
}

export async function reactivateManagedClubMember(userId: number, clubRef: unknown, membershipRef: unknown, tenantId: number | string, payload: Record<string, unknown>, authUser: AuthUser = null) {
	await findManagedMembershipInClub(userId, clubRef, membershipRef, tenantId);
	return await createTenantMembershipHistory(membershipRef, tenantId, {
		eventType: 'reactivated',
		eventAt: payload?.eventAt,
		note: payload?.note,
	}, { performedBy: authUser?.id || null, source: 'admin' });
}

export async function rejoinManagedClubMember(userId: number, clubRef: unknown, membershipRef: unknown, tenantId: number | string, payload: Record<string, unknown>, authUser: AuthUser = null) {
	await findManagedMembershipInClub(userId, clubRef, membershipRef, tenantId);
	return await createTenantMembershipHistory(membershipRef, tenantId, {
		eventType: 'rejoined',
		eventAt: payload?.eventAt,
		note: payload?.note,
	}, { performedBy: authUser?.id || null, source: 'admin' });
}

export async function deactivateManagedClubMemberWithEvent(userId: number, clubRef: unknown, membershipRef: unknown, tenantId: number | string, payload: Record<string, unknown>, authUser: AuthUser = null) {
	await findManagedMembershipInClub(userId, clubRef, membershipRef, tenantId);
	return await createTenantMembershipHistory(membershipRef, tenantId, {
		eventType: 'deactivated',
		eventAt: payload?.eventAt,
		note: payload?.note,
	}, { performedBy: authUser?.id || null, source: 'admin' });
}

export async function leaveManagedClubMemberWithEvent(userId: number, clubRef: unknown, membershipRef: unknown, tenantId: number | string, payload: Record<string, unknown>, authUser: AuthUser = null) {
	await findManagedMembershipInClub(userId, clubRef, membershipRef, tenantId);
	return await createTenantMembershipHistory(membershipRef, tenantId, {
		eventType: 'left',
		eventAt: payload?.eventAt,
		note: payload?.note,
	}, { performedBy: authUser?.id || null, source: 'admin' });
}

export async function listManagedClubMemberHistory(userId: number, clubRef: unknown, membershipRef: unknown, tenantId: number | string, query: Record<string, unknown>) {
	await findManagedMembershipInClub(userId, clubRef, membershipRef, tenantId);
	return await listTenantHistoryForMembership(membershipRef, tenantId, query || {});
}

export async function createManagedClubMemberHistory(userId: number, clubRef: unknown, membershipRef: unknown, tenantId: number | string, payload: Record<string, unknown>, authUser: AuthUser = null) {
	await findManagedMembershipInClub(userId, clubRef, membershipRef, tenantId);
	return await createTenantMembershipHistory(membershipRef, tenantId, payload, { performedBy: authUser?.id || null, source: 'admin' });
}

export async function updateManagedClubMemberHistory(userId: number, clubRef: unknown, membershipRef: unknown, historyRef: unknown, tenantId: number | string, payload: Record<string, unknown>) {
	await findManagedMembershipInClub(userId, clubRef, membershipRef, tenantId);
	return await updateTenantMembershipHistory(membershipRef, historyRef, tenantId, payload);
}

export async function deleteManagedClubMemberHistory(userId: number, clubRef: unknown, membershipRef: unknown, historyRef: unknown, tenantId: number | string) {
	await findManagedMembershipInClub(userId, clubRef, membershipRef, tenantId);
	return await deleteTenantMembershipHistory(membershipRef, historyRef, tenantId);
}

export async function listManagedClubAchievementSubmissions(userId: number, clubRef: unknown, tenantId: number | string, query: Record<string, unknown>) {
	const club = await findManagedClubInTenant(userId, clubRef, tenantId);
	const normalizedStatus = toText(query.status).toLowerCase();
	const nextQuery = { ...(query || {}), club: Number(club.id) } as Record<string, unknown>;
	if (normalizedStatus === 'draft' || normalizedStatus === 'submitted' || normalizedStatus === 'verified' || normalizedStatus === 'rejected' || normalizedStatus === 'cancelled') {
		nextQuery.status = normalizedStatus;
	} else {
		delete nextQuery.status;
	}
	const data = await listTenantSportsAchievementSubmissions(nextQuery, tenantId);
	const summaries = await loadMembershipSummariesForClub(tenantId, Number(club.id), (data.rows || []).map((item: any) => item?.sportsProfile?.id));
	return {
		rows: attachMembershipSummary(data.rows || [], summaries),
		pagination: data.pagination,
	};
}

export async function getManagedClubAchievementSubmissionDetail(userId: number, clubRef: unknown, submissionRef: unknown, tenantId: number | string) {
	const result = await findManagedAchievementSubmissionInClub(userId, clubRef, submissionRef, tenantId);
	const summaries = await loadMembershipSummariesForClub(tenantId, Number(result.club.id), [Number(result.submission?.sportsProfile?.id || 0)]);
	return attachMembershipSummary([result.submission], summaries)[0] || result.submission;
}

export async function createManagedClubAchievementSubmission(userId: number, clubRef: unknown, tenantId: number | string, payload: Record<string, unknown>, authUser: AuthUser = null) {
	const club = await findManagedClubInTenant(userId, clubRef, tenantId);
	const verifyNow = payload?.verifyNow === true || toText(payload?.saveMode).toLowerCase() === 'verify_now';
	const submissionPayload = {
		sportsProfile: payload?.sportsProfile,
		club: Number(club.id),
		achievementType: payload?.achievementType,
		sportType: payload?.sportType,
		title: payload?.title,
		description: payload?.description,
		achievedAt: payload?.achievedAt,
		resultValue: payload?.resultValue,
		resultUnit: payload?.resultUnit,
		resultText: payload?.resultText,
		evidence: payload?.evidence,
		source: 'club_manager',
		sourceReference: payload?.sourceReference,
		note: payload?.note,
		status: 'submitted',
		reviewNote: payload?.reviewNote,
	};
	const result = verifyNow
		? await createAndVerifyAchievementSubmission(submissionPayload, tenantId, authUser)
		: await createTenantSportsAchievementSubmission(submissionPayload, tenantId, authUser);
	const summaries = await loadMembershipSummariesForClub(tenantId, Number(club.id), [Number(result?.sportsProfile?.id || 0)]);
	return attachMembershipSummary([result], summaries)[0] || result;
}

export async function updateManagedClubAchievementSubmission(userId: number, clubRef: unknown, submissionRef: unknown, tenantId: number | string, payload: Record<string, unknown>, authUser: AuthUser = null) {
	const { club, submission } = await findManagedAchievementSubmissionInClub(userId, clubRef, submissionRef, tenantId);
	const updated = await updateTenantSportsAchievementSubmission(Number(submission.id), {
		sportsProfile: payload?.sportsProfile || submission?.sportsProfile?.id,
		club: Number(club.id),
		achievementType: payload?.achievementType,
		sportType: payload?.sportType,
		title: payload?.title,
		description: payload?.description,
		achievedAt: payload?.achievedAt,
		resultValue: payload?.resultValue,
		resultUnit: payload?.resultUnit,
		resultText: payload?.resultText,
		evidence: payload?.evidence,
		source: 'club_manager',
		sourceReference: payload?.sourceReference,
		note: payload?.note,
	}, tenantId, authUser);
	const summaries = await loadMembershipSummariesForClub(tenantId, Number(club.id), [Number(updated?.sportsProfile?.id || 0)]);
	return attachMembershipSummary([updated], summaries)[0] || updated;
}

export async function submitManagedClubAchievementSubmission(userId: number, clubRef: unknown, submissionRef: unknown, tenantId: number | string, authUser: AuthUser = null) {
	const { club } = await findManagedAchievementSubmissionInClub(userId, clubRef, submissionRef, tenantId);
	const result = await submitAchievementSubmission(submissionRef, tenantId, authUser);
	const summaries = await loadMembershipSummariesForClub(tenantId, Number(club.id), [Number(result?.sportsProfile?.id || 0)]);
	return attachMembershipSummary([result], summaries)[0] || result;
}

export async function verifyManagedClubAchievementSubmission(userId: number, clubRef: unknown, submissionRef: unknown, tenantId: number | string, payload: Record<string, unknown>, authUser: AuthUser = null) {
	const { club } = await findManagedAchievementSubmissionInClub(userId, clubRef, submissionRef, tenantId);
	const result = await verifyAchievementSubmission(submissionRef, tenantId, payload || {}, authUser);
	const summaries = await loadMembershipSummariesForClub(tenantId, Number(club.id), [Number(result?.sportsProfile?.id || 0)]);
	return attachMembershipSummary([result], summaries)[0] || result;
}

export async function rejectManagedClubAchievementSubmission(userId: number, clubRef: unknown, submissionRef: unknown, tenantId: number | string, payload: Record<string, unknown>, authUser: AuthUser = null) {
	const { club } = await findManagedAchievementSubmissionInClub(userId, clubRef, submissionRef, tenantId);
	const result = await rejectAchievementSubmission(submissionRef, tenantId, payload || {}, authUser);
	const summaries = await loadMembershipSummariesForClub(tenantId, Number(club.id), [Number(result?.sportsProfile?.id || 0)]);
	return attachMembershipSummary([result], summaries)[0] || result;
}

export async function listManagedClubAchievements(userId: number, clubRef: unknown, tenantId: number | string, query: Record<string, unknown>) {
	const club = await findManagedClubInTenant(userId, clubRef, tenantId);
	const normalizedStatus = toText(query.status).toLowerCase();
	const nextQuery = { ...(query || {}), club: Number(club.id) } as Record<string, unknown>;
	if (normalizedStatus === 'active' || normalizedStatus === 'revoked') {
		nextQuery.status = normalizedStatus;
	} else {
		delete nextQuery.status;
	}
	const data = await listTenantSportsAchievements(nextQuery, tenantId);
	const summaries = await loadMembershipSummariesForClub(tenantId, Number(club.id), (data.rows || []).map((item: any) => item?.sportsProfile?.id));
	return {
		rows: attachMembershipSummary(data.rows || [], summaries),
		pagination: data.pagination,
	};
}

export async function getManagedClubAchievementDetail(userId: number, clubRef: unknown, achievementRef: unknown, tenantId: number | string) {
	const result = await findManagedAchievementInClub(userId, clubRef, achievementRef, tenantId);
	const summaries = await loadMembershipSummariesForClub(tenantId, Number(result.club.id), [Number(result.achievement?.sportsProfile?.id || 0)]);
	const submissionRow = await strapi.db.query(SPORTS_ACHIEVEMENT_SUBMISSION_UID).findOne({
		where: mergeTenantWhere({ achievement: { id: { $eq: Number(result.achievement.id) } } }, tenantId),
		select: ['id', 'documentId', 'title', 'status', 'submittedAt'],
	} as any);
	return {
		...(attachMembershipSummary([result.achievement], summaries)[0] || result.achievement),
		submission: submissionRow?.id
			? {
				id: Number(submissionRow.id),
				documentId: submissionRow.documentId || null,
				title: toText(submissionRow.title) || null,
				status: toText(submissionRow.status) || null,
				submittedAt: submissionRow.submittedAt || null,
			}
			: null,
	};
}

export async function revokeManagedClubAchievement(userId: number, clubRef: unknown, achievementRef: unknown, tenantId: number | string, payload: Record<string, unknown>, authUser: AuthUser = null) {
	const { club } = await findManagedAchievementInClub(userId, clubRef, achievementRef, tenantId);
	const result = await revokeSportsAchievement(achievementRef, tenantId, { reason: payload?.reason || payload?.revokeReason }, authUser);
	const summaries = await loadMembershipSummariesForClub(tenantId, Number(club.id), [Number(result?.sportsProfile?.id || 0)]);
	const submissionRow = await strapi.db.query(SPORTS_ACHIEVEMENT_SUBMISSION_UID).findOne({
		where: mergeTenantWhere({ achievement: { id: { $eq: Number(result.id) } } }, tenantId),
		select: ['id', 'documentId', 'title', 'status', 'submittedAt'],
	} as any);
	return {
		...(attachMembershipSummary([result], summaries)[0] || result),
		submission: submissionRow?.id
			? {
				id: Number(submissionRow.id),
				documentId: submissionRow.documentId || null,
				title: toText(submissionRow.title) || null,
				status: toText(submissionRow.status) || null,
				submittedAt: submissionRow.submittedAt || null,
			}
			: null,
	};
}

export async function createManagedClubAchievementCorrectionSubmission(userId: number, clubRef: unknown, achievementRef: unknown, tenantId: number | string, authUser: AuthUser = null) {
	const { club } = await findManagedAchievementInClub(userId, clubRef, achievementRef, tenantId);
	const result = await createCorrectionSubmissionFromAchievement(achievementRef, tenantId, authUser);
	const summaries = await loadMembershipSummariesForClub(tenantId, Number(club.id), [Number(result?.sportsProfile?.id || 0)]);
	return attachMembershipSummary([result], summaries)[0] || result;
}

export function handleSportsClubManagementError(ctx: any, error: any) {
	if (error instanceof SportsClubManagementError) {
		ctx.status = error.status;
		ctx.body = {
			error: {
				status: error.status,
				name: 'SportsClubManagementError',
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
	strapi.log.error('[sports-club-management] unexpected error', error);
	ctx.internalServerError('Failed to process sports club manager workspace request');
}
