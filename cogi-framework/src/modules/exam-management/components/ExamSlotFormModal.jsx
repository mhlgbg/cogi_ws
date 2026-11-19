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

export const DEFAULT_SLOT_FORM = {
  code: '',
  name: '',
  status: 'draft',
  startAt: '',
  endAt: '',
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
  const input = String(value).trim()
  if (!input) return ''
  const date = new Date(input)
  if (Number.isNaN(date.getTime())) return ''
  return date.toISOString()
}

export function formatSlotDateTime(value) {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return new Intl.DateTimeFormat('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date)
}

export function toSlotFormValues(values = {}) {
  return {
    ...DEFAULT_SLOT_FORM,
    ...values,
    code: String(values?.code || '').trim(),
    name: String(values?.name || '').trim(),
    status: values?.status || 'draft',
    startAt: normalizeDatetimeLocal(values?.startAt || ''),
    endAt: normalizeDatetimeLocal(values?.endAt || ''),
  }
}

export default function ExamSlotFormModal({
  visible,
  title,
  initialValues = {},
  saveLabel = 'Lưu',
  saving = false,
  onClose,
  onSave,
}) {
  const [form, setForm] = useState(DEFAULT_SLOT_FORM)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!visible) {
      setError('')
      return
    }
    setForm(toSlotFormValues(initialValues))
    setError('')
  }, [visible, initialValues])

  async function handleSubmit() {
    const nextForm = {
      ...form,
      code: String(form.code || '').trim(),
      name: String(form.name || '').trim(),
      status: form.status || 'draft',
      startAt: normalizeDatetimeLocal(form.startAt),
      endAt: normalizeDatetimeLocal(form.endAt),
    }

    if (!nextForm.code) {
      setError('Mã ca thi không được để trống')
      return
    }
    if (!nextForm.name) {
      setError('Tên ca thi không được để trống')
      return
    }
    if (!nextForm.startAt || !nextForm.endAt) {
      setError('Thời gian bắt đầu và kết thúc là bắt buộc')
      return
    }
    if (new Date(nextForm.endAt).getTime() <= new Date(nextForm.startAt).getTime()) {
      setError('Thời gian kết thúc phải sau thời gian bắt đầu')
      return
    }

    setError('')
    await onSave?.(nextForm)
  }

  return (
    <CModal visible={visible} onClose={onClose} alignment='center' size='lg'>
      <CModalHeader>
        <CModalTitle>{title || 'Ca thi'}</CModalTitle>
      </CModalHeader>
      <CModalBody>
        <CRow className='g-3'>
          <CCol md={4}>
            <CFormLabel htmlFor='slot-code'>Mã ca thi</CFormLabel>
            <CFormInput id='slot-code' value={form.code} onChange={(event) => setForm((prev) => ({ ...prev, code: event.target.value }))} />
          </CCol>
          <CCol md={4}>
            <CFormLabel htmlFor='slot-name'>Tên ca thi</CFormLabel>
            <CFormInput id='slot-name' value={form.name} onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))} />
          </CCol>
          <CCol md={4}>
            <CFormLabel htmlFor='slot-status'>Trạng thái</CFormLabel>
            <CFormSelect id='slot-status' value={form.status} onChange={(event) => setForm((prev) => ({ ...prev, status: event.target.value }))}>
              <option value='draft'>draft</option>
              <option value='ready'>ready</option>
              <option value='archived'>archived</option>
            </CFormSelect>
          </CCol>
          <CCol md={6}>
            <CFormLabel htmlFor='slot-start'>Thời gian bắt đầu</CFormLabel>
            <CFormInput id='slot-start' type='datetime-local' value={form.startAt} onChange={(event) => setForm((prev) => ({ ...prev, startAt: normalizeDatetimeLocal(event.target.value) }))} />
          </CCol>
          <CCol md={6}>
            <CFormLabel htmlFor='slot-end'>Thời gian kết thúc</CFormLabel>
            <CFormInput id='slot-end' type='datetime-local' value={form.endAt} onChange={(event) => setForm((prev) => ({ ...prev, endAt: normalizeDatetimeLocal(event.target.value) }))} />
          </CCol>
        </CRow>
        {error ? <CAlert color='danger' className='mt-3 mb-0'>{error}</CAlert> : null}
      </CModalBody>
      <CModalFooter>
        <CButton color='secondary' variant='outline' onClick={onClose} disabled={saving}>Hủy</CButton>
        <CButton color='primary' onClick={handleSubmit} disabled={saving}>
          {saving ? 'Đang lưu...' : saveLabel}
        </CButton>
      </CModalFooter>
    </CModal>
  )
}
