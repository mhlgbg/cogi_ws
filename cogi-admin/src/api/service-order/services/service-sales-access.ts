import { mergeTenantWhere, resolveCurrentTenantId } from '../../../utils/tenant-scope';

const USER_UID = 'plugin::users-permissions.user';
const USER_TENANT_UID = 'api::user-tenant.user-tenant';
const USER_TENANT_ROLE_UID = 'api::user-tenant-role.user-tenant-role';
const ROLE_FEATURE_UID = 'api::role-feature.role-feature';
const EMPLOYEE_UID = 'api::employee.employee';
const EMPLOYEE_HISTORY_UID = 'api::employee-history.employee-history';

const SALES_COUNTER_MANAGE_KEYS = [
  'sales-counter.manage',
  'sales-counters.manage',
  'salesCounter.manage',
  'salesCounters.manage',
];

const NON_EDITABLE_ORDER_STATUS_KEYS = new Set([
  'READY',
  'DELIVERED',
]);

export type ScopeLevel = 'ALL' | 'DEPARTMENT' | 'SELF' | 'NONE';

export type CurrentUserScope = {
  tenantId: number | string;
  userId: number;
  roleId: number | null;
  roleName: string | null;
  permissionKeys: Set<string>;
  employee: any | null;
  employeeId: number | null;
  accessibleDepartmentIds: number[];
};

function hasAnyPermission(permissionKeys: Set<string>, keys: string[]): boolean {
  return keys.some((key) => permissionKeys.has(key));
}

function normalizeOrderStateKey(value: unknown): string {
  return String(value || '')
    .trim()
    .replace(/[\s-]+/g, '_')
    .toUpperCase();
}

export function isOrderEditableState(order: any): boolean {
  const statusKey = normalizeOrderStateKey(order?.status);
  if (!statusKey) return true;
  return !NON_EDITABLE_ORDER_STATUS_KEYS.has(statusKey);
}

const ORDER_PERMISSION = {
  LEGACY_ALL: 'service-orders',
  VIEW_SELF: 'serviceSales.order.view.self',
  VIEW_DEPARTMENT: 'serviceSales.order.view.department',
  VIEW_ALL: 'serviceSales.order.view.all',
  CREATE: 'serviceSales.order.create',
  UPDATE_SELF: 'serviceSales.order.update.self',
  UPDATE_DEPARTMENT: 'serviceSales.order.update.department',
  UPDATE_ALL: 'serviceSales.order.update.all',
};

const PAYMENT_PERMISSION = {
  LEGACY_ALL: 'service-orders',
  VIEW_SELF: 'serviceSales.payment.view.self',
  VIEW_DEPARTMENT: 'serviceSales.payment.view.department',
  VIEW_ALL: 'serviceSales.payment.view.all',
  CREATE_SELF: 'serviceSales.payment.create.self',
  CREATE_DEPARTMENT: 'serviceSales.payment.create.department',
  CREATE_ALL: 'serviceSales.payment.create.all',
  UPDATE_SELF: 'serviceSales.payment.update.self',
  UPDATE_DEPARTMENT: 'serviceSales.payment.update.department',
  UPDATE_ALL: 'serviceSales.payment.update.all',
};

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

  return null;
}

function toForbidden(ctx: any, message: string) {
  if (typeof ctx?.forbidden === 'function') {
    return ctx.forbidden(message);
  }
  if (typeof ctx?.throw === 'function') {
    return ctx.throw(403, message);
  }
  const error = new Error(message) as Error & { status?: number };
  error.status = 403;
  throw error;
}

function toUnauthorized(ctx: any, message = 'Unauthorized') {
  if (typeof ctx?.unauthorized === 'function') {
    return ctx.unauthorized(message);
  }
  if (typeof ctx?.throw === 'function') {
    return ctx.throw(401, message);
  }
  const error = new Error(message) as Error & { status?: number };
  error.status = 401;
  throw error;
}

