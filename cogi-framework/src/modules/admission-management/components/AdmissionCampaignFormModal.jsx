import { useEffect, useMemo, useState } from 'react'
import {
  CButton,
  CCol,
  CFormCheck,
  CFormInput,
  CFormLabel,
  CFormSelect,
  CModal,
  CModalBody,
  CModalFooter,
  CModalHeader,
  CModalTitle,
  CRow,
} from '@coreui/react'
import SimpleHtmlEditor from './SimpleHtmlEditor'

function buildInitialState(initialValues) {
  return {
    name: initialValues?.name || '',
    code: initialValues?.code || '',
    year: initialValues?.year ? String(initialValues.year) : '',
    grade: initialValues?.grade || '',
    startDate: initialValues?.startDate || '',
    endDate: initialValues?.endDate || '',
    status: initialValues?.status || 'draft',
    description: initialValues?.description || '',
    isActive: initialValues?.isActive !== false,
    formTemplate: initialValues?.formTemplate?.id ? String(initialValues.formTemplate.id) : '',
  }
}

export default function AdmissionCampaignFormModal({
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
      year: Number(form.year || 0),
      grade: String(form.grade || '').trim(),
      startDate: String(form.startDate || '').trim() || null,
      endDate: String(form.endDate || '').trim() || null,
      status: String(form.status || 'draft').trim(),
      description: String(form.description || '').trim(),
      isActive: form.isActive === true,
      formTemplate: Number(form.formTemplate || 0),
    })
  }

  return (
    <CModal visible={visible} onClose={() => !submitting && onClose?.()} size='lg'>
      <CModalHeader>
        <CModalTitle>{initialValues?.id ? 'Chỉnh sửa chiến dịch tuyển sinh' : 'Thêm chiến dịch tuyển sinh'}</CModalTitle>
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
            <CCol md={3}>
              <CFormLabel>Năm</CFormLabel>
              <CFormInput type='number' min={1} value={form.year} onChange={(event) => updateField('year', event.target.value)} required disabled={submitting} />
            </CCol>
            <CCol md={3}>
              <CFormLabel>Khối</CFormLabel>
              <CFormInput value={form.grade} onChange={(event) => updateField('grade', event.target.value)} required disabled={submitting} />
            </CCol>
            <CCol md={6}>
              <CFormLabel>FormTemplate</CFormLabel>
              <CFormSelect value={form.formTemplate} onChange={(event) => updateField('formTemplate', event.target.value)} required disabled={submitting}>
                <option value=''>Chọn FormTemplate</option>
                {(Array.isArray(formTemplateOptions) ? formTemplateOptions : []).map((item) => (
                  <option key={item.id} value={item.id}>{item.label || `${item.name || '-'} v${item.version || 0}`}</option>
                ))}
              </CFormSelect>
              <div className='small text-body-secondary mt-1'>Version hiện tại: {selectedTemplate?.version || 0}</div>
            </CCol>
            <CCol md={3}>
              <CFormLabel>Từ ngày</CFormLabel>
              <CFormInput type='date' value={form.startDate} onChange={(event) => updateField('startDate', event.target.value)} disabled={submitting} />
            </CCol>
            <CCol md={3}>
              <CFormLabel>Đến ngày</CFormLabel>
              <CFormInput type='date' value={form.endDate} onChange={(event) => updateField('endDate', event.target.value)} disabled={submitting} />
            </CCol>
            <CCol md={3}>
              <CFormLabel>Trạng thái</CFormLabel>
              <CFormSelect value={form.status} onChange={(event) => updateField('status', event.target.value)} disabled={submitting}>
                <option value='draft'>draft</option>
                <option value='open'>open</option>
                <option value='closed'>closed</option>
              </CFormSelect>
            </CCol>
            <CCol md={3} className='d-flex align-items-end'>
              <CFormCheck label='Đang hoạt động' checked={form.isActive} onChange={(event) => updateField('isActive', event.target.checked)} disabled={submitting} />
            </CCol>
            <CCol xs={12}>
              <SimpleHtmlEditor
                label='Mô tả HTML'
                rows={10}
                value={form.description}
                onChange={(nextValue) => updateField('description', nextValue)}
                disabled={submitting}
                placeholder='<p>Giới thiệu kỳ tuyển sinh...</p><ul><li>Điểm nổi bật</li></ul>'
              />
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