/**
 * strava-sync-job service
 *
 * Stores resumable Strava sync job state in the database.
 * Execution and claiming logic will be added in a later step.
 */

import { factories } from '@strapi/strapi';

export default factories.createCoreService('api::strava-sync-job.strava-sync-job');