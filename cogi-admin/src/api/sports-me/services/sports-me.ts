import { mergeTenantWhere, toText, whereByParam } from '../../../utils/tenant-scope';
import { updateTenantSportsProfile } from '../../sports-profile/services/sports-profile';

const SPORTS_PROFILE_UID = 'api::sports-profile.sports-profile' as any;
const CLUB_MEMBERSHIP_UID = 'api::club-membership.club-membership' as any;
const CLUB_MEMBERSHIP_HISTORY_UID = 'api::club-membership-history.club-membership-history' as any;
const SPORTS_ACHIEVEMENT_UID = 'api::sports-achievement.sports-achievement' as any;
const SPORTS_ACHIEVEMENT_SUBMISSION_UID = 'api::sports-achievement-submission.sports-achievement-submission' as any;

const ALLOWED_AVATAR_MEDIA_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/svg+xml', 'image/avif']);
const AVATAR_MAX_FILE_SIZE = 10 * 1024 * 1024;

type HttpErrorDetails = Record<string, unknown> | Array<Record<string, unknown>> | null;
type GenericRecord = Record<string, unknown>;

const CLUB_MEMBERSHIP_STATUS_VALUES = new Set(['pending', 'active', 'inactive', 'left', 'suspended', 'rejected']);
const ACHIEVEMENT_STATUS_VALUES = new Set(['active', 'revoked']);
const SUBMISSION_STATUS_VALUES = new Set(['draft', 'submitted', 'verified', 'rejected', 'cancelled']);

export class SportsMeError extends Error {
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
	throw new SportsMeError(status, message, code, details);
}

function ensureNoUnknownFields(payload: GenericRecord, allowedFields: string[]) {
	const allowed = new Set(allowedFields);
	const unknown = Object.keys(payload || {}).filter((key) => !allowed.has(key));
	if (unknown.length > 0) {
		httpError(400, 'payload contains unknown fields', 'UNKNOWN_FIELDS', { fields: unknown });
	}
}

function normalizeOptionalText(value: unknown): string | null {
	const text = toText(value);
	return text || null;
}

function normalizeMedia(media: any) {
	if (!media?.id) return null;
	return {
		id: Number(media.id),
		name: toText(media.name) || null,
		url: toText(media.url) || null,
		mime: toText(media.mime) || null,
	};
}

function flattenUploadedFiles(value: unknown): any[] {
	if (!value) return [];
	if (Array.isArray(value)) return value.flatMap((entry) => flattenUploadedFiles(entry));
	if (
		typeof value === 'object'
		&& value
		&& ((value as Record<string, unknown>).filepath || (value as Record<string, unknown>).path || (value as Record<string, unknown>).tempFilePath)
	) {
		return [value];
	}
	if (typeof value === 'object') {
		return Object.values(value as Record<string, unknown>).flatMap((entry) => flattenUploadedFiles(entry));
	}
	return [];
}

function resolveUploadFile(rawFiles: any) {
	return flattenUploadedFiles(rawFiles)[0] || null;
}

function normalizeUploadMimeType(file: any) {
	return toText(file?.mimetype || file?.type).toLowerCase();
}

function normalizeUploadSize(file: any) {
	const size = Number(file?.size || 0);
	return Number.isFinite(size) && size >= 0 ? Math.floor(size) : 0;
}

function ensureAvatarFileValid(file: any) {
	const mimeType = normalizeUploadMimeType(file);
	if (!mimeType || !ALLOWED_AVATAR_MEDIA_TYPES.has(mimeType)) {
		httpError(400, 'Chỉ cho phép upload ảnh JPG, PNG, WEBP, GIF, SVG hoặc AVIF', 'INVALID_AVATAR_FILE');
	}

	const size = normalizeUploadSize(file);
	if (!size || size > AVATAR_MAX_FILE_SIZE) {
		httpError(400, 'Ảnh tải lên vượt quá giới hạn 10MB', 'AVATAR_FILE_TOO_LARGE');
	}
}

function mapBasicUser(user: any) {
	if (!user?.id) return null;
	return {
		username: toText(user.username) || null,
		email: toText(user.email) || null,
	};
}

