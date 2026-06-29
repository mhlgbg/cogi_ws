const nodemailer = require('nodemailer');

const PROVIDER_SES = 'ses';
const PROVIDER_COMPANY = 'company';
const retryableErrorCodes = new Set([
  'ECONNECTION',
  'ECONNRESET',
  'ECONNREFUSED',
  'EAI_AGAIN',
  'ENOTFOUND',
  'ESOCKET',
  'ETIMEDOUT',
  'EPIPE',
]);
const permanentErrorCodes = new Set(['EENVELOPE', 'EMESSAGE']);
const sharedTransporters = new Map();

function toText(value) {
  if (value === null || value === undefined) return '';
  return String(value).trim();
}

function toBooleanFlag(value, fallback = false) {
  if (typeof value === 'boolean') return value;
  const normalized = toText(value).toLowerCase();
  if (!normalized) return fallback;
  return ['1', 'true', 'yes', 'on'].includes(normalized);
}

function toPositiveInt(value, fallback) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function normalizeEmailList(value) {
  if (Array.isArray(value)) {
    return value.map((item) => toText(item)).filter(Boolean);
  }

  const text = toText(value);
  if (!text) return [];

  return text
    .split(',')
    .map((item) => toText(item).toLowerCase())
    .filter(Boolean);
}

function toEmailFieldValue(list) {
  if (!Array.isArray(list) || list.length === 0) return undefined;
  return list.length === 1 ? list[0] : list;
}

function resolveMailProviderName(value, fallback = PROVIDER_COMPANY) {
  const normalized = toText(value).toLowerCase();
  if (normalized === PROVIDER_SES) return PROVIDER_SES;
  if (normalized === PROVIDER_COMPANY) return PROVIDER_COMPANY;
  return fallback;
}

function resolvePrimaryMailProvider() {
  const rawValue = toText(process.env.MAIL_PROVIDER);
  if (!rawValue) return PROVIDER_COMPANY;
  return resolveMailProviderName(rawValue, PROVIDER_SES);
}

function resolveFallbackMailProvider() {
  const rawValue = toText(process.env.MAIL_FALLBACK_PROVIDER);
  if (!rawValue) return PROVIDER_COMPANY;
  return resolveMailProviderName(rawValue, PROVIDER_COMPANY);
}

function resolveConfiguredSecure(rawValue, port, fallback = false) {
  const text = toText(rawValue);
  if (text) return toBooleanFlag(text, fallback);
  if (Number(port) === 465) return true;
  return fallback;
}

function resolveMailProviderConfig(provider) {
  const normalizedProvider = resolveMailProviderName(provider, resolvePrimaryMailProvider());

  if (normalizedProvider === PROVIDER_SES) {
    const port = toPositiveInt(process.env.SES_SMTP_PORT, 587);
    return {
      provider: PROVIDER_SES,
      host: toText(process.env.SES_SMTP_HOST) || 'email-smtp.ap-southeast-1.amazonaws.com',
      port,
      secure: resolveConfiguredSecure(process.env.SES_SMTP_SECURE, port, false),
      username: toText(process.env.SES_SMTP_USERNAME),
      password: toText(process.env.SES_SMTP_PASSWORD),
      defaultFrom: toText(process.env.SES_DEFAULT_FROM) || 'no-reply@system.alphataiho.com',
      defaultReplyTo: toText(process.env.SES_DEFAULT_REPLY_TO) || 'support@alphataiho.com',
    };
  }

  const port = toPositiveInt(process.env.COMPANY_SMTP_PORT, toPositiveInt(process.env.SMTP_PORT, 587));
  const fallbackUser = toText(process.env.SMTP_FROM) || toText(process.env.SMTP_USER);

  return {
    provider: PROVIDER_COMPANY,
    host: toText(process.env.COMPANY_SMTP_HOST) || toText(process.env.SMTP_HOST),
    port,
    secure: resolveConfiguredSecure(process.env.COMPANY_SMTP_SECURE || process.env.SMTP_SECURE, port, false),
    username: toText(process.env.COMPANY_SMTP_USERNAME) || toText(process.env.SMTP_USER),
    password: toText(process.env.COMPANY_SMTP_PASSWORD) || toText(process.env.SMTP_PASS),
    defaultFrom: toText(process.env.COMPANY_DEFAULT_FROM) || fallbackUser,
    defaultReplyTo: toText(process.env.COMPANY_DEFAULT_REPLY_TO) || toText(process.env.SMTP_REPLY_TO) || fallbackUser,
  };
}

