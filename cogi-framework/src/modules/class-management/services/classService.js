import api from '../../../api/axios'

function toText(value) {
  if (value === null || value === undefined) return ''
  return String(value).trim()
}

function normalizeEntity(raw) {
  if (!raw || typeof raw !== 'object') return null

  if (raw.attributes && typeof raw.attributes === 'object') {
    return {
      id: raw.id,
      ...raw.attributes,
      documentId: raw.attributes.documentId || raw.documentId || '',
    }
  }

  return raw
}

function normalizeRelation(raw) {
  if (!raw) return null
  if (Array.isArray(raw)) {
    return raw.map(normalizeRelation).filter(Boolean)
  }
  if (raw.data !== undefined) {
    return normalizeRelation(raw.data)
  }
  return normalizeEntity(raw)
}

function readClassStatus(entity) {
  return toText(entity?.classStatus || entity?.status) || 'active'
}

function readEnrollmentStatus(entity) {
  return toText(entity?.enrollmentStatus || entity?.status) || 'active'
}

function normalizeClass(raw) {
  const entity = normalizeEntity(raw)
  if (!entity) return null

  return {
    id: entity.id,
    documentId: toText(entity.documentId),
    name: toText(entity.name),
    subjectCode: toText(entity.subjectCode),
    subject: toText(entity.subject),
    classStatus: readClassStatus(entity),
    status: readClassStatus(entity),
    mainTeacher: normalizeRelation(entity.mainTeacher),
    updatedAt: entity.updatedAt || null,
    createdAt: entity.createdAt || null,
  }
}

function normalizeEnrollment(raw) {
  if (!raw || typeof raw !== 'object') return null

  const learner = raw.learner || raw.student || null

  return {
    id: raw.id,
    learner: learner
      ? {
          id: learner.id,
          code: toText(learner.code),
          username: toText(learner.username),
          email: toText(learner.email),
          phone: toText(learner.phone),
          fullName: toText(learner.fullName),
        }
      : null,
    joinDate: raw.joinDate || null,
    leaveDate: raw.leaveDate || null,
    enrollmentStatus: readEnrollmentStatus(raw),
    status: readEnrollmentStatus(raw),
    updatedAt: raw.updatedAt || null,
  }
}

function normalizeUserLite(raw) {
  if (!raw || typeof raw !== 'object') return null
  return {
    id: raw.id,
    username: toText(raw.username),
    email: toText(raw.email),
    fullName: toText(raw.fullName),
  }
}

function normalizeLearnerLite(raw) {
  if (!raw || typeof raw !== 'object') return null
  return {
    id: raw.id,
    code: toText(raw.code),
    username: toText(raw.username || raw.user?.username),
    email: toText(raw.email || raw.user?.email),
    phone: toText(raw.phone || raw.user?.phone),
    fullName: toText(raw.fullName || raw.user?.fullName),
    user: normalizeUserLite(raw.user),
  }
}

function normalizeAttendance(raw) {
  if (!raw || typeof raw !== 'object') return null
  return {
    id: raw.id,
    learner: normalizeLearnerLite(raw.learner),
    status: toText(raw.status) || 'present',
    note: toText(raw.note),
    markedAt: raw.markedAt || null,
    markedBy: normalizeUserLite(raw.markedBy),
  }
}

function normalizeStudentContext(raw) {
  if (!raw || typeof raw !== 'object') return null
  return {
    user: normalizeUserLite(raw.user),
    tenant: raw.tenant ? {
      id: Number(raw.tenant.id || 0) || 0,
      code: toText(raw.tenant.code),
      name: toText(raw.tenant.name),
      timezone: toText(raw.tenant.timezone),
    } : null,
    learners: Array.isArray(raw.learners) ? raw.learners.map((item) => ({
      id: Number(item?.id || 0) || 0,
      code: toText(item?.code),
      fullName: toText(item?.fullName),
      learnerStatus: toText(item?.learnerStatus) || 'active',
    })).filter((item) => item.id > 0) : [],
    learnerContext: raw.learnerContext ? {
      id: Number(raw.learnerContext.id || 0) || 0,
      code: toText(raw.learnerContext.code),
      fullName: toText(raw.learnerContext.fullName),
      learnerStatus: toText(raw.learnerContext.learnerStatus) || 'active',
    } : null,
    learnerState: toText(raw.learnerState) || 'missing',
    requiresLearnerSelection: raw.requiresLearnerSelection === true,
  }
}

