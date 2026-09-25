import { useState } from 'react'
import {
  CAlert,
  CButton,
  CCol,
  CFormInput,
  CFormLabel,
  CModal,
  CModalBody,
  CModalFooter,
  CModalHeader,
  CModalTitle,
  CRow,
  CTable,
  CTableBody,
  CTableDataCell,
  CTableHead,
  CTableHeaderCell,
  CTableRow,
} from '@coreui/react'
import {
  createGrade,
  createKnowledgeNode,
  createQuestion,
  createQuestionStimulus,
  createSkill,
  createSubject,
  getGrades,
  getKnowledgeNodes,
  getQuestionStimuli,
  getQuestions,
  getSkills,
  getSubjects,
  updateGrade,
  updateKnowledgeNode,
  updateQuestion,
  updateQuestionStimulus,
  updateSkill,
  updateSubject,
} from '../services/learningObjectApi'
import { getApiMessage, getEntityId } from '../utils/questionBankUi'

function normalizeArray(value) {
  return Array.isArray(value) ? value : []
}

function readBucket(pkg, key) {
  if (Array.isArray(pkg?.[key])) return pkg[key]
  if (Array.isArray(pkg?.supportingData?.[key])) return pkg.supportingData[key]
  return []
}

function normalizeText(value) {
  return String(value || '').trim()
}

function shouldShowOptions(type) {
  return ['single_choice', 'multiple_choice', 'true_false'].includes(String(type || '').trim().toLowerCase())
}

function normalizeCorrectAnswerForApi(correctAnswer) {
  if (correctAnswer === undefined || correctAnswer === null || correctAnswer === '') return null
  if (typeof correctAnswer === 'string') return JSON.stringify(correctAnswer)
  return correctAnswer
}

function toImportedCorrectAnswerTokens(correctAnswer) {
  if (Array.isArray(correctAnswer)) {
    return new Set(correctAnswer.map((item) => normalizeText(item)).filter(Boolean))
  }
  const token = normalizeText(correctAnswer)
  return token ? new Set([token]) : new Set()
}

function normalizeImportedQuestionPayload(item, lookupMaps = {}) {
  const type = normalizeText(item?.type).toLowerCase()
  const usesOptions = shouldShowOptions(type)
  const correctAnswerTokens = usesOptions ? toImportedCorrectAnswerTokens(item?.correctAnswer) : new Set()
  const hasDerivedCorrectAnswer = correctAnswerTokens.size > 0
  const existingQuestion = lookupMaps.existingQuestion || null
  const questionImageAssetCode = normalizeText(item?.questionImageAssetCode)

  const options = usesOptions
    ? normalizeArray(item?.options).map((option, index) => {
      const optionLabel = normalizeText(option?.label) || String.fromCharCode(65 + index)
      const optionValue = normalizeText(option?.value) || optionLabel
      const existingOption = normalizeArray(existingQuestion?.options).find((candidate) => normalizeText(candidate?.label) === optionLabel || normalizeText(candidate?.value) === optionValue) || existingQuestion?.options?.[index] || null
      const matchesDerivedAnswer = hasDerivedCorrectAnswer
        ? correctAnswerTokens.has(optionLabel) || correctAnswerTokens.has(optionValue)
        : false

      return {
        label: optionLabel,
        value: optionValue,
        content: option.content || '',
        imageAsset: option?.imageAssetCode || getEntityId(existingOption?.imageAsset) || null,
        isCorrect: hasDerivedCorrectAnswer ? matchesDerivedAnswer : option?.isCorrect === true,
        order: Number(option?.order ?? index),
        explanation: option.explanation || '',
      }
    })
    : []

  return {
    code: item.code,
    title: item.title || item.code,
    questionText: item.questionText,
    questionTextType: normalizeText(item?.questionTextType) === 'html' ? 'html' : normalizeText(existingQuestion?.questionTextType) === 'html' ? 'html' : 'plain_text',
    ...(questionImageAssetCode ? { questionImageAssetCode } : {}),
    type: item.type,
    difficulty: item.difficulty || null,
    subject: getEntityId(lookupMaps.subjectsByCode?.get(normalizeText(item.subjectCode))) || null,
    grade: getEntityId(lookupMaps.gradesByCode?.get(normalizeText(item.gradeCode))) || null,
    knowledgeNode: getEntityId(lookupMaps.knowledgeNodesByCode?.get(normalizeText(item.knowledgeNodeCode))) || null,
    skills: normalizeArray(item.skillCodes).map((code) => getEntityId(lookupMaps.skillsByCode?.get(normalizeText(code)))).filter(Boolean),
    formulas: [],
    stimulus: getEntityId(lookupMaps.stimuliByCode?.get(normalizeText(item.stimulusCode))) || null,
    correctAnswer: usesOptions ? null : normalizeCorrectAnswerForApi(item?.correctAnswer),
    explanation: item.explanation || '',
    rubric: item.rubric ?? null,
    questionStatus: item.questionStatus || 'draft',
    options,
  }
}

