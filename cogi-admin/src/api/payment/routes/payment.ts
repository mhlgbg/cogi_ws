export default {
	routes: [
		{
			method: 'GET',
			path: '/payments/tracking',
			handler: 'payment.tracking',
			config: {
				auth: false,
			},
		},
		{
			method: 'GET',
			path: '/payments/tracking/:id',
			handler: 'payment.trackingDetail',
			config: {
				auth: false,
			},
		},
	],
};