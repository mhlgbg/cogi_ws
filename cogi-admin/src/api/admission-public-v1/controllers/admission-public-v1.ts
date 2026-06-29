import crypto from 'node:crypto';
import { enqueueMail } from '../../../services/mail-queue';
import { mergeTenantWhere, resolveCurrentTenantId, toText, whereByParam } from '../../../utils/tenant-scope';
import { buildAdmissionReviewSnapshot } from '../../../utils/admission-review-snapshot';
import {
	markRemovedAdmissionFormFileAssetsDeleted,
	persistAdmissionFormDataFiles,
	removePersistedAdmissionFiles,
	syncAdmissionFormFileAssetsEntityId,
} from '../../../utils/admission-form-files';
import { persistAdmissionMessageFiles, removePersistedAdmissionMessageFiles } from '../../../utils/admission-message-files';
import { acknowledgeAdmissionApproval } from '../../admission-application/services/admission-application';
import { ensureUserHasAuthenticatedRole } from '../../auth-extended/services/ensure-authenticated-role';
import { createUserTenant, updateUserPhoneIfEmpty } from '../../admin/services/invite-user';
import { canParentViewExamCard } from '../../campaign/utils/exam-card-printing';
import { logCandidateExamCardAction, renderCandidateExamExamCard } from '../../candidate-exam/services/candidate-exam';
import {
	buildPublicAdmissionV1Permissions,
	canCreateApplication,
	canSendConversationAttachment,
	readCampaignStatus as readPermissionCampaignStatus,
} from '../services/permissions';

const ADMISSION_APPLICATION_UID = 'api::admission-application.admission-application';
const ADMISSION_APPLICATION_MESSAGE_UID = 'api::admission-application-message.admission-application-message';
const ADMISSION_APPLICATION_ACTIVITY_UID = 'api::admission-application-activity.admission-application-activity';
const CAMPAIGN_UID = 'api::campaign.campaign';
const CANDIDATE_EXAM_UID = 'api::candidate-exam.candidate-exam';
const TENANT_UID = 'api::tenant.tenant';
const USER_UID = 'plugin::users-permissions.user';
const USER_TENANT_UID = 'api::user-tenant.user-tenant';
const RESULT_LOOKUP_NOT_FOUND_MESSAGE = 'Thông tin tra cứu không chính xác. Vui lòng kiểm tra lại mã học sinh và mã hồ sơ.';
const RESEND_CODE_SUCCESS_MESSAGE = 'Nếu thông tin khớp với hồ sơ đã đăng ký, mã hồ sơ sẽ được gửi lại tới email của phụ huynh.';

const TOKEN_TTL_MINUTES = 30;
const DEFAULT_APPLICATION_STATUS_GUIDE = {
	draft: {
		title: 'Hồ sơ chưa được nộp đúng hạn',
		message: 'Đã hết hạn nộp hồ sơ.',
		color: 'warning',
		nextSteps: [
			'Nhà trường cảm ơn Phụ huynh đã quan tâm đến thông tin kỳ tuyển sinh.',
		],
	},
	submitted: {
		title: 'Đã nộp hồ sơ',
		message: 'Hồ sơ của học sinh đã được gửi tới Nhà trường và đang chờ rà soát.',
		color: 'info',
		nextSteps: [
			'Phụ huynh vui lòng theo dõi trạng thái hồ sơ trên hệ thống.',
			'Nhà trường sẽ cập nhật kết quả sau khi rà soát.',
		],
	},
	reviewing: {
		title: 'Đang xét duyệt hồ sơ',
		message: 'Cán bộ tuyển sinh đang kiểm tra thông tin và minh chứng trong hồ sơ.',
		color: 'warning',
		nextSteps: [
			'Phụ huynh vui lòng chờ thông báo tiếp theo từ Nhà trường.',
		],
	},
	need_update: {
		title: 'Cần bổ sung hồ sơ',
		message: 'Hồ sơ cần được bổ sung hoặc điều chỉnh theo yêu cầu của Nhà trường.',
		color: 'danger',
		nextSteps: [
			'Phụ huynh vui lòng đọc kỹ nội dung trao đổi với Nhà trường.',
			'Thực hiện bổ sung theo hướng dẫn và nộp lại hồ sơ.',
		],
	},
	accepted: {
		title: 'Đã tiếp nhận hồ sơ',
		message: 'Hồ sơ của học sinh đã được Nhà trường tiếp nhận.',
		color: 'success',
		nextSteps: [
			'Phụ huynh tiếp tục theo dõi các thông tin tiếp theo.',
			'Chậm nhất ngày 03/06/2026, phụ huynh có thể tải và tự in thẻ dự thi trên hệ thống.',
		],
	},
	rejected: {
		title: 'Không tiếp nhận hồ sơ',
		message: 'Hồ sơ chưa đáp ứng điều kiện tiếp nhận theo quy định của kỳ tuyển sinh.',
		color: 'secondary',
		nextSteps: [
			'Phụ huynh vui lòng theo dõi thông báo cụ thể từ Nhà trường nếu có.',
		],
	},
} as const;

type AdmissionGender = 'male' | 'female' | 'other';

type AdmissionAccessTokenPayload = {
	tenantId: string;
	tenantCode: string;
	campaignId: number;
	campaignCode: string;
	applicationId: number;
	studentCode: string;
	parentUserId: number;
	email: string;
	parentFullName?: string;
	parentPhone?: string;
	iat: number;
	exp: number;
};

function normalizeText(value: unknown): string {
	return toText(value);
}

function extractPayload(ctx: any): Record<string, unknown> {
	const body = ctx.request?.body;
	if (body?.data && typeof body.data === 'object' && !Array.isArray(body.data)) {
		return body.data as Record<string, unknown>;
	}

	if (body && typeof body === 'object' && !Array.isArray(body)) {
		return body as Record<string, unknown>;
	}

	return {};
}

function toRequiredText(value: unknown, label: string): string {
	const text = normalizeText(value);
	if (!text) {
		const error = new Error(`${label} is required`) as Error & { status?: number };
		error.status = 400;
		throw error;
	}
	return text;
}

function toNullableText(value: unknown): string | null {
	const text = normalizeText(value);
	return text || null;
}

function toNullableGender(value: unknown): AdmissionGender | null {
	const normalized = normalizeText(value).toLowerCase();
	if (!normalized) return null;
	if (normalized === 'male' || normalized === 'female' || normalized === 'other') {
		return normalized;
	}

	const error = new Error('gender is invalid') as Error & { status?: number };
	error.status = 400;
	throw error;
}

function toRequiredDate(value: unknown, label: string): string {
	const text = toRequiredText(value, label);
	const date = new Date(text);
	if (Number.isNaN(date.getTime())) {
		const error = new Error(`${label} is invalid`) as Error & { status?: number };
		error.status = 400;
		throw error;
	}

	return date.toISOString().slice(0, 10);
}

function toSubmissionMode(value: unknown): 'draft' | 'submitted' {
	const normalized = normalizeText(value).toLowerCase();
	return normalized === 'submitted' || normalized === 'submit' ? 'submitted' : 'draft';
}

function normalizeFormData(value: unknown, learnerCode: string) {
	let normalized: Record<string, unknown>;

	if (value === null || value === undefined || value === '') {
		normalized = {};
	} else if (typeof value === 'string') {
		try {
			const parsed = JSON.parse(value);
			normalized = parsed && typeof parsed === 'object' && !Array.isArray(parsed)
				? parsed as Record<string, unknown>
				: { value: parsed };
		} catch {
			normalized = { value };
		}
	} else if (typeof value === 'object' && !Array.isArray(value)) {
		normalized = { ...(value as Record<string, unknown>) };
	} else {
		normalized = { value };
	}

	if (!normalizeText(normalized.studentCode)) {
		normalized.studentCode = learnerCode;
	}

	return normalized;
}

function normalizeStudentCode(value: unknown): string | null {
	const text = normalizeText(value).toUpperCase();
	return text || null;
}

function extractStudentCode(body: Record<string, unknown>, normalizedFormData: unknown, fallbackLearnerCode?: string | null): string | null {
	const formData = normalizedFormData && typeof normalizedFormData === 'object' && !Array.isArray(normalizedFormData)
		? normalizedFormData as Record<string, unknown>
		: null;

	return normalizeStudentCode(body.studentCode ?? formData?.studentCode ?? fallbackLearnerCode);
}

function readAdmissionStatus(row: any): string {
	return normalizeText(row?.admissionStatus || row?.status || 'draft').toLowerCase() || 'draft';
}

function readCampaignStatus(row: any): string {
	return normalizeText(row?.campaignStatus || row?.status || 'draft').toLowerCase() || 'draft';
}

function readFormTemplateStatus(row: any): string {
	return normalizeText(row?.formTemplateStatus || row?.status || 'draft').toLowerCase() || 'draft';
}

function buildActiveAdmissionWhere() {
	return {
		$or: [
			{ isDeleted: false },
			{ isDeleted: { $null: true } },
		],
	};
}

function maskEmail(email: string): string {
	const normalized = normalizeText(email).toLowerCase();
	const [localPart, domainPart] = normalized.split('@');
	if (!localPart || !domainPart) return '';

	const visiblePrefix = localPart.slice(0, Math.min(2, localPart.length));
	const maskedLocal = `${visiblePrefix}${'*'.repeat(Math.max(2, localPart.length - visiblePrefix.length))}`;
	return `${maskedLocal}@${domainPart}`;
}

function normalizeEmail(value: unknown): string {
	return normalizeText(value).toLowerCase();
}

function normalizePhone(value: unknown): string {
	return normalizeText(value);
}

function normalizeGuideColor(value: unknown): string {
	const normalized = normalizeText(value).toLowerCase();
	return normalized || 'secondary';
}

function normalizeGuideNextSteps(value: unknown, fallback: string[]): string[] {
	if (!Array.isArray(value)) return fallback;
	const nextSteps = value.map((item) => normalizeText(item)).filter(Boolean);
	return nextSteps.length > 0 ? nextSteps : fallback;
}

function readGuideMap(value: unknown): Record<string, any> {
	if (!value || typeof value !== 'object' || Array.isArray(value)) {
		return {};
	}

	return value as Record<string, any>;
}

