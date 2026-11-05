import { cancelRegistrationAction } from '../services/event-registration';

export default {
  async cancelRegistrationById(ctx: any) {
    try {
      const result = await cancelRegistrationAction(ctx);
      ctx.body = result;
    } catch (error: any) {
      ctx.status = error?.status || 500;
      ctx.body = { ok: false, message: error?.message || 'Unknown error' };
    }
  },
};
