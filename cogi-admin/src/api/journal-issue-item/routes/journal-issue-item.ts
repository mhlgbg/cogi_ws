export default {
	routes: [
		{
			method: 'GET',
			path: '/journal-issue-items',
			handler: 'journal-issue-item.find',
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
			method: 'GET',
			path: '/journal-issue-items/:id',
			handler: 'journal-issue-item.findOne',
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
			path: '/journal-issue-items',
			handler: 'journal-issue-item.create',
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
			path: '/journal-issue-items/:id',
			handler: 'journal-issue-item.update',
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
			path: '/journal-issue-items/:id',
			handler: 'journal-issue-item.delete',
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