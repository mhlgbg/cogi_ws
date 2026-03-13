export default {
	routes: [
		{
			method: 'GET',
			path: '/service-orders',
			handler: 'service-order.find',
			config: {
				auth: {
					scope: [],
				},
			},
		},
		{
			method: 'GET',
			path: '/service-orders/:id',
			handler: 'service-order.findOne',
			config: {
				auth: {
					scope: [],
				},
			},
		},
		{
			method: 'POST',
			path: '/service-orders',
			handler: 'service-order.create',
			config: {
				auth: {
					scope: [],
				},
			},
		},
		{
			method: 'PUT',
			path: '/service-orders/:id',
			handler: 'service-order.update',
			config: {
				auth: {
					scope: [],
				},
			},
		},
		{
			method: 'DELETE',
			path: '/service-orders/:id',
			handler: 'service-order.delete',
			config: {
				auth: {
					scope: [],
				},
			},
		},
	],
};