function getApplicationStatusGuideKey(application: any): 'draft' | 'submitted' | 'reviewing' | 'need_update' | 'accepted' | 'rejected' {
	const admissionStatus = normalizeText(application?.admissionStatus || application?.status).toLowerCase();
	const reviewStatus = normalizeText(application?.reviewStatus).toLowerCase();
	const candidates = [reviewStatus, admissionStatus].filter(Boolean);

	if (candidates.some((value) => value === 'draft')) {
		return 'draft';
	}

	if (candidates.some((value) => value === 'returned' || value === 'need_update' || value === 'rejected-as-need-update' || value === 'application_needs_update')) {
		return 'need_update';
	}

	if (candidates.some((value) => value === 'accepted' || value === 'approved' || value === 'exam_scheduled' || value === 'passed' || value === 'enrolled')) {
		return 'accepted';
	}

	if (candidates.some((value) => value === 'reviewing' || value === 'in_review' || value === 'under_review')) {
		return 'reviewing';
	}

	if (candidates.some((value) => value === 'rejected' || value === 'not_accepted' || value === 'failed')) {
		return 'rejected';
	}

	if (candidates.some((value) => value === 'submitted' || value === 'submit' || value === 'pending')) {
		return 'submitted';
	}

	return 'submitted';
}

function resolveApplicationStatusGuide(campaign: any, application: any) {
	const guideKey = getApplicationStatusGuideKey(application);
	const campaignGuideMap = readGuideMap(campaign?.applicationStatusGuide);
	const defaultGuide = DEFAULT_APPLICATION_STATUS_GUIDE[guideKey];
	const configuredGuide = readGuideMap(campaignGuideMap[guideKey]);

	return {
		key: guideKey,
		title: normalizeText(configuredGuide.title) || defaultGuide.title,
		message: normalizeText(configuredGuide.message) || defaultGuide.message,
		color: normalizeGuideColor(configuredGuide.color || defaultGuide.color),
		nextSteps: normalizeGuideNextSteps(configuredGuide.nextSteps, [...defaultGuide.nextSteps]),
	};
}

function readExamCardInfo(application: any) {
	const snapshot = application?.reviewSnapshot && typeof application.reviewSnapshot === 'object' && !Array.isArray(application.reviewSnapshot)
		? application.reviewSnapshot as Record<string, unknown>
		: null;
	const examCardUrl = normalizeText(snapshot?.examCardUrl || snapshot?.examCardLink || snapshot?.exam_card_url);

	return {
		examCardAvailable: Boolean(examCardUrl),
		examCardUrl: examCardUrl || null,
	};
}

function hasCandidateExamScheduleInfo(candidateExam: any) {
	return Boolean(
		normalizeText(candidateExam?.candidateNumber)
		&& normalizeText(candidateExam?.examRoom)
		&& normalizeText(candidateExam?.examLocation),
	);
}

function buildExamCardAccessPayload(campaign: any, application: any, candidateExam: any) {
	const statusKey = getApplicationStatusGuideKey(application);
	const startAtText = normalizeText(campaign?.examCardPrintStartAt);
	const endAtText = normalizeText(campaign?.examCardPrintEndAt);
	const startAt = startAtText ? new Date(startAtText).getTime() : null;
	const endAt = endAtText ? new Date(endAtText).getTime() : null;
	const now = Date.now();

	if (statusKey !== 'accepted') {
		return {
			canView: false,
			status: 'not_eligible',
			message: '',
		};
	}

	if (campaign?.allowExamCardPrinting !== true) {
		return {
			canView: false,
			status: 'disabled',
			message: '',
		};
	}

	if (Number.isFinite(startAt) && now < Number(startAt)) {
		return {
			canView: false,
			status: 'not_started',
			message: 'Nhà trường chưa đến thời gian phát hành thẻ dự kiểm tra. Quý phụ huynh vui lòng quay lại sau.',
		};
	}

	if (Number.isFinite(endAt) && now > Number(endAt)) {
		return {
			canView: false,
			status: 'expired',
			message: 'Thời gian xem/in thẻ dự kiểm tra đã kết thúc. Quý phụ huynh vui lòng liên hệ nhà trường để được hỗ trợ.',
		};
	}

	if (!candidateExam?.id || !hasCandidateExamScheduleInfo(candidateExam)) {
		return {
			canView: false,
			status: 'pending',
			message: 'Thông tin thẻ dự kiểm tra đang được nhà trường cập nhật.',
		};
	}

	return {
		canView: true,
		status: 'available',
		message: '',
	};
}

function buildResultLookupPayload(campaign: any, application: any) {
	const statusGuide = resolveApplicationStatusGuide(campaign, application);
	const examCard = buildExamCardAccessPayload(campaign, application, application?.candidateExam);

	return {
		application: {
			id: Number(application?.id || 0),
			applicationCode: normalizeText(application?.applicationCode),
			studentCode: normalizeStudentCode(application?.studentCode),
			studentName: normalizeText(application?.studentName),
			admissionStatus: readAdmissionStatus(application),
			reviewStatus: normalizeText(application?.reviewStatus).toLowerCase() || null,
			finalStatus: statusGuide.key,
			acknowledgedAt: application?.approvedAcknowledgedAt || application?.approvedAcknowledgedAt || null,
			examCardAvailable: examCard.canView,
		},
		examCard,
		statusGuide: {
			title: statusGuide.title,
			message: statusGuide.message,
			color: statusGuide.color,
			nextSteps: statusGuide.nextSteps,
		},
		campaign: {
			code: normalizeText(campaign?.code),
			name: normalizeText(campaign?.name),
			allowExamCardPrinting: campaign?.allowExamCardPrinting === true,
			examCardPrintStartAt: campaign?.examCardPrintStartAt || null,
			examCardPrintEndAt: campaign?.examCardPrintEndAt || null,
		},
	};
}

function toBase64Url(input: string): string {
	return Buffer.from(input, 'utf8').toString('base64url');
}

function fromBase64Url(input: string): string {
	return Buffer.from(input, 'base64url').toString('utf8');
}

function resolveTokenSecret(): string {
	const explicitSecret = normalizeText(process.env.ADMISSION_V1_TOKEN_SECRET);
	if (explicitSecret) return explicitSecret;

	const appKeys = (strapi as any).config?.get?.('server.app.keys');
	if (Array.isArray(appKeys) && typeof appKeys[0] === 'string' && appKeys[0].trim()) {
		return appKeys[0].trim();
	}

	if (typeof appKeys === 'string' && appKeys.trim()) {
		return appKeys.split(',')[0].trim();
	}

	return 'admission-v1-dev-secret';
}

function signAccessPayload(payload: AdmissionAccessTokenPayload): string {
	const encodedPayload = toBase64Url(JSON.stringify(payload));
	const signature = crypto.createHmac('sha256', resolveTokenSecret()).update(encodedPayload).digest('base64url');
	return `${encodedPayload}.${signature}`;
}

function verifyAccessToken(token: string): AdmissionAccessTokenPayload {
	const trimmedToken = normalizeText(token);
	if (!trimmedToken || !trimmedToken.includes('.')) {
		const error = new Error('token is invalid') as Error & { status?: number };
		error.status = 400;
		throw error;
	}

	const [encodedPayload, signature] = trimmedToken.split('.');
	const expectedSignature = crypto.createHmac('sha256', resolveTokenSecret()).update(encodedPayload).digest('base64url');
	if (signature.length !== expectedSignature.length) {
		const error = new Error('token is invalid') as Error & { status?: number };
		error.status = 400;
		throw error;
	}
	const isValid = crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature));
	if (!isValid) {
		const error = new Error('token is invalid') as Error & { status?: number };
		error.status = 400;
		throw error;
	}

	const parsed = JSON.parse(fromBase64Url(encodedPayload)) as AdmissionAccessTokenPayload;
	if (!parsed?.exp || parsed.exp < Math.floor(Date.now() / 1000)) {
		const error = new Error('token has expired') as Error & { status?: number };
		error.status = 401;
		throw error;
	}

	return parsed;
}

async function sendAdmissionV1ApplicationCodeEmail(options: {
	tenantId?: number | string;
	email: string;
	parentName?: string;
	studentName: string;
	studentCode: string;
	campaignName: string;
	applicationCode: string;
	mode: 'created' | 'resend';
}) {
	await enqueueMail({
		tenantId: options.tenantId ?? null,
		mailType: options.mode === 'created' ? 'admission_v1_created' : 'admission_v1_resend',
		to: options.email,
		subject: `Ma ho so tuyen sinh - ${options.campaignName}`,
		text:
			`${options.parentName ? `Phu huynh: ${options.parentName}\n` : ''}` +
			`Hoc sinh: ${options.studentName || 'Chua cap nhat'} (${options.studentCode})\n` +
			`${options.mode === 'created' ? 'He thong vua tao ho so tuyen sinh cho hoc sinh nay.\n' : 'Ban vua yeu cau cap lai ma ho so tuyen sinh.\n'}` +
			`Ma ho so: ${options.applicationCode}\n\n` +
			'Vui long nhap ma ho so nay tren trang tuyen sinh de tiep tuc khai ho so hoac theo doi tien do.',
		html:
			`${options.parentName ? `<p>Phu huynh: <strong>${options.parentName}</strong></p>` : ''}` +
			`<p>Hoc sinh: <strong>${options.studentName || 'Chua cap nhat'}</strong> (${options.studentCode})</p>` +
			`<p>${options.mode === 'created' ? 'He thong vua tao ho so tuyen sinh cho hoc sinh nay.' : 'Ban vua yeu cau cap lai ma ho so tuyen sinh.'}</p>` +
			`<p>Ma ho so cua ban la <strong style="font-size:18px;letter-spacing:1px;">${options.applicationCode}</strong></p>` +
			'<p>Vui long nhap ma ho so nay tren trang tuyen sinh de mo form va theo doi ho so.</p>',
		metadata: {
			studentCode: options.studentCode,
			applicationCode: options.applicationCode,
			source: 'admission-public-v1',
		},
	});
}

async function findCampaignByCode(campaignCode: string, tenantId: number | string, requireOpen = false) {
	return strapi.db.query(CAMPAIGN_UID).findOne({
		where: mergeTenantWhere({
			code: {
				$eqi: campaignCode,
			},
			isActive: true,
			...(requireOpen ? { campaignStatus: 'open' } : {}),
		}, tenantId),
		select: ['id', 'name', 'code', 'description', 'campaignStatus', 'startDate', 'endDate', 'formTemplateVersion', 'applicationStatusGuide', 'allowExamCardPrinting', 'examCardPrintStartAt', 'examCardPrintEndAt', 'examCardTemplateHtml'],
		populate: {
			tenant: {
				select: ['id', 'code'],
			},
			formTemplate: {
				select: ['id', 'name', 'version', 'schema', 'formTemplateStatus', 'isLocked'],
			},
		},
	});
}

