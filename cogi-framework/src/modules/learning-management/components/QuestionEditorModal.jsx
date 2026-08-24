import { useEffect, useMemo, useState } from 'react'
import {
  CAccordion,
  CAccordionBody,
  CAccordionHeader,
  CAccordionItem,
  CAlert,
  CBadge,
  CButton,
  CCard,
  CCardBody,
  CCol,
  CFormCheck,
  CFormInput,
  CFormLabel,
  CFormSelect,
  CFormTextarea,
  CModal,
  CModalBody,
  CModalFooter,
  CModalHeader,
  CModalTitle,
  CRow,
} from '@coreui/react'
import FileAssetPickerModal from './FileAssetPickerModal'
import QuestionPreview from './QuestionPreview'
import QuestionStimulusEditorModal, { normalizeStimulusForm, toStimulusPayload } from './QuestionStimulusEditorModal'
import StimulusPreview from './StimulusPreview'
import { canAccessAnyFeature, getApiMessage, getEntityId, getFileAssetUrl, getQuestionTypeLabel, parseOptionalJson } from '../utils/questionBankUi'

function createEmptyOption(index = 0) {
  return {
    label: String.fromCharCode(65 + index),
    value: String.fromCharCode(97 + index),
    content: '',
    imageAsset: null,
    isCorrect: false,
    order: index,
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
    difficulty: '',
    subject: '',
    grade: '',
    knowledgeNode: '',
    skills: [],
    formulas: [],
    stimulus: '',
    stimulusEntity: null,
    correctAnswer: '',
    explanation: '',
    rubric: '',
    questionStatus: 'draft',
    options: [createEmptyOption(0), createEmptyOption(1)],
  }
}

export function normalizeQuestionForm(question) {
  return {
    code: question?.code || '',
    title: question?.title || '',
    questionText: question?.questionText || '',
    type: question?.type || 'single_choice',
    difficulty: question?.difficulty || '',
    subject: getEntityId(question?.subject),
    grade: getEntityId(question?.grade),
    knowledgeNode: getEntityId(question?.knowledgeNode),
    skills: Array.isArray(question?.skills) ? question.skills.map((item) => getEntityId(item)).filter(Boolean) : [],
    formulas: Array.isArray(question?.formulas) ? question.formulas.map((item) => getEntityId(item)).filter(Boolean) : [],
    stimulus: getEntityId(question?.stimulus),
    stimulusEntity: question?.stimulus || null,
    correctAnswer: question?.correctAnswer ? JSON.stringify(question.correctAnswer, null, 2) : '',
    explanation: question?.explanation || '',
    rubric: question?.rubric ? JSON.stringify(question.rubric, null, 2) : '',
    questionStatus: question?.questionStatus || 'draft',
    options: Array.isArray(question?.options) && question.options.length > 0
      ? question.options.map((option, index) => ({
        label: option?.label || String.fromCharCode(65 + index),
        value: option?.value || String.fromCharCode(97 + index),
        content: option?.content || '',
        imageAsset: option?.imageAsset || null,
        isCorrect: option?.isCorrect === true,
        order: Number(option?.order ?? index),
        explanation: option?.explanation || '',
        clientKey: String(option?.documentId || option?.id || `option-${index}`),
      }))
      : [createEmptyOption(0), createEmptyOption(1)],
  }
}

function shouldShowOptions(type) {
  return ['single_choice', 'multiple_choice', 'true_false'].includes(String(type || '').toLowerCase())
}

