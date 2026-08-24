import { CAlert } from '@coreui/react'

export default function ResumeStateNotice({ visible, message }) {
  if (!visible) return null
  return <CAlert color='info' className='mb-0'>{message || 'Bạn đang tiếp tục bài làm đã lưu tự động trước đó.'}</CAlert>
}