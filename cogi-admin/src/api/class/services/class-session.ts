import { extractRelationRef, mergeTenantWhere, toText, whereByParam } from '../../../utils/tenant-scope';

const CLASS_UID = 'api::class.class';
const CLASS_SESSION_UID = 'api::class-session.class-session';
const CLASS_SESSION_ATTENDANCE_UID = 'api::class-session-attendance.class-session-attendance';
const CLASS_TEACHER_ASSIGNMENT_UID = 'api::class-teacher-assignment.class-teacher-assignment';
const ENROLLMENT_UID = 'api::enrollment.enrollment';
const LEARNER_UID = 'api::learner.learner';
const USER_TENANT_UID = 'api::user-tenant.user-tenant';
const USER_TENANT_ROLE_UID = 'api::user-tenant-role.user-tenant-role';
const ROLE_FEATURE_UID = 'api::role-feature.role-feature';

const SESSION_STATUSES = new Set(['scheduled', 'in_progress', 'completed', 'cancelled']);
const MUTABLE_SESSION_STATUSES = new Set(['scheduled', 'in_progress']);
const ATTENDANCE_STATUSES = new Set(['not_marked', 'present', 'absent', 'late', 'excused']);

type GenericRecord = Record<string, unknown>;
type SessionMode = 'standard' | 'teacher';

function httpError(status: number, message: string) {
  const error = new Error(message) as Error & { status?: number };
  error.status = status;
  return error;
}

function toPositiveInt(value: unknown): number | null {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

function toIsoDate(value: unknown, fieldName = 'date') {
  const text = toText(value);
  if (!text) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) {
    const date = new Date(`${text}T00:00:00.000Z`);
    if (Number.isNaN(date.getTime())) throw httpError(400, `${fieldName} is invalid`);
    return text;
  }

  const date = new Date(text);
  if (Number.isNaN(date.getTime())) throw httpError(400, `${fieldName} is invalid`);
  return date.toISOString().slice(0, 10);
}

function normalizeTime(value: unknown, fieldName: string) {
  const text = toText(value);
  if (!text) throw httpError(400, `${fieldName} is required`);
  const matched = text.match(/^(\d{2}):(\d{2})(?::(\d{2}))?$/);
  if (!matched) throw httpError(400, `${fieldName} is invalid`);

  const hours = Number(matched[1]);
  const minutes = Number(matched[2]);
  const seconds = Number(matched[3] || '0');
  if (hours > 23 || minutes > 59 || seconds > 59) {
    throw httpError(400, `${fieldName} is invalid`);
  }

  return `${matched[1]}:${matched[2]}:${matched[3] ? matched[3] : '00'}`;
}

function normalizeSessionStatus(value: unknown, fallback = 'scheduled') {
  const status = toText(value).toLowerCase();
  if (!status) return fallback;
  if (!SESSION_STATUSES.has(status)) throw httpError(400, 'status is invalid');
  return status;
}

function normalizeAttendanceStatus(value: unknown, fallback = 'not_marked') {
  const status = toText(value).toLowerCase();
  if (!status) return fallback;
  if (!ATTENDANCE_STATUSES.has(status)) throw httpError(400, 'attendance status is invalid');
  return status;
}

function requireArray(value: unknown, fieldName: string) {
  if (!Array.isArray(value)) throw httpError(400, `${fieldName} must be an array`);
  return value;
}

function sameRef(a: unknown, b: unknown) {
  return String(extractRelationRef(a) || '') === String(extractRelationRef(b) || '');
}

function hasMeaningfulReport(session: any) {
  return [session?.lessonContent, session?.homework, session?.teacherComment].some((value) => toText(value).length > 0);
}

function mapUserLite(user: any) {
  if (!user?.id) return null;
  return {
    id: user.id,
    username: user.username || '',
    email: user.email || '',
    fullName: user.fullName || '',
  };
}

function mapLearnerLite(learner: any) {
  if (!learner?.id) return null;
  return {
    id: learner.id,
    code: learner.code || '',
    fullName: learner.fullName || '',
    email: learner.email || learner.user?.email || '',
    phone: learner.phone || learner.user?.phone || '',
    username: learner.user?.username || '',
    user: learner.user ? mapUserLite(learner.user) : null,
  };
}

function mapAttendance(row: any) {
  if (!row?.id) return null;
  return {
    id: row.id,
    learner: mapLearnerLite(row.learner),
    status: normalizeAttendanceStatus(row.status),
    note: row.note || '',
    markedAt: row.markedAt || null,
    markedBy: mapUserLite(row.markedBy),
  };
}

