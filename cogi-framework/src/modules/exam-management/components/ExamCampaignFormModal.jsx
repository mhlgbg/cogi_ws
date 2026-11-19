import { useEffect, useState } from 'react'
import {
  CAlert,
  CButton,
  CCol,
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
} from '@coreui/react'

export const DEFAULT_CAMPAIGN_FORM = {
  code: '',
  name: '',
  status: 'draft',
  startDate: '',
  endDate: '',
  description: '',
}

export function normalizeDateInput(value) {
  if (value === null || value === undefined || value === '') return ''
  const text = String(value).trim()
  if (!text) return ''

  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) {
    return text
  }

  const dateText = text.slice(0, 10)
  return /^\d{4}-\d{2}-\d{2}$/.test(dateText) ? dateText : ''
}

export function formatDisplayDate(value) {
  if (!value) return '—'
  const dateText = String(value).trim()
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateText)) return '—'

  const [year, month, day] = dateText.split('-').map(Number)
  if (!year || !month || !day) return '—'

  const date = new Date(year, month - 1, day)
  if (Number.isNaN(date.getTime())) return '—'

  return new Intl.DateTimeFormat('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(date)
}

export function toCampaignFormValues(values = {}) {
  return {
    ...DEFAULT_CAMPAIGN_FORM,
    ...values,
    code: String(values?.code || '').trim(),
    name: String(values?.name || '').trim(),
    status: values?.status || 'draft',
    startDate: normalizeDateInput(values?.startDate ?? values?.startAt ?? ''),
    endDate: normalizeDateInput(values?.endDate ?? values?.endAt ?? ''),
    description: String(values?.description || '').trim(),
  }
}

export default function ExamCampaignFormModal({
  visible,
  title,
  initialValues = {},
  submitLabel = 'Lưu',
  saving = false,
  onClose,
  onSave,
}) {
  const [form, setForm] = useState(DEFAULT_CAMPAIGN_FORM)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!visible) {
      setError('')
      return
    }
    setForm(toCampaignFormValues(initialValues))
    setError('')
  }, [visible, initialValues])

  async function handleSubmit() {
    const nextForm = {
      ...form,
      code: String(form.code || '').trim(),
      name: String(form.name || '').trim(),
      description: String(form.description || '').trim(),
      startDate: normalizeDateInput(form.startDate),
      endDate: normalizeDateInput(form.endDate),
    }

    if (!nextForm.code) {
      setError('Mã đợt thi là bắt buộc')
      return
    }
    if (!nextForm.name) {
      setError('Tên đợt thi là bắt buộc')
      return
    }
    if (nextForm.startDate && nextForm.endDate && nextForm.startDate > nextForm.endDate) {
      setError('Ngày bắt đầu không được sau ngày kết thúc')
      return
    }

    setError('')
    await onSave?.(nextForm)
  }

  return (
    <CModal visible={visible} onClose={onClose} alignment='center' size='lg'>
      <CModalHeader>
        <CModalTitle>{title || 'Đợt thi'}</CModalTitle>
      </CModalHeader>
      <CModalBody>
        <CRow className='g-3'>
          <CCol md={4}>
            <CFormLabel htmlFor='campaign-code'>Mã đợt thi</CFormLabel>
            <CFormInput id='campaign-code' value={form.code} onChange={(event) => setForm((prev) => ({ ...prev, code: event.target.value }))} />
          </CCol>
          <CCol md={4}>
            <CFormLabel htmlFor='campaign-name'>Tên đợt thi</CFormLabel>
            <CFormInput id='campaign-name' value={form.name} onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))} />
          </CCol>
          <CCol md={4}>
            <CFormLabel htmlFor='campaign-status'>Trạng thái</CFormLabel>
            <CFormSelect id='campaign-status' value={form.status} onChange={(event) => setForm((prev) => ({ ...prev, status: event.target.value }))}>
              <option value='draft'>draft</option>
              <option value='ready'>ready</option>
            </CFormSelect>
          </CCol>
          <CCol md={6}>
            <CFormLabel htmlFor='campaign-start-date'>Ngày bắt đầu</CFormLabel>
            <CFormInput id='campaign-start-date' type='date' value={form.startDate} onChange={(event) => setForm((prev) => ({ ...prev, startDate: normalizeDateInput(event.target.value) }))} />
          </CCol>
          <CCol md={6}>
            <CFormLabel htmlFor='campaign-end-date'>Ngày kết thúc</CFormLabel>
            <CFormInput id='campaign-end-date' type='date' value={form.endDate} onChange={(event) => setForm((prev) => ({ ...prev, endDate: normalizeDateInput(event.target.value) }))} />
          </CCol>
          <CCol xs={12}>
            <CFormLabel htmlFor='campaign-description'>Mô tả</CFormLabel>
            <CFormTextarea id='campaign-description' rows={3} value={form.description} onChange={(event) => setForm((prev) => ({ ...prev, description: event.target.value }))} />
          </CCol>
        </CRow>
        {error ? <CAlert color='danger' className='mt-3 mb-0'>{error}</CAlert> : null}
      </CModalBody>
      <CModalFooter>
        <CButton color='secondary' variant='outline' onClick={onClose} disabled={saving}>Hủy</CButton>
        <CButton color='primary' onClick={handleSubmit} disabled={saving}>
          {saving ? 'Đang lưu...' : submitLabel}
        </CButton>
      </CModalFooter>
    </CModal>
  )
}
