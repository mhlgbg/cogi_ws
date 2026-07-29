import { useEffect } from 'react'
import {
  CButton,
  CForm,
  CFormInput,
  CFormLabel,
} from '@coreui/react'

export default function QuickMessagePinForm({
  value = '',
  error = '',
  loading = false,
  inputRef,
  onChange,
  onSubmit,
}) {
  useEffect(() => {
    if (inputRef?.current) {
      inputRef.current.focus()
    }
  }, [inputRef])

  return (
    <CForm onSubmit={onSubmit} className='border rounded-4 p-4 bg-white shadow-sm'>
      <div className='fw-semibold fs-5 mb-2'>Thông điệp được bảo vệ bằng PIN</div>
      <div className='text-body-secondary mb-3'>Nhập PIN do người gửi cung cấp.</div>

      <div className='mb-3'>
        <CFormLabel htmlFor='quick-message-public-pin'>PIN</CFormLabel>
        <CFormInput
          id='quick-message-public-pin'
          ref={inputRef}
          type='password'
          inputMode='numeric'
          autoComplete='one-time-code'
          aria-invalid={Boolean(error)}
          value={value}
          onChange={(event) => onChange?.(event.target.value)}
          placeholder='Nhập 4-6 chữ số'
          disabled={loading}
        />
        {error ? <div className='text-danger small mt-1'>{error}</div> : null}
      </div>

      <CButton type='submit' color='primary' disabled={loading}>
        {loading ? 'Đang xác minh...' : 'Xem thông điệp'}
      </CButton>
    </CForm>
  )
}