function buildAttendanceSummary(eligibleLearners: any[], attendanceRows: any[]) {
  const counts = {
    eligibleCount: Array.isArray(eligibleLearners) ? eligibleLearners.length : 0,
    markedCount: 0,
    presentCount: 0,
    absentCount: 0,
    lateCount: 0,
    excusedCount: 0,
  };

  for (const row of attendanceRows || []) {
    const status = normalizeAttendanceStatus(row?.status);
    if (status === 'not_marked') continue;
    counts.markedCount += 1;
    if (status === 'present') counts.presentCount += 1;
    if (status === 'absent') counts.absentCount += 1;
    if (status === 'late') counts.lateCount += 1;
    if (status === 'excused') counts.excusedCount += 1;
  }

  return {
    ...counts,
    hasAttendance: counts.markedCount > 0,
    label: counts.markedCount > 0 ? `${counts.markedCount}/${counts.eligibleCount}` : null,
  };
}

function buildReportSummary(session: any, attendanceSummary: ReturnType<typeof buildAttendanceSummary>) {
  const hasReport = hasMeaningfulReport(session);
  return {
    hasAttendance: attendanceSummary.hasAttendance,
    hasReport,
    isCompleted: normalizeSessionStatus(session?.status) === 'completed',
    needsAttention: normalizeSessionStatus(session?.status) !== 'cancelled' && (!attendanceSummary.hasAttendance || !hasReport || normalizeSessionStatus(session?.status) !== 'completed'),
  };
}

async function getTenantPermissionKeys(userId: number, tenantId: number | string) {
  const userTenant = await strapi.db.query(USER_TENANT_UID).findOne({
    where: {
      user: userId,
      tenant: tenantId,
      userTenantStatus: 'active',
    },
    select: ['id'],
  });

  const userTenantId = toPositiveInt(userTenant?.id);
  if (!userTenantId) return new Set<string>();

  const userTenantRoles = await strapi.db.query(USER_TENANT_ROLE_UID).findMany({
    where: {
      userTenant: userTenantId,
      userTenantRoleStatus: 'active',
    },
    populate: {
      role: true,
    },
  });

  const roleIds = (userTenantRoles || [])
    .map((item: any) => toPositiveInt(item?.role?.id ?? item?.role))
    .filter((value: number | null): value is number => Boolean(value));

  if (roleIds.length === 0) return new Set<string>();

  const mappings = await strapi.db.query(ROLE_FEATURE_UID).findMany({
    where: {
      role: {
        id: {
          $in: roleIds,
        },
      },
    },
    populate: ['feature'],
  });

  return new Set(
    (mappings || [])
      .map((item: any) => String(item?.feature?.key || '').trim())
      .filter(Boolean),
  );
}

export async function getSessionAccessContext(tenantId: number | string, authUser: any) {
  const userId = toPositiveInt(authUser?.id);
  if (!userId) throw httpError(401, 'Unauthorized');
  const permissionKeys = await getTenantPermissionKeys(userId, tenantId);
  return {
    userId,
    permissionKeys,
    canManageClasses: permissionKeys.has('class.manage'),
  };
}

export function isSessionAssignedTeacher(session: any, userId: number) {
  return Number(session?.teacher?.id || session?.teacher || 0) === Number(userId || 0);
}

export async function ensureTeacherInTenant(teacherRef: unknown, tenantId: number | string) {
  const teacherId = toPositiveInt(extractRelationRef(teacherRef));
  if (!teacherId) throw httpError(400, 'teacher is required');

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
    throw httpError(400, 'teacher must be an active user in current tenant');
  }

  return membership.user;
}

export async function findClassForSessionOrThrow(classRef: unknown, tenantId: number | string) {
  const where = whereByParam(classRef);
  if (!where) throw httpError(404, 'Class not found');

  const entity = await strapi.db.query(CLASS_UID).findOne({
    where: mergeTenantWhere(where, tenantId),
    populate: {
      mainTeacher: {
        select: ['id', 'username', 'email', 'fullName'],
      },
      tenant: {
        select: ['id', 'code', 'name'],
      },
    },
  });

  if (!entity?.id) throw httpError(404, 'Class not found');
  return entity;
}

export async function findClassSessionOrThrow(sessionRef: unknown, tenantId: number | string) {
  const where = whereByParam(sessionRef);
  if (!where) throw httpError(404, 'Class session not found');

  const entity = await strapi.db.query(CLASS_SESSION_UID).findOne({
    where: mergeTenantWhere(where, tenantId),
    populate: {
      class: {
        select: ['id', 'name', 'subjectCode', 'subject'],
        populate: {
          mainTeacher: {
            select: ['id', 'username', 'email', 'fullName'],
          },
          tenant: {
            select: ['id', 'code', 'name'],
          },
        },
      },
      teacher: {
        select: ['id', 'username', 'email', 'fullName'],
      },
      completedBy: {
        select: ['id', 'username', 'email', 'fullName'],
      },
      tenant: {
        select: ['id', 'code', 'name'],
      },
    },
  });

  if (!entity?.id) throw httpError(404, 'Class session not found');
  return entity;
}

