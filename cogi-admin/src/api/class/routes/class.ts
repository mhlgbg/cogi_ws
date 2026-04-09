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