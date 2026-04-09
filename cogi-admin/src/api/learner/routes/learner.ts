export default {
	routes: [
		{
			method: 'GET',
			path: '/learners',
			handler: 'learner.find',
			config: {
				auth: false,
			},
		},
		{
			method: 'GET',
			path: '/learners/form-options',
			handler: 'learner.formOptions',
			config: {
				auth: false,
			},
		},
		{
			method: 'GET',
			path: '/learners/:id',
			handler: 'learner.findOne',
			config: {
				auth: false,
			},
		},
		{
			method: 'POST',
			path: '/learners/import',
			handler: 'learner.import',
			config: {
				auth: false,
			},
		},
		{
			method: 'POST',
			path: '/learners',
			handler: 'learner.create',
			config: {
				auth: false,
			},
		},
		{
			method: 'PUT',
			path: '/learners/:id',
			handler: 'learner.update',
			config: {
				auth: false,
			},
		},
		{
			method: 'DELETE',
			path: '/learners/:id',
			handler: 'learner.delete',
			config: {
				auth: false,
			},
		},
	],
};