async function hasActiveTeacherAssignmentForDate(classId: number, teacherId: number, sessionDate: string, tenantId: number | string) {
  const matched = await strapi.db.query(CLASS_TEACHER_ASSIGNMENT_UID).findOne({
    where: mergeTenantWhere({
      class: { id: { $eq: classId } },
      teacher: { id: { $eq: teacherId } },
      assignmentStatus: 'active',
      $and: [
        {
          $or: [
            { startDate: null },
            { startDate: { $lte: sessionDate } },
          ],
        },
        {
          $or: [
            { endDate: null },
            { endDate: { $gte: sessionDate } },
          ],
        },
      ],
    }, tenantId),
    select: ['id'],
  });

  return Boolean(matched?.id);
}

async function hasAnyActiveTeacherAssignment(classId: number, teacherId: number, tenantId: number | string) {
  const matched = await strapi.db.query(CLASS_TEACHER_ASSIGNMENT_UID).findOne({
    where: mergeTenantWhere({
      class: { id: { $eq: classId } },
      teacher: { id: { $eq: teacherId } },
      assignmentStatus: 'active',
    }, tenantId),
    select: ['id'],
  });

  return Boolean(matched?.id);
}

export async function canTeachClassSession(session: any, access: { userId: number }, tenantId: number | string) {
  if (!session?.id) return false;
  if (isSessionAssignedTeacher(session, access.userId)) return true;
  if (Number(session?.class?.mainTeacher?.id || session?.class?.mainTeacher || 0) === access.userId) return true;
  return hasActiveTeacherAssignmentForDate(Number(session.class?.id || 0), access.userId, String(session.sessionDate || ''), tenantId);
}

export async function getTeacherAccessibleClassIds(tenantId: number | string, userId: number) {
  const [mainTeacherClasses, assignmentRows, sessionRows] = await Promise.all([
    strapi.db.query(CLASS_UID).findMany({
      where: mergeTenantWhere({
        mainTeacher: {
          id: {
            $eq: userId,
          },
        },
      }, tenantId),
      select: ['id'],
    }),
    strapi.db.query(CLASS_TEACHER_ASSIGNMENT_UID).findMany({
      where: mergeTenantWhere({
        teacher: {
          id: {
            $eq: userId,
          },
        },
        assignmentStatus: 'active',
      }, tenantId),
      populate: {
        class: {
          select: ['id'],
        },
      },
      select: ['id'],
    }),
    strapi.db.query(CLASS_SESSION_UID).findMany({
      where: mergeTenantWhere({
        teacher: {
          id: {
            $eq: userId,
          },
        },
      }, tenantId),
      populate: {
        class: {
          select: ['id'],
        },
      },
      select: ['id'],
    }),
  ]);

  return Array.from(new Set([
    ...(mainTeacherClasses || []).map((item: any) => Number(item?.id || 0)),
    ...(assignmentRows || []).map((item: any) => Number(item?.class?.id || item?.class || 0)),
    ...(sessionRows || []).map((item: any) => Number(item?.class?.id || item?.class || 0)),
  ].filter((value) => value > 0)));
}

export async function getTeacherClassAccessState(classEntity: any, access: { userId: number; canManageClasses: boolean }, tenantId: number | string) {
  if (access.canManageClasses) {
    return {
      canView: true,
      isMainTeacher: true,
      hasActiveAssignment: true,
      hasAssignedSession: true,
      roleLabels: ['Quản trị'],
    };
  }

  const isMainTeacher = Number(classEntity?.mainTeacher?.id || classEntity?.mainTeacher || 0) === access.userId;
  const [hasActiveAssignment, hasAssignedSession] = await Promise.all([
    hasAnyActiveTeacherAssignment(Number(classEntity?.id || 0), access.userId, tenantId),
    strapi.db.query(CLASS_SESSION_UID).findOne({
      where: mergeTenantWhere({
        class: { id: { $eq: Number(classEntity?.id || 0) } },
        teacher: { id: { $eq: access.userId } },
      }, tenantId),
      select: ['id'],
    }).then((item: any) => Boolean(item?.id)),
  ]);

  const roleLabels = [];
  if (isMainTeacher) roleLabels.push('Giáo viên chính');
  if (hasActiveAssignment) roleLabels.push('Giáo viên được phân công');
  if (!isMainTeacher && !hasActiveAssignment && hasAssignedSession) roleLabels.push('Giáo viên buổi học');

  return {
    canView: isMainTeacher || hasActiveAssignment || hasAssignedSession,
    isMainTeacher,
    hasActiveAssignment,
    hasAssignedSession,
    roleLabels,
  };
}