function normalizeEnrollmentContext(raw) {
  if (!raw || typeof raw !== 'object') return null
  return {
    enrollmentStatus: toText(raw.enrollmentStatus) || 'active',
    joinDate: raw.joinDate || null,
    leaveDate: raw.leaveDate || null,
    isCurrent: raw.isCurrent === true,
    totalEnrollments: Number(raw.totalEnrollments || 0) || 0,
  }
}

function normalizeAssignmentSubmissionItem(raw) {
  if (!raw || typeof raw !== 'object') return null
  return {
    id: Number(raw.id || 0) || 0,
    type: toText(raw.type) || 'file',
    order: Number(raw.order || 0) || 0,
    caption: toText(raw.caption),
    contentHtml: toText(raw.contentHtml),
    url: toText(raw.url),
    fileAsset: normalizeRelation(raw.fileAsset),
  }
}

function normalizeAssignmentSubmission(raw) {
  if (!raw || typeof raw !== 'object') return null
  return {
    id: Number(raw.id || 0) || 0,
    version: Number(raw.version || 1) || 1,
    status: toText(raw.status) || 'draft',
    comment: toText(raw.comment),
    submittedAt: raw.submittedAt || null,
    createdBy: normalizeUserLite(raw.createdBy),
    items: Array.isArray(raw.items) ? raw.items.map(normalizeAssignmentSubmissionItem).filter(Boolean) : [],
  }
}

function normalizeAssignmentProgress(raw) {
  if (!raw || typeof raw !== 'object') return null
  return {
    id: Number(raw.id || 0) || 0,
    status: toText(raw.status) || 'assigned',
    startedAt: raw.startedAt || null,
    submittedAt: raw.submittedAt || null,
    completedAt: raw.completedAt || null,
    score: raw.score === null || raw.score === undefined || raw.score === '' ? null : Number(raw.score),
    maxScore: raw.maxScore === null || raw.maxScore === undefined || raw.maxScore === '' ? null : Number(raw.maxScore),
    teacherFeedback: toText(raw.teacherFeedback),
    reviewedBy: normalizeUserLite(raw.reviewedBy),
    reviewedAt: raw.reviewedAt || null,
    learner: normalizeLearnerLite(raw.learner),
  }
}

function normalizeAssignmentTask(raw) {
  if (!raw || typeof raw !== 'object') return null
  return {
    id: Number(raw.id || 0) || 0,
    title: toText(raw.title),
    description: toText(raw.description),
    order: Number(raw.order || 0) || 0,
    required: raw.required !== false,
    taskType: toText(raw.taskType) || 'todo',
    assessment: raw.assessment ? {
      id: Number(raw.assessment.id || 0) || 0,
      documentId: toText(raw.assessment.documentId) || null,
      title: toText(raw.assessment.title),
    } : null,
    stats: raw.stats || { learnerCount: 0, submittedCount: 0, completedCount: 0, returnedCount: 0, missingCount: 0, submissionVersionCount: 0 },
    myProgress: normalizeAssignmentProgress(raw.myProgress),
    submissions: Array.isArray(raw.submissions) ? raw.submissions.map(normalizeAssignmentSubmission).filter(Boolean) : [],
  }
}

