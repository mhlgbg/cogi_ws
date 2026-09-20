import { useEffect, useState } from 'react'
import { CAlert, CButton, CCard, CCardBody, CFormCheck, CFormInput, CFormLabel, CFormSelect, CModal, CModalBody, CModalFooter, CModalHeader, CModalTitle, CSpinner } from '@coreui/react'
import SimpleHtmlEditor from '../../admission-management/components/SimpleHtmlEditor'
import { getTeacherAssignmentAssessmentOptions, getTeacherSessionAssignmentAssessmentOptions, startTeacherAssignmentAssessmentPreview, startTeacherSessionAssignmentAssessmentPreview } from '../services/classService'

const TASK_TYPE_OPTIONS = [
  { value: 'todo', label: 'Chỉ cần hoàn thành' },
  { value: 'submission', label: 'Nộp bài' },
  { value: 'assessment', label: 'Làm bài kiểm tra' },
]

const DEFAULT_ASSESSMENT_SETTINGS = {
  assessmentVersionId: null,
  maxAttempts: 1,
  showScoreAfterSubmit: true,
  reviewMode: 'none',
}

function normalizeAssessmentSettings(settings) {
  return {
    assessmentVersionId: Number(settings?.assessmentVersionId || settings?.versionId || 0) || null,
    maxAttempts: Number(settings?.maxAttempts || DEFAULT_ASSESSMENT_SETTINGS.maxAttempts) || DEFAULT_ASSESSMENT_SETTINGS.maxAttempts,
    showScoreAfterSubmit: settings?.showScoreAfterSubmit !== false,
    reviewMode: String(settings?.reviewMode || DEFAULT_ASSESSMENT_SETTINGS.reviewMode).trim() || DEFAULT_ASSESSMENT_SETTINGS.reviewMode,
  }
}

function buildAssessmentSummary(task) {
  if (!task?.assessment?.id) return null
  return {
    id: Number(task.assessment.id || 0) || 0,
    code: String(task.assessment.code || '').trim(),
    title: String(task.assessment.title || '').trim(),
    status: String(task.assessment.status || '').trim() || 'draft',
    assessmentVersion: task?.assessmentVersion ? {
      id: Number(task.assessmentVersion.id || 0) || 0,
      code: String(task.assessmentVersion.code || '').trim(),
      title: String(task.assessmentVersion.title || '').trim(),
      versionStatus: String(task.assessmentVersion.versionStatus || '').trim() || 'draft',
      durationMinutes: Number(task.assessmentVersion.durationMinutes || 0) || 0,
      questionCount: Number(task.assessmentVersion.questionCount || 0) || 0,
    } : null,
  }
}

function buildTask(task = null, order = 1) {
  return {
    title: String(task?.title || '').trim(),
    description: String(task?.description || '').trim() || '<p></p>',
    order: Number(task?.order || order) || order,
    required: task?.required !== false,
    taskType: String(task?.taskType || 'todo').trim() || 'todo',
    assessmentId: Number(task?.assessment?.id || task?.assessmentId || 0) || 0,
    assessmentSummary: buildAssessmentSummary(task),
    assessmentSettings: normalizeAssessmentSettings(task?.assessmentSettings),
  }
}

function buildFormState(assignment = null) {
  return {
    title: String(assignment?.title || '').trim(),
    description: String(assignment?.description || '').trim() || '<p></p>',
    dueAt: assignment?.dueAt ? String(assignment.dueAt).slice(0, 16) : '',
    tasks: Array.isArray(assignment?.tasks) && assignment.tasks.length > 0
      ? assignment.tasks.map((task, index) => buildTask(task, index + 1))
      : [buildTask(null, 1)],
  }
}

