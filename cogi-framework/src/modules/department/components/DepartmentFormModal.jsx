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

const DEFAULT_SCOPE_OPTIONS = [
  { value: 'GROUP', label: 'GROUP' },
  { value: 'COMPANY', label: 'COMPANY' },
  { value: 'DEPARTMENT', label: 'DEPARTMENT' },
  { value: 'TEAM', label: 'TEAM' },
]

const EMPTY_VALUES = {
  id: null,
  documentId: '',
  code: '',
  name: '',
  slug: '',
  scopeType: 'DEPARTMENT',
  isActive: true,
  parent: '',
  manager: '',
  sortOrder: 0,
  description: '',
}

function toText(value) {
  if (value === null || value === undefined) return ''
  return String(value).trim()
}

function toNumberOrDefault(value, fallback = 0) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

function relationRef(value) {
  if (!value) return ''
  if (typeof value === 'string' || typeof value === 'number') return String(value)
  return String(value.id || value.documentId || '')
}

function toEntityKey(value) {
  if (!value || typeof value !== 'object') return ''
  return toText(value.documentId) || toText(value.id)
}

function normalizeInitialValues(initialValues = {}) {
  return {
    id: initialValues?.id ?? null,
    documentId: toText(initialValues?.documentId),
    code: toText(initialValues?.code),
    name: toText(initialValues?.name),
    slug: toText(initialValues?.slug),
    scopeType: toText(initialValues?.scopeType) || 'DEPARTMENT',
    isActive: initialValues?.isActive !== false,
    parent: relationRef(initialValues?.parent),
    manager: relationRef(initialValues?.manager),
    sortOrder: toNumberOrDefault(initialValues?.sortOrder, 0),
    description: toText(initialValues?.description),
  }
}

function relationPayload(value) {
  const ref = toText(value)
  if (!ref) return null
  if (/^\d+$/.test(ref)) return Number(ref)
  return ref
}

export default function DepartmentFormModal({
  visible = false,
  mode = 'create',
  initialValues = EMPTY_VALUES,
  onSubmit,
  onClose,
  loading = false,
  parentOptions = [],
  managerOptions = [],
  allowManagerSelection = true,
  scopeTypeOptions = DEFAULT_SCOPE_OPTIONS,
  tenantLabel = '',
}) {
  const [form, setForm] = useState(() => normalizeInitialValues(initialValues))
  const [errors, setErrors] = useState({})

  useEffect(() => {
    if (!visible) return
    setForm(normalizeInitialValues(initialValues))
    setErrors({})
  }, [visible, initialValues])

  const currentEntityKey = useMemo(() => {
    const normalized = normalizeInitialValues(initialValues)
    return toText(normalized.documentId) || toText(normalized.id)
  }, [initialValues])

  const availableParentOptions = useMemo(() => {
    return (Array.isArray(parentOptions) ? parentOptions : []).filter((item) => {
      const optionKey = toEntityKey(item)
      if (!optionKey) return true
      if (!currentEntityKey) return true
      return optionKey !== currentEntityKey
    })
  }, [parentOptions, currentEntityKey])

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

    const parentRef = relationPayload(form.parent)
    const managerRef = relationPayload(form.manager)

    const payload = {
      code: toText(form.code),
      name: toText(form.name),
      slug: toText(form.slug) || null,
      scopeType: toText(form.scopeType) || 'DEPARTMENT',
      isActive: Boolean(form.isActive),
      sortOrder: toNumberOrDefault(form.sortOrder, 0),
      description: toText(form.description) || null,
    }

    if (parentRef !== null) {
      payload.parent = parentRef
    }

    if (allowManagerSelection && managerRef !== null) {
      payload.manager = managerRef
    }

    if (typeof onSubmit === 'function') {
      onSubmit(payload)
    }
  }

  return (
    <CModal visible={visible} backdrop="static" onClose={() => !loading && onClose?.()}>
      <CModalHeader>
        <CModalTitle>{mode === 'edit' ? 'Chỉnh sửa Department' : 'Thêm mới Department'}</CModalTitle>
      </CModalHeader>

      <CModalBody>
        <CRow className="g-3 ai-form">
          <CCol xs={12}>
            <strong>Department Info</strong>
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
            />
          </CCol>

          <CCol md={6}>
            <CFormLabel>Scope Type</CFormLabel>
            <CFormSelect
              value={form.scopeType}
              onChange={(event) => setField('scopeType', event.target.value)}
            >
              {(Array.isArray(scopeTypeOptions) ? scopeTypeOptions : DEFAULT_SCOPE_OPTIONS).map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </CFormSelect>
          </CCol>

          <CCol xs={12}>
            <strong>Relations</strong>
          </CCol>

          <CCol md={6}>
            <CFormLabel>Parent Department</CFormLabel>
            <CFormSelect
              value={form.parent}
              onChange={(event) => setField('parent', event.target.value)}
            >
              <option value="">-- Chọn --</option>
              {availableParentOptions.map((item) => {
                const value = toEntityKey(item)
                return (
                  <option key={value || item.name} value={value}>
                    {item.name || item.code || `Department #${item.id}`}
                  </option>
                )
              })}
            </CFormSelect>
          </CCol>

          {allowManagerSelection ? (
            <CCol md={6}>
              <CFormLabel>Manager</CFormLabel>
              <CFormSelect
                value={form.manager}
                onChange={(event) => setField('manager', event.target.value)}
              >
                <option value="">-- Chọn --</option>
                {(Array.isArray(managerOptions) ? managerOptions : []).map((item) => {
                  const value = toEntityKey(item)
                  const label = item.name || item.fullName || item.code || `Employee #${item.id}`
                  return (
                    <option key={value || label} value={value}>
                      {label}
                    </option>
                  )
                })}
              </CFormSelect>
            </CCol>
          ) : null}

          <CCol xs={12}>
            <strong>Other</strong>
          </CCol>

          <CCol md={6}>
            <CFormLabel>Sort Order</CFormLabel>
            <CFormInput
              type="number"
              value={form.sortOrder}
              onChange={(event) => setField('sortOrder', event.target.value)}
            />
          </CCol>

          <CCol md={6}>
            <CFormLabel>Tenant</CFormLabel>
            <CFormInput
              value={tenantLabel || '(resolved by backend)'}
              disabled
              readOnly
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

          <CCol xs={12}>
            <CFormCheck
              id="department-is-active"
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
