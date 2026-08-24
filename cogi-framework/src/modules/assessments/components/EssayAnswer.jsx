import { CFormTextarea } from '@coreui/react'

function countWords(text) {
  return String(text || '').trim().split(/\s+/).filter(Boolean).length
}

export default function EssayAnswer({ value, onChange, disabled, minWords, maxWords }) {
  const text = String(value?.text || '')
  const wordCount = countWords(text)
  return (
    <div className='d-grid gap-2'>
      <CFormTextarea rows={10} value={text} onChange={(event) => onChange({ text: event.target.value })} disabled={false} readOnly={disabled} placeholder='Nhập câu trả lời của bạn...' />
      <div className='assessment-runner-word-count'>
        <span>{`${wordCount} từ`}</span>
        {minWords || maxWords ? <span>{` · Yêu cầu: ${minWords || 0}${maxWords ? `–${maxWords}` : '+'} từ`}</span> : null}
      </div>
    </div>
  )
}