import { useEffect, useMemo, useState } from 'react'
import {
  CAlert,
  CBadge,
  CButton,
  CCard,
  CCardBody,
  CCardHeader,
  CCol,
  CForm,
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
  createSurveyQuestion,
  createSurveySection,
  createSurveyTemplate,
  deleteSurveyQuestion,
  deleteSurveySection,
  deleteSurveyTemplate,
  getSurveyQuestionManagementBootstrap,
  getSurveyQuestions,
  updateSurveyQuestion,
  updateSurveySection,
  updateSurveyTemplate,
} from '../services/surveyQuestionManagementService'

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

function formatQuestionType(value) {
  switch (String(value || '').toUpperCase()) {
    case 'LIKERT_1_5':
      return 'Likert 1-5'
    case 'SINGLE_CHOICE':
      return 'Một lựa chọn'
    case 'MULTI_CHOICE':
      return 'Nhiều lựa chọn'
    case 'TEXT':
      return 'Tự luận'
    default:
      return value || '-'
  }
}

function formatTemplateType(value) {
  switch (String(value || '').toUpperCase()) {
    case 'TEACHING_EVALUATION':
      return 'Đánh giá giảng dạy'
    case 'GRADUATION_EXIT':
      return 'Khảo sát tốt nghiệp'
    default:
      return value || '-'
  }
}

function emptyTemplateForm() {
  return {
    name: '',
    code: '',
    type: 'TEACHING_EVALUATION',
    description: '',
    isActive: true,
  }
}

function emptySectionForm(templateId = '') {
  return {
    title: '',
    order: '0',
    templateId: templateId ? String(templateId) : '',
  }
}

function emptyQuestionForm(sectionId = '') {
  return {
    content: '',
    type: 'TEXT',
    isRequired: false,
    order: '0',
    sectionId: sectionId ? String(sectionId) : '',
    options: [],
  }
}

function createLikertOptions() {
  return [
    { label: '1 - Kém', value: '1', order: '1', clientKey: 'likert-1' },
    { label: '2 - Trung bình', value: '2', order: '2', clientKey: 'likert-2' },
    { label: '3 - Khá', value: '3', order: '3', clientKey: 'likert-3' },
    { label: '4 - Tốt', value: '4', order: '4', clientKey: 'likert-4' },
    { label: '5 - Rất tốt', value: '5', order: '5', clientKey: 'likert-5' },
  ]
}

function normalizeOption(option, index) {
  return {
    id: option?.id || null,
    label: String(option?.label || ''),
    value: String(option?.value || ''),
    order: String(option?.order ?? index),
    clientKey: String(option?.clientKey || option?.id || `option-${index}`),
  }
}

function isOptionBasedQuestionType(type) {
  return ['LIKERT_1_5', 'SINGLE_CHOICE', 'MULTI_CHOICE'].includes(String(type || '').toUpperCase())
}