function mapProfileSummary(profile: any) {
	if (!profile?.id) return null;
	return {
		id: Number(profile.id),
		documentId: toText(profile.documentId) || null,
		code: toText(profile.code) || null,
		fullName: toText(profile.fullName) || null,
		status: toText(profile.status).toLowerCase() || 'active',
	};
}

function mapMySportsProfile(profile: any) {
	if (!profile?.id) return null;
	return {
		id: Number(profile.id),
		documentId: toText(profile.documentId) || null,
		code: toText(profile.code) || null,
		fullName: toText(profile.fullName) || null,
		displayName: toText(profile.displayName) || null,
		avatar: normalizeMedia(profile.avatar),
		gender: toText(profile.gender).toLowerCase() || 'unspecified',
		dateOfBirth: profile.dateOfBirth || null,
		birthYear: Number.isInteger(Number(profile.birthYear)) ? Number(profile.birthYear) : null,
		hometown: normalizeOptionalText(profile.hometown),
		bio: normalizeOptionalText(profile.bio),
		contactPhone: normalizeOptionalText(profile.contactPhone),
		contactEmail: normalizeOptionalText(profile.contactEmail),
		status: toText(profile.status).toLowerCase() || 'active',
		createdAt: profile.createdAt || null,
		updatedAt: profile.updatedAt || null,
		user: mapBasicUser(profile.user),
	};
}

function mapMyClubMembership(row: any) {
	if (!row?.id) return null;
	return {
		id: Number(row.id),
		documentId: toText(row.documentId) || null,
		memberCode: toText(row.memberCode) || null,
		oldMemberCode: toText(row.oldMemberCode) || null,
		status: toText(row.status).toLowerCase() || 'active',
		role: toText(row.role).toLowerCase() || 'member',
		positionTitle: normalizeOptionalText(row.positionTitle),
		joinedAt: row.joinedAt || null,
		leftAt: row.leftAt || null,
		source: toText(row.source).toLowerCase() || null,
		sourceReference: normalizeOptionalText(row.sourceReference),
		joinMessage: normalizeOptionalText(row.joinMessage),
		club: row.club?.id ? {
			id: Number(row.club.id),
			documentId: toText(row.club.documentId) || null,
			code: toText(row.club.code) || null,
			name: toText(row.club.name) || null,
			shortName: toText(row.club.shortName) || null,
			logo: normalizeMedia(row.club.logo),
		} : null,
		createdAt: row.createdAt || null,
		updatedAt: row.updatedAt || null,
	};
}

function mapMyMembershipHistory(row: any) {
	if (!row?.id) return null;
	return {
		id: Number(row.id),
		documentId: toText(row.documentId) || null,
		eventType: toText(row.eventType).toLowerCase() || 'other',
		eventAt: row.eventAt || null,
		fromStatus: toText(row.fromStatus).toLowerCase() || null,
		toStatus: toText(row.toStatus).toLowerCase() || null,
		fromRole: toText(row.fromRole).toLowerCase() || null,
		toRole: toText(row.toRole).toLowerCase() || null,
		fromPositionTitle: normalizeOptionalText(row.fromPositionTitle),
		toPositionTitle: normalizeOptionalText(row.toPositionTitle),
		source: toText(row.source).toLowerCase() || null,
		createdAt: row.createdAt || null,
		updatedAt: row.updatedAt || null,
	};
}

function mapMyAchievement(row: any) {
	if (!row?.id) return null;
	return {
		id: Number(row.id),
		documentId: toText(row.documentId) || null,
		title: toText(row.title) || null,
		description: normalizeOptionalText(row.description),
		achievementType: toText(row.achievementType).toLowerCase() || 'other',
		sportType: toText(row.sportType).toLowerCase() || null,
		achievedAt: row.achievedAt || null,
		resultValue: row.resultValue === null || row.resultValue === undefined || row.resultValue === '' ? null : Number(row.resultValue),
		resultUnit: normalizeOptionalText(row.resultUnit),
		resultText: normalizeOptionalText(row.resultText),
		status: toText(row.status).toLowerCase() || 'active',
		source: toText(row.source).toLowerCase() || 'manual',
		sourceReference: normalizeOptionalText(row.sourceReference),
		evidence: Array.isArray(row.evidence) ? row.evidence.map((item: any) => normalizeMedia(item)).filter(Boolean) : [],
		verifiedAt: row.verifiedAt || null,
		revokedAt: row.revokedAt || null,
		revokeReason: normalizeOptionalText(row.revokeReason),
		club: row.club?.id ? {
			id: Number(row.club.id),
			documentId: toText(row.club.documentId) || null,
			code: toText(row.club.code) || null,
			name: toText(row.club.name) || null,
			shortName: toText(row.club.shortName) || null,
			logo: normalizeMedia(row.club.logo),
		} : null,
		createdAt: row.createdAt || null,
		updatedAt: row.updatedAt || null,
	};
}

