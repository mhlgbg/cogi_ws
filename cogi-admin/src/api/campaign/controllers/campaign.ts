/**
 * campaign controller
 */

import { factories } from '@strapi/strapi';
import { mergeTenantWhere, resolveCurrentTenantId, toText } from '../../../utils/tenant-scope';

const CAMPAIGN_UID = 'api::campaign.campaign';
const USER_TENANT_UID = 'api::user-tenant.user-tenant';

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

function readCampaignStatus(row: any) {
	return row?.campaignStatus || row?.status || 'draft';
}

function readFormTemplateStatus(row: any) {
	return row?.formTemplateStatus || row?.status || 'draft';
}

export default factories.createCoreController(CAMPAIGN_UID, () => ({
	async admissionList(ctx) {
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

		const status = toText(ctx.query?.status).toLowerCase() || 'open';
		const where = mergeTenantWhere({
			isActive: true,
			...(status ? { campaignStatus: status } : {}),
		}, tenantId);

		const rows = await strapi.db.query(CAMPAIGN_UID).findMany({
			where,
			select: ['id', 'name', 'code', 'year', 'grade', 'description', 'campaignStatus', 'startDate', 'endDate', 'createdAt'],
			populate: {
				formTemplate: {
					select: ['id', 'name', 'version', 'schema', 'formTemplateStatus', 'isLocked'],
				},
			},
			orderBy: [
				{ startDate: 'asc' },
				{ createdAt: 'desc' },
			],
		});

		ctx.body = {
			data: (rows || []).map((row) => ({
				id: row.id,
				name: row.name || '',
				code: row.code || '',
				year: Number(row.year || 0),
				grade: row.grade || '',
				description: row.description || '',
				campaignStatus: readCampaignStatus(row),
				status: readCampaignStatus(row),
				startDate: row.startDate || null,
				endDate: row.endDate || null,
				createdAt: row.createdAt || null,
				formTemplate: row.formTemplate
					? {
						id: row.formTemplate.id,
						name: row.formTemplate.name || '',
						version: Number(row.formTemplate.version || 0),
						formTemplateStatus: readFormTemplateStatus(row.formTemplate),
						status: readFormTemplateStatus(row.formTemplate),
						isLocked: row.formTemplate.isLocked === true,
						schema: row.formTemplate.schema ?? null,
					}
					: null,
			})),
		};
	},
}));