/**
 * challenge-participant service
 *
 * Stores tenant-scoped challenge enrollment and denormalized totals.
 * Totals should be derived from accepted ChallengeActivity records.
 */

import { factories } from '@strapi/strapi';

export default factories.createCoreService('api::challenge-participant.challenge-participant');