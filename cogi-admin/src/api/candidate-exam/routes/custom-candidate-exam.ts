export default {
	routes: [
		{
			method: 'GET',
			path: '/candidate-exams/import-template',
			handler: 'candidate-exam.importTemplate',
			config: {
				auth: false,
				policies: [
					{
						name: 'global::has-tenant-permission',
						config: {
							key: 'admission.candidate-exam.manage',
						},
					},
				],
			},
		},
		{
			method: 'GET',
			path: '/candidate-exams/score-import-template',
			handler: 'candidate-exam.scoreImportTemplate',
			config: {
				auth: false,
				policies: [
					{
						name: 'global::has-tenant-permission',
						config: {
							key: 'admission.candidate-exam.manage',
						},
					},
				],
			},
		},
		{
			method: 'POST',
			path: '/candidate-exams/import-preview',
			handler: 'candidate-exam.importPreview',
			config: {
				auth: false,
				policies: [
					{
						name: 'global::has-tenant-permission',
						config: {
							key: 'admission.candidate-exam.manage',
						},
					},
				],
			},
		},
		{
			method: 'POST',
			path: '/candidate-exams/score-import-preview',
			handler: 'candidate-exam.scoreImportPreview',
			config: {
				auth: false,
				policies: [
					{
						name: 'global::has-tenant-permission',
						config: {
							key: 'admission.candidate-exam.manage',
						},
					},
				],
			},
		},
		{
			method: 'POST',
			path: '/candidate-exams/import-confirm',
			handler: 'candidate-exam.importConfirm',
			config: {
				auth: false,
				policies: [
					{
						name: 'global::has-tenant-permission',
						config: {
							key: 'admission.candidate-exam.manage',
						},
					},
				],
			},
		},
		{
			method: 'POST',
			path: '/candidate-exams/score-import-confirm',
			handler: 'candidate-exam.scoreImportConfirm',
			config: {
				auth: false,
				policies: [
					{
						name: 'global::has-tenant-permission',
						config: {
							key: 'admission.candidate-exam.manage',
						},
					},
				],
			},
		},
		{
			method: 'GET',
			path: '/candidate-exams/recheck-import-template',
			handler: 'candidate-exam.recheckImportTemplate',
			config: {
				auth: false,
				policies: [
					{
						name: 'global::has-tenant-permission',
						config: {
							key: 'admission.candidate-exam.manage',
						},
					},
				],
			},
		},
		{
			method: 'POST',
			path: '/candidate-exams/recheck-import-preview',
			handler: 'candidate-exam.recheckImportPreview',
			config: {
				auth: false,
				policies: [
					{
						name: 'global::has-tenant-permission',
						config: {
							key: 'admission.candidate-exam.manage',
						},
					},
				],
			},
		},
		{
			method: 'POST',
			path: '/candidate-exams/recheck-import-confirm',
			handler: 'candidate-exam.recheckImportConfirm',
			config: {
				auth: false,
				policies: [
					{
						name: 'global::has-tenant-permission',
						config: {
							key: 'admission.candidate-exam.manage',
						},
					},
				],
			},
		},
		{
			method: 'GET',
			path: '/candidate-exams/admission-seasons',
			handler: 'candidate-exam.admissionSeasons',
			config: {
				auth: false,
				policies: [
					{
						name: 'global::has-tenant-permission',
						config: {
							key: 'admission.candidate-exam.manage',
						},
					},
				],
			},
		},
		{
			method: 'GET',
			path: '/candidate-exams/card-reminder-summary',
			handler: 'candidate-exam.cardReminderSummary',
			config: {
				auth: false,
				policies: [
					{
						name: 'global::has-tenant-permission',
						config: {
							key: 'admission.candidate-exam.manage',
						},
					},
				],
			},
		},
		{
			method: 'GET',
			path: '/candidate-exams/export',
			handler: 'candidate-exam.export',
			config: {
				auth: false,
				policies: [
					{
						name: 'global::has-tenant-permission',
						config: {
							key: 'admission.candidate-exam.manage',
						},
					},
				],
			},
		},
		{
			method: 'GET',
			path: '/candidate-exams',
			handler: 'candidate-exam.find',
			config: {
				auth: false,
				policies: [
					{
						name: 'global::has-tenant-permission',
						config: {
							key: 'admission.candidate-exam.manage',
						},
					},
				],
			},
		},
		{
			method: 'POST',
			path: '/candidate-exams/send-card-reminders-direct',
			handler: 'candidate-exam.sendCardRemindersDirect',
			config: {
				auth: false,
				policies: [
					{
						name: 'global::has-tenant-permission',
						config: {
							key: 'admission.candidate-exam.manage',
						},
					},
				],
			},
		},
		{
			method: 'GET',
			path: '/candidate-exams/:id',
			handler: 'candidate-exam.findOne',
			config: {
				auth: false,
				policies: [
					{
						name: 'global::has-tenant-permission',
						config: {
							key: 'admission.candidate-exam.manage',
						},
					},
				],
			},
		},
		{
			method: 'GET',
			path: '/candidate-exams/:id/exam-card',
			handler: 'candidate-exam.examCard',
			config: {
				auth: false,
				policies: [
					{
						name: 'global::has-tenant-permission',
						config: {
							key: 'admission.candidate-exam.manage',
						},
					},
				],
			},
		},
		{
			method: 'GET',
			path: '/candidate-exams/:id/logs',
			handler: 'candidate-exam.logs',
			config: {
				auth: false,
				policies: [
					{
						name: 'global::has-tenant-permission',
						config: {
							key: 'admission.candidate-exam.manage',
						},
					},
				],
			},
		},
		{
			method: 'POST',
			path: '/candidate-exams',
			handler: 'candidate-exam.create',
			config: {
				auth: false,
				policies: [
					{
						name: 'global::has-tenant-permission',
						config: {
							key: 'admission.candidate-exam.manage',
						},
					},
				],
			},
		},
		{
			method: 'PUT',
			path: '/candidate-exams/:id',
			handler: 'candidate-exam.update',
			config: {
				auth: false,
				policies: [
					{
						name: 'global::has-tenant-permission',
						config: {
							key: 'admission.candidate-exam.manage',
						},
					},
				],
			},
		},
		{
			method: 'DELETE',
			path: '/candidate-exams/:id',
			handler: 'candidate-exam.delete',
			config: {
				auth: false,
				policies: [
					{
						name: 'global::has-tenant-permission',
						config: {
							key: 'admission.candidate-exam.manage',
						},
					},
				],
			},
		},
		{
			method: 'PUT',
			path: '/candidate-exams/:id/restore',
			handler: 'candidate-exam.restore',
			config: {
				auth: false,
				policies: [
					{
						name: 'global::has-tenant-permission',
						config: {
							key: 'admission.candidate-exam.manage',
						},
					},
				],
			},
		},
	],
};