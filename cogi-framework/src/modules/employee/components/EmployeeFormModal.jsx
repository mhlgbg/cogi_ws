import { useEffect, useMemo, useState } from 'react'
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
import { STATUS_OPTIONS, toAbsoluteMediaUrl, toApiId, uploadAvatar } from '../services/employeeService'

const GENDER_OPTIONS = [
  { value: '', label: '-- Chọn --' },
  { value: 'male', label: 'Male' },
  { value: 'female', label: 'Female' },
  { value: 'other', label: 'Other' },
]

const EMPTY_FORM = {
  employeeCode: '',
  fullName: '',
  gender: '',
  dateOfBirth: '',
  phone: '',
  workEmail: '',
  personalEmail: '',
  address: '',
  joinDate: '',
  officialDate: '',
  status: 'active',
  currentDepartment: '',
  currentPosition: '',
  currentManager: '',
  user: '',
  note: '',
  avatarId: null,
  avatarName: '',
  avatarUrl: '',
  avatarFile: null,
  avatarCleared: false,
}

function toText(value) {
  if (value === null || value === undefined) return ''
  return String(value).trim()
}

function isValidEmail(email) {
  if (!email) return true
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email).trim())
}

function getRelationId(entity) {
  return entity?.id ? String(entity.id) : ''
}

function normalizeInitialValues(initialValues = {}) {
  return {
    employeeCode: toText(initialValues.employeeCode),
    fullName: toText(initialValues.fullName),
    gender: toText(initialValues.gender),
    dateOfBirth: initialValues.dateOfBirth || '',
    phone: toText(initialValues.phone),
    workEmail: toText(initialValues.workEmail),
    personalEmail: toText(initialValues.personalEmail),
    address: toText(initialValues.address),
    joinDate: initialValues.joinDate || '',
    officialDate: initialValues.officialDate || '',
    status: toText(initialValues.status) || 'active',
    currentDepartment: getRelationId(initialValues.currentDepartment),
    currentPosition: getRelationId(initialValues.currentPosition),
    currentManager: getRelationId(initialValues.currentManager),
    user: getRelationId(initialValues.user),
    note: toText(initialValues.note),
    avatarId: initialValues.avatar?.id || null,
    avatarName: toText(initialValues.avatar?.name),
    avatarUrl: toAbsoluteMediaUrl(initialValues.avatar?.url),
    avatarFile: null,
    avatarCleared: false,
  }
}