function mapMySubmission(row: any) {
	if (!row?.id) return null;
	return {
		id: Number(row.id),
		documentId: toText(row.documentId) || null,
		title: toText(row.title) || null,
		description: normalizeOptionalText(row.description),
		achievementType: toText(row.achievementType).toLowerCase() || 'other',
		sportType: toText(row.sportType).toLowerCase() || null,
		achievedAt: row.achievedAt || null,
		resultValue: row.resultValue === null || row.resultValue === undefined || row.resultValue === '' ? null : Number(row.resultValue),
		resultUnit: normalizeOptionalText(row.resultUnit),
		resultText: normalizeOptionalText(row.resultText),
		source: toText(row.source).toLowerCase() || 'other',
		sourceReference: normalizeOptionalText(row.sourceReference),
		status: toText(row.status).toLowerCase() || 'draft',
		submittedAt: row.submittedAt || null,
		reviewedAt: row.reviewedAt || null,
		reviewNote: normalizeOptionalText(row.reviewNote),
		evidence: Array.isArray(row.evidence) ? row.evidence.map((item: any) => normalizeMedia(item)).filter(Boolean) : [],
		club: row.club?.id ? {
			id: Number(row.club.id),
			documentId: toText(row.club.documentId) || null,
			code: toText(row.club.code) || null,
			name: toText(row.club.name) || null,
			shortName: toText(row.club.shortName) || null,
			logo: normalizeMedia(row.club.logo),
		} : null,
		achievement: row.achievement?.id ? {
			id: Number(row.achievement.id),
			documentId: toText(row.achievement.documentId) || null,
			title: toText(row.achievement.title) || null,
			status: toText(row.achievement.status).toLowerCase() || 'active',
			verifiedAt: row.achievement.verifiedAt || null,
		} : null,
		createdAt: row.createdAt || null,
		updatedAt: row.updatedAt || null,
	};
}

function parseErrorMessage(error: any) {
	return toText(error?.message || error?.details?.message || error?.response?.data?.error?.message);
}

function normalizeSelfUpdatePayload(payload: GenericRecord) {
	ensureNoUnknownFields(payload || {}, [
		'displayName',
		'avatar',
		'gender',
		'dateOfBirth',
		'birthYear',
		'hometown',
		'bio',
		'contactPhone',
		'contactEmail',
	]);
	return payload || {};
}

async function resolveCurrentSportsProfile(tenantId: number | string, userId: number | string, transacting?: any) {
	const rows = await strapi.db.query(SPORTS_PROFILE_UID).findMany({
		where: mergeTenantWhere({
			user: { id: { $eq: Number(userId) } },
			status: { $ne: 'merged' },
		}, tenantId),
		populate: {
			avatar: { select: ['id', 'name', 'url', 'mime'] },
			user: { select: ['id', 'username', 'email'] },
		},
		orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
		...(transacting ? { transacting } : {}),
	} as any);

	if (!Array.isArray(rows) || rows.length === 0) {
		httpError(404, 'Sports profile not found for current user.', 'SPORTS_PROFILE_NOT_FOUND');
	}
	if (rows.length > 1) {
		httpError(409, 'Current user is linked to multiple sports profiles in this tenant.', 'SPORTS_PROFILE_LINK_CONFLICT', {
			profiles: rows.map((item: any) => mapProfileSummary(item)).filter(Boolean),
		});
	}
	return rows[0];
}

