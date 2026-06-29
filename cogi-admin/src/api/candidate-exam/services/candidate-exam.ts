/**
 * candidate-exam service.
 */

import { factories } from '@strapi/strapi';
import fs from 'node:fs/promises';
import Handlebars from 'handlebars';
import QRCode from 'qrcode';
import XLSX from 'xlsx';
import { buildRestoreData, buildSoftDeleteData, mergeTenantSoftDeleteWhere } from '../../../utils/soft-delete';
import { mergeTenantWhere, normalizeSortInput, parseOptionalPositiveInt, toPositiveInt, toText, whereByParam } from '../../../utils/tenant-scope';
import { createCandidateExamLogEntry } from '../../candidate-exam-log/services/candidate-exam-log';
import { listCandidateExamLogs } from '../../candidate-exam-log/services/candidate-exam-log';
import { enqueueMail, resolveMailQueueConfig } from '../../../services/mail-queue';

const CANDIDATE_EXAM_UID = 'api::candidate-exam.candidate-exam';
const CANDIDATE_EXAM_LOG_UID = 'api::candidate-exam-log.candidate-exam-log';
const CAMPAIGN_UID = 'api::campaign.campaign';
const ADMISSION_APPLICATION_UID = 'api::admission-application.admission-application';
const IMPORT_TEMPLATE_FILE_NAME = 'candidate-exam-import-template.xlsx';
const SCORE_IMPORT_TEMPLATE_FILE_NAME = 'candidate-exam-score-import-template.xlsx';
const RECHECK_IMPORT_TEMPLATE_FILE_NAME = 'candidate-exam-recheck-import-template.xlsx';
const DEFAULT_CARD_REMINDER_SUBJECT = 'Nhắc in thẻ dự kiểm tra đánh giá năng lực';
const DEFAULT_CARD_REMINDER_LOOKUP_URL = 'http://tuyensinhlop6.cva-edu.com/';
const DEFAULT_CARD_REMINDER_HTML = [
	'<p>Kính gửi Quý phụ huynh,</p>',
	'<p>Nhà trường đã phát hành thẻ dự kiểm tra đánh giá năng lực cho thí sinh:</p>',
	'<ul>',
	'<li>Họ và tên: <strong>{{fullName}}</strong></li>',
	'<li>Mã học sinh: <strong>{{studentCode}}</strong></li>',
	'<li>Mã hồ sơ: <strong>{{applicationCode}}</strong></li>',
	'</ul>',
	'<p>Quý phụ huynh vui lòng truy cập:<br><a href="{{lookupUrl}}">{{lookupUrl}}</a></p>',
	'<p>Nhập Mã học sinh và Mã hồ sơ đã được cấp để tra cứu và in thẻ dự kiểm tra.</p>',
	'<p>Lưu ý: Kỳ kiểm tra được tổ chức tại 02 địa điểm thi, Quý phụ huynh vui lòng kiểm tra kỹ thông tin trên thẻ để đưa con đến đúng địa điểm kiểm tra.</p>',
	'<p>Trân trọng.</p>',
].join('');
const CARD_REMINDER_ACTIONS = ['card_view', 'card_print', 'card_download', 'first_card_download'] as const;
const CARD_REMINDER_RETRY_BLOCKED_STATUSES = new Set(['queued', 'sending', 'sent', 'failed']);
const CARD_REMINDER_SEND_DELAY_MS = toPositiveInt(process.env.CARD_REMINDER_SEND_DELAY_MS, 250);
const CARD_REMINDER_DEFAULT_LIMIT = 50;
const CARD_REMINDER_MAX_LIMIT = 100;
const CARD_REMINDER_MAX_ERROR_ITEMS = 20;
const EMAIL_FIELD_KEYWORDS = ['email', 'mail'];
const CANDIDATE_EXAM_STATUS_VALUES = new Set([
	'draft',
	'ready',
	'card_downloaded',
	'checked_in',
	'absent',
	'completed',
	'cancelled',
]);
const IMPORT_ACTION_CREATE = 'CREATE';
const IMPORT_ACTION_UPDATE = 'UPDATE';
const IMPORT_ACTION_ERROR = 'ERROR';
const IMPORT_ACTION_DUPLICATE = 'DUPLICATE_IN_FILE';
const IMPORT_ACTION_DELETED_EXISTING = 'DELETED_EXISTING';
const IMPORT_ACTION_SKIP = 'SKIP';
const TENANT_UID = 'api::tenant.tenant';

type CandidateExamReminderSummary = {
	totalCandidates: number;
	viewedOrDownloadedCount: number;
	notViewedOrDownloadedCount: number;
	scoreLookupCount: number;
	scoreNotLookupCount: number;
	reminderSentCount: number;
	reminderPendingCount: number;
	reminderFailedCount: number;
	targetToReminderCount: number;
};

type UploadedFileLike = {
	name?: string;
	originalFilename?: string;
	filepath?: string;
	path?: string;
	tempFilePath?: string;
	buffer?: Buffer;
};

type CandidateExamCardRenderContext = {
	userId?: number | null;
	ip?: string | null;
	userAgent?: string | null;
	actorType?: 'parent' | 'staff' | 'system';
	assetBaseUrl?: string | null;
	refererUrl?: string | null;
};

class CandidateExamError extends Error {
	status: number;

	constructor(status: number, message: string) {
		super(message);
		this.status = status;
	}
}

const CANDIDATE_EXAM_POPULATE = {
	tenant: {
		select: ['id', 'name', 'code'],
	},
	admissionSeason: {
		select: ['id', 'name', 'code', 'campaignStatus'],
	},
	admissionApplication: {
		select: ['id', 'applicationCode', 'studentCode', 'studentName', 'admissionStatus', 'reviewStatus'],
	},
	cardFirstDownloadedBy: {
		select: ['id', 'username', 'email', 'fullName'],
	},
	deletedBy: {
		select: ['id', 'username', 'email', 'fullName'],
	},
	restoredBy: {
		select: ['id', 'username', 'email', 'fullName'],
	},
};

const CANDIDATE_EXAM_REMINDER_POPULATE = {
	admissionApplication: {
		select: ['id', 'applicationCode', 'studentCode', 'studentName', 'formData', 'isDeleted'],
		populate: {
			parent: {
				select: ['id', 'username', 'email', 'fullName'],
			},
		},
	},
};

const CANDIDATE_EXAM_EXPORT_POPULATE = {
	admissionApplication: {
		select: ['id', 'applicationCode', 'studentCode', 'studentName'],
		populate: {
			parent: {
				select: ['id', 'username', 'email', 'fullName', 'phone'],
			},
		},
	},
};

function resolveSortOrder(query: Record<string, unknown>) {
	const normalizedSort = normalizeSortInput(query?.sort);
	if (normalizedSort.length > 0) return normalizedSort;

	const sortBy = toText(query?.sortBy);
	if (sortBy === 'cardFirstViewedAt' || sortBy === 'cardFirstPrintedAt') {
		return [{ createdAt: 'desc' }, { id: 'desc' }] as Array<Record<string, 'asc' | 'desc'>>;
	}
	if (!sortBy) {
		return [{ createdAt: 'desc' }, { id: 'desc' }] as Array<Record<string, 'asc' | 'desc'>>;
	}

	return [
		{ [sortBy]: toText(query?.sortOrder).toLowerCase() === 'asc' ? 'asc' : 'desc' } as Record<string, 'asc' | 'desc'>,
		{ id: 'desc' },
	];
}

function toBooleanFlag(value: unknown, fallback = false) {
	if (typeof value === 'boolean') return value;
	if (typeof value === 'number') return value !== 0;
	const normalized = toText(value).toLowerCase();
	if (!normalized) return fallback;
	return ['true', '1', 'yes', 'on'].includes(normalized);
}

