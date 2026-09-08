import { useEffect, useState } from 'react'
import {
  CButton,
  CCard,
  CCardBody,
  CCardHeader,
  CCol,
  CFormInput,
  CFormSelect,
  CModal,
  CModalBody,
  CModalFooter,
  CModalHeader,
  CModalTitle,
  CRow,
  CSpinner,
  CTable,
  CTableBody,
  CTableDataCell,
  CTableHead,
  CTableHeaderCell,
  CTableRow,
  CAlert,
  CBadge,
} from '@coreui/react'
import ClassSessionContentEditorModal from './ClassSessionContentEditorModal'
import TeacherSessionAssignmentsPanel from './TeacherSessionAssignmentsPanel'
import { getClassSessionContentPreview, hasClassSessionContent } from '../utils/classSessionContentHtml'
import {
  buildAttendanceDraft,
  buildReportDraft,
  CLASS_SESSION_ATTENDANCE_OPTIONS,
  CLASS_SESSION_CONTENT_FIELDS,
  formatSessionDate,
  formatSessionDateTime,
  formatSessionTime,
  formatTeacherDisplay,
  getClassSessionStatusMeta,
} from '../utils/classSessionUi'

function getApiMessage(error, fallback) {
  return error?.response?.data?.error?.message || error?.response?.data?.message || error?.message || fallback
}

