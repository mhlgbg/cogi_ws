import { useCallback, useEffect, useMemo, useState } from "react"
import { useNavigate, useParams } from "react-router-dom"
import {
  CAlert,
  CBadge,
  CButton,
  CCard,
  CCardBody,
  CCardHeader,
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
  CNav,
  CNavItem,
  CNavLink,
  CRow,
  CSpinner,
  CTable,
  CTableBody,
  CTableDataCell,
  CTableHead,
  CTableHeaderCell,
  CTableRow,
  CTabContent,
  CTabPane,
} from "@coreui/react"
import axios from "../../api/api"
import {
  ASSIGNMENT_TYPE_OPTIONS,
  formatDateDDMMYYYY,
  getAssignmentTypeMeta,
  getStatusMeta,
  STATUS_OPTIONS,
} from "./hrFormatters"

const GENDER_OPTIONS = [
  { value: "", label: "-- Chọn --" },
  { value: "male", label: "Male" },
  { value: "female", label: "Female" },
  { value: "other", label: "Other" },
]


const EMPTY_EMPLOYEE_FORM = {
  employeeCode: "",
  fullName: "",
  gender: "",
  dateOfBirth: "",
  phone: "",
  workEmail: "",
  personalEmail: "",
  address: "",
  joinDate: "",
  officialDate: "",
  status: "active",
  currentDepartment: "",
  currentPosition: "",
  currentManager: "",
  user: "",
  note: "",
  avatarId: null,
  avatarName: "",
  avatarUrl: "",
  avatarFile: null,
  avatarCleared: false,
}

const EMPTY_HISTORY_FORM = {
  department: "",
  position: "",
  manager: "",
  startDate: "",
  endDate: "",
  assignmentType: "official",
  isPrimary: false,
  isCurrent: true,
  decisionNo: "",
  note: "",
}

function normalizeApiRows(payload) {
  if (Array.isArray(payload?.data)) return payload.data
  if (Array.isArray(payload)) return payload
  return []
}

function flattenEntity(entity) {
  if (!entity) return null

  if (entity?.data) {
    const row = entity.data
    if (!row) return null
    if (row?.attributes) {
      return { id: row.id, documentId: row.documentId, ...row.attributes }
    }
    return row
  }

  if (entity?.attributes) {
    return { id: entity.id, documentId: entity.documentId, ...entity.attributes }
  }

  return entity
}

function parsePositiveInteger(value) {
  const parsed = Number(value)
  if (!Number.isInteger(parsed) || parsed <= 0) return null
  return parsed
}

function toFileUrl(url) {
  if (!url) return ""
  if (String(url).startsWith("http")) return url

  const apiBaseUrl = (import.meta.env.VITE_API_BASE_URL || "").replace(/\/+$/, "")
  if (!apiBaseUrl) return url

  const normalizedPath = String(url).startsWith("/") ? String(url) : `/${String(url)}`
  const hostBase = apiBaseUrl.endsWith("/api") ? apiBaseUrl.slice(0, -4) : apiBaseUrl
  return `${hostBase}${normalizedPath}`
}

function getIdentifier(row) {
  return row?.documentId || row?.id || null
}

function getRelationId(entity) {
  return entity?.id ? String(entity.id) : ""
}

function normalizeOptionRows(payload) {
  return normalizeApiRows(payload).map((row) => {
    const item = row?.attributes ? { id: row.id, documentId: row.documentId, ...row.attributes } : row
    return item
  })
}

function isValidEmail(email) {
  if (!email) return true
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email).trim())
}

function toEmployeeRow(item) {
  const source = item?.attributes ? { id: item.id, documentId: item.documentId, ...item.attributes } : item

  const department = flattenEntity(source?.currentDepartment)
  const position = flattenEntity(source?.currentPosition)
  const manager = flattenEntity(source?.currentManager)
  const user = flattenEntity(source?.user)
  const avatar = flattenEntity(source?.avatar)

  return {
    id: source?.id,
    documentId: source?.documentId || null,
    employeeCode: source?.employeeCode || "",
    fullName: source?.fullName || "",
    gender: source?.gender || "",
    dateOfBirth: source?.dateOfBirth || "",
    phone: source?.phone || "",
    workEmail: source?.workEmail || "",
    personalEmail: source?.personalEmail || "",
    address: source?.address || "",
    joinDate: source?.joinDate || "",
    officialDate: source?.officialDate || "",
    status: source?.status || "",
    note: source?.note || "",
    department,
    position,
    manager,
    user,
    avatar,
    updatedAt: source?.updatedAt || null,
  }
}

function toHistoryRow(item) {
  const source = item?.attributes ? { id: item.id, documentId: item.documentId, ...item.attributes } : item

  return {
    id: source?.id,
    documentId: source?.documentId || null,
    startDate: source?.startDate || "",
    endDate: source?.endDate || "",
    assignmentType: source?.assignmentType || "official",
    isPrimary: Boolean(source?.isPrimary),
    isCurrent: Boolean(source?.isCurrent),
    decisionNo: source?.decisionNo || "",
    note: source?.note || "",
    createdAt: source?.createdAt || null,
    department: flattenEntity(source?.department),
    position: flattenEntity(source?.position),
    manager: flattenEntity(source?.manager),
    employee: flattenEntity(source?.employee),
  }
}

