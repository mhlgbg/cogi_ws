import { processPendingGameEvents } from '../api/game/services/xp-engine';

let gameXpRunnerTimer: NodeJS.Timeout | null = null;

function isRunnerEnabled() {
  return String(process.env.GAME_XP_RUNNER_ENABLED || 'true').trim().toLowerCase() !== 'false';
}

function getRunnerIntervalMs() {
  const parsed = Number(process.env.GAME_XP_RUNNER_INTERVAL_MS || 10000);
  return Number.isFinite(parsed) && parsed >= 1000 ? parsed : 10000;
}

export async function startGameXpEventRunner(strapi: any) {
  if (gameXpRunnerTimer || !isRunnerEnabled()) {
    if (!isRunnerEnabled()) {
      strapi.log.info('[game-xp-runner] disabled');
    }
    return;
  }

  const tick = async () => {
    try {
      await processPendingGameEvents(25);
    } catch (error: any) {
      strapi.log.error('[game-xp-runner] unexpected error', error);
    }
  };

  gameXpRunnerTimer = setInterval(() => {
    void tick();
  }, getRunnerIntervalMs());

  await tick();
  strapi.log.info(`[game-xp-runner] started interval=${String(getRunnerIntervalMs())}ms`);
}

export async function stopGameXpEventRunner(strapi: any) {
  if (!gameXpRunnerTimer) return;
  clearInterval(gameXpRunnerTimer);
  gameXpRunnerTimer = null;
  strapi.log.info('[game-xp-runner] stopped');
}
