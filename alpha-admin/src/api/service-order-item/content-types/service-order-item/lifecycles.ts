import { errors } from '@strapi/utils';

import {
  buildRecalculateOrderIds,
  recalculateServiceOrderTotals,
  resolveRelationForUpdate,
  extractRelationId,
  extractEntryRelationId,
} from '../../../service-order/services/recalculate-service-order-totals';

const SERVICE_ORDER_ITEM_UID = 'api::service-order-item.service-order-item';

type GenericRecord = Record<string, unknown>;

function hasOwn(data: GenericRecord, key: string) {
  return Object.prototype.hasOwnProperty.call(data, key);
}

function parseNumeric(value: unknown): number | null {
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) return null;
    return value;
  }

  if (typeof value === 'string') {
    const normalized = value.trim();
    if (!normalized) return null;
    const parsed = Number(normalized);
    if (!Number.isFinite(parsed)) return null;
    return parsed;
  }

  return null;
}

function roundMoney(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.round(value * 100) / 100;
}

function validateNonNegative(value: number, fieldName: string) {
  if (value < 0) {
    throw new errors.ApplicationError(`${fieldName} cannot be negative`);
  }
}

function computeAmount(quantity: number, unitPrice: number): number {
  return roundMoney(quantity * unitPrice);
}

async function beforeCreateOrUpdate(event: any, isCreate: boolean) {
  const params = event.params || {};
  const data = (params.data || {}) as GenericRecord;

  let existing: any = null;
  if (!isCreate) {
    existing = await strapi.db.query(SERVICE_ORDER_ITEM_UID).findOne({
      where: params.where,
      populate: ['order'],
      select: ['quantity', 'unitPrice', 'amount'],
    });
  }

  const defaultQuantity = 1;
  const fallbackQuantity = parseNumeric(existing?.quantity) ?? defaultQuantity;
  const fallbackUnitPrice = parseNumeric(existing?.unitPrice) ?? 0;

  const quantity = hasOwn(data, 'quantity')
    ? (parseNumeric(data.quantity) ?? defaultQuantity)
    : fallbackQuantity;

  const unitPrice = hasOwn(data, 'unitPrice')
    ? (parseNumeric(data.unitPrice) ?? 0)
    : fallbackUnitPrice;

  validateNonNegative(quantity, 'quantity');
  validateNonNegative(unitPrice, 'unitPrice');

  const hasAmount = hasOwn(data, 'amount');
  const parsedAmount = parseNumeric(data.amount);

  if (hasAmount && parsedAmount !== null) {
    validateNonNegative(parsedAmount, 'amount');
  }

  const shouldRecalculateAmount =
    !hasAmount
    || parsedAmount === null
    || hasOwn(data, 'quantity')
    || hasOwn(data, 'unitPrice');

  if (shouldRecalculateAmount) {
    data.amount = computeAmount(quantity, unitPrice);
  }

  if (hasAmount && parsedAmount !== null && !shouldRecalculateAmount) {
    data.amount = roundMoney(parsedAmount);
  }

  const existingOrderId = extractEntryRelationId(existing?.order);
  const nextOrderId = resolveRelationForUpdate(data, 'order', existing?.order);

  event.state = event.state || {};
  event.state.recalculateOrderIds = buildRecalculateOrderIds([existingOrderId, nextOrderId]);
}

async function beforeDelete(event: any) {
  const params = event.params || {};
  const existing = await strapi.db.query(SERVICE_ORDER_ITEM_UID).findOne({
    where: params.where,
    populate: ['order'],
    select: ['id'],
  });

  const orderId = extractEntryRelationId(existing?.order);

  event.state = event.state || {};
  event.state.recalculateOrderIds = buildRecalculateOrderIds([orderId]);
}

async function afterMutation(event: any) {
  const idsFromState = Array.isArray(event.state?.recalculateOrderIds)
    ? (event.state.recalculateOrderIds as number[])
    : [];

  if (idsFromState.length > 0) {
    for (const orderId of idsFromState) {
      await recalculateServiceOrderTotals(orderId);
    }
    return;
  }

  const fallbackOrderId = extractRelationId(event.result?.order);
  if (fallbackOrderId) {
    await recalculateServiceOrderTotals(fallbackOrderId);
  }
}

export default {
  async beforeCreate(event: any) {
    await beforeCreateOrUpdate(event, true);
  },

  async beforeUpdate(event: any) {
    await beforeCreateOrUpdate(event, false);
  },

  async beforeDelete(event: any) {
    await beforeDelete(event);
  },

  async afterCreate(event: any) {
    await afterMutation(event);
  },

  async afterUpdate(event: any) {
    await afterMutation(event);
  },

  async afterDelete(event: any) {
    await afterMutation(event);
  },
};
