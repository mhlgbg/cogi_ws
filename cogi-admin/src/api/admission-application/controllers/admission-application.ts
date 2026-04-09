/**
 * admission-application controller
 */

import { factories } from '@strapi/strapi';
import { mergeTenantWhere, resolveCurrentTenantId, toText } from '../../../utils/tenant-scope';
import {
	getEffectiveReviewStatus,
	getReviewApplicationDetail,
	listReviewApplications,
	reviewApplicationDecision,
} from '../services/admission-application';

const ADMISSION_APPLICATION_UID = 'api::admission-application.admission-application';
const CAMPAIGN_UID = 'api::campaign.campaign';
const USER_TENANT_UID = 'api::user-tenant.user-tenant';
const EDITABLE_STATUSES = new Set(['draft', 'rejected']);
type AdmissionGender = 'male' | 'female' | 'other';

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

async function generateApplicationCode() {
	for (let attempt = 0; attempt < 8; attempt += 1) {
		const candidate = `ADM-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
		const exists = await strapi.db.query(ADMISSION_APPLICATION_UID).findOne({
			where: { applicationCode: candidate },
			select: ['id'],
		});
		if (!exists?.id) return candidate;
	}

	return `ADM-${Date.now()}-${Math.floor(Math.random() * 100000)}`;
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
			id,
			parent: {
				id: {
					$eq: userId,
				},
			},
		}, tenantId),
		populate: {
			reviewedBy: {
				select: ['id', 'username', 'email', 'fullName'],
			},
			campaign: {
				select: ['id', 'name', 'code', 'campaignStatus', 'startDate', 'endDate', 'formTemplateVersion'],
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
		formTemplateVersion: Number(row.formTemplateVersion || 0),
		createdAt: row.createdAt || null,
		submittedAt: row.submittedAt || null,
		reviewedAt: row.reviewedAt || null,
		reviewNote: row.reviewNote || null,
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
				parent: {
					id: {
						$eq: userId,
					},
				},
			}, tenantId),
			select: ['id', 'applicationCode', 'admissionStatus', 'reviewStatus', 'studentName', 'dob', 'gender', 'currentSchool', 'address', 'formData', 'formTemplateVersion', 'createdAt', 'submittedAt', 'reviewedAt', 'reviewNote'],
			orderBy: [{ createdAt: 'desc' }],
			populate: {
				reviewedBy: {
					select: ['id', 'username', 'email', 'fullName'],
				},
				campaign: {
					select: ['id', 'name', 'code', 'campaignStatus', 'startDate', 'endDate', 'formTemplateVersion'],
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
			const data = {
				tenant: tenantId,
				campaign: campaign.id,
				parent: userId,
				applicationCode: await generateApplicationCode(),
				studentName: toRequiredText(body.studentName, 'studentName'),
				dob: toRequiredDate(body.dob, 'dob'),
				gender: toNullableGender(body.gender),
				currentSchool: toNullableText(body.currentSchool),
				address: toNullableText(body.address),
				formData: normalizeFormData(body.formData),
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
			const updated = await strapi.entityService.update(ADMISSION_APPLICATION_UID, existing.id, {
				data: {
					studentName: toRequiredText(body.studentName, 'studentName'),
					dob: toRequiredDate(body.dob, 'dob'),
					gender: toNullableGender(body.gender),
					currentSchool: toNullableText(body.currentSchool),
					address: toNullableText(body.address),
					formData: normalizeFormData(body.formData),
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
			const row = await getReviewApplicationDetail(ctx.params?.id, resolveCurrentTenantId(ctx));
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
}));