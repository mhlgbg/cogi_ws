import { useEffect, useState } from 'react'
import { CAlert, CBadge, CButton, CCard, CCardBody, CCardHeader, CSpinner, CTable, CTableBody, CTableDataCell, CTableHead, CTableHeaderCell, CTableRow } from '@coreui/react'
import { getStudentSessionAssignments } from '../services/classService'
import { getClassSessionContentPreview } from '../utils/classSessionContentHtml'
import { formatSessionDateTime } from '../utils/classSessionUi'
import StudentAssignmentDetailModal from './StudentAssignmentDetailModal'

const PROGRESS_META = {
  assigned: { label: 'Chưa bắt đầu', color: 'secondary' },
  in_progress: { label: 'Đang làm', color: 'info' },
  submitted: { label: 'Đã nộp', color: 'warning' },
  completed: { label: 'Hoàn thành', color: 'success' },
  returned: { label: 'Làm lại', color: 'danger' },
}

function getApiMessage(error, fallback) {
  return error?.response?.data?.error?.message || error?.response?.data?.message || error?.message || fallback
}

export default function StudentSessionAssignmentsPanel({ sessionId, learnerId = '' }) {
  const [loading, setLoading] = useState(false)
  const [rows, setRows] = useState([])
  const [error, setError] = useState('')
  const [detailId, setDetailId] = useState(null)

  async function load() {
    if (!sessionId || !learnerId) {
      setRows([])
      return
    }
    setLoading(true)
    setError('')
    try {
      setRows(await getStudentSessionAssignments(sessionId, { learnerId }))
    } catch (requestError) {
      setRows([])
      setError(getApiMessage(requestError, 'Không thể tải assignment của buổi học.'))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [sessionId, learnerId])

  return (
    <>
      <CCard className='border-0 shadow-sm mb-4'>
        <CCardHeader><strong>Bài tập</strong></CCardHeader>
        <CCardBody>
          {error ? <CAlert color='danger'>{error}</CAlert> : null}
          {loading ? <div className='d-flex align-items-center gap-2'><CSpinner size='sm' /><span>Đang tải bài tập...</span></div> : (
            <CTable hover responsive>
              <CTableHead>
                <CTableRow>
                  <CTableHeaderCell>Tiêu đề</CTableHeaderCell>
                  <CTableHeaderCell>Hạn nộp</CTableHeaderCell>
                  <CTableHeaderCell>Tiến độ</CTableHeaderCell>
                  <CTableHeaderCell>Task</CTableHeaderCell>
                  <CTableHeaderCell>Hành động</CTableHeaderCell>
                </CTableRow>
              </CTableHead>
              <CTableBody>
                {rows.length === 0 ? <CTableRow><CTableDataCell colSpan={5} className='text-center text-body-secondary'>Chưa có assignment được giao cho learner này.</CTableDataCell></CTableRow> : rows.map((item) => (
                  <CTableRow key={item.id}>
                    <CTableDataCell>
                      <div className='fw-semibold'>{item.title || '-'}</div>
                      <div className='small text-body-secondary'>{getClassSessionContentPreview(item.description, 140)}</div>
                    </CTableDataCell>
                    <CTableDataCell>{formatSessionDateTime(item.dueAt)}</CTableDataCell>
                    <CTableDataCell><CBadge color={(PROGRESS_META[item.myProgressState] || PROGRESS_META.assigned).color}>{(PROGRESS_META[item.myProgressState] || PROGRESS_META.assigned).label}</CBadge></CTableDataCell>
                    <CTableDataCell>{item.completedTaskCount || 0}/{item.totalTaskCount || item.taskCount || 0}</CTableDataCell>
                    <CTableDataCell><CButton size='sm' color='primary' variant='outline' onClick={() => setDetailId(item.id)}>Mở</CButton></CTableDataCell>
                  </CTableRow>
                ))}
              </CTableBody>
            </CTable>
          )}
        </CCardBody>
      </CCard>

      <StudentAssignmentDetailModal visible={Boolean(detailId)} assignmentId={detailId} learnerId={learnerId} onClose={() => setDetailId(null)} onChanged={load} />
    </>
  )
}