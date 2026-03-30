export default {
	routes: [
		{
			method: 'GET',
			path: '/service-categories',
			handler: 'service-category.find',
			config: {
				auth: false,
			},
		},
		{
			method: 'GET',
			path: '/service-categories/:id',
			handler: 'service-category.findOne',
			config: {
				auth: false,
			},
		},
		{
			method: 'POST',
			path: '/service-categories',
			handler: 'service-category.create',
			config: {
				auth: false,
			},
		},
		{
			method: 'PUT',
			path: '/service-categories/:id',
			handler: 'service-category.update',
			config: {
				auth: false,
			},
		},
		{
			method: 'DELETE',
			path: '/service-categories/:id',
			handler: 'service-category.delete',
			config: {
				auth: false,
			},
		},
	],
};
