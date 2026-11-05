import { mergeTenantWhere, toText } from '../../../utils/tenant-scope';
import {
  findClassForSessionOrThrow,
  findClassSessionOrThrow,
  getSessionAccessContext,
} from './class-session';

const CLASS_SESSION_UID = 'api::class-session.class-session';
const CLASS_SESSION_ATTENDANCE_UID = 'api::class-session-attendance.class-session-attendance';
const ENROLLMENT_UID = 'api::enrollment.enrollment';
const LEARNER_UID = 'api::learner.learner';
const TENANT_UID = 'api::tenant.tenant';
const DEFAULT_STUDENT_TIME_ZONE = 'Asia/Ho_Chi_Minh';
const STUDENT_FEATURE_KEYS = ['class.student-workspace', 'class.student-classes', 'class.student-sessions'];

function httpError(status: number, message: string) {
  const error = new Error(message) as Error & { status?: number };
  error.status = status;
  return error;
}

function parsePositiveInt(value: unknown): number | null {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

function normalizeStatus(value: unknown) {
  return toText(value).toLowerCase();
}

function mapUserLite(user: any) {
  if (!user?.id) return null;
  return {
    id: Number(user.id),
    username: user.username || '',
    email: user.email || '',
    fullName: user.fullName || '',
  };
}

function mapLearnerLite(learner: any) {
  if (!learner?.id) return null;
  return {
    id: Number(learner.id),
    code: learner.code || '',
    fullName: learner.fullName || '',
    learnerStatus: learner.learnerStatus || learner.status || 'active',
  };
}

function ensureStudentFeature(access: { canManageClasses: boolean; permissionKeys?: Set<string> }, acceptedKeys: string[] = STUDENT_FEATURE_KEYS) {
  if (access.canManageClasses) return;
  const hasFeature = acceptedKeys.some((key) => access.permissionKeys?.has(key));
  if (!hasFeature) throw httpError(403, 'User does not have student workspace feature permission in current tenant');
}

function formatTime(value: unknown) {
  const text = toText(value);
  if (!text) return '';
  const parts = text.split(':');
  return parts.length >= 2 ? `${parts[0]}:${parts[1]}` : text;
}

function readTimeValueInMinutes(value: unknown) {
  const text = formatTime(value);
  if (!text) return null;
  const [hourText, minuteText] = text.split(':');
  const hour = Number(hourText);
  const minute = Number(minuteText);
  if (!Number.isInteger(hour) || !Number.isInteger(minute)) return null;
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return null;
  return (hour * 60) + minute;
}

function isValidTimeZone(value: string) {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: value }).format(new Date());
    return true;
  } catch {
    return false;
  }
}

function normalizeTimeZone(value: unknown) {
  const text = toText(value);
  if (!text) return DEFAULT_STUDENT_TIME_ZONE;

  const withoutOffset = text.replace(/^\(GMT[^)]*\)\s*/, '').trim();
  if (withoutOffset && isValidTimeZone(withoutOffset)) return withoutOffset;

  const matched = text.match(/[A-Za-z_]+\/[A-Za-z_]+(?:\/[A-Za-z_]+)*/);
  if (matched?.[0] && isValidTimeZone(matched[0])) return matched[0];

  return DEFAULT_STUDENT_TIME_ZONE;
}

function getTimeZoneNowParts(now: Date, timeZone: string) {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
  const parts = formatter.formatToParts(now);
  const lookup = new Map(parts.map((item) => [item.type, item.value]));
  const year = lookup.get('year') || '0000';
  const month = lookup.get('month') || '01';
  const day = lookup.get('day') || '01';
  const hour = Number(lookup.get('hour') || '0');
  const minute = Number(lookup.get('minute') || '0');

  return {
    dateOnly: `${year}-${month}-${day}`,
    minutes: (hour * 60) + minute,
  };
}

function compareSessionDate(dateText: string, targetDateText: string) {
  if (!dateText || !targetDateText) return 0;
  if (dateText === targetDateText) return 0;
  return dateText > targetDateText ? 1 : -1;
}

function isTodaySession(session: any, now = new Date(), timeZone = DEFAULT_STUDENT_TIME_ZONE) {
  return toText(session?.sessionDate) === getTimeZoneNowParts(now, timeZone).dateOnly;
}

