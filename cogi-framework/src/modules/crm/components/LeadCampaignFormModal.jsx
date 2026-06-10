import { useEffect, useMemo, useState } from 'react'
import {
  CButton,
  CCol,
  CFormCheck,
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
import SimpleHtmlEditor from '../../admission-management/components/SimpleHtmlEditor'

function formatDateTimeLocalValue(value) {
  const text = String(value || '').trim()
  if (!text) return ''

  const date = new Date(text)
  if (Number.isNaN(date.getTime())) return ''

  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  const hours = String(date.getHours()).padStart(2, '0')
  const minutes = String(date.getMinutes()).padStart(2, '0')

  return `${year}-${month}-${day}T${hours}:${minutes}`
}

function buildInitialState(initialValues) {
  const internalNotifyEmails = Array.isArray(initialValues?.internalNotifyEmails)
    ? initialValues.internalNotifyEmails.join('\n')
    : String(initialValues?.internalNotifyEmails || '').trim()

  return {
    name: initialValues?.name || '',
    code: initialValues?.code || '',
    leadCampaignStatus: initialValues?.leadCampaignStatus || initialValues?.status || 'draft',
    formTemplate: initialValues?.formTemplate?.id ? String(initialValues.formTemplate.id) : '',
    startDate: formatDateTimeLocalValue(initialValues?.startDate),
    endDate: formatDateTimeLocalValue(initialValues?.endDate),
    description: initialValues?.description || '',
    successMessage: initialValues?.successMessage || '',
    submitButtonText: initialValues?.submitButtonText || 'Đăng ký',
    autoReplyEnabled: initialValues?.autoReplyEnabled === true,
    autoReplySubject: initialValues?.autoReplySubject || '',
    autoReplyHtml: initialValues?.autoReplyHtml || '',
    internalNotifyEnabled: initialValues?.internalNotifyEnabled === true,
    internalNotifyEmails,
  }
}

function toEmailList(value) {
  return String(value || '')
    .split(/[,\n;]/g)
    .map((item) => item.trim())
    .filter(Boolean)
}

export default function LeadCampaignFormModal({
  visible,
  initialValues,
  formTemplateOptions = [],
  onClose,
  onSubmit,
  submitting = false,
}) {
  const [form, setForm] = useState(buildInitialState(initialValues))

  useEffect(() => {
    if (!visible) return
    setForm(buildInitialState(initialValues))
  }, [initialValues, visible])

  const selectedTemplate = useMemo(
    () => (Array.isArray(formTemplateOptions) ? formTemplateOptions : []).find((item) => String(item?.id || '') === String(form.formTemplate || '')) || null,
    [form.formTemplate, formTemplateOptions],
  )

  function updateField(key, value) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  function handleSubmit(event) {
    event.preventDefault()
    onSubmit?.({
      name: String(form.name || '').trim(),
      code: String(form.code || '').trim(),
      leadCampaignStatus: String(form.leadCampaignStatus || 'draft').trim(),
      formTemplate: Number(form.formTemplate || 0) || null,
      startDate: String(form.startDate || '').trim() || null,
      endDate: String(form.endDate || '').trim() || null,
      description: String(form.description || '').trim(),
      successMessage: String(form.successMessage || '').trim(),
      submitButtonText: String(form.submitButtonText || '').trim() || 'Đăng ký',
      autoReplyEnabled: form.autoReplyEnabled === true,
      autoReplySubject: String(form.autoReplySubject || '').trim(),
      autoReplyHtml: String(form.autoReplyHtml || '').trim(),
      internalNotifyEnabled: form.internalNotifyEnabled === true,
      internalNotifyEmails: toEmailList(form.internalNotifyEmails),
    })
  }

  return (
    <CModal visible={visible} onClose={() => !submitting && onClose?.()} size='lg' backdrop='static'>
      <CModalHeader>
        <CModalTitle>{initialValues?.id ? 'Chỉnh sửa chiến dịch lead' : 'Thêm chiến dịch lead'}</CModalTitle>
      </CModalHeader>
      <form onSubmit={handleSubmit}>
        <CModalBody>
          <CRow className='g-3'>
            <CCol md={8}>
              <CFormLabel>Tên chiến dịch</CFormLabel>
              <CFormInput value={form.name} onChange={(event) => updateField('name', event.target.value)} required disabled={submitting} />
            </CCol>
            <CCol md={4}>
              <CFormLabel>Mã chiến dịch</CFormLabel>
              <CFormInput value={form.code} onChange={(event) => updateField('code', event.target.value)} required disabled={submitting} />
            </CCol>
            <CCol md={4}>
              <CFormLabel>Trạng thái</CFormLabel>
              <CFormSelect value={form.leadCampaignStatus} onChange={(event) => updateField('leadCampaignStatus', event.target.value)} disabled={submitting}>
                <option value='draft'>draft</option>
                <option value='active'>active</option>
                <option value='paused'>paused</option>
                <option value='closed'>closed</option>
                <option value='archived'>archived</option>
              </CFormSelect>
            </CCol>
            <CCol md={8}>
              <CFormLabel>FormTemplate</CFormLabel>
              <CFormSelect value={form.formTemplate} onChange={(event) => updateField('formTemplate', event.target.value)} disabled={submitting}>
                <option value=''>Chọn FormTemplate</option>
                {(Array.isArray(formTemplateOptions) ? formTemplateOptions : []).map((item) => (
                  <option key={item.id} value={item.id}>{item.label || `${item.name || '-'} v${item.version || 0}`}</option>
                ))}
              </CFormSelect>
              <div className='small text-body-secondary mt-1'>Version hiện tại: {selectedTemplate?.version || 0}</div>
            </CCol>
            <CCol md={6}>
              <CFormLabel>Bắt đầu nhận lead</CFormLabel>
              <CFormInput type='datetime-local' value={form.startDate} onChange={(event) => updateField('startDate', event.target.value)} disabled={submitting} />
            </CCol>
            <CCol md={6}>
              <CFormLabel>Kết thúc nhận lead</CFormLabel>
              <CFormInput type='datetime-local' value={form.endDate} onChange={(event) => updateField('endDate', event.target.value)} disabled={submitting} />
            </CCol>
            <CCol xs={12}>
              <CFormLabel>Mô tả</CFormLabel>
              <CFormTextarea rows={4} value={form.description} onChange={(event) => updateField('description', event.target.value)} disabled={submitting} />
            </CCol>
            <CCol xs={12}>
              <CFormLabel>Thông điệp sau khi gửi form</CFormLabel>
              <CFormTextarea rows={3} value={form.successMessage} onChange={(event) => updateField('successMessage', event.target.value)} disabled={submitting} />
            </CCol>
            <CCol md={6}>
              <CFormLabel>Nhãn nút submit</CFormLabel>
              <CFormInput value={form.submitButtonText} onChange={(event) => updateField('submitButtonText', event.target.value)} disabled={submitting} />
            </CCol>
            <CCol xs={12}>
              <CFormCheck
                label='Bật email phản hồi tự động'
                checked={form.autoReplyEnabled}
                onChange={(event) => updateField('autoReplyEnabled', event.target.checked)}
                disabled={submitting}
              />
            </CCol>
            <CCol xs={12}>
              <CFormLabel>Tiêu đề email phản hồi</CFormLabel>
              <CFormInput value={form.autoReplySubject} onChange={(event) => updateField('autoReplySubject', event.target.value)} disabled={submitting || !form.autoReplyEnabled} />
            </CCol>
            <CCol xs={12}>
              <SimpleHtmlEditor
                label='Nội dung email phản hồi tự động'
                rows={12}
                value={form.autoReplyHtml}
                onChange={(nextValue) => updateField('autoReplyHtml', nextValue)}
                disabled={submitting || !form.autoReplyEnabled}
                placeholder='<p>Cảm ơn Anh/Chị đã để lại thông tin.</p>'
              />
            </CCol>
            <CCol xs={12}>
              <CFormCheck
                label='Bật email thông báo nội bộ'
                checked={form.internalNotifyEnabled}
                onChange={(event) => updateField('internalNotifyEnabled', event.target.checked)}
                disabled={submitting}
              />
            </CCol>
            <CCol xs={12}>
              <CFormLabel>Email nhận thông báo nội bộ</CFormLabel>
              <CFormTextarea
                rows={4}
                value={form.internalNotifyEmails}
                onChange={(event) => updateField('internalNotifyEmails', event.target.value)}
                disabled={submitting || !form.internalNotifyEnabled}
                placeholder='lead@example.com&#10;sales@example.com'
              />
              <div className='small text-body-secondary mt-1'>Mỗi dòng một email, hoặc phân tách bằng dấu phẩy.</div>
            </CCol>
          </CRow>
        </CModalBody>
        <CModalFooter>
          <CButton color='secondary' variant='outline' onClick={onClose} disabled={submitting}>Hủy</CButton>
          <CButton color='primary' type='submit' disabled={submitting}>{submitting ? 'Đang lưu...' : 'Lưu'}</CButton>
        </CModalFooter>
      </form>
    </CModal>
  )
}
