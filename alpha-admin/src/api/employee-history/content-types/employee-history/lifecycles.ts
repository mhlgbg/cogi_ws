import { errors } from '@strapi/utils';

const EMPLOYEE_HISTORY_UID = 'api::employee-history.employee-history';
const EMPLOYEE_UID = 'api::employee.employee';

type GenericRecord = Record<string, unknown>;

type DateRange = {
  startDate: string;
  endDate: string | null;
};

function hasOwn(data: GenericRecord, key: string) {
  return Object.prototype.hasOwnProperty.call(data, key);
}

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

function extractRelationId(value: unknown): number | null {
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

function normalizeDateInput(value: unknown, fieldName: string, required = false): string | null {
  if (value === null || value === undefined || value === '') {
    if (required) {
      throw new errors.ApplicationError(`${fieldName} is required`);
    }
    return null;
  }

  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) {
    throw new errors.ApplicationError(`${fieldName} is invalid`);
  }

  return date.toISOString().slice(0, 10);
}

function normalizeRange(startValue: unknown, endValue: unknown): DateRange {
  const startDate = normalizeDateInput(startValue, 'startDate', true) as string;
  const endDate = normalizeDateInput(endValue, 'endDate', false);

  if (endDate && endDate < startDate) {
    throw new errors.ApplicationError('endDate cannot be earlier than startDate');
  }

  return { startDate, endDate };
}

function rangesOverlap(rangeA: DateRange, rangeB: DateRange): boolean {
  const aEnd = rangeA.endDate ?? '9999-12-31';
  const bEnd = rangeB.endDate ?? '9999-12-31';

  return rangeA.startDate <= bEnd && rangeB.startDate <= aEnd;
}

function toBooleanOrDefault(value: unknown, fallbackValue: boolean): boolean {
  if (typeof value === 'boolean') return value;
  if (value === 'true') return true;
  if (value === 'false') return false;
  return fallbackValue;
}

function extractEntryRelationId(value: unknown): number | null {
  if (!value) return null;

  const direct = parsePositiveInt(value);
  if (direct) return direct;

  if (typeof value !== 'object') return null;

  const asObject = value as { id?: unknown };
  return parsePositiveInt(asObject.id);
}

function resolveRelationForUpdate(
  data: GenericRecord,
  fieldName: string,
  existingRelationValue: unknown
): number | null {
  if (!hasOwn(data, fieldName)) {
    return extractEntryRelationId(existingRelationValue);
  }

  return extractRelationId(data[fieldName]);
}

async function findExistingHistory(where: unknown) {
  return strapi.db.query(EMPLOYEE_HISTORY_UID).findOne({
    where,
    populate: ['employee', 'department'],
  });
}

async function validateNoOverlapInDepartment(params: {
  employeeId: number;
  departmentId: number;
  range: DateRange;
  ignoreId?: number;
}) {
  const where: GenericRecord = {
    employee: params.employeeId,
    department: params.departmentId,
  };

  if (params.ignoreId) {
    where.id = { $ne: params.ignoreId };
  }

  const histories = await strapi.db.query(EMPLOYEE_HISTORY_UID).findMany({
    where,
    select: ['id', 'startDate', 'endDate'],
  });

  const hasOverlap = (histories || []).some((item: any) => {
    const existingRange = normalizeRange(item?.startDate, item?.endDate);
    return rangesOverlap(params.range, existingRange);
  });

  if (hasOverlap) {
    throw new errors.ApplicationError(
      'Time range overlaps another history record for the same employee and department'
    );
  }
}

async function validatePrimaryCurrentUniqueness(params: {
  employeeId: number;
  isCurrent: boolean;
  isPrimary: boolean;
  ignoreId?: number;
}) {
  if (!params.isCurrent || !params.isPrimary) return;

  const where: GenericRecord = {
    employee: params.employeeId,
    isCurrent: true,
    isPrimary: true,
  };

  if (params.ignoreId) {
    where.id = { $ne: params.ignoreId };
  }

  const existingPrimaryCurrent = await strapi.db.query(EMPLOYEE_HISTORY_UID).findOne({
    where,
    select: ['id'],
  });

  if (existingPrimaryCurrent) {
    throw new errors.ApplicationError(
      'Only one record can be both isCurrent=true and isPrimary=true for an employee'
    );
  }
}

