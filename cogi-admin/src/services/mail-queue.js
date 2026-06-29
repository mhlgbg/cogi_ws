const { Queue, Worker } = require('bullmq');
const IORedis = require('ioredis');
const {
  getMailErrorDetails,
  getMailErrorMessage,
  isFallbackAllowed,
  resolveFallbackMailProvider,
  resolveMailProviderName,
  resolvePrimaryMailProvider,
  sendMailWithProvider,
} = require('./mail-provider');

const MAIL_LOG_UID = 'api::mail-log.mail-log';
const MAIL_QUEUE_NAME = 'cogi-mail-queue';
const MAIL_SEND_MODE_DIRECT = 'direct';
const MAIL_SEND_MODE_MANUAL = 'manual';
const MAIL_SEND_MODE_REDIS = 'redis';
const DEFAULT_ATTEMPTS = 3;
const DEFAULT_BACKOFF_DELAY = 5000;
const DEFAULT_CONCURRENCY = 1;

let sharedQueue = null;
let sharedQueueConnection = null;
const workerConnections = new Set();
const redisErrorLogState = new Map();
const REDIS_ERROR_LOG_INTERVAL_MS = 15000;

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

function resolveConfiguredMailSendMode() {
  const normalized = toText(process.env.MAIL_SEND_MODE).toLowerCase();
  if (normalized === MAIL_SEND_MODE_MANUAL) return MAIL_SEND_MODE_MANUAL;
  if (normalized === MAIL_SEND_MODE_REDIS) return MAIL_SEND_MODE_REDIS;
  return MAIL_SEND_MODE_DIRECT;
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

function resolveMailQueueConfig() {
  const primaryProvider = resolvePrimaryMailProvider();
  const fallbackProvider = resolveFallbackMailProvider();
  const queueEnabled = toBooleanFlag(process.env.MAIL_QUEUE_ENABLED, true);
  const configuredSendMode = resolveConfiguredMailSendMode();
  const sendMode = queueEnabled ? MAIL_SEND_MODE_REDIS : configuredSendMode;

  return {
    enabled: queueEnabled,
    sendMode,
    useRedisQueue: queueEnabled && sendMode === MAIL_SEND_MODE_REDIS,
    rateMax: toPositiveInt(process.env.MAIL_QUEUE_RATE_MAX, 1),
    rateDuration: toPositiveInt(process.env.MAIL_QUEUE_RATE_DURATION, 1000),
    attempts: toPositiveInt(process.env.MAIL_QUEUE_ATTEMPTS, DEFAULT_ATTEMPTS),
    backoffDelay: toPositiveInt(process.env.MAIL_QUEUE_BACKOFF_DELAY, DEFAULT_BACKOFF_DELAY),
    concurrency: toPositiveInt(process.env.MAIL_QUEUE_CONCURRENCY, DEFAULT_CONCURRENCY),
    provider: primaryProvider,
    fallbackEnabled: toBooleanFlag(process.env.MAIL_FALLBACK_ENABLED, false),
    fallbackProvider,
  };
}

function buildRedisOptions() {
  const port = toPositiveInt(process.env.REDIS_PORT, 6379);
  const password = toText(process.env.REDIS_PASSWORD);

  return {
    host: toText(process.env.REDIS_HOST) || '127.0.0.1',
    port,
    password: password || undefined,
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
  };
}

function logRedisConnectionError(label, error) {
  const now = Date.now();
  const lastLoggedAt = Number(redisErrorLogState.get(label) || 0);
  if (now - lastLoggedAt < REDIS_ERROR_LOG_INTERVAL_MS) {
    return;
  }

  redisErrorLogState.set(label, now);

  console.error(`[mail-queue] Redis connection error (${label})`, {
    message: toText(error?.message) || 'Unknown Redis connection error',
    code: toText(error?.code) || null,
    address: toText(error?.address) || null,
    port: Number(error?.port || 0) || null,
  });
}

function attachRedisConnectionListeners(connection, label) {
  if (!connection || connection.__cogiRedisListenersAttached) {
    return connection;
  }

  connection.__cogiRedisListenersAttached = true;
  connection.on('error', (error) => {
    logRedisConnectionError(label, error);
  });

  return connection;
}

function getQueueConnection() {
  if (!sharedQueueConnection) {
    sharedQueueConnection = attachRedisConnectionListeners(new IORedis(buildRedisOptions()), 'queue');
  }

  return sharedQueueConnection;
}

function createWorkerConnection() {
  const connection = attachRedisConnectionListeners(new IORedis(buildRedisOptions()), 'worker');
  workerConnections.add(connection);
  return connection;
}

function getMailQueue() {
  if (!sharedQueue) {
    sharedQueue = new Queue(MAIL_QUEUE_NAME, {
      connection: getQueueConnection(),
    });
  }

  return sharedQueue;
}

function buildMailQueueJobId(mailLogId, suffix) {
  const normalizedId = toText(mailLogId);
  if (!normalizedId) return undefined;

  const normalizedSuffix = toText(suffix);
  return normalizedSuffix ? `mail-log-${normalizedId}-${normalizedSuffix}` : `mail-log-${normalizedId}`;
}

function normalizeMailMetadata(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {};
  }

  return { ...value };
}

