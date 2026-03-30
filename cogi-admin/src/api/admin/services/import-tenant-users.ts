import fs from 'node:fs/promises';
import XLSX from 'xlsx';
import { ensureUserHasAuthenticatedRole } from '../../auth-extended/services/ensure-authenticated-role';
import {
  createUserTenant,
  createUserTenantRole,
  validateTenantRole,
} from './invite-user';

const USER_UID = 'plugin::users-permissions.user';

type UploadedFileLike = {
  name?: string;
  type?: string;
  mimetype?: string;
  size?: number;
  filepath?: string;
  path?: string;
  tempFilePath?: string;
  buffer?: Buffer;
};

type ParsedRow = {
  username: string;
  email: string;
  fullName: string | null;
  password: string;
};

type ImportRowResult = {
  rowNumber: number;
  username: string;
  email: string;
  fullName: string | null;
  message: string;
};

function normalizeText(value: unknown) {
  return typeof value === 'string' ? value.trim() : String(value ?? '').trim();
}

function normalizeEmail(value: unknown) {
  return normalizeText(value).toLowerCase();
}

function getFilePath(file: UploadedFileLike) {
  return file.filepath || file.path || file.tempFilePath || '';
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

function normalizeRow(row: Record<string, unknown>): ParsedRow {
  const username = normalizeText(findColumnValue(row, ['username', 'user_name', 'user name']));
  const email = normalizeEmail(findColumnValue(row, ['email', 'e-mail', 'mail']));
  const fullNameRaw = normalizeText(findColumnValue(row, ['fullname', 'full_name', 'full name']));
  const password = normalizeText(findColumnValue(row, ['password', 'pass', 'matkhau', 'mat_khau']));

  return {
    username,
    email,
    fullName: fullNameRaw || null,
    password,
  };
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

function validateParsedRow(row: ParsedRow) {
  if (!row.username) {
    return 'username is required';
  }

  if (row.username.length < 3) {
    return 'username must be at least 3 characters';
  }

  if (!row.email) {
    return 'email is required';
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(row.email)) {
    return 'email is invalid';
  }

  if (row.fullName && row.fullName.length > 150) {
    return 'fullName max length is 150';
  }

  if (!row.password) {
    return 'password is required';
  }

  if (row.password.length < 6) {
    return 'password must be at least 6 characters';
  }

  return null;
}

export async function importTenantUsersFromFile(options: {
  tenantId: number;
  roleId: number;
  file: UploadedFileLike;
}) {
  const tenantId = Number(options.tenantId);
  const roleId = Number(options.roleId);
  const file = options.file;

  if (!Number.isInteger(tenantId) || tenantId <= 0) {
    throw new Error('Invalid tenantId');
  }

  if (!Number.isInteger(roleId) || roleId <= 0) {
    throw new Error('Invalid roleId');
  }

  const roleValidation = await validateTenantRole(tenantId, roleId);
  if (!roleValidation.valid) {
    throw new Error(roleValidation.error || 'Role is not enabled for this tenant');
  }

  const buffer = await readWorkbookBuffer(file);
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

  const created: ImportRowResult[] = [];
  const skipped: ImportRowResult[] = [];
  const errors: ImportRowResult[] = [];
  const seenUsernames = new Set<string>();
  const seenEmails = new Set<string>();

  for (let index = 0; index < rows.length; index += 1) {
    const rowNumber = index + 2;
    const parsedRow = normalizeRow(rows[index] || {});
    const rowKeyUsername = parsedRow.username.toLowerCase();
    const rowKeyEmail = parsedRow.email.toLowerCase();

    const invalidMessage = validateParsedRow(parsedRow);
    if (invalidMessage) {
      errors.push({
        rowNumber,
        username: parsedRow.username,
        email: parsedRow.email,
        fullName: parsedRow.fullName,
        message: invalidMessage,
      });
      continue;
    }

    if (seenUsernames.has(rowKeyUsername)) {
      skipped.push({
        rowNumber,
        username: parsedRow.username,
        email: parsedRow.email,
        fullName: parsedRow.fullName,
        message: 'username is duplicated in the uploaded file',
      });
      continue;
    }

    if (seenEmails.has(rowKeyEmail)) {
      skipped.push({
        rowNumber,
        username: parsedRow.username,
        email: parsedRow.email,
        fullName: parsedRow.fullName,
        message: 'email is duplicated in the uploaded file',
      });
      continue;
    }

    seenUsernames.add(rowKeyUsername);
    seenEmails.add(rowKeyEmail);

    const existingUser = await strapi.db.query(USER_UID).findOne({
      where: {
        $or: [
          {
            username: {
              $eqi: parsedRow.username,
            },
          },
          {
            email: {
              $eqi: parsedRow.email,
            },
          },
        ],
      },
      select: ['id', 'username', 'email'],
    });

    if (existingUser?.id) {
      skipped.push({
        rowNumber,
        username: parsedRow.username,
        email: parsedRow.email,
        fullName: parsedRow.fullName,
        message: 'username or email already exists',
      });
      continue;
    }

    let createdUserId: number | null = null;
    let createdUserTenantId: number | null = null;

    try {
      const usersPermissionsUserService = strapi.plugin('users-permissions').service('user');
      const createdUser = await usersPermissionsUserService.add({
        username: parsedRow.username,
        email: parsedRow.email,
        password: parsedRow.password,
        provider: 'local',
        fullName: parsedRow.fullName || undefined,
        confirmed: true,
        blocked: false,
      });

      createdUserId = Number(createdUser?.id || 0) || null;
      if (!createdUserId) {
        throw new Error('Failed to create user');
      }

      await ensureUserHasAuthenticatedRole(strapi, createdUserId);

      const userTenant = await createUserTenant(createdUserId, tenantId, 'active');
      createdUserTenantId = Number(userTenant?.id || 0) || null;
      if (!createdUserTenantId) {
        throw new Error('Failed to create tenant membership');
      }

      await createUserTenantRole(createdUserTenantId, roleId);

      created.push({
        rowNumber,
        username: parsedRow.username,
        email: parsedRow.email,
        fullName: parsedRow.fullName,
        message: 'Created successfully',
      });
    } catch (error: any) {
      if (createdUserTenantId) {
        try {
          await strapi.db.query('api::user-tenant.user-tenant').delete({ where: { id: createdUserTenantId } });
        } catch {
          // Ignore cleanup error.
        }
      }

      if (createdUserId) {
        try {
          await strapi.db.query(USER_UID).delete({ where: { id: createdUserId } });
        } catch {
          // Ignore cleanup error.
        }
      }

      errors.push({
        rowNumber,
        username: parsedRow.username,
        email: parsedRow.email,
        fullName: parsedRow.fullName,
        message: error?.message || 'Unexpected import error',
      });
    }
  }

  return {
    fileName: file?.name || null,
    summary: {
      totalRows: rows.length,
      createdCount: created.length,
      skippedCount: skipped.length,
      errorCount: errors.length,
    },
    created,
    skipped,
    errors,
  };
}