export default {
	routes: [
		{ method: 'GET', path: '/sports/me', handler: 'sports-me.getProfile', config: { auth: false } },
		{ method: 'PUT', path: '/sports/me', handler: 'sports-me.updateProfile', config: { auth: false } },
		{ method: 'POST', path: '/sports/me/avatar-upload', handler: 'sports-me.uploadAvatar', config: { auth: false } },
		{ method: 'GET', path: '/sports/me/clubs', handler: 'sports-me.listClubs', config: { auth: false } },
		{ method: 'GET', path: '/sports/me/clubs/:membershipId', handler: 'sports-me.getClubDetail', config: { auth: false } },
		{ method: 'GET', path: '/sports/me/clubs/:membershipId/history', handler: 'sports-me.listClubHistory', config: { auth: false } },
		{ method: 'GET', path: '/sports/me/achievements', handler: 'sports-me.listAchievements', config: { auth: false } },
		{ method: 'GET', path: '/sports/me/achievements/:achievementId', handler: 'sports-me.getAchievementDetail', config: { auth: false } },
		{ method: 'GET', path: '/sports/me/achievement-submissions', handler: 'sports-me.listAchievementSubmissions', config: { auth: false } },
		{ method: 'GET', path: '/sports/me/achievement-submissions/:submissionId', handler: 'sports-me.getAchievementSubmissionDetail', config: { auth: false } },
	],
};