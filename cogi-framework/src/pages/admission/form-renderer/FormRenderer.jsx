import SectionRenderer from './SectionRenderer'
import { extractTemplateSections } from './schema'

export default function FormRenderer({
  schema,
  formData,
  formErrors,
  submitting,
  isReadOnly,
  onValueChange,
  onFileChange,
  onTableCellChange,
}) {
  const sections = extractTemplateSections(schema)
  const isSectionMode = Array.isArray(schema?.sections) && schema.sections.length > 0

  return sections.map((section, index) => (
    <div key={section.key || index} className={index > 0 ? 'mt-4' : ''}>
      <SectionRenderer
        section={section}
        formData={formData}
        formErrors={formErrors}
        submitting={submitting}
        isReadOnly={isReadOnly}
        onValueChange={onValueChange}
        onFileChange={onFileChange}
        onTableCellChange={onTableCellChange}
        showCard={isSectionMode}
      />
    </div>
  ))
}