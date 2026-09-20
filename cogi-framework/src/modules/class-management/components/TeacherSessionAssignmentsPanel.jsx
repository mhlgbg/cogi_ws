import { useCallback, useEffect, useState } from 'react'
import { CAlert, CBadge, CButton, CCard, CCardBody, CCardHeader, CSpinner, CTable, CTableBody, CTableDataCell, CTableHead, CTableHeaderCell, CTableRow } from '@coreui/react'
import { createTeacherSessionAssignment, getTeacherSessionAssignments } from '../services/classService'
import { getClassSessionContentPreview } from '../utils/classSessionContentHtml'
import { formatSessionDateTime } from '../utils/classSessionUi'
import TeacherAssignmentDetailModal from './TeacherAssignmentDetailModal'
import TeacherAssignmentEditorModal from './TeacherAssignmentEditorModal'

function getApiMessage(error, fallback) {
  return error?.response?.data?.error?.message || error?.response?.data?.message || error?.message || fallback
}

const STATUS_META = {
  draft: { label: 'Draft', color: 'secondary' },
  published: { label: 'Published', color: 'primary' },
  closed: { label: 'Closed', color: 'dark' },
  cancelled: { label: 'Cancelled', color: 'danger' },
}

export default function TeacherSessionAssignmentsPanel({ sessionId, canManage = false }) {
  const [loading, setLoading] = useState(false)
  const [rows, setRows] = useState([])
  const [error, setError] = useState('')
  const [detailId, setDetailId] = useState(null)
  const [createOpen, setCreateOpen] = useState(false)
  const [createError, setCreateError] = useState('')
  const [createSaving, setCreateSaving] = useState(false)

  const load = useCallback(async () => {
    if (!sessionId) {
      setRows([])
      return
    }
    setLoading(true)
    setError('')
    try {
      setRows(await getTeacherSessionAssignments(sessionId))
    } catch (requestError) {
      setRows([])
      setError(getApiMessage(requestError, 'Không thể tải bài tập của buổi học.'))
    } finally {
      setLoading(false)
    }
  }, [sessionId])

  useEffect(() => {
    load()
  }, [load])

  return (
    <>
      <CCard className='border-0 shadow-sm mb-4'>
        <CCardHeader className='d-flex justify-content-between align-items-center gap-2 flex-wrap'>
          <strong>Bài tập</strong>
          {canManage ? <CButton size='sm' color='primary' onClick={() => { setCreateError(''); setCreateOpen(true) }}>Tạo Assignment</CButton> : null}
        </CCardHeader>
        <CCardBody>
          {error ? <CAlert color='danger'>{error}</CAlert> : null}
          {loading ? <div className='d-flex align-items-center gap-2'><CSpinner size='sm' /><span>Đang tải bài tập...</span></div> : (
            <CTable hover responsive>
              <CTableHead>
                <CTableRow>
                  <CTableHeaderCell>Tiêu đề</CTableHeaderCell>
                  <CTableHeaderCell>Hạn nộp</CTableHeaderCell>
                  <CTableHeaderCell>Trạng thái</CTableHeaderCell>
                  <CTableHeaderCell>Task</CTableHeaderCell>
                  <CTableHeaderCell>Tiến độ</CTableHeaderCell>
                  <CTableHeaderCell>Hành động</CTableHeaderCell>
                </CTableRow>
              </CTableHead>
              <CTableBody>
                {rows.length === 0 ? <CTableRow><CTableDataCell colSpan={6} className='text-center text-body-secondary'>Chưa có assignment nào.</CTableDataCell></CTableRow> : rows.map((item) => (
                  <CTableRow key={item.id}>
                    <CTableDataCell>
                      <div className='fw-semibold'>{item.title || '-'}</div>
                      <div className='small text-body-secondary'>{getClassSessionContentPreview(item.description, 140)}</div>
                      {item.assessmentVisibilitySummary ? <div className='small text-body-secondary'>{item.assessmentVisibilitySummary}</div> : null}
                      <div className='small text-body-secondary'>{item.learnerCount || 0} learner</div>
                    </CTableDataCell>
                    <CTableDataCell>{formatSessionDateTime(item.dueAt)}</CTableDataCell>
                    <CTableDataCell><CBadge color={(STATUS_META[item.status] || STATUS_META.draft).color}>{(STATUS_META[item.status] || STATUS_META.draft).label}</CBadge></CTableDataCell>
                    <CTableDataCell>{item.taskCount || 0}</CTableDataCell>
                    <CTableDataCell>{item.completedCount || 0}/{item.learnerCount || 0}</CTableDataCell>
                    <CTableDataCell><CButton size='sm' color='primary' variant='outline' onClick={() => setDetailId(item.id)}>Mở</CButton></CTableDataCell>
                  </CTableRow>
                ))}
              </CTableBody>
            </CTable>
          )}
        </CCardBody>
      </CCard>

      <TeacherAssignmentEditorModal
        visible={createOpen}
        saving={createSaving}
        sessionId={sessionId}
        submitError={createError}
        onClose={() => !createSaving && setCreateOpen(false)}
        onSave={async (payload) => {
          setCreateSaving(true)
          setCreateError('')
          try {
            const created = await createTeacherSessionAssignment(sessionId, payload)
            setCreateOpen(false)
            await load()
            setDetailId(created?.id || null)
          } catch (requestError) {
            setCreateError(getApiMessage(requestError, 'Không thể tạo assignment.'))
          } finally {
            setCreateSaving(false)
          }
        }}
      />

      <TeacherAssignmentDetailModal visible={Boolean(detailId)} assignmentId={detailId} onClose={() => setDetailId(null)} onChanged={load} />
    </>
  )
}