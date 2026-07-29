import { useEffect, useState } from 'react'
import {
  CButton,
  CCol,
  CFormInput,
  CFormLabel,
  CFormSelect,
  CFormTextarea,
  CModal,
  CModalBody,
  CModalFooter,
  CModalHeader,
  CModalTitle,
  CRow,
} from '@coreui/react'
import { uploadMediaFiles, getMediaRelationId } from '../../content-management/services/journalIssueService'
import { formatDateTimeInput, formatDateTime, getCampaignMediaUrl, toText } from '../utils/registrationCampaignUi'

function buildRoleOptions(roleOptions = [], campaign = null) {
  const base = Array.isArray(roleOptions) ? roleOptions : []
  const currentRole = campaign?.defaultTenantRole
  if (!currentRole?.id) return base
  if (base.some((item) => Number(item?.id || 0) === Number(currentRole.id))) {
    return base
  }
  return [
    {
      id: currentRole.id,
      name: currentRole.name || `Role #${currentRole.id}`,
      description: currentRole.isAvailable === false ? 'Không còn khả dụng trong tenant hiện tại' : currentRole.description || null,
    },
    ...base,
  ]
}

function buildInitialState(campaign) {
  return {
    name: campaign?.name || '',
    code: campaign?.code || '',
    shortDescription: campaign?.shortDescription || '',
    description: campaign?.description || '',
    targetFeature: campaign?.targetFeature || '',
    defaultTenantRole: campaign?.defaultTenantRole?.id ? String(campaign.defaultTenantRole.id) : '',
    startAt: campaign?.startAt || '',
    endAt: campaign?.endAt || '',
    maxRegistrations: campaign?.maxRegistrations || '',
  }
}

