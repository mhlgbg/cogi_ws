import { mergeTenantWhere, toText } from '../../../utils/tenant-scope';
import {
  findClassForSessionOrThrow,
  findClassSessionOrThrow,
  getClassSessionDetail,
  getSessionAccessContext,
  getTeacherAccessibleClassIds,
  getTeacherClassAccessState,
  getEligibleLearnersForSession,
  isSessionAssignedTeacher,
  listClassSessions,
  saveClassSessionAttendance,
  updateClassSessionReport,
  completeClassSession,
} from './class-session';

const CLASS_UID = 'api::class.class';
const CLASS_SESSION_UID = 'api::class-session.class-session';
const ENROLLMENT_UID = 'api::enrollment.enrollment';
const TENANT_UID = 'api::tenant.tenant';
const DEFAULT_TEACHER_TIME_ZONE = 'Asia/Ho_Chi_Minh';

function httpError(status: number, message: string) {
  const error = new Error(message) as Error & { status?: number };
  error.status = status;
  return error;
}

function ensureTeacherFeature(access: { canManageClasses: boolean; permissionKeys?: Set<string> }, acceptedKeys: string[]) {
  if (access.canManageClasses) return;
  const hasFeature = acceptedKeys.some((key) => access.permissionKeys?.has(key));
  if (!hasFeature) throw httpError(403, 'User does not have teacher workspace feature permission in current tenant');
}

