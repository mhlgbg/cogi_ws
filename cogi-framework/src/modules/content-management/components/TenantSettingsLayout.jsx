import { CBreadcrumb, CBreadcrumbItem, CCard, CCardBody, CNav, CNavItem, CNavLink } from '@coreui/react'
import { useNavigate, useParams } from 'react-router-dom'
import { useTenant } from '../../../contexts/TenantContext'

function buildBasePath(tenantCode = '') {
  return tenantCode ? `/t/${encodeURIComponent(tenantCode)}/tenant/settings` : '/tenant/settings'
}

export default function TenantSettingsLayout({ activeTab = 'website', pageTitle = '', pageDescription = '', children }) {
  const navigate = useNavigate()
  const { tenantCode } = useParams()
  const tenant = useTenant()
  const basePath = buildBasePath(tenantCode)
  const tenantName = tenant?.currentTenant?.tenantName || tenant?.resolvedTenant?.tenantName || ''

  const tabs = [
    { key: 'website', label: 'Website', path: `${basePath}/website` },
    { key: 'payment-profiles', label: 'Hồ sơ thanh toán', path: `${basePath}/payment-profiles` },
  ]

  return (
    <div className='py-4'>
      <CBreadcrumb className='mb-3'>
        <CBreadcrumbItem active={activeTab === 'website' && !pageTitle}>Cấu hình tenant</CBreadcrumbItem>
        {pageTitle ? <CBreadcrumbItem active>{pageTitle}</CBreadcrumbItem> : null}
      </CBreadcrumb>

      <div className='mb-4'>
        <div className='fs-4 fw-semibold'>Cấu hình tenant</div>
        <div className='text-body-secondary'>Quản lý các cấu hình dùng chung của đơn vị, bao gồm thông tin website, hồ sơ nhận thanh toán và các thiết lập vận hành khác.</div>
        <div className='small text-body-secondary mt-1'>Các cấu hình tại đây chỉ áp dụng cho tenant hiện tại.{tenantName ? ` Tenant hiện tại: ${tenantName}.` : ''}</div>
      </div>

      <CNav variant='tabs' className='mb-4 flex-nowrap overflow-auto'>
        {tabs.map((tab) => (
          <CNavItem key={tab.key}>
            <CNavLink href='#' active={activeTab === tab.key} onClick={(event) => { event.preventDefault(); navigate(tab.path) }}>
              {tab.label}
            </CNavLink>
          </CNavItem>
        ))}
      </CNav>

      <CCard>
        <CCardBody>
          {children}
        </CCardBody>
      </CCard>
    </div>
  )
}