function normalizeAssignmentSummary(raw) {
  if (!raw || typeof raw !== 'object') return null
  return {
    id: Number(raw.id || 0) || 0,
    class: raw.class ? { id: Number(raw.class.id || 0) || 0, name: toText(raw.class.name), subjectCode: toText(raw.class.subjectCode), subject: toText(raw.class.subject) } : null,
    classSession: raw.classSession ? { id: Number(raw.classSession.id || 0) || 0, sessionDate: raw.classSession.sessionDate || null, startTime: raw.classSession.startTime || null, endTime: raw.classSession.endTime || null, status: toText(raw.classSession.status) || 'scheduled' } : null,
    title: toText(raw.title),
    description: toText(raw.description),
    dueAt: raw.dueAt || null,
    assignedAt: raw.assignedAt || null,
    assignedBy: normalizeUserLite(raw.assignedBy),
    status: toText(raw.status) || 'draft',
    note: toText(raw.note),
    taskCount: Number(raw.taskCount || 0) || 0,
    learnerCount: Number(raw.learnerCount || 0) || 0,
    completedCount: Number(raw.completedCount || 0) || 0,
    submittedCount: Number(raw.submittedCount || 0) || 0,
    pendingCount: Number(raw.pendingCount || 0) || 0,
    totalTaskCount: Number(raw.totalTaskCount || 0) || 0,
    completedTaskCount: Number(raw.completedTaskCount || 0) || 0,
    myProgressState: toText(raw.myProgressState) || '',
    tasks: Array.isArray(raw.tasks) ? raw.tasks.map(normalizeAssignmentTask).filter(Boolean) : [],
    learners: Array.isArray(raw.learners) ? raw.learners.map((item) => ({
      learner: normalizeLearnerLite(item.learner),
      tasks: Array.isArray(item.tasks) ? item.tasks.map((task) => ({
        taskId: Number(task?.taskId || 0) || 0,
        status: toText(task?.status) || 'assigned',
        score: task?.score === null || task?.score === undefined || task?.score === '' ? null : Number(task.score),
        maxScore: task?.maxScore === null || task?.maxScore === undefined || task?.maxScore === '' ? null : Number(task.maxScore),
        teacherFeedback: toText(task?.teacherFeedback),
        submissionCount: Number(task?.submissionCount || 0) || 0,
        latestSubmission: normalizeAssignmentSubmission(task?.latestSubmission),
      })) : [],
      completedCount: Number(item.completedCount || 0) || 0,
      submittedCount: Number(item.submittedCount || 0) || 0,
    })) : [],
    learner: normalizeLearnerLite(raw.learner),
    progress: normalizeAssignmentProgress(raw.progress),
    submissions: Array.isArray(raw.submissions) ? raw.submissions.map(normalizeAssignmentSubmission).filter(Boolean) : [],
    task: normalizeAssignmentTask(raw.task),
  }
}

function normalizeClassSession(raw) {
  if (!raw || typeof raw !== 'object') return null

  return {
    id: raw.id,
    class: raw.class ? { id: raw.class.id, name: toText(raw.class.name), subjectCode: toText(raw.class.subjectCode), subject: toText(raw.class.subject), mainTeacher: normalizeUserLite(raw.class.mainTeacher) } : null,
    sessionDate: raw.sessionDate || null,
    startTime: raw.startTime || null,
    endTime: raw.endTime || null,
    teacher: normalizeUserLite(raw.teacher),
    room: toText(raw.room),
    location: toText(raw.location),
    title: toText(raw.title),
    note: toText(raw.note),
    status: toText(raw.status) || 'scheduled',
    cancelReason: toText(raw.cancelReason),
    lessonContent: toText(raw.lessonContent),
    homework: toText(raw.homework),
    teacherComment: toText(raw.teacherComment),
    completedAt: raw.completedAt || null,
    completedBy: normalizeUserLite(raw.completedBy),
    timing: raw.timing && typeof raw.timing === 'object'
      ? {
          isToday: raw.timing.isToday === true,
          isUpcoming: raw.timing.isUpcoming === true,
          needsReport: raw.timing.needsReport === true,
          isPast: raw.timing.isPast === true,
        }
      : { isToday: false, isUpcoming: false, needsReport: false, isPast: false },
    myAttendance: raw.myAttendance ? {
      id: Number(raw.myAttendance.id || 0) || 0,
      status: toText(raw.myAttendance.status) || 'present',
      note: toText(raw.myAttendance.note),
      markedAt: raw.myAttendance.markedAt || null,
      markedBy: normalizeUserLite(raw.myAttendance.markedBy),
    } : null,
    attendanceSummary: raw.attendanceSummary || { eligibleCount: 0, markedCount: 0, hasAttendance: false, label: null },
    reportSummary: raw.reportSummary || { hasAttendance: false, hasReport: false, isCompleted: false, needsAttention: false },
    eligibleLearners: Array.isArray(raw.eligibleLearners)
      ? raw.eligibleLearners.map((item) => ({
          enrollmentId: item.enrollmentId || null,
          joinDate: item.joinDate || null,
          leaveDate: item.leaveDate || null,
          enrollmentStatus: toText(item.enrollmentStatus),
          historicalOnly: item.historicalOnly === true,
          learner: normalizeLearnerLite(item.learner),
          attendance: normalizeAttendance(item.attendance),
        }))
      : [],
    attendanceRows: Array.isArray(raw.attendanceRows) ? raw.attendanceRows.map(normalizeAttendance).filter(Boolean) : [],
    accessMode: toText(raw.accessMode),
    accessReason: toText(raw.accessReason),
    permissions: raw.permissions || {
      canManage: false,
      canTeach: false,
      canEditSchedule: false,
      canCancel: false,
      canMarkAttendance: false,
      canEditReport: false,
      canComplete: false,
    },
  }
}