export async function ensureCanViewClassSessions(classEntity: any, access: { userId: number; canManageClasses: boolean }, tenantId: number | string) {
  const state = await getTeacherClassAccessState(classEntity, access, tenantId);
  if (state.canView) return state;
  throw httpError(403, 'Forbidden');
}

export async function ensureCanManageClassSessions(access: { canManageClasses: boolean }) {
  if (!access.canManageClasses) throw httpError(403, 'Forbidden');
}

export async function ensureCanTeachOrManageSession(session: any, access: { userId: number; canManageClasses: boolean }, tenantId: number | string, options: { mode?: SessionMode; requireOperate?: boolean } = {}) {
  const mode = options.mode || 'standard';
  if (access.canManageClasses) {
    return {
      canManage: true,
      canTeach: true,
      canView: true,
      canOperate: true,
    };
  }

  const canDirectTeach = isSessionAssignedTeacher(session, access.userId);
  const teacherClassState = await getTeacherClassAccessState(session?.class || null, access, tenantId);
  const canView = canDirectTeach || teacherClassState.canView;
  const canTeach = mode === 'teacher'
    ? canDirectTeach
    : (canDirectTeach || await canTeachClassSession(session, access, tenantId));
  const canOperate = mode === 'teacher' ? canDirectTeach : canTeach;

  if (options.requireOperate) {
    if (!canOperate) throw httpError(403, 'Forbidden');
  } else if (!canView) {
    throw httpError(403, 'Forbidden');
  }

  return {
    canManage: false,
    canTeach,
    canView,
    canOperate,
  };
}

function buildSessionPermissions(permissionState: { canManage: boolean; canTeach: boolean; canOperate?: boolean }, session: any, options: { mode?: SessionMode } = {}) {
  const mode = options.mode || 'standard';
  const normalizedStatus = normalizeSessionStatus(session?.status);
  const isTerminal = normalizedStatus === 'completed' || normalizedStatus === 'cancelled';
  const canOperate = permissionState.canManage || permissionState.canOperate === true || (mode !== 'teacher' && permissionState.canTeach === true);

  return {
    canManage: permissionState.canManage,
    canTeach: permissionState.canTeach,
    canEditSchedule: permissionState.canManage,
    canCancel: permissionState.canManage,
    canMarkAttendance: canOperate && !isTerminal,
    canEditReport: canOperate && !isTerminal,
    canComplete: canOperate && !isTerminal,
  };
}

function buildSessionListItem(row: any, attendanceSummary: any, reportSummary: any, permissionState: { canManage: boolean; canTeach: boolean; canOperate?: boolean }, options: { mode?: SessionMode } = {}) {
  return {
    id: row.id,
    class: row.class ? {
      id: row.class.id,
      name: row.class.name || '',
      subjectCode: row.class.subjectCode || '',
      subject: row.class.subject || '',
    } : null,
    sessionDate: row.sessionDate || null,
    startTime: row.startTime || null,
    endTime: row.endTime || null,
    teacher: mapUserLite(row.teacher),
    room: row.room || '',
    location: row.location || '',
    title: row.title || '',
    note: row.note || '',
    status: normalizeSessionStatus(row.status),
    cancelReason: row.cancelReason || '',
    lessonContent: row.lessonContent || '',
    homework: row.homework || '',
    teacherComment: row.teacherComment || '',
    completedAt: row.completedAt || null,
    completedBy: mapUserLite(row.completedBy),
    attendanceSummary,
    reportSummary,
    permissions: buildSessionPermissions(permissionState, row, options),
  };
}

async function ensureSessionDuplicateNotExists(classId: number, sessionDate: string, startTime: string, endTime: string, tenantId: number | string, existingId?: number | null, trx?: any) {
  const duplicate = await strapi.db.query(CLASS_SESSION_UID).findOne({
    where: mergeTenantWhere({
      class: { id: { $eq: classId } },
      sessionDate,
      startTime,
      endTime,
      status: { $ne: 'cancelled' },
    }, tenantId),
    select: ['id'],
    ...(trx ? { transacting: trx } : {}),
  } as any);

  if (duplicate?.id && Number(duplicate.id) !== Number(existingId || 0)) {
    throw httpError(409, 'Class session already exists for this class, date, and time');
  }
}

