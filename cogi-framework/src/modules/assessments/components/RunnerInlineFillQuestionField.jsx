import { CFormInput } from '@coreui/react'
import QuestionRenderer from './QuestionRenderer'

function joinClassNames(...values) {
  return values.filter(Boolean).join(' ')
}

export default function RunnerInlineFillQuestionField({ entry, value, disabled, answered = false, saveState = null, onChange, onFocus, registerField }) {
  const question = entry?.question || {}
  const type = String(question?.type || '').trim()
  const currentValue = String(value?.text || '')
  const widthCh = Math.max(10, Math.min(24, currentValue.length + 4))
  const questionCode = question?.code || question?.title || 'question'
  const status = saveState?.status || 'saved'

  const field = (type === 'short_answer' || type === 'fill_blank')
    ? (
      <CFormInput
        value={currentValue}
        onChange={(event) => onChange?.({ text: event.target.value })}
        disabled={false}
        readOnly={disabled}
        placeholder={questionCode}
        aria-label={questionCode}
        onFocus={onFocus}
        className='assessment-inline-fill-field__input'
        style={{ width: `${widthCh}ch` }}
      />
      )
    : (
      <div className='assessment-inline-fill-field__block' onFocusCapture={onFocus}>
        <QuestionRenderer item={entry} value={value} disabled={disabled} onChange={onChange} />
      </div>
      )

  return (
    <span
      ref={registerField}
      className={joinClassNames(
        'assessment-inline-fill-field',
        answered ? 'is-answered' : '',
        disabled ? 'is-disabled' : '',
        status === 'saving' ? 'is-saving' : '',
        status === 'error' ? 'is-error' : '',
      )}
      data-question-code={questionCode}
      title={status === 'saving' ? 'Đang lưu...' : status === 'error' ? (saveState?.message || 'Lỗi lưu') : questionCode}
    >
      {field}
    </span>
  )
}