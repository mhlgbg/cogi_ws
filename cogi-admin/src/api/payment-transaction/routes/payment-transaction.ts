export default {
	routes: [
		{
			method: 'GET',
			path: '/payment-transactions',
			handler: 'payment-transaction.find',
			config: {
				auth: false,
			},
		},
		{
			method: 'GET',
			path: '/payment-transactions/:id',
			handler: 'payment-transaction.findOne',
			config: {
				auth: false,
			},
		},
		{
			method: 'POST',
			path: '/payment-transactions',
			handler: 'payment-transaction.create',
			config: {
				auth: false,
			},
		},
		{
			method: 'PUT',
			path: '/payment-transactions/:id',
			handler: 'payment-transaction.update',
			config: {
				auth: false,
			},
		},
		{
			method: 'DELETE',
			path: '/payment-transactions/:id',
			handler: 'payment-transaction.delete',
			config: {
				auth: false,
			},
		},
	],
};
