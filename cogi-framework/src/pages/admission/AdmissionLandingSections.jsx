import {
  CButton,
  CCard,
  CCardBody,
  CForm,
  CFormInput,
  CFormLabel,
  CSpinner,
} from '@coreui/react'

export function AdmissionTopHeader({ tenant, campaign, title }) {
  return (
    <CCard className='admission-header-card border-0 shadow-sm'>
      <CCardBody className='p-4 p-lg-5'>
        <div className='d-flex flex-column flex-lg-row align-items-start align-items-lg-center gap-3 gap-lg-4'>
          {tenant.logo ? (
            <div className='admission-hero-logo-wrap'>
              <img
                src={tenant.logo}
                alt={tenant.name || 'Tenant logo'}
                className='admission-hero-logo'
              />
            </div>
          ) : null}

          <div className='flex-grow-1'>
            <div className='admission-school-name'>{tenant.name || 'Đơn vị tuyển sinh'}</div>
            <h1 className='admission-page-title mb-2'>{title}</h1>
            {/*campaign.name ? <div className='admission-campaign-name'>{campaign.name}</div> : null*/}
            {campaign.code ? <div className='admission-campaign-code'>Mã kỳ tuyển sinh: {campaign.code}</div> : null}
          </div>
        </div>
      </CCardBody>
    </CCard>
  )
}

export function AdmissionInfoPanel({ tenant, campaign, title, description, hasHtmlContent }) {
  return (
    <CCard className='admission-info-card border-0 shadow-sm'>
      <CCardBody className='p-4 p-lg-5'>
        <div className='d-flex flex-column gap-4'>
          <div className='admission-note-box'>
            Dùng email và số điện thoại đang hoạt động để nhận thư mời, thông báo duyệt hồ sơ và hướng dẫn tiếp theo của nhà trường (Có thể thư sẽ được gửi vào hộp thư spam).
          </div>

          <div>
            <div className='admission-section-title mb-3'>Mô tả tuyển sinh</div>
            {description ? (
              hasHtmlContent(description)
                ? <div className='admission-description' dangerouslySetInnerHTML={{ __html: description }} />
                : <div className='admission-description'>{description}</div>
            ) : (
              <div className='admission-description'>Nhà trường đang mở tiếp nhận đăng ký trực tuyến. Phụ huynh vui lòng điền thông tin liên hệ ở cột bên phải để bắt đầu quy trình khai hồ sơ.</div>
            )}
          </div>
        </div>
      </CCardBody>
    </CCard>
  )
}

export function AdmissionForm({
  form,
  loading,
  submitting,
  successMessage,
  existingUserMessage,
  errorMessage,
  campaign,
  handleChange,
  handleSubmit,
  handleLoginRedirect,
}) {
  return (
    <CCard className='admission-form-card border-0 shadow-sm'>
      <CCardBody className='p-4 p-lg-5'>
        <div className='admission-section-title mb-2'>Thông tin phụ huynh</div>
        <div className='admission-form-intro mb-4'>Điền thông tin liên hệ để hệ thống gửi đường link kích hoạt và cho phép khai báo thông tin học sinh dự tuyển.</div>

        {loading ? (
          <div className='text-center py-5'>
            <CSpinner />
          </div>
        ) : (
          <>
            {successMessage ? <div className='mb-3'><div className='alert alert-success mb-0'>{successMessage}</div></div> : null}
            {existingUserMessage ? <div className='mb-3'><div className='alert alert-info mb-0'>{existingUserMessage}</div></div> : null}
            {errorMessage ? <div className='mb-3'><div className='alert alert-danger mb-0'>{errorMessage}</div></div> : null}

            <CForm onSubmit={handleSubmit} className='admission-form-layout'>
              <div className='admission-form-group'>
                <div>
                  <CFormLabel htmlFor='admission-fullName'>Họ và tên phụ huynh</CFormLabel>
                  <CFormInput
                    id='admission-fullName'
                    name='fullName'
                    value={form.fullName}
                    onChange={handleChange}
                    placeholder='Nhập họ và tên phụ huynh'
                    required
                    disabled={submitting}
                    size='lg'
                  />
                </div>
              </div>

              <div className='admission-form-group'>
                <div>
                  <CFormLabel htmlFor='admission-email'>Email nhận thông tin</CFormLabel>
                  <CFormInput
                    id='admission-email'
                    type='email'
                    name='email'
                    value={form.email}
                    onChange={handleChange}
                    placeholder='Nhập email nhận thông tin liên quan đến tuyển sinh'
                    required
                    disabled={submitting}
                    size='lg'
                  />
                </div>

                <div>
                  <CFormLabel htmlFor='admission-phone'>Số điện thoại liên hệ</CFormLabel>
                  <CFormInput
                    id='admission-phone'
                    name='phone'
                    value={form.phone}
                    onChange={handleChange}
                    placeholder='Nhập số điện thoại liên hệ'
                    required
                    disabled={submitting}
                    size='lg'
                  />
                </div>
              </div>
                {/*
              <div className='admission-form-group admission-form-highlight'>
                <div className='admission-form-group-title'>Tiếp theo sau khi đăng ký</div>
                <div className='admission-form-intro mb-0'>
                  Sau bước này, phụ huynh sẽ nhận liên kết để khai thông tin học sinh, phụ huynh và tải hồ sơ minh chứng.
                </div>
              </div>
                     */}
              {existingUserMessage ? (
                <div className='d-grid d-lg-flex justify-content-end'>
                  <CButton type='button' color='primary' size='lg' className='admission-primary-button' onClick={handleLoginRedirect} disabled={submitting || loading}>
                    Đăng nhập để tiếp tục
                  </CButton>
                </div>
              ) : (
                <div className='d-grid d-lg-flex justify-content-end'>
                  <CButton type='submit' color='primary' size='lg' className='admission-primary-button' disabled={submitting || loading || !campaign.code || !campaign.name}>
                    {submitting ? <CSpinner size='sm' className='me-2' /> : null}
                    Đăng ký ngay
                  </CButton>
                </div>
              )}
            </CForm>
          </>
        )}
      </CCardBody>
    </CCard>
  )
}