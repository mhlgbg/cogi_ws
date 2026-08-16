import { useNavigate, useParams } from 'react-router-dom'
import { CButton, CContainer } from '@coreui/react'
import ExamConfigurationPlaceholderPage from '../components/ExamConfigurationPlaceholderPage'
import { buildExamConfigurationPath, getExamConfigurationPlaceholderCopy } from '../utils/examConfigurationUi'

export default function ExamConfigurationPlaceholderDetailPage() {
  const navigate = useNavigate()
  const { tenantCode } = useParams()
  const currentPath = window.location.pathname
  const tab = currentPath.includes('/components/')
    ? 'components'
    : currentPath.includes('/subjects/')
      ? 'subjects'
      : currentPath.includes('/programs/')
        ? 'programs'
        : 'outcomes'
  const copy = getExamConfigurationPlaceholderCopy(tab)

  return (
    <CContainer fluid className='py-4'>
      <div className='d-flex justify-content-between align-items-start gap-3 flex-wrap mb-3'>
        <div>
          <div className='fs-4 fw-semibold'>{copy.title}</div>
          <div className='text-body-secondary'>Khung chi tiết sẽ được triển khai ở bước tiếp theo.</div>
        </div>
        <CButton color='secondary' variant='outline' onClick={() => navigate(buildExamConfigurationPath(tab, tenantCode))}>Quay lại</CButton>
      </div>

      <ExamConfigurationPlaceholderPage title={copy.title} description={copy.description} notice='Chức năng chi tiết sẽ được triển khai ở bước tiếp theo.' />
    </CContainer>
  )
}