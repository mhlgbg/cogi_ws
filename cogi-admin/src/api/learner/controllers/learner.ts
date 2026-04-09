import { factories } from '@strapi/strapi';
import fs from 'node:fs/promises';
import XLSX from 'xlsx';
import {
	extractRelationRef,
	mergeTenantWhere,
	resolveCurrentTenantId,
	toPositiveInt,
	toText,
	whereByParam,
} from '../../../utils/tenant-scope';
import { ensureUserHasAuthenticatedRole } from '../../auth-extended/services/ensure-authenticated-role';
import {
	checkUserTenantExists,
	createUserTenant,
	createUserTenantRole,
	validateTenantRole,
} from '../../admin/services/invite-user';
import { getTenantEnabledRoles } from '../../admin/services/manage-tenant-users';

const LEARNER_UID = 'api::learner.learner';
const USER_UID = 'plugin::users-permissions.user';
const USER_TENANT_UID = 'api::user-tenant.user-tenant';

type GenericRecord = Record<string, unknown>;
type ImportLearnerRow = {
	code: string;
	fullName: string;
	username: string;
	email: string;
	password: string;
	dateOfBirth: string;
	parentName: string;
	parentPhone: string;
};

async function resolveUserFromJwt(ctx: any) {
	try {
		const authHeader = ctx.request?.headers?.authorization || ctx.request?.header?.authorization || '';
		const token = typeof authHeader === 'string' && authHeader.startsWith('Bearer ')
			? authHeader.slice(7).trim()
			: '';

		if (!token) return null;

		const jwtService = strapi.plugin('users-permissions')?.service('jwt');
		if (!jwtService) return null;

		const decoded = await jwtService.verify(token);
		const userId = Number(decoded?.id);
		if (!Number.isInteger(userId) || userId <= 0) return null;

		return strapi.db.query(USER_UID).findOne({
			where: { id: userId },
			select: ['id', 'username', 'email', 'blocked'],
		});
	} catch {
		return null;
	}
}

async function requireAuthenticatedUser(ctx: any) {
	let authUser = ctx.state?.user;
	if (!authUser?.id) {
		authUser = await resolveUserFromJwt(ctx);
		if (authUser?.id) {
			ctx.state.user = authUser;
		}
	}

	if (!authUser?.id) {
		ctx.unauthorized('Unauthorized');
		return null;
	}

	if (authUser?.blocked) {
		ctx.unauthorized('Account is blocked');
		return null;
	}

	return authUser;
}

function resolveRequestData(ctx: any): GenericRecord {
	const body = (ctx.request.body ??= {});
	if (!body.data || typeof body.data !== 'object' || Array.isArray(body.data)) {
		body.data = {};
	}

	return body.data as GenericRecord;
}

function normalizeStatus(value: unknown) {
	return toText(value).toLowerCase() === 'inactive' ? 'inactive' : 'active';
}

function readLearnerStatus(value: any) {
	return value?.learnerStatus || value?.status || 'active';
}

function normalizeEmail(value: unknown) {
	return toText(value).toLowerCase();
}

function normalizeColumnKey(value: unknown) {
	return toText(value)
		.toLowerCase()
		.replace(/đ/g, 'd')
		.replace(/Đ/g, 'd')
		.normalize('NFD')
		.replace(/[\u0300-\u036f]/g, '')
		.replace(/[^a-z0-9]+/g, ' ')
		.trim();
}

function findColumnValue(row: Record<string, unknown>, aliases: string[]) {
	const entries = Object.entries(row || {});
	for (const [key, value] of entries) {
		if (aliases.includes(normalizeColumnKey(key))) {
			return value;
		}
	}

	return '';
}

function toIsoDate(value: unknown) {
	const text = toText(value);
	if (!text) return null;
	const date = new Date(text);
	if (Number.isNaN(date.getTime())) {
		throw new Error('Invalid date value');
	}
	return date.toISOString().slice(0, 10);
}

function getFilePath(file: any) {
	return file?.filepath || file?.path || file?.tempFilePath || '';
}

