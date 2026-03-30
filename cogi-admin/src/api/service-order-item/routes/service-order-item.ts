export default {
	routes: [
		{
			method: 'GET',
			path: '/service-order-items',
			handler: 'service-order-item.find',
			config: {
				auth: false,
			},
		},
		{
			method: 'GET',
			path: '/service-order-items/:id',
			handler: 'service-order-item.findOne',
			config: {
				auth: false,
			},
		},
		{
			method: 'POST',
			path: '/service-order-items',
			handler: 'service-order-item.create',
			config: {
				auth: false,
			},
		},
		{
			method: 'PUT',
			path: '/service-order-items/:id',
			handler: 'service-order-item.update',
			config: {
				auth: false,
			},
		},
		{
			method: 'DELETE',
			path: '/service-order-items/:id',
			handler: 'service-order-item.delete',
			config: {
				auth: false,
			},
		},
	],
};