export default function EmployeeDetail() {
  const navigate = useNavigate()
  const { id } = useParams()

  const [activeTab, setActiveTab] = useState("basic")

  const [loadingEmployee, setLoadingEmployee] = useState(true)
  const [employeeError, setEmployeeError] = useState("")
  const [employee, setEmployee] = useState(null)

  const [departments, setDepartments] = useState([])
  const [positions, setPositions] = useState([])
  const [managers, setManagers] = useState([])
  const [users, setUsers] = useState([])

  const [showEmployeeModal, setShowEmployeeModal] = useState(false)
  const [employeeForm, setEmployeeForm] = useState(EMPTY_EMPLOYEE_FORM)
  const [employeeFormErrors, setEmployeeFormErrors] = useState({})
  const [savingEmployee, setSavingEmployee] = useState(false)

  const [loadingHistory, setLoadingHistory] = useState(false)
  const [historyRows, setHistoryRows] = useState([])
  const [historyError, setHistoryError] = useState("")

  const [showHistoryModal, setShowHistoryModal] = useState(false)
  const [editingHistoryRow, setEditingHistoryRow] = useState(null)
  const [historyForm, setHistoryForm] = useState(EMPTY_HISTORY_FORM)
  const [historyFormErrors, setHistoryFormErrors] = useState({})
  const [savingHistory, setSavingHistory] = useState(false)

  const headerStatus = useMemo(() => getStatusMeta(employee?.status), [employee?.status])

  const managerOptions = useMemo(() => {
    const currentEmployeeId = employee?.id || null
    return managers.filter((item) => item.id !== currentEmployeeId)
  }, [employee?.id, managers])

  const loadOptions = useCallback(async () => {
    try {
      const [departmentRes, positionRes, managerRes, userRes] = await Promise.all([
        axios.get("/departments", {
          params: {
            "pagination[page]": 1,
            "pagination[pageSize]": 200,
            "sort[0]": "name:asc",
          },
        }),
        axios.get("/positions", {
          params: {
            "pagination[page]": 1,
            "pagination[pageSize]": 200,
            "sort[0]": "name:asc",
          },
        }),
        axios.get("/employees", {
          params: {
            "pagination[page]": 1,
            "pagination[pageSize]": 500,
            "sort[0]": "fullName:asc",
          },
        }),
        axios.get("/users", {
          params: {
            "pagination[page]": 1,
            "pagination[pageSize]": 500,
            sort: "username:asc",
          },
        }),
      ])

      setDepartments(normalizeOptionRows(departmentRes?.data))
      setPositions(normalizeOptionRows(positionRes?.data))
      setManagers(normalizeOptionRows(managerRes?.data))

      const userRowsRaw = normalizeApiRows(userRes?.data)
      setUsers(
        userRowsRaw.map((item) =>
          item?.attributes ? { id: item.id, documentId: item.documentId, ...item.attributes } : item
        )
      )
    } catch {
      setDepartments([])
      setPositions([])
      setManagers([])
      setUsers([])
    }
  }, [])

  const loadEmployee = useCallback(async () => {
    if (!id) return

    setLoadingEmployee(true)
    setEmployeeError("")

    try {
      const response = await axios.get(`/employees/${encodeURIComponent(id)}`, {
        params: {
          "populate[currentDepartment][fields][0]": "name",
          "populate[currentPosition][fields][0]": "name",
          "populate[currentManager][fields][0]": "employeeCode",
          "populate[currentManager][fields][1]": "fullName",
          "populate[user][fields][0]": "username",
          "populate[user][fields][1]": "email",
          "populate[avatar][fields][0]": "name",
          "populate[avatar][fields][1]": "url",
        },
      })

      const row = response?.data?.data || response?.data
      const normalized = toEmployeeRow(row)
      setEmployee(normalized)
    } catch (error) {
      setEmployee(null)
      setEmployeeError(error?.response?.data?.error?.message || error?.message || "Không tải được chi tiết nhân sự")
    } finally {
      setLoadingEmployee(false)
    }
  }, [id])

  const loadHistory = useCallback(async () => {
    if (!employee?.id) return

    setLoadingHistory(true)
    setHistoryError("")

    try {
      const response = await axios.get("/employee-histories", {
        params: {
          "pagination[page]": 1,
          "pagination[pageSize]": 500,
          "sort[0]": "startDate:desc",
          "sort[1]": "createdAt:desc",
          "filters[employee][id][$eq]": employee.id,
          "populate[employee][fields][0]": "fullName",
          "populate[department][fields][0]": "name",
          "populate[position][fields][0]": "name",
          "populate[manager][fields][0]": "employeeCode",
          "populate[manager][fields][1]": "fullName",
        },
      })

      const rows = normalizeApiRows(response?.data).map(toHistoryRow)
      setHistoryRows(rows)
    } catch (error) {
      setHistoryRows([])
      setHistoryError(error?.response?.data?.error?.message || error?.message || "Không tải được lịch sử công tác")
    } finally {
      setLoadingHistory(false)
    }
  }, [employee?.id])

  useEffect(() => {
    loadOptions()
  }, [loadOptions])

  useEffect(() => {
    loadEmployee()
  }, [loadEmployee])

  useEffect(() => {
    loadHistory()
  }, [loadHistory])

  async function uploadAvatar(file) {
    if (!file) return null

    const formData = new FormData()
    formData.append("files", file)

    const response = await axios.post("/upload", formData)
    const rows = Array.isArray(response?.data) ? response.data : []
    const first = rows[0]
    return first?.id ? Number(first.id) : null
  }

  function openEditEmployeeModal() {
    if (!employee) return

    setEmployeeForm({
      employeeCode: employee.employeeCode || "",
      fullName: employee.fullName || "",
      gender: employee.gender || "",
      dateOfBirth: employee.dateOfBirth || "",
      phone: employee.phone || "",
      workEmail: employee.workEmail || "",
      personalEmail: employee.personalEmail || "",
      address: employee.address || "",
      joinDate: employee.joinDate || "",
      officialDate: employee.officialDate || "",
      status: employee.status || "active",
      currentDepartment: getRelationId(employee.department),
      currentPosition: getRelationId(employee.position),
      currentManager: getRelationId(employee.manager),
      user: getRelationId(employee.user),
      note: employee.note || "",
      avatarId: employee.avatar?.id || null,
      avatarName: employee.avatar?.name || "",
      avatarUrl: toFileUrl(employee.avatar?.url),
      avatarFile: null,
      avatarCleared: false,
    })

    setEmployeeFormErrors({})
    setShowEmployeeModal(true)
  }

  function validateEmployeeForm() {
    const errors = {}

    if (!String(employeeForm.employeeCode || "").trim()) {
      errors.employeeCode = "Employee Code là bắt buộc"
    }

    if (!String(employeeForm.fullName || "").trim()) {
      errors.fullName = "Full Name là bắt buộc"
    }

    if (!String(employeeForm.status || "").trim()) {
      errors.status = "Status là bắt buộc"
    }

    if (!isValidEmail(employeeForm.workEmail)) {
      errors.workEmail = "Work Email không hợp lệ"
    }

    if (!isValidEmail(employeeForm.personalEmail)) {
      errors.personalEmail = "Personal Email không hợp lệ"
    }

    setEmployeeFormErrors(errors)
    return Object.keys(errors).length === 0
  }

  async function onSaveEmployee() {
    if (!employee || !validateEmployeeForm()) return

    setSavingEmployee(true)
    setEmployeeError("")

    try {
      let avatarId = employeeForm.avatarId
      if (employeeForm.avatarFile) {
        avatarId = await uploadAvatar(employeeForm.avatarFile)
      }

      const payload = {
        employeeCode: String(employeeForm.employeeCode || "").trim(),
        fullName: String(employeeForm.fullName || "").trim(),
        gender: employeeForm.gender || null,
        dateOfBirth: employeeForm.dateOfBirth || null,
        phone: String(employeeForm.phone || "").trim() || null,
        workEmail: String(employeeForm.workEmail || "").trim() || null,
        personalEmail: String(employeeForm.personalEmail || "").trim() || null,
        address: String(employeeForm.address || "").trim() || null,
        joinDate: employeeForm.joinDate || null,
        officialDate: employeeForm.officialDate || null,
        status: employeeForm.status || "active",
        currentDepartment: parsePositiveInteger(employeeForm.currentDepartment),
        currentPosition: parsePositiveInteger(employeeForm.currentPosition),
        currentManager: parsePositiveInteger(employeeForm.currentManager),
        user: parsePositiveInteger(employeeForm.user),
        note: String(employeeForm.note || "").trim() || null,
      }

      if (employeeForm.avatarCleared) {
        payload.avatar = null
      } else if (avatarId) {
        payload.avatar = avatarId
      }

      const identifier = getIdentifier(employee)
      await axios.put(`/employees/${encodeURIComponent(identifier)}`, { data: payload })

      setShowEmployeeModal(false)
      await loadEmployee()
      await loadOptions()
    } catch (error) {
      setEmployeeError(error?.response?.data?.error?.message || error?.message || "Lưu nhân sự thất bại")
    } finally {
      setSavingEmployee(false)
    }
  }

  function openCreateHistoryModal() {
    setEditingHistoryRow(null)
    setHistoryForm(EMPTY_HISTORY_FORM)
    setHistoryFormErrors({})
    setHistoryError("")
    setShowHistoryModal(true)
  }

  function openEditHistoryModal(row) {
    setEditingHistoryRow(row)
    setHistoryForm({
      department: getRelationId(row.department),
      position: getRelationId(row.position),
      manager: getRelationId(row.manager),
      startDate: row.startDate || "",
      endDate: row.endDate || "",
      assignmentType: row.assignmentType || "official",
      isPrimary: Boolean(row.isPrimary),
      isCurrent: Boolean(row.isCurrent),
      decisionNo: row.decisionNo || "",
      note: row.note || "",
    })
    setHistoryFormErrors({})
    setHistoryError("")
    setShowHistoryModal(true)
  }

  function validateHistoryForm() {
    const errors = {}

    if (!historyForm.department) {
      errors.department = "Department là bắt buộc"
    }

    if (!historyForm.position) {
      errors.position = "Position là bắt buộc"
    }

    if (!historyForm.startDate) {
      errors.startDate = "Start Date là bắt buộc"
    }

    if (historyForm.startDate && historyForm.endDate && historyForm.endDate < historyForm.startDate) {
      errors.endDate = "End Date không được nhỏ hơn Start Date"
    }

    setHistoryFormErrors(errors)
    return Object.keys(errors).length === 0
  }

  async function onSaveHistory() {
    if (!employee?.id || !validateHistoryForm()) return

    setSavingHistory(true)
    setHistoryError("")

    try {
      const payload = {
        employee: employee.id,
        department: parsePositiveInteger(historyForm.department),
        position: parsePositiveInteger(historyForm.position),
        manager: parsePositiveInteger(historyForm.manager),
        startDate: historyForm.startDate,
        endDate: historyForm.endDate || null,
        assignmentType: historyForm.assignmentType || "official",
        isPrimary: Boolean(historyForm.isPrimary),
        isCurrent: historyForm.endDate ? false : Boolean(historyForm.isCurrent),
        decisionNo: String(historyForm.decisionNo || "").trim() || null,
        note: String(historyForm.note || "").trim() || null,
      }

      const identifier = getIdentifier(editingHistoryRow)
      if (identifier) {
        await axios.put(`/employee-histories/${encodeURIComponent(identifier)}`, { data: payload })
      } else {
        await axios.post("/employee-histories", { data: payload })
      }

      setShowHistoryModal(false)
      await Promise.all([loadHistory(), loadEmployee()])
    } catch (error) {
      const backendMessage = error?.response?.data?.error?.message
      setHistoryError(backendMessage || error?.message || "Lưu lịch sử công tác thất bại")
    } finally {
      setSavingHistory(false)
    }
  }

  return (
    <CRow className="justify-content-center">
      <CCol xs={12} style={{ maxWidth: 1500 }}>
        <CCard className="mb-4 ai-card">
          <CCardHeader className="d-flex justify-content-between align-items-center flex-wrap gap-2">
            <div>
              <strong>Employee Detail</strong>
            </div>
            <div className="d-flex gap-2">
              <CButton color="secondary" variant="outline" onClick={() => navigate("/employees")}>
                Back to Employees
              </CButton>
              <CButton color="primary" onClick={openEditEmployeeModal} disabled={!employee || loadingEmployee}>
                Edit Employee
              </CButton>
            </div>
          </CCardHeader>
          <CCardBody>
            {loadingEmployee ? (
              <div className="d-flex align-items-center gap-2">
                <CSpinner size="sm" />
                <span>Đang tải thông tin nhân sự...</span>
              </div>
            ) : employeeError ? (
              <CAlert color="danger">{employeeError}</CAlert>
            ) : !employee ? (
              <CAlert color="warning">Không tìm thấy nhân sự</CAlert>
            ) : (
              <>
                <CCard className="mb-3 border-0 bg-light">
                  <CCardBody className="py-3">
                    <div className="d-flex align-items-center gap-3 flex-wrap">
                      {employee.avatar?.url ? (
                        <img
                          src={toFileUrl(employee.avatar.url)}
                          alt={employee.fullName || "Employee avatar"}
                          style={{ width: 64, height: 64, objectFit: "cover", borderRadius: "50%", border: "1px solid #dee2e6" }}
                        />
                      ) : (
                        <div
                          className="d-flex align-items-center justify-content-center text-body-secondary"
                          style={{ width: 64, height: 64, borderRadius: "50%", border: "1px solid #dee2e6", fontSize: 24 }}
                        >
                          👤
                        </div>
                      )}

                      <div className="flex-grow-1">
                        <div className="h5 mb-1">{employee.fullName || "-"}</div>
                        <div className="text-body-secondary mb-2">{employee.employeeCode || "-"}</div>
                        <div className="small text-body-secondary">
                          {employee.department?.name || "-"} | {employee.position?.name || "-"} | {employee.manager?.fullName || "-"} |
                          <span className="ms-1">
                            <CBadge color={headerStatus.color}>{headerStatus.label}</CBadge>
                          </span>
                        </div>
                      </div>
                    </div>
                  </CCardBody>
                </CCard>

                <div className="d-flex justify-content-between align-items-center gap-3 flex-wrap mb-3">
                  <div>
                    <div className="h6 mb-0">Employee Information</div>
                  </div>
                </div>

                <CNav variant="tabs" role="tablist" className="mb-3">
                  <CNavItem>
                    <CNavLink active={activeTab === "basic"} onClick={() => setActiveTab("basic")}>
                      Basic Info
                    </CNavLink>
                  </CNavItem>
                  <CNavItem>
                    <CNavLink active={activeTab === "history"} onClick={() => setActiveTab("history")}>
                      Work History
                    </CNavLink>
                  </CNavItem>
                  <CNavItem>
                    <CNavLink active={activeTab === "documents"} onClick={() => setActiveTab("documents")}>
                      Documents
                    </CNavLink>
                  </CNavItem>
                </CNav>

                <CTabContent>
                  <CTabPane role="tabpanel" visible={activeTab === "basic"}>
                    <CCard className="ai-card">
                      <CCardBody>
                        <CRow className="g-3 ai-form">
                          <CCol xs={12} className="d-flex justify-content-center">
                            {employee.avatar?.url ? (
                              <img
                                src={toFileUrl(employee.avatar.url)}
                                alt={employee.fullName || "Employee avatar"}
                                style={{ width: 120, height: 120, objectFit: "cover", borderRadius: "50%", border: "1px solid #dee2e6" }}
                              />
                            ) : (
                              <div className="text-body-secondary">Chưa có avatar</div>
                            )}
                          </CCol>

                          <CCol md={6}>
                            <CFormLabel>Employee Code</CFormLabel>
                            <CFormInput value={employee.employeeCode || "-"} readOnly />
                          </CCol>
                          <CCol md={6}>
                            <CFormLabel>Full Name</CFormLabel>
                            <CFormInput value={employee.fullName || "-"} readOnly />
                          </CCol>
                          <CCol md={4}>
                            <CFormLabel>Gender</CFormLabel>
                            <CFormInput value={employee.gender || "-"} readOnly />
                          </CCol>
                          <CCol md={4}>
                            <CFormLabel>Date of Birth</CFormLabel>
                            <CFormInput value={formatDateDDMMYYYY(employee.dateOfBirth)} readOnly />
                          </CCol>
                          <CCol md={4}>
                            <CFormLabel>Phone</CFormLabel>
                            <CFormInput value={employee.phone || "-"} readOnly />
                          </CCol>
                          <CCol md={6}>
                            <CFormLabel>Work Email</CFormLabel>
                            <CFormInput value={employee.workEmail || "-"} readOnly />
                          </CCol>
                          <CCol md={6}>
                            <CFormLabel>Personal Email</CFormLabel>
                            <CFormInput value={employee.personalEmail || "-"} readOnly />
                          </CCol>
                          <CCol xs={12}>
                            <CFormLabel>Address</CFormLabel>
                            <CFormTextarea rows={2} value={employee.address || ""} readOnly />
                          </CCol>
                          <CCol md={4}>
                            <CFormLabel>Join Date</CFormLabel>
                            <CFormInput value={formatDateDDMMYYYY(employee.joinDate)} readOnly />
                          </CCol>
                          <CCol md={4}>
                            <CFormLabel>Official Date</CFormLabel>
                            <CFormInput value={formatDateDDMMYYYY(employee.officialDate)} readOnly />
                          </CCol>
                          <CCol md={4}>
                            <CFormLabel>Status</CFormLabel>
                            <CFormInput value={getStatusMeta(employee.status).label || "-"} readOnly />
                          </CCol>
                          <CCol md={4}>
                            <CFormLabel>Current Department</CFormLabel>
                            <CFormInput value={employee.department?.name || "-"} readOnly />
                          </CCol>
                          <CCol md={4}>
                            <CFormLabel>Current Position</CFormLabel>
                            <CFormInput value={employee.position?.name || "-"} readOnly />
                          </CCol>
                          <CCol md={4}>
                            <CFormLabel>Current Manager</CFormLabel>
                            <CFormInput value={employee.manager?.fullName || "-"} readOnly />
                          </CCol>
                          <CCol xs={12}>
                            <CFormLabel>Note</CFormLabel>
                            <CFormTextarea rows={3} value={employee.note || ""} readOnly />
                          </CCol>
                        </CRow>
                      </CCardBody>
                    </CCard>
                  </CTabPane>

                  <CTabPane role="tabpanel" visible={activeTab === "history"}>
                    <CCard className="ai-card">
                      <CCardHeader className="d-flex justify-content-between align-items-center gap-2 flex-wrap">
                        <strong>Employee History</strong>
                        <CButton color="primary" size="sm" onClick={openCreateHistoryModal} disabled={!employee?.id}>
                          Thêm History
                        </CButton>
                      </CCardHeader>
                      <CCardBody>
                        {historyError ? <CAlert color="danger">{historyError}</CAlert> : null}

                        {loadingHistory ? (
                          <div className="d-flex align-items-center gap-2">
                            <CSpinner size="sm" />
                            <span>Đang tải lịch sử công tác...</span>
                          </div>
                        ) : historyRows.length === 0 ? (
                          <CCard className="border-0 bg-light mb-0">
                            <CCardBody className="text-center py-4">
                              <div className="text-body-secondary mb-2">No work history yet</div>
                              <CButton color="primary" size="sm" onClick={openCreateHistoryModal}>
                                Add Work History
                              </CButton>
                            </CCardBody>
                          </CCard>
                        ) : (
                          <CTable hover responsive className="mb-0 ai-table">
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
                                <CTableHeaderCell style={{ minWidth: 140 }}>Actions</CTableHeaderCell>
                              </CTableRow>
                            </CTableHead>
                            <CTableBody>
                              {historyRows.map((row, index) => {
                                const typeMeta = getAssignmentTypeMeta(row.assignmentType)
                                const isCurrentView = !row.endDate && row.isCurrent

                                return (
                                  <CTableRow key={row.documentId || row.id}>
                                    <CTableDataCell>{index + 1}</CTableDataCell>
                                    <CTableDataCell>{row.department?.name || "-"}</CTableDataCell>
                                    <CTableDataCell>{row.position?.name || "-"}</CTableDataCell>
                                    <CTableDataCell>{row.manager?.fullName || "-"}</CTableDataCell>
                                    <CTableDataCell>{formatDateDDMMYYYY(row.startDate)}</CTableDataCell>
                                    <CTableDataCell>{formatDateDDMMYYYY(row.endDate)}</CTableDataCell>
                                    <CTableDataCell>
                                      <CBadge color={typeMeta.color}>{typeMeta.label}</CBadge>
                                    </CTableDataCell>
                                    <CTableDataCell>
                                      <CBadge color={row.isPrimary ? "primary" : "secondary"}>{row.isPrimary ? "Yes" : "No"}</CBadge>
                                    </CTableDataCell>
                                    <CTableDataCell>
                                      <CBadge color={isCurrentView ? "success" : "secondary"}>{isCurrentView ? "Current" : "Closed"}</CBadge>
                                    </CTableDataCell>
                                    <CTableDataCell>{row.decisionNo || "-"}</CTableDataCell>
                                    <CTableDataCell>{row.note || "-"}</CTableDataCell>
                                    <CTableDataCell>
                                      <CButton color="primary" size="sm" variant="outline" onClick={() => openEditHistoryModal(row)}>
                                        Sửa
                                      </CButton>
                                    </CTableDataCell>
                                  </CTableRow>
                                )
                              })}
                            </CTableBody>
                          </CTable>
                        )}
                      </CCardBody>
                    </CCard>
                  </CTabPane>

                  <CTabPane role="tabpanel" visible={activeTab === "documents"}>
                    <CCard className="ai-card">
                      <CCardBody>
                        <div className="text-body-secondary">
                          This feature will allow storing employee documents such as contracts, certificates and ID copies.
                        </div>
                      </CCardBody>
                    </CCard>
                  </CTabPane>
                </CTabContent>
              </>
            )}
          </CCardBody>
        </CCard>
      </CCol>

      <CModal
        visible={showEmployeeModal}
        backdrop="static"
        onClose={() => !savingEmployee && setShowEmployeeModal(false)}
      >
        <CModalHeader>
          <CModalTitle>Chỉnh sửa Employee</CModalTitle>
        </CModalHeader>
        <CModalBody>
          <CRow className="g-3 ai-form">
            <CCol xs={12}>
              <strong>Employee Info</strong>
            </CCol>
            <CCol md={6}>
              <CFormLabel>Employee Code</CFormLabel>
              <CFormInput
                value={employeeForm.employeeCode}
                onChange={(event) => setEmployeeForm((prev) => ({ ...prev, employeeCode: event.target.value }))}
                invalid={Boolean(employeeFormErrors.employeeCode)}
              />
              {employeeFormErrors.employeeCode ? (
                <div className="text-danger small mt-1">{employeeFormErrors.employeeCode}</div>
              ) : null}
            </CCol>
            <CCol md={6}>
              <CFormLabel>Full Name</CFormLabel>
              <CFormInput
                value={employeeForm.fullName}
                onChange={(event) => setEmployeeForm((prev) => ({ ...prev, fullName: event.target.value }))}
                invalid={Boolean(employeeFormErrors.fullName)}
              />
              {employeeFormErrors.fullName ? <div className="text-danger small mt-1">{employeeFormErrors.fullName}</div> : null}
            </CCol>
            <CCol md={4}>
              <CFormLabel>Gender</CFormLabel>
              <CFormSelect
                value={employeeForm.gender}
                onChange={(event) => setEmployeeForm((prev) => ({ ...prev, gender: event.target.value }))}
              >
                {GENDER_OPTIONS.map((option) => (
                  <option key={option.value || "empty"} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </CFormSelect>
            </CCol>
            <CCol md={4}>
              <CFormLabel>Date of Birth</CFormLabel>
              <CFormInput
                type="date"
                value={employeeForm.dateOfBirth}
                onChange={(event) => setEmployeeForm((prev) => ({ ...prev, dateOfBirth: event.target.value }))}
              />
            </CCol>
            <CCol md={4}>
              <CFormLabel>Phone</CFormLabel>
              <CFormInput
                value={employeeForm.phone}
                onChange={(event) => setEmployeeForm((prev) => ({ ...prev, phone: event.target.value }))}
              />
            </CCol>

            <CCol xs={12}>
              <strong>Contact</strong>
            </CCol>
            <CCol md={6}>
              <CFormLabel>Work Email</CFormLabel>
              <CFormInput
                type="email"
                value={employeeForm.workEmail}
                onChange={(event) => setEmployeeForm((prev) => ({ ...prev, workEmail: event.target.value }))}
                invalid={Boolean(employeeFormErrors.workEmail)}
              />
              {employeeFormErrors.workEmail ? <div className="text-danger small mt-1">{employeeFormErrors.workEmail}</div> : null}
            </CCol>
            <CCol md={6}>
              <CFormLabel>Personal Email</CFormLabel>
              <CFormInput
                type="email"
                value={employeeForm.personalEmail}
                onChange={(event) => setEmployeeForm((prev) => ({ ...prev, personalEmail: event.target.value }))}
                invalid={Boolean(employeeFormErrors.personalEmail)}
              />
              {employeeFormErrors.personalEmail ? (
                <div className="text-danger small mt-1">{employeeFormErrors.personalEmail}</div>
              ) : null}
            </CCol>
            <CCol xs={12}>
              <CFormLabel>Address</CFormLabel>
              <CFormTextarea
                rows={2}
                value={employeeForm.address}
                onChange={(event) => setEmployeeForm((prev) => ({ ...prev, address: event.target.value }))}
              />
            </CCol>

            <CCol xs={12}>
              <strong>Work Info</strong>
            </CCol>
            <CCol md={4}>
              <CFormLabel>Join Date</CFormLabel>
              <CFormInput
                type="date"
                value={employeeForm.joinDate}
                onChange={(event) => setEmployeeForm((prev) => ({ ...prev, joinDate: event.target.value }))}
              />
            </CCol>
            <CCol md={4}>
              <CFormLabel>Official Date</CFormLabel>
              <CFormInput
                type="date"
                value={employeeForm.officialDate}
                onChange={(event) => setEmployeeForm((prev) => ({ ...prev, officialDate: event.target.value }))}
              />
            </CCol>
            <CCol md={4}>
              <CFormLabel>Status</CFormLabel>
              <CFormSelect
                value={employeeForm.status}
                onChange={(event) => setEmployeeForm((prev) => ({ ...prev, status: event.target.value }))}
                invalid={Boolean(employeeFormErrors.status)}
              >
                {STATUS_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </CFormSelect>
              {employeeFormErrors.status ? <div className="text-danger small mt-1">{employeeFormErrors.status}</div> : null}
            </CCol>

            <CCol xs={12}>
              <strong>Relations</strong>
            </CCol>
            <CCol md={6}>
              <CFormLabel>Current Department</CFormLabel>
              <CFormSelect
                value={employeeForm.currentDepartment}
                onChange={(event) => setEmployeeForm((prev) => ({ ...prev, currentDepartment: event.target.value }))}
              >
                <option value="">-- Chọn --</option>
                {departments.map((department) => (
                  <option key={department.id} value={department.id}>
                    {department.name || `Department #${department.id}`}
                  </option>
                ))}
              </CFormSelect>
            </CCol>
            <CCol md={6}>
              <CFormLabel>Current Position</CFormLabel>
              <CFormSelect
                value={employeeForm.currentPosition}
                onChange={(event) => setEmployeeForm((prev) => ({ ...prev, currentPosition: event.target.value }))}
              >
                <option value="">-- Chọn --</option>
                {positions.map((position) => (
                  <option key={position.id} value={position.id}>
                    {position.name || `Position #${position.id}`}
                  </option>
                ))}
              </CFormSelect>
            </CCol>
            <CCol md={6}>
              <CFormLabel>Current Manager</CFormLabel>
              <CFormSelect
                value={employeeForm.currentManager}
                onChange={(event) => setEmployeeForm((prev) => ({ ...prev, currentManager: event.target.value }))}
              >
                <option value="">-- Chọn --</option>
                {managerOptions.map((manager) => (
                  <option key={manager.id} value={manager.id}>
                    {`${manager.employeeCode || "-"} - ${manager.fullName || `Employee #${manager.id}`}`}
                  </option>
                ))}
              </CFormSelect>
            </CCol>
            <CCol md={6}>
              <CFormLabel>User (optional)</CFormLabel>
              <CFormSelect
                value={employeeForm.user}
                onChange={(event) => setEmployeeForm((prev) => ({ ...prev, user: event.target.value }))}
              >
                <option value="">-- Chọn --</option>
                {users.map((user) => (
                  <option key={user.id} value={user.id}>
                    {user.username || user.email || `User #${user.id}`}
                  </option>
                ))}
              </CFormSelect>
            </CCol>

            <CCol xs={12}>
              <strong>Other</strong>
            </CCol>
            <CCol md={12}>
              <CFormLabel>Avatar upload</CFormLabel>
              <CFormInput
                type="file"
                accept="image/*"
                onChange={(event) => {
                  const file = event.target.files?.[0] || null
                  setEmployeeForm((prev) => ({
                    ...prev,
                    avatarFile: file,
                    avatarName: file?.name || prev.avatarName,
                    avatarCleared: false,
                  }))
                }}
              />
              <div className="small text-body-secondary mt-1">
                {employeeForm.avatarFile
                  ? `File mới: ${employeeForm.avatarFile.name}`
                  : employeeForm.avatarName
                    ? `Hiện tại: ${employeeForm.avatarName}`
                    : "Chưa có avatar"}
              </div>
              {employeeForm.avatarUrl ? (
                <div className="mt-2 d-flex align-items-center gap-2">
                  <img
                    src={employeeForm.avatarUrl}
                    alt="Avatar"
                    style={{ width: 72, height: 72, objectFit: "cover", borderRadius: 8, border: "1px solid #dee2e6" }}
                  />
                  <a href={employeeForm.avatarUrl} target="_blank" rel="noreferrer">
                    Xem avatar hiện tại
                  </a>
                  <CButton
                    type="button"
                    size="sm"
                    color="danger"
                    variant="outline"
                    onClick={() => {
                      setEmployeeForm((prev) => ({
                        ...prev,
                        avatarId: null,
                        avatarName: "",
                        avatarUrl: "",
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
              <CFormTextarea
                rows={3}
                value={employeeForm.note}
                onChange={(event) => setEmployeeForm((prev) => ({ ...prev, note: event.target.value }))}
              />
            </CCol>
          </CRow>
        </CModalBody>
        <CModalFooter>
          <CButton
            color="secondary"
            variant="outline"
            onClick={() => setShowEmployeeModal(false)}
            disabled={savingEmployee}
          >
            Hủy
          </CButton>
          <CButton color="primary" onClick={onSaveEmployee} disabled={savingEmployee}>
            {savingEmployee ? "Đang lưu..." : "Lưu"}
          </CButton>
        </CModalFooter>
      </CModal>

      <CModal
        visible={showHistoryModal}
        backdrop="static"
        onClose={() => !savingHistory && setShowHistoryModal(false)}
      >
        <CModalHeader>
          <CModalTitle>{editingHistoryRow ? "Chỉnh sửa History" : "Thêm mới History"}</CModalTitle>
        </CModalHeader>
        <CModalBody>
          <CRow className="g-3 ai-form">
            <CCol md={6}>
              <CFormLabel>Department</CFormLabel>
              <CFormSelect
                value={historyForm.department}
                onChange={(event) => setHistoryForm((prev) => ({ ...prev, department: event.target.value }))}
                invalid={Boolean(historyFormErrors.department)}
              >
                <option value="">-- Chọn --</option>
                {departments.map((department) => (
                  <option key={department.id} value={department.id}>
                    {department.name || `Department #${department.id}`}
                  </option>
                ))}
              </CFormSelect>
              {historyFormErrors.department ? (
                <div className="text-danger small mt-1">{historyFormErrors.department}</div>
              ) : null}
            </CCol>
            <CCol md={6}>
              <CFormLabel>Position</CFormLabel>
              <CFormSelect
                value={historyForm.position}
                onChange={(event) => setHistoryForm((prev) => ({ ...prev, position: event.target.value }))}
                invalid={Boolean(historyFormErrors.position)}
              >
                <option value="">-- Chọn --</option>
                {positions.map((position) => (
                  <option key={position.id} value={position.id}>
                    {position.name || `Position #${position.id}`}
                  </option>
                ))}
              </CFormSelect>
              {historyFormErrors.position ? <div className="text-danger small mt-1">{historyFormErrors.position}</div> : null}
            </CCol>

            <CCol md={6}>
              <CFormLabel>Manager (optional)</CFormLabel>
              <CFormSelect
                value={historyForm.manager}
                onChange={(event) => setHistoryForm((prev) => ({ ...prev, manager: event.target.value }))}
              >
                <option value="">-- Chọn --</option>
                {managerOptions.map((manager) => (
                  <option key={manager.id} value={manager.id}>
                    {`${manager.employeeCode || "-"} - ${manager.fullName || `Employee #${manager.id}`}`}
                  </option>
                ))}
              </CFormSelect>
            </CCol>
            <CCol md={6}>
              <CFormLabel>Assignment Type</CFormLabel>
              <CFormSelect
                value={historyForm.assignmentType}
                onChange={(event) => setHistoryForm((prev) => ({ ...prev, assignmentType: event.target.value }))}
              >
                {ASSIGNMENT_TYPE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </CFormSelect>
            </CCol>

            <CCol md={6}>
              <CFormLabel>Start Date</CFormLabel>
              <CFormInput
                type="date"
                value={historyForm.startDate}
                onChange={(event) => setHistoryForm((prev) => ({ ...prev, startDate: event.target.value }))}
                invalid={Boolean(historyFormErrors.startDate)}
              />
              {historyFormErrors.startDate ? <div className="text-danger small mt-1">{historyFormErrors.startDate}</div> : null}
            </CCol>
            <CCol md={6}>
              <CFormLabel>End Date</CFormLabel>
              <CFormInput
                type="date"
                value={historyForm.endDate}
                onChange={(event) => setHistoryForm((prev) => ({ ...prev, endDate: event.target.value }))}
                invalid={Boolean(historyFormErrors.endDate)}
              />
              {historyFormErrors.endDate ? <div className="text-danger small mt-1">{historyFormErrors.endDate}</div> : null}
            </CCol>

            <CCol md={6}>
              <CFormCheck
                id="history-primary"
                label="Is Primary"
                checked={historyForm.isPrimary}
                onChange={(event) => setHistoryForm((prev) => ({ ...prev, isPrimary: event.target.checked }))}
              />
            </CCol>
            <CCol md={6}>
              <CFormCheck
                id="history-current"
                label="Is Current"
                checked={historyForm.isCurrent}
                onChange={(event) => setHistoryForm((prev) => ({ ...prev, isCurrent: event.target.checked }))}
              />
            </CCol>

            <CCol xs={12}>
              <CFormLabel>Decision No</CFormLabel>
              <CFormInput
                value={historyForm.decisionNo}
                onChange={(event) => setHistoryForm((prev) => ({ ...prev, decisionNo: event.target.value }))}
              />
            </CCol>
            <CCol xs={12}>
              <CFormLabel>Note</CFormLabel>
              <CFormTextarea
                rows={3}
                value={historyForm.note}
                onChange={(event) => setHistoryForm((prev) => ({ ...prev, note: event.target.value }))}
              />
            </CCol>
          </CRow>
        </CModalBody>
        <CModalFooter>
          <CButton
            color="secondary"
            variant="outline"
            onClick={() => setShowHistoryModal(false)}
            disabled={savingHistory}
          >
            Hủy
          </CButton>
          <CButton color="primary" onClick={onSaveHistory} disabled={savingHistory}>
            {savingHistory ? "Đang lưu..." : "Lưu"}
          </CButton>
        </CModalFooter>
      </CModal>
    </CRow>
  )
}
