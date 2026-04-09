import { useEffect, useState } from 'react'
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
import { getFeeSheetById } from '../services/feeSheetService'

function getApiMessage(error, fallback) {
  return error?.response?.data?.error?.message || error?.response?.data?.message || error?.message || fallback
}

function formatStatus(status) {
  const normalized = String(status || '').toLowerCase()
  if (normalized === 'open') return { color: 'info', label: 'Open' }
  if (normalized === 'closed') return { color: 'secondary', label: 'Closed' }
  if (normalized === 'approved') return { color: 'success', label: 'Approved' }
  return { color: 'warning', label: 'Draft' }
}

export default function FeeSheetDetailPage() {
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
        const data = await getFeeSheetById(id)
        if (mounted) setDetail(data)
      } catch (requestError) {
        if (mounted) setError(getApiMessage(requestError, 'Không thể tải chi tiết fee sheet'))
      } finally {
        if (mounted) setLoading(false)
      }
    }

    load()
    return () => {
      mounted = false
    }
  }, [id])

  if (loading) {
    return (
      <div className='text-center py-5'>
        <CSpinner color='primary' />
      </div>
    )
  }

  const status = formatStatus(detail?.status)

  return (
    <CRow className='g-0'>
      <CCol xs={12}>
        <div className='d-flex justify-content-between align-items-start gap-3 flex-wrap mb-4'>
          <div>
            <h3 className='mb-1'>{detail?.name || 'Fee Sheet detail'}</h3>
            <div className='text-body-secondary'>{detail?.fromDate || '-'} - {detail?.toDate || '-'}</div>
          </div>
          <CButton color='light' onClick={() => navigate('/fee-sheets')}>Quay lại</CButton>
        </div>

        {error ? <CAlert color='danger'>{error}</CAlert> : null}

        <CRow className='g-3'>
          <CCol md={5}>
            <CCard>
              <CCardHeader><strong>Thông tin</strong></CCardHeader>
              <CCardBody>
                <div className='mb-3'><strong>Name:</strong> {detail?.name || '-'}</div>
                <div className='mb-3'><strong>From Date:</strong> {detail?.fromDate || '-'}</div>
                <div className='mb-3'><strong>To Date:</strong> {detail?.toDate || '-'}</div>
                <div><strong>Status:</strong> <CBadge color={status.color}>{status.label}</CBadge></div>
              </CCardBody>
            </CCard>
          </CCol>
          <CCol md={7}>
            <CCard>
              <CCardHeader><strong>FeeSheet Classes</strong></CCardHeader>
              <CCardBody>
                <CTable responsive>
                  <CTableHead>
                    <CTableRow>
                      <CTableHeaderCell>Class</CTableHeaderCell>
                      <CTableHeaderCell>Teacher</CTableHeaderCell>
                      <CTableHeaderCell>Status</CTableHeaderCell>
                      <CTableHeaderCell>Fee Items</CTableHeaderCell>
                      <CTableHeaderCell>Chi tiết nợ</CTableHeaderCell>
                    </CTableRow>
                  </CTableHead>
                  <CTableBody>
                    {Array.isArray(detail?.feeSheetClasses) && detail.feeSheetClasses.length > 0 ? detail.feeSheetClasses.map((item) => (
                      <CTableRow key={item.id}>
                        <CTableDataCell>
                          <div>{item.classNameSnapshot || '-'}</div>
                          <CButton
                            size='sm'
                            color='primary'
                            variant='ghost'
                            className='px-0 mt-1'
                            onClick={() => navigate(`/fee-sheet-classes/${item.id}`)}
                          >
                            Xem khoản nợ
                          </CButton>
                        </CTableDataCell>
                        <CTableDataCell>{item.teacherNameSnapshot || '-'}</CTableDataCell>
                        <CTableDataCell>{item.status || '-'}</CTableDataCell>
                        <CTableDataCell>{item.feeItemsCount || 0}</CTableDataCell>
                        <CTableDataCell>
                          <CButton size='sm' color='primary' variant='outline' onClick={() => navigate(`/fee-sheet-classes/${item.id}`)}>Xem khoản nợ</CButton>
                        </CTableDataCell>
                      </CTableRow>
                    )) : (
                      <CTableRow>
                        <CTableDataCell colSpan={5} className='text-center text-body-secondary'>Chưa có dữ liệu</CTableDataCell>
                      </CTableRow>
                    )}
                  </CTableBody>
                </CTable>
              </CCardBody>
            </CCard>
          </CCol>
        </CRow>
      </CCol>
    </CRow>
  )
}