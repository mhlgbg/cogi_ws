import { useEffect, useMemo, useState } from 'react'
import {
  CAlert,
  CButton,
  CForm,
  CFormInput,
  CModal,
  CModalBody,
  CModalFooter,
  CModalHeader,
  CModalTitle,
} from '@coreui/react'
import FormRenderer from '../../../pages/admission/form-renderer/FormRenderer'
import {
  buildInitialFormData,
  extractTemplateFields,
  validateFieldValue,
  validateFormData,
} from '../../../pages/admission/form-renderer/schema'

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

function readStringValue(formData, key) {
  const value = formData?.[key]
  if (value === null || value === undefined || typeof value === 'object') return ''
  return String(value).trim()
}

function normalizeDateForApi(value) {
  const text = String(value || '').trim()
  if (!text) return ''

  const isoMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text)
  if (isoMatch) {
    return `${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}`
  }

  const localMatch = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(text)
  if (!localMatch) return text

  const day = Number(localMatch[1])
  const month = Number(localMatch[2])
  const year = Number(localMatch[3])
  const normalized = new Date(Date.UTC(year, month - 1, day))

  if (
    Number.isNaN(normalized.getTime())
    || normalized.getUTCFullYear() !== year
    || normalized.getUTCMonth() + 1 !== month
    || normalized.getUTCDate() !== day
  ) {
    return text
  }

  return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

function normalizeFormDateFields(formData, fields) {
  const nextFormData = { ...(formData || {}) }

  ;(fields || []).forEach((field) => {
    if (!field?.key) return

    if (field.type === 'date') {
      nextFormData[field.key] = normalizeDateForApi(nextFormData[field.key])
      return
    }

    if (field.type !== 'table' || !Array.isArray(field.columns)) return

    const tableValue = Array.isArray(nextFormData[field.key]) ? nextFormData[field.key] : []
    nextFormData[field.key] = tableValue.map((row) => {
      if (!row || typeof row !== 'object') return row

      const nextRow = { ...row }
      field.columns.forEach((column) => {
        if (column?.type === 'date' && column.key) {
          nextRow[column.key] = normalizeDateForApi(nextRow[column.key])
        }
      })
      return nextRow
    })
  })

  return nextFormData
}

function ensureAdmissionDefaults(formData, detail) {
  const nextFormData = { ...(formData || {}) }
  if (!readStringValue(nextFormData, 'studentName')) {
    nextFormData.studentName = detail?.studentName || ''
  }
  if (!readStringValue(nextFormData, 'dob')) {
    nextFormData.dob = String(detail?.dob || '').slice(0, 10)
  }
  if (!readStringValue(nextFormData, 'studentCode')) {
    nextFormData.studentCode = detail?.studentCode || ''
  }
  if (!readStringValue(nextFormData, 'gender')) {
    nextFormData.gender = detail?.gender || ''
  }
  if (!readStringValue(nextFormData, 'currentSchool')) {
    nextFormData.currentSchool = detail?.currentSchool || ''
  }
  if (!readStringValue(nextFormData, 'address')) {
    nextFormData.address = detail?.address || ''
  }
  return nextFormData
}

function buildSubmissionPayload(studentCode, formData, templateFields, detail) {
  const normalizedFormData = normalizeFormDateFields(formData, templateFields)
  return {
    studentCode: String(studentCode || '').trim(),
    studentName: readStringValue(normalizedFormData, 'studentName') || detail?.studentName || '',
    dob: normalizeDateForApi(readStringValue(normalizedFormData, 'dob')) || normalizeDateForApi(detail?.dob || ''),
    gender: readStringValue(normalizedFormData, 'gender') || detail?.gender || null,
    currentSchool: readStringValue(normalizedFormData, 'currentSchool') || detail?.currentSchool || '',
    address: readStringValue(normalizedFormData, 'address') || detail?.address || '',
    formData: normalizedFormData,
  }
}

