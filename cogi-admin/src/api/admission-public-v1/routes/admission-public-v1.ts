export default {
	routes: [
		{
			method: 'GET',
			path: '/admission-public-v1/lookup',
			handler: 'admission-public-v1.lookupByStudentCode',
			config: {
				auth: false,
			},
		},
		{
			method: 'POST',
			path: '/admission-public-v1/lookup',
			handler: 'admission-public-v1.lookup',
			config: {
				auth: false,
			},
		},
		{
			method: 'POST',
			path: '/admission-public-v1/result-lookup',
			handler: 'admission-public-v1.resultLookup',
			config: {
				auth: false,
			},
		},
		{
			method: 'GET',
			path: '/public/admission-campaigns/:campaignCode/exam-card',
			handler: 'admission-public-v1.examCard',
			config: {
				auth: false,
			},
		},
		{
			method: 'POST',
			path: '/public/admission-campaigns/:campaignCode/exam-card/print-log',
			handler: 'admission-public-v1.examCardPrintLog',
			config: {
				auth: false,
			},
		},
		{
			method: 'POST',
			path: '/admission-public-v1/start-registration',
			handler: 'admission-public-v1.startRegistration',
			config: {
				auth: false,
			},
		},
		{
			method: 'POST',
			path: '/admission-public-v1/resend-application-code',
			handler: 'admission-public-v1.resendApplicationCode',
			config: {
				auth: false,
			},
		},
		{
			method: 'POST',
			path: '/admission-public-v1/open-session',
			handler: 'admission-public-v1.openSession',
			config: {
				auth: false,
			},
		},
		{
			method: 'GET',
			path: '/admission-public-v1/session',
			handler: 'admission-public-v1.session',
			config: {
				auth: false,
			},
		},
		{
			method: 'GET',
			path: '/admission-public-v1/applications/:id/messages',
			handler: 'admission-public-v1.messages',
			config: {
				auth: false,
			},
		},
		{
			method: 'POST',
			path: '/admission-public-v1/applications/:id/messages',
			handler: 'admission-public-v1.sendMessage',
			config: {
				auth: false,
			},
		},
		{
			method: 'POST',
			path: '/admission-public-v1/applications/:id/track-view',
			handler: 'admission-public-v1.trackView',
			config: {
				auth: false,
			},
		},
		{
			method: 'POST',
			path: '/admission-applications/:id/acknowledge-approval',
			handler: 'admission-public-v1.acknowledgeApproval',
			config: {
				auth: false,
			},
		},
		{
			method: 'POST',
			path: '/admission-public-v1/applications',
			handler: 'admission-public-v1.createApplication',
			config: {
				auth: false,
			},
		},
		{
			method: 'PUT',
			path: '/admission-public-v1/applications/:id',
			handler: 'admission-public-v1.updateApplication',
			config: {
				auth: false,
			},
		},
	],
};