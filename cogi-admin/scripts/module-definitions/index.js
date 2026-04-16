'use strict';

/**
 * Module definitions registry.
 *
 * To add a new module:
 *   1. Create scripts/module-definitions/<name>.js
 *   2. require() it here and add to the array
 */

const hrm = require('./hrm');
const crm = require('./crm');
const department = require('./department');
const position = require('./position');
const employee = require('./employee');
const salesCounter = require('./sales-counter');
const serviceOrders = require('./service-orders');
const request = require('./request');
const user = require('./user');
const survey = require('./survey');
const classManagement = require('./class');
const learnerManagement = require('./learner');
const feeSheetManagement = require('./fee-sheet');
const admissionManagement = require('./admission');
const contentManagement = require('./content');
const slider = require('./slider');
// const inventory = require('./inventory');

module.exports = [
  hrm,
  crm,
  department,
  position,
  employee,
  salesCounter,
  serviceOrders,
  request,
  user,
  survey,
  classManagement,
  learnerManagement,
  feeSheetManagement,
  admissionManagement,
  contentManagement,
  slider,
  // inventory,
];
