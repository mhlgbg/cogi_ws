import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { CAlert, CBadge, CButton, CCard, CCardBody, CCardHeader, CCol, CNav, CNavItem, CNavLink, CRow, CSpinner, CTabContent, CTabPane, CTable, CTableBody, CTableDataCell, CTableHead, CTableHeaderCell, CTableRow } from '@coreui/react'
import { getTeacherClassById, getTeacherClassSessions, getTeacherSessionDetail, saveTeacherSessionAttendance, saveTeacherSessionReport, completeTeacherSession } from '../services/classService'
import ClassSessionDetailModal from '../components/ClassSessionDetailModal'
import { formatSessionDate, formatSessionTime, formatTeacherDisplay, getClassSessionStatusMeta, getSessionDisplayStatus } from '../utils/classSessionUi'

function getApiMessage(error, fallback) {
  return error?.response?.data?.error?.message || error?.response?.data?.message || error?.message || fallback
}

export default function TeacherClassDetailPage() {
  const navigate = useNavigate()
  const { classId } = useParams()
  const [loading, setLoading] = useState(true)
  const [detail, setDetail] = useState(null)
  const [sessions, setSessions] = useState([])
  const [activeTab, setActiveTab] = useState('overview')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [showSessionModal, setShowSessionModal] = useState(false)
  const [selectedSession, setSelectedSession] = useState(null)
  const [selectedSessionLoading, setSelectedSessionLoading] = useState(false)
  const [sessionAction, setSessionAction] = useState('')

  async function loadAll() {
    setLoading(true)
    setError('')
    try {
      const [classDetail, classSessions] = await Promise.all([
        getTeacherClassById(classId),
        getTeacherClassSessions(classId),
      ])
      setDetail(classDetail)
      setSessions(Array.isArray(classSessions) ? classSessions : [])
    } catch (requestError) {
      setError(getApiMessage(requestError, 'Không thể tải lớp giảng dạy.'))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadAll()
  }, [classId])

  useEffect(() => {
    if (!success) return undefined
    const timer = window.setTimeout(() => setSuccess(''), 2500)
    return () => window.clearTimeout(timer)
  }, [success])

  async function openSession(item) {
    setShowSessionModal(true)
    setSelectedSessionLoading(true)
    setError('')
    try {
      setSelectedSession(await getTeacherSessionDetail(item.id))
    } catch (requestError) {
      setSelectedSession(null)
      setError(getApiMessage(requestError, 'Không thể tải buổi học.'))
    } finally {
      setSelectedSessionLoading(false)
    }
  }

  async function refreshSelectedSession(sessionId) {
    const updated = await getTeacherSessionDetail(sessionId)
    setSelectedSession(updated)
    const classSessions = await getTeacherClassSessions(classId)
    setSessions(Array.isArray(classSessions) ? classSessions : [])
    return updated
  }

  if (loading) {
    return <div className='text-center py-5'><CSpinner color='primary' /></div>
  }

  return (
    <div className='container-fluid py-4'>
      <div className='d-flex justify-content-between align-items-start gap-3 flex-wrap mb-4'>
        <div>
          <h3 className='mb-1'>{detail?.name || 'Lớp giảng dạy'}</h3>
          <div className='text-medium-emphasis d-flex align-items-center gap-2 flex-wrap'>
            <div>{detail?.subjectCode || '-'}{detail?.subject ? ` · ${detail.subject}` : ''}</div>
            <CBadge color='info'>{detail?.roleLabels?.join(', ') || 'Giảng dạy'}</CBadge>
          </div>
        </div>
        <CButton color='light' onClick={() => navigate('/teacher/classes')}>Quay lại</CButton>
      </div>

      {success ? <CAlert color='success'>{success}</CAlert> : null}
      {error ? <CAlert color='danger'>{error}</CAlert> : null}

      <CNav variant='tabs' role='tablist' className='mb-4'>
        <CNavItem><CNavLink active={activeTab === 'overview'} onClick={() => setActiveTab('overview')} role='button'>Tổng quan</CNavLink></CNavItem>
        <CNavItem><CNavLink active={activeTab === 'learners'} onClick={() => setActiveTab('learners')} role='button'>Học viên</CNavLink></CNavItem>
        <CNavItem><CNavLink active={activeTab === 'sessions'} onClick={() => setActiveTab('sessions')} role='button'>Buổi học</CNavLink></CNavItem>
      </CNav>

      <CTabContent>
        <CTabPane visible={activeTab === 'overview'}>
          <CRow className='g-3'>
            <CCol md={6}>
              <CCard className='border-0 shadow-sm'>
                <CCardHeader><strong>Tổng quan lớp</strong></CCardHeader>
                <CCardBody>
                  <div className='mb-3'><strong>Tên lớp:</strong> {detail?.name || '-'}</div>
                  <div className='mb-3'><strong>Môn học:</strong> {detail?.subject || '-'}</div>
                  <div className='mb-3'><strong>Giáo viên chính:</strong> {formatTeacherDisplay(detail?.mainTeacher)}</div>
                  <div className='mb-3'><strong>Số học viên:</strong> {detail?.activeLearnersCount || 0}</div>
                  <div><strong>Buổi tiếp theo:</strong> {detail?.nextSession ? `${formatSessionDate(detail.nextSession.sessionDate)} · ${formatSessionTime(detail.nextSession.startTime)}-${formatSessionTime(detail.nextSession.endTime)}` : '—'}</div>
                </CCardBody>
              </CCard>
            </CCol>
          </CRow>
        </CTabPane>

        <CTabPane visible={activeTab === 'learners'}>
          <CCard className='border-0 shadow-sm'>
            <CTable hover responsive>
              <CTableHead>
                <CTableRow>
                  <CTableHeaderCell>Học viên</CTableHeaderCell>
                  <CTableHeaderCell>Join date</CTableHeaderCell>
                  <CTableHeaderCell>End date</CTableHeaderCell>
                  <CTableHeaderCell>Trạng thái</CTableHeaderCell>
                </CTableRow>
              </CTableHead>
              <CTableBody>
                {(detail?.learners || []).length === 0 ? (
                  <CTableRow><CTableDataCell colSpan={4} className='text-center text-body-secondary'>Không có học viên.</CTableDataCell></CTableRow>
                ) : (detail?.learners || []).map((row) => (
                  <CTableRow key={row.id}>
                    <CTableDataCell>{row?.learner?.fullName || row?.learner?.code || '-'}</CTableDataCell>
                    <CTableDataCell>{row.joinDate || '-'}</CTableDataCell>
                    <CTableDataCell>{row.leaveDate || '-'}</CTableDataCell>
                    <CTableDataCell>{row.enrollmentStatus === 'inactive' ? 'Ngưng hoạt động' : 'Đang hoạt động'}</CTableDataCell>
                  </CTableRow>
                ))}
              </CTableBody>
            </CTable>
          </CCard>
        </CTabPane>

        <CTabPane visible={activeTab === 'sessions'}>
          <CCard className='border-0 shadow-sm'>
            <CTable hover responsive>
              <CTableHead>
                <CTableRow>
                  <CTableHeaderCell>Ngày</CTableHeaderCell>
                  <CTableHeaderCell>Thời gian</CTableHeaderCell>
                  <CTableHeaderCell>Giáo viên</CTableHeaderCell>
                  <CTableHeaderCell>Trạng thái</CTableHeaderCell>
                  <CTableHeaderCell>Điểm danh</CTableHeaderCell>
                  <CTableHeaderCell>Báo cáo</CTableHeaderCell>
                  <CTableHeaderCell>Hành động</CTableHeaderCell>
                </CTableRow>
              </CTableHead>
              <CTableBody>
                {sessions.length === 0 ? (
                  <CTableRow><CTableDataCell colSpan={7} className='text-center text-body-secondary'>Chưa có buổi học.</CTableDataCell></CTableRow>
                ) : sessions.map((item) => {
                  const statusMeta = getClassSessionStatusMeta(item.status)
                  const ownSession = item?.permissions?.canMarkAttendance === true || item?.permissions?.canEditReport === true
                  return (
                    <CTableRow key={item.id}>
                      <CTableDataCell>{formatSessionDate(item.sessionDate)}</CTableDataCell>
                      <CTableDataCell>{formatSessionTime(item.startTime)}-{formatSessionTime(item.endTime)}</CTableDataCell>
                      <CTableDataCell>{formatTeacherDisplay(item.teacher)}</CTableDataCell>
                      <CTableDataCell><CBadge color={statusMeta.color}>{statusMeta.label}</CBadge></CTableDataCell>
                      <CTableDataCell>{item?.attendanceSummary?.label || '—'}</CTableDataCell>
                      <CTableDataCell>{getSessionDisplayStatus(item)}</CTableDataCell>
                      <CTableDataCell><CButton size='sm' color='primary' variant='outline' onClick={() => openSession(item)}>{ownSession ? 'Mở buổi học' : 'Xem'}</CButton></CTableDataCell>
                    </CTableRow>
                  )
                })}
              </CTableBody>
            </CTable>
          </CCard>
        </CTabPane>
      </CTabContent>

      <ClassSessionDetailModal
        visible={showSessionModal}
        title='Buổi học của tôi'
        loading={selectedSessionLoading}
        sessionDetail={selectedSession}
        saveStatus={sessionAction}
        loadError=''
        onClose={() => { if (!sessionAction) { setShowSessionModal(false); setSelectedSession(null) } }}
        onSaveAttendance={async (payload) => {
          setSessionAction('attendance')
          const updated = await saveTeacherSessionAttendance(selectedSession.id, payload)
          setSelectedSession(updated)
          setSessions(await getTeacherClassSessions(classId))
          setSuccess('Đã lưu điểm danh buổi học.')
          setSessionAction('')
          return updated
        }}
        onSaveReport={async (payload) => {
          setSessionAction('report')
          const updated = await saveTeacherSessionReport(selectedSession.id, payload)
          setSelectedSession(updated)
          setSessions(await getTeacherClassSessions(classId))
          setSuccess('Đã lưu tạm báo cáo buổi học.')
          setSessionAction('')
          return updated
        }}
        onComplete={async (payload) => {
          setSessionAction('complete')
          const updated = await completeTeacherSession(selectedSession.id, payload)
          setSelectedSession(updated)
          setSessions(await getTeacherClassSessions(classId))
          setSuccess('Đã hoàn thành buổi học.')
          setSessionAction('')
          return updated
        }}
        onFieldSave={async (_field, payload) => {
          setSessionAction('content-editor')
          const updated = await saveTeacherSessionReport(selectedSession.id, payload)
          setSelectedSession(updated)
          setSessions(await getTeacherClassSessions(classId))
          setSuccess('Đã cập nhật nội dung buổi học.')
          setSessionAction('')
          return updated
        }}
      />
    </div>
  )
}