import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  CAlert,
  CBadge,
  CButton,
  CCol,
  CFormCheck,
  CFormInput,
  CFormSelect,
  CRow,
  CSpinner,
  CTable,
  CTableBody,
  CTableDataCell,
  CTableHead,
  CTableHeaderCell,
  CTableRow,
  CPagination,
  CPaginationItem,
} from '@coreui/react'
import TenantSettingsLayout from '../components/TenantSettingsLayout'
import { listPaymentProfiles } from '../services/paymentProfileService'
import { getPaymentProfileApiMessage, getPaymentProfileMethodLabel, getPaymentProfileReceiverSummary, getPaymentProfileStatusMeta } from '../utils/paymentProfileUi'

function buildPages(currentPage, pageCount) {
  const pages = []
  if (pageCount <= 7) {
    for (let index = 1; index <= pageCount; index += 1) pages.push(index)
    return pages
  }
  const left = Math.max(2, currentPage - 2)
  const right = Math.min(pageCount - 1, currentPage + 2)
  pages.push(1)
  if (left > 2) pages.push('...')
  for (let index = left; index <= right; index += 1) pages.push(index)
  if (right < pageCount - 1) pages.push('...')
  pages.push(pageCount)
  return pages
}

export default function TenantPaymentProfilesPage() {
  const navigate = useNavigate()
  const { tenantCode } = useParams()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [rows, setRows] = useState([])
  const [filters, setFilters] = useState({ search: '', paymentMethod: '', isActive: '', isDefault: '' })
  const [appliedFilters, setAppliedFilters] = useState({ search: '', paymentMethod: '', isActive: '', isDefault: '' })
  const [pagination, setPagination] = useState({ page: 1, pageSize: 10, total: 0, pageCount: 1 })
  const pages = useMemo(() => buildPages(pagination.page, pagination.pageCount), [pagination.page, pagination.pageCount])

  useEffect(() => {
    let mounted = true
    async function load() {
      setLoading(true)
      setError('')
      try {
        const result = await listPaymentProfiles({ page: pagination.page, pageSize: pagination.pageSize, ...appliedFilters })
        if (!mounted) return
        setRows(Array.isArray(result?.rows) ? result.rows : [])
        setPagination(result?.pagination || { page: 1, pageSize: 10, total: 0, pageCount: 1 })
      } catch (requestError) {
        if (!mounted) return
        setRows([])
        setError(getPaymentProfileApiMessage(requestError, 'Không tải được hồ sơ thanh toán.'))
      } finally {
        if (mounted) setLoading(false)
      }
    }
    load()
    return () => { mounted = false }
  }, [appliedFilters, pagination.page, pagination.pageSize])

  const basePath = tenantCode ? `/t/${encodeURIComponent(tenantCode)}/tenant/settings/payment-profiles` : '/tenant/settings/payment-profiles'

  function resetFilters() {
    const next = { search: '', paymentMethod: '', isActive: '', isDefault: '' }
    setFilters(next)
    setAppliedFilters(next)
    setPagination((current) => ({ ...current, page: 1 }))
  }

  return (
    <TenantSettingsLayout activeTab='payment-profiles' pageTitle='Hồ sơ thanh toán' pageDescription='Quản lý các tài khoản và hướng dẫn nhận thanh toán dùng chung của tenant. Các hồ sơ này có thể được sử dụng cho lệ phí thi, học phí hoặc các nghiệp vụ thu khác.'>
      <div className='mb-4'>
        <div className='fs-5 fw-semibold'>Hồ sơ thanh toán</div>
        <div className='text-body-secondary'>Quản lý các tài khoản và hướng dẫn nhận thanh toán dùng chung của tenant. Các hồ sơ này có thể được sử dụng cho lệ phí thi, học phí hoặc các nghiệp vụ thu khác.</div>
      </div>

      <CRow className='g-3 mb-3'>
        <CCol lg={4} md={6}><CFormInput placeholder='Tìm theo tên, mã, ngân hàng hoặc số tài khoản' value={filters.search} onChange={(event) => setFilters((current) => ({ ...current, search: event.target.value }))} /></CCol>
        <CCol lg={2} md={6}><CFormSelect value={filters.paymentMethod} onChange={(event) => setFilters((current) => ({ ...current, paymentMethod: event.target.value }))}><option value=''>Tất cả phương thức</option><option value='bank_transfer'>Chuyển khoản ngân hàng</option><option value='cash'>Tiền mặt</option><option value='other'>Khác</option></CFormSelect></CCol>
        <CCol lg={2} md={6}><CFormSelect value={filters.isActive} onChange={(event) => setFilters((current) => ({ ...current, isActive: event.target.value }))}><option value=''>Tất cả trạng thái</option><option value='true'>Đang hoạt động</option><option value='false'>Ngừng sử dụng</option></CFormSelect></CCol>
        <CCol lg={2} md={6}><CFormSelect value={filters.isDefault} onChange={(event) => setFilters((current) => ({ ...current, isDefault: event.target.value }))}><option value=''>Mặc định và thường</option><option value='true'>Mặc định</option><option value='false'>Không mặc định</option></CFormSelect></CCol>
        <CCol lg={2} md={12} className='d-flex gap-2'>
          <CButton color='primary' className='flex-grow-1' onClick={() => { setPagination((current) => ({ ...current, page: 1 })); setAppliedFilters(filters) }}>Lọc</CButton>
          <CButton color='secondary' variant='outline' onClick={resetFilters}>Xóa lọc</CButton>
        </CCol>
      </CRow>

      <div className='d-flex justify-content-between align-items-center gap-3 flex-wrap mb-3'>
        <div className='small text-body-secondary'>Tổng cộng {pagination.total} hồ sơ</div>
        <CButton color='primary' onClick={() => navigate(`${basePath}/new`)}>Thêm hồ sơ thanh toán</CButton>
      </div>

      {error ? <CAlert color='danger'>{error}</CAlert> : null}

      {loading ? (
        <div className='d-flex align-items-center gap-2'><CSpinner size='sm' />Đang tải hồ sơ thanh toán...</div>
      ) : rows.length === 0 ? (
        appliedFilters.search || appliedFilters.paymentMethod || appliedFilters.isActive !== '' || appliedFilters.isDefault !== ''
          ? <CAlert color='secondary' className='mb-0'>Không tìm thấy hồ sơ phù hợp.</CAlert>
          : <div className='border rounded p-4 text-center bg-body-tertiary'><div className='fs-5 fw-semibold mb-2'>Chưa có hồ sơ thanh toán</div><div className='text-body-secondary mb-3'>Tạo hồ sơ đầu tiên để lưu tài khoản nhận tiền, nội dung chuyển khoản và hướng dẫn thanh toán dùng chung.</div><CButton color='primary' onClick={() => navigate(`${basePath}/new`)}>Tạo hồ sơ thanh toán</CButton></div>
      ) : (
        <>
          <CTable responsive hover align='middle'>
            <CTableHead>
              <CTableRow>
                <CTableHeaderCell>Tên hồ sơ</CTableHeaderCell>
                <CTableHeaderCell>Mã</CTableHeaderCell>
                <CTableHeaderCell>Phương thức</CTableHeaderCell>
                <CTableHeaderCell>Tài khoản nhận</CTableHeaderCell>
                <CTableHeaderCell>Trạng thái</CTableHeaderCell>
                <CTableHeaderCell>Mặc định</CTableHeaderCell>
                <CTableHeaderCell>Cập nhật</CTableHeaderCell>
                <CTableHeaderCell>Thao tác</CTableHeaderCell>
              </CTableRow>
            </CTableHead>
            <CTableBody>
              {rows.map((row) => {
                const meta = getPaymentProfileStatusMeta(row)
                return (
                  <CTableRow key={row.id}>
                    <CTableDataCell>
                      <div className='fw-semibold'>{row.name || '-'}</div>
                      <div className='small text-body-secondary text-truncate' style={{ maxWidth: 260 }}>{row.description || 'Chưa có mô tả.'}</div>
                    </CTableDataCell>
                    <CTableDataCell>{row.code || '-'}</CTableDataCell>
                    <CTableDataCell>{getPaymentProfileMethodLabel(row.paymentMethod)}</CTableDataCell>
                    <CTableDataCell>{getPaymentProfileReceiverSummary(row)}</CTableDataCell>
                    <CTableDataCell><CBadge color={meta.activeColor}>{meta.activeLabel}</CBadge></CTableDataCell>
                    <CTableDataCell><CBadge color={meta.defaultColor}>{meta.defaultLabel}</CBadge></CTableDataCell>
                    <CTableDataCell>{row.updatedAt || '-'}</CTableDataCell>
                    <CTableDataCell><CButton size='sm' color='secondary' variant='outline' onClick={() => navigate(`${basePath}/${row.id}`)}>Xem chi tiết</CButton></CTableDataCell>
                  </CTableRow>
                )
              })}
            </CTableBody>
          </CTable>

          {pagination.pageCount > 1 ? (
            <div className='d-flex justify-content-end'>
              <CPagination>
                <CPaginationItem disabled={pagination.page <= 1} onClick={() => setPagination((current) => ({ ...current, page: Math.max(1, current.page - 1) }))}>Trước</CPaginationItem>
                {pages.map((entry, index) => entry === '...'
                  ? <CPaginationItem key={`payment-profile-ellipsis-${index}`} disabled>...</CPaginationItem>
                  : <CPaginationItem key={`payment-profile-page-${entry}`} active={pagination.page === entry} onClick={() => setPagination((current) => ({ ...current, page: entry }))}>{entry}</CPaginationItem>)}
                <CPaginationItem disabled={pagination.page >= pagination.pageCount} onClick={() => setPagination((current) => ({ ...current, page: Math.min(current.pageCount, current.page + 1) }))}>Sau</CPaginationItem>
              </CPagination>
            </div>
          ) : null}
        </>
      )}
    </TenantSettingsLayout>
  )
}