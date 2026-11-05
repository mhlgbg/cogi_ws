import { mergeTenantWhere, toText } from '../../../utils/tenant-scope';

const CLASS_SESSION_UID = 'api::class-session.class-session';
const CLASS_SESSION_ATTENDANCE_UID = 'api::class-session-attendance.class-session-attendance';
const ASSIGNMENT_UID = 'api::assignment.assignment';
const ASSIGNMENT_TASK_UID = 'api::assignment-task.assignment-task';
const ASSIGNMENT_PROGRESS_UID = 'api::assignment-task-learner-progress.assignment-task-learner-progress';

type ReconcileParams = {
  enrollmentId?: number | string | null;
  classId: number;
  learnerId: number;
  tenantId: number | string;
  joinedAt?: string | null;
  transacting?: any;
};

export type EnrollmentReconcileSummary = {
  attendanceAdded: number;
  attendanceExisting: number;
  assignmentsAdded: number;
  assignmentsExisting: number;
  taskProgressAdded: number;
  taskProgressExisting: number;
};

const EMPTY_SUMMARY: EnrollmentReconcileSummary = {
  attendanceAdded: 0,
  attendanceExisting: 0,
  assignmentsAdded: 0,
  assignmentsExisting: 0,
  taskProgressAdded: 0,
  taskProgressExisting: 0,
};

function normalizeJoinedDate(value: unknown) {
  const text = toText(value);
  if (!text) return null;
  const date = new Date(text);
  if (Number.isNaN(date.getTime())) {
    throw new Error('joinedAt is invalid');
  }
  return date.toISOString().slice(0, 10);
}

function readDateTimeMs(value: unknown) {
  const text = toText(value);
  if (!text) return null;
  const date = new Date(text);
  const ms = date.getTime();
  return Number.isNaN(ms) ? null : ms;
}

function isUniqueConflict(error: any) {
  const code = String(error?.code || '').toLowerCase();
  const message = String(error?.message || '').toLowerCase();
  if (code === '23505' || code === 'er_dup_entry' || code.includes('sqlite_constraint')) return true;
  return message.includes('unique') || message.includes('duplicate');
}

function toPositiveNumber(value: unknown) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

async function createAttendanceIfMissing(
  classSessionId: number,
  learnerId: number,
  tenantId: number | string,
  summary: EnrollmentReconcileSummary,
  transacting?: any,
) {
  const existing = await strapi.db.query(CLASS_SESSION_ATTENDANCE_UID).findOne({
    where: mergeTenantWhere({
      classSession: { id: { $eq: classSessionId } },
      learner: { id: { $eq: learnerId } },
    }, tenantId),
    select: ['id'],
    ...(transacting ? { transacting } : {}),
  } as any);

  if (existing?.id) {
    summary.attendanceExisting += 1;
    return;
  }

  try {
    await strapi.db.query(CLASS_SESSION_ATTENDANCE_UID).create({
      data: {
        classSession: classSessionId,
        learner: learnerId,
        status: 'not_marked',
        note: null,
        markedAt: null,
        markedBy: null,
        tenant: tenantId,
      },
      ...(transacting ? { transacting } : {}),
    } as any);
    summary.attendanceAdded += 1;
  } catch (error: any) {
    if (isUniqueConflict(error)) {
      summary.attendanceExisting += 1;
      return;
    }
    throw error;
  }
}

async function createTaskProgressIfMissing(
  assignmentTaskId: number,
  learnerId: number,
  tenantId: number | string,
  summary: EnrollmentReconcileSummary,
  transacting?: any,
) {
  const existing = await strapi.db.query(ASSIGNMENT_PROGRESS_UID).findOne({
    where: mergeTenantWhere({
      assignmentTask: { id: { $eq: assignmentTaskId } },
      learner: { id: { $eq: learnerId } },
    }, tenantId),
    select: ['id'],
    ...(transacting ? { transacting } : {}),
  } as any);

  if (existing?.id) {
    summary.taskProgressExisting += 1;
    return false;
  }

  try {
    await strapi.db.query(ASSIGNMENT_PROGRESS_UID).create({
      data: {
        assignmentTask: assignmentTaskId,
        learner: learnerId,
        status: 'assigned',
        tenant: tenantId,
      },
      ...(transacting ? { transacting } : {}),
    } as any);
    summary.taskProgressAdded += 1;
    return true;
  } catch (error: any) {
    if (isUniqueConflict(error)) {
      summary.taskProgressExisting += 1;
      return false;
    }
    throw error;
  }
}

function isAssignmentEligibleByJoinedAt(assignment: any, joinedDate: string | null) {
  if (!joinedDate) return true;
  const joinedMs = readDateTimeMs(`${joinedDate}T00:00:00.000Z`);
  if (!joinedMs) return true;

  const effectiveMs = readDateTimeMs(assignment?.assignedAt) ?? readDateTimeMs(assignment?.createdAt);
  if (!effectiveMs) return true;
  return effectiveMs >= joinedMs;
}

