import { errors } from '@strapi/utils';

const FEE_SHEET_UID = 'api::fee-sheet.fee-sheet';
const FEE_SHEET_CLASS_UID = 'api::fee-sheet-class.fee-sheet-class';

function toText(value: unknown) {
  if (value === null || value === undefined) return '';
  return String(value).trim();
}

function toIsoDate(value: unknown): string | null {
  if (!value) return null;
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) {
    throw new errors.ApplicationError('Invalid date value');
  }
  return date.toISOString().slice(0, 10);
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

async function getExistingFeeSheet(where: unknown) {
  const id = (where as { id?: number | string } | undefined)?.id;
  if (!id) return null;

  return strapi.db.query(FEE_SHEET_UID).findOne({
    where: { id },
    populate: {
      tenant: { select: ['id'] },
    },
  });
}

async function ensureFeeSheetValid(params: { data?: Record<string, unknown>; where?: unknown }) {
  const data = params.data || {};
  const existing = await getExistingFeeSheet(params.where);

  const name = toText(data.name ?? existing?.name);
  const fromDate = toIsoDate(data.fromDate ?? existing?.fromDate);
  const toDate = toIsoDate(data.toDate ?? existing?.toDate);
  const tenantRef = extractRelationRef(data.tenant) || extractRelationRef(existing?.tenant);

  if (!name) throw new errors.ApplicationError('name is required');
  if (!fromDate) throw new errors.ApplicationError('fromDate is required');
  if (!toDate) throw new errors.ApplicationError('toDate is required');
  if (!tenantRef) throw new errors.ApplicationError('tenant is required');
  if (toDate < fromDate) throw new errors.ApplicationError('toDate must be greater than or equal to fromDate');

  data.name = name;
  data.fromDate = fromDate;
  data.toDate = toDate;
  if (Object.prototype.hasOwnProperty.call(data, 'note')) data.note = toText(data.note) || null;
  if (Object.prototype.hasOwnProperty.call(data, 'feeSheetStatus') || Object.prototype.hasOwnProperty.call(data, 'status')) {
    const normalizedStatus = toText(data.feeSheetStatus ?? data.status).toLowerCase();
    data.feeSheetStatus = ['open', 'closed', 'approved'].includes(normalizedStatus) ? normalizedStatus : 'draft';
  }

  const nextStatus = toText(data.feeSheetStatus || data.status || existing?.feeSheetStatus || existing?.status).toLowerCase();
  if (nextStatus === 'approved' && existing?.id) {
    const feeSheetClassCount = await strapi.db.query(FEE_SHEET_CLASS_UID).count({
      where: {
        feeSheet: {
          id: {
            $eq: existing.id,
          },
        },
      },
    });

    if (feeSheetClassCount <= 0) {
      throw new errors.ApplicationError('Cannot approve fee sheet without any fee sheet class');
    }
  }
}

export default {
  async beforeCreate(event: any) {
    await ensureFeeSheetValid({ data: event.params?.data });
  },

  async beforeUpdate(event: any) {
    await ensureFeeSheetValid({ data: event.params?.data, where: event.params?.where });
  },
};