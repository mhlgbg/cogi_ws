import { errors } from '@strapi/utils';

const ENROLLMENT_UID = 'api::enrollment.enrollment';
const CLASS_UID = 'api::class.class';
const LEARNER_UID = 'api::learner.learner';

function extractRelationRef(value: unknown): string | number | null {
  if (value === null || value === undefined) return null;

  if (typeof value === 'string' || typeof value === 'number') {
    return value;
  }

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

function toIsoDate(value: unknown): string | null {
  if (!value) return null;
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) {
    throw new errors.ApplicationError('Invalid date value');
  }
  return date.toISOString().slice(0, 10);
}

async function getExistingEnrollment(where: unknown) {
  const id = (where as { id?: number | string } | undefined)?.id;
  if (!id) return null;

  return strapi.db.query(ENROLLMENT_UID).findOne({
    where: { id },
    populate: {
      learner: {
        select: ['id'],
        populate: {
          tenant: { select: ['id'] },
        },
      },
      class: {
        select: ['id'],
        populate: {
          tenant: { select: ['id'] },
        },
      },
      tenant: { select: ['id'] },
    },
  });
}

async function resolveEnrollmentRefs(params: { data?: Record<string, unknown>; where?: unknown }) {
  const existing = await getExistingEnrollment(params.where);

  const learnerRef = extractRelationRef(params.data?.learner) || extractEntryRelationRef(existing?.learner);
  const classRef = extractRelationRef(params.data?.class) || extractEntryRelationRef(existing?.class);
  const tenantRef = extractRelationRef(params.data?.tenant) || extractEntryRelationRef(existing?.tenant) || extractEntryRelationRef(existing?.class?.tenant);

  if (!learnerRef) {
    throw new errors.ApplicationError('learner is required');
  }

  if (!classRef) {
    throw new errors.ApplicationError('class is required');
  }

  if (!tenantRef) {
    throw new errors.ApplicationError('tenant is required');
  }

  return {
    existing,
    learnerRef,
    classRef,
    tenantRef,
  };
}

async function ensureLearnerBelongsToTenant(learnerRef: string | number, tenantRef: string | number) {
  const learner = await strapi.db.query(LEARNER_UID).findOne({
    where: {
      id: learnerRef,
      tenant: tenantRef,
    },
    select: ['id'],
  });

  if (!learner?.id) {
    throw new errors.ApplicationError('learner does not belong to the selected tenant');
  }
}

async function ensureEnrollmentIsValid(params: { data?: Record<string, unknown>; where?: unknown }) {
  const { existing, learnerRef, classRef, tenantRef } = await resolveEnrollmentRefs(params);

  const enrollmentClass = await strapi.db.query(CLASS_UID).findOne({
    where: { id: classRef },
    populate: {
      tenant: { select: ['id'] },
    },
  });

  if (!enrollmentClass?.id) {
    throw new errors.ApplicationError('class is invalid');
  }

  const classTenantRef = extractEntryRelationRef(enrollmentClass?.tenant);
  if (!classTenantRef || String(classTenantRef) !== String(tenantRef)) {
    throw new errors.ApplicationError('class does not belong to the selected tenant');
  }

  await ensureLearnerBelongsToTenant(learnerRef, tenantRef);

  const joinDate = toIsoDate(params.data?.joinDate ?? existing?.joinDate);
  const leaveDate = toIsoDate(params.data?.leaveDate ?? existing?.leaveDate);
  if (joinDate && leaveDate && leaveDate < joinDate) {
    throw new errors.ApplicationError('leaveDate must be greater than or equal to joinDate');
  }

  const duplicate = await strapi.db.query(ENROLLMENT_UID).findMany({
    where: {
      learner: {
        id: {
          $eq: learnerRef,
        },
      },
      class: {
        id: {
          $eq: classRef,
        },
      },
    },
    select: ['id'],
  });

  const existingId = (existing as { id?: number | string } | null)?.id;
  const hasDuplicate = (duplicate || []).some((item: any) => String(item?.id) !== String(existingId || ''));
  if (hasDuplicate) {
    throw new errors.ApplicationError('Enrollment already exists for this learner and class');
  }
}

export default {
  async beforeCreate(event: any) {
    await ensureEnrollmentIsValid({
      data: event.params?.data,
    });
  },

  async beforeUpdate(event: any) {
    await ensureEnrollmentIsValid({
      data: event.params?.data,
      where: event.params?.where,
    });
  },
};