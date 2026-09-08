import { useEffect, useMemo, useState } from 'react'
import {
  CAlert,
  CBadge,
  CButton,
  CCard,
  CCardBody,
  CCardHeader,
  CCol,
  CForm,
  CFormCheck,
  CFormInput,
  CFormLabel,
  CFormSelect,
  CFormTextarea,
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
} from '@coreui/react'
import {
  cancelClassSession,
  completeClassSession,
  createClassSession,
  createClassSessionsBulk,
  getClassFormOptions,
  getClassSessionDetail,
  getClassSessions,
  saveClassSessionAttendance,
  updateClassSession,
  updateClassSessionReport,
} from '../services/classService'
import ClassSessionDetailModal from './ClassSessionDetailModal'
import {
  buildAttendanceDraft,
  buildBulkForm,
  buildBulkPreview,
  buildReportDraft,
  buildSessionForm,
  buildSessionFormFromItem,
  CLASS_SESSION_WEEKDAY_OPTIONS,
  formatSessionDate,
  formatSessionTime,
  formatTeacherDisplay,
  getClassSessionStatusMeta,
  getSessionDisplayStatus,
  toText,
} from '../utils/classSessionUi'

function getApiMessage(error, fallback) {
  return error?.response?.data?.error?.message || error?.response?.data?.message || error?.message || fallback
}

