import { CAlert, CFormCheck, CFormInput } from '@coreui/react'
import AnswerOptionRenderer from './AnswerOptionRenderer'
import EssayAnswer from './EssayAnswer'

function normalizeSelectedIds(value) {
  return Array.isArray(value?.selectedOptionIds) ? value.selectedOptionIds.map((item) => String(item || '')) : []
}

export default function QuestionRenderer({ item, value, disabled, onChange }) {
  const question = item?.question || {}
  const options = Array.isArray(question?.options) ? question.options : []
  const type = String(question?.type || '').trim()

  if (type === 'single_choice' || type === 'true_false') {
    const selectedIds = normalizeSelectedIds(value)
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