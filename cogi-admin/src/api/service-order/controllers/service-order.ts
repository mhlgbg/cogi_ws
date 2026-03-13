import { factories } from '@strapi/strapi';
import {
  ORDER_KEYS,
  assertDepartmentInScope,
  assertEmployeeSelf,
  buildOrderScopeWhere,
  canAccessSalesCounter,
  extractDataRelationId,
  getOrderUpdateLevel,
  getOrderViewLevel,
  hasPermission,
  resolveCurrentUserScope,
} from '../services/service-sales-access';
import { generateServiceOrderCode } from '../services/generate-service-order-code';

const SERVICE_ORDER_UID = 'api::service-order.service-order';
const CUSTOMER_UID = 'api::customer.customer';
const SERVICE_ITEM_UID = 'api::service-item.service-item';
const DEPARTMENT_UID = 'api::department.department';

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

function toSafeString(value: unknown): string {
  return String(value || '').trim();
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
  const defaultSort: SortConfig = { field: 'orderDate', order: 'desc' };
  if (typeof input !== 'string' || !input.trim()) return defaultSort;

  const [rawField, rawOrder] = input.split(':');
  const field = String(rawField || '').trim();
  const order = String(rawOrder || '').trim().toLowerCase();

  const allowedFields = new Set(['orderDate', 'createdAt', 'totalAmount', 'paidAmount', 'debtAmount', 'code']);
  if (!allowedFields.has(field)) return defaultSort;

  if (order !== 'asc' && order !== 'desc') return defaultSort;

  return {
    field,
    order: order as SortOrder,
  };
}

function toNullableString(value: unknown): string | null {
  const normalized = String(value || '').trim();
  return normalized ? normalized : null;
}

function buildCustomerCodePrefix(date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `CUS${year}${month}${day}`;
}

function parseCustomerCodeSerial(code: unknown, prefix: string): number {
  const raw = String(code || '').trim().toUpperCase();
  if (!raw.startsWith(prefix)) return 0;

  const serialRaw = raw.slice(prefix.length).replace(/[^0-9]/g, '');
  const serial = Number(serialRaw);
  return Number.isInteger(serial) && serial > 0 ? serial : 0;
}

