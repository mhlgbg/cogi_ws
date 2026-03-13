const SERVICE_ORDER_UID = 'api::service-order.service-order';
const SERVICE_ORDER_ITEM_UID = 'api::service-order-item.service-order-item';
const PAYMENT_TRANSACTION_UID = 'api::payment-transaction.payment-transaction';

type GenericRecord = Record<string, unknown>;

function parsePositiveInt(value: unknown): number | null {
  if (typeof value === 'number') {
    return Number.isInteger(value) && value > 0 ? value : null;
  }

  if (typeof value === 'string') {
    const parsed = Number(value);
    return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
  }

  return null;
}

function parseMoney(value: unknown): number {
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) return 0;
    return value;
  }

  if (typeof value === 'string') {
    const normalized = value.trim();
    if (!normalized) return 0;
    const parsed = Number(normalized);
    if (!Number.isFinite(parsed)) return 0;
    return parsed;
  }

  return 0;
}

function roundMoney(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.round(value * 100) / 100;
}

function clampNonNegative(value: number): number {
  if (!Number.isFinite(value) || value <= 0) return 0;
  return value;
}

export function extractEntryRelationId(value: unknown): number | null {
  if (!value) return null;

  const direct = parsePositiveInt(value);
  if (direct) return direct;

  if (typeof value !== 'object') return null;

  const asObject = value as { id?: unknown };
  return parsePositiveInt(asObject.id);
}

export function extractRelationId(value: unknown): number | null {
  if (value === null || value === undefined) return null;

  const direct = parsePositiveInt(value);
  if (direct) return direct;

  if (typeof value !== 'object') return null;

  const relation = value as {
    id?: unknown;
    connect?: unknown[] | unknown;
    set?: unknown[] | unknown;
    disconnect?: unknown[] | unknown;
  };

  if (relation.id !== undefined) {
    return extractRelationId(relation.id);
  }

  const fromConnect = relation.connect;
  if (Array.isArray(fromConnect) && fromConnect.length > 0) {
    return extractRelationId(fromConnect[0]);
  }
  if (fromConnect && typeof fromConnect === 'object') {
    return extractRelationId(fromConnect);
  }

  const fromSet = relation.set;
  if (Array.isArray(fromSet) && fromSet.length > 0) {
    return extractRelationId(fromSet[0]);
  }
  if (fromSet && typeof fromSet === 'object') {
    return extractRelationId(fromSet);
  }

  const fromDisconnect = relation.disconnect;
  if (Array.isArray(fromDisconnect) && fromDisconnect.length > 0) {
    const disconnectedId = extractRelationId(fromDisconnect[0]);
    if (disconnectedId) return null;
  }
  if (fromDisconnect && typeof fromDisconnect === 'object') {
    const disconnectedId = extractRelationId(fromDisconnect);
    if (disconnectedId) return null;
  }

  return null;
}

export function resolveRelationForUpdate(
  data: GenericRecord,
  fieldName: string,
  existingRelationValue: unknown
): number | null {
  if (!Object.prototype.hasOwnProperty.call(data, fieldName)) {
    return extractEntryRelationId(existingRelationValue);
  }

  return extractRelationId(data[fieldName]);
}

export function buildRecalculateOrderIds(values: Array<number | null | undefined>): number[] {
  return Array.from(new Set(values.filter((value): value is number => Boolean(value && value > 0))));
}

function calculatePaymentStatus(totalAmount: number, paidAmount: number): 'UNPAID' | 'PARTIAL' | 'PAID' {
  if (totalAmount <= 0 && paidAmount <= 0) return 'UNPAID';
  if (paidAmount <= 0) return 'UNPAID';
  if (paidAmount > 0 && paidAmount < totalAmount) return 'PARTIAL';
  if (paidAmount >= totalAmount && totalAmount > 0) return 'PAID';
  return 'UNPAID';
}

export async function recalculateServiceOrderTotals(orderId: number | null) {
  if (!orderId) return;

  const [items, payments] = await Promise.all([
    strapi.db.query(SERVICE_ORDER_ITEM_UID).findMany({
      where: { order: orderId },
      select: ['amount'],
    }),
    strapi.db.query(PAYMENT_TRANSACTION_UID).findMany({
      where: { order: orderId },
      select: ['amount'],
    }),
  ]);

  const totalAmount = roundMoney(
    (items || []).reduce((sum: number, item: any) => sum + clampNonNegative(parseMoney(item?.amount)), 0)
  );

  const paidAmount = roundMoney(
    (payments || []).reduce((sum: number, payment: any) => sum + clampNonNegative(parseMoney(payment?.amount)), 0)
  );

  const debtAmount = roundMoney(clampNonNegative(totalAmount - paidAmount));
  const paymentStatus = calculatePaymentStatus(totalAmount, paidAmount);

  await strapi.entityService.update(SERVICE_ORDER_UID, orderId, {
    data: {
      totalAmount,
      paidAmount,
      debtAmount,
      paymentStatus,
    },
  });
}