export default function QuestionEditorModal({
  visible,
  saving,
  bootstrap,
  editingQuestion,
  questionStimuli = [],
  onClose,
  onSubmit,
  onQuickCreateSubject,
  onQuickCreateGrade,
  onQuickCreateSkill,
  onQuickCreateKnowledgeNode,
  onQuickCreateStimulus,
  onRefreshStimuli,
  onRefreshSupportData,
  feature,
}) {
  const [form, setForm] = useState(emptyQuestionForm())
  const [error, setError] = useState('')
  const [pickerIndex, setPickerIndex] = useState(-1)
  const [quickModal, setQuickModal] = useState('')
  const [quickSaving, setQuickSaving] = useState(false)
  const [quickError, setQuickError] = useState('')
  const [quickForm, setQuickForm] = useState({ code: '', title: '', level: 'understand', subject: '', grade: '', parent: '', description: '' })
  const [showStimulusModal, setShowStimulusModal] = useState(false)

  const subjects = bootstrap?.subjects || []
  const grades = bootstrap?.grades || []
  const knowledgeNodes = bootstrap?.knowledgeNodes || []
  const skills = bootstrap?.skills || []
  const formulas = bootstrap?.formulas || []
  const questionTypes = bootstrap?.questionTypes || []
  const questionStatuses = bootstrap?.questionStatuses || []
  const difficulties = bootstrap?.difficulties || []
  const skillLevels = bootstrap?.skillLevels || ['remember', 'understand', 'apply', 'analyze', 'evaluate', 'create']

  useEffect(() => {
    if (!visible) return
    setForm(editingQuestion ? normalizeQuestionForm(editingQuestion) : emptyQuestionForm())
    setError('')
  }, [editingQuestion, visible])

  const selectedStimulus = useMemo(() => {
    if (form.stimulusEntity) return form.stimulusEntity
    return questionStimuli.find((item) => String(getEntityId(item)) === String(form.stimulus || '')) || null
  }, [form.stimulus, form.stimulusEntity, questionStimuli])

  const showOptions = shouldShowOptions(form.type)
  const canCreateSubject = canAccessAnyFeature(feature, ['learning.subject.manage', 'learning.learning-object.manage'])
  const canCreateGrade = canAccessAnyFeature(feature, ['learning.grade.manage', 'learning.learning-object.manage'])
  const canCreateSkill = canAccessAnyFeature(feature, ['learning.learning-object.manage'])
  const canCreateKnowledgeNode = canAccessAnyFeature(feature, ['learning.learning-object.manage'])
  const canCreateStimulus = canAccessAnyFeature(feature, ['learning.question-stimulus.manage', 'learning.question.manage', 'learning.learning-object.manage'])

  function handleClose() {
    if (saving) return
    setError('')
    setPickerIndex(-1)
    onClose?.()
  }

  function updateOption(index, patch) {
    setForm((prev) => ({
      ...prev,
      options: (prev.options || []).map((option, optionIndex) => (optionIndex === index ? { ...option, ...patch } : option)),
    }))
  }

  function addOption() {
    setForm((prev) => ({
      ...prev,
      options: [...(prev.options || []), createEmptyOption(prev.options?.length || 0)],
    }))
  }

  function moveOption(index, direction) {
    setForm((prev) => {
      const next = [...(prev.options || [])]
      const targetIndex = direction === 'up' ? index - 1 : index + 1
      if (targetIndex < 0 || targetIndex >= next.length) return prev
      ;[next[index], next[targetIndex]] = [next[targetIndex], next[index]]
      return {
        ...prev,
        options: next.map((item, optionIndex) => ({ ...item, order: optionIndex })),
      }
    })
  }

  function removeOption(index) {
    setForm((prev) => ({
      ...prev,
      options: (prev.options || []).filter((_, optionIndex) => optionIndex !== index).map((item, optionIndex) => ({ ...item, order: optionIndex })),
    }))
  }

  function handleMultiSelect(event, key) {
    const values = Array.from(event.target.selectedOptions || []).map((option) => option.value)
    setForm((prev) => ({ ...prev, [key]: values }))
  }

  async function handleSave() {
    if (!String(form.code || '').trim()) {
      setError('Code la bat buoc')
      return
    }
    if (!String(form.questionText || '').trim()) {
      setError('Question text la bat buoc')
      return
    }

    let correctAnswer = null
    let rubric = null
    try {
      correctAnswer = showOptions ? null : parseOptionalJson(form.correctAnswer, 'Correct Answer')
      rubric = parseOptionalJson(form.rubric, 'Rubric')
    } catch (parseError) {
      setError(parseError.message)
      return
    }

    const payload = {
      code: String(form.code || '').trim(),
      title: String(form.title || '').trim() || null,
      questionText: form.questionText,
      type: form.type,
      difficulty: form.difficulty || null,
      subject: form.subject || null,
      grade: form.grade || null,
      knowledgeNode: form.knowledgeNode || null,
      skills: form.skills || [],
      formulas: form.formulas || [],
      stimulus: form.stimulus || null,
      correctAnswer,
      explanation: form.explanation || null,
      rubric,
      questionStatus: form.questionStatus,
      options: showOptions
        ? (form.options || []).map((option, index) => ({
          label: option.label,
          value: option.value,
          content: option.content,
          imageAsset: option.imageAsset ? (option.imageAsset.documentId || option.imageAsset.id) : null,
          isCorrect: option.isCorrect,
          order: Number(option.order ?? index),
          explanation: option.explanation,
        })).filter((option) => option.label || option.value || option.content || option.imageAsset)
        : [],
    }

    try {
      await onSubmit?.(payload)
      setError('')
    } catch (requestError) {
      setError(getApiMessage(requestError, 'Khong luu duoc cau hoi'))
    }
  }

  function openQuickCreate(type) {
    setQuickModal(type)
    setQuickError('')
    setQuickForm({ code: '', title: '', level: 'understand', subject: form.subject || '', grade: form.grade || '', parent: '', description: '' })
  }

  async function handleQuickCreate() {
    setQuickSaving(true)
    setQuickError('')
    try {
      let created = null
      if (quickModal === 'subject') {
        created = await onQuickCreateSubject?.({ code: quickForm.code, title: quickForm.title, description: quickForm.description, subjectStatus: 'active' })
        setForm((prev) => ({ ...prev, subject: getEntityId(created) || prev.subject }))
      }
      if (quickModal === 'grade') {
        created = await onQuickCreateGrade?.({ code: quickForm.code, title: quickForm.title, description: quickForm.description, gradeStatus: 'active' })
        setForm((prev) => ({ ...prev, grade: getEntityId(created) || prev.grade }))
      }
      if (quickModal === 'skill') {
        created = await onQuickCreateSkill?.({ code: quickForm.code, title: quickForm.title, description: quickForm.description, level: quickForm.level, subject: quickForm.subject || null, grade: quickForm.grade || null, knowledgeNode: quickForm.parent || null, skillStatus: 'active' })
        setForm((prev) => ({ ...prev, skills: [...new Set([...(prev.skills || []), getEntityId(created)])].filter(Boolean) }))
      }
      if (quickModal === 'knowledgeNode') {
        created = await onQuickCreateKnowledgeNode?.({ code: quickForm.code, title: quickForm.title, description: quickForm.description, subject: quickForm.subject || null, grade: quickForm.grade || null, parent: quickForm.parent || null, knowledgeNodeStatus: 'active' })
        setForm((prev) => ({ ...prev, knowledgeNode: getEntityId(created) || prev.knowledgeNode }))
      }
      if (created) {
        await onRefreshSupportData?.()
      }
      setQuickModal('')
    } catch (requestError) {
      setQuickError(getApiMessage(requestError, 'Khong tao nhanh duoc du lieu'))
    } finally {
      setQuickSaving(false)
    }
  }

  async function handleQuickCreateStimulus(payload) {
    try {
      const created = await onQuickCreateStimulus?.(payload)
      await onRefreshStimuli?.()
      setForm((prev) => ({ ...prev, stimulus: getEntityId(created), stimulusEntity: created }))
      setShowStimulusModal(false)
    } catch (requestError) {
      throw requestError
    }
  }

  const previewQuestion = {
    ...form,
    stimulus: selectedStimulus,
  }

  return (
    <>
      <CModal visible={visible} backdrop='static' size='xl' fullscreen='md-down' onClose={handleClose}>
        <CModalHeader>
          <CModalTitle>{editingQuestion ? 'Sửa câu hỏi' : 'Tạo câu hỏi'}</CModalTitle>
        </CModalHeader>
        <CModalBody>
          {error ? <CAlert color='danger'>{error}</CAlert> : null}
          <CRow className='g-4'>
            <CCol lg={8}>
              <CRow className='g-3'>
                <CCol md={4}><CFormLabel>Code</CFormLabel><CFormInput value={form.code} onChange={(event) => setForm((prev) => ({ ...prev, code: event.target.value }))} disabled={saving} /></CCol>
                <CCol md={8}><CFormLabel>Title</CFormLabel><CFormInput value={form.title} onChange={(event) => setForm((prev) => ({ ...prev, title: event.target.value }))} disabled={saving} /></CCol>
                <CCol xs={12}><CFormLabel>Nội dung câu hỏi</CFormLabel><CFormTextarea rows={4} value={form.questionText} onChange={(event) => setForm((prev) => ({ ...prev, questionText: event.target.value }))} disabled={saving} /></CCol>
                <CCol md={4}><CFormLabel>Loại</CFormLabel><CFormSelect value={form.type} onChange={(event) => setForm((prev) => ({ ...prev, type: event.target.value }))} disabled={saving}>{questionTypes.map((item) => <option key={item} value={item}>{getQuestionTypeLabel(item)}</option>)}</CFormSelect></CCol>
                <CCol md={4}><CFormLabel>Độ khó</CFormLabel><CFormSelect value={form.difficulty} onChange={(event) => setForm((prev) => ({ ...prev, difficulty: event.target.value }))} disabled={saving}><option value=''>Chọn</option>{difficulties.map((item) => <option key={item} value={item}>{item}</option>)}</CFormSelect></CCol>
                <CCol md={4}><CFormLabel>Trạng thái</CFormLabel><CFormSelect value={form.questionStatus} onChange={(event) => setForm((prev) => ({ ...prev, questionStatus: event.target.value }))} disabled={saving}>{questionStatuses.map((item) => <option key={item} value={item}>{item}</option>)}</CFormSelect></CCol>

                <CCol md={6}>
                  <CFormLabel>Môn học</CFormLabel>
                  <div className='d-flex gap-2'>
                    <CFormSelect value={form.subject} onChange={(event) => setForm((prev) => ({ ...prev, subject: event.target.value }))} disabled={saving}><option value=''>Không chọn</option>{subjects.map((item) => <option key={getEntityId(item)} value={getEntityId(item)}>{item.title || item.code}</option>)}</CFormSelect>
                    {canCreateSubject ? <CButton color='secondary' variant='outline' onClick={() => openQuickCreate('subject')}>+</CButton> : null}
                  </div>
                </CCol>
                <CCol md={6}>
                  <CFormLabel>Khối</CFormLabel>
                  <div className='d-flex gap-2'>
                    <CFormSelect value={form.grade} onChange={(event) => setForm((prev) => ({ ...prev, grade: event.target.value }))} disabled={saving}><option value=''>Không chọn</option>{grades.map((item) => <option key={getEntityId(item)} value={getEntityId(item)}>{item.title || item.code}</option>)}</CFormSelect>
                    {canCreateGrade ? <CButton color='secondary' variant='outline' onClick={() => openQuickCreate('grade')}>+</CButton> : null}
                  </div>
                </CCol>
                <CCol md={6}>
                  <CFormLabel>Chủ đề kiến thức</CFormLabel>
                  <div className='d-flex gap-2'>
                    <CFormSelect value={form.knowledgeNode} onChange={(event) => setForm((prev) => ({ ...prev, knowledgeNode: event.target.value }))} disabled={saving}><option value=''>Không chọn</option>{knowledgeNodes.map((item) => <option key={getEntityId(item)} value={getEntityId(item)}>{item.title || item.code}</option>)}</CFormSelect>
                    {canCreateKnowledgeNode ? <CButton color='secondary' variant='outline' onClick={() => openQuickCreate('knowledgeNode')}>+</CButton> : null}
                  </div>
                </CCol>
                <CCol md={6}>
                  <CFormLabel>Kỹ năng</CFormLabel>
                  <div className='d-flex gap-2'>
                    <CFormSelect multiple value={form.skills} onChange={(event) => handleMultiSelect(event, 'skills')} disabled={saving} style={{ minHeight: 120 }}>{skills.map((item) => <option key={getEntityId(item)} value={getEntityId(item)}>{item.title || item.code}</option>)}</CFormSelect>
                    {canCreateSkill ? <CButton color='secondary' variant='outline' onClick={() => openQuickCreate('skill')}>+</CButton> : null}
                  </div>
                </CCol>
                <CCol xs={12}>
                  <CFormLabel>Stimulus</CFormLabel>
                  <div className='d-flex gap-2 mb-2'>
                    <CFormSelect value={form.stimulus} onChange={(event) => setForm((prev) => ({ ...prev, stimulus: event.target.value, stimulusEntity: questionStimuli.find((item) => String(getEntityId(item)) === String(event.target.value || '')) || null }))} disabled={saving}>
                      <option value=''>Không dùng stimulus</option>
                      {questionStimuli.map((item) => <option key={getEntityId(item)} value={getEntityId(item)}>{`${item.code || '-'} • ${item.title || '-'} • ${item.type || '-'}`}</option>)}
                    </CFormSelect>
                    {canCreateStimulus ? <CButton color='secondary' variant='outline' onClick={() => setShowStimulusModal(true)}>Tạo nhanh</CButton> : null}
                  </div>
                  {selectedStimulus ? <StimulusPreview stimulus={selectedStimulus} compact /> : <div className='small text-body-secondary'>Câu hỏi này không sử dụng stimulus.</div>}
                </CCol>

                {showOptions ? (
                  <CCol xs={12}>
                    <div className='d-flex justify-content-between align-items-center mb-2'>
                      <strong>Đáp án</strong>
                      <CButton size='sm' color='secondary' variant='outline' onClick={addOption}>Thêm đáp án</CButton>
                    </div>
                    {(form.options || []).map((option, index) => (
                      <CCard key={option.clientKey || index} className='mb-3'>
                        <CCardBody>
                          <CRow className='g-3'>
                            <CCol md={2}><CFormLabel>Label</CFormLabel><CFormInput value={option.label} onChange={(event) => updateOption(index, { label: event.target.value })} disabled={saving} /></CCol>
                            <CCol md={3}><CFormLabel>Value</CFormLabel><CFormInput value={option.value} onChange={(event) => updateOption(index, { value: event.target.value })} disabled={saving} /></CCol>
                            <CCol md={2}><CFormLabel>Order</CFormLabel><CFormInput type='number' value={option.order} onChange={(event) => updateOption(index, { order: Number(event.target.value || 0) })} disabled={saving} /></CCol>
                            <CCol md={3} className='d-flex align-items-end gap-3'>
                              {form.type === 'single_choice' ? <CFormCheck type='radio' name='single-correct' label='Đáp án đúng' checked={option.isCorrect === true} onChange={() => setForm((prev) => ({ ...prev, options: prev.options.map((item, itemIndex) => ({ ...item, isCorrect: itemIndex === index })) }))} /> : null}
                              {form.type !== 'single_choice' ? <CFormCheck label='Đáp án đúng' checked={option.isCorrect === true} onChange={(event) => updateOption(index, { isCorrect: event.target.checked })} /> : null}
                            </CCol>
                            <CCol md={2} className='d-flex align-items-end gap-2'>
                              <CButton size='sm' color='secondary' variant='outline' onClick={() => moveOption(index, 'up')}>↑</CButton>
                              <CButton size='sm' color='secondary' variant='outline' onClick={() => moveOption(index, 'down')}>↓</CButton>
                              <CButton size='sm' color='danger' variant='outline' onClick={() => removeOption(index)}>Xóa</CButton>
                            </CCol>
                            <CCol md={8}><CFormLabel>Content</CFormLabel><CFormTextarea rows={2} value={option.content} onChange={(event) => updateOption(index, { content: event.target.value })} disabled={saving} /></CCol>
                            <CCol md={4}>
                              <CFormLabel>Image Asset</CFormLabel>
                              <div className='d-flex gap-2 mb-2'>
                                <CButton color='secondary' variant='outline' onClick={() => setPickerIndex(index)} size='sm'>Chọn / Upload</CButton>
                                {option.imageAsset ? <CButton color='danger' variant='outline' size='sm' onClick={() => updateOption(index, { imageAsset: null })}>Bỏ hình</CButton> : null}
                              </div>
                                  {option.imageAsset ? <img src={getFileAssetUrl(option.imageAsset)} alt={option.label || `option-${index + 1}`} style={{ width: '100%', maxHeight: 140, objectFit: 'contain', borderRadius: 12 }} /> : <div className='small text-body-secondary'>Chỉ text hoặc chọn image asset.</div>}
                            </CCol>
                            <CCol xs={12}><CFormLabel>Explanation</CFormLabel><CFormTextarea rows={2} value={option.explanation} onChange={(event) => updateOption(index, { explanation: event.target.value })} disabled={saving} /></CCol>
                          </CRow>
                        </CCardBody>
                      </CCard>
                    ))}
                  </CCol>
                ) : null}

                <CCol xs={12}>
                  <CAccordion alwaysOpen>
                    <CAccordionItem itemKey={1}>
                      <CAccordionHeader>Advanced</CAccordionHeader>
                      <CAccordionBody>
                        <CRow className='g-3'>
                          {!showOptions ? <CCol xs={12}><CFormLabel>Correct Answer (JSON)</CFormLabel><CFormTextarea rows={3} value={form.correctAnswer} onChange={(event) => setForm((prev) => ({ ...prev, correctAnswer: event.target.value }))} disabled={saving} /></CCol> : null}
                          <CCol xs={12}><CFormLabel>Explanation</CFormLabel><CFormTextarea rows={3} value={form.explanation} onChange={(event) => setForm((prev) => ({ ...prev, explanation: event.target.value }))} disabled={saving} /></CCol>
                          <CCol xs={12}><CFormLabel>Rubric (JSON)</CFormLabel><CFormTextarea rows={3} value={form.rubric} onChange={(event) => setForm((prev) => ({ ...prev, rubric: event.target.value }))} disabled={saving} /></CCol>
                          <CCol xs={12}><CFormLabel>Quan hệ công thức</CFormLabel><CFormSelect multiple value={form.formulas} onChange={(event) => handleMultiSelect(event, 'formulas')} disabled={saving} style={{ minHeight: 120 }}>{formulas.map((item) => <option key={getEntityId(item)} value={getEntityId(item)}>{item.title || item.code}</option>)}</CFormSelect></CCol>
                        </CRow>
                      </CAccordionBody>
                    </CAccordionItem>
                  </CAccordion>
                </CCol>
              </CRow>
            </CCol>
            <CCol lg={4}>
              <div className='d-flex justify-content-between align-items-center mb-2'>
                <strong>Xem trước</strong>
                <CBadge color='secondary'>{getQuestionTypeLabel(form.type)}</CBadge>
              </div>
              <QuestionPreview question={previewQuestion} />
            </CCol>
          </CRow>
        </CModalBody>
        <CModalFooter>
          <CButton color='secondary' variant='outline' onClick={handleClose} disabled={saving}>Đóng</CButton>
          <CButton color='primary' onClick={handleSave} disabled={saving}>{saving ? 'Đang lưu...' : 'Lưu câu hỏi'}</CButton>
        </CModalFooter>
      </CModal>

      <FileAssetPickerModal
        visible={pickerIndex >= 0}
        acceptedKind='image'
        title='Chọn image asset cho option'
        moduleKey='question-bank'
        onClose={() => setPickerIndex(-1)}
        onSelect={(fileAsset) => {
          updateOption(pickerIndex, { imageAsset: fileAsset })
          setPickerIndex(-1)
        }}
      />

      <CModal visible={Boolean(quickModal)} backdrop='static' onClose={() => !quickSaving && setQuickModal('')}>
        <CModalHeader>
          <CModalTitle>{`Tạo nhanh ${quickModal || ''}`}</CModalTitle>
        </CModalHeader>
        <CModalBody>
          {quickError ? <CAlert color='danger'>{quickError}</CAlert> : null}
          <CRow className='g-3'>
            <CCol md={4}><CFormLabel>Code</CFormLabel><CFormInput value={quickForm.code} onChange={(event) => setQuickForm((prev) => ({ ...prev, code: event.target.value }))} /></CCol>
            <CCol md={8}><CFormLabel>Title</CFormLabel><CFormInput value={quickForm.title} onChange={(event) => setQuickForm((prev) => ({ ...prev, title: event.target.value }))} /></CCol>
            {(quickModal === 'skill' || quickModal === 'knowledgeNode') ? <CCol md={6}><CFormLabel>Môn học</CFormLabel><CFormSelect value={quickForm.subject} onChange={(event) => setQuickForm((prev) => ({ ...prev, subject: event.target.value }))}><option value=''>Không chọn</option>{subjects.map((item) => <option key={getEntityId(item)} value={getEntityId(item)}>{item.title || item.code}</option>)}</CFormSelect></CCol> : null}
            {(quickModal === 'skill' || quickModal === 'knowledgeNode') ? <CCol md={6}><CFormLabel>Khối</CFormLabel><CFormSelect value={quickForm.grade} onChange={(event) => setQuickForm((prev) => ({ ...prev, grade: event.target.value }))}><option value=''>Không chọn</option>{grades.map((item) => <option key={getEntityId(item)} value={getEntityId(item)}>{item.title || item.code}</option>)}</CFormSelect></CCol> : null}
            {quickModal === 'skill' ? <CCol md={6}><CFormLabel>Level</CFormLabel><CFormSelect value={quickForm.level} onChange={(event) => setQuickForm((prev) => ({ ...prev, level: event.target.value }))}>{skillLevels.map((item) => <option key={item} value={item}>{item}</option>)}</CFormSelect></CCol> : null}
            {quickModal === 'skill' ? <CCol md={6}><CFormLabel>Chủ đề kiến thức</CFormLabel><CFormSelect value={quickForm.parent} onChange={(event) => setQuickForm((prev) => ({ ...prev, parent: event.target.value }))}><option value=''>Không chọn</option>{knowledgeNodes.map((item) => <option key={getEntityId(item)} value={getEntityId(item)}>{item.title || item.code}</option>)}</CFormSelect></CCol> : null}
            {quickModal === 'knowledgeNode' ? <CCol md={6}><CFormLabel>Node cha</CFormLabel><CFormSelect value={quickForm.parent} onChange={(event) => setQuickForm((prev) => ({ ...prev, parent: event.target.value }))}><option value=''>Không chọn</option>{knowledgeNodes.map((item) => <option key={getEntityId(item)} value={getEntityId(item)}>{item.title || item.code}</option>)}</CFormSelect></CCol> : null}
            <CCol xs={12}><CFormLabel>Description</CFormLabel><CFormTextarea rows={3} value={quickForm.description} onChange={(event) => setQuickForm((prev) => ({ ...prev, description: event.target.value }))} /></CCol>
          </CRow>
        </CModalBody>
        <CModalFooter>
          <CButton color='secondary' variant='outline' onClick={() => setQuickModal('')} disabled={quickSaving}>Đóng</CButton>
          <CButton color='primary' onClick={handleQuickCreate} disabled={quickSaving}>{quickSaving ? 'Đang tạo...' : 'Tạo nhanh'}</CButton>
        </CModalFooter>
      </CModal>

      <QuestionStimulusEditorModal
        visible={showStimulusModal}
        saving={saving}
        editingStimulus={null}
        onClose={() => setShowStimulusModal(false)}
        onSubmit={handleQuickCreateStimulus}
      />
    </>
  )
}