export default function SurveyQuestionManagementPage() {
  const [bootstrapLoading, setBootstrapLoading] = useState(true)
  const [questionLoading, setQuestionLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const [templates, setTemplates] = useState([])
  const [questionTypes, setQuestionTypes] = useState([])
  const [templateTypes, setTemplateTypes] = useState([])
  const [questionRows, setQuestionRows] = useState([])
  const [questionMeta, setQuestionMeta] = useState(null)

  const [templateFilter, setTemplateFilter] = useState('')
  const [sectionFilter, setSectionFilter] = useState('')
  const [questionTypeFilter, setQuestionTypeFilter] = useState('')
  const [qDraft, setQDraft] = useState('')
  const [q, setQ] = useState('')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)

  const [success, setSuccess] = useState('')
  const [error, setError] = useState('')

  const [showTemplateModal, setShowTemplateModal] = useState(false)
  const [showSectionModal, setShowSectionModal] = useState(false)
  const [showQuestionModal, setShowQuestionModal] = useState(false)
  const [editingTemplateId, setEditingTemplateId] = useState(null)
  const [editingSectionId, setEditingSectionId] = useState(null)
  const [editingQuestionId, setEditingQuestionId] = useState(null)
  const [templateForm, setTemplateForm] = useState(emptyTemplateForm)
  const [sectionForm, setSectionForm] = useState(emptySectionForm)
  const [questionForm, setQuestionForm] = useState(emptyQuestionForm)

  const allSections = useMemo(
    () => templates.flatMap((template) => (Array.isArray(template?.sections) ? template.sections : [])),
    [templates],
  )

  const filteredSections = useMemo(() => {
    if (!templateFilter) return allSections
    return allSections.filter((section) => String(section?.template?.id || '') === String(templateFilter))
  }, [allSections, templateFilter])

  const selectedTemplate = useMemo(
    () => templates.find((template) => String(template?.id || '') === String(templateFilter)) || null,
    [templates, templateFilter],
  )

  const totalQuestions = questionMeta?.pagination?.total ?? 0
  const pageCount = questionMeta?.pagination?.pageCount ?? 1
  const pages = useMemo(() => buildPages(page, pageCount), [page, pageCount])

  const fromToText = useMemo(() => {
    const pagination = questionMeta?.pagination
    if (!pagination || totalQuestions === 0) return '0'
    const from = (pagination.page - 1) * pagination.pageSize + 1
    const to = Math.min(pagination.page * pagination.pageSize, totalQuestions)
    return `${from}–${to}/${totalQuestions}`
  }, [questionMeta, totalQuestions])

  const questionSectionOptions = useMemo(() => {
    if (!questionForm.sectionId) return filteredSections
    if (!templateFilter) return allSections

    const sectionExists = filteredSections.some((section) => String(section.id) === String(questionForm.sectionId))
    return sectionExists ? filteredSections : allSections
  }, [allSections, filteredSections, questionForm.sectionId, templateFilter])

  const showOptionsEditor = isOptionBasedQuestionType(questionForm.type)

  async function loadBootstrap() {
    setBootstrapLoading(true)

    try {
      const payload = await getSurveyQuestionManagementBootstrap()
      setTemplates(Array.isArray(payload?.templates) ? payload.templates : [])
      setQuestionTypes(Array.isArray(payload?.questionTypes) ? payload.questionTypes : [])
      setTemplateTypes(Array.isArray(payload?.templateTypes) ? payload.templateTypes : [])
    } catch (loadError) {
      setTemplates([])
      setQuestionTypes([])
      setTemplateTypes([])
      setError(getApiMessage(loadError, 'Không tải được dữ liệu quản trị khảo sát'))
    } finally {
      setBootstrapLoading(false)
    }
  }

  async function loadQuestions() {
    setQuestionLoading(true)

    try {
      const payload = await getSurveyQuestions({
        page,
        pageSize,
        q,
        templateId: templateFilter || undefined,
        sectionId: sectionFilter || undefined,
        type: questionTypeFilter || undefined,
        includeInactive: true,
      })

      setQuestionRows(Array.isArray(payload?.data) ? payload.data : [])
      setQuestionMeta(payload?.meta ?? null)
    } catch (loadError) {
      setQuestionRows([])
      setQuestionMeta(null)
      setError(getApiMessage(loadError, 'Không tải được danh sách câu hỏi'))
    } finally {
      setQuestionLoading(false)
    }
  }

  async function refreshAll() {
    await Promise.all([loadBootstrap(), loadQuestions()])
  }

  useEffect(() => {
    refreshAll()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    loadQuestions()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, pageSize, q, templateFilter, sectionFilter, questionTypeFilter])

  useEffect(() => {
    if (!sectionFilter) return
    const exists = filteredSections.some((section) => String(section?.id || '') === String(sectionFilter))
    if (!exists) {
      setSectionFilter('')
      setPage(1)
    }
  }, [filteredSections, sectionFilter])

  function applySearch() {
    setPage(1)
    setQ(qDraft.trim())
  }

  function resetFilters() {
    setTemplateFilter('')
    setSectionFilter('')
    setQuestionTypeFilter('')
    setQ('')
    setQDraft('')
    setPage(1)
  }

  function openCreateTemplateModal() {
    setEditingTemplateId(null)
    setTemplateForm(emptyTemplateForm())
    setShowTemplateModal(true)
  }

  function openEditTemplateModal(template) {
    setEditingTemplateId(template.id)
    setTemplateForm({
      name: template.name || '',
      code: template.code || '',
      type: template.type || 'TEACHING_EVALUATION',
      description: template.description || '',
      isActive: template.isActive !== false,
    })
    setShowTemplateModal(true)
  }

  function openCreateSectionModal(templateId = '') {
    setEditingSectionId(null)
    setSectionForm(emptySectionForm(templateId || templateFilter || ''))
    setShowSectionModal(true)
  }

  function openEditSectionModal(section) {
    setEditingSectionId(section.id)
    setSectionForm({
      title: section.title || '',
      order: String(section.order ?? 0),
      templateId: String(section?.template?.id || ''),
    })
    setShowSectionModal(true)
  }

  function openCreateQuestionModal(sectionId = '') {
    setEditingQuestionId(null)
    setQuestionForm(emptyQuestionForm(sectionId || sectionFilter || ''))
    setShowQuestionModal(true)
  }

  function openEditQuestionModal(question) {
    setEditingQuestionId(question.id)
    setQuestionForm({
      content: question.content || '',
      type: question.type || 'TEXT',
      isRequired: question.isRequired === true,
      order: String(question.order ?? 0),
      sectionId: String(question?.section?.id || ''),
      options: Array.isArray(question?.options) ? question.options.map(normalizeOption) : [],
    })
    setShowQuestionModal(true)
  }

  function closeTemplateModal() {
    setShowTemplateModal(false)
    setEditingTemplateId(null)
    setTemplateForm(emptyTemplateForm())
  }

  function closeSectionModal() {
    setShowSectionModal(false)
    setEditingSectionId(null)
    setSectionForm(emptySectionForm())
  }

  function closeQuestionModal() {
    setShowQuestionModal(false)
    setEditingQuestionId(null)
    setQuestionForm(emptyQuestionForm())
  }

  async function handleTemplateSubmit() {
    if (!String(templateForm.name).trim()) {
      setError('Tên bộ câu hỏi không được trống')
      return
    }

    if (!String(templateForm.code).trim()) {
      setError('Mã bộ câu hỏi không được trống')
      return
    }

    setSubmitting(true)
    setError('')
    setSuccess('')

    try {
      const payload = {
        name: String(templateForm.name).trim(),
        code: String(templateForm.code).trim(),
        type: templateForm.type,
        description: String(templateForm.description || '').trim(),
        isActive: Boolean(templateForm.isActive),
      }

      if (editingTemplateId) {
        await updateSurveyTemplate(editingTemplateId, payload)
        setSuccess('Cập nhật bộ câu hỏi thành công')
      } else {
        await createSurveyTemplate(payload)
        setSuccess('Tạo bộ câu hỏi thành công')
      }

      closeTemplateModal()
      await refreshAll()
    } catch (submitError) {
      setError(getApiMessage(submitError, 'Không thể lưu bộ câu hỏi'))
    } finally {
      setSubmitting(false)
    }
  }

  async function handleSectionSubmit() {
    if (!String(sectionForm.templateId).trim()) {
      setError('Bạn cần chọn bộ câu hỏi cho mục khảo sát')
      return
    }

    if (!String(sectionForm.title).trim()) {
      setError('Tên mục khảo sát không được trống')
      return
    }

    setSubmitting(true)
    setError('')
    setSuccess('')

    try {
      const payload = {
        templateId: Number(sectionForm.templateId),
        title: String(sectionForm.title).trim(),
        order: sectionForm.order === '' ? 0 : Number(sectionForm.order || 0),
      }

      if (editingSectionId) {
        await updateSurveySection(editingSectionId, payload)
        setSuccess('Cập nhật mục khảo sát thành công')
      } else {
        await createSurveySection(payload)
        setSuccess('Tạo mục khảo sát thành công')
      }

      closeSectionModal()
      await refreshAll()
    } catch (submitError) {
      setError(getApiMessage(submitError, 'Không thể lưu mục khảo sát'))
    } finally {
      setSubmitting(false)
    }
  }

  async function handleQuestionSubmit() {
    if (!String(questionForm.sectionId).trim()) {
      setError('Bạn cần chọn mục khảo sát')
      return
    }

    if (!String(questionForm.content).trim()) {
      setError('Nội dung câu hỏi không được trống')
      return
    }

    const requiresOptions = isOptionBasedQuestionType(questionForm.type)
    const normalizedOptions = (Array.isArray(questionForm.options) ? questionForm.options : [])
      .map((option, index) => ({
        label: String(option?.label || '').trim(),
        value: String(option?.value || '').trim(),
        order: option?.order === '' ? index : Number(option?.order ?? index),
      }))
      .filter((option) => option.label && option.value)

    if (requiresOptions && normalizedOptions.length === 0) {
      setError('Câu hỏi lựa chọn cần ít nhất một đáp án')
      return
    }

    setSubmitting(true)
    setError('')
    setSuccess('')

    try {
      const payload = {
        sectionId: Number(questionForm.sectionId),
        content: String(questionForm.content).trim(),
        type: questionForm.type,
        isRequired: Boolean(questionForm.isRequired),
        order: questionForm.order === '' ? 0 : Number(questionForm.order || 0),
        options: requiresOptions ? normalizedOptions : [],
      }

      if (editingQuestionId) {
        await updateSurveyQuestion(editingQuestionId, payload)
        setSuccess('Cập nhật câu hỏi thành công')
      } else {
        await createSurveyQuestion(payload)
        setSuccess('Tạo câu hỏi thành công')
      }

      closeQuestionModal()
      await refreshAll()
    } catch (submitError) {
      setError(getApiMessage(submitError, 'Không thể lưu câu hỏi'))
    } finally {
      setSubmitting(false)
    }
  }

  async function handleDeleteTemplate(id) {
    if (!window.confirm('Bạn chắc chắn muốn xóa bộ câu hỏi này?')) return

    setError('')
    setSuccess('')

    try {
      await deleteSurveyTemplate(id)
      if (String(templateFilter) === String(id)) setTemplateFilter('')
      setSuccess('Xóa bộ câu hỏi thành công')
      await refreshAll()
    } catch (deleteError) {
      setError(getApiMessage(deleteError, 'Không thể xóa bộ câu hỏi'))
    }
  }

  async function handleDeleteSection(id) {
    if (!window.confirm('Bạn chắc chắn muốn xóa mục khảo sát này?')) return

    setError('')
    setSuccess('')

    try {
      await deleteSurveySection(id)
      if (String(sectionFilter) === String(id)) setSectionFilter('')
      setSuccess('Xóa mục khảo sát thành công')
      await refreshAll()
    } catch (deleteError) {
      setError(getApiMessage(deleteError, 'Không thể xóa mục khảo sát'))
    }
  }

  async function handleDeleteQuestion(id) {
    if (!window.confirm('Bạn chắc chắn muốn xóa câu hỏi này?')) return

    setError('')
    setSuccess('')

    try {
      await deleteSurveyQuestion(id)
      setSuccess('Xóa câu hỏi thành công')
      await refreshAll()
    } catch (deleteError) {
      setError(getApiMessage(deleteError, 'Không thể xóa câu hỏi'))
    }
  }

  function addQuestionOption() {
    setQuestionForm((current) => ({
      ...current,
      options: [
        ...(Array.isArray(current.options) ? current.options : []),
        normalizeOption({ clientKey: `option-${Date.now()}-${current.options?.length || 0}` }, current.options?.length || 0),
      ],
    }))
  }

  function updateQuestionOption(index, field, value) {
    setQuestionForm((current) => ({
      ...current,
      options: (Array.isArray(current.options) ? current.options : []).map((option, optionIndex) => (
        optionIndex === index ? { ...option, [field]: value } : option
      )),
    }))
  }

  function removeQuestionOption(index) {
    setQuestionForm((current) => ({
      ...current,
      options: (Array.isArray(current.options) ? current.options : []).filter((_, optionIndex) => optionIndex !== index),
    }))
  }

  return (
    <CRow className="g-0">
      <CCol xs={12}>
        <CCard className="mb-4 ai-card">
          <CCardHeader className="d-flex justify-content-between align-items-center gap-2 flex-wrap">
            <div>
              <strong>Quản trị bộ câu hỏi khảo sát</strong>
              <div className="small text-body-secondary mt-1">
                Quản lý template, mục khảo sát và câu hỏi trong tenant, có lọc theo bộ câu hỏi và mục.
              </div>
            </div>
            <div className="d-flex gap-2 flex-wrap">
              <CButton color="primary" onClick={openCreateTemplateModal}>Thêm bộ câu hỏi</CButton>
              <CButton color="info" variant="outline" onClick={() => openCreateSectionModal()}>Thêm mục</CButton>
              <CButton color="success" variant="outline" onClick={() => openCreateQuestionModal()}>Thêm câu hỏi</CButton>
            </div>
          </CCardHeader>
          <CCardBody>
            {success ? <CAlert color="success">{success}</CAlert> : null}
            {error ? <CAlert color="danger">{error}</CAlert> : null}

            <CRow className="g-3 align-items-end">
              <CCol md={3}>
                <CFormLabel>Bộ câu hỏi</CFormLabel>
                <CFormSelect value={templateFilter} onChange={(event) => { setTemplateFilter(event.target.value); setSectionFilter(''); setPage(1) }}>
                  <option value="">Tất cả bộ câu hỏi</option>
                  {templates.map((template) => (
                    <option key={template.id} value={template.id}>{template.name}</option>
                  ))}
                </CFormSelect>
              </CCol>

              <CCol md={3}>
                <CFormLabel>Mục khảo sát</CFormLabel>
                <CFormSelect value={sectionFilter} onChange={(event) => { setSectionFilter(event.target.value); setPage(1) }}>
                  <option value="">Tất cả mục</option>
                  {filteredSections.map((section) => (
                    <option key={section.id} value={section.id}>{section.title}</option>
                  ))}
                </CFormSelect>
              </CCol>

              <CCol md={2}>
                <CFormLabel>Loại câu hỏi</CFormLabel>
                <CFormSelect value={questionTypeFilter} onChange={(event) => { setQuestionTypeFilter(event.target.value); setPage(1) }}>
                  <option value="">Tất cả</option>
                  {questionTypes.map((item) => (
                    <option key={item} value={item}>{formatQuestionType(item)}</option>
                  ))}
                </CFormSelect>
              </CCol>

              <CCol md={3}>
                <CFormLabel>Tìm nội dung câu hỏi</CFormLabel>
                <CFormInput value={qDraft} onChange={(event) => setQDraft(event.target.value)} placeholder="Nhập nội dung cần tìm" />
              </CCol>

              <CCol md={1} className="d-grid">
                <CButton color="primary" onClick={applySearch}>Lọc</CButton>
              </CCol>

              <CCol xs={12}>
                <div className="d-flex gap-2 flex-wrap align-items-center">
                  <CButton color="secondary" variant="ghost" onClick={resetFilters}>Đặt lại</CButton>
                  {selectedTemplate ? (
                    <CBadge color={selectedTemplate.isActive ? 'success' : 'secondary'}>
                      {formatTemplateType(selectedTemplate.type)}
                    </CBadge>
                  ) : null}
                  <span className="small text-body-secondary">Câu hỏi: {fromToText}</span>
                </div>
              </CCol>
            </CRow>
          </CCardBody>
        </CCard>

        <CRow className="g-4">
          <CCol xl={5}>
            <CCard className="h-100 ai-card">
              <CCardHeader className="d-flex justify-content-between align-items-center gap-2 flex-wrap">
                <strong>Template khảo sát</strong>
                <span className="small text-body-secondary">{templates.length} bộ câu hỏi</span>
              </CCardHeader>
              <CCardBody>
                {bootstrapLoading ? (
                  <div className="text-center py-4"><CSpinner /></div>
                ) : (
                  <CTable hover responsive align="middle">
                    <CTableHead>
                      <CTableRow>
                        <CTableHeaderCell>Bộ câu hỏi</CTableHeaderCell>
                        <CTableHeaderCell>Loại</CTableHeaderCell>
                        <CTableHeaderCell>Trạng thái</CTableHeaderCell>
                        <CTableHeaderCell className="text-end">Thao tác</CTableHeaderCell>
                      </CTableRow>
                    </CTableHead>
                    <CTableBody>
                      {templates.length === 0 ? (
                        <CTableRow>
                          <CTableDataCell colSpan={4} className="text-center text-body-secondary py-4">
                            Chưa có bộ câu hỏi nào.
                          </CTableDataCell>
                        </CTableRow>
                      ) : templates.map((template) => (
                        <CTableRow key={template.id} active={String(templateFilter) === String(template.id)}>
                          <CTableDataCell>
                            <div className="fw-semibold">{template.name}</div>
                            <div className="small text-body-secondary">{template.code}</div>
                            <div className="small text-body-secondary mt-1">
                              {template.sectionCount} mục, {template.questionCount} câu hỏi
                            </div>
                          </CTableDataCell>
                          <CTableDataCell>{formatTemplateType(template.type)}</CTableDataCell>
                          <CTableDataCell>
                            <CBadge color={template.isActive ? 'success' : 'secondary'}>
                              {template.isActive ? 'Đang dùng' : 'Ngưng dùng'}
                            </CBadge>
                          </CTableDataCell>
                          <CTableDataCell className="text-end">
                            <div className="d-flex gap-2 justify-content-end flex-wrap">
                              <CButton size="sm" color="secondary" variant="outline" onClick={() => setTemplateFilter(String(template.id))}>Chọn</CButton>
                              <CButton size="sm" color="info" variant="outline" onClick={() => openEditTemplateModal(template)}>Sửa</CButton>
                              <CButton size="sm" color="danger" variant="outline" onClick={() => handleDeleteTemplate(template.id)}>Xóa</CButton>
                            </div>
                          </CTableDataCell>
                        </CTableRow>
                      ))}
                    </CTableBody>
                  </CTable>
                )}
              </CCardBody>
            </CCard>
          </CCol>

          <CCol xl={7}>
            <CCard className="h-100 ai-card">
              <CCardHeader className="d-flex justify-content-between align-items-center gap-2 flex-wrap">
                <strong>Mục khảo sát</strong>
                <div className="small text-body-secondary">
                  {templateFilter ? 'Đang lọc theo bộ câu hỏi đã chọn' : 'Hiển thị toàn bộ mục trong tenant'}
                </div>
              </CCardHeader>
              <CCardBody>
                {bootstrapLoading ? (
                  <div className="text-center py-4"><CSpinner /></div>
                ) : (
                  <CTable hover responsive align="middle">
                    <CTableHead>
                      <CTableRow>
                        <CTableHeaderCell>Mục khảo sát</CTableHeaderCell>
                        <CTableHeaderCell>Bộ câu hỏi</CTableHeaderCell>
                        <CTableHeaderCell>Thứ tự</CTableHeaderCell>
                        <CTableHeaderCell>Câu hỏi</CTableHeaderCell>
                        <CTableHeaderCell className="text-end">Thao tác</CTableHeaderCell>
                      </CTableRow>
                    </CTableHead>
                    <CTableBody>
                      {filteredSections.length === 0 ? (
                        <CTableRow>
                          <CTableDataCell colSpan={5} className="text-center text-body-secondary py-4">
                            Không có mục khảo sát phù hợp bộ lọc hiện tại.
                          </CTableDataCell>
                        </CTableRow>
                      ) : filteredSections.map((section) => (
                        <CTableRow key={section.id} active={String(sectionFilter) === String(section.id)}>
                          <CTableDataCell>
                            <div className="fw-semibold">{section.title}</div>
                          </CTableDataCell>
                          <CTableDataCell>{section?.template?.name || '-'}</CTableDataCell>
                          <CTableDataCell>{section.order ?? 0}</CTableDataCell>
                          <CTableDataCell>{section.questionCount ?? 0}</CTableDataCell>
                          <CTableDataCell className="text-end">
                            <div className="d-flex gap-2 justify-content-end flex-wrap">
                              <CButton size="sm" color="secondary" variant="outline" onClick={() => setSectionFilter(String(section.id))}>Chọn</CButton>
                              <CButton size="sm" color="success" variant="outline" onClick={() => openCreateQuestionModal(section.id)}>Thêm câu hỏi</CButton>
                              <CButton size="sm" color="info" variant="outline" onClick={() => openEditSectionModal(section)}>Sửa</CButton>
                              <CButton size="sm" color="danger" variant="outline" onClick={() => handleDeleteSection(section.id)}>Xóa</CButton>
                            </div>
                          </CTableDataCell>
                        </CTableRow>
                      ))}
                    </CTableBody>
                  </CTable>
                )}
              </CCardBody>
            </CCard>
          </CCol>
        </CRow>

        <CCard className="mt-4 ai-card">
          <CCardHeader className="d-flex justify-content-between align-items-center gap-2 flex-wrap">
            <strong>Danh sách câu hỏi</strong>
            <div className="d-flex align-items-center gap-2 flex-wrap">
              <span className="small text-body-secondary">{fromToText}</span>
              <CFormSelect
                size="sm"
                style={{ width: 110 }}
                value={pageSize}
                onChange={(event) => {
                  setPageSize(Number(event.target.value) || 10)
                  setPage(1)
                }}
              >
                {[10, 20, 50].map((size) => (
                  <option key={size} value={size}>{size}/trang</option>
                ))}
              </CFormSelect>
            </div>
          </CCardHeader>
          <CCardBody>
            {questionLoading ? (
              <div className="text-center py-5"><CSpinner /></div>
            ) : (
              <>
                <CTable hover responsive align="middle">
                  <CTableHead>
                    <CTableRow>
                      <CTableHeaderCell>Nội dung</CTableHeaderCell>
                      <CTableHeaderCell>Mục</CTableHeaderCell>
                      <CTableHeaderCell>Loại</CTableHeaderCell>
                      <CTableHeaderCell>Bắt buộc</CTableHeaderCell>
                      <CTableHeaderCell>Lựa chọn</CTableHeaderCell>
                      <CTableHeaderCell>Đã trả lời</CTableHeaderCell>
                      <CTableHeaderCell className="text-end">Thao tác</CTableHeaderCell>
                    </CTableRow>
                  </CTableHead>
                  <CTableBody>
                    {questionRows.length === 0 ? (
                      <CTableRow>
                        <CTableDataCell colSpan={7} className="text-center text-body-secondary py-4">
                          Không có câu hỏi phù hợp bộ lọc hiện tại.
                        </CTableDataCell>
                      </CTableRow>
                    ) : questionRows.map((question) => (
                      <CTableRow key={question.id}>
                        <CTableDataCell>
                          <div className="fw-semibold">{question.content}</div>
                          <div className="small text-body-secondary mt-1">
                            {question?.template?.name || '-'} / {question?.section?.title || '-'}
                          </div>
                        </CTableDataCell>
                        <CTableDataCell>
                          <div>{question?.section?.title || '-'}</div>
                          <div className="small text-body-secondary">Thứ tự: {question.order ?? 0}</div>
                        </CTableDataCell>
                        <CTableDataCell>{formatQuestionType(question.type)}</CTableDataCell>
                        <CTableDataCell>
                          <CBadge color={question.isRequired ? 'warning' : 'secondary'}>
                            {question.isRequired ? 'Bắt buộc' : 'Tùy chọn'}
                          </CBadge>
                        </CTableDataCell>
                        <CTableDataCell>
                          {Array.isArray(question.options) && question.options.length > 0
                            ? question.options.map((option) => option.label).join(', ')
                            : '-'}
                        </CTableDataCell>
                        <CTableDataCell>{question.answerCount ?? 0}</CTableDataCell>
                        <CTableDataCell className="text-end">
                          <div className="d-flex gap-2 justify-content-end flex-wrap">
                            <CButton size="sm" color="info" variant="outline" onClick={() => openEditQuestionModal(question)}>Sửa</CButton>
                            <CButton size="sm" color="danger" variant="outline" onClick={() => handleDeleteQuestion(question.id)}>Xóa</CButton>
                          </div>
                        </CTableDataCell>
                      </CTableRow>
                    ))}
                  </CTableBody>
                </CTable>

                {pageCount > 1 ? (
                  <div className="d-flex justify-content-end mt-3">
                    <CPagination align="end">
                      <CPaginationItem disabled={page <= 1} onClick={() => setPage((current) => Math.max(1, current - 1))}>Trước</CPaginationItem>
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
                      <CPaginationItem disabled={page >= pageCount} onClick={() => setPage((current) => Math.min(pageCount, current + 1))}>Sau</CPaginationItem>
                    </CPagination>
                  </div>
                ) : null}
              </>
            )}
          </CCardBody>
        </CCard>

        <CModal visible={showTemplateModal} onClose={closeTemplateModal}>
          <CModalHeader>
            <CModalTitle>{editingTemplateId ? 'Cập nhật bộ câu hỏi' : 'Thêm bộ câu hỏi'}</CModalTitle>
          </CModalHeader>
          <CModalBody>
            <CForm className="ai-form">
              <div className="mb-3">
                <CFormLabel>Tên bộ câu hỏi</CFormLabel>
                <CFormInput value={templateForm.name} onChange={(event) => setTemplateForm((current) => ({ ...current, name: event.target.value }))} />
              </div>
              <div className="mb-3">
                <CFormLabel>Mã bộ câu hỏi</CFormLabel>
                <CFormInput value={templateForm.code} onChange={(event) => setTemplateForm((current) => ({ ...current, code: event.target.value }))} />
              </div>
              <div className="mb-3">
                <CFormLabel>Loại khảo sát</CFormLabel>
                <CFormSelect value={templateForm.type} onChange={(event) => setTemplateForm((current) => ({ ...current, type: event.target.value }))}>
                  {templateTypes.map((item) => (
                    <option key={item} value={item}>{formatTemplateType(item)}</option>
                  ))}
                </CFormSelect>
              </div>
              <div className="mb-3">
                <CFormLabel>Mô tả</CFormLabel>
                <CFormTextarea rows={3} value={templateForm.description} onChange={(event) => setTemplateForm((current) => ({ ...current, description: event.target.value }))} />
              </div>
              <CFormCheck
                label="Kích hoạt template này"
                checked={templateForm.isActive}
                onChange={(event) => setTemplateForm((current) => ({ ...current, isActive: event.target.checked }))}
              />
            </CForm>
          </CModalBody>
          <CModalFooter>
            <CButton color="secondary" variant="outline" onClick={closeTemplateModal}>Hủy</CButton>
            <CButton color="primary" onClick={handleTemplateSubmit} disabled={submitting}>
              {submitting ? 'Đang lưu...' : 'Lưu'}
            </CButton>
          </CModalFooter>
        </CModal>

        <CModal visible={showSectionModal} onClose={closeSectionModal}>
          <CModalHeader>
            <CModalTitle>{editingSectionId ? 'Cập nhật mục khảo sát' : 'Thêm mục khảo sát'}</CModalTitle>
          </CModalHeader>
          <CModalBody>
            <CForm className="ai-form">
              <div className="mb-3">
                <CFormLabel>Thuộc bộ câu hỏi</CFormLabel>
                <CFormSelect value={sectionForm.templateId} onChange={(event) => setSectionForm((current) => ({ ...current, templateId: event.target.value }))}>
                  <option value="">Chọn bộ câu hỏi</option>
                  {templates.map((template) => (
                    <option key={template.id} value={template.id}>{template.name}</option>
                  ))}
                </CFormSelect>
              </div>
              <div className="mb-3">
                <CFormLabel>Tên mục khảo sát</CFormLabel>
                <CFormInput value={sectionForm.title} onChange={(event) => setSectionForm((current) => ({ ...current, title: event.target.value }))} />
              </div>
              <div>
                <CFormLabel>Thứ tự hiển thị</CFormLabel>
                <CFormInput type="number" value={sectionForm.order} onChange={(event) => setSectionForm((current) => ({ ...current, order: event.target.value }))} />
              </div>
            </CForm>
          </CModalBody>
          <CModalFooter>
            <CButton color="secondary" variant="outline" onClick={closeSectionModal}>Hủy</CButton>
            <CButton color="primary" onClick={handleSectionSubmit} disabled={submitting}>
              {submitting ? 'Đang lưu...' : 'Lưu'}
            </CButton>
          </CModalFooter>
        </CModal>

        <CModal size="lg" visible={showQuestionModal} onClose={closeQuestionModal}>
          <CModalHeader>
            <CModalTitle>{editingQuestionId ? 'Cập nhật câu hỏi' : 'Thêm câu hỏi'}</CModalTitle>
          </CModalHeader>
          <CModalBody>
            <CForm className="ai-form">
              <CRow className="g-3">
                <CCol md={7}>
                  <CFormLabel>Nội dung câu hỏi</CFormLabel>
                  <CFormTextarea rows={4} value={questionForm.content} onChange={(event) => setQuestionForm((current) => ({ ...current, content: event.target.value }))} />
                </CCol>
                <CCol md={5}>
                  <div className="mb-3">
                    <CFormLabel>Mục khảo sát</CFormLabel>
                    <CFormSelect value={questionForm.sectionId} onChange={(event) => setQuestionForm((current) => ({ ...current, sectionId: event.target.value }))}>
                      <option value="">Chọn mục khảo sát</option>
                      {questionSectionOptions.map((section) => (
                        <option key={section.id} value={section.id}>
                          {section?.template?.name ? `${section.template.name} / ` : ''}{section.title}
                        </option>
                      ))}
                    </CFormSelect>
                  </div>
                  <div className="mb-3">
                    <CFormLabel>Loại câu hỏi</CFormLabel>
                    <CFormSelect
                      value={questionForm.type}
                      onChange={(event) => {
                        const nextType = event.target.value
                        setQuestionForm((current) => ({
                          ...current,
                          type: nextType,
                          options: isOptionBasedQuestionType(nextType)
                            ? String(nextType).toUpperCase() === 'LIKERT_1_5'
                              ? ((Array.isArray(current.options) && current.options.length > 0) ? current.options : createLikertOptions())
                              : current.options
                            : [],
                        }))
                      }}
                    >
                      {questionTypes.map((item) => (
                        <option key={item} value={item}>{formatQuestionType(item)}</option>
                      ))}
                    </CFormSelect>
                  </div>
                  <div className="mb-3">
                    <CFormLabel>Thứ tự hiển thị</CFormLabel>
                    <CFormInput type="number" value={questionForm.order} onChange={(event) => setQuestionForm((current) => ({ ...current, order: event.target.value }))} />
                  </div>
                  <CFormCheck
                    label="Câu hỏi bắt buộc"
                    checked={questionForm.isRequired}
                    onChange={(event) => setQuestionForm((current) => ({ ...current, isRequired: event.target.checked }))}
                  />
                </CCol>
              </CRow>

              {showOptionsEditor ? (
                <div className="mt-4">
                  <div className="d-flex justify-content-between align-items-center gap-2 flex-wrap mb-3">
                    <strong>Đáp án lựa chọn</strong>
                    <CButton color="secondary" variant="outline" size="sm" onClick={addQuestionOption}>Thêm đáp án</CButton>
                  </div>

                  {(Array.isArray(questionForm.options) ? questionForm.options : []).length === 0 ? (
                    <div className="small text-body-secondary">Chưa có đáp án nào. Hãy thêm ít nhất một đáp án.</div>
                  ) : (
                    <CRow className="g-3">
                      {questionForm.options.map((option, index) => (
                        <CCol xs={12} key={option.clientKey || option.id || index}>
                          <CCard className="border">
                            <CCardBody>
                              <CRow className="g-3 align-items-end">
                                <CCol md={5}>
                                  <CFormLabel>Nhãn hiển thị</CFormLabel>
                                  <CFormInput value={option.label} onChange={(event) => updateQuestionOption(index, 'label', event.target.value)} />
                                </CCol>
                                <CCol md={5}>
                                  <CFormLabel>Giá trị lưu</CFormLabel>
                                  <CFormInput value={option.value} onChange={(event) => updateQuestionOption(index, 'value', event.target.value)} />
                                </CCol>
                                <CCol md={1}>
                                  <CFormLabel>Thứ tự</CFormLabel>
                                  <CFormInput type="number" value={option.order} onChange={(event) => updateQuestionOption(index, 'order', event.target.value)} />
                                </CCol>
                                <CCol md={1} className="d-grid">
                                  <CButton color="danger" variant="outline" onClick={() => removeQuestionOption(index)}>Xóa</CButton>
                                </CCol>
                              </CRow>
                            </CCardBody>
                          </CCard>
                        </CCol>
                      ))}
                    </CRow>
                  )}
                </div>
              ) : null}
            </CForm>
          </CModalBody>
          <CModalFooter>
            <CButton color="secondary" variant="outline" onClick={closeQuestionModal}>Hủy</CButton>
            <CButton color="primary" onClick={handleQuestionSubmit} disabled={submitting}>
              {submitting ? 'Đang lưu...' : 'Lưu'}
            </CButton>
          </CModalFooter>
        </CModal>
      </CCol>
    </CRow>
  )
}