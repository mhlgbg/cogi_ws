/**
 * challenge-activity service
 *
 * Business rules:
 * - ChallengeActivity is the canonical challenge scoring ledger.
 * - AUTO_ACCEPT may create ACCEPTED records automatically when the activity fits the challenge.
 * - USER_CONFIRM should create only PENDING suggestions until the participant confirms.
 * - MANUAL_SUBMIT means the participant explicitly selects an activity to submit.
 * - Activities must not be pushed into the leaderboard until challenge rules and visibility are satisfied.
 */

import { factories } from '@strapi/strapi';

export default factories.createCoreService('api::challenge-activity.challenge-activity');