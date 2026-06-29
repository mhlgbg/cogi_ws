/**
 * fitness-challenge service
 *
 * Business rules:
 * - ChallengeActivity, not StravaActivity, is the ledger used to score challenges.
 * - AUTO_ACCEPT may create ACCEPTED ChallengeActivity records automatically.
 * - USER_CONFIRM should only create suggestions or PENDING records until the user confirms.
 * - MANUAL_SUBMIT requires the participant to choose activities explicitly.
 * - Activity data must not enter leaderboards unless it matches challenge configuration.
 */

import { factories } from '@strapi/strapi';

export default factories.createCoreService('api::fitness-challenge.fitness-challenge');