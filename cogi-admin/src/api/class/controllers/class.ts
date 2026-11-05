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
import {
	cancelClassSession,
	completeClassSession,
	createClassSession,
	createClassSessionsBulk,
	ensureCanManageClassSessions,
	findClassSessionOrThrow,
	getClassSessionDetail,
	getSessionAccessContext,
	getSessionErrorStatus,
	listClassSessions,
	saveClassSessionAttendance,
	updateClassSession,
	updateClassSessionReport,
} from '../services/class-session';
import { reconcileLearnerEnrollment } from '../services/enrollment-reconcile';
import {
	completeTeacherSession,
	getTeacherClassDetail,
	getTeacherSessionDetail,
	getTeacherWorkspaceErrorStatus,
	listTeacherClasses,
	listTeacherClassSessions,
	listTeacherSessions,
	saveTeacherSessionAttendance,
	saveTeacherSessionReport,
} from '../services/class-teacher-workspace';
import {
	getStudentWorkspaceErrorStatus as getStudentPortalErrorStatus,
	getStudentContext as getStudentPortalContext,
	listStudentClasses as listStudentPortalClasses,
	getStudentClassDetail as getStudentPortalClassDetail,
	listStudentClassSessions as listStudentPortalClassSessions,
	listStudentSessions as listStudentPortalSessions,
	getStudentSessionDetail as getStudentPortalSessionDetail,
} from '../services/class-student-workspace';

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

function normalizePhone(value: unknown) {
	return toText(value);
}

