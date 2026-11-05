import fs from 'node:fs/promises';
import XLSX from 'xlsx';
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
import {
  createTenantSportsAchievementTemplate,
  getTenantSportsAchievementTemplate,
  listEligibleAchievementTemplatesForEntity,
  listTenantSportsAchievementTemplates,
  resolveAchievementTemplateForEntity,
  updateTenantSportsAchievementTemplate,
} from '../../sports-achievement-template/services/sports-achievement-template';
import { updateTenantSportsAchievement } from '../../sports-achievement/services/sports-achievement';
import { createTenantSportsProfile } from '../../sports-profile/services/sports-profile';
import { listTenantSportsProfiles } from '../../sports-profile/services/sports-profile';
import { mergeTenantWhere, toPositiveInt, toText, whereByParam } from '../../../utils/tenant-scope';
import storageService from '../../../services/storage-service';

const SPORTS_CLUB_UID = 'api::sports-club.sports-club' as any;
const CLUB_MEMBERSHIP_UID = 'api::club-membership.club-membership' as any;
const SPORTS_PROFILE_UID = 'api::sports-profile.sports-profile' as any;
const SPORTS_ACHIEVEMENT_UID = 'api::sports-achievement.sports-achievement' as any;
const SPORTS_ACHIEVEMENT_SUBMISSION_UID = 'api::sports-achievement-submission.sports-achievement-submission' as any;
const TENANT_UID = 'api::tenant.tenant' as any;
const TEMPLATE_ASSET_ALLOWED_MIME_TYPES = new Set(['image/jpeg', 'image/jpg', 'image/png', 'image/webp']);
const TEMPLATE_ASSET_MAX_BYTES = 20 * 1024 * 1024;
const CLUB_MEMBERSHIP_IMPORT_MAX_ROWS = 1000;
const CLUB_MEMBERSHIP_IMPORT_TEMPLATE_FIELDS = [
	'memberCode',
	'profileCode',
	'joinedAt',
	'role',
	'title',
	'status',
	'source',
	'sourceRef',
];
const CLUB_MEMBERSHIP_STATUS_VALUES = new Set(['pending', 'active', 'inactive', 'left', 'suspended', 'rejected']);
const CLUB_MEMBERSHIP_SOURCE_VALUES = new Set(['manual_import', 'self_registration', 'campaign', 'invite', 'admin_created', 'other']);
const CLUB_MEMBERSHIP_IMPORT_FIELD_ALIASES: Record<string, string[]> = {
	memberCode: ['membercode', 'member_code', 'member code', 'ma thanh vien', 'mã thành viên'],
	profileCode: ['profilecode', 'profile_code', 'profile code', 'sportsprofilecode', 'sports_profile_code', 'ma ho so', 'mã hồ sơ', 'code'],
	joinedAt: ['joinedat', 'joined_at', 'joined at', 'join date', 'ngay gia nhap', 'ngày gia nhập'],
	role: ['role', 'vai tro', 'vai trò'],
	title: ['title', 'positiontitle', 'position_title', 'position title', 'chuc vu', 'chức vụ'],
	status: ['status', 'trang thai', 'trạng thái'],
	source: ['source', 'nguon', 'nguồn'],
	sourceRef: ['sourceref', 'source_ref', 'source ref', 'source reference', 'source_reference', 'ref'],
};
const ACHIEVEMENT_IMPORT_MAX_ROWS = 1000;
const ACHIEVEMENT_IMPORT_TEMPLATE_FIELDS = [
	'profileCode',
	'eventCode',
	'eventName',
	'bib',
	'distance',
	'raceType',
	'finishTime',
	'achievedAt',
	'title',
	'sourceRef',
	'note',
];
const ACHIEVEMENT_IMPORT_FIELD_ALIASES: Record<string, string[]> = {
	profileCode: ['profilecode', 'profile_code', 'profile code', 'ma ho so', 'mã hồ sơ', 'code'],
	eventCode: ['eventcode', 'event_code', 'event code', 'racecode', 'race_code'],
	eventName: ['eventname', 'event_name', 'event name', 'race name', 'giai chay', 'giải chạy'],
	bib: ['bib', 'bibnumber', 'bib_number', 'bib number', 'so bib', 'số bib'],
	distance: ['distance', 'cu ly', 'cự ly', 'distancekm', 'distance_km'],
	raceType: ['racetype', 'race_type', 'race type', 'loai giai', 'loại giải'],
	finishTime: ['finishtime', 'finish_time', 'finish time', 'time', 'ket qua', 'kết quả'],
	achievedAt: ['achievedat', 'achieved_at', 'achieved at', 'race date', 'ngay thi dau', 'ngày thi đấu'],
	title: ['title', 'tieu de', 'tiêu đề'],
	sourceRef: ['sourceref', 'source_ref', 'source ref', 'source reference', 'source_reference', 'ref'],
	note: ['note', 'ghi chu', 'ghi chú'],
};

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
	const providerMetadata = media.provider_metadata && typeof media.provider_metadata === 'object'
		? media.provider_metadata
		: (media.providerMetadata && typeof media.providerMetadata === 'object' ? media.providerMetadata : null);
	return {
		id: Number(media.id),
		fileAssetId: Number(providerMetadata?.bridgedFromFileAssetId || 0) || null,
		name: toText(media.name) || null,
		provider: toText(media.provider) || null,
		url: toText(media.url) || null,
		mime: toText(media.mime) || null,
	};
}

function resolveUploadFile(rawFiles: any) {
	if (!rawFiles) return null;
	if (Array.isArray(rawFiles)) return rawFiles.find((item) => item && typeof item === 'object') || null;
	return rawFiles;
}

function getUploadMimeType(file: any): string {
	const direct = toText(file?.type || file?.mimetype || file?.mime || '').toLowerCase();
	if (direct) return direct;
	const fileName = toText(file?.originalFilename || file?.newFilename || file?.name).toLowerCase();
	if (fileName.endsWith('.jpg') || fileName.endsWith('.jpeg')) return 'image/jpeg';
	if (fileName.endsWith('.png')) return 'image/png';
	if (fileName.endsWith('.webp')) return 'image/webp';
	return '';
}

function getUploadFileSize(file: any): number {
	const size = Number(file?.size ?? file?.bytes ?? file?.byteLength ?? 0);
	return Number.isFinite(size) ? Math.max(0, size) : 0;
}

