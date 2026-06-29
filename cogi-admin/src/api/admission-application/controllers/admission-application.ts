/**
 * admission-application controller
 */

import { factories } from '@strapi/strapi';
import { mergeTenantWhere, resolveCurrentTenantId, toText, whereByParam } from '../../../utils/tenant-scope';
import { buildAdmissionReviewSnapshot } from '../../../utils/admission-review-snapshot';
import {
	acknowledgeAdmissionApproval,
	createReviewDetailViewActivity,
	createReviewActivity,
	exportReviewApplications,
	getReviewApplicationEmailTemplates,
	getReviewApplicationNotificationTemplate,
	getEffectiveReviewStatus,
	getReviewApplicationDetail,
	getReviewApplicationFormData,
	getReviewApplicationMessages,
	getReviewApplicationSnapshot,
	listReviewApplications,
	rebuildReviewApplicationSnapshot,
	resetReviewApplicationToDraft,
	restoreReviewApplication,
	reviewApplicationDecision,
	softDeleteReviewApplication,
	updateReturnedApplicationReviewNote,
	sendAdmissionApprovalReminder,
	sendReviewApplicationEmail,
	sendReviewApplicationMessage,
} from '../services/admission-application';
import {
	persistAdmissionMessageFiles,
	removePersistedAdmissionMessageFiles,
} from '../../../utils/admission-message-files';
import {
	markRemovedAdmissionFormFileAssetsDeleted,
	persistAdmissionFormDataFiles as persistAdmissionFormDataFilesFromForm,
	removePersistedAdmissionFiles as removePersistedAdmissionFilesFromForm,
	syncAdmissionFormFileAssetsEntityId,
} from '../../../utils/admission-form-files';

const ADMISSION_APPLICATION_UID = 'api::admission-application.admission-application';
const CAMPAIGN_UID = 'api::campaign.campaign';
const TENANT_UID = 'api::tenant.tenant';
const USER_TENANT_UID = 'api::user-tenant.user-tenant';
const USER_UID = 'plugin::users-permissions.user';
const EDITABLE_STATUSES = new Set(['draft', 'rejected']);
type AdmissionGender = 'male' | 'female' | 'other';

function buildActiveAdmissionWhere() {
	return {
		$or: [
			{ isDeleted: false },
			{ isDeleted: { $null: true } },
		],
	};
}

function normalizeEmail(value: unknown) {
	return toText(value).trim().toLowerCase();
}

function normalizePhone(value: unknown) {
	return toText(value).trim();
}