async function readWorkbookBuffer(file: any): Promise<Buffer> {
	if (file?.buffer && Buffer.isBuffer(file.buffer)) {
		return file.buffer;
	}

	const filePath = getFilePath(file);
	if (!filePath) {
		throw new Error('Uploaded file path was not found');
	}

	return fs.readFile(filePath);
}

function mapUserOption(row: any) {
	const user = row?.user;
	if (!user?.id) return null;

	return {
		id: user.id,
		username: user.username || '',
		email: user.email || '',
		fullName: user.fullName || '',
		label: [user.fullName || '', user.username || '', user.email || ''].filter(Boolean).join(' - ') || `User #${user.id}`,
	};
}

function mapLearnerRow(row: any) {
	const user = row?.user
		? {
			id: row.user.id,
			username: row.user.username || '',
			email: row.user.email || '',
			fullName: row.user.fullName || '',
		}
		: null;

	return {
		id: row.id,
		code: row.code || '',
		fullName: row.fullName || '',
		dateOfBirth: row.dateOfBirth || null,
		parentName: row.parentName || '',
		parentPhone: row.parentPhone || '',
		learnerStatus: readLearnerStatus(row),
		status: readLearnerStatus(row),
		user,
		updatedAt: row.updatedAt || null,
	};
}

async function findLearnerOrThrow(idParam: unknown, tenantId: number | string) {
	const entity = await strapi.db.query(LEARNER_UID).findOne({
		where: mergeTenantWhere(whereByParam(idParam), tenantId),
		populate: {
			user: {
				select: ['id', 'username', 'email', 'fullName'],
			},
		},
	});

	if (!entity) {
		throw new Error('Learner not found');
	}

	return entity;
}

async function ensureUserInTenant(userRef: unknown, tenantId: number | string) {
	const userId = Number(extractRelationRef(userRef));
	if (!Number.isInteger(userId) || userId <= 0) {
		throw new Error('user is invalid');
	}

	const membership = await strapi.db.query(USER_TENANT_UID).findOne({
		where: {
			user: userId,
			tenant: tenantId,
			userTenantStatus: 'active',
		},
		populate: {
			user: {
				select: ['id', 'username', 'email', 'fullName'],
			},
		},
	});

	if (!membership?.user?.id) {
		throw new Error('user must be an active user in current tenant');
	}

	return membership.user;
}

function parseImportLearnerRow(row: Record<string, unknown>): ImportLearnerRow {
	return {
		code: toText(findColumnValue(row, ['code', 'learner code', 'student code', 'ma hoc sinh', 'ma hs'])),
		fullName: toText(findColumnValue(row, ['full name', 'fullname', 'learner name', 'student name', 'ho ten', 'ten hoc sinh'])),
		username: toText(findColumnValue(row, ['username', 'user name', 'user_name', 'ten dang nhap'])),
		email: normalizeEmail(findColumnValue(row, ['email', 'e mail', 'mail'])),
		password: toText(findColumnValue(row, ['password', 'pass', 'mat khau', 'mk'])),
		dateOfBirth: toText(findColumnValue(row, ['date of birth', 'dob', 'ngay sinh', 'ngay sinh hoc sinh'])),
		parentName: toText(findColumnValue(row, ['parent name', 'ten phu huynh', 'phu huynh'])),
		parentPhone: toText(findColumnValue(row, ['parent phone', 'so dien thoai phu huynh', 'dien thoai phu huynh', 'sdt phu huynh'])),
	};
}

function validateImportLearnerRow(row: ImportLearnerRow) {
	if (!row.code) return 'Mã học sinh là bắt buộc';
	if (!row.fullName) return 'Họ tên là bắt buộc';
	if (!row.username) return 'Tên đăng nhập là bắt buộc';
	if (!row.email) return 'Email là bắt buộc';
	if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(row.email)) return 'Email không hợp lệ';
	if (row.dateOfBirth) {
		try {
			toIsoDate(row.dateOfBirth);
		} catch {
			return 'Ngày sinh không hợp lệ';
		}
	}
	return null;
}

