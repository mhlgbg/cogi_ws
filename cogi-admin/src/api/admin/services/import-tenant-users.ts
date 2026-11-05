import fs from 'node:fs/promises';
import XLSX from 'xlsx';
import { ensureUserHasAuthenticatedRole } from '../../auth-extended/services/ensure-authenticated-role';
import {
  checkUserTenantExists,
  createUserTenant,
  validateTenantRole,
} from './invite-user';
import { updateTenantUserRoles } from './manage-tenant-users';

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
  phone?: string | null;
};

export type CreateTenantUserInput = {
  tenantId: number;
  roleIds: number[];
  username: string;
  email: string;
  fullName?: string | null;
  phone?: string | null;
  password: string;
};

export type CreateTenantUserResult = {
  caseType: 'NEW_USER' | 'EXISTING_USER';
  userId: number;
  userTenantId: number;
  username: string;
  email: string;
  fullName: string | null;
  phone: string | null;
  roleIds: number[];
  membershipCreated: boolean;
};

export type ImportRowResult = {
  rowNumber: number;
  username: string;
  email: string;
  fullName: string | null;
  message: string;
};

export type ImportTenantUsersResult = {
  fileName: string | null;
  summary: {
    totalRows: number;
    createdCount: number;
    skippedCount: number;
    errorCount: number;
  };
  created: ImportRowResult[];
  skipped: ImportRowResult[];
  errors: ImportRowResult[];
};

export type ImportTenantUsersProgress = {
  totalRows: number;
  processedRows: number;
  createdCount: number;
  skippedCount: number;
  errorCount: number;
};

function normalizeText(value: unknown) {
  return typeof value === 'string' ? value.trim() : String(value ?? '').trim();
}

function normalizeEmail(value: unknown) {
  return normalizeText(value).toLowerCase();
}

