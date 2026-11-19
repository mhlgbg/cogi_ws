import { useEffect, useState } from 'react'
import {
  CAlert,
  CButton,
  CCol,
  CFormInput,
  CFormLabel,
  CFormSelect,
  CModal,
  CModalBody,
  CModalFooter,
  CModalHeader,
  CModalTitle,
  CRow,
} from '@coreui/react'

export const DEFAULT_SESSION_FORM = {
  slot: '',
  code: '',
  name: '',
  subject: '',
  startAt: '',
  endAt: '',
  durationMinutes: '60',
  examLocation: '',
  roomCode: '',
  roomName: '',
  roomCapacity: '',
  status: 'draft',
}

export function normalizeDatetimeLocal(value) {
  if (value === null || value === undefined || value === '') {
    return ''
  }

  const text = String(value).trim()
  if (!text) return ''

  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(text)) {
    return text
  }

  const date = new Date(text)
  if (Number.isNaN(date.getTime())) {
    return text.length >= 16 ? text.slice(0, 16) : text
  }

  const pad = (part) => String(part).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

export function toIsoDateTime(value) {
  if (!value) return ''
  const text = String(value).trim()
  if (!text) return ''
  const date = new Date(text)
  if (Number.isNaN(date.getTime())) return ''
  return date.toISOString()
}

export function formatSlotOption(slot) {
  if (!slot) return '—'
  const name = slot.name || slot.code || 'Ca thi'
  const time = slot.startAt && slot.endAt ? `${new Date(slot.startAt).toLocaleString('vi-VN', { dateStyle: 'short', timeStyle: 'short' })} → ${new Date(slot.endAt).toLocaleString('vi-VN', { dateStyle: 'short', timeStyle: 'short' })}` : ''
  return time ? `${name} (${time})` : name
}

export function toSessionFormValues(values = {}) {
  return {
    ...DEFAULT_SESSION_FORM,
    ...values,
    slot: values?.slot ? String(values.slot) : '',
    subject: values?.subject ? String(values.subject) : '',
    code: String(values?.code || '').trim(),
    name: String(values?.name || '').trim(),
    status: values?.status || 'draft',
    durationMinutes: values?.durationMinutes ? String(values.durationMinutes) : '60',
    startAt: normalizeDatetimeLocal(values?.startAt || ''),
    endAt: normalizeDatetimeLocal(values?.endAt || ''),
    examLocation: String(values?.examLocation || ''),
    roomCode: String(values?.roomCode || ''),
    roomName: String(values?.roomName || ''),
    roomCapacity: values?.roomCapacity === null || values?.roomCapacity === undefined || values?.roomCapacity === '' ? '' : String(values.roomCapacity),
  }
}

