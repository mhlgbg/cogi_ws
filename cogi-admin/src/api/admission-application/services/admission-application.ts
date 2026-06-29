/**
 * admission-application service.
 */

import { factories } from '@strapi/strapi';
import fs from 'node:fs/promises';
import path from 'node:path';
import XLSX from 'xlsx';
import { mergeTenantWhere, toText } from '../../../utils/tenant-scope';
import { buildAdmissionReviewSnapshot } from '../../../utils/admission-review-snapshot';
import { enqueueMail } from '../../../services/mail-queue';
import notificationService from '../../notification/services/notification';

const ADMISSION_APPLICATION_UID = 'api::admission-application.admission-application';
const ADMISSION_APPLICATION_MESSAGE_UID = 'api::admission-application-message.admission-application-message';
const ADMISSION_APPLICATION_ACTIVITY_UID = 'api::admission-application-activity.admission-application-activity';
const NOTIFICATION_TEMPLATE_UID = 'api::notification-template.notification-template';

const REVIEW_EMAIL_TEMPLATE_CODES = [
	'admission_review_received',
	'admission_review_need_update',
	'admission_review_exam_card',
	'admission_review_approval_ack',
] as const;

const REVIEW_DETAIL_POPULATE = {
	parent: {
		select: ['id', 'username', 'email', 'fullName', 'phone'],
	},
	deletedBy: {
		select: ['id', 'username', 'email', 'fullName'],
	},
	restoredBy: {
		select: ['id', 'username', 'email', 'fullName'],
	},
	approvedAcknowledgedBy: {
		select: ['id', 'username', 'email', 'fullName'],
	},
	reviewedBy: {
		select: ['id', 'username', 'email', 'fullName'],
	},
	campaign: {
		select: ['id', 'name', 'code', 'campaignStatus', 'startDate', 'endDate', 'formTemplateVersion', 'reviewDisplayConfig'],
		populate: {
			formTemplate: {
				select: ['id', 'name', 'version', 'schema', 'formTemplateStatus', 'isLocked'],
			},
		},
	},
};

const REVIEW_SNAPSHOT_SOURCE_POPULATE = {
	parent: {
		select: ['id', 'username', 'email', 'fullName', 'phone'],
	},
	reviewedBy: {
		select: ['id', 'username', 'email', 'fullName'],
	},
	campaign: {
		select: ['id', 'name', 'code', 'campaignStatus', 'startDate', 'endDate', 'formTemplateVersion', 'reviewDisplayConfig'],
		populate: {
			formTemplate: {
				select: ['id', 'name', 'version', 'schema', 'formTemplateStatus', 'isLocked'],
			},
		},
	},
};

const REVIEW_MESSAGE_POPULATE = {
	senderUser: true,
};

function toBooleanFlag(value: unknown, fallback = false) {
	if (typeof value === 'boolean') return value;
	if (typeof value === 'number') return value !== 0;
	const normalized = toText(value).toLowerCase();
	if (!normalized) return fallback;
	return ['true', '1', 'yes', 'on'].includes(normalized);
}

function splitStudentNameParts(fullName: unknown) {
	const normalized = toText(fullName).trim().replace(/\s+/g, ' ');
	if (!normalized) {
		return {
			middleName: '',
			firstName: '',
		};
	}

	const parts = normalized.split(' ');
	return {
		middleName: parts.slice(0, -1).join(' ').toUpperCase(),
		firstName: parts.slice(-1).join(' ').toUpperCase(),
	};
}

function buildActiveAdmissionWhere() {
	return {
		$or: [
			{ isDeleted: false },
			{ isDeleted: { $null: true } },
		],
	};
}

function buildAdmissionWhere(
	where: Record<string, unknown> = {},
	tenantId: number | string,
	options: { includeDeleted?: boolean } = {},
) {
	const whereParts: Array<Record<string, unknown>> = [];
	if (where && Object.keys(where).length > 0) {
		whereParts.push(where);
	}
	if (!options.includeDeleted) {
		whereParts.push(buildActiveAdmissionWhere());
	}

	const combinedWhere = whereParts.length === 0
		? {}
		: whereParts.length === 1
			? whereParts[0]
			: { $and: whereParts };

	return mergeTenantWhere(combinedWhere, tenantId);
}