function mapTemplateAssetUpload(fileAsset: any) {
	if (!fileAsset?.id) return null;
	return {
		id: Number(fileAsset.id),
		code: toText(fileAsset.code) || null,
		moduleKey: toText(fileAsset.moduleKey) || null,
		originalName: toText(fileAsset.originalName) || null,
		fileName: toText(fileAsset.fileName) || null,
		mimeType: toText(fileAsset.mimeType) || null,
		size: Number(fileAsset.size || 0) || 0,
		provider: toText(fileAsset.provider) || null,
		url: toText(fileAsset.url) || null,
		status: toText(fileAsset.status) || null,
		isDeleted: Boolean(fileAsset.isDeleted),
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
			logo: { select: ['id', 'name', 'url', 'mime', 'provider', 'provider_metadata'] },
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

function normalizeImportKey(value: unknown): string {
	return toText(value).trim().toLowerCase().replace(/[^a-z0-9]+/g, '');
}

function getImportColumnValue(row: Record<string, unknown>, aliases: string[]) {
	const normalizedAliases = new Set(aliases.map((alias) => normalizeImportKey(alias)));
	for (const [key, value] of Object.entries(row || {})) {
		if (normalizedAliases.has(normalizeImportKey(key))) return value;
	}
	return null;
}

function normalizeImportText(value: unknown): string {
	return toText(value).replace(/\s+/g, ' ').trim();
}

function normalizeImportMemberCode(value: unknown): string {
	return normalizeImportText(value).toUpperCase();
}

function normalizeImportProfileCode(value: unknown): string {
	return normalizeImportText(value).toUpperCase();
}

function normalizeImportStatus(value: unknown): 'pending' | 'active' | 'inactive' | 'left' | 'suspended' | 'rejected' | null {
	const text = normalizeImportText(value).toLowerCase();
	if (!text) return null;
	if (['pending'].includes(text)) return 'pending';
	if (['active', 'dang hoat dong', 'đang hoạt động', 'enabled', '1'].includes(text)) return 'active';
	if (['inactive', 'ngung hoat dong', 'ngừng hoạt động', 'disabled', '0'].includes(text)) return 'inactive';
	if (['left', 'roi clb', 'rời clb', 'da roi', 'đã rời'].includes(text)) return 'left';
	if (['suspended', 'tam dung', 'tạm dừng'].includes(text)) return 'suspended';
	if (['rejected', 'tu choi', 'từ chối'].includes(text)) return 'rejected';
	return null;
}

function normalizeImportSource(value: unknown): 'manual_import' | 'self_registration' | 'campaign' | 'invite' | 'admin_created' | 'other' | null {
	const text = normalizeImportText(value).toLowerCase();
	if (!text) return null;
	if (['manual_import', 'manual-import', 'manual import', 'import', 'excel'].includes(text)) return 'manual_import';
	if (['self_registration', 'self-registration', 'self registration', 'self register'].includes(text)) return 'self_registration';
	if (['campaign'].includes(text)) return 'campaign';
	if (['invite'].includes(text)) return 'invite';
	if (['admin_created', 'admin-created', 'admin created'].includes(text)) return 'admin_created';
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
	if (/^\d{4}-\d{2}-\d{2}$/.test(text)) {
		const parsed = new Date(`${text}T00:00:00Z`);
		return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString().slice(0, 10);
	}
	if (/^\d{1,2}[/-]\d{1,2}[/-]\d{2,4}$/.test(text)) {
		const normalized = text.replace(/\//g, '-');
		const parsed = new Date(normalized);
		return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString().slice(0, 10);
	}
	const parsed = new Date(text);
	return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString().slice(0, 10);
}

function getUploadedFilePath(file: any): string {
	return toText(file?.filepath || file?.path || file?.tempFilePath);
}

async function readUploadedFileBuffer(file: any): Promise<Buffer> {
	if (file?.buffer && Buffer.isBuffer(file.buffer)) return file.buffer;
	if (file?.data && Buffer.isBuffer(file.data)) return file.data;
	const filePath = getUploadedFilePath(file);
	if (!filePath) {
		httpError(400, 'Excel file content is required', 'CLUB_MEMBERSHIP_IMPORT_INVALID_FILE');
	}
	return fs.readFile(filePath);
}

async function readClubMembershipImportWorksheet(file: any) {
	if (!file) {
		httpError(400, 'Excel file is required', 'CLUB_MEMBERSHIP_IMPORT_INVALID_FILE');
	}
	const buffer = await readUploadedFileBuffer(file);
	const workbook = XLSX.read(buffer, { type: 'buffer', cellDates: true, raw: false });
	const sheetNames = workbook?.SheetNames || [];
	const preferredName = sheetNames.find((name) => normalizeImportKey(name) === 'clubmemberships');
	const worksheet = preferredName ? workbook.Sheets[preferredName] : workbook.Sheets[sheetNames[0]];
	if (!worksheet) {
		httpError(400, 'The uploaded Excel file does not contain a valid worksheet', 'CLUB_MEMBERSHIP_IMPORT_INVALID_FILE');
	}
	const rows = XLSX.utils.sheet_to_json(worksheet, { defval: '', raw: false, blankrows: false }) as Record<string, unknown>[];
	if (rows.length > CLUB_MEMBERSHIP_IMPORT_MAX_ROWS) {
		httpError(400, `Excel file exceeds the maximum ${CLUB_MEMBERSHIP_IMPORT_MAX_ROWS} rows`, 'CLUB_MEMBERSHIP_IMPORT_TOO_LARGE');
	}
	return rows;
}

async function readAchievementImportWorksheet(file: any) {
	if (!file) {
		httpError(400, 'Excel file is required', 'ACHIEVEMENT_IMPORT_INVALID_FILE');
	}
	const buffer = await readUploadedFileBuffer(file);
	const workbook = XLSX.read(buffer, { type: 'buffer', cellDates: true, raw: false });
	const sheetNames = workbook?.SheetNames || [];
	const preferredName = sheetNames.find((name) => normalizeImportKey(name) === 'achievements');
	const worksheet = preferredName ? workbook.Sheets[preferredName] : workbook.Sheets[sheetNames[0]];
	if (!worksheet) {
		httpError(400, 'The uploaded Excel file does not contain a valid worksheet', 'ACHIEVEMENT_IMPORT_INVALID_FILE');
	}
	const rows = XLSX.utils.sheet_to_json(worksheet, { defval: '', raw: false, blankrows: false }) as Record<string, unknown>[];
	if (rows.length > ACHIEVEMENT_IMPORT_MAX_ROWS) {
		httpError(400, `Excel file exceeds the maximum ${ACHIEVEMENT_IMPORT_MAX_ROWS} rows`, 'ACHIEVEMENT_IMPORT_TOO_LARGE');
	}
	return rows;
}

function buildClubMembershipImportRecord(rawRow: Record<string, unknown>) {
	return {
		memberCode: normalizeImportMemberCode(getImportColumnValue(rawRow, CLUB_MEMBERSHIP_IMPORT_FIELD_ALIASES.memberCode) ?? rawRow.memberCode),
		profileCode: normalizeImportProfileCode(getImportColumnValue(rawRow, CLUB_MEMBERSHIP_IMPORT_FIELD_ALIASES.profileCode) ?? rawRow.profileCode),
		joinedAt: parseImportDate(getImportColumnValue(rawRow, CLUB_MEMBERSHIP_IMPORT_FIELD_ALIASES.joinedAt) ?? rawRow.joinedAt),
		role: normalizeImportText(getImportColumnValue(rawRow, CLUB_MEMBERSHIP_IMPORT_FIELD_ALIASES.role) ?? rawRow.role),
		title: normalizeImportText(getImportColumnValue(rawRow, CLUB_MEMBERSHIP_IMPORT_FIELD_ALIASES.title) ?? rawRow.title ?? rawRow.positionTitle),
		status: normalizeImportStatus(getImportColumnValue(rawRow, CLUB_MEMBERSHIP_IMPORT_FIELD_ALIASES.status) ?? rawRow.status),
		source: normalizeImportSource(getImportColumnValue(rawRow, CLUB_MEMBERSHIP_IMPORT_FIELD_ALIASES.source) ?? rawRow.source),
		sourceRef: normalizeImportText(getImportColumnValue(rawRow, CLUB_MEMBERSHIP_IMPORT_FIELD_ALIASES.sourceRef) ?? rawRow.sourceRef ?? rawRow.sourceReference),
	};
}

function normalizeAchievementImportStrategy(value: unknown): 'auto_event_bib' | 'excel_title' {
	const text = normalizeImportText(value).toLowerCase();
	if (text === 'excel_title' || text === 'excel-title' || text === 'title') return 'excel_title';
	return 'auto_event_bib';
}

function normalizeAchievementImportMode(value: unknown): 'verify_now' | 'submission' {
	const text = normalizeImportText(value).toLowerCase();
	if (text === 'submission' || text === 'pending' || text === 'wait_verify' || text === 'wait-verify' || text === 'cho_xac_minh') return 'submission';
	return 'verify_now';
}

function parseAchievementImportDateTime(value: unknown): string | null {
	if (value === null || value === undefined || value === '') return null;
	if (value instanceof Date) {
		if (Number.isNaN(value.getTime())) return null;
		return value.toISOString();
	}
	if (typeof value === 'number') {
		const asDate = new Date(Date.UTC(1899, 11, 30 + value));
		if (!Number.isNaN(asDate.getTime())) return asDate.toISOString();
		return null;
	}
	const text = normalizeImportText(value);
	if (!text) return null;
	if (/^\d{4}-\d{2}-\d{2}$/.test(text)) {
		const parsed = new Date(`${text}T12:00:00`);
		return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
	}
	const parsed = new Date(text.replace(' ', 'T'));
	return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

function parseAchievementImportDuration(value: unknown): number | null {
	const text = normalizeImportText(value);
	if (!text) return null;
	const match = text.match(/^(\d+):([0-5]?\d)(?::([0-5]?\d))?$/);
	if (!match) return null;
	const hours = Number(match[1]);
	const minutes = Number(match[2]);
	const seconds = Number(match[3] || 0);
	if (!Number.isInteger(hours) || !Number.isInteger(minutes) || !Number.isInteger(seconds)) return null;
	return (hours * 3600) + (minutes * 60) + seconds;
}

function parseAchievementImportDistance(distanceValue: unknown, raceTypeValue: unknown): number | null {
	const raw = normalizeImportText(distanceValue || raceTypeValue).toLowerCase();
	if (!raw) return null;
	if (raw === 'fm' || raw === 'marathon' || raw === '42k' || raw === '42.195') return 42.195;
	if (raw === 'hm' || raw === 'half marathon' || raw === '21k' || raw === '21.0975') return 21.0975;
	if (raw === '10k' || raw === '10km' || raw === '10') return 10;
	if (raw === '5k' || raw === '5km' || raw === '5') return 5;
	const numericText = raw.replace(/km$/i, '').trim();
	const parsed = Number(numericText);
	if (!Number.isFinite(parsed) || parsed <= 0) return null;
	return Number(parsed.toFixed(3));
}

function detectAchievementImportRaceType(eventCodeValue: unknown, eventNameValue: unknown, raceTypeValue: unknown): 'road' | 'trail' | 'track' | 'virtual' | 'other' | null {
	const explicit = normalizeImportText(raceTypeValue).toLowerCase();
	if (explicit) {
		if (['trail', 'trail running', 'mountain', 'mountain marathon'].includes(explicit)) return 'trail';
		if (['road', 'road running'].includes(explicit)) return 'road';
		if (['track'].includes(explicit)) return 'track';
		if (['virtual'].includes(explicit)) return 'virtual';
		return 'other';
	}
	const fingerprint = `${normalizeImportText(eventCodeValue)} ${normalizeImportText(eventNameValue)}`.toLowerCase();
	if (fingerprint.includes('vmm') || fingerprint.includes('vietnam mountain marathon')) return 'trail';
	return null;
}

function buildAchievementImportRecord(rawRow: Record<string, unknown>) {
	return {
		profileCode: normalizeImportProfileCode(getImportColumnValue(rawRow, ACHIEVEMENT_IMPORT_FIELD_ALIASES.profileCode) ?? rawRow.profileCode),
		eventCode: normalizeImportText(getImportColumnValue(rawRow, ACHIEVEMENT_IMPORT_FIELD_ALIASES.eventCode) ?? rawRow.eventCode).toUpperCase(),
		eventName: normalizeImportText(getImportColumnValue(rawRow, ACHIEVEMENT_IMPORT_FIELD_ALIASES.eventName) ?? rawRow.eventName),
		raceTypeNormalized: detectAchievementImportRaceType(
			getImportColumnValue(rawRow, ACHIEVEMENT_IMPORT_FIELD_ALIASES.eventCode) ?? rawRow.eventCode,
			getImportColumnValue(rawRow, ACHIEVEMENT_IMPORT_FIELD_ALIASES.eventName) ?? rawRow.eventName,
			getImportColumnValue(rawRow, ACHIEVEMENT_IMPORT_FIELD_ALIASES.raceType) ?? rawRow.raceType,
		),
		bib: normalizeImportText(getImportColumnValue(rawRow, ACHIEVEMENT_IMPORT_FIELD_ALIASES.bib) ?? rawRow.bib),
		distance: parseAchievementImportDistance(
			getImportColumnValue(rawRow, ACHIEVEMENT_IMPORT_FIELD_ALIASES.distance) ?? rawRow.distance,
			getImportColumnValue(rawRow, ACHIEVEMENT_IMPORT_FIELD_ALIASES.raceType) ?? rawRow.raceType,
		),
		raceType: normalizeImportText(getImportColumnValue(rawRow, ACHIEVEMENT_IMPORT_FIELD_ALIASES.raceType) ?? rawRow.raceType),
		finishTime: parseAchievementImportDuration(getImportColumnValue(rawRow, ACHIEVEMENT_IMPORT_FIELD_ALIASES.finishTime) ?? rawRow.finishTime),
		achievedAt: parseAchievementImportDateTime(getImportColumnValue(rawRow, ACHIEVEMENT_IMPORT_FIELD_ALIASES.achievedAt) ?? rawRow.achievedAt),
		title: normalizeImportText(getImportColumnValue(rawRow, ACHIEVEMENT_IMPORT_FIELD_ALIASES.title) ?? rawRow.title),
		sourceRef: normalizeImportText(getImportColumnValue(rawRow, ACHIEVEMENT_IMPORT_FIELD_ALIASES.sourceRef) ?? rawRow.sourceRef ?? rawRow.sourceReference),
		note: normalizeImportText(getImportColumnValue(rawRow, ACHIEVEMENT_IMPORT_FIELD_ALIASES.note) ?? rawRow.note),
	};
}

function buildAchievementImportTitle(record: Record<string, any>, titleStrategy: 'auto_event_bib' | 'excel_title'): string | null {
	if (titleStrategy === 'excel_title') {
		return normalizeImportText(record.title);
	}
	if (record.eventCode && record.bib) return `${record.eventCode}-${record.bib}`;
	if (record.eventCode) return record.eventCode;
	if (record.eventName && record.bib) return `${record.eventName} - ${record.bib}`;
	if (record.eventName) return record.eventName;
	return null;
}

function buildAchievementImportDescription(record: Record<string, any>): string | null {
	const parts = [];
	if (record.eventName) parts.push(`Event: ${record.eventName}`);
	if (record.raceType) parts.push(`Race type: ${record.raceType}`);
	return parts.length > 0 ? parts.join('\n') : null;
}

function buildAchievementDuplicateSignature(record: Record<string, any>): string | null {
	if (record.sourceRef) return `import|${record.sourceRef.toUpperCase()}`;
	if (!record.eventCode || !record.achievedAt) return null;
	if (record.distance === null || record.distance === undefined) {
		if (!record.bib) return null;
		return [
			'composite-no-distance',
			record.eventCode.toUpperCase(),
			String(record.achievedAt).slice(0, 19),
			normalizeImportText(record.bib).toUpperCase() || '-',
		].join('|');
	}
	return [
		'composite',
		record.eventCode.toUpperCase(),
		String(record.distance),
		String(record.achievedAt).slice(0, 19),
		normalizeImportText(record.bib).toUpperCase() || '-',
		String(record.finishTime || 0),
	].join('|');
}

function computeAchievementImportSummary(rows: any[]) {
	return rows.reduce((summary, row) => {
		summary.totalRows += 1;
		if (row.status === 'CREATE') summary.createCount += 1;
		if (row.status === 'DUPLICATE') summary.duplicateCount += 1;
		if (row.status === 'WARNING') summary.warningCount += 1;
		if (row.status === 'ERROR') summary.errorCount += 1;
		return summary;
	}, {
		totalRows: 0,
		createCount: 0,
		duplicateCount: 0,
		warningCount: 0,
		errorCount: 0,
	});
}

function computeClubMembershipImportSummary(rows: any[]) {
	const summary = {
		totalRows: rows.length,
		createCount: 0,
		updateCount: 0,
		unchangedCount: 0,
		warningCount: 0,
		errorCount: 0,
	};
	for (const row of rows) {
		if (row.status === 'CREATE') summary.createCount += 1;
		if (row.status === 'UPDATE') summary.updateCount += 1;
		if (row.status === 'UNCHANGED') summary.unchangedCount += 1;
		if (row.status === 'WARNING') summary.warningCount += 1;
		if (row.status === 'ERROR') summary.errorCount += 1;
	}
	return summary;
}

async function findSportsProfileByCodeInTenant(tenantId: number | string, profileCode: string) {
	if (!profileCode) return null;
	return await strapi.db.query(SPORTS_PROFILE_UID).findOne({
		where: mergeTenantWhere({ code: { $eq: profileCode } }, tenantId),
		select: ['id', 'documentId', 'code', 'fullName', 'displayName', 'gender', 'dateOfBirth', 'birthYear', 'contactPhone', 'contactEmail'],
		populate: { avatar: { select: ['id', 'name', 'url', 'mime'] } },
	} as any);
}

async function findMembershipSummaryByProfileInClub(tenantId: number | string, clubId: number, sportsProfileId: number) {
	const row = await strapi.db.query(CLUB_MEMBERSHIP_UID).findOne({
		where: mergeTenantWhere({
			club: { id: { $eq: clubId } },
			sportsProfile: { id: { $eq: sportsProfileId } },
		}, tenantId),
		select: ['id', 'documentId', 'memberCode', 'oldMemberCode', 'status', 'role', 'positionTitle', 'joinedAt', 'leftAt', 'source', 'sourceReference', 'updatedAt'],
		populate: {
			sportsProfile: { select: ['id', 'documentId', 'code', 'fullName', 'displayName', 'gender', 'dateOfBirth', 'birthYear', 'contactPhone', 'contactEmail'], populate: { avatar: { select: ['id', 'name', 'url', 'mime'] } } },
			club: { select: ['id', 'documentId', 'code', 'name', 'shortName'], populate: { logo: { select: ['id', 'name', 'url', 'mime', 'provider', 'provider_metadata'] } } },
			approvedBy: { select: ['id', 'documentId', 'username', 'email', 'fullName'] },
		},
	} as any);
	return row?.id ? row : null;
}

async function findMembershipSummaryByMemberCodeInClub(clubId: number, memberCode: string) {
	if (!memberCode) return null;
	const row = await strapi.db.query(CLUB_MEMBERSHIP_UID).findOne({
		where: {
			club: { id: { $eq: clubId } },
			memberCode: { $eq: memberCode },
		},
		select: ['id', 'documentId', 'memberCode', 'status'],
		populate: {
			sportsProfile: { select: ['id', 'documentId', 'code', 'fullName'] },
		},
	} as any);
	return row?.id ? row : null;
}

function summarizeSportsProfileForImport(profile: any) {
	if (!profile?.id) return null;
	return {
		id: Number(profile.id),
		documentId: profile.documentId || null,
		code: toText(profile.code) || null,
		fullName: toText(profile.fullName) || null,
		displayName: toText(profile.displayName) || null,
		contactPhone: toText(profile.contactPhone) || null,
		contactEmail: toText(profile.contactEmail) || null,
	};
}

function summarizeManagedMembershipForImport(membership: any) {
	if (!membership?.id) return null;
	return {
		id: Number(membership.id),
		documentId: membership.documentId || null,
		memberCode: toText(membership.memberCode) || null,
		status: toText(membership.status) || null,
		role: toText(membership.role) || null,
		positionTitle: toText(membership.positionTitle) || null,
		joinedAt: membership.joinedAt || null,
		source: toText(membership.source) || null,
		sourceReference: toText(membership.sourceReference) || null,
		sportsProfile: summarizeSportsProfileForImport(membership.sportsProfile),
	};
}

function buildClubMembershipImportPayload(params: {
	record: Record<string, any>;
	existingMembership?: any;
}) {
	const { record, existingMembership } = params;
	const payload: Record<string, unknown> = {};
	const warnings: string[] = [];
	const blockingWarnings: string[] = [];
	const changes: Array<{ field: string; currentValue: unknown; nextValue: unknown }> = [];
	const currentStatus = toText(existingMembership?.status).toLowerCase() || null;

	if (record.role) {
		warnings.push('role is ignored by import policy and will not be changed');
	}

	if (record.memberCode) {
		const currentMemberCode = normalizeImportMemberCode(existingMembership?.memberCode);
		if (!existingMembership?.id || !currentMemberCode) {
			payload.memberCode = record.memberCode;
			if (record.memberCode !== currentMemberCode) {
				changes.push({ field: 'memberCode', currentValue: currentMemberCode || null, nextValue: record.memberCode });
			}
		} else if (currentMemberCode !== record.memberCode) {
			blockingWarnings.push(`memberCode conflict: current membership already uses "${currentMemberCode}" and import requested "${record.memberCode}"`);
		}
	}

	if (record.joinedAt) {
		const currentJoinedAt = existingMembership?.joinedAt || null;
		if (currentJoinedAt !== record.joinedAt) {
			payload.joinedAt = record.joinedAt;
			changes.push({ field: 'joinedAt', currentValue: currentJoinedAt, nextValue: record.joinedAt });
			warnings.push(`joinedAt will change from "${currentJoinedAt || '-'}" to "${record.joinedAt}"`);
		}
	}

	if (record.title) {
		const currentTitle = toText(existingMembership?.positionTitle) || null;
		if (currentTitle !== record.title) {
			payload.positionTitle = record.title;
			changes.push({ field: 'positionTitle', currentValue: currentTitle, nextValue: record.title });
		}
	}

	if (record.status) {
		const current = currentStatus || null;
		if (current !== record.status) {
			if ((current === 'inactive' || current === 'left') && record.status === 'active') {
				blockingWarnings.push(`status conflict: import cannot automatically reactivate a membership from "${current}" to "active"`);
			} else {
				payload.status = record.status;
				changes.push({ field: 'status', currentValue: current, nextValue: record.status });
			}
		}
	}

	if (record.source) {
		const currentSource = toText(existingMembership?.source) || null;
		if (currentSource !== record.source) {
			payload.source = record.source;
			changes.push({ field: 'source', currentValue: currentSource, nextValue: record.source });
		}
	}

	if (record.sourceRef) {
		const currentSourceRef = toText(existingMembership?.sourceReference) || null;
		if (currentSourceRef !== record.sourceRef) {
			payload.sourceReference = record.sourceRef;
			changes.push({ field: 'sourceReference', currentValue: currentSourceRef, nextValue: record.sourceRef });
		}
	}

	return {
		payload,
		changes,
		warnings,
		blockingWarnings,
	};
}

function summarizeAchievementForImport(row: any) {
	if (!row?.id) return null;
	return {
		id: Number(row.id),
		documentId: row.documentId || null,
		title: toText(row.title) || null,
		eventCode: toText(row.eventCode) || null,
		raceType: toText(row.raceType) || null,
		bib: toText(row.bib) || null,
		distancePending: Boolean(row.distancePending),
		achievementType: toText(row.achievementType) || null,
		sportType: toText(row.sportType) || null,
		achievedAt: row.achievedAt || null,
		distanceKm: row.distanceKm === null || row.distanceKm === undefined || row.distanceKm === '' ? null : Number(row.distanceKm),
		durationSeconds: row.durationSeconds === null || row.durationSeconds === undefined || row.durationSeconds === '' ? null : Number(row.durationSeconds),
		resultText: toText(row.resultText) || null,
		source: toText(row.source) || null,
		sourceReference: toText(row.sourceReference) || null,
		status: toText(row.status) || null,
		sportsProfile: summarizeSportsProfileForImport(row.sportsProfile),
	};
}

function summarizeSubmissionForImport(row: any) {
	if (!row?.id) return null;
	return {
		id: Number(row.id),
		documentId: row.documentId || null,
		title: toText(row.title) || null,
		eventCode: toText(row.eventCode) || null,
		raceType: toText(row.raceType) || null,
		bib: toText(row.bib) || null,
		distancePending: Boolean(row.distancePending),
		achievementType: toText(row.achievementType) || null,
		sportType: toText(row.sportType) || null,
		achievedAt: row.achievedAt || null,
		distanceKm: row.distanceKm === null || row.distanceKm === undefined || row.distanceKm === '' ? null : Number(row.distanceKm),
		durationSeconds: row.durationSeconds === null || row.durationSeconds === undefined || row.durationSeconds === '' ? null : Number(row.durationSeconds),
		resultText: toText(row.resultText) || null,
		source: toText(row.source) || null,
		sourceReference: toText(row.sourceReference) || null,
		status: toText(row.status) || null,
		sportsProfile: summarizeSportsProfileForImport(row.sportsProfile),
	};
}

async function findMembershipForAchievementImport(tenantId: number | string, clubId: number, sportsProfileId: number) {
	return await strapi.db.query(CLUB_MEMBERSHIP_UID).findOne({
		where: mergeTenantWhere({
			club: { id: { $eq: Number(clubId) } },
			sportsProfile: { id: { $eq: Number(sportsProfileId) } },
		}, tenantId),
		select: ['id', 'documentId', 'memberCode', 'status', 'joinedAt', 'leftAt'],
	} as any);
}

function buildAchievementImportSourceReference(record: Record<string, any>) {
	if (record.sourceRef) return record.sourceRef;
	const signature = buildAchievementDuplicateSignature(record);
	return signature ? `AUTO:${signature}` : null;
}

async function findPotentialAchievementDuplicates(params: {
	tenantId: number | string;
	clubId: number;
	sportsProfileId: number;
	sourceReference?: string | null;
	eventCode?: string | null;
	bib?: string | null;
	achievedAt?: string | null;
	distanceKm?: number | null;
	durationSeconds?: number | null;
}) {
	const {
		tenantId,
		clubId,
		sportsProfileId,
		sourceReference,
		eventCode,
		bib,
		achievedAt,
		distanceKm,
		durationSeconds,
	} = params;
	const activeAchievementStatuses = ['active'];
	const duplicateAchievements: any[] = [];
	const duplicateSubmissions: any[] = [];

	if (sourceReference) {
		const [achievementRows, submissionRows] = await Promise.all([
			strapi.db.query(SPORTS_ACHIEVEMENT_UID).findMany({
				where: mergeTenantWhere({
					club: { id: { $eq: Number(clubId) } },
					sportsProfile: { id: { $eq: Number(sportsProfileId) } },
					sourceReference: { $eq: sourceReference },
					status: { $in: activeAchievementStatuses },
				}, tenantId),
				populate: { sportsProfile: { select: ['id', 'documentId', 'code', 'fullName', 'displayName', 'contactPhone', 'contactEmail'] } },
			} as any),
			strapi.db.query(SPORTS_ACHIEVEMENT_SUBMISSION_UID).findMany({
				where: mergeTenantWhere({
					club: { id: { $eq: Number(clubId) } },
					sportsProfile: { id: { $eq: Number(sportsProfileId) } },
					sourceReference: { $eq: sourceReference },
					status: { $in: ['draft', 'submitted', 'verified'] },
				}, tenantId),
				populate: { sportsProfile: { select: ['id', 'documentId', 'code', 'fullName', 'displayName', 'contactPhone', 'contactEmail'] } },
			} as any),
		]);
		duplicateAchievements.push(...(achievementRows || []));
		duplicateSubmissions.push(...(submissionRows || []));
	}

	if (duplicateAchievements.length === 0 && duplicateSubmissions.length === 0 && eventCode && achievedAt) {
		if ((distanceKm === null || distanceKm === undefined) && !bib) {
			return {
				achievements: [],
				submissions: [],
			};
		}
		const baseWhere: Record<string, unknown> = {
			club: { id: { $eq: Number(clubId) } },
			sportsProfile: { id: { $eq: Number(sportsProfileId) } },
			eventCode: { $eq: eventCode },
			achievedAt: { $eq: achievedAt },
			...(bib ? { bib: { $eq: bib } } : {}),
			...(durationSeconds ? { durationSeconds: { $eq: durationSeconds } } : {}),
		};
		if (distanceKm !== null && distanceKm !== undefined) {
			baseWhere.distanceKm = { $eq: distanceKm };
		} else {
			baseWhere.distancePending = { $eq: true };
		}
		const [achievementRows, submissionRows] = await Promise.all([
			strapi.db.query(SPORTS_ACHIEVEMENT_UID).findMany({
				where: mergeTenantWhere({
					...baseWhere,
					status: { $in: activeAchievementStatuses },
				}, tenantId),
				populate: { sportsProfile: { select: ['id', 'documentId', 'code', 'fullName', 'displayName', 'contactPhone', 'contactEmail'] } },
			} as any),
			strapi.db.query(SPORTS_ACHIEVEMENT_SUBMISSION_UID).findMany({
				where: mergeTenantWhere({
					...baseWhere,
					status: { $in: ['draft', 'submitted', 'verified'] },
				}, tenantId),
				populate: { sportsProfile: { select: ['id', 'documentId', 'code', 'fullName', 'displayName', 'contactPhone', 'contactEmail'] } },
			} as any),
		]);
		duplicateAchievements.push(...(achievementRows || []));
		duplicateSubmissions.push(...(submissionRows || []));
	}

	return {
		achievements: duplicateAchievements.map((row) => summarizeAchievementForImport(row)),
		submissions: duplicateSubmissions.map((row) => summarizeSubmissionForImport(row)),
	};
}

function buildAchievementImportPayload(params: {
	record: Record<string, any>;
	clubId: number;
	sportsProfileId: number;
	titleStrategy: 'auto_event_bib' | 'excel_title';
	processingMode: 'verify_now' | 'submission';
}) {
	const { record, clubId, sportsProfileId, titleStrategy, processingMode } = params;
	const title = buildAchievementImportTitle(record, titleStrategy);
	const sourceReference = buildAchievementImportSourceReference(record);
	const description = buildAchievementImportDescription(record);
	return {
		sportsProfile: Number(sportsProfileId),
		club: Number(clubId),
		achievementType: 'race_result',
		sportType: 'running',
		title,
		eventCode: record.eventCode || undefined,
		raceType: record.raceTypeNormalized || undefined,
		bib: record.bib || undefined,
		distancePending: record.distance == null,
		description: description || undefined,
		achievedAt: record.achievedAt || undefined,
		distanceKm: record.distance ?? undefined,
		durationSeconds: record.finishTime ?? undefined,
		source: 'import',
		sourceReference: sourceReference || undefined,
		note: record.note || undefined,
		status: 'submitted',
	};
}

function buildAchievementSupplementPayload(record: Record<string, any>) {
	const payload: Record<string, unknown> = {};
	if (record.distance !== null && record.distance !== undefined) {
		payload.distanceKm = record.distance;
		payload.distancePending = false;
	}
	if (record.raceTypeNormalized) payload.raceType = record.raceTypeNormalized;
	if (record.eventCode) payload.eventCode = record.eventCode;
	if (record.bib) payload.bib = record.bib;
	if (record.title) payload.title = record.title;
	return payload;
}

function canSupplementMissingDistance(existingItem: any, record: Record<string, any>) {
	if (!existingItem?.id) return false;
	const existingPending = Boolean(existingItem.distancePending);
	const existingDistance = existingItem.distanceKm === null || existingItem.distanceKm === undefined ? null : Number(existingItem.distanceKm);
	return existingPending && existingDistance === null && record.distance !== null && record.distance !== undefined;
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
					logo: { select: ['id', 'name', 'url', 'mime', 'provider', 'provider_metadata'] },
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

export async function getManagedClubMemberImportTemplate(userId: number, clubRef: unknown, tenantId: number | string) {
	await findManagedClubInTenant(userId, clubRef, tenantId);
	const workbook = XLSX.utils.book_new();
	const rows = [{
		memberCode: 'RUN001',
		profileCode: 'VKL0001',
		joinedAt: '2024-01-15',
		role: 'member',
		title: 'Thành viên',
		status: 'active',
		source: 'manual_import',
		sourceRef: 'Batch 2026-10',
	}];
	const worksheet = XLSX.utils.json_to_sheet(rows, { header: CLUB_MEMBERSHIP_IMPORT_TEMPLATE_FIELDS });
	worksheet['!cols'] = [
		{ wch: 18 },
		{ wch: 18 },
		{ wch: 14 },
		{ wch: 14 },
		{ wch: 24 },
		{ wch: 14 },
		{ wch: 16 },
		{ wch: 28 },
	];
	XLSX.utils.book_append_sheet(workbook, worksheet, 'ClubMemberships');
	const instructions = XLSX.utils.aoa_to_sheet([
		['Instructions'],
		['1. Use the ClubMemberships sheet.'],
		['2. profileCode is required and must already exist in the current tenant.'],
		['3. memberCode is optional, but if provided it must be unique inside the target club.'],
		['4. The target club comes from the current route, not from the Excel file.'],
		['5. Empty cells do not clear existing values during update.'],
		['6. role is ignored by import policy and will not be changed by this import.'],
		['7. Import will not automatically reactivate memberships that are inactive or left.'],
		['8. status accepts pending, active, inactive, left, suspended, rejected.'],
		['9. source accepts manual_import, self_registration, campaign, invite, admin_created, other.'],
	]);
	XLSX.utils.book_append_sheet(workbook, instructions, 'Instructions');
	return {
		contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
		fileName: 'club-memberships-import-template.xlsx',
		buffer: XLSX.write(workbook, { bookType: 'xlsx', type: 'buffer' }) as Buffer,
	};
}

export async function previewManagedClubMemberImport(userId: number, clubRef: unknown, tenantId: number | string, file: any) {
	const club = await findManagedClubInTenant(userId, clubRef, tenantId);
	const rows = await readClubMembershipImportWorksheet(file);
	if (!rows.length) {
		httpError(400, 'The Excel file is empty or has no data rows.', 'CLUB_MEMBERSHIP_IMPORT_EMPTY');
	}

	const seenProfileCodes = new Map<string, number>();
	const seenMemberCodes = new Map<string, number>();
	const previewRows: any[] = [];

	for (const [index, rawRow] of rows.entries()) {
		const rowNumber = index + 2;
		const record = buildClubMembershipImportRecord(rawRow as Record<string, unknown>);
		const errors: string[] = [];
		const warnings: string[] = [];
		const blockingWarnings: string[] = [];

		if (!record.profileCode) {
			errors.push('profileCode is required');
		}
		if (record.status === null && normalizeImportText(getImportColumnValue(rawRow as Record<string, unknown>, CLUB_MEMBERSHIP_IMPORT_FIELD_ALIASES.status) ?? rawRow.status)) {
			errors.push('status is invalid');
		}
		if (record.source === null && normalizeImportText(getImportColumnValue(rawRow as Record<string, unknown>, CLUB_MEMBERSHIP_IMPORT_FIELD_ALIASES.source) ?? rawRow.source)) {
			errors.push('source is invalid');
		}
		if (record.joinedAt === null && normalizeImportText(getImportColumnValue(rawRow as Record<string, unknown>, CLUB_MEMBERSHIP_IMPORT_FIELD_ALIASES.joinedAt) ?? rawRow.joinedAt)) {
			errors.push('joinedAt is invalid');
		}

		if (record.profileCode) {
			const duplicateRow = seenProfileCodes.get(record.profileCode);
			if (duplicateRow) {
				errors.push(`Duplicate profileCode "${record.profileCode}" in the same file at row ${duplicateRow}`);
			} else {
				seenProfileCodes.set(record.profileCode, rowNumber);
			}
		}

		if (record.memberCode) {
			const duplicateRow = seenMemberCodes.get(record.memberCode);
			if (duplicateRow) {
				errors.push(`Duplicate memberCode "${record.memberCode}" in the same file at row ${duplicateRow}`);
			} else {
				seenMemberCodes.set(record.memberCode, rowNumber);
			}
		}

		let sportsProfile: any = null;
		let existingMembership: any = null;
		let duplicateMemberCodeMembership: any = null;
		let nextValues: Record<string, unknown> | null = null;
		let changes: Array<{ field: string; currentValue: unknown; nextValue: unknown }> = [];
		let action: 'CREATE' | 'UPDATE' | 'UNCHANGED' | 'BLOCKED' = 'BLOCKED';
		let status: 'CREATE' | 'UPDATE' | 'UNCHANGED' | 'WARNING' | 'ERROR' = 'ERROR';
		let reason = '';

		if (errors.length === 0) {
			sportsProfile = await findSportsProfileByCodeInTenant(tenantId, record.profileCode);
			if (!sportsProfile?.id) {
				errors.push(`Sports Profile with profileCode "${record.profileCode}" was not found in the current tenant`);
			}
		}

		if (errors.length === 0 && sportsProfile?.id) {
			existingMembership = await findMembershipSummaryByProfileInClub(tenantId, Number(club.id), Number(sportsProfile.id));
			if (record.memberCode) {
				duplicateMemberCodeMembership = await findMembershipSummaryByMemberCodeInClub(Number(club.id), record.memberCode);
				if (duplicateMemberCodeMembership?.id && Number(duplicateMemberCodeMembership.id) !== Number(existingMembership?.id || 0)) {
					errors.push(`memberCode "${record.memberCode}" already belongs to another membership in this club`);
				}
			}
		}

		if (errors.length === 0 && sportsProfile?.id) {
			const computed = buildClubMembershipImportPayload({ record, existingMembership });
			nextValues = computed.payload;
			changes = computed.changes;
			warnings.push(...computed.warnings);
			blockingWarnings.push(...computed.blockingWarnings);

			if (existingMembership?.id) {
				if (blockingWarnings.length > 0) {
					status = 'WARNING';
					action = 'BLOCKED';
					reason = blockingWarnings.join('; ');
				} else if (Object.keys(nextValues).length === 0) {
					status = 'UNCHANGED';
					action = 'UNCHANGED';
					reason = 'No allowed field differs from the current membership';
				} else {
					status = warnings.length > 0 ? 'WARNING' : 'UPDATE';
					action = 'UPDATE';
					reason = warnings.length > 0
						? warnings.join('; ')
						: 'Allowed membership fields will be updated without changing club ownership, sports profile linkage, or manager role';
				}
			} else {
				const createPayload: Record<string, unknown> = {
					sportsProfile: Number(sportsProfile.id),
					club: Number(club.id),
					memberCode: record.memberCode || undefined,
					positionTitle: record.title || undefined,
					joinedAt: record.joinedAt || undefined,
					status: record.status || 'active',
					source: record.source || undefined,
					sourceReference: record.sourceRef || undefined,
				};
				Object.keys(createPayload).forEach((key) => {
					if (createPayload[key] === undefined || createPayload[key] === null || createPayload[key] === '') {
						delete createPayload[key];
					}
				});
				nextValues = createPayload;
				changes = Object.entries(createPayload)
					.filter(([key]) => key !== 'sportsProfile' && key !== 'club')
					.map(([field, nextValue]) => ({ field, currentValue: null, nextValue }));
				status = warnings.length > 0 ? 'WARNING' : 'CREATE';
				action = 'CREATE';
				reason = warnings.length > 0 ? warnings.join('; ') : 'New membership will be created for the current club';
			}
		}

		if (errors.length > 0) {
			status = 'ERROR';
			action = 'BLOCKED';
			reason = errors.join('; ');
		}

		const rowWarnings = [...warnings, ...blockingWarnings];
		previewRows.push({
			rowNumber,
			memberCode: record.memberCode || null,
			profileCode: record.profileCode || null,
			profileName: toText(sportsProfile?.fullName) || null,
			status,
			action,
			canImport: status !== 'ERROR' && !(status === 'WARNING' && action === 'BLOCKED'),
			currentMembership: summarizeManagedMembershipForImport(existingMembership),
			sportsProfile: summarizeSportsProfileForImport(sportsProfile),
			nextValues,
			changes,
			warnings: rowWarnings,
			errors,
			reason,
		});
	}

	return {
		fileName: toText(file?.name || file?.originalFilename) || 'club-memberships-import.xlsx',
		club: mapClubHeader(club),
		summary: computeClubMembershipImportSummary(previewRows),
		rows: previewRows,
	};
}

export async function confirmManagedClubMemberImport(userId: number, clubRef: unknown, tenantId: number | string, file: any, authUser: AuthUser = null) {
	const preview = await previewManagedClubMemberImport(userId, clubRef, tenantId, file);
	const blockedRows = preview.rows.filter((row: any) => row.status === 'ERROR' || row.canImport === false);
	if (blockedRows.length > 0) {
		httpError(400, 'Import contains unresolved validation conflicts. Fix the file and retry the import.', 'CLUB_MEMBERSHIP_IMPORT_VALIDATION_FAILED', {
			rows: blockedRows.map((row: any) => ({
				rowNumber: row.rowNumber,
				profileCode: row.profileCode,
				memberCode: row.memberCode,
				status: row.status,
				errors: row.errors,
				warnings: row.warnings,
			})),
		});
	}

	const created: any[] = [];
	const updated: any[] = [];
	const unchanged: any[] = [];
	let createdCount = 0;
	let updatedCount = 0;
	let unchangedCount = 0;

	for (const row of preview.rows) {
		if (row.action === 'UNCHANGED') {
			unchangedCount += 1;
			unchanged.push({ rowNumber: row.rowNumber, profileCode: row.profileCode, memberCode: row.memberCode, action: 'UNCHANGED' });
			continue;
		}
		if (row.action === 'CREATE') {
			const createdMembership = await createTenantClubMembership(row.nextValues || {}, tenantId, authUser);
			createdCount += 1;
			created.push({ rowNumber: row.rowNumber, id: createdMembership?.id || null, profileCode: row.profileCode, memberCode: createdMembership?.memberCode || row.memberCode || null, action: 'CREATE' });
			continue;
		}
		if (row.action === 'UPDATE') {
			const existingId = Number(row.currentMembership?.id || 0);
			if (!Number.isInteger(existingId) || existingId <= 0) {
				httpError(404, `Membership not found for profileCode "${row.profileCode}"`, 'CLUB_MEMBERSHIP_NOT_FOUND');
			}
			const updatedMembership = await updateTenantClubMembership(existingId, {
				...row.nextValues,
				sportsProfile: Number(row.currentMembership?.sportsProfile?.id || row.sportsProfile?.id || 0),
				club: Number(preview.club?.id || 0),
			}, tenantId, authUser);
			updatedCount += 1;
			updated.push({ rowNumber: row.rowNumber, id: updatedMembership?.id || null, profileCode: row.profileCode, memberCode: updatedMembership?.memberCode || row.memberCode || null, action: 'UPDATE' });
		}
	}

	strapi.log.info(`[club-membership-import] tenant=${tenantId} clubId=${preview.club?.id || null} actorUserId=${authUser?.id || null} created=${createdCount} updated=${updatedCount} unchanged=${unchangedCount} total=${preview.summary.totalRows}`);
	return {
		fileName: preview.fileName,
		club: preview.club,
		summary: {
			totalRows: preview.summary.totalRows,
			createdCount,
			updatedCount,
			unchangedCount,
			warningCount: preview.summary.warningCount,
			errorCount: 0,
		},
		created,
		updated,
		unchanged,
	};
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
	const page = Math.min(500, toPositiveInt(query.pageSize ?? query.limit, 200));
	const currentMembers = await listTenantClubMemberships({
		club: Number(club.id),
		status: 'active',
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

export async function getManagedClubAchievementImportTemplate(userId: number, clubRef: unknown, tenantId: number | string) {
	await findManagedClubInTenant(userId, clubRef, tenantId);
	const workbook = XLSX.utils.book_new();
	const rows = [{
		profileCode: 'VKL0001',
		eventCode: 'VKL-FM-2026',
		eventName: 'VKL Marathon 2026',
		bib: '000123',
		distance: 'FM',
		raceType: 'Road',
		finishTime: '03:45:30',
		achievedAt: '2026-10-01 05:00',
		title: 'VKL-FM-2026-000123',
		sourceRef: 'results:VKL-FM-2026:000123',
		note: 'Imported from official result sheet',
	}];
	const worksheet = XLSX.utils.json_to_sheet(rows, { header: ACHIEVEMENT_IMPORT_TEMPLATE_FIELDS });
	worksheet['!cols'] = [
		{ wch: 18 }, { wch: 18 }, { wch: 28 }, { wch: 14 }, { wch: 12 }, { wch: 12 }, { wch: 14 }, { wch: 20 }, { wch: 28 }, { wch: 28 }, { wch: 30 },
	];
	XLSX.utils.book_append_sheet(workbook, worksheet, 'Achievements');
	const instructions = XLSX.utils.aoa_to_sheet([
		['Instructions'],
		['1. Use the Achievements sheet.'],
		['2. profileCode must already exist and belong to a club membership in the current club.'],
		['3. BIB is optional and is stored as string (leading zeros preserved).'],
		['4. finishTime accepts HH:mm or HH:mm:ss and supports hours greater than 24.'],
		['5. achievedAt is required; the system will not infer missing race dates.'],
		['6. sourceRef is recommended for stable duplicate detection across reimports.'],
		['7. If sourceRef is empty, duplicate detection falls back to club + profile + eventCode + distance + achievedAt + bib + result.'],
		['8. Import will not create Sports Profile, Club Membership, or User automatically.'],
	]);
	XLSX.utils.book_append_sheet(workbook, instructions, 'Instructions');
	return {
		contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
		fileName: 'club-achievements-import-template.xlsx',
		buffer: XLSX.write(workbook, { bookType: 'xlsx', type: 'buffer' }) as Buffer,
	};
}

export async function previewManagedClubAchievementImport(userId: number, clubRef: unknown, tenantId: number | string, file: any, payload: Record<string, unknown>) {
	const club = await findManagedClubInTenant(userId, clubRef, tenantId);
	const rows = await readAchievementImportWorksheet(file);
	if (!rows.length) {
		httpError(400, 'The Excel file is empty or has no data rows.', 'ACHIEVEMENT_IMPORT_EMPTY');
	}

	const titleStrategy = normalizeAchievementImportStrategy(payload?.titleStrategy);
	const processingMode = normalizeAchievementImportMode(payload?.processingMode);
	const seenSignatures = new Map<string, number>();
	const previewRows: any[] = [];

	for (const [index, rawRow] of rows.entries()) {
		const rowNumber = index + 2;
		const record = buildAchievementImportRecord(rawRow as Record<string, unknown>);
		const errors: string[] = [];
		const warnings: string[] = [];
		const blockingWarnings: string[] = [];
		const recordAchievedAtRaw = normalizeImportText(getImportColumnValue(rawRow as Record<string, unknown>, ACHIEVEMENT_IMPORT_FIELD_ALIASES.achievedAt) ?? rawRow.achievedAt);
		const recordFinishTimeRaw = normalizeImportText(getImportColumnValue(rawRow as Record<string, unknown>, ACHIEVEMENT_IMPORT_FIELD_ALIASES.finishTime) ?? rawRow.finishTime);

		if (!record.profileCode) errors.push('profileCode is required');
		if (!record.achievedAt) {
			if (recordAchievedAtRaw) errors.push('achievedAt is invalid');
			else errors.push('achievedAt is required');
		}
		const allowsMissingDistance = true;
		if (!record.distance && !allowsMissingDistance) errors.push('distance is required and must be recognizable (FM/HM/10K/5K or numeric km)');
		if (!record.finishTime) {
			if (recordFinishTimeRaw) errors.push('finishTime is invalid');
			else errors.push('finishTime is required');
		}
		if (!record.distance && allowsMissingDistance) {
			warnings.push('distance is missing; the result will be imported with pending distance metadata and excluded from future distance-based analytics until completed');
		}

		const title = buildAchievementImportTitle(record, titleStrategy);
		if (titleStrategy === 'excel_title' && !title) {
			errors.push('title is required when title strategy uses Excel title');
		}
		if (titleStrategy === 'auto_event_bib' && !title) {
			errors.push('Cannot derive title automatically because eventCode/eventName is missing');
		}

		const fileDuplicateSignature = buildAchievementDuplicateSignature(record);
		if (!fileDuplicateSignature) {
			blockingWarnings.push('Insufficient duplicate-detection data: provide sourceRef, or eventCode + achievedAt + bib when distance is missing');
		} else {
			const existingRowNumber = seenSignatures.get(fileDuplicateSignature);
			if (existingRowNumber) {
				blockingWarnings.push(`Duplicate row in the same file detected at row ${existingRowNumber}`);
			} else {
				seenSignatures.set(fileDuplicateSignature, rowNumber);
			}
		}

		let sportsProfile: any = null;
		let membership: any = null;
		let nextValues: Record<string, unknown> | null = null;
		let duplicateMatches: { achievements: any[]; submissions: any[] } = { achievements: [], submissions: [] };
		let status: 'CREATE' | 'DUPLICATE' | 'WARNING' | 'ERROR' = 'ERROR';
		let action: 'CREATE' | 'SUPPLEMENT_ACHIEVEMENT' | 'SUPPLEMENT_SUBMISSION' | 'SKIP' = 'SKIP';
		let reason = '';

		if (errors.length === 0) {
			sportsProfile = await findSportsProfileByCodeInTenant(tenantId, record.profileCode);
			if (!sportsProfile?.id) {
				errors.push(`Sports Profile with profileCode "${record.profileCode}" was not found in the current tenant`);
			}
		}

		if (errors.length === 0 && sportsProfile?.id) {
			membership = await findMembershipForAchievementImport(tenantId, Number(club.id), Number(sportsProfile.id));
			if (!membership?.id) {
				errors.push('Sports Profile does not belong to the current club membership');
			}
		}

		if (errors.length === 0 && sportsProfile?.id && membership?.id) {
			if (toText(membership.status).toLowerCase() !== 'active') {
				blockingWarnings.push(`Current workflow requires an active club membership, but membership status is "${toText(membership.status).toLowerCase() || '-'}"`);
			}

			nextValues = buildAchievementImportPayload({
				record,
				clubId: Number(club.id),
				sportsProfileId: Number(sportsProfile.id),
				titleStrategy,
				processingMode,
			});
			duplicateMatches = await findPotentialAchievementDuplicates({
				tenantId,
				clubId: Number(club.id),
				sportsProfileId: Number(sportsProfile.id),
				sourceReference: String(nextValues.sourceReference || ''),
				eventCode: record.eventCode || null,
				bib: record.bib || null,
				achievedAt: record.achievedAt || null,
				distanceKm: record.distance ?? null,
				durationSeconds: record.finishTime ?? null,
			});

			const supplementAchievement = duplicateMatches.achievements.find((item) => canSupplementMissingDistance(item, record));
			const supplementSubmission = !supplementAchievement
				? duplicateMatches.submissions.find((item) => canSupplementMissingDistance(item, record))
				: null;

			if (supplementAchievement) {
				status = 'WARNING';
				action = 'SUPPLEMENT_ACHIEVEMENT';
				nextValues = buildAchievementSupplementPayload(record);
				reason = 'Existing imported achievement is missing distance; confirm will supplement distance and race metadata';
			} else if (supplementSubmission) {
				status = 'WARNING';
				action = 'SUPPLEMENT_SUBMISSION';
				nextValues = buildAchievementSupplementPayload(record);
				reason = 'Existing submission is missing distance; confirm will supplement distance and race metadata';
			} else if (duplicateMatches.achievements.length > 0 || duplicateMatches.submissions.length > 0) {
				status = 'DUPLICATE';
				action = 'SKIP';
				reason = 'Matching achievement/submission already exists';
			} else if (blockingWarnings.length > 0) {
				status = 'WARNING';
				action = 'SKIP';
				reason = blockingWarnings.join('; ');
			} else if (warnings.length > 0) {
				status = 'WARNING';
				action = 'CREATE';
				reason = warnings.join('; ');
			} else {
				status = 'CREATE';
				action = 'CREATE';
				reason = processingMode === 'verify_now'
					? 'The row will create a submitted record and verify it immediately through the existing workflow'
					: 'The row will create a submitted achievement proposal waiting for verification';
			}
		}

		if (errors.length > 0) {
			status = 'ERROR';
			reason = errors.join('; ');
			nextValues = null;
		}

		previewRows.push({
			rowNumber,
			profileCode: record.profileCode || null,
			profileName: toText(sportsProfile?.fullName) || null,
			memberCode: toText(membership?.memberCode) || null,
			eventCode: record.eventCode || null,
			eventName: record.eventName || null,
			bib: record.bib || null,
			distanceKm: record.distance ?? null,
			finishTime: record.finishTime ?? null,
			achievedAt: record.achievedAt || null,
			title: title || null,
			status,
			action,
			canImport: action === 'CREATE' || action === 'SUPPLEMENT_ACHIEVEMENT' || action === 'SUPPLEMENT_SUBMISSION',
			reason,
			warnings: [...warnings, ...blockingWarnings],
			errors,
			nextValues,
			duplicateMatches,
		});
	}

	return {
		fileName: toText(file?.name || file?.originalFilename) || 'club-achievements-import.xlsx',
		club: mapClubHeader(club),
		settings: {
			achievementType: 'race_result',
			sportType: 'running',
			titleStrategy,
			processingMode,
		},
		summary: computeAchievementImportSummary(previewRows),
		rows: previewRows,
	};
}

export async function confirmManagedClubAchievementImport(userId: number, clubRef: unknown, tenantId: number | string, file: any, payload: Record<string, unknown>, authUser: AuthUser = null) {
	const preview = await previewManagedClubAchievementImport(userId, clubRef, tenantId, file, payload || {});
	const created: any[] = [];
	const updated: any[] = [];
	const skipped: any[] = [];
	const errors: any[] = [];
	let directRecordedCount = 0;
	let submissionCreatedCount = 0;
	let supplementedCount = 0;

	for (const row of preview.rows) {
		if (!row.canImport) {
			skipped.push({
				rowNumber: row.rowNumber,
				profileCode: row.profileCode,
				eventCode: row.eventCode,
				bib: row.bib,
				status: row.status,
				reason: row.reason,
			});
			continue;
		}

		try {
			const recheckedDuplicates = await findPotentialAchievementDuplicates({
				tenantId,
				clubId: Number(preview.club?.id || 0),
				sportsProfileId: Number(row.nextValues?.sportsProfile || 0),
				sourceReference: String(row.nextValues?.sourceReference || ''),
				eventCode: row.eventCode || null,
				bib: row.bib || null,
				achievedAt: row.achievedAt || null,
				distanceKm: row.distanceKm ?? null,
				durationSeconds: row.finishTime ?? null,
			});
			if (recheckedDuplicates.achievements.length > 0 || recheckedDuplicates.submissions.length > 0) {
				const supplementAchievement = row.action === 'SUPPLEMENT_ACHIEVEMENT'
					? recheckedDuplicates.achievements.find((item) => canSupplementMissingDistance(item, {
						distance: row.distanceKm,
					}))
					: null;
				const supplementSubmission = row.action === 'SUPPLEMENT_SUBMISSION'
					? recheckedDuplicates.submissions.find((item) => canSupplementMissingDistance(item, {
						distance: row.distanceKm,
					}))
					: null;
				if (supplementAchievement?.id) {
					const updatedRow = await updateTenantSportsAchievement(Number(supplementAchievement.id), row.nextValues || {}, tenantId, authUser);
					supplementedCount += 1;
					updated.push({
						rowNumber: row.rowNumber,
						profileCode: row.profileCode,
						eventCode: row.eventCode,
						bib: row.bib,
						id: updatedRow?.id || null,
						title: updatedRow?.title || row.title || null,
						mode: 'supplement_achievement',
					});
					continue;
				}
				if (supplementSubmission?.id) {
					const updatedRow = await updateTenantSportsAchievementSubmission(Number(supplementSubmission.id), row.nextValues || {}, tenantId, authUser);
					supplementedCount += 1;
					updated.push({
						rowNumber: row.rowNumber,
						profileCode: row.profileCode,
						eventCode: row.eventCode,
						bib: row.bib,
						id: updatedRow?.id || null,
						title: updatedRow?.title || row.title || null,
						mode: 'supplement_submission',
					});
					continue;
				}
				skipped.push({
					rowNumber: row.rowNumber,
					profileCode: row.profileCode,
					eventCode: row.eventCode,
					bib: row.bib,
					status: 'DUPLICATE',
					reason: 'Duplicate found during confirm revalidation',
				});
				continue;
			}

			const createdRow = preview.settings.processingMode === 'verify_now'
				? await createAndVerifyAchievementSubmission(row.nextValues || {}, tenantId, authUser)
				: await createTenantSportsAchievementSubmission(row.nextValues || {}, tenantId, authUser);

			if (preview.settings.processingMode === 'verify_now') {
				directRecordedCount += 1;
			} else {
				submissionCreatedCount += 1;
			}
			created.push({
				rowNumber: row.rowNumber,
				profileCode: row.profileCode,
				eventCode: row.eventCode,
				bib: row.bib,
				id: createdRow?.id || null,
				title: createdRow?.title || row.title || null,
				mode: preview.settings.processingMode,
			});
		} catch (error: any) {
			errors.push({
				rowNumber: row.rowNumber,
				profileCode: row.profileCode,
				eventCode: row.eventCode,
				bib: row.bib,
				message: toText(error?.message || error?.details?.message || error?.response?.data?.error?.message) || 'Failed to import row',
			});
		}
	}

	strapi.log.info(`[achievement-import] tenant=${tenantId} clubId=${preview.club?.id || null} actorUserId=${authUser?.id || null} mode=${preview.settings.processingMode} created=${created.length} skipped=${skipped.length} errors=${errors.length} total=${preview.summary.totalRows}`);
	return {
		fileName: preview.fileName,
		club: preview.club,
		settings: preview.settings,
		summary: {
			totalRows: preview.summary.totalRows,
			createdCount: created.length,
			updatedCount: updated.length,
			skippedCount: skipped.length,
			errorCount: errors.length,
			directRecordedCount,
			submissionCreatedCount,
			supplementedCount,
		},
		created,
		updated,
		skipped,
		errors,
	};
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
		eventCode: payload?.eventCode,
		raceType: payload?.raceType,
		bib: payload?.bib,
		distancePending: payload?.distancePending,
		description: payload?.description,
		achievedAt: payload?.achievedAt,
		resultValue: payload?.resultValue,
		distanceKm: payload?.distanceKm,
		durationSeconds: payload?.durationSeconds,
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
		eventCode: payload?.eventCode,
		raceType: payload?.raceType,
		bib: payload?.bib,
		distancePending: payload?.distancePending,
		description: payload?.description,
		achievedAt: payload?.achievedAt,
		resultValue: payload?.resultValue,
		distanceKm: payload?.distanceKm,
		durationSeconds: payload?.durationSeconds,
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

export async function listManagedClubAchievementTemplates(userId: number, clubRef: unknown, tenantId: number | string, query: Record<string, unknown>) {
	const club = await findManagedClubInTenant(userId, clubRef, tenantId);
	const nextQuery = { ...(query || {}), club: Number(club.id) } as Record<string, unknown>;
	const data = await listTenantSportsAchievementTemplates(nextQuery, tenantId);
	return data;
}

export async function getManagedClubAchievementTemplateDetail(userId: number, clubRef: unknown, templateRef: unknown, tenantId: number | string) {
	const club = await findManagedClubInTenant(userId, clubRef, tenantId);
	const template = await getTenantSportsAchievementTemplate(templateRef, tenantId);
	if (Number(template?.club?.id || 0) !== Number(club.id)) {
		httpError(404, 'Sports achievement template not found in this club', 'SPORTS_ACHIEVEMENT_TEMPLATE_NOT_IN_CLUB');
	}
	return template;
}

export async function createManagedClubAchievementTemplate(userId: number, clubRef: unknown, tenantId: number | string, payload: Record<string, unknown>, authUser: AuthUser = null) {
	const club = await findManagedClubInTenant(userId, clubRef, tenantId);
	const result = await createTenantSportsAchievementTemplate({
		...payload,
		club: Number(club.id),
	}, tenantId, authUser);
	return result;
}

export async function updateManagedClubAchievementTemplate(userId: number, clubRef: unknown, templateRef: unknown, tenantId: number | string, payload: Record<string, unknown>, authUser: AuthUser = null) {
	const club = await findManagedClubInTenant(userId, clubRef, tenantId);
	const template = await getTenantSportsAchievementTemplate(templateRef, tenantId);
	if (Number(template?.club?.id || 0) !== Number(club.id)) {
		httpError(404, 'Sports achievement template not found in this club', 'SPORTS_ACHIEVEMENT_TEMPLATE_NOT_IN_CLUB');
	}
	return await updateTenantSportsAchievementTemplate(templateRef, { ...payload, club: Number(club.id) }, tenantId, authUser);
}

export async function uploadManagedClubAchievementTemplateAsset(
	userId: number,
	clubRef: unknown,
	tenantId: number | string,
	rawFile: any,
	payload: Record<string, unknown>,
	authUser: AuthUser = null,
) {
	const club = await findManagedClubInTenant(userId, clubRef, tenantId);
	const file = resolveUploadFile(rawFile);
	if (!file) {
		httpError(400, 'file is required', 'INVALID_TEMPLATE_ASSET', { field: 'file' });
	}
	const mimeType = getUploadMimeType(file);
	if (!mimeType || !TEMPLATE_ASSET_ALLOWED_MIME_TYPES.has(mimeType)) {
		httpError(400, 'Only PNG, JPG, and WEBP are supported for template assets', 'INVALID_TEMPLATE_ASSET_MIME', { field: 'file', mimeType });
	}
	const size = getUploadFileSize(file);
	if (size <= 0) {
		httpError(400, 'file size must be greater than zero', 'INVALID_TEMPLATE_ASSET_SIZE', { field: 'file', size });
	}
	if (size > TEMPLATE_ASSET_MAX_BYTES) {
		httpError(400, `file size exceeds ${TEMPLATE_ASSET_MAX_BYTES} bytes`, 'INVALID_TEMPLATE_ASSET_SIZE', { field: 'file', size, maxBytes: TEMPLATE_ASSET_MAX_BYTES });
	}

	const usage = toText(payload?.usage).toLowerCase();
	const usageSuffix = usage === 'background' || usage === 'preview' ? usage : 'asset';
	const tenantRow = await strapi.db.query(TENANT_UID).findOne({
		where: { id: { $eq: Number(tenantId) } },
		select: ['id', 'code', 'storageDefaultConfigId'],
	} as any);
	if (!tenantRow?.id) {
		httpError(404, 'Tenant not found', 'TENANT_NOT_FOUND');
	}
	const uploaded = await storageService.uploadLocalFile({
		tenant: { id: Number(tenantRow.id), code: toText(tenantRow.code), storageDefaultConfigId: tenantRow.storageDefaultConfigId || null },
		file,
		moduleKey: 'sports/achievement-templates',
		entityType: 'sports-achievement-template',
		entityId: String(Number(club.id)),
		uploadedBy: authUser?.id || null,
		isPublic: false,
		metadata: {
			clubId: Number(club.id),
			usage: usageSuffix,
		},
	});

	return mapTemplateAssetUpload(uploaded);
}

export async function getManagedClubAchievementDetail(userId: number, clubRef: unknown, achievementRef: unknown, tenantId: number | string) {
	const result = await findManagedAchievementInClub(userId, clubRef, achievementRef, tenantId);
	const summaries = await loadMembershipSummariesForClub(tenantId, Number(result.club.id), [Number(result.achievement?.sportsProfile?.id || 0)]);
	const submissionRow = await strapi.db.query(SPORTS_ACHIEVEMENT_SUBMISSION_UID).findOne({
		where: mergeTenantWhere({ achievement: { id: { $eq: Number(result.achievement.id) } } }, tenantId),
		select: ['id', 'documentId', 'title', 'status', 'submittedAt'],
	} as any);
	const mappedAchievement = attachMembershipSummary([result.achievement], summaries)[0] || result.achievement;
	const templateResolution = await resolveAchievementTemplateForEntity(mappedAchievement, tenantId);
	const templateOptions = await listEligibleAchievementTemplatesForEntity(mappedAchievement, tenantId);
	const effectiveTemplate = templateResolution?.template || null;
	return {
		...mappedAchievement,
		templateResolution,
		templateOptions,
		effectiveTemplate,
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

export async function updateManagedClubAchievementShareTemplate(
	userId: number,
	clubRef: unknown,
	achievementRef: unknown,
	tenantId: number | string,
	payload: Record<string, unknown>,
	authUser: AuthUser = null,
) {
	const { achievement } = await findManagedAchievementInClub(userId, clubRef, achievementRef, tenantId);
	const mode = toText(payload?.mode).toLowerCase();
	if (mode !== 'auto' && mode !== 'explicit') {
		httpError(400, 'mode must be auto or explicit', 'INVALID_TEMPLATE_MODE', { field: 'mode' });
	}

	if (mode === 'auto') {
		await updateTenantSportsAchievement(achievementRef, {
			shareTemplate: null,
			shareTemplateSource: 'none',
		}, tenantId, authUser);
		return await getManagedClubAchievementDetail(userId, clubRef, achievementRef, tenantId);
	}

	const templateRef = payload?.template || payload?.shareTemplate || payload?.templateId || payload?.shareTemplateId || null;
	const template = await getTenantSportsAchievementTemplate(templateRef, tenantId);
	if (!template?.id) {
		httpError(404, 'Sports achievement template not found', 'SPORTS_ACHIEVEMENT_TEMPLATE_NOT_FOUND');
	}
	if (Number(template?.club?.id || 0) !== Number(achievement?.club?.id || 0)) {
		httpError(409, 'Template is not in this club', 'SPORTS_ACHIEVEMENT_TEMPLATE_NOT_IN_CLUB');
	}
	if (toText(template.status).toLowerCase() !== 'active') {
		httpError(409, 'Template is not active', 'SPORTS_ACHIEVEMENT_TEMPLATE_NOT_ACTIVE');
	}
	if (toText(template.sportType).toLowerCase() !== toText(achievement?.sportType).toLowerCase()) {
		httpError(409, 'Template sportType does not match achievement', 'SPORTS_ACHIEVEMENT_TEMPLATE_SPORT_MISMATCH');
	}
	const allowedTypes = Array.isArray(template.achievementTypes) ? template.achievementTypes.map((item: any) => toText(item).toLowerCase()) : [];
	if (allowedTypes.length > 0 && !allowedTypes.includes(toText(achievement?.achievementType).toLowerCase())) {
		httpError(409, 'Template achievementType does not match achievement', 'SPORTS_ACHIEVEMENT_TEMPLATE_ACHIEVEMENT_TYPE_MISMATCH');
	}

	await updateTenantSportsAchievement(achievementRef, {
		shareTemplate: Number(template.id),
		shareTemplateSource: 'explicit',
	}, tenantId, authUser);
	return await getManagedClubAchievementDetail(userId, clubRef, achievementRef, tenantId);
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
