export default {
	routes: [
		{
			method: 'GET',
			path: '/fee-items/listing',
			handler: 'fee-item.listing',
			config: {
				auth: false,
			},
		},
	],
};