function isUpcomingSession(session: any, now = new Date(), timeZone = DEFAULT_STUDENT_TIME_ZONE) {
  const status = normalizeStatus(session?.status);
  if (status === 'completed' || status === 'cancelled') return false;

  const sessionDate = toText(session?.sessionDate);
  if (!sessionDate) return false;

  const nowParts = getTimeZoneNowParts(now, timeZone);
  const dateComparison = compareSessionDate(sessionDate, nowParts.dateOnly);
  if (dateComparison > 0) return true;
  if (dateComparison < 0) return false;

  const startMinutes = readTimeValueInMinutes(session?.startTime);
  return startMinutes !== null && startMinutes > nowParts.minutes;
}

function isPastSession(session: any, now = new Date(), timeZone = DEFAULT_STUDENT_TIME_ZONE) {
  if (normalizeStatus(session?.status) === 'cancelled') return false;
  if (isTodaySession(session, now, timeZone)) return false;
  if (isUpcomingSession(session, now, timeZone)) return false;
  return compareSessionDate(toText(session?.sessionDate), getTimeZoneNowParts(now, timeZone).dateOnly) <= 0;
}

function isSessionCurrentOrFuture(session: any, now = new Date(), timeZone = DEFAULT_STUDENT_TIME_ZONE) {
  const status = normalizeStatus(session?.status);
  if (status === 'cancelled' || status === 'completed') return false;

  const sessionDate = toText(session?.sessionDate);
  if (!sessionDate) return false;

  const nowParts = getTimeZoneNowParts(now, timeZone);
  const dateComparison = compareSessionDate(sessionDate, nowParts.dateOnly);
  if (dateComparison > 0) return true;
  if (dateComparison < 0) return false;

  const endMinutes = readTimeValueInMinutes(session?.endTime || session?.startTime);
  return endMinutes !== null && endMinutes >= nowParts.minutes;
}

async function getTenantSummary(tenantId: number | string) {
  const tenant = await strapi.db.query(TENANT_UID).findOne({
    where: { id: tenantId },
    select: ['id', 'code', 'name', 'shortName', 'siteTitle', 'timezone'],
  });

  if (!tenant?.id) throw httpError(404, 'Tenant not found');

  return {
    id: Number(tenant.id),
    code: tenant.code || '',
    name: tenant.name || tenant.siteTitle || tenant.shortName || '',
    timezone: normalizeTimeZone(tenant.timezone),
  };
}

async function listUserLearnersInTenant(tenantId: number | string, userId: number) {
  const rows = await strapi.db.query(LEARNER_UID).findMany({
    where: mergeTenantWhere({
      user: { id: { $eq: userId } },
    }, tenantId),
    select: ['id', 'code', 'fullName', 'learnerStatus'],
    orderBy: [{ id: 'asc' }],
  });

  return (rows || []).map(mapLearnerLite).filter(Boolean);
}

function mapPortalUser(user: any) {
  if (!user?.id) return null;
  return {
    id: Number(user.id),
    username: user.username || '',
    email: user.email || '',
    fullName: user.fullName || '',
  };
}

function isEnrollmentVisibleOnDate(enrollment: any, sessionDate: string) {
  const dateText = toText(sessionDate);
  if (!dateText) return false;
  const joinDate = toText(enrollment?.joinDate);
  const leaveDate = toText(enrollment?.leaveDate);
  if (joinDate && joinDate > dateText) return false;
  if (leaveDate && leaveDate < dateText) return false;
  return true;
}

function isCurrentEnrollment(enrollment: any, todayDate: string) {
  if (normalizeStatus(enrollment?.enrollmentStatus) === 'inactive') return false;
  return isEnrollmentVisibleOnDate(enrollment, todayDate);
}

function compareEnrollmentRecency(a: any, b: any) {
  const aJoin = toText(a?.joinDate);
  const bJoin = toText(b?.joinDate);
  if (aJoin !== bJoin) return aJoin > bJoin ? -1 : 1;
  return Number(b?.id || 0) - Number(a?.id || 0);
}

function pickPrimaryEnrollment(enrollments: any[], todayDate: string) {
  const rows = Array.isArray(enrollments) ? [...enrollments] : [];
  rows.sort((a, b) => {
    const aCurrent = isCurrentEnrollment(a, todayDate) ? 1 : 0;
    const bCurrent = isCurrentEnrollment(b, todayDate) ? 1 : 0;
    if (aCurrent !== bCurrent) return bCurrent - aCurrent;
    return compareEnrollmentRecency(a, b);
  });
  return rows[0] || null;
}

