import { useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import {
  CAlert,
  CButton,
  CCard,
  CCardBody,
  CCardHeader,
  CCol,
  CContainer,
  CForm,
  CFormCheck,
  CFormInput,
  CFormLabel,
  CRow,
  CSpinner,
} from '@coreui/react'
import { createLearnerProfileForExamRound, getLearnerProfileContext, normalizeCurrentLearnerApiMessage } from '../services/learnerExamApi'
import { formatDateTime } from '../utils/examRoundUi'
import { getLearnerExamReasonLabel } from '../utils/learnerExamUi'

function emptyForm() {
  return {
    code: '',
    fullName: '',
    dateOfBirth: '',
    phone: '',
    email: '',
    confirmed: false,
  }
}

function toText(value) {
  if (value === null || value === undefined) return ''
  return String(value).trim()
}

function isValidEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || '').trim())
}

function isValidDateOfBirth(value) {
  if (!value) return false
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return false
  return date.getTime() <= Date.now()
}

export default function LearnerExamRegisterProfilePlaceholderPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const { id, tenantCode } = useParams()
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [context, setContext] = useState(null)
  const [error, setError] = useState('')
  const [formError, setFormError] = useState('')
  const [fieldErrors, setFieldErrors] = useState({})
  const [form, setForm] = useState(emptyForm())

  const detailPath = tenantCode ? `/t/${encodeURIComponent(tenantCode)}/learner/exams/${id}` : `/learner/exams/${id}`
  const registerPath = tenantCode ? `/t/${encodeURIComponent(tenantCode)}/learner/exams/${id}/register` : `/learner/exams/${id}/register`
  const reasonLabel = useMemo(() => getLearnerExamReasonLabel(context?.reasonCode), [context?.reasonCode])

  useEffect(() => {
    let mounted = true
    async function load() {
      setLoading(true)
      setError('')
      try {
        const result = await getLearnerProfileContext(id)
        if (!mounted) return
        setContext(result || null)
        setForm({
          code: '',
          fullName: result?.userProfile?.displayName || '',
          dateOfBirth: '',
          phone: result?.userProfile?.phone || '',
          email: result?.userProfile?.email || '',
          confirmed: false,
        })

        if (result?.learner && result?.canContinueRegistration) {
          navigate(registerPath, {
            replace: true,
            state: { message: 'Tài khoản đã được liên kết với hồ sơ người học. Bạn có thể tiếp tục đăng ký.' },
          })
        }
      } catch (requestError) {
        if (!mounted) return
        setContext(null)
        setError(normalizeCurrentLearnerApiMessage(requestError, 'Không tải được ngữ cảnh tạo hồ sơ người học.'))
      } finally {
        if (mounted) setLoading(false)
      }
    }
    load()
    return () => { mounted = false }
  }, [id, navigate, registerPath])

  function updateField(key, value) {
    setForm((current) => ({ ...current, [key]: value }))
    setFieldErrors((current) => {
      if (!current[key]) return current
      const next = { ...current }
      delete next[key]
      return next
    })
    if (formError) setFormError('')
  }

  function validateForm() {
    const nextErrors = {}
    if (!toText(form.code)) nextErrors.code = 'Mã người học là bắt buộc.'
    if (!toText(form.fullName)) nextErrors.fullName = 'Họ và tên là bắt buộc.'
    if (!isValidDateOfBirth(form.dateOfBirth)) nextErrors.dateOfBirth = 'Ngày sinh không hợp lệ.'
    if (!toText(form.phone)) nextErrors.phone = 'Số điện thoại là bắt buộc.'
    if (!isValidEmail(form.email)) nextErrors.email = 'Email không hợp lệ.'
    if (!form.confirmed) nextErrors.confirmed = 'Bạn cần xác nhận thông tin trước khi tiếp tục.'
    return nextErrors
  }

  async function handleSubmit(event) {
    event.preventDefault()
    const nextErrors = validateForm()
    setFieldErrors(nextErrors)
    if (Object.keys(nextErrors).length > 0) return

    setSubmitting(true)
    setFormError('')
    try {
      const result = await createLearnerProfileForExamRound(id, {
        code: toText(form.code),
        fullName: toText(form.fullName),
        dateOfBirth: form.dateOfBirth,
        phone: toText(form.phone),
        email: toText(form.email).toLowerCase(),
      })

      navigate(registerPath, {
        replace: true,
        state: {
          message: result?.messageCode === 'LEARNER_ALREADY_LINKED_TO_USER'
            ? 'Tài khoản đã được liên kết với hồ sơ người học. Bạn có thể tiếp tục đăng ký.'
            : 'Đã tạo và liên kết hồ sơ người học với tài khoản.',
        },
      })
    } catch (requestError) {
      const code = String(requestError?.response?.data?.code || '')
      setFormError(normalizeCurrentLearnerApiMessage(requestError, 'Không thể tạo hồ sơ người học.'))
      setFieldErrors({
        ...(code === 'INVALID_LEARNER_CODE' ? { code: 'Mã người học không hợp lệ.' } : {}),
        ...(code === 'INVALID_DATE_OF_BIRTH' ? { dateOfBirth: 'Ngày sinh không hợp lệ.' } : {}),
        ...(code === 'INVALID_PHONE' ? { phone: 'Số điện thoại không hợp lệ.' } : {}),
        ...(code === 'INVALID_EMAIL' ? { email: 'Email không hợp lệ.' } : {}),
      })
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return <CContainer fluid className='py-4'><div className='d-flex align-items-center gap-2'><CSpinner size='sm' />Đang tải ngữ cảnh đăng ký...</div></CContainer>
  }

  if (!context) {
    return (
      <CContainer fluid className='py-4'>
        <CAlert color='danger'>{error || 'Không tải được ngữ cảnh tạo hồ sơ người học.'}</CAlert>
        <CButton color='secondary' variant='outline' onClick={() => navigate(detailPath)}>Quay lại chi tiết đợt thi</CButton>
      </CContainer>
    )
  }

  if (context?.learner && !context?.canContinueRegistration) {
    return (
      <CContainer fluid className='py-4'>
        <CCard>
          <CCardHeader><strong>Thông tin người học</strong></CCardHeader>
          <CCardBody>
            <CAlert color='warning'>{reasonLabel || 'Tài khoản đã có hồ sơ người học nhưng hiện chưa thể tiếp tục đăng ký đợt thi này.'}</CAlert>
            <CButton color='secondary' variant='outline' onClick={() => navigate(detailPath)}>Quay lại chi tiết đợt thi</CButton>
          </CCardBody>
        </CCard>
      </CContainer>
    )
  }

  if (!context?.canCreateLearnerForRound) {
    return (
      <CContainer fluid className='py-4'>
        <CCard>
          <CCardHeader><strong>Thông tin người học</strong></CCardHeader>
          <CCardBody>
            <CAlert color='warning'>{reasonLabel || 'Đợt thi này hiện không cho phép tạo hồ sơ người học để tiếp tục đăng ký.'}</CAlert>
            <div className='border rounded p-3 bg-body-tertiary mb-3'>
              <div className='fw-semibold mb-2'>{context?.support?.organizationName || 'Đơn vị quản lý'}</div>
              <div>Số điện thoại: {context?.support?.supportPhone || 'Chưa có thông tin'}</div>
              <div>Email: {context?.support?.supportEmail || 'Chưa có thông tin'}</div>
              <div>Website: {context?.support?.supportWebsite || 'Chưa có thông tin'}</div>
              <div className='mt-2 small text-body-secondary'>{context?.support?.supportNote || 'Vui lòng liên hệ nhà trường để được hỗ trợ.'}</div>
            </div>
            <CButton color='secondary' variant='outline' onClick={() => navigate(detailPath)}>Quay lại chi tiết đợt thi</CButton>
          </CCardBody>
        </CCard>
      </CContainer>
    )
  }

  return (
    <CContainer fluid className='py-4'>
      <div className='d-flex justify-content-between align-items-start gap-3 flex-wrap mb-4'>
        <div>
          <div className='fs-4 fw-semibold'>Thông tin người học</div>
          <div className='text-body-secondary'>Để đăng ký đợt thi này, vui lòng cung cấp thông tin người học. Hồ sơ người học sẽ được liên kết với tài khoản đang đăng nhập.</div>
        </div>
        <CButton color='secondary' variant='outline' onClick={() => navigate(detailPath)}>Quay lại chi tiết đợt thi</CButton>
      </div>

      <CCard className='mb-4'>
        <CCardHeader><strong>Ngữ cảnh đợt thi</strong></CCardHeader>
        <CCardBody>
          <div className='fw-semibold'>{context?.examRound?.code || '-'} - {context?.examRound?.name || '-'}</div>
          <div className='small text-body-secondary mt-1'>Thời gian đăng ký: {formatDateTime(context?.examRound?.registrationStartAt)} - {formatDateTime(context?.examRound?.registrationEndAt)}</div>
        </CCardBody>
      </CCard>

      {formError ? <CAlert color='danger'>{formError}</CAlert> : null}
      {location.state?.message ? <CAlert color='info'>{location.state.message}</CAlert> : null}

      <CCard>
        <CCardHeader><strong>Hồ sơ người học mới</strong></CCardHeader>
        <CCardBody>
          <CForm onSubmit={handleSubmit}>
            <CRow className='g-3 mb-4'>
              <CCol md={6}>
                <CFormLabel>Tài khoản đang đăng nhập</CFormLabel>
                <CFormInput value={context?.userProfile?.displayName || ''} readOnly disabled />
              </CCol>
              <CCol md={6}>
                <CFormLabel>Email tài khoản</CFormLabel>
                <CFormInput value={form.email} readOnly disabled />
                {fieldErrors.email ? <div className='text-danger small mt-1'>{fieldErrors.email}</div> : null}
              </CCol>
            </CRow>

            <CRow className='g-3'>
              <CCol md={6}>
                <CFormLabel>Mã sinh viên/mã người học</CFormLabel>
                <CFormInput value={form.code} onChange={(event) => updateField('code', event.target.value)} disabled={submitting} invalid={Boolean(fieldErrors.code)} />
                {fieldErrors.code ? <div className='text-danger small mt-1'>{fieldErrors.code}</div> : null}
              </CCol>
              <CCol md={6}>
                <CFormLabel>Họ và tên</CFormLabel>
                <CFormInput value={form.fullName} onChange={(event) => updateField('fullName', event.target.value)} disabled={submitting} invalid={Boolean(fieldErrors.fullName)} />
                {fieldErrors.fullName ? <div className='text-danger small mt-1'>{fieldErrors.fullName}</div> : null}
              </CCol>
              <CCol md={6}>
                <CFormLabel>Ngày sinh</CFormLabel>
                <CFormInput type='date' value={form.dateOfBirth} onChange={(event) => updateField('dateOfBirth', event.target.value)} disabled={submitting} invalid={Boolean(fieldErrors.dateOfBirth)} />
                {fieldErrors.dateOfBirth ? <div className='text-danger small mt-1'>{fieldErrors.dateOfBirth}</div> : null}
              </CCol>
              <CCol md={6}>
                <CFormLabel>Số điện thoại</CFormLabel>
                <CFormInput value={form.phone} onChange={(event) => updateField('phone', event.target.value)} disabled={submitting} invalid={Boolean(fieldErrors.phone)} />
                <div className='small text-body-secondary mt-1'>Thông tin này sẽ được lưu vào trường liên hệ của hồ sơ learner hiện tại.</div>
                {fieldErrors.phone ? <div className='text-danger small mt-1'>{fieldErrors.phone}</div> : null}
              </CCol>
              <CCol xs={12}>
                <CFormCheck checked={form.confirmed} onChange={(event) => updateField('confirmed', event.target.checked)} disabled={submitting} label='Tôi xác nhận thông tin trên là chính xác và thuộc về người học sử dụng tài khoản này.' />
                {fieldErrors.confirmed ? <div className='text-danger small mt-1'>{fieldErrors.confirmed}</div> : null}
              </CCol>
            </CRow>

            <div className='border rounded p-3 bg-body-tertiary mt-4'>
              <div className='fw-semibold mb-2'>Xác nhận trước khi tạo</div>
              <div>Mã learner: {toText(form.code) || '-'}</div>
              <div>Họ tên: {toText(form.fullName) || '-'}</div>
              <div>Ngày sinh: {toText(form.dateOfBirth) || '-'}</div>
              <div>Số điện thoại: {toText(form.phone) || '-'}</div>
              <div>Email tài khoản: {toText(form.email) || '-'}</div>
            </div>

            <div className='d-flex gap-2 mt-4 flex-wrap'>
              <CButton color='primary' type='submit' disabled={submitting}>{submitting ? 'Đang tạo...' : 'Tạo hồ sơ người học và tiếp tục'}</CButton>
              <CButton color='secondary' variant='outline' type='button' disabled={submitting} onClick={() => navigate(detailPath)}>Quay lại chi tiết đợt thi</CButton>
            </div>
          </CForm>
        </CCardBody>
      </CCard>
    </CContainer>
  )
}