function buildSessionWriteData(input: GenericRecord, teacher: any, classEntity: any, options: { existing?: any; isUpdate?: boolean } = {}) {
  const existing = options.existing || null;
  const sessionDate = toIsoDate(input.sessionDate ?? existing?.sessionDate, 'sessionDate');
  const startTime = normalizeTime(input.startTime ?? existing?.startTime, 'startTime');
  const endTime = normalizeTime(input.endTime ?? existing?.endTime, 'endTime');
  if (startTime >= endTime) throw httpError(400, 'endTime must be greater than startTime');

  const nextStatus = normalizeSessionStatus(input.status ?? existing?.status ?? 'scheduled');
  if (!options.isUpdate && nextStatus === 'cancelled') {
    throw httpError(400, 'Use cancel endpoint to cancel a class session');
  }
  if (nextStatus === 'completed') {
    throw httpError(400, 'Use complete endpoint to complete a class session');
  }
  if (!MUTABLE_SESSION_STATUSES.has(nextStatus)) {
    throw httpError(400, 'status is invalid');
  }

  return {
    class: classEntity.id,
    teacher: teacher.id,
    sessionDate,
    startTime,
    endTime,
    room: toText(input.room) || null,
    location: toText(input.location) || null,
    title: toText(input.title) || null,
    note: toText(input.note) || null,
    status: nextStatus,
    tenant: classEntity.tenant?.id || classEntity.tenant,
  };
}

async function loadAttendanceRows(sessionId: number, tenantId: number | string) {
  return strapi.db.query(CLASS_SESSION_ATTENDANCE_UID).findMany({
    where: mergeTenantWhere({
      classSession: { id: { $eq: sessionId } },
    }, tenantId),
    orderBy: [{ id: 'asc' }],
    populate: {
      learner: {
        select: ['id', 'code', 'fullName', 'email', 'phone'],
        populate: {
          user: {
            select: ['id', 'username', 'email', 'phone', 'fullName'],
          },
        },
      },
      markedBy: {
        select: ['id', 'username', 'email', 'fullName'],
      },
    },
  });
}

export async function getEligibleLearnersForSession(session: any, tenantId: number | string) {
  const sessionDate = toIsoDate(session?.sessionDate, 'sessionDate');
  if (!sessionDate) throw httpError(400, 'sessionDate is required');

  const rows = await strapi.db.query(ENROLLMENT_UID).findMany({
    where: mergeTenantWhere({
      class: { id: { $eq: Number(session?.class?.id || session?.class || 0) } },
      $and: [
        {
          $or: [
            { joinDate: null },
            { joinDate: { $lte: sessionDate } },
          ],
        },
        {
          $or: [
            { leaveDate: null },
            { leaveDate: { $gte: sessionDate } },
          ],
        },
      ],
    }, tenantId),
    orderBy: [{ joinDate: 'asc' }, { id: 'asc' }],
    populate: {
      learner: {
        select: ['id', 'code', 'fullName', 'email', 'phone'],
        populate: {
          user: {
            select: ['id', 'username', 'email', 'phone', 'fullName'],
          },
        },
      },
    },
  });

  return (rows || [])
    .filter((row: any) => row?.learner?.id)
    .map((row: any) => ({
      enrollmentId: row.id,
      joinDate: row.joinDate || null,
      leaveDate: row.leaveDate || null,
      enrollmentStatus: row.enrollmentStatus || 'active',
      learner: mapLearnerLite(row.learner),
    }));
}

export async function listClassSessions(classEntity: any, access: { userId: number; canManageClasses: boolean }, tenantId: number | string, options: { mode?: SessionMode; includeAllVisibleSessions?: boolean } = {}) {
  const mode = options.mode || 'standard';
  await ensureCanViewClassSessions(classEntity, access, tenantId);

  const rows = await strapi.db.query(CLASS_SESSION_UID).findMany({
    where: mergeTenantWhere({
      class: { id: { $eq: classEntity.id } },
    }, tenantId),
    orderBy: [{ sessionDate: 'desc' }, { startTime: 'desc' }, { id: 'desc' }],
    populate: {
      class: {
        select: ['id', 'name'],
        populate: {
          mainTeacher: {
            select: ['id', 'username', 'email', 'fullName'],
          },
        },
      },
      teacher: {
        select: ['id', 'username', 'email', 'fullName'],
      },
      completedBy: {
        select: ['id', 'username', 'email', 'fullName'],
      },
    },
  });

  const filteredRows = [];
  for (const row of rows || []) {
    if (access.canManageClasses) {
      filteredRows.push(row);
      continue;
    }

    if (mode === 'teacher' && options.includeAllVisibleSessions === true) {
      filteredRows.push(row);
      continue;
    }

    if (mode === 'teacher') {
      if (isSessionAssignedTeacher(row, access.userId)) {
        filteredRows.push(row);
      }
      continue;
    }

    if (await canTeachClassSession(row, access, tenantId)) {
      filteredRows.push(row);
    }
  }

  const sessionIds = filteredRows.map((item: any) => Number(item.id)).filter(Boolean);
  const attendanceRows = sessionIds.length > 0
    ? await strapi.db.query(CLASS_SESSION_ATTENDANCE_UID).findMany({
        where: mergeTenantWhere({
          classSession: { id: { $in: sessionIds } },
        }, tenantId),
        select: ['id', 'status'],
        populate: {
          classSession: {
            select: ['id'],
          },
        },
      })
    : [];

  const attendanceBySessionId = new Map<number, any[]>();
  for (const row of attendanceRows || []) {
    const sessionId = Number(row?.classSession?.id || row?.classSession || 0);
    if (!attendanceBySessionId.has(sessionId)) attendanceBySessionId.set(sessionId, []);
    attendanceBySessionId.get(sessionId)?.push(row);
  }

  const data = [];
  for (const row of filteredRows) {
    const eligibleLearners = await getEligibleLearnersForSession(row, tenantId);
    const currentAttendanceRows = attendanceBySessionId.get(Number(row.id)) || [];
    const attendanceSummary = buildAttendanceSummary(eligibleLearners, currentAttendanceRows);
    const reportSummary = buildReportSummary(row, attendanceSummary);
    const permissionState = await ensureCanTeachOrManageSession(row, access, tenantId, { mode, requireOperate: false });
    data.push(buildSessionListItem(row, attendanceSummary, reportSummary, permissionState, { mode }));
  }

  return data;
}