function buildStimulusImportPayload(item, existingStimulus = null) {
  return {
    code: item.code,
    title: item.title || item.code,
    type: item.type || 'text',
    instruction: item.instruction || '',
    content: item.content || '',
    contentType: normalizeText(item?.contentType) === 'html' ? 'html' : normalizeText(existingStimulus?.contentType) === 'html' ? 'html' : 'plain_text',
    stimulusStatus: item.stimulusStatus || 'draft',
    audioAsset: item?.audioAssetCode || getEntityId(existingStimulus?.audioAsset) || null,
    imageAsset: item?.imageAssetCode || getEntityId(existingStimulus?.imageAsset) || null,
  }
}

async function findByCode(loadFn, code) {
  if (!code) return null
  const payload = await loadFn({ q: code, page: 1, pageSize: 50 })
  const rows = Array.isArray(payload?.data) ? payload.data : Array.isArray(payload) ? payload : []
  return rows.find((item) => normalizeText(item?.code) === code) || null
}

function validateImportPackage(pkg) {
  const errors = []
  const warnings = []
  if (!pkg || typeof pkg !== 'object' || Array.isArray(pkg)) {
    errors.push('Package phải là object hợp lệ.')
    return { errors, warnings }
  }
  const format = normalizeText(pkg.format || pkg.packageFormat)
  if (format && format !== 'cogi.question-bank.import.v1') {
    warnings.push(`Format ${format} chưa được chuẩn hóa, sẽ cố gắng import theo v1.`)
  }

  const questionTypes = new Set(['single_choice', 'multiple_choice', 'true_false', 'short_answer', 'essay', 'ordering', 'matching', 'fill_blank'])
  const seenCodes = new Set()

  ;['subjects', 'grades', 'skills', 'knowledgeNodes', 'formulas', 'stimuli', 'questions'].forEach((bucket) => {
    normalizeArray(readBucket(pkg, bucket)).forEach((item, index) => {
      const code = normalizeText(item?.code)
      if (!code) {
        errors.push(`${bucket}[${index}].code là bắt buộc`)
        return
      }
      const scopedKey = `${bucket}:${code}`
      if (seenCodes.has(scopedKey)) {
        errors.push(`Trùng code trong file: ${scopedKey}`)
      }
      seenCodes.add(scopedKey)
    })
  })

  normalizeArray(readBucket(pkg, 'questions')).forEach((item, index) => {
    const type = normalizeText(item?.type)
    if (!questionTypes.has(type)) {
      errors.push(`questions[${index}].type không hợp lệ`)
    }
    if (!normalizeText(item?.questionText)) {
      errors.push(`questions[${index}].questionText là bắt buộc`)
    }
    const options = normalizeArray(item?.options)
    if (['single_choice', 'multiple_choice', 'true_false'].includes(type) && options.length === 0) {
      warnings.push(`questions[${index}] chưa có options`)
    }
  })

  return { errors, warnings }
}