async function countOverviewSummary(tenantId: number | string, sportsProfileId: number) {
	const [activeClubCount, activeAchievementCount, pendingSubmissionCount] = await Promise.all([
		strapi.db.query(CLUB_MEMBERSHIP_UID).count({
			where: mergeTenantWhere({ sportsProfile: { id: { $eq: sportsProfileId } }, status: { $eq: 'active' } }, tenantId),
		} as any),
		strapi.db.query(SPORTS_ACHIEVEMENT_UID).count({
			where: mergeTenantWhere({ sportsProfile: { id: { $eq: sportsProfileId } }, status: { $eq: 'active' } }, tenantId),
		} as any),
		strapi.db.query(SPORTS_ACHIEVEMENT_SUBMISSION_UID).count({
			where: mergeTenantWhere({ sportsProfile: { id: { $eq: sportsProfileId } }, status: { $eq: 'submitted' } }, tenantId),
		} as any),
	]);

	return {
		activeClubCount,
		activeAchievementCount,
		pendingSubmissionCount,
	};
}

function compareMembershipRows(a: any, b: any) {
	const statusA = toText(a?.status).toLowerCase();
	const statusB = toText(b?.status).toLowerCase();
	const rank = (status: string) => (status === 'active' ? 0 : status === 'pending' ? 1 : status === 'suspended' ? 2 : status === 'inactive' ? 3 : status === 'left' ? 4 : 5);
	const rankDiff = rank(statusA) - rank(statusB);
	if (rankDiff !== 0) return rankDiff;
	const joinedA = new Date(a?.joinedAt || 0).getTime();
	const joinedB = new Date(b?.joinedAt || 0).getTime();
	if (joinedA !== joinedB) return joinedB - joinedA;
	return toText(a?.club?.name).localeCompare(toText(b?.club?.name), 'vi');
}

function compareAchievementRows(a: any, b: any) {
	const achievedA = new Date(a?.achievedAt || 0).getTime();
	const achievedB = new Date(b?.achievedAt || 0).getTime();
	if (achievedA !== achievedB) return achievedB - achievedA;
	const verifiedA = new Date(a?.verifiedAt || 0).getTime();
	const verifiedB = new Date(b?.verifiedAt || 0).getTime();
	if (verifiedA !== verifiedB) return verifiedB - verifiedA;
	return Number(b?.id || 0) - Number(a?.id || 0);
}

function compareSubmissionRows(a: any, b: any) {
	const submittedA = new Date(a?.submittedAt || a?.updatedAt || 0).getTime();
	const submittedB = new Date(b?.submittedAt || b?.updatedAt || 0).getTime();
	if (submittedA !== submittedB) return submittedB - submittedA;
	return Number(b?.id || 0) - Number(a?.id || 0);
}

async function findOwnedMembership(membershipRef: unknown, tenantId: number | string, sportsProfileId: number) {
	const where = whereByParam(membershipRef);
	if (!where) {
		httpError(404, 'Club membership not found', 'CLUB_MEMBERSHIP_NOT_FOUND');
	}
	const row = await strapi.db.query(CLUB_MEMBERSHIP_UID).findOne({
		where: mergeTenantWhere({
			...where,
			sportsProfile: { id: { $eq: Number(sportsProfileId) } },
		}, tenantId),
		populate: {
			club: { select: ['id', 'documentId', 'code', 'name', 'shortName'], populate: { logo: { select: ['id', 'name', 'url', 'mime'] } } },
		},
	} as any);
	if (!row?.id) {
		httpError(404, 'Club membership not found', 'CLUB_MEMBERSHIP_NOT_FOUND');
	}
	return row;
}

async function findOwnedAchievement(achievementRef: unknown, tenantId: number | string, sportsProfileId: number) {
	const where = whereByParam(achievementRef);
	if (!where) {
		httpError(404, 'Sports achievement not found', 'SPORTS_ACHIEVEMENT_NOT_FOUND');
	}
	const row = await strapi.db.query(SPORTS_ACHIEVEMENT_UID).findOne({
		where: mergeTenantWhere({
			...where,
			sportsProfile: { id: { $eq: Number(sportsProfileId) } },
		}, tenantId),
		populate: {
			club: { select: ['id', 'documentId', 'code', 'name', 'shortName'], populate: { logo: { select: ['id', 'name', 'url', 'mime'] } } },
			evidence: { select: ['id', 'name', 'url', 'mime'] },
		},
	} as any);
	if (!row?.id) {
		httpError(404, 'Sports achievement not found', 'SPORTS_ACHIEVEMENT_NOT_FOUND');
	}
	return row;
}

