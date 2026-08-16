const ASSIGNMENT_MANAGE_POLICY = {
	name: 'global::has-tenant-permission',
	config: {
		key: 'sports-club-user-assignment.manage',
	},
};

export default {
	routes: [
		{ method: 'GET', path: '/sports/club-user-assignments', handler: 'sports-club-user-assignment.list', config: { auth: false, policies: [ASSIGNMENT_MANAGE_POLICY] } },
		{ method: 'GET', path: '/sports/club-user-assignments/assignable-users', handler: 'sports-club-user-assignment.listAssignableUsers', config: { auth: false, policies: [ASSIGNMENT_MANAGE_POLICY] } },
		{ method: 'GET', path: '/sports/club-user-assignments/:id', handler: 'sports-club-user-assignment.getDetail', config: { auth: false, policies: [ASSIGNMENT_MANAGE_POLICY] } },
		{ method: 'POST', path: '/sports/club-user-assignments', handler: 'sports-club-user-assignment.create', config: { auth: false, policies: [ASSIGNMENT_MANAGE_POLICY] } },
		{ method: 'PUT', path: '/sports/club-user-assignments/:id', handler: 'sports-club-user-assignment.update', config: { auth: false, policies: [ASSIGNMENT_MANAGE_POLICY] } },
		{ method: 'POST', path: '/sports/club-user-assignments/:id/activate', handler: 'sports-club-user-assignment.activate', config: { auth: false, policies: [ASSIGNMENT_MANAGE_POLICY] } },
		{ method: 'POST', path: '/sports/club-user-assignments/:id/deactivate', handler: 'sports-club-user-assignment.deactivate', config: { auth: false, policies: [ASSIGNMENT_MANAGE_POLICY] } },
	],
};