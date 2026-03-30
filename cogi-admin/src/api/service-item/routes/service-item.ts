export default {
	routes: [
		{
			method: 'GET',
			path: '/service-items',
			handler: 'service-item.find',
			config: {
				auth: false,
			},
		},
		{
			method: 'GET',
			path: '/service-items/:id',
			handler: 'service-item.findOne',
			config: {
				auth: false,
			},
		},
		{
			method: 'POST',
			path: '/service-items',
			handler: 'service-item.create',
			config: {
				auth: false,
			},
		},
		{
			method: 'PUT',
			path: '/service-items/:id',
			handler: 'service-item.update',
			config: {
				auth: false,
			},
		},
		{
			method: 'DELETE',
			path: '/service-items/:id',
			handler: 'service-item.delete',
			config: {
				auth: false,
			},
		},
	],
};