async function generateCustomerCode(): Promise<string> {
  const prefix = buildCustomerCodePrefix();

  const latest = await strapi.db.query(CUSTOMER_UID).findMany({
    where: {
      code: {
        $startsWith: prefix,
      },
    },
    select: ['code'],
    orderBy: [{ code: 'desc' }],
    limit: 1,
  });

  const latestCode = Array.isArray(latest) && latest.length > 0 ? latest[0]?.code : null;
  const nextSerial = parseCustomerCodeSerial(latestCode, prefix) + 1;
  return `${prefix}${String(nextSerial).padStart(4, '0')}`;
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

function normalizeLookupCustomer(customer: any) {
  if (!customer) return null;

  return {
    id: customer.id,
    code: customer.code,
    name: customer.name,
    phone: customer.phone || null,
    isDefaultRetailGuest: Boolean(customer.isDefaultRetailGuest),
  };
}

function normalizeLookupServiceItem(item: any) {
  if (!item) return null;

  const category = item.category
    ? {
        id: item.category.id,
        code: item.category.code,
        name: item.category.name,
      }
    : null;

  return {
    id: item.id,
    code: item.code,
    name: item.name,
    unit: item.unit || null,
    defaultPrice: Number(item.defaultPrice || 0),
    category,
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
    employeeCode: employee.employeeCode || null,
    fullName: employee.fullName || employee.name || employee.username || null,
    currentDepartment: normalizeDepartment(employee.currentDepartment),
  };
}

function normalizeAttachment(file: any) {
  if (!file) return null;

  return {
    id: file.id,
    documentId: file.documentId,
    name: file.name,
    url: file.url,
  };
}

function normalizeServiceItem(item: any) {
  if (!item) return null;

  return {
    id: item.id,
    documentId: item.documentId,
    code: item.code,
    name: item.name,
    unit: item.unit || null,
    defaultPrice: Number(item.defaultPrice || 0),
  };
}

function normalizeOrderItem(item: any) {
  if (!item) return null;

  return {
    id: item.id,
    documentId: item.documentId,
    description: item.description || null,
    quantity: Number(item.quantity || 0),
    unitPrice: Number(item.unitPrice || 0),
    amount: Number(item.amount || 0),
    sortOrder: Number(item.sortOrder || 0),
    note: item.note || null,
    serviceItem: normalizeServiceItem(item.serviceItem),
    attachments: Array.isArray(item.attachments)
      ? item.attachments.map((file: any) => normalizeAttachment(file)).filter(Boolean)
      : [],
  };
}

function normalizePaymentRow(row: any) {
  if (!row) return null;

  return {
    id: row.id,
    documentId: row.documentId,
    amount: Number(row.amount || 0),
    method: row.method,
    paidAt: row.paidAt,
    note: row.note || null,
    collectedBy: normalizeEmployee(row.collectedBy),
    customer: normalizeCustomer(row.customer),
    department: normalizeDepartment(row.department),
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

function toMoney(value: unknown): number {
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

function calculatePaymentStatus(totalAmount: number, paidAmount: number): 'UNPAID' | 'PARTIAL' | 'PAID' {
  if (totalAmount <= 0 && paidAmount <= 0) return 'UNPAID';
  if (paidAmount <= 0) return 'UNPAID';
  if (paidAmount > 0 && paidAmount < totalAmount) return 'PARTIAL';
  if (paidAmount >= totalAmount && totalAmount > 0) return 'PAID';
  return 'UNPAID';
}

function parseBooleanFlag(value: unknown): boolean {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value === 1;
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    return ['1', 'true', 'yes', 'on'].includes(normalized);
  }
  return false;
}

async function computeOrderSummary(where: Record<string, unknown>) {
  const batchSize = 500;
  let offset = 0;

  let totalAmount = 0;
  let paidAmount = 0;
  let debtAmount = 0;

  while (true) {
    const rows = await strapi.db.query(SERVICE_ORDER_UID).findMany({
      where,
      select: ['id', 'totalAmount', 'paidAmount'],
      populate: ['items', 'payments'],
      offset,
      limit: batchSize,
    });

    if (!Array.isArray(rows) || rows.length === 0) {
      break;
    }

    for (const row of rows) {
      const normalizedItems = Array.isArray((row as any)?.items)
        ? (row as any).items.map((item: any) => normalizeOrderItem(item)).filter(Boolean)
        : [];

      const normalizedPayments = Array.isArray((row as any)?.payments)
        ? (row as any).payments.map((payment: any) => normalizePaymentRow(payment)).filter(Boolean)
        : [];

      const rowTotal = normalizedItems.length > 0
        ? roundMoney(
            normalizedItems.reduce((sum: number, item: any) => sum + clampNonNegative(toMoney(item?.amount)), 0)
          )
        : roundMoney(toMoney((row as any)?.totalAmount));

      const rowPaid = normalizedPayments.length > 0
        ? roundMoney(
            normalizedPayments.reduce((sum: number, payment: any) => sum + clampNonNegative(toMoney(payment?.amount)), 0)
          )
        : roundMoney(toMoney((row as any)?.paidAmount));

      const rowDebt = roundMoney(clampNonNegative(rowTotal - rowPaid));

      totalAmount += rowTotal;
      paidAmount += rowPaid;
      debtAmount += rowDebt;
    }

    if (rows.length < batchSize) {
      break;
    }

    offset += rows.length;
  }

  return {
    totalAmount: roundMoney(totalAmount),
    paidAmount: roundMoney(paidAmount),
    debtAmount: roundMoney(debtAmount),
  };
}

function normalizeOrderRow(row: any) {
  const normalizedItems = Array.isArray(row.items)
    ? row.items.map((item: any) => normalizeOrderItem(item)).filter(Boolean)
    : [];

  const normalizedPayments = Array.isArray(row.payments)
    ? row.payments.map((payment: any) => normalizePaymentRow(payment)).filter(Boolean)
    : [];

  const totalAmount = normalizedItems.length > 0
    ? roundMoney(
        normalizedItems.reduce((sum: number, item: any) => sum + clampNonNegative(toMoney(item?.amount)), 0)
      )
    : roundMoney(toMoney(row.totalAmount));

  const paidAmount = normalizedPayments.length > 0
    ? roundMoney(
        normalizedPayments.reduce((sum: number, payment: any) => sum + clampNonNegative(toMoney(payment?.amount)), 0)
      )
    : roundMoney(toMoney(row.paidAmount));

  const debtAmount = roundMoney(clampNonNegative(totalAmount - paidAmount));
  const paymentStatus = calculatePaymentStatus(totalAmount, paidAmount);

  return {
    id: row.id,
    documentId: row.documentId,
    code: row.code,
    orderDate: row.orderDate,
    status: row.status,
    paymentStatus,
    source: row.source,
    totalAmount,
    paidAmount,
    debtAmount,
    description: row.description,
    note: row.note,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    customer: normalizeCustomer(row.customer),
    department: normalizeDepartment(row.department),
    assignedEmployee: normalizeEmployee(row.assignedEmployee),
    itemsCount: normalizedItems.length,
    items: normalizedItems,
    payments: normalizedPayments,
  };
}

function mergeWhere(baseWhere: Record<string, unknown>, scopeWhere: Record<string, unknown>) {
  if (!baseWhere || Object.keys(baseWhere).length === 0) return scopeWhere;
  if (!scopeWhere || Object.keys(scopeWhere).length === 0) return baseWhere;
  return {
    $and: [baseWhere, scopeWhere],
  };
}

export default factories.createCoreController(SERVICE_ORDER_UID, () => ({
  async find(ctx) {
    const scope = await resolveCurrentUserScope(ctx);
    const viewLevel = getOrderViewLevel(scope);
    const scopeWhere = buildOrderScopeWhere(viewLevel, scope, ctx) as Record<string, unknown>;

    const page = parsePositiveInt(ctx.query?.page, 1);
    const pageSize = parsePositiveInt(ctx.query?.pageSize, 20);
    const safePageSize = Math.min(pageSize, 200);
    const sort = parseSort(ctx.query?.sort);

    const departmentId = parseOptionalPositiveInt(ctx.query?.department);
    const assignedEmployeeId = parseOptionalPositiveInt(ctx.query?.assignedEmployee);
    const customerId = parseOptionalPositiveInt(ctx.query?.customer);
    const status = typeof ctx.query?.status === 'string' ? ctx.query.status.trim() : '';
    const paymentStatus = typeof ctx.query?.paymentStatus === 'string' ? ctx.query.paymentStatus.trim() : '';
    const source = typeof ctx.query?.source === 'string' ? ctx.query.source.trim() : '';
    const codeLike = typeof ctx.query?.code === 'string' ? ctx.query.code.trim() : '';
    const customerName = typeof ctx.query?.customerName === 'string' ? ctx.query.customerName.trim() : '';
    const customerPhone = typeof ctx.query?.customerPhone === 'string' ? ctx.query.customerPhone.trim() : '';
    const keyword = typeof ctx.query?.keyword === 'string' ? ctx.query.keyword.trim() : '';
    const includeSummary = parseBooleanFlag(ctx.query?.includeSummary);
    const unpaidOnly = parseBooleanFlag(ctx.query?.unpaidOnly);

    const dateFromIso = toDateStartIso(typeof ctx.query?.dateFrom === 'string' ? ctx.query.dateFrom : undefined);
    const dateToIso = toDateEndIso(typeof ctx.query?.dateTo === 'string' ? ctx.query.dateTo : undefined);

    const andWhere: Record<string, unknown>[] = [];

    if (departmentId) andWhere.push({ department: { id: departmentId } });
    if (assignedEmployeeId) andWhere.push({ assignedEmployee: { id: assignedEmployeeId } });
    if (customerId) andWhere.push({ customer: { id: customerId } });
    if (status) andWhere.push({ status });
    if (paymentStatus) andWhere.push({ paymentStatus });
    if (unpaidOnly && !paymentStatus) andWhere.push({ paymentStatus: { $ne: 'PAID' } });
    if (source) andWhere.push({ source });
    if (codeLike) andWhere.push({ code: { $containsi: codeLike } });
    if (customerName) andWhere.push({ customer: { name: { $containsi: customerName } } });
    if (customerPhone) andWhere.push({ customer: { phone: { $containsi: customerPhone } } });

    if (dateFromIso) andWhere.push({ orderDate: { $gte: dateFromIso } });
    if (dateToIso) andWhere.push({ orderDate: { $lte: dateToIso } });

    if (keyword) {
      andWhere.push({
        $or: [
          { code: { $containsi: keyword } },
          { customer: { name: { $containsi: keyword } } },
          { customer: { phone: { $containsi: keyword } } },
          { description: { $containsi: keyword } },
          { note: { $containsi: keyword } },
        ],
      });
    }

    const baseWhere = (andWhere.length > 1 ? { $and: andWhere } : andWhere[0] || {}) as Record<string, unknown>;
    const where = mergeWhere(baseWhere, scopeWhere);

    const total = await strapi.db.query(SERVICE_ORDER_UID).count({ where });
    const start = (page - 1) * safePageSize;

    const rows = await strapi.db.query(SERVICE_ORDER_UID).findMany({
      where,
      orderBy: [{ [sort.field]: sort.order }],
      offset: start,
      limit: safePageSize,
      populate: ['customer', 'department', 'assignedEmployee', 'items'],
    });

    const summary = includeSummary
      ? await computeOrderSummary(where)
      : null;

    ctx.body = {
      data: (rows || []).map((row: any) => normalizeOrderRow(row)),
      meta: {
        pagination: {
          page,
          pageSize: safePageSize,
          total,
          pageCount: Math.ceil(total / safePageSize),
        },
        summary,
      },
    };
  },

  async list(ctx) {
    return (this as any).find(ctx, undefined);
  },

  async findOne(ctx) {
    const id = Number(ctx.params?.id);
    if (!Number.isInteger(id) || id <= 0) {
      return ctx.badRequest('Invalid order id');
    }

    const scope = await resolveCurrentUserScope(ctx);
    const viewLevel = getOrderViewLevel(scope);
    const scopeWhere = buildOrderScopeWhere(viewLevel, scope, ctx) as Record<string, unknown>;

    const baseOrder = await strapi.db.query(SERVICE_ORDER_UID).findOne({
      where: { id },
      populate: ['customer', 'department', 'assignedEmployee', 'items'],
    });

    if (!baseOrder) {
      return ctx.notFound('Order not found');
    }

    const where = mergeWhere({ id }, scopeWhere);

    const order = await strapi.db.query(SERVICE_ORDER_UID).findOne({
      where,
      populate: {
        customer: true,
        department: true,
        assignedEmployee: true,
        items: {
          populate: {
            serviceItem: true,
            attachments: true,
          },
        },
        payments: {
          populate: {
            collectedBy: true,
            customer: true,
            department: true,
          },
        },
      },
    });

    if (!order) {
      return ctx.forbidden('You do not have permission to view this order');
    }

    ctx.body = {
      data: normalizeOrderRow(order),
    };
  },

  async create(ctx) {
    const scope = await resolveCurrentUserScope(ctx);
    const canUseSalesCounter = canAccessSalesCounter(scope);

    if (!hasPermission(scope, ORDER_KEYS.CREATE) && !hasPermission(scope, 'service-orders') && !canUseSalesCounter) {
      return ctx.forbidden('You do not have permission to create order');
    }

    const resolvedLevel = getOrderViewLevel(scope);
    const viewLevel = resolvedLevel === 'NONE' && canUseSalesCounter ? 'DEPARTMENT' : resolvedLevel;

    if (viewLevel === 'NONE') {
      return ctx.forbidden('You do not have permission to create order');
    }

    const data = (ctx.request?.body?.data || {}) as Record<string, unknown>;
    const departmentId = extractDataRelationId(data, 'department');

    assertDepartmentInScope(
      {
        departmentId,
        level: viewLevel,
        scope,
      },
      ctx,
      'You do not have permission to create order in this department'
    );

    if (viewLevel === 'SELF') {
      const assignedEmployeeId = extractDataRelationId(data, 'assignedEmployee');

      if (!assignedEmployeeId) {
        data.assignedEmployee = scope.employeeId;
      }

      assertEmployeeSelf(
        {
          employeeId: extractDataRelationId(data, 'assignedEmployee') || assignedEmployeeId,
          level: viewLevel,
          scope,
        },
        ctx,
        'You do not have permission to assign this order to another employee'
      );
    }

    const providedCode = toSafeString(data.code);
    if (providedCode) {
      data.code = providedCode.toUpperCase();
    } else {
      data.code = await generateServiceOrderCode(data);
    }

    const created = await strapi.entityService.create(SERVICE_ORDER_UID, {
      data: data as any,
      populate: ['customer', 'department', 'assignedEmployee', 'items'],
    });

    ctx.body = {
      data: normalizeOrderRow(created),
    };
  },

  async update(ctx) {
    const id = Number(ctx.params?.id);
    if (!Number.isInteger(id) || id <= 0) {
      return ctx.badRequest('Invalid order id');
    }

    const scope = await resolveCurrentUserScope(ctx);
    const updateLevel = getOrderUpdateLevel(scope);

    if (updateLevel === 'NONE') {
      return ctx.forbidden('You do not have permission to update this order');
    }

    const existing = await strapi.db.query(SERVICE_ORDER_UID).findOne({
      where: { id },
      populate: ['department', 'assignedEmployee', 'customer', 'items'],
    });

    if (!existing) {
      return ctx.notFound('Order not found');
    }

    const existingDepartmentId = getRelationId(existing.department);
    const existingAssignedEmployeeId = getRelationId(existing.assignedEmployee);

    if (updateLevel === 'DEPARTMENT') {
      assertDepartmentInScope(
        {
          departmentId: existingDepartmentId,
          level: updateLevel,
          scope,
        },
        ctx,
        'You do not have permission to update this order'
      );
    }

    if (updateLevel === 'SELF' && existingAssignedEmployeeId !== scope.employeeId) {
      return ctx.forbidden('You do not have permission to update this order');
    }

    const data = (ctx.request?.body?.data || {}) as Record<string, unknown>;

    const requestedDepartmentId = extractDataRelationId(data, 'department');
    const targetDepartmentId = requestedDepartmentId || existingDepartmentId;

    assertDepartmentInScope(
      {
        departmentId: targetDepartmentId,
        level: updateLevel,
        scope,
      },
      ctx,
      'You do not have permission to update order in this department'
    );

    if (updateLevel === 'SELF') {
      const requestedAssignedEmployeeId = extractDataRelationId(data, 'assignedEmployee');
      const targetAssignedEmployeeId = requestedAssignedEmployeeId || existingAssignedEmployeeId;

      assertEmployeeSelf(
        {
          employeeId: targetAssignedEmployeeId,
          level: updateLevel,
          scope,
        },
        ctx,
        'You do not have permission to re-assign this order'
      );
    }

    const updated = await strapi.entityService.update(SERVICE_ORDER_UID, id, {
      data: data as any,
      populate: ['customer', 'department', 'assignedEmployee', 'items'],
    });

    ctx.body = {
      data: normalizeOrderRow(updated),
    };
  },

  async lookupCustomers(ctx) {
    const scope = await resolveCurrentUserScope(ctx);
    const viewLevel = getOrderViewLevel(scope);
    const canManageCustomers = canAccessSalesCounter(scope) || hasPermission(scope, 'customers');

    if (viewLevel === 'NONE' && !canManageCustomers) {
      return ctx.forbidden('You do not have permission to view customers lookup');
    }

    const keyword = typeof ctx.query?.keyword === 'string' ? ctx.query.keyword.trim() : '';
    const limit = Math.min(parsePositiveInt(ctx.query?.limit, 100), 200);

    const where: Record<string, unknown> = {
      isActive: true,
    };

    if (keyword) {
      where.$or = [
        { name: { $containsi: keyword } },
        { phone: { $containsi: keyword } },
        { code: { $containsi: keyword } },
        { zalo: { $containsi: keyword } },
      ];
    }

    const rows = await strapi.db.query(CUSTOMER_UID).findMany({
      where,
      orderBy: [{ isDefaultRetailGuest: 'desc' }, { name: 'asc' }, { code: 'asc' }],
      limit,
    });

    ctx.body = {
      data: (rows || []).map((row: any) => normalizeLookupCustomer(row)).filter(Boolean),
    };
  },

  async quickCreateCustomer(ctx) {
    const scope = await resolveCurrentUserScope(ctx);
    const canManageCustomers = canAccessSalesCounter(scope) || hasPermission(scope, 'customers');

    if (!canManageCustomers) {
      return ctx.forbidden('You do not have permission to create customer from sales counter');
    }

    const data = (ctx.request?.body?.data || {}) as Record<string, unknown>;
    const name = toNullableString(data.name);

    if (!name) {
      return ctx.badRequest('Customer name is required');
    }

    const createPayload: Record<string, unknown> = {
      name,
      phone: toNullableString(data.phone),
      zalo: toNullableString(data.zalo),
      address: toNullableString(data.address),
      note: toNullableString(data.note),
      customerType: 'RETAIL',
      allowDebt: false,
      debtLimit: 0,
      isDefaultRetailGuest: false,
      isActive: true,
    };

    let lastError: unknown = null;

    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        createPayload.code = await generateCustomerCode();

        const created = await strapi.entityService.create(CUSTOMER_UID, {
          data: createPayload as any,
        });

        ctx.body = {
          data: normalizeLookupCustomer(created),
        };
        return;
      } catch (error) {
        lastError = error;
      }
    }

    throw lastError;
  },

  async lookupServiceItems(ctx) {
    const scope = await resolveCurrentUserScope(ctx);
    const viewLevel = getOrderViewLevel(scope);

    if (viewLevel === 'NONE' && !canAccessSalesCounter(scope)) {
      return ctx.forbidden('You do not have permission to view service items lookup');
    }

    const keyword = typeof ctx.query?.keyword === 'string' ? ctx.query.keyword.trim() : '';
    const categoryId = parseOptionalPositiveInt(ctx.query?.category);
    const limit = Math.min(parsePositiveInt(ctx.query?.limit, 200), 500);

    const where: Record<string, unknown> = {
      isActive: true,
    };

    if (categoryId) {
      where.category = {
        id: categoryId,
        isActive: true,
      };
    }

    if (keyword) {
      where.$or = [
        { name: { $containsi: keyword } },
        { code: { $containsi: keyword } },
      ];
    }

    const rows = await strapi.db.query(SERVICE_ITEM_UID).findMany({
      where,
      populate: ['category'],
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }, { code: 'asc' }],
      limit,
    });

    ctx.body = {
      data: (rows || []).map((row: any) => normalizeLookupServiceItem(row)).filter(Boolean),
    };
  },

  async counterContext(ctx) {
    const scope = await resolveCurrentUserScope(ctx);

    if (!canAccessSalesCounter(scope)) {
      return ctx.forbidden('You do not have permission to access sales counter');
    }

    const departmentIds = Array.from(
      new Set(
        (scope.accessibleDepartmentIds || [])
          .map((value: unknown) => Number(value))
          .filter((value: number) => Number.isInteger(value) && value > 0)
      )
    );

    const departments = departmentIds.length
      ? await strapi.db.query(DEPARTMENT_UID).findMany({
          where: {
            id: {
              $in: departmentIds,
            },
            isActive: true,
          },
          select: ['id', 'documentId', 'name', 'code', 'isActive'],
          orderBy: [{ name: 'asc' }],
        })
      : [];

    const departmentMap = new Map((departments || []).map((item: any) => [Number(item.id), item]));
    const sortedDepartments = departmentIds
      .map((id) => departmentMap.get(id))
      .filter(Boolean)
      .map((item: any) => normalizeDepartment(item));

    ctx.body = {
      data: {
        employee: normalizeEmployee(scope.employee),
        accessibleDepartments: sortedDepartments,
      },
    };
  },

  async delete(ctx) {
    return ctx.forbidden('Deleting service orders is not allowed');
  },
}));