function normalizeMailInput(payload = {}, providerConfig = {}) {
  return {
    to: toEmailFieldValue(normalizeEmailList(payload.to || payload.toEmail)),
    cc: toEmailFieldValue(normalizeEmailList(payload.cc)),
    bcc: toEmailFieldValue(normalizeEmailList(payload.bcc)),
    from: toText(payload.from) || providerConfig.defaultFrom || undefined,
    replyTo: toText(payload.replyTo) || providerConfig.defaultReplyTo || undefined,
    subject: toText(payload.subject),
    html: typeof payload.html === 'string' && payload.html ? payload.html : undefined,
    text: typeof payload.text === 'string' && payload.text ? payload.text : undefined,
  };
}

function getTransporterCacheKey(providerConfig) {
  return JSON.stringify({
    provider: providerConfig.provider,
    host: providerConfig.host,
    port: providerConfig.port,
    secure: providerConfig.secure,
    username: providerConfig.username,
  });
}

function getSesTransporter(providerConfig) {
  const cacheKey = getTransporterCacheKey(providerConfig);
  if (!sharedTransporters.has(cacheKey)) {
    sharedTransporters.set(cacheKey, nodemailer.createTransport({
      host: providerConfig.host,
      port: providerConfig.port,
      secure: providerConfig.secure,
      auth: {
        user: providerConfig.username,
        pass: providerConfig.password,
      },
    }));
  }

  return sharedTransporters.get(cacheKey);
}

function assertProviderConfig(providerConfig) {
  if (!providerConfig.host) {
    const error = new Error(`Mail provider ${providerConfig.provider} host is not configured`);
    error.code = 'MAIL_PROVIDER_CONFIG';
    throw error;
  }

  if (!providerConfig.username || !providerConfig.password) {
    const error = new Error(`Mail provider ${providerConfig.provider} credentials are not configured`);
    error.code = 'MAIL_PROVIDER_CONFIG';
    throw error;
  }
}

async function sendWithSesProvider(payload, providerConfig) {
  assertProviderConfig(providerConfig);
  const transporter = getSesTransporter(providerConfig);
  return transporter.sendMail(normalizeMailInput(payload, providerConfig));
}

async function sendWithCompanyProvider(strapi, payload, providerConfig) {
  const emailService = strapi.plugin('email')?.service('email');
  if (!emailService?.send) {
    const error = new Error('Email service is not available');
    error.status = 500;
    throw error;
  }

  return emailService.send(normalizeMailInput(payload, providerConfig));
}

async function sendMailWithProvider(payload, provider, options = {}) {
  const strapi = options.strapi || global.strapi;
  const normalizedProvider = resolveMailProviderName(provider, resolvePrimaryMailProvider());
  const providerConfig = resolveMailProviderConfig(normalizedProvider);

  if (normalizedProvider === PROVIDER_SES) {
    return sendWithSesProvider(payload, providerConfig);
  }

  if (!strapi) {
    throw new Error('Strapi instance is required for company mail provider');
  }

  return sendWithCompanyProvider(strapi, payload, providerConfig);
}