async function findOwnedSubmission(submissionRef: unknown, tenantId: number | string, sportsProfileId: number) {
	const where = whereByParam(submissionRef);
	if (!where) {
		httpError(404, 'Sports achievement submission not found', 'SPORTS_ACHIEVEMENT_SUBMISSION_NOT_FOUND');
	}
	const row = await strapi.db.query(SPORTS_ACHIEVEMENT_SUBMISSION_UID).findOne({
		where: mergeTenantWhere({
			...where,
			sportsProfile: { id: { $eq: Number(sportsProfileId) } },
		}, tenantId),
		populate: {
			club: { select: ['id', 'documentId', 'code', 'name', 'shortName'], populate: { logo: { select: ['id', 'name', 'url', 'mime'] } } },
			achievement: { select: ['id', 'documentId', 'title', 'status', 'verifiedAt'] },
			evidence: { select: ['id', 'name', 'url', 'mime'] },
		},
	} as any);
	if (!row?.id) {
		httpError(404, 'Sports achievement submission not found', 'SPORTS_ACHIEVEMENT_SUBMISSION_NOT_FOUND');
	}
	return row;
}

export async function getMySportsProfile(tenantId: number | string, userId: number | string) {
	const profile = await resolveCurrentSportsProfile(tenantId, userId);
	return {
		profile: mapMySportsProfile(profile),
		summary: await countOverviewSummary(tenantId, Number(profile.id)),
	};
}

export async function updateMySportsProfile(tenantId: number | string, userId: number | string, payload: GenericRecord) {
	const current = await resolveCurrentSportsProfile(tenantId, userId);
	const sanitized = normalizeSelfUpdatePayload(payload || {});
	const updated = await updateTenantSportsProfile(current.id, sanitized, tenantId);
	return {
		profile: mapMySportsProfile(updated),
		summary: await countOverviewSummary(tenantId, Number(updated.id)),
	};
}

export async function uploadMySportsProfileAvatar(tenantId: number | string, userId: number | string, rawFiles: unknown) {
	await resolveCurrentSportsProfile(tenantId, userId);
	const uploadFile = resolveUploadFile(rawFiles);
	if (!uploadFile) {
		httpError(400, 'file is required', 'FILE_REQUIRED');
	}

	ensureAvatarFileValid(uploadFile);
	const uploadService = strapi.plugin('upload').service('upload');
	const uploadedFiles = await uploadService.upload({ data: {}, files: [uploadFile] });
	const uploaded = Array.isArray(uploadedFiles) ? uploadedFiles[0] : uploadedFiles;
	if (!uploaded?.id) {
		httpError(500, 'Không nhận được dữ liệu media sau khi upload', 'UPLOAD_FAILED');
	}

	return normalizeMedia(uploaded);
}

export async function listMyClubMemberships(tenantId: number | string, userId: number | string, query: Record<string, unknown> = {}) {
	const profile = await resolveCurrentSportsProfile(tenantId, userId);
	const status = toText(query.status).toLowerCase();
	if (status && !CLUB_MEMBERSHIP_STATUS_VALUES.has(status)) {
		httpError(400, 'status is invalid', 'INVALID_STATUS', { field: 'status' });
	}

	const rows = await strapi.db.query(CLUB_MEMBERSHIP_UID).findMany({
		where: mergeTenantWhere({
			sportsProfile: { id: { $eq: Number(profile.id) } },
			...(status ? { status: { $eq: status } } : {}),
		}, tenantId),
		populate: {
			club: { select: ['id', 'documentId', 'code', 'name', 'shortName'], populate: { logo: { select: ['id', 'name', 'url', 'mime'] } } },
		},
	} as any);

	return {
		rows: (rows || []).map((row: any) => mapMyClubMembership(row)).filter(Boolean).sort(compareMembershipRows),
	};
}

export async function getMyClubMembership(tenantId: number | string, userId: number | string, membershipRef: unknown) {
	const profile = await resolveCurrentSportsProfile(tenantId, userId);
	return mapMyClubMembership(await findOwnedMembership(membershipRef, tenantId, Number(profile.id)));
}

