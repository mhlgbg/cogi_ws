import { useEffect, useState } from "react"
import {
  CAlert,
  CButton,
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
  CCol,
} from "@coreui/react"
import { createPaymentTransaction } from "../../api/paymentTransactionApi"
import { PAYMENT_METHOD_OPTIONS, formatDateTime } from "../../pages/service-orders/serviceOrderFormatters"

function toDateTimeLocalValue(value) {
  const date = value ? new Date(value) : new Date()
  if (Number.isNaN(date.getTime())) return ""
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, "0")
  const d = String(date.getDate()).padStart(2, "0")
  const h = String(date.getHours()).padStart(2, "0")
  const min = String(date.getMinutes()).padStart(2, "0")
  return `${y}-${m}-${d}T${h}:${min}`
}

export default function PaymentCreateModal({ visible, onClose, order, onCreated }) {
  const [form, setForm] = useState({
    amount: "",
    method: "CASH",
    paidAt: toDateTimeLocalValue(),
    note: "",
  })
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState("")

  useEffect(() => {
    if (!visible) return
    setForm({
      amount: "",
      method: "CASH",
      paidAt: toDateTimeLocalValue(),
      note: "",
    })
    setError("")
  }, [visible])

  async function onSubmit(event) {
    event.preventDefault()
    setError("")

    const amount = Number(form.amount)
    if (!Number.isFinite(amount) || amount <= 0) {
      setError("Số tiền thu phải lớn hơn 0")
      return
    }

    if (!order?.id) {
      setError("Không xác định được đơn hàng")
      return
    }

    const payload = {
      order: order.id,
      customer: order?.customer?.id || null,
      department: order?.department?.id || null,
      amount,
      method: form.method,
      paidAt: form.paidAt ? new Date(form.paidAt).toISOString() : new Date().toISOString(),
      note: String(form.note || "").trim() || null,
    }

    setSubmitting(true)
    try {
      await createPaymentTransaction(payload)
      if (typeof onCreated === "function") {
        await onCreated()
      }
      if (typeof onClose === "function") {
        onClose()
      }
    } catch (submitError) {
      setError(submitError?.response?.data?.error?.message || submitError?.message || "Không thể tạo giao dịch thanh toán")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <CModal visible={visible} backdrop="static" onClose={() => !submitting && onClose?.()}>
      <CModalHeader>
        <CModalTitle>Thêm thanh toán</CModalTitle>
      </CModalHeader>
      <CModalBody>
        {error ? <CAlert color="danger">{error}</CAlert> : null}

        <div className="mb-3 small text-body-secondary">
          Đơn: <strong>{order?.code || "-"}</strong> • Còn nợ: <strong>{order?.debtAmount || 0}</strong>
        </div>

        <form onSubmit={onSubmit}>
          <CRow className="g-3 ai-form">
            <CCol md={6}>
              <CFormLabel>Số tiền</CFormLabel>
              <CFormInput
                type="number"
                min="0"
                step="1000"
                value={form.amount}
                onChange={(event) => setForm((prev) => ({ ...prev, amount: event.target.value }))}
              />
            </CCol>
            <CCol md={6}>
              <CFormLabel>Phương thức</CFormLabel>
              <CFormSelect
                value={form.method}
                onChange={(event) => setForm((prev) => ({ ...prev, method: event.target.value }))}
              >
                {PAYMENT_METHOD_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </CFormSelect>
            </CCol>
            <CCol md={12}>
              <CFormLabel>Thời gian thu</CFormLabel>
              <CFormInput
                type="datetime-local"
                value={form.paidAt}
                onChange={(event) => setForm((prev) => ({ ...prev, paidAt: event.target.value }))}
              />
              <div className="small text-body-secondary mt-1">{form.paidAt ? formatDateTime(form.paidAt) : "-"}</div>
            </CCol>
            <CCol md={12}>
              <CFormLabel>Ghi chú</CFormLabel>
              <CFormTextarea
                rows={3}
                value={form.note}
                onChange={(event) => setForm((prev) => ({ ...prev, note: event.target.value }))}
              />
            </CCol>
          </CRow>
          <button type="submit" className="d-none" />
        </form>
      </CModalBody>
      <CModalFooter>
        <CButton color="secondary" variant="outline" disabled={submitting} onClick={() => onClose?.()}>
          Hủy
        </CButton>
        <CButton color="primary" disabled={submitting} onClick={onSubmit}>
          {submitting ? "Đang lưu..." : "Lưu thanh toán"}
        </CButton>
      </CModalFooter>
    </CModal>
  )
}