async function findApplicationAccessByStudentCode(studentCode: string, campaignId: number, tenantId: number | string) {
	const normalizedStudentCode = normalizeStudentCode(studentCode);
	if (!normalizedStudentCode || !campaignId) return null;

	return strapi.db.query(ADMISSION_APPLICATION_UID).findOne({
		where: mergeTenantWhere({
			$and: [
				{
					studentCode: {
						$eq: normalizedStudentCode,
					},
					campaign: {
						id: {
							$eq: campaignId,
						},
					},
				},
				buildActiveAdmissionWhere(),
			],
		}, tenantId),
		select: ['id', 'applicationCode', 'studentCode', 'studentName', 'dob', 'gender', 'currentSchool', 'address', 'formData', 'formTemplateVersion', 'admissionStatus', 'reviewStatus', 'createdAt', 'submittedAt', 'reviewedAt', 'reviewNote', 'parentLastOpenedAt', 'schoolLastOpenedAt', 'parentUnreadMessageCount', 'schoolUnreadMessageCount', 'lastMessageAt', 'lastActivityAt', 'approvalNotifiedAt', 'approvalNotificationCount', 'approvedAcknowledgedAt', 'approvedAcknowledgedNote'],
		populate: {
			parent: {
				select: ['id', 'username', 'email', 'fullName', 'phone'],
			},
			approvedAcknowledgedBy: {
				select: ['id', 'username', 'email', 'fullName'],
			},
			reviewedBy: {
				select: ['id', 'username', 'email', 'fullName'],
			},
			campaign: {
				select: ['id', 'name', 'code', 'description', 'campaignStatus', 'startDate', 'endDate', 'formTemplateVersion'],
				populate: {
					formTemplate: {
						select: ['id', 'name', 'version', 'schema', 'formTemplateStatus', 'isLocked'],
					},
				},
			},
		},
		orderBy: [{ updatedAt: 'desc' }, { createdAt: 'desc' }, { id: 'desc' }],
	});
}

async function findApplicationForPublicLookup(options: {
	studentCode: string;
	applicationCode: string;
	campaignId: number;
	tenantId: number | string;
}) {
	const normalizedStudentCode = normalizeStudentCode(options.studentCode);
	const normalizedApplicationCode = normalizeText(options.applicationCode).toUpperCase();
	if (!normalizedStudentCode || !normalizedApplicationCode || !options.campaignId) return null;

	return strapi.db.query(ADMISSION_APPLICATION_UID).findOne({
		where: mergeTenantWhere({
			$and: [
				{
					studentCode: {
						$eq: normalizedStudentCode,
					},
					applicationCode: {
						$eqi: normalizedApplicationCode,
					},
					campaign: {
						id: {
							$eq: options.campaignId,
						},
					},
				},
				buildActiveAdmissionWhere(),
			],
		}, options.tenantId),
		select: ['id', 'applicationCode', 'studentCode', 'studentName', 'admissionStatus', 'reviewStatus', 'approvedAcknowledgedAt', 'reviewSnapshot'],
		populate: {
			parent: {
				select: ['id', 'email', 'fullName'],
			},
			campaign: {
				select: ['id', 'name', 'code', 'applicationStatusGuide'],
			},
		},
	});
}

async function findCandidateExamForPublicExamCard(options: {
	studentCode: string;
	applicationCode: string;
	campaignId: number;
	tenantId: number | string;
}) {
	const normalizedStudentCode = normalizeStudentCode(options.studentCode);
	const normalizedApplicationCode = normalizeText(options.applicationCode).toUpperCase();
	if (!normalizedStudentCode || !normalizedApplicationCode || !options.campaignId) return null;

	return strapi.db.query(CANDIDATE_EXAM_UID).findOne({
		where: mergeTenantWhere({
			$and: [
				{
					studentCode: {
						$eq: normalizedStudentCode,
					},
					applicationCode: {
						$eqi: normalizedApplicationCode,
					},
					admissionSeason: {
						id: {
							$eq: options.campaignId,
						},
					},
				},
				{
					$or: [
						{ isDeleted: false },
						{ isDeleted: { $null: true } },
					],
				},
			],
		}, options.tenantId),
		select: ['id', 'studentCode', 'applicationCode', 'candidateNumber', 'examRoom', 'examLocation'],
		orderBy: [{ updatedAt: 'desc' }, { createdAt: 'desc' }, { id: 'desc' }],
	});
}

function ensurePublicExamCardAccessible(campaign: any, application: any, candidateExam: any) {
	if (getApplicationStatusGuideKey(application) !== 'accepted') {
		const error = new Error('Hồ sơ chưa đủ điều kiện để xem thẻ dự kiểm tra.') as Error & { status?: number };
		error.status = 403;
		throw error;
	}

	if (campaign?.allowExamCardPrinting !== true) {
		const error = new Error('Nhà trường chưa mở chức năng xem/in thẻ dự kiểm tra.') as Error & { status?: number };
		error.status = 403;
		throw error;
	}

	if (!canParentViewExamCard(campaign)) {
		const startAt = normalizeText(campaign?.examCardPrintStartAt);
		const endAt = normalizeText(campaign?.examCardPrintEndAt);
		const now = Date.now();
		const startTimestamp = startAt ? new Date(startAt).getTime() : null;
		const endTimestamp = endAt ? new Date(endAt).getTime() : null;

		const error = new Error(
			Number.isFinite(startTimestamp) && now < Number(startTimestamp)
				? 'Nhà trường chưa đến thời gian phát hành thẻ dự kiểm tra. Quý phụ huynh vui lòng quay lại sau.'
				: 'Thời gian xem/in thẻ dự kiểm tra đã kết thúc. Quý phụ huynh vui lòng liên hệ nhà trường để được hỗ trợ.',
		) as Error & { status?: number };
		error.status = 403;
		throw error;
	}

	if (!candidateExam?.id) {
		const error = new Error('Không tìm thấy thông tin thẻ dự kiểm tra phù hợp với mã học sinh và mã hồ sơ đã nhập.') as Error & { status?: number };
		error.status = 404;
		throw error;
	}

	if (!hasCandidateExamScheduleInfo(candidateExam)) {
		const error = new Error('Thông tin thẻ dự kiểm tra đang được nhà trường cập nhật.') as Error & { status?: number };
		error.status = 409;
		throw error;
	}
}

async function findParentUserById(userId: number) {
	if (!userId) return null;

	return strapi.db.query(USER_UID).findOne({
		where: { id: userId },
		select: ['id', 'username', 'email', 'fullName', 'phone', 'blocked'],
	});
}

async function findParentUserByEmail(email: string) {
	const normalizedEmail = normalizeEmail(email);
	if (!normalizedEmail) return null;

	return strapi.db.query(USER_UID).findOne({
		where: {
			email: {
				$eqi: normalizedEmail,
			},
		},
		select: ['id', 'username', 'email', 'fullName', 'phone', 'blocked'],
	});
}

async function ensureParentUserAccess(options: {
	tenantId: number;
	fullName: string;
	email: string;
	phone: string;
}) {
	const normalizedEmail = normalizeEmail(options.email);
	const normalizedPhone = normalizePhone(options.phone);
	const normalizedFullName = normalizeText(options.fullName);
	if (!normalizedEmail) {
		const error = new Error('email is required') as Error & { status?: number };
		error.status = 400;
		throw error;
	}

	let user = await findParentUserByEmail(normalizedEmail);
	if (!user?.id) {
		const usersPermissionsUserService = strapi.plugin('users-permissions').service('user');
		const password = crypto.randomBytes(24).toString('base64url');
		user = await usersPermissionsUserService.add({
			email: normalizedEmail,
			username: normalizedEmail,
			provider: 'local',
			fullName: normalizedFullName || undefined,
			phone: normalizedPhone || undefined,
			confirmed: true,
			blocked: false,
			password,
		});
	}

	await ensureUserHasAuthenticatedRole(strapi, Number(user.id));
	const userTenant = await createUserTenant(Number(user.id), Number(options.tenantId), 'active');
	const membership = await strapi.db.query(USER_TENANT_UID).findOne({
		where: { id: Number(userTenant.id) },
		select: ['id', 'userTenantStatus'],
	});
	if (membership?.id && membership.userTenantStatus !== 'active') {
		await strapi.db.query(USER_TENANT_UID).update({
			where: { id: Number(membership.id) },
			data: {
				userTenantStatus: 'active',
				joinedAt: new Date(),
				leftAt: null,
			},
		});
	}
	await updateUserPhoneIfEmpty(Number(user.id), normalizedPhone);

	if (!normalizeText(user.fullName) && normalizedFullName) {
		await strapi.entityService.update(USER_UID, Number(user.id), {
			data: {
				fullName: normalizedFullName,
			},
		});
		user = await findParentUserById(Number(user.id));
	}

	return {
		id: Number(user.id),
		email: normalizedEmail,
		fullName: normalizeText(user.fullName) || normalizedFullName,
		phone: normalizeText(user.phone) || normalizedPhone,
	};
}

async function findApplicationForSession(applicationId: number, tenantId: number | string) {
	if (!applicationId) return null;

	return strapi.db.query(ADMISSION_APPLICATION_UID).findOne({
		where: mergeTenantWhere({
			$and: [
				{
					id: {
						$eq: applicationId,
					},
				},
				buildActiveAdmissionWhere(),
			],
		}, tenantId),
		select: ['id', 'applicationCode', 'studentCode', 'studentName', 'dob', 'gender', 'currentSchool', 'address', 'formData', 'formTemplateVersion', 'admissionStatus', 'reviewStatus', 'createdAt', 'submittedAt', 'reviewedAt', 'reviewNote', 'parentLastOpenedAt', 'schoolLastOpenedAt', 'parentUnreadMessageCount', 'schoolUnreadMessageCount', 'lastMessageAt', 'lastActivityAt', 'approvalNotifiedAt', 'approvalNotificationCount', 'approvedAcknowledgedAt', 'approvedAcknowledgedNote'],
		populate: {
			parent: {
				select: ['id', 'username', 'email', 'fullName', 'phone'],
			},
			approvedAcknowledgedBy: {
				select: ['id', 'username', 'email', 'fullName'],
			},
			reviewedBy: {
				select: ['id', 'username', 'email', 'fullName'],
			},
			campaign: {
				select: ['id', 'name', 'code', 'description', 'campaignStatus', 'startDate', 'endDate', 'formTemplateVersion'],
				populate: {
					formTemplate: {
						select: ['id', 'name', 'version', 'schema', 'formTemplateStatus', 'isLocked'],
					},
				},
			},
		},
	});
}

function normalizeCampaign(row: any) {
	if (!row) return null;
	return {
		id: row.id,
		name: normalizeText(row.name),
		code: normalizeText(row.code),
		description: normalizeText(row.description),
		campaignStatus: readCampaignStatus(row),
		status: readCampaignStatus(row),
		startDate: row.startDate || null,
		endDate: row.endDate || null,
		applicationStatusGuide: row.applicationStatusGuide ?? null,
		formTemplateVersion: Number(row.formTemplateVersion || row?.formTemplate?.version || 0),
		formTemplate: row.formTemplate
			? {
				id: row.formTemplate.id,
				name: normalizeText(row.formTemplate.name),
				version: Number(row.formTemplate.version || 0),
				formTemplateStatus: readFormTemplateStatus(row.formTemplate),
				status: readFormTemplateStatus(row.formTemplate),
				isLocked: row.formTemplate.isLocked === true,
				schema: row.formTemplate.schema ?? null,
			}
			: null,
	};
}

