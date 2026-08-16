import { CAlert, CButton, CCard, CCardBody, CCardHeader, CContainer } from '@coreui/react'
import { useNavigate, useParams } from 'react-router-dom'

export default function LearnerExamNoProfileState({ support }) {
  const navigate = useNavigate()
  const { tenantCode } = useParams()

  return (
    <CContainer fluid className='py-4'>
      <CCard>
        <CCardHeader><strong>Chưa xác định được người học</strong></CCardHeader>
        <CCardBody>
          <p className='mb-3'>Tài khoản của bạn chưa được liên kết với người học nào trong hệ thống nên chưa thể đăng ký dự thi. Vui lòng liên hệ nhà trường theo thông tin trong thông báo thi để được hỗ trợ.</p>
          {support ? (
            <div className='border rounded p-3 bg-body-tertiary mb-3'>
              <div className='fw-semibold mb-2'>{support.organizationName || 'Đơn vị quản lý'}</div>
              <div>Số điện thoại: {support.supportPhone || 'Chưa có thông tin'}</div>
              <div>Email: {support.supportEmail || 'Chưa có thông tin'}</div>
              <div>Website: {support.supportWebsite || 'Chưa có thông tin'}</div>
              <div className='mt-2 small text-body-secondary'>{support.supportNote || 'Vui lòng liên hệ đơn vị quản lý để được gán learner cho tài khoản này.'}</div>
            </div>
          ) : <CAlert color='warning'>Chưa tải được thông tin hỗ trợ của đơn vị.</CAlert>}
          <CButton color='secondary' variant='outline' onClick={() => navigate(tenantCode ? `/t/${encodeURIComponent(tenantCode)}/dashboard` : '/dashboard')}>Quay lại trang chính</CButton>
        </CCardBody>
      </CCard>
    </CContainer>
  )
}