/**
 * @typedef {Object} LearnerLookupItem
 * @property {number} id
 * @property {string} code
 * @property {string} fullName
 * @property {string|null} dateOfBirth
 * @property {string|null} parentPhone
 * @property {string} learnerStatus
 * @property {{id:number, eligibilityStatus:string, reason:string|null}|null} existingEligibility
 * @property {{id:number, documentId:string|null, registrationCode:string, registrationStatus:string|null, paymentStatus:string|null, payableAmount:number, registeredAt:string|null}|null} registrationSummary
 */

/**
 * @typedef {Object} ExamEligibilityListItem
 * @property {number} id
 * @property {number|null} examRoundId
 * @property {{id:number, code:string, fullName:string, dateOfBirth:string|null, parentPhone:string|null, learnerStatus:string, className:string|null, cohort:string|null, major:string|null}|null} learner
 * @property {string} eligibilityStatus
 * @property {string} source
 * @property {string|null} reason
 * @property {string|null} note
 * @property {string|null} reviewedAt
 * @property {{id:number, username?:string, fullName?:string, email?:string}|null} reviewedBy
 * @property {{id:number, documentId:string|null, registrationCode:string, registrationStatus:string|null, paymentStatus:string|null, payableAmount:number, registeredAt:string|null}|null} registrationSummary
 */

/**
 * @typedef {ExamEligibilityListItem & {createdAt:string|null, updatedAt:string|null}} ExamEligibilityDetail
 */

/**
 * @typedef {Object} ExamEligibilityListParams
 * @property {number} [page]
 * @property {number} [pageSize]
 * @property {string} [search]
 * @property {string} [eligibilityStatus]
 * @property {string} [source]
 * @property {string} [registrationState]
 */

/**
 * @typedef {Object} ExamEligibilityListResponse
 * @property {ExamEligibilityListItem[]} rows
 * @property {{page:number, pageSize:number, total:number, pageCount:number}} pagination
 * @property {{pending:number, eligible:number, temporarilyIneligible:number, ineligible:number, registered:number, notRegistered:number}} summary
 */

/**
 * @typedef {Object} ExamEligibilityCreatePayload
 * @property {number} learnerId
 * @property {string} eligibilityStatus
 * @property {string} [source]
 * @property {string|null} [reason]
 * @property {string|null} [note]
 */

/**
 * @typedef {Object} ExamEligibilityUpdatePayload
 * @property {string} eligibilityStatus
 * @property {string|null} [reason]
 * @property {string|null} [note]
 */

export {}