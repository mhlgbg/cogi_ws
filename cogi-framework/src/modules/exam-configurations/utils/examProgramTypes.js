/**
 * @typedef {Object} ExamProgramSubjectSummary
 * @property {number|string} id
 * @property {number} displayOrder
 * @property {boolean} isRequired
 * @property {number|null} feeOverride
 * @property {number|string} examSubjectId
 * @property {string} examSubjectDocumentId
 * @property {string} examSubjectCode
 * @property {string} examSubjectName
 * @property {string} examSubjectCalculationMethod
 * @property {number|null} examSubjectRequiredAggregateScore
 * @property {boolean} examSubjectRequireAllComponents
 * @property {number|null} examSubjectDefaultFee
 * @property {boolean} examSubjectIsActive
 */

/**
 * @typedef {Object} ExamProgramListItem
 * @property {number|string} id
 * @property {string} documentId
 * @property {string} code
 * @property {string} name
 * @property {string} passingMethod
 * @property {string} feeCalculationMethod
 * @property {number|null} defaultFee
 * @property {string} targetDescription
 * @property {string|null} validFrom
 * @property {string|null} validTo
 * @property {boolean} isActive
 * @property {number|null} programSubjectCount
 * @property {string|null} createdAt
 * @property {string|null} updatedAt
 */

/**
 * @typedef {ExamProgramListItem & {
 *  programSubjects: ExamProgramSubjectSummary[]
 * }} ExamProgramDetail
 */

export const EXAM_PROGRAM_TYPE_DEFS = Object.freeze({})