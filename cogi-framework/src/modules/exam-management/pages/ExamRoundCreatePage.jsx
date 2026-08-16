import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
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
  CFormSelect,
  CRow,
} from '@coreui/react'
import ExamErrorAlert from '../components/ExamErrorAlert'
import { createExamRound, getExamProgramsLookup } from '../services/examRoundApi'
import {
  buildExamRoundPath,
  buildExamRoundsPath,
  getApiMessage,
  getExamErrorCode,
  getExamErrorDetails,
} from '../utils/examRoundUi'

function emptyForm() {
  return {
    examProgramId: '',
    code: '',
    name: '',
    academicYear: '',
    semester: '',
    registrationMode: 'restricted',
    registrationStartAt: '',
    registrationEndAt: '',
    paymentStartAt: '',
    paymentEndAt: '',
    examStartAt: '',
    examEndAt: '',
    paymentCalculationMethod: 'program_fee',
    fixedFee: '',
    allowSubjectSelection: false,
    allowComponentSelection: false,
    requireConfirmedPayment: true,
  }
}

function toIso(value) {
  return value ? new Date(value).toISOString() : null
}

export default function ExamRoundCreatePage() {
  const navigate = useNavigate()
  const { tenantCode } = useParams()
  const [loadingPrograms, setLoadingPrograms] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [examPrograms, setExamPrograms] = useState([])
  const [form, setForm] = useState(emptyForm())
  const [error, setError] = useState('')
  const [errorCode, setErrorCode] = useState('')
  const [errorDetails, setErrorDetails] = useState([])
  const selectedProgram = Array.isArray(examPrograms)
    ? examPrograms.find((item) => String(item.id) === String(form.examProgramId)) || null
    : null

  useEffect(() => {
    let mounted = true
    async function load() {
      setLoadingPrograms(true)
      try {
        const rows = await getExamProgramsLookup('')
        if (mounted) setExamPrograms(Array.isArray(rows) ? rows : [])
      } catch {
        if (mounted) setExamPrograms([])
      } finally {
        if (mounted) setLoadingPrograms(false)
      }
    }
    load()
    return () => { mounted = false }
  }, [])

  function updateField(key, value) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  function validateForm() {
    if (!String(form.examProgramId).trim()) return 'Bạn cần chọn chương trình thi.'
    if (!String(form.code).trim()) return 'Bạn cần nhập mã đợt thi.'
    if (!String(form.name).trim()) return 'Bạn cần nhập tên đợt thi.'
    if (!String(form.registrationStartAt).trim() || !String(form.registrationEndAt).trim()) return 'Bạn cần nhập đủ thời gian mở và đóng đăng ký.'
    if (form.registrationStartAt && form.registrationEndAt && new Date(form.registrationStartAt).getTime() >= new Date(form.registrationEndAt).getTime()) {
      return 'Thời gian bắt đầu đăng ký phải trước thời gian kết thúc đăng ký.'
    }
    if ((form.paymentStartAt && !form.paymentEndAt) || (!form.paymentStartAt && form.paymentEndAt)) {
      return 'Nếu nhập thời gian thanh toán, bạn cần nhập đủ cả ngày bắt đầu và kết thúc.'
    }
    if (form.paymentStartAt && form.paymentEndAt && new Date(form.paymentStartAt).getTime() > new Date(form.paymentEndAt).getTime()) {
      return 'Thời gian bắt đầu thanh toán không được sau thời gian kết thúc thanh toán.'
    }
    if (form.examStartAt && form.examEndAt && new Date(form.examStartAt).getTime() >= new Date(form.examEndAt).getTime()) {
      return 'Thời gian bắt đầu thi phải trước thời gian kết thúc thi.'
    }
    if (form.paymentCalculationMethod === 'fixed' && !String(form.fixedFee).trim()) {
      return 'Bạn cần nhập phí cố định khi chọn phương thức phí cố định.'
    }
    return ''
  }

  async function handleSubmit(event) {
    event.preventDefault()
    const validationError = validateForm()
    if (validationError) {
      setError(validationError)
      setErrorCode('')
      setErrorDetails([])
      return
    }

    setSubmitting(true)
    setError('')
    setErrorCode('')
    setErrorDetails([])

    try {
      const payload = {
        examProgramId: Number(form.examProgramId),
        code: String(form.code).trim(),
        name: String(form.name).trim(),
        academicYear: String(form.academicYear || '').trim() || null,
        semester: String(form.semester || '').trim() || null,
        registrationMode: form.registrationMode,
        registrationStartAt: toIso(form.registrationStartAt),
        registrationEndAt: toIso(form.registrationEndAt),
        paymentStartAt: toIso(form.paymentStartAt),
        paymentEndAt: toIso(form.paymentEndAt),
        examStartAt: toIso(form.examStartAt),
        examEndAt: toIso(form.examEndAt),
        paymentCalculationMethod: form.paymentCalculationMethod,
        fixedFee: form.paymentCalculationMethod === 'fixed' ? String(form.fixedFee || '').trim() : null,
        allowSubjectSelection: form.allowSubjectSelection,
        allowComponentSelection: form.allowComponentSelection,
        requireConfirmedPayment: form.requireConfirmedPayment,
      }
      const result = await createExamRound(payload)
      navigate(buildExamRoundPath(result?.examRound?.id, 'overview', tenantCode), {
        state: { message: 'Tạo đợt thi thành công.' },
      })
    } catch (requestError) {
      setError(getApiMessage(requestError, 'Không thể tạo đợt thi.'))
      setErrorCode(getExamErrorCode(requestError))
      setErrorDetails(getExamErrorDetails(requestError))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <CContainer fluid className='py-4'>
      <div className='d-flex justify-content-between align-items-start gap-3 flex-wrap mb-3'>
        <div>
          <div className='fs-4 fw-semibold'>Tạo đợt thi chuẩn đầu ra</div>
          <div className='text-body-secondary'>Khởi tạo đợt thi từ chương trình thi hiện có và chuyển sang trang chi tiết để tiếp tục cấu hình.</div>
        </div>
        <CButton color='secondary' variant='outline' onClick={() => navigate(buildExamRoundsPath(tenantCode))}>Quay lại danh sách</CButton>
      </div>

      <CAlert color='info'>Đợt thi sẽ sao chép cấu trúc môn và kỹ năng từ chương trình thành snapshot riêng. Các thay đổi chương trình sau này không tự động cập nhật đợt thi.</CAlert>

      {error && !errorDetails.length ? <CAlert color='danger'>{error}</CAlert> : null}
      <ExamErrorAlert message={errorDetails.length ? error : ''} code={errorCode} details={errorDetails} />

      <CCard>
        <CCardHeader><strong>Thông tin đợt thi</strong></CCardHeader>
        <CCardBody>
          <CForm onSubmit={handleSubmit}>
            <CRow className='g-3'>
              <CCol lg={6}>
                <CFormLabel>Chương trình thi</CFormLabel>
                <CFormSelect value={form.examProgramId} onChange={(event) => updateField('examProgramId', event.target.value)} disabled={loadingPrograms || submitting}>
                  <option value=''>{loadingPrograms ? 'Đang tải...' : 'Chọn chương trình thi'}</option>
                  {examPrograms.map((item) => <option key={item.id} value={item.id}>{item.code ? `[${item.code}] ` : ''}{item.name}</option>)}
                </CFormSelect>
              </CCol>
              <CCol lg={3}>
                <CFormLabel>Mã đợt</CFormLabel>
                <CFormInput value={form.code} onChange={(event) => updateField('code', event.target.value)} disabled={submitting} />
              </CCol>
              <CCol lg={3}>
                <CFormLabel>Năm học</CFormLabel>
                <CFormInput value={form.academicYear} onChange={(event) => updateField('academicYear', event.target.value)} disabled={submitting} placeholder='2026-2027' />
              </CCol>
              <CCol lg={8}>
                <CFormLabel>Tên đợt</CFormLabel>
                <CFormInput value={form.name} onChange={(event) => updateField('name', event.target.value)} disabled={submitting} />
              </CCol>
              <CCol lg={4}>
                <CFormLabel>Học kỳ</CFormLabel>
                <CFormInput value={form.semester} onChange={(event) => updateField('semester', event.target.value)} disabled={submitting} placeholder='1' />
              </CCol>
              <CCol lg={3}>
                <CFormLabel>Chế độ đăng ký</CFormLabel>
                <CFormSelect value={form.registrationMode} onChange={(event) => updateField('registrationMode', event.target.value)} disabled={submitting}>
                  <option value='open'>Mở</option>
                  <option value='restricted'>Có điều kiện</option>
                </CFormSelect>
              </CCol>
              <CCol lg={3}>
                <CFormLabel>Phương thức tính phí</CFormLabel>
                <CFormSelect value={form.paymentCalculationMethod} onChange={(event) => updateField('paymentCalculationMethod', event.target.value)} disabled={submitting}>
                  <option value='program_fee'>Phí chương trình</option>
                  <option value='subject_fee'>Phí theo môn</option>
                  <option value='component_fee'>Phí theo kỹ năng/phần thi</option>
                  <option value='fixed'>Phí cố định</option>
                </CFormSelect>
              </CCol>
              <CCol lg={3}>
                <CFormLabel>Phí cố định</CFormLabel>
                <CFormInput value={form.fixedFee} onChange={(event) => updateField('fixedFee', event.target.value)} disabled={submitting || form.paymentCalculationMethod !== 'fixed'} placeholder='200000' />
              </CCol>
              <CCol lg={3} className='d-flex align-items-end'>
                <CFormCheck label='Yêu cầu xác nhận thanh toán' checked={form.requireConfirmedPayment} onChange={(event) => updateField('requireConfirmedPayment', event.target.checked)} disabled={submitting} />
              </CCol>
              <CCol lg={3} className='d-flex align-items-end'>
                <CFormCheck label='Cho phép learner chọn môn' checked={form.allowSubjectSelection} onChange={(event) => updateField('allowSubjectSelection', event.target.checked)} disabled={submitting} />
              </CCol>
              <CCol lg={3} className='d-flex align-items-end'>
                <CFormCheck label='Cho phép learner chọn kỹ năng' checked={form.allowComponentSelection} onChange={(event) => updateField('allowComponentSelection', event.target.checked)} disabled={submitting} />
              </CCol>
              <CCol md={6}>
                <CFormLabel>Bắt đầu đăng ký</CFormLabel>
                <CFormInput type='datetime-local' value={form.registrationStartAt} onChange={(event) => updateField('registrationStartAt', event.target.value)} disabled={submitting} />
              </CCol>
              <CCol md={6}>
                <CFormLabel>Kết thúc đăng ký</CFormLabel>
                <CFormInput type='datetime-local' value={form.registrationEndAt} onChange={(event) => updateField('registrationEndAt', event.target.value)} disabled={submitting} />
              </CCol>
              <CCol md={6}>
                <CFormLabel>Bắt đầu thanh toán</CFormLabel>
                <CFormInput type='datetime-local' value={form.paymentStartAt} onChange={(event) => updateField('paymentStartAt', event.target.value)} disabled={submitting} />
              </CCol>
              <CCol md={6}>
                <CFormLabel>Kết thúc thanh toán</CFormLabel>
                <CFormInput type='datetime-local' value={form.paymentEndAt} onChange={(event) => updateField('paymentEndAt', event.target.value)} disabled={submitting} />
              </CCol>
              <CCol md={6}>
                <CFormLabel>Bắt đầu thi</CFormLabel>
                <CFormInput type='datetime-local' value={form.examStartAt} onChange={(event) => updateField('examStartAt', event.target.value)} disabled={submitting} />
              </CCol>
              <CCol md={6}>
                <CFormLabel>Kết thúc thi</CFormLabel>
                <CFormInput type='datetime-local' value={form.examEndAt} onChange={(event) => updateField('examEndAt', event.target.value)} disabled={submitting} />
              </CCol>
              {selectedProgram ? (
                <CCol xs={12}>
                  <div className='border rounded p-3 bg-body-tertiary'>
                    <div className='fw-semibold mb-2'>Tóm tắt chương trình nguồn</div>
                    <div>Mã/Tên: {selectedProgram.code ? `[${selectedProgram.code}] ` : ''}{selectedProgram.name || '-'}</div>
                    <div>Phương thức lệ phí: {selectedProgram.feeCalculationMethod || '-'}</div>
                    <div>Phí mặc định: {selectedProgram.defaultFee !== null && selectedProgram.defaultFee !== undefined && selectedProgram.defaultFee !== '' ? selectedProgram.defaultFee : '-'}</div>
                  </div>
                </CCol>
              ) : null}
            </CRow>

            <div className='d-flex gap-2 mt-4'>
              <CButton color='primary' type='submit' disabled={submitting}>{submitting ? 'Đang tạo...' : 'Tạo đợt thi'}</CButton>
              <CButton color='secondary' variant='outline' type='button' disabled={submitting} onClick={() => navigate(buildExamRoundsPath(tenantCode))}>Hủy</CButton>
            </div>
          </CForm>
        </CCardBody>
      </CCard>
    </CContainer>
  )
}