function parsePositiveInt(value: unknown): number | null {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
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

function mapEnrollmentRow(row: any) {
  const learner = row?.learner
    ? {
        id: row.learner.id,
        code: row.learner.code || '',
        username: row.learner.user?.username || '',
        email: row.learner.email || row.learner.user?.email || '',
        phone: row.learner.phone || row.learner.user?.phone || '',
        fullName: row.learner.fullName || row.learner.user?.fullName || '',
        user: row.learner.user ? mapUserLite(row.learner.user) : null,
      }
    : null;

  return {
    id: row.id,
    learner,
    joinDate: row?.joinDate || null,
    leaveDate: row?.leaveDate || null,
    enrollmentStatus: row?.enrollmentStatus || 'active',
    status: row?.enrollmentStatus || 'active',
    updatedAt: row?.updatedAt || null,
  };
}

function toDateOnly(value: Date) {
  const yyyy = value.getFullYear();
  const mm = String(value.getMonth() + 1).padStart(2, '0');
  const dd = String(value.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
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
  if (!text) return DEFAULT_TEACHER_TIME_ZONE;

  const withoutOffset = text.replace(/^\(GMT[^)]*\)\s*/, '').trim();
  if (withoutOffset && isValidTimeZone(withoutOffset)) return withoutOffset;

  const matched = text.match(/[A-Za-z_]+\/[A-Za-z_]+(?:\/[A-Za-z_]+)*/);
  if (matched?.[0] && isValidTimeZone(matched[0])) return matched[0];

  return DEFAULT_TEACHER_TIME_ZONE;
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

async function getTenantTimeZone(tenantId: number | string) {
  const tenant = await strapi.db.query(TENANT_UID).findOne({
    where: { id: tenantId },
    select: ['id', 'timezone'],
  });

  return normalizeTimeZone(tenant?.timezone);
}

function formatTime(value: unknown) {
  const text = toText(value);
  if (!text) return '';
  const parts = text.split(':');
  return parts.length >= 2 ? `${parts[0]}:${parts[1]}` : text;
}

function buildDateTime(sessionDate: unknown, timeValue: unknown) {
  const dateText = toText(sessionDate);
  const timeText = formatTime(timeValue);
  if (!dateText || !timeText) return null;
  const combined = new Date(`${dateText}T${timeText}:00`);
  if (Number.isNaN(combined.getTime())) return null;
  return combined;
}

function isPastDueSession(session: any, now = new Date(), timeZone = DEFAULT_TEACHER_TIME_ZONE) {
  const status = toText(session?.status).toLowerCase();
  if (status === 'completed' || status === 'cancelled') return false;
  const sessionDate = toText(session?.sessionDate);
  if (!sessionDate) return false;

  const nowParts = getTimeZoneNowParts(now, timeZone);
  const dateComparison = compareSessionDate(sessionDate, nowParts.dateOnly);
  if (dateComparison < 0) return true;
  if (dateComparison > 0) return false;

  const endMinutes = readTimeValueInMinutes(session?.endTime);
  return endMinutes !== null && endMinutes < nowParts.minutes;
}

function isTodaySession(session: any, now = new Date(), timeZone = DEFAULT_TEACHER_TIME_ZONE) {
  return toText(session?.sessionDate) === getTimeZoneNowParts(now, timeZone).dateOnly;
}

function isUpcomingSession(session: any, now = new Date(), timeZone = DEFAULT_TEACHER_TIME_ZONE) {
  const status = toText(session?.status).toLowerCase();
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

function attachTeacherSessionMeta(session: any, now = new Date(), timeZone = DEFAULT_TEACHER_TIME_ZONE) {
  return {
    ...session,
    timing: {
      isToday: isTodaySession(session, now, timeZone),
      isUpcoming: isUpcomingSession(session, now, timeZone),
      needsReport: isPastDueSession(session, now, timeZone),
    },
  };
}

async function countActiveLearnersForClass(classId: number, tenantId: number | string, today: string) {
  const rows = await strapi.db.query(ENROLLMENT_UID).findMany({
    where: mergeTenantWhere({
      class: { id: { $eq: classId } },
      enrollmentStatus: 'active',
      $and: [
        {
          $or: [
            { joinDate: null },
            { joinDate: { $lte: today } },
          ],
        },
        {
          $or: [
            { leaveDate: null },
            { leaveDate: { $gte: today } },
          ],
        },
      ],
    }, tenantId),
    select: ['id'],
  });

  return (rows || []).length;
}

async function findTeacherNextSession(classId: number, tenantId: number | string, userId: number, now = new Date()) {
  const rows = await strapi.db.query(CLASS_SESSION_UID).findMany({
    where: mergeTenantWhere({
      class: { id: { $eq: classId } },
      teacher: { id: { $eq: userId } },
      status: { $ne: 'cancelled' },
    }, tenantId),
    orderBy: [{ sessionDate: 'asc' }, { startTime: 'asc' }, { id: 'asc' }],
    populate: {
      class: { select: ['id', 'name', 'subjectCode', 'subject'] },
      teacher: { select: ['id', 'username', 'email', 'fullName'] },
      completedBy: { select: ['id', 'username', 'email', 'fullName'] },
    },
  });

  return (rows || []).find((item: any) => {
    const endAt = buildDateTime(item?.sessionDate, item?.endTime || item?.startTime);
    return endAt ? endAt.getTime() >= now.getTime() : false;
  }) || null;
}

async function listTeacherOwnedSessionsForClass(classId: number, tenantId: number | string, userId: number) {
  return strapi.db.query(CLASS_SESSION_UID).findMany({
    where: mergeTenantWhere({
      class: { id: { $eq: classId } },
      teacher: { id: { $eq: userId } },
    }, tenantId),
    orderBy: [{ sessionDate: 'desc' }, { startTime: 'desc' }, { id: 'desc' }],
    select: ['id', 'sessionDate', 'startTime', 'endTime', 'status'],
  });
}

async function buildTeacherClassRow(classEntity: any, access: { userId: number; canManageClasses: boolean }, tenantId: number | string, now = new Date(), timeZone = DEFAULT_TEACHER_TIME_ZONE) {
  const accessState = await getTeacherClassAccessState(classEntity, access, tenantId);
  if (!accessState.canView) throw httpError(404, 'Class not found');

  const today = toDateOnly(now);
  const [activeLearnersCount, nextSessionRaw, teacherSessions] = await Promise.all([
    countActiveLearnersForClass(Number(classEntity.id), tenantId, today),
    findTeacherNextSession(Number(classEntity.id), tenantId, access.userId, now),
    listTeacherOwnedSessionsForClass(Number(classEntity.id), tenantId, access.userId),
  ]);

  const pendingReportCount = (teacherSessions || []).filter((item: any) => isPastDueSession(item, now, timeZone)).length;
  const nextSession = nextSessionRaw
    ? attachTeacherSessionMeta({
        id: nextSessionRaw.id,
        class: classEntity ? { id: classEntity.id, name: classEntity.name || '', subjectCode: classEntity.subjectCode || '', subject: classEntity.subject || '' } : null,
        sessionDate: nextSessionRaw.sessionDate || null,
        startTime: nextSessionRaw.startTime || null,
        endTime: nextSessionRaw.endTime || null,
        teacher: mapUserLite(nextSessionRaw.teacher),
        status: nextSessionRaw.status || 'scheduled',
        attendanceSummary: { eligibleCount: 0, markedCount: 0, hasAttendance: false, label: null },
        reportSummary: { hasAttendance: false, hasReport: false, isCompleted: nextSessionRaw.status === 'completed', needsAttention: false },
        permissions: { canManage: false, canTeach: true, canEditSchedule: false, canCancel: false, canMarkAttendance: true, canEditReport: true, canComplete: true },
      }, now, timeZone)
    : null;

  return {
    id: classEntity.id,
    name: classEntity.name || '',
    subjectCode: classEntity.subjectCode || '',
    subject: classEntity.subject || '',
    status: classEntity.classStatus || classEntity.status || 'active',
    mainTeacher: mapUserLite(classEntity.mainTeacher),
    roleLabels: accessState.roleLabels,
    activeLearnersCount,
    nextSession,
    pendingReportCount,
  };
}

export async function listTeacherClasses(query: Record<string, unknown>, tenantId: number | string, authUser: any) {
  const access = await getSessionAccessContext(tenantId, authUser);
  ensureTeacherFeature(access, ['class.teacher-workspace', 'class.teacher-sessions']);
  const timeZone = await getTenantTimeZone(tenantId);
  const accessibleClassIds = await getTeacherAccessibleClassIds(tenantId, access.userId);
  if (accessibleClassIds.length === 0) return [];

  const keyword = toText(query?.q);
  const clauses: Record<string, unknown>[] = [{ id: { $in: accessibleClassIds } }];
  if (keyword) {
    clauses.push({
      $or: [
        { name: { $containsi: keyword } },
        { subjectCode: { $containsi: keyword } },
        { subject: { $containsi: keyword } },
      ],
    });
  }

  const classRows = await strapi.db.query(CLASS_UID).findMany({
    where: mergeTenantWhere({ $and: clauses }, tenantId),
    orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
    populate: {
      mainTeacher: { select: ['id', 'username', 'email', 'fullName'] },
    },
  });

  const results = [];
  for (const row of classRows || []) {
    results.push(await buildTeacherClassRow(row, access, tenantId, new Date(), timeZone));
  }
  return results;
}

export async function getTeacherClassDetail(classRef: unknown, tenantId: number | string, authUser: any) {
  const access = await getSessionAccessContext(tenantId, authUser);
  ensureTeacherFeature(access, ['class.teacher-workspace', 'class.teacher-sessions']);
  const timeZone = await getTenantTimeZone(tenantId);
  const classEntity = await findClassForSessionOrThrow(classRef, tenantId);
  const accessState = await getTeacherClassAccessState(classEntity, access, tenantId);
  if (!accessState.canView) throw httpError(404, 'Class not found');

  const classRow = await buildTeacherClassRow(classEntity, access, tenantId, new Date(), timeZone);
  const learners = await strapi.db.query(ENROLLMENT_UID).findMany({
    where: mergeTenantWhere({
      class: { id: { $eq: Number(classEntity.id) } },
    }, tenantId),
    orderBy: [{ joinDate: 'asc' }, { id: 'asc' }],
    populate: {
      learner: {
        select: ['id', 'code', 'fullName', 'email', 'phone'],
        populate: {
          user: { select: ['id', 'username', 'email', 'phone', 'fullName'] },
        },
      },
    },
  });

  return {
    ...classRow,
    learners: (learners || []).map(mapEnrollmentRow),
    permissions: {
      canView: true,
      canEditClass: false,
      canEditEnrollments: false,
      canEditAssignments: false,
      canCreateSessions: false,
      canBulkCreateSessions: false,
    },
  };
}

export async function listTeacherClassSessions(classRef: unknown, tenantId: number | string, authUser: any) {
  const access = await getSessionAccessContext(tenantId, authUser);
  ensureTeacherFeature(access, ['class.teacher-workspace', 'class.teacher-sessions']);
  const timeZone = await getTenantTimeZone(tenantId);
  const classEntity = await findClassForSessionOrThrow(classRef, tenantId);
  const accessState = await getTeacherClassAccessState(classEntity, access, tenantId);
  if (!accessState.canView) throw httpError(404, 'Class not found');

  const sessions = await listClassSessions(classEntity, access, tenantId, {
    mode: 'teacher',
    includeAllVisibleSessions: true,
  });

  return sessions.map((item) => attachTeacherSessionMeta(item, new Date(), timeZone));
}

export async function listTeacherSessions(query: Record<string, unknown>, tenantId: number | string, authUser: any) {
  const access = await getSessionAccessContext(tenantId, authUser);
  ensureTeacherFeature(access, ['class.teacher-sessions', 'class.teacher-workspace']);
  const timeZone = await getTenantTimeZone(tenantId);
  const clauses: Record<string, unknown>[] = [{ teacher: { id: { $eq: access.userId } } }];
  const classId = parsePositiveInt(query?.classId);
  const fromDate = toText(query?.fromDate || query?.from);
  const toDate = toText(query?.toDate || query?.to);
  const status = toText(query?.status).toLowerCase();

  if (classId) clauses.push({ class: { id: { $eq: classId } } });
  if (fromDate) clauses.push({ sessionDate: { $gte: fromDate } });
  if (toDate) clauses.push({ sessionDate: { $lte: toDate } });
  if (status === 'scheduled' || status === 'in_progress' || status === 'completed' || status === 'cancelled') {
    clauses.push({ status });
  }

  const rawRows = await strapi.db.query(CLASS_SESSION_UID).findMany({
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

  const classIds = Array.from(new Set((rawRows || []).map((item: any) => Number(item?.class?.id || 0)).filter((value) => value > 0)));
  const sessionIds = new Set((rawRows || []).map((item: any) => Number(item?.id || 0)).filter((value) => value > 0));
  const classEntities = await Promise.all(classIds.map((id) => findClassForSessionOrThrow(id, tenantId)));
  const sessionsByClass = await Promise.all(classEntities.map((classEntity) => listClassSessions(classEntity, access, tenantId, { mode: 'teacher' })));
  const sessions = sessionsByClass.flat().filter((item) => sessionIds.has(Number(item?.id || 0))).map((item) => attachTeacherSessionMeta(item, new Date(), timeZone));

  if (status === 'pending_report') {
    return sessions.filter((item) => item?.timing?.needsReport === true);
  }

  return sessions;
}

export async function getTeacherSessionDetail(sessionRef: unknown, tenantId: number | string, authUser: any) {
  const access = await getSessionAccessContext(tenantId, authUser);
  ensureTeacherFeature(access, ['class.teacher-sessions', 'class.teacher-workspace']);
  const timeZone = await getTenantTimeZone(tenantId);
  const session = await findClassSessionOrThrow(sessionRef, tenantId);
  const detail = await getClassSessionDetail(session, access, tenantId, { mode: 'teacher' });
  if (!(detail?.permissions?.canTeach || detail?.permissions?.canEditReport || detail?.permissions?.canMarkAttendance || detail?.permissions?.canComplete || detail?.class)) {
    throw httpError(404, 'Class session not found');
  }
  const accessMode = detail?.permissions?.canMarkAttendance || detail?.permissions?.canEditReport || detail?.permissions?.canComplete
    ? 'operate'
    : 'read_only';
  return attachTeacherSessionMeta({
    ...detail,
    accessMode,
    accessReason: accessMode === 'operate'
      ? 'Bạn là giáo viên phụ trách trực tiếp của buổi học này.'
      : 'Bạn có thể xem buổi học này vì đang phụ trách lớp, nhưng chỉ giáo viên được gán trực tiếp trên buổi học mới được điểm danh và hoàn thành báo cáo.',
  }, new Date(), timeZone);
}

export async function saveTeacherSessionAttendance(sessionRef: unknown, payload: Record<string, unknown>, tenantId: number | string, authUser: any) {
  const access = await getSessionAccessContext(tenantId, authUser);
  ensureTeacherFeature(access, ['class.teacher-sessions', 'class.teacher-workspace']);
  const timeZone = await getTenantTimeZone(tenantId);
  const session = await findClassSessionOrThrow(sessionRef, tenantId);
  if (!isSessionAssignedTeacher(session, access.userId)) throw httpError(403, 'Only the assigned teacher of this class session can mark attendance');
  return attachTeacherSessionMeta(await saveClassSessionAttendance(session, payload, access, tenantId, { mode: 'teacher' }), new Date(), timeZone);
}

export async function saveTeacherSessionReport(sessionRef: unknown, payload: Record<string, unknown>, tenantId: number | string, authUser: any) {
  const access = await getSessionAccessContext(tenantId, authUser);
  ensureTeacherFeature(access, ['class.teacher-sessions', 'class.teacher-workspace']);
  const timeZone = await getTenantTimeZone(tenantId);
  const session = await findClassSessionOrThrow(sessionRef, tenantId);
  if (!isSessionAssignedTeacher(session, access.userId)) throw httpError(403, 'Only the assigned teacher of this class session can update the lesson report');
  return attachTeacherSessionMeta(await updateClassSessionReport(session, payload, access, tenantId, { mode: 'teacher' }), new Date(), timeZone);
}

export async function completeTeacherSession(sessionRef: unknown, payload: Record<string, unknown>, tenantId: number | string, authUser: any) {
  const access = await getSessionAccessContext(tenantId, authUser);
  ensureTeacherFeature(access, ['class.teacher-sessions', 'class.teacher-workspace']);
  const timeZone = await getTenantTimeZone(tenantId);
  const session = await findClassSessionOrThrow(sessionRef, tenantId);
  if (!isSessionAssignedTeacher(session, access.userId)) throw httpError(403, 'Only the assigned teacher of this class session can complete the session report');
  return attachTeacherSessionMeta(await completeClassSession(session, payload, access, tenantId, { mode: 'teacher' }), new Date(), timeZone);
}

export function getTeacherWorkspaceErrorStatus(error: any, fallback = 400) {
  const status = Number(error?.status || error?.statusCode || 0);
  if (Number.isInteger(status) && status > 0) return status;
  const message = String(error?.message || '').toLowerCase();
  if (message.includes('not found')) return 404;
  return fallback;
}