function normalizeLearner(row: any) {
	if (!row) return null;
	return {
		id: row.id,
		studentCode: normalizeText(row.code),
		fullName: normalizeText(row.fullName),
		dateOfBirth: row.dateOfBirth || null,
		parentName: normalizeText(row.parentName),
		parentPhone: normalizeText(row.parentPhone),
		parent: row.user
			? {
				id: row.user.id,
				fullName: normalizeText(row.user.fullName),
				email: normalizeText(row.user.email).toLowerCase(),
				phone: normalizeText(row.user.phone),
			}
			: null,
	};
}

function normalizeLearnerFromApplication(row: any) {
	if (!row) return null;
	return {
		id: row.id,
		code: normalizeStudentCode(row.studentCode),
		studentCode: normalizeStudentCode(row.studentCode),
		fullName: normalizeText(row.studentName),
		dateOfBirth: row.dob || null,
		parentName: normalizeText(row.parent?.fullName),
		parentPhone: normalizeText(row.parent?.phone),
		parent: row.parent
			? {
				id: row.parent.id,
				fullName: normalizeText(row.parent.fullName),
				email: normalizeText(row.parent.email).toLowerCase(),
				phone: normalizeText(row.parent.phone),
			}
			: null,
		user: row.parent || null,
	};
}

function normalizeLearnerFromDraftSession(options: { studentCode: string; parent: any }) {
	return {
		id: 0,
		code: normalizeStudentCode(options.studentCode),
		studentCode: normalizeStudentCode(options.studentCode),
		fullName: '',
		dateOfBirth: null,
		parentName: normalizeText(options.parent?.fullName),
		parentPhone: normalizeText(options.parent?.phone),
		parent: options.parent
			? {
				id: options.parent.id,
				fullName: normalizeText(options.parent.fullName),
				email: normalizeEmail(options.parent.email),
				phone: normalizePhone(options.parent.phone),
			}
			: null,
		user: options.parent || null,
	};
}

function extractTemplateFileFieldKeys(schema: any): string[] {
	const keys = new Set<string>();
	const sections = Array.isArray(schema?.sections)
		? schema.sections
		: (Array.isArray(schema?.fields) ? [{ fields: schema.fields }] : []);

	for (const section of sections) {
		const fields = Array.isArray(section?.fields) ? section.fields : [];
		for (const field of fields) {
			const fieldType = normalizeText(field?.type).toLowerCase();
			const fieldKey = normalizeText(field?.key);
			if ((fieldType === 'file' || fieldType === 'image') && fieldKey) {
				keys.add(fieldKey);
			}
		}
	}

	return Array.from(keys);
}

function getChangedMainFormFileFieldKeys(schema: any, previousFormData: any, nextFormData: any): string[] {
	const fileFieldKeys = extractTemplateFileFieldKeys(schema);
	if (fileFieldKeys.length === 0) return [];

	const previous = previousFormData && typeof previousFormData === 'object' && !Array.isArray(previousFormData)
		? previousFormData as Record<string, unknown>
		: {};
	const next = nextFormData && typeof nextFormData === 'object' && !Array.isArray(nextFormData)
		? nextFormData as Record<string, unknown>
		: {};

	return fileFieldKeys.filter((key) => JSON.stringify(previous[key] ?? null) !== JSON.stringify(next[key] ?? null));
}

function getCreateBlockedMessage(campaign: any): string {
	return canCreateApplication(campaign)
		? ''
		: 'Cổng tiếp nhận hồ sơ đã đóng hoặc chưa mở.';
}

function getDraftEditBlockedMessage(campaign: any): string {
	return readPermissionCampaignStatus(campaign) === 'closed'
		? 'Cổng tiếp nhận hồ sơ đã đóng. Hồ sơ nháp không còn có thể nộp mới.'
		: 'Cổng tiếp nhận hồ sơ đã đóng hoặc chưa mở.';
}

function getNeedUpdateEvidenceMessage(): string {
	return 'Minh chứng bổ sung hoặc thay thế vui lòng gửi trong mục Trao đổi với Nhà trường.';
}

function normalizeApplication(row: any) {
	if (!row) return null;

	const admissionStatus = readAdmissionStatus(row);
	const reviewStatus = normalizeText(row.reviewStatus).toLowerCase() || null;
	const permissions = buildPublicAdmissionV1Permissions(row?.campaign, row);
	return {
		id: row.id,
		applicationCode: normalizeText(row.applicationCode),
		studentCode: normalizeStudentCode(row.studentCode),
		studentName: normalizeText(row.studentName),
		dob: row.dob || null,
		gender: row.gender || null,
		currentSchool: normalizeText(row.currentSchool),
		address: normalizeText(row.address),
		formData: row.formData ?? null,
		reviewSnapshot: row.reviewSnapshot ?? null,
		formTemplateVersion: Number(row.formTemplateVersion || 0),
		admissionStatus,
		status: admissionStatus,
		reviewStatus,
		conversationStatus: permissions.isNeedUpdate ? 'need_update' : 'normal',
		isEditable: permissions.canEdit,
		createdAt: row.createdAt || null,
		submittedAt: row.submittedAt || null,
		reviewedAt: row.reviewedAt || null,
		reviewNote: normalizeText(row.reviewNote) || null,
		isDeleted: row.isDeleted === true,
		parentLastOpenedAt: row.parentLastOpenedAt || null,
		schoolLastOpenedAt: row.schoolLastOpenedAt || null,
		parentUnreadMessageCount: Math.max(0, Number(row.parentUnreadMessageCount || 0)),
		schoolUnreadMessageCount: Math.max(0, Number(row.schoolUnreadMessageCount || 0)),
		lastMessageAt: row.lastMessageAt || null,
		lastActivityAt: row.lastActivityAt || null,
		approvalNotifiedAt: row.approvalNotifiedAt || null,
		approvalNotificationCount: Math.max(0, Number(row.approvalNotificationCount || 0)),
		approvedAcknowledgedAt: row.approvedAcknowledgedAt || null,
		approvedAcknowledgedNote: normalizeText(row.approvedAcknowledgedNote) || null,
		approvedAcknowledgedBy: row.approvedAcknowledgedBy
			? {
				id: row.approvedAcknowledgedBy.id,
				fullName: normalizeText(row.approvedAcknowledgedBy.fullName),
				email: normalizeText(row.approvedAcknowledgedBy.email),
			}
			: null,
		reviewedBy: row.reviewedBy
			? {
				id: row.reviewedBy.id,
				fullName: normalizeText(row.reviewedBy.fullName),
				email: normalizeText(row.reviewedBy.email),
			}
			: null,
		campaign: normalizeCampaign(row.campaign),
	};
}

async function findApplicationByStudentCode(studentCode: string, tenantId: number | string) {
	const normalizedStudentCode = normalizeStudentCode(studentCode);
	if (!normalizedStudentCode) return null;

	return strapi.db.query(ADMISSION_APPLICATION_UID).findOne({
		where: mergeTenantWhere({
			$and: [
				{
					studentCode: {
						$eq: normalizedStudentCode,
					},
				},
				buildActiveAdmissionWhere(),
			],
		}, tenantId),
		select: ['id', 'studentCode'],
		orderBy: [{ updatedAt: 'desc' }, { createdAt: 'desc' }, { id: 'desc' }],
	});
}

const APPLICATION_CODE_DIGITS = 4;

function normalizeApplicationCodePrefix(value: unknown): string {
	const normalized = normalizeText(value).toUpperCase().replace(/[^A-Z0-9]/g, '');
	return normalized;
}

async function resolveApplicationCodePrefix(options: {
	tenantId: number | string;
	campaignTenantCode?: string | null;
	explicitTenantCode?: string | null;
}): Promise<string> {
	const campaignTenantCode = normalizeApplicationCodePrefix(options.campaignTenantCode);
	if (campaignTenantCode) return campaignTenantCode;

	const directCode = normalizeApplicationCodePrefix(options.explicitTenantCode);
	if (directCode) return directCode;

	const tenantWhere = whereByParam(options.tenantId);
	if (!tenantWhere) return 'APP';

	const tenant = await strapi.db.query(TENANT_UID).findOne({
		where: tenantWhere,
		select: ['id', 'code'],
	});

	return normalizeApplicationCodePrefix(tenant?.code) || 'APP';
}

function buildRandomApplicationCodeCandidate(prefix: string) {
	const randomNumber = Math.floor(Math.random() * (10 ** APPLICATION_CODE_DIGITS));
	return `${prefix}${String(randomNumber).padStart(APPLICATION_CODE_DIGITS, '0')}`;
}


async function generateApplicationCode(
	tenantId: number | string,
	explicitTenantCode?: string | null,
	campaignTenantCode?: string | null,
) {
	const prefix = await resolveApplicationCodePrefix({ tenantId, explicitTenantCode, campaignTenantCode });
	for (let attempt = 0; attempt < 128; attempt += 1) {
		const candidate = buildRandomApplicationCodeCandidate(prefix);
		const exists = await strapi.db.query(ADMISSION_APPLICATION_UID).findOne({
			where: { applicationCode: candidate },
			select: ['id'],
		});
		if (!exists?.id) return candidate;
	}

	throw new Error('Unable to allocate a unique admission application code');
}

async function createDraftApplication(options: {
	tenantId: number | string;
	tenantCode?: string | null;
	campaignTenantCode?: string | null;
	campaignId: number;
	parentUserId: number;
	studentCode: string;
	formTemplateVersion?: number;
}) {
	const created = await strapi.entityService.create(ADMISSION_APPLICATION_UID, {
		data: {
			tenant: options.tenantId,
			campaign: options.campaignId,
			parent: options.parentUserId,
			applicationCode: await generateApplicationCode(options.tenantId, options.tenantCode, options.campaignTenantCode),
			studentCode: options.studentCode,
			studentName: null,
			dob: null,
			gender: null,
			currentSchool: null,
			address: null,
			formData: {
				studentCode: options.studentCode,
			},
			formTemplateVersion: Number(options.formTemplateVersion || 0),
			admissionStatus: 'draft',
			reviewStatus: null,
			reviewedBy: null,
			submittedAt: null,
			reviewedAt: null,
			reviewNote: null,
		} as any,
		populate: {
			parent: true,
			reviewedBy: true,
			campaign: {
				populate: {
					formTemplate: true,
				},
			},
		},
	});

	return created;
}

