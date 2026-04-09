import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  CAlert,
  CBadge,
  CButton,
  CCard,
  CCardBody,
  CCardHeader,
  CCol,
  CContainer,
  CForm,
  CRow,
  CSpinner,
} from '@coreui/react'
import AdmissionReviewDecisionModal from '../components/AdmissionReviewDecisionModal'
import {
  getAdmissionReviewDetail,
  submitAdmissionReviewDecision,
} from '../services/admissionManagementService'
import FormRenderer from '../../../pages/admission/form-renderer/FormRenderer'
import {
  buildInitialFormData,
  extractTemplateFields,
} from '../../../pages/admission/form-renderer/schema'

function getApiMessage(error, fallback) {
  return error?.response?.data?.error?.message || error?.response?.data?.message || error?.message || fallback
}

function formatDateTime(value) {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '-'
  return date.toLocaleString('vi-VN')
}

function getReviewStatusLabel(status) {
  const normalized = String(status || '').trim().toLowerCase()
  if (normalized === 'submitted') return 'Chờ duyệt'
  if (normalized === 'returned') return 'Trả lại'
  if (normalized === 'accepted') return 'Đã tiếp nhận'
  return normalized || '-'
}

function getReviewStatusColor(status) {
  const normalized = String(status || '').trim().toLowerCase()
  if (normalized === 'submitted') return 'warning'
  if (normalized === 'returned') return 'danger'
  if (normalized === 'accepted') return 'success'
  return 'secondary'
}