async function syncEmployeeCurrentAssignment(employeeId: number | null) {
  if (!employeeId) return;

  const histories = await strapi.db.query(EMPLOYEE_HISTORY_UID).findMany({
    where: {
      employee: employeeId,
      isCurrent: true,
      isPrimary: true,
    },
    populate: ['department', 'position', 'manager'],
    orderBy: [
      { startDate: 'desc' },
      { createdAt: 'desc' },
    ],
    limit: 1,
  });

  const current = Array.isArray(histories) && histories.length > 0 ? histories[0] : null;

  const currentDepartment = extractEntryRelationId(current?.department);
  const currentPosition = extractEntryRelationId(current?.position);
  const currentManager = extractEntryRelationId(current?.manager);

  await strapi.entityService.update(EMPLOYEE_UID, employeeId, {
    data: {
      currentDepartment: currentDepartment ?? null,
      currentPosition: currentPosition ?? null,
      currentManager: currentManager ?? null,
    },
  });
}

function buildSyncEmployeeIds(values: Array<number | null | undefined>): number[] {
  return Array.from(new Set(values.filter((value): value is number => Boolean(value && value > 0))));
}

async function validateAndPrepareCreate(event: any) {
  const data = (event.params?.data || {}) as GenericRecord;

  const employeeId = extractRelationId(data.employee);
  const departmentId = extractRelationId(data.department);

  if (!employeeId) {
    throw new errors.ApplicationError('employee is required');
  }

  if (!departmentId) {
    throw new errors.ApplicationError('department is required');
  }

  const range = normalizeRange(data.startDate, hasOwn(data, 'endDate') ? data.endDate : null);

  await validateNoOverlapInDepartment({
    employeeId,
    departmentId,
    range,
  });

  const isCurrent = toBooleanOrDefault(data.isCurrent, true);
  const isPrimary = toBooleanOrDefault(data.isPrimary, false);

  await validatePrimaryCurrentUniqueness({
    employeeId,
    isCurrent,
    isPrimary,
  });

  event.state = event.state || {};
  event.state.syncEmployeeIds = buildSyncEmployeeIds([employeeId]);
}

async function validateAndPrepareUpdate(event: any) {
  const params = event.params || {};
  const data = (params.data || {}) as GenericRecord;

  const existing = await findExistingHistory(params.where);
  if (!existing) return;

  const existingId = parsePositiveInt(existing.id);
  const existingEmployeeId = extractEntryRelationId(existing.employee);
  const existingDepartmentId = extractEntryRelationId(existing.department);

  const employeeId = resolveRelationForUpdate(data, 'employee', existing.employee);
  const departmentId = resolveRelationForUpdate(data, 'department', existing.department);

  if (!employeeId) {
    throw new errors.ApplicationError('employee is required');
  }

  if (!departmentId) {
    throw new errors.ApplicationError('department is required');
  }

  const startValue = hasOwn(data, 'startDate') ? data.startDate : existing.startDate;
  const endValue = hasOwn(data, 'endDate') ? data.endDate : existing.endDate;

  const range = normalizeRange(startValue, endValue);

  await validateNoOverlapInDepartment({
    employeeId,
    departmentId,
    range,
    ignoreId: existingId || undefined,
  });

  const isCurrent = toBooleanOrDefault(
    hasOwn(data, 'isCurrent') ? data.isCurrent : existing.isCurrent,
    true
  );

  const isPrimary = toBooleanOrDefault(
    hasOwn(data, 'isPrimary') ? data.isPrimary : existing.isPrimary,
    false
  );

  await validatePrimaryCurrentUniqueness({
    employeeId,
    isCurrent,
    isPrimary,
    ignoreId: existingId || undefined,
  });

  event.state = event.state || {};
  event.state.syncEmployeeIds = buildSyncEmployeeIds([existingEmployeeId, employeeId]);
}

async function prepareDelete(event: any) {
  const params = event.params || {};
  const existing = await findExistingHistory(params.where);
  const existingEmployeeId = extractEntryRelationId(existing?.employee);

  event.state = event.state || {};
  event.state.syncEmployeeIds = buildSyncEmployeeIds([existingEmployeeId]);
}

async function syncAfterMutation(event: any) {
  const idsFromState = Array.isArray(event.state?.syncEmployeeIds)
    ? (event.state.syncEmployeeIds as number[])
    : [];

  if (idsFromState.length === 0) {
    const fallbackEmployeeId = extractEntryRelationId(event.result?.employee);
    if (fallbackEmployeeId) {
      await syncEmployeeCurrentAssignment(fallbackEmployeeId);
    }
    return;
  }

  for (const employeeId of idsFromState) {
    await syncEmployeeCurrentAssignment(employeeId);
  }
}

export default {
  async beforeCreate(event: any) {
    await validateAndPrepareCreate(event);
  },

  async beforeUpdate(event: any) {
    await validateAndPrepareUpdate(event);
  },

  async beforeDelete(event: any) {
    await prepareDelete(event);
  },

  async afterCreate(event: any) {
    await syncAfterMutation(event);
  },

  async afterUpdate(event: any) {
    await syncAfterMutation(event);
  },

  async afterDelete(event: any) {
    await syncAfterMutation(event);
  },
};
