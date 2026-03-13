import { errors } from '@strapi/utils';

const ROLE_FEATURE_UID = 'api::role-feature.role-feature';

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

async function ensureUniqueRoleFeature(params: { data?: Record<string, unknown>; ignoreId?: number | string }) {
  const roleRef = extractRelationRef(params.data?.role);
  const featureRef = extractRelationRef(params.data?.feature);

  if (!roleRef || !featureRef) return;

  const existingMappings = await strapi.db.query(ROLE_FEATURE_UID).findMany({
    populate: ['role', 'feature'],
  });

  const foundDuplicate = (existingMappings || []).find((item: any) => {
    if (params.ignoreId && String(item?.id) === String(params.ignoreId)) {
      return false;
    }

    const existingRoleRef = extractEntryRelationRef(item?.role);
    const existingFeatureRef = extractEntryRelationRef(item?.feature);

    return String(existingRoleRef) === String(roleRef) && String(existingFeatureRef) === String(featureRef);
  });

  if (foundDuplicate) {
    throw new errors.ApplicationError('Role-feature mapping already exists');
  }
}

export default {
  async beforeCreate(event) {
    await ensureUniqueRoleFeature({
      data: event.params?.data,
    });
  },

  async beforeUpdate(event) {
    const whereId = (event.params?.where as { id?: number | string } | undefined)?.id;

    await ensureUniqueRoleFeature({
      data: event.params?.data,
      ignoreId: whereId,
    });
  },
};
