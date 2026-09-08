import { useEffect, useMemo, useState } from 'react'
import { CAlert, CBadge, CButton, CCard, CCardBody, CCardHeader, CCol, CFormInput, CFormLabel, CFormSelect, CRow, CSpinner, CTable, CTableBody, CTableDataCell, CTableHead, CTableHeaderCell, CTableRow } from '@coreui/react'
import { completeTeacherSession, getTeacherClasses, getTeacherSessionDetail, getTeacherSessions, saveTeacherSessionAttendance, saveTeacherSessionReport } from '../services/classService'
import ClassSessionDetailModal from '../components/ClassSessionDetailModal'
import { formatSessionDate, formatSessionTime, formatTeacherDisplay, getClassSessionStatusMeta, getSessionDisplayStatus } from '../utils/classSessionUi'

const STATUS_FILTER_OPTIONS = [
  { value: '', label: 'Tất cả' },
  { value: 'scheduled', label: 'Đã lên lịch' },
  { value: 'in_progress', label: 'Đang diễn ra' },
  { value: 'completed', label: 'Hoàn thành' },
  { value: 'cancelled', label: 'Đã hủy' },
  { value: 'pending_report', label: 'Chưa hoàn thành báo cáo' },
]

function getApiMessage(error, fallback) {
  return error?.response?.data?.error?.message || error?.response?.data?.message || error?.message || fallback
}

function splitSessionGroups(rows = []) {
  return {
    today: rows.filter((item) => item?.timing?.isToday),
    upcoming: rows.filter((item) => item?.timing?.isUpcoming && !item?.timing?.isToday),
    pendingReport: rows.filter((item) => item?.timing?.needsReport),
    completed: rows.filter((item) => item?.status === 'completed'),
  }
}

function SessionSection({ title, rows, onOpen }) {
  return (
    <CCard className='border-0 shadow-sm mb-4'>
      <CCardHeader className='d-flex justify-content-between align-items-center'><strong>{title}</strong><CBadge color='secondary'>{rows.length}</CBadge></CCardHeader>
      <CCardBody>
        <CTable hover responsive>
          <CTableHead>
            <CTableRow>
              <CTableHeaderCell>Lớp</CTableHeaderCell>
              <CTableHeaderCell>Ngày</CTableHeaderCell>
              <CTableHeaderCell>Giờ</CTableHeaderCell>
              <CTableHeaderCell>Giáo viên</CTableHeaderCell>
              <CTableHeaderCell>Trạng thái</CTableHeaderCell>
              <CTableHeaderCell>Điểm danh</CTableHeaderCell>
              <CTableHeaderCell>Báo cáo</CTableHeaderCell>
              <CTableHeaderCell>Hành động</CTableHeaderCell>
            </CTableRow>
          </CTableHead>
          <CTableBody>
            {rows.length === 0 ? (
              <CTableRow><CTableDataCell colSpan={8} className='text-center text-body-secondary'>Không có buổi học.</CTableDataCell></CTableRow>
            ) : rows.map((item) => {
              const statusMeta = getClassSessionStatusMeta(item.status)
              const actionLabel = item?.permissions?.canMarkAttendance || item?.permissions?.canEditReport ? 'Mở buổi học' : 'Xem'
              return (
                <CTableRow key={item.id}>
                  <CTableDataCell>
                    <div className='fw-semibold'>{item?.class?.name || '-'}</div>
                    <div className='small text-body-secondary'>{item?.class?.subjectCode || '-'}</div>
                  </CTableDataCell>
                  <CTableDataCell>{formatSessionDate(item.sessionDate)}</CTableDataCell>
                  <CTableDataCell>{formatSessionTime(item.startTime)}-{formatSessionTime(item.endTime)}</CTableDataCell>
                  <CTableDataCell>{formatTeacherDisplay(item.teacher)}</CTableDataCell>
                  <CTableDataCell><CBadge color={statusMeta.color}>{statusMeta.label}</CBadge></CTableDataCell>
                  <CTableDataCell>{item?.attendanceSummary?.label || '—'}</CTableDataCell>
                  <CTableDataCell>{getSessionDisplayStatus(item)}</CTableDataCell>
                  <CTableDataCell><CButton size='sm' color='primary' variant='outline' onClick={() => onOpen(item)}>{actionLabel}</CButton></CTableDataCell>
                </CTableRow>
              )
            })}
          </CTableBody>
        </CTable>
      </CCardBody>
    </CCard>
  )
}

export default function TeacherSessionWorkspacePage() {
  const [loading, setLoading] = useState(false)
  const [rows, setRows] = useState([])
  const [classes, setClasses] = useState([])
  const [filters, setFilters] = useState({ fromDate: '', toDate: '', classId: '', status: '' })
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [selectedSession, setSelectedSession] = useState(null)
  const [selectedSessionLoading, setSelectedSessionLoading] = useState(false)
  const [showSessionModal, setShowSessionModal] = useState(false)
  const [sessionAction, setSessionAction] = useState('')

  const groups = useMemo(() => splitSessionGroups(rows), [rows])

  async function load() {
    setLoading(true)
    setError('')
    try {
      const [teacherClasses, teacherSessions] = await Promise.all([
        getTeacherClasses(),
        getTeacherSessions(filters),
      ])
      setClasses(Array.isArray(teacherClasses) ? teacherClasses : [])
      setRows(Array.isArray(teacherSessions) ? teacherSessions : [])
    } catch (requestError) {
      setError(getApiMessage(requestError, 'Không thể tải buổi học giảng dạy.'))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [filters.fromDate, filters.toDate, filters.classId, filters.status])

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

  return (
    <div className='container-fluid py-4'>
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

      {success ? <CAlert color='success'>{success}</CAlert> : null}
      {error ? <CAlert color='danger'>{error}</CAlert> : null}

      {loading ? (
        <div className='text-center py-5'><CSpinner color='primary' /></div>
      ) : (
        <>
          <SessionSection title='Hôm nay' rows={groups.today} onOpen={openSession} />
          <SessionSection title='Sắp tới' rows={groups.upcoming} onOpen={openSession} />
          <SessionSection title='Cần hoàn thành báo cáo' rows={groups.pendingReport} onOpen={openSession} />
          <SessionSection title='Đã hoàn thành' rows={groups.completed} onOpen={openSession} />
        </>
      )}

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
          setRows(await getTeacherSessions(filters))
          setSuccess('Đã lưu điểm danh buổi học.')
          setSessionAction('')
          return updated
        }}
        onSaveReport={async (payload) => {
          setSessionAction('report')
          const updated = await saveTeacherSessionReport(selectedSession.id, payload)
          setSelectedSession(updated)
          setRows(await getTeacherSessions(filters))
          setSuccess('Đã lưu tạm báo cáo buổi học.')
          setSessionAction('')
          return updated
        }}
        onComplete={async (payload) => {
          setSessionAction('complete')
          const updated = await completeTeacherSession(selectedSession.id, payload)
          setSelectedSession(updated)
          setRows(await getTeacherSessions(filters))
          setSuccess('Đã hoàn thành buổi học.')
          setSessionAction('')
          return updated
        }}
        onFieldSave={async (_field, payload) => {
          setSessionAction('content-editor')
          const updated = await saveTeacherSessionReport(selectedSession.id, payload)
          setSelectedSession(updated)
          setRows(await getTeacherSessions(filters))
          setSuccess('Đã cập nhật nội dung buổi học.')
          setSessionAction('')
          return updated
        }}
      />
    </div>
  )
}