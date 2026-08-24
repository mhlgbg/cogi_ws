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
  createGrade,
  createKnowledgeNode,
  createQuestion,
  createQuestionStimulus,
  createSkill,
  createSubject,
  deleteQuestion,
  getQuestions,
  getQuestionStimuli,
  updateQuestion,
} from '../services/learningObjectApi'
import QuestionBankImportModal from './QuestionBankImportModal'
import QuestionEditorModal from './QuestionEditorModal'
import StimulusPreview from './StimulusPreview'
import { buildPages, formatDateTime, getApiMessage, getEntityId, getQuestionTypeLabel, getStatusBadgeColor, normalizePagination, truncateText } from '../utils/questionBankUi'

export default function QuestionBankQuestionsTab({ bootstrap, feature, setWorkspaceActions, onRefreshBootstrap }) {
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [rows, setRows] = useState([])
  const [meta, setMeta] = useState(null)
  const [stimuli, setStimuli] = useState([])
  const [qDraft, setQDraft] = useState('')
  const [filters, setFilters] = useState({ q: '', type: '', subjectId: '', gradeId: '', skillId: '', stimulusId: '', difficulty: '', questionStatus: '' })
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [showEditor, setShowEditor] = useState(false)
  const [editingQuestion, setEditingQuestion] = useState(null)
  const [showImport, setShowImport] = useState(false)

  const subjects = bootstrap?.subjects || []
  const grades = bootstrap?.grades || []
  const skills = bootstrap?.skills || []
  const questionTypes = bootstrap?.questionTypes || []
  const questionStatuses = bootstrap?.questionStatuses || []
  const difficulties = bootstrap?.difficulties || []
  const pagination = normalizePagination(meta?.pagination)
  const pages = useMemo(() => buildPages(page, pagination.pageCount), [page, pagination.pageCount])

  useEffect(() => {
    setWorkspaceActions?.(
      <div className='d-flex gap-2'>
        <CButton color='secondary' variant='outline' onClick={() => setShowImport(true)}>Import JSON</CButton>
        <CButton color='primary' onClick={() => { setEditingQuestion(null); setShowEditor(true) }}>+ Tạo câu hỏi</CButton>
      </div>,
    )
    return () => setWorkspaceActions?.(null)
  }, [setWorkspaceActions])

  useEffect(() => {
    loadQuestions()
  }, [page, pageSize, filters])

  useEffect(() => {
    loadStimuli()
  }, [])

  async function loadStimuli() {
    try {
      const payload = await getQuestionStimuli({ page: 1, pageSize: 100 })
      setStimuli(Array.isArray(payload?.data) ? payload.data : [])
    } catch {
      setStimuli([])
    }
  }

  async function loadQuestions() {
    setLoading(true)
    setError('')
    try {
      const payload = await getQuestions({
        page,
        pageSize,
        q: filters.q || undefined,
        type: filters.type || undefined,
        subjectId: filters.subjectId || undefined,
        gradeId: filters.gradeId || undefined,
        skillId: filters.skillId || undefined,
        stimulusId: filters.stimulusId || undefined,
        difficulty: filters.difficulty || undefined,
        questionStatus: filters.questionStatus || undefined,
      })
      setRows(Array.isArray(payload?.data) ? payload.data : [])
      setMeta(payload?.meta || null)
    } catch (requestError) {
      setRows([])
      setMeta(null)
      setError(getApiMessage(requestError, 'Không tải được danh sách câu hỏi'))
    } finally {
      setLoading(false)
    }
  }

  async function handleSubmit(payload) {
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
      setShowEditor(false)
      setEditingQuestion(null)
      await Promise.all([loadQuestions(), loadStimuli()])
    } catch (requestError) {
      setError(getApiMessage(requestError, 'Không lưu được câu hỏi'))
      throw requestError
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(question) {
    if (!window.confirm(`Bạn chắc chắn muốn xóa câu hỏi ${question?.code || ''}?`)) return
    setError('')
    setSuccess('')
    try {
      await deleteQuestion(getEntityId(question))
      setSuccess('Xóa câu hỏi thành công')
      await loadQuestions()
    } catch (requestError) {
      setError(getApiMessage(requestError, 'Không xóa được câu hỏi'))
    }
  }

  return (
    <>
      <CCard className='mb-4 ai-card'>
        <CCardHeader>
          <strong>Bộ lọc</strong>
        </CCardHeader>
        <CCardBody>
          <CRow className='g-3 align-items-end'>
            <CCol md={4}><CFormInput label='Từ khóa' value={qDraft} onChange={(event) => setQDraft(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') { setFilters((prev) => ({ ...prev, q: String(qDraft || '').trim() })); setPage(1) } }} placeholder='Tìm theo code, title, question text...' /></CCol>
            <CCol md={2}><CFormLabel>Loại</CFormLabel><CFormSelect value={filters.type} onChange={(event) => { setFilters((prev) => ({ ...prev, type: event.target.value })); setPage(1) }}><option value=''>Tất cả</option>{questionTypes.map((item) => <option key={item} value={item}>{getQuestionTypeLabel(item)}</option>)}</CFormSelect></CCol>
            <CCol md={2}><CFormLabel>Môn học</CFormLabel><CFormSelect value={filters.subjectId} onChange={(event) => { setFilters((prev) => ({ ...prev, subjectId: event.target.value })); setPage(1) }}><option value=''>Tất cả</option>{subjects.map((item) => <option key={getEntityId(item)} value={getEntityId(item)}>{item.title || item.code}</option>)}</CFormSelect></CCol>
            <CCol md={2}><CFormLabel>Khối</CFormLabel><CFormSelect value={filters.gradeId} onChange={(event) => { setFilters((prev) => ({ ...prev, gradeId: event.target.value })); setPage(1) }}><option value=''>Tất cả</option>{grades.map((item) => <option key={getEntityId(item)} value={getEntityId(item)}>{item.title || item.code}</option>)}</CFormSelect></CCol>
            <CCol md={2}><CFormLabel>Kỹ năng</CFormLabel><CFormSelect value={filters.skillId} onChange={(event) => { setFilters((prev) => ({ ...prev, skillId: event.target.value })); setPage(1) }}><option value=''>Tất cả</option>{skills.map((item) => <option key={getEntityId(item)} value={getEntityId(item)}>{item.title || item.code}</option>)}</CFormSelect></CCol>
            <CCol md={3}><CFormLabel>Stimulus</CFormLabel><CFormSelect value={filters.stimulusId} onChange={(event) => { setFilters((prev) => ({ ...prev, stimulusId: event.target.value })); setPage(1) }}><option value=''>Tất cả</option>{stimuli.map((item) => <option key={getEntityId(item)} value={getEntityId(item)}>{`${item.code || '-'} • ${item.title || '-'} • ${item.type || '-'}`}</option>)}</CFormSelect></CCol>
            <CCol md={2}><CFormLabel>Độ khó</CFormLabel><CFormSelect value={filters.difficulty} onChange={(event) => { setFilters((prev) => ({ ...prev, difficulty: event.target.value })); setPage(1) }}><option value=''>Tất cả</option>{difficulties.map((item) => <option key={item} value={item}>{item}</option>)}</CFormSelect></CCol>
            <CCol md={2}><CFormLabel>Trạng thái</CFormLabel><CFormSelect value={filters.questionStatus} onChange={(event) => { setFilters((prev) => ({ ...prev, questionStatus: event.target.value })); setPage(1) }}><option value=''>Tất cả</option>{questionStatuses.map((item) => <option key={item} value={item}>{item}</option>)}</CFormSelect></CCol>
            <CCol md={5} className='d-flex gap-2'>
              <CButton color='primary' onClick={() => { setFilters((prev) => ({ ...prev, q: String(qDraft || '').trim() })); setPage(1) }} disabled={loading}>Search</CButton>
              <CButton color='secondary' variant='outline' onClick={() => { setQDraft(''); setFilters({ q: '', type: '', subjectId: '', gradeId: '', skillId: '', stimulusId: '', difficulty: '', questionStatus: '' }); setPage(1) }} disabled={loading}>Đặt lại</CButton>
            </CCol>
          </CRow>
        </CCardBody>
      </CCard>

      {success ? <CAlert color='success'>{success}</CAlert> : null}
      {error ? <CAlert color='danger'>{error}</CAlert> : null}

      <CCard className='ai-card'>
        <CCardHeader className='d-flex align-items-center justify-content-between gap-2 flex-wrap'>
          <div>
            <strong>Câu hỏi</strong>
            <CBadge color='secondary' className='ms-2'>{pagination.total}</CBadge>
          </div>
        </CCardHeader>
        <CCardBody>
          {loading ? (
            <div className='d-flex align-items-center gap-2 py-3'><CSpinner size='sm' /><span>Đang tải dữ liệu...</span></div>
          ) : (
            <>
              <div className='d-none d-lg-block'>
                <CTable hover responsive align='middle' className='ai-table'>
                  <CTableHead>
                    <CTableRow>
                      <CTableHeaderCell style={{ width: 130 }}>Code</CTableHeaderCell>
                      <CTableHeaderCell style={{ minWidth: 260 }}>Câu hỏi</CTableHeaderCell>
                      <CTableHeaderCell style={{ width: 150 }}>Loại</CTableHeaderCell>
                      <CTableHeaderCell style={{ width: 150 }}>Môn học</CTableHeaderCell>
                      <CTableHeaderCell style={{ width: 140 }}>Khối</CTableHeaderCell>
                      <CTableHeaderCell style={{ minWidth: 180 }}>Kỹ năng</CTableHeaderCell>
                      <CTableHeaderCell style={{ minWidth: 220 }}>Stimulus</CTableHeaderCell>
                      <CTableHeaderCell style={{ width: 90 }}>Đáp án</CTableHeaderCell>
                      <CTableHeaderCell style={{ width: 110 }}>Status</CTableHeaderCell>
                      <CTableHeaderCell style={{ width: 160 }}>Hành động</CTableHeaderCell>
                    </CTableRow>
                  </CTableHead>
                  <CTableBody>
                    {rows.length === 0 ? (
                      <CTableRow>
                        <CTableDataCell colSpan={10} className='text-center text-body-secondary'>Chưa có câu hỏi.</CTableDataCell>
                      </CTableRow>
                    ) : rows.map((item) => (
                      <CTableRow key={getEntityId(item) || item.code}>
                        <CTableDataCell>{item.code || '-'}</CTableDataCell>
                        <CTableDataCell>
                          <div className='fw-semibold'>{item.title || 'Không có tiêu đề'}</div>
                          <div className='small text-body-secondary'>{truncateText(item.questionText, 120)}</div>
                        </CTableDataCell>
                        <CTableDataCell>{getQuestionTypeLabel(item.type)}</CTableDataCell>
                        <CTableDataCell>{item.subject?.title || '-'}</CTableDataCell>
                        <CTableDataCell>{item.grade?.title || '-'}</CTableDataCell>
                        <CTableDataCell>{Array.isArray(item.skills) && item.skills.length > 0 ? item.skills.map((skill) => skill.title || skill.code).join(', ') : '-'}</CTableDataCell>
                        <CTableDataCell>{item.stimulus ? <StimulusPreview stimulus={item.stimulus} compact /> : <span className='small text-body-secondary'>Không dùng</span>}</CTableDataCell>
                        <CTableDataCell>{Array.isArray(item.options) ? item.options.length : 0}</CTableDataCell>
                        <CTableDataCell><CBadge color={getStatusBadgeColor(item.questionStatus)}>{item.questionStatus || '-'}</CBadge></CTableDataCell>
                        <CTableDataCell>
                          <div className='d-flex gap-2'>
                            <CButton size='sm' color='info' variant='outline' onClick={() => { setEditingQuestion(item); setShowEditor(true) }}>Sửa</CButton>
                            <CButton size='sm' color='danger' variant='outline' onClick={() => handleDelete(item)}>Xóa</CButton>
                          </div>
                        </CTableDataCell>
                      </CTableRow>
                    ))}
                  </CTableBody>
                </CTable>
              </div>

              <div className='d-lg-none d-grid gap-3'>
                {rows.length === 0 ? <div className='text-center text-body-secondary py-4'>Chưa có câu hỏi.</div> : rows.map((item) => (
                  <CCard key={getEntityId(item) || item.code} className='border'>
                    <CCardBody>
                      <div className='d-flex justify-content-between align-items-start gap-2 mb-2'>
                        <div>
                          <div className='fw-semibold'>{item.code || '-'}</div>
                          <div className='small text-body-secondary'>{getQuestionTypeLabel(item.type)}</div>
                        </div>
                        <CBadge color={getStatusBadgeColor(item.questionStatus)}>{item.questionStatus || '-'}</CBadge>
                      </div>
                      <div className='mb-2'>{truncateText(item.questionText, 140)}</div>
                      {item.stimulus ? <div className='mb-2'><StimulusPreview stimulus={item.stimulus} compact /></div> : null}
                      <div className='small text-body-secondary mb-3'>{`Môn học: ${item.subject?.title || '-'} • Khối: ${item.grade?.title || '-'}`}</div>
                      <div className='d-flex gap-2'>
                        <CButton size='sm' color='info' variant='outline' onClick={() => { setEditingQuestion(item); setShowEditor(true) }}>Sửa</CButton>
                        <CButton size='sm' color='danger' variant='outline' onClick={() => handleDelete(item)}>Xóa</CButton>
                      </div>
                    </CCardBody>
                  </CCard>
                ))}
              </div>

              <div className='d-flex flex-wrap justify-content-between align-items-center gap-2 mt-3'>
                <div className='small text-body-secondary'>{pagination.total > 0 ? `${(page - 1) * pageSize + 1}–${Math.min(page * pageSize, pagination.total)}/${pagination.total}` : '0'}</div>
                <div className='d-flex align-items-center gap-2'>
                  <CFormSelect value={pageSize} onChange={(event) => { setPageSize(Number(event.target.value || 10)); setPage(1) }} style={{ width: 110 }}>
                    {[10, 20, 50].map((size) => <option key={size} value={size}>{size}/trang</option>)}
                  </CFormSelect>
                  <CPagination className='mb-0'>
                    <CPaginationItem disabled={page <= 1} onClick={() => setPage((prev) => Math.max(1, prev - 1))}>Trước</CPaginationItem>
                    {pages.map((item, index) => item === '...' ? <CPaginationItem key={`ellipsis-${index}`} disabled>…</CPaginationItem> : <CPaginationItem key={item} active={item === page} onClick={() => setPage(item)}>{item}</CPaginationItem>)}
                    <CPaginationItem disabled={page >= pagination.pageCount} onClick={() => setPage((prev) => Math.min(pagination.pageCount, prev + 1))}>Sau</CPaginationItem>
                  </CPagination>
                </div>
              </div>
            </>
          )}
        </CCardBody>
      </CCard>

      <QuestionEditorModal
        visible={showEditor}
        saving={saving}
        bootstrap={bootstrap}
        editingQuestion={editingQuestion}
        questionStimuli={stimuli}
        onClose={() => { if (!saving) { setShowEditor(false); setEditingQuestion(null) } }}
        onSubmit={handleSubmit}
        onQuickCreateSubject={createSubject}
        onQuickCreateGrade={createGrade}
        onQuickCreateSkill={createSkill}
        onQuickCreateKnowledgeNode={createKnowledgeNode}
        onQuickCreateStimulus={createQuestionStimulus}
        onRefreshStimuli={loadStimuli}
        onRefreshSupportData={onRefreshBootstrap}
        feature={feature}
      />

      <QuestionBankImportModal visible={showImport} onClose={() => setShowImport(false)} onImported={async (summary) => {
        setSuccess(`Import question bank thành công. Tạo mới: ${summary?.created || 0}, Cập nhật: ${summary?.updated || 0}, Cảnh báo: ${summary?.warnings || 0}`)
        await Promise.all([loadQuestions(), loadStimuli(), onRefreshBootstrap?.()])
      }} />
    </>
  )
}
