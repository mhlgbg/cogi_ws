import SectionRenderer from './SectionRenderer'
import { extractTemplateSections } from './schema'

export default function FormRenderer({
  schema,
  formData,
  formErrors,
  fieldOverrides,
  submitting,
  isReadOnly,
  fileNamesOnlyOnReadOnly = false,
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
        fieldOverrides={fieldOverrides}
        submitting={submitting}
        isReadOnly={isReadOnly}
        fileNamesOnlyOnReadOnly={fileNamesOnlyOnReadOnly}
        onValueChange={onValueChange}
        onFileChange={onFileChange}
        onTableCellChange={onTableCellChange}
        showCard={isSectionMode}
      />
    </div>
  ))
}