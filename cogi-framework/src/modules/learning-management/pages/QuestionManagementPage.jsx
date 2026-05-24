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
  createQuestion,
  deleteQuestion,
  getLearningManagementBootstrap,
  getQuestions,
  updateQuestion,
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

function getEntityId(entity) {
  if (!entity) return ''
  return entity.documentId || entity.id || ''
}

function createQuestionOption(index = 0) {
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
    options: [createQuestionOption(0), createQuestionOption(1)],
  }
}

function normalizeQuestionForm(question) {
  return {
    code: question?.code || '',
    title: question?.title || '',
    questionText: question?.questionText || '',
    type: question?.type || 'single_choice',
    subject: getEntityId(question?.subject),
    grade: getEntityId(question?.grade),
    knowledgeNode: getEntityId(question?.knowledgeNode),
    difficulty: question?.difficulty || '',
    skills: Array.isArray(question?.skills) ? question.skills.map((item) => getEntityId(item)).filter(Boolean) : [],
    formulas: Array.isArray(question?.formulas) ? question.formulas.map((item) => getEntityId(item)).filter(Boolean) : [],
    correctAnswer: question?.correctAnswer ? JSON.stringify(question.correctAnswer, null, 2) : '',
    explanation: question?.explanation || '',
    rubric: question?.rubric ? JSON.stringify(question.rubric, null, 2) : '',
    questionStatus: question?.questionStatus || 'active',
    options: Array.isArray(question?.options) && question.options.length > 0
      ? question.options.map((option, index) => ({
          label: option?.label || '',
          value: option?.value || '',
          content: option?.content || '',
          isCorrect: option?.isCorrect === true,
          order: String(option?.order ?? index),
          explanation: option?.explanation || '',
          clientKey: String(option?.documentId || option?.id || `option-${index}`),
        }))
      : [createQuestionOption(0), createQuestionOption(1)],
  }
}

function shouldShowQuestionOptions(type) {
  return ['single_choice', 'multiple_choice', 'true_false'].includes(String(type || '').toLowerCase())
}

function parseOptionalJson(rawValue, label) {
  const text = String(rawValue || '').trim()
  if (!text) return null
  try {
    return JSON.parse(text)
  } catch {
    throw new Error(`${label} phải là JSON hợp lệ`)
  }
}

function formatDateTime(value) {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '-'
  return date.toLocaleString()
}

