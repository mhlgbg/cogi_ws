import { generateServiceOrderCode } from '../../services/generate-service-order-code';
import { resolveCurrentTenantId } from '../../../../utils/tenant-scope';

type GenericRecord = Record<string, unknown>;

function toSafeString(value: unknown): string {
  return String(value || '').trim();
}

export default {
  async beforeCreate(event: any) {
    const params = event.params || {};
    const data = (params.data || {}) as GenericRecord;

    if (!data.tenant) {
      const state = strapi?.requestContext?.get?.()?.state;
      if (state) {
        data.tenant = resolveCurrentTenantId({ state, throw: (status: number, message: string) => {
          const error = new Error(message) as Error & { status?: number };
          error.status = status;
          throw error;
        } });
      }
    }

    const providedCode = toSafeString(data.code);
    if (providedCode) {
      data.code = providedCode.toUpperCase();
      return;
    }

    const generatedCode = await generateServiceOrderCode(data);
    data.code = generatedCode;
  },
};