function wait(ms: number) {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

function isValidEmail(value: unknown) {
	const email = toText(value).toLowerCase();
	if (!email) return false;
	return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function normalizeReminderStatus(value: unknown) {
	return toText(value).toLowerCase();
}

function isPendingReminderStatus(value: unknown) {
	const normalized = normalizeReminderStatus(value);
	return !normalized || normalized === 'pending';
}

function isAlreadyRemindedOrBlockedStatus(value: unknown) {
	const normalized = normalizeReminderStatus(value);
	return CARD_REMINDER_RETRY_BLOCKED_STATUSES.has(normalized);
}

function isReminderViewOrDownloadAction(value: unknown) {
	return CARD_REMINDER_ACTIONS.includes(toText(value).toLowerCase() as (typeof CARD_REMINDER_ACTIONS)[number]);
}

function buildActiveRecordWhere() {
	return {
		$or: [
			{ isDeleted: false },
			{ isDeleted: { $null: true } },
		],
	};
}

function buildActiveCandidateExamWhere(admissionSeasonId: number, tenantId: number | string) {
	return mergeTenantWhere({
		admissionSeason: { id: { $eq: admissionSeasonId } },
		...buildActiveRecordWhere(),
	}, tenantId);
}

function pushUniqueEmail(target: Set<string>, value: unknown) {
	const email = toText(value).toLowerCase();
	if (isValidEmail(email)) {
		target.add(email);
	}
}

function collectEmailsFromStructuredValue(value: unknown, target: Set<string>, path = '') {
	if (!value) return;

	if (typeof value === 'string') {
		const shouldCollect = EMAIL_FIELD_KEYWORDS.some((keyword) => path.toLowerCase().includes(keyword));
		if (shouldCollect) pushUniqueEmail(target, value);
		return;
	}

	if (Array.isArray(value)) {
		value.forEach((item, index) => collectEmailsFromStructuredValue(item, target, `${path}[${index}]`));
		return;
	}

	if (typeof value === 'object') {
		for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
			collectEmailsFromStructuredValue(child, target, path ? `${path}.${key}` : key);
		}
	}
}

function pickFirstEmail(candidates: Array<unknown>) {
	for (const value of candidates) {
		const email = toText(value).toLowerCase();
		if (isValidEmail(email)) return email;
	}
	return '';
}

function buildCandidateExamReminderTemplateContext(candidateExam: any) {
	return {
		fullName: toText(candidateExam?.fullName || candidateExam?.admissionApplication?.studentName || 'Thí sinh'),
		studentCode: toText(candidateExam?.studentCode || candidateExam?.admissionApplication?.studentCode),
		applicationCode: toText(candidateExam?.applicationCode || candidateExam?.admissionApplication?.applicationCode),
		candidateNumber: toText(candidateExam?.candidateNumber),
		examRoom: toText(candidateExam?.examRoom),
		examLocation: toText(candidateExam?.examLocation),
		lookupUrl: DEFAULT_CARD_REMINDER_LOOKUP_URL,
	};
}

async function getViewedOrDownloadedCandidateExamIdSet(candidateExamIds: number[], tenantId: number | string) {
	if (!Array.isArray(candidateExamIds) || candidateExamIds.length === 0) return new Set<number>();

	const logs = await strapi.db.query(CANDIDATE_EXAM_LOG_UID).findMany({
		where: mergeTenantWhere({
			candidateExam: { id: { $in: candidateExamIds } },
			action: { $in: [...CARD_REMINDER_ACTIONS] },
			...buildActiveRecordWhere(),
		}, tenantId),
		select: ['id', 'action'],
		populate: {
			candidateExam: {
				select: ['id'],
			},
		},
	});

	const result = new Set<number>();
	for (const log of logs || []) {
		if (!isReminderViewOrDownloadAction(log?.action)) continue;
		const candidateExamId = Number(log?.candidateExam?.id || log?.candidateExam || 0);
		if (candidateExamId > 0) result.add(candidateExamId);
	}

	return result;
}

async function getScoreLookupCandidateExamIdSet(candidateExamIds: number[], tenantId: number | string) {
	if (!Array.isArray(candidateExamIds) || candidateExamIds.length === 0) return new Set<number>();

	const logs = await strapi.db.query(CANDIDATE_EXAM_LOG_UID).findMany({
		where: mergeTenantWhere({
			candidateExam: { id: { $in: candidateExamIds } },
			action: { $eq: 'score_lookup' },
			...buildActiveRecordWhere(),
		}, tenantId),
		select: ['id'],
		populate: {
			candidateExam: {
				select: ['id'],
			},
		},
	});

	const result = new Set<number>();
	for (const log of logs || []) {
		const candidateExamId = Number(log?.candidateExam?.id || log?.candidateExam || 0);
		if (candidateExamId > 0) result.add(candidateExamId);
	}

	return result;
}

async function hasViewedOrDownloadedCandidateExam(id: number, tenantId: number | string) {
	const count = await strapi.db.query(CANDIDATE_EXAM_LOG_UID).count({
		where: mergeTenantWhere({
			candidateExam: { id: { $eq: id } },
			action: { $in: [...CARD_REMINDER_ACTIONS] },
			...buildActiveRecordWhere(),
		}, tenantId),
	});

	return Number(count || 0) > 0;
}

async function loadCandidateExamReminderCandidates(admissionSeasonId: number, tenantId: number | string) {
	return strapi.db.query(CANDIDATE_EXAM_UID).findMany({
		where: buildActiveCandidateExamWhere(admissionSeasonId, tenantId),
		select: [
			'id',
			'studentCode',
			'applicationCode',
			'fullName',
			'candidateNumber',
			'examRoom',
			'examLocation',
			'cardReminderQueuedAt',
			'cardReminderSentAt',
			'cardReminderCount',
			'cardReminderStatus',
		],
		populate: CANDIDATE_EXAM_REMINDER_POPULATE,
		orderBy: [{ id: 'asc' }],
	});
}

async function loadCandidateExamReminderCandidate(id: number, tenantId: number | string) {
	return strapi.db.query(CANDIDATE_EXAM_UID).findOne({
		where: mergeTenantWhere({ id: { $eq: id }, ...buildActiveRecordWhere() }, tenantId),
		select: [
			'id',
			'studentCode',
			'applicationCode',
			'fullName',
			'candidateNumber',
			'examRoom',
			'examLocation',
			'cardReminderQueuedAt',
			'cardReminderSentAt',
			'cardReminderCount',
			'cardReminderStatus',
		],
		populate: CANDIDATE_EXAM_REMINDER_POPULATE,
	});
}

async function findAdmissionApplicationForReminder(candidateExam: any, tenantId: number | string, admissionSeasonId: number) {
	const applicationCode = toText(candidateExam?.applicationCode).toUpperCase();
	const studentCode = toText(candidateExam?.studentCode).toUpperCase();
	if (!applicationCode && !studentCode) return null;

	const whereParts: Array<Record<string, unknown>> = [
		{ campaign: { id: { $eq: admissionSeasonId } } },
		buildActiveRecordWhere(),
	];

	if (applicationCode) {
		whereParts.push({ applicationCode: { $eq: applicationCode } });
	}
	if (studentCode) {
		whereParts.push({ studentCode: { $eq: studentCode } });
	}

	return strapi.db.query(ADMISSION_APPLICATION_UID).findOne({
		where: mergeTenantWhere({ $and: whereParts }, tenantId),
		select: ['id', 'applicationCode', 'studentCode', 'studentName', 'formData', 'isDeleted'],
		populate: {
			parent: {
				select: ['id', 'username', 'email', 'fullName', 'phone'],
			},
		},
	});
}

async function attachCandidateExamExportApplications(rows: any[], tenantId: number | string, admissionSeasonId: number) {
	const missingRows = (rows || []).filter((row) => !row?.admissionApplication?.parent?.id);
	if (missingRows.length === 0) return rows || [];

	const applicationCodes = Array.from(new Set(
		missingRows
			.map((row) => toText(row?.applicationCode).toUpperCase())
			.filter(Boolean),
	));
	const studentCodes = Array.from(new Set(
		missingRows
			.map((row) => toText(row?.studentCode).toUpperCase())
			.filter(Boolean),
	));

	if (applicationCodes.length === 0 && studentCodes.length === 0) return rows || [];

	const matchClauses: Array<Record<string, unknown>> = [];
	if (applicationCodes.length > 0) {
		matchClauses.push({
			applicationCode: {
				$in: applicationCodes,
			},
		});
	}
	if (studentCodes.length > 0) {
		matchClauses.push({
			studentCode: {
				$in: studentCodes,
			},
		});
	}

	const applications = await strapi.db.query(ADMISSION_APPLICATION_UID).findMany({
		where: mergeTenantWhere({
			$and: [
				{ campaign: { id: { $eq: admissionSeasonId } } },
				buildActiveRecordWhere(),
				{ $or: matchClauses },
			],
		}, tenantId),
		select: ['id', 'applicationCode', 'studentCode', 'studentName', 'formData', 'isDeleted'],
		populate: {
			parent: {
				select: ['id', 'username', 'email', 'fullName', 'phone'],
			},
		},
	});

	const byApplicationCode = new Map<string, any>();
	const byStudentCode = new Map<string, any>();
	for (const application of applications || []) {
		const applicationCode = toText(application?.applicationCode).toUpperCase();
		const studentCode = toText(application?.studentCode).toUpperCase();
		if (applicationCode && !byApplicationCode.has(applicationCode)) {
			byApplicationCode.set(applicationCode, application);
		}
		if (studentCode && !byStudentCode.has(studentCode)) {
			byStudentCode.set(studentCode, application);
		}
	}

	return (rows || []).map((row) => {
		if (row?.admissionApplication?.parent?.id) return row;
		const fallbackApplication = byApplicationCode.get(toText(row?.applicationCode).toUpperCase())
			|| byStudentCode.get(toText(row?.studentCode).toUpperCase());
		if (!fallbackApplication) return row;

		return {
			...row,
			admissionApplication: fallbackApplication,
		};
	});
}

async function resolveReminderRecipientEmail(candidateExam: any, tenantId: number | string, admissionSeasonId: number) {
	const directCandidates = new Set<string>();
	pushUniqueEmail(directCandidates, (candidateExam as any)?.parentEmail);
	pushUniqueEmail(directCandidates, (candidateExam as any)?.email);
	collectEmailsFromStructuredValue(candidateExam, directCandidates, 'candidateExam');
	const directEmail = pickFirstEmail(Array.from(directCandidates));
	if (directEmail) {
		return {
			email: directEmail,
			source: 'candidate_exam',
			application: candidateExam?.admissionApplication || null,
		};
	}

	const admissionApplication = candidateExam?.admissionApplication || await findAdmissionApplicationForReminder(candidateExam, tenantId, admissionSeasonId);
	if (!admissionApplication) {
		return {
			email: '',
			source: 'none',
			application: null,
		};
	}

	const candidates = new Set<string>();
	pushUniqueEmail(candidates, admissionApplication?.parent?.email);
	collectEmailsFromStructuredValue(admissionApplication?.formData, candidates, 'formData');

	return {
		email: pickFirstEmail(Array.from(candidates)),
		source: candidates.size > 0 ? 'admission_application' : 'none',
		application: admissionApplication,
	};
}

async function updateCandidateExamReminderTracking(id: number, data: Record<string, unknown>) {
	await strapi.db.query(CANDIDATE_EXAM_UID).update({
		where: { id },
		data,
	});
}

function pushReminderError(list: Array<Record<string, string>>, candidateExam: any, errorMessage: unknown) {
	if (list.length >= CARD_REMINDER_MAX_ERROR_ITEMS) return;
	list.push({
		studentCode: toText(candidateExam?.studentCode),
		applicationCode: toText(candidateExam?.applicationCode),
		fullName: toText(candidateExam?.fullName),
		errorMessage: toText(errorMessage) || 'Unknown reminder error',
	});
}

function buildCardReminderMailConfig(campaign: any) {
	return {
		subjectTemplate: Handlebars.compile(toText(campaign?.examCardReminderEmailSubject) || DEFAULT_CARD_REMINDER_SUBJECT),
		htmlTemplate: Handlebars.compile(toText(campaign?.examCardReminderEmailHtml) || DEFAULT_CARD_REMINDER_HTML),
	};
}

function resolveReminderBatchLimit(value: unknown) {
	const requested = toPositiveInt(value, CARD_REMINDER_DEFAULT_LIMIT);
	return Math.min(CARD_REMINDER_MAX_LIMIT, requested);
}

function normalizeImportHeader(value: unknown) {
	return toText(value)
		.normalize('NFD')
		.replace(/[\u0300-\u036f]/g, '')
		.replace(/[^a-zA-Z0-9]+/g, ' ')
		.trim()
		.toLowerCase();
}

function normalizeImportText(value: unknown) {
	return toText(value).replace(/\s+/g, ' ').trim();
}

function extractMediaUrl(media: any): string {
	if (!media) return '';
	if (typeof media.url === 'string' && media.url.trim()) return media.url.trim();
	if (typeof media?.data?.attributes?.url === 'string' && media.data.attributes.url.trim()) return media.data.attributes.url.trim();
	if (typeof media?.attributes?.url === 'string' && media.attributes.url.trim()) return media.attributes.url.trim();
	return '';
}

function formatDateDisplay(value: unknown) {
	const text = toText(value);
	if (!text) return '';
	const date = new Date(text);
	if (Number.isNaN(date.getTime())) return '';
	return new Intl.DateTimeFormat('vi-VN', {
		day: '2-digit',
		month: '2-digit',
		year: 'numeric',
	}).format(date);
}

function sanitizeFileNamePart(value: unknown, fallback: string) {
	const text = toText(value)
		.normalize('NFD')
		.replace(/[\u0300-\u036f]/g, '')
		.replace(/[\\/:*?"<>|]+/g, '-')
		.replace(/[^A-Za-z0-9._-]+/g, '-')
		.replace(/-+/g, '-')
		.replace(/^-+|-+$/g, '');

	return text || fallback;
}

function formatScoreDisplay(value: unknown, fallback = '') {
	if (value === null || value === undefined || value === '') return fallback;
	const parsed = Number(value);
	if (!Number.isFinite(parsed)) return fallback;
	return Number.isInteger(parsed) ? String(parsed) : String(Number(parsed.toFixed(2)));
}

function formatGenderDisplay(value: unknown) {
	const normalized = toText(value).trim().toLowerCase();
	if (!normalized) return '';
	if (['male', 'm', 'nam'].includes(normalized)) return 'Nam';
	if (['female', 'f', 'nu', 'nữ'].includes(normalized)) return 'Nữ';
	return toText(value).trim();
}

function resolveAssetBaseUrl(fallback?: string | null) {
	const backendUrl = toText(process.env.BACKEND_URL).trim().replace(/\/+$/, '');
	if (backendUrl) return backendUrl;

	const fallbackUrl = toText(fallback).trim().replace(/\/+$/, '');
	return fallbackUrl;
}

function resolveFrontendBaseUrl() {
	const mainDomain = toText(process.env.MAIN_DOMAIN).trim().replace(/\/+$/, '');
	if (mainDomain) return mainDomain;

	const frontendUrl = toText(process.env.FRONTEND_URL).trim().replace(/\/+$/, '');
	if (frontendUrl) return frontendUrl;

	return 'https://tuyensinhlop6.cva-edu.com';
}

function readUrlParts(value: unknown) {
	const normalizedValue = toText(value).trim();
	if (!normalizedValue) return null;

	try {
		return new URL(normalizedValue);
	} catch {
		return null;
	}
}

function buildTenantAwareAdmissionPublicBasePath(tenantCode: unknown, refererUrl?: unknown) {
	const normalizedTenantCode = toText(tenantCode).trim();
	if (!normalizedTenantCode) return '';

	const parsedRefererUrl = readUrlParts(refererUrl);
	const refererPath = toText(parsedRefererUrl?.pathname).trim();
	const tenantPathPrefix = `/t/${encodeURIComponent(normalizedTenantCode)}`;

	if (refererPath === tenantPathPrefix || refererPath.startsWith(`${tenantPathPrefix}/`)) {
		return tenantPathPrefix;
	}

	return '';
}

function buildExamCardLookupUrl(options: {
	tenantCode?: unknown;
	campaignCode?: unknown;
	studentCode?: unknown;
	applicationCode?: unknown;
	refererUrl?: unknown;
}) {
	const tenantCode = toText(options.tenantCode).trim();
	const campaignCode = encodeURIComponent(toText(options.campaignCode).trim());
	const studentCode = toText(options.studentCode).trim();
	const applicationCode = toText(options.applicationCode).trim();
	const parsedRefererUrl = readUrlParts(options.refererUrl);
	const baseUrl = parsedRefererUrl
		? `${parsedRefererUrl.protocol}//${parsedRefererUrl.host}`.replace(/\/+$/, '')
		: resolveFrontendBaseUrl();
	const tenantAwarePrefix = buildTenantAwareAdmissionPublicBasePath(tenantCode, options.refererUrl);

	if (!campaignCode || !studentCode || !applicationCode) return '';

	const queryString = new URLSearchParams({
		studentCode,
		applicationCode,
	}).toString();

	return `${baseUrl}${tenantAwarePrefix}/tra-cuu-tuyen-sinh/${campaignCode}/the-du-kiem-tra?${queryString}`;
}

async function buildExamCardQrCodeDataUrl(qrCodeUrl: string) {
	const normalizedUrl = toText(qrCodeUrl).trim();
	if (!normalizedUrl) return '';

	return QRCode.toDataURL(normalizedUrl, {
		width: 180,
		margin: 1,
		errorCorrectionLevel: 'M',
	});
}

function normalizeCardImagePath(value: unknown, assetBaseUrl?: string | null) {
	const rawValue = toText(value).trim();
	if (!rawValue) return '';

	const normalizedPath = rawValue.replace(/\\/g, '/');
	if (/^https?:\/\//i.test(normalizedPath) || normalizedPath.startsWith('//')) {
		return normalizedPath;
	}

	const baseUrl = resolveAssetBaseUrl(assetBaseUrl);
	if (normalizedPath.startsWith('/uploads/')) {
		return baseUrl ? `${baseUrl}${normalizedPath}` : normalizedPath;
	}

	const admissionsMatch = normalizedPath.match(/(?:^|\/)(admissions?\/.*)$/i);
	if (admissionsMatch?.[1]) {
		const uploadsPath = `/uploads/${admissionsMatch[1]}`;
		return baseUrl ? `${baseUrl}${uploadsPath}` : uploadsPath;
	}

	const admissionMatch = normalizedPath.match(/^\/admission\/(.+)$/i);
	if (admissionMatch?.[1]) {
		const uploadsPath = `/uploads/${admissionMatch[1]}`;
		return baseUrl ? `${baseUrl}${uploadsPath}` : uploadsPath;
	}

	if (normalizedPath.startsWith('/')) {
		return baseUrl ? `${baseUrl}${normalizedPath}` : normalizedPath;
	}

	const uploadsPath = `/uploads/${normalizedPath.replace(/^\/+/, '')}`;
	return baseUrl ? `${baseUrl}${uploadsPath}` : uploadsPath;
}

function wrapExamCardHtml(content: string) {
	const bodyContent = toText(content).trim() || '<div></div>';
	return [
		'<!doctype html>',
		'<html lang="vi">',
		'<head>',
		'<meta charset="utf-8" />',
		'<meta name="viewport" content="width=device-width, initial-scale=1" />',
		'<title>Thẻ dự kiểm tra</title>',
		'<style>html,body{margin:0;padding:0;background:#fff;color:#111;font-family:Arial,sans-serif;}img{max-width:100%;}*{box-sizing:border-box;}</style>',
		'</head>',
		'<body>',
		bodyContent,
		'</body>',
		'</html>',
	].join('');
}

function getWorkbookFilePath(file: UploadedFileLike) {
	return file.filepath || file.path || file.tempFilePath || '';
}

async function readWorkbookBuffer(file: UploadedFileLike): Promise<Buffer> {
	if (file.buffer && Buffer.isBuffer(file.buffer)) {
		return file.buffer;
	}

	const filePath = getWorkbookFilePath(file);
	if (!filePath) {
		throw new CandidateExamError(400, 'Uploaded file path was not found');
	}

	return fs.readFile(filePath);
}

function findColumnValue(row: Record<string, unknown>, aliases: string[]) {
	const normalizedAliases = aliases.map((item) => normalizeImportHeader(item));
	for (const [key, value] of Object.entries(row || {})) {
		if (normalizedAliases.includes(normalizeImportHeader(key))) {
			return value;
		}
	}
	return '';
}

function splitFullNameParts(fullName: string) {
	const normalized = normalizeImportText(fullName);
	if (!normalized) {
		return { lastName: null, firstName: null };
	}

	const parts = normalized.split(' ');
	if (parts.length === 1) {
		return { lastName: null, firstName: parts[0] };
	}

	const firstName = parts.pop() || null;
	const lastName = parts.length > 0 ? parts.join(' ') : null;
	return { lastName, firstName };
}

function normalizeGenderValue(value: unknown): 'male' | 'female' | 'other' | null {
	const normalized = normalizeImportHeader(value);
	if (!normalized) return null;
	if (['male', 'nam', 'm'].includes(normalized)) return 'male';
	if (['female', 'nu', 'f'].includes(normalized)) return 'female';
	if (['other', 'khac'].includes(normalized)) return 'other';
	return null;
}

function normalizeStatusValue(value: unknown): string | null {
	const normalized = normalizeImportHeader(value);
	if (!normalized) return null;
	const mapping: Record<string, string> = {
		draft: 'draft',
		nhap: 'draft',
		ready: 'ready',
		'san sang': 'ready',
		'card downloaded': 'card_downloaded',
		'da tai the': 'card_downloaded',
		'checked in': 'checked_in',
		'da diem danh': 'checked_in',
		absent: 'absent',
		vang: 'absent',
		completed: 'completed',
		'hoan thanh': 'completed',
		cancelled: 'cancelled',
		huy: 'cancelled',
	};
	return mapping[normalized] || normalized.replace(/\s+/g, '_');
}

function parseDateValue(value: unknown): { value: string | null; error: string | null } {
	if (value === null || value === undefined || value === '') {
		return { value: null, error: 'Ngày sinh là bắt buộc' };
	}

	if (value instanceof Date && !Number.isNaN(value.getTime())) {
		return { value: value.toISOString().slice(0, 10), error: null };
	}

	if (typeof value === 'number' && Number.isFinite(value)) {
		const parsed = XLSX.SSF.parse_date_code(value);
		if (parsed?.y && parsed?.m && parsed?.d) {
			const iso = `${String(parsed.y).padStart(4, '0')}-${String(parsed.m).padStart(2, '0')}-${String(parsed.d).padStart(2, '0')}`;
			return { value: iso, error: null };
		}
	}

	const text = normalizeImportText(value);
	if (!text) {
		return { value: null, error: 'Ngày sinh là bắt buộc' };
	}

	const normalized = text.replace(/\./g, '/').replace(/-/g, '/');
	const slashMatch = normalized.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
	if (slashMatch) {
		const [, day, month, year] = slashMatch;
		const iso = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
		const date = new Date(`${iso}T00:00:00.000Z`);
		if (!Number.isNaN(date.getTime())) return { value: iso, error: null };
	}

	const date = new Date(text);
	if (Number.isNaN(date.getTime())) {
		return { value: null, error: 'Ngày sinh không hợp lệ' };
	}

	return { value: date.toISOString().slice(0, 10), error: null };
}

function parseScoreValue(label: string, value: unknown): { value: number | null; error: string | null; provided: boolean } {
	if (value === null || value === undefined || value === '') {
		return { value: null, error: null, provided: false };
	}

	const text = normalizeImportText(value).replace(/,/g, '.');
	if (!text) {
		return { value: null, error: null, provided: false };
	}

	const parsed = Number(text);
	if (!Number.isFinite(parsed)) {
		return { value: null, error: `${label} phải là số hợp lệ`, provided: true };
	}
	if (parsed < 0) {
		return { value: null, error: `${label} không được âm`, provided: true };
	}

	return { value: parsed, error: null, provided: true };
}

function computeCandidateExamTotalScore(scores: Array<unknown>) {
	const values = scores
		.map((item) => item === null || item === undefined || item === '' ? null : Number(item))
		.filter((item): item is number => Number.isFinite(item));

	if (values.length === 0) return null;
	const total = values.reduce((sum, value) => sum + value, 0);
	return Number.isInteger(total) ? total : Number(total.toFixed(2));
}

function isEmptyImportRow(row: Record<string, unknown>) {
	return Object.values(row || {}).every((value) => normalizeImportText(value) === '');
}

function buildImportKey(studentCode: string | null, applicationCode: string | null) {
	if (!studentCode || !applicationCode) return '';
	return `${studentCode}::${applicationCode}`;
}

function buildImportTemplateWorkbookBuffer() {
	const worksheet = XLSX.utils.aoa_to_sheet([
		['STT', 'Mã học sinh', 'Mã hồ sơ', 'Họ đệm', 'Tên', 'Họ tên', 'Ngày sinh', 'Giới tính', 'Trường tiểu học', 'Đường dẫn ảnh thẻ', 'Số báo danh', 'Địa điểm kiểm tra', 'Phòng kiểm tra', 'Điểm Tiếng Việt', 'Điểm Tiếng Anh', 'Điểm Toán', 'Điểm khuyến khích', 'Tổng điểm', 'Trạng thái', 'Ghi chú'],
		['1', '001315006457', 'CVALB4374', 'Nguyễn Văn', 'A', 'Nguyễn Văn A', '2014-09-01', 'male', 'Tiểu học ABC', '/uploads/admissions/tenant-a/cards/nguyen-van-a.jpg', 'SBD001', 'Cơ sở chính', 'P101', '8.5', '9', '8', '0.5', '26', 'ready', 'Ghi chú mẫu'],
	]);

	const workbook = XLSX.utils.book_new();
	XLSX.utils.book_append_sheet(workbook, worksheet, 'CandidateExams');
	return XLSX.write(workbook, { bookType: 'xlsx', type: 'buffer' });
}

function buildScoreImportTemplateWorkbookBuffer() {
	const worksheet = XLSX.utils.aoa_to_sheet([
		['Số báo danh', 'Điểm Toán', 'Điểm Tiếng Việt', 'Điểm Tiếng Anh', 'Điểm Khuyến Khích', 'Tổng điểm', 'Phúc khảo Toán', 'Phúc khảo Tiếng Việt', 'Phúc khảo Tiếng Anh', 'Điểm sau phúc khảo Toán', 'Điểm sau phúc khảo Tiếng Việt', 'Điểm sau phúc khảo Tiếng Anh'],
		['SBD001', '8.0', '8.5', '9.0', '0.5', '26', 'TRUE', 'FALSE', 'FALSE', '8.5', '', ''],
	]);

	const workbook = XLSX.utils.book_new();
	XLSX.utils.book_append_sheet(workbook, worksheet, 'CandidateExamScores');
	return XLSX.write(workbook, { bookType: 'xlsx', type: 'buffer' });
}

function buildRecheckImportTemplateWorkbookBuffer() {
	const worksheet = XLSX.utils.aoa_to_sheet([
		['Số báo danh', 'Phúc khảo Toán', 'Phúc khảo Tiếng Việt', 'Phúc khảo Tiếng Anh', 'Điểm sau phúc khảo Toán', 'Điểm sau phúc khảo Tiếng Việt', 'Điểm sau phúc khảo Tiếng Anh'],
		['SBD001', 'TRUE', 'FALSE', 'TRUE', '8.5', '', '9.5'],
	]);

	const workbook = XLSX.utils.book_new();
	XLSX.utils.book_append_sheet(workbook, worksheet, 'CandidateExamRecheck');
	return XLSX.write(workbook, { bookType: 'xlsx', type: 'buffer' });
}

type CandidateExamImportPreviewRow = {
	rowIndex: number;
	action: string;
	errors: string[];
	warnings: string[];
	normalizedData: Record<string, unknown> | null;
	changedFields?: string[];
	internalKey?: string;
	internalExistingActive?: any;
	internalExistingDeleted?: any;
	internalExistingId?: string;
	provided?: Record<string, boolean>;
};

function buildImportChangedFields(existingRow: any, normalizedData: Record<string, unknown> | null) {
	if (!existingRow || !normalizedData) return [];

	const fieldLabels: Array<[string, string]> = [
		['fullName', 'Họ tên'],
		['dateOfBirth', 'Ngày sinh'],
		['gender', 'Giới tính'],
		['primarySchool', 'Trường tiểu học'],
		['cardImagePath', 'Đường dẫn ảnh thẻ'],
		['candidateNumber', 'Số báo danh'],
		['examLocation', 'Địa điểm kiểm tra'],
		['examRoom', 'Phòng kiểm tra'],
		['vietnameseScore', 'Điểm Tiếng Việt'],
		['englishScore', 'Điểm Tiếng Anh'],
		['mathScore', 'Điểm Toán'],
		['incentiveScore', 'Điểm khuyến khích'],
		['totalScore', 'Tổng điểm'],
		['candidateExamStatus', 'Trạng thái'],
		['note', 'Ghi chú'],
	];

	return fieldLabels
		.filter(([key]) => JSON.stringify(existingRow?.[key] ?? null) !== JSON.stringify(normalizedData?.[key] ?? null))
		.map(([, label]) => label);
}

async function loadCandidateExamRowsForSeason(admissionSeasonId: number, tenantId: number | string) {
	return strapi.db.query(CANDIDATE_EXAM_UID).findMany({
		where: mergeTenantWhere({ admissionSeason: { id: { $eq: admissionSeasonId } } }, tenantId),
		populate: CANDIDATE_EXAM_POPULATE,
	});
}

function normalizeImportedRow(rawRow: Record<string, unknown>, rowIndex: number): CandidateExamImportPreviewRow {
	if (isEmptyImportRow(rawRow)) {
		return {
			rowIndex,
			action: IMPORT_ACTION_SKIP,
			errors: [],
			warnings: ['Dòng trống được bỏ qua'],
			normalizedData: null,
		};
	}

	const studentCode = normalizeImportText(findColumnValue(rawRow, ['Mã học sinh', 'studentCode', 'student code'])).toUpperCase() || null;
	const applicationCode = normalizeImportText(findColumnValue(rawRow, ['Mã hồ sơ', 'applicationCode', 'application code'])).toUpperCase() || null;
	const familyName = normalizeImportText(findColumnValue(rawRow, ['Họ đệm', 'lastName', 'last name', 'ho dem'])) || null;
	const legacyLastName = normalizeImportText(findColumnValue(rawRow, ['Họ', 'last name legacy', 'ho'])) || null;
	const legacyMiddleName = normalizeImportText(findColumnValue(rawRow, ['Tên đệm', 'middleName', 'middle name'])) || null;
	const lastName = familyName || [legacyLastName, legacyMiddleName].filter(Boolean).join(' ').trim() || null;
	const firstName = normalizeImportText(findColumnValue(rawRow, ['Tên', 'firstName', 'first name'])) || null;
	const fullName = normalizeImportText(findColumnValue(rawRow, ['Họ tên', 'fullName', 'full name'])) || null;
	const dateOfBirthValue = findColumnValue(rawRow, ['Ngày sinh', 'dateOfBirth', 'date of birth', 'dob']);
	const dateOfBirthResult = parseDateValue(dateOfBirthValue);
	const genderRaw = findColumnValue(rawRow, ['Giới tính', 'gender']);
	const gender = normalizeGenderValue(genderRaw);
	const primarySchool = normalizeImportText(findColumnValue(rawRow, ['Trường tiểu học', 'primarySchool', 'primary school'])) || null;
	const cardImagePath = normalizeImportText(findColumnValue(rawRow, ['Đường dẫn ảnh thẻ', 'cardImagePath', 'card image path', 'card image url', 'ảnh thẻ', 'anh the'])) || null;
	const candidateNumber = normalizeImportText(findColumnValue(rawRow, ['Số báo danh', 'candidateNumber', 'candidate number'])).toUpperCase() || null;
	const examLocation = normalizeImportText(findColumnValue(rawRow, ['Địa điểm kiểm tra', 'examLocation', 'exam location'])) || null;
	const examRoom = normalizeImportText(findColumnValue(rawRow, ['Phòng kiểm tra', 'examRoom', 'exam room'])) || null;
	const vietnameseScoreResult = parseScoreValue('Điểm Tiếng Việt', findColumnValue(rawRow, ['Điểm Tiếng Việt', 'vietnameseScore', 'vietnamese score']));
	const englishScoreResult = parseScoreValue('Điểm Tiếng Anh', findColumnValue(rawRow, ['Điểm Tiếng Anh', 'englishScore', 'english score']));
	const mathScoreResult = parseScoreValue('Điểm Toán', findColumnValue(rawRow, ['Điểm Toán', 'mathScore', 'math score']));
	const incentiveScoreResult = parseScoreValue('Điểm khuyến khích', findColumnValue(rawRow, ['Điểm khuyến khích', 'incentiveScore', 'incentive score']));
	const totalScoreResult = parseScoreValue('Tổng điểm', findColumnValue(rawRow, ['Tổng điểm', 'totalScore', 'total score']));
	const statusSource = findColumnValue(rawRow, ['Trạng thái', 'candidateExamStatus', 'candidate exam status']);
	const statusText = normalizeImportText(statusSource);
	const candidateExamStatus = statusText ? normalizeStatusValue(statusSource) : null;
	const note = normalizeImportText(findColumnValue(rawRow, ['Ghi chú', 'note'])) || null;
	const errors: string[] = [];
	const warnings: string[] = [];

	if (!studentCode) errors.push('Mã học sinh là bắt buộc');
	if (!applicationCode) errors.push('Mã hồ sơ là bắt buộc');
	if (!fullName) errors.push('Họ tên là bắt buộc');
	if (dateOfBirthResult.error) errors.push(dateOfBirthResult.error);
	if (vietnameseScoreResult.error) errors.push(vietnameseScoreResult.error);
	if (englishScoreResult.error) errors.push(englishScoreResult.error);
	if (mathScoreResult.error) errors.push(mathScoreResult.error);
	if (incentiveScoreResult.error) errors.push(incentiveScoreResult.error);
	if (totalScoreResult.error) errors.push(totalScoreResult.error);
	if (statusText && (!candidateExamStatus || !CANDIDATE_EXAM_STATUS_VALUES.has(candidateExamStatus))) {
		errors.push('Trạng thái không hợp lệ');
	}
	if (genderRaw && !gender) {
		warnings.push('Giới tính không hợp lệ, hệ thống sẽ bỏ qua giá trị này');
	}

	const normalizedIncentiveScore = incentiveScoreResult.value ?? 0;
	const normalizedTotalScore = totalScoreResult.provided
		? totalScoreResult.value
		: computeCandidateExamTotalScore([
			vietnameseScoreResult.value,
			englishScoreResult.value,
			mathScoreResult.value,
			normalizedIncentiveScore,
		]);

	const derivedNameParts = splitFullNameParts(fullName || '');
	const normalizedData = {
		studentCode,
		applicationCode,
		lastName: lastName || derivedNameParts.lastName,
		firstName: firstName || derivedNameParts.firstName,
		fullName,
		dateOfBirth: dateOfBirthResult.value,
		gender,
		primarySchool,
		cardImagePath,
		candidateNumber,
		examLocation,
		examRoom,
		vietnameseScore: vietnameseScoreResult.value,
		englishScore: englishScoreResult.value,
		mathScore: mathScoreResult.value,
		incentiveScore: normalizedIncentiveScore,
		totalScore: normalizedTotalScore,
		candidateExamStatus: candidateExamStatus || 'draft',
		note,
	};

	return {
		rowIndex,
		action: errors.length > 0 ? IMPORT_ACTION_ERROR : IMPORT_ACTION_CREATE,
		errors,
		warnings,
		normalizedData,
		internalKey: buildImportKey(studentCode, applicationCode),
		provided: {
			candidateExamStatus: Boolean(statusText),
			vietnameseScore: vietnameseScoreResult.provided,
			englishScore: englishScoreResult.provided,
			mathScore: mathScoreResult.provided,
			incentiveScore: incentiveScoreResult.provided,
			totalScore: totalScoreResult.provided,
			candidateNumber: candidateNumber !== null,
			examLocation: examLocation !== null,
			examRoom: examRoom !== null,
			cardImagePath: cardImagePath !== null,
			note: note !== null,
		},
	};
}

function buildPreviewSummary(rows: CandidateExamImportPreviewRow[]) {
	return rows.reduce((summary, row) => {
		summary.totalRows += 1;
		if (row.action === IMPORT_ACTION_CREATE) summary.createCount += 1;
		else if (row.action === IMPORT_ACTION_UPDATE) summary.updateCount += 1;
		else if (row.action === IMPORT_ACTION_ERROR) summary.errorCount += 1;
		else if (row.action === IMPORT_ACTION_DUPLICATE) summary.duplicateInFileCount += 1;
		else if (row.action === IMPORT_ACTION_DELETED_EXISTING) summary.deletedExistingCount += 1;
		else if (row.action === IMPORT_ACTION_SKIP) summary.skippedCount += 1;
		return summary;
	}, {
		totalRows: 0,
		createCount: 0,
		updateCount: 0,
		errorCount: 0,
		duplicateInFileCount: 0,
		deletedExistingCount: 0,
		skippedCount: 0,
	});
}

function toPublicPreviewRow(row: CandidateExamImportPreviewRow) {
	return {
		rowIndex: row.rowIndex,
		action: row.action,
		errors: row.errors,
		warnings: row.warnings,
		normalizedData: row.normalizedData,
		changedFields: row.changedFields || [],
	};
}

async function buildCandidateExamImportPreview(file: UploadedFileLike, admissionSeasonId: unknown, tenantId: number | string) {
	const season = await findAdmissionSeasonOrThrow(admissionSeasonId, tenantId);
	const buffer = await readWorkbookBuffer(file);
	const workbook = XLSX.read(buffer, { type: 'buffer', cellDates: true });
	const sheetName = workbook.SheetNames[0];
	if (!sheetName) {
		throw new CandidateExamError(400, 'Workbook does not contain any sheet');
	}

	const worksheet = workbook.Sheets[sheetName];
	const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(worksheet, {
		defval: '',
		raw: false,
	});

	if (!Array.isArray(rows) || rows.length === 0) {
		throw new CandidateExamError(400, 'Workbook does not contain any data row');
	}

	const existingRows = await loadCandidateExamRowsForSeason(Number(season.id), tenantId);
	const activeByKey = new Map<string, any>();
	const deletedByKey = new Map<string, any>();

	for (const row of existingRows || []) {
		const normalized = normalizeCandidateExamRow(row);
		const key = buildImportKey(normalized.studentCode || null, normalized.applicationCode || null);
		if (key) {
			if (normalized.isDeleted) deletedByKey.set(key, normalized);
			else activeByKey.set(key, normalized);
		}
	}

	const parsedRows = rows.map((row, index) => normalizeImportedRow(row || {}, index + 2));
	const keyCountMap = new Map<string, number>();

	for (const row of parsedRows) {
		if (row.action === IMPORT_ACTION_SKIP) continue;
		if (row.internalKey) {
			keyCountMap.set(row.internalKey, Number(keyCountMap.get(row.internalKey) || 0) + 1);
		}
	}

	for (const row of parsedRows) {
		if (row.action === IMPORT_ACTION_SKIP || !row.normalizedData) continue;

		if (row.internalKey && Number(keyCountMap.get(row.internalKey) || 0) > 1) {
			row.errors.push('Trùng mã học sinh + mã hồ sơ trong file import');
			row.action = IMPORT_ACTION_DUPLICATE;
			continue;
		}

		const existingActive = row.internalKey ? activeByKey.get(row.internalKey) || null : null;
		const existingDeleted = row.internalKey && !existingActive ? (deletedByKey.get(row.internalKey) || null) : null;
		row.internalExistingActive = existingActive;
		row.internalExistingDeleted = existingDeleted;
		row.internalExistingId = String(existingActive?.id || existingDeleted?.id || '');
		row.changedFields = buildImportChangedFields(existingActive || existingDeleted, row.normalizedData);
	}

	for (const row of parsedRows) {
		if (row.action === IMPORT_ACTION_SKIP || !row.normalizedData) continue;

		if (row.errors.length > 0) {
			row.action = IMPORT_ACTION_ERROR;
			continue;
		}

		if (row.internalExistingActive) {
			row.action = IMPORT_ACTION_UPDATE;
		} else if (row.internalExistingDeleted) {
			row.action = IMPORT_ACTION_DELETED_EXISTING;
			row.warnings.push('Đã tồn tại bản ghi trùng khóa nhưng đang ở trạng thái đã xóa');
		} else {
			row.action = IMPORT_ACTION_CREATE;
		}
	}

	const publicRows = parsedRows.map(toPublicPreviewRow);
	return {
		importToken: null,
		admissionSeason: {
			id: season.id,
			name: season.name || '',
			code: season.code || '',
		},
		summary: buildPreviewSummary(parsedRows),
		rows: publicRows,
		internalRows: parsedRows,
	};
}

function buildCandidateExamImportUpdatePayload(row: CandidateExamImportPreviewRow, options: {
	overwriteScores: boolean;
	overwriteExamAssignment: boolean;
}) {
	const normalizedData = (row.normalizedData || {}) as Record<string, unknown>;
	const provided = row.provided || {};
	const payload: Record<string, unknown> = {
		fullName: normalizedData.fullName ?? null,
		lastName: normalizedData.lastName ?? null,
		firstName: normalizedData.firstName ?? null,
		dateOfBirth: normalizedData.dateOfBirth ?? null,
		gender: normalizedData.gender ?? null,
		primarySchool: normalizedData.primarySchool ?? null,
		cardImagePath: normalizedData.cardImagePath ?? null,
		note: normalizedData.note ?? null,
	};

	if (provided.candidateExamStatus) {
		payload.candidateExamStatus = normalizedData.candidateExamStatus ?? 'draft';
	}

	if (options.overwriteScores) {
		payload.vietnameseScore = normalizedData.vietnameseScore ?? null;
		payload.englishScore = normalizedData.englishScore ?? null;
		payload.mathScore = normalizedData.mathScore ?? null;
		payload.incentiveScore = normalizedData.incentiveScore ?? 0;
		payload.totalScore = normalizedData.totalScore ?? null;
	}

	if (options.overwriteExamAssignment) {
		payload.candidateNumber = normalizedData.candidateNumber ?? null;
		payload.examLocation = normalizedData.examLocation ?? null;
		payload.examRoom = normalizedData.examRoom ?? null;
	}

	return payload;
}

function buildScoreImportChangedFields(existingRow: any, normalizedData: Record<string, unknown> | null) {
	if (!existingRow || !normalizedData) return [];

	const fieldLabels: Array<[string, string]> = [
		['mathScore', 'Điểm Toán'],
		['vietnameseScore', 'Điểm Tiếng Việt'],
		['englishScore', 'Điểm Tiếng Anh'],
		['incentiveScore', 'Điểm khuyến khích'],
		['totalScore', 'Tổng điểm'],
		['recheckMath', 'Phúc khảo Toán'],
		['recheckVietnamese', 'Phúc khảo Tiếng Việt'],
		['recheckEnglish', 'Phúc khảo Tiếng Anh'],
		['recheckMathScore', 'Điểm sau phúc khảo Toán'],
		['recheckVietnameseScore', 'Điểm sau phúc khảo Tiếng Việt'],
		['recheckEnglishScore', 'Điểm sau phúc khảo Tiếng Anh'],
	];

	return fieldLabels
		.filter(([key]) => JSON.stringify(existingRow?.[key] ?? null) !== JSON.stringify(normalizedData?.[key] ?? null))
		.map(([, label]) => label);
}

function buildRecheckImportChangedFields(existingRow: any, normalizedData: Record<string, unknown> | null) {
	if (!existingRow || !normalizedData) return [];

	const fieldLabels: Array<[string, string]> = [
		['recheckMath', 'Phúc khảo Toán'],
		['recheckVietnamese', 'Phúc khảo Tiếng Việt'],
		['recheckEnglish', 'Phúc khảo Tiếng Anh'],
		['recheckMathScore', 'Điểm sau phúc khảo Toán'],
		['recheckVietnameseScore', 'Điểm sau phúc khảo Tiếng Việt'],
		['recheckEnglishScore', 'Điểm sau phúc khảo Tiếng Anh'],
		['totalScore', 'Tổng điểm'],
	];

	return fieldLabels
		.filter(([key]) => JSON.stringify(existingRow?.[key] ?? null) !== JSON.stringify(normalizedData?.[key] ?? null))
		.map(([, label]) => label);
}

function normalizeImportedScoreRow(rawRow: Record<string, unknown>, rowIndex: number): CandidateExamImportPreviewRow {
	if (isEmptyImportRow(rawRow)) {
		return {
			rowIndex,
			action: IMPORT_ACTION_SKIP,
			errors: [],
			warnings: ['Dòng trống được bỏ qua'],
			normalizedData: null,
		};
	}

	const candidateNumber = normalizeImportText(findColumnValue(rawRow, ['Số báo danh', 'candidateNumber', 'candidate number'])).toUpperCase() || null;
	const mathScoreResult = parseScoreValue('Điểm Toán', findColumnValue(rawRow, ['Điểm Toán', 'mathScore', 'math score']));
	const vietnameseScoreResult = parseScoreValue('Điểm Tiếng Việt', findColumnValue(rawRow, ['Điểm Tiếng Việt', 'vietnameseScore', 'vietnamese score']));
	const englishScoreResult = parseScoreValue('Điểm Tiếng Anh', findColumnValue(rawRow, ['Điểm Tiếng Anh', 'englishScore', 'english score']));
	const incentiveScoreResult = parseScoreValue('Điểm Khuyến Khích', findColumnValue(rawRow, ['Điểm Khuyến Khích', 'Điểm khuyến khích', 'incentiveScore', 'incentive score']));
	const totalScoreResult = parseScoreValue('Tổng điểm', findColumnValue(rawRow, ['Tổng điểm', 'totalScore', 'total score']));

	// Phúc khảo fields
	const recheckMathFlag = toBooleanFlag(findColumnValue(rawRow, ['Phúc khảo Toán', 'Phuc khao Toan', 'recheckMath', 'recheck_math']))
	const recheckVietnameseFlag = toBooleanFlag(findColumnValue(rawRow, ['Phúc khảo Tiếng Việt', 'Phuc khao Tieng Viet', 'recheckVietnamese', 'recheck_vietnamese']))
	const recheckEnglishFlag = toBooleanFlag(findColumnValue(rawRow, ['Phúc khảo Tiếng Anh', 'Phuc khao Tieng Anh', 'recheckEnglish', 'recheck_english']))

	const recheckMathScoreResult = parseScoreValue('Điểm sau phúc khảo Toán', findColumnValue(rawRow, ['Điểm sau phúc khảo Toán', 'recheckMathScore', 'recheck_math_score']))
	const recheckVietnameseScoreResult = parseScoreValue('Điểm sau phúc khảo Tiếng Việt', findColumnValue(rawRow, ['Điểm sau phúc khảo Tiếng Việt', 'recheckVietnameseScore', 'recheck_vietnamese_score']))
	const recheckEnglishScoreResult = parseScoreValue('Điểm sau phúc khảo Tiếng Anh', findColumnValue(rawRow, ['Điểm sau phúc khảo Tiếng Anh', 'recheckEnglishScore', 'recheck_english_score']))
	const errors: string[] = [];
	const warnings: string[] = [];

	if (!candidateNumber) errors.push('Số báo danh là bắt buộc');
	if (mathScoreResult.error) errors.push(mathScoreResult.error);
	if (vietnameseScoreResult.error) errors.push(vietnameseScoreResult.error);
	if (englishScoreResult.error) errors.push(englishScoreResult.error);
	if (incentiveScoreResult.error) errors.push(incentiveScoreResult.error);
	if (totalScoreResult.error) errors.push(totalScoreResult.error);
	if (recheckMathScoreResult.error) errors.push(recheckMathScoreResult.error);
	if (recheckVietnameseScoreResult.error) errors.push(recheckVietnameseScoreResult.error);
	if (recheckEnglishScoreResult.error) errors.push(recheckEnglishScoreResult.error);
	if (!mathScoreResult.provided) errors.push('Điểm Toán là bắt buộc');
	if (!vietnameseScoreResult.provided) errors.push('Điểm Tiếng Việt là bắt buộc');
	if (!englishScoreResult.provided) errors.push('Điểm Tiếng Anh là bắt buộc');

	const normalizedIncentiveScore = incentiveScoreResult.provided ? (incentiveScoreResult.value ?? 0) : 0;
	const computedTotalScore = computeCandidateExamTotalScore([
		mathScoreResult.value,
		vietnameseScoreResult.value,
		englishScoreResult.value,
		normalizedIncentiveScore,
	]);
	const normalizedTotalScore = totalScoreResult.provided ? totalScoreResult.value : computedTotalScore;

	if (totalScoreResult.provided && computedTotalScore !== null && totalScoreResult.value !== null && Math.abs((totalScoreResult.value || 0) - computedTotalScore) > 0.01) {
		warnings.push('Tổng điểm khác tổng từ các cột môn học và khuyến khích');
	}

	return {
		rowIndex,
		action: errors.length > 0 ? IMPORT_ACTION_ERROR : IMPORT_ACTION_UPDATE,
		errors,
		warnings,
		normalizedData: {
			candidateNumber,
			mathScore: mathScoreResult.value,
			vietnameseScore: vietnameseScoreResult.value,
			englishScore: englishScoreResult.value,
			incentiveScore: normalizedIncentiveScore,
			totalScore: normalizedTotalScore,
			recheckMath: recheckMathFlag,
			recheckVietnamese: recheckVietnameseFlag,
			recheckEnglish: recheckEnglishFlag,
			recheckMathScore: recheckMathScoreResult.value,
			recheckVietnameseScore: recheckVietnameseScoreResult.value,
			recheckEnglishScore: recheckEnglishScoreResult.value,
		},
		internalKey: candidateNumber || '',
	};
}

function normalizeImportedRecheckRow(rawRow: Record<string, unknown>, rowIndex: number): CandidateExamImportPreviewRow {
	if (isEmptyImportRow(rawRow)) {
		return {
			rowIndex,
			action: IMPORT_ACTION_SKIP,
			errors: [],
			warnings: ['Dòng trống được bỏ qua'],
			normalizedData: null,
		};
	}

	const candidateNumber = normalizeImportText(findColumnValue(rawRow, ['Số báo danh', 'candidateNumber', 'candidate number'])).toUpperCase() || null;

	// Phúc khảo flags
	const recheckMathFlag = toBooleanFlag(findColumnValue(rawRow, ['Phúc khảo Toán', 'Phuc khao Toan', 'recheckMath', 'recheck_math']))
	const recheckVietnameseFlag = toBooleanFlag(findColumnValue(rawRow, ['Phúc khảo Tiếng Việt', 'Phuc khao Tieng Viet', 'recheckVietnamese', 'recheck_vietnamese']))
	const recheckEnglishFlag = toBooleanFlag(findColumnValue(rawRow, ['Phúc khảo Tiếng Anh', 'Phuc khao Tieng Anh', 'recheckEnglish', 'recheck_english']))

	// Recheck scores
	const recheckMathScoreResult = parseScoreValue('Điểm sau phúc khảo Toán', findColumnValue(rawRow, ['Điểm sau phúc khảo Toán', 'recheckMathScore', 'recheck_math_score']))
	const recheckVietnameseScoreResult = parseScoreValue('Điểm sau phúc khảo Tiếng Việt', findColumnValue(rawRow, ['Điểm sau phúc khảo Tiếng Việt', 'recheckVietnameseScore', 'recheck_vietnamese_score']))
	const recheckEnglishScoreResult = parseScoreValue('Điểm sau phúc khảo Tiếng Anh', findColumnValue(rawRow, ['Điểm sau phúc khảo Tiếng Anh', 'recheckEnglishScore', 'recheck_english_score']))

	const errors: string[] = [];
	const warnings: string[] = [];

	if (!candidateNumber) errors.push('Số báo danh là bắt buộc');
	if (recheckMathScoreResult.error) errors.push(recheckMathScoreResult.error);
	if (recheckVietnameseScoreResult.error) errors.push(recheckVietnameseScoreResult.error);
	if (recheckEnglishScoreResult.error) errors.push(recheckEnglishScoreResult.error);

	// Cần ít nhất 1 môn có phúc khảo
	if (!recheckMathFlag && !recheckVietnameseFlag && !recheckEnglishFlag) {
		warnings.push('Không có môn nào được phúc khảo');
	}

	return {
		rowIndex,
		action: errors.length > 0 ? IMPORT_ACTION_ERROR : IMPORT_ACTION_UPDATE,
		errors,
		warnings,
		normalizedData: {
			candidateNumber,
			recheckMath: recheckMathFlag,
			recheckVietnamese: recheckVietnameseFlag,
			recheckEnglish: recheckEnglishFlag,
			recheckMathScore: recheckMathScoreResult.value,
			recheckVietnameseScore: recheckVietnameseScoreResult.value,
			recheckEnglishScore: recheckEnglishScoreResult.value,
		},
		internalKey: candidateNumber || '',
	};
}

async function writeImportActionLog(action: 'import_created' | 'import_updated' | 'import_restored', candidateExam: any, userId?: number | null, note?: string | null) {
	if (!candidateExam?.id) return;

	await createCandidateExamLogEntry({
		tenant: candidateExam?.tenant?.id || candidateExam?.tenant,
		admissionSeason: candidateExam?.admissionSeason?.id || candidateExam?.admissionSeason,
		candidateExam: candidateExam.id,
		admissionApplication: candidateExam?.admissionApplication?.id || candidateExam?.admissionApplication || null,
		action,
		actionAt: new Date().toISOString(),
		actionBy: userId || null,
		actorType: 'staff',
		note: note || null,
	});
}

async function syncCandidateExamCardImagePath(id: unknown, cardImagePath: unknown) {
	if (!id) return;

	const knex = strapi.db.connection;
	const hasTable = await knex.schema.hasTable('candidate_exams');
	if (!hasTable) return;
	if (!await knex.schema.hasColumn('candidate_exams', 'card_image_path')) return;

	await knex('candidate_exams').where({ id }).update({
		card_image_path: toText(cardImagePath) || null,
	});
}

async function patchCandidateExamImportUpdate(id: unknown, payload: Record<string, unknown>, tenantId: number | string) {
	if (!id) return null;

	const knex = strapi.db.connection;
	const hasTable = await knex.schema.hasTable('candidate_exams');
	if (!hasTable) return null;

	const patch: Record<string, unknown> = {
		full_name: toText(payload.fullName) || null,
		last_name: toText(payload.lastName) || null,
		first_name: toText(payload.firstName) || null,
		date_of_birth: toText(payload.dateOfBirth) || null,
		gender: toText(payload.gender).toLowerCase() || null,
		primary_school: toText(payload.primarySchool) || null,
		card_image_path: toText(payload.cardImagePath) || null,
		candidate_number: toText(payload.candidateNumber).toUpperCase() || null,
		exam_location: toText(payload.examLocation) || null,
		exam_room: toText(payload.examRoom) || null,
		candidate_exam_status: toText(payload.candidateExamStatus).toLowerCase() || 'draft',
		note: toText(payload.note) || null,
		updated_at: new Date(),
	};

	if (await knex.schema.hasColumn('candidate_exams', 'middle_name')) patch.middle_name = null;

	if (payload.vietnameseScore !== undefined) patch.vietnamese_score = payload.vietnameseScore === '' ? null : payload.vietnameseScore;
	if (payload.englishScore !== undefined) patch.english_score = payload.englishScore === '' ? null : payload.englishScore;
	if (payload.mathScore !== undefined) patch.math_score = payload.mathScore === '' ? null : payload.mathScore;
	if (payload.incentiveScore !== undefined) patch.incentive_score = payload.incentiveScore === '' ? 0 : payload.incentiveScore;
	if (payload.totalScore !== undefined) patch.total_score = payload.totalScore === '' ? null : payload.totalScore;

	// recheck fields
	if (payload.recheckMath !== undefined) patch.recheck_math = payload.recheckMath === true || payload.recheckMath === 'true' || payload.recheckMath === 1 || payload.recheckMath === '1';
	if (payload.recheckVietnamese !== undefined) patch.recheck_vietnamese = payload.recheckVietnamese === true || payload.recheckVietnamese === 'true' || payload.recheckVietnamese === 1 || payload.recheckVietnamese === '1';
	if (payload.recheckEnglish !== undefined) patch.recheck_english = payload.recheckEnglish === true || payload.recheckEnglish === 'true' || payload.recheckEnglish === 1 || payload.recheckEnglish === '1';
	if (payload.recheckMathScore !== undefined) patch.recheck_math_score = payload.recheckMathScore === '' ? null : payload.recheckMathScore;
	if (payload.recheckVietnameseScore !== undefined) patch.recheck_vietnamese_score = payload.recheckVietnameseScore === '' ? null : payload.recheckVietnameseScore;
	if (payload.recheckEnglishScore !== undefined) patch.recheck_english_score = payload.recheckEnglishScore === '' ? null : payload.recheckEnglishScore;

	// recheck fields
	if (payload.recheckMath !== undefined) patch.recheck_math = payload.recheckMath === true || payload.recheckMath === 'true' || payload.recheckMath === 1 || payload.recheckMath === '1';
	if (payload.recheckVietnamese !== undefined) patch.recheck_vietnamese = payload.recheckVietnamese === true || payload.recheckVietnamese === 'true' || payload.recheckVietnamese === 1 || payload.recheckVietnamese === '1';
	if (payload.recheckEnglish !== undefined) patch.recheck_english = payload.recheckEnglish === true || payload.recheckEnglish === 'true' || payload.recheckEnglish === 1 || payload.recheckEnglish === '1';
	if (payload.recheckMathScore !== undefined) patch.recheck_math_score = payload.recheckMathScore === '' ? null : payload.recheckMathScore;
	if (payload.recheckVietnameseScore !== undefined) patch.recheck_vietnamese_score = payload.recheckVietnameseScore === '' ? null : payload.recheckVietnameseScore;
	if (payload.recheckEnglishScore !== undefined) patch.recheck_english_score = payload.recheckEnglishScore === '' ? null : payload.recheckEnglishScore;

	await knex('candidate_exams').where({ id }).update(patch);
	return getCandidateExamDetail(id, tenantId, { includeDeleted: true });
}

async function patchCandidateExamScoreUpdate(id: unknown, payload: Record<string, unknown>, tenantId: number | string) {
	if (!id) return null;

	const knex = strapi.db.connection;
	const hasTable = await knex.schema.hasTable('candidate_exams');
	if (!hasTable) return null;

	const patch: Record<string, unknown> = {
		updated_at: new Date(),
	};

	if (payload.vietnameseScore !== undefined) patch.vietnamese_score = payload.vietnameseScore === '' ? null : payload.vietnameseScore;
	if (payload.englishScore !== undefined) patch.english_score = payload.englishScore === '' ? null : payload.englishScore;
	if (payload.mathScore !== undefined) patch.math_score = payload.mathScore === '' ? null : payload.mathScore;
	if (payload.incentiveScore !== undefined) patch.incentive_score = payload.incentiveScore === '' ? 0 : payload.incentiveScore;
	if (payload.totalScore !== undefined) patch.total_score = payload.totalScore === '' ? null : payload.totalScore;

	await knex('candidate_exams').where({ id }).update(patch);
	return getCandidateExamDetail(id, tenantId, { includeDeleted: true });
}

function applyRecheckToExisting(existingRow: any, recheckData: Record<string, unknown>) {
	// Logic mới: KHÔNG cập nhật điểm gốc (mathScore, vietnameseScore, englishScore)
	// CHỈ cập nhật recheckScore và tính lại tổng điểm
	const result: Record<string, unknown> = {
		recheckMath: recheckData.recheckMath || false,
		recheckVietnamese: recheckData.recheckVietnamese || false,
		recheckEnglish: recheckData.recheckEnglish || false,
		recheckMathScore: recheckData.recheckMathScore,
		recheckVietnameseScore: recheckData.recheckVietnameseScore,
		recheckEnglishScore: recheckData.recheckEnglishScore,
	};

	// Tính tổng điểm mới: dùng recheckScore nếu có và môn đó được phúc khảo, không thì dùng score gốc
	const mathScore = recheckData.recheckMath && recheckData.recheckMathScore !== null && recheckData.recheckMathScore !== undefined
		? recheckData.recheckMathScore
		: existingRow.mathScore;

	const vietnameseScore = recheckData.recheckVietnamese && recheckData.recheckVietnameseScore !== null && recheckData.recheckVietnameseScore !== undefined
		? recheckData.recheckVietnameseScore
		: existingRow.vietnameseScore;

	const englishScore = recheckData.recheckEnglish && recheckData.recheckEnglishScore !== null && recheckData.recheckEnglishScore !== undefined
		? recheckData.recheckEnglishScore
		: existingRow.englishScore;

	const incentiveScore = existingRow.incentiveScore ?? 0;
	result.totalScore = computeCandidateExamTotalScore([mathScore, vietnameseScore, englishScore, incentiveScore]);

	return result;
}

async function patchCandidateExamRecheckUpdate(id: unknown, payload: Record<string, unknown>, existingRow: any, tenantId: number | string) {
	if (!id) return null;

	const knex = strapi.db.connection;
	const hasTable = await knex.schema.hasTable('candidate_exams');
	if (!hasTable) return null;

	const applied = applyRecheckToExisting(existingRow, payload);

	const patch: Record<string, unknown> = {
		recheck_math: applied.recheckMath === true,
		recheck_vietnamese: applied.recheckVietnamese === true,
		recheck_english: applied.recheckEnglish === true,
		recheck_math_score: applied.recheckMathScore === '' || applied.recheckMathScore === undefined ? null : applied.recheckMathScore,
		recheck_vietnamese_score: applied.recheckVietnameseScore === '' || applied.recheckVietnameseScore === undefined ? null : applied.recheckVietnameseScore,
		recheck_english_score: applied.recheckEnglishScore === '' || applied.recheckEnglishScore === undefined ? null : applied.recheckEnglishScore,
		total_score: applied.totalScore === '' || applied.totalScore === undefined ? null : applied.totalScore,
		updated_at: new Date(),
	};

	await knex('candidate_exams').where({ id }).update(patch);
	return getCandidateExamDetail(id, tenantId, { includeDeleted: true });
}

async function buildCandidateExamScoreImportPreview(file: UploadedFileLike, admissionSeasonId: unknown, tenantId: number | string) {
	const season = await findAdmissionSeasonOrThrow(admissionSeasonId, tenantId);
	const buffer = await readWorkbookBuffer(file);
	const workbook = XLSX.read(buffer, { type: 'buffer', cellDates: true });
	const sheetName = workbook.SheetNames[0];
	if (!sheetName) {
		throw new CandidateExamError(400, 'Workbook does not contain any sheet');
	}

	const worksheet = workbook.Sheets[sheetName];
	const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(worksheet, {
		defval: '',
		raw: false,
	});

	if (!Array.isArray(rows) || rows.length === 0) {
		throw new CandidateExamError(400, 'Workbook does not contain any data row');
	}

	const existingRows = await loadCandidateExamRowsForSeason(Number(season.id), tenantId);
	const activeByCandidateNumber = new Map<string, any[]>();
	const deletedByCandidateNumber = new Map<string, any[]>();

	for (const row of existingRows || []) {
		const normalized = normalizeCandidateExamRow(row);
		const normalizedCandidateNumber = toText(normalized.candidateNumber).toUpperCase();
		if (!normalizedCandidateNumber) continue;
		const targetMap = normalized.isDeleted ? deletedByCandidateNumber : activeByCandidateNumber;
		const currentRows = targetMap.get(normalizedCandidateNumber) || [];
		currentRows.push(normalized);
		targetMap.set(normalizedCandidateNumber, currentRows);
	}

	const parsedRows = rows.map((row, index) => normalizeImportedScoreRow(row || {}, index + 2));
	const keyCountMap = new Map<string, number>();

	for (const row of parsedRows) {
		if (row.action === IMPORT_ACTION_SKIP) continue;
		if (row.internalKey) {
			keyCountMap.set(row.internalKey, Number(keyCountMap.get(row.internalKey) || 0) + 1);
		}
	}

	for (const row of parsedRows) {
		if (row.action === IMPORT_ACTION_SKIP || !row.normalizedData) continue;

		if (row.internalKey && Number(keyCountMap.get(row.internalKey) || 0) > 1) {
			row.errors.push('Trùng số báo danh trong file import');
			row.action = IMPORT_ACTION_DUPLICATE;
			continue;
		}

		const existingActiveRows = row.internalKey ? (activeByCandidateNumber.get(row.internalKey) || []) : [];
		const existingDeletedRows = row.internalKey ? (deletedByCandidateNumber.get(row.internalKey) || []) : [];

		if (existingActiveRows.length > 1) {
			row.errors.push('Có nhiều thí sinh trùng số báo danh trong hệ thống');
			row.action = IMPORT_ACTION_ERROR;
			continue;
		}

		if (existingActiveRows.length === 0) {
			row.errors.push(existingDeletedRows.length > 0
				? 'Thí sinh theo số báo danh đang ở trạng thái đã xóa'
				: 'Không tìm thấy thí sinh theo số báo danh');
			row.action = IMPORT_ACTION_ERROR;
			continue;
		}

		row.internalExistingActive = existingActiveRows[0];
		row.internalExistingId = String(existingActiveRows[0]?.id || '');
		row.changedFields = buildScoreImportChangedFields(existingActiveRows[0], row.normalizedData);
		if (!row.changedFields.length) {
			row.action = IMPORT_ACTION_SKIP;
			row.warnings.push('Không có thay đổi điểm');
			continue;
		}

		if (row.errors.length > 0) {
			row.action = IMPORT_ACTION_ERROR;
			continue;
		}

		row.action = IMPORT_ACTION_UPDATE;
	}

	return {
		importToken: null,
		admissionSeason: {
			id: season.id,
			name: season.name || '',
			code: season.code || '',
		},
		summary: buildPreviewSummary(parsedRows),
		rows: parsedRows.map(toPublicPreviewRow),
		internalRows: parsedRows,
	};
}

async function runCandidateExamImportConfirm(file: UploadedFileLike, options: {
	admissionSeasonId: unknown;
	tenantId: number | string;
	userId?: number | null;
	updateExisting?: unknown;
	restoreDeleted?: unknown;
	overwriteScores?: unknown;
	overwriteExamAssignment?: unknown;
}) {
	const preview = await buildCandidateExamImportPreview(file, options.admissionSeasonId, options.tenantId);
	const updateExisting = toBooleanFlag(options.updateExisting, true);
	const restoreDeleted = toBooleanFlag(options.restoreDeleted, false);
	const overwriteScores = toBooleanFlag(options.overwriteScores, false);
	const overwriteExamAssignment = toBooleanFlag(options.overwriteExamAssignment, true);
	const resultRows: Array<Record<string, unknown>> = [];
	const summary = {
		totalRows: 0,
		createdCount: 0,
		updatedCount: 0,
		restoredCount: 0,
		skippedCount: 0,
		errorCount: 0,
	};

	for (const row of preview.internalRows || []) {
		summary.totalRows += 1;
		if (row.action === IMPORT_ACTION_SKIP || row.action === IMPORT_ACTION_DUPLICATE || row.action === IMPORT_ACTION_ERROR) {
			if (row.action === IMPORT_ACTION_ERROR || row.action === IMPORT_ACTION_DUPLICATE) summary.errorCount += 1;
			else summary.skippedCount += 1;
			resultRows.push(toPublicPreviewRow(row));
			continue;
		}

		try {
			if (row.action === IMPORT_ACTION_CREATE) {
				const created = await createCandidateExam({
					admissionSeasonId: preview.admissionSeason.id,
					...(row.normalizedData || {}),
				}, options.tenantId, options.userId);
				await writeImportActionLog('import_created', created, options.userId, 'Imported from Excel');
				summary.createdCount += 1;
				resultRows.push({
					...toPublicPreviewRow(row),
					action: IMPORT_ACTION_CREATE,
					candidateExamId: created.id,
				});
				continue;
			}

			if (row.action === IMPORT_ACTION_UPDATE) {
				if (!updateExisting) {
					summary.skippedCount += 1;
					resultRows.push({
						...toPublicPreviewRow(row),
						action: IMPORT_ACTION_SKIP,
						warnings: [...row.warnings, 'Bỏ qua bản ghi đã tồn tại vì tùy chọn updateExisting đang tắt'],
					});
					continue;
				}

				const updatePayload = buildCandidateExamImportUpdatePayload(row, { overwriteScores, overwriteExamAssignment });
				const updated = await patchCandidateExamImportUpdate(
					row.internalExistingActive?.id,
					updatePayload,
					options.tenantId,
				) || await updateCandidateExam(
					row.internalExistingActive?.id,
					updatePayload,
					options.tenantId,
					options.userId,
				);
				await writeImportActionLog('import_updated', updated, options.userId, 'Updated from Excel import');
				summary.updatedCount += 1;
				resultRows.push({
					...toPublicPreviewRow(row),
					action: IMPORT_ACTION_UPDATE,
					candidateExamId: updated.id,
				});
				continue;
			}

			if (row.action === IMPORT_ACTION_DELETED_EXISTING) {
				if (!restoreDeleted) {
					summary.skippedCount += 1;
					resultRows.push({
						...toPublicPreviewRow(row),
						action: IMPORT_ACTION_SKIP,
						warnings: [...row.warnings, 'Bỏ qua bản ghi đã xóa vì tùy chọn restoreDeleted đang tắt'],
					});
					continue;
				}

				await restoreCandidateExam(row.internalExistingDeleted?.id, options.tenantId, options.userId, 'Restored via Excel import');
				const restoreUpdatePayload = buildCandidateExamImportUpdatePayload(row, { overwriteScores, overwriteExamAssignment });
				const updated = await patchCandidateExamImportUpdate(
					row.internalExistingDeleted?.id,
					restoreUpdatePayload,
					options.tenantId,
				) || await updateCandidateExam(
					row.internalExistingDeleted?.id,
					restoreUpdatePayload,
					options.tenantId,
					options.userId,
				);
				await writeImportActionLog('import_restored', updated, options.userId, 'Restored from Excel import');
				summary.restoredCount += 1;
				resultRows.push({
					...toPublicPreviewRow(row),
					action: 'RESTORED',
					candidateExamId: updated.id,
				});
			}
		} catch (error: any) {
			summary.errorCount += 1;
			resultRows.push({
				...toPublicPreviewRow(row),
				action: IMPORT_ACTION_ERROR,
				errors: [...row.errors, typeof error?.message === 'string' && error.message.trim() ? error.message.trim() : 'Import failed'],
			});
		}
	}

	return {
		admissionSeason: preview.admissionSeason,
		summary,
		rows: resultRows,
		options: {
			updateExisting,
			restoreDeleted,
			overwriteScores,
			overwriteExamAssignment,
		},
	};
}

async function buildCandidateExamRecheckImportPreview(file: UploadedFileLike, admissionSeasonId: unknown, tenantId: number | string) {
	const season = await findAdmissionSeasonOrThrow(admissionSeasonId, tenantId);
	const buffer = await readWorkbookBuffer(file);
	const workbook = XLSX.read(buffer, { type: 'buffer', cellDates: true });
	const sheetName = workbook.SheetNames[0];
	if (!sheetName) {
		throw new CandidateExamError(400, 'Workbook does not contain any sheet');
	}

	const worksheet = workbook.Sheets[sheetName];
	const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(worksheet, {
		defval: '',
		raw: false,
	});

	if (!Array.isArray(rows) || rows.length === 0) {
		throw new CandidateExamError(400, 'Workbook does not contain any data row');
	}

	const existingRows = await loadCandidateExamRowsForSeason(Number(season.id), tenantId);
	const activeByCandidateNumber = new Map<string, any[]>();
	const deletedByCandidateNumber = new Map<string, any[]>();

	for (const row of existingRows || []) {
		const normalized = normalizeCandidateExamRow(row);
		const normalizedCandidateNumber = toText(normalized.candidateNumber).toUpperCase();
		if (!normalizedCandidateNumber) continue;
		const targetMap = normalized.isDeleted ? deletedByCandidateNumber : activeByCandidateNumber;
		const currentRows = targetMap.get(normalizedCandidateNumber) || [];
		currentRows.push(normalized);
		targetMap.set(normalizedCandidateNumber, currentRows);
	}

	const parsedRows = rows.map((row, index) => normalizeImportedRecheckRow(row || {}, index + 2));
	const keyCountMap = new Map<string, number>();

	for (const row of parsedRows) {
		if (row.action === IMPORT_ACTION_SKIP) continue;
		if (row.internalKey) {
			keyCountMap.set(row.internalKey, Number(keyCountMap.get(row.internalKey) || 0) + 1);
		}
	}

	for (const row of parsedRows) {
		if (row.action === IMPORT_ACTION_SKIP || !row.normalizedData) continue;

		if (row.internalKey && Number(keyCountMap.get(row.internalKey) || 0) > 1) {
			row.errors.push('Trùng số báo danh trong file import');
			row.action = IMPORT_ACTION_DUPLICATE;
			continue;
		}

		const existingActiveRows = row.internalKey ? (activeByCandidateNumber.get(row.internalKey) || []) : [];
		const existingDeletedRows = row.internalKey ? (deletedByCandidateNumber.get(row.internalKey) || []) : [];

		if (existingActiveRows.length > 1) {
			row.errors.push('Có nhiều thí sinh trùng số báo danh trong hệ thống');
			row.action = IMPORT_ACTION_ERROR;
			continue;
		}

		if (existingActiveRows.length === 0) {
			row.errors.push(existingDeletedRows.length > 0
				? 'Thí sinh theo số báo danh đang ở trạng thái đã xóa'
				: 'Không tìm thấy thí sinh theo số báo danh');
			row.action = IMPORT_ACTION_ERROR;
			continue;
		}

		row.internalExistingActive = existingActiveRows[0];
		row.internalExistingId = String(existingActiveRows[0]?.id || '');

		// Apply recheck logic để tính điểm mới
		const applied = applyRecheckToExisting(existingActiveRows[0], row.normalizedData);
		row.normalizedData = { ...row.normalizedData, ...applied };
		row.changedFields = buildRecheckImportChangedFields(existingActiveRows[0], row.normalizedData);

		if (!row.changedFields.length) {
			row.action = IMPORT_ACTION_SKIP;
			row.warnings.push('Không có thay đổi');
			continue;
		}

		if (row.errors.length > 0) {
			row.action = IMPORT_ACTION_ERROR;
			continue;
		}

		row.action = IMPORT_ACTION_UPDATE;
	}

	return {
		importToken: null,
		admissionSeason: {
			id: season.id,
			name: season.name || '',
			code: season.code || '',
		},
		summary: buildPreviewSummary(parsedRows),
		rows: parsedRows.map(toPublicPreviewRow),
		internalRows: parsedRows,
	};
}

async function runCandidateExamScoreImportConfirm(file: UploadedFileLike, options: {
	admissionSeasonId: unknown;
	tenantId: number | string;
	userId?: number | null;
}) {
	const preview = await buildCandidateExamScoreImportPreview(file, options.admissionSeasonId, options.tenantId);
	const resultRows: Array<Record<string, unknown>> = [];
	const summary = {
		totalRows: 0,
		createdCount: 0,
		updatedCount: 0,
		restoredCount: 0,
		skippedCount: 0,
		errorCount: 0,
	};

	for (const row of preview.internalRows || []) {
		summary.totalRows += 1;

		if (row.action === IMPORT_ACTION_SKIP) {
			summary.skippedCount += 1;
			resultRows.push(toPublicPreviewRow(row));
			continue;
		}

		if (row.action === IMPORT_ACTION_DUPLICATE || row.action === IMPORT_ACTION_ERROR) {
			summary.errorCount += 1;
			resultRows.push(toPublicPreviewRow(row));
			continue;
		}

		try {
			const updated = await patchCandidateExamScoreUpdate(
				row.internalExistingActive?.id,
				row.normalizedData || {},
				options.tenantId,
			);
			await writeCandidateExamChangeLogs(row.internalExistingActive, updated, options.userId);
			summary.updatedCount += 1;
			resultRows.push({
				...toPublicPreviewRow(row),
				action: IMPORT_ACTION_UPDATE,
				candidateExamId: updated?.id || row.internalExistingActive?.id || null,
			});
		} catch (error: any) {
			summary.errorCount += 1;
			resultRows.push({
				...toPublicPreviewRow(row),
				action: IMPORT_ACTION_ERROR,
				errors: [...row.errors, typeof error?.message === 'string' && error.message.trim() ? error.message.trim() : 'Import failed'],
			});
		}
	}

	return {
		admissionSeason: preview.admissionSeason,
		summary,
		rows: resultRows,
	};
}

async function runCandidateExamRecheckImportConfirm(file: UploadedFileLike, options: {
	admissionSeasonId: unknown;
	tenantId: number | string;
	userId?: number | null;
}) {
	const preview = await buildCandidateExamRecheckImportPreview(file, options.admissionSeasonId, options.tenantId);
	const resultRows: Array<Record<string, unknown>> = [];
	const summary = {
		totalRows: 0,
		createdCount: 0,
		updatedCount: 0,
		restoredCount: 0,
		skippedCount: 0,
		errorCount: 0,
	};

	for (const row of preview.internalRows || []) {
		summary.totalRows += 1;

		if (row.action === IMPORT_ACTION_SKIP) {
			summary.skippedCount += 1;
			resultRows.push(toPublicPreviewRow(row));
			continue;
		}

		if (row.action === IMPORT_ACTION_DUPLICATE || row.action === IMPORT_ACTION_ERROR) {
			summary.errorCount += 1;
			resultRows.push(toPublicPreviewRow(row));
			continue;
		}

		try {
			const updated = await patchCandidateExamRecheckUpdate(
				row.internalExistingActive?.id,
				row.normalizedData || {},
				row.internalExistingActive,
				options.tenantId,
			);
			await writeCandidateExamChangeLogs(row.internalExistingActive, updated, options.userId);
			summary.updatedCount += 1;
			resultRows.push({
				...toPublicPreviewRow(row),
				action: IMPORT_ACTION_UPDATE,
				candidateExamId: updated?.id || row.internalExistingActive?.id || null,
			});
		} catch (error: any) {
			summary.errorCount += 1;
			resultRows.push({
				...toPublicPreviewRow(row),
				action: IMPORT_ACTION_ERROR,
				errors: [...row.errors, typeof error?.message === 'string' && error.message.trim() ? error.message.trim() : 'Import failed'],
			});
		}
	}

	return {
		admissionSeason: preview.admissionSeason,
		summary,
		rows: resultRows,
	};
}

function buildBaseWhere(query: Record<string, unknown>) {
	const whereClauses: Array<Record<string, unknown>> = [];
	const status = toText(query?.candidateExamStatus).toLowerCase();
	const seasonId = parseOptionalPositiveInt(query?.admissionSeasonId ?? query?.admissionSeason);
	const applicationId = parseOptionalPositiveInt(query?.admissionApplicationId ?? query?.admissionApplication);
	const examRoom = toText(query?.examRoom);
	const keyword = toText(query?.q || query?.keyword);

	if (!seasonId) {
		throw new CandidateExamError(400, 'admissionSeasonId is required');
	}

	if (status && status !== 'all') {
		whereClauses.push({ candidateExamStatus: { $eq: status } });
	}
	whereClauses.push({ admissionSeason: { id: { $eq: seasonId } } });
	if (applicationId) {
		whereClauses.push({ admissionApplication: { id: { $eq: applicationId } } });
	}
	if (examRoom) {
		whereClauses.push({ examRoom: { $containsi: examRoom } });
	}
	if (keyword) {
		whereClauses.push({
			$or: [
				{ applicationCode: { $containsi: keyword } },
				{ studentCode: { $containsi: keyword } },
				{ fullName: { $containsi: keyword } },
			],
		});
	}

	if (whereClauses.length === 0) return {};
	if (whereClauses.length === 1) return whereClauses[0];
	return { $and: whereClauses };
}

function hasMeaningfulChange(previous: any, next: any, keys: string[]) {
	return keys.some((key) => {
		const previousValue = previous?.[key] ?? null;
		const nextValue = next?.[key] ?? null;
		return JSON.stringify(previousValue) !== JSON.stringify(nextValue);
	});
}

async function writeCandidateExamChangeLogs(previous: any, next: any, userId?: number | null) {
	if (!next) return;

	const common = {
		tenant: next?.tenant?.id || next?.tenant,
		admissionSeason: next?.admissionSeason?.id || next?.admissionSeason,
		candidateExam: next?.id,
		admissionApplication: next?.admissionApplication?.id || next?.admissionApplication || null,
		actionAt: new Date().toISOString(),
		actionBy: userId || null,
		actorType: 'staff',
	};

	if (!previous) return;

	if (hasMeaningfulChange(previous, next, ['candidateExamStatus'])) {
		await createCandidateExamLogEntry({
			...common,
			action: 'status_changed',
			oldValue: { candidateExamStatus: previous?.candidateExamStatus ?? null },
			newValue: { candidateExamStatus: next?.candidateExamStatus ?? null },
		});
	}

	if (hasMeaningfulChange(previous, next, ['candidateNumber', 'examRoom', 'examLocation'])) {
		await createCandidateExamLogEntry({
			...common,
			action: 'room_assigned',
			oldValue: {
				candidateNumber: previous?.candidateNumber ?? null,
				examRoom: previous?.examRoom ?? null,
				examLocation: previous?.examLocation ?? null,
			},
			newValue: {
				candidateNumber: next?.candidateNumber ?? null,
				examRoom: next?.examRoom ?? null,
				examLocation: next?.examLocation ?? null,
			},
		});
	}

    if (hasMeaningfulChange(previous, next, ['vietnameseScore', 'englishScore', 'mathScore', 'incentiveScore', 'totalScore', 'recheckMath', 'recheckVietnamese', 'recheckEnglish', 'recheckMathScore', 'recheckVietnameseScore', 'recheckEnglishScore'])) {
		await createCandidateExamLogEntry({
			...common,
			action: 'score_updated',
			oldValue: {
				vietnameseScore: previous?.vietnameseScore ?? null,
				englishScore: previous?.englishScore ?? null,
				mathScore: previous?.mathScore ?? null,
				incentiveScore: previous?.incentiveScore ?? 0,
				totalScore: previous?.totalScore ?? null,
				recheckMath: previous?.recheckMath ?? false,
				recheckVietnamese: previous?.recheckVietnamese ?? false,
				recheckEnglish: previous?.recheckEnglish ?? false,
				recheckMathScore: previous?.recheckMathScore ?? null,
				recheckVietnameseScore: previous?.recheckVietnameseScore ?? null,
				recheckEnglishScore: previous?.recheckEnglishScore ?? null,
			},
			newValue: {
				vietnameseScore: next?.vietnameseScore ?? null,
				englishScore: next?.englishScore ?? null,
				mathScore: next?.mathScore ?? null,
				incentiveScore: next?.incentiveScore ?? 0,
				totalScore: next?.totalScore ?? null,
				recheckMath: next?.recheckMath ?? false,
				recheckVietnamese: next?.recheckVietnamese ?? false,
				recheckEnglish: next?.recheckEnglish ?? false,
				recheckMathScore: next?.recheckMathScore ?? null,
				recheckVietnameseScore: next?.recheckVietnameseScore ?? null,
				recheckEnglishScore: next?.recheckEnglishScore ?? null,
			},
		});
	}

	if (hasMeaningfulChange(previous, next, ['note'])) {
		await createCandidateExamLogEntry({
			...common,
			action: 'note_updated',
			oldValue: { note: previous?.note ?? null },
			newValue: { note: next?.note ?? null },
		});
	}

	if (hasMeaningfulChange(previous, next, ['cardImagePath'])) {
		await createCandidateExamLogEntry({
			...common,
			action: 'note_updated',
			oldValue: { cardImagePath: previous?.cardImagePath ?? null },
			newValue: { cardImagePath: next?.cardImagePath ?? null },
		});
	}
}

async function findAdmissionSeasonOrThrow(admissionSeasonId: unknown, tenantId: number | string) {
	const seasonId = parseOptionalPositiveInt(admissionSeasonId);
	if (!seasonId) {
		throw new CandidateExamError(400, 'admissionSeasonId is required');
	}

	const season = await strapi.db.query(CAMPAIGN_UID).findOne({
		where: mergeTenantWhere({ id: seasonId }, tenantId),
		select: ['id', 'name', 'code', 'year', 'campaignStatus', 'startDate', 'endDate', 'createdAt', 'examCardReminderEmailSubject', 'examCardReminderEmailHtml'],
	});

	if (!season?.id) {
		throw new CandidateExamError(404, 'Admission season not found');
	}

	return season;
}

export function normalizeCandidateExamRow(row: any, options: { assetBaseUrl?: string | null } = {}) {
	return {
		id: row?.id,
		studentCode: row?.studentCode || '',
		applicationCode: row?.applicationCode || '',
		fullName: row?.fullName || '',
		lastName: row?.lastName || '',
		firstName: row?.firstName || '',
		dateOfBirth: row?.dateOfBirth || null,
		gender: row?.gender || null,
		primarySchool: row?.primarySchool || '',
		cardImagePath: normalizeCardImagePath(row?.cardImagePath, options.assetBaseUrl),
		examLocation: row?.examLocation || '',
		examRoom: row?.examRoom || '',
		candidateNumber: row?.candidateNumber || '',
		vietnameseScore: row?.vietnameseScore ?? row?.vietnamese_score ?? null,
		englishScore: row?.englishScore ?? row?.english_score ?? null,
		mathScore: row?.mathScore ?? row?.math_score ?? null,
		recheckMath: (row?.recheckMath === true) || (row?.recheck_math === true) || false,
		recheckVietnamese: (row?.recheckVietnamese === true) || (row?.recheck_vietnamese === true) || false,
		recheckEnglish: (row?.recheckEnglish === true) || (row?.recheck_english === true) || false,
		recheckMathScore: row?.recheckMathScore ?? row?.recheck_math_score ?? null,
		recheckVietnameseScore: row?.recheckVietnameseScore ?? row?.recheck_vietnamese_score ?? null,
		recheckEnglishScore: row?.recheckEnglishScore ?? row?.recheck_english_score ?? null,
		incentiveScore: row?.incentiveScore ?? 0,
		totalScore: row?.totalScore ?? null,
		candidateExamStatus: row?.candidateExamStatus || 'draft',
		cardFirstViewedAt: row?.cardFirstViewedAt || null,
		cardFirstPrintedAt: row?.cardFirstPrintedAt || null,
		cardFirstDownloadedAt: row?.cardFirstDownloadedAt || null,
		cardDownloadCount: Number(row?.cardDownloadCount || 0),
		cardReminderQueuedAt: row?.cardReminderQueuedAt || null,
		cardReminderSentAt: row?.cardReminderSentAt || null,
		cardReminderCount: Number(row?.cardReminderCount || 0),
		cardReminderStatus: toText(row?.cardReminderStatus).toLowerCase() || 'pending',
		note: row?.note || '',
		isDeleted: row?.isDeleted === true,
		deletedAt: row?.deletedAt || null,
		deleteReason: row?.deleteReason || null,
		createdAt: row?.createdAt || null,
		updatedAt: row?.updatedAt || null,
		admissionSeason: row?.admissionSeason
			? {
				id: row.admissionSeason.id,
				name: row.admissionSeason.name || '',
				code: row.admissionSeason.code || '',
				schoolYear: row.admissionSeason.year || null,
				status: row.admissionSeason.campaignStatus || null,
			}
			: null,
		admissionApplication: row?.admissionApplication
			? {
				id: row.admissionApplication.id,
				applicationCode: row.admissionApplication.applicationCode || '',
				studentCode: row.admissionApplication.studentCode || '',
				studentName: row.admissionApplication.studentName || '',
				admissionStatus: row.admissionApplication.admissionStatus || null,
				reviewStatus: row.admissionApplication.reviewStatus || null,
			}
			: null,
		cardFirstDownloadedBy: row?.cardFirstDownloadedBy
			? {
				id: row.cardFirstDownloadedBy.id,
				fullName: row.cardFirstDownloadedBy.fullName || row.cardFirstDownloadedBy.username || '',
			}
			: null,
	};
}

function resolveCandidateExamExportParent(row: any) {
	const parent = row?.admissionApplication?.parent || null;
	return {
		fullName: toText(parent?.fullName || parent?.username || parent?.email),
		phone: toText(parent?.phone),
		email: toText(parent?.email).toLowerCase(),
	};
}

function buildCandidateExamExportRow(row: any) {
	const parent = resolveCandidateExamExportParent(row);
	return {
		'Mã học sinh': toText(row?.studentCode),
		'Mã hồ sơ': toText(row?.applicationCode),
		'Họ tên': toText(row?.fullName),
		'Ngày sinh': formatDateDisplay(row?.dateOfBirth),
		'Số điện thoại liên hệ của phụ huynh': parent.phone,
		'Họ tên phụ huynh': parent.fullName,
		'Tình trạng phụ huynh xem thẻ hay chưa': row?.cardFirstViewedAt ? 'Đã xem' : 'Chưa xem',
		'Điểm Toán': formatScoreDisplay(row?.mathScore),
		'Điểm Tiếng Việt': formatScoreDisplay(row?.vietnameseScore),
		'Điểm Tiếng Anh': formatScoreDisplay(row?.englishScore),
		'Điểm khuyến khích': formatScoreDisplay(row?.incentiveScore),
		'Tổng điểm': formatScoreDisplay(row?.totalScore),
		'Phúc khảo Toán': row?.recheckMath ? 'Có' : 'Không',
		'Phúc khảo Tiếng Việt': row?.recheckVietnamese ? 'Có' : 'Không',
		'Phúc khảo Tiếng Anh': row?.recheckEnglish ? 'Có' : 'Không',
		'Điểm sau phúc khảo Toán': formatScoreDisplay(row?.recheckMathScore),
		'Điểm sau phúc khảo Tiếng Việt': formatScoreDisplay(row?.recheckVietnameseScore),
		'Điểm sau phúc khảo Tiếng Anh': formatScoreDisplay(row?.recheckEnglishScore),
	};
}

function buildCandidateExamExportWorksheet(rows: any[]) {
	const headers = [
		'Mã học sinh',
		'Mã hồ sơ',
		'Họ tên',
		'Ngày sinh',
		'Số điện thoại liên hệ của phụ huynh',
		'Họ tên phụ huynh',
		'Tình trạng phụ huynh xem thẻ hay chưa',
		'Điểm Toán',
		'Điểm Tiếng Việt',
		'Điểm Tiếng Anh',
		'Điểm khuyến khích',
		'Tổng điểm',
		'Phúc khảo Toán',
		'Phúc khảo Tiếng Việt',
		'Phúc khảo Tiếng Anh',
		'Điểm sau phúc khảo Toán',
		'Điểm sau phúc khảo Tiếng Việt',
		'Điểm sau phúc khảo Tiếng Anh',
	];

	const exportRows = (rows || []).map((row) => buildCandidateExamExportRow(row));
	if (exportRows.length === 0) {
		return XLSX.utils.aoa_to_sheet([headers]);
	}

	return XLSX.utils.json_to_sheet(exportRows, { header: headers });
}

function isAuditAwareQuery(query: Record<string, unknown>) {
	const cardViewStatus = toText(query?.cardViewStatus).toLowerCase();
	const cardPrintStatus = toText(query?.cardPrintStatus).toLowerCase();
	const scoreLookupStatus = toText(query?.scoreLookupStatus).toLowerCase();
	const sortBy = toText(query?.sortBy);
	return Boolean(
		cardViewStatus === 'viewed'
		|| cardViewStatus === 'not_viewed'
		|| cardPrintStatus === 'printed'
		|| cardPrintStatus === 'not_printed'
		|| scoreLookupStatus === 'looked_up'
		|| scoreLookupStatus === 'not_looked_up'
		|| sortBy === 'cardFirstViewedAt'
		|| sortBy === 'cardFirstPrintedAt',
	);
}

function filterRowsByAuditStatus(rows: any[], query: Record<string, unknown>) {
	const cardViewStatus = toText(query?.cardViewStatus).toLowerCase();
	const cardPrintStatus = toText(query?.cardPrintStatus).toLowerCase();
	const scoreLookupStatus = toText(query?.scoreLookupStatus).toLowerCase();

	return (rows || []).filter((row) => {
		if (cardViewStatus === 'viewed' && !row?.cardFirstViewedAt) return false;
		if (cardViewStatus === 'not_viewed' && row?.cardFirstViewedAt) return false;
		if (cardPrintStatus === 'printed' && !row?.cardFirstPrintedAt) return false;
		if (cardPrintStatus === 'not_printed' && row?.cardFirstPrintedAt) return false;
		if (scoreLookupStatus === 'looked_up' && !row?.scoreFirstLookupAt) return false;
		if (scoreLookupStatus === 'not_looked_up' && row?.scoreFirstLookupAt) return false;
		return true;
	});
}

function sortRowsByAuditField(rows: any[], query: Record<string, unknown>) {
	const sortBy = toText(query?.sortBy);
	if (sortBy !== 'cardFirstViewedAt' && sortBy !== 'cardFirstPrintedAt') {
		return rows;
	}

	const sortOrder = toText(query?.sortOrder).toLowerCase() === 'asc' ? 'asc' : 'desc';
	const direction = sortOrder === 'asc' ? 1 : -1;
	const sortedRows = [...(rows || [])];

	sortedRows.sort((left, right) => {
		const leftValue = left?.[sortBy] ? new Date(left[sortBy]).getTime() : null;
		const rightValue = right?.[sortBy] ? new Date(right[sortBy]).getTime() : null;

		if (leftValue === null && rightValue === null) return Number(right?.id || 0) - Number(left?.id || 0);
		if (leftValue === null) return 1;
		if (rightValue === null) return -1;
		if (leftValue === rightValue) return (Number(right?.id || 0) - Number(left?.id || 0)) * direction;
		return leftValue > rightValue ? direction : -direction;
	});

	return sortedRows;
}

async function attachCandidateExamCardAudit(rows: any[], tenantId: number | string) {
	const candidateExamIds = (rows || []).map((row) => Number(row?.id || 0)).filter((id) => id > 0);
	if (candidateExamIds.length === 0) return rows || [];

	const logs = await strapi.db.query(CANDIDATE_EXAM_LOG_UID).findMany({
		where: mergeTenantWhere({
			candidateExam: {
				id: {
					$in: candidateExamIds,
				},
			},
			action: {
				$in: ['card_view', 'card_print', 'score_lookup'],
			},
		}, tenantId),
		select: ['id', 'action', 'actionAt', 'actorType'],
		populate: {
			candidateExam: {
				select: ['id'],
			},
		},
		orderBy: [{ actionAt: 'asc' }, { id: 'asc' }],
	});

	const auditMap = new Map<number, { cardFirstViewedAt: string | null; cardFirstPrintedAt: string | null; scoreFirstLookupAt: string | null }>();
	for (const log of logs || []) {
		const candidateExamId = Number(log?.candidateExam?.id || log?.candidateExam || 0);
		if (candidateExamId <= 0) continue;

		const current = auditMap.get(candidateExamId) || {
			cardFirstViewedAt: null,
			cardFirstPrintedAt: null,
			scoreFirstLookupAt: null,
		};

		if (log?.action === 'card_view' && log?.actorType === 'parent' && !current.cardFirstViewedAt) {
			current.cardFirstViewedAt = log?.actionAt || null;
		}
		if (log?.action === 'card_print' && !current.cardFirstPrintedAt) {
			current.cardFirstPrintedAt = log?.actionAt || null;
		}
		if (log?.action === 'score_lookup' && !current.scoreFirstLookupAt) {
			current.scoreFirstLookupAt = log?.actionAt || null;
		}

		auditMap.set(candidateExamId, current);
	}

	return rows.map((row) => {
		const audit = auditMap.get(Number(row?.id || 0));
		if (!audit) return row;
		return {
			...row,
			cardFirstViewedAt: audit.cardFirstViewedAt,
			cardFirstPrintedAt: audit.cardFirstPrintedAt,
			scoreFirstLookupAt: audit.scoreFirstLookupAt,
		};
	});
}

function normalizeCreateOrUpdatePayload(payload: Record<string, unknown> = {}, options: { includeSeason?: boolean }) {
	const data: Record<string, unknown> = {
		studentCode: toText(payload.studentCode).toUpperCase() || null,
		applicationCode: toText(payload.applicationCode).toUpperCase() || null,
		fullName: toText(payload.fullName) || null,
		lastName: toText(payload.lastName) || null,
		firstName: toText(payload.firstName) || null,
		dateOfBirth: toText(payload.dateOfBirth) || null,
		gender: toText(payload.gender).toLowerCase() || null,
		primarySchool: toText(payload.primarySchool) || null,
		cardImagePath: toText(payload.cardImagePath) || null,
		examLocation: toText(payload.examLocation) || null,
		examRoom: toText(payload.examRoom) || null,
		candidateNumber: toText(payload.candidateNumber).toUpperCase() || null,
		vietnameseScore: payload.vietnameseScore === '' || payload.vietnameseScore === undefined ? null : payload.vietnameseScore,
		englishScore: payload.englishScore === '' || payload.englishScore === undefined ? null : payload.englishScore,
		mathScore: payload.mathScore === '' || payload.mathScore === undefined ? null : payload.mathScore,
		incentiveScore: payload.incentiveScore === '' || payload.incentiveScore === undefined ? 0 : payload.incentiveScore,
		totalScore: payload.totalScore === '' || payload.totalScore === undefined
			? computeCandidateExamTotalScore([
				payload.vietnameseScore,
				payload.englishScore,
				payload.mathScore,
				payload.incentiveScore === '' || payload.incentiveScore === undefined ? 0 : payload.incentiveScore,
			])
			: payload.totalScore,
		recheckMath: payload.recheckMath === true || payload.recheckMath === 'true' || payload.recheckMath === 1 || payload.recheckMath === '1',
		recheckVietnamese: payload.recheckVietnamese === true || payload.recheckVietnamese === 'true' || payload.recheckVietnamese === 1 || payload.recheckVietnamese === '1',
		recheckEnglish: payload.recheckEnglish === true || payload.recheckEnglish === 'true' || payload.recheckEnglish === 1 || payload.recheckEnglish === '1',
		recheckMathScore: payload.recheckMathScore === '' || payload.recheckMathScore === undefined ? null : payload.recheckMathScore,
		recheckVietnameseScore: payload.recheckVietnameseScore === '' || payload.recheckVietnameseScore === undefined ? null : payload.recheckVietnameseScore,
		recheckEnglishScore: payload.recheckEnglishScore === '' || payload.recheckEnglishScore === undefined ? null : payload.recheckEnglishScore,
		candidateExamStatus: toText(payload.candidateExamStatus).toLowerCase() || 'draft',
		note: toText(payload.note) || null,
	};

	if (options.includeSeason) {
		data.admissionSeason = parseOptionalPositiveInt(payload.admissionSeasonId ?? payload.admissionSeason);
	}

	if (payload.admissionApplicationId || payload.admissionApplication) {
		data.admissionApplication = parseOptionalPositiveInt(payload.admissionApplicationId ?? payload.admissionApplication);
	}

	return data;
}

export async function getCandidateExamAdmissionSeasons(tenantId: number | string) {
	const rows = await strapi.db.query(CAMPAIGN_UID).findMany({
		where: mergeTenantWhere({}, tenantId),
		select: ['id', 'name', 'code', 'year', 'campaignStatus', 'startDate', 'endDate', 'createdAt'],
		orderBy: [
			{ year: 'desc' },
			{ startDate: 'desc' },
			{ createdAt: 'desc' },
		],
	});

	return (rows || []).map((row: any) => ({
		id: row.id,
		name: row.name || '',
		code: row.code || '',
		schoolYear: row.year || null,
		status: row.campaignStatus || 'draft',
	}));
}

export async function getCandidateExamCardReminderSummary(query: Record<string, unknown> = {}, tenantId: number | string): Promise<CandidateExamReminderSummary> {
	const admissionSeason = await findAdmissionSeasonOrThrow(query?.admissionCampaignId ?? query?.admissionSeasonId ?? query?.admissionSeason, tenantId);
	const rows = await strapi.db.query(CANDIDATE_EXAM_UID).findMany({
		where: buildActiveCandidateExamWhere(Number(admissionSeason.id), tenantId),
		select: ['id', 'cardReminderStatus'],
		orderBy: [{ id: 'asc' }],
	});
	const candidateExamIds = (rows || []).map((row: any) => Number(row?.id || 0)).filter((id) => id > 0);
	const [viewedIdSet, scoreLookupIdSet] = await Promise.all([
		getViewedOrDownloadedCandidateExamIdSet(candidateExamIds, tenantId),
		getScoreLookupCandidateExamIdSet(candidateExamIds, tenantId),
	]);

	let reminderSentCount = 0;
	let reminderPendingCount = 0;
	let reminderFailedCount = 0;
	let targetToReminderCount = 0;

	for (const row of rows || []) {
		const normalizedStatus = normalizeReminderStatus(row?.cardReminderStatus);
		const candidateExamId = Number(row?.id || 0);
		const viewedOrDownloaded = viewedIdSet.has(candidateExamId);

		if (normalizedStatus === 'sent') reminderSentCount += 1;
		else if (normalizedStatus === 'failed') reminderFailedCount += 1;
		else if (!normalizedStatus || normalizedStatus === 'pending') reminderPendingCount += 1;

		if (!viewedOrDownloaded && isPendingReminderStatus(normalizedStatus)) {
			targetToReminderCount += 1;
		}
	}

	return {
		totalCandidates: rows.length,
		viewedOrDownloadedCount: viewedIdSet.size,
		notViewedOrDownloadedCount: Math.max(0, rows.length - viewedIdSet.size),
		scoreLookupCount: scoreLookupIdSet.size,
		scoreNotLookupCount: Math.max(0, rows.length - scoreLookupIdSet.size),
		reminderSentCount,
		reminderPendingCount,
		reminderFailedCount,
		targetToReminderCount,
	};
}

export async function sendCandidateExamCardRemindersDirect(payload: Record<string, unknown> = {}, tenantId: number | string, userId?: number | null) {
	const queueConfig = resolveMailQueueConfig();
	if (queueConfig.useRedisQueue || queueConfig.sendMode !== 'direct') {
		throw new CandidateExamError(409, 'Hệ thống hiện không ở chế độ gửi email trực tiếp.');
	}

	const admissionSeason = await findAdmissionSeasonOrThrow(payload?.admissionCampaignId ?? payload?.admissionSeasonId ?? payload?.admissionSeason, tenantId);
	const limit = resolveReminderBatchLimit(payload?.limit);
	const rows = await loadCandidateExamReminderCandidates(Number(admissionSeason.id), tenantId);
	const candidateExamIds = rows.map((row: any) => Number(row?.id || 0)).filter((id) => id > 0);
	const viewedIdSet = await getViewedOrDownloadedCandidateExamIdSet(candidateExamIds, tenantId);
	const allTargets = rows.filter((row: any) => {
		const candidateExamId = Number(row?.id || 0);
		if (candidateExamId <= 0) return false;
		if (viewedIdSet.has(candidateExamId)) return false;
		if (row?.cardReminderSentAt) return false;
		return isPendingReminderStatus(row?.cardReminderStatus);
	});
	const selectedTargets = allTargets.slice(0, limit);
	const { subjectTemplate, htmlTemplate } = buildCardReminderMailConfig(admissionSeason);
	const result = {
		totalTarget: allTargets.length,
		processedCount: 0,
		sentCount: 0,
		failedCount: 0,
		skippedNoEmail: 0,
		skippedAlreadyViewed: 0,
		skippedAlreadyReminded: 0,
		remainingCount: Math.max(0, allTargets.length - selectedTargets.length),
		errors: [] as Array<Record<string, string>>,
	};

	for (let index = 0; index < selectedTargets.length; index += 1) {
		const target = selectedTargets[index];
		const freshCandidateExam = await loadCandidateExamReminderCandidate(Number(target.id), tenantId);
		if (!freshCandidateExam?.id) continue;

		const alreadyViewed = await hasViewedOrDownloadedCandidateExam(Number(freshCandidateExam.id), tenantId);
		if (alreadyViewed) {
			result.processedCount += 1;
			result.skippedAlreadyViewed += 1;
			continue;
		}

		if (
			freshCandidateExam?.cardReminderSentAt
			|| isAlreadyRemindedOrBlockedStatus(freshCandidateExam?.cardReminderStatus)
			|| !isPendingReminderStatus(freshCandidateExam?.cardReminderStatus)
		) {
			result.processedCount += 1;
			result.skippedAlreadyReminded += 1;
			continue;
		}

		const recipient = await resolveReminderRecipientEmail(freshCandidateExam, tenantId, Number(admissionSeason.id));
		if (!recipient.email) {
			result.processedCount += 1;
			result.skippedNoEmail += 1;
			continue;
		}

		await updateCandidateExamReminderTracking(Number(freshCandidateExam.id), {
			cardReminderStatus: 'sending',
			cardReminderQueuedAt: null,
		});

		const templateContext = buildCandidateExamReminderTemplateContext({
			...freshCandidateExam,
			admissionApplication: recipient.application || freshCandidateExam?.admissionApplication || null,
		});
		const now = new Date().toISOString();

		try {
			const mailResult = await enqueueMail({
				strapi,
				tenantId,
				mailType: 'candidate_exam_card_reminder',
				to: recipient.email,
				subject: subjectTemplate(templateContext),
				html: htmlTemplate(templateContext),
				metadata: {
					source: 'candidate-exam.sendCandidateExamCardRemindersDirect',
					candidateExamId: freshCandidateExam.id,
					admissionCampaignId: admissionSeason.id,
					recipientSource: recipient.source,
				},
			});

			if (mailResult?.ok !== true) {
				const errorMessage = toText(mailResult?.lastError || mailResult?.lastProviderError || mailResult?.fallbackError || 'Email gửi thất bại');
				throw new Error(errorMessage);
			}

			await updateCandidateExamReminderTracking(Number(freshCandidateExam.id), {
				cardReminderQueuedAt: null,
				cardReminderSentAt: now,
				cardReminderCount: Math.max(0, Number(freshCandidateExam?.cardReminderCount || 0)) + 1,
				cardReminderStatus: 'sent',
			});

			await createCandidateExamLogEntry({
				tenant: tenantId,
				admissionSeason: admissionSeason.id,
				candidateExam: freshCandidateExam.id,
				admissionApplication: recipient.application?.id || freshCandidateExam?.admissionApplication?.id || freshCandidateExam?.admissionApplication || null,
				action: 'card_reminder_sent',
				actionAt: now,
				actionBy: userId || null,
				actorType: 'staff',
				note: 'Email đã gửi trực tiếp',
			});

			result.processedCount += 1;
			result.sentCount += 1;
		} catch (error: any) {
			const shortMessage = toText(error?.message) || 'Email gửi thất bại';
			await updateCandidateExamReminderTracking(Number(freshCandidateExam.id), {
				cardReminderQueuedAt: null,
				cardReminderStatus: 'failed',
			});

			await createCandidateExamLogEntry({
				tenant: tenantId,
				admissionSeason: admissionSeason.id,
				candidateExam: freshCandidateExam.id,
				admissionApplication: recipient.application?.id || freshCandidateExam?.admissionApplication?.id || freshCandidateExam?.admissionApplication || null,
				action: 'card_reminder_failed',
				actionAt: new Date().toISOString(),
				actionBy: userId || null,
				actorType: 'staff',
				note: shortMessage,
			});

			result.processedCount += 1;
			result.failedCount += 1;
			pushReminderError(result.errors, freshCandidateExam, shortMessage);
		}

		if (index < selectedTargets.length - 1) {
			await wait(CARD_REMINDER_SEND_DELAY_MS);
		}
	}

	result.remainingCount = Math.max(0, result.totalTarget - result.processedCount);
	return result;
}

export async function getCandidateExamImportTemplate() {
	return {
		fileName: IMPORT_TEMPLATE_FILE_NAME,
		contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
		buffer: buildImportTemplateWorkbookBuffer(),
	};
}

export async function getCandidateExamScoreImportTemplate() {
	return {
		fileName: SCORE_IMPORT_TEMPLATE_FILE_NAME,
		contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
		buffer: buildScoreImportTemplateWorkbookBuffer(),
	};
}

export async function previewCandidateExamImport(file: UploadedFileLike, payload: Record<string, unknown>, tenantId: number | string) {
	return buildCandidateExamImportPreview(file, payload.admissionSeasonId ?? payload.admissionSeason, tenantId);
}

export async function previewCandidateExamScoreImport(file: UploadedFileLike, payload: Record<string, unknown>, tenantId: number | string) {
	return buildCandidateExamScoreImportPreview(file, payload.admissionSeasonId ?? payload.admissionSeason, tenantId);
}

export async function confirmCandidateExamImport(file: UploadedFileLike, payload: Record<string, unknown>, tenantId: number | string, userId?: number | null) {
	return runCandidateExamImportConfirm(file, {
		admissionSeasonId: payload.admissionSeasonId ?? payload.admissionSeason,
		tenantId,
		userId,
		updateExisting: payload.options && typeof payload.options === 'object' ? (payload.options as Record<string, unknown>).updateExisting : payload.updateExisting,
		restoreDeleted: payload.options && typeof payload.options === 'object' ? (payload.options as Record<string, unknown>).restoreDeleted : payload.restoreDeleted,
		overwriteScores: payload.options && typeof payload.options === 'object' ? (payload.options as Record<string, unknown>).overwriteScores : payload.overwriteScores,
		overwriteExamAssignment: payload.options && typeof payload.options === 'object' ? (payload.options as Record<string, unknown>).overwriteExamAssignment : payload.overwriteExamAssignment,
	});
}

export async function confirmCandidateExamScoreImport(file: UploadedFileLike, payload: Record<string, unknown>, tenantId: number | string, userId?: number | null) {
	return runCandidateExamScoreImportConfirm(file, {
		admissionSeasonId: payload.admissionSeasonId ?? payload.admissionSeason,
		tenantId,
		userId,
	});
}

export async function getCandidateExamRecheckImportTemplate() {
	return {
		fileName: RECHECK_IMPORT_TEMPLATE_FILE_NAME,
		contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
		buffer: buildRecheckImportTemplateWorkbookBuffer(),
	};
}

export async function previewCandidateExamRecheckImport(file: UploadedFileLike, payload: Record<string, unknown>, tenantId: number | string) {
	return buildCandidateExamRecheckImportPreview(file, payload.admissionSeasonId ?? payload.admissionSeason, tenantId);
}

export async function confirmCandidateExamRecheckImport(file: UploadedFileLike, payload: Record<string, unknown>, tenantId: number | string, userId?: number | null) {
	return runCandidateExamRecheckImportConfirm(file, {
		admissionSeasonId: payload.admissionSeasonId ?? payload.admissionSeason,
		tenantId,
		userId,
	});
}

export async function listCandidateExams(query: Record<string, unknown> = {}, tenantId: number | string) {
	const page = toPositiveInt(query?.page, 1);
	const pageSize = Math.min(100, toPositiveInt(query?.pageSize, 20));
	await findAdmissionSeasonOrThrow(query?.admissionSeasonId ?? query?.admissionSeason, tenantId);
	const where = mergeTenantSoftDeleteWhere(buildBaseWhere(query), tenantId, query);
	const auditAwareQuery = isAuditAwareQuery(query);

	if (auditAwareQuery) {
		const rows = await strapi.db.query(CANDIDATE_EXAM_UID).findMany({
			where,
			populate: CANDIDATE_EXAM_POPULATE,
			orderBy: resolveSortOrder(query),
		});
		const rowsWithAudit = await attachCandidateExamCardAudit(rows || [], tenantId);
		const filteredRows = filterRowsByAuditStatus(rowsWithAudit || [], query);
		const sortedRows = sortRowsByAuditField(filteredRows, query);
		const total = sortedRows.length;
		const pagedRows = sortedRows.slice((page - 1) * pageSize, page * pageSize);

		return {
			items: pagedRows.map((row) => normalizeCandidateExamRow(row)),
			total,
			page,
			pageSize,
		};
	}

	const [rows, total] = await Promise.all([
		strapi.db.query(CANDIDATE_EXAM_UID).findMany({
			where,
			populate: CANDIDATE_EXAM_POPULATE,
			orderBy: resolveSortOrder(query),
			offset: (page - 1) * pageSize,
			limit: pageSize,
		}),
		strapi.db.query(CANDIDATE_EXAM_UID).count({ where }),
	]);
	const rowsWithAudit = await attachCandidateExamCardAudit(rows || [], tenantId);

	return {
		items: (rowsWithAudit || []).map((row) => normalizeCandidateExamRow(row)),
		total,
		page,
		pageSize,
	};
}

export async function exportCandidateExams(query: Record<string, unknown> = {}, tenantId: number | string) {
	const admissionSeason = await findAdmissionSeasonOrThrow(query?.admissionSeasonId ?? query?.admissionSeason, tenantId);
	const where = mergeTenantSoftDeleteWhere(buildBaseWhere(query), tenantId, query);
	const rows = await strapi.db.query(CANDIDATE_EXAM_UID).findMany({
		where,
		populate: CANDIDATE_EXAM_EXPORT_POPULATE,
		orderBy: resolveSortOrder(query),
	});
	const rowsWithApplications = await attachCandidateExamExportApplications(rows || [], tenantId, Number(admissionSeason.id));
	const rowsWithAudit = await attachCandidateExamCardAudit(rowsWithApplications || [], tenantId);
	const filteredRows = filterRowsByAuditStatus(rowsWithAudit || [], query);
	const sortedRows = sortRowsByAuditField(filteredRows || [], query);
	const worksheet = buildCandidateExamExportWorksheet(sortedRows);
	const workbook = XLSX.utils.book_new();
	XLSX.utils.book_append_sheet(workbook, worksheet, 'CandidateExams');

	return {
		buffer: XLSX.write(workbook, { bookType: 'xlsx', type: 'buffer' }),
		contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
		fileName: `candidate-exams-${sanitizeFileNamePart(admissionSeason?.code || admissionSeason?.name, 'season')}.xlsx`,
	};
}

export async function getCandidateExamDetail(idParam: unknown, tenantId: number | string, options: { includeDeleted?: boolean } = {}) {
	const where = whereByParam(idParam);
	if (!where) return null;

	return strapi.db.query(CANDIDATE_EXAM_UID).findOne({
		where: mergeTenantSoftDeleteWhere(where, tenantId, options),
		populate: CANDIDATE_EXAM_POPULATE,
	});
}

export async function getCandidateExamLogs(idParam: unknown, tenantId: number | string, query: Record<string, unknown> = {}) {
	const entity = await getCandidateExamDetail(idParam, tenantId, { includeDeleted: true });
	if (!entity?.id) {
		throw new CandidateExamError(404, 'CandidateExam not found');
	}

	const result = await listCandidateExamLogs({
		...query,
		candidateExamId: entity.id,
	}, tenantId);

	return result.rows || [];
}

export async function logCandidateExamCardAction(
	idParam: unknown,
	tenantId: number | string,
	action: 'card_view' | 'card_print',
	renderContext: CandidateExamCardRenderContext = {},
) {
	const entity = await getCandidateExamDetail(idParam, tenantId, { includeDeleted: true });
	if (!entity?.id) {
		throw new CandidateExamError(404, 'CandidateExam not found');
	}

	await createCandidateExamLogEntry({
		tenant: tenantId,
		admissionSeason: entity?.admissionSeason?.id || entity?.admissionSeason || null,
		candidateExam: entity.id,
		admissionApplication: entity?.admissionApplication?.id || entity?.admissionApplication || null,
		action,
		actionAt: new Date().toISOString(),
		actionBy: renderContext.userId || null,
		actorType: renderContext.actorType || 'staff',
		ip: toText(renderContext.ip) || null,
		userAgent: toText(renderContext.userAgent) || null,
		note: action === 'card_print' ? 'Printed exam card HTML' : 'Viewed exam card HTML',
	});
}

export async function renderCandidateExamExamCard(idParam: unknown, tenantId: number | string, renderContext: CandidateExamCardRenderContext = {}) {
	const where = whereByParam(idParam);
	if (!where) {
		throw new CandidateExamError(404, 'CandidateExam not found');
	}

	const entity = await strapi.db.query(CANDIDATE_EXAM_UID).findOne({
		where: mergeTenantSoftDeleteWhere(where, tenantId, { includeDeleted: true }),
		populate: {
			tenant: {
				select: ['id', 'name', 'shortName', 'code'],
				populate: {
					logo: {
						select: ['url'],
					},
				},
			},
			admissionSeason: {
				select: ['id', 'name', 'code', 'examCardTemplateHtml'],
			},
			admissionApplication: {
				select: ['id', 'applicationCode', 'studentCode', 'studentName'],
			},
		},
	});

	if (!entity?.id) {
		throw new CandidateExamError(404, 'CandidateExam not found');
	}

	const admissionSeason = entity?.admissionSeason;
	const templateHtml = toText(admissionSeason?.examCardTemplateHtml).trim();
	if (!templateHtml) {
		throw new CandidateExamError(400, 'Kỳ tuyển sinh chưa cấu hình mẫu thẻ dự kiểm tra.');
	}

	const tenant = entity?.tenant || await strapi.db.query(TENANT_UID).findOne({
		where: { id: tenantId },
		select: ['id', 'name', 'shortName', 'code'],
		populate: {
			logo: {
				select: ['url'],
			},
		},
	});

	const photoUrl = normalizeCardImagePath(entity?.cardImagePath, renderContext.assetBaseUrl);
	const qrCodeUrl = buildExamCardLookupUrl({
		tenantCode: tenant?.code,
		campaignCode: admissionSeason?.code,
		studentCode: entity?.studentCode,
		applicationCode: entity?.applicationCode,
		refererUrl: renderContext.refererUrl,
	});
	const qrCodeDataUrl = await buildExamCardQrCodeDataUrl(qrCodeUrl);
	const candidateExamData = {
		photoUrl: photoUrl || '',
		hasPhoto: Boolean(photoUrl),
		cardImagePath: photoUrl || '',
		qrCodeUrl,
		qrCodeDataUrl,
		fullName: toText(entity?.fullName),
		studentName: toText(entity?.fullName),
		lastName: toText(entity?.lastName),
		middleName: toText((entity as any)?.middleName),
		firstName: toText(entity?.firstName),
		dateOfBirth: formatDateDisplay(entity?.dateOfBirth),
		gender: formatGenderDisplay(entity?.gender),
		primarySchool: toText(entity?.primarySchool),
		studentCode: toText(entity?.studentCode),
		applicationCode: toText(entity?.applicationCode),
		examLocation: toText(entity?.examLocation),
		candidateNumber: toText(entity?.candidateNumber),
		examRoom: toText(entity?.examRoom),
		incentiveScore: formatScoreDisplay(entity?.incentiveScore, '0'),
		vietnameseScore: formatScoreDisplay(entity?.vietnameseScore),
		englishScore: formatScoreDisplay(entity?.englishScore),
		mathScore: formatScoreDisplay(entity?.mathScore),
		totalScore: formatScoreDisplay(entity?.totalScore),
		candidateExamStatus: toText(entity?.candidateExamStatus),
		note: toText(entity?.note),
		candidateExamId: String(entity.id),
		currentDate: formatDateDisplay(new Date().toISOString()),
		tenantName: toText(tenant?.shortName || tenant?.name || tenant?.code),
		tenantLogo: extractMediaUrl((tenant as any)?.logo),
		campaignName: toText(admissionSeason?.name),
	};

	const compiledTemplate = Handlebars.compile(templateHtml);
	const renderedHtml = compiledTemplate(candidateExamData);

	await logCandidateExamCardAction(entity.id, tenantId, 'card_view', renderContext);

	return {
		html: wrapExamCardHtml(renderedHtml),
	};
}

export async function createCandidateExam(payload: Record<string, unknown>, tenantId: number | string, userId?: number | null) {
	const season = await findAdmissionSeasonOrThrow(payload.admissionSeasonId ?? payload.admissionSeason, tenantId);
	const data = {
		...normalizeCreateOrUpdatePayload(payload, { includeSeason: true }),
		tenant: tenantId,
		admissionSeason: season.id,
		isDeleted: false,
	};

	const created = await strapi.db.query(CANDIDATE_EXAM_UID).create({
		data,
		populate: CANDIDATE_EXAM_POPULATE,
	});

	return normalizeCandidateExamRow(created);
}

export async function updateCandidateExam(idParam: unknown, payload: Record<string, unknown>, tenantId: number | string, userId?: number | null) {
	const where = whereByParam(idParam);
	if (!where) {
		const error = new Error('CandidateExam not found') as Error & { status?: number };
		error.status = 404;
		throw error;
	}

	const existing = await getCandidateExamDetail(idParam, tenantId, { includeDeleted: true });
	if (!existing) {
		const error = new Error('CandidateExam not found') as Error & { status?: number };
		error.status = 404;
		throw error;
	}
	if (payload.admissionSeasonId !== undefined || payload.admissionSeason !== undefined) {
		throw new CandidateExamError(400, 'admissionSeasonId cannot be changed');
	}

	const updated = await strapi.db.query(CANDIDATE_EXAM_UID).update({
		where,
		data: normalizeCreateOrUpdatePayload(payload, { includeSeason: false }),
		populate: CANDIDATE_EXAM_POPULATE,
	});

	if (Object.prototype.hasOwnProperty.call(payload || {}, 'cardImagePath')) {
		await syncCandidateExamCardImagePath(updated?.id || existing?.id, payload.cardImagePath);
	}

	const refreshed = await getCandidateExamDetail(updated?.id || existing?.id, tenantId, { includeDeleted: true });
	if (!refreshed) {
		const error = new Error('CandidateExam not found after update') as Error & { status?: number };
		error.status = 404;
		throw error;
	}

	await writeCandidateExamChangeLogs(existing, refreshed, userId);
	return normalizeCandidateExamRow(refreshed);
}

export async function softDeleteCandidateExam(idParam: unknown, tenantId: number | string, userId?: number | null, reason?: string | null) {
	const where = whereByParam(idParam);
	if (!where) {
		const error = new Error('CandidateExam not found') as Error & { status?: number };
		error.status = 404;
		throw error;
	}

	const existing = await getCandidateExamDetail(idParam, tenantId, { includeDeleted: true });
	if (!existing) {
		const error = new Error('CandidateExam not found') as Error & { status?: number };
		error.status = 404;
		throw error;
	}

	return strapi.db.query(CANDIDATE_EXAM_UID).update({
		where,
		data: {
			...buildSoftDeleteData(userId),
			deleteReason: reason || null,
		},
		populate: CANDIDATE_EXAM_POPULATE,
	});
}

export async function restoreCandidateExam(idParam: unknown, tenantId: number | string, userId?: number | null, reason?: string | null) {
	const where = whereByParam(idParam);
	if (!where) {
		const error = new Error('CandidateExam not found') as Error & { status?: number };
		error.status = 404;
		throw error;
	}

	const existing = await getCandidateExamDetail(idParam, tenantId, { includeDeleted: true });
	if (!existing) {
		const error = new Error('CandidateExam not found') as Error & { status?: number };
		error.status = 404;
		throw error;
	}

	await strapi.db.query(CANDIDATE_EXAM_UID).findMany({
		where: mergeTenantSoftDeleteWhere({ id: existing.id }, tenantId, { includeDeleted: true }),
		populate: CANDIDATE_EXAM_POPULATE,
	});

	const restored = await strapi.db.query(CANDIDATE_EXAM_UID).update({
		where,
		data: {
			...buildRestoreData(),
			restoredAt: new Date().toISOString(),
			restoredBy: userId || null,
			restoreReason: reason || null,
		},
		populate: CANDIDATE_EXAM_POPULATE,
	});

	return normalizeCandidateExamRow(restored);
}

export default factories.createCoreService(CANDIDATE_EXAM_UID);