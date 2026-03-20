import { buildUserTenantRoleLabel } from '../../utils/build-user-tenant-role-label';

type GenericRecord = Record<string, unknown>;

export default {
  async beforeCreate(event: any) {
    const data = (event.params?.data || {}) as GenericRecord;
    data.label = await buildUserTenantRoleLabel({ data });
  },

  async beforeUpdate(event: any) {
    const data = (event.params?.data || {}) as GenericRecord;
    data.label = await buildUserTenantRoleLabel({
      data,
      where: event.params?.where,
    });
  },
};
