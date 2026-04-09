import {
  CCard,
  CCardBody,
  CFormCheck,
  CFormTextarea,
  CFormLabel,
} from '@coreui/react'

function parseMultiChoiceValue(value) {
  const raw = String(value || '').trim()
  if (!raw) return []
  return raw.split(',').map((item) => item.trim()).filter(Boolean)
}

export default function SurveyQuestion({
  question,
  index,
  answer,
  invalid = false,
  disabled = false,
  onChange,
}) {
  const selectedMultiValues = parseMultiChoiceValue(answer?.value)

  function handleSingleValueChange(nextValue) {
    onChange(question.id, {
      value: nextValue,
      text: '',
    })
  }

  function handleTextChange(nextText) {
    onChange(question.id, {
      value: '',
      text: nextText,
    })
  }

  function handleMultiChoiceChange(optionValue, checked) {
    const nextValues = new Set(selectedMultiValues)
    if (checked) {
      nextValues.add(optionValue)
    } else {
      nextValues.delete(optionValue)
    }

    onChange(question.id, {
      value: Array.from(nextValues).join(','),
      text: '',
    })
  }

  return (
    <CCard
      id={`survey-question-${question.id}`}
      className='mb-3'
      style={{
        borderColor: invalid ? '#dc3545' : '#dee2e6',
        boxShadow: invalid ? '0 0 0 1px rgba(220,53,69,.15)' : 'none',
      }}
    >
      <CCardBody>
        <div className='d-flex gap-2 align-items-start mb-3'>
          <div
            className='fw-semibold text-primary'
            style={{ minWidth: 28 }}
          >
            {index}.
          </div>
          <div className='flex-grow-1'>
            <div className='fw-semibold mb-1'>{question.content}</div>
            {question.isRequired ? <div className='text-danger small'>Bắt buộc</div> : null}
          </div>
        </div>

        {(question.type === 'LIKERT_1_5' || question.type === 'SINGLE_CHOICE') ? (
          <div className='d-grid gap-2'>
            {(question.options || []).map((option) => (
              <CFormCheck
                key={option.id || option.value}
                type='radio'
                name={`survey-question-${question.id}`}
                id={`survey-question-${question.id}-option-${option.id || option.value}`}
                label={option.label}
                checked={String(answer?.value || '') === String(option.value || '')}
                disabled={disabled}
                onChange={() => handleSingleValueChange(String(option.value || ''))}
              />
            ))}
          </div>
        ) : null}

        {question.type === 'MULTI_CHOICE' ? (
          <div className='d-grid gap-2'>
            {(question.options || []).map((option) => {
              const optionValue = String(option.value || '')
              return (
                <CFormCheck
                  key={option.id || optionValue}
                  id={`survey-question-${question.id}-option-${option.id || optionValue}`}
                  label={option.label}
                  checked={selectedMultiValues.includes(optionValue)}
                  disabled={disabled}
                  onChange={(event) => handleMultiChoiceChange(optionValue, event.target.checked)}
                />
              )
            })}
          </div>
        ) : null}

        {question.type === 'TEXT' ? (
          <div>
            <CFormLabel htmlFor={`survey-question-${question.id}-text`} className='small text-medium-emphasis'>Câu trả lời</CFormLabel>
            <CFormTextarea
              id={`survey-question-${question.id}-text`}
              rows={4}
              value={answer?.text || ''}
              disabled={disabled}
              onChange={(event) => handleTextChange(event.target.value)}
              placeholder='Nhập câu trả lời của bạn'
            />
          </div>
        ) : null}
      </CCardBody>
    </CCard>
  )
}