function buildEnrollmentContext(enrollments: any[], todayDate: string) {
  const primary = pickPrimaryEnrollment(enrollments, todayDate);
  if (!primary) return null;
  return {
    enrollmentStatus: primary.enrollmentStatus || 'active',
    joinDate: primary.joinDate || null,
    leaveDate: primary.leaveDate || null,
    isCurrent: isCurrentEnrollment(primary, todayDate),
    totalEnrollments: enrollments.length,
  };
}

function attachStudentSessionMeta(session: any, now = new Date(), timeZone = DEFAULT_STUDENT_TIME_ZONE) {
  return {
    ...session,
    timing: {
      isToday: isTodaySession(session, now, timeZone),
      isUpcoming: isUpcomingSession(session, now, timeZone),
      isPast: isPastSession(session, now, timeZone),
    },
  };
}

async function resolveStudentPortalContext(query: Record<string, unknown>, tenantId: number | string, authUser: any, acceptedKeys: string[] = STUDENT_FEATURE_KEYS) {
  const access = await getSessionAccessContext(tenantId, authUser);
  ensureStudentFeature(access, acceptedKeys);
  const tenant = await getTenantSummary(tenantId);
  const learners = await listUserLearnersInTenant(tenantId, access.userId);
  const requestedLearnerId = parsePositiveInt(query?.learnerId);
  const currentLearner = requestedLearnerId
    ? (learners.find((item) => Number(item?.id || 0) === requestedLearnerId) || null)
    : learners.length === 1
      ? learners[0]
      : null;

  if (requestedLearnerId && !currentLearner) {
    throw httpError(403, 'Learner context does not belong to current user in this tenant');
  }

  const learnerState = learners.length === 0
    ? 'missing'
    : currentLearner
      ? 'linked'
      : 'selection_required';

  return {
    access,
    timeZone: tenant.timezone,
    context: {
      user: mapPortalUser(authUser),
      tenant,
      learners,
      learnerContext: currentLearner,
      learnerState,
      requiresLearnerSelection: learners.length > 1 && !currentLearner,
    },
  };
}

function requireCurrentLearner(contextState: ReturnType<typeof resolveStudentPortalContext> extends Promise<infer T> ? T : never) {
  if (contextState.context.learnerContext?.id) return contextState.context.learnerContext;
  if (contextState.context.learners.length === 0) {
    throw httpError(403, 'Bạn chưa có hồ sơ học tập được liên kết trong không gian số này.');
  }
  throw httpError(409, 'Vui lòng chọn hồ sơ học tập đang sử dụng trước khi tiếp tục.');
}

async function loadLearnerEnrollments(tenantId: number | string, learnerId: number, classId?: number | null) {
  const where = mergeTenantWhere({
    learner: { id: { $eq: learnerId } },
    ...(classId ? { class: { id: { $eq: classId } } } : {}),
  }, tenantId);

  return strapi.db.query(ENROLLMENT_UID).findMany({
    where,
    select: ['id', 'joinDate', 'leaveDate', 'enrollmentStatus', 'updatedAt'],
    orderBy: [{ joinDate: 'desc' }, { id: 'desc' }],
    populate: {
      class: {
        select: ['id', 'name', 'subjectCode', 'subject', 'classStatus'],
        populate: {
          mainTeacher: { select: ['id', 'username', 'email', 'fullName'] },
          tenant: { select: ['id'] },
        },
      },
    },
  });
}

function buildEnrollmentMap(rows: any[]) {
  const byClassId = new Map<number, any[]>();
  for (const row of rows || []) {
    const classId = Number(row?.class?.id || row?.class || 0);
    if (!classId) continue;
    if (!byClassId.has(classId)) byClassId.set(classId, []);
    byClassId.get(classId)?.push(row);
  }
  return byClassId;
}

