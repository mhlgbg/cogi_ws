const CLUB_MEMBERSHIP_POLICY = {
	name: 'global::has-tenant-permission',
	config: {
		key: 'club-membership.manage',
	},
};

export default {
	routes: [
		{
			method: 'GET',
			path: '/sports/memberships',
			handler: 'club-membership.list',
			config: { auth: false, policies: [CLUB_MEMBERSHIP_POLICY] },
		},
		{
			method: 'GET',
			path: '/sports/memberships/:id',
			handler: 'club-membership.getDetail',
			config: { auth: false, policies: [CLUB_MEMBERSHIP_POLICY] },
		},
		{
			method: 'POST',
			path: '/sports/memberships',
			handler: 'club-membership.create',
			config: { auth: false, policies: [CLUB_MEMBERSHIP_POLICY] },
		},
		{
			method: 'PUT',
			path: '/sports/memberships/:id',
			handler: 'club-membership.update',
			config: { auth: false, policies: [CLUB_MEMBERSHIP_POLICY] },
		},
		{
			method: 'POST',
			path: '/sports/memberships/:id/activate',
			handler: 'club-membership.activate',
			config: { auth: false, policies: [CLUB_MEMBERSHIP_POLICY] },
		},
		{
			method: 'POST',
			path: '/sports/memberships/:id/deactivate',
			handler: 'club-membership.deactivate',
			config: { auth: false, policies: [CLUB_MEMBERSHIP_POLICY] },
		},
		{
			method: 'POST',
			path: '/sports/memberships/:id/leave',
			handler: 'club-membership.leave',
			config: { auth: false, policies: [CLUB_MEMBERSHIP_POLICY] },
		},
		{
			method: 'POST',
			path: '/sports/memberships/:id/suspend',
			handler: 'club-membership.suspend',
			config: { auth: false, policies: [CLUB_MEMBERSHIP_POLICY] },
		},
	],
};