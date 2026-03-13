export const STATUS_OPTIONS = [
  { value: "draft", label: "Draft", color: "secondary" },
  { value: "active", label: "Active", color: "success" },
  { value: "probation", label: "Probation", color: "warning" },
  { value: "official", label: "Official", color: "primary" },
  { value: "maternity_leave", label: "Maternity Leave", color: "info" },
  { value: "unpaid_leave", label: "Unpaid Leave", color: "secondary" },
  { value: "resigned", label: "Resigned", color: "danger" },
  { value: "retired", label: "Retired", color: "dark" },
]

export const ASSIGNMENT_TYPE_OPTIONS = [
  { value: "official", label: "Official", color: "primary" },
  { value: "concurrent", label: "Concurrent", color: "info" },
  { value: "temporary", label: "Temporary", color: "warning" },
  { value: "promotion", label: "Promotion", color: "success" },
  { value: "transfer", label: "Transfer", color: "secondary" },
]

export function formatDateDDMMYYYY(value) {
  if (!value) return "-"

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "-"

  return date.toLocaleDateString("en-GB")
}

export function getStatusMeta(status) {
  return STATUS_OPTIONS.find((item) => item.value === status) || {
    value: status,
    label: status || "-",
    color: "secondary",
  }
}

export function getAssignmentTypeMeta(value) {
  return ASSIGNMENT_TYPE_OPTIONS.find((item) => item.value === value) || {
    value,
    label: value || "-",
    color: "secondary",
  }
}