export default function ClassSessionDetailModal({
  visible = false,
  title = 'Chi tiết buổi học',
  loading = false,
  sessionDetail = null,
  saveStatus = '',
  loadError = '',
  onClose,
  onSaveAttendance,
  onSaveReport,
  onComplete,
  onFieldSave,
}) {
  const [error, setError] = useState('')
  const [reportDraft, setReportDraft] = useState(buildReportDraft(null))
  const [attendanceDraft, setAttendanceDraft] = useState([])
  const [contentEditorState, setContentEditorState] = useState({ open: false, field: '', title: '' })

  useEffect(() => {
    setReportDraft(buildReportDraft(sessionDetail))
    setAttendanceDraft(buildAttendanceDraft(sessionDetail))
    setError('')
  }, [sessionDetail, visible])

  function closeContentEditor() {
    if (saveStatus) return
    setContentEditorState({ open: false, field: '', title: '' })
  }

  function openContentEditor(field, fieldTitle) {
    setContentEditorState({ open: true, field, title: fieldTitle })
  }

  function setAttendanceForAll(status) {
    setAttendanceDraft((prev) => prev.map((item) => ({ ...item, status })))
  }

  async function handleSaveAttendance() {
    setError('')
    try {
      await onSaveAttendance?.({
        items: attendanceDraft.map((item) => ({
          learner: item.learnerId,
          status: item.status || 'present',
          note: item.note || null,
        })),
      })
    } catch (requestError) {
      setError(getApiMessage(requestError, 'Không thể lưu điểm danh.'))
    }
  }

  async function handleSaveReport() {
    setError('')
    try {
      await onSaveReport?.(reportDraft)
    } catch (requestError) {
      setError(getApiMessage(requestError, 'Không thể lưu báo cáo buổi học.'))
    }
  }

  async function handleComplete() {
    setError('')
    try {
      await onComplete?.(reportDraft)
    } catch (requestError) {
      setError(getApiMessage(requestError, 'Không thể hoàn thành buổi học.'))
    }
  }

  async function handleSaveContentField(nextValue) {
    if (!contentEditorState.field) return
    const nextDraft = {
      ...reportDraft,
      [contentEditorState.field]: nextValue,
    }
    setError('')
    try {
      await onFieldSave?.(contentEditorState.field, nextDraft)
      closeContentEditor()
    } catch (requestError) {
      setError(getApiMessage(requestError, 'Không thể lưu nội dung báo cáo.'))
    }
  }

  return (
    <>
      <CModal visible={visible} onClose={() => !saveStatus && onClose?.()} size='xl'>
        <CModalHeader>
          <CModalTitle>{title}</CModalTitle>
        </CModalHeader>
        <CModalBody>
          {loadError ? <CAlert color='danger'>{loadError}</CAlert> : null}
          {error ? <CAlert color='danger'>{error}</CAlert> : null}
          {!loading && sessionDetail?.accessMode === 'read_only' && sessionDetail?.accessReason ? <CAlert color='info'>{sessionDetail.accessReason}</CAlert> : null}
          {loading ? (
            <div className='text-center py-4'>
              <CSpinner color='primary' />
            </div>
          ) : sessionDetail ? (
            <CRow className='g-4'>
              <CCol lg={4}>
                <CCard className='border-0 shadow-sm h-100'>
                  <CCardHeader><strong>Thông tin buổi học</strong></CCardHeader>
                  <CCardBody>
                    <div className='mb-3'><strong>Lớp:</strong> {sessionDetail?.class?.name || '-'}</div>
                    <div className='mb-3'><strong>Ngày:</strong> {formatSessionDate(sessionDetail?.sessionDate)}</div>
                    <div className='mb-3'><strong>Giờ:</strong> {formatSessionTime(sessionDetail?.startTime)}-{formatSessionTime(sessionDetail?.endTime)}</div>
                    <div className='mb-3'><strong>Giáo viên:</strong> {formatTeacherDisplay(sessionDetail?.teacher)}</div>
                    <div className='mb-3'><strong>Trạng thái:</strong> <CBadge color={getClassSessionStatusMeta(sessionDetail?.status).color}>{getClassSessionStatusMeta(sessionDetail?.status).label}</CBadge></div>
                    <div className='mb-3'><strong>Điểm danh:</strong> {sessionDetail?.attendanceSummary?.label || '—'}</div>
                    <div className='mb-3'><strong>Báo cáo:</strong> {sessionDetail?.reportSummary?.isCompleted ? 'Đã hoàn thành' : sessionDetail?.reportSummary?.hasReport ? 'Đã lưu tạm' : 'Chưa có'}</div>
                    {sessionDetail?.completedAt ? <div className='mb-3'><strong>Hoàn thành lúc:</strong> {formatSessionDateTime(sessionDetail.completedAt)}</div> : null}
                    {sessionDetail?.completedBy ? <div className='mb-3'><strong>Người hoàn thành:</strong> {formatTeacherDisplay(sessionDetail.completedBy)}</div> : null}
                    {sessionDetail?.cancelReason ? <div><strong>Lý do hủy:</strong> {sessionDetail.cancelReason}</div> : null}
                  </CCardBody>
                </CCard>
              </CCol>
              <CCol lg={8}>
                <CCard className='border-0 shadow-sm mb-4'>
                  <CCardHeader className='d-flex justify-content-between align-items-center flex-wrap gap-2'>
                    <strong>Điểm danh</strong>
                    <div className='d-flex gap-2'>
                      <CButton size='sm' color='secondary' variant='outline' onClick={() => setAttendanceForAll('present')} disabled={sessionDetail?.permissions?.canMarkAttendance !== true}>Đặt tất cả có mặt</CButton>
                      <CButton size='sm' color='primary' onClick={handleSaveAttendance} disabled={sessionDetail?.permissions?.canMarkAttendance !== true || saveStatus === 'attendance'}>{saveStatus === 'attendance' ? 'Đang lưu...' : 'Lưu điểm danh'}</CButton>
                    </div>
                  </CCardHeader>
                  <CCardBody>
                    <CTable small responsive>
                      <CTableHead>
                        <CTableRow>
                          <CTableHeaderCell>Học viên</CTableHeaderCell>
                          <CTableHeaderCell>Trạng thái</CTableHeaderCell>
                          <CTableHeaderCell>Ghi chú</CTableHeaderCell>
                        </CTableRow>
                      </CTableHead>
                      <CTableBody>
                        {attendanceDraft.map((item) => (
                          <CTableRow key={item.learnerId}>
                            <CTableDataCell>
                              <div>{item?.learner?.fullName || item?.learner?.code || `#${item.learnerId}`}</div>
                              <div className='small text-body-secondary'>
                                {item?.learner?.code || '-'}
                                {item.historicalOnly ? ' · Lịch sử' : ''}
                              </div>
                            </CTableDataCell>
                            <CTableDataCell>
                              <CFormSelect value={item.status} disabled={sessionDetail?.permissions?.canMarkAttendance !== true} onChange={(event) => setAttendanceDraft((prev) => prev.map((row) => row.learnerId === item.learnerId ? { ...row, status: event.target.value } : row))}>
                                {CLASS_SESSION_ATTENDANCE_OPTIONS.map((option) => (
                                  <option key={option.value} value={option.value}>{option.label}</option>
                                ))}
                              </CFormSelect>
                            </CTableDataCell>
                            <CTableDataCell>
                              <CFormInput value={item.note} disabled={sessionDetail?.permissions?.canMarkAttendance !== true} onChange={(event) => setAttendanceDraft((prev) => prev.map((row) => row.learnerId === item.learnerId ? { ...row, note: event.target.value } : row))} placeholder='Ghi chú riêng cho học viên' />
                            </CTableDataCell>
                          </CTableRow>
                        ))}
                      </CTableBody>
                    </CTable>
                  </CCardBody>
                </CCard>

                <CCard className='border-0 shadow-sm'>
                  <CCardHeader><strong>Báo cáo buổi học</strong></CCardHeader>
                  <CCardBody>
                    <CRow className='g-3'>
                      {CLASS_SESSION_CONTENT_FIELDS.map((field) => {
                        const value = reportDraft?.[field.key] || ''
                        const hasContent = hasClassSessionContent(value)
                        return (
                          <CCol md={12} key={field.key}>
                            <div className='border rounded-3 p-3 bg-body-tertiary'>
                              <div className='d-flex justify-content-between align-items-start gap-3 flex-wrap mb-2'>
                                <div>
                                  <div className='fw-semibold'>{field.title}</div>
                                  <div className='small text-body-secondary'>{hasContent ? 'Đã có nội dung' : 'Chưa có nội dung'}</div>
                                </div>
                                <CButton color='secondary' variant='outline' size='sm' disabled={sessionDetail?.permissions?.canEditReport !== true} onClick={() => openContentEditor(field.key, field.title)}>
                                  {hasContent ? 'Chỉnh sửa' : 'Soạn'}
                                </CButton>
                              </div>
                              <div className={`small ${hasContent ? 'text-body' : 'text-body-secondary'}`} style={{ whiteSpace: 'normal', display: '-webkit-box', WebkitBoxOrient: 'vertical', WebkitLineClamp: 3, overflow: 'hidden', lineHeight: 1.55, minHeight: '4.6em' }}>
                                {getClassSessionContentPreview(value, 220)}
                              </div>
                            </div>
                          </CCol>
                        )
                      })}
                    </CRow>
                  </CCardBody>
                  <CModalFooter>
                    <CButton color='secondary' variant='outline' onClick={handleSaveReport} disabled={sessionDetail?.permissions?.canEditReport !== true || saveStatus === 'report'}>{saveStatus === 'report' ? 'Đang lưu...' : 'Lưu tạm'}</CButton>
                    <CButton color='success' onClick={handleComplete} disabled={sessionDetail?.permissions?.canComplete !== true || saveStatus === 'complete'}>{saveStatus === 'complete' ? 'Đang hoàn thành...' : 'Hoàn thành buổi học'}</CButton>
                  </CModalFooter>
                </CCard>

                <TeacherSessionAssignmentsPanel
                  sessionId={sessionDetail?.id}
                  canManage={sessionDetail?.permissions?.canEditReport === true || sessionDetail?.permissions?.canComplete === true}
                />
              </CCol>
            </CRow>
          ) : (
            <div className='text-body-secondary'>Không có dữ liệu buổi học.</div>
          )}
        </CModalBody>
        <CModalFooter>
          <CButton color='secondary' variant='outline' onClick={() => onClose?.()} disabled={Boolean(saveStatus)}>Đóng</CButton>
        </CModalFooter>
      </CModal>

      <ClassSessionContentEditorModal
        visible={contentEditorState.open}
        saving={saveStatus === 'content-editor'}
        title={contentEditorState.title || 'Soạn nội dung'}
        value={reportDraft?.[contentEditorState.field] || ''}
        onClose={closeContentEditor}
        onSave={handleSaveContentField}
      />
    </>
  )
}