async function findUserByUsernameOrEmail(username: string, email: string) {
	if (!username && !email) return null;

	const conditions: Record<string, unknown>[] = [];
	if (username) {
		conditions.push({
			username: {
				$eqi: username,
			},
		});
	}
	if (email) {
		conditions.push({
			email: {
				$eqi: email,
			},
		});
	}

	return strapi.db.query(USER_UID).findOne({
		where: conditions.length === 1 ? conditions[0] : { $or: conditions },
		select: ['id', 'username', 'email', 'fullName'],
	});
}

async function createFrameworkUser(row: ImportLearnerRow) {
	const usersPermissionsUserService = strapi.plugin('users-permissions').service('user');
	const createdUser = await usersPermissionsUserService.add({
		email: row.email,
		username: row.username,
		provider: 'local',
		fullName: row.fullName || undefined,
		confirmed: true,
		blocked: false,
		password: row.password,
	});

	await ensureUserHasAuthenticatedRole(strapi, Number(createdUser.id));
	return createdUser;
}

async function ensureUserTenantMembership(userId: number, tenantId: number, roleId: number) {
	const membership = await checkUserTenantExists(userId, tenantId);
	if (membership.exists) {
		return membership.userTenant?.id || null;
	}

	await ensureUserHasAuthenticatedRole(strapi, userId);
	const userTenant = await createUserTenant(userId, tenantId, 'active');
	await createUserTenantRole(Number(userTenant.id), roleId);
	return Number(userTenant.id);
}

async function findLearnerByCode(code: string, tenantId: number | string) {
	if (!code) return null;

	return strapi.db.query(LEARNER_UID).findOne({
		where: {
			code: {
				$eqi: code,
			},
			tenant: tenantId,
		},
		populate: {
			user: {
				select: ['id', 'username', 'email', 'fullName'],
			},
		},
	});
}

function buildFilters(query: Record<string, unknown>) {
	const keyword = toText(query?.q);
	const status = toText(query?.learnerStatus || query?.status).toLowerCase();
	const clauses: Record<string, unknown>[] = [];

	if (keyword) {
		clauses.push({
			$or: [
				{ code: { $containsi: keyword } },
				{ fullName: { $containsi: keyword } },
				{ parentName: { $containsi: keyword } },
				{ parentPhone: { $containsi: keyword } },
				{
					user: {
						$or: [
							{ username: { $containsi: keyword } },
							{ email: { $containsi: keyword } },
							{ fullName: { $containsi: keyword } },
						],
					},
				},
			],
		});
	}

	if (status === 'active' || status === 'inactive') {
		clauses.push({ learnerStatus: status });
	}

	return clauses.length > 0 ? { $and: clauses } : {};
}

