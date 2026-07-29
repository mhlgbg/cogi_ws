import { useEffect, useState } from 'react'
import {
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
  CFormSelect,
} from '@coreui/react'
import { formatDateTimeInput } from '../utils/registrationCampaignUi'

function buildInitialState(defaultTargetFeature = '') {
  return {
    name: '',
    code: '',
    targetFeature: defaultTargetFeature,
    defaultTenantRole: '',
    shortDescription: '',
    startAt: '',
    endAt: '',
    maxRegistrations: '',
  }
}

export default function RegistrationCampaignCreateModal({
  visible,
  targetFeatureOptions = [],
  roleOptions = [],
  rolesLoading = false,
  submitting = false,
  onClose,
  onSubmit,
}) {
  const [form, setForm] = useState(buildInitialState(targetFeatureOptions?.[0]?.key || ''))
  const [error, setError] = useState('')

  useEffect(() => {
    if (!visible) return
    setForm(buildInitialState(targetFeatureOptions?.[0]?.key || ''))
    setError('')
  }, [targetFeatureOptions, visible])

  function updateField(key, value) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  function handleSubmit(event) {
    event.preventDefault()
    setError('')

    const name = String(form.name || '').trim()
    const code = String(form.code || '').trim().toLowerCase()
    const targetFeature = String(form.targetFeature || '').trim()

    if (!name) {
      setError('Tên chiến dịch là bắt buộc.')
      return
    }
    if (!code) {
      setError('Mã chiến dịch là bắt buộc.')
      return
    }
    if (!targetFeature) {
      setError('Chức năng được cấp là bắt buộc.')
      return
    }

    if (form.startAt && form.endAt && new Date(form.endAt).getTime() < new Date(form.startAt).getTime()) {
      setError('Thời gian kết thúc không được nhỏ hơn thời gian bắt đầu.')
      return
    }

    onSubmit?.({
      name,
      code,
      targetFeature,
      defaultTenantRole: form.defaultTenantRole ? Number(form.defaultTenantRole) : null,
      shortDescription: String(form.shortDescription || '').trim() || null,
      startAt: form.startAt ? new Date(form.startAt).toISOString() : null,
      endAt: form.endAt ? new Date(form.endAt).toISOString() : null,
      maxRegistrations: form.maxRegistrations ? Number(form.maxRegistrations) : null,
    })
  }

  return (
    <CModal visible={visible} onClose={() => !submitting && onClose?.()} backdrop='static'>
      <CModalHeader>
        <CModalTitle>Tạo chiến dịch đăng ký</CModalTitle>
      </CModalHeader>
      <form onSubmit={handleSubmit}>
        <CModalBody>
          {error ? <div className='alert alert-danger py-2'>{error}</div> : null}
          <CRow className='g-3'>
            <CCol md={8}>
              <CFormLabel>Tên chiến dịch</CFormLabel>
              <CFormInput value={form.name} onChange={(event) => updateField('name', event.target.value)} disabled={submitting} required />
            </CCol>
            <CCol md={4}>
              <CFormLabel>Mã chiến dịch</CFormLabel>
              <CFormInput value={form.code} onChange={(event) => updateField('code', event.target.value)} disabled={submitting} required />
            </CCol>
            <CCol xs={12}>
              <CFormLabel>Chức năng được cấp</CFormLabel>
              <CFormSelect value={form.targetFeature} onChange={(event) => updateField('targetFeature', event.target.value)} disabled={submitting} required>
                <option value=''>Chọn chức năng</option>
                {targetFeatureOptions.map((item) => (
                  <option key={item.key} value={item.key}>{item.name || item.key}</option>
                ))}
              </CFormSelect>
            </CCol>
            <CCol xs={12}>
              <CFormLabel>Vai trò mặc định trong tenant</CFormLabel>
              <CFormSelect value={form.defaultTenantRole} onChange={(event) => updateField('defaultTenantRole', event.target.value)} disabled={submitting || rolesLoading}>
                <option value=''>{rolesLoading ? 'Đang tải danh sách role...' : 'Chưa chọn vai trò mặc định'}</option>
                {roleOptions.map((item) => (
                  <option key={item.id} value={item.id}>{item.name}{item.description ? ` - ${item.description}` : ''}</option>
                ))}
              </CFormSelect>
              <div className='small text-body-secondary mt-1'>Vai trò này sẽ được sử dụng khi người đăng ký được phê duyệt và tham gia tenant.</div>
              {!form.defaultTenantRole ? <div className='small text-warning mt-1'>Bạn có thể tạo draft trước, nhưng nên chọn vai trò mặc định trước khi mở chiến dịch.</div> : null}
              {!rolesLoading && roleOptions.length === 0 ? <div className='small text-danger mt-1'>Tenant hiện chưa có role nào đang được cấp để chọn.</div> : null}
            </CCol>
            <CCol xs={12}>
              <CFormLabel>Mô tả ngắn</CFormLabel>
              <CFormTextarea rows={3} value={form.shortDescription} onChange={(event) => updateField('shortDescription', event.target.value)} disabled={submitting} />
            </CCol>
            <CCol md={6}>
              <CFormLabel>Thời gian bắt đầu</CFormLabel>
              <CFormInput type='datetime-local' value={formatDateTimeInput(form.startAt)} onChange={(event) => updateField('startAt', event.target.value)} disabled={submitting} />
            </CCol>
            <CCol md={6}>
              <CFormLabel>Thời gian kết thúc</CFormLabel>
              <CFormInput type='datetime-local' value={formatDateTimeInput(form.endAt)} onChange={(event) => updateField('endAt', event.target.value)} disabled={submitting} />
            </CCol>
            <CCol md={6}>
              <CFormLabel>Số lượng tối đa</CFormLabel>
              <CFormInput type='number' min={1} value={form.maxRegistrations} onChange={(event) => updateField('maxRegistrations', event.target.value)} disabled={submitting} />
            </CCol>
          </CRow>
        </CModalBody>
        <CModalFooter>
          <CButton color='secondary' variant='outline' onClick={onClose} disabled={submitting}>Hủy</CButton>
          <CButton type='submit' color='primary' disabled={submitting}>{submitting ? 'Đang tạo...' : 'Tạo chiến dịch'}</CButton>
        </CModalFooter>
      </form>
    </CModal>
  )
}