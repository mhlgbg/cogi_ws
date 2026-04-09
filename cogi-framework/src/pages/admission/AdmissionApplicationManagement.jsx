import { useEffect, useState } from 'react'
import {
  CAlert,
  CBadge,
  CButton,
  CCard,
  CCardBody,
  CCardHeader,
  CCol,
  CContainer,
  CModal,
  CModalBody,
  CModalFooter,
  CModalHeader,
  CModalTitle,
  CRow,
  CSpinner,
  CTable,
  CTableBody,
  CTableDataCell,
  CTableHead,
  CTableHeaderCell,
  CTableRow,
} from '@coreui/react'
import api from '../../api/axios'

function unwrapRows(payload) {
  if (Array.isArray(payload?.data)) return payload.data
  if (Array.isArray(payload)) return payload
  return []
}

function formatDateTime(value) {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '-'
  return date.toLocaleString('vi-VN')
}

function getStatusLabel(status) {
  const normalized = String(status || '').trim().toLowerCase()
  if (normalized === 'draft') return 'Nháp'
  if (normalized === 'submitted') return 'Đã nộp'
  if (normalized === 'reviewing') return 'Đang xét duyệt'
  if (normalized === 'approved') return 'Đã duyệt'
  if (normalized === 'rejected') return 'Từ chối'
  if (normalized === 'exam_scheduled') return 'Đã xếp lịch'
  if (normalized === 'passed') return 'Đạt'
  if (normalized === 'failed') return 'Chưa đạt'
  if (normalized === 'enrolled') return 'Nhập học'
  return normalized || '-'
}

function getStatusColor(status) {
  const normalized = String(status || '').trim().toLowerCase()
  if (normalized === 'approved' || normalized === 'passed' || normalized === 'enrolled') return 'success'
  if (normalized === 'submitted' || normalized === 'reviewing' || normalized === 'exam_scheduled') return 'info'
  if (normalized === 'draft') return 'secondary'
  if (normalized === 'rejected' || normalized === 'failed') return 'danger'
  return 'secondary'
}

export default function AdmissionApplicationManagement() {
  const [loading, setLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState('')
  const [applications, setApplications] = useState([])
  const [selectedApplication, setSelectedApplication] = useState(null)

  useEffect(() => {
    let isCancelled = false

    async function loadApplications() {
      setLoading(true)
      setErrorMessage('')

      try {
        const response = await api.get('/admission-applications/me/list')
        if (isCancelled) return

        setApplications(unwrapRows(response?.data))
      } catch (error) {
        if (isCancelled) return

        const apiMessage =
          error?.response?.data?.error?.message ||
          error?.response?.data?.message ||
          error?.message ||
          'Không thể tải hồ sơ tuyển sinh'

        setApplications([])
        setErrorMessage(apiMessage)
      } finally {
        if (!isCancelled) {
          setLoading(false)
        }
      }
    }

    loadApplications()

    return () => {
      isCancelled = true
    }
  }, [])

  return (
    <CContainer fluid className='py-4 px-0'>
      <CCard className='border-0 shadow-sm'>
        <CCardHeader className='bg-white border-0 py-3'>
          <div className='fw-semibold fs-5'>Quản lý hồ sơ tuyển sinh</div>
        </CCardHeader>
        <CCardBody>
          {loading ? (
            <div className='text-center py-5'>
              <CSpinner />
            </div>
          ) : (
            <>
              {errorMessage ? <CAlert color='danger'>{errorMessage}</CAlert> : null}

              {applications.length > 0 ? (
                <CTable hover responsive align='middle'>
                  <CTableHead>
                    <CTableRow>
                      <CTableHeaderCell>Đợt tuyển sinh</CTableHeaderCell>
                      <CTableHeaderCell>Trạng thái</CTableHeaderCell>
                      <CTableHeaderCell>Ngày tạo</CTableHeaderCell>
                      <CTableHeaderCell className='text-end'>Thao tác</CTableHeaderCell>
                    </CTableRow>
                  </CTableHead>
                  <CTableBody>
                    {applications.map((item) => (
                      <CTableRow key={item.id}>
                        <CTableDataCell>{item?.campaign?.name || '-'}</CTableDataCell>
                        <CTableDataCell>
                          <CBadge color={getStatusColor(item?.status)}>{getStatusLabel(item?.status)}</CBadge>
                        </CTableDataCell>
                        <CTableDataCell>{formatDateTime(item?.createdAt)}</CTableDataCell>
                        <CTableDataCell className='text-end'>
                          <CButton color='primary' variant='outline' size='sm' onClick={() => setSelectedApplication(item)}>
                            Xem chi tiết
                          </CButton>
                        </CTableDataCell>
                      </CTableRow>
                    ))}
                  </CTableBody>
                </CTable>
              ) : (
                <CAlert color='info' className='mb-0'>
                  Chưa có hồ sơ tuyển sinh nào để quản lý.
                </CAlert>
              )}
            </>
          )}
        </CCardBody>
      </CCard>

      <CModal visible={Boolean(selectedApplication)} onClose={() => setSelectedApplication(null)} alignment='center'>
        <CModalHeader>
          <CModalTitle>Chi tiết hồ sơ tuyển sinh</CModalTitle>
        </CModalHeader>
        <CModalBody>
          <div className='mb-2'><strong>Đợt tuyển sinh:</strong> {selectedApplication?.campaign?.name || '-'}</div>
          <div className='mb-2'><strong>Mã hồ sơ:</strong> {selectedApplication?.applicationCode || '-'}</div>
          <div className='mb-2'><strong>Học sinh:</strong> {selectedApplication?.studentName || '-'}</div>
          <div className='mb-2'><strong>Trạng thái:</strong> {getStatusLabel(selectedApplication?.status)}</div>
          <div><strong>Ngày tạo:</strong> {formatDateTime(selectedApplication?.createdAt)}</div>
        </CModalBody>
        <CModalFooter>
          <CButton color='secondary' variant='outline' onClick={() => setSelectedApplication(null)}>
            Đóng
          </CButton>
        </CModalFooter>
      </CModal>
    </CContainer>
  )
}