export async function listMyMembershipHistory(tenantId: number | string, userId: number | string, membershipRef: unknown) {
	const profile = await resolveCurrentSportsProfile(tenantId, userId);
	const membership = await findOwnedMembership(membershipRef, tenantId, Number(profile.id));
	const rows = await strapi.db.query(CLUB_MEMBERSHIP_HISTORY_UID).findMany({
		where: mergeTenantWhere({ membership: { id: { $eq: Number(membership.id) } } }, tenantId),
		orderBy: [{ eventAt: 'desc' }, { id: 'desc' }],
	} as any);
	return {
		membership: mapMyClubMembership(membership),
		rows: (rows || []).map((row: any) => mapMyMembershipHistory(row)).filter(Boolean),
	};
}

export async function listMyAchievements(tenantId: number | string, userId: number | string, query: Record<string, unknown> = {}) {
	const profile = await resolveCurrentSportsProfile(tenantId, userId);
	const status = toText(query.status).toLowerCase();
	if (status && status !== 'all' && !ACHIEVEMENT_STATUS_VALUES.has(status)) {
		httpError(400, 'status is invalid', 'INVALID_STATUS', { field: 'status' });
	}

	const rows = await strapi.db.query(SPORTS_ACHIEVEMENT_UID).findMany({
		where: mergeTenantWhere({
			sportsProfile: { id: { $eq: Number(profile.id) } },
			...(status && status !== 'all' ? { status: { $eq: status } } : !status ? { status: { $eq: 'active' } } : {}),
		}, tenantId),
		populate: {
			club: { select: ['id', 'documentId', 'code', 'name', 'shortName'], populate: { logo: { select: ['id', 'name', 'url', 'mime'] } } },
			evidence: { select: ['id', 'name', 'url', 'mime'] },
		},
	} as any);

	return {
		rows: (rows || []).map((row: any) => mapMyAchievement(row)).filter(Boolean).sort(compareAchievementRows),
	};
}

export async function getMyAchievement(tenantId: number | string, userId: number | string, achievementRef: unknown) {
	const profile = await resolveCurrentSportsProfile(tenantId, userId);
	return mapMyAchievement(await findOwnedAchievement(achievementRef, tenantId, Number(profile.id)));
}

export async function listMyAchievementSubmissions(tenantId: number | string, userId: number | string, query: Record<string, unknown> = {}) {
	const profile = await resolveCurrentSportsProfile(tenantId, userId);
	const status = toText(query.status).toLowerCase();
	if (status && status !== 'all' && !SUBMISSION_STATUS_VALUES.has(status)) {
		httpError(400, 'status is invalid', 'INVALID_STATUS', { field: 'status' });
	}

	const rows = await strapi.db.query(SPORTS_ACHIEVEMENT_SUBMISSION_UID).findMany({
		where: mergeTenantWhere({
			sportsProfile: { id: { $eq: Number(profile.id) } },
			...(status && status !== 'all' ? { status: { $eq: status } } : {}),
		}, tenantId),
		populate: {
			club: { select: ['id', 'documentId', 'code', 'name', 'shortName'], populate: { logo: { select: ['id', 'name', 'url', 'mime'] } } },
			achievement: { select: ['id', 'documentId', 'title', 'status', 'verifiedAt'] },
			evidence: { select: ['id', 'name', 'url', 'mime'] },
		},
	} as any);

	return {
		rows: (rows || []).map((row: any) => mapMySubmission(row)).filter(Boolean).sort(compareSubmissionRows),
	};
}

export async function getMyAchievementSubmission(tenantId: number | string, userId: number | string, submissionRef: unknown) {
	const profile = await resolveCurrentSportsProfile(tenantId, userId);
	return mapMySubmission(await findOwnedSubmission(submissionRef, tenantId, Number(profile.id)));
}

export function handleSportsMeError(ctx: any, error: any) {
	if (error instanceof SportsMeError) {
		ctx.status = error.status;
		ctx.body = {
			error: {
				status: error.status,
				name: 'SportsMeError',
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

	strapi.log.error('[sports-me] unexpected error', error);
	ctx.internalServerError('Failed to process sports me request');
}

export default {
	getMySportsProfile,
	updateMySportsProfile,
	uploadMySportsProfileAvatar,
	listMyClubMemberships,
	getMyClubMembership,
	listMyMembershipHistory,
	listMyAchievements,
	getMyAchievement,
	listMyAchievementSubmissions,
	getMyAchievementSubmission,
	handleSportsMeError,
};