function toPositiveInt(value: unknown, fallback: number) {
	const parsed = Number(value);
	return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

export function getEffectiveReviewStatus(row: any): 'draft' | 'submitted' | 'returned' | 'accepted' | null {
	const normalizedReviewStatus = String(row?.reviewStatus || '').trim().toLowerCase();
	if (normalizedReviewStatus === 'submitted' || normalizedReviewStatus === 'returned' || normalizedReviewStatus === 'accepted') {
		return normalizedReviewStatus;
	}

	const normalizedStatus = String(row?.admissionStatus || row?.status || '').trim().toLowerCase();
	if (normalizedStatus === 'draft') return 'draft';
	if (normalizedStatus === 'submitted') return 'submitted';
	if (normalizedStatus === 'rejected') return 'returned';
	if (['approved', 'reviewing', 'exam_scheduled', 'passed', 'failed', 'enrolled'].includes(normalizedStatus)) {
		return 'accepted';
	}

	return null;
}

function readAdmissionStatus(row: any): string {
	return String(row?.admissionStatus || row?.status || '').trim().toLowerCase() || 'draft';
}

function escapeHtml(value: unknown): string {
	return String(value || '')
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;')
		.replace(/'/g, '&#39;');
}

function sanitizeEmailHtml(value: unknown): string {
	const raw = String(value || '').trim();
	if (!raw) return '';

	return raw
		.replace(/<\/?(script|style|iframe|object|embed)[^>]*>/gi, '')
		.replace(/ on[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '')
		.replace(/\s(href|src)\s*=\s*("|')\s*javascript:[^"']*("|')/gi, ' $1="#"')
		.replace(/\s(href|src)\s*=\s*javascript:[^\s>]*/gi, ' $1="#"');
}

function htmlToPlainText(value: unknown): string {
	return String(value || '')
		.replace(/<br\s*\/?\s*>/gi, '\n')
		.replace(/<\/p>/gi, '\n\n')
		.replace(/<[^>]+>/g, '')
		.replace(/&nbsp;/g, ' ')
		.replace(/&amp;/g, '&')
		.replace(/&lt;/g, '<')
		.replace(/&gt;/g, '>')
		.replace(/&quot;/g, '"')
		.replace(/&#39;/g, "'")
		.replace(/\n{3,}/g, '\n\n')
		.trim();
}

function resolveBackendBaseUrl(fallback?: unknown): string {
	const raw = String(fallback || process.env.BACKEND_URL || '').trim();
	if (!raw) return '';
	return raw.replace(/\/+$/, '');
}

function buildAbsoluteAttachmentUrl(url: unknown, baseUrl: string): string {
	const normalizedUrl = String(url || '').trim();
	if (!normalizedUrl) return '';
	if (/^https?:\/\//i.test(normalizedUrl)) return normalizedUrl;
	if (!baseUrl) return normalizedUrl;
	return `${baseUrl}${normalizedUrl.startsWith('/') ? '' : '/'}${normalizedUrl}`;
}

function buildEmailAttachmentHtml(attachments: Array<Record<string, unknown>>, baseUrl: string): string {
	if (!Array.isArray(attachments) || attachments.length === 0) return '';

	const items = attachments
		.map((attachment) => {
			const name = escapeHtml(String(attachment?.name || 'Tệp đính kèm').trim() || 'Tệp đính kèm');
			const url = buildAbsoluteAttachmentUrl(attachment?.url, baseUrl);
			if (!url) {
				return `<li>${name}</li>`;
			}
			return `<li><a href="${escapeHtml(url)}" target="_blank" rel="noreferrer">${name}</a></li>`;
		})
		.join('');

	return items ? `<p><strong>Tệp đính kèm</strong></p><ul>${items}</ul>` : '';
}

function buildEmailAttachmentText(attachments: Array<Record<string, unknown>>, baseUrl: string): string {
	if (!Array.isArray(attachments) || attachments.length === 0) return '';

	const lines = attachments.map((attachment) => {
		const name = String(attachment?.name || 'Tệp đính kèm').trim() || 'Tệp đính kèm';
		const url = buildAbsoluteAttachmentUrl(attachment?.url, baseUrl);
		return url ? `- ${name}: ${url}` : `- ${name}`;
	});

	return lines.length > 0 ? `\n\nTệp đính kèm:\n${lines.join('\n')}` : '';
}

function buildReviewEmailTemplateData(application: any) {
	return {
		parentName: toText(application?.parent?.fullName || application?.parent?.username || 'Quý phụ huynh'),
		parentEmail: toText(application?.parent?.email).toLowerCase(),
		studentName: toText(application?.studentName || 'Học sinh'),
		applicationCode: toText(application?.applicationCode || '-'),
		campaignName: toText(application?.campaign?.name || 'kỳ tuyển sinh'),
		reviewNote: toText(application?.reviewNote || ''),
	};
}

function buildReviewStatusWhere(status: string) {
	const normalized = String(status || '').trim().toLowerCase();

	if (normalized === 'all') {
		return null;
	}

	if (normalized === 'draft') {
		return {
			$or: [
				{ reviewStatus: 'draft' },
				{ reviewStatus: { $null: true }, admissionStatus: 'draft' },
			],
		};
	}

	if (normalized === 'submitted') {
		return {
			$or: [
				{ reviewStatus: 'submitted' },
				{ reviewStatus: { $null: true }, admissionStatus: 'submitted' },
			],
		};
	}

	if (normalized === 'returned') {
		return {
			$or: [
				{ reviewStatus: 'returned' },
				{ reviewStatus: { $null: true }, admissionStatus: 'rejected' },
			],
		};
	}

	if (normalized === 'accepted') {
		return {
			$or: [
				{ reviewStatus: 'accepted' },
				{
					reviewStatus: { $null: true },
					admissionStatus: { $in: ['approved', 'reviewing', 'exam_scheduled', 'passed', 'failed', 'enrolled'] },
				},
			],
		};
	}

	return null;
}

function buildReviewSearchWhere(keyword: string) {
	const q = toText(keyword);
	if (!q) return null;

	return {
		$or: [
			{ applicationCode: { $containsi: q } },
			{ studentCode: { $containsi: q } },
			{ studentName: { $containsi: q } },
			{ parent: { fullName: { $containsi: q } } },
			{ parent: { username: { $containsi: q } } },
			{ parent: { email: { $containsi: q } } },
			{ parent: { phone: { $containsi: q } } },
		],
	};
}

function buildApprovalAcknowledgementWhere(value: unknown) {
	const normalized = toText(value).toLowerCase();
	if (!normalized || normalized === 'all') return null;

	if (normalized === 'acknowledged') {
		return {
			admissionStatus: 'approved',
			approvedAcknowledgedAt: {
				$notNull: true,
			},
		};
	}

	if (normalized === 'pending') {
		return {
			admissionStatus: 'approved',
			approvedAcknowledgedAt: {
				$null: true,
			},
		};
	}

	return null;
}

function buildReviewListWhere(query: Record<string, unknown>, tenantId: number | string) {
	const status = toText(query?.status || 'submitted').toLowerCase() || 'submitted';
	const includeDeleted = toBooleanFlag(query?.includeDeleted || query?.showDeleted, false);
	const whereParts: Array<Record<string, unknown>> = [];

	const statusWhere = buildReviewStatusWhere(status);
	if (statusWhere) whereParts.push(statusWhere);

	const searchWhere = buildReviewSearchWhere(String(query?.q || query?.keyword || ''));
	if (searchWhere) whereParts.push(searchWhere);

	const approvalAckWhere = buildApprovalAcknowledgementWhere(query?.approvalAckStatus || query?.approvalAcknowledgement || query?.ackStatus);
	if (approvalAckWhere) whereParts.push(approvalAckWhere);

	return buildAdmissionWhere(whereParts.length > 0 ? { $and: whereParts } : {}, tenantId, { includeDeleted });
}

function buildReviewListOrderBy(query: Record<string, unknown>) {
	const sortBy = toText(query?.sortBy).toLowerCase();
	const sortOrder = toText(query?.sortOrder).toLowerCase() === 'asc' ? 'asc' : 'desc';

	if (sortBy === 'applicationcode') {
		return [
			{ applicationCode: sortOrder },
			{ submittedAt: 'desc' },
			{ createdAt: 'desc' },
		];
	}

	if (sortBy === 'submittedat') {
		return [
			{ submittedAt: sortOrder },
			{ createdAt: sortOrder },
		];
	}

	if (sortBy === 'reviewedat') {
		return [
			{ reviewedAt: sortOrder },
			{ submittedAt: 'desc' },
			{ createdAt: 'desc' },
		];
	}

	return [{ submittedAt: 'desc' }, { createdAt: 'desc' }];
}

export async function listReviewApplications(query: Record<string, unknown>, tenantId: number | string) {
	const page = toPositiveInt(query?.page, 1);
	const pageSize = toPositiveInt(query?.pageSize, 10);
	const where = buildReviewListWhere(query, tenantId);
	const orderBy = buildReviewListOrderBy(query);

	const [rows, total] = await strapi.db.query(ADMISSION_APPLICATION_UID).findWithCount({
		where,
		offset: (page - 1) * pageSize,
		limit: pageSize,
		orderBy,
		select: ['id', 'applicationCode', 'studentCode', 'studentName', 'admissionStatus', 'reviewStatus', 'createdAt', 'submittedAt', 'reviewedAt', 'reviewNote', 'approvalNotifiedAt', 'approvalNotificationCount', 'approvedAcknowledgedAt', 'isDeleted', 'deletedAt'],
		populate: {
			parent: {
				select: ['id', 'username', 'email', 'fullName', 'phone'],
			},
			reviewedBy: {
				select: ['id', 'username', 'email', 'fullName'],
			},
			campaign: {
				select: ['id', 'name', 'code'],
			},
		},
	});

	return {
		rows,
		pagination: {
			page,
			pageSize,
			total,
			pageCount: Math.max(1, Math.ceil(total / pageSize)),
		},
	};
}

function getReviewStatusExportLabel(status: unknown) {
	const normalized = String(status || '').trim().toLowerCase();
	if (normalized === 'draft') return 'Nháp';
	if (normalized === 'submitted') return 'Chờ duyệt';
	if (normalized === 'returned') return 'Trả lại';
	if (normalized === 'accepted') return 'Đã tiếp nhận';
	return normalized || '-';
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

function formatDateTimeForEmail(value: unknown) {
	const text = String(value || '').trim();
	if (!text) return '';
	const date = new Date(text);
	if (Number.isNaN(date.getTime())) return text;

	return new Intl.DateTimeFormat('vi-VN', {
		day: '2-digit',
		month: '2-digit',
		year: 'numeric',
		hour: '2-digit',
		minute: '2-digit',
		second: '2-digit',
	}).format(date);
}

function sanitizeExportHeader(value: unknown, fallback: string) {
	const text = toText(value);
	return text || fallback;
}

function formatReviewExportFilePath(file: any): string {
	const rawUrl = toText(file?.url || file?.path || file?.href);
	if (rawUrl) {
		const normalizedUrl = rawUrl.replace(/\\/g, '/');
		const admissionsPathMatch = normalizedUrl.match(/(?:^|\/)(?:uploads\/)?(admissions\/.*)$/i);
		if (admissionsPathMatch?.[1]) {
			return `/${admissionsPathMatch[1]}`;
		}

		return normalizedUrl;
	}

	return toText(file?.name || file?.id);
}

function formatReviewExportFieldValue(field: any): string {
	if (Array.isArray(field?.rows) && field.rows.length > 0) {
		return field.rows
			.map((row: any, rowIndex: number) => {
				const cells = Array.isArray(row?.cells) ? row.cells : [];
				const serializedCells = cells
					.map((cell: any) => {
						const label = toText(cell?.label);
						const value = toText(cell?.value);
						if (!label && !value) return '';
						return label ? `${label}: ${value}` : value;
					})
					.filter(Boolean)
					.join(' | ');

				return serializedCells ? `Dong ${rowIndex + 1}: ${serializedCells}` : '';
			})
			.filter(Boolean)
			.join('\n');
	}

	if (Array.isArray(field?.files) && field.files.length > 0) {
		return field.files
			.map((file: any) => formatReviewExportFilePath(file))
			.filter(Boolean)
			.join('\n');
	}

	return toText(field?.value);
}

function extractReviewExportFormDataColumns(row: any) {
	const snapshot = buildAdmissionReviewSnapshot({
		application: row,
		campaign: row?.campaign,
		parent: row?.parent,
	});

	return (snapshot.displaySections || [])
		.flatMap((section: any) => Array.isArray(section?.fields) ? section.fields : [])
		.map((field: any) => ({
			key: toText(field?.key),
			header: sanitizeExportHeader(field?.label, toText(field?.key) || 'formData'),
			value: formatReviewExportFieldValue(field),
		}))
		.filter((field: any) => field.key && field.header);
}

function getApplicationDetailUrl(applicationCode: string) {
	return applicationCode ? `Mã hồ sơ: ${applicationCode}` : 'Quý phụ huynh vui lòng kiểm tra lại hồ sơ tuyển sinh đã được duyệt.';
}

async function sendApprovalNotificationEmail(application: any) {
	const recipientEmail = toText(application?.parent?.email).toLowerCase();
	if (!recipientEmail) {
		const error = new Error('Phụ huynh chưa có email để nhận thông báo duyệt hồ sơ') as Error & { status?: number };
		error.status = 409;
		throw error;
	}

	const parentName = toText(application?.parent?.fullName || application?.parent?.username || 'Quý phụ huynh');
	const studentName = toText(application?.studentName || 'Học sinh');
	const campaignName = toText(application?.campaign?.name || 'kỳ tuyển sinh');

	await enqueueMail({
		tenantId: application?.campaign?.tenant?.id ?? application?.tenant?.id ?? null,
		mailType: 'admission_approval_notification',
		to: recipientEmail,
		subject: `Thong bao duyet ho so tuyen sinh - ${campaignName}`,
		text:
			`Kinh gui ${parentName},\n\n` +
			`Nha truong da duyet ho so tuyen sinh cua hoc sinh ${studentName}.\n` +
			`${getApplicationDetailUrl(toText(application?.applicationCode))}\n` +
			'Quy phu huynh vui long dang nhap/vao trang theo doi ho so de xac nhan da nhan thong tin.\n\n' +
			`${toText(application?.reviewNote) ? `Thong tin bo sung: ${toText(application.reviewNote)}\n\n` : ''}` +
			'Tran trong.',
		html:
			`<p>Kinh gui <strong>${parentName}</strong>,</p>` +
			`<p>Nha truong da duyet ho so tuyen sinh cua hoc sinh <strong>${studentName}</strong>.</p>` +
			`<p>${getApplicationDetailUrl(toText(application?.applicationCode))}</p>` +
			'<p>Quy phu huynh vui long vao trang theo doi ho so de <strong>xac nhan da nhan thong tin</strong>.</p>' +
			`${toText(application?.reviewNote) ? `<p>Thong tin bo sung: ${toText(application.reviewNote)}</p>` : ''}` +
			'<p>Tran trong.</p>',
		metadata: {
			applicationId: application?.id,
			applicationCode: application?.applicationCode,
			source: 'admission-application.sendApprovalNotificationEmail',
		},
	});
}

export async function exportReviewApplications(query: Record<string, unknown>, tenantId: number | string) {
	const where = buildReviewListWhere(query, tenantId);
	const requestedVariant = toText(query?.variant).toLowerCase();
	const exportVariant = requestedVariant === 'legacy'
		? 'legacy'
		: requestedVariant === 'review-summary'
			? 'review-summary'
			: 'expanded';
	const rows = await strapi.db.query(ADMISSION_APPLICATION_UID).findMany({
		where,
		orderBy: [{ submittedAt: 'desc' }, { createdAt: 'desc' }],
		select: ['id', 'applicationCode', 'studentCode', 'studentName', 'admissionStatus', 'reviewStatus', 'reviewedAt', 'reviewNote', 'isDeleted', 'formData'],
		populate: {
			parent: {
				select: ['id', 'username', 'email', 'fullName', 'phone'],
			},
			campaign: {
				select: ['id', 'name', 'code', 'formTemplateVersion'],
				populate: {
					formTemplate: {
						select: ['id', 'name', 'version', 'schema'],
					},
				},
			},
			reviewedBy: {
				select: ['id', 'username', 'email', 'fullName'],
			},
		},
	});

	const dynamicColumns: Array<{ key: string; header: string }> = [];
	const dynamicColumnKeys = new Set<string>();
	const exportRows = (rows || []).map((row: any) => {
		const studentNameParts = splitStudentNameParts(row?.studentName);

		if (exportVariant === 'review-summary') {
			return {
				'Mã hồ sơ': row?.applicationCode || '',
				'Mã học sinh': row?.studentCode || '',
				'Người xét duyệt': row?.reviewedBy?.fullName || row?.reviewedBy?.username || '',
				'Tình trạng xét duyệt': getReviewStatusExportLabel(getEffectiveReviewStatus(row)),
				'Thời điểm xét duyệt': formatDateTimeForEmail(row?.reviewedAt || ''),
				'Nội dung nhận xét': htmlToPlainText(row?.reviewNote || ''),
			};
		}

		const baseRow: Record<string, unknown> = {
			'Mã hồ sơ': row?.applicationCode || '',
			'Mã học sinh': row?.studentCode || '',
			'Họ tên học sinh': toText(row?.studentName).toUpperCase(),
			...(exportVariant === 'expanded'
				? {
					'Họ đệm': studentNameParts.middleName,
					'Tên': studentNameParts.firstName,
				}
				: {}),
			'Họ tên phụ huynh': row?.parent?.fullName || row?.parent?.username || '',
			'Điện thoại phụ huynh': row?.parent?.phone || '',
			'Email phụ huynh': row?.parent?.email || '',
			'Tình trạng hồ sơ': getReviewStatusExportLabel(getEffectiveReviewStatus(row)),
			'Đã xóa mềm': row?.isDeleted ? 'Có' : 'Không',
			'Nhận xét': htmlToPlainText(row?.reviewNote || ''),
		};

		if (exportVariant === 'expanded') {
			for (const field of extractReviewExportFormDataColumns(row)) {
				if (!dynamicColumnKeys.has(field.key)) {
					dynamicColumnKeys.add(field.key);
					dynamicColumns.push({ key: field.key, header: field.header });
				}
				baseRow[field.header] = field.value;
			}
		}

		return baseRow;
	});

	const header = [
		...(exportVariant === 'review-summary'
			? [
				'Mã hồ sơ',
				'Mã học sinh',
				'Người xét duyệt',
				'Tình trạng xét duyệt',
				'Thời điểm xét duyệt',
				'Nội dung nhận xét',
			]
			: [
				'Mã hồ sơ',
				'Mã học sinh',
				'Họ tên học sinh',
				...(exportVariant === 'expanded' ? ['Họ đệm', 'Tên'] : []),
				'Họ tên phụ huynh',
				'Điện thoại phụ huynh',
				'Email phụ huynh',
				'Tình trạng hồ sơ',
				'Đã xóa mềm',
				'Nhận xét',
				...dynamicColumns.map((column) => column.header),
			]),
	];

	const workbook = XLSX.utils.book_new();
	const worksheet = XLSX.utils.json_to_sheet(exportRows, {
		header,
	});
	XLSX.utils.book_append_sheet(workbook, worksheet, 'Danh sach ho so');
	const variantSuffix = exportVariant === 'legacy'
		? 'legacy'
		: exportVariant === 'review-summary'
			? 'review-summary'
			: 'expanded';

	return {
		fileName: `admission-reviews-${variantSuffix}-${sanitizeFileNamePart(query?.status || 'all', 'all')}.xlsx`,
		buffer: XLSX.write(workbook, { bookType: 'xlsx', type: 'buffer' }) as Buffer,
	};
}

export async function getReviewApplicationDetail(
	applicationId: unknown,
	tenantId: number | string,
	options: { includeDeleted?: boolean } = {},
) {
	const id = toPositiveInt(applicationId, 0);
	if (!id) {
		const error = new Error('Admission application id is invalid') as Error & { status?: number };
		error.status = 400;
		throw error;
	}

	const row = await strapi.db.query(ADMISSION_APPLICATION_UID).findOne({
		where: buildAdmissionWhere({ id }, tenantId, options),
		populate: REVIEW_DETAIL_POPULATE,
	});

	if (!row?.id) {
		const error = new Error('Admission application not found') as Error & { status?: number };
		error.status = 404;
		throw error;
	}

	return row;
}

export async function acknowledgeAdmissionApproval(
	applicationId: unknown,
	parentUserId: number,
	tenantId: number | string,
	payload: { note?: unknown } = {},
) {
	const application = await getReviewApplicationDetail(applicationId, tenantId);
	if (Number(application?.parent?.id || 0) !== Number(parentUserId || 0)) {
		const error = new Error('Only the application parent can acknowledge approval') as Error & { status?: number };
		error.status = 403;
		throw error;
	}

	if (readAdmissionStatus(application) !== 'approved') {
		const error = new Error('Chỉ hồ sơ đã duyệt mới có thể xác nhận đã nhận thông tin') as Error & { status?: number };
		error.status = 409;
		throw error;
	}

	if (application?.approvedAcknowledgedAt) {
		return application;
	}

	await strapi.entityService.update(ADMISSION_APPLICATION_UID, Number(application.id), {
		data: {
			approvedAcknowledgedAt: new Date().toISOString(),
			approvedAcknowledgedBy: parentUserId,
			approvedAcknowledgedNote: toText(payload.note) || null,
		} as any,
	});

	await createReviewActivity(Number(application.id), tenantId, {
		actorUserId: parentUserId,
		actorType: 'PARENT',
		actionType: 'APPROVAL_ACKNOWLEDGED',
		metadata: null,
	});

	return getReviewApplicationDetail(application.id, tenantId);
}

export async function sendAdmissionApprovalReminder(
	applicationId: unknown,
	actorUserId: number,
	tenantId: number | string,
) {
	const application = await getReviewApplicationDetail(applicationId, tenantId);
	if (readAdmissionStatus(application) !== 'approved') {
		const error = new Error('Chỉ hồ sơ đã duyệt mới được gửi nhắc xác nhận') as Error & { status?: number };
		error.status = 409;
		throw error;
	}

	if (application?.approvedAcknowledgedAt) {
		const error = new Error('Phụ huynh đã xác nhận nhận thông tin duyệt hồ sơ') as Error & { status?: number };
		error.status = 409;
		throw error;
	}

	await sendApprovalNotificationEmail(application);

	const notifiedAt = new Date().toISOString();
	await strapi.entityService.update(ADMISSION_APPLICATION_UID, Number(application.id), {
		data: {
			approvalNotifiedAt: notifiedAt,
			approvalNotificationCount: Math.max(0, Number(application?.approvalNotificationCount || 0)) + 1,
		} as any,
	});

	await createReviewActivity(Number(application.id), tenantId, {
		actorUserId,
		actorType: 'SCHOOL',
		actionType: 'APPROVAL_REMINDER_SENT',
		metadata: {
			notifiedAt,
			notificationCount: Math.max(0, Number(application?.approvalNotificationCount || 0)) + 1,
		},
	});

	return getReviewApplicationDetail(application.id, tenantId);
}

export async function getReviewApplicationSnapshot(applicationId: unknown, tenantId: number | string) {
	const id = toPositiveInt(applicationId, 0);
	if (!id) {
		const error = new Error('Admission application id is invalid') as Error & { status?: number };
		error.status = 400;
		throw error;
	}

	const row = await strapi.db.query(ADMISSION_APPLICATION_UID).findOne({
		where: buildAdmissionWhere({ id }, tenantId),
		select: ['id', 'applicationCode', 'reviewSnapshot', 'updatedAt'],
	});

	if (!row?.id) {
		const error = new Error('Admission application not found') as Error & { status?: number };
		error.status = 404;
		throw error;
	}

	return row;
}

export async function getReviewApplicationFormData(applicationId: unknown, tenantId: number | string) {
	const id = toPositiveInt(applicationId, 0);
	if (!id) {
		const error = new Error('Admission application id is invalid') as Error & { status?: number };
		error.status = 400;
		throw error;
	}

	const row = await strapi.db.query(ADMISSION_APPLICATION_UID).findOne({
		where: buildAdmissionWhere({ id }, tenantId),
		select: ['id', 'applicationCode', 'formData', 'updatedAt'],
	});

	if (!row?.id) {
		const error = new Error('Admission application not found') as Error & { status?: number };
		error.status = 404;
		throw error;
	}

	return row;
}

async function getReviewApplicationSnapshotSource(applicationId: unknown, tenantId: number | string) {
	const id = toPositiveInt(applicationId, 0);
	if (!id) {
		const error = new Error('Admission application id is invalid') as Error & { status?: number };
		error.status = 400;
		throw error;
	}

	const row = await strapi.db.query(ADMISSION_APPLICATION_UID).findOne({
		where: buildAdmissionWhere({ id }, tenantId),
		select: ['id', 'applicationCode', 'studentCode', 'studentName', 'dob', 'gender', 'currentSchool', 'address', 'formData', 'formTemplateVersion', 'reviewSnapshot'],
		populate: REVIEW_SNAPSHOT_SOURCE_POPULATE,
	});

	if (!row?.id) {
		const error = new Error('Admission application not found') as Error & { status?: number };
		error.status = 404;
		throw error;
	}

	return row;
}

function logRebuildStepDuration(step: string, startedAt: number, applicationId: unknown) {
	strapi.log.info(`[admission-review-snapshot] ${step} application=${String(applicationId || '')} durationMs=${Date.now() - startedAt}`);
}

function canApplyReviewDecision(currentStatus: ReturnType<typeof getEffectiveReviewStatus>, action: string) {
	if (currentStatus === 'submitted') {
		return action === 'returned' || action === 'accepted';
	}

	if (currentStatus === 'accepted') {
		return action === 'returned';
	}

	return false;
}

function normalizeMessageAttachments(value: unknown) {
	if (!Array.isArray(value)) return [];

	return value
		.filter((entry) => entry && typeof entry === 'object' && !Array.isArray(entry))
		.map((entry: any) => ({
			name: String(entry.name || '').trim() || 'Tep dinh kem',
			url: String(entry.url || '').trim(),
			mime: String(entry.mime || '').trim() || null,
			size: Number.isFinite(Number(entry.size)) ? Number(entry.size) : null,
			fileAssetId: Number.isFinite(Number(entry.fileAssetId)) && Number(entry.fileAssetId) > 0 ? Number(entry.fileAssetId) : null,
			storageProvider: String(entry.storageProvider || '').trim() || null,
			fieldKey: String(entry.fieldKey || '').trim() || null,
			fieldLabel: String(entry.fieldLabel || '').trim() || null,
			note: String(entry.note || '').trim() || null,
		}));
}

function normalizeReviewMessage(row: any) {
	return {
		id: row?.id,
		senderType: String(row?.senderType || '').trim() || 'UNKNOWN',
		senderUser: row?.senderUser
			? {
				id: row.senderUser.id,
				username: row.senderUser.username || '',
				email: row.senderUser.email || '',
				fullName: row.senderUser.fullName || '',
			}
			: null,
		messageType: String(row?.messageType || '').trim() || 'MESSAGE',
		content: row?.content || '',
		attachments: normalizeMessageAttachments(row?.attachments),
		metadata: row?.metadata && typeof row.metadata === 'object' && !Array.isArray(row.metadata)
			? row.metadata
			: null,
		createdAt: row?.createdAt || null,
		visibility: String(row?.visibility || '').trim() || 'PUBLIC',
	};
}

async function updateApplicationConversationState(
	applicationId: number,
	data: Record<string, unknown>,
) {
	await strapi.entityService.update(ADMISSION_APPLICATION_UID, applicationId, {
		data: data as any,
	});
}

function resolvePublicUploadsRoot() {
	const runtimeStrapi = (globalThis as any)?.strapi;
	const configuredPublicRoot = [
		runtimeStrapi?.dirs?.static?.public,
		runtimeStrapi?.dirs?.app?.public,
		runtimeStrapi?.dirs?.app?.root ? path.join(runtimeStrapi.dirs.app.root, 'public') : '',
	]
		.find((value) => typeof value === 'string' && value.trim()) as string | undefined;

	return path.join(configuredPublicRoot || path.resolve(process.cwd(), 'public'), 'uploads');
}

function resolveAttachmentFilePaths(attachments: unknown[]) {
	const uploadsRoot = resolvePublicUploadsRoot();
	return normalizeMessageAttachments(attachments)
		.map((attachment) => String((attachment as any)?.url || '').trim())
		.filter((url) => url.startsWith('/uploads/'))
		.map((url) => url.replace(/^\/uploads\//, ''))
		.filter(Boolean)
		.map((relativePath) => path.join(uploadsRoot, ...relativePath.split('/').filter(Boolean)));
}

async function removeMessageAttachmentFiles(attachments: unknown[]) {
	const filePaths = resolveAttachmentFilePaths(attachments);
	await Promise.all(filePaths.map(async (filePath) => {
		try {
			await fs.unlink(filePath);
		} catch {
			// Ignore best-effort cleanup failures.
		}
	}));
}

async function syncApplicationConversationState(applicationId: number, tenantId: number | string) {
	const application = await strapi.db.query(ADMISSION_APPLICATION_UID).findOne({
		where: buildAdmissionWhere({ id: applicationId }, tenantId),
		select: ['id', 'parentLastOpenedAt', 'schoolLastOpenedAt', 'lastActivityAt'],
	});

	const messages = await strapi.db.query(ADMISSION_APPLICATION_MESSAGE_UID).findMany({
		where: mergeTenantWhere({
			application: { id: applicationId },
			visibility: 'PUBLIC',
		}, tenantId),
		orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
		select: ['id', 'createdAt', 'senderType', 'visibility'],
	});

	const parentLastOpenedAt = String(application?.parentLastOpenedAt || '').trim();
	const schoolLastOpenedAt = String(application?.schoolLastOpenedAt || '').trim();
	const parentLastOpenedTime = parentLastOpenedAt ? new Date(parentLastOpenedAt).getTime() : null;
	const schoolLastOpenedTime = schoolLastOpenedAt ? new Date(schoolLastOpenedAt).getTime() : null;

	const parentUnreadMessageCount = (messages || []).filter((message: any) => {
		const senderType = String(message?.senderType || '').trim().toUpperCase();
		if (senderType === 'PARENT') return false;
		if (!parentLastOpenedTime || Number.isNaN(parentLastOpenedTime)) return true;
		const createdAtTime = new Date(message?.createdAt || 0).getTime();
		return Number.isFinite(createdAtTime) && createdAtTime > parentLastOpenedTime;
	}).length;

	const schoolUnreadMessageCount = (messages || []).filter((message: any) => {
		const senderType = String(message?.senderType || '').trim().toUpperCase();
		if (senderType !== 'PARENT') return false;
		if (!schoolLastOpenedTime || Number.isNaN(schoolLastOpenedTime)) return true;
		const createdAtTime = new Date(message?.createdAt || 0).getTime();
		return Number.isFinite(createdAtTime) && createdAtTime > schoolLastOpenedTime;
	}).length;

	await updateApplicationConversationState(applicationId, {
		lastMessageAt: messages?.[0]?.createdAt || null,
		parentUnreadMessageCount,
		schoolUnreadMessageCount,
	});
}

async function clearReviewWorkflowMessages(applicationId: number, tenantId: number | string) {
	const workflowMessages = await strapi.db.query(ADMISSION_APPLICATION_MESSAGE_UID).findMany({
		where: mergeTenantWhere({
			application: { id: applicationId },
			senderType: 'SCHOOL',
			messageType: { $in: ['REQUEST_UPDATE', 'STATUS_NOTICE'] },
			visibility: 'PUBLIC',
		}, tenantId),
		select: ['id', 'attachments'],
	});

	for (const message of workflowMessages || []) {
		await removeMessageAttachmentFiles((message as any)?.attachments || []);
		await strapi.entityService.delete(ADMISSION_APPLICATION_MESSAGE_UID, Number((message as any)?.id));
	}

	await syncApplicationConversationState(applicationId, tenantId);
}

export async function createReviewActivity(
	applicationId: number,
	tenantId: number | string,
	payload: {
		actorUserId?: number | null;
		actorType: 'SCHOOL' | 'PARENT' | 'SYSTEM' | 'UNKNOWN';
		actionType: string;
		description?: string | null;
		ipAddress?: string | null;
		userAgent?: string | null;
		metadata?: Record<string, unknown> | null;
	},
) {
	const timestamp = new Date().toISOString();
	await strapi.entityService.create(ADMISSION_APPLICATION_ACTIVITY_UID, {
		data: {
			tenant: tenantId,
			application: applicationId,
			actorUser: payload.actorUserId || null,
			actorType: payload.actorType,
			actionType: payload.actionType,
			description: payload.description || null,
			ipAddress: payload.ipAddress || null,
			userAgent: payload.userAgent || null,
			metadata: payload.metadata || null,
		} as any,
	});

	await updateApplicationConversationState(applicationId, {
		lastActivityAt: timestamp,
	});
}

async function createReviewMessage(
	application: any,
	tenantId: number | string,
	payload: {
		senderType: 'SCHOOL' | 'PARENT' | 'SYSTEM';
		senderUserId?: number | null;
		messageType: 'MESSAGE' | 'REQUEST_UPDATE' | 'SUPPLEMENT_FILE' | 'STATUS_NOTICE' | 'SYSTEM';
		content?: string | null;
		attachments?: unknown[];
		metadata?: Record<string, unknown> | null;
		visibility?: 'PUBLIC' | 'INTERNAL';
		incrementParentUnread?: boolean;
		incrementSchoolUnread?: boolean;
	},
) {
	const content = toText(payload.content) || null;
	const attachments = normalizeMessageAttachments(payload.attachments);
	if (!content && attachments.length === 0) {
		const error = new Error('Noi dung tin nhan hoac tep dinh kem la bat buoc') as Error & { status?: number };
		error.status = 400;
		throw error;
	}

	const timestamp = new Date().toISOString();
	const message = await strapi.entityService.create(ADMISSION_APPLICATION_MESSAGE_UID, {
		data: {
			tenant: tenantId,
			application: application.id,
			senderType: payload.senderType,
			senderUser: payload.senderUserId || null,
			messageType: payload.messageType,
			content,
			attachments,
			metadata: payload.metadata || null,
			visibility: payload.visibility || 'PUBLIC',
		} as any,
		populate: REVIEW_MESSAGE_POPULATE,
	});

	await updateApplicationConversationState(application.id, {
		lastMessageAt: timestamp,
		parentUnreadMessageCount: Math.max(0, Number(application?.parentUnreadMessageCount || 0))
			+ (payload.incrementParentUnread ? 1 : 0),
		schoolUnreadMessageCount: Math.max(0, Number(application?.schoolUnreadMessageCount || 0))
			+ (payload.incrementSchoolUnread ? 1 : 0),
	});

	return normalizeReviewMessage(message);
}

export async function getReviewApplicationMessages(applicationId: unknown, tenantId: number | string) {
	const application = await getReviewApplicationDetail(applicationId, tenantId);
	const rows = await strapi.db.query(ADMISSION_APPLICATION_MESSAGE_UID).findMany({
		where: mergeTenantWhere({
			application: {
				id: application.id,
			},
		}, tenantId),
		orderBy: [{ createdAt: 'asc' }],
		populate: REVIEW_MESSAGE_POPULATE,
	});

	return (rows || []).map((row: any) => normalizeReviewMessage(row));
}

export async function sendReviewApplicationMessage(
	applicationId: unknown,
	payload: {
		content?: unknown;
		attachments?: unknown[];
		ipAddress?: string | null;
		userAgent?: string | null;
	},
	senderUserId: number,
	tenantId: number | string,
) {
	const application = await getReviewApplicationDetail(applicationId, tenantId);
	const message = await createReviewMessage(application, tenantId, {
		senderType: 'SCHOOL',
		senderUserId,
		messageType: 'MESSAGE',
		content: toText(payload.content) || null,
		attachments: Array.isArray(payload.attachments) ? payload.attachments : [],
		visibility: 'PUBLIC',
		incrementParentUnread: true,
	});

	await createReviewActivity(application.id, tenantId, {
		actorUserId: senderUserId,
		actorType: 'SCHOOL',
		actionType: 'MESSAGE_SENT',
		ipAddress: payload.ipAddress || null,
		userAgent: payload.userAgent || null,
		metadata: {
			messageId: message.id,
			messageType: message.messageType,
			attachmentCount: Array.isArray(message.attachments) ? message.attachments.length : 0,
		},
	});

	return message;
}

export async function sendReviewApplicationEmail(
	applicationId: unknown,
	payload: {
		subject?: unknown;
		content?: unknown;
		attachments?: unknown[];
		alsoCreateConversationMessage?: unknown;
		ipAddress?: string | null;
		userAgent?: string | null;
		publicBaseUrl?: unknown;
	},
	senderUserId: number,
	tenantId: number | string,
) {
	const application = await getReviewApplicationDetail(applicationId, tenantId);
	const recipientEmail = toText(application?.parent?.email).toLowerCase();
	if (!recipientEmail) {
		const error = new Error('Phụ huynh chưa có email để nhận thông báo') as Error & { status?: number };
		error.status = 409;
		throw error;
	}

	const subject = toText(payload.subject);
	if (!subject) {
		const error = new Error('Tieu de email la bat buoc') as Error & { status?: number };
		error.status = 400;
		throw error;
	}

	const sanitizedHtml = sanitizeEmailHtml(payload.content);
	const plainText = htmlToPlainText(sanitizedHtml);
	if (!plainText) {
		const error = new Error('Noi dung email la bat buoc') as Error & { status?: number };
		error.status = 400;
		throw error;
	}

	const attachments = normalizeMessageAttachments(payload.attachments);
	const backendBaseUrl = resolveBackendBaseUrl(payload.publicBaseUrl);
	const attachmentHtml = buildEmailAttachmentHtml(attachments as Array<Record<string, unknown>>, backendBaseUrl);
	const attachmentText = buildEmailAttachmentText(attachments as Array<Record<string, unknown>>, backendBaseUrl);

	await enqueueMail({
		tenantId,
		mailType: 'admission_review_manual_email',
		to: recipientEmail,
		subject,
		html: `${sanitizedHtml}${attachmentHtml}`,
		text: `${plainText}${attachmentText}`,
		metadata: {
			applicationId: application?.id,
			senderUserId,
			source: 'admission-application.sendReviewResultEmail',
		},
	});

	const shouldCreateConversationMessage = payload.alsoCreateConversationMessage !== false;
	let message = null;
	if (shouldCreateConversationMessage) {
		message = await createReviewMessage(application, tenantId, {
			senderType: 'SCHOOL',
			senderUserId,
			messageType: 'STATUS_NOTICE',
			content: sanitizedHtml,
			attachments,
			metadata: {
				channel: 'EMAIL',
				subject,
				recipientEmail,
			},
			visibility: 'PUBLIC',
			incrementParentUnread: true,
		});
	}

	await createReviewActivity(application.id, tenantId, {
		actorUserId: senderUserId,
		actorType: 'SCHOOL',
		actionType: 'MESSAGE_SENT',
		ipAddress: payload.ipAddress || null,
		userAgent: payload.userAgent || null,
		metadata: {
			channel: 'EMAIL',
			subject,
			recipientEmail,
			attachmentCount: attachments.length,
			conversationMessageId: message?.id || null,
		},
	});

	return {
		application: await getReviewApplicationDetail(application.id, tenantId),
		message,
	};
}

export async function getReviewApplicationEmailTemplates(
	applicationId: unknown,
	tenantId: number | string,
) {
	const application = await getReviewApplicationDetail(applicationId, tenantId);
	const rows = await strapi.db.query(NOTIFICATION_TEMPLATE_UID).findMany({
		where: mergeTenantWhere({
			code: { $in: [...REVIEW_EMAIL_TEMPLATE_CODES] },
			type: 'email',
			isActive: true,
		}, tenantId),
		select: ['id', 'code', 'name', 'subject', 'content', 'variables', 'type', 'isActive'],
		orderBy: [{ code: 'asc' }],
	});

	const replacements = buildReviewEmailTemplateData(application);
	const byCode = new Map((rows || []).map((row: any) => [String(row?.code || '').trim().toLowerCase(), row]));

	return REVIEW_EMAIL_TEMPLATE_CODES.map((code) => {
		const row = byCode.get(code);
		if (!row?.id) return null;

		return {
			id: row.id,
			key: code,
			code,
			label: toText(row.name) || code,
			subject: notificationService.replaceVariables(row.subject, replacements),
			content: notificationService.replaceVariables(row.content, replacements),
			variables: row.variables ?? null,
		};
	}).filter(Boolean);
}

export async function getReviewApplicationNotificationTemplate(
	applicationId: unknown,
	templateCode: unknown,
	tenantId: number | string,
) {
	const normalizedCode = toText(templateCode).trim().toLowerCase();
	if (!normalizedCode) {
		const error = new Error('template code is required') as Error & { status?: number };
		error.status = 400;
		throw error;
	}

	const application = await getReviewApplicationDetail(applicationId, tenantId);
	const row = await strapi.db.query(NOTIFICATION_TEMPLATE_UID).findOne({
		where: mergeTenantWhere({
			code: { $eqi: normalizedCode },
			isActive: true,
		}, tenantId),
		select: ['id', 'code', 'name', 'subject', 'content', 'variables', 'type', 'isActive'],
	});

	if (!row?.id) {
		return null;
	}

	const replacements = buildReviewEmailTemplateData(application);
	return {
		id: row.id,
		code: toText(row.code) || normalizedCode,
		name: toText(row.name) || normalizedCode,
		subject: notificationService.replaceVariables(row.subject, replacements),
		content: notificationService.replaceVariables(row.content, replacements),
		variables: row.variables ?? null,
		type: toText(row.type) || 'email',
	};
}

export async function createReviewDetailViewActivity(
	applicationId: unknown,
	actorUserId: number,
	tenantId: number | string,
	payload: {
		ipAddress?: string | null;
		userAgent?: string | null;
	},
) {
	const application = await getReviewApplicationDetail(applicationId, tenantId);
	await createReviewActivity(application.id, tenantId, {
		actorUserId,
		actorType: 'SCHOOL',
		actionType: 'VIEW_REVIEW_DETAIL',
		ipAddress: payload.ipAddress || null,
		userAgent: payload.userAgent || null,
		metadata: null,
	});
}

export async function reviewApplicationDecision(
	applicationId: unknown,
	payload: Record<string, unknown>,
	reviewerId: number,
	tenantId: number | string,
) {
	const existing = await getReviewApplicationDetail(applicationId, tenantId);
	const currentStatus = getEffectiveReviewStatus(existing);

	const action = toText(payload?.action).toLowerCase();
	if (action !== 'returned' && action !== 'accepted') {
		const error = new Error('action is invalid') as Error & { status?: number };
		error.status = 400;
		throw error;
	}

	if (!canApplyReviewDecision(currentStatus, action)) {
		const error = new Error('Chỉ hồ sơ đang chờ duyệt hoặc hồ sơ đã tiếp nhận cần chỉnh sửa mới được xử lý') as Error & { status?: number };
		error.status = 409;
		throw error;
	}

	const reviewNote = toText(payload?.reviewNote) || null;
	if (action === 'returned' && !reviewNote) {
		const error = new Error('Vui lòng nhập lý do trả lại hồ sơ') as Error & { status?: number };
		error.status = 400;
		throw error;
	}

	await strapi.entityService.update(ADMISSION_APPLICATION_UID, existing.id, {
		data: {
			reviewStatus: action,
			reviewedBy: reviewerId,
			reviewedAt: new Date().toISOString(),
			reviewNote,
			admissionStatus: action === 'returned' ? 'rejected' : 'approved',
			approvalNotifiedAt: action === 'returned' ? null : existing.approvalNotifiedAt || null,
			approvalNotificationCount: action === 'returned' ? 0 : Math.max(0, Number(existing?.approvalNotificationCount || 0)),
			approvedAcknowledgedAt: action === 'returned' ? null : existing.approvedAcknowledgedAt || null,
			approvedAcknowledgedBy: action === 'returned' ? null : existing.approvedAcknowledgedBy?.id || null,
			approvedAcknowledgedNote: action === 'returned' ? null : existing.approvedAcknowledgedNote || null,
		} as any,
		populate: {
			parent: {
				fields: ['id', 'username', 'email', 'fullName', 'phone'],
			},
			reviewedBy: {
				fields: ['id', 'username', 'email', 'fullName'],
			},
			campaign: {
				populate: {
					formTemplate: true,
				},
			},
		},
	});

	if (action === 'returned' && reviewNote) {
		const message = await createReviewMessage(existing, tenantId, {
			senderType: 'SCHOOL',
			senderUserId: reviewerId,
			messageType: 'REQUEST_UPDATE',
			content: reviewNote,
			attachments: [],
			visibility: 'PUBLIC',
			incrementParentUnread: true,
		});

		await createReviewActivity(existing.id, tenantId, {
			actorUserId: reviewerId,
			actorType: 'SCHOOL',
			actionType: 'APPLICATION_NEEDS_UPDATE',
			metadata: {
				oldStatus: currentStatus,
				newStatus: action,
				messageId: message.id,
			},
		});
	}

	return getReviewApplicationDetail(existing.id, tenantId);
}

export async function updateReturnedApplicationReviewNote(
	applicationId: unknown,
	reviewNoteInput: unknown,
	reviewerId: number,
	tenantId: number | string,
) {
	const existing = await getReviewApplicationDetail(applicationId, tenantId);
	const currentStatus = getEffectiveReviewStatus(existing);
	if (currentStatus !== 'returned') {
		const error = new Error('Chỉ hồ sơ đang cần bổ sung mới được sửa nội dung nhận xét') as Error & { status?: number };
		error.status = 409;
		throw error;
	}

	const reviewNote = toText(reviewNoteInput) || null;
	if (!reviewNote) {
		const error = new Error('Vui lòng nhập nội dung nhận xét') as Error & { status?: number };
		error.status = 400;
		throw error;
	}

	await strapi.entityService.update(ADMISSION_APPLICATION_UID, existing.id, {
		data: {
			reviewNote,
			reviewedBy: reviewerId,
			reviewedAt: new Date().toISOString(),
		} as any,
	});

	const latestRequestUpdateMessage = await strapi.db.query(ADMISSION_APPLICATION_MESSAGE_UID).findOne({
		where: mergeTenantWhere({
			application: { id: existing.id },
			senderType: 'SCHOOL',
			messageType: 'REQUEST_UPDATE',
			visibility: 'PUBLIC',
		}, tenantId),
		orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
		select: ['id'],
	});

	if (latestRequestUpdateMessage?.id) {
		await strapi.entityService.update(ADMISSION_APPLICATION_MESSAGE_UID, Number(latestRequestUpdateMessage.id), {
			data: {
				content: reviewNote,
				senderUser: reviewerId,
			} as any,
		});
	}

	await createReviewActivity(existing.id, tenantId, {
		actorUserId: reviewerId,
		actorType: 'SCHOOL',
		actionType: 'APPLICATION_UPDATED',
		metadata: {
			field: 'reviewNote',
			messageId: latestRequestUpdateMessage?.id || null,
		},
	});

	return getReviewApplicationDetail(existing.id, tenantId);
}

export async function resetReviewApplicationToDraft(
	applicationId: unknown,
	reviewerId: number,
	tenantId: number | string,
) {
	const existing = await getReviewApplicationDetail(applicationId, tenantId);
	const currentStatus = getEffectiveReviewStatus(existing);
	if (currentStatus !== 'submitted') {
		const error = new Error('Chỉ hồ sơ đang chờ duyệt mới được đưa về nháp') as Error & { status?: number };
		error.status = 409;
		throw error;
	}

	await strapi.entityService.update(ADMISSION_APPLICATION_UID, existing.id, {
		data: {
			admissionStatus: 'draft',
			reviewStatus: null,
			reviewedBy: null,
			reviewedAt: null,
			reviewNote: null,
			submittedAt: null,
			approvalNotifiedAt: null,
			approvalNotificationCount: 0,
			approvedAcknowledgedAt: null,
			approvedAcknowledgedBy: null,
			approvedAcknowledgedNote: null,
		} as any,
	});

	await clearReviewWorkflowMessages(existing.id, tenantId);

	await createReviewActivity(existing.id, tenantId, {
		actorUserId: reviewerId,
		actorType: 'SCHOOL',
		actionType: 'APPLICATION_UPDATED',
		metadata: {
			oldStatus: currentStatus,
			newStatus: 'draft',
			resetReviewContent: true,
		},
	});

	return getReviewApplicationDetail(existing.id, tenantId);
}

async function findActiveRestoreConflict(application: any, tenantId: number | string) {
	const applicationId = Number(application?.id || 0);
	const campaignId = Number(application?.campaign?.id || application?.campaign || 0);
	const studentCode = toText(application?.studentCode);
	if (!applicationId || !campaignId || !studentCode) {
		return null;
	}

	return strapi.db.query(ADMISSION_APPLICATION_UID).findOne({
		where: buildAdmissionWhere({
			id: { $ne: applicationId },
			studentCode: { $eq: studentCode },
			campaign: {
				id: {
					$eq: campaignId,
				},
			},
		}, tenantId),
		select: ['id', 'applicationCode', 'studentCode', 'studentName'],
	});
}

export async function softDeleteReviewApplication(
	applicationId: unknown,
	actorUserId: number,
	tenantId: number | string,
	reason?: unknown,
) {
	const existing = await getReviewApplicationDetail(applicationId, tenantId, { includeDeleted: true });
	if (existing?.isDeleted) {
		const error = new Error('Hồ sơ đã được xóa mềm trước đó') as Error & { status?: number };
		error.status = 409;
		throw error;
	}

	const deletedAt = new Date().toISOString();
	const normalizedReason = toText(reason) || null;
	await strapi.entityService.update(ADMISSION_APPLICATION_UID, Number(existing.id), {
		data: {
			isDeleted: true,
			deletedAt,
			deletedBy: actorUserId,
			deleteReason: normalizedReason,
			restoredAt: null,
			restoredBy: null,
			restoreReason: null,
		} as any,
	});

	await createReviewActivity(Number(existing.id), tenantId, {
		actorUserId,
		actorType: 'SCHOOL',
		actionType: 'APPLICATION_SOFT_DELETED',
		metadata: {
			reason: normalizedReason,
			deletedAt,
		},
	});

	return getReviewApplicationDetail(existing.id, tenantId, { includeDeleted: true });
}

export async function restoreReviewApplication(
	applicationId: unknown,
	actorUserId: number,
	tenantId: number | string,
	reason?: unknown,
) {
	const existing = await getReviewApplicationDetail(applicationId, tenantId, { includeDeleted: true });
	if (!existing?.isDeleted) {
		const error = new Error('Hồ sơ này chưa bị xóa mềm') as Error & { status?: number };
		error.status = 409;
		throw error;
	}

	const conflict = await findActiveRestoreConflict(existing, tenantId);
	if (conflict?.id) {
		const error = new Error(`Không thể khôi phục vì đã có hồ sơ đang hoạt động cùng mã học sinh trong đợt tuyển sinh này${conflict?.applicationCode ? ` (${conflict.applicationCode})` : ''}`) as Error & { status?: number };
		error.status = 409;
		throw error;
	}

	const restoredAt = new Date().toISOString();
	const normalizedReason = toText(reason) || null;
	await strapi.entityService.update(ADMISSION_APPLICATION_UID, Number(existing.id), {
		data: {
			isDeleted: false,
			restoredAt,
			restoredBy: actorUserId,
			restoreReason: normalizedReason,
		} as any,
	});

	await createReviewActivity(Number(existing.id), tenantId, {
		actorUserId,
		actorType: 'SCHOOL',
		actionType: 'APPLICATION_RESTORED',
		metadata: {
			reason: normalizedReason,
			restoredAt,
		},
	});

	return getReviewApplicationDetail(existing.id, tenantId, { includeDeleted: true });
}

export async function rebuildReviewApplicationSnapshot(applicationId: unknown, tenantId: number | string) {
	const totalStartedAt = Date.now();
	const fetchStartedAt = Date.now();
	const existing = await getReviewApplicationSnapshotSource(applicationId, tenantId);
	logRebuildStepDuration('fetch-source', fetchStartedAt, applicationId);

	const buildStartedAt = Date.now();
	const reviewSnapshot = buildAdmissionReviewSnapshot({
		application: existing,
		campaign: existing?.campaign,
		parent: existing?.parent,
	});
	logRebuildStepDuration('build-snapshot', buildStartedAt, applicationId);

	const updateStartedAt = Date.now();
	await strapi.entityService.update(ADMISSION_APPLICATION_UID, existing.id, {
		data: {
			reviewSnapshot,
		} as any,
	});
	logRebuildStepDuration('persist-snapshot', updateStartedAt, applicationId);
	logRebuildStepDuration('total', totalStartedAt, applicationId);

	return {
		...existing,
		reviewSnapshot,
	};
}

export default factories.createCoreService('api::admission-application.admission-application');