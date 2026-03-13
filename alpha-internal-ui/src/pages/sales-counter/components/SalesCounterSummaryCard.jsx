import { CBadge, CCard, CCardBody, CCardHeader } from "@coreui/react"
import { formatMoney } from "../../service-orders/serviceOrderFormatters"

export default function SalesCounterSummaryCard({ department, employee, customer, itemCount, totalAmount }) {
  return (
    <CCard className="ai-card mb-3">
      <CCardHeader><strong>Tóm tắt đơn hàng</strong></CCardHeader>
      <CCardBody>
        <div className="small text-body-secondary mb-1">Cửa hàng đang làm việc</div>
        <div className="mb-2"><strong>{department?.name || "-"}</strong></div>

        <div className="small text-body-secondary mb-1">Nhân viên bán</div>
        <div className="mb-2"><strong>{employee?.fullName || "-"}</strong></div>

        <div className="small text-body-secondary mb-1">Khách hàng</div>
        <div className="mb-2"><strong>{customer?.name || "-"}</strong></div>

        <div className="d-flex justify-content-between align-items-center mb-2">
          <span className="small text-body-secondary">Số dòng dịch vụ</span>
          <CBadge color="info">{itemCount}</CBadge>
        </div>

        <div className="pt-2 border-top d-flex justify-content-between align-items-center">
          <span className="text-body-secondary">Tổng tiền</span>
          <span style={{ fontSize: 22, fontWeight: 700 }}>{formatMoney(totalAmount)}</span>
        </div>
      </CCardBody>
    </CCard>
  )
}
