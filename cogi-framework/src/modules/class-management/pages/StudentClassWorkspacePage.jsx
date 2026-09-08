import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { CAlert, CBadge, CButton, CCard, CCardBody, CCardHeader, CSpinner, CTable, CTableBody, CTableDataCell, CTableHead, CTableHeaderCell, CTableRow } from '@coreui/react'
import StudentPortalContextCard from '../components/StudentPortalContextCard'
import { getStudentClasses } from '../services/classService'
import useStudentPortalContext from '../utils/useStudentPortalContext'
import { formatSessionDate, formatSessionTime, formatTeacherDisplay } from '../utils/classSessionUi'

function getApiMessage(error, fallback) {
  return error?.response?.data?.error?.message || error?.response?.data?.message || error?.message || fallback
}

export default function StudentClassWorkspacePage() {
  const navigate = useNavigate()
  const portal = useStudentPortalContext()
  const [loading, setLoading] = useState(false)
  const [rows, setRows] = useState([])
  const [error, setError] = useState('')

  useEffect(() => {
    if (!portal.context || !portal.selectedLearnerId) {
      setRows([])
      return
    }

    let active = true
    async function load() {
      setLoading(true)
      setError('')
      try {
        const result = await getStudentClasses({ learnerId: portal.selectedLearnerId })
        if (!active) return
        setRows(Array.isArray(result?.rows) ? result.rows : [])
      } catch (requestError) {
        if (!active) return
        setRows([])
        setError(getApiMessage(requestError, 'Không thể tải lớp học của learner.'))
      } finally {
        if (active) setLoading(false)
      }
    }

    load()
    return () => {
      active = false
    }
  }, [portal.context, portal.selectedLearnerId])

  const activeCount = useMemo(() => rows.filter((item) => item?.enrollmentContext?.isCurrent).length, [rows])

  return (
    <div className='container-fluid py-4'>
      <StudentPortalContextCard
        title='Lớp của tôi'
        description='Chỉ hiển thị các lớp mà hồ sơ học tập đang chọn có enrollment phù hợp trong tenant hiện tại.'
        context={portal.context}
        selectedLearnerId={portal.selectedLearnerId}
        onSelectLearner={portal.setSelectedLearnerId}
        error={portal.error}
      />

      {error ? <CAlert color='danger'>{error}</CAlert> : null}

      <CCard>
        <CCardHeader className='d-flex justify-content-between align-items-center gap-2 flex-wrap'>
          <div><strong>Danh sách lớp</strong> <CBadge color='secondary' className='ms-2'>{rows.length}</CBadge></div>
          <div className='small text-body-secondary'>Đang học: {activeCount}</div>
        </CCardHeader>
        <CCardBody>
          {portal.loading || loading ? (
            <div className='d-flex align-items-center gap-2'><CSpinner size='sm' /><span>Đang tải dữ liệu...</span></div>
          ) : (
            <CTable hover responsive>
              <CTableHead>
                <CTableRow>
                  <CTableHeaderCell>Lớp</CTableHeaderCell>
                  <CTableHeaderCell>Môn học</CTableHeaderCell>
                  <CTableHeaderCell>Trạng thái enrollment</CTableHeaderCell>
                  <CTableHeaderCell>Giáo viên chính</CTableHeaderCell>
                  <CTableHeaderCell>Ngày tham gia</CTableHeaderCell>
                  <CTableHeaderCell>Buổi học tiếp theo</CTableHeaderCell>
                  <CTableHeaderCell>Hành động</CTableHeaderCell>
                </CTableRow>
              </CTableHead>
              <CTableBody>
                {rows.length === 0 ? (
                  <CTableRow><CTableDataCell colSpan={7} className='text-center text-body-secondary'>Hồ sơ hiện tại chưa có lớp nào.</CTableDataCell></CTableRow>
                ) : rows.map((item) => (
                  <CTableRow key={item.id}>
                    <CTableDataCell>
                      <div className='fw-semibold'>{item.name || '-'}</div>
                      <div className='small text-body-secondary'>{item.subjectCode || '-'}</div>
                    </CTableDataCell>
                    <CTableDataCell>{item.subject || '-'}</CTableDataCell>
                    <CTableDataCell>{item?.enrollmentContext?.isCurrent ? 'Đang học' : 'Đã kết thúc'}</CTableDataCell>
                    <CTableDataCell>{formatTeacherDisplay(item.mainTeacher)}</CTableDataCell>
                    <CTableDataCell>{formatSessionDate(item?.enrollmentContext?.joinDate)}</CTableDataCell>
                    <CTableDataCell>{item.nextSession ? `${formatSessionDate(item.nextSession.sessionDate)} · ${formatSessionTime(item.nextSession.startTime)}-${formatSessionTime(item.nextSession.endTime)}` : '—'}</CTableDataCell>
                    <CTableDataCell><CButton size='sm' color='primary' variant='outline' onClick={() => navigate(`/student/classes/${item.id}`)}>Mở lớp</CButton></CTableDataCell>
                  </CTableRow>
                ))}
              </CTableBody>
            </CTable>
          )}
        </CCardBody>
      </CCard>
    </div>
  )
}