export default function AssessmentSessionModal({
  visible,
  slots = [],
  subjects = [],
  subjectsLoading = false,
  subjectsError = '',
  title,
  initialValues = {},
  submitLabel = 'Lưu',
  saving = false,
  onClose,
  onSave,
}) {
  const [form, setForm] = useState(DEFAULT_SESSION_FORM)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!visible) {
      setError('')
      return
    }
    setForm(toSessionFormValues(initialValues))
    setError('')
  }, [visible, initialValues])

  function applySlotDefaults(nextSlotId) {
    const slot = slots.find((item) => String(item.id || item.documentId) === String(nextSlotId))
    if (!slot) return
    setForm((prev) => ({
      ...prev,
      slot: String(nextSlotId),
      startAt: prev.startAt || normalizeDatetimeLocal(slot.startAt || ''),
      endAt: prev.endAt || normalizeDatetimeLocal(slot.endAt || ''),
    }))
  }

  async function handleSubmit() {
    const nextForm = {
      ...form,
      slot: String(form.slot || '').trim(),
      code: String(form.code || '').trim(),
      name: String(form.name || '').trim(),
      subject: String(form.subject || '').trim(),
      durationMinutes: Number(form.durationMinutes || 0),
      status: 'draft',
      startAt: normalizeDatetimeLocal(form.startAt),
      endAt: normalizeDatetimeLocal(form.endAt),
      examLocation: String(form.examLocation || '').trim(),
      roomCode: String(form.roomCode || '').trim(),
      roomName: String(form.roomName || '').trim(),
      roomCapacity: form.roomCapacity === '' || form.roomCapacity === null || form.roomCapacity === undefined ? null : Number(form.roomCapacity),
    }

    if (!nextForm.slot) {
      setError('Vui lòng chọn ca thi')
      return
    }
    if (!nextForm.code) {
      setError('Mã phiên không được để trống')
      return
    }
    if (!nextForm.name) {
      setError('Tên phiên không được để trống')
      return
    }
    if (!nextForm.subject) {
      setError('Vui lòng chọn môn thi')
      return
    }
    if (!Number.isFinite(nextForm.durationMinutes) || nextForm.durationMinutes <= 0) {
      setError('Thời lượng phải là số nguyên dương')
      return
    }
    if (nextForm.startAt && nextForm.endAt && new Date(nextForm.endAt).getTime() <= new Date(nextForm.startAt).getTime()) {
      setError('Thời gian kết thúc phải sau thời gian bắt đầu')
      return
    }

    setError('')
    await onSave?.(nextForm)
  }

  return (
    <CModal visible={visible} onClose={onClose} alignment='center' size='lg'>
      <CModalHeader>
        <CModalTitle>{title || 'Phiên thi'}</CModalTitle>
      </CModalHeader>
      <CModalBody>
        {subjectsError ? <CAlert color='danger' className='mb-3'>{subjectsError}</CAlert> : null}
        {subjectsLoading ? <div className='small text-medium-emphasis mb-3'>Đang tải danh sách môn học...</div> : null}
        {!subjectsLoading && subjects.length === 0 ? <div className='small text-warning mb-3'>Chưa có môn học thuộc tenant hiện tại.</div> : null}

        <CRow className='g-3'>
          <CCol md={6}>
            <CFormLabel htmlFor='session-slot'>Ca thi</CFormLabel>
            <CFormSelect id='session-slot' value={form.slot} onChange={(event) => {
              const nextValue = event.target.value
              setForm((prev) => ({ ...prev, slot: nextValue }))
              if (nextValue) {
                applySlotDefaults(nextValue)
              }
            }}>
              <option value=''>-- Chọn ca thi --</option>
              {slots.map((slot) => (
                <option key={slot.id || slot.documentId} value={slot.id || slot.documentId}>
                  {formatSlotOption(slot)}
                </option>
              ))}
            </CFormSelect>
          </CCol>

          <CCol md={6}>
            <CFormLabel htmlFor='session-subject'>Môn thi</CFormLabel>
            <CFormSelect id='session-subject' value={form.subject} disabled={subjectsLoading || subjects.length === 0} onChange={(event) => setForm((prev) => ({ ...prev, subject: event.target.value }))}>
              <option value=''>-- Chọn môn --</option>
              {subjects.map((subject, index) => (
                <option key={subject.id ?? subject.documentId ?? subject.code ?? `${subject.title || subject.name || 'subject'}-${index}`} value={subject.id ?? subject.documentId ?? ''}>
                  {subject.code ? `${subject.code} - ${subject.title || subject.name}` : (subject.title || subject.name || 'Môn học')}
                </option>
              ))}
            </CFormSelect>
          </CCol>

          <CCol md={6}>
            <CFormLabel htmlFor='session-code'>Mã phiên</CFormLabel>
            <CFormInput id='session-code' value={form.code} onChange={(event) => setForm((prev) => ({ ...prev, code: event.target.value }))} />
          </CCol>

          <CCol md={6}>
            <CFormLabel htmlFor='session-name'>Tên phiên</CFormLabel>
            <CFormInput id='session-name' value={form.name} onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))} />
          </CCol>

          <CCol md={6}>
            <CFormLabel htmlFor='session-start'>Thời gian bắt đầu</CFormLabel>
            <CFormInput id='session-start' type='datetime-local' value={form.startAt} onChange={(event) => setForm((prev) => ({ ...prev, startAt: normalizeDatetimeLocal(event.target.value) }))} />
          </CCol>

          <CCol md={6}>
            <CFormLabel htmlFor='session-end'>Thời gian kết thúc</CFormLabel>
            <CFormInput id='session-end' type='datetime-local' value={form.endAt} onChange={(event) => setForm((prev) => ({ ...prev, endAt: normalizeDatetimeLocal(event.target.value) }))} />
          </CCol>

          <CCol md={6}>
            <CFormLabel htmlFor='session-duration'>Thời lượng (phút)</CFormLabel>
            <CFormInput id='session-duration' type='number' min='1' step='1' value={form.durationMinutes} onChange={(event) => setForm((prev) => ({ ...prev, durationMinutes: event.target.value }))} />
          </CCol>

          <CCol md={6}>
            <CFormLabel htmlFor='session-status'>Trạng thái</CFormLabel>
            <CFormInput id='session-status' value='draft' disabled readOnly />
          </CCol>

          <CCol md={4}>
            <CFormLabel htmlFor='session-location'>Địa điểm</CFormLabel>
            <CFormInput id='session-location' value={form.examLocation} onChange={(event) => setForm((prev) => ({ ...prev, examLocation: event.target.value }))} />
          </CCol>

          <CCol md={4}>
            <CFormLabel htmlFor='session-room-code'>Mã phòng</CFormLabel>
            <CFormInput id='session-room-code' value={form.roomCode} onChange={(event) => setForm((prev) => ({ ...prev, roomCode: event.target.value }))} />
          </CCol>

          <CCol md={4}>
            <CFormLabel htmlFor='session-room-name'>Tên phòng</CFormLabel>
            <CFormInput id='session-room-name' value={form.roomName} onChange={(event) => setForm((prev) => ({ ...prev, roomName: event.target.value }))} />
          </CCol>

          <CCol md={4}>
            <CFormLabel htmlFor='session-room-capacity'>Sức chứa</CFormLabel>
            <CFormInput id='session-room-capacity' type='number' min='1' step='1' value={form.roomCapacity} onChange={(event) => setForm((prev) => ({ ...prev, roomCapacity: event.target.value }))} />
          </CCol>
        </CRow>

        {error ? <CAlert color='danger' className='mt-3 mb-0'>{error}</CAlert> : null}
      </CModalBody>
      <CModalFooter>
        <CButton color='secondary' variant='outline' onClick={onClose} disabled={saving}>Hủy</CButton>
        <CButton color='primary' onClick={handleSubmit} disabled={saving}>{saving ? 'Đang lưu...' : submitLabel}</CButton>
      </CModalFooter>
    </CModal>
  )
}