function isValidEmail(value: string) {
	return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function createHttpError(status: number, message: string) {
	const error = new Error(message) as Error & { status?: number };
	error.status = status;
	return error;
}

function getErrorStatus(error: any, fallback = 400) {
	const status = Number(error?.status || error?.statusCode || 0);
	return Number.isInteger(status) && status > 0 ? status : fallback;
}

function buildLearnerDisplayLabel(learner: any) {
	if (!learner) return 'Learner';
	return [
		toText(learner.code),
		toText(learner.fullName || learner.user?.fullName),
		normalizeEmail(learner.email || learner.user?.email),
		normalizePhone(learner.phone || learner.user?.phone),
	].filter(Boolean).join(' - ') || `Learner #${String(learner.id || '')}`;
}

function buildUserDisplayLabel(user: any) {
	if (!user) return 'User';
	return [
		toText(user.fullName),
		toText(user.username),
		normalizeEmail(user.email),
		normalizePhone(user.phone),
	].filter(Boolean).join(' - ') || `User #${String(user.id || '')}`;
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
			email: row.learner.email || row.learner.user?.email || '',
			phone: row.learner.phone || row.learner.user?.phone || '',
			fullName: row.learner.fullName || row.learner.user?.fullName || '',
			user: row.learner.user
				? {
					id: row.learner.user.id,
					username: row.learner.user.username || '',
					email: row.learner.user.email || '',
					phone: row.learner.user.phone || '',
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
			tenant: {
				select: ['id', 'code', 'name'],
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
				select: ['id', 'username', 'email', 'phone', 'fullName'],
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
				select: ['id', 'code', 'fullName', 'email', 'phone', 'parentName', 'parentPhone'],
				populate: {
					user: {
						select: ['id', 'username', 'email', 'phone', 'fullName'],
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
		select: ['id', 'username', 'email', 'phone', 'fullName'],
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
				select: ['id', 'username', 'email', 'phone', 'fullName'],
			},
		},
	});
}

async function findLearnerByEmail(email: string, tenantId: number | string, trx?: any) {
	const normalizedEmail = normalizeEmail(email);
	if (!normalizedEmail) return null;

	return strapi.db.query(LEARNER_UID).findOne({
		where: mergeTenantWhere({
			$or: [
				{ email: { $eqi: normalizedEmail } },
				{ user: { email: { $eqi: normalizedEmail } } },
			],
		}, tenantId),
		populate: {
			user: {
				select: ['id', 'username', 'email', 'phone', 'fullName'],
			},
		},
		...(trx ? { transacting: trx } : {}),
	} as any);
}

async function findLearnerByPhone(phone: string, tenantId: number | string, trx?: any) {
	const normalizedPhone = normalizePhone(phone);
	if (!normalizedPhone) return null;

	return strapi.db.query(LEARNER_UID).findOne({
		where: mergeTenantWhere({
			$or: [
				{ phone: { $eq: normalizedPhone } },
				{ user: { phone: { $eq: normalizedPhone } } },
			],
		}, tenantId),
		populate: {
			user: {
				select: ['id', 'username', 'email', 'phone', 'fullName'],
			},
		},
		...(trx ? { transacting: trx } : {}),
	} as any);
}

async function findTenantUserByEmailOrPhone(tenantId: number | string, options: { email?: string; phone?: string }, trx?: any) {
	const email = normalizeEmail(options.email);
	const phone = normalizePhone(options.phone);
	const userOr: Record<string, unknown>[] = [];
	if (email) userOr.push({ email: { $eqi: email } });
	if (phone) userOr.push({ phone: { $eq: phone } });
	if (userOr.length === 0) return null;

	const membership = await strapi.db.query(USER_TENANT_UID).findOne({
		where: {
			tenant: tenantId,
			user: userOr.length === 1 ? userOr[0] : { $or: userOr },
		},
		populate: {
			user: {
				select: ['id', 'username', 'email', 'phone', 'fullName'],
			},
		},
		...(trx ? { transacting: trx } : {}),
	} as any);

	return membership?.user || null;
}

async function findExistingEnrollmentForClass(classId: number, learnerId: number, tenantId: number | string, trx?: any) {
	if (!Number.isInteger(classId) || classId <= 0) return null;
	if (!Number.isInteger(learnerId) || learnerId <= 0) return null;

	return strapi.db.query(ENROLLMENT_UID).findOne({
		where: mergeTenantWhere({
			class: {
				id: {
					$eq: classId,
				},
			},
			learner: {
				id: {
					$eq: learnerId,
				},
			},
		}, tenantId),
		select: ['id', 'enrollmentStatus'],
		...(trx ? { transacting: trx } : {}),
	} as any);
}

function getNewLearnerPayload(data: GenericRecord) {
	const value = data?.newLearner;
	if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
	return value as GenericRecord;
}

function validateNewLearnerDraft(input: GenericRecord) {
	const code = toText(input.code);
	const fullName = toText(input.fullName);
	const email = normalizeEmail(input.email);
	const phone = normalizePhone(input.phone);

	if (!code) throw createHttpError(400, 'Mã học viên là bắt buộc');
	if (!fullName) throw createHttpError(400, 'Họ tên là bắt buộc');
	if (email && !isValidEmail(email)) throw createHttpError(400, 'Email không hợp lệ');

	return {
		code,
		fullName,
		email: email || null,
		phone: phone || null,
	};
}

async function ensureNoEnrollmentDuplicate(classId: number, learner: any, tenantId: number | string, trx?: any) {
	const existingEnrollment = await findExistingEnrollmentForClass(classId, Number(learner?.id || 0), tenantId, trx);
	if (existingEnrollment?.id) {
		throw createHttpError(409, `Học viên này đã có enrollment trong lớp hiện tại: ${buildLearnerDisplayLabel(learner)}`);
	}
}

async function resolveNewLearnerConflict(classId: number, tenantId: number | string, input: { code: string; email: string | null; phone: string | null }, trx?: any) {
	const existingByCode = await findLearnerByCode(input.code, tenantId);
	if (existingByCode?.id) {
		const existingEnrollment = await findExistingEnrollmentForClass(classId, Number(existingByCode.id), tenantId, trx);
		const baseMessage = `Mã học viên đã tồn tại trong tenant hiện tại. Vui lòng chọn học viên có sẵn: ${buildLearnerDisplayLabel(existingByCode)}`;
		throw createHttpError(409, existingEnrollment?.id ? `${baseMessage}. Học viên này đã ở trong lớp hiện tại.` : baseMessage);
	}

	if (input.email) {
		const existingByEmail = await findLearnerByEmail(input.email, tenantId, trx);
		if (existingByEmail?.id) {
			const existingEnrollment = await findExistingEnrollmentForClass(classId, Number(existingByEmail.id), tenantId, trx);
			const baseMessage = `Email đã khớp với learner hiện có trong tenant. Vui lòng dùng hồ sơ sẵn có: ${buildLearnerDisplayLabel(existingByEmail)}`;
			throw createHttpError(409, existingEnrollment?.id ? `${baseMessage}. Học viên này đã ở trong lớp hiện tại.` : baseMessage);
		}

		const existingUser = await findTenantUserByEmailOrPhone(tenantId, { email: input.email }, trx);
		if (existingUser?.id) {
			throw createHttpError(409, `Email đã thuộc về user trong tenant hiện tại: ${buildUserDisplayLabel(existingUser)}. Việc liên kết user được xử lý ở nghiệp vụ riêng.`);
		}
	}

	if (input.phone) {
		const existingByPhone = await findLearnerByPhone(input.phone, tenantId, trx);
		if (existingByPhone?.id) {
			const existingEnrollment = await findExistingEnrollmentForClass(classId, Number(existingByPhone.id), tenantId, trx);
			const baseMessage = `Số điện thoại đã khớp với learner hiện có trong tenant. Vui lòng dùng hồ sơ sẵn có: ${buildLearnerDisplayLabel(existingByPhone)}`;
			throw createHttpError(409, existingEnrollment?.id ? `${baseMessage}. Học viên này đã ở trong lớp hiện tại.` : baseMessage);
		}

		const existingUser = await findTenantUserByEmailOrPhone(tenantId, { phone: input.phone }, trx);
		if (existingUser?.id) {
			throw createHttpError(409, `Số điện thoại đã thuộc về user trong tenant hiện tại: ${buildUserDisplayLabel(existingUser)}. Việc liên kết user được xử lý ở nghiệp vụ riêng.`);
		}
	}
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
		email: row.email || row.user?.email || '',
		phone: row.phone || row.user?.phone || '',
		label: [row.code, row.fullName || row.user?.fullName || '', row.email || row.user?.email || '', row.phone || row.user?.phone || '']
			.filter(Boolean)
			.join(' - '),
		status: row.learnerStatus || row.status || 'active',
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
		// Require an authenticated user (JWT) but do not enforce Strapi role-based permissions here.
		// This keeps the endpoint tenant-scoped while allowing any logged-in user in the tenant
		// to fetch learner/role lookup data for forms.
		if (!(await requireAuthenticatedUser(ctx))) return;

		const tenantId = resolveCurrentTenantId(ctx);
		try {
			await findClassOrThrow(ctx.params?.id, tenantId);
		} catch (error: any) {
			return ctx.notFound(error?.message || 'Class not found');
		}

		const [learnerRows, roles] = await Promise.all([
			// Respect query param `includeInactive` to optionally return all learners (including inactive/null)
			strapi.db.query(LEARNER_UID).findMany({
				where: ((): Record<string, unknown> => {
					const includeInactiveRaw = (ctx.query?.includeInactive ?? '') as unknown
					const includeInactive = String(includeInactiveRaw || '').toLowerCase()
					const truthy = includeInactive === '1' || includeInactive === 'true' || includeInactive === 'yes'
					if (truthy) {
						return { tenant: tenantId }
					}
					return {
						tenant: tenantId,
						learnerStatus: 'active',
					}
				})(),
				populate: {
					user: {
						select: ['id', 'username', 'email', 'phone', 'fullName'],
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
						{ email: { $containsi: keyword } },
						{ phone: { $containsi: keyword } },
						{
							user: {
								$or: [
						{ username: { $containsi: keyword } },
						{ email: { $containsi: keyword } },
						{ phone: { $containsi: keyword } },
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
						select: ['id', 'code', 'fullName', 'email', 'phone', 'parentName', 'parentPhone'],
						populate: {
							user: {
								select: ['id', 'username', 'email', 'phone', 'fullName'],
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

	async listAssignments(ctx) {
		if (!(await requireAuthenticatedUser(ctx))) return;

		const tenantId = resolveCurrentTenantId(ctx);
		let classEntity: any;
		try {
			classEntity = await findClassOrThrow(ctx.params?.id, tenantId);
		} catch (error: any) {
			return ctx.notFound(error?.message || 'Class not found');
		}

		try {
			const rows = await strapi.db.query('api::class-teacher-assignment.class-teacher-assignment').findMany({
				where: mergeTenantWhere({
					class: { id: { $eq: classEntity.id } },
				}, tenantId),
				orderBy: [{ assignmentStatus: 'desc' }, { startDate: 'desc' }, { createdAt: 'desc' }],
				populate: {
					teacher: {
						select: ['id', 'username', 'email', 'fullName'],
					},
				},
			});

			const data = (rows || []).map((row: any) => ({
				id: row.id,
				subject: row.subject || '',
				subjectCode: row.subjectCode || '',
				role: row.role || '',
				startDate: row.startDate || null,
				endDate: row.endDate || null,
				assignmentStatus: row.assignmentStatus || 'active',
				isPayable: Boolean(row.isPayable),
				note: row.note || '',
				createdAt: row.createdAt || null,
				updatedAt: row.updatedAt || null,
				teacher: row.teacher || null,
			}));

			ctx.body = { data };
		} catch (error: any) {
			return ctx.badRequest(error?.message || 'Failed to load assignments');
		}
	},

	async createAssignment(ctx) {
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
			const teacher = await ensureMainTeacherInTenant(data.teacher, tenantId);
			const created = await strapi.db.query('api::class-teacher-assignment.class-teacher-assignment').create({
				data: {
					teacher: teacher.id,
					class: classEntity.id,
					subjectCode: data.subjectCode || null,
					subject: data.subject || null,
					role: data.role || 'co_teacher',
					startDate: data.startDate || null,
					endDate: data.endDate || null,
					assignmentStatus: normalizeStatus(data.assignmentStatus ?? data.status),
					isPayable: Boolean(data.isPayable !== undefined ? data.isPayable : true),
					note: data.note || null,
					tenant: tenantId,
				},
			});

			const populated = await strapi.db.query('api::class-teacher-assignment.class-teacher-assignment').findOne({
				where: { id: created.id },
				populate: {
					teacher: { select: ['id', 'username', 'email', 'fullName'] },
				},
			});

			const result = populated || created;
			const body = {
				id: result.id,
				subject: result.subject || '',
				subjectCode: result.subjectCode || '',
				role: result.role || '',
				startDate: result.startDate || null,
				endDate: result.endDate || null,
				assignmentStatus: result.assignmentStatus || 'active',
				isPayable: Boolean(result.isPayable),
				note: result.note || '',
				createdAt: result.createdAt || null,
				updatedAt: result.updatedAt || null,
				teacher: result.teacher || null,
			};

			ctx.body = { data: body };
		} catch (error: any) {
			return ctx.badRequest(error?.message || 'Invalid assignment payload');
		}
	},

	async updateAssignment(ctx) {
		if (!(await requireAuthenticatedUser(ctx))) return;

		const tenantId = resolveCurrentTenantId(ctx);
		let classEntity: any;
		try {
			classEntity = await findClassOrThrow(ctx.params?.id, tenantId);
		} catch (error: any) {
			return ctx.notFound(error?.message || 'Class not found');
		}

		const assignmentId = Number(ctx.params?.assignmentId);
		if (!Number.isInteger(assignmentId) || assignmentId <= 0) {
			return ctx.notFound('Assignment not found');
		}

		const existing = await strapi.db.query('api::class-teacher-assignment.class-teacher-assignment').findOne({
			where: mergeTenantWhere({ id: assignmentId, class: { id: { $eq: classEntity.id } } }, tenantId),
		});

		if (!existing?.id) {
			return ctx.notFound('Assignment not found');
		}

		const data = resolveRequestData(ctx);
		try {
			const teacher = data.teacher ? await ensureMainTeacherInTenant(data.teacher, tenantId) : null;
			const updated = await strapi.db.query('api::class-teacher-assignment.class-teacher-assignment').update({
				where: { id: existing.id },
				data: {
					teacher: teacher ? teacher.id : existing.teacher,
					subjectCode: data.subjectCode ?? existing.subjectCode ?? null,
					subject: data.subject ?? existing.subject ?? null,
					role: data.role ?? existing.role,
					startDate: data.startDate ?? existing.startDate ?? null,
					endDate: data.endDate ?? existing.endDate ?? null,
					assignmentStatus: data.assignmentStatus ? normalizeStatus(data.assignmentStatus) : existing.assignmentStatus,
					isPayable: data.isPayable !== undefined ? Boolean(data.isPayable) : Boolean(existing.isPayable),
					note: data.note ?? existing.note ?? null,
					// do not allow changing class or tenant here
				},
			});

			const populated = await strapi.db.query('api::class-teacher-assignment.class-teacher-assignment').findOne({
				where: { id: updated.id },
				populate: {
					teacher: { select: ['id', 'username', 'email', 'fullName'] },
				},
			});

			const result = populated || updated;
			const body = {
				id: result.id,
				subject: result.subject || '',
				subjectCode: result.subjectCode || '',
				role: result.role || '',
				startDate: result.startDate || null,
				endDate: result.endDate || null,
				assignmentStatus: result.assignmentStatus || 'active',
				isPayable: Boolean(result.isPayable),
				note: result.note || '',
				createdAt: result.createdAt || null,
				updatedAt: result.updatedAt || null,
				teacher: result.teacher || null,
			};

			ctx.body = { data: body };
		} catch (error: any) {
			return ctx.badRequest(error?.message || 'Invalid assignment payload');
		}
	},

	async listSessions(ctx) {
		const authUser = await requireAuthenticatedUser(ctx);
		if (!authUser) return;

		const tenantId = resolveCurrentTenantId(ctx);
		try {
			const classEntity = await findClassOrThrow(ctx.params?.id, tenantId);
			const access = await getSessionAccessContext(tenantId, authUser);
			ctx.body = { data: await listClassSessions(classEntity, access, tenantId) };
		} catch (error: any) {
			const status = getSessionErrorStatus(error, 400);
			ctx.status = status;
			ctx.body = {
				data: null,
				error: {
					status,
					name: status === 403 ? 'ForbiddenError' : status === 404 ? 'NotFoundError' : 'ApplicationError',
					message: error?.message || 'Failed to load class sessions',
				},
			};
		}
	},

	async createSession(ctx) {
		const authUser = await requireAuthenticatedUser(ctx);
		if (!authUser) return;

		const tenantId = resolveCurrentTenantId(ctx);
		const data = resolveRequestData(ctx);
		try {
			const classEntity = await findClassOrThrow(ctx.params?.id, tenantId);
			const access = await getSessionAccessContext(tenantId, authUser);
			await ensureCanManageClassSessions(access);
			const created = await createClassSession(classEntity, data, tenantId);
			ctx.body = { data: await getClassSessionDetail(created, access, tenantId) };
		} catch (error: any) {
			const status = getSessionErrorStatus(error, 400);
			ctx.status = status;
			ctx.body = {
				data: null,
				error: {
					status,
					name: status === 403 ? 'ForbiddenError' : status === 404 ? 'NotFoundError' : status === 409 ? 'ConflictError' : 'ApplicationError',
					message: error?.message || 'Failed to create class session',
				},
			};
		}
	},

	async createSessionsBulk(ctx) {
		const authUser = await requireAuthenticatedUser(ctx);
		if (!authUser) return;

		const tenantId = resolveCurrentTenantId(ctx);
		const data = resolveRequestData(ctx);
		try {
			const classEntity = await findClassOrThrow(ctx.params?.id, tenantId);
			const access = await getSessionAccessContext(tenantId, authUser);
			await ensureCanManageClassSessions(access);
			ctx.body = { data: await createClassSessionsBulk(classEntity, data, tenantId) };
		} catch (error: any) {
			const status = getSessionErrorStatus(error, 400);
			ctx.status = status;
			ctx.body = {
				data: null,
				error: {
					status,
					name: status === 403 ? 'ForbiddenError' : status === 404 ? 'NotFoundError' : status === 409 ? 'ConflictError' : 'ApplicationError',
					message: error?.message || 'Failed to create class sessions',
				},
			};
		}
	},

	async getSession(ctx) {
		const authUser = await requireAuthenticatedUser(ctx);
		if (!authUser) return;

		const tenantId = resolveCurrentTenantId(ctx);
		try {
			const classEntity = await findClassOrThrow(ctx.params?.id, tenantId);
			const access = await getSessionAccessContext(tenantId, authUser);
			const session = await findClassSessionOrThrow(ctx.params?.sessionId, tenantId);
			if (String(session.class?.id || '') !== String(classEntity.id)) {
				return ctx.notFound('Class session not found');
			}
			ctx.body = { data: await getClassSessionDetail(session, access, tenantId) };
		} catch (error: any) {
			const status = getSessionErrorStatus(error, 400);
			ctx.status = status;
			ctx.body = {
				data: null,
				error: {
					status,
					name: status === 403 ? 'ForbiddenError' : status === 404 ? 'NotFoundError' : 'ApplicationError',
					message: error?.message || 'Failed to load class session detail',
				},
			};
		}
	},

	async updateSession(ctx) {
		const authUser = await requireAuthenticatedUser(ctx);
		if (!authUser) return;

		const tenantId = resolveCurrentTenantId(ctx);
		const data = resolveRequestData(ctx);
		try {
			const classEntity = await findClassOrThrow(ctx.params?.id, tenantId);
			const access = await getSessionAccessContext(tenantId, authUser);
			await ensureCanManageClassSessions(access);
			const session = await findClassSessionOrThrow(ctx.params?.sessionId, tenantId);
			if (String(session.class?.id || '') !== String(classEntity.id)) {
				return ctx.notFound('Class session not found');
			}
			const updated = await updateClassSession(session, data, tenantId);
			ctx.body = { data: await getClassSessionDetail(updated, access, tenantId) };
		} catch (error: any) {
			const status = getSessionErrorStatus(error, 400);
			ctx.status = status;
			ctx.body = {
				data: null,
				error: {
					status,
					name: status === 403 ? 'ForbiddenError' : status === 404 ? 'NotFoundError' : status === 409 ? 'ConflictError' : 'ApplicationError',
					message: error?.message || 'Failed to update class session',
				},
			};
		}
	},

	async cancelSession(ctx) {
		const authUser = await requireAuthenticatedUser(ctx);
		if (!authUser) return;

		const tenantId = resolveCurrentTenantId(ctx);
		const data = resolveRequestData(ctx);
		try {
			const classEntity = await findClassOrThrow(ctx.params?.id, tenantId);
			const access = await getSessionAccessContext(tenantId, authUser);
			await ensureCanManageClassSessions(access);
			const session = await findClassSessionOrThrow(ctx.params?.sessionId, tenantId);
			if (String(session.class?.id || '') !== String(classEntity.id)) {
				return ctx.notFound('Class session not found');
			}
			const updated = await cancelClassSession(session, data, tenantId);
			ctx.body = { data: await getClassSessionDetail(updated, access, tenantId) };
		} catch (error: any) {
			const status = getSessionErrorStatus(error, 400);
			ctx.status = status;
			ctx.body = {
				data: null,
				error: {
					status,
					name: status === 403 ? 'ForbiddenError' : status === 404 ? 'NotFoundError' : 'ApplicationError',
					message: error?.message || 'Failed to cancel class session',
				},
			};
		}
	},

	async saveSessionAttendance(ctx) {
		const authUser = await requireAuthenticatedUser(ctx);
		if (!authUser) return;

		const tenantId = resolveCurrentTenantId(ctx);
		const data = resolveRequestData(ctx);
		try {
			const classEntity = await findClassOrThrow(ctx.params?.id, tenantId);
			const access = await getSessionAccessContext(tenantId, authUser);
			const session = await findClassSessionOrThrow(ctx.params?.sessionId, tenantId);
			if (String(session.class?.id || '') !== String(classEntity.id)) {
				return ctx.notFound('Class session not found');
			}
			ctx.body = { data: await saveClassSessionAttendance(session, data, access, tenantId) };
		} catch (error: any) {
			const status = getSessionErrorStatus(error, 400);
			ctx.status = status;
			ctx.body = {
				data: null,
				error: {
					status,
					name: status === 403 ? 'ForbiddenError' : status === 404 ? 'NotFoundError' : status === 409 ? 'ConflictError' : 'ApplicationError',
					message: error?.message || 'Failed to save class session attendance',
				},
			};
		}
	},

	async updateSessionReport(ctx) {
		const authUser = await requireAuthenticatedUser(ctx);
		if (!authUser) return;

		const tenantId = resolveCurrentTenantId(ctx);
		const data = resolveRequestData(ctx);
		try {
			const classEntity = await findClassOrThrow(ctx.params?.id, tenantId);
			const access = await getSessionAccessContext(tenantId, authUser);
			const session = await findClassSessionOrThrow(ctx.params?.sessionId, tenantId);
			if (String(session.class?.id || '') !== String(classEntity.id)) {
				return ctx.notFound('Class session not found');
			}
			ctx.body = { data: await updateClassSessionReport(session, data, access, tenantId) };
		} catch (error: any) {
			const status = getSessionErrorStatus(error, 400);
			ctx.status = status;
			ctx.body = {
				data: null,
				error: {
					status,
					name: status === 403 ? 'ForbiddenError' : status === 404 ? 'NotFoundError' : 'ApplicationError',
					message: error?.message || 'Failed to update class session report',
				},
			};
		}
	},

	async completeSession(ctx) {
		const authUser = await requireAuthenticatedUser(ctx);
		if (!authUser) return;

		const tenantId = resolveCurrentTenantId(ctx);
		const data = resolveRequestData(ctx);
		try {
			const classEntity = await findClassOrThrow(ctx.params?.id, tenantId);
			const access = await getSessionAccessContext(tenantId, authUser);
			const session = await findClassSessionOrThrow(ctx.params?.sessionId, tenantId);
			if (String(session.class?.id || '') !== String(classEntity.id)) {
				return ctx.notFound('Class session not found');
			}
			ctx.body = { data: await completeClassSession(session, data, access, tenantId) };
		} catch (error: any) {
			const status = getSessionErrorStatus(error, 400);
			ctx.status = status;
			ctx.body = {
				data: null,
				error: {
					status,
					name: status === 403 ? 'ForbiddenError' : status === 404 ? 'NotFoundError' : 'ApplicationError',
					message: error?.message || 'Failed to complete class session',
				},
			};
		}
	},

	async listTeacherClasses(ctx) {
		const authUser = await requireAuthenticatedUser(ctx);
		if (!authUser) return;

		const tenantId = resolveCurrentTenantId(ctx);
		try {
			ctx.body = { data: await listTeacherClasses((ctx.query || {}) as Record<string, unknown>, tenantId, authUser) };
		} catch (error: any) {
			const status = getTeacherWorkspaceErrorStatus(error, 400);
			ctx.status = status;
			ctx.body = {
				data: null,
				error: {
					status,
					name: status === 403 ? 'ForbiddenError' : status === 404 ? 'NotFoundError' : 'ApplicationError',
					message: error?.message || 'Failed to load teacher classes',
				},
			};
		}
	},

	async getStudentContext(ctx) {
		const authUser = await requireAuthenticatedUser(ctx);
		if (!authUser) return;

		const tenantId = resolveCurrentTenantId(ctx);
		try {
			ctx.body = { data: await getStudentPortalContext((ctx.query || {}) as Record<string, unknown>, tenantId, authUser) };
		} catch (error: any) {
			const status = getStudentPortalErrorStatus(error, 400);
			ctx.status = status;
			ctx.body = {
				data: null,
				error: {
					status,
					name: status === 403 ? 'ForbiddenError' : status === 404 ? 'NotFoundError' : status === 409 ? 'ConflictError' : 'ApplicationError',
					message: error?.message || 'Failed to load student context',
				},
			};
		}
	},

	async listStudentClasses(ctx) {
		const authUser = await requireAuthenticatedUser(ctx);
		if (!authUser) return;

		const tenantId = resolveCurrentTenantId(ctx);
		try {
			const result = await listStudentPortalClasses((ctx.query || {}) as Record<string, unknown>, tenantId, authUser);
			ctx.body = { data: result.rows, meta: { context: result.context, serverNow: result.serverNow } };
		} catch (error: any) {
			const status = getStudentPortalErrorStatus(error, 400);
			ctx.status = status;
			ctx.body = {
				data: null,
				error: {
					status,
					name: status === 403 ? 'ForbiddenError' : status === 404 ? 'NotFoundError' : status === 409 ? 'ConflictError' : 'ApplicationError',
					message: error?.message || 'Failed to load student classes',
				},
			};
		}
	},

	async getStudentClass(ctx) {
		const authUser = await requireAuthenticatedUser(ctx);
		if (!authUser) return;

		const tenantId = resolveCurrentTenantId(ctx);
		try {
			const result = await getStudentPortalClassDetail(ctx.params?.classId, (ctx.query || {}) as Record<string, unknown>, tenantId, authUser);
			ctx.body = { data: result.detail, meta: { context: result.context, serverNow: result.serverNow } };
		} catch (error: any) {
			const status = getStudentPortalErrorStatus(error, 400);
			ctx.status = status;
			ctx.body = {
				data: null,
				error: {
					status,
					name: status === 403 ? 'ForbiddenError' : status === 404 ? 'NotFoundError' : status === 409 ? 'ConflictError' : 'ApplicationError',
					message: error?.message || 'Failed to load student class detail',
				},
			};
		}
	},

	async listStudentClassSessions(ctx) {
		const authUser = await requireAuthenticatedUser(ctx);
		if (!authUser) return;

		const tenantId = resolveCurrentTenantId(ctx);
		try {
			const result = await listStudentPortalClassSessions(ctx.params?.classId, (ctx.query || {}) as Record<string, unknown>, tenantId, authUser);
			ctx.body = { data: result.rows, meta: { context: result.context, serverNow: result.serverNow } };
		} catch (error: any) {
			const status = getStudentPortalErrorStatus(error, 400);
			ctx.status = status;
			ctx.body = {
				data: null,
				error: {
					status,
					name: status === 403 ? 'ForbiddenError' : status === 404 ? 'NotFoundError' : status === 409 ? 'ConflictError' : 'ApplicationError',
					message: error?.message || 'Failed to load student class sessions',
				},
			};
		}
	},

	async getTeacherClass(ctx) {
		const authUser = await requireAuthenticatedUser(ctx);
		if (!authUser) return;

		const tenantId = resolveCurrentTenantId(ctx);
		try {
			ctx.body = { data: await getTeacherClassDetail(ctx.params?.classId, tenantId, authUser) };
		} catch (error: any) {
			const status = getTeacherWorkspaceErrorStatus(error, 400);
			ctx.status = status;
			ctx.body = {
				data: null,
				error: {
					status,
					name: status === 403 ? 'ForbiddenError' : status === 404 ? 'NotFoundError' : 'ApplicationError',
					message: error?.message || 'Failed to load teacher class detail',
				},
			};
		}
	},

	async listTeacherClassSessions(ctx) {
		const authUser = await requireAuthenticatedUser(ctx);
		if (!authUser) return;

		const tenantId = resolveCurrentTenantId(ctx);
		try {
			ctx.body = { data: await listTeacherClassSessions(ctx.params?.classId, tenantId, authUser) };
		} catch (error: any) {
			const status = getTeacherWorkspaceErrorStatus(error, 400);
			ctx.status = status;
			ctx.body = {
				data: null,
				error: {
					status,
					name: status === 403 ? 'ForbiddenError' : status === 404 ? 'NotFoundError' : 'ApplicationError',
					message: error?.message || 'Failed to load teacher class sessions',
				},
			};
		}
	},

	async listTeacherSessions(ctx) {
		const authUser = await requireAuthenticatedUser(ctx);
		if (!authUser) return;

		const tenantId = resolveCurrentTenantId(ctx);
		try {
			ctx.body = { data: await listTeacherSessions((ctx.query || {}) as Record<string, unknown>, tenantId, authUser) };
		} catch (error: any) {
			const status = getTeacherWorkspaceErrorStatus(error, 400);
			ctx.status = status;
			ctx.body = {
				data: null,
				error: {
					status,
					name: status === 403 ? 'ForbiddenError' : status === 404 ? 'NotFoundError' : 'ApplicationError',
					message: error?.message || 'Failed to load teacher sessions',
				},
			};
		}
	},

	async listStudentSessions(ctx) {
		const authUser = await requireAuthenticatedUser(ctx);
		if (!authUser) return;

		const tenantId = resolveCurrentTenantId(ctx);
		try {
			const result = await listStudentPortalSessions((ctx.query || {}) as Record<string, unknown>, tenantId, authUser);
			ctx.body = { data: result.rows, meta: { context: result.context, serverNow: result.serverNow } };
		} catch (error: any) {
			const status = getStudentPortalErrorStatus(error, 400);
			ctx.status = status;
			ctx.body = {
				data: null,
				error: {
					status,
					name: status === 403 ? 'ForbiddenError' : status === 404 ? 'NotFoundError' : status === 409 ? 'ConflictError' : 'ApplicationError',
					message: error?.message || 'Failed to load student sessions',
				},
			};
		}
	},

	async getTeacherSession(ctx) {
		const authUser = await requireAuthenticatedUser(ctx);
		if (!authUser) return;

		const tenantId = resolveCurrentTenantId(ctx);
		try {
			ctx.body = { data: await getTeacherSessionDetail(ctx.params?.sessionId, tenantId, authUser) };
		} catch (error: any) {
			const status = getTeacherWorkspaceErrorStatus(error, 400);
			ctx.status = status;
			ctx.body = {
				data: null,
				error: {
					status,
					name: status === 403 ? 'ForbiddenError' : status === 404 ? 'NotFoundError' : 'ApplicationError',
					message: error?.message || 'Failed to load teacher session detail',
				},
			};
		}
	},

	async getStudentSession(ctx) {
		const authUser = await requireAuthenticatedUser(ctx);
		if (!authUser) return;

		const tenantId = resolveCurrentTenantId(ctx);
		try {
			const result = await getStudentPortalSessionDetail(ctx.params?.sessionId, (ctx.query || {}) as Record<string, unknown>, tenantId, authUser);
			ctx.body = { data: result.detail, meta: { context: result.context, serverNow: result.serverNow } };
		} catch (error: any) {
			const status = getStudentPortalErrorStatus(error, 400);
			ctx.status = status;
			ctx.body = {
				data: null,
				error: {
					status,
					name: status === 403 ? 'ForbiddenError' : status === 404 ? 'NotFoundError' : status === 409 ? 'ConflictError' : 'ApplicationError',
					message: error?.message || 'Failed to load student session detail',
				},
			};
		}
	},

	async saveTeacherSessionAttendance(ctx) {
		const authUser = await requireAuthenticatedUser(ctx);
		if (!authUser) return;

		const tenantId = resolveCurrentTenantId(ctx);
		const data = resolveRequestData(ctx);
		try {
			ctx.body = { data: await saveTeacherSessionAttendance(ctx.params?.sessionId, data, tenantId, authUser) };
		} catch (error: any) {
			const status = getTeacherWorkspaceErrorStatus(error, 400);
			ctx.status = status;
			ctx.body = {
				data: null,
				error: {
					status,
					name: status === 403 ? 'ForbiddenError' : status === 404 ? 'NotFoundError' : status === 409 ? 'ConflictError' : 'ApplicationError',
					message: error?.message || 'Failed to save teacher session attendance',
				},
			};
		}
	},

	async saveTeacherSessionReport(ctx) {
		const authUser = await requireAuthenticatedUser(ctx);
		if (!authUser) return;

		const tenantId = resolveCurrentTenantId(ctx);
		const data = resolveRequestData(ctx);
		try {
			ctx.body = { data: await saveTeacherSessionReport(ctx.params?.sessionId, data, tenantId, authUser) };
		} catch (error: any) {
			const status = getTeacherWorkspaceErrorStatus(error, 400);
			ctx.status = status;
			ctx.body = {
				data: null,
				error: {
					status,
					name: status === 403 ? 'ForbiddenError' : status === 404 ? 'NotFoundError' : 'ApplicationError',
					message: error?.message || 'Failed to save teacher session report',
				},
			};
		}
	},

	async completeTeacherSession(ctx) {
		const authUser = await requireAuthenticatedUser(ctx);
		if (!authUser) return;

		const tenantId = resolveCurrentTenantId(ctx);
		const data = resolveRequestData(ctx);
		try {
			ctx.body = { data: await completeTeacherSession(ctx.params?.sessionId, data, tenantId, authUser) };
		} catch (error: any) {
			const status = getTeacherWorkspaceErrorStatus(error, 400);
			ctx.status = status;
			ctx.body = {
				data: null,
				error: {
					status,
					name: status === 403 ? 'ForbiddenError' : status === 404 ? 'NotFoundError' : 'ApplicationError',
					message: error?.message || 'Failed to complete teacher session',
				},
			};
		}
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
			const newLearnerData = getNewLearnerPayload(data);
			let createdEnrollmentId = 0;
			let reconcileSummary: any = null;

			createdEnrollmentId = await strapi.db.connection.transaction(async (trx: any) => {
				const joinDate = toIsoDate(data.joinDate);
				const leaveDate = toIsoDate(data.leaveDate);
				const enrollmentStatus = normalizeEnrollmentStatus(data.enrollmentStatus ?? data.status);

				let learnerId = 0;
				if (newLearnerData) {
					const preparedLearner = validateNewLearnerDraft(newLearnerData);
					await resolveNewLearnerConflict(classEntity.id, tenantId, preparedLearner, trx);

					const createdLearner = await strapi.db.query(LEARNER_UID).create({
						data: {
							code: preparedLearner.code,
							fullName: preparedLearner.fullName,
							email: preparedLearner.email,
							phone: preparedLearner.phone,
							learnerStatus: 'active',
							user: null,
							tenant: tenantId,
						},
						transacting: trx,
					} as any);
					learnerId = Number(createdLearner.id);
				} else {
					const learner = await ensureLearnerInTenant(data.learner, tenantId);
					await ensureNoEnrollmentDuplicate(classEntity.id, learner, tenantId, trx);
					learnerId = Number(learner.id);
				}

				const createdEnrollment = await strapi.db.query(ENROLLMENT_UID).create({
					data: {
						learner: learnerId,
						class: classEntity.id,
						joinDate,
						leaveDate,
						enrollmentStatus,
						tenant: tenantId,
					},
					transacting: trx,
				} as any);

				reconcileSummary = await reconcileLearnerEnrollment({
					enrollmentId: Number(createdEnrollment.id),
					classId: Number(classEntity.id),
					learnerId,
					joinedAt: joinDate,
					tenantId,
					transacting: trx,
				});

				return Number(createdEnrollment.id);
			});

			const populatedCreated = await strapi.db.query(ENROLLMENT_UID).findOne({
				where: { id: createdEnrollmentId },
				populate: {
					learner: {
						select: ['id', 'code', 'fullName', 'email', 'phone', 'parentName', 'parentPhone'],
						populate: {
							user: {
								select: ['id', 'username', 'email', 'phone', 'fullName'],
							},
						},
					},
				},
			});

			ctx.body = {
				data: mapEnrollmentRow(populatedCreated),
				meta: {
					reconcile: {
						triggered: true,
						joinedAt: toIsoDate(data.joinDate),
						summary: reconcileSummary,
					},
				},
			};
		} catch (error: any) {
			const status = getErrorStatus(error, 400);
			ctx.status = status;
			ctx.body = {
				data: null,
				error: {
					status,
					name: status === 409 ? 'ConflictError' : 'ApplicationError',
					message: error?.message || 'Invalid enrollment payload',
				},
			};
			return;
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
			let reconcileSummary: any = null;
			const previousJoinDate = toIsoDate(enrollment.joinDate);
			const nextJoinDate = toIsoDate(data.joinDate ?? enrollment.joinDate);
			const joinedAtChanged = previousJoinDate !== nextJoinDate;

			const updated = await strapi.db.connection.transaction(async (trx: any) => {
				const learner = await ensureLearnerInTenant(data.learner ?? enrollment.learner, tenantId);
				const updatedEnrollment = await strapi.db.query(ENROLLMENT_UID).update({
					where: { id: enrollment.id },
					data: {
						learner: learner.id,
						class: classEntity.id,
						joinDate: nextJoinDate,
						leaveDate: toIsoDate(data.leaveDate ?? enrollment.leaveDate),
						enrollmentStatus: normalizeEnrollmentStatus(data.enrollmentStatus ?? data.status ?? readEnrollmentStatus(enrollment)),
						tenant: tenantId,
					},
					transacting: trx,
				} as any);

				if (joinedAtChanged) {
					reconcileSummary = await reconcileLearnerEnrollment({
						enrollmentId: Number(enrollment.id),
						classId: Number(classEntity.id),
						learnerId: Number(learner.id),
						joinedAt: nextJoinDate,
						tenantId,
						transacting: trx,
					});
				}

				return updatedEnrollment;
			});

			const populatedUpdated = await strapi.db.query(ENROLLMENT_UID).findOne({
				where: { id: enrollment.id },
				populate: {
					learner: {
						select: ['id', 'code', 'fullName', 'email', 'phone', 'parentName', 'parentPhone'],
						populate: {
							user: {
								select: ['id', 'username', 'email', 'phone', 'fullName'],
							},
						},
					},
				},
			});

			ctx.body = {
				data: mapEnrollmentRow(populatedUpdated ?? updated),
				meta: {
					reconcile: {
						triggered: joinedAtChanged,
						joinedAt: nextJoinDate,
						summary: reconcileSummary,
					},
				},
			};
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