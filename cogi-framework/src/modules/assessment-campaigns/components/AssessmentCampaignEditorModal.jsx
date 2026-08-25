import { useEffect, useState } from 'react'
import { CAlert, CButton, CCol, CFormInput, CFormLabel, CFormSelect, CFormTextarea, CModal, CModalBody, CModalFooter, CModalHeader, CModalTitle, CRow } from '@coreui/react'
import { getApiMessage } from '../services/assessmentCampaignService'

function emptyForm() {
  return { code: '', name: '', slug: '', description: '', status: 'draft', startAt: '', endAt: '', publicTitle: '', publicDescription: '', otpEmailSubject: '', otpEmailHeading: '', otpEmailIntro: '', otpEmailFooter: '' }
}

function normalizeForm(campaign) {
  const otpEmail = campaign?.otpEmail || campaign?.settings?.otpEmail || {}
  return {
    code: campaign?.code || '',
    name: campaign?.name || '',
    slug: campaign?.slug || '',
    description: campaign?.description || '',
    status: campaign?.status || 'draft',
    startAt: campaign?.startAt ? String(campaign.startAt).slice(0, 16) : '',
    endAt: campaign?.endAt ? String(campaign.endAt).slice(0, 16) : '',
    publicTitle: campaign?.publicTitle || '',
    publicDescription: campaign?.publicDescription || '',
    otpEmailSubject: otpEmail?.subject || '',
    otpEmailHeading: otpEmail?.heading || '',
    otpEmailIntro: otpEmail?.intro || '',
    otpEmailFooter: otpEmail?.footer || '',
  }
}

