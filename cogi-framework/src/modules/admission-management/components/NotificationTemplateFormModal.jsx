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

function stringifyVariables(value) {
  if (value === null || value === undefined) return '{\n  \n}'
  try {
    return JSON.stringify(value, null, 2)
  } catch {
    return '{\n  \n}'
  }
}

function buildInitialState(initialValues) {
  return {
    code: initialValues?.code || '',
    name: initialValues?.name || '',
    subject: initialValues?.subject || '',
    content: initialValues?.content || '',
    variables: stringifyVariables(initialValues?.variables),
    type: initialValues?.type || 'email',
    isActive: initialValues?.isActive !== false,
  }
}

export default function NotificationTemplateFormModal({
  visible,
  initialValues,
  onClose,
  onSubmit,
  submitting = false,
}) {
  const [form, setForm] = useState(buildInitialState(initialValues))

  useEffect(() => {
    if (!visible) return
    setForm(buildInitialState(initialValues))
  }, [initialValues, visible])

  const title = useMemo(() => {
    if (initialValues?.id) return 'Chỉnh sửa NotificationTemplate'
    return 'Thêm NotificationTemplate'
  }, [initialValues])

  function updateField(key, value) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  function handleSubmit(event) {
    event.preventDefault()
    onSubmit?.({
      code: String(form.code || '').trim(),
      name: String(form.name || '').trim(),
      subject: String(form.subject || '').trim(),
      content: String(form.content || '').trim(),
      variables: String(form.variables || '').trim(),
      type: String(form.type || 'email').trim(),
      isActive: form.isActive === true,
    })
  }

  return (
    <CModal visible={visible} onClose={() => !submitting && onClose?.()} size='xl'>
      <CModalHeader>
        <CModalTitle>{title}</CModalTitle>
      </CModalHeader>
      <form onSubmit={handleSubmit}>
        <CModalBody>
          <CRow className='g-3'>
            <CCol md={4}>
              <CFormLabel>Code</CFormLabel>
              <CFormInput value={form.code} onChange={(event) => updateField('code', event.target.value)} required disabled={submitting} placeholder='admission_invite' />
            </CCol>
            <CCol md={5}>
              <CFormLabel>Tên template</CFormLabel>
              <CFormInput value={form.name} onChange={(event) => updateField('name', event.target.value)} required disabled={submitting} />
            </CCol>
            <CCol md={3}>
              <CFormLabel>Loại</CFormLabel>
              <CFormSelect value={form.type} onChange={(event) => updateField('type', event.target.value)} disabled={submitting}>
                <option value='email'>email</option>
                <option value='sms'>sms</option>
                <option value='ui'>ui</option>
              </CFormSelect>
            </CCol>
            <CCol md={9}>
              <CFormLabel>Subject</CFormLabel>
              <CFormInput value={form.subject} onChange={(event) => updateField('subject', event.target.value)} required disabled={submitting} />
            </CCol>
            <CCol md={3} className='d-flex align-items-end'>
              <CFormCheck label='Đang hoạt động' checked={form.isActive} onChange={(event) => updateField('isActive', event.target.checked)} disabled={submitting} />
            </CCol>
            <CCol xs={12}>
              <CFormLabel>Content</CFormLabel>
              <CFormTextarea rows={12} value={form.content} onChange={(event) => updateField('content', event.target.value)} required disabled={submitting} placeholder='Xin chào {{tenantName}} ...' />
            </CCol>
            <CCol xs={12}>
              <CFormLabel>Variables JSON</CFormLabel>
              <CFormTextarea rows={8} value={form.variables} onChange={(event) => updateField('variables', event.target.value)} disabled={submitting} style={{ fontFamily: 'monospace' }} placeholder={'{\n  "tenantName": "Tên trường",\n  "link": "Link kích hoạt"\n}'} />
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