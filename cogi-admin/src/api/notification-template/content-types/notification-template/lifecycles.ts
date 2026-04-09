import { errors } from '@strapi/utils';

const NOTIFICATION_TEMPLATE_UID = 'api::notification-template.notification-template';

type RelationRef = string | number | null;
type GenericRecord = Record<string, unknown>;

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

  const candidates = [relation.connect, relation.set];
  for (const candidate of candidates) {
    if (Array.isArray(candidate) && candidate.length > 0) {
      const first = candidate[0] as { id?: string | number; documentId?: string } | string | number;
      if (typeof first === 'string' || typeof first === 'number') return first;
      if (first?.id !== undefined) return first.id;
      if (first?.documentId) return first.documentId;
    }

    if (candidate && typeof candidate === 'object') {
      const obj = candidate as { id?: string | number; documentId?: string };
      if (obj.id !== undefined) return obj.id;
      if (obj.documentId) return obj.documentId;
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

function hasOwn(data: GenericRecord, key: string) {
  return Object.prototype.hasOwnProperty.call(data, key);
}

function toText(value: unknown): string {
  if (value === null || value === undefined) return '';
  return String(value).trim();
}

async function loadExistingEntry(where: unknown) {
  const id = (where as { id?: string | number } | undefined)?.id;
  if (!id) return null;

  return strapi.db.query(NOTIFICATION_TEMPLATE_UID).findOne({
    where: { id },
    populate: { tenant: { select: ['id'] } },
  });
}

async function findTemplatesByTenantAndCode(tenantRef: string | number, code: string) {
  return strapi.db.query(NOTIFICATION_TEMPLATE_UID).findMany({
    where: {
      tenant: { id: { $eq: tenantRef } },
      code: { $eq: code },
    },
    populate: { tenant: { select: ['id'] } },
    select: ['id', 'code'],
  });
}

async function ensureNotificationTemplateValid(params: { data?: GenericRecord; where?: unknown }) {
  const data = params.data || {};
  const existing = await loadExistingEntry(params.where);

  const tenantRef = extractRelationRef(data.tenant) ?? extractEntryRelationRef(existing?.tenant);
  const code = hasOwn(data, 'code') ? toText(data.code).toLowerCase() : toText(existing?.code).toLowerCase();
  const name = hasOwn(data, 'name') ? toText(data.name) : toText(existing?.name);
  const subject = hasOwn(data, 'subject') ? toText(data.subject) : toText(existing?.subject);
  const content = hasOwn(data, 'content') ? toText(data.content) : toText(existing?.content);
  const type = hasOwn(data, 'type') ? toText(data.type).toLowerCase() : toText(existing?.type).toLowerCase();
  const isActive = hasOwn(data, 'isActive') ? Boolean(data.isActive) : Boolean(existing?.isActive ?? true);

  if (!tenantRef) {
    throw new errors.ApplicationError('tenant is required');
  }

  if (!code) {
    throw new errors.ApplicationError('code is required');
  }

  if (!name) {
    throw new errors.ApplicationError('name is required');
  }

  if (!subject) {
    throw new errors.ApplicationError('subject is required');
  }

  if (!content) {
    throw new errors.ApplicationError('content is required');
  }

  const siblings = await findTemplatesByTenantAndCode(tenantRef, code);
  const ignoreId = existing?.id ? String(existing.id) : null;
  const duplicate = (siblings || []).find((item: any) => !ignoreId || String(item?.id) !== ignoreId);

  if (duplicate) {
    throw new errors.ApplicationError('tenant + code must be unique');
  }

  data.code = code;
  data.name = name;
  data.subject = subject;
  data.content = content;
  data.type = ['email', 'sms', 'ui'].includes(type) ? type : 'email';
  data.isActive = isActive;
}

export default {
  async beforeCreate(event: any) {
    await ensureNotificationTemplateValid({ data: event.params?.data });
  },

  async beforeUpdate(event: any) {
    await ensureNotificationTemplateValid({ data: event.params?.data, where: event.params?.where });
  },
};