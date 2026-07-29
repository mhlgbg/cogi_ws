import {
  CButton,
  CCard,
  CCardBody,
  CCardHeader,
  CCol,
  CListGroup,
  CListGroupItem,
  CRow,
} from '@coreui/react'
import { copyToClipboard, formatDateTime, getCampaignMediaUrl, getRegistrationModeLabel } from '../utils/registrationCampaignUi'

function ChecklistItem({ ok, label }) {
  return (
    <CListGroupItem className='d-flex justify-content-between align-items-center'>
      <span>{label}</span>
      <span className={`badge ${ok ? 'bg-success' : 'bg-danger'}`}>{ok ? 'Đạt' : 'Thiếu'}</span>
    </CListGroupItem>
  )
}

export default function CampaignPublicPageTab({ campaign, onOpenPublic, onOpenAction }) {
  const coverImageUrl = getCampaignMediaUrl(campaign?.coverImage)

  async function handleCopy() {
    const copied = await copyToClipboard(campaign?.publicJoinPath || campaign?.publicApiPath)
    if (!copied) {
      window.alert('Không thể sao chép link đăng ký')
    }
  }

  return (
    <CRow className='g-3'>
      <CCol lg={5}>
        <CCard className='h-100'>
          <CCardHeader><strong>Checklist trước khi mở chiến dịch</strong></CCardHeader>
          <CCardBody>
            <CListGroup flush>
              <ChecklistItem ok={campaign?.readiness?.hasName} label='Có tên chiến dịch' />
              <ChecklistItem ok={campaign?.readiness?.hasCode} label='Có mã chiến dịch' />
              <ChecklistItem ok={campaign?.readiness?.hasTargetFeature} label='Có targetFeature' />
              <ChecklistItem ok={campaign?.readiness?.hasDefaultTenantRole} label='Đã chọn vai trò mặc định trong tenant' />
              <ChecklistItem ok={campaign?.readiness?.emailServiceReady} label='Email service đã sẵn sàng' />
              <ChecklistItem ok={campaign?.readiness?.hasVerificationTemplate} label='Template xác minh email hợp lệ' />
              <ChecklistItem ok={campaign?.readiness?.hasCompletionTemplate} label='Template hoàn tất đăng ký hợp lệ' />
              <ChecklistItem ok={campaign?.readiness?.hasRejectionTemplate} label='Template từ chối hợp lệ' />
              <ChecklistItem ok={campaign?.readiness?.formValid} label='Biểu mẫu hợp lệ' />
              <ChecklistItem ok={campaign?.readiness?.termsValid} label='Điều khoản hợp lệ nếu bắt buộc' />
              <ChecklistItem ok={campaign?.readiness?.redirectPathValid} label='Redirect path hợp lệ' />
              <ChecklistItem ok={campaign?.readiness?.timeValid} label='Thời gian hợp lệ' />
            </CListGroup>
            <div className='d-flex flex-wrap gap-2 mt-3'>
              <CButton color='secondary' variant='outline' onClick={handleCopy}>Sao chép link</CButton>
              <CButton color='primary' variant='outline' onClick={onOpenPublic}>Mở tab public</CButton>
              {campaign?.status !== 'open' ? <CButton color='success' onClick={onOpenAction}>Mở chiến dịch</CButton> : null}
            </div>
            {!campaign?.readiness?.hasDefaultTenantRole ? <div className='small text-danger mt-3'>Hãy chọn một vai trò đang được cấp cho tenant trước khi mở chiến dịch.</div> : null}
            {campaign?.verificationRequired && !campaign?.readiness?.hasVerificationTemplate ? <div className='small text-danger mt-2'>Chưa cấu hình template xác minh email.</div> : null}
            {campaign?.autoApprove && !campaign?.readiness?.hasCompletionTemplate ? <div className='small text-warning mt-2'>Template hoàn tất đăng ký chưa được cấu hình.</div> : null}
            {campaign?.registrationMode === 'approval_required' && !campaign?.readiness?.hasRejectionTemplate ? <div className='small text-warning mt-2'>Template từ chối chưa được cấu hình.</div> : null}
          </CCardBody>
        </CCard>
      </CCol>
      <CCol lg={7}>
        <CCard className='h-100'>
          <CCardHeader><strong>Preview trang đăng ký</strong></CCardHeader>
          <CCardBody>
            {coverImageUrl ? <img src={coverImageUrl} alt='cover' style={{ width: '100%', maxHeight: 240, objectFit: 'cover', borderRadius: 12, border: '1px solid #d1d5db', marginBottom: 16 }} /> : null}
            <div className='fs-5 fw-semibold'>{campaign?.name || '-'}</div>
            <div className='text-body-secondary mb-3'>{campaign?.shortDescription || 'Chưa có mô tả ngắn.'}</div>
            <div className='row g-3'>
              <div className='col-md-6'><strong>Mã chiến dịch:</strong><div>{campaign?.code || '-'}</div></div>
              <div className='col-md-6'><strong>Link đăng ký:</strong><div>{campaign?.publicJoinPath || '-'}</div></div>
              <div className='col-md-6'><strong>Trạng thái:</strong><div>{campaign?.statusLabel || '-'}</div></div>
              <div className='col-md-6'><strong>Chế độ:</strong><div>{getRegistrationModeLabel(campaign?.registrationMode)}</div></div>
              <div className='col-md-6'><strong>Thời gian bắt đầu:</strong><div>{formatDateTime(campaign?.startAt)}</div></div>
              <div className='col-md-6'><strong>Thời gian kết thúc:</strong><div>{formatDateTime(campaign?.endAt)}</div></div>
              <div className='col-12'><strong>Biểu mẫu:</strong><div>{Array.isArray(campaign?.formConfig?.fields) ? `${campaign.formConfig.fields.length} trường` : '-'}</div></div>
              <div className='col-12'><strong>Điều khoản:</strong><div>{campaign?.requireTermsAcceptance ? (campaign?.termsContent || 'Đã bật nhưng chưa có nội dung') : 'Không yêu cầu'}</div></div>
              <div className='col-12'><strong>Thông báo thành công:</strong><div>{campaign?.successMessage || '-'}</div></div>
              <div className='col-12'><strong>Redirect path:</strong><div>{campaign?.redirectPath || '-'}</div></div>
            </div>
            <div className='small text-body-secondary mt-3'>Trang public dùng route `/join/:campaignCode` theo tenant context hiện tại.</div>
          </CCardBody>
        </CCard>
      </CCol>
    </CRow>
  )
}