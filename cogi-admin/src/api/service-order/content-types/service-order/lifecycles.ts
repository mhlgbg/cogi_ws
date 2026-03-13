import { generateServiceOrderCode } from '../../services/generate-service-order-code';

type GenericRecord = Record<string, unknown>;

function toSafeString(value: unknown): string {
  return String(value || '').trim();
}

export default {
  async beforeCreate(event: any) {
    const params = event.params || {};
    const data = (params.data || {}) as GenericRecord;

    const providedCode = toSafeString(data.code);
    if (providedCode) {
      data.code = providedCode.toUpperCase();
      return;
    }

    const generatedCode = await generateServiceOrderCode(data);
    data.code = generatedCode;
  },
};
