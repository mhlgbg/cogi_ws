import { CFormCheck, CFormInput, CFormTextarea } from '@coreui/react'

function toArray(value) {
  return Array.isArray(value) ? value : []
}

function toText(value) {
  if (value === null || value === undefined) return ''
  return String(value)
}

export default function QuestionRenderer({ question, value, onChange }) {
  if (!question) return null

  if (question.type === 'single_choice') {
    return (
      <div className='assessment-question-options'>
        {(question.options || []).map((option) => (
          <label key={option.value} className='assessment-selectable'>
            <input className='assessment-selectable-input' type='radio' name={question.id} checked={value === option.value} onChange={() => onChange(option.value)} />
            <div className={`assessment-selectable-card${value === option.value ? ' active' : ''}`}>
              <div className='assessment-selectable-title'>{option.label}</div>
            </div>
          </label>
        ))}
      </div>
    )
  }

  if (question.type === 'multiple_choice') {
    const values = toArray(value)
    return (
      <div className='assessment-question-options'>
        {(question.options || []).map((option) => {
          const checked = values.includes(option.value)
          return (
            <label key={option.value} className='assessment-selectable'>
              <input
                className='assessment-selectable-input'
                type='checkbox'
                checked={checked}
                onChange={() => {
                  if (checked) onChange(values.filter((item) => item !== option.value))
                  else onChange([...values, option.value])
                }}
              />
              <div className={`assessment-selectable-card${checked ? ' active' : ''}`}>
                <div className='assessment-selectable-title'>{option.label}</div>
              </div>
            </label>
          )
        })}
      </div>
    )
  }

  if (question.type === 'short_text') {
    return <CFormInput value={toText(value)} onChange={(event) => onChange(event.target.value)} placeholder={question.placeholder || ''} />
  }

  if (question.type === 'long_text') {
    return <CFormTextarea rows={10} value={toText(value)} onChange={(event) => onChange(event.target.value)} placeholder={question.placeholder || ''} />
  }

  return null
}