function resolveMailLogMaxAttempts(mailLog, fallback) {
  const metadata = normalizeMailMetadata(mailLog?.metadata);
  return toPositiveInt(metadata.maxAttempts, fallback);
}

function buildQueueResult(mailLogId, jobId) {
  return {
    queued: true,
    direct: false,
    manual: false,
    queueName: MAIL_QUEUE_NAME,
    mailLogId,
    jobId,
  };
}

function buildMailLogResult(mailLog, extras = {}) {
  const metadata = normalizeMetadata(mailLog?.metadata);
  return {
    queued: extras.queued === true,
    direct: extras.direct === true,
    manual: extras.manual === true,
    queueName: extras.queueName || null,
    jobId: extras.jobId || null,
    mailLogId: Number(mailLog?.id || 0) || null,
    sendStatus: toText(mailLog?.sendStatus) || 'QUEUED',
    provider: toText(mailLog?.provider) || null,
    fallbackProvider: toText(mailLog?.fallbackProvider) || null,
    fallbackUsed: Boolean(toText(metadata.fallbackFrom)),
    providerMessageId: toText(mailLog?.providerMessageId) || null,
    lastError: toText(mailLog?.lastError) || null,
    lastProviderError: toText(mailLog?.lastProviderError) || null,
    fallbackError: toText(mailLog?.fallbackError) || null,
  };
}

function resolveStrapiInstance(explicitStrapi) {
  return explicitStrapi || global.strapi;
}

function normalizeMailPayload(input = {}) {
  const toList = normalizeEmailList(input.to || input.toEmail);
  const ccList = normalizeEmailList(input.cc);
  const bccList = normalizeEmailList(input.bcc);
  const subject = toText(input.subject);
  const html = typeof input.html === 'string' ? input.html : '';
  const text = typeof input.text === 'string' ? input.text : '';

  if (toList.length === 0) {
    const error = new Error('Mail recipient is required');
    error.status = 400;
    throw error;
  }

  if (!subject) {
    const error = new Error('Mail subject is required');
    error.status = 400;
    throw error;
  }

  if (!html && !text) {
    const error = new Error('Mail html or text content is required');
    error.status = 400;
    throw error;
  }

  return {
    tenantId: input.tenantId ?? null,
    mailType: toText(input.mailType) || 'system',
    toList,
    ccList,
    bccList,
    from: toText(input.from) || undefined,
    subject,
    html,
    text,
    replyTo: toText(input.replyTo) || undefined,
    provider: resolveMailProviderName(input.provider, resolveMailQueueConfig().provider),
    metadata: input.metadata && typeof input.metadata === 'object' && !Array.isArray(input.metadata)
      ? {
          ...input.metadata,
          ...(toText(input.from) ? { from: toText(input.from) } : {}),
        }
      : {},
    maxAttempts: toPositiveInt(input.maxAttempts, resolveMailQueueConfig().attempts),
  };
}

