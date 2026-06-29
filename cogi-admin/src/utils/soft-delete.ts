import { mergeTenantWhere } from './tenant-scope';

type SoftDeleteQuery = {
  showDeleted?: unknown;
  deletedOnly?: unknown;
  withDeleted?: unknown;
};

type SoftDeleteOptions = {
  includeDeleted?: boolean;
  deletedOnly?: boolean;
};

function toBoolean(value: unknown): boolean {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value === 1;

  const text = typeof value === 'string' ? value.trim().toLowerCase() : '';
  return text === 'true' || text === '1' || text === 'yes';
}

export function resolveSoftDeleteOptions(query?: SoftDeleteQuery): SoftDeleteOptions {
  const deletedOnly = toBoolean(query?.deletedOnly);
  const includeDeleted = deletedOnly || toBoolean(query?.showDeleted) || toBoolean(query?.withDeleted);
  return { includeDeleted, deletedOnly };
}

export function applySoftDeleteWhere(baseWhere: Record<string, unknown> = {}, options?: SoftDeleteOptions) {
  const whereClauses: Record<string, unknown>[] = [];
  if (baseWhere && Object.keys(baseWhere).length > 0) {
    whereClauses.push(baseWhere);
  }

  if (options?.deletedOnly) {
    whereClauses.push({ isDeleted: true });
  } else if (!options?.includeDeleted) {
    whereClauses.push(buildActiveSoftDeleteWhere());
  }

  if (whereClauses.length === 0) {
    return {};
  }

  if (whereClauses.length === 1) {
    return whereClauses[0];
  }

  return { $and: whereClauses };
}

export function buildActiveSoftDeleteWhere() {
  return {
    $or: [
      { isDeleted: false },
      { isDeleted: { $null: true } },
    ],
  };
}
export function mergeTenantSoftDeleteWhere(
  baseWhere: Record<string, unknown> = {},
  tenantId: number | string | undefined,
  queryOrOptions?: SoftDeleteQuery | SoftDeleteOptions,
) {
  const options = queryOrOptions && ('showDeleted' in queryOrOptions || 'withDeleted' in queryOrOptions || 'deletedOnly' in queryOrOptions)
    ? resolveSoftDeleteOptions(queryOrOptions as SoftDeleteQuery)
    : ((queryOrOptions || {}) as SoftDeleteOptions);

  return mergeTenantWhere(applySoftDeleteWhere(baseWhere, options), tenantId);
}

export function buildSoftDeleteData(userId?: number | string | null) {
  return {
    isDeleted: true,
    deletedAt: new Date().toISOString(),
    deletedBy: userId || null,
  };
}

export function buildRestoreData() {
  return {
    isDeleted: false,
    deletedAt: null,
    deletedBy: null,
  };
}