import { useEffect, useMemo, useState } from 'react'
import {
  CAlert,
  CBadge,
  CButton,
  CCard,
  CCardBody,
  CCardHeader,
  CCol,
  CFormLabel,
  CFormSelect,
  CFormSwitch,
  CRow,
  CSpinner,
  CTable,
  CTableBody,
  CTableDataCell,
  CTableHead,
  CTableHeaderCell,
  CTableRow,
} from '@coreui/react'
import {
  getApiMessage,
  getPlatformGameTypes,
  getPlatformTenantGameTypes,
  getPlatformTenants,
  updatePlatformTenantGameTypeLicense,
} from '../services/platformApi'

function formatStatusBadge(isLicensed) {
  return isLicensed
    ? <CBadge color='success'>Licensed</CBadge>
    : <CBadge color='secondary'>Not licensed</CBadge>
}

export default function PlatformGameTypeManager() {
  const [tenants, setTenants] = useState([])
  const [gameTypes, setGameTypes] = useState([])
  const [selectedTenantId, setSelectedTenantId] = useState('')
  const [tenantDetail, setTenantDetail] = useState({ tenant: null, gameTypes: [] })
  const [loading, setLoading] = useState(true)
  const [detailLoading, setDetailLoading] = useState(false)
  const [actionKey, setActionKey] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  useEffect(() => {
    let active = true

    async function load() {
      setLoading(true)
      setError('')
      try {
        const [tenantRows, gameTypeRows] = await Promise.all([
          getPlatformTenants(),
          getPlatformGameTypes(),
        ])

        if (!active) return

        setTenants(Array.isArray(tenantRows) ? tenantRows : [])
        setGameTypes(Array.isArray(gameTypeRows) ? gameTypeRows : [])

        const defaultTenantId = String(tenantRows?.[0]?.id || '')
        setSelectedTenantId((previous) => previous || defaultTenantId)
      } catch (requestError) {
        if (!active) return
        setError(getApiMessage(requestError, 'Khong tai duoc game type licensing'))
      } finally {
        if (active) setLoading(false)
      }
    }

    load()
    return () => {
      active = false
    }
  }, [])

  useEffect(() => {
    if (!selectedTenantId) {
      setTenantDetail({ tenant: null, gameTypes: [] })
      return
    }

    let active = true

    async function loadTenantDetail() {
      setDetailLoading(true)
      setError('')
      try {
        const detail = await getPlatformTenantGameTypes(selectedTenantId)
        if (!active) return
        setTenantDetail({
          tenant: detail?.tenant || null,
          gameTypes: Array.isArray(detail?.gameTypes) ? detail.gameTypes : [],
        })
      } catch (requestError) {
        if (!active) return
        setError(getApiMessage(requestError, 'Khong tai duoc license game type cua tenant'))
      } finally {
        if (active) setDetailLoading(false)
      }
    }

    loadTenantDetail()
    return () => {
      active = false
    }
  }, [selectedTenantId])

  const selectedTenant = useMemo(
    () => tenants.find((item) => String(item?.id) === String(selectedTenantId)) || null,
    [selectedTenantId, tenants],
  )

  async function handleToggleLicense(gameType, nextLicensed) {
    if (!selectedTenantId || !gameType?.id) return

    setActionKey(`${selectedTenantId}:${gameType.id}`)
    setError('')
    setSuccess('')
    try {
      await updatePlatformTenantGameTypeLicense(selectedTenantId, gameType.id, nextLicensed)
      const detail = await getPlatformTenantGameTypes(selectedTenantId)
      setTenantDetail({
        tenant: detail?.tenant || selectedTenant || null,
        gameTypes: Array.isArray(detail?.gameTypes) ? detail.gameTypes : [],
      })
      setSuccess(nextLicensed ? 'Da cap phep game type cho tenant' : 'Da thu hoi game type cua tenant')
    } catch (requestError) {
      setError(getApiMessage(requestError, 'Khong cap nhat duoc game type licensing'))
    } finally {
      setActionKey('')
    }
  }

  return (
    <div className='container-fluid py-4'>
      <div className='d-flex flex-column flex-lg-row align-items-lg-center justify-content-between gap-3 mb-4'>
        <div>
          <h2 className='mb-1'>Platform Game Type Licensing</h2>
          <p className='text-body-secondary mb-0'>
            Quan ly game type cap platform va cap phep cho tung tenant truoc khi tenant admin co the bat su dung.
          </p>
        </div>
      </div>

      {error ? <CAlert color='danger'>{error}</CAlert> : null}
      {success ? <CAlert color='success'>{success}</CAlert> : null}

      <CRow className='g-3 mb-4'>
        <CCol md={4} xl={3}>
          <CCard className='h-100'>
            <CCardHeader><strong>Tenant</strong></CCardHeader>
            <CCardBody>
              {loading ? (
                <div className='d-flex align-items-center gap-2'><CSpinner size='sm' /> Dang tai tenant...</div>
              ) : (
                <>
                  <CFormLabel htmlFor='platform-game-type-tenant'>Chon tenant</CFormLabel>
                  <CFormSelect
                    id='platform-game-type-tenant'
                    value={selectedTenantId}
                    onChange={(event) => setSelectedTenantId(event.target.value)}
                  >
                    <option value=''>-- Chon tenant --</option>
                    {tenants.map((tenant) => (
                      <option key={tenant.id} value={tenant.id}>
                        {tenant.name || tenant.code || `Tenant #${tenant.id}`}
                      </option>
                    ))}
                  </CFormSelect>
                  {selectedTenant ? (
                    <div className='small text-body-secondary mt-3'>
                      <div><strong>Code:</strong> {selectedTenant.code || '-'}</div>
                      <div><strong>Status:</strong> {selectedTenant.status || '-'}</div>
                    </div>
                  ) : null}
                </>
              )}
            </CCardBody>
          </CCard>
        </CCol>

        <CCol md={8} xl={9}>
          <CCard className='h-100'>
            <CCardHeader className='d-flex justify-content-between align-items-center gap-2'>
              <strong>Game Types</strong>
              {detailLoading ? <CSpinner size='sm' /> : null}
            </CCardHeader>
            <CCardBody>
              {!selectedTenantId ? (
                <div className='text-body-secondary'>Chon tenant de xem game type licensing.</div>
              ) : detailLoading ? (
                <div className='d-flex align-items-center gap-2'><CSpinner size='sm' /> Dang tai chi tiet...</div>
              ) : (
                <CTable responsive hover align='middle'>
                  <CTableHead>
                    <CTableRow>
                      <CTableHeaderCell>Game Type</CTableHeaderCell>
                      <CTableHeaderCell>Code</CTableHeaderCell>
                      <CTableHeaderCell>Status</CTableHeaderCell>
                      <CTableHeaderCell>Tenant enablement</CTableHeaderCell>
                      <CTableHeaderCell className='text-end'>Platform license</CTableHeaderCell>
                    </CTableRow>
                  </CTableHead>
                  <CTableBody>
                    {(tenantDetail.gameTypes.length > 0 ? tenantDetail.gameTypes : gameTypes).map((gameType) => {
                      const loadingKey = `${selectedTenantId}:${gameType.id}`
                      return (
                        <CTableRow key={gameType.id}>
                          <CTableDataCell>
                            <div className='fw-semibold'>{gameType.name || '-'}</div>
                            <div className='small text-body-secondary'>{gameType.description || 'Khong co mo ta'}</div>
                          </CTableDataCell>
                          <CTableDataCell>{gameType.code || '-'}</CTableDataCell>
                          <CTableDataCell>{formatStatusBadge(gameType.isLicensed)}</CTableDataCell>
                          <CTableDataCell>
                            {gameType.isLicensed ? (
                              gameType.isEnabled
                                ? <CBadge color='success'>Enabled by tenant</CBadge>
                                : <CBadge color='warning' textColor='dark'>Licensed only</CBadge>
                            ) : (
                              <CBadge color='secondary'>Unavailable</CBadge>
                            )}
                          </CTableDataCell>
                          <CTableDataCell className='text-end'>
                            <div className='d-inline-flex align-items-center gap-2'>
                              {actionKey === loadingKey ? <CSpinner size='sm' /> : null}
                              <CFormSwitch
                                checked={gameType.isLicensed === true}
                                disabled={Boolean(actionKey)}
                                onChange={(event) => handleToggleLicense(gameType, event.target.checked)}
                                label={gameType.isLicensed ? 'Licensed' : 'Grant'}
                              />
                            </div>
                          </CTableDataCell>
                        </CTableRow>
                      )
                    })}
                  </CTableBody>
                </CTable>
              )}
            </CCardBody>
          </CCard>
        </CCol>
      </CRow>
    </div>
  )
}