export default function QuestionManagementPage() {
  const [bootstrapping, setBootstrapping] = useState(true)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [bootstrap, setBootstrap] = useState(null)
  const [rows, setRows] = useState([])
  const [meta, setMeta] = useState(null)
  const [qDraft, setQDraft] = useState('')
  const [q, setQ] = useState('')
  const [typeFilter, setTypeFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [success, setSuccess] = useState('')
  const [error, setError] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [editingQuestion, setEditingQuestion] = useState(null)
  const [questionForm, setQuestionForm] = useState(emptyQuestionForm())

  const subjects = bootstrap?.subjects || []
  const grades = bootstrap?.grades || []
  const knowledgeNodes = bootstrap?.knowledgeNodes || []
  const skills = bootstrap?.skills || []
  const formulas = bootstrap?.formulas || []
  const questionTypes = bootstrap?.questionTypes || []
  const questionStatuses = bootstrap?.questionStatuses || []
  const pageCount = meta?.pagination?.pageCount || 1
  const total = meta?.pagination?.total || 0
  const pages = useMemo(() => buildPages(page, pageCount), [page, pageCount])
  const showOptionsEditor = shouldShowQuestionOptions(questionForm.type)

  useEffect(() => {
    async function loadBootstrap() {
      setBootstrapping(true)
      try {
        const payload = await getLearningManagementBootstrap()
        setBootstrap(payload)
      } catch (loadError) {
        setError(getApiMessage(loadError, 'Không tải được dữ liệu khởi tạo câu hỏi'))
      } finally {
        setBootstrapping(false)
      }
    }

    loadBootstrap()
  }, [])

  useEffect(() => {
    loadQuestions()
  }, [page, pageSize, q, typeFilter, statusFilter])

  async function loadQuestions() {
    setLoading(true)
    setError('')

    try {
      const payload = await getQuestions({
        page,
        pageSize,
        q,
        type: typeFilter || undefined,
        questionStatus: statusFilter || undefined,
      })
      setRows(Array.isArray(payload?.data) ? payload.data : [])
      setMeta(payload?.meta || null)
    } catch (loadError) {
      setRows([])
      setMeta(null)
      setError(getApiMessage(loadError, 'Không tải được danh sách câu hỏi'))
    } finally {
      setLoading(false)
    }
  }

  function resetForm() {
    setQuestionForm(emptyQuestionForm())
    setEditingQuestion(null)
  }

  function closeModal() {
    if (saving) return
    setShowModal(false)
    resetForm()
  }

  function openCreateModal() {
    resetForm()
    setShowModal(true)
  }

  function openEditModal(question) {
    setEditingQuestion(question)
    setQuestionForm(normalizeQuestionForm(question))
    setShowModal(true)
  }

  function applySearch() {
    setPage(1)
    setQ(String(qDraft || '').trim())
  }

  function resetFilters() {
    setQDraft('')
    setQ('')
    setTypeFilter('')
    setStatusFilter('')
    setPage(1)
  }

  function updateQuestionOption(index, field, value) {
    setQuestionForm((prev) => ({
      ...prev,
      options: (prev.options || []).map((option, optionIndex) => (optionIndex === index ? { ...option, [field]: value } : option)),
    }))
  }

  function addQuestionOption() {
    setQuestionForm((prev) => ({
      ...prev,
      options: [...(prev.options || []), createQuestionOption(prev.options?.length || 0)],
    }))
  }

  function removeQuestionOption(index) {
    setQuestionForm((prev) => ({
      ...prev,
      options: (prev.options || []).filter((_, optionIndex) => optionIndex !== index),
    }))
  }

  function handleMultiSelect(event, key) {
    const values = Array.from(event.target.selectedOptions || []).map((option) => option.value)
    setQuestionForm((prev) => ({ ...prev, [key]: values }))
  }

  async function handleSubmit() {
    if (!String(questionForm.code || '').trim()) {
      setError('Code là bắt buộc')
      return
    }

    if (!String(questionForm.questionText || '').trim()) {
      setError('Question Text là bắt buộc')
      return
    }

    let correctAnswer = null
    let rubric = null
    try {
      correctAnswer = parseOptionalJson(questionForm.correctAnswer, 'Correct Answer')
      rubric = parseOptionalJson(questionForm.rubric, 'Rubric')
    } catch (parseError) {
      setError(parseError.message)
      return
    }

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
      options: showOptionsEditor
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
    setSuccess('')

    try {
      if (editingQuestion) {
        await updateQuestion(getEntityId(editingQuestion), payload)
        setSuccess('Cập nhật câu hỏi thành công')
      } else {
        await createQuestion(payload)
        setSuccess('Tạo câu hỏi thành công')
      }
      closeModal()
      await loadQuestions()
    } catch (submitError) {
      setError(getApiMessage(submitError, 'Không thể lưu câu hỏi'))
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(question) {
    if (!window.confirm(`Bạn chắc chắn muốn xóa câu hỏi ${question?.code || ''}?`)) return
    setSaving(true)
    setError('')
    setSuccess('')
    try {
      await deleteQuestion(getEntityId(question))
      setSuccess('Xóa câu hỏi thành công')
      await loadQuestions()
    } catch (deleteError) {
      setError(getApiMessage(deleteError, 'Không thể xóa câu hỏi'))
    } finally {
      setSaving(false)
    }
  }

  if (bootstrapping) {
    return (
      <div className='py-4 d-flex align-items-center gap-2'>
        <CSpinner size='sm' />
        <span>Đang tải dữ liệu câu hỏi...</span>
      </div>
    )
  }

  return (
    <CRow className='g-0'>
      <CCol xs={12}>
        <CCard className='mb-4 ai-card'>
          <CCardHeader>
            <strong>Bộ lọc</strong>
          </CCardHeader>
          <CCardBody>
            <CRow className='g-3 ai-form align-items-end'>
              <CCol md={5}>
                <CFormInput
                  label='Từ khóa'
                  placeholder='Tìm theo code, title, question text...'
                  value={qDraft}
                  onChange={(event) => setQDraft(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') applySearch()
                  }}
                />
              </CCol>
              <CCol md={3}>
                <CFormLabel>Loại câu hỏi</CFormLabel>
                <CFormSelect value={typeFilter} onChange={(event) => { setTypeFilter(event.target.value); setPage(1) }}>
                  <option value=''>Tất cả</option>
                  {questionTypes.map((item) => <option key={item} value={item}>{item}</option>)}
                </CFormSelect>
              </CCol>
              <CCol md={2}>
                <CFormLabel>Trạng thái</CFormLabel>
                <CFormSelect value={statusFilter} onChange={(event) => { setStatusFilter(event.target.value); setPage(1) }}>
                  <option value=''>Tất cả</option>
                  {questionStatuses.map((item) => <option key={item} value={item}>{item}</option>)}
                </CFormSelect>
              </CCol>
              <CCol md={2} className='d-flex justify-content-end gap-2'>
                <CButton color='primary' onClick={applySearch} disabled={loading}>Search</CButton>
                <CButton color='secondary' variant='outline' onClick={resetFilters} disabled={loading}>Reset</CButton>
              </CCol>
            </CRow>
          </CCardBody>
        </CCard>

        {success ? <CAlert color='success' className='mb-4'>{success}</CAlert> : null}
        {error ? <CAlert color='danger' className='mb-4'>{error}</CAlert> : null}

        <CCard className='ai-card'>
          <CCardHeader className='d-flex align-items-center justify-content-between gap-2 flex-wrap'>
            <div>
              <strong>Questions</strong>
              <CBadge color='secondary' className='ms-2'>{total}</CBadge>
            </div>
            <CButton color='success' onClick={openCreateModal} disabled={loading}>+ Thêm mới</CButton>
          </CCardHeader>
          <CCardBody>
            {loading ? (
              <div className='d-flex align-items-center gap-2'>
                <CSpinner size='sm' />
                <span>Đang tải dữ liệu...</span>
              </div>
            ) : (
              <>
                <CTable hover responsive className='mb-3 ai-table'>
                  <CTableHead>
                    <CTableRow>
                      <CTableHeaderCell style={{ width: 70 }}>#</CTableHeaderCell>
                      <CTableHeaderCell style={{ width: 140 }}>Code</CTableHeaderCell>
                      <CTableHeaderCell style={{ minWidth: 280 }}>Nội dung</CTableHeaderCell>
                      <CTableHeaderCell style={{ width: 160 }}>Loại</CTableHeaderCell>
                      <CTableHeaderCell style={{ width: 160 }}>Subject</CTableHeaderCell>
                      <CTableHeaderCell style={{ width: 160 }}>Grade</CTableHeaderCell>
                      <CTableHeaderCell style={{ width: 100 }}>Options</CTableHeaderCell>
                      <CTableHeaderCell style={{ width: 180 }}>Cập nhật</CTableHeaderCell>
                      <CTableHeaderCell style={{ width: 180 }}>Hành động</CTableHeaderCell>
                    </CTableRow>
                  </CTableHead>
                  <CTableBody>
                    {rows.length === 0 ? (
                      <CTableRow>
                        <CTableDataCell colSpan={9} className='text-center text-body-secondary'>Không có dữ liệu</CTableDataCell>
                      </CTableRow>
                    ) : rows.map((item, index) => (
                      <CTableRow key={getEntityId(item) || `${item?.code || 'question'}-${index}`}>
                        <CTableDataCell>{(page - 1) * pageSize + index + 1}</CTableDataCell>
                        <CTableDataCell>{item?.code || '-'}</CTableDataCell>
                        <CTableDataCell>
                          <div className='fw-semibold'>{item?.title || 'Không có tiêu đề'}</div>
                          <div className='small text-body-secondary'>{item?.questionText || '-'}</div>
                        </CTableDataCell>
                        <CTableDataCell>{item?.type || '-'}</CTableDataCell>
                        <CTableDataCell>{item?.subject?.title || '-'}</CTableDataCell>
                        <CTableDataCell>{item?.grade?.title || '-'}</CTableDataCell>
                        <CTableDataCell>{Array.isArray(item?.options) ? item.options.length : 0}</CTableDataCell>
                        <CTableDataCell>{formatDateTime(item?.updatedAt)}</CTableDataCell>
                        <CTableDataCell>
                          <div className='d-flex gap-2'>
                            <CButton size='sm' color='info' variant='outline' onClick={() => openEditModal(item)}>Sửa</CButton>
                            <CButton size='sm' color='danger' variant='outline' onClick={() => handleDelete(item)}>Xóa</CButton>
                          </div>
                        </CTableDataCell>
                      </CTableRow>
                    ))}
                  </CTableBody>
                </CTable>

                <div className='d-flex flex-wrap justify-content-between align-items-center gap-2'>
                  <div className='small text-body-secondary'>
                    {total > 0 ? `${(page - 1) * pageSize + 1}–${Math.min(page * pageSize, total)}/${total}` : '0'}
                  </div>
                  <div className='d-flex align-items-center gap-2'>
                    <CFormSelect value={pageSize} onChange={(event) => { setPageSize(Number(event.target.value || 10)); setPage(1) }} style={{ width: 100 }}>
                      {[10, 20, 50].map((size) => <option key={size} value={size}>{size}/trang</option>)}
                    </CFormSelect>
                    <CPagination align='end' className='mb-0'>
                      <CPaginationItem disabled={page <= 1 || loading} onClick={() => setPage((prev) => Math.max(1, prev - 1))}>Trước</CPaginationItem>
                      {pages.map((item, index) => item === '...'
                        ? <CPaginationItem key={`ellipsis-${index}`} disabled>…</CPaginationItem>
                        : <CPaginationItem key={item} active={item === page} disabled={loading} onClick={() => setPage(item)}>{item}</CPaginationItem>)}
                      <CPaginationItem disabled={page >= pageCount || loading} onClick={() => setPage((prev) => Math.min(pageCount, prev + 1))}>Sau</CPaginationItem>
                    </CPagination>
                  </div>
                </div>
              </>
            )}
          </CCardBody>
        </CCard>

        <CModal visible={showModal} backdrop='static' size='xl' onClose={closeModal}>
          <CModalHeader>
            <CModalTitle>{editingQuestion ? 'Sửa câu hỏi' : 'Thêm câu hỏi'}</CModalTitle>
          </CModalHeader>
          <CModalBody>
            <CRow className='g-3'>
              <CCol md={4}><CFormLabel>Code</CFormLabel><CFormInput value={questionForm.code} onChange={(event) => setQuestionForm((prev) => ({ ...prev, code: event.target.value }))} disabled={saving} /></CCol>
              <CCol md={8}><CFormLabel>Title</CFormLabel><CFormInput value={questionForm.title} onChange={(event) => setQuestionForm((prev) => ({ ...prev, title: event.target.value }))} disabled={saving} /></CCol>
              <CCol xs={12}><CFormLabel>Question Text</CFormLabel><CFormTextarea rows={4} value={questionForm.questionText} onChange={(event) => setQuestionForm((prev) => ({ ...prev, questionText: event.target.value }))} disabled={saving} /></CCol>
              <CCol md={4}><CFormLabel>Type</CFormLabel><CFormSelect value={questionForm.type} onChange={(event) => setQuestionForm((prev) => ({ ...prev, type: event.target.value }))} disabled={saving}>{questionTypes.map((item) => <option key={item} value={item}>{item}</option>)}</CFormSelect></CCol>
              <CCol md={4}><CFormLabel>Subject</CFormLabel><CFormSelect value={questionForm.subject} onChange={(event) => setQuestionForm((prev) => ({ ...prev, subject: event.target.value }))} disabled={saving}><option value=''>Chọn</option>{subjects.map((item) => <option key={getEntityId(item)} value={getEntityId(item)}>{item.title || item.code}</option>)}</CFormSelect></CCol>
              <CCol md={4}><CFormLabel>Grade</CFormLabel><CFormSelect value={questionForm.grade} onChange={(event) => setQuestionForm((prev) => ({ ...prev, grade: event.target.value }))} disabled={saving}><option value=''>Chọn</option>{grades.map((item) => <option key={getEntityId(item)} value={getEntityId(item)}>{item.title || item.code}</option>)}</CFormSelect></CCol>
              <CCol md={4}><CFormLabel>Knowledge Node</CFormLabel><CFormSelect value={questionForm.knowledgeNode} onChange={(event) => setQuestionForm((prev) => ({ ...prev, knowledgeNode: event.target.value }))} disabled={saving}><option value=''>Chọn</option>{knowledgeNodes.map((item) => <option key={getEntityId(item)} value={getEntityId(item)}>{item.title || item.code}</option>)}</CFormSelect></CCol>
              <CCol md={4}><CFormLabel>Difficulty</CFormLabel><CFormSelect value={questionForm.difficulty} onChange={(event) => setQuestionForm((prev) => ({ ...prev, difficulty: event.target.value }))} disabled={saving}><option value=''>Chọn</option>{(bootstrap?.difficulties || []).map((item) => <option key={item} value={item}>{item}</option>)}</CFormSelect></CCol>
              <CCol md={4}><CFormLabel>Question Status</CFormLabel><CFormSelect value={questionForm.questionStatus} onChange={(event) => setQuestionForm((prev) => ({ ...prev, questionStatus: event.target.value }))} disabled={saving}>{questionStatuses.map((item) => <option key={item} value={item}>{item}</option>)}</CFormSelect></CCol>
              <CCol md={6}><CFormLabel>Skills</CFormLabel><CFormSelect multiple value={questionForm.skills} onChange={(event) => handleMultiSelect(event, 'skills')} disabled={saving} style={{ minHeight: 120 }}>{skills.map((item) => <option key={getEntityId(item)} value={getEntityId(item)}>{item.title || item.code}</option>)}</CFormSelect></CCol>
              <CCol md={6}><CFormLabel>Formulas</CFormLabel><CFormSelect multiple value={questionForm.formulas} onChange={(event) => handleMultiSelect(event, 'formulas')} disabled={saving} style={{ minHeight: 120 }}>{formulas.map((item) => <option key={getEntityId(item)} value={getEntityId(item)}>{item.title || item.code}</option>)}</CFormSelect></CCol>
              <CCol xs={12}><CFormLabel>Correct Answer (JSON)</CFormLabel><CFormTextarea rows={3} value={questionForm.correctAnswer} onChange={(event) => setQuestionForm((prev) => ({ ...prev, correctAnswer: event.target.value }))} disabled={saving} /></CCol>
              <CCol xs={12}><CFormLabel>Explanation</CFormLabel><CFormTextarea rows={3} value={questionForm.explanation} onChange={(event) => setQuestionForm((prev) => ({ ...prev, explanation: event.target.value }))} disabled={saving} /></CCol>
              <CCol xs={12}><CFormLabel>Rubric (JSON)</CFormLabel><CFormTextarea rows={3} value={questionForm.rubric} onChange={(event) => setQuestionForm((prev) => ({ ...prev, rubric: event.target.value }))} disabled={saving} /></CCol>
            </CRow>

            {showOptionsEditor ? (
              <div className='mt-4'>
                <div className='d-flex justify-content-between align-items-center mb-2'>
                  <strong>Question Options</strong>
                  <CButton size='sm' color='secondary' variant='outline' onClick={addQuestionOption} disabled={saving}>Thêm option</CButton>
                </div>
                {(questionForm.options || []).map((option, index) => (
                  <CCard key={option.clientKey || index} className='mb-3'>
                    <CCardBody>
                      <CRow className='g-3'>
                        <CCol md={3}><CFormLabel>Label</CFormLabel><CFormInput value={option.label} onChange={(event) => updateQuestionOption(index, 'label', event.target.value)} disabled={saving} /></CCol>
                        <CCol md={3}><CFormLabel>Value</CFormLabel><CFormInput value={option.value} onChange={(event) => updateQuestionOption(index, 'value', event.target.value)} disabled={saving} /></CCol>
                        <CCol md={2}><CFormLabel>Order</CFormLabel><CFormInput type='number' value={option.order} onChange={(event) => updateQuestionOption(index, 'order', event.target.value)} disabled={saving} /></CCol>
                        <CCol md={2}><CFormLabel>Đúng?</CFormLabel><CFormSelect value={option.isCorrect ? 'true' : 'false'} onChange={(event) => updateQuestionOption(index, 'isCorrect', event.target.value === 'true')} disabled={saving}><option value='false'>Sai</option><option value='true'>Đúng</option></CFormSelect></CCol>
                        <CCol md={2} className='d-flex align-items-end'><CButton color='danger' variant='outline' onClick={() => removeQuestionOption(index)} disabled={saving}>Xóa</CButton></CCol>
                        <CCol xs={12}><CFormLabel>Content</CFormLabel><CFormTextarea rows={2} value={option.content} onChange={(event) => updateQuestionOption(index, 'content', event.target.value)} disabled={saving} /></CCol>
                        <CCol xs={12}><CFormLabel>Explanation</CFormLabel><CFormTextarea rows={2} value={option.explanation} onChange={(event) => updateQuestionOption(index, 'explanation', event.target.value)} disabled={saving} /></CCol>
                      </CRow>
                    </CCardBody>
                  </CCard>
                ))}
              </div>
            ) : null}
          </CModalBody>
          <CModalFooter>
            <CButton color='secondary' variant='outline' onClick={closeModal} disabled={saving}>Hủy</CButton>
            <CButton color='primary' onClick={handleSubmit} disabled={saving}>{saving ? 'Đang lưu...' : 'Lưu'}</CButton>
          </CModalFooter>
        </CModal>
      </CCol>
    </CRow>
  )
}