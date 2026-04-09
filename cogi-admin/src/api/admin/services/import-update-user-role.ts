import fs from 'node:fs/promises';
import XLSX from 'xlsx';
import { getTenantEnabledRoles } from './manage-tenant-users';

const USER_UID = 'plugin::users-permissions.user';
const USER_TENANT_UID = 'api::user-tenant.user-tenant';
const USER_TENANT_ROLE_UID = 'api::user-tenant-role.user-tenant-role';

type UploadedFileLike = {
  name?: string;
  filepath?: string;
  path?: string;
  tempFilePath?: string;
  buffer?: Buffer;
};

type ImportUpdateRowResult = {
  rowNumber: number;
  username: string;
  message: string;
};

function normalizeText(value: unknown) {
  return typeof value === 'string' ? value.trim() : String(value ?? '').trim();
}

function toPositiveInt(value: unknown, fallback = 0): number {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) return fallback;
  return parsed;
}

function getFilePath(file: UploadedFileLike) {
  return file.filepath || file.path || file.tempFilePath || '';
}

async function readWorkbookBuffer(file: UploadedFileLike): Promise<Buffer> {
  if (file.buffer && Buffer.isBuffer(file.buffer)) {
    return file.buffer;
  }

  const filePath = getFilePath(file);
  if (!filePath) {
    throw new Error('Uploaded file path was not found');
  }

  return fs.readFile(filePath);
}

function findColumnValue(row: Record<string, unknown>, aliases: string[]) {
  const entries = Object.entries(row || {});
  for (const [key, value] of entries) {
    const normalizedKey = normalizeText(key).toLowerCase();
    if (aliases.includes(normalizedKey)) {
      return value;
    }
  }
  return '';
}

function normalizeUsernameRow(row: Record<string, unknown>) {
  return {
    username: normalizeText(findColumnValue(row, ['username', 'user_name', 'user name'])),
  };
}

async function ensureTenantRoles(tenantId: number, oldRoleId: number, newRoleId: number) {
  if (!tenantId) throw new Error('Invalid tenantId');
  if (!oldRoleId || !newRoleId) throw new Error('oldRoleId and newRoleId are required');
  if (oldRoleId === newRoleId) throw new Error('Old role and new role must be different');

  const enabledRoles = await getTenantEnabledRoles(tenantId);
  const enabledRoleIds = new Set(enabledRoles.map((role) => toPositiveInt(role.id)));

  if (!enabledRoleIds.has(oldRoleId)) {
    throw new Error('Old role is not enabled for this tenant');
  }

  if (!enabledRoleIds.has(newRoleId)) {
    throw new Error('New role is not enabled for this tenant');
  }
}

function sortActiveTenantRoles(roles: any[]) {
  return [...roles].sort((left, right) => {
    if (Boolean(left?.isPrimary) !== Boolean(right?.isPrimary)) {
      return left?.isPrimary ? -1 : 1;
    }
    return Number(left?.id || 0) - Number(right?.id || 0);
  });
}

async function normalizeActiveTenantRoles(userTenantId: number, preferredRoleId: number) {
  const refreshedRoles = await strapi.db.query(USER_TENANT_ROLE_UID).findMany({
    where: {
      userTenant: userTenantId,
      userTenantRoleStatus: 'active',
    },
    populate: {
      role: {
        select: ['id'],
      },
    },
  });

  const sortedActiveRoles = sortActiveTenantRoles(refreshedRoles || []);
  const preferred = sortedActiveRoles.find((item: any) => toPositiveInt(item?.role?.id ?? item?.role) === preferredRoleId);
  const primaryId = Number(preferred?.id || sortedActiveRoles[0]?.id || 0);

  for (const item of sortedActiveRoles) {
    await strapi.db.query(USER_TENANT_ROLE_UID).update({
      where: { id: item.id },
      data: {
        isPrimary: Number(item.id) === primaryId,
      },
    });
  }
}

