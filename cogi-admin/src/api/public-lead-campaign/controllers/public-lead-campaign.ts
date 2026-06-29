const LEAD_CAMPAIGN_UID = 'api::lead-campaign.lead-campaign';
const LEAD_CAPTURE_UID = 'api::lead-capture.lead-capture';

const DEFAULT_SUCCESS_MESSAGE = 'Đăng ký thành công. Chúng tôi sẽ liên hệ lại trong thời gian sớm nhất.';

function toText(value: unknown): string {
  if (value === null || value === undefined) return '';
  return String(value).trim();
}

function readRequestIp(ctx: any): string | null {
  return toText(ctx.request?.ip || ctx.ip || ctx.request?.headers?.['x-forwarded-for'] || '') || null;
}

function readRequestUserAgent(ctx: any): string | null {
  return toText(ctx.request?.headers?.['user-agent'] || '') || null;
}

function readRequestReferrer(ctx: any): string | null {
  return toText(ctx.request?.headers?.referer || ctx.request?.headers?.referrer || '') || null;
}

function extractPayload(ctx: any): Record<string, unknown> {
  const body = ctx.request?.body;
  if (body?.data && typeof body.data === 'object' && !Array.isArray(body.data)) {
    return body.data as Record<string, unknown>;
  }
  if (body && typeof body === 'object' && !Array.isArray(body)) {
    return body as Record<string, unknown>;
  }
  return {};
}

function pickFirstValueByKeys(data: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const direct = toText(data?.[key]);
    if (direct) return direct;
    const nested = Object.entries(data || {}).find(([entryKey, value]) => toText(entryKey).toLowerCase() === key.toLowerCase() && toText(value));
    if (nested) return toText(nested[1]);
  }
  return '';
}

export default {
  async submit(ctx: any) {
    const tenantId = ctx.state?.tenantId ?? ctx.state?.tenant?.id;
    if (!tenantId) {
      return ctx.badRequest('Tenant context is required');
    }

    const campaignCode = toText(ctx.params?.code);
    if (!campaignCode) {
      return ctx.badRequest('Campaign code is required');
    }

    const payload = extractPayload(ctx);
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
      return ctx.badRequest('data is required');
    }

    try {
      const campaign = await strapi.db.query(LEAD_CAMPAIGN_UID).findOne({
        where: {
          tenant: { id: { $eq: tenantId } },
          code: { $eqi: campaignCode },
          leadCampaignStatus: 'active',
          $or: [
            { isDeleted: false },
            { isDeleted: { $null: true } },
          ],
        },
        populate: {
          formTemplate: true,
        },
      });

      if (!campaign?.id) {
        return ctx.notFound('Lead campaign not found');
      }

      const fullName = pickFirstValueByKeys(payload, ['fullName', 'fullname', 'name', 'studentName']);
      const phone = pickFirstValueByKeys(payload, ['phone', 'mobile', 'tel']);
      const email = pickFirstValueByKeys(payload, ['email', 'mail']);

      const lead = await strapi.db.query(LEAD_CAPTURE_UID).create({
        data: {
          tenant: tenantId,
          campaign: campaign.id,
          fullName: fullName || null,
          phone: phone || null,
          email: email || null,
          data: payload,
          source: 'public_page',
          leadStatus: 'new',
          ipAddress: readRequestIp(ctx),
          userAgent: readRequestUserAgent(ctx),
          referrer: readRequestReferrer(ctx),
          isDeleted: false,
        },
      });

      ctx.body = {
        success: true,
        data: {
          id: lead?.id || null,
          message: toText((campaign as any)?.successMessage) || DEFAULT_SUCCESS_MESSAGE,
        },
      };
    } catch (error) {
      strapi.log.error('[public-lead-campaign.submit] unexpected error', error);
      return ctx.internalServerError('Failed to submit lead');
    }
  },
};
