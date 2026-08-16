const TENANT_SETTING_POLICY = {
	name: 'global::has-tenant-permission',
	config: {
		key: 'tenant-setting.manage',
	},
};

export default {
	routes: [
		{
			method: 'GET',
			path: '/tenant/settings/payment-profiles',
			handler: 'payment-profile.list',
			config: { auth: false, policies: [TENANT_SETTING_POLICY] },
		},
		{
			method: 'GET',
			path: '/tenant/settings/payment-profiles/:id',
			handler: 'payment-profile.getDetail',
			config: { auth: false, policies: [TENANT_SETTING_POLICY] },
		},
		{
			method: 'POST',
			path: '/tenant/settings/payment-profiles',
			handler: 'payment-profile.create',
			config: { auth: false, policies: [TENANT_SETTING_POLICY] },
		},
		{
			method: 'PUT',
			path: '/tenant/settings/payment-profiles/:id',
			handler: 'payment-profile.update',
			config: { auth: false, policies: [TENANT_SETTING_POLICY] },
		},
		{
			method: 'POST',
			path: '/tenant/settings/payment-profiles/:id/set-default',
			handler: 'payment-profile.setDefault',
			config: { auth: false, policies: [TENANT_SETTING_POLICY] },
		},
		{
			method: 'POST',
			path: '/tenant/settings/payment-profiles/:id/activate',
			handler: 'payment-profile.activate',
			config: { auth: false, policies: [TENANT_SETTING_POLICY] },
		},
		{
			method: 'POST',
			path: '/tenant/settings/payment-profiles/:id/deactivate',
			handler: 'payment-profile.deactivate',
			config: { auth: false, policies: [TENANT_SETTING_POLICY] },
		},
	],
};