import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  CAlert,
  CBadge,
  CButton,
  CCard,
  CCardBody,
  CCardHeader,
  CCol,
  CRow,
  CSpinner,
  CTable,
  CTableBody,
  CTableDataCell,
  CTableHead,
  CTableHeaderCell,
  CTableRow,
} from '@coreui/react'
import { getPaymentTrackingById } from '../services/paymentTrackingService'

function getApiMessage(error, fallback) {
  return error?.response?.data?.error?.message || error?.response?.data?.message || error?.message || fallback
}

function formatMoney(value) {
  return new Intl.NumberFormat('vi-VN').format(Number(value || 0))
}

function formatDateTime(value) {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '-'
  return date.toLocaleString('vi-VN')
}

function formatMethod(method) {
  const normalized = String(method || '').toLowerCase()
  if (normalized === 'transfer') return { color: 'info', label: 'Transfer' }
  if (normalized === 'other') return { color: 'secondary', label: 'Other' }
  return { color: 'success', label: 'Cash' }
}

function formatStatus(status) {
  const normalized = String(status || '').toLowerCase()
  if (normalized === 'paid') return { color: 'success', label: 'Paid' }
  if (normalized === 'partial') return { color: 'warning', label: 'Partial' }
  return { color: 'secondary', label: 'Unpaid' }
}

export default function PaymentTrackingDetailPage() {
  const navigate = useNavigate()
  const { id } = useParams()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [detail, setDetail] = useState(null)

  useEffect(() => {
    let mounted = true

    async function load() {
      setLoading(true)
      setError('')
      try {
        const data = await getPaymentTrackingById(id)
        if (mounted) setDetail(data)
      } catch (requestError) {
        if (mounted) setError(getApiMessage(requestError, 'Không thể tải chi tiết khoản thu'))
      } finally {
        if (mounted) setLoading(false)
      }
    }

    load()
    return () => { mounted = false }
  }, [id])

  const method = formatMethod(detail?.method)
  const allocationCount = useMemo(() => Array.isArray(detail?.allocations) ? detail.allocations.length : 0, [detail])

  if (loading) {
    return <div className='text-center py-5'><CSpinner color='primary' /></div>
  }

  return (
    <CRow className='g-0'>
      <CCol xs={12}>
        <div className='d-flex justify-content-between align-items-start gap-3 flex-wrap mb-4'>
          <div>
            <h3 className='mb-1'>Chi tiết khoản thu</h3>
            <div className='text-body-secondary'>{detail?.learner?.name || '-'} | {formatDateTime(detail?.paymentDate)}</div>
          </div>
          <CButton color='light' onClick={() => navigate('/payment-tracking')}>Quay lại</CButton>
        </div>

        {error ? <CAlert color='danger'>{error}</CAlert> : null}

        <CRow className='g-3 mb-4'>
          <CCol lg={6}>
            <CCard>
              <CCardHeader><strong>Thông tin khoản thu</strong></CCardHeader>
              <CCardBody>
                <div className='mb-3'><strong>Học viên:</strong> {detail?.learner?.name || '-'}</div>
                <div className='mb-3'><strong>Ngày thu:</strong> {formatDateTime(detail?.paymentDate)}</div>
                <div className='mb-3'><strong>Phương thức:</strong> <CBadge color={method.color}>{method.label}</CBadge></div>
                <div className='mb-3'><strong>Ghi chú:</strong> {detail?.note || '-'}</div>
                <div><strong>Số khoản thu:</strong> {allocationCount}</div>
              </CCardBody>
            </CCard>
          </CCol>
          <CCol lg={2}><CCard><CCardBody><div className='text-body-secondary small mb-1'>Tổng tiền</div><div className='fs-5 fw-semibold'>{formatMoney(detail?.amount)}</div></CCardBody></CCard></CCol>
          <CCol lg={2}><CCard><CCardBody><div className='text-body-secondary small mb-1'>Đã phân bổ</div><div className='fs-5 fw-semibold text-success'>{formatMoney(detail?.allocatedAmount)}</div></CCardBody></CCard></CCol>
          <CCol lg={2}><CCard><CCardBody><div className='text-body-secondary small mb-1'>Chưa phân bổ</div><div className='fs-5 fw-semibold text-warning'>{formatMoney(detail?.unallocatedAmount)}</div></CCardBody></CCard></CCol>
        </CRow>

        <CCard>
          <CCardHeader><strong>Chi tiết các khoản thu</strong></CCardHeader>
          <CCardBody>
            <CTable hover responsive>
              <CTableHead>
                <CTableRow>
                  <CTableHeaderCell>FeeSheet</CTableHeaderCell>
                  <CTableHeaderCell>Class</CTableHeaderCell>
                  <CTableHeaderCell>Học viên</CTableHeaderCell>
                  <CTableHeaderCell className='text-end'>Phân bổ</CTableHeaderCell>
                  <CTableHeaderCell className='text-end'>Giá trị fee item</CTableHeaderCell>
                  <CTableHeaderCell className='text-end'>Đã thu</CTableHeaderCell>
                  <CTableHeaderCell className='text-end'>Còn lại</CTableHeaderCell>
                  <CTableHeaderCell>Trạng thái</CTableHeaderCell>
                </CTableRow>
              </CTableHead>
              <CTableBody>
                {Array.isArray(detail?.allocations) && detail.allocations.length > 0 ? detail.allocations.map((item) => {
                  const status = formatStatus(item?.feeItem?.status)
                  return (
                    <CTableRow key={item.id}>
                      <CTableDataCell>{item?.feeItem?.feeSheetName || '-'}</CTableDataCell>
                      <CTableDataCell>{item?.feeItem?.className || '-'}</CTableDataCell>
                      <CTableDataCell>{item?.feeItem?.learnerName || '-'}</CTableDataCell>
                      <CTableDataCell className='text-end'>{formatMoney(item.amount)}</CTableDataCell>
                      <CTableDataCell className='text-end'>{formatMoney(item?.feeItem?.feeItemAmount)}</CTableDataCell>
                      <CTableDataCell className='text-end'>{formatMoney(item?.feeItem?.feeItemPaidAmount)}</CTableDataCell>
                      <CTableDataCell className='text-end'>{formatMoney(item?.feeItem?.feeItemRemaining)}</CTableDataCell>
                      <CTableDataCell><CBadge color={status.color}>{status.label}</CBadge></CTableDataCell>
                    </CTableRow>
                  )
                }) : (
                  <CTableRow><CTableDataCell colSpan={8} className='text-center text-body-secondary'>Chưa có khoản thu nào được phân bổ</CTableDataCell></CTableRow>
                )}
              </CTableBody>
            </CTable>
          </CCardBody>
        </CCard>
      </CCol>
    </CRow>
  )
}