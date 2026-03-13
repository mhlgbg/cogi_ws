import { extractRelationId } from './recalculate-service-order-totals';

const SERVICE_ORDER_UID = 'api::service-order.service-order';
const DEPARTMENT_UID = 'api::department.department';

function toValidDate(value: unknown): Date {
  const parsed = value ? new Date(String(value)) : new Date();
  if (Number.isNaN(parsed.getTime())) return new Date();
  return parsed;
}

function toDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}${month}${day}`;
}

function normalizeStoreCode(raw: string): string {
  const normalized = String(raw || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '');

  if (!normalized) return '';
  return normalized.slice(0, 8);
}

async function resolveStoreCode(departmentId: number | null): Promise<string> {
  if (!departmentId) return 'ORD';

  const department = await strapi.db.query(DEPARTMENT_UID).findOne({
    where: { id: departmentId },
    select: ['code', 'slug', 'name'],
  });

  const candidate =
    normalizeStoreCode(department?.code)
    || normalizeStoreCode(department?.shortCode)
    || normalizeStoreCode(department?.slug)
    || normalizeStoreCode(department?.name);

  return candidate || 'ORD';
}

function toRange(date: Date) {
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);

  const end = new Date(start);
  end.setDate(end.getDate() + 1);

  return {
    startIso: start.toISOString(),
    endIso: end.toISOString(),
  };
}

async function loadUsedCodes(params: {
  departmentId: number | null;
  startIso: string;
  endIso: string;
}): Promise<Set<string>> {
  const where: Record<string, unknown> = {
    orderDate: {
      $gte: params.startIso,
      $lt: params.endIso,
    },
  };

  if (params.departmentId) {
    where.department = params.departmentId;
  } else {
    where.department = null;
  }

  const rows = await strapi.db.query(SERVICE_ORDER_UID).findMany({
    where,
    select: ['code'],
  });

  const used = new Set<string>();
  for (const row of rows || []) {
    const value = String(row?.code || '').trim().toUpperCase();
    if (value) used.add(value);
  }

  return used;
}

function nextSequenceFromUsedCodes(usedCodes: Set<string>, prefix: string, dateKey: string): number {
  const pattern = new RegExp(`^${prefix}-${dateKey}-(\\d+)$`);
  let maxSequence = 0;

  for (const code of usedCodes) {
    const matched = pattern.exec(code);
    if (!matched) continue;

    const parsed = Number(matched[1]);
    if (!Number.isInteger(parsed) || parsed <= 0) continue;
    if (parsed > maxSequence) maxSequence = parsed;
  }

  return maxSequence + 1;
}

function formatSequence(value: number): string {
  if (value >= 1000) return String(value);
  return String(value).padStart(3, '0');
}

async function codeExists(code: string): Promise<boolean> {
  const existing = await strapi.db.query(SERVICE_ORDER_UID).findOne({
    where: { code },
    select: ['id'],
  });
  return Boolean(existing?.id);
}

export async function generateServiceOrderCode(data: Record<string, unknown>): Promise<string> {
  const orderDate = toValidDate(data?.orderDate);
  const dateKey = toDateKey(orderDate);

  const departmentId = extractRelationId(data?.department);
  const storeCode = await resolveStoreCode(departmentId);

  const { startIso, endIso } = toRange(orderDate);
  const usedCodes = await loadUsedCodes({ departmentId, startIso, endIso });

  let sequence = nextSequenceFromUsedCodes(usedCodes, storeCode, dateKey);

  while (true) {
    const generated = `${storeCode}-${dateKey}-${formatSequence(sequence)}`.toUpperCase();

    if (!usedCodes.has(generated) && !(await codeExists(generated))) {
      return generated;
    }

    sequence += 1;
  }
}