export async function reconcileLearnerEnrollment(params: ReconcileParams): Promise<EnrollmentReconcileSummary> {
  const classId = toPositiveNumber(params.classId);
  const learnerId = toPositiveNumber(params.learnerId);
  if (!classId || !learnerId) {
    throw new Error('classId and learnerId are required');
  }

  const joinedDate = normalizeJoinedDate(params.joinedAt);
  const summary: EnrollmentReconcileSummary = { ...EMPTY_SUMMARY };
  const transacting = params.transacting;

  strapi.log.info('[enrollment-reconcile] starting', {
    enrollmentId: params.enrollmentId || null,
    classId,
    learnerId,
    tenantId: params.tenantId,
    joinedAt: joinedDate,
  });

  const sessionRows = await strapi.db.query(CLASS_SESSION_UID).findMany({
    where: mergeTenantWhere({
      class: { id: { $eq: classId } },
      ...(joinedDate ? { sessionDate: { $gte: joinedDate } } : {}),
    }, params.tenantId),
    select: ['id', 'sessionDate'],
    orderBy: [{ sessionDate: 'asc' }, { id: 'asc' }],
    ...(transacting ? { transacting } : {}),
  } as any);

  for (const session of sessionRows || []) {
    const sessionId = toPositiveNumber(session?.id);
    if (!sessionId) continue;
    await createAttendanceIfMissing(sessionId, learnerId, params.tenantId, summary, transacting);
  }

  const assignmentRows = await strapi.db.query(ASSIGNMENT_UID).findMany({
    where: mergeTenantWhere({
      class: { id: { $eq: classId } },
      status: { $in: ['published', 'closed'] },
    }, params.tenantId),
    select: ['id', 'status', 'assignedAt', 'createdAt'],
    orderBy: [{ assignedAt: 'asc' }, { id: 'asc' }],
    ...(transacting ? { transacting } : {}),
  } as any);

  const eligibleAssignments = (assignmentRows || []).filter((row: any) => isAssignmentEligibleByJoinedAt(row, joinedDate));
  const assignmentIds = eligibleAssignments.map((row: any) => toPositiveNumber(row?.id)).filter(Boolean) as number[];

  const taskRows = assignmentIds.length > 0
    ? await strapi.db.query(ASSIGNMENT_TASK_UID).findMany({
        where: mergeTenantWhere({
          assignment: { id: { $in: assignmentIds } },
        }, params.tenantId),
        select: ['id'],
        populate: {
          assignment: {
            select: ['id'],
          },
        },
        orderBy: [{ id: 'asc' }],
        ...(transacting ? { transacting } : {}),
      } as any)
    : [];

  const taskIds = (taskRows || []).map((row: any) => toPositiveNumber(row?.id)).filter(Boolean) as number[];
  const existingProgressRows = taskIds.length > 0
    ? await strapi.db.query(ASSIGNMENT_PROGRESS_UID).findMany({
        where: mergeTenantWhere({
          assignmentTask: { id: { $in: taskIds } },
          learner: { id: { $eq: learnerId } },
        }, params.tenantId),
        select: ['id'],
        populate: {
          assignmentTask: {
            select: ['id'],
          },
        },
        ...(transacting ? { transacting } : {}),
      } as any)
    : [];

  const existingTaskIds = new Set<number>();
  for (const row of existingProgressRows || []) {
    const taskId = toPositiveNumber(row?.assignmentTask?.id || row?.assignmentTask);
    if (taskId) existingTaskIds.add(taskId);
  }

  const taskIdsByAssignmentId = new Map<number, number[]>();
  for (const task of taskRows || []) {
    const taskId = toPositiveNumber(task?.id);
    const assignmentId = toPositiveNumber(task?.assignment?.id || task?.assignment);
    if (!taskId || !assignmentId) continue;
    if (!taskIdsByAssignmentId.has(assignmentId)) taskIdsByAssignmentId.set(assignmentId, []);
    taskIdsByAssignmentId.get(assignmentId)?.push(taskId);
  }

  for (const assignment of eligibleAssignments || []) {
    const assignmentId = toPositiveNumber(assignment?.id);
    if (!assignmentId) continue;
    const assignmentTaskIds = taskIdsByAssignmentId.get(assignmentId) || [];
    if (assignmentTaskIds.length === 0) {
      summary.assignmentsExisting += 1;
      continue;
    }

    let assignmentAdded = false;
    for (const taskId of assignmentTaskIds) {
      if (existingTaskIds.has(taskId)) {
        summary.taskProgressExisting += 1;
        continue;
      }
      const created = await createTaskProgressIfMissing(taskId, learnerId, params.tenantId, summary, transacting);
      if (created) {
        assignmentAdded = true;
        existingTaskIds.add(taskId);
      } else if (!created) {
        existingTaskIds.add(taskId);
      }
    }

    if (assignmentAdded) {
      summary.assignmentsAdded += 1;
    } else {
      summary.assignmentsExisting += 1;
    }
  }

  strapi.log.info('[enrollment-reconcile] completed', {
    enrollmentId: params.enrollmentId || null,
    classId,
    learnerId,
    tenantId: params.tenantId,
    joinedAt: joinedDate,
    summary,
  });

  return summary;
}
