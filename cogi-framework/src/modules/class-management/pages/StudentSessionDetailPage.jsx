import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { CAlert, CBadge, CButton, CCard, CCardBody, CCardHeader, CCol, CRow, CSpinner } from '@coreui/react'
import StudentPortalContextCard from '../components/StudentPortalContextCard'
import StudentSessionAssignmentsPanel from '../components/StudentSessionAssignmentsPanel'
import { getStudentSessionDetail } from '../services/classService'
import useStudentPortalContext from '../utils/useStudentPortalContext'
import { sanitizeClassSessionContentHtml } from '../utils/classSessionContentHtml'
import { CLASS_SESSION_ATTENDANCE_OPTIONS, formatSessionDate, formatSessionDateTime, formatSessionTime, formatTeacherDisplay, getClassSessionStatusMeta } from '../utils/classSessionUi'

function getApiMessage(error, fallback) {
  return error?.response?.data?.error?.message || error?.response?.data?.message || error?.message || fallback
}

function getAttendanceLabel(status) {
  return CLASS_SESSION_ATTENDANCE_OPTIONS.find((item) => item.value === status)?.label || 'Chưa có điểm danh'
}

function HtmlBlock({ title, value, emptyLabel }) {
  const html = sanitizeClassSessionContentHtml(value || '')
  return (
    <CCard className='border-0 shadow-sm mb-4'>
      <CCardHeader><strong>{title}</strong></CCardHeader>
      <CCardBody>
        {html ? <div dangerouslySetInnerHTML={{ __html: html }} /> : <div className='text-body-secondary'>{emptyLabel}</div>}
      </CCardBody>
    </CCard>
  )
}

export default function StudentSessionDetailPage() {
  const navigate = useNavigate()
  const { sessionId } = useParams()
  const portal = useStudentPortalContext()
  const [loading, setLoading] = useState(false)
  const [detail, setDetail] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!portal.context || !portal.selectedLearnerId || !sessionId) {
      setDetail(null)
      return
    }

    let active = true
    async function load() {
      setLoading(true)
      setError('')
      try {
        const result = await getStudentSessionDetail(sessionId, { learnerId: portal.selectedLearnerId })
        if (!active) return
        setDetail(result?.detail || null)
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
  }, [portal.context, portal.selectedLearnerId, sessionId])

  return (
    <div className='container-fluid py-4'>
      <StudentPortalContextCard
        title='Chi tiết buổi học của tôi'
        description='Trang này chỉ hiển thị dữ liệu của learner context hiện tại và attendance của chính learner đó.'
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
          <CCard className='border-0 shadow-sm mb-4'>
            <CCardHeader className='d-flex justify-content-between align-items-center gap-2 flex-wrap'>
              <strong>Thông tin buổi học</strong>
              <CButton color='secondary' variant='outline' size='sm' onClick={() => navigate('/student/sessions')}>Quay lại danh sách buổi học</CButton>
            </CCardHeader>
            <CCardBody>
              <CRow className='g-3'>
                <CCol md={6}><strong>Lớp:</strong> {detail?.class?.name || '-'}</CCol>
                <CCol md={6}><strong>Môn học:</strong> {detail?.class?.subject || '-'} ({detail?.class?.subjectCode || '-'})</CCol>
                <CCol md={6}><strong>Ngày:</strong> {formatSessionDate(detail?.sessionDate)}</CCol>
                <CCol md={6}><strong>Giờ:</strong> {formatSessionTime(detail?.startTime)}-{formatSessionTime(detail?.endTime)}</CCol>
                <CCol md={6}><strong>Giáo viên:</strong> {formatTeacherDisplay(detail?.teacher)}</CCol>
                <CCol md={6}><strong>Trạng thái:</strong> <CBadge color={getClassSessionStatusMeta(detail?.status).color}>{getClassSessionStatusMeta(detail?.status).label}</CBadge></CCol>
                {detail?.completedAt ? <CCol md={6}><strong>Hoàn thành lúc:</strong> {formatSessionDateTime(detail.completedAt)}</CCol> : null}
                {detail?.cancelReason ? <CCol md={6}><strong>Lý do hủy:</strong> {detail.cancelReason}</CCol> : null}
              </CRow>
            </CCardBody>
          </CCard>

          <CCard className='border-0 shadow-sm mb-4'>
            <CCardHeader><strong>Tình trạng tham gia của tôi</strong></CCardHeader>
            <CCardBody>
              <div><strong>Điểm danh:</strong> {detail?.myAttendance?.status ? getAttendanceLabel(detail.myAttendance.status) : 'Chưa có điểm danh'}</div>
              <div className='mt-2'><strong>Ghi chú:</strong> {detail?.myAttendance?.note || 'Không có ghi chú'}</div>
              {detail?.myAttendance?.markedAt ? <div className='mt-2 small text-body-secondary'>Cập nhật lúc {formatSessionDateTime(detail.myAttendance.markedAt)}</div> : null}
            </CCardBody>
          </CCard>

          <StudentSessionAssignmentsPanel sessionId={detail?.id} learnerId={portal.selectedLearnerId} />

          <HtmlBlock title='Nội dung đã học' value={detail?.lessonContent} emptyLabel='Buổi học này chưa có nội dung đã học.' />
          <HtmlBlock title='Bài tập về nhà' value={detail?.homework} emptyLabel='Buổi học này chưa có bài tập về nhà.' />
          <HtmlBlock title='Nhận xét chung' value={detail?.teacherComment} emptyLabel='Buổi học này chưa có nhận xét chung.' />
        </>
      ) : null}
    </div>
  )
}