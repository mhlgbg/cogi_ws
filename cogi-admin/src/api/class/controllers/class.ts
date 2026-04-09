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

const CLASS_UID = 'api::class.class';
const ENROLLMENT_UID = 'api::enrollment.enrollment';
const LEARNER_UID = 'api::learner.learner';
const USER_TENANT_UID = 'api::user-tenant.user-tenant';
const USER_UID = 'plugin::users-permissions.user';

type GenericRecord = Record<string, unknown>;
type ImportLearnerRow = {
	code: string;
	fullName: string;
	username: string;
	email: string;
	password: string;
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

		return strapi.db.query('plugin::users-permissions.user').findOne({
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

function readClassStatus(value: any) {
	return value?.classStatus || value?.status || 'active';
}

function readEnrollmentStatus(value: any) {
	return value?.enrollmentStatus || value?.status || 'active';
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

function normalizeEnrollmentStatus(value: unknown) {
	return toText(value).toLowerCase() === 'inactive' ? 'inactive' : 'active';
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

function mapEnrollmentRow(row: any) {
	const learner = row?.learner
		? {
			id: row.learner.id,
			code: row.learner.code || '',
			username: row.learner.user?.username || '',
			email: row.learner.user?.email || '',
			fullName: row.learner.fullName || row.learner.user?.fullName || '',
			user: row.learner.user
				? {
					id: row.learner.user.id,
					username: row.learner.user.username || '',
					email: row.learner.user.email || '',
					fullName: row.learner.user.fullName || '',
				}
				: null,
		}
		: null;

	return {
		id: row.id,
		learner,
		student: learner,
		joinDate: row?.joinDate || null,
		leaveDate: row?.leaveDate || null,
		enrollmentStatus: readEnrollmentStatus(row),
		status: readEnrollmentStatus(row),
		updatedAt: row?.updatedAt || null,
	};
}

async function findClassOrThrow(idParam: unknown, tenantId: number | string) {
	const entity = await strapi.db.query(CLASS_UID).findOne({
		where: mergeTenantWhere(whereByParam(idParam), tenantId),
		populate: {
			mainTeacher: {
				select: ['id', 'username', 'email', 'fullName'],
			},
		},
	});

	if (!entity) {
		throw new Error('Class not found');
	}

	return entity;
}

	async function ensureLearnerInTenant(learnerRef: unknown, tenantId: number | string) {
	const learnerId = Number(extractRelationRef(learnerRef));
	if (!Number.isInteger(learnerId) || learnerId <= 0) {
		throw new Error('learner is required');
	}

	const learner = await strapi.db.query(LEARNER_UID).findOne({
		where: {
			id: learnerId,
			tenant: tenantId,
		},
		populate: {
			user: {
				select: ['id', 'username', 'email', 'fullName'],
			},
		},
	});

	if (!learner?.id) {
		throw new Error('learner must belong to current tenant');
	}

	return learner;
}

async function findEnrollmentOrThrow(classId: number, enrollmentIdParam: unknown, tenantId: number | string) {
	const enrollmentId = Number(enrollmentIdParam);
	if (!Number.isInteger(enrollmentId) || enrollmentId <= 0) {
		throw new Error('Enrollment id is invalid');
	}

	const entity = await strapi.db.query(ENROLLMENT_UID).findOne({
		where: mergeTenantWhere({
			id: enrollmentId,
			class: {
				id: {
					$eq: classId,
				},
			},
		}, tenantId),
		populate: {
			learner: {
				select: ['id', 'code', 'fullName', 'parentName', 'parentPhone'],
				populate: {
					user: {
						select: ['id', 'username', 'email', 'fullName'],
					},
				},
			},
		},
	});

	if (!entity) {
		throw new Error('Enrollment not found');
	}

	return entity;
}

function parseImportLearnerRow(row: Record<string, unknown>): ImportLearnerRow {
	return {
		code: toText(findColumnValue(row, ['code', 'learner code', 'student code', 'ma hoc sinh', 'ma hs'])),
		fullName: toText(findColumnValue(row, ['full name', 'fullname', 'learner name', 'student name', 'ho ten', 'ten hoc sinh'])),
		username: toText(findColumnValue(row, ['username', 'user name', 'user_name', 'ten dang nhap'])),
		email: normalizeEmail(findColumnValue(row, ['email', 'e mail', 'mail'])),
		password: toText(findColumnValue(row, ['password', 'pass', 'mat khau', 'mk'])),
	};
}

function validateImportLearnerRow(row: ImportLearnerRow) {
	if (!row.code) return 'Mã học sinh là bắt buộc';
	if (!row.fullName) return 'Họ tên là bắt buộc';
	if (!row.username) return 'Tên đăng nhập là bắt buộc';
	if (!row.email) return 'Email là bắt buộc';
	if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(row.email)) return 'Email không hợp lệ';
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

async function ensureMainTeacherInTenant(mainTeacherRef: unknown, tenantId: number | string) {
	const teacherId = Number(extractRelationRef(mainTeacherRef));
	if (!Number.isInteger(teacherId) || teacherId <= 0) {
		throw new Error('mainTeacher is required');
	}

	const membership = await strapi.db.query(USER_TENANT_UID).findOne({
		where: {
			user: teacherId,
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
		throw new Error('mainTeacher must be an active user in current tenant');
	}

	return membership.user;
}

function buildFilters(query: Record<string, unknown>) {
	const keyword = toText(query?.q);
	const status = toText(query?.classStatus || query?.status).toLowerCase();
	const clauses: Record<string, unknown>[] = [];

	if (keyword) {
		clauses.push({
			$or: [
				{ name: { $containsi: keyword } },
				{ subjectCode: { $containsi: keyword } },
				{ subject: { $containsi: keyword } },
			],
		});
	}

	if (status === 'active' || status === 'inactive') {
		clauses.push({ classStatus: status });
	}

	return clauses.length > 0 ? { $and: clauses } : {};
}

function mapTeacherOption(row: any) {
	const user = row?.user;
	if (!user?.id) return null;

	return {
		id: user.id,
		username: user.username || '',
		email: user.email || '',
		fullName: user.fullName || '',
		label: user.fullName || user.username || user.email || `User #${user.id}`,
	};
}

function mapLearnerOption(row: any) {
	if (!row?.id) return null;

	return {
		id: row.id,
		code: row.code || '',
		fullName: row.fullName || '',
		username: row.user?.username || '',
		email: row.user?.email || '',
		label: [row.code, row.fullName || row.user?.fullName || '', row.user?.username || '']
			.filter(Boolean)
			.join(' - '),
	};
}

export default factories.createCoreController(CLASS_UID, () => ({
	async find(ctx) {
		if (!(await requireAuthenticatedUser(ctx))) return;

		const tenantId = resolveCurrentTenantId(ctx);
		const query = (ctx.query || {}) as Record<string, unknown>;
		const page = toPositiveInt((query.pagination as Record<string, unknown> | undefined)?.page, 1);
		const pageSize = Math.min(100, toPositiveInt((query.pagination as Record<string, unknown> | undefined)?.pageSize, 10));
		const start = (page - 1) * pageSize;
		const where = mergeTenantWhere(buildFilters(query), tenantId);

		const [rows, total] = await Promise.all([
			strapi.db.query(CLASS_UID).findMany({
				where,
				offset: start,
				limit: pageSize,
				orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
				populate: {
					mainTeacher: {
						select: ['id', 'username', 'email', 'fullName'],
					},
				},
			}),
			strapi.db.query(CLASS_UID).count({ where }),
		]);

		return this.transformResponse((rows || []).map((row: any) => ({ ...row, status: readClassStatus(row) })), {
			pagination: {
				page,
				pageSize,
				pageCount: Math.max(1, Math.ceil(total / pageSize)),
				total,
			},
		});
	},

	async formOptions(ctx) {
		if (!(await requireAuthenticatedUser(ctx))) return;

		const tenantId = resolveCurrentTenantId(ctx);
		const rows = await strapi.db.query(USER_TENANT_UID).findMany({
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
		});

		const teachers = (rows || []).map(mapTeacherOption).filter(Boolean);
		ctx.body = { data: { teachers } };
	},

	async enrollmentOptions(ctx) {
		if (!(await requireAuthenticatedUser(ctx))) return;

		const tenantId = resolveCurrentTenantId(ctx);
		try {
			await findClassOrThrow(ctx.params?.id, tenantId);
		} catch (error: any) {
			return ctx.notFound(error?.message || 'Class not found');
		}

		const [learnerRows, roles] = await Promise.all([
			strapi.db.query(LEARNER_UID).findMany({
				where: {
					tenant: tenantId,
					learnerStatus: 'active',
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

		const learners = (learnerRows || []).map(mapLearnerOption).filter(Boolean);
		ctx.body = { data: { learners, students: learners, roles } };
	},

	async listEnrollments(ctx) {
		if (!(await requireAuthenticatedUser(ctx))) return;

		const tenantId = resolveCurrentTenantId(ctx);
		let classEntity: any;
		try {
			classEntity = await findClassOrThrow(ctx.params?.id, tenantId);
		} catch (error: any) {
			return ctx.notFound(error?.message || 'Class not found');
		}

		const query = (ctx.query || {}) as Record<string, unknown>;
		const page = toPositiveInt((query.pagination as Record<string, unknown> | undefined)?.page, 1);
		const pageSize = Math.min(100, toPositiveInt((query.pagination as Record<string, unknown> | undefined)?.pageSize, 10));
		const start = (page - 1) * pageSize;
		const keyword = toText(query?.q);
		const status = toText(query?.enrollmentStatus || query?.status).toLowerCase();
		const clauses: Record<string, unknown>[] = [{
			class: {
				id: {
					$eq: classEntity.id,
				},
			},
		}];

		if (keyword) {
			clauses.push({
				learner: {
					$or: [
						{ code: { $containsi: keyword } },
						{ fullName: { $containsi: keyword } },
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
				},
			});
		}

		if (status === 'active' || status === 'inactive') {
			clauses.push({ enrollmentStatus: status });
		}

		const where = mergeTenantWhere({ $and: clauses }, tenantId);
		const [rows, total] = await Promise.all([
			strapi.db.query(ENROLLMENT_UID).findMany({
				where,
				offset: start,
				limit: pageSize,
				orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
				populate: {
					learner: {
						select: ['id', 'code', 'fullName', 'parentName', 'parentPhone'],
						populate: {
							user: {
								select: ['id', 'username', 'email', 'fullName'],
							},
						},
					},
				},
			}),
			strapi.db.query(ENROLLMENT_UID).count({ where }),
		]);

		ctx.body = {
			data: (rows || []).map(mapEnrollmentRow),
			meta: {
				page,
				pageSize,
				pageCount: Math.max(1, Math.ceil(total / pageSize)),
				total,
			},
		};
	},

	async createEnrollment(ctx) {
		if (!(await requireAuthenticatedUser(ctx))) return;

		const tenantId = resolveCurrentTenantId(ctx);
		let classEntity: any;
		try {
			classEntity = await findClassOrThrow(ctx.params?.id, tenantId);
		} catch (error: any) {
			return ctx.notFound(error?.message || 'Class not found');
		}

		const data = resolveRequestData(ctx);
		try {
			const learner = await ensureLearnerInTenant(data.learner, tenantId);
			const created = await strapi.db.query(ENROLLMENT_UID).create({
				data: {
					learner: learner.id,
					class: classEntity.id,
					joinDate: toIsoDate(data.joinDate),
					leaveDate: toIsoDate(data.leaveDate),
					enrollmentStatus: normalizeEnrollmentStatus(data.enrollmentStatus ?? data.status),
					tenant: tenantId,
				},
			});

			const populatedCreated = await strapi.db.query(ENROLLMENT_UID).findOne({
				where: { id: created.id },
				populate: {
					learner: {
						select: ['id', 'code', 'fullName', 'parentName', 'parentPhone'],
						populate: {
							user: {
								select: ['id', 'username', 'email', 'fullName'],
							},
						},
					},
				},
			});

			ctx.body = { data: mapEnrollmentRow(populatedCreated ?? created) };
		} catch (error: any) {
			return ctx.badRequest(error?.message || 'Invalid enrollment payload');
		}
	},

	async updateEnrollment(ctx) {
		if (!(await requireAuthenticatedUser(ctx))) return;

		const tenantId = resolveCurrentTenantId(ctx);
		let classEntity: any;
		let enrollment: any;
		try {
			classEntity = await findClassOrThrow(ctx.params?.id, tenantId);
			enrollment = await findEnrollmentOrThrow(classEntity.id, ctx.params?.enrollmentId, tenantId);
		} catch (error: any) {
			if (String(error?.message || '').includes('Enrollment')) {
				return ctx.notFound(error?.message || 'Enrollment not found');
			}
			return ctx.notFound(error?.message || 'Class not found');
		}

		const data = resolveRequestData(ctx);
		try {
			const learner = await ensureLearnerInTenant(data.learner ?? enrollment.learner, tenantId);
			const updated = await strapi.db.query(ENROLLMENT_UID).update({
				where: { id: enrollment.id },
				data: {
					learner: learner.id,
					class: classEntity.id,
					joinDate: toIsoDate(data.joinDate ?? enrollment.joinDate),
					leaveDate: toIsoDate(data.leaveDate ?? enrollment.leaveDate),
					enrollmentStatus: normalizeEnrollmentStatus(data.enrollmentStatus ?? data.status ?? readEnrollmentStatus(enrollment)),
					tenant: tenantId,
				},
			});

			const populatedUpdated = await strapi.db.query(ENROLLMENT_UID).findOne({
				where: { id: enrollment.id },
				populate: {
					learner: {
						select: ['id', 'code', 'fullName', 'parentName', 'parentPhone'],
						populate: {
							user: {
								select: ['id', 'username', 'email', 'fullName'],
							},
						},
					},
				},
			});

			ctx.body = { data: mapEnrollmentRow(populatedUpdated ?? updated) };
		} catch (error: any) {
			return ctx.badRequest(error?.message || 'Invalid enrollment payload');
		}
	},

	async deleteEnrollment(ctx) {
		if (!(await requireAuthenticatedUser(ctx))) return;

		const tenantId = resolveCurrentTenantId(ctx);
		let classEntity: any;
		let enrollment: any;
		try {
			classEntity = await findClassOrThrow(ctx.params?.id, tenantId);
			enrollment = await findEnrollmentOrThrow(classEntity.id, ctx.params?.enrollmentId, tenantId);
		} catch (error: any) {
			if (String(error?.message || '').includes('Enrollment')) {
				return ctx.notFound(error?.message || 'Enrollment not found');
			}
			return ctx.notFound(error?.message || 'Class not found');
		}

		await strapi.db.query(ENROLLMENT_UID).delete({ where: { id: enrollment.id } });
		ctx.body = { ok: true };
	},

	async importEnrollments(ctx) {
		if (!(await requireAuthenticatedUser(ctx))) return;

		const tenantId = resolveCurrentTenantId(ctx);
		let classEntity: any;
		try {
			classEntity = await findClassOrThrow(ctx.params?.id, tenantId);
		} catch (error: any) {
			return ctx.notFound(error?.message || 'Class not found');
		}

		const body = ctx.request?.body || {};
		const roleId = Number(body.roleId);
		const joinDate = toIsoDate(body.joinDate);
		const leaveDate = toIsoDate(body.leaveDate);

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
					let learner = await findLearnerByCode(parsedRow.code, tenantId);
					if (!learner?.id) {
						let existingUser = await findUserByUsernameOrEmail(parsedRow.username, parsedRow.email);
						if (!existingUser?.id) {
							if (!parsedRow.password) {
								throw new Error('Password là bắt buộc khi cần tạo mới user');
							}
							existingUser = await createFrameworkUser(parsedRow);
						}

						await ensureUserTenantMembership(Number(existingUser.id), Number(tenantId), roleId);

						learner = await strapi.db.query(LEARNER_UID).create({
							data: {
								code: parsedRow.code,
								fullName: parsedRow.fullName,
								user: existingUser.id,
								learnerStatus: 'active',
								tenant: tenantId,
							},
							populate: {
								user: {
									select: ['id', 'username', 'email', 'fullName'],
								},
							},
						});
					}

					const duplicate = await strapi.db.query(ENROLLMENT_UID).findOne({
						where: mergeTenantWhere({
							learner: {
								id: {
									$eq: learner.id,
								},
							},
							class: {
								id: {
									$eq: classEntity.id,
								},
							},
						}, tenantId),
						select: ['id'],
					});

					if (duplicate?.id) {
						skipped.push({
							rowNumber,
							code: parsedRow.code,
							username: parsedRow.username,
							message: 'Enrollment already exists',
						});
						continue;
					}

					await strapi.db.query(ENROLLMENT_UID).create({
						data: {
							learner: learner.id,
							class: classEntity.id,
							joinDate,
							leaveDate,
							enrollmentStatus: 'active',
							tenant: tenantId,
						},
					});

					created.push({
						rowNumber,
						code: parsedRow.code,
						username: parsedRow.username,
						message: 'Enrollment created successfully',
					});
				} catch (error: any) {
					errors.push({
						rowNumber,
						code: parsedRow.code,
						username: parsedRow.username,
						email: parsedRow.email,
						message: error?.message || 'Failed to import enrollment',
					});
				}
			}

			ctx.body = {
				data: {
					classId: classEntity.id,
					className: classEntity.name,
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
			return ctx.badRequest(error?.message || 'Failed to import enrollments');
		}
	},

	async findOne(ctx) {
		if (!(await requireAuthenticatedUser(ctx))) return;

		const tenantId = resolveCurrentTenantId(ctx);
		const entity = await strapi.db.query(CLASS_UID).findOne({
			where: mergeTenantWhere(whereByParam(ctx.params?.id), tenantId),
			populate: {
				mainTeacher: {
					select: ['id', 'username', 'email', 'fullName'],
				},
			},
		});

		if (!entity) {
			return ctx.notFound('Class not found');
		}

		return this.transformResponse({ ...entity, status: readClassStatus(entity) });
	},

	async create(ctx) {
		if (!(await requireAuthenticatedUser(ctx))) return;

		const tenantId = resolveCurrentTenantId(ctx);
		const data = resolveRequestData(ctx);
		const name = toText(data.name);

		if (!name) {
			return ctx.badRequest('name is required');
		}

		try {
			const teacher = await ensureMainTeacherInTenant(data.mainTeacher, tenantId);
			const created = await strapi.db.query(CLASS_UID).create({
				data: {
					name,
					subjectCode: toText(data.subjectCode) || null,
					subject: toText(data.subject) || null,
					classStatus: normalizeStatus(data.classStatus ?? data.status),
					mainTeacher: teacher.id,
					tenant: tenantId,
				},
			});

			const populatedCreated = await strapi.db.query(CLASS_UID).findOne({
				where: { id: created.id },
				populate: {
					mainTeacher: {
						select: ['id', 'username', 'email', 'fullName'],
					},
				},
			});

			return this.transformResponse({ ...(populatedCreated ?? created), status: readClassStatus(populatedCreated ?? created) });
		} catch (error: any) {
			return ctx.badRequest(error?.message || 'Invalid class payload');
		}
	},

	async update(ctx) {
		if (!(await requireAuthenticatedUser(ctx))) return;

		const tenantId = resolveCurrentTenantId(ctx);
		const existing = await strapi.db.query(CLASS_UID).findOne({
			where: mergeTenantWhere(whereByParam(ctx.params?.id), tenantId),
		});

		if (!existing) {
			return ctx.notFound('Class not found');
		}

		const data = resolveRequestData(ctx);
		const name = toText(data.name);
		if (!name) {
			return ctx.badRequest('name is required');
		}

		try {
			const teacher = await ensureMainTeacherInTenant(data.mainTeacher ?? existing.mainTeacher, tenantId);
			const updated = await strapi.db.query(CLASS_UID).update({
				where: { id: existing.id },
				data: {
					name,
					subjectCode: toText(data.subjectCode) || null,
					subject: toText(data.subject) || null,
					classStatus: normalizeStatus(data.classStatus ?? data.status ?? readClassStatus(existing)),
					mainTeacher: teacher.id,
					tenant: tenantId,
				},
			});

			const populatedUpdated = await strapi.db.query(CLASS_UID).findOne({
				where: { id: existing.id },
				populate: {
					mainTeacher: {
						select: ['id', 'username', 'email', 'fullName'],
					},
				},
			});

			return this.transformResponse({ ...(populatedUpdated ?? updated), status: readClassStatus(populatedUpdated ?? updated) });
		} catch (error: any) {
			return ctx.badRequest(error?.message || 'Invalid class payload');
		}
	},

	async delete(ctx) {
		if (!(await requireAuthenticatedUser(ctx))) return;

		const tenantId = resolveCurrentTenantId(ctx);
		const existing = await strapi.db.query(CLASS_UID).findOne({
			where: mergeTenantWhere(whereByParam(ctx.params?.id), tenantId),
		});

		if (!existing) {
			return ctx.notFound('Class not found');
		}

		return await super.delete({
			...ctx,
			params: { ...ctx.params, id: existing.id },
		});
	},
}));