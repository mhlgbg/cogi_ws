import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { CAlert, CCard, CCardBody, CCardHeader, CCol, CFormInput, CFormLabel, CFormSelect, CRow, CSpinner } from '@coreui/react'
import StudentPortalContextCard from '../components/StudentPortalContextCard'
import StudentSessionTable from '../components/StudentSessionTable'
import { getStudentClasses, getStudentSessions } from '../services/classService'
import useStudentPortalContext from '../utils/useStudentPortalContext'

const STATUS_FILTER_OPTIONS = [
  { value: '', label: 'Tất cả' },
  { value: 'scheduled', label: 'Đã lên lịch' },
  { value: 'in_progress', label: 'Đang diễn ra' },
  { value: 'completed', label: 'Hoàn thành' },
  { value: 'cancelled', label: 'Đã hủy' },
]

function getApiMessage(error, fallback) {
  return error?.response?.data?.error?.message || error?.response?.data?.message || error?.message || fallback
}

function splitSessionGroups(rows = []) {
  const cancelled = rows.filter((item) => item?.status === 'cancelled')
  const today = rows.filter((item) => item?.status !== 'cancelled' && item?.timing?.isToday)
  const upcoming = rows.filter((item) => item?.status !== 'cancelled' && !item?.timing?.isToday && item?.timing?.isUpcoming)
  const completed = rows.filter((item) => !today.some((todayItem) => todayItem.id === item.id) && !upcoming.some((upcomingItem) => upcomingItem.id === item.id) && item?.status !== 'cancelled')
  return { today, upcoming, completed, cancelled }
}

export default function StudentSessionWorkspacePage() {
  const navigate = useNavigate()
  const portal = useStudentPortalContext()
  const [loading, setLoading] = useState(false)
  const [rows, setRows] = useState([])
  const [classes, setClasses] = useState([])
  const [filters, setFilters] = useState({ fromDate: '', toDate: '', classId: '', status: '' })
  const [error, setError] = useState('')

  const groups = useMemo(() => splitSessionGroups(rows), [rows])

  useEffect(() => {
    if (!portal.context || !portal.selectedLearnerId) {
      setRows([])
      setClasses([])
      return
    }

    let active = true
    async function load() {
      setLoading(true)
      setError('')
      try {
        const [classResult, sessionResult] = await Promise.all([
          getStudentClasses({ learnerId: portal.selectedLearnerId }),
          getStudentSessions({ learnerId: portal.selectedLearnerId, ...filters }),
        ])
        if (!active) return
        setClasses(Array.isArray(classResult?.rows) ? classResult.rows : [])
        setRows(Array.isArray(sessionResult?.rows) ? sessionResult.rows : [])
      } catch (requestError) {
        if (!active) return
        setClasses([])
        setRows([])
        setError(getApiMessage(requestError, 'Không thể tải buổi học của learner.'))
      } finally {
        if (active) setLoading(false)
      }
    }

    load()
    return () => {
      active = false
    }
  }, [filters.classId, filters.fromDate, filters.status, filters.toDate, portal.context, portal.selectedLearnerId])

  return (
    <div className='container-fluid py-4'>
      <StudentPortalContextCard
        title='Buổi học của tôi'
        description='Danh sách buổi học được xác định từ enrollment history của hồ sơ học tập đang chọn.'
        context={portal.context}
        selectedLearnerId={portal.selectedLearnerId}
        onSelectLearner={portal.setSelectedLearnerId}
        error={portal.error}
      />

      <CCard className='mb-4'>
        <CCardHeader><strong>Bộ lọc buổi học</strong></CCardHeader>
        <CCardBody>
          <CRow className='g-3'>
            <CCol md={3}><CFormLabel>Từ ngày</CFormLabel><CFormInput type='date' value={filters.fromDate} onChange={(event) => setFilters((prev) => ({ ...prev, fromDate: event.target.value }))} /></CCol>
            <CCol md={3}><CFormLabel>Đến ngày</CFormLabel><CFormInput type='date' value={filters.toDate} onChange={(event) => setFilters((prev) => ({ ...prev, toDate: event.target.value }))} /></CCol>
            <CCol md={3}><CFormLabel>Lớp</CFormLabel><CFormSelect value={filters.classId} onChange={(event) => setFilters((prev) => ({ ...prev, classId: event.target.value }))}><option value=''>Tất cả lớp</option>{classes.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</CFormSelect></CCol>
            <CCol md={3}><CFormLabel>Trạng thái</CFormLabel><CFormSelect value={filters.status} onChange={(event) => setFilters((prev) => ({ ...prev, status: event.target.value }))}>{STATUS_FILTER_OPTIONS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</CFormSelect></CCol>
          </CRow>
        </CCardBody>
      </CCard>

      {error ? <CAlert color='danger'>{error}</CAlert> : null}

      {portal.loading || loading ? (
        <div className='text-center py-5'><CSpinner color='primary' /></div>
      ) : (
        <>
          <StudentSessionTable title='Hôm nay' rows={groups.today} onOpen={(item) => navigate(`/student/sessions/${item.id}`)} emptyMessage='Không có buổi học hôm nay.' />
          <StudentSessionTable title='Sắp tới' rows={groups.upcoming} onOpen={(item) => navigate(`/student/sessions/${item.id}`)} emptyMessage='Không có buổi học sắp tới.' />
          <StudentSessionTable title='Đã học' rows={groups.completed} onOpen={(item) => navigate(`/student/sessions/${item.id}`)} emptyMessage='Chưa có buổi học đã diễn ra.' />
          <StudentSessionTable title='Đã hủy' rows={groups.cancelled} onOpen={(item) => navigate(`/student/sessions/${item.id}`)} emptyMessage='Không có buổi học bị hủy.' />
        </>
      )}
    </div>
  )
}