async function loadSessionsForClasses(tenantId: number | string, classIds: number[], query: Record<string, unknown>) {
  if (classIds.length === 0) return [];
  const fromDate = toText(query?.fromDate || query?.from);
  const toDate = toText(query?.toDate || query?.to);
  const status = normalizeStatus(query?.status);
  const clauses: Record<string, unknown>[] = [{ class: { id: { $in: classIds } } }];

  if (fromDate) clauses.push({ sessionDate: { $gte: fromDate } });
  if (toDate) clauses.push({ sessionDate: { $lte: toDate } });
  if (status === 'scheduled' || status === 'in_progress' || status === 'completed' || status === 'cancelled') {
    clauses.push({ status });
  }

  return strapi.db.query(CLASS_SESSION_UID).findMany({
    where: mergeTenantWhere({ $and: clauses }, tenantId),
    orderBy: [{ sessionDate: 'desc' }, { startTime: 'desc' }, { id: 'desc' }],
    populate: {
      class: {
        select: ['id', 'name', 'subjectCode', 'subject'],
        populate: {
          mainTeacher: { select: ['id', 'username', 'email', 'fullName'] },
        },
      },
      teacher: { select: ['id', 'username', 'email', 'fullName'] },
      completedBy: { select: ['id', 'username', 'email', 'fullName'] },
    },
  });
}

async function loadAttendanceForLearnerSessions(tenantId: number | string, learnerId: number, sessionIds: number[]) {
  if (sessionIds.length === 0) return new Map<number, any>();
  const rows = await strapi.db.query(CLASS_SESSION_ATTENDANCE_UID).findMany({
    where: mergeTenantWhere({
      classSession: { id: { $in: sessionIds } },
      learner: { id: { $eq: learnerId } },
    }, tenantId),
    orderBy: [{ id: 'desc' }],
    populate: {
      markedBy: { select: ['id', 'username', 'email', 'fullName'] },
      classSession: { select: ['id'] },
    },
  });

  const map = new Map<number, any>();
  for (const row of rows || []) {
    const sessionId = Number(row?.classSession?.id || row?.classSession || 0);
    if (!sessionId || map.has(sessionId)) continue;
    map.set(sessionId, row);
  }
  return map;
}

function mapMyAttendance(row: any) {
  if (!row?.id) return null;
  return {
    id: Number(row.id),
    status: row.status || 'not_marked',
    note: row.note || '',
    markedAt: row.markedAt || null,
    markedBy: mapUserLite(row.markedBy),
  };
}

function mapSessionListItem(row: any, attendanceRow: any, now = new Date(), timeZone = DEFAULT_STUDENT_TIME_ZONE) {
  return attachStudentSessionMeta({
    id: Number(row.id),
    class: row.class ? {
      id: Number(row.class.id),
      name: row.class.name || '',
      subjectCode: row.class.subjectCode || '',
      subject: row.class.subject || '',
      mainTeacher: mapUserLite(row.class.mainTeacher),
    } : null,
    sessionDate: row.sessionDate || null,
    startTime: row.startTime || null,
    endTime: row.endTime || null,
    teacher: mapUserLite(row.teacher),
    room: row.room || '',
    location: row.location || '',
    title: row.title || '',
    note: row.note || '',
    status: row.status || 'scheduled',
    cancelReason: row.cancelReason || '',
    lessonContent: row.lessonContent || '',
    homework: row.homework || '',
    teacherComment: row.teacherComment || '',
    completedAt: row.completedAt || null,
    completedBy: mapUserLite(row.completedBy),
    myAttendance: mapMyAttendance(attendanceRow),
    accessMode: 'read_only',
    permissions: {
      canView: true,
      canManage: false,
      canTeach: false,
      canEditSchedule: false,
      canCancel: false,
      canMarkAttendance: false,
      canEditReport: false,
      canComplete: false,
    },
  }, now, timeZone);
}

function mapStudentClassRow(classEntity: any, enrollments: any[], nextSession: any, todayDate: string) {
  const enrollmentContext = buildEnrollmentContext(enrollments, todayDate);
  return {
    id: Number(classEntity?.id || 0),
    name: classEntity?.name || '',
    subjectCode: classEntity?.subjectCode || '',
    subject: classEntity?.subject || '',
    status: classEntity?.classStatus || classEntity?.status || 'active',
    mainTeacher: mapUserLite(classEntity?.mainTeacher),
    enrollmentContext,
    nextSession,
  };
}

function sortSessionsAscending(rows: any[]) {
  return [...rows].sort((a, b) => {
    const aDate = toText(a?.sessionDate);
    const bDate = toText(b?.sessionDate);
    if (aDate !== bDate) return aDate > bDate ? 1 : -1;
    const aTime = formatTime(a?.startTime);
    const bTime = formatTime(b?.startTime);
    if (aTime !== bTime) return aTime > bTime ? 1 : -1;
    return Number(a?.id || 0) - Number(b?.id || 0);
  });
}

