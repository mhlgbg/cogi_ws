import { useEffect, useMemo, useState } from 'react'
import {
  CAlert,
  CButton,
  CCol,
  CFormInput,
  CFormLabel,
  CFormTextarea,
  CModal,
  CModalBody,
  CModalFooter,
  CModalHeader,
  CModalTitle,
  CRow,
} from '@coreui/react'
import SimpleHtmlEditor from '../../admission-management/components/SimpleHtmlEditor'
import AssessmentCampaignLandingRenderer, { getDefaultAssessmentCampaignLandingHtml } from '../../../features/public-assessment/components/AssessmentCampaignLandingRenderer'

function buildInitialForm(campaign) {
  return {
    publicTitle: campaign?.publicTitle || '',
    publicDescription: campaign?.publicDescription || '',
    landingHtml: campaign?.landingHtml || campaign?.publicContent || '',
    successMessage: campaign?.successMessage || '',
    resultIntro: campaign?.resultIntro || '',
  }
}

export default function AssessmentCampaignPublicContentModal({ visible, campaign, saving = false, onClose, onSubmit }) {
  const [form, setForm] = useState(buildInitialForm(campaign))
  const [error, setError] = useState('')

  useEffect(() => {
    if (!visible) return
    setForm(buildInitialForm(campaign))
    setError('')
  }, [campaign, visible])

  const previewCampaign = useMemo(() => ({
    ...campaign,
    publicTitle: form.publicTitle,
    publicDescription: form.publicDescription,
    landingHtml: form.landingHtml,
  }), [campaign, form.landingHtml, form.publicDescription, form.publicTitle])

  function updateField(key, value) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  function handleLoadDefaultTemplate() {
    const hasUnsavedCustomContent = String(form.landingHtml || '').trim() && String(form.landingHtml || '').trim() !== String(campaign?.landingHtml || campaign?.publicContent || '').trim()
    if (hasUnsavedCustomContent && !window.confirm('Editor đang có thay đổi chưa lưu. Bạn vẫn muốn nạp mẫu mặc định?')) return
    updateField('landingHtml', getDefaultAssessmentCampaignLandingHtml())
  }

  async function handleSave() {
    setError('')
    try {
      await onSubmit?.({
        publicTitle: String(form.publicTitle || '').trim() || null,
        publicDescription: String(form.publicDescription || '').trim() || null,
        landingHtml: String(form.landingHtml || '').trim() || null,
        successMessage: String(form.successMessage || '').trim() || null,
        resultIntro: String(form.resultIntro || '').trim() || null,
      })
    } catch (requestError) {
      setError(requestError?.message || 'Khong luu duoc noi dung public')
    }
  }

  return (
    <CModal visible={visible} onClose={() => !saving && onClose?.()} size='xl' backdrop='static'>
      <CModalHeader>
        <CModalTitle>Sua noi dung public</CModalTitle>
      </CModalHeader>
      <CModalBody style={{ maxHeight: '78vh', overflowY: 'auto' }}>
        {error ? <CAlert color='danger'>{error}</CAlert> : null}
        <CRow className='g-3'>
          <CCol md={6}>
            <CFormLabel>Public title</CFormLabel>
            <CFormInput value={form.publicTitle} onChange={(event) => updateField('publicTitle', event.target.value)} disabled={saving} placeholder='Kiem tra trinh do' />
          </CCol>
          <CCol md={6}>
            <CFormLabel>Public description</CFormLabel>
            <CFormTextarea rows={3} value={form.publicDescription} onChange={(event) => updateField('publicDescription', event.target.value)} disabled={saving} placeholder='Mo ta ngan cho nguoi dung ben ngoai.' />
          </CCol>
          <CCol xs={12} className='d-flex justify-content-between align-items-center gap-2 flex-wrap'>
            <div>
              <div className='fw-semibold'>Landing HTML</div>
              <div className='small text-body-secondary'>{'Co the dung marker {{start}} va {{recovery}} de dat nut theo vi tri mong muon.'}</div>
            </div>
            <CButton color='secondary' variant='outline' onClick={handleLoadDefaultTemplate} disabled={saving}>Nap mau mac dinh</CButton>
          </CCol>
          <CCol xs={12}>
            <SimpleHtmlEditor
              label='Noi dung HTML'
              rows={14}
              value={form.landingHtml}
              onChange={(nextValue) => updateField('landingHtml', nextValue)}
              disabled={saving}
              placeholder={getDefaultAssessmentCampaignLandingHtml()}
              helperText='HTML se duoc sanitize truoc khi luu/preview. Khong ho tro script, event handler hay javascript: URI.'
              variableTokens={[
                { label: 'Start', value: '{{start}}', description: 'Nut Bat dau kiem tra' },
                { label: 'Recovery', value: '{{recovery}}', description: 'Nut Tiep tuc / Xem lai ket qua' },
                { label: 'Title', value: '{{publicTitle}}', description: 'Public title hien tai' },
                { label: 'Description', value: '{{publicDescription}}', description: 'Public description hien tai' },
              ]}
            />
          </CCol>
          <CCol md={6}>
            <CFormLabel>Success message</CFormLabel>
            <CFormTextarea rows={3} value={form.successMessage} onChange={(event) => updateField('successMessage', event.target.value)} disabled={saving} />
          </CCol>
          <CCol md={6}>
            <CFormLabel>Result intro</CFormLabel>
            <CFormTextarea rows={3} value={form.resultIntro} onChange={(event) => updateField('resultIntro', event.target.value)} disabled={saving} />
          </CCol>
          <CCol xs={12}>
            <div className='border rounded-4 p-4 bg-body-tertiary'>
              <div className='d-flex justify-content-between align-items-center gap-2 flex-wrap mb-3'>
                <div className='fw-semibold'>Xem truoc</div>
                <div className='small text-body-secondary'>Preview-only. Khong tao Attempt hay trigger business flow.</div>
              </div>
              <div className='assessment-public-shell' style={{ width: '100%' }}>
                <AssessmentCampaignLandingRenderer
                  campaign={previewCampaign}
                  renderStartAction={(key) => <CButton key={`preview-start:${key}`} type='button' color='primary' className='assessment-primary-cta' disabled>BAT DAU KIEM TRA</CButton>}
                  renderRecoveryAction={(key) => <CButton key={`preview-recovery:${key}`} type='button' color='secondary' variant='outline' className='assessment-primary-cta' disabled>TIEP TUC / XEM LAI KET QUA</CButton>}
                />
              </div>
            </div>
          </CCol>
        </CRow>
      </CModalBody>
      <CModalFooter>
        <CButton color='secondary' variant='outline' onClick={onClose} disabled={saving}>Cancel</CButton>
        <CButton color='primary' onClick={handleSave} disabled={saving}>{saving ? 'Dang luu...' : 'Save'}</CButton>
      </CModalFooter>
    </CModal>
  )
}
