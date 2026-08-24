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
        const payload = {
          code: item.code,
          title: item.title || item.code,
          type: item.type || 'text',
          instruction: item.instruction || '',
          content: item.content || '',
          stimulusStatus: item.stimulusStatus || 'draft',
          audioAsset: null,
          imageAsset: null,
        }
        const saved = existing ? await updateQuestionStimulus(getEntityId(existing), payload) : await createQuestionStimulus(payload)
        summary[existing ? 'updated' : 'created'] += 1
        stimuliByCode.set(normalizeText(saved?.code || item.code), saved)
      }

      for (const item of normalizeArray(readBucket(packageData, 'questions'))) {
        const existing = await findByCode(getQuestions, normalizeText(item.code))
        const payload = {
          code: item.code,
          title: item.title || item.code,
          questionText: item.questionText,
          type: item.type,
          difficulty: item.difficulty || null,
          subject: getEntityId(subjectsByCode.get(normalizeText(item.subjectCode))) || null,
          grade: getEntityId(gradesByCode.get(normalizeText(item.gradeCode))) || null,
          knowledgeNode: getEntityId(knowledgeNodesByCode.get(normalizeText(item.knowledgeNodeCode))) || null,
          skills: normalizeArray(item.skillCodes).map((code) => getEntityId(skillsByCode.get(normalizeText(code)))).filter(Boolean),
          formulas: [],
          stimulus: getEntityId(stimuliByCode.get(normalizeText(item.stimulusCode))) || null,
          correctAnswer: item.correctAnswer ?? null,
          explanation: item.explanation || '',
          rubric: item.rubric ?? null,
          questionStatus: item.questionStatus || 'draft',
          options: normalizeArray(item.options).map((option, index) => ({
            label: option.label || String.fromCharCode(65 + index),
            value: option.value || String.fromCharCode(97 + index),
            content: option.content || '',
            imageAsset: null,
            isCorrect: option.isCorrect === true,
            order: Number(option.order ?? index),
            explanation: option.explanation || '',
          })),
        }
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