function findNextVisibleSession(rows: any[], now = new Date(), timeZone = DEFAULT_STUDENT_TIME_ZONE) {
  return sortSessionsAscending(rows).find((row) => isSessionCurrentOrFuture(row, now, timeZone)) || null;
}

async function listVisibleSessionsForLearner(tenantId: number | string, learnerId: number, query: Record<string, unknown>, timeZone: string, scopedClassId?: number | null) {
  const enrollments = await loadLearnerEnrollments(tenantId, learnerId, scopedClassId || null);
  const enrollmentsByClassId = buildEnrollmentMap(enrollments || []);
  const classIds = Array.from(enrollmentsByClassId.keys());
  const sessionRows = await loadSessionsForClasses(tenantId, classIds, query);
  const visibleRows = (sessionRows || []).filter((row: any) => {
    const classId = Number(row?.class?.id || row?.class || 0);
    const enrollmentRows = enrollmentsByClassId.get(classId) || [];
    return enrollmentRows.some((enrollment) => isEnrollmentVisibleOnDate(enrollment, toText(row?.sessionDate)));
  });

  const attendanceMap = await loadAttendanceForLearnerSessions(tenantId, learnerId, visibleRows.map((item: any) => Number(item.id)).filter(Boolean));
  const now = new Date();
  return {
    enrollments,
    enrollmentsByClassId,
    rows: visibleRows.map((row: any) => mapSessionListItem(row, attendanceMap.get(Number(row.id)), now, timeZone)),
    now,
  };
}

export async function getStudentContext(query: Record<string, unknown>, tenantId: number | string, authUser: any) {
  const resolved = await resolveStudentPortalContext(query, tenantId, authUser);
  return {
    ...resolved.context,
  };
}

export async function listStudentClasses(query: Record<string, unknown>, tenantId: number | string, authUser: any) {
  const resolved = await resolveStudentPortalContext(query, tenantId, authUser, ['class.student-classes', 'class.student-workspace']);
  const learner = resolved.context.learnerContext;
  const serverNow = new Date().toISOString();
  if (!learner?.id) {
    return { rows: [], context: resolved.context, serverNow };
  }

  const enrollments = await loadLearnerEnrollments(tenantId, Number(learner.id));
  const enrollmentsByClassId = buildEnrollmentMap(enrollments || []);
  const classIds = Array.from(enrollmentsByClassId.keys());
  const sessionRows = await loadSessionsForClasses(tenantId, classIds, {},);
  const sessionRowsByClassId = new Map<number, any[]>();
  for (const row of sessionRows || []) {
    const classId = Number(row?.class?.id || row?.class || 0);
    if (!classId) continue;
    const enrollmentRows = enrollmentsByClassId.get(classId) || [];
    if (!enrollmentRows.some((enrollment) => isEnrollmentVisibleOnDate(enrollment, toText(row?.sessionDate)))) continue;
    if (!sessionRowsByClassId.has(classId)) sessionRowsByClassId.set(classId, []);
    sessionRowsByClassId.get(classId)?.push(row);
  }

  const todayDate = getTimeZoneNowParts(new Date(), resolved.timeZone).dateOnly;
  const rows = Array.from(enrollmentsByClassId.entries())
    .map(([classId, classEnrollments]) => {
      const classEntity = classEnrollments[0]?.class;
      if (!classEntity?.id) return null;
      const nextSessionRaw = findNextVisibleSession(sessionRowsByClassId.get(classId) || [], new Date(), resolved.timeZone);
      const nextSession = nextSessionRaw ? mapSessionListItem(nextSessionRaw, null, new Date(), resolved.timeZone) : null;
      return mapStudentClassRow(classEntity, classEnrollments, nextSession, todayDate);
    })
    .filter(Boolean)
    .sort((a: any, b: any) => {
      const aCurrent = a?.enrollmentContext?.isCurrent ? 1 : 0;
      const bCurrent = b?.enrollmentContext?.isCurrent ? 1 : 0;
      if (aCurrent !== bCurrent) return bCurrent - aCurrent;
      return String(a?.name || '').localeCompare(String(b?.name || ''), 'vi');
    });

  return { rows, context: resolved.context, serverNow };
}

