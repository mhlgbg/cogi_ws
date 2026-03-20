import { useEffect, useState } from 'react'
import {
  CButton,
  CCol,
  CFormCheck,
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

const EMPTY_VALUES = {
  id: null,
  documentId: '',
  code: '',
  name: '',
  slug: '',
  level: 1,
  isLeadership: false,
  isActive: true,
  description: '',
}

function toText(value) {
  if (value === null || value === undefined) return ''
  return String(value).trim()
}

function toNumberOrDefault(value, fallback = 1) {
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) return fallback
  return Math.floor(parsed)
}

function normalizeInitialValues(initialValues = {}) {
  return {
    id: initialValues?.id ?? null,
    documentId: toText(initialValues?.documentId),
    code: toText(initialValues?.code),
    name: toText(initialValues?.name),
    slug: toText(initialValues?.slug),
    level: toNumberOrDefault(initialValues?.level, 1),
    isLeadership: Boolean(initialValues?.isLeadership),
    isActive: initialValues?.isActive !== false,
    description: toText(initialValues?.description),
  }
}

export default function PositionFormModal({
  visible = false,
  mode = 'create',
  initialValues = EMPTY_VALUES,
  onSubmit,
  onClose,
  loading = false,
}) {
  const [form, setForm] = useState(() => normalizeInitialValues(initialValues))
  const [errors, setErrors] = useState({})

  useEffect(() => {
    if (!visible) return
    setForm(normalizeInitialValues(initialValues))
    setErrors({})
  }, [visible, initialValues])

  function setField(field, value) {
    setForm((prev) => ({
      ...prev,
      [field]: value,
    }))
  }

  function validate() {
    const nextErrors = {}

    if (!toText(form.code)) {
      nextErrors.code = 'Code là bắt buộc'
    }

    if (!toText(form.name)) {
      nextErrors.name = 'Name là bắt buộc'
    }

    setErrors(nextErrors)
    return Object.keys(nextErrors).length === 0
  }

  function handleSubmit() {
    if (!validate()) return

    const payload = {
      code: toText(form.code),
      name: toText(form.name),
      slug: toText(form.slug) || null,
      level: toNumberOrDefault(form.level, 1),
      isLeadership: Boolean(form.isLeadership),
      isActive: Boolean(form.isActive),
      description: toText(form.description) || null,
    }

    if (typeof onSubmit === 'function') {
      onSubmit(payload)
    }
  }

  return (
    <CModal visible={visible} backdrop="static" onClose={() => !loading && onClose?.()}>
      <CModalHeader>
        <CModalTitle>{mode === 'edit' ? 'Chỉnh sửa Position' : 'Thêm mới Position'}</CModalTitle>
      </CModalHeader>

      <CModalBody>
        <CRow className="g-3 ai-form">
          <CCol xs={12}>
            <strong>Position Info</strong>
          </CCol>

          <CCol md={6}>
            <CFormLabel>Code</CFormLabel>
            <CFormInput
              value={form.code}
              onChange={(event) => setField('code', event.target.value)}
              invalid={Boolean(errors.code)}
            />
            {errors.code ? <div className="text-danger small mt-1">{errors.code}</div> : null}
          </CCol>

          <CCol md={6}>
            <CFormLabel>Name</CFormLabel>
            <CFormInput
              value={form.name}
              onChange={(event) => setField('name', event.target.value)}
              invalid={Boolean(errors.name)}
            />
            {errors.name ? <div className="text-danger small mt-1">{errors.name}</div> : null}
          </CCol>

          <CCol md={6}>
            <CFormLabel>Slug</CFormLabel>
            <CFormInput
              value={form.slug}
              onChange={(event) => setField('slug', event.target.value)}
              placeholder="Để trống để backend tự xử lý"
            />
          </CCol>

          <CCol md={6}>
            <CFormLabel>Level</CFormLabel>
            <CFormInput
              type="number"
              min={1}
              value={form.level}
              onChange={(event) => setField('level', event.target.value)}
            />
          </CCol>

          <CCol xs={12}>
            <CFormLabel>Description</CFormLabel>
            <CFormTextarea
              rows={3}
              value={form.description}
              onChange={(event) => setField('description', event.target.value)}
            />
          </CCol>

          <CCol md={6}>
            <CFormCheck
              id="position-is-leadership"
              label="Is leadership"
              checked={Boolean(form.isLeadership)}
              onChange={(event) => setField('isLeadership', event.target.checked)}
            />
          </CCol>

          <CCol md={6}>
            <CFormCheck
              id="position-is-active"
              label="Is active"
              checked={Boolean(form.isActive)}
              onChange={(event) => setField('isActive', event.target.checked)}
            />
          </CCol>
        </CRow>
      </CModalBody>

      <CModalFooter>
        <CButton color="secondary" variant="outline" onClick={() => onClose?.()} disabled={loading}>
          Hủy
        </CButton>
        <CButton color="primary" onClick={handleSubmit} disabled={loading}>
          {loading ? 'Đang lưu...' : 'Lưu'}
        </CButton>
      </CModalFooter>
    </CModal>
  )
}