function uniquePositiveInts(values: unknown[]) {
  return Array.from(new Set((values || []).map((value) => Number(value)).filter((value) => Number.isInteger(value) && value > 0)));
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
  const phone = normalizeText(findColumnValue(row, ['phone', 'mobile', 'so dien thoai', 'sdt']));
  const password = normalizeText(findColumnValue(row, ['password', 'pass', 'matkhau', 'mat_khau']));

  return {
    username,
    email,
    fullName: fullNameRaw || null,
    phone: phone || null,
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

type WorkbookSource = {
  fileName?: string | null;
  buffer: Buffer;
};

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

function validateSharedIdentityFields(row: Pick<ParsedRow, 'username' | 'email' | 'fullName'>) {
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

  return null;
}

function validatePasswordForNewUser(password: string) {
  if (!password) {
    return 'password is required for a new user';
  }

  if (password.length < 6) {
    return 'password must be at least 6 characters';
  }

  return null;
}

async function validateImportOptions(tenantId: number, roleId: number) {
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
}

async function validateCreateOptions(tenantId: number, roleIds: number[]) {
  if (!Number.isInteger(tenantId) || tenantId <= 0) {
    throw new Error('Invalid tenantId');
  }

  const normalizedRoleIds = uniquePositiveInts(roleIds);
  if (normalizedRoleIds.length === 0) {
    throw new Error('At least one role is required');
  }

  for (const roleId of normalizedRoleIds) {
    const roleValidation = await validateTenantRole(tenantId, roleId);
    if (!roleValidation.valid) {
      throw new Error(roleValidation.error || 'Role is not enabled for this tenant');
    }
  }

  return normalizedRoleIds;
}

function validateCreateInput(input: ParsedRow) {
  return validateParsedRow(input);
}

async function findExistingUsersByIdentity(username: string, email: string) {
  const users = await strapi.db.query(USER_UID).findMany({
    where: {
      $or: [
        { username: { $eqi: username } },
        { email: { $eqi: email } },
      ],
    },
    select: ['id', 'username', 'email', 'fullName', 'phone'],
  });

  const normalizedUsername = normalizeText(username).toLowerCase();
  const normalizedEmail = normalizeEmail(email);
  const usernameMatches = (users || []).filter((item: any) => normalizeText(item?.username).toLowerCase() === normalizedUsername);
  const emailMatches = (users || []).filter((item: any) => normalizeEmail(item?.email) === normalizedEmail);

  const usernameUser = usernameMatches[0] || null;
  const emailUser = emailMatches[0] || null;

  if (usernameUser?.id && emailUser?.id && Number(usernameUser.id) !== Number(emailUser.id)) {
    throw new Error('username and email already belong to different existing users');
  }

  return usernameUser || emailUser || null;
}

export async function createOrAttachTenantUser(input: CreateTenantUserInput): Promise<CreateTenantUserResult> {
  const tenantId = Number(input.tenantId);
  const roleIds = await validateCreateOptions(tenantId, input.roleIds || []);
  const parsedRow: ParsedRow = {
    username: normalizeText(input.username),
    email: normalizeEmail(input.email),
    fullName: normalizeText(input.fullName) || null,
    phone: normalizeText(input.phone) || null,
    password: normalizeText(input.password),
  };

  const invalidMessage = validateSharedIdentityFields(parsedRow);
  if (invalidMessage) {
    throw new Error(invalidMessage);
  }

  const existingUser = await findExistingUsersByIdentity(parsedRow.username, parsedRow.email);
  if (existingUser?.id) {
    const existingMembership = await checkUserTenantExists(Number(existingUser.id), tenantId);
    if (existingMembership.exists) {
      throw new Error('user already exists in this tenant');
    }

    const userTenant = await createUserTenant(Number(existingUser.id), tenantId, 'active');
    const userTenantId = Number(userTenant?.id || 0);
    if (!userTenantId) {
      throw new Error('Failed to create tenant membership');
    }

    try {
      await ensureUserHasAuthenticatedRole(strapi, Number(existingUser.id));
      const updatedRoles = await updateTenantUserRoles({ tenantId, userTenantId, roleIds });
      if (!updatedRoles.ok) {
        throw new Error(updatedRoles.error || 'Failed to assign tenant roles');
      }

      return {
        caseType: 'EXISTING_USER',
        userId: Number(existingUser.id),
        userTenantId,
        username: existingUser.username || parsedRow.username,
        email: existingUser.email || parsedRow.email,
        fullName: existingUser.fullName || parsedRow.fullName,
        phone: existingUser.phone || parsedRow.phone || null,
        roleIds,
        membershipCreated: true,
      };
    } catch (error) {
      try {
        await strapi.db.query('api::user-tenant.user-tenant').delete({ where: { id: userTenantId } });
      } catch {
        // ignore cleanup failure
      }
      throw error;
    }
  }

  let createdUserId: number | null = null;
  let createdUserTenantId: number | null = null;
  try {
    const passwordError = validatePasswordForNewUser(parsedRow.password);
    if (passwordError) {
      throw new Error(passwordError);
    }

    const usersPermissionsUserService = strapi.plugin('users-permissions').service('user');
    const createdUser = await usersPermissionsUserService.add({
      username: parsedRow.username,
      email: parsedRow.email,
      password: parsedRow.password,
      provider: 'local',
      fullName: parsedRow.fullName || undefined,
      phone: parsedRow.phone || undefined,
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

    const updatedRoles = await updateTenantUserRoles({ tenantId, userTenantId: createdUserTenantId, roleIds });
    if (!updatedRoles.ok) {
      throw new Error(updatedRoles.error || 'Failed to assign tenant roles');
    }

    return {
      caseType: 'NEW_USER',
      userId: createdUserId,
      userTenantId: createdUserTenantId,
      username: parsedRow.username,
      email: parsedRow.email,
      fullName: parsedRow.fullName,
      phone: parsedRow.phone || null,
      roleIds,
      membershipCreated: true,
    };
  } catch (error) {
    if (createdUserTenantId) {
      try {
        await strapi.db.query('api::user-tenant.user-tenant').delete({ where: { id: createdUserTenantId } });
      } catch {
        // ignore cleanup failure
      }
    }
    if (createdUserId) {
      try {
        await strapi.db.query(USER_UID).delete({ where: { id: createdUserId } });
      } catch {
        // ignore cleanup failure
      }
    }
    throw error;
  }
}

async function importTenantUsersFromWorkbook(options: {
  tenantId: number;
  roleId: number;
  workbook: WorkbookSource;
  onProgress?: (progress: ImportTenantUsersProgress) => void | Promise<void>;
  shouldCancel?: () => boolean | Promise<boolean>;
}): Promise<ImportTenantUsersResult> {
  const tenantId = Number(options.tenantId);
  const roleId = Number(options.roleId);

  await validateImportOptions(tenantId, roleId);

  const workbook = XLSX.read(options.workbook.buffer, { type: 'buffer' });
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

  const emitProgress = async (processedRows: number) => {
    if (!options.onProgress) return;
    await options.onProgress({
      totalRows: rows.length,
      processedRows,
      createdCount: created.length,
      skippedCount: skipped.length,
      errorCount: errors.length,
    });
  };

  await emitProgress(0);

  for (let index = 0; index < rows.length; index += 1) {
    if (await options.shouldCancel?.()) {
      throw new Error('IMPORT_CANCELLED');
    }

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
      if ((index + 1) % 100 === 0 || index === rows.length - 1) {
        await emitProgress(index + 1);
      }
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
      if ((index + 1) % 100 === 0 || index === rows.length - 1) {
        await emitProgress(index + 1);
      }
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
      if ((index + 1) % 100 === 0 || index === rows.length - 1) {
        await emitProgress(index + 1);
      }
      continue;
    }

    seenUsernames.add(rowKeyUsername);
    seenEmails.add(rowKeyEmail);

    try {
      const result = await createOrAttachTenantUser({
        tenantId,
        roleIds: [roleId],
        username: parsedRow.username,
        email: parsedRow.email,
        fullName: parsedRow.fullName,
        phone: parsedRow.phone || null,
        password: parsedRow.password,
      });

      created.push({
        rowNumber,
        username: parsedRow.username,
        email: parsedRow.email,
        fullName: parsedRow.fullName,
        message: result.caseType === 'EXISTING_USER'
          ? 'Existing framework user added to tenant successfully'
          : 'Created successfully',
      });
    } catch (error: any) {
      const message = error?.message || 'Unexpected import error';
      const isSkip = message === 'user already exists in this tenant';
      const target = isSkip ? skipped : errors;
      target.push({
        rowNumber,
        username: parsedRow.username,
        email: parsedRow.email,
        fullName: parsedRow.fullName,
        message,
      });
    }

    if ((index + 1) % 100 === 0 || index === rows.length - 1) {
      await emitProgress(index + 1);
    }
  }

  return {
    fileName: options.workbook.fileName || null,
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

export async function importTenantUsersFromFile(options: {
  tenantId: number;
  roleId: number;
  file: UploadedFileLike;
}) {
  const buffer = await readWorkbookBuffer(options.file);
  return importTenantUsersFromWorkbook({
    tenantId: Number(options.tenantId),
    roleId: Number(options.roleId),
    workbook: {
      fileName: options.file?.name || null,
      buffer,
    },
  });
}

export async function importTenantUsersFromBuffer(options: {
  tenantId: number;
  roleId: number;
  fileName?: string | null;
  buffer: Buffer;
  onProgress?: (progress: ImportTenantUsersProgress) => void | Promise<void>;
  shouldCancel?: () => boolean | Promise<boolean>;
}) {
  return importTenantUsersFromWorkbook({
    tenantId: Number(options.tenantId),
    roleId: Number(options.roleId),
    workbook: {
      fileName: options.fileName || null,
      buffer: options.buffer,
    },
    onProgress: options.onProgress,
    shouldCancel: options.shouldCancel,
  });
}

export async function readTenantUsersImportFile(file: UploadedFileLike) {
  return readWorkbookBuffer(file);
}