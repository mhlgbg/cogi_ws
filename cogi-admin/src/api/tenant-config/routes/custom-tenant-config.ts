export default {
	routes: [
		{
			method: 'GET',
			path: '/tenant-config/by-key/:key',
			handler: 'tenant-config.findPublicByKey',
			config: {
				auth: false,
			},
		},
	],
};