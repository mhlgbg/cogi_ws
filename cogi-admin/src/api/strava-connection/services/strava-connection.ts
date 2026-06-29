/**
 * strava-connection service
 *
 * Stores the tenant-scoped Strava linkage for a single internal user.
 * Real OAuth and real Strava API sync are intentionally deferred.
 */

import { factories } from '@strapi/strapi';

export default factories.createCoreService('api::strava-connection.strava-connection');