import { factories } from '@strapi/strapi';
import {
  buildPaymentScopeWhere,
  extractDataRelationId,
  getPaymentCreateLevel,
  getPaymentUpdateLevel,
  getPaymentViewLevel,
  resolveCurrentUserScope,
  assertDepartmentInScope,
  assertEmployeeSelf,
} from '../../service-order/services/service-sales-access';

const PAYMENT_TRANSACTION_UID = 'api::payment-transaction.payment-transaction';

type SortOrder = 'asc' | 'desc';

type SortConfig = {
  field: string;
  order: SortOrder;
};

function parsePositiveInt(value: unknown, fallbackValue: number): number {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallbackValue;
}

function parseOptionalPositiveInt(value: unknown): number | null {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

function toDateStartIso(input?: string): string | null {
  if (!input) return null;
  const date = new Date(`${input}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
}

function toDateEndIso(input?: string): string | null {
  if (!input) return null;
  const date = new Date(`${input}T23:59:59.999Z`);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
}

function parseSort(input: unknown): SortConfig {
  const defaultSort: SortConfig = { field: 'paidAt', order: 'desc' };
  if (typeof input !== 'string' || !input.trim()) return defaultSort;

  const [rawField, rawOrder] = input.split(':');
  const field = String(rawField || '').trim();
  const order = String(rawOrder || '').trim().toLowerCase();

  const allowedFields = new Set(['paidAt', 'amount', 'createdAt']);
  if (!allowedFields.has(field)) return defaultSort;

  if (order !== 'asc' && order !== 'desc') return defaultSort;

  return {
    field,
    order: order as SortOrder,
  };
}

function normalizeCustomer(customer: any) {
  if (!customer) return null;

  return {
    id: customer.id,
    documentId: customer.documentId,
    code: customer.code,
    name: customer.name,
    phone: customer.phone,
  };
}

function normalizeDepartment(department: any) {
  if (!department) return null;

  return {
    id: department.id,
    documentId: department.documentId,
    code: department.code,
    name: department.name,
  };
}

function normalizeEmployee(employee: any) {
  if (!employee) return null;

  return {
    id: employee.id,
    documentId: employee.documentId,
    fullName: employee.fullName || employee.name || employee.username || null,
  };
}

function normalizeOrder(order: any) {
  if (!order) return null;

  return {
    id: order.id,
    documentId: order.documentId,
    code: order.code,
  };
}

function getRelationId(value: any): number | null {
  if (!value) return null;
  if (typeof value === 'number') return value > 0 ? value : null;
  if (typeof value === 'string') {
    const parsed = Number(value);
    return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
  }
  const parsed = Number(value.id);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

function normalizePaymentRow(row: any) {
  return {
    id: row.id,
    documentId: row.documentId,
    amount: row.amount,
    method: row.method,
    paidAt: row.paidAt,
    note: row.note,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    order: normalizeOrder(row.order),
    customer: normalizeCustomer(row.customer),
    department: normalizeDepartment(row.department),
    collectedBy: normalizeEmployee(row.collectedBy),
  };
}

function mergeWhere(baseWhere: Record<string, unknown>, scopeWhere: Record<string, unknown>) {
  if (!baseWhere || Object.keys(baseWhere).length === 0) return scopeWhere;
  if (!scopeWhere || Object.keys(scopeWhere).length === 0) return baseWhere;
  return {
    $and: [baseWhere, scopeWhere],
  };
}

async function resolveOrderReference(orderId: number | null) {
  if (!orderId) return null;

  return strapi.db.query('api::service-order.service-order').findOne({
    where: { id: orderId },
    populate: ['department', 'customer', 'assignedEmployee'],
  });
}

export default factories.createCoreController(PAYMENT_TRANSACTION_UID, () => ({
  async find(ctx) {
    const scope = await resolveCurrentUserScope(ctx);
    const viewLevel = getPaymentViewLevel(scope);
    const scopeWhere = buildPaymentScopeWhere(viewLevel, scope, ctx) as Record<string, unknown>;

    const page = parsePositiveInt(ctx.query?.page, 1);
    const pageSize = parsePositiveInt(ctx.query?.pageSize, 20);
    const safePageSize = Math.min(pageSize, 200);
    const sort = parseSort(ctx.query?.sort);

    const departmentId = parseOptionalPositiveInt(ctx.query?.department);
    const customerId = parseOptionalPositiveInt(ctx.query?.customer);
    const collectedById = parseOptionalPositiveInt(ctx.query?.collectedBy);
    const orderId = parseOptionalPositiveInt(ctx.query?.order);

    const method = typeof ctx.query?.method === 'string' ? ctx.query.method.trim() : '';
    const orderCode = typeof ctx.query?.orderCode === 'string' ? ctx.query.orderCode.trim() : '';

    const dateFromIso = toDateStartIso(typeof ctx.query?.dateFrom === 'string' ? ctx.query.dateFrom : undefined);
    const dateToIso = toDateEndIso(typeof ctx.query?.dateTo === 'string' ? ctx.query.dateTo : undefined);

    const andWhere: Record<string, unknown>[] = [];

    if (departmentId) andWhere.push({ department: { id: departmentId } });
    if (customerId) andWhere.push({ customer: { id: customerId } });
    if (collectedById) andWhere.push({ collectedBy: { id: collectedById } });
    if (orderId) andWhere.push({ order: { id: orderId } });
    if (method) andWhere.push({ method });
    if (orderCode) andWhere.push({ order: { code: { $containsi: orderCode } } });

    if (dateFromIso) andWhere.push({ paidAt: { $gte: dateFromIso } });
    if (dateToIso) andWhere.push({ paidAt: { $lte: dateToIso } });

    const baseWhere = (andWhere.length > 1 ? { $and: andWhere } : andWhere[0] || {}) as Record<string, unknown>;
    const where = mergeWhere(baseWhere, scopeWhere);

    const total = await strapi.db.query(PAYMENT_TRANSACTION_UID).count({ where });
    const start = (page - 1) * safePageSize;

    const rows = await strapi.db.query(PAYMENT_TRANSACTION_UID).findMany({
      where,
      orderBy: [{ [sort.field]: sort.order }],
      offset: start,
      limit: safePageSize,
      populate: ['order', 'customer', 'department', 'collectedBy'],
    });

    ctx.body = {
      data: (rows || []).map((row: any) => normalizePaymentRow(row)),
      meta: {
        pagination: {
          page,
          pageSize: safePageSize,
          total,
          pageCount: Math.ceil(total / safePageSize),
        },
      },
    };
  },

  async list(ctx) {
    return (this as any).find(ctx, undefined);
  },

  async findOne(ctx) {
    const id = Number(ctx.params?.id);
    if (!Number.isInteger(id) || id <= 0) {
      return ctx.badRequest('Invalid payment id');
    }

    const scope = await resolveCurrentUserScope(ctx);
    const viewLevel = getPaymentViewLevel(scope);
    const scopeWhere = buildPaymentScopeWhere(viewLevel, scope, ctx) as Record<string, unknown>;

    const basePayment = await strapi.db.query(PAYMENT_TRANSACTION_UID).findOne({
      where: { id },
      populate: ['order', 'customer', 'department', 'collectedBy'],
    });

    if (!basePayment) {
      return ctx.notFound('Payment not found');
    }

    const where = mergeWhere({ id }, scopeWhere);

    const payment = await strapi.db.query(PAYMENT_TRANSACTION_UID).findOne({
      where,
      populate: ['order', 'customer', 'department', 'collectedBy'],
    });

    if (!payment) {
      return ctx.forbidden('You do not have permission to view this payment');
    }

    ctx.body = {
      data: normalizePaymentRow(payment),
    };
  },

  async create(ctx) {
    const scope = await resolveCurrentUserScope(ctx);
    const createLevel = getPaymentCreateLevel(scope);

    if (createLevel === 'NONE') {
      return ctx.forbidden('You do not have permission to create payment');
    }

    const data = (ctx.request?.body?.data || {}) as Record<string, unknown>;
    const orderId = extractDataRelationId(data, 'order');
    const payloadDepartmentId = extractDataRelationId(data, 'department');
    const payloadCollectedById = extractDataRelationId(data, 'collectedBy');

    const order = await resolveOrderReference(orderId);
    const orderDepartmentId = getRelationId(order?.department);
    const orderCustomerId = getRelationId(order?.customer);
    const targetDepartmentId = payloadDepartmentId || orderDepartmentId;

    if (orderId && !order) {
      return ctx.badRequest('Order not found');
    }

    assertDepartmentInScope(
      {
        departmentId: targetDepartmentId,
        level: createLevel,
        scope,
      },
      ctx,
      'You do not have permission to create payment in this department'
    );

    if (createLevel === 'SELF') {
      data.collectedBy = scope.employeeId;
      assertEmployeeSelf(
        {
          employeeId: scope.employeeId,
          level: createLevel,
          scope,
        },
        ctx,
        'Current user is not linked to an employee profile'
      );
    } else if (createLevel !== 'ALL' && payloadCollectedById && !scope.employeeId) {
      return ctx.forbidden('Current user is not linked to an employee profile');
    }

    if (payloadCollectedById && createLevel === 'SELF' && payloadCollectedById !== scope.employeeId) {
      return ctx.forbidden('You do not have permission to create payment for another collector');
    }

    if (!payloadDepartmentId && orderDepartmentId) {
      data.department = orderDepartmentId;
    }

    if (!extractDataRelationId(data, 'customer') && orderCustomerId) {
      data.customer = orderCustomerId;
    }

    const created = await strapi.entityService.create(PAYMENT_TRANSACTION_UID, {
      data: data as any,
      populate: ['order', 'customer', 'department', 'collectedBy'],
    });

    ctx.body = {
      data: normalizePaymentRow(created),
    };
  },

  async update(ctx) {
    const id = Number(ctx.params?.id);
    if (!Number.isInteger(id) || id <= 0) {
      return ctx.badRequest('Invalid payment id');
    }

    const scope = await resolveCurrentUserScope(ctx);
    const updateLevel = getPaymentUpdateLevel(scope);

    if (updateLevel === 'NONE') {
      return ctx.forbidden('You do not have permission to update this payment');
    }

    const existing = await strapi.db.query(PAYMENT_TRANSACTION_UID).findOne({
      where: { id },
      populate: ['order', 'department', 'collectedBy', 'customer'],
    });

    if (!existing) {
      return ctx.notFound('Payment not found');
    }

    const existingDepartmentId = getRelationId(existing.department) || getRelationId(existing.order?.department);
    const existingCollectedById = getRelationId(existing.collectedBy);

    if (updateLevel === 'DEPARTMENT') {
      assertDepartmentInScope(
        {
          departmentId: existingDepartmentId,
          level: updateLevel,
          scope,
        },
        ctx,
        'You do not have permission to update this payment'
      );
    }

    if (updateLevel === 'SELF' && existingCollectedById !== scope.employeeId) {
      return ctx.forbidden('You do not have permission to update this payment');
    }

    const data = (ctx.request?.body?.data || {}) as Record<string, unknown>;
    const requestedOrderId = extractDataRelationId(data, 'order');
    const requestedDepartmentId = extractDataRelationId(data, 'department');
    const requestedCollectedById = extractDataRelationId(data, 'collectedBy');

    const targetOrder = requestedOrderId ? await resolveOrderReference(requestedOrderId) : null;
    if (requestedOrderId && !targetOrder) {
      return ctx.badRequest('Order not found');
    }

    const targetDepartmentId =
      requestedDepartmentId || getRelationId(targetOrder?.department) || existingDepartmentId;

    assertDepartmentInScope(
      {
        departmentId: targetDepartmentId,
        level: updateLevel,
        scope,
      },
      ctx,
      'You do not have permission to update payment in this department'
    );

    if (updateLevel === 'SELF') {
      const targetCollectedById = requestedCollectedById || existingCollectedById;
      assertEmployeeSelf(
        {
          employeeId: targetCollectedById,
          level: updateLevel,
          scope,
        },
        ctx,
        'You do not have permission to update payment collector'
      );
    }

    if (requestedOrderId && !requestedDepartmentId) {
      data.department = getRelationId(targetOrder?.department);
    }

    if (requestedOrderId && !extractDataRelationId(data, 'customer')) {
      data.customer = getRelationId(targetOrder?.customer);
    }

    const updated = await strapi.entityService.update(PAYMENT_TRANSACTION_UID, id, {
      data: data as any,
      populate: ['order', 'customer', 'department', 'collectedBy'],
    });

    ctx.body = {
      data: normalizePaymentRow(updated),
    };
  },

  async delete(ctx) {
    return ctx.forbidden('Deleting payments is not allowed');
  },
}));
