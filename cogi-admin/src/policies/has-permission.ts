type PolicyConfig = {
  key?: string;
};

export default async (policyContext, config: PolicyConfig = {}) => {
  const ctx = policyContext?.ctx ?? policyContext;
  const state = policyContext?.state ?? ctx?.state;

  const unauthorized = (message = 'Unauthorized') => {
    if (typeof ctx?.unauthorized === 'function') {
      return ctx.unauthorized(message);
    }
    if (typeof ctx?.throw === 'function') {
      return ctx.throw(401, message);
    }
    const error = new Error(message) as Error & { status?: number };
    error.status = 401;
    throw error;
  };

  const forbidden = (message = 'Forbidden') => {
    if (typeof ctx?.forbidden === 'function') {
      return ctx.forbidden(message);
    }
    if (typeof ctx?.throw === 'function') {
      return ctx.throw(403, message);
    }
    const error = new Error(message) as Error & { status?: number };
    error.status = 403;
    throw error;
  };

  const requiredKey = config?.key;

  if (!requiredKey) {
    return forbidden('Permission key is required');
  }

  const authUser = state?.user;
  if (!authUser?.id) {
    return unauthorized('Unauthorized');
  }

  const user = await strapi.db.query('plugin::users-permissions.user').findOne({
    where: { id: authUser.id },
    populate: ['role'],
  });

  const roleId = user?.role?.id;
  if (!roleId) {
    return forbidden('Forbidden');
  }

  const mappings = await strapi.db.query('api::role-feature.role-feature').findMany({
    where: { role: roleId },
    populate: ['feature'],
  });

  const permissionKeys = new Set(
    (mappings || [])
      .map((item) => item?.feature?.key)
      .filter((key): key is string => typeof key === 'string' && key.length > 0)
  );

  if (!permissionKeys.has(requiredKey)) {
    return forbidden(`Forbidden: missing permission '${requiredKey}'`);
  }

  return true;
};