function normalizeStudentClass(raw) {
  if (!raw || typeof raw !== 'object') return null
  return {
    id: Number(raw.id || 0) || 0,
    name: toText(raw.name),
    subjectCode: toText(raw.subjectCode),
    subject: toText(raw.subject),
    status: toText(raw.status) || 'active',
    mainTeacher: normalizeUserLite(raw.mainTeacher),
    enrollmentContext: normalizeEnrollmentContext(raw.enrollmentContext),
    nextSession: normalizeClassSession(raw.nextSession),
    permissions: raw.permissions || {
      canView: false,
      canEditClass: false,
      canEditEnrollments: false,
      canEditAssignments: false,
      canCreateSessions: false,
      canBulkCreateSessions: false,
    },
  }
}

function parseCollection(response) {
  return Array.isArray(response?.data?.data) ? response.data.data : []
}

function parseSingle(response) {
  return response?.data?.data || null
}

function parsePagination(response) {
  return response?.data?.meta?.pagination || {
    page: 1,
    pageSize: 10,
    pageCount: 1,
    total: 0,
  }
}

export async function getClassPage({ page = 1, pageSize = 10, q = '', status = '' } = {}) {
  const normalizedStatus = String(status || '').trim()
  const params = {
    'pagination[page]': page,
    'pagination[pageSize]': pageSize,
    q: String(q || '').trim(),
    classStatus: normalizedStatus,
    status: normalizedStatus,
    'populate[0]': 'mainTeacher',
  }

  const response = await api.get('/classes', { params })
  return {
    rows: parseCollection(response).map(normalizeClass).filter(Boolean),
    pagination: parsePagination(response),
  }
}

export async function getClassFormOptions() {
  const response = await api.get('/classes/form-options')
  const teachers = Array.isArray(response?.data?.data?.teachers) ? response.data.data.teachers : []
  return teachers.map((item) => ({
    id: item.id,
    label: item.label || item.fullName || item.username || item.email || `User #${item.id}`,
    username: toText(item.username),
    email: toText(item.email),
    fullName: toText(item.fullName),
  }))
}

export async function createClass(payload) {
  const data = payload?.status && !payload?.classStatus
    ? { ...payload, classStatus: payload.status }
    : payload

  const response = await api.post('/classes', { data })
  return normalizeClass(parseSingle(response))
}

export async function updateClass(id, payload) {
  const data = payload?.status && !payload?.classStatus
    ? { ...payload, classStatus: payload.status }
    : payload

  const response = await api.put(`/classes/${id}`, { data })
  return normalizeClass(parseSingle(response))
}

export async function deleteClass(id) {
  return api.delete(`/classes/${id}`)
}

export async function getClassById(id) {
  const response = await api.get(`/classes/${id}`)
  return normalizeClass(parseSingle(response))
}

export async function getClassEnrollmentOptions(classId, { includeInactive = false } = {}) {
  const params = {}
  if (includeInactive) params.includeInactive = '1'
  const response = await api.get(`/classes/${classId}/enrollment-options`, { params })
  // Debug: log raw response to help troubleshoot missing learners
  try {
    // eslint-disable-next-line no-console
    console.debug('[debug] getClassEnrollmentOptions response:', response?.data)
  } catch (e) {
    // ignore logging errors
  }

  return {
    learners: Array.isArray(response?.data?.data?.learners)
      ? response.data.data.learners
      : (Array.isArray(response?.data?.data?.students) ? response.data.data.students : []),
    roles: Array.isArray(response?.data?.data?.roles) ? response.data.data.roles : [],
  }
}