export default function AssessmentCampaignEditorModal({ visible, saving, campaign, onClose, onSubmit }) {
  const [form, setForm] = useState(emptyForm())
  const [error, setError] = useState('')

  useEffect(() => {
    if (!visible) return
    setForm(campaign ? normalizeForm(campaign) : emptyForm())
    setError('')
  }, [campaign, visible])

  function handleClose() {
    if (saving) return
    setError('')
    onClose?.()
  }

  async function handleSave() {
    if (!String(form.code || '').trim()) return setError('Mã chiến dịch là bắt buộc')
    if (!String(form.name || '').trim()) return setError('Tên chiến dịch là bắt buộc')
    if (!String(form.slug || '').trim()) return setError('Slug là bắt buộc')
    try {
      await onSubmit?.({
        code: String(form.code || '').trim(),
        name: String(form.name || '').trim(),
        slug: String(form.slug || '').trim(),
        description: String(form.description || '').trim() || null,
        status: form.status,
        startAt: form.startAt || null,
        endAt: form.endAt || null,
        publicTitle: String(form.publicTitle || '').trim() || null,
        publicDescription: String(form.publicDescription || '').trim() || null,
        settings: {
          ...(campaign?.settings && typeof campaign.settings === 'object' ? campaign.settings : {}),
          otpEmail: {
            subject: String(form.otpEmailSubject || '').trim() || '',
            heading: String(form.otpEmailHeading || '').trim() || '',
            intro: String(form.otpEmailIntro || '').trim() || '',
            footer: String(form.otpEmailFooter || '').trim() || '',
          },
        },
      })
    } catch (requestError) {
      setError(getApiMessage(requestError, 'Không lưu được chiến dịch đánh giá'))
    }
  }

  return (
    <CModal visible={visible} backdrop='static' size='lg' onClose={handleClose}>
      <CModalHeader><CModalTitle>{campaign ? 'Sửa chiến dịch đánh giá' : 'Tạo chiến dịch đánh giá'}</CModalTitle></CModalHeader>
      <CModalBody>
        {error ? <CAlert color='danger'>{error}</CAlert> : null}
        <CRow className='g-3'>
          <CCol md={4}><CFormLabel>Mã</CFormLabel><CFormInput value={form.code} onChange={(event) => setForm((prev) => ({ ...prev, code: event.target.value }))} /></CCol>
          <CCol md={4}><CFormLabel>Slug</CFormLabel><CFormInput value={form.slug} onChange={(event) => setForm((prev) => ({ ...prev, slug: event.target.value }))} /></CCol>
          <CCol md={4}><CFormLabel>Trạng thái</CFormLabel><CFormSelect value={form.status} onChange={(event) => setForm((prev) => ({ ...prev, status: event.target.value }))}><option value='draft'>Bản nháp</option><option value='active'>Hoạt động</option><option value='paused'>Tạm dừng</option><option value='ended'>Kết thúc</option><option value='archived'>Lưu trữ</option></CFormSelect></CCol>
          <CCol md={12}><CFormLabel>Tên chiến dịch</CFormLabel><CFormInput value={form.name} onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))} /></CCol>
          <CCol md={6}><CFormLabel>Bắt đầu</CFormLabel><CFormInput type='datetime-local' value={form.startAt} onChange={(event) => setForm((prev) => ({ ...prev, startAt: event.target.value }))} /></CCol>
          <CCol md={6}><CFormLabel>Kết thúc</CFormLabel><CFormInput type='datetime-local' value={form.endAt} onChange={(event) => setForm((prev) => ({ ...prev, endAt: event.target.value }))} /></CCol>
          <CCol xs={12}><CFormLabel>Mô tả</CFormLabel><CFormTextarea rows={4} value={form.description} onChange={(event) => setForm((prev) => ({ ...prev, description: event.target.value }))} /></CCol>
          <CCol md={6}><CFormLabel>Public title</CFormLabel><CFormInput value={form.publicTitle} onChange={(event) => setForm((prev) => ({ ...prev, publicTitle: event.target.value }))} /></CCol>
          <CCol md={6}><CFormLabel>Public description</CFormLabel><CFormTextarea rows={3} value={form.publicDescription} onChange={(event) => setForm((prev) => ({ ...prev, publicDescription: event.target.value }))} /></CCol>
          <CCol xs={12}><hr className='my-1' /></CCol>
          <CCol xs={12}><div className='fw-semibold'>Email xác thực OTP</div><div className='small text-body-secondary'>Tùy chỉnh nội dung nhẹ cho email OTP. Nếu để trống, hệ thống sẽ dùng mẫu mặc định.</div></CCol>
          <CCol md={12}><CFormLabel>Tiêu đề email</CFormLabel><CFormInput value={form.otpEmailSubject} onChange={(event) => setForm((prev) => ({ ...prev, otpEmailSubject: event.target.value }))} /></CCol>
          <CCol md={12}><CFormLabel>Tiêu đề nội dung</CFormLabel><CFormInput value={form.otpEmailHeading} onChange={(event) => setForm((prev) => ({ ...prev, otpEmailHeading: event.target.value }))} /></CCol>
          <CCol md={12}><CFormLabel>Lời giới thiệu</CFormLabel><CFormTextarea rows={3} value={form.otpEmailIntro} onChange={(event) => setForm((prev) => ({ ...prev, otpEmailIntro: event.target.value }))} /></CCol>
          <CCol md={12}><CFormLabel>Chân thư</CFormLabel><CFormTextarea rows={3} value={form.otpEmailFooter} onChange={(event) => setForm((prev) => ({ ...prev, otpEmailFooter: event.target.value }))} /></CCol>
          <CCol xs={12} className='d-flex justify-content-end'><CButton color='secondary' variant='outline' onClick={() => setForm((prev) => ({ ...prev, otpEmailSubject: '', otpEmailHeading: '', otpEmailIntro: '', otpEmailFooter: '' }))}>Khôi phục mặc định</CButton></CCol>
          <CCol xs={12}>
            <div className='border rounded-3 p-3 bg-body-tertiary'>
              <div className='fw-semibold mb-2'>Preview</div>
              <div className='small text-body-secondary mb-1'>{form.otpEmailSubject || 'Mã xác thực {{campaignName}}'}</div>
              <div className='fw-semibold mb-2'>{form.otpEmailHeading || 'Mã xác thực của bạn'}</div>
              <div className='mb-2'>{form.otpEmailIntro || 'Bạn đang xác thực để tiếp tục bài đánh giá {{campaignName}}.'}</div>
              <div className='fs-4 fw-bold mb-2'>123456</div>
              <div>{form.otpEmailFooter || 'Nếu bạn không thực hiện yêu cầu này, vui lòng bỏ qua email.'}</div>
            </div>
          </CCol>
        </CRow>
      </CModalBody>
      <CModalFooter>
        <CButton color='secondary' variant='outline' onClick={handleClose} disabled={saving}>Đóng</CButton>
        <CButton color='primary' onClick={handleSave} disabled={saving}>{saving ? 'Đang lưu...' : 'Lưu chiến dịch'}</CButton>
      </CModalFooter>
    </CModal>
  )
}