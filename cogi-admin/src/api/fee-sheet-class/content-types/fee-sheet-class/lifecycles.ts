import { errors } from '@strapi/utils';

const FEE_SHEET_CLASS_UID = 'api::fee-sheet-class.fee-sheet-class';
const FEE_SHEET_UID = 'api::fee-sheet.fee-sheet';
const CLASS_UID = 'api::class.class';

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

async function getExistingFeeSheetClass(where: unknown) {
  const id = (where as { id?: number | string } | undefined)?.id;
  if (!id) return null;

  return strapi.db.query(FEE_SHEET_CLASS_UID).findOne({
    where: { id },
    populate: {
      feeSheet: { populate: { tenant: { select: ['id'] } } },
      class: { populate: { tenant: { select: ['id'] }, mainTeacher: { select: ['id', 'username', 'email', 'fullName'] } } },
      tenant: { select: ['id'] },
      teacher: { select: ['id', 'username', 'email', 'fullName'] },
    },
  });
}

function formatTeacherName(teacher: any) {
  return toText(teacher?.fullName) || toText(teacher?.username) || toText(teacher?.email) || null;
}

async function ensureFeeSheetClassValid(params: { data?: Record<string, unknown>; where?: unknown }) {
  const data = params.data || {};
  const existing = await getExistingFeeSheetClass(params.where);

  const feeSheetRef = extractRelationRef(data.feeSheet) || extractEntryRelationRef(existing?.feeSheet);
  const classRef = extractRelationRef(data.class) || extractEntryRelationRef(existing?.class);
  const tenantRef = extractRelationRef(data.tenant) || extractEntryRelationRef(existing?.tenant) || extractEntryRelationRef(existing?.feeSheet?.tenant);

  if (!feeSheetRef) throw new errors.ApplicationError('feeSheet is required');
  if (!classRef) throw new errors.ApplicationError('class is required');
  if (!tenantRef) throw new errors.ApplicationError('tenant is required');

  const [feeSheet, classEntity] = await Promise.all([
    strapi.db.query(FEE_SHEET_UID).findOne({
      where: { id: feeSheetRef },
      populate: { tenant: { select: ['id'] } },
    }),
    strapi.db.query(CLASS_UID).findOne({
      where: { id: classRef },
      populate: {
        tenant: { select: ['id'] },
        mainTeacher: { select: ['id', 'username', 'email', 'fullName'] },
      },
    }),
  ]);

  if (!feeSheet?.id) throw new errors.ApplicationError('feeSheet is invalid');
  if (!classEntity?.id) throw new errors.ApplicationError('class is invalid');

  const feeSheetTenantRef = extractEntryRelationRef(feeSheet?.tenant);
  const classTenantRef = extractEntryRelationRef(classEntity?.tenant);

  if (String(feeSheetTenantRef || '') !== String(tenantRef)) {
    throw new errors.ApplicationError('feeSheet does not belong to the selected tenant');
  }

  if (String(classTenantRef || '') !== String(tenantRef)) {
    throw new errors.ApplicationError('class does not belong to the selected tenant');
  }

  const duplicate = await strapi.db.query(FEE_SHEET_CLASS_UID).findMany({
    where: {
      feeSheet: { id: { $eq: feeSheet.id } },
      class: { id: { $eq: classEntity.id } },
    },
    select: ['id'],
  });

  const existingId = (existing as { id?: number | string } | null)?.id;
  const hasDuplicate = (duplicate || []).some((item: any) => String(item?.id) !== String(existingId || ''));
  if (hasDuplicate) {
    throw new errors.ApplicationError('FeeSheetClass already exists for this fee sheet and class');
  }

  const teacher = classEntity.mainTeacher || null;
  data.classNameSnapshot = toText(classEntity.name) || null;
  data.teacher = teacher?.id || null;
  data.teacherNameSnapshot = formatTeacherName(teacher);

  if (Object.prototype.hasOwnProperty.call(data, 'feeSheetClassStatus') || Object.prototype.hasOwnProperty.call(data, 'status')) {
    const normalizedStatus = toText(data.feeSheetClassStatus ?? data.status).toLowerCase();
    data.feeSheetClassStatus = ['submitted', 'approved'].includes(normalizedStatus) ? normalizedStatus : 'draft';
  }
}

export default {
  async beforeCreate(event: any) {
    await ensureFeeSheetClassValid({ data: event.params?.data });
  },

  async beforeUpdate(event: any) {
    await ensureFeeSheetClassValid({ data: event.params?.data, where: event.params?.where });
  },
};