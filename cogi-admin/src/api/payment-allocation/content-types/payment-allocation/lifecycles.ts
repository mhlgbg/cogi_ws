import { errors } from '@strapi/utils';

const PAYMENT_ALLOCATION_UID = 'api::payment-allocation.payment-allocation';
const PAYMENT_UID = 'api::payment.payment';
const FEE_ITEM_UID = 'api::fee-item.fee-item';

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

function roundMoney(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function computeFeeItemStatus(amount: number, paidAmount: number) {
  if (paidAmount <= 0) return 'unpaid';
  if (paidAmount < amount) return 'partial';
  return 'paid';
}

async function getExistingAllocation(where: unknown) {
  const id = (where as { id?: number | string } | undefined)?.id;
  if (!id) return null;

  return strapi.db.query(PAYMENT_ALLOCATION_UID).findOne({
    where: { id },
    populate: {
      payment: { populate: { tenant: { select: ['id'] }, learner: { select: ['id'] } } },
      feeItem: { populate: { tenant: { select: ['id'] }, learner: { select: ['id'] } } },
      tenant: { select: ['id'] },
    },
  });
}

async function getPaymentAllocationSum(paymentId: string | number, excludeId?: string | number | null) {
  const rows = await strapi.db.query(PAYMENT_ALLOCATION_UID).findMany({
    where: excludeId
      ? { payment: { id: { $eq: paymentId } }, id: { $ne: excludeId } }
      : { payment: { id: { $eq: paymentId } } },
    select: ['amount'],
  });

  return (rows || []).reduce((sum: number, item: any) => sum + toDecimal(item?.amount, 0), 0);
}

async function applyFeeItemPaidAmount(feeItemId: string | number, delta: number) {
  const feeItem = await strapi.db.query(FEE_ITEM_UID).findOne({
    where: { id: feeItemId },
    select: ['id', 'amount', 'paidAmount'],
  });

  if (!feeItem?.id) {
    throw new errors.ApplicationError('feeItem is invalid');
  }

  const nextPaidAmount = roundMoney(Math.max(0, toDecimal(feeItem.paidAmount, 0) + delta));
  const itemAmount = Math.max(0, toDecimal(feeItem.amount, 0));

  await strapi.db.query(FEE_ITEM_UID).update({
    where: { id: feeItem.id },
    data: {
      paidAmount: nextPaidAmount,
      status: computeFeeItemStatus(itemAmount, nextPaidAmount),
    },
  });
}

async function ensureAllocationValid(params: { data?: Record<string, unknown>; where?: unknown; state?: Record<string, unknown> }) {
  const data = params.data || {};
  const existing = await getExistingAllocation(params.where);

  const paymentRef = extractRelationRef(data.payment) || extractEntryRelationRef(existing?.payment);
  const feeItemRef = extractRelationRef(data.feeItem) || extractEntryRelationRef(existing?.feeItem);
  const tenantRef = extractRelationRef(data.tenant) || extractEntryRelationRef(existing?.tenant) || extractEntryRelationRef(existing?.payment?.tenant);
  const amount = roundMoney(toDecimal(data.amount ?? existing?.amount, NaN));

  if (!paymentRef) throw new errors.ApplicationError('payment is required');
  if (!feeItemRef) throw new errors.ApplicationError('feeItem is required');
  if (!tenantRef) throw new errors.ApplicationError('tenant is required');
  if (!Number.isFinite(amount) || amount <= 0) throw new errors.ApplicationError('amount must be greater than 0');

  const [payment, feeItem] = await Promise.all([
    strapi.db.query(PAYMENT_UID).findOne({
      where: { id: paymentRef },
      populate: { tenant: { select: ['id'] }, learner: { select: ['id'] } },
    }),
    strapi.db.query(FEE_ITEM_UID).findOne({
      where: { id: feeItemRef },
      populate: { tenant: { select: ['id'] }, learner: { select: ['id'] } },
      select: ['id', 'amount', 'paidAmount'],
    }),
  ]);

  if (!payment?.id) throw new errors.ApplicationError('payment is invalid');
  if (!feeItem?.id) throw new errors.ApplicationError('feeItem is invalid');

  const paymentTenantRef = extractEntryRelationRef(payment?.tenant);
  const feeItemTenantRef = extractEntryRelationRef(feeItem?.tenant);
  if (String(paymentTenantRef || '') !== String(tenantRef)) {
    throw new errors.ApplicationError('payment does not belong to the selected tenant');
  }
  if (String(feeItemTenantRef || '') !== String(tenantRef)) {
    throw new errors.ApplicationError('feeItem does not belong to the selected tenant');
  }
  if (String(payment?.learner?.id || '') !== String(feeItem?.learner?.id || '')) {
    throw new errors.ApplicationError('payment learner does not match feeItem learner');
  }

  const existingId = (existing as { id?: number | string } | null)?.id || null;
  const otherPaymentAllocations = await getPaymentAllocationSum(payment.id, existingId);
  if (roundMoney(otherPaymentAllocations + amount) > roundMoney(toDecimal(payment.amount, 0)) + 0.000001) {
    throw new errors.ApplicationError('total allocations cannot exceed payment amount');
  }

  const effectiveCurrentPaidAmount = existing?.feeItem?.id && String(existing.feeItem.id) === String(feeItem.id)
    ? roundMoney(toDecimal(feeItem.paidAmount, 0) - toDecimal(existing.amount, 0))
    : roundMoney(toDecimal(feeItem.paidAmount, 0));
  const itemRemaining = roundMoney(Math.max(0, toDecimal(feeItem.amount, 0) - effectiveCurrentPaidAmount));
  if (amount > itemRemaining + 0.000001) {
    throw new errors.ApplicationError('allocation amount exceeds feeItem remaining amount');
  }

  if (params.state) {
    params.state.previousAllocation = existing
      ? {
          id: existing.id,
          amount: roundMoney(toDecimal(existing.amount, 0)),
          feeItemId: existing?.feeItem?.id || null,
        }
      : null;
  }

  data.amount = amount;
}

export default {
  async beforeCreate(event: any) {
    await ensureAllocationValid({ data: event.params?.data, state: event.state });
  },

  async afterCreate(event: any) {
    const amount = roundMoney(toDecimal(event.result?.amount, 0));
    const feeItemId = event.result?.feeItem?.id || event.result?.feeItem;
    if (feeItemId && amount > 0) {
      await applyFeeItemPaidAmount(feeItemId, amount);
    }
  },

  async beforeUpdate(event: any) {
    await ensureAllocationValid({ data: event.params?.data, where: event.params?.where, state: event.state });
  },

  async afterUpdate(event: any) {
    const previous = event.state?.previousAllocation;
    const nextAmount = roundMoney(toDecimal(event.result?.amount, 0));
    const nextFeeItemId = event.result?.feeItem?.id || event.result?.feeItem;

    if (previous?.feeItemId && previous.amount > 0) {
      await applyFeeItemPaidAmount(previous.feeItemId, -previous.amount);
    }

    if (nextFeeItemId && nextAmount > 0) {
      await applyFeeItemPaidAmount(nextFeeItemId, nextAmount);
    }
  },

  async beforeDelete(event: any) {
    const existing = await getExistingAllocation(event.params?.where);
    event.state.previousAllocation = existing
      ? {
          id: existing.id,
          amount: roundMoney(toDecimal(existing.amount, 0)),
          feeItemId: existing?.feeItem?.id || null,
        }
      : null;
  },

  async afterDelete(event: any) {
    const previous = event.state?.previousAllocation;
    if (previous?.feeItemId && previous.amount > 0) {
      await applyFeeItemPaidAmount(previous.feeItemId, -previous.amount);
    }
  },
};