export async function getClassEnrollments(classId, { page = 1, pageSize = 10, q = '', status = '' } = {}) {
  const normalizedStatus = String(status || '').trim()
  const response = await api.get(`/classes/${classId}/enrollments`, {
    params: {
      'pagination[page]': page,
      'pagination[pageSize]': pageSize,
      q: String(q || '').trim(),
      enrollmentStatus: normalizedStatus,
      status: normalizedStatus,
    },
  })

  return {
    rows: (Array.isArray(response?.data?.data) ? response.data.data : []).map(normalizeEnrollment).filter(Boolean),
    meta: response?.data?.meta || { page: 1, pageSize: 10, pageCount: 1, total: 0 },
  }
}

export async function createEnrollment(classId, payload) {
  const data = payload?.status && !payload?.enrollmentStatus
    ? { ...payload, enrollmentStatus: payload.status }
    : payload

  const response = await api.post(`/classes/${classId}/enrollments`, { data })
  return normalizeEnrollment(response?.data?.data || null)
}

export async function updateEnrollment(classId, enrollmentId, payload) {
  const data = payload?.status && !payload?.enrollmentStatus
    ? { ...payload, enrollmentStatus: payload.status }
    : payload

  const response = await api.put(`/classes/${classId}/enrollments/${enrollmentId}`, { data })
  return normalizeEnrollment(response?.data?.data || null)
}

export async function deleteEnrollment(classId, enrollmentId) {
  return api.delete(`/classes/${classId}/enrollments/${enrollmentId}`)
}

export async function importClassEnrollments(classId, formData) {
  const response = await api.post(`/classes/${classId}/enrollments/import`, formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  })

  return response?.data?.data || null
}

export async function getClassTeacherAssignments(classId) {
  const response = await api.get(`/classes/${classId}/assignments`)
  const items = Array.isArray(response?.data?.data) ? response.data.data : []

  return items.map((item) => ({
    id: item.id,
    subject: item.subject || '',
    subjectCode: item.subjectCode || '',
    role: item.role || '',
    startDate: item.startDate || null,
    endDate: item.endDate || null,
    assignmentStatus: item.assignmentStatus || 'active',
    isPayable: Boolean(item.isPayable),
    note: item.note || '',
    createdAt: item.createdAt || null,
    updatedAt: item.updatedAt || null,
    teacher: item.teacher || null,
  }))
}

export async function createClassTeacherAssignment(classId, payload) {
  // payload should follow { teacher, subjectCode, subject, role, startDate, endDate, assignmentStatus, isPayable, note }
  const data = payload || {}
  const id = classId || (payload && payload.class)
  if (!id) throw new Error('classId is required')
  const response = await api.post(`/classes/${id}/assignments`, { data })
  // Return created object in a normalized shape similar to getClassTeacherAssignments mapping
  const raw = response?.data?.data || null
  if (!raw) return null

  return {
    id: raw.id,
    subject: raw.subject || '',
    subjectCode: raw.subjectCode || '',
    role: raw.role || '',
    startDate: raw.startDate || null,
    endDate: raw.endDate || null,
    assignmentStatus: raw.assignmentStatus || 'active',
    isPayable: Boolean(raw.isPayable),
    note: raw.note || '',
    createdAt: raw.createdAt || null,
    updatedAt: raw.updatedAt || null,
    teacher: raw.teacher || null,
  }
}

export async function updateClassTeacherAssignment(classId, assignmentId, payload) {
  if (!classId) throw new Error('classId is required')
  if (!assignmentId) throw new Error('assignmentId is required')

  const response = await api.put(`/classes/${classId}/assignments/${assignmentId}`, { data: payload })
  const raw = response?.data?.data || null
  if (!raw) return null

  return {
    id: raw.id,
    subject: raw.subject || '',
    subjectCode: raw.subjectCode || '',
    role: raw.role || '',
    startDate: raw.startDate || null,
    endDate: raw.endDate || null,
    assignmentStatus: raw.assignmentStatus || 'active',
    isPayable: Boolean(raw.isPayable),
    note: raw.note || '',
    createdAt: raw.createdAt || null,
    updatedAt: raw.updatedAt || null,
    teacher: raw.teacher || null,
  }
}