export default function QuestionBankImportModal({ visible, onClose, onImported }) {
  const [file, setFile] = useState(null)
  const [parsing, setParsing] = useState(false)
  const [importing, setImporting] = useState(false)
  const [error, setError] = useState('')
  const [preview, setPreview] = useState(null)
  const [packageData, setPackageData] = useState(null)

  function resetLocalState() {
    setFile(null)
    setParsing(false)
    setImporting(false)
    setError('')
    setPreview(null)
    setPackageData(null)
  }

  function handleClose() {
    if (parsing || importing) return
    resetLocalState()
    onClose?.()
  }

  async function handleParse() {
    if (!file) {
      setError('Vui lòng chọn file JSON')
      return
    }
    setParsing(true)
    setError('')
    try {
      const text = await file.text()
      const parsed = JSON.parse(text)
      const { errors, warnings } = validateImportPackage(parsed)
      if (errors.length > 0) {
        setPreview({ errors, warnings, counts: null })
        setPackageData(null)
        return
      }

      const subjects = normalizeArray(readBucket(parsed, 'subjects'))
      const grades = normalizeArray(readBucket(parsed, 'grades'))
      const skills = normalizeArray(readBucket(parsed, 'skills'))
      const knowledgeNodes = normalizeArray(readBucket(parsed, 'knowledgeNodes'))
      const stimuli = normalizeArray(readBucket(parsed, 'stimuli'))
      const questions = normalizeArray(readBucket(parsed, 'questions'))

      const counts = { subjects: { create: 0, update: 0 }, grades: { create: 0, update: 0 }, skills: { create: 0, update: 0 }, knowledgeNodes: { create: 0, update: 0 }, stimuli: { create: 0, update: 0 }, questions: { create: 0, update: 0 } }

      for (const item of subjects) {
        const existing = await findByCode(getSubjects, normalizeText(item.code))
        counts.subjects[existing ? 'update' : 'create'] += 1
      }
      for (const item of grades) {
        const existing = await findByCode(getGrades, normalizeText(item.code))
        counts.grades[existing ? 'update' : 'create'] += 1
      }
      for (const item of skills) {
        const existing = await findByCode(getSkills, normalizeText(item.code))
        counts.skills[existing ? 'update' : 'create'] += 1
      }
      for (const item of knowledgeNodes) {
        const existing = await findByCode(getKnowledgeNodes, normalizeText(item.code))
        counts.knowledgeNodes[existing ? 'update' : 'create'] += 1
      }
      for (const item of stimuli) {
        const existing = await findByCode(getQuestionStimuli, normalizeText(item.code))
        counts.stimuli[existing ? 'update' : 'create'] += 1
      }
      for (const item of questions) {
        const existing = await findByCode(getQuestions, normalizeText(item.code))
        counts.questions[existing ? 'update' : 'create'] += 1
      }

      setPackageData(parsed)
      setPreview({ errors: [], warnings, counts })
    } catch (requestError) {
      setError(getApiMessage(requestError, 'Không parse được file import'))
    } finally {
      setParsing(false)
    }
  }

  async function handleImport() {
    if (!packageData || !preview || preview.errors?.length > 0) return
    setImporting(true)
    setError('')
    try {
      const subjectsByCode = new Map()
      const gradesByCode = new Map()
      const skillsByCode = new Map()
      const knowledgeNodesByCode = new Map()
      const stimuliByCode = new Map()
      const summary = { created: 0, updated: 0, skipped: 0, warnings: preview?.warnings?.length || 0, errors: 0 }

      for (const item of normalizeArray(readBucket(packageData, 'subjects'))) {
        const existing = await findByCode(getSubjects, normalizeText(item.code))
        const payload = { code: item.code, title: item.title || item.code, description: item.description || '', subjectStatus: item.subjectStatus || 'active' }
        const saved = existing ? await updateSubject(getEntityId(existing), payload) : await createSubject(payload)
        summary[existing ? 'updated' : 'created'] += 1
        subjectsByCode.set(normalizeText(saved?.code || item.code), saved)
      }

      for (const item of normalizeArray(readBucket(packageData, 'grades'))) {
        const existing = await findByCode(getGrades, normalizeText(item.code))
        const payload = { code: item.code, title: item.title || item.code, description: item.description || '', order: Number(item.order || 0), gradeStatus: item.gradeStatus || 'active' }
        const saved = existing ? await updateGrade(getEntityId(existing), payload) : await createGrade(payload)
        summary[existing ? 'updated' : 'created'] += 1
        gradesByCode.set(normalizeText(saved?.code || item.code), saved)
      }

      for (const item of normalizeArray(readBucket(packageData, 'knowledgeNodes'))) {
        const existing = await findByCode(getKnowledgeNodes, normalizeText(item.code))
        const payload = {
          code: item.code,
          title: item.title || item.code,
          description: item.description || '',
          subject: getEntityId(subjectsByCode.get(normalizeText(item.subjectCode))) || null,
          grade: getEntityId(gradesByCode.get(normalizeText(item.gradeCode))) || null,
          parent: getEntityId(knowledgeNodesByCode.get(normalizeText(item.parentCode))) || null,
          knowledgeNodeStatus: item.knowledgeNodeStatus || 'active',
          order: Number(item.order || 0),
          level: Number(item.level || 0),
        }
        const saved = existing ? await updateKnowledgeNode(getEntityId(existing), payload) : await createKnowledgeNode(payload)
        summary[existing ? 'updated' : 'created'] += 1
        knowledgeNodesByCode.set(normalizeText(saved?.code || item.code), saved)
      }

      for (const item of normalizeArray(readBucket(packageData, 'skills'))) {
        const existing = await findByCode(getSkills, normalizeText(item.code))
        const payload = {
          code: item.code,
          title: item.title || item.code,
          description: item.description || '',
          subject: getEntityId(subjectsByCode.get(normalizeText(item.subjectCode))) || null,
          grade: getEntityId(gradesByCode.get(normalizeText(item.gradeCode))) || null,
          knowledgeNode: getEntityId(knowledgeNodesByCode.get(normalizeText(item.knowledgeNodeCode))) || null,
          parentSkill: getEntityId(skillsByCode.get(normalizeText(item.parentSkillCode))) || null,
          level: item.level || 'understand',
          skillStatus: item.skillStatus || 'active',
        }
        const saved = existing ? await updateSkill(getEntityId(existing), payload) : await createSkill(payload)
        summary[existing ? 'updated' : 'created'] += 1
        skillsByCode.set(normalizeText(saved?.code || item.code), saved)
      }

      for (const item of normalizeArray(readBucket(packageData, 'stimuli'))) {
        const existing = await findByCode(getQuestionStimuli, normalizeText(item.code))
        const payload = buildStimulusImportPayload(item, existing)
        const saved = existing ? await updateQuestionStimulus(getEntityId(existing), payload) : await createQuestionStimulus(payload)
        summary[existing ? 'updated' : 'created'] += 1
        stimuliByCode.set(normalizeText(saved?.code || item.code), saved)
      }

      for (const item of normalizeArray(readBucket(packageData, 'questions'))) {
        const existing = await findByCode(getQuestions, normalizeText(item.code))
        const payload = normalizeImportedQuestionPayload(item, {
          subjectsByCode,
          gradesByCode,
          knowledgeNodesByCode,
          skillsByCode,
          stimuliByCode,
          existingQuestion: existing,
        })
        if (existing) {
          await updateQuestion(getEntityId(existing), payload)
          summary.updated += 1
        } else {
          await createQuestion(payload)
          summary.created += 1
        }
      }

      onImported?.(summary)
      handleClose()
    } catch (requestError) {
      setError(getApiMessage(requestError, 'Không import được question bank JSON'))
    } finally {
      setImporting(false)
    }
  }

  return (
    <CModal visible={visible} backdrop='static' size='xl' onClose={handleClose}>
      <CModalHeader>
        <CModalTitle>Import JSON Question Bank</CModalTitle>
      </CModalHeader>
      <CModalBody>
        {error ? <CAlert color='danger'>{error}</CAlert> : null}
        <CRow className='g-3'>
          <CCol md={8}>
            <CFormLabel>Chọn file JSON</CFormLabel>
            <CFormInput type='file' accept='.json,application/json' onChange={(event) => setFile(event.target.files?.[0] || null)} />
          </CCol>
          <CCol md={4} className='d-flex align-items-end'>
            <CButton color='primary' onClick={handleParse} disabled={parsing}>{parsing ? 'Đang parse...' : 'Parse & Preview'}</CButton>
          </CCol>
        </CRow>

        {preview ? (
          <div className='mt-4'>
            {preview.errors?.length > 0 ? <CAlert color='danger'>{preview.errors.join(' | ')}</CAlert> : null}
            {preview.warnings?.length > 0 ? <CAlert color='warning'>{preview.warnings.join(' | ')}</CAlert> : null}
            {preview.counts ? (
              <CTable responsive className='ai-table'>
                <CTableHead>
                  <CTableRow>
                    <CTableHeaderCell>Nhóm dữ liệu</CTableHeaderCell>
                    <CTableHeaderCell>New</CTableHeaderCell>
                    <CTableHeaderCell>Update</CTableHeaderCell>
                  </CTableRow>
                </CTableHead>
                <CTableBody>
                  {Object.entries(preview.counts).map(([key, value]) => (
                    <CTableRow key={key}>
                      <CTableDataCell>{key}</CTableDataCell>
                      <CTableDataCell>{value.create}</CTableDataCell>
                      <CTableDataCell>{value.update}</CTableDataCell>
                    </CTableRow>
                  ))}
                </CTableBody>
              </CTable>
            ) : null}
          </div>
        ) : null}
      </CModalBody>
      <CModalFooter>
        <CButton color='secondary' variant='outline' onClick={handleClose} disabled={importing || parsing}>Đóng</CButton>
        <CButton color='primary' onClick={handleImport} disabled={importing || parsing || !packageData || preview?.errors?.length > 0}>{importing ? 'Đang import...' : 'Import'}</CButton>
      </CModalFooter>
    </CModal>
  )
}
