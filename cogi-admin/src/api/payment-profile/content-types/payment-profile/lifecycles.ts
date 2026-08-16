import { errors } from '@strapi/utils';
import { extractRelationRef, hasOwn, toText } from '../../../../utils/tenant-scope';

const PAYMENT_PROFILE_UID = 'api::payment-profile.payment-profile';

type GenericRecord = Record<string, unknown>;

function getRequestContextTenantId(): number | string | null {
  const requestContext = strapi.requestContext?.get?.();
  const tenantId = requestContext?.state?.tenantId ?? requestContext?.state?.tenant?.id;
  if (tenantId === null || tenantId === undefined || tenantId === '') return null;
  return tenantId;
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

function normalizeEmail(value: unknown): string | null {
  const text = toText(value).toLowerCase();
  if (!text) return null;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(text)) {
    throw new errors.ApplicationError('supportEmail is invalid');
  }
  return text;
}

function normalizeOptionalString(value: unknown, maxLength?: number): string | null {
  const text = toText(value);
  if (!text) return null;
  if (maxLength && text.length > maxLength) {
    throw new errors.ApplicationError(`text exceeds max length ${maxLength}`);
  }
  return text;
}

function normalizeRequiredString(value: unknown, fieldName: string, maxLength?: number): string {
  const text = toText(value);
  if (!text) throw new errors.ApplicationError(`${fieldName} is required`);
  if (maxLength && text.length > maxLength) {
    throw new errors.ApplicationError(`${fieldName} exceeds max length ${maxLength}`);
  }
  return text;
}

function normalizePaymentMethod(value: unknown): 'bank_transfer' | 'cash' | 'other' {
  const normalized = toText(value).toLowerCase();
  if (normalized === 'cash' || normalized === 'other') return normalized;
  return 'bank_transfer';
}

function normalizeSortOrder(value: unknown): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new errors.ApplicationError('sortOrder must be a non-negative integer');
  }
  return Math.floor(parsed);
}

async function loadExistingProfile(where: unknown) {
  const normalizedWhere = typeof where === 'object' && where !== null
    ? Object.fromEntries(
        Object.entries(where as Record<string, unknown>).filter(
          ([key, value]) => !(key === 'locale' && (value === '' || value === null)),
        ),
      )
    : where;

  if (!normalizedWhere) return null;

  return strapi.db.query(PAYMENT_PROFILE_UID).findOne({
    where: normalizedWhere,
    populate: {
      tenant: { select: ['id', 'documentId'] },
    },
  });
}

async function findProfilesByTenantAndCode(tenantRef: string | number, code: string) {
  return strapi.db.query(PAYMENT_PROFILE_UID).findMany({
    where: {
      tenant: { id: { $eq: tenantRef } },
      code: { $eq: code },
    },
    select: ['id', 'code'],
  });
}

async function findDefaultProfilesByTenant(tenantRef: string | number) {
  return strapi.db.query(PAYMENT_PROFILE_UID).findMany({
    where: {
      tenant: { id: { $eq: tenantRef } },
      isDefault: true,
    },
    select: ['id'],
  });
}

