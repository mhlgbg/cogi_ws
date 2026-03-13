import { useEffect, useState } from "react"
import {
  CAlert,
  CButton,
  CCol,
  CFormInput,
  CFormLabel,
  CFormTextarea,
  CModal,
  CModalBody,
  CModalFooter,
  CModalHeader,
  CModalTitle,
  CRow,
} from "@coreui/react"
import { quickCreateCounterCustomer } from "../../../api/salesCounterApi"

function buildInitialForm() {
  return {
    name: "",
    phone: "",
    zalo: "",
    address: "",
    note: "",
  }
}

export default function CustomerQuickCreateModal({ visible, onClose, onCreated }) {
  const [form, setForm] = useState(buildInitialForm)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState("")

  useEffect(() => {
    if (!visible) return
    setForm(buildInitialForm())
    setError("")
  }, [visible])

  async function onSubmit(event) {
    event?.preventDefault?.()
    if (submitting) return

    setError("")

    const name = String(form.name || "").trim()
    if (!name) {
      setError("Tên khách hàng là bắt buộc")
      return
    }

    setSubmitting(true)
    try {
      const payload = {
        name,
        phone: String(form.phone || "").trim() || null,
        zalo: String(form.zalo || "").trim() || null,
        address: String(form.address || "").trim() || null,
        note: String(form.note || "").trim() || null,
      }

      const response = await quickCreateCounterCustomer(payload)
      const created = response?.data || null

      if (!created?.id) {
        throw new Error("Không nhận được dữ liệu khách hàng mới")
      }

      onCreated?.(created)
      onClose?.()
    } catch (submitError) {
      setError(submitError?.response?.data?.error?.message || submitError?.message || "Không thể tạo khách hàng mới")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <CModal visible={visible} backdrop="static" onClose={() => !submitting && onClose?.()}>
      <CModalHeader>
        <CModalTitle>Thêm khách mới tại quầy</CModalTitle>
      </CModalHeader>
      <CModalBody>
        {error ? <CAlert color="danger">{error}</CAlert> : null}

        <form onSubmit={onSubmit}>
          <CRow className="g-3 ai-form">
            <CCol md={12}>
              <CFormLabel>Tên khách hàng *</CFormLabel>
              <CFormInput
                value={form.name}
                onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
                placeholder="Ví dụ: Nguyễn Văn A"
              />
            </CCol>
            <CCol md={6}>
              <CFormLabel>Số điện thoại</CFormLabel>
              <CFormInput
                value={form.phone}
                onChange={(event) => setForm((prev) => ({ ...prev, phone: event.target.value }))}
                placeholder="090..."
              />
            </CCol>
            <CCol md={6}>
              <CFormLabel>Zalo</CFormLabel>
              <CFormInput
                value={form.zalo}
                onChange={(event) => setForm((prev) => ({ ...prev, zalo: event.target.value }))}
                placeholder="SĐT hoặc ID"
              />
            </CCol>
            <CCol md={12}>
              <CFormLabel>Địa chỉ</CFormLabel>
              <CFormTextarea
                rows={2}
                value={form.address}
                onChange={(event) => setForm((prev) => ({ ...prev, address: event.target.value }))}
              />
            </CCol>
            <CCol md={12}>
              <CFormLabel>Ghi chú</CFormLabel>
              <CFormTextarea
                rows={2}
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
          {submitting ? "Đang lưu..." : "Lưu khách mới"}
        </CButton>
      </CModalFooter>
    </CModal>
  )
}