export default function AdmissionReviewDetailPage() {
  const navigate = useNavigate()
  const params = useParams()
  const applicationId = String(params?.id || '').trim()

  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [detail, setDetail] = useState(null)
  const [formData, setFormData] = useState({})
  const [decisionAction, setDecisionAction] = useState('')

  const templateFields = useMemo(
    () => extractTemplateFields(detail?.campaign?.formTemplate?.schema),
    [detail?.campaign?.formTemplate?.schema],
  )

  const canReview = String(detail?.reviewStatus || '').trim().toLowerCase() === 'submitted'

  const loadDetail = useCallback(async () => {
    if (!applicationId) return

    setLoading(true)
    setError('')

    try {
      const data = await getAdmissionReviewDetail(applicationId)
      const nextFields = extractTemplateFields(data?.campaign?.formTemplate?.schema)
      setDetail(data)
      setFormData(buildInitialFormData(data, nextFields))
    } catch (requestError) {
      setDetail(null)
      setFormData({})
      setError(getApiMessage(requestError, 'Không tải được chi tiết hồ sơ tuyển sinh'))
    } finally {
      setLoading(false)
    }
  }, [applicationId])

  useEffect(() => {
    loadDetail()
  }, [loadDetail])

  async function handleDecision(payload) {
    setSubmitting(true)
    setError('')
    setSuccess('')

    try {
      await submitAdmissionReviewDecision(applicationId, payload)
      setDecisionAction('')
      setSuccess(payload.action === 'returned' ? 'Đã trả lại hồ sơ cho phụ huynh' : 'Đã tiếp nhận hồ sơ')
      await loadDetail()
    } catch (requestError) {
      setError(getApiMessage(requestError, 'Không thể cập nhật kết quả duyệt hồ sơ'))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <CContainer fluid className='py-4 px-0'>
      <CRow className='g-4'>
        <CCol xs={12}>
          <div className='d-flex justify-content-between align-items-start gap-3 flex-wrap'>
            <div>
              <div className='fw-semibold fs-4'>{detail?.studentName || 'Chi tiết hồ sơ tuyển sinh'}</div>
              <div className='text-body-secondary'>Mã hồ sơ: {detail?.applicationCode || '-'}</div>
            </div>
            <div className='d-flex gap-2 flex-wrap'>
              <CButton color='secondary' variant='outline' onClick={() => navigate('/admission/reviews')}>
                Quay lại danh sách
              </CButton>
              {canReview ? (
                <>
                  <CButton color='warning' onClick={() => setDecisionAction('returned')}>
                    Trả lại hồ sơ
                  </CButton>
                  <CButton color='success' onClick={() => setDecisionAction('accepted')}>
                    Tiếp nhận
                  </CButton>
                </>
              ) : null}
            </div>
          </div>
        </CCol>

        <CCol xs={12} lg={8}>
          <CCard className='border-0 shadow-sm'>
            <CCardHeader className='bg-white border-0 py-3'>
              <div className='d-flex justify-content-between align-items-center gap-3 flex-wrap'>
                <div>
                  <div className='fw-semibold fs-5'>Hồ sơ đã nộp</div>
                  <div className='small text-body-secondary'>Thời gian nộp: {formatDateTime(detail?.submittedAt || detail?.createdAt)}</div>
                </div>
                <CBadge color={getReviewStatusColor(detail?.reviewStatus)}>{getReviewStatusLabel(detail?.reviewStatus)}</CBadge>
              </div>
            </CCardHeader>
            <CCardBody>
              {loading ? (
                <div className='text-center py-5'>
                  <CSpinner />
                </div>
              ) : (
                <>
                  {error ? <CAlert color='danger'>{error}</CAlert> : null}
                  {success ? <CAlert color='success'>{success}</CAlert> : null}

                  {detail?.campaign ? (
                    <div className='mb-4'>
                      <div className='fw-semibold fs-5 mb-1'>{detail.campaign.name || 'Kỳ tuyển sinh'}</div>
                      <div className='text-body-secondary small mb-2'>Mã kỳ: {detail.campaign.code || '-'}</div>
                    </div>
                  ) : null}

                  {templateFields.length === 0 ? (
                    <CAlert color='warning'>FormTemplate chưa có schema.fields hoặc schema.sections để render.</CAlert>
                  ) : (
                    <CForm>
                      <FormRenderer
                        schema={detail?.campaign?.formTemplate?.schema}
                        formData={formData}
                        formErrors={{}}
                        submitting={false}
                        isReadOnly
                        onValueChange={() => {}}
                        onFileChange={() => {}}
                        onTableCellChange={() => {}}
                      />
                    </CForm>
                  )}
                </>
              )}
            </CCardBody>
          </CCard>
        </CCol>

        <CCol xs={12} lg={4}>
          <CCard className='border-0 shadow-sm mb-4'>
            <CCardHeader className='bg-white border-0 fw-semibold'>Thông tin hồ sơ</CCardHeader>
            <CCardBody>
              <div className='mb-3'><strong>Học sinh:</strong> {detail?.studentName || '-'}</div>
              <div className='mb-3'><strong>Mã hồ sơ:</strong> {detail?.applicationCode || '-'}</div>
              <div className='mb-3'><strong>Trạng thái:</strong> <CBadge color={getReviewStatusColor(detail?.reviewStatus)}>{getReviewStatusLabel(detail?.reviewStatus)}</CBadge></div>
              <div className='mb-3'><strong>Ngày nộp:</strong> {formatDateTime(detail?.submittedAt || detail?.createdAt)}</div>
              <div><strong>Phụ huynh:</strong> {detail?.parent?.fullName || detail?.parent?.username || '-'}</div>
              <div className='small text-body-secondary mt-1'>{detail?.parent?.phone || detail?.parent?.email || '-'}</div>
            </CCardBody>
          </CCard>

          <CCard className='border-0 shadow-sm'>
            <CCardHeader className='bg-white border-0 fw-semibold'>Kết quả duyệt</CCardHeader>
            <CCardBody>
              <div className='mb-3'><strong>Người duyệt:</strong> {detail?.reviewedBy?.fullName || detail?.reviewedBy?.username || '-'}</div>
              <div className='mb-3'><strong>Thời gian duyệt:</strong> {formatDateTime(detail?.reviewedAt)}</div>
              <div><strong>Ghi chú:</strong></div>
              <div className='text-body-secondary mt-1' style={{ whiteSpace: 'pre-wrap' }}>{detail?.reviewNote || '-'}</div>
            </CCardBody>
          </CCard>
        </CCol>
      </CRow>

      <AdmissionReviewDecisionModal
        visible={Boolean(decisionAction)}
        action={decisionAction}
        submitting={submitting}
        onClose={() => {
          if (submitting) return
          setDecisionAction('')
        }}
        onSubmit={handleDecision}
      />
    </CContainer>
  )
}
