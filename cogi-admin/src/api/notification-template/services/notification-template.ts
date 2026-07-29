import { errors } from '@strapi/utils';
import { factories } from '@strapi/strapi';

import { enqueueMail } from '../../../services/mail-queue';
import { extractRelationRef, mergeTenantWhere, toText, whereByParam } from '../../../utils/tenant-scope';

const NOTIFICATION_TEMPLATE_UID = 'api::notification-template.notification-template';
const NOTIFICATION_SERVICE_UID = 'api::notification.notification';
const SUMMARY_FIELDS = ['id', 'documentId', 'code', 'name', 'subject', 'type', 'isActive', 'variables'];
const CONTENT_FIELDS = [...SUMMARY_FIELDS, 'content'];

function normalizeCode(value: unknown): string {
	return toText(value).toLowerCase();
}

function normalizeTemplateType(value: unknown): string {
	return normalizeCode(value) || 'email';
}

function normalizeVariableKeys(value: unknown): string[] {
	if (Array.isArray(value)) {
		return value.map((item) => normalizeCode(item)).filter(Boolean);
	}

	if (value && typeof value === 'object') {
		return Object.keys(value as Record<string, unknown>).map((item) => normalizeCode(item)).filter(Boolean);
	}

	return [];
}

function collectMissingVariables(data: Record<string, unknown>, requiredVariables: string[]) {
	return requiredVariables.filter((key) => {
		const value = data?.[key];
		if (value === null || value === undefined) return true;
		if (typeof value === 'number') return !Number.isFinite(value);
		if (typeof value === 'boolean') return false;
		return !toText(value);
	});
}

function hasAtLeastOneMatch(values: string[], candidates: string[]) {
	if (candidates.length === 0) return true;
	return candidates.some((candidate) => values.includes(candidate));
}

function normalizeRecommendedCodes(values: unknown): string[] {
	return Array.isArray(values)
		? values.map((item) => normalizeCode(item)).filter(Boolean)
		: [];
}

function normalizeRequiredVariables(values: unknown): string[] {
	return Array.isArray(values)
		? values.map((item) => toText(item)).filter(Boolean)
		: [];
}

function normalizeRequiredVariablesForCompatibility(values: unknown): string[] {
	return Array.isArray(values)
		? values.map((item) => normalizeCode(item)).filter(Boolean)
		: [];
}

function matchesCompatibility(template: any, options: Record<string, unknown> = {}) {
	const recommendedCodes = normalizeRecommendedCodes(options.recommendedCodes);
	const requiredVariables = normalizeRequiredVariablesForCompatibility(options.requiredVariables);
	if (recommendedCodes.length === 0 && requiredVariables.length === 0) {
		return true;
	}

	const templateCode = normalizeCode(template?.code);
	const codeMatches = recommendedCodes.length > 0
		? recommendedCodes.some((candidate) => templateCode === candidate || templateCode.includes(candidate))
		: false;
	const variableKeys = normalizeVariableKeys(template?.variables);
	const variableMatches = requiredVariables.length > 0
		? hasAtLeastOneMatch(variableKeys, requiredVariables)
		: false;

	return codeMatches || variableMatches;
}

function toTemplateSummary(template: any, extras: Record<string, unknown> = {}) {
	if (!template?.id) return null;
	return {
		id: template.id,
		documentId: template.documentId || null,
		code: toText(template.code) || null,
		name: toText(template.name) || null,
		subject: toText(template.subject) || null,
		type: normalizeTemplateType(template.type),
		isActive: template.isActive !== false,
		variables: template.variables ?? null,
		tenant: template.tenant
			? {
					id: template.tenant.id,
					name: toText(template.tenant.name) || null,
					code: toText(template.tenant.code) || null,
				}
			: null,
		...extras,
	};
}

