import { useState } from 'react'
import {
  CAlert,
  CBadge,
  CButton,
  CCard,
  CCardBody,
  CCardHeader,
  CCol,
  CForm,
  CFormInput,
  CFormLabel,
  CRow,
  CSpinner,
  CTable,
  CTableBody,
  CTableDataCell,
  CTableHead,
  CTableHeaderCell,
  CTableRow,
} from '@coreui/react'
import { getApiMessage, getPermissionDebug } from '../services/platformApi'

function getBooleanBadgeColor(value) {
  return value ? 'success' : 'secondary'
}

export default function PermissionDebugger() {
  const [form, setForm] = useState({ userId: '', tenantCode: '' })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState({ roles: [], features: [] })

  async function handleSubmit(event) {
    event.preventDefault()
    setLoading(true)
    setError('')

    try {
      const nextResult = await getPermissionDebug({
        userId: form.userId,
        tenantCode: form.tenantCode,
      })

      setResult(nextResult)
    } catch (requestError) {
      setError(getApiMessage(requestError, 'Khong tai duoc permission debug'))
      setResult({ roles: [], features: [] })
    } finally {
      setLoading(false)
    }
  }

  return (
    <CCard>
      <CCardHeader>
        <strong>Platform Permission Debugger</strong>
      </CCardHeader>
      <CCardBody>
        <div className='mb-4 text-body-secondary'>
          Kiem tra read-only quyen cua mot user trong tenant de doi chieu role feature va tenant feature.
        </div>

        <CForm onSubmit={handleSubmit} className='mb-4'>
          <CRow className='g-3 align-items-end'>
            <CCol md={4}>
              <CFormLabel>User ID</CFormLabel>
              <CFormInput
                type='number'
                value={form.userId}
                onChange={(event) => setForm((previous) => ({ ...previous, userId: event.target.value }))}
                placeholder='Nhap user id'
              />
            </CCol>
            <CCol md={4}>
              <CFormLabel>Tenant code</CFormLabel>
              <CFormInput
                value={form.tenantCode}
                onChange={(event) => setForm((previous) => ({ ...previous, tenantCode: event.target.value }))}
                placeholder='Nhap tenant code'
              />
            </CCol>
            <CCol md={4}>
              <CButton type='submit' color='primary' disabled={loading}>
                {loading ? 'Dang kiem tra...' : 'Check Permission'}
              </CButton>
            </CCol>
          </CRow>
        </CForm>

        {loading ? (
          <div className='d-flex align-items-center gap-2 mb-3'>
            <CSpinner size='sm' />
            <span>Dang tai du lieu debug...</span>
          </div>
        ) : null}

        {error ? <CAlert color='danger'>{error}</CAlert> : null}

        <section className='mb-4'>
          <h2 className='h5 mb-3'>Roles</h2>
          {result.roles.length === 0 ? (
            <div className='text-body-secondary'>Khong co role active nao trong tenant nay.</div>
          ) : (
            <CTable hover responsive>
              <CTableHead>
                <CTableRow>
                  <CTableHeaderCell style={{ width: 80 }}>ID</CTableHeaderCell>
                  <CTableHeaderCell>Name</CTableHeaderCell>
                  <CTableHeaderCell style={{ width: 220 }}>Code</CTableHeaderCell>
                  <CTableHeaderCell>Label</CTableHeaderCell>
                </CTableRow>
              </CTableHead>
              <CTableBody>
                {result.roles.map((role) => (
                  <CTableRow key={role.id || role.code || role.label}>
                    <CTableDataCell>{role.id || '-'}</CTableDataCell>
                    <CTableDataCell>{role.name || '-'}</CTableDataCell>
                    <CTableDataCell>{role.code || '-'}</CTableDataCell>
                    <CTableDataCell>{role.label || '-'}</CTableDataCell>
                  </CTableRow>
                ))}
              </CTableBody>
            </CTable>
          )}
        </section>

        <section>
          <h2 className='h5 mb-3'>Features</h2>
          {result.features.length === 0 ? (
            <div className='text-body-secondary'>Khong co feature nao de debug.</div>
          ) : (
            <CTable hover responsive>
              <CTableHead>
                <CTableRow>
                  <CTableHeaderCell>featureKey</CTableHeaderCell>
                  <CTableHeaderCell style={{ width: 160 }}>hasRoleFeature</CTableHeaderCell>
                  <CTableHeaderCell style={{ width: 170 }}>hasTenantFeature</CTableHeaderCell>
                  <CTableHeaderCell style={{ width: 120 }}>Allowed</CTableHeaderCell>
                </CTableRow>
              </CTableHead>
              <CTableBody>
                {result.features.map((feature) => (
                  <CTableRow key={feature.featureKey}>
                    <CTableDataCell>{feature.featureKey}</CTableDataCell>
                    <CTableDataCell>
                      <CBadge color={getBooleanBadgeColor(feature.hasRoleFeature)}>{feature.hasRoleFeature ? 'true' : 'false'}</CBadge>
                    </CTableDataCell>
                    <CTableDataCell>
                      <CBadge color={getBooleanBadgeColor(feature.hasTenantFeature)}>{feature.hasTenantFeature ? 'true' : 'false'}</CBadge>
                    </CTableDataCell>
                    <CTableDataCell>
                      <CBadge color={getBooleanBadgeColor(feature.allowed)}>{feature.allowed ? 'true' : 'false'}</CBadge>
                    </CTableDataCell>
                  </CTableRow>
                ))}
              </CTableBody>
            </CTable>
          )}
        </section>
      </CCardBody>
    </CCard>
  )
}