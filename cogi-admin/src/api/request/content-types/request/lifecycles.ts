import { errors } from '@strapi/utils';

const REQUEST_UID = 'api::request.request';
const ASSIGNEE_UID = 'api::request-assignee.request-assignee';

const TERMINAL_STATUSES = new Set(['CLOSED', 'CANCELLED']);
const CLOSE_DECISIONS = new Set(['APPROVED', 'REJECTED']);

const BLOCKED_WHEN_TERMINAL = new Set([
  'title',
  'description',
  'request_category',
  'request_tags',
  'visibilityMode',
  'amountProposed',
  'amountApproved',
  'currency',
  'attachments',
  'watchers',
  'departmentContext',
  'request_assignees',
  'request_messages',
]);

function hasOwn(data: Record<string, unknown>, key: string) {
  return Object.prototype.hasOwnProperty.call(data, key);
}

function extractRelationId(value: unknown): number | null {
  if (value === null || value === undefined) return null;

  if (typeof value === 'number') {
    return Number.isInteger(value) ? value : null;
  }

  if (typeof value === 'string') {
    const parsed = Number(value);
    return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
  }

  if (typeof value !== 'object') return null;

  const relation = value as {
    id?: number | string;
    connect?: Array<{ id?: number | string } | number | string> | { id?: number | string };
  };

  if (relation.id !== undefined) {
    return extractRelationId(relation.id);
  }

  const connect = relation.connect;
  if (Array.isArray(connect) && connect.length > 0) {
    return extractRelationId(connect[0]);
  }

  if (connect && typeof connect === 'object') {
    return extractRelationId((connect as { id?: number | string }).id);
  }

  return null;
}

function toNumberOrNull(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return null;
  return parsed;
}

async function ensureClosedByIsAssignee(requestId: number, closedById: number) {
  const assigneeModel = strapi.getModel(ASSIGNEE_UID);
  const hasActiveFlag = Boolean(assigneeModel?.attributes?.isActive);

  const where: Record<string, unknown> = {
    request: requestId,
    user: closedById,
  };

  if (hasActiveFlag) {
    where.isActive = true;
  }

  const assignee = await strapi.db.query(ASSIGNEE_UID).findOne({ where });
  if (!assignee) {
    throw new errors.ApplicationError('closedBy must be an active assignee of this request');
  }
}

export default {
  // Enforce business rules for all update paths (custom API + Admin panel)
  async beforeUpdate(event) {
    const params = event.params || {};
    const data = (params.data || {}) as Record<string, unknown>;

    if (Object.keys(data).length === 0) return;

    const existing = await strapi.db.query(REQUEST_UID).findOne({
      where: params.where,
      populate: ['closedBy'],
    });

    if (!existing) return;

    const currentStatus = existing.request_status as string | undefined;

    // Once terminal, lock business fields.
    if (currentStatus && TERMINAL_STATUSES.has(currentStatus)) {
      const hasBlockedChange = Array.from(BLOCKED_WHEN_TERMINAL).some((field) => hasOwn(data, field));
      if (hasBlockedChange) {
        throw new errors.ApplicationError(`Request is ${currentStatus} and can no longer be edited`);
      }

      // V1: CLOSED cannot be reopened.
      if (currentStatus === 'CLOSED' && hasOwn(data, 'request_status') && data.request_status !== 'CLOSED') {
        throw new errors.ApplicationError('Request is CLOSED and cannot be reopened in V1');
      }
    }

    const hasStatusUpdate = hasOwn(data, 'request_status');
    const nextStatus = hasStatusUpdate ? String(data.request_status || '') : currentStatus;

    // Validate transition to CLOSED.
    if (nextStatus === 'CLOSED' && currentStatus !== 'CLOSED') {
      const resolvedDecision = (data.closedDecision ?? existing.closedDecision) as string | undefined;
      if (!resolvedDecision || !CLOSE_DECISIONS.has(resolvedDecision)) {
        throw new errors.ApplicationError('closedDecision is required when closing a request');
      }

      const closedById = extractRelationId(data.closedBy) ?? extractRelationId(existing.closedBy);
      if (!closedById) {
        throw new errors.ApplicationError('closedBy is required when closing a request');
      }

      await ensureClosedByIsAssignee(Number(existing.id), closedById);

      if (!hasOwn(data, 'closedBy')) {
        data.closedBy = closedById;
      }

      if (!hasOwn(data, 'closedDecision')) {
        data.closedDecision = resolvedDecision;
      }

      if (!existing.closedAt && !hasOwn(data, 'closedAt')) {
        data.closedAt = new Date().toISOString();
      }

      if (resolvedDecision === 'APPROVED') {
        const approvedAmount = toNumberOrNull(hasOwn(data, 'amountApproved') ? data.amountApproved : existing.amountApproved);
        if (approvedAmount === null || approvedAmount < 0) {
          throw new errors.ApplicationError('amountApproved is required and must be >= 0 when closedDecision is APPROVED');
        }
      }

      if (resolvedDecision === 'REJECTED') {
        data.amountApproved = null;
      }
    }
  },
};
