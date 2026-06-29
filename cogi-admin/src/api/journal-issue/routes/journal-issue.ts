export default {
	routes: [
		{
			method: 'GET',
			path: '/journal-issues',
			handler: 'journal-issue.find',
			config: {
				auth: false,
			},
		},
		{
			method: 'GET',
			path: '/journal-issues/:id',
			handler: 'journal-issue.findOne',
			config: {
				auth: false,
				policies: [
					{
						name: 'global::has-tenant-permission',
						config: {
							key: 'journal-issue.manage',
						},
					},
				],
			},
		},
		{
			method: 'POST',
			path: '/journal-issues',
			handler: 'journal-issue.create',
			config: {
				auth: false,
				policies: [
					{
						name: 'global::has-tenant-permission',
						config: {
							key: 'journal-issue.manage',
						},
					},
				],
			},
		},
		{
			method: 'PUT',
			path: '/journal-issues/:id',
			handler: 'journal-issue.update',
			config: {
				auth: false,
				policies: [
					{
						name: 'global::has-tenant-permission',
						config: {
							key: 'journal-issue.manage',
						},
					},
				],
			},
		},
		{
			method: 'DELETE',
			path: '/journal-issues/:id',
			handler: 'journal-issue.delete',
			config: {
				auth: false,
				policies: [
					{
						name: 'global::has-tenant-permission',
						config: {
							key: 'journal-issue.manage',
						},
					},
				],
			},
		},
	],
};