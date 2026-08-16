import { CCard, CCardBody, CCardHeader } from '@coreui/react'

export default function ExamConfigurationPlaceholderPage({ title, description, notice }) {
  return (
    <CCard>
      <CCardHeader><strong>{title}</strong></CCardHeader>
      <CCardBody>
        <p className='mb-2'>{description}</p>
        <p className='text-body-secondary mb-0'>{notice}</p>
      </CCardBody>
    </CCard>
  )
}