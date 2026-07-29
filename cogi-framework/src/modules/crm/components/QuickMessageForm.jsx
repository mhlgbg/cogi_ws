import { useEffect, useMemo, useState } from 'react'
import {
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
  CRow,
} from '@coreui/react'
import QuickMessageLinksEditor from './QuickMessageLinksEditor'
import {
  buildQuickMessageFormInitialValues,
  buildQuickMessagePayload,
  QUICK_MESSAGE_CREATE_STATUS_OPTIONS,
  QUICK_MESSAGE_REPLY_MODE_OPTIONS,
  validateQuickMessageForm,
} from './quickMessageUi'

export default function QuickMessageForm({
  mode = 'create',
  initialValues,
  disabled = false,
  submitting = false,
  submitLabel = 'Lưu',
  errorMessage = '',
  onCancel,
  onSubmit,
}) {
  const includeInitialAccess = mode === 'create'
  const [form, setForm] = useState(() => buildQuickMessageFormInitialValues(initialValues, { includeInitialAccess }))
  const [errors, setErrors] = useState({})

  useEffect(() => {
    setForm(buildQuickMessageFormInitialValues(initialValues, { includeInitialAccess }))
    setErrors({})
  }, [includeInitialAccess, initialValues])

  const titleLength = useMemo(() => String(form?.title || '').trim().length, [form?.title])

  function updateField(key, value) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  function updateInitialAccess(key, value) {
    setForm((prev) => ({
      ...prev,
      initialAccess: {
        ...(prev.initialAccess || {}),
        [key]: value,
      },
    }))
  }

  async function handleSubmit(event) {
    event.preventDefault()
    const nextErrors = validateQuickMessageForm(form, { includeInitialAccess })
    setErrors(nextErrors)
    if (Object.keys(nextErrors).length > 0) return
    await onSubmit?.(buildQuickMessagePayload(form, { includeInitialAccess, includeStatus: mode === 'create' }))
  }

  return (
    <CForm onSubmit={handleSubmit}>
      <CRow className='g-4'>
        <CCol lg={8}>
          <CCard className='border-0 shadow-sm'>
            <CCardHeader><strong>Nội dung thông điệp</strong></CCardHeader>
            <CCardBody>
              <div className='mb-3'>
                <div className='d-flex justify-content-between align-items-center'>
                  <CFormLabel htmlFor='quick-message-title'>Tiêu đề</CFormLabel>
                  <span className='small text-body-secondary'>{titleLength}/200</span>
                </div>
                <CFormInput
                  id='quick-message-title'
                  placeholder='Ví dụ: Tài liệu cuộc họp'
                  value={form.title}
                  onChange={(event) => updateField('title', event.target.value)}
                  disabled={disabled || submitting}
                  maxLength={200}
                />
                {errors.title ? <div className='text-danger small mt-1'>{errors.title}</div> : null}
              </div>

              <div className='mb-3'>
                <CFormLabel htmlFor='quick-message-content'>Nội dung</CFormLabel>
                <CFormTextarea
                  id='quick-message-content'
                  rows={6}
                  placeholder='Nhập hướng dẫn hoặc nội dung cần gửi...'
                  value={form.content}
                  onChange={(event) => updateField('content', event.target.value)}
                  disabled={disabled || submitting}
                />
              </div>

              <QuickMessageLinksEditor
                value={form.links}
                errors={errors}
                disabled={disabled || submitting}
                onChange={(nextValue) => updateField('links', nextValue)}
              />
            </CCardBody>
          </CCard>
        </CCol>

        <CCol lg={4}>
          <CCard className='border-0 shadow-sm mb-4'>
            <CCardHeader><strong>Thiết lập ban đầu</strong></CCardHeader>
            <CCardBody>
              {mode === 'create' ? (
                <div className='mb-3'>
                  <CFormLabel htmlFor='quick-message-status'>Trạng thái ban đầu</CFormLabel>
                  <CFormSelect
                    id='quick-message-status'
                    value={form.status}
                    onChange={(event) => updateField('status', event.target.value)}
                    disabled={disabled || submitting}
                  >
                    {QUICK_MESSAGE_CREATE_STATUS_OPTIONS.map((item) => (
                      <option key={item.value} value={item.value}>{item.label}</option>
                    ))}
                  </CFormSelect>
                </div>
              ) : null}

              <div className='mb-3'>
                <CFormLabel htmlFor='quick-message-expires-at'>Thời gian hết hạn</CFormLabel>
                <CFormInput
                  id='quick-message-expires-at'
                  type='datetime-local'
                  value={form.expiresAt}
                  onChange={(event) => updateField('expiresAt', event.target.value)}
                  disabled={disabled || submitting}
                />
                <div className='small text-body-secondary mt-1'>Sau thời điểm này, tất cả mã truy cập của thông điệp sẽ không còn sử dụng được.</div>
                {errors.expiresAt ? <div className='text-danger small mt-1'>{errors.expiresAt}</div> : null}
              </div>

              <div className='mb-3'>
                <CFormCheck
                  id='quick-message-allow-reply'
                  label='Cho phép người nhận phản hồi'
                  checked={form.allowReply === true}
                  onChange={(event) => updateField('allowReply', event.target.checked)}
                  disabled={disabled || submitting}
                />
              </div>

              {form.allowReply ? (
                <div className='mb-0'>
                  <CFormLabel htmlFor='quick-message-reply-mode'>Kiểu phản hồi</CFormLabel>
                  <CFormSelect
                    id='quick-message-reply-mode'
                    value={form.replyMode}
                    onChange={(event) => updateField('replyMode', event.target.value)}
                    disabled={disabled || submitting}
                  >
                    {QUICK_MESSAGE_REPLY_MODE_OPTIONS.map((item) => (
                      <option key={item.value} value={item.value}>{item.label}</option>
                    ))}
                  </CFormSelect>
                </div>
              ) : null}
            </CCardBody>
          </CCard>

          {includeInitialAccess ? (
            <CCard className='border-0 shadow-sm'>
              <CCardHeader><strong>Mã truy cập đầu tiên</strong></CCardHeader>
              <CCardBody>
                <div className='small text-body-secondary mb-3'>Hệ thống sẽ tự sinh mã truy cập. Bạn có thể tạo thêm và quản lý PIN sau khi tạo thông điệp.</div>

                <div className='mb-3'>
                  <CFormLabel htmlFor='quick-message-access-label'>Nhãn mã truy cập</CFormLabel>
                  <CFormInput
                    id='quick-message-access-label'
                    placeholder='Ví dụ: Gửi cô Lan'
                    value={form.initialAccess?.label || ''}
                    onChange={(event) => updateInitialAccess('label', event.target.value)}
                    disabled={disabled || submitting}
                  />
                </div>

                <div className='mb-3'>
                  <CFormLabel htmlFor='quick-message-access-recipient'>Người nhận dự kiến</CFormLabel>
                  <CFormInput
                    id='quick-message-access-recipient'
                    placeholder='Ví dụ: Cô Lan'
                    value={form.initialAccess?.recipientName || ''}
                    onChange={(event) => updateInitialAccess('recipientName', event.target.value)}
                    disabled={disabled || submitting}
                  />
                </div>

                <div className='mb-3'>
                  <CFormCheck
                    id='quick-message-access-pin-required'
                    label='Yêu cầu PIN'
                    checked={form.initialAccess?.requirePin === true}
                    onChange={(event) => updateInitialAccess('requirePin', event.target.checked)}
                    disabled={disabled || submitting}
                  />
                </div>

                {form.initialAccess?.requirePin ? (
                  <>
                    <div className='mb-3'>
                      <CFormLabel htmlFor='quick-message-access-pin'>PIN</CFormLabel>
                      <CFormInput
                        id='quick-message-access-pin'
                        type='password'
                        inputMode='numeric'
                        placeholder='4-6 chữ số'
                        value={form.initialAccess?.pin || ''}
                        onChange={(event) => updateInitialAccess('pin', event.target.value)}
                        disabled={disabled || submitting}
                      />
                      {errors.initialAccessPin ? <div className='text-danger small mt-1'>{errors.initialAccessPin}</div> : null}
                    </div>

                    <div className='mb-0'>
                      <CFormLabel htmlFor='quick-message-access-pin-confirm'>Nhập lại PIN</CFormLabel>
                      <CFormInput
                        id='quick-message-access-pin-confirm'
                        type='password'
                        inputMode='numeric'
                        placeholder='Nhập lại PIN'
                        value={form.initialAccess?.pinConfirm || ''}
                        onChange={(event) => updateInitialAccess('pinConfirm', event.target.value)}
                        disabled={disabled || submitting}
                      />
                      {errors.initialAccessPinConfirm ? <div className='text-danger small mt-1'>{errors.initialAccessPinConfirm}</div> : null}
                    </div>
                  </>
                ) : null}
              </CCardBody>
            </CCard>
          ) : null}
        </CCol>
      </CRow>

      {errorMessage ? <div className='alert alert-danger mt-4 mb-0'>{errorMessage}</div> : null}

      <div className='d-flex justify-content-end gap-2 mt-4'>
        {typeof onCancel === 'function' ? <CButton color='secondary' variant='outline' onClick={onCancel} disabled={submitting}>Hủy</CButton> : null}
        <CButton type='submit' color='primary' disabled={disabled || submitting}>{submitting ? 'Đang xử lý...' : submitLabel}</CButton>
      </div>
    </CForm>
  )
}