async function getPermissionKeysByRoleId(roleId: number | null): Promise<Set<string>> {
  if (!roleId) return new Set();

  const mappings = await strapi.db.query(ROLE_FEATURE_UID).findMany({
    where: { role: roleId },
    populate: ['feature'],
  });

  return new Set(
    (mappings || [])
      .map((item: any) => item?.feature?.key)
      .filter((key: string | null | undefined): key is string => typeof key === 'string' && key.length > 0)
  );
}

async function getPermissionKeysByRoleIds(roleIds: number[]): Promise<Set<string>> {
  const uniqueRoleIds = Array.from(new Set(roleIds.filter((roleId) => Number.isInteger(roleId) && roleId > 0)));
  if (uniqueRoleIds.length === 0) return new Set();

  const mappings = await strapi.db.query(ROLE_FEATURE_UID).findMany({
    where: {
      role: {
        id: {
          $in: uniqueRoleIds,
        },
      },
    },
    populate: ['feature'],
  });

  return new Set(
    (mappings || [])
      .map((item: any) => item?.feature?.key)
      .filter((key: string | null | undefined): key is string => typeof key === 'string' && key.length > 0)
  );
}

function normalizeRoleName(value: unknown): string {
  return String(value || '').trim().toLowerCase();
}

function isSalesCounterRoleName(value: unknown): boolean {
  const normalized = normalizeRoleName(value);
  if (!normalized) return false;

  return (
    normalized === 'sales counter' ||
    normalized === 'sales-counter' ||
    normalized === 'salescounter' ||
    normalized === 'counter sales'
  );
}

async function findLatestEmployee(where: Record<string, unknown>, tenantId: number | string) {
  const employees = await strapi.db.query(EMPLOYEE_UID).findMany({
    where: mergeTenantWhere(where, tenantId),
    populate: ['currentDepartment'],
    orderBy: [{ updatedAt: 'desc' }, { createdAt: 'desc' }],
    limit: 1,
  });

  if (!Array.isArray(employees) || employees.length === 0) {
    return null;
  }

  return employees[0];
}

async function resolveCurrentUserEmployee(userId: number, user: any | null, tenantId: number | string) {
  const byRelation = await findLatestEmployee({ user: { id: userId } }, tenantId);
  if (byRelation) {
    return byRelation;
  }

  const userEmail = String(user?.email || '').trim();
  if (userEmail) {
    const byEmail = await findLatestEmployee({
      $or: [{ workEmail: userEmail }, { personalEmail: userEmail }],
    }, tenantId);
    if (byEmail) {
      return byEmail;
    }
  }

  const username = String(user?.username || '').trim();
  if (username) {
    const byEmployeeCode = await findLatestEmployee({ employeeCode: username }, tenantId);
    if (byEmployeeCode) {
      return byEmployeeCode;
    }
  }

  return null;
}

async function resolveAccessibleDepartmentIds(employee: any | null, tenantId: number | string): Promise<number[]> {
  const employeeId = parsePositiveInt(employee?.id);
  if (!employeeId) return [];

  const nowIso = new Date().toISOString().slice(0, 10);

  const histories = await strapi.db.query(EMPLOYEE_HISTORY_UID).findMany({
    where: mergeTenantWhere({
      employee: employeeId,
      isCurrent: true,
      startDate: { $lte: nowIso },
      $or: [{ endDate: { $null: true } }, { endDate: { $gte: nowIso } }],
    }, tenantId),
    populate: ['department'],
    orderBy: [{ isPrimary: 'desc' }, { startDate: 'desc' }, { createdAt: 'desc' }],
  });

  const fromHistory = Array.from(
    new Set(
      (histories || [])
        .map((item: any) => parsePositiveInt(item?.department?.id ?? item?.department))
        .filter((value: number | null): value is number => Boolean(value && value > 0))
    )
  );

  if (fromHistory.length > 0) {
    return fromHistory;
  }

  const currentDepartmentId = parsePositiveInt(employee?.currentDepartment?.id ?? employee?.currentDepartment);
  return currentDepartmentId ? [currentDepartmentId] : [];
}

