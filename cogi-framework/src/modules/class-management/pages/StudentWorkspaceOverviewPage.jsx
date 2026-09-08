import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { CAlert, CButton, CCard, CCardBody, CCardHeader, CCol, CRow, CSpinner } from '@coreui/react'
import StudentPortalContextCard from '../components/StudentPortalContextCard'
import StudentSessionTable from '../components/StudentSessionTable'
import { getStudentClasses, getStudentSessions } from '../services/classService'
import useStudentPortalContext from '../utils/useStudentPortalContext'
import { formatSessionDate, formatSessionTime, formatTeacherDisplay } from '../utils/classSessionUi'

function getApiMessage(error, fallback) {
  return error?.response?.data?.error?.message || error?.response?.data?.message || error?.message || fallback
}

function splitGroups(rows = []) {
  return {
    today: rows.filter((item) => item?.status !== 'cancelled' && item?.timing?.isToday),
    upcoming: rows.filter((item) => item?.status !== 'cancelled' && !item?.timing?.isToday && item?.timing?.isUpcoming),
  }
}

function SummaryCard({ label, value, hint }) {
  return (
    <CCard className='border-0 shadow-sm h-100'>
      <CCardBody>
        <div className='small text-body-secondary mb-1'>{label}</div>
        <div className='fs-3 fw-semibold'>{value}</div>
        {hint ? <div className='small text-body-secondary mt-2'>{hint}</div> : null}
      </CCardBody>
    </CCard>
  )
}

export default function StudentWorkspaceOverviewPage() {
  const navigate = useNavigate()
  const portal = useStudentPortalContext()
  const [loading, setLoading] = useState(false)
  const [classes, setClasses] = useState([])
  const [sessions, setSessions] = useState([])
  const [error, setError] = useState('')

  const groups = useMemo(() => splitGroups(sessions), [sessions])
  const activeClasses = useMemo(() => classes.filter((item) => item?.enrollmentContext?.isCurrent), [classes])
  const recentAttendanceSession = useMemo(() => sessions.find((item) => item?.myAttendance?.status) || null, [sessions])

  useEffect(() => {
    if (!portal.context || !portal.selectedLearnerId) {
      setClasses([])
      setSessions([])
      return
    }

    let active = true
    async function load() {
      setLoading(true)
      setError('')
      try {
        const [classResult, sessionResult] = await Promise.all([
          getStudentClasses({ learnerId: portal.selectedLearnerId }),
          getStudentSessions({ learnerId: portal.selectedLearnerId }),
        ])
        if (!active) return
        setClasses(Array.isArray(classResult?.rows) ? classResult.rows : [])
        setSessions(Array.isArray(sessionResult?.rows) ? sessionResult.rows : [])
      } catch (requestError) {
        if (!active) return
        setClasses([])
        setSessions([])
        setError(getApiMessage(requestError, 'Không thể tải tổng quan học tập.'))
      } finally {
        if (active) setLoading(false)
      }
    }

    load()
    return () => {
      active = false
    }
  }, [portal.context, portal.selectedLearnerId])

  const latestHomeworkSession = sessions.find((item) => String(item?.homework || '').trim()) || null

  return (
    <div className='container-fluid py-4'>
      <StudentPortalContextCard
        title='Học tập của tôi'
        description='Student Portal hoạt động theo hồ sơ học tập đang được chọn trong tenant hiện tại.'
        context={portal.context}
        selectedLearnerId={portal.selectedLearnerId}
        onSelectLearner={portal.setSelectedLearnerId}
        error={portal.error}
      />

      {error ? <CAlert color='danger'>{error}</CAlert> : null}

      {portal.loading || loading ? (
        <div className='text-center py-5'><CSpinner color='primary' /></div>
      ) : (
        <>
          <CRow className='g-3 mb-4'>
            <CCol md={6} xl={3}><SummaryCard label='Lớp đang học' value={activeClasses.length} hint={portal.context?.learnerContext?.fullName || 'Chưa chọn hồ sơ'} /></CCol>
            <CCol md={6} xl={3}><SummaryCard label='Buổi học hôm nay' value={groups.today.length} hint={groups.today[0] ? `${formatSessionDate(groups.today[0].sessionDate)} · ${formatSessionTime(groups.today[0].startTime)}-${formatSessionTime(groups.today[0].endTime)}` : 'Chưa có buổi học hôm nay'} /></CCol>
            <CCol md={6} xl={3}><SummaryCard label='Buổi sắp tới' value={groups.upcoming.length} hint={groups.upcoming[0] ? `${groups.upcoming[0]?.class?.name || '-'} · ${formatSessionDate(groups.upcoming[0].sessionDate)}` : 'Chưa có buổi học sắp tới'} /></CCol>
            <CCol md={6} xl={3}><SummaryCard label='Bài tập gần nhất' value={latestHomeworkSession ? 'Có' : 'Chưa có'} hint={latestHomeworkSession ? `${latestHomeworkSession?.class?.name || '-'} · ${formatTeacherDisplay(latestHomeworkSession.teacher)}` : 'Chưa có bài tập được giao'} /></CCol>
          </CRow>

          <CRow className='g-3 mb-4'>
            <CCol md={12}>
              <SummaryCard label='Chuyên cần gần đây' value={recentAttendanceSession?.myAttendance?.status ? 'Đã có dữ liệu' : 'Chưa có'} hint={recentAttendanceSession?.myAttendance?.status ? `${recentAttendanceSession?.class?.name || '-'} · ${recentAttendanceSession.myAttendance.status}` : 'Chưa có buổi học nào được điểm danh cho hồ sơ hiện tại'} />
            </CCol>
          </CRow>

          <CCard className='border-0 shadow-sm mb-4'>
            <CCardHeader className='d-flex justify-content-between align-items-center gap-2 flex-wrap'>
              <strong>Lớp đang học</strong>
              <CButton color='primary' variant='outline' size='sm' onClick={() => navigate('/student/classes')}>Xem tất cả lớp</CButton>
            </CCardHeader>
            <CCardBody>
              {activeClasses.length === 0 ? (
                <div className='text-body-secondary'>Hồ sơ hiện tại chưa có lớp đang học.</div>
              ) : activeClasses.slice(0, 3).map((item) => (
                <div key={item.id} className='border rounded-3 p-3 mb-3'>
                  <div className='fw-semibold'>{item.name || '-'}</div>
                  <div className='small text-body-secondary mb-2'>{item.subjectCode || '-'} · {item.subject || '-'}</div>
                  <div>Giáo viên chính: {formatTeacherDisplay(item.mainTeacher)}</div>
                  <div>Ngày tham gia: {formatSessionDate(item?.enrollmentContext?.joinDate)}</div>
                </div>
              ))}
            </CCardBody>
          </CCard>

          <StudentSessionTable title='Buổi học hôm nay' rows={groups.today} onOpen={(item) => navigate(`/student/sessions/${item.id}`)} emptyMessage='Không có buổi học hôm nay.' />
          <StudentSessionTable title='Buổi học sắp tới' rows={groups.upcoming.slice(0, 5)} onOpen={(item) => navigate(`/student/sessions/${item.id}`)} emptyMessage='Không có buổi học sắp tới.' />
        </>
      )}
    </div>
  )
}