export default factories.createCoreController(LEARNER_UID, () => ({
	async find(ctx) {
		if (!(await requireAuthenticatedUser(ctx))) return;

		const tenantId = resolveCurrentTenantId(ctx);
		const query = (ctx.query || {}) as Record<string, unknown>;
		const page = toPositiveInt((query.pagination as Record<string, unknown> | undefined)?.page, 1);
		const pageSize = Math.min(100, toPositiveInt((query.pagination as Record<string, unknown> | undefined)?.pageSize, 10));
		const start = (page - 1) * pageSize;
		const where = mergeTenantWhere(buildFilters(query), tenantId);

		const [rows, total] = await Promise.all([
			strapi.db.query(LEARNER_UID).findMany({
				where,
				offset: start,
				limit: pageSize,
				orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
				populate: {
					user: {
						select: ['id', 'username', 'email', 'fullName'],
					},
				},
			}),
			strapi.db.query(LEARNER_UID).count({ where }),
		]);

		ctx.body = {
			data: (rows || []).map(mapLearnerRow),
			meta: {
				pagination: {
					page,
					pageSize,
					pageCount: Math.max(1, Math.ceil(total / pageSize)),
					total,
				},
			},
		};
	},

	async formOptions(ctx) {
		if (!(await requireAuthenticatedUser(ctx))) return;

		const tenantId = resolveCurrentTenantId(ctx);
		const [rows, roles] = await Promise.all([
			strapi.db.query(USER_TENANT_UID).findMany({
				where: {
					tenant: tenantId,
					userTenantStatus: 'active',
				},
				populate: {
					user: {
						select: ['id', 'username', 'email', 'fullName'],
					},
				},
				orderBy: [{ id: 'desc' }],
			}),
			getTenantEnabledRoles(Number(tenantId)),
		]);

		const users = (rows || []).map(mapUserOption).filter(Boolean);
		ctx.body = { data: { users, roles } };
	},

	async findOne(ctx) {
		if (!(await requireAuthenticatedUser(ctx))) return;

		const tenantId = resolveCurrentTenantId(ctx);
		try {
			const entity = await findLearnerOrThrow(ctx.params?.id, tenantId);
			ctx.body = { data: mapLearnerRow(entity) };
		} catch (error: any) {
			return ctx.notFound(error?.message || 'Learner not found');
		}
	},

	async create(ctx) {
		if (!(await requireAuthenticatedUser(ctx))) return;

		const tenantId = resolveCurrentTenantId(ctx);
		const data = resolveRequestData(ctx);
		const code = toText(data.code);
		const fullName = toText(data.fullName);

		if (!code) return ctx.badRequest('code is required');
		if (!fullName) return ctx.badRequest('fullName is required');

		try {
			const user = data.user ? await ensureUserInTenant(data.user, tenantId) : null;
			const created = await strapi.db.query(LEARNER_UID).create({
				data: {
					code,
					fullName,
					dateOfBirth: toIsoDate(data.dateOfBirth),
					parentName: toText(data.parentName) || null,
					parentPhone: toText(data.parentPhone) || null,
					learnerStatus: normalizeStatus(data.learnerStatus ?? data.status),
					user: user?.id || null,
					tenant: tenantId,
				},
			});

			const populatedCreated = await strapi.db.query(LEARNER_UID).findOne({
				where: { id: created.id },
				populate: {
					user: {
						select: ['id', 'username', 'email', 'fullName'],
					},
				},
			});

			ctx.body = { data: mapLearnerRow(populatedCreated ?? created) };
		} catch (error: any) {
			return ctx.badRequest(error?.message || 'Invalid learner payload');
		}
	},

	async update(ctx) {
		if (!(await requireAuthenticatedUser(ctx))) return;

		const tenantId = resolveCurrentTenantId(ctx);
		let learner: any;
		try {
			learner = await findLearnerOrThrow(ctx.params?.id, tenantId);
		} catch (error: any) {
			return ctx.notFound(error?.message || 'Learner not found');
		}

		const data = resolveRequestData(ctx);
		try {
			const hasUserField = Object.prototype.hasOwnProperty.call(data, 'user');
			const user = hasUserField
				? (data.user ? await ensureUserInTenant(data.user, tenantId) : null)
				: learner.user;

			const updated = await strapi.db.query(LEARNER_UID).update({
				where: { id: learner.id },
				data: {
					code: toText(data.code ?? learner.code),
					fullName: toText(data.fullName ?? learner.fullName),
					dateOfBirth: toIsoDate(data.dateOfBirth ?? learner.dateOfBirth),
					parentName: toText(data.parentName ?? learner.parentName) || null,
					parentPhone: toText(data.parentPhone ?? learner.parentPhone) || null,
					learnerStatus: normalizeStatus(data.learnerStatus ?? data.status ?? readLearnerStatus(learner)),
					user: user?.id || null,
					tenant: tenantId,
				},
			});

			const populatedUpdated = await strapi.db.query(LEARNER_UID).findOne({
				where: { id: learner.id },
				populate: {
					user: {
						select: ['id', 'username', 'email', 'fullName'],
					},
				},
			});

			ctx.body = { data: mapLearnerRow(populatedUpdated ?? updated) };
		} catch (error: any) {
			return ctx.badRequest(error?.message || 'Invalid learner payload');
		}
	},

	async delete(ctx) {
		if (!(await requireAuthenticatedUser(ctx))) return;

		const tenantId = resolveCurrentTenantId(ctx);
		try {
			const learner = await findLearnerOrThrow(ctx.params?.id, tenantId);
			await strapi.db.query(LEARNER_UID).delete({ where: { id: learner.id } });
			ctx.body = { ok: true };
		} catch (error: any) {
			return ctx.notFound(error?.message || 'Learner not found');
		}
	},

	async import(ctx) {
		if (!(await requireAuthenticatedUser(ctx))) return;

		const tenantId = resolveCurrentTenantId(ctx);
		const body = ctx.request?.body || {};
		const roleId = Number(body.roleId);

		if (!Number.isInteger(roleId) || roleId <= 0) {
			return ctx.badRequest('roleId is required');
		}

		const roleValidation = await validateTenantRole(Number(tenantId), roleId);
		if (!roleValidation.valid) {
			return ctx.badRequest(roleValidation.error || 'Role is not enabled for this tenant');
		}

		const file = ctx.request?.files?.file;
		if (!file) {
			return ctx.badRequest('file is required');
		}

		try {
			const buffer = await readWorkbookBuffer(file);
			const workbook = XLSX.read(buffer, { type: 'buffer' });
			const sheetName = workbook.SheetNames[0];
			if (!sheetName) {
				return ctx.badRequest('Workbook does not contain any sheet');
			}

			const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(workbook.Sheets[sheetName], {
				defval: '',
				raw: false,
			});

			const created: any[] = [];
			const skipped: any[] = [];
			const errors: any[] = [];

			for (let index = 0; index < rows.length; index += 1) {
				const rowNumber = index + 2;
				const parsedRow = parseImportLearnerRow(rows[index] || {});
				const invalidMessage = validateImportLearnerRow(parsedRow);

				if (invalidMessage) {
					errors.push({
						rowNumber,
						code: parsedRow.code,
						username: parsedRow.username,
						email: parsedRow.email,
						message: invalidMessage,
					});
					continue;
				}

				try {
					const existingLearner = await findLearnerByCode(parsedRow.code, tenantId);
					if (existingLearner?.id) {
						skipped.push({
							rowNumber,
							code: parsedRow.code,
							username: parsedRow.username,
							message: 'Learner code already exists',
						});
						continue;
					}

					let existingUser = await findUserByUsernameOrEmail(parsedRow.username, parsedRow.email);
					if (!existingUser?.id) {
						if (!parsedRow.password) {
							throw new Error('Password là bắt buộc khi cần tạo mới user');
						}
						existingUser = await createFrameworkUser(parsedRow);
					}

					await ensureUserTenantMembership(Number(existingUser.id), Number(tenantId), roleId);

					await strapi.db.query(LEARNER_UID).create({
						data: {
							code: parsedRow.code,
							fullName: parsedRow.fullName,
							dateOfBirth: toIsoDate(parsedRow.dateOfBirth),
							parentName: parsedRow.parentName || null,
							parentPhone: parsedRow.parentPhone || null,
							user: existingUser.id,
							learnerStatus: 'active',
							tenant: tenantId,
						},
					});

					created.push({
						rowNumber,
						code: parsedRow.code,
						username: parsedRow.username,
						email: parsedRow.email,
						message: 'Learner created successfully',
					});
				} catch (error: any) {
					errors.push({
						rowNumber,
						code: parsedRow.code,
						username: parsedRow.username,
						email: parsedRow.email,
						message: error?.message || 'Failed to import learner',
					});
				}
			}

			ctx.body = {
				data: {
					summary: {
						totalRows: rows.length,
						createdCount: created.length,
						skippedCount: skipped.length,
						errorCount: errors.length,
					},
					created,
					skipped,
					errors,
				},
			};
		} catch (error: any) {
			return ctx.badRequest(error?.message || 'Failed to import learners');
		}
	},
}));