/**
 * strava-oauth-state service
 *
 * Stores only a one-time hash of the OAuth state so the raw state never needs
 * to be persisted. Callback flow consumes the state exactly once.
 */

import { factories } from '@strapi/strapi';

export default factories.createCoreService('api::strava-oauth-state.strava-oauth-state');