async function findActiveUserTenant(userId: number, tenantId: number | string) {
  return strapi.db.query(USER_TENANT_UID).findOne({
    where: {
      user: userId,
      tenant: tenantId,
      userTenantStatus: 'active',
    },
    select: ['id'],
  });
}

async function findActiveUserTenantRoles(userTenantId: number) {
  return strapi.db.query(USER_TENANT_ROLE_UID).findMany({
    where: {
      userTenant: userTenantId,
      userTenantRoleStatus: 'active',
    },
    populate: {
      role: true,
    },
    orderBy: [{ isPrimary: 'desc' }, { assignedAt: 'desc' }, { createdAt: 'desc' }],
  });
}

export async function resolveCurrentUserScope(ctx: any): Promise<CurrentUserScope> {
  const tenantId = resolveCurrentTenantId(ctx);
  const authUser = ctx?.state?.user;
  const userId = parsePositiveInt(authUser?.id);

  if (!userId) {
    toUnauthorized(ctx, 'Unauthorized');
  }

  const user = await strapi.db.query(USER_UID).findOne({
    where: { id: userId as number },
    populate: ['role'],
  });

  const userTenant = await findActiveUserTenant(userId as number, tenantId);
  const userTenantId = parsePositiveInt(userTenant?.id);
  const userTenantRoles = userTenantId ? await findActiveUserTenantRoles(userTenantId) : [];

  const tenantRoles = (userTenantRoles || [])
    .map((item: any) => item?.role)
    .filter((role: any) => Boolean(parsePositiveInt(role?.id)));

  const primaryTenantRole = tenantRoles[0] ?? null;
  const tenantRoleIds = tenantRoles
    .map((role: any) => parsePositiveInt(role?.id))
    .filter((value: number | null): value is number => Boolean(value));

  const fallbackRoleId = parsePositiveInt(user?.role?.id);
  const fallbackRoleName = typeof user?.role?.name === 'string' ? user.role.name : null;

  const roleId = parsePositiveInt(primaryTenantRole?.id) ?? fallbackRoleId;
  const roleName = typeof primaryTenantRole?.name === 'string'
    ? primaryTenantRole.name
    : (typeof primaryTenantRole?.type === 'string' ? primaryTenantRole.type : fallbackRoleName);
  const permissionKeys = tenantRoleIds.length > 0
    ? await getPermissionKeysByRoleIds(tenantRoleIds)
    : await getPermissionKeysByRoleId(fallbackRoleId);
  const employee = await resolveCurrentUserEmployee(userId as number, user, tenantId);
  const employeeId = parsePositiveInt(employee?.id);
  const accessibleDepartmentIds = await resolveAccessibleDepartmentIds(employee, tenantId);

  return {
    tenantId,
    userId: userId as number,
    roleId,
    roleName,
    permissionKeys,
    employee,
    employeeId,
    accessibleDepartmentIds,
  };
}

export function canAccessSalesCounter(scope: CurrentUserScope): boolean {
  if (hasAnyPermission(scope.permissionKeys, SALES_COUNTER_MANAGE_KEYS)) return true;
  if (scope.permissionKeys.has(ORDER_PERMISSION.LEGACY_ALL)) return true;
  if (scope.permissionKeys.has(ORDER_PERMISSION.VIEW_ALL)) return true;
  if (scope.permissionKeys.has(ORDER_PERMISSION.VIEW_DEPARTMENT)) return true;
  if (scope.permissionKeys.has(ORDER_PERMISSION.VIEW_SELF)) return true;
  if (scope.permissionKeys.has(ORDER_PERMISSION.CREATE)) return true;

  return isSalesCounterRoleName(scope.roleName);
}

export function hasPermission(scope: CurrentUserScope, key: string): boolean {
  return scope.permissionKeys.has(key);
}

