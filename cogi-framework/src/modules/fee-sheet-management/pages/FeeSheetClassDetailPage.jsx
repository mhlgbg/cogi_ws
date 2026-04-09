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
import { getFeeSheetClassById } from '../services/feeSheetService'

function getApiMessage(error, fallback) {
  return error?.response?.data?.error?.message || error?.response?.data?.message || error?.message || fallback
}

function formatCurrency(value) {
  const amount = Number(value || 0)
  if (!Number.isFinite(amount)) return '0'
  return amount.toLocaleString('vi-VN')
}

function formatStatus(status) {
  const normalized = String(status || '').toLowerCase()
  if (normalized === 'approved') return { color: 'success', label: 'Approved' }
  if (normalized === 'submitted') return { color: 'info', label: 'Submitted' }
  if (normalized === 'paid') return { color: 'success', label: 'Paid' }
  if (normalized === 'partial') return { color: 'warning', label: 'Partial' }
  if (normalized === 'unpaid') return { color: 'secondary', label: 'Unpaid' }
  return { color: 'warning', label: 'Draft' }
}

export default function FeeSheetClassDetailPage() {
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
        const data = await getFeeSheetClassById(id)
        if (mounted) setDetail(data)
      } catch (requestError) {
        if (mounted) setError(getApiMessage(requestError, 'Không thể tải chi tiết fee sheet class'))
      } finally {
        if (mounted) setLoading(false)
      }
    }

    load()
    return () => {
      mounted = false
    }
  }, [id])

  const summary = useMemo(() => {
    const feeItems = Array.isArray(detail?.feeItems) ? detail.feeItems : []
    return feeItems.reduce((accumulator, item) => ({
      totalAmount: accumulator.totalAmount + Number(item.amount || 0),
      totalPaid: accumulator.totalPaid + Number(item.paidAmount || 0),
      totalRemaining: accumulator.totalRemaining + Math.max(0, Number(item.remaining || 0)),
    }), { totalAmount: 0, totalPaid: 0, totalRemaining: 0 })
  }, [detail])

  if (loading) {
    return (
      <div className='text-center py-5'>
        <CSpinner color='primary' />
      </div>
    )
  }

  const sheetStatus = formatStatus(detail?.status)

  return (
    <CRow className='g-0'>
      <CCol xs={12}>
        <div className='d-flex justify-content-between align-items-start gap-3 flex-wrap mb-4'>
          <div>
            <h3 className='mb-1'>{detail?.feeSheet?.name || 'Chi tiết bảng phí lớp'}</h3>
            <div className='text-body-secondary'>{detail?.classNameSnapshot || '-'} | {detail?.feeSheet?.fromDate || '-'} - {detail?.feeSheet?.toDate || '-'}</div>
          </div>
          <CButton color='light' onClick={() => navigate(-1)}>Quay lại</CButton>
        </div>

        {error ? <CAlert color='danger'>{error}</CAlert> : null}

        <CRow className='g-3 mb-4'>
          <CCol lg={6}>
            <CCard>
              <CCardHeader><strong>Thông tin lớp phí</strong></CCardHeader>
              <CCardBody>
                <div className='mb-3'><strong>Bảng phí:</strong> {detail?.feeSheet?.name || '-'}</div>
                <div className='mb-3'><strong>Từ ngày:</strong> {detail?.feeSheet?.fromDate || '-'}</div>
                <div className='mb-3'><strong>Đến ngày:</strong> {detail?.feeSheet?.toDate || '-'}</div>
                <div className='mb-3'><strong>Lớp:</strong> {detail?.classNameSnapshot || '-'}</div>
                <div className='mb-3'><strong>Giáo viên:</strong> {detail?.teacherNameSnapshot || '-'}</div>
                <div><strong>Trạng thái:</strong> <CBadge color={sheetStatus.color}>{sheetStatus.label}</CBadge></div>
              </CCardBody>
            </CCard>
          </CCol>
          <CCol lg={2}>
            <CCard>
              <CCardBody>
                <div className='text-body-secondary small mb-1'>Tổng nợ</div>
                <div className='fs-5 fw-semibold'>{formatCurrency(summary.totalAmount)}</div>
              </CCardBody>
            </CCard>
          </CCol>
          <CCol lg={2}>
            <CCard>
              <CCardBody>
                <div className='text-body-secondary small mb-1'>Đã thu</div>
                <div className='fs-5 fw-semibold text-success'>{formatCurrency(summary.totalPaid)}</div>
              </CCardBody>
            </CCard>
          </CCol>
          <CCol lg={2}>
            <CCard>
              <CCardBody>
                <div className='text-body-secondary small mb-1'>Còn lại</div>
                <div className='fs-5 fw-semibold text-warning'>{formatCurrency(summary.totalRemaining)}</div>
              </CCardBody>
            </CCard>
          </CCol>
        </CRow>

        <CCard>
          <CCardHeader><strong>Danh sách chi tiết khoản nợ</strong></CCardHeader>
          <CCardBody>
            <CTable hover responsive>
              <CTableHead>
                <CTableRow>
                  <CTableHeaderCell>Mã HS</CTableHeaderCell>
                  <CTableHeaderCell>Họ tên</CTableHeaderCell>
                  <CTableHeaderCell className='text-end'>Số lượng</CTableHeaderCell>
                  <CTableHeaderCell className='text-end'>Đơn giá</CTableHeaderCell>
                  <CTableHeaderCell className='text-end'>% giảm</CTableHeaderCell>
                  <CTableHeaderCell className='text-end'>Giảm tiền</CTableHeaderCell>
                  <CTableHeaderCell className='text-end'>Thành tiền</CTableHeaderCell>
                  <CTableHeaderCell className='text-end'>Đã thu</CTableHeaderCell>
                  <CTableHeaderCell className='text-end'>Còn lại</CTableHeaderCell>
                  <CTableHeaderCell>Trạng thái</CTableHeaderCell>
                  <CTableHeaderCell>Ghi chú</CTableHeaderCell>
                </CTableRow>
              </CTableHead>
              <CTableBody>
                {Array.isArray(detail?.feeItems) && detail.feeItems.length > 0 ? detail.feeItems.map((item) => {
                  const itemStatus = formatStatus(item.status)
                  return (
                    <CTableRow key={item.id}>
                      <CTableDataCell>{item.learnerCodeSnapshot || '-'}</CTableDataCell>
                      <CTableDataCell>{item.learnerNameSnapshot || '-'}</CTableDataCell>
                      <CTableDataCell className='text-end'>{formatCurrency(item.quantity)}</CTableDataCell>
                      <CTableDataCell className='text-end'>{formatCurrency(item.unitPrice)}</CTableDataCell>
                      <CTableDataCell className='text-end'>{formatCurrency(item.discountPercent)}</CTableDataCell>
                      <CTableDataCell className='text-end'>{formatCurrency(item.discountAmount)}</CTableDataCell>
                      <CTableDataCell className='text-end'><strong>{formatCurrency(item.amount)}</strong></CTableDataCell>
                      <CTableDataCell className='text-end'>{formatCurrency(item.paidAmount)}</CTableDataCell>
                      <CTableDataCell className='text-end'>{formatCurrency(item.remaining)}</CTableDataCell>
                      <CTableDataCell><CBadge color={itemStatus.color}>{itemStatus.label}</CBadge></CTableDataCell>
                      <CTableDataCell>{item.note || '-'}</CTableDataCell>
                    </CTableRow>
                  )
                }) : (
                  <CTableRow>
                    <CTableDataCell colSpan={11} className='text-center text-body-secondary'>Chưa có khoản nợ</CTableDataCell>
                  </CTableRow>
                )}
              </CTableBody>
            </CTable>
          </CCardBody>
        </CCard>
      </CCol>
    </CRow>
  )
}