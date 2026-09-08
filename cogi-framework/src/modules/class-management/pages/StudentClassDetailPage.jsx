import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { CAlert, CButton, CCard, CCardBody, CCardHeader, CCol, CRow, CSpinner } from '@coreui/react'
import StudentPortalContextCard from '../components/StudentPortalContextCard'
import StudentSessionTable from '../components/StudentSessionTable'
import { getStudentClassById, getStudentClassSessions } from '../services/classService'
import useStudentPortalContext from '../utils/useStudentPortalContext'
import { formatSessionDate, formatTeacherDisplay } from '../utils/classSessionUi'

function getApiMessage(error, fallback) {
  return error?.response?.data?.error?.message || error?.response?.data?.message || error?.message || fallback
}

export default function StudentClassDetailPage() {
  const navigate = useNavigate()
  const { classId } = useParams()
  const portal = useStudentPortalContext()
  const [loading, setLoading] = useState(false)
  const [detail, setDetail] = useState(null)
  const [sessions, setSessions] = useState([])
  const [error, setError] = useState('')

  useEffect(() => {
    if (!portal.context || !portal.selectedLearnerId || !classId) {
      setDetail(null)
      setSessions([])
      return
    }

    let active = true
    async function load() {
      setLoading(true)
      setError('')
      try {
        const [detailResult, sessionResult] = await Promise.all([
          getStudentClassById(classId, { learnerId: portal.selectedLearnerId }),
          getStudentClassSessions(classId, { learnerId: portal.selectedLearnerId }),
        ])
        if (!active) return
        setDetail(detailResult?.detail || null)
        setSessions(Array.isArray(sessionResult?.rows) ? sessionResult.rows : [])
      } catch (requestError) {
        if (!active) return
        setDetail(null)
        setSessions([])
        setError(getApiMessage(requestError, 'Không thể tải chi tiết lớp học.'))
      } finally {
        if (active) setLoading(false)
      }
    }

    load()
    return () => {
      active = false
    }
  }, [classId, portal.context, portal.selectedLearnerId])

  return (
    <div className='container-fluid py-4'>
      <StudentPortalContextCard
        title='Chi tiết lớp của tôi'
        description='Thông tin lớp và danh sách buổi học chỉ đọc theo hồ sơ học tập đang chọn.'
        context={portal.context}
        selectedLearnerId={portal.selectedLearnerId}
        onSelectLearner={portal.setSelectedLearnerId}
        error={portal.error}
      />

      {error ? <CAlert color='danger'>{error}</CAlert> : null}

      {portal.loading || loading ? (
        <div className='text-center py-5'><CSpinner color='primary' /></div>
      ) : detail ? (
        <>
          <CCard className='mb-4 border-0 shadow-sm'>
            <CCardHeader className='d-flex justify-content-between align-items-center gap-2 flex-wrap'>
              <strong>Tổng quan lớp học</strong>
              <CButton color='secondary' variant='outline' size='sm' onClick={() => navigate('/student/classes')}>Quay lại danh sách lớp</CButton>
            </CCardHeader>
            <CCardBody>
              <CRow className='g-3'>
                <CCol md={6}><strong>Lớp:</strong> {detail.name || '-'}</CCol>
                <CCol md={6}><strong>Môn học:</strong> {detail.subject || '-'} ({detail.subjectCode || '-'})</CCol>
                <CCol md={6}><strong>Giáo viên chính:</strong> {formatTeacherDisplay(detail.mainTeacher)}</CCol>
                <CCol md={6}><strong>Trạng thái enrollment:</strong> {detail?.enrollmentContext?.isCurrent ? 'Đang học' : 'Đã kết thúc'}</CCol>
                <CCol md={6}><strong>Ngày tham gia:</strong> {formatSessionDate(detail?.enrollmentContext?.joinDate)}</CCol>
                <CCol md={6}><strong>Ngày kết thúc:</strong> {formatSessionDate(detail?.enrollmentContext?.leaveDate)}</CCol>
              </CRow>
            </CCardBody>
          </CCard>

          <StudentSessionTable title='Buổi học của lớp' rows={sessions} onOpen={(item) => navigate(`/student/sessions/${item.id}`)} emptyMessage='Lớp này chưa có buổi học nào phù hợp với hồ sơ hiện tại.' />
        </>
      ) : null}
    </div>
  )
}