import { useEffect, useMemo, useState } from 'react'
import {
  CAlert,
  CBadge,
  CButton,
  CCard,
  CCardBody,
  CCardHeader,
  CCol,
  CFormCheck,
  CFormInput,
  CFormLabel,
  CFormSelect,
  CPagination,
  CPaginationItem,
  CRow,
  CSpinner,
  CTable,
  CTableBody,
  CTableDataCell,
  CTableHead,
  CTableHeaderCell,
  CTableRow,
} from '@coreui/react'
import FileAssetPickerModal from './FileAssetPickerModal'
import QuestionPreview from './QuestionPreview'
import StimulusPreview from './StimulusPreview'
import { getQuestions, getQuestionStimuli, updateQuestion, updateQuestionStimulus } from '../services/learningObjectApi'
import { buildPages, getApiMessage, getEntityId, getQuestionTypeLabel, getStatusBadgeColor, truncateText } from '../utils/questionBankUi'

function normalizeArray(value) {
  return Array.isArray(value) ? value : []
}

function normalizeText(value) {
  return String(value || '').trim()
}

function stripHtml(value) {
  return String(value || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
}

function toPositiveNumber(value) {
  const parsed = Number(value)
  return Number.isInteger(parsed) && parsed > 0 ? parsed : 0
}

function isChoiceQuestion(type) {
  const normalized = normalizeText(type).toLowerCase()
  return normalized === 'single_choice' || normalized === 'multiple_choice' || normalized === 'true_false'
}

function questionNeedsAnswer(question) {
  return normalizeText(question?.type).toLowerCase() !== 'essay'
}

function questionHasAnswer(question) {
  if (!questionNeedsAnswer(question)) return true
  if (isChoiceQuestion(question?.type)) {
    return normalizeArray(question?.options).some((option) => option?.isCorrect === true)
  }
  return question?.correctAnswer !== null && question?.correctAnswer !== undefined && normalizeText(question?.correctAnswer) !== ''
}

function stimulusNeedsImage(stimulus) {
  const normalized = normalizeText(stimulus?.type).toLowerCase()
  return normalized === 'image' || normalized === 'mixed'
}

function stimulusNeedsAudio(stimulus) {
  const normalized = normalizeText(stimulus?.type).toLowerCase()
  return normalized === 'audio' || normalized === 'mixed'
}

function optionNeedsImage(option) {
  if (option?.imageAsset) return true
  return stripHtml(option?.content).length === 0
}

function buildSourceSetTitle(sourceSetCode) {
  const tokens = normalizeText(sourceSetCode).split('-').filter(Boolean)
  if (tokens.length >= 2 && /^T\d+$/i.test(tokens[1])) {
    return `${tokens[0]} - Test ${tokens[1].slice(1)}`
  }
  return sourceSetCode || 'Không xác định'
}

function getLegacyLeafInfo(token) {
  const normalized = normalizeText(token)
  const match = normalized.match(/^([A-Z]+)(\d+)$/i)
  if (!match) return null
  return {
    sourceBucket: match[1].toUpperCase(),
    leafCode: `${match[1].toUpperCase()}${match[2]}`,
    order: toPositiveNumber(match[2]),
  }
}

function isMediaSuffix(token) {
  const normalized = normalizeText(token).toUpperCase()
  return normalized === 'AUDIO' || normalized === 'IMAGE' || normalized === 'VIDEO' || normalized === 'STIM'
}

function parseHierarchy(code) {
  const normalizedCode = normalizeText(code)
  const tokens = normalizedCode.split('-').filter(Boolean)
  if (tokens.length === 0) {
    return {
      sourceSetCode: 'UNSCOPED',
      sourceLabel: 'Nguồn không xác định',
      paperCode: 'P0',
      partCode: 'PT0',
      sectionCode: 'main',
      questionOrder: 0,
      paperOrder: 0,
      partOrder: 0,
    }
  }

  const paperIndex = tokens.findIndex((token) => /^P\d+$/i.test(token))
  const partIndex = tokens.findIndex((token) => /^PT\d+$/i.test(token))
  const questionIndex = tokens.findIndex((token) => /^Q\d+$/i.test(token))
  const legacyLeaf = getLegacyLeafInfo(tokens[0])

  if (paperIndex < 0 && partIndex < 0 && legacyLeaf) {
    const sectionTokens = tokens.slice(1).filter((token) => !isMediaSuffix(token))
    return {
      sourceSetCode: legacyLeaf.sourceBucket,
      sourceLabel: legacyLeaf.sourceBucket,
      paperCode: 'P0',
      partCode: legacyLeaf.leafCode,
      sectionCode: sectionTokens.join('-') || 'main',
      questionOrder: legacyLeaf.order,
      paperOrder: 0,
      partOrder: legacyLeaf.order,
    }
  }

  const sourceTokens = paperIndex > 0 ? tokens.slice(0, paperIndex) : tokens.slice(0, Math.min(2, tokens.length))
  const sourceSetCode = sourceTokens.join('-') || normalizedCode
  const sourceLabel = sourceTokens[0] || sourceSetCode
  const paperCode = paperIndex >= 0 ? tokens[paperIndex] : 'P0'
  const partCode = partIndex >= 0 ? tokens[partIndex] : 'PT0'
  const sectionTokens = partIndex >= 0 ? tokens.slice(partIndex + 1, questionIndex >= 0 ? questionIndex : tokens.length).filter((token) => token !== 'STIM') : []
  const sectionCode = sectionTokens.join('-') || 'main'

  return {
    sourceSetCode,
    sourceLabel,
    paperCode,
    partCode,
    sectionCode,
    questionOrder: questionIndex >= 0 ? toPositiveNumber(tokens[questionIndex].replace(/\D+/g, '')) : 0,
    paperOrder: toPositiveNumber(paperCode.replace(/\D+/g, '')),
    partOrder: toPositiveNumber(partCode.replace(/\D+/g, '')),
  }
}

function getQuestionSortOrder(question) {
  const parsed = parseHierarchy(question?.code)
  return parsed.questionOrder || 9999
}

function buildQuestionUpdatePayload(question, nextOptions = question?.options) {
  return {
    code: question?.code || '',
    title: question?.title || null,
    questionText: question?.questionText || '',
    type: question?.type || 'single_choice',
    difficulty: question?.difficulty || null,
    subject: getEntityId(question?.subject) || null,
    grade: getEntityId(question?.grade) || null,
    knowledgeNode: getEntityId(question?.knowledgeNode) || null,
    skills: normalizeArray(question?.skills).map((item) => getEntityId(item)).filter(Boolean),
    formulas: normalizeArray(question?.formulas).map((item) => getEntityId(item)).filter(Boolean),
    stimulus: getEntityId(question?.stimulus) || null,
    correctAnswer: question?.correctAnswer ?? null,
    explanation: question?.explanation || null,
    rubric: question?.rubric ?? null,
    questionStatus: question?.questionStatus || 'draft',
    options: normalizeArray(nextOptions).map((option, index) => ({
      label: option?.label || String.fromCharCode(65 + index),
      value: option?.value || option?.label || String.fromCharCode(65 + index),
      content: option?.content || '',
      imageAsset: getEntityId(option?.imageAsset) || null,
      isCorrect: option?.isCorrect === true,
      order: Number(option?.order ?? index),
      explanation: option?.explanation || '',
    })),
  }
}

function buildStimulusUpdatePayload(stimulus, patch = {}) {
  const next = { ...stimulus, ...patch }
  return {
    code: next?.code || '',
    title: next?.title || null,
    type: next?.type || 'text',
    instruction: next?.instruction || null,
    content: next?.content || null,
    audioAsset: getEntityId(next?.audioAsset) || null,
    imageAsset: getEntityId(next?.imageAsset) || null,
    stimulusStatus: next?.stimulusStatus || 'draft',
  }
}

function summarizePart(part) {
  const questions = normalizeArray(part?.questions)
  const stimuli = normalizeArray(part?.stimuli)
  const answerRequired = questions.filter(questionNeedsAnswer).length
  const answerReady = questions.filter(questionHasAnswer).length
  const imageRequired = stimuli.filter(stimulusNeedsImage).length + questions.reduce((sum, question) => sum + normalizeArray(question?.options).filter(optionNeedsImage).length, 0)
  const imageReady = stimuli.filter((stimulus) => stimulusNeedsImage(stimulus) && stimulus?.imageAsset).length + questions.reduce((sum, question) => sum + normalizeArray(question?.options).filter((option) => optionNeedsImage(option) && option?.imageAsset).length, 0)
  const audioRequired = stimuli.filter(stimulusNeedsAudio).length
  const audioReady = stimuli.filter((stimulus) => stimulusNeedsAudio(stimulus) && stimulus?.audioAsset).length
  const brokenRefs = questions.filter((question) => !question?.stimulus && stimuli.length > 0).length

  return {
    questions: { ready: questions.length, total: questions.length },
    answers: { ready: answerReady, total: answerRequired },
    images: { ready: imageReady, total: imageRequired },
    audio: { ready: audioReady, total: audioRequired },
    brokenRefs,
  }
}

function summarizeSourceSet(sourceSet) {
  const papers = normalizeArray(sourceSet?.papers)
  const questions = papers.flatMap((paper) => normalizeArray(paper?.parts).flatMap((part) => normalizeArray(part?.questions)))
  const stimuli = Array.from(new Map(papers.flatMap((paper) => normalizeArray(paper?.parts).flatMap((part) => normalizeArray(part?.stimuli))).map((stimulus) => [getEntityId(stimulus) || stimulus?.code, stimulus])).values())
  const answerRequired = questions.filter(questionNeedsAnswer).length
  const answerReady = questions.filter(questionHasAnswer).length
  const imageRequired = stimuli.filter(stimulusNeedsImage).length + questions.reduce((sum, question) => sum + normalizeArray(question?.options).filter(optionNeedsImage).length, 0)
  const imageReady = stimuli.filter((stimulus) => stimulusNeedsImage(stimulus) && stimulus?.imageAsset).length + questions.reduce((sum, question) => sum + normalizeArray(question?.options).filter((option) => optionNeedsImage(option) && option?.imageAsset).length, 0)
  const audioRequired = stimuli.filter(stimulusNeedsAudio).length
  const audioReady = stimuli.filter((stimulus) => stimulusNeedsAudio(stimulus) && stimulus?.audioAsset).length
  const brokenRefs = papers.reduce((sum, paper) => sum + normalizeArray(paper?.parts).reduce((partSum, part) => partSum + summarizePart(part).brokenRefs, 0), 0)

  return {
    questions: { ready: questions.length, total: questions.length },
    stimuli: { ready: stimuli.length, total: stimuli.length },
    answers: { ready: answerReady, total: answerRequired },
    images: { ready: imageReady, total: imageRequired },
    audio: { ready: audioReady, total: audioRequired },
    brokenRefs,
    status: [...questions, ...stimuli].every((item) => (item?.questionStatus || item?.stimulusStatus) === 'active')
      ? 'active'
      : [...questions, ...stimuli].every((item) => (item?.questionStatus || item?.stimulusStatus) === 'archived')
        ? 'archived'
        : 'draft',
  }
}

function getDataConditionKey(sourceSet) {
  const summary = sourceSet?.summary || {}
  if ((summary.brokenRefs || 0) > 0) return 'broken_refs'
  if ((summary.answers?.ready || 0) < (summary.answers?.total || 0)) return 'missing_answers'
  if ((summary.images?.ready || 0) < (summary.images?.total || 0)) return 'missing_images'
  if ((summary.audio?.ready || 0) < (summary.audio?.total || 0)) return 'missing_audio'
  return 'complete'
}

function buildSourceSets(questions, stimuli) {
  const sourceSets = new Map()

  function ensureSourceSet(sourceSetCode, sourceLabel) {
    if (!sourceSets.has(sourceSetCode)) {
      sourceSets.set(sourceSetCode, {
        code: sourceSetCode,
        title: buildSourceSetTitle(sourceSetCode),
        source: sourceLabel,
        papers: new Map(),
      })
    }
    return sourceSets.get(sourceSetCode)
  }

  function ensurePartBucket(parsed) {
    const sourceSet = ensureSourceSet(parsed.sourceSetCode, parsed.sourceLabel)
    if (!sourceSet.papers.has(parsed.paperCode)) {
      sourceSet.papers.set(parsed.paperCode, {
        code: parsed.paperCode,
        order: parsed.paperOrder,
        title: parsed.paperOrder > 0 ? `Paper ${parsed.paperOrder}` : 'Paper chính',
        parts: new Map(),
      })
    }
    const paper = sourceSet.papers.get(parsed.paperCode)
    const partMapKey = `${parsed.partCode}:${parsed.sectionCode}`
    if (!paper.parts.has(partMapKey)) {
      const partLabel = parsed.sectionCode !== 'main' ? `${parsed.partCode} • ${parsed.sectionCode}` : parsed.partCode
      paper.parts.set(partMapKey, {
        code: parsed.partCode,
        sectionCode: parsed.sectionCode,
        order: parsed.partOrder,
        title: parsed.paperOrder > 0
          ? parsed.sectionCode !== 'main'
            ? `Part ${parsed.partOrder || parsed.partCode.replace(/\D+/g, '')} • ${parsed.sectionCode}`
            : `Part ${parsed.partOrder || parsed.partCode.replace(/\D+/g, '') || parsed.partCode}`
          : partLabel,
        shortLabel: partLabel,
        questions: [],
        stimuli: [],
      })
    }
    return paper.parts.get(partMapKey)
  }

  normalizeArray(stimuli).forEach((stimulus) => {
    const parsed = parseHierarchy(stimulus?.code)
    ensurePartBucket(parsed).stimuli.push(stimulus)
  })

  normalizeArray(questions).forEach((question) => {
    const parsed = parseHierarchy(question?.code || question?.stimulus?.code)
    ensurePartBucket(parsed).questions.push(question)
  })

  return Array.from(sourceSets.values())
    .map((sourceSet) => {
      const papers = Array.from(sourceSet.papers.values())
        .map((paper) => ({
          ...paper,
          parts: Array.from(paper.parts.values())
            .map((part) => ({
              ...part,
              stimuli: part.stimuli.sort((left, right) => normalizeText(left?.code).localeCompare(normalizeText(right?.code))),
              questions: part.questions.sort((left, right) => getQuestionSortOrder(left) - getQuestionSortOrder(right) || normalizeText(left?.code).localeCompare(normalizeText(right?.code))),
            }))
            .sort((left, right) => left.order - right.order || normalizeText(left.shortLabel).localeCompare(normalizeText(right.shortLabel))),
        }))
        .sort((left, right) => left.order - right.order || normalizeText(left.code).localeCompare(normalizeText(right.code)))

      return {
        code: sourceSet.code,
        title: sourceSet.title,
        source: sourceSet.source,
        papers,
        summary: summarizeSourceSet({ papers }),
      }
    })
    .sort((left, right) => normalizeText(left.code).localeCompare(normalizeText(right.code)))
}

function matchesKeyword(sourceSet, keyword) {
  const normalized = normalizeText(keyword).toLowerCase()
  if (!normalized) return true
  return [sourceSet?.code, sourceSet?.title, sourceSet?.source]
    .map((value) => normalizeText(value).toLowerCase())
    .some((value) => value.includes(normalized))
}

function matchesSource(sourceSet, source) {
  const normalized = normalizeText(source)
  if (!normalized) return true
  return normalizeText(sourceSet?.source) === normalized
}

function matchesStatus(sourceSet, status) {
  const normalized = normalizeText(status)
  if (!normalized) return true
  return normalizeText(sourceSet?.summary?.status) === normalized
}

function matchesDataCondition(sourceSet, condition) {
  const normalized = normalizeText(condition)
  if (!normalized) return true
  return getDataConditionKey(sourceSet) === normalized
}

export default function QuestionBankSourceSetsTab({ setWorkspaceActions }) {
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [questions, setQuestions] = useState([])
  const [stimuli, setStimuli] = useState([])
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [selectedSourceSetCode, setSelectedSourceSetCode] = useState('')
  const [viewMode, setViewMode] = useState('structure')
  const [showAnswers, setShowAnswers] = useState(false)
  const [pickerState, setPickerState] = useState({ mode: '', stimulus: null, question: null, optionIndex: -1 })
  const [reloadTick, setReloadTick] = useState(0)
  const [qDraft, setQDraft] = useState('')
  const [filters, setFilters] = useState({ q: '', source: '', status: '', dataCondition: '' })
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)

  const sourceSets = useMemo(() => buildSourceSets(questions, stimuli), [questions, stimuli])
  const filteredSourceSets = useMemo(() => sourceSets.filter((item) => matchesKeyword(item, filters.q) && matchesSource(item, filters.source) && matchesStatus(item, filters.status) && matchesDataCondition(item, filters.dataCondition)), [filters, sourceSets])
  const pageCount = Math.max(1, Math.ceil(filteredSourceSets.length / pageSize))
  const safePage = Math.min(page, pageCount)
  const pages = useMemo(() => buildPages(safePage, pageCount), [pageCount, safePage])
  const pagedSourceSets = useMemo(() => filteredSourceSets.slice((safePage - 1) * pageSize, safePage * pageSize), [filteredSourceSets, pageSize, safePage])
  const sourceOptions = useMemo(() => Array.from(new Set(sourceSets.map((item) => normalizeText(item.source)).filter(Boolean))).sort((left, right) => left.localeCompare(right)), [sourceSets])
  const selectedSourceSet = useMemo(() => filteredSourceSets.find((item) => item.code === selectedSourceSetCode) || pagedSourceSets[0] || filteredSourceSets[0] || null, [filteredSourceSets, pagedSourceSets, selectedSourceSetCode])

  useEffect(() => {
    setWorkspaceActions?.(
      <CButton color='secondary' variant='outline' onClick={() => setReloadTick((prev) => prev + 1)} disabled={loading || saving}>Tải lại bộ câu hỏi</CButton>,
    )
    return () => setWorkspaceActions?.(null)
  }, [loading, saving, setWorkspaceActions])

  useEffect(() => {
    let active = true

    async function run() {
      setLoading(true)
      setError('')
      try {
        const [nextQuestions, nextStimuli] = await Promise.all([
          loadPaged(getQuestions),
          loadPaged(getQuestionStimuli),
        ])
        if (!active) return
        setQuestions(nextQuestions)
        setStimuli(nextStimuli)
      } catch (requestError) {
        if (!active) return
        setQuestions([])
        setStimuli([])
        setError(getApiMessage(requestError, 'Không tải được bộ câu hỏi'))
      } finally {
        if (active) setLoading(false)
      }
    }

    run()
    return () => {
      active = false
    }
  }, [reloadTick])

  useEffect(() => {
    if (page !== safePage) setPage(safePage)
  }, [page, safePage])

  useEffect(() => {
    if (!selectedSourceSetCode && filteredSourceSets[0]?.code) {
      setSelectedSourceSetCode(filteredSourceSets[0].code)
      return
    }
    if (selectedSourceSetCode && !filteredSourceSets.some((item) => item.code === selectedSourceSetCode)) {
      setSelectedSourceSetCode(filteredSourceSets[0]?.code || '')
    }
  }, [filteredSourceSets, selectedSourceSetCode])

  async function loadPaged(loadFn) {
    const rows = []
    let currentPage = 1
    const chunkSize = 100
    while (true) {
      const payload = await loadFn({ page: currentPage, pageSize: chunkSize })
      const data = normalizeArray(payload?.data)
      rows.push(...data)
      const total = Number(payload?.meta?.pagination?.total || data.length)
      if (rows.length >= total || data.length < chunkSize) break
      currentPage += 1
    }
    return rows
  }

  async function handleAttachStimulusAsset(stimulus, key, fileAsset) {
    setSaving(true)
    setError('')
    setSuccess('')
    try {
      await updateQuestionStimulus(getEntityId(stimulus), buildStimulusUpdatePayload(stimulus, { [key]: fileAsset }))
      setSuccess(`Đã cập nhật ${key === 'audioAsset' ? 'audio' : 'image'} cho stimulus ${stimulus?.code || ''}`)
      setReloadTick((prev) => prev + 1)
    } catch (requestError) {
      setError(getApiMessage(requestError, 'Không cập nhật được media của stimulus'))
    } finally {
      setSaving(false)
      setPickerState({ mode: '', stimulus: null, question: null, optionIndex: -1 })
    }
  }

  async function handleAttachOptionImage(question, optionIndex, fileAsset) {
    const currentOptions = normalizeArray(question?.options)
    const nextOptions = currentOptions.map((option, index) => (index === optionIndex ? { ...option, imageAsset: fileAsset } : option))
    setSaving(true)
    setError('')
    setSuccess('')
    try {
      await updateQuestion(getEntityId(question), buildQuestionUpdatePayload(question, nextOptions))
      setSuccess(`Đã cập nhật image cho ${question?.code || ''} / option ${currentOptions[optionIndex]?.label || optionIndex + 1}`)
      setReloadTick((prev) => prev + 1)
    } catch (requestError) {
      setError(getApiMessage(requestError, 'Không cập nhật được image của option'))
    } finally {
      setSaving(false)
      setPickerState({ mode: '', stimulus: null, question: null, optionIndex: -1 })
    }
  }

  function renderSummaryBadge(label, ready, total, color = 'secondary') {
    return <CBadge color={color}>{`${label} ${ready}/${total}`}</CBadge>
  }

  function renderPartStatus(partSummary) {
    return (
      <div className='d-flex gap-2 flex-wrap mb-3'>
        {renderSummaryBadge('Câu hỏi', partSummary.questions.ready, partSummary.questions.total, 'secondary')}
        {renderSummaryBadge('Đáp án', partSummary.answers.ready, partSummary.answers.total, partSummary.answers.ready === partSummary.answers.total ? 'success' : 'warning')}
        {renderSummaryBadge('Ảnh', partSummary.images.ready, partSummary.images.total, partSummary.images.ready === partSummary.images.total ? 'success' : 'warning')}
        {renderSummaryBadge('Audio', partSummary.audio.ready, partSummary.audio.total, partSummary.audio.ready === partSummary.audio.total ? 'success' : 'warning')}
        <CBadge color={partSummary.brokenRefs === 0 ? 'success' : 'danger'}>{`Broken refs ${partSummary.brokenRefs}`}</CBadge>
      </div>
    )
  }

  function renderStimulusMediaActions(stimulus) {
    return (
      <div className='d-grid gap-3 mt-3'>
        {stimulusNeedsImage(stimulus) ? (
          <div className='border rounded-3 p-3'>
            <div className='fw-semibold mb-1'>Image</div>
            <div className='small text-body-secondary mb-2'>{stimulus?.imageAsset ? stimulus.imageAsset.originalName || stimulus.imageAsset.fileName || 'Đã gắn image' : 'Chưa có file'}</div>
            <div className='d-flex gap-2 flex-wrap'>
              <CButton size='sm' color='secondary' variant='outline' onClick={() => setPickerState({ mode: 'stimulus-image', stimulus, question: null, optionIndex: -1 })} disabled={saving}>Chọn file / Upload</CButton>
            </div>
          </div>
        ) : null}
        {stimulusNeedsAudio(stimulus) ? (
          <div className='border rounded-3 p-3'>
            <div className='fw-semibold mb-1'>Audio</div>
            <div className='small text-body-secondary mb-2'>{stimulus?.audioAsset ? stimulus.audioAsset.originalName || stimulus.audioAsset.fileName || 'Đã gắn audio' : 'Chưa có file'}</div>
            <div className='d-flex gap-2 flex-wrap'>
              <CButton size='sm' color='secondary' variant='outline' onClick={() => setPickerState({ mode: 'stimulus-audio', stimulus, question: null, optionIndex: -1 })} disabled={saving}>Chọn file / Upload</CButton>
            </div>
          </div>
        ) : null}
      </div>
    )
  }

  function renderQuestionStructure(question) {
    return (
      <div key={getEntityId(question) || question.code} className='border rounded-3 p-3 mb-3'>
        <div className='d-flex justify-content-between align-items-start gap-2 flex-wrap'>
          <div>
            <div className='fw-semibold'>{question.code || '-'}</div>
            <div className='small text-body-secondary'>{getQuestionTypeLabel(question.type)}</div>
          </div>
          <CBadge color={getStatusBadgeColor(question.questionStatus)}>{question.questionStatus || '-'}</CBadge>
        </div>
        <div className='mt-2'>{truncateText(question.questionText, 220)}</div>
        <div className='small text-body-secondary mt-2'>{`Kỹ năng: ${normalizeArray(question.skills).map((item) => item?.title || item?.code).filter(Boolean).join(', ') || '-'} • Stimulus: ${question?.stimulus?.code || 'Không có'}`}</div>
        <div className='small text-body-secondary mt-1'>{`Đáp án: ${questionHasAnswer(question) ? 'Đã có' : 'Thiếu'}${!isChoiceQuestion(question.type) && question?.correctAnswer ? ` • ${String(question.correctAnswer)}` : ''}`}</div>
        {isChoiceQuestion(question.type) && normalizeArray(question.options).length > 0 ? (
          <div className='d-grid gap-2 mt-3'>
            {question.options.map((option, optionIndex) => (
              <div key={`${question.code}-${option.label}-${optionIndex}`} className='border rounded-3 p-3'>
                <div className='d-flex justify-content-between align-items-start gap-2 flex-wrap'>
                  <div>
                    <div className='fw-semibold'>{`${option.label || optionIndex + 1} ${option.isCorrect ? '• đúng' : ''}`}</div>
                    <div className='small text-body-secondary'>{stripHtml(option.content) || option.value || '-'}</div>
                  </div>
                  {optionNeedsImage(option) ? (
                    <div className='text-end'>
                      <div className='small text-body-secondary mb-2'>{option?.imageAsset ? option.imageAsset.originalName || option.imageAsset.fileName || 'Đã gắn image' : 'Missing image'}</div>
                      <CButton size='sm' color='secondary' variant='outline' onClick={() => setPickerState({ mode: 'option-image', stimulus: null, question, optionIndex })} disabled={saving}>Attach</CButton>
                    </div>
                  ) : <div className='small text-body-secondary'>Không yêu cầu image</div>}
                </div>
              </div>
            ))}
          </div>
        ) : null}
      </div>
    )
  }

  function renderStructureView(sourceSet) {
    return sourceSet.papers.map((paper) => (
      <details key={`${sourceSet.code}-${paper.code}`} open className='mb-3 border rounded-3 p-3 bg-body-tertiary'>
        <summary className='fw-semibold'>{paper.title}</summary>
        <div className='mt-3'>
          {paper.parts.map((part) => {
            const partSummary = summarizePart(part)
            return (
              <details key={`${paper.code}-${part.shortLabel}`} open className='mb-3 border rounded-3 p-3 bg-white'>
                <summary className='fw-semibold'>{part.title}</summary>
                <div className='mt-3'>
                  {renderPartStatus(partSummary)}
                  {part.stimuli.map((stimulus) => (
                    <div key={getEntityId(stimulus) || stimulus.code} className='mb-3'>
                      <StimulusPreview stimulus={stimulus} />
                      {renderStimulusMediaActions(stimulus)}
                    </div>
                  ))}
                  {part.questions.map(renderQuestionStructure)}
                </div>
              </details>
            )
          })}
        </div>
      </details>
    ))
  }

  function renderPreviewQuestion(question) {
    const previewQuestion = showAnswers || !isChoiceQuestion(question?.type)
      ? question
      : { ...question, options: normalizeArray(question?.options).map((option) => ({ ...option, isCorrect: false })) }

    return (
      <div key={getEntityId(question) || question.code} className='mb-4'>
        <QuestionPreview question={previewQuestion} />
        {!isChoiceQuestion(question?.type) && showAnswers && question?.correctAnswer !== null && question?.correctAnswer !== undefined && normalizeText(question?.correctAnswer) !== '' ? (
          <div className='border border-success rounded-3 p-3 bg-success-subtle mt-2'>
            <div className='fw-semibold'>Đáp án đúng</div>
            <div>{String(question.correctAnswer)}</div>
          </div>
        ) : null}
      </div>
    )
  }

  function renderPreviewView(sourceSet) {
    return sourceSet.papers.map((paper) => (
      <CCard key={`${sourceSet.code}-${paper.code}`} className='mb-4'>
        <CCardHeader><strong>{paper.title}</strong></CCardHeader>
        <CCardBody>
          {paper.parts.map((part) => (
            <div key={`${paper.code}-${part.shortLabel}`} className='mb-4'>
              <div className='fw-semibold mb-3'>{part.title}</div>
              {part.stimuli.map((stimulus) => <div key={getEntityId(stimulus) || stimulus.code} className='mb-3'><StimulusPreview stimulus={stimulus} /></div>)}
              {part.questions.map(renderPreviewQuestion)}
            </div>
          ))}
        </CCardBody>
      </CCard>
    ))
  }

  return (
    <>
      {success ? <CAlert color='success'>{success}</CAlert> : null}
      {error ? <CAlert color='danger'>{error}</CAlert> : null}

      <CCard className='mb-4 ai-card'>
        <CCardHeader><strong>Bộ lọc</strong></CCardHeader>
        <CCardBody>
          <CRow className='g-3 align-items-end'>
            <CCol md={4}><CFormInput label='Từ khóa' value={qDraft} onChange={(event) => setQDraft(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') { setFilters((prev) => ({ ...prev, q: normalizeText(qDraft) })); setPage(1) } }} placeholder='Tìm theo code, tên bộ, nguồn...' /></CCol>
            <CCol md={2}><CFormLabel>Nguồn</CFormLabel><CFormSelect value={filters.source} onChange={(event) => { setFilters((prev) => ({ ...prev, source: event.target.value })); setPage(1) }}><option value=''>Tất cả</option>{sourceOptions.map((item) => <option key={item} value={item}>{item}</option>)}</CFormSelect></CCol>
            <CCol md={2}><CFormLabel>Trạng thái</CFormLabel><CFormSelect value={filters.status} onChange={(event) => { setFilters((prev) => ({ ...prev, status: event.target.value })); setPage(1) }}><option value=''>Tất cả</option><option value='draft'>draft</option><option value='active'>active</option></CFormSelect></CCol>
            <CCol md={2}><CFormLabel>Tình trạng dữ liệu</CFormLabel><CFormSelect value={filters.dataCondition} onChange={(event) => { setFilters((prev) => ({ ...prev, dataCondition: event.target.value })); setPage(1) }}><option value=''>Tất cả</option><option value='missing_answers'>Thiếu đáp án</option><option value='missing_images'>Thiếu ảnh</option><option value='missing_audio'>Thiếu audio</option><option value='broken_refs'>Broken refs</option><option value='complete'>Đầy đủ</option></CFormSelect></CCol>
            <CCol md={2} className='d-flex gap-2'>
              <CButton color='primary' onClick={() => { setFilters((prev) => ({ ...prev, q: normalizeText(qDraft) })); setPage(1) }} disabled={loading}>Search</CButton>
              <CButton color='secondary' variant='outline' onClick={() => { setQDraft(''); setFilters({ q: '', source: '', status: '', dataCondition: '' }); setPage(1) }} disabled={loading}>Đặt lại</CButton>
            </CCol>
          </CRow>
        </CCardBody>
      </CCard>

      <CCard className='mb-4 ai-card'>
        <CCardHeader className='d-flex align-items-center justify-content-between gap-2 flex-wrap'>
          <div>
            <strong>Bộ câu hỏi</strong>
            <CBadge color='secondary' className='ms-2'>{filteredSourceSets.length}</CBadge>
          </div>
        </CCardHeader>
        <CCardBody>
          {loading ? (
            <div className='d-flex align-items-center gap-2 py-3'><CSpinner size='sm' /><span>Đang tải bộ câu hỏi...</span></div>
          ) : (
            <>
              <CTable hover responsive align='middle' className='ai-table'>
                <CTableHead>
                  <CTableRow>
                    <CTableHeaderCell>Code</CTableHeaderCell>
                    <CTableHeaderCell>Tên bộ</CTableHeaderCell>
                    <CTableHeaderCell>Nguồn</CTableHeaderCell>
                    <CTableHeaderCell>Số câu</CTableHeaderCell>
                    <CTableHeaderCell>Số stimulus</CTableHeaderCell>
                    <CTableHeaderCell>Đáp án</CTableHeaderCell>
                    <CTableHeaderCell>Ảnh</CTableHeaderCell>
                    <CTableHeaderCell>Audio</CTableHeaderCell>
                    <CTableHeaderCell>Status</CTableHeaderCell>
                    <CTableHeaderCell>Hành động</CTableHeaderCell>
                  </CTableRow>
                </CTableHead>
                <CTableBody>
                  {pagedSourceSets.length === 0 ? (
                    <CTableRow><CTableDataCell colSpan={10} className='text-center text-body-secondary'>Không có bộ câu hỏi phù hợp bộ lọc hiện tại.</CTableDataCell></CTableRow>
                  ) : pagedSourceSets.map((item) => (
                    <CTableRow key={item.code} active={item.code === selectedSourceSet?.code}>
                      <CTableDataCell>{item.code}</CTableDataCell>
                      <CTableDataCell>{item.title}</CTableDataCell>
                      <CTableDataCell>{item.source}</CTableDataCell>
                      <CTableDataCell>{item.summary.questions.total}</CTableDataCell>
                      <CTableDataCell>{item.summary.stimuli.total}</CTableDataCell>
                      <CTableDataCell>{`${item.summary.answers.ready}/${item.summary.answers.total}`}</CTableDataCell>
                      <CTableDataCell>{`${item.summary.images.ready}/${item.summary.images.total}`}</CTableDataCell>
                      <CTableDataCell>{`${item.summary.audio.ready}/${item.summary.audio.total}`}</CTableDataCell>
                      <CTableDataCell><CBadge color={getStatusBadgeColor(item.summary.status)}>{item.summary.status}</CBadge></CTableDataCell>
                      <CTableDataCell><CButton size='sm' color='info' variant='outline' onClick={() => setSelectedSourceSetCode(item.code)}>Xem</CButton></CTableDataCell>
                    </CTableRow>
                  ))}
                </CTableBody>
              </CTable>

              <div className='d-flex flex-wrap justify-content-between align-items-center gap-2 mt-3'>
                <div className='small text-body-secondary'>{filteredSourceSets.length > 0 ? `${(safePage - 1) * pageSize + 1}–${Math.min(safePage * pageSize, filteredSourceSets.length)}/${filteredSourceSets.length}` : '0'}</div>
                <div className='d-flex align-items-center gap-2'>
                  <CFormSelect value={pageSize} onChange={(event) => { setPageSize(Number(event.target.value || 10)); setPage(1) }} style={{ width: 110 }}>
                    {[10, 20, 50].map((size) => <option key={size} value={size}>{size}/trang</option>)}
                  </CFormSelect>
                  <CPagination className='mb-0'>
                    <CPaginationItem disabled={safePage <= 1} onClick={() => setPage((prev) => Math.max(1, prev - 1))}>Trước</CPaginationItem>
                    {pages.map((item, index) => item === '...' ? <CPaginationItem key={`ellipsis-${index}`} disabled>…</CPaginationItem> : <CPaginationItem key={item} active={item === safePage} onClick={() => setPage(item)}>{item}</CPaginationItem>)}
                    <CPaginationItem disabled={safePage >= pageCount} onClick={() => setPage((prev) => Math.min(pageCount, prev + 1))}>Sau</CPaginationItem>
                  </CPagination>
                </div>
              </div>
            </>
          )}
        </CCardBody>
      </CCard>

      {selectedSourceSet ? (
        <CCard className='ai-card'>
          <CCardHeader className='d-flex justify-content-between align-items-start gap-3 flex-wrap'>
            <div>
              <div className='fw-semibold'>{selectedSourceSet.title}</div>
              <div className='small text-body-secondary'>{selectedSourceSet.code}</div>
            </div>
            <div className='d-flex gap-2 flex-wrap'>
              {renderSummaryBadge('Questions', selectedSourceSet.summary.questions.ready, selectedSourceSet.summary.questions.total, 'secondary')}
              {renderSummaryBadge('Stimuli', selectedSourceSet.summary.stimuli.ready, selectedSourceSet.summary.stimuli.total, 'secondary')}
              {renderSummaryBadge('Answers', selectedSourceSet.summary.answers.ready, selectedSourceSet.summary.answers.total, selectedSourceSet.summary.answers.ready === selectedSourceSet.summary.answers.total ? 'success' : 'warning')}
              {renderSummaryBadge('Images', selectedSourceSet.summary.images.ready, selectedSourceSet.summary.images.total, selectedSourceSet.summary.images.ready === selectedSourceSet.summary.images.total ? 'success' : 'warning')}
              {renderSummaryBadge('Audio', selectedSourceSet.summary.audio.ready, selectedSourceSet.summary.audio.total, selectedSourceSet.summary.audio.ready === selectedSourceSet.summary.audio.total ? 'success' : 'warning')}
              <CBadge color={selectedSourceSet.summary.brokenRefs === 0 ? 'success' : 'danger'}>{`Broken refs ${selectedSourceSet.summary.brokenRefs}`}</CBadge>
            </div>
          </CCardHeader>
          <CCardBody>
            <div className='d-flex justify-content-between align-items-center gap-2 flex-wrap mb-4'>
              <div className='d-flex gap-2'>
                <CButton color={viewMode === 'structure' ? 'primary' : 'secondary'} variant={viewMode === 'structure' ? undefined : 'outline'} onClick={() => setViewMode('structure')}>Cấu trúc</CButton>
                <CButton color={viewMode === 'preview' ? 'primary' : 'secondary'} variant={viewMode === 'preview' ? undefined : 'outline'} onClick={() => setViewMode('preview')}>Preview</CButton>
              </div>
              <CFormCheck id='source-set-show-answers' label='Hiện đáp án đúng' checked={showAnswers} onChange={(event) => setShowAnswers(event.target.checked)} />
            </div>
            {viewMode === 'structure' ? renderStructureView(selectedSourceSet) : renderPreviewView(selectedSourceSet)}
          </CCardBody>
        </CCard>
      ) : null}

      <FileAssetPickerModal
        visible={Boolean(pickerState.mode)}
        acceptedKind={pickerState.mode === 'stimulus-audio' ? 'audio' : 'image'}
        title={pickerState.mode === 'stimulus-audio' ? 'Chọn audio asset' : 'Chọn image asset'}
        moduleKey='question-bank'
        onClose={() => setPickerState({ mode: '', stimulus: null, question: null, optionIndex: -1 })}
        onSelect={(fileAsset) => {
          if (pickerState.mode === 'stimulus-audio') return handleAttachStimulusAsset(pickerState.stimulus, 'audioAsset', fileAsset)
          if (pickerState.mode === 'stimulus-image') return handleAttachStimulusAsset(pickerState.stimulus, 'imageAsset', fileAsset)
          if (pickerState.mode === 'option-image') return handleAttachOptionImage(pickerState.question, pickerState.optionIndex, fileAsset)
          return null
        }}
      />
    </>
  )
}