import {
  CAlert,
  CButton,
  CCard,
  CCardBody,
  CCardHeader,
  CCol,
  CRow,
} from '@coreui/react'
import {
  copyToClipboard,
  formatDateTime,
  formatNumber,
  getCampaignMediaUrl,
  getRegistrationModeLabel,
} from '../utils/registrationCampaignUi'

function StatCard({ label, value }) {
  return (
    <CCol sm={6} xl={4}>
      <CCard className='h-100'>
        <CCardBody>
          <div className='text-body-secondary small'>{label}</div>
          <div className='fs-4 fw-semibold'>{formatNumber(value)}</div>
        </CCardBody>
      </CCard>
    </CCol>
  )
}

export default function CampaignOverviewTab({ campaign, onOpenPublic, onEditBasicInfo }) {
  const coverImageUrl = getCampaignMediaUrl(campaign?.coverImage)

  async function handleCopyLink() {
    const copied = await copyToClipboard(campaign?.publicJoinPath || campaign?.publicApiPath)
    if (!copied) {
      window.alert('Không thể sao chép liên kết')
    }
  }

  return (
    <div className='d-flex flex-column gap-3'>
      <CRow className='g-3'>
        <StatCard label='Tổng số đăng ký' value={campaign?.counts?.total || 0} />
        <StatCard label='Chờ xác minh' value={campaign?.counts?.pendingVerification || 0} />
        <StatCard label='Đã xác minh' value={campaign?.counts?.verified || 0} />
        <StatCard label='Đã hoàn tất' value={campaign?.counts?.approved || 0} />
        <StatCard label='Bị từ chối' value={campaign?.counts?.rejected || 0} />
        <StatCard label='Đã hủy hoặc hết hạn' value={campaign?.counts?.cancelledOrExpired || 0} />
      </CRow>

      {Array.isArray(campaign?.validation?.errors) && campaign.validation.errors.length > 0 ? (
        <CAlert color='danger'>
          <div className='fw-semibold mb-1'>Cảnh báo cấu hình</div>
          <ul className='mb-0'>
            {campaign.validation.errors.map((item) => <li key={item}>{item}</li>)}
          </ul>
        </CAlert>
      ) : null}

      {Array.isArray(campaign?.validation?.warnings) && campaign.validation.warnings.length > 0 ? (
        <CAlert color='warning'>
          <div className='fw-semibold mb-1'>Lưu ý</div>
          <ul className='mb-0'>
            {campaign.validation.warnings.map((item) => <li key={item}>{item}</li>)}
          </ul>
        </CAlert>
      ) : null}

      <CRow className='g-3'>
        <CCol lg={7}>
          <CCard className='h-100'>
            <CCardHeader><strong>Thông tin chiến dịch</strong></CCardHeader>
            <CCardBody>
              {coverImageUrl ? (
                <div className='mb-3'>
                  <img
                    src={coverImageUrl}
                    alt={campaign?.name || 'Ảnh bìa chiến dịch'}
                    style={{ width: '100%', maxHeight: 240, objectFit: 'cover', borderRadius: 12, border: '1px solid #d1d5db' }}
                  />
                </div>
              ) : null}
              <div className='row g-3'>
                <div className='col-md-6'><strong>Tên:</strong><div>{campaign?.name || '-'}</div></div>
                <div className='col-md-6'><strong>Mã:</strong><div>{campaign?.code || '-'}</div></div>
                <div className='col-md-6'><strong>Mô tả ngắn:</strong><div>{campaign?.shortDescription || '-'}</div></div>
                <div className='col-md-6'><strong>Chức năng được cấp:</strong><div>{campaign?.targetFeature || '-'}</div></div>
                <div className='col-md-6'><strong>Vai trò mặc định:</strong><div>{campaign?.defaultTenantRole?.name || 'Chưa cấu hình'}{campaign?.defaultTenantRole?.type ? ` (${campaign.defaultTenantRole.type})` : ''}</div></div>
                <div className='col-md-6'><strong>Trạng thái role:</strong><div>{campaign?.defaultTenantRole?.availabilityLabel || 'Chưa cấu hình'}</div></div>
                <div className='col-md-6'><strong>Trạng thái:</strong><div>{campaign?.statusLabel || '-'}</div></div>
                <div className='col-md-6'><strong>Chế độ đăng ký:</strong><div>{getRegistrationModeLabel(campaign?.registrationMode)}</div></div>
                <div className='col-md-6'><strong>Bắt đầu:</strong><div>{formatDateTime(campaign?.startAt)}</div></div>
                <div className='col-md-6'><strong>Kết thúc:</strong><div>{formatDateTime(campaign?.endAt)}</div></div>
                <div className='col-md-6'><strong>Giới hạn:</strong><div>{campaign?.maxRegistrations ? formatNumber(campaign.maxRegistrations) : 'Không giới hạn'}</div></div>
                <div className='col-md-6'><strong>Còn lại:</strong><div>{campaign?.remainingRegistrations === null ? 'Không giới hạn' : formatNumber(campaign.remainingRegistrations)}</div></div>
                <div className='col-md-6'><strong>Xác minh email:</strong><div>{campaign?.verificationRequired ? 'Có' : 'Không'}</div></div>
                <div className='col-md-6'><strong>Tự động duyệt:</strong><div>{campaign?.autoApprove ? 'Có' : 'Không'}</div></div>
              </div>
            </CCardBody>
          </CCard>
        </CCol>
        <CCol lg={5}>
          <CCard className='h-100'>
            <CCardHeader><strong>Link đăng ký</strong></CCardHeader>
            <CCardBody>
              <div className='small text-body-secondary mb-1'>Đường dẫn public dự kiến</div>
              <div className='border rounded p-2 bg-light small mb-3'>{campaign?.publicJoinPath || '-'}</div>
              <div className='small text-body-secondary mb-1'>Public API</div>
              <div className='border rounded p-2 bg-light small mb-3'>{campaign?.publicApiPath || '-'}</div>
              <div className='d-flex flex-wrap gap-2'>
                <CButton color='secondary' variant='outline' onClick={handleCopyLink}>Sao chép link</CButton>
                <CButton color='primary' variant='outline' disabled={!campaign?.publicJoinPath} onClick={() => onOpenPublic?.()}>Mở trang</CButton>
              </div>
              <div className='small text-body-secondary mt-3'>QR chưa được bật ở màn hình này vì chưa dùng component hoặc thư viện chung sẵn có cho module mới.</div>
            </CCardBody>
          </CCard>
        </CCol>
      </CRow>

      {!campaign?.defaultTenantRole?.id ? (
        <CAlert color='warning' className='mb-0 d-flex justify-content-between align-items-center flex-wrap gap-2'>
          <span>Chiến dịch chưa có vai trò mặc định để cấp khi người dùng tham gia tenant.</span>
          <CButton color='warning' variant='outline' onClick={onEditBasicInfo}>Cập nhật vai trò</CButton>
        </CAlert>
      ) : null}

      {campaign?.defaultTenantRole?.id && campaign?.defaultTenantRole?.isAvailable === false ? (
        <CAlert color='danger' className='mb-0 d-flex justify-content-between align-items-center flex-wrap gap-2'>
          <span>Vai trò mặc định hiện không còn được tenant sử dụng.</span>
          <CButton color='danger' variant='outline' onClick={onEditBasicInfo}>Cập nhật vai trò</CButton>
        </CAlert>
      ) : null}
    </div>
  )
}