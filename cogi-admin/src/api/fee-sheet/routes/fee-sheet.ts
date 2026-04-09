export default {
	routes: [
		{
			method: 'GET',
			path: '/fee-sheets',
			handler: 'fee-sheet.find',
			config: {
				auth: false,
			},
		},
		{
			method: 'GET',
			path: '/fee-sheets/form-options',
			handler: 'fee-sheet.formOptions',
			config: {
				auth: false,
			},
		},
		{
			method: 'GET',
			path: '/fee-sheets/:id',
			handler: 'fee-sheet.findOne',
			config: {
				auth: false,
			},
		},
		{
			method: 'POST',
			path: '/fee-sheets',
			handler: 'fee-sheet.create',
			config: {
				auth: false,
			},
		},
		{
			method: 'PUT',
			path: '/fee-sheets/:id',
			handler: 'fee-sheet.update',
			config: {
				auth: false,
			},
		},
		{
			method: 'POST',
			path: '/fee-sheets/:id/generate',
			handler: 'fee-sheet.generate',
			config: {
				auth: false,
			},
		},
	],
};