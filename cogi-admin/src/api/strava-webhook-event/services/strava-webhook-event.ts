/**
 * strava-webhook-event service
 *
 * Stores raw Strava webhook deliveries durably so processing, retries, and
 * idempotency can be handled in later steps.
 */

import { factories } from '@strapi/strapi';

export default factories.createCoreService('api::strava-webhook-event.strava-webhook-event');