export async function getClassSessions(classId) {
  const response = await api.get(`/classes/${classId}/sessions`)
  const items = Array.isArray(response?.data?.data) ? response.data.data : []
  return items.map(normalizeClassSession).filter(Boolean)
}

export async function createClassSession(classId, payload) {
  const response = await api.post(`/classes/${classId}/sessions`, { data: payload || {} })
  return normalizeClassSession(response?.data?.data || null)
}

export async function createClassSessionsBulk(classId, payload) {
  const response = await api.post(`/classes/${classId}/sessions/bulk`, { data: payload || {} })
  return {
    created: Array.isArray(response?.data?.data?.created) ? response.data.data.created.map(normalizeClassSession).filter(Boolean) : [],
    skipped: Array.isArray(response?.data?.data?.skipped) ? response.data.data.skipped : [],
    summary: response?.data?.data?.summary || { requestedCount: 0, createdCount: 0, skippedCount: 0 },
  }
}

export async function getClassSessionDetail(classId, sessionId) {
  const response = await api.get(`/classes/${classId}/sessions/${sessionId}`)
  return normalizeClassSession(response?.data?.data || null)
}

export async function updateClassSession(classId, sessionId, payload) {
  const response = await api.put(`/classes/${classId}/sessions/${sessionId}`, { data: payload || {} })
  return normalizeClassSession(response?.data?.data || null)
}

export async function cancelClassSession(classId, sessionId, payload) {
  const response = await api.post(`/classes/${classId}/sessions/${sessionId}/cancel`, { data: payload || {} })
  return normalizeClassSession(response?.data?.data || null)
}

export async function saveClassSessionAttendance(classId, sessionId, payload) {
  const response = await api.put(`/classes/${classId}/sessions/${sessionId}/attendance`, { data: payload || {} })
  return normalizeClassSession(response?.data?.data || null)
}

export async function updateClassSessionReport(classId, sessionId, payload) {
  const response = await api.put(`/classes/${classId}/sessions/${sessionId}/report`, { data: payload || {} })
  return normalizeClassSession(response?.data?.data || null)
}

export async function completeClassSession(classId, sessionId, payload) {
  const response = await api.post(`/classes/${classId}/sessions/${sessionId}/complete`, { data: payload || {} })
  return normalizeClassSession(response?.data?.data || null)
}

function normalizeTeacherClass(raw) {
  if (!raw || typeof raw !== 'object') return null
  return {
    id: raw.id,
    name: toText(raw.name),
    subjectCode: toText(raw.subjectCode),
    subject: toText(raw.subject),
    status: toText(raw.status) || 'active',
    mainTeacher: normalizeUserLite(raw.mainTeacher),
    roleLabels: Array.isArray(raw.roleLabels) ? raw.roleLabels : [],
    activeLearnersCount: Number(raw.activeLearnersCount || 0),
    nextSession: normalizeClassSession(raw.nextSession),
    pendingReportCount: Number(raw.pendingReportCount || 0),
    learners: Array.isArray(raw.learners) ? raw.learners.map(normalizeEnrollment).filter(Boolean) : [],
    permissions: raw.permissions || {
      canView: true,
      canEditClass: false,
      canEditEnrollments: false,
      canEditAssignments: false,
      canCreateSessions: false,
      canBulkCreateSessions: false,
    },
  }
}

export async function getTeacherClasses({ q = '' } = {}) {
  const response = await api.get('/teacher/classes', {
    params: {
      q: String(q || '').trim(),
    },
  })
  const items = Array.isArray(response?.data?.data) ? response.data.data : []
  return items.map(normalizeTeacherClass).filter(Boolean)
}

export async function getTeacherClassById(classId) {
  const response = await api.get(`/teacher/classes/${classId}`)
  return normalizeTeacherClass(response?.data?.data || null)
}

export async function getTeacherClassSessions(classId) {
  const response = await api.get(`/teacher/classes/${classId}/sessions`)
  const items = Array.isArray(response?.data?.data) ? response.data.data : []
  return items.map(normalizeClassSession).filter(Boolean)
}

