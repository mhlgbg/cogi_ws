const USER_UID = 'plugin::users-permissions.user';
const TENANT_UID = 'api::tenant.tenant';
const USER_TENANT_UID = 'api::user-tenant.user-tenant';
const USER_TENANT_ROLE_UID = 'api::user-tenant-role.user-tenant-role';

function normalizeText(value) {
	if (value === null || value === undefined) return '';
	return String(value).trim();
}

function getRelationId(value) {
	if (value === null || value === undefined) return null;

	if (typeof value === 'number') {
		return Number.isFinite(value) ? value : null;
	}

	if (typeof value === 'string') {
		const parsed = Number(value);
		return Number.isFinite(parsed) ? parsed : null;
	}

	if (typeof value !== 'object') return null;

	return getRelationId(value.id);
}

function getModelAttributeNames(strapi, uid) {
	const model = strapi.getModel(uid);
	const attributes = model?.attributes || {};
	return new Set(Object.keys(attributes));
}

function getActiveWhere(strapi, uid) {
	const attrs = getModelAttributeNames(strapi, uid);

	if (attrs.has('userTenantStatus')) return { userTenantStatus: 'active' };
	if (attrs.has('userTenantRoleStatus')) return { userTenantRoleStatus: 'active' };
	if (attrs.has('tenantStatus')) return { tenantStatus: 'active' };
	if (attrs.has('status')) return { status: 'active' };
	if (attrs.has('isActive')) return { isActive: true };
	if (attrs.has('active')) return { active: true };

	return {};
}

function pickRoleLabel(role) {
	if (!role) return 'Unknown Role';

	const candidates = [role.label, role.name, role.code, role.type, role.id, role.documentId];
	for (const value of candidates) {
		const text = normalizeText(value);
		if (text) return text;
	}

	return 'Unknown Role';
}

function extractMediaUrl(media) {
	if (!media || typeof media !== 'object') return '';

	if (typeof media.url === 'string' && media.url.trim()) {
		return media.url.trim();
	}

	if (media.data && typeof media.data === 'object') {
		const nested = media.data;
		if (typeof nested.url === 'string' && nested.url.trim()) {
			return nested.url.trim();
		}
		if (nested.attributes && typeof nested.attributes.url === 'string' && nested.attributes.url.trim()) {
			return nested.attributes.url.trim();
		}
	}

	if (media.attributes && typeof media.attributes.url === 'string' && media.attributes.url.trim()) {
		return media.attributes.url.trim();
	}

	return '';
}

async function loadRolesByUserTenantId(strapi, userTenantId) {
	const where = {
		userTenant: userTenantId,
		...getActiveWhere(strapi, USER_TENANT_ROLE_UID),
	};

	const rows = await strapi.db.query(USER_TENANT_ROLE_UID).findMany({
		where,
		populate: {
			role: {
				select: ['id', 'name', 'description', 'type'],
			},
		},
	});

	return rows || [];
}

async function resolveUserFromJwt(strapi, ctx) {
	try {
		const authHeader = ctx.request?.headers?.authorization || ctx.request?.header?.authorization || '';
		const token = typeof authHeader === 'string' && authHeader.startsWith('Bearer ')
			? authHeader.slice(7).trim()
			: '';
		if (!token) return null;

		const jwtService = strapi.plugin('users-permissions')?.service('jwt');
		if (!jwtService) return null;

		const decoded = await jwtService.verify(token);
		const userId = getRelationId(decoded?.id);
		if (!userId) return null;

		return strapi.db.query(USER_UID).findOne({
			where: { id: userId },
			select: ['id', 'username', 'email', 'blocked'],
		});
	} catch {
		return null;
	}
}

async function loadTenantBrandingById(strapi, tenantId) {
	if (!tenantId) return null;

	const tenant = await strapi.db.query(TENANT_UID).findOne({
		where: { id: tenantId },
		select: ['id', 'shortName', 'defaultFeatureCode', 'defaultPublicRoute', 'defaultProtectedRoute'],
		populate: {
			logo: true,
		},
	});

	return tenant || null;
}