export function resolveLevelByKeys(
  permissionKeys: Set<string>,
  keys: { all: string; department: string; self: string }
): ScopeLevel {
  if (permissionKeys.has(keys.all)) return 'ALL';
  if (permissionKeys.has(keys.department)) return 'DEPARTMENT';
  if (permissionKeys.has(keys.self)) return 'SELF';
  return 'NONE';
}

export function getOrderViewLevel(scope: CurrentUserScope): ScopeLevel {
  if (scope.permissionKeys.has(ORDER_PERMISSION.LEGACY_ALL)) {
    return 'ALL';
  }

  if (scope.permissionKeys.has(ORDER_PERMISSION.VIEW_ALL)) {
    return 'ALL';
  }

  if (hasAnyPermission(scope.permissionKeys, SALES_COUNTER_MANAGE_KEYS)) {
    return 'DEPARTMENT';
  }

  if (isSalesCounterRoleName(scope.roleName)) {
    return 'DEPARTMENT';
  }

  return resolveLevelByKeys(scope.permissionKeys, {
    all: ORDER_PERMISSION.VIEW_ALL,
    department: ORDER_PERMISSION.VIEW_DEPARTMENT,
    self: ORDER_PERMISSION.VIEW_SELF,
  });
}

export function getOrderUpdateLevel(scope: CurrentUserScope): ScopeLevel {
  if (scope.permissionKeys.has(ORDER_PERMISSION.LEGACY_ALL)) {
    return 'ALL';
  }

  if (scope.permissionKeys.has(ORDER_PERMISSION.UPDATE_ALL)) {
    return 'ALL';
  }

  if (hasAnyPermission(scope.permissionKeys, SALES_COUNTER_MANAGE_KEYS)) {
    return isSalesCounterRoleName(scope.roleName) ? 'SELF' : 'DEPARTMENT';
  }

  return resolveLevelByKeys(scope.permissionKeys, {
    all: ORDER_PERMISSION.UPDATE_ALL,
    department: ORDER_PERMISSION.UPDATE_DEPARTMENT,
    self: ORDER_PERMISSION.UPDATE_SELF,
  });
}

export function hasOrderUpdateOverride(scope: CurrentUserScope): boolean {
  return (
    scope.permissionKeys.has(ORDER_PERMISSION.LEGACY_ALL)
    || scope.permissionKeys.has(ORDER_PERMISSION.UPDATE_ALL)
    || scope.permissionKeys.has(ORDER_PERMISSION.UPDATE_DEPARTMENT)
  );
}

export function getPaymentViewLevel(scope: CurrentUserScope): ScopeLevel {
  if (scope.permissionKeys.has(PAYMENT_PERMISSION.LEGACY_ALL)) {
    return 'ALL';
  }

  if (scope.permissionKeys.has(PAYMENT_PERMISSION.VIEW_ALL)) {
    return 'ALL';
  }

  if (hasAnyPermission(scope.permissionKeys, SALES_COUNTER_MANAGE_KEYS)) {
    return 'DEPARTMENT';
  }

  if (isSalesCounterRoleName(scope.roleName)) {
    return 'DEPARTMENT';
  }

  return resolveLevelByKeys(scope.permissionKeys, {
    all: PAYMENT_PERMISSION.VIEW_ALL,
    department: PAYMENT_PERMISSION.VIEW_DEPARTMENT,
    self: PAYMENT_PERMISSION.VIEW_SELF,
  });
}

export function getPaymentCreateLevel(scope: CurrentUserScope): ScopeLevel {
  if (scope.permissionKeys.has(PAYMENT_PERMISSION.LEGACY_ALL)) {
    return 'ALL';
  }

  if (scope.permissionKeys.has(PAYMENT_PERMISSION.CREATE_ALL)) {
    return 'ALL';
  }

  if (hasAnyPermission(scope.permissionKeys, SALES_COUNTER_MANAGE_KEYS)) {
    return 'DEPARTMENT';
  }

  if (isSalesCounterRoleName(scope.roleName)) {
    return 'DEPARTMENT';
  }

  return resolveLevelByKeys(scope.permissionKeys, {
    all: PAYMENT_PERMISSION.CREATE_ALL,
    department: PAYMENT_PERMISSION.CREATE_DEPARTMENT,
    self: PAYMENT_PERMISSION.CREATE_SELF,
  });
}