export async function getTeacherSessions({ fromDate = '', toDate = '', classId = '', status = '' } = {}) {
  const response = await api.get('/teacher/sessions', {
    params: {
      fromDate: String(fromDate || '').trim(),
      toDate: String(toDate || '').trim(),
      classId: classId || undefined,
      status: String(status || '').trim(),
    },
  })
  const items = Array.isArray(response?.data?.data) ? response.data.data : []
  return items.map(normalizeClassSession).filter(Boolean)
}

export async function getTeacherSessionDetail(sessionId) {
  const response = await api.get(`/teacher/sessions/${sessionId}`)
  return normalizeClassSession(response?.data?.data || null)
}

export async function saveTeacherSessionAttendance(sessionId, payload) {
  const response = await api.put(`/teacher/sessions/${sessionId}/attendance`, { data: payload || {} })
  return normalizeClassSession(response?.data?.data || null)
}

export async function saveTeacherSessionReport(sessionId, payload) {
  const response = await api.put(`/teacher/sessions/${sessionId}/report`, { data: payload || {} })
  return normalizeClassSession(response?.data?.data || null)
}

export async function completeTeacherSession(sessionId, payload) {
  const response = await api.post(`/teacher/sessions/${sessionId}/complete`, { data: payload || {} })
  return normalizeClassSession(response?.data?.data || null)
}

export async function getStudentContext({ learnerId = '' } = {}) {
  const response = await api.get('/student/context', {
    params: {
      learnerId: learnerId || undefined,
    },
  })
  return normalizeStudentContext(response?.data?.data || null)
}

export async function getStudentClasses({ learnerId = '' } = {}) {
  const response = await api.get('/student/classes', {
    params: {
      learnerId: learnerId || undefined,
    },
  })
  const items = Array.isArray(response?.data?.data) ? response.data.data : []
  return {
    rows: items.map(normalizeStudentClass).filter(Boolean),
    context: normalizeStudentContext(response?.data?.meta?.context || null),
    serverNow: response?.data?.meta?.serverNow || null,
  }
}

export async function getStudentClassById(classId, { learnerId = '' } = {}) {
  const response = await api.get(`/student/classes/${classId}`, {
    params: {
      learnerId: learnerId || undefined,
    },
  })
  return {
    detail: normalizeStudentClass(response?.data?.data || null),
    context: normalizeStudentContext(response?.data?.meta?.context || null),
    serverNow: response?.data?.meta?.serverNow || null,
  }
}

export async function getStudentClassSessions(classId, { learnerId = '', fromDate = '', toDate = '', status = '' } = {}) {
  const response = await api.get(`/student/classes/${classId}/sessions`, {
    params: {
      learnerId: learnerId || undefined,
      fromDate: String(fromDate || '').trim(),
      toDate: String(toDate || '').trim(),
      status: String(status || '').trim(),
    },
  })
  const items = Array.isArray(response?.data?.data) ? response.data.data : []
  return {
    rows: items.map(normalizeClassSession).filter(Boolean),
    context: normalizeStudentContext(response?.data?.meta?.context || null),
    serverNow: response?.data?.meta?.serverNow || null,
  }
}

export async function getStudentSessions({ learnerId = '', fromDate = '', toDate = '', classId = '', status = '' } = {}) {
  const response = await api.get('/student/sessions', {
    params: {
      learnerId: learnerId || undefined,
      fromDate: String(fromDate || '').trim(),
      toDate: String(toDate || '').trim(),
      classId: classId || undefined,
      status: String(status || '').trim(),
    },
  })
  const items = Array.isArray(response?.data?.data) ? response.data.data : []
  return {
    rows: items.map(normalizeClassSession).filter(Boolean),
    context: normalizeStudentContext(response?.data?.meta?.context || null),
    serverNow: response?.data?.meta?.serverNow || null,
  }
}

export async function getStudentSessionDetail(sessionId, { learnerId = '' } = {}) {
  const response = await api.get(`/student/sessions/${sessionId}`, {
    params: {
      learnerId: learnerId || undefined,
    },
  })
  return {
    detail: normalizeClassSession(response?.data?.data || null),
    context: normalizeStudentContext(response?.data?.meta?.context || null),
    serverNow: response?.data?.meta?.serverNow || null,
  }
}

