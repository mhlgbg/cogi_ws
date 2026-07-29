import {
  CBadge,
  CButton,
  CCol,
  CModal,
  CModalBody,
  CModalFooter,
  CModalHeader,
  CModalTitle,
  CRow,
  CSpinner,
} from '@coreui/react'
import { formatDateTime, getMailStatusColor, getRegistrationStatusMeta, toText } from '../utils/registrationCampaignUi'

export default function CampaignRegistrationDetailModal({ visible, loading, registration, onClose }) {
  const statusMeta = getRegistrationStatusMeta(registration?.status)

  return (
    <CModal size='xl' visible={visible} onClose={onClose}>
      <CModalHeader>
        <CModalTitle>Chi tiết người đăng ký</CModalTitle>
      </CModalHeader>
      <CModalBody>
        {loading ? (
          <div className='d-flex align-items-center gap-2'>
            <CSpinner size='sm' />
            <span>Đang tải chi tiết...</span>
          </div>
        ) : registration ? (
          <CRow className='g-4'>
            <CCol md={6}>
              <div className='fw-semibold mb-2'>Thông tin đăng ký</div>
              <div><strong>Họ và tên:</strong> {registration.fullName || '-'}</div>
              <div><strong>Email:</strong> {registration.email || '-'}</div>
              <div><strong>Điện thoại:</strong> {registration.phone || '-'}</div>
              <div><strong>Trạng thái:</strong> <CBadge color={statusMeta.color}>{statusMeta.label}</CBadge></div>
              <div><strong>Nguồn đăng ký:</strong> {registration.registrationSource || '-'}</div>
              <div><strong>Ngày đăng ký:</strong> {formatDateTime(registration.registeredAt)}</div>
              <div><strong>Ngày xác minh:</strong> {formatDateTime(registration.verifiedAt)}</div>
              <div><strong>Ngày duyệt:</strong> {formatDateTime(registration.approvedAt)}</div>
              <div><strong>Người duyệt:</strong> {registration.approvedBy?.fullName || registration.approvedBy?.email || '-'}</div>
              <div><strong>Lý do từ chối:</strong> {registration.rejectionReason || '-'}</div>
            </CCol>
            <CCol md={6}>
              <div className='fw-semibold mb-2'>Trạng thái liên kết</div>
              <div><strong>User đã tồn tại:</strong> {registration.user?.id ? 'Có' : 'Chưa'}</div>
              <div><strong>User liên kết:</strong> {registration.user?.email || '-'}</div>
              <div><strong>Membership:</strong> {registration.membership?.id ? `#${registration.membership.id}` : 'Chưa có'}</div>
              <div><strong>Trạng thái membership:</strong> {registration.membership?.status || '-'}</div>
              <div><strong>Đã có quyền targetFeature:</strong> {registration.targetFeatureGranted ? 'Có' : 'Chưa'}</div>
              <div><strong>Vai trò mặc định đã gán:</strong> {registration.metadata?.targetRoleName || '-'}</div>
              <div><strong>Trạng thái hoàn tất:</strong> {registration.completionStatus || '-'}</div>
              <div><strong>Role ids:</strong> {Array.isArray(registration.targetFeatureRoleIds) && registration.targetFeatureRoleIds.length > 0 ? registration.targetFeatureRoleIds.join(', ') : '-'}</div>
              <div><strong>Lỗi hoàn tất gần nhất:</strong> {registration.completionError || '-'}</div>
            </CCol>
            <CCol md={6}>
              <div className='fw-semibold mb-2'>Trạng thái email</div>
              <div><strong>Email gần nhất:</strong> {registration.latestEmail?.toEmail || '-'}</div>
              <div><strong>Trạng thái gửi:</strong> {registration.latestEmail?.sendStatus ? <CBadge color={getMailStatusColor(registration.latestEmail.sendStatus)}>{registration.latestEmail.sendStatus}</CBadge> : '-'}</div>
              <div><strong>Số lần gửi:</strong> {registration.verificationSendCount || 0}</div>
              <div><strong>Thời điểm gửi:</strong> {formatDateTime(registration.latestEmail?.queuedAt || registration.verificationSentAt)}</div>
              <div><strong>Lỗi gần nhất:</strong> {registration.latestEmail?.lastError || '-'}</div>
              <div className='mt-3'><strong>Email xác minh:</strong> {registration.verificationEmail?.sendStatus ? <CBadge color={getMailStatusColor(registration.verificationEmail.sendStatus)}>{registration.verificationEmail.sendStatus}</CBadge> : '-'}</div>
              <div><strong>Tiêu đề xác minh:</strong> {registration.verificationEmail?.subject || '-'}</div>
              <div><strong>Email hoàn tất:</strong> {registration.completionEmail?.sendStatus ? <CBadge color={getMailStatusColor(registration.completionEmail.sendStatus)}>{registration.completionEmail.sendStatus}</CBadge> : '-'}</div>
              <div><strong>Tiêu đề hoàn tất:</strong> {registration.completionEmail?.subject || '-'}</div>
              <div><strong>Email từ chối:</strong> {registration.rejectionEmail?.sendStatus ? <CBadge color={getMailStatusColor(registration.rejectionEmail.sendStatus)}>{registration.rejectionEmail.sendStatus}</CBadge> : '-'}</div>
              <div><strong>Tiêu đề từ chối:</strong> {registration.rejectionEmail?.subject || '-'}</div>
            </CCol>
            <CCol md={6}>
              <div className='fw-semibold mb-2'>Form data</div>
              <pre className='bg-light border rounded p-3 small mb-0' style={{ maxHeight: 320, overflow: 'auto' }}>
                {JSON.stringify(registration.formData || {}, null, 2)}
              </pre>
            </CCol>
            <CCol xs={12}>
              <div className='small text-body-secondary'>Các trường nhạy cảm như verification token, password, access token, refresh token không được hiển thị.</div>
            </CCol>
          </CRow>
        ) : (
          <div className='text-body-secondary'>Không có dữ liệu chi tiết.</div>
        )}
      </CModalBody>
      <CModalFooter>
        <CButton color='secondary' variant='outline' onClick={onClose}>Đóng</CButton>
      </CModalFooter>
    </CModal>
  )
}