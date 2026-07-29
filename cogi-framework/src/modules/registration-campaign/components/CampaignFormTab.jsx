import { useEffect, useMemo, useState } from 'react'
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
  CModal,
  CModalBody,
  CModalFooter,
  CModalHeader,
  CModalTitle,
  CRow,
  CTable,
  CTableBody,
  CTableDataCell,
  CTableHead,
  CTableHeaderCell,
  CTableRow,
} from '@coreui/react'
import { buildEmptyPreviewValues, toText } from '../utils/registrationCampaignUi'

const ADDITIONAL_FIELD_TYPES = [
  { value: 'text', label: 'Text' },
  { value: 'textarea', label: 'Textarea' },
  { value: 'number', label: 'Number' },
  { value: 'select', label: 'Select' },
  { value: 'radio', label: 'Radio' },
  { value: 'checkbox', label: 'Checkbox' },
  { value: 'date', label: 'Date' },
]

function normalizeField(field, index) {
  return {
    key: field?.key || '',
    label: field?.label || '',
    type: field?.type || 'text',
    required: field?.required === true,
    placeholder: field?.placeholder || '',
    helpText: field?.helpText || '',
    options: Array.isArray(field?.options) ? field.options : [],
    enabled: field?.enabled !== false,
    order: Number(field?.order ?? index) || index,
    system: field?.system === true || ['fullName', 'email', 'phone'].includes(field?.key),
  }
}

function buildInitialFields(campaign) {
  return Array.isArray(campaign?.formConfig?.fields)
    ? campaign.formConfig.fields.map(normalizeField)
    : []
}

function buildOptionsText(options = []) {
  return options.map((item) => `${item.label || ''}:${item.value || ''}`).join('\n')
}

function parseOptions(text) {
  return String(text || '')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [label, value] = line.includes(':') ? line.split(':') : [line, line]
      return { label: String(label || '').trim(), value: String(value || label || '').trim() }
    })
    .filter((item) => item.label && item.value)
}

function FieldPreview({ field }) {
  if (field.type === 'textarea') return <textarea className='form-control' rows={3} placeholder={field.placeholder || ''} disabled />
  if (field.type === 'select') return <select className='form-select' disabled><option>{field.placeholder || 'Chọn giá trị'}</option></select>
  if (field.type === 'radio' || field.type === 'checkbox') {
    return (
      <div className='d-flex flex-column gap-2'>
        {(field.options || []).map((item) => (
          <div key={`${field.key}:${item.value}`} className='form-check'>
            <input className='form-check-input' type={field.type} disabled />
            <label className='form-check-label'>{item.label}</label>
          </div>
        ))}
      </div>
    )
  }
  return <input className='form-control' type={field.type === 'date' ? 'date' : field.type === 'number' ? 'number' : 'text'} placeholder={field.placeholder || ''} disabled />
}