export async function getTeacherSessionAssignments(sessionId) {
  const response = await api.get(`/teacher/sessions/${sessionId}/assignments`)
  const items = Array.isArray(response?.data?.data) ? response.data.data : []
  return items.map(normalizeAssignmentSummary).filter(Boolean)
}

export async function createTeacherSessionAssignment(sessionId, payload) {
  const response = await api.post(`/teacher/sessions/${sessionId}/assignments`, { data: payload || {} })
  return normalizeAssignmentSummary(response?.data?.data || null)
}

export async function getTeacherAssignmentDetail(assignmentId) {
  const response = await api.get(`/teacher/assignments/${assignmentId}`)
  return normalizeAssignmentSummary(response?.data?.data || null)
}

export async function updateTeacherAssignment(assignmentId, payload) {
  const response = await api.put(`/teacher/assignments/${assignmentId}`, { data: payload || {} })
  return normalizeAssignmentSummary(response?.data?.data || null)
}

export async function publishTeacherAssignment(assignmentId) {
  const response = await api.post(`/teacher/assignments/${assignmentId}/publish`)
  return normalizeAssignmentSummary(response?.data?.data || null)
}

export async function closeTeacherAssignment(assignmentId) {
  const response = await api.post(`/teacher/assignments/${assignmentId}/close`)
  return normalizeAssignmentSummary(response?.data?.data || null)
}

export async function cancelTeacherAssignment(assignmentId) {
  const response = await api.post(`/teacher/assignments/${assignmentId}/cancel`)
  return normalizeAssignmentSummary(response?.data?.data || null)
}

export async function getTeacherAssignmentLearnerTaskDetail(assignmentId, taskId, learnerId) {
  const response = await api.get(`/teacher/assignments/${assignmentId}/tasks/${taskId}/learners/${learnerId}`)
  return normalizeAssignmentSummary(response?.data?.data || null)
}

export async function reviewTeacherAssignmentLearnerTask(assignmentId, taskId, learnerId, payload) {
  const response = await api.post(`/teacher/assignments/${assignmentId}/tasks/${taskId}/learners/${learnerId}/review`, { data: payload || {} })
  return normalizeAssignmentSummary(response?.data?.data || null)
}

export async function getStudentSessionAssignments(sessionId, { learnerId = '' } = {}) {
  const response = await api.get(`/student/sessions/${sessionId}/assignments`, {
    params: {
      learnerId: learnerId || undefined,
    },
  })
  const items = Array.isArray(response?.data?.data) ? response.data.data : []
  return items.map(normalizeAssignmentSummary).filter(Boolean)
}

export async function getStudentAssignmentDetail(assignmentId, { learnerId = '' } = {}) {
  const response = await api.get(`/student/assignments/${assignmentId}`, {
    params: {
      learnerId: learnerId || undefined,
    },
  })
  return normalizeAssignmentSummary(response?.data?.data || null)
}

export async function updateStudentAssignmentTodoProgress(taskId, payload, { learnerId = '' } = {}) {
  const response = await api.post(`/student/assignment-tasks/${taskId}/progress`, {
    data: payload || {},
  }, {
    params: {
      learnerId: learnerId || undefined,
    },
  })
  return normalizeAssignmentSummary(response?.data?.data || null)
}

export async function saveStudentAssignmentSubmissionDraft(taskId, payload, { learnerId = '' } = {}) {
  const response = await api.post(`/student/assignment-tasks/${taskId}/submissions/draft`, {
    data: payload || {},
  }, {
    params: {
      learnerId: learnerId || undefined,
    },
  })
  return normalizeAssignmentSummary(response?.data?.data || null)
}

export async function submitStudentAssignmentSubmission(taskId, payload, { learnerId = '' } = {}) {
  const response = await api.post(`/student/assignment-tasks/${taskId}/submissions/submit`, {
    data: payload || {},
  }, {
    params: {
      learnerId: learnerId || undefined,
    },
  })
  return normalizeAssignmentSummary(response?.data?.data || null)
}

export async function uploadStudentAssignmentFile(taskId, file, { learnerId = '' } = {}) {
  const formData = new FormData()
  formData.append('file', file)
  const response = await api.post(`/student/assignment-tasks/${taskId}/upload`, formData, {
    params: {
      learnerId: learnerId || undefined,
    },
  })
  return normalizeRelation(response?.data?.data || null)
}