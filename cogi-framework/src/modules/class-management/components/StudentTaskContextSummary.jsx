import { CCard, CCardBody } from '@coreui/react'
import { sanitizeClassSessionContentHtml } from '../utils/classSessionContentHtml'
import { formatSessionDate, formatSessionDateTime, formatSessionTime, formatTeacherDisplay } from '../utils/classSessionUi'

const TASK_TYPE_LABELS = {
  assessment: 'Bài kiểm tra',
  submission: 'Nộp bài',
  todo: 'Todo/checklist',
}

function HtmlView({ value }) {
  const html = sanitizeClassSessionContentHtml(value || '')
  return html ? <div dangerouslySetInnerHTML={{ __html: html }} /> : <div className='text-body-secondary'>Chưa có nội dung.</div>
}

function getTaskTypeLabel(taskType) {
  return TASK_TYPE_LABELS[taskType] || taskType || 'Khác'
}

export default function StudentTaskContextSummary({ assignment = null, task = null }) {
  if (!assignment && !task) return null

  const sessionLabel = assignment?.classSession?.sessionDate
    ? `${formatSessionDate(assignment.classSession.sessionDate)} · ${formatSessionTime(assignment.classSession.startTime)}-${formatSessionTime(assignment.classSession.endTime)}`
    : 'Không gắn buổi học'

  return (
    <div className='d-flex flex-column gap-3'>
      <CCard className='border-0 shadow-sm bg-body-tertiary'>
        <CCardBody className='d-flex flex-column gap-3'>
          <div className='fw-semibold'>Thông tin bài tập</div>
          <div className='d-grid gap-3' style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))' }}>
            <div>
              <div className='small text-body-secondary'>Bài tập</div>
              <div>{assignment?.title || '-'}</div>
            </div>
            <div>
              <div className='small text-body-secondary'>Task</div>
              <div>{task?.title || '-'}</div>
            </div>
            <div>
              <div className='small text-body-secondary'>Lớp</div>
              <div>{assignment?.class?.name || '-'}{assignment?.class?.subjectCode ? ` (${assignment.class.subjectCode})` : ''}</div>
            </div>
            <div>
              <div className='small text-body-secondary'>Buổi học</div>
              <div>{sessionLabel}</div>
            </div>
            <div>
              <div className='small text-body-secondary'>Giáo viên</div>
              <div>{formatTeacherDisplay(assignment?.assignedBy)}</div>
            </div>
            <div>
              <div className='small text-body-secondary'>Hạn nộp</div>
              <div>{formatSessionDateTime(assignment?.dueAt)}</div>
            </div>
            <div>
              <div className='small text-body-secondary'>Loại</div>
              <div>{getTaskTypeLabel(task?.taskType)}</div>
            </div>
            <div>
              <div className='small text-body-secondary'>Bắt buộc</div>
              <div>{task?.required === false ? 'Không' : 'Có'}</div>
            </div>
          </div>
        </CCardBody>
      </CCard>

      <CCard className='border-0 shadow-sm'>
        <CCardBody className='d-flex flex-column gap-2'>
          <div className='fw-semibold'>Yêu cầu</div>
          <HtmlView value={task?.description} />
        </CCardBody>
      </CCard>
    </div>
  )
}