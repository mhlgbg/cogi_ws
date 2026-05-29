import { useEffect, useState } from 'react'
import {
  CAlert,
  CButton,
  CFormInput,
  CFormLabel,
  CModal,
  CModalBody,
  CModalFooter,
  CModalHeader,
  CModalTitle,
} from '@coreui/react'

export default function AdmissionReviewAccountModal({
  visible,
  submitting,
  initialValues,
  error,
  onClose,
  onSubmit,
}) {
  const [form, setForm] = useState({
    fullName: '',
    email: '',
    phone: '',
  })

  useEffect(() => {
    if (!visible) return
    setForm({
      fullName: String(initialValues?.fullName || '').trim(),
      email: String(initialValues?.email || '').trim(),
      phone: String(initialValues?.phone || '').trim(),
    })
  }, [initialValues?.email, initialValues?.fullName, initialValues?.phone, visible])

  function handleSubmit() {
    onSubmit({
      fullName: String(form.fullName || '').trim(),
      email: String(form.email || '').trim().toLowerCase(),
      phone: String(form.phone || '').trim(),
    })
  }

  const normalizedEmail = String(form.email || '').trim()

  return (
    <CModal visible={visible} onClose={() => !submitting && onClose?.()} alignment='center'>
      <CModalHeader>
        <CModalTitle>Đổi thông tin tài khoản</CModalTitle>
      </CModalHeader>
      <CModalBody>
        {error ? <CAlert color='danger'>{error}</CAlert> : null}

        <div className='mb-3'>
          <CFormLabel>Họ và tên</CFormLabel>
          <CFormInput
            value={form.fullName}
            onChange={(event) => setForm((current) => ({ ...current, fullName: event.target.value }))}
            placeholder='Nhập họ tên phụ huynh'
            disabled={submitting}
          />
        </div>

        <div className='mb-3'>
          <CFormLabel>Email</CFormLabel>
          <CFormInput
            type='email'
            value={form.email}
            onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))}
            placeholder='Nhập email phụ huynh'
            disabled={submitting}
          />
        </div>

        <div>
          <CFormLabel>Số điện thoại</CFormLabel>
          <CFormInput
            value={form.phone}
            onChange={(event) => setForm((current) => ({ ...current, phone: event.target.value }))}
            placeholder='Nhập số điện thoại phụ huynh'
            disabled={submitting}
          />
        </div>

        {!normalizedEmail ? (
          <div className='text-danger small mt-2'>Vui lòng nhập email</div>
        ) : null}
      </CModalBody>
      <CModalFooter>
        <CButton color='secondary' variant='outline' onClick={() => onClose?.()} disabled={submitting}>
          Hủy
        </CButton>
        <CButton color='primary' onClick={handleSubmit} disabled={submitting || !normalizedEmail}>
          {submitting ? 'Đang lưu...' : 'Lưu thay đổi'}
        </CButton>
      </CModalFooter>
    </CModal>
  )
}