export async function createClassSession(classEntity: any, payload: GenericRecord, tenantId: number | string) {
  const teacher = await ensureTeacherInTenant(payload.teacher || classEntity.mainTeacher, tenantId);
  const data = buildSessionWriteData(payload, teacher, classEntity);
  await ensureSessionDuplicateNotExists(classEntity.id, String(data.sessionDate), String(data.startTime), String(data.endTime), tenantId);

  const created = await strapi.db.query(CLASS_SESSION_UID).create({
    data,
  });

  return findClassSessionOrThrow(created.id, tenantId);
}

export async function updateClassSession(session: any, payload: GenericRecord, tenantId: number | string) {
  const teacher = payload.teacher
    ? await ensureTeacherInTenant(payload.teacher, tenantId)
    : (session.teacher || await ensureTeacherInTenant(session.teacher, tenantId));
  const classEntity = await findClassForSessionOrThrow(session.class?.id || session.class, tenantId);
  const data = buildSessionWriteData(payload, teacher, classEntity, { existing: session, isUpdate: true });
  await ensureSessionDuplicateNotExists(classEntity.id, String(data.sessionDate), String(data.startTime), String(data.endTime), tenantId, Number(session.id));

  await strapi.db.query(CLASS_SESSION_UID).update({
    where: { id: session.id },
    data,
  });

  return findClassSessionOrThrow(session.id, tenantId);
}

export async function cancelClassSession(session: any, payload: GenericRecord, tenantId: number | string) {
  await strapi.db.query(CLASS_SESSION_UID).update({
    where: { id: session.id },
    data: {
      status: 'cancelled',
      cancelReason: toText(payload.cancelReason) || null,
    },
  });

  return findClassSessionOrThrow(session.id, tenantId);
}

export async function createClassSessionsBulk(classEntity: any, payload: GenericRecord, tenantId: number | string) {
  const teacher = await ensureTeacherInTenant(payload.teacher || classEntity.mainTeacher, tenantId);
  const items = requireArray(payload.items, 'items');
  const seenKeys = new Set<string>();
  const createdIds: number[] = [];
  const skipped: Array<{ key: string; reason: string }> = [];

  await strapi.db.connection.transaction(async (trx: any) => {
    for (const item of items) {
      const data = buildSessionWriteData(item as GenericRecord, teacher, classEntity);
      const key = `${data.sessionDate}|${data.startTime}|${data.endTime}`;
      if (seenKeys.has(key)) {
        skipped.push({ key, reason: 'Duplicated in request payload' });
        continue;
      }
      seenKeys.add(key);

      const existing = await strapi.db.query(CLASS_SESSION_UID).findOne({
        where: mergeTenantWhere({
          class: { id: { $eq: classEntity.id } },
          sessionDate: data.sessionDate,
          startTime: data.startTime,
          endTime: data.endTime,
          status: { $ne: 'cancelled' },
        }, tenantId),
        select: ['id'],
        transacting: trx,
      } as any);

      if (existing?.id) {
        skipped.push({ key, reason: 'Class session already exists' });
        continue;
      }

      const created = await strapi.db.query(CLASS_SESSION_UID).create({
        data,
        transacting: trx,
      } as any);
      createdIds.push(Number(created.id));
    }
  });

  const createdRows = [];
  for (const id of createdIds) {
    createdRows.push(await findClassSessionOrThrow(id, tenantId));
  }

  return {
    created: createdRows,
    skipped,
    summary: {
      requestedCount: items.length,
      createdCount: createdRows.length,
      skippedCount: skipped.length,
    },
  };
}