export function getPaymentUpdateLevel(scope: CurrentUserScope): ScopeLevel {
  if (scope.permissionKeys.has(PAYMENT_PERMISSION.LEGACY_ALL)) {
    return 'ALL';
  }

  if (scope.permissionKeys.has(PAYMENT_PERMISSION.UPDATE_ALL)) {
    return 'ALL';
  }

  if (hasAnyPermission(scope.permissionKeys, SALES_COUNTER_MANAGE_KEYS)) {
    return 'DEPARTMENT';
  }

  return resolveLevelByKeys(scope.permissionKeys, {
    all: PAYMENT_PERMISSION.UPDATE_ALL,
    department: PAYMENT_PERMISSION.UPDATE_DEPARTMENT,
    self: PAYMENT_PERMISSION.UPDATE_SELF,
  });
}

export function ensureScopeEmployee(scope: CurrentUserScope, ctx: any) {
  if (!scope.employeeId) {
    return toForbidden(ctx, 'Current user is not linked to an employee profile');
  }
}

export function ensureScopeDepartments(scope: CurrentUserScope, ctx: any) {
  if (!Array.isArray(scope.accessibleDepartmentIds) || scope.accessibleDepartmentIds.length === 0) {
    return toForbidden(ctx, 'Current user does not have any active department scope');
  }
}

export function buildOrderScopeWhere(level: ScopeLevel, scope: CurrentUserScope, ctx: any) {
  if (level === 'ALL') return {};

  if (level === 'DEPARTMENT') {
    ensureScopeDepartments(scope, ctx);
    return {
      department: {
        id: { $in: scope.accessibleDepartmentIds },
      },
    };
  }

  if (level === 'SELF') {
    ensureScopeEmployee(scope, ctx);
    return {
      assignedEmployee: {
        id: scope.employeeId,
      },
    };
  }

  return toForbidden(ctx, 'You do not have permission to view orders');
}

export function buildPaymentScopeWhere(level: ScopeLevel, scope: CurrentUserScope, ctx: any) {
  if (level === 'ALL') return {};

  if (level === 'DEPARTMENT') {
    ensureScopeDepartments(scope, ctx);
    return {
      department: {
        id: { $in: scope.accessibleDepartmentIds },
      },
    };
  }

  if (level === 'SELF') {
    ensureScopeEmployee(scope, ctx);
    return {
      collectedBy: {
        id: scope.employeeId,
      },
    };
  }

  return toForbidden(ctx, 'You do not have permission to view payments');
}

export function extractDataRelationId(data: Record<string, unknown> | undefined, fieldName: string): number | null {
  if (!data || !Object.prototype.hasOwnProperty.call(data, fieldName)) return null;
  return extractRelationId(data[fieldName]);
}

export function assertDepartmentInScope(
  params: {
    departmentId: number | null;
    level: ScopeLevel;
    scope: CurrentUserScope;
  },
  ctx: any,
  message: string
) {
  if (params.level === 'ALL') return;

  if (!params.departmentId) {
    return toForbidden(ctx, message);
  }

  ensureScopeDepartments(params.scope, ctx);

  if (!params.scope.accessibleDepartmentIds.includes(params.departmentId)) {
    return toForbidden(ctx, message);
  }
}

export function assertEmployeeSelf(
  params: { employeeId: number | null; level: ScopeLevel; scope: CurrentUserScope },
  ctx: any,
  message: string
) {
  if (params.level === 'ALL' || params.level === 'DEPARTMENT') return;

  ensureScopeEmployee(params.scope, ctx);

  if (!params.employeeId || params.employeeId !== params.scope.employeeId) {
    return toForbidden(ctx, message);
  }
}

export const ORDER_KEYS = ORDER_PERMISSION;
export const PAYMENT_KEYS = PAYMENT_PERMISSION;
