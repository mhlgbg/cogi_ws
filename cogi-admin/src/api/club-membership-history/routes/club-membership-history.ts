const CLUB_MEMBERSHIP_HISTORY_POLICY = {
	name: 'global::has-tenant-permission',
	config: {
		key: 'club-membership.manage',
	},
};

export default {
	routes: [
		{
			method: 'GET',
			path: '/sports/membership-histories',
			handler: 'club-membership-history.list',
			config: { auth: false, policies: [CLUB_MEMBERSHIP_HISTORY_POLICY] },
		},
		{
			method: 'GET',
			path: '/sports/membership-histories/:id',
			handler: 'club-membership-history.getDetail',
			config: { auth: false, policies: [CLUB_MEMBERSHIP_HISTORY_POLICY] },
		},
		{
			method: 'GET',
			path: '/sports/memberships/:id/history',
			handler: 'club-membership-history.listForMembership',
			config: { auth: false, policies: [CLUB_MEMBERSHIP_HISTORY_POLICY] },
		},
	],
};