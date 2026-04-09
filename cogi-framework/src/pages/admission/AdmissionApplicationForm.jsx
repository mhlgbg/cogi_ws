import { useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import {
  CAlert,
  CButton,
  CCard,
  CCardBody,
  CCardHeader,
  CContainer,
  CForm,
  CSpinner,
} from '@coreui/react'
import api from '../../api/axios'
import FormRenderer from './form-renderer/FormRenderer'
import {
  buildInitialFormData,
  extractTemplateFields,
  validateFormData,
} from './form-renderer/schema'

function unwrapRows(payload) {
  if (Array.isArray(payload?.data)) return payload.data
  if (Array.isArray(payload)) return payload
  return []
}

function hasHtmlContent(value) {
  return /<[^>]+>/.test(String(value || ''))
}

function toSerializableFile(file) {
  return new Promise((resolve, reject) => {
    if (!(file instanceof File)) {
      resolve(null)
      return
    }

    const reader = new FileReader()
    reader.onload = () => {
      resolve({
        name: file.name,
        type: file.type,
        size: file.size,
        dataUrl: typeof reader.result === 'string' ? reader.result : '',
      })
    }
    reader.onerror = () => reject(new Error('Không thể đọc file tải lên'))
    reader.readAsDataURL(file)
  })
}

function readStringValue(formData, key) {
  const value = formData?.[key]
  if (value === null || value === undefined || typeof value === 'object') return ''
  return String(value).trim()
}

function buildSubmissionPayload(formData, submissionMode, campaignCode) {
  return {
    campaignCode,
    submissionMode,
    studentName: readStringValue(formData, 'studentName'),
    dob: readStringValue(formData, 'dob'),
    gender: readStringValue(formData, 'gender') || null,
    currentSchool: readStringValue(formData, 'currentSchool'),
    address: readStringValue(formData, 'address'),
    formData,
  }
}

function isEditableStatus(status) {
  const normalized = String(status || '').trim().toLowerCase()
  return normalized === 'draft' || normalized === 'rejected'
}

export default function AdmissionApplicationForm() {
  const navigate = useNavigate()
  const location = useLocation()
  const params = useParams()
  const applicationId = String(params?.id || '').trim()
  const campaignCode = String(params?.campaignCode || '').trim()
  const isEditMode = Boolean(applicationId)
  const isViewRoute = String(location?.pathname || '').endsWith('/view')

  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const [successMessage, setSuccessMessage] = useState('')
  const [campaign, setCampaign] = useState(null)
  const [applicationDetail, setApplicationDetail] = useState(null)
  const [formData, setFormData] = useState({})
  const [formErrors, setFormErrors] = useState({})

  const templateFields = useMemo(
    () => extractTemplateFields(campaign?.formTemplate?.schema),
    [campaign?.formTemplate?.schema],
  )

  const isReadOnly = isViewRoute || (isEditMode && applicationDetail && !isEditableStatus(applicationDetail.status))

  useEffect(() => {
    let isCancelled = false

    async function loadFormContext() {
      setLoading(true)
      setErrorMessage('')
      setSuccessMessage('')

      try {
        if (isEditMode) {
          const response = await api.get(`/admission-applications/me/${encodeURIComponent(applicationId)}/detail`)
          if (isCancelled) return

          const detail = response?.data?.data || null
          const nextCampaign = detail?.campaign || null
          const nextFields = extractTemplateFields(nextCampaign?.formTemplate?.schema)

          setApplicationDetail(detail)
          setCampaign(nextCampaign)
          setFormData(buildInitialFormData(detail, nextFields))
          return
        }

        const response = await api.get('/admission-campaigns', {
          params: {
            status: 'open',
          },
        })
        if (isCancelled) return

        const rows = unwrapRows(response?.data)
        const matchedCampaign = rows.find((item) => String(item?.code || '').trim() === campaignCode)
        if (!matchedCampaign) {
          throw new Error('Không tìm thấy kỳ tuyển sinh đang mở')
        }

        const nextFields = extractTemplateFields(matchedCampaign?.formTemplate?.schema)
        setApplicationDetail(null)
        setCampaign(matchedCampaign)
        setFormData(buildInitialFormData(null, nextFields))
      } catch (error) {
        if (isCancelled) return

        const apiMessage =
          error?.response?.data?.error?.message ||
          error?.response?.data?.message ||
          error?.message ||
          'Không thể tải form hồ sơ tuyển sinh'

        setErrorMessage(apiMessage)
      } finally {
        if (!isCancelled) {
          setLoading(false)
        }
      }
    }

    loadFormContext()

    return () => {
      isCancelled = true
    }
  }, [applicationId, campaignCode, isEditMode])

  function updateFormValue(key, value) {
    if (isReadOnly) return

    setFormData((current) => ({
      ...current,
      [key]: value,
    }))

    setFormErrors((current) => {
      if (!current[key]) return current
      const next = { ...current }
      delete next[key]
      return next
    })

    if (errorMessage) setErrorMessage('')
    if (successMessage) setSuccessMessage('')
  }

  async function handleFileChange(field, event) {
    if (isReadOnly) return

    const file = event.target.files?.[0] || null

    try {
      const serializedFile = await toSerializableFile(file)
      updateFormValue(field.key, serializedFile)
    } catch (error) {
      setErrorMessage(error?.message || 'Không thể đọc file tải lên')
    }
  }

  function handleTableCellChange(fieldKey, rowIndex, columnKey, cellValue) {
    if (isReadOnly) return

    setFormData((current) => {
      const currentTableValue = Array.isArray(current?.[fieldKey]) ? current[fieldKey] : []
      const nextTableValue = currentTableValue.map((row, index) => (
        index === rowIndex ? { ...row, [columnKey]: cellValue } : row
      ))

      return {
        ...current,
        [fieldKey]: nextTableValue,
      }
    })

    setFormErrors((current) => {
      if (!current[fieldKey]) return current
      const next = { ...current }
      delete next[fieldKey]
      return next
    })

    if (errorMessage) setErrorMessage('')
    if (successMessage) setSuccessMessage('')
  }

  async function submitForm(submissionMode) {
    if (isReadOnly) return

    const nextErrors = validateFormData(formData, templateFields)
    if (Object.keys(nextErrors).length > 0) {
      setFormErrors(nextErrors)
      setErrorMessage('Vui lòng nhập đầy đủ các trường bắt buộc')
      return
    }

    setSubmitting(true)
    setErrorMessage('')
    setSuccessMessage('')

    try {
      const payload = buildSubmissionPayload(formData, submissionMode, campaignCode)

      let response
      if (isEditMode) {
        response = await api.put(`/admission-applications/me/${encodeURIComponent(applicationId)}`, payload)
      } else {
        response = await api.post('/admission-applications/me', payload)
      }

      const saved = response?.data?.data || null
      const nextCampaign = saved?.campaign || campaign
      const nextFields = extractTemplateFields(nextCampaign?.formTemplate?.schema)

      setCampaign(nextCampaign)
      setFormData(buildInitialFormData(saved, nextFields))
      setFormErrors({})
      setSuccessMessage(submissionMode === 'submitted' ? 'Đã nộp hồ sơ tuyển sinh' : 'Đã lưu nháp hồ sơ tuyển sinh')

      if (!isEditMode && saved?.id) {
        navigate(`/admission/applications/${encodeURIComponent(String(saved.id))}/edit`, { replace: true })
      }
    } catch (error) {
      const apiMessage =
        error?.response?.data?.error?.message ||
        error?.response?.data?.message ||
        error?.message ||
        'Không thể lưu hồ sơ tuyển sinh'

      setErrorMessage(apiMessage)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <CContainer fluid className='py-4 px-0'>
      <CCard className='border-0 shadow-sm'>
        <CCardHeader className='bg-white border-0 py-3'>
          <div className='fw-semibold fs-5'>
            {isReadOnly ? 'Xem hồ sơ tuyển sinh' : isEditMode ? 'Cập nhật hồ sơ tuyển sinh' : 'Khai hồ sơ tuyển sinh'}
          </div>
        </CCardHeader>
        <CCardBody>
          {loading ? (
            <div className='text-center py-5'>
              <CSpinner />
            </div>
          ) : (
            <>
              {errorMessage ? <CAlert color='danger'>{errorMessage}</CAlert> : null}
              {successMessage ? <CAlert color='success'>{successMessage}</CAlert> : null}

              {campaign ? (
                <div className='mb-4'>
                  <div className='fw-semibold fs-5 mb-1'>{campaign.name || 'Kỳ tuyển sinh'}</div>
                  <div className='text-body-secondary small mb-2'>Mã kỳ: {campaign.code || '-'}</div>
                  {applicationDetail?.applicationCode ? (
                    <div className='text-body-secondary small mb-2'>Mã hồ sơ: {applicationDetail.applicationCode}</div>
                  ) : null}
                  {campaign.description ? (
                    hasHtmlContent(campaign.description)
                      ? <div className='text-body-secondary' dangerouslySetInnerHTML={{ __html: campaign.description }} />
                      : <div className='text-body-secondary'>{campaign.description}</div>
                  ) : null}
                </div>
              ) : null}

              {templateFields.length === 0 ? (
                <CAlert color='warning'>FormTemplate chưa có schema.fields hoặc schema.sections để render.</CAlert>
              ) : (
                <CForm>
                  <FormRenderer
                    schema={campaign?.formTemplate?.schema}
                    formData={formData}
                    formErrors={formErrors}
                    submitting={submitting}
                    isReadOnly={isReadOnly}
                    onValueChange={updateFormValue}
                    onFileChange={handleFileChange}
                    onTableCellChange={handleTableCellChange}
                  />

                  <div className='d-flex gap-2 justify-content-end mt-4 flex-wrap'>
                    <CButton color='secondary' variant='outline' onClick={() => navigate('/admission/dashboard')} disabled={submitting}>
                      Quay lại
                    </CButton>
                    {!isReadOnly ? (
                      <>
                        <CButton color='secondary' onClick={() => submitForm('draft')} disabled={submitting || loading}>
                          {submitting ? 'Đang lưu...' : 'Lưu nháp'}
                        </CButton>
                        <CButton color='primary' onClick={() => submitForm('submitted')} disabled={submitting || loading}>
                          {submitting ? 'Đang gửi...' : 'Nộp hồ sơ'}
                        </CButton>
                      </>
                    ) : null}
                  </div>
                </CForm>
              )}
            </>
          )}
        </CCardBody>
      </CCard>
    </CContainer>
  )
}