export default {
	routes: [
		{
			method: 'GET',
			path: '/service-orders',
			handler: 'service-order.find',
			config: {
				auth: false,
			},
		},
		{
			method: 'GET',
			path: '/service-orders/:id',
			handler: 'service-order.findOne',
			config: {
				auth: false,
			},
		},
		{
			method: 'POST',
			path: '/service-orders',
			handler: 'service-order.create',
			config: {
				auth: false,
			},
		},
		{
			method: 'PUT',
			path: '/service-orders/:id',
			handler: 'service-order.update',
			config: {
				auth: false,
			},
		},
		{
			method: 'DELETE',
			path: '/service-orders/:id',
			handler: 'service-order.delete',
			config: {
				auth: false,
			},
		},
	],
};
