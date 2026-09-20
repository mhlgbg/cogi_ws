import ClassManagementPage from '../pages/ClassManagementPage'
import ClassDetailPage from '../pages/ClassDetailPage'
import StudentClassDetailPage from '../pages/StudentClassDetailPage'
import StudentClassWorkspacePage from '../pages/StudentClassWorkspacePage'
import StudentAssignmentsPage from '../pages/StudentAssignmentsPage'
import StudentSessionDetailPage from '../pages/StudentSessionDetailPage'
import StudentSessionWorkspacePage from '../pages/StudentSessionWorkspacePage'
import StudentWorkspaceOverviewPage from '../pages/StudentWorkspaceOverviewPage'
import TeacherClassWorkspacePage from '../pages/TeacherClassWorkspacePage'
import TeacherClassDetailPage from '../pages/TeacherClassDetailPage'
import TeacherSessionWorkspacePage from '../pages/TeacherSessionWorkspacePage'

const classManagementRoutes = [
  {
    path: '/classes',
    title: 'Lớp học',
    featureKey: 'class.manage',
    component: ClassManagementPage,
  },
  {
    path: '/classes/:id',
    title: 'Chi tiết lớp học',
    featureKey: 'class.manage',
    component: ClassDetailPage,
  },
  {
    path: '/teacher/classes',
    title: 'Lớp tôi phụ trách',
    featureKey: 'class.teacher-workspace',
    component: TeacherClassWorkspacePage,
  },
  {
    path: '/teacher/classes/:classId',
    title: 'Chi tiết lớp tôi phụ trách',
    featureKey: 'class.teacher-workspace',
    component: TeacherClassDetailPage,
  },
  {
    path: '/teacher/sessions',
    title: 'Buổi học của tôi',
    featureKey: 'class.teacher-sessions',
    component: TeacherSessionWorkspacePage,
  },
  {
    path: '/student',
    title: 'Tổng quan học tập',
    featureKey: 'class.student-workspace',
    component: StudentWorkspaceOverviewPage,
  },
  {
    path: '/student/classes',
    title: 'Lớp của tôi',
    featureKey: 'class.student-classes',
    component: StudentClassWorkspacePage,
  },
  {
    path: '/student/classes/:classId',
    title: 'Chi tiết lớp của tôi',
    featureKey: 'class.student-classes',
    component: StudentClassDetailPage,
  },
  {
    path: '/student/assignments',
    title: 'Bài tập của tôi',
    featureKey: 'class.student-workspace',
    component: StudentAssignmentsPage,
  },
  {
    path: '/student/sessions',
    title: 'Buổi học của tôi',
    featureKey: 'class.student-sessions',
    component: StudentSessionWorkspacePage,
  },
  {
    path: '/student/sessions/:sessionId',
    title: 'Chi tiết buổi học của tôi',
    featureKey: 'class.student-sessions',
    component: StudentSessionDetailPage,
  },
]

export default classManagementRoutes