export default function ClassSessionsTab({ classId, classDetail, onMessage }) {
  const [loading, setLoading] = useState(true)
  const [rows, setRows] = useState([])
  const [teachers, setTeachers] = useState([])
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState('')
  const [showEditor, setShowEditor] = useState(false)
  const [editorMode, setEditorMode] = useState('create')
  const [editingSession, setEditingSession] = useState(null)
  const [sessionForm, setSessionForm] = useState(buildSessionForm(classDetail))
  const [showBulkModal, setShowBulkModal] = useState(false)
  const [bulkForm, setBulkForm] = useState(buildBulkForm(classDetail))
  const [bulkPreview, setBulkPreview] = useState([])
  const [showDetailModal, setShowDetailModal] = useState(false)
  const [sessionDetail, setSessionDetail] = useState(null)
  const [detailLoading, setDetailLoading] = useState(false)

  const selectedBulkRows = useMemo(() => bulkPreview.filter((item) => item.selected), [bulkPreview])

  async function loadTeachers() {
    const options = await getClassFormOptions()
    setTeachers(Array.isArray(options) ? options : [])
  }

  async function loadSessions() {
    const items = await getClassSessions(classId)
    setRows(Array.isArray(items) ? items : [])
  }

  useEffect(() => {
    let cancelled = false

    async function load() {
      setLoading(true)
      setError('')
      try {
        const [_, __] = await Promise.all([loadSessions(), loadTeachers()])
        void _
        void __
      } catch (requestError) {
        if (!cancelled) setError(getApiMessage(requestError, 'Không thể tải danh sách buổi học.'))
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    load()
    return () => {
      cancelled = true
    }
  }, [classId])

  useEffect(() => {
    setSessionForm((prev) => ({
      ...prev,
      teacher: prev.teacher || String(classDetail?.mainTeacher?.id || ''),
    }))
    setBulkForm((prev) => ({
      ...prev,
      teacher: prev.teacher || String(classDetail?.mainTeacher?.id || ''),
    }))
  }, [classDetail?.mainTeacher?.id])

  function openCreateModal() {
    setEditorMode('create')
    setEditingSession(null)
    setSessionForm(buildSessionForm(classDetail))
    setShowEditor(true)
  }

  function openEditModal(session) {
    setEditorMode('edit')
    setEditingSession(session)
    setSessionForm(buildSessionFormFromItem(session, classDetail))
    setShowEditor(true)
  }

  function closeEditor() {
    if (submitting) return
    setShowEditor(false)
    setEditingSession(null)
    setSessionForm(buildSessionForm(classDetail))
  }

  function closeBulkModal() {
    if (submitting) return
    setShowBulkModal(false)
    setBulkForm(buildBulkForm(classDetail))
    setBulkPreview([])
  }

  async function handleSaveSession() {
    if (!toText(sessionForm.sessionDate) || !toText(sessionForm.startTime) || !toText(sessionForm.endTime) || !toText(sessionForm.teacher)) {
      setError('Bạn cần nhập đủ ngày học, giờ bắt đầu, giờ kết thúc và giáo viên.')
      return
    }

    setSubmitting('session')
    setError('')
    try {
      const payload = {
        sessionDate: sessionForm.sessionDate,
        startTime: sessionForm.startTime,
        endTime: sessionForm.endTime,
        teacher: Number(sessionForm.teacher),
        room: toText(sessionForm.room) || null,
        location: toText(sessionForm.location) || null,
        title: toText(sessionForm.title) || null,
        note: toText(sessionForm.note) || null,
        status: toText(sessionForm.status) || 'scheduled',
      }

      if (editorMode === 'edit' && editingSession?.id) {
        await updateClassSession(classId, editingSession.id, payload)
        onMessage?.({ type: 'success', text: 'Cập nhật buổi học thành công.' })
      } else {
        await createClassSession(classId, payload)
        onMessage?.({ type: 'success', text: 'Tạo buổi học thành công.' })
      }
      closeEditor()
      await loadSessions()
    } catch (requestError) {
      setError(getApiMessage(requestError, 'Không thể lưu buổi học.'))
    } finally {
      setSubmitting('')
    }
  }

  function handleGeneratePreview() {
    const preview = buildBulkPreview(bulkForm)
    setBulkPreview(preview)
    if (preview.length === 0) {
      setError('Không thể sinh preview. Kiểm tra lại ngày học, giờ học và các thứ trong tuần.')
    } else {
      setError('')
    }
  }

  async function handleSaveBulk() {
    if (selectedBulkRows.length === 0) {
      setError('Bạn cần chọn ít nhất một buổi trong preview để tạo.')
      return
    }
    if (!toText(bulkForm.teacher)) {
      setError('Bạn cần chọn giáo viên cho lịch hàng loạt.')
      return
    }

    setSubmitting('bulk')
    setError('')
    try {
      const result = await createClassSessionsBulk(classId, {
        teacher: Number(bulkForm.teacher),
        items: selectedBulkRows.map((item) => ({
          sessionDate: item.sessionDate,
          startTime: item.startTime,
          endTime: item.endTime,
          room: toText(bulkForm.room) || null,
          location: toText(bulkForm.location) || null,
          note: toText(bulkForm.note) || null,
        })),
      })
      onMessage?.({ type: 'success', text: `Tạo lịch hàng loạt xong: ${result?.summary?.createdCount || 0} buổi, bỏ qua ${result?.summary?.skippedCount || 0} buổi trùng.` })
      closeBulkModal()
      await loadSessions()
    } catch (requestError) {
      setError(getApiMessage(requestError, 'Không thể tạo lịch hàng loạt.'))
    } finally {
      setSubmitting('')
    }
  }

  async function openSessionDetail(session) {
    setShowDetailModal(true)
    setDetailLoading(true)
    setError('')
    try {
      const detail = await getClassSessionDetail(classId, session.id)
      setSessionDetail(detail)
    } catch (requestError) {
      setSessionDetail(null)
      setError(getApiMessage(requestError, 'Không thể tải chi tiết buổi học.'))
    } finally {
      setDetailLoading(false)
    }
  }

  function closeSessionDetail() {
    if (submitting) return
    setShowDetailModal(false)
    setSessionDetail(null)
  }

  async function handleSaveAttendance(payload) {
    if (!sessionDetail?.id) return null
    setSubmitting('attendance')
    setError('')
    try {
      const updated = await saveClassSessionAttendance(classId, sessionDetail.id, payload)
      setSessionDetail(updated)
      await loadSessions()
      onMessage?.({ type: 'success', text: 'Đã lưu điểm danh buổi học.' })
      return updated
    } catch (requestError) {
      setError(getApiMessage(requestError, 'Không thể lưu điểm danh.'))
      throw requestError
    } finally {
      setSubmitting('')
    }
  }

  async function handleSaveReport(payload) {
    if (!sessionDetail?.id) return null
    setSubmitting('report')
    setError('')
    try {
      const updated = await updateClassSessionReport(classId, sessionDetail.id, payload)
      setSessionDetail(updated)
      await loadSessions()
      onMessage?.({ type: 'success', text: 'Đã lưu tạm báo cáo buổi học.' })
      return updated
    } catch (requestError) {
      setError(getApiMessage(requestError, 'Không thể lưu báo cáo buổi học.'))
      throw requestError
    } finally {
      setSubmitting('')
    }
  }

  async function handleSaveContentField(_field, payload) {
    if (!sessionDetail?.id) return null
    setSubmitting('content-editor')
    setError('')
    try {
      const updated = await updateClassSessionReport(classId, sessionDetail.id, payload)
      setSessionDetail(updated)
      await loadSessions()
      onMessage?.({ type: 'success', text: 'Đã cập nhật nội dung báo cáo buổi học.' })
      return updated
    } catch (requestError) {
      setError(getApiMessage(requestError, 'Không thể lưu nội dung báo cáo.'))
      throw requestError
    } finally {
      setSubmitting('')
    }
  }

  async function handleCompleteSession(payload) {
    if (!sessionDetail?.id) return null
    setSubmitting('complete')
    setError('')
    try {
      const updated = await completeClassSession(classId, sessionDetail.id, payload)
      setSessionDetail(updated)
      await loadSessions()
      onMessage?.({ type: 'success', text: 'Đã hoàn thành buổi học.' })
      return updated
    } catch (requestError) {
      setError(getApiMessage(requestError, 'Không thể hoàn thành buổi học.'))
      throw requestError
    } finally {
      setSubmitting('')
    }
  }

  async function handleCancelSession(session) {
    const cancelReason = window.prompt('Nhập lý do hủy buổi học', toText(session?.cancelReason))
    if (cancelReason === null) return

    setSubmitting(`cancel-${session.id}`)
    setError('')
    try {
      await cancelClassSession(classId, session.id, { cancelReason })
      await loadSessions()
      if (sessionDetail?.id === session.id) {
        const detail = await getClassSessionDetail(classId, session.id)
        setSessionDetail(detail)
      }
      onMessage?.({ type: 'success', text: 'Đã hủy buổi học.' })
    } catch (requestError) {
      setError(getApiMessage(requestError, 'Không thể hủy buổi học.'))
    } finally {
      setSubmitting('')
    }
  }

  if (loading) {
    return (
      <div className='text-center py-4'>
        <CSpinner color='primary' />
      </div>
    )
  }

  return (
    <>
      {error ? <CAlert color='danger'>{error}</CAlert> : null}

      <div className='d-flex justify-content-between align-items-center gap-2 flex-wrap mb-3'>
        <div className='small text-body-secondary'>Quản lý các buổi học thực tế, điểm danh và báo cáo buổi học của lớp.</div>
        <div className='d-flex gap-2'>
          <CButton color='secondary' variant='outline' onClick={() => setShowBulkModal(true)}>Tạo lịch hàng loạt</CButton>
          <CButton color='primary' onClick={openCreateModal}>Tạo buổi học</CButton>
        </div>
      </div>

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
              <CTableHeaderCell style={{ minWidth: 220 }}>Hành động</CTableHeaderCell>
            </CTableRow>
          </CTableHead>
          <CTableBody>
            {rows.length === 0 ? (
              <CTableRow>
                <CTableDataCell colSpan={7} className='text-center text-body-secondary py-4'>Chưa có buổi học nào cho lớp này.</CTableDataCell>
              </CTableRow>
            ) : rows.map((item) => {
              const statusMeta = getClassSessionStatusMeta(item.status)
              return (
                <CTableRow key={item.id}>
                  <CTableDataCell>{formatSessionDate(item.sessionDate)}</CTableDataCell>
                  <CTableDataCell>{formatSessionTime(item.startTime)}-{formatSessionTime(item.endTime)}</CTableDataCell>
                  <CTableDataCell>{formatTeacherDisplay(item.teacher)}</CTableDataCell>
                  <CTableDataCell>
                    <CBadge color={statusMeta.color}>{statusMeta.label}</CBadge>
                  </CTableDataCell>
                  <CTableDataCell>{item?.attendanceSummary?.label || '—'}</CTableDataCell>
                  <CTableDataCell>{getSessionDisplayStatus(item)}</CTableDataCell>
                  <CTableDataCell>
                    <div className='d-flex gap-2 flex-wrap'>
                      <CButton size='sm' color='primary' variant='outline' onClick={() => openSessionDetail(item)}>Chi tiết</CButton>
                      {item?.status !== 'cancelled' ? <CButton size='sm' color='secondary' onClick={() => openEditModal(item)}>Sửa</CButton> : null}
                      {item?.status !== 'cancelled' ? <CButton size='sm' color='danger' variant='outline' onClick={() => handleCancelSession(item)} disabled={submitting === `cancel-${item.id}`}>{submitting === `cancel-${item.id}` ? 'Đang hủy...' : 'Hủy buổi'}</CButton> : null}
                    </div>
                  </CTableDataCell>
                </CTableRow>
              )
            })}
          </CTableBody>
        </CTable>
      </CCard>

      <CModal visible={showEditor} onClose={closeEditor} alignment='center'>
        <CModalHeader>
          <CModalTitle>{editorMode === 'edit' ? 'Sửa buổi học' : 'Tạo buổi học'}</CModalTitle>
        </CModalHeader>
        <CModalBody>
          <CForm>
            <CRow className='g-3'>
              <CCol md={12}>
                <CFormLabel>Ngày học</CFormLabel>
                <CFormInput type='date' value={sessionForm.sessionDate} onChange={(event) => setSessionForm((prev) => ({ ...prev, sessionDate: event.target.value }))} />
              </CCol>
              <CCol md={6}>
                <CFormLabel>Giờ bắt đầu</CFormLabel>
                <CFormInput type='time' value={sessionForm.startTime} onChange={(event) => setSessionForm((prev) => ({ ...prev, startTime: event.target.value }))} />
              </CCol>
              <CCol md={6}>
                <CFormLabel>Giờ kết thúc</CFormLabel>
                <CFormInput type='time' value={sessionForm.endTime} onChange={(event) => setSessionForm((prev) => ({ ...prev, endTime: event.target.value }))} />
              </CCol>
              <CCol md={12}>
                <CFormLabel>Giáo viên</CFormLabel>
                <CFormSelect value={sessionForm.teacher} onChange={(event) => setSessionForm((prev) => ({ ...prev, teacher: event.target.value }))}>
                  <option value=''>Chọn giáo viên</option>
                  {teachers.map((teacher) => (
                    <option key={teacher.id} value={teacher.id}>{formatTeacherDisplay(teacher)}</option>
                  ))}
                </CFormSelect>
              </CCol>
              <CCol md={6}>
                <CFormLabel>Phòng</CFormLabel>
                <CFormInput value={sessionForm.room} onChange={(event) => setSessionForm((prev) => ({ ...prev, room: event.target.value }))} />
              </CCol>
              <CCol md={6}>
                <CFormLabel>Địa điểm</CFormLabel>
                <CFormInput value={sessionForm.location} onChange={(event) => setSessionForm((prev) => ({ ...prev, location: event.target.value }))} />
              </CCol>
              <CCol md={12}>
                <CFormLabel>Tiêu đề</CFormLabel>
                <CFormInput value={sessionForm.title} onChange={(event) => setSessionForm((prev) => ({ ...prev, title: event.target.value }))} />
              </CCol>
              <CCol md={12}>
                <CFormLabel>Ghi chú</CFormLabel>
                <CFormTextarea rows={3} value={sessionForm.note} onChange={(event) => setSessionForm((prev) => ({ ...prev, note: event.target.value }))} />
              </CCol>
            </CRow>
          </CForm>
        </CModalBody>
        <CModalFooter>
          <CButton color='secondary' variant='outline' onClick={closeEditor}>Hủy</CButton>
          <CButton color='primary' onClick={handleSaveSession} disabled={submitting === 'session'}>{submitting === 'session' ? 'Đang lưu...' : 'Lưu'}</CButton>
        </CModalFooter>
      </CModal>

      <CModal visible={showBulkModal} onClose={closeBulkModal} size='lg'>
        <CModalHeader>
          <CModalTitle>Tạo lịch hàng loạt</CModalTitle>
        </CModalHeader>
        <CModalBody>
          <CForm>
            <CRow className='g-3'>
              <CCol md={6}>
                <CFormLabel>Ngày bắt đầu</CFormLabel>
                <CFormInput type='date' value={bulkForm.startDate} onChange={(event) => setBulkForm((prev) => ({ ...prev, startDate: event.target.value }))} />
              </CCol>
              <CCol md={6}>
                <CFormLabel>Ngày kết thúc</CFormLabel>
                <CFormInput type='date' value={bulkForm.endDate} onChange={(event) => setBulkForm((prev) => ({ ...prev, endDate: event.target.value }))} />
              </CCol>
              <CCol md={6}>
                <CFormLabel>Giờ bắt đầu</CFormLabel>
                <CFormInput type='time' value={bulkForm.startTime} onChange={(event) => setBulkForm((prev) => ({ ...prev, startTime: event.target.value }))} />
              </CCol>
              <CCol md={6}>
                <CFormLabel>Giờ kết thúc</CFormLabel>
                <CFormInput type='time' value={bulkForm.endTime} onChange={(event) => setBulkForm((prev) => ({ ...prev, endTime: event.target.value }))} />
              </CCol>
              <CCol md={12}>
                <CFormLabel>Giáo viên</CFormLabel>
                <CFormSelect value={bulkForm.teacher} onChange={(event) => setBulkForm((prev) => ({ ...prev, teacher: event.target.value }))}>
                  <option value=''>Chọn giáo viên</option>
                  {teachers.map((teacher) => (
                    <option key={teacher.id} value={teacher.id}>{formatTeacherDisplay(teacher)}</option>
                  ))}
                </CFormSelect>
              </CCol>
              <CCol md={6}>
                <CFormLabel>Phòng</CFormLabel>
                <CFormInput value={bulkForm.room} onChange={(event) => setBulkForm((prev) => ({ ...prev, room: event.target.value }))} />
              </CCol>
              <CCol md={6}>
                <CFormLabel>Địa điểm</CFormLabel>
                <CFormInput value={bulkForm.location} onChange={(event) => setBulkForm((prev) => ({ ...prev, location: event.target.value }))} />
              </CCol>
              <CCol md={12}>
                <CFormLabel>Ghi chú</CFormLabel>
                <CFormTextarea rows={2} value={bulkForm.note} onChange={(event) => setBulkForm((prev) => ({ ...prev, note: event.target.value }))} />
              </CCol>
              <CCol md={12}>
                <CFormLabel>Thứ trong tuần</CFormLabel>
                <div className='d-flex gap-3 flex-wrap'>
                  {CLASS_SESSION_WEEKDAY_OPTIONS.map((option) => (
                    <CFormCheck
                      key={option.value}
                      id={`weekday-${option.value}`}
                      label={option.label}
                      checked={bulkForm.weekdays.includes(option.value)}
                      onChange={(event) => setBulkForm((prev) => ({
                        ...prev,
                        weekdays: event.target.checked
                          ? [...prev.weekdays, option.value].sort((a, b) => a - b)
                          : prev.weekdays.filter((item) => item !== option.value),
                      }))}
                    />
                  ))}
                </div>
              </CCol>
              <CCol md={12}>
                <CButton color='secondary' variant='outline' onClick={handleGeneratePreview}>Sinh preview</CButton>
              </CCol>
            </CRow>
          </CForm>

          {bulkPreview.length > 0 ? (
            <div className='mt-4'>
              <div className='d-flex justify-content-between align-items-center mb-2'>
                <strong>Preview buổi học</strong>
                <div className='small text-body-secondary'>Đã chọn {selectedBulkRows.length}/{bulkPreview.length} buổi</div>
              </div>
              <CTable small responsive>
                <CTableHead>
                  <CTableRow>
                    <CTableHeaderCell style={{ width: 60 }}>Chọn</CTableHeaderCell>
                    <CTableHeaderCell>Ngày</CTableHeaderCell>
                    <CTableHeaderCell>Thời gian</CTableHeaderCell>
                  </CTableRow>
                </CTableHead>
                <CTableBody>
                  {bulkPreview.map((item, index) => (
                    <CTableRow key={item.key || index}>
                      <CTableDataCell>
                        <CFormCheck checked={item.selected} onChange={(event) => setBulkPreview((prev) => prev.map((row) => row.key === item.key ? { ...row, selected: event.target.checked } : row))} />
                      </CTableDataCell>
                      <CTableDataCell>{formatSessionDate(item.sessionDate)}</CTableDataCell>
                      <CTableDataCell>{formatSessionTime(item.startTime)}-{formatSessionTime(item.endTime)}</CTableDataCell>
                    </CTableRow>
                  ))}
                </CTableBody>
              </CTable>
            </div>
          ) : null}
        </CModalBody>
        <CModalFooter>
          <CButton color='secondary' variant='outline' onClick={closeBulkModal}>Đóng</CButton>
          <CButton color='primary' onClick={handleSaveBulk} disabled={submitting === 'bulk'}>{submitting === 'bulk' ? 'Đang tạo...' : 'Xác nhận tạo lịch'}</CButton>
        </CModalFooter>
      </CModal>

      <ClassSessionDetailModal
        visible={showDetailModal}
        title='Chi tiết buổi học'
        loading={detailLoading}
        sessionDetail={sessionDetail}
        saveStatus={submitting}
        loadError={error}
        onClose={closeSessionDetail}
        onSaveAttendance={handleSaveAttendance}
        onSaveReport={handleSaveReport}
        onComplete={handleCompleteSession}
        onFieldSave={handleSaveContentField}
      />
    </>
  )
}