function buildApplicationAccessToken(options: {
	tenantId: number | string;
	tenantCode: string;
	campaign: any;
	application: any;
	parentUser: any;
}) {
	const now = Math.floor(Date.now() / 1000);
	return signAccessPayload({
		tenantId: String(options.tenantId),
		tenantCode: normalizeText(options.tenantCode),
		campaignId: Number(options.campaign.id),
		campaignCode: normalizeText(options.campaign.code),
		applicationId: Number(options.application.id),
		studentCode: normalizeText(options.application.studentCode),
		parentUserId: Number(options.parentUser.id),
		email: normalizeEmail(options.parentUser.email),
		parentFullName: normalizeText(options.parentUser.fullName),
		parentPhone: normalizePhone(options.parentUser.phone),
		iat: now,
		exp: now + TOKEN_TTL_MINUTES * 60,
	});
}

async function resolveSession(ctx: any) {
	const tenantId = resolveCurrentTenantId(ctx);
	const payload = extractPayload(ctx);
	const token = normalizeText(ctx.query?.token || ctx.request?.headers?.['x-admission-v1-token'] || payload.token);
	const tokenPayload = verifyAccessToken(token);

	if (normalizeText(tokenPayload.tenantId) !== normalizeText(tenantId)) {
		const error = new Error('token does not belong to current tenant') as Error & { status?: number };
		error.status = 403;
		throw error;
	}

	const campaign = await findCampaignByCode(tokenPayload.campaignCode, tenantId, false);
	if (!campaign?.id || Number(campaign.id) !== Number(tokenPayload.campaignId)) {
		const error = new Error('Admission campaign not found') as Error & { status?: number };
		error.status = 404;
		throw error;
	}

	const parentUser = await findParentUserById(Number(tokenPayload.parentUserId));
	const parentUserId = Number(parentUser?.id || 0);
	if (!parentUserId || parentUserId !== Number(tokenPayload.parentUserId)) {
		const error = new Error('Parent account is invalid') as Error & { status?: number };
		error.status = 403;
		throw error;
	}

	const parentEmail = normalizeEmail(parentUser?.email);
	if (!parentEmail || parentEmail !== normalizeText(tokenPayload.email).toLowerCase()) {
		const error = new Error('Parent email does not match verification token') as Error & { status?: number };
		error.status = 403;
		throw error;
	}

	const application = Number(tokenPayload.applicationId) > 0
		? await findApplicationForSession(Number(tokenPayload.applicationId), tenantId)
		: null;

	if (Number(tokenPayload.applicationId) > 0) {
		if (!application?.id) {
			const error = new Error('Admission application not found') as Error & { status?: number };
			error.status = 404;
			throw error;
		}
		if (Number(application?.campaign?.id || 0) !== Number(campaign.id)) {
			const error = new Error('Admission application does not belong to current campaign') as Error & { status?: number };
			error.status = 403;
			throw error;
		}
		if (normalizeStudentCode(application?.studentCode) !== normalizeStudentCode(tokenPayload.studentCode)) {
			const error = new Error('Admission application does not match verification token') as Error & { status?: number };
			error.status = 403;
			throw error;
		}
	}

	const learner = application?.id
		? normalizeLearnerFromApplication(application)
		: normalizeLearnerFromDraftSession({
			studentCode: tokenPayload.studentCode,
			parent: {
				id: parentUserId,
				fullName: normalizeText(tokenPayload.parentFullName || parentUser?.fullName),
				email: parentEmail,
				phone: normalizePhone(tokenPayload.parentPhone || parentUser?.phone),
			},
		});

	return {
		tenantId,
		token,
		campaign,
		learner,
		application,
	};
}

async function buildSessionPayload(context: { campaign: any; learner: any; application: any; token: string; tenantId?: number | string }) {
	const permissions = buildPublicAdmissionV1Permissions(context.campaign, context.application);
	let resultLookupPayload: ReturnType<typeof buildResultLookupPayload> | null = null;
	const normalizedApplication = normalizeApplication(context.application);

	if (
		context.application?.id
		&& context.campaign?.id
		&& normalizeStudentCode(context.application?.studentCode)
		&& normalizeText(context.application?.applicationCode)
	) {
		const candidateExam = await findCandidateExamForPublicExamCard({
			studentCode: normalizeText(context.application.studentCode),
			applicationCode: normalizeText(context.application.applicationCode),
			campaignId: Number(context.campaign.id),
			tenantId: Number(context.tenantId || 0),
		});

		resultLookupPayload = buildResultLookupPayload(context.campaign, {
			...context.application,
			candidateExam,
		});
	}

	return {
		token: context.token,
		campaign: normalizeCampaign(context.campaign),
		learner: normalizeLearner(context.learner),
		application: resultLookupPayload?.application
			? {
				...normalizedApplication,
				...resultLookupPayload.application,
			}
			: normalizedApplication,
		examCard: resultLookupPayload?.examCard || null,
		statusGuide: resultLookupPayload?.statusGuide || null,
		permissions,
	};
}

function flattenUploadedFiles(value: unknown): any[] {
	if (!value) return [];
	if (Array.isArray(value)) return value.flatMap((entry) => flattenUploadedFiles(entry));
	if (
		typeof value === 'object'
		&& value
		&& (
			(value as Record<string, unknown>).filepath
			|| (value as Record<string, unknown>).path
			|| (value as Record<string, unknown>).tempFilePath
		)
	) {
		return [value];
	}
	if (typeof value === 'object') {
		return Object.values(value as Record<string, unknown>).flatMap((entry) => flattenUploadedFiles(entry));
	}
	return [];
}

function extractUploadedFiles(ctx: any) {
	return flattenUploadedFiles(ctx.request?.files);
}

function resolveRequestIp(ctx: any) {
	return normalizeText(ctx.request?.ip || ctx.ip || ctx.request?.headers?.['x-forwarded-for'] || '') || null;
}

function resolveRequestUserAgent(ctx: any) {
	return normalizeText(ctx.request?.headers?.['user-agent'] || '') || null;
}

function normalizeMessageAttachments(value: unknown) {
	if (!Array.isArray(value)) return [];

	return value
		.filter((entry) => entry && typeof entry === 'object' && !Array.isArray(entry))
		.map((entry: any) => ({
			name: normalizeText(entry.name) || 'Tệp đính kèm',
			url: normalizeText(entry.url),
			mime: normalizeText(entry.mime) || null,
			size: Number.isFinite(Number(entry.size)) ? Number(entry.size) : null,
			fileAssetId: Number.isFinite(Number(entry.fileAssetId)) && Number(entry.fileAssetId) > 0 ? Number(entry.fileAssetId) : null,
			storageProvider: normalizeText(entry.storageProvider) || null,
		}));
}

function normalizePublicMessage(row: any) {
	return {
		id: row?.id,
		senderType: normalizeText(row?.senderType).toUpperCase() || 'UNKNOWN',
		senderUser: row?.senderUser
			? {
				id: row.senderUser.id,
				username: normalizeText(row.senderUser.username),
				email: normalizeEmail(row.senderUser.email),
				fullName: normalizeText(row.senderUser.fullName),
			}
			: null,
		messageType: normalizeText(row?.messageType).toUpperCase() || 'MESSAGE',
		content: row?.content || '',
		attachments: normalizeMessageAttachments(row?.attachments),
		createdAt: row?.createdAt || null,
		visibility: normalizeText(row?.visibility).toUpperCase() || 'PUBLIC',
	};
}

async function updateConversationState(applicationId: number, data: Record<string, unknown>) {
	await strapi.entityService.update(ADMISSION_APPLICATION_UID, applicationId, {
		data: data as any,
	});
}

async function createParentActivity(
	applicationId: number,
	tenantId: number | string,
	payload: {
		actorUserId?: number | null;
		actionType: 'VIEW_PARENT_TRACKING' | 'MESSAGE_SENT' | 'FILE_ATTACHED' | 'APPROVAL_ACKNOWLEDGED';
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
			actorType: 'PARENT',
			actionType: payload.actionType,
			ipAddress: payload.ipAddress || null,
			userAgent: payload.userAgent || null,
			metadata: payload.metadata || null,
		} as any,
	});

	await updateConversationState(applicationId, {
		lastActivityAt: timestamp,
	});
}

async function createSystemActivity(
	applicationId: number,
	tenantId: number | string,
	payload: {
		actionType: 'EMAIL_SENT';
		metadata?: Record<string, unknown> | null;
	},
) {
	const timestamp = new Date().toISOString();
	await strapi.entityService.create(ADMISSION_APPLICATION_ACTIVITY_UID, {
		data: {
			tenant: tenantId,
			application: applicationId,
			actorUser: null,
			actorType: 'SYSTEM',
			actionType: payload.actionType,
			metadata: payload.metadata || null,
		} as any,
	});

	await updateConversationState(applicationId, {
		lastActivityAt: timestamp,
	});
}

async function createParentMessage(
	application: any,
	tenantId: number | string,
	payload: {
		senderUserId: number;
		content?: string | null;
		attachments?: unknown[];
	},
) {
	const content = normalizeText(payload.content) || null;
	const attachments = normalizeMessageAttachments(payload.attachments);
	if (!content && attachments.length === 0) {
		const error = new Error('Vui lòng nhập nội dung hoặc đính kèm tệp') as Error & { status?: number };
		error.status = 400;
		throw error;
	}

	const timestamp = new Date().toISOString();
	const message = await strapi.entityService.create(ADMISSION_APPLICATION_MESSAGE_UID, {
		data: {
			tenant: tenantId,
			application: application.id,
			senderType: 'PARENT',
			senderUser: payload.senderUserId,
			messageType: attachments.length > 0 ? 'SUPPLEMENT_FILE' : 'MESSAGE',
			content,
			attachments,
			visibility: 'PUBLIC',
			readByParentAt: timestamp,
		} as any,
		populate: {
			senderUser: true,
		},
	});

	await updateConversationState(application.id, {
		lastMessageAt: timestamp,
		schoolUnreadMessageCount: Math.max(0, Number(application?.schoolUnreadMessageCount || 0)) + 1,
		parentLastOpenedAt: timestamp,
	});

	return normalizePublicMessage(message);
}

async function markParentMessagesRead(application: any, tenantId: number | string) {
	const unreadRows = await strapi.db.query(ADMISSION_APPLICATION_MESSAGE_UID).findMany({
		where: mergeTenantWhere({
			application: {
				id: application.id,
			},
			visibility: 'PUBLIC',
			readByParentAt: {
				$null: true,
			},
			senderType: {
				$in: ['SCHOOL', 'SYSTEM'],
			},
		}, tenantId),
		select: ['id'],
	});

	const timestamp = new Date().toISOString();
	await Promise.all((unreadRows || []).map((row: any) => strapi.entityService.update(ADMISSION_APPLICATION_MESSAGE_UID, row.id, {
		data: {
			readByParentAt: timestamp,
		} as any,
	})));

	await updateConversationState(application.id, {
		parentUnreadMessageCount: 0,
		parentLastOpenedAt: timestamp,
	});
}