async function createMailLogEntry(strapi, payload) {
  const queuedAt = new Date();

  return strapi.db.query(MAIL_LOG_UID).create({
    data: {
      tenant: payload.tenantId || null,
      mailType: payload.mailType,
      toEmail: payload.toList.join(', '),
      cc: payload.ccList,
      bcc: payload.bccList,
      subject: payload.subject,
      html: payload.html || null,
      text: payload.text || null,
      replyTo: payload.replyTo || null,
      provider: payload.provider,
      fallbackProvider: null,
      providerMessageId: null,
      sendStatus: 'QUEUED',
      attempts: 0,
      lastProviderError: null,
      fallbackError: null,
      queuedAt,
      metadata: payload.metadata,
    },
  });
}

async function updateMailLog(strapi, mailLogId, data) {
  return strapi.db.query(MAIL_LOG_UID).update({
    where: { id: mailLogId },
    data,
  });
}

async function findMailLogById(strapi, mailLogId) {
  return strapi.db.query(MAIL_LOG_UID).findOne({
    where: { id: mailLogId },
    select: [
      'id',
      'toEmail',
      'cc',
      'bcc',
      'subject',
      'html',
      'text',
      'replyTo',
      'provider',
      'fallbackProvider',
      'providerMessageId',
      'sendStatus',
      'attempts',
      'lastProviderError',
      'fallbackError',
      'lastError',
      'queuedAt',
      'sentAt',
      'failedAt',
      'metadata',
    ],
    populate: {
      tenant: {
        select: ['id'],
      },
    },
  });
}

async function cancelMailLog(strapi, mailLogId, reason) {
  return updateMailLog(strapi, mailLogId, {
    sendStatus: 'CANCELLED',
    lastError: toText(reason) || 'Email delivery disabled',
    failedAt: null,
    sentAt: null,
  });
}

async function failMailLog(strapi, mailLogId, reason) {
  return updateMailLog(strapi, mailLogId, {
    sendStatus: 'FAILED',
    lastError: toText(reason) || 'Email queueing failed',
    failedAt: new Date(),
    sentAt: null,
  });
}

async function queueExistingMailLog(options = {}) {
  const strapi = resolveStrapiInstance(options.strapi);
  if (!strapi) {
    throw new Error('Strapi instance is required to queue existing mail log');
  }

  const mailLog = options.mailLog;
  const mailLogId = Number(mailLog?.id || 0);
  if (!mailLogId) {
    throw new Error('Mail log id is required to queue existing mail log');
  }

  const maxAttempts = toPositiveInt(
    options.maxAttempts,
    resolveMailLogMaxAttempts(mailLog, resolveMailQueueConfig().attempts)
  );
  const jobId = toText(options.jobId) || buildMailQueueJobId(mailLogId, options.jobIdSuffix);
  const metadata = {
    ...normalizeMailMetadata(mailLog?.metadata),
    maxAttempts,
    queueJobId: jobId,
    queueJobQueuedAt: new Date().toISOString(),
  };

  if (!resolveMailQueueConfig().useRedisQueue) {
	throw new Error('Redis queue mode is disabled');
  }

  const queue = getMailQueue();
  try {
    await queue.add(
      'send-mail',
      {
        mailLogId,
        maxAttempts,
      },
      {
        jobId,
        attempts: maxAttempts,
        backoff: {
          type: 'exponential',
          delay: resolveMailQueueConfig().backoffDelay,
        },
        removeOnComplete: 1000,
        removeOnFail: false,
      }
    );

    await updateMailLog(strapi, mailLogId, {
      metadata,
    });

    return buildQueueResult(mailLogId, jobId);
  } catch (error) {
    await failMailLog(strapi, mailLogId, error?.message || 'Email queueing failed');
    throw error;
  }
}

