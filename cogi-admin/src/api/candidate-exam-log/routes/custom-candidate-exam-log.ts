export default {
	routes: [
		{
			method: 'GET',
			path: '/admission-management/candidate-exam-logs',
			handler: 'candidate-exam-log.find',
			config: {
				auth: false,
				policies: [
					{
						name: 'global::has-tenant-permission',
						config: {
							key: 'admission.review.manage',
						},
					},
				],
			},
		},
		{
			method: 'GET',
			path: '/admission-management/candidate-exam-logs/:id',
			handler: 'candidate-exam-log.findOne',
			config: {
				auth: false,
				policies: [
					{
						name: 'global::has-tenant-permission',
						config: {
							key: 'admission.review.manage',
						},
					},
				],
			},
		},
		{
			method: 'POST',
			path: '/admission-management/candidate-exam-logs',
			handler: 'candidate-exam-log.create',
			config: {
				auth: false,
				policies: [
					{
						name: 'global::has-tenant-permission',
						config: {
							key: 'admission.review.manage',
						},
					},
				],
			},
		},
		{
			method: 'PUT',
			path: '/admission-management/candidate-exam-logs/:id',
			handler: 'candidate-exam-log.update',
			config: {
				auth: false,
				policies: [
					{
						name: 'global::has-tenant-permission',
						config: {
							key: 'admission.review.manage',
						},
					},
				],
			},
		},
		{
			method: 'DELETE',
			path: '/admission-management/candidate-exam-logs/:id',
			handler: 'candidate-exam-log.delete',
			config: {
				auth: false,
				policies: [
					{
						name: 'global::has-tenant-permission',
						config: {
							key: 'admission.review.manage',
						},
					},
				],
			},
		},
		{
			method: 'POST',
			path: '/admission-management/candidate-exam-logs/:id/restore',
			handler: 'candidate-exam-log.restore',
			config: {
				auth: false,
				policies: [
					{
						name: 'global::has-tenant-permission',
						config: {
							key: 'admission.review.manage',
						},
					},
				],
			},
		},
	],
};