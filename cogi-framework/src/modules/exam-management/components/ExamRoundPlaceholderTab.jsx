import { CCard, CCardBody } from '@coreui/react'

export default function ExamRoundPlaceholderTab({ title }) {
  return (
    <CCard>
      <CCardBody>
        <div className='fw-semibold mb-2'>{title}</div>
        <div className='text-body-secondary'>Chức năng sẽ được triển khai ở bước tiếp theo.</div>
      </CCardBody>
    </CCard>
  )
}