async function removeMailLogJob(options = {}) {
  if (!resolveMailQueueConfig().useRedisQueue) {
    return {
      removed: false,
      jobId: null,
    };
  }

  const mailLog = options.mailLog || null;
  const mailLogId = Number(mailLog?.id || options.mailLogId || 0);
  const metadata = normalizeMailMetadata(mailLog?.metadata);
  const candidateJobIds = [];

  const metadataJobId = toText(options.jobId || metadata.queueJobId);
  if (metadataJobId) candidateJobIds.push(metadataJobId);

  const baseJobId = buildMailQueueJobId(mailLogId);
  if (baseJobId && !candidateJobIds.includes(baseJobId)) {
    candidateJobIds.push(baseJobId);
  }

  const queue = getMailQueue();
  for (const candidateJobId of candidateJobIds) {
    const job = await queue.getJob(candidateJobId);
    if (!job) continue;
    await job.remove();
    return {
      removed: true,
      jobId: candidateJobId,
    };
  }

  return {
    removed: false,
    jobId: candidateJobIds[0] || null,
  };
}

function extractProviderMessageId(result) {
  if (!result || typeof result !== 'object') return null;

  return toText(result.messageId || result.id || result.responseId || result.response) || null;
}

function normalizeMetadata(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {};
  }

  return { ...value };
}

function buildSendPayloadFromMailLog(mailLog) {
  const metadata = normalizeMetadata(mailLog?.metadata);
  return {
    to: toEmailFieldValue(normalizeEmailList(mailLog?.toEmail)),
    cc: toEmailFieldValue(normalizeEmailList(mailLog?.cc)),
    bcc: toEmailFieldValue(normalizeEmailList(mailLog?.bcc)),
    from: toText(metadata.from) || undefined,
    replyTo: toText(mailLog?.replyTo) || undefined,
    subject: mailLog?.subject,
    html: mailLog?.html || undefined,
    text: mailLog?.text || undefined,
  };
}

function buildSendFailureStatus(attemptNumber, maxAttempts) {
  return attemptNumber >= maxAttempts ? 'FAILED' : 'RETRYING';
}

function buildFallbackMetadata(metadata, primaryProvider) {
  return {
    ...metadata,
    fallbackFrom: primaryProvider,
  };
}

