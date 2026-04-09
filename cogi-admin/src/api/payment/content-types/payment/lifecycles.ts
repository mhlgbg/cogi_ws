import { errors } from '@strapi/utils';

const PAYMENT_UID = 'api::payment.payment';
const LEARNER_UID = 'api::learner.learner';
const PAYMENT_ALLOCATION_UID = 'api::payment-allocation.payment-allocation';

function toText(value: unknown) {
  if (value === null || value === undefined) return '';
  return String(value).trim();
}

function extractRelationRef(value: unknown): string | number | null {
  if (value === null || value === undefined) return null;
  if (typeof value === 'string' || typeof value === 'number') return value;
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

function toDecimal(value: unknown, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function toDateTime(value: unknown) {
  const text = toText(value);
  if (!text) return null;
  const date = new Date(text);
  if (Number.isNaN(date.getTime())) {
    throw new errors.ApplicationError('Invalid paymentDate value');
  }
  return date.toISOString();
}

async function getExistingPayment(where: unknown) {
  const id = (where as { id?: number | string } | undefined)?.id;
  if (!id) return null;

  return strapi.db.query(PAYMENT_UID).findOne({
    where: { id },
    populate: {
      learner: { populate: { tenant: { select: ['id'] } } },
      tenant: { select: ['id'] },
    },
  });
}

async function getPaymentAllocationSum(paymentId: string | number, excludeId?: string | number | null) {
  const rows = await strapi.db.query(PAYMENT_ALLOCATION_UID).findMany({
    where: excludeId
      ? {
          payment: { id: { $eq: paymentId } },
          id: { $ne: excludeId },
        }
      : {
          payment: { id: { $eq: paymentId } },
        },
    select: ['amount'],
  });

  return (rows || []).reduce((sum: number, item: any) => sum + toDecimal(item?.amount, 0), 0);
}

async function ensurePaymentValid(params: { data?: Record<string, unknown>; where?: unknown }) {
  const data = params.data || {};
  const existing = await getExistingPayment(params.where);

  const learnerRef = extractRelationRef(data.learner) || extractEntryRelationRef(existing?.learner);
  const tenantRef = extractRelationRef(data.tenant) || extractEntryRelationRef(existing?.tenant) || extractEntryRelationRef(existing?.learner?.tenant);
  const amount = toDecimal(data.amount ?? existing?.amount, NaN);
  const paymentDate = toDateTime(data.paymentDate ?? existing?.paymentDate);

  if (!learnerRef) throw new errors.ApplicationError('learner is required');
  if (!tenantRef) throw new errors.ApplicationError('tenant is required');
  if (!Number.isFinite(amount) || amount <= 0) throw new errors.ApplicationError('amount must be greater than 0');
  if (!paymentDate) throw new errors.ApplicationError('paymentDate is required');

  const learner = await strapi.db.query(LEARNER_UID).findOne({
    where: { id: learnerRef },
    populate: { tenant: { select: ['id'] } },
  });

  if (!learner?.id) throw new errors.ApplicationError('learner is invalid');

  const learnerTenantRef = extractEntryRelationRef(learner?.tenant);
  if (String(learnerTenantRef || '') !== String(tenantRef)) {
    throw new errors.ApplicationError('learner does not belong to the selected tenant');
  }

  const existingId = (existing as { id?: number | string } | null)?.id;
  if (existingId) {
    const allocationSum = await getPaymentAllocationSum(existingId);
    if (allocationSum > amount + 0.000001) {
      throw new errors.ApplicationError('payment amount cannot be less than its allocated total');
    }
  }

  data.amount = amount;
  data.paymentDate = paymentDate;
  if (Object.prototype.hasOwnProperty.call(data, 'note')) data.note = toText(data.note) || null;
  if (Object.prototype.hasOwnProperty.call(data, 'method')) {
    const method = toText(data.method).toLowerCase();
    data.method = ['transfer', 'other'].includes(method) ? method : 'cash';
  }
}

export default {
  async beforeCreate(event: any) {
    await ensurePaymentValid({ data: event.params?.data });
  },

  async beforeUpdate(event: any) {
    await ensurePaymentValid({ data: event.params?.data, where: event.params?.where });
  },
};