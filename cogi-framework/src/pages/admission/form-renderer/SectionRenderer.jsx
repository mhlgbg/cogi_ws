import { CCard, CCardBody, CCardHeader, CRow } from '@coreui/react'
import FieldRenderer from './FieldRenderer'
import { isFieldVisible } from './schema'

export default function SectionRenderer({
  section,
  formData,
  formErrors,
  fieldOverrides,
  submitting,
  isReadOnly,
  fileNamesOnlyOnReadOnly,
  onValueChange,
  onFileChange,
  onTableCellChange,
  showCard,
}) {
  const visibleFields = section.fields.filter((field) => isFieldVisible(field, formData))

  if (visibleFields.length === 0) {
    return null
  }

  const content = (
    <CRow className='g-3'>
      {visibleFields.map((field) => (
        <FieldRenderer
          key={field.key}
          field={field}
          fieldOverride={fieldOverrides?.[field.key] || null}
          value={formData?.[field.key]}
          error={formErrors?.[field.key]}
          submitting={submitting}
          isReadOnly={isReadOnly}
          fileNamesOnlyOnReadOnly={fileNamesOnlyOnReadOnly}
          onValueChange={onValueChange}
          onFileChange={onFileChange}
          onTableCellChange={onTableCellChange}
        />
      ))}
    </CRow>
  )

  if (!showCard) {
    return content
  }

  return (
    <CCard className='border rounded-3'>
      {section.title ? <CCardHeader className='bg-white border-0 fw-semibold'>{section.title}</CCardHeader> : null}
      <CCardBody>{content}</CCardBody>
    </CCard>
  )
}