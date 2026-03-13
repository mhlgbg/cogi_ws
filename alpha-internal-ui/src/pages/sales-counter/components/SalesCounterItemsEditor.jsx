import {
  CButton,
  CCard,
  CCardBody,
  CCardHeader,
  CCol,
  CFormInput,
  CFormLabel,
  CFormSelect,
  CFormTextarea,
  CRow,
  CTable,
  CTableBody,
  CTableDataCell,
  CTableHead,
  CTableHeaderCell,
  CTableRow,
} from "@coreui/react"
import { formatMoney } from "../../service-orders/serviceOrderFormatters"

function getServiceItemOptionLabel(item) {
  const code = item?.code ? `[${item.code}]` : ""
  const name = item?.name || ""
  const categoryName = item?.category?.name ? ` - ${item.category.name}` : ""
  return `${code} ${name}${categoryName}`.trim()
}

export default function SalesCounterItemsEditor({
  items,
  serviceItems,
  serviceItemMap,
  serviceItemKeyword,
  onServiceItemKeywordChange,
  onAddItem,
  onRemoveItem,
  onUpdateItem,
  onSelectServiceItem,
}) {
  return (
    <CCard className="ai-card">
      <CCardHeader className="d-flex justify-content-between align-items-center">
        <strong>Dịch vụ / Hàng dòng</strong>
        <CButton color="success" size="sm" onClick={onAddItem}>Thêm dòng</CButton>
      </CCardHeader>
      <CCardBody>
        <CRow className="g-3 mb-3 ai-form">
          <CCol md={6}>
            <CFormLabel>Tìm service item</CFormLabel>
            <CFormInput
              placeholder="Tìm theo mã hoặc tên"
              value={serviceItemKeyword}
              onChange={(event) => onServiceItemKeywordChange(event.target.value)}
            />
          </CCol>
        </CRow>

        <CTable responsive hover className="mb-0 ai-table">
          <CTableHead>
            <CTableRow>
              <CTableHeaderCell style={{ width: 60 }}>#</CTableHeaderCell>
              <CTableHeaderCell style={{ minWidth: 220 }}>Service Item</CTableHeaderCell>
              <CTableHeaderCell style={{ minWidth: 200 }}>Mô tả</CTableHeaderCell>
              <CTableHeaderCell style={{ minWidth: 110 }}>SL</CTableHeaderCell>
              <CTableHeaderCell style={{ minWidth: 140 }}>Đơn giá</CTableHeaderCell>
              <CTableHeaderCell style={{ minWidth: 150 }}>Thành tiền</CTableHeaderCell>
              <CTableHeaderCell style={{ minWidth: 180 }}>Ghi chú</CTableHeaderCell>
              <CTableHeaderCell style={{ minWidth: 90 }}>Xóa</CTableHeaderCell>
            </CTableRow>
          </CTableHead>
          <CTableBody>
            {items.map((row, index) => {
              const selectedServiceItem = serviceItemMap.get(Number(row.serviceItem)) || null

              return (
                <CTableRow key={row.rowKey}>
                  <CTableDataCell>{index + 1}</CTableDataCell>
                  <CTableDataCell>
                    <CFormSelect value={row.serviceItem} onChange={(event) => onSelectServiceItem(index, event.target.value)}>
                      <option value="">-- Chọn --</option>
                      {serviceItems.map((item) => (
                        <option key={item.id} value={item.id}>{getServiceItemOptionLabel(item)}</option>
                      ))}
                    </CFormSelect>
                    {selectedServiceItem?.unit ? (
                      <div className="small text-body-secondary mt-1">Đơn vị: {selectedServiceItem.unit}</div>
                    ) : null}
                  </CTableDataCell>
                  <CTableDataCell>
                    <CFormTextarea rows={2} value={row.description} onChange={(event) => onUpdateItem(index, { description: event.target.value })} />
                  </CTableDataCell>
                  <CTableDataCell>
                    <CFormInput
                      type="number"
                      min="0"
                      step="1"
                      value={row.quantity}
                      onChange={(event) => onUpdateItem(index, { quantity: event.target.value })}
                    />
                  </CTableDataCell>
                  <CTableDataCell>
                    <CFormInput
                      type="number"
                      min="0"
                      step="1000"
                      value={row.unitPrice}
                      onChange={(event) => onUpdateItem(index, { unitPrice: event.target.value })}
                    />
                  </CTableDataCell>
                  <CTableDataCell>
                    <strong>{formatMoney(row.amount)}</strong>
                  </CTableDataCell>
                  <CTableDataCell>
                    <CFormTextarea rows={2} value={row.note} onChange={(event) => onUpdateItem(index, { note: event.target.value })} />
                  </CTableDataCell>
                  <CTableDataCell>
                    <CButton
                      size="sm"
                      color="danger"
                      variant="outline"
                      disabled={items.length <= 1}
                      onClick={() => onRemoveItem(index)}
                    >
                      Xóa
                    </CButton>
                  </CTableDataCell>
                </CTableRow>
              )
            })}
          </CTableBody>
        </CTable>
      </CCardBody>
    </CCard>
  )
}
