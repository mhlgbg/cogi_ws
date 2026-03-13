import { errors } from '@strapi/utils';

const REQUEST_UID = 'api::request.request';

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

export default {
  // Disallow creating new discussion after request is CLOSED/CANCELLED.
  async beforeCreate(event) {
    const data = (event.params?.data || {}) as Record<string, unknown>;
    const requestId = extractRelationId(data.request);

    if (!requestId) {
      throw new errors.ApplicationError('request is required');
    }

    const request = await strapi.db.query(REQUEST_UID).findOne({
      where: { id: requestId },
      select: ['id', 'request_status'],
    });

    if (!request) {
      throw new errors.ApplicationError('Request not found');
    }

    if (request.request_status === 'CLOSED' || request.request_status === 'CANCELLED') {
      const error = new errors.ApplicationError('Cannot create message for CLOSED/CANCELLED request') as Error & {
        status?: number;
      };
      error.status = 409;
      throw error;
    }
  },
};