async function listPublicMessages(application: any, tenantId: number | string) {
	const rows = await strapi.db.query(ADMISSION_APPLICATION_MESSAGE_UID).findMany({
		where: mergeTenantWhere({
			application: {
				id: application.id,
			},
			visibility: 'PUBLIC',
		}, tenantId),
		orderBy: [{ createdAt: 'asc' }],
		populate: {
			senderUser: true,
		},
	});

	return (rows || []).map((row: any) => normalizePublicMessage(row));
}

function canParentAttachConversationFiles(application: any) {
	return canSendConversationAttachment(application?.campaign, application);
}

export default {
	async lookupByStudentCode(ctx: any) {
		try {
			const tenantId = resolveCurrentTenantId(ctx);
			const studentCode = normalizeStudentCode(ctx.query?.studentCode);
			if (!studentCode) {
				return ctx.badRequest('studentCode is required');
			}

			const application = await findApplicationByStudentCode(studentCode, tenantId);
			ctx.body = {
				exists: Boolean(application?.id),
			};
		} catch (error: any) {
			if (error?.status === 400) return ctx.badRequest(error.message);
			if (error?.status === 401) return ctx.unauthorized(error.message);
			if (error?.status === 403) return ctx.forbidden(error.message);
			strapi.log.error('[admission-public-v1.lookupByStudentCode] unexpected error', error);
			return ctx.internalServerError('Failed to lookup admission application');
		}
	},

	async acknowledgeApproval(ctx: any) {
		try {
			const context = await resolveSession(ctx);
			const applicationId = Number(ctx.params?.id || 0);
			if (!context.application?.id || applicationId !== Number(context.application.id)) {
				return ctx.notFound('Admission application not found');
			}

			const body = extractPayload(ctx);
			const parentUserId = Number(context.learner?.user?.id || context.application?.parent?.id || 0);
			const updated = await acknowledgeAdmissionApproval(
				context.application.id,
				parentUserId,
				context.tenantId,
				{ note: body.note },
			);

			await createParentActivity(context.application.id, context.tenantId, {
				actorUserId: parentUserId,
				actionType: 'APPROVAL_ACKNOWLEDGED',
				ipAddress: resolveRequestIp(ctx),
				userAgent: resolveRequestUserAgent(ctx),
				metadata: {
					acknowledgedAt: updated?.approvedAcknowledgedAt || null,
				},
			});

			ctx.body = {
				success: true,
				data: {
					acknowledgedAt: updated?.approvedAcknowledgedAt || null,
					application: normalizeApplication(updated),
				},
			};
		} catch (error: any) {
			if (error?.status === 400) return ctx.badRequest(error.message);
			if (error?.status === 401) return ctx.unauthorized(error.message);
			if (error?.status === 403) return ctx.forbidden(error.message);
			if (error?.status === 404) return ctx.notFound(error.message);
			if (error?.status === 409) return ctx.conflict(error.message);
			strapi.log.error('[admission-public-v1.acknowledgeApproval] unexpected error', error);
			return ctx.internalServerError('Failed to acknowledge admission approval');
		}
	},

	async lookup(ctx: any) {
		try {
			const tenantId = resolveCurrentTenantId(ctx);
			const body = extractPayload(ctx);
			const campaignCode = toRequiredText(body.campaignCode, 'campaignCode');
			const studentCode = toRequiredText(normalizeStudentCode(body.studentCode), 'studentCode');

			const campaign = await findCampaignByCode(campaignCode, tenantId, false);
			if (!campaign?.id) {
				return ctx.notFound('Admission campaign not found');
			}

			const application = await findApplicationAccessByStudentCode(studentCode, Number(campaign.id), tenantId);

			ctx.body = {
				success: true,
				data: {
					exists: Boolean(application?.id),
					nextStep: application?.id ? 'application-code' : 'parent-info',
					campaign: normalizeCampaign(campaign),
					learner: {
						studentCode,
						fullName: normalizeText(application?.studentName),
					},
					maskedEmail: application?.parent?.email ? maskEmail(application.parent.email) : '',
					canResendCode: Boolean(application?.parent?.email),
				},
			};
		} catch (error: any) {
			if (error?.status === 400) return ctx.badRequest(error.message);
			if (error?.status === 401) return ctx.unauthorized(error.message);
			if (error?.status === 403) return ctx.forbidden(error.message);
			if (error?.status === 404) return ctx.notFound(error.message);
			strapi.log.error('[admission-public-v1.lookup] unexpected error', error);
			return ctx.internalServerError('Failed to process admission lookup');
		}
	},

	async resultLookup(ctx: any) {
		try {
			const tenantId = resolveCurrentTenantId(ctx);
			const body = extractPayload(ctx);
			const campaignCode = toRequiredText(body.campaignCode, 'campaignCode');
			const studentCode = toRequiredText(normalizeStudentCode(body.studentCode), 'studentCode');
			const applicationCode = toRequiredText(body.applicationCode, 'applicationCode');

			const campaign = await findCampaignByCode(campaignCode, tenantId, false);
			if (!campaign?.id) {
				return ctx.badRequest(RESULT_LOOKUP_NOT_FOUND_MESSAGE);
			}

			const application = await findApplicationForPublicLookup({
				studentCode,
				applicationCode,
				campaignId: Number(campaign.id),
				tenantId,
			});

			if (!application?.id) {
				return ctx.badRequest(RESULT_LOOKUP_NOT_FOUND_MESSAGE);
			}

			const candidateExam = await findCandidateExamForPublicExamCard({
				studentCode,
				applicationCode,
				campaignId: Number(campaign.id),
				tenantId,
			});

			await createParentActivity(Number(application.id), tenantId, {
				actorUserId: Number(application?.parent?.id || 0) || null,
				actionType: 'VIEW_PARENT_TRACKING',
				ipAddress: resolveRequestIp(ctx),
				userAgent: resolveRequestUserAgent(ctx),
				metadata: {
					source: 'RESULT_LOOKUP',
				},
			});

			ctx.body = {
				success: true,
				data: buildResultLookupPayload(campaign, {
					...application,
					candidateExam,
				}),
			};
		} catch (error: any) {
			if (error?.status === 400) return ctx.badRequest(error.message);
			if (error?.status === 401) return ctx.unauthorized(error.message);
			if (error?.status === 403) return ctx.forbidden(error.message);
			if (error?.status === 404) return ctx.notFound(error.message);
			strapi.log.error('[admission-public-v1.resultLookup] unexpected error', error);
			return ctx.internalServerError('Failed to lookup admission result');
		}
	},

	async examCard(ctx: any) {
		try {
			const tenantId = resolveCurrentTenantId(ctx);
			const campaignCode = toRequiredText(ctx.params?.campaignCode, 'campaignCode');
			const studentCode = toRequiredText(normalizeStudentCode(ctx.query?.studentCode), 'studentCode');
			const applicationCode = toRequiredText(ctx.query?.applicationCode, 'applicationCode');

			const campaign = await findCampaignByCode(campaignCode, tenantId, false);
			if (!campaign?.id) {
				return ctx.notFound('Không tìm thấy kỳ tuyển sinh');
			}

			const application = await findApplicationForPublicLookup({
				studentCode,
				applicationCode,
				campaignId: Number(campaign.id),
				tenantId,
			});
			if (!application?.id) {
				return ctx.badRequest(RESULT_LOOKUP_NOT_FOUND_MESSAGE);
			}

			const candidateExam = await findCandidateExamForPublicExamCard({
				studentCode,
				applicationCode,
				campaignId: Number(campaign.id),
				tenantId,
			});

			ensurePublicExamCardAccessible(campaign, application, candidateExam);

			const result = await renderCandidateExamExamCard(candidateExam.id, tenantId, {
				actorType: 'parent',
				ip: resolveRequestIp(ctx),
				userAgent: resolveRequestUserAgent(ctx),
				assetBaseUrl: toText(ctx.request?.origin || ''),
				refererUrl: toText(ctx.request?.headers?.referer || ''),
			});

			ctx.body = {
				success: true,
				data: {
					...result,
					candidateNumber: normalizeText(candidateExam?.candidateNumber),
					applicationCode: normalizeText(candidateExam?.applicationCode || application?.applicationCode),
				},
			};
		} catch (error: any) {
			if (error?.status === 400) return ctx.badRequest(error.message);
			if (error?.status === 401) return ctx.unauthorized(error.message);
			if (error?.status === 403) return ctx.forbidden(error.message);
			if (error?.status === 404) return ctx.notFound(error.message);
			if (error?.status === 409) return ctx.conflict(error.message);
			strapi.log.error('[admission-public-v1.examCard] unexpected error', error);
			return ctx.internalServerError('Failed to render exam card');
		}
	},

	async examCardPrintLog(ctx: any) {
		try {
			const tenantId = resolveCurrentTenantId(ctx);
			const campaignCode = toRequiredText(ctx.params?.campaignCode, 'campaignCode');
			const body = extractPayload(ctx);
			const studentCode = toRequiredText(normalizeStudentCode(body.studentCode), 'studentCode');
			const applicationCode = toRequiredText(body.applicationCode, 'applicationCode');

			const campaign = await findCampaignByCode(campaignCode, tenantId, false);
			if (!campaign?.id) {
				return ctx.notFound('Không tìm thấy kỳ tuyển sinh');
			}

			const application = await findApplicationForPublicLookup({
				studentCode,
				applicationCode,
				campaignId: Number(campaign.id),
				tenantId,
			});
			if (!application?.id) {
				return ctx.badRequest(RESULT_LOOKUP_NOT_FOUND_MESSAGE);
			}

			const candidateExam = await findCandidateExamForPublicExamCard({
				studentCode,
				applicationCode,
				campaignId: Number(campaign.id),
				tenantId,
			});

			ensurePublicExamCardAccessible(campaign, application, candidateExam);

			await logCandidateExamCardAction(candidateExam.id, tenantId, 'card_print', {
				actorType: 'parent',
				ip: resolveRequestIp(ctx),
				userAgent: resolveRequestUserAgent(ctx),
			});

			ctx.body = {
				success: true,
				data: {
					logged: true,
				},
			};
		} catch (error: any) {
			if (error?.status === 400) return ctx.badRequest(error.message);
			if (error?.status === 401) return ctx.unauthorized(error.message);
			if (error?.status === 403) return ctx.forbidden(error.message);
			if (error?.status === 404) return ctx.notFound(error.message);
			if (error?.status === 409) return ctx.conflict(error.message);
			strapi.log.error('[admission-public-v1.examCardPrintLog] unexpected error', error);
			return ctx.internalServerError('Failed to log exam card print');
		}
	},

	async startRegistration(ctx: any) {
		try {
			const tenantId = resolveCurrentTenantId(ctx);
			const tenantCode = normalizeText(ctx.state?.tenant?.code || ctx.state?.tenantCode || ctx.request?.headers?.['x-tenant-code'] || '');
			const body = extractPayload(ctx);
			const campaignCode = toRequiredText(body.campaignCode, 'campaignCode');
			const studentCode = toRequiredText(normalizeStudentCode(body.studentCode), 'studentCode');
			const fullName = toRequiredText(body.fullName, 'fullName');
			const email = toRequiredText(normalizeEmail(body.email), 'email');
			const phone = toRequiredText(normalizePhone(body.phone), 'phone');
			const campaign = await findCampaignByCode(campaignCode, tenantId, true);
			if (!campaign?.id) {
				return ctx.notFound('Admission campaign not found');
			}

			const application = await findApplicationAccessByStudentCode(studentCode, Number(campaign.id), tenantId);
			if (application?.id) {
				return ctx.conflict('Admission application already exists for this student code');
			}

			const parentUser = await ensureParentUserAccess({
				tenantId: Number(tenantId),
				fullName,
				email,
				phone,
			});

			const created = await createDraftApplication({
				tenantId,
				tenantCode,
				campaignTenantCode: normalizeText(campaign?.tenant?.code),
				campaignId: Number(campaign.id),
				parentUserId: parentUser.id,
				studentCode,
				formTemplateVersion: Number(campaign.formTemplateVersion || campaign?.formTemplate?.version || 0),
			});

			await sendAdmissionV1ApplicationCodeEmail({
				email: parentUser.email,
				parentName: parentUser.fullName,
				studentName: normalizeText(created?.studentName),
				studentCode,
				campaignName: normalizeText(campaign.name) || normalizeText(campaign.code),
				applicationCode: normalizeText(created?.applicationCode),
				mode: 'created',
			});

			ctx.body = {
				success: true,
				data: {
					applicationCreated: true,
					applicationCodeSent: true,
					campaign: normalizeCampaign(campaign),
					learner: {
						studentCode,
						fullName: '',
						parent: {
							fullName: parentUser.fullName,
							email: parentUser.email,
							phone: parentUser.phone,
						},
					},
					maskedEmail: maskEmail(parentUser.email),
				},
			};
		} catch (error: any) {
			if (error?.status === 400) return ctx.badRequest(error.message);
			if (error?.status === 401) return ctx.unauthorized(error.message);
			if (error?.status === 403) return ctx.forbidden(error.message);
			if (error?.status === 404) return ctx.notFound(error.message);
			if (error?.status === 409) return ctx.conflict(error.message);
			strapi.log.error('[admission-public-v1.startRegistration] unexpected error', error);
			return ctx.internalServerError('Failed to start admission registration');
		}
	},

	async resendApplicationCode(ctx: any) {
		try {
			const tenantId = resolveCurrentTenantId(ctx);
			const body = extractPayload(ctx);
			const campaignCode = toRequiredText(body.campaignCode, 'campaignCode');
			const studentCode = toRequiredText(normalizeStudentCode(body.studentCode), 'studentCode');
			const email = toRequiredText(normalizeEmail(body.email), 'email');

			const campaign = await findCampaignByCode(campaignCode, tenantId, false);
			if (campaign?.id) {
				const application = await findApplicationAccessByStudentCode(studentCode, Number(campaign.id), tenantId);
				const parentEmail = normalizeEmail(application?.parent?.email);

				if (application?.id && parentEmail && parentEmail === email) {
					await sendAdmissionV1ApplicationCodeEmail({
						tenantId,
						email: parentEmail,
						parentName: normalizeText(application?.parent?.fullName),
						studentName: normalizeText(application?.studentName),
						studentCode: normalizeText(application?.studentCode),
						campaignName: normalizeText(campaign.name) || normalizeText(campaign.code),
						applicationCode: normalizeText(application?.applicationCode),
						mode: 'resend',
					});

					await createSystemActivity(Number(application.id), tenantId, {
						actionType: 'EMAIL_SENT',
						metadata: {
							source: 'RESEND_APPLICATION_CODE',
							channel: 'EMAIL',
						},
					});
				}
			}

			ctx.body = {
				success: true,
				data: {
					message: RESEND_CODE_SUCCESS_MESSAGE,
				},
			};
		} catch (error: any) {
			if (error?.status === 400) return ctx.badRequest(error.message);
			if (error?.status === 401) return ctx.unauthorized(error.message);
			if (error?.status === 403) return ctx.forbidden(error.message);
			if (error?.status === 404) return ctx.notFound(error.message);
			strapi.log.error('[admission-public-v1.resendApplicationCode] unexpected error', error);
			return ctx.internalServerError('Failed to resend application code');
		}
	},

	async openSession(ctx: any) {
		try {
			const tenantId = resolveCurrentTenantId(ctx);
			const body = extractPayload(ctx);
			const campaignCode = toRequiredText(body.campaignCode, 'campaignCode');
			const studentCode = toRequiredText(normalizeStudentCode(body.studentCode), 'studentCode');
			const applicationCode = toRequiredText(body.applicationCode, 'applicationCode');
			const tenantCode = normalizeText(ctx.state?.tenant?.code || ctx.request?.headers?.['x-tenant-code'] || '');

			const campaign = await findCampaignByCode(campaignCode, tenantId, false);
			if (!campaign?.id) {
				return ctx.notFound('Admission campaign not found');
			}

			const application = await findApplicationAccessByStudentCode(studentCode, Number(campaign.id), tenantId);
			if (!application?.id) {
				return ctx.notFound('Không tìm thấy hồ sơ tuyển sinh');
			}

			if (normalizeText(application.applicationCode).toUpperCase() !== normalizeText(applicationCode).toUpperCase()) {
				return ctx.badRequest('Mã hồ sơ không đúng');
			}

			const parentUser = application?.parent;
			if (!parentUser?.id || !normalizeEmail(parentUser?.email)) {
				return ctx.badRequest('Hồ sơ chưa có tài khoản phụ huynh hợp lệ');
			}

			const token = buildApplicationAccessToken({
				tenantId,
				tenantCode,
				campaign,
				application,
				parentUser,
			});

			ctx.body = {
				success: true,
				data: await buildSessionPayload({
					campaign,
					learner: normalizeLearnerFromApplication(application),
					application,
					token,
					tenantId,
				}),
			};
		} catch (error: any) {
			if (error?.status === 400) return ctx.badRequest(error.message);
			if (error?.status === 401) return ctx.unauthorized(error.message);
			if (error?.status === 403) return ctx.forbidden(error.message);
			if (error?.status === 404) return ctx.notFound(error.message);
			strapi.log.error('[admission-public-v1.openSession] unexpected error', error);
			return ctx.internalServerError('Failed to open admission session');
		}
	},

	async session(ctx: any) {
		try {
			const context = await resolveSession(ctx);
			ctx.body = {
				success: true,
				data: await buildSessionPayload(context),
			};
		} catch (error: any) {
			if (error?.status === 400) return ctx.badRequest(error.message);
			if (error?.status === 401) return ctx.unauthorized(error.message);
			if (error?.status === 403) return ctx.forbidden(error.message);
			if (error?.status === 404) return ctx.notFound(error.message);
			strapi.log.error('[admission-public-v1.session] unexpected error', error);
			return ctx.internalServerError('Failed to load admission session');
		}
	},

	async messages(ctx: any) {
		try {
			const context = await resolveSession(ctx);
			const applicationId = Number(ctx.params?.id || 0);
			if (!context.application?.id || applicationId !== Number(context.application.id)) {
				return ctx.notFound('Admission application not found');
			}

			await markParentMessagesRead(context.application, context.tenantId);
			const messages = await listPublicMessages(context.application, context.tenantId);
			const application = await findApplicationForSession(context.application.id, context.tenantId);

			ctx.body = {
				success: true,
				data: {
					messages,
					application: normalizeApplication(application),
				},
			};
		} catch (error: any) {
			if (error?.status === 400) return ctx.badRequest(error.message);
			if (error?.status === 401) return ctx.unauthorized(error.message);
			if (error?.status === 403) return ctx.forbidden(error.message);
			if (error?.status === 404) return ctx.notFound(error.message);
			strapi.log.error('[admission-public-v1.messages] unexpected error', error);
			return ctx.internalServerError('Failed to load admission conversation');
		}
	},

	async sendMessage(ctx: any) {
		const cleanupTargets: Array<string | { filePath: string; fileAssetId?: number | null }> = [];
		try {
			const context = await resolveSession(ctx);
			const applicationId = Number(ctx.params?.id || 0);
			if (!context.application?.id || applicationId !== Number(context.application.id)) {
				return ctx.notFound('Admission application not found');
			}

			const body = extractPayload(ctx);
			const files = extractUploadedFiles(ctx);
			const attachmentInputs = files.length > 0
				? files
				: (Array.isArray(body.attachments) ? body.attachments : []);
			if (attachmentInputs.length > 0 && !canParentAttachConversationFiles(context.application)) {
				return ctx.badRequest('Phụ huynh chỉ có thể gửi bổ sung minh chứng khi hồ sơ ở trạng thái cần bổ sung');
			}

			const persisted = await persistAdmissionMessageFiles(attachmentInputs as any[], {
				tenantId: context.tenantId,
				tenantCode: normalizeText(context.campaign?.tenant?.code),
				campaignCode: normalizeText(context.campaign?.code),
				applicationKey: normalizeText(context.application?.applicationCode) || String(context.application?.id || ''),
				applicationId: context.application?.id,
				uploadedBy: Number(context.learner?.user?.id || context.application?.parent?.id || 0) || null,
			});
			cleanupTargets.push(...persisted.cleanupTargets);

			const message = await createParentMessage(context.application, context.tenantId, {
				senderUserId: Number(context.learner?.user?.id || context.application?.parent?.id || 0),
				content: normalizeText(body.content) || null,
				attachments: persisted.attachments,
			});

			await createParentActivity(context.application.id, context.tenantId, {
				actorUserId: Number(context.learner?.user?.id || context.application?.parent?.id || 0),
				actionType: 'MESSAGE_SENT',
				ipAddress: resolveRequestIp(ctx),
				userAgent: resolveRequestUserAgent(ctx),
				metadata: {
					messageId: message.id,
					messageType: message.messageType,
				},
			});

			if (Array.isArray(message.attachments) && message.attachments.length > 0) {
				await createParentActivity(context.application.id, context.tenantId, {
					actorUserId: Number(context.learner?.user?.id || context.application?.parent?.id || 0),
					actionType: 'FILE_ATTACHED',
					ipAddress: resolveRequestIp(ctx),
					userAgent: resolveRequestUserAgent(ctx),
					metadata: {
						messageId: message.id,
						attachmentCount: message.attachments.length,
					},
				});
			}

			const application = await findApplicationForSession(context.application.id, context.tenantId);
			ctx.body = {
				success: true,
				data: {
					message,
					application: normalizeApplication(application),
				},
			};
		} catch (error: any) {
			await removePersistedAdmissionMessageFiles(cleanupTargets);
			if (error?.status === 400) return ctx.badRequest(error.message);
			if (error?.status === 401) return ctx.unauthorized(error.message);
			if (error?.status === 403) return ctx.forbidden(error.message);
			if (error?.status === 404) return ctx.notFound(error.message);
			if (error?.status === 409) return ctx.conflict(error.message);
			strapi.log.error('[admission-public-v1.sendMessage] unexpected error', error);
			return ctx.internalServerError('Failed to send admission conversation message');
		}
	},

	async trackView(ctx: any) {
		try {
			const context = await resolveSession(ctx);
			const applicationId = Number(ctx.params?.id || 0);
			if (!context.application?.id || applicationId !== Number(context.application.id)) {
				return ctx.notFound('Admission application not found');
			}

			await createParentActivity(context.application.id, context.tenantId, {
				actorUserId: Number(context.learner?.user?.id || context.application?.parent?.id || 0),
				actionType: 'VIEW_PARENT_TRACKING',
				ipAddress: resolveRequestIp(ctx),
				userAgent: resolveRequestUserAgent(ctx),
				metadata: {
					page: 'admission-v1-form',
				},
			});

			ctx.body = {
				success: true,
			};
		} catch (error: any) {
			if (error?.status === 400) return ctx.badRequest(error.message);
			if (error?.status === 401) return ctx.unauthorized(error.message);
			if (error?.status === 403) return ctx.forbidden(error.message);
			if (error?.status === 404) return ctx.notFound(error.message);
			strapi.log.error('[admission-public-v1.trackView] unexpected error', error);
			return ctx.internalServerError('Failed to track parent admission view');
		}
	},

	async createApplication(ctx: any) {
		try {
			const context = await resolveSession(ctx);
			if (context.application?.id) {
				return ctx.conflict('Admission application already exists for this learner');
			}

			const permissions = buildPublicAdmissionV1Permissions(context.campaign, context.application);
			if (!permissions.canCreate) {
				return ctx.forbidden(getCreateBlockedMessage(context.campaign));
			}

			const body = extractPayload(ctx);
			const submissionMode = toSubmissionMode(body.submissionMode);
			const formData = normalizeFormData(body.formData, normalizeText(context.learner.code));
			const studentCode = extractStudentCode(body, formData, normalizeText(context.learner.code));
			const studentName = toRequiredText(body.studentName || context.learner.fullName, 'studentName');
			const dob = toRequiredDate(body.dob || context.learner.dateOfBirth, 'dob');
			const gender = toNullableGender(body.gender);
			const currentSchool = toNullableText(body.currentSchool);
			const address = toNullableText(body.address);
			const applicationCode = await generateApplicationCode(
				context.tenantId,
				normalizeText(context.campaign?.tenant?.code),
				normalizeText(context.campaign?.tenant?.code),
			);
			const persisted = await persistAdmissionFormDataFiles(formData, {
				tenantId: context.tenantId,
				tenantCode: normalizeText(context.campaign?.tenant?.code),
				campaignCode: normalizeText(context.campaign?.code),
				applicationKey: applicationCode,
				uploadedBy: Number(context.learner?.user?.id || 0) || null,
			});
			const persistedFormData = persisted.formData;

			let created;
			try {
				created = await strapi.entityService.create(ADMISSION_APPLICATION_UID, {
				data: {
					tenant: context.tenantId,
					campaign: context.campaign.id,
					parent: context.learner.user.id,
					applicationCode,
					studentCode,
					studentName,
					dob,
					gender,
					currentSchool,
					address,
					formData: persistedFormData,
					reviewSnapshot: buildAdmissionReviewSnapshot({
						application: {
							studentCode,
							studentName,
							dob,
							gender,
							currentSchool,
							address,
							formData: persistedFormData,
							formTemplateVersion: Number(context.campaign.formTemplateVersion || context.campaign?.formTemplate?.version || 0),
						},
						campaign: context.campaign,
						parent: context.learner.user,
					}),
					formTemplateVersion: Number(context.campaign.formTemplateVersion || context.campaign?.formTemplate?.version || 0),
					admissionStatus: submissionMode,
					reviewStatus: submissionMode === 'submitted' ? 'submitted' : null,
					reviewedBy: null,
					submittedAt: submissionMode === 'submitted' ? new Date().toISOString() : null,
					reviewedAt: null,
					reviewNote: null,
				} as any,
				populate: {
					reviewedBy: true,
					campaign: {
						populate: {
							formTemplate: true,
						},
					},
				},
				});
			} catch (error) {
				await removePersistedAdmissionFiles(persisted.cleanupTargets);
				throw error;
			}

			await syncAdmissionFormFileAssetsEntityId(persisted.fileAssetIds, Number(created?.id || 0));

			ctx.body = {
				success: true,
				data: {
					application: normalizeApplication(created),
				},
			};
		} catch (error: any) {
			if (error?.status === 400) return ctx.badRequest(error.message);
			if (error?.status === 401) return ctx.unauthorized(error.message);
			if (error?.status === 403) return ctx.forbidden(error.message);
			if (error?.status === 404) return ctx.notFound(error.message);
			if (error?.status === 409) return ctx.conflict(error.message);
			strapi.log.error('[admission-public-v1.createApplication] unexpected error', error);
			return ctx.internalServerError('Failed to create admission application');
		}
	},

	async updateApplication(ctx: any) {
		try {
			const context = await resolveSession(ctx);
			const applicationId = Number(ctx.params?.id || 0);
			if (!context.application?.id || applicationId !== Number(context.application.id)) {
				return ctx.notFound('Admission application not found');
			}

			const permissions = buildPublicAdmissionV1Permissions(context.campaign, context.application);
			if (!permissions.canEdit) {
				return ctx.forbidden(getDraftEditBlockedMessage(context.campaign));
			}

			const body = extractPayload(ctx);
			const submissionMode = toSubmissionMode(body.submissionMode || context.application.admissionStatus);
			const formData = normalizeFormData(body.formData, normalizeText(context.learner.code));
			const changedFileFieldKeys = getChangedMainFormFileFieldKeys(
				context.campaign?.formTemplate?.schema,
				context.application?.formData,
				formData,
			);
			if (changedFileFieldKeys.length > 0 && !permissions.canUploadMainEvidence) {
				return ctx.forbidden(getNeedUpdateEvidenceMessage());
			}
			if (permissions.isDraft && submissionMode === 'submitted' && !permissions.canSubmit) {
				return ctx.forbidden(getDraftEditBlockedMessage(context.campaign));
			}
			if (permissions.isNeedUpdate && submissionMode !== 'submitted') {
				return ctx.badRequest('Hồ sơ cần bổ sung phải được nộp lại sau khi chỉnh sửa.');
			}

			const studentCode = extractStudentCode(body, formData, normalizeText(context.learner.code)) ?? normalizeStudentCode(context.application.studentCode);
			const studentName = toRequiredText(body.studentName || context.application.studentName, 'studentName');
			const dob = toRequiredDate(body.dob || context.application.dob || context.learner.dateOfBirth, 'dob');
			const gender = toNullableGender(body.gender ?? context.application.gender);
			const currentSchool = toNullableText(body.currentSchool ?? context.application.currentSchool);
			const address = toNullableText(body.address ?? context.application.address);
			const persisted = await persistAdmissionFormDataFiles(formData, {
				tenantId: context.tenantId,
				tenantCode: normalizeText(context.campaign?.tenant?.code),
				campaignCode: normalizeText(context.campaign?.code),
				applicationKey: normalizeText(context.application.applicationCode) || String(context.application.id || ''),
				applicationId: context.application?.id,
				uploadedBy: Number(context.learner?.user?.id || context.application?.parent?.id || 0) || null,
			});
			const persistedFormData = persisted.formData;

			let updated;
			try {
				updated = await strapi.entityService.update(ADMISSION_APPLICATION_UID, context.application.id, {
				data: {
					studentCode,
					studentName,
					dob,
					gender,
					currentSchool,
					address,
					formData: persistedFormData,
					reviewSnapshot: buildAdmissionReviewSnapshot({
						application: {
							...context.application,
							studentCode,
							studentName,
							dob,
							gender,
							currentSchool,
							address,
							formData: persistedFormData,
							formTemplateVersion: Number(context.campaign.formTemplateVersion || context.campaign?.formTemplate?.version || context.application.formTemplateVersion || 0),
						},
						campaign: context.campaign,
						parent: context.application?.parent || context.learner.user,
					}),
					formTemplateVersion: Number(context.campaign.formTemplateVersion || context.campaign?.formTemplate?.version || context.application.formTemplateVersion || 0),
					admissionStatus: submissionMode,
					reviewStatus: submissionMode === 'submitted' ? 'submitted' : context.application.reviewStatus || null,
					reviewedBy: submissionMode === 'submitted' ? null : context.application.reviewedBy?.id || null,
					submittedAt: submissionMode === 'submitted'
						? new Date().toISOString()
						: context.application.submittedAt || null,
					reviewedAt: submissionMode === 'submitted' ? null : context.application.reviewedAt || null,
					reviewNote: submissionMode === 'submitted' ? null : context.application.reviewNote || null,
				} as any,
				populate: {
					reviewedBy: true,
					campaign: {
						populate: {
							formTemplate: true,
						},
					},
				},
				});
			} catch (error) {
				await removePersistedAdmissionFiles(persisted.cleanupTargets);
				throw error;
			}

			await markRemovedAdmissionFormFileAssetsDeleted(context.application?.formData, persistedFormData);

			ctx.body = {
				success: true,
				data: {
					application: normalizeApplication(updated),
				},
			};
		} catch (error: any) {
			if (error?.status === 400) return ctx.badRequest(error.message);
			if (error?.status === 401) return ctx.unauthorized(error.message);
			if (error?.status === 403) return ctx.forbidden(error.message);
			if (error?.status === 404) return ctx.notFound(error.message);
			if (error?.status === 409) return ctx.conflict(error.message);
			strapi.log.error('[admission-public-v1.updateApplication] unexpected error', error);
			return ctx.internalServerError('Failed to update admission application');
		}
	},
};