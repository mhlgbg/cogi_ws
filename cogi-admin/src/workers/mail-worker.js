const { compileStrapi, createStrapi } = require('@strapi/core');
const { closeMailQueueResources, createMailWorker, resolveMailQueueConfig } = require('../services/mail-queue');

async function start() {
  const config = resolveMailQueueConfig();
  if (!config.enabled) {
    console.log('[mail-worker] MAIL_QUEUE_ENABLED=false, worker will not start');
    process.exit(0);
  }

  const appContext = await compileStrapi();
  const app = await createStrapi(appContext).load();
  const worker = createMailWorker({ strapi: app });

  let shuttingDown = false;

  const shutdown = async (signal) => {
    if (shuttingDown) return;
    shuttingDown = true;

    app.log.info(`[mail-worker] shutting down on ${signal}`);

    try {
      await worker.close();
      await closeMailQueueResources();
      await app.destroy();
      process.exit(0);
    } catch (error) {
      app.log.error('[mail-worker] failed during shutdown', error);
      process.exit(1);
    }
  };

  process.on('SIGINT', () => {
    void shutdown('SIGINT');
  });

  process.on('SIGTERM', () => {
    void shutdown('SIGTERM');
  });

  app.log.info('[mail-worker] worker started');
}

start().catch((error) => {
  console.error('[mail-worker] failed to start', error);
  process.exit(1);
});