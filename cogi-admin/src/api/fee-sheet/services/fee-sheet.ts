import { factories } from '@strapi/strapi';

const FEE_SHEET_UID = 'api::fee-sheet.fee-sheet';
const FEE_SHEET_CLASS_UID = 'api::fee-sheet-class.fee-sheet-class';
const FEE_ITEM_UID = 'api::fee-item.fee-item';
const CLASS_UID = 'api::class.class';
const ENROLLMENT_UID = 'api::enrollment.enrollment';

function toText(value: unknown) {
  if (value === null || value === undefined) return '';
  return String(value).trim();
}

function formatTeacherName(teacher: any) {
  return toText(teacher?.fullName) || toText(teacher?.username) || toText(teacher?.email) || null;
}

function readFeeSheetStatus(value: any) {
  return value?.feeSheetStatus || value?.status || 'draft';
}

export default factories.createCoreService(FEE_SHEET_UID, () => ({
  async generateForClasses(options: { feeSheetId: number; classIds: number[]; regenerate?: boolean; unitPrice: number; tenantId: number | string }) {
    const { feeSheetId, classIds, regenerate = false, unitPrice, tenantId } = options;

    const feeSheet = await strapi.db.query(FEE_SHEET_UID).findOne({
      where: { id: feeSheetId, tenant: tenantId },
      select: ['id', 'name', 'feeSheetStatus'],
    });

    if (!feeSheet?.id) {
      throw new Error('Fee sheet not found');
    }

    if (readFeeSheetStatus(feeSheet) === 'approved') {
      throw new Error('Approved fee sheet cannot be generated');
    }

    const createdClasses: any[] = [];
    const updatedClasses: any[] = [];
    const skippedClasses: any[] = [];

    for (const classId of classIds) {
      const classEntity = await strapi.db.query(CLASS_UID).findOne({
        where: { id: classId, tenant: tenantId },
        populate: {
          mainTeacher: {
            select: ['id', 'username', 'email', 'fullName'],
          },
        },
      });

      if (!classEntity?.id) {
        skippedClasses.push({ classId, message: 'Class not found in tenant' });
        continue;
      }

      let feeSheetClass = await strapi.db.query(FEE_SHEET_CLASS_UID).findOne({
        where: {
          feeSheet: { id: { $eq: feeSheet.id } },
          class: { id: { $eq: classEntity.id } },
          tenant: tenantId,
        },
        populate: {
          feeItems: { select: ['id'] },
        },
      });

      if (feeSheetClass?.id && !regenerate) {
        skippedClasses.push({ classId: classEntity.id, className: classEntity.name, message: 'Fee sheet class already exists' });
        continue;
      }

      if (!feeSheetClass?.id) {
        feeSheetClass = await strapi.db.query(FEE_SHEET_CLASS_UID).create({
          data: {
            feeSheet: feeSheet.id,
            class: classEntity.id,
            tenant: tenantId,
          },
        });
        createdClasses.push({ classId: classEntity.id, className: classEntity.name });
      } else {
        await strapi.db.query(FEE_SHEET_CLASS_UID).update({
          where: { id: feeSheetClass.id },
          data: {
            classNameSnapshot: classEntity.name || null,
            teacher: classEntity.mainTeacher?.id || null,
            teacherNameSnapshot: formatTeacherName(classEntity.mainTeacher),
          },
        });
        updatedClasses.push({ classId: classEntity.id, className: classEntity.name });
      }

      const enrollments = await strapi.db.query(ENROLLMENT_UID).findMany({
        where: {
          class: { id: { $eq: classEntity.id } },
          tenant: tenantId,
          enrollmentStatus: 'active',
        },
        populate: {
          learner: {
            select: ['id', 'code', 'fullName'],
          },
        },
      });

      for (const enrollment of enrollments || []) {
        const learner = enrollment?.learner;
        if (!learner?.id) continue;

        const existingFeeItem = await strapi.db.query(FEE_ITEM_UID).findOne({
          where: {
            feeSheetClass: { id: { $eq: feeSheetClass.id } },
            learner: { id: { $eq: learner.id } },
            tenant: tenantId,
          },
          select: ['id'],
        });

        if (existingFeeItem?.id) {
          if (regenerate) {
            await strapi.db.query(FEE_ITEM_UID).update({
              where: { id: existingFeeItem.id },
              data: {
                learnerCodeSnapshot: learner.code || null,
                learnerNameSnapshot: learner.fullName || null,
                unitPrice,
              },
            });
          }
          continue;
        }

        await strapi.db.query(FEE_ITEM_UID).create({
          data: {
            feeSheetClass: feeSheetClass.id,
            learner: learner.id,
            learnerCodeSnapshot: learner.code || null,
            learnerNameSnapshot: learner.fullName || null,
            sessions: 0,
            unitPrice,
            discountPercent: 0,
            discountAmount: 0,
            amount: 0,
            paidAmount: 0,
            feeItemPaymentStatus: 'unpaid',
            tenant: tenantId,
          },
        });
      }
    }

    return {
      feeSheetId: feeSheet.id,
      createdClasses,
      updatedClasses,
      skippedClasses,
    };
  },
}));