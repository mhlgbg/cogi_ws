import { errors } from '@strapi/utils';

const LEARNER_UID = 'api::learner.learner';

function toText(value: unknown) {
  if (value === null || value === undefined) return '';
  return String(value).trim();
}

function extractRelationRef(value: unknown): string | number | null {
  if (value === null || value === undefined) return null;

  if (typeof value === 'string' || typeof value === 'number') {
    return value;
  }

  if (typeof value !== 'object') return null;

  const relationValue = value as {
    id?: number | string;
    documentId?: string;
    connect?: Array<{ id?: number | string; documentId?: string } | number | string> | { id?: number | string; documentId?: string };
  };

  if (relationValue.id !== undefined) return relationValue.id;
  if (relationValue.documentId) return relationValue.documentId;

  const { connect } = relationValue;
  if (Array.isArray(connect) && connect.length > 0) {
    const first = connect[0] as { id?: number | string; documentId?: string } | number | string;
    if (typeof first === 'string' || typeof first === 'number') return first;
    if (first?.id !== undefined) return first.id;
    if (first?.documentId) return first.documentId;
  }

  if (connect && typeof connect === 'object') {
    const asObject = connect as { id?: number | string; documentId?: string };
    if (asObject.id !== undefined) return asObject.id;
    if (asObject.documentId) return asObject.documentId;
  }

  return null;
}

function extractEntryRelationRef(value: unknown): string | number | null {
  if (value === null || value === undefined) return null;
  if (typeof value === 'string' || typeof value === 'number') return value;
  if (typeof value !== 'object') return null;

  const relation = value as { id?: number | string; documentId?: string };
  if (relation.id !== undefined) return relation.id;
  if (relation.documentId) return relation.documentId;

  return null;
}

async function getExistingLearner(where: unknown) {
  const id = (where as { id?: number | string } | undefined)?.id;
  if (!id) return null;

  return strapi.db.query(LEARNER_UID).findOne({
    where: { id },
    populate: {
      tenant: { select: ['id'] },
    },
  });
}

async function ensureLearnerCodeUnique(params: { data?: Record<string, unknown>; where?: unknown }) {
  const data = params.data || {};
  const existing = await getExistingLearner(params.where);
  const code = toText(data.code ?? existing?.code);
  const oldUserId = toText(data.oldUserId ?? existing?.oldUserId);
  const fullName = toText(data.fullName ?? existing?.fullName);
  const tenantRef = extractRelationRef(data.tenant) || extractEntryRelationRef(existing?.tenant);

  if (!code) {
    throw new errors.ApplicationError('code is required');
  }

  if (!fullName) {
    throw new errors.ApplicationError('fullName is required');
  }

  if (!tenantRef) {
    throw new errors.ApplicationError('tenant is required');
  }

  data.code = code;
  if (Object.prototype.hasOwnProperty.call(data, 'oldUserId') || oldUserId) data.oldUserId = oldUserId || null;
  data.fullName = fullName;
  if (Object.prototype.hasOwnProperty.call(data, 'parentName')) data.parentName = toText(data.parentName) || null;
  if (Object.prototype.hasOwnProperty.call(data, 'parentPhone')) data.parentPhone = toText(data.parentPhone) || null;
  if (Object.prototype.hasOwnProperty.call(data, 'learnerStatus') || Object.prototype.hasOwnProperty.call(data, 'status')) {
    data.learnerStatus = toText(data.learnerStatus ?? data.status).toLowerCase() === 'inactive' ? 'inactive' : 'active';
  }

  const duplicate = await strapi.db.query(LEARNER_UID).findMany({
    where: {
      code: {
        $eqi: code,
      },
      tenant: {
        id: {
          $eq: tenantRef,
        },
      },
    },
    select: ['id'],
  });

  const existingId = (existing as { id?: number | string } | null)?.id;
  const hasDuplicate = (duplicate || []).some((item: any) => String(item?.id) !== String(existingId || ''));
  if (hasDuplicate) {
    throw new errors.ApplicationError('Learner code already exists in this tenant');
  }

  if (oldUserId) {
    const duplicateOldUserId = await strapi.db.query(LEARNER_UID).findMany({
      where: {
        oldUserId: {
          $eq: oldUserId,
        },
        tenant: {
          id: {
            $eq: tenantRef,
          },
        },
      },
      select: ['id'],
    });

    const hasOldUserIdDuplicate = (duplicateOldUserId || []).some((item: any) => String(item?.id) !== String(existingId || ''));
    if (hasOldUserIdDuplicate) {
      throw new errors.ApplicationError('Learner oldUserId already exists in this tenant');
    }
  }
}

export default {
  async beforeCreate(event: any) {
    await ensureLearnerCodeUnique({
      data: event.params?.data,
    });
  },

  async beforeUpdate(event: any) {
    await ensureLearnerCodeUnique({
      data: event.params?.data,
      where: event.params?.where,
    });
  },
};