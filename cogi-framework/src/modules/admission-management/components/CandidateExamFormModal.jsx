import { useEffect, useMemo, useState } from 'react'
import {
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

const STATUS_OPTIONS = [
  { value: 'draft', label: 'Nháp' },
  { value: 'ready', label: 'Sẵn sàng' },
  { value: 'card_downloaded', label: 'Đã tải thẻ' },
  { value: 'checked_in', label: 'Đã điểm danh' },
  { value: 'absent', label: 'Vắng' },
  { value: 'completed', label: 'Hoàn thành' },
  { value: 'cancelled', label: 'Hủy' },
]

function buildInitialState(initialValues) {
  return {
    studentCode: initialValues?.studentCode || '',
    applicationCode: initialValues?.applicationCode || '',
    lastName: initialValues?.lastName || '',
    firstName: initialValues?.firstName || '',
    fullName: initialValues?.fullName || '',
    dateOfBirth: initialValues?.dateOfBirth || '',
    gender: initialValues?.gender || '',
    primarySchool: initialValues?.primarySchool || '',
    cardImagePath: initialValues?.cardImagePath || '',
    candidateNumber: initialValues?.candidateNumber || '',
    examLocation: initialValues?.examLocation || '',
    examRoom: initialValues?.examRoom || '',
    vietnameseScore: initialValues?.vietnameseScore ?? '',
    englishScore: initialValues?.englishScore ?? '',
    mathScore: initialValues?.mathScore ?? '',
    incentiveScore: initialValues?.incentiveScore ?? 0,
    totalScore: initialValues?.totalScore ?? '',
    candidateExamStatus: initialValues?.candidateExamStatus || 'draft',
    note: initialValues?.note || '',
  }
}

function joinNameParts(lastName, firstName) {
  return [lastName, firstName]
    .map((item) => String(item || '').trim())
    .filter(Boolean)
    .join(' ')
}

function toNumberOrBlank(value) {
  if (value === null || value === undefined || value === '') return ''
  const parsed = Number(value)
  return Number.isFinite(parsed) ? String(value) : ''
}

function computeTotalScore(vietnameseScore, englishScore, mathScore, incentiveScore) {
  const values = [vietnameseScore, englishScore, mathScore, incentiveScore]
    .map((item) => String(item || '').trim())
    .filter(Boolean)
    .map((item) => Number(item))
    .filter((item) => Number.isFinite(item))

  if (values.length === 0) return ''
  const total = values.reduce((sum, value) => sum + value, 0)
  return Number.isInteger(total) ? String(total) : String(Number(total.toFixed(2)))
}

export default function CandidateExamFormModal({
  visible,
  initialValues,
  admissionSeason,
  onClose,
  onSubmit,
  submitting = false,
}) {
  const [form, setForm] = useState(buildInitialState(initialValues))
  const [manualFullName, setManualFullName] = useState(false)
  const [manualTotalScore, setManualTotalScore] = useState(false)

  useEffect(() => {
    if (!visible) return
    setForm(buildInitialState(initialValues))
    setManualFullName(false)
    setManualTotalScore(false)
  }, [initialValues, visible])

  const title = useMemo(() => (initialValues?.id ? 'Chỉnh sửa thí sinh dự kiểm tra' : 'Thêm thí sinh dự kiểm tra'), [initialValues?.id])

  function updateField(key, value) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  function updateNameField(key, value) {
    setForm((prev) => {
      const next = { ...prev, [key]: value }
      if (!manualFullName) {
        next.fullName = joinNameParts(next.lastName, next.firstName)
      }
      return next
    })
  }

  function updateScoreField(key, value) {
    setForm((prev) => {
      const next = { ...prev, [key]: value }
      if (!manualTotalScore) {
        next.totalScore = computeTotalScore(next.vietnameseScore, next.englishScore, next.mathScore, next.incentiveScore)
      }
      return next
    })
  }

  function handleSubmit(event) {
    event.preventDefault()
    onSubmit?.({
      admissionSeasonId: admissionSeason?.id,
      studentCode: String(form.studentCode || '').trim() || null,
      applicationCode: String(form.applicationCode || '').trim() || null,
      fullName: String(form.fullName || '').trim() || null,
      lastName: String(form.lastName || '').trim() || null,
      firstName: String(form.firstName || '').trim() || null,
      dateOfBirth: String(form.dateOfBirth || '').trim() || null,
      gender: String(form.gender || '').trim() || null,
      primarySchool: String(form.primarySchool || '').trim() || null,
      cardImagePath: String(form.cardImagePath || '').trim() || null,
      candidateNumber: String(form.candidateNumber || '').trim() || null,
      examLocation: String(form.examLocation || '').trim() || null,
      examRoom: String(form.examRoom || '').trim() || null,
      vietnameseScore: String(form.vietnameseScore || '').trim() || null,
      englishScore: String(form.englishScore || '').trim() || null,
      mathScore: String(form.mathScore || '').trim() || null,
      incentiveScore: String(form.incentiveScore ?? '').trim() || '0',
      totalScore: String(form.totalScore || '').trim() || null,
      candidateExamStatus: String(form.candidateExamStatus || 'draft').trim(),
      note: String(form.note || '').trim() || null,
    })
  }

  return (
    <CModal visible={visible} onClose={() => !submitting && onClose?.()} size='xl' backdrop='static'>
      <CModalHeader>
        <CModalTitle>{title}</CModalTitle>
      </CModalHeader>
      <form onSubmit={handleSubmit}>
        <CModalBody>
          <div className='small text-body-secondary mb-3'>Kỳ tuyển sinh: {admissionSeason?.name || '-'}</div>
          <CRow className='g-3'>
            <CCol md={4}>
              <CFormLabel>Mã học sinh</CFormLabel>
              <CFormInput value={form.studentCode} onChange={(event) => updateField('studentCode', event.target.value)} disabled={submitting} />
            </CCol>
            <CCol md={4}>
              <CFormLabel>Mã hồ sơ</CFormLabel>
              <CFormInput value={form.applicationCode} onChange={(event) => updateField('applicationCode', event.target.value)} disabled={submitting} />
            </CCol>
            <CCol md={4}>
              <CFormLabel>Trạng thái</CFormLabel>
              <CFormSelect value={form.candidateExamStatus} onChange={(event) => updateField('candidateExamStatus', event.target.value)} disabled={submitting}>
                {STATUS_OPTIONS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
              </CFormSelect>
            </CCol>

            <CCol md={6}>
              <CFormLabel>Họ đệm</CFormLabel>
              <CFormInput value={form.lastName} onChange={(event) => updateNameField('lastName', event.target.value)} disabled={submitting} />
            </CCol>
            <CCol md={6}>
              <CFormLabel>Tên</CFormLabel>
              <CFormInput value={form.firstName} onChange={(event) => updateNameField('firstName', event.target.value)} disabled={submitting} />
            </CCol>

            <CCol md={6}>
              <CFormLabel>Họ tên đầy đủ</CFormLabel>
              <CFormInput
                value={form.fullName}
                onChange={(event) => {
                  setManualFullName(true)
                  updateField('fullName', event.target.value)
                }}
                disabled={submitting}
              />
            </CCol>
            <CCol md={3}>
              <CFormLabel>Ngày sinh</CFormLabel>
              <CFormInput type='date' value={form.dateOfBirth} onChange={(event) => updateField('dateOfBirth', event.target.value)} disabled={submitting} />
            </CCol>
            <CCol md={3}>
              <CFormLabel>Giới tính</CFormLabel>
              <CFormSelect value={form.gender} onChange={(event) => updateField('gender', event.target.value)} disabled={submitting}>
                <option value=''>Chọn giới tính</option>
                <option value='male'>Nam</option>
                <option value='female'>Nữ</option>
                <option value='other'>Khác</option>
              </CFormSelect>
            </CCol>

            <CCol md={6}>
              <CFormLabel>Trường tiểu học</CFormLabel>
              <CFormInput value={form.primarySchool} onChange={(event) => updateField('primarySchool', event.target.value)} disabled={submitting} />
            </CCol>
            <CCol md={6}>
              <CFormLabel>Đường dẫn ảnh thẻ</CFormLabel>
              <CFormInput
                value={form.cardImagePath}
                onChange={(event) => updateField('cardImagePath', event.target.value)}
                placeholder='/uploads/... hoặc https://...'
                disabled={submitting}
              />
            </CCol>
            <CCol md={3}>
              <CFormLabel>Số báo danh</CFormLabel>
              <CFormInput value={form.candidateNumber} onChange={(event) => updateField('candidateNumber', event.target.value)} disabled={submitting} />
            </CCol>
            <CCol md={3}>
              <CFormLabel>Phòng kiểm tra</CFormLabel>
              <CFormInput value={form.examRoom} onChange={(event) => updateField('examRoom', event.target.value)} disabled={submitting} />
            </CCol>

            <CCol md={12}>
              <CFormLabel>Địa điểm kiểm tra</CFormLabel>
              <CFormInput value={form.examLocation} onChange={(event) => updateField('examLocation', event.target.value)} disabled={submitting} />
            </CCol>

            <CCol md={3}>
              <CFormLabel>Điểm Tiếng Việt</CFormLabel>
              <CFormInput value={toNumberOrBlank(form.vietnameseScore)} onChange={(event) => updateScoreField('vietnameseScore', event.target.value)} disabled={submitting} />
            </CCol>
            <CCol md={3}>
              <CFormLabel>Điểm Tiếng Anh</CFormLabel>
              <CFormInput value={toNumberOrBlank(form.englishScore)} onChange={(event) => updateScoreField('englishScore', event.target.value)} disabled={submitting} />
            </CCol>
            <CCol md={3}>
              <CFormLabel>Điểm Toán</CFormLabel>
              <CFormInput type='number' step='0.01' value={toNumberOrBlank(form.mathScore)} onChange={(event) => updateScoreField('mathScore', event.target.value)} disabled={submitting} />
            </CCol>
            <CCol md={3}>
              <CFormLabel>Điểm khuyến khích</CFormLabel>
              <CFormInput type='number' step='0.01' value={toNumberOrBlank(form.incentiveScore)} onChange={(event) => updateScoreField('incentiveScore', event.target.value)} disabled={submitting} />
            </CCol>
            <CCol md={3}>
              <CFormLabel>Tổng điểm</CFormLabel>
              <CFormInput
                type='number'
                step='0.01'
                value={toNumberOrBlank(form.totalScore)}
                onChange={(event) => {
                  setManualTotalScore(true)
                  updateField('totalScore', event.target.value)
                }}
                disabled={submitting}
              />
            </CCol>

            <CCol xs={12}>
              <CFormLabel>Ghi chú</CFormLabel>
              <CFormTextarea rows={4} value={form.note} onChange={(event) => updateField('note', event.target.value)} disabled={submitting} />
            </CCol>
          </CRow>
        </CModalBody>
        <CModalFooter>
          <CButton color='secondary' variant='outline' onClick={onClose} disabled={submitting}>Hủy</CButton>
          <CButton color='primary' type='submit' disabled={submitting}>{submitting ? 'Đang lưu...' : 'Lưu'}</CButton>
        </CModalFooter>
      </form>
    </CModal>
  )
}