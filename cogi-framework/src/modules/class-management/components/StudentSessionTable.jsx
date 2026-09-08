import { CBadge, CButton, CCard, CCardBody, CCardHeader, CTable, CTableBody, CTableDataCell, CTableHead, CTableHeaderCell, CTableRow } from '@coreui/react'
import { CLASS_SESSION_ATTENDANCE_OPTIONS, formatSessionDate, formatSessionTime, formatTeacherDisplay, getClassSessionStatusMeta } from '../utils/classSessionUi'

function getAttendanceLabel(status) {
  return CLASS_SESSION_ATTENDANCE_OPTIONS.find((item) => item.value === status)?.label || 'Chưa có điểm danh'
}

export default function StudentSessionTable({ title, rows = [], onOpen, emptyMessage = 'Không có buổi học.' }) {
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
              <CTableHeaderCell>Điểm danh của tôi</CTableHeaderCell>
              <CTableHeaderCell>Hành động</CTableHeaderCell>
            </CTableRow>
          </CTableHead>
          <CTableBody>
            {rows.length === 0 ? (
              <CTableRow><CTableDataCell colSpan={7} className='text-center text-body-secondary'>{emptyMessage}</CTableDataCell></CTableRow>
            ) : rows.map((item) => {
              const statusMeta = getClassSessionStatusMeta(item.status)
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
                  <CTableDataCell>{item?.myAttendance?.status ? getAttendanceLabel(item.myAttendance.status) : 'Chưa có điểm danh'}</CTableDataCell>
                  <CTableDataCell><CButton size='sm' color='primary' variant='outline' onClick={() => onOpen?.(item)}>Xem</CButton></CTableDataCell>
                </CTableRow>
              )
            })}
          </CTableBody>
        </CTable>
      </CCardBody>
    </CCard>
  )
}