export async function getStudentClassDetail(classRef: unknown, query: Record<string, unknown>, tenantId: number | string, authUser: any) {
  const resolved = await resolveStudentPortalContext(query, tenantId, authUser, ['class.student-classes', 'class.student-workspace']);
  const learner = requireCurrentLearner(resolved);
  const classEntity = await findClassForSessionOrThrow(classRef, tenantId);
  const enrollments = await loadLearnerEnrollments(tenantId, Number(learner.id), Number(classEntity.id));
  if ((enrollments || []).length === 0) throw httpError(403, 'Learner does not have access to this class');

  const todayDate = getTimeZoneNowParts(new Date(), resolved.timeZone).dateOnly;
  return {
    detail: {
      id: Number(classEntity.id),
      name: classEntity.name || '',
      subjectCode: classEntity.subjectCode || '',
      subject: classEntity.subject || '',
      status: classEntity.classStatus || classEntity.status || 'active',
      mainTeacher: mapUserLite(classEntity.mainTeacher),
      enrollmentContext: buildEnrollmentContext(enrollments, todayDate),
      permissions: {
        canView: true,
        canEditClass: false,
        canEditEnrollments: false,
        canEditAssignments: false,
        canCreateSessions: false,
        canBulkCreateSessions: false,
      },
    },
    context: resolved.context,
    serverNow: new Date().toISOString(),
  };
}

export async function listStudentClassSessions(classRef: unknown, query: Record<string, unknown>, tenantId: number | string, authUser: any) {
  const resolved = await resolveStudentPortalContext(query, tenantId, authUser, ['class.student-classes', 'class.student-workspace']);
  const learner = requireCurrentLearner(resolved);
  const classEntity = await findClassForSessionOrThrow(classRef, tenantId);
  const enrollments = await loadLearnerEnrollments(tenantId, Number(learner.id), Number(classEntity.id));
  if ((enrollments || []).length === 0) throw httpError(403, 'Learner does not have access to this class');

  const result = await listVisibleSessionsForLearner(tenantId, Number(learner.id), { ...query, classId: classEntity.id }, resolved.timeZone, Number(classEntity.id));
  return {
    rows: result.rows,
    context: resolved.context,
    serverNow: result.now.toISOString(),
  };
}

export async function listStudentSessions(query: Record<string, unknown>, tenantId: number | string, authUser: any) {
  const resolved = await resolveStudentPortalContext(query, tenantId, authUser, ['class.student-sessions', 'class.student-workspace']);
  const learner = resolved.context.learnerContext;
  if (!learner?.id) {
    return { rows: [], context: resolved.context, serverNow: new Date().toISOString() };
  }

  const result = await listVisibleSessionsForLearner(tenantId, Number(learner.id), query, resolved.timeZone);
  return {
    rows: result.rows,
    context: resolved.context,
    serverNow: result.now.toISOString(),
  };
}

export async function getStudentSessionDetail(sessionRef: unknown, query: Record<string, unknown>, tenantId: number | string, authUser: any) {
  const resolved = await resolveStudentPortalContext(query, tenantId, authUser, ['class.student-sessions', 'class.student-workspace']);
  const learner = requireCurrentLearner(resolved);
  const session = await findClassSessionOrThrow(sessionRef, tenantId);
  const classId = Number(session?.class?.id || session?.class || 0);
  const enrollments = await loadLearnerEnrollments(tenantId, Number(learner.id), classId);
  if (!(enrollments || []).some((enrollment: any) => isEnrollmentVisibleOnDate(enrollment, toText(session?.sessionDate)))) {
    throw httpError(403, 'Learner does not have access to this class session');
  }

  const attendanceMap = await loadAttendanceForLearnerSessions(tenantId, Number(learner.id), [Number(session.id)]);
  const detail = mapSessionListItem(session, attendanceMap.get(Number(session.id)), new Date(), resolved.timeZone);
  return {
    detail: {
      ...detail,
      room: session.room || '',
      location: session.location || '',
      title: session.title || '',
      note: session.note || '',
      lessonContent: session.lessonContent || '',
      homework: session.homework || '',
      teacherComment: session.teacherComment || '',
      accessReason: 'Bạn chỉ có thể xem dữ liệu của chính hồ sơ học tập đang được chọn.',
    },
    context: resolved.context,
    serverNow: new Date().toISOString(),
  };
}

export function getStudentWorkspaceErrorStatus(error: any, fallback = 400) {
  const status = Number(error?.status || error?.statusCode || 0);
  if (Number.isInteger(status) && status > 0) return status;
  const message = String(error?.message || '').toLowerCase();
  if (message.includes('not found')) return 404;
  if (message.includes('forbidden')) return 403;
  return fallback;
}