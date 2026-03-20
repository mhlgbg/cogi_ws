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
  // inventory,
];

/**
 * Flat array of all route definitions from every module.
 * Each entry: { path, featureKey, component }
 */
export const allModuleRoutes = allModules.flatMap((m) => m.moduleRoutes || []);

/**
 * Array of moduleFeatures objects, one per registered module.
 * Modules without a moduleFeatures export are silently skipped.
 */
export const allModuleFeatures = allModules
  .map((m) => m.moduleFeatures)
  .filter(Boolean);