function EditFieldModal({ visible, field, reservedKeys = [], onClose, onSave }) {
  const [form, setForm] = useState(field || null)
  const [optionsText, setOptionsText] = useState(buildOptionsText(field?.options || []))
  const [error, setError] = useState('')

  useEffect(() => {
    setForm(field || null)
    setOptionsText(buildOptionsText(field?.options || []))
    setError('')
  }, [field])

  if (!form) return null

  function updateField(key, value) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  function handleSubmit(event) {
    event.preventDefault()
    setError('')
    const key = toText(form.key)
    const label = toText(form.label)

    if (!key) {
      setError('Key là bắt buộc.')
      return
    }
    if (!label) {
      setError('Nhãn hiển thị là bắt buộc.')
      return
    }
    if (!form.system && reservedKeys.includes(key)) {
      setError('Key này đã tồn tại hoặc là key hệ thống.')
      return
    }
    const nextOptions = parseOptions(optionsText)
    if ((form.type === 'select' || form.type === 'radio') && nextOptions.length === 0) {
      setError('Trường select/radio phải có ít nhất một lựa chọn.')
      return
    }

    onSave?.({
      ...form,
      key,
      label,
      placeholder: toText(form.placeholder),
      helpText: toText(form.helpText),
      options: nextOptions,
    })
  }

  return (
    <CModal visible={visible} onClose={onClose} size='lg'>
      <CModalHeader>
        <CModalTitle>{form.system ? 'Cấu hình trường hệ thống' : 'Cấu hình trường bổ sung'}</CModalTitle>
      </CModalHeader>
      <form onSubmit={handleSubmit}>
        <CModalBody>
          {error ? <div className='alert alert-danger py-2'>{error}</div> : null}
          <CRow className='g-3'>
            <CCol md={6}>
              <CFormLabel>Key</CFormLabel>
              <CFormInput value={form.key} onChange={(event) => updateField('key', event.target.value)} disabled={form.system} />
            </CCol>
            <CCol md={6}>
              <CFormLabel>Kiểu</CFormLabel>
              <CFormSelect value={form.type} onChange={(event) => updateField('type', event.target.value)} disabled={form.system}>
                {ADDITIONAL_FIELD_TYPES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
              </CFormSelect>
            </CCol>
            <CCol md={6}>
              <CFormLabel>Nhãn hiển thị</CFormLabel>
              <CFormInput value={form.label} onChange={(event) => updateField('label', event.target.value)} />
            </CCol>
            <CCol md={6}>
              <CFormLabel>Placeholder</CFormLabel>
              <CFormInput value={form.placeholder || ''} onChange={(event) => updateField('placeholder', event.target.value)} />
            </CCol>
            <CCol xs={12}>
              <CFormLabel>Gợi ý trợ giúp</CFormLabel>
              <CFormInput value={form.helpText || ''} onChange={(event) => updateField('helpText', event.target.value)} />
            </CCol>
            <CCol md={6}>
              <CFormCheck label='Bật trường này' checked={form.enabled !== false} onChange={(event) => updateField('enabled', event.target.checked)} disabled={form.key === 'email'} />
            </CCol>
            <CCol md={6}>
              <CFormCheck label='Bắt buộc' checked={form.required === true} onChange={(event) => updateField('required', event.target.checked)} disabled={form.key === 'email'} />
            </CCol>
            {(form.type === 'select' || form.type === 'radio') ? (
              <CCol xs={12}>
                <CFormLabel>Lựa chọn</CFormLabel>
                <textarea className='form-control' rows={5} value={optionsText} onChange={(event) => setOptionsText(event.target.value)} placeholder='Mỗi dòng theo dạng label:value hoặc chỉ cần một giá trị' />
              </CCol>
            ) : null}
          </CRow>
        </CModalBody>
        <CModalFooter>
          <CButton color='secondary' variant='outline' onClick={onClose}>Hủy</CButton>
          <CButton type='submit' color='primary'>Lưu trường</CButton>
        </CModalFooter>
      </form>
    </CModal>
  )
}

export default function CampaignFormTab({ campaign, saving = false, onSave }) {
  const [fields, setFields] = useState(buildInitialFields(campaign))
  const [error, setError] = useState('')
  const [editingField, setEditingField] = useState(null)
  const [previewVisible, setPreviewVisible] = useState(false)

  useEffect(() => {
    setFields(buildInitialFields(campaign))
    setError('')
  }, [campaign])

  const reservedKeys = useMemo(() => fields.map((item) => item.key).filter(Boolean), [fields])

  function updateFieldAt(index, field) {
    setFields((prev) => prev.map((item, itemIndex) => itemIndex === index ? { ...field, order: itemIndex } : item))
  }

  function moveField(index, direction) {
    const nextIndex = index + direction
    if (nextIndex < 0 || nextIndex >= fields.length) return
    setFields((prev) => {
      const next = [...prev]
      const temp = next[index]
      next[index] = next[nextIndex]
      next[nextIndex] = temp
      return next.map((item, itemIndex) => ({ ...item, order: itemIndex }))
    })
  }

  function removeField(index) {
    if (fields[index]?.system) return
    setFields((prev) => prev.filter((_, itemIndex) => itemIndex !== index).map((item, itemIndex) => ({ ...item, order: itemIndex })))
  }

  function addField() {
    const newField = {
      key: '',
      label: '',
      type: 'text',
      required: false,
      placeholder: '',
      helpText: '',
      options: [],
      enabled: true,
      order: fields.length,
      system: false,
    }
    setEditingField({ mode: 'create', field: newField, index: fields.length })
  }

  function handleSaveField(field) {
    setError('')
    if (editingField?.mode === 'create') {
      setFields((prev) => [...prev, { ...field, order: prev.length }])
    } else if (typeof editingField?.index === 'number') {
      updateFieldAt(editingField.index, field)
    }
    setEditingField(null)
  }

  function handleSubmit() {
    const keys = new Set()
    for (const field of fields) {
      if (!toText(field.key)) {
        setError('Mỗi trường phải có key.')
        return
      }
      if (keys.has(field.key)) {
        setError(`Key ${field.key} đang bị trùng.`)
        return
      }
      keys.add(field.key)
      if (!field.system && ['select', 'radio'].includes(field.type) && (!Array.isArray(field.options) || field.options.length === 0)) {
        setError(`Trường ${field.key} cần có danh sách lựa chọn.`)
        return
      }
    }

    onSave?.({ formConfig: { fields: fields.map((item, index) => ({ ...item, order: index })) } })
  }

  const previewValues = buildEmptyPreviewValues({ fields })

  return (
    <div className='d-flex flex-column gap-3'>
      <CCard>
        <CCardHeader className='d-flex justify-content-between align-items-center flex-wrap gap-2'>
          <strong>Biểu mẫu đăng ký</strong>
          <div className='d-flex gap-2'>
            <CButton color='secondary' variant='outline' onClick={() => setPreviewVisible(true)}>Xem trước biểu mẫu</CButton>
            <CButton color='primary' variant='outline' onClick={addField}>Thêm trường</CButton>
          </div>
        </CCardHeader>
        <CCardBody>
          {error ? <div className='alert alert-danger py-2'>{error}</div> : null}
          <CTable responsive hover align='middle'>
            <CTableHead>
              <CTableRow>
                <CTableHeaderCell>Thứ tự</CTableHeaderCell>
                <CTableHeaderCell>Key</CTableHeaderCell>
                <CTableHeaderCell>Nhãn</CTableHeaderCell>
                <CTableHeaderCell>Kiểu</CTableHeaderCell>
                <CTableHeaderCell>Bật</CTableHeaderCell>
                <CTableHeaderCell>Bắt buộc</CTableHeaderCell>
                <CTableHeaderCell>Thao tác</CTableHeaderCell>
              </CTableRow>
            </CTableHead>
            <CTableBody>
              {fields.map((field, index) => (
                <CTableRow key={`${field.key || 'field'}:${index}`}>
                  <CTableDataCell>{index + 1}</CTableDataCell>
                  <CTableDataCell>{field.key}</CTableDataCell>
                  <CTableDataCell>
                    <div className='fw-semibold'>{field.label || '-'}</div>
                    <div className='small text-body-secondary'>{field.helpText || field.placeholder || '-'}</div>
                  </CTableDataCell>
                  <CTableDataCell>{field.type}</CTableDataCell>
                  <CTableDataCell>{field.enabled !== false ? 'Có' : 'Không'}</CTableDataCell>
                  <CTableDataCell>{field.required === true ? 'Có' : 'Không'}</CTableDataCell>
                  <CTableDataCell>
                    <div className='d-flex flex-wrap gap-2'>
                      <CButton size='sm' color='secondary' variant='outline' onClick={() => setEditingField({ mode: 'edit', field, index })}>Sửa</CButton>
                      <CButton size='sm' color='secondary' variant='outline' onClick={() => moveField(index, -1)} disabled={index === 0}>Lên</CButton>
                      <CButton size='sm' color='secondary' variant='outline' onClick={() => moveField(index, 1)} disabled={index === fields.length - 1}>Xuống</CButton>
                      {!field.system ? <CButton size='sm' color='danger' variant='outline' onClick={() => removeField(index)}>Xóa</CButton> : null}
                    </div>
                  </CTableDataCell>
                </CTableRow>
              ))}
            </CTableBody>
          </CTable>
          <div className='d-flex justify-content-end mt-3'>
            <CButton color='primary' onClick={handleSubmit} disabled={saving}>{saving ? 'Đang lưu...' : 'Lưu biểu mẫu'}</CButton>
          </div>
        </CCardBody>
      </CCard>

      <EditFieldModal
        visible={Boolean(editingField)}
        field={editingField?.field || null}
        reservedKeys={reservedKeys.filter((item) => item !== editingField?.field?.key)}
        onClose={() => setEditingField(null)}
        onSave={handleSaveField}
      />

      <CModal size='lg' visible={previewVisible} onClose={() => setPreviewVisible(false)}>
        <CModalHeader>
          <CModalTitle>Xem trước biểu mẫu</CModalTitle>
        </CModalHeader>
        <CModalBody>
          <CRow className='g-3'>
            {fields.filter((field) => field.enabled !== false).map((field) => (
              <CCol md={field.type === 'textarea' ? 12 : 6} key={`preview:${field.key}`}>
                <div className='small fw-semibold mb-1'>{field.label}{field.required ? ' *' : ''}</div>
                <FieldPreview field={field} value={previewValues[field.key]} />
                {field.helpText ? <div className='small text-body-secondary mt-1'>{field.helpText}</div> : null}
              </CCol>
            ))}
          </CRow>
        </CModalBody>
        <CModalFooter>
          <CButton color='secondary' variant='outline' onClick={() => setPreviewVisible(false)}>Đóng</CButton>
        </CModalFooter>
      </CModal>
    </div>
  )
}