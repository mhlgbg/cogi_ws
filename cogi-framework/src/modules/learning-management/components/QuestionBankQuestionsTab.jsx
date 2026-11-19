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
  getQuestionStimulusUsage,
  getQuestions,
  getQuestionStimuli,
  updateQuestion,
  updateQuestionStimulus,
} from '../services/learningObjectApi'
import QuestionBankImportModal from './QuestionBankImportModal'
import QuestionBulkDeleteImportedModal from './QuestionBulkDeleteImportedModal'
import QuestionBulkPrefixCleanupModal from './QuestionBulkPrefixCleanupModal'
import QuestionEditorModal from './QuestionEditorModal'
import QuestionStimulusEditorModal from './QuestionStimulusEditorModal'
import StimulusPreview from './StimulusPreview'
import { buildPages, getApiMessage, getEntityId, getQuestionTypeLabel, getStatusBadgeColor, normalizePagination, truncateText } from '../utils/questionBankUi'

const QUESTION_TEXT_CLAMP_STYLE = {
  display: '-webkit-box',
  WebkitBoxOrient: 'vertical',
  WebkitLineClamp: 3,
  overflow: 'hidden',
}

function QuestionTextCell({ question }) {
  return (
    <div>
      <div className='fw-semibold text-truncate'>{question?.title || 'Không có tiêu đề'}</div>
      <div className='small text-body-secondary' style={QUESTION_TEXT_CLAMP_STYLE}>{truncateText(question?.questionText, 220)}</div>
    </div>
  )
}

function StimulusTableCell({ stimulus, onOpenStimulus }) {
  if (!stimulus) {
    return <span className='small text-body-secondary'>Không dùng</span>
  }

  return (
    <div className='d-grid gap-2'>
      <button type='button' className='btn p-0 border-0 bg-transparent text-start text-body w-100' onClick={() => onOpenStimulus?.(stimulus)}>
        <StimulusPreview stimulus={stimulus} compact previewMode='summary' />
      </button>
      <div>
        <CButton size='sm' color='primary' variant='outline' onClick={() => onOpenStimulus?.(stimulus)}>Xem stimulus</CButton>
      </div>
    </div>
  )
}

