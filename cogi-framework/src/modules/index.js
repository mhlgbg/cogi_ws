/**
 * Module Registry
 *
 * Register all app modules here. Each module must export:
 *   - moduleFeatures  (module features config)
 *   - moduleRoutes    (array of route definitions)
 *
 * To add a new module:
 *   1. Run: node scripts/add-module.js <name>
 *   2. Import it below and add to `allModules`
 */

import * as hrm from "./hrm";
import * as crm from "./crm";
import * as department from "./department";
import * as position from "./position";
import * as employee from "./employee";
import * as salesCounter from "./sales-counter";
import * as serviceOrders from './service-orders'
import * as inviteUser from './invite-user'
import * as userManagement from './user-management'
import * as requests from './requests'
import * as survey from './survey'
import * as surveyCampaign from './survey-campaign'
import * as surveyQuestionManagement from './survey-question-management'
import * as classManagement from './class-management'
import * as learnerManagement from './learner-management'
import * as feeSheetManagement from './fee-sheet-management'
import * as admissionManagement from './admission-management'
// import * as inventory from "./inventory";

export const allModules = [
  hrm,
  crm,
  department,
  position,
  employee,
  salesCounter,
  serviceOrders,
  inviteUser,
  userManagement,
  requests,
  survey,
  surveyCampaign,
  surveyQuestionManagement,
  classManagement,
  learnerManagement,
  feeSheetManagement,
  admissionManagement,
  // inventory,
];

/**
 * Flat array of all route definitions from every module.
 * Each entry: { path, featureKey, component }
 */
export const allModuleRoutes = allModules.flatMap((m) => m.moduleRoutes || []);

export function resolvePathByFeatureKey(featureKey) {
  const normalizedFeatureKey = String(featureKey || '').trim()
  if (!normalizedFeatureKey) return null

  if (normalizedFeatureKey === 'dashboard.view') {
    return '/dashboard'
  }

  const matchedRoute = allModuleRoutes.find((route) => String(route?.featureKey || '').trim() === normalizedFeatureKey)
  return matchedRoute?.path || null
}

/**
 * Array of moduleFeatures objects, one per registered module.
 * Modules without a moduleFeatures export are silently skipped.
 */
export const allModuleFeatures = allModules
  .map((m) => m.moduleFeatures)
  .filter(Boolean);