async function buildClassSessionDetailPayload(session: any, permissionState: { canManage: boolean; canTeach: boolean; canOperate?: boolean }, tenantId: number | string, options: { mode?: SessionMode } = {}) {
  const [eligibleLearners, attendanceRows] = await Promise.all([
    getEligibleLearnersForSession(session, tenantId),
    loadAttendanceRows(Number(session.id), tenantId),
  ]);

  const attendanceByLearnerId = new Map<number, any>();
  for (const row of attendanceRows || []) {
    const learnerId = Number(row?.learner?.id || row?.learner || 0);
    if (learnerId > 0) attendanceByLearnerId.set(learnerId, row);
  }

  const historicalOnlyLearners = (attendanceRows || [])
    .filter((row: any) => !eligibleLearners.some((item: any) => Number(item?.learner?.id || 0) === Number(row?.learner?.id || 0)))
    .map((row: any) => ({
      enrollmentId: null,
      joinDate: null,
      leaveDate: null,
      enrollmentStatus: 'historical',
      learner: mapLearnerLite(row.learner),
      historicalOnly: true,
    }));

  const learnerRows = [...eligibleLearners, ...historicalOnlyLearners].map((item: any) => ({
    ...item,
    attendance: attendanceByLearnerId.get(Number(item?.learner?.id || 0)) ? mapAttendance(attendanceByLearnerId.get(Number(item?.learner?.id || 0))) : null,
  }));

  const attendanceSummary = buildAttendanceSummary(learnerRows, attendanceRows);
  const reportSummary = buildReportSummary(session, attendanceSummary);

  return {
    id: session.id,
    class: session.class ? {
      id: session.class.id,
      name: session.class.name || '',
      subjectCode: session.class.subjectCode || '',
      subject: session.class.subject || '',
      mainTeacher: mapUserLite(session.class.mainTeacher),
    } : null,
    sessionDate: session.sessionDate || null,
    startTime: session.startTime || null,
    endTime: session.endTime || null,
    teacher: mapUserLite(session.teacher),
    room: session.room || '',
    location: session.location || '',
    title: session.title || '',
    note: session.note || '',
    status: normalizeSessionStatus(session.status),
    cancelReason: session.cancelReason || '',
    lessonContent: session.lessonContent || '',
    homework: session.homework || '',
    teacherComment: session.teacherComment || '',
    completedAt: session.completedAt || null,
    completedBy: mapUserLite(session.completedBy),
    eligibleLearners: learnerRows,
    attendanceRows: (attendanceRows || []).map(mapAttendance).filter(Boolean),
    attendanceSummary,
    reportSummary,
    permissions: buildSessionPermissions(permissionState, session, options),
  };
}

export async function getClassSessionDetail(session: any, access: { userId: number; canManageClasses: boolean }, tenantId: number | string, options: { mode?: SessionMode } = {}) {
  const mode = options.mode || 'standard';
  const permissionState = await ensureCanTeachOrManageSession(session, access, tenantId, { mode, requireOperate: false });
  return buildClassSessionDetailPayload(session, permissionState, tenantId, { mode });
}

