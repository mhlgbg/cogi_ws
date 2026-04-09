import { errors } from '@strapi/utils';
import { toText, whereByParam } from '../../../utils/tenant-scope';

const NOTIFICATION_TEMPLATE_UID = 'api::notification-template.notification-template';

type NotificationData = Record<string, unknown>;

function toReplacementValue(value: unknown): string {
  if (value === null || value === undefined) return '';
  return String(value);
}

function replaceVariables(templateString: unknown, data: NotificationData = {}): string {
  const source = toText(templateString);

  if (!source) return '';

  return source.replace(/{{\s*([^{}\s]+)\s*}}/g, (_match, rawKey: string) => {
    const key = toText(rawKey);
    return toReplacementValue(data[key]);
  });
}

async function findActiveTemplate(templateCode: string, tenantId: number | string) {
  const tenantWhere = whereByParam(tenantId);

  if (!tenantWhere) {
    throw new errors.ApplicationError('tenantId is required');
  }

  return strapi.db.query(NOTIFICATION_TEMPLATE_UID).findOne({
    where: {
      code: {
        $eq: templateCode,
      },
      isActive: true,
      tenant: tenantWhere,
    },
    select: ['id', 'code', 'name', 'subject', 'content', 'type'],
  });
}

export default {
  replaceVariables,

  async sendNotification(templateCode: unknown, tenantId: number | string, data: NotificationData = {}) {
    const normalizedTemplateCode = toText(templateCode).toLowerCase();

    if (!normalizedTemplateCode) {
      throw new errors.ApplicationError('templateCode is required');
    }

    if (!data || typeof data !== 'object' || Array.isArray(data)) {
      throw new errors.ApplicationError('data must be an object');
    }

    const recipientEmail = toText(data.email);
    if (!recipientEmail) {
      throw new errors.ApplicationError('data.email is required');
    }

    const template = await findActiveTemplate(normalizedTemplateCode, tenantId);
    if (!template) {
      throw new errors.ApplicationError(
        `Active notification template not found for code "${normalizedTemplateCode}"`,
        {
          code: 'NOTIFICATION_TEMPLATE_NOT_FOUND',
          templateCode: normalizedTemplateCode,
          tenantId,
        }
      );
    }

    const templateType = toText(template.type).toLowerCase() || 'email';
    if (templateType !== 'email') {
      throw new errors.ApplicationError(`Notification template "${normalizedTemplateCode}" is not an email template`);
    }

    const subjectAfterReplace = replaceVariables(template.subject, data);
    const contentAfterReplace = replaceVariables(template.content, data);
    const emailService = strapi.plugin('email')?.service('email');

    if (!emailService?.send) {
      throw new errors.ApplicationError('Email service is not available');
    }

    await emailService.send({
      to: recipientEmail,
      subject: subjectAfterReplace,
      html: contentAfterReplace,
    });

    return {
      ok: true,
      templateId: template.id,
      code: normalizedTemplateCode,
      to: recipientEmail,
      subject: subjectAfterReplace,
      html: contentAfterReplace,
    };
  },
};