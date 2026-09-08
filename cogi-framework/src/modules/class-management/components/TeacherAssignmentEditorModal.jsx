import { useEffect, useState } from 'react'
import { CAlert, CButton, CCard, CCardBody, CFormCheck, CFormInput, CFormLabel, CFormSelect, CModal, CModalBody, CModalFooter, CModalHeader, CModalTitle } from '@coreui/react'
import SimpleHtmlEditor from '../../admission-management/components/SimpleHtmlEditor'

const TASK_TYPE_OPTIONS = [
  { value: 'todo', label: 'Chỉ cần hoàn thành' },
  { value: 'submission', label: 'Nộp bài' },
  { value: 'assessment', label: 'Assessment (coming later)', disabled: true },
]

function buildTask(task = null, order = 1) {
  return {
    title: String(task?.title || '').trim(),
    description: String(task?.description || '').trim() || '<p></p>',
    order: Number(task?.order || order) || order,
    required: task?.required !== false,
    taskType: String(task?.taskType || 'todo').trim() || 'todo',
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

export default function TeacherAssignmentEditorModal({ visible = false, saving = false, assignment = null, submitError = '', onClose, onSave }) {
  const [form, setForm] = useState(buildFormState(assignment))

  useEffect(() => {
    setForm(buildFormState(assignment))
  }, [assignment, visible])

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
                  <CFormSelect value={task.taskType} onChange={(event) => updateTask(index, { taskType: event.target.value })} disabled={saving}>
                    {TASK_TYPE_OPTIONS.map((option) => <option key={option.value} value={option.value} disabled={option.disabled === true}>{option.label}</option>)}
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
            </CCardBody>
          </CCard>
        ))}
      </CModalBody>
      <CModalFooter>
        <CButton color='secondary' variant='outline' onClick={() => onClose?.()} disabled={saving}>Hủy</CButton>
        <CButton color='primary' onClick={() => onSave?.({
          title: form.title,
          description: form.description,
          dueAt: form.dueAt || null,
          tasks: form.tasks.map((task, index) => ({ ...task, order: Number(task.order || index + 1) || index + 1 })),
        })} disabled={saving}>{saving ? 'Đang lưu...' : 'Lưu bài tập'}</CButton>
      </CModalFooter>
    </CModal>
  )
}