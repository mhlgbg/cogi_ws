import { errors } from '@strapi/utils';

const CAMPAIGN_UID = 'api::campaign.campaign';
const FORM_TEMPLATE_UID = 'api::form-template.form-template';

type RelationRef = string | number | null;

function extractRelationRef(value: unknown): RelationRef {
  if (value === null || value === undefined) return null;
  if (typeof value === 'string' || typeof value === 'number') return value;
  if (typeof value !== 'object') return null;

  const relation = value as {
    id?: string | number;
    documentId?: string;
    connect?: Array<{ id?: string | number; documentId?: string } | string | number> | { id?: string | number; documentId?: string };
    set?: Array<{ id?: string | number; documentId?: string } | string | number> | { id?: string | number; documentId?: string };
  };

  if (relation.id !== undefined) return relation.id;
  if (relation.documentId) return relation.documentId;

  for (const candidate of [relation.connect, relation.set]) {
    if (Array.isArray(candidate) && candidate.length > 0) {
      const first = candidate[0] as { id?: string | number; documentId?: string } | string | number;
      if (typeof first === 'string' || typeof first === 'number') return first;
      if (first?.id !== undefined) return first.id;
      if (first?.documentId) return first.documentId;
    }

    if (candidate && typeof candidate === 'object') {
      const item = candidate as { id?: string | number; documentId?: string };
      if (item.id !== undefined) return item.id;
      if (item.documentId) return item.documentId;
    }
  }

  return null;
}

function extractEntryRelationRef(value: unknown): RelationRef {
  if (value === null || value === undefined) return null;
  if (typeof value === 'string' || typeof value === 'number') return value;
  if (typeof value !== 'object') return null;

  const relation = value as { id?: string | number; documentId?: string };
  if (relation.id !== undefined) return relation.id;
  if (relation.documentId) return relation.documentId;
  return null;
}

async function loadExistingEntry(where: unknown) {
  const id = (where as { id?: string | number } | undefined)?.id;
  if (!id) return null;

  return strapi.db.query(CAMPAIGN_UID).findOne({
    where: { id },
    populate: { formTemplate: { select: ['id', 'version'] } },
  });
}

async function syncFormTemplateVersion(params: { data?: Record<string, unknown>; where?: unknown }) {
  const data = params.data || {};
  const existing = await loadExistingEntry(params.where);
  const formTemplateRef = extractRelationRef(data.formTemplate) ?? extractEntryRelationRef(existing?.formTemplate);

  if (!formTemplateRef) {
    throw new errors.ApplicationError('formTemplate is required');
  }

  const formTemplate = await strapi.db.query(FORM_TEMPLATE_UID).findOne({
    where: { id: formTemplateRef },
    select: ['id', 'version'],
  });

  if (!formTemplate?.id) {
    throw new errors.ApplicationError('formTemplate is invalid');
  }

  data.formTemplateVersion = Number(formTemplate.version || 0);
}

export default {
  async beforeCreate(event: any) {
    await syncFormTemplateVersion({ data: event.params?.data });
  },

  async beforeUpdate(event: any) {
    await syncFormTemplateVersion({ data: event.params?.data, where: event.params?.where });
  },
};