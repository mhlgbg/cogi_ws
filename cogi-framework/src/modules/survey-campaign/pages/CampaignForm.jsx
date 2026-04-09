import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import {
  CButton,
  CCard,
  CCardBody,
  CCardHeader,
  CCol,
  CForm,
  CFormInput,
  CFormLabel,
  CFormSelect,
  CFormTextarea,
  CRow,
  CSpinner,
} from '@coreui/react'
import {
  createSurveyCampaign,
  getSurveyCampaignDetail,
  getSurveyCampaignFormOptions,
  updateSurveyCampaign,
} from '../services/surveyCampaignService'

function getApiMessage(error, fallback) {
  return error?.response?.data?.error?.message || error?.response?.data?.message || error?.message || fallback
}

function toDateTimeLocal(value) {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  const offset = date.getTimezoneOffset()
  const localDate = new Date(date.getTime() - offset * 60000)
  return localDate.toISOString().slice(0, 16)
}

export default function CampaignForm() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const editId = searchParams.get('id')
  const isEditMode = Boolean(editId)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [templates, setTemplates] = useState([])
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    academicYear: '',
    semester: '',
    survey_template: '',
    startAt: '',
    endAt: '',
    campaignStatus: 'DRAFT',
  })

  useEffect(() => {
    let mounted = true

    async function load() {
      setLoading(true)
      setError('')

      try {
        const [options, detail] = await Promise.all([
          getSurveyCampaignFormOptions(),
          isEditMode ? getSurveyCampaignDetail(editId) : Promise.resolve(null),
        ])

        if (!mounted) return

        setTemplates(Array.isArray(options?.templates) ? options.templates : [])

        if (detail) {
          setFormData({
            name: detail?.name || '',
            description: detail?.description || '',
            academicYear: detail?.academicYear || '',
            semester: detail?.semester || '',
            survey_template: String(detail?.surveyTemplate?.id || ''),
            startAt: toDateTimeLocal(detail?.startAt),
            endAt: toDateTimeLocal(detail?.endAt),
            campaignStatus: detail?.campaignStatus || 'DRAFT',
          })
        }
      } catch (requestError) {
        if (!mounted) return
        setError(getApiMessage(requestError, 'Không thể tải dữ liệu campaign'))
      } finally {
        if (mounted) setLoading(false)
      }
    }

    load()
    return () => {
      mounted = false
    }
  }, [editId, isEditMode])

  const title = useMemo(() => (isEditMode ? 'Chỉnh sửa campaign' : 'Tạo campaign mới'), [isEditMode])

  function updateField(key, value) {
    setFormData((prev) => ({ ...prev, [key]: value }))
  }

  async function handleSubmit(event) {
    event.preventDefault()
    setSubmitting(true)
    setError('')

    try {
      const payload = {
        ...formData,
        survey_template: Number(formData.survey_template),
      }

      const response = isEditMode
        ? await updateSurveyCampaign(editId, payload)
        : await createSurveyCampaign(payload)

      navigate(`/survey/campaigns/${response.id}`)
    } catch (requestError) {
      setError(getApiMessage(requestError, 'Không thể lưu campaign'))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className='container-fluid py-4'>
      <CCard className='border-0 shadow-sm'>
        <CCardHeader className='d-flex align-items-center justify-content-between bg-white'>
          <strong>{title}</strong>
          <CButton color='light' onClick={() => navigate('/survey/campaigns')} disabled={submitting}>Quay lại</CButton>
        </CCardHeader>
        <CCardBody>
          {loading ? (
            <div className='d-flex align-items-center gap-2'>
              <CSpinner size='sm' />
              <span>Đang tải dữ liệu...</span>
            </div>
          ) : (
            <CForm onSubmit={handleSubmit}>
              {error ? <div className='alert alert-danger'>{error}</div> : null}

              <CRow className='g-3'>
                <CCol md={6}>
                  <CFormLabel htmlFor='survey-campaign-name'>Name</CFormLabel>
                  <CFormInput id='survey-campaign-name' value={formData.name} onChange={(event) => updateField('name', event.target.value)} disabled={submitting} required />
                </CCol>
                <CCol md={3}>
                  <CFormLabel htmlFor='survey-campaign-year'>Academic Year</CFormLabel>
                  <CFormInput id='survey-campaign-year' value={formData.academicYear} onChange={(event) => updateField('academicYear', event.target.value)} disabled={submitting} />
                </CCol>
                <CCol md={3}>
                  <CFormLabel htmlFor='survey-campaign-semester'>Semester</CFormLabel>
                  <CFormInput id='survey-campaign-semester' value={formData.semester} onChange={(event) => updateField('semester', event.target.value)} disabled={submitting} />
                </CCol>
                <CCol xs={12}>
                  <CFormLabel htmlFor='survey-campaign-description'>Description</CFormLabel>
                  <CFormTextarea id='survey-campaign-description' rows={4} value={formData.description} onChange={(event) => updateField('description', event.target.value)} disabled={submitting} />
                </CCol>
                <CCol md={6}>
                  <CFormLabel htmlFor='survey-campaign-template'>Survey Template</CFormLabel>
                  <CFormSelect id='survey-campaign-template' value={formData.survey_template} onChange={(event) => updateField('survey_template', event.target.value)} disabled={submitting} required>
                    <option value=''>Chọn template</option>
                    {templates.map((template) => (
                      <option key={template.id} value={template.id}>{template.name} ({template.code})</option>
                    ))}
                  </CFormSelect>
                </CCol>
                <CCol md={3}>
                  <CFormLabel htmlFor='survey-campaign-start-at'>Start At</CFormLabel>
                  <CFormInput id='survey-campaign-start-at' type='datetime-local' value={formData.startAt} onChange={(event) => updateField('startAt', event.target.value)} disabled={submitting} />
                </CCol>
                <CCol md={3}>
                  <CFormLabel htmlFor='survey-campaign-end-at'>End At</CFormLabel>
                  <CFormInput id='survey-campaign-end-at' type='datetime-local' value={formData.endAt} onChange={(event) => updateField('endAt', event.target.value)} disabled={submitting} />
                </CCol>
                <CCol md={4}>
                  <CFormLabel htmlFor='survey-campaign-status'>Campaign Status</CFormLabel>
                  <CFormSelect id='survey-campaign-status' value={formData.campaignStatus} onChange={(event) => updateField('campaignStatus', event.target.value)} disabled={submitting}>
                    <option value='DRAFT'>DRAFT</option>
                    <option value='OPEN'>OPEN</option>
                    <option value='CLOSED'>CLOSED</option>
                  </CFormSelect>
                </CCol>
              </CRow>

              <div className='d-flex justify-content-end gap-2 mt-4'>
                <CButton color='secondary' variant='outline' type='button' onClick={() => navigate('/survey/campaigns')} disabled={submitting}>Hủy</CButton>
                <CButton color='primary' type='submit' disabled={submitting}>
                  {submitting ? 'Đang lưu...' : isEditMode ? 'Cập nhật' : 'Tạo campaign'}
                </CButton>
              </div>
            </CForm>
          )}
        </CCardBody>
      </CCard>
    </div>
  )
}