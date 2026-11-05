export default {
	routes: [
		{
			method: 'GET',
			path: '/classes',
			handler: 'class.find',
			config: {
				auth: false,
			},
		},
		{
			method: 'GET',
			path: '/student/context',
			handler: 'class.getStudentContext',
			config: {
				auth: false,
			},
		},
		{
			method: 'GET',
			path: '/student/classes',
			handler: 'class.listStudentClasses',
			config: {
				auth: false,
			},
		},
		{
			method: 'GET',
			path: '/student/classes/:classId',
			handler: 'class.getStudentClass',
			config: {
				auth: false,
			},
		},
		{
			method: 'GET',
			path: '/student/classes/:classId/sessions',
			handler: 'class.listStudentClassSessions',
			config: {
				auth: false,
			},
		},
		{
			method: 'GET',
			path: '/student/sessions',
			handler: 'class.listStudentSessions',
			config: {
				auth: false,
			},
		},
		{
			method: 'GET',
			path: '/student/sessions/:sessionId',
			handler: 'class.getStudentSession',
			config: {
				auth: false,
			},
		},
		{
			method: 'GET',
			path: '/teacher/classes',
			handler: 'class.listTeacherClasses',
			config: {
				auth: false,
			},
		},
		{
			method: 'GET',
			path: '/teacher/classes/:classId',
			handler: 'class.getTeacherClass',
			config: {
				auth: false,
			},
		},
		{
			method: 'GET',
			path: '/teacher/classes/:classId/sessions',
			handler: 'class.listTeacherClassSessions',
			config: {
				auth: false,
			},
		},
		{
			method: 'GET',
			path: '/teacher/sessions',
			handler: 'class.listTeacherSessions',
			config: {
				auth: false,
			},
		},
		{
			method: 'GET',
			path: '/teacher/sessions/:sessionId',
			handler: 'class.getTeacherSession',
			config: {
				auth: false,
			},
		},
		{
			method: 'PUT',
			path: '/teacher/sessions/:sessionId/attendance',
			handler: 'class.saveTeacherSessionAttendance',
			config: {
				auth: false,
			},
		},
		{
			method: 'PUT',
			path: '/teacher/sessions/:sessionId/report',
			handler: 'class.saveTeacherSessionReport',
			config: {
				auth: false,
			},
		},
		{
			method: 'POST',
			path: '/teacher/sessions/:sessionId/complete',
			handler: 'class.completeTeacherSession',
			config: {
				auth: false,
			},
		},
		{
			method: 'GET',
			path: '/classes/form-options',
			handler: 'class.formOptions',
			config: {
				auth: false,
			},
		},
		{
			method: 'GET',
			path: '/classes/:id',
			handler: 'class.findOne',
			config: {
				auth: false,
			},
		},
		{
			method: 'GET',
			path: '/classes/:id/enrollment-options',
			handler: 'class.enrollmentOptions',
			config: {
				auth: false,
				policies: [
					{
						name: 'global::has-tenant-permission',
						config: { key: 'class.manage' },
					},
				],
			},
		},
		{
			method: 'GET',
			path: '/classes/:id/enrollments',
			handler: 'class.listEnrollments',
			config: {
				auth: false,
			},
		},
		{
			method: 'GET',
			path: '/classes/:id/assignments',
			handler: 'class.listAssignments',
			config: {
				auth: false,
			},
		},
		{
			method: 'GET',
			path: '/classes/:id/sessions',
			handler: 'class.listSessions',
			config: {
				auth: false,
			},
		},
		{
			method: 'POST',
			path: '/classes/:id/sessions',
			handler: 'class.createSession',
			config: {
				auth: false,
			},
		},
		{
			method: 'POST',
			path: '/classes/:id/sessions/bulk',
			handler: 'class.createSessionsBulk',
			config: {
				auth: false,
			},
		},
		{
			method: 'GET',
			path: '/classes/:id/sessions/:sessionId',
			handler: 'class.getSession',
			config: {
				auth: false,
			},
		},
		{
			method: 'PUT',
			path: '/classes/:id/sessions/:sessionId',
			handler: 'class.updateSession',
			config: {
				auth: false,
			},
		},
		{
			method: 'POST',
			path: '/classes/:id/sessions/:sessionId/cancel',
			handler: 'class.cancelSession',
			config: {
				auth: false,
			},
		},
		{
			method: 'PUT',
			path: '/classes/:id/sessions/:sessionId/attendance',
			handler: 'class.saveSessionAttendance',
			config: {
				auth: false,
			},
		},
		{
			method: 'PUT',
			path: '/classes/:id/sessions/:sessionId/report',
			handler: 'class.updateSessionReport',
			config: {
				auth: false,
			},
		},
		{
			method: 'POST',
			path: '/classes/:id/sessions/:sessionId/complete',
			handler: 'class.completeSession',
			config: {
				auth: false,
			},
		},
		{
			method: 'POST',
			path: '/classes/:id/assignments',
			handler: 'class.createAssignment',
			config: {
				auth: false,
			},
		},
		{
			method: 'PUT',
			path: '/classes/:id/assignments/:assignmentId',
			handler: 'class.updateAssignment',
			config: {
				auth: false,
			},
		},
		{
			method: 'POST',
			path: '/classes/:id/enrollments',
			handler: 'class.createEnrollment',
			config: {
				auth: false,
			},
		},
		{
			method: 'PUT',
			path: '/classes/:id/enrollments/:enrollmentId',
			handler: 'class.updateEnrollment',
			config: {
				auth: false,
			},
		},
		{
			method: 'DELETE',
			path: '/classes/:id/enrollments/:enrollmentId',
			handler: 'class.deleteEnrollment',
			config: {
				auth: false,
			},
		},
		{
			method: 'POST',
			path: '/classes/:id/enrollments/import',
			handler: 'class.importEnrollments',
			config: {
				auth: false,
			},
		},
		{
			method: 'POST',
			path: '/classes',
			handler: 'class.create',
			config: {
				auth: false,
			},
		},
		{
			method: 'PUT',
			path: '/classes/:id',
			handler: 'class.update',
			config: {
				auth: false,
			},
		},
		{
			method: 'DELETE',
			path: '/classes/:id',
			handler: 'class.delete',
			config: {
				auth: false,
			},
		},
	],
};