export default function QuestionBankQuestionsTab({ bootstrap, feature, setWorkspaceActions, onRefreshBootstrap }) {
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [rows, setRows] = useState([])
  const [meta, setMeta] = useState(null)
  const [stimuli, setStimuli] = useState([])
  const [qDraft, setQDraft] = useState('')
  const [filters, setFilters] = useState({ q: '', type: '', subjectId: '', knowledgeNodeId: '', gradeId: '', skillId: '', stimulusId: '', difficulty: '', questionStatus: '' })
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [showEditor, setShowEditor] = useState(false)
  const [editingQuestion, setEditingQuestion] = useState(null)
  const [showStimulusPreview, setShowStimulusPreview] = useState(false)
  const [previewingStimulus, setPreviewingStimulus] = useState(null)
  const [showImport, setShowImport] = useState(false)
  const [showBulkDeleteImported, setShowBulkDeleteImported] = useState(false)
  const [showBulkPrefixCleanup, setShowBulkPrefixCleanup] = useState(false)
  const [reloadTick, setReloadTick] = useState(0)

  const subjects = bootstrap?.subjects || []
  const knowledgeNodes = bootstrap?.knowledgeNodes || []
  const grades = bootstrap?.grades || []
  const skills = bootstrap?.skills || []
  const questionTypes = bootstrap?.questionTypes || []
  const questionStatuses = bootstrap?.questionStatuses || []
  const difficulties = bootstrap?.difficulties || []
  const filteredKnowledgeNodes = useMemo(() => {
    if (!filters.subjectId) return knowledgeNodes
    return knowledgeNodes.filter((item) => String(item?.subject?.id ?? item?.subjectId ?? '') === String(filters.subjectId) || !item?.subject)
  }, [filters.subjectId, knowledgeNodes])
  const pagination = normalizePagination(meta?.pagination)
  const pages = useMemo(() => buildPages(page, pagination.pageCount), [page, pagination.pageCount])
  const canManageQuestions = feature?.hasFeature?.('learning.question.manage') || feature?.hasFeature?.('learning.learning-object.manage')

  useEffect(() => {
    setWorkspaceActions?.(
      <div className='d-flex gap-2'>
        <CButton color='secondary' variant='outline' onClick={() => setShowImport(true)}>Import JSON</CButton>
        {canManageQuestions ? <CButton color='danger' variant='outline' onClick={() => setShowBulkDeleteImported(true)}>Xóa câu hỏi đã import</CButton> : null}
        {canManageQuestions ? <CButton color='warning' variant='outline' onClick={() => setShowBulkPrefixCleanup(true)}>Tìm kiếm & Thay thế</CButton> : null}
        <CButton color='primary' onClick={() => { setEditingQuestion(null); setShowEditor(true) }}>+ Tạo câu hỏi</CButton>
      </div>,
    )
    return () => setWorkspaceActions?.(null)
  }, [canManageQuestions, setWorkspaceActions])

  useEffect(() => {
    let active = true
    ;(async () => {
      setLoading(true)
      setError('')
      try {
        const payload = await getQuestions({
          page,
          pageSize,
          q: filters.q || undefined,
          type: filters.type || undefined,
          subjectId: filters.subjectId || undefined,
          knowledgeNodeId: filters.knowledgeNodeId || undefined,
          gradeId: filters.gradeId || undefined,
          skillId: filters.skillId || undefined,
          stimulusId: filters.stimulusId || undefined,
          difficulty: filters.difficulty || undefined,
          questionStatus: filters.questionStatus || undefined,
        })
        if (!active) return
        setRows(Array.isArray(payload?.data) ? payload.data : [])
        setMeta(payload?.meta || null)
      } catch (requestError) {
        if (!active) return
        setRows([])
        setMeta(null)
        setError(getApiMessage(requestError, 'Không tải được danh sách câu hỏi'))
      } finally {
        if (active) setLoading(false)
      }
    })()
    return () => { active = false }
  }, [filters, page, pageSize, reloadTick])

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
        knowledgeNodeId: filters.knowledgeNodeId || undefined,
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
      const previousStimulus = editingQuestion?.stimulus || null
      if (editingQuestion) {
        await updateQuestion(getEntityId(editingQuestion), payload)
        let successMessage = 'Cập nhật câu hỏi thành công'
        const previousStimulusId = getEntityId(previousStimulus)
        const nextStimulusId = String(payload?.stimulus || '').trim()
        if (previousStimulusId && previousStimulusId !== nextStimulusId) {
          const usage = await getQuestionStimulusUsage(previousStimulusId)
          if (Number(usage?.totalLiveReferences || 0) > 0) {
            successMessage = `Đã gỡ stimulus khỏi câu hỏi. Stimulus vẫn đang được dùng bởi ${usage?.questionCount || 0} Question và ${usage?.partCount || 0} Part.`
          } else {
            successMessage = 'Đã gỡ stimulus khỏi câu hỏi. Stimulus này hiện không còn được sử dụng và có thể xóa trong tab Stimulus.'
          }
        }
        setSuccess(successMessage)
      } else {
        await createQuestion(payload)
        setSuccess('Tạo câu hỏi thành công')
      }
      setShowEditor(false)
      setEditingQuestion(null)
      setReloadTick((prev) => prev + 1)
      await loadStimuli()
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
      setReloadTick((prev) => prev + 1)
    } catch (requestError) {
      setError(getApiMessage(requestError, 'Không xóa được câu hỏi'))
    }
  }

  async function handleQuickCreateStimulus(payload, existingStimulus = null) {
    if (existingStimulus && getEntityId(existingStimulus)) {
      return updateQuestionStimulus(getEntityId(existingStimulus), payload)
    }
    return createQuestionStimulus(payload)
  }

  function openStimulusPreview(stimulus) {
    setPreviewingStimulus(stimulus || null)
    setShowStimulusPreview(Boolean(stimulus))
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
            <CCol md={2}><CFormLabel>Môn học</CFormLabel><CFormSelect value={filters.subjectId} onChange={(event) => { setFilters((prev) => ({ ...prev, subjectId: event.target.value, knowledgeNodeId: '' })); setPage(1) }}><option value=''>Tất cả</option>{subjects.map((item) => <option key={getEntityId(item)} value={getEntityId(item)}>{item.title || item.code}</option>)}</CFormSelect></CCol>
            <CCol md={2}><CFormLabel>Chủ đề kiến thức</CFormLabel><CFormSelect value={filters.knowledgeNodeId} onChange={(event) => { setFilters((prev) => ({ ...prev, knowledgeNodeId: event.target.value })); setPage(1) }}><option value=''>Tất cả</option>{filteredKnowledgeNodes.map((item) => <option key={getEntityId(item)} value={getEntityId(item)}>{item.title || item.code}</option>)}</CFormSelect></CCol>
            <CCol md={2}><CFormLabel>Khối</CFormLabel><CFormSelect value={filters.gradeId} onChange={(event) => { setFilters((prev) => ({ ...prev, gradeId: event.target.value })); setPage(1) }}><option value=''>Tất cả</option>{grades.map((item) => <option key={getEntityId(item)} value={getEntityId(item)}>{item.title || item.code}</option>)}</CFormSelect></CCol>
            <CCol md={2}><CFormLabel>Kỹ năng</CFormLabel><CFormSelect value={filters.skillId} onChange={(event) => { setFilters((prev) => ({ ...prev, skillId: event.target.value })); setPage(1) }}><option value=''>Tất cả</option>{skills.map((item) => <option key={getEntityId(item)} value={getEntityId(item)}>{item.title || item.code}</option>)}</CFormSelect></CCol>
            <CCol md={3}><CFormLabel>Stimulus</CFormLabel><CFormSelect value={filters.stimulusId} onChange={(event) => { setFilters((prev) => ({ ...prev, stimulusId: event.target.value })); setPage(1) }}><option value=''>Tất cả</option>{stimuli.map((item) => <option key={getEntityId(item)} value={getEntityId(item)}>{`${item.code || '-'} • ${item.title || '-'} • ${item.type || '-'}`}</option>)}</CFormSelect></CCol>
            <CCol md={2}><CFormLabel>Độ khó</CFormLabel><CFormSelect value={filters.difficulty} onChange={(event) => { setFilters((prev) => ({ ...prev, difficulty: event.target.value })); setPage(1) }}><option value=''>Tất cả</option>{difficulties.map((item) => <option key={item} value={item}>{item}</option>)}</CFormSelect></CCol>
            <CCol md={2}><CFormLabel>Trạng thái</CFormLabel><CFormSelect value={filters.questionStatus} onChange={(event) => { setFilters((prev) => ({ ...prev, questionStatus: event.target.value })); setPage(1) }}><option value=''>Tất cả</option>{questionStatuses.map((item) => <option key={item} value={item}>{item}</option>)}</CFormSelect></CCol>
            <CCol md={5} className='d-flex gap-2'>
              <CButton color='primary' onClick={() => { setFilters((prev) => ({ ...prev, q: String(qDraft || '').trim() })); setPage(1) }} disabled={loading}>Search</CButton>
              <CButton color='secondary' variant='outline' onClick={() => { setQDraft(''); setFilters({ q: '', type: '', subjectId: '', knowledgeNodeId: '', gradeId: '', skillId: '', stimulusId: '', difficulty: '', questionStatus: '' }); setPage(1) }} disabled={loading}>Đặt lại</CButton>
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
                        <CTableDataCell><QuestionTextCell question={item} /></CTableDataCell>
                        <CTableDataCell>{getQuestionTypeLabel(item.type)}</CTableDataCell>
                        <CTableDataCell>{item.subject?.title || '-'}</CTableDataCell>
                        <CTableDataCell>{item.grade?.title || '-'}</CTableDataCell>
                        <CTableDataCell>{Array.isArray(item.skills) && item.skills.length > 0 ? item.skills.map((skill) => skill.title || skill.code).join(', ') : '-'}</CTableDataCell>
                        <CTableDataCell><StimulusTableCell stimulus={item.stimulus} onOpenStimulus={openStimulusPreview} /></CTableDataCell>
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
                      <div className='mb-2'><QuestionTextCell question={item} /></div>
                      {item.stimulus ? <div className='mb-2'><StimulusTableCell stimulus={item.stimulus} onOpenStimulus={openStimulusPreview} /></div> : null}
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
        onQuickCreateStimulus={handleQuickCreateStimulus}
        onRefreshStimuli={loadStimuli}
        onRefreshSupportData={onRefreshBootstrap}
        feature={feature}
      />

      <QuestionStimulusEditorModal
        visible={showStimulusPreview}
        saving={false}
        editingStimulus={previewingStimulus}
        readOnly
        onClose={() => {
          setShowStimulusPreview(false)
          setPreviewingStimulus(null)
        }}
      />

      <QuestionBankImportModal visible={showImport} onClose={() => setShowImport(false)} onImported={async (summary) => {
        const created = summary?.created || 0
        const updated = summary?.updated || 0
        const skipped = summary?.skipped || 0
        const failed = summary?.failed || 0
        const warnings = summary?.warnings || 0
        if (failed > 0) {
          setError(`Import hoàn tất với lỗi. Tạo mới: ${created}, Cập nhật: ${updated}, Bỏ qua: ${skipped}, Lỗi: ${failed}, Cảnh báo: ${warnings}`)
        } else {
          setSuccess(`Import question bank thành công. Tạo mới: ${created}, Cập nhật: ${updated}, Bỏ qua: ${skipped}, Cảnh báo: ${warnings}`)
        }
        await Promise.all([loadQuestions(), loadStimuli(), onRefreshBootstrap?.()])
      }} />

      <QuestionBulkDeleteImportedModal
        visible={showBulkDeleteImported}
        subjects={subjects}
        onClose={() => setShowBulkDeleteImported(false)}
        onDeleted={async (result) => {
          const deletedCount = Number(result?.result?.deletedCount || 0)
          const blockedCount = Number(result?.result?.blockedCount || 0)
          const failedCount = Number(result?.result?.failedCount || 0)
          if (failedCount > 0) {
            setError(`Xóa hoàn tất với lỗi. Deleted: ${deletedCount}, Blocked: ${blockedCount}, Failed: ${failedCount}`)
          } else {
            setSuccess(`Xóa hoàn tất. Deleted: ${deletedCount}, Blocked: ${blockedCount}, Failed: ${failedCount}`)
          }
          await Promise.all([loadQuestions(), onRefreshBootstrap?.()])
        }}
      />

      <QuestionBulkPrefixCleanupModal
        visible={showBulkPrefixCleanup}
        subjects={subjects}
        knowledgeNodes={knowledgeNodes}
        onClose={() => setShowBulkPrefixCleanup(false)}
        onUpdated={async (result) => {
          const updatedCount = Number(result?.result?.updatedCount || 0)
          const blockedCount = Number(result?.result?.blockedCount || 0)
          const failedCount = Number(result?.result?.failedCount || 0)
          if (failedCount > 0) {
            setError(`Thay thế hoàn tất với lỗi. Updated: ${updatedCount}, Blocked: ${blockedCount}, Failed: ${failedCount}`)
          } else {
            setSuccess(`Tìm kiếm & Thay thế thành công. Updated: ${updatedCount}, Blocked: ${blockedCount}, Failed: ${failedCount}`)
          }
          await Promise.all([loadQuestions(), onRefreshBootstrap?.()])
        }}
      />
    </>
  )
}
