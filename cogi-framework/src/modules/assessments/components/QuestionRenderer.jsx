import { CAlert, CFormCheck, CFormInput, CFormSelect } from '@coreui/react'
import AnswerOptionRenderer from './AnswerOptionRenderer'
import EssayAnswer from './EssayAnswer'

function normalizeSelectedIds(value) {
  return Array.isArray(value?.selectedOptionIds) ? value.selectedOptionIds.map((item) => String(item || '')) : []
}

function shouldRenderSharedChoiceSelect(item, question) {
  if (String(question?.type || '').trim() !== 'single_choice') return false
  const renderMode = String(item?.config?.renderMode || '').trim()
  if (renderMode === 'shared_choice_select') return true

  const stimulusType = String(question?.stimulus?.type || '').trim()
  if (stimulusType === 'choice_set') return true

  const options = Array.isArray(question?.options) ? question.options : []
  const allLabelsAreSimple = options.length >= 4 && options.every((option) => {
    const label = String(option?.label || '').trim()
    const value = String(option?.value || '').trim()
    const content = String(option?.content || '').trim()
    return label.length > 0 && label === value && content === ''
  })

  const hasSharedStimulus = Boolean(question?.stimulus?.id || question?.stimulus?.documentId || question?.stimulus?.code)
  return hasSharedStimulus && allLabelsAreSimple
}

export default function QuestionRenderer({ item, value, disabled, onChange }) {
  const question = item?.question || {}
  const options = Array.isArray(question?.options) ? question.options : []
  const type = String(question?.type || '').trim()

  if (type === 'single_choice' || type === 'true_false') {
    const selectedIds = normalizeSelectedIds(value)
    if (shouldRenderSharedChoiceSelect(item, question)) {
      return (
        <div className='assessment-runner-shared-choice-select-wrap'>
          <CFormSelect
            className='assessment-runner-shared-choice-select'
            value={selectedIds[0] || ''}
            disabled={disabled}
            onChange={(event) => onChange({ selectedOptionIds: event.target.value ? [event.target.value] : [] })}
          >
            <option value=''>Chọn đáp án</option>
            {options.map((option) => {
              const optionId = option?.id || option?.documentId
              return <option key={optionId || option?.label} value={optionId || ''}>{option?.label || option?.value || '-'}</option>
            })}
          </CFormSelect>
        </div>
      )
    }
    return (
      <div className='assessment-runner-option-list'>
        {options.map((option) => {
          const optionId = option?.id || option?.documentId
          const selected = selectedIds.includes(String(optionId || ''))
          return <AnswerOptionRenderer key={optionId || option?.label} option={option} selected={selected} onSelect={() => onChange({ selectedOptionIds: [optionId] })} disabled={disabled} />
        })}
      </div>
    )
  }

  if (type === 'multiple_choice') {
    const selectedIds = normalizeSelectedIds(value)
    return (
      <div className='assessment-runner-option-list'>
        {options.map((option) => {
          const optionId = option?.id || option?.documentId
          const selected = selectedIds.includes(String(optionId || ''))
          return <AnswerOptionRenderer key={optionId || option?.label} option={option} selected={selected} onSelect={() => onChange({ selectedOptionIds: selected ? selectedIds.filter((item) => item !== String(optionId || '')) : [...selectedIds, optionId] })} disabled={disabled} multiSelect />
        })}
      </div>
    )
  }

  if (type === 'short_answer') {
    return <CFormInput value={String(value?.text || '')} onChange={(event) => onChange({ text: event.target.value })} disabled={false} readOnly={disabled} placeholder='Nhập câu trả lời ngắn...' />
  }

  if (type === 'essay') {
    return <EssayAnswer value={value || { text: '' }} onChange={onChange} disabled={disabled} minWords={item?.minWords} maxWords={item?.maxWords} />
  }

  if (type === 'fill_blank') {
    return <CFormInput value={String(value?.text || '')} onChange={(event) => onChange({ text: event.target.value })} disabled={false} readOnly={disabled} placeholder='Nhập câu trả lời điền khuyết...' />
  }

  return <CAlert color='warning' className='mb-0'>{`Runner hiện chưa hỗ trợ loại câu hỏi: ${type || 'unknown'}`}</CAlert>
}