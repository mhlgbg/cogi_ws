import { errors } from '@strapi/utils';

const FEE_ITEM_UID = 'api::fee-item.fee-item';
const FEE_SHEET_CLASS_UID = 'api::fee-sheet-class.fee-sheet-class';
const LEARNER_UID = 'api::learner.learner';

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

function toInteger(value: unknown, fallback = 0) {
  const parsed = Number(value);
  return Number.isInteger(parsed) ? parsed : fallback;
}

function roundMoney(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

async function getExistingFeeItem(where: unknown) {
  const id = (where as { id?: number | string } | undefined)?.id;
  if (!id) return null;

  return strapi.db.query(FEE_ITEM_UID).findOne({
    where: { id },
    populate: {
      feeSheetClass: { populate: { tenant: { select: ['id'] } } },
      learner: { populate: { tenant: { select: ['id'] } } },
      tenant: { select: ['id'] },
    },
  });
}

async function ensureFeeItemValid(params: { data?: Record<string, unknown>; where?: unknown }) {
  const data = params.data || {};
  const existing = await getExistingFeeItem(params.where);

  const feeSheetClassRef = extractRelationRef(data.feeSheetClass) || extractEntryRelationRef(existing?.feeSheetClass);
  const learnerRef = extractRelationRef(data.learner) || extractEntryRelationRef(existing?.learner);
  const tenantRef = extractRelationRef(data.tenant) || extractEntryRelationRef(existing?.tenant) || extractEntryRelationRef(existing?.feeSheetClass?.tenant);

  if (!feeSheetClassRef) throw new errors.ApplicationError('feeSheetClass is required');
  if (!learnerRef) throw new errors.ApplicationError('learner is required');
  if (!tenantRef) throw new errors.ApplicationError('tenant is required');

  const [feeSheetClass, learner] = await Promise.all([
    strapi.db.query(FEE_SHEET_CLASS_UID).findOne({
      where: { id: feeSheetClassRef },
      populate: { tenant: { select: ['id'] } },
    }),
    strapi.db.query(LEARNER_UID).findOne({
      where: { id: learnerRef },
      populate: { tenant: { select: ['id'] } },
    }),
  ]);

  if (!feeSheetClass?.id) throw new errors.ApplicationError('feeSheetClass is invalid');
  if (!learner?.id) throw new errors.ApplicationError('learner is invalid');

  const feeSheetClassTenantRef = extractEntryRelationRef(feeSheetClass?.tenant);
  const learnerTenantRef = extractEntryRelationRef(learner?.tenant);

  if (String(feeSheetClassTenantRef || '') !== String(tenantRef)) {
    throw new errors.ApplicationError('feeSheetClass does not belong to the selected tenant');
  }

  if (String(learnerTenantRef || '') !== String(tenantRef)) {
    throw new errors.ApplicationError('learner does not belong to the selected tenant');
  }

  const duplicate = await strapi.db.query(FEE_ITEM_UID).findMany({
    where: {
      feeSheetClass: { id: { $eq: feeSheetClass.id } },
      learner: { id: { $eq: learner.id } },
    },
    select: ['id'],
  });

  const existingId = (existing as { id?: number | string } | null)?.id;
  const hasDuplicate = (duplicate || []).some((item: any) => String(item?.id) !== String(existingId || ''));
  if (hasDuplicate) {
    throw new errors.ApplicationError('FeeItem already exists for this learner and feeSheetClass');
  }

  const sessions = Math.max(0, toInteger(data.sessions ?? existing?.sessions, 0));
  const unitPrice = Math.max(0, toDecimal(data.unitPrice ?? existing?.unitPrice, 0));
  const discountPercent = Math.max(0, toDecimal(data.discountPercent ?? existing?.discountPercent, 0));
  const discountAmountInput = Math.max(0, toDecimal(data.discountAmount ?? existing?.discountAmount, 0));
  const paidAmount = Math.max(0, toDecimal(data.paidAmount ?? existing?.paidAmount, 0));
  const grossAmount = roundMoney(sessions * unitPrice);
  const discount = discountPercent > 0
    ? roundMoney((grossAmount * discountPercent) / 100)
    : roundMoney(discountAmountInput);
  const amount = roundMoney(Math.max(0, grossAmount - discount));
  const feeItemPaymentStatus = paidAmount <= 0 ? 'unpaid' : (paidAmount < amount ? 'partial' : 'paid');

  data.sessions = sessions;
  data.unitPrice = unitPrice;
  data.discountPercent = discountPercent;
  data.discountAmount = discountPercent > 0 ? discount : discountAmountInput;
  data.amount = amount;
  data.paidAmount = paidAmount;
  data.feeItemPaymentStatus = feeItemPaymentStatus;
  data.learnerCodeSnapshot = toText(learner.code) || null;
  data.learnerNameSnapshot = toText(learner.fullName) || null;
  if (Object.prototype.hasOwnProperty.call(data, 'note')) data.note = toText(data.note) || null;
}

export default {
  async beforeCreate(event: any) {
    await ensureFeeItemValid({ data: event.params?.data });
  },

  async beforeUpdate(event: any) {
    await ensureFeeItemValid({ data: event.params?.data, where: event.params?.where });
  },
};