module.exports = (plugin) => {
	plugin.controllers.auth.myTenantContext = async (ctx) => {
		try {
			let authUser = ctx.state?.user;
			if (!authUser?.id) {
				authUser = await resolveUserFromJwt(strapi, ctx);
			}
			if (!authUser?.id) {
				return ctx.unauthorized('Unauthorized');
			}

			if (authUser?.blocked) {
				return ctx.unauthorized('Account is blocked');
			}

			const user = await strapi.db.query(USER_UID).findOne({
				where: { id: authUser.id },
				select: ['id', 'username', 'email'],
			});

			if (!user) {
				return ctx.unauthorized('Unauthorized');
			}

			const userTenantWhere = {
				user: authUser.id,
				...getActiveWhere(strapi, USER_TENANT_UID),
			};

			const userTenants = await strapi.db.query(USER_TENANT_UID).findMany({
				where: userTenantWhere,
				select: ['id', 'label'],
				populate: {
					tenant: {
						select: ['id', 'name', 'code', 'shortName', 'tenantStatus', 'defaultFeatureCode', 'defaultPublicRoute', 'defaultProtectedRoute'],
						populate: {
							logo: {
								select: ['url'],
							},
						},
					},
					userTenantRoles: {
						where: getActiveWhere(strapi, USER_TENANT_ROLE_UID),
						populate: {
							role: {
								select: ['id', 'name', 'description', 'type'],
							},
						},
					},
				},
			});

			const tenants = await Promise.all(
				(userTenants || []).map(async (entry) => {
					const tenant = entry?.tenant || null;
					if (!tenant) return null;

					const tenantActiveWhere = getActiveWhere(strapi, TENANT_UID);
					const tenantStatusField = Object.keys(tenantActiveWhere)[0];
					if (tenantStatusField) {
						const expected = tenantActiveWhere[tenantStatusField];
						if (tenant[tenantStatusField] !== expected) {
							return null;
						}
					}

					let userTenantRoleRows = Array.isArray(entry?.userTenantRoles)
						? entry.userTenantRoles
						: [];

					const userTenantId = getRelationId(entry?.id);
					if (userTenantRoleRows.length === 0 && userTenantId) {
						userTenantRoleRows = await loadRolesByUserTenantId(strapi, userTenantId);
					}

					const roles = userTenantRoleRows
						.map((row) => {
							const role = row?.role || null;
							if (!role) return null;

							const roleId = getRelationId(role.id);
							if (!roleId) return null;

							const roleName = normalizeText(role.name);
							const roleCode = normalizeText(role.code || role.type);

							return {
								id: roleId,
								name: roleName || pickRoleLabel(role),
								code: roleCode || null,
								label: pickRoleLabel(role),
							};
						})
						.filter(Boolean);

					const uniqueRoles = Array.from(new Map(roles.map((role) => [role.id, role])).values());

					const tenantId = getRelationId(tenant.id);
					if (!tenantId) return null;

					const tenantName = normalizeText(tenant.name);
					const tenantCode = normalizeText(tenant.code);
					const brandingTenant = await loadTenantBrandingById(strapi, tenantId);
					const tenantShortName = normalizeText(brandingTenant?.shortName || tenant.shortName);
					const tenantLogoUrl = extractMediaUrl(brandingTenant?.logo || tenant.logo);

					return {
						userTenantId: getRelationId(entry?.id),
						label: normalizeText(entry?.label) || [user?.username, tenantName || tenantCode].filter(Boolean).join(' - '),
						tenant: {
							id: tenantId,
							name: tenantName || tenantCode,
							code: tenantCode || null,
							shortName: tenantShortName || null,
							defaultFeatureCode: normalizeText(brandingTenant?.defaultFeatureCode || tenant.defaultFeatureCode) || null,
							defaultPublicRoute: normalizeText(brandingTenant?.defaultPublicRoute || tenant.defaultPublicRoute) || null,
							defaultProtectedRoute: normalizeText(brandingTenant?.defaultProtectedRoute || tenant.defaultProtectedRoute) || null,
							logo: brandingTenant?.logo || tenant.logo || null,
							logoUrl: tenantLogoUrl || null,
							label: tenantName || tenantCode || `Tenant #${tenantId}`,
						},
						roles: uniqueRoles,
					};
				}),
			);

			ctx.body = {
				user: {
					id: user.id,
					username: user.username,
					email: user.email,
				},
				tenants: tenants.filter(Boolean),
			};

			strapi.log.info(`[my-tenant-context] user=${user.id} tenants=${JSON.stringify((ctx.body.tenants || []).map((item) => ({
				userTenantId: item?.userTenantId,
				tenantId: item?.tenant?.id,
				tenantCode: item?.tenant?.code,
				hasLogoField: Boolean(item?.tenant?.logo),
				logoUrl: item?.tenant?.logoUrl || null,
			})))}`);
		} catch (error) {
			strapi.log.error('[users-permissions.auth.myTenantContext] failed', error);
			return ctx.internalServerError('Failed to load tenant context');
		}
	};

	const contentApiRoutes = plugin.routes?.['content-api']?.routes || [];
	const existed = contentApiRoutes.some(
		(route) => route.method === 'GET' && route.path === '/auth/my-tenant-context',
	);

	if (!existed) {
		contentApiRoutes.push({
			method: 'GET',
			path: '/auth/my-tenant-context',
			handler: 'auth.myTenantContext',
			config: {
				prefix: '',
				auth: false,
			},
		});
	}

	const originalBootstrap = plugin.bootstrap;
	plugin.bootstrap = async (args) => {
		if (typeof originalBootstrap === 'function') {
			await originalBootstrap(args);
		}

		const runtimeStrapi = args?.strapi || strapi;
		const routes = plugin.routes?.['content-api']?.routes || [];
		const lines = routes.map((route) => `${route.method} ${route.path} -> ${route.handler}`).join(' | ');
		runtimeStrapi.log.info(`[users-permissions] content-api routes: ${lines}`);
	};

	return plugin;
};