function getMailErrorResponseCode(error) {
  const candidates = [
    error?.responseCode,
    error?.statusCode,
    error?.status,
    error?.response?.status,
  ];

  for (const candidate of candidates) {
    const parsed = Number(candidate);
    if (Number.isInteger(parsed) && parsed > 0) {
      return parsed;
    }
  }

  return 0;
}

function getMailErrorCode(error) {
  return toText(error?.code || error?.responseCode).toUpperCase();
}

function getMailErrorMessage(error) {
  return toText(error?.message || error?.response?.body?.message || error?.response || error);
}

function getMailErrorDetails(error) {
  return {
    message: getMailErrorMessage(error),
    code: getMailErrorCode(error) || null,
    responseCode: getMailErrorResponseCode(error) || null,
  };
}

function isSesSandboxNotVerifiedError(error) {
	const message = getMailErrorMessage(error).toLowerCase();
	return [
		'email address is not verified',
		'message rejected: email address is not verified',
		'address is not verified',
	].some((needle) => message.includes(needle));
}

function hasPermanentRecipientOrMessageError(error) {
  const code = getMailErrorCode(error);
  const responseCode = getMailErrorResponseCode(error);
  const message = getMailErrorMessage(error).toLowerCase();

  if (isSesSandboxNotVerifiedError(error)) return false;

  if (permanentErrorCodes.has(code)) return true;
  if ([550, 551, 552, 553, 554].includes(responseCode)) return true;

  return [
    'invalid recipient',
    'recipient address rejected',
    'mailbox unavailable',
    'no such user',
    'badly formatted',
    'invalid email',
    'message rejected',
    'message invalid',
    'recipient rejected',
  ].some((needle) => message.includes(needle));
}

function hasPermanentProviderAuthOrConfigError(error) {
  const code = getMailErrorCode(error);
  const responseCode = getMailErrorResponseCode(error);
  const message = getMailErrorMessage(error).toLowerCase();

  if (isSesSandboxNotVerifiedError(error)) return false;

  if (code === 'MAIL_PROVIDER_CONFIG' || code === 'EAUTH') return true;
  if ([401, 403, 530, 535].includes(responseCode)) return true;

  return [
    'authentication failed',
    'invalid login',
    'invalid credentials',
    'credentials are not configured',
    'username and password not accepted',
    'not authorized',
    'not verified',
    'email address is not verified',
    'identity not verified',
    'domain is not verified',
  ].some((needle) => message.includes(needle));
}

function isRetryableMailError(error) {
  const code = getMailErrorCode(error);
  const responseCode = getMailErrorResponseCode(error);
  const message = getMailErrorMessage(error).toLowerCase();

  if (!message && !code && !responseCode) {
    return false;
  }

  if (hasPermanentRecipientOrMessageError(error)) {
    return false;
  }

  if (hasPermanentProviderAuthOrConfigError(error)) {
    return false;
  }

  if (retryableErrorCodes.has(code)) {
    return true;
  }

  if ([421, 429, 450, 451, 452, 500, 502, 503, 504].includes(responseCode)) {
    return true;
  }

  return [
    'timeout',
    'timed out',
    'temporary',
    'temporarily',
    'try again',
    'throttle',
    'throttl',
    'rate exceeded',
    'too many requests',
    'connection closed',
    'connection reset',
    'socket closed',
  ].some((needle) => message.includes(needle));
}

function isFallbackAllowed(error) {
	if (isSesSandboxNotVerifiedError(error)) {
		return true;
	}

  if (hasPermanentRecipientOrMessageError(error) || hasPermanentProviderAuthOrConfigError(error)) {
    return false;
  }

  return isRetryableMailError(error);
}

module.exports = {
  PROVIDER_COMPANY,
  PROVIDER_SES,
  getMailErrorDetails,
  getMailErrorMessage,
  isFallbackAllowed,
  isRetryableMailError,
  resolveFallbackMailProvider,
  resolveMailProviderConfig,
  resolveMailProviderName,
  resolvePrimaryMailProvider,
  sendMailWithProvider,
};