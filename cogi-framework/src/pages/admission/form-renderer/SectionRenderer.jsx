import { CCard, CCardBody, CCardHeader, CRow } from '@coreui/react'
import FieldRenderer from './FieldRenderer'

export default function SectionRenderer({
  section,
  formData,
  formErrors,
  submitting,
  isReadOnly,
  onValueChange,
  onFileChange,
  onTableCellChange,
  showCard,
}) {
  const content = (
    <CRow className='g-3'>
      {section.fields.map((field) => (
        <FieldRenderer
          key={field.key}
          field={field}
          value={formData?.[field.key]}
          error={formErrors?.[field.key]}
          submitting={submitting}
          isReadOnly={isReadOnly}
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