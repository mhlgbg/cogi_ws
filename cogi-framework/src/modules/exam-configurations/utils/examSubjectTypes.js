/**
 * @typedef {Object} ExamSubjectComponentSummary
 * @property {number|string} id
 * @property {number|string} examComponentId
 * @property {string} examComponentDocumentId
 * @property {string} examComponentCode
 * @property {string} examComponentName
 * @property {string} examComponentType
 * @property {string} examMethod
 * @property {boolean} examComponentIsActive
 * @property {number|null} minimumScore
 * @property {number|null} maximumScore
 * @property {number|null} passingScore
 * @property {number|null} eliminationScore
 * @property {number|null} defaultDurationMinutes
 * @property {number} displayOrder
 * @property {boolean} isRequired
 * @property {number|null} weight
 * @property {number|null} passingScoreOverride
 * @property {number|null} eliminationScoreOverride
 * @property {number|null} durationMinutesOverride
 */

/**
 * @typedef {Object} ExamSubjectListItem
 * @property {number|string} id
 * @property {string} documentId
 * @property {string} code
 * @property {string} name
 * @property {string} calculationMethod
 * @property {number|null} requiredAggregateScore
 * @property {boolean} requireAllComponents
 * @property {number|null} defaultFee
 * @property {string} ruleDescription
 * @property {boolean} isActive
 * @property {number|null} subjectComponentCount
 * @property {string|null} createdAt
 * @property {string|null} updatedAt
 */

/**
 * @typedef {ExamSubjectListItem & {
 *  subjectComponents: ExamSubjectComponentSummary[]
 * }} ExamSubjectDetail
 */

/**
 * @typedef {Object} ExamSubjectListParams
 * @property {number} [page]
 * @property {number} [pageSize]
 * @property {string} [search]
 * @property {string} [isActive]
 * @property {string} [calculationMethod]
 * @property {string} [sortBy]
 * @property {'asc'|'desc'} [sortOrder]
 */

/**
 * @typedef {Object} ExamSubjectListResponse
 * @property {ExamSubjectListItem[]} rows
 * @property {{page:number,pageSize:number,total:number,pageCount:number}} pagination
 */

export const EXAM_SUBJECT_TYPE_DEFS = Object.freeze({})