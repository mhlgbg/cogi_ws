export default {
	routes: [
		{
			method: 'GET',
			path: '/journal-categories',
			handler: 'journal-category.find',
			config: {
				auth: false,
			},
		},
		{
			method: 'GET',
			path: '/journal-categories/:id',
			handler: 'journal-category.findOne',
			config: {
				auth: false,
			},
		},
		{
			method: 'POST',
			path: '/journal-categories',
			handler: 'journal-category.create',
			config: {
				auth: false,
				policies: [
					{
						name: 'global::has-tenant-permission',
						config: {
							key: 'journal-category.manage',
						},
					},
				],
			},
		},
		{
			method: 'PUT',
			path: '/journal-categories/:id',
			handler: 'journal-category.update',
			config: {
				auth: false,
				policies: [
					{
						name: 'global::has-tenant-permission',
						config: {
							key: 'journal-category.manage',
						},
					},
				],
			},
		},
		{
			method: 'DELETE',
			path: '/journal-categories/:id',
			handler: 'journal-category.delete',
			config: {
				auth: false,
				policies: [
					{
						name: 'global::has-tenant-permission',
						config: {
							key: 'journal-category.manage',
						},
					},
				],
			},
		},
	],
};