function validateEmail(email: string) {
	return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

async function resolveUserFromJwt(ctx: any) {
	try {
		const authHeader = ctx.request?.headers?.authorization || ctx.request?.header?.authorization || '';
		const token = typeof authHeader === 'string' && authHeader.startsWith('Bearer ')
			? authHeader.slice(7).trim()
			: '';

		if (!token) return null;

		const jwtService = strapi.plugin('users-permissions')?.service('jwt');
		if (!jwtService) return null;

		const decoded = await jwtService.verify(token);
		const userId = Number(decoded?.id || 0);
		if (!Number.isInteger(userId) || userId <= 0) return null;

		return strapi.db.query('plugin::users-permissions.user').findOne({
			where: { id: userId },
			select: ['id', 'email', 'blocked'],
		});
	} catch {
		return null;
	}
}

async function resolveAuthenticatedUser(ctx: any) {
	let authUser = ctx.state?.user;
	if (!authUser?.id) {
		authUser = await resolveUserFromJwt(ctx);
	}
	return authUser;
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

function flattenUploadedFiles(value: unknown): any[] {
	if (!value) return [];
	if (Array.isArray(value)) {
		return value.flatMap((entry) => flattenUploadedFiles(entry));
	}
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
	return toText(ctx.request?.ip || ctx.ip || ctx.request?.headers?.['x-forwarded-for'] || '') || null;
}

function resolveRequestUserAgent(ctx: any) {
	return toText(ctx.request?.headers?.['user-agent'] || '') || null;
}

function toNullableText(value: unknown): string | null {
	const text = toText(value);
	return text || null;
}

function toNullableGender(value: unknown): AdmissionGender | null {
	const text = toText(value).toLowerCase();
	if (!text) return null;
	if (text === 'male' || text === 'female' || text === 'other') {
		return text;
	}

	const error = new Error('gender is invalid') as Error & { status?: number };
	error.status = 400;
	throw error;
}

function toRequiredText(value: unknown, label: string) {
	const text = toText(value);
	if (!text) {
		const error = new Error(`${label} is required`) as Error & { status?: number };
		error.status = 400;
		throw error;
	}
	return text;
}

function toRequiredDate(value: unknown, label: string) {
	const text = toText(value);
	if (!text) {
		const error = new Error(`${label} is required`) as Error & { status?: number };
		error.status = 400;
		throw error;
	}

	const date = new Date(text);
	if (Number.isNaN(date.getTime())) {
		const error = new Error(`${label} is invalid`) as Error & { status?: number };
		error.status = 400;
		throw error;
	}

	return date.toISOString().slice(0, 10);
}

function normalizeFormData(value: unknown) {
	if (value === null || value === undefined || value === '') return null;
	if (typeof value === 'string') {
		try {
			return JSON.parse(value);
		} catch {
			return { value };
		}
	}
	if (typeof value === 'object') return value;
	return { value };
}

function normalizeStudentCode(value: unknown): string | null {
	const text = toText(value).toUpperCase();
	return text || null;
}

function extractStudentCode(body: Record<string, unknown>, normalizedFormData: unknown): string | null {
	const formData = normalizedFormData && typeof normalizedFormData === 'object' && !Array.isArray(normalizedFormData)
		? normalizedFormData as Record<string, unknown>
		: null;

	return normalizeStudentCode(body.studentCode ?? formData?.studentCode);
}

function extractFormFieldValue(normalizedFormData: unknown, key: string) {
	if (!normalizedFormData || typeof normalizedFormData !== 'object' || Array.isArray(normalizedFormData)) {
		return undefined;
	}

	return (normalizedFormData as Record<string, unknown>)[key];
}

function readAdmissionStatus(row: any) {
	return row?.admissionStatus || row?.status || 'draft';
}

function readCampaignStatus(row: any) {
	return row?.campaignStatus || row?.status || 'draft';
}

function readFormTemplateStatus(row: any) {
	return row?.formTemplateStatus || row?.status || 'draft';
}

function isEditableStatus(status: unknown) {
	const normalized = String(status || '').trim().toLowerCase();
	return EDITABLE_STATUSES.has(normalized);
}

function toSubmissionMode(value: unknown): 'draft' | 'submitted' {
	const normalized = String(value || '').trim().toLowerCase();
	return normalized === 'submitted' || normalized === 'submit' ? 'submitted' : 'draft';
}

const APPLICATION_CODE_DIGITS = 4;

function normalizeApplicationCodePrefix(value: unknown): string {
	const normalized = toText(value).toUpperCase().replace(/[^A-Z0-9]/g, '');
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

async function findOpenCampaignByCode(campaignCode: string, tenantId: number | string) {
	return strapi.db.query(CAMPAIGN_UID).findOne({
		where: mergeTenantWhere({
			code: {
				$eqi: campaignCode,
			},
			isActive: true,
			campaignStatus: 'open',
		}, tenantId),
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

async function findMyApplicationOrThrow(applicationId: unknown, userId: number, tenantId: number | string) {
	const id = Number(applicationId || 0);
	if (!Number.isInteger(id) || id <= 0) {
		const error = new Error('Admission application id is invalid') as Error & { status?: number };
		error.status = 400;
		throw error;
	}

	const application = await strapi.db.query(ADMISSION_APPLICATION_UID).findOne({
		where: mergeTenantWhere({
			$and: [
				{
					id,
					parent: {
						id: {
							$eq: userId,
						},
					},
				},
				buildActiveAdmissionWhere(),
			],
		}, tenantId),
		populate: {
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
		},
	});

	if (!application?.id) {
		const error = new Error('Admission application not found') as Error & { status?: number };
		error.status = 404;
		throw error;
	}

	return application;
}

function normalizeApplication(row: any) {
	const admissionStatus = readAdmissionStatus(row);
	const reviewStatus = getEffectiveReviewStatus(row);
	return {
		id: row.id,
		applicationCode: row.applicationCode || '',
		studentCode: row.studentCode || null,
		studentName: row.studentName || '',
		admissionStatus,
		status: admissionStatus,
		reviewStatus,
		isEditable: isEditableStatus(admissionStatus),
		dob: row.dob || null,
		gender: row.gender || null,
		currentSchool: row.currentSchool || null,
		address: row.address || null,
		formData: row.formData ?? null,
		reviewSnapshot: row.reviewSnapshot ?? null,
		formTemplateVersion: Number(row.formTemplateVersion || 0),
		createdAt: row.createdAt || null,
		submittedAt: row.submittedAt || null,
		reviewedAt: row.reviewedAt || null,
		reviewNote: row.reviewNote || null,
		isDeleted: row.isDeleted === true,
		deletedAt: row.deletedAt || null,
		deleteReason: row.deleteReason || null,
		deletedBy: row.deletedBy
			? {
				id: row.deletedBy.id,
				username: row.deletedBy.username || '',
				email: row.deletedBy.email || '',
				fullName: row.deletedBy.fullName || '',
			}
			: null,
		restoredAt: row.restoredAt || null,
		restoreReason: row.restoreReason || null,
		restoredBy: row.restoredBy
			? {
				id: row.restoredBy.id,
				username: row.restoredBy.username || '',
				email: row.restoredBy.email || '',
				fullName: row.restoredBy.fullName || '',
			}
			: null,
		approvalNotifiedAt: row.approvalNotifiedAt || null,
		approvalNotificationCount: Math.max(0, Number(row.approvalNotificationCount || 0)),
		approvedAcknowledgedAt: row.approvedAcknowledgedAt || null,
		approvedAcknowledgedNote: row.approvedAcknowledgedNote || null,
		approvedAcknowledgedBy: row.approvedAcknowledgedBy
			? {
				id: row.approvedAcknowledgedBy.id,
				username: row.approvedAcknowledgedBy.username || '',
				email: row.approvedAcknowledgedBy.email || '',
				fullName: row.approvedAcknowledgedBy.fullName || '',
			}
			: null,
		reviewedBy: row.reviewedBy
			? {
				id: row.reviewedBy.id,
				username: row.reviewedBy.username || '',
				email: row.reviewedBy.email || '',
				fullName: row.reviewedBy.fullName || '',
			}
			: null,
		parent: row.parent
			? {
				id: row.parent.id,
				username: row.parent.username || '',
				email: row.parent.email || '',
				fullName: row.parent.fullName || '',
				phone: row.parent.phone || '',
			}
			: null,
		campaign: row.campaign
			? {
				id: row.campaign.id,
				name: row.campaign.name || '',
				code: row.campaign.code || '',
				campaignStatus: readCampaignStatus(row.campaign),
				status: readCampaignStatus(row.campaign),
				startDate: row.campaign.startDate || null,
				endDate: row.campaign.endDate || null,
				reviewDisplayConfig: row.campaign.reviewDisplayConfig ?? null,
				formTemplateVersion: Number(row.campaign.formTemplateVersion || 0),
				formTemplate: row.campaign.formTemplate
					? {
						id: row.campaign.formTemplate.id,
						name: row.campaign.formTemplate.name || '',
						version: Number(row.campaign.formTemplate.version || 0),
						formTemplateStatus: readFormTemplateStatus(row.campaign.formTemplate),
						status: readFormTemplateStatus(row.campaign.formTemplate),
						isLocked: row.campaign.formTemplate.isLocked === true,
						schema: row.campaign.formTemplate.schema ?? null,
					}
					: null,
			}
			: null,
	};
}

async function hasTenantMembership(userId: number, tenantId: number | string) {
	const membership = await strapi.db.query(USER_TENANT_UID).findOne({
		where: {
			user: {
				id: {
					$eq: userId,
				},
			},
			tenant: {
				id: {
					$eq: tenantId,
				},
			},
			userTenantStatus: {
				$in: ['pending', 'active'],
			},
		},
		select: ['id'],
	});

	return Boolean(membership?.id);
}

export default factories.createCoreController(ADMISSION_APPLICATION_UID, () => ({
	async me(ctx) {
		const authUser = await resolveAuthenticatedUser(ctx);
		const userId = Number(authUser?.id || 0);
		if (!Number.isInteger(userId) || userId <= 0) {
			return ctx.unauthorized('Unauthorized');
		}

		if (authUser?.blocked) {
			return ctx.unauthorized('Account is blocked');
		}

		const tenantId = resolveCurrentTenantId(ctx);
		const allowed = await hasTenantMembership(userId, tenantId);
		if (!allowed) {
			return ctx.forbidden('You do not have access to this tenant');
		}

		const rows = await strapi.db.query(ADMISSION_APPLICATION_UID).findMany({
			where: mergeTenantWhere({
				$and: [
					{
						parent: {
							id: {
								$eq: userId,
							},
						},
					},
					buildActiveAdmissionWhere(),
				],
			}, tenantId),
			select: ['id', 'applicationCode', 'studentCode', 'admissionStatus', 'reviewStatus', 'studentName', 'dob', 'gender', 'currentSchool', 'address', 'formData', 'formTemplateVersion', 'createdAt', 'submittedAt', 'reviewedAt', 'reviewNote', 'isDeleted', 'deletedAt', 'deleteReason', 'restoredAt', 'restoreReason'],
			orderBy: [{ createdAt: 'desc' }],
			populate: {
				deletedBy: {
					select: ['id', 'username', 'email', 'fullName'],
				},
				restoredBy: {
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
			},
		});

		ctx.body = {
			data: (rows || []).map((row) => normalizeApplication(row)),
		};
	},

	async acknowledgeApproval(ctx) {
		try {
			const authUser = await resolveAuthenticatedUser(ctx);
			const body = extractPayload(ctx);
			const userId = Number(authUser?.id || 0);
			if (!Number.isInteger(userId) || userId <= 0) {
				return ctx.unauthorized('Unauthorized');
			}

			if (authUser?.blocked) {
				return ctx.unauthorized('Account is blocked');
			}

			const updated = await acknowledgeAdmissionApproval(
				ctx.params?.id,
				userId,
				resolveCurrentTenantId(ctx),
				{ note: body.note },
			);

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
			strapi.log.error('[admission-application.acknowledgeApproval] unexpected error', error);
			return ctx.internalServerError('Failed to acknowledge admission approval');
		}
	},

	async detail(ctx) {
		try {
			const authUser = await resolveAuthenticatedUser(ctx);
			const userId = Number(authUser?.id || 0);
			if (!Number.isInteger(userId) || userId <= 0) {
				return ctx.unauthorized('Unauthorized');
			}

			if (authUser?.blocked) {
				return ctx.unauthorized('Account is blocked');
			}

			const tenantId = resolveCurrentTenantId(ctx);
			const tenantCode = toText(ctx.state?.tenant?.code || ctx.state?.tenantCode || ctx.request?.headers?.['x-tenant-code'] || '');
			const allowed = await hasTenantMembership(userId, tenantId);
			if (!allowed) {
				return ctx.forbidden('You do not have access to this tenant');
			}

			const application = await findMyApplicationOrThrow(ctx.params?.id, userId, tenantId);
			ctx.body = { data: normalizeApplication(application) };
		} catch (error: any) {
			if (error?.status === 400) return ctx.badRequest(error.message);
			if (error?.status === 403) return ctx.forbidden(error.message);
			if (error?.status === 404) return ctx.notFound(error.message);
			strapi.log.error('[admission-application.detail] unexpected error', error);
			return ctx.internalServerError('Failed to load admission application');
		}
	},

	async createMine(ctx) {
		try {
			const authUser = await resolveAuthenticatedUser(ctx);
			const userId = Number(authUser?.id || 0);
			if (!Number.isInteger(userId) || userId <= 0) {
				return ctx.unauthorized('Unauthorized');
			}

			if (authUser?.blocked) {
				return ctx.unauthorized('Account is blocked');
			}

			const tenantId = resolveCurrentTenantId(ctx);
			const tenantCode = toText(ctx.state?.tenant?.code || ctx.state?.tenantCode || ctx.request?.headers?.['x-tenant-code'] || '');
			const allowed = await hasTenantMembership(userId, tenantId);
			if (!allowed) {
				return ctx.forbidden('You do not have access to this tenant');
			}

			const body = extractPayload(ctx);
			const campaignCode = toRequiredText(body.campaignCode, 'campaignCode');
			const campaign = await findOpenCampaignByCode(campaignCode, tenantId);
			if (!campaign?.id) {
				return ctx.notFound('Admission campaign not found');
			}

			const submissionMode = toSubmissionMode(body.submissionMode);
			const formData = normalizeFormData(body.formData);
			const studentCode = extractStudentCode(body, formData);
			const data = {
				tenant: tenantId,
				campaign: campaign.id,
				parent: userId,
				applicationCode: await generateApplicationCode(tenantId, tenantCode, toText(campaign?.tenant?.code)),
				studentCode,
				studentName: toRequiredText(body.studentName, 'studentName'),
				dob: toRequiredDate(body.dob, 'dob'),
				gender: toNullableGender(body.gender),
				currentSchool: toNullableText(body.currentSchool),
				address: toNullableText(body.address),
				formData,
				reviewSnapshot: buildAdmissionReviewSnapshot({
					application: {
						studentCode,
						studentName: toRequiredText(body.studentName, 'studentName'),
						dob: toRequiredDate(body.dob, 'dob'),
						gender: toNullableGender(body.gender),
						currentSchool: toNullableText(body.currentSchool),
						address: toNullableText(body.address),
						formData,
						formTemplateVersion: Number(campaign.formTemplateVersion || campaign.formTemplate?.version || 0),
					},
					campaign,
					parent: authUser,
				}),
				formTemplateVersion: Number(campaign.formTemplateVersion || campaign.formTemplate?.version || 0),
				admissionStatus: submissionMode,
				reviewStatus: submissionMode === 'submitted' ? 'submitted' : null,
				reviewedBy: null,
				submittedAt: submissionMode === 'submitted' ? new Date().toISOString() : null,
				reviewedAt: null,
				reviewNote: null,
			};

			const created = await strapi.entityService.create(ADMISSION_APPLICATION_UID, {
				data: data as any,
				populate: {
					campaign: {
						populate: {
							formTemplate: true,
						},
					},
				},
			});

			ctx.body = { data: normalizeApplication(created) };
		} catch (error: any) {
			if (error?.status === 400) return ctx.badRequest(error.message);
			if (error?.status === 403) return ctx.forbidden(error.message);
			if (error?.status === 404) return ctx.notFound(error.message);
			strapi.log.error('[admission-application.createMine] unexpected error', error);
			return ctx.internalServerError('Failed to create admission application');
		}
	},

	async updateMine(ctx) {
		try {
			const authUser = await resolveAuthenticatedUser(ctx);
			const userId = Number(authUser?.id || 0);
			if (!Number.isInteger(userId) || userId <= 0) {
				return ctx.unauthorized('Unauthorized');
			}

			if (authUser?.blocked) {
				return ctx.unauthorized('Account is blocked');
			}

			const tenantId = resolveCurrentTenantId(ctx);
			const allowed = await hasTenantMembership(userId, tenantId);
			if (!allowed) {
				return ctx.forbidden('You do not have access to this tenant');
			}

			const existing = await findMyApplicationOrThrow(ctx.params?.id, userId, tenantId);
			if (!isEditableStatus(readAdmissionStatus(existing))) {
				return ctx.forbidden('Admission application can no longer be edited');
			}

			const body = extractPayload(ctx);
			const submissionMode = toSubmissionMode(body.submissionMode || readAdmissionStatus(existing));
			const formData = normalizeFormData(body.formData);
			const studentCode = extractStudentCode(body, formData) ?? normalizeStudentCode(existing.studentCode);
			const studentName = toRequiredText(body.studentName, 'studentName');
			const dob = toRequiredDate(body.dob, 'dob');
			const gender = toNullableGender(body.gender);
			const currentSchool = toNullableText(body.currentSchool);
			const address = toNullableText(body.address);
			const updated = await strapi.entityService.update(ADMISSION_APPLICATION_UID, existing.id, {
				data: {
					studentCode,
					studentName,
					dob,
					gender,
					currentSchool,
					address,
					formData,
					reviewSnapshot: buildAdmissionReviewSnapshot({
						application: {
							...existing,
							studentCode,
							studentName,
							dob,
							gender,
							currentSchool,
							address,
							formData,
							formTemplateVersion: Number(existing?.campaign?.formTemplateVersion || existing?.campaign?.formTemplate?.version || existing.formTemplateVersion || 0),
						},
						campaign: existing?.campaign,
						parent: existing?.parent || authUser,
					}),
					formTemplateVersion: Number(existing?.campaign?.formTemplateVersion || existing?.campaign?.formTemplate?.version || existing.formTemplateVersion || 0),
					admissionStatus: submissionMode,
					reviewStatus: submissionMode === 'submitted' ? 'submitted' : existing.reviewStatus || null,
					reviewedBy: submissionMode === 'submitted' ? null : existing.reviewedBy?.id || null,
					submittedAt: submissionMode === 'submitted'
						? new Date().toISOString()
						: existing.submittedAt || null,
					reviewedAt: submissionMode === 'submitted' ? null : existing.reviewedAt || null,
					reviewNote: submissionMode === 'submitted' ? null : existing.reviewNote || null,
				},
				populate: {
					campaign: {
						populate: {
							formTemplate: true,
						},
					},
				},
			});

			ctx.body = { data: normalizeApplication(updated) };
		} catch (error: any) {
			if (error?.status === 400) return ctx.badRequest(error.message);
			if (error?.status === 403) return ctx.forbidden(error.message);
			if (error?.status === 404) return ctx.notFound(error.message);
			strapi.log.error('[admission-application.updateMine] unexpected error', error);
			return ctx.internalServerError('Failed to update admission application');
		}
	},

	async reviewList(ctx) {
		const authUser = await resolveAuthenticatedUser(ctx);
		const userId = Number(authUser?.id || 0);
		if (!Number.isInteger(userId) || userId <= 0) {
			return ctx.unauthorized('Unauthorized');
		}

		if (authUser?.blocked) {
			return ctx.unauthorized('Account is blocked');
		}

		try {
			const data = await listReviewApplications(ctx.request?.query || {}, resolveCurrentTenantId(ctx));
			ctx.body = {
				success: true,
				data: {
					rows: (data.rows || []).map((row) => normalizeApplication(row)),
					pagination: data.pagination,
				},
			};
		} catch (error: any) {
			if (error?.status === 400) return ctx.badRequest(error.message);
			if (error?.status === 403) return ctx.forbidden(error.message);
			if (error?.status === 404) return ctx.notFound(error.message);
			if (error?.status === 409) return ctx.conflict(error.message);
			strapi.log.error('[admission-application.reviewList] unexpected error', error);
			return ctx.internalServerError('Failed to load admission review list');
		}
	},

	async reviewDetail(ctx) {
		const authUser = await resolveAuthenticatedUser(ctx);
		const userId = Number(authUser?.id || 0);
		if (!Number.isInteger(userId) || userId <= 0) {
			return ctx.unauthorized('Unauthorized');
		}

		if (authUser?.blocked) {
			return ctx.unauthorized('Account is blocked');
		}

		try {
			const row = await getReviewApplicationDetail(ctx.params?.id, resolveCurrentTenantId(ctx), { includeDeleted: true });
			ctx.body = { success: true, data: normalizeApplication(row) };
		} catch (error: any) {
			if (error?.status === 400) return ctx.badRequest(error.message);
			if (error?.status === 403) return ctx.forbidden(error.message);
			if (error?.status === 404) return ctx.notFound(error.message);
			if (error?.status === 409) return ctx.conflict(error.message);
			strapi.log.error('[admission-application.reviewDetail] unexpected error', error);
			return ctx.internalServerError('Failed to load admission review detail');
		}
	},

	async reviewSoftDelete(ctx) {
		const authUser = await resolveAuthenticatedUser(ctx);
		const userId = Number(authUser?.id || 0);
		if (!Number.isInteger(userId) || userId <= 0) {
			return ctx.unauthorized('Unauthorized');
		}

		if (authUser?.blocked) {
			return ctx.unauthorized('Account is blocked');
		}

		try {
			const payload = extractPayload(ctx);
			const row = await softDeleteReviewApplication(
				ctx.params?.id,
				userId,
				resolveCurrentTenantId(ctx),
				payload.reason,
			);
			ctx.body = { success: true, data: normalizeApplication(row) };
		} catch (error: any) {
			if (error?.status === 400) return ctx.badRequest(error.message);
			if (error?.status === 401) return ctx.unauthorized(error.message);
			if (error?.status === 403) return ctx.forbidden(error.message);
			if (error?.status === 404) return ctx.notFound(error.message);
			if (error?.status === 409) return ctx.conflict(error.message);
			strapi.log.error('[admission-application.reviewSoftDelete] unexpected error', error);
			return ctx.internalServerError('Failed to soft delete admission application');
		}
	},

	async reviewRestore(ctx) {
		const authUser = await resolveAuthenticatedUser(ctx);
		const userId = Number(authUser?.id || 0);
		if (!Number.isInteger(userId) || userId <= 0) {
			return ctx.unauthorized('Unauthorized');
		}

		if (authUser?.blocked) {
			return ctx.unauthorized('Account is blocked');
		}

		try {
			const payload = extractPayload(ctx);
			const row = await restoreReviewApplication(
				ctx.params?.id,
				userId,
				resolveCurrentTenantId(ctx),
				payload.reason,
			);
			ctx.body = { success: true, data: normalizeApplication(row) };
		} catch (error: any) {
			if (error?.status === 400) return ctx.badRequest(error.message);
			if (error?.status === 401) return ctx.unauthorized(error.message);
			if (error?.status === 403) return ctx.forbidden(error.message);
			if (error?.status === 404) return ctx.notFound(error.message);
			if (error?.status === 409) return ctx.conflict(error.message);
			strapi.log.error('[admission-application.reviewRestore] unexpected error', error);
			return ctx.internalServerError('Failed to restore admission application');
		}
	},

	async reviewMessages(ctx) {
		const authUser = await resolveAuthenticatedUser(ctx);
		const userId = Number(authUser?.id || 0);
		if (!Number.isInteger(userId) || userId <= 0) {
			return ctx.unauthorized('Unauthorized');
		}

		if (authUser?.blocked) {
			return ctx.unauthorized('Account is blocked');
		}

		try {
			const rows = await getReviewApplicationMessages(ctx.params?.id, resolveCurrentTenantId(ctx));
			ctx.body = { success: true, data: rows };
		} catch (error: any) {
			if (error?.status === 400) return ctx.badRequest(error.message);
			if (error?.status === 403) return ctx.forbidden(error.message);
			if (error?.status === 404) return ctx.notFound(error.message);
			if (error?.status === 409) return ctx.conflict(error.message);
			strapi.log.error('[admission-application.reviewMessages] unexpected error', error);
			return ctx.internalServerError('Failed to load admission review messages');
		}
	},

	async reviewSendMessage(ctx) {
		const authUser = await resolveAuthenticatedUser(ctx);
		const userId = Number(authUser?.id || 0);
		if (!Number.isInteger(userId) || userId <= 0) {
			return ctx.unauthorized('Unauthorized');
		}

		if (authUser?.blocked) {
			return ctx.unauthorized('Account is blocked');
		}

		const cleanupTargets: Array<string | { filePath: string; fileAssetId?: number | null }> = [];
		try {
			const tenantId = resolveCurrentTenantId(ctx);
			const application = await getReviewApplicationDetail(ctx.params?.id, tenantId);
			const body = extractPayload(ctx);
			const files = extractUploadedFiles(ctx);
			const attachmentInputs = files.length > 0
				? files
				: (Array.isArray(body.attachments) ? body.attachments : []);
			const persisted = await persistAdmissionMessageFiles(attachmentInputs as any[], {
				tenantId,
				tenantCode: ctx.state?.tenant?.code,
				campaignCode: application?.campaign?.code,
				applicationKey: application?.applicationCode || application?.id,
				applicationId: application?.id,
				uploadedBy: userId,
			});
			cleanupTargets.push(...persisted.cleanupTargets);

			const message = await sendReviewApplicationMessage(
				ctx.params?.id,
				{
					...body,
					attachments: persisted.attachments,
					ipAddress: resolveRequestIp(ctx),
					userAgent: resolveRequestUserAgent(ctx),
				},
				userId,
				tenantId,
			);

			ctx.body = { success: true, data: message };
		} catch (error: any) {
			await removePersistedAdmissionMessageFiles(cleanupTargets);
			if (error?.status === 400) return ctx.badRequest(error.message);
			if (error?.status === 403) return ctx.forbidden(error.message);
			if (error?.status === 404) return ctx.notFound(error.message);
			if (error?.status === 409) return ctx.conflict(error.message);
			strapi.log.error('[admission-application.reviewSendMessage] unexpected error', error);
			return ctx.internalServerError('Failed to send admission review message');
		}
	},

	async reviewViewDetailActivity(ctx) {
		const authUser = await resolveAuthenticatedUser(ctx);
		const userId = Number(authUser?.id || 0);
		if (!Number.isInteger(userId) || userId <= 0) {
			return ctx.unauthorized('Unauthorized');
		}

		if (authUser?.blocked) {
			return ctx.unauthorized('Account is blocked');
		}

		try {
			await createReviewDetailViewActivity(ctx.params?.id, userId, resolveCurrentTenantId(ctx), {
				ipAddress: resolveRequestIp(ctx),
				userAgent: resolveRequestUserAgent(ctx),
			});
			ctx.body = { success: true };
		} catch (error: any) {
			if (error?.status === 400) return ctx.badRequest(error.message);
			if (error?.status === 403) return ctx.forbidden(error.message);
			if (error?.status === 404) return ctx.notFound(error.message);
			if (error?.status === 409) return ctx.conflict(error.message);
			strapi.log.error('[admission-application.reviewViewDetailActivity] unexpected error', error);
			return ctx.internalServerError('Failed to log review detail view');
		}
	},

	async reviewSendEmail(ctx) {
		const authUser = await resolveAuthenticatedUser(ctx);
		const userId = Number(authUser?.id || 0);
		if (!Number.isInteger(userId) || userId <= 0) {
			return ctx.unauthorized('Unauthorized');
		}

		if (authUser?.blocked) {
			return ctx.unauthorized('Account is blocked');
		}

		const cleanupTargets: Array<string | { filePath: string; fileAssetId?: number | null }> = [];
		try {
			const tenantId = resolveCurrentTenantId(ctx);
			const application = await getReviewApplicationDetail(ctx.params?.id, tenantId);
			const body = extractPayload(ctx);
			const files = extractUploadedFiles(ctx);
			const attachmentInputs = files.length > 0
				? files
				: (Array.isArray(body.attachments) ? body.attachments : []);
			const persisted = await persistAdmissionMessageFiles(attachmentInputs as any[], {
				tenantId,
				tenantCode: ctx.state?.tenant?.code,
				campaignCode: application?.campaign?.code,
				applicationKey: application?.applicationCode || application?.id,
				applicationId: application?.id,
				uploadedBy: userId,
			});
			cleanupTargets.push(...persisted.cleanupTargets);

			const result = await sendReviewApplicationEmail(
				ctx.params?.id,
				{
					...body,
					attachments: persisted.attachments,
					ipAddress: resolveRequestIp(ctx),
					userAgent: resolveRequestUserAgent(ctx),
					publicBaseUrl: String(ctx.request?.origin || process.env.BACKEND_URL || '').trim(),
				},
				userId,
				tenantId,
			);

			ctx.body = {
				success: true,
				data: {
					application: normalizeApplication(result.application),
					message: result.message,
				},
			};
		} catch (error: any) {
			await removePersistedAdmissionMessageFiles(cleanupTargets);
			if (error?.status === 400) return ctx.badRequest(error.message);
			if (error?.status === 401) return ctx.unauthorized(error.message);
			if (error?.status === 403) return ctx.forbidden(error.message);
			if (error?.status === 404) return ctx.notFound(error.message);
			if (error?.status === 409) return ctx.conflict(error.message);
			strapi.log.error('[admission-application.reviewSendEmail] unexpected error', error);
			return ctx.internalServerError('Failed to send admission review email');
		}
	},

	async reviewEmailTemplates(ctx) {
		const authUser = await resolveAuthenticatedUser(ctx);
		const userId = Number(authUser?.id || 0);
		if (!Number.isInteger(userId) || userId <= 0) {
			return ctx.unauthorized('Unauthorized');
		}

		if (authUser?.blocked) {
			return ctx.unauthorized('Account is blocked');
		}

		try {
			const rows = await getReviewApplicationEmailTemplates(
				ctx.params?.id,
				resolveCurrentTenantId(ctx),
			);
			ctx.body = { success: true, data: rows };
		} catch (error: any) {
			if (error?.status === 400) return ctx.badRequest(error.message);
			if (error?.status === 401) return ctx.unauthorized(error.message);
			if (error?.status === 403) return ctx.forbidden(error.message);
			if (error?.status === 404) return ctx.notFound(error.message);
			if (error?.status === 409) return ctx.conflict(error.message);
			strapi.log.error('[admission-application.reviewEmailTemplates] unexpected error', error);
			return ctx.internalServerError('Failed to load admission review email templates');
		}
	},

	async reviewNotificationTemplate(ctx) {
		const authUser = await resolveAuthenticatedUser(ctx);
		const userId = Number(authUser?.id || 0);
		if (!Number.isInteger(userId) || userId <= 0) {
			return ctx.unauthorized('Unauthorized');
		}

		if (authUser?.blocked) {
			return ctx.unauthorized('Account is blocked');
		}

		try {
			const row = await getReviewApplicationNotificationTemplate(
				ctx.params?.id,
				ctx.request?.query?.code,
				resolveCurrentTenantId(ctx),
			);
			ctx.body = { success: true, data: row };
		} catch (error: any) {
			if (error?.status === 400) return ctx.badRequest(error.message);
			if (error?.status === 401) return ctx.unauthorized(error.message);
			if (error?.status === 403) return ctx.forbidden(error.message);
			if (error?.status === 404) return ctx.notFound(error.message);
			if (error?.status === 409) return ctx.conflict(error.message);
			strapi.log.error('[admission-application.reviewNotificationTemplate] unexpected error', error);
			return ctx.internalServerError('Failed to load admission review notification template');
		}
	},

	async reviewSnapshot(ctx) {
		const authUser = await resolveAuthenticatedUser(ctx);
		const userId = Number(authUser?.id || 0);
		if (!Number.isInteger(userId) || userId <= 0) {
			return ctx.unauthorized('Unauthorized');
		}

		if (authUser?.blocked) {
			return ctx.unauthorized('Account is blocked');
		}

		try {
			const row = await getReviewApplicationSnapshot(ctx.params?.id, resolveCurrentTenantId(ctx));
			ctx.body = {
				success: true,
				data: {
					id: row.id,
					applicationCode: row.applicationCode || '',
					reviewSnapshot: row.reviewSnapshot ?? null,
					updatedAt: row.updatedAt || null,
				},
			};
		} catch (error: any) {
			if (error?.status === 400) return ctx.badRequest(error.message);
			if (error?.status === 403) return ctx.forbidden(error.message);
			if (error?.status === 404) return ctx.notFound(error.message);
			if (error?.status === 409) return ctx.conflict(error.message);
			strapi.log.error('[admission-application.reviewSnapshot] unexpected error', error);
			return ctx.internalServerError('Failed to load admission review snapshot');
		}
	},

	async reviewFormData(ctx) {
		const authUser = await resolveAuthenticatedUser(ctx);
		const userId = Number(authUser?.id || 0);
		if (!Number.isInteger(userId) || userId <= 0) {
			return ctx.unauthorized('Unauthorized');
		}

		if (authUser?.blocked) {
			return ctx.unauthorized('Account is blocked');
		}

		try {
			const row = await getReviewApplicationFormData(ctx.params?.id, resolveCurrentTenantId(ctx));
			ctx.body = {
				success: true,
				data: {
					id: row.id,
					applicationCode: row.applicationCode || '',
					formData: row.formData ?? null,
					updatedAt: row.updatedAt || null,
				},
			};
		} catch (error: any) {
			if (error?.status === 400) return ctx.badRequest(error.message);
			if (error?.status === 403) return ctx.forbidden(error.message);
			if (error?.status === 404) return ctx.notFound(error.message);
			if (error?.status === 409) return ctx.conflict(error.message);
			strapi.log.error('[admission-application.reviewFormData] unexpected error', error);
			return ctx.internalServerError('Failed to load admission review form data');
		}
	},

	async reviewRebuildSnapshot(ctx) {
		const authUser = await resolveAuthenticatedUser(ctx);
		const userId = Number(authUser?.id || 0);
		if (!Number.isInteger(userId) || userId <= 0) {
			return ctx.unauthorized('Unauthorized');
		}

		if (authUser?.blocked) {
			return ctx.unauthorized('Account is blocked');
		}

		try {
			const row = await rebuildReviewApplicationSnapshot(ctx.params?.id, resolveCurrentTenantId(ctx));
			ctx.body = { success: true, data: normalizeApplication(row) };
		} catch (error: any) {
			if (error?.status === 400) return ctx.badRequest(error.message);
			if (error?.status === 403) return ctx.forbidden(error.message);
			if (error?.status === 404) return ctx.notFound(error.message);
			if (error?.status === 409) return ctx.conflict(error.message);
			strapi.log.error('[admission-application.reviewRebuildSnapshot] unexpected error', error);
			return ctx.internalServerError('Failed to rebuild admission review snapshot');
		}
	},

	async reviewExport(ctx) {
		const authUser = await resolveAuthenticatedUser(ctx);
		const userId = Number(authUser?.id || 0);
		if (!Number.isInteger(userId) || userId <= 0) {
			return ctx.unauthorized('Unauthorized');
		}

		if (authUser?.blocked) {
			return ctx.unauthorized('Account is blocked');
		}

		try {
			const result = await exportReviewApplications(ctx.request?.query || {}, resolveCurrentTenantId(ctx));
			ctx.set('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
			ctx.set('Content-Disposition', `attachment; filename="${result.fileName}"`);
			ctx.body = result.buffer;
		} catch (error: any) {
			if (error?.status === 400) return ctx.badRequest(error.message);
			if (error?.status === 403) return ctx.forbidden(error.message);
			if (error?.status === 404) return ctx.notFound(error.message);
			if (error?.status === 409) return ctx.conflict(error.message);
			strapi.log.error('[admission-application.reviewExport] unexpected error', error);
			return ctx.internalServerError('Failed to export admission review list');
		}
	},

	async reviewUpdateAccount(ctx) {
		const authUser = await resolveAuthenticatedUser(ctx);
		const userId = Number(authUser?.id || 0);
		if (!Number.isInteger(userId) || userId <= 0) {
			return ctx.unauthorized('Unauthorized');
		}

		if (authUser?.blocked) {
			return ctx.unauthorized('Account is blocked');
		}

		try {
			const tenantId = resolveCurrentTenantId(ctx);
			const payload = extractPayload(ctx);
			const fullName = toText(payload.fullName).trim();
			const email = normalizeEmail(payload.email);
			const phone = normalizePhone(payload.phone);

			if (!email) {
				return ctx.badRequest('email is required');
			}

			if (!validateEmail(email)) {
				return ctx.badRequest('email is invalid');
			}

			const application = await getReviewApplicationDetail(ctx.params?.id, tenantId);
			const parentId = Number(application?.parent?.id || 0);
			if (!parentId) {
				return ctx.conflict('Hồ sơ chưa có tài khoản phụ huynh hợp lệ');
			}

			const currentParentEmail = normalizeEmail(application?.parent?.email);
			const currentParentUsername = toText(application?.parent?.username).trim();
			if (email !== currentParentEmail) {
				const existingByEmail = await strapi.db.query(USER_UID).findOne({
					where: {
						id: { $ne: parentId },
						email: { $eqi: email },
					},
					select: ['id'],
				});

				if (existingByEmail?.id) {
					return ctx.conflict('Email đã được sử dụng bởi tài khoản khác');
				}

				if (currentParentUsername && currentParentUsername.toLowerCase() === currentParentEmail) {
					const existingByUsername = await strapi.db.query(USER_UID).findOne({
						where: {
							id: { $ne: parentId },
							username: { $eqi: email },
						},
						select: ['id'],
					});

					if (existingByUsername?.id) {
						return ctx.conflict('Không thể đồng bộ tên đăng nhập theo email mới vì đã tồn tại tài khoản khác');
					}
				}
			}

			const updateData: Record<string, unknown> = {
				fullName: fullName || null,
				email,
				phone: phone || null,
			};

			if (currentParentUsername && currentParentUsername.toLowerCase() === currentParentEmail) {
				updateData.username = email;
			}

			await strapi.entityService.update(USER_UID, parentId, {
				data: updateData as any,
			});

			const updated = await getReviewApplicationDetail(ctx.params?.id, tenantId);
			ctx.body = { success: true, data: normalizeApplication(updated) };
		} catch (error: any) {
			if (error?.status === 400) return ctx.badRequest(error.message);
			if (error?.status === 403) return ctx.forbidden(error.message);
			if (error?.status === 404) return ctx.notFound(error.message);
			if (error?.status === 409) return ctx.conflict(error.message);
			strapi.log.error('[admission-application.reviewUpdateAccount] unexpected error', error);
			return ctx.internalServerError('Failed to update parent account');
		}
	},

	async reviewDecision(ctx) {
		const authUser = await resolveAuthenticatedUser(ctx);
		const userId = Number(authUser?.id || 0);
		if (!Number.isInteger(userId) || userId <= 0) {
			return ctx.unauthorized('Unauthorized');
		}

		if (authUser?.blocked) {
			return ctx.unauthorized('Account is blocked');
		}

		try {
			const row = await reviewApplicationDecision(
				ctx.params?.id,
				extractPayload(ctx),
				userId,
				resolveCurrentTenantId(ctx),
			);
			ctx.body = { success: true, data: normalizeApplication(row) };
		} catch (error: any) {
			if (error?.status === 400) return ctx.badRequest(error.message);
			if (error?.status === 403) return ctx.forbidden(error.message);
			if (error?.status === 404) return ctx.notFound(error.message);
			if (error?.status === 409) return ctx.conflict(error.message);
			strapi.log.error('[admission-application.reviewDecision] unexpected error', error);
			return ctx.internalServerError('Failed to review admission application');
		}
	},

	async reviewUpdateApplication(ctx) {
		const authUser = await resolveAuthenticatedUser(ctx);
		const userId = Number(authUser?.id || 0);
		if (!Number.isInteger(userId) || userId <= 0) {
			return ctx.unauthorized('Unauthorized');
		}

		if (authUser?.blocked) {
			return ctx.unauthorized('Account is blocked');
		}

		const cleanupTargets: Array<string | { filePath: string; fileAssetId?: number | null }> = [];
		try {
			const tenantId = resolveCurrentTenantId(ctx);
			const existing = await getReviewApplicationDetail(ctx.params?.id, tenantId, { includeDeleted: true });
			if (existing?.isDeleted) {
				return ctx.conflict('Không thể chỉnh sửa hồ sơ đã bị xóa mềm');
			}

			const body = extractPayload(ctx);
			const normalizedFormDataInput = normalizeFormData(body.formData);
			const nextFormDataSource = normalizedFormDataInput && typeof normalizedFormDataInput === 'object' && !Array.isArray(normalizedFormDataInput)
				? normalizedFormDataInput
				: (existing?.formData && typeof existing.formData === 'object' && !Array.isArray(existing.formData) ? existing.formData : {});
			const studentCode = extractStudentCode(body, nextFormDataSource) ?? normalizeStudentCode(existing.studentCode);
			if (!studentCode) {
				return ctx.badRequest('studentCode is required');
			}

			const campaignId = Number(existing?.campaign?.id || 0);
			if (campaignId > 0) {
				const conflict = await strapi.db.query(ADMISSION_APPLICATION_UID).findOne({
					where: mergeTenantWhere({
						$and: [
							{
								id: { $ne: Number(existing.id) },
								studentCode: { $eq: studentCode },
								campaign: {
									id: {
										$eq: campaignId,
									},
								},
							},
							buildActiveAdmissionWhere(),
						],
					}, tenantId),
					select: ['id', 'applicationCode'],
				});

				if (conflict?.id) {
					return ctx.conflict(`Đã tồn tại hồ sơ khác cùng mã học sinh trong kỳ tuyển sinh này${conflict?.applicationCode ? ` (${conflict.applicationCode})` : ''}`);
				}
			}

			const persisted = await persistAdmissionFormDataFilesFromForm(nextFormDataSource as Record<string, unknown>, {
				tenantId,
				tenantCode: toText(ctx.state?.tenant?.code || ctx.state?.tenantCode || ''),
				campaignCode: toText(existing?.campaign?.code || ''),
				applicationKey: toText(existing?.applicationCode || existing?.id),
				applicationId: Number(existing?.id || 0) || undefined,
				uploadedBy: userId,
			});
			cleanupTargets.push(...persisted.cleanupTargets);

			const persistedFormData = persisted.formData;
			const studentName = toRequiredText(body.studentName ?? extractFormFieldValue(persistedFormData, 'studentName') ?? existing.studentName, 'studentName');
			const dob = toRequiredDate(body.dob ?? extractFormFieldValue(persistedFormData, 'dob') ?? existing.dob, 'dob');
			const gender = toNullableGender(body.gender ?? extractFormFieldValue(persistedFormData, 'gender') ?? existing.gender);
			const currentSchool = toNullableText(body.currentSchool ?? extractFormFieldValue(persistedFormData, 'currentSchool') ?? existing.currentSchool);
			const address = toNullableText(body.address ?? extractFormFieldValue(persistedFormData, 'address') ?? existing.address);

			await strapi.entityService.update(ADMISSION_APPLICATION_UID, Number(existing.id), {
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
							...existing,
							studentCode,
							studentName,
							dob,
							gender,
							currentSchool,
							address,
							formData: persistedFormData,
							formTemplateVersion: Number(existing?.campaign?.formTemplateVersion || existing?.campaign?.formTemplate?.version || existing?.formTemplateVersion || 0),
						},
						campaign: existing?.campaign,
						parent: existing?.parent,
					}),
					formTemplateVersion: Number(existing?.campaign?.formTemplateVersion || existing?.campaign?.formTemplate?.version || existing?.formTemplateVersion || 0),
				} as any,
			});

			await syncAdmissionFormFileAssetsEntityId(persisted.fileAssetIds, Number(existing.id));
			await markRemovedAdmissionFormFileAssetsDeleted(existing?.formData, persistedFormData);

			await createReviewActivity(Number(existing.id), tenantId, {
				actorUserId: userId,
				actorType: 'SCHOOL',
				actionType: 'APPLICATION_UPDATED',
				ipAddress: resolveRequestIp(ctx),
				userAgent: resolveRequestUserAgent(ctx),
				metadata: {
					source: 'review-update-application',
					studentCode,
					hasFormDataUpdate: true,
				},
			});

			const updated = await getReviewApplicationDetail(ctx.params?.id, tenantId, { includeDeleted: true });
			ctx.body = { success: true, data: normalizeApplication(updated) };
		} catch (error: any) {
			if (cleanupTargets.length > 0) {
				await removePersistedAdmissionFilesFromForm(cleanupTargets);
			}
			if (error?.status === 400) return ctx.badRequest(error.message);
			if (error?.status === 401) return ctx.unauthorized(error.message);
			if (error?.status === 403) return ctx.forbidden(error.message);
			if (error?.status === 404) return ctx.notFound(error.message);
			if (error?.status === 409) return ctx.conflict(error.message);
			strapi.log.error('[admission-application.reviewUpdateApplication] unexpected error', error);
			return ctx.internalServerError('Failed to update admission application');
		}
	},

	async reviewUpdateReturnedNote(ctx) {
		const authUser = await resolveAuthenticatedUser(ctx);
		const userId = Number(authUser?.id || 0);
		if (!Number.isInteger(userId) || userId <= 0) {
			return ctx.unauthorized('Unauthorized');
		}

		if (authUser?.blocked) {
			return ctx.unauthorized('Account is blocked');
		}

		try {
			const row = await updateReturnedApplicationReviewNote(
				ctx.params?.id,
				extractPayload(ctx)?.reviewNote,
				userId,
				resolveCurrentTenantId(ctx),
			);
			ctx.body = { success: true, data: normalizeApplication(row) };
		} catch (error: any) {
			if (error?.status === 400) return ctx.badRequest(error.message);
			if (error?.status === 401) return ctx.unauthorized(error.message);
			if (error?.status === 403) return ctx.forbidden(error.message);
			if (error?.status === 404) return ctx.notFound(error.message);
			if (error?.status === 409) return ctx.conflict(error.message);
			strapi.log.error('[admission-application.reviewUpdateReturnedNote] unexpected error', error);
			return ctx.internalServerError('Failed to update returned application review note');
		}
	},

	async reviewResetToDraft(ctx) {
		const authUser = await resolveAuthenticatedUser(ctx);
		const userId = Number(authUser?.id || 0);
		if (!Number.isInteger(userId) || userId <= 0) {
			return ctx.unauthorized('Unauthorized');
		}

		if (authUser?.blocked) {
			return ctx.unauthorized('Account is blocked');
		}

		try {
			const row = await resetReviewApplicationToDraft(
				ctx.params?.id,
				userId,
				resolveCurrentTenantId(ctx),
			);
			ctx.body = { success: true, data: normalizeApplication(row) };
		} catch (error: any) {
			if (error?.status === 400) return ctx.badRequest(error.message);
			if (error?.status === 401) return ctx.unauthorized(error.message);
			if (error?.status === 403) return ctx.forbidden(error.message);
			if (error?.status === 404) return ctx.notFound(error.message);
			if (error?.status === 409) return ctx.conflict(error.message);
			strapi.log.error('[admission-application.reviewResetToDraft] unexpected error', error);
			return ctx.internalServerError('Failed to reset admission application to draft');
		}
	},

	async reviewSendApprovalReminder(ctx) {
		const authUser = await resolveAuthenticatedUser(ctx);
		const userId = Number(authUser?.id || 0);
		if (!Number.isInteger(userId) || userId <= 0) {
			return ctx.unauthorized('Unauthorized');
		}

		if (authUser?.blocked) {
			return ctx.unauthorized('Account is blocked');
		}

		try {
			const updated = await sendAdmissionApprovalReminder(
				ctx.params?.id,
				userId,
				resolveCurrentTenantId(ctx),
			);
			ctx.body = { success: true, data: normalizeApplication(updated) };
		} catch (error: any) {
			if (error?.status === 400) return ctx.badRequest(error.message);
			if (error?.status === 401) return ctx.unauthorized(error.message);
			if (error?.status === 403) return ctx.forbidden(error.message);
			if (error?.status === 404) return ctx.notFound(error.message);
			if (error?.status === 409) return ctx.conflict(error.message);
			strapi.log.error('[admission-application.reviewSendApprovalReminder] unexpected error', error);
			return ctx.internalServerError('Failed to send approval reminder');
		}
	},
}));