async function replaceTenantRole(userTenantId: number, oldRoleId: number, newRoleId: number) {
  const existingRoles = await strapi.db.query(USER_TENANT_ROLE_UID).findMany({
    where: {
      userTenant: userTenantId,
    },
    populate: {
      role: {
        select: ['id'],
      },
    },
  });

  const activeOldRoles = (existingRoles || []).filter(
    (item: any) => item?.userTenantRoleStatus === 'active' && toPositiveInt(item?.role?.id ?? item?.role) === oldRoleId,
  );
  const activeNewRoles = (existingRoles || []).filter(
    (item: any) => item?.userTenantRoleStatus === 'active' && toPositiveInt(item?.role?.id ?? item?.role) === newRoleId,
  );

  const now = new Date();

  if (activeOldRoles.length === 0 && activeNewRoles.length === 0) {
    await strapi.db.query(USER_TENANT_ROLE_UID).create({
      data: {
        userTenant: userTenantId,
        role: newRoleId,
        userTenantRoleStatus: 'active',
        assignedAt: now,
        revokedAt: null,
        isPrimary: true,
      },
    });

    await normalizeActiveTenantRoles(userTenantId, newRoleId);
    return;
  }

  if (activeNewRoles.length > 0) {
    for (const item of activeOldRoles) {
      await strapi.db.query(USER_TENANT_ROLE_UID).update({
        where: { id: item.id },
        data: {
          userTenantRoleStatus: 'inactive',
          isPrimary: false,
          revokedAt: now,
        },
      });
    }

    await normalizeActiveTenantRoles(userTenantId, newRoleId);
    return;
  }

  if (activeOldRoles.length > 0) {
    const [firstOldRole, ...otherOldRoles] = activeOldRoles;

    await strapi.db.query(USER_TENANT_ROLE_UID).update({
      where: { id: firstOldRole.id },
      data: {
        role: newRoleId,
        userTenantRoleStatus: 'active',
        revokedAt: null,
        assignedAt: firstOldRole.assignedAt || now,
      },
    });

    for (const item of otherOldRoles) {
      await strapi.db.query(USER_TENANT_ROLE_UID).update({
        where: { id: item.id },
        data: {
          userTenantRoleStatus: 'inactive',
          isPrimary: false,
          revokedAt: now,
        },
      });
    }

    await normalizeActiveTenantRoles(userTenantId, newRoleId);
    return;
  }

  const existingInactiveNewRole = (existingRoles || []).find(
    (item: any) => item?.userTenantRoleStatus !== 'active' && toPositiveInt(item?.role?.id ?? item?.role) === newRoleId,
  );

  if (existingInactiveNewRole?.id) {
    await strapi.db.query(USER_TENANT_ROLE_UID).update({
      where: { id: existingInactiveNewRole.id },
      data: {
        userTenantRoleStatus: 'active',
        revokedAt: null,
        assignedAt: existingInactiveNewRole.assignedAt || now,
      },
    });
  } else {
    await strapi.db.query(USER_TENANT_ROLE_UID).create({
      data: {
        userTenant: userTenantId,
        role: newRoleId,
        userTenantRoleStatus: 'active',
        assignedAt: now,
        revokedAt: null,
        isPrimary: false,
      },
    });
  }

  await normalizeActiveTenantRoles(userTenantId, newRoleId);
}

export async function importUpdateTenantUserRole(options: {
  tenantId: number;
  oldRoleId: number;
  newRoleId: number;
  file: UploadedFileLike;
}) {
  const tenantId = toPositiveInt(options.tenantId);
  const oldRoleId = toPositiveInt(options.oldRoleId);
  const newRoleId = toPositiveInt(options.newRoleId);

  await ensureTenantRoles(tenantId, oldRoleId, newRoleId);

  const buffer = await readWorkbookBuffer(options.file);
  const workbook = XLSX.read(buffer, { type: 'buffer' });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) {
    throw new Error('Workbook does not contain any sheet');
  }

  const worksheet = workbook.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(worksheet, {
    defval: '',
    raw: false,
  });

  if (rows.length === 0) {
    throw new Error('Workbook does not contain any data row');
  }

  const updatedRows: ImportUpdateRowResult[] = [];
  const skippedRows: ImportUpdateRowResult[] = [];
  const errorRows: ImportUpdateRowResult[] = [];

  for (let index = 0; index < rows.length; index += 1) {
    const rowNumber = index + 2;
    const parsedRow = normalizeUsernameRow(rows[index] || {});

    if (!parsedRow.username) {
      errorRows.push({
        rowNumber,
        username: '',
        message: 'username is required',
      });
      continue;
    }

    try {
      const user = await strapi.db.query(USER_UID).findOne({
        where: {
          username: {
            $eqi: parsedRow.username,
          },
        },
        populate: {
          role: {
            select: ['id', 'name', 'type'],
          },
        },
      });

      if (!user?.id) {
        errorRows.push({
          rowNumber,
          username: parsedRow.username,
          message: 'User not found',
        });
        continue;
      }

      const currentGlobalRoleId = toPositiveInt(user?.role?.id ?? user?.role);
      if (currentGlobalRoleId !== oldRoleId) {
        skippedRows.push({
          rowNumber,
          username: parsedRow.username,
          message: 'User global role does not match old role',
        });
        continue;
      }

      const userTenant = await strapi.db.query(USER_TENANT_UID).findOne({
        where: {
          user: user.id,
          tenant: tenantId,
        },
        select: ['id'],
      });

      if (!userTenant?.id) {
        errorRows.push({
          rowNumber,
          username: parsedRow.username,
          message: 'User does not belong to current tenant',
        });
        continue;
      }

      await strapi.db.query(USER_UID).update({
        where: { id: user.id },
        data: {
          role: newRoleId,
        },
      });

      await replaceTenantRole(Number(userTenant.id), oldRoleId, newRoleId);

      updatedRows.push({
        rowNumber,
        username: parsedRow.username,
        message: 'Role updated successfully',
      });
    } catch (error: any) {
      errorRows.push({
        rowNumber,
        username: parsedRow.username,
        message: error?.message || 'Unexpected import update role error',
      });
    }
  }

  return {
    total: rows.length,
    updated: updatedRows.length,
    skipped: skippedRows.length,
    errors: errorRows.length,
    updatedRows,
    skippedRows,
    errorRows,
  };
}