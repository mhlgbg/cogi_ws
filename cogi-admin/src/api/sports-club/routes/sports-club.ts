const SPORTS_CLUB_POLICY = {
	name: 'global::has-tenant-permission',
	config: {
		key: 'sports-club.manage',
	},
};

export default {
	routes: [
		{
			method: 'GET',
			path: '/sports/clubs',
			handler: 'sports-club.list',
			config: { auth: false, policies: [SPORTS_CLUB_POLICY] },
		},
		{
			method: 'GET',
			path: '/sports/clubs/:id',
			handler: 'sports-club.getDetail',
			config: { auth: false, policies: [SPORTS_CLUB_POLICY] },
		},
		{
			method: 'POST',
			path: '/sports/clubs',
			handler: 'sports-club.create',
			config: { auth: false, policies: [SPORTS_CLUB_POLICY] },
		},
		{
			method: 'PUT',
			path: '/sports/clubs/:id',
			handler: 'sports-club.update',
			config: { auth: false, policies: [SPORTS_CLUB_POLICY] },
		},
		{
			method: 'POST',
			path: '/sports/clubs/:id/activate',
			handler: 'sports-club.activate',
			config: { auth: false, policies: [SPORTS_CLUB_POLICY] },
		},
		{
			method: 'POST',
			path: '/sports/clubs/:id/deactivate',
			handler: 'sports-club.deactivate',
			config: { auth: false, policies: [SPORTS_CLUB_POLICY] },
		},
	],
};