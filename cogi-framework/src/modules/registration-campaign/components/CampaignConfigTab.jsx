import { useEffect, useState } from 'react'
import {
  CButton,
  CCard,
  CCardBody,
  CCardHeader,
  CCol,
  CFormCheck,
  CFormInput,
  CFormLabel,
  CFormSelect,
  CFormSwitch,
  CFormTextarea,
  CRow,
} from '@coreui/react'
import { getApiMessage, getRegistrationModeLabel, normalizeStatus, toText } from '../utils/registrationCampaignUi'

function buildInitialState(campaign) {
  return {
    registrationMode: campaign?.registrationMode || 'public_code',
    verificationRequired: campaign?.verificationRequired !== false,
    verificationMethod: campaign?.verificationMethod || 'email_link',
    verificationExpireMinutes: String(campaign?.verificationExpireMinutes || 1440),
    autoApprove: campaign?.autoApprove !== false,
    requireTermsAcceptance: campaign?.requireTermsAcceptance === true,
    termsContent: campaign?.termsContent || '',
    successMessage: campaign?.successMessage || '',
    redirectPath: campaign?.redirectPath || '',
  }
}

export default function CampaignConfigTab({ campaign, formOptions, saving = false, onSave, onEditBasicInfo }) {
  const [form, setForm] = useState(buildInitialState(campaign))
  const [error, setError] = useState('')

  useEffect(() => {
    setForm(buildInitialState(campaign))
    setError('')
  }, [campaign])

  function updateField(key, value) {
    setForm((prev) => {
      const next = { ...prev, [key]: value }
      if (key === 'registrationMode' && value === 'approval_required') {
        next.autoApprove = false
      }
      if (key === 'verificationRequired' && value === false) {
        next.verificationMethod = 'email_link'
      }
      return next
    })
  }

  function handleSubmit(event) {
    event.preventDefault()
    setError('')

    if (normalizeStatus(form.verificationMethod) !== 'email_link') {
      setError('Hiện tại backend chỉ hỗ trợ xác minh bằng liên kết email.')
      return
    }

    if (toText(form.redirectPath) && !String(form.redirectPath).startsWith('/')) {
      setError('redirectPath chỉ chấp nhận đường dẫn nội bộ bắt đầu bằng /.')
      return
    }

    if (form.requireTermsAcceptance && !toText(form.termsContent)) {
      setError('Khi yêu cầu chấp nhận điều khoản, nội dung điều khoản là bắt buộc.')
      return
    }

    onSave?.({
      registrationMode: form.registrationMode,
      verificationRequired: form.verificationRequired === true,
      verificationMethod: form.verificationMethod,
      verificationExpireMinutes: Number(form.verificationExpireMinutes || 1440),
      autoApprove: form.registrationMode === 'approval_required' ? false : form.autoApprove === true,
      requireTermsAcceptance: form.requireTermsAcceptance === true,
      termsContent: toText(form.termsContent) || null,
      successMessage: toText(form.successMessage) || null,
      redirectPath: toText(form.redirectPath) || null,
    })
  }

  return (
    <CCard>
      <CCardHeader><strong>Cấu hình đăng ký</strong></CCardHeader>
      <CCardBody>
        <form onSubmit={handleSubmit}>
          {error ? <div className='alert alert-danger py-2'>{error}</div> : null}
          <div className='border rounded p-3 mb-3 bg-light'>
            <div className='fw-semibold mb-2'>Quyền được cấp sau khi phê duyệt</div>
            <div><strong>Chức năng mục tiêu:</strong> {campaign?.targetFeature || '-'}</div>
            <div><strong>Vai trò mặc định:</strong> {campaign?.defaultTenantRole?.name || 'Chưa cấu hình'}{campaign?.defaultTenantRole?.type ? ` (${campaign.defaultTenantRole.type})` : ''}</div>
            <div className='small text-body-secondary mt-2'>Khi bản đăng ký được phê duyệt, hệ thống sẽ sử dụng vai trò mặc định này khi thêm người dùng vào tenant. Các quyền hiện có của người dùng không được tự động loại bỏ.</div>
            <div className='mt-2'>
              <CButton type='button' color='secondary' variant='outline' size='sm' onClick={onEditBasicInfo}>Thay đổi vai trò mặc định</CButton>
            </div>
          </div>
          <CRow className='g-3'>
            <CCol md={6}>
              <CFormLabel>Chế độ đăng ký</CFormLabel>
              <CFormSelect value={form.registrationMode} onChange={(event) => updateField('registrationMode', event.target.value)} disabled={saving}>
                {(formOptions?.registrationModes || []).map((item) => (
                  <option key={item.value} value={item.value}>{item.label}</option>
                ))}
              </CFormSelect>
              <div className='small text-body-secondary mt-1'>{getRegistrationModeLabel(form.registrationMode)}</div>
            </CCol>
            <CCol md={6}>
              <CFormLabel>Thời gian hiệu lực email xác minh</CFormLabel>
              <CFormSelect value={String(form.verificationExpireMinutes)} onChange={(event) => updateField('verificationExpireMinutes', event.target.value)} disabled={saving}>
                {(formOptions?.verificationExpirePresets || []).map((item) => (
                  <option key={item} value={item}>{item < 60 ? `${item} phút` : item % 60 === 0 ? `${item / 60} giờ` : `${item} phút`}</option>
                ))}
                <option value={form.verificationExpireMinutes}>Tùy chỉnh hiện tại ({form.verificationExpireMinutes} phút)</option>
              </CFormSelect>
            </CCol>
            <CCol md={6}>
              <CFormSwitch label='Yêu cầu xác minh email' checked={form.verificationRequired === true} onChange={(event) => updateField('verificationRequired', event.target.checked)} disabled={saving} />
            </CCol>
            <CCol md={6}>
              <CFormSwitch label='Tự động duyệt sau khi xác minh' checked={form.autoApprove === true} onChange={(event) => updateField('autoApprove', event.target.checked)} disabled={saving || form.registrationMode === 'approval_required'} />
              {form.registrationMode === 'approval_required' ? <div className='small text-body-secondary'>Khi chọn chế độ cần phê duyệt, tự động duyệt sẽ bị tắt.</div> : null}
            </CCol>
            <CCol md={6}>
              <CFormLabel>Phương thức xác minh</CFormLabel>
              <CFormSelect value={form.verificationMethod} onChange={(event) => updateField('verificationMethod', event.target.value)} disabled={saving || form.verificationRequired !== true}>
                {(formOptions?.verificationMethods || []).map((item) => (
                  <option key={item.value} value={item.value} disabled={item.disabled}>{item.label}{item.disabled ? ' (chưa hỗ trợ)' : ''}</option>
                ))}
              </CFormSelect>
            </CCol>
            <CCol md={6}>
              <CFormSwitch label='Yêu cầu chấp nhận điều khoản' checked={form.requireTermsAcceptance === true} onChange={(event) => updateField('requireTermsAcceptance', event.target.checked)} disabled={saving} />
            </CCol>
            {form.requireTermsAcceptance ? (
              <CCol xs={12}>
                <CFormLabel>Nội dung điều khoản</CFormLabel>
                <CFormTextarea rows={5} value={form.termsContent} onChange={(event) => updateField('termsContent', event.target.value)} disabled={saving} />
              </CCol>
            ) : null}
            <CCol xs={12}>
              <CFormLabel>Thông báo thành công</CFormLabel>
              <CFormTextarea rows={3} value={form.successMessage} onChange={(event) => updateField('successMessage', event.target.value)} disabled={saving} />
            </CCol>
            <CCol xs={12}>
              <CFormLabel>Redirect path</CFormLabel>
              <CFormInput value={form.redirectPath} onChange={(event) => updateField('redirectPath', event.target.value)} disabled={saving} placeholder='/fitness/connect' />
              <div className='small text-body-secondary mt-1'>Chỉ chấp nhận đường dẫn nội bộ bắt đầu bằng /</div>
            </CCol>
            <CCol xs={12} className='d-flex justify-content-end'>
              <CButton type='submit' color='primary' disabled={saving}>{saving ? 'Đang lưu...' : 'Lưu cấu hình'}</CButton>
            </CCol>
          </CRow>
        </form>
      </CCardBody>
    </CCard>
  )
}