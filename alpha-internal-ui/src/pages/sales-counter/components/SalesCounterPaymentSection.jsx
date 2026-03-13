import {
  CAlert,
  CCard,
  CCardBody,
  CCardHeader,
  CCol,
  CFormCheck,
  CFormInput,
  CFormLabel,
  CFormSelect,
  CFormTextarea,
  CRow,
} from "@coreui/react"
import { PAYMENT_METHOD_OPTIONS } from "../../service-orders/serviceOrderFormatters"

export default function SalesCounterPaymentSection({
  disabled,
  totalAmount,
  paymentStatus,
  paymentAmount,
  paymentMethod,
  paymentNote,
  onPaymentStatusChange,
  onPaymentAmountChange,
  onPaymentMethodChange,
  onPaymentNoteChange,
}) {
  const requiresPaymentInput = paymentStatus !== "UNPAID"
  const warning = requiresPaymentInput && Number(paymentAmount || 0) > Number(totalAmount || 0)

  return (
    <CCard className="ai-card mb-3">
      <CCardHeader><strong>Thanh toán nhanh</strong></CCardHeader>
      <CCardBody>
        {disabled ? (
          <CAlert color="warning" className="mb-3">
            Tài khoản hiện tại không có quyền tạo thanh toán. Đơn sẽ được lưu ở trạng thái chưa thu.
          </CAlert>
        ) : null}

        <div className="d-flex flex-column gap-2 mb-3">
          <CFormCheck
            type="radio"
            name="paymentStatus"
            label="Chưa thu"
            checked={paymentStatus === "UNPAID"}
            disabled={disabled}
            onChange={() => onPaymentStatusChange("UNPAID")}
          />
          <CFormCheck
            type="radio"
            name="paymentStatus"
            label="Thu một phần"
            checked={paymentStatus === "PARTIAL"}
            disabled={disabled}
            onChange={() => onPaymentStatusChange("PARTIAL")}
          />
          <CFormCheck
            type="radio"
            name="paymentStatus"
            label="Thu đủ"
            checked={paymentStatus === "PAID"}
            disabled={disabled}
            onChange={() => onPaymentStatusChange("PAID")}
          />
        </div>

        {requiresPaymentInput ? (
          <CRow className="g-3 ai-form">
            <CCol md={12}>
              <CFormLabel>Số tiền thu</CFormLabel>
              <CFormInput
                type="number"
                min="0"
                step="1000"
                disabled={disabled}
                value={paymentAmount}
                onChange={(event) => onPaymentAmountChange(event.target.value)}
              />
            </CCol>
            <CCol md={12}>
              <CFormLabel>Phương thức</CFormLabel>
              <CFormSelect disabled={disabled} value={paymentMethod} onChange={(event) => onPaymentMethodChange(event.target.value)}>
                {PAYMENT_METHOD_OPTIONS.map((item) => (
                  <option key={item.value} value={item.value}>{item.label}</option>
                ))}
              </CFormSelect>
            </CCol>
            <CCol md={12}>
              <CFormLabel>Ghi chú thanh toán</CFormLabel>
              <CFormTextarea
                rows={2}
                disabled={disabled}
                value={paymentNote}
                onChange={(event) => onPaymentNoteChange(event.target.value)}
              />
            </CCol>
          </CRow>
        ) : null}

        {warning ? (
          <div className="small text-warning mt-2">
            Số tiền thu đang lớn hơn tổng tiền đơn. Vui lòng kiểm tra lại.
          </div>
        ) : null}
      </CCardBody>
    </CCard>
  )
}