export default function EmployeeFormModal({
  visible = false,
  mode = 'create',
  initialValues = EMPTY_FORM,
  onSubmit,
  onClose,
  loading = false,
  departmentOptions = [],
  positionOptions = [],
  managerOptions = [],
  userOptions = [],
}) {
  const [form, setForm] = useState(() => normalizeInitialValues(initialValues))
  const [errors, setErrors] = useState({})
  const [uploadingAvatar, setUploadingAvatar] = useState(false)

  useEffect(() => {
    if (!visible) return
    setForm(normalizeInitialValues(initialValues))
    setErrors({})
    setUploadingAvatar(false)
  }, [visible, initialValues])

  const managerChoices = useMemo(() => {
    const currentId = initialValues?.id || null
    return (Array.isArray(managerOptions) ? managerOptions : []).filter((item) => item?.id !== currentId)
  }, [managerOptions, initialValues?.id])

  function setField(field, value) {
    setForm((prev) => ({
      ...prev,
      [field]: value,
    }))
  }

  function validate() {
    const nextErrors = {}

    if (!toText(form.employeeCode)) {
      nextErrors.employeeCode = 'Employee Code là bắt buộc'
    }

    if (!toText(form.fullName)) {
      nextErrors.fullName = 'Full Name là bắt buộc'
    }

    if (!toText(form.status)) {
      nextErrors.status = 'Status là bắt buộc'
    }

    if (!isValidEmail(form.workEmail)) {
      nextErrors.workEmail = 'Work Email không hợp lệ'
    }

    if (!isValidEmail(form.personalEmail)) {
      nextErrors.personalEmail = 'Personal Email không hợp lệ'
    }

    setErrors(nextErrors)
    return Object.keys(nextErrors).length === 0
  }

  async function handleSubmit() {
    if (!validate()) return

    let avatarId = form.avatarId

    if (form.avatarFile) {
      setUploadingAvatar(true)
      try {
        avatarId = await uploadAvatar(form.avatarFile)
      } finally {
        setUploadingAvatar(false)
      }
    }

    const payload = {
      employeeCode: toText(form.employeeCode),
      fullName: toText(form.fullName),
      gender: form.gender || null,
      dateOfBirth: form.dateOfBirth || null,
      phone: toText(form.phone) || null,
      workEmail: toText(form.workEmail) || null,
      personalEmail: toText(form.personalEmail) || null,
      address: toText(form.address) || null,
      joinDate: form.joinDate || null,
      officialDate: form.officialDate || null,
      status: form.status || 'active',
      currentDepartment: toApiId(form.currentDepartment),
      currentPosition: toApiId(form.currentPosition),
      currentManager: toApiId(form.currentManager),
      user: toApiId(form.user),
      note: toText(form.note) || null,
    }

    if (form.avatarCleared) {
      payload.avatar = null
    } else if (avatarId) {
      payload.avatar = avatarId
    }

    if (typeof onSubmit === 'function') {
      onSubmit(payload)
    }
  }

  return (
    <CModal visible={visible} backdrop="static" onClose={() => !loading && !uploadingAvatar && onClose?.()}>
      <CModalHeader>
        <CModalTitle>{mode === 'edit' ? 'Chỉnh sửa Employee' : 'Thêm mới Employee'}</CModalTitle>
      </CModalHeader>
      <CModalBody>
        <CRow className="g-3 ai-form">
          <CCol xs={12}>
            <strong>Employee Info</strong>
          </CCol>
          <CCol md={6}>
            <CFormLabel>Employee Code</CFormLabel>
            <CFormInput
              value={form.employeeCode}
              onChange={(event) => setField('employeeCode', event.target.value)}
              invalid={Boolean(errors.employeeCode)}
            />
            {errors.employeeCode ? <div className="text-danger small mt-1">{errors.employeeCode}</div> : null}
          </CCol>
          <CCol md={6}>
            <CFormLabel>Full Name</CFormLabel>
            <CFormInput
              value={form.fullName}
              onChange={(event) => setField('fullName', event.target.value)}
              invalid={Boolean(errors.fullName)}
            />
            {errors.fullName ? <div className="text-danger small mt-1">{errors.fullName}</div> : null}
          </CCol>
          <CCol md={4}>
            <CFormLabel>Gender</CFormLabel>
            <CFormSelect value={form.gender} onChange={(event) => setField('gender', event.target.value)}>
              {GENDER_OPTIONS.map((option) => (
                <option key={option.value || 'empty'} value={option.value}>{option.label}</option>
              ))}
            </CFormSelect>
          </CCol>
          <CCol md={4}>
            <CFormLabel>Date of Birth</CFormLabel>
            <CFormInput type="date" value={form.dateOfBirth} onChange={(event) => setField('dateOfBirth', event.target.value)} />
          </CCol>
          <CCol md={4}>
            <CFormLabel>Phone</CFormLabel>
            <CFormInput value={form.phone} onChange={(event) => setField('phone', event.target.value)} />
          </CCol>

          <CCol xs={12}>
            <strong>Contact</strong>
          </CCol>
          <CCol md={6}>
            <CFormLabel>Work Email</CFormLabel>
            <CFormInput
              type="email"
              value={form.workEmail}
              onChange={(event) => setField('workEmail', event.target.value)}
              invalid={Boolean(errors.workEmail)}
            />
            {errors.workEmail ? <div className="text-danger small mt-1">{errors.workEmail}</div> : null}
          </CCol>
          <CCol md={6}>
            <CFormLabel>Personal Email</CFormLabel>
            <CFormInput
              type="email"
              value={form.personalEmail}
              onChange={(event) => setField('personalEmail', event.target.value)}
              invalid={Boolean(errors.personalEmail)}
            />
            {errors.personalEmail ? <div className="text-danger small mt-1">{errors.personalEmail}</div> : null}
          </CCol>
          <CCol xs={12}>
            <CFormLabel>Address</CFormLabel>
            <CFormTextarea rows={2} value={form.address} onChange={(event) => setField('address', event.target.value)} />
          </CCol>

          <CCol xs={12}>
            <strong>Work Info</strong>
          </CCol>
          <CCol md={4}>
            <CFormLabel>Join Date</CFormLabel>
            <CFormInput type="date" value={form.joinDate} onChange={(event) => setField('joinDate', event.target.value)} />
          </CCol>
          <CCol md={4}>
            <CFormLabel>Official Date</CFormLabel>
            <CFormInput type="date" value={form.officialDate} onChange={(event) => setField('officialDate', event.target.value)} />
          </CCol>
          <CCol md={4}>
            <CFormLabel>Status</CFormLabel>
            <CFormSelect
              value={form.status}
              onChange={(event) => setField('status', event.target.value)}
              invalid={Boolean(errors.status)}
            >
              {STATUS_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </CFormSelect>
            {errors.status ? <div className="text-danger small mt-1">{errors.status}</div> : null}
          </CCol>

          <CCol xs={12}>
            <strong>Relations</strong>
          </CCol>
          <CCol md={6}>
            <CFormLabel>Current Department</CFormLabel>
            <CFormSelect value={form.currentDepartment} onChange={(event) => setField('currentDepartment', event.target.value)}>
              <option value="">-- Chọn --</option>
              {(Array.isArray(departmentOptions) ? departmentOptions : []).map((department) => (
                <option key={department.id} value={department.id}>
                  {department.name || department.label || `Department #${department.id}`}
                </option>
              ))}
            </CFormSelect>
          </CCol>
          <CCol md={6}>
            <CFormLabel>Current Position</CFormLabel>
            <CFormSelect value={form.currentPosition} onChange={(event) => setField('currentPosition', event.target.value)}>
              <option value="">-- Chọn --</option>
              {(Array.isArray(positionOptions) ? positionOptions : []).map((position) => (
                <option key={position.id} value={position.id}>
                  {position.name || position.label || `Position #${position.id}`}
                </option>
              ))}
            </CFormSelect>
          </CCol>
          <CCol md={6}>
            <CFormLabel>Current Manager</CFormLabel>
            <CFormSelect value={form.currentManager} onChange={(event) => setField('currentManager', event.target.value)}>
              <option value="">-- Chọn --</option>
              {managerChoices.map((manager) => (
                <option key={manager.id} value={manager.id}>
                  {`${manager.employeeCode || '-'} - ${manager.fullName || `Employee #${manager.id}`}`}
                </option>
              ))}
            </CFormSelect>
          </CCol>
          <CCol md={6}>
            <CFormLabel>User (optional)</CFormLabel>
            <CFormSelect value={form.user} onChange={(event) => setField('user', event.target.value)}>
              <option value="">-- Chọn --</option>
              {(Array.isArray(userOptions) ? userOptions : []).map((user) => (
                <option key={user.id} value={user.id}>
                  {user.username || user.email || `User #${user.id}`}
                </option>
              ))}
            </CFormSelect>
          </CCol>

          <CCol xs={12}>
            <strong>Other</strong>
          </CCol>
          <CCol xs={12}>
            <CFormLabel>Avatar upload</CFormLabel>
            <CFormInput
              type="file"
              accept="image/*"
              onChange={(event) => {
                const file = event.target.files?.[0] || null
                setForm((prev) => ({
                  ...prev,
                  avatarFile: file,
                  avatarName: file?.name || prev.avatarName,
                  avatarCleared: false,
                }))
              }}
            />
            <div className="small text-body-secondary mt-1">
              {form.avatarFile
                ? `File mới: ${form.avatarFile.name}`
                : form.avatarName
                  ? `Hiện tại: ${form.avatarName}`
                  : 'Chưa có avatar'}
            </div>
            {form.avatarUrl ? (
              <div className="mt-2 d-flex align-items-center gap-2">
                <img
                  src={form.avatarUrl}
                  alt="Avatar"
                  style={{ width: 72, height: 72, objectFit: 'cover', borderRadius: 8, border: '1px solid #dee2e6' }}
                />
                <a href={form.avatarUrl} target="_blank" rel="noreferrer">Xem avatar hiện tại</a>
                <CButton
                  type="button"
                  size="sm"
                  color="danger"
                  variant="outline"
                  onClick={() => {
                    setForm((prev) => ({
                      ...prev,
                      avatarId: null,
                      avatarName: '',
                      avatarUrl: '',
                      avatarFile: null,
                      avatarCleared: true,
                    }))
                  }}
                >
                  Xóa avatar
                </CButton>
              </div>
            ) : null}
          </CCol>
          <CCol xs={12}>
            <CFormLabel>Note</CFormLabel>
            <CFormTextarea rows={3} value={form.note} onChange={(event) => setField('note', event.target.value)} />
          </CCol>
        </CRow>
      </CModalBody>

      <CModalFooter>
        <CButton color="secondary" variant="outline" onClick={() => onClose?.()} disabled={loading || uploadingAvatar}>
          Hủy
        </CButton>
        <CButton color="primary" onClick={handleSubmit} disabled={loading || uploadingAvatar}>
          {loading || uploadingAvatar ? 'Đang lưu...' : 'Lưu'}
        </CButton>
      </CModalFooter>
    </CModal>
  )
}