async function processMailLogSend({ strapi, mailLogId, attemptNumber = 1, maxAttempts = DEFAULT_ATTEMPTS }) {
  const mailLog = await findMailLogById(strapi, mailLogId);

  if (!mailLog?.id) {
    const error = new Error(`Mail log ${String(mailLogId)} not found`);
    error.status = 404;
    throw error;
  }

  const metadata = normalizeMetadata(mailLog.metadata);
  const queueConfig = resolveMailQueueConfig();
  const primaryProvider = resolveMailProviderName(mailLog.provider, queueConfig.provider);
  const fallbackProvider = resolveMailProviderName(queueConfig.fallbackProvider, 'company');
  const sendPayload = buildSendPayloadFromMailLog(mailLog);

  await updateMailLog(strapi, mailLog.id, {
    sendStatus: 'SENDING',
    attempts: Math.max(0, Number(mailLog.attempts || 0)),
    lastError: null,
    lastProviderError: null,
    fallbackError: null,
  });

  try {
    console.log(`[MAIL] sending via ${primaryProvider}`);
    const sendResult = await sendMailWithProvider(sendPayload, primaryProvider, { strapi });
    const providerMessageId = extractProviderMessageId(sendResult);

    await updateMailLog(strapi, mailLog.id, {
      provider: primaryProvider,
      fallbackProvider: null,
      sendStatus: 'SENT',
      attempts: attemptNumber,
      sentAt: new Date(),
      failedAt: null,
      lastError: null,
      lastProviderError: null,
      fallbackError: null,
      providerMessageId,
      metadata,
    });

    return {
      ok: true,
      mailLogId: mailLog.id,
      provider: primaryProvider,
      providerMessageId,
    };
  } catch (error) {
    const lastProviderError = getMailErrorMessage(error) || 'Email sending failed';
    const fallbackEnabled = queueConfig.fallbackEnabled === true && fallbackProvider !== primaryProvider;
    const primaryErrorDetails = getMailErrorDetails(error);

    console.error(`[MAIL] ${primaryProvider} failed`, {
      mailLogId: mailLog.id,
      attemptNumber,
      maxAttempts,
      fallbackEnabled,
      fallbackProvider: fallbackEnabled ? fallbackProvider : null,
      ...primaryErrorDetails,
    });

    if (fallbackEnabled && isFallbackAllowed(error)) {
      console.log(`[MAIL] ${primaryProvider} failed, trying fallback ${fallbackProvider}`);

      try {
        const fallbackResult = await sendMailWithProvider(sendPayload, fallbackProvider, { strapi });
        const providerMessageId = extractProviderMessageId(fallbackResult);

        await updateMailLog(strapi, mailLog.id, {
          provider: fallbackProvider,
          fallbackProvider,
          providerMessageId,
          sendStatus: 'SENT',
          attempts: attemptNumber,
          sentAt: new Date(),
          failedAt: null,
          lastError: null,
          lastProviderError,
          fallbackError: null,
          metadata: buildFallbackMetadata(metadata, primaryProvider),
        });

        console.log(`[MAIL] sent via ${fallbackProvider} fallback`);

        return {
          ok: true,
          mailLogId: mailLog.id,
          provider: fallbackProvider,
          providerMessageId,
          fallbackFrom: primaryProvider,
        };
      } catch (fallbackSendError) {
        const fallbackErrorMessage = getMailErrorMessage(fallbackSendError) || 'Fallback email sending failed';
        const fallbackErrorDetails = getMailErrorDetails(fallbackSendError);
        const nextStatus = buildSendFailureStatus(attemptNumber, maxAttempts);
        const combinedError = `${primaryProvider}: ${lastProviderError}; ${fallbackProvider}: ${fallbackErrorMessage}`;

        console.error(`[MAIL] ${fallbackProvider} fallback failed`, {
          mailLogId: mailLog.id,
          attemptNumber,
          maxAttempts,
          primaryProvider,
          ...fallbackErrorDetails,
        });

        await updateMailLog(strapi, mailLog.id, {
          provider: primaryProvider,
          fallbackProvider,
          providerMessageId: null,
          sendStatus: nextStatus,
          attempts: attemptNumber,
          failedAt: nextStatus === 'FAILED' ? new Date() : null,
          lastError: combinedError,
          lastProviderError,
          fallbackError: fallbackErrorMessage,
          sentAt: null,
          metadata,
        });

        throw fallbackSendError;
      }
    }

    const nextStatus = buildSendFailureStatus(attemptNumber, maxAttempts);

    await updateMailLog(strapi, mailLog.id, {
      provider: primaryProvider,
      fallbackProvider: null,
      providerMessageId: null,
      sendStatus: nextStatus,
      attempts: attemptNumber,
      failedAt: nextStatus === 'FAILED' ? new Date() : null,
      sentAt: null,
      lastError: lastProviderError,
      lastProviderError,
      fallbackError: null,
      metadata,
    });

    throw error;
  }
}

  async function sendMailDirectFromMailLog(mailLogId, options = {}) {
    const strapi = resolveStrapiInstance(options.strapi);
    if (!strapi) {
      throw new Error('Strapi instance is required to send mail directly');
    }

    const existingMailLog = await findMailLogById(strapi, mailLogId);
    if (!existingMailLog?.id) {
      const error = new Error(`Mail log ${String(mailLogId)} not found`);
      error.status = 404;
      throw error;
    }

    const maxAttempts = toPositiveInt(
      options.maxAttempts,
      resolveMailLogMaxAttempts(existingMailLog, resolveMailQueueConfig().attempts)
    );
    const attemptNumber = Math.max(0, Number(existingMailLog.attempts || 0)) + 1;

    console.log('[MAIL] direct mode enabled');

    try {
      const result = await processMailLogSend({
        strapi,
        mailLogId: Number(existingMailLog.id),
        attemptNumber,
        maxAttempts,
      });
      const sentMailLog = await findMailLogById(strapi, mailLogId);
      return {
        ok: true,
        ...buildMailLogResult(sentMailLog, { direct: true }),
        fallbackFrom: toText(result?.fallbackFrom) || null,
      };
    } catch (error) {
      console.error('[MAIL] failed', {
        mailLogId: Number(existingMailLog.id),
        message: toText(error?.message) || 'Email sending failed',
      });
      const failedMailLog = await findMailLogById(strapi, mailLogId);
      return {
        ok: false,
        ...buildMailLogResult(failedMailLog, { direct: true }),
      };
    }
  }

