import { useEffect, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { CAlert, CBadge, CButton, CCard, CCardBody, CCardHeader, CCol, CNav, CNavItem, CNavLink, CRow, CSpinner, CTabContent, CTabPane } from '@coreui/react'
import ClassSessionDetailModal, { ClassSessionAttendanceSection, ClassSessionReportSection } from '../components/ClassSessionDetailModal'
import TeacherSessionAssignmentsPanel from '../components/TeacherSessionAssignmentsPanel'
import {
  completeClassSession,
  completeTeacherSession,
  getClassSessionDetail,
  getTeacherSessionAssignments,
  getTeacherSessionDetail,
  saveClassSessionAttendance,
  saveTeacherSessionReport,
  saveTeacherSessionAttendance,
  updateClassSessionReport,
} from '../services/classService'
import { formatSessionDate, formatSessionDateTime, formatSessionTime, formatTeacherDisplay, getClassSessionStatusMeta } from '../utils/classSessionUi'

function getApiMessage(error, fallback) {
  return error?.response?.data?.error?.message || error?.response?.data?.message || error?.message || fallback
}

export default function TeacherSessionDetailPage() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const { classId, sessionId } = useParams()
  const isAdminRoute = Boolean(classId)
  const [loading, setLoading] = useState(false)
  const [detail, setDetail] = useState(null)
  const [error, setError] = useState('')
  const [saveStatus, setSaveStatus] = useState('')
  const [progressLoading, setProgressLoading] = useState(false)
  const [progressRows, setProgressRows] = useState([])
  const [activeTab, setActiveTab] = useState(() => String(searchParams.get('tab') || 'overview').trim() || 'overview')

  useEffect(() => {
    const nextTab = String(searchParams.get('tab') || 'overview').trim() || 'overview'
    if (nextTab !== activeTab) {
      setActiveTab(nextTab)
    }
  }, [activeTab, searchParams])

  function handleTabChange(nextTab) {
    setActiveTab(nextTab)
    const next = new URLSearchParams(searchParams)
    next.set('tab', nextTab)
    setSearchParams(next, { replace: true })
  }

  useEffect(() => {
    if (!sessionId) {
      setDetail(null)
      setProgressRows([])
      return
    }

    let active = true

    async function load() {
      setLoading(true)
      setError('')
      try {
        const nextDetail = isAdminRoute
          ? await getClassSessionDetail(classId, sessionId)
          : await getTeacherSessionDetail(sessionId)

        if (!active) return
        setDetail(nextDetail)
      } catch (requestError) {
        if (!active) return
        setDetail(null)
        setError(getApiMessage(requestError, 'Không thể tải chi tiết buổi học.'))
      } finally {
        if (active) setLoading(false)
      }
    }

    load()
    return () => {
      active = false
    }
  }, [classId, isAdminRoute, sessionId])

  useEffect(() => {
    if (!detail?.id) {
      setProgressRows([])
      return
    }

    let active = true

    async function loadProgress() {
      setProgressLoading(true)
      try {
        const assignments = await getTeacherSessionAssignments(detail.id)
        if (!active) return

        const learnersMap = new Map()

        for (const assignment of assignments || []) {
          const assignmentDueAt = assignment?.dueAt ? new Date(assignment.dueAt).getTime() : null
          const now = Date.now()

          for (const learnerRow of assignment?.learners || []) {
            const learnerId = learnerRow?.learner?.id || learnerRow?.learner?.code || learnerRow?.learner?.fullName
            const baseEntry = learnersMap.get(learnerId) || {
              learner: learnerRow?.learner || null,
              totalTask: 0,
              completed: 0,
              submitted: 0,
              returned: 0,
              overdue: 0,
            }

            const tasks = Array.isArray(learnerRow?.tasks) ? learnerRow.tasks : []
            for (const task of tasks) {
              baseEntry.totalTask += 1
              const status = String(task?.status || '').toLowerCase()

              if (status === 'completed') baseEntry.completed += 1
              if (status === 'submitted') baseEntry.submitted += 1
              if (status === 'returned') baseEntry.returned += 1

              if (assignmentDueAt && now > assignmentDueAt && !['completed', 'returned', 'submitted'].includes(status)) {
                baseEntry.overdue += 1
              }
            }

            learnersMap.set(learnerId, baseEntry)
          }
        }

        const rows = [...learnersMap.values()].map((entry) => ({
          learner: entry.learner,
          totalTask: entry.totalTask,
          completed: entry.completed,
          submitted: entry.submitted,
          returned: entry.returned,
          overdue: entry.overdue,
        })).sort((a, b) => (a.learner?.fullName || a.learner?.code || '').localeCompare(b.learner?.fullName || b.learner?.code || ''))

        setProgressRows(rows)
      } catch {
        if (!active) return
        setProgressRows([])
      } finally {
        if (active) setProgressLoading(false)
      }
    }

    loadProgress()
    return () => {
      active = false
    }
  }, [detail?.id])

  function handleBack() {
    if (isAdminRoute && classId) {
      navigate(`/classes/${classId}`)
      return
    }
    navigate('/teacher/sessions')
  }

  async function handleSaveAttendance(payload) {
    if (!sessionId) return null
    setSaveStatus('attendance')
    setError('')
    try {
      const updated = isAdminRoute
        ? await saveClassSessionAttendance(classId, sessionId, payload)
        : await saveTeacherSessionAttendance(sessionId, payload)
      setDetail(updated)
      return updated
    } catch (requestError) {
      setError(getApiMessage(requestError, 'Không thể lưu điểm danh.'))
      throw requestError
    } finally {
      setSaveStatus('')
    }
  }

  async function handleSaveReport(payload) {
    if (!sessionId) return null
    setSaveStatus('report')
    setError('')
    try {
      const updated = isAdminRoute
        ? await updateClassSessionReport(classId, sessionId, payload)
        : await saveTeacherSessionReport(sessionId, payload)
      setDetail(updated)
      return updated
    } catch (requestError) {
      setError(getApiMessage(requestError, 'Không thể lưu báo cáo buổi học.'))
      throw requestError
    } finally {
      setSaveStatus('')
    }
  }

  async function handleComplete(payload) {
    if (!sessionId) return null
    setSaveStatus('complete')
    setError('')
    try {
      const updated = isAdminRoute
        ? await completeClassSession(classId, sessionId, payload)
        : await completeTeacherSession(sessionId, payload)
      setDetail(updated)
      return updated
    } catch (requestError) {
      setError(getApiMessage(requestError, 'Không thể hoàn thành buổi học.'))
      throw requestError
    } finally {
      setSaveStatus('')
    }
  }

  async function handleFieldSave(_field, payload) {
    if (!sessionId) return null
    setSaveStatus('content-editor')
    setError('')
    try {
      const updated = isAdminRoute
        ? await updateClassSessionReport(classId, sessionId, payload)
        : await saveTeacherSessionReport(sessionId, payload)
      setDetail(updated)
      return updated
    } catch (requestError) {
      setError(getApiMessage(requestError, 'Không thể lưu nội dung báo cáo.'))
      throw requestError
    } finally {
      setSaveStatus('')
    }
  }

  return (
    <div className='container-fluid py-4'>
      <CCard className='border-0 shadow-sm mb-4'>
        <CCardHeader className='d-flex justify-content-between align-items-center flex-wrap gap-2'>
          <strong>{isAdminRoute ? 'Chi tiết buổi học lớp' : 'Buổi học của tôi'}</strong>
          <CButton color='secondary' variant='outline' size='sm' onClick={handleBack}>Quay lại</CButton>
        </CCardHeader>
        <CCardBody>
          {error ? <CAlert color='danger'>{error}</CAlert> : null}
          {loading ? <div className='text-center py-4'><CSpinner color='primary' /></div> : null}
        </CCardBody>
      </CCard>

      {!loading && detail ? (
        <>
          <CNav variant='tabs' className='mb-4'>
            <CNavItem>
              <CNavLink active={activeTab === 'overview'} onClick={(event) => { event.preventDefault(); handleTabChange('overview') }} role='button'>Tổng quan</CNavLink>
            </CNavItem>
            <CNavItem>
              <CNavLink active={activeTab === 'attendance'} onClick={(event) => { event.preventDefault(); handleTabChange('attendance') }} role='button'>Điểm danh</CNavLink>
            </CNavItem>
            <CNavItem>
              <CNavLink active={activeTab === 'report'} onClick={(event) => { event.preventDefault(); handleTabChange('report') }} role='button'>Báo cáo</CNavLink>
            </CNavItem>
            <CNavItem>
              <CNavLink active={activeTab === 'assignments'} onClick={(event) => { event.preventDefault(); handleTabChange('assignments') }} role='button'>Bài tập</CNavLink>
            </CNavItem>
            <CNavItem>
              <CNavLink active={activeTab === 'progress'} onClick={(event) => { event.preventDefault(); handleTabChange('progress') }} role='button'>Tiến độ học viên</CNavLink>
            </CNavItem>
          </CNav>

          <CTabContent>
            <CTabPane visible={activeTab === 'overview'}>
              <CRow className='g-4'>
                <CCol lg={4}>
                  <CCard className='border-0 shadow-sm h-100'>
                    <CCardHeader><strong>Thông tin buổi học</strong></CCardHeader>
                    <CCardBody>
                      <div className='mb-3'><strong>Lớp:</strong> {detail?.class?.name || '-'}</div>
                      <div className='mb-3'><strong>Ngày:</strong> {formatSessionDate(detail?.sessionDate)}</div>
                      <div className='mb-3'><strong>Giờ:</strong> {formatSessionTime(detail?.startTime)}-{formatSessionTime(detail?.endTime)}</div>
                      <div className='mb-3'><strong>Giáo viên:</strong> {formatTeacherDisplay(detail?.teacher)}</div>
                      <div className='mb-3'><strong>Trạng thái:</strong> <CBadge color={getClassSessionStatusMeta(detail?.status).color}>{getClassSessionStatusMeta(detail?.status).label}</CBadge></div>
                      <div className='mb-3'><strong>Điểm danh:</strong> {detail?.attendanceSummary?.label || '—'}</div>
                      <div className='mb-3'><strong>Báo cáo:</strong> {detail?.reportSummary?.isCompleted ? 'Đã hoàn thành' : detail?.reportSummary?.hasReport ? 'Đã lưu tạm' : 'Chưa có'}</div>
                      {detail?.completedAt ? <div className='mb-3'><strong>Hoàn thành lúc:</strong> {formatSessionDateTime(detail.completedAt)}</div> : null}
                      {detail?.cancelReason ? <div><strong>Lý do hủy:</strong> {detail.cancelReason}</div> : null}
                    </CCardBody>
                  </CCard>
                </CCol>
                <CCol lg={8}>
                  <CCard className='border-0 shadow-sm'>
                    <CCardHeader><strong>Tóm tắt nhanh</strong></CCardHeader>
                    <CCardBody>
                      <ul className='mb-0'>
                        <li>Số learner: {detail?.attendanceSummary?.eligibleCount ?? detail?.eligibleLearners?.length ?? detail?.attendanceRows?.length ?? 0}</li>
                        <li>Đã điểm danh: {detail?.attendanceSummary?.markedCount ?? 0}</li>
                        <li>Điểm danh: {detail?.attendanceSummary?.label || 'Chưa có'}</li>
                        <li>Báo cáo: {detail?.reportSummary?.hasReport ? 'Đã có' : 'Chưa có'}</li>
                        <li>Trạng thái: {detail?.reportSummary?.isCompleted ? 'Hoàn thành' : 'Đang xử lý'}</li>
                      </ul>
                    </CCardBody>
                  </CCard>
                </CCol>
              </CRow>
            </CTabPane>

            <CTabPane visible={activeTab === 'attendance'}>
              <ClassSessionAttendanceSection sessionDetail={detail} saveStatus={saveStatus} onSaveAttendance={handleSaveAttendance} />
            </CTabPane>

            <CTabPane visible={activeTab === 'report'}>
              <ClassSessionReportSection sessionDetail={detail} saveStatus={saveStatus} onSaveReport={handleSaveReport} onComplete={handleComplete} onFieldSave={handleFieldSave} />
            </CTabPane>

            <CTabPane visible={activeTab === 'assignments'}>
              <TeacherSessionAssignmentsPanel sessionId={detail?.id} canManage={detail?.permissions?.canEditReport === true || detail?.permissions?.canComplete === true || detail?.permissions?.canManage === true} />
            </CTabPane>

            <CTabPane visible={activeTab === 'progress'}>
              <CCard className='border-0 shadow-sm'>
                <CCardHeader><strong>Tiến độ học viên</strong></CCardHeader>
                <CCardBody>
                  {progressLoading ? <div className='text-center py-3'><CSpinner color='primary' size='sm' /></div> : (
                    <div className='table-responsive'>
                      <table className='table table-hover align-middle mb-0'>
                        <thead>
                          <tr>
                            <th>Học viên</th>
                            <th>Tổng task</th>
                            <th>Completed</th>
                            <th>Submitted</th>
                            <th>Returned</th>
                            <th>Overdue</th>
                          </tr>
                        </thead>
                        <tbody>
                          {progressRows.length === 0 ? (
                            <tr><td colSpan={6} className='text-center text-body-secondary'>Chưa có dữ liệu tiến độ learner.</td></tr>
                          ) : progressRows.map((row) => (
                            <tr key={row.learner?.id || row.learner?.code || row.learner?.fullName || Math.random()}>
                              <td>{row.learner?.fullName || row.learner?.code || '-'}</td>
                              <td>{row.totalTask || 0}</td>
                              <td>{row.completed || 0}</td>
                              <td>{row.submitted || 0}</td>
                              <td>{row.returned || 0}</td>
                              <td>{row.overdue || 0}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </CCardBody>
              </CCard>
            </CTabPane>
          </CTabContent>
        </>
      ) : null}

      <ClassSessionDetailModal
        visible={false}
        title={isAdminRoute ? 'Chi tiết buổi học' : 'Buổi học của tôi'}
        loading={loading}
        sessionDetail={detail}
        saveStatus={saveStatus}
        loadError={error}
        onClose={() => {
          if (!saveStatus) handleBack()
        }}
        onSaveAttendance={handleSaveAttendance}
        onSaveReport={handleSaveReport}
        onComplete={handleComplete}
        onFieldSave={handleFieldSave}
      />
    </div>
  )
}
