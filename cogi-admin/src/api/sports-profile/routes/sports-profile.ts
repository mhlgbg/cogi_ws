const SPORTS_PROFILE_POLICY = {
	name: 'global::has-tenant-permission',
	config: {
		key: 'sports-profile.manage',
	},
};

export default {
	routes: [
		{
			method: 'GET',
			path: '/sports/profiles',
			handler: 'sports-profile.list',
			config: { auth: false, policies: [SPORTS_PROFILE_POLICY] },
		},
		{
			method: 'GET',
			path: '/sports/profiles/:id',
			handler: 'sports-profile.getDetail',
			config: { auth: false, policies: [SPORTS_PROFILE_POLICY] },
		},
		{
			method: 'GET',
			path: '/sports/profiles/:id/linkable-users',
			handler: 'sports-profile.listLinkableUsers',
			config: { auth: false, policies: [SPORTS_PROFILE_POLICY] },
		},
		{
			method: 'POST',
			path: '/sports/profiles',
			handler: 'sports-profile.create',
			config: { auth: false, policies: [SPORTS_PROFILE_POLICY] },
		},
		{
			method: 'PUT',
			path: '/sports/profiles/:id',
			handler: 'sports-profile.update',
			config: { auth: false, policies: [SPORTS_PROFILE_POLICY] },
		},
		{
			method: 'POST',
			path: '/sports/profiles/:id/activate',
			handler: 'sports-profile.activate',
			config: { auth: false, policies: [SPORTS_PROFILE_POLICY] },
		},
		{
			method: 'POST',
			path: '/sports/profiles/:id/deactivate',
			handler: 'sports-profile.deactivate',
			config: { auth: false, policies: [SPORTS_PROFILE_POLICY] },
		},
		{
			method: 'POST',
			path: '/sports/profiles/:id/link-user',
			handler: 'sports-profile.linkUser',
			config: { auth: false, policies: [SPORTS_PROFILE_POLICY] },
		},
		{
			method: 'POST',
			path: '/sports/profiles/:id/unlink-user',
			handler: 'sports-profile.unlinkUser',
			config: { auth: false, policies: [SPORTS_PROFILE_POLICY] },
		},
	],
};