export default function TeacherAssignmentEditorModal({ visible = false, saving = false, assignment = null, sessionId = null, assignmentId = null, submitError = '', onClose, onSave }) {
  const [form, setForm] = useState(buildFormState(assignment))
  const [assessmentPickers, setAssessmentPickers] = useState({})
  const isDev = import.meta.env.DEV

  useEffect(() => {
    setForm(buildFormState(assignment))
    setAssessmentPickers({})
  }, [assignment, visible])

  async function loadAssessmentOptions(taskIndex, query = '', page = 1, append = false) {
    const trimmedQuery = String(query || '').trim()
    setAssessmentPickers((prev) => ({
      ...prev,
      [taskIndex]: {
        ...(prev[taskIndex] || {}),
        query: trimmedQuery,
        loading: true,
        error: '',
      },
    }))

    try {
      const payload = assignmentId || assignment?.id
        ? await getTeacherAssignmentAssessmentOptions(assignmentId || assignment?.id, { q: trimmedQuery || undefined, page, pageSize: 10 })
        : await getTeacherSessionAssignmentAssessmentOptions(sessionId, { q: trimmedQuery || undefined, page, pageSize: 10 })
      setAssessmentPickers((prev) => {
        const current = prev[taskIndex] || {}
        return {
          ...prev,
          [taskIndex]: {
            ...current,
            query: trimmedQuery,
            loading: false,
            error: '',
            page,
            meta: payload?.meta || null,
            options: append ? [...(current.options || []), ...(payload?.data || [])] : (payload?.data || []),
          },
        }
      })
    } catch (error) {
      if (isDev) {
        console.error('[assignment-preview] failed to load assessment options', {
          error,
          response: error?.response?.data,
          taskIndex,
          query: trimmedQuery,
          assignmentId: assignmentId || assignment?.id || null,
          sessionId,
        })
      }
      setAssessmentPickers((prev) => ({
        ...prev,
        [taskIndex]: {
          ...(prev[taskIndex] || {}),
          query: trimmedQuery,
          loading: false,
          error: error?.response?.data?.error?.message || error?.message || 'Không thể tải danh sách đề kiểm tra.',
        },
      }))
    }
  }

  async function openAssessmentPreview(taskIndex) {
    const summary = form.tasks[taskIndex]?.assessmentSummary
    const assessmentVersionId = summary?.assessmentVersion?.id
    if (!assessmentVersionId) return

    setAssessmentPickers((prev) => ({
      ...prev,
      [taskIndex]: {
        ...(prev[taskIndex] || {}),
        previewLoading: true,
        error: '',
      },
    }))

    try {
      const payload = assignmentId || assignment?.id
        ? await startTeacherAssignmentAssessmentPreview(assignmentId || assignment?.id, assessmentVersionId)
        : await startTeacherSessionAssignmentAssessmentPreview(sessionId, assessmentVersionId)
      if (payload?.runnerPath) {
        window.open(payload.runnerPath, '_blank', 'noopener,noreferrer')
      }
      setAssessmentPickers((prev) => ({
        ...prev,
        [taskIndex]: {
          ...(prev[taskIndex] || {}),
          previewLoading: false,
        },
      }))
    } catch (error) {
      if (isDev) {
        console.error('[assignment-preview] failed to start preview attempt', {
          error,
          response: error?.response?.data,
          taskIndex,
          assessmentVersionId,
          assignmentId: assignmentId || assignment?.id || null,
          sessionId,
        })
      }
      setAssessmentPickers((prev) => ({
        ...prev,
        [taskIndex]: {
          ...(prev[taskIndex] || {}),
          previewLoading: false,
          error: error?.response?.data?.error?.message || error?.message || 'Không thể mở preview assessment.',
        },
      }))
    }
  }

  function updateTask(index, patch) {
    setForm((prev) => ({
      ...prev,
      tasks: prev.tasks.map((task, taskIndex) => taskIndex === index ? { ...task, ...patch } : task),
    }))
  }

  function addTask() {
    setForm((prev) => ({
      ...prev,
      tasks: [...prev.tasks, buildTask(null, prev.tasks.length + 1)],
    }))
  }

  function removeTask(index) {
    setForm((prev) => ({
      ...prev,
      tasks: prev.tasks.filter((_, taskIndex) => taskIndex !== index).map((task, taskIndex) => ({ ...task, order: taskIndex + 1 })),
    }))
  }

  function updateAssessmentSettings(index, patch) {
    setForm((prev) => ({
      ...prev,
      tasks: prev.tasks.map((task, taskIndex) => taskIndex === index ? {
        ...task,
        assessmentSettings: {
          ...normalizeAssessmentSettings(task.assessmentSettings),
          ...patch,
        },
      } : task),
    }))
  }

  function handleTaskTypeChange(index, taskType) {
    updateTask(index, taskType === 'assessment'
      ? {
          taskType,
          assessmentId: 0,
          assessmentSummary: null,
          assessmentSettings: { ...DEFAULT_ASSESSMENT_SETTINGS },
        }
      : {
          taskType,
          assessmentId: 0,
          assessmentSummary: null,
          assessmentSettings: { ...DEFAULT_ASSESSMENT_SETTINGS },
        })
    if (taskType === 'assessment') {
      loadAssessmentOptions(index, '', 1, false)
    }
  }

  function selectAssessment(index, optionId) {
    const picker = assessmentPickers[index] || {}
    const selected = (picker.options || []).find((item) => Number(item?.id || 0) === Number(optionId || 0)) || null
    if (!selected) return
    updateTask(index, {
      assessmentId: selected.id,
      assessmentSummary: selected,
      assessmentSettings: {
        ...normalizeAssessmentSettings(form.tasks[index]?.assessmentSettings),
        assessmentVersionId: selected?.assessmentVersion?.id || null,
      },
    })
  }

  const hasInvalidAssessmentTask = form.tasks.some((task) => task.taskType === 'assessment' && !task.assessmentId)

  return (
    <CModal visible={visible} onClose={() => !saving && onClose?.()} size='xl'>
      <CModalHeader>
        <CModalTitle>{assignment?.id ? 'Chỉnh sửa bài tập' : 'Tạo bài tập'}</CModalTitle>
      </CModalHeader>
      <CModalBody className='d-flex flex-column gap-4'>
        {submitError ? <CAlert color='danger'>{submitError}</CAlert> : null}

        <div>
          <CFormLabel>Tiêu đề</CFormLabel>
          <CFormInput value={form.title} onChange={(event) => setForm((prev) => ({ ...prev, title: event.target.value }))} disabled={saving} />
        </div>

        <div>
          <CFormLabel>Mô tả</CFormLabel>
          <SimpleHtmlEditor value={form.description} onChange={(value) => setForm((prev) => ({ ...prev, description: value }))} disabled={saving} rows={8} showImageControls={false} showColorControls={false} allowHtmlMode helperText='HTML đơn giản sẽ được sanitize an toàn khi lưu.' />
        </div>

        <div>
          <CFormLabel>Hạn nộp</CFormLabel>
          <CFormInput type='datetime-local' value={form.dueAt} onChange={(event) => setForm((prev) => ({ ...prev, dueAt: event.target.value }))} disabled={saving} />
        </div>

        <div className='d-flex justify-content-between align-items-center'>
          <strong>Danh sách task</strong>
          <CButton color='secondary' variant='outline' size='sm' onClick={addTask} disabled={saving}>Thêm task</CButton>
        </div>

        {form.tasks.map((task, index) => (
          <CCard key={`task-${index}`} className='border-0 shadow-sm'>
            <CCardBody className='d-flex flex-column gap-3'>
              <div className='d-flex justify-content-between align-items-center gap-2'>
                <strong>Task {index + 1}</strong>
                <CButton color='danger' variant='outline' size='sm' onClick={() => removeTask(index)} disabled={saving || form.tasks.length === 1}>Xóa</CButton>
              </div>
              <div>
                <CFormLabel>Tiêu đề task</CFormLabel>
                <CFormInput value={task.title} onChange={(event) => updateTask(index, { title: event.target.value })} disabled={saving} />
              </div>
              <div>
                <CFormLabel>Mô tả task</CFormLabel>
                <SimpleHtmlEditor value={task.description} onChange={(value) => updateTask(index, { description: value })} disabled={saving} rows={5} showImageControls={false} showColorControls={false} allowHtmlMode helperText='Có thể nhập hướng dẫn, checklist, liên kết.' />
              </div>
              <div className='d-grid' style={{ gridTemplateColumns: 'minmax(180px, 1fr) minmax(140px, 160px) minmax(140px, 160px)', gap: 16 }}>
                <div>
                  <CFormLabel>Loại task</CFormLabel>
                  <CFormSelect value={task.taskType} onChange={(event) => handleTaskTypeChange(index, event.target.value)} disabled={saving}>
                    {TASK_TYPE_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                  </CFormSelect>
                </div>
                <div>
                  <CFormLabel>Thứ tự</CFormLabel>
                  <CFormInput type='number' min={1} value={task.order} onChange={(event) => updateTask(index, { order: Number(event.target.value || index + 1) })} disabled={saving} />
                </div>
                <div className='d-flex align-items-end'>
                  <CFormCheck label='Bắt buộc' checked={task.required !== false} onChange={(event) => updateTask(index, { required: event.target.checked })} disabled={saving} />
                </div>
              </div>

              {task.taskType === 'assessment' ? (
                <div className='border rounded-3 p-3 d-flex flex-column gap-3 bg-body-tertiary'>
                  <div>
                    <div className='fw-semibold mb-2'>Đề kiểm tra</div>
                    <div className='d-flex gap-2 flex-wrap align-items-end'>
                      <div style={{ flex: '1 1 280px' }}>
                        <CFormLabel>Tìm Assessment</CFormLabel>
                        <CFormInput
                          value={assessmentPickers[index]?.query ?? task?.assessmentSummary?.code ?? task?.assessmentSummary?.title ?? ''}
                          onChange={(event) => setAssessmentPickers((prev) => ({
                            ...prev,
                            [index]: {
                              ...(prev[index] || {}),
                              query: event.target.value,
                            },
                          }))}
                          disabled={saving}
                          placeholder='Tìm theo mã hoặc tên đề...'
                        />
                      </div>
                      <CButton color='secondary' variant='outline' onClick={() => loadAssessmentOptions(index, assessmentPickers[index]?.query ?? task?.assessmentSummary?.code ?? '', 1, false)} disabled={saving || assessmentPickers[index]?.loading === true}>
                        {assessmentPickers[index]?.loading ? <CSpinner size='sm' /> : 'Tìm'}
                      </CButton>
                    </div>
                    {assessmentPickers[index]?.error ? <div className='text-danger small mt-2'>{assessmentPickers[index].error}</div> : null}
                  </div>

                  <div>
                    <CFormLabel>Chọn Assessment</CFormLabel>
                    <CFormSelect value={task.assessmentId || ''} onChange={(event) => selectAssessment(index, event.target.value)} disabled={saving}>
                      <option value=''>Chọn assessment đã publish</option>
                      {(assessmentPickers[index]?.options || []).map((option) => (
                        <option key={option.id} value={option.id}>{`${option.code || '-'} · ${option.title || '-'} · ${option?.assessmentVersion?.code || '-'}`}</option>
                      ))}
                    </CFormSelect>
                    {(assessmentPickers[index]?.meta?.pagination?.page || 1) < (assessmentPickers[index]?.meta?.pagination?.pageCount || 1) ? (
                      <div className='mt-2'>
                        <CButton size='sm' color='secondary' variant='outline' onClick={() => loadAssessmentOptions(index, assessmentPickers[index]?.query || '', (assessmentPickers[index]?.page || 1) + 1, true)} disabled={saving || assessmentPickers[index]?.loading === true}>Tải thêm</CButton>
                      </div>
                    ) : null}
                  </div>

                  {task.assessmentSummary ? (
                    <div className='border rounded-3 p-3 bg-white d-flex flex-column gap-2'>
                      <div><strong>Mã đề:</strong> {task.assessmentSummary.code || '-'}</div>
                      <div><strong>Tên đề:</strong> {task.assessmentSummary.title || '-'}</div>
                      <div><strong>Số câu:</strong> {task.assessmentSummary?.assessmentVersion?.questionCount ?? 0}</div>
                      <div><strong>Thời lượng:</strong> {task.assessmentSummary?.assessmentVersion?.durationMinutes || 0} phút</div>
                      <div><strong>Trạng thái:</strong> {task.assessmentSummary.status || '-'} / {task.assessmentSummary?.assessmentVersion?.versionStatus || '-'}</div>
                      <div className='d-flex gap-2 flex-wrap'>
                        <CButton
                          size='sm'
                          color='info'
                          variant='outline'
                          disabled={!task.assessmentSummary?.assessmentVersion?.id || assessmentPickers[index]?.previewLoading === true}
                          onClick={() => openAssessmentPreview(index)}
                        >
                          {assessmentPickers[index]?.previewLoading ? 'Đang mở preview...' : 'Xem trước'}
                        </CButton>
                      </div>
                    </div>
                  ) : (
                    <div className='small text-body-secondary'>Chọn một assessment đang hoạt động và có version published để giao cho học sinh.</div>
                  )}

                  <div className='d-grid' style={{ gridTemplateColumns: 'minmax(160px, 1fr) minmax(200px, 1fr)', gap: 16 }}>
                    <div>
                      <CFormLabel>Số lượt làm tối đa</CFormLabel>
                      <CFormInput type='number' min={1} value={task.assessmentSettings?.maxAttempts || 1} onChange={(event) => updateAssessmentSettings(index, { maxAttempts: Number(event.target.value || 1) || 1 })} disabled={saving} />
                    </div>
                    <div className='d-flex align-items-end'>
                      <CFormCheck label='Hiện điểm sau khi nộp' checked={task.assessmentSettings?.showScoreAfterSubmit !== false} onChange={(event) => updateAssessmentSettings(index, { showScoreAfterSubmit: event.target.checked })} disabled={saving} />
                    </div>
                  </div>
                </div>
              ) : null}
            </CCardBody>
          </CCard>
        ))}

        {hasInvalidAssessmentTask ? <CAlert color='warning' className='mb-0'>Task loại làm bài kiểm tra cần chọn một assessment hợp lệ trước khi lưu.</CAlert> : null}
      </CModalBody>
      <CModalFooter>
        <CButton color='secondary' variant='outline' onClick={() => onClose?.()} disabled={saving}>Hủy</CButton>
        <CButton color='primary' onClick={() => onSave?.({
          title: form.title,
          description: form.description,
          dueAt: form.dueAt || null,
          tasks: form.tasks.map((task, index) => ({
            title: task.title,
            description: task.description,
            taskType: task.taskType,
            order: Number(task.order || index + 1) || index + 1,
            required: task.required !== false,
            assessmentId: task.taskType === 'assessment' ? task.assessmentId : null,
            assessmentSettings: task.taskType === 'assessment' ? normalizeAssessmentSettings(task.assessmentSettings) : null,
          })),
        })} disabled={saving || hasInvalidAssessmentTask}>{saving ? 'Đang lưu...' : 'Lưu bài tập'}</CButton>
      </CModalFooter>
    </CModal>
  )
}