async function enqueueMail(options = {}) {
  const strapi = resolveStrapiInstance(options.strapi);
  if (!strapi) {
    throw new Error('Strapi instance is required to enqueue mail');
  }

  const payload = normalizeMailPayload(options);
  const config = resolveMailQueueConfig();
  const mailLog = await createMailLogEntry(strapi, payload);

  if (config.sendMode === MAIL_SEND_MODE_MANUAL) {
	return buildMailLogResult(mailLog, {
		queued: false,
		direct: false,
		manual: true,
	});
  }

  if (config.sendMode === MAIL_SEND_MODE_DIRECT) {
	return sendMailDirectFromMailLog(mailLog.id, { strapi });
  }

  const nextMailLog = {
    ...mailLog,
    metadata: {
      ...payload.metadata,
      maxAttempts: payload.maxAttempts,
    },
  };

  return queueExistingMailLog({
    strapi,
    mailLog: nextMailLog,
    maxAttempts: payload.maxAttempts,
    jobIdSuffix: options.jobIdSuffix,
  });
}

async function processMailJob({ strapi, job }) {
  const maxAttempts = toPositiveInt(job?.data?.maxAttempts, DEFAULT_ATTEMPTS);
  const attemptNumber = Number(job?.attemptsMade || 0) + 1;

  return processMailLogSend({
    strapi,
    mailLogId: job?.data?.mailLogId,
    attemptNumber,
    maxAttempts,
  });
}

function createMailWorker(options = {}) {
  const strapi = resolveStrapiInstance(options.strapi);
  if (!strapi) {
    throw new Error('Strapi instance is required to create mail worker');
  }

  const config = resolveMailQueueConfig();
  const worker = new Worker(
    MAIL_QUEUE_NAME,
    async (job) => processMailJob({ strapi, job }),
    {
      connection: createWorkerConnection(),
      concurrency: options.concurrency || config.concurrency,
      limiter: config.rateMax > 0
        ? {
            max: config.rateMax,
            duration: config.rateDuration,
          }
        : undefined,
    }
  );

  worker.on('completed', (job) => {
    strapi.log.info(`[mail-queue] sent mail log=${String(job?.data?.mailLogId || '')}`);
  });

  worker.on('failed', (job, error) => {
    strapi.log.error(
      `[mail-queue] failed mail log=${String(job?.data?.mailLogId || '')} attempt=${String(Number(job?.attemptsMade || 0) + 1)}`,
      error
    );
  });

  worker.on('error', (error) => {
    strapi.log.error('[mail-queue] worker error', error);
  });

  return worker;
}

async function closeMailQueueResources() {
  if (sharedQueue) {
    await sharedQueue.close();
    sharedQueue = null;
  }

  if (sharedQueueConnection) {
    await sharedQueueConnection.quit();
    sharedQueueConnection = null;
  }

  const connections = Array.from(workerConnections);
  workerConnections.clear();
  for (const connection of connections) {
    await connection.quit();
  }
}

module.exports = {
  MAIL_LOG_UID,
  MAIL_QUEUE_NAME,
  MAIL_SEND_MODE_DIRECT,
  MAIL_SEND_MODE_MANUAL,
  MAIL_SEND_MODE_REDIS,
  buildMailQueueJobId,
  closeMailQueueResources,
  createMailLogEntry,
  createMailWorker,
  enqueueMail,
  failMailLog,
  getMailQueue,
  queueExistingMailLog,
  removeMailLogJob,
  processMailJob,
  resolveMailQueueConfig,
  sendMailDirectFromMailLog,
  updateMailLog,
};