export default function AdmissionReviewEditApplicationModal({
  visible,
  detail,
  saving,
  onClose,
  onSubmit,
}) {
  const templateFields = useMemo(
    () => extractTemplateFields(detail?.campaign?.formTemplate?.schema),
    [detail?.campaign?.formTemplate?.schema],
  )

  const [studentCode, setStudentCode] = useState('')
  const [formData, setFormData] = useState({})
  const [formErrors, setFormErrors] = useState({})
  const [errorMessage, setErrorMessage] = useState('')

  useEffect(() => {
    if (!visible) return

    const initial = ensureAdmissionDefaults(buildInitialFormData(detail, templateFields), detail)
    setStudentCode(String(detail?.studentCode || initial?.studentCode || '').trim())
    setFormData(initial)
    setFormErrors({})
    setErrorMessage('')
  }, [detail, templateFields, visible])

  function updateFormValue(key, value) {
    const field = templateFields.find((item) => item.key === key)
    const nextFormData = {
      ...formData,
      [key]: value,
    }
    const nextFieldError = validateFieldValue(field, value, nextFormData)

    setFormData(nextFormData)
    setFormErrors((current) => {
      const next = { ...current }
      if (nextFieldError) {
        next[key] = nextFieldError
      } else {
        delete next[key]
      }
      return next
    })
    if (errorMessage) setErrorMessage('')
  }

  async function handleFileChange(field, event) {
    try {
      const serialized = await toSerializableFiles(event.target.files, field.multiple === true)
      updateFormValue(field.key, serialized)
    } catch (error) {
      setErrorMessage(error?.message || 'Không thể đọc file tải lên')
    } finally {
      event.target.value = ''
    }
  }

  function handleTableCellChange(fieldKey, rowIndex, columnKey, cellValue) {
    const tableField = templateFields.find((item) => item.key === fieldKey && item.type === 'table')

    setFormData((current) => {
      const currentTableValue = Array.isArray(current?.[fieldKey]) ? current[fieldKey] : []
      const nextTableValue = currentTableValue.map((row, index) => (
        index === rowIndex ? { ...row, [columnKey]: cellValue } : row
      ))
      const nextFormData = {
        ...current,
        [fieldKey]: nextTableValue,
      }
      const nextTableError = validateFieldValue(tableField, nextTableValue, nextFormData)

      setFormErrors((currentErrors) => {
        const nextErrors = { ...currentErrors }
        if (nextTableError) {
          nextErrors[fieldKey] = nextTableError
        } else {
          delete nextErrors[fieldKey]
        }
        return nextErrors
      })

      return nextFormData
    })

    if (errorMessage) setErrorMessage('')
  }

  async function handleSubmit() {
    const nextStudentCode = String(studentCode || '').trim().toUpperCase()
    if (!nextStudentCode) {
      setErrorMessage('Vui lòng nhập mã học sinh')
      return
    }

    const nextErrors = validateFormData(formData, templateFields)
    if (Object.keys(nextErrors).length > 0) {
      setFormErrors(nextErrors)
      setErrorMessage('Vui lòng kiểm tra lại các trường được đánh dấu')
      return
    }

    setErrorMessage('')
    await onSubmit(buildSubmissionPayload(nextStudentCode, formData, templateFields, detail))
  }

  return (
    <CModal visible={visible} onClose={saving ? undefined : onClose} size='xl' scrollable>
      <CModalHeader closeButton={!saving}>
        <CModalTitle>Chỉnh sửa hồ sơ tuyển sinh</CModalTitle>
      </CModalHeader>
      <CModalBody>
        {errorMessage ? <CAlert color='danger'>{errorMessage}</CAlert> : null}

        <CForm>
          <div className='mb-3'>
            <label className='form-label fw-semibold'>Mã học sinh</label>
            <CFormInput
              value={studentCode}
              onChange={(event) => {
                setStudentCode(String(event.target.value || '').toUpperCase())
                if (errorMessage) setErrorMessage('')
              }}
              placeholder='Nhập mã học sinh'
              disabled={saving}
            />
          </div>

          {templateFields.length === 0 ? (
            <CAlert color='warning' className='mb-0'>FormTemplate chưa có schema.fields hoặc schema.sections để chỉnh sửa.</CAlert>
          ) : (
            <FormRenderer
              schema={detail?.campaign?.formTemplate?.schema}
              formData={formData}
              formErrors={formErrors}
              submitting={saving}
              isReadOnly={false}
              onValueChange={updateFormValue}
              onFileChange={handleFileChange}
              onTableCellChange={handleTableCellChange}
            />
          )}
        </CForm>
      </CModalBody>
      <CModalFooter>
        <CButton color='secondary' variant='outline' onClick={onClose} disabled={saving}>Đóng</CButton>
        <CButton color='primary' onClick={handleSubmit} disabled={saving}>Lưu hồ sơ</CButton>
      </CModalFooter>
    </CModal>
  )
}