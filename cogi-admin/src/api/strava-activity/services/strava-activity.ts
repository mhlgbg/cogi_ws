/**
 * strava-activity service
 *
 * Business rules:
 * - StravaActivity is the tenant-scoped personal activity snapshot after sync.
 * - StravaActivity is not used directly for challenge scoring or leaderboard ranking.
 * - ChallengeActivity is the only accepted source for challenge calculations.
 * - GPS/map visibility must not be auto-published from synced activity data.
 */

import { factories } from '@strapi/strapi';

export default factories.createCoreService('api::strava-activity.strava-activity');