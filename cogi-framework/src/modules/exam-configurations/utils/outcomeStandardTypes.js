/**
 * @typedef {Object} OutcomeStandardListItem
 * @property {number|string} id
 * @property {string} documentId
 * @property {string} code
 * @property {string} name
 * @property {string} applicableDescription
 * @property {string} recognitionMethod
 * @property {string|null} validFrom
 * @property {string|null} validTo
 * @property {boolean} isActive
 * @property {string|null} createdAt
 * @property {string|null} updatedAt
 */

/**
 * @typedef {OutcomeStandardListItem & {
 *  examProgramId: number|string|null,
 *  examProgramDocumentId: string,
 *  examProgramCode: string,
 *  examProgramName: string,
 *  examProgramIsActive: boolean|null,
 * }} OutcomeStandardDetail
 */

export const OUTCOME_STANDARD_TYPE_DEFS = Object.freeze({})