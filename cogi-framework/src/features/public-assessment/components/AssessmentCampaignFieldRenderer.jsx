import { CFormCheck, CFormInput, CFormSelect, CFormTextarea } from '@coreui/react'
import { normalizeCampaignFieldOptions } from '../utils/assessmentCampaignFlow'

function toText(value) {
  if (value === null || value === undefined) return ''
  return String(value).trim()
}

function getOptionGridClassName(count, variant) {
  if (variant !== 'result-completion') return 'd-flex flex-column gap-2'
  if (count >= 5) return 'assessment-option-grid assessment-option-grid--cards-3 assessment-option-grid--compact'
  return 'assessment-option-grid assessment-option-grid--cards-2 assessment-option-grid--compact'
}

export default function AssessmentCampaignFieldRenderer({ field, value, onChange, registerFieldRef, variant = 'default', error = '' }) {
  const key = String(field?.key || '').trim()
  const type = String(field?.fieldType || '').trim().toLowerCase()
  const options = normalizeCampaignFieldOptions(field)
  const placeholder = field?.placeholder || 'Chọn giá trị'
  const controlClassName = variant === 'result-completion'
    ? `assessment-result-completion-control${error ? ' is-invalid' : ''}`
    : error ? 'is-invalid' : ''

  if (type === 'textarea') {
    return <CFormTextarea rows={4} className={controlClassName} value={value || ''} onChange={(event) => onChange(key, event.target.value)} ref={(node) => registerFieldRef?.(key, node)} />
  }

  if (type === 'select') {
    return (
      <CFormSelect className={controlClassName} value={value ?? ''} onChange={(event) => onChange(key, event.target.value)} ref={(node) => registerFieldRef?.(key, node)}>
        <option value=''>{placeholder}</option>
        {options.map((option, index) => <option key={`${key}-${index}`} value={option.value}>{option.label}</option>)}
      </CFormSelect>
    )
  }

  if (type === 'radio') {
    return (
      <div className={getOptionGridClassName(options.length, variant)}>
        {options.map((option, index) => {
          const checked = String(value ?? '') === String(option.value)
          return (
            <label key={`${key}-${index}`} className='assessment-selectable'>
              <input
                type='radio'
                name={key}
                className='assessment-selectable-input'
                checked={checked}
                onChange={() => onChange(key, option.value)}
                ref={(node) => {
                  if (index === 0) registerFieldRef?.(key, node)
                }}
              />
              <span className={`assessment-selectable-card compact assessment-choice-card${checked ? ' active' : ''}${error ? ' assessment-choice-card--error' : ''}`}>
                <span className='assessment-choice-card__indicator'>{checked ? '◉' : '○'}</span>
                <span className='assessment-choice-card__label'>{option.label}</span>
              </span>
            </label>
          )
        })}
      </div>
    )
  }

  if (type === 'checkbox') {
    const currentValues = Array.isArray(value) ? value : []
    return (
      <div className={getOptionGridClassName(options.length, variant)}>
        {options.map((option, index) => {
          const checked = currentValues.some((item) => String(item) === String(option.value))
          return (
            <label key={`${key}-${index}`} className='assessment-selectable'>
              <input
                type='checkbox'
                className='assessment-selectable-input'
                checked={checked}
                onChange={(event) => {
                  const nextValues = event.target.checked
                    ? [...currentValues, option.value]
                    : currentValues.filter((item) => String(item) !== String(option.value))
                  onChange(key, nextValues)
                }}
                ref={(node) => {
                  if (index === 0) registerFieldRef?.(key, node)
                }}
              />
              <span className={`assessment-selectable-card compact assessment-choice-card${checked ? ' active' : ''}${error ? ' assessment-choice-card--error' : ''}`}>
                <span className='assessment-choice-card__indicator'>{checked ? '✓' : '□'}</span>
                <span className='assessment-choice-card__label'>{option.label}</span>
              </span>
            </label>
          )
        })}
      </div>
    )
  }

  const inputType = type === 'email' ? 'email' : type === 'phone' ? 'tel' : type === 'number' ? 'number' : type === 'date' ? 'date' : 'text'
  return <CFormInput className={controlClassName} type={inputType} value={value ?? ''} onChange={(event) => onChange(key, inputType === 'number' ? event.target.value : event.target.value)} placeholder={toText(field?.placeholder)} ref={(node) => registerFieldRef?.(key, node)} />
}