export async function saveClassSessionAttendance(session: any, payload: GenericRecord, access: { userId: number; canManageClasses: boolean }, tenantId: number | string, options: { mode?: SessionMode } = {}) {
  const mode = options.mode || 'standard';
  const permissionState = await ensureCanTeachOrManageSession(session, access, tenantId, { mode, requireOperate: true });
  const permissions = buildSessionPermissions(permissionState, session, { mode });
  if (!permissions.canMarkAttendance) throw httpError(403, 'Forbidden');

  const items = requireArray(payload.items, 'items');
  const existingRows = await loadAttendanceRows(Number(session.id), tenantId);
  const eligibleLearners = await getEligibleLearnersForSession(session, tenantId);
  const allowedLearnerIds = new Set<number>([
    ...eligibleLearners.map((item: any) => Number(item?.learner?.id || 0)),
    ...existingRows.map((item: any) => Number(item?.learner?.id || item?.learner || 0)),
  ].filter((value) => value > 0));

  const existingByLearnerId = new Map<number, any>();
  for (const row of existingRows || []) {
    const learnerId = Number(row?.learner?.id || row?.learner || 0);
    if (learnerId > 0) existingByLearnerId.set(learnerId, row);
  }

  const seenLearnerIds = new Set<number>();
  await strapi.db.connection.transaction(async (trx: any) => {
    for (const item of items) {
      const learnerId = toPositiveInt(extractRelationRef((item as any)?.learner) || (item as any)?.learnerId);
      if (!learnerId) throw httpError(400, 'learner is required for attendance item');
      if (seenLearnerIds.has(learnerId)) throw httpError(409, `Duplicate attendance item for learner ${learnerId}`);
      seenLearnerIds.add(learnerId);

      if (!allowedLearnerIds.has(learnerId)) {
        throw httpError(400, `Learner ${learnerId} is not eligible for this class session`);
      }

      const learner = await strapi.db.query(LEARNER_UID).findOne({
        where: {
          id: learnerId,
          tenant: tenantId,
        },
        select: ['id'],
        transacting: trx,
      } as any);

      if (!learner?.id) throw httpError(400, `Learner ${learnerId} does not belong to current tenant`);

      const data = {
        classSession: Number(session.id),
        learner: learnerId,
        status: normalizeAttendanceStatus((item as any)?.status, 'present'),
        note: toText((item as any)?.note) || null,
        markedBy: access.userId,
        markedAt: new Date().toISOString(),
        tenant: session.tenant?.id || session.tenant,
      };

      const existing = existingByLearnerId.get(learnerId);
      if (existing?.id) {
        await strapi.db.query(CLASS_SESSION_ATTENDANCE_UID).update({
          where: { id: existing.id },
          data,
          transacting: trx,
        } as any);
      } else {
        await strapi.db.query(CLASS_SESSION_ATTENDANCE_UID).create({
          data,
          transacting: trx,
        } as any);
      }
    }

    if (normalizeSessionStatus(session.status) === 'scheduled') {
      await strapi.db.query(CLASS_SESSION_UID).update({
        where: { id: session.id },
        data: { status: 'in_progress' },
        transacting: trx,
      } as any);
    }
  });

  const updatedSession = await findClassSessionOrThrow(session.id, tenantId);
  return getClassSessionDetail(updatedSession, access, tenantId, { mode });
}

export async function updateClassSessionReport(session: any, payload: GenericRecord, access: { userId: number; canManageClasses: boolean }, tenantId: number | string, options: { mode?: SessionMode } = {}) {
  const mode = options.mode || 'standard';
  const permissionState = await ensureCanTeachOrManageSession(session, access, tenantId, { mode, requireOperate: true });
  const permissions = buildSessionPermissions(permissionState, session, { mode });
  if (!permissions.canEditReport) throw httpError(403, 'Forbidden');
  const nextStatus = toText(payload.status).toLowerCase();
  if (nextStatus && nextStatus !== 'scheduled' && nextStatus !== 'in_progress') {
    throw httpError(400, 'Use complete or cancel endpoint for terminal session states');
  }

  const data: Record<string, unknown> = {
    lessonContent: toText(payload.lessonContent) || null,
    homework: toText(payload.homework) || null,
    teacherComment: toText(payload.teacherComment) || null,
  };

  if (nextStatus) data.status = nextStatus;
  else if (normalizeSessionStatus(session.status) === 'scheduled') data.status = 'in_progress';

  await strapi.db.query(CLASS_SESSION_UID).update({
    where: { id: session.id },
    data,
  });

  const updatedSession = await findClassSessionOrThrow(session.id, tenantId);
  return getClassSessionDetail(updatedSession, access, tenantId, { mode });
}

export async function completeClassSession(session: any, payload: GenericRecord, access: { userId: number; canManageClasses: boolean }, tenantId: number | string, options: { mode?: SessionMode } = {}) {
  const mode = options.mode || 'standard';
  const permissionState = await ensureCanTeachOrManageSession(session, access, tenantId, { mode, requireOperate: true });
  const permissions = buildSessionPermissions(permissionState, session, { mode });
  if (!permissions.canComplete) throw httpError(403, 'Forbidden');

  const data: Record<string, unknown> = {
    status: 'completed',
    completedAt: new Date().toISOString(),
    completedBy: access.userId,
  };

  if (Object.prototype.hasOwnProperty.call(payload, 'lessonContent')) data.lessonContent = toText(payload.lessonContent) || null;
  if (Object.prototype.hasOwnProperty.call(payload, 'homework')) data.homework = toText(payload.homework) || null;
  if (Object.prototype.hasOwnProperty.call(payload, 'teacherComment')) data.teacherComment = toText(payload.teacherComment) || null;

  await strapi.db.query(CLASS_SESSION_UID).update({
    where: { id: session.id },
    data,
  });

  const updatedSession = await findClassSessionOrThrow(session.id, tenantId);
  return getClassSessionDetail(updatedSession, access, tenantId, { mode });
}

export function getSessionErrorStatus(error: any, fallback = 400) {
  const message = String(error?.message || '').toLowerCase();
  if (message.includes('not found')) return 404;
  const status = Number(error?.status || error?.statusCode || 0);
  return Number.isInteger(status) && status > 0 ? status : fallback;
}