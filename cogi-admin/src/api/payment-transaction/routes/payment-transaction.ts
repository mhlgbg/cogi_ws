export default {
	routes: [
		{
			method: 'GET',
			path: '/payment-transactions',
			handler: 'payment-transaction.find',
			config: {
				auth: {
					scope: [],
				},
			},
		},
		{
			method: 'GET',
			path: '/payment-transactions/:id',
			handler: 'payment-transaction.findOne',
			config: {
				auth: {
					scope: [],
				},
			},
		},
		{
			method: 'POST',
			path: '/payment-transactions',
			handler: 'payment-transaction.create',
			config: {
				auth: {
					scope: [],
				},
			},
		},
		{
			method: 'PUT',
			path: '/payment-transactions/:id',
			handler: 'payment-transaction.update',
			config: {
				auth: {
					scope: [],
				},
			},
		},
		{
			method: 'DELETE',
			path: '/payment-transactions/:id',
			handler: 'payment-transaction.delete',
			config: {
				auth: {
					scope: [],
				},
			},
		},
	],
};
