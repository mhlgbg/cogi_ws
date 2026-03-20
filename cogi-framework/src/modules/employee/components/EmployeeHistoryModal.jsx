import { useEffect, useMemo, useState } from 'react'
import {
  CAlert,
  CBadge,
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
  CSpinner,
  CTable,
  CTableBody,
  CTableDataCell,
  CTableHead,
  CTableHeaderCell,
  CTableRow,
} from '@coreui/react'
import {
  ASSIGNMENT_TYPE_OPTIONS,
  formatDateDDMMYYYY,
  getAssignmentTypeMeta,
  toApiId,
  toEntityKey,
} from '../services/employeeService'

const EMPTY_HISTORY_FORM = {
  department: '',
  position: '',
  manager: '',
  startDate: '',
  endDate: '',
  assignmentType: 'official',
  isPrimary: false,
  isCurrent: true,
  decisionNo: '',
  note: '',
}

export default function EmployeeHistoryModal({
  visible = false,
  employee = null,
  rows = [],
  loading = false,
  saving = false,
  error = '',
  onClose,
  onRefresh,
  onSave,
  departmentOptions = [],
  positionOptions = [],
  managerOptions = [],
}) {
  const [showForm, setShowForm] = useState(false)
  const [editingRow, setEditingRow] = useState(null)
  const [form, setForm] = useState(EMPTY_HISTORY_FORM)
  const [formErrors, setFormErrors] = useState({})

  useEffect(() => {
    if (!visible) return
    setShowForm(false)
    setEditingRow(null)
    setForm(EMPTY_HISTORY_FORM)
    setFormErrors({})
  }, [visible])

  const managerChoices = useMemo(() => {
    const employeeId = employee?.id || null
    return (Array.isArray(managerOptions) ? managerOptions : []).filter((item) => item?.id !== employeeId)
  }, [managerOptions, employee?.id])

  function openCreate() {
    setEditingRow(null)
    setForm(EMPTY_HISTORY_FORM)
    setFormErrors({})
    setShowForm(true)
  }

  function openEdit(row) {
    setEditingRow(row)
    setForm({
      department: row?.department?.id ? String(row.department.id) : '',
      position: row?.position?.id ? String(row.position.id) : '',
      manager: row?.manager?.id ? String(row.manager.id) : '',
      startDate: row?.startDate || '',
      endDate: row?.endDate || '',
      assignmentType: row?.assignmentType || 'official',
      isPrimary: Boolean(row?.isPrimary),
      isCurrent: Boolean(row?.isCurrent),
      decisionNo: row?.decisionNo || '',
      note: row?.note || '',
    })
    setFormErrors({})
    setShowForm(true)
  }

  function validate() {
    const errors = {}

    if (!form.department) {
      errors.department = 'Department là bắt buộc'
    }

    if (!form.position) {
      errors.position = 'Position là bắt buộc'
    }

    if (!form.startDate) {
      errors.startDate = 'Start Date là bắt buộc'
    }

    if (form.startDate && form.endDate && form.endDate < form.startDate) {
      errors.endDate = 'End Date không được nhỏ hơn Start Date'
    }

    setFormErrors(errors)
    return Object.keys(errors).length === 0
  }

  async function submitHistory() {
    if (!employee?.id || !validate()) return

    const payload = {
      employee: employee.id,
      department: toApiId(form.department),
      position: toApiId(form.position),
      manager: toApiId(form.manager),
      startDate: form.startDate,
      endDate: form.endDate || null,
      assignmentType: form.assignmentType || 'official',
      isPrimary: Boolean(form.isPrimary),
      isCurrent: form.endDate ? false : Boolean(form.isCurrent),
      decisionNo: String(form.decisionNo || '').trim() || null,
      note: String(form.note || '').trim() || null,
    }

    await onSave?.({
      id: toEntityKey(editingRow),
      payload,
    })

    setShowForm(false)
    setEditingRow(null)
    setForm(EMPTY_HISTORY_FORM)
    setFormErrors({})
  }

  return (
    <CModal visible={visible} size="xl" backdrop="static" onClose={() => !saving && onClose?.()}>
      <CModalHeader>
        <CModalTitle>
          Employee History — {employee?.fullName || employee?.employeeCode || '-'}
        </CModalTitle>
      </CModalHeader>
      <CModalBody>
        {error ? <CAlert color="danger">{error}</CAlert> : null}

        <div className="d-flex justify-content-between align-items-center flex-wrap gap-2 mb-3">
          <strong>Work History</strong>
          <div className="d-flex gap-2">
            <CButton color="secondary" variant="outline" size="sm" onClick={() => onRefresh?.()} disabled={loading || saving}>
              Refresh
            </CButton>
            <CButton color="primary" size="sm" onClick={openCreate} disabled={saving}>
              Thêm History
            </CButton>
          </div>
        </div>

        {loading ? (
          <div className="d-flex align-items-center gap-2 mb-3">
            <CSpinner size="sm" />
            <span>Đang tải lịch sử công tác...</span>
          </div>
        ) : rows.length === 0 ? (
          <div className="text-body-secondary mb-3">No work history yet</div>
        ) : (
          <CTable hover responsive className="mb-3 ai-table">
            <CTableHead>
              <CTableRow>
                <CTableHeaderCell style={{ width: 70 }}>STT</CTableHeaderCell>
                <CTableHeaderCell style={{ minWidth: 170 }}>Department</CTableHeaderCell>
                <CTableHeaderCell style={{ minWidth: 170 }}>Position</CTableHeaderCell>
                <CTableHeaderCell style={{ minWidth: 180 }}>Manager</CTableHeaderCell>
                <CTableHeaderCell style={{ minWidth: 130 }}>Start Date</CTableHeaderCell>
                <CTableHeaderCell style={{ minWidth: 130 }}>End Date</CTableHeaderCell>
                <CTableHeaderCell style={{ minWidth: 150 }}>Assignment Type</CTableHeaderCell>
                <CTableHeaderCell style={{ minWidth: 120 }}>Primary</CTableHeaderCell>
                <CTableHeaderCell style={{ minWidth: 120 }}>Current</CTableHeaderCell>
                <CTableHeaderCell style={{ minWidth: 140 }}>Decision No</CTableHeaderCell>
                <CTableHeaderCell style={{ minWidth: 200 }}>Note</CTableHeaderCell>
                <CTableHeaderCell style={{ minWidth: 120 }}>Actions</CTableHeaderCell>
              </CTableRow>
            </CTableHead>
            <CTableBody>
              {rows.map((row, index) => {
                const typeMeta = getAssignmentTypeMeta(row.assignmentType)
                const isCurrentView = !row.endDate && row.isCurrent

                return (
                  <CTableRow key={toEntityKey(row) || `${row.startDate}-${index}`}>
                    <CTableDataCell>{index + 1}</CTableDataCell>
                    <CTableDataCell>{row.department?.name || '-'}</CTableDataCell>
                    <CTableDataCell>{row.position?.name || '-'}</CTableDataCell>
                    <CTableDataCell>{row.manager?.fullName || '-'}</CTableDataCell>
                    <CTableDataCell>{formatDateDDMMYYYY(row.startDate)}</CTableDataCell>
                    <CTableDataCell>{formatDateDDMMYYYY(row.endDate)}</CTableDataCell>
                    <CTableDataCell><CBadge color={typeMeta.color}>{typeMeta.label}</CBadge></CTableDataCell>
                    <CTableDataCell><CBadge color={row.isPrimary ? 'primary' : 'secondary'}>{row.isPrimary ? 'Yes' : 'No'}</CBadge></CTableDataCell>
                    <CTableDataCell><CBadge color={isCurrentView ? 'success' : 'secondary'}>{isCurrentView ? 'Current' : 'Closed'}</CBadge></CTableDataCell>
                    <CTableDataCell>{row.decisionNo || '-'}</CTableDataCell>
                    <CTableDataCell>{row.note || '-'}</CTableDataCell>
                    <CTableDataCell>
                      <CButton color="primary" size="sm" variant="outline" onClick={() => openEdit(row)} disabled={saving}>
                        Sửa
                      </CButton>
                    </CTableDataCell>
                  </CTableRow>
                )
              })}
            </CTableBody>
          </CTable>
        )}

        {showForm ? (
          <>
            <hr />
            <div className="d-flex justify-content-between align-items-center mb-2">
              <strong>{editingRow ? 'Chỉnh sửa History' : 'Thêm mới History'}</strong>
              <CButton color="secondary" variant="outline" size="sm" onClick={() => setShowForm(false)} disabled={saving}>
                Đóng form
              </CButton>
            </div>
            <CRow className="g-3 ai-form">
              <CCol md={6}>
                <CFormLabel>Department</CFormLabel>
                <CFormSelect value={form.department} onChange={(event) => setForm((prev) => ({ ...prev, department: event.target.value }))} invalid={Boolean(formErrors.department)}>
                  <option value="">-- Chọn --</option>
                  {(Array.isArray(departmentOptions) ? departmentOptions : []).map((department) => (
                    <option key={department.id} value={department.id}>{department.name || department.label || `Department #${department.id}`}</option>
                  ))}
                </CFormSelect>
                {formErrors.department ? <div className="text-danger small mt-1">{formErrors.department}</div> : null}
              </CCol>
              <CCol md={6}>
                <CFormLabel>Position</CFormLabel>
                <CFormSelect value={form.position} onChange={(event) => setForm((prev) => ({ ...prev, position: event.target.value }))} invalid={Boolean(formErrors.position)}>
                  <option value="">-- Chọn --</option>
                  {(Array.isArray(positionOptions) ? positionOptions : []).map((position) => (
                    <option key={position.id} value={position.id}>{position.name || position.label || `Position #${position.id}`}</option>
                  ))}
                </CFormSelect>
                {formErrors.position ? <div className="text-danger small mt-1">{formErrors.position}</div> : null}
              </CCol>
              <CCol md={6}>
                <CFormLabel>Manager</CFormLabel>
                <CFormSelect value={form.manager} onChange={(event) => setForm((prev) => ({ ...prev, manager: event.target.value }))}>
                  <option value="">-- Chọn --</option>
                  {managerChoices.map((manager) => (
                    <option key={manager.id} value={manager.id}>{`${manager.employeeCode || '-'} - ${manager.fullName || `Employee #${manager.id}`}`}</option>
                  ))}
                </CFormSelect>
              </CCol>
              <CCol md={3}>
                <CFormLabel>Start Date</CFormLabel>
                <CFormInput type="date" value={form.startDate} onChange={(event) => setForm((prev) => ({ ...prev, startDate: event.target.value }))} invalid={Boolean(formErrors.startDate)} />
                {formErrors.startDate ? <div className="text-danger small mt-1">{formErrors.startDate}</div> : null}
              </CCol>
              <CCol md={3}>
                <CFormLabel>End Date</CFormLabel>
                <CFormInput type="date" value={form.endDate} onChange={(event) => setForm((prev) => ({ ...prev, endDate: event.target.value }))} invalid={Boolean(formErrors.endDate)} />
                {formErrors.endDate ? <div className="text-danger small mt-1">{formErrors.endDate}</div> : null}
              </CCol>
              <CCol md={4}>
                <CFormLabel>Assignment Type</CFormLabel>
                <CFormSelect value={form.assignmentType} onChange={(event) => setForm((prev) => ({ ...prev, assignmentType: event.target.value }))}>
                  {ASSIGNMENT_TYPE_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </CFormSelect>
              </CCol>
              <CCol md={4} className="d-flex align-items-center">
                <CFormCheck
                  id="history-is-primary"
                  label="Is Primary"
                  checked={Boolean(form.isPrimary)}
                  onChange={(event) => setForm((prev) => ({ ...prev, isPrimary: event.target.checked }))}
                />
              </CCol>
              <CCol md={4} className="d-flex align-items-center">
                <CFormCheck
                  id="history-is-current"
                  label="Is Current"
                  checked={Boolean(form.isCurrent)}
                  onChange={(event) => setForm((prev) => ({ ...prev, isCurrent: event.target.checked }))}
                  disabled={Boolean(form.endDate)}
                />
              </CCol>
              <CCol md={6}>
                <CFormLabel>Decision No</CFormLabel>
                <CFormInput value={form.decisionNo} onChange={(event) => setForm((prev) => ({ ...prev, decisionNo: event.target.value }))} />
              </CCol>
              <CCol xs={12}>
                <CFormLabel>Note</CFormLabel>
                <CFormTextarea rows={2} value={form.note} onChange={(event) => setForm((prev) => ({ ...prev, note: event.target.value }))} />
              </CCol>
              <CCol xs={12} className="d-flex justify-content-end gap-2">
                <CButton color="secondary" variant="outline" onClick={() => setShowForm(false)} disabled={saving}>
                  Hủy
                </CButton>
                <CButton color="primary" onClick={submitHistory} disabled={saving}>
                  {saving ? 'Đang lưu...' : 'Lưu History'}
                </CButton>
              </CCol>
            </CRow>
          </>
        ) : null}
      </CModalBody>

      <CModalFooter>
        <CButton color="secondary" variant="outline" onClick={() => onClose?.()} disabled={saving}>
          Đóng
        </CButton>
      </CModalFooter>
    </CModal>
  )
}