export default function RegistrationCampaignBasicInfoModal({
  visible,
  campaign,
  targetFeatureOptions = [],
  roleOptions = [],
  rolesLoading = false,
  submitting = false,
  onClose,
  onSubmit,
}) {
  const [form, setForm] = useState(buildInitialState(campaign))
  const [error, setError] = useState('')
  const [coverState, setCoverState] = useState({ current: campaign?.coverImage || null, pendingFile: null, changed: false })
  const mergedRoleOptions = buildRoleOptions(roleOptions, campaign)
  const currentCoverUrl = getCampaignMediaUrl(coverState.current)

  useEffect(() => {
    if (!visible) return
    setForm(buildInitialState(campaign))
    setCoverState({ current: campaign?.coverImage || null, pendingFile: null, changed: false })
    setError('')
  }, [campaign, visible])

  function updateField(key, value) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  async function ensureUploadedId() {
    if (!coverState.pendingFile) return undefined
    const uploaded = await uploadMediaFiles([coverState.pendingFile])
    const uploadedId = getMediaRelationId(uploaded?.[0])
    if (!uploadedId) {
      throw new Error('Upload ảnh bìa thất bại')
    }
    return uploadedId
  }

  async function handleSubmit(event) {
    event.preventDefault()
    setError('')

    const name = toText(form.name)
    const code = toText(form.code).toLowerCase()
    const targetFeature = toText(form.targetFeature)
    const defaultTenantRole = String(form.defaultTenantRole || '').trim()

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

    if (campaign?.hasRegistrations && campaign?.code !== code) {
      const confirmed = window.confirm('Chiến dịch đã có đăng ký. Bạn vẫn muốn đổi mã chiến dịch?')
      if (!confirmed) return
    }

    if (campaign?.status === 'open' && campaign?.code !== code) {
      const confirmed = window.confirm('Chiến dịch đang mở. Đổi mã lúc này có thể làm thay đổi link đăng ký. Tiếp tục?')
      if (!confirmed) return
    }

    try {
      const coverImageId = await ensureUploadedId()
      onSubmit?.({
        name,
        code,
        shortDescription: toText(form.shortDescription) || null,
        description: toText(form.description) || null,
        targetFeature,
        defaultTenantRole: defaultTenantRole ? Number(defaultTenantRole) : null,
        startAt: form.startAt ? new Date(form.startAt).toISOString() : null,
        endAt: form.endAt ? new Date(form.endAt).toISOString() : null,
        maxRegistrations: form.maxRegistrations ? Number(form.maxRegistrations) : null,
        ...(coverImageId !== undefined ? { coverImage: coverImageId } : {}),
        ...(coverState.changed && !coverState.current && !coverState.pendingFile ? { coverImage: null } : {}),
      })
    } catch (submitError) {
      setError(submitError?.message || 'Không thể lưu thông tin cơ bản')
    }
  }

  return (
    <CModal visible={visible} onClose={() => !submitting && onClose?.()} size='lg' backdrop='static'>
      <CModalHeader>
        <CModalTitle>Sửa thông tin cơ bản</CModalTitle>
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
              <CFormLabel>Mô tả ngắn</CFormLabel>
              <CFormTextarea rows={2} value={form.shortDescription} onChange={(event) => updateField('shortDescription', event.target.value)} disabled={submitting} />
            </CCol>
            <CCol xs={12}>
              <CFormLabel>Mô tả</CFormLabel>
              <CFormTextarea rows={4} value={form.description} onChange={(event) => updateField('description', event.target.value)} disabled={submitting} />
            </CCol>
            <CCol md={6}>
              <CFormLabel>Chức năng được cấp</CFormLabel>
              <CFormSelect value={form.targetFeature} onChange={(event) => updateField('targetFeature', event.target.value)} disabled={submitting || campaign?.canEditTargetFeature === false}>
                <option value=''>Chọn chức năng</option>
                {targetFeatureOptions.map((item) => (
                  <option key={item.key} value={item.key}>{item.name || item.key}</option>
                ))}
              </CFormSelect>
              {campaign?.canEditTargetFeature === false ? <div className='small text-danger mt-1'>Đã có người đăng ký được hoàn tất nên không thể đổi chức năng được cấp.</div> : null}
            </CCol>
            <CCol md={6}>
              <CFormLabel>Vai trò mặc định trong tenant</CFormLabel>
              <CFormSelect value={form.defaultTenantRole} onChange={(event) => updateField('defaultTenantRole', event.target.value)} disabled={submitting || rolesLoading}>
                <option value=''>{rolesLoading ? 'Đang tải danh sách role...' : 'Chưa chọn vai trò mặc định'}</option>
                {mergedRoleOptions.map((item) => (
                  <option key={item.id} value={item.id}>{item.name}{item.description ? ` - ${item.description}` : ''}</option>
                ))}
              </CFormSelect>
              <div className='small text-body-secondary mt-1'>Vai trò này sẽ được sử dụng khi người đăng ký được phê duyệt và tham gia tenant.</div>
              {campaign?.defaultTenantRole?.id && campaign?.defaultTenantRole?.isAvailable === false ? <div className='small text-danger mt-1'>Role hiện tại không còn khả dụng trong tenant. Hãy chọn role hợp lệ khác trước khi lưu.</div> : null}
              {!rolesLoading && mergedRoleOptions.length === 0 ? <div className='small text-danger mt-1'>Tenant hiện chưa có role nào đang được cấp để chọn.</div> : null}
            </CCol>
            <CCol md={6}>
              <CFormLabel>Số lượng tối đa</CFormLabel>
              <CFormInput type='number' min={1} value={form.maxRegistrations} onChange={(event) => updateField('maxRegistrations', event.target.value)} disabled={submitting} />
            </CCol>
            <CCol md={6}>
              <CFormLabel>Thời gian bắt đầu</CFormLabel>
              <CFormInput type='datetime-local' value={formatDateTimeInput(form.startAt)} onChange={(event) => updateField('startAt', event.target.value)} disabled={submitting} />
            </CCol>
            <CCol md={6}>
              <CFormLabel>Thời gian kết thúc</CFormLabel>
              <CFormInput type='datetime-local' value={formatDateTimeInput(form.endAt)} onChange={(event) => updateField('endAt', event.target.value)} disabled={submitting} />
            </CCol>
            <CCol xs={12}>
              <CFormLabel>Ảnh bìa</CFormLabel>
              <CFormInput type='file' accept='image/*' onChange={(event) => setCoverState((prev) => ({ ...prev, pendingFile: event.target.files?.[0] || null, changed: true }))} disabled={submitting} />
              {currentCoverUrl ? (
                <div className='mt-2 d-flex align-items-center gap-3 flex-wrap'>
                  <img src={currentCoverUrl} alt='cover' style={{ width: 120, height: 72, objectFit: 'cover', borderRadius: 8, border: '1px solid #d1d5db' }} />
                  <div className='small text-body-secondary'>Ảnh hiện tại: {coverState.current.name || 'Ảnh bìa'}{campaign?.updatedAt ? ` | Cập nhật ${formatDateTime(campaign.updatedAt)}` : ''}</div>
                  <CButton color='danger' size='sm' variant='outline' onClick={() => setCoverState({ current: null, pendingFile: null, changed: true })} disabled={submitting}>Xóa ảnh</CButton>
                </div>
              ) : null}
            </CCol>
          </CRow>
        </CModalBody>
        <CModalFooter>
          <CButton color='secondary' variant='outline' onClick={onClose} disabled={submitting}>Hủy</CButton>
          <CButton type='submit' color='primary' disabled={submitting}>{submitting ? 'Đang lưu...' : 'Lưu thay đổi'}</CButton>
        </CModalFooter>
      </form>
    </CModal>
  )
}