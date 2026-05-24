import { useEffect, useState } from 'react'
import {
  CAlert,
  CBadge,
  CButton,
  CCard,
  CCardBody,
  CCardHeader,
  CSpinner,
  CTable,
  CTableBody,
  CTableDataCell,
  CTableHead,
  CTableHeaderCell,
  CTableRow,
} from '@coreui/react'
import { getApiMessage, getPlatformTenants, updatePlatformTenantStatus } from '../services/platformApi'

function getStatusColor(status) {
  const normalized = String(status || '').trim().toUpperCase()
  if (normalized === 'ACTIVE') return 'success'
  if (normalized === 'SUSPENDED') return 'warning'
  if (normalized === 'DELETED') return 'secondary'
  return 'light'
}

function formatCreatedAt(value) {
  const timestamp = Date.parse(String(value || ''))
  if (Number.isNaN(timestamp)) return '-'

  return new Date(timestamp).toLocaleString('vi-VN')
}

export default function TenantManager() {
  const [loading, setLoading] = useState(false)
  const [actionId, setActionId] = useState(null)
  const [rows, setRows] = useState([])
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  useEffect(() => {
    let cancelled = false

    async function loadTenants() {
      setLoading(true)
      setError('')

      try {
        const nextRows = await getPlatformTenants()
        if (cancelled) return
        setRows(nextRows)
      } catch (requestError) {
        if (cancelled) return
        setError(getApiMessage(requestError, 'Khong tai duoc danh sach tenant'))
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    loadTenants()

    return () => {
      cancelled = true
    }
  }, [])

  async function reloadTenants() {
    const nextRows = await getPlatformTenants()
    setRows(nextRows)
  }

  async function handleStatusAction(tenantId, nextStatus) {
    setActionId(tenantId)
    setError('')
    setSuccess('')

    try {
      await updatePlatformTenantStatus(tenantId, nextStatus)
      await reloadTenants()
      setSuccess('Cap nhat tenant status thanh cong')
    } catch (requestError) {
      setError(getApiMessage(requestError, 'Khong cap nhat duoc tenant status'))
    } finally {
      setActionId(null)
    }
  }

  return (
    <CCard>
      <CCardHeader>
        <strong>Platform Tenant Manager</strong>
      </CCardHeader>
      <CCardBody>
        {success ? <CAlert color='success'>{success}</CAlert> : null}
        {error ? <CAlert color='danger'>{error}</CAlert> : null}

        {loading ? (
          <div className='d-flex align-items-center gap-2'>
            <CSpinner size='sm' />
            <span>Dang tai tenant...</span>
          </div>
        ) : (
          <CTable hover responsive>
            <CTableHead>
              <CTableRow>
                <CTableHeaderCell>Name</CTableHeaderCell>
                <CTableHeaderCell style={{ width: 180 }}>Code</CTableHeaderCell>
                <CTableHeaderCell style={{ width: 160 }}>Status</CTableHeaderCell>
                <CTableHeaderCell style={{ width: 200 }}>Created</CTableHeaderCell>
                <CTableHeaderCell style={{ width: 280 }}>Actions</CTableHeaderCell>
              </CTableRow>
            </CTableHead>
            <CTableBody>
              {rows.map((item) => {
                const currentStatus = String(item?.status || '').trim().toUpperCase() || '-'
                const isSaving = actionId === item.id

                return (
                  <CTableRow key={item.id}>
                    <CTableDataCell>{item.name || '-'}</CTableDataCell>
                    <CTableDataCell>{item.code || '-'}</CTableDataCell>
                    <CTableDataCell>
                      <CBadge color={getStatusColor(currentStatus)}>{currentStatus}</CBadge>
                    </CTableDataCell>
                    <CTableDataCell>{formatCreatedAt(item.createdAt)}</CTableDataCell>
                    <CTableDataCell>
                      <div className='d-flex gap-2 flex-wrap'>
                        <CButton
                          color='success'
                          variant='outline'
                          onClick={() => handleStatusAction(item.id, 'ACTIVE')}
                          disabled={isSaving || currentStatus === 'ACTIVE'}
                        >
                          {isSaving ? 'Dang xu ly...' : 'Activate'}
                        </CButton>
                        <CButton
                          color='warning'
                          variant='outline'
                          onClick={() => handleStatusAction(item.id, 'SUSPENDED')}
                          disabled={isSaving || currentStatus === 'SUSPENDED'}
                        >
                          Suspend
                        </CButton>
                        <CButton
                          color='danger'
                          variant='outline'
                          onClick={() => handleStatusAction(item.id, 'DELETED')}
                          disabled={isSaving || currentStatus === 'DELETED'}
                        >
                          Delete
                        </CButton>
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
  )
}