async function ensurePaymentProfileValid(params: { data?: GenericRecord; where?: unknown }) {
  const data = (params.data || {}) as GenericRecord;
  const existing = await loadExistingProfile(params.where);
  const requestTenantId = getRequestContextTenantId();

  if ((data.tenant === null || data.tenant === undefined || data.tenant === '') && requestTenantId) {
    data.tenant = requestTenantId;
  }

  const tenantRef = extractRelationRef(data.tenant)
    || extractEntryRelationRef(existing?.tenant)
    || requestTenantId;
  const name = hasOwn(data, 'name') ? normalizeRequiredString(data.name, 'name', 150) : normalizeRequiredString(existing?.name, 'name', 150);
  const code = hasOwn(data, 'code') ? normalizeRequiredString(data.code, 'code', 100).toUpperCase() : normalizeRequiredString(existing?.code, 'code', 100).toUpperCase();
  const description = hasOwn(data, 'description') ? normalizeOptionalString(data.description) : normalizeOptionalString(existing?.description);
  const paymentMethod = hasOwn(data, 'paymentMethod') ? normalizePaymentMethod(data.paymentMethod) : normalizePaymentMethod(existing?.paymentMethod);
  const bankCode = hasOwn(data, 'bankCode') ? normalizeOptionalString(data.bankCode, 20)?.toUpperCase() || null : normalizeOptionalString(existing?.bankCode, 20)?.toUpperCase() || null;
  const bankName = hasOwn(data, 'bankName') ? normalizeOptionalString(data.bankName, 150) : normalizeOptionalString(existing?.bankName, 150);
  const accountNumber = hasOwn(data, 'accountNumber') ? normalizeOptionalString(data.accountNumber, 100) : normalizeOptionalString(existing?.accountNumber, 100);
  const accountHolder = hasOwn(data, 'accountHolder') ? normalizeOptionalString(data.accountHolder, 150) : normalizeOptionalString(existing?.accountHolder, 150);
  const bankBranch = hasOwn(data, 'bankBranch') ? normalizeOptionalString(data.bankBranch, 150) : normalizeOptionalString(existing?.bankBranch, 150);
  const currency = hasOwn(data, 'currency') ? normalizeRequiredString(data.currency, 'currency', 10).toUpperCase() : normalizeRequiredString(existing?.currency || 'VND', 'currency', 10).toUpperCase();
  const transferContentTemplate = hasOwn(data, 'transferContentTemplate') ? normalizeOptionalString(data.transferContentTemplate, 255) : normalizeOptionalString(existing?.transferContentTemplate, 255);
  const paymentInstruction = hasOwn(data, 'paymentInstruction') ? normalizeOptionalString(data.paymentInstruction) : normalizeOptionalString(existing?.paymentInstruction);
  const supportPhone = hasOwn(data, 'supportPhone') ? normalizeOptionalString(data.supportPhone, 30) : normalizeOptionalString(existing?.supportPhone, 30);
  const supportEmail = hasOwn(data, 'supportEmail') ? normalizeEmail(data.supportEmail) : normalizeEmail(existing?.supportEmail);
  const isActive = hasOwn(data, 'isActive') ? Boolean(data.isActive) : Boolean(existing?.isActive ?? true);
  const isDefault = hasOwn(data, 'isDefault') ? Boolean(data.isDefault) : Boolean(existing?.isDefault ?? false);
  const sortOrder = hasOwn(data, 'sortOrder') ? normalizeSortOrder(data.sortOrder) : normalizeSortOrder(existing?.sortOrder ?? 0);

  if (!tenantRef) {
    throw new errors.ApplicationError('tenant is required');
  }

  if (paymentMethod === 'bank_transfer') {
    if (!bankCode && !bankName) {
      throw new errors.ApplicationError('bankCode or bankName is required when paymentMethod=bank_transfer');
    }
    if (!accountNumber) {
      throw new errors.ApplicationError('accountNumber is required when paymentMethod=bank_transfer');
    }
    if (!accountHolder) {
      throw new errors.ApplicationError('accountHolder is required when paymentMethod=bank_transfer');
    }
  }

  const siblings = await findProfilesByTenantAndCode(tenantRef, code);
  const ignoreId = existing?.id ? String(existing.id) : null;
  const duplicate = (siblings || []).find((item: any) => !ignoreId || String(item?.id) !== ignoreId);
  if (duplicate) {
    throw new errors.ApplicationError('tenant + code must be unique');
  }

  if (isDefault) {
    const defaultSiblings = await findDefaultProfilesByTenant(tenantRef);
    const conflictingDefault = (defaultSiblings || []).find((item: any) => !ignoreId || String(item?.id) !== ignoreId);
    if (conflictingDefault) {
      throw new errors.ApplicationError('tenant can only have one default payment profile');
    }
  }

  data.tenant = tenantRef;
  data.name = name;
  data.code = code;
  data.description = description;
  data.paymentMethod = paymentMethod;
  data.bankCode = bankCode;
  data.bankName = bankName;
  data.accountNumber = accountNumber;
  data.accountHolder = accountHolder;
  data.bankBranch = bankBranch;
  data.currency = currency;
  data.transferContentTemplate = transferContentTemplate;
  data.paymentInstruction = paymentInstruction;
  data.supportPhone = supportPhone;
  data.supportEmail = supportEmail;
  data.isActive = isActive;
  data.isDefault = isDefault;
  data.sortOrder = sortOrder;
}

export default {
  async beforeCreate(event: any) {
    await ensurePaymentProfileValid({ data: event.params?.data });
  },

  async beforeUpdate(event: any) {
    await ensurePaymentProfileValid({ data: event.params?.data, where: event.params?.where });
  },
};