import { useMemo, useState } from 'react'
import {
  CAlert,
  CButton,
  CCard,
  CCardBody,
  CCardHeader,
  CForm,
} from '@coreui/react'
import FormRenderer from '../../pages/admission/form-renderer/FormRenderer'
import {
  buildInitialFormData,
  extractTemplateFields,
  validateFormData,
} from '../../pages/admission/form-renderer/schema'
import { submitPublicLeadCampaign } from '../../modules/content-management/services/publicPageService'

function getApiMessage(error, fallback) {
  return error?.response?.data?.error?.message || error?.response?.data?.message || error?.message || fallback
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

async function toSerializableFiles(fileList, multiple) {
  const files = Array.from(fileList || []).filter((file) => file instanceof File)
  if (files.length === 0) {
    return multiple ? [] : null
  }

  const serializedFiles = await Promise.all(files.map((file) => toSerializableFile(file)))
  const normalizedFiles = serializedFiles.filter(Boolean)
  return multiple ? normalizedFiles : normalizedFiles[0] || null
}

export default function PublicLeadForm({
  campaign,
  formTemplate,
  successMessage,
  cardClassName = 'mb-4',
}) {
  const [submitting, setSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const [localSuccessMessage, setLocalSuccessMessage] = useState('')
  const [formErrors, setFormErrors] = useState({})

  const formFields = useMemo(
    () => extractTemplateFields(formTemplate?.schema),
    [formTemplate?.schema],
  )

  const [formData, setFormData] = useState(() => buildInitialFormData(null, formFields))

  const buttonLabel = String(campaign?.submitButtonText || 'Đăng ký').trim() || 'Đăng ký'

  if (!formTemplate) {
    return null
  }

  function updateFormValue(key, value) {
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
  }

  async function handleFileChange(field, event) {
    try {
      const serializedFile = await toSerializableFiles(event.target.files, field.multiple === true)
      updateFormValue(field.key, serializedFile)
    } catch (error) {
      setErrorMessage(error?.message || 'Không thể đọc file tải lên')
    } finally {
      event.target.value = ''
    }
  }

  function handleTableCellChange(fieldKey, rowIndex, columnKey, cellValue) {
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
  }

  async function handleSubmit(event) {
    event.preventDefault()
    if (!campaign?.code) return

    const validationErrors = validateFormData(formData, formFields)
    setFormErrors(validationErrors)
    if (Object.keys(validationErrors).length > 0) {
      setErrorMessage('Vui lòng kiểm tra lại thông tin trong biểu mẫu')
      return
    }

    setSubmitting(true)
    setErrorMessage('')
    setLocalSuccessMessage('')

    try {
      const payload = await submitPublicLeadCampaign(campaign.code, formData)
      setLocalSuccessMessage(payload?.message || successMessage || 'Đăng ký thành công. Chúng tôi sẽ liên hệ lại trong thời gian sớm nhất.')
      setFormErrors({})
      setFormData(buildInitialFormData(null, formFields))
    } catch (error) {
      setErrorMessage(getApiMessage(error, 'Không thể gửi biểu mẫu'))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <CCard className={cardClassName}>
      <CCardHeader>
        <strong>{buttonLabel}</strong>
      </CCardHeader>
      <CCardBody>
        {errorMessage ? <CAlert color='danger'>{errorMessage}</CAlert> : null}
        {localSuccessMessage ? <CAlert color='success'>{localSuccessMessage}</CAlert> : null}
        {formFields.length === 0 ? (
          <CAlert color='warning' className='mb-0'>FormTemplate đã được gắn nhưng chưa có schema.fields hoặc schema.sections để render.</CAlert>
        ) : null}
        {formFields.length > 0 ? (
          <CForm onSubmit={handleSubmit}>
            <FormRenderer
              schema={formTemplate?.schema}
              formData={formData}
              formErrors={formErrors}
              submitting={submitting}
              isReadOnly={false}
              onValueChange={updateFormValue}
              onFileChange={handleFileChange}
              onTableCellChange={handleTableCellChange}
            />
            <div className='mt-4 d-flex justify-content-end'>
              <CButton color='primary' type='submit' disabled={submitting}>
                {submitting ? 'Đang gửi...' : buttonLabel}
              </CButton>
            </div>
          </CForm>
        ) : null}
      </CCardBody>
    </CCard>
  )
}
