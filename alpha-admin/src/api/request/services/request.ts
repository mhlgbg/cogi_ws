/**
 * request service
 */

import { factories } from '@strapi/strapi';

const REQUEST_UID = 'api::request.request';
const ASSIGNEE_UID = 'api::request-assignee.request-assignee';

type CloseDecision = 'APPROVED' | 'REJECTED';

type ClosePayload = {
	closedDecision: CloseDecision;
	amountApproved?: number | null;
	closeNote?: string;
};

function isPositiveInt(value: unknown): value is number {
	return Number.isInteger(value) && Number(value) > 0;
}

function toNumberOrNull(value: unknown): number | null {
	if (value === null || value === undefined || value === '') return null;
	const parsed = Number(value);
	return Number.isFinite(parsed) ? parsed : null;
}

export default factories.createCoreService(REQUEST_UID, () => ({
	async closeRequest(requestIdInput: unknown, currentUserIdInput: unknown, payload: ClosePayload) {
		const requestId = Number(requestIdInput);
		const currentUserId = Number(currentUserIdInput);

		if (!isPositiveInt(requestId)) {
			return {
				ok: false,
				status: 400,
				body: { message: 'Invalid request id' },
			};
		}

		if (!isPositiveInt(currentUserId)) {
			return {
				ok: false,
				status: 401,
				body: { message: 'Unauthorized' },
			};
		}

		const request = await strapi.db.query(REQUEST_UID).findOne({
			where: { id: requestId },
			populate: ['closedBy'],
		});

		if (!request) {
			return {
				ok: false,
				status: 404,
				body: { message: 'Request not found' },
			};
		}

		if (request.request_status === 'CLOSED' || request.request_status === 'CANCELLED') {
			return {
				ok: false,
				status: 409,
				body: {
					message: `Request already ${request.request_status}`,
					closedBy: request.closedBy || null,
					closedAt: request.closedAt || null,
					closedDecision: request.closedDecision || null,
				},
			};
		}

		const assigneeModel = strapi.getModel(ASSIGNEE_UID);
		const hasActiveFlag = Boolean(assigneeModel?.attributes?.isActive);
		const assigneeWhere: Record<string, unknown> = {
			request: requestId,
			user: currentUserId,
		};
		if (hasActiveFlag) {
			assigneeWhere.isActive = true;
		}

		const assignee = await strapi.db.query(ASSIGNEE_UID).findOne({ where: assigneeWhere });
		if (!assignee) {
			return {
				ok: false,
				status: 403,
				body: { message: 'User is not an assignee of this request' },
			};
		}

		const closedDecision = payload?.closedDecision;
		if (closedDecision !== 'APPROVED' && closedDecision !== 'REJECTED') {
			return {
				ok: false,
				status: 400,
				body: { message: 'closedDecision must be APPROVED or REJECTED' },
			};
		}

		let amountApproved: number | null = null;
		if (closedDecision === 'APPROVED') {
			amountApproved = toNumberOrNull(payload?.amountApproved);
			if (amountApproved === null || amountApproved < 0) {
				return {
					ok: false,
					status: 400,
					body: { message: 'amountApproved is required and must be >= 0 for APPROVED decision' },
				};
			}
		}

		const updateData: Record<string, unknown> = {
			request_status: 'CLOSED',
			closedDecision,
			closedBy: currentUserId,
			closedAt: new Date().toISOString(),
			closeNote: typeof payload?.closeNote === 'string' ? payload.closeNote : null,
			amountApproved: closedDecision === 'APPROVED' ? amountApproved : null,
		};

		await strapi.db.query(REQUEST_UID).update({
			where: { id: requestId },
			data: updateData,
		});

		const updated = await strapi.db.query(REQUEST_UID).findOne({
			where: { id: requestId },
			populate: ['requester', 'request_category', 'request_tags', 'closedBy', 'request_assignees.user', 'request_messages.author'],
		});

		return {
			ok: true,
			status: 200,
			body: {
				data: updated,
			},
		};
	},
}));