export default factories.createCoreService(NOTIFICATION_TEMPLATE_UID, () => ({
	toTemplateSummary(template: any, extras: Record<string, unknown> = {}) {
		return toTemplateSummary(template, extras);
	},

	matchesCompatibility(template: any, options: Record<string, unknown> = {}) {
		return matchesCompatibility(template, options);
	},

	async findTenantTemplateByRef(tenantId: number | string, templateRef: unknown, options: Record<string, unknown> = {}) {
		const relationRef = extractRelationRef(templateRef);
		const whereRef = whereByParam(relationRef);
		if (!whereRef) return null;

		const select = options.selectContent === true ? CONTENT_FIELDS : SUMMARY_FIELDS;
		const populate = options.includeTenant === true
			? { tenant: { select: ['id', 'name', 'code'] } }
			: undefined;

		return strapi.db.query(NOTIFICATION_TEMPLATE_UID).findOne({
			where: mergeTenantWhere({ ...whereRef }, tenantId),
			select,
			populate,
		});
	},

	async findActiveTenantTemplateByCode(tenantId: number | string, templateCode: unknown, options: Record<string, unknown> = {}) {
		const code = normalizeCode(templateCode);
		if (!code) return null;

		const select = options.selectContent === true ? CONTENT_FIELDS : SUMMARY_FIELDS;
		const populate = options.includeTenant === true
			? { tenant: { select: ['id', 'name', 'code'] } }
			: undefined;

		return strapi.db.query(NOTIFICATION_TEMPLATE_UID).findOne({
			where: mergeTenantWhere({
				code: { $eqi: code },
				isActive: true,
				type: 'email',
			}, tenantId),
			select,
			populate,
		});
	},

	async listTenantEmailTemplates(tenantId: number | string, options: Record<string, unknown> = {}) {
		const q = normalizeCode(options.q);
		const activeOnly = options.activeOnly !== false;
		const compatibleOnly = options.compatibleOnly !== false;

		const whereClauses: Array<Record<string, unknown>> = [{ type: 'email' }];
		if (activeOnly) whereClauses.push({ isActive: true });
		if (q) {
			whereClauses.push({
				$or: [
					{ code: { $containsi: q } },
					{ name: { $containsi: q } },
					{ subject: { $containsi: q } },
				],
			});
		}

		const rows = await strapi.db.query(NOTIFICATION_TEMPLATE_UID).findMany({
			where: mergeTenantWhere({ $and: whereClauses }, tenantId),
			select: SUMMARY_FIELDS,
			orderBy: [{ code: 'asc' }, { name: 'asc' }, { id: 'desc' }],
		});

		const filtered = compatibleOnly
			? (rows || []).filter((item: any) => matchesCompatibility(item, options))
			: (rows || []);

		return filtered.map((item: any) => toTemplateSummary(item, {
			isCompatible: matchesCompatibility(item, options),
		}));
	},

	async previewTemplate(templateRef: unknown, tenantId: number | string, data: Record<string, unknown> = {}) {
		const template = await this.findTenantTemplateByRef(tenantId, templateRef, { selectContent: true });
		if (!template?.id) {
			throw new errors.ApplicationError('Notification template not found', {
				code: 'NOTIFICATION_TEMPLATE_NOT_FOUND',
			});
		}

		const requiredVariables = normalizeRequiredVariables((data as any)?.requiredVariables);
		const payload = { ...data };
		delete (payload as any).requiredVariables;
		const missingVariables = collectMissingVariables(payload, requiredVariables);
		if (missingVariables.length > 0) {
			throw new errors.ApplicationError('Notification template variables are missing', {
				code: 'NOTIFICATION_TEMPLATE_VARIABLE_MISSING',
				missingVariables,
			});
		}

		const notificationService = strapi.service(NOTIFICATION_SERVICE_UID) as any;
		return {
			template: toTemplateSummary(template),
			subject: notificationService.replaceVariables(template.subject, payload),
			content: notificationService.replaceVariables(template.content, payload),
		};
	},

	async queueTemplateEmail(
		templateInput: unknown,
		tenantId: number | string,
		recipientEmail: unknown,
		data: Record<string, unknown> = {},
		options: Record<string, unknown> = {},
	) {
		const template = typeof templateInput === 'object' && templateInput && (templateInput as any).id
			? templateInput as any
			: await this.findTenantTemplateByRef(tenantId, templateInput, { selectContent: true });

		if (!template?.id) {
			throw new errors.ApplicationError('Notification template not found', {
				code: 'NOTIFICATION_TEMPLATE_NOT_FOUND',
			});
		}

		if (template.isActive === false) {
			throw new errors.ApplicationError('Notification template is inactive', {
				code: 'NOTIFICATION_TEMPLATE_INACTIVE',
			});
		}

		if (normalizeTemplateType(template.type) !== 'email') {
			throw new errors.ApplicationError('Notification template is not an email template', {
				code: 'NOTIFICATION_TEMPLATE_WRONG_TYPE',
			});
		}

		const toEmail = toText(recipientEmail).toLowerCase();
		if (!toEmail) {
			throw new errors.ApplicationError('Recipient email is required');
		}

		const requiredVariables = normalizeRequiredVariables(options.requiredVariables);
		const preview = await this.previewTemplate(template, tenantId, {
			...data,
			requiredVariables,
		});
		const mailType = normalizeCode(options.mailType) || normalizeCode(template.code) || 'notification_template_email';
		const metadata = options.metadata && typeof options.metadata === 'object' && !Array.isArray(options.metadata)
			? { ...(options.metadata as Record<string, unknown>) }
			: {};

		const queued = await enqueueMail({
			tenantId,
			mailType,
			to: toEmail,
			subject: preview.subject,
			html: preview.content,
			metadata: {
				...metadata,
				templateId: template.id,
				templateCode: normalizeCode(template.code),
				templateName: toText(template.name) || null,
				tenantId,
			},
		});

		return {
			ok: true,
			template: toTemplateSummary(template),
			to: toEmail,
			subject: preview.subject,
			content: preview.content,
			mailLogId: queued.mailLogId || null,
			queueName: queued.queueName || null,
		};
	},

	async sendTestEmail(
		templateRef: unknown,
		tenantId: number | string,
		recipientEmail: unknown,
		data: Record<string, unknown> = {},
		metadata: Record<string, unknown> = {},
	) {
		return this.queueTemplateEmail(templateRef, tenantId, recipientEmail, data, {
			mailType: `test:${normalizeCode((data as any)?.mailType) || 'notification_template_email'}`,
			metadata: {
				...metadata,
				isTestSend: true,
			},
		});
	},
}));