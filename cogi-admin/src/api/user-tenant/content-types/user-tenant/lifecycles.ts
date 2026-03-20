import { buildUserTenantLabel } from '../../utils/build-user-tenant-label';

type GenericRecord = Record<string, unknown>;

export default {
  async beforeCreate(event: any) {
    const data = (event.params?.data || {}) as GenericRecord;
    data.label = await buildUserTenantLabel({ data });
  },

  async beforeUpdate(event: any) {
    const data = (event.params?.data || {}) as GenericRecord;
    data.label = await buildUserTenantLabel({
      data,
      where: event.params?.where,
    });
  },
};
