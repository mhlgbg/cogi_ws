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

function stringifySchema(value) {
  if (value === null || value === undefined) return '{\n  \n}'
  try {
    return JSON.stringify(value, null, 2)
  } catch {
    return '{\n  \n}'
  }
}

function buildInitialState(initialValues) {
  return {
    name: initialValues?.name || '',
    version: initialValues?.version ? String(initialValues.version) : '1',
    status: initialValues?.status || 'draft',
    isLocked: initialValues?.isLocked === true,
    schema: stringifySchema(initialValues?.schema),
  }
}

export default function FormTemplateFormModal({
  visible,
  initialValues,
  submitting = false,
  onClose,
  onSubmit,
}) {
  const [form, setForm] = useState(buildInitialState(initialValues))

  useEffect(() => {
    if (!visible) return
    setForm(buildInitialState(initialValues))
  }, [initialValues, visible])

  const title = useMemo(() => {
    if (initialValues?.id) return 'Chỉnh sửa FormTemplate'
    return 'Thêm FormTemplate'
  }, [initialValues])

  function updateField(key, value) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  function handleSubmit(event) {
    event.preventDefault()
    onSubmit?.({
      name: String(form.name || '').trim(),
      version: Number(form.version || 0),
      status: String(form.status || 'draft').trim(),
      isLocked: form.isLocked === true,
      schema: String(form.schema || ''),
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
            <CCol md={7}>
              <CFormLabel>Tên FormTemplate</CFormLabel>
              <CFormInput value={form.name} onChange={(event) => updateField('name', event.target.value)} required disabled={submitting} />
            </CCol>
            <CCol md={2}>
              <CFormLabel>Version</CFormLabel>
              <CFormInput type='number' min={1} value={form.version} onChange={(event) => updateField('version', event.target.value)} required disabled={submitting} />
            </CCol>
            <CCol md={3}>
              <CFormLabel>Trạng thái</CFormLabel>
              <CFormSelect value={form.status} onChange={(event) => updateField('status', event.target.value)} disabled={submitting}>
                <option value='draft'>draft</option>
                <option value='published'>published</option>
                <option value='archived'>archived</option>
              </CFormSelect>
            </CCol>
            <CCol xs={12}>
              <CFormCheck label='Khóa chỉnh sửa schema' checked={form.isLocked} onChange={(event) => updateField('isLocked', event.target.checked)} disabled={submitting} />
            </CCol>
            <CCol xs={12}>
              <CFormLabel>Schema JSON</CFormLabel>
              <CFormTextarea rows={18} value={form.schema} onChange={(event) => updateField('schema', event.target.value)} disabled={submitting} style={{ fontFamily: 'monospace' }} required />
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