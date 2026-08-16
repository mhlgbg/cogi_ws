import { useEffect, useMemo, useState } from 'react'
import {
  CAlert,
  CButton,
  CCol,
  CForm,
  CFormCheck,
  CFormInput,
  CFormLabel,
  CFormSelect,
  CFormTextarea,
  CRow,
  CSpinner,
} from '@coreui/react'
import {
  buildPaymentProfileFormValues,
  buildPaymentProfilePayload,
  mapPaymentProfileFieldErrors,
  getPaymentProfileApiMessage,
  validatePaymentProfileForm,
} from '../utils/paymentProfileUi'
import { uploadPaymentProfileQrImage } from '../services/paymentProfileService'

export default function PaymentProfileForm({ initialValues, submitting = false, submitError = '', onCancel, onSubmit }) {
  const [form, setForm] = useState(() => buildPaymentProfileFormValues(initialValues))
  const [fieldErrors, setFieldErrors] = useState({})
  const [uploadingQr, setUploadingQr] = useState(false)
  const [uploadError, setUploadError] = useState('')

  useEffect(() => {
    setForm(buildPaymentProfileFormValues(initialValues))
    setFieldErrors({})
    setUploadError('')
    setUploadingQr(false)
  }, [initialValues])

  const templatePreview = useMemo(() => {
    const template = String(form.transferContentTemplate || '').trim()
    if (!template) return ''
    return template
      .replaceAll('{registrationCode}', 'DKTHI000123')
      .replaceAll('{learnerCode}', 'SV20260001')
      .replaceAll('{fullName}', 'Nguyen Van A')
      .replaceAll('{roundCode}', 'ROUND2026A')
  }, [form.transferContentTemplate])

  function updateField(key, value) {
    setForm((current) => ({ ...current, [key]: value }))
    setFieldErrors((current) => {
      if (!current[key]) return current
      const next = { ...current }
      delete next[key]
      return next
    })
  }

  async function handleQrChange(file) {
    if (!file) return
    setUploadingQr(true)
    setUploadError('')
    try {
      const uploaded = await uploadPaymentProfileQrImage(file)
      if (!uploaded?.id) throw new Error('Không nhận được dữ liệu media sau khi upload')
      setForm((current) => ({ ...current, qrImage: uploaded }))
    } catch (requestError) {
      setUploadError(getPaymentProfileApiMessage(requestError, 'Không thể upload ảnh QR.'))
    } finally {
      setUploadingQr(false)
    }
  }

  function handleSubmit(event) {
    event.preventDefault()
    const nextErrors = validatePaymentProfileForm(form)
    setFieldErrors(nextErrors)
    if (Object.keys(nextErrors).length > 0) return
    onSubmit?.(buildPaymentProfilePayload(form), {
      setFieldErrors: (requestError) => setFieldErrors(mapPaymentProfileFieldErrors(requestError)),
    })
  }

  const showBankFields = String(form.paymentMethod || '').trim().toLowerCase() === 'bank_transfer'

  return (
    <CForm onSubmit={handleSubmit}>
      {submitError ? <CAlert color='danger'>{submitError}</CAlert> : null}
      {uploadError ? <CAlert color='danger'>{uploadError}</CAlert> : null}

      <div className='fw-semibold mb-3'>Thông tin chung</div>
      <CRow className='g-3 mb-4'>
        <CCol md={6}><CFormLabel>Tên hồ sơ</CFormLabel><CFormInput value={form.name} onChange={(event) => updateField('name', event.target.value)} disabled={submitting} invalid={Boolean(fieldErrors.name)} />{fieldErrors.name ? <div className='text-danger small mt-1'>{fieldErrors.name}</div> : null}</CCol>
        <CCol md={3}><CFormLabel>Mã</CFormLabel><CFormInput value={form.code} onChange={(event) => updateField('code', event.target.value.toUpperCase())} disabled={submitting} invalid={Boolean(fieldErrors.code)} />{fieldErrors.code ? <div className='text-danger small mt-1'>{fieldErrors.code}</div> : null}</CCol>
        <CCol md={3}><CFormLabel>Phương thức</CFormLabel><CFormSelect value={form.paymentMethod} onChange={(event) => updateField('paymentMethod', event.target.value)} disabled={submitting} invalid={Boolean(fieldErrors.paymentMethod)}><option value='bank_transfer'>Chuyển khoản ngân hàng</option><option value='cash'>Tiền mặt</option><option value='other'>Khác</option></CFormSelect>{fieldErrors.paymentMethod ? <div className='text-danger small mt-1'>{fieldErrors.paymentMethod}</div> : null}</CCol>
        <CCol md={3}><CFormLabel>Loại tiền</CFormLabel><CFormInput value={form.currency} onChange={(event) => updateField('currency', event.target.value.toUpperCase())} disabled={submitting} invalid={Boolean(fieldErrors.currency)} />{fieldErrors.currency ? <div className='text-danger small mt-1'>{fieldErrors.currency}</div> : null}</CCol>
        <CCol md={3}><CFormLabel>Thứ tự hiển thị</CFormLabel><CFormInput type='number' min='0' value={form.sortOrder} onChange={(event) => updateField('sortOrder', event.target.value)} disabled={submitting} invalid={Boolean(fieldErrors.sortOrder)} />{fieldErrors.sortOrder ? <div className='text-danger small mt-1'>{fieldErrors.sortOrder}</div> : null}</CCol>
        <CCol md={3} className='d-flex align-items-end'><CFormCheck label='Đang hoạt động' checked={form.isActive} onChange={(event) => updateField('isActive', event.target.checked)} disabled={submitting} /></CCol>
        <CCol md={3} className='d-flex align-items-end'><CFormCheck label='Đặt làm mặc định' checked={form.isDefault} onChange={(event) => updateField('isDefault', event.target.checked)} disabled={submitting || !form.isActive} /></CCol>
        <CCol xs={12}><CFormLabel>Mô tả</CFormLabel><CFormTextarea rows={3} value={form.description} onChange={(event) => updateField('description', event.target.value)} disabled={submitting} /></CCol>
      </CRow>

      <div className='fw-semibold mb-3'>Tài khoản ngân hàng</div>
      <CRow className='g-3 mb-4'>
        <CCol md={4}><CFormLabel>Mã ngân hàng</CFormLabel><CFormInput value={form.bankCode} onChange={(event) => updateField('bankCode', event.target.value.toUpperCase())} disabled={submitting} invalid={Boolean(fieldErrors.bankCode)} />{fieldErrors.bankCode ? <div className='text-danger small mt-1'>{fieldErrors.bankCode}</div> : null}</CCol>
        <CCol md={8}><CFormLabel>Tên ngân hàng</CFormLabel><CFormInput value={form.bankName} onChange={(event) => updateField('bankName', event.target.value)} disabled={submitting} invalid={Boolean(fieldErrors.bankName)} />{fieldErrors.bankName ? <div className='text-danger small mt-1'>{fieldErrors.bankName}</div> : null}</CCol>
        <CCol md={4}><CFormLabel>Số tài khoản</CFormLabel><CFormInput value={form.accountNumber} onChange={(event) => updateField('accountNumber', event.target.value)} disabled={submitting} invalid={Boolean(fieldErrors.accountNumber)} />{fieldErrors.accountNumber ? <div className='text-danger small mt-1'>{fieldErrors.accountNumber}</div> : null}</CCol>
        <CCol md={4}><CFormLabel>Chủ tài khoản</CFormLabel><CFormInput value={form.accountHolder} onChange={(event) => updateField('accountHolder', event.target.value)} disabled={submitting} invalid={Boolean(fieldErrors.accountHolder)} />{fieldErrors.accountHolder ? <div className='text-danger small mt-1'>{fieldErrors.accountHolder}</div> : null}</CCol>
        <CCol md={4}><CFormLabel>Chi nhánh</CFormLabel><CFormInput value={form.bankBranch} onChange={(event) => updateField('bankBranch', event.target.value)} disabled={submitting} /></CCol>
        {!showBankFields ? <CCol xs={12}><div className='small text-body-secondary'>Các trường ngân hàng là tùy chọn khi phương thức thanh toán là tiền mặt hoặc khác. Dữ liệu đã nhập vẫn được giữ nguyên cho tới khi bạn lưu.</div></CCol> : null}
      </CRow>

      <div className='fw-semibold mb-3'>Hướng dẫn thanh toán</div>
      <CRow className='g-3 mb-4'>
        <CCol md={6}><CFormLabel>Mẫu nội dung chuyển khoản</CFormLabel><CFormInput value={form.transferContentTemplate} onChange={(event) => updateField('transferContentTemplate', event.target.value)} disabled={submitting} /><div className='small text-body-secondary mt-1'>Placeholder dự kiến: {'{registrationCode}'}, {'{learnerCode}'}, {'{fullName}'}, {'{roundCode}'}</div>{templatePreview ? <div className='small mt-1'>Minh họa: <strong>{templatePreview}</strong></div> : null}</CCol>
        <CCol md={6}><CFormLabel>Điện thoại hỗ trợ</CFormLabel><CFormInput value={form.supportPhone} onChange={(event) => updateField('supportPhone', event.target.value)} disabled={submitting} /></CCol>
        <CCol md={6}><CFormLabel>Email hỗ trợ</CFormLabel><CFormInput value={form.supportEmail} onChange={(event) => updateField('supportEmail', event.target.value)} disabled={submitting} invalid={Boolean(fieldErrors.supportEmail)} />{fieldErrors.supportEmail ? <div className='text-danger small mt-1'>{fieldErrors.supportEmail}</div> : null}</CCol>
        <CCol xs={12}><CFormLabel>Hướng dẫn thanh toán</CFormLabel><CFormTextarea rows={5} value={form.paymentInstruction} onChange={(event) => updateField('paymentInstruction', event.target.value)} disabled={submitting} /></CCol>
      </CRow>

      <div className='fw-semibold mb-3'>Mã QR</div>
      <CRow className='g-3 mb-4'>
        <CCol lg={5}>
          <div className='border rounded p-3 h-100'>
            <CFormLabel htmlFor='payment-profile-qr-image'>Ảnh QR tĩnh</CFormLabel>
            <CFormInput id='payment-profile-qr-image' type='file' accept='image/*' disabled={submitting || uploadingQr} onChange={(event) => { const file = event.target.files?.[0] || null; handleQrChange(file); event.target.value = '' }} />
            <div className='small text-body-secondary mt-2'>Ảnh QR tĩnh dùng để hỗ trợ người nộp tiền. Nội dung tài khoản trên ảnh cần khớp với thông tin hồ sơ.</div>
            {uploadingQr ? <div className='d-flex align-items-center gap-2 mt-2'><CSpinner size='sm' /><span>Đang tải ảnh QR...</span></div> : null}
            {fieldErrors.qrImage ? <div className='text-danger small mt-1'>{fieldErrors.qrImage}</div> : null}
            {form.qrImage?.url ? <div className='mt-3 d-flex gap-2 flex-wrap'><CButton type='button' size='sm' color='secondary' variant='outline' onClick={() => updateField('qrImage', null)} disabled={submitting || uploadingQr}>Gỡ ảnh QR</CButton></div> : null}
          </div>
        </CCol>
        <CCol lg={7}>
          <div className='border rounded p-3 h-100 d-flex align-items-center justify-content-center bg-body-tertiary'>
            {form.qrImage?.url ? <img src={form.qrImage.url} alt='QR preview' style={{ maxWidth: '100%', maxHeight: 260, objectFit: 'contain' }} /> : <div className='text-body-secondary'>Chưa có ảnh QR</div>}
          </div>
        </CCol>
      </CRow>

      <div className='d-flex justify-content-end gap-2 flex-wrap'>
        <CButton type='button' color='secondary' variant='outline' onClick={onCancel} disabled={submitting || uploadingQr}>Hủy</CButton>
        <CButton type='submit' color='primary' disabled={submitting || uploadingQr}>{submitting ? 'Đang lưu...' : 'Lưu hồ sơ'}</CButton>
      </div>
    </CForm>
  )
}