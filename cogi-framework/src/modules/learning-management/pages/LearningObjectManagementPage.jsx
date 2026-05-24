import { useEffect, useMemo, useState } from 'react'
import {
  CAlert,
  CBadge,
  CButton,
  CCard,
  CCardBody,
  CCardHeader,
  CCol,
  CFormInput,
  CFormLabel,
  CFormSelect,
  CFormTextarea,
  CModal,
  CModalBody,
  CModalFooter,
  CModalHeader,
  CModalTitle,
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
import {
  attachQuestionToLearningObject,
  createContentBlock,
  createFormula,
  createGrade,
  createKnowledgeNode,
  createLearningObject,
  createQuestion,
  createSkill,
  createSubject,
  createVisualAsset,
  deleteContentBlock,
  deleteLearningObject,
  detachQuestionFromLearningObject,
  getContentBlocks,
  getFormulas,
  getGrades,
  getKnowledgeNodes,
  getLearningManagementBootstrap,
  getLearningObject,
  getLearningObjects,
  getQuestions,
  getSkills,
  getSubjects,
  getVisualAssets,
  updateContentBlock,
  updateLearningObject,
  uploadMedia,
} from '../services/learningObjectApi'

function getApiMessage(error, fallback) {
  return error?.response?.data?.error?.message || error?.response?.data?.message || error?.message || fallback
}

function buildPages(currentPage, pageCount) {
  const maxButtons = 7
  const pages = []

  if (pageCount <= maxButtons) {
    for (let index = 1; index <= pageCount; index += 1) pages.push(index)
    return pages
  }

  const left = Math.max(1, currentPage - 2)
  const right = Math.min(pageCount, currentPage + 2)

  pages.push(1)
  if (left > 2) pages.push('...')
  for (let index = left; index <= right; index += 1) {
    if (index !== 1 && index !== pageCount) pages.push(index)
  }
  if (right < pageCount - 1) pages.push('...')
  pages.push(pageCount)

  return pages
}

function toSelectValue(value) {
  if (value === null || value === undefined) return ''
  return String(value)
}

function getEntityId(entity) {
  if (!entity) return ''
  return entity.documentId || entity.id || ''
}

function joinTitles(items = []) {
  return (Array.isArray(items) ? items : []).map((item) => item?.title || item?.name || item?.code || '').filter(Boolean).join(', ')
}

function emptyFilters() {
  return {
    q: '',
    subjectId: '',
    gradeId: '',
    knowledgeNodeId: '',
    difficulty: '',
    learningObjectStatus: '',
  }
}

function emptyLearningObjectForm() {
  return {
    code: '',
    title: '',
    slug: '',
    description: '',
    version: '',
    subject: '',
    grade: '',
    knowledgeNodes: [],
    difficulty: '',
    estimatedMinutes: '',
    learningObjectives: '',
    prerequisites: [],
    skills: [],
    formulas: [],
    visualAssets: [],
    tags: '',
    learningObjectStatus: 'draft',
  }
}

function emptySubjectForm() {
  return {
    code: '',
    title: '',
    description: '',
    subjectStatus: 'active',
  }
}

function emptyGradeForm() {
  return {
    code: '',
    title: '',
    order: '0',
    description: '',
    gradeStatus: 'active',
  }
}

function emptyKnowledgeNodeForm() {
  return {
    code: '',
    title: '',
    description: '',
    subject: '',
    grade: '',
    parent: '',
    order: '0',
    level: '0',
    knowledgeNodeStatus: 'active',
  }
}

function emptySkillForm() {
  return {
    code: '',
    title: '',
    description: '',
    subject: '',
    grade: '',
    knowledgeNode: '',
    level: 'remember',
    parentSkill: '',
    skillStatus: 'active',
  }
}

function emptyFormulaForm() {
  return {
    code: '',
    title: '',
    description: '',
    latex: '',
    plainText: '',
    subject: '',
    grade: '',
    knowledgeNode: '',
    examples: '',
    formulaStatus: 'active',
  }
}

function emptyVisualAssetForm() {
  return {
    code: '',
    title: '',
    type: 'image',
    file: null,
    url: '',
    description: '',
    altText: '',
    subject: '',
    grade: '',
    knowledgeNode: '',
    visualAssetStatus: 'active',
  }
}

function emptyContentBlockForm(learningObjectId = '') {
  return {
    learningObject: learningObjectId,
    type: 'text',
    title: '',
    order: '0',
    content: '',
    htmlContent: '',
    media: null,
    formula: '',
    question: '',
    visualAsset: '',
    config: '',
    contentBlockStatus: 'active',
  }
}

function createEmptyQuestionOption(index = 0) {
  return {
    label: '',
    value: '',
    content: '',
    isCorrect: false,
    order: String(index),
    explanation: '',
    clientKey: `option-${Date.now()}-${index}`,
  }
}

function emptyQuestionForm() {
  return {
    code: '',
    title: '',
    questionText: '',
    type: 'single_choice',
    subject: '',
    grade: '',
    knowledgeNode: '',
    difficulty: '',
    skills: [],
    formulas: [],
    correctAnswer: '',
    explanation: '',
    rubric: '',
    questionStatus: 'active',
    options: [createEmptyQuestionOption(0), createEmptyQuestionOption(1)],
  }
}

function shouldShowQuestionOptions(type) {
  return ['single_choice', 'multiple_choice', 'true_false'].includes(String(type || '').toLowerCase())
}

function parseJsonOrThrow(rawValue, label) {
  const text = String(rawValue || '').trim()
  if (!text) return null
  try {
    return JSON.parse(text)
  } catch {
    throw new Error(`${label} phải là JSON hợp lệ`)
  }
}

function mapRelationIds(values = []) {
  return (Array.isArray(values) ? values : []).map((item) => getEntityId(item)).filter(Boolean)
}

function normalizeLearningObjectForm(item) {
  if (!item) return emptyLearningObjectForm()
  return {
    code: item.code || '',
    title: item.title || '',
    slug: item.slug || '',
    description: item.description || '',
    version: item.version || '',
    subject: getEntityId(item.subject),
    grade: getEntityId(item.grade),
    knowledgeNodes: mapRelationIds(item.knowledgeNodes),
    difficulty: item.difficulty || '',
    estimatedMinutes: item.estimatedMinutes ? String(item.estimatedMinutes) : '',
    learningObjectives: item.learningObjectives ? JSON.stringify(item.learningObjectives, null, 2) : '',
    prerequisites: mapRelationIds(item.prerequisites),
    skills: mapRelationIds(item.skills),
    formulas: mapRelationIds(item.formulas),
    visualAssets: mapRelationIds(item.visualAssets),
    tags: item.tags ? JSON.stringify(item.tags, null, 2) : '',
    learningObjectStatus: item.learningObjectStatus || 'draft',
  }
}

function normalizeContentBlockForm(block, learningObjectId) {
  if (!block) return emptyContentBlockForm(learningObjectId)
  return {
    learningObject: learningObjectId,
    type: block.type || 'text',
    title: block.title || '',
    order: String(block.order ?? 0),
    content: block.content || '',
    htmlContent: block.htmlContent || '',
    media: null,
    formula: getEntityId(block.formula),
    question: getEntityId(block.question),
    visualAsset: getEntityId(block.visualAsset),
    config: block.config ? JSON.stringify(block.config, null, 2) : '',
    contentBlockStatus: block.contentBlockStatus || 'active',
  }
}

export default function LearningObjectManagementPage() {
  const [bootstrapping, setBootstrapping] = useState(true)
  const [tableLoading, setTableLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [success, setSuccess] = useState('')
  const [error, setError] = useState('')

  const [bootstrap, setBootstrap] = useState(null)
  const [rows, setRows] = useState([])
  const [meta, setMeta] = useState(null)
  const [filters, setFilters] = useState(emptyFilters())
  const [draftFilters, setDraftFilters] = useState(emptyFilters())
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)

  const [showLearningObjectModal, setShowLearningObjectModal] = useState(false)
  const [editingLearningObject, setEditingLearningObject] = useState(null)
  const [learningObjectForm, setLearningObjectForm] = useState(emptyLearningObjectForm())

  const [quickModal, setQuickModal] = useState('')
  const [subjectForm, setSubjectForm] = useState(emptySubjectForm())
  const [gradeForm, setGradeForm] = useState(emptyGradeForm())
  const [knowledgeNodeForm, setKnowledgeNodeForm] = useState(emptyKnowledgeNodeForm())
  const [skillForm, setSkillForm] = useState(emptySkillForm())
  const [formulaForm, setFormulaForm] = useState(emptyFormulaForm())
  const [visualAssetForm, setVisualAssetForm] = useState(emptyVisualAssetForm())

  const [showContentModal, setShowContentModal] = useState(false)
  const [contentTarget, setContentTarget] = useState(null)
  const [contentBlocks, setContentBlocks] = useState([])
  const [editingContentBlock, setEditingContentBlock] = useState(null)
  const [contentBlockForm, setContentBlockForm] = useState(emptyContentBlockForm())

  const [showQuestionModal, setShowQuestionModal] = useState(false)
  const [questionTarget, setQuestionTarget] = useState(null)
  const [availableQuestions, setAvailableQuestions] = useState([])
  const [questionSearch, setQuestionSearch] = useState('')
  const [showCreateQuestionModal, setShowCreateQuestionModal] = useState(false)
  const [questionForm, setQuestionForm] = useState(emptyQuestionForm())

  const subjects = bootstrap?.subjects || []
  const grades = bootstrap?.grades || []
  const knowledgeNodes = bootstrap?.knowledgeNodes || []
  const skills = bootstrap?.skills || []
  const formulas = bootstrap?.formulas || []
  const visualAssets = bootstrap?.visualAssets || []
  const learningObjectStatuses = bootstrap?.learningObjectStatuses || []
  const contentBlockTypes = bootstrap?.contentBlockTypes || []
  const contentBlockStatuses = bootstrap?.contentBlockStatuses || []
  const questionTypes = bootstrap?.questionTypes || []
  const questionStatuses = bootstrap?.questionStatuses || []
  const pages = useMemo(() => buildPages(page, meta?.pagination?.pageCount || 1), [page, meta])

  useEffect(() => {
    if (!success) return undefined
    const timer = window.setTimeout(() => setSuccess(''), 3000)
    return () => window.clearTimeout(timer)
  }, [success])

  useEffect(() => {
    async function bootstrapData() {
      setBootstrapping(true)
      setError('')
      try {
        const data = await getLearningManagementBootstrap()
        setBootstrap(data)
      } catch (requestError) {
        setError(getApiMessage(requestError, 'Không thể tải dữ liệu khởi tạo Learning Object'))
      } finally {
        setBootstrapping(false)
      }
    }

    bootstrapData()
  }, [])

  useEffect(() => {
    loadRows()
  }, [page, pageSize, filters])

  async function loadRows() {
    setTableLoading(true)
    setError('')
    try {
      const response = await getLearningObjects({ ...filters, page, pageSize })
      setRows(Array.isArray(response?.data) ? response.data : [])
      setMeta(response?.meta || null)
    } catch (requestError) {
      setError(getApiMessage(requestError, 'Không thể tải danh sách Learning Object'))
    } finally {
      setTableLoading(false)
    }
  }

  async function reloadBootstrap(selectedType = '', selectedId = '') {
    const data = await getLearningManagementBootstrap()
    setBootstrap(data)

    if (selectedType === 'subject') {
      setLearningObjectForm((prev) => ({ ...prev, subject: selectedId || prev.subject }))
    }
    if (selectedType === 'grade') {
      setLearningObjectForm((prev) => ({ ...prev, grade: selectedId || prev.grade }))
    }
    if (selectedType === 'knowledgeNode' && selectedId) {
      setLearningObjectForm((prev) => ({ ...prev, knowledgeNodes: [...new Set([...(prev.knowledgeNodes || []), selectedId])] }))
    }
    if (selectedType === 'skill' && selectedId) {
      setLearningObjectForm((prev) => ({ ...prev, skills: [...new Set([...(prev.skills || []), selectedId])] }))
    }
    if (selectedType === 'formula' && selectedId) {
      setLearningObjectForm((prev) => ({ ...prev, formulas: [...new Set([...(prev.formulas || []), selectedId])] }))
      setContentBlockForm((prev) => ({ ...prev, formula: selectedId }))
    }
    if (selectedType === 'visualAsset' && selectedId) {
      setLearningObjectForm((prev) => ({ ...prev, visualAssets: [...new Set([...(prev.visualAssets || []), selectedId])] }))
      setContentBlockForm((prev) => ({ ...prev, visualAsset: selectedId }))
    }
  }

  function applyFilters() {
    setFilters({ ...draftFilters })
    setPage(1)
  }

  function resetFilters() {
    const nextFilters = emptyFilters()
    setDraftFilters(nextFilters)
    setFilters(nextFilters)
    setPage(1)
  }

  function openCreateLearningObjectModal() {
    setEditingLearningObject(null)
    setLearningObjectForm(emptyLearningObjectForm())
    setShowLearningObjectModal(true)
  }

  async function openEditLearningObjectModal(item) {
    setSaving(true)
    setError('')
    try {
      const detail = await getLearningObject(getEntityId(item))
      setEditingLearningObject(detail)
      setLearningObjectForm(normalizeLearningObjectForm(detail))
      setShowLearningObjectModal(true)
    } catch (requestError) {
      setError(getApiMessage(requestError, 'Không thể tải Learning Object'))
    } finally {
      setSaving(false)
    }
  }

  function closeLearningObjectModal() {
    setShowLearningObjectModal(false)
    setEditingLearningObject(null)
    setLearningObjectForm(emptyLearningObjectForm())
  }

  function updateLearningObjectField(key, value) {
    setLearningObjectForm((prev) => ({ ...prev, [key]: value }))
  }

  function handleMultiSelect(event, key) {
    const values = Array.from(event.target.selectedOptions || []).map((option) => option.value)
    updateLearningObjectField(key, values)
  }

  async function handleSubmitLearningObject() {
    if (!String(learningObjectForm.code).trim()) {
      setError('Code là bắt buộc')
      return
    }
    if (!String(learningObjectForm.title).trim()) {
      setError('Tiêu đề là bắt buộc')
      return
    }

    let learningObjectives = null
    let tags = null
    try {
      learningObjectives = parseJsonOrThrow(learningObjectForm.learningObjectives, 'Learning Objectives')
      tags = parseJsonOrThrow(learningObjectForm.tags, 'Tags')
    } catch (parseError) {
      setError(parseError.message)
      return
    }

    const payload = {
      code: learningObjectForm.code,
      title: learningObjectForm.title,
      slug: learningObjectForm.slug || undefined,
      description: learningObjectForm.description,
      version: learningObjectForm.version,
      subject: learningObjectForm.subject || null,
      grade: learningObjectForm.grade || null,
      knowledgeNodes: learningObjectForm.knowledgeNodes,
      difficulty: learningObjectForm.difficulty || null,
      estimatedMinutes: learningObjectForm.estimatedMinutes === '' ? null : Number(learningObjectForm.estimatedMinutes),
      learningObjectives,
      prerequisites: learningObjectForm.prerequisites,
      skills: learningObjectForm.skills,
      formulas: learningObjectForm.formulas,
      visualAssets: learningObjectForm.visualAssets,
      tags,
      learningObjectStatus: learningObjectForm.learningObjectStatus,
    }

    setSaving(true)
    setError('')
    setSuccess('')
    try {
      if (editingLearningObject) {
        await updateLearningObject(getEntityId(editingLearningObject), payload)
        setSuccess('Cập nhật Learning Object thành công')
      } else {
        await createLearningObject(payload)
        setSuccess('Tạo Learning Object thành công')
      }
      closeLearningObjectModal()
      await loadRows()
    } catch (requestError) {
      setError(getApiMessage(requestError, 'Không thể lưu Learning Object'))
    } finally {
      setSaving(false)
    }
  }

  async function handleDeleteLearningObject(item) {
    if (!window.confirm(`Bạn chắc chắn muốn xóa Learning Object ${item?.title || item?.code || ''}?`)) return

    setSaving(true)
    setError('')
    setSuccess('')
    try {
      await deleteLearningObject(getEntityId(item))
      setSuccess('Đã xóa Learning Object')
      await loadRows()
    } catch (requestError) {
      setError(getApiMessage(requestError, 'Không thể xóa Learning Object'))
    } finally {
      setSaving(false)
    }
  }

  function openQuickModal(type) {
    setQuickModal(type)
    setError('')
    if (type === 'subject') setSubjectForm(emptySubjectForm())
    if (type === 'grade') setGradeForm(emptyGradeForm())
    if (type === 'knowledgeNode') setKnowledgeNodeForm(emptyKnowledgeNodeForm())
    if (type === 'skill') setSkillForm(emptySkillForm())
    if (type === 'formula') setFormulaForm(emptyFormulaForm())
    if (type === 'visualAsset') setVisualAssetForm(emptyVisualAssetForm())
  }

  function closeQuickModal() {
    setQuickModal('')
  }

  async function handleSubmitQuickModal() {
    setSaving(true)
    setError('')
    try {
      let created = null
      let selectedType = ''
      if (quickModal === 'subject') {
        if (!subjectForm.code.trim() || !subjectForm.title.trim()) throw new Error('Subject cần code và title')
        created = await createSubject(subjectForm)
        selectedType = 'subject'
      }
      if (quickModal === 'grade') {
        if (!gradeForm.code.trim() || !gradeForm.title.trim()) throw new Error('Grade cần code và title')
        created = await createGrade({ ...gradeForm, order: Number(gradeForm.order || 0) })
        selectedType = 'grade'
      }
      if (quickModal === 'knowledgeNode') {
        if (!knowledgeNodeForm.code.trim() || !knowledgeNodeForm.title.trim()) throw new Error('Knowledge Node cần code và title')
        created = await createKnowledgeNode({
          ...knowledgeNodeForm,
          order: Number(knowledgeNodeForm.order || 0),
          level: Number(knowledgeNodeForm.level || 0),
        })
        selectedType = 'knowledgeNode'
      }
      if (quickModal === 'skill') {
        if (!skillForm.code.trim() || !skillForm.title.trim()) throw new Error('Skill cần code và title')
        created = await createSkill(skillForm)
        selectedType = 'skill'
      }
      if (quickModal === 'formula') {
        if (!formulaForm.code.trim() || !formulaForm.title.trim()) throw new Error('Formula cần code và title')
        created = await createFormula(formulaForm)
        selectedType = 'formula'
      }
      if (quickModal === 'visualAsset') {
        if (!visualAssetForm.title.trim()) throw new Error('Visual Asset cần title')
        let uploaded = null
        if (visualAssetForm.file) {
          uploaded = await uploadMedia(visualAssetForm.file)
        }
        created = await createVisualAsset({
          ...visualAssetForm,
          file: uploaded?.id || uploaded?.documentId || null,
        })
        selectedType = 'visualAsset'
      }

      await reloadBootstrap(selectedType, getEntityId(created))
      closeQuickModal()
      setSuccess('Tạo dữ liệu phụ thành công')
    } catch (requestError) {
      setError(requestError?.message || getApiMessage(requestError, 'Không thể tạo dữ liệu phụ'))
    } finally {
      setSaving(false)
    }
  }

  async function openContentManager(item) {
    setSaving(true)
    setError('')
    try {
      const data = await getContentBlocks(getEntityId(item))
      setContentTarget(data?.learningObject || item)
      setContentBlocks(Array.isArray(data?.blocks) ? data.blocks : [])
      setEditingContentBlock(null)
      setContentBlockForm(emptyContentBlockForm(getEntityId(item)))
      setShowContentModal(true)
    } catch (requestError) {
      setError(getApiMessage(requestError, 'Không thể tải Content Block'))
    } finally {
      setSaving(false)
    }
  }

  function closeContentManager() {
    setShowContentModal(false)
    setContentTarget(null)
    setContentBlocks([])
    setEditingContentBlock(null)
    setContentBlockForm(emptyContentBlockForm())
  }

  function openCreateContentBlock() {
    setEditingContentBlock(null)
    setContentBlockForm(emptyContentBlockForm(getEntityId(contentTarget)))
  }

  function openEditContentBlock(block) {
    setEditingContentBlock(block)
    setContentBlockForm(normalizeContentBlockForm(block, getEntityId(contentTarget)))
  }

  async function refreshContentBlocks() {
    if (!contentTarget) return
    const data = await getContentBlocks(getEntityId(contentTarget))
    setContentTarget(data?.learningObject || contentTarget)
    setContentBlocks(Array.isArray(data?.blocks) ? data.blocks : [])
  }

  async function handleSaveContentBlock() {
    try {
      const config = parseJsonOrThrow(contentBlockForm.config, 'Config')
      let uploadedMedia = null
      if (contentBlockForm.media instanceof File) {
        uploadedMedia = await uploadMedia(contentBlockForm.media)
      }

      const payload = {
        learningObject: contentBlockForm.learningObject,
        type: contentBlockForm.type,
        title: contentBlockForm.title,
        order: Number(contentBlockForm.order || 0),
        content: contentBlockForm.content,
        htmlContent: contentBlockForm.htmlContent,
        media: uploadedMedia?.id || uploadedMedia?.documentId || null,
        formula: contentBlockForm.formula || null,
        question: contentBlockForm.question || null,
        visualAsset: contentBlockForm.visualAsset || null,
        config,
        contentBlockStatus: contentBlockForm.contentBlockStatus,
      }

      setSaving(true)
      setError('')
      if (editingContentBlock) {
        await updateContentBlock(getEntityId(editingContentBlock), payload)
        setSuccess('Cập nhật Content Block thành công')
      } else {
        await createContentBlock(payload)
        setSuccess('Tạo Content Block thành công')
      }
      await refreshContentBlocks()
      openCreateContentBlock()
    } catch (requestError) {
      setError(requestError?.message || getApiMessage(requestError, 'Không thể lưu Content Block'))
    } finally {
      setSaving(false)
    }
  }

  async function handleDeleteContentBlock(block) {
    if (!window.confirm('Bạn chắc chắn muốn xóa block này?')) return
    setSaving(true)
    setError('')
    try {
      await deleteContentBlock(getEntityId(block))
      setSuccess('Đã xóa Content Block')
      await refreshContentBlocks()
    } catch (requestError) {
      setError(getApiMessage(requestError, 'Không thể xóa Content Block'))
    } finally {
      setSaving(false)
    }
  }

  function moveContentBlock(block, direction) {
    const sorted = [...contentBlocks].sort((a, b) => a.order - b.order)
    const index = sorted.findIndex((item) => getEntityId(item) === getEntityId(block))
    const swapIndex = direction === 'up' ? index - 1 : index + 1
    if (index < 0 || swapIndex < 0 || swapIndex >= sorted.length) return

    const current = sorted[index]
    const target = sorted[swapIndex]
    handleSwapContentBlockOrder(current, target)
  }

  async function handleSwapContentBlockOrder(first, second) {
    setSaving(true)
    setError('')
    try {
      await updateContentBlock(getEntityId(first), { ...normalizeContentBlockForm(first, getEntityId(contentTarget)), order: second.order })
      await updateContentBlock(getEntityId(second), { ...normalizeContentBlockForm(second, getEntityId(contentTarget)), order: first.order })
      await refreshContentBlocks()
      setSuccess('Đã cập nhật thứ tự block')
    } catch (requestError) {
      setError(getApiMessage(requestError, 'Không thể cập nhật thứ tự Content Block'))
    } finally {
      setSaving(false)
    }
  }

  async function openQuestionManager(item) {
    setSaving(true)
    setError('')
    try {
      const detail = await getLearningObject(getEntityId(item))
      const questions = await getQuestions({ learningObjectId: getEntityId(item), q: questionSearch })
      setQuestionTarget(detail)
      setAvailableQuestions(Array.isArray(questions) ? questions : [])
      setShowQuestionModal(true)
    } catch (requestError) {
      setError(getApiMessage(requestError, 'Không thể tải danh sách câu hỏi'))
    } finally {
      setSaving(false)
    }
  }

  function closeQuestionManager() {
    setShowQuestionModal(false)
    setQuestionTarget(null)
    setAvailableQuestions([])
    setQuestionSearch('')
    setShowCreateQuestionModal(false)
    setQuestionForm(emptyQuestionForm())
  }

  async function refreshQuestions() {
    if (!questionTarget) return
    const [detail, questions] = await Promise.all([
      getLearningObject(getEntityId(questionTarget)),
      getQuestions({ q: questionSearch }),
    ])
    setQuestionTarget(detail)
    setAvailableQuestions(Array.isArray(questions) ? questions : [])
  }

  async function handleAttachQuestion(questionId) {
    if (!questionTarget) return
    setSaving(true)
    setError('')
    try {
      await attachQuestionToLearningObject(getEntityId(questionTarget), questionId)
      await refreshQuestions()
      setSuccess('Đã gắn câu hỏi vào Learning Object')
    } catch (requestError) {
      setError(getApiMessage(requestError, 'Không thể gắn câu hỏi'))
    } finally {
      setSaving(false)
    }
  }

  async function handleDetachQuestion(questionId) {
    if (!questionTarget) return
    setSaving(true)
    setError('')
    try {
      await detachQuestionFromLearningObject(getEntityId(questionTarget), questionId)
      await refreshQuestions()
      setSuccess('Đã gỡ câu hỏi khỏi Learning Object')
    } catch (requestError) {
      setError(getApiMessage(requestError, 'Không thể gỡ câu hỏi'))
    } finally {
      setSaving(false)
    }
  }

  function updateQuestionOption(index, key, value) {
    setQuestionForm((prev) => ({
      ...prev,
      options: (prev.options || []).map((option, optionIndex) => (optionIndex === index ? { ...option, [key]: value } : option)),
    }))
  }

  function addQuestionOption() {
    setQuestionForm((prev) => ({
      ...prev,
      options: [...(prev.options || []), createEmptyQuestionOption(prev.options?.length || 0)],
    }))
  }

  function removeQuestionOption(index) {
    setQuestionForm((prev) => ({
      ...prev,
      options: (prev.options || []).filter((_, optionIndex) => optionIndex !== index),
    }))
  }

  async function handleCreateQuestion() {
    if (!String(questionForm.code).trim()) {
      setError('Question cần code')
      return
    }
    if (!String(questionForm.questionText).trim()) {
      setError('Question cần questionText')
      return
    }
    if (!String(questionForm.type).trim()) {
      setError('Question cần type')
      return
    }

    try {
      const correctAnswer = parseJsonOrThrow(questionForm.correctAnswer, 'Correct Answer')
      const rubric = parseJsonOrThrow(questionForm.rubric, 'Rubric')
      const payload = {
        code: questionForm.code,
        title: questionForm.title,
        questionText: questionForm.questionText,
        type: questionForm.type,
        subject: questionForm.subject || null,
        grade: questionForm.grade || null,
        knowledgeNode: questionForm.knowledgeNode || null,
        difficulty: questionForm.difficulty || null,
        skills: questionForm.skills,
        formulas: questionForm.formulas,
        correctAnswer,
        explanation: questionForm.explanation,
        rubric,
        questionStatus: questionForm.questionStatus,
        options: shouldShowQuestionOptions(questionForm.type)
          ? (questionForm.options || []).map((option, index) => ({
            label: option.label,
            value: option.value,
            content: option.content,
            isCorrect: option.isCorrect,
            order: Number(option.order || index),
            explanation: option.explanation,
          })).filter((option) => option.label || option.value || option.content)
          : [],
      }

      setSaving(true)
      setError('')
      const created = await createQuestion(payload)
      await attachQuestionToLearningObject(getEntityId(questionTarget), getEntityId(created))
      await refreshQuestions()
      setShowCreateQuestionModal(false)
      setQuestionForm(emptyQuestionForm())
      setSuccess('Đã tạo và gắn câu hỏi mới')
    } catch (requestError) {
      setError(requestError?.message || getApiMessage(requestError, 'Không thể tạo câu hỏi'))
    } finally {
      setSaving(false)
    }
  }

  const currentQuestionIds = useMemo(() => new Set((questionTarget?.questions || []).map((question) => String(getEntityId(question)))), [questionTarget])

  if (bootstrapping) {
    return (
      <div className='py-4 d-flex align-items-center gap-2'>
        <CSpinner size='sm' />
        <span>Đang tải dữ liệu Learning Object...</span>
      </div>
    )
  }

  return (
    <div className='container-fluid py-4'>
      <CCard className='border-0 shadow-sm mb-4'>
        <CCardHeader className='bg-white d-flex align-items-center justify-content-between gap-2 flex-wrap'>
          <div>
            <strong>Quản lý Learning Object</strong>
            <div className='small text-body-secondary mt-1'>Quản lý nội dung học tập, content block và câu hỏi gắn với Learning Object.</div>
          </div>
          <CButton color='primary' onClick={openCreateLearningObjectModal}>Thêm Learning Object</CButton>
        </CCardHeader>
        <CCardBody>
          {success ? <CAlert color='success'>{success}</CAlert> : null}
          {error ? <CAlert color='danger'>{error}</CAlert> : null}

          <CRow className='g-3 align-items-end'>
            <CCol md={4}>
              <CFormLabel>Từ khóa</CFormLabel>
              <CFormInput value={draftFilters.q} onChange={(event) => setDraftFilters((prev) => ({ ...prev, q: event.target.value }))} placeholder='Tìm theo code, title, description' />
            </CCol>
            <CCol md={2}>
              <CFormLabel>Subject</CFormLabel>
              <CFormSelect value={draftFilters.subjectId} onChange={(event) => setDraftFilters((prev) => ({ ...prev, subjectId: event.target.value }))}>
                <option value=''>Tất cả</option>
                {subjects.map((item) => <option key={getEntityId(item)} value={getEntityId(item)}>{item.title || item.code}</option>)}
              </CFormSelect>
            </CCol>
            <CCol md={2}>
              <CFormLabel>Grade</CFormLabel>
              <CFormSelect value={draftFilters.gradeId} onChange={(event) => setDraftFilters((prev) => ({ ...prev, gradeId: event.target.value }))}>
                <option value=''>Tất cả</option>
                {grades.map((item) => <option key={getEntityId(item)} value={getEntityId(item)}>{item.title || item.code}</option>)}
              </CFormSelect>
            </CCol>
            <CCol md={2}>
              <CFormLabel>KnowledgeNode</CFormLabel>
              <CFormSelect value={draftFilters.knowledgeNodeId} onChange={(event) => setDraftFilters((prev) => ({ ...prev, knowledgeNodeId: event.target.value }))}>
                <option value=''>Tất cả</option>
                {knowledgeNodes.map((item) => <option key={getEntityId(item)} value={getEntityId(item)}>{item.title || item.code}</option>)}
              </CFormSelect>
            </CCol>
            <CCol md={1}>
              <CFormLabel>Độ khó</CFormLabel>
              <CFormSelect value={draftFilters.difficulty} onChange={(event) => setDraftFilters((prev) => ({ ...prev, difficulty: event.target.value }))}>
                <option value=''>Tất cả</option>
                {(bootstrap?.difficulties || []).map((item) => <option key={item} value={item}>{item}</option>)}
              </CFormSelect>
            </CCol>
            <CCol md={1}>
              <CFormLabel>Trạng thái</CFormLabel>
              <CFormSelect value={draftFilters.learningObjectStatus} onChange={(event) => setDraftFilters((prev) => ({ ...prev, learningObjectStatus: event.target.value }))}>
                <option value=''>Tất cả</option>
                {learningObjectStatuses.map((item) => <option key={item} value={item}>{item}</option>)}
              </CFormSelect>
            </CCol>
            <CCol xs={12} className='d-flex gap-2'>
              <CButton color='primary' onClick={applyFilters}>Tìm kiếm</CButton>
              <CButton color='secondary' variant='outline' onClick={resetFilters}>Đặt lại</CButton>
            </CCol>
          </CRow>
        </CCardBody>
      </CCard>

      <CCard className='border-0 shadow-sm'>
        <CCardBody>
          {tableLoading ? (
            <div className='d-flex align-items-center gap-2'>
              <CSpinner size='sm' />
              <span>Đang tải danh sách...</span>
            </div>
          ) : (
            <>
              <CTable hover responsive align='middle'>
                <CTableHead>
                  <CTableRow>
                    <CTableHeaderCell>STT</CTableHeaderCell>
                    <CTableHeaderCell>Code</CTableHeaderCell>
                    <CTableHeaderCell>Tiêu đề</CTableHeaderCell>
                    <CTableHeaderCell>Môn học</CTableHeaderCell>
                    <CTableHeaderCell>Khối lớp</CTableHeaderCell>
                    <CTableHeaderCell>Chủ đề</CTableHeaderCell>
                    <CTableHeaderCell>Độ khó</CTableHeaderCell>
                    <CTableHeaderCell>Thời lượng</CTableHeaderCell>
                    <CTableHeaderCell>Trạng thái</CTableHeaderCell>
                    <CTableHeaderCell className='text-end'>Thao tác</CTableHeaderCell>
                  </CTableRow>
                </CTableHead>
                <CTableBody>
                  {rows.length === 0 ? (
                    <CTableRow>
                      <CTableDataCell colSpan={10} className='text-center py-4 text-body-secondary'>Chưa có Learning Object nào.</CTableDataCell>
                    </CTableRow>
                  ) : rows.map((item, index) => (
                    <CTableRow key={getEntityId(item)}>
                      <CTableDataCell>{(page - 1) * pageSize + index + 1}</CTableDataCell>
                      <CTableDataCell>{item.code}</CTableDataCell>
                      <CTableDataCell>
                        <div className='fw-semibold'>{item.title}</div>
                        {item.description ? <div className='small text-body-secondary'>{item.description}</div> : null}
                      </CTableDataCell>
                      <CTableDataCell>{item.subject?.title || '-'}</CTableDataCell>
                      <CTableDataCell>{item.grade?.title || '-'}</CTableDataCell>
                      <CTableDataCell>{joinTitles(item.knowledgeNodes) || '-'}</CTableDataCell>
                      <CTableDataCell>{item.difficulty || '-'}</CTableDataCell>
                      <CTableDataCell>{item.estimatedMinutes || 0} phút</CTableDataCell>
                      <CTableDataCell><CBadge color={item.learningObjectStatus === 'active' ? 'success' : item.learningObjectStatus === 'archived' ? 'secondary' : 'warning'}>{item.learningObjectStatus}</CBadge></CTableDataCell>
                      <CTableDataCell className='text-end'>
                        <div className='d-flex gap-2 justify-content-end flex-wrap'>
                          <CButton size='sm' color='info' variant='outline' onClick={() => openEditLearningObjectModal(item)}>Sửa</CButton>
                          <CButton size='sm' color='primary' variant='outline' onClick={() => openContentManager(item)}>Quản lý nội dung</CButton>
                          <CButton size='sm' color='success' variant='outline' onClick={() => openQuestionManager(item)}>Câu hỏi</CButton>
                          <CButton size='sm' color='danger' variant='outline' onClick={() => handleDeleteLearningObject(item)}>Xóa</CButton>
                        </div>
                      </CTableDataCell>
                    </CTableRow>
                  ))}
                </CTableBody>
              </CTable>

              <div className='d-flex justify-content-between align-items-center mt-3 flex-wrap gap-2'>
                <div className='small text-body-secondary'>Tổng: {meta?.pagination?.total || 0} bản ghi</div>
                <div className='d-flex align-items-center gap-2'>
                  <CFormSelect value={pageSize} onChange={(event) => { setPageSize(Number(event.target.value || 10)); setPage(1) }} style={{ width: 100 }}>
                    {[10, 20, 50].map((size) => <option key={size} value={size}>{size}/trang</option>)}
                  </CFormSelect>
                  <CPagination className='mb-0'>
                    <CPaginationItem disabled={page <= 1} onClick={() => page > 1 && setPage(page - 1)}>Trước</CPaginationItem>
                    {pages.map((item, index) => (
                      <CPaginationItem
                        key={`${item}-${index}`}
                        active={item === page}
                        disabled={item === '...'}
                        onClick={() => typeof item === 'number' && setPage(item)}
                      >
                        {item}
                      </CPaginationItem>
                    ))}
                    <CPaginationItem disabled={page >= (meta?.pagination?.pageCount || 1)} onClick={() => page < (meta?.pagination?.pageCount || 1) && setPage(page + 1)}>Sau</CPaginationItem>
                  </CPagination>
                </div>
              </div>
            </>
          )}
        </CCardBody>
      </CCard>

      <CModal visible={showLearningObjectModal} backdrop='static' size='xl' onClose={() => !saving && closeLearningObjectModal()}>
        <CModalHeader>
          <CModalTitle>{editingLearningObject ? 'Sửa Learning Object' : 'Thêm Learning Object'}</CModalTitle>
        </CModalHeader>
        <CModalBody>
          <CRow className='g-3'>
            <CCol md={4}>
              <CFormLabel>Code</CFormLabel>
              <CFormInput value={learningObjectForm.code} onChange={(event) => updateLearningObjectField('code', event.target.value)} disabled={saving} />
            </CCol>
            <CCol md={8}>
              <CFormLabel>Tiêu đề</CFormLabel>
              <CFormInput value={learningObjectForm.title} onChange={(event) => updateLearningObjectField('title', event.target.value)} disabled={saving} />
            </CCol>
            <CCol md={4}>
              <CFormLabel>Slug</CFormLabel>
              <CFormInput value={learningObjectForm.slug} onChange={(event) => updateLearningObjectField('slug', event.target.value)} disabled={saving} placeholder='Để trống nếu Strapi tự sinh' />
            </CCol>
            <CCol md={4}>
              <CFormLabel>Version</CFormLabel>
              <CFormInput value={learningObjectForm.version} onChange={(event) => updateLearningObjectField('version', event.target.value)} disabled={saving} />
            </CCol>
            <CCol md={4}>
              <CFormLabel>Trạng thái</CFormLabel>
              <CFormSelect value={learningObjectForm.learningObjectStatus} onChange={(event) => updateLearningObjectField('learningObjectStatus', event.target.value)} disabled={saving}>
                {learningObjectStatuses.map((status) => <option key={status} value={status}>{status}</option>)}
              </CFormSelect>
            </CCol>
            <CCol xs={12}>
              <CFormLabel>Mô tả</CFormLabel>
              <CFormTextarea rows={3} value={learningObjectForm.description} onChange={(event) => updateLearningObjectField('description', event.target.value)} disabled={saving} />
            </CCol>
            <CCol md={6}>
              <div className='d-flex align-items-end gap-2'>
                <div className='flex-grow-1'>
                  <CFormLabel>Subject</CFormLabel>
                  <CFormSelect value={learningObjectForm.subject} onChange={(event) => updateLearningObjectField('subject', event.target.value)} disabled={saving}>
                    <option value=''>Chọn Subject</option>
                    {subjects.map((item) => <option key={getEntityId(item)} value={getEntityId(item)}>{item.title || item.code}</option>)}
                  </CFormSelect>
                </div>
                <CButton color='secondary' variant='outline' onClick={() => openQuickModal('subject')}>+</CButton>
              </div>
            </CCol>
            <CCol md={6}>
              <div className='d-flex align-items-end gap-2'>
                <div className='flex-grow-1'>
                  <CFormLabel>Grade</CFormLabel>
                  <CFormSelect value={learningObjectForm.grade} onChange={(event) => updateLearningObjectField('grade', event.target.value)} disabled={saving}>
                    <option value=''>Chọn Grade</option>
                    {grades.map((item) => <option key={getEntityId(item)} value={getEntityId(item)}>{item.title || item.code}</option>)}
                  </CFormSelect>
                </div>
                <CButton color='secondary' variant='outline' onClick={() => openQuickModal('grade')}>+</CButton>
              </div>
            </CCol>
            <CCol md={6}>
              <div className='d-flex align-items-end gap-2'>
                <div className='flex-grow-1'>
                  <CFormLabel>Knowledge Nodes</CFormLabel>
                  <CFormSelect multiple value={learningObjectForm.knowledgeNodes} onChange={(event) => handleMultiSelect(event, 'knowledgeNodes')} disabled={saving} style={{ minHeight: 120 }}>
                    {knowledgeNodes.map((item) => <option key={getEntityId(item)} value={getEntityId(item)}>{item.title || item.code}</option>)}
                  </CFormSelect>
                </div>
                <CButton color='secondary' variant='outline' onClick={() => openQuickModal('knowledgeNode')}>+</CButton>
              </div>
            </CCol>
            <CCol md={6}>
              <CFormLabel>Prerequisites</CFormLabel>
              <CFormSelect multiple value={learningObjectForm.prerequisites} onChange={(event) => handleMultiSelect(event, 'prerequisites')} disabled={saving} style={{ minHeight: 120 }}>
                {rows.filter((item) => getEntityId(item) !== getEntityId(editingLearningObject)).map((item) => <option key={getEntityId(item)} value={getEntityId(item)}>{item.title || item.code}</option>)}
              </CFormSelect>
            </CCol>
            <CCol md={4}>
              <CFormLabel>Độ khó</CFormLabel>
              <CFormSelect value={learningObjectForm.difficulty} onChange={(event) => updateLearningObjectField('difficulty', event.target.value)} disabled={saving}>
                <option value=''>Chọn độ khó</option>
                {(bootstrap?.difficulties || []).map((item) => <option key={item} value={item}>{item}</option>)}
              </CFormSelect>
            </CCol>
            <CCol md={4}>
              <CFormLabel>Thời lượng dự kiến</CFormLabel>
              <CFormInput type='number' value={learningObjectForm.estimatedMinutes} onChange={(event) => updateLearningObjectField('estimatedMinutes', event.target.value)} disabled={saving} />
            </CCol>
            <CCol md={4}>
              <CFormLabel>Skills</CFormLabel>
              <div className='d-flex align-items-end gap-2'>
                <CFormSelect multiple value={learningObjectForm.skills} onChange={(event) => handleMultiSelect(event, 'skills')} disabled={saving} style={{ minHeight: 120 }}>
                  {skills.map((item) => <option key={getEntityId(item)} value={getEntityId(item)}>{item.title || item.code}</option>)}
                </CFormSelect>
                <CButton color='secondary' variant='outline' onClick={() => openQuickModal('skill')}>+</CButton>
              </div>
            </CCol>
            <CCol md={6}>
              <div className='d-flex align-items-end gap-2'>
                <div className='flex-grow-1'>
                  <CFormLabel>Formulas</CFormLabel>
                  <CFormSelect multiple value={learningObjectForm.formulas} onChange={(event) => handleMultiSelect(event, 'formulas')} disabled={saving} style={{ minHeight: 120 }}>
                    {formulas.map((item) => <option key={getEntityId(item)} value={getEntityId(item)}>{item.title || item.code}</option>)}
                  </CFormSelect>
                </div>
                <CButton color='secondary' variant='outline' onClick={() => openQuickModal('formula')}>+</CButton>
              </div>
            </CCol>
            <CCol md={6}>
              <div className='d-flex align-items-end gap-2'>
                <div className='flex-grow-1'>
                  <CFormLabel>Visual Assets</CFormLabel>
                  <CFormSelect multiple value={learningObjectForm.visualAssets} onChange={(event) => handleMultiSelect(event, 'visualAssets')} disabled={saving} style={{ minHeight: 120 }}>
                    {visualAssets.map((item) => <option key={getEntityId(item)} value={getEntityId(item)}>{item.title || item.code}</option>)}
                  </CFormSelect>
                </div>
                <CButton color='secondary' variant='outline' onClick={() => openQuickModal('visualAsset')}>+</CButton>
              </div>
            </CCol>
            <CCol xs={12}>
              <CFormLabel>Learning Objectives (JSON)</CFormLabel>
              <CFormTextarea rows={4} value={learningObjectForm.learningObjectives} onChange={(event) => updateLearningObjectField('learningObjectives', event.target.value)} disabled={saving} />
            </CCol>
            <CCol xs={12}>
              <CFormLabel>Tags (JSON)</CFormLabel>
              <CFormTextarea rows={3} value={learningObjectForm.tags} onChange={(event) => updateLearningObjectField('tags', event.target.value)} disabled={saving} />
            </CCol>
          </CRow>
        </CModalBody>
        <CModalFooter>
          <CButton color='secondary' variant='outline' onClick={closeLearningObjectModal} disabled={saving}>Hủy</CButton>
          <CButton color='primary' onClick={handleSubmitLearningObject} disabled={saving}>{saving ? 'Đang lưu...' : 'Lưu'}</CButton>
        </CModalFooter>
      </CModal>

      <CModal visible={Boolean(quickModal)} backdrop='static' size='lg' onClose={() => !saving && closeQuickModal()}>
        <CModalHeader>
          <CModalTitle>Tạo nhanh {quickModal}</CModalTitle>
        </CModalHeader>
        <CModalBody>
          {quickModal === 'subject' ? (
            <CRow className='g-3'>
              <CCol md={6}><CFormLabel>Code</CFormLabel><CFormInput value={subjectForm.code} onChange={(event) => setSubjectForm((prev) => ({ ...prev, code: event.target.value }))} /></CCol>
              <CCol md={6}><CFormLabel>Title</CFormLabel><CFormInput value={subjectForm.title} onChange={(event) => setSubjectForm((prev) => ({ ...prev, title: event.target.value }))} /></CCol>
              <CCol xs={12}><CFormLabel>Description</CFormLabel><CFormTextarea rows={3} value={subjectForm.description} onChange={(event) => setSubjectForm((prev) => ({ ...prev, description: event.target.value }))} /></CCol>
            </CRow>
          ) : null}
          {quickModal === 'grade' ? (
            <CRow className='g-3'>
              <CCol md={4}><CFormLabel>Code</CFormLabel><CFormInput value={gradeForm.code} onChange={(event) => setGradeForm((prev) => ({ ...prev, code: event.target.value }))} /></CCol>
              <CCol md={5}><CFormLabel>Title</CFormLabel><CFormInput value={gradeForm.title} onChange={(event) => setGradeForm((prev) => ({ ...prev, title: event.target.value }))} /></CCol>
              <CCol md={3}><CFormLabel>Order</CFormLabel><CFormInput type='number' value={gradeForm.order} onChange={(event) => setGradeForm((prev) => ({ ...prev, order: event.target.value }))} /></CCol>
              <CCol xs={12}><CFormLabel>Description</CFormLabel><CFormTextarea rows={3} value={gradeForm.description} onChange={(event) => setGradeForm((prev) => ({ ...prev, description: event.target.value }))} /></CCol>
            </CRow>
          ) : null}
          {quickModal === 'knowledgeNode' ? (
            <CRow className='g-3'>
              <CCol md={4}><CFormLabel>Code</CFormLabel><CFormInput value={knowledgeNodeForm.code} onChange={(event) => setKnowledgeNodeForm((prev) => ({ ...prev, code: event.target.value }))} /></CCol>
              <CCol md={8}><CFormLabel>Title</CFormLabel><CFormInput value={knowledgeNodeForm.title} onChange={(event) => setKnowledgeNodeForm((prev) => ({ ...prev, title: event.target.value }))} /></CCol>
              <CCol xs={12}><CFormLabel>Description</CFormLabel><CFormTextarea rows={3} value={knowledgeNodeForm.description} onChange={(event) => setKnowledgeNodeForm((prev) => ({ ...prev, description: event.target.value }))} /></CCol>
              <CCol md={4}><CFormLabel>Subject</CFormLabel><CFormSelect value={knowledgeNodeForm.subject} onChange={(event) => setKnowledgeNodeForm((prev) => ({ ...prev, subject: event.target.value }))}><option value=''>Chọn</option>{subjects.map((item) => <option key={getEntityId(item)} value={getEntityId(item)}>{item.title || item.code}</option>)}</CFormSelect></CCol>
              <CCol md={4}><CFormLabel>Grade</CFormLabel><CFormSelect value={knowledgeNodeForm.grade} onChange={(event) => setKnowledgeNodeForm((prev) => ({ ...prev, grade: event.target.value }))}><option value=''>Chọn</option>{grades.map((item) => <option key={getEntityId(item)} value={getEntityId(item)}>{item.title || item.code}</option>)}</CFormSelect></CCol>
              <CCol md={4}><CFormLabel>Parent</CFormLabel><CFormSelect value={knowledgeNodeForm.parent} onChange={(event) => setKnowledgeNodeForm((prev) => ({ ...prev, parent: event.target.value }))}><option value=''>Không có</option>{knowledgeNodes.map((item) => <option key={getEntityId(item)} value={getEntityId(item)}>{item.title || item.code}</option>)}</CFormSelect></CCol>
              <CCol md={6}><CFormLabel>Order</CFormLabel><CFormInput type='number' value={knowledgeNodeForm.order} onChange={(event) => setKnowledgeNodeForm((prev) => ({ ...prev, order: event.target.value }))} /></CCol>
              <CCol md={6}><CFormLabel>Level</CFormLabel><CFormInput type='number' value={knowledgeNodeForm.level} onChange={(event) => setKnowledgeNodeForm((prev) => ({ ...prev, level: event.target.value }))} /></CCol>
            </CRow>
          ) : null}
          {quickModal === 'skill' ? (
            <CRow className='g-3'>
              <CCol md={4}><CFormLabel>Code</CFormLabel><CFormInput value={skillForm.code} onChange={(event) => setSkillForm((prev) => ({ ...prev, code: event.target.value }))} /></CCol>
              <CCol md={8}><CFormLabel>Title</CFormLabel><CFormInput value={skillForm.title} onChange={(event) => setSkillForm((prev) => ({ ...prev, title: event.target.value }))} /></CCol>
              <CCol xs={12}><CFormLabel>Description</CFormLabel><CFormTextarea rows={3} value={skillForm.description} onChange={(event) => setSkillForm((prev) => ({ ...prev, description: event.target.value }))} /></CCol>
              <CCol md={3}><CFormLabel>Subject</CFormLabel><CFormSelect value={skillForm.subject} onChange={(event) => setSkillForm((prev) => ({ ...prev, subject: event.target.value }))}><option value=''>Chọn</option>{subjects.map((item) => <option key={getEntityId(item)} value={getEntityId(item)}>{item.title || item.code}</option>)}</CFormSelect></CCol>
              <CCol md={3}><CFormLabel>Grade</CFormLabel><CFormSelect value={skillForm.grade} onChange={(event) => setSkillForm((prev) => ({ ...prev, grade: event.target.value }))}><option value=''>Chọn</option>{grades.map((item) => <option key={getEntityId(item)} value={getEntityId(item)}>{item.title || item.code}</option>)}</CFormSelect></CCol>
              <CCol md={3}><CFormLabel>KnowledgeNode</CFormLabel><CFormSelect value={skillForm.knowledgeNode} onChange={(event) => setSkillForm((prev) => ({ ...prev, knowledgeNode: event.target.value }))}><option value=''>Chọn</option>{knowledgeNodes.map((item) => <option key={getEntityId(item)} value={getEntityId(item)}>{item.title || item.code}</option>)}</CFormSelect></CCol>
              <CCol md={3}><CFormLabel>Level</CFormLabel><CFormSelect value={skillForm.level} onChange={(event) => setSkillForm((prev) => ({ ...prev, level: event.target.value }))}>{['remember', 'understand', 'apply', 'analyze', 'evaluate', 'create'].map((item) => <option key={item} value={item}>{item}</option>)}</CFormSelect></CCol>
            </CRow>
          ) : null}
          {quickModal === 'formula' ? (
            <CRow className='g-3'>
              <CCol md={4}><CFormLabel>Code</CFormLabel><CFormInput value={formulaForm.code} onChange={(event) => setFormulaForm((prev) => ({ ...prev, code: event.target.value }))} /></CCol>
              <CCol md={8}><CFormLabel>Title</CFormLabel><CFormInput value={formulaForm.title} onChange={(event) => setFormulaForm((prev) => ({ ...prev, title: event.target.value }))} /></CCol>
              <CCol xs={12}><CFormLabel>Description</CFormLabel><CFormTextarea rows={2} value={formulaForm.description} onChange={(event) => setFormulaForm((prev) => ({ ...prev, description: event.target.value }))} /></CCol>
              <CCol md={6}><CFormLabel>Latex</CFormLabel><CFormTextarea rows={2} value={formulaForm.latex} onChange={(event) => setFormulaForm((prev) => ({ ...prev, latex: event.target.value }))} /></CCol>
              <CCol md={6}><CFormLabel>Plain Text</CFormLabel><CFormTextarea rows={2} value={formulaForm.plainText} onChange={(event) => setFormulaForm((prev) => ({ ...prev, plainText: event.target.value }))} /></CCol>
              <CCol xs={12}><CFormLabel>Examples (JSON)</CFormLabel><CFormTextarea rows={3} value={formulaForm.examples} onChange={(event) => setFormulaForm((prev) => ({ ...prev, examples: event.target.value }))} /></CCol>
            </CRow>
          ) : null}
          {quickModal === 'visualAsset' ? (
            <CRow className='g-3'>
              <CCol md={4}><CFormLabel>Code</CFormLabel><CFormInput value={visualAssetForm.code} onChange={(event) => setVisualAssetForm((prev) => ({ ...prev, code: event.target.value }))} /></CCol>
              <CCol md={8}><CFormLabel>Title</CFormLabel><CFormInput value={visualAssetForm.title} onChange={(event) => setVisualAssetForm((prev) => ({ ...prev, title: event.target.value }))} /></CCol>
              <CCol md={4}><CFormLabel>Type</CFormLabel><CFormSelect value={visualAssetForm.type} onChange={(event) => setVisualAssetForm((prev) => ({ ...prev, type: event.target.value }))}>{['image', 'video', 'audio', 'diagram', 'animation', 'simulation', 'pdf', 'other'].map((item) => <option key={item} value={item}>{item}</option>)}</CFormSelect></CCol>
              <CCol md={4}><CFormLabel>File</CFormLabel><CFormInput type='file' onChange={(event) => setVisualAssetForm((prev) => ({ ...prev, file: event.target.files?.[0] || null }))} /></CCol>
              <CCol md={4}><CFormLabel>URL</CFormLabel><CFormInput value={visualAssetForm.url} onChange={(event) => setVisualAssetForm((prev) => ({ ...prev, url: event.target.value }))} /></CCol>
              <CCol xs={12}><CFormLabel>Description</CFormLabel><CFormTextarea rows={2} value={visualAssetForm.description} onChange={(event) => setVisualAssetForm((prev) => ({ ...prev, description: event.target.value }))} /></CCol>
              <CCol md={4}><CFormLabel>Alt Text</CFormLabel><CFormInput value={visualAssetForm.altText} onChange={(event) => setVisualAssetForm((prev) => ({ ...prev, altText: event.target.value }))} /></CCol>
              <CCol md={4}><CFormLabel>Subject</CFormLabel><CFormSelect value={visualAssetForm.subject} onChange={(event) => setVisualAssetForm((prev) => ({ ...prev, subject: event.target.value }))}><option value=''>Chọn</option>{subjects.map((item) => <option key={getEntityId(item)} value={getEntityId(item)}>{item.title || item.code}</option>)}</CFormSelect></CCol>
              <CCol md={4}><CFormLabel>Grade</CFormLabel><CFormSelect value={visualAssetForm.grade} onChange={(event) => setVisualAssetForm((prev) => ({ ...prev, grade: event.target.value }))}><option value=''>Chọn</option>{grades.map((item) => <option key={getEntityId(item)} value={getEntityId(item)}>{item.title || item.code}</option>)}</CFormSelect></CCol>
            </CRow>
          ) : null}
        </CModalBody>
        <CModalFooter>
          <CButton color='secondary' variant='outline' onClick={closeQuickModal} disabled={saving}>Hủy</CButton>
          <CButton color='primary' onClick={handleSubmitQuickModal} disabled={saving}>{saving ? 'Đang lưu...' : 'Lưu'}</CButton>
        </CModalFooter>
      </CModal>

      <CModal visible={showContentModal} backdrop='static' size='xl' onClose={() => !saving && closeContentManager()}>
        <CModalHeader>
          <CModalTitle>Quản lý Content Block - {contentTarget?.title || ''}</CModalTitle>
        </CModalHeader>
        <CModalBody>
          <div className='mb-3 small text-body-secondary'>Learning Object: {contentTarget?.code} - {contentTarget?.title}</div>
          <CRow className='g-4'>
            <CCol lg={7}>
              <div className='d-flex justify-content-between align-items-center mb-3'>
                <strong>Danh sách Content Block</strong>
                <CButton size='sm' color='primary' onClick={openCreateContentBlock}>Thêm block</CButton>
              </div>
              <CTable hover responsive>
                <CTableHead>
                  <CTableRow>
                    <CTableHeaderCell>Order</CTableHeaderCell>
                    <CTableHeaderCell>Type</CTableHeaderCell>
                    <CTableHeaderCell>Title</CTableHeaderCell>
                    <CTableHeaderCell className='text-end'>Thao tác</CTableHeaderCell>
                  </CTableRow>
                </CTableHead>
                <CTableBody>
                  {contentBlocks.length === 0 ? (
                    <CTableRow>
                      <CTableDataCell colSpan={4} className='text-center text-body-secondary py-4'>Chưa có block nào.</CTableDataCell>
                    </CTableRow>
                  ) : contentBlocks.map((block) => (
                    <CTableRow key={getEntityId(block)}>
                      <CTableDataCell>{block.order}</CTableDataCell>
                      <CTableDataCell>{block.type}</CTableDataCell>
                      <CTableDataCell>{block.title || '-'}</CTableDataCell>
                      <CTableDataCell className='text-end'>
                        <div className='d-flex gap-2 justify-content-end'>
                          <CButton size='sm' color='secondary' variant='outline' onClick={() => moveContentBlock(block, 'up')}>↑</CButton>
                          <CButton size='sm' color='secondary' variant='outline' onClick={() => moveContentBlock(block, 'down')}>↓</CButton>
                          <CButton size='sm' color='info' variant='outline' onClick={() => openEditContentBlock(block)}>Sửa</CButton>
                          <CButton size='sm' color='danger' variant='outline' onClick={() => handleDeleteContentBlock(block)}>Xóa</CButton>
                        </div>
                      </CTableDataCell>
                    </CTableRow>
                  ))}
                </CTableBody>
              </CTable>
            </CCol>
            <CCol lg={5}>
              <strong>{editingContentBlock ? 'Sửa block' : 'Thêm block'}</strong>
              <CRow className='g-3 mt-1'>
                <CCol md={6}><CFormLabel>Type</CFormLabel><CFormSelect value={contentBlockForm.type} onChange={(event) => setContentBlockForm((prev) => ({ ...prev, type: event.target.value }))}>{contentBlockTypes.map((item) => <option key={item} value={item}>{item}</option>)}</CFormSelect></CCol>
                <CCol md={6}><CFormLabel>Order</CFormLabel><CFormInput type='number' value={contentBlockForm.order} onChange={(event) => setContentBlockForm((prev) => ({ ...prev, order: event.target.value }))} /></CCol>
                <CCol xs={12}><CFormLabel>Title</CFormLabel><CFormInput value={contentBlockForm.title} onChange={(event) => setContentBlockForm((prev) => ({ ...prev, title: event.target.value }))} /></CCol>
                <CCol xs={12}><CFormLabel>Content</CFormLabel><CFormTextarea rows={3} value={contentBlockForm.content} onChange={(event) => setContentBlockForm((prev) => ({ ...prev, content: event.target.value }))} /></CCol>
                <CCol xs={12}><CFormLabel>HTML Content</CFormLabel><CFormTextarea rows={3} value={contentBlockForm.htmlContent} onChange={(event) => setContentBlockForm((prev) => ({ ...prev, htmlContent: event.target.value }))} /></CCol>
                <CCol xs={12}><CFormLabel>Media</CFormLabel><CFormInput type='file' onChange={(event) => setContentBlockForm((prev) => ({ ...prev, media: event.target.files?.[0] || null }))} /></CCol>
                <CCol xs={12}><div className='d-flex align-items-end gap-2'><div className='flex-grow-1'><CFormLabel>Formula</CFormLabel><CFormSelect value={contentBlockForm.formula} onChange={(event) => setContentBlockForm((prev) => ({ ...prev, formula: event.target.value }))}><option value=''>Không chọn</option>{formulas.map((item) => <option key={getEntityId(item)} value={getEntityId(item)}>{item.title || item.code}</option>)}</CFormSelect></div><CButton color='secondary' variant='outline' onClick={() => openQuickModal('formula')}>+</CButton></div></CCol>
                <CCol xs={12}><CFormLabel>Question</CFormLabel><CFormSelect value={contentBlockForm.question} onChange={(event) => setContentBlockForm((prev) => ({ ...prev, question: event.target.value }))}><option value=''>Không chọn</option>{availableQuestions.map((item) => <option key={getEntityId(item)} value={getEntityId(item)}>{item.title || item.code}</option>)}</CFormSelect></CCol>
                <CCol xs={12}><div className='d-flex align-items-end gap-2'><div className='flex-grow-1'><CFormLabel>Visual Asset</CFormLabel><CFormSelect value={contentBlockForm.visualAsset} onChange={(event) => setContentBlockForm((prev) => ({ ...prev, visualAsset: event.target.value }))}><option value=''>Không chọn</option>{visualAssets.map((item) => <option key={getEntityId(item)} value={getEntityId(item)}>{item.title || item.code}</option>)}</CFormSelect></div><CButton color='secondary' variant='outline' onClick={() => openQuickModal('visualAsset')}>+</CButton></div></CCol>
                <CCol xs={12}><CFormLabel>Config (JSON)</CFormLabel><CFormTextarea rows={3} value={contentBlockForm.config} onChange={(event) => setContentBlockForm((prev) => ({ ...prev, config: event.target.value }))} /></CCol>
                <CCol xs={12}><CFormLabel>Trạng thái</CFormLabel><CFormSelect value={contentBlockForm.contentBlockStatus} onChange={(event) => setContentBlockForm((prev) => ({ ...prev, contentBlockStatus: event.target.value }))}>{contentBlockStatuses.map((item) => <option key={item} value={item}>{item}</option>)}</CFormSelect></CCol>
                <CCol xs={12} className='d-flex gap-2'>
                  <CButton color='primary' onClick={handleSaveContentBlock} disabled={saving}>{saving ? 'Đang lưu...' : 'Lưu block'}</CButton>
                  <CButton color='secondary' variant='outline' onClick={openCreateContentBlock}>Mới</CButton>
                </CCol>
              </CRow>
            </CCol>
          </CRow>
        </CModalBody>
      </CModal>

      <CModal visible={showQuestionModal} backdrop='static' size='xl' onClose={() => !saving && closeQuestionManager()}>
        <CModalHeader>
          <CModalTitle>Câu hỏi của Learning Object - {questionTarget?.title || ''}</CModalTitle>
        </CModalHeader>
        <CModalBody>
          <div className='d-flex justify-content-between align-items-center mb-3 flex-wrap gap-2'>
            <div className='small text-body-secondary'>Đã gắn: {(questionTarget?.questions || []).length} câu hỏi</div>
            <div className='d-flex gap-2'>
              <CFormInput value={questionSearch} onChange={(event) => setQuestionSearch(event.target.value)} placeholder='Tìm câu hỏi có sẵn' />
              <CButton color='secondary' variant='outline' onClick={refreshQuestions}>Tìm</CButton>
              <CButton color='primary' onClick={() => setShowCreateQuestionModal(true)}>Tạo câu hỏi mới</CButton>
            </div>
          </div>

          <CRow className='g-4'>
            <CCol lg={6}>
              <strong>Câu hỏi đã gắn</strong>
              <CTable hover responsive className='mt-2'>
                <CTableHead>
                  <CTableRow>
                    <CTableHeaderCell>Code</CTableHeaderCell>
                    <CTableHeaderCell>Tiêu đề</CTableHeaderCell>
                    <CTableHeaderCell className='text-end'>Thao tác</CTableHeaderCell>
                  </CTableRow>
                </CTableHead>
                <CTableBody>
                  {(questionTarget?.questions || []).length === 0 ? (
                    <CTableRow>
                      <CTableDataCell colSpan={3} className='text-center text-body-secondary py-4'>Chưa có câu hỏi nào.</CTableDataCell>
                    </CTableRow>
                  ) : (questionTarget?.questions || []).map((question) => (
                    <CTableRow key={getEntityId(question)}>
                      <CTableDataCell>{question.code}</CTableDataCell>
                      <CTableDataCell>{question.title || question.questionText}</CTableDataCell>
                      <CTableDataCell className='text-end'>
                        <CButton size='sm' color='danger' variant='outline' onClick={() => handleDetachQuestion(getEntityId(question))}>Gỡ</CButton>
                      </CTableDataCell>
                    </CTableRow>
                  ))}
                </CTableBody>
              </CTable>
            </CCol>
            <CCol lg={6}>
              <strong>Gắn câu hỏi có sẵn</strong>
              <CTable hover responsive className='mt-2'>
                <CTableHead>
                  <CTableRow>
                    <CTableHeaderCell>Code</CTableHeaderCell>
                    <CTableHeaderCell>Tiêu đề</CTableHeaderCell>
                    <CTableHeaderCell className='text-end'>Thao tác</CTableHeaderCell>
                  </CTableRow>
                </CTableHead>
                <CTableBody>
                  {availableQuestions.length === 0 ? (
                    <CTableRow>
                      <CTableDataCell colSpan={3} className='text-center text-body-secondary py-4'>Không có câu hỏi phù hợp.</CTableDataCell>
                    </CTableRow>
                  ) : availableQuestions.map((question) => {
                    const attached = currentQuestionIds.has(String(getEntityId(question)))
                    return (
                      <CTableRow key={getEntityId(question)}>
                        <CTableDataCell>{question.code}</CTableDataCell>
                        <CTableDataCell>{question.title || question.questionText}</CTableDataCell>
                        <CTableDataCell className='text-end'>
                          <CButton size='sm' color='primary' variant='outline' disabled={attached} onClick={() => handleAttachQuestion(getEntityId(question))}>{attached ? 'Đã gắn' : 'Gắn'}</CButton>
                        </CTableDataCell>
                      </CTableRow>
                    )
                  })}
                </CTableBody>
              </CTable>
            </CCol>
          </CRow>
        </CModalBody>
      </CModal>

      <CModal visible={showCreateQuestionModal} backdrop='static' size='xl' onClose={() => !saving && setShowCreateQuestionModal(false)}>
        <CModalHeader>
          <CModalTitle>Tạo câu hỏi mới</CModalTitle>
        </CModalHeader>
        <CModalBody>
          <CRow className='g-3'>
            <CCol md={4}><CFormLabel>Code</CFormLabel><CFormInput value={questionForm.code} onChange={(event) => setQuestionForm((prev) => ({ ...prev, code: event.target.value }))} /></CCol>
            <CCol md={8}><CFormLabel>Title</CFormLabel><CFormInput value={questionForm.title} onChange={(event) => setQuestionForm((prev) => ({ ...prev, title: event.target.value }))} /></CCol>
            <CCol xs={12}><CFormLabel>Question Text</CFormLabel><CFormTextarea rows={4} value={questionForm.questionText} onChange={(event) => setQuestionForm((prev) => ({ ...prev, questionText: event.target.value }))} /></CCol>
            <CCol md={4}><CFormLabel>Type</CFormLabel><CFormSelect value={questionForm.type} onChange={(event) => setQuestionForm((prev) => ({ ...prev, type: event.target.value }))}>{questionTypes.map((item) => <option key={item} value={item}>{item}</option>)}</CFormSelect></CCol>
            <CCol md={4}><CFormLabel>Subject</CFormLabel><CFormSelect value={questionForm.subject} onChange={(event) => setQuestionForm((prev) => ({ ...prev, subject: event.target.value }))}><option value=''>Chọn</option>{subjects.map((item) => <option key={getEntityId(item)} value={getEntityId(item)}>{item.title || item.code}</option>)}</CFormSelect></CCol>
            <CCol md={4}><CFormLabel>Grade</CFormLabel><CFormSelect value={questionForm.grade} onChange={(event) => setQuestionForm((prev) => ({ ...prev, grade: event.target.value }))}><option value=''>Chọn</option>{grades.map((item) => <option key={getEntityId(item)} value={getEntityId(item)}>{item.title || item.code}</option>)}</CFormSelect></CCol>
            <CCol md={4}><CFormLabel>KnowledgeNode</CFormLabel><CFormSelect value={questionForm.knowledgeNode} onChange={(event) => setQuestionForm((prev) => ({ ...prev, knowledgeNode: event.target.value }))}><option value=''>Chọn</option>{knowledgeNodes.map((item) => <option key={getEntityId(item)} value={getEntityId(item)}>{item.title || item.code}</option>)}</CFormSelect></CCol>
            <CCol md={4}><CFormLabel>Difficulty</CFormLabel><CFormSelect value={questionForm.difficulty} onChange={(event) => setQuestionForm((prev) => ({ ...prev, difficulty: event.target.value }))}><option value=''>Chọn</option>{(bootstrap?.difficulties || []).map((item) => <option key={item} value={item}>{item}</option>)}</CFormSelect></CCol>
            <CCol md={4}><CFormLabel>Question Status</CFormLabel><CFormSelect value={questionForm.questionStatus} onChange={(event) => setQuestionForm((prev) => ({ ...prev, questionStatus: event.target.value }))}>{questionStatuses.map((item) => <option key={item} value={item}>{item}</option>)}</CFormSelect></CCol>
            <CCol md={6}><CFormLabel>Skills</CFormLabel><CFormSelect multiple value={questionForm.skills} onChange={(event) => setQuestionForm((prev) => ({ ...prev, skills: Array.from(event.target.selectedOptions || []).map((option) => option.value) }))} style={{ minHeight: 120 }}>{skills.map((item) => <option key={getEntityId(item)} value={getEntityId(item)}>{item.title || item.code}</option>)}</CFormSelect></CCol>
            <CCol md={6}><CFormLabel>Formulas</CFormLabel><CFormSelect multiple value={questionForm.formulas} onChange={(event) => setQuestionForm((prev) => ({ ...prev, formulas: Array.from(event.target.selectedOptions || []).map((option) => option.value) }))} style={{ minHeight: 120 }}>{formulas.map((item) => <option key={getEntityId(item)} value={getEntityId(item)}>{item.title || item.code}</option>)}</CFormSelect></CCol>
            <CCol xs={12}><CFormLabel>Correct Answer (JSON)</CFormLabel><CFormTextarea rows={3} value={questionForm.correctAnswer} onChange={(event) => setQuestionForm((prev) => ({ ...prev, correctAnswer: event.target.value }))} /></CCol>
            <CCol xs={12}><CFormLabel>Explanation</CFormLabel><CFormTextarea rows={3} value={questionForm.explanation} onChange={(event) => setQuestionForm((prev) => ({ ...prev, explanation: event.target.value }))} /></CCol>
            <CCol xs={12}><CFormLabel>Rubric (JSON)</CFormLabel><CFormTextarea rows={3} value={questionForm.rubric} onChange={(event) => setQuestionForm((prev) => ({ ...prev, rubric: event.target.value }))} /></CCol>
          </CRow>

          {shouldShowQuestionOptions(questionForm.type) ? (
            <div className='mt-4'>
              <div className='d-flex justify-content-between align-items-center mb-2'>
                <strong>Question Options</strong>
                <CButton size='sm' color='secondary' variant='outline' onClick={addQuestionOption}>Thêm option</CButton>
              </div>
              {(questionForm.options || []).map((option, index) => (
                <CCard key={option.clientKey || index} className='mb-3'>
                  <CCardBody>
                    <CRow className='g-3'>
                      <CCol md={3}><CFormLabel>Label</CFormLabel><CFormInput value={option.label} onChange={(event) => updateQuestionOption(index, 'label', event.target.value)} /></CCol>
                      <CCol md={3}><CFormLabel>Value</CFormLabel><CFormInput value={option.value} onChange={(event) => updateQuestionOption(index, 'value', event.target.value)} /></CCol>
                      <CCol md={2}><CFormLabel>Order</CFormLabel><CFormInput type='number' value={option.order} onChange={(event) => updateQuestionOption(index, 'order', event.target.value)} /></CCol>
                      <CCol md={2}><CFormLabel>Đúng?</CFormLabel><CFormSelect value={option.isCorrect ? 'true' : 'false'} onChange={(event) => updateQuestionOption(index, 'isCorrect', event.target.value === 'true')}><option value='false'>Sai</option><option value='true'>Đúng</option></CFormSelect></CCol>
                      <CCol md={2} className='d-flex align-items-end'><CButton color='danger' variant='outline' onClick={() => removeQuestionOption(index)}>Xóa</CButton></CCol>
                      <CCol xs={12}><CFormLabel>Content</CFormLabel><CFormTextarea rows={2} value={option.content} onChange={(event) => updateQuestionOption(index, 'content', event.target.value)} /></CCol>
                      <CCol xs={12}><CFormLabel>Explanation</CFormLabel><CFormTextarea rows={2} value={option.explanation} onChange={(event) => updateQuestionOption(index, 'explanation', event.target.value)} /></CCol>
                    </CRow>
                  </CCardBody>
                </CCard>
              ))}
            </div>
          ) : null}
        </CModalBody>
        <CModalFooter>
          <CButton color='secondary' variant='outline' onClick={() => setShowCreateQuestionModal(false)} disabled={saving}>Hủy</CButton>
          <CButton color='primary' onClick={handleCreateQuestion} disabled={saving}>{saving ? 'Đang lưu...' : 'Lưu câu hỏi'}</CButton>
        </CModalFooter>
      </CModal>
    </div>
  )
}
